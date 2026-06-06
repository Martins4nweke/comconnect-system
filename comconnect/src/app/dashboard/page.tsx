"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { VerticalAppShell } from "@/components/comconnect-ui/VerticalAppShell";

type AlertTone = "danger" | "warning" | "success" | "info";

type DashboardAlert = {
  key: string;
  title: string;
  value: number;
  tone: AlertTone;
  href: string;
};

type DashboardData = {
  generated_at?: string;
  alerts?: DashboardAlert[];
  stats?: Record<string, number>;
  communication?: {
    deliveries_today?: number;
    sent_today?: number;
    failed_today?: number;
    success_rate?: number;
  };
  research?: Record<string, number>;
  care?: Record<string, number>;
  warnings?: string[];
};

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

function numberText(value: unknown) {
  const n = Number(value ?? 0);

  if (!Number.isFinite(n)) return "0";

  return n.toLocaleString();
}

function formatGeneratedAt(value: unknown) {
  if (!value) return "—";

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function toneClasses(tone?: AlertTone) {
  if (tone === "danger") {
    return "border-red-200 bg-red-50 text-red-900";
  }

  if (tone === "warning") {
    return "border-orange-200 bg-orange-50 text-orange-900";
  }

  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  return "border-[#C9D8E4] bg-white text-[#06324A]";
}

function pillClasses(tone?: AlertTone) {
  if (tone === "danger") return "bg-red-100 text-red-700";
  if (tone === "warning") return "bg-orange-100 text-orange-700";
  if (tone === "success") return "bg-emerald-100 text-emerald-700";

  return "bg-[#EAF2F8] text-[#0A5278]";
}

function StatCard({
  title,
  value,
  helper,
  href,
}: {
  title: string;
  value: unknown;
  helper?: string;
  href?: string;
}) {
  const content = (
    <div className="flex min-h-[132px] flex-col justify-between rounded-[1.5rem] border border-[#C9D8E4] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#536271]">
        {title}
      </p>

      <p className="mt-2 text-3xl font-black tracking-tight text-[#06324A]">
        {numberText(value)}
      </p>

      {helper ? (
        <p className="mt-2 text-xs font-semibold leading-5 text-[#536271]">
          {helper}
        </p>
      ) : null}
    </div>
  );

  if (!href) return content;

  return <Link href={href}>{content}</Link>;
}

function AlertCard({ alert }: { alert: DashboardAlert }) {
  return (
    <Link
      href={alert.href}
      className={`block min-h-[132px] rounded-[1.5rem] border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClasses(
        alert.tone
      )}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] opacity-70">
            Alert
          </p>
          <h3 className="mt-2 text-sm font-black leading-5">{alert.title}</h3>
        </div>

        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${pillClasses(
            alert.tone
          )}`}
        >
          {alert.tone}
        </span>
      </div>

      <p className="mt-4 text-3xl font-black tracking-tight">
        {numberText(alert.value)}
      </p>
    </Link>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  href,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  href?: string;
}) {
  return (
    <section className="rounded-[1.7rem] border border-[#C9D8E4] bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-black tracking-tight text-[#06324A]">
            {title}
          </h2>

          {subtitle ? (
            <p className="mt-1 text-xs font-semibold leading-5 text-[#536271]">
              {subtitle}
            </p>
          ) : null}
        </div>

        {href ? (
          <Link
            href={href}
            className="rounded-full border border-[#C9D8E4] px-4 py-2 text-xs font-black text-[#06324A] hover:border-[#0A5278] hover:bg-[#EAF2F8] hover:text-[#0A5278]"
          >
            Open
          </Link>
        ) : null}
      </div>

      {children}
    </section>
  );
}

function MetricRow({
  label,
  value,
  href,
}: {
  label: string;
  value: unknown;
  href?: string;
}) {
  const formattedValue = typeof value === "string" ? value : numberText(value);

  const row = (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#EAF2F8] px-4 py-3">
      <span className="text-sm font-bold leading-5 text-[#536271]">
        {label}
      </span>

      <span className="text-sm font-black text-[#06324A]">
        {formattedValue}
      </span>
    </div>
  );

  if (!href) return row;

  return <Link href={href}>{row}</Link>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setNote("");

      try {
        const contextResponse = await fetch("/api/context/current", {
          cache: "no-store",
        });

        const contextJson = await contextResponse.json().catch(() => null);

        if (!contextResponse.ok || !contextJson?.ok) {
          throw new Error(
            contextJson?.error ??
              "Failed to load organisation/project context."
          );
        }

        const currentContext = contextJson.data as CurrentContext;

        if (!cancelled) {
          setContext(currentContext);
        }

       if (!currentContext.organisation_id) {
  if (!cancelled) {
    setData({
      generated_at: new Date().toISOString(),
      alerts: [],
      stats: {},
      communication: {},
      research: {},
      care: {},
      warnings: [],
    });
    setNote("");
  }

  return;
}

const params = new URLSearchParams();

params.set("organisation_id", currentContext.organisation_id);

if (currentContext.active_project_id) {
  params.set("project_id", currentContext.active_project_id);
}

const response = await fetch(
  `/api/dashboard/overview?${params.toString()}`,
  {
    cache: "no-store",
  }
);

        const json = await response.json().catch(() => null);

        if (!response.ok || !json?.ok) {
          throw new Error(json?.error ?? "Failed to load dashboard overview.");
        }

        if (!cancelled) {
          setData(json.data);
        }
      } catch (error: any) {
        if (!cancelled) {
          setNote(error?.message ?? "Failed to load dashboard.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = data?.stats ?? {};
  const alerts = data?.alerts ?? [];
  const communication = data?.communication ?? {};
  const research = data?.research ?? {};
  const care = data?.care ?? {};

  const generated = useMemo(() => {
    return data?.generated_at ? formatGeneratedAt(data.generated_at) : "—";
  }, [data?.generated_at]);

  return (
    <VerticalAppShell
      organisationRole={context?.organisation_role ?? "organisation_admin"}
      projectRole={context?.project_role ?? "project_manager"}
      organisationName={context?.organisation_name ?? "ComConnect Organisation"}
      projectName={context?.active_project_name ?? "Active Project"}
    >
      <main className="min-h-screen bg-[#EAF2F8] px-4 py-4 text-[#06324A] lg:px-5">
        <div className="mb-4 rounded-[2rem] bg-[#032A3D] p-5 text-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#28A9E0]">
                ComConnect Dashboard
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
                Operational command centre
              </h1>

              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/75">
  Monitor participants, two-way engagement, care follow-up,
  alerts, research activities and delivery performance from one
  compact dashboard.
</p>

<p className="mt-3 text-sm font-black text-[#28A9E0]">
  Logged in as: {context?.user?.email ?? "Unknown user"}
</p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/55">
                Last refreshed
              </p>
              <p className="mt-1 text-xs font-black text-white">
                {loading ? "Loading..." : generated}
              </p>
            </div>
          </div>
        </div>

        {note ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
            {note}
          </div>
        ) : null}

        {loading ? (
  <div className="rounded-[2rem] bg-white p-8 text-center text-sm font-black text-[#536271] shadow-sm">
    Loading dashboard overview...
  </div>
) : context?.onboarding_required ? (
  <div className="mb-4 rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
    <p className="text-sm font-black uppercase tracking-[0.2em] text-[#0A5278]">
      Organisation setup required
    </p>

    <h2 className="mt-3 text-2xl font-black text-[#06324A]">
      No organisation is linked to this account yet.
    </h2>

    <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[#536271]">
      You are logged in as {context?.user?.email ?? "this user"}, but this
      account is not yet linked to an active organisation.
    </p>

    <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[#536271]">
      Create or link an organisation before dashboard metrics, participants,
      messages, schedules and project data can appear.
    </p>
  </div>
) : (
  <>
            <section className="mb-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {alerts.map((alert) => (
                  <AlertCard key={alert.key} alert={alert} />
                ))}

                <StatCard
                  title="Total participants"
                  value={stats.participants_total}
                  helper={`${numberText(stats.participants_active)} active`}
                  href="/participants"
                />

                <StatCard
                  title="Open inbox"
                  value={stats.inbox_open}
                  helper={`${numberText(stats.inbox_created_today)} new today`}
                  href="/inbox"
                />

                <StatCard
                  title="Deliveries today"
                  value={stats.deliveries_today}
                  helper={`${numberText(
                    stats.delivery_success_rate
                  )}% success rate`}
                  href="/delivery-logs"
                />

                <StatCard
                  title="Voice pending"
                  value={stats.voice_pending}
                  helper={`${numberText(stats.voice_failed)} failed`}
                  href="/voice-tasks"
                />
              </div>
            </section>

            <section className="grid gap-3 xl:grid-cols-3">
              <SectionCard
                title="Communication performance"
                subtitle="Today’s delivery activity across channels."
                href="/delivery-logs"
              >
                <div className="space-y-2">
                  <MetricRow
                    label="Total deliveries"
                    value={communication.deliveries_today}
                  />
                  <MetricRow
                    label="Submitted / sent"
                    value={communication.sent_today}
                  />
                  <MetricRow
                    label="Failed / expired"
                    value={communication.failed_today}
                  />
                  <MetricRow
                    label="Success rate"
                    value={`${communication.success_rate ?? 0}%`}
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="Research module"
                subtitle="Education and questionnaire activity."
                href="/research-care/research"
              >
                <div className="space-y-2">
                  <MetricRow
                    label="Education items added recently"
                    value={research.education_recent}
                    href="/education-library"
                  />
                  <MetricRow
                    label="Questionnaires added recently"
                    value={research.questionnaires_recent}
                    href="/questionnaires"
                  />
                  <MetricRow
                    label="Media library"
                    value="Open"
                    href="/media-library"
                  />
                  <MetricRow
                    label="Consent forms"
                    value="Open"
                    href="/consent-forms"
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="Care continuity"
                subtitle="Follow-up, referrals, appointments and alerts."
                href="/research-care/care"
              >
                <div className="space-y-2">
                  <MetricRow
                    label="Health check-ins today"
                    value={care.health_checkins_today}
                    href="/health-checkins"
                  />
                  <MetricRow
                    label="High BP / health alerts"
                    value={care.high_bp_recent}
                    href="/health-checkins"
                  />
                  <MetricRow
                    label="Open appointments"
                    value={care.appointments_open}
                    href="/appointments"
                  />
                  <MetricRow
                    label="Open referrals"
                    value={care.referrals_open}
                    href="/referrals"
                  />
                </div>
              </SectionCard>
            </section>
          </>
        )}
      </main>
    </VerticalAppShell>
  );
}