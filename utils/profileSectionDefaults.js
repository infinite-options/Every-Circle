/** Material icon names matching the section SVG assets in /assets (school, design, sell, interests). */
export const PROFILE_SECTION_ICON_NAMES = {
  education: "school",
  experience: "design-services",
  offering: "sell",
  seeking: "interests",
};

/** @param {"education"|"experience"|"offering"|"seeking"} section */
export function getProfileSectionIconName(section) {
  return PROFILE_SECTION_ICON_NAMES[section];
}

export function isProfileItemImageHidden(imageIsPublic) {
  return imageIsPublic === 0 || imageIsPublic === "0" || imageIsPublic === false;
}

export function hasCustomProfileSectionImage({ imageUri, imageIsHidden, imageError = false }) {
  return Boolean(imageUri && String(imageUri).trim() !== "" && !imageIsHidden && !imageError);
}

export function isProfileSectionPublicFlag(value) {
  return value === 1 || value === "1" || value === true;
}

/** True when a social link row is explicitly marked public and has a URL. */
export function isPublicSocialLinkRow(row) {
  if (!row || !String(row.social_link_url || "").trim()) return false;
  return isProfileSectionPublicFlag(row.social_link_is_public);
}

/** At least one social link URL is explicitly marked public. */
export function hasPublicSocialLinkUrl(linksInfo) {
  return Array.isArray(linksInfo) && linksInfo.some(isPublicSocialLinkRow);
}

/**
 * Social section defaults to Hidden. Treat as visible only when the section flag is
 * explicitly public and at least one link is explicitly public (avoids backend/UI
 * legacy defaults that saved public without user intent).
 */
export function isSocialLinksSectionPublic(personalInfo, linksInfo) {
  if (!hasPublicSocialLinkUrl(linksInfo)) return false;
  return isProfileSectionPublicFlag(personalInfo?.profile_personal_social_is_public);
}
