import { Platform } from "react-native";
import {
  EXPO_PUBLIC_GOOGLE_API_KEY,
  EXPO_PUBLIC_GOOGLE_API_KEY_ANDROID,
  EXPO_PUBLIC_GOOGLE_API_KEY_IOS,
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

/**
 * Pick the Google Maps/Places API key for the current runtime platform.
 * EXPO_PUBLIC_GOOGLE_API_KEY is the web-restricted key; Android/iOS use dedicated keys.
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

  return webKey;
}
