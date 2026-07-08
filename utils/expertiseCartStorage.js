import AsyncStorage from "@react-native-async-storage/async-storage";
import { expertiseLineMerchandiseAndTax, roundCartMoney } from "./cartLineTax";
import { getOfferingMaxQuantity } from "./offeringCartUtils";

export function expertiseCartKey(expertiseUid) {
  return `cart_expertise_${expertiseUid}`;
}

/** Current quantity of an offering already saved in the cart (0 if none). */
export async function loadExpertiseCartQuantity(expertiseUid) {
  if (!expertiseUid) return 0;
  try {
    const raw = await AsyncStorage.getItem(expertiseCartKey(expertiseUid));
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return parseInt(parsed?.quantity, 10) || 0;
  } catch (_) {
    return 0;
  }
}

/** Recompute stored line totals after quantity changes (matches AddToCartDetailsModal). */
export function recomputeExpertiseCartTotals(cartItem, quantity) {
  const item = { ...cartItem, quantity };
  const { pretax, tax, ratePercentUsed } = expertiseLineMerchandiseAndTax(item);
  const subtotal = pretax;
  const taxAmount = tax;
  const processingFee = roundCartMoney((subtotal + taxAmount) * 0.03);
  const totalWithFee = roundCartMoney(subtotal + taxAmount + processingFee);
  return {
    quantity,
    subtotal,
    taxAmount,
    taxRatePct: ratePercentUsed ?? cartItem.taxRatePct ?? 0,
    totalWithFee,
    costAmount: subtotal,
  };
}

/**
 * Add or merge an expertise cart line. Quantities accumulate when the same offering
 * is added again; total is capped at available stock when limited.
 */
export async function upsertExpertiseCartItem(cartItem) {
  const cartKey = cartItem.cart_key || expertiseCartKey(cartItem.expertise_uid);
  const addQty = parseInt(cartItem.quantity, 10) || 0;

  let existing = null;
  const existingRaw = await AsyncStorage.getItem(cartKey);
  if (existingRaw) {
    try {
      existing = JSON.parse(existingRaw);
    } catch (_) {
      existing = null;
    }
  }

  const existingQty = existing ? parseInt(existing.quantity, 10) || 0 : 0;
  const requestedQty = existingQty + addQty;
  let mergedQty = requestedQty;
  const maxQty = getOfferingMaxQuantity(cartItem);
  let capped = false;
  if (maxQty != null && requestedQty > maxQty) {
    mergedQty = maxQty;
    capped = true;
  }

  const merged = {
    ...existing,
    ...cartItem,
    cart_key: cartKey,
    addedAt: existing?.addedAt || cartItem.addedAt,
    escrow: cartItem.escrow ?? existing?.escrow,
    ...recomputeExpertiseCartTotals({ ...existing, ...cartItem }, mergedQty),
  };

  await AsyncStorage.setItem(cartKey, JSON.stringify(merged));
  return { cartItem: merged, addedQty: addQty, mergedQty, capped, maxQty, existingQty };
}
