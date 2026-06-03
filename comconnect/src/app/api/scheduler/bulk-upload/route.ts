import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";

type BulkRow = {
  project_code?: string;
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

function boolValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;

  const text = String(value ?? "").trim().toLowerCase();

  if (["true", "yes", "1", "y"].includes(text)) return true;
  if (["false", "no", "0", "n"].includes(text)) return false;

  return fallback;
}

function normaliseChannel(value: unknown) {
  const text = String(value ?? "").trim().toLowerCase();

  if (text === "push" || text === "app_push") return "app";
  if (["app", "sms", "voice"].includes(text)) return text;

  return null;
}

function isAppOnlySource(sourceType: string) {
  return ["questionnaire", "education", "education_video"].includes(sourceType);
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function providerForChannel(channel: string) {
  if (channel === "app") return "expo";
  if (channel === "sms") return "africastalking";
  if (channel === "voice") return "africastalking";
  return "disabled";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const rows: BulkRow[] = Array.isArray(body?.schedules)
    ? body.schedules
    : [];

  if (rows.length === 0) {
    return fail("schedules array is required");
  }

  if (rows.length > 5000) {
    return fail("Upload too large. Please upload 5,000 schedules or fewer per batch.", 400);
  }

  const cleanedRows = rows
    .map((row) => ({
      ...row,
      project_code: String(row.project_code ?? body?.project_code ?? "").trim(),
      participant_code: String(row.participant_code ?? "").trim(),
      scheduled_for: String(row.scheduled_for ?? row.schedule_at ?? "").trim(),
      source_type: String(row.source_type ?? "bulk_message").trim(),
    }))
    .filter((row) => row.project_code && row.participant_code && row.scheduled_for);

  if (cleanedRows.length === 0) {
    return fail("No valid rows found. project_code, participant_code and scheduled_for are required.");
  }

  const projectCodes = Array.from(new Set(cleanedRows.map((row) => row.project_code)));

  const { data: projects, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id, organisation_id, project_code")
    .in("project_code", projectCodes);

  if (projectError) return fail(projectError.message, 500);

  const projectMap = new Map((projects ?? []).map((project) => [project.project_code, project]));
  const missingProjects = projectCodes.filter((code) => !projectMap.has(code));

  if (missingProjects.length > 0) {
    return fail(`Project code(s) not found: ${missingProjects.join(", ")}`, 400);
  }

  const byProject = new Map<string, string[]>();

  for (const row of cleanedRows) {
    const project = projectMap.get(row.project_code);
    if (!project) continue;

    const codes = byProject.get(project.id) ?? [];
    codes.push(row.participant_code);
    byProject.set(project.id, codes);
  }

  const participantMap = new Map<string, any>();

  for (const [projectId, participantCodes] of byProject.entries()) {
    const { data: participants, error } = await supabaseAdmin
      .from("participants")
      .select("*")
      .eq("project_id", projectId)
      .in("participant_code", Array.from(new Set(participantCodes)));

    if (error) return fail(error.message, 500);

    for (const participant of participants ?? []) {
      participantMap.set(`${participant.project_id}:${participant.participant_code}`, participant);
    }
  }

  const payload = [];
  const skippedMissingParticipants: string[] = [];

  for (const row of cleanedRows) {
    const project = projectMap.get(row.project_code)!;
    const participant = participantMap.get(`${project.id}:${row.participant_code}`);

    if (!participant) {
      skippedMissingParticipants.push(row.participant_code);
      continue;
    }

    const sourceType = row.source_type || "bulk_message";
    const appOnly = isAppOnlySource(sourceType);
    const requestedChannel = normaliseChannel(row.channel);
    const preferredChannel = normaliseChannel(participant.metadata?.preferred_channel);

    const resolvedChannel = appOnly
      ? "app"
      : requestedChannel ?? preferredChannel ?? "app";

    payload.push({
      organisation_id: participant.organisation_id,
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
      allowed_channels: appOnly ? ["app"] : ["app", "sms", "voice"],

      requested_channel: requestedChannel,
      resolved_channel: resolvedChannel,
      provider: providerForChannel(resolvedChannel),

      priority: row.priority || "normal",
      scheduled_for: new Date(row.scheduled_for).toISOString(),
      respect_quiet_time: boolValue(row.respect_quiet_time, true),

      quiet_time_start: participant.metadata?.quiet_time_start ?? "20:00",
      quiet_time_end: participant.metadata?.quiet_time_end ?? "07:00",
      timezone: participant.metadata?.timezone ?? "Africa/Johannesburg",

      status: "pending",
      max_attempts: 1,

      metadata: {
        uploaded_from: "scheduler_bulk_upload",
        participant_preferred_channel: participant.metadata?.preferred_channel ?? "app",
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

  const firstProject = projectMap.get(cleanedRows[0].project_code);

  if (firstProject) {
    await createAuditLog({
      organisation_id: firstProject.organisation_id,
      project_id: firstProject.id,
      actor_type: "dashboard_user",
      action: "communication_schedules.bulk_uploaded",
      entity_type: "communication_schedule",
      entity_id: null,
      metadata: {
        attempted_count: rows.length,
        valid_count: cleanedRows.length,
        inserted_count: insertedCount,
        skipped_missing_participants: skippedMissingParticipants.length,
      },
    });
  }

  return ok({
    attempted_count: rows.length,
    valid_count: cleanedRows.length,
    inserted_count: insertedCount,
    skipped_missing_participants_count: skippedMissingParticipants.length,
    skipped_missing_participants: skippedMissingParticipants,
  });
}