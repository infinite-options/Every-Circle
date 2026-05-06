/** S3 prefix for profile-scoped offering/seeking images (filename-only keys from API). */
const S3_PROFILE_PERSONAL_BASE = "https://s3-us-west-1.amazonaws.com/every-circle/profile_personal";

/**
 * @param {string|null|undefined} keyOrUrl — full URL, local uri, or storage key
 * @param {string|null|undefined} profileUid
 * @returns {string} displayable URI or ""
 */
export function resolveProfileItemImageUri(keyOrUrl, profileUid) {
  if (keyOrUrl == null) return "";
  const s = String(keyOrUrl).trim();
  if (!s) return "";
  if (/^(https?:|file:|content:|data:|blob:)/i.test(s)) return s;
  const uid = profileUid != null ? String(profileUid).trim() : "";
  if (uid) return `${S3_PROFILE_PERSONAL_BASE}/${uid}/${s}`;
  return s;
}

export function isRemoteHttpUrl(s) {
  if (!s || typeof s !== "string") return false;
  const t = s.trim();
  return t.startsWith("http://") || t.startsWith("https://");
}
