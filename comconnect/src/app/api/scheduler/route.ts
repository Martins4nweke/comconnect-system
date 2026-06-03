import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";

type Channel = "app" | "sms" | "voice" | "whatsapp";

function normaliseChannel(value: unknown): Channel | null {
  const text = String(value ?? "").trim().toLowerCase();

  if (text === "push" || text === "app_push") return "app";
  if (["app", "sms", "voice", "whatsapp"].includes(text)) {
    return text as Channel;
  }

  return null;
}

function boolValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;

  const text = String(value ?? "").trim().toLowerCase();

  if (["true", "yes", "1", "y"].includes(text)) return true;
  if (["false", "no", "0", "n"].includes(text)) return false;

  return fallback;
}

function isAppOnlySource(sourceType: string) {
  return ["questionnaire", "education", "education_video"].includes(sourceType);
}

function providerForChannel(channel: Channel) {
  if (channel === "app") return "expo";
  if (channel === "sms") return "africastalking";
  if (channel === "voice") return "africastalking";
  return "disabled";
}

function resolveAllowedChannels(sourceType: string, value: unknown): Channel[] {
  if (isAppOnlySource(sourceType)) return ["app"];

  if (Array.isArray(value)) {
    const channels = value
      .map(normaliseChannel)
      .filter(Boolean) as Channel[];

    return channels.length > 0 ? channels : ["app", "sms", "voice"];
  }

  return ["app", "sms", "voice"];
}

function resolveDeliveryMode(sourceType: string, value: unknown) {
  if (isAppOnlySource(sourceType)) return "app_only";
  return String(value ?? "participant_preference");
}

function resolveRequestedChannel({
  deliveryMode,
  allowedChannels,
  requestedChannel,
  participantPreferredChannel,
}: {
  deliveryMode: string;
  allowedChannels: Channel[];
  requestedChannel: Channel | null;
  participantPreferredChannel: Channel | null;
}) {
  if (deliveryMode === "app_only") return "app";

  if (requestedChannel && allowedChannels.includes(requestedChannel)) {
    return requestedChannel;
  }

  if (
    participantPreferredChannel &&
    allowedChannels.includes(participantPreferredChannel)
  ) {
    return participantPreferredChannel;
  }

  return allowedChannels[0] ?? "app";
}

async function resolveParticipant(body: any) {
  const participantId = body?.participant_id
    ? String(body.participant_id).trim()
    : "";

  if (participantId) {
    const { data, error } = await supabaseAdmin
      .from("participants")
      .select("*, projects(project_code)")
      .eq("id", participantId)
      .single();

    if (error || !data) throw new Error("Participant not found");
    return data;
  }

  const participantCode = body?.participant_code
    ? String(body.participant_code).trim()
    : "";

  const projectCode = body?.project_code
    ? String(body.project_code).trim()
    : "";

  if (!participantCode || !projectCode) {
    throw new Error("participant_id or project_code + participant_code is required");
  }

  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id")
    .eq("project_code", projectCode)
    .single();

  if (projectError || !project) {
    throw new Error("Project code not found");
  }

  const { data, error } = await supabaseAdmin
    .from("participants")
    .select("*, projects(project_code)")
    .eq("project_id", project.id)
    .eq("participant_code", participantCode)
    .single();

  if (error || !data) throw new Error("Participant not found");

  return data;
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project_id");
  const participantId = req.nextUrl.searchParams.get("participant_id");
  const status = req.nextUrl.searchParams.get("status");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50);

  let query = supabaseAdmin
    .from("communication_schedules")
    .select("*, participants(participant_code, phone_number, metadata)")
    .order("scheduled_for", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));

  if (projectId) query = query.eq("project_id", projectId);
  if (participantId) query = query.eq("participant_id", participantId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) return fail(error.message, 500);

  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body?.scheduled_for) {
    return fail("scheduled_for is required");
  }

  try {
    const participant = await resolveParticipant(body);
    const sourceType = String(body.source_type ?? "manual_message");
    const deliveryMode = resolveDeliveryMode(sourceType, body.delivery_mode);
    const allowedChannels = resolveAllowedChannels(
      sourceType,
      body.allowed_channels
    );

    const requestedChannel = normaliseChannel(body.requested_channel ?? body.channel);
    const participantPreferredChannel = normaliseChannel(
      participant.metadata?.preferred_channel
    );

    const resolvedChannel = resolveRequestedChannel({
      deliveryMode,
      allowedChannels,
      requestedChannel,
      participantPreferredChannel,
    });

    const schedulePayload = {
      organisation_id: participant.organisation_id,
      project_id: participant.project_id,
      participant_id: participant.id,
      participant_code: participant.participant_code,

      message_code: body.message_code ?? null,
      message_title: body.message_title ?? body.title ?? "ComConnect message",
      message_body:
        body.message_body ??
        body.body ??
        "You have a ComConnect update. Please open the app.",

      source_type: sourceType,
      source_id: body.source_id ?? null,
      source_label: body.source_label ?? null,

      delivery_mode: deliveryMode,
      allowed_channels: allowedChannels,

      requested_channel: requestedChannel,
      resolved_channel: resolvedChannel,
      provider: providerForChannel(resolvedChannel),

      priority: body.priority ?? "normal",
      scheduled_for: new Date(body.scheduled_for).toISOString(),

      respect_quiet_time: boolValue(body.respect_quiet_time, true),
      quiet_time_start:
        body.quiet_time_start ??
        participant.metadata?.quiet_time_start ??
        "20:00",
      quiet_time_end:
        body.quiet_time_end ??
        participant.metadata?.quiet_time_end ??
        "07:00",
      timezone:
        body.timezone ??
        participant.metadata?.timezone ??
        "Africa/Johannesburg",

      status: "pending",
      max_attempts: Number(body.max_attempts ?? 1),

      metadata: {
        ...(body.metadata ?? {}),
        participant_preferred_channel:
          participant.metadata?.preferred_channel ?? "app",
        app_only_protected: deliveryMode === "app_only",
        created_from: "scheduler_api",
      },
    };

    const { data, error } = await supabaseAdmin
      .from("communication_schedules")
      .insert(schedulePayload)
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    await createAuditLog({
      organisation_id: data.organisation_id,
      project_id: data.project_id,
      actor_type: "dashboard_user",
      action: "communication_schedule.created",
      entity_type: "communication_schedule",
      entity_id: data.id,
      metadata: {
        participant_code: data.participant_code,
        source_type: data.source_type,
        delivery_mode: data.delivery_mode,
        resolved_channel: data.resolved_channel,
      },
    });

    return ok(data, 201);
  } catch (error: any) {
    return fail(error.message ?? "Failed to create schedule", 400);
  }
}