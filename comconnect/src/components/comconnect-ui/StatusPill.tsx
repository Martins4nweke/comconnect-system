const toneMap: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  published: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  confirmed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  open: "bg-orange-50 text-orange-700 ring-orange-200",
  pending: "bg-orange-50 text-orange-700 ring-orange-200",
  scheduled: "bg-blue-50 text-blue-700 ring-blue-200",
  urgent: "bg-red-50 text-red-700 ring-red-200",
  high: "bg-red-50 text-red-700 ring-red-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
  archived: "bg-slate-100 text-slate-600 ring-slate-200",
  inactive: "bg-slate-100 text-slate-600 ring-slate-200",
  draft: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function StatusPill({ value }: { value?: string | null }) {
  const text = value || "—";
  const tone = toneMap[text] ?? "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${tone}`}>
      {text.replaceAll("_", " ")}
    </span>
  );
}
