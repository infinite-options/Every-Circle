import AsyncStorage from "@react-native-async-storage/async-storage";
import { SEARCH_REFERRAL_ENDPOINT, REFERRAL_API_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "./httpMiddleware";
import { sanitizeText } from "./textSanitizer";
import { isProfileVisibilityBlocked } from "./profileModeration";

const ASYNC_NETWORK_DATA_CONNECTIONS = "network_data_connections";
const ASYNC_NETWORK_DATA_CIRCLES = "network_data_circles";

function mergeNetworkNodesForReferral(connectionsList, circlesList) {
  const score = (n) => {
    let s = 0;
    const rel = n.circle_relationship;
    if (rel != null && String(rel).trim() !== "") s += 2;
    if (n.degree != null && String(n.degree).trim() !== "") s += 1;
    return s;
  };
  const pick = (a, b) => (score(b) > score(a) ? b : a);
  const map = new Map();
  for (const n of connectionsList || []) {
    const u = n.network_profile_personal_uid;
    if (u) map.set(u, n);
  }
  for (const n of circlesList || []) {
    const u = n.network_profile_personal_uid;
    if (!u) continue;
    map.set(u, map.has(u) ? pick(map.get(u), n) : n);
  }
  return Array.from(map.values());
}

/** Same lookup used by Connect & Follow (ReferralSearch) for relationship badges. */
export async function loadReferralNetworkByUid() {
  try {
    const pairs = await AsyncStorage.multiGet([ASYNC_NETWORK_DATA_CONNECTIONS, ASYNC_NETWORK_DATA_CIRCLES]);
    const connections = JSON.parse(pairs[0]?.[1] || "[]");
    const circles = JSON.parse(pairs[1]?.[1] || "[]");
    const merged = mergeNetworkNodesForReferral(
      Array.isArray(connections) ? connections : [],
      Array.isArray(circles) ? circles : [],
    );
    const byUid = new Map();
    for (const n of merged) {
      const u = n.network_profile_personal_uid;
      if (u) byUid.set(u, n);
    }
    return byUid;
  } catch {
    return new Map();
  }
}

/** Email, city/state, or name search — same endpoints as Connect & Follow. */
export async function searchReferralProfiles(query) {
  const trimmedQuery = String(query || "").trim();
  if (trimmedQuery.length < 2) return [];

  if (trimmedQuery.includes("@")) {
    const email = trimmedQuery.toLowerCase();
    const response = await fetch(REFERRAL_API_ENDPOINT + encodeURIComponent(email));
    const data = await response.json();
    const profile = data.personal_info;
    if (!profile?.profile_personal_uid) return [];
    if (
      isProfileVisibilityBlocked({
        profile_personal_moderated: profile?.profile_personal_moderated,
        moderation: profile?.moderation,
      })
    ) {
      return [];
    }
    return [profile];
  }

  const url = `${SEARCH_REFERRAL_ENDPOINT}?query=${encodeURIComponent(trimmedQuery)}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.code === 200) {
    return (data.results || []).filter((profile) =>
      !isProfileVisibilityBlocked({
        profile_personal_moderated: profile?.profile_personal_moderated,
        moderation: profile?.moderation,
      }),
    );
  }
  return [];
}

export function mapReferralProfileToMicroCardUser(profile, networkNode = null) {
  const firstName = sanitizeText(profile.profile_personal_first_name || "");
  const lastName = sanitizeText(profile.profile_personal_last_name || "");
  const tagLine = sanitizeText(profile.profile_personal_tag_line || profile.profile_personal_tagline || "");
  const profileImage = sanitizeText(profile.profile_personal_image || "");
  const hasImage = profileImage && profileImage !== "." && profileImage.trim() !== "";

  return {
    firstName,
    lastName,
    tagLine,
    city: sanitizeText(profile.profile_personal_city || ""),
    state: sanitizeText(profile.profile_personal_state || ""),
    profileImage,
    relationship: networkNode?.circle_relationship || null,
    imageIsPublic: hasImage || profile.profile_personal_image_is_public === 1 || profile.profile_personal_image_is_public === "1",
    tagLineIsPublic:
      profile.profile_personal_tag_line_is_public === 1 ||
      profile.profile_personal_tag_line_is_public === "1" ||
      profile.profile_personal_tagline_is_public === 1 ||
      profile.profile_personal_tagline_is_public === "1",
    personal_info: profile,
  };
}

export function mapReferralProfileToSearchItem(profile, networkNode = null) {
  const uid = profile.profile_personal_uid;
  const microCardUser = mapReferralProfileToMicroCardUser(profile, networkNode);
  const displayName = [microCardUser.firstName, microCardUser.lastName].filter(Boolean).join(" ").trim() || "Unknown";

  return {
    id: uid,
    profile_uid: uid,
    itemType: "individuals",
    company: displayName,
    microCardUser,
    profileData: microCardUser,
    profile_personal_moderated: profile.profile_personal_moderated,
    moderation: profile.moderation,
  };
}
