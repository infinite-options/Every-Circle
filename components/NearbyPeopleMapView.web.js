import React, { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { loadGoogleMapsJs } from "../utils/googleMapsLoader";
import { DEFAULT_MAP_ZOOM } from "../utils/mapDefaults";
import { getMapStylesForEveryCircleOnly } from "../utils/mapStyles";
import {
  estimateRadiusMilesFromLatLngBounds,
  radiusMilesToLatLngDelta,
} from "../utils/mapRadiusSync";
import MapZoomControls from "./MapZoomControls";

const HOME_MARKER_COLOR = "#2434C2";
const PERSON_MARKER_COLOR = "#AF52DE";
const MIN_WEB_ZOOM = 2;
const MAX_WEB_ZOOM = 20;

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

function buildPersonCalloutHtml(person) {
  const distMiles =
    person.distanceMeters != null ? `${(person.distanceMeters / 1609).toFixed(1)} mi away` : "";
  const uid = person.uid || "";
  const profileUrl = person.image ? encodeURI(String(person.image).trim()) : "";
  const photoHtml = profileUrl
    ? `<img
        src="${profileUrl}"
        width="48"
        height="48"
        alt=""
        style="display: block; width: 48px; height: 48px; border-radius: 50%; object-fit: cover; background: #f0f0f0; flex-shrink: 0;"
      />`
    : `<div style="width: 48px; height: 48px; border-radius: 50%; background: #e8e8e8; flex-shrink: 0;"></div>`;

  return `
    <div
      id="ec-nearby-card-${uid}"
      role="button"
      tabindex="0"
      style="font-family: system-ui, sans-serif; width: 240px; max-width: 240px; box-sizing: border-box; cursor: pointer;"
    >
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        ${photoHtml}
        <div style="min-width: 0; flex: 1;">
          <strong style="display: block; font-size: 14px; line-height: 1.35; word-break: break-word;">${person.name || "Nearby user"}</strong>
          ${distMiles ? `<div style="margin-top: 4px; font-size: 12px; color: #666; line-height: 1.35;">${distMiles}</div>` : ""}
        </div>
      </div>
      <div style="font-size: 12px; color: #AF52DE; line-height: 1.35;">On Every Circle</div>
      <div style="margin-top: 8px; font-size: 12px; color: #2434C2; font-weight: 600;">View profile</div>
    </div>
  `;
}

function addPeopleMarkers(mapsApi, map, people, infoWindowRef, onPersonPressRef, markersRef) {
  markersRef.current.forEach((marker) => marker.setMap(null));
  markersRef.current = [];

  people.forEach((person) => {
    const marker = new mapsApi.Marker({
      position: { lat: person.lat, lng: person.lng },
      map,
      title: person.name || "Nearby user",
      zIndex: 500,
      icon: {
        path: mapsApi.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: PERSON_MARKER_COLOR,
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
    });

    marker.addListener("click", () => {
      const content = buildPersonCalloutHtml(person);
      const uid = person.uid || "";
      infoWindowRef.current.setContent(content);
      infoWindowRef.current.open({ anchor: marker, map });
      mapsApi.event.addListener(infoWindowRef.current, "domready", () => {
        const card = document.getElementById(`ec-nearby-card-${uid}`);
        if (card) {
          card.onclick = () => onPersonPressRef.current?.(person);
        }
      });
    });

    markersRef.current.push(marker);
  });
}

export default function NearbyPeopleMapView({
  mapCenter,
  people = [],
  onPersonPress,
  radiusMiles,
  fitRadiusToken = 0,
  onViewportRadiusChange,
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
  const onPersonPressRef = useRef(onPersonPress);
  const onViewportRadiusChangeRef = useRef(onViewportRadiusChange);
  const mapCenterRef = useRef(mapCenter);
  const peopleRef = useRef(people);
  const radiusMilesRef = useRef(radiusMiles);

  useEffect(() => {
    onPersonPressRef.current = onPersonPress;
  }, [onPersonPress]);

  useEffect(() => {
    onViewportRadiusChangeRef.current = onViewportRadiusChange;
  }, [onViewportRadiusChange]);

  useEffect(() => {
    mapCenterRef.current = mapCenter;
  }, [mapCenter]);

  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

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
        fullscreenControl: false,
        zoomControl: false,
        gestureHandling: "greedy",
        styles: getMapStylesForEveryCircleOnly(true),
      });

      mapRef.current = map;
      infoWindowRef.current = new mapsApi.InfoWindow();

      homeMarkerRef.current = new mapsApi.Marker({
        position: center,
        map,
        title: "Your nearby location",
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
      addPeopleMarkers(mapsApi, map, peopleRef.current, infoWindowRef, onPersonPressRef, markersRef);
      isProgrammaticFitRef.current = true;
      fitMapToRadius(mapsApi, map, mapCenterRef.current, radiusMilesRef.current);
      setTimeout(() => {
        isProgrammaticFitRef.current = false;
      }, 600);
    }

    initMap().catch((err) => {
      console.error("NearbyPeopleMapView web init failed:", err);
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
  }, [mapCenter]);

  useEffect(() => {
    if (!mapRef.current || !infoWindowRef.current) return;

    loadGoogleMapsJs()
      .then((mapsApi) => {
        if (!mapRef.current) return;
        addPeopleMarkers(mapsApi, mapRef.current, people, infoWindowRef, onPersonPressRef, markersRef);
      })
      .catch((err) => {
        console.error("NearbyPeopleMapView web marker update failed:", err);
      });
  }, [people]);

  useEffect(() => {
    if (fitRadiusToken <= 0 || !mapRef.current) return;

    loadGoogleMapsJs()
      .then((mapsApi) => {
        if (!mapRef.current) return;
        isProgrammaticFitRef.current = true;
        fitMapToRadius(
          mapsApi,
          mapRef.current,
          mapCenterRef.current,
          radiusMilesRef.current,
        );
        setTimeout(() => {
          isProgrammaticFitRef.current = false;
        }, 600);
      })
      .catch((err) => {
        console.error("NearbyPeopleMapView web radius fit failed:", err);
      });
  }, [fitRadiusToken]);

  const handleZoom = useCallback((zoomIn) => {
    const map = mapRef.current;
    if (!map) return;
    const current = map.getZoom() ?? DEFAULT_MAP_ZOOM;
    const next = zoomIn
      ? Math.min(current + 1, MAX_WEB_ZOOM)
      : Math.max(current - 1, MIN_WEB_ZOOM);
    map.setZoom(next);
  }, []);

  if (!mapCenter) return null;

  return (
    <View style={styles.container}>
      <div ref={hostRef} style={styles.mapHost} />
      <MapZoomControls onZoomIn={() => handleZoom(true)} onZoomOut={() => handleZoom(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  mapHost: {
    width: "100%",
    height: "100%",
  },
});
