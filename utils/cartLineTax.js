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
