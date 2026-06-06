import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { getScopedContext } from "@/lib/comconnect-core/access-scope";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
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

export async function GET(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    const requestedProjectId = req.nextUrl.searchParams.get("project_id");
    const status = cleanText(req.nextUrl.searchParams.get("status"));
    const priority = cleanText(req.nextUrl.searchParams.get("priority"));
    const sourceType = cleanText(req.nextUrl.searchParams.get("source_type"));
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 200);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 200, 1), 200);

    const projectId = requestedProjectId
      ? resolveAllowedProjectId(context, requestedProjectId)
      : null;

    let query = supabaseAdmin
      .from("inbox_items")
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

    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);
    if (sourceType) query = query.eq("source_type", sourceType);

    const { data, error } = await query;

    if (error) return fail(error.message, 500);

    return ok(data ?? []);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load inbox", 500);
  }
}