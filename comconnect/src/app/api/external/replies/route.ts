import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { authenticateExternalApiKey } from "@/lib/external-api/authenticate-api-key";
import { logApiUsage } from "@/lib/api-usage/log-api-usage";

export const runtime = "nodejs";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function numberParam(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return parsed;
}

function safeReply(row: any) {
  return {
    id: row.id ?? null,
    organisation_id: row.organisation_id ?? null,
    project_id: row.project_id ?? null,
    participant_id: row.participant_id ?? null,

    local_id: row.local_id ?? null,
    category: row.category ?? null,
    message: row.message ?? null,
    priority: row.priority ?? null,
    status: row.status ?? null,

    assigned_user_id: row.assigned_user_id ?? null,
    created_offline_at: row.created_offline_at ?? null,
    synced_at: row.synced_at ?? null,

    metadata: row.metadata ?? {},
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    archived_at: row.archived_at ?? null,
  };
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  const auth = await authenticateExternalApiKey({
    req,
    requiredScope: "replies:read",
  });

  if (auth.ok === false) {
    return fail(auth.error, auth.status);
  }

  const url = new URL(req.url);

  const requestedProjectId = cleanText(url.searchParams.get("project_id"));
  const participantId = cleanText(url.searchParams.get("participant_id"));
  const category = cleanText(url.searchParams.get("category"));
  const status = cleanText(url.searchParams.get("status"));
  const priority = cleanText(url.searchParams.get("priority"));
  const search = cleanText(url.searchParams.get("search"));

  const limit = Math.min(
    Math.max(numberParam(url.searchParams.get("limit"), 50), 1),
    200
  );

  const offset = Math.max(numberParam(url.searchParams.get("offset"), 0), 0);

  const effectiveProjectId = auth.projectId || requestedProjectId || "";

  try {
    let query = supabaseAdmin
      .from("help_requests")
      .select(
        "id, organisation_id, project_id, participant_id, local_id, category, message, priority, status, assigned_user_id, created_offline_at, synced_at, metadata, created_at, updated_at, archived_at",
        { count: "exact" }
      )
      .eq("organisation_id", auth.organisationId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (effectiveProjectId) {
      query = query.eq("project_id", effectiveProjectId);
    }

    if (participantId) {
      query = query.eq("participant_id", participantId);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (priority) {
      query = query.eq("priority", priority);
    }

    if (search) {
      query = query.or(
        `message.ilike.%${search}%,category.ilike.%${search}%,priority.ilike.%${search}%,status.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId: auth.projectId || effectiveProjectId || null,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/replies",
        method: "GET",
        statusCode: 500,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        paidChannel: false,
        errorMessage: error.message,
        metadata: {
          action: "external_list_replies",
          result: "failed",
          key_prefix: auth.apiKey.key_prefix,
          source_table: "help_requests",
          project_id: effectiveProjectId || null,
        },
      });

      return fail(error.message, 500);
    }

    await logApiUsage({
      organisationId: auth.organisationId,
      projectId: auth.projectId || effectiveProjectId || null,
      apiKeyId: auth.apiKey.id,
      endpoint: "/api/external/replies",
      method: "GET",
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      requestSource: "external_api",
      paidChannel: false,
      metadata: {
        action: "external_list_replies",
        result: "success",
        key_prefix: auth.apiKey.key_prefix,
        source_table: "help_requests",
        project_id: effectiveProjectId || null,
        category: category || null,
        status: status || null,
        priority: priority || null,
        limit,
        offset,
        returned: data?.length ?? 0,
      },
    });

    return ok({
      replies: (data ?? []).map(safeReply),
      source_table: "help_requests",
      pagination: {
        limit,
        offset,
        returned: data?.length ?? 0,
        total: count ?? 0,
        has_more: offset + (data?.length ?? 0) < (count ?? 0),
      },
      filters: {
        project_id: effectiveProjectId || null,
        participant_id: participantId || null,
        category: category || null,
        status: status || null,
        priority: priority || null,
        search: search || null,
      },
      scope: {
        organisation_id: auth.organisationId,
        api_key_project_id: auth.projectId,
        requested_project_id: requestedProjectId || null,
        effective_project_id: effectiveProjectId || null,
      },
      message:
        "Replies returned from help_requests using external API key scope. This route is read-only.",
    });
  } catch (error: any) {
    await logApiUsage({
      organisationId: auth.organisationId,
      projectId: auth.projectId,
      apiKeyId: auth.apiKey.id,
      endpoint: "/api/external/replies",
      method: "GET",
      statusCode: 500,
      durationMs: Date.now() - startedAt,
      requestSource: "external_api",
      paidChannel: false,
      errorMessage: error?.message ?? "Failed to load external replies.",
      metadata: {
        action: "external_list_replies",
        result: "exception",
        key_prefix: auth.apiKey.key_prefix,
        source_table: "help_requests",
      },
    });

    return fail(error?.message ?? "Failed to load external replies.", 500);
  }
}