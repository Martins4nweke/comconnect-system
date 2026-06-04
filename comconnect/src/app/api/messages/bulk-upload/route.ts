import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";

type MessageRow = {
  project_code?: string;
  project_id?: string;
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

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseChannel(value: unknown) {
  const text = cleanText(value).toLowerCase();

  if (text === "push" || text === "app_push") return "app";
  if (["app", "sms", "whatsapp", "voice"].includes(text)) return text;

  return "app";
}

function allowedChannels(value: unknown, appOnly: boolean) {
  if (appOnly) return ["app"];

  const text = cleanText(value);

  if (!text) return ["app", "sms", "voice"];

  const channels = text
    .split(/[|,;]/)
    .map((item) => normaliseChannel(item))
    .filter(Boolean);

  return channels.length > 0
    ? Array.from(new Set(channels))
    : ["app", "sms", "voice"];
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function canWriteMessages(context: Awaited<ReturnType<typeof getScopedContext>>) {
  const organisationRole = cleanText(context.organisation_role).toLowerCase();
  const projectRole = cleanText(context.project_role).toLowerCase();

  return (
    isOrganisationAdmin(organisationRole) ||
    isProjectManager(projectRole) ||
    ["project_manager", "research_assistant", "data_manager", "developer"].includes(
      projectRole
    )
  );
}

function defaultProjectCode(context: Awaited<ReturnType<typeof getScopedContext>>) {
  const activeProject = context.allowed_projects.find(
    (project: any) => project.id === context.active_project_id
  );

  return cleanText(activeProject?.project_code);
}

export async function POST(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    if (!canWriteMessages(context)) {
      return fail("You do not have permission to upload messages.", 403);
    }

    const body = await req.json().catch(() => null);

    const rows: MessageRow[] = Array.isArray(body?.messages)
      ? body.messages
      : [];

    if (rows.length === 0) {
      return fail("messages array is required", 400);
    }

    if (rows.length > 5000) {
      return fail(
        "Upload too large. Please upload 5,000 messages or fewer per batch.",
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
        message_code: cleanText(row.message_code),
        message_title: cleanText(row.message_title ?? row.title),
        message_body: cleanText(row.message_body ?? row.body),
      }))
      .filter(
        (row) =>
          (row.project_id || row.project_code) &&
          row.message_code &&
          row.message_title &&
          row.message_body
      );

    if (cleanedRows.length === 0) {
      return fail(
        "No valid rows found. project, message_code, message_title and message_body are required.",
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

    const payload = cleanedRows.map((row) => {
      const project =
        (row.project_id ? projectById.get(row.project_id) : null) ??
        (row.project_code ? projectByCode.get(row.project_code) : null);

      const sourceType = row.source_type || "manual_message";
      const appOnly = ["questionnaire", "education", "education_video"].includes(
        sourceType
      );

      return {
        organisation_id: context.organisation_id,
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

    await createAuditLog({
      organisation_id: context.organisation_id,
      project_id: context.active_project_id,
      actor_type: "dashboard_user",
      action: "communication_messages.bulk_uploaded",
      entity_type: "communication_message",
      entity_id: null,
      metadata: {
        attempted_count: rows.length,
        valid_count: cleanedRows.length,
        inserted_or_updated_count: insertedCount,
      },
    });

    return ok({
      attempted_count: rows.length,
      valid_count: cleanedRows.length,
      inserted_or_updated_count: insertedCount,
      skipped_duplicate_count: 0,
    });
  } catch (error: any) {
    return fail(error?.message ?? "Bulk message upload failed", 500);
  }
}