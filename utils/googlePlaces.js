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

const PLACES_KEY = config.googlePlacesApiKey;   // used for native REST + JS SDK script tag

// ─── Web: load Maps JS SDK once ──────────────────────────────────────────────
let _sdkPromise = null;

function loadGoogleMapsApi() {
  if (typeof window === "undefined") return Promise.resolve(); // native guard
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

// ─── getBusinessSuggestions ───────────────────────────────────────────────────
export async function getBusinessSuggestions(input) {
  if (!input?.trim()) return [];

  if (Platform.OS === "web") {
    // ── Web: JS SDK ──
    try {
      await loadGoogleMapsApi();
      return await new Promise((resolve) => {
        const svc = new window.google.maps.places.AutocompleteService();
        svc.getPlacePredictions(
          { input: input.trim(), types: ["establishment"] },
          (predictions, status) => {
            if (!predictions || status !== window.google.maps.places.PlacesServiceStatus.OK) {
              resolve([]);
              return;
            }
            resolve(predictions.map((p) => ({
              place_id: p.place_id,
              description: p.description,
              structured_formatting: {
                main_text: p.structured_formatting?.main_text || p.description,
                secondary_text: p.structured_formatting?.secondary_text || "",
              },
            })));
          }
        );
      });
    } catch (e) {
      console.error("[Places] web SDK error:", e);
      return [];
    }
  } else {
    // ── Native: REST ──
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input.trim())}&key=${PLACES_KEY}&types=establishment&language=en`;
      const res = await fetch(url);
      const json = await res.json();
      return (json.predictions || []).map((p) => ({
        place_id: p.place_id,
        description: p.description,
        structured_formatting: {
          main_text: p.structured_formatting?.main_text || p.description,
          secondary_text: p.structured_formatting?.secondary_text || "",
        },
      }));
    } catch (e) {
      console.error("[Places] native REST error:", e);
      return [];
    }
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────
/** Pull a single value out of Google's address_components array by type */
function _ac(components, type) {
  const c = (components || []).find((x) => x.types?.includes(type));
  return c ? c.long_name : null;
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
  };
}

// ─── getPlaceDetails ──────────────────────────────────────────────────────────
export async function getPlaceDetails(placeId) {
  if (Platform.OS === "web") {
    try {
      await loadGoogleMapsApi();
      return await new Promise((resolve) => {
        // PlacesService requires a DOM element attached to the page
        const dummy = document.createElement("div");
        document.body.appendChild(dummy);
        const svc = new window.google.maps.places.PlacesService(dummy);
        svc.getDetails(
          { placeId, fields: ["name", "formatted_address", "address_components", "geometry", "formatted_phone_number", "website"] },
          (place, status) => {
            document.body.removeChild(dummy);
            if (!place || status !== window.google.maps.places.PlacesServiceStatus.OK) {
              console.warn("[Places] getDetails status:", status);
              resolve({});
              return;
            }
            const addr = _parseAddressComponents(place.address_components);
            resolve({
              name: place.name,
              formatted_address: place.formatted_address,
              address_line_1: addr.number ? `${addr.number} ${addr.street}` : (addr.street || null),
              city:    addr.city,
              state:   addr.state,
              country: addr.country,
              zip:     addr.zip,
              lat: place.geometry?.location?.lat(),
              lng: place.geometry?.location?.lng(),
              phone: place.formatted_phone_number,
              website: place.website,
            });
          }
        );
      });
    } catch (e) {
      console.error("[Places] web getDetails error:", e);
      return {};
    }
  } else {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&key=${PLACES_KEY}&fields=name,formatted_address,address_components,geometry,formatted_phone_number,website`;
      const res = await fetch(url);
      const json = await res.json();
      const pd = json.result || {};
      const addr = _parseAddressComponents(pd.address_components);
      return {
        name: pd.name,
        formatted_address: pd.formatted_address,
        address_line_1: addr.number ? `${addr.number} ${addr.street}` : (addr.street || null),
        city:    addr.city,
        state:   addr.state,
        country: addr.country,
        zip:     addr.zip,
        lat: pd.geometry?.location?.lat,
        lng: pd.geometry?.location?.lng,
        phone: pd.formatted_phone_number,
        website: pd.website,
      };
    } catch (e) {
      console.error("[Places] native getDetails error:", e);
      return {};
    }
  }
}
