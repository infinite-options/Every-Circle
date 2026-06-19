import React from "react";
import { Text, StyleSheet } from "react-native";

const TAG_SECTION_SUFFIX = " (comma separated) (Optional)";

/** Section title with a normal-weight suffix, e.g. "Custom Tags (comma separated) (Optional)". */
export default function TagSectionLabel({ title, style, suffixStyle, darkMode = false }) {
  return (
    <Text style={style}>
      {title}
      <Text style={[styles.suffix, darkMode && styles.darkSuffix, suffixStyle]}>{TAG_SECTION_SUFFIX}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  suffix: {
    fontWeight: "normal",
    color: "#666",
  },
  darkSuffix: {
    color: "#aaa",
  },
});
