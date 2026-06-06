import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
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

  return Math.min(Math.max(parsed, 1), 200);
}

function canManageMedia(context: Awaited<ReturnType<typeof getScopedContext>>) {
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

  if (context.active_project_id) {
    return context.active_project_id;
  }

  if (context.allowed_project_ids.length > 0) {
    return context.allowed_project_ids[0];
  }

  throw new Error("No accessible project found.");
}

function applyMediaScope(
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
    const mediaType = cleanText(req.nextUrl.searchParams.get("media_type"));
    const status = cleanText(req.nextUrl.searchParams.get("status"));
    const q = cleanText(req.nextUrl.searchParams.get("q"));
    const limit = safeLimit(req.nextUrl.searchParams.get("limit"));

    const projectId = requestedProjectId
      ? resolveAllowedProjectId(context, requestedProjectId)
      : null;

    let query = supabaseAdmin
      .from("media_assets")
      .select("*")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(limit);

    query = applyMediaScope(query, context, projectId);

    if (mediaType) query = query.eq("media_type", mediaType);
    if (status) query = query.eq("status", status);

    if (q) {
      query = query.or(
        `title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%,language_code.ilike.%${q}%,file_name.ilike.%${q}%`
      );
    }

    const { data, error } = await query;

    if (error) return fail(error.message, 500);

    return ok(data ?? []);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load media library", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    if (!canManageMedia(context)) {
      return fail("You do not have permission to update media items.", 403);
    }

    const body = await req.json().catch(() => null);

    const id = cleanText(body?.id);
    const action = cleanText(body?.action || "archive");

    if (!id) return fail("Media asset id is required", 400);

    if (action !== "archive" && action !== "restore" && action !== "approve") {
      return fail("Unsupported media action", 400);
    }

    let allowedQuery = supabaseAdmin
      .from("media_assets")
      .select("id")
      .eq("organisation_id", context.organisation_id)
      .eq("id", id)
      .limit(1);

    if (context.active_project_id) {
      allowedQuery = allowedQuery.eq("project_id", context.active_project_id);
    } else if (context.allowed_project_ids.length > 0) {
      allowedQuery = allowedQuery.in("project_id", context.allowed_project_ids);
    } else {
      return fail("No accessible project found.", 403);
    }

    const { data: allowedRows, error: allowedError } = await allowedQuery;

    if (allowedError) return fail(allowedError.message, 500);

    if (!allowedRows || allowedRows.length === 0) {
      return fail("Media item not found or not allowed.", 404);
    }

    if (action === "approve") {
      const { data, error } = await supabaseAdmin
        .from("media_assets")
        .update({
          is_approved: true,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("organisation_id", context.organisation_id)
        .eq("id", id)
        .select("*")
        .single();

      if (error) return fail(error.message, 500);

      await createAuditLog({
        organisation_id: data.organisation_id,
        project_id: data.project_id,
        actor_type: "dashboard_user",
        action: "media_asset.approved",
        entity_type: "media_asset",
        entity_id: data.id,
        metadata: {
          title: data.title,
          media_type: data.media_type,
          public_url: data.public_url,
        },
      });

      return ok(data);
    }

    const shouldArchive = action === "archive";

    const { data, error } = await supabaseAdmin
      .from("media_assets")
      .update({
        is_deleted: shouldArchive,
        deleted_at: shouldArchive ? new Date().toISOString() : null,
        status: shouldArchive ? "archived" : "active",
        updated_at: new Date().toISOString(),
      })
      .eq("organisation_id", context.organisation_id)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    await createAuditLog({
      organisation_id: data.organisation_id,
      project_id: data.project_id,
      actor_type: "dashboard_user",
      action: shouldArchive ? "media_asset.archived" : "media_asset.restored",
      entity_type: "media_asset",
      entity_id: data.id,
      metadata: {
        title: data.title,
        media_type: data.media_type,
        public_url: data.public_url,
      },
    });

    return ok(data);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to update media item", 500);
  }
}