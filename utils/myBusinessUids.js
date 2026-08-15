import AsyncStorage from "@react-native-async-storage/async-storage";
import { filterOwnedProfileBusinesses } from "./businessOwnership";

function parseBusinessInfoRaw(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") return [parsed];
      return [];
    } catch (_) {
      return [];
    }
  }
  if (typeof raw === "object") return [raw];
  return [];
}

function extractOwnedBusinessUids(profileJson) {
  return filterOwnedProfileBusinesses(parseBusinessInfoRaw(profileJson?.business_info))
    .map((b) => b.business_uid)
    .filter(Boolean);
}

/**
 * Persists owned business UIDs from a userprofileinfo-shaped object for Ably unread channels.
 * Excludes reviewer-seeded `unclaimed` links.
 * @returns {Promise<boolean>} true if the stored list changed
 */
export async function persistMyBusinessUidsFromProfile(profileJson) {
  try {
    const uids = extractOwnedBusinessUids(profileJson);
    const newJson = JSON.stringify(uids);
    const prev = await AsyncStorage.getItem("my_business_uids");
    if (prev === newJson) return false;
    await AsyncStorage.setItem("my_business_uids", newJson);
    return true;
  } catch (_) {
    return false;
  }
}
