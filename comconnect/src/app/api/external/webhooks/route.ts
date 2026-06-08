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

function safeWebhook(row: any) {
  return {
    id: row.id ?? null,
    organisation_id: row.organisation_id ?? null,
    project_id: row.project_id ?? null,
    name: row.name ?? null,
    url: row.url ?? null,
    event_types: row.event_types ?? [],
    status: row.status ?? null,
    last_delivery_status: row.last_delivery_status ?? null,
    last_delivery_at: row.last_delivery_at ?? null,
    last_error: row.last_error ?? null,
    metadata: row.metadata ?? {},
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  const auth = await authenticateExternalApiKey({
    req,
    requiredScope: "webhooks:read",
  });

  if (auth.ok === false) {
    return fail(auth.error, auth.status);
  }

  const url = new URL(req.url);

  const requestedProjectId = cleanText(url.searchParams.get("project_id"));
  const status = cleanText(url.searchParams.get("status"));
  const eventType = cleanText(url.searchParams.get("event_type"));
  const search = cleanText(url.searchParams.get("search"));

  const limit = Math.min(
    Math.max(numberParam(url.searchParams.get("limit"), 50), 1),
    200
  );

  const offset = Math.max(numberParam(url.searchParams.get("offset"), 0), 0);

  const effectiveProjectId = auth.projectId || requestedProjectId || "";

  try {
    let query = supabaseAdmin
      .from("webhooks")
      .select(
        "id, organisation_id, project_id, name, url, event_types, status, last_delivery_status, last_delivery_at, last_error, metadata, created_at, updated_at",
        { count: "exact" }
      )
      .eq("organisation_id", auth.organisationId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (effectiveProjectId) {
      query = query.eq("project_id", effectiveProjectId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (eventType) {
      query = query.contains("event_types", [eventType]);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,url.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId: auth.projectId || effectiveProjectId || null,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/webhooks",
        method: "GET",
        statusCode: 500,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        channel: "webhook",
        paidChannel: false,
        errorMessage: error.message,
        metadata: {
          action: "external_list_webhooks",
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
      endpoint: "/api/external/webhooks",
      method: "GET",
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      requestSource: "external_api",
      channel: "webhook",
      paidChannel: false,
      metadata: {
        action: "external_list_webhooks",
        result: "success",
        key_prefix: auth.apiKey.key_prefix,
        project_id: effectiveProjectId || null,
        status: status || null,
        event_type: eventType || null,
        limit,
        offset,
        returned: data?.length ?? 0,
      },
    });

    return ok({
      webhooks: (data ?? []).map(safeWebhook),
      pagination: {
        limit,
        offset,
        returned: data?.length ?? 0,
        total: count ?? 0,
        has_more: offset + (data?.length ?? 0) < (count ?? 0),
      },
      filters: {
        project_id: effectiveProjectId || null,
        status: status || null,
        event_type: eventType || null,
        search: search || null,
      },
      scope: {
        organisation_id: auth.organisationId,
        api_key_project_id: auth.projectId,
        requested_project_id: requestedProjectId || null,
        effective_project_id: effectiveProjectId || null,
      },
      message:
        "Webhooks returned using external API key scope. Secrets are never returned by this route.",
    });
  } catch (error: any) {
    await logApiUsage({
      organisationId: auth.organisationId,
      projectId: auth.projectId,
      apiKeyId: auth.apiKey.id,
      endpoint: "/api/external/webhooks",
      method: "GET",
      statusCode: 500,
      durationMs: Date.now() - startedAt,
      requestSource: "external_api",
      channel: "webhook",
      paidChannel: false,
      errorMessage: error?.message ?? "Failed to load external webhooks.",
      metadata: {
        action: "external_list_webhooks",
        result: "exception",
        key_prefix: auth.apiKey.key_prefix,
      },
    });

    return fail(error?.message ?? "Failed to load external webhooks.", 500);
  }
}