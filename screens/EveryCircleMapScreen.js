import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import AppHeader from "../components/AppHeader";
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

export default function EveryCircleMapScreen() {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();
  const [businesses, setBusinesses] = useState([]);
  const [mapCenter, setMapCenter] = useState(null);
  const [homeLocationSource, setHomeLocationSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [everyCircleOnly, setEveryCircleOnly] = useState(true);
  const mapAccent = getHeaderColor("search");

  useEffect(() => {
    let cancelled = false;

    async function loadMapData() {
      setLoading(true);
      setError(null);
      try {
        const [businessResponse, homeCoords] = await Promise.all([
          fetch(BUSINESS_MAP_ENDPOINT),
          resolveMapHomeCoords(),
        ]);

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
  }, []);

  const handleBusinessPress = useCallback(
    (business) => {
      if (!business?.business_uid) return;
      navigation.navigate("BusinessProfile", { business_uid: business.business_uid });
    },
    [navigation]
  );

  const homeLocationLabel =
    homeLocationSource === "profile"
      ? "Centered on your home location"
      : `Centered on ${MAP_PLACEHOLDER_HOME.label}`;

  return (
    <SafeAreaView
      style={[styles.container, darkMode && styles.containerDark]}
      edges={["top", "left", "right"]}
    >
      <AppHeader
        title="Every Circle Map"
        backgroundColor="#4F8A8B"
        onBackPress={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />

      <View style={styles.summaryBar}>
        <Text style={[styles.summaryText, darkMode && styles.summaryTextDark]}>
          {loading
            ? "Loading map..."
            : `${businesses.length} business${businesses.length === 1 ? "" : "es"} on Every Circle`}
        </Text>
        {!loading && mapCenter && (
          <Text style={[styles.subtleText, darkMode && styles.summaryTextDark]}>
            {homeLocationLabel}
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

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#AF52DE" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, darkMode && styles.summaryTextDark]}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              setError(null);
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
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.mapWrap}>
          {mapCenter && (
            <EveryCircleMapView
              businesses={businesses}
              mapCenter={mapCenter}
              everyCircleOnly={everyCircleOnly}
              onBusinessPress={handleBusinessPress}
            />
          )}
          {!businesses.length && (
            <View style={styles.emptyOverlay} pointerEvents="none">
              <Text style={styles.emptyText}>
                No businesses with a Google place id and coordinates yet.
              </Text>
            </View>
          )}
        </View>
      )}

      {Platform.OS === "web" && !loading && !error && businesses.length > 0 && (
        <View style={styles.hintBar}>
          <Text style={[styles.hintText, darkMode && styles.summaryTextDark]}>
            Pan and zoom to explore. Tap a purple marker to open a business profile.
          </Text>
        </View>
      )}
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ddd",
  },
  hintText: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
  },
});
