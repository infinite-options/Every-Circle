import { MAP_MARKER_DISPLAY_SIZE } from "./mapMarkerConstants";

export {
  MAP_MARKER_BORDER_COLOR,
  MAP_MARKER_BORDER_WIDTH,
  MAP_MARKER_CALLOUT_IMAGE,
  MAP_MARKER_DISPLAY_SIZE,
  MAP_MARKER_IMAGE,
  MAP_MARKER_INNER_SIZE,
  MAP_MARKER_PIN_IMAGE,
  MAP_MARKER_SIZE,
  getNativeMapMarkerImage,
} from "./mapMarkerAssets.js";

/** Public URL for Google Maps JS (served from /public on Expo web). */
export function getMapMarkerUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/mapmarker.png`;
  }
  return "/mapmarker.png";
}

export function getMapMarkerPinUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/map-marker-pin.png`;
  }
  return "/map-marker-pin.png";
}

export function getMapMarkerCalloutUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/map-marker-callout.png`;
  }
  return "/map-marker-callout.png";
}

/** Google Maps JS `icon` config for web markers (pre-composited pin). */
export async function getWebMapMarkerIcon(mapsApi) {
  if (!mapsApi?.Size || !mapsApi?.Point) return undefined;

  const { width, height } = MAP_MARKER_DISPLAY_SIZE;

  return {
    url: getMapMarkerPinUrl(),
    scaledSize: new mapsApi.Size(width, height),
    anchor: new mapsApi.Point(width / 2, height / 2),
  };
}
