// SearchScreen.js
import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, FlatList, ActivityIndicator, Alert, Dimensions, Modal, Image, Platform } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BUSINESS_RESULTS_ENDPOINT, EXPERTISE_RESULTS_ENDPOINT, WISHES_RESULTS_ENDPOINT, TAG_SEARCH_DISTINCT_ENDPOINT, TAG_CATEGORY_DISTINCT_ENDPOINT, SEARCH_BASE_URL } from "../apiConfig";
import { useDarkMode } from "../contexts/DarkModeContext";
import FeedbackPopup from "../components/FeedbackPopup";

export default function SearchScreen({ route }) {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();
  const [cartItems, setCartItems] = useState([]);
  const [cartCount, setCartCount] = useState(0);

  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);
  
    const searchFeedbackInstructions = "Instructions for Search";
  
    // Define custom questions for the Account page
    const searchFeedbackQuestions = [
      "Search - Question 1?",
      "Search - Question 2?",
      "Search - Question 3?"
    ];
  

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

  // Search type state: 'businesses', 'expertise', 'seeking'
  const [searchType, setSearchType] = useState("businesses");

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
        console.log("✅ Search screen state restored");
      }
    }, [route.params?.restoreState, route.params?.searchState])
  );

  // Load cart items when component mounts and when screen is focused
  useEffect(() => {
    const loadCartItems = async () => {
      try {
        console.log("SearchScreen.js - Loading cart items...");
        // Get all keys from AsyncStorage
        const keys = await AsyncStorage.getAllKeys();
        // Filter keys that start with 'cart_'
        const cartKeys = keys.filter((key) => key.startsWith("cart_"));
        console.log("Found cart keys:", cartKeys);

        let totalItems = 0;
        let allCartItems = [];

        // Load items from each cart
        for (const key of cartKeys) {
          const cartData = await AsyncStorage.getItem(key);
          if (cartData) {
            const { items } = JSON.parse(cartData);
            totalItems += items.length;
            // Add business_uid to each item
            const businessUid = key.replace("cart_", "");
            const itemsWithBusiness = items.map((item) => ({
              ...item,
              business_uid: businessUid,
            }));
            allCartItems = [...allCartItems, ...itemsWithBusiness];
          }
        }

        console.log("Cart count updated:", totalItems);
        console.log("Total cart items:", allCartItems.length);
        setCartCount(totalItems);
        setCartItems(allCartItems);
      } catch (error) {
        console.error("Error loading cart items:", error);
        // Reset cart state on error
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

  // Filter options (same as FilterScreen)
  const distanceOptions = [5, 10, 15, 25, 50, 100];
  const networkOptions = [1, 2, 3, 4, 5];
  const bountyOptions = ["Any", "Low", "Medium", "High"];
  const ratingOptions = ["> 1", "> 2", "> 3", "> 4", "> 4.5", "> 4.6", "> 4.8"];

  const onSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;

    console.log("🔍 User searched for:", q);
    console.log("🔍 Search type:", searchType);
    console.log("🔍 Search query length:", q.length);
    console.log("🔍 Search query type:", typeof q);
    console.log("🔍 Rating filter:", rating);

    setLoading(true);
    try {
      // Select the appropriate endpoint based on search type
      let baseEndpoint;
      switch (searchType) {
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
                `Note: The server must respond to OPTIONS preflight requests with proper CORS headers.`
            );
          }
        } else {
          throw fetchError;
        }
      }

      // Check if response is opaque (from no-cors mode)
      const isOpaque = res.type === "opaque" || res.type === "opaqueredirect";

      if (isOpaque) {
        console.warn("⚠️ Response is opaque (from no-cors mode). Status and headers are not accessible.");
      } else {
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

      // console.log("📡 Search API Response:", JSON.stringify(json, null, 2));
      // console.log("📊 Number of results returned:", Array.isArray(json) ? json.length : json.results?.length || json.result?.length || 0);

      // Handle both possible response structures
      // console.log("🔍 Raw JSON response:", json);
      // console.log("🔍 JSON type:", typeof json);
      // console.log("🔍 Is array?", Array.isArray(json));

      // The API returns an array directly, not wrapped in results/result
      const resultsArray = Array.isArray(json) ? json : json.results || json.result || [];
      // console.log("🔍 Results array length:", resultsArray.length);

      // Process results based on search type
      let list;
      if (searchType === "seeking") {
        // For seeking/wishes, the response includes profile data directly
        list = resultsArray.map((item, i) => ({
          id: `${item.profile_wish_uid || i}`,
          company: item.profile_wish_title || "Untitled Wish",
          rating: typeof item.score === "number" ? Math.min(5, Math.max(1, Math.round(item.score * 5))) : 4,
          hasPriceTag: false,
          hasX: false,
          hasDollar: false,
          business_short_bio: item.profile_wish_description || "",
          business_tag_line: item.profile_wish_title || "",
          tags: [],
          score: item.score || 0,
          itemType: "seeking",
          profile_uid: item.profile_wish_profile_personal_id,
          // Store wish data
          wishData: {
            title: item.profile_wish_title,
            description: item.profile_wish_description,
            bounty: item.profile_wish_bounty,
            cost: item.profile_wish_cost,
            wish_uid: item.profile_wish_uid,
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
        }));
      } else if (searchType === "expertise") {
        // For expertise, the response includes profile data directly
        list = resultsArray.map((item, i) => ({
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
          itemType: "expertise",
          profile_uid: item.profile_expertise_profile_personal_id,
          // Store expertise data
          expertiseData: {
            title: item.profile_expertise_title,
            description: item.profile_expertise_description,
            details: item.profile_expertise_details,
            bounty: item.profile_expertise_bounty,
            cost: item.profile_expertise_cost,
            expertise_uid: item.profile_expertise_uid,
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
        }));
      } else {
        // For businesses, use the existing mapping
        list = resultsArray.map((b, i) => {
          // Sanitize text fields to prevent periods from being rendered as text nodes
          const sanitizeText = (text) => {
            if (!text) return "";
            const str = String(text).trim();
            // If it's just a period or starts with a period that might cause issues, return empty
            return str === "." ? "" : str;
          };

          return {
            id: `${b.business_uid || i}`,
            company: sanitizeText(b.business_name || b.company) || "Unknown Business",
            // Use score as rating if rating_star not available, convert to 1-5 scale
            rating: typeof b.rating_star === "number" ? b.rating_star : typeof b.score === "number" ? Math.min(5, Math.max(1, Math.round(b.score * 5))) : 4,
            hasPriceTag: b.has_price_tag || false,
            hasX: b.has_x || false,
            hasDollar: b.has_dollar_sign || false,
            // Add additional fields from the API response - sanitize to prevent period issues
            business_short_bio: sanitizeText(b.business_short_bio),
            business_tag_line: sanitizeText(b.business_tag_line),
            tags: b.tags || [],
            score: b.score || 0,
            itemType: "businesses",
          };
        });
      }

      console.log("✅ Processed search results:", list);
      console.log("✅ Number of processed results:", list.length);

      // Debug: Check for any periods in the data that might cause issues
      list.forEach((item, idx) => {
        Object.keys(item).forEach((key) => {
          const value = item[key];
          if (typeof value === "string" && value.trim() === ".") {
            console.warn(`⚠️ Found period in item ${idx}, field ${key}:`, value);
          }
        });
      });

      console.log("✅ Setting results state...");
      setResults(list);
      console.log("✅ Results state updated");
    } catch (err) {
      console.warn("❌ Search failed for query:", q, "Error:", err);
      console.warn("❌ Error details:", err.message);
      console.warn("❌ Error type:", err.constructor.name);

      // Check if it's a network error (common on iOS with HTTP endpoints or connection issues)
      if (err.message.includes("Network request failed") || err.message.includes("Failed to fetch")) {
        Alert.alert("Network Error", "Unable to connect to the search server. Please check your internet connection or try again later.", [{ text: "OK" }]);
        setResults([]);
        return;
      }

      // If the v1 endpoint fails, let's try alternative endpoints
      if (err.message.includes("404")) {
        console.log("🔄 Trying alternative endpoints...");
        await tryAlternativeEndpoints(q);
      } else {
        setResults([]);
      }
    }
    setLoading(false);
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
        console.log("📡 Alternative endpoint response status:", res.status);

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
              // Use score as rating if rating_star not available, convert to 1-5 scale
              rating: typeof b.rating_star === "number" ? b.rating_star : typeof b.score === "number" ? Math.min(5, Math.max(1, Math.round(b.score * 5))) : 4,
              hasPriceTag: b.has_price_tag || false,
              hasX: b.has_x || false,
              hasDollar: b.has_dollar_sign || false,
              // Add additional fields from the API response - sanitize to prevent period issues
              business_short_bio: sanitizeText(b.business_short_bio),
              business_tag_line: sanitizeText(b.business_tag_line),
              tags: b.tags || [],
              score: b.score || 0,
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

  const renderWishItem = (item, idx) => {
    // Render wish item with MiniCard-like profile display
    const profile = item.profileData || {};
    const wish = item.wishData || {};

    return (
      <TouchableOpacity
        key={`${item.id}-${idx}`}
        activeOpacity={0.7}
        style={[styles.wishItem, darkMode && styles.darkWishItem]}
        onPress={() => {
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
              onError={(error) => {
                console.log("Wish profile image failed to load:", error.nativeEvent.error);
              }}
              defaultSource={require("../assets/profile.png")}
            />
            <View style={styles.wishProfileInfo}>
              {/* Name is always visible */}
              <Text style={[styles.wishProfileName, darkMode && styles.darkWishProfileName]}>{[profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Unknown"}</Text>
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
          {wish.description && String(wish.description).trim() && String(wish.description).trim() !== "." && (
            <Text style={[styles.wishDescription, darkMode && styles.darkWishDescription]}>{String(wish.description).trim()}</Text>
          )}
          {wish.bounty && (
            <View style={styles.wishBountyContainerRight}>
              <Text style={styles.bountyEmojiIcon}>💰</Text>
              <Text style={[styles.wishBountyLabel, darkMode && styles.darkWishBountyLabel]}>Bounty: USD {wish.bounty}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderExpertiseItem = (item, idx) => {
    // Render expertise item with MiniCard-like profile display
    const profile = item.profileData || {};
    const expertise = item.expertiseData || {};

    return (
      <TouchableOpacity
        key={`${item.id}-${idx}`}
        activeOpacity={0.7}
        style={[styles.wishItem, darkMode && styles.darkWishItem]}
        onPress={() => {
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
            onError={(error) => {
              console.log("Expertise profile image failed to load:", error.nativeEvent.error);
            }}
            defaultSource={require("../assets/profile.png")}
          />
          <View style={styles.wishProfileInfo}>
            {/* Name is always visible */}
            <Text style={[styles.wishProfileName, darkMode && styles.darkWishProfileName]}>{[profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Unknown"}</Text>
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
          {expertise.description && String(expertise.description).trim() && String(expertise.description).trim() !== "." && (
            <Text style={[styles.wishDescription, darkMode && styles.darkWishDescription]}>{String(expertise.description).trim()}</Text>
          )}
          <View style={styles.expertiseDetailsContainer}>
            {expertise.cost && (
              <View style={styles.wishBountyContainer}>
                <View style={styles.moneyBagIconContainer}>
                  <Text style={styles.moneyBagDollarSymbol}>$</Text>
                </View>
                <Text style={[styles.wishBountyLabel, darkMode && styles.darkWishBountyLabel]}>Cost: {expertise.cost}</Text>
              </View>
            )}
            {expertise.bounty && (
              <View style={styles.wishBountyContainerRight}>
                <Text style={styles.bountyEmojiIcon}>💰</Text>
                <Text style={[styles.wishBountyLabel, darkMode && styles.darkWishBountyLabel]}>Bounty: USD {expertise.bounty}</Text>
              </View>
            )}
          </View>
        </View>
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
            navigation.navigate("BusinessProfile", { business_uid: item.id });
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
          <Text style={[styles.companyName, darkMode && styles.darkCompanyName]}>{item.company ? String(item.company).trim() : ""}</Text>
          {(() => {
            const tagLine = item.business_tag_line ? String(item.business_tag_line).trim() : "";
            if (tagLine && tagLine !== "." && tagLine.length > 0) {
              return <Text style={[styles.businessTagLine, darkMode && styles.darkBusinessTagLine]}>{tagLine}</Text>;
            }
            return null;
          })()}
        </View>
        <View style={styles.resultActions}>
          <View style={styles.ratingContainer}>
            <Ionicons name='star' size={16} color='#FFCD3C' />
            <Text style={[styles.ratingText, darkMode && styles.darkRatingText]}>{typeof item.rating === "number" ? item.rating.toFixed(1) : item.rating ? String(item.rating) : "N/A"}</Text>
          </View>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation(); // Prevent triggering the parent TouchableOpacity
              navigation.navigate("SearchTab", {
                centerCompany: {
                  id: item.id,
                  name: item.company,
                  rating: item.rating,
                },
              });
            }}
          >
            <Ionicons name='share-social-outline' size={22} color={darkMode ? "#ffffff" : "#000000"} />
          </TouchableOpacity>

          {item.hasX && (
            <TouchableOpacity style={styles.actionButton} onPress={(e) => e.stopPropagation()}>
              <Text style={[styles.xSymbol, darkMode && styles.darkXSymbol]}>X</Text>
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
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, darkMode && styles.darkContainer]}>
      {/* Header */}
      <TouchableOpacity 
        onPress={() => setShowFeedbackPopup(true)}
        activeOpacity={0.7}
      >
      <AppHeader
        title='Search'
        backgroundColor='#AF52DE'
        darkModeBackgroundColor='#4b2c91'
        rightButton={
          <TouchableOpacity
            style={styles.cartButton}
            onPress={() =>
              navigation.navigate("ShoppingCart", {
                cartItems: cartItems,
                onRemoveItem: async (index) => {
                  // Get the business_uid from the item being removed before filtering
                  const itemToRemove = cartItems[index];
                  const businessUid = itemToRemove.business_uid;

                  // Create a new array without the removed item
                  const newCartItems = cartItems.filter((_, i) => i !== index);
                  setCartItems(newCartItems);
                  setCartCount(newCartItems.length);

                  // Update AsyncStorage for the specific business
                  await AsyncStorage.setItem(
                    `cart_${businessUid}`,
                    JSON.stringify({
                      items: newCartItems.filter((item) => item.business_uid === businessUid),
                    })
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
      </TouchableOpacity>

      <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
        {/* Main Content */}
        <View style={styles.contentContainer}>
          <View style={styles.searchContainer}>
            <TextInput
              style={[styles.searchInput, darkMode && styles.darkSearchInput]}
              placeholder='What are you looking for?'
              placeholderTextColor={darkMode ? "#cccccc" : "#666"}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType='search'
              onSubmitEditing={onSearch}
            />
            <TouchableOpacity style={[styles.searchButton, darkMode && styles.darkSearchButton]} onPress={onSearch}>
              <Ionicons name='search' size={22} color={darkMode ? "#ffffff" : "#000000"} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterButton, darkMode && styles.darkFilterButton]} onPress={() => setShowFilters(!showFilters)}>
              <MaterialIcons name='filter-list' size={22} color={darkMode ? "#ffffff" : "#000000"} />
            </TouchableOpacity>
          </View>

          {/* Filter Buttons */}
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
              <TouchableOpacity
                style={[
                  styles.filterButtonOption,
                  darkMode && styles.darkFilterButtonOption,
                  searchType === "businesses" && styles.searchTypeButtonBusinesses,
                  searchType === "expertise" && styles.searchTypeButtonExpertise,
                  searchType === "seeking" && styles.searchTypeButtonSeeking,
                  darkMode && searchType === "businesses" && styles.darkSearchTypeButtonBusinesses,
                  darkMode && searchType === "expertise" && styles.darkSearchTypeButtonExpertise,
                  darkMode && searchType === "seeking" && styles.darkSearchTypeButtonSeeking,
                ]}
                onPress={() => {
                  // Cycle through: businesses -> expertise -> seeking -> businesses
                  if (searchType === "businesses") {
                    setSearchType("expertise");
                  } else if (searchType === "expertise") {
                    setSearchType("seeking");
                  } else {
                    setSearchType("businesses");
                  }
                }}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    darkMode && styles.darkFilterButtonText,
                    searchType === "businesses" && styles.searchTypeButtonTextBusinesses,
                    searchType === "expertise" && styles.searchTypeButtonTextExpertise,
                    searchType === "seeking" && styles.searchTypeButtonTextSeeking,
                    darkMode && searchType === "businesses" && styles.darkSearchTypeButtonTextBusinesses,
                    darkMode && searchType === "expertise" && styles.darkSearchTypeButtonTextExpertise,
                    darkMode && searchType === "seeking" && styles.darkSearchTypeButtonTextSeeking,
                  ]}
                >
                  {searchType === "businesses" ? "Businesses" : searchType === "expertise" ? "Expertise" : "Seeking"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Only show table header for businesses, not for expertise or seeking */}
          {searchType === "businesses" && (
            <View style={[styles.tableHeader, darkMode && styles.darkTableHeader]}>
              <Text style={[styles.tableHeaderText, darkMode && styles.darkTableHeaderText]}>Company</Text>
              <Text style={[styles.tableHeaderText, darkMode && styles.darkTableHeaderText]}>Rating</Text>
            </View>
          )}

          <ScrollView style={styles.resultsContainer}>
            {loading ? <Text style={[styles.loadingText, darkMode && styles.darkLoadingText]}>Loading…</Text> : results.map((item, idx) => renderResultItem(item, idx))}
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
                  true
                )}
                keyExtractor={(item) => item.toString()}
                style={styles.optionsList}
              />
            </View>
          </SafeAreaView>
        </Modal>

        {/* Bottom Navigation Bar */}
        <BottomNavBar navigation={navigation} />
        <FeedbackPopup
          visible={showFeedbackPopup}
          onClose={() => setShowFeedbackPopup(false)}
          pageName="Search"
          instructions={searchFeedbackInstructions}
          questions={searchFeedbackQuestions}
        />
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
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tableHeaderText: { fontSize: 16, color: "#888" },

  resultsContainer: { flex: 1, marginBottom: 15 },
  loadingText: { textAlign: "center", marginVertical: 10 },

  resultItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
    borderRadius: 8,
    marginVertical: 2,
  },
  resultContent: { flex: 1 },
  companyName: { fontSize: 16, fontWeight: "500", color: "#333" },
  businessTagLine: { fontSize: 12, color: "#666", marginTop: 2, fontStyle: "italic" },
  resultActions: { flexDirection: "row", alignItems: "center" },
  actionButton: { marginLeft: 15 },

  ratingContainer: { flexDirection: "row" },
  starCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFCD3C",
    marginRight: 5,
  },
  xSymbol: { fontSize: 22, fontWeight: "bold" },
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
    backgroundColor: "#AF52DE",
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
  darkXSymbol: {
    color: "#ffffff",
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
    backgroundColor: "#AF52DE",
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
    borderColor: "#E5E5E5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  bountyEmojiIcon: {
    fontSize: 20,
    marginRight: 6,
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
    shadowOpacity: 0.3,
  },
  darkWishProfileImage: {
    tintColor: "#ffffff",
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

  // Search type button styles
  searchTypeButtonBusinesses: {
    backgroundColor: "#AF52DE", // Same as header color
  },
  searchTypeButtonExpertise: {
    backgroundColor: "#FFCD3C", // Yellow like rating star
  },
  searchTypeButtonSeeking: {
    backgroundColor: "#9C45F7", // Purple like selected options
  },
  searchTypeButtonTextBusinesses: {
    color: "#fff",
    fontWeight: "600",
  },
  searchTypeButtonTextExpertise: {
    color: "#000",
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
  darkSearchTypeButtonTextExpertise: {
    color: "#000",
    fontWeight: "600",
  },
  darkSearchTypeButtonTextSeeking: {
    color: "#fff",
    fontWeight: "600",
  },
});
