import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { authenticateExternalApiKey } from "@/lib/external-api/authenticate-api-key";
import { logApiUsage } from "@/lib/api-usage/log-api-usage";

export const runtime = "nodejs";

const ALLOWED_CHANNELS = new Set(["app", "push", "sms", "voice", "whatsapp"]);
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

function normaliseAllowedChannels(value: unknown) {
  if (!Array.isArray(value)) return ["app", "sms", "voice"];

  const channels = value
    .map((item) => cleanText(item).toLowerCase())
    .filter((item) => ALLOWED_CHANNELS.has(item));

  return channels.length > 0 ? Array.from(new Set(channels)) : ["app", "sms", "voice"];
}

function safeSchedule(row: any) {
  return {
    id: row.id ?? null,
    organisation_id: row.organisation_id ?? null,
    project_id: row.project_id ?? null,
    participant_id: row.participant_id ?? null,
    participant_code: row.participant_code ?? null,

    message_code: row.message_code ?? null,
    message_title: row.message_title ?? null,
    message_body: row.message_body ?? null,

    source_type: row.source_type ?? null,
    source_label: row.source_label ?? null,

    delivery_mode: row.delivery_mode ?? null,
    allowed_channels: row.allowed_channels ?? [],
    requested_channel: row.requested_channel ?? null,
    resolved_channel: row.resolved_channel ?? null,

    priority: row.priority ?? null,
    scheduled_for: row.scheduled_for ?? null,
    respect_quiet_time: row.respect_quiet_time ?? null,
    timezone: row.timezone ?? null,

    status: row.status ?? null,
    attempt_count: row.attempt_count ?? null,
    max_attempts: row.max_attempts ?? null,

    metadata: row.metadata ?? {},
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
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

  if (error) {
    throw new Error(error.message);
  }

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

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  const auth = await authenticateExternalApiKey({
    req,
    requiredScope: "schedules:write",
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

    const messageCode = cleanText(body?.message_code);
    const messageTitle = cleanText(body?.message_title);
    const messageBody = cleanText(body?.message_body);

    const requestedChannel = cleanText(body?.requested_channel).toLowerCase();
    const deliveryMode =
      cleanText(body?.delivery_mode) || "participant_preference";

    const allowedChannels = normaliseAllowedChannels(body?.allowed_channels);

    const priorityValue = cleanText(body?.priority).toLowerCase() || "normal";
    const priority = ALLOWED_PRIORITIES.has(priorityValue)
      ? priorityValue
      : "normal";

    const scheduledForText = cleanText(body?.scheduled_for);
    const scheduledFor = scheduledForText ? new Date(scheduledForText) : null;

    const respectQuietTime = boolValue(body?.respect_quiet_time, true);
    const timezone = cleanText(body?.timezone) || "Africa/Johannesburg";

    const metadata =
      body?.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? body.metadata
        : {};

    if (!projectId) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId: auth.projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/schedules",
        method: "POST",
        statusCode: 400,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        paidChannel: false,
        errorMessage: "project_id is required.",
        metadata: {
          action: "external_create_schedule",
          result: "validation_failed",
          reason: "missing_project_id",
          key_prefix: auth.apiKey.key_prefix,
        },
      });

      return fail("project_id is required.", 400);
    }

    if (!participantId && !participantCode) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/schedules",
        method: "POST",
        statusCode: 400,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        paidChannel: false,
        errorMessage: "participant_id or participant_code is required.",
        metadata: {
          action: "external_create_schedule",
          result: "validation_failed",
          reason: "missing_participant",
          key_prefix: auth.apiKey.key_prefix,
          project_id: projectId,
        },
      });

      return fail("participant_id or participant_code is required.", 400);
    }

    if (!messageTitle && !messageBody && !messageCode) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/schedules",
        method: "POST",
        statusCode: 400,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        paidChannel: false,
        errorMessage: "message_title, message_body or message_code is required.",
        metadata: {
          action: "external_create_schedule",
          result: "validation_failed",
          reason: "missing_message",
          key_prefix: auth.apiKey.key_prefix,
          project_id: projectId,
        },
      });

      return fail("message_title, message_body or message_code is required.", 400);
    }

    if (!scheduledFor || Number.isNaN(scheduledFor.getTime())) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/schedules",
        method: "POST",
        statusCode: 400,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        paidChannel: false,
        errorMessage: "scheduled_for must be a valid date/time.",
        metadata: {
          action: "external_create_schedule",
          result: "validation_failed",
          reason: "invalid_scheduled_for",
          key_prefix: auth.apiKey.key_prefix,
          project_id: projectId,
        },
      });

      return fail("scheduled_for must be a valid date/time.", 400);
    }

    if (requestedChannel && !ALLOWED_CHANNELS.has(requestedChannel)) {
      return fail("requested_channel must be app, push, sms, voice or whatsapp.", 400);
    }

    const projectAllowed = await ensureProjectBelongsToOrganisation({
      organisationId: auth.organisationId,
      projectId,
    });

    if (!projectAllowed) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/schedules",
        method: "POST",
        statusCode: 403,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        paidChannel: false,
        errorMessage: "Project not found for this organisation.",
        metadata: {
          action: "external_create_schedule",
          result: "project_denied",
          key_prefix: auth.apiKey.key_prefix,
          project_id: projectId,
        },
      });

      return fail("Project not found for this organisation.", 403);
    }

    const participant = await getParticipant({
      organisationId: auth.organisationId,
      projectId,
      participantId: participantId || null,
      participantCode: participantCode || null,
    });

    if (!participant?.id) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/schedules",
        method: "POST",
        statusCode: 404,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        paidChannel: false,
        errorMessage: "Participant not found for this project.",
        metadata: {
          action: "external_create_schedule",
          result: "participant_not_found",
          key_prefix: auth.apiKey.key_prefix,
          project_id: projectId,
          participant_id: participantId || null,
          participant_code: participantCode || null,
        },
      });

      return fail("Participant not found for this project.", 404);
    }

    const { data, error } = await supabaseAdmin
      .from("communication_schedules")
      .insert({
        organisation_id: auth.organisationId,
        project_id: projectId,
        participant_id: participant.id,
        participant_code: (participant.participant_code ?? participantCode) || null,

        message_code: messageCode || null,
        message_title: messageTitle || "External API message",
        message_body: messageBody || null,

        source_type: "manual_message",
        source_id: null,
        source_label: "External API",

        delivery_mode: deliveryMode,
        allowed_channels: allowedChannels,
        requested_channel: requestedChannel || null,
        resolved_channel: null,
        provider: null,

        priority,
        scheduled_for: scheduledFor.toISOString(),
        respect_quiet_time: respectQuietTime,
        timezone,

        status: "pending",
        attempt_count: 0,
        max_attempts: 1,

        metadata: {
          ...metadata,
          created_from: "external_api",
          api_key_id: auth.apiKey.id,
          api_key_prefix: auth.apiKey.key_prefix,
          participant_lookup: participantId ? "participant_id" : "participant_code",
        },
      })
      .select("*")
      .single();

    if (error) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/schedules",
        method: "POST",
        statusCode: 500,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        paidChannel: false,
        errorMessage: error.message,
        metadata: {
          action: "external_create_schedule",
          result: "failed",
          key_prefix: auth.apiKey.key_prefix,
          project_id: projectId,
          participant_id: participant.id,
          participant_code: participant.participant_code ?? participantCode ?? null,
        },
      });

      return fail(error.message, 500);
    }

    await logApiUsage({
      organisationId: auth.organisationId,
      projectId,
      apiKeyId: auth.apiKey.id,
      endpoint: "/api/external/schedules",
      method: "POST",
      statusCode: 201,
      durationMs: Date.now() - startedAt,
      requestSource: "external_api",
      paidChannel: false,
      metadata: {
        action: "external_create_schedule",
        result: "success",
        key_prefix: auth.apiKey.key_prefix,
        project_id: projectId,
        schedule_id: data.id,
        participant_id: participant.id,
        participant_code: participant.participant_code ?? participantCode ?? null,
        requested_channel: requestedChannel || null,
        scheduled_for: scheduledFor.toISOString(),
      },
    });

    return ok(
      {
        schedule: safeSchedule(data),
        message:
          "Schedule created using external API key scope. It has not been sent yet; existing ComConnect scheduler will process it when due.",
      },
      201
    );
  } catch (error: any) {
    await logApiUsage({
      organisationId: auth.organisationId,
      projectId: auth.projectId,
      apiKeyId: auth.apiKey.id,
      endpoint: "/api/external/schedules",
      method: "POST",
      statusCode: 500,
      durationMs: Date.now() - startedAt,
      requestSource: "external_api",
      paidChannel: false,
      errorMessage: error?.message ?? "Failed to create external schedule.",
      metadata: {
        action: "external_create_schedule",
        result: "exception",
        key_prefix: auth.apiKey.key_prefix,
      },
    });

    return fail(error?.message ?? "Failed to create external schedule.", 500);
  }
}