"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type ChatPayload = Record<string, any>;

type ChatMessage = {
  id: string;
  thread_id: string;
  participant_id: string;
  sender_type?: string | null;
  sender_user_id?: string | null;
  message_text?: string | null;
  payload?: ChatPayload | null;
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

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

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

function getMessageType(message: ChatMessage) {
  const payload = message.payload ?? {};

  const raw = cleanText(
    payload.message_type ??
      payload.media_type ??
      payload.media?.message_type ??
      payload.media?.media_type
  ).toLowerCase();

  if (raw === "audio" || raw === "voice" || raw === "voice_note") return "audio";
  if (raw === "image" || raw === "photo") return "image";
  if (raw === "video") return "video";
  if (raw === "file") return "file";

  return "text";
}

function getMediaUrl(message: ChatMessage) {
  const payload = message.payload ?? {};

  return cleanText(
    payload.media_url ??
      payload.url ??
      payload.file_url ??
      payload.media?.media_url ??
      payload.media?.url ??
      payload.media?.file_url
  );
}

function getMediaMimeType(message: ChatMessage) {
  const payload = message.payload ?? {};

  return cleanText(
    payload.media_mime_type ??
      payload.mime_type ??
      payload.media?.media_mime_type ??
      payload.media?.mime_type
  );
}

function getMediaFileName(message: ChatMessage) {
  const payload = message.payload ?? {};

  return (
    cleanText(
      payload.media_filename ??
        payload.file_name ??
        payload.media?.media_filename ??
        payload.media?.file_name
    ) || "media file"
  );
}

function getMessageText(message: ChatMessage) {
  const payload = message.payload ?? {};

  return cleanText(
    payload.message_text ??
      payload.text ??
      message.message_text ??
      ""
  );
}

function mediaTitle(type: string) {
  if (type === "audio") return "Voice note";
  if (type === "image") return "Image";
  if (type === "video") return "Video";
  if (type === "file") return "File";
  return "Message";
}

function MediaMessageContent({ message }: { message: ChatMessage }) {
  const type = getMessageType(message);
  const mediaUrl = getMediaUrl(message);
  const mimeType = getMediaMimeType(message);
  const fileName = getMediaFileName(message);
  const messageText = getMessageText(message);

  if (type === "text") {
    return (
      <p className="mt-1 whitespace-pre-wrap text-sm font-bold leading-6">
        {messageText}
      </p>
    );
  }

  if (!mediaUrl) {
    return (
      <div className="mt-2 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm font-bold text-orange-800">
        {mediaTitle(type)} was received, but no playable media URL is available.
        {messageText ? (
          <p className="mt-2 whitespace-pre-wrap">{messageText}</p>
        ) : null}
      </div>
    );
  }

  if (type === "audio") {
    return (
      <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-xs font-black uppercase text-slate-500">
          Voice note
        </p>
        <audio controls src={mediaUrl} className="w-full">
          Your browser does not support audio playback.
        </audio>
        {messageText ? (
          <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6">
            {messageText}
          </p>
        ) : null}
      </div>
    );
  }

  if (type === "image") {
    return (
      <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-xs font-black uppercase text-slate-500">
          Image
        </p>
        <a href={mediaUrl} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt={fileName}
            className="max-h-80 w-full rounded-xl object-contain"
          />
        </a>
        {messageText ? (
          <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6">
            {messageText}
          </p>
        ) : null}
      </div>
    );
  }

  if (type === "video") {
    return (
      <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-xs font-black uppercase text-slate-500">
          Video
        </p>
        <video controls src={mediaUrl} className="max-h-96 w-full rounded-xl">
          Your browser does not support video playback.
        </video>
        {messageText ? (
          <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6">
            {messageText}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-black uppercase text-slate-500">
        File
      </p>
      <a
        href={mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex rounded-xl bg-[#F26A21] px-3 py-2 text-xs font-black text-white"
      >
        Open {fileName}
      </a>
      {mimeType ? (
        <p className="mt-2 text-xs font-bold text-slate-500">{mimeType}</p>
      ) : null}
      {messageText ? (
        <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6">
          {messageText}
        </p>
      ) : null}
    </div>
  );
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
          payload: {
            message_type: "text",
            message_text: trimmed,
          },
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
              View participant text, voice notes, images, videos and send
              replies with app push notification.
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

                        <MediaMessageContent message={message} />

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