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

/** True when API message indicates a permanently deleted auth account. */
export function isAccountDeletedAuthMessage(payload) {
  if (!payload || typeof payload !== "object") return false;
  const msg = String(payload.message || payload.error || payload.detail || "").toLowerCase();
  return msg.includes("account deleted");
}
