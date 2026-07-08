import React from "react";
import { View, Text, StyleSheet } from "react-native";

/** 💰 with a slash — used when an item has no bounty. */
export default function NoBountyIcon({ darkMode = false, muted = false, size = "default" }) {
  const isCompact = size === "compact";
  return (
    <View
      style={[
        styles.wrap,
        isCompact && styles.wrapCompact,
        muted && styles.wrapMuted,
        darkMode && muted && styles.darkWrapMuted,
      ]}
      accessibilityLabel={muted ? "No products or bounty" : "No bounty"}
    >
      <Text style={[styles.emoji, isCompact && styles.emojiCompact]}>💰</Text>
      <View
        pointerEvents='none'
        style={[
          styles.slash,
          isCompact && styles.slashCompact,
          darkMode && !muted && styles.darkSlash,
          muted && styles.slashMuted,
          darkMode && muted && styles.darkSlashMuted,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 24,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  wrapCompact: {
    width: 22,
    height: 20,
  },
  wrapMuted: {
    opacity: 0.48,
  },
  darkWrapMuted: {
    opacity: 0.42,
  },
  emoji: {
    fontSize: 20,
  },
  emojiCompact: {
    fontSize: 18,
  },
  slash: {
    position: "absolute",
    width: 26,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#1a1a1a",
    transform: [{ rotate: "-42deg" }],
  },
  slashCompact: {
    width: 24,
  },
  darkSlash: {
    backgroundColor: "#f0f0f0",
  },
  slashMuted: {
    backgroundColor: "#9e9e9e",
  },
  darkSlashMuted: {
    backgroundColor: "#757575",
  },
});
