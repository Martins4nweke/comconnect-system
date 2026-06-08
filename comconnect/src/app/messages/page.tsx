"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  FieldLabel,
  Notice,
  PageShell,
  SelectInput,
  TextInput,
} from "@/components/comconnect-ui/DashboardUI";

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

type CurrentContext = {
  organisation_id?: string | null;
  organisation_name?: string | null;
  organisation_role?: string | null;
  active_project_id?: string | null;
  active_project_name?: string | null;
  project_role?: string | null;
};

const channels: { value: Channel; label: string }[] = [
  { value: "app_push", label: "App / Push" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "voice", label: "Voice" },
];

const defaultMessageBody = "Hello {{name}}, this is a message from ComConnect.";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

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
      if (char === "\r" && nextChar === "\n") index += 1;

      currentRow.push(currentValue.trim());

      if (currentRow.some((value) => value !== "")) rows.push(currentRow);

      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  currentRow.push(currentValue.trim());

  if (currentRow.some((value) => value !== "")) rows.push(currentRow);

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

    if (!firstSheetName) return [];

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

function PageLinkButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-full border border-[#C9D8E4] bg-white px-4 py-2 text-xs font-black text-[#06324A] shadow-sm transition hover:border-[#0A5278] hover:bg-[#0A5278] hover:text-white"
    >
      {children}
    </Link>
  );
}

function MessagesPageContent() {
  const searchParams = useSearchParams();

  const participantId = searchParams.get("participant_id");
  const participantCode = searchParams.get("participant_code");

  const mediaUrlFromLibrary = searchParams.get("mediaUrl");
  const mediaTypeFromLibrary = searchParams.get("mediaType");
  const mediaTitleFromLibrary = searchParams.get("mediaTitle");

  const bulkInputRef = useRef<HTMLInputElement | null>(null);

  const [context, setContext] = useState<CurrentContext | null>(null);
  const [selectedParticipant, setSelectedParticipant] =
    useState<SelectedParticipant | null>(null);
  const [loadingParticipant, setLoadingParticipant] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [savedMessages, setSavedMessages] = useState<SavedMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [note, setNote] = useState("");

  const [message, setMessage] = useState<MessageDraft>({
    message_code: "",
    title: "",
    channel: "app_push",
    language: "en",
    body: defaultMessageBody,
    media_url: "",
    audio_url: "",
    video_url: "",
    status: "draft",
  });

  const activeProjectId = cleanText(context?.active_project_id);

  async function loadContext() {
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
    }
  }

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

  async function loadMessages() {
    setLoadingMessages(true);

    try {
      const params = new URLSearchParams();

      if (activeProjectId) {
        params.set("project_id", activeProjectId);
      }

      const response = await fetch(`/api/messages?${params.toString()}`, {
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

  useEffect(() => {
    void loadContext();
  }, []);

  useEffect(() => {
    void loadParticipant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId]);

  useEffect(() => {
    if (context) {
      void loadMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.active_project_id]);

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

    setNote(`Media added: ${mediaTitle}.`);
  }, [mediaUrlFromLibrary, mediaTypeFromLibrary, mediaTitleFromLibrary]);

  function updateMessage(patch: Partial<MessageDraft>) {
    setMessage((current) => ({ ...current, ...patch }));
  }

  async function handleBulkMessageFile(file: File) {
    setNote("");
    setBulkBusy(true);

    try {
      const messages = await parseUploadFile(file);

      if (messages.length === 0) {
        throw new Error("No valid message rows found.");
      }

      const response = await fetch("/api/messages/bulk-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: activeProjectId,
          messages,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Bulk message upload failed.");
      }

      setNote(
        `Import complete. Saved ${
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

    if (!activeProjectId) {
      setNote("No active project selected.");
      return;
    }

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
          project_id: activeProjectId,
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

      setNote("Message saved.");
      await loadMessages();

      setMessage({
        message_code: "",
        title: "",
        channel: "app_push",
        language: "en",
        body: defaultMessageBody,
        media_url: "",
        audio_url: "",
        video_url: "",
        status: "draft",
      });
    } catch (error: any) {
      setNote(error?.message ?? "Failed to create message.");
    }
  }

  const personalisedPreview = personaliseTemplate(
    message.body,
    selectedParticipant
  );

  return (
    <PageShell>
      <div className="space-y-5">
        <section className="rounded-[2rem] bg-[#032A3D] p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#28A9E0]">
            Core Communication
          </p>

          <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                Messages
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/80">
                Create, import and schedule reusable project messages.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                Active project
              </p>
              <p className="mt-2 text-xl font-black text-white">
                {context?.active_project_name ?? "Loading..."}
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-white/70">
                {context?.organisation_name ?? "Loading organisation..."}
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <PageLinkButton href="/dashboard">Dashboard</PageLinkButton>
          <PageLinkButton href="/participants">Participants</PageLinkButton>
          <PageLinkButton href="/scheduler">Scheduler</PageLinkButton>
          <PageLinkButton href="/media-library">Media Library</PageLinkButton>
        </div>

        {note ? <Notice tone="warning">{note}</Notice> : null}

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
              Organisation
            </p>
            <p className="mt-2 text-sm font-black text-[#06324A]">
              {context?.organisation_name ?? "Loading..."}
            </p>
          </div>

          <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
              Project
            </p>
            <p className="mt-2 text-sm font-black text-[#06324A]">
              {context?.active_project_name ?? "Loading..."}
            </p>
          </div>

          <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
              Records
            </p>
            <p className="mt-2 text-sm font-black text-[#06324A]">
              {savedMessages.length} loaded
            </p>
          </div>
        </section>

        {participantId || participantCode ? (
          <section className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
              Selected participant
            </p>

            {loadingParticipant ? (
              <p className="mt-3 text-sm font-bold text-[#536271]">
                Loading...
              </p>
            ) : selectedParticipant ? (
              <div className="mt-4 grid gap-2 text-sm font-bold text-[#536271] md:grid-cols-4">
                <p>Code: {selectedParticipant.participant_code}</p>
                <p>Name: {participantName(selectedParticipant)}</p>
                <p>Phone: {selectedParticipant.phone_number ?? "—"}</p>
                <p>
                  Channel:{" "}
                  {selectedParticipant.metadata?.preferred_channel ?? "app"}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm font-bold text-[#536271]">
                Participant: {participantCode ?? participantId}
              </p>
            )}
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
          <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                  Message actions
                </p>
                <h2 className="mt-3 text-2xl font-black text-[#06324A]">
                  Create or import message
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  ref={bulkInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleBulkMessageFile(file);
                  }}
                />

                <button
                  type="button"
                  disabled={bulkBusy || !activeProjectId}
                  onClick={() => bulkInputRef.current?.click()}
                  className="rounded-full border border-[#C9D8E4] bg-white px-5 py-3 text-sm font-black text-[#06324A] transition hover:border-[#0A5278] hover:bg-[#EAF2F8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkBusy ? "Importing..." : "Import messages"}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <FieldLabel label="Message code">
                <TextInput
                  value={message.message_code}
                  onChange={(event) =>
                    updateMessage({ message_code: event.target.value })
                  }
                  placeholder="HTN-W01-MON"
                />
              </FieldLabel>

              <FieldLabel label="Title">
                <TextInput
                  value={message.title}
                  onChange={(event) =>
                    updateMessage({ title: event.target.value })
                  }
                  placeholder="Short title"
                />
              </FieldLabel>

              <FieldLabel label="Channel">
                <SelectInput
                  value={message.channel}
                  onChange={(event) =>
                    updateMessage({ channel: event.target.value as Channel })
                  }
                >
                  {channels.map((channel) => (
                    <option key={channel.value} value={channel.value}>
                      {channel.label}
                    </option>
                  ))}
                </SelectInput>
              </FieldLabel>

              <FieldLabel label="Language">
                <SelectInput
                  value={message.language}
                  onChange={(event) =>
                    updateMessage({ language: event.target.value })
                  }
                >
                  <option value="en">English</option>
                  <option value="zu">isiZulu</option>
                </SelectInput>
              </FieldLabel>

              <FieldLabel label="Status">
                <SelectInput
                  value={message.status}
                  onChange={(event) =>
                    updateMessage({
                      status: event.target.value as MessageDraft["status"],
                    })
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="ready">Ready</option>
                  <option value="archived">Archived</option>
                </SelectInput>
              </FieldLabel>

              <FieldLabel label="Media URL">
                <TextInput
                  value={message.media_url}
                  onChange={(event) =>
                    updateMessage({ media_url: event.target.value })
                  }
                  placeholder="Optional"
                />
              </FieldLabel>

              <FieldLabel label="Audio URL">
                <TextInput
                  value={message.audio_url}
                  onChange={(event) =>
                    updateMessage({ audio_url: event.target.value })
                  }
                  placeholder="Optional"
                />
              </FieldLabel>

              <FieldLabel label="Video URL">
                <TextInput
                  value={message.video_url}
                  onChange={(event) =>
                    updateMessage({ video_url: event.target.value })
                  }
                  placeholder="Optional"
                />
              </FieldLabel>
            </div>

            <textarea
              value={message.body}
              onChange={(event) => updateMessage({ body: event.target.value })}
              placeholder="Hello {{name}}, your code is {{participant_code}}."
              className="mt-3 min-h-28 w-full rounded-xl border border-[#C9D8E4] bg-white px-3 py-2 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
            />

            <div className="mt-3 rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] p-3">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                Preview
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6 text-[#06324A]">
                {personalisedPreview}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!activeProjectId}
                onClick={createMessage}
                className="rounded-full bg-[#0A5278] px-5 py-3 text-sm font-black text-white transition hover:bg-[#063E5E] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save message
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
                  className="rounded-full border border-[#C9D8E4] bg-white px-5 py-3 text-sm font-black text-[#06324A] transition hover:border-[#0A5278] hover:bg-[#EAF2F8]"
                >
                  Continue to scheduler
                </Link>
              ) : null}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                  Message table
                </p>
                <h2 className="mt-3 text-2xl font-black text-[#06324A]">
                  Saved messages
                </h2>
              </div>

              <button
                type="button"
                onClick={loadMessages}
                className="rounded-full border border-[#C9D8E4] bg-white px-5 py-3 text-sm font-black text-[#06324A] transition hover:border-[#0A5278] hover:bg-[#EAF2F8]"
              >
                Refresh
              </button>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-[#C9D8E4]">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#C9D8E4] text-sm">
                  <thead className="bg-[#EAF2F8]">
                    <tr>
                      <th className="px-3 py-3 text-left font-black text-[#06324A]">
                        Code
                      </th>
                      <th className="px-3 py-3 text-left font-black text-[#06324A]">
                        Title
                      </th>
                      <th className="px-3 py-3 text-left font-black text-[#06324A]">
                        Channel
                      </th>
                      <th className="px-3 py-3 text-left font-black text-[#06324A]">
                        Status
                      </th>
                      <th className="px-3 py-3 text-left font-black text-[#06324A]">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#EAF2F8]">
                    {loadingMessages ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-8 text-sm font-bold text-[#536271]"
                        >
                          Loading...
                        </td>
                      </tr>
                    ) : savedMessages.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-8 text-sm font-bold text-[#536271]"
                        >
                          No saved messages.
                        </td>
                      </tr>
                    ) : (
                      savedMessages.map((row) => (
                        <tr key={row.id} className="hover:bg-[#F7FBFD]">
                          <td className="px-3 py-3 font-black text-[#06324A]">
                            {row.message_code}
                          </td>

                          <td className="px-3 py-3 text-[#536271]">
                            <p className="font-black text-[#06324A]">
                              {row.message_title}
                            </p>
                            <p className="mt-1 max-w-xs truncate text-xs font-semibold text-[#536271]">
                              {row.message_body}
                            </p>
                          </td>

                          <td className="px-3 py-3 font-bold text-[#536271]">
                            {row.channel}
                          </td>

                          <td className="px-3 py-3 font-black text-[#536271]">
                            {row.status}
                          </td>

                          <td className="px-3 py-3">
                            <Link
                              href={schedulerHref({
                                row,
                                participantId,
                                participantCode,
                                selectedParticipant,
                              })}
                              className="rounded-lg border border-[#C9D8E4] bg-white px-2 py-1 text-xs font-black text-[#06324A] transition hover:border-[#0A5278] hover:bg-[#EAF2F8]"
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
          </div>
        </section>
      </div>
    </PageShell>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#EAF2F8] p-4 md:p-6" />}>
      <MessagesPageContent />
    </Suspense>
  );
}