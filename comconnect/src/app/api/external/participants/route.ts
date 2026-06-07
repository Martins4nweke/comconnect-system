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

function safeParticipant(row: any) {
  return {
    id: row.id ?? null,
    organisation_id: row.organisation_id ?? null,
    project_id: row.project_id ?? null,

    participant_code: row.participant_code ?? null,
    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,

    phone_number: row.phone_number ?? null,
    email: row.email ?? null,

    preferred_language: row.preferred_language ?? null,
    preferred_channel: row.preferred_channel ?? null,

    status: row.status ?? null,
    is_active: row.is_active ?? null,

    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  const auth = await authenticateExternalApiKey({
    req,
    requiredScope: "participants:read",
  });

  if (auth.ok === false) {
    return fail(auth.error, auth.status);
  }

  const url = new URL(req.url);

  const requestedProjectId = cleanText(url.searchParams.get("project_id"));
  const search = cleanText(url.searchParams.get("search"));
  const status = cleanText(url.searchParams.get("status"));

  const limit = Math.min(
    Math.max(numberParam(url.searchParams.get("limit"), 50), 1),
    200
  );

  const offset = Math.max(numberParam(url.searchParams.get("offset"), 0), 0);

  /*
    Project scoping rule:
    - If the API key is project-scoped, force that project.
    - If the API key is organisation-scoped, allow optional ?project_id=...
  */
  const effectiveProjectId = auth.projectId || requestedProjectId || "";

  try {
    let query = supabaseAdmin
      .from("participants")
      .select("*", { count: "exact" })
      .eq("organisation_id", auth.organisationId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (effectiveProjectId) {
      query = query.eq("project_id", effectiveProjectId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(
        `participant_code.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone_number.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId: auth.projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/participants",
        method: "GET",
        statusCode: 500,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        paidChannel: false,
        errorMessage: error.message,
        metadata: {
          action: "external_list_participants",
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
      endpoint: "/api/external/participants",
      method: "GET",
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      requestSource: "external_api",
      paidChannel: false,
      metadata: {
        action: "external_list_participants",
        result: "success",
        key_prefix: auth.apiKey.key_prefix,
        project_id: effectiveProjectId || null,
        limit,
        offset,
        returned: data?.length ?? 0,
      },
    });

    return ok({
      participants: (data ?? []).map(safeParticipant),
      pagination: {
        limit,
        offset,
        returned: data?.length ?? 0,
        total: count ?? 0,
        has_more: offset + (data?.length ?? 0) < (count ?? 0),
      },
      scope: {
        organisation_id: auth.organisationId,
        api_key_project_id: auth.projectId,
        requested_project_id: requestedProjectId || null,
        effective_project_id: effectiveProjectId || null,
      },
      message:
        "Participants returned using external API key scope. This route is read-only.",
    });
  } catch (error: any) {
    await logApiUsage({
      organisationId: auth.organisationId,
      projectId: auth.projectId,
      apiKeyId: auth.apiKey.id,
      endpoint: "/api/external/participants",
      method: "GET",
      statusCode: 500,
      durationMs: Date.now() - startedAt,
      requestSource: "external_api",
      paidChannel: false,
      errorMessage: error?.message ?? "Failed to load external participants.",
      metadata: {
        action: "external_list_participants",
        result: "exception",
        key_prefix: auth.apiKey.key_prefix,
      },
    });

    return fail(error?.message ?? "Failed to load external participants.", 500);
  }
}