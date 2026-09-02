/**
 * Ownership vs reviewer-seeded "unclaimed" links.
 * Reviewer create flows POST business_role=unclaimed and BE may still attach a business_users row;
 * that must not grant owner UI, claim-blocking, or "my businesses" membership.
 */

const UNCLAIMED_ROLE_ALIASES = new Set(["unclaimed", "none", "n/a", "na", "null"]);

/** Roles that can manage membership and are protected from non-self edits. */
export const SENIOR_BUSINESS_ROLES = ["owner", "partner"];

/** Role string from a business_users row or profile business_info row. */
export function getBusinessMembershipRole(row) {
  if (!row || typeof row !== "object") return "";
  return String(row.bu_role || row.business_role || row.profile_business_role || row.role || "")
    .trim()
    .toLowerCase();
}

export function normalizeBusinessRole(roleOrRow) {
  if (typeof roleOrRow === "string" || roleOrRow == null) return String(roleOrRow || "").trim().toLowerCase();
  return getBusinessMembershipRole(roleOrRow);
}

export function roleIsSenior(roleOrRow) {
  return SENIOR_BUSINESS_ROLES.includes(normalizeBusinessRole(roleOrRow));
}

/** Match a business_users row to the logged-in user (user uid and/or profile uid). */
export function businessUserMatchesViewer(bu, userUid, profileUid) {
  if (!bu || (userUid == null && profileUid == null)) return false;
  const userOk =
    userUid &&
    (String(bu.user_uid || "").trim() === String(userUid).trim() ||
      String(bu.bu_user_id || "").trim() === String(userUid).trim() ||
      String(bu.business_user_id || "").trim() === String(userUid).trim());

  const profileOk =
    profileUid &&
    (String(bu.profile_id || "").trim() === String(profileUid).trim() ||
      String(bu.profile_uid || "").trim() === String(profileUid).trim() ||
      String(bu.profile_personal_uid || "").trim() === String(profileUid).trim());

  return !!(userOk || profileOk);
}

export function countSeniorBusinessMembers(businessUsers) {
  if (!Array.isArray(businessUsers)) return 0;
  return businessUsers.filter((u) => roleIsSenior(u)).length;
}

/** Count owner/partner roles in the unsaved Edit Business Profile roster. */
export function countDraftSeniorBusinessMembers(existingBusinessUsers, additionalBusinessUsers = []) {
  const existing = Array.isArray(existingBusinessUsers) ? existingBusinessUsers : [];
  const additional = Array.isArray(additionalBusinessUsers) ? additionalBusinessUsers : [];
  const fromExisting = countSeniorBusinessMembers(existing);
  const fromNew = additional.filter((u) => roleIsSenior(u?.role)).length;
  return fromExisting + fromNew;
}

/** Roles an admin may assign when inviting new members (not owner/partner). */
export const ADMIN_INVITE_ROLES = ["admin", "employee", "other"];

export function canViewerAddBusinessMembers(viewerRole) {
  const viewer = normalizeBusinessRole(viewerRole);
  return roleIsSenior(viewer) || viewer === "admin";
}

/** Role dropdown options when inviting a new member by email. */
export function getNewMemberRoleOptions(viewerRole, allRoleOptions) {
  const options = Array.isArray(allRoleOptions) ? allRoleOptions : [];
  if (roleIsSenior(viewerRole)) return options;
  if (normalizeBusinessRole(viewerRole) === "admin") {
    return options.filter((r) => ADMIN_INVITE_ROLES.includes(normalizeBusinessRole(r?.value ?? r)));
  }
  return [];
}

/**
 * Who may edit a member's role on Edit/Business profile:
 * - Owner/partner: any non-senior member, plus their own role (saved state)
 * - Owner/partner + draftMode: any member while editing before save
 * - Admin: any non-owner/partner role (including their own)
 */
export function canViewerEditMemberRole(viewerRole, memberRoleOrRow, { isSelf = false, draftMode = false } = {}) {
  const viewer = normalizeBusinessRole(viewerRole);
  const member = normalizeBusinessRole(memberRoleOrRow);
  if (roleIsSenior(viewer)) {
    if (draftMode) return true;
    return !roleIsSenior(member) || isSelf;
  }
  if (viewer === "admin") {
    return !roleIsSenior(member);
  }
  return false;
}

/**
 * Who may remove a membership association:
 * - Owner/partner may remove non-senior members
 * - Owner/partner may remove an owner/partner only when another owner/partner remains
 *   (sole owner/partner has no delete/leave control — including during unsaved draft edits)
 */
export function canViewerRemoveMember(viewerRole, memberRoleOrRow, { isSelf = false, seniorCount = 0, draftMode = false } = {}) {
  const viewer = normalizeBusinessRole(viewerRole);
  if (!roleIsSenior(viewer)) return false;
  if (roleIsSenior(memberRoleOrRow)) {
    return seniorCount >= 2;
  }
  return true;
}

/** True when the role is reviewer-seeded / not real ownership. */
export function isUnclaimedBusinessRole(roleOrRow) {
  const role = normalizeBusinessRole(roleOrRow);
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
