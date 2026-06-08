"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { PageShell } from "@/components/comconnect-ui/PageShell";
import { ModuleNavigationRail } from "@/components/comconnect-ui/ModuleNavigationRail";
import { moduleGroups } from "@/lib/comconnect-ui/theme";

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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-[2rem] border border-[#C9D8E4] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
        {label}
      </p>
      <p className="mt-2 text-sm font-black text-[#06324A]">{value}</p>
    </section>
  );
}

export default function CommunicationOperationsPage() {
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [note, setNote] = useState("");

  async function loadContext() {
    setLoadingContext(true);
    setNote("");

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
      setNote(error?.message ?? "Failed to load context.");
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
            Communication Operations
          </p>

          <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                Communication operations
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/80">
                Monitor fallback rules, push queue, voice tasks and delivery
                operations.
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
          <PageLinkButton href="/scheduler">Scheduler</PageLinkButton>
          <PageLinkButton href="/delivery-logs">Delivery Logs</PageLinkButton>
          <PageLinkButton href="/fallback-rules">Fallback Rules</PageLinkButton>
          <PageLinkButton href="/push-queue">Push Queue</PageLinkButton>
        </div>

        {note ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
            {note}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-3">
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
            label="Role"
            value={
              loadingContext
                ? "Loading..."
                : context?.project_role ??
                  context?.organisation_role ??
                  "—"
            }
          />
        </section>

        <section className="rounded-[2rem] border border-[#C9D8E4] bg-white p-4 shadow-sm">
          <ModuleNavigationRail
            title="Operations"
            parentHref="/communication-operations"
            cards={moduleGroups.operations}
          />
        </section>
      </div>
    </PageShell>
  );
}