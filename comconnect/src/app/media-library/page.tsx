"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  CompactCard,
  FieldLabel,
  LinkButton,
  Notice,
  PageHeader,
  PageShell,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  StatusPill,
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

type MediaAsset = {
  id: string;
  organisation_id?: string | null;
  project_id?: string | null;
  title: string;
  media_type: string;
  language_code?: string | null;
  category?: string | null;
  description?: string | null;
  file_name?: string | null;
  file_path?: string | null;
  public_url?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  duration_seconds?: number | null;
  is_approved?: boolean | null;
  status?: string | null;
  created_at?: string | null;
};

const mediaTypes = [
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
  { value: "image", label: "Image" },
  { value: "document", label: "Document" },
];

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

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

function mediaTypeLabel(value?: string | null) {
  if (!value) return "Other";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function acceptedFileTypes(mediaType: string) {
  if (mediaType === "audio") {
    return "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/m4a,audio/aac";
  }

  if (mediaType === "video") {
    return "video/mp4,video/webm,video/quicktime";
  }

  if (mediaType === "image") {
    return "image/png,image/jpeg,image/jpg,image/webp";
  }

  if (mediaType === "document") {
    return "application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }

  return "*/*";
}

function useInMessageLink(asset: MediaAsset) {
  if (!asset.public_url) return "/messages";

  const params = new URLSearchParams({
    mediaUrl: asset.public_url,
    mediaType: asset.media_type || "other",
    mediaTitle: asset.title || "Media asset",
  });

  return `/messages?${params.toString()}`;
}

function canManageMedia(context: CurrentContext | null) {
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

export default function MediaLibraryPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [context, setContext] = useState<CurrentContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [title, setTitle] = useState("");
  const [mediaType, setMediaType] = useState("audio");
  const [languageCode, setLanguageCode] = useState("en");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [isApproved, setIsApproved] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const activeProjectId = cleanText(context?.active_project_id);
  const canManage = canManageMedia(context);

  const filteredAssets = useMemo(() => {
    const text = search.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesType = typeFilter ? asset.media_type === typeFilter : true;

      if (!text) return matchesType;

      const haystack = [
        asset.title,
        asset.media_type,
        asset.language_code,
        asset.category,
        asset.description,
        asset.file_name,
        asset.public_url,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesType && haystack.includes(text);
    });
  }, [assets, search, typeFilter]);

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

  async function loadAssets(nextProjectId = activeProjectId) {
    setLoading(true);
    setErrorMessage("");

    try {
      const params = new URLSearchParams();
      params.set("limit", "100");

      if (nextProjectId) {
        params.set("project_id", nextProjectId);
      }

      const response = await fetch(`/api/media-library?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load media library.");
      }

      setAssets(Array.isArray(json.data) ? json.data : []);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to load media library.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadContext();
  }, []);

  useEffect(() => {
    if (activeProjectId) {
      void loadAssets(activeProjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  function resetUploadForm() {
    setTitle("");
    setLanguageCode("en");
    setCategory("");
    setDescription("");
    setIsApproved(true);
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setNote("");
    setErrorMessage("");

    if (!canManage) {
      setErrorMessage("You do not have permission to upload media.");
      return;
    }

    if (!activeProjectId) {
      setErrorMessage("No active project selected.");
      return;
    }

    if (!title.trim()) {
      setErrorMessage("Media title is required.");
      return;
    }

    if (!selectedFile) {
      setErrorMessage("Select a media file first.");
      return;
    }

    const formData = new FormData();

    formData.append("project_id", activeProjectId);
    formData.append("title", title.trim());
    formData.append("media_type", mediaType);
    formData.append("language_code", languageCode.trim() || "en");
    formData.append("category", category.trim());
    formData.append("description", description.trim());
    formData.append("is_approved", String(isApproved));
    formData.append("file", selectedFile);

    setUploading(true);

    try {
      const response = await fetch("/api/media-library/upload", {
        method: "POST",
        body: formData,
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Media upload failed.");
      }

      setNote("Media uploaded and URL generated successfully.");
      resetUploadForm();
      await loadAssets(activeProjectId);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Media upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function copyUrl(asset: MediaAsset) {
    setNote("");
    setErrorMessage("");

    if (!asset.public_url) {
      setErrorMessage("This media item does not have a URL.");
      return;
    }

    try {
      await navigator.clipboard.writeText(asset.public_url);
      setCopiedId(asset.id);
      setNote(`Copied URL for ${asset.title}.`);

      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setErrorMessage("Could not copy URL. Please copy it manually.");
    }
  }

  async function updateAsset(asset: MediaAsset, action: "archive" | "approve") {
    setNote("");
    setErrorMessage("");

    if (!canManage) {
      setErrorMessage("You do not have permission to update media.");
      return;
    }

    setBusyId(asset.id);

    try {
      const response = await fetch("/api/media-library", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: asset.id,
          action,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to update media item.");
      }

      setNote(
        action === "archive"
          ? "Media item archived."
          : "Media item approved."
      );

      await loadAssets(activeProjectId);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to update media item.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Core Communication"
        title="Media Library"
        subtitle="Upload media, generate URLs, preview files and reuse them in messages."
        actions={
          <>
            <LinkButton href="/messages">Message Library</LinkButton>
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
          <p className="text-xs font-black uppercase text-slate-500">
            Generated URLs
          </p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {assets.length}
          </p>
        </CompactCard>
      </div>

      <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <CompactCard title="Upload and generate URL">
          <form onSubmit={handleUpload} className="space-y-3">
            <FieldLabel label="Media title">
              <TextInput
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Week 2 salt reduction video"
                required
              />
            </FieldLabel>

            <div className="grid grid-cols-2 gap-3">
              <FieldLabel label="Media type">
                <SelectInput
                  value={mediaType}
                  onChange={(event) => {
                    setMediaType(event.target.value);
                    setSelectedFile(null);

                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                >
                  {mediaTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </SelectInput>
              </FieldLabel>

              <FieldLabel label="Language">
                <TextInput
                  value={languageCode}
                  onChange={(event) => setLanguageCode(event.target.value)}
                  placeholder="en / zu / ig"
                />
              </FieldLabel>
            </div>

            <FieldLabel label="Category">
              <TextInput
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="hypertension, medication, salt"
              />
            </FieldLabel>

            <FieldLabel label="File">
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedFileTypes(mediaType)}
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] ?? null)
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-black file:text-white focus:border-[#F26A21]"
                required
              />

              {selectedFile ? (
                <p className="mt-2 text-xs font-bold text-slate-500">
                  Selected: {selectedFile.name} ·{" "}
                  {formatBytes(selectedFile.size)}
                </p>
              ) : null}
            </FieldLabel>

            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short note about where this media should be used."
              className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#F26A21]"
            />

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
              <input
                type="checkbox"
                checked={isApproved}
                onChange={(event) => setIsApproved(event.target.checked)}
              />
              Approved for use in messages
            </label>

            <PrimaryButton
              type="submit"
              disabled={uploading || !canManage || !activeProjectId}
            >
              {uploading ? "Uploading..." : "Upload and generate URL"}
            </PrimaryButton>

            {!canManage ? (
              <p className="text-xs font-bold text-slate-500">
                Your role can view media but cannot upload or approve assets.
              </p>
            ) : null}
          </form>
        </CompactCard>

        <CompactCard
          title="Generated URLs"
          action={
            <div className="flex flex-wrap gap-2">
              <TextInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                className="w-48"
              />

              <SelectInput
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="w-auto"
              >
                <option value="">All media types</option>
                {mediaTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </SelectInput>

              <SecondaryButton onClick={() => loadAssets(activeProjectId)}>
                {loading ? "Refreshing..." : "Refresh"}
              </SecondaryButton>
            </div>
          }
        >
          {loading ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
              Loading media...
            </p>
          ) : filteredAssets.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
              No generated media URLs found.
            </p>
          ) : (
            <div className="max-h-[760px] space-y-3 overflow-auto pr-1">
              {filteredAssets.map((asset) => (
                <article
                  key={asset.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill>{mediaTypeLabel(asset.media_type)}</StatusPill>

                        <StatusPill
                          tone={asset.is_approved ? "success" : "warning"}
                        >
                          {asset.is_approved ? "Approved" : "Pending"}
                        </StatusPill>

                        {asset.language_code ? (
                          <StatusPill>{asset.language_code}</StatusPill>
                        ) : null}
                      </div>

                      <h3 className="mt-2 text-sm font-black text-slate-950">
                        {asset.title}
                      </h3>

                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {asset.file_name ?? "No file name"} ·{" "}
                        {formatBytes(asset.file_size_bytes)} ·{" "}
                        {dt(asset.created_at)}
                      </p>

                      {asset.description ? (
                        <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-600">
                          {asset.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <SecondaryButton onClick={() => copyUrl(asset)}>
                        {copiedId === asset.id ? "Copied" : "Copy URL"}
                      </SecondaryButton>

                      <Link
                        href={useInMessageLink(asset)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21]"
                      >
                        Use in message
                      </Link>

                      {!asset.is_approved && canManage ? (
                        <SecondaryButton
                          onClick={() => updateAsset(asset, "approve")}
                          disabled={busyId === asset.id}
                        >
                          Approve
                        </SecondaryButton>
                      ) : null}

                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => updateAsset(asset, "archive")}
                          disabled={busyId === asset.id}
                          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-black text-red-700 disabled:opacity-50"
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {asset.public_url ? (
                    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2">
                      {asset.media_type === "video" ? (
                        <video
                          src={asset.public_url}
                          controls
                          className="max-h-72 w-full rounded-xl bg-black"
                        />
                      ) : asset.media_type === "audio" ? (
                        <audio
                          src={asset.public_url}
                          controls
                          className="w-full"
                        />
                      ) : asset.media_type === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.public_url}
                          alt={asset.title}
                          className="max-h-72 w-full rounded-xl object-contain"
                        />
                      ) : (
                        <a
                          href={asset.public_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-xl bg-slate-50 px-3 py-3 text-sm font-black text-[#F26A21]"
                        >
                          Open document
                        </a>
                      )}

                      <div className="mt-2 rounded-xl bg-slate-50 p-2">
                        <p className="break-all text-[11px] font-semibold leading-5 text-slate-600">
                          {asset.public_url}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </CompactCard>
      </section>
    </PageShell>
  );
}