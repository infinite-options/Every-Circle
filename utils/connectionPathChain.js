import { parseProfilePersonalPath } from "./profilePathConnectionDegree";

/** Parse `/api/connections_path` combined_path into ordered profile UIDs. */
export function parseCombinedPath(combinedPath) {
  if (combinedPath == null) return [];
  const raw = String(combinedPath).trim();
  if (!raw || raw.toLowerCase().includes("no common ancestor")) return [];
  return raw
    .split(",")
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

/**
 * Build referral-tree path from viewer → other using profile_personal_path
 * (same LCA logic as backend ConnectionsPath).
 */
export function buildCombinedPathFromPersonalPaths(viewerPathRaw, otherPathRaw) {
  const firstList = parseProfilePersonalPath(viewerPathRaw);
  const secondList = parseProfilePersonalPath(otherPathRaw);
  if (!firstList.length || !secondList.length) return [];

  const commonPath = [];
  for (let i = 0; i < Math.min(firstList.length, secondList.length); i += 1) {
    if (firstList[i] === secondList[i]) commonPath.push(firstList[i]);
    else break;
  }
  if (!commonPath.length) return [];

  const lca = commonPath[commonPath.length - 1];
  const afterCommon1 = firstList.slice(firstList.indexOf(lca) + 1);
  const afterCommon2 = secondList.slice(secondList.indexOf(lca) + 1);

  let reversedSuffix;
  let otherSuffix;
  if (firstList[firstList.length - 1] !== lca) {
    reversedSuffix = afterCommon1.slice().reverse();
    otherSuffix = afterCommon2;
  } else {
    reversedSuffix = afterCommon2.slice().reverse();
    otherSuffix = afterCommon1;
  }

  return [...reversedSuffix, lca, ...otherSuffix];
}

/**
 * Cap visible users at maxUsers. Keeps start + end; collapses middle into one ellipsis.
 * Returns [{ type: 'user', uid }, { type: 'ellipsis', hiddenCount, hiddenUids }].
 */
export function truncateConnectionPath(uids, maxUsers = 5) {
  const list = (Array.isArray(uids) ? uids : []).map((u) => String(u).trim()).filter(Boolean);
  if (list.length === 0) return [];
  if (list.length <= maxUsers) {
    return list.map((uid) => ({ type: "user", uid }));
  }

  const headCount = Math.min(2, maxUsers - 1);
  const tailCount = maxUsers - headCount;
  const head = list.slice(0, headCount);
  const tail = list.slice(-tailCount);
  const hiddenStart = headCount;
  const hiddenEnd = list.length - tailCount;
  const hiddenUids = list.slice(hiddenStart, hiddenEnd);

  return [...head.map((uid) => ({ type: "user", uid })), { type: "ellipsis", hiddenCount: hiddenUids.length, hiddenUids }, ...tail.map((uid) => ({ type: "user", uid }))];
}
