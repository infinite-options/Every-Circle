/**
 * Whether a connection counts as "new" for Connect list / graph highlights.
 * Uses circle_date (YYYY-MM-DD). New = formed today or yesterday (≤ 1 calendar day old).
 */

function parseConnectionDate(value) {
  if (value == null || value === "") return null;
  const trimmed = String(value).trim();
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * @param {object|string|Date|null|undefined} nodeOrDate - network/circle node, or a date value
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isNewConnection(nodeOrDate, now = new Date()) {
  const raw =
    nodeOrDate != null && typeof nodeOrDate === "object" && !(nodeOrDate instanceof Date)
      ? nodeOrDate.circle_date ?? nodeOrDate.__mc?.circle_date ?? null
      : nodeOrDate;
  const connected = parseConnectionDate(raw);
  if (!connected) return false;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ageDays = Math.floor((today.getTime() - connected.getTime()) / 86400000);
  return ageDays >= 0 && ageDays <= 1;
}
