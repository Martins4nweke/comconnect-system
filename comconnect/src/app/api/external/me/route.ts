import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { authenticateExternalApiKey } from "@/lib/external-api/authenticate-api-key";
import { logApiUsage } from "@/lib/api-usage/log-api-usage";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  const auth = await authenticateExternalApiKey({
    req,
    requiredScope: "participants:read",
  });

    if (auth.ok === false) {
    return fail(auth.error, auth.status);
  }

  await logApiUsage({
    organisationId: auth.organisationId,
    projectId: auth.projectId,
    apiKeyId: auth.apiKey.id,
    endpoint: "/api/external/me",
    method: "GET",
    statusCode: 200,
    durationMs: Date.now() - startedAt,
    requestSource: "external_api",
    paidChannel: false,
    metadata: {
      action: "external_api_key_test",
      result: "success",
      key_prefix: auth.apiKey.key_prefix,
      scopes: auth.scopes,
    },
  });

  return ok({
    authenticated: true,
    api_key: {
      id: auth.apiKey.id,
      name: auth.apiKey.name,
      key_prefix: auth.apiKey.key_prefix,
      status: auth.apiKey.status,
      scopes: auth.scopes,
    },
    organisation_id: auth.organisationId,
    project_id: auth.projectId,
    message:
      "External API key is valid. This route is for authentication testing only.",
  });
}