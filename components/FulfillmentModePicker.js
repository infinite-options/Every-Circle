import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { parseListingModeFlags, toggleListingModeFlags } from "../utils/listingFulfillmentMode";

const MODE_OPTIONS = [
  { key: "virtual", label: "Virtual" },
  { key: "delivered", label: "Delivered" },
  { key: "inPerson", label: "In-Person" },
];

function hexToRgb(hex) {
  const normalized = String(hex || "").replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const num = parseInt(expanded, 16);
  if (Number.isNaN(num)) return { r: 156, g: 69, b: 247 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/**
 * Virtual / Delivered / In-Person toggles — shared by offerings and business products.
 */
export default function FulfillmentModePicker({
  modeStr = "",
  onChange,
  darkMode = false,
  required = false,
  highlight = false,
  accentColor = "#9C45F7",
  accentDarkColor = "#7a35c4",
}) {
  const flags = parseListingModeFlags(modeStr);
  const accent = darkMode ? accentDarkColor : accentColor;
  const { r, g, b } = hexToRgb(accentColor);
  const activeBg = darkMode ? `rgba(${r}, ${g}, ${b}, 0.22)` : `rgba(${r}, ${g}, ${b}, 0.12)`;
  const activeTextDark = darkMode ? "#C98AEF" : accent;

  return (
    <View>
      <Text style={[styles.label, darkMode && styles.labelDark]}>
        Mode{required ? " *" : ""}
      </Text>
      <View style={styles.row}>
        {MODE_OPTIONS.map((option) => {
          const active = !!flags[option.key];
          return (
            <Pressable
              key={option.key}
              style={[
                styles.btn,
                darkMode && styles.btnDark,
                active && { borderColor: accent, backgroundColor: activeBg },
                highlight && !active && styles.btnHighlight,
              ]}
              onPress={(e) => {
                if (Platform.OS === "web") {
                  e?.preventDefault?.();
                  e?.stopPropagation?.();
                }
                onChange?.(toggleListingModeFlags(modeStr, option.key));
              }}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.btnText,
                  darkMode && styles.btnTextDark,
                  active && { color: accent, fontWeight: "700" },
                  darkMode && active && { color: activeTextDark, fontWeight: "700" },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  labelDark: {
    color: "#d1d5db",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    width: "100%",
  },
  btn: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 96,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
  },
  btnDark: {
    backgroundColor: "#2d2d2d",
    borderColor: "#555",
  },
  btnHighlight: {
    borderColor: "#FF3B30",
    borderWidth: 2,
  },
  btnText: {
    fontSize: 13,
    color: "#555",
    fontWeight: "500",
  },
  btnTextDark: {
    color: "#ccc",
  },
});
