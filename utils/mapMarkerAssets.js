export {
  MAP_MARKER_BORDER_COLOR,
  MAP_MARKER_BORDER_WIDTH,
  MAP_MARKER_DISPLAY_SIZE,
  MAP_MARKER_IMAGE,
  MAP_MARKER_INNER_SIZE,
  MAP_MARKER_SIZE,
} from "./mapMarkerConstants";

import { MAP_MARKER_IMAGE } from "./mapMarkerConstants";

export function getNativeMapMarkerImage() {
  return MAP_MARKER_IMAGE;
}

/** Not used on native; web implementation lives in mapMarkerAssets.web.js */
export function getWebMapMarkerIcon() {
  return undefined;
}
