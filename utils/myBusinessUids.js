import AsyncStorage from "@react-native-async-storage/async-storage";

function extractBusinessUids(profileJson) {
  const raw = profileJson?.business_info;
  let list = [];
  if (!raw) return [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") {
    try {
      list = JSON.parse(raw) || [];
    } catch (_) {
      list = [];
    }
  }
  return list.map((b) => b.business_uid).filter(Boolean);
}

/**
 * Persists owned business UIDs from a userprofileinfo-shaped object for Ably unread channels.
 * @returns {Promise<boolean>} true if the stored list changed
 */
export async function persistMyBusinessUidsFromProfile(profileJson) {
  try {
    const uids = extractBusinessUids(profileJson);
    const newJson = JSON.stringify(uids);
    const prev = await AsyncStorage.getItem("my_business_uids");
    if (prev === newJson) return false;
    await AsyncStorage.setItem("my_business_uids", newJson);
    return true;
  } catch (_) {
    return false;
  }
}
