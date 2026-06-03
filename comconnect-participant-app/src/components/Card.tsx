import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

export function Card({
  title,
  subtitle,
  tag,
  onPress,
  showOpen = true,
  highlight = false,
  highlightText,
}: {
  title: string;
  subtitle?: string | null;
  tag?: string | null;
  onPress?: () => void;
  showOpen?: boolean;
  highlight?: boolean;
  highlightText?: string | null;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        highlight && styles.highlightCard,
        onPress ? styles.pressable : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={3}>
          {title}
        </Text>

        <View style={styles.badges}>
          {highlight && highlightText ? (
            <Text style={styles.highlightBadge}>
              {highlightText}
            </Text>
          ) : null}

          {tag ? (
            <Text style={styles.tag} numberOfLines={1}>
              {tag}
            </Text>
          ) : null}
        </View>
      </View>

      {subtitle ? (
        <Text style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}

      {onPress && showOpen ? (
        <Text style={styles.open}>Open →</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.white,
    borderWidth: 1.5,
    borderColor: theme.black,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    shadowColor: theme.black,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.7,
    shadowRadius: 0,
    elevation: 2,
  },

  highlightCard: {
    borderColor: "#16A34A",
    borderWidth: 2.5,
  },

  pressable: {
    cursor: "pointer" as any,
  },

  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },

  badges: {
    alignItems: "flex-end",
    gap: 4,
  },

  title: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    color: theme.black,
    flex: 1,
  },

  subtitle: {
    marginTop: 6,
    color: theme.muted,
    fontWeight: "600",
    fontSize: 14,
    lineHeight: 20,
  },

  tag: {
    maxWidth: 110,
    backgroundColor: theme.orange,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    color: theme.black,
    overflow: "hidden",
    textTransform: "uppercase",
  },

  highlightBadge: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    textTransform: "uppercase",
  },

  open: {
    marginTop: 9,
    color: theme.orange,
    fontWeight: "900",
    fontSize: 14,
  },
});