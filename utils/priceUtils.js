/**
 * Safely parse a price value that may include $ or currency symbols.
 * Handles: "50", "$50", "USD 50", "50.00", etc.
 * @param {string|number} val - The value to parse
 * @returns {number} - The parsed number, or 0 if invalid
 */
export const parsePrice = (val) => {
  if (val == null || val === "") return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

/** Whole dollars for display (no cents), e.g. bounties on expertise. */
export const formatWholeDollars = (val) => Math.round(parsePrice(val));

/**
 * Format cost value with smart decimal places:
 * - If whole number (e.g., 4.00): display as "4"
 * - If has decimals (e.g., 0.5, 8.5): display with 2 decimal places ("0.50", "8.50")
 * Allows 0 and incomplete decimals during typing
 * @param {string|number} val - The value to format
 * @returns {string} - The formatted value, or empty string if invalid/incomplete
 */
export const formatCostValue = (val) => {
  if (val == null || val === "") return "";

  // Keep as string to preserve incomplete decimals while the user is typing,
  // so we don't force formatting until the user leaves the input.
  const strVal = String(val).trim();

  // Allow incomplete decimals while typing (e.g., "0.", ".5").
  if (strVal.endsWith(".") || strVal.startsWith(".")) {
    return strVal;
  }

  // Parse as number after typing is complete.
  const num = parsePrice(val);
  if (isNaN(num)) return "";

  // Allow 0 as a valid value
  if (num === 0) return "0";

  // Check if it's a whole number
  if (Number.isInteger(num)) {
    return num.toString();
  }

  // For decimal numbers, ensure 2 decimal places
  return num.toFixed(2);
};
