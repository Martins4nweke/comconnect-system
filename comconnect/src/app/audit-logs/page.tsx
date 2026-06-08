"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LargeTableClient } from "@/components/comconnect-actions/LargeTableClient";
import { tableConfigs } from "@/components/comconnect-actions/tableConfigs";
import {
  CompactCard,
  Notice,
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

const pageLinkClass =
  "rounded-2xl border border-[#C9D8E4] bg-white px-4 py-2 text-sm font-black text-[#06324A] shadow-sm hover:border-[#0A5278] hover:text-[#0A5278]";

export default function AuditLogsPage() {
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
      <section className="mb-5 rounded-[2rem] border border-[#C9D8E4] bg-[#032A3D] p-6 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#C9D8E4]">
          Admin
        </p>

        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              Audit Logs
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#EAF2F8]">
              Read-only security and activity trail for the active organisation
              and project.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className={pageLinkClass}>
              Dashboard
            </Link>
            <Link href="/project-settings" className={pageLinkClass}>
              Project Settings
            </Link>
            <Link href="/organisation-members" className={pageLinkClass}>
              Organisation Members
            </Link>
            <Link href="/export" className={pageLinkClass}>
              Export
            </Link>
          </div>
        </div>
      </section>

      {errorMessage ? <Notice tone="danger">{errorMessage}</Notice> : null}

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <CompactCard>
          <p className="text-xs font-black uppercase text-[#536271]">
            Organisation
          </p>
          <p className="mt-1 text-sm font-black text-[#06324A]">
            {loadingContext ? "Loading..." : context?.organisation_name ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-[#536271]">
            Project
          </p>
          <p className="mt-1 text-sm font-black text-[#06324A]">
            {loadingContext ? "Loading..." : context?.active_project_name ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-[#536271]">
            Project Code
          </p>
          <p className="mt-1 text-sm font-black text-[#06324A]">
            {context?.active_project_code ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-[#536271]">
            Role
          </p>
          <p className="mt-1 text-sm font-black text-[#06324A]">
            {context?.project_role ?? context?.organisation_role ?? "—"}
          </p>
        </CompactCard>
      </div>

      <Notice tone="info">
        Audit logs are read-only. They should not be edited, deleted or archived
        from the dashboard.
      </Notice>

      <div className="mt-4">
        <LargeTableClient config={tableConfigs.audit} />
      </div>
    </PageShell>
  );
}