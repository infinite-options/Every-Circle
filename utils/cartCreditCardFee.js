/** Buyer-paid Stripe card processing rate (3%). */
export const CREDIT_CARD_FEE_RATE = 0.03;

/** Minimum processing fee when the buyer pays card fees and the charge base is greater than zero. */
export const CREDIT_CARD_FEE_MINIMUM = 0.3;

/** Label for cart, checkout, and fee dialogs. */
export const CREDIT_CARD_FEE_DISPLAY_LABEL = "Credit card processing (3%, $0.30 min.)";

export function roundCreditCardMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Everything charged to the card before the processing fee:
 * merchandise + sales tax + buyer shipping (and any other non-fee charges).
 */
export function getCreditCardFeeBase({ merchandise = 0, tax = 0, shipping = 0 } = {}) {
  return roundCreditCardMoney(Number(merchandise) + Number(tax) + Number(shipping));
}

/** 3% processing fee (minimum $0.30) when the buyer pays card fees; otherwise $0. */
export function computeCreditCardProcessingFee(feeBase, buyerPaysCardFee = true) {
  if (!buyerPaysCardFee) return 0;
  const base = Number(feeBase);
  if (!Number.isFinite(base) || base <= 0) return 0;
  const percentFee = base * CREDIT_CARD_FEE_RATE;
  return roundCreditCardMoney(Math.max(percentFee, CREDIT_CARD_FEE_MINIMUM));
}

/** Card charge total = fee base + processing fee. */
export function computeCreditCardChargeTotal(feeBase, buyerPaysCardFee = true) {
  const base = Number(feeBase);
  const fee = computeCreditCardProcessingFee(base, buyerPaysCardFee);
  return roundCreditCardMoney(base + fee);
}

/**
 * Split a seller-group processing fee across lines so displayed line fees
 * sum exactly to the group fee (avoids per-line rounding drift).
 */
export function allocateProcessingFeeToLines(lineFeeBases, groupProcessingFee) {
  const bases = (lineFeeBases || []).map((b) => Math.max(0, Number(b) || 0));
  const groupFee = Math.max(0, Number(groupProcessingFee) || 0);
  if (bases.length === 0) return [];
  if (groupFee <= 0) return bases.map(() => 0);

  const totalBase = bases.reduce((sum, b) => sum + b, 0);
  if (totalBase <= 0) return bases.map(() => 0);

  let allocated = 0;
  return bases.map((base, index) => {
    if (index === bases.length - 1) {
      return roundCreditCardMoney(groupFee - allocated);
    }
    const share = roundCreditCardMoney((base / totalBase) * groupFee);
    allocated += share;
    return share;
  });
}

/** Stable key for mapping checkout group fees back to cart lines. */
export function cartLineProcessingFeeKey(item) {
  if (!item || typeof item !== "object") return "";
  if (item.itemType === "expertise") return `e:${item.expertise_uid || ""}`;
  return `s:${item.business_uid || ""}:${item.bs_uid || ""}`;
}

/**
 * Map each cart line to its share of the seller-group processing fee.
 * @param {Array} groups - output of buildSellerCheckoutGroups
 * @param {(item) => number} getLineFeeBase - pretax + tax + shipping for one line
 */
export function buildCartLineProcessingFeeMap(groups, getLineFeeBase) {
  const map = new Map();
  if (!Array.isArray(groups) || typeof getLineFeeBase !== "function") return map;

  for (const group of groups) {
    const items = Array.isArray(group?.items) ? group.items : [];
    const groupFee = group?.buyerPaysCardFee ? Number(group.processingFee) || 0 : 0;
    const bases = items.map((item) => getLineFeeBase(item));
    const fees = allocateProcessingFeeToLines(bases, groupFee);
    items.forEach((item, index) => {
      const key = cartLineProcessingFeeKey(item);
      if (key) map.set(key, fees[index] ?? 0);
    });
  }
  return map;
}
