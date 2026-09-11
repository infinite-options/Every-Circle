import AsyncStorage from "@react-native-async-storage/async-storage";
import { USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "./httpMiddleware";
import { profileUidFromUserProfileResponse } from "./ensureSessionProfileUid";
import { refreshCircleTokens } from "./authSession";
import { getUserEmail } from "./emailStorage";

/**
 * Create a stub personal profile (skips UserInfo name/phone screen) and persist profile_uid.
 * Name/phone may be empty — BE should accept stubs so users can complete profile later.
 */
export async function createMinimalSignupProfile({ userUid, referralUid, firstName = "", lastName = "", phoneNumber = "" }) {
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
  return profileUid;
}

/**
 * After account + referrer are known: stub profile, then QR → referrer Profile, else AccountType.
 */
export async function finishSignupAfterReferral(navigation, { referralUid, routeParams = {}, userUid, email, firstName = "", lastName = "" } = {}) {
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
  });

  const qrOwnerUid = String(routeParams.profile_uid || routeParams.referralProfileUid || "").trim();
  const fromQr = !!(routeParams.returnToScanLanding || routeParams.returnToNewConnection) && !!qrOwnerUid;

  if (fromQr) {
    navigation.navigate("Profile", { profile_uid: qrOwnerUid });
    return;
  }

  navigation.navigate("AccountType", {
    user_uid: uid,
    email: mail,
  });
}
