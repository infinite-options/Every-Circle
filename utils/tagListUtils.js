/** Split a stored comma-separated tag string into a trimmed, dedupe-friendly list. */
export function parseTagList(raw) {
  if (raw == null || raw === "") return [];
  const s = typeof raw === "string" ? raw : String(raw);
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Serialize tag list for API / bs_tags storage. */
export function serializeTagList(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return "";
  return tags.join(", ");
}

/**
 * Merge comma-separated input into an existing tag list (Business Setup pattern).
 * Splits on commas, trims, drops empties, skips duplicates.
 */
export function mergeCustomTags(existing, inputText) {
  const pending = (inputText || "").trim();
  if (!pending) return Array.isArray(existing) ? [...existing] : [];

  const newTags = pending
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const merged = Array.isArray(existing) ? [...existing] : parseTagList(existing);
  newTags.forEach((tag) => {
    if (!merged.includes(tag)) merged.push(tag);
  });
  return merged;
}
