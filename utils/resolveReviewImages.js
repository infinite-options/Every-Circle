export const S3_RATING_IMAGE_BASE = "https://s3-us-west-1.amazonaws.com/every-circle/rating_personal";

function parseReviewImagesUrl(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((entry) => String(entry).trim()).filter(Boolean);
  if (typeof raw !== "object") {
    const text = String(raw).trim();
    if (!text || text === "null" || text === "[]") return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map((entry) => String(entry).trim()).filter(Boolean);
    } catch {
      return text
        .split(",")
        .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
    }
  }
  return [];
}

export function resolveReviewImageUrl(value, ratingUid) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  const uid = String(ratingUid || "").trim();
  if (!uid) return text;
  const filename = text.replace(/^\/+/, "");
  return `${S3_RATING_IMAGE_BASE}/${uid}/${filename}`;
}

/**
 * Review gallery for display: favorite image first, then up to two additional images (max 3).
 */
export function getReviewDisplayImages(review, { maxCount = 3 } = {}) {
  if (!review || typeof review !== "object") return [];

  const ratingUid = String(review.rating_uid || "").trim();
  const gallery = parseReviewImagesUrl(review.rating_images_url)
    .map((entry) => resolveReviewImageUrl(entry, ratingUid))
    .filter(Boolean);

  let favoriteUrl = resolveReviewImageUrl(review.rating_favorite_image, ratingUid);
  const favIdx = Number(review.rating_favorite_image_index ?? review.favorite_image_index);
  if (!favoriteUrl && Number.isFinite(favIdx) && favIdx >= 0 && favIdx < gallery.length) {
    favoriteUrl = gallery[favIdx];
  }

  const ordered = [];
  const seen = new Set();
  const push = (url) => {
    if (!url || seen.has(url) || ordered.length >= maxCount) return;
    seen.add(url);
    ordered.push(url);
  };

  push(favoriteUrl);
  for (const url of gallery) push(url);

  if (!favoriteUrl && gallery.length > 0) {
    return gallery.slice(0, maxCount);
  }

  return ordered;
}
