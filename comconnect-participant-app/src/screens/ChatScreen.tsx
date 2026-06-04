import { useEffect, useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { Screen } from "../components/Screen";
import { AppButton } from "../components/AppButton";
import { StatusNotice } from "../components/StatusNotice";
import { useAppContext } from "../context/AppContext";
import {
  markChatRead,
  sendChatMedia,
  sendChatMessage,
} from "../api/participantAppApi";
import { enqueueOfflineAction } from "../storage/offlineQueue";
import { saveSyncCache } from "../storage/localStore";

type StatusType = "success" | "offline" | "error" | "info";

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function pickChatMessages(app: any) {
  const cache = app.cache as any;

  const direct = asArray(cache?.chat_messages);
  const dataDirect = asArray(cache?.data?.chat_messages);
  const researchCare = asArray(cache?.research_care?.chat_messages);
  const dataResearchCare = asArray(cache?.data?.research_care?.chat_messages);

  const updates = asArray(cache?.chat_updates);
  const dataUpdates = asArray(cache?.data?.chat_updates);
  const researchCareUpdates = asArray(cache?.research_care?.chat_updates);
  const dataResearchCareUpdates = asArray(
    cache?.data?.research_care?.chat_updates
  );

  return [
    ...direct,
    ...dataDirect,
    ...researchCare,
    ...dataResearchCare,
    ...updates,
    ...dataUpdates,
    ...researchCareUpdates,
    ...dataResearchCareUpdates,
  ];
}

function uniqueMessages(messages: any[]) {
  const seen = new Set<string>();

  return messages.filter((message) => {
    const key = String(
      message.id ??
        message.local_id ??
        `${message.sender_type}:${message.message_text}:${message.created_at}`
    );

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function getMessageText(item: any) {
  return (
    item.message_text ??
    item.text ??
    item.body ??
    item.content ??
    item.payload?.message_text ??
    ""
  );
}

function getMessageTime(item: any) {
  const raw =
    item.created_at ??
    item.sent_at ??
    item.synced_at ??
    item.read_at ??
    item.seen_at ??
    null;

  if (!raw) return "";

  try {
    return new Date(raw).toLocaleString();
  } catch {
    return String(raw);
  }
}

function isParticipantMessage(item: any) {
  return (
    item.sender_type === "participant" ||
    item.direction === "outbound" ||
    item.from_participant === true
  );
}

function getMediaType(item: any) {
  return (
    item.payload?.media_type ??
    item.payload?.message_type ??
    item.payload?.media?.media_type ??
    null
  );
}

function getMediaLabel(item: any) {
  const mediaType = getMediaType(item);

  if (mediaType === "audio") return "Voice note";
  if (mediaType === "video") return "Video";
  if (mediaType === "image") return "Image";

  return null;
}

function fileNameFromUri(uri: string, fallback: string) {
  const cleanUri = String(uri ?? "");
  const lastPart = cleanUri.split("/").pop();

  return lastPart || fallback;
}

function messageStatus(item: any) {
  if (item.status === "pending_sync") return "Pending sync";
  if (item.status === "sent") return "Sent";
  if (item.synced_at) return "Sent";
  if (item.created_offline_at) return "Saved offline";
  return item.status ?? "";
}

function updateChatItemsAsSeen(items: any[], seenAt: string) {
  return items.map((item: any) => {
    if (isParticipantMessage(item)) {
      return item;
    }

    return {
      ...item,
      read_at: item.read_at ?? seenAt,
      seen_at: item.seen_at ?? seenAt,
      status: item.status === "read" ? item.status : "seen",
    };
  });
}

function updateChatAsSeen(cache: any, seenAt: string) {
  const nextCache = {
    ...cache,
  };

  if (Array.isArray(cache?.chat_updates)) {
    nextCache.chat_updates = updateChatItemsAsSeen(cache.chat_updates, seenAt);
  }

  if (Array.isArray(cache?.chat_messages)) {
    nextCache.chat_messages = updateChatItemsAsSeen(
      cache.chat_messages,
      seenAt
    );
  }

  if (cache?.data) {
    nextCache.data = {
      ...cache.data,
    };

    if (Array.isArray(cache.data.chat_updates)) {
      nextCache.data.chat_updates = updateChatItemsAsSeen(
        cache.data.chat_updates,
        seenAt
      );
    }

    if (Array.isArray(cache.data.chat_messages)) {
      nextCache.data.chat_messages = updateChatItemsAsSeen(
        cache.data.chat_messages,
        seenAt
      );
    }
  }

  if (cache?.research_care) {
    nextCache.research_care = {
      ...cache.research_care,
    };

    if (Array.isArray(cache.research_care.chat_updates)) {
      nextCache.research_care.chat_updates = updateChatItemsAsSeen(
        cache.research_care.chat_updates,
        seenAt
      );
    }

    if (Array.isArray(cache.research_care.chat_messages)) {
      nextCache.research_care.chat_messages = updateChatItemsAsSeen(
        cache.research_care.chat_messages,
        seenAt
      );
    }
  }

  if (cache?.data?.research_care) {
    nextCache.data = {
      ...nextCache.data,
      research_care: {
        ...cache.data.research_care,
      },
    };

    if (Array.isArray(cache.data.research_care.chat_updates)) {
      nextCache.data.research_care.chat_updates = updateChatItemsAsSeen(
        cache.data.research_care.chat_updates,
        seenAt
      );
    }

    if (Array.isArray(cache.data.research_care.chat_messages)) {
      nextCache.data.research_care.chat_messages = updateChatItemsAsSeen(
        cache.data.research_care.chat_messages,
        seenAt
      );
    }
  }

  return nextCache;
}

async function markChatSeenInLocalCache(app: any, seenAt: string) {
  const cache = app.cache as any;

  if (!cache) return;

  const nextCache = updateChatAsSeen(cache, seenAt);

  app.setCache(nextCache);

  try {
    await saveSyncCache(nextCache);
  } catch {
    // In-memory cache has already been updated.
  }
}

function addLocalChatMessage(cache: any, message: any) {
  const nextCache = {
    ...cache,
  };

  const existingChatMessages = Array.isArray(cache?.chat_messages)
    ? cache.chat_messages
    : [];

  nextCache.chat_messages = [...existingChatMessages, message];

  const existingChatUpdates = Array.isArray(cache?.chat_updates)
    ? cache.chat_updates
    : [];

  nextCache.chat_updates = [...existingChatUpdates, message];

  if (cache?.data) {
    nextCache.data = {
      ...cache.data,
      chat_messages: [
        ...(Array.isArray(cache.data.chat_messages)
          ? cache.data.chat_messages
          : []),
        message,
      ],
      chat_updates: [
        ...(Array.isArray(cache.data.chat_updates)
          ? cache.data.chat_updates
          : []),
        message,
      ],
    };
  }

  if (cache?.research_care) {
    nextCache.research_care = {
      ...cache.research_care,
      chat_messages: [
        ...(Array.isArray(cache.research_care.chat_messages)
          ? cache.research_care.chat_messages
          : []),
        message,
      ],
    };
  }

  return nextCache;
}

async function addChatMessageToLocalCache(app: any, message: any) {
  const cache = app.cache as any;

  if (!cache) return;

  const nextCache = addLocalChatMessage(cache, message);

  app.setCache(nextCache);

  try {
    await saveSyncCache(nextCache);
  } catch {
    // In-memory cache has already been updated.
  }
}

export function ChatScreen() {
  const app = useAppContext();
  const projectName = app.config?.project?.name ?? "ComConnect";

  const chatMessages = useMemo(() => {
    return uniqueMessages(pickChatMessages(app))
      .filter((item) => Boolean(getMessageText(item)))
      .sort((a, b) => {
        const aTime = new Date(
          a.created_at ?? a.sent_at ?? a.synced_at ?? 0
        ).getTime();

        const bTime = new Date(
          b.created_at ?? b.sent_at ?? b.synced_at ?? 0
        ).getTime();

        return aTime - bTime;
      });
  }, [app.cache]);

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<StatusType>("info");

  useEffect(() => {
    async function markSeen() {
      const readAt = new Date().toISOString();
      const localId = `chat-read:${Date.now()}`;

      await markChatSeenInLocalCache(app, readAt);

      try {
        await markChatRead({
          local_id: localId,
          read_at: readAt,
          metadata: {
            source: "chat_screen_open",
          },
        });
      } catch {
        await enqueueOfflineAction("chat_read", {
          local_id: localId,
          read_at: readAt,
          metadata: {
            source: "chat_screen_open",
          },
        });
      }
    }

    markSeen();
  }, []);

  function showStatus(messageText: string, type: StatusType) {
    setStatusMessage(messageText);
    setStatusType(type);
  }

  function updateMessage(value: string) {
    setMessage(value);

    if (statusType === "error") {
      setStatusMessage("");
      setStatusType("info");
    }
  }

  async function send() {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      showStatus("Please type a message before sending.", "error");
      return;
    }

    const sentAt = new Date().toISOString();
    const localId = `chat:${Date.now()}`;

    const payload = {
      local_id: localId,
      message_text: trimmedMessage,
      subject: "Participant message",
      sent_at: sentAt,
    };

    setSending(true);
    setStatusMessage("");

    try {
      const response = await sendChatMessage(payload);
      const responseData = (response as any)?.data ?? response;
      const savedMessage = responseData?.message ?? null;

      await addChatMessageToLocalCache(app, {
        ...(savedMessage ?? {}),
        ...payload,
        id: savedMessage?.id ?? localId,
        thread_id: responseData?.thread_id ?? savedMessage?.thread_id ?? null,
        direction: "outbound",
        sender_type: "participant",
        status: "sent",
        read_at: sentAt,
        seen_at: sentAt,
        created_at: savedMessage?.created_at ?? sentAt,
        synced_at: savedMessage?.synced_at ?? sentAt,
      });

      setMessage("");
      showStatus("Message sent successfully.", "success");
    } catch {
      await enqueueOfflineAction("chat_message", payload);

      await addChatMessageToLocalCache(app, {
        ...payload,
        id: localId,
        direction: "outbound",
        sender_type: "participant",
        status: "pending_sync",
        read_at: sentAt,
        seen_at: sentAt,
        created_at: sentAt,
        created_offline_at: sentAt,
      });

      setMessage("");
      showStatus(
        "Saved offline. It will send automatically when internet returns.",
        "offline"
      );
    } finally {
      setSending(false);
    }
  }

  async function sendMediaToChat(params: {
  uri: string;
  mediaType: "audio" | "video" | "image";
  mimeType: string;
  fileName: string;
  label: string;
}) {
  const sentAt = new Date().toISOString();
  const localId = `chat-media:${Date.now()}`;

  setMediaBusy(true);
  setStatusMessage("");

  try {
    const response = await sendChatMedia({
      file_uri: params.uri,
      file_name: params.fileName,
      mime_type: params.mimeType,
      media_type: params.mediaType,
      message_text: `${params.label} sent from participant.`,
      local_id: localId,
    });

    const responseData = (response as any)?.data ?? response;
    const savedMessage = responseData?.message ?? null;

    await addChatMessageToLocalCache(app, {
      ...(savedMessage ?? {}),
      id: savedMessage?.id ?? localId,
      local_id: localId,
      thread_id: responseData?.thread_id ?? savedMessage?.thread_id ?? null,
      direction: "outbound",
      sender_type: "participant",
      message_text:
        savedMessage?.message_text ?? `${params.label} sent from participant.`,
      payload: {
        ...(savedMessage?.payload ?? {}),
        message_type: params.mediaType,
        media_type: params.mediaType,
        local_uri: params.uri,
      },
      status: "sent",
      read_at: sentAt,
      seen_at: sentAt,
      created_at: savedMessage?.created_at ?? sentAt,
      synced_at: savedMessage?.synced_at ?? sentAt,
    });

    showStatus(`${params.label} sent successfully.`, "success");
  } catch {
    showStatus(
      `${params.label} could not be sent. Please check your internet and try again.`,
      "error"
    );
  } finally {
    setMediaBusy(false);
  }
}

async function startVoiceRecording() {
  try {
    const permission = await Audio.requestPermissionsAsync();

    if (permission.status !== "granted") {
      showStatus("Microphone permission is required to record voice notes.", "error");
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });

    const result = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );

    setRecording(result.recording);
    showStatus("Recording voice note...", "info");
  } catch {
    showStatus("Could not start voice recording.", "error");
  }
}

async function stopVoiceRecordingAndSend() {
  if (!recording) return;

  try {
    await recording.stopAndUnloadAsync();

    const uri = recording.getURI();
    setRecording(null);

    if (!uri) {
      showStatus("Voice note was not saved.", "error");
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });

    await sendMediaToChat({
      uri,
      mediaType: "audio",
      mimeType: "audio/m4a",
      fileName: fileNameFromUri(uri, `voice-note-${Date.now()}.m4a`),
      label: "Voice note",
    });
  } catch {
    setRecording(null);
    showStatus("Could not send voice note.", "error");
  }
}

async function pickVideoAndSend() {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (permission.status !== "granted") {
      showStatus("Camera permission is required to capture video.", "error");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 0.6,
      videoMaxDuration: 60,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return;
    }

    const asset = result.assets[0];

    await sendMediaToChat({
      uri: asset.uri,
      mediaType: "video",
      mimeType: asset.mimeType ?? "video/mp4",
      fileName: fileNameFromUri(asset.uri, `chat-video-${Date.now()}.mp4`),
      label: "Video",
    });
  } catch {
    showStatus("Could not capture or send video.", "error");
  }
}

async function capturePhotoAndSend() {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (permission.status !== "granted") {
      showStatus("Camera permission is required to capture photo.", "error");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return;
    }

    const asset = result.assets[0];

    await sendMediaToChat({
      uri: asset.uri,
      mediaType: "image",
      mimeType: asset.mimeType ?? "image/jpeg",
      fileName: fileNameFromUri(asset.uri, `chat-photo-${Date.now()}.jpg`),
      label: "Photo",
    });
  } catch {
    showStatus("Could not capture or send photo.", "error");
  }
}

  return (
    <Screen title="Chat" subtitle={`To: ${projectName} team`}>
      <StatusNotice message={statusMessage} type={statusType} />

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
            fontWeight: "900",
            color: "#171717",
            marginBottom: 4,
          }}
        >
          Conversation
        </Text>

        <Text
          style={{
            fontWeight: "700",
            color: "#64748B",
            fontSize: 13,
            lineHeight: 18,
          }}
        >
          Messages here are between you and the {projectName} study/care team.
        </Text>
      </View>

      {chatMessages.length === 0 ? (
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
              fontWeight: "800",
              color: "#64748B",
              lineHeight: 20,
            }}
          >
            No chat messages yet. Send your first message below.
          </Text>
        </View>
      ) : (
        chatMessages.map((item: any, index: number) => {
          const fromParticipant = isParticipantMessage(item);
          const text = getMessageText(item);
          const mediaLabel = getMediaLabel(item);
          const time = getMessageTime(item);
          const status = messageStatus(item);

          return (
            <View
              key={item.id ?? item.local_id ?? index}
              style={{
                backgroundColor: fromParticipant ? "#FFF7F2" : "white",
                borderWidth: 1.5,
                borderColor: fromParticipant ? "#F26A21" : "#171717",
                borderRadius: 16,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  fontWeight: "900",
                  color: "#171717",
                  marginBottom: 4,
                }}
              >
                {fromParticipant ? "You" : `${projectName} team`}
              </Text>

              <Text
  style={{
    fontWeight: "700",
    color: "#334155",
    fontSize: 15,
    lineHeight: 21,
  }}
>
  {mediaLabel ? `${mediaLabel}: ${text}` : text}
</Text>

              {time || status ? (
                <Text
                  style={{
                    marginTop: 6,
                    fontWeight: "700",
                    color: "#64748B",
                    fontSize: 12,
                    lineHeight: 16,
                  }}
                >
                  {time}
                  {status ? ` • ${status}` : ""}
                </Text>
              ) : null}
            </View>
          );
        })
      )}

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
          marginBottom: 10,
        }}
        placeholder="Write your message..."
        value={message}
        onChangeText={updateMessage}
        multiline
      />

      <AppButton
  label={sending ? "Sending..." : "Send message"}
  disabled={sending || mediaBusy || Boolean(recording)}
  onPress={send}
/>

<View style={{ height: 10 }} />

<AppButton
  label={recording ? "Stop and send voice note" : "Record voice note"}
  disabled={sending || mediaBusy}
  onPress={recording ? stopVoiceRecordingAndSend : startVoiceRecording}
/>

<View style={{ height: 10 }} />

<View style={{ height: 10 }} />

<AppButton
  label={mediaBusy ? "Sending media..." : "Capture and send photo"}
  disabled={sending || mediaBusy || Boolean(recording)}
  onPress={capturePhotoAndSend}
/>
<AppButton
  label={mediaBusy ? "Sending media..." : "Capture and send video"}
  disabled={sending || mediaBusy || Boolean(recording)}
  onPress={pickVideoAndSend}
/>
    </Screen>
  );
}