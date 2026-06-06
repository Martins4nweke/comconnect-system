"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/comconnect-ui/PageShell";
import { SharpHero } from "@/components/comconnect-ui/SharpHero";
import { BackToParent } from "@/components/comconnect-ui/BackToParent";
import { Breadcrumbs } from "@/components/comconnect-ui/Breadcrumbs";
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
      <Breadcrumbs
        items={[
          { label: "Research + Care", href: "/research-care" },
          { label: "Communication Operations" },
        ]}
      />

      <BackToParent href="/research-care" label="Back to Research + Care" />

      <SharpHero
        eyebrow="Communication"
        title="Communication operations"
        subtitle="Manage fallback, push queue and voice tasks."
      />

      {note ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
          {note}
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-500">
            Organisation
          </p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {loadingContext ? "Loading..." : context?.organisation_name ?? "—"}
          </p>
        </section>

        <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-500">Project</p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {loadingContext ? "Loading..." : context?.active_project_name ?? "—"}
          </p>
        </section>

        <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-500">Role</p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {loadingContext ? "Loading..." : context?.project_role ?? "—"}
          </p>
        </section>
      </div>

      <ModuleNavigationRail
        title="Operations"
        parentHref="/communication-operations"
        cards={moduleGroups.operations}
      />
    </PageShell>
  );
}