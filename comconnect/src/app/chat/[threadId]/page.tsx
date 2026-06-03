"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type ChatMessage = {
  id: string;
  thread_id: string;
  participant_id: string;
  sender_type?: string | null;
  sender_user_id?: string | null;
  message_text?: string | null;
  payload?: Record<string, unknown> | null;
  created_at?: string | null;
  synced_at?: string | null;
  read_at?: string | null;
  local_id?: string | null;
};

type ChatThread = {
  id: string;
  organisation_id: string;
  project_id: string;
  participant_id: string;
  subject?: string | null;
  status?: string | null;
  assigned_user_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_message_at?: string | null;
  participants?: {
    participant_code?: string | null;
    display_name?: string | null;
    phone_number?: string | null;
  } | null;
  chat_messages?: ChatMessage[];
};

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function isParticipantMessage(message: ChatMessage) {
  return message.sender_type === "participant";
}

function messageLabel(message: ChatMessage) {
  if (isParticipantMessage(message)) return "Participant";
  if (message.sender_type === "team") return "Study team";
  if (message.sender_type === "staff") return "Study team";
  if (message.sender_type === "admin") return "Study team";
  return "Study team";
}

export default function ChatThreadDetailPage() {
  const params = useParams();
  const threadId = String(params?.threadId ?? "");

  const [thread, setThread] = useState<ChatThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendNote, setSendNote] = useState("");

  async function loadThread() {
    if (!threadId || threadId === "undefined") {
      setLoadError("Thread ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError("");

    try {
      const response = await fetch(
        `/api/chat/threads?thread_id=${encodeURIComponent(threadId)}`
      );

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load chat thread.");
      }

      const rows = Array.isArray(json.data)
        ? json.data
        : json.data?.rows ?? [];

      const found =
        rows.find((item: ChatThread) => item.id === threadId) ??
        rows[0] ??
        null;

      if (!found) {
        throw new Error("Chat thread was not found.");
      }

      setThread(found);
    } catch (error: any) {
      setLoadError(error?.message ?? "Failed to load chat thread.");
    } finally {
      setLoading(false);
    }
  }

  async function sendReply() {
    const trimmed = replyText.trim();

    if (!trimmed) {
      setSendNote("Type a message before sending.");
      return;
    }

    setSending(true);
    setSendNote("");

    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          thread_id: threadId,
          message_text: trimmed,
          sender_type: "team",
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to send message.");
      }

      const newMessage = json.data?.message as ChatMessage | undefined;

      if (newMessage) {
        setThread((current) => {
          if (!current) return current;

          return {
            ...current,
            chat_messages: [...(current.chat_messages ?? []), newMessage],
            last_message_at:
              newMessage.created_at ?? new Date().toISOString(),
          };
        });
      }

      const pushResult = json.data?.push_result;

      setReplyText("");

      if (pushResult?.sent && pushResult.sent > 0) {
        setSendNote("Message sent and push notification delivered.");
      } else if (pushResult?.reason === "no_active_push_tokens") {
        setSendNote("Message sent. No active participant push token yet.");
      } else {
        setSendNote("Message sent.");
      }
    } catch (error: any) {
      setSendNote(error?.message ?? "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    loadThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const participantName =
    thread?.participants?.display_name ||
    thread?.participants?.participant_code ||
    "Participant";

  const messages = [...(thread?.chat_messages ?? [])].sort((a, b) => {
    const aTime = new Date(a.created_at ?? a.synced_at ?? 0).getTime();
    const bTime = new Date(b.created_at ?? b.synced_at ?? 0).getTime();

    return aTime - bTime;
  });

  return (
    <main className="min-h-screen bg-[#FFF7F2] p-4 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[#F26A21]">
              ComConnect
            </p>
            <h1 className="text-2xl font-black text-slate-950">
              Chat conversation
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              View participant messages and send replies with app push
              notification.
            </p>
          </div>

          <Link
            href="/chat"
            className="rounded-2xl border-2 border-slate-950 bg-white px-4 py-2 text-sm font-black shadow-[2px_2px_0_#171717]"
          >
            Back to chat list
          </Link>
        </div>

        {loading ? (
          <section className="rounded-3xl border-2 border-slate-950 bg-white p-5 font-bold shadow-[3px_3px_0_#171717]">
            Loading chat thread...
          </section>
        ) : loadError ? (
          <section className="rounded-3xl border-2 border-red-700 bg-white p-5 text-sm font-bold text-red-700 shadow-[3px_3px_0_#171717]">
            {loadError}
          </section>
        ) : thread ? (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <section className="rounded-3xl border-2 border-slate-950 bg-white p-5 shadow-[3px_3px_0_#171717]">
              <h2 className="text-lg font-black">Thread details</h2>

              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="font-black text-slate-500">Participant</p>
                  <p className="font-extrabold">{participantName}</p>
                </div>

                <div>
                  <p className="font-black text-slate-500">
                    Participant code
                  </p>
                  <p className="font-extrabold">
                    {thread.participants?.participant_code ?? "Not recorded"}
                  </p>
                </div>

                <div>
                  <p className="font-black text-slate-500">Phone</p>
                  <p className="font-extrabold">
                    {thread.participants?.phone_number ?? "Not recorded"}
                  </p>
                </div>

                <div>
                  <p className="font-black text-slate-500">Subject</p>
                  <p className="font-extrabold">
                    {thread.subject ?? "General chat"}
                  </p>
                </div>

                <div>
                  <p className="font-black text-slate-500">Status</p>
                  <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase text-emerald-700">
                    {thread.status ?? "open"}
                  </span>
                </div>

                <div>
                  <p className="font-black text-slate-500">Last message</p>
                  <p className="font-extrabold">
                    {formatDate(thread.last_message_at)}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border-2 border-slate-950 bg-white p-5 shadow-[3px_3px_0_#171717]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">Conversation</h2>
                  <p className="text-sm font-semibold text-slate-600">
                    Messages between the participant and study/care team.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadThread}
                  className="rounded-2xl border-2 border-slate-950 bg-white px-3 py-2 text-xs font-black shadow-[2px_2px_0_#171717]"
                >
                  Refresh
                </button>
              </div>

              <div className="max-h-[520px] space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-3">
                {messages.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-600">
                    No messages yet. Type the first team message below.
                  </div>
                ) : (
                  messages.map((message) => {
                    const participant = isParticipantMessage(message);

                    return (
                      <div
                        key={message.id ?? message.local_id}
                        className={`max-w-[86%] rounded-2xl border-2 p-3 ${
                          participant
                            ? "mr-auto border-slate-950 bg-white"
                            : "ml-auto border-[#F26A21] bg-[#FFF7F2]"
                        }`}
                      >
                        <p className="text-xs font-black uppercase text-slate-500">
                          {participant
                            ? participantName
                            : messageLabel(message)}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm font-bold leading-6">
                          {message.message_text ?? ""}
                        </p>
                        <p className="mt-2 text-xs font-bold text-slate-500">
                          {formatDate(
                            message.created_at ?? message.synced_at
                          )}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-4 rounded-2xl border-2 border-slate-950 bg-white p-3">
                <label className="text-sm font-black text-slate-700">
                  Reply to participant
                </label>

                <textarea
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Type a message to send to the participant..."
                  className="mt-2 min-h-28 w-full rounded-2xl border-2 border-slate-950 bg-white p-3 text-sm font-semibold outline-none"
                />

                {sendNote ? (
                  <p className="mt-2 text-sm font-bold text-slate-600">
                    {sendNote}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={sendReply}
                  disabled={sending}
                  className="mt-3 rounded-2xl border-2 border-slate-950 bg-[#F26A21] px-4 py-3 text-sm font-black text-slate-950 shadow-[2px_2px_0_#171717] disabled:opacity-60"
                >
                  {sending ? "Sending..." : "Send message"}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}