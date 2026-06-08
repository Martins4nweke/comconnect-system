"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { LargeTableClient } from "@/components/comconnect-actions/LargeTableClient";
import { Notice, PageShell } from "@/components/comconnect-ui/DashboardUI";
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

function PageLinkButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-full border border-[#C9D8E4] bg-white px-4 py-2 text-xs font-black text-[#06324A] shadow-sm transition hover:border-[#0A5278] hover:bg-[#0A5278] hover:text-white"
    >
      {children}
    </Link>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
        {label}
      </p>
      <p className="mt-2 text-sm font-black text-[#06324A]">{value}</p>
    </div>
  );
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
          <p className="font-black text-[#06324A]">
            {r.participant_label ?? r.participants?.participant_code ?? "—"}
          </p>
          <p className="text-xs font-bold text-[#536271]">
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
          <p className="font-black text-[#06324A]">
            {r.thread_label ?? r.subject ?? "Participant message"}
          </p>
          <p className="text-xs font-bold text-[#536271]">
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
          className="inline-flex rounded-xl border border-[#C9D8E4] bg-white px-3 py-2 text-sm font-black text-[#06324A] transition hover:border-[#0A5278] hover:bg-[#EAF2F8]"
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
      render: (r: any) => (
        <span className="font-bold text-[#536271]">{r.priority ?? "normal"}</span>
      ),
    },
    {
      key: "last",
      label: "Last message",
      render: (r: any) => (
        <span className="font-bold text-[#536271]">
          {dt(r.last_message_at ?? r.updated_at)}
        </span>
      ),
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
      <div className="space-y-5">
        <section className="rounded-[2rem] bg-[#032A3D] p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#28A9E0]">
            Care Communication
          </p>

          <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                Chat
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/80">
                View participant chat threads, open conversations and reply from
                the dashboard.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                Active project
              </p>
              <p className="mt-2 text-xl font-black text-white">
                {loadingContext
                  ? "Loading..."
                  : context?.active_project_name ?? "—"}
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-white/70">
                {context?.organisation_name ?? "Loading organisation..."}
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <PageLinkButton href="/dashboard">Dashboard</PageLinkButton>
          <PageLinkButton href="/inbox">Central Inbox</PageLinkButton>
          <PageLinkButton href="/participants">Participants</PageLinkButton>
          <PageLinkButton href="/delivery-logs">Delivery Logs</PageLinkButton>
        </div>

        {errorMessage ? <Notice tone="danger">{errorMessage}</Notice> : null}

        <section className="grid gap-3 md:grid-cols-4">
          <InfoCard
            label="Organisation"
            value={
              loadingContext ? "Loading..." : context?.organisation_name ?? "—"
            }
          />

          <InfoCard
            label="Project"
            value={
              loadingContext
                ? "Loading..."
                : context?.active_project_name ?? "—"
            }
          />

          <InfoCard
            label="Project Code"
            value={context?.active_project_code ?? "—"}
          />

          <InfoCard
            label="Role"
            value={context?.project_role ?? context?.organisation_role ?? "—"}
          />
        </section>

        <section className="rounded-[2rem] border border-[#C9D8E4] bg-white p-4 shadow-sm">
          <LargeTableClient config={config as any} />
        </section>
      </div>
    </PageShell>
  );
}