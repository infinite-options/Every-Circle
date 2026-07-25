import {
  BS_SHIPPING_BUYER_ACTUAL,
  BS_SHIPPING_BUYER_FIXED,
  BS_SHIPPING_FREE,
  parseBsShipping,
  parseBsShippingAmount,
  isBuyerPaysShippingValue,
} from "./businessServiceShipping";

/** Map offering fields onto the shape expected by business shipping helpers. */
function offeringAsShippingCarrier(item) {
  if (!item || typeof item !== "object") return {};
  return {
    bs_shipping: item.profile_expertise_shipping,
    bs_shipping_amount: item.profile_expertise_shipping_amount,
    bs_free_shipping: item.profile_expertise_free_shipping,
    bs_buyer_pays_shipping: item.profile_expertise_buyer_pays_shipping,
    bs_shipping_cost_type: item.profile_expertise_shipping_cost_type,
    bs_fixed_shipping_amount: item.profile_expertise_shipping_amount,
  };
}

export function parseOfferingShipping(item) {
  return parseBsShipping(offeringAsShippingCarrier(item));
}

export function isFixedOfferingShipping(item) {
  return parseOfferingShipping(item) === BS_SHIPPING_BUYER_FIXED;
}

export function isBuyerPaysOfferingShipping(item) {
  return isBuyerPaysShippingValue(offeringAsShippingCarrier(item));
}

export function normOfferingShippingRefundable(item) {
  const v = item?.profile_expertise_shipping_refundable;
  return v === 1 || v === "1" || v === true ? 1 : 0;
}

export function offeringShippingAmountDisplay(item) {
  if (!isFixedOfferingShipping(item)) return "";
  const raw = item?.profile_expertise_shipping_amount;
  if (raw == null || raw === "") return "";
  if (raw === 0 || raw === "0" || raw === "0.00") return "0";
  return String(raw);
}

export function getOfferingShippingDropdownValue(item) {
  const shipping = parseOfferingShipping(item);
  if (shipping == null) return "na";
  if (shipping === BS_SHIPPING_FREE) return "free";
  if (shipping === BS_SHIPPING_BUYER_FIXED) return "buyer_fixed";
  if (shipping === BS_SHIPPING_BUYER_ACTUAL) return "buyer_actual";
  if (isBuyerPaysOfferingShipping(item)) return "buyer_actual";
  return "na";
}

export function applyOfferingShippingDropdownValue(value) {
  if (value === "na") {
    return {
      profile_expertise_shipping: null,
      profile_expertise_shipping_amount: null,
      profile_expertise_shipping_refundable: 0,
      profile_expertise_free_shipping: 0,
      profile_expertise_buyer_pays_shipping: 0,
      profile_expertise_shipping_cost_type: "",
    };
  }
  if (value === "free") {
    return {
      profile_expertise_shipping: BS_SHIPPING_FREE,
      profile_expertise_shipping_amount: null,
      profile_expertise_shipping_refundable: 0,
      profile_expertise_free_shipping: 1,
      profile_expertise_buyer_pays_shipping: 0,
      profile_expertise_shipping_cost_type: "",
    };
  }
  if (value === "buyer_fixed") {
    return {
      profile_expertise_shipping: BS_SHIPPING_BUYER_FIXED,
      profile_expertise_free_shipping: 0,
      profile_expertise_buyer_pays_shipping: 1,
      profile_expertise_shipping_cost_type: "fixed",
    };
  }
  if (value === "buyer_actual") {
    return {
      profile_expertise_shipping: BS_SHIPPING_BUYER_ACTUAL,
      profile_expertise_shipping_amount: null,
      profile_expertise_shipping_refundable: 0,
      profile_expertise_free_shipping: 0,
      profile_expertise_buyer_pays_shipping: 1,
      profile_expertise_shipping_cost_type: "actual",
    };
  }
  return {};
}

/** Normalize API / legacy rows for edit forms. */
export function applyOfferingShippingFromApi(item) {
  let shipping = parseOfferingShipping(item);
  if (shipping === "Buyer") shipping = BS_SHIPPING_BUYER_ACTUAL;

  let amount = null;
  if (shipping === BS_SHIPPING_BUYER_FIXED) {
    const rawAmount = item?.profile_expertise_shipping_amount;
    if (rawAmount === 0 || rawAmount === "0" || rawAmount === "0.00") {
      amount = 0;
    } else {
      amount = parseBsShippingAmount(rawAmount);
    }
  }

  return {
    profile_expertise_shipping: shipping,
    profile_expertise_shipping_amount: amount == null ? "" : String(amount),
    profile_expertise_free_shipping: shipping === BS_SHIPPING_FREE ? 1 : 0,
    profile_expertise_buyer_pays_shipping: shipping === BS_SHIPPING_BUYER_ACTUAL || shipping === BS_SHIPPING_BUYER_FIXED ? 1 : 0,
    profile_expertise_shipping_cost_type: shipping === BS_SHIPPING_BUYER_FIXED ? "fixed" : shipping === BS_SHIPPING_BUYER_ACTUAL ? "actual" : "",
  };
}

export function isOfferingQtyUnlimited(item) {
  // UI-only while editing; not persisted on profile_expertise.
  const flag = item?.profile_expertise_qty_unlimited;
  if (flag === 1 || flag === "1" || flag === true) return true;
  if (flag === 0 || flag === "0" || flag === false) return false;
  const qty = item?.quantity ?? item?.profile_expertise_quantity ?? "";
  const qtyStr = qty != null ? String(qty).trim().toLowerCase() : "";
  return !qtyStr || qtyStr === "unlimited";
}

export function applyOfferingQuantityFromApi(exp) {
  const qty = exp?.quantity ?? exp?.profile_expertise_quantity ?? "";
  const qtyStr = qty != null ? String(qty).trim() : "";
  if (qtyStr && qtyStr.toLowerCase() !== "unlimited") {
    return { profile_expertise_qty_unlimited: 0, quantity: qtyStr };
  }
  return { profile_expertise_qty_unlimited: 1, quantity: "" };
}

/** Build canonical shipping fields for profile save API (mirrors buildBsShippingApiFields). */
export function buildOfferingShippingForApi(item) {
  const shipping = parseOfferingShipping(item);
  if (shipping === BS_SHIPPING_FREE) {
    return {
      profile_expertise_shipping: BS_SHIPPING_FREE,
      profile_expertise_shipping_amount: null,
      profile_expertise_shipping_refundable: normOfferingShippingRefundable(item),
    };
  }
  if (shipping === BS_SHIPPING_BUYER_ACTUAL) {
    return {
      profile_expertise_shipping: BS_SHIPPING_BUYER_ACTUAL,
      profile_expertise_shipping_amount: null,
      profile_expertise_shipping_refundable: normOfferingShippingRefundable(item),
    };
  }
  if (shipping === BS_SHIPPING_BUYER_FIXED) {
    const raw = item?.profile_expertise_shipping_amount;
    let amount = parseBsShippingAmount(raw);
    if (amount == null && (raw === 0 || raw === "0" || raw === "0.00")) amount = 0;
    return {
      profile_expertise_shipping: BS_SHIPPING_BUYER_FIXED,
      profile_expertise_shipping_amount: amount == null ? null : amount,
      profile_expertise_shipping_refundable: normOfferingShippingRefundable(item),
    };
  }
  return {
    profile_expertise_shipping: null,
    profile_expertise_shipping_amount: null,
    profile_expertise_shipping_refundable: 0,
  };
}
