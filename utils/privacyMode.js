import AsyncStorage from "@react-native-async-storage/async-storage";

export const PRIVACY_MODE_KEY = "privacy_mode";

let _enabled = false;

export function isPrivacyModeEnabled() {
  return _enabled;
}

export async function loadPrivacyMode() {
  try {
    const stored = await AsyncStorage.getItem(PRIVACY_MODE_KEY);
    _enabled = stored === "true";
  } catch (_) {
    _enabled = false;
  }
  return _enabled;
}

export async function setPrivacyMode(enabled) {
  _enabled = Boolean(enabled);
  try {
    await AsyncStorage.setItem(PRIVACY_MODE_KEY, String(_enabled));
  } catch (_) {}
}
