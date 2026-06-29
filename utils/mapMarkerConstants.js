/** Outer marker size — close to former SymbolPath.CIRCLE scale 9 (~18px) plus border. */
export const MAP_MARKER_SIZE = 22;

export const MAP_MARKER_INNER_SIZE = 14;

export const MAP_MARKER_BORDER_WIDTH = 2;

export const MAP_MARKER_BORDER_COLOR = "#AF52DE";

export const MAP_MARKER_DISPLAY_SIZE = {
  width: MAP_MARKER_SIZE,
  height: MAP_MARKER_SIZE,
};

export const MAP_MARKER_IMAGE = require("../assets/mapmarker.png");

/** Pre-composited pin (white circle + purple border + logo) for native map Marker.image. */
export const MAP_MARKER_PIN_IMAGE = require("../assets/map-marker-pin.png");

/** Larger badge for map callouts / legend. */
export const MAP_MARKER_CALLOUT_IMAGE = require("../assets/map-marker-callout.png");
