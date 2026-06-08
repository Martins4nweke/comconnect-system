"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CompactCard,
  FieldLabel,
  Notice,
  PageShell,
  SelectInput,
  StatusPill,
} from "@/components/comconnect-ui/DashboardUI";

type CurrentContext = {
  organisation_id?: string | null;
  organisation_name?: string | null;
  organisation_role?: string | null;
  active_project_id?: string | null;
  active_project_name?: string | null;
  project_role?: string | null;
};

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

const pageLinkClass =
  "rounded-2xl border border-[#C9D8E4] bg-white px-4 py-2 text-sm font-black text-[#06324A] shadow-sm hover:border-[#0A5278] hover:text-[#0A5278]";

const secondaryButtonClass =
  "rounded-xl border border-[#C9D8E4] bg-white px-4 py-2 text-xs font-black text-[#06324A] hover:border-[#0A5278] hover:text-[#0A5278] disabled:cursor-not-allowed disabled:opacity-50";

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

  if (!participant) return row.phone_number ?? "—";

  const fullName = `${participant.first_name ?? ""} ${
    participant.last_name ?? ""
  }`.trim();

  return (
    participant.metadata?.display_name ||
    fullName ||
    participant.participant_code ||
    row.phone_number ||
    "—"
  );
}

function statusTone(
  status?: string | null
): "success" | "warning" | "danger" | "info" | "neutral" {
  const text = String(status ?? "").toLowerCase();

  if (
    [
      "sent",
      "delivered",
      "completed",
      "published",
      "submitted_to_provider",
    ].includes(text)
  ) {
    return "success";
  }

  if (
    text === "failed" ||
    text === "error" ||
    text === "expired" ||
    text.includes("reject")
  ) {
    return "danger";
  }

  if (
    text === "pending" ||
    text === "queued" ||
    text === "provider_pending" ||
    text.includes("enroute")
  ) {
    return "warning";
  }

  return "neutral";
}

function statusLabel(status?: string | null) {
  const text = String(status ?? "").trim();

  if (!text) return "—";
  if (text === "submitted_to_provider") return "submitted";
  if (text === "provider_pending") return "provider pending";
  if (text === "published") return "published";
  return text;
}

function channelLabel(row: DeliveryLog) {
  if (row.channel === "app") return "App";
  if (row.channel === "push") return "Push";
  if (row.channel === "sms") return "SMS";
  if (row.channel === "voice") return "Voice";
  if (row.channel === "whatsapp") return "WhatsApp";
  return row.channel ?? "—";
}

function messagePreview(row: DeliveryLog) {
  return (
    row.request_payload?.message ??
    row.request_payload?.message_body ??
    row.request_payload?.body ??
    row.request_payload?.text ??
    row.request_payload?.reason ??
    "—"
  );
}

export default function DeliveryLogsPage() {
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");

  async function loadContext() {
    setLoadingContext(true);
    setNote("");

    try {
      const response = await fetch("/api/context/current", {
        cache: "no-store",
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load context.");
      }

      setContext(json.data as CurrentContext);
    } catch (error: any) {
      setNote(error?.message ?? "Failed to load context.");
    } finally {
      setLoadingContext(false);
    }
  }

  async function loadLogs() {
    if (!context) return;

    setLoading(true);
    setNote("");

    try {
      const params = new URLSearchParams();
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
    void loadContext();
  }, []);

  useEffect(() => {
    if (context) {
      void loadLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.active_project_id, channel, status]);

  return (
    <PageShell>
      <section className="mb-5 rounded-[2rem] border border-[#C9D8E4] bg-[#032A3D] p-6 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#C9D8E4]">
          Core communication
        </p>

        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              Delivery logs
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#EAF2F8]">
              Monitor delivery status across app, push, SMS, voice and WhatsApp
              channels.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/" className={pageLinkClass}>
              Dashboard
            </Link>
            <Link href="/scheduler" className={pageLinkClass}>
              Scheduler
            </Link>
            <Link href="/messages" className={pageLinkClass}>
              Messages
            </Link>
          </div>
        </div>
      </section>

      {note ? <Notice tone="danger">{note}</Notice> : null}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <CompactCard>
          <p className="text-xs font-black uppercase text-[#536271]">
            Organisation
          </p>
          <p className="mt-1 text-sm font-black text-[#06324A]">
            {loadingContext ? "Loading..." : context?.organisation_name ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-[#536271]">
            Project
          </p>
          <p className="mt-1 text-sm font-black text-[#06324A]">
            {loadingContext ? "Loading..." : context?.active_project_name ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-[#536271]">
            Loaded
          </p>
          <p className="mt-1 text-sm font-black text-[#06324A]">
            {logs.length}
          </p>
        </CompactCard>
      </div>

      <CompactCard
        title="Delivery events"
        subtitle="Latest delivery records."
        action={
          <button
            type="button"
            onClick={loadLogs}
            disabled={loading || !context}
            className={secondaryButtonClass}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        }
      >
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <FieldLabel label="Channel">
            <SelectInput
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
            >
              <option value="">All channels</option>
              <option value="app">App</option>
              <option value="push">Push</option>
              <option value="sms">SMS</option>
              <option value="voice">Voice</option>
              <option value="whatsapp">WhatsApp</option>
            </SelectInput>
          </FieldLabel>

          <FieldLabel label="Status">
            <SelectInput
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="queued">Queued</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="published">Published</option>
              <option value="submitted_to_provider">Submitted</option>
              <option value="provider_pending">Provider pending</option>
              <option value="completed">Completed</option>
              <option value="expired">Expired</option>
              <option value="failed">Failed</option>
            </SelectInput>
          </FieldLabel>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#C9D8E4] bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#C9D8E4] text-sm">
              <thead className="bg-[#EAF2F8]">
                <tr>
                  <th className="px-4 py-3 text-left font-black text-[#06324A]">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left font-black text-[#06324A]">
                    Participant
                  </th>
                  <th className="px-4 py-3 text-left font-black text-[#06324A]">
                    Channel
                  </th>
                  <th className="px-4 py-3 text-left font-black text-[#06324A]">
                    Provider
                  </th>
                  <th className="px-4 py-3 text-left font-black text-[#06324A]">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-black text-[#06324A]">
                    Message
                  </th>
                  <th className="px-4 py-3 text-left font-black text-[#06324A]">
                    Error
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#EAF2F8]">
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-sm font-bold text-[#536271]"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-sm font-bold text-[#536271]"
                    >
                      No delivery logs.
                    </td>
                  </tr>
                ) : (
                  logs.map((row) => (
                    <tr key={row.id} className="hover:bg-[#EAF2F8]">
                      <td className="px-4 py-3 font-bold text-[#06324A]">
                        {dt(row.created_at)}
                      </td>

                      <td className="px-4 py-3 font-bold text-[#06324A]">
                        <p>{participantLabel(row)}</p>
                        <p className="text-xs text-[#536271]">
                          {row.participants?.participant_code ??
                            row.phone_number ??
                            "—"}
                        </p>
                      </td>

                      <td className="px-4 py-3 font-black text-[#06324A]">
                        {channelLabel(row)}
                      </td>

                      <td className="px-4 py-3 font-bold text-[#06324A]">
                        <p>{row.provider ?? "—"}</p>
                        <p className="text-xs text-[#536271]">
                          {row.provider_status ??
                            row.provider_message_id ??
                            ""}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <StatusPill tone={statusTone(row.status)}>
                          {statusLabel(row.status)}
                        </StatusPill>
                      </td>

                      <td className="px-4 py-3 text-[#06324A]">
                        <p className="max-w-md truncate text-xs font-semibold">
                          {messagePreview(row)}
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
      </CompactCard>
    </PageShell>
  );
}