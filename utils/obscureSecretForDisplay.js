/**
 * Safe display/logging helpers for API keys and secrets embedded in URLs.
 */

export function obscureApiKeyForDisplay(key) {
  if (key == null || key === "") return "Not set";
  const trimmed = String(key).trim();
  if (trimmed.length <= 8) return "********";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

/** Redact `key=` and `token=` query params in URLs and plain strings for safe logging. */
export function obscureSecretsInString(text) {
  if (text == null || typeof text !== "string") return text;
  return text
    .replace(/([?&]key=)([^&\s#]+)/gi, (_, prefix, value) => `${prefix}${obscureApiKeyForDisplay(value)}`)
    .replace(/([?&]token=)([^&\s#]+)/gi, (_, prefix, value) => {
      const trimmed = String(value).trim();
      if (trimmed.length <= 8) return `${prefix}********`;
      return `${prefix}${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
    });
}
