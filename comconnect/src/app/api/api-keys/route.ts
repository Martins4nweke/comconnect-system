import { NextRequest } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { logApiUsage } from "@/lib/api-usage/log-api-usage";

export const runtime = "nodejs";

const API_ADMIN_ROLES = new Set([
  "platform_owner",
  "superadmin",
  "organisation_admin",
  "developer_admin",
]);

const ALLOWED_SCOPES = new Set([
  "participants:read",
  "participants:write",
  "messages:read",
  "messages:write",
  "schedules:read",
  "schedules:write",
  "delivery_logs:read",
  "replies:read",
  "webhooks:read",
  "webhooks:write",
]);

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function isApiAdmin(role?: string | null) {
  return API_ADMIN_ROLES.has(cleanText(role).toLowerCase());
}

function normaliseScopes(value: unknown) {
  if (!Array.isArray(value)) return ["participants:read", "delivery_logs:read"];

  const scopes = value
    .map((item) => cleanText(item))
    .filter((item) => ALLOWED_SCOPES.has(item));

  return scopes.length > 0
    ? Array.from(new Set(scopes))
    : ["participants:read"];
}

function hashApiKey(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function generateApiKey() {
  const raw = crypto.randomBytes(32).toString("hex");
  const key = `cc_live_${raw}`;
  const keyPrefix = key.slice(0, 16);

  return {
    key,
    keyPrefix,
    keyHash: hashApiKey(key),
  };
}

async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  return user;
}

async function getActiveMembership(params: {
  userId: string;
  email: string;
}) {
  const { data: byUserId, error: byUserIdError } = await supabaseAdmin
    .from("organisation_members")
    .select("*")
    .eq("user_id", params.userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (byUserIdError) {
    throw new Error(byUserIdError.message);
  }

  if (byUserId) return byUserId;

  const { data: byEmail, error: byEmailError } = await supabaseAdmin
    .from("organisation_members")
    .select("*")
    .eq("email", params.email)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (byEmailError) {
    throw new Error(byEmailError.message);
  }

  return byEmail;
}

async function requireApiAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false as const,
      error: "Not authenticated.",
      status: 401,
      user: null,
      membership: null,
    };
  }

  const email = cleanText(user.email).toLowerCase();

  const membership = await getActiveMembership({
    userId: user.id,
    email,
  });

  if (!membership?.organisation_id) {
    return {
      ok: false as const,
      error: "No active organisation membership found.",
      status: 403,
      user,
      membership: null,
    };
  }

  if (!isApiAdmin(membership.role)) {
    return {
      ok: false as const,
      error: "Only organisation admins or developer admins can manage API keys.",
      status: 403,
      user,
      membership,
    };
  }

  return {
    ok: true as const,
    user,
    membership,
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

async function logApiKeysRouteUsage(params: {
  organisationId: string;
  method: string;
  statusCode: number;
  startedAt: number;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await logApiUsage({
    organisationId: params.organisationId,
    endpoint: "/api/api-keys",
    method: params.method,
    statusCode: params.statusCode,
    durationMs: Date.now() - params.startedAt,
    requestSource: "dashboard",
    paidChannel: false,
    errorMessage: params.errorMessage ?? null,
    metadata: params.metadata ?? {},
  });
}

export async function GET() {
  const startedAt = Date.now();

  try {
    const auth = await requireApiAdmin();

    if (!auth.ok) {
      return fail(auth.error, auth.status);
    }

    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .select(
        "id, organisation_id, project_id, name, key_prefix, status, scopes, created_by, last_used_at, expires_at, created_at, updated_at, metadata"
      )
      .eq("organisation_id", auth.membership.organisation_id)
      .order("created_at", { ascending: false });

    if (error) {
      await logApiKeysRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "GET",
        statusCode: 500,
        startedAt,
        errorMessage: error.message,
        metadata: {
          action: "list_api_keys",
          result: "failed",
        },
      });

      return fail(error.message, 500);
    }

    await logApiKeysRouteUsage({
      organisationId: auth.membership.organisation_id,
      method: "GET",
      statusCode: 200,
      startedAt,
      metadata: {
        action: "list_api_keys",
        result: "success",
        count: data?.length ?? 0,
      },
    });

    return ok({
      api_keys: data ?? [],
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load API keys.", 500);
  }
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const auth = await requireApiAdmin();

    if (!auth.ok) {
      return fail(auth.error, auth.status);
    }

    const body = await req.json().catch(() => null);

    const name = cleanText(body?.name);
    const projectId = cleanText(body?.project_id);
    const expiresAt = cleanText(body?.expires_at);
    const scopes = normaliseScopes(body?.scopes);

    if (!name) {
      await logApiKeysRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "POST",
        statusCode: 400,
        startedAt,
        errorMessage: "API key name is required.",
        metadata: {
          action: "create_api_key",
          result: "validation_failed",
        },
      });

      return fail("API key name is required.", 400);
    }

    if (name.length > 120) {
      await logApiKeysRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "POST",
        statusCode: 400,
        startedAt,
        errorMessage: "API key name must be 120 characters or less.",
        metadata: {
          action: "create_api_key",
          result: "validation_failed",
          name_length: name.length,
        },
      });

      return fail("API key name must be 120 characters or less.", 400);
    }

    if (projectId) {
      const projectAllowed = await ensureProjectBelongsToOrganisation({
        organisationId: auth.membership.organisation_id,
        projectId,
      });

      if (!projectAllowed) {
        await logApiKeysRouteUsage({
          organisationId: auth.membership.organisation_id,
          method: "POST",
          statusCode: 403,
          startedAt,
          errorMessage: "Project not found for this organisation.",
          metadata: {
            action: "create_api_key",
            result: "project_denied",
            project_id: projectId,
          },
        });

        return fail("Project not found for this organisation.", 403);
      }
    }

    let expiresAtValue: string | null = null;

    if (expiresAt) {
      const parsed = new Date(expiresAt);

      if (Number.isNaN(parsed.getTime())) {
        await logApiKeysRouteUsage({
          organisationId: auth.membership.organisation_id,
          method: "POST",
          statusCode: 400,
          startedAt,
          errorMessage: "expires_at must be a valid date.",
          metadata: {
            action: "create_api_key",
            result: "validation_failed",
          },
        });

        return fail("expires_at must be a valid date.", 400);
      }

      expiresAtValue = parsed.toISOString();
    }

    const generated = generateApiKey();

    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        organisation_id: auth.membership.organisation_id,
        project_id: projectId || null,
        name,
        key_prefix: generated.keyPrefix,
        key_hash: generated.keyHash,
        status: "active",
        scopes,
        created_by: auth.user.id,
        expires_at: expiresAtValue,
        metadata: {
          created_by_email: cleanText(auth.user.email).toLowerCase(),
          created_from: "api_keys_page",
          full_key_shown_once: true,
        },
      })
      .select(
        "id, organisation_id, project_id, name, key_prefix, status, scopes, created_by, last_used_at, expires_at, created_at, updated_at, metadata"
      )
      .single();

    if (error) {
      await logApiKeysRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "POST",
        statusCode: 500,
        startedAt,
        errorMessage: error.message,
        metadata: {
          action: "create_api_key",
          result: "failed",
          name,
          project_id: projectId || null,
          scopes,
        },
      });

      return fail(error.message, 500);
    }

    await logApiKeysRouteUsage({
      organisationId: auth.membership.organisation_id,
      method: "POST",
      statusCode: 201,
      startedAt,
      metadata: {
        action: "create_api_key",
        result: "success",
        api_key_id: data.id,
        key_prefix: data.key_prefix,
        project_id: data.project_id,
        scopes: data.scopes,
      },
    });

    return ok(
      {
        api_key: data,
        key: generated.key,
        message:
          "API key created. Copy it now because the full key will not be shown again.",
      },
      201
    );
  } catch (error: any) {
    return fail(error?.message ?? "Failed to create API key.", 500);
  }
}

export async function PATCH(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const auth = await requireApiAdmin();

    if (!auth.ok) {
      return fail(auth.error, auth.status);
    }

    const body = await req.json().catch(() => null);

    const apiKeyId = cleanText(body?.api_key_id);
    const action = cleanText(body?.action).toLowerCase();

    if (!apiKeyId) {
      await logApiKeysRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "PATCH",
        statusCode: 400,
        startedAt,
        errorMessage: "api_key_id is required.",
        metadata: {
          action: "update_api_key",
          result: "validation_failed",
        },
      });

      return fail("api_key_id is required.", 400);
    }

    if (action !== "revoke") {
      await logApiKeysRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "PATCH",
        statusCode: 400,
        startedAt,
        errorMessage: "Only revoke action is currently supported.",
        metadata: {
          action: "update_api_key",
          requested_action: action,
          result: "validation_failed",
          api_key_id: apiKeyId,
        },
      });

      return fail("Only revoke action is currently supported.", 400);
    }

    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .update({
        status: "revoked",
        updated_at: new Date().toISOString(),
        metadata: {
          revoked_from: "api_keys_page",
          revoked_by: auth.user.id,
          revoked_by_email: cleanText(auth.user.email).toLowerCase(),
          revoked_at: new Date().toISOString(),
        },
      })
      .eq("id", apiKeyId)
      .eq("organisation_id", auth.membership.organisation_id)
      .select(
        "id, organisation_id, project_id, name, key_prefix, status, scopes, created_by, last_used_at, expires_at, created_at, updated_at, metadata"
      )
      .maybeSingle();

    if (error) {
      await logApiKeysRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "PATCH",
        statusCode: 500,
        startedAt,
        errorMessage: error.message,
        metadata: {
          action: "revoke_api_key",
          result: "failed",
          api_key_id: apiKeyId,
        },
      });

      return fail(error.message, 500);
    }

    if (!data) {
      await logApiKeysRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "PATCH",
        statusCode: 404,
        startedAt,
        errorMessage: "API key not found for this organisation.",
        metadata: {
          action: "revoke_api_key",
          result: "not_found",
          api_key_id: apiKeyId,
        },
      });

      return fail("API key not found for this organisation.", 404);
    }

    await logApiKeysRouteUsage({
      organisationId: auth.membership.organisation_id,
      method: "PATCH",
      statusCode: 200,
      startedAt,
      metadata: {
        action: "revoke_api_key",
        result: "success",
        api_key_id: data.id,
        key_prefix: data.key_prefix,
      },
    });

    return ok({
      api_key: data,
      message: "API key revoked.",
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to update API key.", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const auth = await requireApiAdmin();

    if (!auth.ok) {
      return fail(auth.error, auth.status);
    }

    const url = new URL(req.url);
    const apiKeyId = cleanText(url.searchParams.get("api_key_id"));

    if (!apiKeyId) {
      await logApiKeysRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "DELETE",
        statusCode: 400,
        startedAt,
        errorMessage: "api_key_id is required.",
        metadata: {
          action: "delete_api_key",
          result: "validation_failed",
        },
      });

      return fail("api_key_id is required.", 400);
    }

    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .delete()
      .eq("id", apiKeyId)
      .eq("organisation_id", auth.membership.organisation_id)
      .select("id, name, key_prefix")
      .maybeSingle();

    if (error) {
      await logApiKeysRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "DELETE",
        statusCode: 500,
        startedAt,
        errorMessage: error.message,
        metadata: {
          action: "delete_api_key",
          result: "failed",
          api_key_id: apiKeyId,
        },
      });

      return fail(error.message, 500);
    }

    if (!data) {
      await logApiKeysRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "DELETE",
        statusCode: 404,
        startedAt,
        errorMessage: "API key not found for this organisation.",
        metadata: {
          action: "delete_api_key",
          result: "not_found",
          api_key_id: apiKeyId,
        },
      });

      return fail("API key not found for this organisation.", 404);
    }

    await logApiKeysRouteUsage({
      organisationId: auth.membership.organisation_id,
      method: "DELETE",
      statusCode: 200,
      startedAt,
      metadata: {
        action: "delete_api_key",
        result: "success",
        api_key_id: data.id,
        key_prefix: data.key_prefix,
      },
    });

    return ok({
      deleted_api_key: data,
      message: "API key deleted.",
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to delete API key.", 500);
  }
}