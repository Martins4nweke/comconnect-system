import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";

type Params = { params: Promise<{ inboxItemId: string }> };

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function canManageInbox(context: Awaited<ReturnType<typeof getScopedContext>>) {
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

function applyInboxScope(
  query: any,
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  query = query.eq("organisation_id", context.organisation_id);

  if (context.active_project_id) {
    return query.eq("project_id", context.active_project_id);
  }

  if (context.allowed_project_ids.length > 0) {
    return query.in("project_id", context.allowed_project_ids);
  }

  return query.eq("project_id", "__no_project_access__");
}

function allowedUpdate(body: any) {
  const update: Record<string, any> = {};

  if ("status" in (body ?? {})) update.status = body?.status;
  if ("assigned_user_id" in (body ?? {})) {
    update.assigned_user_id = body?.assigned_user_id || null;
  }
  if ("priority" in (body ?? {})) update.priority = body?.priority;
  if ("title" in (body ?? {})) update.title = body?.title;
  if ("summary" in (body ?? {})) update.summary = body?.summary;

  const status = cleanText(update.status).toLowerCase();

  if (status === "resolved" || status === "closed") {
    update.resolved_at = new Date().toISOString();
  }

  if (status === "archived") {
    update.archived_at = new Date().toISOString();
  }

  return update;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const context = await getScopedContext(req);
    const { inboxItemId } = await params;

    let query = supabaseAdmin
      .from("inbox_items")
      .select(
        "*, participants(participant_code, phone_number, first_name, last_name, metadata)"
      )
      .eq("id", inboxItemId);

    query = applyInboxScope(query, context);

    const { data, error } = await query.maybeSingle();

    if (error) return fail(error.message, 500);

    if (!data) {
      return fail("Inbox item not found or not allowed.", 404);
    }

    return ok(data);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load inbox item", 500);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const context = await getScopedContext(req);

    if (!canManageInbox(context)) {
      return fail("You do not have permission to update inbox items.", 403);
    }

    const { inboxItemId } = await params;
    const body = await req.json().catch(() => null);
    const updatePayload = allowedUpdate(body);

    if (Object.keys(updatePayload).length === 0) {
      return fail("No valid inbox fields supplied for update.", 400);
    }

    let query = supabaseAdmin
      .from("inbox_items")
      .update(updatePayload)
      .eq("id", inboxItemId);

    query = applyInboxScope(query, context);

    const { data, error } = await query.select("*").maybeSingle();

    if (error) return fail(error.message, 500);

    if (!data) {
      return fail("Inbox item not found or not allowed.", 404);
    }

    await createAuditLog({
      organisation_id: data.organisation_id,
      project_id: data.project_id,
      actor_type: "dashboard_user",
      action: "inbox_item.updated",
      entity_type: "inbox_item",
      entity_id: data.id,
      metadata: {
        status: data.status,
        priority: data.priority,
        assigned_user_id: data.assigned_user_id ?? null,
      },
    });

    return ok(data);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to update inbox item", 500);
  }
}