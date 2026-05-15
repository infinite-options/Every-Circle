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
