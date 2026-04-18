import React, { useEffect, useRef } from "react";
import {
  Animated,
  TouchableOpacity,
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUnread } from "../contexts/UnreadContext";

const AUTO_DISMISS_MS = 6000;

/**
 * MessageNotificationBanner
 *
 * Reads `notification` directly from UnreadContext and renders an animated
 * slide-in banner at the top of the screen when a new chat message arrives
 * while the user is not in that conversation.
 *
 * Props:
 *   onOpen – (conversationUid, senderUid, senderName, senderImage) => void   navigate to chat
 */
export default function MessageNotificationBanner({ onOpen }) {
  const { notification, dismissNotification } = useUnread();
  const translateY = useRef(new Animated.Value(-120)).current;
  const timerRef   = useRef(null);

  const slideIn = () => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  };

  const slideOut = (cb) => {
    Animated.timing(translateY, {
      toValue: -120,
      duration: 300,
      useNativeDriver: true,
    }).start(cb);
  };

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    slideOut(() => dismissNotification());
  };

  useEffect(() => {
    if (!notification) return;
    translateY.setValue(-120);
    slideIn();
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification]);

  if (!notification) return null;

  const initials = (notification.senderName || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }] },
        Platform.OS === "web" && styles.containerWeb,
      ]}
    >
      <View style={styles.inner}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {notification.senderImage ? (
            <Image source={{ uri: notification.senderImage }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.badge}>
            <Ionicons name="chatbubble-ellipses" size={9} color="#fff" />
          </View>
        </View>

        {/* Name + body preview */}
        <TouchableOpacity
          style={styles.textWrap}
          onPress={() => {
            dismiss();
            onOpen &&
              onOpen(
                notification.conversationUid,
                notification.senderUid,
                notification.senderName,
                notification.senderImage
              );
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.title} numberOfLines={1}>
            {notification.senderName}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {notification.body}
          </Text>
        </TouchableOpacity>

        {/* Reply button */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.replyBtn]}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={() => {
            dismiss();
            onOpen &&
              onOpen(
                notification.conversationUid,
                notification.senderUid,
                notification.senderName,
                notification.senderImage
              );
          }}
        >
          <Ionicons name="arrow-undo-outline" size={16} color="#fff" />
        </TouchableOpacity>

        {/* Dismiss */}
        <TouchableOpacity
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={dismiss}
        >
          <Ionicons name="close" size={18} color="#bbb" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 20,
  },
  containerWeb: {
    top: 20,
    maxWidth: 440,
    alignSelf: "center",
    left: "auto",
    right: "auto",
    width: "90%",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    gap: 10,
  },
  avatarWrap: { position: "relative" },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: {
    backgroundColor: "#AF52DE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  badge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#AF52DE",
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  textWrap: { flex: 1 },
  title: { fontWeight: "700", fontSize: 14, color: "#111", marginBottom: 2 },
  subtitle: { fontSize: 12, color: "#666" },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  replyBtn: {
    backgroundColor: "#AF52DE",
  },
});
