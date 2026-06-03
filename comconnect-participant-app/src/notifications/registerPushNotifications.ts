import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

function getExpoProjectId() {
  return (
    Constants.easConfig?.projectId ||
    (Constants.expoConfig?.extra as any)?.eas?.projectId ||
    (Constants.manifest as any)?.extra?.eas?.projectId ||
    undefined
  );
}

export async function getExpoPushTokenIfAllowed() {
  if (!Constants.isDevice) {
    return {
      ok: false,
      token: null,
      reason: "Push notifications require a physical device for reliable testing.",
    };
  }

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;

  if (existing.status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== "granted") {
    return {
      ok: false,
      token: null,
      reason: "Notification permission not granted.",
    };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const projectId = getExpoProjectId();
  const token = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  return {
    ok: true,
    token: token.data,
    reason: null,
  };
}
