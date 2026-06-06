import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";
import {
  getLargeTableParams,
  getNextCursor,
} from "@/lib/large-table/pagination";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
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
    ["project_manager", "data_manager", "auditor"].includes(projectRole)
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

    const params = getLargeTableParams(req);
    const requestedProjectId = req.nextUrl.searchParams.get("project_id");

    const actorType = cleanText(req.nextUrl.searchParams.get("actor_type"));
    const entityType = cleanText(req.nextUrl.searchParams.get("entity_type"));
    const action = cleanText(req.nextUrl.searchParams.get("action"));

    const projectId = resolveAllowedProjectId(
      context,
      requestedProjectId || params.projectId || null
    );

    let query = supabaseAdmin
      .from("audit_logs")
      .select("*")
      .eq("organisation_id", context.organisation_id)
      .order("created_at", { ascending: false })
      .limit(params.limit);

    if (projectId) {
      query = query.eq("project_id", projectId);
    } else if (context.active_project_id) {
      query = query.eq("project_id", context.active_project_id);
    } else if (context.allowed_project_ids.length > 0) {
      query = query.in("project_id", context.allowed_project_ids);
    } else {
      query = query.eq("project_id", "__no_project_access__");
    }

    if (params.cursor) {
      query = query.lt("created_at", params.cursor);
    }

    if (actorType) query = query.eq("actor_type", actorType);
    if (entityType) query = query.eq("entity_type", entityType);
    if (action) query = query.eq("action", action);

    if (params.q) {
      const q = params.q.replaceAll(",", " ");
      query = query.or(
        `action.ilike.%${q}%,entity_type.ilike.%${q}%,actor_type.ilike.%${q}%,actor_label.ilike.%${q}%`
      );
    }

    const { data, error } = await query;

    if (error) return fail(error.message, 500);

    const rows = (data ?? []).map((row: any) => ({
      ...row,
      audit_label: row.action ?? "Audit event",
      actor_label: row.actor_label ?? row.actor_type ?? "—",
      entity_label:
        row.entity_type && row.entity_id
          ? `${row.entity_type}: ${row.entity_id}`
          : row.entity_type ?? "—",
    }));

    return ok({
      rows,
      limit: params.limit,
      next_cursor: getNextCursor(rows),
      scope: {
        organisation_id: context.organisation_id,
        project_id: context.active_project_id,
      },
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load audit logs", 500);
  }
}