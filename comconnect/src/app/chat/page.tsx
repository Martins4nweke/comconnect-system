"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LargeTableClient } from "@/components/comconnect-actions/LargeTableClient";
import {
  CompactCard,
  LinkButton,
  Notice,
  PageHeader,
  PageShell,
} from "@/components/comconnect-ui/DashboardUI";
import { StatusPill } from "@/components/comconnect-ui/StatusPill";

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

const config = {
  title: "Chat Threads",
  subtitle: "Two-way participant chat with conversation view and reply actions.",
  eyebrow: "Care",
  apiPath: "/api/large-table/chat",
  bulkApiPath: "/api/large-table/chat/bulk-action",
  parentHref: "/research-care/care",
  parentLabel: "Back to Care",
  breadcrumbs: [
    { label: "Research + Care", href: "/research-care" },
    { label: "Care", href: "/research-care/care" },
    { label: "Chat" },
  ],
  searchPlaceholder: "Search subject, status or last message...",
  allowBulkActions: true,
  statusOptions: ["open", "active", "assigned", "resolved", "closed", "archived"],
  columns: [
    {
      key: "participant",
      label: "Participant",
      render: (r: any) => (
        <div>
          <p className="font-black text-slate-800">
            {r.participant_label ?? r.participants?.participant_code ?? "—"}
          </p>
          <p className="text-xs font-bold text-slate-500">
            {r.participant_code ?? r.participants?.participant_code ?? "—"}
          </p>
        </div>
      ),
    },
    {
      key: "subject",
      label: "Subject",
      render: (r: any) => (
        <div>
          <p className="font-black text-slate-800">
            {r.thread_label ?? r.subject ?? "Participant message"}
          </p>
          <p className="text-xs font-bold text-slate-500">
            {r.last_message_preview ?? "—"}
          </p>
        </div>
      ),
    },
    {
      key: "conversation",
      label: "Conversation",
      render: (r: any) => (
        <Link
          href={`/chat/${r.id}`}
          className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-[#F26A21] hover:bg-[#FFF7F2]"
        >
          Open conversation →
        </Link>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: any) => <StatusPill value={r.status} />,
    },
    {
      key: "priority",
      label: "Priority",
      render: (r: any) => r.priority ?? "normal",
    },
    {
      key: "last",
      label: "Last message",
      render: (r: any) => dt(r.last_message_at ?? r.updated_at),
    },
  ],
};

export default function ChatPage() {
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
        eyebrow="Care"
        title="Chat"
        subtitle="View participant chat threads, open conversations and reply from the dashboard."
        actions={
          <>
            <LinkButton href="/inbox">Central Inbox</LinkButton>
            <LinkButton href="/research-care/care">Care</LinkButton>
            <LinkButton href="/">Dashboard</LinkButton>
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