import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Keyboard,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../components/AppHeader";
import BottomNavBar from "../components/BottomNavBar";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useUnread } from "../contexts/UnreadContext";
import { CHAT_CONVERSATIONS_ENDPOINT, CHAT_MESSAGES_ENDPOINT } from "../apiConfig";
import { createAblyRealtimeClient } from "../utils/ablyClient";

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString.replace(" ", "T") + "Z");
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function sameDay(a, b) {
  const da = new Date(a.replace(" ", "T") + "Z");
  const db = new Date(b.replace(" ", "T") + "Z");
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function formatDayLabel(isoString) {
  const d = new Date(isoString.replace(" ", "T") + "Z");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (sameDay(isoString, today.toISOString())) return "Today";
  if (sameDay(isoString, yesterday.toISOString())) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

// ─── component ───────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { darkMode } = useDarkMode();
  const { setActiveChat, clearActiveChat, clearUnread, enterChatView, leaveChatView } = useUnread();
  const insets = useSafeAreaInsets();
  // BottomNavBar content height (paddingTop 6 + icon 28 + marginBottom 2 + paddingVertical 4×2 + border 1)
  // plus the device's bottom safe-area inset that the navbar's own SafeAreaView also adds.
  const NAV_BAR_HEIGHT = 45 + insets.bottom;
  /** Extra space above keyboard so the composer fully clears the IME (reported height is often slightly low). */
  const KEYBOARD_COMPOSER_EXTRA_PAD = 20;

  // Params — either pass an existing conversation_uid or just other_uid to create one.
  // my_uid_override is set when a business owner opens a conversation as their business entity.
  const {
    conversation_uid: initialConvUid,
    other_uid,
    other_name: paramOtherName,
    other_image: paramOtherImage,
    my_uid_override,
  } = route.params || {};

  const [myUid, setMyUid] = useState(null);
  const [convUid, setConvUid] = useState(initialConvUid || null);
  const [otherName, setOtherName] = useState(paramOtherName || "Chat");
  const [otherImage, setOtherImage] = useState(paramOtherImage || null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);

  const flatListRef = useRef(null);
  const ablyClientRef = useRef(null);
  const ablyChannelRef = useRef(null);
  const ablyMessageHandlerRef = useRef(null);
  // Keep a live ref to myUid so Ably callbacks can read it without stale closure
  const myUidRef = useRef(null);

  // ─── bootstrap ──────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      // If coming from InboxScreen as a business owner, use the override UID
      const uid = my_uid_override || await AsyncStorage.getItem("profile_uid");
      setMyUid(uid);
      myUidRef.current = uid;
    })();
  }, []);

  // Once we have myUid, ensure a conversation exists
  useEffect(() => {
    if (!myUid) return;
    if (!other_uid && !convUid) {
      setError("No chat target specified.");
      setLoading(false);
      return;
    }
    if (convUid) {
      // Already have conversation_uid — just load messages
      loadMessages(convUid);
    } else {
      // Need to create / fetch conversation first
      createOrGetConversation();
    }
  }, [myUid]);

  const createOrGetConversation = async () => {
    try {
      const res = await fetch(CHAT_CONVERSATIONS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid_a: myUid, uid_b: other_uid }),
      });
      const json = await res.json();
      const cid = json.conversation_uid;
      setConvUid(cid);
      await loadMessages(cid);
    } catch (e) {
      setError("Could not open conversation.");
      setLoading(false);
    }
  };

  const loadMessages = async (cid) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${CHAT_MESSAGES_ENDPOINT}/${cid}`);
      const json = await res.json();
      setMessages(json.result || []);
    } catch (e) {
      setError("Could not load messages.");
    } finally {
      setLoading(false);
    }
  };

  // Tell UnreadContext we're on a chat screen so it suppresses both the banner
  // and the unread dot for this specific conversation.
  useEffect(() => {
    enterChatView();
    return () => leaveChatView();
  }, []);

  useEffect(() => {
    if (!convUid) return;
    setActiveChat(convUid);
    clearUnread(); // user is actively reading — clear the unread dot
    return () => clearActiveChat();
  }, [convUid]);

  // Subscribe to real-time messages once convUid and myUid are both ready.
  // This avoids creating a shared Ably client with a fallback ID ("chat-client"),
  // which can force a disconnect/recreate cycle for other screens.
  useEffect(() => {
    if (!convUid || !myUid) return;
    subscribeAbly(convUid);
    return () => unsubscribeAbly();
  }, [convUid, myUid]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e) => {
      const h = e?.endCoordinates?.height;
      if (typeof h === "number" && h > 0) setKeyboardBottomInset(h);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
    };
    const onHide = () => setKeyboardBottomInset(0);
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  // ─── ably ────────────────────────────────────────────────────────────────

  const subscribeAbly = useCallback((cid) => {
    try {
      // Old key-based auth (kept for reference):
      // let Ably;
      // if (Platform.OS === "web" && typeof window !== "undefined" && window.Ably) {
      //   Ably = window.Ably;
      // } else {
      //   Ably = require("ably");
      // }
      // const apiKey =
      //   Constants.expoConfig?.extra?.ablyApiKey ||
      //   process.env.EXPO_PUBLIC_ABLY_API_KEY ||
      //   EXPO_PUBLIC_ABLY_API_KEY ||
      //   "";
      // if (!apiKey) return;
      // const client = new Ably.Realtime({ key: apiKey });
      const stableClientId = myUidRef.current || myUid;
      if (!stableClientId) return;
      const client = createAblyRealtimeClient(stableClientId);
      ablyClientRef.current = client;

      // Subscribe directly — Ably queues messages until the connection is ready,
      // so we don't need to wait for the "connected" event.
      const channel = client.channels.get(`chat::${cid}`);
      ablyChannelRef.current = channel;
      const handler = (msg) => {
        const data = msg.data || {};
        // Skip messages we sent ourselves — already in state via optimistic UI
        if (data.sender_uid === myUidRef.current) return;
        setMessages((prev) => {
          if (prev.some((m) => m.message_uid === data.message_uid)) return prev;
          return [...prev, { ...data }];
        });
      };
      ablyMessageHandlerRef.current = handler;
      channel.subscribe("new-message", handler);
    } catch (e) {
      console.warn("ChatScreen Ably error:", e);
    }
  }, []);

  const unsubscribeAbly = useCallback(() => {
    try {
      if (ablyChannelRef.current && ablyMessageHandlerRef.current) {
        ablyChannelRef.current.unsubscribe("new-message", ablyMessageHandlerRef.current);
      } else {
        ablyChannelRef.current?.unsubscribe();
      }
      // Do not close shared client here; other screens reuse it.
    } catch (_) {}
    ablyChannelRef.current = null;
    ablyClientRef.current = null;
    ablyMessageHandlerRef.current = null;
  }, []);

  // ─── send ────────────────────────────────────────────────────────────────

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || !convUid || !myUid || sending) return;

    const optimistic = {
      message_uid: `optimistic-${Date.now()}`,
      conversation_uid: convUid,
      sender_uid: myUid,
      body: text,
      sent_at: new Date().toISOString().replace("T", " ").slice(0, 19),
    };

    setInputText("");
    setSending(true);
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(CHAT_MESSAGES_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_uid: convUid,
          sender_uid: myUid,
          body: text,
        }),
      });
      const json = await res.json();
      // Replace optimistic with confirmed, removing any duplicate that Ably may have added
      setMessages((prev) => {
        const confirmed = { ...optimistic, message_uid: json.message_uid, sent_at: json.sent_at };
        const without = prev.filter(
          (m) => m.message_uid !== optimistic.message_uid && m.message_uid !== json.message_uid
        );
        return [...without, confirmed];
      });
    } catch (e) {
      // Remove optimistic on failure
      setMessages((prev) => prev.filter((m) => m.message_uid !== optimistic.message_uid));
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  // ─── render helpers ───────────────────────────────────────────────────────

  const renderMessage = ({ item, index }) => {
    const isMine = item.sender_uid === myUid;
    const showDayLabel =
      index === 0 ||
      !sameDay(messages[index - 1].sent_at, item.sent_at);

    return (
      <>
        {showDayLabel && (
          <View style={styles.dayLabelWrap}>
            <Text style={[styles.dayLabel, darkMode && styles.dayLabelDark]}>
              {formatDayLabel(item.sent_at)}
            </Text>
          </View>
        )}
        <View style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowTheirs]}>
          <View
            style={[
              styles.bubble,
              isMine
                ? styles.bubbleMine
                : [styles.bubbleTheirs, darkMode && styles.bubbleTheirsDark],
            ]}
          >
            <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : darkMode && styles.bubbleTextDark]}>
              {item.body}
            </Text>
          </View>
          <Text style={[styles.msgTime, isMine ? styles.msgTimeMine : darkMode && styles.msgTimeDark]}>
            {formatTime(item.sent_at)}
          </Text>
        </View>
      </>
    );
  };

  // ─── layout ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView edges={["top"]} style={[styles.container, darkMode && styles.containerDark]}>
      <AppHeader
        title={otherName}
        backgroundColor="#AF52DE"
        onBackPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate("Network");
          }
        }}
        rightButton={
          other_uid ? (
            <TouchableOpacity
              onPress={() => navigation.navigate("Profile", { profile_uid: other_uid })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="person-circle-outline" size={26} color="#fff" />
            </TouchableOpacity>
          ) : null
        }
      />

      {/*
        Do not wrap list + input in a full-screen KeyboardAvoidingView on iOS — it often collapses flex
        and hides the composer. Use minHeight:0 + flex list, and pad by keyboard height when open.
      */}
      <View
        style={{
          flex: 1,
          minHeight: 0,
          paddingBottom:
            keyboardBottomInset > 0 ? keyboardBottomInset + KEYBOARD_COMPOSER_EXTRA_PAD : NAV_BAR_HEIGHT,
        }}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#AF52DE" />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={[styles.errorText, darkMode && styles.errorTextDark]}>{error}</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            style={styles.messageListFlex}
            data={messages}
            keyExtractor={(item) => item.message_uid}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={48}
                  color={darkMode ? "#555" : "#ccc"}
                />
                <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>
                  No messages yet. Say hi!
                </Text>
              </View>
            }
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
          />
        )}

        <View style={[styles.inputBar, darkMode && styles.inputBarDark]}>
          <TextInput
            style={[styles.input, darkMode && styles.inputDark]}
            placeholder="Type a message..."
            placeholderTextColor={darkMode ? "#666" : "#aaa"}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
      <BottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const PURPLE = "#AF52DE";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  containerDark: { backgroundColor: "#121212" },
  /** Reserve space above absolute BottomNavBar */
  screenWithBottomNav: { paddingBottom: 88 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  messageListFlex: { flex: 1, minHeight: 0 },
  // Message list
  messageList: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 16, flexGrow: 1 },

  // Day labels
  dayLabelWrap: { alignItems: "center", marginVertical: 8 },
  dayLabel: {
    fontSize: 11,
    color: "#999",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: "hidden",
  },
  dayLabelDark: { backgroundColor: "#2a2a2a", color: "#666" },

  // Message rows
  msgRow: { marginBottom: 4, maxWidth: "80%" },
  msgRowMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  msgRowTheirs: { alignSelf: "flex-start", alignItems: "flex-start" },

  // Bubbles
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  bubbleMine: {
    backgroundColor: PURPLE,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: "#f0f0f0",
    borderBottomLeftRadius: 4,
  },
  bubbleTheirsDark: { backgroundColor: "#2a2a2a" },

  bubbleText: { fontSize: 15, color: "#222", lineHeight: 20 },
  bubbleTextMine: { color: "#fff" },
  bubbleTextDark: { color: "#eee" },

  // Time stamps
  msgTime: { fontSize: 10, color: "#bbb", marginTop: 2, marginHorizontal: 4 },
  msgTimeMine: { textAlign: "right" },
  msgTimeDark: { color: "#555" },

  // Empty messages
  emptyMessages: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyText: { marginTop: 12, fontSize: 14, color: "#aaa" },
  emptyTextDark: { color: "#555" },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fff",
  },
  inputBarDark: { backgroundColor: "#1e1e1e", borderTopColor: "#2a2a2a" },

  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: "#f5f5f5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    fontSize: 15,
    color: "#222",
    marginRight: 8,
  },
  inputDark: { backgroundColor: "#2a2a2a", color: "#eee" },

  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#ccc" },

  // Error
  errorText: { fontSize: 14, color: "#888", textAlign: "center" },
  errorTextDark: { color: "#666" },
});
