import config from "../config";

const MAPS_CALLBACK_NAME = "__everyCircleMapsReady";
let mapsApiPromise = null;

function buildMapsApi() {
  const maps = window.google?.maps;
  if (!maps || typeof maps.Map !== "function") {
    throw new Error("Google Maps failed to initialize");
  }

  return {
    Map: maps.Map,
    InfoWindow: maps.InfoWindow,
    Marker: maps.Marker,
    Size: maps.Size,
    Point: maps.Point,
    SymbolPath: maps.SymbolPath,
    event: maps.event,
    LatLngBounds: maps.LatLngBounds,
  };
}

function ensureGoogleMapsScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps JS is only available on web"));
  }

  if (window.google?.maps?.Map) {
    return Promise.resolve();
  }

  const existing = document.querySelector('script[data-everycircle-maps="true"]');
  if (existing) {
    if (window.google?.maps?.Map) {
      return Promise.resolve();
    }
    // Prior load (e.g. loading=async without callback) never exposed Map — retry.
    existing.remove();
  }

  return new Promise((resolve, reject) => {
    window[MAPS_CALLBACK_NAME] = () => {
      delete window[MAPS_CALLBACK_NAME];
      if (window.google?.maps?.Map) {
        resolve();
      } else {
        reject(new Error("Google Maps callback fired but API is unavailable"));
      }
    };

    const apiKey = config.googleApiKey;
    const script = document.createElement("script");
    script.dataset.everycircleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${MAPS_CALLBACK_NAME}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      delete window[MAPS_CALLBACK_NAME];
      reject(new Error("Failed to load Google Maps script"));
    };
    document.head.appendChild(script);
  });
}

/** Load Google Maps JS for web and return constructors used by EveryCircleMapView.web.js */
export async function loadGoogleMapsJs() {
  if (!mapsApiPromise) {
    mapsApiPromise = (async () => {
      await ensureGoogleMapsScript();
      return buildMapsApi();
    })();
  }

  return mapsApiPromise;
}
