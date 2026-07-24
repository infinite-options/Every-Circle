import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchMiddleware as fetch } from "./httpMiddleware";

export const NEARBY_SETTINGS_KEY = "nearby_share_settings";

/** Mirrors backend default behaviour (all_circles for both). */
export const DEFAULT_NEARBY_SETTINGS = {
  shareWith: "all_circles",
  shareWithTypes: { friends: true, colleagues: true, family: true },
  receiveFrom: "all_circles",
  receiveFromTypes: { friends: true, colleagues: true, family: true },
};

export const NEARBY_PRIVACY_LABELS = {
  everyone: "Everyone",
  all_circles: "All Circles",
  specific: "Specific",
};

/** Human-readable summary matching Settings → Location Privacy subtext. */
export function formatNearbyPrivacySummary(settings) {
  const shareLabel = NEARBY_PRIVACY_LABELS[settings?.shareWith] || settings?.shareWith || "All Circles";
  const receiveLabel = NEARBY_PRIVACY_LABELS[settings?.receiveFrom] || settings?.receiveFrom || "All Circles";
  return `Share: ${shareLabel} · Receive: ${receiveLabel}`;
}

const settingsListeners = new Set();

export async function loadNearbySettings() {
  try {
    const raw = await AsyncStorage.getItem(NEARBY_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { ...DEFAULT_NEARBY_SETTINGS };
}

function notifyNearbySettingsListeners(settings) {
  settingsListeners.forEach((listener) => {
    try {
      listener(settings);
    } catch (_) {}
  });
}

/** Push prefs to backend (no lat/lng). */
export async function syncNearbySettingsToServer(settings) {
  try {
    const { NEARBY_LOCATION_ENDPOINT } = require("../apiConfig");
    const uid = await AsyncStorage.getItem("profile_uid");
    if (!uid) return;
    await fetch(NEARBY_LOCATION_ENDPOINT, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_uid: uid,
        share_with: settings.shareWith,
        share_with_types: Object.keys(settings.shareWithTypes).filter((k) => settings.shareWithTypes[k]),
        receive_from: settings.receiveFrom,
        receive_from_types: Object.keys(settings.receiveFromTypes).filter((k) => settings.receiveFromTypes[k]),
      }),
    });
  } catch (_) {}
}

/** Persist locally and to the server; notifies all subscribers (Connect + Settings). */
export async function persistNearbySettings(newSettings) {
  try {
    await AsyncStorage.setItem(NEARBY_SETTINGS_KEY, JSON.stringify(newSettings));
  } catch (_) {}
  notifyNearbySettingsListeners(newSettings);
  await syncNearbySettingsToServer(newSettings);
}

/** Subscribe to nearby privacy changes. Fires immediately with current settings. */
export function subscribeNearbySettings(listener) {
  settingsListeners.add(listener);
  void loadNearbySettings().then(listener);
  return () => settingsListeners.delete(listener);
}
