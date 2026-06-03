"use client";

import { useState } from "react";
import { LargeTableClient } from "@/components/comconnect-actions/LargeTableClient";
import { tableConfigs } from "@/components/comconnect-actions/tableConfigs";

type Priority = "normal" | "high" | "urgent";

export default function Page() {
  const [projectCode, setProjectCode] = useState("DEMO-001");
  const [participantCode, setParticipantCode] = useState("DEMO-P001");
  const [referralType, setReferralType] = useState("Clinic follow-up");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [followUpAt, setFollowUpAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function createReferral() {
    setMessage("");

    if (!projectCode.trim()) {
      setMessage("Project code is required.");
      return;
    }

    if (!participantCode.trim()) {
      setMessage("Participant code is required.");
      return;
    }

    if (!reason.trim()) {
      setMessage("Referral reason is required.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/referrals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_code: projectCode.trim(),
          participant_code: participantCode.trim(),
          referral_type: referralType.trim() || "general",
          reason: reason.trim(),
          priority,
          follow_up_at: followUpAt ? new Date(followUpAt).toISOString() : null,
          status: "new",
          metadata: {
            created_from: "referrals_page",
          },
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to create referral.");
      }

      const pushResult = json.data?.push_result;

      if (pushResult?.sent && pushResult.sent > 0) {
        setMessage("Referral created and push notification sent.");
      } else if (pushResult?.reason === "no_active_push_tokens") {
        setMessage("Referral created. No active participant push token yet.");
      } else {
        setMessage("Referral created successfully.");
      }

      setReferralType("Clinic follow-up");
      setReason("");
      setPriority("normal");
      setFollowUpAt("");

      window.setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to create referral.");
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
              Referral action
            </p>
            <h2 className="text-xl font-black text-slate-950">
              Create referral
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Create a participant referral using project and participant codes. The system resolves the hidden IDs automatically.
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
            value={referralType}
            onChange={(event) => setReferralType(event.target.value)}
            placeholder="Referral type"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          />

          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          >
            <option value="normal">Normal priority</option>
            <option value="high">High priority</option>
            <option value="urgent">Urgent priority</option>
          </select>

          <input
            type="datetime-local"
            value={followUpAt}
            onChange={(event) => setFollowUpAt(event.target.value)}
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          />

          <button
            type="button"
            onClick={createReferral}
            disabled={busy}
            className="rounded-2xl border-2 border-slate-950 bg-[#F26A21] px-4 py-3 text-sm font-black text-slate-950 shadow-[3px_3px_0_#171717] disabled:opacity-60"
          >
            {busy ? "Creating..." : "Create referral"}
          </button>
        </div>

        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason for referral"
          className="mt-3 min-h-24 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
        />

        {message ? (
          <p className="mt-3 text-sm font-black text-slate-700">{message}</p>
        ) : null}
      </section>

      <LargeTableClient config={tableConfigs.referrals} />
    </div>
  );
}