import AsyncStorage from "@react-native-async-storage/async-storage";
import { AWS_DEV_API_BASE_URL } from "../apiConfig";
import { isEncryptionOn } from "../config/encryptionEnv";

export const AUTH_TOKEN_KEY = "authToken";
export const REFRESH_TOKEN_KEY = "refreshToken";

/** Pull access/refresh tokens from login or social-auth API payloads. */
export function extractTokensFromAuthResult(data) {
  const result = data?.result ?? data;
  return {
    accessToken: result?.access_token ?? data?.access_token ?? null,
    refreshToken: result?.refresh_token ?? data?.refresh_token ?? null,
  };
}

export async function persistAuthTokens(accessToken, refreshToken) {
  if (accessToken) {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, String(accessToken));
  }
  if (refreshToken) {
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, String(refreshToken));
  }
}

export async function persistAuthTokensFromResult(data) {
  const { accessToken, refreshToken } = extractTokensFromAuthResult(data);
  await persistAuthTokens(accessToken, refreshToken);
  return { accessToken, refreshToken };
}

export async function getAuthToken() {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function getRefreshToken() {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function clearAuthTokens() {
  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

/**
 * Auth login (mrle52rri4) does not return JWT for EVERY-CIRCLE yet.
 * When encryption/AWS mode is on, fetch tokens from ec_api /auth/accessToken.
 */
export async function ensureAwsAuthTokens(userUid) {
  if (!userUid || !isEncryptionOn()) {
    return { accessToken: null, refreshToken: null };
  }

  const existing = await getAuthToken();
  if (existing) {
    return { accessToken: existing, refreshToken: await getRefreshToken() };
  }

  try {
    const response = await fetch(`${AWS_DEV_API_BASE_URL}/auth/accessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_uid: userUid }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.warn("[ensureAwsAuthTokens] failed:", response.status, data);
      return { accessToken: null, refreshToken: null };
    }
    await persistAuthTokens(data.access_token, data.refresh_token);
    console.log("[ensureAwsAuthTokens] JWT stored for user", userUid);
    return {
      accessToken: data.access_token ?? null,
      refreshToken: data.refresh_token ?? null,
    };
  } catch (e) {
    console.warn("[ensureAwsAuthTokens] error:", e?.message || e);
    return { accessToken: null, refreshToken: null };
  }
}

/** Save login tokens when present; otherwise bootstrap JWT for AWS API mode. */
export async function persistOrBootstrapAuthTokens(authResult, userUid) {
  const { accessToken, refreshToken } = await persistAuthTokensFromResult(authResult);
  if (accessToken) {
    return { accessToken, refreshToken };
  }
  if (userUid) {
    return ensureAwsAuthTokens(userUid);
  }
  return { accessToken: null, refreshToken: null };
}

/** Attach Bearer token for AWS API requests when a token is stored. */
export async function withAwsAuthHeaders(url, headers = {}) {
  const urlString = String(url ?? "");
  if (!urlString.startsWith(AWS_DEV_API_BASE_URL)) {
    return headers;
  }
  const normalized = { ...headers };
  const hasAuth = Object.keys(normalized).some((k) => k.toLowerCase() === "authorization");
  if (hasAuth) return normalized;
  const token = await getAuthToken();
  if (token) {
    normalized.Authorization = `Bearer ${token}`;
  }
  return normalized;
}
