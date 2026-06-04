"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const DATASETS = [
  ["participants", "Participants"],
  ["app_messages", "App messages"],
  ["app_message_replies", "App replies"],
  ["central_inbox", "Central inbox"],
  ["delivery_events", "Delivery logs"],
  ["chat_threads", "Chat threads"],
  ["chat_messages", "Chat messages"],
  ["appointments", "Appointments"],
  ["referrals", "Referrals"],
  ["health_checkins", "Health check-ins"],
  ["voice_tasks", "Voice tasks"],
  ["audit_logs", "Audit logs"],
  ["media_manifest", "Media manifest"],
];

const FORMATS = [
  ["xlsx", "Excel"],
  ["csv", "CSV"],
  ["pdf", "PDF summary"],
  ["json", "JSON"],
  ["zip", "ZIP media files"],
];

export default function ExportPage() {
  const [dataset, setDataset] = useState("participants");
  const [format, setFormat] = useState("xlsx");
  const [mediaType, setMediaType] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState("");
  const [projectId, setProjectId] = useState("");
  const [organisationId, setOrganisationId] = useState("");
  const [limit, setLimit] = useState("5000");
  const [includeArchived, setIncludeArchived] = useState(false);

  const downloadUrl = useMemo(() => {
    const params = new URLSearchParams();

    params.set("dataset", dataset);
    params.set("format", format);
    params.set("limit", limit || "5000");

    if (dataset === "media_manifest" && mediaType) {
      params.set("media_type", mediaType);
    }

    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (status) params.set("status", status);
    if (projectId) params.set("project_id", projectId);
    if (organisationId) params.set("organisation_id", organisationId);
    if (includeArchived) params.set("include_archived", "true");

    return `/api/export?${params.toString()}`;
  }, [
    dataset,
    format,
    mediaType,
    start,
    end,
    status,
    projectId,
    organisationId,
    limit,
    includeArchived,
  ]);

  function download() {
    window.location.href = downloadUrl;
  }

  return (
    <main className="min-h-screen bg-[#FFF7F2] px-6 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F26A21]">
              ComConnect Export Center
            </p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">
              Export and Download Data
            </h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-600">
              Download participants, messages, inbox, delivery logs, chat
              records, care records, audit data and media files.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-[#171717]"
          >
            Dashboard
          </Link>
        </div>

        <section className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Dataset
              </span>
              <select
                value={dataset}
                onChange={(event) => setDataset(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-800"
              >
                {DATASETS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Format
              </span>
              <select
                value={format}
                onChange={(event) => setFormat(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-800"
              >
                {FORMATS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Media type
              </span>
              <select
                value={mediaType}
                onChange={(event) => setMediaType(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-800"
              >
                <option value="all">All media</option>
                <option value="video">Videos only</option>
                <option value="audio">Audio only</option>
                <option value="image">Images only</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Row limit
              </span>
              <input
                type="number"
                min="1"
                max="50000"
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-800"
              />
              <p className="mt-1 text-xs font-bold text-slate-500">
                ZIP media export is safely limited to 50 files.
              </p>
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Start date
              </span>
              <input
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-800"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                End date
              </span>
              <input
                type="date"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-800"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Status filter
              </span>
              <input
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                placeholder="open, active, archived..."
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-800"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Project ID optional
              </span>
              <input
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                placeholder="Filter by project_id"
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-800"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Organisation ID optional
              </span>
              <input
                value={organisationId}
                onChange={(event) => setOrganisationId(event.target.value)}
                placeholder="Filter by organisation_id"
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-800"
              />
            </label>
          </div>

          <label className="mt-5 flex items-center gap-3 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
              className="h-4 w-4"
            />
            Include archived records where available
          </label>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={download}
              className="rounded-xl bg-[#F26A21] px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-orange-600"
            >
              Download export
            </button>

            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:border-[#171717]"
            >
              Open export URL
            </a>
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black text-slate-900">Excel / CSV</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Best for operational datasets, analysis and reporting.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black text-slate-900">PDF summary</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Best for short summaries, not millions of rows.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black text-slate-900">ZIP media</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Downloads selected audio, image or video files with a manifest.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}