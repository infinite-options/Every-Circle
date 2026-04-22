import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAblyRealtimeClient } from "../utils/ablyClient";

const UnreadContext = createContext({
  hasUnread: false,
  notification: null,
  clearUnread: () => {},
  dismissNotification: () => {},
  setActiveChat: () => {},
  clearActiveChat: () => {},
  enterChatView: () => {},
  leaveChatView: () => {},
  reinitialize: () => {},
});

/** Set by UnreadProvider each render. Lets App.js auth handlers (outside the provider’s child tree) resubscribe Ably after AsyncStorage changes. */
let reinitializeUnreadImpl = async () => {};

/** Call after login / logout when you cannot use `useUnread().reinitialize` (e.g. handlers defined in App.js before NavigationContainer). */
export function reinitializeUnreadFromOutside() {
  return reinitializeUnreadImpl();
}

export function UnreadProvider({ children }) {
  const [hasUnread, setHasUnread] = useState(false);
  // notification: { senderName, senderImage, body, conversationUid, senderUid } | null
  const [notification, setNotification] = useState(null);

  const ablyClientRef = useRef(null);
  // All subscribed channels (personal + owned businesses)
  const ablyChannelsRef = useRef([]);
  // Tracks the specific conversation_uid the user is in → suppresses the unread dot
  const activeChatRef = useRef(null);
  // True whenever the user is on ChatScreen or InboxScreen → suppresses the banner
  const inChatViewRef = useRef(false);
  // Track currently-subscribed personal UID and business UIDs to detect changes
  const subscribedUidRef = useRef(null);
  const subscribedBizUidsRef = useRef([]);

  const teardown = () => {
    ablyChannelsRef.current.forEach((ch) => {
      try {
        ch.unsubscribe("new-message");
      } catch (_) {}
    });
    ablyChannelsRef.current = [];
    // Do not close the shared Ably client here; other screens reuse it.
    ablyClientRef.current = null;
    subscribedUidRef.current = null;
    subscribedBizUidsRef.current = [];
  };

  /** Owned business UIDs for Ably — written by login/profile flows from the same userprofileinfo response (no duplicate fetch here). */
  const readBizUidsFromStorage = async () => {
    try {
      const raw = await AsyncStorage.getItem("my_business_uids");
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  };

  const setup = async () => {
    const uid = await AsyncStorage.getItem("profile_uid");
    if (!uid) {
      teardown();
      setHasUnread(false);
      setNotification(null);
      return false;
    }

    const bizUids = await readBizUidsFromStorage();

    // Check if anything has actually changed before rebuilding the Ably connection
    const sameUid = subscribedUidRef.current === uid;
    const prevBiz = subscribedBizUidsRef.current;
    const sameBiz = bizUids.length === prevBiz.length && bizUids.every((u) => prevBiz.includes(u));

    if (sameUid && sameBiz) return true; // nothing to do

    teardown();

    try {
      // Old key-based auth (kept for reference):
      // let Ably;
      // if (Platform.OS === "web" && typeof window !== "undefined" && window.Ably) {
      //   Ably = window.Ably;
      // } else {
      //   Ably = require("ably");
      // }
      // const apiKey = Constants.expoConfig?.extra?.ablyApiKey || process.env.EXPO_PUBLIC_ABLY_API_KEY || EXPO_PUBLIC_ABLY_API_KEY || "";
      // if (!apiKey) return false;
      // const client = new Ably.Realtime({ key: apiKey });
      const client = createAblyRealtimeClient(uid);
      ablyClientRef.current = client;

      // Shared message handler for all channels (personal + business)
      const handler = (msg) => {
        const data = msg.data || {};
        if (activeChatRef.current === data.conversation_uid) return;
        setHasUnread(true);
        if (!inChatViewRef.current) {
          setNotification({
            senderUid: data.sender_uid,
            senderName: data.sender_name || "New message",
            senderImage: data.sender_image || null,
            body: data.body || "",
            conversationUid: data.conversation_uid,
          });
        }
      };

      // Subscribe to personal channel
      const personalCh = client.channels.get(`/${uid}`);
      personalCh.subscribe("new-message", handler);
      ablyChannelsRef.current.push(personalCh);

      // Subscribe to each owned business channel
      bizUids.forEach((bizUid) => {
        const bizCh = client.channels.get(`/${bizUid}`);
        bizCh.subscribe("new-message", handler);
        ablyChannelsRef.current.push(bizCh);
      });

      subscribedUidRef.current = uid;
      subscribedBizUidsRef.current = bizUids;
      return true;
    } catch (e) {
      console.warn("UnreadContext: Ably subscribe failed:", e.message);
      return false;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const trySetup = async () => {
      if (cancelled) return;
      await setup();
    };

    trySetup();

    // Re-check when app returns to foreground (e.g. logged in elsewhere, or storage updated) — no periodic polling
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active" && !cancelled) trySetup();
    });

    return () => {
      cancelled = true;
      sub.remove();
      teardown();
    };
  }, []);

  // Call after login / account switch: tears down Ably and re-subscribes using my_business_uids from AsyncStorage.
  // Does not affect Search API results — search hits search endpoints, not this list.
  const reinitialize = async () => {
    subscribedUidRef.current = null; // force re-subscription
    await setup();
  };

  reinitializeUnreadImpl = reinitialize;

  useEffect(() => {
    return () => {
      reinitializeUnreadImpl = async () => {};
    };
  }, []);

  const clearUnread = () => setHasUnread(false);
  const dismissNotification = () => setNotification(null);
  const setActiveChat = (convUid) => {
    activeChatRef.current = convUid;
  };
  const clearActiveChat = () => {
    activeChatRef.current = null;
  };
  const enterChatView = () => {
    inChatViewRef.current = true;
  };
  const leaveChatView = () => {
    inChatViewRef.current = false;
  };

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
        reinitialize,
      }}
    >
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  return useContext(UnreadContext);
}
