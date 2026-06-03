export function BulkActionBar({ label = "Bulk actions" }: { label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="mr-2 text-sm font-semibold text-slate-700">{label}</span>
      <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">Archive selected</button>
      <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">Change status</button>
      <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">Export selected</button>
      <span className="text-xs text-slate-500">Buttons are UI placeholders; APIs are included for implementation wiring.</span>
    </div>
  );
}
