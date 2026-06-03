"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { LargeTableClient } from "@/components/comconnect-actions/LargeTableClient";
import { tableConfigs } from "@/components/comconnect-actions/tableConfigs";

type PreferredChannel = "app" | "sms" | "whatsapp" | "voice";
type ParticipantStatus =
  | "active"
  | "inactive"
  | "withdrawn"
  | "completed"
  | "archived";

export default function Page() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [projectCode, setProjectCode] = useState("DEMO-001");
  const [participantCode, setParticipantCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState("en");
  const [preferredChannel, setPreferredChannel] =
    useState<PreferredChannel>("app");
  const [fallbackAllowed, setFallbackAllowed] = useState(true);
  const [appAccessEnabled, setAppAccessEnabled] = useState(true);
  const [quietTimeEnabled, setQuietTimeEnabled] = useState(true);
  const [quietTimeStart, setQuietTimeStart] = useState("20:00");
  const [quietTimeEnd, setQuietTimeEnd] = useState("07:00");
  const [status, setStatus] = useState<ParticipantStatus>("active");
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [message, setMessage] = useState("");

  function splitName(value: string) {
    const parts = value.trim().split(/\s+/).filter(Boolean);

    return {
      first_name: parts[0] ?? null,
      last_name: parts.length > 1 ? parts.slice(1).join(" ") : null,
    };
  }

  function parseCsv(text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return [];
    }

    const headers = lines[0]
      .split(",")
      .map((header) => header.trim())
      .filter(Boolean);

    return lines.slice(1).map((line) => {
      const values = line.split(",").map((value) => value.trim());
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });

      return row;
    });
  }

  async function handleBulkFile(file: File) {
    setMessage("");
    setBulkBusy(true);

    try {
      const text = await file.text();
      const participants = parseCsv(text);

      if (participants.length === 0) {
        throw new Error("No valid participant rows found in the CSV file.");
      }

      const response = await fetch("/api/participants/bulk-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participants,
          timezone: "Africa/Johannesburg",
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Bulk upload failed.");
      }

      setMessage(
  `Bulk upload complete. Inserted ${
    json.data?.inserted_count ?? 0
  } participant(s). Skipped existing: ${
    json.data?.skipped_existing_count ?? 0
  }. Skipped duplicate rows: ${
    json.data?.skipped_upload_duplicate_count ?? 0
  }.`
);

      window.setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (error: any) {
      setMessage(error?.message ?? "Bulk upload failed.");
    } finally {
      setBulkBusy(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function addParticipant() {
    setMessage("");

    if (!projectCode.trim()) {
      setMessage("Project code is required.");
      return;
    }

    if (!participantCode.trim()) {
      setMessage("Participant code is required.");
      return;
    }

    const nameParts = splitName(displayName);

    setBusy(true);

    try {
      const response = await fetch("/api/participants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_code: projectCode.trim(),
          participant_code: participantCode.trim(),
          display_name: displayName.trim() || null,
          first_name: nameParts.first_name,
          last_name: nameParts.last_name,
          phone_number: phoneNumber.trim() || null,
          whatsapp_number: whatsappNumber.trim() || null,
          email: email.trim() || null,
          preferred_language: language,
          status,
          app_access_enabled: appAccessEnabled,
          preferred_channel: preferredChannel,
          fallback_allowed: fallbackAllowed,
          quiet_time_enabled: quietTimeEnabled,
          quiet_time_start: quietTimeStart,
          quiet_time_end: quietTimeEnd,
          timezone: "Africa/Johannesburg",
          source: "participants_page",
          metadata: {
            created_from: "participants_page",
          },
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to add participant.");
      }

      setMessage("Participant added successfully.");

      setParticipantCode("");
      setDisplayName("");
      setPhoneNumber("");
      setWhatsappNumber("");
      setEmail("");
      setLanguage("en");
      setPreferredChannel("app");
      setFallbackAllowed(true);
      setAppAccessEnabled(true);
      setQuietTimeEnabled(true);
      setQuietTimeStart("20:00");
      setQuietTimeEnd("07:00");
      setStatus("active");

      window.setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to add participant.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border-2 border-slate-950 bg-white p-5 shadow-[4px_4px_0_#171717]">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[#F26A21]">
              Participant registry
            </p>
            <h2 className="text-xl font-black text-slate-950">
              Add participant
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Add one participant now, or bulk upload CSV participants. The list
              below remains server-paginated for very large projects.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/messages"
              className="rounded-2xl border-2 border-slate-950 bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-[3px_3px_0_#171717]"
            >
              Message Library
            </Link>

            <Link
              href="/scheduler"
              className="rounded-2xl border-2 border-slate-950 bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-[3px_3px_0_#171717]"
            >
              Scheduler
            </Link>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleBulkFile(file);
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={bulkBusy}
              className="rounded-2xl border-2 border-slate-950 bg-[#FFF7F2] px-4 py-3 text-sm font-black text-slate-950 shadow-[3px_3px_0_#171717] disabled:opacity-60"
            >
              {bulkBusy ? "Uploading..." : "Bulk upload"}
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={projectCode}
            onChange={(event) => setProjectCode(event.target.value)}
            placeholder="Project code, e.g. DEMO-001"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          />

          <input
            value={participantCode}
            onChange={(event) => setParticipantCode(event.target.value)}
            placeholder="Participant code"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          />

          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Full name optional"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          />

          <input
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="Phone number"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          />

          <input
            value={whatsappNumber}
            onChange={(event) => setWhatsappNumber(event.target.value)}
            placeholder="WhatsApp number optional"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          />

          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email optional"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          />

          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          >
            <option value="en">English</option>
            <option value="zu">isiZulu</option>
          </select>

          <select
            value={preferredChannel}
            onChange={(event) =>
              setPreferredChannel(event.target.value as PreferredChannel)
            }
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          >
            <option value="app">App first</option>
            <option value="sms">SMS first</option>
            <option value="whatsapp">WhatsApp first</option>
            <option value="voice">Voice first</option>
          </select>

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as ParticipantStatus)
            }
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>

          <label className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black">
            <input
              type="checkbox"
              checked={appAccessEnabled}
              onChange={(event) => setAppAccessEnabled(event.target.checked)}
            />
            App access
          </label>

          <label className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black">
            <input
              type="checkbox"
              checked={fallbackAllowed}
              onChange={(event) => setFallbackAllowed(event.target.checked)}
            />
            Allow fallback
          </label>

          <label className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black">
            <input
              type="checkbox"
              checked={quietTimeEnabled}
              onChange={(event) => setQuietTimeEnabled(event.target.checked)}
            />
            Quiet time
          </label>

          <div className="flex flex-col gap-1">
            <label className="px-1 text-xs font-black uppercase text-slate-500">
              Quiet start
            </label>
            <input
              type="time"
              value={quietTimeStart}
              onChange={(event) => setQuietTimeStart(event.target.value)}
              disabled={!quietTimeEnabled}
              className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21] disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="px-1 text-xs font-black uppercase text-slate-500">
              Quiet end
            </label>
            <input
              type="time"
              value={quietTimeEnd}
              onChange={(event) => setQuietTimeEnd(event.target.value)}
              disabled={!quietTimeEnabled}
              className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21] disabled:opacity-50"
            />
          </div>

          <button
            type="button"
            onClick={addParticipant}
            disabled={busy}
            className="rounded-2xl border-2 border-slate-950 bg-[#F26A21] px-4 py-3 text-sm font-black text-slate-950 shadow-[3px_3px_0_#171717] disabled:opacity-60"
          >
            {busy ? "Adding..." : "Add participant"}
          </button>
        </div>

        {message ? (
          <p className="mt-3 text-sm font-black text-slate-700">{message}</p>
        ) : null}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[24px] border-2 border-slate-950 bg-white p-4 shadow-[3px_3px_0_#171717]">
          <p className="text-xs font-black uppercase text-slate-500">
            Large data mode
          </p>
          <p className="mt-1 text-sm font-black text-slate-950">
            50 rows per page
          </p>
          <p className="mt-1 text-xs font-bold text-slate-600">
            Search and pagination run on the server, so this can support very
            large projects.
          </p>
        </div>

        <div className="rounded-[24px] border-2 border-slate-950 bg-white p-4 shadow-[3px_3px_0_#171717]">
          <p className="text-xs font-black uppercase text-slate-500">
            Quiet time
          </p>
          <p className="mt-1 text-sm font-black text-slate-950">
            Default 20:00–07:00
          </p>
          <p className="mt-1 text-xs font-bold text-slate-600">
            Scheduler should hold non-urgent messages until quiet time ends.
          </p>
        </div>

        <div className="rounded-[24px] border-2 border-slate-950 bg-white p-4 shadow-[3px_3px_0_#171717]">
          <p className="text-xs font-black uppercase text-slate-500">
            Scheduler-ready
          </p>
          <p className="mt-1 text-sm font-black text-slate-950">
            Participant → Message → Schedule
          </p>
          <p className="mt-1 text-xs font-bold text-slate-600">
            Participant codes will later prefill Message Library and Scheduler
            actions.
          </p>
        </div>
      </section>

      <LargeTableClient config={tableConfigs.participants} />
    </div>
  );
}