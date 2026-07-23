import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getPrimaryBusinessUid, getSessionProfile, subscribeSessionProfile } from "../utils/sessionProfile";

const SessionProfileContext = createContext(null);

function businessesFromSession(session) {
  const list = Array.isArray(session?.businesses) ? session.businesses : [];
  const seen = new Set();
  return list.filter((b) => {
    const id = String(b.business_uid || b.profile_business_uid || "").trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function applySessionToState(session, setBusinesses, setPrimaryBusinessUid) {
  if (!session) {
    setBusinesses([]);
    setPrimaryBusinessUid(null);
    return;
  }
  const list = businessesFromSession(session);
  setBusinesses(list);
  setPrimaryBusinessUid(getPrimaryBusinessUid(list));
}

export function SessionProfileProvider({ children }) {
  const [businesses, setBusinesses] = useState([]);
  const [primaryBusinessUid, setPrimaryBusinessUid] = useState(null);

  const refreshFromSession = useCallback(async ({ forceRefresh = false } = {}) => {
    const session = await getSessionProfile({ forceRefresh });
    applySessionToState(session, setBusinesses, setPrimaryBusinessUid);
    return session;
  }, []);

  useEffect(() => {
    void refreshFromSession();
    return subscribeSessionProfile((session) => {
      applySessionToState(session, setBusinesses, setPrimaryBusinessUid);
    });
  }, [refreshFromSession]);

  return (
    <SessionProfileContext.Provider value={{ businesses, primaryBusinessUid, refreshFromSession }}>
      {children}
    </SessionProfileContext.Provider>
  );
}

/** Read mapped businesses from the shared session cache (no network). */
export function useSessionBusinesses() {
  const context = useContext(SessionProfileContext);
  if (!context) {
    throw new Error("useSessionBusinesses must be used within SessionProfileProvider");
  }
  return context;
}
