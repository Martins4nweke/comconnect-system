import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function canManageFallbackRules(
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  const organisationRole = cleanText(context.organisation_role).toLowerCase();
  const projectRole = cleanText(context.project_role).toLowerCase();

  return (
    isOrganisationAdmin(organisationRole) ||
    isProjectManager(projectRole) ||
    ["project_manager", "data_manager"].includes(projectRole)
  );
}

export async function POST(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    if (!canManageFallbackRules(context)) {
      return fail("You do not have permission to update fallback rules.", 403);
    }

    const body = await req.json().catch(() => null);

    const ids: string[] = Array.isArray(body?.ids)
      ? body.ids.map((id: unknown) => cleanText(id)).filter(Boolean)
      : [];

    const action = cleanText(body?.action).toLowerCase();

    if (ids.length === 0) {
      return fail("ids array is required", 400);
    }

    if (ids.length > 1000) {
      return fail("Bulk action limit is 1000 records per request", 400);
    }

    let allowedQuery = supabaseAdmin
      .from("fallback_rules")
      .select("id")
      .eq("organisation_id", context.organisation_id)
      .in("id", ids);

    if (context.active_project_id) {
      allowedQuery = allowedQuery.eq("project_id", context.active_project_id);
    } else if (context.allowed_project_ids.length > 0) {
      allowedQuery = allowedQuery.in("project_id", context.allowed_project_ids);
    } else {
      return fail("No accessible project found.", 403);
    }

    const { data: allowedRows, error: allowedError } = await allowedQuery;

    if (allowedError) {
      return fail(allowedError.message, 500);
    }

    const allowedIds = (allowedRows ?? []).map((row: any) => row.id);

    if (allowedIds.length === 0) {
      return fail("No selected fallback rules are accessible.", 403);
    }

    if (action === "archive") {
      const { data, error } = await supabaseAdmin
        .from("fallback_rules")
        .update({
          status: "archived",
          enabled: false,
          archived_at: new Date().toISOString(),
        })
        .eq("organisation_id", context.organisation_id)
        .in("id", allowedIds)
        .select("id");

      if (error) return fail(error.message, 500);

      return ok({
        action,
        updated_count: data?.length ?? 0,
      });
    }

    if (action === "status") {
      const status = cleanText(body?.status).toLowerCase();

      if (!status) {
        return fail("status is required", 400);
      }

      const allowedStatuses = new Set(["active", "inactive", "archived"]);

      if (!allowedStatuses.has(status)) {
        return fail("Invalid fallback rule status.", 400);
      }

      const updatePayload: Record<string, any> = {
        status,
      };

      if (status === "active") {
        updatePayload.enabled = true;
      }

      if (status === "inactive" || status === "archived") {
        updatePayload.enabled = false;
      }

      if (status === "archived") {
        updatePayload.archived_at = new Date().toISOString();
      }

      const { data, error } = await supabaseAdmin
        .from("fallback_rules")
        .update(updatePayload)
        .eq("organisation_id", context.organisation_id)
        .in("id", allowedIds)
        .select("id");

      if (error) return fail(error.message, 500);

      return ok({
        action,
        status,
        updated_count: data?.length ?? 0,
      });
    }

    return fail("Unsupported bulk action", 400);
  } catch (error: any) {
    return fail(error?.message ?? "Bulk fallback rule action failed", 500);
  }
}