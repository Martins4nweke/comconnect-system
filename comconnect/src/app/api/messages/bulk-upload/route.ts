import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";

type MessageRow = {
  project_code?: string;
  message_code?: string;
  message_title?: string;
  title?: string;
  message_body?: string;
  body?: string;
  channel?: string;
  language?: string;
  category?: string;
  delivery_mode?: string;
  allowed_channels?: string;
  media_type?: string;
  media_url?: string;
  audio_url?: string;
  video_url?: string;
  status?: string;
  source_type?: string;
};

function normaliseChannel(value: unknown) {
  const text = String(value ?? "app").trim().toLowerCase();

  if (text === "push" || text === "app_push") return "app";
  if (["app", "sms", "whatsapp", "voice"].includes(text)) return text;

  return "app";
}

function allowedChannels(value: unknown, appOnly: boolean) {
  if (appOnly) return ["app"];

  const text = String(value ?? "").trim();

  if (!text) return ["app", "sms", "voice"];

  const channels = text
    .split(/[|,;]/)
    .map((item) => normaliseChannel(item))
    .filter(Boolean);

  return channels.length > 0 ? channels : ["app", "sms", "voice"];
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
  const rows: MessageRow[] = Array.isArray(body?.messages) ? body.messages : [];

  if (rows.length === 0) {
    return fail("messages array is required");
  }

  if (rows.length > 5000) {
    return fail("Upload too large. Please upload 5,000 messages or fewer per batch.", 400);
  }

  const cleanedRows = rows
    .map((row) => ({
      ...row,
      project_code: String(row.project_code ?? body?.project_code ?? "").trim(),
      message_code: String(row.message_code ?? "").trim(),
      message_title: String(row.message_title ?? row.title ?? "").trim(),
      message_body: String(row.message_body ?? row.body ?? "").trim(),
    }))
    .filter(
      (row) =>
        row.project_code &&
        row.message_code &&
        row.message_title &&
        row.message_body
    );

  if (cleanedRows.length === 0) {
    return fail(
      "No valid rows found. project_code, message_code, message_title and message_body are required."
    );
  }

  const projectCodes = Array.from(
    new Set(cleanedRows.map((row) => row.project_code))
  );

  const { data: projects, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id, organisation_id, project_code")
    .in("project_code", projectCodes);

  if (projectError) return fail(projectError.message, 500);

  const projectMap = new Map(
    (projects ?? []).map((project) => [project.project_code, project])
  );

  const missingProjects = projectCodes.filter((code) => !projectMap.has(code));

  if (missingProjects.length > 0) {
    return fail(`Project code(s) not found: ${missingProjects.join(", ")}`, 400);
  }

  const payload = cleanedRows.map((row) => {
    const project = projectMap.get(row.project_code)!;
    const sourceType = row.source_type || "manual_message";
    const appOnly = ["questionnaire", "education", "education_video"].includes(
      sourceType
    );

    return {
      organisation_id: project.organisation_id,
      project_id: project.id,

      message_code: row.message_code,
      message_title: row.message_title,
      message_body: row.message_body,

      channel: appOnly ? "app" : normaliseChannel(row.channel),
      language: row.language || "en",
      category: row.category || null,
      delivery_mode: appOnly
        ? "app_only"
        : row.delivery_mode || "participant_preference",
      allowed_channels: allowedChannels(row.allowed_channels, appOnly),

      media_type: row.media_type || "text",
      media_url: row.media_url || null,
      audio_url: row.audio_url || null,
      video_url: row.video_url || null,

      status: row.status || "ready",
      metadata: {
        uploaded_from: "messages_bulk_upload",
        source_type: sourceType,
      },
    };
  });

  let insertedCount = 0;
  let skippedDuplicateCount = 0;

  for (const batch of chunk(payload, 500)) {
    const { data, error } = await supabaseAdmin
      .from("communication_messages")
      .upsert(batch, {
        onConflict: "project_id,message_code",
        ignoreDuplicates: false,
      })
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
      action: "communication_messages.bulk_uploaded",
      entity_type: "communication_message",
      entity_id: null,
      metadata: {
        attempted_count: rows.length,
        valid_count: cleanedRows.length,
        inserted_or_updated_count: insertedCount,
        skipped_duplicate_count: skippedDuplicateCount,
      },
    });
  }

  return ok({
    attempted_count: rows.length,
    valid_count: cleanedRows.length,
    inserted_or_updated_count: insertedCount,
    skipped_duplicate_count: skippedDuplicateCount,
  });
}