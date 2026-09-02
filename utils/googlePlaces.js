/**
 * googlePlaces.js
 *
 * Web    → Google Maps JS SDK (AutocompleteService / PlacesService) — no CORS issues
 * Native → REST endpoints — no CORS issues in native fetch
 *
 * Both return the same shape so callers don't need to care about platform.
 */
import { Platform } from "react-native";
import config from "../config";

const PLACES_KEY = config.googleApiKey;

// ─── Web: load Maps JS SDK once ──────────────────────────────────────────────
let _sdkPromise = null;

function loadGoogleMapsApi() {
  if (typeof window === "undefined") return Promise.resolve(); // native guard
  if (!PLACES_KEY) {
    console.error("[Places] Missing API key — set EXPO_PUBLIC_GOOGLE_API_KEY (web), EXPO_PUBLIC_GOOGLE_API_KEY_ANDROID, and/or EXPO_PUBLIC_GOOGLE_API_KEY_IOS in .env");
    return Promise.resolve();
  }
  if (_sdkPromise) return _sdkPromise;                        // already loading or loaded

  _sdkPromise = new Promise((resolve, reject) => {
    // Already injected by a previous load
    if (window.google?.maps?.places) { resolve(); return; }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${PLACES_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps JS SDK failed to load"));
    document.head.appendChild(script);
  });

  return _sdkPromise;
}

function _mapPredictions(predictions) {
  return (predictions || []).map((p) => ({
    place_id: p.place_id,
    description: p.description,
    structured_formatting: {
      main_text: p.structured_formatting?.main_text || p.description,
      secondary_text: p.structured_formatting?.secondary_text || "",
    },
  }));
}

async function _getPlacePredictions(input, types) {
  if (!input?.trim()) return [];

  if (Platform.OS === "web") {
    try {
      await loadGoogleMapsApi();
      return await new Promise((resolve) => {
        const svc = new window.google.maps.places.AutocompleteService();
        svc.getPlacePredictions({ input: input.trim(), types }, (predictions, status) => {
          if (!predictions || status !== window.google.maps.places.PlacesServiceStatus.OK) {
            resolve([]);
            return;
          }
          resolve(_mapPredictions(predictions));
        });
      });
    } catch (e) {
      console.error("[Places] web SDK error:", e);
      return [];
    }
  }

  if (!PLACES_KEY) {
    console.error("[Places] Missing API key — set EXPO_PUBLIC_GOOGLE_API_KEY (web), EXPO_PUBLIC_GOOGLE_API_KEY_ANDROID, and/or EXPO_PUBLIC_GOOGLE_API_KEY_IOS in .env");
    return [];
  }

  try {
    const typesParam = Array.isArray(types) && types.length ? `&types=${encodeURIComponent(types.join("|"))}` : "";
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input.trim())}&key=${PLACES_KEY}${typesParam}&language=en`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status && json.status !== "OK" && json.status !== "ZERO_RESULTS") {
      console.warn("[Places] autocomplete status:", json.status, json.error_message || "");
    }
    return _mapPredictions(json.predictions);
  } catch (e) {
    console.error("[Places] native REST error:", e);
    return [];
  }
}

// ─── getBusinessSuggestions ───────────────────────────────────────────────────
export async function getBusinessSuggestions(input) {
  return _getPlacePredictions(input, ["establishment"]);
}

/** Street/home address autocomplete (precise geocoded addresses). */
export async function getAddressSuggestions(input) {
  return _getPlacePredictions(input, ["address"]);
}

/** City / locality autocomplete (excludes streets and businesses). */
export async function getCitySuggestions(input) {
  return _getPlacePredictions(input, ["(cities)"]);
}

// ─── helpers ─────────────────────────────────────────────────────────────────
/** Pull a single value out of Google's address_components array by type */
function _ac(components, type) {
  const c = (components || []).find((x) => x.types?.includes(type));
  return c ? c.long_name : null;
}

const MAX_PLACE_PHOTOS = 10;

const ADDRESS_DETAIL_FIELDS_WEB = ["name", "formatted_address", "address_components", "geometry"];
const FULL_DETAIL_FIELDS_WEB = [
  ...ADDRESS_DETAIL_FIELDS_WEB,
  "formatted_phone_number",
  "website",
  "photos",
  "rating",
  "types",
];
const ADDRESS_DETAIL_FIELDS_REST = "name,formatted_address,address_components,geometry";
const FULL_DETAIL_FIELDS_REST =
  "name,formatted_address,address_components,geometry,formatted_phone_number,website,photos,rating,types";

function _photoUrlsFromReferences(photos) {
  return (photos || [])
    .slice(0, MAX_PLACE_PHOTOS)
    .filter((p) => p && p.photo_reference)
    .map((p) => buildRestGooglePhotoUrl(p.photo_reference));
}

/** Stable REST photo URL for save payloads and blob download (not PhotoService.GetPhoto). */
export function buildRestGooglePhotoUrl(photoReference) {
  const ref = String(photoReference || "").trim();
  if (!ref) return "";
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${encodeURIComponent(ref)}&key=${PLACES_KEY}`;
}

/** Convert JS SDK ephemeral PhotoService URL to REST place/photo URL when possible. */
export function resolveRestGooglePhotoUrl(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  if (u.includes("/maps/api/place/photo?") && u.includes("photo_reference=")) return u;
  const refParam = u.match(/[?&]photo_reference=([^&]+)/);
  if (refParam?.[1]) return buildRestGooglePhotoUrl(decodeURIComponent(refParam[1]));
  const oneS = u.match(/[?&]1s([^&]+)/);
  if (oneS?.[1]) return buildRestGooglePhotoUrl(decodeURIComponent(oneS[1]));
  return u;
}

/** Build photo URLs from JS SDK PlacePhoto objects (web fallback when REST is blocked). */
function _photoUrlsFromJsSdkPhotos(photos) {
  return (photos || [])
    .slice(0, MAX_PLACE_PHOTOS)
    .map((p) => {
      if (!p) return null;
      const ref = p.photo_reference || (typeof p.getReference === "function" ? p.getReference() : null);
      if (ref) return buildRestGooglePhotoUrl(ref);
      if (typeof p.getUrl === "function") {
        const ephemeral = p.getUrl({ maxWidth: 400 });
        return resolveRestGooglePhotoUrl(ephemeral) || ephemeral;
      }
      return null;
    })
    .filter(Boolean);
}

/** Neighborhood / area label (e.g. South Valley), not the full street address */
function _locationFromAddressComponents(components) {
  const areaTypes = ["neighborhood", "sublocality_level_1", "sublocality", "sublocality_level_2"];
  for (const type of areaTypes) {
    const value = _ac(components, type);
    if (value) return value;
  }
  return null;
}

/** Parse address_components into the fields the DB expects */
function _parseAddressComponents(components) {
  return {
    address_line_1: null,   // street number + route — we'll build it below
    city:    _ac(components, "locality")                   || _ac(components, "sublocality") || null,
    state:   _ac(components, "administrative_area_level_1") || null,
    country: _ac(components, "country")                    || null,
    zip:     _ac(components, "postal_code")                || null,
    street:  _ac(components, "route")                      || null,
    number:  _ac(components, "street_number")              || null,
    area_location: _locationFromAddressComponents(components),
  };
}

function _normalizePlaceDetails(place, { includePhotos, includeContact, includeTypes }) {
  if (!place) return {};

  const addr = _parseAddressComponents(place.address_components);
  const photo_urls = includePhotos
    ? Platform.OS === "web"
      ? _photoUrlsFromJsSdkPhotos(place.photos)
      : _photoUrlsFromReferences(place.photos)
    : [];

  return {
    name: place.name,
    formatted_address: place.formatted_address,
    address_line_1: addr.number ? `${addr.number} ${addr.street}` : (addr.street || null),
    area_location: addr.area_location,
    city: addr.city,
    state: addr.state,
    country: addr.country,
    zip: addr.zip,
    lat: Platform.OS === "web" ? place.geometry?.location?.lat() : place.geometry?.location?.lat,
    lng: Platform.OS === "web" ? place.geometry?.location?.lng() : place.geometry?.location?.lng,
    phone: includeContact ? place.formatted_phone_number : undefined,
    website: includeContact ? place.website : undefined,
    rating: includeContact ? (place.rating ?? null) : undefined,
    types: includeTypes && Array.isArray(place.types) ? place.types : [],
    photo_urls,
  };
}

async function _fetchPlaceDetails(placeId, { includePhotos, includeContact, includeTypes }) {
  if (Platform.OS === "web") {
    try {
      await loadGoogleMapsApi();
      const fields = includePhotos || includeContact || includeTypes ? FULL_DETAIL_FIELDS_WEB : ADDRESS_DETAIL_FIELDS_WEB;
      const place = await new Promise((resolve) => {
        const dummy = document.createElement("div");
        document.body.appendChild(dummy);
        const svc = new window.google.maps.places.PlacesService(dummy);
        svc.getDetails({ placeId, fields }, (result, status) => {
          document.body.removeChild(dummy);
          if (!result || status !== window.google.maps.places.PlacesServiceStatus.OK) {
            console.warn("[Places] getDetails status:", status);
            resolve(null);
            return;
          }
          resolve(result);
        });
      });
      return _normalizePlaceDetails(place, { includePhotos, includeContact, includeTypes });
    } catch (e) {
      console.error("[Places] web getDetails error:", e);
      return {};
    }
  }

  if (!PLACES_KEY) {
    console.error("[Places] Missing API key — set EXPO_PUBLIC_GOOGLE_API_KEY (web), EXPO_PUBLIC_GOOGLE_API_KEY_ANDROID, and/or EXPO_PUBLIC_GOOGLE_API_KEY_IOS in .env");
    return {};
  }

  try {
    const fields = includePhotos || includeContact || includeTypes ? FULL_DETAIL_FIELDS_REST : ADDRESS_DETAIL_FIELDS_REST;
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&key=${PLACES_KEY}&fields=${fields}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status && json.status !== "OK") {
      console.warn("[Places] getDetails status:", json.status, json.error_message || "");
      return {};
    }
    return _normalizePlaceDetails(json.result || {}, { includePhotos, includeContact, includeTypes });
  } catch (e) {
    console.error("[Places] native getDetails error:", e);
    return {};
  }
}

/** Street line for forms — prefer parsed address_line_1 over full formatted_address. */
export function placeDetailsStreetLine(pd, fallback = "") {
  const line1 = String(pd?.address_line_1 || "").trim();
  if (line1) return line1;
  return String(fallback || pd?.formatted_address || "").trim();
}

/** Normalize Google Place details into form address fields. */
export function applyPlaceDetailsToAddressFields(pd, fallbackDescription = "") {
  return {
    streetLine: placeDetailsStreetLine(pd, fallbackDescription),
    city: pd?.city || "",
    state: pd?.state || "",
    zip: pd?.zip || "",
    lat: pd?.lat ?? null,
    lng: pd?.lng ?? null,
  };
}

/** Lightweight Place Details — address + coordinates only (no photos, phone, website, rating). */
export async function getPlaceAddressDetails(placeId) {
  return _fetchPlaceDetails(placeId, {
    includePhotos: false,
    includeContact: false,
    includeTypes: false,
  });
}

// ─── getPlaceDetails ──────────────────────────────────────────────────────────
/** Full Place Details — includes photos, contact info, rating, and types. */
export async function getPlaceDetails(placeId) {
  return _fetchPlaceDetails(placeId, {
    includePhotos: true,
    includeContact: true,
    includeTypes: true,
  });
}
