import AsyncStorage from "@react-native-async-storage/async-storage";

export const SHARE_LIVE_LOCATION_UNTIL_KEY = "shareLiveLocationUntil";

/** True when Settings → Share Live Location is on and the session has not expired. */
export async function isNearbySharingActive() {
  try {
    const storedUntil = await AsyncStorage.getItem(SHARE_LIVE_LOCATION_UNTIL_KEY);
    if (!storedUntil) return false;
    return parseInt(storedUntil, 10) > Date.now();
  } catch (_) {
    return false;
  }
}
