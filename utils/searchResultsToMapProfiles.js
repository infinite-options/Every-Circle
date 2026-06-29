import { parseCoordinateValue } from "./validateCoordinates";
import { resolveBusinessProfileImage } from "./resolveBusinessProfileImage";

/** Normalize visible expertise/seeking search rows into map marker payloads. */
export function searchResultsToMapProfiles(items) {
  const markers = [];
  for (const item of items || []) {
    if (item?.itemType !== "expertise" && item?.itemType !== "seeking") continue;

    const coords =
      item?.itemType === "expertise"
        ? (() => {
            const offeringLat = parseCoordinateValue(item?.profile_expertise_latitude ?? item?.expertiseData?.profile_expertise_latitude);
            const offeringLng = parseCoordinateValue(item?.profile_expertise_longitude ?? item?.expertiseData?.profile_expertise_longitude);
            if (offeringLat != null && offeringLng != null) {
              return { lat: offeringLat, lng: offeringLng };
            }
            return {
              lat: parseCoordinateValue(item.profile_personal_latitude),
              lng: parseCoordinateValue(item.profile_personal_longitude),
            };
          })()
        : {
            lat: parseCoordinateValue(item.profile_personal_latitude),
            lng: parseCoordinateValue(item.profile_personal_longitude),
          };
    const lat = coords.lat;
    const lng = coords.lng;
    if (lat == null || lng == null) continue;

    const uid = item.profile_uid ?? item.id;
    if (uid == null || String(uid).trim() === "") continue;

    const firstName = item.profileData?.firstName || "";
    const lastName = item.profileData?.lastName || "";
    const name = [firstName, lastName].filter(Boolean).join(" ") || item.company || "Person";

    const profileUid = String(uid).trim();
    const profileImage =
      resolveBusinessProfileImage({
        business_uid: profileUid,
        business_profile_img: item.profileData?.image || null,
      }) ||
      item.profileData?.image ||
      null;

    markers.push({
      // Use the same shape as business markers so EveryCircleMapView works unchanged.
      business_uid: profileUid,
      business_name: name,
      business_latitude: lat,
      business_longitude: lng,
      business_profile_img: profileImage,
      // Extra fields used by EveryCircleMapScreen for navigation + labels.
      itemType: item.itemType,
      profile_uid: String(uid).trim(),
      item_title: item.company || item.business_tag_line || "",
    });
  }
  return markers;
}
