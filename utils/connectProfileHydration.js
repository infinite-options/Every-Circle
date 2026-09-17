import { sanitizeText } from "./textSanitizer";
import { getPersonalDisplayFlags } from "./profileAudience";

/** MiniCard + QR fields for Connect tab, from shared session profile (no network). */
export function miniCardUserFromSession(session, profileUidOptional, userUidOptional = "") {
  const profileUID = String(profileUidOptional || session?.profileUid || "").trim();
  if (!profileUID) return null;

  const p = session?.personalInfo || session?.rawProfile?.personal_info || {};
  const userUid = String(userUidOptional || "").trim();
  const flags = getPersonalDisplayFlags(p);

  return {
    profile_uid: profileUID,
    user_uid: userUid,
    firstName: sanitizeText(p.profile_personal_first_name || ""),
    lastName: sanitizeText(p.profile_personal_last_name || ""),
    email: sanitizeText(session?.userEmail || session?.rawProfile?.user_email || ""),
    phoneNumber: sanitizeText(p.profile_personal_phone_number || ""),
    phoneVerified: p.phone_verified === true || p.phone_verified === 1,
    tagLine: sanitizeText(p.profile_personal_tag_line || p.profile_personal_tagline || ""),
    city: sanitizeText(p.profile_personal_city || ""),
    state: sanitizeText(p.profile_personal_state || ""),
    profileImage: sanitizeText(p.profile_personal_image ? String(p.profile_personal_image) : ""),
    emailIsPublic: flags.emailIsPublic,
    phoneIsPublic: flags.phoneIsPublic,
    tagLineIsPublic: flags.tagLineIsPublic,
    locationIsPublic: flags.locationIsPublic,
    imageIsPublic: flags.imageIsPublic,
  };
}

export function messagesOffFromSession(session) {
  const p = session?.personalInfo || session?.rawProfile?.personal_info || {};
  const off = p.profile_personal_messages_off;
  return off === 1 || off === "1" || off === true;
}
