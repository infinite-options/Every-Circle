/** API public/visibility flags may be number 1, string "1", or boolean. */
export function isApiPublicFlag(value) {
  return value === 1 || value === "1" || value === true;
}
