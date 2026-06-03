"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DeliveryLog = {
  id: string;
  channel?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  provider?: string | null;
  provider_message_id?: string | null;
  status?: string | null;
failure_reason?: string | null;
provider_status?: string | null;
phone_number?: string | null;
  error_message?: string | null;
  request_payload?: any;
  response_payload?: any;
  created_at?: string | null;
  participants?: {
    participant_code?: string | null;
    phone_number?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    metadata?: any;
  } | null;
};

function dt(value?: string | null) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function participantLabel(row: DeliveryLog) {
  const participant = row.participants;

  if (!participant) return "—";

  const fullName = `${participant.first_name ?? ""} ${
    participant.last_name ?? ""
  }`.trim();

  return (
    participant.metadata?.display_name ||
    fullName ||
    participant.participant_code ||
    "—"
  );
}

function statusClass(status?: string | null) {
  if (status === "sent" || status === "delivered" || status === "completed") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (status === "failed" || status === "error") {
    return "bg-red-50 text-red-700 border-red-200";
  }

  if (status === "pending" || status === "queued") {
    return "bg-orange-50 text-orange-700 border-orange-200";
  }

  return "bg-slate-50 text-slate-700 border-slate-200";
}

export default function DeliveryLogsPage() {
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");

  async function loadLogs() {
    setLoading(true);
    setNote("");

    try {
      const params = new URLSearchParams();
      params.set("project_code", "DEMO-001");
      params.set("limit", "100");

      if (channel) params.set("channel", channel);
      if (status) params.set("status", status);

      const response = await fetch(`/api/delivery-logs?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load delivery logs.");
      }

      setLogs(Array.isArray(json.data) ? json.data : []);
    } catch (error: any) {
      setNote(error?.message ?? "Failed to load delivery logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, status]);

  return (
    <main className="min-h-screen bg-[#EEF3FB] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[5px_5px_0_#171717]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-[#FF5C1A]">
                Core Communication
              </p>

              <h1 className="mt-2 text-3xl font-black text-[#171717]">
                Delivery Logs
              </h1>

              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                Track app, SMS and voice delivery events after the scheduler and
                cron processor run.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/scheduler"
                className="rounded-2xl border-2 border-[#171717] bg-[#FF5C1A] px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717]"
              >
                Scheduler
              </Link>

              <Link
                href="/"
                className="rounded-2xl border-2 border-[#171717] bg-white px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717]"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[4px_4px_0_#171717]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[#171717]">
                Delivery event table
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Latest delivery events for DEMO-001.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
                className="rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold"
              >
                <option value="">All channels</option>
                <option value="push">Push</option>
                <option value="sms">SMS</option>
                <option value="voice">Voice</option>
              </select>

              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold"
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="queued">Queued</option>
                <option value="sent">Sent</option>
                <option value="delivered">Delivered</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>

              <button
                type="button"
                onClick={loadLogs}
                className="rounded-xl border-2 border-[#171717] px-3 py-2 text-sm font-black"
              >
                Refresh
              </button>
            </div>
          </div>

          {note ? (
            <p className="mb-3 text-sm font-black text-red-700">{note}</p>
          ) : null}

          <div className="overflow-hidden rounded-[1.25rem] border-2 border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Participant
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Channel
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Provider
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Message preview
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Error
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-sm font-bold text-slate-500"
                      >
                        Loading delivery logs...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-sm font-bold text-slate-500"
                      >
                        No delivery logs found yet. Run the scheduler cron after
                        creating due schedules.
                      </td>
                    </tr>
                  ) : (
                    logs.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-700">
                          {dt(row.created_at)}
                        </td>

                        <td className="px-4 py-3 font-bold text-slate-700">
                          <p>{participantLabel(row)}</p>
                          <p className="text-xs text-slate-500">
                            {row.participants?.participant_code ?? "—"}
                          </p>
                        </td>

                        <td className="px-4 py-3 font-black text-slate-700">
                          {row.channel ?? "—"}
                        </td>

                        <td className="px-4 py-3 font-bold text-slate-700">
  <p>{row.provider ?? "—"}</p>
  <p className="text-xs text-slate-500">
    {row.provider_status ?? row.provider_message_id ?? ""}
  </p>
</td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-xs font-black ${statusClass(
                              row.status
                            )}`}
                          >
                            {row.status ?? "—"}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          <p className="max-w-md truncate text-xs font-semibold">
                            {row.request_payload?.message ??
                              row.request_payload?.body ??
                              row.request_payload?.reason ??
                              "—"}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-xs font-bold text-red-600">
                          {row.failure_reason ?? row.error_message ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-3 text-xs font-bold text-slate-500">
            This page reads from communication_delivery_events. It will populate
            after send-due processes push/SMS/voice delivery attempts.
          </p>
        </section>
      </div>
    </main>
  );
}