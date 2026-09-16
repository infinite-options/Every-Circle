/** API public/visibility flags may be number 1, string "1", or boolean. */
export function isApiPublicFlag(value) {
  return value === 1 || value === "1" || value === true || value === "true";
}

/** Explicitly hidden / Display off. */
export function isApiExplicitlyPrivate(value) {
  return value === 0 || value === "0" || value === false || value === "false";
}

/**
 * Shared MiniCard photo (QR / Connect landing): show when a URL exists unless Display is explicitly off.
 * Treats null/undefined flags as public so OAuth-stored URLs still appear for scanners.
 */
export function isSharedProfileImagePublic(flag) {
  if (isApiExplicitlyPrivate(flag)) return false;
  return true;
}
