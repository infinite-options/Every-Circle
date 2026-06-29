import { parseCoordinateValue } from "./validateCoordinates";
import { resolveBusinessProfileImage } from "./resolveBusinessProfileImage";

function businessLocationFieldsFromRow(row) {
  if (!row || typeof row !== "object") {
    return {
      business_latitude: null,
      business_longitude: null,
      business_google_id: null,
      business_address_line_1: null,
      business_city: null,
      business_state: null,
    };
  }

  return {
    business_latitude: row.business_latitude ?? row.latitude ?? null,
    business_longitude: row.business_longitude ?? row.longitude ?? null,
    business_google_id: row.business_google_id ?? null,
    business_address_line_1: row.business_address_line_1 ?? null,
    business_city: row.business_city ?? row.city ?? null,
    business_state: row.business_state ?? row.state ?? null,
  };
}

/** Fields to spread onto SearchScreen business rows from API payloads. */
export function searchBusinessLocationFieldsFromApi(row) {
  return businessLocationFieldsFromRow(row);
}

/** Normalize visible search business rows into map marker payloads. */
export function searchResultsToMapBusinesses(items) {
  const businesses = [];

  for (const item of items || []) {
    if (item?.itemType && item.itemType !== "businesses") continue;

    const lat = parseCoordinateValue(item.business_latitude);
    const lng = parseCoordinateValue(item.business_longitude);
    if (lat == null || lng == null) continue;

    const businessUid = item.business_uid ?? item.id;
    if (businessUid == null || String(businessUid).trim() === "") continue;

    businesses.push({
      business_uid: String(businessUid).trim(),
      business_name: item.company || item.business_name || "Business",
      business_google_id: item.business_google_id || null,
      business_latitude: lat,
      business_longitude: lng,
      business_address_line_1: item.business_address_line_1 || null,
      business_city: item.business_city || null,
      business_state: item.business_state || null,
      business_profile_img: resolveBusinessProfileImage(item) || item.business_profile_img || null,
    });
  }

  return businesses;
}
