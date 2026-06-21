import AsyncStorage from "@react-native-async-storage/async-storage";
import { USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "./httpMiddleware";
import { persistMyBusinessUidsFromProfile } from "./myBusinessUids";

/** Full GET /api/v1/userprofileinfo/:id JSON for the logged-in user — persisted for offline reuse across screens */
export const USER_PROFILE_JSON_CACHE_KEY = "user_profile_info_json_cache_v1";
/** Lightweight fallback when profile JSON cache is cleared but viewer path is still needed (e.g. connection degree). */
const VIEWER_PROFILE_PATH_KEY = "viewer_profile_personal_path_v1";

let cachedSessionProfile = null;

function normalizeBizUids(profileJson) {
  return (profileJson?.business_info || []).map((b) => b.business_uid).filter(Boolean);
}

function buildSessionFromRaw(json, profileUid) {
  return {
    profileUid,
    businessUids: normalizeBizUids(json),
    businessInfo: json?.business_info || [],
    personalInfo: json?.personal_info || null,
    userEmail: json?.user_email || null,
    rawProfile: json || null,
  };
}

function profileUidFromPayload(json) {
  const pi = json?.personal_info;
  if (pi?.profile_personal_uid != null && String(pi.profile_personal_uid).trim() !== "") {
    return String(pi.profile_personal_uid).trim();
  }
  return "";
}

/**
 * Reads persisted profile JSON only if it belongs to the same profile_uid as AsyncStorage (logged-in user).
 */
async function readCachedProfileJsonForCurrentUser(expectedProfileUid) {
  if (!expectedProfileUid) return null;
  try {
    const raw = await AsyncStorage.getItem(USER_PROFILE_JSON_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const fromPayload = profileUidFromPayload(parsed);
    if (!fromPayload || fromPayload !== String(expectedProfileUid).trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function hydrateFromStorage() {
  const profileUidRaw = await AsyncStorage.getItem("profile_uid");
  const profileUid = profileUidRaw ? String(profileUidRaw).trim() : "";
  if (!profileUid) return null;

  let businessUids = [];
  try {
    const raw = await AsyncStorage.getItem("my_business_uids");
    businessUids = JSON.parse(raw || "[]");
    if (!Array.isArray(businessUids)) businessUids = [];
  } catch (_) {
    businessUids = [];
  }

  const cachedJson = await readCachedProfileJsonForCurrentUser(profileUid);
  if (cachedJson) {
    return buildSessionFromRaw(cachedJson, profileUid);
  }

  return {
    profileUid,
    businessUids,
    businessInfo: [],
    personalInfo: null,
    userEmail: null,
    rawProfile: null,
  };
}

/**
 * Persist full userprofileinfo JSON and refresh in-memory session (logged-in user only).
 * Call after ProfileScreen loads or EditProfile saves (via refreshSessionProfileFromNetwork).
 */
export async function saveSessionProfilePayload(json) {
  const profileUid = await AsyncStorage.getItem("profile_uid");
  if (!profileUid) return null;
  const trimmed = String(profileUid).trim();
  const payloadUid = profileUidFromPayload(json);
  if (payloadUid && payloadUid !== trimmed) {
    console.warn("saveSessionProfilePayload: payload profile uid mismatch, not caching");
    return null;
  }
  try {
    await AsyncStorage.setItem(USER_PROFILE_JSON_CACHE_KEY, JSON.stringify(json));
  } catch (e) {
    console.warn("saveSessionProfilePayload: AsyncStorage failed", e);
  }

  const path = json?.personal_info?.profile_personal_path;
  if (path != null && String(path).trim() !== "") {
    try {
      await AsyncStorage.setItem(VIEWER_PROFILE_PATH_KEY, String(path).trim());
    } catch (_) {}
  }

  const session = buildSessionFromRaw(json, trimmed);
  cachedSessionProfile = session;
  try {
    await persistMyBusinessUidsFromProfile(json);
  } catch (_) {}
  return session;
}

/** Single network GET — only ProfileScreen / EditProfile refresh should call this for the current user. */
export async function refreshSessionProfileFromNetwork(profileUidOptional) {
  const uid = (profileUidOptional || (await AsyncStorage.getItem("profile_uid")) || "").trim();
  if (!uid) return null;
  const res = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${uid}`);
  const json = await res.json();
  return saveSessionProfilePayload(json);
}

/**
 * Session snapshot for the logged-in user. Loads from memory, then AsyncStorage-backed profile JSON.
 * Does not call the userprofileinfo API — use refreshSessionProfileFromNetwork from Profile / after edits.
 *
 * @param {{ forceRefresh?: boolean }} opts forceRefresh clears memory and re-reads AsyncStorage (no network).
 */
export async function getSessionProfile({ forceRefresh = false } = {}) {
  if (forceRefresh) {
    cachedSessionProfile = null;
  }
  if (!cachedSessionProfile) {
    cachedSessionProfile = await hydrateFromStorage();
  }
  return cachedSessionProfile;
}

export function clearSessionProfileCache() {
  cachedSessionProfile = null;
}

export async function clearStoredUserProfileJson() {
  try {
    await AsyncStorage.removeItem(USER_PROFILE_JSON_CACHE_KEY);
  } catch (_) {}
}

/** Logged-in viewer's profile_personal_path for referral-tree distance (session JSON, then dedicated fallback key). */
export async function getViewerProfilePersonalPath() {
  const session = await getSessionProfile();
  const fromSession =
    session?.personalInfo?.profile_personal_path ?? session?.rawProfile?.personal_info?.profile_personal_path ?? null;
  if (fromSession != null && String(fromSession).trim() !== "") {
    const trimmed = String(fromSession).trim();
    try {
      await AsyncStorage.setItem(VIEWER_PROFILE_PATH_KEY, trimmed);
    } catch (_) {}
    return trimmed;
  }
  try {
    const cached = await AsyncStorage.getItem(VIEWER_PROFILE_PATH_KEY);
    if (cached != null && String(cached).trim() !== "") return String(cached).trim();
  } catch (_) {}
  return null;
}

/** Call on logout / session reset alongside clearing profile_uid */
export async function clearUserProfileCacheStorage() {
  await clearStoredUserProfileJson();
  try {
    await AsyncStorage.removeItem(VIEWER_PROFILE_PATH_KEY);
  } catch (_) {}
  clearSessionProfileCache();
}
