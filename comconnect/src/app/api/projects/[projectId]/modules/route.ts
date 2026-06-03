import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { seedProjectModules } from "@/lib/comconnect-core/project-modules";
import { ok, fail } from "@/lib/comconnect-core/api-response";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id, organisation_id")
    .eq("id", projectId)
    .single();
  if (projectError || !project) return fail("Project not found", 404);

  await seedProjectModules(project.organisation_id, project.id);

  const { data, error } = await supabaseAdmin
    .from("project_modules")
    .select("*")
    .eq("project_id", projectId)
    .order("module_name");

  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.modules)) return fail("modules array is required");

  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id, organisation_id")
    .eq("id", projectId)
    .single();
  if (projectError || !project) return fail("Project not found", 404);

  const rows = body.modules.map((module: any) => ({
    id: module.id,
    organisation_id: project.organisation_id,
    project_id: project.id,
    module_code: module.module_code,
    module_name: module.module_name,
    enabled: Boolean(module.enabled),
    settings: module.settings ?? {},
  }));

  const { data, error } = await supabaseAdmin.from("project_modules").upsert(rows, { onConflict: "project_id,module_code" }).select("*");
  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: project.organisation_id,
    project_id: project.id,
    actor_type: "dashboard_user",
    action: "project_modules.updated",
    entity_type: "project",
    entity_id: project.id,
    metadata: { updated_count: rows.length },
  });

  return ok(data ?? []);
}
