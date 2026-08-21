import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import {
  ACCOUNT_SALT_ENDPOINT,
  AUTH_LOGIN_ENDPOINT,
  AUTH_LOGOUT_ENDPOINT,
  AUTH_REFRESH_ENDPOINT,
  AUTH_SOCIAL_ENDPOINT,
} from "../apiConfig";
import { decryptResponse } from "./encryption";
import { isPrivacyModeEnabled } from "./privacyMode";

/** Called after a failed token refresh so the app can reset navigation to Home. */
let onAuthSessionExpired = null;

export function setOnAuthSessionExpired(callback) {
  onAuthSessionExpired = typeof callback === "function" ? callback : null;
}

export function looksLikeJwt(token) {
  return typeof token === "string" && token.split(".").length === 3;
}

/**
 * Normalize Circle /api/v1/auth/* JSON into a flat token payload.
 * Accepts a top-level object or `{ result | data: { access_token, ... } }`.
 */
export function unwrapAuthResult(data) {
  if (!data || typeof data !== "object") return null;
  const candidates = [data, data.result, data.data];
  for (const obj of candidates) {
    if (obj && typeof obj === "object" && (obj.access_token || obj.refresh_token)) {
      return {
        access_token: obj.access_token || "",
        refresh_token: obj.refresh_token || "",
        user_uid: obj.user_uid || "",
        user_email_id: obj.user_email_id || "",
        profile_id: obj.profile_id || obj.profile_uid || "",
      };
    }
  }
  return null;
}

export async function persistAuthTokens(result) {
  const tokens = result && (result.access_token || result.refresh_token) ? result : unwrapAuthResult(result);
  if (!tokens?.access_token && !tokens?.refresh_token) return false;

  const pairs = [];
  if (tokens.access_token) pairs.push(["access_token", String(tokens.access_token)]);
  if (tokens.refresh_token) pairs.push(["refresh_token", String(tokens.refresh_token)]);
  if (tokens.user_uid) pairs.push(["user_uid", String(tokens.user_uid)]);
  if (tokens.user_email_id) pairs.push(["user_email_id", String(tokens.user_email_id)]);
  if (pairs.length) {
    await AsyncStorage.multiSet(pairs);
  }
  if (tokens.profile_id) {
    await AsyncStorage.setItem("profile_uid", String(tokens.profile_id));
  }
  return Boolean(tokens.access_token);
}

export async function getAccessToken() {
  return AsyncStorage.getItem("access_token");
}

export async function getRefreshToken() {
  return AsyncStorage.getItem("refresh_token");
}

export async function hashPasswordWithSalt(password, salt) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, String(password) + String(salt), {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

/** After CREATE_ACCOUNT: salt + SHA-256, then Circle /auth/login. */
export async function issueCircleTokensFromPassword(email, password, fetchFn) {
  try {
    const saltResponse = await fetchFn(ACCOUNT_SALT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const saltObject = await saltResponse.json();
    const salt = saltObject?.result?.[0]?.password_salt;
    if (saltObject?.code !== 200 || !salt) {
      console.warn("issueCircleTokensFromPassword: salt request failed", saltObject);
      return false;
    }
    const hashedPassword = await hashPasswordWithSalt(password, salt);
    return fetchCircleAuthLogin(email, hashedPassword, fetchFn);
  } catch (e) {
    console.warn("issueCircleTokensFromPassword failed", e?.message || e);
    return false;
  }
}

export async function fetchCircleAuthLogin(email, hashedPassword, fetchFn) {
  try {
    const response = await fetchFn(AUTH_LOGIN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: hashedPassword }),
    });
    const data = await response.json();
    const tokens = unwrapAuthResult(data) || data;
    const ok = await persistAuthTokens(tokens);
    if (!ok) {
      console.warn("Circle auth login did not return tokens", data);
    }
    return ok;
  } catch (e) {
    console.warn("Circle auth login failed", e?.message || e);
    return false;
  }
}

/**
 * Exchange Google/Apple provider tokens for a Circle JWT after Infinite Options social auth.
 * Google web uses id_token (JWT); native Google uses access_token; Apple uses id_token.
 */
export async function fetchCircleAuthSocial({ provider, idToken, accessToken }, fetchFn) {
  try {
    const body = { provider };
    if (idToken) body.id_token = idToken;
    if (accessToken) body.access_token = accessToken;
    const response = await fetchFn(AUTH_SOCIAL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    const tokens = unwrapAuthResult(data) || data;
    const ok = await persistAuthTokens(tokens);
    if (!ok) {
      console.warn("Circle auth social did not return tokens", data);
    }
    return ok;
  } catch (e) {
    console.warn("Circle auth social failed", e?.message || e);
    return false;
  }
}

export function googleCircleAuthPayload(googleAuthToken, userInfo) {
  if (looksLikeJwt(googleAuthToken)) {
    return { provider: "google", idToken: googleAuthToken };
  }
  if (looksLikeJwt(userInfo?.idToken)) {
    return { provider: "google", idToken: userInfo.idToken };
  }
  return { provider: "google", accessToken: googleAuthToken };
}

export function appleCircleAuthPayload(idToken) {
  return { provider: "apple", idToken };
}

let inFlightRefresh = null;

/**
 * POST /api/v1/auth/refresh with the refresh token. Uses raw fetch so httpMiddleware
 * 401 retry cannot recurse. Concurrent callers share one in-flight request.
 */
export async function refreshCircleTokens() {
  if (!inFlightRefresh) {
    inFlightRefresh = doRefreshCircleTokens().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

async function doRefreshCircleTokens() {
  const refreshToken = await AsyncStorage.getItem("refresh_token");
  if (!refreshToken) return false;

  try {
    const headers = {
      Authorization: `Bearer ${refreshToken}`,
      "Content-Type": "application/json",
    };
    if (isPrivacyModeEnabled()) {
      headers["X-Privacy-Mode"] = "true";
    }
    const res = await fetch(AUTH_REFRESH_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    if (!res.ok) return false;
    let data = await res.json();
    if (isPrivacyModeEnabled()) {
      data = decryptResponse(data) ?? data;
    }
    const tokens = unwrapAuthResult(data) || data;
    if (!tokens?.access_token) return false;
    await persistAuthTokens(tokens);
    return true;
  } catch (e) {
    console.warn("refreshCircleTokens failed", e?.message || e);
    return false;
  }
}

/** Best-effort Circle logout; always proceeds even if the request fails. */
export async function logoutCircleSession(fetchFn) {
  try {
    await fetchFn(AUTH_LOGOUT_ENDPOINT, { method: "POST" });
  } catch (e) {
    console.warn("Circle auth logout failed", e?.message || e);
  }
}

let handlingExpiry = false;

/** Drop tokens immediately, then let App.js clear the rest of the session and reset navigation. */
export async function handleAuthSessionExpired() {
  if (handlingExpiry) return;
  handlingExpiry = true;
  try {
    await AsyncStorage.multiRemove(["access_token", "refresh_token"]);
    if (onAuthSessionExpired) {
      await onAuthSessionExpired();
    }
  } catch (e) {
    console.warn("handleAuthSessionExpired failed", e?.message || e);
  } finally {
    handlingExpiry = false;
  }
}
