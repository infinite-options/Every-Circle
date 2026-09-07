import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { createAblyRealtimeClient } from "./ablyClient";
import { fetchMiddleware as fetch } from "./httpMiddleware";
import { SHARE_LIVE_LOCATION_UNTIL_KEY } from "./nearbySharing";
import { loadNearbySettings } from "./nearbySettings";
import { publishStoredNearbyCoords } from "./nearbyLocationUpdate";

export { SHARE_LIVE_LOCATION_UNTIL_KEY };

export const SHARE_LOCATION_DURATION_HOURS = 1;

export function formatShareLocationDurationLabel() {
  return SHARE_LOCATION_DURATION_HOURS === 1 ? "1 hour" : `${SHARE_LOCATION_DURATION_HOURS} hours`;
}
const SHARE_LOCATION_DISTANCE_METERS = 50;
const SHARE_LOCATION_MIN_PATCH_MINS = 2;

let locationWatcher = null;
let autoOffTimer = null;
let lastPatchedAt = 0;
let lastNotifiedActive = null;
let lastLiveLocationError = null;
let ablyChannel = null;
let nearbyAlertHandler = null;
let notifiedUids = new Set();
/** Settings-only extras (coords, alerts) — status uses statusListeners. */
let sessionExtras = null;
const statusListeners = new Set();

const isWeb = Platform.OS === "web";
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
  if (lastNotifiedActive === active) return;
  lastNotifiedActive = active;
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
    if (Number(result.code) === 200) {
      lastPatchedAt = Date.now();
      lastLiveLocationError = null;
      const coords = { lat, lng, updatedAt: result.updated_at || null };
      publishStoredNearbyCoords(coords);
      sessionExtras?.onCoordsPatched?.(coords);
      return true;
    }
    lastLiveLocationError = result?.message || "Couldn't save your location to the server. Try again.";
    console.warn("[Live location] PATCH nearby failed:", result?.code, result?.message);
  } catch (err) {
    lastLiveLocationError = "Couldn't save your location to the server. Try again.";
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

export function getLastLiveLocationError() {
  return lastLiveLocationError;
}

function messageFromGeoError(err) {
  const code = err && typeof err.code === "number" ? err.code : null;
  if (code === 1) {
    return "Location permission is blocked for this site. Allow location in the browser address bar, then try again.";
  }
  if (code === 2) {
    return "Location is unavailable right now. Try again.";
  }
  if (code === 3) {
    return "Couldn't get a GPS fix in time. Try again.";
  }
  const msg = (err && err.message) || String(err || "");
  if (/denied|permission/i.test(msg)) {
    return "Location permission is blocked for this site. Allow location in the browser address bar, then try again.";
  }
  if (/timeout/i.test(msg)) {
    return "Couldn't get a GPS fix in time. Try again.";
  }
  return "Couldn't update your location. Check location permissions and try again.";
}

function browserGetCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      options,
    );
  });
}

/** First GPS fix. On web this must run before any other awaits so the click still counts as a user gesture. */
async function requestLocationAndGetCoords() {
  if (isWeb) {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const err = new Error("Geolocation is not supported in this browser.");
      err.code = 2;
      throw err;
    }
    try {
      return await browserGetCurrentPosition({
        enableHighAccuracy: false,
        maximumAge: 120000,
        timeout: 25000,
      });
    } catch (first) {
      if (first && first.code === 3) {
        return await browserGetCurrentPosition({
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 30000,
        });
      }
      throw first;
    }
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    const err = new Error("Location permission denied");
    err.code = 1;
    throw err;
  }
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: loc.coords.latitude, lng: loc.coords.longitude };
}

async function getCurrentLatLng() {
  return requestLocationAndGetCoords();
}

async function patchCurrentLiveLocation(profileId) {
  try {
    const { lat, lng } = await getCurrentLatLng();
    return await patchNearbyLocation(profileId, lat, lng, true);
  } catch (e) {
    lastLiveLocationError = messageFromGeoError(e);
    console.warn("[Live location] GPS failed:", lastLiveLocationError);
    return false;
  }
}

function armAutoOffTimer(expiresAt) {
  if (autoOffTimer) {
    clearTimeout(autoOffTimer);
    autoOffTimer = null;
  }
  const timeLeft = expiresAt - Date.now();
  if (timeLeft > 0) {
    autoOffTimer = setTimeout(() => {
      void stopLiveLocationSharing();
    }, timeLeft);
  }
}

async function onWatchPosition(lat, lng) {
  const now = Date.now();
  const storedUntil = await AsyncStorage.getItem(SHARE_LIVE_LOCATION_UNTIL_KEY);
  if (!storedUntil || now > parseInt(storedUntil, 10)) {
    await stopLiveLocationSharing();
    return;
  }
  if (now - lastPatchedAt < SHARE_LOCATION_MIN_PATCH_MINS * 60 * 1000) return;
  const profileId = await AsyncStorage.getItem("profile_uid");
  if (profileId) {
    await patchNearbyLocation(profileId, lat, lng, true);
  }
}

function startWebWatcher(expiresAt) {
  if (!navigator.geolocation) throw new Error("Geolocation is not supported in this browser.");
  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      void onWatchPosition(pos.coords.latitude, pos.coords.longitude);
    },
    (err) => {
      console.warn("[Live location] Browser watchPosition:", err?.message || err);
    },
    { enableHighAccuracy: false, maximumAge: 30000, timeout: 30000 },
  );
  locationWatcher = {
    remove: () => {
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch (_) {}
    },
  };
  armAutoOffTimer(expiresAt);
}

async function ensureWatcher(expiresAt) {
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
  try {
    if (isWeb) startWebWatcher(expiresAt);
    else await startWatcher(expiresAt);
  } catch (e) {
    console.warn("[Live location] Watcher not available:", e?.message || e);
    armAutoOffTimer(expiresAt);
  }
}

async function startWatcher(expiresAt) {
  const sub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: SHARE_LOCATION_DISTANCE_METERS,
    },
    (loc) => {
      void onWatchPosition(loc.coords.latitude, loc.coords.longitude);
    },
  );
  locationWatcher = sub;
  armAutoOffTimer(expiresAt);
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

/** Start live sharing for SHARE_LOCATION_DURATION_HOURS. Asks for GPS first (keeps the web user gesture). */
export async function startLiveLocationSharing() {
  let coords;
  try {
    coords = await requestLocationAndGetCoords();
  } catch (e) {
    lastLiveLocationError = messageFromGeoError(e);
    Alert.alert("Location needed", lastLiveLocationError);
    return false;
  }

  const profileId = await AsyncStorage.getItem("profile_uid");
  if (!profileId) {
    Alert.alert("Error", "No profile found. Please log in again.");
    return false;
  }

  const existingUntil = await AsyncStorage.getItem(SHARE_LIVE_LOCATION_UNTIL_KEY);
  const existingExpiresAt = existingUntil ? parseInt(existingUntil, 10) : 0;
  const expiresAt = existingExpiresAt > Date.now() ? existingExpiresAt : Date.now() + SHARE_LOCATION_DURATION_HOURS * 60 * 60 * 1000;
  await AsyncStorage.setItem(SHARE_LIVE_LOCATION_UNTIL_KEY, String(expiresAt));
  notifyStatus(true, new Date(expiresAt));

  await subscribeAblyNearby(profileId);
  const patched = await patchNearbyLocation(profileId, coords.lat, coords.lng, true);
  await ensureWatcher(expiresAt);
  return patched;
}

/** Attach Settings-only callbacks (coords patch, nearby alerts). Does not affect status listeners. */
export function bindLiveLocationSharingExtras(callbacks = {}) {
  sessionExtras = { ...sessionExtras, ...callbacks };
}

/** Clear Settings-only callbacks when Settings unmounts. Sharing session keeps running.
 *  Alert delivery (onNearbyAlert / isNearbyIgnored / onStopped) is owned by NearbyAlertProvider
 *  and is preserved so banners still work after leaving Settings. */
export function clearLiveLocationSharingExtras() {
  if (!sessionExtras) return;
  const { onNearbyAlert, isNearbyIgnored, onStopped } = sessionExtras;
  sessionExtras = null;
  if (onNearbyAlert || isNearbyIgnored || onStopped) {
    sessionExtras = {
      ...(onNearbyAlert ? { onNearbyAlert } : {}),
      ...(isNearbyIgnored ? { isNearbyIgnored } : {}),
      ...(onStopped ? { onStopped } : {}),
    };
  }
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

/** Re-PATCH GPS while a live-share session is active. Does not notify status (avoids fetch loops). */
export async function refreshLiveLocationIfActive() {
  const storedUntil = await AsyncStorage.getItem(SHARE_LIVE_LOCATION_UNTIL_KEY);
  if (!storedUntil) return false;
  const expiresAt = parseInt(storedUntil, 10);
  if (expiresAt <= Date.now()) return false;
  const profileId = await AsyncStorage.getItem("profile_uid");
  if (!profileId) return false;
  if (!ablyChannel) await subscribeAblyNearby(profileId);
  if (lastPatchedAt && Date.now() - lastPatchedAt < 15000) {
    if (!locationWatcher) await ensureWatcher(expiresAt);
    return true;
  }
  const patched = await patchCurrentLiveLocation(profileId);
  if (!locationWatcher) await ensureWatcher(expiresAt);
  return patched;
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
  if (!profileId) return true;
  if (!ablyChannel) await subscribeAblyNearby(profileId);
  const patched = await patchCurrentLiveLocation(profileId);
  await ensureWatcher(expiresAt);
  return patched;
}
