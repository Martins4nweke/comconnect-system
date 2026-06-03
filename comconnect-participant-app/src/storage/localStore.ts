import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ParticipantConfig, SyncCache } from "../types";

const keys = {
  token: "comconnect.session_token",
  sessionId: "comconnect.session_id",
  config: "comconnect.config",
  syncCache: "comconnect.sync_cache",
  lastSyncedAt: "comconnect.last_synced_at",
  lowDataMode: "comconnect.low_data_mode",
  deviceId: "comconnect.device_id",
};

export async function saveSession(token: string, sessionId: string) {
  await AsyncStorage.multiSet([
    [keys.token, token],
    [keys.sessionId, sessionId],
  ]);
}

export async function getSessionToken() {
  return AsyncStorage.getItem(keys.token);
}

export async function clearSession() {
  await AsyncStorage.multiRemove([keys.token, keys.sessionId, keys.config, keys.syncCache, keys.lastSyncedAt]);
}

export async function saveConfig(config: ParticipantConfig) {
  await AsyncStorage.setItem(keys.config, JSON.stringify(config));
}

export async function getConfig(): Promise<ParticipantConfig | null> {
  const raw = await AsyncStorage.getItem(keys.config);
  return raw ? JSON.parse(raw) : null;
}

export async function saveSyncCache(cache: SyncCache) {
  await AsyncStorage.setItem(keys.syncCache, JSON.stringify(cache));
  if (cache.pulled_at) await AsyncStorage.setItem(keys.lastSyncedAt, cache.pulled_at);
}

export async function getSyncCache(): Promise<SyncCache | null> {
  const raw = await AsyncStorage.getItem(keys.syncCache);
  return raw ? JSON.parse(raw) : null;
}

export async function getLastSyncedAt() {
  return AsyncStorage.getItem(keys.lastSyncedAt);
}

export async function setLowDataMode(enabled: boolean) {
  await AsyncStorage.setItem(keys.lowDataMode, enabled ? "true" : "false");
}

export async function getLowDataMode() {
  const raw = await AsyncStorage.getItem(keys.lowDataMode);
  if (raw === null) return process.env.EXPO_PUBLIC_DEFAULT_LOW_DATA_MODE !== "false";
  return raw === "true";
}

export async function getOrCreateDeviceId() {
  const existing = await AsyncStorage.getItem(keys.deviceId);
  if (existing) return existing;

  const id = `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await AsyncStorage.setItem(keys.deviceId, id);
  return id;
}
