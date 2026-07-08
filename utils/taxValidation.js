import { parsePrice } from "./priceUtils";

export const TAX_RATE_VALIDATION_MESSAGE = "Taxable items need a tax rate greater than 0% (for example 8.25).";

export function isTruthyTaxableFlag(value) {
  return value === 1 || value === "1" || value === true;
}

/** True when a tax rate is a positive number (0 and 0.00 are invalid). */
export function isValidTaxRate(rate) {
  const n = parsePrice(rate);
  return Number.isFinite(n) && n > 0;
}

export function validateTaxableRate(isTaxable, rate) {
  if (!isTruthyTaxableFlag(isTaxable)) return true;
  return isValidTaxRate(rate);
}

/** Keep prior rate only when it parses to a value > 0; otherwise clear for taxable selection. */
export function taxRateForTaxableSelection(previousRate) {
  const raw = String(previousRate ?? "").trim();
  return raw && isValidTaxRate(raw) ? raw : "";
}
