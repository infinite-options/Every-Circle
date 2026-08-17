import { parseExpertiseModeFlags } from "./expertiseMode";
import { parsePrice } from "./priceUtils";
import {
  BS_SHIPPING_BUYER_ACTUAL,
  BS_SHIPPING_FREE,
} from "./businessServiceShipping";
import {
  getSeekingFixedShippingPerUnit,
  isBuyerPaysSeekingShipping,
  isFixedSeekingShipping,
  normSeekingShippingRefundable,
  parseSeekingShipping,
  SEEKING_DELIVERY_CHARGE_LABEL,
} from "./profileSeekingShipping";

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function parseSeekingBountyRawAmount(wishData) {
  const raw = String(wishData?.bounty ?? wishData?.amount ?? wishData?.profile_wish_bounty ?? "").trim();
  if (!raw || raw.toLowerCase() === "free") return 0;
  const cleaned = raw.replace(/^\$/, "").trim();
  if (!cleaned) return 0;
  if (cleaned.toLowerCase().endsWith("total")) {
    return parsePrice(cleaned.replace(/\s*total$/i, ""));
  }
  const slashIdx = cleaned.indexOf("/");
  const amountStr = slashIdx >= 0 ? cleaned.slice(0, slashIdx).trim() : cleaned;
  return parsePrice(amountStr);
}

/** Listing bounty type: none | per_item | total. Missing type with a bounty amount follows BE (per_item). */
export function getSeekingBountyType(wishData) {
  const raw = String(wishData?.profile_wish_bounty_type ?? wishData?.bounty_type ?? "")
    .trim()
    .toLowerCase();
  if (raw === "total" || raw === "single") return "total";
  if (raw === "none" || raw === "no" || raw === "no_bounty") return "none";
  if (raw === "per_item" || raw === "per_unit" || raw === "each") return "per_item";
  return parseSeekingBountyRawAmount(wishData) > 0 ? "per_item" : "none";
}

export function parseSeekingBountyUnitAmount(wishData) {
  if (getSeekingBountyType(wishData) === "none") return 0;
  const n = parseSeekingBountyRawAmount(wishData);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Buyer-paid bounty for this quantity (per_item × qty, or a single total). */
export function getSeekingBountyLineTotal(wishData, quantity = 1) {
  const type = getSeekingBountyType(wishData);
  const unit = parseSeekingBountyUnitAmount(wishData);
  if (type === "none" || unit <= 0) return 0;
  if (type === "total") return roundMoney(unit);
  const qty = Math.max(1, Number(quantity) || 1);
  return roundMoney(unit * qty);
}

/**
 * POST item bounty fields. `bounty` is the listing unit (or single total);
 * BE multiplies per_item by quantity for paid-total and payout.
 */
export function getSeekingBountyApiFields(wishData, quantity = 1) {
  const type = getSeekingBountyType(wishData);
  const unitAmount = parseSeekingBountyUnitAmount(wishData);
  const lineTotal = getSeekingBountyLineTotal(wishData, quantity);
  if (type === "none" || unitAmount <= 0) {
    return { bounty: 0, bounty_type: "total", unitAmount: 0, lineTotal: 0 };
  }
  if (type === "total") {
    return { bounty: unitAmount, bounty_type: "total", unitAmount, lineTotal };
  }
  return { bounty: unitAmount, bounty_type: "per_item", unitAmount, lineTotal };
}

/**
 * Resolve checkout fulfillment_method from profile_wish_mode.
 * Prefer virtual → pickup → ship (no extra UI on accept today).
 */
export function resolveSeekingFulfillmentMethod(wishData) {
  const flags = parseExpertiseModeFlags(wishData?.profile_wish_mode);
  const active = [flags.virtual, flags.inPerson, flags.delivered].filter(Boolean).length;
  if (active === 0) return "virtual";
  if (active === 1) {
    if (flags.delivered) return "ship";
    if (flags.inPerson) return "pickup";
    return "virtual";
  }
  if (flags.virtual) return "virtual";
  if (flags.inPerson) return "pickup";
  return "ship";
}

function skipsShippingForMethod(method) {
  return method === "pickup" || method === "virtual";
}

/**
 * Buyer-paid delivery for seeking accept.
 * Buyer Fixed is charged per unit × quantity. Free/actual are $0 at checkout.
 * Pickup/virtual skip the charge (BE requires line_shipping_amount 0).
 */
export function getSeekingCheckoutShippingCharge(wishData, quantity = 1) {
  const qty = Math.max(1, Number(quantity) || 1);
  const fulfillment_method = resolveSeekingFulfillmentMethod(wishData);
  const buyerPays = isBuyerPaysSeekingShipping(wishData);
  const refundable = buyerPays ? normSeekingShippingRefundable(wishData) : 0;

  if (skipsShippingForMethod(fulfillment_method)) {
    return {
      fulfillment_method,
      perUnit: 0,
      lineAmount: 0,
      refundable: 0,
      skipsShipping: true,
      type: null,
      label: SEEKING_DELIVERY_CHARGE_LABEL,
    };
  }

  if (isFixedSeekingShipping(wishData)) {
    const perUnit = getSeekingFixedShippingPerUnit(wishData) ?? 0;
    return {
      fulfillment_method,
      perUnit,
      lineAmount: roundMoney(perUnit * qty),
      refundable,
      skipsShipping: false,
      type: "fixed",
      label: SEEKING_DELIVERY_CHARGE_LABEL,
    };
  }

  const shipping = parseSeekingShipping(wishData);
  if (shipping === BS_SHIPPING_BUYER_ACTUAL) {
    return {
      fulfillment_method,
      perUnit: 0,
      lineAmount: 0,
      refundable,
      skipsShipping: false,
      type: "actual",
      label: SEEKING_DELIVERY_CHARGE_LABEL,
    };
  }
  if (shipping === BS_SHIPPING_FREE) {
    return {
      fulfillment_method,
      perUnit: 0,
      lineAmount: 0,
      refundable: 0,
      skipsShipping: false,
      type: "free",
      label: SEEKING_DELIVERY_CHARGE_LABEL,
    };
  }

  return {
    fulfillment_method,
    perUnit: 0,
    lineAmount: 0,
    refundable: 0,
    skipsShipping: false,
    type: null,
    label: SEEKING_DELIVERY_CHARGE_LABEL,
  };
}

/** Shipping address from seeking delivery fields (buyer is the seeker). */
export function buildSeekingShippingAddressPayload(wishData, buyerProfile = {}) {
  const address_line_1 = String(wishData?.profile_wish_location || "").trim();
  const city = String(wishData?.profile_wish_city || "").trim();
  const state = String(wishData?.profile_wish_state || "").trim();
  const zip = String(wishData?.profile_wish_zip || "").trim();
  if (!address_line_1 || !city || !state || !zip) return null;

  const first_name = String(buyerProfile.firstName || buyerProfile.profile_personal_first_name || "").trim();
  const last_name = String(buyerProfile.lastName || buyerProfile.profile_personal_last_name || "").trim();
  if (!first_name || !last_name) return null;

  return {
    first_name,
    last_name,
    address_line_1,
    city,
    state,
    zip,
  };
}

/**
 * Per-line tax + fulfillment snapshots for POST /api/v1/transactions on seeking accept.
 *
 * Seeking (unlike offering/product): buyer pays listing cost + bounty.
 * - unit_price / total_costs = listing rate only (no bounty)
 * - item.bounty stays separate; BE adds it into total_amount_paid validation
 * - Buyer Fixed delivery is per-unit × qty (seeker pays)
 * Tax is not collected on accept yet — ti_tax_rate 0 keeps BE expected tax at 0.
 */
export function buildSeekingCheckoutLineApiFields({
  wishData,
  quantity = 1,
  unitPrice = 0,
  buyerProfile = {},
}) {
  const qty = Math.max(1, Number(quantity) || 1);
  const unit = roundMoney(parsePrice(unitPrice));
  const charge = getSeekingCheckoutShippingCharge(wishData, qty);
  const fulfillment_method = charge.fulfillment_method;
  const isNoShip = charge.skipsShipping;

  const line = {
    unit_price: unit,
    line_tax_amount: 0,
    ti_line_tax_amount: 0,
    ti_tax_rate: 0,
    ti_bs_tax_rate: 0,
    fulfillment_method,
    line_shipping_amount: charge.lineAmount,
    ti_line_shipping_amount: charge.lineAmount,
    ti_shipping_amount_per_unit: isNoShip ? 0 : charge.perUnit,
    ti_shipping_amount: isNoShip ? 0 : charge.perUnit,
    shipping_refundable: charge.refundable,
    ti_shipping_refundable: charge.refundable,
  };

  if (isNoShip) {
    line.shipping_not_required = 1;
  }

  const shipping_address = fulfillment_method === "ship" ? buildSeekingShippingAddressPayload(wishData, buyerProfile) : null;

  return {
    lineFields: line,
    shipping_address,
    total_shipping: charge.lineAmount,
    total_taxes: 0,
  };
}

/** Order money fields for seeking accept (merchandise excludes bounty). */
export function buildSeekingCheckoutOrderMoney({
  unitCost = 0,
  quantity = 1,
  costAmount = null,
  bountyAmount = 0,
  processingFee = 0,
  totalTaxes = 0,
  totalShipping = 0,
}) {
  const qty = Math.max(1, Number(quantity) || 1);
  const unit = roundMoney(parsePrice(unitCost));
  const merchandise =
    costAmount != null && costAmount !== ""
      ? roundMoney(parsePrice(costAmount))
      : roundMoney(unit * qty);
  const bounty = roundMoney(parsePrice(bountyAmount));
  const fees = roundMoney(parsePrice(processingFee));
  const taxes = roundMoney(parsePrice(totalTaxes));
  const shipping = roundMoney(parsePrice(totalShipping));
  return {
    unit_price: unit,
    total_costs: merchandise,
    bounty,
    total_taxes: taxes,
    total_shipping: shipping,
    total_fees: fees,
    // BE: paid = costs + taxes + shipping + fees + seeking bounty
    total_amount_paid: roundMoney(merchandise + taxes + shipping + fees + bounty),
  };
}
