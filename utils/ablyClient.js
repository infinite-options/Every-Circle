import { Platform } from "react-native";
import { ABLY_TOKEN_ENDPOINT } from "../apiConfig";

let sharedClient = null;
let sharedClientId = null;
/** Most recent obscured display string, or `null` if no active token. */
let lastTokenObscured = null;
/** `exp` from JWT in seconds, if present; `null` if unknown (e.g. TokenRequest). */
let lastTokenExpiresAtSec = null;
/**
 * Always point at the latest `onTokenObtained` from any `createAblyRealtimeClient` call.
 * The `authCallback` is created only once on the first `Ably.Realtime` construction; that
 * first caller may not pass a callback, so a closure over `onTokenObtained` would stay stale.
 */
let latestOnTokenObtained = null;

/**
 * @param {string|null|undefined} tokenStr
 * @returns {string|null} obscured form, or `null` if there is no usable value
 */
export function obscureAblyTokenForDisplay(tokenStr) {
  if (!tokenStr || typeof tokenStr !== "string") {
    return null;
  }
  if (tokenStr.length <= 10) {
    return "********";
  }
  return `${tokenStr.slice(0, 6)}...${tokenStr.slice(-4)}`;
}

/** Parse `exp` from a JWT; returns `null` if not a JWT. */
function getJwtExpUnixSeconds(maybeJwt) {
  if (typeof maybeJwt !== "string" || !maybeJwt.includes(".")) {
    return null;
  }
  const parts = maybeJwt.split(".");
  if (parts.length < 2) {
    return null;
  }
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const mod = b64.length % 4;
    const padding = mod === 0 ? 0 : 4 - mod;
    const padded = b64 + (padding > 0 ? "=".repeat(padding) : "");
    const decode =
      typeof atob === "function"
        ? atob
        : typeof globalThis !== "undefined" && typeof globalThis.atob === "function"
          ? globalThis.atob
          : null;
    if (!decode) {
      return null;
    }
    const json = JSON.parse(decode(padded));
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

/**
 * @param {unknown} tokenDetails - Ably TokenDetails, TokenRequest, or API wrapper object
 * @returns {string|null} raw string to fingerprint (JWT, mac, or other long secret)
 */
/**
 * Backend must return an Ably TokenRequest or TokenDetails. This app historically expected
 * `{ result: <object> }`. After API changes, the same payload may appear under `data`,
 * inside a string `body`, or at the top level.
 * @param {unknown} json
 * @returns {object|string|null}
 */
function extractAblyAuthPayloadFromResponse(json) {
  if (json == null) return null;
  if (typeof json === "string") {
    try {
      const inner = JSON.parse(json);
      return extractAblyAuthPayloadFromResponse(inner);
    } catch {
      return null;
    }
  }
  if (typeof json !== "object") return null;

  if (json.result != null) return json.result;
  if (json.data != null) return json.data;

  if (typeof json.body === "string") {
    const inner = extractAblyAuthPayloadFromResponse(json.body);
    if (inner != null) return inner;
  }

  const o = json;
  if (typeof o.token === "string" && o.token.length > 0) return o;
  if (o.keyName && (o.mac || o.nonce || o.capability != null || o.ttl != null)) return o;

  return null;
}

function extractTokenString(tokenDetails) {
  if (!tokenDetails) {
    return null;
  }
  if (typeof tokenDetails === "string") {
    return tokenDetails;
  }
  if (typeof tokenDetails !== "object") {
    return null;
  }
  const o = tokenDetails;
  for (const k of ["token", "accessToken", "access_token", "id_token"]) {
    if (typeof o[k] === "string" && o[k].length) {
      return o[k];
    }
  }
  for (const k of ["mac", "nonce", "keyName", "key"]) {
    if (typeof o[k] === "string" && o[k].length > 4) {
      return o[k];
    }
  }
  if (o.data && typeof o.data === "object") {
    const nested = extractTokenString(o.data);
    if (nested) {
      return nested;
    }
  }
  for (const v of Object.values(o)) {
    if (typeof v === "string" && v.length > 20) {
      const ps = v.split(".");
      if (ps.length === 3) {
        return v;
      }
    }
  }
  return null;
}

function clearStoredToken() {
  lastTokenObscured = null;
  lastTokenExpiresAtSec = null;
}

function emitTokenObscured(raw) {
  if (!raw) {
    clearStoredToken();
    try {
      latestOnTokenObtained?.(null);
    } catch (_) {}
    return;
  }
  const jwtExp = getJwtExpUnixSeconds(raw);
  const obscured = obscureAblyTokenForDisplay(raw);
  if (!obscured) {
    clearStoredToken();
    try {
      latestOnTokenObtained?.(null);
    } catch (_) {}
    return;
  }
  // `lastTokenExpiresAtSec` is only set for JWTs; TokenRequest (e.g. `mac`) has unknown expiry.
  lastTokenExpiresAtSec = jwtExp != null ? jwtExp : null;
  lastTokenObscured = obscured;
  try {
    latestOnTokenObtained?.(obscured);
  } catch (_) {}
}

/**
 * For debug UI: current obscured token if the stored credential is still valid by JWT `exp`
 * and local cache, otherwise `null` (and cache is cleared when expired).
 * @returns {string|null}
 */
export function getAblyTokenObscuredIfStillValid() {
  if (!lastTokenObscured) {
    return null;
  }
  if (lastTokenExpiresAtSec != null && Date.now() / 1000 >= lastTokenExpiresAtSec - 1) {
    clearStoredToken();
    return null;
  }
  return lastTokenObscured;
}

/**
 * No token was received, auth failed, or the session is not usable (e.g. connection `failed` / `closed`).
 * Clears the cached display token and notifies `onTokenObtained` with `null`.
 */
export function markAblyTokenNoLongerActive() {
  clearStoredToken();
  try {
    latestOnTokenObtained?.(null);
  } catch (_) {}
}

/**
 * @param {string} [clientId]
 * @param {{ onTokenObtained?: (obscured: string | null) => void }} [options] invoked when a token is received or cleared; `obscured` is masked JWT/mac or `null`
 */
export function createAblyRealtimeClient(clientId, options = {}) {
  const { onTokenObtained } = options;
  if (typeof onTokenObtained === "function") {
    latestOnTokenObtained = onTokenObtained;
  }
  const normalizedClientId = clientId || "anonymous-client";
  // console.log("[AblyDebug] createAblyRealtimeClient called", {
  //   requestedClientId: normalizedClientId,
  //   currentSharedClientId: sharedClientId,
  //   hasSharedClient: !!sharedClient,
  //   ts: new Date().toISOString(),
  // });

  if (sharedClient && sharedClientId === normalizedClientId) {
    // console.log("[AblyDebug] Reusing shared Ably client", {
    //   clientId: normalizedClientId,
    //   ts: new Date().toISOString(),
    // });
    const ob = getAblyTokenObscuredIfStillValid();
    latestOnTokenObtained?.(ob);
    return sharedClient;
  }

  if (sharedClient && sharedClientId !== normalizedClientId) {
    // console.warn("[AblyDebug] Recreating shared Ably client due to clientId change", {
    //   previousClientId: sharedClientId,
    //   nextClientId: normalizedClientId,
    //   ts: new Date().toISOString(),
    // });
    try {
      sharedClient.close();
    } catch (_) {}
    sharedClient = null;
    sharedClientId = null;
    clearStoredToken();
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
        const tokenPayload = extractAblyAuthPayloadFromResponse(json);
        if (!res.ok || tokenPayload == null) {
          emitTokenObscured(null);
          const msg = json?.message || json?.error || json?.Message || "Failed to fetch Ably token request";
          callback(new Error(typeof msg === "string" ? msg : "Failed to fetch Ably token request"), null);
          return;
        }
        const raw = extractTokenString(tokenPayload);
        emitTokenObscured(raw);
        callback(null, tokenPayload);
      } catch (e) {
        emitTokenObscured(null);
        callback(e, null);
      }
    },
  });
  sharedClientId = normalizedClientId;
  // console.log("[AblyDebug] Created new shared Ably client", {
  //   clientId: sharedClientId,
  //   ts: new Date().toISOString(),
  // });
  return sharedClient;
}

export function resetSharedAblyClient() {
  if (sharedClient) {
    // console.warn("[AblyDebug] resetSharedAblyClient closing shared client", {
    //   clientId: sharedClientId,
    //   ts: new Date().toISOString(),
    // });
    try {
      sharedClient.close();
    } catch (_) {}
  }
  sharedClient = null;
  sharedClientId = null;
  clearStoredToken();
  latestOnTokenObtained = null;
}
