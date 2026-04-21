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
