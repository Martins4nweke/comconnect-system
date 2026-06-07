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

function boolValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;

  const text = cleanText(value).toLowerCase();

  if (["true", "yes", "1", "y"].includes(text)) return true;
  if (["false", "no", "0", "n"].includes(text)) return false;

  return fallback;
}

function safeParticipant(row: any) {
  return {
    id: row.id ?? null,
    organisation_id: row.organisation_id ?? null,
    project_id: row.project_id ?? null,

    participant_code: row.participant_code ?? null,
    phone_number: row.phone_number ?? null,

    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,
    display_name: row.display_name ?? null,

    preferred_language: row.preferred_language ?? null,
    status: row.status ?? null,
    app_access_enabled: row.app_access_enabled ?? null,

    metadata: row.metadata ?? {},
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    archived_at: row.archived_at ?? null,
  };
}

async function ensureProjectBelongsToOrganisation(params: {
  organisationId: string;
  projectId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id")
    .eq("id", params.projectId)
    .eq("organisation_id", params.organisationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.id);
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
        `participant_code.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone_number.ilike.%${search}%,display_name.ilike.%${search}%`
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

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  const auth = await authenticateExternalApiKey({
    req,
    requiredScope: "participants:write",
  });

  if (auth.ok === false) {
    return fail(auth.error, auth.status);
  }

  try {
    const body = await req.json().catch(() => null);

    const requestedProjectId = cleanText(body?.project_id);
    const projectId = auth.projectId || requestedProjectId;

    const participantCode = cleanText(body?.participant_code);
    const phoneNumber = cleanText(body?.phone_number);
    const firstName = cleanText(body?.first_name);
    const lastName = cleanText(body?.last_name);
    const displayName =
  [firstName, lastName].filter(Boolean).join(" ") || participantCode;

    const preferredLanguage = cleanText(body?.preferred_language) || null;
    const status = cleanText(body?.status) || "active";
    const appAccessEnabled = boolValue(body?.app_access_enabled, true);

    const metadata =
      body?.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? body.metadata
        : {};

    if (!projectId) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId: auth.projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/participants",
        method: "POST",
        statusCode: 400,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        paidChannel: false,
        errorMessage: "project_id is required.",
        metadata: {
          action: "external_create_participant",
          result: "validation_failed",
          reason: "missing_project_id",
          key_prefix: auth.apiKey.key_prefix,
        },
      });

      return fail("project_id is required.", 400);
    }

    if (!participantCode) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/participants",
        method: "POST",
        statusCode: 400,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        paidChannel: false,
        errorMessage: "participant_code is required.",
        metadata: {
          action: "external_create_participant",
          result: "validation_failed",
          reason: "missing_participant_code",
          key_prefix: auth.apiKey.key_prefix,
        },
      });

      return fail("participant_code is required.", 400);
    }

    const projectAllowed = await ensureProjectBelongsToOrganisation({
      organisationId: auth.organisationId,
      projectId,
    });

    if (!projectAllowed) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/participants",
        method: "POST",
        statusCode: 403,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        paidChannel: false,
        errorMessage: "Project not found for this organisation.",
        metadata: {
          action: "external_create_participant",
          result: "project_denied",
          key_prefix: auth.apiKey.key_prefix,
          project_id: projectId,
        },
      });

      return fail("Project not found for this organisation.", 403);
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("participants")
      .select("id, participant_code")
      .eq("organisation_id", auth.organisationId)
      .eq("project_id", projectId)
      .eq("participant_code", participantCode)
      .maybeSingle();

    if (existingError) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/participants",
        method: "POST",
        statusCode: 500,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        paidChannel: false,
        errorMessage: existingError.message,
        metadata: {
          action: "external_create_participant",
          result: "duplicate_check_failed",
          key_prefix: auth.apiKey.key_prefix,
          project_id: projectId,
          participant_code: participantCode,
        },
      });

      return fail(existingError.message, 500);
    }

    if (existing?.id) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/participants",
        method: "POST",
        statusCode: 409,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        paidChannel: false,
        errorMessage: "Participant code already exists in this project.",
        metadata: {
          action: "external_create_participant",
          result: "duplicate",
          key_prefix: auth.apiKey.key_prefix,
          project_id: projectId,
          participant_code: participantCode,
          existing_participant_id: existing.id,
        },
      });

      return fail("Participant code already exists in this project.", 409);
    }

    const { data, error } = await supabaseAdmin
      .from("participants")
      .insert({
        organisation_id: auth.organisationId,
        project_id: projectId,
        participant_code: participantCode,
        phone_number: phoneNumber || null,
        first_name: firstName || null,
        last_name: lastName || null,
        preferred_language: preferredLanguage,
        status,
        app_access_enabled: appAccessEnabled,
        metadata: {
          ...metadata,
          created_from: "external_api",
          api_key_id: auth.apiKey.id,
          api_key_prefix: auth.apiKey.key_prefix,
        },
      })
      .select("*")
      .single();

    if (error) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/participants",
        method: "POST",
        statusCode: 500,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        paidChannel: false,
        errorMessage: error.message,
        metadata: {
          action: "external_create_participant",
          result: "failed",
          key_prefix: auth.apiKey.key_prefix,
          project_id: projectId,
          participant_code: participantCode,
        },
      });

      return fail(error.message, 500);
    }

    await logApiUsage({
      organisationId: auth.organisationId,
      projectId,
      apiKeyId: auth.apiKey.id,
      endpoint: "/api/external/participants",
      method: "POST",
      statusCode: 201,
      durationMs: Date.now() - startedAt,
      requestSource: "external_api",
      paidChannel: false,
      metadata: {
        action: "external_create_participant",
        result: "success",
        key_prefix: auth.apiKey.key_prefix,
        project_id: projectId,
        participant_id: data.id,
        participant_code: data.participant_code,
      },
    });

    return ok(
      {
        participant: safeParticipant(data),
        message: "Participant created using external API key scope.",
      },
      201
    );
  } catch (error: any) {
    await logApiUsage({
      organisationId: auth.organisationId,
      projectId: auth.projectId,
      apiKeyId: auth.apiKey.id,
      endpoint: "/api/external/participants",
      method: "POST",
      statusCode: 500,
      durationMs: Date.now() - startedAt,
      requestSource: "external_api",
      paidChannel: false,
      errorMessage: error?.message ?? "Failed to create external participant.",
      metadata: {
        action: "external_create_participant",
        result: "exception",
        key_prefix: auth.apiKey.key_prefix,
      },
    });

    return fail(error?.message ?? "Failed to create external participant.", 500);
  }
}