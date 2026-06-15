import { sanitizeText } from "./textSanitizer";
import { resolveBusinessProfileImage } from "./resolveBusinessProfileImage";

export function isBusinessFieldPublic(value) {
  return value === 1 || value === "1" || value === true;
}

/**
 * Normalize API, session, or setup form business data for MiniCard `business` prop.
 * Keeps location (neighborhood/area) separate from street address, matching Business Setup preview.
 */
export function mapBusinessToMiniCard(raw, options = {}) {
  if (!raw || typeof raw !== "object") return null;

  const tagLine = sanitizeText(
    raw.business_tag_line || raw.tagline || raw.tagLine || raw.profile_business_tag_line || "",
  );
  const profileImage = resolveBusinessProfileImage(raw);
  const previewMode = options.previewMode === true;

  const taglineIsPublicFromApi =
    isBusinessFieldPublic(raw.business_tag_line_is_public) ||
    isBusinessFieldPublic(raw.tagline_is_public) ||
    isBusinessFieldPublic(raw.taglineIsPublic);

  const phoneIsPublicFromApi =
    isBusinessFieldPublic(raw.business_phone_number_is_public) ||
    isBusinessFieldPublic(raw.phone_is_public) ||
    isBusinessFieldPublic(raw.phoneIsPublic);

  const emailIsPublicFromApi =
    isBusinessFieldPublic(raw.business_email_id_is_public) ||
    isBusinessFieldPublic(raw.email_is_public) ||
    isBusinessFieldPublic(raw.emailIsPublic);

  const imageIsPublicFromApi =
    isBusinessFieldPublic(raw.business_profile_img_is_public) ||
    isBusinessFieldPublic(raw.business_image_is_public) ||
    isBusinessFieldPublic(raw.image_is_public) ||
    isBusinessFieldPublic(raw.imageIsPublic);

  const hasLocationPublicFlag = raw.business_location_is_public !== undefined || raw.locationIsPublic !== undefined;
  const locationIsPublicFromApi = hasLocationPublicFlag
    ? isBusinessFieldPublic(raw.business_location_is_public) || isBusinessFieldPublic(raw.locationIsPublic)
    : options.defaultLocationIsPublic !== false;

  return {
    business_name: sanitizeText(raw.business_name || raw.name || ""),
    business_tag_line: tagLine,
    tagline: tagLine,
    business_location: sanitizeText(raw.business_location || raw.location || ""),
    business_address_line_1: sanitizeText(raw.business_address_line_1 || raw.addressLine1 || raw.address_line_1 || raw.addressLine2 || ""),
    business_city: sanitizeText(raw.business_city || raw.city || ""),
    business_state: sanitizeText(raw.business_state || raw.state || ""),
    business_zip_code: sanitizeText(raw.business_zip_code || raw.zip || ""),
    business_phone_number: sanitizeText(raw.business_phone_number || raw.phoneNumber || raw.phone || ""),
    business_email: sanitizeText(raw.business_email_id || raw.business_email || raw.email || ""),
    business_email_id: sanitizeText(raw.business_email_id || raw.business_email || raw.email || ""),
    business_website: sanitizeText(raw.business_website || raw.website || ""),
    business_profile_img: profileImage,
    first_image: profileImage,
    imageIsPublic: previewMode ? (options.imageIsPublic ?? Boolean(profileImage)) : imageIsPublicFromApi,
    phoneIsPublic: previewMode ? (options.phoneIsPublic ?? true) : phoneIsPublicFromApi,
    emailIsPublic: previewMode ? (options.emailIsPublic ?? true) : emailIsPublicFromApi,
    taglineIsPublic: previewMode ? (options.taglineIsPublic ?? Boolean(tagLine)) : taglineIsPublicFromApi,
    locationIsPublic: previewMode
      ? (options.locationIsPublic ??
        (raw.business_location_is_public !== undefined ? isBusinessFieldPublic(raw.business_location_is_public) : true))
      : locationIsPublicFromApi,
  };
}
