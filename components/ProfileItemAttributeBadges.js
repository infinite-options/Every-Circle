import React from "react";
import { View, Text, StyleSheet } from "react-native";

/** Pill badges for tax, shipping, returnable, qty — matches ProductCard attribute badges. */
export default function ProfileItemAttributeBadges({ badges, darkMode = false, style }) {
  if (!badges?.length) return null;

  const badgeStyle = [styles.badge, darkMode && styles.badgeDark];
  const labelStyle = [styles.label, darkMode && styles.labelDark];
  const valueStyle = [styles.value, darkMode && styles.valueDark];

  return (
    <View style={[styles.wrap, style]}>
      {badges.map((badge) => (
        <View key={badge.key} style={badgeStyle}>
          <Text style={labelStyle}>
            {badge.label}  <Text style={valueStyle}>{badge.value}</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    backgroundColor: "#f3f4f6",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  badgeDark: {
    backgroundColor: "#3a3a3c",
    borderColor: "#555",
  },
  label: {
    fontSize: 12,
    color: "#374151",
  },
  labelDark: {
    color: "#d1d5db",
  },
  value: {
    fontWeight: "700",
    color: "#111827",
  },
  valueDark: {
    color: "#f9fafb",
  },
});
