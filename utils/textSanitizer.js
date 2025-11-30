/**
 * Text Sanitizer Utility
 * 
 * Prevents "Unexpected text node" errors in React Native Web by:
 * 1. Filtering out periods (.) that would be rendered as text nodes
 * 2. Ensuring all text values are valid strings
 * 3. Returning empty strings or null for invalid values
 */

/**
 * Sanitizes a text value to prevent rendering periods as text nodes
 * @param {any} value - The value to sanitize
 * @param {string} fallback - Fallback value if sanitized value is invalid (default: "")
 * @returns {string} - Sanitized string value
 */
export const sanitizeText = (value, fallback = "") => {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return fallback;
  }
  
  // Convert to string and trim
  let str = String(value).trim();
  
  // If empty after trim, return fallback
  if (str === "") {
    return fallback;
  }
  
  // Check for problematic values
  if (str === "." || 
      str === "null" || 
      str === "undefined" ||
      str === "NaN" ||
      str.match(/^[\s.,;:!?\-_=+]*$/)) {
    return fallback;
  }
  
  // Additional safety: if the string is ONLY punctuation/whitespace, return fallback
  // This catches cases like ".," or ", ." etc.
  const cleaned = str.replace(/[\s.,;:!?\-_=+]/g, "");
  if (cleaned === "") {
    return fallback;
  }
  
  return str;
};

/**
 * Checks if a value is safe to use in a conditional (won't render as text node)
 * Returns true only if the value is truthy AND not an empty string
 */
export const isSafeForConditional = (value) => {
  if (value === null || value === undefined) {
    return false;
  }
  
  const str = String(value).trim();
  return str !== "" && str !== "." && str !== "null" && str !== "undefined";
};

/**
 * Sanitizes an object's text properties
 * @param {object} obj - Object to sanitize
 * @param {string[]} textFields - Array of field names to sanitize
 * @returns {object} - Object with sanitized text fields
 */
export const sanitizeObjectTextFields = (obj, textFields = []) => {
  if (!obj || typeof obj !== "object") {
    return obj;
  }
  
  const sanitized = { ...obj };
  
  // If no fields specified, sanitize all string-like fields
  const fieldsToSanitize = textFields.length > 0 
    ? textFields 
    : Object.keys(sanitized).filter(key => typeof sanitized[key] === "string");
  
  fieldsToSanitize.forEach(field => {
    if (sanitized[field] !== undefined && sanitized[field] !== null) {
      sanitized[field] = sanitizeText(sanitized[field], "");
    }
  });
  
  return sanitized;
};

/**
 * Validates if a value is safe to render in React Native Web
 * @param {any} value - Value to validate
 * @returns {boolean} - True if value is safe to render
 */
export const isSafeToRender = (value) => {
  if (value === null || value === undefined) {
    return false;
  }
  
  const str = String(value).trim();
  return str !== "." && str !== "" && str !== "null" && str !== "undefined";
};

/**
 * Conditionally renders text only if it's safe
 * @param {any} value - Value to render
 * @param {function} renderFn - Function that returns JSX to render
 * @returns {JSX.Element|null} - Rendered component or null
 */
export const safeRender = (value, renderFn) => {
  if (!isSafeToRender(value)) {
    return null;
  }
  
  return renderFn ? renderFn(value) : null;
};

