import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.orange} />
      <Text style={styles.text}>Loading ComConnect...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.softBg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  text: {
    marginTop: 12,
    color: theme.black,
    fontWeight: "900",
  },
});
