import AsyncStorage from "@react-native-async-storage/async-storage";
import { SEARCH_REFERRAL_ENDPOINT, REFERRAL_API_ENDPOINT, CIRCLES_ENDPOINT } from "../apiConfig";
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

async function loadCachedReferralNetworkByUid() {
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
      if (u) byUid.set(String(u).trim(), n);
    }
    return byUid;
  } catch {
    return new Map();
  }
}

/** Live circles → related_person_uid → relationship (authoritative for Search badges). */
export async function fetchCircleRelationshipsByUid() {
  const profileUid = ((await AsyncStorage.getItem("profile_uid")) || "").trim();
  if (!profileUid) return new Map();
  try {
    const response = await fetch(`${CIRCLES_ENDPOINT}/${encodeURIComponent(profileUid)}`);
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return new Map();
    const rows = Array.isArray(json?.data) ? json.data : [];
    const byUid = new Map();
    for (const row of rows) {
      const u = String(row.circle_related_person_id || row.profile_personal_uid || row.network_profile_personal_uid || "").trim();
      const rel = row.circle_relationship;
      if (!u || rel == null || String(rel).trim() === "") continue;
      byUid.set(u, {
        network_profile_personal_uid: u,
        circle_relationship: String(rel).trim(),
      });
    }
    return byUid;
  } catch {
    return new Map();
  }
}

/**
 * Same lookup used by Connect & Follow / individual Search for relationship badges.
 * Prefers live circles API, falls back to Network AsyncStorage cache.
 */
export async function loadReferralNetworkByUid() {
  const [cached, live] = await Promise.all([loadCachedReferralNetworkByUid(), fetchCircleRelationshipsByUid()]);
  for (const [uid, node] of live.entries()) {
    cached.set(uid, { ...(cached.get(uid) || {}), ...node });
  }
  return cached;
}

/** Patch individual search result cards with current circle relationships. */
export function enrichSearchItemsWithReferralRelationships(items, networkByUid) {
  if (!Array.isArray(items) || items.length === 0) return items || [];
  if (!networkByUid || typeof networkByUid.get !== "function") return items;

  return items.map((item) => {
    if (item?.itemType !== "individuals") return item;
    const uid = String(item.profile_uid || item.id || "").trim();
    if (!uid) return item;
    const node = networkByUid.get(uid);
    const rel = node?.circle_relationship != null && String(node.circle_relationship).trim() !== "" ? String(node.circle_relationship).trim() : null;
    const prevUser = item.microCardUser || item.profileData || {};
    const microCardUser = {
      ...prevUser,
      relationship: rel,
      circle_relationship: rel,
    };
    return {
      ...item,
      microCardUser,
      profileData: microCardUser,
    };
  });
}

/**
 * Keep Search / referral relationship badges in sync after Profile (or elsewhere)
 * creates, updates, or removes a circle relationship — without waiting for NetworkScreen.
 *
 * @param {string} relatedProfileUid — the other person's profile_personal_uid
 * @param {string|null} relationship — friend|colleague|family, or null to clear
 */
export async function upsertReferralNetworkRelationship(relatedProfileUid, relationship) {
  const uid = String(relatedProfileUid || "").trim();
  if (!uid) return;

  const rel =
    relationship == null || relationship === "null" || String(relationship).trim() === ""
      ? null
      : String(relationship).trim();

  const patchList = (raw) => {
    let list = [];
    try {
      list = JSON.parse(raw || "[]");
    } catch {
      list = [];
    }
    if (!Array.isArray(list)) list = [];

    const idx = list.findIndex((n) => String(n?.network_profile_personal_uid || "").trim() === uid);
    if (rel == null) {
      if (idx >= 0) {
        const next = { ...list[idx], circle_relationship: null };
        if (next.__mc) next.__mc = { ...next.__mc, relationship: null };
        list[idx] = next;
      }
      return list;
    }

    if (idx >= 0) {
      const next = { ...list[idx], circle_relationship: rel };
      if (next.__mc) next.__mc = { ...next.__mc, relationship: rel };
      list[idx] = next;
    } else {
      list.push({
        network_profile_personal_uid: uid,
        circle_relationship: rel,
        degree: 1,
        __mc: { relationship: rel },
      });
    }
    return list;
  };

  try {
    const pairs = await AsyncStorage.multiGet([ASYNC_NETWORK_DATA_CONNECTIONS, ASYNC_NETWORK_DATA_CIRCLES]);
    const connections = patchList(pairs[0]?.[1]);
    const circles = patchList(pairs[1]?.[1]);
    await AsyncStorage.multiSet([
      [ASYNC_NETWORK_DATA_CONNECTIONS, JSON.stringify(connections)],
      [ASYNC_NETWORK_DATA_CIRCLES, JSON.stringify(circles)],
    ]);
  } catch (e) {
    console.warn("upsertReferralNetworkRelationship failed:", e);
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
