import React, { createContext, useCallback, useContext, useRef, useState } from "react";

const NearbyAlertContext = createContext({
  nearbyAlert: null,
  setNearbyAlert: () => {},
  dismissNearbyAlert: () => {},
  ignoreNearbyUser: () => {},
  registerIgnoreHandler: () => {},
});

/**
 * Holds the current nearby-alert payload so NearbyAlertBanner can render at app root
 * (visible on any screen). SettingsScreen still owns Ably subscribe / ignore logic
 * and pushes alerts here while live sharing is active.
 */
export function NearbyAlertProvider({ children }) {
  const [nearbyAlert, setNearbyAlert] = useState(null);
  const ignoreHandlerRef = useRef(null);

  const dismissNearbyAlert = useCallback(() => setNearbyAlert(null), []);

  const registerIgnoreHandler = useCallback((fn) => {
    ignoreHandlerRef.current = typeof fn === "function" ? fn : null;
  }, []);

  const ignoreNearbyUser = useCallback((uid) => {
    ignoreHandlerRef.current?.(uid);
  }, []);

  return (
    <NearbyAlertContext.Provider
      value={{
        nearbyAlert,
        setNearbyAlert,
        dismissNearbyAlert,
        ignoreNearbyUser,
        registerIgnoreHandler,
      }}
    >
      {children}
    </NearbyAlertContext.Provider>
  );
}

export function useNearbyAlert() {
  return useContext(NearbyAlertContext);
}
