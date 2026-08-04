/** Display symbol for supported product/offering currency codes. */
const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
  JPY: "¥",
  INR: "₹",
  MXN: "MX$",
};

const STRIP_SYMBOLS = [...new Set(Object.values(CURRENCY_SYMBOLS))].sort((a, b) => b.length - a.length);

export function getCurrencySymbol(currencyCode) {
  const code = String(currencyCode || "USD")
    .trim()
    .toUpperCase();
  return CURRENCY_SYMBOLS[code] || "$";
}

/** Prefix a numeric amount string for display in currency inputs (symbol inside the field). */
export function formatAmountWithCurrencySymbol(amount, currencyCode) {
  const raw = amount == null ? "" : String(amount).trim();
  if (!raw) return "";
  if (raw.toLowerCase() === "free") return "Free";
  return `${getCurrencySymbol(currencyCode)}${raw}`;
}

/** Remove a leading currency symbol so typed values store digits only (or Free). */
export function stripLeadingCurrencySymbol(text) {
  let value = String(text ?? "");
  if (!value) return value;
  const trimmed = value.trimStart();
  const lower = trimmed.toLowerCase();
  if (lower === "free" || lower.startsWith("free")) {
    return trimmed.replace(/^[^\w]*/u, "");
  }
  for (const symbol of STRIP_SYMBOLS) {
    if (trimmed.startsWith(symbol)) {
      return trimmed.slice(symbol.length);
    }
  }
  return trimmed.replace(/^\$/u, "");
}
