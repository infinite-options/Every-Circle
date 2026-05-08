import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  SafeAreaView,
  RefreshControl,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../components/AppHeader";
import BottomNavBar from "../components/BottomNavBar";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useUnread } from "../contexts/UnreadContext";
import { CHAT_CONVERSATIONS_ENDPOINT } from "../apiConfig";
import { getSessionProfile } from "../utils/sessionProfile";

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString.replace(" ", "T") + "Z");
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getInitials(firstName, lastName) {
  const f = (firstName || "").charAt(0).toUpperCase();
  const l = (lastName || "").charAt(0).toUpperCase();
  return (f + l) || "?";
}

// ─── component ───────────────────────────────────────────────────────────────

export default function InboxScreen() {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();
  const { clearUnread, enterChatView, leaveChatView } = useUnread();

  const [myUid, setMyUid] = useState(null);
  const [myBusinessUids, setMyBusinessUids] = useState(null); // null = not yet loaded
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Load the logged-in user's profile UID, then fetch their owned business UIDs
  // directly from the profile API (the 110- path always returns business_info correctly)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await getSessionProfile();
      if (cancelled || !session?.profileUid) return;
      setMyUid(session.profileUid);
      setMyBusinessUids(session.businessUids || []);
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchConversations = useCallback(
    async (silent = false) => {
      if (!myUid || myBusinessUids === null) return; // wait until both are ready
      if (!silent) setLoading(true);
      setError(null);
      try {
        // Fetch personal conversations + one fetch per owned business UID
        const uidsToFetch = [myUid, ...myBusinessUids];
        const results = await Promise.all(
          uidsToFetch.map((uid) =>
            fetch(`${CHAT_CONVERSATIONS_ENDPOINT}/${uid}`)
              .then((r) => r.json())
              .then((j) => j.result || [])
              .catch(() => [])
          )
        );
        // Merge and deduplicate by conversation_uid
        const merged = Object.values(
          results.flat().reduce((acc, conv) => {
            if (!acc[conv.conversation_uid]) acc[conv.conversation_uid] = conv;
            return acc;
          }, {})
        );
        // Sort newest-first
        merged.sort((a, b) => {
          const ta = new Date(a.last_sent_at || a.last_message_at || 0);
          const tb = new Date(b.last_sent_at || b.last_message_at || 0);
          return tb - ta;
        });
        setConversations(merged);
      } catch (e) {
        setError("Could not load conversations.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [myUid, myBusinessUids]
  );

  // Re-run fetchConversations once both myUid and myBusinessUids are ready
  // (handles the case where screen is already focused when they load)
  useEffect(() => {
    if (myUid && myBusinessUids !== null) {
      fetchConversations();
    }
  }, [myUid, myBusinessUids]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload whenever the screen gains focus, clear the dot, and suppress banners
  useFocusEffect(
    useCallback(() => {
      fetchConversations();
      clearUnread();
      enterChatView();
      return () => leaveChatView();
    }, [fetchConversations, clearUnread, enterChatView, leaveChatView])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations(true);
  };

  const openChat = (conv) => {
    // Determine which UID the current user is in this conversation
    // (may be one of their owned business UIDs instead of their personal UID)
    const senderUid =
      myBusinessUids.includes(conv.my_uid) ? conv.my_uid : myUid;
    navigation.navigate("Chat", {
      conversation_uid: conv.conversation_uid,
      other_uid: conv.other_uid,
      other_name: `${conv.first_name || ""} ${conv.last_name || ""}`.trim() || "Chat",
      other_image: conv.image || null,
      my_uid_override: senderUid !== myUid ? senderUid : undefined,
    });
  };

  // ─── render helpers ───────────────────────────────────────────────────────

  const renderItem = ({ item }) => {
    const name = `${item.first_name || ""} ${item.last_name || ""}`.trim() || "Unknown";
    const initials = getInitials(item.first_name, item.last_name);
    const preview = item.last_message || "No messages yet";
    const time = formatRelativeTime(item.last_sent_at || item.last_message_at);

    return (
      <TouchableOpacity
        style={[styles.row, darkMode && styles.rowDark]}
        onPress={() => openChat(item)}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
        </View>

        {/* Text block */}
        <View style={styles.textBlock}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, darkMode && styles.nameDark]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.time, darkMode && styles.timeDark]}>{time}</Text>
          </View>
          <Text style={[styles.preview, darkMode && styles.previewDark]} numberOfLines={1}>
            {preview}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const EmptyState = () => (
    <View style={styles.empty}>
      <Ionicons name="chatbubbles-outline" size={56} color={darkMode ? "#555" : "#767676"} />
      <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No conversations yet</Text>
      <Text style={[styles.emptySubText, darkMode && styles.emptySubTextDark]}>
        Navigate to someone's profile and start a chat
      </Text>
    </View>
  );

  // ─── layout ───────────────────────────────────────────────────────────────s

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.containerDark]}>
      <AppHeader
        title="MESSAGES"
        backgroundColor="#AF52DE"
        onBackPress={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#AF52DE" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, darkMode && styles.errorTextDark]}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchConversations()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.conversation_uid}
          renderItem={renderItem}
          ListEmptyComponent={<EmptyState />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#AF52DE"
              colors={["#AF52DE"]}
            />
          }
          contentContainerStyle={[
            conversations.length === 0 ? styles.emptyContainer : null,
            styles.listContent,
          ]}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, darkMode && styles.separatorDark]} />
          )}
        />
      )}
      <BottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const PURPLE = "#AF52DE";
const AVATAR_SIZE = 48;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  containerDark: { backgroundColor: "#121212" },

  listContent: { paddingBottom: 120 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },

  // List row
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  rowDark: { backgroundColor: "#121212" },

  separator: { height: 1, backgroundColor: "#f0f0f0", marginLeft: 80 },
  separatorDark: { backgroundColor: "#2a2a2a" },

  // Avatar
  avatarWrap: { marginRight: 12 },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarFallback: {
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  // Text
  textBlock: { flex: 1 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  name: { fontSize: 15, fontWeight: "600", color: "#222", flex: 1, marginRight: 8 },
  nameDark: { color: "#fff" },
  time: { fontSize: 12, color: "#999" },
  timeDark: { color: "#666" },
  preview: { fontSize: 13, color: "#666" },
  previewDark: { color: "#aaa" },

  // Empty state
  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: { marginTop: 16, fontSize: 17, fontWeight: "600", color: "#555" },
  emptyTextDark: { color: "#aaa" },
  emptySubText: { marginTop: 8, fontSize: 13, color: "#4d4d4d", textAlign: "center" },
  emptySubTextDark: { color: "#666" },

  // Error
  errorText: { fontSize: 15, color: "#555", textAlign: "center", marginBottom: 16 },
  errorTextDark: { color: "#aaa" },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: PURPLE,
    borderRadius: 8,
  },
  retryBtnText: { color: "#fff", fontWeight: "600" },
});
