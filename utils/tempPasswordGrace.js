import AsyncStorage from "@react-native-async-storage/async-storage";
import { USER_INFO_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "./httpMiddleware";
import { logoutCircleSession, handleAuthSessionExpired } from "./authSession";
import { clearSessionAsyncStorage } from "./clearAppAsyncStorage";

/** Local deadline (epoch ms) for the post-signup auto-login grace window. */
export const TEMP_PASSWORD_GRACE_UNTIL_KEY = "temp_password_grace_until";

const DEFAULT_GRACE_MS = 3 * 60 * 60 * 1000;

const graceMarkedListeners = new Set();

/** Notify App.js (etc.) so an in-session signup can arm the logout timer. */
export function subscribeTempPasswordGraceMarked(listener) {
  if (typeof listener !== "function") return () => {};
  graceMarkedListeners.add(listener);
  return () => graceMarkedListeners.delete(listener);
}

function notifyTempPasswordGraceMarked(until) {
  graceMarkedListeners.forEach((listener) => {
    try {
      listener(until);
    } catch (e) {
      console.warn("tempPasswordGrace listener failed", e?.message || e);
    }
  });
}

/** Override with EXPO_PUBLIC_TEMP_PASSWORD_GRACE_MS (e.g. 60000) for shorter test windows. */
export function getTempPasswordGraceDurationMs() {
  const raw = typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_TEMP_PASSWORD_GRACE_MS : undefined;
  const n = raw != null && String(raw).trim() !== "" ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_GRACE_MS;
}

export async function markTempPasswordGracePeriod() {
  const until = Date.now() + getTempPasswordGraceDurationMs();
  await AsyncStorage.setItem(TEMP_PASSWORD_GRACE_UNTIL_KEY, String(until));
  notifyTempPasswordGraceMarked(until);
  return until;
}

export async function clearTempPasswordGracePeriod() {
  try {
    await AsyncStorage.removeItem(TEMP_PASSWORD_GRACE_UNTIL_KEY);
  } catch (_) {
    /* ignore */
  }
}

export async function getTempPasswordGraceUntil() {
  const raw = await AsyncStorage.getItem(TEMP_PASSWORD_GRACE_UNTIL_KEY);
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function isUserPasswordTemp(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  const s = String(value).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function firstUserInfoRow(result) {
  if (Array.isArray(result?.result)) return result.result[0];
  if (result?.result && typeof result.result === "object") return result.result;
  return result?.data ?? result;
}

/** Best-effort: clear users.user_password_temp so forced logout only happens once. */
export async function clearUserPasswordTempFlag(userUid) {
  const uid = String(userUid || (await AsyncStorage.getItem("user_uid")) || "").trim();
  if (!uid) return false;
  try {
    const response = await fetch(USER_INFO_ENDPOINT, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_uid: uid, user_password_temp: 0 }),
    });
    if (!response.ok) {
      console.warn("clearUserPasswordTempFlag: non-OK", response.status);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("clearUserPasswordTempFlag failed", e?.message || e);
    return false;
  }
}

let forceLogoutInFlight = false;

/**
 * Clear the temp-password flag, end the Circle session, and optionally reset navigation to Home.
 * @returns {Promise<boolean>} true if a logout was performed (or already in flight)
 */
export async function forceLogoutForTempPasswordGrace({ navigateHome = true } = {}) {
  if (forceLogoutInFlight) return true;
  forceLogoutInFlight = true;
  try {
    const uid = String((await AsyncStorage.getItem("user_uid")) || "").trim();
    // Must run while tokens still exist so the PUT is authenticated.
    await clearUserPasswordTempFlag(uid);
    await clearTempPasswordGracePeriod();
    await logoutCircleSession(fetch);
    if (navigateHome) {
      await handleAuthSessionExpired();
    } else {
      await AsyncStorage.multiRemove(["access_token", "refresh_token"]);
      await clearSessionAsyncStorage();
    }
    return true;
  } catch (e) {
    console.warn("forceLogoutForTempPasswordGrace failed", e?.message || e);
    try {
      await clearTempPasswordGracePeriod();
      await clearSessionAsyncStorage();
    } catch (_) {
      /* ignore */
    }
    return true;
  } finally {
    forceLogoutInFlight = false;
  }
}

/**
 * Cold start: if the local 3h window expired (or server still has user_password_temp with no/expired grace),
 * log out and clear the flag. Does not navigate — caller should keep initialRoute at Home.
 */
export async function enforceTempPasswordGraceOnLaunch() {
  const uid = String((await AsyncStorage.getItem("user_uid")) || "").trim();
  if (!uid) return { loggedIn: false, forcedLogout: false };

  let passwordTemp = null;
  try {
    const response = await fetch(`${USER_INFO_ENDPOINT}/${encodeURIComponent(uid)}`);
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      const row = firstUserInfoRow(result);
      passwordTemp = row?.user_password_temp;
    }
  } catch (e) {
    console.warn("enforceTempPasswordGraceOnLaunch: userinfo failed", e?.message || e);
  }

  if (passwordTemp != null && !isUserPasswordTemp(passwordTemp)) {
    await clearTempPasswordGracePeriod();
    return { loggedIn: true, forcedLogout: false };
  }

  const until = await getTempPasswordGraceUntil();
  const graceExpired = until != null && Date.now() >= until;
  const flagForcesLogout = isUserPasswordTemp(passwordTemp) && (until == null || graceExpired);

  if (graceExpired || flagForcesLogout) {
    console.log("enforceTempPasswordGraceOnLaunch: forcing logout", { graceExpired, flagForcesLogout, until });
    await forceLogoutForTempPasswordGrace({ navigateHome: false });
    return { loggedIn: false, forcedLogout: true };
  }

  return { loggedIn: true, forcedLogout: false };
}

/**
 * After GET /userinfo: if still on a temp password and grace is over (or missing), force logout.
 * @returns {Promise<boolean>} true if the user was logged out
 */
export async function enforceTempPasswordGraceFromUserRow(row) {
  if (!row || typeof row !== "object") return false;
  const passwordTemp = row.user_password_temp;

  if (!isUserPasswordTemp(passwordTemp)) {
    await clearTempPasswordGracePeriod();
    return false;
  }

  const until = await getTempPasswordGraceUntil();
  if (until != null && Date.now() < until) return false;

  console.log("enforceTempPasswordGraceFromUserRow: forcing logout", { until, passwordTemp });
  await forceLogoutForTempPasswordGrace({ navigateHome: true });
  return true;
}

/** ms until local grace ends, or null if none / already expired. */
export async function getTempPasswordGraceRemainingMs() {
  const until = await getTempPasswordGraceUntil();
  if (until == null) return null;
  const left = until - Date.now();
  return left > 0 ? left : 0;
}
