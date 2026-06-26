import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import { DEFAULT_MAP_REGION_DELTA } from "../utils/mapDefaults";
import { getMapStylesForEveryCircleOnly } from "../utils/mapStyles";

const HOME_MARKER_COLOR = "#2434C2";
const PERSON_MARKER_COLOR = "#AF52DE";

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

export default function NearbyPeopleMapView({ mapCenter, people = [], onPersonPress, radiusMiles }) {
  const mapRef = useRef(null);
  const region = useMemo(() => (mapCenter ? regionFromCenter(mapCenter) : null), [mapCenter]);

  useEffect(() => {
    if (!mapRef.current || !mapCenter) return;

    if (radiusMiles != null) {
      const clampLat = (v) => Math.max(-85, Math.min(85, v));
      const clampLng = (v) => Math.max(-180, Math.min(180, v));
      const dLat = (radiusMiles / 3959) * (180 / Math.PI);
      const dLng = dLat / Math.cos((mapCenter.lat * Math.PI) / 180);
      // Do not include people coords — null-distance users can be far away and
      // would pull the bounding box well outside the chosen radius.
      const corners = [
        { latitude: clampLat(mapCenter.lat + dLat), longitude: clampLng(mapCenter.lng - dLng) },
        { latitude: clampLat(mapCenter.lat - dLat), longitude: clampLng(mapCenter.lng + dLng) },
      ];
      mapRef.current.fitToCoordinates(corners, {
        edgePadding: { top: 8, right: 8, bottom: 8, left: 8 },
        animated: true,
      });
      return;
    }

    const coordinates = [
      { latitude: mapCenter.lat, longitude: mapCenter.lng },
      ...people.map((person) => ({ latitude: person.lat, longitude: person.lng })),
    ];

    if (coordinates.length > 1) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
      return;
    }

    if (region) {
      mapRef.current.animateToRegion(region, 400);
    }
  }, [mapCenter, people, region, radiusMiles]);

  if (!mapCenter || !region) return null;

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={region}
      scrollEnabled={true}
      zoomEnabled={true}
      rotateEnabled={false}
      pitchEnabled={false}
      customMapStyle={getMapStylesForEveryCircleOnly(true)}
    >
      <Marker
        coordinate={{ latitude: mapCenter.lat, longitude: mapCenter.lng }}
        title="Your nearby location"
        pinColor={HOME_MARKER_COLOR}
      />
      {people.map((person) => (
        <Marker
          key={person.uid}
          coordinate={{ latitude: person.lat, longitude: person.lng }}
          title={person.name}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <PersonMapMarker />
          <Callout onPress={() => onPersonPress?.(person)}>
            <TouchableOpacity onPress={() => onPersonPress?.(person)} activeOpacity={0.8}>
              <Text style={styles.calloutTitle}>{person.name}</Text>
              {person.distanceMeters != null && (
                <Text style={styles.calloutSubtitle}>{(person.distanceMeters / 1609).toFixed(1)} mi away</Text>
              )}
              <Text style={styles.calloutAction}>View profile</Text>
            </TouchableOpacity>
          </Callout>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    overflow: "hidden",
  },
  personMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: PERSON_MARKER_COLOR,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
    marginBottom: 4,
  },
  calloutSubtitle: {
    fontSize: 12,
    color: "#666",
    marginBottom: 6,
  },
  calloutAction: {
    fontSize: 12,
    fontWeight: "600",
    color: PERSON_MARKER_COLOR,
  },
});
