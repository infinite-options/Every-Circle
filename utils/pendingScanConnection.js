import AsyncStorage from "@react-native-async-storage/async-storage";
import { addScannedCircleConnection } from "./addScannedCircleConnection";
import { publishNewConnectionOpened } from "./publishNewConnectionOpened";
import { resolveScannerProfileUid } from "./ensureSessionProfileUid";

/** AsyncStorage key for guest QR notes drafted before signup. */
export const PENDING_SCAN_CONNECTION_KEY = "pending_scan_connection";

/** Discard abandoned drafts after this TTL (24 hours). */
export const PENDING_SCAN_CONNECTION_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeDraft(raw) {
  if (!raw || typeof raw !== "object") return null;
  const relatedProfileUid = String(raw.relatedProfileUid || "").trim();
  if (!relatedProfileUid) return null;
  const createdAt = Number(raw.createdAt) || 0;
  return {
    relatedProfileUid,
    relationship: raw.relationship ?? null,
    date: String(raw.date || "").trim(),
    event: String(raw.event || "").trim(),
    note: String(raw.note || "").trim(),
    city: String(raw.city || "").trim(),
    state: String(raw.state || "").trim(),
    introducedBy: String(raw.introducedBy || "").trim(),
    createdAt,
  };
}

function isExpired(draft, now = Date.now()) {
  if (!draft?.createdAt) return true;
  return now - draft.createdAt > PENDING_SCAN_CONNECTION_TTL_MS;
}

/**
 * Persist Connect-with-Me form data before guest auth on /scan/...
 * @param {string} relatedProfileUid - QR owner's profile_uid
 * @param {object} connectionData - fields from ScannedProfilePopup
 */
export async function savePendingScanConnection(relatedProfileUid, connectionData = {}) {
  const uid = String(relatedProfileUid || "").trim();
  if (!uid) return false;
  const draft = {
    relatedProfileUid: uid,
    relationship: connectionData?.relationship ?? null,
    date: String(connectionData?.date || "").trim(),
    event: String(connectionData?.event || "").trim(),
    note: String(connectionData?.note || "").trim(),
    city: String(connectionData?.city || "").trim(),
    state: String(connectionData?.state || "").trim(),
    introducedBy: String(connectionData?.introducedBy || "").trim(),
    createdAt: Date.now(),
  };
  await AsyncStorage.setItem(PENDING_SCAN_CONNECTION_KEY, JSON.stringify(draft));
  return true;
}

/**
 * Load a non-expired draft. Clears storage if missing/invalid/expired.
 * @returns {Promise<object|null>}
 */
export async function loadPendingScanConnection() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_SCAN_CONNECTION_KEY);
    if (!raw) return null;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      await clearPendingScanConnection();
      return null;
    }
    const draft = normalizeDraft(parsed);
    if (!draft || isExpired(draft)) {
      await clearPendingScanConnection();
      return null;
    }
    return draft;
  } catch (e) {
    console.warn("loadPendingScanConnection:", e?.message || e);
    return null;
  }
}

/** True when a valid draft exists for this QR owner. */
export async function hasPendingScanConnectionFor(relatedProfileUid) {
  const draft = await loadPendingScanConnection();
  const uid = String(relatedProfileUid || "").trim();
  return Boolean(draft && uid && draft.relatedProfileUid === uid);
}

export async function clearPendingScanConnection() {
  try {
    await AsyncStorage.removeItem(PENDING_SCAN_CONNECTION_KEY);
  } catch (_) {
    /* ignore */
  }
}

/** Cold start: drop expired drafts only (valid drafts can resume signup). */
export async function discardStalePendingScanConnectionOnLaunch() {
  await loadPendingScanConnection();
}

/**
 * Snapshot referral + pending draft before AsyncStorage.clear().
 * @returns {Promise<{ referralUid: string|null, pendingRaw: string|null }>}
 */
export async function captureEphemeralSignupKeys() {
  let referralUid = null;
  let pendingRaw = null;
  try {
    referralUid = String((await AsyncStorage.getItem("referral_uid")) || "").trim() || null;
  } catch (_) {
    /* ignore */
  }
  try {
    pendingRaw = await AsyncStorage.getItem(PENDING_SCAN_CONNECTION_KEY);
  } catch (_) {
    /* ignore */
  }
  return { referralUid, pendingRaw };
}

/**
 * Restore referral + pending draft after a storage wipe.
 * Prefer explicit referralUidOverride when the scan URL owner is known.
 */
export async function restoreEphemeralSignupKeys({ referralUid, pendingRaw } = {}, referralUidOverride = null) {
  const ref = String(referralUidOverride || referralUid || "").trim() || null;
  if (ref) {
    try {
      await AsyncStorage.setItem("referral_uid", ref);
    } catch (_) {
      /* ignore */
    }
  }
  if (pendingRaw) {
    try {
      const draft = normalizeDraft(JSON.parse(pendingRaw));
      if (draft && !isExpired(draft)) {
        await AsyncStorage.setItem(PENDING_SCAN_CONNECTION_KEY, pendingRaw);
      }
    } catch (_) {
      /* ignore */
    }
  }
}

/**
 * After auth: POST the drafted connection and notify the QR owner (Connect with Me).
 * Does not navigate — callers choose Connect vs Profile.
 *
 * @param {{ scannerIsNewSignup?: boolean, relatedProfileUid?: string }} [options]
 *   When relatedProfileUid is set, only flush if the draft targets that profile.
 * @returns {Promise<{ flushed: boolean, relatedProfileUid?: string, error?: string }>}
 */
export async function flushPendingScanConnectionAfterAuth(options = {}) {
  const draft = await loadPendingScanConnection();
  if (!draft?.relatedProfileUid) {
    return { flushed: false };
  }

  const expectedUid = String(options.relatedProfileUid || "").trim();
  if (expectedUid && draft.relatedProfileUid !== expectedUid) {
    return { flushed: false };
  }

  const scannerProfileUid = await resolveScannerProfileUid();
  if (!scannerProfileUid) {
    return { flushed: false, error: "no_scanner_profile", relatedProfileUid: draft.relatedProfileUid };
  }

  const result = await addScannedCircleConnection(draft.relatedProfileUid, draft);
  if (!result.ok) {
    console.warn("flushPendingScanConnectionAfterAuth: add failed", result.error);
    return { flushed: false, error: result.error || "add_failed", relatedProfileUid: draft.relatedProfileUid };
  }

  try {
    await publishNewConnectionOpened(draft.relatedProfileUid, {
      message: "New Connection",
      scannerProfileUid,
      scannerIsNewSignup: Boolean(options.scannerIsNewSignup),
    });
  } catch (e) {
    console.warn("flushPendingScanConnectionAfterAuth: Ably notify failed", e?.message || e);
  }

  await clearPendingScanConnection();
  return { flushed: true, relatedProfileUid: draft.relatedProfileUid };
}
