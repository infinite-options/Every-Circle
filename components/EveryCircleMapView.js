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
import { resolveMapBusinessImageUrl, shouldShowMapBusinessImage } from "../utils/mapBusinessImage";

let DEFAULT_PROFILE_IMAGE;
try {
  DEFAULT_PROFILE_IMAGE = require("../assets/profile.png");
} catch {
  DEFAULT_PROFILE_IMAGE = null;
}

function getCalloutImageSource(business) {
  if (shouldShowMapBusinessImage(business)) {
    const uri = resolveMapBusinessImageUrl(business);
    if (uri) return { uri };
  }
  return DEFAULT_PROFILE_IMAGE || require("../assets/profile.png");
}

function buildAddressLine(business) {
  const parts = [
    business.business_address_line_1,
    business.business_city,
    business.business_state,
  ].filter(Boolean);
  return parts.join(", ");
}

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
  fitToBusinesses = false,
  radiusMiles,
  onBusinessPress,
}) {
  const mapRef = useRef(null);
  const region = useMemo(() => regionFromCenter(mapCenter), [mapCenter]);

  useEffect(() => {
    if (!mapRef.current || !mapCenter) return;

    if (fitToBusinesses) {
      if (radiusMiles != null) {
        if (radiusMiles === 0) {
          mapRef.current.animateToRegion(region, 400);
          return;
        }
        const clampLat = (v) => Math.max(-85, Math.min(85, v));
        const clampLng = (v) => Math.max(-180, Math.min(180, v));
        const dLat = (radiusMiles / 3959) * (180 / Math.PI);
        const dLng = dLat / Math.cos((mapCenter.lat * Math.PI) / 180);
        const corners = [
          { latitude: clampLat(mapCenter.lat + dLat), longitude: clampLng(mapCenter.lng - dLng) },
          { latitude: clampLat(mapCenter.lat - dLat), longitude: clampLng(mapCenter.lng + dLng) },
          ...businesses.map((b) => ({ latitude: b.business_latitude, longitude: b.business_longitude })),
        ];
        mapRef.current.fitToCoordinates(corners, {
          edgePadding: { top: 8, right: 8, bottom: 8, left: 8 },
          animated: true,
        });
        return;
      }

      // null radius = ∞: fit to world corners so the entire map is visible
      mapRef.current.fitToCoordinates(
        [{ latitude: 75, longitude: -175 }, { latitude: -75, longitude: 175 }],
        { edgePadding: { top: 16, right: 16, bottom: 16, left: 16 }, animated: true }
      );
      return;
    }

    mapRef.current.animateToRegion(region, 400);
  }, [businesses, fitToBusinesses, mapCenter, region, radiusMiles]);

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
              <View style={styles.calloutRow}>
                <Image
                  source={getCalloutImageSource(business)}
                  style={styles.calloutImage}
                  defaultSource={DEFAULT_PROFILE_IMAGE || undefined}
                />
                <View style={styles.calloutTextCol}>
                  <Text style={styles.calloutTitle}>{business.business_name}</Text>
                  {business.item_title ? (
                    <Text style={styles.calloutItemTitle}>{business.item_title}</Text>
                  ) : null}
                  {buildAddressLine(business) ? (
                    <Text style={styles.calloutAddress}>{buildAddressLine(business)}</Text>
                  ) : null}
                  <Text style={styles.calloutSubtitle}>
                    {business.itemType === "expertise"
                      ? "Offering on Every Circle"
                      : business.itemType === "seeking"
                        ? "Seeking on Every Circle"
                        : "Registered on Every Circle"}
                  </Text>
                  <Text style={styles.calloutAction}>View profile</Text>
                </View>
              </View>
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
  calloutRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    maxWidth: 260,
  },
  calloutImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f5f5f5",
    marginRight: 10,
  },
  calloutTextCol: {
    flex: 1,
    minWidth: 0,
  },
  calloutTitle: {
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 2,
  },
  calloutItemTitle: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  calloutAddress: {
    fontSize: 12,
    color: "#444",
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
