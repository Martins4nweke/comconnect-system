import { useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { AppButton } from "../components/AppButton";
import { StatusNotice } from "../components/StatusNotice";
import { useAppContext } from "../context/AppContext";
import { submitEducationProgress } from "../api/participantAppApi";
import { enqueueOfflineAction } from "../storage/offlineQueue";
import { saveSyncCache } from "../storage/localStore";
import { theme } from "../theme";

type StatusType = "success" | "offline" | "error" | "info";

function pickEducationItems(app: any) {
  const cache = app.cache as any;

  const fromContext = Array.isArray(app.educationAssignments)
    ? app.educationAssignments
    : [];

  const fromCacheEducationItems = Array.isArray(cache?.education_items)
    ? cache.education_items
    : [];

  const fromCacheResearchCare = Array.isArray(
    cache?.research_care?.education_assignments
  )
    ? cache.research_care.education_assignments
    : [];

  const fromDataEducationItems = Array.isArray(cache?.data?.education_items)
    ? cache.data.education_items
    : [];

  const fromDataResearchCare = Array.isArray(
    cache?.data?.research_care?.education_assignments
  )
    ? cache.data.research_care.education_assignments
    : [];

  if (fromContext.length > 0) return fromContext;
  if (fromCacheEducationItems.length > 0) return fromCacheEducationItems;
  if (fromCacheResearchCare.length > 0) return fromCacheResearchCare;
  if (fromDataEducationItems.length > 0) return fromDataEducationItems;
  if (fromDataResearchCare.length > 0) return fromDataResearchCare;

  return [];
}

function getEducation(item: any) {
  return item.education_items ?? item;
}

function getEducationId(item: any) {
  const education = getEducation(item);
  return item.education_item_id ?? education.id ?? item.id;
}

function firstValue(...values: any[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }

  return null;
}

function getTextContent(item: any) {
  const education = getEducation(item);

  return String(
    education.content ??
      education.text_content ??
      item.content ??
      item.text_content ??
      education.description ??
      item.description ??
      ""
  );
}

function extractUrlsFromText(value: string) {
  const matches = value.match(/https?:\/\/[^\s)]+/gi);
  return matches ?? [];
}

function looksLikeAudio(url: string) {
  const lower = url.toLowerCase();

  return (
    lower.includes(".mp3") ||
    lower.includes(".m4a") ||
    lower.includes(".wav") ||
    lower.includes(".aac") ||
    lower.includes("audio")
  );
}

function looksLikeVideo(url: string) {
  const lower = url.toLowerCase();

  return (
    lower.includes(".mp4") ||
    lower.includes(".mov") ||
    lower.includes(".webm") ||
    lower.includes(".mkv") ||
    lower.includes("youtube.com") ||
    lower.includes("youtu.be") ||
    lower.includes("vimeo.com") ||
    lower.includes("video")
  );
}

function getYouTubeVideoId(url: string | null | undefined) {
  const raw = String(url ?? "").trim();

  if (!raw) return null;

  try {
    const parsed = new URL(raw);

    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "").split("?")[0] || null;
    }

    if (parsed.hostname.includes("youtube.com")) {
      const watchId = parsed.searchParams.get("v");
      if (watchId) return watchId;

      const embedMatch = parsed.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch?.[1]) return embedMatch[1];

      const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?]+)/);
      if (shortsMatch?.[1]) return shortsMatch[1];
    }
  } catch {
    const fallbackMatch = raw.match(
      /(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/
    );

    return fallbackMatch?.[1] ?? null;
  }

  return null;
}

function getYouTubeThumbnail(url: string | null | undefined) {
  const videoId = getYouTubeVideoId(url);

  if (!videoId) return null;

  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

async function openUrl(url: string | null | undefined) {
  if (!url) return;

  try {
    const supported = await Linking.canOpenURL(url);

    if (!supported) {
      Alert.alert(
        "Cannot open media",
        "This media link cannot be opened on this device."
      );
      return;
    }

    await Linking.openURL(url);
  } catch {
    Alert.alert("Cannot open media", "The media link could not be opened.");
  }
}

function VideoPreviewCard({
  videoUrl,
  thumbnailUrl,
  lowDataMode,
}: {
  videoUrl: string;
  thumbnailUrl?: string | null;
  lowDataMode?: boolean;
}) {
  const previewUrl = thumbnailUrl ?? getYouTubeThumbnail(videoUrl);

  return (
    <Pressable
      onPress={() => openUrl(videoUrl)}
      style={{
        backgroundColor: theme.white,
        borderWidth: 1.5,
        borderColor: theme.border ?? "#E2E8F0",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      {previewUrl && !lowDataMode ? (
        <Image
          source={{ uri: previewUrl }}
          style={{
            width: "100%",
            height: 180,
            backgroundColor: theme.warmBg ?? "#FFF7F2",
          }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            height: 150,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.warmBg ?? "#FFF7F2",
          }}
        >
          <Text
            style={{
              color: theme.orange,
              fontSize: 42,
              fontWeight: "900",
            }}
          >
            ▶
          </Text>

          {lowDataMode ? (
            <Text
              style={{
                color: theme.muted,
                fontSize: 12,
                fontWeight: "800",
                marginTop: 6,
              }}
            >
              Low-data mode: preview image hidden
            </Text>
          ) : null}
        </View>
      )}

      <View style={{ padding: 12 }}>
        <Text
          style={{
            color: theme.black,
            fontSize: 15,
            fontWeight: "900",
          }}
        >
          Watch education video
        </Text>

        <Text
          style={{
            color: theme.muted,
            fontSize: 12,
            fontWeight: "700",
            marginTop: 4,
          }}
          numberOfLines={1}
        >
          Tap to open video
        </Text>
      </View>
    </Pressable>
  );
}

function getDynamicMedia(item: any) {
  const education = getEducation(item);

  const metadata = education.metadata ?? item.metadata ?? {};
  const settings = education.settings ?? item.settings ?? {};
  const payload = education.payload ?? item.payload ?? {};
  const media = payload.media ?? metadata.media ?? settings.media ?? {};

  const textContent = getTextContent(item);
  const bodyUrls = extractUrlsFromText(textContent);

  const thumbnailUrl = firstValue(
    education.thumbnail_url,
    education.thumbnailUrl,
    education.video_thumbnail_url,
    education.videoThumbnailUrl,
    education.poster_url,
    education.posterUrl,
    item.thumbnail_url,
    item.thumbnailUrl,
    item.video_thumbnail_url,
    item.videoThumbnailUrl,
    item.poster_url,
    item.posterUrl,
    payload.thumbnail_url,
    payload.thumbnailUrl,
    payload.video_thumbnail_url,
    payload.videoThumbnailUrl,
    payload.poster_url,
    payload.posterUrl,
    metadata.thumbnail_url,
    metadata.thumbnailUrl,
    metadata.video_thumbnail_url,
    metadata.videoThumbnailUrl,
    metadata.poster_url,
    metadata.posterUrl,
    settings.thumbnail_url,
    settings.thumbnailUrl,
    settings.video_thumbnail_url,
    settings.videoThumbnailUrl,
    settings.poster_url,
    settings.posterUrl,
    media.thumbnail_url,
    media.thumbnailUrl,
    media.poster_url,
    media.posterUrl
  );

  const explicitVideoUrl = firstValue(
    education.video_url,
    education.videoUrl,
    education.media_video_url,
    item.video_url,
    item.videoUrl,
    item.media_video_url,
    payload.video_url,
    payload.videoUrl,
    metadata.video_url,
    metadata.videoUrl,
    settings.video_url,
    settings.videoUrl,
    media.video_url,
    media.videoUrl
  );

  const explicitAudioUrl = firstValue(
    education.audio_url,
    education.audioUrl,
    education.media_audio_url,
    item.audio_url,
    item.audioUrl,
    item.media_audio_url,
    payload.audio_url,
    payload.audioUrl,
    metadata.audio_url,
    metadata.audioUrl,
    settings.audio_url,
    settings.audioUrl,
    media.audio_url,
    media.audioUrl
  );

  const explicitMediaUrl = firstValue(
    education.media_url,
    education.mediaUrl,
    education.content_url,
    education.contentUrl,
    item.media_url,
    item.mediaUrl,
    item.content_url,
    item.contentUrl,
    payload.media_url,
    payload.mediaUrl,
    payload.content_url,
    payload.contentUrl,
    metadata.media_url,
    metadata.mediaUrl,
    metadata.content_url,
    metadata.contentUrl,
    settings.media_url,
    settings.mediaUrl,
    settings.content_url,
    settings.contentUrl,
    media.media_url,
    media.mediaUrl,
    media.url
  );

  const videoUrl =
    explicitVideoUrl ?? bodyUrls.find((url) => looksLikeVideo(url)) ?? null;

  const audioUrl =
    explicitAudioUrl ?? bodyUrls.find((url) => looksLikeAudio(url)) ?? null;

  const mediaUrl =
    explicitMediaUrl ??
    bodyUrls.find((url) => url !== videoUrl && url !== audioUrl) ??
    null;

  const transcript = firstValue(
    education.transcript,
    item.transcript,
    payload.transcript,
    metadata.transcript,
    settings.transcript,
    media.transcript
  );

  return {
    videoUrl,
    audioUrl,
    mediaUrl,
    thumbnailUrl,
    transcript,
    bodyUrls,
  };
}

function updateEducationArray(
  items: any[],
  educationItemId: string,
  patch: Record<string, any>
) {
  return items.map((item: any) => {
    const currentId = String(getEducationId(item) ?? "");

    if (currentId !== educationItemId) {
      return item;
    }

    const education = item.education_items ?? null;

    return {
      ...item,
      ...patch,
      education_items: education
        ? {
            ...education,
            ...patch,
          }
        : item.education_items,
    };
  });
}

async function updateEducationInLocalCache(
  app: any,
  educationItemId: string,
  patch: Record<string, any>
) {
  const cache = app.cache as any;

  if (!cache) return;

  const nextCache = {
    ...cache,
  };

  if (Array.isArray(cache.education_items)) {
    nextCache.education_items = updateEducationArray(
      cache.education_items,
      educationItemId,
      patch
    );
  }

  if (cache.data && Array.isArray(cache.data.education_items)) {
    nextCache.data = {
      ...cache.data,
      education_items: updateEducationArray(
        cache.data.education_items,
        educationItemId,
        patch
      ),
    };
  }

  if (
    cache.research_care &&
    Array.isArray(cache.research_care.education_assignments)
  ) {
    nextCache.research_care = {
      ...cache.research_care,
      education_assignments: updateEducationArray(
        cache.research_care.education_assignments,
        educationItemId,
        patch
      ),
    };
  }

  if (
    cache.data?.research_care &&
    Array.isArray(cache.data.research_care.education_assignments)
  ) {
    nextCache.data = {
      ...nextCache.data,
      research_care: {
        ...cache.data.research_care,
        education_assignments: updateEducationArray(
          cache.data.research_care.education_assignments,
          educationItemId,
          patch
        ),
      },
    };
  }

  app.setCache(nextCache);

  try {
    await saveSyncCache(nextCache);
  } catch {
    // In-memory cache has already been updated.
  }
}

export function EducationScreen() {
  const app = useAppContext();
  const { lowDataMode } = app;

  const items = pickEducationItems(app);

  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<StatusType>("info");

  function showStatus(message: string, type: StatusType) {
    setStatusMessage(message);
    setStatusType(type);
  }

  function openEducationItem(item: any) {
    setSelectedItem(item);
    setStatusMessage("");
    setStatusType("info");
  }

  function backToEducationList() {
    setSelectedItem(null);
    setStatusMessage("");
    setStatusType("info");
  }

  async function markCompleted(item: any) {
    const educationItemIdRaw = getEducationId(item);
    const educationItemId = educationItemIdRaw ? String(educationItemIdRaw) : "";

    if (!educationItemId) {
      showStatus("This education item does not have a valid ID.", "error");
      return;
    }

    const completedAt = new Date().toISOString();

    const payload = {
      education_item_id: educationItemId,
      progress_status: "completed",
      progress_percent: 100,
      completed_at: completedAt,
      local_id: `education:${educationItemId}:${Date.now()}`,
    };

    setSaving(true);
    setStatusMessage("");

    try {
      await submitEducationProgress(payload);

      await updateEducationInLocalCache(app, educationItemId, {
        completed_at: completedAt,
        progress_status: "completed",
        progress_percent: 100,
        status: "completed",
      });

      setSelectedItem(null);
      showStatus("Education progress saved successfully.", "success");
    } catch {
      await enqueueOfflineAction("education_progress", payload);

      await updateEducationInLocalCache(app, educationItemId, {
        completed_at: completedAt,
        progress_status: "completed_pending_sync",
        progress_percent: 100,
        status: "completed_pending_sync",
      });

      setSelectedItem(null);
      showStatus(
        "Saved offline. It will send automatically when internet returns.",
        "offline"
      );
    } finally {
      setSaving(false);
    }
  }

  if (selectedItem) {
    const education = getEducation(selectedItem);
    const media = getDynamicMedia(selectedItem);
    const textContent = getTextContent(selectedItem);
    const otherLinks = media.bodyUrls.filter(
      (url) =>
        url !== media.videoUrl && url !== media.audioUrl && url !== media.mediaUrl
    );

    return (
      <Screen
        title={education.title ?? selectedItem.title ?? "Education"}
        subtitle={education.topic ?? selectedItem.topic ?? "Education content"}
      >
        <AppButton
          label="← Back to education"
          variant="secondary"
          disabled={saving}
          onPress={backToEducationList}
        />

        <StatusNotice message={statusMessage} type={statusType} />

        <Card
          title={education.title ?? selectedItem.title ?? "Education item"}
          subtitle={
            education.description ??
            selectedItem.description ??
            "Read this education content."
          }
          tag={education.language ?? selectedItem.language ?? "content"}
        />

        {textContent ? (
          <View
            style={{
              backgroundColor: theme.white,
              borderWidth: 1.5,
              borderColor: theme.border ?? "#E2E8F0",
              borderRadius: 18,
              padding: 14,
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontWeight: "700",
                color: theme.muted,
                fontSize: 14,
                lineHeight: 20,
              }}
            >
              {textContent}
            </Text>
          </View>
        ) : (
          <Card
            title="No text content"
            subtitle="This item may only contain media."
          />
        )}

        {media.transcript ? (
          <Card title="Transcript" subtitle={String(media.transcript)} />
        ) : null}

        {media.videoUrl ? (
          <VideoPreviewCard
            videoUrl={media.videoUrl}
            thumbnailUrl={media.thumbnailUrl}
            lowDataMode={lowDataMode}
          />
        ) : null}

        {media.audioUrl ? (
          <AppButton
            label="Listen to audio"
            variant="secondary"
            onPress={() => openUrl(media.audioUrl)}
          />
        ) : null}

        {media.mediaUrl ? (
          <AppButton
            label="Open media"
            variant="secondary"
            onPress={() => openUrl(media.mediaUrl)}
          />
        ) : null}

        {otherLinks.map((url, index) => (
          <AppButton
            key={`${url}-${index}`}
            label={`Open link ${index + 1}`}
            variant="secondary"
            onPress={() => openUrl(url)}
          />
        ))}

        <AppButton
          label={saving ? "Saving..." : "Mark as completed"}
          disabled={saving}
          onPress={() => markCompleted(selectedItem)}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Education"
      subtitle={
        lowDataMode
          ? "Low-data mode is on. Use text or audio when available."
          : "Education content"
      }
    >
      <Card
        title="Education sync check"
        subtitle={`Education items found: ${items.length}`}
      />

      <StatusNotice message={statusMessage} type={statusType} />

      {items.length === 0 ? (
        <Card
          title="No education content yet"
          subtitle="Pull sync to check assignments."
        />
      ) : (
        items.map((item: any, index: number) => {
          const education = getEducation(item);

          return (
            <Card
              key={item.id ?? education.id ?? index}
              title={education.title ?? item.title ?? "Education item"}
              subtitle={
                education.description ??
                education.content ??
                item.content ??
                education.text_content ??
                "Open this education item."
              }
              tag={
                education.topic ??
                item.topic ??
                education.language ??
                "content"
              }
              onPress={() => openEducationItem(item)}
            />
          );
        })
      )}
    </Screen>
  );
}