import { isOfferingVisibilityBlocked } from "./offeringModeration";
import { resolveProfileItemImageUri, isRemoteHttpUrl } from "./resolveProfileItemImageUri";
import { applyOfferingQuantityFromApi, applyOfferingShippingFromApi, buildOfferingShippingForApi, isOfferingQtyUnlimited } from "./profileOfferingShipping";

export function mapProfileOfferingToFormItem(exp, profileUid) {
  const rawImg = exp.profile_expertise_image || "";
  const resolved = resolveProfileItemImageUri(rawImg, profileUid);
  const shippingFields = applyOfferingShippingFromApi(exp);
  const quantityFields = applyOfferingQuantityFromApi(exp);
  return {
    profile_expertise_uid: exp.profile_expertise_uid || "",
    name: exp.name || exp.profile_expertise_title || "",
    description: exp.description || exp.profile_expertise_description || "",
    ...quantityFields,
    cost: exp.cost || exp.profile_expertise_cost || "",
    bounty: exp.bounty || exp.profile_expertise_bounty || "",
    profile_expertise_image: rawImg,
    profile_expertise_image_is_public: exp.profile_expertise_image_is_public === 0 || exp.profile_expertise_image_is_public === "0" ? 0 : 1,
    profile_expertise_start: exp.profile_expertise_start || "",
    profile_expertise_end: exp.profile_expertise_end || "",
    profile_expertise_location: exp.profile_expertise_location || "",
    profile_expertise_latitude: exp.profile_expertise_latitude != null ? parseFloat(exp.profile_expertise_latitude) : null,
    profile_expertise_longitude: exp.profile_expertise_longitude != null ? parseFloat(exp.profile_expertise_longitude) : null,
    profile_expertise_city: exp.profile_expertise_city || "",
    profile_expertise_state: exp.profile_expertise_state || "",
    profile_expertise_mode: exp.profile_expertise_mode || "",
    profile_expertise_is_taxable: exp.profile_expertise_is_taxable ?? 0,
    profile_expertise_tax_rate: exp.profile_expertise_tax_rate ?? "",
    profile_expertise_condition_type: exp.profile_expertise_condition_type || "na",
    profile_expertise_condition_detail: exp.profile_expertise_condition_detail || "",
    profile_expertise_bounty_type: exp.profile_expertise_bounty_type || "none",
    profile_expertise_is_returnable: exp.profile_expertise_is_returnable ?? 0,
    profile_expertise_return_window_days: exp.profile_expertise_return_window_days ?? "",
    ...shippingFields,
    profile_expertise_shipping_refundable: exp.profile_expertise_shipping_refundable ?? 0,
    profile_expertise_refund_policy: exp.profile_expertise_refund_policy || "",
    profile_expertise_updated_at: exp.profile_expertise_updated_at ?? exp.updated_at,
    profile_expertise_moderated: exp.profile_expertise_moderated,
    moderation: exp.moderation,
    isPublic: exp.isPublic !== undefined ? exp.isPublic : exp.profile_expertise_is_public === 1,
    _expNewImageUri: "",
    _expWebImageFile: null,
    _expOriginalImage: isRemoteHttpUrl(resolved) ? resolved : "",
    _expDeleteImageUrl: "",
    _expImageError: false,
  };
}

/** Normalize offering data for OfferingCardDetails (profile, search, edit list). */
export function buildOfferingCardModel(source, profileUid = "") {
  if (!source || typeof source !== "object") return source;
  return mapProfileOfferingToFormItem(
    {
      ...source,
      name: source.name || source.title || source.profile_expertise_title || "",
      profile_expertise_title: source.profile_expertise_title || source.title || source.name || "",
      description: source.description || source.profile_expertise_description || source.details || "",
      profile_expertise_description: source.profile_expertise_description || source.description || source.details || "",
      quantity: source.quantity ?? source.profile_expertise_quantity ?? "",
      profile_expertise_quantity: source.profile_expertise_quantity ?? source.quantity ?? "",
      cost: source.cost ?? source.profile_expertise_cost ?? "",
      profile_expertise_cost: source.profile_expertise_cost ?? source.cost ?? "",
      bounty: source.bounty ?? source.profile_expertise_bounty ?? "",
      profile_expertise_bounty: source.profile_expertise_bounty ?? source.bounty ?? "",
    },
    profileUid
  );
}

function buildOfferingConditionForApi(e) {
  const condRaw = e?.profile_expertise_condition_type;
  const condLow = condRaw == null ? "" : String(condRaw).trim().toLowerCase();
  const condType = condLow === "used" ? "used" : condLow === "new" ? "new" : "na";
  return {
    profile_expertise_condition_type: condType,
    profile_expertise_condition_detail: condType === "used" ? String(e.profile_expertise_condition_detail || "").trim() : "",
  };
}

export function mapOfferingFormToPayload(e) {
  const wantsPublic = !!e.isPublic;
  const publicBlocked = isOfferingVisibilityBlocked(e);
  const isPublicValue = publicBlocked && wantsPublic ? 0 : wantsPublic ? 1 : 0;
  const unlimited = isOfferingQtyUnlimited(e);
  const shippingFields = buildOfferingShippingForApi(e);
  return {
    profile_expertise_uid: e.profile_expertise_uid || "",
    profile_expertise_title: e.name || "",
    profile_expertise_description: e.description || "",
    // Unlimited stock: omit quantity or send "" — backend has no qty_unlimited column.
    profile_expertise_quantity: unlimited ? "" : e.quantity != null && e.quantity !== "" ? String(e.quantity) : "",
    profile_expertise_cost: e.cost || "",
    profile_expertise_bounty: e.bounty || "",
    profile_expertise_is_public: isPublicValue,
    profile_expertise_image: e.profile_expertise_image || "",
    profile_expertise_image_is_public: e.profile_expertise_image_is_public === 0 || e.profile_expertise_image_is_public === "0" ? 0 : 1,
    profile_expertise_start: e.profile_expertise_start || "",
    profile_expertise_end: e.profile_expertise_end || "",
    profile_expertise_location: e.profile_expertise_location || "",
    profile_expertise_latitude: e.profile_expertise_latitude != null ? parseFloat(e.profile_expertise_latitude) : null,
    profile_expertise_longitude: e.profile_expertise_longitude != null ? parseFloat(e.profile_expertise_longitude) : null,
    profile_expertise_city: e.profile_expertise_city || "",
    profile_expertise_state: e.profile_expertise_state || "",
    profile_expertise_mode: e.profile_expertise_mode || "",
    profile_expertise_is_taxable: e.profile_expertise_is_taxable === 1 || e.profile_expertise_is_taxable === "1" ? 1 : 0,
    profile_expertise_tax_rate: e.profile_expertise_tax_rate || "",
    ...buildOfferingConditionForApi(e),
    profile_expertise_bounty_type: e.profile_expertise_bounty_type || "none",
    profile_expertise_is_returnable: e.profile_expertise_is_returnable === 1 || e.profile_expertise_is_returnable === "1" ? 1 : 0,
    profile_expertise_return_window_days: e.profile_expertise_return_window_days || "",
    profile_expertise_refund_policy: e.profile_expertise_refund_policy || "",
    ...shippingFields,
    ...(e.profile_expertise_uid && (e.profile_expertise_updated_at != null || e.updated_at != null)
      ? { profile_expertise_updated_at: e.profile_expertise_updated_at ?? e.updated_at }
      : {}),
    name: e.name || "",
    description: e.description || "",
    quantity: unlimited ? "" : e.quantity || "",
    cost: e.cost || "",
    bounty: e.bounty || "",
    isPublic: isPublicValue === 1,
  };
}
