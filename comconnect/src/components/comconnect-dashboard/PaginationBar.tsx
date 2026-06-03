export function PaginationBar({
  limit,
  nextCursor,
}: {
  limit: number;
  nextCursor?: string | null;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
      <span className="text-slate-600">Showing up to {limit} records</span>
      {nextCursor ? (
        <span className="text-slate-500">Next cursor: <code className="text-xs">{nextCursor}</code></span>
      ) : (
        <span className="text-slate-500">No more records shown</span>
      )}
    </div>
  );
}
