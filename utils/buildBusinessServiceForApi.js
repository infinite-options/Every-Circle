import { parsePrice } from "./priceUtils";
import { parseTagList, serializeTagList } from "./tagListUtils";

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

export function normServiceTags(service) {
  return serializeTagList(parseTagList(service?.bs_tags));
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
      if (service.bs_is_taxable === 1 || service.bs_is_taxable === "1" || service.bs_is_taxable === true) return 1;
      if (service.bs_is_taxable === 0 || service.bs_is_taxable === "0" || service.bs_is_taxable === false) return 0;
      return parsePrice(service.bs_tax_rate) > 0 ? 1 : 0;
    })(),
    bs_tax_rate: (() => {
      const taxable =
        service.bs_is_taxable === 1 ||
        service.bs_is_taxable === "1" ||
        service.bs_is_taxable === true ||
        (!(service.bs_is_taxable === 0 || service.bs_is_taxable === "0" || service.bs_is_taxable === false) && parsePrice(service.bs_tax_rate) > 0);
      if (!taxable) return "0";
      const s = String(service.bs_tax_rate ?? "").trim();
      return s !== "" ? s : "0";
    })(),
    bs_discount_allowed: typeof service.bs_discount_allowed === "undefined" ? 1 : service.bs_discount_allowed,
    bs_refund_policy: service.bs_refund_policy || "",
    bs_return_window_days: String(returnWindowDays),
    bs_is_returnable: returnable,
    is_returnable: returnable,
    return_window_days: String(returnWindowDays),
    bs_display_order: typeof service.bs_display_order === "undefined" ? idx + 1 : service.bs_display_order,
    bs_tags: normServiceTags(service),
    bs_duration_minutes: service.bs_duration_minutes || "",
    bs_cost: service.bs_cost || "",
    bs_cost_currency: service.bs_cost_currency || "USD",
    bs_is_visible: typeof service.bs_is_visible === "undefined" ? 1 : service.bs_is_visible,
    bs_status: service.bs_status || "active",
    bs_image_key: service.bs_image_key || "",
    bs_qty_unlimited: service.bs_qty_unlimited === 0 || service.bs_qty_unlimited === "0" ? 0 : 1,
    bs_available_quantity: service.bs_qty_unlimited === 0 || service.bs_qty_unlimited === "0" ? String(service.bs_available_quantity || "").trim() : "",
    bs_condition_type: condType,
    bs_condition_detail: condType === "used" ? (service.bs_condition_detail || "").trim() : "",
    bs_free_shipping: norm01(service.bs_free_shipping),
    bs_buyer_pays_shipping: norm01(service.bs_buyer_pays_shipping),
    bs_service_image_is_public: norm01(service.bs_service_image_is_public),
    bs_choice_groups: service.bs_choice_groups || [],
    bs_special_instructions_enabled: service.bs_special_instructions_enabled || 0,
    bs_special_instructions_max_chars: service.bs_special_instructions_max_chars || 80,
  };

  if (service.bs_uid && String(service.bs_uid).trim() !== "") {
    return { ...baseSchema, bs_uid: String(service.bs_uid).trim() };
  }

  return baseSchema;
}
