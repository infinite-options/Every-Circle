import React, { useEffect, useMemo, useRef } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import { DEFAULT_MAP_REGION_DELTA } from "../utils/mapDefaults";
import { getMapStylesForEveryCircleOnly } from "../utils/mapStyles";
import {
  getNativeMapMarkerImage,
  MAP_MARKER_BORDER_COLOR,
  MAP_MARKER_BORDER_WIDTH,
  MAP_MARKER_DISPLAY_SIZE,
  MAP_MARKER_INNER_SIZE,
} from "../utils/mapMarkerAssets";

function regionFromCenter(mapCenter) {
  if (!mapCenter) {
    return {
      latitude: 37.7893,
      longitude: -122.3966,
      latitudeDelta: DEFAULT_MAP_REGION_DELTA,
      longitudeDelta: DEFAULT_MAP_REGION_DELTA,
    };
  }

  return {
    latitude: mapCenter.lat,
    longitude: mapCenter.lng,
    latitudeDelta: DEFAULT_MAP_REGION_DELTA,
    longitudeDelta: DEFAULT_MAP_REGION_DELTA,
  };
}

function BusinessMapMarker() {
  return (
    <View style={styles.markerWrap}>
      <Image
        source={getNativeMapMarkerImage()}
        style={styles.markerImage}
        resizeMode="contain"
      />
    </View>
  );
}

export default function EveryCircleMapView({
  businesses = [],
  mapCenter,
  everyCircleOnly = true,
  onBusinessPress,
}) {
  const mapRef = useRef(null);
  const region = useMemo(() => regionFromCenter(mapCenter), [mapCenter]);

  useEffect(() => {
    if (mapRef.current && mapCenter) {
      mapRef.current.animateToRegion(region, 400);
    }
  }, [mapCenter, region]);

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={region}
      customMapStyle={getMapStylesForEveryCircleOnly(everyCircleOnly)}
    >
      {mapCenter && (
        <Marker
          coordinate={{ latitude: mapCenter.lat, longitude: mapCenter.lng }}
          title="Your location"
          pinColor="#2434C2"
        />
      )}
      {businesses.map((business) => (
        <Marker
          key={business.business_uid}
          coordinate={{
            latitude: business.business_latitude,
            longitude: business.business_longitude,
          }}
          title={business.business_name}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <BusinessMapMarker />
          <Callout onPress={() => onBusinessPress?.(business)}>
            <TouchableOpacity onPress={() => onBusinessPress?.(business)} activeOpacity={0.8}>
              <Text style={styles.calloutTitle}>{business.business_name}</Text>
              <Text style={styles.calloutSubtitle}>Registered on Every Circle</Text>
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
    flex: 1,
    width: "100%",
  },
  markerWrap: {
    width: MAP_MARKER_DISPLAY_SIZE.width,
    height: MAP_MARKER_DISPLAY_SIZE.height,
    borderRadius: MAP_MARKER_DISPLAY_SIZE.width / 2,
    borderWidth: MAP_MARKER_BORDER_WIDTH,
    borderColor: MAP_MARKER_BORDER_COLOR,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  markerImage: {
    width: MAP_MARKER_INNER_SIZE,
    height: MAP_MARKER_INNER_SIZE,
  },
  calloutTitle: {
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 4,
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
