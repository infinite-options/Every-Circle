import {
  BS_SHIPPING_BUYER_ACTUAL,
  BS_SHIPPING_BUYER_FIXED,
  BS_SHIPPING_FREE,
  parseBsShipping,
  parseBsShippingAmount,
  isBuyerPaysShippingValue,
} from "./businessServiceShipping";
import { parseExpertiseModeFlags } from "./expertiseMode";

/** Buyer-facing label for delivery fees (same copy as Offering). */
export const SEEKING_DELIVERY_CHARGE_LABEL = "Delivery charge";

/** Card badge / detail row label (describes the delivery setting, not the dollar amount). */
export const SEEKING_DELIVERY_OPTION_CARD_LABEL = "Delivery option";

/** Fixed-amount field label in seeking edit forms. */
export const FIXED_DELIVERY_CHARGE_AMOUNT_LABEL = "Fixed delivery charge";

const DELIVERY_CHARGE_DROPDOWN_OPTIONS = [
  { label: "Not applicable", value: "na" },
  { label: "Free delivery charge", value: "free" },
  { label: "Buyer pays (fixed)", value: "buyer_fixed" },
  { label: "Buyer pays (actual)", value: "buyer_actual" },
];

/** Map seeking fields onto the shape expected by business shipping helpers. */
function seekingAsShippingCarrier(item) {
  if (!item || typeof item !== "object") return {};
  return {
    bs_shipping: item.profile_wish_shipping,
    bs_shipping_amount: item.profile_wish_shipping_amount,
    bs_free_shipping: item.profile_wish_free_shipping,
    bs_buyer_pays_shipping: item.profile_wish_buyer_pays_shipping,
    bs_shipping_cost_type: item.profile_wish_shipping_cost_type,
    bs_fixed_shipping_amount: item.profile_wish_shipping_amount,
  };
}

export function parseSeekingShipping(item) {
  return parseBsShipping(seekingAsShippingCarrier(item));
}

export function isFixedSeekingShipping(item) {
  return parseSeekingShipping(item) === BS_SHIPPING_BUYER_FIXED;
}

export function isBuyerPaysSeekingShipping(item) {
  return isBuyerPaysShippingValue(seekingAsShippingCarrier(item));
}

export function normSeekingShippingRefundable(item) {
  const v = item?.profile_wish_shipping_refundable;
  return v === 1 || v === "1" || v === true ? 1 : 0;
}

export function seekingShippingAmountDisplay(item) {
  if (!isFixedSeekingShipping(item)) return "";
  const raw = item?.profile_wish_shipping_amount;
  if (raw == null || raw === "") return "";
  if (raw === 0 || raw === "0" || raw === "0.00") return "0";
  return String(raw);
}

/** Fixed per-unit delivery charge the seeker pays at checkout, or null if not Buyer Fixed. */
export function getSeekingFixedShippingPerUnit(item) {
  if (!isFixedSeekingShipping(item)) return null;
  const raw = item?.profile_wish_shipping_amount;
  if (raw === 0 || raw === "0" || raw === "0.00") return 0;
  const amount = parseBsShippingAmount(raw);
  if (amount == null) return null;
  return amount;
}

export function isSeekingShippingConfigured(item) {
  return parseSeekingShipping(item) != null;
}

export function seekingDeliveredModeSelected(item) {
  return parseExpertiseModeFlags(item?.profile_wish_mode).delivered;
}

/** Delivered mode requires shipping/delivery to be set (not N/A); fixed requires an amount. */
export function validateSeekingDeliveredShipping(item) {
  if (!seekingDeliveredModeSelected(item)) return true;
  const shipping = parseSeekingShipping(item);
  if (shipping == null) return false;
  if (isFixedSeekingShipping(item)) {
    const raw = String(item?.profile_wish_shipping_amount ?? "").trim();
    if (!raw || raw === ".") return false;
    const amount = parseBsShippingAmount(raw);
    if (amount == null && !(raw === "0" || raw === "0.0" || raw === "0.00")) return false;
  }
  return true;
}

export function getSeekingShippingDropdownOptions(item) {
  if (!seekingDeliveredModeSelected(item)) return DELIVERY_CHARGE_DROPDOWN_OPTIONS;
  return DELIVERY_CHARGE_DROPDOWN_OPTIONS.filter((option) => option.value !== "na");
}

export function getSeekingShippingDropdownValue(item) {
  const shipping = parseSeekingShipping(item);
  if (shipping == null) return "na";
  if (shipping === BS_SHIPPING_FREE) return "free";
  if (shipping === BS_SHIPPING_BUYER_FIXED) return "buyer_fixed";
  if (shipping === BS_SHIPPING_BUYER_ACTUAL) return "buyer_actual";
  if (isBuyerPaysSeekingShipping(item)) return "buyer_actual";
  return "na";
}

export function applySeekingShippingDropdownValue(value) {
  if (value === "na") {
    return {
      profile_wish_shipping: null,
      profile_wish_shipping_amount: null,
      profile_wish_shipping_refundable: 0,
      profile_wish_free_shipping: 0,
      profile_wish_buyer_pays_shipping: 0,
      profile_wish_shipping_cost_type: "",
    };
  }
  if (value === "free") {
    return {
      profile_wish_shipping: BS_SHIPPING_FREE,
      profile_wish_shipping_amount: null,
      profile_wish_shipping_refundable: 0,
      profile_wish_free_shipping: 1,
      profile_wish_buyer_pays_shipping: 0,
      profile_wish_shipping_cost_type: "",
    };
  }
  if (value === "buyer_fixed") {
    return {
      profile_wish_shipping: BS_SHIPPING_BUYER_FIXED,
      profile_wish_free_shipping: 0,
      profile_wish_buyer_pays_shipping: 1,
      profile_wish_shipping_cost_type: "fixed",
    };
  }
  if (value === "buyer_actual") {
    return {
      profile_wish_shipping: BS_SHIPPING_BUYER_ACTUAL,
      profile_wish_shipping_amount: null,
      profile_wish_shipping_refundable: 0,
      profile_wish_free_shipping: 0,
      profile_wish_buyer_pays_shipping: 1,
      profile_wish_shipping_cost_type: "actual",
    };
  }
  return {};
}

/** Normalize API / legacy rows for edit forms. */
export function applySeekingShippingFromApi(item) {
  let shipping = parseSeekingShipping(item);
  if (shipping === "Buyer") shipping = BS_SHIPPING_BUYER_ACTUAL;

  let amount = null;
  if (shipping === BS_SHIPPING_BUYER_FIXED) {
    const rawAmount = item?.profile_wish_shipping_amount;
    if (rawAmount === 0 || rawAmount === "0" || rawAmount === "0.00") {
      amount = 0;
    } else {
      amount = parseBsShippingAmount(rawAmount);
    }
  }

  return {
    profile_wish_shipping: shipping,
    profile_wish_shipping_amount: amount == null ? "" : String(amount),
    profile_wish_free_shipping: shipping === BS_SHIPPING_FREE ? 1 : 0,
    profile_wish_buyer_pays_shipping: shipping === BS_SHIPPING_BUYER_ACTUAL || shipping === BS_SHIPPING_BUYER_FIXED ? 1 : 0,
    profile_wish_shipping_cost_type: shipping === BS_SHIPPING_BUYER_FIXED ? "fixed" : shipping === BS_SHIPPING_BUYER_ACTUAL ? "actual" : "",
  };
}

/** Build canonical shipping fields for profile save API (mirrors buildOfferingShippingForApi). */
export function buildSeekingShippingForApi(item) {
  const shipping = parseSeekingShipping(item);
  if (shipping === BS_SHIPPING_FREE) {
    return {
      profile_wish_shipping: BS_SHIPPING_FREE,
      profile_wish_shipping_amount: null,
      profile_wish_shipping_refundable: normSeekingShippingRefundable(item),
    };
  }
  if (shipping === BS_SHIPPING_BUYER_ACTUAL) {
    return {
      profile_wish_shipping: BS_SHIPPING_BUYER_ACTUAL,
      profile_wish_shipping_amount: null,
      profile_wish_shipping_refundable: normSeekingShippingRefundable(item),
    };
  }
  if (shipping === BS_SHIPPING_BUYER_FIXED) {
    const raw = item?.profile_wish_shipping_amount;
    let amount = parseBsShippingAmount(raw);
    if (amount == null && (raw === 0 || raw === "0" || raw === "0.00")) amount = 0;
    return {
      profile_wish_shipping: BS_SHIPPING_BUYER_FIXED,
      profile_wish_shipping_amount: amount == null ? null : amount,
      profile_wish_shipping_refundable: normSeekingShippingRefundable(item),
    };
  }
  return {
    profile_wish_shipping: null,
    profile_wish_shipping_amount: null,
    profile_wish_shipping_refundable: 0,
  };
}
