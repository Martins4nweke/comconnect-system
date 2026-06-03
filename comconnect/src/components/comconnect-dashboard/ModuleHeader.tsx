export function ModuleHeader({ title, subtitle, eyebrow }: { title: string; subtitle?: string; eyebrow?: string }) {
  return (
    <section className="rounded-2xl bg-[#FFF7F2] p-6 shadow-sm">
      {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#F26A21]">{eyebrow}</p> : null}
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
    </section>
  );
}
