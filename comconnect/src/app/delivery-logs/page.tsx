"use client";

import { useEffect, useState } from "react";
import {
  CompactCard,
  FieldLabel,
  LinkButton,
  Notice,
  PageHeader,
  PageShell,
  SecondaryButton,
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
      <PageHeader
        eyebrow="Core communication"
        title="Delivery logs"
        subtitle="Monitor delivery status across channels."
        actions={
          <>
            <LinkButton href="/scheduler">Scheduler</LinkButton>
            <LinkButton href="/">Dashboard</LinkButton>
          </>
        }
      />

      {note ? <Notice tone="danger">{note}</Notice> : null}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <CompactCard>
          <p className="text-xs font-black uppercase text-slate-500">
            Organisation
          </p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {loadingContext
              ? "Loading..."
              : context?.organisation_name ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-slate-500">Project</p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {loadingContext
              ? "Loading..."
              : context?.active_project_name ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-slate-500">Loaded</p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {logs.length}
          </p>
        </CompactCard>
      </div>

      <CompactCard
        title="Delivery events"
        subtitle="Latest delivery records."
        action={
          <SecondaryButton onClick={loadLogs} disabled={loading || !context}>
            {loading ? "Refreshing..." : "Refresh"}
          </SecondaryButton>
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

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-[#FFF7F2]">
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
                    Message
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
                      Loading...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-sm font-bold text-slate-500"
                    >
                      No delivery logs.
                    </td>
                  </tr>
                ) : (
                  logs.map((row) => (
                    <tr key={row.id} className="hover:bg-[#FFF7F2]">
                      <td className="px-4 py-3 font-bold text-slate-700">
                        {dt(row.created_at)}
                      </td>

                      <td className="px-4 py-3 font-bold text-slate-700">
                        <p>{participantLabel(row)}</p>
                        <p className="text-xs text-slate-500">
                          {row.participants?.participant_code ??
                            row.phone_number ??
                            "—"}
                        </p>
                      </td>

                      <td className="px-4 py-3 font-black text-slate-700">
                        {channelLabel(row)}
                      </td>

                      <td className="px-4 py-3 font-bold text-slate-700">
                        <p>{row.provider ?? "—"}</p>
                        <p className="text-xs text-slate-500">
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

                      <td className="px-4 py-3 text-slate-700">
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