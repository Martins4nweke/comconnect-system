"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { VerticalAppShell } from "@/components/comconnect-ui/VerticalAppShell";

type ProjectRow = {
  id: string;
  organisation_id: string;
  name: string;
  project_code: string;
  description?: string | null;
  status?: string | null;
  default_language?: string | null;
  app_access_enabled?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  role?: string | null;
};

type CurrentContext = {
  organisation_id?: string | null;
  organisation_name?: string | null;
  organisation_role?: string | null;
  active_project_id?: string | null;
  active_project_name?: string | null;
  project_role?: string | null;
  allowed_projects?: ProjectRow[];
  can_manage_projects?: boolean;
  can_create_projects?: boolean;
  can_archive_projects?: boolean;
  dev_fallback?: boolean;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function dateText(value: unknown) {
  if (!value) return "—";

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString();
}

function statusClass(status?: string | null) {
  const value = cleanText(status).toLowerCase();

  if (value === "active") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (value === "archived") {
    return "bg-slate-100 text-slate-600 border-slate-200";
  }

  if (value === "paused") {
    return "bg-orange-50 text-orange-700 border-orange-200";
  }

  return "bg-slate-50 text-slate-700 border-slate-200";
}

function projectOptionLabel(project: ProjectRow) {
  const code = cleanText(project.project_code);
  return code ? `${project.name} (${code})` : project.name;
}

export default function ProjectsPage() {
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [description, setDescription] = useState("");
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [appAccessEnabled, setAppAccessEnabled] = useState(true);

  const organisationId = cleanText(context?.organisation_id);
  const canManageProjects = Boolean(context?.can_manage_projects);
  const canCreateProjects = Boolean(context?.can_create_projects);
  const canArchiveProjects = Boolean(context?.can_archive_projects);

  const selectedProject = useMemo(() => {
    return projects.find((project) => project.id === selectedProjectId) ?? null;
  }, [projects, selectedProjectId]);

  const filteredProjects = useMemo(() => {
    const search = cleanText(q).toLowerCase();

    return projects.filter((project) => {
      const projectStatus = cleanText(project.status).toLowerCase();

      if (status !== "all" && projectStatus !== status) {
        return false;
      }

      if (!search) return true;

      return [
        project.name,
        project.project_code,
        project.description,
        project.role,
      ]
        .map((value) => cleanText(value).toLowerCase())
        .some((value) => value.includes(search));
    });
  }, [projects, q, status]);

  async function fetchContext(projectId?: string) {
    const params = new URLSearchParams();

    if (projectId) {
      params.set("project_id", projectId);
    }

    const url = params.toString()
      ? `/api/context/current?${params.toString()}`
      : "/api/context/current";

    const response = await fetch(url, {
      cache: "no-store",
    });

    const json = await response.json().catch(() => null);

    if (!response.ok || !json?.ok) {
      throw new Error(json?.error ?? "Failed to load organisation context.");
    }

    return json.data as CurrentContext;
  }

  async function fetchOrganisationProjects(currentContext: CurrentContext) {
    const currentOrganisationId = cleanText(currentContext.organisation_id);

    if (!currentOrganisationId) {
      return currentContext.allowed_projects ?? [];
    }

    if (!currentContext.can_manage_projects) {
      return currentContext.allowed_projects ?? [];
    }

    const params = new URLSearchParams();
    params.set("organisation_id", currentOrganisationId);

    if (status && status !== "all") {
      params.set("status", status);
    }

    if (q) {
      params.set("q", q);
    }

    const response = await fetch(`/api/projects?${params.toString()}`, {
      cache: "no-store",
    });

    const json = await response.json().catch(() => null);

    if (!response.ok || !json?.ok) {
      throw new Error(json?.error ?? "Failed to load organisation projects.");
    }

    return json.data?.rows ?? [];
  }

  async function loadContextAndProjects(projectId?: string) {
    setLoading(true);
    setNote("");

    try {
      const currentContext = await fetchContext(projectId);
      const loadedProjects = await fetchOrganisationProjects(currentContext);

      setContext(currentContext);
      setProjects(loadedProjects);

      const activeId =
        projectId ||
        currentContext.active_project_id ||
        loadedProjects[0]?.id ||
        "";

      setSelectedProjectId(activeId);

      if (currentContext.dev_fallback) {
        setNote(
          "Development fallback is active. Later, this organisation/project will come from the logged-in user session."
        );
      }
    } catch (error: any) {
      setNote(error?.message ?? "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }

  async function loadProjectsOnly() {
    if (!context) {
      await loadContextAndProjects();
      return;
    }

    setLoading(true);
    setNote("");

    try {
      const loadedProjects = await fetchOrganisationProjects(context);
      setProjects(loadedProjects);

      if (
        selectedProjectId &&
        !loadedProjects.some((project: ProjectRow) => project.id === selectedProjectId)
      ) {
        setSelectedProjectId(loadedProjects[0]?.id ?? "");
      }
    } catch (error: any) {
      setNote(error?.message ?? "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }

  async function handleProjectChange(projectId: string) {
    setSelectedProjectId(projectId);
    await loadContextAndProjects(projectId);
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canCreateProjects) {
      setNote("You do not have permission to create projects.");
      return;
    }

    if (!organisationId) {
      setNote("No organisation context was found.");
      return;
    }

    if (!cleanText(name)) {
      setNote("Project name is required.");
      return;
    }

    setLoading(true);
    setNote("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organisation_id: organisationId,
          name,
          project_code: projectCode || name,
          description,
          default_language: defaultLanguage,
          app_access_enabled: appAccessEnabled,
          settings: {},
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to create project.");
      }

      const createdProject = json.data as ProjectRow;

      setName("");
      setProjectCode("");
      setDescription("");
      setDefaultLanguage("en");
      setAppAccessEnabled(true);

      await loadContextAndProjects(createdProject.id);

      setNote("Project created successfully.");
    } catch (error: any) {
      setNote(error?.message ?? "Failed to create project.");
    } finally {
      setLoading(false);
    }
  }

  async function archiveProject(projectId: string) {
    if (!canArchiveProjects) {
      setNote("You do not have permission to archive projects.");
      return;
    }

    const confirmed = window.confirm(
      "Archive this project? Existing data will remain but the project status will become archived."
    );

    if (!confirmed) return;

    setLoading(true);
    setNote("");

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to archive project.");
      }

      await loadContextAndProjects(
        selectedProjectId === projectId ? undefined : selectedProjectId
      );

      setNote("Project archived.");
    } catch (error: any) {
      setNote(error?.message ?? "Failed to archive project.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadContextAndProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (context) {
      void loadProjectsOnly();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <VerticalAppShell
      organisationRole={context?.organisation_role ?? "organisation_admin"}
      projectRole={context?.project_role ?? "project_manager"}
      organisationName={context?.organisation_name ?? "Current organisation"}
      projectName={selectedProject?.name ?? context?.active_project_name ?? "Projects"}
    >
      <main className="px-4 py-4 lg:px-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F26A21]">
              Organisation Setup
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">
              Projects
            </h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-600">
              Manage organisation projects and switch between the projects you
              are allowed to access.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21]"
          >
            Dashboard
          </Link>
        </div>

        {note ? (
          <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm font-bold text-orange-800">
            {note}
          </div>
        ) : null}

        <section className="mb-4 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="text-xs font-black uppercase text-slate-500">
                Organisation
              </p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {context?.organisation_name ?? "Loading organisation..."}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Role: {context?.organisation_role ?? "—"}
              </p>
            </div>

            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Project dropdown
              </span>
              <select
                value={selectedProjectId}
                onChange={(event) => void handleProjectChange(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800"
              >
                {projects.length === 0 ? (
                  <option value="">No project available</option>
                ) : (
                  projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {projectOptionLabel(project)}
                    </option>
                  ))
                )}
              </select>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {canManageProjects
                  ? "Organisation admin view: all organisation projects."
                  : "Project member view: assigned projects only."}
              </p>
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Status filter
              </span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800"
              >
                <option value="all">All allowed projects</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void loadProjectsOnly();
                }
              }}
              placeholder="Search project name, code or role..."
              className="min-w-[220px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800"
            />

            <button
              type="button"
              onClick={loadProjectsOnly}
              disabled={loading}
              className="rounded-xl bg-[#F26A21] px-4 py-2 text-xs font-black text-white disabled:opacity-50"
            >
              {loading ? "Loading..." : "Search"}
            </button>

            <button
              type="button"
              onClick={() => {
                setQ("");
                void loadContextAndProjects(selectedProjectId);
              }}
              disabled={loading}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21] disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </section>

        {canCreateProjects ? (
          <section className="mb-4 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <h2 className="text-base font-black text-slate-950">
              Create project
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              New projects will be created under{" "}
              {context?.organisation_name ?? "this organisation"}.
            </p>

            <form
              onSubmit={createProject}
              className="mt-3 grid gap-3 md:grid-cols-2"
            >
              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">
                  Project name
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Durban Hypertension Study"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800"
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">
                  Project code
                </span>
                <input
                  value={projectCode}
                  onChange={(event) => setProjectCode(event.target.value)}
                  placeholder="DURB_HTN"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-xs font-black uppercase text-slate-500">
                  Description
                </span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Brief project description"
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800"
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">
                  Default language
                </span>
                <select
                  value={defaultLanguage}
                  onChange={(event) => setDefaultLanguage(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800"
                >
                  <option value="en">English</option>
                  <option value="zu">isiZulu</option>
                </select>
              </label>

              <label className="flex items-center gap-3 pt-6 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={appAccessEnabled}
                  onChange={(event) =>
                    setAppAccessEnabled(event.target.checked)
                  }
                  className="h-4 w-4"
                />
                Participant app access enabled
              </label>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-[#F26A21] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Create project"}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="mb-4 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <h2 className="text-base font-black text-slate-950">
              Project access
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              You can view only the projects where you are an active project
              member. Contact an organisation admin to create or assign projects.
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-950">
                {canManageProjects ? "Organisation projects" : "My projects"}
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                {filteredProjects.length} project(s)
              </p>
            </div>

            {selectedProject ? (
              <Link
                href={`/project-settings?project_id=${selectedProject.id}`}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21]"
              >
                Open selected settings
              </Link>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                  <th className="px-3 py-2 font-black">Project</th>
                  <th className="px-3 py-2 font-black">Code</th>
                  <th className="px-3 py-2 font-black">Status</th>
                  <th className="px-3 py-2 font-black">Role</th>
                  <th className="px-3 py-2 font-black">Language</th>
                  <th className="px-3 py-2 font-black">App</th>
                  <th className="px-3 py-2 font-black">Created</th>
                  <th className="px-3 py-2 font-black">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-sm font-bold text-slate-500"
                    >
                      No projects found.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((project) => (
                    <tr
                      key={project.id}
                      className={[
                        "border-b border-slate-50 hover:bg-[#FFF7F2]",
                        project.id === selectedProjectId ? "bg-orange-50" : "",
                      ].join(" ")}
                    >
                      <td className="px-3 py-3">
                        <p className="font-black text-slate-900">
                          {project.name}
                        </p>
                        <p className="max-w-md truncate text-xs font-semibold text-slate-500">
                          {project.description || "—"}
                        </p>
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-700">
                        {project.project_code}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full border px-2 py-1 text-xs font-black ${statusClass(
                            project.status
                          )}`}
                        >
                          {project.status || "unknown"}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-700">
                        {project.role || "—"}
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-700">
                        {project.default_language || "—"}
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-700">
                        {project.app_access_enabled ? "Enabled" : "Disabled"}
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-500">
                        {dateText(project.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleProjectChange(project.id)}
                            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21]"
                          >
                            Select
                          </button>

                          <Link
                            href={`/project-settings?project_id=${project.id}`}
                            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21]"
                          >
                            Settings
                          </Link>

                          {canArchiveProjects && project.status !== "archived" ? (
                            <button
                              type="button"
                              onClick={() => archiveProject(project.id)}
                              className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-black text-red-700 hover:bg-red-50"
                            >
                              Archive
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </VerticalAppShell>
  );
}
