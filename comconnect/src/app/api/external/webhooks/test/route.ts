import { NextRequest } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { authenticateExternalApiKey } from "@/lib/external-api/authenticate-api-key";
import { logApiUsage } from "@/lib/api-usage/log-api-usage";

export const runtime = "nodejs";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function createWebhookSignature(params: {
  secret: string;
  timestamp: string;
  bodyText: string;
}) {
  return crypto
    .createHmac("sha256", params.secret)
    .update(`${params.timestamp}.${params.bodyText}`)
    .digest("hex");
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
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

async function sendWebhookTest(params: {
  url: string;
  secret: string;
  payload: Record<string, unknown>;
}) {
  const timestamp = new Date().toISOString();
  const bodyText = JSON.stringify(params.payload);
  const signature = createWebhookSignature({
    secret: params.secret,
    timestamp,
    bodyText,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(params.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ComConnect-Webhook-Test",
        "x-comconnect-event": "webhook.test",
        "x-comconnect-timestamp": timestamp,
        "x-comconnect-signature": signature,
        "x-comconnect-signature-version": "v1",
      },
      body: bodyText,
      signal: controller.signal,
    });

    const responseText = await response.text().catch(() => "");

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      responseText: responseText.slice(0, 3000),
      timestamp,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  const auth = await authenticateExternalApiKey({
    req,
    requiredScope: "webhooks:write",
  });

  if (auth.ok === false) {
    return fail(auth.error, auth.status);
  }

  try {
    const body = await req.json().catch(() => null);

    const webhookId = cleanText(body?.webhook_id);

    if (!webhookId) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId: auth.projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/webhooks/test",
        method: "POST",
        statusCode: 400,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        channel: "webhook",
        paidChannel: false,
        errorMessage: "webhook_id is required.",
        metadata: {
          action: "external_test_webhook",
          result: "validation_failed",
          key_prefix: auth.apiKey.key_prefix,
        },
      });

      return fail("webhook_id is required.", 400);
    }

    const { data: webhook, error: webhookError } = await supabaseAdmin
      .from("webhooks")
      .select(
        "id, organisation_id, project_id, name, url, event_types, secret, status, last_delivery_status, last_delivery_at, last_error, created_at, updated_at, metadata"
      )
      .eq("id", webhookId)
      .eq("organisation_id", auth.organisationId)
      .maybeSingle();

    if (webhookError) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId: auth.projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/webhooks/test",
        method: "POST",
        statusCode: 500,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        channel: "webhook",
        paidChannel: false,
        errorMessage: webhookError.message,
        metadata: {
          action: "external_test_webhook",
          result: "webhook_lookup_failed",
          key_prefix: auth.apiKey.key_prefix,
          webhook_id: webhookId,
        },
      });

      return fail(webhookError.message, 500);
    }

    if (!webhook) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId: auth.projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/webhooks/test",
        method: "POST",
        statusCode: 404,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        channel: "webhook",
        paidChannel: false,
        errorMessage: "Webhook not found for this organisation.",
        metadata: {
          action: "external_test_webhook",
          result: "not_found",
          key_prefix: auth.apiKey.key_prefix,
          webhook_id: webhookId,
        },
      });

      return fail("Webhook not found for this organisation.", 404);
    }

    if (
      auth.projectId &&
      webhook.project_id &&
      webhook.project_id !== auth.projectId
    ) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId: auth.projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/webhooks/test",
        method: "POST",
        statusCode: 403,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        channel: "webhook",
        paidChannel: false,
        errorMessage: "Webhook is outside this API key project scope.",
        metadata: {
          action: "external_test_webhook",
          result: "project_denied",
          key_prefix: auth.apiKey.key_prefix,
          webhook_id: webhookId,
          webhook_project_id: webhook.project_id,
        },
      });

      return fail("Webhook is outside this API key project scope.", 403);
    }

    if (webhook.status !== "active") {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId: webhook.project_id ?? auth.projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/webhooks/test",
        method: "POST",
        statusCode: 403,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        channel: "webhook",
        paidChannel: false,
        errorMessage: "Webhook is not active.",
        metadata: {
          action: "external_test_webhook",
          result: "webhook_inactive",
          key_prefix: auth.apiKey.key_prefix,
          webhook_id: webhookId,
          webhook_status: webhook.status,
        },
      });

      return fail("Webhook is not active.", 403);
    }

    if (!webhook.secret) {
      await logApiUsage({
        organisationId: auth.organisationId,
        projectId: webhook.project_id ?? auth.projectId,
        apiKeyId: auth.apiKey.id,
        endpoint: "/api/external/webhooks/test",
        method: "POST",
        statusCode: 500,
        durationMs: Date.now() - startedAt,
        requestSource: "external_api",
        channel: "webhook",
        paidChannel: false,
        errorMessage: "Webhook secret is missing.",
        metadata: {
          action: "external_test_webhook",
          result: "missing_secret",
          key_prefix: auth.apiKey.key_prefix,
          webhook_id: webhookId,
        },
      });

      return fail("Webhook secret is missing.", 500);
    }

    const payload = {
      event: "webhook.test",
      test: true,
      sent_at: new Date().toISOString(),
      organisation_id: auth.organisationId,
      project_id: webhook.project_id ?? auth.projectId ?? null,
      webhook_id: webhook.id,
      webhook_name: webhook.name,
      api_key_prefix: auth.apiKey.key_prefix,
      message:
        "This is a ComConnect webhook test event. It does not represent a real participant message.",
      data: {
        sample_status: "ok",
        sample_channel: "webhook",
      },
    };

    const result = await sendWebhookTest({
      url: webhook.url,
      secret: webhook.secret,
      payload,
    });

    await supabaseAdmin
      .from("webhooks")
      .update({
        last_delivery_status: result.ok ? "test_success" : "test_failed",
        last_delivery_at: result.timestamp,
        last_error: result.ok
          ? null
          : `${result.status} ${result.statusText}`.trim(),
        updated_at: new Date().toISOString(),
        metadata: {
          ...(webhook.metadata ?? {}),
          last_test: {
            ok: result.ok,
            status: result.status,
            status_text: result.statusText,
            tested_at: result.timestamp,
            tested_by_api_key_id: auth.apiKey.id,
            tested_by_api_key_prefix: auth.apiKey.key_prefix,
          },
        },
      })
      .eq("id", webhook.id);

    await logApiUsage({
      organisationId: auth.organisationId,
      projectId: webhook.project_id ?? auth.projectId,
      apiKeyId: auth.apiKey.id,
      endpoint: "/api/external/webhooks/test",
      method: "POST",
      statusCode: result.ok ? 200 : 502,
      durationMs: Date.now() - startedAt,
      requestSource: "external_api",
      channel: "webhook",
      paidChannel: false,
      errorMessage: result.ok
        ? null
        : `Webhook test failed with status ${result.status}.`,
      metadata: {
        action: "external_test_webhook",
        result: result.ok ? "success" : "failed",
        key_prefix: auth.apiKey.key_prefix,
        webhook_id: webhook.id,
        webhook_status: result.status,
        webhook_status_text: result.statusText,
      },
    });

    if (!result.ok) {
      return fail(
        `Webhook test request failed with status ${result.status}.`,
        502
      );
    }

    return ok({
      webhook: safeWebhook({
        ...webhook,
        last_delivery_status: "test_success",
        last_delivery_at: result.timestamp,
        last_error: null,
      }),
      delivery: {
        ok: result.ok,
        status: result.status,
        status_text: result.statusText,
        response_preview: result.responseText,
      },
      message: "Webhook test event sent successfully.",
    });
  } catch (error: any) {
    await logApiUsage({
      organisationId: auth.organisationId,
      projectId: auth.projectId,
      apiKeyId: auth.apiKey.id,
      endpoint: "/api/external/webhooks/test",
      method: "POST",
      statusCode: 500,
      durationMs: Date.now() - startedAt,
      requestSource: "external_api",
      channel: "webhook",
      paidChannel: false,
      errorMessage: error?.message ?? "Failed to send webhook test.",
      metadata: {
        action: "external_test_webhook",
        result: "exception",
        key_prefix: auth.apiKey.key_prefix,
      },
    });

    return fail(error?.message ?? "Failed to send webhook test.", 500);
  }
}