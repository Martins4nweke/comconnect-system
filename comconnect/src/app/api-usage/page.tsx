"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { VerticalAppShell } from "@/components/comconnect-ui/VerticalAppShell";
import { userCan } from "@/lib/comconnect-core/permissions";

export const dynamic = "force-dynamic";

type ApiUsageLog = {
  id: string;
  organisation_id: string;
  project_id: string | null;
  api_key_id: string | null;
  endpoint: string;
  method: string;
  status_code: number;
  duration_ms: number | null;
  request_source: string;
  channel: string | null;
  paid_channel: boolean;
  wallet_transaction_id: string | null;
  error_message: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
};

type ApiUsageData = {
  summary: {
    month_start: string;
    total_requests_this_month: number;
    failed_requests_this_month: number;
    paid_channel_sends_this_month: number;
  };
  breakdown: {
    recent_requests_by_endpoint: { endpoint: string; count: number }[];
    recent_requests_by_channel: { channel: string; count: number }[];
  };
  recent_logs: ApiUsageLog[];
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

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function statusClass(statusCode: number) {
  if (statusCode >= 500) {
    return "rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700";
  }

  if (statusCode >= 400) {
    return "rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700";
  }

  return "rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700";
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

export default function ApiUsagePage() {
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);

  const [data, setData] = useState<ApiUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canViewApiUsage = useMemo(() => {
    return userCan({
      organisationRole: context?.organisation_role ?? null,
      projectRole: context?.project_role ?? null,
      permission: "api:read",
    });
  }, [context?.organisation_role, context?.project_role]);

  async function loadContextAndUsage() {
    setContextLoading(true);
    setLoading(true);
    setError("");

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
        permission: "api:read",
      });

      if (
        currentContext.onboarding_required ||
        currentContext.access_pending ||
        !currentContext.organisation_id ||
        !allowed
      ) {
        setData(null);
        return;
      }

      const res = await fetch("/api/api-usage?limit=100", {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load API usage.");
      }

      setData(json.data ?? null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load API usage.");
    } finally {
      setContextLoading(false);
      setLoading(false);
    }
  }

  async function loadUsage() {
    setLoading(true);
    setError("");

    try {
      if (!context?.organisation_id) {
        setData(null);
        return;
      }

      if (!canViewApiUsage) {
        setData(null);
        return;
      }

      const res = await fetch("/api/api-usage?limit=100", {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load API usage.");
      }

      setData(json.data ?? null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load API usage.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContextAndUsage();
  }, []);

  const organisationName =
    context?.organisation_name ?? "ComConnect Organisation";
  const projectName = context?.active_project_name ?? "API Usage";
  const organisationRole = context?.organisation_role ?? "viewer";
  const projectRole = context?.project_role ?? "viewer";

  const summary = data?.summary;

  const cards = [
    {
      title: "Total API requests",
      value: summary?.total_requests_this_month ?? 0,
      description: "Total API requests logged this month.",
    },
    {
      title: "Failed requests",
      value: summary?.failed_requests_this_month ?? 0,
      description: "Requests with status code 400 or higher.",
    },
    {
      title: "Paid-channel sends",
      value: summary?.paid_channel_sends_this_month ?? 0,
      description: "SMS, voice or WhatsApp sends triggered through API.",
    },
    {
      title: "Month starts",
      value: summary?.month_start ? formatDate(summary.month_start) : "—",
      description: "Current usage reporting period.",
    },
  ];

  let guardedContent = null;

  if (contextLoading) {
    guardedContent = (
      <div className="rounded-[2rem] bg-white p-8 text-center text-sm font-black text-[#536271] shadow-sm">
        Loading API usage access...
      </div>
    );
  } else if (context?.onboarding_required || !context?.organisation_id) {
    guardedContent = (
      <AccessMessage
        title="No active organisation"
        message="This account is not linked to an active organisation. API usage can only be viewed after organisation access is active."
        href="/dashboard"
        linkText="Back to dashboard"
      />
    );
  } else if (context?.access_pending) {
    guardedContent = (
      <AccessMessage
        title="Organisation access pending"
        message="Your organisation access is still pending. API usage will become available after your membership is active."
        href="/dashboard"
        linkText="Back to dashboard"
      />
    );
  } else if (!canViewApiUsage) {
    guardedContent = (
      <AccessMessage
        title="You do not have API usage permission"
        message="Only users with API read permission can view API usage. Ask an organisation admin or developer admin to update your access."
        href="/dashboard"
        linkText="Back to dashboard"
      />
    );
  } else {
    guardedContent = (
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] bg-[#032A3D] p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#28A9E0]">
            API Usage
          </p>

          <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                Track API activity and billing impact
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/80">
                Review API request volume, failed requests, endpoint usage,
                channel usage and paid-channel API activity.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                Backend status
              </p>
              <p className="mt-2 text-xl font-black text-white">
                Connected to /api/api-usage
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-white/70">
                Usage logs will appear here once API logging is attached to
                routes.
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-[2rem] border border-[#C9D8E4] bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0A5278]">
                {card.title}
              </p>
              <p className="mt-3 text-2xl font-black text-[#06324A]">
                {loading ? "Loading..." : card.value}
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#536271]">
                {card.description}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
              Requests by endpoint
            </p>
            <h2 className="mt-3 text-2xl font-black text-[#06324A]">
              Recent endpoint usage
            </h2>

            <div className="mt-5 space-y-3">
              {loading ? (
                <p className="rounded-2xl bg-[#EAF2F8] px-4 py-3 text-sm font-bold text-[#536271]">
                  Loading endpoint usage...
                </p>
              ) : data?.breakdown.recent_requests_by_endpoint.length ? (
                data.breakdown.recent_requests_by_endpoint.map((item) => (
                  <div
                    key={item.endpoint}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] px-4 py-3"
                  >
                    <code className="text-xs font-black text-[#06324A]">
                      {item.endpoint}
                    </code>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#06324A]">
                      {item.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl bg-[#EAF2F8] px-4 py-3 text-sm font-bold text-[#536271]">
                  No endpoint usage logged yet.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
              Requests by channel
            </p>
            <h2 className="mt-3 text-2xl font-black text-[#06324A]">
              Recent channel usage
            </h2>

            <div className="mt-5 space-y-3">
              {loading ? (
                <p className="rounded-2xl bg-[#EAF2F8] px-4 py-3 text-sm font-bold text-[#536271]">
                  Loading channel usage...
                </p>
              ) : data?.breakdown.recent_requests_by_channel.length ? (
                data.breakdown.recent_requests_by_channel.map((item) => (
                  <div
                    key={item.channel}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] px-4 py-3"
                  >
                    <span className="text-sm font-black text-[#06324A]">
                      {item.channel}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#06324A]">
                      {item.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl bg-[#EAF2F8] px-4 py-3 text-sm font-bold text-[#536271]">
                  No channel usage logged yet.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                Recent API logs
              </p>
              <h2 className="mt-3 text-2xl font-black text-[#06324A]">
                Request log
              </h2>
            </div>

            <button
              type="button"
              onClick={loadUsage}
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
                  <th className="px-3 py-2">Endpoint</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Channel</th>
                  <th className="px-3 py-2">Paid</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Created</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] px-4 py-5 text-center font-bold text-[#536271]"
                    >
                      Loading API logs...
                    </td>
                  </tr>
                ) : data?.recent_logs.length ? (
                  data.recent_logs.map((item) => (
                    <tr key={item.id}>
                      <td className="rounded-l-2xl border-y border-l border-[#C9D8E4] bg-white px-3 py-3">
                        <code className="text-xs font-black text-[#06324A]">
                          {item.endpoint}
                        </code>
                      </td>
                      <td className="border-y border-[#C9D8E4] bg-white px-3 py-3 font-black text-[#06324A]">
                        {item.method}
                      </td>
                      <td className="border-y border-[#C9D8E4] bg-white px-3 py-3">
                        <span className={statusClass(item.status_code)}>
                          {item.status_code}
                        </span>
                      </td>
                      <td className="border-y border-[#C9D8E4] bg-white px-3 py-3 font-bold text-[#536271]">
                        {item.channel ?? "—"}
                      </td>
                      <td className="border-y border-[#C9D8E4] bg-white px-3 py-3 font-bold text-[#536271]">
                        {item.paid_channel ? "Yes" : "No"}
                      </td>
                      <td className="border-y border-[#C9D8E4] bg-white px-3 py-3 font-bold text-[#536271]">
                        {item.duration_ms ? `${item.duration_ms}ms` : "—"}
                      </td>
                      <td className="rounded-r-2xl border-y border-r border-[#C9D8E4] bg-white px-3 py-3 font-bold text-[#536271]">
                        {formatDate(item.created_at)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] px-4 py-5 text-center font-bold text-[#536271]"
                    >
                      No API usage logs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
            Safety reminder
          </p>
          <p className="mt-3 text-sm font-bold leading-6 text-[#536271]">
            This page reads API usage only. Actual usage logging will be
            attached gradually to API routes later. Paid-channel API sends must
            still pass subscription, wallet, channel enablement and billing
            guard checks.
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
              href="/webhooks"
              className="rounded-full border border-[#C9D8E4] bg-white px-5 py-3 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
            >
              Webhooks
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