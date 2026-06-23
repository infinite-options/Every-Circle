import React, { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { loadGoogleMapsJs } from "../utils/googleMapsLoader";
import { DEFAULT_MAP_ZOOM } from "../utils/mapDefaults";
import { getMapStylesForEveryCircleOnly } from "../utils/mapStyles";
import { getWebMapMarkerIcon } from "../utils/mapMarkerAssets";

const HOME_MARKER_COLOR = "#2434C2";

function buildAddressLine(business) {
  const parts = [
    business.business_address_line_1,
    business.business_city,
    business.business_state,
  ].filter(Boolean);
  return parts.join(", ");
}

function fitMapToBusinesses(mapsApi, map, businesses, mapCenter) {
  if (!businesses?.length || !mapsApi?.LatLngBounds) return;

  const bounds = new mapsApi.LatLngBounds();
  businesses.forEach((business) => {
    bounds.extend({
      lat: business.business_latitude,
      lng: business.business_longitude,
    });
  });
  if (mapCenter) {
    bounds.extend({ lat: mapCenter.lat, lng: mapCenter.lng });
  }

  if (businesses.length === 1 && !mapCenter) {
    map.setCenter(bounds.getCenter());
    map.setZoom(DEFAULT_MAP_ZOOM);
    return;
  }

  map.fitBounds(bounds, 56);
}

function addBusinessMarkers(
  mapsApi,
  map,
  businesses,
  infoWindowRef,
  onBusinessPress,
  markersRef,
  fitToBusinesses,
  mapCenter
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
            ? `<div style="margin-top: 4px; font-size: 12px; color: #666;">${business.item_title}</div>`
            : "";
        const content = `
        <div style="font-family: system-ui, sans-serif; max-width: 240px;">
          <strong style="font-size: 14px;">${business.business_name || "Business"}</strong>
          ${itemTitleHtml}
          ${address ? `<div style="margin-top: 6px; font-size: 12px; color: #444;">${address}</div>` : ""}
          <div style="margin-top: 8px; font-size: 12px; color: #AF52DE;">${registeredLabel}</div>
          <button
            id="ec-map-btn-${uid}"
            type="button"
            style="margin-top: 10px; background: #AF52DE; color: #fff; border: none; border-radius: 6px; padding: 8px 12px; font-size: 12px; font-weight: 600; cursor: pointer;"
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
      fitMapToBusinesses(mapsApi, map, businesses, mapCenter);
    }
  });
}

export default function EveryCircleMapView({
  businesses = [],
  mapCenter,
  everyCircleOnly = true,
  fitToBusinesses = false,
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
        mapCenterRef.current
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
          mapCenterRef.current
        );
      })
      .catch((err) => {
        console.error("EveryCircleMapView web marker update failed:", err);
      });
  }, [businesses]);

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
