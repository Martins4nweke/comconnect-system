import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { ensureProjectChannelSettings, normaliseFallbackOrder } from "@/lib/comconnect-core/channel-settings";
import { ok, fail } from "@/lib/comconnect-core/api-response";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project_id");
  if (!projectId) return fail("project_id is required");

  const { data: project, error: projectError } = await supabaseAdmin.from("projects").select("id, organisation_id").eq("id", projectId).single();
  if (projectError || !project) return fail("Project not found", 404);

  const settings = await ensureProjectChannelSettings(project.organisation_id, project.id);
  return ok(settings);
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.project_id) return fail("project_id is required");

  const { data: project, error: projectError } = await supabaseAdmin.from("projects").select("id, organisation_id").eq("id", body.project_id).single();
  if (projectError || !project) return fail("Project not found", 404);

  const payload = {
    organisation_id: project.organisation_id,
    project_id: project.id,
    primary_channel: body.primary_channel ?? "app",
    fallback_order: normaliseFallbackOrder(body.fallback_order),
    push_enabled: body.push_enabled ?? true,
    sms_enabled: body.sms_enabled ?? true,
    voice_enabled: body.voice_enabled ?? true,
    whatsapp_enabled: body.whatsapp_enabled ?? false,
    email_enabled: body.email_enabled ?? false,
    app_open_timeout_hours: body.app_open_timeout_hours ?? 24,
    urgent_sms_immediate: body.urgent_sms_immediate ?? true,
    urgent_voice_immediate: body.urgent_voice_immediate ?? true,
    settings: body.settings ?? {},
  };

  const { data, error } = await supabaseAdmin.from("project_channel_settings").upsert(payload, { onConflict: "project_id" }).select("*").single();
  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: project.organisation_id,
    project_id: project.id,
    actor_type: "dashboard_user",
    action: "project_channel_settings.updated",
    entity_type: "project",
    entity_id: project.id,
    metadata: payload,
  });

  return ok(data);
}
