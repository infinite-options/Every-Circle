import AsyncStorage from "@react-native-async-storage/async-storage";
import { isApiPublicFlag } from "./apiPublicFlag";

/** Google/Apple photo URL kept until the API returns a stored profile_personal_image. */
export const OAUTH_PENDING_PROFILE_IMAGE_KEY = "oauth_pending_profile_image";
/** JSON `{ firstName, lastName }` from OAuth until the API/session has names. */
export const OAUTH_PENDING_PROFILE_NAME_KEY = "oauth_pending_profile_name";
/** pending | done | failed — AccountType waits while pending so users can't tap early. */
export const OAUTH_PROFILE_SETUP_STATUS_KEY = "oauth_profile_setup_status";

export async function setOauthPendingProfileImage(url) {
  const photo = String(url || "").trim();
  if (!photo || !/^https?:\/\//i.test(photo)) {
    await clearOauthPendingProfileImage();
    return false;
  }
  try {
    await AsyncStorage.setItem(OAUTH_PENDING_PROFILE_IMAGE_KEY, photo);
    console.log("[GooglePhoto] pending profile image saved =", photo);
    return true;
  } catch (e) {
    console.warn("[GooglePhoto] failed to save pending image:", e?.message || e);
    return false;
  }
}

export async function getOauthPendingProfileImage() {
  try {
    const photo = String((await AsyncStorage.getItem(OAUTH_PENDING_PROFILE_IMAGE_KEY)) || "").trim();
    return photo && /^https?:\/\//i.test(photo) ? photo : "";
  } catch {
    return "";
  }
}

export async function clearOauthPendingProfileImage() {
  try {
    await AsyncStorage.removeItem(OAUTH_PENDING_PROFILE_IMAGE_KEY);
  } catch (_) {}
}

export async function setOauthPendingProfileNames({ firstName = "", lastName = "" } = {}) {
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  try {
    if (!first && !last) {
      await AsyncStorage.removeItem(OAUTH_PENDING_PROFILE_NAME_KEY);
      return false;
    }
    await AsyncStorage.setItem(OAUTH_PENDING_PROFILE_NAME_KEY, JSON.stringify({ firstName: first, lastName: last }));
    console.log("[GooglePhoto] pending profile names saved =", { firstName: first, lastName: last });
    return true;
  } catch (e) {
    console.warn("[GooglePhoto] failed to save pending names:", e?.message || e);
    return false;
  }
}

export async function getOauthPendingProfileNames() {
  try {
    const raw = await AsyncStorage.getItem(OAUTH_PENDING_PROFILE_NAME_KEY);
    if (!raw) return { firstName: "", lastName: "" };
    const parsed = JSON.parse(raw);
    return {
      firstName: String(parsed?.firstName || "").trim(),
      lastName: String(parsed?.lastName || "").trim(),
    };
  } catch {
    return { firstName: "", lastName: "" };
  }
}

export async function clearOauthPendingProfileNames() {
  try {
    await AsyncStorage.removeItem(OAUTH_PENDING_PROFILE_NAME_KEY);
  } catch (_) {}
}

/** Persist OAuth name + photo for Connect MiniCard until the API/session is complete. */
export async function setOauthPendingProfileIdentity({ firstName = "", lastName = "", profilePicture = "" } = {}) {
  await setOauthPendingProfileNames({ firstName, lastName });
  await setOauthPendingProfileImage(profilePicture);
}

export async function setOauthProfileSetupStatus(status) {
  const value = String(status || "").trim();
  try {
    if (!value) {
      await AsyncStorage.removeItem(OAUTH_PROFILE_SETUP_STATUS_KEY);
      return;
    }
    await AsyncStorage.setItem(OAUTH_PROFILE_SETUP_STATUS_KEY, value);
  } catch (_) {}
}

export async function getOauthProfileSetupStatus() {
  try {
    return String((await AsyncStorage.getItem(OAUTH_PROFILE_SETUP_STATUS_KEY)) || "").trim();
  } catch {
    return "";
  }
}

function profileHasImage(apiPayload) {
  const img = apiPayload?.personal_info?.profile_personal_image;
  return Boolean(img && String(img).trim());
}

function profileHasName(apiPayload) {
  const p = apiPayload?.personal_info || {};
  return Boolean(String(p.profile_personal_first_name || "").trim() || String(p.profile_personal_last_name || "").trim());
}

/**
 * Inject OAuth photo URL when the profile has no image yet, and mark Display=on for that new photo.
 * Does NOT override an existing image that the user (or API) has set to Display=off.
 */
export function withOauthPhotoOnPayload(apiPayload, photoUrl) {
  const photo = String(photoUrl || "").trim();
  if (!apiPayload || typeof apiPayload !== "object") return apiPayload;
  if (profileHasImage(apiPayload)) return apiPayload;
  if (!photo) return apiPayload;
  const personalInfo = apiPayload.personal_info && typeof apiPayload.personal_info === "object" ? apiPayload.personal_info : {};
  return {
    ...apiPayload,
    personal_info: {
      ...personalInfo,
      profile_personal_image: photo,
      profile_personal_image_is_public: 1,
    },
  };
}

/** Fill empty name fields from OAuth signup. */
export function withOauthNamesOnPayload(apiPayload, { firstName = "", lastName = "" } = {}) {
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  if (!apiPayload || typeof apiPayload !== "object") return apiPayload;
  if (!first && !last) return apiPayload;
  const personalInfo = apiPayload.personal_info && typeof apiPayload.personal_info === "object" ? apiPayload.personal_info : {};
  const existingFirst = String(personalInfo.profile_personal_first_name || "").trim();
  const existingLast = String(personalInfo.profile_personal_last_name || "").trim();
  if (existingFirst && existingLast) return apiPayload;
  return {
    ...apiPayload,
    personal_info: {
      ...personalInfo,
      profile_personal_first_name: existingFirst || first,
      profile_personal_last_name: existingLast || last,
    },
  };
}

export function withOauthIdentityOnPayload(apiPayload, { firstName = "", lastName = "", profilePicture = "" } = {}) {
  let next = withOauthNamesOnPayload(apiPayload, { firstName, lastName });
  next = withOauthPhotoOnPayload(next, profilePicture);
  return next;
}

/** Merge pending OAuth photo into a profile API payload when the BE has no image yet. */
export async function mergePendingOauthPhotoIntoPayload(apiPayload) {
  if (!apiPayload) return apiPayload;
  if (profileHasImage(apiPayload)) {
    await clearOauthPendingProfileImage();
    return apiPayload;
  }
  const pending = await getOauthPendingProfileImage();
  return withOauthPhotoOnPayload(apiPayload, pending);
}

/** Merge pending OAuth name + photo so Connect MiniCard shows identity right after signup. */
export async function mergePendingOauthIdentityIntoPayload(apiPayload) {
  if (!apiPayload) return apiPayload;
  const names = await getOauthPendingProfileNames();
  const photo = await getOauthPendingProfileImage();
  const merged = withOauthIdentityOnPayload(apiPayload, {
    firstName: names.firstName,
    lastName: names.lastName,
    profilePicture: photo,
  });
  if (profileHasName(merged) && profileHasImage(merged) && isApiPublicFlag(merged?.personal_info?.profile_personal_image_is_public)) {
    if (profileHasName(apiPayload) && profileHasImage(apiPayload) && isApiPublicFlag(apiPayload?.personal_info?.profile_personal_image_is_public)) {
      await clearOauthPendingProfileNames();
      await clearOauthPendingProfileImage();
    }
  }
  return merged;
}
