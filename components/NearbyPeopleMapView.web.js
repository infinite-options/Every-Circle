import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Text } from "react-native";
import { loadGoogleMapsJs, subscribeGoogleMapsAuthFailure } from "../utils/googleMapsLoader";
import { DEFAULT_MAP_ZOOM } from "../utils/mapDefaults";
import { getMapStylesForEveryCircleOnly } from "../utils/mapStyles";

const HOME_MARKER_COLOR = "#2434C2";
const PERSON_MARKER_COLOR = "#AF52DE";

function radiusBounds(mapsApi, center, radiusMiles) {
  const clampLat = (v) => Math.max(-85, Math.min(85, v));
  const clampLng = (v) => Math.max(-180, Math.min(180, v));
  const dLat = (radiusMiles / 3959) * (180 / Math.PI);
  const dLng = dLat / Math.cos((center.lat * Math.PI) / 180);
  const bounds = new mapsApi.LatLngBounds();
  bounds.extend({ lat: clampLat(center.lat + dLat), lng: clampLng(center.lng - dLng) });
  bounds.extend({ lat: clampLat(center.lat - dLat), lng: clampLng(center.lng + dLng) });
  return bounds;
}

function fitMapToPeople(mapsApi, map, mapCenter, people, radiusMiles) {
  if (!mapCenter) return;

  if (radiusMiles != null) {
    const bounds = radiusBounds(mapsApi, mapCenter, radiusMiles);
    // Do not extend with people — null-distance users can be far away and would
    // pull the bounds well outside the chosen radius.
    map.fitBounds(bounds, 8);
    if ((map.getZoom() ?? 3) < 3) map.setZoom(3);
    return;
  }

  if (!people?.length) {
    map.setCenter({ lat: mapCenter.lat, lng: mapCenter.lng });
    map.setZoom(DEFAULT_MAP_ZOOM);
    return;
  }

  const bounds = new mapsApi.LatLngBounds();
  bounds.extend({ lat: mapCenter.lat, lng: mapCenter.lng });
  people.forEach((person) => {
    bounds.extend({ lat: person.lat, lng: person.lng });
  });
  map.fitBounds(bounds, 48);
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
      const distMiles =
        person.distanceMeters != null ? `${(person.distanceMeters / 1609).toFixed(1)} mi away` : "";
      const uid = person.uid || "";
      const content = `
        <div style="font-family: system-ui, sans-serif; max-width: 220px;">
          <strong style="font-size: 14px;">${person.name || "Nearby user"}</strong>
          ${distMiles ? `<div style="margin-top: 6px; font-size: 12px; color: #666;">${distMiles}</div>` : ""}
          <button
            id="ec-nearby-btn-${uid}"
            type="button"
            style="margin-top: 10px; background: #AF52DE; color: #fff; border: none; border-radius: 6px; padding: 8px 12px; font-size: 12px; font-weight: 600; cursor: pointer;"
          >
            View profile
          </button>
        </div>
      `;
      infoWindowRef.current.setContent(content);
      infoWindowRef.current.open({ anchor: marker, map });
      mapsApi.event.addListener(infoWindowRef.current, "domready", () => {
        const btn = document.getElementById(`ec-nearby-btn-${uid}`);
        if (btn) {
          btn.onclick = () => onPersonPressRef.current?.(person);
        }
      });
    });

    markersRef.current.push(marker);
  });
}

const MAP_HOST_DOM_STYLE = {
  width: "100%",
  height: 220,
  minHeight: 220,
  borderRadius: 10,
  overflow: "hidden",
  backgroundColor: "#e8eaed",
};

function toLatLng(coords) {
  const lat = Number(coords?.lat);
  const lng = Number(coords?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export default function NearbyPeopleMapView({ mapCenter, people = [], onPersonPress, radiusMiles }) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const homeMarkerRef = useRef(null);
  const infoWindowRef = useRef(null);
  const onPersonPressRef = useRef(onPersonPress);
  const mapCenterRef = useRef(mapCenter);
  const peopleRef = useRef(people);
  const radiusMilesRef = useRef(radiusMiles);
  const [mapError, setMapError] = useState(null);

  useEffect(() => {
    onPersonPressRef.current = onPersonPress;
  }, [onPersonPress]);

  useEffect(() => {
    mapCenterRef.current = mapCenter;
  }, [mapCenter]);

  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  useEffect(() => {
    radiusMilesRef.current = radiusMiles;
  }, [radiusMiles]);

  useEffect(() => {
    return subscribeGoogleMapsAuthFailure((message) => {
      setMapError(message);
    });
  }, []);

  useEffect(() => {
    const center = toLatLng(mapCenter);
    if (!center) return undefined;

    let cancelled = false;

    async function initMap(attempt = 0) {
      const host = hostRef.current;
      if (!host) {
        if (!cancelled && attempt < 20) {
          requestAnimationFrame(() => {
            void initMap(attempt + 1);
          });
        }
        return;
      }

      host.style.width = "100%";
      host.style.height = "220px";
      host.style.minHeight = "220px";

      const mapsApi = await loadGoogleMapsJs();
      if (cancelled || !hostRef.current) return;

      const map = new mapsApi.Map(hostRef.current, {
        center,
        zoom: DEFAULT_MAP_ZOOM,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: "greedy",
        styles: getMapStylesForEveryCircleOnly(true),
      });

      mapRef.current = map;
      infoWindowRef.current = new mapsApi.InfoWindow();
      setMapError(null);

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

      addPeopleMarkers(mapsApi, map, peopleRef.current, infoWindowRef, onPersonPressRef, markersRef);
      fitMapToPeople(mapsApi, map, mapCenterRef.current, peopleRef.current, radiusMilesRef.current);

      const reveal = () => {
        if (cancelled || !mapRef.current) return;
        mapsApi.event.trigger(map, "resize");
        const latest = toLatLng(mapCenterRef.current) || center;
        map.setCenter(latest);
      };
      mapsApi.event.addListenerOnce(map, "idle", reveal);
      requestAnimationFrame(reveal);
    }

    initMap().catch((err) => {
      console.error("NearbyPeopleMapView web init failed:", err);
      if (!cancelled) setMapError("Map couldn't load. Check your connection and try again.");
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
    const center = toLatLng(mapCenter);
    if (!mapRef.current || !center) return;

    if (homeMarkerRef.current) {
      homeMarkerRef.current.setPosition(center);
    }

    loadGoogleMapsJs()
      .then((mapsApi) => {
        if (!mapRef.current) return;
        mapsApi.event.trigger(mapRef.current, "resize");
        addPeopleMarkers(mapsApi, mapRef.current, people, infoWindowRef, onPersonPressRef, markersRef);
        fitMapToPeople(mapsApi, mapRef.current, center, people, radiusMiles);
      })
      .catch((err) => {
        console.error("NearbyPeopleMapView web marker update failed:", err);
      });
  }, [mapCenter, people, radiusMiles]);

  if (!toLatLng(mapCenter)) return null;

  return (
    <View style={styles.container}>
      <div ref={hostRef} style={MAP_HOST_DOM_STYLE} />
      {mapError ? (
        <View style={styles.mapError}>
          <Text style={styles.mapErrorText}>{mapError}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 220,
    marginBottom: 12,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#e8eaed",
  },
  mapError: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "#e8eaed",
  },
  mapErrorText: {
    fontSize: 13,
    color: "#555",
    textAlign: "center",
  },
});

