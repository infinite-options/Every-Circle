/**
 * Ownership vs reviewer-seeded "unclaimed" links.
 * Reviewer create flows POST business_role=unclaimed and BE may still attach a business_users row;
 * that must not grant owner UI, claim-blocking, or "my businesses" membership.
 */

const UNCLAIMED_ROLE_ALIASES = new Set(["unclaimed", "none", "n/a", "na", "null"]);

/** Role string from a business_users row or profile business_info row. */
export function getBusinessMembershipRole(row) {
  if (!row || typeof row !== "object") return "";
  return String(row.bu_role || row.business_role || row.profile_business_role || row.role || "")
    .trim()
    .toLowerCase();
}

/** True when the role is reviewer-seeded / not real ownership. */
export function isUnclaimedBusinessRole(roleOrRow) {
  const role = typeof roleOrRow === "string" || roleOrRow == null ? String(roleOrRow || "").trim().toLowerCase() : getBusinessMembershipRole(roleOrRow);
  if (!role) return true;
  return UNCLAIMED_ROLE_ALIASES.has(role);
}

/** True for owner / co_owner / manager / other non-unclaimed roles. */
export function isRealBusinessOwnershipRole(roleOrRow) {
  return !isUnclaimedBusinessRole(roleOrRow);
}

export function businessUserHasRealOwnership(row) {
  return isRealBusinessOwnershipRole(row);
}

export function profileBusinessHasRealOwnership(row) {
  return isRealBusinessOwnershipRole(row);
}

/** Drop unclaimed / empty-role rows from profile business_info lists. */
export function filterOwnedProfileBusinesses(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(profileBusinessHasRealOwnership);
}

/** True when any business_users entry is a real owner/editor (blocks Claim This Business). */
export function businessHasRealOwner(businessUsers) {
  if (!Array.isArray(businessUsers)) return false;
  return businessUsers.some(businessUserHasRealOwnership);
}
