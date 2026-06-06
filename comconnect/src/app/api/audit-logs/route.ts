import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function safeLimit(value: string | null) {
  const parsed = Number(value ?? 100);

  if (!Number.isFinite(parsed)) return 100;

  return Math.min(Math.max(parsed, 1), 500);
}

function canViewAuditLogs(context: Awaited<ReturnType<typeof getScopedContext>>) {
  const organisationRole = cleanText(context.organisation_role).toLowerCase();
  const projectRole = cleanText(context.project_role).toLowerCase();

  return (
    isOrganisationAdmin(organisationRole) ||
    isProjectManager(projectRole) ||
    [
      "superadmin",
      "organisation_admin",
      "org_admin",
      "admin",
      "auditor",
    ].includes(organisationRole) ||
    [
      "project_manager",
      "data_manager",
      "auditor",
    ].includes(projectRole)
  );
}

function resolveAllowedProjectId(
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

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    if (!canViewAuditLogs(context)) {
      return fail("You do not have permission to view audit logs.", 403);
    }

    const requestedProjectId = req.nextUrl.searchParams.get("project_id");
    const actorType = cleanText(req.nextUrl.searchParams.get("actor_type"));
    const entityType = cleanText(req.nextUrl.searchParams.get("entity_type"));
    const action = cleanText(req.nextUrl.searchParams.get("action"));
    const limit = safeLimit(req.nextUrl.searchParams.get("limit"));

    const projectId = resolveAllowedProjectId(context, requestedProjectId);

    let query = supabaseAdmin
      .from("audit_logs")
      .select("*")
      .eq("organisation_id", context.organisation_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (projectId) {
      query = query.eq("project_id", projectId);
    } else if (context.active_project_id) {
      query = query.eq("project_id", context.active_project_id);
    } else if (context.allowed_project_ids.length > 0) {
      query = query.in("project_id", context.allowed_project_ids);
    } else {
      query = query.eq("project_id", "__no_project_access__");
    }

    if (actorType) query = query.eq("actor_type", actorType);
    if (entityType) query = query.eq("entity_type", entityType);
    if (action) query = query.eq("action", action);

    const { data, error } = await query;

    if (error) return fail(error.message, 500);

    return ok(data ?? []);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load audit logs", 500);
  }
}