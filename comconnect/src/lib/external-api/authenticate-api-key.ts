import crypto from "crypto";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ExternalApiAuthResult =
  | {
      ok: true;
      apiKey: {
        id: string;
        organisation_id: string;
        project_id: string | null;
        name: string;
        key_prefix: string;
        scopes: string[];
        status: string;
      };
      organisationId: string;
      projectId: string | null;
      scopes: string[];
    }
  | {
      ok: false;
      status: number;
      error: string;
      reason:
        | "missing_authorization"
        | "invalid_authorization"
        | "invalid_key"
        | "key_inactive"
        | "key_expired"
        | "scope_denied"
        | "server_error";
    };

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function hashApiKey(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function extractBearerToken(req: NextRequest) {
  const authorization = cleanText(req.headers.get("authorization"));

  if (!authorization) {
    return {
      ok: false as const,
      status: 401,
      error: "Missing Authorization header.",
      reason: "missing_authorization" as const,
    };
  }

  const [scheme, token] = authorization.split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return {
      ok: false as const,
      status: 401,
      error: "Authorization header must use Bearer token format.",
      reason: "invalid_authorization" as const,
    };
  }

  return {
    ok: true as const,
    token: cleanText(token),
  };
}

function normaliseScopes(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function hasRequiredScope(params: {
  scopes: string[];
  requiredScope?: string | null;
}) {
  if (!params.requiredScope) return true;

  return params.scopes.includes(params.requiredScope);
}

export async function authenticateExternalApiKey(params: {
  req: NextRequest;
  requiredScope?: string | null;
}): Promise<ExternalApiAuthResult> {
  try {
        const tokenResult = extractBearerToken(params.req);

    if (!tokenResult.ok) {
      return {
        ok: false,
        status: tokenResult.status,
        error: tokenResult.error,
        reason: tokenResult.reason,
      };
    }

    const rawKey = tokenResult.token;

    if (!rawKey.startsWith("cc_live_")) {
      return {
        ok: false,
        status: 401,
        error: "Invalid API key.",
        reason: "invalid_key",
      };
    }

    const keyPrefix = rawKey.slice(0, 16);
    const keyHash = hashApiKey(rawKey);

    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .select(
        "id, organisation_id, project_id, name, key_prefix, key_hash, status, scopes, expires_at"
      )
      .eq("key_prefix", keyPrefix)
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        status: 500,
        error: error.message,
        reason: "server_error",
      };
    }

    if (!data || data.key_hash !== keyHash) {
      return {
        ok: false,
        status: 401,
        error: "Invalid API key.",
        reason: "invalid_key",
      };
    }

    if (data.status !== "active") {
      return {
        ok: false,
        status: 403,
        error: "API key is not active.",
        reason: "key_inactive",
      };
    }

    if (data.expires_at) {
      const expiresAt = new Date(data.expires_at).getTime();

      if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
        return {
          ok: false,
          status: 403,
          error: "API key has expired.",
          reason: "key_expired",
        };
      }
    }

    const scopes = normaliseScopes(data.scopes);

    if (
      !hasRequiredScope({
        scopes,
        requiredScope: params.requiredScope,
      })
    ) {
      return {
        ok: false,
        status: 403,
        error: `API key does not have required scope: ${params.requiredScope}`,
        reason: "scope_denied",
      };
    }

    await supabaseAdmin
      .from("api_keys")
      .update({
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    return {
      ok: true,
      apiKey: {
        id: data.id,
        organisation_id: data.organisation_id,
        project_id: data.project_id,
        name: data.name,
        key_prefix: data.key_prefix,
        scopes,
        status: data.status,
      },
      organisationId: data.organisation_id,
      projectId: data.project_id,
      scopes,
    };
  } catch (error: any) {
    return {
      ok: false,
      status: 500,
      error: error?.message ?? "Failed to authenticate API key.",
      reason: "server_error",
    };
  }
}