import React, { useCallback, useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { loadGoogleMapsJs } from "../utils/googleMapsLoader";
import { DEFAULT_MAP_ZOOM } from "../utils/mapDefaults";
import { getMapStylesForEveryCircleOnly } from "../utils/mapStyles";
import { getWebMapMarkerIcon, getMapMarkerCalloutUrl } from "../utils/mapMarkerAssets";
import { resolveBusinessProfileImage } from "../utils/resolveBusinessProfileImage";
import {
  estimateRadiusMilesFromLatLngBounds,
  radiusMilesToLatLngDelta,
} from "../utils/mapRadiusSync";
import MapZoomControls from "./MapZoomControls";

const HOME_MARKER_COLOR = "#2434C2";
const MIN_WEB_ZOOM = 2;
const MAX_WEB_ZOOM = 20;

function buildAddressLine(business) {
  const parts = [
    business.business_address_line_1,
    business.business_city,
    business.business_state,
  ].filter(Boolean);
  return parts.join(", ");
}

const clampLat = (v) => Math.max(-85, Math.min(85, v));
const clampLng = (v) => Math.max(-180, Math.min(180, v));

function fitMapToRadius(mapsApi, map, mapCenter, radiusMiles) {
  if (!mapsApi?.LatLngBounds) return;

  if (radiusMiles != null && mapCenter) {
    if (radiusMiles === 0) {
      map.setCenter({ lat: mapCenter.lat, lng: mapCenter.lng });
      map.setZoom(DEFAULT_MAP_ZOOM);
      return;
    }
    const { dLat, dLng } = radiusMilesToLatLngDelta(radiusMiles, mapCenter.lat);
    const bounds = new mapsApi.LatLngBounds();
    bounds.extend({ lat: clampLat(mapCenter.lat + dLat), lng: clampLng(mapCenter.lng - dLng) });
    bounds.extend({ lat: clampLat(mapCenter.lat - dLat), lng: clampLng(mapCenter.lng + dLng) });
    map.fitBounds(bounds, 8);
    if ((map.getZoom() ?? 3) < 3) map.setZoom(3);
    return;
  }

  if (mapCenter) {
    map.setCenter({ lat: mapCenter.lat, lng: mapCenter.lng });
  }
  map.setZoom(3);
}

function buildMapCalloutHtml(business) {
  const address = buildAddressLine(business);
  const uid = business.business_uid || "";
  const registeredLabel =
    business.itemType === "expertise"
      ? "Offering on Every Circle"
      : business.itemType === "seeking"
        ? "Seeking on Every Circle"
        : "Registered on Every Circle";
  const itemTitleHtml =
    business.item_title
      ? `<div style="margin-top: 4px; font-size: 12px; color: #666; line-height: 1.35;">${business.item_title}</div>`
      : "";
  const badgeUrl = getMapMarkerCalloutUrl();
  const profileUri = resolveBusinessProfileImage(business);
  const profileUrl = profileUri ? encodeURI(String(profileUri).trim()) : "";
  const photoHtml = profileUrl
    ? `<div style="position: relative; width: 48px; height: 48px; flex-shrink: 0;">
        <img
          src="${profileUrl}"
          width="48"
          height="48"
          alt=""
          style="display: block; width: 48px; height: 48px; border-radius: 50%; object-fit: cover; background: #f0f0f0;"
        />
        <img
          src="${badgeUrl}"
          width="18"
          height="18"
          alt="Every Circle"
          style="position: absolute; right: -4px; bottom: -4px; display: block; border-radius: 50%; border: 1px solid #AF52DE; background: #fff;"
        />
      </div>`
    : `<img
        src="${badgeUrl}"
        width="32"
        height="32"
        alt="Every Circle"
        style="flex-shrink: 0; display: block;"
      />`;

  return `
    <div style="font-family: system-ui, sans-serif; width: 240px; max-width: 240px; box-sizing: border-box;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        ${photoHtml}
        <div style="min-width: 0; flex: 1;">
          <strong style="display: block; font-size: 14px; line-height: 1.35; word-break: break-word;">${business.business_name || "Business"}</strong>
          ${itemTitleHtml}
        </div>
      </div>
      ${address ? `<div style="margin-top: 4px; font-size: 12px; color: #444; line-height: 1.35;">${address}</div>` : ""}
      <div style="margin-top: 8px; font-size: 12px; color: #AF52DE; line-height: 1.35;">${registeredLabel}</div>
      <button
        id="ec-map-btn-${uid}"
        type="button"
        style="margin-top: 10px; background: #AF52DE; color: #fff; border: none; border-radius: 6px; padding: 8px 12px; font-size: 12px; font-weight: 600; cursor: pointer;"
      >
        View on Every Circle
      </button>
    </div>
  `;
}

function addBusinessMarkers(mapsApi, map, businesses, infoWindowRef, onBusinessPress, markersRef) {
  return getWebMapMarkerIcon(mapsApi).then((markerIcon) => {
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    businesses.forEach((business) => {
      const position = {
        lat: business.business_latitude,
        lng: business.business_longitude,
      };

      const marker = new mapsApi.Marker({
        position,
        map,
        title: business.business_name || "Every Circle business",
        icon: markerIcon,
      });

      marker.addListener("click", () => {
        const content = buildMapCalloutHtml(business);
        const uid = business.business_uid || "";
        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open({ anchor: marker, map });
        mapsApi.event.addListener(infoWindowRef.current, "domready", () => {
          const btn = document.getElementById(`ec-map-btn-${uid}`);
          if (btn && onBusinessPress) {
            btn.onclick = () => onBusinessPress(business);
          }
        });
      });

      markersRef.current.push(marker);
    });
  });
}

export default function EveryCircleMapView({
  businesses = [],
  mapCenter,
  everyCircleOnly = true,
  fitToBusinesses = false,
  radiusMiles,
  fitRadiusToken = 0,
  onViewportRadiusChange,
  onBusinessPress,
}) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const mapsApiRef = useRef(null);
  const markersRef = useRef([]);
  const homeMarkerRef = useRef(null);
  const infoWindowRef = useRef(null);
  const idleListenerRef = useRef(null);
  const viewportDebounceRef = useRef(null);
  const isProgrammaticFitRef = useRef(false);
  const onBusinessPressRef = useRef(onBusinessPress);
  const onViewportRadiusChangeRef = useRef(onViewportRadiusChange);
  const fitToBusinessesRef = useRef(fitToBusinesses);
  const mapCenterRef = useRef(mapCenter);
  const radiusMilesRef = useRef(radiusMiles);

  useEffect(() => {
    onBusinessPressRef.current = onBusinessPress;
  }, [onBusinessPress]);

  useEffect(() => {
    onViewportRadiusChangeRef.current = onViewportRadiusChange;
  }, [onViewportRadiusChange]);

  useEffect(() => {
    fitToBusinessesRef.current = fitToBusinesses;
  }, [fitToBusinesses]);

  useEffect(() => {
    mapCenterRef.current = mapCenter;
  }, [mapCenter]);

  useEffect(() => {
    radiusMilesRef.current = radiusMiles;
  }, [radiusMiles]);

  const reportViewportRadius = useCallback(() => {
    if (isProgrammaticFitRef.current) return;
    if (!onViewportRadiusChangeRef.current || !mapCenterRef.current || !mapRef.current) return;
    const bounds = mapRef.current.getBounds?.();
    if (!bounds) return;
    const miles = estimateRadiusMilesFromLatLngBounds(
      bounds,
      mapCenterRef.current.lat,
      mapCenterRef.current.lng,
    );
    onViewportRadiusChangeRef.current(miles);
  }, []);

  const attachViewportListener = useCallback(
    (mapsApi, map) => {
      if (idleListenerRef.current) {
        mapsApi.event.removeListener(idleListenerRef.current);
        idleListenerRef.current = null;
      }
      idleListenerRef.current = mapsApi.event.addListener(map, "idle", () => {
        if (viewportDebounceRef.current) clearTimeout(viewportDebounceRef.current);
        viewportDebounceRef.current = setTimeout(reportViewportRadius, 180);
      });
    },
    [reportViewportRadius],
  );

  useEffect(() => {
    if (!mapCenter) return;

    let cancelled = false;

    async function initMap() {
      if (!hostRef.current) return;

      const mapsApi = await loadGoogleMapsJs();
      if (cancelled || !hostRef.current) return;

      mapsApiRef.current = mapsApi;
      const center = { lat: mapCenter.lat, lng: mapCenter.lng };
      const map = new mapsApi.Map(hostRef.current, {
        center,
        zoom: DEFAULT_MAP_ZOOM,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: false,
        styles: getMapStylesForEveryCircleOnly(everyCircleOnly),
      });

      mapRef.current = map;
      infoWindowRef.current = new mapsApi.InfoWindow();

      homeMarkerRef.current = new mapsApi.Marker({
        position: center,
        map,
        title: "Your location",
        zIndex: 1000,
        icon: {
          path: mapsApi.SymbolPath.CIRCLE,
          scale: 11,
          fillColor: HOME_MARKER_COLOR,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      });

      attachViewportListener(mapsApi, map);

      await addBusinessMarkers(
        mapsApi,
        map,
        businesses,
        infoWindowRef,
        (business) => onBusinessPressRef.current?.(business),
        markersRef,
      );
    }

    initMap().catch((err) => {
      console.error("EveryCircleMapView web init failed:", err);
    });

    return () => {
      cancelled = true;
      if (viewportDebounceRef.current) clearTimeout(viewportDebounceRef.current);
      if (mapsApiRef.current && idleListenerRef.current) {
        mapsApiRef.current.event.removeListener(idleListenerRef.current);
        idleListenerRef.current = null;
      }
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      if (homeMarkerRef.current) {
        homeMarkerRef.current.setMap(null);
        homeMarkerRef.current = null;
      }
      mapRef.current = null;
      mapsApiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map shell initializes once per mount
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapCenter) return;

    const center = { lat: mapCenter.lat, lng: mapCenter.lng };
    if (homeMarkerRef.current) {
      homeMarkerRef.current.setPosition(center);
    }
    if (!fitToBusinessesRef.current) {
      mapRef.current.setCenter(center);
      mapRef.current.setZoom(DEFAULT_MAP_ZOOM);
    }
  }, [mapCenter]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setOptions({
      styles: getMapStylesForEveryCircleOnly(everyCircleOnly),
    });
  }, [everyCircleOnly]);

  useEffect(() => {
    if (!mapRef.current || !infoWindowRef.current) return;

    loadGoogleMapsJs()
      .then((mapsApi) => {
        if (!mapRef.current) return null;
        return addBusinessMarkers(
          mapsApi,
          mapRef.current,
          businesses,
          infoWindowRef,
          (business) => onBusinessPressRef.current?.(business),
          markersRef,
        );
      })
      .catch((err) => {
        console.error("EveryCircleMapView web marker update failed:", err);
      });
  }, [businesses]);

  useEffect(() => {
    if (!fitToBusinesses || fitRadiusToken <= 0 || !mapRef.current) return;

    loadGoogleMapsJs()
      .then((mapsApi) => {
        if (!mapRef.current) return;
        isProgrammaticFitRef.current = true;
        fitMapToRadius(mapsApi, mapRef.current, mapCenterRef.current, radiusMilesRef.current);
        setTimeout(() => {
          isProgrammaticFitRef.current = false;
        }, 600);
      })
      .catch((err) => {
        console.error("EveryCircleMapView web radius fit failed:", err);
      });
  }, [fitRadiusToken, fitToBusinesses]);

  const handleZoom = useCallback((zoomIn) => {
    const map = mapRef.current;
    if (!map) return;
    const current = map.getZoom() ?? DEFAULT_MAP_ZOOM;
    const next = zoomIn
      ? Math.min(current + 1, MAX_WEB_ZOOM)
      : Math.max(current - 1, MIN_WEB_ZOOM);
    map.setZoom(next);
  }, []);

  return (
    <View style={styles.container}>
      <div ref={hostRef} style={styles.mapHost} />
      <MapZoomControls onZoomIn={() => handleZoom(true)} onZoomOut={() => handleZoom(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    position: "relative",
  },
  mapHost: {
    width: "100%",
    height: "100%",
    minHeight: 400,
  },
});
