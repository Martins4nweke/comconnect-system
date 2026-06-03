"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type EducationStatus = "draft" | "ready" | "published" | "archived";
type ContentType = "text" | "video" | "audio" | "image" | "document" | "mixed";

type EducationVersion = {
  id: string;
  education_item_id: string;
  version_label?: string | null;
  text_content?: string | null;
  video_low_url?: string | null;
  video_hd_url?: string | null;
  audio_url?: string | null;
  thumbnail_url?: string | null;
  transcript?: string | null;
  estimated_data_mb?: number | null;
  status?: string | null;
  published_at?: string | null;
  created_at?: string | null;
};

type EducationItem = {
  id: string;
  organisation_id?: string | null;
  project_id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  language?: string | null;
  status?: string | null;
  text_content?: string | null;
  settings?: {
    content_type?: ContentType;
    media_url?: string;
    video_url?: string;
    audio_url?: string;
    thumbnail_url?: string;
  } | null;
  metadata?: any;
  current_version_id?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  education_versions?: EducationVersion[];
};

type ParticipantOption = {
  id: string;
  participant_code: string;
  phone_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  preferred_language?: string | null;
  status?: string | null;
  metadata?: {
    display_name?: string | null;
    preferred_channel?: string | null;
    whatsapp_number?: string | null;
  } | null;
};

type AssignmentMode = "one" | "selected" | "all";
const defaultProjectIdStorageKey = "comconnect_education_project_id";

const contentTypes: { value: ContentType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "image", label: "Image" },
  { value: "document", label: "Document" },
  { value: "mixed", label: "Mixed" },
];

const statuses: { value: EducationStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

function dt(value?: string | null) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function parseParticipantCodes(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function statusBadgeClass(status?: string | null) {
  if (status === "published") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "ready") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (status === "archived") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-orange-200 bg-orange-50 text-orange-700";
}

function latestVersion(item: EducationItem) {
  const versions = item.education_versions ?? [];

  if (versions.length === 0) return null;

  return [...versions].sort((a, b) => {
    const dateA = new Date(a.created_at ?? "").getTime();
    const dateB = new Date(b.created_at ?? "").getTime();

    return dateB - dateA;
  })[0];
}

export default function EducationLibraryPage() {
  const [projectId, setProjectId] = useState("");

  const [items, setItems] = useState<EducationItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [creating, setCreating] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [selectedItem, setSelectedItem] = useState<EducationItem | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("en");
  const [contentType, setContentType] = useState<ContentType>("text");
  const [status, setStatus] = useState<EducationStatus>("draft");
  const [description, setDescription] = useState("");
  const [textContent, setTextContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");

  const [versionLabel, setVersionLabel] = useState("v1.0");
  const [versionStatus, setVersionStatus] =
    useState<EducationStatus>("draft");
  const [versionTextContent, setVersionTextContent] = useState("");
  const [videoLowUrl, setVideoLowUrl] = useState("");
  const [videoHdUrl, setVideoHdUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [versionThumbnailUrl, setVersionThumbnailUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [estimatedDataMb, setEstimatedDataMb] = useState("");

  const [participants, setParticipants] = useState<ParticipantOption[]>([]);
const [loadingParticipants, setLoadingParticipants] = useState(false);
const [participantSearch, setParticipantSearch] = useState("");
const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("one");
const [selectedParticipantId, setSelectedParticipantId] = useState("");
const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>(
  []
);
  const [dueAt, setDueAt] = useState("");

  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const filteredItems = useMemo(() => {
    const text = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesStatus = statusFilter ? item.status === statusFilter : true;

      if (!text) return matchesStatus;

      const haystack = [
        item.title,
        item.description,
        item.category,
        item.language,
        item.status,
        item.settings?.content_type,
        item.settings?.media_url,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && haystack.includes(text);
    });
  }, [items, search, statusFilter]);

const activeParticipants = useMemo(() => {
  return participants.filter(
    (participant) => participant.status !== "archived"
  );
}, [participants]);

const filteredParticipants = useMemo(() => {
  const text = participantSearch.trim().toLowerCase();

  if (!text) return activeParticipants.slice(0, 300);

  return activeParticipants
    .filter((participant) => {
      const haystack = [
        participant.participant_code,
        participant.phone_number,
        participant.first_name,
        participant.last_name,
        participant.preferred_language,
        participant.status,
        participant.metadata?.display_name,
        participant.metadata?.preferred_channel,
        participant.metadata?.whatsapp_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(text);
    })
    .slice(0, 300);
}, [activeParticipants, participantSearch]);
  useEffect(() => {
    const savedProjectId = window.localStorage.getItem(
      defaultProjectIdStorageKey
    );

    if (savedProjectId) {
      setProjectId(savedProjectId);
    }
  }, []);

  useEffect(() => {
  if (!projectId.trim()) return;

  loadEducationItems(projectId.trim());
  loadParticipants(projectId.trim());
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [projectId]);

  function saveProjectId(value: string) {
    setProjectId(value);
    window.localStorage.setItem(defaultProjectIdStorageKey, value);
  }

  async function loadEducationItems(nextProjectId = projectId) {
    setNote("");
    setErrorMessage("");

    if (!nextProjectId.trim()) {
      setErrorMessage("Project ID is required before loading education items.");
      return;
    }

    setLoadingItems(true);

    try {
      const params = new URLSearchParams();
      params.set("project_id", nextProjectId.trim());

      const response = await fetch(`/api/education?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load education items.");
      }

      const rows = Array.isArray(json.data) ? json.data : [];
      setItems(rows);

      if (selectedItem) {
        const refreshed = rows.find((item) => item.id === selectedItem.id);
        setSelectedItem(refreshed ?? null);
      }
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to load education items.");
    } finally {
      setLoadingItems(false);
    }
  }

async function loadParticipants(nextProjectId = projectId) {
  setErrorMessage("");

  if (!nextProjectId.trim()) {
    return;
  }

  setLoadingParticipants(true);

  try {
    const params = new URLSearchParams();
    params.set("project_id", nextProjectId.trim());

    const response = await fetch(`/api/participants?${params.toString()}`, {
      cache: "no-store",
    });

    const json = await response.json();

    if (!response.ok || !json?.ok) {
      throw new Error(json?.error ?? "Failed to load participants.");
    }

    const rows = Array.isArray(json.data) ? json.data : [];
    setParticipants(rows);

    if (!selectedParticipantId && rows[0]?.id) {
      setSelectedParticipantId(rows[0].id);
    }
  } catch (error: any) {
    setErrorMessage(error?.message ?? "Failed to load participants.");
  } finally {
    setLoadingParticipants(false);
  }
}
  function resetCreateForm() {
    setTitle("");
    setCategory("");
    setLanguage("en");
    setContentType("text");
    setStatus("draft");
    setDescription("");
    setTextContent("");
    setMediaUrl("");
    setThumbnailUrl("");
  }

  async function createEducationItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setNote("");
    setErrorMessage("");

    if (!projectId.trim()) {
      setErrorMessage("Project ID is required.");
      return;
    }

    if (!title.trim()) {
      setErrorMessage("Education title is required.");
      return;
    }

    setCreating(true);

    try {
      const response = await fetch("/api/education", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: projectId.trim(),
          title: title.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          language: language.trim() || "en",
          status,
          text_content: textContent.trim() || null,
          settings: {
            content_type: contentType,
            media_url: mediaUrl.trim() || null,
            video_url:
              contentType === "video" || contentType === "mixed"
                ? mediaUrl.trim() || null
                : null,
            audio_url:
              contentType === "audio" || contentType === "mixed"
                ? mediaUrl.trim() || null
                : null,
            thumbnail_url: thumbnailUrl.trim() || null,
          },
          metadata: {
            created_from: "education_library_page",
          },
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to create education content.");
      }

      const created = json.data as EducationItem;
      setSelectedItem(created);
      setVersionTextContent(textContent);
      setVideoLowUrl(contentType === "video" ? mediaUrl : "");
      setAudioUrl(contentType === "audio" ? mediaUrl : "");
      setVersionThumbnailUrl(thumbnailUrl);

      setNote("Education content created. You can now add/publish a version.");
      resetCreateForm();
      await loadEducationItems();
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to create education content.");
    } finally {
      setCreating(false);
    }
  }

  function resetVersionForm() {
    setVersionLabel("v1.0");
    setVersionStatus("draft");
    setVersionTextContent("");
    setVideoLowUrl("");
    setVideoHdUrl("");
    setAudioUrl("");
    setVersionThumbnailUrl("");
    setTranscript("");
    setEstimatedDataMb("");
  }

  async function createVersion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setNote("");
    setErrorMessage("");

    if (!selectedItem) {
      setErrorMessage("Select or create an education item first.");
      return;
    }

    setCreatingVersion(true);

    try {
      const response = await fetch(
        `/api/education/${selectedItem.id}/versions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version_label: versionLabel.trim() || "v1.0",
            text_content: versionTextContent.trim() || null,
            video_low_url: videoLowUrl.trim() || null,
            video_hd_url: videoHdUrl.trim() || null,
            audio_url: audioUrl.trim() || null,
            thumbnail_url: versionThumbnailUrl.trim() || null,
            transcript: transcript.trim() || null,
            estimated_data_mb: estimatedDataMb
              ? Number(estimatedDataMb)
              : null,
            status: versionStatus,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to create education version.");
      }

      setNote(
        versionStatus === "published"
          ? "Education version created and published."
          : "Education version created."
      );

      resetVersionForm();
      await loadEducationItems();
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to create education version.");
    } finally {
      setCreatingVersion(false);
    }
  }

function toggleSelectedParticipant(participantId: string) {
  setSelectedParticipantIds((current) =>
    current.includes(participantId)
      ? current.filter((id) => id !== participantId)
      : [...current, participantId]
  );
}

function selectFilteredParticipants() {
  setSelectedParticipantIds(
    filteredParticipants.map((participant) => participant.id)
  );
}

function clearSelectedParticipants() {
  setSelectedParticipantIds([]);
}

function resolveAssignmentParticipantIds() {
  if (assignmentMode === "one") {
    return selectedParticipantId ? [selectedParticipantId] : [];
  }

  if (assignmentMode === "selected") {
    return selectedParticipantIds;
  }

  return activeParticipants.map((participant) => participant.id);
}

  async function assignEducation() {
  setNote("");
  setErrorMessage("");

  if (!selectedItem) {
    setErrorMessage("Select an education item before assignment.");
    return;
  }

  const participantIds = resolveAssignmentParticipantIds();

  if (participantIds.length === 0) {
    setErrorMessage("Select at least one participant.");
    return;
  }

  if (assignmentMode === "all") {
    const confirmed = window.confirm(
      `Assign this education content to all ${participantIds.length} loaded active participant(s)?`
    );

    if (!confirmed) return;
  }

  setAssigning(true);

  try {
    const response = await fetch(
      `/api/education/${selectedItem.id}/assignments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participant_ids: participantIds,
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
          status: "active",
          metadata: {
            assigned_from: "education_library_page",
            assignment_mode: assignmentMode,
            education_title: selectedItem.title,
            communication_engine_note:
              "Education assignment currently triggers participant push notification through the existing education assignment route.",
          },
        }),
      }
    );

    const json = await response.json();

    if (!response.ok || !json?.ok) {
      throw new Error(json?.error ?? "Failed to assign education content.");
    }

    const assignedCount = json.data?.assigned_count ?? 0;
    const pushResults = json.data?.push_results ?? [];
    const sentCount = pushResults.filter(
      (item: any) => item?.result?.sent && item.result.sent > 0
    ).length;

    if (sentCount > 0) {
      setNote(
        `Education assigned to ${assignedCount} participant(s). Push sent to ${sentCount}.`
      );
    } else {
      setNote(
        `Education assigned to ${assignedCount} participant(s). No active push tokens yet.`
      );
    }

    setDueAt("");
    setSelectedParticipantIds([]);
    await loadEducationItems();
  } catch (error: any) {
    setErrorMessage(error?.message ?? "Failed to assign education content.");
  } finally {
    setAssigning(false);
  }
}

  return (
    <main className="min-h-screen bg-[#EEF3FB] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[5px_5px_0_#171717]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-[#FF5C1A]">
                Education Library
              </p>

              <h1 className="mt-2 text-3xl font-black text-[#171717]">
                Create, publish and assign education
              </h1>

              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                Create education content first, add text/audio/video versions,
                then assign the content to participants.
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
                href="/media-library"
                className="rounded-2xl border-2 border-[#171717] bg-[#FFF7F2] px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717]"
              >
                Media Library
              </Link>

              <Link
                href="/participants"
                className="rounded-2xl border-2 border-[#171717] bg-white px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717]"
              >
                Participants
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[4px_4px_0_#171717]">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                Project ID
              </label>
              <input
                value={projectId}
                onChange={(event) => saveProjectId(event.target.value)}
                placeholder="Paste the project UUID here"
                className="mt-1.5 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              />
              <p className="mt-2 text-xs font-bold text-slate-500">
                The current education API requires project_id. This value is
                saved in this browser for convenience.
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadEducationItems()}
              disabled={loadingItems}
              className="rounded-2xl border-2 border-[#171717] bg-[#FF5C1A] px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717] disabled:opacity-60"
            >
              {loadingItems ? "Loading..." : "Load education"}
            </button>
          </div>

          {errorMessage ? (
            <p className="mt-3 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {note ? (
            <p className="mt-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
              {note}
            </p>
          ) : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <section className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[4px_4px_0_#171717]">
            <p className="text-sm font-black uppercase tracking-wide text-[#FF5C1A]">
              Step 1
            </p>

            <h2 className="mt-1 text-xl font-black text-[#171717]">
              Create education content
            </h2>

            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
              Create the main education item before adding versions or assigning
              it to participants.
            </p>

            <form onSubmit={createEducationItem} className="mt-4 space-y-3">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title, e.g. Why blood pressure matters"
                className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Category"
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                />

                <input
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  placeholder="Language, e.g. en / zu"
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select
                  value={contentType}
                  onChange={(event) =>
                    setContentType(event.target.value as ContentType)
                  }
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                >
                  {contentTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as EducationStatus)
                  }
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                >
                  {statuses.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Short description"
                className="min-h-20 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              />

              <textarea
                value={textContent}
                onChange={(event) => setTextContent(event.target.value)}
                placeholder="Education text content"
                className="min-h-32 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              />

              <input
                value={mediaUrl}
                onChange={(event) => setMediaUrl(event.target.value)}
                placeholder="Media URL from Media Library optional"
                className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              />

              <input
                value={thumbnailUrl}
                onChange={(event) => setThumbnailUrl(event.target.value)}
                placeholder="Thumbnail URL optional"
                className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              />

              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-2xl border-2 border-[#171717] bg-[#FF5C1A] px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717] disabled:opacity-60"
              >
                {creating ? "Creating..." : "Create education content"}
              </button>
            </form>
          </section>

          <section className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[4px_4px_0_#171717]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[#FF5C1A]">
                  Step 2
                </p>
                <h2 className="mt-1 text-xl font-black text-[#171717]">
                  Education library
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search education"
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                />

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                >
                  <option value="">All statuses</option>
                  {statuses.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="max-h-[620px] space-y-3 overflow-auto pr-1">
              {loadingItems ? (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
                  Loading education content...
                </p>
              ) : filteredItems.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
                  No education content found.
                </p>
              ) : (
                filteredItems.map((item) => {
                  const version = latestVersion(item);

                  return (
                    <article
                      key={item.id}
                      className={`rounded-[1.5rem] border-2 p-4 ${
                        selectedItem?.id === item.id
                          ? "border-[#171717] bg-[#FFF7F2]"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${statusBadgeClass(
                                item.status
                              )}`}
                            >
                              {item.status ?? "draft"}
                            </span>

                            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-700">
                              {item.settings?.content_type ?? "text"}
                            </span>

                            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-700">
                              {item.language ?? "en"}
                            </span>
                          </div>

                          <h3 className="mt-2 text-sm font-black text-[#171717]">
                            {item.title}
                          </h3>

                          <p className="mt-1 text-xs font-bold text-slate-500">
                            {item.category ?? "Uncategorised"} · Created{" "}
                            {dt(item.created_at)}
                          </p>

                          {item.description ? (
                            <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-600">
                              {item.description}
                            </p>
                          ) : null}

                          {version ? (
                            <p className="mt-2 text-xs font-bold text-slate-600">
                              Latest version: {version.version_label ?? "—"} ·{" "}
                              {version.status ?? "draft"}
                            </p>
                          ) : (
                            <p className="mt-2 text-xs font-bold text-orange-700">
                              No version added yet.
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItem(item);
                              setVersionTextContent(item.text_content ?? "");
                              setVideoLowUrl(item.settings?.video_url ?? "");
                              setAudioUrl(item.settings?.audio_url ?? "");
                              setVersionThumbnailUrl(
                                item.settings?.thumbnail_url ?? ""
                              );
                            }}
                            className="rounded-xl border-2 border-[#171717] bg-white px-3 py-2 text-xs font-black text-[#171717]"
                          >
                            Select
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItem(item);
                              document
                                .getElementById("assign-education-panel")
                                ?.scrollIntoView({ behavior: "smooth" });
                            }}
                            className="rounded-xl border-2 border-[#171717] bg-[#FF5C1A] px-3 py-2 text-xs font-black text-[#171717]"
                          >
                            Assign
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[4px_4px_0_#171717]">
            <p className="text-sm font-black uppercase tracking-wide text-[#FF5C1A]">
              Step 3
            </p>

            <h2 className="mt-1 text-xl font-black text-[#171717]">
              Add or publish version
            </h2>

            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
              Selected item:{" "}
              <span className="font-black text-[#171717]">
                {selectedItem?.title ?? "None selected"}
              </span>
            </p>

            <form onSubmit={createVersion} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={versionLabel}
                  onChange={(event) => setVersionLabel(event.target.value)}
                  placeholder="Version label, e.g. v1.0"
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                />

                <select
                  value={versionStatus}
                  onChange={(event) =>
                    setVersionStatus(event.target.value as EducationStatus)
                  }
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                >
                  {statuses.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                value={versionTextContent}
                onChange={(event) => setVersionTextContent(event.target.value)}
                placeholder="Version text content"
                className="min-h-28 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              />

              <input
                value={videoLowUrl}
                onChange={(event) => setVideoLowUrl(event.target.value)}
                placeholder="Video low data URL optional"
                className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              />

              <input
                value={videoHdUrl}
                onChange={(event) => setVideoHdUrl(event.target.value)}
                placeholder="Video HD URL optional"
                className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              />

              <input
                value={audioUrl}
                onChange={(event) => setAudioUrl(event.target.value)}
                placeholder="Audio URL optional"
                className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              />

              <input
                value={versionThumbnailUrl}
                onChange={(event) =>
                  setVersionThumbnailUrl(event.target.value)
                }
                placeholder="Thumbnail URL optional"
                className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              />

              <textarea
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder="Transcript optional"
                className="min-h-24 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              />

              <input
                value={estimatedDataMb}
                onChange={(event) => setEstimatedDataMb(event.target.value)}
                placeholder="Estimated data size MB optional"
                className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
              />

              <button
                type="submit"
                disabled={creatingVersion || !selectedItem}
                className="w-full rounded-2xl border-2 border-[#171717] bg-[#FF5C1A] px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717] disabled:opacity-60"
              >
                {creatingVersion ? "Saving version..." : "Save version"}
              </button>
            </form>
          </section>

          <section
            id="assign-education-panel"
            className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[4px_4px_0_#171717]"
          >
            <p className="text-sm font-black uppercase tracking-wide text-[#FF5C1A]">
              Step 4
            </p>

            <h2 className="mt-1 text-xl font-black text-[#171717]">
              Assign education
            </h2>

            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
              Selected item:{" "}
              <span className="font-black text-[#171717]">
                {selectedItem?.title ?? "None selected"}
              </span>
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex flex-col gap-1">
                <label className="px-1 text-xs font-black uppercase text-slate-500">
                  Due date/time optional
                </label>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
                />
              </div>

              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-[#EEF3FB] p-4">
  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
    Participant selection
  </p>

  <div className="mt-3 grid gap-3 md:grid-cols-3">
    <label className="flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
      <input
        type="radio"
        checked={assignmentMode === "one"}
        onChange={() => setAssignmentMode("one")}
      />
      One participant
    </label>

    <label className="flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
      <input
        type="radio"
        checked={assignmentMode === "selected"}
        onChange={() => setAssignmentMode("selected")}
      />
      Selected participants
    </label>

    <label className="flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
      <input
        type="radio"
        checked={assignmentMode === "all"}
        onChange={() => setAssignmentMode("all")}
      />
      All loaded participants
    </label>
  </div>

  {assignmentMode === "one" ? (
    <div className="mt-3">
      <label className="px-1 text-xs font-black uppercase text-slate-500">
        Select participant
      </label>

      <select
        value={selectedParticipantId}
        onChange={(event) => setSelectedParticipantId(event.target.value)}
        className="mt-1.5 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
      >
        <option value="">Select participant</option>
        {activeParticipants.map((participant) => (
          <option key={participant.id} value={participant.id}>
            {participant.participant_code}
            {participant.phone_number ? ` - ${participant.phone_number}` : ""}
          </option>
        ))}
      </select>
    </div>
  ) : null}

  {assignmentMode === "selected" ? (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={participantSearch}
          onChange={(event) => setParticipantSearch(event.target.value)}
          placeholder="Search by code, phone, name, language or channel"
          className="min-w-[240px] flex-1 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5C1A]"
        />

        <button
          type="button"
          onClick={selectFilteredParticipants}
          className="rounded-2xl border-2 border-[#171717] bg-white px-4 py-3 text-sm font-black text-[#171717]"
        >
          Select filtered
        </button>

        <button
          type="button"
          onClick={clearSelectedParticipants}
          className="rounded-2xl border-2 border-[#171717] bg-[#FFF7F2] px-4 py-3 text-sm font-black text-[#171717]"
        >
          Clear
        </button>
      </div>

      <p className="text-xs font-bold text-slate-500">
        Showing {filteredParticipants.length} participant(s). Selected:{" "}
        {selectedParticipantIds.length}.
      </p>

      <div className="max-h-64 overflow-auto rounded-2xl border-2 border-slate-200 bg-white">
        {loadingParticipants ? (
          <p className="p-4 text-sm font-bold text-slate-500">
            Loading participants...
          </p>
        ) : filteredParticipants.length === 0 ? (
          <p className="p-4 text-sm font-bold text-slate-500">
            No participants found.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredParticipants.map((participant) => (
              <label
                key={participant.id}
                className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <span>
                  <input
                    type="checkbox"
                    className="mr-3"
                    checked={selectedParticipantIds.includes(participant.id)}
                    onChange={() => toggleSelectedParticipant(participant.id)}
                  />
                  {participant.participant_code}
                </span>

                <span className="text-xs text-slate-500">
                  {participant.phone_number ?? "—"} ·{" "}
                  {participant.metadata?.preferred_channel ?? "app"}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : null}

  {assignmentMode === "all" ? (
    <p className="mt-3 rounded-2xl border-2 border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800">
      This will assign the selected education content to all{" "}
      {activeParticipants.length} loaded active participant(s) for this project.
    </p>
  ) : null}
</div>

              <button
                type="button"
                onClick={assignEducation}
                disabled={assigning || !selectedItem}
                className="w-full rounded-2xl border-2 border-[#171717] bg-[#FF5C1A] px-4 py-3 text-sm font-black text-[#171717] shadow-[3px_3px_0_#171717] disabled:opacity-60"
              >
                {assigning ? "Assigning..." : "Assign selected education"}
              </button>

              <p className="text-xs font-bold leading-5 text-slate-500">
                This uses the existing education assignment API. It creates
                education assignments and sends participant push notifications
                where push tokens are available.
              </p>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}