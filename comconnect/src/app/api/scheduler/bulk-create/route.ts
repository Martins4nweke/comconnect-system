import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";

type Channel = "app" | "sms" | "voice" | "whatsapp";

const MAX_BULK_SCHEDULES = 500;

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseChannel(value: unknown): Channel {
  const text = cleanText(value).toLowerCase();

  if (text === "push" || text === "app_push") return "app";
  if (text === "sms") return "sms";
  if (text === "voice") return "voice";
  if (text === "whatsapp") return "whatsapp";

  return "app";
}

function boolValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;

  const text = cleanText(value).toLowerCase();

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
    const channels = value.map((item) => normaliseChannel(item)).filter(Boolean);
    return channels.length > 0
      ? Array.from(new Set(channels))
      : ["app", "sms", "voice"];
  }

  const text = cleanText(value);

  if (text) {
    const channels = text
      .split(/[|,;]/)
      .map((item) => normaliseChannel(item))
      .filter(Boolean);

    return channels.length > 0
      ? Array.from(new Set(channels))
      : ["app", "sms", "voice"];
  }

  return ["app", "sms", "voice"];
}

function resolveDeliveryMode(sourceType: string, value: unknown) {
  if (isAppOnlySource(sourceType)) return "app_only";
  return cleanText(value) || "participant_preference";
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

function canBulkSchedule(context: Awaited<ReturnType<typeof getScopedContext>>) {
  const organisationRole = cleanText(context.organisation_role).toLowerCase();
  const projectRole = cleanText(context.project_role).toLowerCase();

  return (
    isOrganisationAdmin(organisationRole) ||
    isProjectManager(projectRole) ||
    [
      "project_manager",
      "research_assistant",
      "data_manager",
      "clinician",
      "nurse",
    ].includes(projectRole)
  );
}

async function loadParticipants(
  body: any,
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  const mode = cleanText(body?.mode) || "selected";

  const explicitParticipantIds: string[] = Array.isArray(body?.participant_ids)
    ? body.participant_ids
        .map((id: unknown) => cleanText(id))
        .filter(Boolean)
    : [];

  const activeProjectId = cleanText(context.active_project_id);

  let query = supabaseAdmin
    .from("participants")
    .select("*")
    .eq("organisation_id", context.organisation_id)
    .neq("status", "archived");

  if (activeProjectId) {
    query = query.eq("project_id", activeProjectId);
  } else if (context.allowed_project_ids.length > 0) {
    query = query.in("project_id", context.allowed_project_ids);
  } else {
    throw new Error("No accessible project found.");
  }

  if (mode === "selected") {
    if (explicitParticipantIds.length === 0) {
      throw new Error("participant_ids are required for selected mode");
    }

    if (explicitParticipantIds.length > MAX_BULK_SCHEDULES) {
      throw new Error(
        `You can schedule a maximum of ${MAX_BULK_SCHEDULES} selected participants at once.`
      );
    }

    query = query.in("id", explicitParticipantIds);
  } else if (mode === "all_active") {
    const requestedLimit = Number(body?.limit ?? MAX_BULK_SCHEDULES);
    const safeLimit = Math.min(
      Math.max(
        Number.isFinite(requestedLimit) ? requestedLimit : MAX_BULK_SCHEDULES,
        1
      ),
      MAX_BULK_SCHEDULES
    );

    query = query.order("created_at", { ascending: true }).limit(safeLimit);

    if (body?.status) {
      query = query.eq("status", cleanText(body.status));
    } else {
      query = query.eq("status", "active");
    }
  } else {
    throw new Error("Unsupported bulk schedule mode");
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return data ?? [];
}

async function loadMessage(
  body: any,
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  const messageCode = cleanText(body?.message_code);

  if (!messageCode) {
    throw new Error("message_code is required");
  }

  let query = supabaseAdmin
    .from("communication_messages")
    .select("*")
    .eq("organisation_id", context.organisation_id)
    .eq("message_code", messageCode)
    .neq("status", "archived");

  if (context.active_project_id) {
    query = query.eq("project_id", context.active_project_id);
  } else if (context.allowed_project_ids.length > 0) {
    query = query.in("project_id", context.allowed_project_ids);
  } else {
    throw new Error("No accessible project found.");
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    throw new Error("Message not found or not allowed for this project.");
  }

  return data;
}

export async function POST(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    if (!canBulkSchedule(context)) {
      return fail("You do not have permission to create bulk schedules.", 403);
    }

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

    const participants = await loadParticipants(body, context);

    if (participants.length === 0) {
      return fail("No matching participants found", 400);
    }

    if (participants.length > MAX_BULK_SCHEDULES) {
      return fail(
        `You can schedule a maximum of ${MAX_BULK_SCHEDULES} participants at once.`,
        400
      );
    }

    const message = await loadMessage(body, context);

    const sourceType = cleanText(body.source_type) || "manual_message";
    const deliveryMode = resolveDeliveryMode(
      sourceType,
      body.delivery_mode ?? message.delivery_mode
    );
    const allowedChannels = resolveAllowedChannels(
      sourceType,
      body.allowed_channels ?? message.allowed_channels
    );
    const requestedChannel = normaliseChannel(
      body.requested_channel ?? body.channel ?? message.channel
    );

    const rows = participants.map((participant) => {
      if (participant.project_id !== message.project_id) {
        throw new Error(
          `Participant ${participant.participant_code} is not in the selected message project.`
        );
      }

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
        organisation_id: context.organisation_id,
        project_id: participant.project_id,
        participant_id: participant.id,
        participant_code: participant.participant_code,

        message_code: message.message_code,
        message_title:
          body.message_title ?? body.title ?? message.message_title,
        message_body:
          body.message_body ??
          body.body ??
          message.message_body ??
          "You have a ComConnect update. Please open the app.",

        source_type: sourceType,
        source_id: body.source_id ?? message.id,
        source_label: body.source_label ?? message.message_title ?? null,

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

    await createAuditLog({
      organisation_id: context.organisation_id,
      project_id: context.active_project_id,
      actor_type: "dashboard_user",
      action: "communication_schedules.bulk_created",
      entity_type: "communication_schedule",
      entity_id: null,
      metadata: {
        mode: body.mode ?? "selected",
        attempted_count: participants.length,
        inserted_count: insertedCount,
        message_code: message.message_code,
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