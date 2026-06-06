import { StyleSheet, Text } from "react-native";
import { theme } from "../theme";

function getPillStyle(value: string) {
  const status = String(value ?? "").toLowerCase();

  if (
    status.includes("success") ||
    status.includes("sent") ||
    status.includes("completed") ||
    status.includes("active") ||
    status.includes("confirmed")
  ) {
    return styles.success;
  }

  if (
    status.includes("pending") ||
    status.includes("queued") ||
    status.includes("scheduled") ||
    status.includes("processing") ||
    status.includes("sync")
  ) {
    return styles.warning;
  }

  if (
    status.includes("failed") ||
    status.includes("error") ||
    status.includes("cancelled") ||
    status.includes("missed") ||
    status.includes("rejected")
  ) {
    return styles.danger;
  }

  return styles.info;
}

export function StatusPill({ value }: { value: string }) {
  const text = String(value ?? "status").replaceAll("_", " ");

  return <Text style={[styles.pill, getPillStyle(text)]}>{text}</Text>;
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    fontWeight: "900",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: "hidden",
    marginVertical: 4,
    textTransform: "capitalize",
    fontSize: 11,
    lineHeight: 14,
  },

  info: {
    backgroundColor: theme.blueSoft ?? "#EFF6FF",
    color: theme.blue ?? "#2563EB",
  },

  success: {
    backgroundColor: theme.greenSoft ?? "#ECFDF5",
    color: theme.green,
  },

  warning: {
    backgroundColor: theme.orangeSoft ?? "#FFF3EA",
    color: theme.orangeDark ?? theme.orange,
  },

  danger: {
    backgroundColor: theme.redSoft ?? "#FEF2F2",
    color: theme.red,
  },
});