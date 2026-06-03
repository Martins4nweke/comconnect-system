"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type TemplateType = "participants" | "messages" | "schedules";

type UploadTemplate = {
  id: string;
  template_type: TemplateType;
  title: string;
  description?: string | null;
  version?: string | null;
  file_name: string;
  public_url: string;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  status?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

const templateTypes: { value: TemplateType; label: string; description: string }[] = [
  {
    value: "participants",
    label: "Participants template",
    description: "Template for participant bulk upload.",
  },
  {
    value: "messages",
    label: "Messages template",
    description: "Template for message library bulk upload.",
  },
  {
    value: "schedules",
    label: "Schedules template",
    description: "Template for scheduler bulk upload.",
  },
];

function formatBytes(value?: number | null) {
  if (!value) return "—";

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function dt(value?: string | null) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

export default function TemplatesPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [templates, setTemplates] = useState<UploadTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [adminKey, setAdminKey] = useState("");
  const [templateType, setTemplateType] = useState<TemplateType>("participants");
  const [title, setTitle] = useState("Participants bulk upload template");
  const [version, setVersion] = useState("1.0");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const groupedTemplates = useMemo(() => {
    return templateTypes.map((type) => ({
      ...type,
      template:
        templates.find((item) => item.template_type === type.value && item.is_active) ??
        null,
    }));
  }, [templates]);

  function updateDefaultTitle(type: TemplateType) {
    if (type === "participants") {
      setTitle("Participants bulk upload template");
    }

    if (type === "messages") {
      setTitle("Messages bulk upload template");
    }

    if (type === "schedules") {
      setTitle("Schedules bulk upload template");
    }
  }

  async function loadTemplates() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/templates", {
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load templates.");
      }

      setTemplates(Array.isArray(json.data) ? json.data : []);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to load templates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  function resetUploadForm() {
    setVersion("1.0");
    setDescription("");
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setNote("");
    setErrorMessage("");

    if (!adminKey.trim()) {
      setErrorMessage("Superadmin upload key is required.");
      return;
    }

    if (!selectedFile) {
      setErrorMessage("Select a CSV, XLS or XLSX template file.");
      return;
    }

    const formData = new FormData();

    formData.append("template_type", templateType);
    formData.append("title", title.trim());
    formData.append("version", version.trim() || "1.0");
    formData.append("description", description.trim());
    formData.append("file", selectedFile);

    setUploading(true);

    try {
      const response = await fetch("/api/templates/upload", {
        method: "POST",
        headers: {
          "x-template-admin-key": adminKey.trim(),
        },
        body: formData,
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Template upload failed.");
      }

      setNote("Template uploaded successfully.");
      resetUploadForm();
      await loadTemplates();
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Template upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function archiveTemplate(template: UploadTemplate) {
    if (!adminKey.trim()) {
      setErrorMessage("Superadmin upload key is required to archive templates.");
      return;
    }

    const confirmed = window.confirm(`Archive ${template.title}?`);

    if (!confirmed) return;

    setNote("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/templates", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-template-admin-key": adminKey.trim(),
        },
        body: JSON.stringify({
          id: template.id,
          action: "archive",
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to archive template.");
      }

      setNote("Template archived.");
      await loadTemplates();
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to archive template.");
    }
  }

  return (
    <main className="min-h-screen bg-[#EEF3FB] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[5px_5px_0_#171717]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-[#FF5C1A]">
                Admin tools
              </p>

              <h1 className="mt-2 text-3xl font-black text-[#171717]">
                Upload Templates
              </h1>

              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                Download standard templates for participants, messages and schedules. Superadmins can upload or replace templates.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/"
                className="rounded-2xl border-2 border-[#171717] bg-white px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717]"
              >
                Dashboard
              </Link>

              <Link
                href="/participants"
                className="rounded-2xl border-2 border-[#171717] bg-white px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717]"
              >
                Participants
              </Link>

              <Link
                href="/messages"
                className="rounded-2xl border-2 border-[#171717] bg-[#FFF7F2] px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717]"
              >
                Messages
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <div className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[4px_4px_0_#171717]">
            <p className="text-sm font-black uppercase tracking-wide text-[#FF5C1A]">
              Superadmin upload
            </p>

            <h2 className="mt-1 text-xl font-black text-[#171717]">
              Upload or replace template
            </h2>

            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
              Uploading requires the superadmin key. This prevents normal users from changing templates.
            </p>

            <form onSubmit={handleUpload} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Superadmin upload key
                </label>
                <input
                  type="password"
                  value={adminKey}
                  onChange={(event) => setAdminKey(event.target.value)}
                  placeholder="Enter superadmin key"
                  className="mt-1.5 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Template type
                </label>
                <select
                  value={templateType}
                  onChange={(event) => {
                    const nextType = event.target.value as TemplateType;
                    setTemplateType(nextType);
                    updateDefaultTitle(nextType);
                  }}
                  className="mt-1.5 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                >
                  {templateTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-1.5 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Version
                </label>
                <input
                  value={version}
                  onChange={(event) => setVersion(event.target.value)}
                  placeholder="1.0"
                  className="mt-1.5 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(event) =>
                    setSelectedFile(event.target.files?.[0] ?? null)
                  }
                  className="mt-1.5 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-[#171717] file:px-3 file:py-2 file:text-xs file:font-black file:text-white focus:border-[#FF5C1A]"
                />

                {selectedFile ? (
                  <p className="mt-2 text-xs font-bold text-slate-500">
                    Selected: {selectedFile.name} ·{" "}
                    {formatBytes(selectedFile.size)}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Short note about this template."
                  className="mt-1.5 min-h-24 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                />
              </div>

              {errorMessage ? (
                <p className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
                  {errorMessage}
                </p>
              ) : null}

              {note ? (
                <p className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
                  {note}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={uploading}
                className="w-full rounded-2xl border-2 border-[#171717] bg-[#FF5C1A] px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717] disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload template"}
              </button>
            </form>
          </div>

          <div className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[4px_4px_0_#171717]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[#FF5C1A]">
                  Available templates
                </p>

                <h2 className="mt-1 text-xl font-black text-[#171717]">
                  Download templates
                </h2>
              </div>

              <button
                type="button"
                onClick={loadTemplates}
                disabled={loading}
                className="rounded-2xl border-2 border-[#171717] bg-white px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717] disabled:opacity-60"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="grid gap-3">
              {groupedTemplates.map((item) => (
                <article
                  key={item.value}
                  className="rounded-[1.5rem] border-2 border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                      <p className="text-sm font-black text-[#171717]">
                        {item.label}
                      </p>

                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {item.description}
                      </p>

                      {item.template ? (
                        <div className="mt-2 text-xs font-bold text-slate-600">
                          <p>Version: {item.template.version ?? "1.0"}</p>
                          <p>File: {item.template.file_name}</p>
                          <p>Size: {formatBytes(item.template.file_size_bytes)}</p>
                          <p>Uploaded: {dt(item.template.created_at)}</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs font-bold text-orange-700">
                          No active template uploaded yet.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.template ? (
                        <>
                          <a
                            href={item.template.public_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-xl border-2 border-[#171717] bg-[#FFF7F2] px-3 py-2 text-xs font-black text-[#171717]"
                          >
                            Download
                          </a>

                          <button
                            type="button"
                            onClick={() => archiveTemplate(item.template!)}
                            className="rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700"
                          >
                            Archive
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}