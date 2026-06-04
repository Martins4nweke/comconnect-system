import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import * as Device from "expo-device";
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
  if (!Device.isDevice) {
    return {
      ok: false,
      token: null,
      reason: "Push notifications require a physical device for reliable testing.",
    };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#F26A21",
    });
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

  const projectId = getExpoProjectId();

  if (!projectId) {
    return {
      ok: false,
      token: null,
      reason: "Missing EAS projectId in app config.",
    };
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  return {
    ok: true,
    token: token.data,
    reason: null,
  };
}