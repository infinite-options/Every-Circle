import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "./httpMiddleware";
import { profileUidFromUserProfileResponse } from "./ensureSessionProfileUid";
import { refreshCircleTokens } from "./authSession";
import { getUserEmail } from "./emailStorage";
import { goToNetworkForScanConnect } from "./goToNetworkForScanConnect";
import { flushPendingScanConnectionAfterAuth } from "./pendingScanConnection";
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
 * Fetch remote image bytes for multipart upload.
 * Direct Google CDN fetch often fails CORS on web; fall back to images.weserv.nl proxy.
 */
async function fetchRemoteImageBlob(photoUrl) {
  const url = String(photoUrl || "").trim();
  if (!url) return null;

  const tryFetch = async (fetchUrl, label) => {
    const res = await globalThis.fetch(fetchUrl);
    if (!res.ok) throw new Error(`${label} HTTP ${res.status}`);
    const blob = await res.blob();
    if (!blob || blob.size < 32) throw new Error(`${label} empty blob`);
    return blob;
  };

  try {
    return await tryFetch(url, "direct");
  } catch (directErr) {
    console.warn("[GooglePhoto] direct image fetch failed:", directErr?.message || directErr);
  }

  try {
    // weserv expects host/path without protocol in `url`
    const stripped = url.replace(/^https?:\/\//i, "");
    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}&output=jpg`;
    const blob = await tryFetch(proxyUrl, "proxy");
    console.log("[GooglePhoto] web: got image bytes via proxy, size=", blob.size);
    return blob;
  } catch (proxyErr) {
    console.warn("[GooglePhoto] proxy image fetch failed:", proxyErr?.message || proxyErr);
    return null;
  }
}

/**
 * Attach OAuth photo for profile PUT/POST.
 * Prefers multipart `profile_image` file (same as EditProfile → S3).
 * Always also sends `profile_personal_image` URL so scanners can show it if BE stores the URL.
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
      const blob = await fetchRemoteImageBlob(url);
      if (blob) {
        const type = blob.type && String(blob.type).startsWith("image/") ? blob.type : "image/jpeg";
        const ext = (type.split("/")[1] || "jpg").replace("jpeg", "jpg");
        formData.append("profile_image", new File([blob], `profile.${ext}`, { type }));
        console.log("[GooglePhoto] web: appended profile_image file, bytes≈", blob.size);
      } else {
        console.warn("[GooglePhoto] web: no blob — sending URL only");
      }
      // Always send URL so BE can persist even if file upload is ignored.
      formData.append("profile_personal_image", url);
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
    formData.append("profile_personal_image", url);
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
    // Send both forms — some BE paths expect string, others number.
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
 * After account + referrer are known: stub profile, then open Connect with the referrer
 * (relationship → their Profile). "I was not referred" goes to AccountType.
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

  /** Placeholder used when the user taps "I was not referred" — not a real profile to connect with. */
  const NOT_REFERRED_UID = "110-000001";
  const fromRoute = String(routeParams.profile_uid || routeParams.referralProfileUid || "").trim();
  const connectTargetUid =
    fromRoute && fromRoute !== NOT_REFERRED_UID
      ? fromRoute
      : ref && ref !== NOT_REFERRED_UID
        ? ref
        : "";

  if (routeParams.returnToNewConnection && connectTargetUid) {
    navigation.navigate("NewConnection", { profile_uid: connectTargetUid });
    return;
  }

  // QR guest notes-first: draft was saved on Add to Network — flush + notify owner (no empty Connect with Me).
  const flushResult = await flushPendingScanConnectionAfterAuth({
    scannerIsNewSignup: true,
    relatedProfileUid: connectTargetUid || undefined,
  });
  if (flushResult.flushed) {
    navigation.navigate("Profile", { profile_uid: flushResult.relatedProfileUid });
    return;
  }

  // Home signup + QR scan (no draft): open Connect with Me immediately (Ably notify is backgrounded).
  if (connectTargetUid) {
    await goToNetworkForScanConnect(navigation, connectTargetUid, { scannerIsNewSignup: true });
    return;
  }

  navigation.navigate("AccountType", {
    user_uid: uid,
    email: mail,
    awaitingProfileSetup: Boolean(String(profilePicture || "").trim()),
  });
}
