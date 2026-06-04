"use client";

import { useEffect, useMemo, useState } from "react";
import { VerticalAppShell } from "@/components/comconnect-ui/VerticalAppShell";
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
  can_export_data?: boolean;
  dev_fallback?: boolean;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function projectLabel(project: ProjectOption) {
  return project.project_code
    ? `${project.name} (${project.project_code})`
    : project.name;
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

  const projects = context?.allowed_projects ?? [];
  const selectedProject =
    projects.find((project) => project.id === projectId) ?? null;

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

  async function handleProjectChange(value: string) {
    setProjectId(value);
    await loadContext(value);
  }

  function download() {
    if (!canExport) {
      setNote("You do not have permission to export data.");
      return;
    }

    window.location.href = downloadUrl;
  }

  useEffect(() => {
    void loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <VerticalAppShell
      organisationRole={context?.organisation_role ?? "organisation_admin"}
      projectRole={context?.project_role ?? "project_manager"}
      organisationName={context?.organisation_name ?? "Current organisation"}
      projectName={selectedProject?.name ?? context?.active_project_name ?? "Export"}
    >
      <PageShell>
        <PageHeader
          eyebrow="Data and Reporting"
          title="Export Center"
          subtitle="Download project data in Excel, CSV, PDF, JSON or ZIP."
          actions={<LinkButton href="/">Dashboard</LinkButton>}
        />

        {note ? <Notice tone="warning">{note}</Notice> : null}

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <CompactCard>
            <p className="text-xs font-black uppercase text-slate-500">
              Organisation
            </p>
            <p className="mt-1 text-sm font-black text-slate-950">
              {context?.organisation_name ?? "Loading..."}
            </p>
          </CompactCard>

          <CompactCard>
            <p className="text-xs font-black uppercase text-slate-500">
              Project
            </p>
            <p className="mt-1 text-sm font-black text-slate-950">
              {selectedProject?.name ??
                context?.active_project_name ??
                "No project selected"}
            </p>
          </CompactCard>

          <CompactCard>
            <p className="text-xs font-black uppercase text-slate-500">
              Access
            </p>
            <p className="mt-1 text-sm font-black text-slate-950">
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

          <label className="mt-4 flex items-center gap-3 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
              className="h-4 w-4"
            />
            Include archived records
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <PrimaryButton disabled={!canExport || loadingContext} onClick={download}>
              Download
            </PrimaryButton>

            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21]"
            >
              Open URL
            </a>
          </div>
        </CompactCard>
      </PageShell>
    </VerticalAppShell>
  );
}