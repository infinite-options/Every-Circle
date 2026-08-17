import { parsePrice } from "./priceUtils";
import {
  BS_SHIPPING_BUYER_ACTUAL,
  BS_SHIPPING_BUYER_FIXED,
  BS_SHIPPING_FREE,
  parseBsShippingAmount,
} from "./businessServiceShipping";
import {
  isBuyerPaysSeekingShipping,
  normSeekingShippingRefundable,
  parseSeekingShipping,
  SEEKING_DELIVERY_CHARGE_LABEL,
  SEEKING_DELIVERY_OPTION_CARD_LABEL,
} from "./profileSeekingShipping";

function isTruthyFlag(v) {
  return v === 1 || v === "1" || v === true;
}

function getSeekingTaxSubtext(seeking) {
  if (!isTruthyFlag(seeking?.profile_wish_is_taxable)) return null;
  const rateStr = String(seeking?.profile_wish_tax_rate ?? "").trim();
  if (rateStr) {
    const n = parsePrice(rateStr);
    if (Number.isFinite(n) && n > 0) {
      const pct = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
      return `plus ${pct}% sales tax`;
    }
  }
  return "plus sales tax";
}

function getSeekingTaxBadgeValue(seeking) {
  if (!isTruthyFlag(seeking?.profile_wish_is_taxable)) return null;
  const rateStr = String(seeking?.profile_wish_tax_rate ?? "").trim();
  if (rateStr) {
    const n = parsePrice(rateStr);
    if (Number.isFinite(n) && n > 0) {
      const pct = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
      return `${pct}%`;
    }
  }
  return null;
}

function getSeekingShippingValue(seeking) {
  if (!parseSeekingShipping(seeking)) {
    if (isTruthyFlag(seeking?.profile_wish_free_shipping)) return "Free";
    if (isTruthyFlag(seeking?.profile_wish_buyer_pays_shipping)) return "Buyer pays (actual)";
    return null;
  }
  const shipping = parseSeekingShipping(seeking);
  if (shipping === BS_SHIPPING_FREE) return "Free";
  if (shipping === BS_SHIPPING_BUYER_ACTUAL) return "Buyer pays (actual)";
  if (shipping === BS_SHIPPING_BUYER_FIXED) {
    const amount = parseBsShippingAmount(seeking?.profile_wish_shipping_amount);
    if (amount == null && (seeking?.profile_wish_shipping_amount === 0 || seeking?.profile_wish_shipping_amount === "0")) {
      return "Buyer pays $0.00";
    }
    if (amount == null) return "Buyer pays (fixed)";
    return `Buyer pays $${Number(amount).toFixed(2)}`;
  }
  return null;
}

function getSeekingReturnableBadgeValue(seeking) {
  if (!isTruthyFlag(seeking?.profile_wish_is_returnable)) return "No";
  const days = String(seeking?.profile_wish_return_window_days ?? "").trim();
  const daysLabel = days && days !== "0" ? days : "30";
  if (isBuyerPaysSeekingShipping(seeking) && normSeekingShippingRefundable(seeking) !== 1) {
    return `Yes, ${daysLabel}d   (${SEEKING_DELIVERY_CHARGE_LABEL} not refundable)`;
  }
  return `Yes, ${daysLabel}d`;
}

/** Pill badges for Seeking cards — Tax, Delivery option, Returnable (same pattern as Offering). */
export function getSeekingAttributeBadges(seeking) {
  const badges = [];
  const tax = getSeekingTaxBadgeValue(seeking);
  if (tax) badges.push({ key: "tax", label: "Tax", value: tax });
  const ship = getSeekingShippingValue(seeking);
  if (ship) badges.push({ key: "ship", label: SEEKING_DELIVERY_OPTION_CARD_LABEL, value: ship });
  badges.push({ key: "returnable", label: "Returnable", value: getSeekingReturnableBadgeValue(seeking) });
  return badges;
}

function getSeekingRefundPolicyValue(seeking) {
  const policy = String(seeking?.profile_wish_refund_policy ?? "").trim();
  return policy || null;
}

function parseSeekingRateValue(cost) {
  const raw = String(cost ?? "").trim();
  if (!raw || raw === "0" || raw.toLowerCase() === "free") return null;
  if (raw.startsWith("$")) return raw;
  const cleaned = raw.replace(/^\$/, "").trim();
  if (cleaned.toLowerCase().endsWith("total")) {
    const amount = cleaned.replace(/\s*total$/i, "").trim();
    return amount ? `$${amount} total` : null;
  }
  const slashIdx = cleaned.indexOf("/");
  if (slashIdx >= 0) {
    const amount = cleaned.slice(0, slashIdx).trim();
    const unit = cleaned.slice(slashIdx + 1).trim();
    return amount && unit ? `$${amount}/${unit}` : amount ? `$${amount}` : null;
  }
  return `$${cleaned}`;
}

function getSeekingQtyValue(seeking) {
  const qty = seeking?.profile_wish_quantity ?? seeking?.quantity ?? "";
  const raw = String(qty).trim();
  if (!raw || raw === "0") return null;
  return raw;
}

function getSeekingRewardValue(seeking) {
  const raw = String(seeking?.bounty ?? seeking?.amount ?? seeking?.profile_wish_bounty ?? "").trim();
  if (!raw || raw.toLowerCase() === "free") return null;

  const bountyType = String(seeking?.profile_wish_bounty_type ?? "").trim().toLowerCase();
  if (bountyType === "none") return null;

  const cleaned = raw.replace(/^\$/, "").trim();
  if (!cleaned) return null;

  let amount;
  let suffix = "";

  if (cleaned.toLowerCase().endsWith("total")) {
    amount = cleaned.replace(/\s*total$/i, "").trim();
    suffix = " total";
  } else {
    const slashIdx = cleaned.indexOf("/");
    if (slashIdx >= 0) {
      amount = cleaned.slice(0, slashIdx).trim();
      const unit = cleaned.slice(slashIdx + 1).trim();
      if (unit) suffix = `/${unit}`;
    } else {
      amount = cleaned;
    }
  }

  if (!amount || parsePrice(amount) <= 0) return null;

  if (!suffix) {
    if (bountyType === "total") suffix = " total";
    else suffix = "/each";
  }

  return `$${amount}${suffix}`;
}

export function getSeekingLocationLabel(seeking) {
  const location = String(seeking?.profile_wish_location ?? "").trim();
  if (location) return location;
  const city = String(seeking?.profile_wish_city ?? "").trim();
  const state = String(seeking?.profile_wish_state ?? "").trim();
  return [city, state].filter(Boolean).join(", ");
}

/** Metric columns for Seeking cards — Rate, Desired Qty, Bounty (Bounty always shown). */
export function getSeekingMetricColumns(seeking) {
  const cost = seeking?.cost ?? seeking?.profile_wish_cost ?? "";
  const taxSubtext = parseSeekingRateValue(cost) ? getSeekingTaxSubtext(seeking) : null;
  return [
    { label: "Rate", value: parseSeekingRateValue(cost), subtext: taxSubtext || undefined },
    { label: "Desired Qty", value: getSeekingQtyValue(seeking) },
    { label: "Bounty", value: getSeekingRewardValue(seeking) },
  ].filter((col) => col.label === "Bounty" || col.value || (col.label === "Rate" && col.subtext));
}

export function getSeekingCardLayout(seeking) {
  const metrics = getSeekingMetricColumns(seeking);
  const location = getSeekingLocationLabel(seeking);
  const hasSchedule = !!(seeking?.profile_wish_start || seeking?.profile_wish_end);

  const attributeBadges = getSeekingAttributeBadges(seeking);
  const refundPolicyLine = getSeekingRefundPolicyValue(seeking);

  const fulfillmentRows = [
    { label: SEEKING_DELIVERY_OPTION_CARD_LABEL, value: getSeekingShippingValue(seeking) },
    { label: "Tax", value: getSeekingTaxBadgeValue(seeking) },
    { label: "Returnable", value: getSeekingReturnableBadgeValue(seeking) },
    { label: "Refund policy", value: refundPolicyLine },
  ].filter((row) => row.value);

  return {
    metrics,
    whenWhere: {
      hasContent: !!(hasSchedule || location || seeking?.profile_wish_mode),
      start: seeking?.profile_wish_start || "",
      end: seeking?.profile_wish_end || "",
      location,
      mode: seeking?.profile_wish_mode || "",
    },
    attributeBadges,
    refundPolicyLine,
    fulfillmentRows,
  };
}

export function seekingCardHasDetails(layout) {
  return !!(layout.metrics.length || layout.whenWhere.hasContent || layout.attributeBadges?.length || layout.refundPolicyLine);
}
