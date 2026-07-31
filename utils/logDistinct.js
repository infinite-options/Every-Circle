/**
 * console.log that skips when the same message was already logged for `key`.
 * Alternating duplicates (A, B, A, B) are suppressed after each unique line
 * has been shown once — not just consecutive repeats.
 */
const seenByKey = new Map();

function serializeArgs(args) {
  try {
    return args
      .map((a) => {
        if (typeof a === "string") return a;
        if (typeof a === "number" || typeof a === "boolean" || a == null) return String(a);
        return JSON.stringify(a);
      })
      .join(" ");
  } catch {
    return String(args);
  }
}

export function logDistinct(key, ...args) {
  const serialized = serializeArgs(args);
  let seen = seenByKey.get(key);
  if (!seen) {
    seen = new Set();
    seenByKey.set(key, seen);
  }
  if (seen.has(serialized)) return;
  seen.add(serialized);
  console.log(...args);
}

/** Clear a key (or all) so the next call always logs. */
export function resetLogDistinct(key) {
  if (key == null) seenByKey.clear();
  else seenByKey.delete(key);
}
