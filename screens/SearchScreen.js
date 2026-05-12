// SearchScreen.js
import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, FlatList, ActivityIndicator, Alert, Dimensions, Modal, Image, Platform } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sanitizeEmptyStrings } from "../utils/endpointDataChecker";
import {
  BUSINESS_RESULTS_ENDPOINT,
  EXPERTISE_RESULTS_ENDPOINT,
  WISHES_RESULTS_ENDPOINT,
  TAG_SEARCH_DISTINCT_ENDPOINT,
  TAG_CATEGORY_DISTINCT_ENDPOINT,
  SEARCH_BASE_URL,
  SEARCH_GLOBAL_ENDPOINT,
  BUSINESS_AVG_RATINGS_ENDPOINT,
  BUSINESS_MAX_BOUNTY_ENDPOINT,
  BUSINESS_TAG_SEARCH_ENDPOINT,
  BUSINESS_INFO_ENDPOINT,
  USER_PROFILE_INFO_ENDPOINT,
  PROFILE_WISH_INFO_ENDPOINT,
} from "../apiConfig";
import { useDarkMode } from "../contexts/DarkModeContext";
import FeedbackPopup from "../components/FeedbackPopup";
import { getHeaderColors } from "../config/headerColors";
import { isWishEnded } from "../utils/wishUtils";
import { formatWholeDollars } from "../utils/priceUtils";

// Display stored "YYYY-MM-DD HH:mm" or "YYYY-MM-DDTHH:mm" as "m/d/y hh:mm"
/** Matches 💰 bounty indicator: same emoji with a slash for “no bounty”. */
function NoBountyIcon({ darkMode }) {
  return (
    <View style={styles.noBountyIconWrap} accessibilitylabel='No bounty'>
      <Text style={styles.noBountyEmoji}>💰</Text>
      <View pointerEvents='none' style={[styles.noBountySlash, darkMode && styles.darkNoBountySlash]} />
    </View>
  );
}

const formatDateTimeForDisplay = (value) => {
  if (!value || typeof value !== "string" || value.trim() === "") return "";
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[\sT]?(\d{1,2})?:?(\d{2})?/);
  if (match) {
    const [, y, m, d, h, min] = match;
    const timePart = h !== undefined && min !== undefined ? ` ${String(parseInt(h, 10)).padStart(2, "0")}:${min}` : "";
    return `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}${timePart}`;
  }
  return value;
};

/**
 * Fetches `/api/v1/businessavgratings` and `/api/v1/businessmaxbounty` and merges into rows with `itemType === "businesses"`.
 * Used for accurate stars, review count, connection degree, and bounty vs search-index guesses.
 */
async function enrichBusinessSearchResultsWithAvgRatingsAndMaxBounty(items) {
  const businessIds = [
    ...new Set(
      items
        .filter((b) => b.itemType === "businesses" && b.id != null && String(b.id).trim() !== "")
        .map((b) => String(b.id)),
    ),
  ];
  if (businessIds.length === 0) return items;

  const uids = businessIds.join(",");
  let profileUid = null;
  try {
    profileUid = await AsyncStorage.getItem("profile_uid");
  } catch (_) {
    /* ignore */
  }

  let merged = items;

  try {
    const ratingsUrl = `${BUSINESS_AVG_RATINGS_ENDPOINT}?uids=${encodeURIComponent(uids)}${
      profileUid ? `&viewer_uid=${encodeURIComponent(profileUid)}` : ""
    }`;
    const ratingsRes = await fetch(ratingsUrl);
    const ratingsJson = await ratingsRes.json();
    if (ratingsJson.result) {
      merged = merged.map((b) => {
        if (b.itemType !== "businesses") return b;
        const row = ratingsJson.result[b.id];
        return {
          ...b,
          rating: row && Number.isFinite(parseFloat(row.avg_rating)) ? parseFloat(row.avg_rating) : null,
          ratingCount: row ? row.rating_count : 0,
          connection_degree: row?.nearest_connection ?? null,
        };
      });
    }
  } catch (e) {
    console.log("Could not fetch avg ratings / connections:", e);
  }

  try {
    const bountyRes = await fetch(`${BUSINESS_MAX_BOUNTY_ENDPOINT}?uids=${encodeURIComponent(uids)}`);
    const bountyJson = await bountyRes.json();
    if (bountyJson.result) {
      merged = merged.map((b) => {
        if (b.itemType !== "businesses") return b;
        const row = bountyJson.result[b.id];
        return {
          ...b,
          max_bounty: row ? parseFloat(row.max_bounty) : null,
          max_per_item_bounty: row ? parseFloat(row.max_per_item_bounty) || null : null,
          max_total_bounty: row ? parseFloat(row.max_total_bounty) || null : null,
        };
      });
    }
  } catch (e) {
    console.log("Could not fetch bounty data:", e);
  }

  return merged;
}

export default function SearchScreen({ route }) {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();
  const [cartItems, setCartItems] = useState([]);
  const [cartCount, setCartCount] = useState(0);

  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [hasLoadedInitialSearch, setHasLoadedInitialSearch] = useState(false);

  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);

  const searchFeedbackInstructions = "Instructions for Search";

  // Define custom questions for the Account page
  const searchFeedbackQuestions = ["Search - Question 1?", "Search - Question 2?", "Search - Question 3?"];

  // --- stub initial data, so you see the four items by default ---
  const initialResults = [
    { id: "1", company: "ABC Plumbing", rating: 4, hasPriceTag: false, hasX: false, hasDollar: true },
    { id: "2", company: "Speedy Roto", rating: 3, hasPriceTag: false, hasX: true, hasDollar: false },
    { id: "3", company: "Fast Rooter", rating: 4, hasPriceTag: true, hasX: false, hasDollar: false },
    { id: "4", company: "Hector Handyman", rating: 4, hasPriceTag: false, hasX: false, hasDollar: true },
  ];

  // Declare all state variables first
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState(initialResults);
  const [loading, setLoading] = useState(false);

  // Filter states
  const [distance, setDistance] = useState(null);
  const [network, setNetwork] = useState(null);
  const [bounty, setBounty] = useState(null);
  const [rating, setRating] = useState(null);

  // Search type state: 'global', 'businesses', 'expertise', 'seeking'
  const [searchType, setSearchType] = useState("global");

  const [currentProfileUid, setCurrentProfileUid] = useState(null);
  const [connectionDegreeMap, setConnectionDegreeMap] = useState({});
  const connectionDegreeMapRef = useRef({});
  // Stores unsorted results so bounty filter can re-sort without re-fetching
  const rawResultsRef = useRef([]);

  useEffect(() => {
    AsyncStorage.getItem("profile_uid").then((uid) => setCurrentProfileUid(uid));
  }, []);

  // Restore search state when returning from Profile
  useFocusEffect(
    React.useCallback(() => {
      if (route.params?.restoreState && route.params?.searchState) {
        const state = route.params.searchState;
        console.log("🔄 Restoring Search screen state:", state);
        if (state.searchQuery !== undefined) setSearchQuery(state.searchQuery);
        if (state.searchType !== undefined) setSearchType(state.searchType);
        if (state.results !== undefined) setResults(state.results);
        if (state.distance !== undefined) setDistance(state.distance);
        if (state.network !== undefined) setNetwork(state.network);
        if (state.bounty !== undefined) setBounty(state.bounty);
        if (state.rating !== undefined) setRating(state.rating);
        console.log(" Search screen state restored");
      }
    }, [route.params?.restoreState, route.params?.searchState]),
  );

  // Load cart items when component mounts and when screen is focused
  useEffect(() => {
    const loadCartItems = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const cartKeys = keys.filter((key) => key.startsWith("cart_"));

        let totalItems = 0;
        let allCartItems = [];

        for (const key of cartKeys) {
          const cartData = await AsyncStorage.getItem(key);
          if (cartData) {
            const parsed = JSON.parse(cartData);

            if (key.startsWith("cart_expertise_")) {
              // Expertise items stored as single objects, not { items: [] }
              totalItems += 1;
              allCartItems.push({ ...parsed, cart_key: key });
            } else {
              // Business items stored as { items: [] }
              const items = parsed.items || []; // ← safe fallback
              totalItems += items.length;
              const businessUid = key.replace("cart_", "");
              const itemsWithBusiness = items.map((item) => ({
                ...item,
                business_uid: businessUid,
              }));
              allCartItems = [...allCartItems, ...itemsWithBusiness];
            }
          }
        }

        setCartCount(totalItems);
        setCartItems(allCartItems);
      } catch (error) {
        console.error("Error loading cart items:", error);
        setCartCount(0);
        setCartItems([]);
      }
    };

    // Load cart items when component mounts
    loadCartItems();

    // Add focus listener to refresh cart count when returning to this screen
    const unsubscribe = navigation.addListener("focus", () => {
      console.log("SearchScreen focused - refreshing cart");
      loadCartItems();
    });

    return unsubscribe;
  }, [navigation, route.params?.refreshCart]); // Add route.params?.refreshCart as a dependency

  // Load saved search state or perform initial "Chinese" search
  useEffect(() => {
    const loadSavedSearch = async () => {
      try {
        // Get current user's UID
        const userUid = await AsyncStorage.getItem("user_uid");

        if (!userUid) {
          console.log("⚠️ No user_uid found yet, will retry...");
          return;
        }

        console.log("👤 Loading search for user:", userUid);

        // Use user-specific keys
        const savedSearchQuery = await AsyncStorage.getItem(`last_search_query_${userUid}`);
        const savedSearchType = await AsyncStorage.getItem(`last_search_type_${userUid}`);
        const savedResults = await AsyncStorage.getItem(`last_search_results_${userUid}`);

        console.log("📋 Saved search query:", savedSearchQuery);
        console.log("📋 Saved search type:", savedSearchType);
        console.log("📋 Has saved results:", !!savedResults);

        if (savedSearchQuery && savedResults) {
          // User has searched before, restore their last search
          console.log("📋 Restoring last search for user:", userUid, "Query:", savedSearchQuery);
          setSearchQuery(savedSearchQuery);
          if (savedSearchType) setSearchType(savedSearchType);
          const parsedResults = JSON.parse(savedResults).map((item) =>
            item.itemType === "businesses"
              ? {
                  ...item,
                  rating: null,
                  ratingCount: 0,
                  connection_degree: null,
                  max_bounty: null,
                  max_per_item_bounty: null,
                  max_total_bounty: null,
                }
              : item,
          );
          setResults(parsedResults);
          setIsFirstVisit(false);
          setHasLoadedInitialSearch(true);
          const bizItems = parsedResults.filter((r) => r.itemType === "businesses" && r.id);
          if (bizItems.length > 0) {
            enrichBusinessSearchResultsWithAvgRatingsAndMaxBounty(parsedResults)
              .then((updated) => {
                setResults(updated);
                rawResultsRef.current = [...updated];
              })
              .catch((e) => {
                console.error("Could not fetch ratings/bounty from cache:", e);
                rawResultsRef.current = [...parsedResults];
              });
          } else {
            rawResultsRef.current = [...parsedResults];
          }
        } else {
          // First time user, search for "Chinese"
          console.log("🆕 First visit for user:", userUid, "- searching for 'Chinese'");
          setSearchQuery("Chinese");
          setIsFirstVisit(true);
          setHasLoadedInitialSearch(true);
          // Trigger the search after a brief delay to ensure state is set
          setTimeout(() => {
            performSearch("Chinese", "global");
          }, 100);
        }
      } catch (error) {
        console.error("Error loading saved search:", error);
        // On error, default to Chinese search
        setSearchQuery("Chinese");
        setHasLoadedInitialSearch(true);
        setTimeout(() => {
          performSearch("Chinese", "global");
        }, 100);
      }
    };

    // Only run once when component mounts or when we haven't loaded yet
    if (!hasLoadedInitialSearch) {
      // Add a small delay to ensure AsyncStorage is ready
      const timer = setTimeout(() => {
        loadSavedSearch();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [hasLoadedInitialSearch]);

  // Re-sort results reactively when bounty filter changes
  useEffect(() => {
    const base = rawResultsRef.current;
    if (base.length === 0) return;

    if (!bounty) {
      // Reset: restore original search order
      setResults([...base]);
      return;
    }

    const dir = bounty === "Ascending" ? 1 : -1;
    const sorted = [...base].sort((a, b) => {
      if (a.itemType !== "businesses" || b.itemType !== "businesses") return 0;
      const aTier = a.max_per_item_bounty ? 0 : a.max_total_bounty ? 1 : 2;
      const bTier = b.max_per_item_bounty ? 0 : b.max_total_bounty ? 1 : 2;
      if (aTier !== bTier) return aTier - bTier;
      if (aTier === 2) return 0;
      const aVal = aTier === 0 ? a.max_per_item_bounty : a.max_total_bounty;
      const bVal = bTier === 0 ? b.max_per_item_bounty : b.max_total_bounty;
      return dir * (aVal - bVal);
    });
    setResults(sorted);
  }, [bounty]);

  // Save search state whenever results change (but not on initial load)
  useEffect(() => {
    const saveSearchState = async () => {
      // Only save if we have results and have completed initial load
      if (results.length > 0 && hasLoadedInitialSearch && searchQuery.trim() && !loading) {
        try {
          // Get current user's UID
          const userUid = await AsyncStorage.getItem("user_uid");

          if (!userUid) {
            console.log("⚠️ No user_uid found, cannot save search state");
            return;
          }

          // Save with user-specific keys
          await AsyncStorage.setItem(`last_search_query_${userUid}`, searchQuery);
          await AsyncStorage.setItem(`last_search_type_${userUid}`, searchType);
          await AsyncStorage.setItem(`last_search_results_${userUid}`, JSON.stringify(results));
          console.log("💾 Saved search state for user:", userUid, "Query:", searchQuery);
        } catch (error) {
          console.error("Error saving search state:", error);
        }
      }
    };

    saveSearchState();
  }, [results, searchQuery, searchType, hasLoadedInitialSearch, loading]);

  // Clear cart data when refreshCart is true
  useEffect(() => {
    const clearCartData = async () => {
      if (route.params?.refreshCart) {
        console.log("Clearing cart data due to refreshCart parameter");
        try {
          const keys = await AsyncStorage.getAllKeys();
          const cartKeys = keys.filter((key) => key.startsWith("cart_"));
          await Promise.all(cartKeys.map((key) => AsyncStorage.removeItem(key)));
          setCartCount(0);
          setCartItems([]);
          console.log("Cart data cleared successfully");
        } catch (error) {
          console.error("Error clearing cart data:", error);
        }
      }
    };

    clearCartData();
  }, [route.params?.refreshCart]);

  // Log results changes for debugging (runs only when results change, not on every render)
  useEffect(() => {
    if (!loading && results.length > 0) {
      console.log("🎨 Rendering results:", results.length, "items");
      console.log("🎨 Results array:", results);
    }
  }, [results, loading]);

  // Modal visibility states
  const [distanceModalVisible, setDistanceModalVisible] = useState(false);
  const [networkModalVisible, setNetworkModalVisible] = useState(false);
  const [bountyModalVisible, setBountyModalVisible] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showGlobalBusinesses, setShowGlobalBusinesses] = useState(true);
  const [showGlobalOffering, setShowGlobalOffering] = useState(true);

  // Filter options (same as FilterScreen)
  const distanceOptions = [5, 10, 15, 25, 50, 100];
  const networkOptions = [1, 2, 3, 4, 5];
  const bountyOptions = ["Ascending", "Descending"];
  const ratingOptions = ["> 1", "> 2", "> 3", "> 4", "> 4.5", "> 4.6", "> 4.8"];

  const globalBusinessResults = searchType === "global" ? results.filter((item) => (item?.itemType || "businesses") === "businesses") : [];
  const globalOfferingResults = searchType === "global" ? results.filter((item) => item?.itemType === "expertise") : [];

  const fetchSearchJson = async (endpoint, q, applyRatingFilter = false) => {
    let apiUrl = `${endpoint}?q=${encodeURIComponent(q)}`;
    if (applyRatingFilter && rating !== null) {
      apiUrl += `&min_rating=${rating}`;
    }

    const fetchOptions =
      Platform.OS === "web"
        ? {
            method: "GET",
            mode: "cors",
            credentials: "omit",
            headers: { Accept: "application/json" },
            cache: "no-cache",
          }
        : {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          };

    const res = await fetch(apiUrl, fetchOptions);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP error! status: ${res.status}, message: ${errorText}`);
    }
    const responseText = await res.text();
    if (!responseText.trim().startsWith("{") && !responseText.trim().startsWith("[")) {
      throw new Error(`API returned non-JSON response: ${responseText.substring(0, 200)}`);
    }
    return JSON.parse(responseText);
  };

  // Extracted search function that can be called programmatically
  const performSearch = async (query, type = searchType) => {
    const q = query.trim();
    if (!q) return;

    console.log("🔍 Performing search for:", q);
    console.log("🔍 Search type:", type);
    console.log("🔍 Search query length:", q.length);
    console.log("🔍 Search query type:", typeof q);
    console.log("🔍 Rating filter:", rating);

    setLoading(true);
    try {
      if (type === "global") {
        const globalJsonRaw = await fetchSearchJson(SEARCH_GLOBAL_ENDPOINT, q, true);
        const globalJson = sanitizeEmptyStrings(globalJsonRaw);
        const globalResults = Array.isArray(globalJson) ? globalJson : globalJson.results || globalJson.result || [];
        const businessResults = globalResults.filter((item) => item.itemType === "businesses");
        const expertiseResults = globalResults.filter((item) => item.itemType === "expertise");

        const sanitizeText = (text) => {
          if (!text) return "";
          const str = String(text).trim();
          return str === "." ? "" : str;
        };

        const mappedBusinesses = businessResults.map((b, i) => ({
          id: `${b.business_uid || i}`,
          company: sanitizeText(b.business_name || b.company) || "Unknown Business",
          business_profile_img: b.business_profile_img ? b.business_profile_img.trim() : null,
          rating: null,
          ratingCount: 0,
          connection_degree: null,
          max_bounty: null,
          max_per_item_bounty: null,
          max_total_bounty: null,
          hasPriceTag: b.has_price_tag || false,
          hasX: b.has_x || false,
          hasDollar: b.has_dollar_sign || false,
          business_short_bio: sanitizeText(b.business_short_bio),
          business_tag_line: sanitizeText(b.business_tag_line),
          tags: b.tags || [],
          score: b.score || 0,
          score_breakdown: b.score_breakdown || null,
          itemType: "businesses",
          profile_uid: b.profile_personal_uid || b.business_profile_personal_uid || b.owner_profile_uid || null,
        }));

        const mappedExpertise = expertiseResults
          .filter((item) => item.profile_expertise_is_public !== 0 && item.profile_expertise_is_public !== "0")
          .map((item, i) => ({
            id: `${item.profile_expertise_uid || i}`,
            company: item.profile_expertise_title || "Untitled Expertise",
            rating: typeof item.score === "number" ? Math.min(5, Math.max(1, Math.round(item.score * 5))) : 4,
            hasPriceTag: false,
            hasX: false,
            hasDollar: false,
            business_short_bio: item.profile_expertise_description || "",
            business_tag_line: item.profile_expertise_title || "",
            tags: [],
            score: item.score || 0,
            score_breakdown: item.score_breakdown || null,
            itemType: "expertise",
            profile_uid:
              item.profile_expertise_profile_personal_id ||
              item.profile_personal_uid ||
              item.expertise_owner_profile_uid ||
              null,
            expertiseData: {
              title: item.profile_expertise_title,
              description: item.profile_expertise_description,
              details: item.profile_expertise_details,
              bounty: item.profile_expertise_bounty,
              cost: item.profile_expertise_cost,
              expertise_uid: item.profile_expertise_uid,
            },
            profileData: {
              firstName: item.profile_personal_first_name || "",
              lastName: item.profile_personal_last_name || "",
              email: item.user_email_id || "",
              phone: item.profile_personal_phone_number || "",
              image: item.profile_personal_image || "",
              tagLine: item.profile_personal_tag_line || "",
              city: item.profile_personal_city || "",
              state: item.profile_personal_state || "",
              emailIsPublic: item.profile_personal_email_is_public == 1,
              phoneIsPublic: item.profile_personal_phone_number_is_public == 1,
              imageIsPublic: item.profile_personal_image_is_public == 1,
              tagLineIsPublic: item.profile_personal_tag_line_is_public == 1,
              locationIsPublic: item.profile_personal_location_is_public == 1,
            },
          }));

        const normalizeByType = (items) => {
          if (!items.length) return [];
          const maxScore = Math.max(...items.map((x) => Number(x.score) || 0), 0.000001);
          return items.map((x) => ({ ...x, globalScore: (Number(x.score) || 0) / maxScore }));
        };

        const list = [...normalizeByType(mappedBusinesses), ...normalizeByType(mappedExpertise)].sort((a, b) => b.globalScore - a.globalScore);
        const enriched = await enrichBusinessSearchResultsWithAvgRatingsAndMaxBounty(list);
        rawResultsRef.current = [...enriched];
        setResults(enriched);
        setHasLoadedInitialSearch(true);
        setLoading(false);
        return;
      }

      // Select the appropriate endpoint based on search type
      let baseEndpoint;
      switch (type) {
        case "expertise":
          baseEndpoint = EXPERTISE_RESULTS_ENDPOINT;
          break;
        case "seeking":
          baseEndpoint = WISHES_RESULTS_ENDPOINT;
          break;
        case "businesses":
        default:
          baseEndpoint = BUSINESS_RESULTS_ENDPOINT;
          break;
      }

      // Build the API URL with query parameter
      let apiUrl = `${baseEndpoint}?q=${encodeURIComponent(q)}`;

      // Add min_rating parameter if rating filter is set
      if (rating !== null) {
        apiUrl += `&min_rating=${rating}`;
      }

      console.log("🎯 EXACT ENDPOINT BEING CALLED:", apiUrl);

      // Add CORS mode and headers for web requests
      const fetchOptions =
        Platform.OS === "web"
          ? {
              method: "GET",
              mode: "cors",
              credentials: "omit", // Don't send credentials for CORS
              // Don't include Content-Type for GET requests to avoid preflight
              headers: {
                Accept: "application/json",
              },
              cache: "no-cache",
            }
          : {
              method: "GET",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
            };

      console.log("📡 Fetch options:", JSON.stringify(fetchOptions, null, 2));

      let res;
      try {
        res = await fetch(apiUrl, fetchOptions);
      } catch (fetchError) {
        console.error("❌ Fetch error details:", fetchError);
        console.error("❌ Error name:", fetchError.name);
        console.error("❌ Error message:", fetchError.message);

        // Try with no-cors mode as a fallback (limited but might work)
        if (Platform.OS === "web" && fetchError.message === "Failed to fetch") {
          console.warn("⚠️ CORS error detected, trying no-cors mode as fallback...");
          try {
            const noCorsOptions = {
              method: "GET",
              mode: "no-cors", // This bypasses CORS but we can't read response headers
              credentials: "omit",
              cache: "no-cache",
            };
            res = await fetch(apiUrl, noCorsOptions);
            console.log("✅ no-cors request succeeded, but response may be opaque");
            // Note: With no-cors, we can't read response headers or check status properly
            // The response will be "opaque" - we can only read the body
          } catch (noCorsError) {
            console.error("❌ no-cors fallback also failed:", noCorsError);
            throw new Error(
              `CORS Error: The search server at ${SEARCH_BASE_URL} is not allowing requests from http://localhost:8081.\n\n` +
                `To fix this, the server needs to:\n` +
                `1. Allow requests from http://localhost:8081 (or your production domain)\n` +
                `2. Include CORS headers: Access-Control-Allow-Origin, Access-Control-Allow-Methods\n\n` +
                `You can test the endpoint directly in your browser:\n${apiUrl}\n\n` +
                `Note: The server must respond to OPTIONS preflight requests with proper CORS headers.`,
            );
          }
        } else {
          throw fetchError;
        }
      }

      // Check if response is opaque (from no-cors mode)
      const isOpaque = res.type === "opaque" || res.type === "opaqueredirect";

      if (!isOpaque) {
        console.log("📡 Response status:", res.status);
        console.log("📡 Response ok:", res.ok);
        console.log("📡 Response headers:", Object.fromEntries(res.headers.entries()));
      }

      // Check if response is ok (skip check for opaque responses)
      if (!isOpaque && !res.ok) {
        const errorText = await res.text();
        console.error("❌ Response error text:", errorText);
        throw new Error(`HTTP error! status: ${res.status}, message: ${errorText}`);
      }

      // Get raw response text first
      const responseText = await res.text();
      console.log("📄 Raw response text length:", responseText.length);
      console.log("📄 Raw response text (first 500 chars):", responseText.substring(0, 500));

      // Check if response looks like JSON
      if (!responseText.trim().startsWith("{") && !responseText.trim().startsWith("[")) {
        console.error("❌ Response is not JSON. First 200 chars:", responseText.substring(0, 200));
        throw new Error(`API returned non-JSON response: ${responseText.substring(0, 200)}`);
      }

      // Parse JSON
      let json;
      try {
        json = JSON.parse(responseText);
        console.log("✅ JSON parsed successfully");
        console.log("📊 JSON type:", typeof json);
        console.log("📊 Is array?", Array.isArray(json));
        console.log("📊 JSON keys:", typeof json === "object" && json !== null ? Object.keys(json) : "N/A");
      } catch (parseError) {
        console.error("❌ JSON parse error:", parseError);
        console.error("❌ Response text that failed to parse:", responseText.substring(0, 500));
        throw new Error(`Failed to parse JSON response: ${parseError.message}`);
      }

      // Sanitize empty strings ("", " ") to null for expertise and wishes endpoints to prevent downstream errors
      if (type === "expertise" || type === "seeking") {
        json = sanitizeEmptyStrings(json);
      }

      // console.log("📡 Search API Response:", JSON.stringify(json, null, 2));
      // console.log("📊 Number of results returned:", Array.isArray(json) ? json.length : json.results?.length || json.result?.length || 0);

      // Handle both possible response structures
      // console.log("🔍 Raw JSON response:", json);
      // console.log("🔍 JSON type:", typeof json);
      // console.log("🔍 Is array?", Array.isArray(json));

      // The API returns an array directly, not wrapped in results/result
      const resultsArray = Array.isArray(json) ? json : json.results || json.result || [];
      console.log("🔍 Results array length:", resultsArray.length);
      // console.log("🔍 Results array length:", resultsArray.length);

      // Process results based on search type
      let list;
      if (type === "seeking") {
        // For seeking/wishes, the response includes profile data directly
        // Filter out non-public wishes (profile_wish_is_public === 0)
        const publicSeekingResults = resultsArray.filter((item) => item.profile_wish_is_public !== 0 && item.profile_wish_is_public !== "0");
        list = publicSeekingResults
          .map((item, i) => ({
            id: `${item.profile_wish_uid || i}`,
            company: item.profile_wish_title || "Untitled Wish",
            rating: typeof item.score === "number" ? Math.min(5, Math.max(1, Math.round(item.score * 5))) : 4,
            hasPriceTag: false,
            hasX: false,
            hasDollar: false,
            //hasBounty: b.has_bounty || b.business_bounty || false,
            hasBounty: item.profile_wish_bounty ? true : false,
            business_short_bio: item.profile_wish_description || "",
            business_tag_line: item.profile_wish_title || "",
            tags: [],
            score: item.score || 0,
            score_breakdown: item.score_breakdown || null,
            itemType: "seeking",
            profile_uid: item.profile_wish_profile_personal_id,
            profile_wish_end: item.profile_wish_end || "",
            // Store wish data
            wishData: {
              title: item.profile_wish_title,
              description: item.profile_wish_description,
              bounty: item.profile_wish_bounty,
              cost: item.profile_wish_cost,
              wish_uid: item.profile_wish_uid,
              profile_wish_quantity: item.profile_wish_quantity || "",
              profile_wish_image: item.profile_wish_image || "",
              profile_wish_image_is_public: item.profile_wish_image_is_public,
              profile_wish_start: item.profile_wish_start || "",
              profile_wish_end: item.profile_wish_end || "",
              profile_wish_location: item.profile_wish_location || "",
              profile_wish_mode: item.profile_wish_mode || "",
              profile_wish_updated_at: item.profile_wish_updated_at ?? item.updated_at,
            },
            // Store profile data for MiniCard-like display
            profileData: {
              firstName: item.profile_personal_first_name || "",
              lastName: item.profile_personal_last_name || "",
              email: item.user_email_id || "",
              phone: item.profile_personal_phone_number || "",
              image: item.profile_personal_image || "",
              tagLine: item.profile_personal_tag_line || "",
              emailIsPublic: item.profile_personal_email_is_public == 1,
              phoneIsPublic: item.profile_personal_phone_number_is_public == 1,
              imageIsPublic: item.profile_personal_image_is_public == 1,
              tagLineIsPublic: item.profile_personal_tag_line_is_public == 1,
            },
          }))
          .filter((item) => !isWishEnded(item));
        // try {
        //   const profileFetches = list.map(async (item) => {
        //     if (!item.profile_uid) return item;
        //     try {
        //       const profileRes = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${item.profile_uid}`);
        //       const profileJson = await profileRes.json();
        //       const p = profileJson.personal_info || {};
        //       return {
        //         ...item,
        //         profileData: {
        //           firstName: p.profile_personal_first_name || "",
        //           lastName: p.profile_personal_last_name || "",
        //           email: p.user_email_id || "",
        //           phone: p.profile_personal_phone_number || "",
        //           image: p.profile_personal_image || "",
        //           tagLine: p.profile_personal_tag_line || "",
        //           emailIsPublic: p.profile_personal_email_is_public == 1,
        //           phoneIsPublic: p.profile_personal_phone_number_is_public == 1,
        //           imageIsPublic: p.profile_personal_image_is_public == 1,
        //           tagLineIsPublic: p.profile_personal_tag_line_is_public == 1,
        //         },
        //       };
        //     } catch (e) {
        //       return item;
        //     }
        //   });
        //   list = await Promise.all(profileFetches);
        // } catch (e) {
        //   console.log("Could not fetch wish profiles:", e);
        // }
      } else if (type === "expertise") {
        // For expertise, the response includes profile data directly
        // Filter out non-public expertise (profile_expertise_is_public === 0)
        const publicExpertiseResults = resultsArray.filter((item) => item.profile_expertise_is_public !== 0 && item.profile_expertise_is_public !== "0");
        list = publicExpertiseResults.map((item, i) => ({
          id: `${item.profile_expertise_uid || i}`,
          company: item.profile_expertise_title || "Untitled Expertise",
          rating: typeof item.score === "number" ? Math.min(5, Math.max(1, Math.round(item.score * 5))) : 4,
          hasPriceTag: false,
          hasX: false,
          hasDollar: false,
          business_short_bio: item.profile_expertise_description || "",
          business_tag_line: item.profile_expertise_title || "",
          tags: [],
          score: item.score || 0,
          score_breakdown: item.score_breakdown || null,
          itemType: "expertise",
          profile_uid:
            item.profile_expertise_profile_personal_id ||
            item.profile_personal_uid ||
            item.expertise_owner_profile_uid ||
            null,
          expertiseData: {
            title: item.profile_expertise_title,
            description: item.profile_expertise_description,
            details: item.profile_expertise_details,
            bounty: item.profile_expertise_bounty,
            cost: item.profile_expertise_cost,
            quantity: item.profile_expertise_quantity || item.quantity,
            expertise_uid: item.profile_expertise_uid,
            profile_expertise_start: item.profile_expertise_start || "",
            profile_expertise_end: item.profile_expertise_end || "",
            profile_expertise_location: item.profile_expertise_location || "",
            profile_expertise_mode: item.profile_expertise_mode || "",
            profile_expertise_image: item.profile_expertise_image || "",
            profile_expertise_image_is_public: item.profile_expertise_image_is_public,
            profile_expertise_updated_at: item.profile_expertise_updated_at ?? item.updated_at,
          },
          // Store profile data for MiniCard-like display (all public info for Add to Cart modal)
          profileData: {
            firstName: item.profile_personal_first_name || "",
            lastName: item.profile_personal_last_name || "",
            email: item.user_email_id || "",
            phone: item.profile_personal_phone_number || "",
            image: item.profile_personal_image || "",
            tagLine: item.profile_personal_tag_line || "",
            city: item.profile_personal_city || "",
            state: item.profile_personal_state || "",
            emailIsPublic: item.profile_personal_email_is_public == 1,
            phoneIsPublic: item.profile_personal_phone_number_is_public == 1,
            imageIsPublic: item.profile_personal_image_is_public == 1,
            tagLineIsPublic: item.profile_personal_tag_line_is_public == 1,
            locationIsPublic: item.profile_personal_location_is_public == 1,
          },
        }));
      } else {
        // For businesses, use the existing mapping
        const sanitizeText = (text) => {
          if (!text) return "";
          const str = String(text).trim();
          return str === "." ? "" : str;
        };

        list = resultsArray.map((b, i) => {
          console.log("All image fields:", b.business_profile_img, b.business_images_url, b.business_favorite_image, b.business_name);
          console.log("Business profile img:", b.business_profile_img, b.business_name);
          return {
            id: `${b.business_uid || i}`,
            company: sanitizeText(b.business_name || b.company) || "Unknown Business",
            business_profile_img: b.business_profile_img ? b.business_profile_img.trim() : null,
            rating: typeof b.rating_star === "number" ? b.rating_star : null,
            hasPriceTag: b.has_price_tag || false,
            hasX: b.has_x || false,
            hasDollar: b.has_dollar_sign || false,
            max_bounty: b.max_bounty || b.business_max_bounty || null,
            business_short_bio: sanitizeText(b.business_short_bio),
            business_tag_line: sanitizeText(b.business_tag_line),
            tags: b.tags || [],
            score: b.score || 0,
            score_breakdown: b.score_breakdown || null,
            itemType: "businesses",
            profile_uid: b.profile_personal_uid || b.business_profile_personal_uid || b.owner_profile_uid || null,
          };
        });

        // Run tag search in parallel with main search
        try {
          const tagRes = await fetch(`${BUSINESS_TAG_SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}`);
          const tagJson = await tagRes.json();
          const tagResults = tagJson.result || [];

          if (tagResults.length > 0) {
            const existingIds = new Set(list.map((b) => b.id));
            const sanitizeText = (text) => {
              if (!text) return "";
              const str = String(text).trim();
              return str === "." ? "" : str;
            };
            const tagList = tagResults
              .filter((b) => !existingIds.has(b.business_uid))
              .map((b) => ({
                id: b.business_uid,
                company: sanitizeText(b.business_name) || "Unknown Business",
                business_profile_img: b.business_profile_img ? b.business_profile_img.trim() : null,
                rating: null,
                hasPriceTag: false,
                hasX: false,
                hasDollar: false,
                business_short_bio: sanitizeText(b.business_short_bio),
                business_tag_line: sanitizeText(b.business_tag_line),
                tags: b.tags || [], // ← now includes tags
                score: 0,
                score_breakdown: null,
                itemType: "businesses",
              }));
            list = [...list, ...tagList];
            console.log("✅ Tag search added", tagList.length, "additional results");
          }
        } catch (e) {
          console.log("Could not fetch tag search results:", e);
        }

        list = await enrichBusinessSearchResultsWithAvgRatingsAndMaxBounty(list);

        // Sort by highest rating if rating filter is active
        if (rating !== null) {
          list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        }

        // Save unsorted snapshot BEFORE bounty sort so reset can restore original order
        rawResultsRef.current = [...list];

        // Sort by bounty — tier 1: per_item bounty, tier 2: total bounty, tier 3: no bounty (always last)
        if (bounty === "Ascending" || bounty === "Descending") {
          const dir = bounty === "Ascending" ? 1 : -1;
          list = [...list].sort((a, b) => {
            const aTier = a.max_per_item_bounty ? 0 : a.max_total_bounty ? 1 : 2;
            const bTier = b.max_per_item_bounty ? 0 : b.max_total_bounty ? 1 : 2;
            if (aTier !== bTier) return aTier - bTier; // tier ordering is always ascending
            if (aTier === 2) return 0; // both have no bounty
            const aVal = aTier === 0 ? a.max_per_item_bounty : a.max_total_bounty;
            const bVal = bTier === 0 ? b.max_per_item_bounty : b.max_total_bounty;
            return dir * (aVal - bVal);
          });
        }
      }

      console.log("Processed search results:", list.length, "items");
      setResults(list);
      setHasLoadedInitialSearch(true);
    } catch (err) {
      console.error(" Search failed for query:", q, "Error:", err);

      if (err.message.includes("Network request failed") || err.message.includes("Failed to fetch")) {
        Alert.alert("Network Error", "Unable to connect to the search server. Please check your internet connection or try again later.", [{ text: "OK" }]);
        setResults([]);
        return;
      }

      if (err.message.includes("404")) {
        console.log("🔄 Trying alternative endpoints...");
        await tryAlternativeEndpoints(q);
      } else {
        setResults([]);
      }
    }
    setLoading(false);
  };

  const onSearch = async () => {
    await performSearch(searchQuery, searchType);
  };

  const tryAlternativeEndpoints = async (query) => {
    const alternativeEndpoints = [
      // `${BUSINESS_RESULTS_ENDPOINT}/${encodeURIComponent(query)}`,
      // `${TAG_SEARCH_DISTINCT_ENDPOINT}/${encodeURIComponent(query)}`,
      // `${TAG_CATEGORY_DISTINCT_ENDPOINT}/${encodeURIComponent(query)}`
      `${TAG_SEARCH_DISTINCT_ENDPOINT}/${encodeURIComponent(query)}`,
      `${TAG_CATEGORY_DISTINCT_ENDPOINT}/${encodeURIComponent(query)}`,
    ];

    for (const endpoint of alternativeEndpoints) {
      try {
        console.log("🔄 Trying alternative endpoint:", endpoint);

        // Add CORS mode for web requests
        const altFetchOptions =
          Platform.OS === "web"
            ? {
                method: "GET",
                mode: "cors",
                credentials: "omit",
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                },
                cache: "no-cache",
              }
            : {
                method: "GET",
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                },
              };

        const res = await fetch(endpoint, altFetchOptions);

        if (res.ok) {
          const responseText = await res.text();
          if (responseText.trim().startsWith("{") || responseText.trim().startsWith("[")) {
            const json = JSON.parse(responseText);
            console.log("✅ Alternative endpoint worked! Response:", JSON.stringify(json, null, 2));

            // Handle both possible response structures
            const resultsArray = json.results || json.result || [];

            // Sanitize text fields to prevent periods from being rendered as text nodes
            const sanitizeText = (text) => {
              if (!text) return "";
              const str = String(text).trim();
              // If it's just a period or starts with a period that might cause issues, return empty
              return str === "." ? "" : str;
            };

            const list = resultsArray.map((b, i) => ({
              id: `${b.business_uid || i}`,
              company: sanitizeText(b.business_name || b.company) || "Unknown Business",
              business_profile_img: b.business_profile_img || null,
              // Use score as rating if rating_star not available, convert to 1-5 scale
              rating: typeof b.rating_star === "number" ? b.rating_star : null,
              hasPriceTag: b.has_price_tag || false,
              hasX: b.has_x || false,
              hasDollar: b.has_dollar_sign || false,
              // Add additional fields from the API response - sanitize to prevent period issues
              business_short_bio: sanitizeText(b.business_short_bio),
              business_tag_line: sanitizeText(b.business_tag_line),
              tags: b.tags || [],
              score: b.score || 0,
              score_breakdown: b.score_breakdown || null,
            }));

            console.log("✅ Processed results from alternative endpoint:", list);
            setResults(list);
            return;
          }
        }
      } catch (error) {
        console.log("❌ Alternative endpoint failed:", endpoint, error.message);
      }
    }

    console.log("❌ All endpoints failed, showing empty results");
    setResults([]);
  };

  // Render option item for modals
  const renderOptionItem = (options, selectedValue, onSelect, isRating = false) => {
    return ({ item }) => {
      let isSelected = false;
      if (isRating) {
        // For rating, compare the string format
        const selectedStr = selectedValue !== null ? `> ${selectedValue}` : null;
        isSelected = item === selectedStr;
      } else if (typeof item === "string") {
        isSelected = item === selectedValue;
      } else {
        isSelected = selectedValue === item;
      }

      return (
        <TouchableOpacity
          style={[styles.optionItem, isSelected && styles.selectedOption, darkMode && styles.darkOptionItem, darkMode && isSelected && styles.darkSelectedOption]}
          onPress={() => {
            if (isRating) {
              onSelect(parseFloat(item.slice(1).trim()));
            } else {
              onSelect(item);
            }
          }}
        >
          <Text style={[styles.optionText, isSelected && styles.selectedOptionText, darkMode && styles.darkOptionText, darkMode && isSelected && styles.darkSelectedOptionText]}>{item}</Text>
          {isSelected && <Ionicons name='checkmark' size={24} color={darkMode ? "#9C45F7" : "#9C45F7"} />}
        </TouchableOpacity>
      );
    };
  };

  const renderStars = (rating) => {
    return (
      <View style={{ flexDirection: "row" }}>
        {Array.from({ length: rating }).map((_, i) => (
          <View key={i} style={styles.starCircle} />
        ))}
      </View>
    );
  };

  const renderScoreBreakdown = (item) => {
    const breakdown = item?.score_breakdown;
    if (!breakdown || typeof breakdown !== "object") return null;
    const sem = Number.isFinite(breakdown.semantic_score) ? Number(breakdown.semantic_score).toFixed(3) : null;
    const lex = Number.isFinite(breakdown.total_lexical_boost) ? Number(breakdown.total_lexical_boost).toFixed(3) : null;
    const g = Number.isFinite(item?.global_score) ? Number(item.global_score).toFixed(3) : null;
    const parts = [];
    if (sem !== null) parts.push(`Sem: ${sem}`);
    if (lex !== null) parts.push(`Lex: ${lex}`);
    if (g !== null) parts.push(`Global: ${g}`);

    const detailKeyToLabel = {
      name_score: "Business Name",
      tagline_score: "Tagline",
      bio_score: "Bio",
      service_name_score: "Product/Service Name",
      service_tag_score: "Service Tags",
      custom_tag_score: "Business Tags",
      title_score: "Title",
      description_score: "Description",
      details_score: "Details",
      token_name: "Name Token",
      token_tagline: "Tagline Token",
      token_bio: "Bio Token",
      token_tag: "Tag Token",
      phrase_name: "Name Phrase",
      phrase_tag: "Tag Phrase",
    };

    const ignoredKeys = new Set(["semantic_score", "total_lexical_boost", "final_score"]);
    const detailParts = Object.entries(breakdown)
      .filter(([key, value]) => detailKeyToLabel[key] && !ignoredKeys.has(key) && Number.isFinite(value) && Number(value) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .map(([key, value]) => `${detailKeyToLabel[key]}: ${Number(value).toFixed(3)}`);

    if (!parts.length && !detailParts.length) return null;

    const text = detailParts.length
      ? `${parts.join(" | ")}\n${detailParts.join(" | ")}`
      : parts.join(" | ");

    return <Text style={[styles.scoreBreakdownText, darkMode && styles.darkScoreBreakdownText]}>{text}</Text>;
  };

  const renderWishItem = (item, idx) => {
    // Render wish item with MiniCard-like profile display
    const profile = item.profileData || {};
    const wish = item.wishData || {};

    const isOwnWish = currentProfileUid && item.profile_uid === currentProfileUid;

    return (
      <TouchableOpacity
        key={`${item.id}-${idx}`}
        activeOpacity={isOwnWish ? 1 : 0.7}
        //style={[styles.wishItem, darkMode && styles.darkWishItem]}
        style={[styles.wishItem, darkMode && styles.darkWishItem, isOwnWish && { opacity: 0.6 }]}
        onPress={() => {
          if (isOwnWish) return;
          console.log("🏢 Navigating to WishDetail from wish card:", wish.title, "Profile ID:", item.profile_uid);
          if (item.profile_uid && wish) {
            navigation.navigate("WishDetail", {
              wishData: wish,
              profileData: profile,
              profile_uid: item.profile_uid,
              searchState: {
                searchQuery,
                searchType,
                results,
                distance,
                network,
                bounty,
                rating,
              },
            });
          } else {
            console.warn("No profile_uid or wish data found for wish item");
          }
        }}
      >
        {/* Profile Image and Info (MiniCard-like) - Clickable */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={(e) => {
            e.stopPropagation(); // Prevent triggering parent onPress
            console.log("🏢 Navigating to profile from MiniCard:", profile.firstName, profile.lastName, "Profile ID:", item.profile_uid);
            if (item.profile_uid) {
              navigation.navigate("Profile", {
                profile_uid: item.profile_uid,
                returnTo: "Search",
                searchState: {
                  searchQuery,
                  searchType,
                  results,
                  distance,
                  network,
                  bounty,
                  rating,
                },
              });
            } else {
              console.warn("No profile_uid found for wish item");
            }
          }}
        >
          <View style={styles.wishProfileContainer}>
            <Image
              source={profile.image && profile.imageIsPublic && profile.image !== "" && String(profile.image).trim() !== "" ? { uri: String(profile.image) } : require("../assets/profile.png")}
              style={[styles.wishProfileImage, darkMode && styles.darkWishProfileImage]}
              tintColor={darkMode ? "#ffffff" : undefined}
              onError={(error) => {
                console.log("Wish profile image failed to load:", error.nativeEvent.error);
              }}
              defaultSource={require("../assets/profile.png")}
            />
            <View style={styles.wishProfileInfo}>
              {/* Name is always visible */}
              <Text style={[styles.wishProfileName, darkMode && styles.darkWishProfileName]}>{[profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Anonymous User"}</Text>
              {/* Show email if public */}
              {(() => {
                const email = profile.emailIsPublic && profile.email ? String(profile.email).trim() : "";
                return email && email !== "." ? <Text style={[styles.wishProfileText, darkMode && styles.darkWishProfileText]}>{email}</Text> : null;
              })()}
              {/* Show phone if public */}
              {(() => {
                const phone = profile.phoneIsPublic && profile.phone ? String(profile.phone).trim() : "";
                return phone && phone !== "." ? <Text style={[styles.wishProfileText, darkMode && styles.darkWishProfileText]}>{phone}</Text> : null;
              })()}
            </View>
          </View>
        </TouchableOpacity>

        {/* Wish Information */}
        <View style={[styles.wishInfoContainer, darkMode && styles.darkWishInfoContainer]}>
          <Text style={[styles.wishTitle, darkMode && styles.darkWishTitle]}>{wish.title ? String(wish.title).trim() : item.company ? String(item.company).trim() : ""}</Text>
          {Number.isFinite(item.score) && <Text style={[styles.scoreText, darkMode && styles.darkScoreText]}>Score: {Number(item.score).toFixed(3)}</Text>}
          {renderScoreBreakdown(item)}
          {(wish.profile_wish_start || wish.profile_wish_end) && (
            <Text style={[styles.wishDateTime, darkMode && styles.darkWishDateTime]}>
              {wish.profile_wish_start ? formatDateTimeForDisplay(wish.profile_wish_start) : "—"}
              {wish.profile_wish_start && wish.profile_wish_end ? " → " : ""}
              {wish.profile_wish_end ? formatDateTimeForDisplay(wish.profile_wish_end) : ""}
            </Text>
          )}
          {wish.description && String(wish.description).trim() && String(wish.description).trim() !== "." && (
            <Text style={[styles.wishDescription, darkMode && styles.darkWishDescription]}>{String(wish.description).trim()}</Text>
          )}
          {wish.bounty && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 5, flex: 1 }}>
              <View style={{ flex: 1 }}>
                {wish.cost && (
                  <View style={styles.wishBountyContainer}>
                    <View style={styles.moneyBagIconContainer}>
                      <Text style={styles.moneyBagDollarSymbol}>$</Text>
                    </View>
                    <Text style={[styles.wishBountyLabel, darkMode && styles.darkWishBountyLabel]}>
                      {String(wish.cost).toLowerCase() !== "free" ? `Cost: $${String(wish.cost).replace(/^\$/, "")}` : `Cost: ${wish.cost}`}
                    </Text>
                  </View>
                )}
              </View>
              <View>
                {wish.bounty && (
                  <View style={styles.wishBountyContainer}>
                    <Text style={styles.bountyEmojiIcon}>💰</Text>
                    <Text style={[styles.wishBountyLabel, darkMode && styles.darkWishBountyLabel]}>
                      {String(wish.bounty).toLowerCase() !== "free" ? `Bounty: $${String(wish.bounty).replace(/^\$/, "")}` : `Bounty: ${wish.bounty}`}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
        {isOwnWish && <Text style={{ fontSize: 20, color: "#6e1010", fontStyle: "italic", marginTop: 4 }}>You cannot respond to your own request.</Text>}
      </TouchableOpacity>
    );
  };

  const renderExpertiseItem = (item, idx) => {
    // Render expertise item with MiniCard-like profile display
    const profile = item.profileData || {};
    const expertise = item.expertiseData || {};

    const isOwnExpertise = currentProfileUid && item.profile_uid === currentProfileUid;

    return (
      <TouchableOpacity
        key={`${item.id}-${idx}`}
        activeOpacity={isOwnExpertise ? 1 : 0.7}
        // style={[styles.wishItem, darkMode && styles.darkWishItem]}
        style={[styles.wishItem, darkMode && styles.darkWishItem, isOwnExpertise && { opacity: 0.6 }]}
        onPress={() => {
          if (isOwnExpertise) return;
          console.log("🏢 Navigating to ExpertiseDetail from expertise card:", expertise.title, "Profile ID:", item.profile_uid);
          if (item.profile_uid && expertise) {
            navigation.navigate("ExpertiseDetail", {
              expertiseData: expertise,
              profileData: profile,
              profile_uid: item.profile_uid,
              searchState: {
                searchQuery,
                searchType,
                results,
                distance,
                network,
                bounty,
                rating,
              },
            });
          } else {
            console.warn("No profile_uid or expertise data found for expertise item");
          }
        }}
      >
        {/* Profile Image and Info (MiniCard-like) */}
        <View style={styles.wishProfileContainer}>
          <Image
            source={profile.image && profile.imageIsPublic && profile.image !== "" && String(profile.image).trim() !== "" ? { uri: String(profile.image) } : require("../assets/profile.png")}
            style={[styles.wishProfileImage, darkMode && styles.darkWishProfileImage]}
            tintColor={darkMode ? "#ffffff" : undefined}
            onError={(error) => {
              console.log("Expertise profile image failed to load:", error.nativeEvent.error);
            }}
            defaultSource={require("../assets/profile.png")}
          />
          <View style={styles.wishProfileInfo}>
            {/* Name is always visible */}
            <Text style={[styles.wishProfileName, darkMode && styles.darkWishProfileName]}>{[profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Anonymous User"}</Text>
            {/* Show email if public */}
            {(() => {
              const email = profile.emailIsPublic && profile.email ? String(profile.email).trim() : "";
              return email && email !== "." ? <Text style={[styles.wishProfileText, darkMode && styles.darkWishProfileText]}>{email}</Text> : null;
            })()}
            {/* Show phone if public */}
            {(() => {
              const phone = profile.phoneIsPublic && profile.phone ? String(profile.phone).trim() : "";
              return phone && phone !== "." ? <Text style={[styles.wishProfileText, darkMode && styles.darkWishProfileText]}>{phone}</Text> : null;
            })()}
          </View>
        </View>

        {/* Expertise Information */}
        <View style={[styles.wishInfoContainer, darkMode && styles.darkWishInfoContainer]}>
          <Text style={[styles.wishTitle, darkMode && styles.darkWishTitle]}>{expertise.title ? String(expertise.title).trim() : item.company ? String(item.company).trim() : ""}</Text>
          {Number.isFinite(item.score) && <Text style={[styles.scoreText, darkMode && styles.darkScoreText]}>Score: {Number(item.score).toFixed(3)}</Text>}
          {renderScoreBreakdown(item)}
          {expertise.description && String(expertise.description).trim() && String(expertise.description).trim() !== "." && (
            <Text style={[styles.wishDescription, darkMode && styles.darkWishDescription]}>{String(expertise.description).trim()}</Text>
          )}
          <View style={styles.expertiseDetailsContainer}>
            {expertise.cost && (
              <View style={styles.wishBountyContainer}>
                <View style={styles.moneyBagIconContainer}>
                  <Text style={styles.moneyBagDollarSymbol}>$</Text>
                </View>
                <Text style={[styles.wishBountyLabel, darkMode && styles.darkWishBountyLabel]}>
                  {String(expertise.cost).toLowerCase() !== "free" ? `Cost: $${String(expertise.cost).replace(/^\$/, "")}` : `Cost: ${expertise.cost}`}
                </Text>
              </View>
            )}
            {expertise.bounty && (
              <View style={styles.wishBountyContainerRight}>
                <Text style={styles.bountyEmojiIcon}>💰</Text>
                <Text style={[styles.wishBountyLabel, darkMode && styles.darkWishBountyLabel]}>
                  {String(expertise.bounty).toLowerCase() !== "free" ? `Bounty: $${formatWholeDollars(expertise.bounty)}` : `Bounty: ${expertise.bounty}`}
                </Text>
              </View>
            )}
          </View>
        </View>
        {isOwnExpertise && <Text style={[styles.ownExpertiseNotice, darkMode && styles.darkOwnExpertiseNotice]}>You cannot purchase your own expertise.</Text>}
      </TouchableOpacity>
    );
  };

  const renderResultItem = (item, idx) => {
    // If it's a wish/seeking item, use the special wish renderer
    if (item.itemType === "seeking" && item.wishData) {
      return renderWishItem(item, idx);
    }
    // If it's an expertise item, use the special expertise renderer
    if (item.itemType === "expertise" && item.expertiseData) {
      return renderExpertiseItem(item, idx);
    }

    // console.log(`🎨 Rendering item ${idx}:`, item.company, "ID:", item.id);
    return (
      <TouchableOpacity
        key={`${item.id}-${idx}`}
        style={[styles.resultItem, darkMode && styles.darkResultItem]}
        activeOpacity={0.7}
        onPress={() => {
          console.log("🏢 Navigating to profile for:", item.company, "ID:", item.id, "Type:", item.itemType);
          if (item.itemType === "businesses") {
            navigation.navigate("BusinessProfile", {
              business_uid: item.id,
              returnTo: "Search",
              searchState: {
                searchQuery,
                searchType,
                results,
                distance,
                network,
                bounty,
                rating,
              },
            });
          } else if (item.itemType === "expertise" || item.itemType === "seeking") {
            // Navigate to user profile if we have profile_uid
            if (item.profile_uid) {
              navigation.navigate("Profile", {
                profile_uid: item.profile_uid,
                returnTo: "Search",
                searchState: {
                  searchQuery,
                  searchType,
                  results,
                  distance,
                  network,
                  bounty,
                  rating,
                },
              });
            } else {
              console.warn("No profile_uid found for expertise/seeking item");
            }
          }
        }}
      >
        <View style={styles.resultContent}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image
              source={item.business_profile_img ? { uri: encodeURI(item.business_profile_img.trim()) } : require("../assets/profile.png")}
              style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }}
              onError={(e) => console.log("Image load error:", e.nativeEvent.error, item.business_profile_img)}
              onLoad={() => console.log("Image loaded successfully:", item.business_profile_img)}
              defaultSource={require("../assets/profile.png")}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.companyName, darkMode && styles.darkCompanyName]}>{item.company ? String(item.company).trim() : ""}</Text>
              {Number.isFinite(item.score) && <Text style={[styles.scoreText, darkMode && styles.darkScoreText]}>Score: {Number(item.score).toFixed(3)}</Text>}
              {renderScoreBreakdown(item)}
              {/* Badge approach (kept commented until finalized)
              <Text style={[styles.resultTypeBadge, darkMode && styles.darkResultTypeBadge]}>
                {item.itemType === "businesses" ? "Business" : item.itemType === "expertise" ? "Offering" : "Seeking"}
              </Text>
              */}
              {(() => {
                const tagLine = item.business_tag_line ? String(item.business_tag_line).trim() : "";
                if (tagLine && tagLine !== "." && tagLine.length > 0) {
                  return <Text style={[styles.businessTagLine, darkMode && styles.darkBusinessTagLine]}>{tagLine}</Text>;
                }
                return null;
              })()}
            </View>
          </View>
        </View>
        <View style={styles.businessResultActions}>
          <View style={styles.businessTableRatingCol}>
            {Number.isFinite(item.rating) ? (
              <View style={styles.ratingContainer}>
                <Ionicons name='star' size={16} color='#FFCD3C' />
                <Text style={[styles.ratingText, darkMode && styles.darkRatingText]}>
                  {item.rating.toFixed(1)}
                  {item.ratingCount > 0 ? ` (${item.ratingCount})` : ""}
                </Text>
              </View>
            ) : (
              <Text style={[styles.metricPlaceholder, darkMode && styles.darkMetricPlaceholder]}>—</Text>
            )}
          </View>

          <View style={styles.businessTableBountyCol}>
            {item.max_bounty != null ? <Text style={[styles.bountyEmojiIcon, styles.bountyEmojiIconCompact]}>💰</Text> : <NoBountyIcon darkMode={darkMode} />}
          </View>

          <View style={styles.businessTableLevelCol}>
            <TouchableOpacity
              style={styles.levelButton}
              onPress={(e) => {
                e.stopPropagation();
                navigation.navigate("SearchTab", {
                  centerCompany: {
                    id: item.id,
                    name: item.company,
                    rating: item.rating,
                  },
                });
              }}
            >
              <View style={{ position: "relative" }}>
                <Image source={require("../assets/connect.png")} style={{ width: 22, height: 22, tintColor: darkMode ? "#ffffff" : "#000000" }} />
                {item.connection_degree != null && (
                  <View style={styles.connectionBadge}>
                    <Text style={styles.connectionBadgeText}>{item.connection_degree}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {(item.hasBounty || item.hasX || item.hasPriceTag || item.hasDollar) && (
            <View style={styles.businessDemoExtras}>
              {item.hasBounty && (
                <TouchableOpacity style={styles.actionButton} onPress={(e) => e.stopPropagation()}>
                  <Text style={styles.bountyEmojiIcon}>💰</Text>
                </TouchableOpacity>
              )}
              {item.hasX && (
                <TouchableOpacity style={styles.actionButton} onPress={(e) => e.stopPropagation()}>
                  <NoBountyIcon darkMode={darkMode} />
                </TouchableOpacity>
              )}
              {item.hasPriceTag && (
                <TouchableOpacity style={styles.actionButton} onPress={(e) => e.stopPropagation()}>
                  <Text style={[styles.percentSymbol, darkMode && styles.darkPercentSymbol]}>:%</Text>
                </TouchableOpacity>
              )}
              {item.hasDollar && (
                <TouchableOpacity style={styles.actionButton} onPress={(e) => e.stopPropagation()}>
                  <View style={[styles.moneyBagContainer, darkMode && styles.darkMoneyBagContainer]}>
                    <Text style={[styles.dollarSymbol, darkMode && styles.darkDollarSymbol]}>$</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, darkMode && styles.darkContainer]}>
      {/* Header */}
      <AppHeader
        title='SEARCH'
        {...getHeaderColors("search")}
        darkModeBackgroundColor='#4b2c91'
        onTitlePress={() => setShowFeedbackPopup(true)} // ✅ SAFE
        rightButton={
          <TouchableOpacity
            style={styles.cartButton}
            onPress={() =>
              navigation.navigate("ShoppingCart", {
                cartItems,
                onRemoveItem: async (index) => {
                  const itemToRemove = cartItems[index];
                  const businessUid = itemToRemove.business_uid;

                  const newCartItems = cartItems.filter((_, i) => i !== index);
                  setCartItems(newCartItems);
                  setCartCount(newCartItems.length);

                  await AsyncStorage.setItem(
                    `cart_${businessUid}`,
                    JSON.stringify({
                      items: newCartItems.filter((item) => item.business_uid === businessUid),
                    }),
                  );
                },
                businessName: "All Items",
                business_uid: "all",
              })
            }
          >
            <Ionicons name='cart-outline' size={24} color='#fff' />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />

      <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
        {/* Main Content */}
        <View style={styles.contentContainer}>
          {/* Search type buttons - ALWAYS VISIBLE ABOVE SEARCH BAR */}
          <View style={[styles.filterButtonsContainer, { marginBottom: 10 }]}>
            <TouchableOpacity
              style={[
                styles.filterButtonOption,
                darkMode && styles.darkFilterButtonOption,
                searchType === "global" && styles.searchTypeButtonGlobal,
                darkMode && searchType === "global" && styles.darkSearchTypeButtonGlobal,
              ]}
              onPress={() => {
                setSearchType("global");
                performSearch(searchQuery, "global");
              }}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  darkMode && styles.darkFilterButtonText,
                  searchType === "global" && styles.searchTypeButtonTextGlobal,
                  darkMode && searchType === "global" && styles.darkSearchTypeButtonTextGlobal,
                ]}
              >
                Global
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButtonOption,
                darkMode && styles.darkFilterButtonOption,
                searchType === "businesses" && styles.searchTypeButtonBusinesses,
                darkMode && searchType === "businesses" && styles.darkSearchTypeButtonBusinesses,
              ]}
              onPress={() => {
                setSearchType("businesses");
                performSearch(searchQuery, "businesses");
              }}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  darkMode && styles.darkFilterButtonText,
                  searchType === "businesses" && styles.searchTypeButtonTextBusinesses,
                  darkMode && searchType === "businesses" && styles.darkSearchTypeButtonTextBusinesses,
                ]}
              >
                Businesses
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButtonOption,
                darkMode && styles.darkFilterButtonOption,
                searchType === "expertise" && styles.searchTypeButtonExpertise,
                darkMode && searchType === "expertise" && styles.darkSearchTypeButtonExpertise,
              ]}
              onPress={() => {
                setSearchType("expertise");
                performSearch(searchQuery, "expertise");
              }}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  darkMode && styles.darkFilterButtonText,
                  searchType === "expertise" && styles.searchTypeButtonTextExpertise,
                  darkMode && searchType === "expertise" && styles.darkSearchTypeButtonTextExpertise,
                ]}
              >
                Offering
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButtonOption,
                darkMode && styles.darkFilterButtonOption,
                searchType === "seeking" && styles.searchTypeButtonSeeking,
                darkMode && searchType === "seeking" && styles.darkSearchTypeButtonSeeking,
              ]}
              onPress={() => {
                setSearchType("seeking");
                performSearch(searchQuery, "seeking");
              }}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  darkMode && styles.darkFilterButtonText,
                  searchType === "seeking" && styles.searchTypeButtonTextSeeking,
                  darkMode && searchType === "seeking" && styles.darkSearchTypeButtonTextSeeking,
                ]}
              >
                Seeking
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={[styles.searchInput, darkMode && styles.darkSearchInput]}
              placeholder='What are you looking for?'
              placeholderTextColor={darkMode ? "#cccccc" : "#666"}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType='search'
              onSubmitEditing={onSearch}
              accessibilitylabel='Search'
              accessibilityHint='Enter text to search'
              accessibilityRole='search'
            />
            <TouchableOpacity style={[styles.searchButton, darkMode && styles.darkSearchButton]} onPress={onSearch}>
              <Ionicons name='search' size={22} color={darkMode ? "#ffffff" : "#000000"} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterButton, darkMode && styles.darkFilterButton]} onPress={() => setShowFilters(!showFilters)}>
              <MaterialIcons name='filter-list' size={22} color={darkMode ? "#ffffff" : "#000000"} />
            </TouchableOpacity>
          </View>

          {/* Distance, Network, Bounty, Rating filters - TOGGLE BELOW SEARCH BAR */}
          {showFilters && (
            <View style={styles.filterButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.filterButtonOption,
                  darkMode && styles.darkFilterButtonOption,
                  distance !== null && styles.activeFilterButton,
                  darkMode && distance !== null && styles.darkActiveFilterButton,
                ]}
                onPress={() => setDistanceModalVisible(true)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    darkMode && styles.darkFilterButtonText,
                    distance !== null && styles.activeFilterButtonText,
                    darkMode && distance !== null && styles.darkActiveFilterButtonText,
                  ]}
                >
                  {distance !== null ? `${distance} mi` : "Distance"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterButtonOption,
                  darkMode && styles.darkFilterButtonOption,
                  network !== null && styles.activeFilterButton,
                  darkMode && network !== null && styles.darkActiveFilterButton,
                ]}
                onPress={() => setNetworkModalVisible(true)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    darkMode && styles.darkFilterButtonText,
                    network !== null && styles.activeFilterButtonText,
                    darkMode && network !== null && styles.darkActiveFilterButtonText,
                  ]}
                >
                  {network !== null ? network : "Network"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterButtonOption,
                  darkMode && styles.darkFilterButtonOption,
                  bounty !== null && styles.activeFilterButton,
                  darkMode && bounty !== null && styles.darkActiveFilterButton,
                ]}
                onPress={() => setBountyModalVisible(true)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    darkMode && styles.darkFilterButtonText,
                    bounty !== null && styles.activeFilterButtonText,
                    darkMode && bounty !== null && styles.darkActiveFilterButtonText,
                  ]}
                >
                  {bounty !== null ? bounty : "Bounty"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterButtonOption,
                  darkMode && styles.darkFilterButtonOption,
                  rating !== null && styles.activeFilterButton,
                  darkMode && rating !== null && styles.darkActiveFilterButton,
                ]}
                onPress={() => setRatingModalVisible(true)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    darkMode && styles.darkFilterButtonText,
                    rating !== null && styles.activeFilterButtonText,
                    darkMode && rating !== null && styles.darkActiveFilterButtonText,
                  ]}
                >
                  {rating !== null ? `> ${rating}` : "Rating"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Statement when Offering is selected */}
          {searchType === "expertise" && <Text style={[styles.offeringStatement, darkMode && styles.darkOfferingStatement]}>Discover what others have to offer:</Text>}

          {/* Statement when Seeking is selected */}
          {searchType === "seeking" && <Text style={[styles.seekingStatement, darkMode && styles.darkSeekingStatement]}>Discover what people need:</Text>}

          {/* Only show table header for businesses, not for expertise or seeking */}
          {searchType === "businesses" && (
            <View style={[styles.tableHeader, darkMode && styles.darkTableHeader]}>
              <Text style={[styles.tableHeaderText, styles.tableHeaderCompany, darkMode && styles.darkTableHeaderText]}>Company</Text>
              <Text style={[styles.tableHeaderText, styles.tableHeaderRating, darkMode && styles.darkTableHeaderText]}>Rating(#)</Text>
              <Text style={[styles.tableHeaderText, styles.tableHeaderBounty, darkMode && styles.darkTableHeaderText]} numberOfLines={1}>
                Bounty
              </Text>
              <Text style={[styles.tableHeaderText, styles.tableHeaderLevel, darkMode && styles.darkTableHeaderText]}>Level</Text>
            </View>
          )}

          <ScrollView style={styles.resultsContainer}>
            {loading ? (
              <Text style={[styles.loadingText, darkMode && styles.darkLoadingText]}>Loading…</Text>
            ) : searchType === "global" ? (
              <>
                <TouchableOpacity style={[styles.globalSectionHeader, darkMode && styles.darkGlobalSectionHeader]} onPress={() => setShowGlobalBusinesses((prev) => !prev)} activeOpacity={0.8}>
                  <Text style={[styles.globalSectionHeaderText, darkMode && styles.darkGlobalSectionHeaderText]}>Businesses ({globalBusinessResults.length})</Text>
                  <Ionicons name={showGlobalBusinesses ? "chevron-up" : "chevron-down"} size={18} color={darkMode ? "#fff" : "#333"} />
                </TouchableOpacity>
                {showGlobalBusinesses && globalBusinessResults.map((item, idx) => renderResultItem(item, idx))}

                <TouchableOpacity style={[styles.globalSectionHeader, darkMode && styles.darkGlobalSectionHeader]} onPress={() => setShowGlobalOffering((prev) => !prev)} activeOpacity={0.8}>
                  <Text style={[styles.globalSectionHeaderText, darkMode && styles.darkGlobalSectionHeaderText]}>Offering ({globalOfferingResults.length})</Text>
                  <Ionicons name={showGlobalOffering ? "chevron-up" : "chevron-down"} size={18} color={darkMode ? "#fff" : "#333"} />
                </TouchableOpacity>
                {showGlobalOffering && globalOfferingResults.map((item, idx) => renderResultItem(item, idx))}
              </>
            ) : (
              results.map((item, idx) => renderResultItem(item, idx))
            )}
          </ScrollView>

          <View style={[styles.bannerAd, darkMode && styles.darkBannerAd]}>
            <Text style={[styles.bannerAdText, darkMode && styles.darkBannerAdText]}>Relevant Banner Ad</Text>
          </View>
        </View>

        {/* Distance Selection Modal */}
        <Modal animationType='slide' transparent={true} visible={distanceModalVisible} onRequestClose={() => setDistanceModalVisible(false)}>
          <SafeAreaView style={[styles.modalContainer, darkMode && styles.darkModalContainer]}>
            <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
              <View style={[styles.modalHeader, darkMode && styles.darkModalHeader]}>
                <Text style={[styles.modalTitle, darkMode && styles.darkModalTitle]}>Select Distance</Text>
                <TouchableOpacity onPress={() => setDistanceModalVisible(false)}>
                  <Ionicons name='close' size={28} color={darkMode ? "#ffffff" : "#333"} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.resetOption, darkMode && styles.darkResetOption]}
                onPress={() => {
                  setDistance(null);
                  setDistanceModalVisible(false);
                }}
              >
                <Text style={[styles.resetOptionText, darkMode && styles.darkResetOptionText]}>Reset</Text>
              </TouchableOpacity>
              <FlatList
                data={distanceOptions.map((d) => `${d} mi`)}
                renderItem={({ item }) => {
                  const isSelected = distance !== null && item === `${distance} mi`;
                  return (
                    <TouchableOpacity
                      style={[styles.optionItem, isSelected && styles.selectedOption, darkMode && styles.darkOptionItem, darkMode && isSelected && styles.darkSelectedOption]}
                      onPress={() => {
                        const value = parseInt(item.replace(" mi", ""));
                        setDistance(value);
                        setDistanceModalVisible(false);
                      }}
                    >
                      <Text style={[styles.optionText, isSelected && styles.selectedOptionText, darkMode && styles.darkOptionText, darkMode && isSelected && styles.darkSelectedOptionText]}>
                        {item}
                      </Text>
                      {isSelected && <Ionicons name='checkmark' size={24} color={darkMode ? "#9C45F7" : "#9C45F7"} />}
                    </TouchableOpacity>
                  );
                }}
                keyExtractor={(item) => item.toString()}
                style={styles.optionsList}
              />
            </View>
          </SafeAreaView>
        </Modal>

        {/* Network Selection Modal */}
        <Modal animationType='slide' transparent={true} visible={networkModalVisible} onRequestClose={() => setNetworkModalVisible(false)}>
          <SafeAreaView style={[styles.modalContainer, darkMode && styles.darkModalContainer]}>
            <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
              <View style={[styles.modalHeader, darkMode && styles.darkModalHeader]}>
                <Text style={[styles.modalTitle, darkMode && styles.darkModalTitle]}>Select Network</Text>
                <TouchableOpacity onPress={() => setNetworkModalVisible(false)}>
                  <Ionicons name='close' size={28} color={darkMode ? "#ffffff" : "#333"} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.resetOption, darkMode && styles.darkResetOption]}
                onPress={() => {
                  setNetwork(null);
                  setNetworkModalVisible(false);
                }}
              >
                <Text style={[styles.resetOptionText, darkMode && styles.darkResetOptionText]}>Reset</Text>
              </TouchableOpacity>
              <FlatList
                data={networkOptions}
                renderItem={renderOptionItem(networkOptions, network, (value) => {
                  setNetwork(value);
                  setNetworkModalVisible(false);
                })}
                keyExtractor={(item) => item.toString()}
                style={styles.optionsList}
              />
            </View>
          </SafeAreaView>
        </Modal>

        {/* Bounty Selection Modal */}
        <Modal animationType='slide' transparent={true} visible={bountyModalVisible} onRequestClose={() => setBountyModalVisible(false)}>
          <SafeAreaView style={[styles.modalContainer, darkMode && styles.darkModalContainer]}>
            <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
              <View style={[styles.modalHeader, darkMode && styles.darkModalHeader]}>
                <Text style={[styles.modalTitle, darkMode && styles.darkModalTitle]}>Select Bounty</Text>
                <TouchableOpacity onPress={() => setBountyModalVisible(false)}>
                  <Ionicons name='close' size={28} color={darkMode ? "#ffffff" : "#333"} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.resetOption, darkMode && styles.darkResetOption]}
                onPress={() => {
                  setBounty(null);
                  setBountyModalVisible(false);
                }}
              >
                <Text style={[styles.resetOptionText, darkMode && styles.darkResetOptionText]}>Reset</Text>
              </TouchableOpacity>
              <FlatList
                data={bountyOptions}
                renderItem={renderOptionItem(bountyOptions, bounty, (value) => {
                  setBounty(value);
                  setBountyModalVisible(false);
                })}
                keyExtractor={(item) => item.toString()}
                style={styles.optionsList}
              />
            </View>
          </SafeAreaView>
        </Modal>

        {/* Rating Selection Modal */}
        <Modal animationType='slide' transparent={true} visible={ratingModalVisible} onRequestClose={() => setRatingModalVisible(false)}>
          <SafeAreaView style={[styles.modalContainer, darkMode && styles.darkModalContainer]}>
            <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
              <View style={[styles.modalHeader, darkMode && styles.darkModalHeader]}>
                <Text style={[styles.modalTitle, darkMode && styles.darkModalTitle]}>Select Rating</Text>
                <TouchableOpacity onPress={() => setRatingModalVisible(false)}>
                  <Ionicons name='close' size={28} color={darkMode ? "#ffffff" : "#333"} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.resetOption, darkMode && styles.darkResetOption]}
                onPress={() => {
                  setRating(null);
                  setRatingModalVisible(false);
                }}
              >
                <Text style={[styles.resetOptionText, darkMode && styles.darkResetOptionText]}>Reset</Text>
              </TouchableOpacity>
              <FlatList
                data={ratingOptions}
                renderItem={renderOptionItem(
                  ratingOptions,
                  rating !== null ? `> ${rating}` : null,
                  (value) => {
                    setRating(value);
                    setRatingModalVisible(false);
                  },
                  true,
                )}
                keyExtractor={(item) => item.toString()}
                style={styles.optionsList}
              />
            </View>
          </SafeAreaView>
        </Modal>

        {/* Bottom Navigation Bar */}
        <BottomNavBar navigation={navigation} />
        <FeedbackPopup visible={showFeedbackPopup} onClose={() => setShowFeedbackPopup(false)} pageName='Search' instructions={searchFeedbackInstructions} questions={searchFeedbackQuestions} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  container: { flex: 1, backgroundColor: "#fff" },
  cartButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
    minWidth: 40,
    minHeight: 40,
  },
  cartBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  contentContainer: { flex: 1, padding: 20, paddingTop: 30, paddingBottom: 100 },
  searchContainer: { flexDirection: "row", alignItems: "center", marginBottom: 25 },
  searchInput: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    padding: 12,
    marginRight: 10,
  },
  searchButton: { marginLeft: 10, backgroundColor: "#f0f0f0", borderRadius: 8, padding: 12 },
  filterButton: { marginLeft: 10, backgroundColor: "#f0f0f0", borderRadius: 8, padding: 12 },

  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tableHeaderText: { fontSize: 14, color: "#686868" },
  tableHeaderCompany: {
    flex: 1,
    paddingRight: 8,
  },
  tableHeaderRating: {
    width: 100,
    textAlign: "right",
    paddingRight: 6,
    flexShrink: 0,
  },
  /** Wider than `businessTableBountyCol` so the label stays one line; row icons stay narrow. */
  tableHeaderBounty: {
    width: 58,
    textAlign: "center",
    flexShrink: 0,
  },
  tableHeaderLevel: {
    width: 52,
    textAlign: "center",
    flexShrink: 0,
  },

  resultsContainer: { flex: 1, marginBottom: 15 },
  loadingText: { textAlign: "center", marginVertical: 10 },

  resultItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "#fff",
    borderRadius: 8,
    marginVertical: 4,
  },

  resultContent: { flex: 1 },
  companyName: { fontSize: 16, fontWeight: "500", color: "#333" },
  businessTagLine: { fontSize: 12, color: "#666", marginTop: 2, fontStyle: "italic" },
  businessResultActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  businessTableRatingCol: {
    width: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  businessTableBountyCol: {
    width: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  businessTableLevelCol: {
    width: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  levelButton: {
    padding: 4,
  },
  metricPlaceholder: {
    fontSize: 16,
    color: "#999",
    fontWeight: "500",
  },
  businessDemoExtras: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
  },
  actionButton: { marginLeft: 10 },

  ratingContainer: { flexDirection: "row" },
  starCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFCD3C",
    marginRight: 5,
  },
  noBountyIconWrap: {
    width: 24,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  noBountyEmoji: {
    fontSize: 20,
  },
  noBountySlash: {
    position: "absolute",
    width: 26,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#1a1a1a",
    transform: [{ rotate: "-42deg" }],
  },
  percentSymbol: {
    fontSize: 18,
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  moneyBagContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "black",
    alignItems: "center",
    justifyContent: "center",
  },
  dollarSymbol: { fontSize: 14, fontWeight: "bold" },

  bannerAd: {
    backgroundColor: "#e0e0e0",
    padding: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 15,
  },
  bannerAdText: { fontSize: 16, fontWeight: "bold" },

  // Filter buttons container
  filterButtonsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 15,
    gap: 6,
  },
  filterButtonOption: {
    backgroundColor: "#f0f0f0",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 4,
    marginBottom: 4,
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#333",
  },
  activeFilterButton: {
    backgroundColor: "#4F8A8B",
  },
  activeFilterButtonText: {
    color: "#fff",
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  resetOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#f8f8f8",
  },
  resetOptionText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#9C45F7",
    textAlign: "center",
  },
  optionsList: {
    paddingHorizontal: 20,
  },
  optionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  selectedOption: {
    backgroundColor: "#f8f0ff",
  },
  optionText: {
    fontSize: 16,
    color: "#333",
  },
  selectedOptionText: {
    color: "#9C45F7",
    fontWeight: "500",
  },

  // Dark mode styles
  darkContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkSafeArea: {
    backgroundColor: "#1a1a1a",
  },
  darkSearchInput: {
    backgroundColor: "#404040",
    color: "#ffffff",
  },
  darkSearchButton: {
    backgroundColor: "#404040",
  },
  darkFilterButton: {
    backgroundColor: "#404040",
  },
  darkTableHeader: {
    borderBottomColor: "#404040",
  },
  darkTableHeaderText: {
    color: "#cccccc",
  },
  darkResultItem: {
    backgroundColor: "#2d2d2d",
    borderBottomColor: "#404040",
  },
  darkCompanyName: {
    color: "#ffffff",
  },
  darkBusinessTagLine: {
    color: "#cccccc",
  },
  darkRatingText: {
    color: "#cccccc",
  },
  darkMetricPlaceholder: {
    color: "#777777",
  },
  darkNoBountySlash: {
    backgroundColor: "#f0f0f0",
  },
  darkPercentSymbol: {
    color: "#ffffff",
    borderColor: "#ffffff",
  },
  darkMoneyBagContainer: {
    borderColor: "#ffffff",
  },
  darkDollarSymbol: {
    color: "#ffffff",
  },
  darkLoadingText: {
    color: "#cccccc",
  },
  darkBannerAd: {
    backgroundColor: "#404040",
  },
  darkBannerAdText: {
    color: "#ffffff",
  },
  // Dark mode filter button styles
  darkFilterButtonOption: {
    backgroundColor: "#404040",
  },
  darkFilterButtonText: {
    color: "#ffffff",
  },
  darkActiveFilterButton: {
    backgroundColor: "#4F8A8B",
  },
  darkActiveFilterButtonText: {
    color: "#ffffff",
  },
  // Dark mode modal styles
  darkModalContainer: {
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  darkModalContent: {
    backgroundColor: "#2d2d2d",
  },
  darkModalHeader: {
    borderBottomColor: "#404040",
  },
  darkModalTitle: {
    color: "#ffffff",
  },
  darkResetOption: {
    backgroundColor: "#404040",
    borderBottomColor: "#404040",
  },
  darkResetOptionText: {
    color: "#9C45F7",
  },
  darkOptionItem: {
    borderBottomColor: "#404040",
  },
  darkSelectedOption: {
    backgroundColor: "#3d2d4d",
  },
  darkOptionText: {
    color: "#ffffff",
  },
  darkSelectedOptionText: {
    color: "#9C45F7",
  },

  // Wish item styles
  wishItem: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginVertical: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: "#000",
  },
  wishProfileContainer: {
    flexDirection: "row",
    marginBottom: 15,
    alignItems: "center",
  },
  wishProfileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  wishProfileInfo: {
    flex: 1,
  },
  wishProfileName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#333",
  },
  wishProfileText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  wishInfoContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  wishTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  wishDateTime: {
    fontSize: 13,
    color: "#666",
    marginBottom: 8,
  },
  wishDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 10,
    lineHeight: 20,
  },
  wishBountyContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  wishBountyContainerRight: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    alignSelf: "flex-end",
  },
  moneyBagIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFCD3C",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  moneyBagDollarSymbol: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ffffff",
  },
  connectionBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#9C45F7",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  connectionBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
    lineHeight: 12,
  },
  bountyEmojiIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  bountyEmojiIconCompact: {
    fontSize: 20,
    marginRight: 0,
  },
  wishBountyLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  wishBountyValue: {
    fontSize: 16,
    color: "#AF52DE",
    fontWeight: "bold",
  },
  // Dark mode wish styles
  darkWishItem: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
    boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.3)",
  },
  darkWishProfileImage: {
    // tintColor moved to Image prop
  },
  darkWishProfileName: {
    color: "#ffffff",
  },
  darkWishProfileText: {
    color: "#cccccc",
  },
  darkWishTitle: {
    color: "#ffffff",
  },
  darkWishDateTime: {
    color: "#cccccc",
  },
  darkWishDescription: {
    color: "#cccccc",
  },
  darkWishBountyLabel: {
    color: "#cccccc",
  },
  darkWishBountyValue: {
    color: "#9C45F7",
  },
  darkWishInfoContainer: {
    borderTopColor: "#404040",
  },
  expertiseDetailsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 5,
  },
  ownExpertiseNotice: {
    fontSize: 13,
    color: "#6e1010",
    fontStyle: "italic",
    marginTop: 4,
  },
  darkOwnExpertiseNotice: {
    color: "#e8a0a0",
  },

  offeringStatement: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  darkOfferingStatement: {
    color: "#e0e0e0",
  },
  seekingStatement: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  darkSeekingStatement: {
    color: "#e0e0e0",
  },

  // Search type button styles
  searchTypeButtonBusinesses: {
    backgroundColor: "#4F8A8B",
  },
  searchTypeButtonGlobal: {
    backgroundColor: "#4F8A8B",
  },
  searchTypeButtonExpertise: {
    backgroundColor: "#4F8A8B",
  },
  searchTypeButtonSeeking: {
    backgroundColor: "#4F8A8B",
  },
  searchTypeButtonTextBusinesses: {
    color: "#fff",
    fontWeight: "600",
  },
  searchTypeButtonTextGlobal: {
    color: "#fff",
    fontWeight: "600",
  },
  searchTypeButtonTextExpertise: {
    color: "#fff",
    fontWeight: "600",
  },
  searchTypeButtonTextSeeking: {
    color: "#fff",
    fontWeight: "600",
  },
  // Dark mode search type button styles
  darkSearchTypeButtonBusinesses: {
    backgroundColor: "#AF52DE",
  },
  darkSearchTypeButtonGlobal: {
    backgroundColor: "#6A5ACD",
  },
  darkSearchTypeButtonExpertise: {
    backgroundColor: "#FFCD3C",
  },
  darkSearchTypeButtonSeeking: {
    backgroundColor: "#9C45F7",
  },
  darkSearchTypeButtonTextBusinesses: {
    color: "#fff",
    fontWeight: "600",
  },
  darkSearchTypeButtonTextGlobal: {
    color: "#fff",
    fontWeight: "600",
  },
  darkSearchTypeButtonTextExpertise: {
    color: "#000",
    fontWeight: "600",
  },
  darkSearchTypeButtonTextSeeking: {
    color: "#fff",
    fontWeight: "600",
  },
  globalSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(79, 138, 139, 0.5)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  globalSectionHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
  darkGlobalSectionHeader: {
    backgroundColor: "rgba(61, 107, 108, 0.5)",
  },
  darkGlobalSectionHeaderText: {
    color: "#fff",
  },
  scoreText: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  scoreBreakdownText: {
    fontSize: 10,
    color: "#7a7a7a",
    marginTop: 1,
  },
  darkScoreText: {
    color: "#cccccc",
  },
  darkScoreBreakdownText: {
    color: "#aaaaaa",
  },
  offeringStatement: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  darkOfferingStatement: {
    color: "#e0e0e0",
  },
  seekingStatement: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  darkSeekingStatement: {
    color: "#e0e0e0",
  },
});
