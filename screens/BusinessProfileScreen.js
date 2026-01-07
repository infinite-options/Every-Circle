// BusinessProfileScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Image, TouchableOpacity, Alert, Modal, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import MiniCard from "../components/MiniCard";
import ProductCard from "../components/ProductCard";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BUSINESS_INFO_ENDPOINT, USER_PROFILE_INFO_ENDPOINT, CATEGORY_LIST_ENDPOINT } from "../apiConfig";
import { useDarkMode } from "../contexts/DarkModeContext";
import { sanitizeText, isSafeForConditional } from "../utils/textSanitizer";
import { getHeaderColors } from "../config/headerColors";

const BusinessProfileApi = BUSINESS_INFO_ENDPOINT;
const ProfileScreenAPI = USER_PROFILE_INFO_ENDPOINT;

export default function BusinessProfileScreen({ route, navigation }) {
  const { darkMode } = useDarkMode();
  const { business_uid } = route.params;
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [userReview, setUserReview] = useState(null);
  const [allReviews, setAllReviews] = useState([]);
  const [currentUserProfileId, setCurrentUserProfileId] = useState(null);
  const [businessUsers, setBusinessUsers] = useState([]);
  const [reviewerProfiles, setReviewerProfiles] = useState({}); // Store reviewer profile data by profile_id
  const [viewportWidth, setViewportWidth] = useState(null); // Track viewport width for web responsiveness

  // Handle viewport resize on web (for DevTools opening/closing)
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const updateViewportWidth = () => {
        setViewportWidth(window.innerWidth);
      };

      // Set initial width
      updateViewportWidth();

      // Listen for resize events
      window.addEventListener("resize", updateViewportWidth);

      // Also listen for orientation changes
      window.addEventListener("orientationchange", updateViewportWidth);

      return () => {
        window.removeEventListener("resize", updateViewportWidth);
        window.removeEventListener("orientationchange", updateViewportWidth);
      };
    }
  }, []);

  // Load cart items when component mounts
  useEffect(() => {
    const loadCartItems = async () => {
      try {
        const storedCartData = await AsyncStorage.getItem(`cart_${business_uid}`);
        if (storedCartData) {
          const cartData = JSON.parse(storedCartData);
          setCartItems(cartData.items || []);
        }
      } catch (error) {
        console.error("Error loading cart items:", error);
      }
    };

    loadCartItems();
  }, [business_uid]);

  // Get current user's profile ID
  useEffect(() => {
    const getCurrentUserProfileId = async () => {
      try {
        const profileId = await AsyncStorage.getItem("profile_uid");
        setCurrentUserProfileId(profileId);
      } catch (error) {
        console.error("Error getting current user profile ID:", error);
      }
    };
    getCurrentUserProfileId();
  }, []);

  // Fetch reviewer profile data
  const fetchReviewerProfile = async (profileId) => {
    if (!profileId || reviewerProfiles[profileId]) {
      return; // Already fetched or invalid
    }

    try {
      console.log("BusinessProfileScreen - Fetching reviewer profile for:", profileId);
      const response = await fetch(`${ProfileScreenAPI}/${profileId}`);
      const result = await response.json();

      if (result && result.personal_info) {
        const personalInfo = result.personal_info;
        const reviewerData = {
          firstName: sanitizeText(personalInfo.profile_personal_first_name),
          lastName: sanitizeText(personalInfo.profile_personal_last_name),
          profileImage: personalInfo.profile_personal_image ? sanitizeText(String(personalInfo.profile_personal_image)) : "",
        };
        setReviewerProfiles((prev) => ({
          ...prev,
          [profileId]: reviewerData,
        }));
        console.log("BusinessProfileScreen - Reviewer profile loaded for:", profileId, reviewerData);
      }
    } catch (error) {
      console.error("BusinessProfileScreen - Error fetching reviewer profile:", profileId, error);
    }
  };

  // Process reviews when currentUserProfileId becomes available
  useEffect(() => {
    if (currentUserProfileId && business && business.ratings) {
      console.log("Reprocessing reviews with profile ID:", currentUserProfileId);

      let userReviewFromAPI = null;
      let otherReviews = [];

      console.log("Processing ratings from business data:");
      console.log("Current user profile ID:", currentUserProfileId);
      console.log("All ratings from business:", business.ratings);

      if (business.ratings && Array.isArray(business.ratings)) {
        business.ratings.forEach((rating) => {
          console.log("Processing rating:", rating.rating_uid, "Profile ID:", rating.rating_profile_id);
          if (rating.rating_profile_id === currentUserProfileId) {
            console.log("Found user review:", rating.rating_uid);
            userReviewFromAPI = rating;
          } else {
            console.log("Adding to other reviews:", rating.rating_uid);
            otherReviews.push(rating);
            // Fetch reviewer profile data for each review
            if (rating.rating_profile_id) {
              fetchReviewerProfile(rating.rating_profile_id);
            }
          }
        });
      }

      console.log("User review found:", userReviewFromAPI ? userReviewFromAPI.rating_uid : "None");
      console.log("Other reviews count:", otherReviews.length);
      console.log(
        "Other reviews:",
        otherReviews.map((r) => r.rating_uid)
      );

      setUserReview(userReviewFromAPI);
      setAllReviews(otherReviews);
    }
  }, [currentUserProfileId, business]);

  const fetchBusinessInfo = async () => {
    try {
      setLoading(true);
      const endpoint = `${BusinessProfileApi}/${business_uid}`;
      console.log("BusinessProfileScreen GET endpoint:", endpoint);
      const response = await fetch(endpoint);
      const result = await response.json();

      if (!result || !result.business) {
        throw new Error("Business not found or malformed response");
      }

      console.log("BusinessProfileScreen received data:", JSON.stringify(result, null, 2));

      const rawBusiness = result.business;
      console.log("BusinessProfileScreen - business_role in rawBusiness:", rawBusiness?.business_role);
      console.log("BusinessProfileScreen - bu_role in rawBusiness:", rawBusiness?.bu_role);
      console.log("BusinessProfileScreen - All business fields:", Object.keys(rawBusiness || {}));
      console.log("BusinessProfileScreen - Full rawBusiness object:", JSON.stringify(rawBusiness, null, 2));

      // Handle social_links - now it's an array of objects
      let socialLinksData = {};
      if (rawBusiness.social_links) {
        if (Array.isArray(rawBusiness.social_links)) {
          // New format: array of objects with social_link_name and business_link_url
          rawBusiness.social_links.forEach((link) => {
            if (link.business_link_url && link.business_link_url.trim() !== "") {
              socialLinksData[link.social_link_name] = link.business_link_url;
            }
          });
        } else if (typeof rawBusiness.social_links === "string") {
          // Old format: JSON string
          try {
            socialLinksData = JSON.parse(rawBusiness.social_links);
          } catch (e) {
            console.log("Failed to parse social_links as JSON");
            socialLinksData = {};
          }
        }
      }

      console.log("Processed social links:", socialLinksData);

      // Handle business_google_photos - it might be a string or array
      let businessImages = [];
      if (rawBusiness.business_google_photos) {
        if (typeof rawBusiness.business_google_photos === "string") {
          try {
            businessImages = JSON.parse(rawBusiness.business_google_photos);
          } catch (e) {
            console.log("Failed to parse business_google_photos as JSON, treating as single URL");
            businessImages = [rawBusiness.business_google_photos];
          }
        } else if (Array.isArray(rawBusiness.business_google_photos)) {
          businessImages = rawBusiness.business_google_photos;
        }
      }

      // Handle business_images_url - user uploaded images from S3
      if (rawBusiness.business_images_url) {
        let uploadedImages = [];
        if (typeof rawBusiness.business_images_url === "string") {
          try {
            uploadedImages = JSON.parse(rawBusiness.business_images_url);
          } catch (e) {
            console.log("Failed to parse business_images_url as JSON");
            uploadedImages = [];
          }
        } else if (Array.isArray(rawBusiness.business_images_url)) {
          uploadedImages = rawBusiness.business_images_url;
        }
        // URLs should already be full S3 URLs, but handle both cases
        uploadedImages = uploadedImages
          .map((img) => {
            if (img && typeof img === "string") {
              // If it's already a full URL, use it; otherwise construct it
              if (img.startsWith("http://") || img.startsWith("https://")) {
                return img;
              }
              // Construct full S3 URL if only filename is provided
              return `https://s3-us-west-1.amazonaws.com/every-circle/business_personal/${rawBusiness.business_uid}/${img}`;
            }
            return null;
          })
          .filter(Boolean); // Remove any null values
        // Merge uploaded images with Google photos (uploaded images first)
        businessImages = [...uploadedImages, ...businessImages];
        console.log("Combined business images (uploaded + Google):", businessImages);
      }

      // Filter out problematic URLs that won't work in React Native
      businessImages = businessImages.filter((uri) => {
        // Check if URI is valid
        if (!uri || typeof uri !== "string" || uri.trim() === "" || uri === "null" || uri === "undefined") {
          return false;
        }

        // Filter out Google Maps API URLs that don't work in React Native
        if (uri.includes("maps.googleapis.com/maps/api/place/js/PhotoService") || uri.includes("PhotoService.GetPhoto") || uri.includes("callback=none")) {
          console.log("Filtering out Google API URL that won't work in React Native:", uri.substring(0, 100) + "...");
          return false;
        }

        // Only allow direct image URLs or valid http/https URLs
        const isValidImageUrl = uri.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i) || uri.startsWith("http://") || uri.startsWith("https://");

        if (!isValidImageUrl) {
          console.log("Filtering out invalid image URL:", uri.substring(0, 100));
          return false;
        }

        return true;
      });

      console.log("Processed business images after filtering:", businessImages);

      // Handle custom tags if available
      // Check both rawBusiness.custom_tags and result.tags (root level)
      let customTags = [];

      // First check root level 'tags' from API response
      if (result.tags && Array.isArray(result.tags)) {
        customTags = result.tags;
        console.log("BusinessProfileScreen - Using root level tags:", customTags);
      }
      // Then check rawBusiness.custom_tags
      else if (rawBusiness.custom_tags) {
        if (typeof rawBusiness.custom_tags === "string") {
          try {
            customTags = JSON.parse(rawBusiness.custom_tags);
            console.log("BusinessProfileScreen - Parsed custom_tags string:", customTags);
          } catch (e) {
            console.log("Failed to parse custom_tags as JSON");
            customTags = [];
          }
        } else if (Array.isArray(rawBusiness.custom_tags)) {
          customTags = rawBusiness.custom_tags;
          console.log("BusinessProfileScreen - Using custom_tags array:", customTags);
        }
      }

      console.log("BusinessProfileScreen - Final customTags:", customTags);

      // Fetch category name if business_category_id is present
      let categoryName = rawBusiness.business_category || null;
      if (rawBusiness.business_category_id && !categoryName) {
        try {
          const categoryResponse = await fetch(CATEGORY_LIST_ENDPOINT);
          const categoryResult = await categoryResponse.json();
          if (categoryResult && categoryResult.result) {
            // business_category_id might be a single ID or comma-separated IDs
            const categoryIds = rawBusiness.business_category_id.split(",").map((id) => id.trim());
            const categoryNames = categoryIds
              .map((id) => {
                const category = categoryResult.result.find((cat) => cat.category_uid === id);
                return category ? category.category_name : null;
              })
              .filter(Boolean);
            categoryName = categoryNames.length > 0 ? categoryNames.join(", ") : null;
          }
        } catch (e) {
          console.log("Failed to fetch category name:", e);
        }
      }

      // Store ratings in business object for later processing when profile ID is available
      const businessWithRatings = {
        ...rawBusiness,
        business_user_id: rawBusiness.business_user_id || "", // Include business_user_id for ownership check
        business_email_id: rawBusiness.business_email_id || "",
        business_phone_number: rawBusiness.business_phone_number || "",
        tagline: rawBusiness.business_tag_line || rawBusiness.tagline || "",
        business_short_bio: rawBusiness.business_short_bio || rawBusiness.short_bio || "",
        business_role: rawBusiness.business_role || rawBusiness.role || rawBusiness.bu_role || "",
        business_ein_number: rawBusiness.business_ein_number || "",
        ein_number: rawBusiness.business_ein_number || "", // Alias for display
        facebook: socialLinksData.facebook || "",
        instagram: socialLinksData.instagram || "",
        linkedin: socialLinksData.linkedin || "",
        youtube: socialLinksData.youtube || "",
        images: businessImages,
        customTags: customTags,
        business_category: categoryName || rawBusiness.business_category || null,
        ratings: result.ratings, // Store ratings for later processing
        emailIsPublic: rawBusiness.business_email_id_is_public === "1" || rawBusiness.business_email_id_is_public === 1 || rawBusiness.email_is_public === "1" || rawBusiness.email_is_public === 1,
        phoneIsPublic:
          rawBusiness.business_phone_number_is_public === "1" || rawBusiness.business_phone_number_is_public === 1 || rawBusiness.phone_is_public === "1" || rawBusiness.phone_is_public === 1,
        taglineIsPublic:
          rawBusiness.business_tag_line_is_public === "1" || rawBusiness.business_tag_line_is_public === 1 || rawBusiness.tagline_is_public === "1" || rawBusiness.tagline_is_public === 1,
        shortBioIsPublic:
          rawBusiness.business_short_bio_is_public === "1" || rawBusiness.business_short_bio_is_public === 1 || rawBusiness.short_bio_is_public === "1" || rawBusiness.short_bio_is_public === 1,
        business_services: (() => {
          if (rawBusiness.business_services) {
            if (typeof rawBusiness.business_services === "string") {
              try {
                return JSON.parse(rawBusiness.business_services);
              } catch (e) {
                console.log("Failed to parse business_services as JSON");
                return [];
              }
            } else if (Array.isArray(rawBusiness.business_services)) {
              return rawBusiness.business_services;
            }
          }
          // Fallback: use result.services if present
          if (Array.isArray(result.services)) {
            return result.services;
          }
          return [];
        })(),
      };

      setBusiness(businessWithRatings);

      // Store business_users if available
      if (result.business_users && Array.isArray(result.business_users)) {
        console.log("BusinessProfileScreen - business_users:", JSON.stringify(result.business_users, null, 2));
        setBusinessUsers(result.business_users);
      } else {
        setBusinessUsers([]);
      }
    } catch (err) {
      console.error("Error fetching business data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkBusinessOwnership = async () => {
      try {
        // Method 1: Check business_user_id directly from business object (most reliable)
        if (business && business.business_user_id) {
          const currentUserUid = await AsyncStorage.getItem("user_uid");
          console.log("BusinessProfileScreen - Checking ownership via business_user_id:");
          console.log("  - business.business_user_id:", business.business_user_id);
          console.log("  - currentUserUid:", currentUserUid);

          if (business.business_user_id === currentUserUid) {
            console.log("BusinessProfileScreen - User is owner (via business_user_id match)");
            setIsOwner(true);
            return;
          }
        }

        // Method 2: Check via user profile business_info array (fallback)
        const userUid = await AsyncStorage.getItem("user_uid");
        const profileUID = await AsyncStorage.getItem("profile_uid");
        console.log("BusinessProfileScreen - Checking ownership via profile business_info:");
        console.log("  - user_uid:", userUid);
        console.log("  - profile_uid:", profileUID);
        console.log("  - business_uid:", business_uid);

        if (!userUid && !profileUID) {
          console.log("BusinessProfileScreen - No user/profile UID found");
          setIsOwner(false);
          return;
        }

        // Try with profile_uid first (more accurate)
        let uidToUse = profileUID || userUid;
        const response = await fetch(`${ProfileScreenAPI}/${uidToUse}`);
        const userData = await response.json();
        console.log("BusinessProfileScreen - Profile API response:", JSON.stringify(userData, null, 2));

        if (userData && userData.business_info) {
          const businessInfo = typeof userData.business_info === "string" ? JSON.parse(userData.business_info) : userData.business_info;
          // console.log("BusinessProfileScreen - business_info array:", JSON.stringify(businessInfo, null, 2));

          const isBusinessOwner = businessInfo.some((biz) => {
            const matches = biz.business_uid === business_uid || biz.profile_business_business_id === business_uid;
            console.log(`BusinessProfileScreen - Checking business:`, {
              biz_business_uid: biz.business_uid,
              biz_profile_business_business_id: biz.profile_business_business_id,
              target_business_uid: business_uid,
              matches: matches,
            });
            return matches;
          });

          console.log("BusinessProfileScreen - isBusinessOwner result:", isBusinessOwner);
          setIsOwner(isBusinessOwner);
        } else {
          console.log("BusinessProfileScreen - No business_info in user profile");
          setIsOwner(false);
        }
      } catch (error) {
        console.error("BusinessProfileScreen - Error checking business ownership:", error);
        setIsOwner(false);
      }
    };

    // Only check ownership if we have business data
    if (business) {
      checkBusinessOwnership();
    }
  }, [business_uid, business]);

  // Add focus listener to refresh data when returning to this screen
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      console.log("BusinessProfileScreen focused - refreshing data");
      fetchBusinessInfo();
    });

    // Initial fetch
    fetchBusinessInfo();

    return unsubscribe;
  }, [navigation, business_uid]);

  const handleProductPress = (service) => {
    if (!isOwner) {
      setSelectedService(service);
      setQuantity(1);
      setQuantityModalVisible(true);
    }
  };

  const handleQuantityConfirm = async () => {
    try {
      const serviceWithQuantity = {
        ...selectedService,
        quantity: quantity,
        totalPrice: (parseFloat(selectedService.bs_cost) * quantity).toFixed(2),
      };

      // Check if the item already exists in the cart
      const existingItemIndex = cartItems.findIndex((item) => item.bs_uid === selectedService.bs_uid);

      let newCartItems;
      if (existingItemIndex !== -1) {
        // Item exists, update its quantity
        newCartItems = [...cartItems];
        const existingItem = newCartItems[existingItemIndex];
        const newQuantity = (existingItem.quantity || 1) + quantity;
        newCartItems[existingItemIndex] = {
          ...existingItem,
          quantity: newQuantity,
          totalPrice: (parseFloat(existingItem.bs_cost) * newQuantity).toFixed(2),
        };
        console.log(`Updated quantity for existing item ${selectedService.bs_service_name} to ${newQuantity}`);
      } else {
        // Item doesn't exist, add it as new
        newCartItems = [...cartItems, serviceWithQuantity];
        console.log(`Added new item ${selectedService.bs_service_name} with quantity ${quantity}`);
      }

      setCartItems(newCartItems);

      // Save to AsyncStorage
      await AsyncStorage.setItem(
        `cart_${business_uid}`,
        JSON.stringify({
          items: newCartItems,
        })
      );

      setQuantityModalVisible(false);
    } catch (error) {
      console.error("Error adding item to cart:", error);
      Alert.alert("Error", "Failed to add item to cart");
    }
  };

  const handleRemoveItem = async (index) => {
    try {
      const newCartItems = cartItems.filter((_, i) => i !== index);
      setCartItems(newCartItems);

      // Update AsyncStorage
      await AsyncStorage.setItem(
        `cart_${business_uid}`,
        JSON.stringify({
          items: newCartItems,
        })
      );
    } catch (error) {
      console.error("Error removing item from cart:", error);
      Alert.alert("Error", "Failed to remove item from cart");
    }
  };

  const handleViewCart = () => {
    navigation.navigate("ShoppingCart", {
      cartItems,
      onRemoveItem: handleRemoveItem,
      businessName: business.business_name,
      business_uid: business_uid,
      recommender_profile_id: currentUserProfileId,
    });
  };

  const renderStars = (rating) => {
    return (
      <View style={{ flexDirection: "row" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={[styles.starCircle, i < rating && styles.starCircleFilled]} />
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size='large' color='#00C721' />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load business data.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.pageContainer, darkMode && styles.darkPageContainer]} key={Platform.OS === "web" ? `viewport-${viewportWidth}` : undefined}>
      {/* Header */}
      <AppHeader
        title='Business Profile'
        {...getHeaderColors("businessProfile")}
        rightButton={
          isOwner ? (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() =>
                navigation.navigate("EditBusinessProfile", {
                  business: business,
                  business_uid: business_uid,
                  business_users: businessUsers,
                })
              }
            >
              <Image source={require("../assets/Edit.png")} style={[styles.editIcon, darkMode && styles.darkEditIcon]} tintColor={darkMode ? "#fff" : "#fff"} />
            </TouchableOpacity>
          ) : null
        }
      />

      <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
        <ScrollView
          style={[styles.scrollContainer, darkMode && styles.darkScrollContainer]}
          contentContainerStyle={[
            styles.content,
            Platform.OS === "web" && {
              width: "100%",
              maxWidth: "100%",
            },
          ]}
          {...(Platform.OS === "web" && {
            style: [styles.scrollContainer, darkMode && styles.darkScrollContainer, { zIndex: 1 }],
          })}
        >
          {/* Business Card (MiniCard at top) */}
          <View style={[styles.card, darkMode && styles.darkCard]}>
            <MiniCard
              business={{
                business_name: sanitizeText(business.business_name),
                business_address_line_1: sanitizeText(business.business_address_line_1),
                business_zip_code: sanitizeText(business.business_zip_code),
                business_phone_number: sanitizeText(business.business_phone_number),
                business_email: sanitizeText(business.business_email_id),
                business_website: sanitizeText(business.business_website),
                //first_image: business.images && business.images.length > 0 ? business.images[0] : null,
                first_image: business.business_favorite_image || (business.images && business.images.length > 0 ? business.images[0] : null),
                phoneIsPublic: business.phoneIsPublic,
                emailIsPublic: business.emailIsPublic,
              }}
            />
          </View>

          {/* Contact Information Card */}
          <View style={[styles.card, darkMode && styles.darkCard]}>
            <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>Contact Information</Text>

            <View style={styles.infoRow}>
              <Text style={[styles.label, darkMode && styles.darkLabel]}>Location:</Text>
              <Text style={[styles.value, darkMode && styles.darkValue]}>
                {(() => {
                  const parts = [
                    sanitizeText(business.business_address_line_1),
                    sanitizeText(business.business_address_line_2),
                    sanitizeText(business.business_city),
                    sanitizeText(business.business_state),
                    sanitizeText(business.business_zip_code),
                    sanitizeText(business.business_country),
                  ].filter((part) => part && part !== ".");
                  return parts.length > 0 ? parts.join(", ") : "N/A";
                })()}
              </Text>
            </View>

            {business.phoneIsPublic && isSafeForConditional(business.business_phone_number) && (
              <View style={styles.infoRow}>
                <Text style={[styles.label, darkMode && styles.darkLabel]}>Phone:</Text>
                <Text style={[styles.value, darkMode && styles.darkValue]}>{sanitizeText(business.business_phone_number)}</Text>
              </View>
            )}

            {business.emailIsPublic && isSafeForConditional(business.business_email_id) && (
              <View style={styles.infoRow}>
                <Text style={[styles.label, darkMode && styles.darkLabel]}>Email:</Text>
                <Text style={[styles.value, darkMode && styles.darkValue]}>{sanitizeText(business.business_email_id)}</Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Text style={[styles.label, darkMode && styles.darkLabel]}>Business Category:</Text>
              <Text style={[styles.value, darkMode && styles.darkValue]}>{sanitizeText(business.business_category, "N/A")}</Text>
            </View>

            {isSafeForConditional(business.business_website) && (
              <View style={styles.infoRow}>
                <Text style={[styles.label, darkMode && styles.darkLabel]}>Website:</Text>
                <Text style={[styles.link, darkMode && styles.darkLink]}>🌐 {sanitizeText(business.business_website)}</Text>
              </View>
            )}

            {isSafeForConditional(business.business_role || business.role || business.bu_role) && (
              <View style={styles.infoRow}>
                <Text style={[styles.label, darkMode && styles.darkLabel]}>Business Role:</Text>
                <Text style={[styles.value, darkMode && styles.darkValue]}>{sanitizeText(business.business_role || business.role || business.bu_role)}</Text>
              </View>
            )}

            {isSafeForConditional(business.ein_number) && (
              <View style={styles.infoRow}>
                <Text style={[styles.label, darkMode && styles.darkLabel]}>EIN Number:</Text>
                <Text style={[styles.value, darkMode && styles.darkValue]}>{sanitizeText(business.ein_number)}</Text>
              </View>
            )}
          </View>

          {/* Business Details Card */}
          {business.taglineIsPublic && isSafeForConditional(business.tagline) && (
            <View style={[styles.card, darkMode && styles.darkCard]}>
              <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>Tagline</Text>
              <Text style={[styles.bioText, darkMode && styles.darkBioText]}>{sanitizeText(business.tagline)}</Text>
            </View>
          )}

          {/* About Section */}
          {business.shortBioIsPublic && isSafeForConditional(business.business_short_bio) && (
            <View style={[styles.card, darkMode && styles.darkCard]}>
              <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>About</Text>
              <Text style={[styles.bioText, darkMode && styles.darkBioText]}>{sanitizeText(business.business_short_bio)}</Text>
            </View>
          )}

          {/* Business Hours */}
          {isSafeForConditional(business.business_hours) && (
            <View style={[styles.card, darkMode && styles.darkCard]}>
              <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>Business Hours</Text>
              <Text style={[styles.bioText, darkMode && styles.darkBioText]}>{sanitizeText(business.business_hours)}</Text>
            </View>
          )}

          {/* Rating and Price Level */}
          {(business.google_rating || business.price_level) && (
            <View style={[styles.card, darkMode && styles.darkCard]}>
              <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>Rating & Pricing</Text>
              {isSafeForConditional(business.google_rating) && (
                <View style={styles.infoRow}>
                  <Text style={[styles.label, darkMode && styles.darkLabel]}>Google Rating:</Text>
                  <Text style={[styles.value, darkMode && styles.darkValue]}>⭐ {sanitizeText(business.google_rating)}</Text>
                </View>
              )}
              {business.price_level && (
                <View style={styles.infoRow}>
                  <Text style={[styles.label, darkMode && styles.darkLabel]}>Price Level:</Text>
                  <Text style={[styles.value, darkMode && styles.darkValue]}>{"$".repeat(parseInt(business.price_level) || 1)}</Text>
                </View>
              )}
            </View>
          )}

          {/* Custom Tags - Only visible to owners/editors */}
          {isOwner && business.customTags && business.customTags.length > 0 && (
            <View style={[styles.card, darkMode && styles.darkCard]}>
              <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>Tags</Text>
              <View style={styles.tagsContainer}>
                {business.customTags
                  .map((tag) => sanitizeText(tag))
                  .filter((tag) => tag && tag !== "." && tag.trim() !== "" && !tag.match(/^[\s.,;:!?\-_=+]*$/))
                  .map((tag, index) => {
                    // Final safety check before rendering
                    if (!tag || tag === "." || tag.trim() === "") return null;
                    return (
                      <View key={index} style={[styles.tag, darkMode && styles.darkTag]}>
                        <Text style={[styles.tagText, darkMode && styles.darkTagText]}>{tag}</Text>
                      </View>
                    );
                  })
                  .filter(Boolean)}
              </View>
            </View>
          )}

          {/* Social Links Card */}
          {(() => {
            const hasSocialLinks = business.facebook || business.instagram || business.linkedin || business.youtube;
            if (!hasSocialLinks) return null;

            return (
              <View style={[styles.card, darkMode && styles.darkCard]}>
                <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>Social Links</Text>
                {isSafeForConditional(business.facebook) && <Text style={[styles.socialLink, darkMode && styles.darkSocialLink]}>📘 Facebook: {sanitizeText(business.facebook)}</Text>}
                {isSafeForConditional(business.instagram) && <Text style={[styles.socialLink, darkMode && styles.darkSocialLink]}>📸 Instagram: {sanitizeText(business.instagram)}</Text>}
                {isSafeForConditional(business.linkedin) && <Text style={[styles.socialLink, darkMode && styles.darkSocialLink]}>🔗 LinkedIn: {sanitizeText(business.linkedin)}</Text>}
                {isSafeForConditional(business.youtube) && <Text style={[styles.socialLink, darkMode && styles.darkSocialLink]}>▶️ YouTube: {sanitizeText(business.youtube)}</Text>}
              </View>
            );
          })()}

          {/* Business Images Card - Only show if there are images */}
          {Array.isArray(business.images) && business.images.length > 0 && (
            <View style={[styles.card, darkMode && styles.darkCard]}>
              <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>Business Images</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                {business.images.map((uri, index) => (
                  <View key={index} style={styles.imageContainer}>
                    <Image
                      source={{ uri: uri }}
                      style={styles.image}
                      onError={(error) => {
                        console.log(`Business image ${index} failed to load:`, error.nativeEvent.error);
                        console.log(`Problematic URI:`, uri);
                      }}
                      onLoad={() => console.log(`Business image ${index} loaded successfully`)}
                      defaultSource={require("../assets/profile.png")}
                      resizeMode='cover'
                    />
                  </View>
                ))}
              </ScrollView>
              {business.images.length === 0 && <Text style={[styles.noDataText, darkMode && styles.darkNoDataText]}>No compatible images available</Text>}
            </View>
          )}

          {/* Business Editors/Owners Section - Only visible to owners/editors */}
          {isOwner && businessUsers.length > 0 && (
            <View style={[styles.card, darkMode && styles.darkCard]}>
              <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>Business Editors & Owners</Text>
              {businessUsers.map((businessUser, index) => {
                // Debug logging for each business user
                if (__DEV__) {
                  console.log(`🔍 BusinessProfileScreen - Processing businessUser ${index}:`, {
                    first_name: businessUser.first_name,
                    last_name: businessUser.last_name,
                    user_email: businessUser.user_email,
                    business_role: businessUser.business_role,
                    profile_photo: businessUser.profile_photo,
                    raw: businessUser,
                  });
                }

                // Format user data for MiniCard component - sanitize everything
                const firstName = sanitizeText(businessUser.first_name);
                const lastName = sanitizeText(businessUser.last_name);
                const email = sanitizeText(businessUser.user_email);
                const profileImage = sanitizeText(businessUser.profile_photo);
                const role = sanitizeText(businessUser.business_role, "N/A");

                // Debug after sanitization
                if (__DEV__) {
                  console.log(`🔍 BusinessProfileScreen - After sanitization ${index}:`, {
                    firstName,
                    lastName,
                    email,
                    profileImage,
                    role,
                  });
                }

                const userForMiniCard = {
                  firstName,
                  lastName,
                  email,
                  profileImage,
                  // Note: We don't have visibility flags from business_users, so we'll show email/phone if they exist
                  emailIsPublic: true, // Assume public since we're showing to owners/editors
                  phoneIsPublic: false, // No phone in business_users data
                  phoneNumber: "", // No phone in business_users data
                };

                return (
                  <View key={businessUser.business_user_id || index} style={[styles.businessUserCard, darkMode && styles.darkBusinessUserCard]}>
                    <MiniCard user={userForMiniCard} />
                    {(() => {
                      // Extra defensive check for role rendering
                      const roleText = role && role !== "." && role.trim() !== "" ? role : "N/A";
                      if (__DEV__ && (role === "." || role === "")) {
                        console.warn(`⚠️ BusinessProfileScreen - Invalid role detected for user ${index}:`, businessUser.business_role, "-> sanitized to:", role);
                      }
                      return <Text style={[styles.businessUserRole, darkMode && styles.darkBusinessUserRole]}>Role: {roleText}</Text>;
                    })()}
                  </View>
                );
              })}
            </View>
          )}

          {/* Review Business Button or User Review */}
          {!isOwner &&
            (userReview ? (
              <View style={[styles.userReviewContainer, darkMode && styles.darkUserReviewContainer]}>
                <Text style={[styles.userReviewTitle, darkMode && styles.darkUserReviewTitle]}>Your Review</Text>
                <View style={styles.userReviewRow}>
                  <Text style={[styles.userReviewLabel, darkMode && styles.darkUserReviewLabel]}>Rating:</Text>
                  <View style={styles.userReviewRatingContainer}>
                    {renderStars(userReview.rating_star)}
                    <Text style={[styles.userReviewValue, darkMode && styles.darkUserReviewValue, { marginLeft: 8 }]}>{userReview.rating_star} / 5</Text>
                  </View>
                </View>
                <View style={styles.userReviewRow}>
                  <Text style={[styles.userReviewLabel, darkMode && styles.darkUserReviewLabel]}>Comments:</Text>
                  <Text style={[styles.userReviewValue, darkMode && styles.darkUserReviewValue]}>{userReview.rating_description}</Text>
                </View>
                <View style={styles.userReviewRow}>
                  <Text style={[styles.userReviewLabel, darkMode && styles.darkUserReviewLabel]}>Date:</Text>
                  <Text style={[styles.userReviewValue, darkMode && styles.darkUserReviewValue]}>{userReview.rating_receipt_date}</Text>
                </View>
                {userReview.rating_uid && (
                  <View style={styles.userReviewRow}>
                    <Text style={[styles.userReviewLabel, darkMode && styles.darkUserReviewLabel]}>Transaction ID:</Text>
                    <Text style={[styles.userReviewValue, darkMode && styles.darkUserReviewValue]}>{userReview.rating_uid}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.editReviewButton, darkMode && styles.darkEditReviewButton]}
                  onPress={() =>
                    navigation.navigate("ReviewBusiness", {
                      business_uid: business_uid,
                      business_name: business.business_name,
                      reviewData: userReview,
                      isEdit: true,
                    })
                  }
                >
                  <Text style={styles.editReviewButtonText}>Edit Review</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.reviewButton, darkMode && styles.darkReviewButton]}
                onPress={() =>
                  navigation.navigate("ReviewBusiness", {
                    business_uid: business_uid,
                    business_name: business.business_name,
                  })
                }
              >
                <Text style={styles.reviewButtonText}>Review Business</Text>
              </TouchableOpacity>
            ))}

          {/* All Reviews Section */}
          {allReviews.length > 0 && (
            <View style={[styles.card, darkMode && styles.darkCard]}>
              <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>Reviews ({allReviews.length})</Text>
              {allReviews.map((review, index) => (
                <TouchableOpacity
                  key={review.rating_uid || index}
                  style={[styles.reviewCard, darkMode && styles.darkReviewCard]}
                  onPress={() =>
                    navigation.navigate("ReviewDetail", {
                      business_uid: business_uid,
                      business_name: business.business_name,
                      reviewer_profile_id: review.rating_profile_id,
                      business_data: business, // Pass the entire business object
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.reviewCardHeader}>
                    <View style={styles.reviewProfileInfo}>
                      {reviewerProfiles[review.rating_profile_id]?.profileImage ? (
                        <Image
                          source={{ uri: reviewerProfiles[review.rating_profile_id].profileImage }}
                          style={[styles.reviewProfileAvatar, darkMode && styles.darkReviewProfileAvatar]}
                          defaultSource={require("../assets/profile.png")}
                        />
                      ) : (
                        <View style={[styles.reviewProfileAvatar, darkMode && styles.darkReviewProfileAvatar]}>
                          <Text style={[styles.reviewProfileInitial, darkMode && styles.darkReviewProfileInitial]}>
                            {(() => {
                              const profile = reviewerProfiles[review.rating_profile_id];
                              if (profile) {
                                const firstChar = (profile.firstName?.charAt(0) || profile.lastName?.charAt(0) || "").toUpperCase();
                                if (firstChar && firstChar !== ".") {
                                  return firstChar;
                                }
                              }
                              const fallback = (review.rating_profile_id?.charAt(0) || "U").toUpperCase();
                              return fallback !== "." ? fallback : "U";
                            })()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.reviewProfileDetails}>
                        <Text style={[styles.reviewProfileName, darkMode && styles.darkReviewProfileName]}>
                          {(() => {
                            const profile = reviewerProfiles[review.rating_profile_id];
                            if (profile) {
                              const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
                              if (name && name !== ".") {
                                return name;
                              }
                            }
                            return `User ${review.rating_profile_id || "Unknown"}`;
                          })()}
                        </Text>
                        <Text style={[styles.reviewDate, darkMode && styles.darkReviewDate]}>{review.rating_receipt_date}</Text>
                      </View>
                    </View>
                    <View style={styles.reviewRatingContainer}>
                      {renderStars(review.rating_star)}
                      <Text style={[styles.reviewRatingText, darkMode && styles.darkReviewRatingText]}>{review.rating_star}/5</Text>
                    </View>
                  </View>

                  {review.rating_description && (
                    <View style={styles.reviewContent}>
                      <Text style={[styles.reviewDescription, darkMode && styles.darkReviewDescription]}>{review.rating_description}</Text>
                    </View>
                  )}

                  <View style={styles.reviewFooter}>
                    <View style={styles.reviewMetadata}>
                      <Text style={[styles.reviewMetadataText, darkMode && styles.darkReviewMetadataText]}>Transaction ID: {review.rating_uid}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Business Services Section - Only show if no reviews */}
          {Array.isArray(business.business_services) && business.business_services.length > 0 && allReviews.length === 0 && (
            <View style={[styles.card, darkMode && styles.darkCard]}>
              <View style={styles.servicesHeader}>
                <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>Products & Services</Text>
                {!isOwner && cartItems.length > 0 && (
                  <TouchableOpacity style={[styles.cartButton, darkMode && styles.darkCartButton]} onPress={handleViewCart}>
                    <Ionicons name='cart' size={24} color={darkMode ? "#fff" : "#9C45F7"} />
                    <Text style={[styles.cartCount, darkMode && styles.darkCartCount]}>{cartItems.length}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {business.business_services.map((service, idx) => (
                <ProductCard key={idx} service={service} showEditButton={isOwner} onPress={() => handleProductPress(service)} />
              ))}
            </View>
          )}

          {/* Shopping Cart Button - Only show if there are reviews */}
          {!isOwner && allReviews.length > 0 && (
            <View style={[styles.card, darkMode && styles.darkCard]}>
              <TouchableOpacity
                style={[styles.shoppingCartButton, darkMode && styles.darkShoppingCartButton]}
                onPress={() =>
                  navigation.navigate("ReviewDetail", {
                    business_uid: business_uid,
                    business_name: business.business_name,
                    reviewer_profile_id: "Charity",
                  })
                }
              >
                <Ionicons name='cart' size={24} color={darkMode ? "#fff" : "#9C45F7"} />
                <Text style={[styles.shoppingCartButtonText, darkMode && styles.darkShoppingCartButtonText]}>Shopping Cart</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <BottomNavBar navigation={navigation} />

        <Modal animationType='slide' transparent={true} visible={quantityModalVisible} onRequestClose={() => setQuantityModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Quantity</Text>
              <Text style={styles.serviceName}>{selectedService?.bs_service_name}</Text>

              <View style={styles.quantityContainer}>
                <TouchableOpacity style={styles.quantityButton} onPress={() => setQuantity((prev) => Math.max(1, prev - 1))}>
                  <Ionicons name='remove' size={24} color='#9C45F7' />
                </TouchableOpacity>

                <Text style={styles.quantityText}>{quantity}</Text>

                <TouchableOpacity style={styles.quantityButton} onPress={() => setQuantity((prev) => prev + 1)}>
                  <Ionicons name='add' size={24} color='#9C45F7' />
                </TouchableOpacity>
              </View>

              <Text style={styles.totalPrice}>Total: ${selectedService ? (parseFloat(selectedService.bs_cost) * quantity).toFixed(2) : "0.00"}</Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setQuantityModalVisible(false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={handleQuantityConfirm}>
                  <Text style={styles.confirmButtonText}>Add to Cart</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 0,
    ...(Platform.OS === "web" && {
      position: "relative",
      zIndex: 1, // Lower z-index so dropdown can appear above
      width: "100%",
    }),
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
    ...(Platform.OS === "web" && {
      width: "100%",
    }),
  },
  scrollContainer: {
    flex: 1,
    ...(Platform.OS === "web" && {
      width: "100%",
    }),
  },
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  content: {
    padding: 20,
    paddingBottom: 100,
    ...(Platform.OS === "web" && {
      width: "100%",
      maxWidth: "100%",
    }),
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  editButtonContainer: {
    alignItems: "flex-end",
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    marginBottom: 15,
    borderRadius: 12,
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0px 2px 4px 0px rgba(0, 0, 0, 0.05)",
        }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }),
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  infoRow: {
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    color: "#333",
  },
  link: {
    fontSize: 16,
    color: "#1a73e8",
    textDecorationLine: "underline",
  },
  bioText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 22,
  },
  socialLink: {
    fontSize: 16,
    color: "#1a73e8",
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 5,
  },
  tag: {
    backgroundColor: "#E8F4FD",
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: "#1a73e8",
    fontSize: 14,
    fontWeight: "500",
  },
  noDataText: {
    fontSize: 16,
    color: "#777",
    textAlign: "center",
    fontStyle: "italic",
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 16,
    color: "red",
  },
  imageScroll: {
    marginVertical: 10,
  },
  imageContainer: {
    width: 120,
    height: 120,
    marginRight: 10,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },
  editButton: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  editIcon: {
    width: 20,
    height: 20,
  },
  servicesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  cartButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    padding: 8,
    borderRadius: 20,
  },
  cartCount: {
    marginLeft: 5,
    color: "#9C45F7",
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    width: "80%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  serviceName: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  quantityButton: {
    backgroundColor: "#F5F5F5",
    padding: 10,
    borderRadius: 10,
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityText: {
    fontSize: 20,
    fontWeight: "bold",
    marginHorizontal: 20,
    color: "#333",
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#9C45F7",
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: "#F5F5F5",
  },
  confirmButton: {
    backgroundColor: "#9C45F7",
  },
  cancelButtonText: {
    color: "#666",
    textAlign: "center",
    fontWeight: "bold",
  },
  confirmButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },
  reviewButton: {
    backgroundColor: "#9C45F7",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 20,
  },
  reviewButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  userReviewContainer: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 16,
    marginVertical: 20,
  },
  userReviewTitle: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 10,
  },
  userReviewRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  userReviewLabel: {
    fontWeight: "bold",
    marginRight: 8,
  },
  userReviewRatingContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  userReviewValue: {
    flex: 1,
  },
  editReviewButton: {
    backgroundColor: "#FFA500",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  editReviewButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  reviewCard: {
    backgroundColor: "#fff",
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0px 2px 4px 0px rgba(0, 0, 0, 0.05)",
        }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }),
  },
  reviewCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  reviewProfileInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewProfileAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  reviewProfileInitial: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  reviewProfileDetails: {
    marginLeft: 10,
  },
  reviewProfileName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  reviewDate: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  reviewRatingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
  },
  reviewRatingText: {
    marginLeft: 5,
    fontWeight: "bold",
  },
  reviewContent: {
    marginBottom: 10,
  },
  reviewDescription: {
    fontSize: 16,
    color: "#333",
  },
  reviewFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewMetadata: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewMetadataText: {
    fontSize: 14,
    color: "#666",
  },
  starCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  starCircleFilled: {
    backgroundColor: "#FFCD3C",
    borderColor: "#FFCD3C",
  },
  shoppingCartButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    padding: 8,
    borderRadius: 20,
  },
  shoppingCartButtonText: {
    marginLeft: 5,
    color: "#9C45F7",
    fontWeight: "bold",
  },

  // Dark mode styles
  darkPageContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkSafeArea: {
    backgroundColor: "#1a1a1a",
  },
  darkScrollContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkCard: {
    backgroundColor: "#2d2d2d",
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0px 2px 4px 0px rgba(0, 0, 0, 0.2)",
        }
      : {
          shadowColor: "#000",
          shadowOpacity: 0.2,
        }),
  },
  darkCardTitle: {
    color: "#ffffff",
  },
  darkBioText: {
    color: "#cccccc",
  },
  darkLabel: {
    color: "#cccccc",
  },
  darkValue: {
    color: "#ffffff",
  },
  darkLink: {
    color: "#64b5f6",
  },
  darkSocialLink: {
    color: "#64b5f6",
  },
  darkTag: {
    backgroundColor: "#404040",
  },
  darkTagText: {
    color: "#64b5f6",
  },
  darkNoDataText: {
    color: "#cccccc",
  },
  darkEditIcon: {
    // tintColor moved to Image prop
  },
  darkCartButton: {
    backgroundColor: "#404040",
  },
  darkCartCount: {
    color: "#ffffff",
  },
  darkShoppingCartButton: {
    backgroundColor: "#404040",
  },
  darkShoppingCartButtonText: {
    color: "#ffffff",
  },
  darkUserReviewContainer: {
    backgroundColor: "#404040",
  },
  darkUserReviewTitle: {
    color: "#ffffff",
  },
  darkUserReviewLabel: {
    color: "#cccccc",
  },
  darkUserReviewValue: {
    color: "#ffffff",
  },
  darkEditReviewButton: {
    backgroundColor: "#FF8C00",
  },
  darkReviewButton: {
    backgroundColor: "#00C721",
  },
  darkReviewCard: {
    backgroundColor: "#2d2d2d",
    shadowColor: "#000",
    shadowOpacity: 0.2,
  },
  darkReviewProfileAvatar: {
    backgroundColor: "#404040",
  },
  darkReviewProfileInitial: {
    color: "#ffffff",
  },
  darkReviewProfileName: {
    color: "#ffffff",
  },
  darkReviewDate: {
    color: "#cccccc",
  },
  darkReviewRatingText: {
    color: "#ffffff",
  },
  darkReviewDescription: {
    color: "#ffffff",
  },
  darkReviewMetadataText: {
    color: "#cccccc",
  },
  businessUserCard: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  businessUserRole: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    fontStyle: "italic",
  },
  darkBusinessUserCard: {
    borderBottomColor: "#404040",
  },
  darkBusinessUserRole: {
    color: "#cccccc",
  },
});