import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Keys preserved after purge so users aren't forced through terms/cookies UI again after logout or a wipe.
 */
const PRESERVE_KEYS = ["termsAccepted", "allowCookies"];

/**
 * Full AsyncStorage reset. Preserves only `termsAccepted` and `allowCookies`.
 * Use on logout so no session keys, carts, referrals, etc. linger.
 */
export async function clearAppAsyncStorage() {
  const preserved = {};
  await Promise.all(
    PRESERVE_KEYS.map(async (key) => {
      try {
        preserved[key] = await AsyncStorage.getItem(key);
      } catch (_) {
        preserved[key] = null;
      }
    }),
  );
  await AsyncStorage.clear();
  await Promise.all(
    PRESERVE_KEYS.map(async (key) => {
      const val = preserved[key];
      if (val != null) {
        await AsyncStorage.setItem(key, val);
      }
    }),
  );
}

/**
 * Runs on each app JS cold start (process start). Removes signup-only referrer cache so stale
 * `referral_uid`/`referral_email` never carry across killed sessions unless the user is mid-flow
 * in the same run.
 */
export async function clearEphemeralReferralKeysOnLaunch() {
  try {
    await AsyncStorage.multiRemove(["referral_uid", "referral_email"]);
  } catch (e) {
    console.warn("clearEphemeralReferralKeysOnLaunch:", e?.message || e);
  }
}

/**
 * When `EXPO_PUBLIC_CLEAR_ASYNC_STORAGE_ON_COLD_START=true`, wipe all storage (same as logout).
 * Default is off: a full wipe logs the user out on every relaunch because `user_uid` is removed.
 */
export async function maybeClearAllStorageOnColdStartFromEnv() {
  if (typeof process === "undefined" || process.env?.EXPO_PUBLIC_CLEAR_ASYNC_STORAGE_ON_COLD_START !== "true") {
    return;
  }
  console.log("App.js - EXPO_PUBLIC_CLEAR_ASYNC_STORAGE_ON_COLD_START: full AsyncStorage purge");
  await clearAppAsyncStorage();
}
