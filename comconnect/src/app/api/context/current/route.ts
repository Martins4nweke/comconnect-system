import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ORGANISATION_ADMIN_ROLES = new Set([
  "platform_owner",
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

async function getActiveMembership(params: {
  userId?: string | null;
  email?: string | null;
}) {
  let query = supabaseAdmin
    .from("organisation_members")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);

  if (params.userId) {
    query = query.eq("user_id", params.userId);
  } else if (params.email) {
    query = query.eq("email", params.email);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);

  return data;
}

async function getPendingMembership(params: {
  userId?: string | null;
  email?: string | null;
}) {
  let query = supabaseAdmin
    .from("organisation_members")
    .select("*")
    .in("status", ["invited", "inactive"])
    .order("created_at", { ascending: true })
    .limit(1);

  if (params.userId) {
    query = query.eq("user_id", params.userId);
  } else if (params.email) {
    query = query.eq("email", params.email);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);

  return data;
}

async function getMembershipForUser(params: {
  userId?: string | null;
  email?: string | null;
}) {
  const byUserId = await getActiveMembership({
    userId: params.userId,
    email: null,
  });

  if (byUserId) return byUserId;

  const byEmail = await getActiveMembership({
    userId: null,
    email: params.email,
  });

  if (byEmail) return byEmail;

  return null;
}

async function getPendingMembershipForUser(params: {
  userId?: string | null;
  email?: string | null;
}) {
  const byUserId = await getPendingMembership({
    userId: params.userId,
    email: null,
  });

  if (byUserId) return byUserId;

  const byEmail = await getPendingMembership({
    userId: null,
    email: params.email,
  });

  if (byEmail) return byEmail;

  return null;
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

  if (params.userId) {
    query = query.eq("user_id", params.userId);
  } else if (params.email) {
    query = query.eq("email", params.email);
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
}) {
  if (isOrganisationAdmin(params.organisationRole)) {
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

    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return fail(userError.message, 401);
    }

    if (!user) {
      return fail("Not authenticated.", 401);
    }

    const email = cleanText(user.email).toLowerCase();
    const userId = user.id;

    const organisationMembership = await getMembershipForUser({
      userId,
      email,
    });

    /*
      Important:
      Do not fall back to Fledgelight or Demo Research for a real logged-in user.
      If the user has no active organisation membership, return onboarding state.
    */
    if (!organisationMembership) {
      const pendingMembership = await getPendingMembershipForUser({
        userId,
        email,
      });

      if (pendingMembership?.organisation_id) {
        const pendingOrganisation = await getOrganisationById(
          pendingMembership.organisation_id
        );

        return ok({
          user: {
            email,
            id: userId,
          },

          organisation: pendingOrganisation
            ? {
                id: pendingOrganisation.id,
                name: pickName(pendingOrganisation),
                role: pendingMembership.role ?? "viewer",
                status: pendingMembership.status,
              }
            : null,

          active_project: null,

          organisation_id: pendingOrganisation?.id ?? null,
          organisation_name: pendingOrganisation
            ? pickName(pendingOrganisation)
            : "Access pending",
          organisation_role: pendingMembership.role ?? "viewer",
          organisation_membership_status: pendingMembership.status,

          active_project_id: null,
          active_project_name: "No active project",
          active_project_code: null,
          project_role: "viewer",

          allowed_projects: [],
          can_manage_projects: false,
          can_create_projects: false,
          can_archive_projects: false,

          onboarding_required: false,
          access_pending: true,
          dev_fallback: false,
        });
      }

      return ok({
        user: {
          email,
          id: userId,
        },

        organisation: null,
        active_project: null,

        organisation_id: null,
        organisation_name: "No organisation",
        organisation_role: null,
        organisation_membership_status: null,

        active_project_id: null,
        active_project_name: "No active project",
        active_project_code: null,
        project_role: null,

        allowed_projects: [],
        can_manage_projects: false,
        can_create_projects: false,
        can_archive_projects: false,

        onboarding_required: true,
        access_pending: false,
        dev_fallback: false,
      });
    }

    let organisation = null;

    if (
      requestedOrganisationId &&
      requestedOrganisationId === organisationMembership.organisation_id
    ) {
      organisation = await getOrganisationById(requestedOrganisationId);
    }

    if (!organisation) {
      organisation = await getOrganisationById(
        organisationMembership.organisation_id
      );
    }

    if (!organisation?.id) {
      return fail("Organisation not found for this user.", 404);
    }

    const organisationRole = organisationMembership.role ?? "viewer";

    const allowedProjects = await getProjectsForUser({
      organisationId: organisation.id,
      organisationRole,
      email,
      userId,
    });

    const activeProject =
      allowedProjects.find(
        (project: any) => project.id === requestedProjectId
      ) ??
      allowedProjects[0] ??
      null;

    const projectRole =
      activeProject?.role ??
      (isOrganisationAdmin(organisationRole) ? "project_manager" : "viewer");

    const canManageProjects = isOrganisationAdmin(organisationRole);

    return ok({
      user: {
        email,
        id: userId,
      },

      organisation: {
        id: organisation.id,
        name: pickName(organisation),
        role: organisationRole,
        status: organisationMembership.status,
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
      organisation_membership_status: organisationMembership.status,

      active_project_id: activeProject?.id ?? null,
      active_project_name: activeProject?.name ?? "No active project",
      active_project_code: activeProject?.project_code ?? null,
      project_role: projectRole,

      allowed_projects: allowedProjects,
      can_manage_projects: canManageProjects,
      can_create_projects: canManageProjects,
      can_archive_projects: canManageProjects,

      onboarding_required: false,
      access_pending: false,
      dev_fallback: false,
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load current context", 500);
  }
}