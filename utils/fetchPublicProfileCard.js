import { USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "./httpMiddleware";
import { sanitizeText } from "./textSanitizer";
import { isApiPublicFlag, isApiPrivateFlag } from "./apiPublicFlag";
import { normalizeUserProfileInfoResponse } from "./normalizeUserProfileInfoResponse";

/**
 * Resolve whether a profile photo should show on public MiniCards (QR scan / connect).
 * - Explicit public flag → show
 * - Explicit private flag → hide
 * - URL present and flag omitted/null → show (API often redacts private URLs entirely)
 */
export function resolvePublicProfileImage(personalInfo = {}) {
  const rawImage = personalInfo?.profile_personal_image ? String(personalInfo.profile_personal_image).trim() : "";
  const flag = personalInfo?.profile_personal_image_is_public;
  if (!rawImage) {
    return { profileImage: "", imageIsPublic: false };
  }
  if (isApiPrivateFlag(flag)) {
    return { profileImage: "", imageIsPublic: false };
  }
  if (isApiPublicFlag(flag) || flag == null || flag === "") {
    return { profileImage: sanitizeText(rawImage), imageIsPublic: true };
  }
  // Unknown flag shape with a URL — prefer showing on public QR cards only when loosely truthy.
  if (flag == 1 || flag === true) {
    return { profileImage: sanitizeText(rawImage), imageIsPublic: true };
  }
  return { profileImage: "", imageIsPublic: false };
}

/** Public mini-card fields for a profile (QR scan / connect modal). */
export async function fetchPublicProfileCard(profileUid) {
  const uid = String(profileUid || "").trim();
  if (!uid) throw new Error("Profile not found");

  const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${uid}`);
  if (!response.ok) {
    throw new Error("Profile not found");
  }
  const apiUser = normalizeUserProfileInfoResponse(await response.json());
  const p = apiUser?.personal_info || apiUser?.profile_info || {};
  const tagLineIsPublic = isApiPublicFlag(p.profile_personal_tag_line_is_public) || isApiPublicFlag(p.profile_personal_tagline_is_public);
  const emailIsPublic = isApiPublicFlag(p.profile_personal_email_is_public);
  const phoneIsPublic = isApiPublicFlag(p.profile_personal_phone_number_is_public);
  const locationIsPublic = isApiPublicFlag(p.profile_personal_location_is_public);
  const { profileImage, imageIsPublic } = resolvePublicProfileImage(p);

  console.log("[PublicProfileCard]", {
    profileUid: uid,
    firstName: p.profile_personal_first_name,
    rawImage: p.profile_personal_image ? String(p.profile_personal_image).slice(0, 80) : "",
    rawImageIsPublic: p.profile_personal_image_is_public,
    resolvedImage: profileImage ? String(profileImage).slice(0, 80) : "",
    imageIsPublic,
  });

  return {
    profile_uid: uid,
    user_uid: apiUser?.user_uid != null ? String(apiUser.user_uid) : "",
    firstName: sanitizeText(p.profile_personal_first_name || ""),
    lastName: sanitizeText(p.profile_personal_last_name || ""),
    tagLine: tagLineIsPublic ? sanitizeText(p.profile_personal_tag_line || p.profile_personal_tagline || "") : "",
    email: emailIsPublic ? sanitizeText(apiUser?.user_email || "") : "",
    phoneNumber: phoneIsPublic ? sanitizeText(p.profile_personal_phone_number || "") : "",
    phoneVerified: phoneIsPublic && (p.phone_verified === true || p.phone_verified === 1),
    profileImage,
    city: locationIsPublic ? sanitizeText(p.profile_personal_city || "") : "",
    state: locationIsPublic ? sanitizeText(p.profile_personal_state || "") : "",
    emailIsPublic,
    phoneIsPublic,
    tagLineIsPublic,
    locationIsPublic,
    imageIsPublic,
  };
}
