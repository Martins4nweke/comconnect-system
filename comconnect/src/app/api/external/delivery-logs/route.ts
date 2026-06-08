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

function safeDeliveryEvent(row: any) {
  return {
    id: row.id ?? null,
    organisation_id: row.organisation_id ?? null,
    project_id: row.project_id ?? null,
    participant_id: row.participant_id ?? null,
    device_id: row.device_id ?? null,

    channel: row.channel ?? null,
    source_type: row.source_type ?? null,
    source_id: row.source_id ?? null,

    provider: row.provider ?? null,
    provider_message_id: row.provider_message_id ?? null,
    provider_status: row.provider_status ?? null,

    status: row.status ?? null,
    error_message: row.error_message ?? null,
    failure_reason: row.failure_reason ?? null,

    provider_cost: row.provider_cost ?? null,
    provider_units: row.provider_units ?? null,
    phone_number: row.phone_number ?? null,

    created_at: row.created_at ?? null,
    metadata: row.metadata ?? {},
  };
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  const auth = await authenticateExternalApiKey({
    req,
    requiredScope: "delivery_logs:read",
  });

  if (auth.ok === false) {
    return fail(auth.error, auth.status);
  }

  const url = new URL(req.url);

  const requestedProjectId = cleanText(url.searchParams.get("project_id"));
  const participantId = cleanText(url.searchParams.get("participant_id"));
  const channel = cleanText(url.searchParams.get("channel"));
  const status = cleanText(url.searchParams.get("status"));
  const provider = cleanText(url.searchParams.get("provider"));

  const limit = Math.min(
    Math.max(numberParam(url.searchParams.get("limit"), 50), 1),
    200
  );

  const offset = Math.max(numberParam(url.searchParams.get("offset"), 0), 0);

  const effectiveProjectId = auth.projectId || requestedProjectId || "";

  try {
    let query = supabaseAdmin
      .from("communication_delivery_events")
      .select(
        "id, organisation_id, project_id, participant_id, device_id, channel, source_type, source_id, provider, provider_message_id, status, error_message, metadata, created_at, failure_reason, provider_status, provider_cost, provider_units, phone_number",
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

    if (channel) {
      query = query.eq("channel", channel);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (provider) {
      query = query.eq("provider", provider);
    }

    const { data, error, count } = await query;

    if (error) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId: auth.projectId || effectiveProjectId || null,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/delivery-logs",
        method: "GET",
        statusCode: 500,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        paidChannel: false,
        errorMessage: error.message,
        metadata: {
          action: "external_list_delivery_logs",
          result: "failed",
          key_prefix: auth.apiKey.key_prefix,
          project_id: effectiveProjectId || null,
          channel: channel || null,
          status: status || null,
          provider: provider || null,
        },
      });

      return fail(error.message, 500);
    }

    await logApiUsage({
      organisationId: auth.organisationId,
      projectId: auth.projectId || effectiveProjectId || null,
      apiKeyId: auth.apiKey.id,
      endpoint: "/api/external/delivery-logs",
      method: "GET",
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      requestSource: "external_api",
      paidChannel: false,
      metadata: {
        action: "external_list_delivery_logs",
        result: "success",
        key_prefix: auth.apiKey.key_prefix,
        project_id: effectiveProjectId || null,
        channel: channel || null,
        status: status || null,
        provider: provider || null,
        limit,
        offset,
        returned: data?.length ?? 0,
      },
    });

    return ok({
      delivery_logs: (data ?? []).map(safeDeliveryEvent),
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
        channel: channel || null,
        status: status || null,
        provider: provider || null,
      },
      scope: {
        organisation_id: auth.organisationId,
        api_key_project_id: auth.projectId,
        requested_project_id: requestedProjectId || null,
        effective_project_id: effectiveProjectId || null,
      },
      message:
        "Delivery logs returned using external API key scope. This route is read-only.",
    });
  } catch (error: any) {
    await logApiUsage({
      organisationId: auth.organisationId,
      projectId: auth.projectId,
      apiKeyId: auth.apiKey.id,
      endpoint: "/api/external/delivery-logs",
      method: "GET",
      statusCode: 500,
      durationMs: Date.now() - startedAt,
      requestSource: "external_api",
      paidChannel: false,
      errorMessage: error?.message ?? "Failed to load external delivery logs.",
      metadata: {
        action: "external_list_delivery_logs",
        result: "exception",
        key_prefix: auth.apiKey.key_prefix,
      },
    });

    return fail(error?.message ?? "Failed to load external delivery logs.", 500);
  }
}