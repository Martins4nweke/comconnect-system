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

type Priority = "normal" | "high" | "urgent";

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

function canManageReferrals(context: CurrentContext | null) {
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
      "follow_up_officer",
    ].includes(projectRole)
  );
}

export default function ReferralsPage() {
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  const [projectCode, setProjectCode] = useState("");
  const [participantCode, setParticipantCode] = useState("");
  const [referralType, setReferralType] = useState("Clinic follow-up");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [followUpAt, setFollowUpAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const canManage = canManageReferrals(context);

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
    setReferralType("Clinic follow-up");
    setReason("");
    setPriority("normal");
    setFollowUpAt("");

    if (context?.active_project_code) {
      setProjectCode(context.active_project_code);
    }
  }

  async function createReferral() {
    setMessage("");
    setErrorMessage("");

    if (!canManage) {
      setErrorMessage("You do not have permission to create referrals.");
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

    if (!reason.trim()) {
      setErrorMessage("Referral reason is required.");
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
          created_from: "referrals_page",
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

      resetForm();

      window.setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to create referral.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Care"
        title="Referrals"
        subtitle="Create, review and follow up participant referrals within the active organisation and project."
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

      <CompactCard title="Create referral">
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

          <FieldLabel label="Referral type">
            <TextInput
              value={referralType}
              onChange={(event) => setReferralType(event.target.value)}
              placeholder="Clinic follow-up"
            />
          </FieldLabel>

          <FieldLabel label="Priority">
            <SelectInput
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
            >
              <option value="normal">Normal priority</option>
              <option value="high">High priority</option>
              <option value="urgent">Urgent priority</option>
            </SelectInput>
          </FieldLabel>

          <FieldLabel label="Follow-up date/time">
            <input
              type="datetime-local"
              value={followUpAt}
              onChange={(event) => setFollowUpAt(event.target.value)}
              className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
            />
          </FieldLabel>

          <div className="flex items-end">
            <PrimaryButton onClick={createReferral} disabled={busy || !canManage}>
              {busy ? "Creating..." : "Create referral"}
            </PrimaryButton>
          </div>
        </div>

        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason for referral"
          className="mt-3 min-h-24 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
        />

        {!canManage ? (
          <p className="mt-2 text-xs font-bold text-slate-500">
            Your role can view referrals but cannot create or update them.
          </p>
        ) : null}
      </CompactCard>

      <div className="mt-4">
        <LargeTableClient config={tableConfigs.referrals} />
      </div>
    </PageShell>
  );
}