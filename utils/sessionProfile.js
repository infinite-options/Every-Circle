import AsyncStorage from "@react-native-async-storage/async-storage";
import { USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";

let cachedSessionProfile = null; // { profileUid, businessUids, businessInfo, personalInfo, userEmail, rawProfile }
let inflightProfileRequest = null;

function normalizeBizUids(profileJson) {
  return (profileJson?.business_info || []).map((b) => b.business_uid).filter(Boolean);
}

async function hydrateFromStorage() {
  const profileUid = await AsyncStorage.getItem("profile_uid");
  if (!profileUid) return null;
  let businessUids = [];
  try {
    const raw = await AsyncStorage.getItem("my_business_uids");
    businessUids = JSON.parse(raw || "[]");
    if (!Array.isArray(businessUids)) businessUids = [];
  } catch (_) {
    businessUids = [];
  }
  return {
    profileUid,
    businessUids,
    businessInfo: [],
    personalInfo: null,
    userEmail: null,
    rawProfile: null,
  };
}

async function fetchAndCacheProfile(profileUid) {
  const res = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${profileUid}`);
  const json = await res.json();
  const businessUids = normalizeBizUids(json);
  cachedSessionProfile = {
    profileUid,
    businessUids,
    businessInfo: json?.business_info || [],
    personalInfo: json?.personal_info || null,
    userEmail: json?.user_email || null,
    rawProfile: json || null,
  };
  try {
    await AsyncStorage.setItem("my_business_uids", JSON.stringify(businessUids));
  } catch (_) {}
  return cachedSessionProfile;
}

/**
 * Returns session profile info with request de-duplication.
 * By default it uses cached/storage values first and then refreshes from API.
 */
export async function getSessionProfile({ forceRefresh = false } = {}) {
  if (cachedSessionProfile && !forceRefresh) return cachedSessionProfile;

  if (!cachedSessionProfile) {
    cachedSessionProfile = await hydrateFromStorage();
  }

  const profileUid = cachedSessionProfile?.profileUid;
  if (!profileUid) return null;

  if (!forceRefresh && cachedSessionProfile?.businessUids) {
    // Fire-and-forget refresh to keep cache warm without blocking UI.
    if (!inflightProfileRequest) {
      inflightProfileRequest = fetchAndCacheProfile(profileUid).finally(() => {
        inflightProfileRequest = null;
      });
    }
    return cachedSessionProfile;
  }

  if (inflightProfileRequest) return inflightProfileRequest;
  inflightProfileRequest = fetchAndCacheProfile(profileUid).finally(() => {
    inflightProfileRequest = null;
  });
  return inflightProfileRequest;
}

export function clearSessionProfileCache() {
  cachedSessionProfile = null;
  inflightProfileRequest = null;
}

