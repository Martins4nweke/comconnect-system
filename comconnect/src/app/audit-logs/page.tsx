"use client";

import { useEffect, useState } from "react";
import { LargeTableClient } from "@/components/comconnect-actions/LargeTableClient";
import { tableConfigs } from "@/components/comconnect-actions/tableConfigs";
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
      <PageHeader
        eyebrow="Admin"
        title="Audit Logs"
        subtitle="Read-only security and activity trail for the active organisation and project."
        actions={
          <>
            <LinkButton href="/project-settings">Project Settings</LinkButton>
            <LinkButton href="/organisation-members">Organisation Members</LinkButton>
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