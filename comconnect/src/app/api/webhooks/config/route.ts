import { NextRequest } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { logApiUsage } from "@/lib/api-usage/log-api-usage";

export const runtime = "nodejs";

const WEBHOOK_ADMIN_ROLES = new Set([
  "platform_owner",
  "superadmin",
  "organisation_admin",
  "developer_admin",
]);

const DEFAULT_EVENTS = ["message.delivered", "message.failed", "reply.received"];

const ALLOWED_EVENTS = new Set([
  // App and general message delivery
  "message.queued",
  "message.sent",
  "message.delivered",
  "message.read",
  "message.failed",
  "message.cancelled",

  // Push notification
  "push.queued",
  "push.sent",
  "push.delivered",
  "push.failed",

  // SMS
  "sms.queued",
  "sms.sent",
  "sms.delivered",
  "sms.failed",
  "sms.reply_received",

  // Voice
  "voice.queued",
  "voice.started",
  "voice.answered",
  "voice.completed",
  "voice.failed",
  "voice.no_answer",

  // WhatsApp
  "whatsapp.queued",
  "whatsapp.sent",
  "whatsapp.delivered",
  "whatsapp.read",
  "whatsapp.failed",
  "whatsapp.reply_received",

  // Participant replies and app activity
  "reply.received",
  "participant.help_requested",
  "participant.synced",
  "participant.app_login",
  "participant.device_registered",

  // Questionnaires and forms
  "questionnaire.assigned",
  "questionnaire.started",
  "questionnaire.completed",
  "questionnaire.overdue",

  // Education and media
  "education.assigned",
  "education.viewed",
  "media.opened",

  // Care workflow
  "appointment.created",
  "appointment.reminder_sent",
  "appointment.confirmed",
  "appointment.missed",
  "referral.created",
  "referral.completed",
  "referral.escalated",

  // Billing and wallet
  "billing.payment_submitted",
  "billing.payment_approved",
  "billing.payment_rejected",
  "billing.subscription_activated",
  "billing.subscription_expired",
  "billing.wallet_topup",
  "billing.wallet_low",
  "billing.wallet_debited",
  "billing.paid_channel_blocked",

  // API and system
  "api.key_created",
  "api.key_revoked",
  "api.request_failed",
  "webhook.failed",
]);

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function isWebhookAdmin(role?: string | null) {
  return WEBHOOK_ADMIN_ROLES.has(cleanText(role).toLowerCase());
}

function normaliseEvents(value: unknown) {
  if (!Array.isArray(value)) return DEFAULT_EVENTS;

  const events = value
    .map((item) => cleanText(item))
    .filter((item) => ALLOWED_EVENTS.has(item));

  return events.length > 0 ? Array.from(new Set(events)) : DEFAULT_EVENTS;
}

function generateWebhookSecret() {
  return `whsec_${crypto.randomBytes(32).toString("hex")}`;
}

function validateWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol);
  } catch {
    return false;
  }
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

async function requireWebhookAdmin() {
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

  if (!isWebhookAdmin(membership.role)) {
    return {
      ok: false as const,
      error: "Only organisation admins or developer admins can manage webhooks.",
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

async function logWebhooksRouteUsage(params: {
  organisationId: string;
  method: string;
  statusCode: number;
  startedAt: number;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await logApiUsage({
    organisationId: params.organisationId,
    endpoint: "/api/webhooks/config",
    method: params.method,
    statusCode: params.statusCode,
    durationMs: Date.now() - params.startedAt,
    requestSource: "dashboard",
    channel: "webhook",
    paidChannel: false,
    errorMessage: params.errorMessage ?? null,
    metadata: params.metadata ?? {},
  });
}

export async function GET() {
  const startedAt = Date.now();

  try {
    const auth = await requireWebhookAdmin();

    if (!auth.ok) {
      return fail(auth.error, auth.status);
    }

    const { data, error } = await supabaseAdmin
      .from("webhooks")
      .select(
        "id, organisation_id, project_id, name, url, event_types, status, last_delivery_status, last_delivery_at, last_error, created_by, created_at, updated_at, metadata"
      )
      .eq("organisation_id", auth.membership.organisation_id)
      .order("created_at", { ascending: false });

    if (error) {
      await logWebhooksRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "GET",
        statusCode: 500,
        startedAt,
        errorMessage: error.message,
        metadata: {
          action: "list_webhooks",
          result: "failed",
        },
      });

      return fail(error.message, 500);
    }

    await logWebhooksRouteUsage({
      organisationId: auth.membership.organisation_id,
      method: "GET",
      statusCode: 200,
      startedAt,
      metadata: {
        action: "list_webhooks",
        result: "success",
        count: data?.length ?? 0,
      },
    });

    return ok({
      webhooks: data ?? [],
      allowed_events: Array.from(ALLOWED_EVENTS),
      default_events: DEFAULT_EVENTS,
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load webhooks.", 500);
  }
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const auth = await requireWebhookAdmin();

    if (!auth.ok) {
      return fail(auth.error, auth.status);
    }

    const body = await req.json().catch(() => null);

    const name = cleanText(body?.name);
    const url = cleanText(body?.url);
    const projectId = cleanText(body?.project_id);
    const eventTypes = normaliseEvents(body?.event_types);

    if (!name) {
      await logWebhooksRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "POST",
        statusCode: 400,
        startedAt,
        errorMessage: "Webhook name is required.",
        metadata: {
          action: "create_webhook",
          result: "validation_failed",
        },
      });

      return fail("Webhook name is required.", 400);
    }

    if (name.length > 120) {
      await logWebhooksRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "POST",
        statusCode: 400,
        startedAt,
        errorMessage: "Webhook name must be 120 characters or less.",
        metadata: {
          action: "create_webhook",
          result: "validation_failed",
          name_length: name.length,
        },
      });

      return fail("Webhook name must be 120 characters or less.", 400);
    }

    if (!url) {
      await logWebhooksRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "POST",
        statusCode: 400,
        startedAt,
        errorMessage: "Webhook URL is required.",
        metadata: {
          action: "create_webhook",
          result: "validation_failed",
        },
      });

      return fail("Webhook URL is required.", 400);
    }

    if (!validateWebhookUrl(url)) {
      await logWebhooksRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "POST",
        statusCode: 400,
        startedAt,
        errorMessage: "Webhook URL must be a valid http or https URL.",
        metadata: {
          action: "create_webhook",
          result: "validation_failed",
          url,
        },
      });

      return fail("Webhook URL must be a valid http or https URL.", 400);
    }

    if (projectId) {
      const projectAllowed = await ensureProjectBelongsToOrganisation({
        organisationId: auth.membership.organisation_id,
        projectId,
      });

      if (!projectAllowed) {
        await logWebhooksRouteUsage({
          organisationId: auth.membership.organisation_id,
          method: "POST",
          statusCode: 403,
          startedAt,
          errorMessage: "Project not found for this organisation.",
          metadata: {
            action: "create_webhook",
            result: "project_denied",
            project_id: projectId,
          },
        });

        return fail("Project not found for this organisation.", 403);
      }
    }

    const secret = generateWebhookSecret();

    const { data, error } = await supabaseAdmin
      .from("webhooks")
      .insert({
        organisation_id: auth.membership.organisation_id,
        project_id: projectId || null,
        name,
        url,
        event_types: eventTypes,
        secret,
        status: "active",
        created_by: auth.user.id,
        metadata: {
          created_by_email: cleanText(auth.user.email).toLowerCase(),
          created_from: "webhooks_page",
          secret_shown_once: true,
        },
      })
      .select(
        "id, organisation_id, project_id, name, url, event_types, status, last_delivery_status, last_delivery_at, last_error, created_by, created_at, updated_at, metadata"
      )
      .single();

    if (error) {
      await logWebhooksRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "POST",
        statusCode: 500,
        startedAt,
        errorMessage: error.message,
        metadata: {
          action: "create_webhook",
          result: "failed",
          name,
          project_id: projectId || null,
          event_types: eventTypes,
        },
      });

      return fail(error.message, 500);
    }

    await logWebhooksRouteUsage({
      organisationId: auth.membership.organisation_id,
      method: "POST",
      statusCode: 201,
      startedAt,
      metadata: {
        action: "create_webhook",
        result: "success",
        webhook_id: data.id,
        project_id: data.project_id,
        event_types: data.event_types,
      },
    });

    return ok(
      {
        webhook: data,
        secret,
        message:
          "Webhook created. Copy the secret now because it will not be shown again.",
      },
      201
    );
  } catch (error: any) {
    return fail(error?.message ?? "Failed to create webhook.", 500);
  }
}

export async function PATCH(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const auth = await requireWebhookAdmin();

    if (!auth.ok) {
      return fail(auth.error, auth.status);
    }

    const body = await req.json().catch(() => null);

    const webhookId = cleanText(body?.webhook_id);
    const action = cleanText(body?.action).toLowerCase();

    if (!webhookId) {
      await logWebhooksRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "PATCH",
        statusCode: 400,
        startedAt,
        errorMessage: "webhook_id is required.",
        metadata: {
          action: "update_webhook",
          result: "validation_failed",
        },
      });

      return fail("webhook_id is required.", 400);
    }

    if (!["enable", "disable"].includes(action)) {
      await logWebhooksRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "PATCH",
        statusCode: 400,
        startedAt,
        errorMessage: "action must be enable or disable.",
        metadata: {
          action: "update_webhook",
          requested_action: action,
          result: "validation_failed",
          webhook_id: webhookId,
        },
      });

      return fail("action must be enable or disable.", 400);
    }

    const status = action === "enable" ? "active" : "disabled";

    const { data, error } = await supabaseAdmin
      .from("webhooks")
      .update({
        status,
        updated_at: new Date().toISOString(),
        metadata: {
          updated_from: "webhooks_page",
          updated_by: auth.user.id,
          updated_by_email: cleanText(auth.user.email).toLowerCase(),
          updated_action: action,
          updated_at: new Date().toISOString(),
        },
      })
      .eq("id", webhookId)
      .eq("organisation_id", auth.membership.organisation_id)
      .select(
        "id, organisation_id, project_id, name, url, event_types, status, last_delivery_status, last_delivery_at, last_error, created_by, created_at, updated_at, metadata"
      )
      .maybeSingle();

    if (error) {
      await logWebhooksRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "PATCH",
        statusCode: 500,
        startedAt,
        errorMessage: error.message,
        metadata: {
          action: "update_webhook",
          result: "failed",
          webhook_id: webhookId,
          requested_status: status,
        },
      });

      return fail(error.message, 500);
    }

    if (!data) {
      await logWebhooksRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "PATCH",
        statusCode: 404,
        startedAt,
        errorMessage: "Webhook not found for this organisation.",
        metadata: {
          action: "update_webhook",
          result: "not_found",
          webhook_id: webhookId,
          requested_status: status,
        },
      });

      return fail("Webhook not found for this organisation.", 404);
    }

    await logWebhooksRouteUsage({
      organisationId: auth.membership.organisation_id,
      method: "PATCH",
      statusCode: 200,
      startedAt,
      metadata: {
        action: "update_webhook",
        result: "success",
        webhook_id: data.id,
        status: data.status,
      },
    });

    return ok({
      webhook: data,
      message: `Webhook ${status}.`,
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to update webhook.", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const auth = await requireWebhookAdmin();

    if (!auth.ok) {
      return fail(auth.error, auth.status);
    }

    const url = new URL(req.url);
    const webhookId = cleanText(url.searchParams.get("webhook_id"));

    if (!webhookId) {
      await logWebhooksRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "DELETE",
        statusCode: 400,
        startedAt,
        errorMessage: "webhook_id is required.",
        metadata: {
          action: "delete_webhook",
          result: "validation_failed",
        },
      });

      return fail("webhook_id is required.", 400);
    }

    const { data, error } = await supabaseAdmin
      .from("webhooks")
      .delete()
      .eq("id", webhookId)
      .eq("organisation_id", auth.membership.organisation_id)
      .select("id, name")
      .maybeSingle();

    if (error) {
      await logWebhooksRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "DELETE",
        statusCode: 500,
        startedAt,
        errorMessage: error.message,
        metadata: {
          action: "delete_webhook",
          result: "failed",
          webhook_id: webhookId,
        },
      });

      return fail(error.message, 500);
    }

    if (!data) {
      await logWebhooksRouteUsage({
        organisationId: auth.membership.organisation_id,
        method: "DELETE",
        statusCode: 404,
        startedAt,
        errorMessage: "Webhook not found for this organisation.",
        metadata: {
          action: "delete_webhook",
          result: "not_found",
          webhook_id: webhookId,
        },
      });

      return fail("Webhook not found for this organisation.", 404);
    }

    await logWebhooksRouteUsage({
      organisationId: auth.membership.organisation_id,
      method: "DELETE",
      statusCode: 200,
      startedAt,
      metadata: {
        action: "delete_webhook",
        result: "success",
        webhook_id: data.id,
        name: data.name,
      },
    });

    return ok({
      deleted_webhook: data,
      message: "Webhook deleted.",
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to delete webhook.", 500);
  }
}