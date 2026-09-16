/** API public/visibility flags may be number 1, string "1", boolean, or "true". */
export function isApiPublicFlag(value) {
  if (value === 1 || value === "1" || value === true) return true;
  if (typeof value === "string") {
    const t = value.trim().toLowerCase();
    if (t === "1" || t === "true" || t === "yes") return true;
  }
  return false;
}

/** Explicitly hidden / Display off. */
export function isApiPrivateFlag(value) {
  if (value === 0 || value === "0" || value === false) return true;
  if (typeof value === "string") {
    const t = value.trim().toLowerCase();
    if (t === "0" || t === "false" || t === "no") return true;
  }
  return false;
}
