"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CompactCard,
  FieldLabel,
  Notice,
  PageShell,
  SelectInput,
  StatusPill,
  TextInput,
} from "@/components/comconnect-ui/DashboardUI";

type EducationStatus = "draft" | "ready" | "published" | "archived";
type ContentType = "text" | "video" | "audio" | "image" | "document" | "mixed";
type AssignmentMode = "one" | "selected" | "all";

type CurrentContext = {
  organisation_id?: string | null;
  organisation_name?: string | null;
  organisation_role?: string | null;
  active_project_id?: string | null;
  active_project_name?: string | null;
  active_project_code?: string | null;
  project_role?: string | null;
};

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

const pageLinkClass =
  "rounded-2xl border border-[#C9D8E4] bg-white px-4 py-2 text-sm font-black text-[#06324A] shadow-sm hover:border-[#0A5278] hover:text-[#0A5278]";

const primaryButtonClass =
  "rounded-2xl bg-[#0A5278] px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-[#06324A] disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClass =
  "rounded-xl border border-[#C9D8E4] bg-white px-4 py-2 text-xs font-black text-[#06324A] hover:border-[#0A5278] hover:text-[#0A5278] disabled:cursor-not-allowed disabled:opacity-50";

const textareaClass =
  "w-full rounded-xl border border-[#C9D8E4] bg-white px-3 py-2 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]";

function dt(value?: string | null) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function statusTone(
  status?: string | null
): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "published") return "success";
  if (status === "ready") return "info";
  if (status === "archived") return "danger";
  return "warning";
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

function participantLabel(participant: ParticipantOption) {
  const fullName = `${participant.first_name ?? ""} ${
    participant.last_name ?? ""
  }`.trim();

  return (
    participant.metadata?.display_name ??
    fullName ??
    participant.participant_code
  );
}

export default function EducationLibraryPage() {
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

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
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<
    string[]
  >([]);
  const [dueAt, setDueAt] = useState("");

  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const activeProjectId = String(context?.active_project_id ?? "").trim();

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

  async function loadEducationItems(nextProjectId = activeProjectId) {
    setNote("");
    setErrorMessage("");

    if (!nextProjectId) {
      setErrorMessage("No active project selected.");
      return;
    }

    setLoadingItems(true);

    try {
      const params = new URLSearchParams();
      params.set("project_id", nextProjectId);

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

  async function loadParticipants(nextProjectId = activeProjectId) {
    setErrorMessage("");

    if (!nextProjectId) return;

    setLoadingParticipants(true);

    try {
      const params = new URLSearchParams();
      params.set("project_id", nextProjectId);

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

  useEffect(() => {
    void loadContext();
  }, []);

  useEffect(() => {
    if (activeProjectId) {
      void loadEducationItems(activeProjectId);
      void loadParticipants(activeProjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

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

  async function createEducationItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setNote("");
    setErrorMessage("");

    if (!activeProjectId) {
      setErrorMessage("No active project selected.");
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
          project_id: activeProjectId,
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

      setNote("Education content created.");
      resetCreateForm();
      await loadEducationItems(activeProjectId);
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

  async function createVersion(event: FormEvent<HTMLFormElement>) {
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
          ? "Version published."
          : "Version saved."
      );

      resetVersionForm();
      await loadEducationItems(activeProjectId);
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
        `Assign to all ${participantIds.length} loaded active participant(s)?`
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
            },
          }),
        }
      );

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to assign education content.");
      }

      setNote(`Assigned to ${json.data?.assigned_count ?? 0} participant(s).`);
      setDueAt("");
      setSelectedParticipantIds([]);
      await loadEducationItems(activeProjectId);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to assign education content.");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <PageShell>
      <section className="mb-5 rounded-[2rem] border border-[#C9D8E4] bg-[#032A3D] p-6 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#C9D8E4]">
          Research
        </p>

        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              Education Library
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#EAF2F8]">
              Create, publish and assign education content to participants.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className={pageLinkClass}>
  Dashboard
</Link>
            <Link href="/media-library" className={pageLinkClass}>
              Media Library
            </Link>
            <Link href="/participants" className={pageLinkClass}>
              Participants
            </Link>
          </div>
        </div>
      </section>

      {errorMessage ? <Notice tone="danger">{errorMessage}</Notice> : null}
      {note ? <Notice tone="success">{note}</Notice> : null}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <CompactCard>
          <p className="text-xs font-black uppercase text-[#536271]">
            Organisation
          </p>
          <p className="mt-1 text-sm font-black text-[#06324A]">
            {loadingContext ? "Loading..." : context?.organisation_name ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-[#536271]">
            Project
          </p>
          <p className="mt-1 text-sm font-black text-[#06324A]">
            {loadingContext ? "Loading..." : context?.active_project_name ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-[#536271]">
            Loaded
          </p>
          <p className="mt-1 text-sm font-black text-[#06324A]">
            {items.length}
          </p>
        </CompactCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <CompactCard title="Create education">
          <form onSubmit={createEducationItem} className="space-y-3">
            <FieldLabel label="Title">
              <TextInput
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Why blood pressure matters"
              />
            </FieldLabel>

            <div className="grid grid-cols-2 gap-3">
              <FieldLabel label="Category">
                <TextInput
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Hypertension"
                />
              </FieldLabel>

              <FieldLabel label="Language">
                <TextInput
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  placeholder="en / zu"
                />
              </FieldLabel>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FieldLabel label="Type">
                <SelectInput
                  value={contentType}
                  onChange={(event) =>
                    setContentType(event.target.value as ContentType)
                  }
                >
                  {contentTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </SelectInput>
              </FieldLabel>

              <FieldLabel label="Status">
                <SelectInput
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as EducationStatus)
                  }
                >
                  {statuses.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </SelectInput>
              </FieldLabel>
            </div>

            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short description"
              className={`${textareaClass} min-h-20`}
            />

            <textarea
              value={textContent}
              onChange={(event) => setTextContent(event.target.value)}
              placeholder="Education text content"
              className={`${textareaClass} min-h-32`}
            />

            <FieldLabel label="Media URL">
              <TextInput
                value={mediaUrl}
                onChange={(event) => setMediaUrl(event.target.value)}
                placeholder="Optional"
              />
            </FieldLabel>

            <FieldLabel label="Thumbnail URL">
              <TextInput
                value={thumbnailUrl}
                onChange={(event) => setThumbnailUrl(event.target.value)}
                placeholder="Optional"
              />
            </FieldLabel>

            <button
              type="submit"
              disabled={creating || !activeProjectId}
              className={primaryButtonClass}
            >
              {creating ? "Creating..." : "Create education"}
            </button>
          </form>
        </CompactCard>

        <CompactCard
          title="Library"
          action={
            <div className="flex flex-wrap gap-2">
              <TextInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                className="w-48"
              />

              <SelectInput
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-auto"
              >
                <option value="">All statuses</option>
                {statuses.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </SelectInput>

              <button
                type="button"
                onClick={() => loadEducationItems(activeProjectId)}
                className={secondaryButtonClass}
              >
                {loadingItems ? "Loading..." : "Refresh"}
              </button>
            </div>
          }
        >
          <div className="max-h-[640px] space-y-3 overflow-auto pr-1">
            {loadingItems ? (
              <p className="rounded-2xl bg-[#EAF2F8] p-4 text-sm font-bold text-[#536271]">
                Loading...
              </p>
            ) : filteredItems.length === 0 ? (
              <p className="rounded-2xl bg-[#EAF2F8] p-4 text-sm font-bold text-[#536271]">
                No education content.
              </p>
            ) : (
              filteredItems.map((item) => {
                const version = latestVersion(item);

                return (
                  <article
                    key={item.id}
                    className={`rounded-2xl border p-4 shadow-sm ${
                      selectedItem?.id === item.id
                        ? "border-[#0A5278] bg-[#EAF2F8]"
                        : "border-[#C9D8E4] bg-white"
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <StatusPill tone={statusTone(item.status)}>
                            {item.status ?? "draft"}
                          </StatusPill>

                          <StatusPill>
                            {item.settings?.content_type ?? "text"}
                          </StatusPill>

                          <StatusPill>{item.language ?? "en"}</StatusPill>
                        </div>

                        <h3 className="mt-2 text-sm font-black text-[#06324A]">
                          {item.title}
                        </h3>

                        <p className="mt-1 text-xs font-bold text-[#536271]">
                          {item.category ?? "Uncategorised"} ·{" "}
                          {dt(item.created_at)}
                        </p>

                        {item.description ? (
                          <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-[#536271]">
                            {item.description}
                          </p>
                        ) : null}

                        <p className="mt-2 text-xs font-bold text-[#536271]">
                          Version:{" "}
                          {version
                            ? `${version.version_label ?? "—"} · ${
                                version.status ?? "draft"
                              }`
                            : "None"}
                        </p>
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
                          className={secondaryButtonClass}
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
                          className={primaryButtonClass}
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
        </CompactCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <CompactCard
          title="Version"
          subtitle={selectedItem?.title ?? "No item selected"}
        >
          <form onSubmit={createVersion} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
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
                  onChange={(event) =>
                    setVersionStatus(event.target.value as EducationStatus)
                  }
                >
                  {statuses.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </SelectInput>
              </FieldLabel>
            </div>

            <textarea
              value={versionTextContent}
              onChange={(event) => setVersionTextContent(event.target.value)}
              placeholder="Version text content"
              className={`${textareaClass} min-h-28`}
            />

            <FieldLabel label="Video low-data URL">
              <TextInput
                value={videoLowUrl}
                onChange={(event) => setVideoLowUrl(event.target.value)}
                placeholder="Optional"
              />
            </FieldLabel>

            <FieldLabel label="Video HD URL">
              <TextInput
                value={videoHdUrl}
                onChange={(event) => setVideoHdUrl(event.target.value)}
                placeholder="Optional"
              />
            </FieldLabel>

            <FieldLabel label="Audio URL">
              <TextInput
                value={audioUrl}
                onChange={(event) => setAudioUrl(event.target.value)}
                placeholder="Optional"
              />
            </FieldLabel>

            <FieldLabel label="Thumbnail URL">
              <TextInput
                value={versionThumbnailUrl}
                onChange={(event) =>
                  setVersionThumbnailUrl(event.target.value)
                }
                placeholder="Optional"
              />
            </FieldLabel>

            <textarea
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Transcript optional"
              className={`${textareaClass} min-h-24`}
            />

            <FieldLabel label="Estimated MB">
              <TextInput
                value={estimatedDataMb}
                onChange={(event) => setEstimatedDataMb(event.target.value)}
                placeholder="Optional"
              />
            </FieldLabel>

            <button
              type="submit"
              disabled={creatingVersion || !selectedItem}
              className={primaryButtonClass}
            >
              {creatingVersion ? "Saving..." : "Save version"}
            </button>
          </form>
        </CompactCard>

        <CompactCard
          title="Assign education"
          subtitle={selectedItem?.title ?? "No item selected"}
        >
          <div id="assign-education-panel" className="space-y-3">
            <FieldLabel label="Due date/time">
              <TextInput
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </FieldLabel>

            <div className="rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] p-3">
              <p className="text-xs font-black uppercase text-[#536271]">
                Participants
              </p>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <label className="flex items-center gap-2 rounded-xl border border-[#C9D8E4] bg-white px-3 py-2 text-sm font-black text-[#06324A]">
                  <input
                    type="radio"
                    checked={assignmentMode === "one"}
                    onChange={() => setAssignmentMode("one")}
                  />
                  One
                </label>

                <label className="flex items-center gap-2 rounded-xl border border-[#C9D8E4] bg-white px-3 py-2 text-sm font-black text-[#06324A]">
                  <input
                    type="radio"
                    checked={assignmentMode === "selected"}
                    onChange={() => setAssignmentMode("selected")}
                  />
                  Selected
                </label>

                <label className="flex items-center gap-2 rounded-xl border border-[#C9D8E4] bg-white px-3 py-2 text-sm font-black text-[#06324A]">
                  <input
                    type="radio"
                    checked={assignmentMode === "all"}
                    onChange={() => setAssignmentMode("all")}
                  />
                  All
                </label>
              </div>

              {assignmentMode === "one" ? (
                <div className="mt-3">
                  <FieldLabel label="Participant">
                    <SelectInput
                      value={selectedParticipantId}
                      onChange={(event) =>
                        setSelectedParticipantId(event.target.value)
                      }
                    >
                      <option value="">Select participant</option>
                      {activeParticipants.map((participant) => (
                        <option key={participant.id} value={participant.id}>
                          {participant.participant_code}
                          {participant.phone_number
                            ? ` - ${participant.phone_number}`
                            : ""}
                        </option>
                      ))}
                    </SelectInput>
                  </FieldLabel>
                </div>
              ) : null}

              {assignmentMode === "selected" ? (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <TextInput
                      value={participantSearch}
                      onChange={(event) =>
                        setParticipantSearch(event.target.value)
                      }
                      placeholder="Search participants"
                      className="min-w-[240px] flex-1"
                    />

                    <button
                      type="button"
                      onClick={selectFilteredParticipants}
                      className={secondaryButtonClass}
                    >
                      Select filtered
                    </button>

                    <button
                      type="button"
                      onClick={clearSelectedParticipants}
                      className={secondaryButtonClass}
                    >
                      Clear
                    </button>
                  </div>

                  <p className="text-xs font-bold text-[#536271]">
                    Showing {filteredParticipants.length}. Selected:{" "}
                    {selectedParticipantIds.length}.
                  </p>

                  <div className="max-h-64 overflow-auto rounded-2xl border border-[#C9D8E4] bg-white">
                    {loadingParticipants ? (
                      <p className="p-4 text-sm font-bold text-[#536271]">
                        Loading...
                      </p>
                    ) : filteredParticipants.length === 0 ? (
                      <p className="p-4 text-sm font-bold text-[#536271]">
                        No participants.
                      </p>
                    ) : (
                      <div className="divide-y divide-[#EAF2F8]">
                        {filteredParticipants.map((participant) => (
                          <label
                            key={participant.id}
                            className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-[#06324A] hover:bg-[#EAF2F8]"
                          >
                            <span>
                              <input
                                type="checkbox"
                                className="mr-3"
                                checked={selectedParticipantIds.includes(
                                  participant.id
                                )}
                                onChange={() =>
                                  toggleSelectedParticipant(participant.id)
                                }
                              />
                              {participantLabel(participant)}
                            </span>

                            <span className="text-xs text-[#536271]">
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
                <p className="mt-3 text-xs font-bold text-[#06324A]">
                  All loaded active participants: {activeParticipants.length}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              disabled={assigning || !selectedItem}
              onClick={assignEducation}
              className={primaryButtonClass}
            >
              {assigning ? "Assigning..." : "Assign education"}
            </button>
          </div>
        </CompactCard>
      </div>
    </PageShell>
  );
}