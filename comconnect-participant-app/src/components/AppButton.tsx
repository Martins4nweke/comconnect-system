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
    minHeight: 50,
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.border ?? "#E2E8F0",
    marginVertical: 5,
    shadowColor: theme.shadow ?? theme.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },

  primary: {
    backgroundColor: theme.orange,
    borderColor: theme.orange,
  },

  secondary: {
    backgroundColor: theme.white,
    borderColor: theme.border ?? "#E2E8F0",
  },

  danger: {
    backgroundColor: theme.red,
    borderColor: theme.red,
  },

  disabled: {
    opacity: 0.55,
  },

  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },

  text: {
    fontWeight: "900",
    color: theme.white,
    fontSize: 15,
    lineHeight: 19,
    textAlign: "center",
  },

  secondaryText: {
    color: theme.black,
  },
});