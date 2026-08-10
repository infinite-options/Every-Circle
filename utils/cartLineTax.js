import { parsePrice } from "./priceUtils";
import { isTruthyTaxableFlag } from "./taxValidation";
import { getOfferingLinePretax } from "./offeringCartUtils";

export function roundCartMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

/** Tax rate as a percentage for formula: pretax × (rate ÷ 100). */
export function taxRatePercentForCalculation(raw) {
  return parsePrice(raw != null ? raw : 0);
}

export function isExpertiseLineTaxable(item) {
  if (!item || item.itemType !== "expertise") return false;
  if (isTruthyTaxableFlag(item.profile_expertise_is_taxable)) return true;
  return parsePrice(item.taxRatePct) > 0;
}

export function expertiseTaxRatePercent(item) {
  if (item.taxRatePct != null && parsePrice(item.taxRatePct) > 0) {
    return parsePrice(item.taxRatePct);
  }
  if (isTruthyTaxableFlag(item.profile_expertise_is_taxable)) {
    const rate = taxRatePercentForCalculation(item.profile_expertise_tax_rate);
    if (rate > 0) return rate;
  }
  return 0;
}

export function expertiseLinePretax(item) {
  const qty = parseInt(item.quantity, 10) || 1;
  return roundCartMoney(getOfferingLinePretax(item.cost, qty));
}

/** Pretax, sales tax, and metadata for an expertise/offering cart line. */
export function expertiseLineMerchandiseAndTax(item) {
  const pretax = expertiseLinePretax(item);
  const taxable = isExpertiseLineTaxable(item);
  const ratePercent = expertiseTaxRatePercent(item);
  const tax = taxable && ratePercent > 0 ? roundCartMoney(pretax * (ratePercent / 100)) : 0;
  const rawTaxRate =
    item.profile_expertise_tax_rate != null && String(item.profile_expertise_tax_rate).trim() !== ""
      ? item.profile_expertise_tax_rate
      : item.taxRatePct != null && parsePrice(item.taxRatePct) > 0
        ? item.taxRatePct
        : null;

  return {
    pretax,
    tax,
    taxable: taxable && ratePercent > 0,
    rawTaxRate,
    ratePercentUsed: taxable && ratePercent > 0 ? ratePercent : null,
  };
}

/** Persist offering tax settings on cart items so checkout can recompute after qty changes. */
export function expertiseCartTaxFields(expertiseData, modalData = {}) {
  return {
    profile_expertise_is_taxable: expertiseData?.profile_expertise_is_taxable ?? 0,
    profile_expertise_tax_rate: expertiseData?.profile_expertise_tax_rate ?? "",
    taxRatePct: modalData.taxRatePct ?? 0,
  };
}

function isBusinessServiceLineTaxable(item) {
  if (!item || item.itemType === "expertise") return false;
  const v = item.bs_is_taxable;
  if (v === undefined || v === null || v === "") {
    return parsePrice(item.bs_tax_rate) > 0;
  }
  if (v === false || v === 0) return false;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "0" || t === "false" || t === "no") return false;
    if (t === "1" || t === "true" || t === "yes") return true;
    const n = parseInt(t, 10);
    if (!Number.isNaN(n)) return n !== 0;
  }
  if (typeof v === "number") return v !== 0;
  return Boolean(v);
}

/** Pretax, sales tax, and metadata for a business service cart line. */
export function businessLineMerchandiseAndTax(item) {
  const qty = parseInt(item.quantity, 10) || 1;
  const pretax = roundCartMoney(parsePrice(item.bs_cost_with_extras || item.bs_cost) * qty);
  const taxable = isBusinessServiceLineTaxable(item);
  const ratePercent = taxRatePercentForCalculation(item.bs_tax_rate);
  const tax = taxable && ratePercent > 0 ? roundCartMoney(pretax * (ratePercent / 100)) : 0;
  return {
    pretax,
    tax,
    taxable: taxable && ratePercent > 0,
    rawTaxRate: item.bs_tax_rate,
    ratePercentUsed: taxable && ratePercent > 0 ? ratePercent : null,
  };
}

export function cartLineMerchandiseAndTax(item) {
  if (!item || typeof item !== "object") {
    return { pretax: 0, tax: 0, ratePercentUsed: null };
  }
  return item.itemType === "expertise" ? expertiseLineMerchandiseAndTax(item) : businessLineMerchandiseAndTax(item);
}

/**
 * Per-line tax snapshots for POST /api/v1/transactions — listing rate + computed line amount at checkout.
 * Backend persists these; account-screen must not re-allocate order tax.
 */
export function buildCheckoutLineTaxApiFields(item) {
  const { tax, ratePercentUsed, taxable } = cartLineMerchandiseAndTax(item);
  const lineTaxAmount = roundCartMoney(tax);
  const fields = {
    line_tax_amount: lineTaxAmount,
    ti_line_tax_amount: lineTaxAmount,
    ti_tax_rate: ratePercentUsed != null && ratePercentUsed > 0 ? ratePercentUsed : 0,
    ti_bs_tax_rate: ratePercentUsed != null && ratePercentUsed > 0 ? ratePercentUsed : 0,
  };
  if (item?.itemType === "expertise") {
    if (ratePercentUsed != null && ratePercentUsed > 0) {
      fields.profile_expertise_tax_rate = String(ratePercentUsed);
    }
    if (taxable || isExpertiseLineTaxable(item)) {
      const flag = item.profile_expertise_is_taxable;
      fields.profile_expertise_is_taxable = flag === undefined || flag === null || flag === "" ? 1 : flag;
    }
  } else if (ratePercentUsed != null && ratePercentUsed > 0) {
    fields.bs_tax_rate = String(ratePercentUsed);
  }
  return fields;
}
