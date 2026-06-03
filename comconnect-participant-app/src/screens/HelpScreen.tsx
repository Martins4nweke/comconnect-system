import { useState } from "react";
import { TextInput } from "react-native";
import { Screen } from "../components/Screen";
import { AppButton } from "../components/AppButton";
import { StatusNotice } from "../components/StatusNotice";
import { submitHelpRequest } from "../api/participantAppApi";
import { enqueueOfflineAction } from "../storage/offlineQueue";

type StatusType = "success" | "offline" | "error" | "info";

export function HelpScreen() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<StatusType>("info");

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
      showStatus("Please write your help request before sending.", "error");
      return;
    }

    const payload = {
      local_id: `help:${Date.now()}`,
      category: "general",
      message: trimmedMessage,
      priority: "normal",
    };

    setSending(true);
    setStatusMessage("");

    try {
      await submitHelpRequest(payload);

      setMessage("");
      showStatus("Help request sent successfully.", "success");
    } catch {
      await enqueueOfflineAction("help_request", payload);

      setMessage("");
      showStatus(
        "Saved offline. It will send automatically when internet returns.",
        "offline"
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen
      title="Ask for Help"
      subtitle="Send a message to your study or care team."
    >
      <StatusNotice message={statusMessage} type={statusType} />

      <TextInput
        style={{
          backgroundColor: "white",
          borderWidth: 1.5,
          borderColor: "#171717",
          borderRadius: 16,
          paddingVertical: 12,
          paddingHorizontal: 12,
          minHeight: 120,
          textAlignVertical: "top",
          fontWeight: "800",
          fontSize: 15,
          lineHeight: 20,
          marginBottom: 10,
        }}
        placeholder="Write your help request..."
        value={message}
        onChangeText={updateMessage}
        multiline
      />

      <AppButton
        label={sending ? "Sending..." : "Send help request"}
        disabled={sending}
        onPress={send}
      />
    </Screen>
  );
}