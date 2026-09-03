import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Notification banner shown at the top of Profile (owner view only) when one or
 * more of the profile's offerings has a response the owner hasn't seen yet.
 * Tapping it scrolls to the relevant offering; the X dismisses it for this visit.
 */
const OfferingResponseNotificationBanner = ({ offeringCount = 0, onPress, onDismiss, darkMode = false }) => {
  if (!offeringCount) return null;

  const message =
    offeringCount === 1 ? "One of your offerings has a new response" : `${offeringCount} of your offerings have new responses`;

  return (
    <TouchableOpacity
      style={[styles.banner, darkMode && styles.bannerDark]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={styles.iconWrap}>
        <Ionicons name='chatbubble-ellipses' size={16} color='#fff' />
      </View>
      <Text style={[styles.message, darkMode && styles.messageDark]} numberOfLines={2}>
        {message}
      </Text>
      <TouchableOpacity
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={(e) => {
          e?.stopPropagation?.();
          onDismiss && onDismiss();
        }}
      >
        <Ionicons name='close' size={18} color={darkMode ? "#bbb" : "#999"} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5EBFC",
    borderColor: "#AF52DE",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    gap: 10,
  },
  bannerDark: {
    backgroundColor: "#3a2d47",
    borderColor: "#8e3fc9",
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#AF52DE",
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#5B2A82",
  },
  messageDark: {
    color: "#E4C9FA",
  },
});

export default OfferingResponseNotificationBanner;
