import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { getScopedContext } from "@/lib/comconnect-core/access-scope";
import {
  getLargeTableParams,
  getNextCursor,
} from "@/lib/large-table/pagination";
import { applyCommonFilters, textSearchOr } from "@/lib/large-table/query";

export async function GET(req: NextRequest) {
  try {
    const context = await getScopedContext(req);
    const params = getLargeTableParams(req);

    let query = supabaseAdmin
      .from("media_assets")
      .select("*")
      .eq("organisation_id", context.organisation_id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(params.limit);

    if (context.active_project_id) {
      query = query.eq("project_id", context.active_project_id);
    } else if (context.allowed_project_ids.length > 0) {
      query = query.in("project_id", context.allowed_project_ids);
    } else {
      query = query.eq("project_id", "__no_project_access__");
    }

    query = applyCommonFilters(query, params);

    const search = textSearchOr(params.q, [
      "title",
      "description",
      "category",
      "language_code",
      "media_type",
      "file_name",
      "mime_type",
      "status",
    ]);

    if (search) query = query.or(search);

    const { data, error } = await query;

    if (error) return fail(error.message, 500);

    const rows = (data ?? []).map((row: any) => ({
      ...row,
      media_label: row.title ?? row.file_name ?? "—",
      media_type_label: row.media_type ?? "other",
      approval_label: row.is_approved ? "approved" : "pending",
      file_size_mb:
        typeof row.file_size_bytes === "number"
          ? Number((row.file_size_bytes / 1024 / 1024).toFixed(2))
          : null,
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
    return fail(error?.message ?? "Failed to load media assets", 500);
  }
}