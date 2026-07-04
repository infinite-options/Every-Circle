/** Redact secrets for logs/UI, e.g. `AIzaSy....XwJY`. */
export function obscureApiKey(key, { prefixLen = 6, suffixLen = 4, mask = "...." } = {}) {
  if (key == null || key === "") return "Not set";
  const trimmed = String(key).trim();
  if (!trimmed) return "Not set";
  if (trimmed.length <= prefixLen + suffixLen) return mask;
  return `${trimmed.slice(0, prefixLen)}${mask}${trimmed.slice(-suffixLen)}`;
}
