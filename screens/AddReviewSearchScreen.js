// AddReviewSearchScreen.js
// User types → getBusinessSuggestions() → show dropdown
// User picks  → getLatLongFromAddress() (Place Details) → save lat/lng to DB → navigate to ReviewBusiness
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useDarkMode } from "../contexts/DarkModeContext";
import { getBusinessSuggestions, getPlaceDetails } from "../utils/googlePlaces";
import { BUSINESS_INFO_ENDPOINT, BUSINESS_RESULTS_ENDPOINT } from "../apiConfig";

export default function AddReviewSearchScreen() {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);   // Google Places live dropdown
  const [savingPlace, setSavingPlace] = useState(false);
  const debounceRef = useRef(null);

  // ─── Step 1: as user types → fetch Google Places business suggestions ─────
  const onSearchChange = (text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await getBusinessSuggestions(text);
        setSuggestions(results);
      } catch (e) {
        console.log("[AddReviewSearch] suggestions error:", e);
      }
    }, 350);
  };

  // ─── Step 2: user picks → get details → save to DB → navigate ─────────────
  const handlePlaceSelect = async (place) => {
    setSuggestions([]);
    setSavingPlace(true);
    const bizName = place.structured_formatting?.main_text || place.description || "";
    console.log("[AddReviewSearch] Step 1 — place selected:", place.place_id, bizName);
    try {
      // (a) Get lat/lng + address
      const pd = await getPlaceDetails(place.place_id);
      console.log("[AddReviewSearch] Step 2 — place details:", JSON.stringify(pd));

      // (b) Get user_uid
      const userUid = await AsyncStorage.getItem("user_uid");
      const profileUid = await AsyncStorage.getItem("profile_uid");
      const uid = userUid || profileUid || "";
      console.log("[AddReviewSearch] Step 3 — uid:", uid);

      if (!uid) {
        Alert.alert("Not logged in", "Please log in and try again.");
        return;
      }

      // (c) POST to /api/v1/businessinfo
      const formData = new FormData();
      formData.append("user_uid", uid);
      formData.append("business_name", bizName);
      formData.append("business_google_id", place.place_id);
      formData.append("business_role", "unclaimed");
      if (pd.address_line_1)    formData.append("business_address_line_1", pd.address_line_1);
      if (pd.city)              formData.append("business_city", pd.city);
      if (pd.state)             formData.append("business_state", pd.state);
      if (pd.country)           formData.append("business_country", pd.country);
      if (pd.zip)               formData.append("business_zip_code", pd.zip);
      if (pd.lat != null)       formData.append("business_latitude", String(pd.lat));
      if (pd.lng != null)       formData.append("business_longitude", String(pd.lng));
      if (pd.phone)             formData.append("business_phone_number", pd.phone);
      if (pd.website)           formData.append("business_website", pd.website);

      console.log("[AddReviewSearch] Step 4 — POST to", BUSINESS_INFO_ENDPOINT);
      const saveRes = await fetch(BUSINESS_INFO_ENDPOINT, { method: "POST", body: formData });
      const saveJson = await saveRes.json();
      console.log("[AddReviewSearch] Step 5 — POST response", saveRes.status, JSON.stringify(saveJson));

      let businessUid = saveJson.business_uid;

      if (saveRes.status === 409 && !businessUid) {
        // Fallback: search by google_id then by name
        console.log("[AddReviewSearch] Step 5b — 409 fallback search for:", bizName);
        const srRes = await fetch(`${BUSINESS_RESULTS_ENDPOINT}?q=${encodeURIComponent(bizName)}`);
        const srJson = await srRes.json();
        const arr = Array.isArray(srJson) ? srJson : srJson.results || srJson.result || [];
        // try to match by google id first, then fall back to first result
        const match = arr.find((b) => b.business_google_id === place.place_id) || arr[0];
        businessUid = match?.business_uid;
        console.log("[AddReviewSearch] Step 5b — fallback businessUid:", businessUid);
      }

      if (!businessUid) {
        console.error("[AddReviewSearch] No businessUid after POST. Response:", saveRes.status, saveJson);
        Alert.alert("Error", `Could not register this business (status ${saveRes.status}). Please try again.`);
        return;
      }

      console.log("[AddReviewSearch] Step 6 — navigating to ReviewBusiness:", businessUid);
      navigation.navigate("ReviewBusiness", {
        business_uid: businessUid,
        business_name: bizName,
      });
    } catch (e) {
      console.error("[AddReviewSearch] UNCAUGHT error:", e?.message || e);
      Alert.alert("Error", e?.message || "Could not load business. Please try again.");
    } finally {
      setSavingPlace(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.darkContainer]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={[styles.header, darkMode && styles.darkHeader]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={darkMode ? "#fff" : "#000"} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, darkMode && styles.darkText]}>Find a Business to Review</Text>
        </View>

        {/* Search input — typing triggers Google Places suggestions */}
        <View style={[styles.searchRow, darkMode && styles.darkSearchRow]}>
          <Ionicons name="search" size={18} color={darkMode ? "#aaa" : "#999"} style={{ marginLeft: 12 }} />
          <TextInput
            style={[styles.searchInput, darkMode && styles.darkSearchInput]}
            placeholder="Search for a business or store..."
            placeholderTextColor={darkMode ? "#aaa" : "#999"}
            value={query}
            onChangeText={onSearchChange}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(""); setSuggestions([]); }} style={{ paddingHorizontal: 12 }}>
              <Ionicons name="close-circle" size={18} color={darkMode ? "#aaa" : "#bbb"} />
            </TouchableOpacity>
          )}
        </View>

        {/* Saving spinner */}
        {savingPlace && (
          <View style={styles.savingRow}>
            <ActivityIndicator size="small" color="#9C45F7" />
            <Text style={[styles.savingText, darkMode && { color: "#ccc" }]}>Loading business…</Text>
          </View>
        )}

        {/* ─── Live suggestions dropdown ─── */}
        {suggestions.length > 0 && !savingPlace && (
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 24 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.suggestionCard, darkMode && styles.darkSuggestionCard]}
                onPress={() => handlePlaceSelect(item)}
                activeOpacity={0.75}
              >
                <View style={[styles.suggestionIcon, darkMode && { backgroundColor: "#333" }]}>
                  <Ionicons name="storefront-outline" size={20} color={darkMode ? "#ccc" : "#666"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bizName, darkMode && styles.darkText]} numberOfLines={1}>
                    {item.structured_formatting?.main_text || item.description}
                  </Text>
                  {item.structured_formatting?.secondary_text ? (
                    <Text style={[styles.bizSub, darkMode && styles.darkSub]} numberOfLines={1}>
                      📍 {item.structured_formatting.secondary_text}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={darkMode ? "#555" : "#ccc"} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            )}
          />
        )}

        {/* No results */}
        {query.trim().length > 0 && suggestions.length === 0 && !savingPlace && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, darkMode && styles.darkText]}>
              No businesses found for "{query}"
            </Text>
            <TouchableOpacity style={styles.addBizBtn} onPress={() => navigation.navigate("BusinessSetup")}>
              <Ionicons name="add-circle-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.addBizBtnText}>Add a Business Manually</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Placeholder when nothing typed yet */}
        {query.trim().length === 0 && !savingPlace && (
          <View style={styles.emptyState}>
            <Ionicons name="storefront-outline" size={48} color={darkMode ? "#555" : "#ddd"} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyText, darkMode && styles.darkText]}>
              Start typing to find a business or store to review
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  darkContainer: { backgroundColor: "#121212" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 16 : 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  darkHeader: { backgroundColor: "#1e1e1e", borderBottomColor: "#333" },
  backBtn: { marginRight: 12 },
  headerTitle: { fontSize: 17, fontWeight: "600", color: "#000" },
  darkText: { color: "#fff" },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f9f9f9",
    overflow: "hidden",
  },
  darkSearchRow: { backgroundColor: "#2a2a2a", borderColor: "#444" },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 15,
    color: "#000",
  },
  darkSearchInput: { color: "#fff" },

  savingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, gap: 8 },
  savingText: { fontSize: 14, color: "#555" },

  suggestionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  darkSuggestionCard: { backgroundColor: "#1e1e1e" },
  suggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  bizName: { fontSize: 15, fontWeight: "600", color: "#000", marginBottom: 2 },
  bizSub: { fontSize: 13, color: "#666" },
  darkSub: { color: "#aaa" },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: { fontSize: 15, color: "#555", textAlign: "center", marginBottom: 24 },

  addBizBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#9C45F7",
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignSelf: "stretch",
    marginHorizontal: 16,
  },
  addBizBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
});
