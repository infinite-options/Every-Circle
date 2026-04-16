import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { EXPO_PUBLIC_ABLY_API_KEY } from "@env";

const UnreadContext = createContext({
  hasUnread: false,
  notification: null,
  clearUnread: () => {},
  dismissNotification: () => {},
  setActiveChat: () => {},
  clearActiveChat: () => {},
  enterChatView: () => {},
  leaveChatView: () => {},
});

export function UnreadProvider({ children }) {
  const [hasUnread, setHasUnread] = useState(false);
  // notification: { senderName, senderImage, body, conversationUid, senderUid } | null
  const [notification, setNotification] = useState(null);

  const ablyClientRef   = useRef(null);
  const ablyChannelRef  = useRef(null);
  // Tracks the specific conversation_uid the user is in → suppresses the unread dot
  const activeChatRef   = useRef(null);
  // True whenever the user is on ChatScreen or InboxScreen → suppresses the banner
  const inChatViewRef   = useRef(false);

  useEffect(() => {
    let cancelled    = false;
    let retryTimeout = null;

    const setup = async () => {
      const uid = await AsyncStorage.getItem("profile_uid");

      if (cancelled) return;

      if (!uid) {
        // User not logged in yet — poll every 2 s until they are
        retryTimeout = setTimeout(setup, 2000);
        return;
      }

      // Tear down any previous connection (e.g. account switch)
      try { ablyChannelRef.current?.unsubscribe("new-message"); } catch (_) {}
      try { ablyClientRef.current?.close(); } catch (_) {}
      ablyClientRef.current  = null;
      ablyChannelRef.current = null;

      try {
        let Ably;
        if (Platform.OS === "web" && typeof window !== "undefined" && window.Ably) {
          Ably = window.Ably;
        } else {
          Ably = require("ably");
        }

        const apiKey =
          Constants.expoConfig?.extra?.ablyApiKey ||
          process.env.EXPO_PUBLIC_ABLY_API_KEY ||
          EXPO_PUBLIC_ABLY_API_KEY ||
          "";
        if (!apiKey) return;

        const client  = new Ably.Realtime({ key: apiKey });
        const channel = client.channels.get(`/${uid}`);

        channel.subscribe("new-message", (msg) => {
          const data = msg.data || {};
          // Always suppress if user is already viewing this exact conversation
          const isActiveConv = activeChatRef.current === data.conversation_uid;
          if (isActiveConv) return;

          setHasUnread(true);

          // Only show the banner when the user is NOT on any chat-related screen
          if (!inChatViewRef.current) {
            setNotification({
              senderUid:       data.sender_uid,
              senderName:      data.sender_name || "New message",
              senderImage:     data.sender_image || null,
              body:            data.body || "",
              conversationUid: data.conversation_uid,
            });
          }
        });

        ablyClientRef.current  = client;
        ablyChannelRef.current = channel;
      } catch (e) {
        console.warn("UnreadContext: Ably subscribe failed:", e.message);
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      try { ablyChannelRef.current?.unsubscribe("new-message"); } catch (_) {}
      try { ablyClientRef.current?.close(); } catch (_) {}
      ablyClientRef.current  = null;
      ablyChannelRef.current = null;
    };
  }, []);

  const clearUnread         = ()         => setHasUnread(false);
  const dismissNotification = ()         => setNotification(null);
  const setActiveChat       = (convUid)  => { activeChatRef.current = convUid; };
  const clearActiveChat     = ()         => { activeChatRef.current = null; };
  // Call these when entering/leaving any chat-related screen (Chat or Inbox)
  const enterChatView       = ()         => { inChatViewRef.current = true; };
  const leaveChatView       = ()         => { inChatViewRef.current = false; };

  return (
    <UnreadContext.Provider
      value={{
        hasUnread,
        notification,
        clearUnread,
        dismissNotification,
        setActiveChat,
        clearActiveChat,
        enterChatView,
        leaveChatView,
      }}
    >
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  return useContext(UnreadContext);
}
