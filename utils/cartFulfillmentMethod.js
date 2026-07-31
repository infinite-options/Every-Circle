import { parseExpertiseModeFlags } from "./expertiseMode";
import { isBusinessShippingApplicable, getCartItemLineShippingAmount } from "./businessServiceShipping";

export const FULFILLMENT_VIRTUAL = "virtual";
export const FULFILLMENT_SHIP = "ship";
export const FULFILLMENT_PICKUP = "pickup";

const ALL_FULFILLMENT_METHODS = [FULFILLMENT_VIRTUAL, FULFILLMENT_SHIP, FULFILLMENT_PICKUP];

function isOfferingShippingApplicable(item) {
  return (
    item?.profile_expertise_free_shipping === 1 ||
    item?.profile_expertise_free_shipping === "1" ||
    item?.profile_expertise_free_shipping === true ||
    item?.profile_expertise_buyer_pays_shipping === 1 ||
    item?.profile_expertise_buyer_pays_shipping === "1" ||
    item?.profile_expertise_buyer_pays_shipping === true
  );
}

function normalizeFulfillmentMethodValue(value) {
  const method = String(value || "")
    .trim()
    .toLowerCase();
  return ALL_FULFILLMENT_METHODS.includes(method) ? method : "";
}

/** Buyer-selectable fulfillment methods for a cart line based on offering modes. */
export function getCartItemAvailableFulfillmentMethods(item) {
  if (!item || typeof item !== "object") return [FULFILLMENT_SHIP];

  if (item.itemType !== "expertise") {
    return isBusinessShippingApplicable(item) ? [FULFILLMENT_SHIP] : [FULFILLMENT_PICKUP];
  }

  const { virtual, delivered, inPerson } = parseExpertiseModeFlags(item.profile_expertise_mode);
  const methods = [];
  if (virtual) methods.push(FULFILLMENT_VIRTUAL);
  if (delivered) methods.push(FULFILLMENT_SHIP);
  if (inPerson) methods.push(FULFILLMENT_PICKUP);

  if (methods.length > 0) return methods;

  // Legacy rows with no recognized mode: infer from shipping flags when possible.
  if (isOfferingShippingApplicable(item)) return [FULFILLMENT_SHIP];
  return [FULFILLMENT_VIRTUAL];
}

/** True when buyer must choose among multiple fulfillment methods. */
export function cartItemNeedsFulfillmentChoice(item) {
  return getCartItemAvailableFulfillmentMethods(item).length > 1;
}

/** Resolve effective fulfillment method for a cart line. */
export function resolveDefaultFulfillmentMethod(item) {
  if (!item || typeof item !== "object") return FULFILLMENT_SHIP;

  const available = getCartItemAvailableFulfillmentMethods(item);
  const existing = normalizeFulfillmentMethodValue(item.fulfillment_method);
  if (existing && available.includes(existing)) return existing;
  return available[0] || FULFILLMENT_SHIP;
}

/** Ensure cart line has fulfillment_method set. */
export function normalizeCartItemFulfillment(item) {
  if (!item || typeof item !== "object") return item;
  const fulfillment_method = resolveDefaultFulfillmentMethod(item);
  return fulfillment_method === item.fulfillment_method ? item : { ...item, fulfillment_method };
}

export function normalizeCartItemsFulfillment(items) {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeCartItemFulfillment);
}

export function isCartItemShipFulfillment(item) {
  return resolveDefaultFulfillmentMethod(item) === FULFILLMENT_SHIP;
}

export function isCartItemVirtualFulfillment(item) {
  return resolveDefaultFulfillmentMethod(item) === FULFILLMENT_VIRTUAL;
}

export function isCartItemPickupFulfillment(item) {
  return resolveDefaultFulfillmentMethod(item) === FULFILLMENT_PICKUP;
}

/** True when this line requires a ship-to address at checkout (Delivery mode). */
export function cartItemRequiresShippingAddress(item) {
  return isCartItemShipFulfillment(item);
}

/** True when shipping charges should be skipped for this cart line. */
export function cartItemSkipsShippingCharge(item) {
  const method = resolveDefaultFulfillmentMethod(item);
  return method === FULFILLMENT_PICKUP || method === FULFILLMENT_VIRTUAL;
}

/** Fields for POST /api/v1/transactions items[]. */
export function buildFulfillmentApiFields(item) {
  const fulfillment_method = resolveDefaultFulfillmentMethod(item);
  const line_shipping_amount = getCartItemLineShippingAmount(item);
  const fields = {
    fulfillment_method,
    line_shipping_amount,
  };
  if (fulfillment_method === FULFILLMENT_PICKUP || fulfillment_method === FULFILLMENT_VIRTUAL) {
    fields.shipping_not_required = 1;
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
