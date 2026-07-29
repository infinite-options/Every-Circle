/** Normalize GET /api/business_service_options/{bs_uid} into a choice-group array. */
export function parseServiceOptionsResponse(data) {
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.choice_groups)) return data.choice_groups;
  if (data?.result && typeof data.result === "object" && !Array.isArray(data.result)) {
    if (Array.isArray(data.result.choice_groups)) return data.result.choice_groups;
    if (Array.isArray(data.result.groups)) return data.result.groups;
  }
  if (Array.isArray(data?.data?.result)) return data.data.result;
  if (Array.isArray(data?.data?.choice_groups)) return data.data.choice_groups;
  if (data?.data?.result && typeof data.data.result === "object" && !Array.isArray(data.data.result)) {
    if (Array.isArray(data.data.result.choice_groups)) return data.data.result.choice_groups;
  }
  if (Array.isArray(data)) return data;
  return [];
}

/** Fetch choice groups for one business service row. */
export async function fetchServiceChoiceGroups(apiBaseUrl, bsUid) {
  const uid = String(bsUid ?? "").trim();
  if (!uid) return [];
  try {
    const res = await fetch(`${apiBaseUrl}/api/business_service_options/${encodeURIComponent(uid)}`);
    const data = await res.json();
    return parseServiceOptionsResponse(data);
  } catch {
    return [];
  }
}
