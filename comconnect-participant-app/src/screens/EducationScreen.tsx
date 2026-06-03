import { useState } from "react";
import { Alert, Linking, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { AppButton } from "../components/AppButton";
import { StatusNotice } from "../components/StatusNotice";
import { useAppContext } from "../context/AppContext";
import { submitEducationProgress } from "../api/participantAppApi";
import { enqueueOfflineAction } from "../storage/offlineQueue";
import { saveSyncCache } from "../storage/localStore";

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

function getTextContent(item: any) {
  const education = getEducation(item);

  return (
    education.content ??
    education.text_content ??
    item.content ??
    item.text_content ??
    education.description ??
    item.description ??
    ""
  );
}

function getDynamicMedia(item: any) {
  const education = getEducation(item);

  const metadata = education.metadata ?? item.metadata ?? {};
  const settings = education.settings ?? item.settings ?? {};

  const videoUrl =
    education.video_url ??
    education.videoUrl ??
    education.media_video_url ??
    metadata.video_url ??
    metadata.videoUrl ??
    settings.video_url ??
    settings.videoUrl ??
    null;

  const audioUrl =
    education.audio_url ??
    education.audioUrl ??
    education.media_audio_url ??
    metadata.audio_url ??
    metadata.audioUrl ??
    settings.audio_url ??
    settings.audioUrl ??
    null;

  const mediaUrl =
    education.media_url ??
    education.mediaUrl ??
    education.content_url ??
    education.contentUrl ??
    metadata.media_url ??
    metadata.mediaUrl ??
    metadata.content_url ??
    metadata.contentUrl ??
    settings.media_url ??
    settings.mediaUrl ??
    settings.content_url ??
    settings.contentUrl ??
    null;

  const transcript =
    education.transcript ??
    metadata.transcript ??
    settings.transcript ??
    null;

  return {
    videoUrl,
    audioUrl,
    mediaUrl,
    transcript,
  };
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

    return (
      <Screen
        title={education.title ?? selectedItem.title ?? "Education"}
        subtitle={education.topic ?? selectedItem.topic ?? "Education content"}
      >
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
              backgroundColor: "white",
              borderWidth: 1.5,
              borderColor: "#171717",
              borderRadius: 16,
              padding: 12,
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontWeight: "700",
                color: "#64748B",
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
          <AppButton
            label={lowDataMode ? "Open video link" : "Watch video"}
            variant="secondary"
            onPress={() => openUrl(media.videoUrl)}
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

        <AppButton
          label={saving ? "Saving..." : "Mark as completed"}
          disabled={saving}
          onPress={() => markCompleted(selectedItem)}
        />

        <AppButton
          label="Back to education"
          variant="secondary"
          disabled={saving}
          onPress={backToEducationList}
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