import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { seedProjectModules } from "@/lib/comconnect-core/project-modules";
import { ensureProjectChannelSettings } from "@/lib/comconnect-core/channel-settings";
import { ok, fail } from "@/lib/comconnect-core/api-response";

export async function GET(req: NextRequest) {
  const organisationId = req.nextUrl.searchParams.get("organisation_id");
  let query = supabaseAdmin.from("projects").select("*, organisations(name)").order("created_at", { ascending: false });
  if (organisationId) query = query.eq("organisation_id", organisationId);
  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.organisation_id) return fail("organisation_id is required");
  if (!body?.name) return fail("Project name is required");
  if (!body?.project_code) return fail("project_code is required");

  const payload = {
    organisation_id: body.organisation_id,
    name: String(body.name).trim(),
    project_code: String(body.project_code).trim(),
    description: body.description ?? null,
    status: body.status ?? "active",
    default_language: body.default_language ?? "en",
    app_access_enabled: body.app_access_enabled ?? true,
    settings: body.settings ?? {},
  };

  const { data, error } = await supabaseAdmin.from("projects").insert(payload).select("*").single();
  if (error) return fail(error.message, 500);

  await seedProjectModules(data.organisation_id, data.id);
  await ensureProjectChannelSettings(data.organisation_id, data.id);

  await createAuditLog({
    organisation_id: data.organisation_id,
    project_id: data.id,
    actor_type: "dashboard_user",
    action: "project.created",
    entity_type: "project",
    entity_id: data.id,
    metadata: { name: data.name, project_code: data.project_code },
  });

  return ok(data, 201);
}
