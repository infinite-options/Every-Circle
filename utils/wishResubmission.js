import { isSeekingVisibilityBlocked } from "./seekingModeration";
import { resolveProfileItemImageUri, isRemoteHttpUrl } from "./resolveProfileItemImageUri";

export function mapProfileWishToFormItem(wish, profileUid) {
  const rawImg = wish.profile_wish_image || "";
  const resolved = resolveProfileItemImageUri(rawImg, profileUid);
  return {
    profile_wish_uid: wish.profile_wish_uid || "",
    helpNeeds: wish.helpNeeds || wish.profile_wish_title || "",
    details: wish.details || wish.profile_wish_description || "",
    amount: wish.amount || wish.profile_wish_bounty || "",
    profile_wish_bounty_type: wish.profile_wish_bounty_type || "none",
    cost: wish.cost || wish.profile_wish_cost || "",
    profile_wish_quantity: wish.profile_wish_quantity != null ? String(wish.profile_wish_quantity) : "",
    profile_wish_image: rawImg,
    profile_wish_image_is_public: wish.profile_wish_image_is_public === 0 || wish.profile_wish_image_is_public === "0" ? 0 : 1,
    profile_wish_start: wish.profile_wish_start || "",
    profile_wish_end: wish.profile_wish_end || "",
    profile_wish_location: wish.profile_wish_location || "",
    profile_wish_latitude: wish.profile_wish_latitude != null ? parseFloat(wish.profile_wish_latitude) : null,
    profile_wish_longitude: wish.profile_wish_longitude != null ? parseFloat(wish.profile_wish_longitude) : null,
    profile_wish_city: wish.profile_wish_city || "",
    profile_wish_state: wish.profile_wish_state || "",
    profile_wish_mode: wish.profile_wish_mode || "",
    profile_wish_updated_at: wish.profile_wish_updated_at ?? wish.updated_at,
    profile_wish_moderated: wish.profile_wish_moderated,
    moderation: wish.moderation,
    isPublic: wish.isPublic !== undefined ? wish.isPublic : wish.profile_wish_is_public === 1,
    _wishNewImageUri: "",
    _wishWebImageFile: null,
    _wishOriginalImage: isRemoteHttpUrl(resolved) ? resolved : "",
    _wishDeleteImageUrl: "",
    _wishImageError: false,
  };
}

export function mapWishFormToPayload(w) {
  const wantsPublic = !!w.isPublic;
  const publicBlocked = isSeekingVisibilityBlocked(w);
  const isPublicValue = publicBlocked && wantsPublic ? 0 : wantsPublic ? 1 : 0;
  return {
    profile_wish_uid: w.profile_wish_uid || "",
    profile_wish_title: w.helpNeeds || "",
    profile_wish_description: w.details || "",
    profile_wish_cost: w.cost || "",
    profile_wish_quantity: w.profile_wish_quantity != null && w.profile_wish_quantity !== "" ? String(w.profile_wish_quantity) : "",
    profile_wish_bounty: w.amount || "",
    profile_wish_bounty_type: w.profile_wish_bounty_type || "none",
    profile_wish_is_public: isPublicValue,
    profile_wish_image: w.profile_wish_image || "",
    profile_wish_image_is_public: w.profile_wish_image_is_public === 0 || w.profile_wish_image_is_public === "0" ? 0 : 1,
    profile_wish_start: w.profile_wish_start || "",
    profile_wish_end: w.profile_wish_end || "",
    profile_wish_location: w.profile_wish_location || "",
    profile_wish_latitude: w.profile_wish_latitude != null ? parseFloat(w.profile_wish_latitude) : null,
    profile_wish_longitude: w.profile_wish_longitude != null ? parseFloat(w.profile_wish_longitude) : null,
    profile_wish_city: w.profile_wish_city || "",
    profile_wish_state: w.profile_wish_state || "",
    profile_wish_mode: w.profile_wish_mode || "",
    ...(w.profile_wish_uid && (w.profile_wish_updated_at != null || w.updated_at != null)
      ? { profile_wish_updated_at: w.profile_wish_updated_at ?? w.updated_at }
      : {}),
    helpNeeds: w.helpNeeds || "",
    details: w.details || "",
    amount: w.amount || "",
    cost: w.cost || "",
    isPublic: isPublicValue === 1,
  };
}
