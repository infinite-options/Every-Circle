import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  PanResponder,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import AppHeader from "../components/AppHeader";
import BottomNavBar from "../components/BottomNavBar";
import EveryCircleMapView from "../components/EveryCircleMapView";
import { BUSINESS_MAP_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "../utils/httpMiddleware";
import { useDarkMode } from "../contexts/DarkModeContext";
import { getHeaderColor } from "../config/headerColors";
import { resolveMapHomeCoords } from "../utils/resolveMapHomeCoords";
import { MAP_PLACEHOLDER_HOME } from "../utils/mapDefaults";
import {
  MAP_MARKER_BORDER_COLOR,
  MAP_MARKER_DISPLAY_SIZE,
  MAP_MARKER_IMAGE,
} from "../utils/mapMarkerAssets";

function haversineDistanceMiles(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const THUMB_SIZE = 24;

const LOG_SCALE_MIN = 1;      // 1 mi is the log scale start
const LOG_SCALE_MAX = 12500;  // ~half Earth circumference
const LOG_MIN = Math.log(LOG_SCALE_MIN);
const LOG_MAX = Math.log(LOG_SCALE_MAX);
// Reserve 1.5% of track at each end for the 0 and ∞ snap zones
const SNAP_EDGE = 0.015;

function snapMiles(raw) {
  if (raw < 10) return Math.round(raw);
  if (raw < 100) return Math.round(raw / 5) * 5;
  if (raw < 1000) return Math.round(raw / 25) * 25;
  return Math.round(raw / 100) * 100;
}

function formatMiles(miles) {
  if (miles == null) return "∞";
  if (miles === 0) return "0 mi";
  return miles >= 1000 ? `${miles.toLocaleString()} mi` : `${miles} mi`;
}

function RadiusSlider({ value, onChange, darkMode }) {
  const trackRef = useRef(200);
  const startXRef = useRef(0);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => { valueRef.current = value; });
  useEffect(() => { onChangeRef.current = onChange; });

  const mileToX = (miles) => {
    const usable = Math.max(1, trackRef.current - THUMB_SIZE);
    if (miles == null) return usable;                  // ∞ → rightmost
    if (miles <= 0) return 0;                          // 0 → leftmost
    const logPct = (Math.log(Math.max(LOG_SCALE_MIN, miles)) - LOG_MIN) / (LOG_MAX - LOG_MIN);
    return (SNAP_EDGE + logPct * (1 - 2 * SNAP_EDGE)) * usable;
  };

  const xToMile = (x) => {
    const usable = Math.max(1, trackRef.current - THUMB_SIZE);
    const pct = x / usable;
    if (pct <= SNAP_EDGE) return 0;                    // leftmost snap → 0 mi
    if (pct >= 1 - SNAP_EDGE) return null;             // rightmost snap → ∞
    const logPct = (pct - SNAP_EDGE) / (1 - 2 * SNAP_EDGE);
    return snapMiles(Math.exp(LOG_MIN + logPct * (LOG_MAX - LOG_MIN)));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const tapX = e.nativeEvent.locationX - THUMB_SIZE / 2;
        const clamped = Math.max(0, Math.min(trackRef.current - THUMB_SIZE, tapX));
        startXRef.current = clamped;
        onChangeRef.current(xToMile(clamped));
      },
      onPanResponderMove: (_, gs) => {
        const newX = Math.max(0, Math.min(trackRef.current - THUMB_SIZE, startXRef.current + gs.dx));
        onChangeRef.current(xToMile(newX));
      },
    })
  ).current;

  const thumbX = mileToX(value);

  return (
    <View
      style={sliderStyles.track}
      onLayout={(e) => { trackRef.current = e.nativeEvent.layout.width; }}
      {...panResponder.panHandlers}
    >
      <View style={[sliderStyles.rail, darkMode && sliderStyles.railDark]} />
      <View style={[sliderStyles.fill, { width: value === 0 ? 0 : thumbX + THUMB_SIZE / 2 }]} />
      <View style={[sliderStyles.thumb, { left: thumbX }, darkMode && sliderStyles.thumbDark]} />
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  track: { flex: 1, height: THUMB_SIZE, justifyContent: "center", position: "relative" },
  rail: { height: 4, backgroundColor: "#ddd", borderRadius: 2, position: "absolute", left: 0, right: 0 },
  railDark: { backgroundColor: "#555" },
  fill: { height: 4, backgroundColor: "#4F8A8B", borderRadius: 2, position: "absolute", left: 0 },
  thumb: {
    width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#4F8A8B", borderWidth: 2, borderColor: "#fff",
    position: "absolute",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 3,
  },
  thumbDark: { borderColor: "#333" },
});

export default function EveryCircleMapScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { darkMode } = useDarkMode();
  const fromSearch = route.params?.fromSearch === true;
  const searchQuery = route.params?.searchQuery || "";
  const searchResultCount = route.params?.searchResultCount ?? null;
  const searchMapBusinesses = route.params?.searchMapBusinesses;
  const searchType = route.params?.searchType || "businesses";

  const [businesses, setBusinesses] = useState([]);
  const [mapCenter, setMapCenter] = useState(null);
  const [homeLocationSource, setHomeLocationSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [everyCircleOnly, setEveryCircleOnly] = useState(true);
  const [mapRadiusMiles, setMapRadiusMiles] = useState(null);
  const mapAccent = getHeaderColor("search");

  const filteredBusinesses =
    mapRadiusMiles != null && mapCenter != null
      ? businesses.filter(
          (b) =>
            haversineDistanceMiles(mapCenter.lat, mapCenter.lng, b.business_latitude, b.business_longitude) <=
            mapRadiusMiles
        )
      : businesses;

  useEffect(() => {
    let cancelled = false;

    async function loadMapData() {
      setLoading(true);
      setError(null);
      try {
        const homeCoords = await resolveMapHomeCoords();

        if (fromSearch && Array.isArray(searchMapBusinesses)) {
          if (!cancelled) {
            setBusinesses(searchMapBusinesses);
            setMapCenter({ lat: homeCoords.lat, lng: homeCoords.lng });
            setHomeLocationSource(homeCoords.source);
          }
          return;
        }

        const businessResponse = await fetch(BUSINESS_MAP_ENDPOINT);
        const json = await businessResponse.json();
        if (!businessResponse.ok) {
          throw new Error(json?.message || "Failed to load map businesses");
        }

        if (!cancelled) {
          setBusinesses(Array.isArray(json?.result) ? json.result : []);
          setMapCenter({ lat: homeCoords.lat, lng: homeCoords.lng });
          setHomeLocationSource(homeCoords.source);
        }
      } catch (err) {
        console.error("EveryCircleMapScreen load failed:", err);
        if (!cancelled) {
          setError(err.message || "Could not load businesses for the map.");
          setBusinesses([]);
          setMapCenter({
            lat: MAP_PLACEHOLDER_HOME.lat,
            lng: MAP_PLACEHOLDER_HOME.lng,
          });
          setHomeLocationSource("placeholder");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMapData();
    return () => {
      cancelled = true;
    };
  }, [fromSearch, searchMapBusinesses]);

  const handleBack = useCallback(() => {
    if (fromSearch) {
      navigation.navigate("Search");
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [fromSearch, navigation]);

  const handleBusinessPress = useCallback(
    (business) => {
      if (!business?.business_uid) return;
      if (business.itemType === "expertise" || business.itemType === "seeking") {
        navigation.navigate("Profile", { profile_uid: business.profile_uid || business.business_uid });
      } else {
        navigation.navigate("BusinessProfile", { business_uid: business.business_uid });
      }
    },
    [navigation]
  );

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);

    if (fromSearch && Array.isArray(searchMapBusinesses)) {
      resolveMapHomeCoords()
        .then((homeCoords) => {
          setBusinesses(searchMapBusinesses);
          setMapCenter({ lat: homeCoords.lat, lng: homeCoords.lng });
          setHomeLocationSource(homeCoords.source);
        })
        .catch((err) => setError(err.message || "Could not load map data."))
        .finally(() => setLoading(false));
      return;
    }

    Promise.all([fetch(BUSINESS_MAP_ENDPOINT), resolveMapHomeCoords()])
      .then(async ([businessResponse, homeCoords]) => {
        const json = await businessResponse.json();
        if (!businessResponse.ok) {
          throw new Error(json?.message || "Failed to load map businesses");
        }
        setBusinesses(Array.isArray(json?.result) ? json.result : []);
        setMapCenter({ lat: homeCoords.lat, lng: homeCoords.lng });
        setHomeLocationSource(homeCoords.source);
      })
      .catch((err) => setError(err.message || "Could not load businesses for the map."))
      .finally(() => setLoading(false));
  }, [fromSearch, searchMapBusinesses]);

  const homeLocationLabel =
    homeLocationSource === "profile"
      ? "Centered on your home location"
      : `Centered on ${MAP_PLACEHOLDER_HOME.label}`;

  const itemLabel = searchType === "expertise" ? "offering" : searchType === "seeking" ? "seeking result" : "business";
  const itemLabelPlural = searchType === "expertise" ? "offerings" : searchType === "seeking" ? "seeking results" : "businesses";

  const summaryLabel = (() => {
    if (loading) return "Loading map...";
    if (fromSearch) {
      const querySuffix = searchQuery ? ` for "${searchQuery}"` : "";
      const shown = filteredBusinesses.length;
      const total = businesses.length;
      if (mapRadiusMiles !== null && shown < total) {
        return `${shown} of ${total} ${itemLabelPlural} within ${formatMiles(mapRadiusMiles)}${querySuffix}`;
      }
      if (searchResultCount != null && total < searchResultCount) {
        return `${total} of ${searchResultCount} ${itemLabelPlural} on the map${querySuffix}`;
      }
      return `${total} ${total === 1 ? itemLabel : itemLabelPlural} on the map${querySuffix}`;
    }
    return `${filteredBusinesses.length} ${filteredBusinesses.length === 1 ? itemLabel : itemLabelPlural} on Every Circle`;
  })();

  const emptyMessage = fromSearch
    ? mapRadiusMiles === 0
      ? "Radius is 0 mi — slide right to expand."
      : mapRadiusMiles !== null
        ? `No ${itemLabelPlural} within ${formatMiles(mapRadiusMiles)}. Slide right to expand.`
        : `No ${itemLabelPlural} with location coordinates to display.`
    : `No ${itemLabelPlural} with coordinates yet.`;

  return (
    <SafeAreaView
      style={[styles.container, darkMode && styles.containerDark]}
      edges={["top", "left", "right"]}
    >
      <AppHeader
        title="Every Circle Map"
        backgroundColor="#4F8A8B"
        onBackPress={handleBack}
      />

      <View style={styles.summaryBar}>
        <Text style={[styles.summaryText, darkMode && styles.summaryTextDark]}>
          {summaryLabel}
        </Text>
        {!loading && mapCenter && (
          <Text style={[styles.subtleText, darkMode && styles.summaryTextDark]}>
            {fromSearch
              ? "Showing your current search results. " + homeLocationLabel.toLowerCase()
              : homeLocationLabel}
          </Text>
        )}
        <View style={styles.legendRow}>
          <View style={styles.legendDotHome} />
          <Text style={[styles.legendText, darkMode && styles.summaryTextDark]}>
            Your location
          </Text>
          <View style={styles.legendMarkerWrap}>
            <Image
              source={MAP_MARKER_IMAGE}
              style={styles.legendMarkerImage}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.legendText, darkMode && styles.summaryTextDark]}>
            Every Circle businesses
          </Text>
        </View>
        {!loading && (
          <View style={[styles.toggleRow, darkMode && styles.toggleRowDark]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleLabel, darkMode && styles.summaryTextDark]}>
                Every Circle only
              </Text>
              <Text style={[styles.toggleHint, darkMode && styles.summaryTextDark]}>
                {everyCircleOnly
                  ? "Hiding other map businesses and places"
                  : "Showing all Google map places"}
              </Text>
            </View>
            <Switch
              value={everyCircleOnly}
              onValueChange={setEveryCircleOnly}
              trackColor={{
                false: darkMode ? "#555" : "#767577",
                true: "rgba(79, 138, 139, 0.45)",
              }}
              thumbColor={everyCircleOnly ? mapAccent : "#f4f3f4"}
              ios_backgroundColor={darkMode ? "#555" : "#767577"}
              accessibilityLabel="Every Circle only map mode"
            />
          </View>
        )}
      </View>

      {!loading && !error && fromSearch && (
        <View style={[styles.radiusBar, darkMode && styles.radiusBarDark]}>
          <Text style={[styles.radiusLabel, darkMode && styles.radiusLabelDark]}>Nearby:</Text>
          <RadiusSlider value={mapRadiusMiles} onChange={setMapRadiusMiles} darkMode={darkMode} />
          <View style={styles.radiusValueWrap}>
            {mapRadiusMiles !== null ? (
              <TouchableOpacity
                onPress={() => setMapRadiusMiles(null)}
                style={styles.radiusClearBtn}
                accessibilityLabel="Clear radius filter"
              >
                <Text style={styles.radiusValueActive}>{formatMiles(mapRadiusMiles)}</Text>
                <Text style={styles.radiusClearIcon}> ✕</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.radiusValueActive, { fontSize: 16 }]}>∞</Text>
            )}
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#AF52DE" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, darkMode && styles.summaryTextDark]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.mapWrap}>
          {mapCenter && (
            <EveryCircleMapView
              businesses={filteredBusinesses}
              mapCenter={mapCenter}
              everyCircleOnly={everyCircleOnly}
              fitToBusinesses={fromSearch && filteredBusinesses.length > 0}
              onBusinessPress={handleBusinessPress}
            />
          )}
          {!filteredBusinesses.length && (
            <View style={styles.emptyOverlay} pointerEvents="none">
              <Text style={styles.emptyText}>{emptyMessage}</Text>
            </View>
          )}
        </View>
      )}

      {Platform.OS === "web" && !loading && !error && businesses.length > 0 && (
        <View style={styles.hintBar}>
          <Text style={[styles.hintText, darkMode && styles.summaryTextDark]}>
            Pan and zoom to explore. Tap a marker to open a business profile.
          </Text>
        </View>
      )}

      <BottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  containerDark: {
    backgroundColor: "#1a1a1a",
  },
  summaryBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  summaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#222",
  },
  subtleText: {
    fontSize: 13,
    color: "#555",
    marginTop: 4,
  },
  summaryTextDark: {
    color: "#f2f2f2",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 8,
  },
  legendDotHome: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2434C2",
    borderWidth: 1,
    borderColor: "#fff",
  },
  legendMarkerWrap: {
    width: MAP_MARKER_DISPLAY_SIZE.width,
    height: MAP_MARKER_DISPLAY_SIZE.height,
    borderRadius: MAP_MARKER_DISPLAY_SIZE.width / 2,
    borderWidth: 2,
    borderColor: MAP_MARKER_BORDER_COLOR,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  legendMarkerImage: {
    width: 14,
    height: 14,
  },
  legendText: {
    fontSize: 13,
    color: "#555",
    marginRight: 8,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ddd",
  },
  toggleRowDark: {
    borderTopColor: "#444",
  },
  toggleCopy: {
    flex: 1,
    paddingRight: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
  },
  toggleHint: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  mapWrap: {
    flex: 1,
    minHeight: 320,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 15,
    color: "#b00020",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#AF52DE",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
  },
  emptyOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyText: {
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
    color: "#444",
    textAlign: "center",
  },
  hintBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 52,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ddd",
  },
  hintText: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
  },
  radiusBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
    backgroundColor: "#fff",
  },
  radiusBarDark: {
    backgroundColor: "#1a1a1a",
    borderBottomColor: "#444",
  },
  radiusLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#555",
    marginRight: 10,
    flexShrink: 0,
  },
  radiusLabelDark: {
    color: "#aaa",
  },
  radiusValueWrap: {
    marginLeft: 10,
    minWidth: 80,
    alignItems: "flex-end",
    flexShrink: 0,
  },
  radiusClearBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  radiusValueActive: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4F8A8B",
  },
  radiusClearIcon: {
    fontSize: 12,
    color: "#4F8A8B",
  },
});
