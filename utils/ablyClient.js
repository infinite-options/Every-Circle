import { Platform } from "react-native";
import { ABLY_TOKEN_ENDPOINT } from "../apiConfig";

export function createAblyRealtimeClient(clientId) {
  let Ably;
  if (Platform.OS === "web" && typeof window !== "undefined" && window.Ably) {
    Ably = window.Ably;
  } else {
    Ably = require("ably");
  }

  const tokenUrl = `${ABLY_TOKEN_ENDPOINT}?client_id=${encodeURIComponent(clientId || "anonymous-client")}`;

  return new Ably.Realtime({
    authCallback: async (_tokenParams, callback) => {
      try {
        const res = await fetch(tokenUrl);
        const json = await res.json();
        if (!res.ok || !json?.result) {
          callback(new Error(json?.message || "Failed to fetch Ably token request"), null);
          return;
        }
        callback(null, json.result);
      } catch (e) {
        callback(e, null);
      }
    },
  });
}

