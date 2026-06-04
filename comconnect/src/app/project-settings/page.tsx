"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { VerticalAppShell } from "@/components/comconnect-ui/VerticalAppShell";

type ProjectOption = {
  id: string;
  name: string;
  project_code?: string | null;
  role?: string | null;
};

type CurrentContext = {
  organisation_id?: string | null;
  organisation_name?: string | null;
  organisation_role?: string | null;
  active_project_id?: string | null;
  active_project_name?: string | null;
  project_role?: string | null;
  allowed_projects?: ProjectOption[];
  can_manage_projects?: boolean;
};

type ProjectSettings = {
  modules: {
    core_communication: boolean;
    research: boolean;
    care: boolean;
    api: boolean;
  };
  research: {
    education_library: boolean;
    questionnaires: boolean;
    consent_forms: boolean;
    media_library: boolean;
  };
  care: {
    health_checkins: boolean;
    appointments: boolean;
    referrals: boolean;
    help_requests: boolean;
  };
  channels: {
    app: boolean;
    push: boolean;
    sms: boolean;
    whatsapp: boolean;
    voice: boolean;
  };
  fallback: {
    enabled: boolean;
    order: string[];
  };
};

type ProjectRecord = {
  id: string;
  organisation_id: string;
  name: string;
  project_code: string;
  description?: string | null;
  status?: string | null;
  default_language?: string | null;
  app_access_enabled?: boolean | null;
  settings?: Partial<ProjectSettings> | null;
};

const defaultSettings: ProjectSettings = {
  modules: {
    core_communication: true,
    research: true,
    care: true,
    api: false,
  },
  research: {
    education_library: true,
    questionnaires: true,
    consent_forms: true,
    media_library: true,
  },
  care: {
    health_checkins: true,
    appointments: true,
    referrals: true,
    help_requests: true,
  },
  channels: {
    app: true,
    push: true,
    sms: true,
    whatsapp: false,
    voice: true,
  },
  fallback: {
    enabled: true,
    order: ["app", "push", "sms", "voice"],
  },
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseSettings(value: any): ProjectSettings {
  return {
    modules: {
      ...defaultSettings.modules,
      ...(value?.modules ?? {}),
    },
    research: {
      ...defaultSettings.research,
      ...(value?.research ?? {}),
    },
    care: {
      ...defaultSettings.care,
      ...(value?.care ?? {}),
    },
    channels: {
      ...defaultSettings.channels,
      ...(value?.channels ?? {}),
    },
    fallback: {
      ...defaultSettings.fallback,
      ...(value?.fallback ?? {}),
      order: Array.isArray(value?.fallback?.order)
        ? value.fallback.order
        : defaultSettings.fallback.order,
    },
  };
}

function statusClass(status?: string | null) {
  const value = cleanText(status).toLowerCase();

  if (value === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "archived") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  if (value === "paused") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl border border-orange-100 bg-white p-3 shadow-sm">
      <span>
        <span className="block text-sm font-black text-slate-950">
          {title}
        </span>
        <span className="mt-0.5 block text-xs font-semibold text-slate-500">
          {description}
        </span>
      </span>

      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0"
      />
    </label>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-base font-black text-slate-950">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            {subtitle}
          </p>
        ) : null}
      </div>

      {children}
    </section>
  );
}

export default function ProjectSettingsPage() {
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [settings, setSettings] = useState<ProjectSettings>(defaultSettings);

  const [name, setName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [appAccessEnabled, setAppAccessEnabled] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  const projects = context?.allowed_projects ?? [];
  const selectedProject = projects.find((item) => item.id === selectedProjectId);

  const canManage =
    context?.can_manage_projects ||
    ["superadmin", "organisation_admin", "org_admin", "admin"].includes(
      cleanText(context?.organisation_role).toLowerCase()
    ) ||
    ["project_manager"].includes(cleanText(context?.project_role).toLowerCase());

  const projectMode = useMemo(() => {
    if (settings.modules.research && settings.modules.care) {
      return "Research + Care";
    }

    if (settings.modules.research) {
      return "Research only";
    }

    if (settings.modules.care) {
      return "Care only";
    }

    return "Core communication only";
  }, [settings.modules.research, settings.modules.care]);

  function updateSettings(updater: (current: ProjectSettings) => ProjectSettings) {
    setSettings((current) => updater(current));
  }

  function setProjectType(type: "research" | "care" | "both") {
    updateSettings((current) => ({
      ...current,
      modules: {
        ...current.modules,
        research: type === "research" || type === "both",
        care: type === "care" || type === "both",
      },
    }));
  }

  async function loadContext() {
    setLoading(true);
    setNote("");

    try {
      const response = await fetch("/api/context/current", {
        cache: "no-store",
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load current context.");
      }

      const currentContext = json.data as CurrentContext;
      setContext(currentContext);

      const params = new URLSearchParams(window.location.search);
      const urlProjectId = cleanText(params.get("project_id"));

      const initialProjectId =
        urlProjectId ||
        currentContext.active_project_id ||
        currentContext.allowed_projects?.[0]?.id ||
        "";

      setSelectedProjectId(initialProjectId);

      if (initialProjectId) {
        await loadProject(initialProjectId);
      } else {
        setProject(null);
        setNote("No accessible project found for this user.");
      }
    } catch (error: any) {
      setNote(error?.message ?? "Failed to load project settings.");
    } finally {
      setLoading(false);
    }
  }

  async function loadProject(projectId = selectedProjectId) {
    if (!projectId) return;

    setLoading(true);
    setNote("");

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        cache: "no-store",
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load project.");
      }

      const loadedProject = json.data as ProjectRecord;
      const loadedSettings = normaliseSettings(loadedProject.settings ?? {});

      setProject(loadedProject);
      setSettings(loadedSettings);

      setName(loadedProject.name ?? "");
      setProjectCode(loadedProject.project_code ?? "");
      setDescription(loadedProject.description ?? "");
      setStatus(loadedProject.status ?? "active");
      setDefaultLanguage(loadedProject.default_language ?? "en");
      setAppAccessEnabled(Boolean(loadedProject.app_access_enabled ?? true));
    } catch (error: any) {
      setNote(error?.message ?? "Failed to load project.");
    } finally {
      setLoading(false);
    }
  }

  async function saveProjectSettings(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedProjectId) {
      setNote("Select a project first.");
      return;
    }

    if (!canManage) {
      setNote("You do not have permission to edit this project.");
      return;
    }

    if (!cleanText(name)) {
      setNote("Project name is required.");
      return;
    }

    setSaving(true);
    setNote("");

    try {
      const response = await fetch(`/api/projects/${selectedProjectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          project_code: projectCode,
          description,
          status,
          default_language: defaultLanguage,
          app_access_enabled: appAccessEnabled,
          settings,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to save project settings.");
      }

      await loadProject(selectedProjectId);
      setNote("Project settings saved.");
    } catch (error: any) {
      setNote(error?.message ?? "Failed to save project settings.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadProject(selectedProjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  return (
    <VerticalAppShell
      organisationRole={context?.organisation_role ?? "organisation_admin"}
      projectRole={context?.project_role ?? "project_manager"}
      organisationName={context?.organisation_name ?? "Current organisation"}
      projectName={selectedProject?.name ?? project?.name ?? "Project settings"}
    >
      <main className="px-4 py-4 lg:px-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F26A21]">
              Project Configuration
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">
              Project Settings
            </h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-600">
              Configure project identity, active modules, channels and fallback
              behaviour.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/projects"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21]"
            >
              Projects
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21]"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {note ? (
          <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm font-bold text-orange-800">
            {note}
          </div>
        ) : null}

        <section className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase text-slate-500">
              Organisation
            </p>
            <p className="mt-1 text-sm font-black text-slate-950">
              {context?.organisation_name ?? "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase text-slate-500">
              Active mode
            </p>
            <p className="mt-1 text-sm font-black text-[#F26A21]">
              {projectMode}
            </p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase text-slate-500">
              Permission
            </p>
            <p className="mt-1 text-sm font-black text-slate-950">
              {canManage ? "Can edit settings" : "Read only"}
            </p>
          </div>
        </section>

        <section className="mb-4 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <label className="block max-w-xl">
            <span className="text-xs font-black uppercase text-slate-500">
              Project
            </span>
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800"
            >
              {projects.length === 0 ? (
                <option value="">No accessible projects</option>
              ) : (
                projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} {item.project_code ? `(${item.project_code})` : ""}
                  </option>
                ))
              )}
            </select>
          </label>
        </section>

        {loading ? (
          <div className="rounded-2xl bg-white p-6 text-center text-sm font-black text-slate-500 shadow-sm">
            Loading project settings...
          </div>
        ) : (
          <form onSubmit={saveProjectSettings} className="space-y-4">
            <SectionCard
              title="Project identity"
              subtitle="Basic project details and status."
            >
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">
                    Project name
                  </span>
                  <input
                    value={name}
                    disabled={!canManage}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800 disabled:bg-slate-50"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">
                    Project code
                  </span>
                  <input
                    value={projectCode}
                    disabled={!canManage}
                    onChange={(event) => setProjectCode(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800 disabled:bg-slate-50"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-xs font-black uppercase text-slate-500">
                    Description
                  </span>
                  <textarea
                    value={description}
                    disabled={!canManage}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800 disabled:bg-slate-50"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">
                    Status
                  </span>
                  <select
                    value={status}
                    disabled={!canManage}
                    onChange={(event) => setStatus(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 disabled:bg-slate-50"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">
                    Default language
                  </span>
                  <select
                    value={defaultLanguage}
                    disabled={!canManage}
                    onChange={(event) => setDefaultLanguage(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 disabled:bg-slate-50"
                  >
                    <option value="en">English</option>
                    <option value="zu">isiZulu</option>
                  </select>
                </label>

                <div className="md:col-span-2">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(
                      status
                    )}`}
                  >
                    {status}
                  </span>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Project type"
              subtitle="Choose whether this project runs research, care or both."
            >
              <div className="grid gap-3 md:grid-cols-3">
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => setProjectType("research")}
                  className={`rounded-2xl border p-4 text-left shadow-sm disabled:opacity-60 ${
                    settings.modules.research && !settings.modules.care
                      ? "border-[#F26A21] bg-[#FFF7F2]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="font-black text-slate-950">Research only</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Education, questionnaires, consent and research media.
                  </p>
                </button>

                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => setProjectType("care")}
                  className={`rounded-2xl border p-4 text-left shadow-sm disabled:opacity-60 ${
                    settings.modules.care && !settings.modules.research
                      ? "border-[#F26A21] bg-[#FFF7F2]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="font-black text-slate-950">Care only</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Health check-ins, appointments, referrals and follow-up.
                  </p>
                </button>

                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => setProjectType("both")}
                  className={`rounded-2xl border p-4 text-left shadow-sm disabled:opacity-60 ${
                    settings.modules.research && settings.modules.care
                      ? "border-[#F26A21] bg-[#FFF7F2]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="font-black text-slate-950">Research + Care</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Use both research tools and care/follow-up workflows.
                  </p>
                </button>
              </div>
            </SectionCard>

            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard
                title="Research tools"
                subtitle="Shown when the research module is active."
              >
                <div className="space-y-2">
                  <ToggleRow
                    title="Education Library"
                    description="Project education messages and media."
                    checked={settings.research.education_library}
                    disabled={!canManage || !settings.modules.research}
                    onChange={(checked) =>
                      updateSettings((current) => ({
                        ...current,
                        research: {
                          ...current.research,
                          education_library: checked,
                        },
                      }))
                    }
                  />

                  <ToggleRow
                    title="Questionnaires"
                    description="Questionnaire assignments and responses."
                    checked={settings.research.questionnaires}
                    disabled={!canManage || !settings.modules.research}
                    onChange={(checked) =>
                      updateSettings((current) => ({
                        ...current,
                        research: {
                          ...current.research,
                          questionnaires: checked,
                        },
                      }))
                    }
                  />

                  <ToggleRow
                    title="Consent Forms"
                    description="Consent forms and consent records."
                    checked={settings.research.consent_forms}
                    disabled={!canManage || !settings.modules.research}
                    onChange={(checked) =>
                      updateSettings((current) => ({
                        ...current,
                        research: {
                          ...current.research,
                          consent_forms: checked,
                        },
                      }))
                    }
                  />

                  <ToggleRow
                    title="Media Library"
                    description="Images, audio and videos for study content."
                    checked={settings.research.media_library}
                    disabled={!canManage || !settings.modules.research}
                    onChange={(checked) =>
                      updateSettings((current) => ({
                        ...current,
                        research: {
                          ...current.research,
                          media_library: checked,
                        },
                      }))
                    }
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="Care tools"
                subtitle="Shown when the care module is active."
              >
                <div className="space-y-2">
                  <ToggleRow
                    title="Health Check-ins"
                    description="BP and health observations."
                    checked={settings.care.health_checkins}
                    disabled={!canManage || !settings.modules.care}
                    onChange={(checked) =>
                      updateSettings((current) => ({
                        ...current,
                        care: {
                          ...current.care,
                          health_checkins: checked,
                        },
                      }))
                    }
                  />

                  <ToggleRow
                    title="Appointments"
                    description="Appointment scheduling and responses."
                    checked={settings.care.appointments}
                    disabled={!canManage || !settings.modules.care}
                    onChange={(checked) =>
                      updateSettings((current) => ({
                        ...current,
                        care: {
                          ...current.care,
                          appointments: checked,
                        },
                      }))
                    }
                  />

                  <ToggleRow
                    title="Referrals"
                    description="Referral queue and care escalation."
                    checked={settings.care.referrals}
                    disabled={!canManage || !settings.modules.care}
                    onChange={(checked) =>
                      updateSettings((current) => ({
                        ...current,
                        care: {
                          ...current.care,
                          referrals: checked,
                        },
                      }))
                    }
                  />

                  <ToggleRow
                    title="Help Requests"
                    description="Participant help requests and urgent follow-up."
                    checked={settings.care.help_requests}
                    disabled={!canManage || !settings.modules.care}
                    onChange={(checked) =>
                      updateSettings((current) => ({
                        ...current,
                        care: {
                          ...current.care,
                          help_requests: checked,
                        },
                      }))
                    }
                  />
                </div>
              </SectionCard>
            </div>

            <SectionCard
              title="Channels and fallback"
              subtitle="Choose available communication channels for this project."
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <ToggleRow
                  title="Participant App"
                  description="In-app education, replies and chat."
                  checked={settings.channels.app}
                  disabled={!canManage}
                  onChange={(checked) =>
                    updateSettings((current) => ({
                      ...current,
                      channels: { ...current.channels, app: checked },
                    }))
                  }
                />

                <ToggleRow
                  title="Push Notifications"
                  description="App alert notifications."
                  checked={settings.channels.push}
                  disabled={!canManage}
                  onChange={(checked) =>
                    updateSettings((current) => ({
                      ...current,
                      channels: { ...current.channels, push: checked },
                    }))
                  }
                />

                <ToggleRow
                  title="SMS"
                  description="SMS delivery and fallback."
                  checked={settings.channels.sms}
                  disabled={!canManage}
                  onChange={(checked) =>
                    updateSettings((current) => ({
                      ...current,
                      channels: { ...current.channels, sms: checked },
                    }))
                  }
                />

                <ToggleRow
                  title="WhatsApp"
                  description="Optional WhatsApp channel."
                  checked={settings.channels.whatsapp}
                  disabled={!canManage}
                  onChange={(checked) =>
                    updateSettings((current) => ({
                      ...current,
                      channels: { ...current.channels, whatsapp: checked },
                    }))
                  }
                />

                <ToggleRow
                  title="Voice"
                  description="Voice calls, IVR and recordings."
                  checked={settings.channels.voice}
                  disabled={!canManage}
                  onChange={(checked) =>
                    updateSettings((current) => ({
                      ...current,
                      channels: { ...current.channels, voice: checked },
                    }))
                  }
                />

                <ToggleRow
                  title="Fallback enabled"
                  description={`Current order: ${settings.fallback.order.join(
                    " → "
                  )}`}
                  checked={settings.fallback.enabled}
                  disabled={!canManage}
                  onChange={(checked) =>
                    updateSettings((current) => ({
                      ...current,
                      fallback: { ...current.fallback, enabled: checked },
                    }))
                  }
                />
              </div>
            </SectionCard>

            <div className="sticky bottom-3 z-20 rounded-2xl border border-orange-100 bg-white/95 p-3 shadow-lg backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-950">
                    {project?.name ?? "Project"}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">
                    {canManage
                      ? "Save changes to apply module/channel settings."
                      : "You have read-only access to these settings."}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={saving || !canManage || !selectedProjectId}
                  className="rounded-xl bg-[#F26A21] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save project settings"}
                </button>
              </div>
            </div>
          </form>
        )}
      </main>
    </VerticalAppShell>
  );
}