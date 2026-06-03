import { useEffect } from "react";
import { getExpoPushTokenIfAllowed } from "../notifications/registerPushNotifications";
import { registerPushToken } from "../api/pushTokenApi";
import { useAppContext } from "../context/AppContext";

export function useRegisterPushToken() {
  const { token } = useAppContext();

  useEffect(() => {
    async function run() {
      if (!token) return;

      const result = await getExpoPushTokenIfAllowed();
      if (!result.ok || !result.token) return;

      try {
        await registerPushToken({
          push_token: result.token,
          push_provider: "expo",
        });
      } catch {
        // Do not block app usage if token registration fails.
      }
    }

    run();
  }, [token]);
}
