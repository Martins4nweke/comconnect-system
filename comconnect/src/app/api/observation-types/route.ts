import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { getProjectOrganisation, ensureModuleEnabled } from "@/lib/research-care/module-access";
import { requireString } from "@/lib/research-care/validation";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project_id");
  if (!projectId) return fail("project_id is required");

  const { data, error } = await supabaseAdmin
    .from("project_observation_types")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.project_id) return fail("project_id is required");

  try {
    await ensureModuleEnabled(body.project_id, "health_checkins");
    const project = await getProjectOrganisation(body.project_id);

    const { data, error } = await supabaseAdmin
      .from("project_observation_types")
      .insert({
        organisation_id: project.organisation_id,
        project_id: project.id,
        code: requireString(body.code, "code"),
        name: requireString(body.name, "name"),
        description: body.description ?? null,
        field_schema: body.field_schema ?? { fields: [] },
        validation_schema: body.validation_schema ?? {},
        status: body.status ?? "active",
        settings: body.settings ?? {},
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    await createAuditLog({
      organisation_id: project.organisation_id,
      project_id: project.id,
      actor_type: "dashboard_user",
      action: "observation_type.created",
      entity_type: "project_observation_type",
      entity_id: data.id,
      metadata: { code: data.code, name: data.name },
    });

    return ok(data, 201);
  } catch (error: any) {
    return fail(error.message ?? "Failed to create observation type", 400);
  }
}
