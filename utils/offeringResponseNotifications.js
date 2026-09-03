import AsyncStorage from "@react-native-async-storage/async-storage";

const storageKey = (profileUid) => `offering_responses_seen_${String(profileUid || "").trim()}`;

const readSeenMap = async (profileUid) => {
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

const writeSeenMap = async (profileUid, map) => {
  const uid = String(profileUid || "").trim();
  if (!uid) return;
  try {
    await AsyncStorage.setItem(storageKey(uid), JSON.stringify(map || {}));
  } catch (e) {
    console.warn("[offeringResponseNotifications] writeSeenMap failed:", e);
  }
};

/**
 * Given a profile owner's uid and their list of offerings (each with
 * profile_expertise_uid + expertise_responses), returns the uids of offerings
 * that have responses the owner hasn't seen yet (see markOfferingResponsesSeen).
 * Used to drive the "new response" notification banner at the top of Profile.
 */
export const getOfferingUidsWithNewResponses = async (profileUid, offerings) => {
  const uid = String(profileUid || "").trim();
  if (!uid || !Array.isArray(offerings) || offerings.length === 0) return [];
  const seenMap = await readSeenMap(uid);
  const newUids = [];
  for (const offering of offerings) {
    const offeringUid = String(offering?.profile_expertise_uid || "").trim();
    if (!offeringUid) continue;
    const responseCount = Number(offering?.expertise_responses) || 0;
    const seenCount = Number(seenMap[offeringUid]) || 0;
    if (responseCount > seenCount) newUids.push(offeringUid);
  }
  return newUids;
};

/**
 * Call once the owner has viewed an offering's responses (e.g. on OfferingResponsesScreen),
 * so the notification stops counting responses they've already seen. `seenCount` should be
 * the number of responses actually shown to them (never decreases the stored count).
 */
export const markOfferingResponsesSeen = async (profileUid, offeringUid, seenCount) => {
  const uid = String(profileUid || "").trim();
  const oUid = String(offeringUid || "").trim();
  if (!uid || !oUid) return;
  const count = Number(seenCount) || 0;
  const seenMap = await readSeenMap(uid);
  const prev = Number(seenMap[oUid]) || 0;
  if (count > prev) {
    seenMap[oUid] = count;
    await writeSeenMap(uid, seenMap);
  }
};

