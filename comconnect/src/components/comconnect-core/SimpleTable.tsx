type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
};

export function SimpleTable<T>({
  columns,
  rows,
  emptyText = "No records found.",
}: {
  columns: Column<T>[];
  rows: T[];
  emptyText?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-left font-semibold text-slate-700">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td className="px-4 py-6 text-slate-500" colSpan={columns.length}>{emptyText}</td></tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3 text-slate-700">{column.render(row)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
