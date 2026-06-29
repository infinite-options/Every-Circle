import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { DEFAULT_MAP_REGION_DELTA } from "../utils/mapDefaults";
import { getMapStylesForEveryCircleOnly } from "../utils/mapStyles";
import {
  estimateRadiusMilesFromRegion,
  radiusMilesToLatLngDelta,
} from "../utils/mapRadiusSync";
import MapZoomControls from "./MapZoomControls";

const HOME_MARKER_COLOR = "#2434C2";
const PERSON_MARKER_COLOR = "#AF52DE";
const CALLOUT_WIDTH = 240;
const CALLOUT_PHOTO_SIZE = 48;
const MIN_REGION_DELTA = 0.0008;
const MAX_REGION_DELTA = 120;
const DEFAULT_PROFILE_IMAGE = require("../assets/profile.png");

function regionFromCenter(mapCenter) {
  return {
    latitude: mapCenter.lat,
    longitude: mapCenter.lng,
    latitudeDelta: DEFAULT_MAP_REGION_DELTA,
    longitudeDelta: DEFAULT_MAP_REGION_DELTA,
  };
}

function PersonMapMarker() {
  return <View style={styles.personMarker} />;
}

function resolvePersonImageSource(person) {
  const uri = person?.image ? String(person.image).trim() : "";
  if (uri) return { uri: encodeURI(uri) };
  return DEFAULT_PROFILE_IMAGE;
}

function MapPersonCalloutCard({ person, onPress }) {
  const imageSource = resolvePersonImageSource(person);
  const distanceLabel =
    person.distanceMeters != null ? `${(person.distanceMeters / 1609).toFixed(1)} mi away` : null;

  return (
    <TouchableOpacity style={styles.calloutCard} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.calloutHeaderRow}>
        <Image
          source={imageSource}
          style={styles.calloutPhoto}
          resizeMode="cover"
          defaultSource={DEFAULT_PROFILE_IMAGE}
          fadeDuration={0}
        />
        <View style={styles.calloutHeaderText}>
          <Text style={styles.calloutTitle} numberOfLines={2}>
            {person.name}
          </Text>
          {distanceLabel ? <Text style={styles.calloutItemTitle}>{distanceLabel}</Text> : null}
        </View>
      </View>
      <Text style={styles.calloutSubtitle}>On Every Circle</Text>
      <Text style={styles.calloutAction}>View profile</Text>
    </TouchableOpacity>
  );
}

export default function NearbyPeopleMapView({
  mapCenter,
  people = [],
  onPersonPress,
  radiusMiles,
  fitRadiusToken = 0,
  onViewportRadiusChange,
}) {
  const mapRef = useRef(null);
  const centerLat = mapCenter?.lat;
  const centerLng = mapCenter?.lng;
  const region = useMemo(
    () => (centerLat != null && centerLng != null ? regionFromCenter({ lat: centerLat, lng: centerLng }) : null),
    [centerLat, centerLng],
  );
  const [mapRegion, setMapRegion] = useState(region);
  const mapRegionRef = useRef(region);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const skipNextMapPressRef = useRef(false);
  const isProgrammaticFitRef = useRef(false);
  const regionChangeDebounceRef = useRef(null);
  const peopleRef = useRef(people);
  const radiusMilesRef = useRef(radiusMiles);

  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  useEffect(() => {
    radiusMilesRef.current = radiusMiles;
  }, [radiusMiles]);

  useEffect(() => {
    if (centerLat == null || centerLng == null) return;
    const current = mapRegionRef.current;
    if (
      current &&
      Math.abs(current.latitude - centerLat) < 1e-6 &&
      Math.abs(current.longitude - centerLng) < 1e-6
    ) {
      return;
    }
    const next = regionFromCenter({ lat: centerLat, lng: centerLng });
    mapRegionRef.current = next;
    setMapRegion(next);
  }, [centerLat, centerLng]);

  const reportViewportRadius = useCallback(
    (nextRegion) => {
      if (!onViewportRadiusChange || !mapCenter) return;
      if (isProgrammaticFitRef.current) return;
      const miles = estimateRadiusMilesFromRegion(nextRegion, mapCenter.lat);
      onViewportRadiusChange(miles);
    },
    [mapCenter, onViewportRadiusChange],
  );

  const finishProgrammaticFit = useCallback(() => {
    setTimeout(() => {
      isProgrammaticFitRef.current = false;
    }, 600);
  }, []);

  const fitMapToRadius = useCallback(() => {
    if (!mapRef.current || !mapCenter) return;

    isProgrammaticFitRef.current = true;
    const clampLat = (v) => Math.max(-85, Math.min(85, v));
    const clampLng = (v) => Math.max(-180, Math.min(180, v));
    const miles = radiusMilesRef.current;

    if (miles != null) {
      if (miles === 0) {
        mapRef.current.animateToRegion(region, 400);
        finishProgrammaticFit();
        return;
      }

      const { dLat, dLng } = radiusMilesToLatLngDelta(miles, mapCenter.lat);
      const corners = [
        { latitude: clampLat(mapCenter.lat + dLat), longitude: clampLng(mapCenter.lng - dLng) },
        { latitude: clampLat(mapCenter.lat - dLat), longitude: clampLng(mapCenter.lng + dLng) },
      ];
      mapRef.current.fitToCoordinates(corners, {
        edgePadding: { top: 8, right: 8, bottom: 8, left: 8 },
        animated: true,
      });
      finishProgrammaticFit();
      return;
    }

    mapRef.current.fitToCoordinates(
      [{ latitude: 75, longitude: -175 }, { latitude: -75, longitude: 175 }],
      { edgePadding: { top: 16, right: 16, bottom: 16, left: 16 }, animated: true },
    );
    finishProgrammaticFit();
  }, [finishProgrammaticFit, mapCenter, region]);

  useEffect(() => {
    if (fitRadiusToken <= 0) return;
    fitMapToRadius();
    // Only refit when the slider explicitly bumps fitRadiusToken — not when people/radius props change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRadiusToken]);

  useEffect(() => {
    if (!selectedPerson) return;
    const stillVisible = people.some((p) => p.uid === selectedPerson.uid);
    if (!stillVisible) setSelectedPerson(null);
  }, [people, selectedPerson]);

  const handleRegionChangeComplete = useCallback(
    (nextRegion) => {
      mapRegionRef.current = nextRegion;
      setMapRegion(nextRegion);
      if (regionChangeDebounceRef.current) clearTimeout(regionChangeDebounceRef.current);
      regionChangeDebounceRef.current = setTimeout(() => {
        reportViewportRadius(nextRegion);
      }, 180);
    },
    [reportViewportRadius],
  );

  useEffect(
    () => () => {
      if (regionChangeDebounceRef.current) clearTimeout(regionChangeDebounceRef.current);
    },
    [],
  );

  const handleMarkerPress = useCallback((markerId) => {
    if (markerId == null || markerId === "") return;
    skipNextMapPressRef.current = true;
    const person = peopleRef.current.find((p) => String(p.uid) === String(markerId));
    if (!person) return;
    setSelectedPerson((prev) => (prev?.uid === person.uid ? null : person));
  }, []);

  const handleMapPress = () => {
    if (skipNextMapPressRef.current) {
      skipNextMapPressRef.current = false;
      return;
    }
    setSelectedPerson(null);
  };

  const handleCalloutPress = (person) => {
    setSelectedPerson(null);
    onPersonPress?.(person);
  };

  const handleZoom = (zoomIn) => {
    const current = mapRegionRef.current;
    if (!current) return;

    const latitudeDelta = zoomIn
      ? Math.max(current.latitudeDelta / 2, MIN_REGION_DELTA)
      : Math.min(current.latitudeDelta * 2, MAX_REGION_DELTA);
    const longitudeDelta = zoomIn
      ? Math.max(current.longitudeDelta / 2, MIN_REGION_DELTA)
      : Math.min(current.longitudeDelta * 2, MAX_REGION_DELTA);
    const next = { ...current, latitudeDelta, longitudeDelta };
    mapRegionRef.current = next;
    setMapRegion(next);
    mapRef.current?.animateToRegion(next, 250);
    setTimeout(() => reportViewportRadius(next), 280);
  };

  if (!mapCenter || !region) return null;

  return (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        scrollEnabled
        zoomEnabled
        rotateEnabled={false}
        pitchEnabled={false}
        moveOnMarkerPress={false}
        customMapStyle={getMapStylesForEveryCircleOnly(true)}
        onPress={handleMapPress}
        onMarkerPress={(event) => {
          event?.stopPropagation?.();
          const { id, coordinate } = event?.nativeEvent || {};
          if (id) {
            handleMarkerPress(id);
            return;
          }
          if (coordinate) {
            const person = peopleRef.current.find(
              (p) =>
                Math.abs(p.lat - coordinate.latitude) < 0.0001 &&
                Math.abs(p.lng - coordinate.longitude) < 0.0001,
            );
            if (person) handleMarkerPress(person.uid);
          }
        }}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        <Marker
          coordinate={{ latitude: mapCenter.lat, longitude: mapCenter.lng }}
          title="Your nearby location"
          pinColor={HOME_MARKER_COLOR}
        />
        {people.map((person) => (
          <Marker
            key={person.uid}
            identifier={String(person.uid)}
            coordinate={{ latitude: person.lat, longitude: person.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <PersonMapMarker />
          </Marker>
        ))}
      </MapView>

      <MapZoomControls onZoomIn={() => handleZoom(true)} onZoomOut={() => handleZoom(false)} />

      {selectedPerson ? (
        <View style={styles.calloutOverlay} pointerEvents="box-none">
          <MapPersonCalloutCard person={selectedPerson} onPress={() => handleCalloutPress(selectedPerson)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  personMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: PERSON_MARKER_COLOR,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  calloutOverlay: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    alignItems: "center",
    zIndex: 20,
    elevation: 20,
  },
  calloutCard: {
    width: CALLOUT_WIDTH,
    maxWidth: "100%",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  calloutHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  calloutPhoto: {
    width: CALLOUT_PHOTO_SIZE,
    height: CALLOUT_PHOTO_SIZE,
    borderRadius: CALLOUT_PHOTO_SIZE / 2,
    marginRight: 10,
    backgroundColor: "#f0f0f0",
    flexShrink: 0,
  },
  calloutHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  calloutTitle: {
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 2,
    color: "#111",
  },
  calloutItemTitle: {
    fontSize: 12,
    color: "#666",
  },
  calloutSubtitle: {
    fontSize: 12,
    color: "#AF52DE",
    marginBottom: 6,
  },
  calloutAction: {
    fontSize: 12,
    color: "#2434C2",
    fontWeight: "600",
  },
});
