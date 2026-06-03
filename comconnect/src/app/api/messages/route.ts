import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";

function normaliseChannel(value: unknown) {
  const text = String(value ?? "app").trim().toLowerCase();

  if (text === "push" || text === "app_push") return "app";
  if (["app", "sms", "whatsapp", "voice"].includes(text)) return text;

  return "app";
}

function normaliseAllowedChannels(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(normaliseChannel).filter(Boolean);
  }

  const text = String(value ?? "").trim();

  if (text) {
    const channels = text
      .split(/[|,;]/)
      .map((item) => normaliseChannel(item))
      .filter(Boolean);

    return channels.length > 0 ? channels : ["app", "sms", "voice"];
  }

  return ["app", "sms", "voice"];
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

  throw new Error("project_id or project_code is required");
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project_id");
  const projectCode = req.nextUrl.searchParams.get("project_code");
  const status = req.nextUrl.searchParams.get("status");
  const q = req.nextUrl.searchParams.get("q");

  let resolvedProjectId = projectId;

  if (!resolvedProjectId && projectCode) {
    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("project_code", projectCode)
      .single();

    if (error || !project) return fail("Project code not found", 404);

    resolvedProjectId = project.id;
  }

  let query = supabaseAdmin
    .from("communication_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (resolvedProjectId) query = query.eq("project_id", resolvedProjectId);
  if (status) query = query.eq("status", status);

  if (q) {
    query = query.or(
      `message_code.ilike.%${q}%,message_title.ilike.%${q}%,message_body.ilike.%${q}%,category.ilike.%${q}%`
    );
  }

  const { data, error } = await query;

  if (error) return fail(error.message, 500);

  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body?.message_code) return fail("message_code is required");
  if (!body?.message_title && !body?.title) return fail("message_title is required");
  if (!body?.message_body && !body?.body) return fail("message_body is required");

  try {
    const project = await resolveProject(body);

    const sourceType = String(body.source_type ?? "manual_message");
    const isAppOnly = ["questionnaire", "education", "education_video"].includes(
      sourceType
    );

    const payload = {
      organisation_id: project.organisation_id,
      project_id: project.id,

      message_code: String(body.message_code).trim(),
      message_title: String(body.message_title ?? body.title).trim(),
      message_body: String(body.message_body ?? body.body).trim(),

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