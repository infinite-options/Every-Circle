/**
 * Resolve the best available business profile / header image URL from API or mapped business data.
 * Priority: business_profile_img → business_favorite_image → first Google photo → gallery image.
 */

export const S3_BUSINESS_IMAGE_BASE = "https://s3-us-west-1.amazonaws.com/every-circle/business_personal";

export function resolveBusinessUploadUri(rawKey, uid) {
  const trimmed = String(rawKey || "").trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return uid ? `${S3_BUSINESS_IMAGE_BASE}/${uid}/${trimmed}` : trimmed;
}

export function normalizeBusinessUploadKey(rawKey, uid) {
  const trimmed = String(rawKey || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (uid) {
      const marker = `/business_personal/${uid}/`;
      const idx = trimmed.indexOf(marker);
      if (idx >= 0) return decodeURIComponent(trimmed.slice(idx + marker.length).split("?")[0]);
    }
    return trimmed.split("/").pop()?.split("?")[0] || trimmed;
  }
  return trimmed.split("?")[0];
}

export function businessUploadUrisMatch(a, b, uid) {
  if (!a || !b) return false;
  if (a === b) return true;
  return normalizeBusinessUploadKey(a, uid) === normalizeBusinessUploadKey(b, uid);
}

export function isBusinessUserUploadImage(value) {
  if (value == null) return false;
  const raw = String(value).trim();
  if (!raw || raw === "null" || raw === "undefined") return false;
  if (isGoogleHostedPhotoUrl(raw)) return false;
  if (raw.startsWith("blob:") || raw.startsWith("data:") || raw.startsWith("file:")) return true;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw.includes("amazonaws.com") || /business_personal|business_profile_img|business_image_/i.test(raw);
  }
  return /\.(jpe?g|png|gif|webp)$/i.test(raw) || /^business_image_/i.test(raw) || /^business_profile_img/i.test(raw);
}

export function parseBusinessImagesUrl(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((k) => String(k).trim()).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((k) => String(k).trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
  return [];
}

export function coalesceBusinessProfileImg(...candidates) {
  const cleaned = candidates.map((c) => String(c || "").trim()).filter(Boolean);
  if (cleaned.length === 0) return "";
  const fullUrl = cleaned.find((c) => c.startsWith("http://") || c.startsWith("https://"));
  return fullUrl || cleaned[0];
}

/** User-uploaded profile image only (excludes Google/favorite fallbacks). */
export function resolveBusinessProfileUploadImage(raw, uid) {
  if (!raw || typeof raw !== "object") return "";
  const profileImg = coalesceBusinessProfileImg(raw.business_profile_img);
  if (!profileImg || !isBusinessUserUploadImage(profileImg)) return "";
  return resolveBusinessUploadUri(profileImg, uid || raw.business_uid || "");
}

function isGalleryShadowUploadKey(key) {
  return /^business_image_\d+\.[a-z0-9]+$/i.test(key);
}

function buildGalleryUploadItem(rawKey, uid, index, idSuffix = "") {
  const trimmed = String(rawKey).trim();
  if (!trimmed) return null;
  const uri = resolveBusinessUploadUri(trimmed, uid);
  const s3Key = normalizeBusinessUploadKey(trimmed, uid);
  if (!uri || !s3Key) return null;
  return {
    id: `existing-${index}-${s3Key}${idSuffix}`,
    uri,
    s3Key,
    isNew: false,
    webFile: null,
  };
}

function ensureUploadInGallery(items, rawKey, uid) {
  if (!isBusinessUserUploadImage(rawKey)) return items;
  const item = buildGalleryUploadItem(rawKey, uid, items.length, "-ensured");
  if (!item) return items;
  const exists = items.some(
    (entry) => businessUploadUrisMatch(entry.uri, item.uri, uid) || businessUploadUrisMatch(entry.s3Key, item.s3Key, uid),
  );
  if (exists) return items;
  return [...items, item];
}

function pruneStaleGalleryShadowUploads(items, profileUri, uid) {
  if (!Array.isArray(items) || items.length === 0 || !profileUri) return items;
  if (!isBusinessUserUploadImage(profileUri)) return items;

  const profileKey = normalizeBusinessUploadKey(profileUri, uid);
  if (!profileKey.startsWith("business_profile_img")) return items;

  const hasProfileItem = items.some((item) => businessUploadUrisMatch(item.uri, profileUri, uid));
  const shadowItems = items.filter((item) => isGalleryShadowUploadKey(normalizeBusinessUploadKey(item.s3Key, uid)));
  if (!hasProfileItem || shadowItems.length === 0) return items;

  if (items.length === shadowItems.length + 1 && shadowItems.length === 1) {
    return items.filter((item) => !isGalleryShadowUploadKey(normalizeBusinessUploadKey(item.s3Key, uid)));
  }
  return items;
}

/**
 * Build Your Uploads gallery items from business API / route data.
 * Always includes the user-uploaded profile image when one exists.
 */
export function buildBusinessGalleryUploads(business, businessUID) {
  const uid = businessUID || business?.business_uid || "";
  const profileUri = resolveBusinessProfileUploadImage(business, uid);
  const canonicalProfileUri = coalesceBusinessProfileImg(
    profileUri,
    business?.business_profile_img,
    isBusinessUserUploadImage(resolveBusinessProfileImage(business) || "") ? resolveBusinessProfileImage(business) : "",
  );
  const resolvedProfileUri =
    canonicalProfileUri && isBusinessUserUploadImage(canonicalProfileUri)
      ? resolveBusinessUploadUri(canonicalProfileUri, uid) || canonicalProfileUri
      : profileUri;
  const items = [];
  const seenKeys = new Set();

  const appendUpload = (rawKey, idSuffix = "") => {
    const sourceKey =
      resolvedProfileUri && businessUploadUrisMatch(rawKey, resolvedProfileUri, uid) ? resolvedProfileUri : rawKey;
    if (!isBusinessUserUploadImage(sourceKey)) return;
    const item = buildGalleryUploadItem(sourceKey, uid, items.length, idSuffix);
    if (!item || seenKeys.has(item.s3Key)) return;
    seenKeys.add(item.s3Key);
    items.push(item);
  };

  parseBusinessImagesUrl(business?.business_images_url).forEach((k) => appendUpload(k));

  if (resolvedProfileUri) appendUpload(resolvedProfileUri, "-profile");

  let result = pruneStaleGalleryShadowUploads(items, resolvedProfileUri, uid);
  if (resolvedProfileUri) {
    result = ensureUploadInGallery(result, resolvedProfileUri, uid);
  }
  return reconcileGalleryUploadsWithProfile(result, resolvedProfileUri || resolveBusinessProfileImage(business) || "", uid);
}

export function businessGalleryIncludesUri(galleryUploads, uri, uid) {
  if (!uri) return false;
  return (galleryUploads || []).some((item) => businessUploadUrisMatch(item.uri, uri, uid));
}

/** Prefer the known-working profile URL when a gallery item refers to the same upload. */
export function resolveGalleryItemDisplayUri(item, profileUri, uid) {
  if (!item) return "";
  if (item.isNew) return item.uri;
  if (
    profileUri &&
    (businessUploadUrisMatch(item.uri, profileUri, uid) ||
      businessUploadUrisMatch(item.s3Key, profileUri, uid))
  ) {
    if (profileUri.startsWith("http://") || profileUri.startsWith("https://")) return profileUri;
    return resolveBusinessUploadUri(profileUri, uid) || profileUri;
  }
  return resolveBusinessUploadUri(item.uri, uid) || item.uri;
}

export function reconcileGalleryUploadsWithProfile(galleryUploads, profileUri, uid) {
  if (!Array.isArray(galleryUploads)) return [];
  return galleryUploads.map((item) => {
    const resolvedUri = resolveGalleryItemDisplayUri(item, profileUri, uid);
    if (resolvedUri && resolvedUri !== item.uri) {
      return { ...item, uri: resolvedUri };
    }
    return item;
  });
}

export function isEphemeralGooglePhotoUrl(url) {
  if (!url || typeof url !== "string") return false;
  return url.includes("PhotoService.GetPhoto") || url.includes("place/js/PhotoService");
}

export function extractGooglePhotoReference(url) {
  if (!url || typeof url !== "string") return "";
  const match = url.match(/photo_reference=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function googlePhotoUrlsMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const refA = extractGooglePhotoReference(a);
  const refB = extractGooglePhotoReference(b);
  return Boolean(refA && refB && refA === refB);
}

export function isGooglePhotoInList(url, photos) {
  if (!url || !Array.isArray(photos)) return false;
  return photos.some((photo) => googlePhotoUrlsMatch(url, photo));
}

/**
 * Refresh expired Google photo URLs without restoring photos the user removed.
 * Matches photos by photo_reference so a curated subset still gets fresh URLs.
 */
export function resolveGooglePhotosForDisplay(storedPhotos, freshPhotos) {
  const stored = (storedPhotos || []).map((u) => (u != null ? String(u).trim() : "")).filter(Boolean);
  const fresh = (freshPhotos || []).map((u) => (u != null ? String(u).trim() : "")).filter(Boolean);
  if (stored.length === 0) return [];
  if (fresh.length === 0) return stored;

  const freshByRef = new Map();
  for (const url of fresh) {
    const ref = extractGooglePhotoReference(url);
    if (ref) freshByRef.set(ref, url);
  }

  if (freshByRef.size > 0) {
    return stored.map((url) => {
      if (!isEphemeralGooglePhotoUrl(url)) return url;
      const ref = extractGooglePhotoReference(url);
      return (ref && freshByRef.get(ref)) || url;
    });
  }

  if (stored.length !== fresh.length) return stored;
  if (!stored.some(isEphemeralGooglePhotoUrl)) return stored;
  return stored.map((url, i) => (isEphemeralGooglePhotoUrl(url) && fresh[i] ? fresh[i] : url));
}

export function resolveGooglePhotoUrl(url, freshPhotos) {
  if (!url || !Array.isArray(freshPhotos) || freshPhotos.length === 0) return url;
  const ref = extractGooglePhotoReference(url);
  if (!ref) return url;
  const match = freshPhotos.find((fresh) => extractGooglePhotoReference(fresh) === ref);
  return match || url;
}

export function dedupeGooglePhotoUrls(urls) {
  const list = (urls || []).map((u) => (u != null ? String(u).trim() : "")).filter(Boolean);
  const seenRefs = new Set();
  const seenUrls = new Set();
  const result = [];
  for (const url of list) {
    const ref = extractGooglePhotoReference(url);
    if (ref) {
      if (seenRefs.has(ref)) continue;
      seenRefs.add(ref);
      result.push(url);
    } else if (!seenUrls.has(url)) {
      seenUrls.add(url);
      result.push(url);
    }
  }
  return result;
}

/**
 * Refresh Google photo URLs and append newly available photos without restoring removed ones.
 */
export function mergeRefreshedGooglePhotos(existingPhotos, freshPhotos) {
  const existing = dedupeGooglePhotoUrls(existingPhotos);
  const fresh = dedupeGooglePhotoUrls(freshPhotos);
  if (fresh.length === 0) return existing;
  if (existing.length === 0) return fresh;

  const freshByRef = new Map();
  for (const url of fresh) {
    const ref = extractGooglePhotoReference(url);
    if (ref) freshByRef.set(ref, url);
  }

  const seenRefs = new Set();
  const seenUrls = new Set();
  const merged = [];

  const addUrl = (url) => {
    if (!url || seenUrls.has(url)) return;
    const ref = extractGooglePhotoReference(url);
    if (ref) {
      if (seenRefs.has(ref)) return;
      seenRefs.add(ref);
    }
    seenUrls.add(url);
    merged.push(url);
  };

  for (const url of existing) {
    const ref = extractGooglePhotoReference(url);
    if (ref) {
      addUrl(freshByRef.get(ref) || url);
    } else {
      addUrl(url);
    }
  }

  for (const url of fresh) {
    const ref = extractGooglePhotoReference(url);
    if (ref) {
      if (!seenRefs.has(ref)) addUrl(url);
    } else {
      addUrl(url);
    }
  }

  return merged;
}

export function isGoogleHostedPhotoUrl(url) {
  if (!url || typeof url !== "string") return false;
  const u = url.trim();
  if (!u) return false;
  return u.includes("maps.googleapis.com/maps/api/place/photo") || isEphemeralGooglePhotoUrl(u) || u.includes("googleusercontent.com");
}

/** Resolve business_favorite_image the same way as Business Setup (Google logo selection). */
export function resolveFavoriteGoogleImage(selectedProfile, googleImages) {
  const images = dedupeGooglePhotoUrls(googleImages);
  if (images.length === 0) return "";
  const sel = (selectedProfile || "").trim();
  if (!sel) return "";
  if (isGooglePhotoInList(sel, images)) {
    return images.find((url) => googlePhotoUrlsMatch(url, sel)) || sel;
  }
  if (isGoogleHostedPhotoUrl(sel)) {
    const resolved = resolveGooglePhotoUrl(sel, images);
    if (isGooglePhotoInList(resolved, images)) return resolved;
    return images[0];
  }
  return "";
}

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

  const uid = raw.business_uid || "";
  const profileImg = raw.business_profile_img != null ? String(raw.business_profile_img).trim() : "";
  if (profileImg) {
    if (isBusinessUserUploadImage(profileImg)) {
      return resolveBusinessUploadUri(profileImg, uid) || profileImg;
    }
    return profileImg;
  }

  const favoriteImg = raw.business_favorite_image != null ? String(raw.business_favorite_image).trim() : "";
  if (favoriteImg) return favoriteImg;

  const googlePhotos = parseBusinessGooglePhotos(raw.business_google_photos);
  if (googlePhotos.length > 0) return googlePhotos[0];

  if (Array.isArray(raw.businessGooglePhotos) && raw.businessGooglePhotos.length > 0) {
    const first = String(raw.businessGooglePhotos[0]).trim();
    if (first) return first;
  }

  const galleryKeys = parseBusinessImagesUrl(raw.business_images_url);
  if (galleryKeys.length > 0) {
    const firstGallery = resolveBusinessUploadUri(galleryKeys[0], uid);
    if (firstGallery && isBusinessUserUploadImage(firstGallery)) return firstGallery;
  }

  if (Array.isArray(raw.images) && raw.images.length > 0) {
    for (const image of raw.images) {
      const candidate = String(image).trim();
      if (candidate && isBusinessUserUploadImage(candidate)) {
        return resolveBusinessUploadUri(candidate, uid) || candidate;
      }
    }
  }

  const legacy = raw.business_image || raw.business_profile_image;
  if (legacy != null && String(legacy).trim()) {
    const legacyValue = String(legacy).trim();
    if (isBusinessUserUploadImage(legacyValue)) {
      return resolveBusinessUploadUri(legacyValue, uid) || legacyValue;
    }
    return legacyValue;
  }

  return null;
}
