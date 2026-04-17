import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { EXPO_PUBLIC_ABLY_API_KEY } from "@env";
import { USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";

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

export function UnreadProvider({ children }) {
  const [hasUnread, setHasUnread] = useState(false);
  // notification: { senderName, senderImage, body, conversationUid, senderUid } | null
  const [notification, setNotification] = useState(null);

  const ablyClientRef       = useRef(null);
  // All subscribed channels (personal + owned businesses)
  const ablyChannelsRef     = useRef([]);
  // Tracks the specific conversation_uid the user is in → suppresses the unread dot
  const activeChatRef       = useRef(null);
  // True whenever the user is on ChatScreen or InboxScreen → suppresses the banner
  const inChatViewRef       = useRef(false);
  // Track currently-subscribed personal UID and business UIDs to detect changes
  const subscribedUidRef    = useRef(null);
  const subscribedBizUidsRef = useRef([]);

  const teardown = () => {
    ablyChannelsRef.current.forEach((ch) => {
      try { ch.unsubscribe("new-message"); } catch (_) {}
    });
    ablyChannelsRef.current = [];
    try { ablyClientRef.current?.close(); } catch (_) {}
    ablyClientRef.current     = null;
    subscribedUidRef.current  = null;
    subscribedBizUidsRef.current = [];
  };

  /** Fetch the owned business UIDs for a profile UID.
   *  Tries the API first (always fresh); falls back to AsyncStorage on error. */
  const fetchBizUids = async (uid) => {
    try {
      const res  = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${uid}`);
      const json = await res.json();
      const uids = (json.business_info || []).map((b) => b.business_uid).filter(Boolean);
      // Keep AsyncStorage in sync for other consumers
      AsyncStorage.setItem("my_business_uids", JSON.stringify(uids)).catch(() => {});
      return uids;
    } catch (_) {
      try {
        const raw = await AsyncStorage.getItem("my_business_uids");
        return JSON.parse(raw || "[]") || [];
      } catch (_2) { return []; }
    }
  };

  const setup = async () => {
    const uid = await AsyncStorage.getItem("profile_uid");
    if (!uid) return false; // not logged in yet

    // Always fetch fresh business UIDs so newly-created businesses are picked up
    const bizUids = await fetchBizUids(uid);

    // Check if anything has actually changed before rebuilding the Ably connection
    const sameUid = subscribedUidRef.current === uid;
    const prevBiz = subscribedBizUidsRef.current;
    const sameBiz =
      bizUids.length === prevBiz.length &&
      bizUids.every((u) => prevBiz.includes(u));

    if (sameUid && sameBiz) return true; // nothing to do

    teardown();

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
      if (!apiKey) return false;

      const client = new Ably.Realtime({ key: apiKey });
      ablyClientRef.current = client;

      // Shared message handler for all channels (personal + business)
      const handler = (msg) => {
        const data = msg.data || {};
        if (activeChatRef.current === data.conversation_uid) return;
        setHasUnread(true);
        if (!inChatViewRef.current) {
          setNotification({
            senderUid:       data.sender_uid,
            senderName:      data.sender_name || "New message",
            senderImage:     data.sender_image || null,
            body:            data.body || "",
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

      subscribedUidRef.current     = uid;
      subscribedBizUidsRef.current = bizUids;
      return true;
    } catch (e) {
      console.warn("UnreadContext: Ably subscribe failed:", e.message);
      return false;
    }
  };

  useEffect(() => {
    let cancelled    = false;
    let retryTimeout = null;
    let pollInterval = null;

    const trySetup = async () => {
      if (cancelled) return;
      const ok = await setup();
      if (!ok && !cancelled) {
        // Not logged in yet — retry every 2 s until we get a UID
        retryTimeout = setTimeout(trySetup, 2000);
      }
    };

    trySetup();

    // Poll every 30 s to detect account switches (login with a different profile_uid).
    // setup() is a no-op if the UID hasn't changed, so the overhead is minimal.
    pollInterval = setInterval(() => {
      if (!cancelled) setup();
    }, 30000);

    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (pollInterval) clearInterval(pollInterval);
      teardown();
    };
  }, []);

  // Call after login or account switch to re-subscribe to the new user's channels
  const reinitialize = async () => {
    subscribedUidRef.current = null; // force re-subscription
    await setup();
  };

  const clearUnread         = ()         => setHasUnread(false);
  const dismissNotification = ()         => setNotification(null);
  const setActiveChat       = (convUid)  => { activeChatRef.current = convUid; };
  const clearActiveChat     = ()         => { activeChatRef.current = null; };
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
