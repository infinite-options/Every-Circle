import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { fetchMiddleware as fetch } from "./httpMiddleware";
import { loadNearbySettings } from "./nearbySettings";
import { parseCoordinateValue } from "./validateCoordinates";

const isWeb = typeof window !== "undefined" && typeof document !== "undefined";

export const NEARBY_LOCATION_PICKER_OPTIONS = [
  { name: "Dummy A — Salesforce Park, SF", lat: 37.7893, lng: -122.3966 },
  { name: "Dummy B — Ferry Building, SF", lat: 37.7956, lng: -122.3935 },
  { name: "Dummy C — Golden Gate Park, SF", lat: 37.7694, lng: -122.4862 },
  { name: "Dummy D — Balboa Park, San Diego CA", lat: 32.7341, lng: -117.1442 },
  { name: "Dummy E — Zilker Park, Austin TX", lat: 30.2669, lng: -97.7728 },
  { name: "Dummy F — CN Tower, Toronto Canada", lat: 43.6426, lng: -79.3871 },
  { name: "Live GPS" },
];

const coordsListeners = new Set();

function notifyStoredNearbyCoords(coords) {
  coordsListeners.forEach((listener) => {
    try {
      listener(coords);
    } catch (_) {}
  });
}

/** Subscribe to nearby coordinate updates (manual picker or live sharing). */
export function subscribeStoredNearbyCoords(listener) {
  coordsListeners.add(listener);
  return () => coordsListeners.delete(listener);
}

/** Notify subscribers when coords change (e.g. live sharing patch). */
export function publishStoredNearbyCoords(coords) {
  notifyStoredNearbyCoords(coords);
}

export function formatStoredNearbyCoordsSummary(coords) {
  const lat = parseCoordinateValue(coords?.lat);
  const lng = parseCoordinateValue(coords?.lng);
  if (lat != null && lng != null) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return "No location set";
}

/** Resolve lat/lng from a picker option (preset or Live GPS). */
export async function resolveNearbyLocationOptionCoords(option) {
  if (option.name === "Live GPS") {
    if (isWeb) {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => reject(err),
          { timeout: 10000 },
        );
      });
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Location permission denied");
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  }
  return { lat: option.lat, lng: option.lng };
}

/** PATCH nearby location to server; notifies subscribers on success. */
export async function patchNearbyLocation(profileId, lat, lng, liveSharing = true) {
  const { NEARBY_LOCATION_ENDPOINT } = require("../apiConfig");
  const settings = await loadNearbySettings();
  try {
    const response = await fetch(NEARBY_LOCATION_ENDPOINT, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_uid: profileId,
        lat,
        lng,
        live_sharing: liveSharing,
        share_with: settings.shareWith,
        share_with_types: Object.keys(settings.shareWithTypes).filter((k) => settings.shareWithTypes[k]),
        receive_from: settings.receiveFrom,
        receive_from_types: Object.keys(settings.receiveFromTypes).filter((k) => settings.receiveFromTypes[k]),
      }),
    });
    const result = await response.json();
    if (result.code === 200) {
      const coords = { lat, lng, updatedAt: result.updated_at || null };
      notifyStoredNearbyCoords(coords);
      return coords;
    }
  } catch (err) {
    console.error("patchNearbyLocation error:", err);
  }
  return null;
}

/** Pick a location option, PATCH to server, return coords or null. */
export async function updateNearbyLocationFromOption(option) {
  const profileId = await AsyncStorage.getItem("profile_uid");
  if (!profileId) {
    Alert.alert("Error", "No profile found. Please log in again.");
    return null;
  }
  try {
    const { lat, lng } = await resolveNearbyLocationOptionCoords(option);
    const coords = await patchNearbyLocation(profileId, lat, lng, true);
    if (!coords) Alert.alert("Error", "Failed to update location.");
    return coords;
  } catch (err) {
    console.error("updateNearbyLocationFromOption error:", err);
    const msg = err?.message === "Location permission denied" ? "Location permission is required to use Live GPS." : "Could not update location. Please try again.";
    Alert.alert("Error", msg);
    return null;
  }
}
