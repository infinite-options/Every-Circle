import { USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "./httpMiddleware";
import { sanitizeText } from "./textSanitizer";

/** Public mini-card fields for a profile (QR scan / connect modal). */
export async function fetchPublicProfileCard(profileUid) {
  const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${profileUid}`);
  if (!response.ok) {
    throw new Error("Profile not found");
  }
  const apiUser = await response.json();
  const p = apiUser?.personal_info || {};
  const tagLineIsPublic = p.profile_personal_tag_line_is_public === 1 || p.profile_personal_tagline_is_public === 1;
  const emailIsPublic = p.profile_personal_email_is_public === 1;
  const phoneIsPublic = p.profile_personal_phone_number_is_public === 1;
  const imageIsPublic = p.profile_personal_image_is_public === 1;
  const locationIsPublic = p.profile_personal_location_is_public === 1;

  return {
    profile_uid: profileUid,
    user_uid: apiUser?.user_uid != null ? String(apiUser.user_uid) : "",
    firstName: sanitizeText(p.profile_personal_first_name || ""),
    lastName: sanitizeText(p.profile_personal_last_name || ""),
    tagLine: tagLineIsPublic ? sanitizeText(p.profile_personal_tag_line || p.profile_personal_tagline || "") : "",
    email: emailIsPublic ? sanitizeText(apiUser?.user_email || "") : "",
    phoneNumber: phoneIsPublic ? sanitizeText(p.profile_personal_phone_number || "") : "",
    profileImage: imageIsPublic ? sanitizeText(p.profile_personal_image ? String(p.profile_personal_image) : "") : "",
    city: locationIsPublic ? sanitizeText(p.profile_personal_city || "") : "",
    state: locationIsPublic ? sanitizeText(p.profile_personal_state || "") : "",
    emailIsPublic,
    phoneIsPublic,
    tagLineIsPublic,
    locationIsPublic,
    imageIsPublic,
  };
}
