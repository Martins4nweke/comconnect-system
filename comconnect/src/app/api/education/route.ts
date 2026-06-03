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
    .from("education_items")
    .select("*, education_versions(*)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.project_id) return fail("project_id is required");

  try {
    await ensureModuleEnabled(body.project_id, "education");
    const project = await getProjectOrganisation(body.project_id);

    const payload = {
      organisation_id: project.organisation_id,
      project_id: project.id,
      title: requireString(body.title, "title"),
      description: body.description ?? null,
      category: body.category ?? null,
      language: body.language ?? "en",
      status: body.status ?? "draft",
      text_content: body.text_content ?? null,
      settings: body.settings ?? {},
      metadata: body.metadata ?? {},
      published_at: body.status === "published" ? new Date().toISOString() : null,
    };

    const { data, error } = await supabaseAdmin
      .from("education_items")
      .insert(payload)
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    await createAuditLog({
      organisation_id: project.organisation_id,
      project_id: project.id,
      actor_type: "dashboard_user",
      action: "education_item.created",
      entity_type: "education_item",
      entity_id: data.id,
      metadata: { title: data.title },
    });

    return ok(data, 201);
  } catch (error: any) {
    return fail(error.message ?? "Failed to create education item", 400);
  }
}
