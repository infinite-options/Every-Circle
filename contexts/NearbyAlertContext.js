import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  bindLiveLocationSharingExtras,
  restoreLiveLocationSessionIfActive,
} from "../utils/liveLocationSharing";

const NEARBY_IGNORED_KEY = "nearby_ignored_uids";

const NearbyAlertContext = createContext({
  nearbyAlert: null,
  setNearbyAlert: () => {},
  dismissNearbyAlert: () => {},
  ignoreNearbyUser: () => {},
});

/**
 * App-root nearby alerts: binds Ably nearby-alert delivery for the whole app lifetime
 * (not just while Settings is mounted), and renders via NearbyAlertBanner in App.js.
 */
export function NearbyAlertProvider({ children }) {
  const [nearbyAlert, setNearbyAlert] = useState(null);
  const ignoredNearbyRef = useRef(new Set());

  const dismissNearbyAlert = useCallback(() => setNearbyAlert(null), []);

  const ignoreNearbyUser = useCallback(async (uid) => {
    if (!uid) return;
    const next = new Set(ignoredNearbyRef.current);
    next.add(uid);
    ignoredNearbyRef.current = next;
    try {
      await AsyncStorage.setItem(NEARBY_IGNORED_KEY, JSON.stringify([...next]));
    } catch (_) {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    const alertExtras = {
      onNearbyAlert: (alert) => {
        if (!cancelled) setNearbyAlert(alert);
      },
      isNearbyIgnored: (uid) => ignoredNearbyRef.current.has(uid),
      onStopped: () => {
        if (!cancelled) setNearbyAlert(null);
      },
    };

    // Bind immediately so alerts work even if ignore-list load is still pending.
    bindLiveLocationSharingExtras(alertExtras);

    (async () => {
      try {
        const storedIgnored = await AsyncStorage.getItem(NEARBY_IGNORED_KEY);
        if (storedIgnored) {
          const uids = JSON.parse(storedIgnored);
          if (Array.isArray(uids)) ignoredNearbyRef.current = new Set(uids);
        }
      } catch (_) {}

      if (cancelled) return;
      // Re-attach Ably if a live-share session is already active (e.g. started from Connect).
      await restoreLiveLocationSessionIfActive(alertExtras);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <NearbyAlertContext.Provider
      value={{
        nearbyAlert,
        setNearbyAlert,
        dismissNearbyAlert,
        ignoreNearbyUser,
      }}
    >
      {children}
    </NearbyAlertContext.Provider>
  );
}

export function useNearbyAlert() {
  return useContext(NearbyAlertContext);
}
