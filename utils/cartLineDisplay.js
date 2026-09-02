import { getOfferingAttributeBadges, getOfferingCardLayout } from "./offeringDisplayLines";
import { isCartItemReturnable } from "./offeringCartUtils";
import {
  BS_SHIPPING_BUYER_ACTUAL,
  BS_SHIPPING_BUYER_FIXED,
  BS_SHIPPING_FREE,
  isBusinessShippingApplicable,
  isBuyerPaysShippingValue,
  parseBsShipping,
  parseBsShippingAmount,
} from "./businessServiceShipping";
import { normServiceShippingRefundable } from "./buildBusinessServiceForApi";
import { businessDeliveredModeSelected } from "./listingFulfillmentMode";
import { OFFERING_DELIVERY_CHARGE_LABEL, OFFERING_DELIVERY_OPTION_CARD_LABEL } from "./profileOfferingShipping";
import { parsePrice } from "./priceUtils";
import {
  FULFILLMENT_PICKUP,
  FULFILLMENT_SHIP,
  FULFILLMENT_VIRTUAL,
  formatCartPickupLocationHint,
  getCartItemAvailableFulfillmentMethods,
  resolveDefaultFulfillmentMethod,
} from "./cartFulfillmentMethod";

function isTruthyFlag(value) {
  return value === true || value === 1 || value === "1" || (typeof value === "string" && ["true", "yes"].includes(value.trim().toLowerCase()));
}

function formatBusinessTaxBadgeValue(item) {
  if (!isTruthyFlag(item.bs_is_taxable)) return null;
  const n = parsePrice(item.bs_tax_rate != null ? item.bs_tax_rate : 0);
  if (!Number.isFinite(n)) return null;
  const pct = n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2).replace(/\.?0+$/, "");
  return `${pct}%`;
}

function formatBusinessShipBadgeValue(item) {
  if (!businessDeliveredModeSelected(item)) return null;
  if (!isBusinessShippingApplicable(item)) return null;
  const shipping = parseBsShipping(item);
  if (shipping === BS_SHIPPING_FREE) return "Free";
  if (shipping === BS_SHIPPING_BUYER_ACTUAL) return "Buyer pays (actual)";
  if (shipping === BS_SHIPPING_BUYER_FIXED) {
    const amount = parseBsShippingAmount(item?.bs_shipping_amount ?? item?.bs_fixed_shipping_amount);
    if (amount == null && (item?.bs_shipping_amount === 0 || item?.bs_shipping_amount === "0")) {
      return "Buyer pays $0.00";
    }
    if (amount == null) return "Buyer pays (fixed)";
    return `Buyer pays $${Number(amount).toFixed(2)}`;
  }
  return null;
}

function formatBusinessReturnableBadgeValue(item) {
  if (!isCartItemReturnable(item)) return "No";
  const days = String(item.bs_return_window_days ?? item.return_window_days ?? "").trim();
  const daysLabel = days && days !== "0" ? days : "5";
  if (isBuyerPaysShippingValue(item) && normServiceShippingRefundable(item) !== 1) {
    return `Yes, ${daysLabel}d   (${OFFERING_DELIVERY_CHARGE_LABEL} not refundable)`;
  }
  return `Yes, ${daysLabel}d`;
}

function getBusinessCartLineAttributeBadges(item) {
  const badges = [];
  const tax = formatBusinessTaxBadgeValue(item);
  if (tax) badges.push({ key: "tax", label: "Tax", value: tax });
  const ship = formatBusinessShipBadgeValue(item);
  if (ship) badges.push({ key: "ship", label: OFFERING_DELIVERY_OPTION_CARD_LABEL, value: ship });
  badges.push({ key: "returnable", label: "Returnable", value: formatBusinessReturnableBadgeValue(item) });
  return badges;
}

/** Attribute pill badges — same labels/values as ProductCard / OfferingCardDetails. */
export function getCartLineAttributeBadges(item) {
  if (!item || typeof item !== "object") return [];
  if (item.itemType === "expertise") return getOfferingAttributeBadges(item);
  return getBusinessCartLineAttributeBadges(item);
}

/** Optional seller-written refund policy line (offerings / business products). */
export function getCartLineRefundPolicyLine(item) {
  if (!item || typeof item !== "object") return null;
  if (item.itemType === "expertise") {
    return getOfferingCardLayout(item).refundPolicyLine || null;
  }
  const policy = String(item.bs_refund_policy ?? "").trim();
  return policy || null;
}

const FULFILLMENT_METHOD_LABELS = {
  [FULFILLMENT_VIRTUAL]: "Virtual",
  [FULFILLMENT_SHIP]: "Delivery",
  [FULFILLMENT_PICKUP]: "In person",
};

const FULFILLMENT_METHOD_ICONS = {
  [FULFILLMENT_VIRTUAL]: "videocam-outline",
  [FULFILLMENT_SHIP]: "car-outline",
  [FULFILLMENT_PICKUP]: "people-outline",
};

/** Selected fulfillment method + helper detail for a cart line. */
export function getCartLineFulfillmentSummary(item) {
  if (!item || typeof item !== "object") {
    return { method: "", selectedLabel: "", detail: null, available: [], needsChoice: false, options: [] };
  }

  const method = resolveDefaultFulfillmentMethod(item);
  const available = getCartItemAvailableFulfillmentMethods(item);
  const pickupHint = formatCartPickupLocationHint(item);
  const options = [FULFILLMENT_VIRTUAL, FULFILLMENT_SHIP, FULFILLMENT_PICKUP]
    .filter((key) => available.includes(key))
    .map((key) => ({
      key,
      label: FULFILLMENT_METHOD_LABELS[key],
      icon: FULFILLMENT_METHOD_ICONS[key],
    }));

  let detail = null;
  if (method === FULFILLMENT_VIRTUAL) {
    detail = "No shipping required";
  } else if (method === FULFILLMENT_PICKUP) {
    detail = pickupHint ? `Pickup · ${pickupHint}` : "Pickup in person";
  } else if (method === FULFILLMENT_SHIP) {
    detail = "Delivery address required at checkout";
  }

  return {
    method,
    selectedLabel: FULFILLMENT_METHOD_LABELS[method] || method,
    detail,
    available,
    needsChoice: options.length > 1,
    options,
  };
}

/** Referrer bounty timing copy for cart lines. */
export function getCartLineBountyAvailabilityNote(item) {
  if (isCartItemReturnable(item)) {
    return "Available after the return window closes";
  }
  return "Available after the buyer confirms receipt";
}
