import { USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "./httpMiddleware";
import { sanitizeText } from "./textSanitizer";
import { isApiPublicFlag, isSharedProfileImagePublic } from "./apiPublicFlag";
import { normalizeUserProfileInfoResponse } from "./normalizeUserProfileInfoResponse";

/** Public mini-card fields for a profile (QR scan / connect modal). */
export async function fetchPublicProfileCard(profileUid) {
  const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${profileUid}`);
  if (!response.ok) {
    throw new Error("Profile not found");
  }
  const apiUser = normalizeUserProfileInfoResponse(await response.json());
  const p = apiUser?.personal_info || apiUser?.profile_info || {};
  const tagLineIsPublic = isApiPublicFlag(p.profile_personal_tag_line_is_public) || isApiPublicFlag(p.profile_personal_tagline_is_public);
  const emailIsPublic = isApiPublicFlag(p.profile_personal_email_is_public);
  const phoneIsPublic = isApiPublicFlag(p.profile_personal_phone_number_is_public);
  const locationIsPublic = isApiPublicFlag(p.profile_personal_location_is_public);

  const imageUrlRaw = p.profile_personal_image ? String(p.profile_personal_image).trim() : "";
  const imageIsPublic = Boolean(imageUrlRaw) && isSharedProfileImagePublic(p.profile_personal_image_is_public);
  const profileImage = imageIsPublic ? sanitizeText(imageUrlRaw) : "";

  console.log("[GooglePhoto] fetchPublicProfileCard", {
    profileUid,
    imageUrl: imageUrlRaw || "(none)",
    imageFlag: p.profile_personal_image_is_public,
    imageIsPublic,
    profileImage: profileImage || "(hidden/empty)",
  });

  return {
    profile_uid: profileUid,
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
