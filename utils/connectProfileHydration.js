import { sanitizeText } from "./textSanitizer";

/** MiniCard + QR fields for Connect tab, from shared session profile (no network). */
export function miniCardUserFromSession(session, profileUidOptional, userUidOptional = "") {
  const profileUID = String(profileUidOptional || session?.profileUid || "").trim();
  if (!profileUID) return null;

  const p = session?.personalInfo || session?.rawProfile?.personal_info || {};
  const userUid = String(userUidOptional || "").trim();

  return {
    profile_uid: profileUID,
    user_uid: userUid,
    firstName: sanitizeText(p.profile_personal_first_name || ""),
    lastName: sanitizeText(p.profile_personal_last_name || ""),
    email: sanitizeText(session?.userEmail || session?.rawProfile?.user_email || ""),
    phoneNumber: sanitizeText(p.profile_personal_phone_number || ""),
    tagLine: sanitizeText(p.profile_personal_tag_line || p.profile_personal_tagline || ""),
    city: sanitizeText(p.profile_personal_city || ""),
    state: sanitizeText(p.profile_personal_state || ""),
    profileImage: sanitizeText(p.profile_personal_image ? String(p.profile_personal_image) : ""),
    emailIsPublic: p.profile_personal_email_is_public === 1,
    phoneIsPublic: p.profile_personal_phone_number_is_public === 1,
    tagLineIsPublic: p.profile_personal_tag_line_is_public === 1 || p.profile_personal_tagline_is_public === 1,
    locationIsPublic: p.profile_personal_location_is_public === 1,
    imageIsPublic: p.profile_personal_image_is_public === 1,
  };
}

export function messagesOffFromSession(session) {
  const p = session?.personalInfo || session?.rawProfile?.personal_info || {};
  return p.profile_personal_messages_off === 1;
}
