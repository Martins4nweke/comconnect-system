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

function canManageParticipants(context: Awaited<ReturnType<typeof getScopedContext>>) {
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

export async function POST(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    if (!canManageParticipants(context)) {
      return fail("You do not have permission to update participants.", 403);
    }

    const body = await req.json().catch(() => null);

    const ids: string[] = Array.isArray(body?.ids)
      ? body.ids.map((id: unknown) => cleanText(id)).filter(Boolean)
      : [];

    const action = cleanText(body?.action).toLowerCase();

    if (ids.length === 0) {
      return fail("ids array is required", 400);
    }

    let query = supabaseAdmin
      .from("participants")
      .select("id")
      .eq("organisation_id", context.organisation_id)
      .in("id", ids);

    if (context.active_project_id) {
      query = query.eq("project_id", context.active_project_id);
    } else if (context.allowed_project_ids.length > 0) {
      query = query.in("project_id", context.allowed_project_ids);
    } else {
      return fail("No accessible project found.", 403);
    }

    const { data: allowedRows, error: allowedError } = await query;

    if (allowedError) {
      return fail(allowedError.message, 500);
    }

    const allowedIds = (allowedRows ?? []).map((row: any) => row.id);

    if (allowedIds.length === 0) {
      return fail("No selected participants are accessible.", 403);
    }

    if (action === "archive") {
      const { data, error } = await supabaseAdmin
        .from("participants")
        .update({
          status: "archived",
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

      const allowedStatuses = new Set([
        "active",
        "inactive",
        "withdrawn",
        "completed",
        "archived",
      ]);

      if (!allowedStatuses.has(status)) {
        return fail("Invalid participant status.", 400);
      }

      const updatePayload: Record<string, any> = {
        status,
      };

      if (status === "archived") {
        updatePayload.archived_at = new Date().toISOString();
      }

      const { data, error } = await supabaseAdmin
        .from("participants")
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
    return fail(error?.message ?? "Bulk participant action failed", 500);
  }
}