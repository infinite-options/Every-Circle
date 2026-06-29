/** Log-scale radius slider range (miles). */
export const MAP_RADIUS_LOG_MIN = 1;
export const MAP_RADIUS_LOG_MAX = 1500;
export const MAP_RADIUS_SNAP_EDGE = 0.015;
export const EARTH_RADIUS_MILES = 3959;

export function snapMapRadiusMiles(raw) {
  if (raw == null) return null;
  if (raw < 10) return Math.round(raw);
  if (raw < 100) return Math.round(raw / 5) * 5;
  if (raw < 1000) return Math.round(raw / 25) * 25;
  return Math.round(raw / 100) * 100;
}

export function haversineDistanceMiles(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Approximate map-center → viewport edge radius from react-native-maps region deltas. */
export function estimateRadiusMilesFromRegion(region, centerLat) {
  if (!region) return null;
  const latHalf = Number(region.latitudeDelta) / 2;
  const lngHalf = Number(region.longitudeDelta) / 2;
  if (!Number.isFinite(latHalf) || !Number.isFinite(lngHalf)) return null;

  const latMiles = latHalf * (Math.PI / 180) * EARTH_RADIUS_MILES;
  const lngMiles =
    lngHalf * (Math.PI / 180) * EARTH_RADIUS_MILES * Math.cos((centerLat * Math.PI) / 180);
  return Math.max(latMiles, lngMiles);
}

/** Google Maps LatLngBounds → approximate radius from center (web). */
export function estimateRadiusMilesFromLatLngBounds(bounds, centerLat, centerLng) {
  if (!bounds?.getNorthEast || !bounds?.getSouthWest) return null;
  const ne = bounds.getNorthEast();
  const latDist = haversineDistanceMiles(centerLat, centerLng, ne.lat(), centerLng);
  const lngDist = haversineDistanceMiles(centerLat, centerLng, centerLat, ne.lng());
  return Math.max(latDist, lngDist);
}

/** Snap/clamp a viewport-derived radius for the Nearby slider. */
export function normalizeViewportRadiusMiles(rawMiles) {
  if (rawMiles == null || !Number.isFinite(rawMiles)) return null;
  if (rawMiles > MAP_RADIUS_LOG_MAX * 1.25) return null;
  if (rawMiles <= 0.25) return 0;
  return snapMapRadiusMiles(rawMiles);
}

/** Latitude/longitude half-span for a given mile radius at a center latitude. */
export function radiusMilesToLatLngDelta(radiusMiles, centerLat) {
  const dLat = (radiusMiles / EARTH_RADIUS_MILES) * (180 / Math.PI);
  const dLng = dLat / Math.cos((centerLat * Math.PI) / 180);
  return { dLat, dLng };
}
