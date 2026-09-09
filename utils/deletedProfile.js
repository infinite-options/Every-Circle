/** Shared helpers for tombstone (deleted) profiles — backend sends is_deleted: true. */

export const DELETED_USER_LABEL = "Deleted user";

export function isProfileDeleted(entity) {
  if (entity == null) return false;
  if (entity.is_deleted === true || entity.is_deleted === 1 || entity.is_deleted === "1") return true;
  if (entity.personal_info?.is_deleted === true) return true;
  if (entity.profile_personal_is_deleted === 1 || entity.profile_personal_is_deleted === "1") return true;
  return false;
}

export function deletedProfileDisplayName(entity, fallback = DELETED_USER_LABEL) {
  if (isProfileDeleted(entity)) return fallback;
  const first = String(entity?.firstName || entity?.first_name || entity?.personal_info?.profile_personal_first_name || "").trim();
  const last = String(entity?.lastName || entity?.last_name || entity?.personal_info?.profile_personal_last_name || "").trim();
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || fallback;
}

/**
 * Soft-deleted account still in the grace window — can reactivate.
 * Detects 403 + pending_deletion / can_reactivate / scheduled-for-deletion messaging.
 */
export function isPendingDeletionAuthResponse(payload, httpStatus) {
  if (!payload || typeof payload !== "object") return false;
  if (payload.pending_deletion === true || payload.pending_deletion === 1 || payload.pending_deletion === "1") {
    return true;
  }
  if (payload.can_reactivate === true && (httpStatus === 403 || payload.code === 403)) {
    return true;
  }
  const msg = String(payload.message || payload.error || payload.detail || "").toLowerCase();
  if (msg.includes("scheduled for deletion") || msg.includes("pending deletion") || msg.includes("reactivate existing")) {
    return true;
  }
  return false;
}

/** Soft-deleted register conflict (409) — send user to reactivate instead of creating a new account. */
export function isSoftDeletedRegisterConflict(payload, httpStatus) {
  if (!payload || typeof payload !== "object") return false;
  if (isPendingDeletionAuthResponse(payload, httpStatus)) return true;
  const status = httpStatus ?? payload.code;
  if (status === 409) {
    const msg = String(payload.message || payload.error || "").toLowerCase();
    if (msg.includes("reactivate") || msg.includes("scheduled for deletion") || payload.pending_deletion || payload.can_reactivate) {
      return true;
    }
  }
  return false;
}

/** True when API message indicates a permanently deleted auth account (grace expired / purged). */
export function isAccountDeletedAuthMessage(payload, httpStatus) {
  if (!payload || typeof payload !== "object") return false;
  if (isPendingDeletionAuthResponse(payload, httpStatus)) return false;
  if (httpStatus === 410 || payload.code === 410) return true;
  const msg = String(payload.message || payload.error || payload.detail || "").toLowerCase();
  return msg.includes("account deleted") || msg.includes("permanently deleted");
}

/** Params for navigating to the Reactivate confirm screen. */
export function reactivateNavParamsFromAuthPayload(payload, { email, password } = {}) {
  const p = payload && typeof payload === "object" ? payload : {};
  return {
    email: String(email || p.email || "").trim(),
    password: password != null ? String(password) : "",
    purge_scheduled_at: p.purge_scheduled_at || p.purgeScheduledAt || null,
    grace_days: p.grace_days ?? p.graceDays ?? 30,
    can_reactivate: p.can_reactivate !== false,
  };
}
