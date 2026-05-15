/** True when API marks a review as a verified purchase. */
export function isReviewVerified(review) {
  if (!review) return false;
  const v = review.is_verified;
  return v === true || v === 1 || v === "1";
}

/** Verified reviewers eligible to receive a product bounty. */
export function getBountyEligibleReviews(reviews) {
  if (!Array.isArray(reviews)) return [];
  return reviews.filter(isReviewVerified);
}

/** Other reviewers plus the current user's review (if any), verified only. */
export function mergeBountyEligibleReviews(otherReviews, userReview) {
  const merged = [...(Array.isArray(otherReviews) ? otherReviews : [])];
  if (userReview && !merged.some((r) => r.rating_profile_id === userReview.rating_profile_id)) {
    merged.push(userReview);
  }
  return getBountyEligibleReviews(merged);
}

export function isCurrentUserBountyReview(review, currentUserProfileId) {
  return Boolean(currentUserProfileId && review?.rating_profile_id === currentUserProfileId);
}

/** Reviews the buyer may select (self is excluded when 2+ verified reviewers exist). */
export function getSelectableBountyReviews(eligible, currentUserProfileId) {
  if (!Array.isArray(eligible) || eligible.length === 0) return [];
  if (eligible.length === 1) return eligible;
  return eligible.filter((r) => !isCurrentUserBountyReview(r, currentUserProfileId));
}

export function isBountyReviewDisabled(review, eligible, currentUserProfileId) {
  return eligible.length > 1 && isCurrentUserBountyReview(review, currentUserProfileId);
}

/** Auto-select when exactly one selectable reviewer. */
export function getDefaultBountyRecipient(eligible, currentUserProfileId) {
  const selectable = getSelectableBountyReviews(eligible, currentUserProfileId);
  return selectable.length === 1 ? selectable[0] : null;
}

/** Profile id stored on cart when adding a bounty item. */
export function resolveBountyRecommenderProfileId({ selectedBountyRecipient, currentUserProfileId, eligibleReviews }) {
  if (selectedBountyRecipient?.rating_profile_id) {
    return selectedBountyRecipient.rating_profile_id;
  }
  const eligible = eligibleReviews || [];
  const selectable = getSelectableBountyReviews(eligible, currentUserProfileId);
  if (selectable.length === 1) {
    return selectable[0].rating_profile_id;
  }
  if (eligible.length === 0 || (eligible.length === 1 && isCurrentUserBountyReview(eligible[0], currentUserProfileId))) {
    return currentUserProfileId || null;
  }
  return null;
}

export function bountyPickerRequiresSelection(eligible, currentUserProfileId, selectedBountyRecipient) {
  const selectable = getSelectableBountyReviews(eligible, currentUserProfileId);
  return selectable.length > 1 && !selectedBountyRecipient;
}

export function productHasBounty(service, parsePriceFn) {
  if (!service?.bs_bounty) return false;
  const amount = parsePriceFn(service.bs_bounty);
  return Number.isFinite(amount) && amount > 0;
}

export function sortReviewsForBountyPicker(reviews, bountySort) {
  return [...reviews].sort((a, b) => {
    if (bountySort === "name") {
      const nameA = [a.profile_personal_first_name, a.profile_personal_last_name].filter(Boolean).join(" ").toLowerCase();
      const nameB = [b.profile_personal_first_name, b.profile_personal_last_name].filter(Boolean).join(" ").toLowerCase();
      return nameA.localeCompare(nameB);
    }
    if (a.circle_num_nodes == null && b.circle_num_nodes == null) return 0;
    if (a.circle_num_nodes == null) return 1;
    if (b.circle_num_nodes == null) return -1;
    return a.circle_num_nodes - b.circle_num_nodes;
  });
}
