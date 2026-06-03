"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

type Channel = "app" | "sms" | "voice" | "whatsapp";

type SelectedParticipant = {
  id: string;
  participant_code: string;
  phone_number?: string | null;
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

type MessageRecord = {
  id: string;
  message_code: string;
  message_title: string;
  message_body: string;
  channel?: string | null;
  language?: string | null;
  media_type?: string | null;
  media_url?: string | null;
  audio_url?: string | null;
  video_url?: string | null;
  status?: string | null;
};

type ScheduleRow = {
  id: string;
  participant_code?: string | null;
  message_code?: string | null;
  message_title?: string | null;
  message_body?: string | null;
  requested_channel?: string | null;
  resolved_channel?: string | null;
  provider?: string | null;
  scheduled_for?: string | null;
  status?: string | null;
  priority?: string | null;
  source_type?: string | null;
  delivery_mode?: string | null;
  last_error?: string | null;
  participants?: {
    participant_code?: string | null;
    phone_number?: string | null;
    metadata?: any;
  } | null;
};

type RecipientMode = "one" | "selected" | "all";

const channelCards: {
  key: Channel;
  title: string;
  description: string;
}[] = [
  {
    key: "app",
    title: "Manual App / Push",
    description: "Schedule an in-app/push message for chosen participant(s).",
  },
  {
    key: "sms",
    title: "Manual SMS",
    description: "Schedule SMS through Africa's Talking.",
  },
  {
    key: "voice",
    title: "Manual Voice",
    description: "Schedule a voice task through Africa's Talking.",
  },
];

function participantName(participant?: SelectedParticipant | null) {
  if (!participant) return "Participant";

  return (
    participant.metadata?.display_name ??
    participant.participant_code ??
    "Participant"
  );
}

function dt(value?: string | null) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
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

    if (!firstSheetName) return [];

    const worksheet = workbook.Sheets[firstSheetName];

    return XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, {
      defval: "",
    });
  }

  const text = await file.text();
  return parseCsv(text);
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (number: number) => String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normaliseChannel(value?: string | null): Channel {
  const text = String(value ?? "").trim().toLowerCase();

  if (text === "push" || text === "app_push") return "app";
  if (text === "sms") return "sms";
  if (text === "voice") return "voice";
  if (text === "whatsapp") return "whatsapp";

  return "app";
}

function SchedulerPageContent() {
  const searchParams = useSearchParams();
  const bulkInputRef = useRef<HTMLInputElement | null>(null);

  const participantId = searchParams.get("participant_id");
  const participantCode = searchParams.get("participant_code");
  const messageCodeFromUrl = searchParams.get("message_code");

  const [selectedParticipant, setSelectedParticipant] =
    useState<SelectedParticipant | null>(null);
  const [loadingParticipant, setLoadingParticipant] = useState(false);

  const [participants, setParticipants] = useState<SelectedParticipant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("one");
  const [manualParticipantId, setManualParticipantId] = useState(
    participantId ?? ""
  );
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<
    string[]
  >([]);

  const [messageCode, setMessageCode] = useState(messageCodeFromUrl ?? "");
  const [messageTitle, setMessageTitle] = useState("ComConnect message");
  const [messageBody, setMessageBody] = useState(
    "You have a ComConnect update. Please open the app."
  );
  const [messageMediaNote, setMessageMediaNote] = useState("");

  const [scheduleAt, setScheduleAt] = useState("");
  const [channel, setChannel] = useState<Channel>("app");
  const [respectQuietTime, setRespectQuietTime] = useState(true);
  const [priority, setPriority] = useState("normal");
  const [statusFilter, setStatusFilter] = useState("pending");

  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [note, setNote] = useState("");

  const [editingSchedule, setEditingSchedule] = useState<ScheduleRow | null>(
    null
  );
  const [editMessageCode, setEditMessageCode] = useState("");
  const [editMessageTitle, setEditMessageTitle] = useState("");
  const [editMessageBody, setEditMessageBody] = useState("");
  const [editChannel, setEditChannel] = useState<Channel>("app");
  const [editScheduleAt, setEditScheduleAt] = useState("");
  const [editPriority, setEditPriority] = useState("normal");
  const [editRespectQuietTime, setEditRespectQuietTime] = useState(true);
  const [editBusy, setEditBusy] = useState(false);

  const activeParticipants = useMemo(() => {
    return participants.filter((participant) => participant.status !== "archived");
  }, [participants]);

  const filteredParticipants = useMemo(() => {
    const text = participantSearch.trim().toLowerCase();

    if (!text) return activeParticipants.slice(0, 200);

    return activeParticipants
      .filter((participant) => {
        const haystack = [
          participant.participant_code,
          participant.phone_number,
          participant.preferred_language,
          participant.status,
          participant.metadata?.display_name,
          participant.metadata?.preferred_channel,
          participant.metadata?.whatsapp_number,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(text);
      })
      .slice(0, 200);
  }, [activeParticipants, participantSearch]);

  const currentManualParticipant =
    selectedParticipant ??
    participants.find((participant) => participant.id === manualParticipantId) ??
    null;

  async function loadParticipants() {
    setLoadingParticipants(true);

    try {
      const response = await fetch("/api/participants", {
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load participants.");
      }

      const rows = Array.isArray(json.data) ? json.data : [];
      setParticipants(rows);

      if (!manualParticipantId && rows[0]?.id) {
        setManualParticipantId(rows[0].id);
      }
    } catch (error: any) {
      setNote(error?.message ?? "Failed to load participants.");
    } finally {
      setLoadingParticipants(false);
    }
  }

  async function loadMessageFromUrl() {
    if (!messageCodeFromUrl) return;

    setNote("");

    try {
      const params = new URLSearchParams();
      params.set("project_code", "DEMO-001");
      params.set("q", messageCodeFromUrl);

      const response = await fetch(`/api/messages?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load message.");
      }

      const messages = Array.isArray(json.data) ? (json.data as MessageRecord[]) : [];

      const exactMatch =
        messages.find((item) => item.message_code === messageCodeFromUrl) ??
        messages[0];

      if (!exactMatch) {
        setMessageCode(messageCodeFromUrl);
        setNote(
          `Message code ${messageCodeFromUrl} was passed from Message Library, but full details were not found. You can still complete the schedule manually.`
        );
        return;
      }

      setMessageCode(exactMatch.message_code ?? messageCodeFromUrl);
      setMessageTitle(exactMatch.message_title ?? "ComConnect message");
      setMessageBody(
        exactMatch.message_body ??
          "You have a ComConnect update. Please open the app."
      );
      setChannel(normaliseChannel(exactMatch.channel));

      if (
        exactMatch.audio_url ||
        exactMatch.video_url ||
        exactMatch.media_url ||
        exactMatch.media_type
      ) {
        setMessageMediaNote(
          `Media attached: ${
            exactMatch.media_type ?? "media"
          }. The participant message body should contain the media link if the channel sends links.`
        );
      } else {
        setMessageMediaNote("");
      }

      setNote(
        `Message loaded from Message Library: ${exactMatch.message_code}. Choose participant(s), set date/time, then create schedule.`
      );
    } catch (error: any) {
      setNote(error?.message ?? "Failed to load message from Message Library.");
    }
  }

  async function loadSchedules() {
    setLoadingSchedules(true);

    try {
      const params = new URLSearchParams();
      params.set("limit", "50");

      if (statusFilter) params.set("status", statusFilter);
      if (participantId) params.set("participant_id", participantId);

      const response = await fetch(`/api/scheduler?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load schedules.");
      }

      setSchedules(Array.isArray(json.data) ? json.data : []);
    } catch (error: any) {
      setNote(error?.message ?? "Failed to load schedules.");
    } finally {
      setLoadingSchedules(false);
    }
  }

  useEffect(() => {
    loadParticipants();
    loadMessageFromUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        setManualParticipantId(participant.id);
        setRecipientMode("one");
        setChannel(normaliseChannel(participant.metadata?.preferred_channel));
      } catch (error: any) {
        setNote(error?.message ?? "Failed to load participant.");
      } finally {
        setLoadingParticipant(false);
      }
    }

    loadParticipant();
  }, [participantId]);

  useEffect(() => {
    loadSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId, statusFilter]);

  function toggleSelectedParticipant(participantIdToToggle: string) {
    setSelectedParticipantIds((current) =>
      current.includes(participantIdToToggle)
        ? current.filter((id) => id !== participantIdToToggle)
        : [...current, participantIdToToggle]
    );
  }

  function selectFilteredParticipants() {
    setSelectedParticipantIds(
      filteredParticipants.map((participant) => participant.id)
    );
  }

  function clearSelectedParticipants() {
    setSelectedParticipantIds([]);
  }

  function resolveRecipientIds() {
    if (participantId) return [participantId];

    if (recipientMode === "one") {
      return manualParticipantId ? [manualParticipantId] : [];
    }

    if (recipientMode === "selected") {
      return selectedParticipantIds;
    }

    return activeParticipants.map((participant) => participant.id);
  }

  async function createScheduleForParticipant(
    participantIdForSchedule: string,
    finalChannel: Channel
  ) {
    const response = await fetch("/api/scheduler", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        participant_id: participantIdForSchedule,
        message_code: messageCode.trim(),
        message_title: messageTitle.trim() || "ComConnect message",
        message_body:
          messageBody.trim() ||
          "You have a ComConnect update. Please open the app.",
        requested_channel: finalChannel,
        scheduled_for: new Date(scheduleAt).toISOString(),
        priority,
        respect_quiet_time: respectQuietTime,
        source_type: "manual_message",
        delivery_mode: "participant_preference",
        allowed_channels: ["app", "sms", "voice", "whatsapp"],
        metadata: {
          created_from: "scheduler_page_manual",
          recipient_mode: participantId ? "url_participant" : recipientMode,
          source_message_code: messageCode.trim(),
        },
      }),
    });

    const json = await response.json();

    if (!response.ok || !json?.ok) {
      throw new Error(json?.error ?? "Failed to create schedule.");
    }

    return json.data;
  }

  async function createManualSchedule(selectedChannel?: Channel) {
  setNote("");

  const finalChannel = selectedChannel ?? channel;

  if (!messageCode.trim()) {
    setNote("Message code is required.");
    return;
  }

  if (!scheduleAt) {
    setNote("Schedule date/time is required.");
    return;
  }

  const recipientIds = resolveRecipientIds();

  if (recipientMode !== "all" && recipientIds.length === 0) {
    setNote("Select at least one participant before creating schedule.");
    return;
  }

  if ((recipientMode === "selected" || recipientMode === "all") && !participantId) {
    const countLabel =
      recipientMode === "all"
        ? "up to 500 active participants in DEMO-001"
        : `${recipientIds.length} selected participant(s)`;

    const confirmed = window.confirm(
      `Create this schedule for ${countLabel}?`
    );

    if (!confirmed) return;
  }

  setBusy(true);

  try {
    if ((recipientMode === "selected" || recipientMode === "all") && !participantId) {
      const body =
        recipientMode === "all"
          ? {
              mode: "all_active",
              project_code: "DEMO-001",
              limit: 500,

              message_code: messageCode.trim(),
              message_title: messageTitle.trim() || "ComConnect message",
              message_body:
                messageBody.trim() ||
                "You have a ComConnect update. Please open the app.",

              requested_channel: finalChannel,

              scheduled_for: new Date(scheduleAt).toISOString(),

              priority,
              respect_quiet_time: respectQuietTime,

              source_type: "manual_message",
              delivery_mode: "participant_preference",
              allowed_channels: ["app", "sms", "voice", "whatsapp"],

              metadata: {
                created_from: "scheduler_page_bulk_create",
                recipient_mode: "all_active",
                source_message_code: messageCode.trim(),
              },
            }
          : {
              mode: "selected",
              participant_ids: recipientIds,

              message_code: messageCode.trim(),
              message_title: messageTitle.trim() || "ComConnect message",
              message_body:
                messageBody.trim() ||
                "You have a ComConnect update. Please open the app.",

              requested_channel: finalChannel,

              scheduled_for: new Date(scheduleAt).toISOString(),

              priority,
              respect_quiet_time: respectQuietTime,

              source_type: "manual_message",
              delivery_mode: "participant_preference",
              allowed_channels: ["app", "sms", "voice", "whatsapp"],

              metadata: {
                created_from: "scheduler_page_bulk_create",
                recipient_mode: "selected",
                source_message_code: messageCode.trim(),
              },
            };

      const response = await fetch("/api/scheduler/bulk-create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to create bulk schedules.");
      }

      setNote(
        `Created ${json.data?.inserted_count ?? 0} schedule(s). Channel: ${finalChannel}. Message: ${messageCode}.`
      );
    } else {
      const targetParticipantId = recipientIds[0];

      const response = await fetch("/api/scheduler", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participant_id: targetParticipantId,

          message_code: messageCode.trim(),
          message_title: messageTitle.trim() || "ComConnect message",
          message_body:
            messageBody.trim() ||
            "You have a ComConnect update. Please open the app.",

          requested_channel: finalChannel,

          scheduled_for: new Date(scheduleAt).toISOString(),

          priority,
          respect_quiet_time: respectQuietTime,

          source_type: "manual_message",
          delivery_mode: "participant_preference",
          allowed_channels: ["app", "sms", "voice", "whatsapp"],

          metadata: {
            created_from: "scheduler_page_manual",
            recipient_mode: participantId ? "url_participant" : "one",
            source_message_code: messageCode.trim(),
          },
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to create schedule.");
      }

      setNote(
        `Schedule created. Channel: ${json.data?.resolved_channel ?? finalChannel}. Message: ${messageCode}.`
      );
    }

    setScheduleAt("");
    setPriority("normal");

    await loadSchedules();
  } catch (error: any) {
    setNote(error?.message ?? "Failed to create schedule.");
  } finally {
    setBusy(false);
  }
}

  async function handleBulkScheduleFile(file: File) {
    setNote("");
    setBulkBusy(true);

    try {
      const schedules = await parseUploadFile(file);

      if (schedules.length === 0) {
        throw new Error("No valid schedule rows found in the uploaded file.");
      }

      const response = await fetch("/api/scheduler/bulk-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schedules,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Bulk schedule upload failed.");
      }

      setNote(
        `Bulk schedule upload complete. Inserted ${
          json.data?.inserted_count ?? 0
        } schedule(s). Skipped missing participants: ${
          json.data?.skipped_missing_participants_count ?? 0
        }.`
      );

      await loadSchedules();
    } catch (error: any) {
      setNote(error?.message ?? "Bulk schedule upload failed.");
    } finally {
      setBulkBusy(false);

      if (bulkInputRef.current) {
        bulkInputRef.current.value = "";
      }
    }
  }

  function startEditSchedule(row: ScheduleRow) {
    setEditingSchedule(row);
    setEditMessageCode(row.message_code ?? "");
    setEditMessageTitle(row.message_title ?? "");
    setEditMessageBody(row.message_body ?? "");
    setEditChannel(normaliseChannel(row.resolved_channel ?? row.requested_channel));
    setEditScheduleAt(toDateTimeLocal(row.scheduled_for));
    setEditPriority(row.priority ?? "normal");
    setEditRespectQuietTime(true);
    setNote("");
  }

  async function saveEditedSchedule() {
    if (!editingSchedule) return;

    if (!editMessageCode.trim()) {
      setNote("Message code is required.");
      return;
    }

    if (!editScheduleAt) {
      setNote("Schedule date/time is required.");
      return;
    }

    setEditBusy(true);
    setNote("");

    try {
      const response = await fetch(`/api/scheduler/${editingSchedule.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message_code: editMessageCode.trim(),
          message_title: editMessageTitle.trim() || "ComConnect message",
          message_body:
            editMessageBody.trim() ||
            "You have a ComConnect update. Please open the app.",
          requested_channel: editChannel,
          resolved_channel: editChannel,
          scheduled_for: new Date(editScheduleAt).toISOString(),
          priority: editPriority,
          respect_quiet_time: editRespectQuietTime,
          metadata: {
            edited_from: "scheduler_page",
          },
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to update schedule.");
      }

      setNote("Schedule updated successfully.");
      setEditingSchedule(null);
      await loadSchedules();
    } catch (error: any) {
      setNote(error?.message ?? "Failed to update schedule.");
    } finally {
      setEditBusy(false);
    }
  }

  async function archiveSchedule(row: ScheduleRow) {
    const confirmed = window.confirm(
      `Archive schedule ${row.message_code ?? ""} for ${
        row.participant_code ?? row.participants?.participant_code ?? "participant"
      }?`
    );

    if (!confirmed) return;

    setNote("");

    try {
      const response = await fetch(`/api/scheduler/${row.id}`, {
        method: "DELETE",
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to archive schedule.");
      }

      setNote("Schedule archived successfully.");
      await loadSchedules();
    } catch (error: any) {
      setNote(error?.message ?? "Failed to archive schedule.");
    }
  }

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
                Scheduler
              </h1>

              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                Schedule app, SMS, WhatsApp and voice messages. Manual and bulk
                schedules are saved into one unified queue.
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
                href="/messages"
                className="rounded-2xl border-2 border-[#171717] bg-white px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717]"
              >
                Message Library
              </Link>

              <Link
                href="/media-library"
                className="rounded-2xl border-2 border-[#171717] bg-[#FFF7F2] px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717]"
              >
                Media Library
              </Link>
            </div>
          </div>
        </section>

<section className="grid gap-4 md:grid-cols-3">
  {channelCards.map((item) => {
    const isSelected = channel === item.key;

    return (
      <button
        key={item.key}
        type="button"
        onClick={() => {
          setChannel(item.key);
          setNote(`${item.title} selected. Complete the form below, then click Create schedule.`);
        }}
        disabled={busy}
        className={`rounded-[1.5rem] border-2 border-[#171717] p-5 text-left shadow-[3px_3px_0_#171717] transition hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#171717] disabled:opacity-60 ${
          isSelected ? "bg-[#FFF7F2]" : "bg-white"
        }`}
      >
        <p className="text-sm font-black text-[#FF5C1A]">{item.title}</p>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
          {item.description}
        </p>
        {isSelected ? (
          <p className="mt-3 text-xs font-black uppercase text-slate-500">
            Selected
          </p>
        ) : null}
      </button>
    );
  })}
</section>

        {participantId || participantCode ? (
          <section className="rounded-[2rem] border-2 border-[#171717] bg-[#FFF7F2] p-5 shadow-[4px_4px_0_#171717]">
            <p className="text-sm font-black uppercase tracking-wide text-[#FF5C1A]">
              Selected participant from URL
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
                  {selectedParticipant.metadata?.quiet_time_enabled === false
                    ? "Off"
                    : `${
                        selectedParticipant.metadata?.quiet_time_start ??
                        "20:00"
                      }–${
                        selectedParticipant.metadata?.quiet_time_end ?? "07:00"
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
                Participant passed from URL: {participantCode ?? participantId}
              </p>
            )}
          </section>
        ) : null}

        <section className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[4px_4px_0_#171717]">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[#171717]">
                Manual schedule
              </h2>

              <p className="mt-1 text-sm font-semibold text-slate-600">
                Choose a message, choose participant(s), set date/time, then
                create schedules.
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
                  if (file) handleBulkScheduleFile(file);
                }}
              />

              <button
                type="button"
                onClick={() => bulkInputRef.current?.click()}
                disabled={bulkBusy}
                className="rounded-2xl border-2 border-[#171717] bg-[#FFF7F2] px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717] disabled:opacity-60"
              >
                {bulkBusy ? "Uploading..." : "Bulk schedule upload"}
              </button>
            </div>
          </div>

          <div className="mb-4 rounded-[1.5rem] border-2 border-slate-200 bg-[#EEF3FB] p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Recipients
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
                <input
                  type="radio"
                  checked={recipientMode === "one"}
                  onChange={() => setRecipientMode("one")}
                  disabled={!!participantId}
                />
                One participant
              </label>

              <label className="flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
                <input
                  type="radio"
                  checked={recipientMode === "selected"}
                  onChange={() => setRecipientMode("selected")}
                  disabled={!!participantId}
                />
                Selected participants
              </label>

              <label className="flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
                <input
                  type="radio"
                  checked={recipientMode === "all"}
                  onChange={() => setRecipientMode("all")}
                  disabled={!!participantId}
                />
                All loaded active participants
              </label>
            </div>

            {!participantId && recipientMode === "one" ? (
              <div className="mt-3">
                <label className="px-1 text-xs font-black uppercase text-slate-500">
                  Select participant
                </label>
                <select
                  value={manualParticipantId}
                  onChange={(event) => setManualParticipantId(event.target.value)}
                  className="mt-1.5 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                >
                  <option value="">Select participant</option>
                  {activeParticipants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.participant_code}
                      {participant.phone_number ? ` - ${participant.phone_number}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {!participantId && recipientMode === "selected" ? (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <input
                    value={participantSearch}
                    onChange={(event) => setParticipantSearch(event.target.value)}
                    placeholder="Search participants by code, phone, language or channel"
                    className="min-w-[260px] flex-1 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                  />

                  <button
                    type="button"
                    onClick={selectFilteredParticipants}
                    className="rounded-2xl border-2 border-[#171717] bg-white px-4 py-3 text-sm font-black text-[#171717]"
                  >
                    Select filtered
                  </button>

                  <button
                    type="button"
                    onClick={clearSelectedParticipants}
                    className="rounded-2xl border-2 border-[#171717] bg-[#FFF7F2] px-4 py-3 text-sm font-black text-[#171717]"
                  >
                    Clear
                  </button>
                </div>

                <p className="text-xs font-bold text-slate-500">
                  Showing {filteredParticipants.length} participant(s). Selected:{" "}
                  {selectedParticipantIds.length}.
                </p>

                <div className="max-h-64 overflow-auto rounded-2xl border-2 border-slate-200 bg-white">
                  {loadingParticipants ? (
                    <p className="p-4 text-sm font-bold text-slate-500">
                      Loading participants...
                    </p>
                  ) : filteredParticipants.length === 0 ? (
                    <p className="p-4 text-sm font-bold text-slate-500">
                      No participants found.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filteredParticipants.map((participant) => (
                        <label
                          key={participant.id}
                          className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <span>
                            <input
                              type="checkbox"
                              className="mr-3"
                              checked={selectedParticipantIds.includes(
                                participant.id
                              )}
                              onChange={() =>
                                toggleSelectedParticipant(participant.id)
                              }
                            />
                            {participant.participant_code}
                          </span>
                          <span className="text-xs text-slate-500">
                            {participant.phone_number ?? "—"} ·{" "}
                            {participant.metadata?.preferred_channel ?? "app"}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {!participantId && recipientMode === "all" ? (
              <p className="mt-3 rounded-2xl border-2 border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800">
  This will create schedules for the currently loaded active participant(s).
  Use bulk upload for larger participant lists.
</p>
            ) : null}

            {recipientMode === "one" && currentManualParticipant ? (
              <p className="mt-3 text-xs font-bold text-slate-600">
                Current recipient: {currentManualParticipant.participant_code}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={messageCode}
              onChange={(event) => setMessageCode(event.target.value)}
              placeholder="Message code"
              className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
            />

            <input
              value={messageTitle}
              onChange={(event) => setMessageTitle(event.target.value)}
              placeholder="Message title"
              className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
            />

            <div className="flex flex-col gap-1">
              <label className="px-1 text-xs font-black uppercase text-slate-500">
                Schedule date/time
              </label>
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(event) => setScheduleAt(event.target.value)}
                className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              />
            </div>

            <select
              value={channel}
              onChange={(event) => setChannel(event.target.value as Channel)}
              className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
            >
              <option value="app">App / Push</option>
              <option value="sms">SMS - Africa's Talking</option>
              <option value="voice">Voice - Africa's Talking</option>
              <option value="whatsapp">WhatsApp</option>
            </select>

            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>

            <label className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black">
              <input
                type="checkbox"
                checked={respectQuietTime}
                onChange={(event) => setRespectQuietTime(event.target.checked)}
              />
              Respect quiet time
            </label>

            <button
              type="button"
              onClick={() => createManualSchedule()}
              disabled={busy}
              className="rounded-2xl border-2 border-[#171717] bg-[#FF5C1A] px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717] disabled:opacity-60"
            >
              {busy ? "Creating..." : "Create schedule"}
            </button>
          </div>

          <textarea
            value={messageBody}
            onChange={(event) => setMessageBody(event.target.value)}
            placeholder="Message body"
            className="mt-3 min-h-28 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
          />

          {messageMediaNote ? (
            <p className="mt-3 rounded-2xl border-2 border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
              {messageMediaNote}
            </p>
          ) : null}

          {note ? (
            <p className="mt-3 text-sm font-black text-slate-700">{note}</p>
          ) : null}
        </section>

        {editingSchedule ? (
          <section className="rounded-[2rem] border-2 border-[#171717] bg-[#FFF7F2] p-5 shadow-[4px_4px_0_#171717]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[#FF5C1A]">
                  Edit schedule
                </p>
                <h2 className="text-xl font-black text-[#171717]">
                  {editingSchedule.participant_code ??
                    editingSchedule.participants?.participant_code ??
                    "Participant"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setEditingSchedule(null)}
                className="rounded-2xl border-2 border-[#171717] bg-white px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717]"
              >
                Cancel edit
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                value={editMessageCode}
                onChange={(event) => setEditMessageCode(event.target.value)}
                placeholder="Message code"
                className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              />

              <input
                value={editMessageTitle}
                onChange={(event) => setEditMessageTitle(event.target.value)}
                placeholder="Message title"
                className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              />

              <div className="flex flex-col gap-1">
                <label className="px-1 text-xs font-black uppercase text-slate-500">
                  Schedule date/time
                </label>
                <input
                  type="datetime-local"
                  value={editScheduleAt}
                  onChange={(event) => setEditScheduleAt(event.target.value)}
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                />
              </div>

              <select
                value={editChannel}
                onChange={(event) =>
                  setEditChannel(event.target.value as Channel)
                }
                className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              >
                <option value="app">App / Push</option>
                <option value="sms">SMS - Africa's Talking</option>
                <option value="voice">Voice - Africa's Talking</option>
                <option value="whatsapp">WhatsApp</option>
              </select>

              <select
                value={editPriority}
                onChange={(event) => setEditPriority(event.target.value)}
                className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>

              <label className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black">
                <input
                  type="checkbox"
                  checked={editRespectQuietTime}
                  onChange={(event) =>
                    setEditRespectQuietTime(event.target.checked)
                  }
                />
                Respect quiet time
              </label>

              <button
                type="button"
                onClick={saveEditedSchedule}
                disabled={editBusy}
                className="rounded-2xl border-2 border-[#171717] bg-[#FF5C1A] px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717] disabled:opacity-60"
              >
                {editBusy ? "Saving..." : "Save changes"}
              </button>
            </div>

            <textarea
              value={editMessageBody}
              onChange={(event) => setEditMessageBody(event.target.value)}
              placeholder="Message body"
              className="mt-3 min-h-28 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
            />
          </section>
        ) : null}

        <section className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[4px_4px_0_#171717]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[#171717]">
                Unified schedule queue
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                All manual and bulk schedules appear here.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold"
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="queued">Queued</option>
                <option value="sending">Sending</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="retry_pending">Retry pending</option>
                <option value="fallback_pending">Fallback pending</option>
                <option value="manual_follow_up">Manual follow-up</option>
                <option value="cancelled">Cancelled</option>
                <option value="archived">Archived</option>
              </select>

              <button
                type="button"
                onClick={loadSchedules}
                className="rounded-xl border-2 border-[#171717] px-3 py-2 text-sm font-black"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.25rem] border-2 border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Participant
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Message
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Channel
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Schedule time
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Source
                    </th>
                    <th className="px-4 py-3 text-left font-black text-slate-700">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loadingSchedules ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-sm font-bold text-slate-500"
                      >
                        Loading schedules...
                      </td>
                    </tr>
                  ) : schedules.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-sm font-bold text-slate-500"
                      >
                        No schedules found.
                      </td>
                    </tr>
                  ) : (
                    schedules.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-700">
                          {row.participant_code ??
                            row.participants?.participant_code ??
                            "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <p className="font-black">
                            {row.message_code ?? "—"}
                          </p>
                          <p className="text-xs font-semibold text-slate-500">
                            {row.message_title ?? "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-700">
                          {row.resolved_channel ??
                            row.requested_channel ??
                            "—"}{" "}
                          <span className="text-xs text-slate-400">
                            {row.provider ? `(${row.provider})` : ""}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-700">
                          {dt(row.scheduled_for)}
                        </td>
                        <td className="px-4 py-3 font-black text-slate-700">
                          {row.status ?? "—"}
                          {row.last_error ? (
                            <p className="mt-1 text-xs font-bold text-red-600">
                              {row.last_error}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-700">
                          {row.source_type ?? "—"}
                          {row.delivery_mode === "app_only" ? (
                            <p className="mt-1 text-xs font-black text-[#FF5C1A]">
                              App only
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEditSchedule(row)}
                              disabled={
                                row.status === "sent" ||
                                row.status === "archived"
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-black text-slate-700 hover:border-[#171717] disabled:opacity-50"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => archiveSchedule(row)}
                              disabled={row.status === "archived"}
                              className="rounded-lg border border-slate-300 bg-[#FFF7F2] px-2 py-1 text-xs font-black text-slate-700 hover:border-[#171717] disabled:opacity-50"
                            >
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-3 text-xs font-bold text-slate-500">
  Showing the latest 50 schedule records. Use status filters and refresh to
  review queue updates.
</p>
        </section>
      </div>
    </main>
  );
}

export default function SchedulerPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#EEF3FB] p-4 md:p-6" />}>
      <SchedulerPageContent />
    </Suspense>
  );
}
