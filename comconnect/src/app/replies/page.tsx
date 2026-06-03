"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ReplyRow = {
  id: string;
  participant_id?: string | null;
  message_id?: string | null;
  reply_text?: string | null;
  reply_payload?: any;
  created_at?: string | null;
  created_offline_at?: string | null;
  synced_at?: string | null;
  participant?: {
    participant_code?: string | null;
    phone_number?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    metadata?: any;
  } | null;
  message?: {
    title?: string | null;
    body?: string | null;
    message_code?: string | null;
    channel?: string | null;
    status?: string | null;
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

function participantLabel(row: ReplyRow) {
  const participant = row.participant;

  if (!participant) return "Unknown participant";

  const fullName = `${participant.first_name ?? ""} ${
    participant.last_name ?? ""
  }`.trim();

  return (
    participant.metadata?.display_name ||
    fullName ||
    participant.participant_code ||
    "Unknown participant"
  );
}

function replyPreview(row: ReplyRow) {
  return (
    row.reply_text ||
    row.reply_payload?.reply_text ||
    row.reply_payload?.text ||
    row.reply_payload?.message ||
    "—"
  );
}

function messageLabel(row: ReplyRow) {
  return (
    row.message?.message_code ||
    row.message?.title ||
    row.message_id ||
    "—"
  );
}

export default function RepliesPage() {
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");

  async function loadReplies() {
    setLoading(true);
    setNote("");

    try {
      const response = await fetch("/api/replies?limit=100", {
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load replies.");
      }

      setReplies(Array.isArray(json.data) ? json.data : []);
    } catch (error: any) {
      setNote(error?.message ?? "Failed to load replies.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReplies();
  }, []);

  const filteredReplies = useMemo(() => {
    const text = search.trim().toLowerCase();

    if (!text) return replies;

    return replies.filter((row) => {
      const haystack = [
        participantLabel(row),
        row.participant?.participant_code,
        row.participant?.phone_number,
        messageLabel(row),
        row.message?.title,
        row.message?.body,
        replyPreview(row),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(text);
    });
  }, [replies, search]);

  return (
    <main className="min-h-screen bg-[#EEF3FB] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[5px_5px_0_#171717]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-[#FF5C1A]">
                Participant Engagement
              </p>

              <h1 className="mt-2 text-3xl font-black text-[#171717]">
                Replies
              </h1>

              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                View replies sent from the participant app, SMS, or connected
                response channels.
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
                href="/messages"
                className="rounded-2xl border-2 border-[#171717] bg-white px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717]"
              >
                Messages
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[4px_4px_0_#171717]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[#171717]">
                Reply inbox
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Latest replies from app_message_replies.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search participant, code, phone, message or reply"
                className="min-w-[280px] rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              />

              <button
                type="button"
                onClick={loadReplies}
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
                      Message
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Reply
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Sync
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-sm font-bold text-slate-500"
                      >
                        Loading replies...
                      </td>
                    </tr>
                  ) : filteredReplies.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-sm font-bold text-slate-500"
                      >
                        No replies found yet.
                      </td>
                    </tr>
                  ) : (
                    filteredReplies.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-700">
                          {dt(row.created_at)}
                        </td>

                        <td className="px-4 py-3 font-bold text-slate-700">
                          <p>{participantLabel(row)}</p>
                          <p className="text-xs text-slate-500">
                            {row.participant?.participant_code ?? "—"} ·{" "}
                            {row.participant?.phone_number ?? "—"}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          <p className="font-black">{messageLabel(row)}</p>
                          <p className="max-w-sm truncate text-xs font-semibold text-slate-500">
                            {row.message?.title ?? row.message?.body ?? "—"}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          <p className="max-w-lg whitespace-pre-wrap font-bold">
                            {replyPreview(row)}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-xs font-bold text-slate-500">
                          <p>Offline: {dt(row.created_offline_at)}</p>
                          <p>Synced: {dt(row.synced_at)}</p>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-3 text-xs font-bold text-slate-500">
            Replies are loaded from app_message_replies and linked to
            participants and app messages where available.
          </p>
        </section>
      </div>
    </main>
  );
}