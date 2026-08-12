import AsyncStorage from "@react-native-async-storage/async-storage";

/** Set on logout, login, or session cache clear; cleared after a successful account-screen/personal GET. */
export const ACCOUNT_SCREEN_PERSONAL_STALE_KEY = "account_screen_personal_stale_v1";

export async function markAccountScreenPersonalStale() {
  try {
    await AsyncStorage.setItem(ACCOUNT_SCREEN_PERSONAL_STALE_KEY, "1");
  } catch (_) {}
}

/** Read stale flag without clearing (safe to call before deciding whether to skip a fetch). */
export async function peekAccountScreenPersonalStale() {
  try {
    const value = await AsyncStorage.getItem(ACCOUNT_SCREEN_PERSONAL_STALE_KEY);
    return value === "1";
  } catch (_) {}
  return false;
}

/** Clear stale flag after account-screen/personal data was applied for the current profile. */
export async function clearAccountScreenPersonalStale() {
  try {
    await AsyncStorage.removeItem(ACCOUNT_SCREEN_PERSONAL_STALE_KEY);
  } catch (_) {}
}

/** Returns true once per stale mark; clears the flag. Prefer peek + clear on successful fetch. */
export async function consumeAccountScreenPersonalStale() {
  try {
    const value = await AsyncStorage.getItem(ACCOUNT_SCREEN_PERSONAL_STALE_KEY);
    if (value === "1") {
      await AsyncStorage.removeItem(ACCOUNT_SCREEN_PERSONAL_STALE_KEY);
      return true;
    }
  } catch (_) {}
  return false;
}
