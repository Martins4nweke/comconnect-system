import { Pressable, StyleSheet, Text } from "react-native";
import { theme } from "../theme";

export function AppButton({
  label,
  onPress,
  disabled,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "danger" && styles.danger,
        disabled && styles.disabled,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === "secondary" && styles.secondaryText,
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    minHeight: 48,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: theme.black,
    marginVertical: 5,
  },

  primary: {
    backgroundColor: theme.orange,
  },

  secondary: {
    backgroundColor: theme.white,
  },

  danger: {
    backgroundColor: theme.red,
  },

  disabled: {
    opacity: 0.5,
  },

  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  text: {
    fontWeight: "900",
    color: theme.black,
    fontSize: 15,
    lineHeight: 19,
    textAlign: "center",
  },

  secondaryText: {
    color: theme.black,
  },
});