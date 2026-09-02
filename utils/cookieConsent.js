// utils/cookieConsent.js
//
// Single source of truth for the "allowCookies" preference so the persistent
// bottom banner (components/CookieConsentBanner.js) and the Settings screen
// toggle stay in sync without a nav-state refresh in between.
import AsyncStorage from "@react-native-async-storage/async-storage";

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
