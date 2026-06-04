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

type BulkRow = {
  project_code?: string;
  project_id?: string;
  participant_code?: string;
  message_code?: string;
  message_title?: string;
  message_body?: string;
  channel?: string;
  scheduled_for?: string;
  schedule_at?: string;
  priority?: string;
  respect_quiet_time?: boolean | string;
  source_type?: string;
};

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

function normaliseChannel(value: unknown): Channel | null {
  const text = cleanText(value).toLowerCase();

  if (text === "push" || text === "app_push") return "app";
  if (text === "app") return "app";
  if (text === "sms") return "sms";
  if (text === "voice") return "voice";
  if (text === "whatsapp") return "whatsapp";

  return null;
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

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function canUploadSchedules(
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
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

function defaultProjectCode(
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  const activeProject = context.allowed_projects.find(
    (project: any) => project.id === context.active_project_id
  );

  return cleanText(activeProject?.project_code);
}

export async function POST(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    if (!canUploadSchedules(context)) {
      return fail("You do not have permission to upload schedules.", 403);
    }

    const body = await req.json().catch(() => null);

    const rows: BulkRow[] = Array.isArray(body?.schedules)
      ? body.schedules
      : [];

    if (rows.length === 0) {
      return fail("schedules array is required", 400);
    }

    if (rows.length > 5000) {
      return fail(
        "Upload too large. Please upload 5,000 schedules or fewer per batch.",
        400
      );
    }

    const fallbackProjectId =
      cleanText(body?.project_id) || cleanText(context.active_project_id);

    const fallbackProjectCode =
      cleanText(body?.project_code) || defaultProjectCode(context);

    const cleanedRows = rows
      .map((row) => ({
        ...row,
        project_id: cleanText(row.project_id) || fallbackProjectId,
        project_code: cleanText(row.project_code) || fallbackProjectCode,
        participant_code: cleanText(row.participant_code),
        message_code: cleanText(row.message_code),
        message_title: cleanText(row.message_title),
        message_body: cleanText(row.message_body),
        scheduled_for: cleanText(row.scheduled_for ?? row.schedule_at),
        source_type: cleanText(row.source_type) || "bulk_message",
      }))
      .filter(
        (row) =>
          (row.project_id || row.project_code) &&
          row.participant_code &&
          row.scheduled_for
      );

    if (cleanedRows.length === 0) {
      return fail(
        "No valid rows found. project, participant_code and scheduled_for are required.",
        400
      );
    }

    const allowedProjects = context.allowed_projects ?? [];

    const projectById = new Map(
      allowedProjects.map((project: any) => [project.id, project])
    );

    const projectByCode = new Map(
      allowedProjects.map((project: any) => [project.project_code, project])
    );

    const missingProjects = cleanedRows
      .filter((row) => {
        if (row.project_id && projectById.has(row.project_id)) return false;
        if (row.project_code && projectByCode.has(row.project_code)) return false;
        return true;
      })
      .map((row) => row.project_code || row.project_id || "unknown");

    if (missingProjects.length > 0) {
      return fail(
        `Project not found or not allowed: ${Array.from(
          new Set(missingProjects)
        ).join(", ")}`,
        403
      );
    }

    const byProject = new Map<string, string[]>();

    for (const row of cleanedRows) {
      const project =
        (row.project_id ? projectById.get(row.project_id) : null) ??
        (row.project_code ? projectByCode.get(row.project_code) : null);

      if (!project) continue;

      const codes = byProject.get(project.id) ?? [];
      codes.push(row.participant_code);
      byProject.set(project.id, codes);
    }

    const participantMap = new Map<string, any>();

    for (const [projectId, participantCodes] of byProject.entries()) {
      const uniqueCodes = Array.from(new Set(participantCodes));

      const { data: participants, error } = await supabaseAdmin
        .from("participants")
        .select("*")
        .eq("organisation_id", context.organisation_id)
        .eq("project_id", projectId)
        .in("participant_code", uniqueCodes);

      if (error) return fail(error.message, 500);

      for (const participant of participants ?? []) {
        participantMap.set(
          `${participant.project_id}:${participant.participant_code}`,
          participant
        );
      }
    }

    const payload = [];
    const skippedMissingParticipants: string[] = [];
    const skippedInvalidDates: string[] = [];

    for (const row of cleanedRows) {
      const project =
        (row.project_id ? projectById.get(row.project_id) : null) ??
        (row.project_code ? projectByCode.get(row.project_code) : null);

      if (!project) continue;

      const participant = participantMap.get(
        `${project.id}:${row.participant_code}`
      );

      if (!participant) {
        skippedMissingParticipants.push(row.participant_code);
        continue;
      }

      const scheduledDate = new Date(row.scheduled_for);

      if (Number.isNaN(scheduledDate.getTime())) {
        skippedInvalidDates.push(row.participant_code);
        continue;
      }

      const sourceType = row.source_type || "bulk_message";
      const appOnly = isAppOnlySource(sourceType);
      const requestedChannel = normaliseChannel(row.channel);
      const preferredChannel = normaliseChannel(
        participant.metadata?.preferred_channel
      );

      const resolvedChannel: Channel = appOnly
        ? "app"
        : requestedChannel ?? preferredChannel ?? "app";

      payload.push({
        organisation_id: context.organisation_id,
        project_id: participant.project_id,
        participant_id: participant.id,
        participant_code: participant.participant_code,

        message_code: row.message_code || null,
        message_title: row.message_title || "ComConnect message",
        message_body:
          row.message_body ||
          "You have a ComConnect update. Please open the app.",

        source_type: sourceType,
        delivery_mode: appOnly ? "app_only" : "participant_preference",
        allowed_channels: appOnly ? ["app"] : ["app", "sms", "voice", "whatsapp"],

        requested_channel: requestedChannel,
        resolved_channel: resolvedChannel,
        provider: providerForChannel(resolvedChannel),

        priority: row.priority || "normal",
        scheduled_for: scheduledDate.toISOString(),
        respect_quiet_time: boolValue(row.respect_quiet_time, true),

        quiet_time_start: participant.metadata?.quiet_time_start ?? "20:00",
        quiet_time_end: participant.metadata?.quiet_time_end ?? "07:00",
        timezone: participant.metadata?.timezone ?? "Africa/Johannesburg",

        status: "pending",
        max_attempts: 1,

        metadata: {
          uploaded_from: "scheduler_bulk_upload",
          participant_preferred_channel:
            participant.metadata?.preferred_channel ?? "app",
          app_only_protected: appOnly,
        },
      });
    }

    let insertedCount = 0;

    for (const batch of chunk(payload, 500)) {
      const { data, error } = await supabaseAdmin
        .from("communication_schedules")
        .insert(batch)
        .select("id");

      if (error) return fail(error.message, 500);

      insertedCount += data?.length ?? 0;
    }

    await createAuditLog({
      organisation_id: context.organisation_id,
      project_id: context.active_project_id,
      actor_type: "dashboard_user",
      action: "communication_schedules.bulk_uploaded",
      entity_type: "communication_schedule",
      entity_id: null,
      metadata: {
        attempted_count: rows.length,
        valid_count: cleanedRows.length,
        inserted_count: insertedCount,
        skipped_missing_participants_count: skippedMissingParticipants.length,
        skipped_invalid_dates_count: skippedInvalidDates.length,
      },
    });

    return ok({
      attempted_count: rows.length,
      valid_count: cleanedRows.length,
      inserted_count: insertedCount,
      skipped_missing_participants_count: skippedMissingParticipants.length,
      skipped_invalid_dates_count: skippedInvalidDates.length,
      skipped_missing_participants: skippedMissingParticipants,
      skipped_invalid_dates: skippedInvalidDates,
    });
  } catch (error: any) {
    return fail(error?.message ?? "Bulk schedule upload failed", 500);
  }
}