export function SearchFilterBar({
  placeholder = "Search...",
}: {
  placeholder?: string;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
      <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={placeholder} name="q" />
      <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Project ID" name="project_id" />
      <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Status" name="status" />
      <button className="rounded-xl bg-[#F26A21] px-4 py-2 text-sm font-semibold text-white">Apply filters</button>
    </div>
  );
}
