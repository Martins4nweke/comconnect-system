import { NextRequest } from "next/server";
import { fail } from "@/lib/comconnect-core/api-response";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ScopedContext = {
  user_email: string | null;
  user_id: string | null;

  organisation_id: string;
  organisation_name: string;
  organisation_role: string;

  active_project_id: string | null;
  active_project_name: string | null;
  project_role: string | null;

  allowed_project_ids: string[];
  allowed_projects: any[];

  can_manage_organisation: boolean;
  can_manage_projects: boolean;
  can_create_projects: boolean;
  can_archive_projects: boolean;
  can_export_data: boolean;
  can_manage_api: boolean;
  can_view_audit: boolean;

  dev_fallback: boolean;
};

const ORGANISATION_ADMIN_ROLES = new Set([
  "superadmin",
  "organisation_admin",
  "org_admin",
  "admin",
]);

const PROJECT_MANAGER_ROLES = new Set([
  "project_manager",
  "data_manager",
  "developer",
]);

const EXPORT_ROLES = new Set([
  "superadmin",
  "organisation_admin",
  "org_admin",
  "admin",
  "project_manager",
  "data_manager",
]);

const API_MANAGER_ROLES = new Set([
  "superadmin",
  "organisation_admin",
  "org_admin",
  "admin",
  "developer_admin",
  "developer",
]);

const AUDIT_ROLES = new Set([
  "superadmin",
  "organisation_admin",
  "org_admin",
  "admin",
  "auditor",
  "data_manager",
]);

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function pickName(row: any) {
  return (
    row?.name ??
    row?.organisation_name ??
    row?.display_name ??
    row?.full_name ??
    row?.email ??
    "Unnamed"
  );
}

export function isOrganisationAdmin(role?: string | null) {
  return ORGANISATION_ADMIN_ROLES.has(cleanText(role).toLowerCase());
}

export function isProjectManager(role?: string | null) {
  return PROJECT_MANAGER_ROLES.has(cleanText(role).toLowerCase());
}

export function canExport(role?: string | null) {
  return EXPORT_ROLES.has(cleanText(role).toLowerCase());
}

export function canManageApi(role?: string | null) {
  return API_MANAGER_ROLES.has(cleanText(role).toLowerCase());
}

export function canViewAudit(role?: string | null) {
  return AUDIT_ROLES.has(cleanText(role).toLowerCase());
}

function projectPayload(project: any, role: string) {
  return {
    id: project.id,
    organisation_id: project.organisation_id,
    name: project.name,
    project_code: project.project_code,
    description: project.description,
    status: project.status,
    default_language: project.default_language,
    app_access_enabled: project.app_access_enabled,
    settings: project.settings ?? {},
    role,
  };
}

async function getOrganisationById(organisationId: string) {
  const { data, error } = await supabaseAdmin
    .from("organisations")
    .select("*")
    .eq("id", organisationId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data;
}

async function getFirstOrganisation() {
  const { data, error } = await supabaseAdmin
    .from("organisations")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data;
}

async function getOrganisationMembershipByEmail(email: string) {
  const { data, error } = await supabaseAdmin
    .from("organisation_members")
    .select("*")
    .eq("email", email)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data;
}

async function getAllOrganisationProjects(params: {
  organisationId: string;
  role: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("organisation_id", params.organisationId)
    .neq("status", "archived")
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) throw new Error(error.message);

  return (data ?? []).map((project: any) =>
    projectPayload(project, params.role)
  );
}

async function getProjectMemberProjects(params: {
  organisationId: string;
  email?: string | null;
  userId?: string | null;
}) {
  let query = supabaseAdmin
    .from("project_members")
    .select("*, projects(*)")
    .eq("organisation_id", params.organisationId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(500);

  if (params.email) {
    query = query.eq("email", params.email);
  } else if (params.userId) {
    query = query.eq("user_id", params.userId);
  } else {
    return [];
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row: any) => row.projects && row.projects.status !== "archived")
    .map((row: any) => projectPayload(row.projects, row.role ?? "viewer"));
}

export async function getScopedContext(req: NextRequest): Promise<ScopedContext> {
  const url = new URL(req.url);

  const requestedOrganisationId = cleanText(
    url.searchParams.get("organisation_id")
  );
  const requestedProjectId = cleanText(url.searchParams.get("project_id"));
  const requestedEmail = cleanText(url.searchParams.get("email"));

  const headerEmail = cleanText(req.headers.get("x-comconnect-user-email"));
  const headerUserId = cleanText(req.headers.get("x-comconnect-user-id"));

  const email = requestedEmail || headerEmail || null;
  const userId = headerUserId || null;

  let organisation: any = null;
  let organisationRole = "organisation_admin";
  let devFallback = false;

  if (requestedOrganisationId) {
    organisation = await getOrganisationById(requestedOrganisationId);
  }

  if (!organisation && email) {
    const membership = await getOrganisationMembershipByEmail(email);

    if (membership?.organisation_id) {
      organisation = await getOrganisationById(membership.organisation_id);
      organisationRole = membership.role ?? "viewer";
    }
  }

  /*
    Development fallback:
    Keep this while building locally.
    Before launch, replace this with a 401 response when no user session exists.
  */
  if (!organisation) {
    organisation = await getFirstOrganisation();
    organisationRole = "organisation_admin";
    devFallback = true;
  }

  if (!organisation?.id) {
    throw new Error("No organisation found for this user.");
  }

  const allowedProjects =
    isOrganisationAdmin(organisationRole) || devFallback
      ? await getAllOrganisationProjects({
          organisationId: organisation.id,
          role: organisationRole,
        })
      : await getProjectMemberProjects({
          organisationId: organisation.id,
          email,
          userId,
        });

  const activeProject =
    allowedProjects.find((project: any) => project.id === requestedProjectId) ??
    allowedProjects[0] ??
    null;

  const projectRole =
    activeProject?.role ??
    (isOrganisationAdmin(organisationRole) ? "project_manager" : "viewer");

  const organisationAdmin = isOrganisationAdmin(organisationRole);
  const projectManager = isProjectManager(projectRole);

  return {
    user_email: email,
    user_id: userId,

    organisation_id: organisation.id,
    organisation_name: pickName(organisation),
    organisation_role: organisationRole,

    active_project_id: activeProject?.id ?? null,
    active_project_name: activeProject?.name ?? null,
    project_role: projectRole,

    allowed_project_ids: allowedProjects.map((project: any) => project.id),
    allowed_projects: allowedProjects,

    can_manage_organisation: organisationAdmin,
    can_manage_projects: organisationAdmin || projectManager,
    can_create_projects: organisationAdmin,
    can_archive_projects: organisationAdmin,
    can_export_data: organisationAdmin || canExport(projectRole),
    can_manage_api: organisationAdmin || canManageApi(projectRole),
    can_view_audit: organisationAdmin || canViewAudit(projectRole),

    dev_fallback: devFallback,
  };
}

export function applyOrganisationScope(query: any, context: ScopedContext) {
  return query.eq("organisation_id", context.organisation_id);
}

export function applyProjectScope(query: any, context: ScopedContext) {
  if (!context.active_project_id) {
    return query.eq("project_id", "__no_project_selected__");
  }

  return query
    .eq("organisation_id", context.organisation_id)
    .eq("project_id", context.active_project_id);
}

export function applyAllowedProjectsScope(query: any, context: ScopedContext) {
  query = query.eq("organisation_id", context.organisation_id);

  if (context.allowed_project_ids.length === 0) {
    return query.eq("project_id", "__no_allowed_projects__");
  }

  return query.in("project_id", context.allowed_project_ids);
}

export function applyProjectScopeOptional(query: any, context: ScopedContext) {
  query = query.eq("organisation_id", context.organisation_id);

  if (context.active_project_id) {
    query = query.eq("project_id", context.active_project_id);
  }

  return query;
}

export function assertCanManageOrganisation(context: ScopedContext) {
  if (!context.can_manage_organisation) {
    return fail("You do not have permission to manage this organisation.", 403);
  }

  return null;
}

export function assertCanManageProject(context: ScopedContext) {
  if (!context.can_manage_projects) {
    return fail("You do not have permission to manage this project.", 403);
  }

  return null;
}

export function assertCanExportData(context: ScopedContext) {
  if (!context.can_export_data) {
    return fail("You do not have permission to export project data.", 403);
  }

  return null;
}

export function assertCanManageApi(context: ScopedContext) {
  if (!context.can_manage_api) {
    return fail("You do not have permission to manage API settings.", 403);
  }

  return null;
}

export function assertCanViewAudit(context: ScopedContext) {
  if (!context.can_view_audit) {
    return fail("You do not have permission to view audit logs.", 403);
  }

  return null;
}

export function assertProjectSelected(context: ScopedContext) {
  if (!context.active_project_id) {
    return fail("No active project selected.", 400);
  }

  return null;
}