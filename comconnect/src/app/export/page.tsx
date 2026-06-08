"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { VerticalAppShell } from "@/components/comconnect-ui/VerticalAppShell";
import {
  CompactCard,
  FieldLabel,
  Notice,
  PageShell,
  SelectInput,
  TextInput,
} from "@/components/comconnect-ui/DashboardUI";

const DATASETS = [
  ["participants", "Participants"],
  ["app_messages", "App messages"],
  ["app_message_replies", "App replies"],
  ["central_inbox", "Central inbox"],
  ["delivery_events", "Delivery logs"],
  ["chat_threads", "Chat threads"],
  ["chat_messages", "Chat messages"],
  ["appointments", "Appointments"],
  ["referrals", "Referrals"],
  ["health_checkins", "Health check-ins"],
  ["voice_tasks", "Voice tasks"],
  ["audit_logs", "Audit logs"],
  ["media_manifest", "Media manifest"],
];

const FORMATS = [
  ["xlsx", "Excel"],
  ["csv", "CSV"],
  ["pdf", "PDF"],
  ["json", "JSON"],
  ["zip", "ZIP media"],
];

const QUESTIONNAIRE_EXPORT_OPTIONS = [
  ["questionnaire_docx", "Questionnaire document - Word"],
  ["responses_xlsx", "Questionnaire responses - Excel"],
  ["responses_csv", "Questionnaire responses - CSV"],
];

type ProjectOption = {
  id: string;
  name: string;
  project_code?: string | null;
};

type QuestionnaireOption = {
  id: string;
  title?: string | null;
  name?: string | null;
  questionnaire_type?: string | null;
  language?: string | null;
  status?: string | null;
  version_label?: string | null;
  created_at?: string | null;
};

type CurrentContext = {
  organisation_id?: string | null;
  organisation_name?: string | null;
  organisation_role?: string | null;
  active_project_id?: string | null;
  active_project_name?: string | null;
  project_role?: string | null;
  allowed_projects?: ProjectOption[];
  can_export_data?: boolean;
  dev_fallback?: boolean;
};

const pageLinkClass =
  "rounded-2xl border border-[#C9D8E4] bg-white px-4 py-2 text-sm font-black text-[#06324A] shadow-sm hover:border-[#0A5278] hover:text-[#0A5278]";

const primaryButtonClass =
  "rounded-2xl bg-[#0A5278] px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-[#06324A] disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClass =
  "rounded-xl border border-[#C9D8E4] bg-white px-4 py-2 text-xs font-black text-[#06324A] hover:border-[#0A5278] hover:text-[#0A5278] disabled:cursor-not-allowed disabled:opacity-50";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function projectLabel(project: ProjectOption) {
  return project.project_code
    ? `${project.name} (${project.project_code})`
    : project.name;
}

function questionnaireLabel(questionnaire: QuestionnaireOption) {
  const title = questionnaire.title || questionnaire.name || "Untitled questionnaire";

  const meta = [
    questionnaire.questionnaire_type,
    questionnaire.language,
    questionnaire.version_label,
    questionnaire.status,
  ]
    .map(cleanText)
    .filter(Boolean);

  return meta.length > 0 ? `${title} (${meta.join(" · ")})` : title;
}

function normaliseQuestionnaires(json: any): QuestionnaireOption[] {
  const candidates =
    json?.data?.questionnaires ??
    json?.data?.items ??
    json?.data ??
    json?.questionnaires ??
    json?.items ??
    [];

  return Array.isArray(candidates) ? candidates : [];
}

export default function ExportPage() {
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [dataset, setDataset] = useState("participants");
  const [format, setFormat] = useState("xlsx");
  const [mediaType, setMediaType] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState("");
  const [projectId, setProjectId] = useState("");
  const [limit, setLimit] = useState("5000");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [note, setNote] = useState("");
  const [loadingContext, setLoadingContext] = useState(true);

  const [questionnaires, setQuestionnaires] = useState<QuestionnaireOption[]>([]);
  const [questionnaireId, setQuestionnaireId] = useState("all");
  const [questionnaireExportType, setQuestionnaireExportType] =
    useState("questionnaire_docx");
  const [questionnaireStatus, setQuestionnaireStatus] = useState("");
  const [questionnaireLimit, setQuestionnaireLimit] = useState("50000");
  const [loadingQuestionnaires, setLoadingQuestionnaires] = useState(false);
  const [questionnaireNote, setQuestionnaireNote] = useState("");

  const projects = context?.allowed_projects ?? [];
  const selectedProject =
    projects.find((project) => project.id === projectId) ?? null;

  const selectedQuestionnaire =
    questionnaires.find((questionnaire) => questionnaire.id === questionnaireId) ??
    null;

  const canExport = Boolean(context?.can_export_data ?? true);

  const downloadUrl = useMemo(() => {
    const params = new URLSearchParams();

    params.set("dataset", dataset);
    params.set("format", format);
    params.set("limit", limit || "5000");

    if (projectId) {
      params.set("project_id", projectId);
    }

    if (dataset === "media_manifest" && mediaType) {
      params.set("media_type", mediaType);
    }

    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (status) params.set("status", status);
    if (includeArchived) params.set("include_archived", "true");

    return `/api/export?${params.toString()}`;
  }, [
    dataset,
    format,
    mediaType,
    start,
    end,
    status,
    projectId,
    limit,
    includeArchived,
  ]);

  const questionnaireDownloadUrl = useMemo(() => {
    const params = new URLSearchParams();

    if (questionnaireExportType === "questionnaire_docx") {
      params.set("dataset", "questionnaires_word");
      params.set("format", "docx");
    }

    if (questionnaireExportType === "responses_xlsx") {
      params.set("dataset", "questionnaire_responses");
      params.set("format", "xlsx");
    }

    if (questionnaireExportType === "responses_csv") {
      params.set("dataset", "questionnaire_responses");
      params.set("format", "csv");
    }

    params.set("limit", questionnaireLimit || "50000");

    if (projectId) {
      params.set("project_id", projectId);
    }

    if (questionnaireId && questionnaireId !== "all") {
      params.set("questionnaire_id", questionnaireId);
    }

    if (questionnaireStatus) {
      params.set("status", questionnaireStatus);
    }

    return `/api/export?${params.toString()}`;
  }, [
    projectId,
    questionnaireExportType,
    questionnaireId,
    questionnaireLimit,
    questionnaireStatus,
  ]);

  async function loadContext(projectIdOverride?: string) {
    setLoadingContext(true);
    setNote("");

    try {
      const params = new URLSearchParams();

      if (projectIdOverride) {
        params.set("project_id", projectIdOverride);
      }

      const response = await fetch(
        params.toString()
          ? `/api/context/current?${params.toString()}`
          : "/api/context/current",
        { cache: "no-store" }
      );

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load export context.");
      }

      const currentContext = json.data as CurrentContext;

      setContext(currentContext);

      const nextProjectId =
        projectIdOverride ||
        currentContext.active_project_id ||
        currentContext.allowed_projects?.[0]?.id ||
        "";

      setProjectId(nextProjectId);

      if (currentContext.dev_fallback) {
        setNote(
          "Development fallback is active. Real users will be scoped by login."
        );
      }
    } catch (error: any) {
      setNote(error?.message ?? "Failed to load export context.");
    } finally {
      setLoadingContext(false);
    }
  }

  async function loadQuestionnaires(nextProjectId = projectId) {
    setQuestionnaireNote("");

    if (!nextProjectId) {
      setQuestionnaires([]);
      setQuestionnaireId("all");
      return;
    }

    setLoadingQuestionnaires(true);

    try {
      const params = new URLSearchParams();
      params.set("project_id", nextProjectId);

      const response = await fetch(`/api/questionnaires?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load questionnaires.");
      }

      const rows = normaliseQuestionnaires(json);

      setQuestionnaires(rows);
      setQuestionnaireId((current) =>
        current === "all" || rows.some((row) => row.id === current)
          ? current
          : "all"
      );
    } catch (error: any) {
      setQuestionnaires([]);
      setQuestionnaireId("all");
      setQuestionnaireNote(error?.message ?? "Failed to load questionnaires.");
    } finally {
      setLoadingQuestionnaires(false);
    }
  }

  async function handleProjectChange(value: string) {
    setProjectId(value);
    setQuestionnaireId("all");
    await loadContext(value);
    await loadQuestionnaires(value);
  }

  function download() {
    if (!canExport) {
      setNote("You do not have permission to export data.");
      return;
    }

    window.location.href = downloadUrl;
  }

  function downloadQuestionnaire() {
    setQuestionnaireNote("");

    if (!canExport) {
      setQuestionnaireNote("You do not have permission to export data.");
      return;
    }

    if (!projectId) {
      setQuestionnaireNote("Select a project before exporting questionnaires.");
      return;
    }

    window.location.href = questionnaireDownloadUrl;
  }

  useEffect(() => {
    void loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (projectId) {
      void loadQuestionnaires(projectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <VerticalAppShell
      organisationRole={context?.organisation_role ?? "organisation_admin"}
      projectRole={context?.project_role ?? "project_manager"}
      organisationName={context?.organisation_name ?? "Current organisation"}
      projectName={selectedProject?.name ?? context?.active_project_name ?? "Export"}
    >
      <PageShell>
        <section className="mb-5 rounded-[2rem] border border-[#C9D8E4] bg-[#032A3D] p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#C9D8E4]">
            Data and reporting
          </p>

          <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-2xl font-black tracking-tight">
                Export Center
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#EAF2F8]">
                Download project data in Excel, CSV, PDF, JSON or ZIP.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard" className={pageLinkClass}>
                Dashboard
              </Link>
              <Link href="/audit-logs" className={pageLinkClass}>
                Audit Logs
              </Link>
            </div>
          </div>
        </section>

        {note ? <Notice tone="warning">{note}</Notice> : null}

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <CompactCard>
            <p className="text-xs font-black uppercase text-[#536271]">
              Organisation
            </p>
            <p className="mt-1 text-sm font-black text-[#06324A]">
              {context?.organisation_name ?? "Loading..."}
            </p>
          </CompactCard>

          <CompactCard>
            <p className="text-xs font-black uppercase text-[#536271]">
              Project
            </p>
            <p className="mt-1 text-sm font-black text-[#06324A]">
              {selectedProject?.name ??
                context?.active_project_name ??
                "No project selected"}
            </p>
          </CompactCard>

          <CompactCard>
            <p className="text-xs font-black uppercase text-[#536271]">
              Access
            </p>
            <p className="mt-1 text-sm font-black text-[#06324A]">
              {canExport ? "Export allowed" : "Read only"}
            </p>
          </CompactCard>
        </div>

        <CompactCard title="Export options">
          <div className="grid gap-3 md:grid-cols-2">
            <FieldLabel label="Project">
              <SelectInput
                value={projectId}
                onChange={(event) => void handleProjectChange(event.target.value)}
                disabled={loadingContext || projects.length === 0}
              >
                {projects.length === 0 ? (
                  <option value="">No accessible project</option>
                ) : (
                  projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {projectLabel(project)}
                    </option>
                  ))
                )}
              </SelectInput>
            </FieldLabel>

            <FieldLabel label="Dataset">
              <SelectInput
                value={dataset}
                onChange={(event) => setDataset(event.target.value)}
              >
                {DATASETS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectInput>
            </FieldLabel>

            <FieldLabel label="Format">
              <SelectInput
                value={format}
                onChange={(event) => setFormat(event.target.value)}
              >
                {FORMATS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectInput>
            </FieldLabel>

            <FieldLabel label="Media type">
              <SelectInput
                value={mediaType}
                onChange={(event) => setMediaType(event.target.value)}
                disabled={dataset !== "media_manifest"}
              >
                <option value="all">All media</option>
                <option value="video">Videos</option>
                <option value="audio">Audio</option>
                <option value="image">Images</option>
              </SelectInput>
            </FieldLabel>

            <FieldLabel label="Start date">
              <TextInput
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </FieldLabel>

            <FieldLabel label="End date">
              <TextInput
                type="date"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </FieldLabel>

            <FieldLabel label="Status">
              <TextInput
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                placeholder="open, active, failed..."
              />
            </FieldLabel>

            <FieldLabel label="Row limit">
              <TextInput
                type="number"
                min="1"
                max="50000"
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
              />
            </FieldLabel>
          </div>

          <label className="mt-4 flex items-center gap-3 text-sm font-bold text-[#06324A]">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
              className="h-4 w-4"
            />
            Include archived records
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!canExport || loadingContext}
              onClick={download}
              className={primaryButtonClass}
            >
              Download
            </button>

            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className={secondaryButtonClass}
            >
              Open URL
            </a>
          </div>
        </CompactCard>

        <div className="mt-5">
          <CompactCard
            title="Questionnaire Export"
            subtitle="Download questionnaire forms as Word documents or questionnaire responses as Excel/CSV without changing the general dataset export above."
          >
            {questionnaireNote ? (
              <Notice tone="warning">{questionnaireNote}</Notice>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <FieldLabel label="Questionnaire">
                <SelectInput
                  value={questionnaireId}
                  onChange={(event) => setQuestionnaireId(event.target.value)}
                  disabled={loadingQuestionnaires || !projectId}
                >
                  <option value="all">
                    All questionnaires in this project
                  </option>

                  {questionnaires.map((questionnaire) => (
                    <option key={questionnaire.id} value={questionnaire.id}>
                      {questionnaireLabel(questionnaire)}
                    </option>
                  ))}
                </SelectInput>
              </FieldLabel>

              <FieldLabel label="Export type">
                <SelectInput
                  value={questionnaireExportType}
                  onChange={(event) =>
                    setQuestionnaireExportType(event.target.value)
                  }
                >
                  {QUESTIONNAIRE_EXPORT_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectInput>
              </FieldLabel>

              <FieldLabel label="Response status">
                <TextInput
                  value={questionnaireStatus}
                  onChange={(event) => setQuestionnaireStatus(event.target.value)}
                  placeholder="submitted, synced, completed..."
                />
              </FieldLabel>

              <FieldLabel label="Response row limit">
                <TextInput
                  type="number"
                  min="1"
                  max="50000"
                  value={questionnaireLimit}
                  onChange={(event) => setQuestionnaireLimit(event.target.value)}
                />
              </FieldLabel>
            </div>

            <div className="mt-4 rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] p-4">
              <p className="text-xs font-black uppercase text-[#536271]">
                Selected
              </p>
              <p className="mt-1 text-sm font-bold text-[#06324A]">
                {questionnaireId === "all"
                  ? "All questionnaires in this project"
                  : selectedQuestionnaire
                    ? questionnaireLabel(selectedQuestionnaire)
                    : "Selected questionnaire"}
              </p>
              <p className="mt-1 text-xs font-bold text-[#536271]">
                {loadingQuestionnaires
                  ? "Loading questionnaires..."
                  : `${questionnaires.length} questionnaire(s) available in this project`}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!canExport || loadingContext || !projectId}
                onClick={downloadQuestionnaire}
                className={primaryButtonClass}
              >
                Download Questionnaire Export
              </button>

              <a
                href={questionnaireDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className={secondaryButtonClass}
              >
                Open Questionnaire URL
              </a>
            </div>
          </CompactCard>
        </div>
      </PageShell>
    </VerticalAppShell>
  );
}
