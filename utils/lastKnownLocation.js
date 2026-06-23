import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { parseCoordinateValue } from "./validateCoordinates";

export const LAST_KNOWN_LOCATION_KEY = "last_known_location";

const isWeb = typeof window !== "undefined" && typeof document !== "undefined";

/** Read persisted last-known coordinates from AsyncStorage. */
export async function getLastKnownLocation() {
  try {
    const raw = await AsyncStorage.getItem(LAST_KNOWN_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lat = parseCoordinateValue(parsed?.lat);
    const lng = parseCoordinateValue(parsed?.lng);
    if (lat == null || lng == null) return null;
    return {
      lat,
      lng,
      updatedAt: parsed.updatedAt || null,
      source: parsed.source || null,
    };
  } catch (_) {
    return null;
  }
}

/** Persist coordinates whenever the app obtains a valid GPS fix. */
export async function saveLastKnownLocation(lat, lng, { source } = {}) {
  const parsedLat = parseCoordinateValue(lat);
  const parsedLng = parseCoordinateValue(lng);
  if (parsedLat == null || parsedLng == null) return false;

  const payload = {
    lat: parsedLat,
    lng: parsedLng,
    updatedAt: new Date().toISOString(),
    ...(source ? { source } : {}),
  };

  try {
    await AsyncStorage.setItem(LAST_KNOWN_LOCATION_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn("saveLastKnownLocation failed:", err?.message || err);
    return false;
  }
}

/** User-facing message for location failures (permission, services off, no fix). */
export function getLocationErrorMessage(err, fallback = "Could not get location. Please try again.") {
  const code = err?.code;
  const message = err?.message || "";

  if (code === "LOCATION_PERMISSION_DENIED" || message === "Location permission denied") {
    return "Location permission is required to use Live GPS.";
  }
  if (code === "LOCATION_SERVICES_DISABLED") {
    return "Turn on location services in your device settings, then try again.";
  }
  if (code === "GPS_UNAVAILABLE" || message.includes("GPS fix") || message.includes("mock coordinate")) {
    return message;
  }
  return fallback;
}

/**
 * Request a device location fix (web or native) with emulator-friendly fallbacks.
 * Throws on permission denied, services disabled, or when no fix is available.
 */
export async function getDeviceLocationCoords({ requestPermission = true } = {}) {
  if (isWeb) {
    if (!navigator?.geolocation) {
      const err = new Error("Geolocation is not supported in this browser.");
      err.code = "GPS_UNAVAILABLE";
      throw err;
    }
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (geoErr) => {
          const err = new Error(geoErr?.message || "Could not get a GPS fix.");
          err.code = "GPS_UNAVAILABLE";
          reject(err);
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
      );
    });
  }

  const Location = require("expo-location");

  const permission = requestPermission
    ? await Location.requestForegroundPermissionsAsync()
    : await Location.getForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    const err = new Error("Location permission denied");
    err.code = "LOCATION_PERMISSION_DENIED";
    throw err;
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    const err = new Error("Location services are turned off on this device.");
    err.code = "LOCATION_SERVICES_DISABLED";
    throw err;
  }

  try {
    const cached = await Location.getLastKnownPositionAsync({
      maxAge: 300000,
      requiredAccuracy: 5000,
    });
    if (cached?.coords) {
      return { lat: cached.coords.latitude, lng: cached.coords.longitude };
    }
  } catch (_) {}

  const tryCurrentPosition = (accuracy) =>
    Location.getCurrentPositionAsync({
      accuracy,
      mayShowUserSettingsDialog: true,
    }).then((loc) => ({ lat: loc.coords.latitude, lng: loc.coords.longitude }));

  try {
    return await tryCurrentPosition(Location.Accuracy.Balanced);
  } catch (_) {}

  if (Platform.OS === "android") {
    try {
      await Location.enableNetworkProviderAsync();
    } catch (_) {}
  }

  try {
    return await tryCurrentPosition(Location.Accuracy.Lowest);
  } catch (cause) {
    const emulatorHint =
      Platform.OS === "android" && typeof __DEV__ !== "undefined" && __DEV__
        ? " On the Android emulator, open extended controls (⋮) → Location and set a mock coordinate."
        : "";
    const err = new Error(`Could not get a GPS fix.${emulatorHint}`);
    err.code = "GPS_UNAVAILABLE";
    err.cause = cause;
    throw err;
  }
}

/** Request a device location fix and persist it when available. */
export async function captureAndPersistLastKnownLocation() {
  try {
    const coords = await getDeviceLocationCoords({ requestPermission: true });
    await saveLastKnownLocation(coords.lat, coords.lng, { source: "gps" });
    return coords;
  } catch (err) {
    console.warn("captureAndPersistLastKnownLocation:", err?.message || err);
  }
  return null;
}
