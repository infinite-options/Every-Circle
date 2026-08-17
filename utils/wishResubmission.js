import { isSeekingVisibilityBlocked } from "./seekingModeration";
import { resolveProfileItemImageUri, isRemoteHttpUrl } from "./resolveProfileItemImageUri";
import { applySeekingShippingFromApi, buildSeekingShippingForApi } from "./profileSeekingShipping";

/** Shipping / returnable / tax fields used on Seeking listing cards and detail screens. */
export function pickSeekingListingCommerceFields(source = {}) {
  return {
    profile_wish_is_taxable: source.profile_wish_is_taxable,
    profile_wish_tax_rate: source.profile_wish_tax_rate,
    profile_wish_is_returnable: source.profile_wish_is_returnable,
    profile_wish_return_window_days: source.profile_wish_return_window_days,
    profile_wish_refund_policy: source.profile_wish_refund_policy,
    profile_wish_shipping: source.profile_wish_shipping,
    profile_wish_shipping_amount: source.profile_wish_shipping_amount,
    profile_wish_shipping_refundable: source.profile_wish_shipping_refundable,
    profile_wish_free_shipping: source.profile_wish_free_shipping,
    profile_wish_buyer_pays_shipping: source.profile_wish_buyer_pays_shipping,
    profile_wish_shipping_cost_type: source.profile_wish_shipping_cost_type,
  };
}

export function mapProfileWishToFormItem(wish, profileUid) {
  const rawImg = wish.profile_wish_image || "";
  const resolved = resolveProfileItemImageUri(rawImg, profileUid);
  const shippingFields = applySeekingShippingFromApi(wish);
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
    profile_wish_zip: wish.profile_wish_zip || "",
    profile_wish_mode: wish.profile_wish_mode || "",
    profile_wish_is_taxable: wish.profile_wish_is_taxable ?? 0,
    profile_wish_tax_rate: wish.profile_wish_tax_rate ?? "",
    profile_wish_is_returnable: wish.profile_wish_is_returnable ?? 0,
    profile_wish_return_window_days: wish.profile_wish_return_window_days ?? "",
    ...shippingFields,
    profile_wish_shipping_refundable: wish.profile_wish_shipping_refundable ?? 0,
    profile_wish_refund_policy: wish.profile_wish_refund_policy || "",
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
  const shippingFields = buildSeekingShippingForApi(w);
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
    profile_wish_zip: w.profile_wish_zip || "",
    profile_wish_mode: w.profile_wish_mode || "",
    profile_wish_is_taxable: w.profile_wish_is_taxable === 1 || w.profile_wish_is_taxable === "1" ? 1 : 0,
    profile_wish_tax_rate: w.profile_wish_tax_rate || "",
    profile_wish_is_returnable: w.profile_wish_is_returnable === 1 || w.profile_wish_is_returnable === "1" ? 1 : 0,
    profile_wish_return_window_days: (() => {
      const returnable = w.profile_wish_is_returnable === 1 || w.profile_wish_is_returnable === "1";
      if (!returnable) return "";
      const n = parseInt(String(w.profile_wish_return_window_days ?? "").trim(), 10);
      if (!Number.isFinite(n) || n < 5) return "5";
      if (n > 30) return "30";
      return String(n);
    })(),
    profile_wish_refund_policy: w.profile_wish_refund_policy || "",
    ...shippingFields,
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
