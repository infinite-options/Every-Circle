import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CONTENT_REPORTS_ENDPOINT,
  MODERATION_OFFERINGS_ENDPOINT,
  MODERATION_OFFERINGS_REVIEW_QUEUE_ENDPOINT,
} from "../apiConfig";
import { fetchMiddleware as fetch } from "./httpMiddleware";

export const MODERATED_ACTIVE = 0;
export const MODERATED_TAKEN_DOWN = 1;
export const MODERATED_PENDING_REVIEW = 2;
export const MODERATED_ACKNOWLEDGED = 3;

export const MODERATION_STATUS = {
  PENDING_REVIEW: "pending_review",
  TAKEN_DOWN: "taken_down",
  REJECTED: "rejected",
  ACKNOWLEDGED: "acknowledged",
};

export const FLAG_REASON_CATEGORIES = [
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "scam_or_fraud", label: "Scam or fraud" },
  { value: "misleading", label: "Misleading information" },
  { value: "harassment", label: "Harassment" },
  { value: "other", label: "Other" },
];

/** Read moderated state from API row or nested moderation object. */
export function getOfferingModeratedState(item) {
  if (!item) return MODERATED_ACTIVE;
  if (item.moderation != null && item.moderation.moderated != null) {
    return Number(item.moderation.moderated) || 0;
  }
  if (item.profile_expertise_moderated != null) {
    return Number(item.profile_expertise_moderated) || 0;
  }
  return MODERATED_ACTIVE;
}

/** Backend status string: pending_review | taken_down | rejected | acknowledged */
export function getModerationStatus(item) {
  const state = getOfferingModeratedState(item);
  if (state === MODERATED_ACKNOWLEDGED) return MODERATION_STATUS.ACKNOWLEDGED;

  const raw = item?.moderation || item;
  const status = raw?.status ?? raw?.resubmissionStatus ?? raw?.resubmission_status;
  if (status) return String(status).toLowerCase();
  if (state === MODERATED_PENDING_REVIEW) return MODERATION_STATUS.PENDING_REVIEW;
  if (state === MODERATED_TAKEN_DOWN) return MODERATION_STATUS.TAKEN_DOWN;
  return null;
}

/** True only when offering is active (moderated === 0) or API explicitly allows edit. */
export function canOfferingBeEdited(item) {
  const mod = item?.moderation;
  if (mod && typeof mod.canEdit === "boolean") return mod.canEdit;
  return getOfferingModeratedState(item) === MODERATED_ACTIVE;
}

export function isOfferingModeratedBlocked(item) {
  const state = getOfferingModeratedState(item);
  return state === MODERATED_TAKEN_DOWN || state === MODERATED_PENDING_REVIEW || state === MODERATED_ACKNOWLEDGED;
}

export function isOfferingVisibilityBlocked(item) {
  return isOfferingModeratedBlocked(item);
}

/** Taken down after an admin rejected the latest resubmission — owner may acknowledge (moderated → 3). */
export function canAcknowledgeTakenDownOffering(item) {
  return getOfferingModeratedState(item) === MODERATED_TAKEN_DOWN && getModerationStatus(item) === MODERATION_STATUS.REJECTED;
}

export function getModerationStatusLabel(item) {
  const status = typeof item === "object" && item != null ? getModerationStatus(item) : null;
  const state = typeof item === "number" ? item : getOfferingModeratedState(item);

  if (status === MODERATION_STATUS.ACKNOWLEDGED || state === MODERATED_ACKNOWLEDGED) return "Acknowledged";
  if (status === MODERATION_STATUS.PENDING_REVIEW) return "Pending admin review";
  if (status === MODERATION_STATUS.REJECTED) return "Rejected";
  if (status === MODERATION_STATUS.TAKEN_DOWN) return "Taken down";
  if (state === MODERATED_PENDING_REVIEW) return "Pending admin review";
  if (state === MODERATED_TAKEN_DOWN) return "Taken down";
  return "Active";
}

export function getModerationOwnerMessage(item) {
  const status = getModerationStatus(item);
  const flagCount = Number(item?.moderation?.flagCount ?? item?.moderation?.flag_count) || 0;
  const rejectionNote = String(item?.moderation?.rejectionNote ?? item?.moderation?.rejection_note ?? "").trim();
  const flagPart = flagCount > 0 ? `${flagCount} user${flagCount === 1 ? "" : "s"} flagged this offering. ` : "";

  if (status === MODERATION_STATUS.ACKNOWLEDGED || getOfferingModeratedState(item) === MODERATED_ACKNOWLEDGED) {
    return "You acknowledged this take-down. The offering has been removed from your profile.";
  }
  if (status === MODERATION_STATUS.REJECTED) {
    const notePart = rejectionNote ? ` Reason: ${rejectionNote}` : "";
    return `This offering was rejected by an admin and remains hidden. Acknowledge the take-down to remove it from your profile, or review the Terms & Conditions.${notePart}`;
  }
  if (status === MODERATION_STATUS.PENDING_REVIEW || getOfferingModeratedState(item) === MODERATED_PENDING_REVIEW) {
    return `${flagPart}This offering is hidden and awaiting admin review. You cannot edit it until an admin decides.`;
  }
  if (status === MODERATION_STATUS.TAKEN_DOWN || getOfferingModeratedState(item) === MODERATED_TAKEN_DOWN) {
    return `${flagPart}This offering has been taken down and is hidden from others. You cannot edit it while it is taken down.`;
  }
  return "";
}

export function normalizeOfferingModeration(exp) {
  if (!exp) return null;
  const moderated = getOfferingModeratedState(exp);
  const raw = exp.moderation || {};
  const status =
    moderated === MODERATED_ACKNOWLEDGED
      ? MODERATION_STATUS.ACKNOWLEDGED
      : raw.status ?? raw.resubmissionStatus ?? raw.resubmission_status ?? null;
  return {
    moderated,
    status,
    canEdit: raw.canEdit ?? raw.can_edit ?? moderated === MODERATED_ACTIVE,
    flagCount: Number(raw.flagCount ?? raw.flag_count) || 0,
    rejectionNote: raw.rejectionNote ?? raw.rejection_note ?? "",
  };
}

/** Normalize GET /moderation/offerings/:uid admin detail payload. */
export function normalizeOfferingReviewDetail(raw) {
  const data = raw?.data ?? raw?.result ?? raw ?? {};
  const offering = data.offering && typeof data.offering === "object" ? data.offering : data;
  const moderation = data.moderation ?? offering?.moderation ?? {};
  const pendingFlags = Array.isArray(data.pendingFlags) ? data.pendingFlags : Array.isArray(data.pending_flags) ? data.pending_flags : [];
  const latestResubmission = data.latestResubmission ?? data.latest_resubmission ?? null;
  const snapshot = latestResubmission?.resubmission_snapshot ?? latestResubmission?.resubmissionSnapshot ?? null;
  return { offering, moderation, pendingFlags, latestResubmission, snapshot };
}

export function getFlagReasonLabel(value) {
  const key = String(value || "").trim();
  const found = FLAG_REASON_CATEGORIES.find((c) => c.value === key);
  return found?.label || key || "Report";
}

export async function submitOfferingFlag({ targetUid, reasonCategory, reasonText }) {
  const reporterProfileUid = ((await AsyncStorage.getItem("profile_uid")) || "").trim();
  if (!reporterProfileUid) {
    throw new Error("Please log in to report an offering.");
  }
  const target_uid = String(targetUid || "").trim();
  if (!target_uid) {
    throw new Error("Offering not found.");
  }

  const response = await fetch(CONTENT_REPORTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reporter_profile_uid: reporterProfileUid,
      target_uid,
      reason_category: reasonCategory,
      reason_text: reasonText || "",
    }),
  });
  const result = await response.json().catch(() => ({}));

  if (response.status === 409) {
    const err = new Error(result.message || "You have already reported this offering.");
    err.code = 409;
    throw err;
  }
  if (!response.ok || (result.code != null && result.code !== 200)) {
    throw new Error(result.message || "Failed to submit report.");
  }
  return result;
}

export async function fetchModerationReviewQueue() {
  const response = await fetch(MODERATION_OFFERINGS_REVIEW_QUEUE_ENDPOINT);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || "Failed to load review queue.");
  }
  const rows = result.data ?? result.result ?? [];
  return Array.isArray(rows) ? rows : [];
}

export async function fetchOfferingModerationDetail(profileExpertiseUid) {
  const uid = encodeURIComponent(String(profileExpertiseUid || "").trim());
  const response = await fetch(`${MODERATION_OFFERINGS_ENDPOINT}/${uid}`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || "Failed to load offering review details.");
  }
  return result.data ?? result.result ?? result;
}

export async function reviewOfferingModeration({ profileExpertiseUid, action, note }) {
  const adminUid = ((await AsyncStorage.getItem("profile_uid")) || "").trim();
  const uid = encodeURIComponent(String(profileExpertiseUid || "").trim());
  const response = await fetch(`${MODERATION_OFFERINGS_ENDPOINT}/${uid}/review`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      admin_uid: adminUid,
      note: note || "",
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || (result.code != null && result.code !== 200)) {
    throw new Error(result.message || "Failed to submit review decision.");
  }
  return result;
}

/** POST acknowledge take-down (moderated 1 + admin-rejected → moderated 3). Idempotent if already acknowledged. */
export async function acknowledgeOfferingModeration({ profileExpertiseUid, profileUid }) {
  const ownerUid = String(profileUid || (await AsyncStorage.getItem("profile_uid")) || "").trim();
  const uid = String(profileExpertiseUid || "").trim();
  if (!ownerUid) {
    throw new Error("Please log in to acknowledge this offering.");
  }
  if (!uid) {
    throw new Error("Offering not found.");
  }

  const response = await fetch(`${MODERATION_OFFERINGS_ENDPOINT}/${encodeURIComponent(uid)}/acknowledge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile_uid: ownerUid }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || (result.code != null && result.code !== 200)) {
    throw new Error(result.message || "Failed to acknowledge offering take-down.");
  }
  return result;
}
