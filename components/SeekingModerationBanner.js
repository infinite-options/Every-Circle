import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getSeekingModerationOwnerMessage,
  getSeekingModerationStatus,
  getSeekingModerationStatusLabel,
  isSeekingModeratedBlocked,
  MODERATION_STATUS,
} from "../utils/seekingModeration";

const SeekingModerationBanner = ({ item, darkMode = false, compact = false }) => {
  if (!item || !isSeekingModeratedBlocked(item)) return null;

  const status = getSeekingModerationStatus(item);
  const message = getSeekingModerationOwnerMessage(item);
  const isPending = status === MODERATION_STATUS.PENDING_REVIEW;
  const isRejected = status === MODERATION_STATUS.REJECTED;
  const isAcknowledged = status === MODERATION_STATUS.ACKNOWLEDGED;
  const isTakenDown = status === MODERATION_STATUS.TAKEN_DOWN || (!isPending && !isRejected && !isAcknowledged);

  return (
    <View
      style={[
        styles.banner,
        compact && styles.bannerCompact,
        isPending && styles.bannerPending,
        isRejected && styles.bannerRejected,
        isAcknowledged && styles.bannerAcknowledged,
        isTakenDown && !isRejected && !isAcknowledged && styles.bannerTakenDown,
        darkMode && styles.bannerDark,
      ]}
    >
      <View style={styles.headerRow}>
        <Ionicons
          name={isPending ? "hourglass-outline" : isAcknowledged ? "checkmark-circle-outline" : isRejected ? "close-circle-outline" : "warning-outline"}
          size={compact ? 14 : 16}
          color={isPending ? "#B45309" : isAcknowledged ? "#2E7D32" : "#B71C1C"}
          style={{ marginRight: 6 }}
        />
        <Text
          style={[
            styles.title,
            compact && styles.titleCompact,
            isAcknowledged && styles.titleAcknowledged,
            darkMode && styles.titleDark,
            isAcknowledged && darkMode && styles.titleAcknowledgedDark,
          ]}
        >
          {getSeekingModerationStatusLabel(item)}
        </Text>
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
  bannerAcknowledged: {
    backgroundColor: "#F1F8F4",
    borderColor: "#A5D6A7",
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
  titleAcknowledged: {
    color: "#2E7D32",
  },
  titleDark: {
    color: "#ff8a80",
  },
  titleAcknowledgedDark: {
    color: "#81C784",
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

export default SeekingModerationBanner;
