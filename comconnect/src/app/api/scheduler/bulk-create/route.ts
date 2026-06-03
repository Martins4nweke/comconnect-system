import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";

type Channel = "app" | "sms" | "voice" | "whatsapp";

const MAX_BULK_SCHEDULES = 500;

function normaliseChannel(value: unknown): Channel {
  const text = String(value ?? "").trim().toLowerCase();

  if (text === "push" || text === "app_push") return "app";
  if (text === "sms") return "sms";
  if (text === "voice") return "voice";
  if (text === "whatsapp") return "whatsapp";

  return "app";
}

function boolValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;

  const text = String(value ?? "").trim().toLowerCase();

  if (["true", "yes", "1", "y"].includes(text)) return true;
  if (["false", "no", "0", "n"].includes(text)) return false;

  return fallback;
}

function providerForChannel(channel: Channel) {
  if (channel === "app") return "expo";
  if (channel === "sms") return "africastalking";
  if (channel === "voice") return "africastalking";
  return "disabled";
}

function isAppOnlySource(sourceType: string) {
  return ["questionnaire", "education", "education_video"].includes(sourceType);
}

function resolveAllowedChannels(sourceType: string, value: unknown): Channel[] {
  if (isAppOnlySource(sourceType)) return ["app"];

  if (Array.isArray(value)) {
    const channels = value
      .map((item) => normaliseChannel(item))
      .filter(Boolean);

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
  requestedChannel: Channel;
  participantPreferredChannel: Channel;
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

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function resolveProject(body: any) {
  const projectId = body?.project_id ? String(body.project_id).trim() : "";
  const projectCode = body?.project_code ? String(body.project_code).trim() : "";

  if (projectId) {
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select("id, organisation_id, project_code")
      .eq("id", projectId)
      .single();

    if (error || !data) throw new Error("Project not found");
    return data;
  }

  if (projectCode) {
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select("id, organisation_id, project_code")
      .eq("project_code", projectCode)
      .single();

    if (error || !data) throw new Error("Project code not found");
    return data;
  }

  return null;
}

async function loadParticipants(body: any) {
  const mode = String(body?.mode ?? "selected");

  const explicitParticipantIds: string[] = Array.isArray(body?.participant_ids)
    ? body.participant_ids.map((id: unknown) => String(id).trim()).filter(Boolean)
    : [];

  if (mode === "selected") {
    if (explicitParticipantIds.length === 0) {
      throw new Error("participant_ids are required for selected mode");
    }

    if (explicitParticipantIds.length > MAX_BULK_SCHEDULES) {
      throw new Error(`You can schedule a maximum of ${MAX_BULK_SCHEDULES} selected participants at once.`);
    }

    const { data, error } = await supabaseAdmin
      .from("participants")
      .select("*")
      .in("id", explicitParticipantIds)
      .neq("status", "archived");

    if (error) throw new Error(error.message);

    return data ?? [];
  }

  if (mode === "all_active") {
    const project = await resolveProject(body);

    if (!project) {
      throw new Error("project_id or project_code is required for all_active mode");
    }

    const requestedLimit = Number(body?.limit ?? MAX_BULK_SCHEDULES);
    const safeLimit = Math.min(
      Math.max(Number.isFinite(requestedLimit) ? requestedLimit : MAX_BULK_SCHEDULES, 1),
      MAX_BULK_SCHEDULES
    );

    let query = supabaseAdmin
      .from("participants")
      .select("*")
      .eq("project_id", project.id)
      .neq("status", "archived")
      .order("created_at", { ascending: true })
      .limit(safeLimit);

    if (body?.status) {
      query = query.eq("status", String(body.status));
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return data ?? [];
  }

  throw new Error("Unsupported bulk schedule mode");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body) {
    return fail("Invalid request body", 400);
  }

  if (!body?.scheduled_for) {
    return fail("scheduled_for is required", 400);
  }

  if (!body?.message_code) {
    return fail("message_code is required", 400);
  }

  try {
    const participants = await loadParticipants(body);

    if (participants.length === 0) {
      return fail("No matching participants found", 400);
    }

    if (participants.length > MAX_BULK_SCHEDULES) {
      return fail(`You can schedule a maximum of ${MAX_BULK_SCHEDULES} participants at once.`, 400);
    }

    const sourceType = String(body.source_type ?? "manual_message");
    const deliveryMode = resolveDeliveryMode(sourceType, body.delivery_mode);
    const allowedChannels = resolveAllowedChannels(
      sourceType,
      body.allowed_channels
    );
    const requestedChannel = normaliseChannel(
      body.requested_channel ?? body.channel
    );

    const rows = participants.map((participant) => {
      const participantPreferredChannel = normaliseChannel(
        participant.metadata?.preferred_channel
      );

      const resolvedChannel = resolveRequestedChannel({
        deliveryMode,
        allowedChannels,
        requestedChannel,
        participantPreferredChannel,
      });

      return {
        organisation_id: participant.organisation_id,
        project_id: participant.project_id,
        participant_id: participant.id,
        participant_code: participant.participant_code,

        message_code: body.message_code ?? null,
        message_title:
          body.message_title ?? body.title ?? "ComConnect message",
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
          bulk_created: true,
          bulk_mode: body.mode ?? "selected",
          participant_preferred_channel:
            participant.metadata?.preferred_channel ?? "app",
          app_only_protected: deliveryMode === "app_only",
          created_from: "scheduler_bulk_create_api",
        },
      };
    });

    let insertedCount = 0;
    const insertedIds: string[] = [];

    for (const batch of chunk(rows, 500)) {
      const { data, error } = await supabaseAdmin
        .from("communication_schedules")
        .insert(batch)
        .select("id");

      if (error) {
        return fail(error.message, 500);
      }

      insertedCount += data?.length ?? 0;
      insertedIds.push(...((data ?? []).map((item) => item.id)));
    }

    const firstParticipant = participants[0];

    await createAuditLog({
      organisation_id: firstParticipant.organisation_id,
      project_id: firstParticipant.project_id,
      actor_type: "dashboard_user",
      action: "communication_schedules.bulk_created",
      entity_type: "communication_schedule",
      entity_id: null,
      metadata: {
        mode: body.mode ?? "selected",
        attempted_count: participants.length,
        inserted_count: insertedCount,
        message_code: body.message_code,
        requested_channel: requestedChannel,
      },
    });

    return ok({
      attempted_count: participants.length,
      inserted_count: insertedCount,
      inserted_ids: insertedIds,
      limit: MAX_BULK_SCHEDULES,
    });
  } catch (error: any) {
    return fail(error.message ?? "Bulk schedule failed", 400);
  }
}