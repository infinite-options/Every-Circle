import { parsePrice } from "./priceUtils";
import { isTruthyTaxableFlag, isValidTaxRate } from "./taxValidation";
import { parseTagList, serializeTagList } from "./tagListUtils";
import { buildBsShippingApiFields, isBuyerPaysShippingValue } from "./businessServiceShipping";

export const DEFAULT_RETURN_WINDOW_DAYS = "5";

export function normServiceReturnable(service) {
  return service?.bs_is_returnable === 1 ||
    service?.bs_is_returnable === "1" ||
    service?.bs_is_returnable === true ||
    service?.is_returnable === 1 ||
    service?.is_returnable === "1" ||
    service?.is_returnable === true
    ? 1
    : 0;
}

export function normServiceReturnWindowDays(service) {
  if (!normServiceReturnable(service)) return 0;
  const d = String(service.bs_return_window_days ?? "").trim();
  if (!d || d === "0" || !/^\d+$/.test(d) || parseInt(d, 10) < 1) return parseInt(DEFAULT_RETURN_WINDOW_DAYS, 10);
  return parseInt(d, 10);
}

/** 1 when returnable, buyer pays shipping, and seller refunds shipping on post-delivery returns. Pre-ship cancels always refund shipping separately. */
export function normServiceShippingRefundable(service) {
  if (!normServiceReturnable(service)) return 0;
  if (!isBuyerPaysShippingValue(service)) return 0;
  return service?.bs_shipping_refundable === 1 ||
    service?.bs_shipping_refundable === "1" ||
    service?.bs_shipping_refundable === true
    ? 1
    : 0;
}

export function normServiceTags(service) {
  return serializeTagList(parseTagList(service?.bs_tags));
}

/** Stable multipart key for product images at array index 1+ (e.g. product_2). */
export function productImageUploadKey(arrayIndex) {
  return `product_${arrayIndex + 1}`;
}

/** Multipart file field for a product image upload (e.g. product_2_img_0). */
export function productImageFileFieldName(bsImageKey, imageIndex = 0) {
  return `${bsImageKey}_img_${imageIndex}`;
}

function isHttpUrl(value) {
  const s = value == null ? "" : String(value).trim();
  return s.startsWith("http://") || s.startsWith("https://");
}

function hasPendingServiceImageUpload(service) {
  return Boolean(service?._svcNewImageUri || service?._svcWebImageFile);
}

/**
 * Build one business_services row for PUT/POST (backend contract).
 * Strips client-only fields (_svc*, business_cc_fee_payer).
 */
export function buildBusinessServiceForApi(service, idx = 0) {
  const condRaw = service.bs_condition_type;
  const condLow = condRaw == null ? "" : String(condRaw).trim().toLowerCase();
  const condType = condLow === "used" ? "used" : condLow === "new" ? "new" : "";
  const bountyNone = service.bs_bounty_type === "none" || !String(service.bs_bounty || "").trim();
  const bountyTypeOut = bountyNone ? "per_item" : service.bs_bounty_type === "total" ? "total" : "per_item";
  const bountyOut = bountyNone ? "" : service.bs_bounty || "";
  const norm01 = (v) => (v === 1 || v === "1" || v === true ? 1 : 0);
  const returnable = normServiceReturnable(service);
  const returnWindowDays = normServiceReturnWindowDays(service);

  const baseSchema = {
    bs_service_name: service.bs_service_name || "",
    bs_service_desc: service.bs_service_desc || "",
    bs_notes: service.bs_notes || "",
    bs_sku: service.bs_sku || "",
    bs_bounty: bountyOut,
    bs_bounty_currency: service.bs_bounty_currency || "USD",
    bs_bounty_type: bountyTypeOut,
    bs_is_taxable: (() => {
      if (isTruthyTaxableFlag(service.bs_is_taxable) && isValidTaxRate(service.bs_tax_rate)) return 1;
      if (service.bs_is_taxable === 0 || service.bs_is_taxable === "0" || service.bs_is_taxable === false) return 0;
      return parsePrice(service.bs_tax_rate) > 0 ? 1 : 0;
    })(),
    bs_tax_rate: (() => {
      const taxable = isTruthyTaxableFlag(service.bs_is_taxable) && isValidTaxRate(service.bs_tax_rate);
      if (!taxable) return "0";
      return String(service.bs_tax_rate ?? "").trim();
    })(),
    bs_discount_allowed: typeof service.bs_discount_allowed === "undefined" ? 1 : service.bs_discount_allowed,
    bs_refund_policy: service.bs_refund_policy || "",
    bs_return_window_days: String(returnWindowDays),
    bs_is_returnable: returnable,
    is_returnable: returnable,
    return_window_days: String(returnWindowDays),
    bs_shipping_refundable: normServiceShippingRefundable(service),
    bs_display_order: typeof service.bs_display_order === "undefined" ? idx + 1 : service.bs_display_order,
    bs_tags: normServiceTags(service),
    bs_duration_minutes: service.bs_duration_minutes || "",
    bs_cost: service.bs_cost || "",
    bs_cost_currency: service.bs_cost_currency || "USD",
    bs_is_visible: typeof service.bs_is_visible === "undefined" ? 1 : service.bs_is_visible,
    bs_status: service.bs_status || "active",
    bs_qty_unlimited: service.bs_qty_unlimited === 0 || service.bs_qty_unlimited === "0" ? 0 : 1,
    bs_available_quantity: service.bs_qty_unlimited === 0 || service.bs_qty_unlimited === "0" ? String(service.bs_available_quantity || "").trim() : "",
    bs_condition_type: condType,
    bs_condition_detail: condType === "used" ? (service.bs_condition_detail || "").trim() : "",
    ...buildBsShippingApiFields(service),
    bs_service_image_is_public: norm01(service.bs_service_image_is_public),
    bs_choice_groups: service.bs_choice_groups || [],
    bs_special_instructions_enabled: service.bs_special_instructions_enabled || 0,
    bs_special_instructions_max_chars: service.bs_special_instructions_max_chars || 80,
  };

  const hasNewUpload = hasPendingServiceImageUpload(service);
  const deleteUrl = isHttpUrl(service._svcDeleteImageUrl) ? String(service._svcDeleteImageUrl).trim() : "";

  if (idx === 0) {
    // Product #1: file upload uses top-level bs_service_image_0 only — never bs_image_key when uploading.
    // Unchanged or delete-only rows omit bs_image_key; delete uses top-level delete_bs_service_image_0.
  } else if (hasNewUpload) {
    const keyRaw = service.bs_image_key != null ? String(service.bs_image_key).trim() : "";
    baseSchema.bs_image_key = keyRaw && !isHttpUrl(keyRaw) ? keyRaw : productImageUploadKey(idx);
    if (deleteUrl) {
      baseSchema.delete_images = JSON.stringify([deleteUrl]);
    }
  } else if (deleteUrl) {
    baseSchema.delete_images = JSON.stringify([deleteUrl]);
  } else if (isHttpUrl(service.bs_image_key)) {
    // URL-based image without file upload.
    baseSchema.bs_image_key = String(service.bs_image_key).trim();
  }

  if (service.bs_uid && String(service.bs_uid).trim() !== "") {
    return { ...baseSchema, bs_uid: String(service.bs_uid).trim() };
  }

  return baseSchema;
}
