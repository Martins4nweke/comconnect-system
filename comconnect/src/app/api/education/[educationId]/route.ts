import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";

type Params = { params: Promise<{ educationId: string }> };

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function canManageEducation(
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  const organisationRole = cleanText(context.organisation_role).toLowerCase();
  const projectRole = cleanText(context.project_role).toLowerCase();

  return (
    isOrganisationAdmin(organisationRole) ||
    isProjectManager(projectRole) ||
    [
      "project_manager",
      "research_assistant",
      "data_manager",
      "clinician",
      "nurse",
    ].includes(projectRole)
  );
}

function applyEducationScope(query: any, context: Awaited<ReturnType<typeof getScopedContext>>) {
  query = query.eq("organisation_id", context.organisation_id);

  if (context.active_project_id) {
    return query.eq("project_id", context.active_project_id);
  }

  if (context.allowed_project_ids.length > 0) {
    return query.in("project_id", context.allowed_project_ids);
  }

  return query.eq("project_id", "__no_project_access__");
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const context = await getScopedContext(req);
    const { educationId } = await params;

    let query = supabaseAdmin
      .from("education_items")
      .select("*, education_versions(*), education_assignments(*)")
      .eq("id", educationId);

    query = applyEducationScope(query, context);

    const { data, error } = await query.maybeSingle();

    if (error) return fail(error.message, 500);
    if (!data) return fail("Education item not found or not allowed.", 404);

    return ok(data);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load education item", 500);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const context = await getScopedContext(req);

    if (!canManageEducation(context)) {
      return fail("You do not have permission to update education items.", 403);
    }

    const { educationId } = await params;
    const body = await req.json().catch(() => null);

    let query = supabaseAdmin
      .from("education_items")
      .update({
        title: body?.title,
        description: body?.description,
        category: body?.category,
        language: body?.language,
        status: body?.status,
        text_content: body?.text_content,
        settings: body?.settings,
        metadata: body?.metadata,
        published_at:
          body?.status === "published"
            ? new Date().toISOString()
            : body?.published_at,
      })
      .eq("id", educationId);

    query = applyEducationScope(query, context);

    const { data, error } = await query.select("*").maybeSingle();

    if (error) return fail(error.message, 500);
    if (!data) return fail("Education item not found or not allowed.", 404);

    await createAuditLog({
      organisation_id: data.organisation_id,
      project_id: data.project_id,
      actor_type: "dashboard_user",
      action: "education_item.updated",
      entity_type: "education_item",
      entity_id: data.id,
      metadata: { title: data.title },
    });

    return ok(data);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to update education item", 500);
  }
}