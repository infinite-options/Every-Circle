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
    profile_expertise_zip: exp.profile_expertise_zip || "",
    profile_expertise_mode: exp.profile_expertise_mode || "",
    profile_expertise_is_taxable: exp.profile_expertise_is_taxable ?? 0,
    profile_expertise_tax_rate: exp.profile_expertise_tax_rate ?? "",
    profile_expertise_condition_type: exp.profile_expertise_condition_type || "na",
    profile_expertise_condition_detail: exp.profile_expertise_condition_detail || "",
    profile_expertise_bounty_type: exp.profile_expertise_bounty_type || "none",
    profile_expertise_is_returnable: exp.profile_expertise_is_returnable === 1 || exp.profile_expertise_is_returnable === "1" ? 1 : 0,
    // Clamp into the valid 5-30 range on load too (mirrors mapOfferingFormToPayload below) — otherwise a
    // previously-saved "Returnable" item with a missing/out-of-range days value loads as still-invalid
    // with no obvious way for the user to tell why Submit stays disabled.
    profile_expertise_return_window_days: (() => {
      const returnable = exp.profile_expertise_is_returnable === 1 || exp.profile_expertise_is_returnable === "1";
      if (!returnable) return "";
      const n = parseInt(String(exp.profile_expertise_return_window_days ?? "").trim(), 10);
      if (!Number.isFinite(n) || n < 5) return "5";
      if (n > 30) return "30";
      return String(n);
    })(),
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

/**
 * A blank Cost amount (e.g. only a unit was picked, or nothing was entered at all) defaults
 * to 0.00 at submit time — it should never be saved/displayed blank, and never silently
 * becomes "Free" (that only happens when the user explicitly types "Free").
 */
export function normalizeOfferingCostForSubmit(cost) {
  const raw = String(cost ?? "").trim();
  if (!raw) return "0.00";
  if (raw.toLowerCase() === "free") return raw;

  const cleaned = raw.replace(/\$/g, "").trim();
  const lower = cleaned.toLowerCase();
  if (lower === "total") return "0.00 total";
  if (lower.endsWith("total")) {
    const amount = cleaned.replace(/total$/i, "").trim();
    return amount ? cleaned : "0.00 total";
  }
  if (cleaned.startsWith("/")) return `0.00${cleaned}`;
  const parts = cleaned.split("/");
  if (parts.length >= 2 && !parts[0].trim()) return `0.00/${parts.slice(1).join("/").trim()}`;
  return cleaned;
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
  const normalizedCost = normalizeOfferingCostForSubmit(e.cost);
  return {
    profile_expertise_uid: e.profile_expertise_uid || "",
    profile_expertise_title: e.name || "",
    profile_expertise_description: e.description || "",
    // Unlimited stock: omit quantity or send "" — backend has no qty_unlimited column.
    profile_expertise_quantity: unlimited ? "" : e.quantity != null && e.quantity !== "" ? String(e.quantity) : "",
    profile_expertise_cost: normalizedCost,
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
    profile_expertise_zip: e.profile_expertise_zip || "",
    profile_expertise_mode: e.profile_expertise_mode || "",
    profile_expertise_is_taxable: e.profile_expertise_is_taxable === 1 || e.profile_expertise_is_taxable === "1" ? 1 : 0,
    profile_expertise_tax_rate: e.profile_expertise_tax_rate || "",
    ...buildOfferingConditionForApi(e),
    profile_expertise_bounty_type: e.profile_expertise_bounty_type || "none",
    profile_expertise_is_returnable: e.profile_expertise_is_returnable === 1 || e.profile_expertise_is_returnable === "1" ? 1 : 0,
    profile_expertise_return_window_days: (() => {
      const returnable = e.profile_expertise_is_returnable === 1 || e.profile_expertise_is_returnable === "1";
      if (!returnable) return "";
      const n = parseInt(String(e.profile_expertise_return_window_days ?? "").trim(), 10);
      if (!Number.isFinite(n) || n < 5) return "5";
      if (n > 30) return "30";
      return String(n);
    })(),
    profile_expertise_refund_policy: e.profile_expertise_refund_policy || "",
    ...shippingFields,
    ...(e.profile_expertise_uid && (e.profile_expertise_updated_at != null || e.updated_at != null)
      ? { profile_expertise_updated_at: e.profile_expertise_updated_at ?? e.updated_at }
      : {}),
    name: e.name || "",
    description: e.description || "",
    quantity: unlimited ? "" : e.quantity || "",
    cost: normalizedCost,
    bounty: e.bounty || "",
    isPublic: isPublicValue === 1,
  };
}
