"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

export default function ProjectsPage() {
  const [organisationId, setOrganisationId] = useState("");
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [description, setDescription] = useState("");
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [appAccessEnabled, setAppAccessEnabled] = useState(true);

  const canLoad = cleanText(organisationId).length > 0;

  const filteredProjects = useMemo(() => {
    return projects;
  }, [projects]);

  async function loadProjects() {
    if (!canLoad) {
      setNote("Enter an organisation_id first. Later this will come from the logged-in organisation context.");
      return;
    }

    setLoading(true);
    setNote("");

    try {
      const params = new URLSearchParams();
      params.set("organisation_id", organisationId);

      if (q) params.set("q", q);
      if (status) params.set("status", status);

      const response = await fetch(`/api/projects?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load projects.");
      }

      setProjects(json.data?.rows ?? []);
    } catch (error: any) {
      setNote(error?.message ?? "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }

  async function createProject(event: React.FormEvent) {
    event.preventDefault();

    if (!canLoad) {
      setNote("organisation_id is required to create a project.");
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

      setName("");
      setProjectCode("");
      setDescription("");
      setDefaultLanguage("en");
      setAppAccessEnabled(true);

      await loadProjects();

      setNote("Project created successfully.");
    } catch (error: any) {
      setNote(error?.message ?? "Failed to create project.");
    } finally {
      setLoading(false);
    }
  }

  async function archiveProject(projectId: string) {
    const confirmed = window.confirm("Archive this project? Existing data will remain but the project status will become archived.");

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

      await loadProjects();
      setNote("Project archived.");
    } catch (error: any) {
      setNote(error?.message ?? "Failed to archive project.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canLoad) {
      loadProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, status]);

  return (
    <VerticalAppShell
      organisationRole="organisation_admin"
      projectRole="project_manager"
      organisationName="Current organisation"
      projectName="Projects"
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
              Create and manage multiple projects within one organisation.
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
          <div className="grid gap-3 md:grid-cols-4">
            <label className="block md:col-span-2">
              <span className="text-xs font-black uppercase text-slate-500">
                Organisation ID
              </span>
              <input
                value={organisationId}
                onChange={(event) => setOrganisationId(event.target.value)}
                placeholder="Paste organisation_id"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Status
              </span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Search
              </span>
              <div className="mt-1 flex gap-2">
                <input
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Name/code"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800"
                />
                <button
                  type="button"
                  onClick={loadProjects}
                  className="rounded-xl bg-[#F26A21] px-3 py-2 text-xs font-black text-white"
                >
                  Load
                </button>
              </div>
            </label>
          </div>
        </section>

        <section className="mb-4 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <h2 className="text-base font-black text-slate-950">
            Create project
          </h2>

          <form onSubmit={createProject} className="mt-3 grid gap-3 md:grid-cols-2">
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
                onChange={(event) => setAppAccessEnabled(event.target.checked)}
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

        <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-950">
                Organisation projects
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                {filteredProjects.length} project(s)
              </p>
            </div>

            <button
              type="button"
              onClick={loadProjects}
              disabled={loading}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21] disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                  <th className="px-3 py-2 font-black">Project</th>
                  <th className="px-3 py-2 font-black">Code</th>
                  <th className="px-3 py-2 font-black">Status</th>
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
                      colSpan={7}
                      className="px-3 py-6 text-center text-sm font-bold text-slate-500"
                    >
                      No projects found.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((project) => (
                    <tr
                      key={project.id}
                      className="border-b border-slate-50 hover:bg-[#FFF7F2]"
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
                          <Link
                            href={`/project-settings?project_id=${project.id}`}
                            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21]"
                          >
                            Settings
                          </Link>
                          {project.status !== "archived" ? (
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