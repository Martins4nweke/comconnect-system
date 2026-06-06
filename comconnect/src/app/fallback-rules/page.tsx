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
  return new Date(value).toLocaleString();
}

function text(value?: string | null, max = 80) {
  if (!value) return "—";
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function channelFlow(value: unknown) {
  if (!Array.isArray(value)) return "—";
  return value.map((item) => String(item)).join(" → ");
}

const config = {
  title: "Fallback Rules",
  subtitle:
    "Project-specific app → push → SMS → voice fallback rules with scoped status actions.",
  eyebrow: "Communication Operations",
  apiPath: "/api/large-table/fallback-rules",
  bulkApiPath: "/api/large-table/fallback-rules/bulk-action",
  parentHref: "/communication-operations",
  parentLabel: "Back to Communication Operations",
  breadcrumbs: [
    { label: "Research + Care", href: "/research-care" },
    { label: "Communication Operations", href: "/communication-operations" },
    { label: "Fallback Rules" },
  ],
  searchPlaceholder: "Search rule name, trigger or status...",
  allowBulkActions: true,
  statusOptions: ["active", "inactive", "archived"],
  columns: [
    {
      key: "name",
      label: "Rule",
      render: (r: any) => (
        <div>
          <p className="font-black text-slate-800">
            {text(r.rule_label ?? r.name, 60)}
          </p>
          <p className="text-xs font-bold text-slate-500">
            {r.trigger_event ?? "fallback"}
          </p>
        </div>
      ),
    },
    {
      key: "flow",
      label: "Flow",
      render: (r: any) => channelFlow(r.channel_flow),
    },
    {
      key: "status",
      label: "Status",
      render: (r: any) => (
        <StatusPill value={r.status ?? (r.enabled ? "active" : "inactive")} />
      ),
    },
    {
      key: "created",
      label: "Created",
      render: (r: any) => dt(r.created_at),
    },
  ],
};

export default function FallbackRulesPage() {
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
        title="Fallback Rules"
        subtitle="Review and manage how ComConnect moves communication from app/push to SMS and voice when delivery fails."
        actions={
          <>
            <LinkButton href="/push-queue">Push Queue</LinkButton>
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