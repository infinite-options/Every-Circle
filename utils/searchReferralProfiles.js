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

async function loadCachedReferralNetworkNodes() {
  try {
    const pairs = await AsyncStorage.multiGet([ASYNC_NETWORK_DATA_CONNECTIONS, ASYNC_NETWORK_DATA_CIRCLES]);
    const connections = JSON.parse(pairs[0]?.[1] || "[]");
    const circles = JSON.parse(pairs[1]?.[1] || "[]");
    return mergeNetworkNodesForReferral(
      Array.isArray(connections) ? connections : [],
      Array.isArray(circles) ? circles : [],
    );
  } catch {
    return [];
  }
}

async function loadCachedReferralNetworkByUid() {
  try {
    const merged = await loadCachedReferralNetworkNodes();
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

function circleRowToNetworkFields(row) {
  const u = String(row.circle_related_person_id || row.profile_personal_uid || row.network_profile_personal_uid || "").trim();
  if (!u) return null;
  return {
    network_profile_personal_uid: u,
    circle_relationship: row.circle_relationship != null && String(row.circle_relationship).trim() !== "" ? String(row.circle_relationship).trim() : null,
    circle_date: row.circle_date ?? null,
    circle_event: row.circle_event ?? null,
    circle_note: row.circle_note ?? null,
    circle_introduced_by: row.circle_introduced_by ?? null,
    circle_city: row.circle_city ?? null,
    circle_state: row.circle_state ?? null,
    circle_geotag: row.circle_geotag ?? null,
    profile_personal_joined_timestamp: row.profile_personal_joined_timestamp ?? null,
  };
}

function mergeReferralCircleFieldsIntoUser(prevUser, node) {
  if (!node) return prevUser;
  return {
    ...prevUser,
    relationship: node.circle_relationship ?? prevUser.relationship ?? null,
    circle_relationship: node.circle_relationship ?? prevUser.circle_relationship ?? null,
    circle_date: node.circle_date ?? prevUser.circle_date ?? null,
    circle_event: node.circle_event ?? prevUser.circle_event ?? null,
    circle_note: node.circle_note ?? prevUser.circle_note ?? null,
    circle_introduced_by: node.circle_introduced_by ?? prevUser.circle_introduced_by ?? null,
    circle_city: node.circle_city ?? prevUser.circle_city ?? null,
    circle_state: node.circle_state ?? prevUser.circle_state ?? null,
    circle_geotag: node.circle_geotag ?? prevUser.circle_geotag ?? null,
    profile_personal_joined_timestamp:
      node.profile_personal_joined_timestamp ??
      prevUser.profile_personal_joined_timestamp ??
      prevUser.personal_info?.profile_personal_joined_timestamp ??
      null,
  };
}

function referralSearchTokens(query) {
  return String(query || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/** Same searchable fields as Connect → applyConnectionFilters text search. */
export function networkNodeMatchesReferralSearch(node, query) {
  const tokens = referralSearchTokens(query);
  if (tokens.length === 0) return false;

  const mc = node?.__mc || {};
  const searchableText = [
    mc.firstName,
    mc.lastName,
    `${mc.firstName || ""} ${mc.lastName || ""}`.trim(),
    mc.tagLine,
    mc.city,
    mc.state,
    mc.phoneNumber,
    mc.email,
    node.circle_city,
    node.circle_state,
    node.circle_event,
    node.circle_note,
    node.circle_introduced_by,
    node.circle_relationship,
    node.circle_date,
    node.circle_geotag,
    node.profile_personal_first_name,
    node.profile_personal_last_name,
    node.profile_personal_tag_line,
    node.profile_personal_tagline,
    node.profile_personal_city,
    node.profile_personal_state,
    node.profile_personal_phone_number,
    node.user_email_id,
    node.profile_email_id,
    node.network_profile_personal_uid,
  ]
    .join(" ")
    .toLowerCase();

  return tokens.every((token) => searchableText.includes(token));
}

function networkNodeToReferralProfile(node) {
  const mc = node?.__mc || {};
  const uid = String(node.network_profile_personal_uid || node.circle_related_person_id || node.profile_personal_uid || "").trim();
  if (!uid) return null;

  return {
    profile_personal_uid: uid,
    profile_personal_first_name: mc.firstName || node.profile_personal_first_name || "",
    profile_personal_last_name: mc.lastName || node.profile_personal_last_name || "",
    profile_personal_tag_line: mc.tagLine || node.profile_personal_tag_line || node.profile_personal_tagline || "",
    profile_personal_city: mc.city || node.profile_personal_city || node.circle_city || "",
    profile_personal_state: mc.state || node.profile_personal_state || node.circle_state || "",
    profile_personal_image: mc.profileImage || node.profile_personal_image || "",
    profile_personal_phone_number: mc.phoneNumber || node.profile_personal_phone_number || "",
    profile_email_id: mc.email || node.user_email_id || node.profile_email_id || "",
    profile_personal_tag_line_is_public: node.profile_personal_tag_line_is_public ?? mc.tagLineIsPublic,
    profile_personal_image_is_public: node.profile_personal_image_is_public ?? mc.imageIsPublic,
    profile_personal_phone_number_is_public: node.profile_personal_phone_number_is_public ?? mc.phoneIsPublic,
    profile_personal_location_is_public: node.profile_personal_location_is_public ?? mc.locationIsPublic,
    profile_personal_moderated: node.profile_personal_moderated ?? node.profile_moderated,
    profile_moderated: node.profile_moderated ?? node.profile_personal_moderated,
    moderation: node.moderation,
    __referral_network_node: node,
  };
}

function mergeReferralProfileResults(apiProfiles, localProfiles) {
  const merged = [];
  const seen = new Set();
  for (const profile of [...(apiProfiles || []), ...(localProfiles || [])]) {
    const uid = String(profile?.profile_personal_uid || "").trim();
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    merged.push(profile);
  }
  return merged;
}

async function searchReferralProfilesFromNetworkCache(query) {
  const nodes = await loadCachedReferralNetworkNodes();
  const matches = [];
  const seen = new Set();
  for (const node of nodes) {
    if (!networkNodeMatchesReferralSearch(node, query)) continue;
    const profile = networkNodeToReferralProfile(node);
    const uid = profile?.profile_personal_uid;
    if (!uid || seen.has(uid) || isProfileVisibilityBlocked(profile)) continue;
    seen.add(uid);
    matches.push(profile);
  }
  return matches;
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
      const fields = circleRowToNetworkFields(row);
      if (!fields) continue;
      const u = fields.network_profile_personal_uid;
      byUid.set(u, { ...(byUid.get(u) || {}), ...row, ...fields });
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

/** Profile + connection metadata search — same scope as Connect text search. */
export async function searchReferralProfiles(query) {
  const trimmedQuery = String(query || "").trim();
  if (trimmedQuery.length < 2) return [];

  if (trimmedQuery.includes("@")) {
    const email = trimmedQuery.toLowerCase();
    const response = await fetch(REFERRAL_API_ENDPOINT + encodeURIComponent(email));
    const data = await response.json();
    const profile = data.personal_info;
    if (!profile?.profile_personal_uid) return [];
    // Pass full row so alternate fields (profile_moderated, status strings) are honored.
    if (isProfileVisibilityBlocked(profile)) {
      return [];
    }
    return [profile];
  }

  const profileUid = ((await AsyncStorage.getItem("profile_uid")) || "").trim();
  const params = new URLSearchParams({ query: trimmedQuery });
  if (profileUid) params.set("profile_uid", profileUid);

  const [response, localMatches] = await Promise.all([
    fetch(`${SEARCH_REFERRAL_ENDPOINT}?${params.toString()}`),
    searchReferralProfilesFromNetworkCache(trimmedQuery),
  ]);
  const data = await response.json();
  const apiProfiles = data.code === 200 ? (data.results || []).filter((profile) => !isProfileVisibilityBlocked(profile)) : [];
  return mergeReferralProfileResults(apiProfiles, localMatches);
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
    const prevUser = item.microCardUser || item.profileData || {};
    const microCardUser = mergeReferralCircleFieldsIntoUser(prevUser, node);
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

/** Multi-select circle chips for Individuals search (empty selection = any/all). */
export const INDIVIDUAL_CIRCLE_FILTER_OPTIONS = [
  { key: "Family", label: "Family" },
  { key: "Colleagues", label: "Colleagues" },
  { key: "Friends", label: "Friends" },
];

const CIRCLE_SORT_ORDER = { family: 0, colleague: 1, friend: 2 };
const VALID_CIRCLE_FILTER_KEYS = new Set(INDIVIDUAL_CIRCLE_FILTER_OPTIONS.map((o) => o.key));

function normalizeCircleRelationship(item) {
  const raw =
    item?.microCardUser?.relationship ??
    item?.microCardUser?.circle_relationship ??
    item?.profileData?.relationship ??
    item?.profileData?.circle_relationship ??
    item?.circle_relationship ??
    null;
  if (raw == null || String(raw).trim() === "") return null;
  return String(raw).trim().toLowerCase();
}

function circleFilterKeyToRelationship(key) {
  if (key === "Family") return "family";
  if (key === "Colleagues") return "colleague";
  if (key === "Friends") return "friend";
  return null;
}

function displayNameForIndividual(item) {
  const user = item?.microCardUser || item?.profileData || {};
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || item?.company || "";
}

/** Normalize restored/legacy state to a multi-select key array. */
export function normalizeIndividualCircleFilter(value) {
  if (Array.isArray(value)) {
    return value.filter((k) => VALID_CIRCLE_FILTER_KEYS.has(k));
  }
  if (typeof value === "string" && VALID_CIRCLE_FILTER_KEYS.has(value)) {
    return [value];
  }
  return [];
}

export function getIndividualCircleFilterLabel(selectedKeys) {
  const keys = normalizeIndividualCircleFilter(selectedKeys);
  if (keys.length === 0) return "Circles";
  if (keys.length === 1) return keys[0];
  if (keys.length === INDIVIDUAL_CIRCLE_FILTER_OPTIONS.length) return "All circles";
  return keys.join(", ");
}

/** Parse circle_date / YYYY-MM-DD (or datetime prefix) to local calendar Date at midnight. */
export function parseIndividualFilterDate(value) {
  if (value == null || value === "") return null;
  const trimmed = String(value).trim();
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formatIndividualFilterDateLabel(ymd) {
  const d = parseIndividualFilterDate(ymd);
  if (!d) return "Any";
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;
}

export function toIndividualFilterYmd(date) {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getIndividualFilterDateRaw(item) {
  const user = item?.microCardUser || item?.profileData || {};
  return user.circle_date ?? user.profile_personal_joined_timestamp ?? user.personal_info?.profile_personal_joined_timestamp ?? null;
}

function individualPassesDateFilter(item, dateFrom, dateTo) {
  const fromDate = parseIndividualFilterDate(dateFrom);
  const toDate = parseIndividualFilterDate(dateTo);
  if (!fromDate && !toDate) return true;

  const circleDate = parseIndividualFilterDate(getIndividualFilterDateRaw(item));
  if (!circleDate) return false;
  if (fromDate && circleDate < fromDate) return false;
  if (toDate && circleDate > toDate) return false;
  return true;
}

export function getIndividualDateFilterLabel(dateFrom = "", dateTo = "") {
  const from = String(dateFrom || "").trim();
  const to = String(dateTo || "").trim();
  if (!from && !to) return "Date";
  if (from && to) return `${formatIndividualFilterDateLabel(from)} – ${formatIndividualFilterDateLabel(to)}`;
  if (from) return `After ${formatIndividualFilterDateLabel(from)}`;
  return `Before ${formatIndividualFilterDateLabel(to)}`;
}

export function hasActiveIndividualDateFilter(dateFrom = "", dateTo = "") {
  return Boolean(String(dateFrom || "").trim() || String(dateTo || "").trim());
}

/** Client-side circle + date filters + sort for Individuals search (no API round-trip). */
export function applyIndividualSearchFilters(items, { circleFilter = [], dateFrom = "", dateTo = "" } = {}) {
  if (!Array.isArray(items) || items.length === 0) return items || [];

  const selectedKeys = normalizeIndividualCircleFilter(circleFilter);
  const targetRels = new Set(selectedKeys.map(circleFilterKeyToRelationship).filter(Boolean));
  const useCircleFilter = targetRels.size > 0;
  const useDateFilter = hasActiveIndividualDateFilter(dateFrom, dateTo);

  let filtered = items;
  if (useCircleFilter) {
    filtered = filtered.filter((item) => targetRels.has(normalizeCircleRelationship(item)));
  }
  if (useDateFilter) {
    filtered = filtered.filter((item) => individualPassesDateFilter(item, dateFrom, dateTo));
  }

  return [...filtered].sort((a, b) => {
    if (!useCircleFilter || targetRels.size > 1) {
      const aRel = normalizeCircleRelationship(a);
      const bRel = normalizeCircleRelationship(b);
      const aRank = aRel != null && CIRCLE_SORT_ORDER[aRel] != null ? CIRCLE_SORT_ORDER[aRel] : 3;
      const bRank = bRel != null && CIRCLE_SORT_ORDER[bRel] != null ? CIRCLE_SORT_ORDER[bRel] : 3;
      if (aRank !== bRank) return aRank - bRank;
    }
    return displayNameForIndividual(a).localeCompare(displayNameForIndividual(b), undefined, { sensitivity: "base" });
  });
}

/** @deprecated Use applyIndividualSearchFilters */
export function applyIndividualCircleFilterAndSort(items, circleFilter = []) {
  return applyIndividualSearchFilters(items, { circleFilter });
}

export function mapReferralProfileToMicroCardUser(profile, networkNode = null) {
  const firstName = sanitizeText(profile.profile_personal_first_name || "");
  const lastName = sanitizeText(profile.profile_personal_last_name || "");
  const tagLine = sanitizeText(profile.profile_personal_tag_line || profile.profile_personal_tagline || "");
  const profileImage = sanitizeText(profile.profile_personal_image || "");
  const hasImage = profileImage && profileImage !== "." && profileImage.trim() !== "";
  const node = networkNode || profile.__referral_network_node || null;

  const base = {
    firstName,
    lastName,
    tagLine,
    city: sanitizeText(profile.profile_personal_city || node?.circle_city || ""),
    state: sanitizeText(profile.profile_personal_state || node?.circle_state || ""),
    profileImage,
    relationship: networkNode?.circle_relationship || node?.circle_relationship || null,
    imageIsPublic: hasImage || profile.profile_personal_image_is_public === 1 || profile.profile_personal_image_is_public === "1",
    tagLineIsPublic:
      profile.profile_personal_tag_line_is_public === 1 ||
      profile.profile_personal_tag_line_is_public === "1" ||
      profile.profile_personal_tagline_is_public === 1 ||
      profile.profile_personal_tagline_is_public === "1",
    personal_info: profile,
  };

  return mergeReferralCircleFieldsIntoUser(base, node);
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
    profile_personal_moderated: profile.profile_personal_moderated ?? profile.profile_moderated ?? null,
    profile_moderated: profile.profile_moderated ?? profile.profile_personal_moderated ?? null,
    moderation: profile.moderation,
  };
}
