"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { VerticalAppShell } from "@/components/comconnect-ui/VerticalAppShell";
import { userCan } from "@/lib/comconnect-core/permissions";

export const dynamic = "force-dynamic";

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

const apiModules = [
  {
    title: "Participant API",
    description:
      "Register participants, manage participant identifiers, and connect participant records to organisation projects.",
    status: "Planned",
  },
  {
    title: "Message API",
    description:
      "Create and send approved text, audio, video and education messages through ComConnect workflows.",
    status: "Planned",
  },
  {
    title: "Schedule API",
    description:
      "Create scheduled communication tasks while respecting project rules, quiet time and billing restrictions.",
    status: "Planned",
  },
  {
    title: "Delivery Logs API",
    description:
      "Read delivery events for app messages, push notifications, SMS, WhatsApp and voice calls.",
    status: "Planned",
  },
  {
    title: "Replies API",
    description:
      "Receive and review participant replies, help requests and structured responses from supported channels.",
    status: "Planned",
  },
  {
    title: "Webhook API",
    description:
      "Send delivery, reply, failed-message and billing events to approved organisation webhook endpoints.",
    status: "Planned",
  },
];

const rules = [
  "API access is organisation-scoped and may also be project-scoped.",
  "API keys will be controlled by plan, role and permission.",
  "API keys must never bypass billing rules.",
  "SMS, voice calls and WhatsApp require an active wallet and enabled channel.",
  "Subscription gives access to ComConnect dashboard and Participant app.",
  "Trial access supports platform and Participant app testing only.",
];

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

export default function AppApiPage() {
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [error, setError] = useState("");

  const canViewApiConsole = useMemo(() => {
    return userCan({
      organisationRole: context?.organisation_role ?? null,
      projectRole: context?.project_role ?? null,
      permission: "api:read",
    });
  }, [context?.organisation_role, context?.project_role]);

  async function loadContext() {
    setContextLoading(true);
    setError("");

    try {
      const response = await fetch("/api/context/current", {
        cache: "no-store",
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(
          json?.error ?? "Failed to load organisation/project context."
        );
      }

      setContext(json.data as CurrentContext);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load Developer API access.");
    } finally {
      setContextLoading(false);
    }
  }

  useEffect(() => {
    loadContext();
  }, []);

  const organisationName =
    context?.organisation_name ?? "ComConnect Organisation";
  const projectName = context?.active_project_name ?? "Developer API";
  const organisationRole = context?.organisation_role ?? "viewer";
  const projectRole = context?.project_role ?? "viewer";

  let guardedContent = null;

  if (contextLoading) {
    guardedContent = (
      <div className="rounded-[2rem] bg-white p-8 text-center text-sm font-black text-[#536271] shadow-sm">
        Loading Developer API access...
      </div>
    );
  } else if (error) {
    guardedContent = (
      <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
        {error}
      </div>
    );
  } else if (context?.onboarding_required || !context?.organisation_id) {
    guardedContent = (
      <AccessMessage
        title="No active organisation"
        message="This account is not linked to an active organisation. Developer API access can only be viewed after organisation access is active."
        href="/dashboard"
        linkText="Back to dashboard"
      />
    );
  } else if (context?.access_pending) {
    guardedContent = (
      <AccessMessage
        title="Organisation access pending"
        message="Your organisation access is still pending. Developer API access will become available after your membership is active."
        href="/dashboard"
        linkText="Back to dashboard"
      />
    );
  } else if (!canViewApiConsole) {
    guardedContent = (
      <AccessMessage
        title="You do not have Developer API permission"
        message="Only users with API read permission can view the Developer API console. Ask an organisation admin or developer admin to update your access."
        href="/dashboard"
        linkText="Back to dashboard"
      />
    );
  } else {
    guardedContent = (
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] bg-[#032A3D] p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#28A9E0]">
            Developer API
          </p>

          <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                ComConnect API Console
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/80">
                Prepare secure organisation API access for participant
                workflows, messages, schedules, delivery logs, replies and
                webhooks.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                Current stage
              </p>
              <p className="mt-2 text-xl font-black text-white">
                Overview and access console
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-white/70">
                API keys, webhooks and usage pages are connected. API sending
                will be added only after billing, wallet and permission checks
                are confirmed.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {apiModules.map((module) => (
            <div
              key={module.title}
              className="rounded-[2rem] border border-[#C9D8E4] bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-black text-[#06324A]">
                  {module.title}
                </h2>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">
                  {module.status}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#536271]">
                {module.description}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
              Billing and wallet rules
            </p>
            <h2 className="mt-3 text-2xl font-black text-[#06324A]">
              API access will not bypass paid-channel controls
            </h2>

            <div className="mt-5 grid gap-3">
              {rules.map((rule) => (
                <div
                  key={rule}
                  className="rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] px-4 py-3 text-sm font-bold text-[#06324A]"
                >
                  {rule}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
              API management pages
            </p>
            <h2 className="mt-3 text-2xl font-black text-[#06324A]">
              Build order
            </h2>

            <div className="mt-5 space-y-3">
              <Link
                href="/api-keys"
                className="block rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
              >
                API Keys
              </Link>
              <Link
                href="/webhooks"
                className="block rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
              >
                Webhooks
              </Link>
              <Link
                href="/api-usage"
                className="block rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
              >
                API Usage
              </Link>
            </div>

            <p className="mt-5 rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] px-4 py-3 text-xs font-bold leading-5 text-[#536271]">
              This page does not send messages, deduct wallet balance, run the
              scheduler, or call external providers. It only explains and links
              to the API management pages.
            </p>
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