import { useEffect, useState } from "react";
import { Alert, Linking, Text, TextInput, View } from "react-native";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { AppButton } from "../components/AppButton";
import { StatusNotice } from "../components/StatusNotice";
import { useAppContext } from "../context/AppContext";
import { markMessageOpened, replyToMessage } from "../api/participantAppApi";
import { enqueueOfflineAction } from "../storage/offlineQueue";
import { saveSyncCache } from "../storage/localStore";

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
  return (
    message.body ??
    message.content ??
    message.text ??
    message.message_text ??
    "No message body."
  );
}

function getMessageMedia(message: any) {
  const metadata = message.metadata ?? {};
  const settings = message.settings ?? {};

  const videoUrl =
    message.video_url ??
    message.videoUrl ??
    metadata.video_url ??
    metadata.videoUrl ??
    settings.video_url ??
    settings.videoUrl ??
    null;

  const audioUrl =
    message.audio_url ??
    message.audioUrl ??
    metadata.audio_url ??
    metadata.audioUrl ??
    settings.audio_url ??
    settings.audioUrl ??
    null;

  const mediaUrl =
    message.media_url ??
    message.mediaUrl ??
    message.attachment_url ??
    message.attachmentUrl ??
    metadata.media_url ??
    metadata.mediaUrl ??
    metadata.attachment_url ??
    metadata.attachmentUrl ??
    settings.media_url ??
    settings.mediaUrl ??
    settings.attachment_url ??
    settings.attachmentUrl ??
    null;

  return {
    videoUrl,
    audioUrl,
    mediaUrl,
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

function updateMessageArray(messages: any[], messageId: string, patch: Record<string, any>) {
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

export function MessageDetailScreen({ messageId }: { messageId: string }) {
  const app = useAppContext();
  const messages = pickMessages(app);
  const message = messages.find((item: any) => getMessageId(item) === messageId);

  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<StatusType>("info");

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
        <StatusNotice message={statusMessage} type={statusType} />

        <Card
          title="Message not found"
          subtitle="Pull sync again or return to messages."
        />
      </Screen>
    );
  }

  const media = getMessageMedia(message);

  return (
    <Screen
      title={message.title ?? message.topic ?? "Message"}
      subtitle={message.topic ?? message.category ?? "Read and reply only."}
    >
      <StatusNotice message={statusMessage} type={statusType} />

      <Card
        title={message.title ?? message.topic ?? "Message"}
        subtitle={getMessageBody(message)}
        tag={message.status ?? message.channel ?? "message"}
      />

      {media.videoUrl ? (
        <AppButton
          label="Open video"
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
          label="Open attachment"
          variant="secondary"
          onPress={() => openUrl(media.mediaUrl)}
        />
      ) : null}

      <View
        style={{
          backgroundColor: "white",
          borderWidth: 1.5,
          borderColor: "#171717",
          borderRadius: 16,
          padding: 12,
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            fontWeight: "900",
            marginBottom: 6,
            color: "#171717",
            fontSize: 14,
            lineHeight: 20,
          }}
        >
          Reply to the team
        </Text>

        <TextInput
          style={{
            backgroundColor: "white",
            borderWidth: 1.5,
            borderColor: "#171717",
            borderRadius: 16,
            paddingVertical: 12,
            paddingHorizontal: 12,
            minHeight: 100,
            textAlignVertical: "top",
            fontWeight: "800",
            fontSize: 15,
            lineHeight: 20,
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