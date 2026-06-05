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
