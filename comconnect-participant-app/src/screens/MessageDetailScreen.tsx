import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { AppButton } from "../components/AppButton";
import { StatusNotice } from "../components/StatusNotice";
import { useAppContext } from "../context/AppContext";
import { markMessageOpened, replyToMessage } from "../api/participantAppApi";
import { enqueueOfflineAction } from "../storage/offlineQueue";
import { saveSyncCache } from "../storage/localStore";
import { theme } from "../theme";

type StatusType = "success" | "offline" | "error" | "info";

function pickMessages(app: any) {
  const cache = app.cache as any;

  const fromContext = Array.isArray(app.messages) ? app.messages : [];
  const fromCacheMessages = Array.isArray(cache?.messages)
    ? cache.messages
    : [];
  const fromDataMessages = Array.isArray(cache?.data?.messages)
    ? cache.data.messages
    : [];

  if (fromContext.length > 0) return fromContext;
  if (fromCacheMessages.length > 0) return fromCacheMessages;
  if (fromDataMessages.length > 0) return fromDataMessages;

  return [];
}

function getMessageId(message: any) {
  return String(message.id ?? message.message_id ?? "");
}

function getMessageBody(message: any) {
  return String(
    message.body ??
      message.content ??
      message.text ??
      message.message_text ??
      "No message body."
  );
}

function firstValue(...values: any[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }

  return null;
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
}: {
  videoUrl: string;
  thumbnailUrl?: string | null;
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
      {previewUrl ? (
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
          Watch video
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

function getMessageMedia(message: any) {
  const metadata = message.metadata ?? {};
  const settings = message.settings ?? {};
  const payload = message.payload ?? {};
  const media = payload.media ?? metadata.media ?? settings.media ?? {};

  const body = getMessageBody(message);
  const bodyUrls = extractUrlsFromText(body);

  const thumbnailUrl = firstValue(
    message.thumbnail_url,
    message.thumbnailUrl,
    message.video_thumbnail_url,
    message.videoThumbnailUrl,
    message.poster_url,
    message.posterUrl,
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
    media.video_thumbnail_url,
    media.videoThumbnailUrl,
    media.poster_url,
    media.posterUrl
  );

  const explicitVideoUrl = firstValue(
    message.video_url,
    message.videoUrl,
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
    message.audio_url,
    message.audioUrl,
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
    message.media_url,
    message.mediaUrl,
    message.attachment_url,
    message.attachmentUrl,
    payload.media_url,
    payload.mediaUrl,
    payload.attachment_url,
    payload.attachmentUrl,
    metadata.media_url,
    metadata.mediaUrl,
    metadata.attachment_url,
    metadata.attachmentUrl,
    settings.media_url,
    settings.mediaUrl,
    settings.attachment_url,
    settings.attachmentUrl,
    media.media_url,
    media.mediaUrl,
    media.url
  );

  const detectedVideoUrl =
    explicitVideoUrl ?? bodyUrls.find((url) => looksLikeVideo(url)) ?? null;

  const detectedAudioUrl =
    explicitAudioUrl ?? bodyUrls.find((url) => looksLikeAudio(url)) ?? null;

  const detectedMediaUrl =
    explicitMediaUrl ??
    bodyUrls.find(
      (url) => url !== detectedVideoUrl && url !== detectedAudioUrl
    ) ??
    null;

  return {
    videoUrl: detectedVideoUrl,
    audioUrl: detectedAudioUrl,
    mediaUrl: detectedMediaUrl,
    thumbnailUrl,
    bodyUrls,
  };
}

function updateMessageArray(
  messages: any[],
  messageId: string,
  patch: Record<string, any>
) {
  return messages.map((message: any) => {
    const currentId = getMessageId(message);

    if (currentId !== messageId) {
      return message;
    }

    return {
      ...message,
      ...patch,
    };
  });
}

async function updateMessageInLocalCache(
  app: any,
  messageId: string,
  patch: Record<string, any>
) {
  const cache = app.cache as any;

  if (!cache) return;

  const nextCache = {
    ...cache,
  };

  if (Array.isArray(cache.messages)) {
    nextCache.messages = updateMessageArray(cache.messages, messageId, patch);
  }

  if (cache.data && Array.isArray(cache.data.messages)) {
    nextCache.data = {
      ...cache.data,
      messages: updateMessageArray(cache.data.messages, messageId, patch),
    };
  }

  app.setCache(nextCache);

  try {
    await saveSyncCache(nextCache);
  } catch {
    // If local persistence fails, the in-memory cache is still updated.
  }
}

function goBackToMessages(app: any) {
  if (typeof app.setSelectedMessageId === "function") {
    app.setSelectedMessageId(null);
    return;
  }

  if (typeof app.setActiveMessageId === "function") {
    app.setActiveMessageId(null);
    return;
  }

  if (typeof app.setCurrentMessageId === "function") {
    app.setCurrentMessageId(null);
    return;
  }

  if (typeof app.setScreen === "function") {
    app.setScreen("messages");
    return;
  }

  if (typeof app.setActiveScreen === "function") {
    app.setActiveScreen("messages");
    return;
  }

  if (typeof app.navigate === "function") {
    app.navigate("messages");
    return;
  }

  Alert.alert("Go back", "Use the Messages button from Home to return.");
}

export function MessageDetailScreen({ messageId }: { messageId: string }) {
  const app = useAppContext();
  const messages = pickMessages(app);
  const message = messages.find((item: any) => getMessageId(item) === messageId);

  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<StatusType>("info");

  const media = useMemo(() => {
    if (!message) {
      return {
        videoUrl: null,
        audioUrl: null,
        mediaUrl: null,
        thumbnailUrl: null,
        bodyUrls: [],
      };
    }

    return getMessageMedia(message);
  }, [message]);

  function showStatus(messageText: string, type: StatusType) {
    setStatusMessage(messageText);
    setStatusType(type);
  }

  function updateReply(value: string) {
    setReplyText(value);

    if (statusType === "error") {
      setStatusMessage("");
      setStatusType("info");
    }
  }

  useEffect(() => {
    if (!messageId) return;

    async function markOpened() {
      const openedAt = new Date().toISOString();

      await updateMessageInLocalCache(app, messageId, {
        opened_at: openedAt,
        read_at: openedAt,
        seen_at: openedAt,
        status: "opened",
      });

      try {
        await markMessageOpened(messageId);
      } catch {
        await enqueueOfflineAction("message_opened", {
          message_id: messageId,
          opened_at: openedAt,
        });
      }
    }

    markOpened();
  }, [messageId]);

  async function sendReply() {
    const trimmedReply = replyText.trim();

    if (!trimmedReply) {
      showStatus("Please type your reply first.", "error");
      return;
    }

    const repliedAt = new Date().toISOString();

    const payload = {
      message_id: messageId,
      reply_text: trimmedReply,
      replied_at: repliedAt,
    };

    setSending(true);
    setStatusMessage("");

    try {
      await replyToMessage(messageId, trimmedReply);

      await updateMessageInLocalCache(app, messageId, {
        opened_at: repliedAt,
        read_at: repliedAt,
        seen_at: repliedAt,
        replied_at: repliedAt,
        participant_replied_at: repliedAt,
        participant_reply_text: trimmedReply,
        status: "replied",
      });

      setReplyText("");
      showStatus("Reply sent successfully.", "success");
    } catch {
      await enqueueOfflineAction("message_reply", payload);

      await updateMessageInLocalCache(app, messageId, {
        opened_at: repliedAt,
        read_at: repliedAt,
        seen_at: repliedAt,
        replied_at: repliedAt,
        participant_replied_at: repliedAt,
        participant_reply_text: trimmedReply,
        status: "reply_pending_sync",
      });

      setReplyText("");
      showStatus(
        "Saved offline. It will send automatically when internet returns.",
        "offline"
      );
    } finally {
      setSending(false);
    }
  }

  if (!message) {
    return (
      <Screen title="Message" subtitle="Message details.">
        <AppButton
          label="← Back to Messages"
          variant="secondary"
          onPress={() => goBackToMessages(app)}
        />

        <StatusNotice message={statusMessage} type={statusType} />

        <Card
          title="Message not found"
          subtitle="Pull sync again or return to messages."
        />
      </Screen>
    );
  }

  const body = getMessageBody(message);
  const otherLinks = media.bodyUrls.filter(
    (url) =>
      url !== media.videoUrl && url !== media.audioUrl && url !== media.mediaUrl
  );

  return (
    <Screen
      title={message.title ?? message.topic ?? "Message"}
      subtitle={message.topic ?? message.category ?? "Read and reply only."}
    >
      <AppButton
        label="← Back to Messages"
        variant="secondary"
        onPress={() => goBackToMessages(app)}
      />

      <StatusNotice message={statusMessage} type={statusType} />

      <Card
        title={message.title ?? message.topic ?? "Message"}
        subtitle={body}
        tag={message.status ?? message.channel ?? "message"}
      />

      {media.videoUrl ? (
        <VideoPreviewCard
          videoUrl={media.videoUrl}
          thumbnailUrl={media.thumbnailUrl}
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
          label="Open attachment"
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

      <View
        style={{
          backgroundColor: theme.white,
          borderWidth: 1.5,
          borderColor: theme.border ?? "#E2E8F0",
          borderRadius: 18,
          padding: 14,
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            fontWeight: "900",
            marginBottom: 6,
            color: theme.black,
            fontSize: 14,
            lineHeight: 20,
          }}
        >
          Reply to the team
        </Text>

        <TextInput
          style={{
            backgroundColor: theme.white,
            borderWidth: 1.5,
            borderColor: theme.border ?? "#E2E8F0",
            borderRadius: 16,
            paddingVertical: 12,
            paddingHorizontal: 12,
            minHeight: 100,
            textAlignVertical: "top",
            fontWeight: "800",
            fontSize: 15,
            lineHeight: 20,
            color: theme.black,
          }}
          placeholder="Type your reply..."
          value={replyText}
          onChangeText={updateReply}
          multiline
        />
      </View>

      <AppButton
        label={sending ? "Sending..." : "Send reply"}
        disabled={sending}
        onPress={sendReply}
      />
    </Screen>
  );
}