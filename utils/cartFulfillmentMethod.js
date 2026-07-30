import { parseExpertiseModeFlags } from "./expertiseMode";
import { isBusinessShippingApplicable, getCartItemLineShippingAmount } from "./businessServiceShipping";

export const FULFILLMENT_SHIP = "ship";
export const FULFILLMENT_PICKUP = "pickup";

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

/** True when buyer must choose ship vs pickup (Virtual + In-Person offering). */
export function cartItemNeedsFulfillmentChoice(item) {
  if (!item || item.itemType !== "expertise") return false;
  const { virtual, inPerson } = parseExpertiseModeFlags(item.profile_expertise_mode);
  return virtual && inPerson;
}

/** Resolve effective fulfillment method for a cart line. */
export function resolveDefaultFulfillmentMethod(item) {
  if (!item || typeof item !== "object") return FULFILLMENT_SHIP;
  const existing = String(item.fulfillment_method || "")
    .trim()
    .toLowerCase();
  if (existing === FULFILLMENT_SHIP || existing === FULFILLMENT_PICKUP) return existing;

  if (item.itemType === "expertise") {
    const { virtual, inPerson } = parseExpertiseModeFlags(item.profile_expertise_mode);
    if (virtual && inPerson) return FULFILLMENT_SHIP;
    if (virtual && !inPerson) return FULFILLMENT_SHIP;
    if (!virtual && inPerson) return FULFILLMENT_PICKUP;
    return isOfferingShippingApplicable(item) ? FULFILLMENT_SHIP : FULFILLMENT_PICKUP;
  }
  return isBusinessShippingApplicable(item) ? FULFILLMENT_SHIP : FULFILLMENT_PICKUP;
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

/** True when this line requires a ship-to address at checkout. */
export function cartItemRequiresShippingAddress(item) {
  return isCartItemShipFulfillment(item);
}

/** Fields for POST /api/v1/transactions items[]. */
export function buildFulfillmentApiFields(item) {
  const fulfillment_method = resolveDefaultFulfillmentMethod(item);
  const line_shipping_amount = getCartItemLineShippingAmount(item);
  const fields = {
    fulfillment_method,
    line_shipping_amount,
  };
  if (fulfillment_method === FULFILLMENT_PICKUP) {
    fields.shipping_not_required = 1;
  }
  return fields;
}

/** Pickup location hint for offerings (city/state from listing). */
export function formatCartPickupLocationHint(item) {
  if (!item || item.itemType !== "expertise") return null;
  const city = String(item.profile_expertise_city || "").trim();
  const state = String(item.profile_expertise_state || "").trim();
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return null;
}
