import { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Constants from "expo-constants";
import { Screen } from "../components/Screen";
import { AppButton } from "../components/AppButton";
import { loginParticipant } from "../api/participantAppApi";
import {
  getOrCreateDeviceId,
  saveConfig,
  saveSession,
} from "../storage/localStore";
import { useAppContext } from "../context/AppContext";
import { getExpoPushTokenIfAllowed } from "../notifications/registerPushNotifications";

export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const { setToken, setConfig } = useAppContext();
  const { width } = useWindowDimensions();

  const isSmallPhone = width < 360;

  const [organisationSlug, setOrganisationSlug] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [participantCode, setParticipantCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    if (!projectCode.trim() || !participantCode.trim() || !phoneNumber.trim()) {
      Alert.alert(
        "Missing details",
        "Enter project code, participant code and phone number."
      );
      return;
    }

    setBusy(true);

    try {
      const deviceId = await getOrCreateDeviceId();

      let pushToken: string | null = null;

      try {
        const pushResult = await getExpoPushTokenIfAllowed();

        if (pushResult.ok && pushResult.token) {
          pushToken = pushResult.token;
       } else if (pushResult.reason) {
  Alert.alert("Push notification not registered", pushResult.reason);
}
      } catch (pushError: any) {
        Alert.alert(
  "Push notification error",
  pushError?.message ?? String(pushError)
);
      }

      const result = await loginParticipant({
        organisation_slug: organisationSlug.trim() || undefined,
        project_code: projectCode.trim(),
        participant_code: participantCode.trim(),
        phone_number: phoneNumber.trim(),
        device: {
  device_id: deviceId,
  platform: "android",
  app_version: Constants.expoConfig?.version || "0.1.0",
  push_token: pushToken ?? undefined,
},
      });

      await saveSession(result.session_token, result.session_id);
      await saveConfig(result.config);

      setToken(result.session_token);
      setConfig(result.config);
      onLoggedIn();
    } catch (error: any) {
      Alert.alert(
        "Login failed",
        error?.message || "Please check your details."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title="Participant login"
      subtitle="Enter the details given by your study or care team."
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome</Text>
        <Text style={styles.cardSubtitle}>
          Use your project and participant details to continue.
        </Text>

        <TextInput
          style={[styles.input, isSmallPhone ? styles.inputSmall : null]}
          placeholder="Organisation slug (optional)"
          value={organisationSlug}
          onChangeText={setOrganisationSlug}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={[styles.input, isSmallPhone ? styles.inputSmall : null]}
          placeholder="Project code"
          value={projectCode}
          onChangeText={setProjectCode}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <TextInput
          style={[styles.input, isSmallPhone ? styles.inputSmall : null]}
          placeholder="Participant code"
          value={participantCode}
          onChangeText={setParticipantCode}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <TextInput
          style={[styles.input, isSmallPhone ? styles.inputSmall : null]}
          placeholder="Phone number"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
        />

        <AppButton
          label={busy ? "Logging in..." : "Login"}
          disabled={busy}
          onPress={handleLogin}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    backgroundColor: "white",
    borderWidth: 1.5,
    borderColor: "#171717",
    borderRadius: 20,
    padding: 14,
    marginTop: 4,
    shadowColor: "#171717",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 0,
    elevation: 2,
  },

  cardTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
    color: "#171717",
    marginBottom: 4,
  },

  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 14,
  },

  input: {
    width: "100%",
    backgroundColor: "white",
    borderWidth: 1.5,
    borderColor: "#171717",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    fontWeight: "800",
    fontSize: 15,
    lineHeight: 20,
  },

  inputSmall: {
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderRadius: 14,
    fontSize: 14,
  },
});