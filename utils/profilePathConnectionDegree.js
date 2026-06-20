/** Parse profile_personal_path like "'110-000001','110-000010'" into profile uid strings. */
export function parseProfilePersonalPath(raw) {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
  }
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

function commonPrefixLength(a, b) {
  let i = 0;
  const len = Math.min(a.length, b.length);
  while (i < len && a[i] === b[i]) i += 1;
  return i;
}

/**
 * Referral-tree distance between two profiles using profile_personal_path.
 * Returns null when either path is missing or they share no common ancestor.
 */
export function connectionDegreeFromProfilePaths(viewerPathRaw, otherPathRaw) {
  const viewerPath = parseProfilePersonalPath(viewerPathRaw);
  const otherPath = parseProfilePersonalPath(otherPathRaw);
  if (viewerPath.length === 0 || otherPath.length === 0) return null;

  const commonLen = commonPrefixLength(viewerPath, otherPath);
  if (commonLen === 0) return null;

  return viewerPath.length - commonLen + (otherPath.length - commonLen);
}

/** Prefer API circle_num_nodes; fall back to profile_personal_path comparison. */
export function resolveConnectionDegree({ circleNumNodes, viewerPathRaw, otherPathRaw }) {
  if (circleNumNodes != null && circleNumNodes !== "" && Number.isFinite(Number(circleNumNodes))) {
    return Number(circleNumNodes);
  }
  return connectionDegreeFromProfilePaths(viewerPathRaw, otherPathRaw);
}

export function enrichReviewWithConnectionDegree(review, viewerPathRaw) {
  if (!review) return review;
  const circle_num_nodes = resolveConnectionDegree({
    circleNumNodes: review.circle_num_nodes,
    viewerPathRaw,
    otherPathRaw: review.profile_personal_path,
  });
  return { ...review, circle_num_nodes };
}
