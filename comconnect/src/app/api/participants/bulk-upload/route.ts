import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";

type ParticipantRow = {
  project_code?: string;
  participant_code?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  whatsapp_number?: string;
  email?: string;
  preferred_language?: string;
  preferred_channel?: string;
  fallback_allowed?: boolean | string;
  app_access_enabled?: boolean | string;
  quiet_time_enabled?: boolean | string;
  quiet_time_start?: string;
  quiet_time_end?: string;
  status?: string;
};

function boolValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;

  const text = String(value ?? "").trim().toLowerCase();

  if (["true", "yes", "1", "y"].includes(text)) return true;
  if (["false", "no", "0", "n"].includes(text)) return false;

  return fallback;
}

function splitName(displayName?: string) {
  const parts = String(displayName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    first_name: parts[0] ?? null,
    last_name: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const rows: ParticipantRow[] = Array.isArray(body?.participants)
    ? body.participants
    : [];

  if (rows.length === 0) {
    return fail("participants array is required");
  }

  if (rows.length > 5000) {
    return fail(
      "Upload too large. Please upload 5,000 participants or fewer per batch.",
      400
    );
  }

  const cleanedRows = rows
    .map((row) => ({
      ...row,
      project_code: String(row.project_code ?? body?.project_code ?? "").trim(),
      participant_code: String(row.participant_code ?? "").trim(),
    }))
    .filter((row) => row.project_code && row.participant_code);

  if (cleanedRows.length === 0) {
    return fail(
      "No valid rows found. project_code and participant_code are required."
    );
  }

  const projectCodes = Array.from(
    new Set(cleanedRows.map((row) => row.project_code))
  );

  const { data: projects, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id, organisation_id, project_code")
    .in("project_code", projectCodes);

  if (projectError) {
    return fail(projectError.message, 500);
  }

  const projectMap = new Map(
    (projects ?? []).map((project) => [project.project_code, project])
  );

  const missingProjects = projectCodes.filter((code) => !projectMap.has(code));

  if (missingProjects.length > 0) {
    return fail(
      `Project code(s) not found: ${missingProjects.join(", ")}`,
      400
    );
  }

  const byProject = new Map<string, string[]>();

  for (const row of cleanedRows) {
    const project = projectMap.get(row.project_code);
    if (!project) continue;

    const existingCodes = byProject.get(project.id) ?? [];
    existingCodes.push(row.participant_code);
    byProject.set(project.id, existingCodes);
  }

  const existingKeys = new Set<string>();

  for (const [projectId, participantCodes] of byProject.entries()) {
    const uniqueCodes = Array.from(new Set(participantCodes));

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("participants")
      .select("project_id, participant_code")
      .eq("project_id", projectId)
      .in("participant_code", uniqueCodes);

    if (existingError) {
      return fail(existingError.message, 500);
    }

    for (const participant of existing ?? []) {
      existingKeys.add(`${participant.project_id}:${participant.participant_code}`);
    }
  }

  const seenUploadKeys = new Set<string>();
  const duplicateCodes: string[] = [];
  const uploadDuplicateCodes: string[] = [];

  const payload = [];

  for (const row of cleanedRows) {
    const project = projectMap.get(row.project_code)!;
    const key = `${project.id}:${row.participant_code}`;

    if (seenUploadKeys.has(key)) {
      uploadDuplicateCodes.push(row.participant_code);
      continue;
    }

    seenUploadKeys.add(key);

    if (existingKeys.has(key)) {
      duplicateCodes.push(row.participant_code);
      continue;
    }

    const nameParts = splitName(row.display_name);

    payload.push({
      organisation_id: project.organisation_id,
      project_id: project.id,
      participant_code: row.participant_code,
      phone_number: row.phone_number || null,
      first_name: row.first_name || nameParts.first_name,
      last_name: row.last_name || nameParts.last_name,
      preferred_language: row.preferred_language || "en",
      status: row.status || "active",
      app_access_enabled: boolValue(row.app_access_enabled, true),
      metadata: {
        display_name: row.display_name || null,
        email: row.email || null,
        whatsapp_number: row.whatsapp_number || null,
        preferred_channel: row.preferred_channel || "app",
        fallback_allowed: boolValue(row.fallback_allowed, true),
        quiet_time_enabled: boolValue(row.quiet_time_enabled, true),
        quiet_time_start: row.quiet_time_start || "20:00",
        quiet_time_end: row.quiet_time_end || "07:00",
        timezone: body?.timezone || "Africa/Johannesburg",
        source: "participants_bulk_upload",
      },
    });
  }

  let insertedCount = 0;

  for (const batch of chunk(payload, 500)) {
    const { data, error } = await supabaseAdmin
      .from("participants")
      .insert(batch)
      .select("id");

    if (error) {
      return fail(error.message, 500);
    }

    insertedCount += data?.length ?? 0;
  }

  const firstProject = projectMap.get(cleanedRows[0].project_code);

  if (firstProject) {
    await createAuditLog({
      organisation_id: firstProject.organisation_id,
      project_id: firstProject.id,
      actor_type: "dashboard_user",
      action: "participants.bulk_uploaded",
      entity_type: "participants",
      entity_id: null,
      metadata: {
        uploaded_count: insertedCount,
        attempted_count: rows.length,
        valid_count: cleanedRows.length,
        skipped_existing_count: duplicateCodes.length,
        skipped_upload_duplicate_count: uploadDuplicateCodes.length,
      },
    });
  }

  return ok({
    attempted_count: rows.length,
    valid_count: cleanedRows.length,
    inserted_count: insertedCount,
    skipped_existing_count: duplicateCodes.length,
    skipped_upload_duplicate_count: uploadDuplicateCodes.length,
    skipped_existing_codes: duplicateCodes,
    skipped_upload_duplicate_codes: uploadDuplicateCodes,
  });
}