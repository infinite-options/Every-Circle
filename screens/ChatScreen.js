import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Keyboard, Platform } from "react-native";
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
import { normalizeMessageForUi, orderMessagesForChatList } from "../utils/chatConversations";

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString.replace(" ", "T") + "Z");
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function sameDay(a, b) {
  if (!a || !b) return false;
  const da = new Date(String(a).replace(" ", "T") + "Z");
  const db = new Date(String(b).replace(" ", "T") + "Z");
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function formatDayLabel(isoString) {
  if (!isoString) return "";
  const d = new Date(String(isoString).replace(" ", "T") + "Z");
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
  const { conversation_uid: initialConvUid, other_uid, other_name: paramOtherName, other_image: paramOtherImage, my_uid_override, reply_context } = route.params || {};

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
  const [pendingReplyContext, setPendingReplyContext] = useState(reply_context || null);

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
      const uid = my_uid_override || (await AsyncStorage.getItem("profile_uid"));
      setMyUid(uid);
      myUidRef.current = uid;
    })();
  }, [my_uid_override]);

  // Keep local chat state in sync if this screen instance is reused
  // with new navigation params (prevents stale conversation routing).
  useEffect(() => {
    setConvUid(initialConvUid || null);
    setOtherName(paramOtherName || "Chat");
    setOtherImage(paramOtherImage || null);
    setPendingReplyContext(reply_context || null);
    setMessages([]);
    setError(null);
    setLoading(true);
  }, [initialConvUid, other_uid, paramOtherName, paramOtherImage, reply_context]);

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
  }, [myUid, other_uid, convUid]);

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
      const res = await fetch(`${CHAT_MESSAGES_ENDPOINT}/${encodeURIComponent(cid)}`);
      const json = await res.json();
      const raw = Array.isArray(json.result) ? json.result : [];
      const mapped = raw.map(normalizeMessageForUi);
      setMessages(orderMessagesForChatList(mapped));
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
        const incoming = normalizeMessageForUi(data);
        const sid = incoming.message_sender_uid || incoming.sender_uid;
        if (sid === myUidRef.current) return;
        setMessages((prev) => {
          if (prev.some((m) => m.message_uid === incoming.message_uid)) return prev;
          return [...prev, incoming];
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

  const buildReplyBody = (text, context) => {
    if (!context?.label) return text;
    return `↪ ${context.label}\n${text}`;
  };

  const parseReplyBody = (rawBody) => {
    const body = typeof rawBody === "string" ? rawBody : String(rawBody || "");
    const match = body.match(/^↪\s+([^\n]+)\n([\s\S]*)$/);
    if (!match) return { isReply: false, contextLabel: null, text: body };
    return {
      isReply: true,
      contextLabel: match[1]?.trim() || null,
      text: match[2] ?? "",
    };
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || !convUid || !myUid || sending) return;
    const bodyToSend = buildReplyBody(text, pendingReplyContext);

    const sentStamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const optimistic = normalizeMessageForUi({
      message_uid: `optimistic-${Date.now()}`,
      message_conversation_id: convUid,
      message_sender_uid: myUid,
      message_body: bodyToSend,
      message_sent_at: sentStamp,
      message_read_at: null,
    });

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
          body: bodyToSend,
        }),
      });
      const json = await res.json();
      setMessages((prev) => {
        const confirmed = normalizeMessageForUi({
          ...optimistic,
          message_uid: json.message_uid ?? json.message?.message_uid,
          message_sent_at: json.sent_at ?? json.message_sent_at ?? optimistic.message_sent_at,
        });
        const mid = confirmed.message_uid;
        const without = prev.filter((m) => m.message_uid !== optimistic.message_uid && m.message_uid !== mid);
        return [...without, confirmed];
      });
      if (pendingReplyContext) {
        setPendingReplyContext(null);
      }
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
    const sender = item.message_sender_uid ?? item.sender_uid;
    const isMine = sender === myUid;
    const bodyText = item.message_body ?? item.body ?? "";
    const sentAt = item.message_sent_at ?? item.sent_at ?? "";
    const parsedBody = parseReplyBody(bodyText);
    const prevSent = index > 0 ? messages[index - 1].message_sent_at ?? messages[index - 1].sent_at : null;
    const showDayLabel = index === 0 || !sameDay(prevSent, sentAt);

    return (
      <>
        {showDayLabel && (
          <View style={styles.dayLabelWrap}>
            <Text style={[styles.dayLabel, darkMode && styles.dayLabelDark]}>{formatDayLabel(sentAt)}</Text>
          </View>
        )}
        <View style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowTheirs]}>
          <View style={[styles.bubble, parsedBody.isReply && styles.bubbleReply, isMine ? styles.bubbleMine : [styles.bubbleTheirs, darkMode && styles.bubbleTheirsDark]]}>
            {parsedBody.isReply && parsedBody.contextLabel ? (
              <View style={[styles.replyHeader, isMine ? styles.replyHeaderMine : styles.replyHeaderTheirs, !isMine && darkMode && styles.replyHeaderTheirsDark]}>
                <Text style={[styles.replyHeaderText, isMine ? styles.replyHeaderTextMine : styles.replyHeaderTextTheirs, !isMine && darkMode && styles.replyHeaderTextTheirsDark]} numberOfLines={2}>
                  {parsedBody.contextLabel}
                </Text>
              </View>
            ) : null}
            <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : darkMode && styles.bubbleTextDark]}>{parsedBody.text}</Text>
          </View>
          <Text style={[styles.msgTime, isMine ? styles.msgTimeMine : darkMode && styles.msgTimeDark]}>{formatTime(sentAt)}</Text>
        </View>
      </>
    );
  };

  // ─── layout ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView edges={["top"]} style={[styles.container, darkMode && styles.containerDark]}>
      <AppHeader
        title={otherName}
        backgroundColor='#AF52DE'
        onBackPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate("Network");
          }
        }}
        rightButton={
          other_uid ? (
            <TouchableOpacity onPress={() => navigation.navigate("Profile", { profile_uid: other_uid })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name='person-circle-outline' size={26} color='#fff' />
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
          paddingBottom: keyboardBottomInset > 0 ? keyboardBottomInset + KEYBOARD_COMPOSER_EXTRA_PAD : NAV_BAR_HEIGHT,
        }}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size='large' color='#AF52DE' />
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
            keyboardShouldPersistTaps='handled'
            keyboardDismissMode='on-drag'
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <Ionicons name='chatbubble-ellipses-outline' size={48} color={darkMode ? "#555" : "#ccc"} />
                <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No messages yet. Say hi!</Text>
              </View>
            }
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        <View style={[styles.inputBar, darkMode && styles.inputBarDark]}>
          {pendingReplyContext?.label ? (
            <View style={[styles.pendingReplyChip, darkMode && styles.pendingReplyChipDark]}>
              <Text style={[styles.pendingReplyChipText, darkMode && styles.pendingReplyChipTextDark]} numberOfLines={2}>
                Replying to {pendingReplyContext.label}
              </Text>
              <TouchableOpacity onPress={() => setPendingReplyContext(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name='close' size={16} color={darkMode ? "#ddd" : "#666"} />
              </TouchableOpacity>
            </View>
          ) : null}
          <TextInput
            style={[styles.input, darkMode && styles.inputDark]}
            placeholder='Type a message...'
            placeholderTextColor={darkMode ? "#666" : "#aaa"}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            returnKeyType='default'
          />
          <TouchableOpacity style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]} onPress={sendMessage} disabled={!inputText.trim() || sending}>
            {sending ? <ActivityIndicator size='small' color='#fff' /> : <Ionicons name='send' size={20} color='#fff' />}
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
  bubbleReply: { borderWidth: 1, borderColor: "#d5b5e6" },
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
  replyHeader: {
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  replyHeaderMine: { borderBottomColor: "rgba(255,255,255,0.35)" },
  replyHeaderTheirs: { borderBottomColor: "rgba(0,0,0,0.16)" },
  replyHeaderTheirsDark: { borderBottomColor: "rgba(255,255,255,0.18)" },
  replyHeaderText: { fontSize: 11, fontWeight: "600" },
  replyHeaderTextMine: { color: "#f6eefe" },
  replyHeaderTextTheirs: { color: "#4d2f63" },
  replyHeaderTextTheirsDark: { color: "#d9c4ea" },

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
  pendingReplyChip: {
    position: "absolute",
    top: -34,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f3e8fb",
    borderColor: "#d8b7eb",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pendingReplyChipDark: { backgroundColor: "#2f2240", borderColor: "#6a4f80" },
  pendingReplyChipText: { flex: 1, fontSize: 12, color: "#5a2e79", marginRight: 8 },
  pendingReplyChipTextDark: { color: "#e8d9f7" },

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
