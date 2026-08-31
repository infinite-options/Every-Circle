// utils/cookieConsent.js
//
// Single source of truth for the "allowCookies" preference so the persistent
// bottom banner (components/CookieConsentBanner.js) and the Settings screen
// toggle stay in sync without a nav-state refresh in between.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { USER_INFO_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetchWithAuth } from "./httpMiddleware";

const listeners = new Set();

/** null = not yet answered, true/false = user's saved choice. */
export async function getAllowCookies() {
  try {
    const stored = await AsyncStorage.getItem("allowCookies");
    return stored === null ? null : JSON.parse(stored);
  } catch (error) {
    console.log("cookieConsent - Error reading allowCookies:", error);
    return null;
  }
}

export async function setAllowCookies(value) {
  try {
    await AsyncStorage.setItem("allowCookies", JSON.stringify(value));
  } catch (error) {
    console.log("cookieConsent - Error saving allowCookies:", error);
  }
  listeners.forEach((listener) => listener(value));
}

/** Fires whenever setAllowCookies() is called anywhere in the app. */
export function subscribeAllowCookies(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Re-reads AsyncStorage and notifies listeners with whatever is there now.
 * Needed after a raw `AsyncStorage.clear()` (e.g. account creation wipes every
 * key, including allowCookies, without going through setAllowCookies()) so the
 * persistent banner notices the preference is unanswered again.
 */
export async function refreshAllowCookies() {
  const value = await getAllowCookies();
  listeners.forEach((listener) => listener(value));
  return value;
}

// --- Server-side consent, tied to the profile (users.user_cookies / users_cookies_date) --
// AsyncStorage alone is per-device: a profile that already answered on one device (or a
// different profile that answered on this one) could wrongly hide/show the banner, or apply
// the wrong allow/opt-out, for someone else. `users_cookies_date` (null = never answered) says
// *whether* the profile has answered; `user_cookies` ("true"/"false" string, like the existing
// user_notifications/user_dark_mode columns) says *what* they chose. Together they're the
// per-profile source of truth; these helpers keep this device's local `allowCookies` reconciled.

function firstUserRow(result) {
  if (Array.isArray(result?.result)) return result.result[0];
  return result?.result ?? result?.data ?? result;
}

function parseBoolString(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return String(value).trim().toLowerCase() === "true";
}

/** Reads { date, allow } for a user_uid from the server; both null if unset/unreachable. */
export async function fetchServerCookieConsent(userUid) {
  const uid = String(userUid || "").trim();
  if (!uid) return { date: null, allow: null };
  try {
    const response = await fetchWithAuth(`${USER_INFO_ENDPOINT}/${encodeURIComponent(uid)}`);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return { date: null, allow: null };
    const row = firstUserRow(result);
    return {
      date: row?.users_cookies_date || null,
      allow: parseBoolString(row?.user_cookies, null),
    };
  } catch (error) {
    console.log("cookieConsent - Error fetching server cookie consent:", error);
    return { date: null, allow: null };
  }
}

/** Records this profile's cookie-consent choice and today's date on the server. */
export async function persistServerCookieConsent(userUid, allow) {
  const uid = String(userUid || "").trim();
  if (!uid) return;
  try {
    await fetchWithAuth(USER_INFO_ENDPOINT, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_uid: uid,
        user_cookies: allow ? "true" : "false",
        users_cookies_date: new Date().toISOString().slice(0, 10),
      }),
    });
  } catch (error) {
    console.log("cookieConsent - Error saving server cookie consent:", error);
  }
}

/** Same as persistServerCookieConsent(), but reads the logged-in user_uid itself; no-ops if logged out. */
export async function persistServerCookieConsentForCurrentUser(allow) {
  try {
    const userUid = await AsyncStorage.getItem("user_uid");
    if (userUid) await persistServerCookieConsent(userUid, allow);
  } catch (error) {
    console.log("cookieConsent - Error persisting consent for current user:", error);
  }
}

/**
 * Reconciles this device's local `allowCookies` with the logged-in profile's server record.
 * Call once per login/signup (and it's harmless to call again on app resume).
 *  - Profile has never answered (no server date) → clear the local value so the banner shows,
 *    even if a different profile answered on this same device before.
 *  - Profile has already answered → adopt the server's actual choice locally, overriding
 *    whatever this device had (it may be stale, or left behind by a different profile).
 */
export async function syncAllowCookiesForUser(userUid) {
  const { date, allow } = await fetchServerCookieConsent(userUid);
  if (!date) {
    try {
      await AsyncStorage.removeItem("allowCookies");
    } catch (error) {
      console.log("cookieConsent - Error clearing allowCookies:", error);
    }
    listeners.forEach((listener) => listener(null));
    return;
  }
  await setAllowCookies(allow === null ? true : allow);
}

// --- Banner height broadcast ---------------------------------------------
// CookieConsentBanner reports its own rendered height here (0 when hidden) so
// screens without a BottomNavBar (e.g. SignUpScreen) can pad their scrollable
// content and keep their own footer content from ending up underneath it.
let currentBannerHeight = 0;
const heightListeners = new Set();

export function reportCookieBannerHeight(height) {
  currentBannerHeight = height;
  heightListeners.forEach((listener) => listener(height));
}

/** Immediately invoked with the current height, then again on every change. */
export function subscribeCookieBannerHeight(listener) {
  listener(currentBannerHeight);
  heightListeners.add(listener);
  return () => heightListeners.delete(listener);
}

// --- Bottom nav bar height broadcast --------------------------------------
// BottomNavBar reports its own rendered height here (0 once unmounted) so the
// cookie banner can sit directly above it — the nav bar itself always stays
// pinned to the true bottom of the screen; the banner is what moves.
let currentNavBarHeight = 0;
const navBarHeightListeners = new Set();

export function reportBottomNavBarHeight(height) {
  currentNavBarHeight = height;
  navBarHeightListeners.forEach((listener) => listener(height));
}

/** Immediately invoked with the current height, then again on every change. */
export function subscribeBottomNavBarHeight(listener) {
  listener(currentNavBarHeight);
  navBarHeightListeners.add(listener);
  return () => navBarHeightListeners.delete(listener);
}
