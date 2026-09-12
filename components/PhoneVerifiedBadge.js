import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

/** True for boolean true / 1 / "1". */
export function isPhoneVerifiedFlag(value) {
  return value === true || value === 1 || value === "1";
}

/** Resolve phone_verified from flattened or personal_info API shapes. */
export function resolvePhoneVerified(userOrPersonalInfo) {
  if (!userOrPersonalInfo || typeof userOrPersonalInfo !== "object") return false;
  if (isPhoneVerifiedFlag(userOrPersonalInfo.phoneVerified)) return true;
  if (isPhoneVerifiedFlag(userOrPersonalInfo.phone_verified)) return true;
  const pi = userOrPersonalInfo.personal_info;
  if (pi && typeof pi === "object") {
    if (isPhoneVerifiedFlag(pi.phone_verified)) return true;
    if (isPhoneVerifiedFlag(pi.phoneVerified)) return true;
  }
  return false;
}

/**
 * Green verified checkmark shown next to a phone number when verified.
 * Use `showLabel` for settings/edit status rows; MiniCard uses icon-only.
 */
export default function PhoneVerifiedBadge({ size = 15, showLabel = false, style }) {
  return (
    <View style={[styles.wrap, style]} accessibilityLabel='Verified phone number'>
      <MaterialIcons name='verified' size={size} color='#2e7d32' />
      {showLabel ? <Text style={styles.label}>Verified</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2e7d32",
  },
});
