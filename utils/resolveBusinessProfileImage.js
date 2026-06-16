/**
 * Resolve the best available business profile / header image URL from API or mapped business data.
 * Priority: business_profile_img → business_favorite_image / favImage → first Google photo → gallery image.
 */

export const S3_BUSINESS_IMAGE_BASE = "https://s3-us-west-1.amazonaws.com/every-circle/business_personal";

export function isEphemeralGooglePhotoUrl(url) {
  if (!url || typeof url !== "string") return false;
  return url.includes("PhotoService.GetPhoto") || url.includes("place/js/PhotoService");
}

export function extractGooglePhotoReference(url) {
  if (!url || typeof url !== "string") return "";
  const match = url.match(/photo_reference=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function resolveBusinessUploadUri(rawKey, uid) {
  const trimmed = String(rawKey || "").trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return uid ? `${S3_BUSINESS_IMAGE_BASE}/${uid}/${trimmed}` : trimmed;
}

export function normalizeBusinessUploadKey(rawKey, uid) {
  const trimmed = String(rawKey || "").trim();
  if (!trimmed) return "";

  const googleRef = extractGooglePhotoReference(trimmed);
  if (googleRef) return `google_ref:${googleRef}`;

  if (isEphemeralGooglePhotoUrl(trimmed)) {
    const oneS = trimmed.match(/[?&]1s([^&]+)/);
    if (oneS?.[1]) return `google_ephemeral:${decodeURIComponent(oneS[1])}`;
    return `google_ephemeral:${trimmed}`;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (uid) {
      const markers = [`/business_personal/${uid}/`, `/business_profile/${uid}/`];
      for (const marker of markers) {
        const idx = trimmed.indexOf(marker);
        if (idx >= 0) return decodeURIComponent(trimmed.slice(idx + marker.length).split("?")[0]);
      }
    }
    return decodeURIComponent(trimmed.split("?")[0].split("/").pop() || "");
  }
  return trimmed.split("?")[0];
}

export function filenameFromS3Url(urlOrKey) {
  const trimmed = String(urlOrKey || "").trim();
  if (!trimmed) return "";
  const key = trimmed.split("?")[0];
  return key.split("/").pop() || key;
}

/** Upload batch suffix e.g. 20260616171216Z from business_img_0_20260616171216Z */
export function extractBusinessUploadTimestamp(urlOrKey, uid) {
  const key = normalizeBusinessUploadKey(urlOrKey, uid) || filenameFromS3Url(urlOrKey);
  const match = key.match(/(\d{14}Z)$/i);
  return match ? match[1] : "";
}

function isProfileGalleryUploadPair(fileA, fileB) {
  return (
    (/^business_profile_img_/i.test(fileA) && /^business_img_/i.test(fileB)) ||
    (/^business_profile_img_/i.test(fileB) && /^business_img_/i.test(fileA))
  );
}

export function businessUploadUrisMatch(a, b, uid) {
  if (!a || !b) return false;
  if (a === b) return true;
  const keyA = normalizeBusinessUploadKey(a, uid);
  const keyB = normalizeBusinessUploadKey(b, uid);
  if (keyA && keyB && keyA === keyB) return true;
  const tsA = extractBusinessUploadTimestamp(a, uid);
  const tsB = extractBusinessUploadTimestamp(b, uid);
  if (tsA && tsB && tsA === tsB) {
    const fileA = filenameFromS3Url(keyA || a);
    const fileB = filenameFromS3Url(keyB || b);
    if (isProfileGalleryUploadPair(fileA, fileB)) return true;
  }
  return false;
}

export function isBusinessUserUploadImage(value) {
  if (value == null) return false;
  const raw = String(value).trim();
  if (!raw || raw === "null" || raw === "undefined") return false;
  if (isGoogleHostedPhotoUrl(raw)) return false;
  if (raw.startsWith("blob:") || raw.startsWith("data:") || raw.startsWith("file:")) return true;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return (
      raw.includes("amazonaws.com") ||
      /business_personal|business_profile\/|business_profile_img|business_image_/i.test(raw)
    );
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

/**
 * Profile image URL from business_profile_img only (not business_favorite_image).
 * Used for gallery checkmark / header preview on edit.
 */
export function resolveBusinessProfileImgUrl(raw, uid) {
  if (!raw || typeof raw !== "object") return "";
  const businessUid = uid || raw.business_uid || "";
  const profileImg = coalesceBusinessProfileImg(raw.business_profile_img);
  if (!profileImg || profileImg === "null" || profileImg === "undefined") return "";
  if (profileImg.startsWith("http://") || profileImg.startsWith("https://")) return profileImg;
  return resolveBusinessUploadUri(profileImg, businessUid) || profileImg;
}

/** True when candidateUri is the same gallery object as profileImgUri (S3 key or Google ref). */
export function profileImgMatchesUri(profileImgUri, candidateUri, uid) {
  if (!profileImgUri || !candidateUri) return false;
  if (profileImgUri === candidateUri) return true;
  if (googlePhotoUrlsMatch(profileImgUri, candidateUri)) return true;
  const profileIsGoogle =
    isGoogleHostedPhotoUrl(profileImgUri) || isEphemeralGooglePhotoUrl(profileImgUri);
  const candidateIsGoogle =
    isGoogleHostedPhotoUrl(candidateUri) || isEphemeralGooglePhotoUrl(candidateUri);
  if (profileIsGoogle || candidateIsGoogle) return false;
  return businessUploadUrisMatch(profileImgUri, candidateUri, uid);
}

export function galleryItemMatchesProfileImg(item, profileImgUri, uid) {
  if (!item || !profileImgUri) return false;
  return (
    profileImgMatchesUri(profileImgUri, item.uri, uid) ||
    profileImgMatchesUri(profileImgUri, item.s3Key, uid)
  );
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

export function isPersistedGoogleS3Url(url) {
  if (!url || typeof url !== "string") return false;
  const key = normalizeBusinessUploadKey(url, "");
  return /^google_photo_/i.test(key);
}

function isPersistedGalleryS3Url(url, uid) {
  const raw = String(url || "").trim();
  if (!raw) return false;
  if (isGoogleHostedPhotoUrl(raw)) return true;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw.includes("amazonaws.com") || /business_personal/i.test(raw);
  }
  return isBusinessUserUploadImage(raw) || isPersistedGoogleS3Url(resolveBusinessUploadUri(raw, uid));
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
 * Includes user uploads (business_images_url) and persisted Google photos (business_google_photos).
 */
export function buildBusinessGalleryUploads(business, businessUID) {
  const uid = businessUID || business?.business_uid || "";
  const resolvedProfileUri = resolveBusinessProfileImgUrl(business, uid);
  const items = [];
  const seenKeys = new Set();

  const appendGalleryUrl = (rawKey, idSuffix = "") => {
    const trimmed = String(rawKey || "").trim();
    if (!trimmed || !isPersistedGalleryS3Url(trimmed, uid)) return;
    const uri = resolveBusinessUploadUri(trimmed, uid) || trimmed;
    const s3Key = normalizeBusinessUploadKey(trimmed, uid);
    if (!uri || !s3Key || seenKeys.has(s3Key)) return;
    seenKeys.add(s3Key);
    items.push({
      id: `existing-${items.length}-${s3Key}${idSuffix}`,
      uri,
      s3Key,
      isNew: false,
      isGooglePhoto: isPersistedGoogleS3Url(uri),
      webFile: null,
    });
  };

  parseBusinessImagesUrl(business?.business_images_url).forEach((k) => {
    if (!isPersistedGoogleS3Url(k)) appendGalleryUrl(k);
  });
  parseBusinessGooglePhotos(business?.business_google_photos).forEach((k) => appendGalleryUrl(k));

  let result = pruneStaleGalleryShadowUploads(items, resolvedProfileUri, uid);
  result = dedupeGalleryUploadsByS3Key(result, uid);
  return reconcileGalleryUploadsWithProfile(result, resolvedProfileUri, uid);
}

export function businessGalleryIncludesUri(galleryUploads, uri, uid) {
  if (!uri) return false;
  return (galleryUploads || []).some(
    (item) =>
      businessUploadUrisMatch(item.uri, uri, uid) ||
      businessUploadUrisMatch(item.s3Key, uri, uid),
  );
}

/** Collapse duplicate gallery rows that refer to the same S3 object. */
export function dedupeGalleryUploadsByS3Key(galleryUploads, uid) {
  const seen = new Set();
  const result = [];
  for (const item of galleryUploads || []) {
    const key = normalizeBusinessUploadKey(item.s3Key || item.uri, uid);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
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

export function isPermanentS3Url(url) {
  const u = String(url || "").trim();
  return (u.startsWith("http://") || u.startsWith("https://")) && u.includes("amazonaws.com");
}

export function resolveGalleryItemS3Url(item, uid) {
  if (!item || item.isNew) return "";
  if (item.s3Key) {
    const fromKey = resolveBusinessUploadUri(item.s3Key, uid);
    if (isPermanentS3Url(fromKey) && !fromKey.includes("/business_profile/")) {
      return fromKey;
    }
  }
  const raw = item.uri || "";
  if (isPermanentS3Url(raw) && !raw.includes("/business_profile/")) return raw;
  const resolved = resolveBusinessUploadUri(raw, uid);
  return isPermanentS3Url(resolved) && !resolved.includes("/business_profile/") ? resolved : "";
}

export function favoritesMatch(a, b, uid) {
  if (!a || !b) return false;
  return businessUploadUrisMatch(a, b, uid) || googlePhotoUrlsMatch(a, b);
}

/** Google Images panel: only live Google URLs (not persisted S3 copies). */
export function filterFreshGooglePhotoUrls(urls) {
  return dedupeGooglePhotoUrls((urls || []).map((u) => String(u).trim()).filter(isGoogleHostedPhotoUrl));
}

/**
 * business_google_photos payload: kept persisted Google S3 from Your Uploads + fresh Google URLs from panel.
 */
export function buildGooglePhotosForSave(galleryUploads, googlePanelPhotos, deletedUrls, uid) {
  const deletedKeys = new Set((deletedUrls || []).map((u) => normalizeBusinessUploadKey(u, uid)));
  const notDeleted = (url) => {
    const key = normalizeBusinessUploadKey(url, uid);
    return key && !deletedKeys.has(key);
  };

  const keptPersistedGoogle = (galleryUploads || [])
    .filter((item) => !item.isNew && item.isGooglePhoto)
    .map((item) => resolveGalleryItemS3Url(item, uid))
    .filter((url) => url && isPermanentS3Url(url) && notDeleted(url));

  const keptFreshGoogle = filterFreshGooglePhotoUrls(googlePanelPhotos).filter(notDeleted);

  return dedupeGooglePhotoUrls([...keptPersistedGoogle, ...keptFreshGoogle]);
}

/** Kept user-upload S3 URLs for business_images_url (excludes Google photos). */
export function collectKeptUserUploadS3Urls(galleryUploads, deletedUrls, uid) {
  const deletedKeys = new Set((deletedUrls || []).map((u) => normalizeBusinessUploadKey(u, uid)));
  const urls = [];
  const seen = new Set();
  for (const item of galleryUploads || []) {
    if (item.isNew || item.isGooglePhoto) continue;
    const url = resolveGalleryItemS3Url(item, uid);
    if (!url || !isPermanentS3Url(url) || isPersistedGoogleS3Url(url)) continue;
    if (url.includes("/business_profile/")) continue;
    const key = normalizeBusinessUploadKey(url, uid);
    if (!key || deletedKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    urls.push(url);
  }
  return urls;
}

export function parseGalleryS3Urls(business, uid) {
  const urls = [];
  const seen = new Set();
  for (const raw of parseBusinessImagesUrl(business?.business_images_url)) {
    if (isPersistedGoogleS3Url(raw)) continue;
    const full = isPermanentS3Url(raw) ? raw : resolveBusinessUploadUri(raw, uid);
    if (!isPermanentS3Url(full)) continue;
    const key = normalizeBusinessUploadKey(full, uid);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    urls.push(full);
  }
  return urls;
}

export function findNewGalleryS3Urls(beforeUrls, afterUrls, uid) {
  const beforeKeys = new Set((beforeUrls || []).map((u) => normalizeBusinessUploadKey(u, uid)));
  return (afterUrls || []).filter((u) => !beforeKeys.has(normalizeBusinessUploadKey(u, uid)));
}

export function resolveFavoriteImageForSave({ selectedUri, googlePhotosToSend, googlePanelPhotos, galleryItem, uid }) {
  const selected = String(selectedUri || "").trim();
  if (!selected) return { favoriteUrl: "", deferFavoriteAfterUpload: false };

  if (galleryItem?.isNew) {
    return { favoriteUrl: "", deferFavoriteAfterUpload: true };
  }

  const freshGoogle = filterFreshGooglePhotoUrls(googlePanelPhotos);

  if (isGoogleHostedPhotoUrl(selected) && isGooglePhotoInList(selected, freshGoogle)) {
    const googleFavorite = resolveFavoriteGoogleImage(
      selected,
      googlePhotosToSend.filter((url) => isGoogleHostedPhotoUrl(url)),
    );
    return { favoriteUrl: googleFavorite || selected, deferFavoriteAfterUpload: false };
  }

  const s3FromItem = galleryItem ? resolveGalleryItemS3Url(galleryItem, uid) : "";
  if (s3FromItem) return { favoriteUrl: s3FromItem, deferFavoriteAfterUpload: false };

  if (isPermanentS3Url(selected)) return { favoriteUrl: selected, deferFavoriteAfterUpload: false };

  if (isGooglePhotoInList(selected, googlePhotosToSend)) {
    const googleFavorite = resolveFavoriteGoogleImage(selected, googlePhotosToSend);
    if (googleFavorite && isGoogleHostedPhotoUrl(googleFavorite)) {
      return { favoriteUrl: googleFavorite, deferFavoriteAfterUpload: false };
    }
    if (isPermanentS3Url(googleFavorite)) {
      return { favoriteUrl: googleFavorite, deferFavoriteAfterUpload: false };
    }
  }

  return { favoriteUrl: "", deferFavoriteAfterUpload: false };
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

  const favoriteImg = String(raw.business_favorite_image ?? raw.favImage ?? "").trim();
  if (favoriteImg) {
    if (isBusinessUserUploadImage(favoriteImg)) {
      return resolveBusinessUploadUri(favoriteImg, uid) || favoriteImg;
    }
    return favoriteImg;
  }

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
