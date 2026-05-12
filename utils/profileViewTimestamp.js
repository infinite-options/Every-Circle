/**
 * Profile views API may return `view_timestamp` as a plain datetime string or a
 * JSON-encoded array of strings (newest last). Returns the latest timestamp string for parsing.
 */
export function getLatestProfileViewTimestamp(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr) && arr.length > 0) {
        const last = arr[arr.length - 1];
        return last != null ? String(last).trim() : null;
      }
    } catch {
      return null;
    }
    return null;
  }
  return s;
}

/** `2026-05-09 15:01:12` → local Date (avoid trailing Z so the calendar day matches the stored local time). */
function parseViewDate(ts) {
  if (!ts) return new Date(NaN);
  const s = String(ts).trim();
  const isoLocal = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(isoLocal);
  if (!Number.isNaN(d.getTime())) return d;
  return new Date(s);
}

/**
 * Formatted date for "Viewed: …" UI, or empty string if unparseable.
 * @param {string|null|undefined} raw — view_timestamp from API
 */
export function formatProfileViewedDate(raw) {
  const ts = getLatestProfileViewTimestamp(raw);
  if (!ts) return "";
  const d = parseViewDate(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
