import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

export function StatusNotice({
  message,
  type = "info",
}: {
  message?: string;
  type?: "success" | "offline" | "error" | "info";
}) {
  if (!message) return null;

  return (
    <View
      style={[
        styles.box,
        type === "success" && styles.success,
        type === "offline" && styles.offline,
        type === "error" && styles.error,
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: theme.blueSoft ?? "#EFF6FF",
    borderWidth: 1,
    borderColor: theme.border ?? "#E2E8F0",
    borderRadius: 18,
    padding: 13,
    marginBottom: 10,
    shadowColor: theme.shadow ?? theme.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },

  success: {
    backgroundColor: theme.greenSoft ?? "#ECFDF5",
    borderColor: theme.green,
  },

  offline: {
    backgroundColor: theme.orangeSoft ?? "#FFF3EA",
    borderColor: theme.orange,
  },

  error: {
    backgroundColor: theme.redSoft ?? "#FEF2F2",
    borderColor: theme.red,
  },

  text: {
    color: theme.black,
    fontWeight: "800",
    fontSize: 14,
    lineHeight: 20,
  },
});