/**
 * Resolve the best available business profile / header image URL from API or mapped business data.
 * Priority: business_profile_img → business_favorite_image → first Google photo → gallery image.
 */

export function parseBusinessGooglePhotos(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((u) => (u != null ? String(u).trim() : "")).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((u) => (u != null ? String(u).trim() : "")).filter(Boolean);
      }
    } catch {
      return [trimmed];
    }
  }
  return [];
}

export function resolveBusinessProfileImage(raw) {
  if (!raw || typeof raw !== "object") return null;

  const profileImg = raw.business_profile_img != null ? String(raw.business_profile_img).trim() : "";
  if (profileImg) return profileImg;

  const favoriteImg = raw.business_favorite_image != null ? String(raw.business_favorite_image).trim() : "";
  if (favoriteImg) return favoriteImg;

  const googlePhotos = parseBusinessGooglePhotos(raw.business_google_photos);
  if (googlePhotos.length > 0) return googlePhotos[0];

  if (Array.isArray(raw.businessGooglePhotos) && raw.businessGooglePhotos.length > 0) {
    const first = String(raw.businessGooglePhotos[0]).trim();
    if (first) return first;
  }

  if (Array.isArray(raw.images) && raw.images.length > 0) {
    const first = String(raw.images[0]).trim();
    if (first) return first;
  }

  const legacy = raw.business_image || raw.business_profile_image;
  if (legacy != null && String(legacy).trim()) return String(legacy).trim();

  return null;
}
