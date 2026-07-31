import { parseExpertiseModeFlags } from "./expertiseMode";
import {
  BS_SHIPPING_BUYER_ACTUAL,
  BS_SHIPPING_BUYER_FIXED,
  getCartItemShippingCarrier,
  isBusinessShippingApplicable,
  isBuyerPaysShippingValue,
  parseBsShipping,
  parseBsShippingAmount,
} from "./businessServiceShipping";
import { isOfferingShippingConfigured, offeringDeliveredModeSelected } from "./profileOfferingShipping";

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

/** True when the offering listing allows buyer delivery (Delivered mode). */
export function isOfferingDeliveryAllowed(item) {
  if (!item || item.itemType !== "expertise") return false;
  return offeringDeliveredModeSelected(item);
}

/** Buyer-selectable fulfillment methods for a cart line based on offering modes. */
export function getCartItemAvailableFulfillmentMethods(item) {
  if (!item || typeof item !== "object") return [FULFILLMENT_SHIP];

  if (item.itemType !== "expertise") {
    return isBusinessShippingApplicable(item) ? [FULFILLMENT_SHIP] : [FULFILLMENT_PICKUP];
  }

  const { virtual, inPerson } = parseExpertiseModeFlags(item.profile_expertise_mode);
  const delivered = isOfferingDeliveryAllowed(item);
  const methods = [];
  if (virtual) methods.push(FULFILLMENT_VIRTUAL);
  if (delivered) methods.push(FULFILLMENT_SHIP);
  if (inPerson) methods.push(FULFILLMENT_PICKUP);

  if (methods.length > 0) return methods;

  return [FULFILLMENT_VIRTUAL];
}

/** True when buyer must choose among multiple fulfillment methods. */
export function cartItemNeedsFulfillmentChoice(item) {
  return getCartItemAvailableFulfillmentMethods(item).length > 1;
}

/** Listing has a delivery/shipping option (even if buyer chose pickup or virtual). */
function cartItemHasConfiguredDeliveryOption(item) {
  if (!item || typeof item !== "object") return false;
  if (item.itemType === "expertise") {
    const { delivered } = parseExpertiseModeFlags(item.profile_expertise_mode);
    if (delivered) return true;
    return isOfferingShippingConfigured(item);
  }
  return isBusinessShippingApplicable(item);
}

/**
 * Buyer-paid shipping charge for one cart line at a known fulfillment method.
 * Never resolves fulfillment — callers pass the method explicitly.
 */
function buyerShippingChargeForMethod(item, method) {
  if (!item || typeof item !== "object" || skipsShippingForMethod(method)) return null;

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
  if (item.itemType === "expertise" && available.includes(FULFILLMENT_SHIP)) {
    const charge = buyerShippingChargeForMethod(item, FULFILLMENT_SHIP);
    const lineShipping = charge?.type === "fixed" ? charge.amount : 0;
    if (lineShipping > 0 || (available.includes(FULFILLMENT_PICKUP) && !available.includes(FULFILLMENT_VIRTUAL))) {
      return FULFILLMENT_SHIP;
    }
  }
  return available[0] || FULFILLMENT_SHIP;
}

/** Full listing mode string for transaction line snapshot. */
function expertiseModeForTransactionApi(item) {
  if (item?.itemType !== "expertise") return "";
  return String(item.profile_expertise_mode || "").trim();
}

const EMPTY_CART_LINE = {
  fulfillment_method: FULFILLMENT_SHIP,
  availableMethods: [FULFILLMENT_SHIP],
  needsChoice: false,
  buyerShippingCharge: null,
  lineShippingAmount: 0,
  deliveryDisplay: { showRow: false, amount: 0, isActual: false, waived: false },
  skipsShippingCharge: false,
  requiresShippingAddress: true,
};

/**
 * Single pass: available methods, effective fulfillment, and delivery charge for a cart line.
 * All cart fulfillment + delivery helpers should use this (or item.fulfillment_method after normalize).
 */
export function resolveCartLine(item) {
  if (!item || typeof item !== "object") return { ...EMPTY_CART_LINE };

  const availableMethods = getCartItemAvailableFulfillmentMethods(item);
  const existing = normalizeFulfillmentMethodValue(item.fulfillment_method);
  const fulfillment_method =
    existing && availableMethods.includes(existing) ? existing : pickDefaultFulfillmentMethod(item, availableMethods);

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

/** Resolve effective fulfillment method for a cart line. */
export function resolveDefaultFulfillmentMethod(item) {
  return fulfillmentMethodOf(item);
}

/** Ensure cart line has fulfillment_method set. */
export function normalizeCartItemFulfillment(item) {
  if (!item || typeof item !== "object") return item;
  const { fulfillment_method } = resolveCartLine(item);
  return fulfillment_method === item.fulfillment_method ? item : { ...item, fulfillment_method };
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

/** True when this line requires a ship-to address at checkout (Delivery mode). */
export function cartItemRequiresShippingAddress(item) {
  return fulfillmentMethodOf(item) === FULFILLMENT_SHIP;
}

/** True when shipping charges should be skipped for this cart line. */
export function cartItemSkipsShippingCharge(item) {
  return skipsShippingForMethod(fulfillmentMethodOf(item));
}

/** True when a cart line requires the buyer to pay shipping (fixed or actual) and ships. */
export function isCartItemBuyerPaysShipping(item) {
  if (!item || typeof item !== "object" || cartItemSkipsShippingCharge(item)) return false;
  return isBuyerPaysShippingValue(getCartItemShippingCarrier(item));
}

/**
 * Buyer-paid shipping charge for one cart line.
 * @returns {null | { type: 'fixed'|'actual', unitAmount: number, amount: number, quantity: number }}
 */
export function getCartItemBuyerShippingCharge(item) {
  if (!item || typeof item !== "object") return null;
  return resolveCartLine(item).buyerShippingCharge;
}

/** Cart UI: whether to show a delivery/shipping row and at what amount. */
export function getCartItemDeliveryChargeDisplay(item) {
  if (!item || typeof item !== "object") {
    return { showRow: false, amount: 0, isActual: false, waived: false };
  }
  return resolveCartLine(item).deliveryDisplay;
}

/** Charged shipping $ for one line (for transaction POST line_shipping_amount). */
export function getCartItemLineShippingAmount(item) {
  if (!item || typeof item !== "object") return 0;
  return resolveCartLine(item).lineShippingAmount;
}

/** Sum charged buyer shipping (fixed only) across cart lines. */
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

/** Fields for POST /api/v1/transactions items[]. */
export function buildFulfillmentApiFields(item) {
  const line = resolveCartLine(item);
  const fields = {
    fulfillment_method: line.fulfillment_method,
    line_shipping_amount: line.lineShippingAmount,
  };
  if (line.skipsShippingCharge) {
    fields.shipping_not_required = 1;
  }

  if (item?.itemType === "expertise") {
    const mode = expertiseModeForTransactionApi(item);
    if (mode) fields.profile_expertise_mode = mode;
  }

  return fields;
}

/** Pickup location hint for offerings (seller address on the listing). */
export function formatCartPickupLocationHint(item) {
  if (!item || item.itemType !== "expertise") return null;
  const street = String(item.profile_expertise_location || "").trim();
  const city = String(item.profile_expertise_city || "").trim();
  const state = String(item.profile_expertise_state || "").trim();
  const zip = String(item.profile_expertise_zip || "").trim();
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
