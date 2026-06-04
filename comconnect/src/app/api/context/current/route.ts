import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

export const runtime = "nodejs";

const ORGANISATION_ADMIN_ROLES = new Set([
  "superadmin",
  "organisation_admin",
  "org_admin",
  "admin",
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

function isOrganisationAdmin(role?: string | null) {
  return ORGANISATION_ADMIN_ROLES.has(cleanText(role).toLowerCase());
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

async function getMembershipByEmail(email: string) {
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
  role?: string | null;
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
    projectPayload(project, params.role || "organisation_admin")
  );
}

async function getProjectMemberProjects(params: {
  organisationId: string;
  email?: string;
  userId?: string;
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

async function getProjectsForUser(params: {
  organisationId: string;
  organisationRole: string;
  email?: string;
  userId?: string;
  devFallback?: boolean;
}) {
  if (isOrganisationAdmin(params.organisationRole) || params.devFallback) {
    return getAllOrganisationProjects({
      organisationId: params.organisationId,
      role: params.organisationRole,
    });
  }

  return getProjectMemberProjects({
    organisationId: params.organisationId,
    email: params.email,
    userId: params.userId,
  });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const requestedOrganisationId = cleanText(
      url.searchParams.get("organisation_id")
    );
    const requestedProjectId = cleanText(url.searchParams.get("project_id"));
    const requestedEmail = cleanText(url.searchParams.get("email"));

    const headerEmail = cleanText(req.headers.get("x-comconnect-user-email"));
    const headerUserId = cleanText(req.headers.get("x-comconnect-user-id"));

    const email = requestedEmail || headerEmail;
    const userId = headerUserId || "";

    let organisation: any = null;
    let organisationRole = "organisation_admin";
    let organisationMembership: any = null;
    let devFallback = false;

    if (requestedOrganisationId) {
      organisation = await getOrganisationById(requestedOrganisationId);
    }

    if (!organisation && email) {
      organisationMembership = await getMembershipByEmail(email);

      if (organisationMembership?.organisation_id) {
        organisation = await getOrganisationById(
          organisationMembership.organisation_id
        );
        organisationRole = organisationMembership.role ?? "viewer";
      }
    }

    if (!organisation) {
      organisation = await getFirstOrganisation();
      organisationRole = "organisation_admin";
      devFallback = true;
    }

    if (!organisation?.id) {
      return fail(
        "No organisation found. Create an organisation before loading context.",
        404
      );
    }

    const allowedProjects = await getProjectsForUser({
      organisationId: organisation.id,
      organisationRole,
      email,
      userId,
      devFallback,
    });

    const activeProject =
      allowedProjects.find((project: any) => project.id === requestedProjectId) ??
      allowedProjects[0] ??
      null;

    const projectRole =
      activeProject?.role ??
      (isOrganisationAdmin(organisationRole) ? "project_manager" : "viewer");

    return ok({
      user: {
        email: email || null,
        id: userId || null,
      },
      organisation: {
        id: organisation.id,
        name: pickName(organisation),
        role: organisationRole,
      },
      active_project: activeProject
        ? {
            id: activeProject.id,
            name: activeProject.name,
            project_code: activeProject.project_code,
            status: activeProject.status,
            role: projectRole,
          }
        : null,

      organisation_id: organisation.id,
      organisation_name: pickName(organisation),
      organisation_role: organisationRole,

      active_project_id: activeProject?.id ?? null,
      active_project_name: activeProject?.name ?? "No active project",
      active_project_code: activeProject?.project_code ?? null,
      project_role: projectRole,

      allowed_projects: allowedProjects,
      can_manage_projects: isOrganisationAdmin(organisationRole),
      can_create_projects: isOrganisationAdmin(organisationRole),
      can_archive_projects: isOrganisationAdmin(organisationRole),

      dev_fallback: devFallback,
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load current context", 500);
  }
}