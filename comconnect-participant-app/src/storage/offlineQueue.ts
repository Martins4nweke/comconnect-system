import AsyncStorage from "@react-native-async-storage/async-storage";
import type { OfflineQueueItem } from "../types";

const queueKey = "comconnect.offline_queue";

const oldQueueKeys = [
  "comconnect.offline_queue",
  "offline_queue",
  "comconnect.queue",
  "comconnect.offline.actions",
];

export async function getQueue(): Promise<OfflineQueueItem[]> {
  const raw = await AsyncStorage.getItem(queueKey);
  return raw ? JSON.parse(raw) : [];
}

export async function saveQueue(items: OfflineQueueItem[]) {
  await AsyncStorage.setItem(queueKey, JSON.stringify(items));
}

export async function enqueueOfflineAction(type: string, payload: Record<string, unknown>) {
  const items = await getQueue();

  const item: OfflineQueueItem = {
    local_id: `${type}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    type,
    created_offline_at: new Date().toISOString(),
    payload,
  };

  items.push(item);
  await saveQueue(items);

  return item;
}

export async function clearQueue() {
  await AsyncStorage.multiRemove(oldQueueKeys);
}

export async function resetQueueForTesting() {
  await AsyncStorage.multiRemove(oldQueueKeys);
  await AsyncStorage.setItem(queueKey, JSON.stringify([]));
}