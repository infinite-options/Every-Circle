import AsyncStorage from "@react-native-async-storage/async-storage";
import { PROFILE_EXPERTISE_RESPONSE_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "./httpMiddleware";

const storageKey = (profileUid) => `offering_message_responses_${String(profileUid || "").trim()}`;

const nowDatetime = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const rowsToRespondedOfferingsById = (rows) => {
  const byId = {};
  for (const row of rows || []) {
    const expertiseId = String(row.er_profile_expertise_id || row.profile_expertise_id || "").trim();
    if (!expertiseId) continue;
    const respondedAt = row.er_datetime || "";
    const prev = byId[expertiseId];
    if (!prev || String(respondedAt) > String(prev)) {
      byId[expertiseId] = respondedAt;
    }
  }
  return byId;
};

const mergeRespondedMaps = (...maps) => {
  const byId = {};
  for (const map of maps) {
    if (!map || typeof map !== "object") continue;
    for (const [expertiseId, respondedAt] of Object.entries(map)) {
      const id = String(expertiseId || "").trim();
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
    console.warn("[offeringMessageResponse] writeLocalRespondedMap failed:", e);
  }
};

export const fetchMyOfferingMessageResponses = async (profileUid) => {
  const uid = String(profileUid || "").trim();
  if (!uid) return {};

  const localMap = await readLocalRespondedMap(uid);
  let apiMap = {};

  try {
    const res = await fetch(`${PROFILE_EXPERTISE_RESPONSE_ENDPOINT}/${encodeURIComponent(uid)}`);
    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : [];
    apiMap = rowsToRespondedOfferingsById(rows);
  } catch (e) {
    console.warn("[offeringMessageResponse] fetch API failed:", e);
  }

  const merged = mergeRespondedMaps(localMap, apiMap);
  await writeLocalRespondedMap(uid, merged);
  return merged;
};

const extractExpertiseResponseUid = (json) => {
  if (!json || typeof json !== "object") return "";
  const data = json.data;
  const candidates = [
    json.expertise_response_uid,
    json.expertise_response_id,
    data?.expertise_response_uid,
    data?.expertise_response_id,
    Array.isArray(data) ? data[0]?.expertise_response_uid : null,
    Array.isArray(data) ? data[0]?.expertise_response_id : null,
  ];
  for (const value of candidates) {
    const id = String(value || "").trim();
    if (id) return id;
  }
  return "";
};

export const recordOfferingMessageResponse = async (profileExpertiseId, responderId) => {
  const expertiseId = String(profileExpertiseId || "").trim();
  const uid = String(responderId || "").trim();
  if (!expertiseId || !uid) return null;

  const respondedAt = nowDatetime();
  const localMap = await readLocalRespondedMap(uid);
  const prev = localMap[expertiseId];
  if (!prev || String(respondedAt) > String(prev)) {
    localMap[expertiseId] = respondedAt;
    await writeLocalRespondedMap(uid, localMap);
  }

  let expertiseResponseUid = "";
  try {
    const res = await fetch(PROFILE_EXPERTISE_RESPONSE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_expertise_id: expertiseId,
        responder_id: uid,
      }),
    });
    const json = await res.json();
    expertiseResponseUid = extractExpertiseResponseUid(json);
  } catch (e) {
    console.warn("[offeringMessageResponse] record API failed:", e);
  }

  return {
    respondedMap: localMap,
    profile_expertise_uid: expertiseId,
    expertise_response_uid: expertiseResponseUid || null,
  };
};
