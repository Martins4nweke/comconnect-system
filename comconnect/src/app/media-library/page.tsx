"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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

export default function MediaLibraryPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  async function loadAssets() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/media-library?limit=100", {
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
    loadAssets();
  }, []);

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

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setNote("");
    setErrorMessage("");

    if (!title.trim()) {
      setErrorMessage("Media title is required.");
      return;
    }

    if (!selectedFile) {
      setErrorMessage("Select a media file first.");
      return;
    }

    const formData = new FormData();

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
      await loadAssets();
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

      await loadAssets();
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to update media item.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#EEF3FB] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[5px_5px_0_#171717]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-[#FF5C1A]">
                Core Communication
              </p>

              <h1 className="mt-2 text-3xl font-black text-[#171717]">
                Media Library
              </h1>

              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                Upload audio, video, image and document assets, generate public
                URLs, preview files, and reuse them in participant messages.
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
                href="/messages"
                className="rounded-2xl border-2 border-[#171717] bg-[#FFF7F2] px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717]"
              >
                Message Library
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <div className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[4px_4px_0_#171717]">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-[#FF5C1A]">
                Upload
              </p>

              <h2 className="mt-1 text-xl font-black text-[#171717]">
                Upload and generate URL
              </h2>

              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                Upload a final audio, video, image or document file. ComConnect
                will generate a reusable URL.
              </p>
            </div>

            <form onSubmit={handleUpload} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Media title
                </label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Week 2 salt reduction video"
                  className="mt-1.5 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Media type
                  </label>
                  <select
                    value={mediaType}
                    onChange={(event) => {
                      setMediaType(event.target.value);
                      setSelectedFile(null);

                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    className="mt-1.5 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                  >
                    {mediaTypes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Language
                  </label>
                  <input
                    value={languageCode}
                    onChange={(event) => setLanguageCode(event.target.value)}
                    placeholder="en / zu / ig"
                    className="mt-1.5 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Category
                </label>
                <input
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="e.g. hypertension, medication, salt"
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
                  accept={acceptedFileTypes(mediaType)}
                  onChange={(event) =>
                    setSelectedFile(event.target.files?.[0] ?? null)
                  }
                  className="mt-1.5 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-[#171717] file:px-3 file:py-2 file:text-xs file:font-black file:text-white focus:border-[#FF5C1A]"
                  required
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
                  placeholder="Short note about where this media should be used."
                  className="mt-1.5 min-h-24 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                />
              </div>

              <label className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
                <input
                  type="checkbox"
                  checked={isApproved}
                  onChange={(event) => setIsApproved(event.target.checked)}
                />
                Approved for use in messages
              </label>

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
                {uploading ? "Uploading..." : "Upload and generate URL"}
              </button>
            </form>
          </div>

          <div className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[4px_4px_0_#171717]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[#FF5C1A]">
                  Stored media
                </p>

                <h2 className="mt-1 text-xl font-black text-[#171717]">
                  Generated URLs
                </h2>

                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Preview, copy, approve, archive or reuse media in messages.
                </p>
              </div>

              <button
                type="button"
                onClick={loadAssets}
                disabled={loading}
                className="rounded-2xl border-2 border-[#171717] bg-white px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717] disabled:opacity-60"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, category, language or file name"
                className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              />

              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              >
                <option value="">All media types</option>
                {mediaTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
                Loading media...
              </p>
            ) : filteredAssets.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
                No media found. Upload your first audio or video file.
              </p>
            ) : (
              <div className="max-h-[760px] space-y-3 overflow-auto pr-1">
                {filteredAssets.map((asset) => (
                  <article
                    key={asset.id}
                    className="rounded-[1.5rem] border-2 border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-700">
                            {mediaTypeLabel(asset.media_type)}
                          </span>

                          <span
                            className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${
                              asset.is_approved
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-orange-200 bg-orange-50 text-orange-700"
                            }`}
                          >
                            {asset.is_approved ? "Approved" : "Pending"}
                          </span>

                          {asset.language_code ? (
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-700">
                              {asset.language_code}
                            </span>
                          ) : null}
                        </div>

                        <h3 className="mt-2 text-sm font-black text-[#171717]">
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
                        <button
                          type="button"
                          onClick={() => copyUrl(asset)}
                          className="rounded-xl border-2 border-[#171717] bg-white px-3 py-2 text-xs font-black text-[#171717]"
                        >
                          {copiedId === asset.id ? "Copied" : "Copy URL"}
                        </button>

                        <Link
                          href={useInMessageLink(asset)}
                          className="rounded-xl border-2 border-[#171717] bg-[#FFF7F2] px-3 py-2 text-xs font-black text-[#171717]"
                        >
                          Use in message
                        </Link>

                        {!asset.is_approved ? (
                          <button
                            type="button"
                            onClick={() => updateAsset(asset, "approve")}
                            disabled={busyId === asset.id}
                            className="rounded-xl border-2 border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 disabled:opacity-60"
                          >
                            Approve
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => updateAsset(asset, "archive")}
                          disabled={busyId === asset.id}
                          className="rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-60"
                        >
                          Archive
                        </button>
                      </div>
                    </div>

                    {asset.public_url ? (
                      <div className="mt-3 overflow-hidden rounded-2xl border-2 border-slate-200 bg-white p-2">
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
                            className="block rounded-xl bg-slate-50 px-3 py-3 text-sm font-black text-[#FF5C1A]"
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
          </div>
        </section>
      </div>
    </main>
  );
}