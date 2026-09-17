import { USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "./httpMiddleware";
import { sanitizeText } from "./textSanitizer";
import { getPersonalDisplayFlags } from "./profileAudience";
import { normalizeUserProfileInfoResponse } from "./normalizeUserProfileInfoResponse";

/** Public mini-card fields for a profile (QR scan / connect modal). */
export async function fetchPublicProfileCard(profileUid) {
  const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${profileUid}`);
  if (!response.ok) {
    throw new Error("Profile not found");
  }
  const apiUser = normalizeUserProfileInfoResponse(await response.json());
  const p = apiUser?.personal_info || apiUser?.profile_info || {};
  const flags = getPersonalDisplayFlags(p);

  const imageUrlRaw = p.profile_personal_image ? String(p.profile_personal_image).trim() : "";
  const imageIsPublic = Boolean(imageUrlRaw) && flags.imageIsPublic;
  const profileImage = imageIsPublic ? sanitizeText(imageUrlRaw) : "";

  console.log("[GooglePhoto] fetchPublicProfileCard", {
    profileUid,
    imageUrl: imageUrlRaw || "(none)",
    imageAudience: p.profile_personal_image_audience,
    imageIsPublic,
    profileImage: profileImage || "(hidden/empty)",
  });

  return {
    profile_uid: profileUid,
    user_uid: apiUser?.user_uid != null ? String(apiUser.user_uid) : "",
    firstName: sanitizeText(p.profile_personal_first_name || ""),
    lastName: sanitizeText(p.profile_personal_last_name || ""),
    tagLine: flags.tagLineIsPublic ? sanitizeText(p.profile_personal_tag_line || p.profile_personal_tagline || "") : "",
    email: flags.emailIsPublic ? sanitizeText(apiUser?.user_email || "") : "",
    phoneNumber: flags.phoneIsPublic ? sanitizeText(p.profile_personal_phone_number || "") : "",
    phoneVerified: flags.phoneIsPublic && (p.phone_verified === true || p.phone_verified === 1),
    profileImage,
    city: flags.locationIsPublic ? sanitizeText(p.profile_personal_city || "") : "",
    state: flags.locationIsPublic ? sanitizeText(p.profile_personal_state || "") : "",
    emailIsPublic: flags.emailIsPublic,
    phoneIsPublic: flags.phoneIsPublic,
    tagLineIsPublic: flags.tagLineIsPublic,
    locationIsPublic: flags.locationIsPublic,
    imageIsPublic,
  };
}
