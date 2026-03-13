/**
 * Returns true if the wish has an end date that is before the current moment.
 * Wishes without an end date are considered active (not ended).
 * @param {Object} wish - Wish object with profile_wish_end (format: "YYYY-MM-DD HH:mm" or "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD")
 * @returns {boolean}
 */
export function isWishEnded(wish) {
  const endStr = wish?.profile_wish_end;
  if (!endStr || typeof endStr !== "string" || endStr.trim() === "") return false;
  const trimmed = endStr.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[\sT]?(\d{1,2})?:?(\d{2})?/);
  if (!match) return false;
  const [, y, m, d, h, min] = match;
  const hour = h !== undefined ? parseInt(h, 10) : 0;
  const minute = min !== undefined ? parseInt(min, 10) : 0;
  const endDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), hour, minute);
  return endDate.getTime() < Date.now();
}
