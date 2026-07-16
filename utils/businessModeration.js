import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CONTENT_REPORTS_ENDPOINT,
  MODERATION_BUSINESSES_ENDPOINT,
  MODERATION_BUSINESSES_REVIEW_QUEUE_ENDPOINT,
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

export const BUSINESS_SUPPORT_EMAIL = "support@everycircle.com";

export const FLAG_REASON_CATEGORIES = [
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "scam_or_fraud", label: "Scam or fraud" },
  { value: "misleading", label: "Misleading information" },
  { value: "harassment", label: "Harassment" },
  { value: "other", label: "Other" },
];

/** Build moderation item shape from API business payload or business row. */
export function buildBusinessModerationItem(apiBusiness) {
  if (!apiBusiness || typeof apiBusiness !== "object") return null;
  const business = apiBusiness.business && typeof apiBusiness.business === "object" ? apiBusiness.business : apiBusiness;
  const moderation = apiBusiness.moderation ?? business?.moderation ?? null;
  const moderatedFromModeration = moderation?.moderated != null ? Number(moderation.moderated) : null;
  return {
    moderation,
    business_moderated: business?.business_moderated ?? apiBusiness.business_moderated ?? moderatedFromModeration,
  };
}

/** Read moderated state from API row or nested moderation object. */
export function getBusinessModeratedState(item) {
  if (!item) return MODERATED_ACTIVE;
  if (item.moderation != null && item.moderation.moderated != null) {
    return Number(item.moderation.moderated) || 0;
  }
  if (item.business_moderated != null) {
    return Number(item.business_moderated) || 0;
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

export function isBusinessAdminRejected(item) {
  const { status, resubmissionStatus } = getRawModerationFields(item);
  return status === MODERATION_STATUS.REJECTED || resubmissionStatus === MODERATION_STATUS.REJECTED;
}

export function getBusinessModerationStatus(item) {
  const state = getBusinessModeratedState(item);
  if (state === MODERATED_ACKNOWLEDGED) return MODERATION_STATUS.ACKNOWLEDGED;

  const { status, resubmissionStatus } = getRawModerationFields(item);
  if (resubmissionStatus === MODERATION_STATUS.REJECTED) return MODERATION_STATUS.REJECTED;
  if (status) return status;
  if (state === MODERATED_PENDING_REVIEW) return MODERATION_STATUS.PENDING_REVIEW;
  if (state === MODERATED_TAKEN_DOWN) return MODERATION_STATUS.TAKEN_DOWN;
  return null;
}

export function isBusinessModeratedBlocked(item) {
  // 1 taken_down | 2 pending_review | 3 acknowledged — all hide content from other users
  const state = getBusinessModeratedState(item);
  return state === MODERATED_TAKEN_DOWN || state === MODERATED_PENDING_REVIEW || state === MODERATED_ACKNOWLEDGED;
}

/** True when non-owners must not see this business's public content. */
export function isBusinessVisibilityBlocked(item) {
  return isBusinessModeratedBlocked(item);
}

/** Owner must see the restriction screen for taken down (1), pending review (2), or acknowledged (3). */
export function isBusinessOwnerRestricted(item) {
  const state = getBusinessModeratedState(item);
  return state === MODERATED_TAKEN_DOWN || state === MODERATED_PENDING_REVIEW || state === MODERATED_ACKNOWLEDGED;
}

/** Taken down — owner may acknowledge (moderated → 3). */
export function canAcknowledgeTakenDownBusiness(item) {
  return getBusinessModeratedState(item) === MODERATED_TAKEN_DOWN;
}

export function getBusinessModerationStatusLabel(item) {
  const status = typeof item === "object" && item != null ? getBusinessModerationStatus(item) : null;
  const state = typeof item === "number" ? item : getBusinessModeratedState(item);

  if (status === MODERATION_STATUS.ACKNOWLEDGED || state === MODERATED_ACKNOWLEDGED) return "Acknowledged";
  if (status === MODERATION_STATUS.PENDING_REVIEW) return "Pending admin review";
  if (status === MODERATION_STATUS.REJECTED) return "Rejected";
  if (status === MODERATION_STATUS.TAKEN_DOWN) return "Taken down";
  if (state === MODERATED_PENDING_REVIEW) return "Pending admin review";
  if (state === MODERATED_TAKEN_DOWN) return "Taken down";
  return "Active";
}

export function getBusinessModerationOwnerMessage(item) {
  const status = getBusinessModerationStatus(item);
  const flagCount = Number(item?.moderation?.flagCount ?? item?.moderation?.flag_count) || 0;
  const rejectionNote = String(
    item?.moderation?.rejectionNote ??
      item?.moderation?.rejection_note ??
      item?.moderation?.resubmissionAdminNote ??
      item?.moderation?.resubmission_admin_note ??
      "",
  ).trim();
  const flagPart = flagCount > 0 ? `${flagCount} user${flagCount === 1 ? "" : "s"} flagged your business. ` : "";
  const disputePart = ` If you believe this is a mistake, contact ${BUSINESS_SUPPORT_EMAIL} for disputes.`;

  if (status === MODERATION_STATUS.ACKNOWLEDGED || getBusinessModeratedState(item) === MODERATED_ACKNOWLEDGED) {
    const notePart = rejectionNote ? ` Reason: ${rejectionNote}.` : "";
    return `${flagPart}Your business has been taken down and is hidden from others.${notePart}${disputePart}`;
  }
  if (status === MODERATION_STATUS.PENDING_REVIEW || getBusinessModeratedState(item) === MODERATED_PENDING_REVIEW) {
    return `${flagPart}Your business is hidden and awaiting admin review. You cannot use your business listing until an admin decides.${disputePart}`;
  }
  if (status === MODERATION_STATUS.TAKEN_DOWN || getBusinessModeratedState(item) === MODERATED_TAKEN_DOWN) {
    const notePart = rejectionNote ? ` Reason: ${rejectionNote}.` : "";
    return `${flagPart}Your business has been taken down and is hidden from others.${notePart}${disputePart}`;
  }
  if (status === MODERATION_STATUS.REJECTED) {
    const notePart = rejectionNote ? ` Reason: ${rejectionNote}.` : "";
    return `Your business was rejected by an admin and remains hidden.${notePart}${disputePart}`;
  }
  return "";
}

export function normalizeBusinessModeration(businessRow) {
  if (!businessRow) return null;
  const moderated = getBusinessModeratedState(businessRow);
  const raw = businessRow.moderation || {};
  const status =
    moderated === MODERATED_ACKNOWLEDGED
      ? MODERATION_STATUS.ACKNOWLEDGED
      : raw.status ?? raw.resubmissionStatus ?? raw.resubmission_status ?? null;
  const reports = Array.isArray(raw.reports) ? raw.reports : Array.isArray(raw.pendingFlags) ? raw.pendingFlags : [];
  return {
    moderated,
    status,
    flagCount: Number(raw.flagCount ?? raw.flag_count) || 0,
    rejectionNote: raw.rejectionNote ?? raw.rejection_note ?? "",
    reports,
  };
}

export function normalizeBusinessReviewDetail(raw) {
  const data = raw?.data ?? raw?.result ?? raw ?? {};
  const business = data.business && typeof data.business === "object" ? data.business : data;
  const moderation = data.moderation ?? business?.moderation ?? {};
  const pendingFlags = Array.isArray(data.pendingFlags)
    ? data.pendingFlags
    : Array.isArray(data.pending_flags)
      ? data.pending_flags
      : [];
  return { business, moderation, pendingFlags, raw: data };
}

export function getFlagReasonLabel(value) {
  const key = String(value || "").trim();
  const found = FLAG_REASON_CATEGORIES.find((c) => c.value === key);
  return found?.label || key || "Report";
}

export async function submitBusinessFlag({ targetUid, reasonCategory, reasonText }) {
  const reporterProfileUid = ((await AsyncStorage.getItem("profile_uid")) || "").trim();
  if (!reporterProfileUid) {
    throw new Error("Please log in to report a business.");
  }
  const target_uid = String(targetUid || "").trim();
  if (!target_uid) {
    throw new Error("Business not found.");
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
    const err = new Error(result.message || "You have already reported this business.");
    err.code = 409;
    throw err;
  }
  if (!response.ok || (result.code != null && result.code !== 200)) {
    throw new Error(result.message || "Failed to submit report.");
  }
  return result;
}

export async function fetchBusinessModerationReviewQueue() {
  const response = await fetch(MODERATION_BUSINESSES_REVIEW_QUEUE_ENDPOINT);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || "Failed to load business review queue.");
  }
  const rows = result.data ?? result.result ?? [];
  return Array.isArray(rows) ? rows : [];
}

export async function fetchBusinessModerationDetail(businessUid) {
  const uid = encodeURIComponent(String(businessUid || "").trim());
  const response = await fetch(`${MODERATION_BUSINESSES_ENDPOINT}/${uid}`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || "Failed to load business review details.");
  }
  return result.data ?? result.result ?? result;
}

export async function reviewBusinessModeration({ businessUid, action, note }) {
  const adminUid = ((await AsyncStorage.getItem("profile_uid")) || "").trim();
  const uid = encodeURIComponent(String(businessUid || "").trim());
  const response = await fetch(`${MODERATION_BUSINESSES_ENDPOINT}/${uid}/review`, {
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

/** POST acknowledge take-down (moderated 1 → moderated 3). Idempotent if already acknowledged. */
export async function acknowledgeBusinessModeration({ businessUid, profileUid }) {
  const ownerUid = String(profileUid || (await AsyncStorage.getItem("profile_uid")) || "").trim();
  const uid = String(businessUid || "").trim();
  if (!ownerUid) {
    throw new Error("Please log in to acknowledge this business take-down.");
  }
  if (!uid) {
    throw new Error("Business not found.");
  }

  const response = await fetch(`${MODERATION_BUSINESSES_ENDPOINT}/${encodeURIComponent(uid)}/acknowledge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile_uid: ownerUid }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || (result.code != null && result.code !== 200)) {
    throw new Error(result.message || "Failed to acknowledge business take-down.");
  }
  return result;
}
