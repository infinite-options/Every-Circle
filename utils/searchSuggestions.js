import { Platform } from "react-native";
import { SEARCH_SUGGEST_ENDPOINT } from "../apiConfig";

export const SEARCH_SUGGEST_MIN_LENGTH = 2;
export const SEARCH_SUGGEST_DEFAULT_LIMIT = 8;

const webFetchOptions = {
  method: "GET",
  mode: "cors",
  credentials: "omit",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  cache: "no-cache",
};

const nativeFetchOptions = {
  method: "GET",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
};

/**
 * Fetch search autocomplete suggestions.
 * Backend source is tags today; swap via SEARCH_SUGGEST_SOURCE on the search server.
 */
export async function fetchSearchSuggestions(query, { limit = SEARCH_SUGGEST_DEFAULT_LIMIT, source } = {}) {
  const trimmed = (query || "").trim();
  if (trimmed.length < SEARCH_SUGGEST_MIN_LENGTH) {
    return [];
  }

  let url = `${SEARCH_SUGGEST_ENDPOINT}?q=${encodeURIComponent(trimmed)}&limit=${limit}`;
  if (source) {
    url += `&source=${encodeURIComponent(source)}`;
  }

  const res = await fetch(url, Platform.OS === "web" ? webFetchOptions : nativeFetchOptions);
  if (!res.ok) {
    throw new Error(`Search suggest failed: ${res.status}`);
  }

  const json = await res.json();
  const raw = json.suggestions || [];
  const resolvedSource = json.source || source || "tags";

  return raw.map((item) => {
    if (typeof item === "string") {
      return { text: item, source: resolvedSource };
    }
    return {
      text: item.text || item.label || "",
      source: item.source || resolvedSource,
      count: item.count ?? item.business_count ?? null,
    };
  }).filter((item) => item.text);
}
