import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

export const runtime = "nodejs";

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

async function getProjectsForUser(params: {
  organisationId: string;
  email?: string;
  userId?: string;
}) {
  let memberQuery = supabaseAdmin
    .from("project_members")
    .select("*, projects(*)")
    .eq("organisation_id", params.organisationId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (params.email) {
    memberQuery = memberQuery.eq("email", params.email);
  } else if (params.userId) {
    memberQuery = memberQuery.eq("user_id", params.userId);
  } else {
    memberQuery = memberQuery.limit(0);
  }

  const { data: memberProjects, error: memberError } = await memberQuery;

  if (memberError) throw new Error(memberError.message);

  const fromMembership = (memberProjects ?? [])
    .filter((row: any) => row.projects)
    .map((row: any) => ({
      id: row.projects.id,
      organisation_id: row.projects.organisation_id,
      name: row.projects.name,
      project_code: row.projects.project_code,
      description: row.projects.description,
      status: row.projects.status,
      default_language: row.projects.default_language,
      app_access_enabled: row.projects.app_access_enabled,
      role: row.role ?? "viewer",
    }));

  if (fromMembership.length > 0) {
    return fromMembership;
  }

  const { data: fallbackProjects, error: fallbackError } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("organisation_id", params.organisationId)
    .neq("status", "archived")
    .order("created_at", { ascending: true })
    .limit(100);

  if (fallbackError) throw new Error(fallbackError.message);

  return (fallbackProjects ?? []).map((project: any) => ({
    id: project.id,
    organisation_id: project.organisation_id,
    name: project.name,
    project_code: project.project_code,
    description: project.description,
    status: project.status,
    default_language: project.default_language,
    app_access_enabled: project.app_access_enabled,
    role: "project_manager",
  }));
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
    const email = requestedEmail || headerEmail;

    let organisation: any = null;
    let organisationRole = "organisation_admin";
    let devFallback = false;

    if (requestedOrganisationId) {
      organisation = await getOrganisationById(requestedOrganisationId);
    }

    if (!organisation && email) {
      const membership = await getMembershipByEmail(email);

      if (membership?.organisation_id) {
        organisation = await getOrganisationById(membership.organisation_id);
        organisationRole = membership.role ?? "organisation_admin";
      }
    }

    if (!organisation) {
      organisation = await getFirstOrganisation();
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
      email,
    });

    const activeProject =
      allowedProjects.find((project: any) => project.id === requestedProjectId) ??
      allowedProjects[0] ??
      null;

    return ok({
      user: {
        email: email || null,
      },
      organisation: {
        id: organisation.id,
        name: pickName(organisation),
      },
      active_project: activeProject
        ? {
            id: activeProject.id,
            name: activeProject.name,
            project_code: activeProject.project_code,
            status: activeProject.status,
            role: activeProject.role ?? "project_manager",
          }
        : null,
      organisation_id: organisation.id,
      organisation_name: pickName(organisation),
      organisation_role: organisationRole,
      active_project_id: activeProject?.id ?? null,
      active_project_name: activeProject?.name ?? "No active project",
      project_role: activeProject?.role ?? "project_manager",
      allowed_projects: allowedProjects,
      dev_fallback: devFallback,
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load current context", 500);
  }
}