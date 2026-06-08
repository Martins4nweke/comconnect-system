"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  FieldLabel,
  Notice,
  PageShell,
  SelectInput,
  TextInput,
} from "@/components/comconnect-ui/DashboardUI";

type Channel = "app" | "sms" | "voice" | "whatsapp";
type RecipientMode = "one" | "selected" | "all";

type CurrentContext = {
  organisation_id?: string | null;
  organisation_name?: string | null;
  organisation_role?: string | null;
  active_project_id?: string | null;
  active_project_name?: string | null;
  project_role?: string | null;
};

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

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

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
  const text = cleanText(value).toLowerCase();

  if (text === "push" || text === "app_push") return "app";
  if (text === "sms") return "sms";
  if (text === "voice") return "voice";
  if (text === "whatsapp") return "whatsapp";

  return "app";
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

function SecondaryButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full border border-[#C9D8E4] bg-white px-5 py-3 text-sm font-black text-[#06324A] transition hover:border-[#0A5278] hover:bg-[#EAF2F8] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function PrimaryBlueButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full bg-[#0A5278] px-5 py-3 text-sm font-black text-white transition hover:bg-[#063E5E] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SchedulerPageContent() {
  const searchParams = useSearchParams();
  const bulkInputRef = useRef<HTMLInputElement | null>(null);

  const participantId = searchParams.get("participant_id");
  const participantCode = searchParams.get("participant_code");
  const messageCodeFromUrl = searchParams.get("message_code");

  const [context, setContext] = useState<CurrentContext | null>(null);
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
  const [runDueBusy, setRunDueBusy] = useState(false);
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

  const activeProjectId = cleanText(context?.active_project_id);

  const activeParticipants = useMemo(() => {
    return participants.filter(
      (participant) => participant.status !== "archived"
    );
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
      params.set("q", messageCodeFromUrl);

      if (activeProjectId) {
        params.set("project_id", activeProjectId);
      }

      const response = await fetch(`/api/messages?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load message.");
      }

      const messages = Array.isArray(json.data)
        ? (json.data as MessageRecord[])
        : [];

      const exactMatch =
        messages.find((item) => item.message_code === messageCodeFromUrl) ??
        messages[0];

      if (!exactMatch) {
        setMessageCode(messageCodeFromUrl);
        setNote("Message code received. Complete schedule details.");
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
          `Media attached: ${exactMatch.media_type ?? "media"}.`
        );
      } else {
        setMessageMediaNote("");
      }

      setNote(`Message loaded: ${exactMatch.message_code}.`);
    } catch (error: any) {
      setNote(error?.message ?? "Failed to load message.");
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
    void loadContext();
  }, []);

  useEffect(() => {
    if (context) {
      void loadParticipants();
      void loadSchedules();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.active_project_id]);

  useEffect(() => {
    if (context) {
      void loadMessageFromUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageCodeFromUrl, context?.active_project_id]);

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

    void loadParticipant();
  }, [participantId]);

  useEffect(() => {
    void loadSchedules();
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

  async function createManualSchedule(selectedChannel?: Channel) {
    setNote("");

    const finalChannel = selectedChannel ?? channel;

    if (!activeProjectId) {
      setNote("No active project selected.");
      return;
    }

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
      setNote("Select at least one participant.");
      return;
    }

    if (
      (recipientMode === "selected" || recipientMode === "all") &&
      !participantId
    ) {
      const countLabel =
        recipientMode === "all"
          ? "up to 500 active participants"
          : `${recipientIds.length} selected participant(s)`;

      if (!window.confirm(`Create schedule for ${countLabel}?`)) return;
    }

    setBusy(true);

    try {
      if (
        (recipientMode === "selected" || recipientMode === "all") &&
        !participantId
      ) {
        const body =
          recipientMode === "all"
            ? {
                mode: "all_active",
                project_id: activeProjectId,
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
                project_id: activeProjectId,
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

        setNote(`Created ${json.data?.inserted_count ?? 0} schedule(s).`);
      } else {
        const targetParticipantId = recipientIds[0];

        const response = await fetch("/api/scheduler", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            project_id: activeProjectId,
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
          `Schedule created. Channel: ${
            json.data?.resolved_channel ?? finalChannel
          }.`
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
        throw new Error("No valid schedule rows found.");
      }

      const response = await fetch("/api/scheduler/bulk-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: activeProjectId,
          schedules,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Bulk schedule upload failed.");
      }

      setNote(`Import complete. Inserted ${json.data?.inserted_count ?? 0}.`);
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

      setNote("Schedule updated.");
      setEditingSchedule(null);
      await loadSchedules();
    } catch (error: any) {
      setNote(error?.message ?? "Failed to update schedule.");
    } finally {
      setEditBusy(false);
    }
  }

  async function runDueMessagesNow() {
    setNote("");
    setRunDueBusy(true);

    try {
      const response = await fetch("/api/scheduler/run-due", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to run due messages.");
      }

      setNote("Due messages processed.");
      await loadSchedules();
    } catch (error: any) {
      setNote(error?.message ?? "Failed to run due messages.");
    } finally {
      setRunDueBusy(false);
    }
  }

  async function archiveSchedule(row: ScheduleRow) {
    if (
      !window.confirm(
        `Archive schedule ${row.message_code ?? ""} for ${
          row.participant_code ??
          row.participants?.participant_code ??
          "participant"
        }?`
      )
    ) {
      return;
    }

    setNote("");

    try {
      const response = await fetch(`/api/scheduler/${row.id}`, {
        method: "DELETE",
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to archive schedule.");
      }

      setNote("Schedule archived.");
      await loadSchedules();
    } catch (error: any) {
      setNote(error?.message ?? "Failed to archive schedule.");
    }
  }

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
                Scheduler
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/80">
                Create, edit and process scheduled project messages.
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
          <PageLinkButton href="/messages">Messages</PageLinkButton>
          <PageLinkButton href="/delivery-logs">Delivery Logs</PageLinkButton>
          <PageLinkButton href="/participants">Participants</PageLinkButton>
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
              Queue
            </p>
            <p className="mt-2 text-sm font-black text-[#06324A]">
              {schedules.length} loaded
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
                  Schedule actions
                </p>
                <h2 className="mt-3 text-2xl font-black text-[#06324A]">
                  Create or import schedule
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
                    if (file) void handleBulkScheduleFile(file);
                  }}
                />

                <SecondaryButton
                  disabled={bulkBusy || !activeProjectId}
                  onClick={() => bulkInputRef.current?.click()}
                >
                  {bulkBusy ? "Importing..." : "Import schedules"}
                </SecondaryButton>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                Recipients
              </p>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <label className="flex items-center gap-2 rounded-xl border border-[#C9D8E4] bg-white px-3 py-2 text-sm font-black text-[#06324A]">
                  <input
                    type="radio"
                    checked={recipientMode === "one"}
                    onChange={() => setRecipientMode("one")}
                    disabled={!!participantId}
                  />
                  One
                </label>

                <label className="flex items-center gap-2 rounded-xl border border-[#C9D8E4] bg-white px-3 py-2 text-sm font-black text-[#06324A]">
                  <input
                    type="radio"
                    checked={recipientMode === "selected"}
                    onChange={() => setRecipientMode("selected")}
                    disabled={!!participantId}
                  />
                  Selected
                </label>

                <label className="flex items-center gap-2 rounded-xl border border-[#C9D8E4] bg-white px-3 py-2 text-sm font-black text-[#06324A]">
                  <input
                    type="radio"
                    checked={recipientMode === "all"}
                    onChange={() => setRecipientMode("all")}
                    disabled={!!participantId}
                  />
                  All active
                </label>
              </div>

              {!participantId && recipientMode === "one" ? (
                <div className="mt-3">
                  <FieldLabel label="Participant">
                    <SelectInput
                      value={manualParticipantId}
                      onChange={(event) =>
                        setManualParticipantId(event.target.value)
                      }
                    >
                      <option value="">Select participant</option>
                      {activeParticipants.map((participant) => (
                        <option key={participant.id} value={participant.id}>
                          {participant.participant_code}
                          {participant.phone_number
                            ? ` - ${participant.phone_number}`
                            : ""}
                        </option>
                      ))}
                    </SelectInput>
                  </FieldLabel>
                </div>
              ) : null}

              {!participantId && recipientMode === "selected" ? (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <TextInput
                      value={participantSearch}
                      onChange={(event) =>
                        setParticipantSearch(event.target.value)
                      }
                      placeholder="Search participants"
                      className="min-w-[260px] flex-1"
                    />

                    <SecondaryButton onClick={selectFilteredParticipants}>
                      Select filtered
                    </SecondaryButton>

                    <SecondaryButton onClick={clearSelectedParticipants}>
                      Clear
                    </SecondaryButton>
                  </div>

                  <p className="text-xs font-bold text-[#536271]">
                    Showing {filteredParticipants.length}. Selected:{" "}
                    {selectedParticipantIds.length}.
                  </p>

                  <div className="max-h-56 overflow-auto rounded-2xl border border-[#C9D8E4] bg-white">
                    {loadingParticipants ? (
                      <p className="p-4 text-sm font-bold text-[#536271]">
                        Loading...
                      </p>
                    ) : filteredParticipants.length === 0 ? (
                      <p className="p-4 text-sm font-bold text-[#536271]">
                        No participants.
                      </p>
                    ) : (
                      <div className="divide-y divide-[#EAF2F8]">
                        {filteredParticipants.map((participant) => (
                          <label
                            key={participant.id}
                            className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-[#536271] hover:bg-[#F7FBFD]"
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
                            <span className="text-xs text-[#536271]">
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

              {recipientMode === "one" && currentManualParticipant ? (
                <p className="mt-3 text-xs font-bold text-[#536271]">
                  Recipient: {currentManualParticipant.participant_code}
                </p>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <FieldLabel label="Message code">
                <TextInput
                  value={messageCode}
                  onChange={(event) => setMessageCode(event.target.value)}
                  placeholder="HTN-W01-MON"
                />
              </FieldLabel>

              <FieldLabel label="Message title">
                <TextInput
                  value={messageTitle}
                  onChange={(event) => setMessageTitle(event.target.value)}
                  placeholder="Short title"
                />
              </FieldLabel>

              <FieldLabel label="Schedule date/time">
                <TextInput
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(event) => setScheduleAt(event.target.value)}
                />
              </FieldLabel>

              <FieldLabel label="Channel">
                <SelectInput
                  value={channel}
                  onChange={(event) =>
                    setChannel(event.target.value as Channel)
                  }
                >
                  <option value="app">App / Push</option>
                  <option value="sms">SMS</option>
                  <option value="voice">Voice</option>
                  <option value="whatsapp">WhatsApp</option>
                </SelectInput>
              </FieldLabel>

              <FieldLabel label="Priority">
                <SelectInput
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </SelectInput>
              </FieldLabel>

              <label className="flex items-center gap-2 rounded-xl border border-[#C9D8E4] bg-white px-3 py-2 text-sm font-black text-[#06324A]">
                <input
                  type="checkbox"
                  checked={respectQuietTime}
                  onChange={(event) =>
                    setRespectQuietTime(event.target.checked)
                  }
                />
                Respect quiet time
              </label>
            </div>

            <textarea
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              placeholder="Message body"
              className="mt-3 min-h-28 w-full rounded-xl border border-[#C9D8E4] bg-white px-3 py-2 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
            />

            {messageMediaNote ? (
              <div className="mt-3">
                <Notice tone="info">{messageMediaNote}</Notice>
              </div>
            ) : null}

            <div className="mt-4">
              <PrimaryBlueButton
                disabled={busy || !activeProjectId}
                onClick={() => createManualSchedule()}
              >
                {busy ? "Creating..." : "Create schedule"}
              </PrimaryBlueButton>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                  Schedule queue
                </p>
                <h2 className="mt-3 text-2xl font-black text-[#06324A]">
                  Scheduled messages
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <SelectInput
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-auto"
                >
                  <option value="">All</option>
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
                </SelectInput>

                <PrimaryBlueButton
                  disabled={runDueBusy}
                  onClick={runDueMessagesNow}
                >
                  {runDueBusy ? "Running..." : "Run due"}
                </PrimaryBlueButton>

                <SecondaryButton onClick={loadSchedules}>Refresh</SecondaryButton>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-[#C9D8E4]">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#C9D8E4] text-sm">
                  <thead className="bg-[#EAF2F8]">
                    <tr>
                      <th className="px-3 py-3 text-left font-black text-[#06324A]">
                        Participant
                      </th>
                      <th className="px-3 py-3 text-left font-black text-[#06324A]">
                        Message
                      </th>
                      <th className="px-3 py-3 text-left font-black text-[#06324A]">
                        Channel
                      </th>
                      <th className="px-3 py-3 text-left font-black text-[#06324A]">
                        Time
                      </th>
                      <th className="px-3 py-3 text-left font-black text-[#06324A]">
                        Status
                      </th>
                      <th className="px-3 py-3 text-left font-black text-[#06324A]">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#EAF2F8]">
                    {loadingSchedules ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-8 text-sm font-bold text-[#536271]"
                        >
                          Loading...
                        </td>
                      </tr>
                    ) : schedules.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-8 text-sm font-bold text-[#536271]"
                        >
                          No schedules.
                        </td>
                      </tr>
                    ) : (
                      schedules.map((row) => (
                        <tr key={row.id} className="hover:bg-[#F7FBFD]">
                          <td className="px-3 py-3 font-bold text-[#536271]">
                            {row.participant_code ??
                              row.participants?.participant_code ??
                              "—"}
                          </td>

                          <td className="px-3 py-3 text-[#536271]">
                            <p className="font-black text-[#06324A]">
                              {row.message_code ?? "—"}
                            </p>
                            <p className="text-xs font-semibold text-[#536271]">
                              {row.message_title ?? "—"}
                            </p>
                          </td>

                          <td className="px-3 py-3 font-bold text-[#536271]">
                            {row.resolved_channel ??
                              row.requested_channel ??
                              "—"}
                            <span className="text-xs text-[#536271]">
                              {row.provider ? ` (${row.provider})` : ""}
                            </span>
                          </td>

                          <td className="px-3 py-3 font-bold text-[#536271]">
                            {dt(row.scheduled_for)}
                          </td>

                          <td className="px-3 py-3 font-black text-[#536271]">
                            {row.status ?? "—"}
                            {row.last_error ? (
                              <p className="mt-1 text-xs font-bold text-red-600">
                                {row.last_error}
                              </p>
                            ) : null}
                          </td>

                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => startEditSchedule(row)}
                                disabled={
                                  row.status === "sent" ||
                                  row.status === "archived"
                                }
                                className="rounded-lg border border-[#C9D8E4] bg-white px-2 py-1 text-xs font-black text-[#06324A] transition hover:border-[#0A5278] hover:bg-[#EAF2F8] disabled:opacity-50"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => archiveSchedule(row)}
                                disabled={row.status === "archived"}
                                className="rounded-lg border border-[#C9D8E4] bg-white px-2 py-1 text-xs font-black text-[#06324A] transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
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
          </div>
        </section>

        {editingSchedule ? (
          <section className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
              Edit schedule
            </p>
            <h2 className="mt-3 text-2xl font-black text-[#06324A]">
              Update scheduled message
            </h2>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <FieldLabel label="Message code">
                <TextInput
                  value={editMessageCode}
                  onChange={(event) => setEditMessageCode(event.target.value)}
                />
              </FieldLabel>

              <FieldLabel label="Message title">
                <TextInput
                  value={editMessageTitle}
                  onChange={(event) => setEditMessageTitle(event.target.value)}
                />
              </FieldLabel>

              <FieldLabel label="Schedule date/time">
                <TextInput
                  type="datetime-local"
                  value={editScheduleAt}
                  onChange={(event) => setEditScheduleAt(event.target.value)}
                />
              </FieldLabel>

              <FieldLabel label="Channel">
                <SelectInput
                  value={editChannel}
                  onChange={(event) =>
                    setEditChannel(event.target.value as Channel)
                  }
                >
                  <option value="app">App / Push</option>
                  <option value="sms">SMS</option>
                  <option value="voice">Voice</option>
                  <option value="whatsapp">WhatsApp</option>
                </SelectInput>
              </FieldLabel>

              <FieldLabel label="Priority">
                <SelectInput
                  value={editPriority}
                  onChange={(event) => setEditPriority(event.target.value)}
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </SelectInput>
              </FieldLabel>

              <label className="flex items-center gap-2 rounded-xl border border-[#C9D8E4] bg-white px-3 py-2 text-sm font-black text-[#06324A]">
                <input
                  type="checkbox"
                  checked={editRespectQuietTime}
                  onChange={(event) =>
                    setEditRespectQuietTime(event.target.checked)
                  }
                />
                Respect quiet time
              </label>

              <PrimaryBlueButton
                disabled={editBusy}
                onClick={saveEditedSchedule}
              >
                {editBusy ? "Saving..." : "Save changes"}
              </PrimaryBlueButton>

              <SecondaryButton onClick={() => setEditingSchedule(null)}>
                Cancel
              </SecondaryButton>
            </div>

            <textarea
              value={editMessageBody}
              onChange={(event) => setEditMessageBody(event.target.value)}
              placeholder="Message body"
              className="mt-3 min-h-28 w-full rounded-xl border border-[#C9D8E4] bg-white px-3 py-2 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
            />
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}

export default function SchedulerPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#EAF2F8] p-4 md:p-6" />}>
      <SchedulerPageContent />
    </Suspense>
  );
}