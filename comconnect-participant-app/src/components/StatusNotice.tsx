import { StyleSheet, Text, View } from "react-native";

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
    backgroundColor: "white",
    borderWidth: 1.5,
    borderColor: "#171717",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },

  success: {
    backgroundColor: "#ECFDF5",
  },

  offline: {
    backgroundColor: "#FFF7ED",
  },

  error: {
    backgroundColor: "#FEF2F2",
  },

  text: {
    color: "#171717",
    fontWeight: "800",
    fontSize: 14,
    lineHeight: 20,
  },
});