"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BackToParent } from "@/components/comconnect-ui/BackToParent";
import { Breadcrumbs } from "@/components/comconnect-ui/Breadcrumbs";
import { PageShell } from "@/components/comconnect-ui/PageShell";
import { SharpHero } from "@/components/comconnect-ui/SharpHero";
import { StatusPill } from "@/components/comconnect-ui/StatusPill";
import { ConfirmDialog } from "./ConfirmDialog";
import type { LargeTableConfig } from "./tableConfigs";

type ApiResponse = {
  ok: boolean;
  data?: {
    rows: any[];
    limit: number;
    next_cursor: string | null;
  };
  error?: string;
};

export function LargeTableClient({ config }: { config: LargeTableConfig }) {
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("");
  const [limit, setLimit] = useState(50);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<null | {
    title: string;
    message: string;
    action: () => Promise<void>;
    label: string;
  }>(null);

  const currentCursor = cursorStack[cursorStack.length - 1];

  const selectedCount = selected.size;
  const allVisibleSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (q.trim()) params.set("q", q.trim());
    if (projectId.trim()) params.set("project_id", projectId.trim());
    if (status.trim()) params.set("status", status.trim());
    if (currentCursor) params.set("cursor", currentCursor);
    return params.toString();
  }, [q, projectId, status, limit, currentCursor]);

  const loadRows = useCallback(async () => {
    setBusy(true);
    setError("");

    try {
      const res = await fetch(`${config.apiPath}?${queryString}`, { cache: "no-store" });
      const json: ApiResponse = await res.json();

      if (!json.ok) throw new Error(json.error || "Failed to load records");

      setRows(json.data?.rows ?? []);
      setNextCursor(json.data?.next_cursor ?? null);
      setSelected(new Set());
    } catch (err: any) {
      setError(err.message || "Failed to load records");
    } finally {
      setBusy(false);
    }
  }, [config.apiPath, queryString]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rows.map((row) => row.id).filter(Boolean)));
  }

  function toggleRow(id: string) {
    const copy = new Set(selected);
    if (copy.has(id)) copy.delete(id);
    else copy.add(id);
    setSelected(copy);
  }

  async function runBulk(action: "archive" | "status", newStatus?: string, ids?: string[]) {
    if (!config.bulkApiPath) return;

    const targetIds = ids ?? Array.from(selected);
    if (targetIds.length === 0) {
      setError("Select at least one record.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const res = await fetch(config.bulkApiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "archive"
            ? { action: "archive", ids: targetIds }
            : { action: "status", status: newStatus, ids: targetIds }
        ),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Bulk action failed");

      await loadRows();
    } catch (err: any) {
      setError(err.message || "Bulk action failed");
    } finally {
      setBusy(false);
    }
  }

  function askBulkArchive() {
    setConfirm({
      title: "Archive selected records?",
      message: `This will archive ${selectedCount} selected record(s). The records are not hard-deleted.`,
      label: "Archive selected",
      action: async () => runBulk("archive"),
    });
  }

  function askRowArchive(id: string) {
    setConfirm({
      title: "Archive this record?",
      message: "This record will be archived, not permanently deleted.",
      label: "Archive",
      action: async () => runBulk("archive", undefined, [id]),
    });
  }

  function askBulkStatus(newStatus: string) {
    setConfirm({
      title: "Update selected status?",
      message: `This will set ${selectedCount} selected record(s) to '${newStatus}'.`,
      label: "Update status",
      action: async () => runBulk("status", newStatus),
    });
  }

  function askRowStatus(id: string, newStatus: string) {
    setConfirm({
      title: "Update record status?",
      message: `This will set this record to '${newStatus}'.`,
      label: "Update",
      action: async () => runBulk("status", newStatus, [id]),
    });
  }

  function nextPage() {
    if (!nextCursor) return;
    setCursorStack((prev) => [...prev, nextCursor]);
  }

  function previousPage() {
    setCursorStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setCursorStack([null]);
    // The useEffect tied to queryString will reload rows with fresh filters.
  }

  return (
    <PageShell>
      <Breadcrumbs items={config.breadcrumbs} />
      <BackToParent href={config.parentHref} label={config.parentLabel} />
      <SharpHero title={config.title} subtitle={config.subtitle} eyebrow={config.eyebrow} />

      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-[1.5rem] border-2 border-[#171717] bg-white p-4 shadow-[4px_4px_0_#171717] md:grid-cols-5"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="rounded-xl border-2 border-slate-200 px-3 py-2 text-sm"
          placeholder={config.searchPlaceholder}
        />
        <input
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="rounded-xl border-2 border-slate-200 px-3 py-2 text-sm"
          placeholder="Project ID"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border-2 border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {config.statusOptions.map((option) => (
            <option key={option} value={option}>
              {option.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="rounded-xl border-2 border-slate-200 px-3 py-2 text-sm"
        >
          {[25, 50, 100, 200].map((value) => (
            <option key={value} value={value}>
              {value} rows
            </option>
          ))}
        </select>
        <button className="rounded-xl bg-[#FF5C1A] px-4 py-2 text-sm font-black text-black">
          Search
        </button>
      </form>

      {config.allowBulkActions ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[1.5rem] border-2 border-[#171717] bg-white p-4 shadow-[4px_4px_0_#171717]">
          <span className="text-sm font-black text-[#171717]">{selectedCount} selected</span>
          <button
            type="button"
            onClick={askBulkArchive}
            disabled={selectedCount === 0 || busy}
            className="rounded-xl border-2 border-[#171717] px-3 py-2 text-sm font-bold disabled:opacity-40"
          >
            Archive selected
          </button>
          <select
            disabled={selectedCount === 0 || busy}
            onChange={(e) => {
              if (e.target.value) askBulkStatus(e.target.value);
              e.currentTarget.value = "";
            }}
            className="rounded-xl border-2 border-slate-200 px-3 py-2 text-sm"
            defaultValue=""
          >
            <option value="">Set status...</option>
            {config.statusOptions.map((option) => (
              <option key={option} value={option}>
                {option.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={selectedCount === 0}
            className="rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold disabled:opacity-40"
          >
            Clear selection
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[1.5rem] border-2 border-[#171717] bg-white shadow-[4px_4px_0_#171717]">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {config.allowBulkActions ? (
                  <th className="w-10 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="Select all visible rows"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </th>
                ) : null}
                {config.columns.map((column) => (
                  <th key={column.key} className="px-4 py-3 text-left font-black text-slate-700">
                    {column.label}
                  </th>
                ))}
                {config.allowBulkActions ? <th className="px-4 py-3 text-left font-black text-slate-700">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {busy && rows.length === 0 ? (
                <tr>
                  <td colSpan={config.columns.length + 2} className="px-4 py-8 text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={config.columns.length + 2} className="px-4 py-8 text-slate-500">
                    No records found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    {config.allowBulkActions ? (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                          aria-label="Select row"
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                    ) : null}
                    {config.columns.map((column) => (
                      <td key={column.key} className="px-4 py-3 align-top text-slate-700">
                        {column.render(row)}
                      </td>
                    ))}
                    {config.allowBulkActions ? (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => askRowArchive(row.id)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700 hover:border-[#171717]"
                          >
                            Archive
                          </button>
                          <select
                            onChange={(e) => {
                              if (e.target.value) askRowStatus(row.id, e.target.value);
                              e.currentTarget.value = "";
                            }}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                            defaultValue=""
                          >
                            <option value="">Status</option>
                            {config.statusOptions.map((option) => (
                              <option key={option} value={option}>
                                {option.replaceAll("_", " ")}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border-2 border-[#171717] bg-white p-4 shadow-[4px_4px_0_#171717]">
        <div className="text-sm font-bold text-slate-700">
          Showing up to {limit} records {currentCursor ? "after cursor" : ""}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={previousPage}
            disabled={cursorStack.length <= 1 || busy}
            className="rounded-xl border-2 border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={nextPage}
            disabled={!nextCursor || busy}
            className="rounded-xl bg-[#FF5C1A] px-4 py-2 text-sm font-black text-black disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.label}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          const action = confirm.action;
          setConfirm(null);
          await action();
        }}
      />
    </PageShell>
  );
}
