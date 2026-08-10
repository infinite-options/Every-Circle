import AsyncStorage from "@react-native-async-storage/async-storage";

/** Set on logout or login as a different user; consumed by AccountScreen before account-screen/personal GET. */
export const ACCOUNT_SCREEN_PERSONAL_STALE_KEY = "account_screen_personal_stale_v1";

export async function markAccountScreenPersonalStale() {
  try {
    await AsyncStorage.setItem(ACCOUNT_SCREEN_PERSONAL_STALE_KEY, "1");
  } catch (_) {}
}

/** Returns true once per stale mark; clears the flag so a normal tab refocus does not refetch forever. */
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
