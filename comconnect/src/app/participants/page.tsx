"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LargeTableClient } from "@/components/comconnect-actions/LargeTableClient";
import { tableConfigs } from "@/components/comconnect-actions/tableConfigs";
import {
  FieldLabel,
  Notice,
  PageShell,
  SelectInput,
  TextInput,
} from "@/components/comconnect-ui/DashboardUI";

type PreferredChannel = "app" | "sms" | "whatsapp" | "voice";
type ParticipantStatus =
  | "active"
  | "inactive"
  | "withdrawn"
  | "completed"
  | "archived";

type ProjectOption = {
  id: string;
  name: string;
  project_code?: string | null;
};

type CurrentContext = {
  organisation_id?: string | null;
  organisation_name?: string | null;
  organisation_role?: string | null;
  active_project_id?: string | null;
  active_project_name?: string | null;
  project_role?: string | null;
  allowed_projects?: ProjectOption[];
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

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

  if (lines.length < 2) return [];

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

export default function Page() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [context, setContext] = useState<CurrentContext | null>(null);
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
  const [status, setStatus] = useState<ParticipantStatus>("active");
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [message, setMessage] = useState("");

  const activeProjectId = cleanText(context?.active_project_id);
  const activeProjectName = context?.active_project_name ?? "Current project";

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
      setMessage(error?.message ?? "Failed to load context.");
    }
  }

  async function handleBulkFile(file: File) {
    setMessage("");
    setBulkBusy(true);

    try {
      const text = await file.text();
      const participants = parseCsv(text);

      if (participants.length === 0) {
        throw new Error("No valid participant rows found.");
      }

      const response = await fetch("/api/participants/bulk-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: activeProjectId,
          participants,
          timezone: "Africa/Johannesburg",
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Bulk upload failed.");
      }

      setMessage(
        `Import complete. Inserted ${
          json.data?.inserted_count ?? 0
        }. Existing: ${
          json.data?.skipped_existing_count ?? 0
        }. Duplicates: ${json.data?.skipped_upload_duplicate_count ?? 0}.`
      );

      window.setTimeout(() => window.location.reload(), 800);
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

    if (!activeProjectId) {
      setMessage("No active project selected.");
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
          project_id: activeProjectId,
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
          quiet_time_start: "20:00",
          quiet_time_end: "07:00",
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

      setMessage("Participant added.");

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
      setStatus("active");

      window.setTimeout(() => window.location.reload(), 600);
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to add participant.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadContext();
  }, []);

  return (
    <PageShell>
      <div className="space-y-5">
        <section className="rounded-[2rem] bg-[#032A3D] p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#28A9E0]">
            Core Registry
          </p>

          <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                Participants
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/80">
                Add, import, search and manage participant records for the
                active project.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                Active project
              </p>
              <p className="mt-2 text-xl font-black text-white">
                {activeProjectName}
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
          <PageLinkButton href="/scheduler">Scheduler</PageLinkButton>
        </div>

        {message ? <Notice tone="warning">{message}</Notice> : null}

        <section className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                Participant actions
              </p>
              <h2 className="mt-3 text-2xl font-black text-[#06324A]">
                Add or import participants
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleBulkFile(file);
                }}
              />

              <button
                type="button"
                disabled={bulkBusy || !activeProjectId}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full border border-[#C9D8E4] bg-white px-5 py-3 text-sm font-black text-[#06324A] transition hover:border-[#0A5278] hover:bg-[#EAF2F8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkBusy ? "Importing..." : "Import participants CSV"}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                Organisation
              </p>
              <p className="mt-2 text-sm font-black text-[#06324A]">
                {context?.organisation_name ?? "Loading..."}
              </p>
            </div>

            <div className="rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                Project
              </p>
              <p className="mt-2 text-sm font-black text-[#06324A]">
                {activeProjectName}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FieldLabel label="Participant code">
              <TextInput
                value={participantCode}
                onChange={(event) => setParticipantCode(event.target.value)}
                placeholder="Durb_HTN_001"
              />
            </FieldLabel>

            <FieldLabel label="Full name">
              <TextInput
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Optional"
              />
            </FieldLabel>

            <FieldLabel label="Phone">
              <TextInput
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="+27..."
              />
            </FieldLabel>

            <FieldLabel label="WhatsApp">
              <TextInput
                value={whatsappNumber}
                onChange={(event) => setWhatsappNumber(event.target.value)}
                placeholder="Optional"
              />
            </FieldLabel>

            <FieldLabel label="Email">
              <TextInput
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Optional"
              />
            </FieldLabel>

            <FieldLabel label="Language">
              <SelectInput
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                <option value="en">English</option>
                <option value="zu">isiZulu</option>
              </SelectInput>
            </FieldLabel>

            <FieldLabel label="Channel">
              <SelectInput
                value={preferredChannel}
                onChange={(event) =>
                  setPreferredChannel(event.target.value as PreferredChannel)
                }
              >
                <option value="app">App first</option>
                <option value="sms">SMS first</option>
                <option value="whatsapp">WhatsApp first</option>
                <option value="voice">Voice first</option>
              </SelectInput>
            </FieldLabel>

            <FieldLabel label="Status">
              <SelectInput
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as ParticipantStatus)
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="withdrawn">Withdrawn</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </SelectInput>
            </FieldLabel>

            <label className="flex items-center gap-2 rounded-2xl border border-[#C9D8E4] bg-white px-3 py-2 text-sm font-black text-[#06324A]">
              <input
                type="checkbox"
                checked={appAccessEnabled}
                onChange={(event) => setAppAccessEnabled(event.target.checked)}
              />
              App access
            </label>

            <label className="flex items-center gap-2 rounded-2xl border border-[#C9D8E4] bg-white px-3 py-2 text-sm font-black text-[#06324A]">
              <input
                type="checkbox"
                checked={fallbackAllowed}
                onChange={(event) => setFallbackAllowed(event.target.checked)}
              />
              Fallback
            </label>

            <label className="flex items-center gap-2 rounded-2xl border border-[#C9D8E4] bg-white px-3 py-2 text-sm font-black text-[#06324A]">
              <input
                type="checkbox"
                checked={quietTimeEnabled}
                onChange={(event) => setQuietTimeEnabled(event.target.checked)}
              />
              Quiet time
            </label>

            <button
              type="button"
              disabled={busy || !activeProjectId}
              onClick={addParticipant}
              className="rounded-full bg-[#0A5278] px-5 py-3 text-sm font-black text-white transition hover:bg-[#063E5E] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Adding..." : "Add participant"}
            </button>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#C9D8E4] bg-white p-4 shadow-sm">
          <LargeTableClient config={tableConfigs.participants} />
        </section>
      </div>
    </PageShell>
  );
}