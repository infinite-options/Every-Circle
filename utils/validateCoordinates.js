/** Decimal degrees, WGS84. Empty input clears coordinates. */
const COORD_NUMBER = /^-?\d+(?:\.\d+)?$/;

export function formatCoordinatePairForInput(lat, lng) {
  const la = parseCoordinateValue(lat);
  const lo = parseCoordinateValue(lng);
  if (la == null || lo == null) return "";
  return `${la}, ${lo}`;
}

export function parseCoordinateValue(value) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse "lat, lng" (comma, semicolon, or whitespace separated).
 * @returns {{ lat: number|null, lng: number|null, error: string|null }}
 */
export function parseCoordinatePairInput(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return { lat: null, lng: null, error: null };
  }

  const parts = trimmed.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) {
    return {
      lat: null,
      lng: null,
      error: "Enter latitude and longitude separated by a comma (e.g. 37.7893, -122.3966).",
    };
  }

  const [latStr, lngStr] = parts;
  if (!COORD_NUMBER.test(latStr) || !COORD_NUMBER.test(lngStr)) {
    return {
      lat: null,
      lng: null,
      error: "Coordinates must be decimal numbers (e.g. 37.7893, -122.3966).",
    };
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (lat < -90 || lat > 90) {
    return { lat: null, lng: null, error: "Latitude must be between -90 and 90." };
  }
  if (lng < -180 || lng > 180) {
    return { lat: null, lng: null, error: "Longitude must be between -180 and 180." };
  }

  return { lat, lng, error: null };
}
