"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BackToParent } from "@/components/comconnect-ui/BackToParent";
import { Breadcrumbs } from "@/components/comconnect-ui/Breadcrumbs";
import { PageShell } from "@/components/comconnect-ui/PageShell";
import { StatusPill } from "@/components/comconnect-ui/StatusPill";
import { ConfirmDialog } from "./ConfirmDialog";
import type { LargeTableConfig } from "./tableConfigs";

type ProjectOption = {
  id: string;
  name: string;
  project_code?: string | null;
};

type CurrentContext = {
  organisation_id?: string | null;
  organisation_name?: string | null;
  organisation_role?: string | null;
  active_project_id?: string | null;
  active_project_name?: string | null;
  project_role?: string | null;
  allowed_projects?: ProjectOption[];
};

type ApiResponse = {
  ok: boolean;
  data?: {
    rows: any[];
    limit: number;
    next_cursor: string | null;
  };
  error?: string;
};

function projectLabel(project: ProjectOption) {
  return project.project_code
    ? `${project.name} (${project.project_code})`
    : project.name;
}

export function LargeTableClient({ config }: { config: LargeTableConfig }) {
  const [context, setContext] = useState<CurrentContext | null>(null);
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
  const projects = context?.allowed_projects ?? [];

  const selectedCount = selected.size;
  const allVisibleSelected =
    rows.length > 0 && rows.every((row) => selected.has(row.id));

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));

    if (q.trim()) params.set("q", q.trim());
    if (projectId.trim()) params.set("project_id", projectId.trim());
    if (status.trim()) params.set("status", status.trim());
    if (currentCursor) params.set("cursor", currentCursor);

    return params.toString();
  }, [q, projectId, status, limit, currentCursor]);

  const loadContext = useCallback(async (projectIdOverride?: string) => {
    const params = new URLSearchParams();

    if (projectIdOverride) {
      params.set("project_id", projectIdOverride);
    }

    const res = await fetch(
      params.toString()
        ? `/api/context/current?${params.toString()}`
        : "/api/context/current",
      { cache: "no-store" }
    );

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      throw new Error(json?.error ?? "Failed to load access context.");
    }

    const currentContext = json.data as CurrentContext;
    setContext(currentContext);

    const nextProjectId =
      projectIdOverride ||
      currentContext.active_project_id ||
      currentContext.allowed_projects?.[0]?.id ||
      "";

    setProjectId(nextProjectId);

    return nextProjectId;
  }, []);

  const loadRows = useCallback(async () => {
    setBusy(true);
    setError("");

    try {
      const res = await fetch(`${config.apiPath}?${queryString}`, {
        cache: "no-store",
      });

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
    loadContext().catch((err: any) => {
      setError(err.message || "Failed to load access context.");
    });
  }, [loadContext]);

  useEffect(() => {
    if (projectId || projects.length === 0) {
      loadRows();
    }
  }, [loadRows, projectId, projects.length]);

  async function handleProjectChange(value: string) {
    setCursorStack([null]);
    setProjectId(value);

    try {
      await loadContext(value);
    } catch (err: any) {
      setError(err.message || "Failed to switch project.");
    }
  }

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

  async function runBulk(
    action: "archive" | "status",
    newStatus?: string,
    ids?: string[]
  ) {
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
            ? { action: "archive", ids: targetIds, project_id: projectId }
            : {
                action: "status",
                status: newStatus,
                ids: targetIds,
                project_id: projectId,
              }
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
      message: `Archive ${selectedCount} selected record(s)?`,
      label: "Archive selected",
      action: async () => runBulk("archive"),
    });
  }

  function askRowArchive(id: string) {
    setConfirm({
      title: "Archive this record?",
      message: "This record will be archived.",
      label: "Archive",
      action: async () => runBulk("archive", undefined, [id]),
    });
  }

  function askBulkStatus(newStatus: string) {
    setConfirm({
      title: "Update selected status?",
      message: `Set ${selectedCount} selected record(s) to ${newStatus}?`,
      label: "Update",
      action: async () => runBulk("status", newStatus),
    });
  }

  function askRowStatus(id: string, newStatus: string) {
    setConfirm({
      title: "Update record status?",
      message: `Set this record to ${newStatus}?`,
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
    loadRows();
  }

  return (
    <PageShell>
      <Breadcrumbs items={config.breadcrumbs} />
      <BackToParent href={config.parentHref} label={config.parentLabel} />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F26A21]">
            {config.eyebrow}
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">
            {config.title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-600">
            {config.subtitle}
          </p>
        </div>

        <div className="rounded-2xl border border-orange-100 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-500">
            Project
          </p>
          <p className="text-sm font-black text-slate-950">
            {context?.active_project_name ?? "Loading..."}
          </p>
        </div>
      </div>

      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm md:grid-cols-5"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-[#F26A21]"
          placeholder={config.searchPlaceholder}
        />

        <select
          value={projectId}
          onChange={(e) => void handleProjectChange(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#F26A21]"
        >
          {projects.length === 0 ? (
            <option value="">No project</option>
          ) : (
            projects.map((project) => (
              <option key={project.id} value={project.id}>
                {projectLabel(project)}
              </option>
            ))
          )}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#F26A21]"
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
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#F26A21]"
        >
          {[25, 50, 100, 200].map((value) => (
            <option key={value} value={value}>
              {value} rows
            </option>
          ))}
        </select>

        <button className="rounded-xl bg-[#F26A21] px-4 py-2 text-sm font-black text-white disabled:opacity-50">
          Search
        </button>
      </form>

      {config.allowBulkActions ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <span className="text-sm font-black text-slate-900">
            {selectedCount} selected
          </span>

          <button
            type="button"
            onClick={askBulkArchive}
            disabled={selectedCount === 0 || busy}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-40"
          >
            Archive
          </button>

          <select
            disabled={selectedCount === 0 || busy}
            onChange={(e) => {
              if (e.target.value) askBulkStatus(e.target.value);
              e.currentTarget.value = "";
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-[#FFF7F2]">
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
                  <th
                    key={column.key}
                    className="px-4 py-3 text-left font-black text-slate-700"
                  >
                    {column.label}
                  </th>
                ))}

                {config.allowBulkActions ? (
                  <th className="px-4 py-3 text-left font-black text-slate-700">
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {busy && rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={config.columns.length + 2}
                    className="px-4 py-8 text-slate-500"
                  >
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={config.columns.length + 2}
                    className="px-4 py-8 text-slate-500"
                  >
                    No records found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#FFF7F2]">
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
                      <td
                        key={column.key}
                        className="px-4 py-3 align-top text-slate-700"
                      >
                        {column.render(row)}
                      </td>
                    ))}

                    {config.allowBulkActions ? (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => askRowArchive(row.id)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21]"
                          >
                            Archive
                          </button>

                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                askRowStatus(row.id, e.target.value);
                              }

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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <div className="text-sm font-bold text-slate-700">
          Showing up to {limit} records
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={previousPage}
            disabled={cursorStack.length <= 1 || busy}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40"
          >
            Previous
          </button>

          <button
            type="button"
            onClick={nextPage}
            disabled={!nextCursor || busy}
            className="rounded-xl bg-[#F26A21] px-4 py-2 text-sm font-black text-white disabled:opacity-40"
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