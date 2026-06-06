"use client";

import { useEffect, useState } from "react";
import { LargeTableClient } from "@/components/comconnect-actions/LargeTableClient";
import { StatusPill } from "@/components/comconnect-ui/StatusPill";
import {
  CompactCard,
  LinkButton,
  Notice,
  PageHeader,
  PageShell,
} from "@/components/comconnect-ui/DashboardUI";

type CurrentContext = {
  organisation_id?: string | null;
  organisation_name?: string | null;
  organisation_role?: string | null;
  active_project_id?: string | null;
  active_project_name?: string | null;
  active_project_code?: string | null;
  project_role?: string | null;
};

function dt(value?: string | null) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function text(value?: string | null, max = 90) {
  if (!value) return "—";
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

const config = {
  title: "Push Queue",
  subtitle:
    "Privacy-safe app notification queue with scoped retry, cancel and archive actions.",
  eyebrow: "Communication Operations",
  apiPath: "/api/large-table/push-queue",
  bulkApiPath: "/api/large-table/push-queue/bulk-action",
  parentHref: "/communication-operations",
  parentLabel: "Back to Communication Operations",
  breadcrumbs: [
    { label: "Research + Care", href: "/research-care" },
    { label: "Communication Operations", href: "/communication-operations" },
    { label: "Push Queue" },
  ],
  searchPlaceholder: "Search push title, body, status or error...",
  allowBulkActions: true,
  statusOptions: [
    "pending",
    "processing",
    "sent",
    "failed",
    "cancelled",
    "archived",
  ],
  columns: [
    {
      key: "participant",
      label: "Participant",
      render: (r: any) => (
        <div>
          <p className="font-black text-slate-800">
            {r.participant_label ??
              r.participants?.metadata?.display_name ??
              r.participants?.participant_code ??
              "—"}
          </p>
          <p className="text-xs font-bold text-slate-500">
            {r.participant_code ?? r.participants?.participant_code ?? "—"}
          </p>
        </div>
      ),
    },
    {
      key: "message",
      label: "Message",
      render: (r: any) => (
        <div>
          <p className="font-black text-slate-800">
            {text(r.push_title_label ?? r.title, 70)}
          </p>
          <p className="text-xs font-bold text-slate-500">
            {text(r.push_body_preview ?? r.body, 100)}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: any) => <StatusPill value={r.push_status_label ?? r.status} />,
    },
    {
      key: "attempts",
      label: "Attempts",
      render: (r: any) => r.attempt_count ?? r.attempts ?? 0,
    },
    {
      key: "scheduled",
      label: "Scheduled",
      render: (r: any) => dt(r.scheduled_for ?? r.next_attempt_at),
    },
    {
      key: "created",
      label: "Created",
      render: (r: any) => dt(r.created_at),
    },
  ],
};

export default function PushQueuePage() {
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadContext() {
    setLoadingContext(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/context/current", {
        cache: "no-store",
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load context.");
      }

      setContext(json.data as CurrentContext);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to load context.");
    } finally {
      setLoadingContext(false);
    }
  }

  useEffect(() => {
    void loadContext();
  }, []);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Communication Operations"
        title="Push Queue"
        subtitle="Review app push notifications without exposing raw push tokens or device secrets."
        actions={
          <>
            <LinkButton href="/fallback-rules">Fallback Rules</LinkButton>
            <LinkButton href="/delivery-logs">Delivery Logs</LinkButton>
            <LinkButton href="/communication-operations">
              Communication Operations
            </LinkButton>
          </>
        }
      />

      {errorMessage ? <Notice tone="danger">{errorMessage}</Notice> : null}

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <CompactCard>
          <p className="text-xs font-black uppercase text-slate-500">
            Organisation
          </p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {loadingContext ? "Loading..." : context?.organisation_name ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-slate-500">Project</p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {loadingContext ? "Loading..." : context?.active_project_name ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-slate-500">
            Project Code
          </p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {context?.active_project_code ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-slate-500">Role</p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {context?.project_role ?? context?.organisation_role ?? "—"}
          </p>
        </CompactCard>
      </div>

      <LargeTableClient config={config as any} />
    </PageShell>
  );
}