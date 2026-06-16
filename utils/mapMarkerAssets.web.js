import {
  MAP_MARKER_BORDER_COLOR,
  MAP_MARKER_BORDER_WIDTH,
  MAP_MARKER_DISPLAY_SIZE,
  MAP_MARKER_IMAGE,
  MAP_MARKER_INNER_SIZE,
  MAP_MARKER_SIZE,
} from "./mapMarkerConstants";

export {
  MAP_MARKER_BORDER_COLOR,
  MAP_MARKER_BORDER_WIDTH,
  MAP_MARKER_DISPLAY_SIZE,
  MAP_MARKER_IMAGE,
  MAP_MARKER_INNER_SIZE,
  MAP_MARKER_SIZE,
  getNativeMapMarkerImage,
} from "./mapMarkerAssets.js";

let borderedMarkerIconPromise = null;

/** Public URL for Google Maps JS (served from /public on Expo web). */
export function getMapMarkerUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/mapmarker.png`;
  }
  return "/mapmarker.png";
}

function buildBorderedMarkerDataUrl(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const size = MAP_MARKER_SIZE;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas is unavailable"));
        return;
      }

      const center = size / 2;
      const outerRadius = center - 1;

      ctx.beginPath();
      ctx.arc(center, center, outerRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = MAP_MARKER_BORDER_WIDTH;
      ctx.strokeStyle = MAP_MARKER_BORDER_COLOR;
      ctx.stroke();

      const innerRadius = outerRadius - MAP_MARKER_BORDER_WIDTH - 1;
      const innerX = center - innerRadius;
      const innerY = center - innerRadius;
      const innerDiameter = innerRadius * 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(center, center, innerRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, innerX, innerY, innerDiameter, innerDiameter);
      ctx.restore();

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load map marker image"));
    img.src = imageUrl;
  });
}

async function ensureBorderedMarkerDataUrl() {
  if (!borderedMarkerIconPromise) {
    borderedMarkerIconPromise = buildBorderedMarkerDataUrl(getMapMarkerUrl());
  }
  return borderedMarkerIconPromise;
}

/** Google Maps JS `icon` config for web markers (bordered, small). */
export async function getWebMapMarkerIcon(mapsApi) {
  if (!mapsApi?.Size || !mapsApi?.Point) return undefined;

  const url = await ensureBorderedMarkerDataUrl();
  const { width, height } = MAP_MARKER_DISPLAY_SIZE;

  return {
    url,
    scaledSize: new mapsApi.Size(width, height),
    anchor: new mapsApi.Point(width / 2, height / 2),
  };
}
