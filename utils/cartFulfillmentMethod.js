import { parseExpertiseModeFlags } from "./expertiseMode";
import {
  BS_SHIPPING_BUYER_ACTUAL,
  BS_SHIPPING_BUYER_FIXED,
  applyBsShippingFromApi,
  getCartItemShippingCarrier,
  parseBsShipping,
  parseBsShippingAmount,
  isBuyerPaysShippingValue,
} from "./businessServiceShipping";
import { isOfferingShippingConfigured } from "./profileOfferingShipping";
import { getListingModeString, listingDeliveredFulfillmentAllowed, parseListingModeFlags } from "./listingFulfillmentMode";
import { buildCheckoutLineTaxApiFields } from "./cartLineTax";

export const FULFILLMENT_VIRTUAL = "virtual";
export const FULFILLMENT_SHIP = "ship";
export const FULFILLMENT_PICKUP = "pickup";

const ALL_FULFILLMENT_METHODS = [FULFILLMENT_VIRTUAL, FULFILLMENT_SHIP, FULFILLMENT_PICKUP];

function normalizeFulfillmentMethodValue(value) {
  const method = String(value || "")
    .trim()
    .toLowerCase();
  return ALL_FULFILLMENT_METHODS.includes(method) ? method : "";
}

function skipsShippingForMethod(method) {
  return method === FULFILLMENT_PICKUP || method === FULFILLMENT_VIRTUAL;
}

function buildAvailableFulfillmentMethods(item) {
  const flags = parseListingModeFlags(item);
  const methods = [];
  if (flags.virtual) methods.push(FULFILLMENT_VIRTUAL);
  if (listingDeliveredFulfillmentAllowed(item)) methods.push(FULFILLMENT_SHIP);
  if (flags.inPerson) methods.push(FULFILLMENT_PICKUP);
  return methods;
}

/** Buyer-selectable fulfillment methods for a cart line based on listing modes. */
export function getCartItemAvailableFulfillmentMethods(item) {
  if (!item || typeof item !== "object") return [];
  return buildAvailableFulfillmentMethods(item);
}

/** True when buyer must choose among multiple fulfillment methods. */
export function cartItemNeedsFulfillmentChoice(item) {
  return getCartItemAvailableFulfillmentMethods(item).length > 1;
}

/** Listing has a delivery option configured (even if buyer chose pickup or virtual). */
function cartItemHasConfiguredDeliveryOption(item) {
  if (!item || typeof item !== "object") return false;
  if (item.itemType === "expertise") {
    const { delivered } = parseListingModeFlags(item);
    if (delivered) return true;
    return isOfferingShippingConfigured(item);
  }
  return listingDeliveredFulfillmentAllowed(item) || parseListingModeFlags(item).delivered;
}

/** Fixed per-unit delivery charge from listing/offering config (pass-through; not order-level allocation). */
export function getCartItemFixedShippingPerUnit(item) {
  if (!item || typeof item !== "object") return null;
  const shipping = parseBsShipping(getCartItemShippingCarrier(item));
  if (shipping !== BS_SHIPPING_BUYER_FIXED) return null;
  const carrier = getCartItemShippingCarrier(item);
  const raw = carrier.bs_shipping_amount ?? carrier.bs_fixed_shipping_amount;
  let unitAmount = parseBsShippingAmount(raw);
  if (unitAmount == null && (raw === 0 || raw === "0" || raw === "0.00")) unitAmount = 0;
  if (unitAmount == null) return null;
  return unitAmount;
}

function buyerShippingChargeForMethod(item, method) {
  if (!item || typeof item !== "object" || skipsShippingForMethod(method)) return null;

  const shipping = parseBsShipping(getCartItemShippingCarrier(item));
  const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);

  if (shipping === BS_SHIPPING_BUYER_FIXED) {
    const unitAmount = getCartItemFixedShippingPerUnit(item) ?? 0;
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

function buildDeliveryDisplay(item, method, charge) {
  if (charge?.type === "fixed") {
    return { showRow: true, amount: charge.amount, isActual: false, waived: false };
  }
  if (charge?.type === "actual") {
    return { showRow: true, amount: 0, isActual: true, waived: false };
  }
  if (cartItemHasConfiguredDeliveryOption(item) && skipsShippingForMethod(method)) {
    return { showRow: true, amount: 0, isActual: false, waived: true };
  }
  return { showRow: false, amount: 0, isActual: false, waived: false };
}

function pickDefaultFulfillmentMethod(item, available) {
  if (available.includes(FULFILLMENT_SHIP)) {
    const charge = buyerShippingChargeForMethod(item, FULFILLMENT_SHIP);
    const lineShipping = charge?.type === "fixed" ? charge.amount : 0;
    if (lineShipping > 0 || (available.includes(FULFILLMENT_PICKUP) && !available.includes(FULFILLMENT_VIRTUAL))) {
      return FULFILLMENT_SHIP;
    }
  }
  return available[0] || FULFILLMENT_PICKUP;
}

const EMPTY_CART_LINE = {
  fulfillment_method: FULFILLMENT_PICKUP,
  availableMethods: [],
  needsChoice: false,
  buyerShippingCharge: null,
  lineShippingAmount: 0,
  deliveryDisplay: { showRow: false, amount: 0, isActual: false, waived: false },
  skipsShippingCharge: true,
  requiresShippingAddress: false,
};

export function resolveCartLine(item) {
  if (!item || typeof item !== "object") return { ...EMPTY_CART_LINE };

  const availableMethods = getCartItemAvailableFulfillmentMethods(item);
  if (!availableMethods.length) return { ...EMPTY_CART_LINE };

  const existing = normalizeFulfillmentMethodValue(item.fulfillment_method);
  const fulfillment_method = existing && availableMethods.includes(existing) ? existing : pickDefaultFulfillmentMethod(item, availableMethods);

  const buyerShippingCharge = buyerShippingChargeForMethod(item, fulfillment_method);
  const lineShippingAmount = buyerShippingCharge?.type === "fixed" ? buyerShippingCharge.amount : 0;
  const skipsShippingCharge = skipsShippingForMethod(fulfillment_method);
  const deliveryDisplay = buildDeliveryDisplay(item, fulfillment_method, buyerShippingCharge);

  return {
    fulfillment_method,
    availableMethods,
    needsChoice: availableMethods.length > 1,
    buyerShippingCharge,
    lineShippingAmount,
    deliveryDisplay,
    skipsShippingCharge,
    requiresShippingAddress: fulfillment_method === FULFILLMENT_SHIP,
  };
}

function fulfillmentMethodOf(item) {
  return resolveCartLine(item).fulfillment_method;
}

export function resolveDefaultFulfillmentMethod(item) {
  return fulfillmentMethodOf(item);
}

function normalizeBusinessCartItemShipping(item) {
  if (!item || typeof item !== "object" || item.itemType === "expertise") return item;
  return { ...item, ...applyBsShippingFromApi(item) };
}

export function normalizeCartItemFulfillment(item) {
  if (!item || typeof item !== "object") return item;
  const normalized = normalizeBusinessCartItemShipping(item);
  const { fulfillment_method } = resolveCartLine(normalized);
  return fulfillment_method === normalized.fulfillment_method ? normalized : { ...normalized, fulfillment_method };
}

export function normalizeCartItemsFulfillment(items) {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeCartItemFulfillment);
}

export function isCartItemShipFulfillment(item) {
  return fulfillmentMethodOf(item) === FULFILLMENT_SHIP;
}

export function isCartItemVirtualFulfillment(item) {
  return fulfillmentMethodOf(item) === FULFILLMENT_VIRTUAL;
}

export function isCartItemPickupFulfillment(item) {
  return fulfillmentMethodOf(item) === FULFILLMENT_PICKUP;
}

export function cartItemRequiresShippingAddress(item) {
  return fulfillmentMethodOf(item) === FULFILLMENT_SHIP;
}

export function cartItemSkipsShippingCharge(item) {
  return skipsShippingForMethod(fulfillmentMethodOf(item));
}

export function isCartItemBuyerPaysShipping(item) {
  if (!item || typeof item !== "object" || cartItemSkipsShippingCharge(item)) return false;
  return isBuyerPaysShippingValue(getCartItemShippingCarrier(item));
}

export function getCartItemBuyerShippingCharge(item) {
  if (!item || typeof item !== "object") return null;
  return resolveCartLine(item).buyerShippingCharge;
}

export function getCartItemDeliveryChargeDisplay(item) {
  if (!item || typeof item !== "object") {
    return { showRow: false, amount: 0, isActual: false, waived: false };
  }
  return resolveCartLine(item).deliveryDisplay;
}

export function getCartItemLineShippingAmount(item) {
  if (!item || typeof item !== "object") return 0;
  return resolveCartLine(item).lineShippingAmount;
}

export function sumBuyerShippingCharges(items) {
  if (!Array.isArray(items)) {
    return { shippingSubtotal: 0, hasFixedShipping: false, hasActualShipping: false, hasWaivedDeliveryCharge: false };
  }

  let total = 0;
  let hasFixedShipping = false;
  let hasActualShipping = false;
  let hasWaivedDeliveryCharge = false;

  for (const item of items) {
    const line = resolveCartLine(item);
    if (line.deliveryDisplay.waived) hasWaivedDeliveryCharge = true;
    const charge = line.buyerShippingCharge;
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
    hasWaivedDeliveryCharge,
  };
}

export function buildFulfillmentApiFields(item) {
  const line = resolveCartLine(item);
  const qty = Math.max(1, parseInt(item?.quantity, 10) || 1);

  // Pickup / virtual: persist explicit $0 snapshots (missing ≠ 0 on account-screen / returns).
  let fields;
  if (line.skipsShippingCharge) {
    fields = {
      fulfillment_method: line.fulfillment_method,
      line_shipping_amount: 0,
      ti_line_shipping_amount: 0,
      ti_shipping_amount_per_unit: 0,
      ti_shipping_amount: 0,
      shipping_not_required: 1,
    };
  } else {
    const perUnitShipping = getCartItemFixedShippingPerUnit(item);
    fields = {
      fulfillment_method: line.fulfillment_method,
      line_shipping_amount: perUnitShipping != null ? Math.round(perUnitShipping * qty * 100) / 100 : line.lineShippingAmount,
    };
    if (perUnitShipping != null) {
      fields.ti_shipping_amount_per_unit = perUnitShipping;
      fields.ti_shipping_amount = perUnitShipping;
    }
    if (fields.line_shipping_amount != null && fields.line_shipping_amount !== "") {
      fields.ti_line_shipping_amount = fields.line_shipping_amount;
    }
  }

  const modeStr = getListingModeString(item);
  if (item?.itemType === "expertise") {
    if (modeStr) fields.profile_expertise_mode = modeStr;
  } else if (modeStr) {
    fields.bs_mode = modeStr;
  }

  return fields;
}

/** Fulfillment + per-line tax snapshots for POST /api/v1/transactions (single spread at checkout). */
export function buildCheckoutApiLineFields(item) {
  return {
    ...buildFulfillmentApiFields(item),
    ...buildCheckoutLineTaxApiFields(item),
  };
}

export function formatCartPickupLocationHint(item) {
  if (!item || typeof item !== "object") return null;

  const street = item.itemType === "expertise" ? String(item.profile_expertise_location || "").trim() : String(item.business_location || "").trim();
  const city = item.itemType === "expertise" ? String(item.profile_expertise_city || "").trim() : String(item.business_city || "").trim();
  const state = item.itemType === "expertise" ? String(item.profile_expertise_state || "").trim() : String(item.business_state || "").trim();
  const zip = item.itemType === "expertise" ? String(item.profile_expertise_zip || "").trim() : String(item.business_zip || "").trim();

  const cityStateZip = [city, state, zip].filter(Boolean).join(", ");
  if (street && cityStateZip) return `${street}, ${cityStateZip}`;
  if (street && city && state) return `${street}, ${city}, ${state}`;
  if (street && city) return `${street}, ${city}`;
  if (street) return street;
  if (cityStateZip) return cityStateZip;
  if (city) return city;
  if (state) return state;
  return null;
}

/** @deprecated Use listingDeliveredFulfillmentAllowed */
export function isOfferingDeliveryAllowed(item) {
  if (!item || item.itemType !== "expertise") return false;
  return listingDeliveredFulfillmentAllowed(item);
}
