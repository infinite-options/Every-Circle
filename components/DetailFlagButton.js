import React from "react";
import { TouchableOpacity, Text, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDarkMode } from "../contexts/DarkModeContext";
import { getHeaderColor, getDarkModeHeaderColor } from "../config/headerColors";

/** Maroon detail action — matches Your Profile header (`headerColors.profile`). */
export default function DetailFlagButton({
  onPress,
  style,
  disabled = false,
  label = "Flag",
  icon = "flag-outline",
}) {
  const { darkMode } = useDarkMode();
  const backgroundColor = darkMode ? getDarkModeHeaderColor("profile") : getHeaderColor("profile");

  const handlePress =
    onPress ||
    (() => {
      Alert.alert("Flag", "Thank you for your report. Our team will review this listing.");
    });

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor }, disabled && styles.disabled, style]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole='button'
      accessibilityLabel={label}
    >
      {icon ? <Ionicons name={icon} size={17} color='#fff' style={styles.icon} /> : null}
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export const detailActionRowStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 4,
  marginBottom: 20,
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 24,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  disabled: {
    opacity: 0.45,
  },
});
