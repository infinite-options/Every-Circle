/** Canonical business-service shipping values sent to / returned from the API. */
export const BS_SHIPPING_FREE = "Free";
export const BS_SHIPPING_BUYER_ACTUAL = "Buyer Actual";
export const BS_SHIPPING_BUYER_FIXED = "Buyer Fixed";

/**
 * Normalize API / form bs_shipping into null | "Free" | "Buyer Actual" | "Buyer Fixed".
 * Also accepts legacy flag-based rows and older aliases.
 */
export function parseBsShipping(serviceOrValue) {
  if (serviceOrValue != null && typeof serviceOrValue === "object") {
    const raw = serviceOrValue.bs_shipping;
    const fromRaw = parseBsShippingValue(raw);
    if (fromRaw !== undefined) return fromRaw;

    // Legacy flag fields (older FE / cached rows).
    const free =
      serviceOrValue.bs_free_shipping === 1 ||
      serviceOrValue.bs_free_shipping === "1" ||
      serviceOrValue.bs_free_shipping === true;
    const buyer =
      serviceOrValue.bs_buyer_pays_shipping === 1 ||
      serviceOrValue.bs_buyer_pays_shipping === "1" ||
      serviceOrValue.bs_buyer_pays_shipping === true;
    if (free) return BS_SHIPPING_FREE;
    if (buyer) {
      const t = String(serviceOrValue.bs_shipping_cost_type || "")
        .trim()
        .toLowerCase();
      if (t === "fixed" || t === "fixed_amount" || t === "fixed_shipping") return BS_SHIPPING_BUYER_FIXED;
      if (t === "actual" || t === "actual_cost" || t === "actual_shipping") return BS_SHIPPING_BUYER_ACTUAL;
      // Buyer pays selected but subtype unknown — treat as buyer draft for UI only.
      return "Buyer";
    }
    return null;
  }
  return parseBsShippingValue(serviceOrValue) ?? null;
}

function parseBsShippingValue(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "n/a" || s.toLowerCase() === "na") return null;

  const low = s.toLowerCase();
  if (low === "free") return BS_SHIPPING_FREE;
  if (low === "buyer actual" || low === "buyer_actual" || low === "actual") return BS_SHIPPING_BUYER_ACTUAL;
  if (low === "buyer fixed" || low === "buyer_fixed" || low === "fixed") return BS_SHIPPING_BUYER_FIXED;
  if (low === "buyer" || low === "buyer pays" || low === "buyer_pays") return "Buyer";
  if (low.includes("buyer") && low.includes("fixed")) return BS_SHIPPING_BUYER_FIXED;
  if (low.includes("buyer") && low.includes("actual")) return BS_SHIPPING_BUYER_ACTUAL;
  if (low.includes("buyer")) return "Buyer";
  if (low.includes("free")) return BS_SHIPPING_FREE;
  return undefined;
}

/** Parse fixed shipping amount; returns number or null. */
export function parseBsShippingAmount(value) {
  if (value == null || value === "") return null;
  const cleaned = String(value).replace(/\$/g, "").trim();
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/** True when shipping is free or any buyer-pays mode (not N/A). */
export function isBusinessShippingApplicable(service) {
  const shipping = parseBsShipping(service);
  return shipping === BS_SHIPPING_FREE || shipping === BS_SHIPPING_BUYER_ACTUAL || shipping === BS_SHIPPING_BUYER_FIXED || shipping === "Buyer";
}

export function isBuyerPaysShippingValue(shipping) {
  const s = typeof shipping === "object" ? parseBsShipping(shipping) : parseBsShipping(shipping);
  return s === BS_SHIPPING_BUYER_ACTUAL || s === BS_SHIPPING_BUYER_FIXED || s === "Buyer";
}

/** Map cart line (business service or offering) onto bs_shipping carrier shape. */
export function getCartItemShippingCarrier(item) {
  if (!item || typeof item !== "object") return {};
  if (item.itemType === "expertise") {
    return {
      bs_shipping: item.profile_expertise_shipping,
      bs_shipping_amount: item.profile_expertise_shipping_amount,
      bs_free_shipping: item.profile_expertise_free_shipping,
      bs_buyer_pays_shipping: item.profile_expertise_buyer_pays_shipping,
      bs_shipping_cost_type: item.profile_expertise_shipping_cost_type,
      bs_fixed_shipping_amount: item.profile_expertise_shipping_amount,
    };
  }
  return item;
}

function isCartLinePickup(item) {
  return (
    String(item?.fulfillment_method || "")
      .trim()
      .toLowerCase() === "pickup"
  );
}

/** True when a cart line requires the buyer to pay shipping (fixed or actual) and ships. */
export function isCartItemBuyerPaysShipping(item) {
  if (!item || typeof item !== "object" || isCartLinePickup(item)) return false;
  return isBuyerPaysShippingValue(getCartItemShippingCarrier(item));
}

/**
 * Buyer-paid shipping charge for one cart line.
 * Fixed: unit amount × quantity. Actual: $0 placeholder (seller contacts buyer).
 * Pickup lines return null. Offerings use profile_expertise_shipping fields.
 * @returns {null | { type: 'fixed'|'actual', unitAmount: number, amount: number, quantity: number }}
 */
export function getCartItemBuyerShippingCharge(item) {
  if (!item || typeof item !== "object" || isCartLinePickup(item)) return null;
  const shipping = parseBsShipping(getCartItemShippingCarrier(item));
  const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
  if (shipping === BS_SHIPPING_BUYER_FIXED) {
    const carrier = getCartItemShippingCarrier(item);
    const raw = carrier.bs_shipping_amount ?? carrier.bs_fixed_shipping_amount;
    let unitAmount = parseBsShippingAmount(raw);
    if (unitAmount == null && (raw === 0 || raw === "0" || raw === "0.00")) unitAmount = 0;
    if (unitAmount == null) unitAmount = 0;
    return {
      type: "fixed",
      unitAmount,
      amount: Math.round(unitAmount * quantity * 100) / 100,
      quantity,
    };
  }
  if (shipping === BS_SHIPPING_BUYER_ACTUAL || shipping === "Buyer") {
    return { type: "actual", unitAmount: 0, amount: 0, quantity };
  }
  return null;
}

/** Charged shipping $ for one line (for transaction POST line_shipping_amount). */
export function getCartItemLineShippingAmount(item) {
  const charge = getCartItemBuyerShippingCharge(item);
  if (!charge) return 0;
  if (charge.type === "fixed") return charge.amount;
  return 0;
}

/** Sum charged buyer shipping (fixed only) across cart lines. */
export function sumBuyerShippingCharges(items) {
  if (!Array.isArray(items)) return { shippingSubtotal: 0, hasFixedShipping: false, hasActualShipping: false };
  let total = 0;
  let hasFixedShipping = false;
  let hasActualShipping = false;
  for (const item of items) {
    const charge = getCartItemBuyerShippingCharge(item);
    if (!charge) continue;
    if (charge.type === "fixed") {
      hasFixedShipping = true;
      total += charge.amount;
    }
    if (charge.type === "actual") hasActualShipping = true;
  }
  return {
    shippingSubtotal: Math.round(total * 100) / 100,
    hasFixedShipping,
    hasActualShipping,
  };
}

/**
 * Build API shipping fields for PUT/POST.
 * @returns {{ bs_shipping: null|string, bs_shipping_amount: null|number }}
 */
export function buildBsShippingApiFields(service) {
  const shipping = parseBsShipping(service);
  if (shipping === BS_SHIPPING_FREE) {
    return { bs_shipping: BS_SHIPPING_FREE, bs_shipping_amount: null };
  }
  if (shipping === BS_SHIPPING_BUYER_ACTUAL) {
    return { bs_shipping: BS_SHIPPING_BUYER_ACTUAL, bs_shipping_amount: null };
  }
  if (shipping === BS_SHIPPING_BUYER_FIXED) {
    const amount = parseBsShippingAmount(service?.bs_shipping_amount ?? service?.bs_fixed_shipping_amount);
    return {
      bs_shipping: BS_SHIPPING_BUYER_FIXED,
      bs_shipping_amount: amount == null ? null : amount,
    };
  }
  return { bs_shipping: null, bs_shipping_amount: null };
}

/**
 * Normalize GET shipping fields onto a service object for FE display/edit.
 * Keeps legacy boolean flags in sync for older UI helpers.
 */
export function applyBsShippingFromApi(service) {
  let shipping = parseBsShipping(service);
  // Incomplete "Buyer" from legacy flags → default Actual for display.
  if (shipping === "Buyer") shipping = BS_SHIPPING_BUYER_ACTUAL;

  let amount = null;
  if (shipping === BS_SHIPPING_BUYER_FIXED) {
    const rawAmount = service?.bs_shipping_amount ?? service?.bs_fixed_shipping_amount;
    if (rawAmount === 0 || rawAmount === "0" || rawAmount === "0.00") {
      amount = 0;
    } else {
      amount = parseBsShippingAmount(rawAmount);
    }
  }

  return {
    bs_shipping: shipping,
    bs_shipping_amount: amount,
    bs_free_shipping: shipping === BS_SHIPPING_FREE ? 1 : 0,
    bs_buyer_pays_shipping: shipping === BS_SHIPPING_BUYER_ACTUAL || shipping === BS_SHIPPING_BUYER_FIXED ? 1 : 0,
    bs_shipping_cost_type: shipping === BS_SHIPPING_BUYER_FIXED ? "fixed" : shipping === BS_SHIPPING_BUYER_ACTUAL ? "actual" : "",
    bs_fixed_shipping_amount: amount == null ? "" : String(amount),
  };
}

/** Human-readable line for product cards. */
export function formatBsShippingDisplay(service) {
  const shipping = parseBsShipping(service);
  if (shipping === BS_SHIPPING_FREE) return "Shipping: Free shipping";
  if (shipping === BS_SHIPPING_BUYER_ACTUAL) return "Shipping: Buyer pays (actual cost)";
  if (shipping === BS_SHIPPING_BUYER_FIXED) {
    const amount = parseBsShippingAmount(service?.bs_shipping_amount ?? service?.bs_fixed_shipping_amount);
    if (amount == null && (service?.bs_shipping_amount === 0 || service?.bs_shipping_amount === "0")) {
      return "Shipping: Buyer pays ($0.00)";
    }
    if (amount == null) return "Shipping: Buyer pays (fixed)";
    return `Shipping: Buyer pays ($${Number(amount).toFixed(2)})`;
  }
  return null;
}
