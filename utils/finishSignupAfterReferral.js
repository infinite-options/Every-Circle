import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "./httpMiddleware";
import { profileUidFromUserProfileResponse } from "./ensureSessionProfileUid";
import { refreshCircleTokens } from "./authSession";
import { getUserEmail } from "./emailStorage";
import { goToNetworkForScanConnect } from "./goToNetworkForScanConnect";
import { refreshSessionProfileFromNetwork, saveSessionProfilePayload } from "./sessionProfile";

function withOAuthPhotoFallback(apiPayload, profilePicture) {
  const photo = String(profilePicture || "").trim();
  if (!photo || !apiPayload || typeof apiPayload !== "object") return apiPayload;
  if (existingProfileHasImage(apiPayload)) return apiPayload;
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

/**
 * Hydrate session profile cache so Connect MiniCard shows OAuth names/photo immediately
 * (without waiting for the user to open Profile).
 */
async function hydrateSessionAfterSignup(profileUid, apiPayload, profilePicture = "") {
  const uid = String(profileUid || "").trim();
  if (!uid) return;
  try {
    if (apiPayload?.personal_info) {
      const saved = await saveSessionProfilePayload(withOAuthPhotoFallback(apiPayload, profilePicture));
      if (saved) return;
    }
  } catch (_) {
    /* fall through to network refresh */
  }
  try {
    const session = await refreshSessionProfileFromNetwork(uid);
    const raw = session?.rawProfile;
    if (profilePicture && raw && !existingProfileHasImage(raw)) {
      await saveSessionProfilePayload(withOAuthPhotoFallback(raw, profilePicture));
    }
  } catch (e) {
    console.warn("createMinimalSignupProfile: session hydrate failed", e?.message || e);
  }
}

/**
 * Download a remote OAuth profile photo and append it as multipart `profile_image`
 * (same field EditProfile uses). On web CORS failure, send the URL for the backend to pull.
 * Returns true if photo fields were appended.
 */
async function appendOAuthProfileImage(formData, photoUrl) {
  const url = String(photoUrl || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) return false;

  try {
    if (Platform.OS === "web") {
      try {
        // Use global fetch — not API middleware — for the Google CDN URL.
        const res = await globalThis.fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const type = blob.type || "image/jpeg";
        const ext = (type.split("/")[1] || "jpg").replace("jpeg", "jpg");
        formData.append("profile_image", new File([blob], `profile.${ext}`, { type }));
        return true;
      } catch (blobErr) {
        // Browser cannot fetch Google photo bytes (CORS). Send URL so BE can store/display it.
        console.warn("appendOAuthProfileImage: web blob fetch failed, sending URL", blobErr?.message || blobErr);
        formData.append("profile_personal_image", url);
        return true;
      }
    }

    const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!baseDir) return false;
    const tempUri = `${baseDir}oauth_profile_${Date.now()}.jpg`;
    const downloaded = await FileSystem.downloadAsync(url, tempUri);
    if (downloaded.status !== 200) throw new Error(`Download ${downloaded.status}`);
    formData.append("profile_image", {
      uri: downloaded.uri,
      name: "profile.jpg",
      type: "image/jpeg",
    });
    return true;
  } catch (e) {
    console.warn("appendOAuthProfileImage failed:", e?.message || e);
    return false;
  }
}

async function attachOAuthPhotoFields(formData, profilePicture) {
  const attached = await appendOAuthProfileImage(formData, profilePicture);
  if (attached) {
    // MiniCard only shows the photo when Display is on.
    formData.append("profile_personal_image_is_public", "1");
  }
  return attached;
}

function existingProfileHasImage(existing) {
  const img = existing?.personal_info?.profile_personal_image;
  return Boolean(img && String(img).trim());
}

/**
 * Best-effort: upload OAuth photo onto an existing profile_uid. Never throws.
 */
async function uploadOAuthPhotoIfPresent(profileUid, userUid, profilePicture) {
  const uid = String(profileUid || "").trim();
  const photo = String(profilePicture || "").trim();
  if (!uid || !photo) return null;

  try {
    const putData = new FormData();
    putData.append("profile_uid", uid);
    if (userUid) putData.append("user_uid", String(userUid));
    const attached = await attachOAuthPhotoFields(putData, photo);
    if (!attached) return null;
    const putRes = await fetch(USER_PROFILE_INFO_ENDPOINT, { method: "PUT", body: putData });
    if (!putRes.ok) {
      console.warn("uploadOAuthPhotoIfPresent: PUT failed", putRes.status);
      return null;
    }
    return await putRes.json().catch(() => null);
  } catch (e) {
    console.warn("uploadOAuthPhotoIfPresent failed:", e?.message || e);
    return null;
  }
}

/**
 * Create a stub personal profile (skips UserInfo name/phone screen) and persist profile_uid.
 * Name/phone may be empty — BE should accept stubs so users can complete profile later.
 * When profilePicture (e.g. Google photo URL) is present, upload it as the profile image.
 */
export async function createMinimalSignupProfile({
  userUid,
  referralUid,
  firstName = "",
  lastName = "",
  phoneNumber = "",
  profilePicture = "",
} = {}) {
  const uid = String(userUid || "").trim();
  if (!uid) throw new Error("User UID not found");

  let referredBy = String(referralUid || "").trim() || "100-000001";
  if (referredBy === uid) referredBy = "100-000001";

  try {
    const existingRes = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${uid}`);
    if (existingRes.ok) {
      const existing = await existingRes.json();
      const existingUid = profileUidFromUserProfileResponse(existing);
      if (existingUid) {
        await AsyncStorage.setItem("profile_uid", existingUid);

        let payload = existing;
        if (profilePicture && !existingProfileHasImage(existing)) {
          const updated = await uploadOAuthPhotoIfPresent(existingUid, uid, profilePicture);
          if (updated) payload = null; // force GET so session gets S3 image URL
        }

        await hydrateSessionAfterSignup(existingUid, payload, profilePicture);
        return existingUid;
      }
    }
  } catch (_) {
    /* create below */
  }

  const formData = new FormData();
  formData.append("profile_personal_first_name", firstName || "");
  formData.append("profile_personal_last_name", lastName || "");
  formData.append("profile_personal_phone_number", phoneNumber || "");
  formData.append("profile_personal_referred_by", referredBy);
  formData.append("user_uid", uid);

  const response = await fetch(USER_PROFILE_INFO_ENDPOINT, {
    method: "POST",
    body: formData,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = body.message || body.error || `Profile create failed (${response.status})`;
    throw new Error(msg);
  }

  const profileUid = profileUidFromUserProfileResponse(body);
  if (profileUid) {
    await AsyncStorage.setItem("profile_uid", profileUid);
  }
  try {
    await refreshCircleTokens();
  } catch (_) {
    /* optional */
  }

  // Photo upload is separate so a CDN/download failure cannot block signup.
  let hydratePayload = body;
  if (profileUid && profilePicture) {
    const updated = await uploadOAuthPhotoIfPresent(profileUid, uid, profilePicture);
    if (updated) hydratePayload = null; // force GET so session gets S3 image URL
  }

  // Connect reads names/photo from session cache (not live API); hydrate before navigating.
  await hydrateSessionAfterSignup(profileUid, hydratePayload, profilePicture);
  return profileUid;
}

/**
 * After account + referrer are known: stub profile, then QR → Connect + reverse-contact notify, else AccountType.
 */
export async function finishSignupAfterReferral(
  navigation,
  { referralUid, routeParams = {}, userUid, email, firstName = "", lastName = "", profilePicture = "" } = {},
) {
  const uid = String(userUid || (await AsyncStorage.getItem("user_uid")) || "").trim();
  const mail = String(email || (await getUserEmail()) || "").trim();
  if (!uid) throw new Error("User UID not found");

  const ref = String(referralUid || "").trim();
  if (ref) {
    await AsyncStorage.setItem("referral_uid", ref);
  }

  await createMinimalSignupProfile({
    userUid: uid,
    referralUid: ref,
    firstName,
    lastName,
    profilePicture,
  });

  const qrOwnerUid = String(routeParams.profile_uid || routeParams.referralProfileUid || "").trim();

  // Same path as UserInfo / Login after scan: open Connect modal and notify QR owner (Exchange Contact Info).
  if (routeParams.returnToScanLanding && qrOwnerUid) {
    await goToNetworkForScanConnect(navigation, qrOwnerUid);
    return;
  }

  if (routeParams.returnToNewConnection && qrOwnerUid) {
    navigation.navigate("NewConnection", { profile_uid: qrOwnerUid });
    return;
  }

  navigation.navigate("AccountType", {
    user_uid: uid,
    email: mail,
  });
}
