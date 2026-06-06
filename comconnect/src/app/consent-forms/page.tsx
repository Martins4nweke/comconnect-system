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

function canManageConsent(context: CurrentContext | null) {
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

function parseCheckboxStatements(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ConsentFormsPage() {
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("en");
  const [status, setStatus] = useState("draft");
  const [creating, setCreating] = useState(false);

  const [consentFormId, setConsentFormId] = useState("");
  const [versionLabel, setVersionLabel] = useState("v1.0");
  const [versionStatus, setVersionStatus] = useState("draft");
  const [studyInformation, setStudyInformation] = useState("");
  const [privacyInformation, setPrivacyInformation] = useState("");
  const [risksBenefits, setRisksBenefits] = useState("");
  const [voluntaryParticipation, setVoluntaryParticipation] = useState("");
  const [contactDetails, setContactDetails] = useState("");
  const [checkboxStatements, setCheckboxStatements] = useState("");
  const [fullText, setFullText] = useState("");
  const [creatingVersion, setCreatingVersion] = useState(false);

  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const activeProjectId = cleanText(context?.active_project_id);
  const activeProjectCode = cleanText(context?.active_project_code);
  const canManage = canManageConsent(context);

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

      setContext(json.data as CurrentContext);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to load context.");
    } finally {
      setLoadingContext(false);
    }
  }

  useEffect(() => {
    void loadContext();
  }, []);

  function resetConsentForm() {
    setTitle("");
    setDescription("");
    setLanguage("en");
    setStatus("draft");
  }

  function resetVersionForm() {
    setVersionLabel("v1.0");
    setVersionStatus("draft");
    setStudyInformation("");
    setPrivacyInformation("");
    setRisksBenefits("");
    setVoluntaryParticipation("");
    setContactDetails("");
    setCheckboxStatements("");
    setFullText("");
  }

  async function createConsentForm() {
    setNote("");
    setErrorMessage("");

    if (!canManage) {
      setErrorMessage("You do not have permission to create consent forms.");
      return;
    }

    if (!activeProjectId) {
      setErrorMessage("No active project selected.");
      return;
    }

    if (!title.trim()) {
      setErrorMessage("Consent form title is required.");
      return;
    }

    setCreating(true);

    try {
      const response = await fetch("/api/consent-forms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: activeProjectId,
          project_code: activeProjectCode || null,
          title: title.trim(),
          description: description.trim() || null,
          language,
          status,
          settings: {
            created_from: "consent_forms_page",
          },
          created_from: "consent_forms_page",
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to create consent form.");
      }

      const newConsentFormId = json.data?.id;

      if (newConsentFormId) {
        setConsentFormId(newConsentFormId);
      }

      setNote(
        newConsentFormId
          ? `Consent form created. ID: ${newConsentFormId}`
          : "Consent form created."
      );

      resetConsentForm();

      window.setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to create consent form.");
    } finally {
      setCreating(false);
    }
  }

  async function createConsentVersion() {
    setNote("");
    setErrorMessage("");

    if (!canManage) {
      setErrorMessage("You do not have permission to create consent versions.");
      return;
    }

    if (!consentFormId.trim()) {
      setErrorMessage("Consent form ID is required.");
      return;
    }

    setCreatingVersion(true);

    try {
      const response = await fetch(
        `/api/consent-forms/${consentFormId.trim()}/versions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version_label: versionLabel.trim() || "v1.0",
            study_information: studyInformation.trim() || null,
            privacy_information: privacyInformation.trim() || null,
            risks_benefits: risksBenefits.trim() || null,
            voluntary_participation: voluntaryParticipation.trim() || null,
            contact_details: contactDetails.trim() || null,
            checkbox_statements: parseCheckboxStatements(checkboxStatements),
            full_text: fullText.trim() || null,
            status: versionStatus,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to create consent version.");
      }

      setNote(
        versionStatus === "published"
          ? "Consent version created and published."
          : "Consent version created."
      );

      resetVersionForm();

      window.setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to create consent version.");
    } finally {
      setCreatingVersion(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Research"
        title="Consent Forms"
        subtitle="Create consent forms, manage versions and track consent records."
        actions={
          <>
            <LinkButton href="/research-care/research">Research</LinkButton>
            <LinkButton href="/">Dashboard</LinkButton>
          </>
        }
      />

      {errorMessage ? <Notice tone="danger">{errorMessage}</Notice> : null}
      {note ? <Notice tone="success">{note}</Notice> : null}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
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
          <p className="text-xs font-black uppercase text-slate-500">Role</p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {context?.project_role ?? context?.organisation_role ?? "—"}
          </p>
        </CompactCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <CompactCard title="Create consent form">
          <div className="space-y-3">
            <FieldLabel label="Title">
              <TextInput
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Study consent form"
              />
            </FieldLabel>

            <div className="grid grid-cols-2 gap-3">
              <FieldLabel label="Language">
                <SelectInput
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  <option value="en">English</option>
                  <option value="zu">isiZulu</option>
                </SelectInput>
              </FieldLabel>

              <FieldLabel label="Status">
                <SelectInput
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </SelectInput>
              </FieldLabel>
            </div>

            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short description"
              className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#F26A21]"
            />

            <PrimaryButton
              onClick={createConsentForm}
              disabled={creating || !canManage || !activeProjectId}
            >
              {creating ? "Creating..." : "Create consent form"}
            </PrimaryButton>

            {!canManage ? (
              <p className="text-xs font-bold text-slate-500">
                Your role can view consent forms but cannot create or publish.
              </p>
            ) : null}
          </div>
        </CompactCard>

        <CompactCard title="Create consent version">
          <div className="grid gap-3 md:grid-cols-2">
            <FieldLabel label="Consent form ID">
              <TextInput
                value={consentFormId}
                onChange={(event) => setConsentFormId(event.target.value)}
                placeholder="Paste consent form ID"
              />
            </FieldLabel>

            <FieldLabel label="Version label">
              <TextInput
                value={versionLabel}
                onChange={(event) => setVersionLabel(event.target.value)}
                placeholder="v1.0"
              />
            </FieldLabel>

            <FieldLabel label="Status">
              <SelectInput
                value={versionStatus}
                onChange={(event) => setVersionStatus(event.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </SelectInput>
            </FieldLabel>

            <FieldLabel label="Contact details">
              <TextInput
                value={contactDetails}
                onChange={(event) => setContactDetails(event.target.value)}
                placeholder="PI/contact details"
              />
            </FieldLabel>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <textarea
              value={studyInformation}
              onChange={(event) => setStudyInformation(event.target.value)}
              placeholder="Study information"
              className="min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#F26A21]"
            />

            <textarea
              value={privacyInformation}
              onChange={(event) => setPrivacyInformation(event.target.value)}
              placeholder="Privacy information"
              className="min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#F26A21]"
            />

            <textarea
              value={risksBenefits}
              onChange={(event) => setRisksBenefits(event.target.value)}
              placeholder="Risks and benefits"
              className="min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#F26A21]"
            />

            <textarea
              value={voluntaryParticipation}
              onChange={(event) => setVoluntaryParticipation(event.target.value)}
              placeholder="Voluntary participation"
              className="min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#F26A21]"
            />
          </div>

          <textarea
            value={checkboxStatements}
            onChange={(event) => setCheckboxStatements(event.target.value)}
            placeholder={"Checkbox statements, one per line\nI have read and understood the study information.\nI agree to participate voluntarily."}
            className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#F26A21]"
          />

          <textarea
            value={fullText}
            onChange={(event) => setFullText(event.target.value)}
            placeholder="Full consent text"
            className="mt-3 min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#F26A21]"
          />

          <div className="mt-3">
            <PrimaryButton
              onClick={createConsentVersion}
              disabled={creatingVersion || !canManage}
            >
              {creatingVersion ? "Creating..." : "Create version"}
            </PrimaryButton>
          </div>
        </CompactCard>
      </div>

      <div className="mt-4">
        <LargeTableClient config={tableConfigs.consent} />
      </div>
    </PageShell>
  );
}