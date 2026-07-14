/** @typedef {{ category_uid: string, category_name: string, category_description?: string, category_parent_id: string | null }} BusinessCategory */

export function buildCategoryIndex(allCategories) {
  const byId = new Map();
  for (const cat of allCategories || []) {
    if (cat?.category_uid) byId.set(cat.category_uid, cat);
  }
  return byId;
}

export function getCategoryPathSegments(categoryUid, byId) {
  const segments = [];
  const seen = new Set();
  let current = byId.get(categoryUid);
  while (current && !seen.has(current.category_uid)) {
    seen.add(current.category_uid);
    segments.unshift(current);
    current = current.category_parent_id ? byId.get(current.category_parent_id) : null;
  }
  return segments;
}

export function resolveCategorySelection(categoryUid, byId) {
  const segments = getCategoryPathSegments(categoryUid, byId);
  return {
    main: segments[0]?.category_uid || null,
    sub: segments[1]?.category_uid || null,
    subSub: segments[2]?.category_uid || null,
    pathLabel: segments.map((s) => s.category_name).join(" › "),
  };
}

export function categoryIdsFromSelection(main, sub, subSub) {
  return [main, sub, subSub].filter(Boolean);
}

/**
 * Client-side category suggest — matches name/description and returns breadcrumb paths.
 * @param {string} query
 * @param {BusinessCategory[]} allCategories
 * @param {{ limit?: number }} [opts]
 */
export function searchBusinessCategories(query, allCategories, { limit = 12 } = {}) {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 2) return [];

  const byId = buildCategoryIndex(allCategories);
  const matches = [];

  for (const cat of allCategories || []) {
    const name = String(cat.category_name || "").toLowerCase();
    const desc = String(cat.category_description || "").toLowerCase();
    if (!name.includes(q) && !desc.includes(q)) continue;

    const segments = getCategoryPathSegments(cat.category_uid, byId);
    const pathLabel = segments.map((s) => s.category_name).join(" › ");
    const selection = resolveCategorySelection(cat.category_uid, byId);

    matches.push({
      category_uid: cat.category_uid,
      category_name: cat.category_name,
      pathLabel,
      depth: segments.length,
      ...selection,
    });
  }

  matches.sort((a, b) => {
    const aName = a.category_name.toLowerCase();
    const bName = b.category_name.toLowerCase();
    const aStarts = aName.startsWith(q) ? 0 : 1;
    const bStarts = bName.startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    if (aName === q && bName !== q) return -1;
    if (bName === q && aName !== q) return 1;
    if (a.depth !== b.depth) return b.depth - a.depth;
    return a.pathLabel.localeCompare(b.pathLabel);
  });

  return matches.slice(0, limit);
}

export function getSelectedCategoryPathLabel(categoryIds, allCategories) {
  const ids = (categoryIds || []).filter(Boolean);
  if (!ids.length || !allCategories?.length) return "";
  const byId = buildCategoryIndex(allCategories);
  const deepest = ids[ids.length - 1];
  return resolveCategorySelection(deepest, byId).pathLabel;
}
