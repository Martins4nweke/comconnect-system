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

  return "border-slate-200 bg-white text-slate-900";
}

function pillClasses(tone?: AlertTone) {
  if (tone === "danger") return "bg-red-100 text-red-700";
  if (tone === "warning") return "bg-orange-100 text-orange-700";
  if (tone === "success") return "bg-emerald-100 text-emerald-700";

  return "bg-slate-100 text-slate-700";
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
    <div className="rounded-2xl border border-orange-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
        {title}
      </p>
      <p className="mt-1 text-xl font-black text-slate-950">
        {numberText(value)}
      </p>
      {helper ? (
        <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p>
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
      className={`block rounded-2xl border p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClasses(
        alert.tone
      )}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] opacity-70">
            Alert
          </p>
          <h3 className="mt-1 text-sm font-black">{alert.title}</h3>
        </div>

        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-black ${pillClasses(
            alert.tone
          )}`}
        >
          {alert.tone}
        </span>
      </div>

      <p className="mt-2 text-2xl font-black">{numberText(alert.value)}</p>
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
    <section className="rounded-2xl border border-orange-100 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-black text-slate-950">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              {subtitle}
            </p>
          ) : null}
        </div>

        {href ? (
          <Link
            href={href}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21]"
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
  const formattedValue =
    typeof value === "string" ? value : numberText(value);

  const row = (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-[#FFF7F2] px-3 py-2">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <span className="text-sm font-black text-slate-950">
        {formattedValue}
      </span>
    </div>
  );

  if (!href) return row;

  return <Link href={href}>{row}</Link>;
}

function QuickAction({
  title,
  href,
  description,
}: {
  title: string;
  href: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-orange-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-[#F26A21] hover:shadow-md"
    >
      <p className="text-sm font-black text-slate-950">{title}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">
        {description}
      </p>
    </Link>
  );
}

export default function Page() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setNote("");

      try {
        const response = await fetch("/api/dashboard/overview", {
          cache: "no-store",
        });

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
  const warnings = data?.warnings ?? [];

  const generated = useMemo(() => {
    return data?.generated_at ? formatGeneratedAt(data.generated_at) : "—";
  }, [data?.generated_at]);

  return (
    <VerticalAppShell
      organisationRole="organisation_admin"
      projectRole="project_manager"
      organisationName="ComConnect Organisation"
      projectName="Active Project"
    >
      <main className="px-4 py-4 lg:px-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F26A21]">
              ComConnect Dashboard
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">
              Operational command centre
            </h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-600">
              Monitor participants, messages, alerts, research activities and
              care follow-up from one compact dashboard.
            </p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white px-3 py-2 shadow-sm">
            <p className="text-[11px] font-black uppercase text-slate-500">
              Last refreshed
            </p>
            <p className="mt-0.5 text-xs font-black text-slate-900">
              {loading ? "Loading..." : generated}
            </p>
          </div>
        </div>

        {note ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
            {note}
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50 p-3">
            <p className="text-sm font-black text-orange-900">
              Dashboard loaded with some warnings.
            </p>
            <p className="mt-1 text-xs font-semibold text-orange-800">
              Some optional tables may be missing or not yet populated.
            </p>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl bg-white p-6 text-center text-sm font-black text-slate-500 shadow-sm">
            Loading dashboard overview...
          </div>
        ) : (
          <>
            <section className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
              {alerts.map((alert) => (
                <AlertCard key={alert.key} alert={alert} />
              ))}
            </section>

            <section className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
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
            </section>

            <section className="mb-4 grid gap-3 xl:grid-cols-3">
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
                title="Care module"
                subtitle="Health check-ins, referrals and appointments."
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

            <section>
              <div className="mb-3">
                <h2 className="text-lg font-black text-slate-950">
                  Quick actions
                </h2>
                <p className="text-sm font-semibold text-slate-500">
                  Common actions for daily operations.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                <QuickAction
                  title="Add participants"
                  href="/participants"
                  description="Open participant registry and bulk tools."
                />
                <QuickAction
                  title="Create message"
                  href="/messages"
                  description="Prepare messages for app, SMS and voice."
                />
                <QuickAction
                  title="Schedule communication"
                  href="/scheduler"
                  description="Create and run due schedules."
                />
                <QuickAction
                  title="Open central inbox"
                  href="/inbox"
                  description="Review replies, help requests and alerts."
                />
                <QuickAction
                  title="Upload media"
                  href="/media-library"
                  description="Add images, audio or video content."
                />
                <QuickAction
                  title="Export data"
                  href="/export"
                  description="Download Excel, CSV, PDF or media ZIP."
                />
                <QuickAction
                  title="View delivery logs"
                  href="/delivery-logs"
                  description="Check provider delivery outcomes."
                />
                <QuickAction
                  title="Developer API"
                  href="/app-api"
                  description="Manage API console and integrations."
                />
              </div>
            </section>
          </>
        )}
      </main>
    </VerticalAppShell>
  );
}
