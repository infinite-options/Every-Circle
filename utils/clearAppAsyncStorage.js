import AsyncStorage from "@react-native-async-storage/async-storage";
import { USER_PROFILE_JSON_CACHE_KEY, clearSessionProfileCache } from "./sessionProfile";

/**
 * Keys preserved after purge so users aren't forced through terms/cookies UI again after logout or a wipe.
 */
export const PRESERVE_KEYS = ["termsAccepted", "allowCookies"];

const VIEWER_PROFILE_PATH_KEY = "viewer_profile_personal_path_v1";
const OFFERING_RESPONSES_PREFIX = "offering_message_responses_";
const WISH_RESPONSES_PREFIX = "wish_message_responses_";
const PROFILE_RESPONSE_PREFIXES = [OFFERING_RESPONSES_PREFIX, WISH_RESPONSES_PREFIX];

/** Exact AsyncStorage keys that belong to the logged-in session (not prefix-matched). */
const SESSION_EXACT_KEYS = new Set([
  USER_PROFILE_JSON_CACHE_KEY,
  VIEWER_PROFILE_PATH_KEY,
  "user_uid",
  "user_email_id",
  "profile_uid",
  "user_id",
  "user_name",
  "user_email",
  "user_first_name",
  "user_last_name",
  "user_phone_number",
  "displayEmail",
  "displayPhone",
  "darkMode",
  "isThirdPartyAuth",
  "businessFormData",
  "my_business_uids",
  "user_ratings_info",
  "shareLiveLocationUntil",
  "receipt_choices_by_bs_uid",
  "auto_paid_transaction_ids",
  "cachedProfileData",
  "referral_uid",
  "referral_email",
  "form_switch_enabled",
  "nearby_share_settings",
  "nearby_ignored_uids",
]);

/** Cleared on every login even when the same user is resuming. */
const LOGIN_ALWAYS_CLEAR_EXACT = new Set(["referral_uid", "referral_email"]);

/** Prefixes for keys that are session-scoped (may include dynamic suffixes). */
const SESSION_KEY_PREFIXES = [
  "last_search_query_",
  "last_search_type_",
  "last_search_results_",
  "return_request_",
  "return_status_",
  "cart_",
  "apple_",
  "network_",
  OFFERING_RESPONSES_PREFIX,
  WISH_RESPONSES_PREFIX,
];

const APPLE_KEY_PREFIX = "apple_";
const LEGACY_SESSION_KEY = "session_bound_user_uid";

const LAST_SEARCH_KEY_PREFIXES = ["last_search_query_", "last_search_type_", "last_search_results_"];

function isLastSearchCacheKey(key) {
  return LAST_SEARCH_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function userUidFromLastSearchKey(key) {
  for (const prefix of LAST_SEARCH_KEY_PREFIXES) {
    if (key.startsWith(prefix)) return key.slice(prefix.length);
  }
  return "";
}

function isSessionStorageKey(key) {
  if (SESSION_EXACT_KEYS.has(key)) return true;
  return SESSION_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function profileUidFromCachedJson(json) {
  const pi = json?.personal_info;
  return String(
    pi?.profile_personal_uid || pi?.profile_uid || json?.profile_personal_uid || json?.profile_uid || "",
  ).trim();
}

async function resolveKeepProfileUidForUser(userUid, priorUserUid) {
  if (!userUid || priorUserUid !== userUid) return "";
  const storedProfileUid = String((await AsyncStorage.getItem("profile_uid")) || "").trim();
  if (!storedProfileUid) return "";

  try {
    const raw = await AsyncStorage.getItem(USER_PROFILE_JSON_CACHE_KEY);
    if (!raw) return storedProfileUid;
    const parsed = JSON.parse(raw);
    const fromPayload = profileUidFromCachedJson(parsed);
    if (fromPayload && fromPayload !== storedProfileUid) return "";
  } catch (_) {
    return storedProfileUid;
  }

  return storedProfileUid;
}

function shouldRemoveKeyOnLogin(key, ctx) {
  const { userUid, keepProfileUid, sameUserResuming, preserve } = ctx;

  if (preserve.has(key)) return false;
  if (PRESERVE_KEYS.includes(key)) return false;
  if (!isSessionStorageKey(key)) return false;

  // Apple Sign-In credential cache is device-scoped, not tied to the app user account.
  if (key.startsWith(APPLE_KEY_PREFIX)) return false;

  if (LOGIN_ALWAYS_CLEAR_EXACT.has(key)) return true;

  if (isLastSearchCacheKey(key)) {
    return userUidFromLastSearchKey(key) !== userUid;
  }

  for (const prefix of PROFILE_RESPONSE_PREFIXES) {
    if (key.startsWith(prefix)) {
      const suffix = key.slice(prefix.length);
      return !keepProfileUid || suffix !== keepProfileUid;
    }
  }

  if (sameUserResuming) {
    return false;
  }

  return true;
}

/**
 * On login: remove session data that does not belong to the logging-in user; keep matching caches.
 * Callers must pass previousUserUid read from AsyncStorage before overwriting user_uid.
 * @param {{ userUid: string, previousUserUid?: string, preserveKeys?: string[] }} options
 */
export async function clearSessionAsyncStorageOnLogin({ userUid, previousUserUid, preserveKeys = [] } = {}) {
  const uid = String(userUid || "").trim();
  if (!uid) return 0;

  const priorUserUid = String(previousUserUid || "").trim();
  const sameUserResuming = priorUserUid === uid;
  const keepProfileUid = await resolveKeepProfileUidForUser(uid, priorUserUid);

  const preserve = new Set([...PRESERVE_KEYS, ...preserveKeys.map(String)]);

  const allKeys = await AsyncStorage.getAllKeys();
  const ctx = { userUid: uid, keepProfileUid, sameUserResuming, preserve };
  const toRemove = allKeys.filter((key) => {
    if (key === LEGACY_SESSION_KEY) return true;
    return shouldRemoveKeyOnLogin(key, ctx);
  });

  if (toRemove.length) {
    await AsyncStorage.multiRemove(toRemove);
  }

  if (toRemove.includes(USER_PROFILE_JSON_CACHE_KEY)) {
    clearSessionProfileCache();
  }

  return toRemove.length;
}

/**
 * Remove all session-scoped AsyncStorage keys (logout).
 * @param {{ preserveKeys?: string[] }} [options]
 */
export async function clearSessionAsyncStorage(options = {}) {
  const preserve = new Set([...PRESERVE_KEYS, ...(options.preserveKeys || []).map(String)]);

  const allKeys = await AsyncStorage.getAllKeys();
  const toRemove = allKeys.filter((key) => {
    if (key === LEGACY_SESSION_KEY) return true;
    if (preserve.has(key)) return false;
    if (!isSessionStorageKey(key)) return false;
    return true;
  });

  if (toRemove.length) {
    await AsyncStorage.multiRemove(toRemove);
  }
  clearSessionProfileCache();
  return toRemove.length;
}

/** @deprecated Prefer clearSessionAsyncStorageOnLogin */
export async function clearLastSearchCacheKeys(keepUserUid) {
  return clearSessionAsyncStorageOnLogin({ userUid: keepUserUid });
}

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
  clearSessionProfileCache();
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
