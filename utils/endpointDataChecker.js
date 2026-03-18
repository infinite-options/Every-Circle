/**
 * Recursively walks through endpoint response data and replaces empty or whitespace-only
 * strings ("", " ") with null. This prevents errors when downstream code expects null
 * for missing values but receives "" or " " from the API.
 *
 * @param {*} data - The endpoint response data (object, array, or primitive)
 * @returns {*} - The sanitized data with "" and " " replaced by null
 */
export function sanitizeEmptyStrings(data) {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    const trimmed = data.trim();
    return trimmed === "" ? null : data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeEmptyStrings(item));
  }

  if (typeof data === "object") {
    const result = {};
    for (const key of Object.keys(data)) {
      result[key] = sanitizeEmptyStrings(data[key]);
    }
    return result;
  }

  return data;
}
