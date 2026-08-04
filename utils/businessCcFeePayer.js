import { canonicalBusinessCcFeePayer } from "./normalizeBusinessServiceFromApi";

/** Raw CC fee payer field from a business row, cart line, or service object. */
export function resolveBusinessCcFeePayerRaw(source) {
  if (!source || typeof source !== "object") return "";
  return (
    source.business_cc_fee_payer ??
    source.bs_cc_fee_payer ??
    source.business_bs_cc_fee_payer ??
    source.cc_fee_payer ??
    ""
  );
}

/** Canonical "buyer" | "seller" from any business/cart/service shape. */
export function businessCcFeePayerFromSource(source) {
  return canonicalBusinessCcFeePayer(resolveBusinessCcFeePayerRaw(source));
}

/** True when the buyer pays Stripe card fees for one cart line. */
export function cartItemBuyerPaysCardFee(item, ccFeePayerByBusinessUid = null) {
  if (!item || typeof item !== "object") return false;
  if (item.itemType === "expertise") return true;
  if (businessCcFeePayerFromSource(item) === "buyer") return true;
  const uid = String(item.business_uid || "").trim();
  if (uid && ccFeePayerByBusinessUid && ccFeePayerByBusinessUid[uid] === "buyer") return true;
  return false;
}

/** True when any line in a seller checkout group passes card fees to the buyer. */
export function groupBuyerPaysCardFee(items, ccFeePayerByBusinessUid = null) {
  if (!Array.isArray(items) || items.length === 0) return false;
  if (items.some((it) => it && it.itemType === "expertise")) return true;
  return items.some((it) => cartItemBuyerPaysCardFee(it, ccFeePayerByBusinessUid));
}
