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

const AUTO_DISMISS_MS = 10000;

/**
 * NearbyAlertBanner
 *
 * Props:
 *   alert     – { sender_uid, sender_name, sender_image, distance_miles } | null
 *   onDismiss – () => void
 *   onPress   – (sender_uid) => void   navigate to profile
 *   onChat    – (sender_uid, sender_name) => void   open chat
 */
export default function NearbyAlertBanner({ alert, onDismiss, onPress, onChat, onIgnore }) {
  const translateY = useRef(new Animated.Value(-140)).current;
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
      toValue: -140,
      duration: 300,
      useNativeDriver: true,
    }).start(cb);
  };

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    slideOut(() => onDismiss && onDismiss());
  };

  useEffect(() => {
    if (!alert) return;
    translateY.setValue(-140);
    slideIn();
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [alert]);

  if (!alert) return null;

  const initials = (alert.sender_name || "?")
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
          {alert.sender_image ? (
            <Image source={{ uri: alert.sender_image }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.badge}>
            <Ionicons name="location" size={10} color="#fff" />
          </View>
        </View>

        {/* Name + distance */}
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {alert.sender_name} is nearby
          </Text>
          <Text style={styles.subtitle}>~{alert.distance_miles} mi away</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {/* View profile */}
          <TouchableOpacity
            style={styles.actionBtn}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            onPress={() => {
              dismiss();
              onPress && onPress(alert.sender_uid);
            }}
          >
            <Ionicons name="person-outline" size={17} color="#4B2E83" />
          </TouchableOpacity>

          {/* Open chat */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.chatBtn]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            onPress={() => {
              dismiss();
              onChat && onChat(alert.sender_uid, alert.sender_name);
            }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={17} color="#fff" />
          </TouchableOpacity>

          {/* Ignore for this session */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.ignoreBtn]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            onPress={() => {
              dismiss();
              onIgnore && onIgnore(alert.sender_uid);
            }}
          >
            <Ionicons name="eye-off-outline" size={17} color="#fff" />
          </TouchableOpacity>

          {/* Dismiss */}
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={dismiss}
          >
            <Ionicons name="close" size={18} color="#bbb" />
          </TouchableOpacity>
        </View>
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
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    backgroundColor: "#4B2E83",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  badge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#4B2E83",
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

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#4B2E83",
    alignItems: "center",
    justifyContent: "center",
  },
  chatBtn: {
    backgroundColor: "#AF52DE",
    borderColor: "#AF52DE",
  },
  ignoreBtn: {
    backgroundColor: "#e57373",
    borderColor: "#e57373",
  },
});
