"use client";

import { useEffect, useState } from "react";
import { LargeTableClient } from "@/components/comconnect-actions/LargeTableClient";
import { tableConfigs } from "@/components/comconnect-actions/tableConfigs";
import {
  CompactCard,
  FieldLabel,
  LinkButton,
  Notice,
  PageHeader,
  PageShell,
  PrimaryButton,
  SelectInput,
  TextInput,
} from "@/components/comconnect-ui/DashboardUI";

type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "reschedule_requested"
  | "cancelled"
  | "completed"
  | "missed";

type CurrentContext = {
  organisation_id?: string | null;
  organisation_name?: string | null;
  organisation_role?: string | null;
  active_project_id?: string | null;
  active_project_name?: string | null;
  active_project_code?: string | null;
  project_role?: string | null;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function canManageAppointments(context: CurrentContext | null) {
  const organisationRole = cleanText(context?.organisation_role).toLowerCase();
  const projectRole = cleanText(context?.project_role).toLowerCase();

  return (
    ["superadmin", "organisation_admin", "org_admin", "admin"].includes(
      organisationRole
    ) ||
    [
      "project_manager",
      "research_assistant",
      "data_manager",
      "clinician",
      "nurse",
    ].includes(projectRole)
  );
}

export default function AppointmentsPage() {
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  const [projectCode, setProjectCode] = useState("");
  const [participantCode, setParticipantCode] = useState("");
  const [appointmentType, setAppointmentType] = useState("follow_up");
  const [title, setTitle] = useState("Clinic follow-up appointment");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState("");
  const [status, setStatus] = useState<AppointmentStatus>("scheduled");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const canManage = canManageAppointments(context);

  async function loadContext() {
    setLoadingContext(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/context/current", {
        cache: "no-store",
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load context.");
      }

      const loaded = json.data as CurrentContext;
      setContext(loaded);

      if (loaded.active_project_code) {
        setProjectCode(loaded.active_project_code);
      }
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to load context.");
    } finally {
      setLoadingContext(false);
    }
  }

  useEffect(() => {
    void loadContext();
  }, []);

  function resetForm() {
    setParticipantCode("");
    setAppointmentType("follow_up");
    setTitle("Clinic follow-up appointment");
    setDescription("");
    setLocation("");
    setStartAt("");
    setStatus("scheduled");

    if (context?.active_project_code) {
      setProjectCode(context.active_project_code);
    }
  }

  async function createAppointment() {
    setMessage("");
    setErrorMessage("");

    if (!canManage) {
      setErrorMessage("You do not have permission to create appointments.");
      return;
    }

    if (!projectCode.trim()) {
      setErrorMessage("Project code is required.");
      return;
    }

    if (!participantCode.trim()) {
      setErrorMessage("Participant code is required.");
      return;
    }

    if (!title.trim()) {
      setErrorMessage("Appointment title is required.");
      return;
    }

    if (!startAt) {
      setErrorMessage("Appointment date/time is required.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_code: projectCode.trim(),
          participant_code: participantCode.trim(),
          appointment_type: appointmentType.trim() || "follow_up",
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          start_at: new Date(startAt).toISOString(),
          end_at: null,
          status,
          metadata: {
            created_from: "appointments_page",
          },
          created_from: "appointments_page",
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to create appointment.");
      }

      const pushResult = json.data?.push_result;

      if (pushResult?.sent && pushResult.sent > 0) {
        setMessage("Appointment created and push notification sent.");
      } else if (pushResult?.reason === "no_active_push_tokens") {
        setMessage("Appointment created. No active participant push token yet.");
      } else {
        setMessage("Appointment created successfully.");
      }

      resetForm();

      window.setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to create appointment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Care"
        title="Appointments"
        subtitle="Create participant appointments, send app notifications, and manage appointment responses."
        actions={
          <>
            <LinkButton href="/inbox">Central Inbox</LinkButton>
            <LinkButton href="/research-care/care">Care</LinkButton>
            <LinkButton href="/">Dashboard</LinkButton>
          </>
        }
      />

      {errorMessage ? <Notice tone="danger">{errorMessage}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <CompactCard>
          <p className="text-xs font-black uppercase text-slate-500">
            Organisation
          </p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {loadingContext ? "Loading..." : context?.organisation_name ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-slate-500">Project</p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {loadingContext ? "Loading..." : context?.active_project_name ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-slate-500">
            Project Code
          </p>
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

      <CompactCard title="Create appointment">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <FieldLabel label="Project code">
            <TextInput
              value={projectCode}
              onChange={(event) => setProjectCode(event.target.value)}
              placeholder="Project code"
            />
          </FieldLabel>

          <FieldLabel label="Participant code">
            <TextInput
              value={participantCode}
              onChange={(event) => setParticipantCode(event.target.value)}
              placeholder="Participant code"
            />
          </FieldLabel>

          <FieldLabel label="Appointment type">
            <TextInput
              value={appointmentType}
              onChange={(event) => setAppointmentType(event.target.value)}
              placeholder="follow_up"
            />
          </FieldLabel>

          <FieldLabel label="Title">
            <TextInput
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Appointment title"
            />
          </FieldLabel>

          <FieldLabel label="Appointment date/time">
            <input
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
              className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
            />
          </FieldLabel>

          <FieldLabel label="Location">
            <TextInput
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Clinic room 2"
            />
          </FieldLabel>

          <FieldLabel label="Status">
            <SelectInput
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as AppointmentStatus)
              }
            >
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="reschedule_requested">Reschedule requested</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
              <option value="missed">Missed</option>
            </SelectInput>
          </FieldLabel>

          <div className="flex items-end">
            <PrimaryButton
              onClick={createAppointment}
              disabled={busy || !canManage}
            >
              {busy ? "Creating..." : "Create appointment"}
            </PrimaryButton>
          </div>
        </div>

        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Appointment description or instruction"
          className="mt-3 min-h-24 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
        />

        {!canManage ? (
          <p className="mt-2 text-xs font-bold text-slate-500">
            Your role can view appointments but cannot create or update them.
          </p>
        ) : null}
      </CompactCard>

      <div className="mt-4">
        <LargeTableClient config={tableConfigs.appointments} />
      </div>
    </PageShell>
  );
}