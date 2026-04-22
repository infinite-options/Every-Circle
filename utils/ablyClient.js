import { Platform } from "react-native";
import { ABLY_TOKEN_ENDPOINT } from "../apiConfig";

let sharedClient = null;
let sharedClientId = null;

export function createAblyRealtimeClient(clientId) {
  const normalizedClientId = clientId || "anonymous-client";

  if (sharedClient && sharedClientId === normalizedClientId) {
    return sharedClient;
  }

  if (sharedClient && sharedClientId !== normalizedClientId) {
    try {
      sharedClient.close();
    } catch (_) {}
    sharedClient = null;
    sharedClientId = null;
  }

  let Ably;
  if (Platform.OS === "web" && typeof window !== "undefined" && window.Ably) {
    Ably = window.Ably;
  } else {
    Ably = require("ably");
  }

  const tokenUrl = `${ABLY_TOKEN_ENDPOINT}?client_id=${encodeURIComponent(normalizedClientId)}`;

  sharedClient = new Ably.Realtime({
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
  sharedClientId = normalizedClientId;
  return sharedClient;
}

export function resetSharedAblyClient() {
  if (sharedClient) {
    try {
      sharedClient.close();
    } catch (_) {}
  }
  sharedClient = null;
  sharedClientId = null;
}

