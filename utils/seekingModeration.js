import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CONTENT_REPORTS_ENDPOINT,
  MODERATION_SEEKING_ENDPOINT,
  MODERATION_SEEKING_REVIEW_QUEUE_ENDPOINT,
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
export function getSeekingModeratedState(item) {
  if (!item) return MODERATED_ACTIVE;
  if (item.moderation != null && item.moderation.moderated != null) {
    return Number(item.moderation.moderated) || 0;
  }
  if (item.profile_wish_moderated != null) {
    return Number(item.profile_wish_moderated) || 0;
  }
  return MODERATED_ACTIVE;
}

function getRawModerationFields(item) {
  const raw = item?.moderation || item || {};
  return {
    status: String(raw?.status ?? "").trim().toLowerCase(),
    resubmissionStatus: String(raw?.resubmissionStatus ?? raw?.resubmission_status ?? "").trim().toLowerCase(),
    rejectionNote: String(raw?.rejectionNote ?? raw?.rejection_note ?? raw?.resubmissionAdminNote ?? raw?.resubmission_admin_note ?? "").trim(),
  };
}

/** True when an admin rejected the post (may appear as status or resubmissionStatus). */
export function isSeekingAdminRejected(item) {
  const { status, resubmissionStatus } = getRawModerationFields(item);
  return status === MODERATION_STATUS.REJECTED || resubmissionStatus === MODERATION_STATUS.REJECTED;
}

/** Backend status string: pending_review | taken_down | rejected | acknowledged */
export function getSeekingModerationStatus(item) {
  const state = getSeekingModeratedState(item);
  if (state === MODERATED_ACKNOWLEDGED) return MODERATION_STATUS.ACKNOWLEDGED;

  const { status, resubmissionStatus } = getRawModerationFields(item);
  if (resubmissionStatus === MODERATION_STATUS.REJECTED) return MODERATION_STATUS.REJECTED;
  if (status) return status;
  if (state === MODERATED_PENDING_REVIEW) return MODERATION_STATUS.PENDING_REVIEW;
  if (state === MODERATED_TAKEN_DOWN) return MODERATION_STATUS.TAKEN_DOWN;
  return null;
}

/** True only when seeking post is active (moderated === 0) or API explicitly allows edit. */
export function canSeekingBeEdited(item) {
  const mod = item?.moderation;
  if (mod && typeof mod.canEdit === "boolean") return mod.canEdit;
  return getSeekingModeratedState(item) === MODERATED_ACTIVE;
}

export function isSeekingModeratedBlocked(item) {
  const state = getSeekingModeratedState(item);
  return state === MODERATED_TAKEN_DOWN || state === MODERATED_PENDING_REVIEW || state === MODERATED_ACKNOWLEDGED;
}

export function isSeekingVisibilityBlocked(item) {
  return isSeekingModeratedBlocked(item);
}

/** Taken down after an admin rejected — owner may acknowledge (moderated → 3). */
export function canAcknowledgeTakenDownSeeking(item) {
  return getSeekingModeratedState(item) === MODERATED_TAKEN_DOWN && isSeekingAdminRejected(item);
}

export function getSeekingModerationStatusLabel(item) {
  const status = typeof item === "object" && item != null ? getSeekingModerationStatus(item) : null;
  const state = typeof item === "number" ? item : getSeekingModeratedState(item);

  if (status === MODERATION_STATUS.ACKNOWLEDGED || state === MODERATED_ACKNOWLEDGED) return "Acknowledged";
  if (status === MODERATION_STATUS.PENDING_REVIEW) return "Pending admin review";
  if (status === MODERATION_STATUS.REJECTED) return "Rejected";
  if (status === MODERATION_STATUS.TAKEN_DOWN) return "Taken down";
  if (state === MODERATED_PENDING_REVIEW) return "Pending admin review";
  if (state === MODERATED_TAKEN_DOWN) return "Taken down";
  return "Active";
}

export function getSeekingModerationOwnerMessage(item) {
  const status = getSeekingModerationStatus(item);
  const flagCount = Number(item?.moderation?.flagCount ?? item?.moderation?.flag_count) || 0;
  const rejectionNote = String(item?.moderation?.rejectionNote ?? item?.moderation?.rejection_note ?? "").trim();
  const flagPart = flagCount > 0 ? `${flagCount} user${flagCount === 1 ? "" : "s"} flagged this seeking post. ` : "";

  if (status === MODERATION_STATUS.ACKNOWLEDGED || getSeekingModeratedState(item) === MODERATED_ACKNOWLEDGED) {
    return "You acknowledged this take-down. The seeking post has been removed from your profile.";
  }
  if (status === MODERATION_STATUS.REJECTED) {
    const notePart = rejectionNote ? ` Reason: ${rejectionNote}` : "";
    return `This seeking post was rejected by an admin and remains hidden. Acknowledge the take-down to remove it from your profile, or review the Terms & Conditions.${notePart}`;
  }
  if (status === MODERATION_STATUS.PENDING_REVIEW || getSeekingModeratedState(item) === MODERATED_PENDING_REVIEW) {
    return `${flagPart}This seeking post is hidden and awaiting admin review. You cannot edit it until an admin decides.`;
  }
  if (status === MODERATION_STATUS.TAKEN_DOWN || getSeekingModeratedState(item) === MODERATED_TAKEN_DOWN) {
    return `${flagPart}This seeking post has been taken down and is hidden from others. You cannot edit it while it is taken down.`;
  }
  return "";
}

export function normalizeSeekingModeration(wish) {
  if (!wish) return null;
  const moderated = getSeekingModeratedState(wish);
  const raw = wish.moderation || {};
  const status =
    moderated === MODERATED_ACKNOWLEDGED
      ? MODERATION_STATUS.ACKNOWLEDGED
      : raw.status ?? raw.resubmissionStatus ?? raw.resubmission_status ?? null;
  const reports = Array.isArray(raw.reports) ? raw.reports : Array.isArray(raw.pendingFlags) ? raw.pendingFlags : [];
  return {
    moderated,
    status,
    canEdit: raw.canEdit ?? raw.can_edit ?? moderated === MODERATED_ACTIVE,
    flagCount: Number(raw.flagCount ?? raw.flag_count) || 0,
    rejectionNote: raw.rejectionNote ?? raw.rejection_note ?? "",
    reports,
  };
}

/** Normalize GET /moderation/seeking/:uid admin detail payload. */
export function normalizeSeekingReviewDetail(raw) {
  const data = raw?.data ?? raw?.result ?? raw ?? {};
  const seeking = data.seeking && typeof data.seeking === "object" ? data.seeking : data.wish && typeof data.wish === "object" ? data.wish : data;
  const moderation = data.moderation ?? seeking?.moderation ?? {};
  const pendingFlags = Array.isArray(data.pendingFlags) ? data.pendingFlags : Array.isArray(data.pending_flags) ? data.pending_flags : [];
  const latestResubmission = data.latestResubmission ?? data.latest_resubmission ?? null;
  const snapshot = latestResubmission?.resubmission_snapshot ?? latestResubmission?.resubmissionSnapshot ?? null;
  return { seeking, moderation, pendingFlags, latestResubmission, snapshot };
}

export function getFlagReasonLabel(value) {
  const key = String(value || "").trim();
  const found = FLAG_REASON_CATEGORIES.find((c) => c.value === key);
  return found?.label || key || "Report";
}

export async function submitSeekingFlag({ targetUid, reasonCategory, reasonText }) {
  const reporterProfileUid = ((await AsyncStorage.getItem("profile_uid")) || "").trim();
  if (!reporterProfileUid) {
    throw new Error("Please log in to report a seeking post.");
  }
  const target_uid = String(targetUid || "").trim();
  if (!target_uid) {
    throw new Error("Seeking post not found.");
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
    const err = new Error(result.message || "You have already reported this seeking post.");
    err.code = 409;
    throw err;
  }
  if (!response.ok || (result.code != null && result.code !== 200)) {
    throw new Error(result.message || "Failed to submit report.");
  }
  return result;
}

export async function fetchSeekingModerationReviewQueue() {
  const response = await fetch(MODERATION_SEEKING_REVIEW_QUEUE_ENDPOINT);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || "Failed to load seeking review queue.");
  }
  const rows = result.data ?? result.result ?? [];
  return Array.isArray(rows) ? rows : [];
}

export async function fetchSeekingModerationDetail(profileWishUid) {
  const uid = encodeURIComponent(String(profileWishUid || "").trim());
  const response = await fetch(`${MODERATION_SEEKING_ENDPOINT}/${uid}`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || "Failed to load seeking review details.");
  }
  return result.data ?? result.result ?? result;
}

export async function reviewSeekingModeration({ profileWishUid, action, note }) {
  const adminUid = ((await AsyncStorage.getItem("profile_uid")) || "").trim();
  const uid = encodeURIComponent(String(profileWishUid || "").trim());
  const response = await fetch(`${MODERATION_SEEKING_ENDPOINT}/${uid}/review`, {
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
export async function acknowledgeSeekingModeration({ profileWishUid, profileUid }) {
  const ownerUid = String(profileUid || (await AsyncStorage.getItem("profile_uid")) || "").trim();
  const uid = String(profileWishUid || "").trim();
  if (!ownerUid) {
    throw new Error("Please log in to acknowledge this seeking post.");
  }
  if (!uid) {
    throw new Error("Seeking post not found.");
  }

  const response = await fetch(`${MODERATION_SEEKING_ENDPOINT}/${encodeURIComponent(uid)}/acknowledge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile_uid: ownerUid }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || (result.code != null && result.code !== 200)) {
    throw new Error(result.message || "Failed to acknowledge seeking take-down.");
  }
  return result;
}
