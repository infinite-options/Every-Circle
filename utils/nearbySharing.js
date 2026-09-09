import AsyncStorage from "@react-native-async-storage/async-storage";

export const SHARE_LIVE_LOCATION_UNTIL_KEY = "shareLiveLocationUntil";

/** True when Settings → Allow Location-Based Notifications is on and the session has not expired. */
export async function isNearbySharingActive() {
  try {
    const storedUntil = await AsyncStorage.getItem(SHARE_LIVE_LOCATION_UNTIL_KEY);
    if (!storedUntil) return false;
    return parseInt(storedUntil, 10) > Date.now();
  } catch (_) {
    return false;
  }
}
