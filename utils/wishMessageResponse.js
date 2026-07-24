import AsyncStorage from "@react-native-async-storage/async-storage";
import { PROFILE_WISH_RESPONSE_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "./httpMiddleware";

const storageKey = (profileUid) => `wish_message_responses_${String(profileUid || "").trim()}`;

const nowDatetime = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const rowsToRespondedWishesById = (rows) => {
  const byId = {};
  for (const row of rows || []) {
    const wishId = String(row.wr_profile_wish_id || row.profile_wish_id || "").trim();
    if (!wishId) continue;
    const respondedAt = row.wr_datetime || "";
    const prev = byId[wishId];
    if (!prev || String(respondedAt) > String(prev)) {
      byId[wishId] = respondedAt;
    }
  }
  return byId;
};

const mergeRespondedMaps = (...maps) => {
  const byId = {};
  for (const map of maps) {
    if (!map || typeof map !== "object") continue;
    for (const [wishId, respondedAt] of Object.entries(map)) {
      const id = String(wishId || "").trim();
      if (!id) continue;
      const prev = byId[id];
      if (!prev || String(respondedAt) > String(prev)) {
        byId[id] = respondedAt;
      }
    }
  }
  return byId;
};

const readLocalRespondedMap = async (profileUid) => {
  const uid = String(profileUid || "").trim();
  if (!uid) return {};
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeLocalRespondedMap = async (profileUid, map) => {
  const uid = String(profileUid || "").trim();
  if (!uid) return;
  try {
    await AsyncStorage.setItem(storageKey(uid), JSON.stringify(map || {}));
  } catch (e) {
    console.warn("[wishMessageResponse] writeLocalRespondedMap failed:", e);
  }
};

export const fetchMyWishMessageResponses = async (profileUid) => {
  const uid = String(profileUid || "").trim();
  if (!uid) return {};

  const localMap = await readLocalRespondedMap(uid);
  let apiMap = {};

  try {
    const res = await fetch(`${PROFILE_WISH_RESPONSE_ENDPOINT}/${encodeURIComponent(uid)}`);
    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : [];
    apiMap = rowsToRespondedWishesById(rows);
  } catch (e) {
    console.warn("[wishMessageResponse] fetch API failed:", e);
  }

  const merged = mergeRespondedMaps(localMap, apiMap);
  await writeLocalRespondedMap(uid, merged);
  return merged;
};

const extractWishResponseUid = (json) => {
  if (!json || typeof json !== "object") return "";
  const data = json.data;
  const candidates = [
    json.wish_response_uid,
    json.wish_response_id,
    data?.wish_response_uid,
    data?.wish_response_id,
    Array.isArray(data) ? data[0]?.wish_response_uid : null,
    Array.isArray(data) ? data[0]?.wish_response_id : null,
  ];
  for (const value of candidates) {
    const id = String(value || "").trim();
    if (id) return id;
  }
  return "";
};

/** Record a seeking/wish response locally and attempt API persistence (mirrors offerings). */
export const recordWishMessageResponse = async (profileWishId, responderId) => {
  const wishId = String(profileWishId || "").trim();
  const uid = String(responderId || "").trim();
  if (!wishId || !uid) return null;

  const respondedAt = nowDatetime();
  const localMap = await readLocalRespondedMap(uid);
  const prev = localMap[wishId];
  if (!prev || String(respondedAt) > String(prev)) {
    localMap[wishId] = respondedAt;
    await writeLocalRespondedMap(uid, localMap);
  }

  let wishResponseUid = "";
  try {
    const res = await fetch(PROFILE_WISH_RESPONSE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_wish_id: wishId,
        responder_id: uid,
      }),
    });
    const json = await res.json();
    wishResponseUid = extractWishResponseUid(json);
  } catch (e) {
    console.warn("[wishMessageResponse] record API failed:", e);
  }

  return {
    respondedMap: localMap,
    profile_wish_uid: wishId,
    wish_response_uid: wishResponseUid || null,
  };
};
