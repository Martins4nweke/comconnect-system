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
    .from("consent_forms")
    .select("*, consent_versions(*)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.project_id) return fail("project_id is required");

  try {
    await ensureModuleEnabled(body.project_id, "consent");
    const project = await getProjectOrganisation(body.project_id);

    const { data, error } = await supabaseAdmin
      .from("consent_forms")
      .insert({
        organisation_id: project.organisation_id,
        project_id: project.id,
        title: requireString(body.title, "title"),
        description: body.description ?? null,
        language: body.language ?? "en",
        status: body.status ?? "draft",
        settings: body.settings ?? {},
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    await createAuditLog({
      organisation_id: project.organisation_id,
      project_id: project.id,
      actor_type: "dashboard_user",
      action: "consent_form.created",
      entity_type: "consent_form",
      entity_id: data.id,
      metadata: { title: data.title },
    });

    return ok(data, 201);
  } catch (error: any) {
    return fail(error.message ?? "Failed to create consent form", 400);
  }
}
