import { useState } from "react";
import { Alert, Text } from "react-native";
import { Screen } from "../components/Screen";
import { AppButton } from "../components/AppButton";
import { Card } from "../components/Card";
import { useAppContext } from "../context/AppContext";
import { pullFromComConnect, pushOfflineQueue } from "../sync/syncService";
import { getQueue, resetQueueForTesting } from "../storage/offlineQueue";

const SHOW_DEBUG_TOOLS = __DEV__;

export function SyncStatusScreen() {
  const { setCache, setConfig, cache } = useAppContext();
  const [busy, setBusy] = useState(false);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [lastSyncNote, setLastSyncNote] = useState<string>("");

  async function refreshQueue() {
    const queue = await getQueue();
    setQueueCount(queue.length);
  }

  function normaliseSyncResponse(response: any) {
    return response?.data ?? response ?? {};
  }

  function countMessages(data: any) {
    return data?.messages?.length ?? data?.data?.messages?.length ?? 0;
  }

  function countEducation(data: any) {
    return (
      data?.education_items?.length ??
      data?.research_care?.education_assignments?.length ??
      data?.data?.education_items?.length ??
      data?.data?.research_care?.education_assignments?.length ??
      0
    );
  }

  async function pull() {
    setBusy(true);

    try {
      const response = await pullFromComConnect();
      const syncData = normaliseSyncResponse(response);

      setCache(syncData);

      if (syncData.config) {
        setConfig(syncData.config);
      }

      const educationCount = countEducation(syncData);
      const messageCount = countMessages(syncData);

      const note = `Pulled ${messageCount} messages and ${educationCount} education assignment(s).`;
      setLastSyncNote(note);

      Alert.alert("Synced", note);
    } catch (error: any) {
      Alert.alert("Sync failed", error?.message || "Could not pull data.");
    } finally {
      setBusy(false);
      await refreshQueue();
    }
  }

  async function push() {
    setBusy(true);

    try {
      const result = await pushOfflineQueue();

      Alert.alert(
        "Push complete",
        `Pushed: ${result.pushed}, failed: ${result.failed}`
      );

      await refreshQueue();
    } catch (error: any) {
      Alert.alert(
        "Push failed",
        error?.message ? String(error.message) : "Could not push offline queue."
      );
    } finally {
      setBusy(false);
      await refreshQueue();
    }
  }

  async function clearTestQueue() {
    await resetQueueForTesting();
    const queue = await getQueue();
    setQueueCount(queue.length);
    Alert.alert("Cleared", `Test offline queue cleared. Pending: ${queue.length}`);
  }

  const educationCount = countEducation(cache as any);
  const messageCount = countMessages(cache as any);

  const pulledAt =
    (cache as any)?.pulled_at ??
    (cache as any)?.data?.pulled_at ??
    "No sync yet";

  return (
    <Screen title="Sync Status" subtitle="Pull new content and send saved offline actions.">
      <Card title="Last pull" subtitle={pulledAt} />

      <Card
        title="Pulled content"
        subtitle={`Messages: ${messageCount} | Education: ${educationCount}`}
      />

      {lastSyncNote ? (
        <Text style={{ fontWeight: "900", marginBottom: 8 }}>
          {lastSyncNote}
        </Text>
      ) : null}

      <Text style={{ fontWeight: "900", marginBottom: 8 }}>
        Pending offline actions: {queueCount ?? "Tap refresh"}
      </Text>

      <AppButton
        label={busy ? "Working..." : "Pull from ComConnect"}
        disabled={busy}
        onPress={pull}
      />

      <AppButton
        label={busy ? "Working..." : "Push offline actions"}
        disabled={busy}
        onPress={push}
      />

      <AppButton
        label="Refresh queue count"
        variant="secondary"
        onPress={refreshQueue}
      />

      {SHOW_DEBUG_TOOLS ? (
        <AppButton
          label="Clear test offline queue"
          variant="secondary"
          onPress={clearTestQueue}
        />
      ) : null}
    </Screen>
  );
}