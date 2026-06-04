import Link from "next/link";
import type { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return <main className="px-4 py-4 lg:px-5">{children}</main>;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F26A21]">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="mt-1 text-2xl font-black text-slate-950">{title}</h1>

        {subtitle ? (
          <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-600">
            {subtitle}
          </p>
        ) : null}
      </div>

      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function CompactCard({
  title,
  subtitle,
  children,
  action,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
      {title || subtitle || action ? (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title ? (
              <h2 className="text-base font-black text-slate-950">{title}</h2>
            ) : null}

            {subtitle ? (
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                {subtitle}
              </p>
            ) : null}
          </div>

          {action ? <div>{action}</div> : null}
        </div>
      ) : null}

      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: ReactNode;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
      {helper ? (
        <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p>
      ) : null}
    </div>
  );
}

export function PrimaryButton({
  children,
  type = "button",
  disabled,
  onClick,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl bg-[#F26A21] px-4 py-2 text-xs font-black text-white disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  type = "button",
  disabled,
  onClick,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21]"
    >
      {children}
    </Link>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
}) {
  const className =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
      ? "border-orange-200 bg-orange-50 text-orange-700"
      : tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "info"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-black ${className}`}>
      {children}
    </span>
  );
}

export function Notice({
  children,
  tone = "warning",
}: {
  children: ReactNode;
  tone?: "warning" | "danger" | "success" | "info";
}) {
  const className =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "info"
      ? "border-blue-200 bg-blue-50 text-blue-800"
      : "border-orange-200 bg-orange-50 text-orange-800";

  return (
    <div className={`mb-4 rounded-2xl border p-3 text-sm font-bold ${className}`}>
      {children}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-[#F26A21]",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-[#F26A21]",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

export function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase text-slate-500">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}