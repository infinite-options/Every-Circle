/** Hide Google POIs so only Every Circle markers stand out. */
export const EVERY_CIRCLE_ONLY_MAP_STYLES = [
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export function getMapStylesForEveryCircleOnly(everyCircleOnly) {
  return everyCircleOnly ? EVERY_CIRCLE_ONLY_MAP_STYLES : [];
}
