import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";
import { ensureModuleEnabled } from "@/lib/research-care/module-access";
import { requireString } from "@/lib/research-care/validation";

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

function resolveProjectId(
  context: Awaited<ReturnType<typeof getScopedContext>>,
  requestedProjectId?: string | null
) {
  const requested = cleanText(requestedProjectId);

  if (requested) {
    if (
      requested === context.active_project_id ||
      context.allowed_project_ids.includes(requested)
    ) {
      return requested;
    }

    throw new Error("Project not found or not allowed.");
  }

  if (context.active_project_id) {
    return context.active_project_id;
  }

  if (context.allowed_project_ids.length > 0) {
    return context.allowed_project_ids[0];
  }

  throw new Error("No accessible project found.");
}

function applyEducationScope(
  query: any,
  context: Awaited<ReturnType<typeof getScopedContext>>,
  projectId?: string | null
) {
  query = query.eq("organisation_id", context.organisation_id);

  if (projectId) {
    return query.eq("project_id", projectId);
  }

  if (context.active_project_id) {
    return query.eq("project_id", context.active_project_id);
  }

  if (context.allowed_project_ids.length > 0) {
    return query.in("project_id", context.allowed_project_ids);
  }

  return query.eq("project_id", "__no_project_access__");
}

export async function GET(req: NextRequest) {
  try {
    const context = await getScopedContext(req);
    const requestedProjectId = req.nextUrl.searchParams.get("project_id");

    const projectId = requestedProjectId
      ? resolveProjectId(context, requestedProjectId)
      : context.active_project_id || "";

    let query = supabaseAdmin
      .from("education_items")
      .select("*, education_versions(*)")
      .order("created_at", { ascending: false });

    query = applyEducationScope(query, context, projectId || null);

    const { data, error } = await query;

    if (error) return fail(error.message, 500);

    return ok(data ?? []);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load education items", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    if (!canManageEducation(context)) {
      return fail("You do not have permission to create education items.", 403);
    }

    const body = await req.json().catch(() => null);
    const projectId = resolveProjectId(context, body?.project_id);

    await ensureModuleEnabled(projectId, "education");

    const payload = {
      organisation_id: context.organisation_id,
      project_id: projectId,
      title: requireString(body?.title, "title"),
      description: body?.description ?? null,
      category: body?.category ?? null,
      language: body?.language ?? "en",
      status: body?.status ?? "draft",
      text_content: body?.text_content ?? null,
      settings: body?.settings ?? {},
      metadata: {
        ...(body?.metadata ?? {}),
        created_from: body?.metadata?.created_from ?? "education_api",
      },
      published_at:
        body?.status === "published" ? new Date().toISOString() : null,
    };

    const { data, error } = await supabaseAdmin
      .from("education_items")
      .insert(payload)
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    await createAuditLog({
      organisation_id: data.organisation_id,
      project_id: data.project_id,
      actor_type: "dashboard_user",
      action: "education_item.created",
      entity_type: "education_item",
      entity_id: data.id,
      metadata: { title: data.title },
    });

    return ok(data, 201);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to create education item", 400);
  }
}