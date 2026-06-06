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

function canManageConsent(context: Awaited<ReturnType<typeof getScopedContext>>) {
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

async function resolveProjectByCode(
  context: Awaited<ReturnType<typeof getScopedContext>>,
  projectCode?: string | null
) {
  const code = cleanText(projectCode);

  if (!code) return null;

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id, organisation_id, project_code, status")
    .eq("organisation_id", context.organisation_id)
    .eq("project_code", code)
    .neq("status", "archived")
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!project) {
    throw new Error("Project code not found or not allowed.");
  }

  if (
    project.id !== context.active_project_id &&
    !context.allowed_project_ids.includes(project.id)
  ) {
    throw new Error("Project code not found or not allowed.");
  }

  return project;
}

async function resolveProject(
  context: Awaited<ReturnType<typeof getScopedContext>>,
  bodyOrParams: any
) {
  const projectCode = cleanText(bodyOrParams?.project_code);

  if (projectCode) {
    const project = await resolveProjectByCode(context, projectCode);

    if (project) {
      return {
        id: project.id,
        organisation_id: project.organisation_id,
        project_code: project.project_code,
      };
    }
  }

  const projectId = resolveProjectId(context, bodyOrParams?.project_id);

  return {
    id: projectId,
    organisation_id: context.organisation_id,
    project_code:
      context.allowed_projects?.find((project: any) => project.id === projectId)
        ?.project_code ?? null,
  };
}

function applyConsentScope(
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
    const requestedProjectCode = req.nextUrl.searchParams.get("project_code");

    const project = requestedProjectCode
      ? await resolveProjectByCode(context, requestedProjectCode)
      : null;

    const projectId =
      project?.id ??
      (requestedProjectId
        ? resolveProjectId(context, requestedProjectId)
        : context.active_project_id || null);

    let query = supabaseAdmin
      .from("consent_forms")
      .select("*, consent_versions(*)")
      .order("created_at", { ascending: false });

    query = applyConsentScope(query, context, projectId);

    const { data, error } = await query;

    if (error) return fail(error.message, 500);

    return ok(data ?? []);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load consent forms", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    if (!canManageConsent(context)) {
      return fail("You do not have permission to create consent forms.", 403);
    }

    const body = await req.json().catch(() => null);
    const project = await resolveProject(context, body);

    await ensureModuleEnabled(project.id, "consent");

    const { data, error } = await supabaseAdmin
      .from("consent_forms")
      .insert({
        organisation_id: context.organisation_id,
        project_id: project.id,
        title: requireString(body?.title, "title"),
        description: body?.description ?? null,
        language: body?.language ?? "en",
        status: body?.status ?? "draft",
        settings: {
          ...(body?.settings ?? {}),
          created_from: body?.created_from ?? "consent_forms_api",
          project_code: project.project_code ?? body?.project_code ?? null,
        },
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    await createAuditLog({
      organisation_id: context.organisation_id,
      project_id: project.id,
      actor_type: "dashboard_user",
      action: "consent_form.created",
      entity_type: "consent_form",
      entity_id: data.id,
      metadata: {
        title: data.title,
        project_code: project.project_code ?? body?.project_code ?? null,
      },
    });

    return ok(data, 201);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to create consent form", 400);
  }
}