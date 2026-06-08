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

function safeAppMessage(row: any) {
  return {
    id: row.id ?? null,
    organisation_id: row.organisation_id ?? null,
    project_id: row.project_id ?? null,
    participant_id: row.participant_id ?? null,

    sender_type: row.sender_type ?? null,
    sender_display_name: row.sender_display_name ?? null,
    sender_role: row.sender_role ?? null,

    title: row.title ?? null,
    body: row.body ?? null,
    category: row.category ?? null,
    priority: row.priority ?? null,
    status: row.status ?? null,

    available_at: row.available_at ?? null,
    expires_at: row.expires_at ?? null,

    message_code: row.message_code ?? null,
    source_type: row.source_type ?? null,
    source_id: row.source_id ?? null,

    media: row.media ?? {},
    action_links: row.action_links ?? [],
    metadata: row.metadata ?? {},

    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  const auth = await authenticateExternalApiKey({
    req,
    requiredScope: "messages:read",
  });

  if (auth.ok === false) {
    return fail(auth.error, auth.status);
  }

  const url = new URL(req.url);

  const requestedProjectId = cleanText(url.searchParams.get("project_id"));
  const participantId = cleanText(url.searchParams.get("participant_id"));
  const status = cleanText(url.searchParams.get("status"));
  const category = cleanText(url.searchParams.get("category"));
  const priority = cleanText(url.searchParams.get("priority"));
  const messageCode = cleanText(url.searchParams.get("message_code"));
  const sourceType = cleanText(url.searchParams.get("source_type"));
  const search = cleanText(url.searchParams.get("search"));

  const limit = Math.min(
    Math.max(numberParam(url.searchParams.get("limit"), 50), 1),
    200
  );

  const offset = Math.max(numberParam(url.searchParams.get("offset"), 0), 0);

  const effectiveProjectId = auth.projectId || requestedProjectId || "";

  try {
    let query = supabaseAdmin
      .from("app_messages")
      .select(
  "id, organisation_id, project_id, participant_id, sender_type, sender_display_name, sender_role, title, body, category, priority, status, available_at, expires_at, message_code, source_type, source_id, media, action_links, metadata, created_at, updated_at",
  { count: "exact" }
)
      .eq("organisation_id", auth.organisationId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (effectiveProjectId) {
      query = query.eq("project_id", effectiveProjectId);
    }

    if (participantId) {
      query = query.eq("participant_id", participantId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (priority) {
      query = query.eq("priority", priority);
    }

    if (messageCode) {
      query = query.eq("message_code", messageCode);
    }

    if (sourceType) {
      query = query.eq("source_type", sourceType);
    }

    if (search) {
      query = query.or(
        `title.ilike.%${search}%,body.ilike.%${search}%,message_code.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId: auth.projectId || effectiveProjectId || null,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/messages",
        method: "GET",
        statusCode: 500,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        paidChannel: false,
        errorMessage: error.message,
        metadata: {
          action: "external_list_messages",
          result: "failed",
          key_prefix: auth.apiKey.key_prefix,
          project_id: effectiveProjectId || null,
        },
      });

      return fail(error.message, 500);
    }

    await logApiUsage({
      organisationId: auth.organisationId,
      projectId: auth.projectId || effectiveProjectId || null,
      apiKeyId: auth.apiKey.id,
      endpoint: "/api/external/messages",
      method: "GET",
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      requestSource: "external_api",
      paidChannel: false,
      metadata: {
        action: "external_list_messages",
        result: "success",
        key_prefix: auth.apiKey.key_prefix,
        project_id: effectiveProjectId || null,
        status: status || null,
        category: category || null,
        priority: priority || null,
        message_code: messageCode || null,
        source_type: sourceType || null,
        limit,
        offset,
        returned: data?.length ?? 0,
      },
    });

    return ok({
      messages: (data ?? []).map(safeAppMessage),
      source_table: "app_messages",
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
        status: status || null,
        category: category || null,
        priority: priority || null,
        message_code: messageCode || null,
        source_type: sourceType || null,
        search: search || null,
      },
      scope: {
        organisation_id: auth.organisationId,
        api_key_project_id: auth.projectId,
        requested_project_id: requestedProjectId || null,
        effective_project_id: effectiveProjectId || null,
      },
      message:
        "App messages returned using external API key scope. For SMS, voice and WhatsApp queued records, use GET /api/external/schedules.",
    });
  } catch (error: any) {
    await logApiUsage({
      organisationId: auth.organisationId,
      projectId: auth.projectId,
      apiKeyId: auth.apiKey.id,
      endpoint: "/api/external/messages",
      method: "GET",
      statusCode: 500,
      durationMs: Date.now() - startedAt,
      requestSource: "external_api",
      paidChannel: false,
      errorMessage: error?.message ?? "Failed to load external messages.",
      metadata: {
        action: "external_list_messages",
        result: "exception",
        key_prefix: auth.apiKey.key_prefix,
      },
    });

    return fail(error?.message ?? "Failed to load external messages.", 500);
  }
}