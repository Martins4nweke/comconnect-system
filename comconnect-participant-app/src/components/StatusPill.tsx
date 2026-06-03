import { StyleSheet, Text } from "react-native";
import { theme } from "../theme";

export function StatusPill({ value }: { value: string }) {
  return <Text style={styles.pill}>{value.replaceAll("_", " ")}</Text>;
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF1EA",
    color: theme.black,
    fontWeight: "900",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: "hidden",
    marginVertical: 4,
  },
});
