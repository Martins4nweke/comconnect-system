"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { VerticalAppShell } from "@/components/comconnect-ui/VerticalAppShell";
import { userCan } from "@/lib/comconnect-core/permissions";

export const dynamic = "force-dynamic";

type WebhookRow = {
  id: string;
  organisation_id: string;
  project_id: string | null;
  name: string;
  url: string;
  event_types: string[];
  status: string;
  last_delivery_status: string | null;
  last_delivery_at: string | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

type CurrentContext = {
  user?: {
    email?: string | null;
    id?: string | null;
  };
  organisation_id?: string | null;
  organisation_name?: string | null;
  organisation_role?: string | null;
  organisation_membership_status?: string | null;
  active_project_id?: string | null;
  active_project_name?: string | null;
  project_role?: string | null;
  allowed_projects?: any[];
  onboarding_required?: boolean;
  access_pending?: boolean;
  dev_fallback?: boolean;
};

const availableEvents = [
  "message.queued",
  "message.sent",
  "message.delivered",
  "message.read",
  "message.failed",
  "message.cancelled",

  "push.queued",
  "push.sent",
  "push.delivered",
  "push.failed",

  "sms.queued",
  "sms.sent",
  "sms.delivered",
  "sms.failed",
  "sms.reply_received",

  "voice.queued",
  "voice.started",
  "voice.answered",
  "voice.completed",
  "voice.failed",
  "voice.no_answer",

  "whatsapp.queued",
  "whatsapp.sent",
  "whatsapp.delivered",
  "whatsapp.read",
  "whatsapp.failed",
  "whatsapp.reply_received",

  "reply.received",
  "participant.help_requested",
  "participant.synced",
  "participant.app_login",
  "participant.device_registered",

  "questionnaire.assigned",
  "questionnaire.started",
  "questionnaire.completed",
  "questionnaire.overdue",

  "education.assigned",
  "education.viewed",
  "media.opened",

  "appointment.created",
  "appointment.reminder_sent",
  "appointment.confirmed",
  "appointment.missed",
  "referral.created",
  "referral.completed",
  "referral.escalated",

  "billing.payment_submitted",
  "billing.payment_approved",
  "billing.payment_rejected",
  "billing.subscription_activated",
  "billing.subscription_expired",
  "billing.wallet_topup",
  "billing.wallet_low",
  "billing.wallet_debited",
  "billing.paid_channel_blocked",

  "api.key_created",
  "api.key_revoked",
  "api.request_failed",
  "webhook.failed",
];

const defaultEvents = ["message.delivered", "message.failed", "reply.received"];

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function AccessMessage({
  title,
  message,
  href,
  linkText,
}: {
  title: string;
  message: string;
  href?: string;
  linkText?: string;
}) {
  return (
    <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-[#0A5278]">
        Access check
      </p>
      <h2 className="mt-3 text-2xl font-black text-[#06324A]">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[#536271]">
        {message}
      </p>

      {href && linkText ? (
        <Link
          href={href}
          className="mt-5 inline-flex rounded-full bg-[#0A5278] px-5 py-3 text-sm font-black text-white hover:bg-[#063E5E]"
        >
          {linkText}
        </Link>
      ) : null}
    </div>
  );
}

export default function WebhooksPage() {
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);

  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(defaultEvents);
  const [createdSecret, setCreatedSecret] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const canManageWebhooks = useMemo(() => {
    return userCan({
      organisationRole: context?.organisation_role ?? null,
      projectRole: context?.project_role ?? null,
      permission: "webhooks:manage",
    });
  }, [context?.organisation_role, context?.project_role]);

  async function loadContextAndWebhooks() {
    setContextLoading(true);
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const contextResponse = await fetch("/api/context/current", {
        cache: "no-store",
      });

      const contextJson = await contextResponse.json().catch(() => null);

      if (!contextResponse.ok || !contextJson?.ok) {
        throw new Error(
          contextJson?.error ?? "Failed to load organisation/project context."
        );
      }

      const currentContext = contextJson.data as CurrentContext;
      setContext(currentContext);

      const allowed = userCan({
        organisationRole: currentContext.organisation_role ?? null,
        projectRole: currentContext.project_role ?? null,
        permission: "webhooks:manage",
      });

      if (
        currentContext.onboarding_required ||
        currentContext.access_pending ||
        !currentContext.organisation_id ||
        !allowed
      ) {
        setWebhooks([]);
        return;
      }

      const res = await fetch("/api/webhooks/config", {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load webhooks.");
      }

      setWebhooks(json.data?.webhooks ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load webhooks.");
    } finally {
      setContextLoading(false);
      setLoading(false);
    }
  }

  async function loadWebhooks() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (!context?.organisation_id) {
        setWebhooks([]);
        return;
      }

      if (!canManageWebhooks) {
        setWebhooks([]);
        return;
      }

      const res = await fetch("/api/webhooks/config", {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load webhooks.");
      }

      setWebhooks(json.data?.webhooks ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load webhooks.");
    } finally {
      setLoading(false);
    }
  }

  function toggleEvent(eventName: string) {
    setSelectedEvents((current) => {
      if (current.includes(eventName)) {
        const next = current.filter((item) => item !== eventName);
        return next.length > 0 ? next : current;
      }

      return [...current, eventName];
    });
  }

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(successMessage);
      setError("");
    } catch {
      setError("Could not copy. Please highlight and copy it manually.");
    }
  }

  async function createWebhook() {
    setCreating(true);
    setError("");
    setMessage("");
    setCreatedSecret("");

    try {
      if (!canManageWebhooks) {
        throw new Error("You are not allowed to manage webhooks.");
      }

      const cleanName = name.trim();
      const cleanUrl = url.trim();

      if (!cleanName) {
        throw new Error("Enter a name for this webhook.");
      }

      if (!cleanUrl) {
        throw new Error("Enter a webhook URL.");
      }

      const res = await fetch("/api/webhooks/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cleanName,
          url: cleanUrl,
          event_types: selectedEvents,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to create webhook.");
      }

      setCreatedSecret(json.data?.secret ?? "");
      setMessage(json.data?.message ?? "Webhook created.");
      setName("");
      setUrl("");
      setSelectedEvents(defaultEvents);
      await loadWebhooks();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create webhook.");
    } finally {
      setCreating(false);
    }
  }

  async function updateWebhookStatus(
    webhookId: string,
    action: "enable" | "disable"
  ) {
    setUpdatingId(webhookId);
    setError("");
    setMessage("");

    try {
      if (!canManageWebhooks) {
        throw new Error("You are not allowed to manage webhooks.");
      }

      const res = await fetch("/api/webhooks/config", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          webhook_id: webhookId,
          action,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to update webhook.");
      }

      setMessage(json.data?.message ?? "Webhook updated.");
      await loadWebhooks();
    } catch (err: any) {
      setError(err?.message ?? "Failed to update webhook.");
    } finally {
      setUpdatingId("");
    }
  }

  async function deleteWebhook(webhookId: string) {
    const confirmed = window.confirm(
      "Delete this webhook? Use this mainly for test webhooks. For production webhooks, disabling is safer."
    );

    if (!confirmed) return;

    setDeletingId(webhookId);
    setError("");
    setMessage("");

    try {
      if (!canManageWebhooks) {
        throw new Error("You are not allowed to manage webhooks.");
      }

      const res = await fetch(
        `/api/webhooks/config?webhook_id=${encodeURIComponent(webhookId)}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to delete webhook.");
      }

      setMessage(json.data?.message ?? "Webhook deleted.");
      await loadWebhooks();
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete webhook.");
    } finally {
      setDeletingId("");
    }
  }

  useEffect(() => {
    loadContextAndWebhooks();
  }, []);

  const organisationName =
    context?.organisation_name ?? "ComConnect Organisation";
  const projectName = context?.active_project_name ?? "Webhook Management";
  const organisationRole = context?.organisation_role ?? "viewer";
  const projectRole = context?.project_role ?? "viewer";

  let guardedContent = null;

  if (contextLoading) {
    guardedContent = (
      <div className="rounded-[2rem] bg-white p-8 text-center text-sm font-black text-[#536271] shadow-sm">
        Loading webhook access...
      </div>
    );
  } else if (context?.onboarding_required || !context?.organisation_id) {
    guardedContent = (
      <AccessMessage
        title="No active organisation"
        message="This account is not linked to an active organisation. Webhooks can only be managed after organisation access is active."
        href="/dashboard"
        linkText="Back to dashboard"
      />
    );
  } else if (context?.access_pending) {
    guardedContent = (
      <AccessMessage
        title="Organisation access pending"
        message="Your organisation access is still pending. Webhooks will become available after your membership is active."
        href="/dashboard"
        linkText="Back to dashboard"
      />
    );
  } else if (!canManageWebhooks) {
    guardedContent = (
      <AccessMessage
        title="You do not have webhook permission"
        message="Only users with webhook management permission can create, enable, disable or delete webhooks. Ask an organisation admin or developer admin to update your access."
        href="/dashboard"
        linkText="Back to dashboard"
      />
    );
  } else {
    guardedContent = (
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] bg-[#032A3D] p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#28A9E0]">
            Webhooks
          </p>

          <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                Configure event notifications
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/80">
                Create organisation-scoped webhook endpoints for delivery
                events, replies, participant help requests and billing events.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                Backend status
              </p>
              <p className="mt-2 text-xl font-black text-white">
                Connected to /api/webhooks/config
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-white/70">
                Secrets are shown only once after creation. Event delivery will
                be added later.
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">
            {message}
          </div>
        ) : null}

        {createdSecret ? (
          <section className="rounded-[2rem] border border-orange-200 bg-orange-50 p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">
              Copy now
            </p>
            <h2 className="mt-3 text-2xl font-black text-[#06324A]">
              New webhook secret
            </h2>
            <p className="mt-2 text-sm font-bold text-[#536271]">
              This full secret will not be shown again.
            </p>

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
              <code className="block flex-1 overflow-x-auto rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#06324A]">
                {createdSecret}
              </code>

              <button
                type="button"
                onClick={() =>
                  copyText(createdSecret, "Webhook secret copied to clipboard.")
                }
                className="rounded-full bg-[#0A5278] px-5 py-3 text-sm font-black text-white hover:bg-[#063E5E]"
              >
                Copy secret
              </button>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
              Create webhook
            </p>
            <h2 className="mt-3 text-2xl font-black text-[#06324A]">
              New endpoint
            </h2>

            <label className="mt-5 block text-sm font-black text-[#06324A]">
              Webhook name
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Example: University CRM webhook"
              className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
            />

            <label className="mt-5 block text-sm font-black text-[#06324A]">
              Webhook URL
            </label>
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/comconnect/webhook"
              className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
            />

            <div className="mt-4 rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                Event types
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {availableEvents.map((eventName) => {
                  const selected = selectedEvents.includes(eventName);

                  return (
                    <button
                      key={eventName}
                      type="button"
                      onClick={() => toggleEvent(eventName)}
                      className={
                        selected
                          ? "rounded-full bg-[#0A5278] px-3 py-2 text-xs font-black text-white"
                          : "rounded-full bg-white px-3 py-2 text-xs font-black text-[#06324A]"
                      }
                    >
                      {eventName}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={createWebhook}
              disabled={creating}
              className="mt-5 rounded-full bg-[#0A5278] px-6 py-3 text-sm font-black text-white hover:bg-[#063E5E] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create webhook"}
            </button>
          </div>

          <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                  Existing webhooks
                </p>
                <h2 className="mt-3 text-2xl font-black text-[#06324A]">
                  Webhook endpoints
                </h2>
              </div>

              <button
                type="button"
                onClick={loadWebhooks}
                disabled={loading}
                className="rounded-full border border-[#C9D8E4] bg-white px-5 py-3 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-left text-sm">
                <thead>
                  <tr className="text-xs font-black uppercase tracking-[0.16em] text-[#536271]">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">URL</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Events</th>
                    <th className="px-3 py-2">Last delivery</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] px-4 py-5 text-center font-bold text-[#536271]"
                      >
                        Loading webhooks...
                      </td>
                    </tr>
                  ) : webhooks.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] px-4 py-5 text-center font-bold text-[#536271]"
                      >
                        No webhook endpoints found.
                      </td>
                    </tr>
                  ) : (
                    webhooks.map((item) => (
                      <tr key={item.id}>
                        <td className="rounded-l-2xl border-y border-l border-[#C9D8E4] bg-white px-3 py-3 font-black text-[#06324A]">
                          {item.name}
                        </td>
                        <td className="max-w-[260px] border-y border-[#C9D8E4] bg-white px-3 py-3">
                          <code className="block truncate text-xs font-bold text-[#536271]">
                            {item.url}
                          </code>
                        </td>
                        <td className="border-y border-[#C9D8E4] bg-white px-3 py-3">
                          <span
                            className={
                              item.status === "active"
                                ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700"
                                : item.status === "disabled"
                                  ? "rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700"
                                  : "rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700"
                            }
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="border-y border-[#C9D8E4] bg-white px-3 py-3">
                          <div className="flex max-w-[260px] flex-wrap gap-1">
                            {(item.event_types ?? []).map((eventName) => (
                              <span
                                key={eventName}
                                className="rounded-full bg-[#EAF2F8] px-2 py-1 text-[11px] font-black text-[#06324A]"
                              >
                                {eventName}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="border-y border-[#C9D8E4] bg-white px-3 py-3 font-bold text-[#536271]">
                          {item.last_delivery_status ?? "—"}
                          <div className="text-[11px] font-semibold">
                            {formatDate(item.last_delivery_at)}
                          </div>
                        </td>
                        <td className="border-y border-[#C9D8E4] bg-white px-3 py-3 font-bold text-[#536271]">
                          {formatDate(item.created_at)}
                        </td>
                        <td className="rounded-r-2xl border-y border-r border-[#C9D8E4] bg-white px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            {item.status === "active" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  updateWebhookStatus(item.id, "disable")
                                }
                                disabled={updatingId === item.id}
                                className="rounded-full bg-orange-500 px-4 py-2 text-xs font-black text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {updatingId === item.id
                                  ? "Updating..."
                                  : "Disable"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  updateWebhookStatus(item.id, "enable")
                                }
                                disabled={updatingId === item.id}
                                className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {updatingId === item.id
                                  ? "Updating..."
                                  : "Enable"}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => deleteWebhook(item.id)}
                              disabled={deletingId === item.id}
                              className="rounded-full bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deletingId === item.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
            Safety reminder
          </p>
          <p className="mt-3 text-sm font-bold leading-6 text-[#536271]">
            This page manages webhook configuration only. It does not send
            webhook events yet. Event delivery, retry, signing and usage logging
            will be added later.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/app-api"
              className="rounded-full bg-[#0A5278] px-5 py-3 text-sm font-black text-white hover:bg-[#063E5E]"
            >
              Developer API
            </Link>
            <Link
              href="/api-keys"
              className="rounded-full border border-[#C9D8E4] bg-white px-5 py-3 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
            >
              API Keys
            </Link>
            <Link
              href="/api-usage"
              className="rounded-full border border-[#C9D8E4] bg-white px-5 py-3 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
            >
              API Usage
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <VerticalAppShell
      organisationName={organisationName}
      projectName={projectName}
      organisationRole={organisationRole}
      projectRole={projectRole}
    >
      <main className="min-h-screen bg-[#EAF2F8] px-4 py-5 text-[#06324A]">
        {guardedContent}
      </main>
    </VerticalAppShell>
  );
}