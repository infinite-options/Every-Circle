import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { createAblyRealtimeClient } from "./ablyClient";
import { fetchMiddleware as fetch } from "./httpMiddleware";
import { SHARE_LIVE_LOCATION_UNTIL_KEY } from "./nearbySharing";
import { loadNearbySettings } from "./nearbySettings";
import { publishStoredNearbyCoords } from "./nearbyLocationUpdate";

export { SHARE_LIVE_LOCATION_UNTIL_KEY };

export const SHARE_LOCATION_DURATION_HOURS = 1;
const SHARE_LOCATION_DISTANCE_METERS = 50;
const SHARE_LOCATION_MIN_PATCH_MINS = 2;

let locationWatcher = null;
let autoOffTimer = null;
let lastPatchedAt = 0;
let ablyChannel = null;
let nearbyAlertHandler = null;
let notifiedUids = new Set();
/** Settings-only extras (coords, alerts) — status uses statusListeners. */
let sessionExtras = null;
const statusListeners = new Set();

const isWeb = typeof window !== "undefined" && typeof document !== "undefined";
export async function getLiveLocationSharingStatus() {
  try {
    const storedUntil = await AsyncStorage.getItem(SHARE_LIVE_LOCATION_UNTIL_KEY);
    if (!storedUntil) return { active: false, until: null };
    const expiresAt = parseInt(storedUntil, 10);
    if (expiresAt <= Date.now()) return { active: false, until: null };
    return { active: true, until: new Date(expiresAt) };
  } catch (_) {
    return { active: false, until: null };
  }
}

function notifyStatus(active, until = null) {
  const payload = { active, until };
  statusListeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (_) {}
  });
}

/** Subscribe to live-location ON/OFF changes from any screen. Fires immediately with current status. */
export function subscribeLiveLocationSharingStatus(listener) {
  statusListeners.add(listener);
  void getLiveLocationSharingStatus().then(listener);
  return () => statusListeners.delete(listener);
}

async function patchNearbyLocation(profileId, lat, lng, liveSharing = false) {
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
      lastPatchedAt = Date.now();
      const coords = { lat, lng, updatedAt: result.updated_at || null };
      publishStoredNearbyCoords(coords);
      sessionExtras?.onCoordsPatched?.(coords);
      return true;
    }
  } catch (err) {
    console.error("patchNearbyLocation error:", err);
  }
  return false;
}

function unsubscribeAblyNearby() {
  try {
    if (ablyChannel) {
      if (nearbyAlertHandler) {
        ablyChannel.unsubscribe("nearby-alert", nearbyAlertHandler);
      } else {
        ablyChannel.unsubscribe();
      }
      ablyChannel = null;
    }
    nearbyAlertHandler = null;
    notifiedUids = new Set();
  } catch (e) {
    console.warn("liveLocationSharing - Ably unsubscribe error:", e.message);
  }
}

async function subscribeAblyNearby(profileId) {
  try {
    const client = createAblyRealtimeClient(profileId);
    const channel = client.channels.get(`/${profileId}`);

    const handler = (msg) => {
      const data = msg.data || {};
      const uid = data.sender_uid;
      if (!uid || notifiedUids.has(uid)) return;
      if (sessionExtras?.isNearbyIgnored?.(uid)) return;

      const onAlert = sessionExtras?.onNearbyAlert;
      if (!onAlert) return;

      loadNearbySettings().then((settings) => {
        if (settings.receiveFrom !== "everyone") {
          const inCircles = data.recipient_in_circles;
          const rel = data.recipient_relationship;
          if (!inCircles) return;
          if (settings.receiveFrom === "specific") {
            const activeTypes = Object.keys(settings.receiveFromTypes).filter((k) => settings.receiveFromTypes[k]);
            const DB_TYPE_MAP = { friends: "friend", colleagues: "colleague", family: "family" };
            const dbTypes = activeTypes.map((t) => DB_TYPE_MAP[t] || t);
            if (!rel || !dbTypes.includes(rel)) return;
          }
        }

        notifiedUids.add(uid);
        onAlert({
          sender_uid: uid,
          sender_name: data.sender_name || "Someone",
          sender_image: data.sender_image || null,
          distance_miles: data.distance_miles ?? "?",
        });
      });
    };

    nearbyAlertHandler = handler;
    channel.subscribe("nearby-alert", handler);
    ablyChannel = channel;
  } catch (e) {
    console.warn("liveLocationSharing - Ably subscribe failed:", e.message);
  }
}

async function startWatcher(expiresAt) {
  const sub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: SHARE_LOCATION_DISTANCE_METERS,
    },
    async (loc) => {
      const now = Date.now();
      const storedUntil = await AsyncStorage.getItem(SHARE_LIVE_LOCATION_UNTIL_KEY);
      if (!storedUntil || now > parseInt(storedUntil, 10)) {
        await stopLiveLocationSharing();
        return;
      }
      if (now - lastPatchedAt < SHARE_LOCATION_MIN_PATCH_MINS * 60 * 1000) return;
      const profileId = await AsyncStorage.getItem("profile_uid");
      if (profileId) {
        await patchNearbyLocation(profileId, loc.coords.latitude, loc.coords.longitude, true);
      }
    },
  );
  locationWatcher = sub;

  const timeLeft = expiresAt - Date.now();
  if (timeLeft > 0) {
    autoOffTimer = setTimeout(() => {
      void stopLiveLocationSharing();
    }, timeLeft);
  }
}

/** Stop live sharing (manual off, auto-off, or logout). */
export async function stopLiveLocationSharing() {
  if (locationWatcher) {
    try {
      locationWatcher.remove();
    } catch (_) {}
    locationWatcher = null;
  }
  if (autoOffTimer) {
    clearTimeout(autoOffTimer);
    autoOffTimer = null;
  }
  unsubscribeAblyNearby();
  await AsyncStorage.removeItem(SHARE_LIVE_LOCATION_UNTIL_KEY);
  notifyStatus(false, null);
  sessionExtras?.onStopped?.();
}

/** Start live sharing for SHARE_LOCATION_DURATION_HOURS. */
export async function startLiveLocationSharing() {
  const existingUntil = await AsyncStorage.getItem(SHARE_LIVE_LOCATION_UNTIL_KEY);
  if (existingUntil && parseInt(existingUntil, 10) > Date.now()) {
    notifyStatus(true, new Date(parseInt(existingUntil, 10)));
    return true;
  }

  if (!isWeb) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Location permission is required to share live location.");
      return false;
    }
  } else if (!navigator.geolocation) {
    Alert.alert("Unavailable", "Geolocation is not supported in this browser.");
    return false;
  }

  const profileId = await AsyncStorage.getItem("profile_uid");
  if (!profileId) {
    Alert.alert("Error", "No profile found. Please log in again.");
    return false;
  }

  const expiresAt = Date.now() + SHARE_LOCATION_DURATION_HOURS * 60 * 60 * 1000;
  await AsyncStorage.setItem(SHARE_LIVE_LOCATION_UNTIL_KEY, String(expiresAt));
  const until = new Date(expiresAt);
  notifyStatus(true, until);

  await subscribeAblyNearby(profileId);

  try {
    let lat;
    let lng;
    if (isWeb) {
      await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            resolve();
          },
          reject,
          { timeout: 10000 },
        ),
      );
    } else {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      lat = loc.coords.latitude;
      lng = loc.coords.longitude;
    }
    await patchNearbyLocation(profileId, lat, lng, true);
  } catch (e) {
    if (!isWeb) {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Lowest,
          maximumAge: 120000,
        });
        await patchNearbyLocation(profileId, loc.coords.latitude, loc.coords.longitude, true);
      } catch (e2) {
        const msg = (e2 && e2.message) || (e && e.message) || String(e2 || e);
        console.warn("[Live location] No immediate GPS fix; watcher will keep trying.", msg);
      }
    } else {
      console.warn("[Live location] Initial browser position failed:", e?.message || e);
    }
  }

  await startWatcher(expiresAt);
  return true;
}

/** Attach Settings-only callbacks (coords patch, nearby alerts). Does not affect status listeners. */
export function bindLiveLocationSharingExtras(callbacks = {}) {
  sessionExtras = { ...sessionExtras, ...callbacks };
}

/** Clear Settings-only callbacks when Settings unmounts. Sharing session keeps running. */
export function clearLiveLocationSharingExtras() {
  sessionExtras = null;
}

/** @deprecated Use bindLiveLocationSharingExtras + subscribeLiveLocationSharingStatus. */
export function bindLiveLocationSharingCallbacks(callbacks = {}) {
  const { onStatusChange, onStopped, ...extras } = callbacks;
  bindLiveLocationSharingExtras({ ...extras, onStopped });
  if (onStatusChange) subscribeLiveLocationSharingStatus(onStatusChange);
}

/** @deprecated Use clearLiveLocationSharingExtras. */
export function clearLiveLocationSharingCallbacks() {
  clearLiveLocationSharingExtras();
}

/** Restore watcher/Ably if AsyncStorage session is still valid (Settings mount). */
export async function restoreLiveLocationSessionIfActive(extras = {}) {
  bindLiveLocationSharingExtras(extras);
  const storedUntil = await AsyncStorage.getItem(SHARE_LIVE_LOCATION_UNTIL_KEY);
  if (!storedUntil) return false;

  const expiresAt = parseInt(storedUntil, 10);
  if (expiresAt <= Date.now()) {
    await AsyncStorage.removeItem(SHARE_LIVE_LOCATION_UNTIL_KEY);
    notifyStatus(false, null);
    return false;
  }

  notifyStatus(true, new Date(expiresAt));
  const profileId = await AsyncStorage.getItem("profile_uid");
  if (profileId && !ablyChannel) await subscribeAblyNearby(profileId);
  if (locationWatcher) return true;
  await startWatcher(expiresAt);
  return true;
}
