import { Platform } from "react-native";
import {
  EXPO_PUBLIC_GOOGLE_API_KEY,
  EXPO_PUBLIC_GOOGLE_API_KEY_ANDROID,
  EXPO_PUBLIC_GOOGLE_API_KEY_IOS,
  EXPO_PUBLIC_GOOGLE_API_KEY_LOCAL,
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
  EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
} from "@env";

function firstNonEmpty(...values) {
  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

/** Browser origin used for local Maps/Places (not used on Netlify / production). */
export function isGoogleMapsLocalhostOrigin() {
  if (typeof window === "undefined" || !window.location) return false;
  const host = String(window.location.hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/**
 * Pick the Google Maps/Places API key for the current runtime.
 * Web production: EXPO_PUBLIC_GOOGLE_API_KEY
 * Web localhost: EXPO_PUBLIC_GOOGLE_API_KEY_LOCAL (falls back to the web key)
 * Android/iOS: platform keys
 */
export function resolveGoogleApiKey(platform = Platform.OS) {
  const webKey = firstNonEmpty(
    EXPO_PUBLIC_GOOGLE_API_KEY,
    EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    typeof process !== "undefined" ? process.env.EXPO_PUBLIC_GOOGLE_API_KEY : "",
    typeof process !== "undefined" ? process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY : "",
    typeof process !== "undefined" ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY : "",
  );
  const localKey = firstNonEmpty(
    EXPO_PUBLIC_GOOGLE_API_KEY_LOCAL,
    typeof process !== "undefined" ? process.env.EXPO_PUBLIC_GOOGLE_API_KEY_LOCAL : "",
  );

  if (platform === "android") {
    return firstNonEmpty(
      EXPO_PUBLIC_GOOGLE_API_KEY_ANDROID,
      typeof process !== "undefined" ? process.env.EXPO_PUBLIC_GOOGLE_API_KEY_ANDROID : "",
      webKey,
    );
  }

  if (platform === "ios") {
    return firstNonEmpty(
      EXPO_PUBLIC_GOOGLE_API_KEY_IOS,
      typeof process !== "undefined" ? process.env.EXPO_PUBLIC_GOOGLE_API_KEY_IOS : "",
      webKey,
    );
  }

  if (isGoogleMapsLocalhostOrigin()) {
    return localKey || webKey;
  }

  return webKey;
}
