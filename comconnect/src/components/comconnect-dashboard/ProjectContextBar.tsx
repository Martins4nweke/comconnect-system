export function ProjectContextBar({
  projectName,
  organisationName,
  projectCode,
}: {
  projectName?: string | null;
  organisationName?: string | null;
  projectCode?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
      <span className="font-semibold text-slate-900">Context:</span>{" "}
      <span className="text-slate-600">
        {organisationName || "All organisations"} / {projectName || "All projects"}
        {projectCode ? ` (${projectCode})` : ""}
      </span>
    </div>
  );
}
