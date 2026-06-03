import AsyncStorage from "@react-native-async-storage/async-storage";
import { USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";
import { decryptResponse } from "./encryption";

/** Extract profile_personal_uid / profile_uid from a userprofileinfo API payload. */
export function profileUidFromUserProfileResponse(apiUser) {
  if (!apiUser || typeof apiUser !== "object") return null;
  if (apiUser.message === "Profile not found for this user" || apiUser.code === 404) {
    return null;
  }
  const p = apiUser.personal_info || apiUser.profile_info || {};
  const profileId =
    apiUser.profile_uid ||
    apiUser.profile_personal_uid ||
    p.profile_personal_uid ||
    p.profile_uid ||
    apiUser.data?.personal_info?.profile_personal_uid ||
    null;
  return profileId ? String(profileId) : null;
}

/**
 * After login/signup, resolve and persist profile_uid from user_uid (GET userprofileinfo by user id).
 * @returns {Promise<string|null>} profile_uid or null if no profile yet
 */
export async function ensureSessionProfileUid(userUid) {
  if (!userUid) return null;

  try {
    const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${userUid}`);
    if (!response.ok) return null;

    const apiUser = decryptResponse(await response.json());
    const profileId = profileUidFromUserProfileResponse(apiUser);

    if (profileId) {
      await AsyncStorage.setItem("profile_uid", profileId);
      return profileId;
    }
  } catch (e) {
    console.warn("ensureSessionProfileUid failed:", e?.message || e);
  }
  return null;
}

/** Read profile_uid from storage, or fetch by user_uid after new signup. */
export async function resolveScannerProfileUid() {
  try {
    const existing = await AsyncStorage.getItem("profile_uid");
    if (existing) return String(existing).trim();
    const userUid = await AsyncStorage.getItem("user_uid");
    if (userUid) {
      return await ensureSessionProfileUid(userUid);
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}
