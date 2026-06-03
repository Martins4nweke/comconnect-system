import { useEffect } from "react";
import { getExpoPushTokenIfAllowed } from "../notifications/registerPushNotifications";
import { registerPushToken } from "../api/pushTokenApi";
import { useAppContext } from "../context/AppContext";

export function useRegisterPushToken() {
  const { token } = useAppContext();

  useEffect(() => {
    async function run() {
      if (!token) {
        console.log("Push registration skipped: participant is not logged in.");
        return;
      }

      console.log("Starting push token registration...");

      const result = await getExpoPushTokenIfAllowed();

      console.log("Push permission/token result:", result);

      if (!result.ok || !result.token) {
        console.log("Push token not available.");
        return;
      }

      try {
        const response = await registerPushToken({
          push_token: result.token,
          push_provider: "expo",
        });

        console.log("Push token registered with backend:", response);
      } catch (error) {
        console.log("Push token registration failed:", error);
      }
    }

    run();
  }, [token]);
}