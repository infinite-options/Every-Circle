import AsyncStorage from "@react-native-async-storage/async-storage";

/** Google/Apple photo URL kept until the API returns a stored profile_personal_image. */
export const OAUTH_PENDING_PROFILE_IMAGE_KEY = "oauth_pending_profile_image";

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

function profileHasImage(apiPayload) {
  const img = apiPayload?.personal_info?.profile_personal_image;
  return Boolean(img && String(img).trim());
}

/**
 * If API/session payload has no image, inject the OAuth photo URL and mark it public
 * so MiniCard can show it immediately.
 */
export function withOauthPhotoOnPayload(apiPayload, photoUrl) {
  const photo = String(photoUrl || "").trim();
  if (!photo || !apiPayload || typeof apiPayload !== "object") return apiPayload;
  if (profileHasImage(apiPayload)) return apiPayload;
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

/** Merge pending OAuth photo into a profile API payload when the BE has no image yet. */
export async function mergePendingOauthPhotoIntoPayload(apiPayload) {
  if (!apiPayload || profileHasImage(apiPayload)) {
    if (apiPayload && profileHasImage(apiPayload)) {
      await clearOauthPendingProfileImage();
    }
    return apiPayload;
  }
  const pending = await getOauthPendingProfileImage();
  return withOauthPhotoOnPayload(apiPayload, pending);
}
