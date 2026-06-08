"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { LargeTableClient } from "@/components/comconnect-actions/LargeTableClient";
import { tableConfigs } from "@/components/comconnect-actions/tableConfigs";
import { Notice, PageShell } from "@/components/comconnect-ui/DashboardUI";

type CurrentContext = {
  organisation_id?: string | null;
  organisation_name?: string | null;
  organisation_role?: string | null;
  active_project_id?: string | null;
  active_project_name?: string | null;
  active_project_code?: string | null;
  project_role?: string | null;
};

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

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
        {label}
      </p>
      <p className="mt-2 text-sm font-black text-[#06324A]">{value}</p>
    </div>
  );
}

export default function InboxPage() {
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
            Central Inbox
          </p>

          <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                Participant Response Inbox
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/80">
                Review replies, help requests, chat messages, IVR responses and
                participant alerts.
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
          <PageLinkButton href="/chat">Chat</PageLinkButton>
          <PageLinkButton href="/communication-operations">
            Communication Operations
          </PageLinkButton>
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
          <LargeTableClient config={tableConfigs.inbox} />
        </section>
      </div>
    </PageShell>
  );
}