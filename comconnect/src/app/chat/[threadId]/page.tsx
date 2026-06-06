"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  CompactCard,
  LinkButton,
  Notice,
  PageHeader,
  PageShell,
  PrimaryButton,
} from "@/components/comconnect-ui/DashboardUI";

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
    phone_number?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    metadata?: Record<string, any> | null;
  } | null;
  chat_messages?: ChatMessage[];
};

type CurrentContext = {
  organisation_name?: string | null;
  organisation_role?: string | null;
  active_project_name?: string | null;
  active_project_code?: string | null;
  project_role?: string | null;
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

function participantDisplayName(thread: ChatThread | null) {
  const participant = thread?.participants;

  return (
    participant?.metadata?.display_name ??
    `${participant?.first_name ?? ""} ${participant?.last_name ?? ""}`.trim() ??
    participant?.participant_code ??
    "Participant"
  );
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
    payload.message_text ?? payload.text ?? message.message_text ?? ""
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
        {messageText || "—"}
      </p>
    );
  }

  if (!mediaUrl) {
    return (
      <div className="mt-2 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm font-bold text-orange-800">
        {mediaTitle(type)} was received, but no playable media URL is available.
        {messageText ? <p className="mt-2 whitespace-pre-wrap">{messageText}</p> : null}
      </div>
    );
  }

  if (type === "audio") {
    return (
      <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-xs font-black uppercase text-slate-500">Voice note</p>
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
        <p className="mb-2 text-xs font-black uppercase text-slate-500">Image</p>
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
        <p className="mb-2 text-xs font-black uppercase text-slate-500">Video</p>
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
      <p className="mb-2 text-xs font-black uppercase text-slate-500">File</p>
      <a
        href={mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex rounded-xl bg-[#F26A21] px-3 py-2 text-xs font-black text-white"
      >
        Open {fileName}
      </a>
      {mimeType ? <p className="mt-2 text-xs font-bold text-slate-500">{mimeType}</p> : null}
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

  const [context, setContext] = useState<CurrentContext | null>(null);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendNote, setSendNote] = useState("");

  async function loadContext() {
    try {
      const response = await fetch("/api/context/current", {
        cache: "no-store",
      });

      const json = await response.json().catch(() => null);

      if (response.ok && json?.ok) {
        setContext(json.data as CurrentContext);
      }
    } catch {
      setContext(null);
    }
  }

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
        `/api/chat/threads?thread_id=${encodeURIComponent(threadId)}`,
        { cache: "no-store" }
      );

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load chat thread.");
      }

      const rows = Array.isArray(json.data) ? json.data : json.data?.rows ?? [];

      const found =
        rows.find((item: ChatThread) => item.id === threadId) ?? rows[0] ?? null;

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
            last_message_at: newMessage.created_at ?? new Date().toISOString(),
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
    void loadContext();
    void loadThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const participantName = participantDisplayName(thread);

  const messages = [...(thread?.chat_messages ?? [])].sort((a, b) => {
    const aTime = new Date(a.created_at ?? a.synced_at ?? 0).getTime();
    const bTime = new Date(b.created_at ?? b.synced_at ?? 0).getTime();

    return aTime - bTime;
  });

  return (
    <PageShell>
      <PageHeader
        eyebrow="Chat"
        title="Chat conversation"
        subtitle="View participant messages and reply from the dashboard."
        actions={
          <>
            <LinkButton href="/chat">Back to Chat</LinkButton>
            <LinkButton href="/inbox">Central Inbox</LinkButton>
            <LinkButton href="/">Dashboard</LinkButton>
          </>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <CompactCard>
          <p className="text-xs font-black uppercase text-slate-500">Organisation</p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {context?.organisation_name ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-slate-500">Project</p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {context?.active_project_name ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-slate-500">Project Code</p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {context?.active_project_code ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-slate-500">Role</p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {context?.project_role ?? context?.organisation_role ?? "—"}
          </p>
        </CompactCard>
      </div>

      {loading ? (
        <CompactCard>
          <p className="text-sm font-bold text-slate-600">Loading chat thread...</p>
        </CompactCard>
      ) : loadError ? (
        <Notice tone="danger">{loadError}</Notice>
      ) : thread ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <CompactCard title="Thread details">
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-black text-slate-500">Participant</p>
                <p className="font-extrabold">{participantName}</p>
              </div>

              <div>
                <p className="font-black text-slate-500">Participant code</p>
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
                <p className="font-extrabold">{thread.subject ?? "General chat"}</p>
              </div>

              <div>
                <p className="font-black text-slate-500">Status</p>
                <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase text-emerald-700">
                  {thread.status ?? "open"}
                </span>
              </div>

              <div>
                <p className="font-black text-slate-500">Last message</p>
                <p className="font-extrabold">{formatDate(thread.last_message_at)}</p>
              </div>
            </div>
          </CompactCard>

          <CompactCard
            title="Conversation"
            subtitle="Text, voice notes, images, videos and files."
            action={
              <button
                type="button"
                onClick={loadThread}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700"
              >
                Refresh
              </button>
            }
          >
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
                        {participant ? participantName : messageLabel(message)}
                      </p>

                      <MediaMessageContent message={message} />

                      <p className="mt-2 text-xs font-bold text-slate-500">
                        {formatDate(message.created_at ?? message.synced_at)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
              <label className="text-sm font-black text-slate-700">
                Reply to participant
              </label>

              <textarea
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                placeholder="Type a message to send to the participant..."
                className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold outline-none focus:border-[#F26A21]"
              />

              {sendNote ? (
                <p className="mt-2 text-sm font-bold text-slate-600">{sendNote}</p>
              ) : null}

              <div className="mt-3">
                <PrimaryButton onClick={sendReply} disabled={sending}>
                  {sending ? "Sending..." : "Send message"}
                </PrimaryButton>
              </div>
            </div>
          </CompactCard>
        </div>
      ) : null}
    </PageShell>
  );
}