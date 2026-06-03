"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

type Channel = "sms" | "whatsapp" | "voice" | "app_push";

type MessageDraft = {
  message_code: string;
  title: string;
  channel: Channel;
  language: string;
  body: string;
  media_url: string;
  audio_url: string;
  video_url: string;
  status: "draft" | "ready" | "archived";
};

type SavedMessage = {
  id: string;
  message_code: string;
  message_title: string;
  message_body: string;
  channel: string;
  language: string;
  category?: string | null;
  delivery_mode?: string | null;
  allowed_channels?: string[] | null;
  media_type?: string | null;
  media_url?: string | null;
  audio_url?: string | null;
  video_url?: string | null;
  status: string;
  created_at?: string | null;
};

type SelectedParticipant = {
  id: string;
  participant_code: string;
  phone_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  preferred_language?: string | null;
  app_access_enabled?: boolean | null;
  status?: string | null;
  metadata?: {
    display_name?: string | null;
    preferred_channel?: string | null;
    whatsapp_number?: string | null;
    quiet_time_enabled?: boolean;
    quiet_time_start?: string;
    quiet_time_end?: string;
  };
};

const channels: { value: Channel; label: string }[] = [
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "voice", label: "Voice" },
  { value: "app_push", label: "App / Push" },
];

const defaultMessageBody = "Hello {{name}}, this is a message from ComConnect.";

function participantName(participant?: SelectedParticipant | null) {
  if (!participant) return "Participant";

  return (
    participant.metadata?.display_name ??
    `${participant.first_name ?? ""} ${participant.last_name ?? ""}`.trim() ??
    participant.participant_code ??
    "Participant"
  );
}

function personaliseTemplate(
  text: string,
  participant?: SelectedParticipant | null
) {
  if (!participant) return text;

  const name = participantName(participant);
  const firstName = participant.first_name ?? name.split(" ")[0] ?? "";
  const preferredChannel = participant.metadata?.preferred_channel ?? "app";

  return text
    .replaceAll("{{name}}", name)
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{participant_code}}", participant.participant_code ?? "")
    .replaceAll("{{phone_number}}", participant.phone_number ?? "")
    .replaceAll("{{preferred_channel}}", preferredChannel)
    .replaceAll("{{language}}", participant.preferred_language ?? "en");
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      currentValue += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      currentRow.push(currentValue.trim());
      currentValue = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentValue.trim());

      if (currentRow.some((value) => value !== "")) {
        rows.push(currentRow);
      }

      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  currentRow.push(currentValue.trim());

  if (currentRow.some((value) => value !== "")) {
    rows.push(currentRow);
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim()).filter(Boolean);

  return rows.slice(1).map((values) => {
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });
}

async function parseUploadFile(file: File) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return [];
    }

    const worksheet = workbook.Sheets[firstSheetName];

    return XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, {
      defval: "",
    });
  }

  const text = await file.text();
  return parseCsv(text);
}

function getMediaType(message: MessageDraft) {
  if (message.video_url) return "video";
  if (message.audio_url) return "audio";
  if (message.media_url) return "other";
  return "text";
}

function schedulerHref({
  row,
  participantId,
  participantCode,
  selectedParticipant,
}: {
  row: SavedMessage;
  participantId: string | null;
  participantCode: string | null;
  selectedParticipant: SelectedParticipant | null;
}) {
  const params = new URLSearchParams();

  params.set("message_code", row.message_code);

  if (participantId) {
    params.set("participant_id", participantId);
    params.set(
      "participant_code",
      participantCode ?? selectedParticipant?.participant_code ?? ""
    );
  }

  return `/scheduler?${params.toString()}`;
}

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const participantId = searchParams.get("participant_id");
  const participantCode = searchParams.get("participant_code");

  const mediaUrlFromLibrary = searchParams.get("mediaUrl");
  const mediaTypeFromLibrary = searchParams.get("mediaType");
  const mediaTitleFromLibrary = searchParams.get("mediaTitle");

  const bulkInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedParticipant, setSelectedParticipant] =
    useState<SelectedParticipant | null>(null);
  const [loadingParticipant, setLoadingParticipant] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [savedMessages, setSavedMessages] = useState<SavedMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [message, setMessage] = useState<MessageDraft>({
    message_code: "",
    title: "",
    channel: "sms",
    language: "en",
    body: defaultMessageBody,
    media_url: "",
    audio_url: "",
    video_url: "",
    status: "draft",
  });

  const [note, setNote] = useState("");

  useEffect(() => {
    async function loadParticipant() {
      if (!participantId) return;

      setLoadingParticipant(true);
      setNote("");

      try {
        const response = await fetch(`/api/participants/${participantId}`, {
          cache: "no-store",
        });

        const json = await response.json();

        if (!response.ok || !json?.ok) {
          throw new Error(json?.error ?? "Failed to load participant.");
        }

        const participant = json.data as SelectedParticipant;
        setSelectedParticipant(participant);

        const preferred = participant.metadata?.preferred_channel ?? "app";

        setMessage((current) => ({
          ...current,
          language: participant.preferred_language ?? current.language,
          channel:
            preferred === "sms"
              ? "sms"
              : preferred === "whatsapp"
              ? "whatsapp"
              : preferred === "voice"
              ? "voice"
              : "app_push",
        }));
      } catch (error: any) {
        setNote(error?.message ?? "Failed to load participant.");
      } finally {
        setLoadingParticipant(false);
      }
    }

    loadParticipant();
  }, [participantId]);

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    if (!mediaUrlFromLibrary) return;

    const mediaType = String(mediaTypeFromLibrary ?? "").toLowerCase();
    const mediaTitle = mediaTitleFromLibrary ?? "Media message";

    setMessage((current) => {
      const nextMessage = {
        ...current,
        title: current.title || mediaTitle,
        body:
          current.body === defaultMessageBody
            ? `Hello {{name}}, please open this ComConnect media update: ${mediaUrlFromLibrary}`
            : current.body,
        media_url: mediaUrlFromLibrary,
      };

      if (mediaType === "audio") {
        return {
          ...nextMessage,
          channel: "voice",
          audio_url: mediaUrlFromLibrary,
          video_url: "",
        };
      }

      if (mediaType === "video") {
        return {
          ...nextMessage,
          channel: "whatsapp",
          video_url: mediaUrlFromLibrary,
          audio_url: "",
        };
      }

      return {
        ...nextMessage,
        audio_url: "",
        video_url: "",
      };
    });

    setNote(
      `Media from library added to the message form: ${mediaTitle}. Review it, add a message code, then click Create message.`
    );
  }, [mediaUrlFromLibrary, mediaTypeFromLibrary, mediaTitleFromLibrary]);

  function updateMessage(patch: Partial<MessageDraft>) {
    setMessage((current) => ({ ...current, ...patch }));
  }

  async function loadMessages() {
    setLoadingMessages(true);

    try {
      const response = await fetch("/api/messages?project_code=DEMO-001", {
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load messages.");
      }

      setSavedMessages(Array.isArray(json.data) ? json.data : []);
    } catch (error: any) {
      setNote(error?.message ?? "Failed to load messages.");
    } finally {
      setLoadingMessages(false);
    }
  }

  async function handleBulkMessageFile(file: File) {
    setNote("");
    setBulkBusy(true);

    try {
      const messages = await parseUploadFile(file);

      if (messages.length === 0) {
        throw new Error("No valid message rows found in the uploaded file.");
      }

      const response = await fetch("/api/messages/bulk-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Bulk message upload failed.");
      }

      setNote(
        `Bulk message upload complete. Inserted/updated ${
          json.data?.inserted_or_updated_count ?? 0
        } message(s).`
      );

      await loadMessages();
    } catch (error: any) {
      setNote(error?.message ?? "Bulk message upload failed.");
    } finally {
      setBulkBusy(false);

      if (bulkInputRef.current) {
        bulkInputRef.current.value = "";
      }
    }
  }

  async function createMessage() {
    setNote("");

    if (!message.message_code.trim()) {
      setNote("Message code is required.");
      return;
    }

    if (!message.title.trim()) {
      setNote("Message title is required.");
      return;
    }

    if (!message.body.trim()) {
      setNote("Message body is required.");
      return;
    }

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_code: "DEMO-001",
          message_code: message.message_code.trim(),
          message_title: message.title.trim(),
          message_body: message.body.trim(),
          channel: message.channel === "app_push" ? "app" : message.channel,
          language: message.language,
          status: message.status,
          media_type: getMediaType(message),
          media_url: message.media_url || null,
          audio_url: message.audio_url || null,
          video_url: message.video_url || null,
          delivery_mode: "participant_preference",
          allowed_channels: ["app", "sms", "voice", "whatsapp"],
          metadata: {
            created_from: "messages_page",
          },
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to create message.");
      }

      setNote("Message saved successfully.");
      await loadMessages();
    } catch (error: any) {
      setNote(error?.message ?? "Failed to create message.");
    }
  }

  const personalisedPreview = personaliseTemplate(
    message.body,
    selectedParticipant
  );

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
                Message Library
              </h1>

              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                Create and manage reusable SMS, WhatsApp, voice and app
                messages. Use variables like {"{{name}}"},{" "}
                {"{{participant_code}}"} and {"{{phone_number}}"} for
                personalisation.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/participants"
                className="rounded-2xl border-2 border-[#171717] bg-white px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717]"
              >
                Participants
              </Link>

              <Link
                href="/media-library"
                className="rounded-2xl border-2 border-[#171717] bg-[#FFF7F2] px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717]"
              >
                Media Library
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

        {participantId || participantCode ? (
          <section className="rounded-[2rem] border-2 border-[#171717] bg-[#FFF7F2] p-5 shadow-[4px_4px_0_#171717]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[#FF5C1A]">
                  Selected participant
                </p>

                {loadingParticipant ? (
                  <p className="mt-2 text-sm font-bold text-slate-600">
                    Loading participant...
                  </p>
                ) : selectedParticipant ? (
                  <div className="mt-2 grid gap-2 text-sm font-bold text-slate-700 md:grid-cols-4">
                    <p>
                      <span className="text-slate-500">Code:</span>{" "}
                      {selectedParticipant.participant_code}
                    </p>
                    <p>
                      <span className="text-slate-500">Name:</span>{" "}
                      {participantName(selectedParticipant)}
                    </p>
                    <p>
                      <span className="text-slate-500">Phone:</span>{" "}
                      {selectedParticipant.phone_number ?? "—"}
                    </p>
                    <p>
                      <span className="text-slate-500">Channel:</span>{" "}
                      {selectedParticipant.metadata?.preferred_channel ?? "app"}
                    </p>
                    <p>
                      <span className="text-slate-500">Quiet time:</span>{" "}
                      {selectedParticipant.metadata?.quiet_time_enabled ===
                      false
                        ? "Off"
                        : `${
                            selectedParticipant.metadata?.quiet_time_start ??
                            "20:00"
                          }–${
                            selectedParticipant.metadata?.quiet_time_end ??
                            "07:00"
                          }`}
                    </p>
                    <p>
                      <span className="text-slate-500">Language:</span>{" "}
                      {selectedParticipant.preferred_language ?? "en"}
                    </p>
                    <p>
                      <span className="text-slate-500">App:</span>{" "}
                      {selectedParticipant.app_access_enabled
                        ? "Enabled"
                        : "Disabled"}
                    </p>
                    <p>
                      <span className="text-slate-500">Status:</span>{" "}
                      {selectedParticipant.status ?? "—"}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm font-bold text-slate-600">
                    Participant passed from URL:{" "}
                    {participantCode ?? participantId}
                  </p>
                )}
              </div>

              {participantId ? (
                <Link
                  href={`/scheduler?participant_id=${encodeURIComponent(
                    participantId
                  )}&participant_code=${encodeURIComponent(
                    participantCode ??
                      selectedParticipant?.participant_code ??
                      ""
                  )}`}
                  className="rounded-2xl border-2 border-[#171717] bg-[#FF5C1A] px-4 py-3 text-sm font-black text-black shadow-[3px_3px_0_#171717]"
                >
                  Schedule for this participant
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {channels.map((channel) => (
            <div
              key={channel.value}
              className="rounded-[1.5rem] border-2 border-[#171717] bg-white p-5 shadow-[3px_3px_0_#171717]"
            >
              <p className="text-sm font-black text-[#FF5C1A]">
                {channel.label}
              </p>
              <p className="mt-2 text-sm font-bold text-slate-600">
                Draft, approve and prepare {channel.label.toLowerCase()}{" "}
                messages for scheduler.
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[4px_4px_0_#171717]">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[#171717]">
                Create new message
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Add a message template. If a participant is selected, the
                preview below will be personalised.
              </p>
            </div>

            <div>
              <input
                ref={bulkInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleBulkMessageFile(file);
                }}
              />

              <button
                type="button"
                disabled={bulkBusy}
                className="rounded-2xl border-2 border-[#171717] bg-white px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717] disabled:opacity-60"
                onClick={() => bulkInputRef.current?.click()}
              >
                {bulkBusy ? "Uploading..." : "Bulk upload messages"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={message.message_code}
              onChange={(event) =>
                updateMessage({ message_code: event.target.value })
              }
              placeholder="Message code, e.g. HTN-W01-MON"
              className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
            />

            <input
              value={message.title}
              onChange={(event) => updateMessage({ title: event.target.value })}
              placeholder="Message title"
              className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
            />

            <select
              value={message.channel}
              onChange={(event) =>
                updateMessage({ channel: event.target.value as Channel })
              }
              className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
            >
              {channels.map((channel) => (
                <option key={channel.value} value={channel.value}>
                  {channel.label}
                </option>
              ))}
            </select>

            <select
              value={message.language}
              onChange={(event) =>
                updateMessage({ language: event.target.value })
              }
              className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
            >
              <option value="en">English</option>
              <option value="zu">isiZulu</option>
            </select>

            <select
              value={message.status}
              onChange={(event) =>
                updateMessage({
                  status: event.target.value as MessageDraft["status"],
                })
              }
              className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
            >
              <option value="draft">Draft</option>
              <option value="ready">Ready for scheduler</option>
              <option value="archived">Archived</option>
            </select>

            <input
              value={message.media_url}
              onChange={(event) =>
                updateMessage({ media_url: event.target.value })
              }
              placeholder="Media URL optional"
              className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
            />

            <input
              value={message.audio_url}
              onChange={(event) =>
                updateMessage({ audio_url: event.target.value })
              }
              placeholder="Audio URL optional"
              className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
            />

            <input
              value={message.video_url}
              onChange={(event) =>
                updateMessage({ video_url: event.target.value })
              }
              placeholder="Video URL optional"
              className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
            />
          </div>

          <textarea
            value={message.body}
            onChange={(event) => updateMessage({ body: event.target.value })}
            placeholder="Message body. Example: Hello {{name}}, your code is {{participant_code}}."
            className="mt-3 min-h-32 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
          />

          <div className="mt-4 rounded-2xl border-2 border-slate-200 bg-[#EEF3FB] p-4">
            <p className="text-xs font-black uppercase text-slate-500">
              Personalised preview
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6 text-slate-800">
              {personalisedPreview ||
                "Your personalised message preview will appear here."}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={createMessage}
              className="rounded-2xl border-2 border-[#171717] bg-[#FF5C1A] px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717]"
            >
              Create message
            </button>

            {participantId ? (
              <Link
                href={`/scheduler?participant_id=${encodeURIComponent(
                  participantId
                )}&participant_code=${encodeURIComponent(
                  participantCode ??
                    selectedParticipant?.participant_code ??
                    ""
                )}&message_code=${encodeURIComponent(message.message_code)}`}
                className="rounded-2xl border-2 border-[#171717] bg-white px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717]"
              >
                Continue to scheduler
              </Link>
            ) : null}

            <button
              type="button"
              onClick={() =>
                setMessage({
                  message_code: "",
                  title: "",
                  channel: "sms",
                  language: "en",
                  body: defaultMessageBody,
                  media_url: "",
                  audio_url: "",
                  video_url: "",
                  status: "draft",
                })
              }
              className="rounded-2xl border-2 border-[#171717] bg-white px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717]"
            >
              Clear
            </button>
          </div>

          {note ? (
            <p className="mt-3 text-sm font-black text-slate-700">{note}</p>
          ) : null}
        </section>

        <section className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[4px_4px_0_#171717]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[#171717]">
                Message table
              </h2>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Saved message templates for this project.
              </p>
            </div>

            <button
              type="button"
              onClick={loadMessages}
              className="rounded-xl border-2 border-[#171717] px-3 py-2 text-sm font-black"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-hidden rounded-[1.25rem] border-2 border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Code
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Channel
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Language
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Media
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loadingMessages ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-sm font-bold text-slate-500"
                      >
                        Loading messages...
                      </td>
                    </tr>
                  ) : savedMessages.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-sm font-bold text-slate-500"
                      >
                        No saved messages found.
                      </td>
                    </tr>
                  ) : (
                    savedMessages.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-black text-slate-700">
                          {row.message_code}
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          <p className="font-black">{row.message_title}</p>
                          <p className="mt-1 max-w-xl truncate text-xs font-semibold text-slate-500">
                            {row.message_body}
                          </p>
                        </td>

                        <td className="px-4 py-3 font-bold text-slate-700">
                          {row.channel}
                        </td>

                        <td className="px-4 py-3 font-bold text-slate-700">
                          {row.language}
                        </td>

                        <td className="px-4 py-3 font-black text-slate-700">
                          {row.status}
                        </td>

                        <td className="px-4 py-3 text-xs font-bold text-slate-700">
                          {row.media_type && row.media_type !== "text" ? (
                            <div>
                              <p className="font-black text-[#FF5C1A]">
                                {row.media_type}
                              </p>
                              {row.audio_url ||
                              row.video_url ||
                              row.media_url ? (
                                <a
                                  href={
                                    row.audio_url ||
                                    row.video_url ||
                                    row.media_url ||
                                    "#"
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 inline-block max-w-[180px] truncate text-slate-500 underline"
                                >
                                  Open media
                                </a>
                              ) : (
                                <p className="text-slate-400">No URL</p>
                              )}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <Link
                            href={schedulerHref({
                              row,
                              participantId,
                              participantCode,
                              selectedParticipant,
                            })}
                            className="rounded-lg border border-slate-300 bg-[#FFF7F2] px-2 py-1 text-xs font-black text-slate-700 hover:border-[#171717]"
                          >
                            Schedule
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-3 text-xs font-bold text-slate-500">
            This currently loads the latest 100 messages for DEMO-001. Later we
            can make it fully paginated like Participants.
          </p>
        </section>
      </div>
    </main>
  );
}