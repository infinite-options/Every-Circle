/** Default search origin — user's home coordinates from profile settings. */
export const SEARCH_LOCATION_HOME = "home";

/** Ten major US cities for the Search location filter. */
export const MAJOR_US_SEARCH_CITIES = [
  { key: "new_york", label: "New York, NY", shortLabel: "NYC", lat: 40.7128, lng: -74.006 },
  { key: "los_angeles", label: "Los Angeles, CA", shortLabel: "LA", lat: 34.0522, lng: -118.2437 },
  { key: "chicago", label: "Chicago, IL", shortLabel: "Chicago", lat: 41.8781, lng: -87.6298 },
  { key: "houston", label: "Houston, TX", shortLabel: "Houston", lat: 29.7604, lng: -95.3698 },
  { key: "phoenix", label: "Phoenix, AZ", shortLabel: "Phoenix", lat: 33.4484, lng: -112.074 },
  { key: "philadelphia", label: "Philadelphia, PA", shortLabel: "Philly", lat: 39.9526, lng: -75.1652 },
  { key: "san_antonio", label: "San Antonio, TX", shortLabel: "San Antonio", lat: 29.4241, lng: -98.4936 },
  { key: "san_diego", label: "San Diego, CA", shortLabel: "San Diego", lat: 32.7157, lng: -117.1611 },
  { key: "dallas", label: "Dallas, TX", shortLabel: "Dallas", lat: 32.7767, lng: -96.797 },
  { key: "san_francisco", label: "San Francisco, CA", shortLabel: "SF", lat: 37.7749, lng: -122.4194 },
];

export function getSearchLocationOption(locationKey) {
  if (!locationKey || locationKey === SEARCH_LOCATION_HOME) return null;
  return MAJOR_US_SEARCH_CITIES.find((city) => city.key === locationKey) || null;
}

export function resolveSearchLocationCoords(locationKey, homeCoords) {
  const city = getSearchLocationOption(locationKey);
  if (city) return { lat: city.lat, lng: city.lng };
  if (homeCoords?.lat != null && homeCoords?.lng != null) {
    return { lat: homeCoords.lat, lng: homeCoords.lng };
  }
  return { lat: null, lng: null };
}

export function getSearchLocationFilterLabel(locationKey) {
  if (!locationKey || locationKey === SEARCH_LOCATION_HOME) return "Search location";
  const city = getSearchLocationOption(locationKey);
  return city?.shortLabel || city?.label || "Search location";
}

export function getSearchLocationFullLabel(locationKey) {
  if (!locationKey || locationKey === SEARCH_LOCATION_HOME) return "My home";
  const city = getSearchLocationOption(locationKey);
  return city?.label || "My home";
}
