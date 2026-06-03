"use client";

import { useState } from "react";
import { LargeTableClient } from "@/components/comconnect-actions/LargeTableClient";
import { tableConfigs } from "@/components/comconnect-actions/tableConfigs";

type AppointmentStatus = "scheduled" | "confirmed" | "rescheduled" | "cancelled";

export default function Page() {
  const [projectCode, setProjectCode] = useState("DEMO-001");
  const [participantCode, setParticipantCode] = useState("DEMO-P001");
  const [appointmentType, setAppointmentType] = useState("follow_up");
  const [title, setTitle] = useState("Clinic follow-up appointment");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState("");
  const [status, setStatus] = useState<AppointmentStatus>("scheduled");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function createAppointment() {
    setMessage("");

    if (!projectCode.trim()) {
      setMessage("Project code is required.");
      return;
    }

    if (!participantCode.trim()) {
      setMessage("Participant code is required.");
      return;
    }

    if (!title.trim()) {
      setMessage("Appointment title is required.");
      return;
    }

    if (!startAt) {
      setMessage("Appointment date/time is required.");
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

      setAppointmentType("follow_up");
      setTitle("Clinic follow-up appointment");
      setDescription("");
      setLocation("");
      setStartAt("");
      setStatus("scheduled");

      window.setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to create appointment.");
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
              Appointment action
            </p>
            <h2 className="text-xl font-black text-slate-950">
              Create appointment
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Create a participant appointment using project and participant codes. The system resolves the hidden IDs automatically.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input
            value={projectCode}
            onChange={(event) => setProjectCode(event.target.value)}
            placeholder="Project code, e.g. DEMO-001"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          />

          <input
            value={participantCode}
            onChange={(event) => setParticipantCode(event.target.value)}
            placeholder="Participant code, e.g. DEMO-P001"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          />

          <input
            value={appointmentType}
            onChange={(event) => setAppointmentType(event.target.value)}
            placeholder="Appointment type"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          />

          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Appointment title"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          />

          <div className="flex flex-col gap-1">
            <label className="px-1 text-xs font-black uppercase text-slate-500">
              Appointment date/time
            </label>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
              className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
            />
          </div>

          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Location, e.g. Clinic room 2"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          />

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as AppointmentStatus)}
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          >
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Confirmed</option>
            <option value="rescheduled">Rescheduled</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            type="button"
            onClick={createAppointment}
            disabled={busy}
            className="rounded-2xl border-2 border-slate-950 bg-[#F26A21] px-4 py-3 text-sm font-black text-slate-950 shadow-[3px_3px_0_#171717] disabled:opacity-60"
          >
            {busy ? "Creating..." : "Create appointment"}
          </button>
        </div>

        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Appointment description or instruction"
          className="mt-3 min-h-24 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
        />

        {message ? (
          <p className="mt-3 text-sm font-black text-slate-700">{message}</p>
        ) : null}
      </section>

      <LargeTableClient config={tableConfigs.appointments} />
    </div>
  );
}