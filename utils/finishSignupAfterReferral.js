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
import {
  setOauthPendingProfileIdentity,
  setOauthProfileSetupStatus,
  withOauthIdentityOnPayload,
  mergePendingOauthPhotoIntoPayload,
} from "./oauthPendingProfileImage";

/**
 * Hydrate session profile cache so Connect MiniCard shows OAuth names/photo immediately
 * (without waiting for the user to open Profile).
 */
async function hydrateSessionAfterSignup(profileUid, apiPayload, { profilePicture = "", firstName = "", lastName = "" } = {}) {
  const uid = String(profileUid || "").trim();
  if (!uid) return;
  try {
    if (apiPayload?.personal_info) {
      const withIdentity = withOauthIdentityOnPayload(apiPayload, { firstName, lastName, profilePicture });
      const saved = await saveSessionProfilePayload(withIdentity);
      if (saved) {
        console.log("[GooglePhoto] session hydrated", {
          firstName: saved?.personalInfo?.profile_personal_first_name || withIdentity?.personal_info?.profile_personal_first_name,
          lastName: saved?.personalInfo?.profile_personal_last_name || withIdentity?.personal_info?.profile_personal_last_name,
          image: saved?.personalInfo?.profile_personal_image || withIdentity?.personal_info?.profile_personal_image,
          imageIsPublic: saved?.personalInfo?.profile_personal_image_is_public || withIdentity?.personal_info?.profile_personal_image_is_public,
        });
        return;
      }
    }
  } catch (_) {
    /* fall through to network refresh */
  }
  try {
    const session = await refreshSessionProfileFromNetwork(uid);
    const raw = session?.rawProfile;
    if (raw) {
      const merged = withOauthIdentityOnPayload(raw, { firstName, lastName, profilePicture });
      await saveSessionProfilePayload(merged);
      console.log(
        "[GooglePhoto] session after network hydrate image =",
        (await mergePendingOauthPhotoIntoPayload(merged))?.personal_info?.profile_personal_image,
      );
    }
  } catch (e) {
    console.warn("createMinimalSignupProfile: session hydrate failed", e?.message || e);
  }
}

/**
 * Attach OAuth photo for profile PUT/POST.
 * Native: download bytes into multipart `profile_image` (same as EditProfile).
 * Web: skip browser fetch (Google CDN CORS) and send the URL as `profile_personal_image`
 * so the BE can store it (or MiniCard can still use the session URL immediately).
 */
async function appendOAuthProfileImage(formData, photoUrl) {
  const url = String(photoUrl || "").trim();
  console.log("[GooglePhoto] appendOAuthProfileImage photoUrl =", url);
  if (!url || !/^https?:\/\//i.test(url)) {
    console.log("[GooglePhoto] appendOAuthProfileImage skipped — empty or non-http URL");
    return false;
  }

  try {
    if (Platform.OS === "web") {
      // Do not fetch googleusercontent in the browser — CORS blocks reading bytes.
      // Persist the URL into profile_personal_image; Image can display it directly.
      formData.append("profile_personal_image", url);
      console.log("[GooglePhoto] web: appending profile_personal_image URL (no blob fetch)");
      return true;
    }

    const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!baseDir) {
      formData.append("profile_personal_image", url);
      return true;
    }
    const tempUri = `${baseDir}oauth_profile_${Date.now()}.jpg`;
    const downloaded = await FileSystem.downloadAsync(url, tempUri);
    if (downloaded.status !== 200) throw new Error(`Download ${downloaded.status}`);
    formData.append("profile_image", {
      uri: downloaded.uri,
      name: "profile.jpg",
      type: "image/jpeg",
    });
    console.log("[GooglePhoto] native: appended profile_image file");
    return true;
  } catch (e) {
    console.warn("[GooglePhoto] appendOAuthProfileImage failed, falling back to URL:", e?.message || e);
    try {
      formData.append("profile_personal_image", url);
      return true;
    } catch (_) {
      return false;
    }
  }
}

async function attachOAuthPhotoFields(formData, profilePicture) {
  const attached = await appendOAuthProfileImage(formData, profilePicture);
  if (attached) {
    formData.append("profile_personal_image_is_public", "1");
  }
  return attached;
}

function existingProfileHasImage(existing) {
  const img = existing?.personal_info?.profile_personal_image;
  return Boolean(img && String(img).trim());
}

/**
 * Best-effort: upload OAuth photo (+ names when provided) onto an existing profile_uid. Never throws.
 */
async function uploadOAuthPhotoIfPresent(profileUid, userUid, profilePicture, { firstName = "", lastName = "" } = {}) {
  const uid = String(profileUid || "").trim();
  const photo = String(profilePicture || "").trim();
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  if (!uid || (!photo && !first && !last)) return null;

  try {
    const putData = new FormData();
    putData.append("profile_uid", uid);
    if (userUid) putData.append("user_uid", String(userUid));
    if (first) putData.append("profile_personal_first_name", first);
    if (last) putData.append("profile_personal_last_name", last);
    let attached = false;
    if (photo) {
      attached = await attachOAuthPhotoFields(putData, photo);
    }
    if (!attached && !first && !last) return null;
    console.log("[GooglePhoto] PUT userprofileinfo with OAuth identity for", uid, { photo: !!photo, first, last });
    const putRes = await fetch(USER_PROFILE_INFO_ENDPOINT, { method: "PUT", body: putData });
    const putBody = await putRes.json().catch(() => null);
    if (!putRes.ok) {
      console.warn("[GooglePhoto] uploadOAuthPhotoIfPresent: PUT failed", putRes.status, putBody);
      return null;
    }
    console.log(
      "[GooglePhoto] PUT response image =",
      putBody?.personal_info?.profile_personal_image || putBody?.profile_personal_image || "(none in body)",
    );
    return putBody;
  } catch (e) {
    console.warn("[GooglePhoto] uploadOAuthPhotoIfPresent failed:", e?.message || e);
    return null;
  }
}

/**
 * Create a stub personal profile (skips UserInfo name/phone screen) and persist profile_uid.
 * When profilePicture (e.g. Google photo URL) is present, store it for MiniCard immediately
 * and best-effort persist to profile_personal_image.
 */
export async function createMinimalSignupProfile({
  userUid,
  referralUid,
  firstName = "",
  lastName = "",
  phoneNumber = "",
  profilePicture = "",
} = {}) {
  console.log("[GooglePhoto] createMinimalSignupProfile profilePicture =", profilePicture, "name =", firstName, lastName);
  const uid = String(userUid || "").trim();
  if (!uid) throw new Error("User UID not found");

  const photo = String(profilePicture || "").trim();
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  const identityOpts = { profilePicture: photo, firstName: first, lastName: last };

  await setOauthPendingProfileIdentity(identityOpts);
  if (photo || first || last) {
    await setOauthProfileSetupStatus("pending");
  } else {
    await setOauthProfileSetupStatus("done");
  }

  let referredBy = String(referralUid || "").trim() || "100-000001";
  if (referredBy === uid) referredBy = "100-000001";

  try {
    const existingRes = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${uid}`);
    if (existingRes.ok) {
      const existing = await existingRes.json();
      const existingUid = profileUidFromUserProfileResponse(existing);
      if (existingUid) {
        await AsyncStorage.setItem("profile_uid", existingUid);

        // Show Google name/photo on MiniCard immediately (before PUT).
        await hydrateSessionAfterSignup(existingUid, existing, identityOpts);

        let payload = existing;
        const existingPi = existing?.personal_info || {};
        const needsName =
          (first && !String(existingPi.profile_personal_first_name || "").trim()) ||
          (last && !String(existingPi.profile_personal_last_name || "").trim());
        if ((photo && !existingProfileHasImage(existing)) || needsName) {
          const updated = await uploadOAuthPhotoIfPresent(existingUid, uid, photo, { firstName: first, lastName: last });
          if (updated) payload = null; // force GET so session prefers BE/S3 URL when present
          await hydrateSessionAfterSignup(existingUid, payload, identityOpts);
          await setOauthProfileSetupStatus(updated ? "done" : "failed");
        } else {
          await setOauthProfileSetupStatus("done");
        }

        return existingUid;
      }
    }
  } catch (_) {
    /* create below */
  }

  const formData = new FormData();
  formData.append("profile_personal_first_name", first);
  formData.append("profile_personal_last_name", last);
  formData.append("profile_personal_phone_number", phoneNumber || "");
  formData.append("profile_personal_referred_by", referredBy);
  formData.append("user_uid", uid);
  // Persist Google URL on create so profile_personal_image is set without a client blob fetch.
  if (photo) {
    formData.append("profile_personal_image", photo);
    formData.append("profile_personal_image_is_public", "1");
    console.log("[GooglePhoto] POST create includes profile_personal_image URL");
  }

  const response = await fetch(USER_PROFILE_INFO_ENDPOINT, {
    method: "POST",
    body: formData,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (photo) await setOauthProfileSetupStatus("failed");
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

  // Immediate MiniCard display from Google name/photo (do not wait on PUT).
  await hydrateSessionAfterSignup(profileUid, withOauthIdentityOnPayload(body, identityOpts), identityOpts);

  // Best-effort PUT (native file / web URL) so DB has the image even if POST ignored the URL field.
  let hydratePayload = withOauthIdentityOnPayload(body, identityOpts);
  if (profileUid && (photo || first || last) && (!existingProfileHasImage(body) || first || last)) {
    const updated = await uploadOAuthPhotoIfPresent(profileUid, uid, photo, { firstName: first, lastName: last });
    if (updated) hydratePayload = null;
    await hydrateSessionAfterSignup(profileUid, hydratePayload, identityOpts);
    await setOauthProfileSetupStatus(updated ? "done" : "failed");
  } else {
    await setOauthProfileSetupStatus("done");
  }

  return profileUid;
}

/**
 * After account + referrer are known: stub profile, then QR → Connect + reverse-contact notify, else AccountType.
 */
export async function finishSignupAfterReferral(
  navigation,
  { referralUid, routeParams = {}, userUid, email, firstName = "", lastName = "", profilePicture = "" } = {},
) {
  console.log("[GooglePhoto] finishSignupAfterReferral profilePicture =", profilePicture);
  const uid = String(userUid || (await AsyncStorage.getItem("user_uid")) || "").trim();
  const mail = String(email || (await getUserEmail()) || "").trim();
  if (!uid) throw new Error("User UID not found");

  const ref = String(referralUid || "").trim();
  if (ref) {
    await AsyncStorage.setItem("referral_uid", ref);
  }

  try {
    await createMinimalSignupProfile({
      userUid: uid,
      referralUid: ref,
      firstName,
      lastName,
      profilePicture,
    });
  } catch (err) {
    await setOauthProfileSetupStatus("failed");
    throw err;
  }

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
    awaitingProfileSetup: Boolean(String(profilePicture || "").trim()),
  });
}
