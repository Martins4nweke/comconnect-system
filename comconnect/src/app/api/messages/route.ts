import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseChannel(value: unknown) {
  const text = cleanText(value).toLowerCase();

  if (text === "push" || text === "app_push") return "app";
  if (["app", "sms", "whatsapp", "voice"].includes(text)) return text;

  return "app";
}

function normaliseAllowedChannels(value: unknown) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map(normaliseChannel).filter(Boolean)));
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

async function resolveProject(
  body: any,
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  const projectId = cleanText(body?.project_id) || cleanText(context.active_project_id);
  const projectCode = cleanText(body?.project_code);

  let query = supabaseAdmin
    .from("projects")
    .select("id, organisation_id, project_code")
    .eq("organisation_id", context.organisation_id)
    .neq("status", "archived");

  if (projectId) {
    query = query.eq("id", projectId);
  } else if (projectCode) {
    query = query.eq("project_code", projectCode);
  } else {
    throw new Error("No active project selected.");
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    throw new Error("Project not found or not allowed.");
  }

  if (!context.allowed_project_ids.includes(data.id)) {
    throw new Error("You do not have access to this project.");
  }

  return data;
}

async function resolveRequestedProjectId(
  req: NextRequest,
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  const projectId = cleanText(req.nextUrl.searchParams.get("project_id"));
  const projectCode = cleanText(req.nextUrl.searchParams.get("project_code"));

  if (projectId) {
    if (!context.allowed_project_ids.includes(projectId)) {
      throw new Error("You do not have access to this project.");
    }

    return projectId;
  }

  if (projectCode) {
    const project = context.allowed_projects.find(
      (item: any) => item.project_code === projectCode
    );

    if (!project?.id) {
      throw new Error("Project code not found or not allowed.");
    }

    return project.id;
  }

  return cleanText(context.active_project_id);
}

export async function GET(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    const status = req.nextUrl.searchParams.get("status");
    const q = req.nextUrl.searchParams.get("q");

    const resolvedProjectId = await resolveRequestedProjectId(req, context);

    let query = supabaseAdmin
      .from("communication_messages")
      .select("*")
      .eq("organisation_id", context.organisation_id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (resolvedProjectId) {
      query = query.eq("project_id", resolvedProjectId);
    } else if (context.allowed_project_ids.length > 0) {
      query = query.in("project_id", context.allowed_project_ids);
    } else {
      query = query.eq("project_id", "__no_project_access__");
    }

    if (status) query = query.eq("status", status);

    if (q) {
      query = query.or(
        `message_code.ilike.%${q}%,message_title.ilike.%${q}%,message_body.ilike.%${q}%,category.ilike.%${q}%`
      );
    }

    const { data, error } = await query;

    if (error) return fail(error.message, 500);

    return ok(data ?? []);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load messages", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    if (!canWriteMessages(context)) {
      return fail("You do not have permission to create messages.", 403);
    }

    const body = await req.json().catch(() => null);

    if (!body?.message_code) return fail("message_code is required", 400);
    if (!body?.message_title && !body?.title) {
      return fail("message_title is required", 400);
    }
    if (!body?.message_body && !body?.body) {
      return fail("message_body is required", 400);
    }

    const project = await resolveProject(body, context);

    const sourceType = cleanText(body.source_type) || "manual_message";
    const isAppOnly = ["questionnaire", "education", "education_video"].includes(
      sourceType
    );

    const payload = {
      organisation_id: context.organisation_id,
      project_id: project.id,

      message_code: cleanText(body.message_code),
      message_title: cleanText(body.message_title ?? body.title),
      message_body: cleanText(body.message_body ?? body.body),

      channel: isAppOnly ? "app" : normaliseChannel(body.channel),
      language: body.language ?? "en",
      category: body.category ?? null,
      delivery_mode: isAppOnly
        ? "app_only"
        : body.delivery_mode ?? "participant_preference",
      allowed_channels: isAppOnly
        ? ["app"]
        : normaliseAllowedChannels(body.allowed_channels),

      media_type: body.media_type ?? "text",
      media_url: body.media_url ?? null,
      audio_url: body.audio_url ?? null,
      video_url: body.video_url ?? null,

      status: body.status ?? "draft",
      metadata: {
        ...(body.metadata ?? {}),
        source_type: sourceType,
        created_from: "messages_api",
      },
    };

    const { data, error } = await supabaseAdmin
      .from("communication_messages")
      .insert(payload)
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    await createAuditLog({
      organisation_id: data.organisation_id,
      project_id: data.project_id,
      actor_type: "dashboard_user",
      action: "communication_message.created",
      entity_type: "communication_message",
      entity_id: data.id,
      metadata: {
        message_code: data.message_code,
        channel: data.channel,
        status: data.status,
      },
    });

    return ok(data, 201);
  } catch (error: any) {
    return fail(error.message ?? "Failed to create message", 400);
  }
}