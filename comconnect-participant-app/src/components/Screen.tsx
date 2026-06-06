import type { ReactNode } from "react";
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { theme } from "../theme";

export function Screen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { width, height } = useWindowDimensions();

  const isSmallPhone = width < 380;
  const isShortScreen = height < 720;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.scrollContent,
          isSmallPhone ? styles.scrollContentSmall : null,
          isShortScreen ? styles.scrollContentShort : null,
        ]}
      >
        <View style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>ComConnect</Text>

            <Text
              style={[
                styles.title,
                isSmallPhone ? styles.titleSmall : null,
              ]}
            >
              {title}
            </Text>

            {subtitle ? (
              <Text
                style={[
                  styles.subtitle,
                  isSmallPhone ? styles.subtitleSmall : null,
                ]}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>

          <View style={styles.body}>{children}</View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.softBg,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: Platform.OS === "android" ? 96 : 72,
  },

  scrollContentSmall: {
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === "android" ? 104 : 80,
  },

  scrollContentShort: {
    paddingBottom: Platform.OS === "android" ? 120 : 96,
  },

  page: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },

  header: {
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: theme.border ?? "#E2E8F0",
    shadowColor: theme.shadow ?? theme.black,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  eyebrow: {
    color: theme.orange,
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 5,
  },

  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    color: theme.black,
  },

  titleSmall: {
    fontSize: 24,
    lineHeight: 29,
  },

  subtitle: {
    marginTop: 6,
    color: theme.muted,
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 21,
  },

  subtitleSmall: {
    fontSize: 14,
    lineHeight: 20,
  },

  body: {
    gap: 12,
  },
});