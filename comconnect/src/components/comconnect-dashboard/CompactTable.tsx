import type { ReactNode } from "react";

type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
};

export function CompactTable<T>({
  rows,
  columns,
  emptyText = "No records found.",
}: {
  rows: T[];
  columns: Column<T>[];
  emptyText?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-10 px-4 py-3 text-left">
                <input type="checkbox" aria-label="Select all visible rows" className="h-4 w-4 rounded border-slate-300" />
              </th>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-left font-semibold text-slate-700">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={columns.length + 1}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row: any, index) => (
                <tr key={row.id ?? index} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label="Select row" className="h-4 w-4 rounded border-slate-300" />
                  </td>
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3 align-top text-slate-700">
                      {column.render(row)}
                    </td>
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
