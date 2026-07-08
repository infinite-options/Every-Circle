import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getModerationOwnerMessage,
  getModerationStatus,
  getModerationStatusLabel,
  isOfferingModeratedBlocked,
  MODERATION_STATUS,
} from "../utils/offeringModeration";

const OfferingModerationBanner = ({ item, darkMode = false, compact = false }) => {
  if (!item || !isOfferingModeratedBlocked(item)) return null;

  const status = getModerationStatus(item);
  const message = getModerationOwnerMessage(item);
  const isPending = status === MODERATION_STATUS.PENDING_REVIEW;
  const isRejected = status === MODERATION_STATUS.REJECTED;
  const isTakenDown = status === MODERATION_STATUS.TAKEN_DOWN || (!isPending && !isRejected);

  return (
    <View
      style={[
        styles.banner,
        compact && styles.bannerCompact,
        isPending && styles.bannerPending,
        isRejected && styles.bannerRejected,
        isTakenDown && !isRejected && styles.bannerTakenDown,
        darkMode && styles.bannerDark,
      ]}
    >
      <View style={styles.headerRow}>
        <Ionicons
          name={isPending ? "hourglass-outline" : isRejected ? "close-circle-outline" : "warning-outline"}
          size={compact ? 14 : 16}
          color={isPending ? "#B45309" : "#B71C1C"}
          style={{ marginRight: 6 }}
        />
        <Text style={[styles.title, compact && styles.titleCompact, darkMode && styles.titleDark]}>{getModerationStatusLabel(item)}</Text>
      </View>
      {message ? <Text style={[styles.message, compact && styles.messageCompact, darkMode && styles.messageDark]}>{message}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#FFF5F5",
    borderColor: "#F5C6C6",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  bannerCompact: {
    padding: 8,
    marginBottom: 6,
  },
  bannerPending: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FCD34D",
  },
  bannerTakenDown: {
    backgroundColor: "#FFF5F5",
    borderColor: "#F5C6C6",
  },
  bannerRejected: {
    backgroundColor: "#FFF5F5",
    borderColor: "#E57373",
  },
  bannerDark: {
    backgroundColor: "#3a2a2a",
    borderColor: "#664444",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: "#B71C1C",
  },
  titleCompact: {
    fontSize: 12,
  },
  titleDark: {
    color: "#ff8a80",
  },
  message: {
    fontSize: 12,
    lineHeight: 17,
    color: "#555",
  },
  messageCompact: {
    fontSize: 11,
    lineHeight: 15,
  },
  messageDark: {
    color: "#ccc",
  },
});

export default OfferingModerationBanner;
