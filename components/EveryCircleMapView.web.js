import React, { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { loadGoogleMapsJs } from "../utils/googleMapsLoader";
import { DEFAULT_MAP_ZOOM } from "../utils/mapDefaults";
import { getMapStylesForEveryCircleOnly } from "../utils/mapStyles";
import { getWebMapMarkerIcon } from "../utils/mapMarkerAssets";
import { resolveMapBusinessImageUrl, shouldShowMapBusinessImage } from "../utils/mapBusinessImage";

const HOME_MARKER_COLOR = "#2434C2";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildBusinessImageHtml(business) {
  if (!shouldShowMapBusinessImage(business)) return "";
  const imageUrl = resolveMapBusinessImageUrl(business);
  if (!imageUrl) return "";
  return `
    <img
      src="${escapeHtml(imageUrl)}"
      alt=""
      style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid #ddd;"
    />
  `;
}

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

function fitMapToBusinesses(mapsApi, map, businesses, mapCenter, radiusMiles) {
  if (!mapsApi?.LatLngBounds) return;

  if (radiusMiles != null && mapCenter) {
    if (radiusMiles === 0) {
      map.setCenter({ lat: mapCenter.lat, lng: mapCenter.lng });
      map.setZoom(DEFAULT_MAP_ZOOM);
      return;
    }
    const dLat = (radiusMiles / 3959) * (180 / Math.PI);
    const dLng = dLat / Math.cos((mapCenter.lat * Math.PI) / 180);
    const bounds = new mapsApi.LatLngBounds();
    bounds.extend({ lat: clampLat(mapCenter.lat + dLat), lng: clampLng(mapCenter.lng - dLng) });
    bounds.extend({ lat: clampLat(mapCenter.lat - dLat), lng: clampLng(mapCenter.lng + dLng) });
    businesses.forEach((b) => bounds.extend({ lat: b.business_latitude, lng: b.business_longitude }));
    map.fitBounds(bounds, 8);
    // Zoom 2 world = 1024px; any wider viewport duplicates tiles — floor at 3
    if ((map.getZoom() ?? 3) < 3) map.setZoom(3);
    return;
  }

  // null radius = ∞: zoom to world view so all results are visible in global context
  if (mapCenter) {
    map.setCenter({ lat: mapCenter.lat, lng: mapCenter.lng });
  }
  map.setZoom(3);
}

function addBusinessMarkers(
  mapsApi,
  map,
  businesses,
  infoWindowRef,
  onBusinessPress,
  markersRef,
  fitToBusinesses,
  mapCenter,
  radiusMiles
) {
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
            ? `<div style="margin-top: 4px; font-size: 12px; color: #666;">${escapeHtml(business.item_title)}</div>`
            : "";
        const imageHtml = buildBusinessImageHtml(business);
        const content = `
        <div style="font-family: system-ui, sans-serif; max-width: 280px;">
          <div style="display: flex; gap: 10px; align-items: flex-start;">
            ${imageHtml}
            <div style="flex: 1; min-width: 0;">
              <strong style="font-size: 14px;">${escapeHtml(business.business_name || "Business")}</strong>
              ${itemTitleHtml}
              ${address ? `<div style="margin-top: 6px; font-size: 12px; color: #444;">${escapeHtml(address)}</div>` : ""}
              <div style="margin-top: 8px; font-size: 12px; color: #AF52DE;">${escapeHtml(registeredLabel)}</div>
            </div>
          </div>
          <button
            id="ec-map-btn-${uid}"
            type="button"
            style="margin-top: 10px; background: #AF52DE; color: #fff; border: none; border-radius: 6px; padding: 8px 12px; font-size: 12px; font-weight: 600; cursor: pointer; width: 100%;"
          >
            View on Every Circle
          </button>
        </div>
      `;
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

    if (fitToBusinesses) {
      fitMapToBusinesses(mapsApi, map, businesses, mapCenter, radiusMiles);
    }
  });
}

export default function EveryCircleMapView({
  businesses = [],
  mapCenter,
  everyCircleOnly = true,
  fitToBusinesses = false,
  radiusMiles,
  onBusinessPress,
}) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const homeMarkerRef = useRef(null);
  const infoWindowRef = useRef(null);
  const onBusinessPressRef = useRef(onBusinessPress);
  const fitToBusinessesRef = useRef(fitToBusinesses);
  const mapCenterRef = useRef(mapCenter);
  const radiusMilesRef = useRef(radiusMiles);

  useEffect(() => {
    onBusinessPressRef.current = onBusinessPress;
  }, [onBusinessPress]);

  useEffect(() => {
    fitToBusinessesRef.current = fitToBusinesses;
  }, [fitToBusinesses]);

  useEffect(() => {
    mapCenterRef.current = mapCenter;
  }, [mapCenter]);

  useEffect(() => {
    radiusMilesRef.current = radiusMiles;
  }, [radiusMiles]);

  useEffect(() => {
    if (!mapCenter) return;

    let cancelled = false;

    async function initMap() {
      if (!hostRef.current) return;

      const mapsApi = await loadGoogleMapsJs();
      if (cancelled || !hostRef.current) return;

      const center = { lat: mapCenter.lat, lng: mapCenter.lng };
      const map = new mapsApi.Map(hostRef.current, {
        center,
        zoom: DEFAULT_MAP_ZOOM,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
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

      await addBusinessMarkers(
        mapsApi,
        map,
        businesses,
        infoWindowRef,
        (business) => onBusinessPressRef.current?.(business),
        markersRef,
        fitToBusinessesRef.current,
        mapCenterRef.current,
        radiusMilesRef.current
      );
    }

    initMap().catch((err) => {
      console.error("EveryCircleMapView web init failed:", err);
    });

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      if (homeMarkerRef.current) {
        homeMarkerRef.current.setMap(null);
        homeMarkerRef.current = null;
      }
      mapRef.current = null;
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
          fitToBusinessesRef.current,
          mapCenterRef.current,
          radiusMiles
        );
      })
      .catch((err) => {
        console.error("EveryCircleMapView web marker update failed:", err);
      });
  }, [businesses, radiusMiles]);

  return (
    <View style={styles.container}>
      <div ref={hostRef} style={styles.mapHost} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },
  mapHost: {
    width: "100%",
    height: "100%",
    minHeight: 400,
  },
});
