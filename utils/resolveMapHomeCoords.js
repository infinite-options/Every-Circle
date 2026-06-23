import { getSessionProfile } from "./sessionProfile";
import { parseCoordinateValue } from "./validateCoordinates";
import { MAP_PLACEHOLDER_HOME } from "./mapDefaults";
import { getLastKnownLocation } from "./lastKnownLocation";

/**
 * Home location for map centering: profile_personal_latitude/longitude when set,
 * then last-known GPS fix, otherwise Dummy A placeholder (Salesforce Park, SF).
 */
export async function resolveMapHomeCoords() {
  try {
    const session = await getSessionProfile();
    const pi = session?.personalInfo || session?.rawProfile?.personal_info;
    const lat = parseCoordinateValue(pi?.profile_personal_latitude);
    const lng = parseCoordinateValue(pi?.profile_personal_longitude);
    if (lat != null && lng != null) {
      return { lat, lng, source: "profile" };
    }
  } catch (err) {
    console.warn("resolveMapHomeCoords failed:", err);
  }

  const lastKnown = await getLastKnownLocation();
  if (lastKnown) {
    return { lat: lastKnown.lat, lng: lastKnown.lng, source: "last_known" };
  }

  return {
    lat: MAP_PLACEHOLDER_HOME.lat,
    lng: MAP_PLACEHOLDER_HOME.lng,
    source: "placeholder",
    label: MAP_PLACEHOLDER_HOME.label,
  };
}
