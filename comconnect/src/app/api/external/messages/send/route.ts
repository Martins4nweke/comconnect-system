import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { authenticateExternalApiKey } from "@/lib/external-api/authenticate-api-key";
import { logApiUsage } from "@/lib/api-usage/log-api-usage";

export const runtime = "nodejs";

const ALLOWED_CHANNELS = new Set(["app", "push", "sms", "voice", "whatsapp"]);
const PAID_OR_CONTROLLED_CHANNELS = new Set(["push", "sms", "voice", "whatsapp"]);
type ExternalMessageChannel = "app" | "push" | "sms" | "voice" | "whatsapp";

function apiUsageChannel(value: string): ExternalMessageChannel {
  if (value === "push") return "push";
  if (value === "sms") return "sms";
  if (value === "voice") return "voice";
  if (value === "whatsapp") return "whatsapp";
  return "app";
}
const ALLOWED_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function boolValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;

  const text = cleanText(value).toLowerCase();

  if (["true", "yes", "1", "y"].includes(text)) return true;
  if (["false", "no", "0", "n"].includes(text)) return false;

  return fallback;
}

function normalisePriority(value: unknown) {
  const priority = cleanText(value).toLowerCase() || "normal";
  return ALLOWED_PRIORITIES.has(priority) ? priority : "normal";
}

function normaliseChannel(value: unknown) {
  const channel = cleanText(value).toLowerCase() || "app";
  return ALLOWED_CHANNELS.has(channel) ? channel : "";
}

function scheduleDeliveryModeForChannel(channel: string) {
  if (channel === "app") return "app_only";
  if (channel === "sms") return "sms_only";
  if (channel === "voice") return "voice_only";
  return "participant_preference";
}

function scheduleAllowedChannelsForChannel(channel: string) {
  if (channel === "app") return ["app"];
  if (channel === "push") return ["push"];
  if (channel === "sms") return ["sms"];
  if (channel === "whatsapp") return ["whatsapp"];
  if (channel === "voice") return ["voice"];
  return ["app"];
}

function safeMessageResult(row: any) {
  return {
    id: row.id ?? null,
    organisation_id: row.organisation_id ?? null,
    project_id: row.project_id ?? null,
    participant_id: row.participant_id ?? null,
    title: row.title ?? row.message_title ?? null,
    body: row.body ?? row.message_body ?? null,
    channel: row.requested_channel ?? "app",
    status: row.status ?? null,
    message_code: row.message_code ?? null,
    created_at: row.created_at ?? null,
    scheduled_for: row.scheduled_for ?? row.available_at ?? null,
    metadata: row.metadata ?? {},
  };
}

async function ensureProjectBelongsToOrganisation(params: {
  organisationId: string;
  projectId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id")
    .eq("id", params.projectId)
    .eq("organisation_id", params.organisationId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return Boolean(data?.id);
}

async function getParticipant(params: {
  organisationId: string;
  projectId: string;
  participantId?: string | null;
  participantCode?: string | null;
}) {
  let query = supabaseAdmin
    .from("participants")
    .select("id, organisation_id, project_id, participant_code, phone_number, status, archived_at")
    .eq("organisation_id", params.organisationId)
    .eq("project_id", params.projectId)
    .is("archived_at", null)
    .limit(1);

  if (params.participantId) {
    query = query.eq("id", params.participantId);
  } else if (params.participantCode) {
    query = query.eq("participant_code", params.participantCode);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);

  return data;
}

async function createAppMessage(params: {
  organisationId: string;
  projectId: string;
  participantId: string;
  title: string;
  body: string;
  messageCode: string | null;
  category: string;
  priority: string;
  availableAt: string;
  metadata: Record<string, unknown>;
}) {
  const { data, error } = await supabaseAdmin
    .from("app_messages")
    .insert({
      organisation_id: params.organisationId,
      project_id: params.projectId,
      participant_id: params.participantId,
      sender_type: "api_client",
      sender_display_name: "ComConnect API",
      sender_role: "external_api",
      title: params.title,
      body: params.body || null,
      category: params.category || "general",
      priority: params.priority,
      media: {},
      action_links: [],
      status: "published",
      available_at: params.availableAt,
      message_code: params.messageCode,
      source_type: "external_api",
      source_id: null,
      metadata: params.metadata,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

async function createPushQueue(params: {
  organisationId: string;
  projectId: string;
  participantId: string;
  title: string;
  body: string;
  scheduledFor: string;
  metadata: Record<string, unknown>;
}) {
  const { data, error } = await supabaseAdmin
    .from("push_notification_queue")
    .insert({
      organisation_id: params.organisationId,
      project_id: params.projectId,
      participant_id: params.participantId,
      title: params.title || "ComConnect",
      body: params.body,
      data: params.metadata,
      status: "pending",
      scheduled_for: params.scheduledFor,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

async function createCommunicationSchedule(params: {
  organisationId: string;
  projectId: string;
  participantId: string;
  participantCode: string | null;
  requestedChannel: string;
  messageCode: string | null;
  title: string;
  body: string;
  priority: string;
  scheduledFor: string;
  respectQuietTime: boolean;
  timezone: string;
  metadata: Record<string, unknown>;
}) {
  const { data, error } = await supabaseAdmin
    .from("communication_schedules")
    .insert({
      organisation_id: params.organisationId,
      project_id: params.projectId,
      participant_id: params.participantId,
      participant_code: params.participantCode,

      message_code: params.messageCode,
      message_title: params.title,
      message_body: params.body,

      source_type: "manual_message",
      source_id: null,
      source_label: "External API",

      delivery_mode: scheduleDeliveryModeForChannel(params.requestedChannel),
      allowed_channels: scheduleAllowedChannelsForChannel(params.requestedChannel),
      requested_channel: params.requestedChannel,
      resolved_channel: null,
      provider: null,

      priority: params.priority,
      scheduled_for: params.scheduledFor,
      respect_quiet_time: params.respectQuietTime,
      timezone: params.timezone,

      status: "pending",
      attempt_count: 0,
      max_attempts: 1,

      metadata: params.metadata,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  const auth = await authenticateExternalApiKey({
    req,
    requiredScope: "messages:write",
  });

  if (auth.ok === false) {
    return fail(auth.error, auth.status);
  }

  try {
    const body = await req.json().catch(() => null);

    const requestedProjectId = cleanText(body?.project_id);
    const projectId = auth.projectId || requestedProjectId;

    const participantId = cleanText(body?.participant_id);
    const participantCode = cleanText(body?.participant_code);

    const requestedChannel = normaliseChannel(body?.requested_channel);
    const sendNow = boolValue(body?.send_now, true);

    const messageCode = cleanText(body?.message_code) || null;
    const title = cleanText(body?.message_title) || cleanText(body?.title);
    const messageBody = cleanText(body?.message_body) || cleanText(body?.body);

    const category = cleanText(body?.category) || "general";
    const priority = normalisePriority(body?.priority);
    const timezone = cleanText(body?.timezone) || "Africa/Johannesburg";
    const respectQuietTime = boolValue(body?.respect_quiet_time, true);

    const scheduledForText = cleanText(body?.scheduled_for);
    const scheduledFor = scheduledForText
      ? new Date(scheduledForText)
      : sendNow
        ? new Date()
        : null;

    const metadata =
      body?.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? body.metadata
        : {};

    if (!projectId) {
      return fail("project_id is required.", 400);
    }

    if (!participantId && !participantCode) {
      return fail("participant_id or participant_code is required.", 400);
    }

    if (!requestedChannel) {
      return fail("requested_channel must be app, push, sms, voice or whatsapp.", 400);
    }

    if (!title && !messageBody && !messageCode) {
      return fail("message_title, message_body or message_code is required.", 400);
    }

    if (!scheduledFor || Number.isNaN(scheduledFor.getTime())) {
      return fail("scheduled_for must be a valid date/time or send_now must be true.", 400);
    }

    const projectAllowed = await ensureProjectBelongsToOrganisation({
      organisationId: auth.organisationId,
      projectId,
    });

    if (!projectAllowed) {
      return fail("Project not found for this organisation.", 403);
    }

    const participant = await getParticipant({
      organisationId: auth.organisationId,
      projectId,
      participantId: participantId || null,
      participantCode: participantCode || null,
    });

    if (!participant?.id) {
      return fail("Participant not found for this project.", 404);
    }

    const baseMetadata = {
      ...metadata,
      created_from: "external_api_messages_send",
      api_key_id: auth.apiKey.id,
      api_key_prefix: auth.apiKey.key_prefix,
      requested_channel: requestedChannel,
      send_now: sendNow,
      paid_or_controlled_channel: PAID_OR_CONTROLLED_CHANNELS.has(requestedChannel),
      participant_lookup: participantId ? "participant_id" : "participant_code",
    };

    let result: any = null;
    let processingMode = "";

    if (requestedChannel === "app") {
      result = await createAppMessage({
        organisationId: auth.organisationId,
        projectId,
        participantId: participant.id,
        title: title || "ComConnect message",
        body: messageBody || "",
        messageCode,
        category,
        priority,
        availableAt: scheduledFor.toISOString(),
        metadata: baseMetadata,
      });

      processingMode = "app_message_published";
    } else if (requestedChannel === "push") {
      result = await createPushQueue({
        organisationId: auth.organisationId,
        projectId,
        participantId: participant.id,
        title: title || "ComConnect",
        body: messageBody || title || "You have a ComConnect update.",
        scheduledFor: scheduledFor.toISOString(),
        metadata: baseMetadata,
      });

      processingMode = "queued_for_push";
    } else {
      result = await createCommunicationSchedule({
        organisationId: auth.organisationId,
        projectId,
        participantId: participant.id,
        participantCode: participant.participant_code ?? participantCode ?? null,
        requestedChannel,
        messageCode,
        title: title || "ComConnect message",
        body: messageBody || "",
        priority,
        scheduledFor: scheduledFor.toISOString(),
        respectQuietTime,
        timezone,
        metadata: baseMetadata,
      });

      processingMode = "queued_for_paid_channel";
    }

    await logApiUsage({
      organisationId: auth.organisationId,
      projectId,
      apiKeyId: auth.apiKey.id,
      endpoint: "/api/external/messages/send",
      method: "POST",
      statusCode: 201,
      durationMs: Date.now() - startedAt,
      requestSource: "external_api",
      channel: apiUsageChannel(requestedChannel),
      paidChannel: PAID_OR_CONTROLLED_CHANNELS.has(requestedChannel),
      metadata: {
        action: "external_message_send",
        result: "accepted",
        processing_mode: processingMode,
        key_prefix: auth.apiKey.key_prefix,
        project_id: projectId,
        participant_id: participant.id,
        participant_code: participant.participant_code ?? participantCode ?? null,
        requested_channel: requestedChannel,
        send_now: sendNow,
        record_id: result.id,
      },
    });

    return ok(
      {
        status: "accepted",
        requested_channel: requestedChannel,
        processing_mode: processingMode,
        record: safeMessageResult({
          ...result,
          requested_channel: requestedChannel,
        }),
        message:
          requestedChannel === "app"
            ? "App message published for participant app access."
            : requestedChannel === "push"
              ? "Push notification queued for controlled processing."
              : "Message accepted as a due communication schedule. Existing ComConnect sender will process it.",
      },
      201
    );
  } catch (error: any) {
    await logApiUsage({
      organisationId: auth.organisationId,
      projectId: auth.projectId,
      apiKeyId: auth.apiKey.id,
      endpoint: "/api/external/messages/send",
      method: "POST",
      statusCode: 500,
      durationMs: Date.now() - startedAt,
      requestSource: "external_api",
      paidChannel: false,
      errorMessage: error?.message ?? "Failed to accept external message.",
      metadata: {
        action: "external_message_send",
        result: "exception",
        key_prefix: auth.apiKey.key_prefix,
      },
    });

    return fail(error?.message ?? "Failed to accept external message.", 500);
  }
}