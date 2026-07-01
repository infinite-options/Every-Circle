import { isBusinessFieldPublic } from "./mapBusinessToMiniCard";
import { resolveBusinessProfileImage, resolveBusinessProfileImgUrl } from "./resolveBusinessProfileImage";

export function resolveMapBusinessImageUrl(business) {
  if (!business || typeof business !== "object") return "";
  return (
    resolveBusinessProfileImgUrl(business, business.business_uid) ||
    resolveBusinessProfileImage(business) ||
    String(business.business_profile_img || "").trim()
  );
}

export function shouldShowMapBusinessImage(business) {
  const url = resolveMapBusinessImageUrl(business);
  if (!url) return false;

  const imageIsPublic =
    isBusinessFieldPublic(business.business_profile_img_is_public) ||
    isBusinessFieldPublic(business.business_image_is_public) ||
    isBusinessFieldPublic(business.image_is_public) ||
    isBusinessFieldPublic(business.imageIsPublic);

  const hasPublicFlag =
    business.business_profile_img_is_public !== undefined ||
    business.business_image_is_public !== undefined ||
    business.image_is_public !== undefined ||
    business.imageIsPublic !== undefined;

  return imageIsPublic || !hasPublicFlag;
}
