import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { ok, fail } from "@/lib/comconnect-core/api-response";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;

  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*, organisations(name), project_modules(*), project_channel_settings(*)")
    .eq("id", projectId)
    .single();

  if (error || !data) return fail("Project not found", 404);
  return ok(data);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return fail("Request body is required");

  const allowed = [
    "name",
    "project_code",
    "description",
    "status",
    "default_language",
    "app_access_enabled",
    "settings",
  ];

  const payload: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) payload[key] = body[key];
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .update(payload)
    .eq("id", projectId)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: data.organisation_id,
    project_id: data.id,
    actor_type: "dashboard_user",
    action: "project.updated",
    entity_type: "project",
    entity_id: data.id,
    metadata: payload,
  });

  return ok(data);
}
