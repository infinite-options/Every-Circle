import { parsePrice } from "./priceUtils";
import { expertiseCartTaxFields } from "./cartLineTax";

/** Parse offering cost string into unit value and unit suffix (e.g. "total", "/hr"). */
export function parseOfferingCostParts(costStr) {
  if (!costStr || String(costStr).toLowerCase() === "free") return { value: 0, units: "" };
  const str = String(costStr).replace(/^\$/, "").trim();
  if (str.toLowerCase().endsWith("total")) {
    const amount = str.replace(/total$/i, "").trim();
    return { value: parseFloat(amount) || 0, units: "total" };
  }
  const match = str.match(/^([\d.]+)\s*(\/[\w\s]+)?$/i) || str.match(/^([\d.]+)/);
  if (!match) return { value: 0, units: "" };
  const value = parseFloat(match[1]) || 0;
  const units = (match[2] || "").trim().toLowerCase();
  return { value, units };
}

export function isOfferingCostTotalUnit(costStr) {
  return parseOfferingCostParts(costStr).units === "total";
}

/** Pretax line total for an offering cart line (unit price × quantity). */
export function getOfferingLinePretax(costStr, qty) {
  const { value } = parseOfferingCostParts(costStr);
  const q = parseInt(qty, 10) || 1;
  return value * q;
}

/** Label suffix for the quantity picker (e.g. "number of hrs"). */
export function getOfferingQuantityLabelSuffix(costStr) {
  const { units } = parseOfferingCostParts(costStr);
  if (!units || units === "total") return "number of items";
  const u = units.replace(/^\//, "").toLowerCase();
  if (u === "each") return "number of items";
  if (u === "hr") return "number of hrs";
  if (u === "day") return "number of days";
  if (u === "week") return "number of weeks";
  if (u === "month") return "number of months";
  if (u === "quarter") return "number of quarters";
  if (u === "year") return "number of years";
  return units;
}

/** Cost breakdown label in Add to Cart / cart summaries. */
export function formatOfferingCostLineLabel(qty, costStr) {
  const { value, units } = parseOfferingCostParts(costStr);
  const unitSuffix = !units || units === "total" ? " each" : units;
  const q = parseInt(qty, 10) || 1;
  if (q <= 1) return `Cost ($${value.toFixed(2)}${unitSuffix})`;
  return `Cost (${q} × $${value.toFixed(2)}${unitSuffix})`;
}

/** Unit price display for cart line (e.g. "$300.00 each" or "$50.00/hr"). */
export function formatOfferingUnitPriceLabel(costStr) {
  const { value, units } = parseOfferingCostParts(costStr);
  if (!units || units === "total") return `$${value.toFixed(2)} each`;
  return `$${value.toFixed(2)}${units}`;
}

export function getOfferingBountyType(offering) {
  return String(offering?.profile_expertise_bounty_type ?? offering?.bounty_type ?? "none")
    .trim()
    .toLowerCase();
}

/** Dollar amount configured on the offering (ignores bounty type). */
export function parseOfferingBountyAmount(offering) {
  const bountyType = getOfferingBountyType(offering);
  if (bountyType === "none") return 0;
  const raw = String(offering?.bounty ?? offering?.profile_expertise_bounty ?? "").trim();
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

export function hasOfferingBounty(offering) {
  return getOfferingBountyType(offering) !== "none" && parseOfferingBountyAmount(offering) > 0;
}

/** Total bounty $ for a cart line (respects per_item vs total). */
export function getOfferingBountyLineTotal(offering, qty) {
  const bountyType = getOfferingBountyType(offering);
  const amount = parseOfferingBountyAmount(offering);
  if (bountyType === "none" || amount <= 0) return 0;
  const q = parseInt(qty, 10) || 1;
  if (bountyType === "total") return amount;
  return amount * q;
}

/** Remaining stock for an offering, or null when unlimited / not set. */
export function getOfferingMaxQuantity(offering) {
  const raw = offering?.profile_expertise_quantity ?? offering?.quantity ?? offering?.bs_quantity;
  if (raw == null || raw === "") return null;
  const str = String(raw).trim().toLowerCase();
  if (!str || str === "unlimited") return null;
  const n = parseInt(str, 10);
  return Number.isNaN(n) ? null : n;
}

/** How many more units the buyer can add given stock and what's already in cart. */
export function getOfferingMaxAddQuantity(offering, existingInCart = 0) {
  const stockMax = getOfferingMaxQuantity(offering);
  if (stockMax == null) return null;
  const inCart = parseInt(existingInCart, 10) || 0;
  return Math.max(0, stockMax - inCart);
}

/** Stock / cart hint for the Add to Cart modal. */
export function formatOfferingAddToCartStockHint(offering, existingInCart = 0, addingQty = 0) {
  const inCart = parseInt(existingInCart, 10) || 0;
  const adding = Math.max(0, parseInt(addingQty, 10) || 0);
  const stockMax = getOfferingMaxQuantity(offering);
  const maxCanAdd = stockMax != null ? getOfferingMaxAddQuantity(offering, inCart) : null;
  const remainingAfter = stockMax != null ? Math.max(0, stockMax - inCart - adding) : null;

  if (stockMax == null) {
    if (inCart > 0 || adding > 0) {
      const parts = [];
      if (inCart > 0) parts.push(`${inCart} in cart`);
      if (adding > 0) parts.push(`adding ${adding}`);
      return parts.join(" · ");
    }
    return null;
  }
  if (maxCanAdd <= 0) {
    return `${inCart} in cart — maximum available (${stockMax})`;
  }
  const parts = [];
  if (inCart > 0) parts.push(`${inCart} in cart`);
  if (adding > 0) {
    if (remainingAfter <= 0) {
      parts.push(`adding ${adding} (maximum)`);
    } else if (remainingAfter <= 5) {
      parts.push(`adding ${adding} · only ${remainingAfter} more after this`);
    } else {
      parts.push(`adding ${adding} · ${remainingAfter} more after this`);
    }
  } else if (maxCanAdd <= 5) {
    parts.push(`only ${maxCanAdd} more can be added`);
  } else {
    parts.push(`${maxCanAdd} more can be added`);
  }
  return parts.join(" · ");
}

/** Total stock limit for a cart line (offering or business product). */
export function getCartLineStockMax(item) {
  if (!item) return null;
  if (item.itemType === "expertise") return getOfferingMaxQuantity(item);
  const raw = item.bs_quantity;
  if (raw == null || raw === "" || String(raw).toLowerCase() === "unlimited") return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

/** How many more units can be added on this cart line before hitting stock. */
export function getCartLineRemainingAddQuantity(item) {
  const stockMax = getCartLineStockMax(item);
  if (stockMax == null) return null;
  const inCart = parseInt(item?.quantity, 10) || 0;
  return Math.max(0, stockMax - inCart);
}

/** Stock badge copy for a line already in the shopping cart. */
export function formatCartLineStockBadge(item) {
  const stockMax = getCartLineStockMax(item);
  if (stockMax == null) return null;
  const inCart = parseInt(item?.quantity, 10) || 0;
  const remaining = Math.max(0, stockMax - inCart);

  if (stockMax <= 0) return "Out of stock";
  if (remaining <= 0) {
    return inCart > 0 ? `${inCart} in cart — maximum (${stockMax})` : "Out of stock";
  }
  if (remaining <= 5) {
    return inCart > 0 ? `${inCart} in cart · only ${remaining} more can be added` : `Only ${remaining} left`;
  }
  return inCart > 0 ? `${inCart} in cart · ${remaining} more can be added` : `${remaining} in stock`;
}

/** Badge colors for cart stock status. */
export function getCartLineStockBadgeStyle(item) {
  const stockMax = getCartLineStockMax(item);
  if (stockMax == null) return null;
  const inCart = parseInt(item?.quantity, 10) || 0;
  const remaining = Math.max(0, stockMax - inCart);
  const atMaximum = remaining <= 0 && inCart >= stockMax && stockMax > 0;
  const isSoldOut = stockMax <= 0 || (remaining <= 0 && inCart === 0);
  const isLow = !atMaximum && !isSoldOut && remaining > 0 && remaining <= 5;

  if (isSoldOut) {
    return { backgroundColor: "#fee2e2", color: "#dc2626" };
  }
  if (atMaximum) {
    return { backgroundColor: "#fef9c3", color: "#b45309" };
  }
  if (isLow) {
    return { backgroundColor: "#fef9c3", color: "#b45309" };
  }
  return { backgroundColor: "#dcfce7", color: "#166534" };
}

/** Bounty type string for checkout API (`per_item` | `total`). */
export function getOfferingBountyTypeForCheckout(offering) {
  const t = getOfferingBountyType(offering);
  if (t === "total") return "total";
  if (t === "per_item") return "per_item";
  return "per_item";
}

/** Fields to persist on expertise cart items so cart/checkout can recompute correctly. */
export function expertiseCartPersistedFields(expertiseData, modalData = {}) {
  return {
    ...expertiseCartTaxFields(expertiseData, modalData),
    profile_expertise_bounty_type: getOfferingBountyType(expertiseData),
    profile_expertise_quantity: expertiseData?.profile_expertise_quantity ?? expertiseData?.quantity ?? "",
    cost_is_total: isOfferingCostTotalUnit(expertiseData?.cost),
  };
}
