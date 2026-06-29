import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { DEFAULT_MAP_REGION_DELTA } from "../utils/mapDefaults";
import { getMapStylesForEveryCircleOnly } from "../utils/mapStyles";
import {
  estimateRadiusMilesFromRegion,
  radiusMilesToLatLngDelta,
} from "../utils/mapRadiusSync";
import {
  MAP_MARKER_CALLOUT_IMAGE,
  MAP_MARKER_PIN_IMAGE,
} from "../utils/mapMarkerAssets";
import { resolveBusinessProfileImage } from "../utils/resolveBusinessProfileImage";
import MapZoomControls from "./MapZoomControls";

const CALLOUT_WIDTH = 240;
const CALLOUT_PHOTO_SIZE = 48;
const CALLOUT_BADGE_SIZE = 18;
const MIN_REGION_DELTA = 0.0008;
const MAX_REGION_DELTA = 120;
const DEFAULT_PROFILE_IMAGE = require("../assets/profile.png");

const markerPinSource = Image.resolveAssetSource(MAP_MARKER_PIN_IMAGE);
const calloutLogoSource = Image.resolveAssetSource(MAP_MARKER_CALLOUT_IMAGE);

function businessRegisteredLabel(business) {
  if (business.itemType === "expertise") return "Offering on Every Circle";
  if (business.itemType === "seeking") return "Seeking on Every Circle";
  return "Registered on Every Circle";
}

function resolveMapBusinessImageSource(business) {
  const uri = resolveBusinessProfileImage(business);
  if (uri && String(uri).trim()) {
    return { uri: encodeURI(String(uri).trim()) };
  }
  return DEFAULT_PROFILE_IMAGE;
}

function MapBusinessCalloutCard({ business, onPress }) {
  const imageSource = resolveMapBusinessImageSource(business);

  return (
    <TouchableOpacity style={styles.calloutCard} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.calloutHeaderRow}>
        <View style={styles.calloutPhotoWrap}>
          <Image
            source={imageSource}
            style={styles.calloutPhoto}
            resizeMode="cover"
            defaultSource={DEFAULT_PROFILE_IMAGE}
            fadeDuration={0}
          />
          <View style={styles.calloutPhotoBadgeWrap}>
            <Image
              source={calloutLogoSource}
              style={styles.calloutPhotoBadge}
              resizeMode="contain"
              fadeDuration={0}
            />
          </View>
        </View>
        <View style={styles.calloutHeaderText}>
          <Text style={styles.calloutTitle} numberOfLines={2}>
            {business.business_name}
          </Text>
          {business.item_title ? (
            <Text style={styles.calloutItemTitle} numberOfLines={2}>
              {business.item_title}
            </Text>
          ) : null}
        </View>
      </View>
      <Text style={styles.calloutSubtitle}>{businessRegisteredLabel(business)}</Text>
      <Text style={styles.calloutAction}>View profile</Text>
    </TouchableOpacity>
  );
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
  const mapRef = useRef(null);
  const region = useMemo(() => regionFromCenter(mapCenter), [mapCenter]);
  const [mapRegion, setMapRegion] = useState(region);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const skipNextMapPressRef = useRef(false);
  const isProgrammaticFitRef = useRef(false);
  const regionChangeDebounceRef = useRef(null);
  const businessesRef = useRef(businesses);

  useEffect(() => {
    businessesRef.current = businesses;
  }, [businesses]);

  useEffect(() => {
    setMapRegion(region);
  }, [region]);

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
    if (!mapRef.current || !mapCenter || !fitToBusinesses) return;

    isProgrammaticFitRef.current = true;

    if (radiusMiles != null) {
      if (radiusMiles === 0) {
        mapRef.current.animateToRegion(region, 400);
        finishProgrammaticFit();
        return;
      }

      const clampLat = (v) => Math.max(-85, Math.min(85, v));
      const clampLng = (v) => Math.max(-180, Math.min(180, v));
      const { dLat, dLng } = radiusMilesToLatLngDelta(radiusMiles, mapCenter.lat);
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
      { edgePadding: { top: 16, right: 16, bottom: 16, left: 16 }, animated: true }
    );
    finishProgrammaticFit();
  }, [fitToBusinesses, finishProgrammaticFit, mapCenter, radiusMiles, region]);

  useEffect(() => {
    if (!fitToBusinesses || fitRadiusToken <= 0) return;
    fitMapToRadius();
  }, [fitRadiusToken, fitToBusinesses, fitMapToRadius]);

  useEffect(() => {
    [markerPinSource?.uri, calloutLogoSource?.uri]
      .filter(Boolean)
      .forEach((uri) => {
        Image.prefetch(uri).catch(() => {});
      });
  }, []);

  useEffect(() => {
    businesses.forEach((business) => {
      const uri = resolveBusinessProfileImage(business);
      if (uri && String(uri).trim()) {
        Image.prefetch(encodeURI(String(uri).trim())).catch(() => {});
      }
    });
  }, [businesses]);

  useEffect(() => {
    if (!selectedBusiness) return;
    const stillVisible = businesses.some((b) => b.business_uid === selectedBusiness.business_uid);
    if (!stillVisible) setSelectedBusiness(null);
  }, [businesses, selectedBusiness]);

  const handleRegionChangeComplete = useCallback(
    (nextRegion) => {
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
    const business = businessesRef.current.find((b) => String(b.business_uid) === String(markerId));
    if (!business) return;
    setSelectedBusiness((prev) => (prev?.business_uid === business.business_uid ? null : business));
  }, []);

  const handleMapPress = () => {
    if (skipNextMapPressRef.current) {
      skipNextMapPressRef.current = false;
      return;
    }
    setSelectedBusiness(null);
  };

  const handleCalloutPress = (business) => {
    setSelectedBusiness(null);
    onBusinessPress?.(business);
  };

  const handleZoom = (zoomIn) => {
    setMapRegion((current) => {
      const latitudeDelta = zoomIn
        ? Math.max(current.latitudeDelta / 2, MIN_REGION_DELTA)
        : Math.min(current.latitudeDelta * 2, MAX_REGION_DELTA);
      const longitudeDelta = zoomIn
        ? Math.max(current.longitudeDelta / 2, MIN_REGION_DELTA)
        : Math.min(current.longitudeDelta * 2, MAX_REGION_DELTA);
      const next = { ...current, latitudeDelta, longitudeDelta };
      mapRef.current?.animateToRegion(next, 250);
      setTimeout(() => reportViewportRadius(next), 280);
      return next;
    });
  };

  return (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        customMapStyle={getMapStylesForEveryCircleOnly(everyCircleOnly)}
        moveOnMarkerPress={false}
        onPress={handleMapPress}
        onMarkerPress={(event) => {
          event?.stopPropagation?.();
          const { id, coordinate } = event?.nativeEvent || {};
          if (id) {
            handleMarkerPress(id);
            return;
          }
          if (coordinate) {
            const business = businessesRef.current.find(
              (b) =>
                Math.abs(b.business_latitude - coordinate.latitude) < 0.0001 &&
                Math.abs(b.business_longitude - coordinate.longitude) < 0.0001,
            );
            if (business) handleMarkerPress(business.business_uid);
          }
        }}
        onRegionChangeComplete={handleRegionChangeComplete}
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
            identifier={String(business.business_uid)}
            coordinate={{
              latitude: business.business_latitude,
              longitude: business.business_longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            image={markerPinSource}
            tracksViewChanges={false}
          />
        ))}
      </MapView>

      <MapZoomControls onZoomIn={() => handleZoom(true)} onZoomOut={() => handleZoom(false)} />

      {selectedBusiness ? (
        <View style={styles.calloutOverlay} pointerEvents="box-none">
          <MapBusinessCalloutCard
            business={selectedBusiness}
            onPress={() => handleCalloutPress(selectedBusiness)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    width: "100%",
    overflow: "visible",
  },
  map: {
    flex: 1,
    width: "100%",
  },
  calloutOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 16,
    alignItems: "center",
    zIndex: 20,
    elevation: 20,
  },
  calloutCard: {
    width: CALLOUT_WIDTH,
    maxWidth: "100%",
    paddingVertical: 12,
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
  calloutPhotoWrap: {
    width: CALLOUT_PHOTO_SIZE,
    height: CALLOUT_PHOTO_SIZE,
    marginRight: 10,
    flexShrink: 0,
  },
  calloutPhoto: {
    width: CALLOUT_PHOTO_SIZE,
    height: CALLOUT_PHOTO_SIZE,
    borderRadius: CALLOUT_PHOTO_SIZE / 2,
    backgroundColor: "#f0f0f0",
  },
  calloutPhotoBadgeWrap: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: CALLOUT_BADGE_SIZE,
    height: CALLOUT_BADGE_SIZE,
    borderRadius: CALLOUT_BADGE_SIZE / 2,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#AF52DE",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  calloutPhotoBadge: {
    width: 12,
    height: 12,
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
    marginBottom: 2,
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
