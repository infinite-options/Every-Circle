// BusinessProfileScreen.js
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Image, TouchableOpacity, Alert, Modal, Platform, Linking, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MiniCard from "../components/MiniCard";
import ProductCard from "../components/ProductCard";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { BUSINESS_INFO_ENDPOINT, USER_PROFILE_INFO_ENDPOINT, CATEGORY_LIST_ENDPOINT, RATINGS_ENDPOINT } from "../apiConfig";
import { useDarkMode } from "../contexts/DarkModeContext";
import { sanitizeText, isSafeForConditional } from "../utils/textSanitizer";
import { parsePrice } from "../utils/priceUtils";
import { getHeaderColors } from "../config/headerColors";
import FeedbackPopup from "../components/FeedbackPopup";

const BusinessProfileApi = BUSINESS_INFO_ENDPOINT;
const ProfileScreenAPI = USER_PROFILE_INFO_ENDPOINT;

export default function BusinessProfileScreen({ route, navigation }) {
  const { darkMode } = useDarkMode();
  const { business_uid, returnTo, searchState } = route.params || {};
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
  const [reviewerProfiles, setReviewerProfiles] = useState({});
  const [viewportWidth, setViewportWidth] = useState(null);

  const [showAbout, setShowAbout] = useState(true);
  const [showContact, setShowContact] = useState(true);
  const [showSocialLinks, setShowSocialLinks] = useState(true);
  const [showEditors, setShowEditors] = useState(true);
  const [showReviews, setShowReviews] = useState(true);
  const [showServices, setShowServices] = useState(true);
  const [showTagline, setShowTagline] = useState(true);

  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);
  const businessFeedbackInstructions = "Instructions for Business Profile";
  const businessFeedbackQuestions = ["Business Profile - Question 1?", "Business Profile - Question 2?", "Business Profile - Question 3?"];

  const [replyingTo, setReplyingTo] = useState(null); // rating_uid currently being replied to
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  const [selectedBountyRecipient, setSelectedBountyRecipient] = useState(null);

  // Handle viewport resize on web (for DevTools opening/closing)
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const updateViewportWidth = () => {
        setViewportWidth(window.innerWidth);
      };
      updateViewportWidth();
      window.addEventListener("resize", updateViewportWidth);
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
          if (cartData.bounty_recipient) {
            setSelectedBountyRecipient(cartData.bounty_recipient);
          }
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
      return;
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
  // Update the process reviews useEffect:
  useEffect(() => {
    if (currentUserProfileId && business && business.ratings) {
      let userReviewFromAPI = null;
      let otherReviews = [];

      business.ratings.forEach((rating) => {
        if (rating.rating_profile_id === currentUserProfileId) {
          userReviewFromAPI = rating;
        } else {
          otherReviews.push(rating);
        }
      });

      // Sort by circle_num_nodes: lowest first, null at the end
      otherReviews.sort((a, b) => {
        if (a.circle_num_nodes === null && b.circle_num_nodes === null) return 0;
        if (a.circle_num_nodes === null) return 1;
        if (b.circle_num_nodes === null) return -1;
        return a.circle_num_nodes - b.circle_num_nodes;
      });

      setUserReview(userReviewFromAPI);
      setAllReviews(otherReviews);
    }
  }, [currentUserProfileId, business]);

  const fetchBusinessInfo = async () => {
    try {
      setLoading(true);
      // Read viewer UID directly so it's available for the ratings call
      const viewerUid = (await AsyncStorage.getItem("profile_uid")) || "";
      const endpoint = `${BusinessProfileApi}/${business_uid}`;
      console.log("BusinessProfileScreen GET endpoint:", endpoint);
      const response = await fetch(endpoint);
      const result = await response.json();

      if (!result || !result.business) {
        throw new Error("Business not found or malformed response");
      }

      const rawBusiness = result.business;

      // Handle social_links
      let socialLinksData = {};
      const socialLinksSource = result.social_links || rawBusiness.social_links;
      if (socialLinksSource) {
        if (Array.isArray(socialLinksSource)) {
          socialLinksSource.forEach((link) => {
            const platformName = link.social_link_name || link.bl_social_link_id;
            const platformUrl = link.business_link_url || link.bl_url;
            if (platformName && platformUrl && platformUrl.trim() !== "") {
              socialLinksData[platformName] = platformUrl;
            }
          });
        } else if (typeof socialLinksSource === "string") {
          try {
            socialLinksData = JSON.parse(socialLinksSource);
          } catch (e) {
            console.log("Failed to parse social_links as JSON");
            socialLinksData = {};
          }
        }
      }

      // Handle business_google_photos
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

      // Handle business_images_url - other/gallery images only (profile image comes from business_profile_img)
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
        uploadedImages = uploadedImages
          .map((img) => {
            if (img && typeof img === "string") {
              if (img.startsWith("http://") || img.startsWith("https://")) {
                return img;
              }
              return `https://s3-us-west-1.amazonaws.com/every-circle/business_personal/${rawBusiness.business_uid}/${img}`;
            }
            return null;
          })
          .filter(Boolean);
        businessImages = [...uploadedImages, ...businessImages];
      }

      // Profile image URL (backend business_profile_img) - separate from gallery; used for header and MiniCard
      const businessProfileImgUrl = rawBusiness.business_profile_img && String(rawBusiness.business_profile_img).trim() !== "" ? String(rawBusiness.business_profile_img).trim() : null;

      // Filter out problematic URLs
      businessImages = businessImages.filter((uri) => {
        if (!uri || typeof uri !== "string" || uri.trim() === "" || uri === "null" || uri === "undefined") {
          return false;
        }
        if (uri.includes("maps.googleapis.com/maps/api/place/js/PhotoService") || uri.includes("PhotoService.GetPhoto") || uri.includes("callback=none")) {
          return false;
        }
        const isValidImageUrl = uri.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i) || uri.startsWith("http://") || uri.startsWith("https://");
        return isValidImageUrl;
      });

      // Handle custom tags
      let customTags = [];
      if (result.tags && Array.isArray(result.tags)) {
        customTags = result.tags;
      } else if (rawBusiness.custom_tags) {
        if (typeof rawBusiness.custom_tags === "string") {
          try {
            customTags = JSON.parse(rawBusiness.custom_tags);
          } catch (e) {
            customTags = [];
          }
        } else if (Array.isArray(rawBusiness.custom_tags)) {
          customTags = rawBusiness.custom_tags;
        }
      }

      // Fetch category name if business_category_id is present
      let categoryName = rawBusiness.business_category || null;
      if (rawBusiness.business_category_id && !categoryName) {
        try {
          const categoryResponse = await fetch(CATEGORY_LIST_ENDPOINT);
          const categoryResult = await categoryResponse.json();
          if (categoryResult && categoryResult.result) {
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

      const businessWithRatings = {
        ...rawBusiness,
        business_user_id: rawBusiness.business_user_id || "",
        business_email_id: rawBusiness.business_email_id || "",
        business_phone_number: rawBusiness.business_phone_number || "",
        business_location: rawBusiness.business_location || "",
        business_address_line_1: rawBusiness.business_address_line_1 || "",
        tagline: rawBusiness.business_tag_line || rawBusiness.tagline || "",
        business_short_bio: rawBusiness.business_short_bio || rawBusiness.short_bio || "",
        business_role: rawBusiness.business_role || rawBusiness.role || rawBusiness.bu_role || "",
        business_ein_number: rawBusiness.business_ein_number || "",
        ein_number: rawBusiness.business_ein_number || "",
        facebook: socialLinksData.facebook || "",
        instagram: socialLinksData.instagram || "",
        linkedin: socialLinksData.linkedin || "",
        youtube: socialLinksData.youtube || "",
        images: businessImages,
        customTags: customTags,
        business_category: categoryName || rawBusiness.business_category || null,
        business_category_id: rawBusiness.business_category_id || null,
        ratings: result.ratings,
        emailIsPublic: rawBusiness.business_email_id_is_public === "1" || rawBusiness.business_email_id_is_public === 1 || rawBusiness.email_is_public === "1" || rawBusiness.email_is_public === 1,
        phoneIsPublic:
          rawBusiness.business_phone_number_is_public === "1" || rawBusiness.business_phone_number_is_public === 1 || rawBusiness.phone_is_public === "1" || rawBusiness.phone_is_public === 1,
        taglineIsPublic:
          rawBusiness.business_tag_line_is_public === "1" || rawBusiness.business_tag_line_is_public === 1 || rawBusiness.tagline_is_public === "1" || rawBusiness.tagline_is_public === 1,
        shortBioIsPublic:
          rawBusiness.business_short_bio_is_public === "1" || rawBusiness.business_short_bio_is_public === 1 || rawBusiness.short_bio_is_public === "1" || rawBusiness.short_bio_is_public === 1,
        locationIsPublic: rawBusiness.business_location_is_public === "1" || rawBusiness.business_location_is_public === 1,
        imageIsPublic:
          rawBusiness.business_profile_img_is_public === "1" ||
          rawBusiness.business_profile_img_is_public === 1 ||
          rawBusiness.business_image_is_public === "1" ||
          rawBusiness.business_image_is_public === 1 ||
          rawBusiness.image_is_public === "1" ||
          rawBusiness.image_is_public === 1,
        business_profile_img: businessProfileImgUrl,
        business_profile_img_is_public: rawBusiness.business_profile_img_is_public === "1" || rawBusiness.business_profile_img_is_public === 1,
        business_services: (() => {
          if (rawBusiness.business_services) {
            if (typeof rawBusiness.business_services === "string") {
              try {
                return JSON.parse(rawBusiness.business_services);
              } catch (e) {
                return [];
              }
            } else if (Array.isArray(rawBusiness.business_services)) {
              return rawBusiness.business_services;
            }
          }
          if (Array.isArray(result.services)) {
            return result.services;
          }
          return [];
        })(),
      };

      setBusiness(businessWithRatings);

      // Fetch is_verified flags from Ratings endpoint
      try {
        // const ratingsRes = await fetch(`${RATINGS_ENDPOINT}/${business_uid}`);
        const ratingsRes = await fetch(`${RATINGS_ENDPOINT}/${business_uid}?viewer_uid=${viewerUid}`);
        const ratingsData = await ratingsRes.json();
        if (ratingsData?.result) {
          const ratingsMap = {};
          ratingsData.result.forEach((r) => {
            ratingsMap[r.rating_uid] = {
              is_verified: r.is_verified,
              circle_num_nodes: r.circle_num_nodes ?? null,
            };
          });
          setBusiness((prev) => ({
            ...prev,
            ratings: (prev.ratings || []).map((r) => ({
              ...r,
              is_verified: ratingsMap[r.rating_uid]?.is_verified || false,
              circle_num_nodes: ratingsMap[r.rating_uid]?.circle_num_nodes ?? null,
            })),
          }));
        }
      } catch (e) {
        console.log("Could not fetch verified ratings:", e);
      }

      if (result.business_users && Array.isArray(result.business_users)) {
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
        if (!business) {
          setIsOwner(false);
          return;
        }
        const userUid = await AsyncStorage.getItem("user_uid");
        const profileUid = await AsyncStorage.getItem("profile_uid");
        if (!userUid && !profileUid) {
          setIsOwner(false);
          return;
        }
        // Check business_users array: API may use user_uid, bu_user_id, business_user_id, or profile identifiers
        const matchInBusinessUsers = businessUsers.some(
          (bu) =>
            (userUid && (bu.user_uid === userUid || bu.bu_user_id === userUid || bu.business_user_id === userUid)) ||
            (profileUid &&
              (bu.profile_uid === profileUid || bu.profile_personal_uid === profileUid || String(bu.profile_uid || bu.profile_personal_uid || "").trim() === String(profileUid || "").trim())),
        );
        if (matchInBusinessUsers) {
          setIsOwner(true);
          return;
        }
        // Fallback: profile screen shows "my businesses" from profile API business_info. If this business
        // appears there, treat as owner (handles APIs that link business→user by profile, not user_uid).
        if (profileUid) {
          const response = await fetch(`${ProfileScreenAPI}/${profileUid}`);
          const userData = await response.json();
          if (userData && userData.business_info) {
            const businessInfo = typeof userData.business_info === "string" ? JSON.parse(userData.business_info) : userData.business_info;
            const isInProfileBusinesses =
              Array.isArray(businessInfo) && businessInfo.some((biz) => (biz.business_uid || biz.profile_business_uid || biz.profile_business_business_id) === business_uid);
            setIsOwner(isInProfileBusinesses);
            return;
          }
        }
        setIsOwner(false);
      } catch (error) {
        console.error("Error checking business ownership:", error);
        setIsOwner(false);
      }
    };

    if (business) {
      checkBusinessOwnership();
    }
  }, [business_uid, business, businessUsers]);

  // Use useFocusEffect like ProfileScreen
  useFocusEffect(
    React.useCallback(() => {
      console.log("BusinessProfileScreen - useFocusEffect triggered, reloading business data");
      fetchBusinessInfo();
    }, [business_uid]),
  );

  const handleProductPress = (service) => {
    setSelectedService(service);
    setQuantity(1);
    // setSelectedBountyRecipient(null);
    setQuantityModalVisible(true);
  };

  const handleQuantityConfirm = async () => {
    try {
      const serviceWithQuantity = {
        ...selectedService,
        quantity: quantity,
        totalPrice: (parsePrice(selectedService.bs_cost) * quantity).toFixed(2),
        bounty_recommender_profile_id: selectedBountyRecipient?.rating_profile_id || null,
        business_uid: business_uid,
      };

      const existingItemIndex = cartItems.findIndex((item) => item.bs_uid === selectedService.bs_uid);

      let newCartItems;
      if (existingItemIndex !== -1) {
        newCartItems = [...cartItems];
        const existingItem = newCartItems[existingItemIndex];
        const newQuantity = (existingItem.quantity || 1) + quantity;
        newCartItems[existingItemIndex] = {
          ...existingItem,
          quantity: newQuantity,
          totalPrice: (parsePrice(existingItem.bs_cost) * newQuantity).toFixed(2),
        };
      } else {
        newCartItems = [...cartItems, serviceWithQuantity];
      }

      // Always update ALL items from this business to use the latest selected reviewer
      if (selectedBountyRecipient?.rating_profile_id) {
        newCartItems = newCartItems.map((item) => {
          // if (item.business_uid === business_uid) {
          if (item.business_uid === business_uid || item.bs_business_id === business_uid) {
            console.log("Updating bounty recipient for item:", item.bs_uid, "to:", selectedBountyRecipient.rating_profile_id);
            return { ...item, bounty_recommender_profile_id: selectedBountyRecipient.rating_profile_id };
          }
          return item;
        });
      }

      console.log(
        "Final cart items recommenders:",
        newCartItems.map((i) => ({ bs_uid: i.bs_uid, recommender: i.bounty_recommender_profile_id })),
      );

      setCartItems(newCartItems);

      await AsyncStorage.setItem(
        `cart_${business_uid}`,
        JSON.stringify({
          items: newCartItems,
          bounty_recipient: selectedBountyRecipient || null,
        }),
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
      const savedCart = await AsyncStorage.getItem(`cart_${business_uid}`);
      const savedData = savedCart ? JSON.parse(savedCart) : {};
      await AsyncStorage.setItem(
        `cart_${business_uid}`,
        JSON.stringify({
          items: newCartItems,
          bounty_recipient: newCartItems.length === 0 ? null : savedData.bounty_recipient || null,
        }),
      );
      if (newCartItems.length === 0) setSelectedBountyRecipient(null);
    } catch (error) {
      console.error("Error removing item from cart:", error);
      Alert.alert("Error", "Failed to remove item from cart");
    }
  };

  const handleSubmitReply = async (rating_uid) => {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const formData = new FormData();
      formData.append("rating_uid", rating_uid);
      formData.append("ratings_response", replyText.trim());
      formData.append("responding_profile_uid", currentUserProfileId); // <-- add this

      const response = await fetch(RATINGS_ENDPOINT, {
        method: "PUT",
        body: formData,
      });

      if (response.ok) {
        setBusiness((prev) => ({
          ...prev,
          ratings: (prev.ratings || []).map((r) => (r.rating_uid === rating_uid ? { ...r, ratings_response: replyText.trim() } : r)),
        }));
        setAllReviews((prev) => prev.map((r) => (r.rating_uid === rating_uid ? { ...r, ratings_response: replyText.trim() } : r)));
        setReplyingTo(null);
        setReplyText("");
      } else {
        Alert.alert("Error", "Failed to save reply. Please try again.");
      }
    } catch (e) {
      Alert.alert("Error", "Network error. Please check your connection.");
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleViewCart = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cartKeys = keys.filter((key) => key.startsWith("cart_"));
      const allCartData = await AsyncStorage.multiGet(cartKeys);

      let allItems = [];
      allCartData.forEach(([key, value]) => {
        if (value) {
          const parsed = JSON.parse(value);
          const items = parsed.items || [];
          allItems = [...allItems, ...items];
        }
      });

      navigation.navigate("ShoppingCart", {
        cartItems: allItems,
        onRemoveItem: handleRemoveItem,
        businessName: "My Cart",
        business_uid: business_uid,
        recommender_profile_id: currentUserProfileId,
      });
    } catch (error) {
      console.error("Error loading all cart items:", error);
      navigation.navigate("ShoppingCart", {
        cartItems,
        onRemoveItem: handleRemoveItem,
        businessName: business.business_name,
        business_uid: business_uid,
        recommender_profile_id: currentUserProfileId,
      });
    }
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

  const renderField = (label, value, isPublic) => {
    if (isPublic && value && value.trim() !== "") {
      return (
        <View style={styles.fieldContainer}>
          <Text style={[styles.label, darkMode && styles.darkLabel]}>{label}:</Text>
          <Text style={[styles.inputText, darkMode && styles.darkInputText]}>{sanitizeText(value)}</Text>
        </View>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <View style={[styles.pageContainer, darkMode && styles.darkPageContainer, { flex: 1, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size='large' color={darkMode ? "#ffffff" : "#007BFF"} style={{ marginTop: 50 }} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={[styles.pageContainer, darkMode && styles.darkPageContainer, { flex: 1, justifyContent: "center", alignItems: "center" }]}>
        <Text style={[styles.errorText, darkMode && styles.darkErrorText]}>Failed to load business data.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.pageContainer, darkMode && styles.darkPageContainer]} key={Platform.OS === "web" ? `viewport-${viewportWidth}` : undefined}>
      <AppHeader
        title='BUSINESS PROFILE'
        {...getHeaderColors("businessProfile")}
        onBackPress={() => {
          if (returnTo === "Search" && searchState) {
            navigation.navigate("Search", { restoreState: true, searchState });
          } else {
            navigation.goBack();
          }
        }}
        onTitlePress={() => setShowFeedbackPopup(true)}
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
          {/* Business Header Card - profile image always shown here; Hide/Display status shown */}
          <View style={[styles.cardContainer, darkMode && styles.darkCardContainer]}>
            <View style={styles.profileHeaderContainer}>
              <Image
                source={
                  business.business_profile_img && String(business.business_profile_img).trim() !== ""
                    ? { uri: String(business.business_profile_img) }
                    : business.images && business.images.length > 0 && business.images[0] !== "" && String(business.images[0]).trim() !== ""
                      ? { uri: String(business.images[0]) }
                      : require("../assets/profile.png")
                }
                style={styles.profileImage}
                onError={(error) => {
                  console.log("BusinessProfileScreen image failed to load:", error.nativeEvent.error);
                  console.log("Problematic business image URI:", business.business_profile_img || (business.images && business.images[0]));
                }}
                defaultSource={require("../assets/profile.png")}
              />
              <Text style={[styles.nameText, darkMode && styles.darkNameText]}>{sanitizeText(business.business_name)}</Text>
              <Text style={[styles.profileId, darkMode && styles.darkProfileId]}>Business ID: {business_uid}</Text>
              {/* Hide/Display status always shown on Business Profile */}
              <Text style={[styles.profileId, darkMode && styles.darkProfileId, { marginTop: 4, fontSize: 12 }]}>Profile image: {business.imageIsPublic ? "Display" : "Hide"}</Text>
            </View>
          </View>

          {/* MiniCard - uses business_profile_img; image only shown when set and Display */}
          {(() => {
            const miniCardData = {
              business_name: sanitizeText(business.business_name),
              tagline: sanitizeText(business.tagline),
              business_location: sanitizeText(business.business_location || ""),
              business_address_line_1: sanitizeText(business.business_address_line_1),
              business_city: sanitizeText(business.business_city),
              business_state: sanitizeText(business.business_state),
              business_zip_code: sanitizeText(business.business_zip_code),
              business_phone_number: sanitizeText(business.business_phone_number),
              business_email: sanitizeText(business.business_email_id),
              business_website: sanitizeText(business.business_website),
              first_image: business.business_profile_img || (business.images && business.images.length > 0 ? business.images[0] : null),
              business_profile_img: business.business_profile_img || null,
              imageIsPublic: business.imageIsPublic,
              phoneIsPublic: business.phoneIsPublic,
              emailIsPublic: business.emailIsPublic,
              taglineIsPublic: business.taglineIsPublic,
              locationIsPublic: business.locationIsPublic,
            };
            return <MiniCard business={miniCardData} />;
          })()}

          {/* About Section */}
          {business.shortBioIsPublic && isSafeForConditional(business.business_short_bio) && (
            <View style={styles.fieldContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowAbout(!showAbout)}>
                <Text style={styles.sectionHeaderText}>ABOUT</Text>
                <Ionicons name={showAbout ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showAbout && (
                <View style={[styles.inputContainer, darkMode && styles.darkInputContainer]}>
                  {business.business_short_bio && business.business_short_bio.trim() !== "" ? (
                    <Text style={[styles.inputText, darkMode && styles.darkInputText]}>{sanitizeText(business.business_short_bio)}</Text>
                  ) : (
                    <Text style={[styles.inputText, darkMode && styles.darkInputText, { fontStyle: "italic", color: darkMode ? "#999" : "#666" }]}>No description added yet</Text>
                  )}
                  {isSafeForConditional(business.business_category) && (
                    <Text style={[styles.inputText, darkMode && styles.darkInputText, { marginTop: 8 }]}>Business Category: {sanitizeText(business.business_category)}</Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Tagline Section */}
          {business.taglineIsPublic && isSafeForConditional(business.tagline) && (
            <View style={styles.fieldContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowTagline(!showTagline)}>
                <Text style={styles.sectionHeaderText}>TAGLINE</Text>
                <Ionicons name={showTagline ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showTagline && business.tagline && business.tagline.trim() !== "" && (
                <View style={[styles.inputContainer, darkMode && styles.darkInputContainer]}>
                  <Text style={[styles.inputText, darkMode && styles.darkInputText]}>{sanitizeText(business.tagline)}</Text>
                </View>
              )}
            </View>
          )}

          {/* Contact Information */}
          <View style={styles.fieldContainer}>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowContact(!showContact)}>
              <Text style={styles.sectionHeaderText}>CONTACT INFORMATION</Text>
              <Ionicons name={showContact ? "chevron-up" : "chevron-down"} size={20} color='#000' />
            </TouchableOpacity>
            {showContact && (
              <View style={[styles.inputContainer, darkMode && styles.darkInputContainer]}>
                {renderField(
                  "Location",
                  (() => {
                    const parts = [
                      sanitizeText(business.business_location),
                      sanitizeText(business.business_address_line_1),
                      sanitizeText(business.business_city),
                      sanitizeText(business.business_state),
                      sanitizeText(business.business_zip_code),
                      sanitizeText(business.business_country),
                    ].filter((part) => part && part !== ".");
                    return parts.length > 0 ? parts.join(", ") : "N/A";
                  })(),
                  business.business_location_is_public === "1" || business.business_location_is_public === 1 || business.locationIsPublic === true,
                )}
                {business.phoneIsPublic && isSafeForConditional(business.business_phone_number) && (
                  <Text style={[styles.inputText, darkMode && styles.darkInputText]}>Phone: {sanitizeText(business.business_phone_number)}</Text>
                )}
                {business.emailIsPublic && isSafeForConditional(business.business_email_id) && (
                  <Text style={[styles.inputText, darkMode && styles.darkInputText]}>Email: {sanitizeText(business.business_email_id)}</Text>
                )}
                {isSafeForConditional(business.business_website) && <Text style={[styles.inputText, darkMode && styles.darkInputText]}>Website: 🌐 {sanitizeText(business.business_website)}</Text>}
                {isSafeForConditional(business.business_role || business.role || business.bu_role) && (
                  <Text style={[styles.inputText, darkMode && styles.darkInputText]}>Business Role: {sanitizeText(business.business_role || business.role || business.bu_role)}</Text>
                )}
                {/* {isSafeForConditional(business.ein_number) && (
                  <Text style={[styles.inputText, darkMode && styles.darkInputText]}>EIN Number: {sanitizeText(business.ein_number)}</Text>
                )} */}
              </View>
            )}
          </View>

          {/* Business Hours */}
          {isSafeForConditional(business.business_hours) && (
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, darkMode && styles.darkLabel]}>Business Hours:</Text>
              <View style={[styles.inputContainer, darkMode && styles.darkInputContainer]}>
                <Text style={[styles.inputText, darkMode && styles.darkInputText]}>{sanitizeText(business.business_hours)}</Text>
              </View>
            </View>
          )}

          {/* Rating and Price Level */}
          {(business.google_rating || business.price_level) && (
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, darkMode && styles.darkLabel]}>Rating & Pricing:</Text>
              <View style={[styles.inputContainer, darkMode && styles.darkInputContainer]}>
                {isSafeForConditional(business.google_rating) && <Text style={[styles.inputText, darkMode && styles.darkInputText]}>Google Rating: ⭐ {sanitizeText(business.google_rating)}</Text>}
                {business.price_level && <Text style={[styles.inputText, darkMode && styles.darkInputText]}>Price Level: {"$".repeat(parseInt(business.price_level) || 1)}</Text>}
              </View>
            </View>
          )}

          {/* Custom Tags - Only visible to owners/editors */}
          {isOwner && business.customTags && business.customTags.length > 0 && (
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, darkMode && styles.darkLabel]}>Tags:</Text>
              <View style={styles.tagsContainer}>
                {business.customTags
                  .map((tag) => sanitizeText(tag))
                  .filter((tag) => tag && tag !== "." && tag.trim() !== "" && !tag.match(/^[\s.,;:!?\-_=+]*$/))
                  .map((tag, index) => {
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

          {/* Social Links */}
          {(() => {
            const hasSocialLinks = business.facebook || business.instagram || business.linkedin || business.youtube;
            if (!hasSocialLinks) return null;
            return (
              <View style={styles.fieldContainer}>
                <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowSocialLinks(!showSocialLinks)}>
                  <Text style={styles.sectionHeaderText}>SOCIAL LINKS</Text>
                  <Ionicons name={showSocialLinks ? "chevron-up" : "chevron-down"} size={20} color='#000' />
                </TouchableOpacity>
                {showSocialLinks && (
                  <View style={[styles.inputContainer, darkMode && styles.darkInputContainer]}>
                    {isSafeForConditional(business.facebook) && (
                      <TouchableOpacity onPress={() => Linking.openURL(business.facebook.startsWith("http") ? business.facebook : `https://${business.facebook}`)}>
                        <Text style={[styles.inputText, styles.linkText]}>📘 Facebook: {sanitizeText(business.facebook)}</Text>
                      </TouchableOpacity>
                    )}
                    {isSafeForConditional(business.instagram) && (
                      <TouchableOpacity onPress={() => Linking.openURL(business.instagram.startsWith("http") ? business.instagram : `https://${business.instagram}`)}>
                        <Text style={[styles.inputText, styles.linkText]}>📸 Instagram: {sanitizeText(business.instagram)}</Text>
                      </TouchableOpacity>
                    )}
                    {isSafeForConditional(business.linkedin) && (
                      <TouchableOpacity onPress={() => Linking.openURL(business.linkedin.startsWith("http") ? business.linkedin : `https://${business.linkedin}`)}>
                        <Text style={[styles.inputText, styles.linkText]}>🔗 LinkedIn: {sanitizeText(business.linkedin)}</Text>
                      </TouchableOpacity>
                    )}
                    {isSafeForConditional(business.youtube) && (
                      <TouchableOpacity onPress={() => Linking.openURL(business.youtube.startsWith("http") ? business.youtube : `https://${business.youtube}`)}>
                        <Text style={[styles.inputText, styles.linkText]}>▶️ YouTube: {sanitizeText(business.youtube)}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })()}

          {/* Business Editors/Owners Section */}
          {(() => {
            const visibleBusinessUsers = businessUsers.filter(
              (u) => u.bu_individual_business_is_public === 1 || u.bu_individual_business_is_public === "1" || u.bu_individual_business_is_public === true,
            );
            if (!isOwner || visibleBusinessUsers.length === 0) return null;
            return (
              <View style={styles.fieldContainer}>
                <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowEditors(!showEditors)}>
                  <Text style={styles.sectionHeaderText}>BUSINESS EDITORS & OWNERS</Text>
                  <Ionicons name={showEditors ? "chevron-up" : "chevron-down"} size={20} color='#000' />
                </TouchableOpacity>
                {showEditors &&
                  visibleBusinessUsers.map((businessUser, index) => {
                    const role = sanitizeText(businessUser.business_role, "N/A");
                    const profileImageUrl =
                      businessUser.profile_photo && String(businessUser.profile_photo).trim() !== ""
                        ? String(businessUser.profile_photo).trim()
                        : businessUser.profile_personal_image && String(businessUser.profile_personal_image).trim() !== ""
                          ? String(businessUser.profile_personal_image).trim()
                          : "";
                    const imageIsPublic =
                      businessUser.profile_photo_is_public === 1 ||
                      businessUser.profile_photo_is_public === "1" ||
                      businessUser.profile_personal_image_is_public === 1 ||
                      businessUser.profile_personal_image_is_public === "1" ||
                      businessUser.image_is_public === 1 ||
                      businessUser.image_is_public === "1";
                    const userForMiniCard = {
                      firstName: businessUser.first_name || "",
                      lastName: businessUser.last_name || "",
                      email: businessUser.user_email || "",
                      profileImage: profileImageUrl,
                      imageIsPublic: !!imageIsPublic,
                      emailIsPublic:
                        businessUser.user_email_is_public === 1 ||
                        businessUser.user_email_is_public === "1" ||
                        businessUser.profile_personal_email_is_public === 1 ||
                        businessUser.profile_personal_email_is_public === "1" ||
                        businessUser.email_is_public === 1,
                      phoneIsPublic:
                        businessUser.phone_is_public === 1 ||
                        businessUser.phone_is_public === "1" ||
                        businessUser.profile_personal_phone_number_is_public === 1 ||
                        businessUser.profile_personal_phone_number_is_public === "1",
                      phoneNumber: businessUser.phone || businessUser.profile_personal_phone_number || businessUser.phone_number || "",
                      tagLine: businessUser.profile_personal_tag_line || businessUser.tag_line || businessUser.tagline || "",
                      tagLineIsPublic: businessUser.profile_personal_tag_line_is_public === 1 || businessUser.profile_personal_tag_line_is_public === "1" || false,
                      city: businessUser.city || businessUser.profile_personal_city || "",
                      state: businessUser.state || businessUser.profile_personal_state || "",
                      locationIsPublic:
                        businessUser.location_is_public === 1 ||
                        businessUser.location_is_public === "1" ||
                        businessUser.profile_personal_location_is_public === 1 ||
                        businessUser.profile_personal_location_is_public === "1" ||
                        false,
                    };
                    return (
                      <View key={businessUser.business_user_id || index} style={[styles.businessUserCard, darkMode && styles.darkBusinessUserCard]}>
                        <MiniCard user={userForMiniCard} />
                        <Text style={[styles.businessUserRole, darkMode && styles.darkBusinessUserRole]}>Role: {role && role !== "." && role.trim() !== "" ? role : "N/A"}</Text>
                      </View>
                    );
                  })}
              </View>
            );
          })()}

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
                  onPress={() => navigation.navigate("ReviewBusiness", { business_uid, business_name: business.business_name, reviewData: userReview, isEdit: true })}
                >
                  <Text style={styles.editReviewButtonText}>Edit Review</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.reviewButton, darkMode && styles.darkReviewButton]}
                onPress={() => navigation.navigate("ReviewBusiness", { business_uid, business_name: business.business_name })}
              >
                <Text style={styles.reviewButtonText}>Review Business</Text>
              </TouchableOpacity>
            ))}

          {/* All Reviews Section */}
          {allReviews.length > 0 && (
            <View style={styles.fieldContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowReviews(!showReviews)}>
                <Text style={styles.sectionHeaderText}>REVIEWS ({allReviews.length})</Text>
                <Ionicons name={showReviews ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>

              {showReviews &&
                allReviews.map((review, index) => (
                  <View key={review.rating_uid || index}>
                    {/* Review Card — tappable to go to ReviewDetail */}
                    <TouchableOpacity
                      style={[styles.reviewCard, darkMode && styles.darkReviewCard, index > 0 && { marginTop: 10 }]}
                      onPress={() =>
                        navigation.navigate("Profile", {
                          profile_uid: review.rating_profile_id,
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <View style={styles.reviewCardHeader}>
                        <View style={styles.reviewProfileInfo}>
                          {review.profile_personal_image ? (
                            <Image
                              source={{ uri: review.profile_personal_image }}
                              style={[styles.reviewProfileAvatar, darkMode && styles.darkReviewProfileAvatar]}
                              defaultSource={require("../assets/profile.png")}
                            />
                          ) : (
                            <View style={[styles.reviewProfileAvatar, darkMode && styles.darkReviewProfileAvatar]}>
                              <Text style={[styles.reviewProfileInitial, darkMode && styles.darkReviewProfileInitial]}>{(review.profile_personal_first_name?.charAt(0) || "U").toUpperCase()}</Text>
                            </View>
                          )}
                          <View style={styles.reviewProfileDetails}>
                            <Text style={[styles.reviewProfileName, darkMode && styles.darkReviewProfileName]}>
                              {[review.profile_personal_first_name, review.profile_personal_last_name].filter(Boolean).join(" ") || `User ${review.rating_profile_id}`}
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
                          {review.is_verified ? (
                            <Text style={[styles.reviewMetadataText, styles.verifiedText]}>Verified Purchase</Text>
                          ) : (
                            <Text style={[styles.reviewMetadataText, styles.unverifiedText]}>Purchase Not Verified</Text>
                          )}
                        </View>
                        <Text style={[styles.reviewMetadataText, darkMode && styles.darkReviewMetadataText, { fontSize: 18, color: "#888" }]}>
                          {review.circle_num_nodes !== null && review.circle_num_nodes !== undefined ? `Level ${review.circle_num_nodes} Connection` : "Not in your network"}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Owner Response — expanded section below the review card */}
                    {review.ratings_response ? (
                      // Existing response: always visible to everyone; owner can edit
                      <View style={[styles.ownerResponseSection, darkMode && styles.darkOwnerResponseSection]}>
                        <View style={styles.ownerResponseHeader}>
                          <Ionicons name='chatbubble-ellipses' size={14} color='#9C45F7' />
                          <Text style={styles.ownerResponseLabel}>Owner's Response</Text>
                        </View>
                        <Text style={[styles.ownerResponseText, darkMode && styles.darkOwnerResponseText]}>{review.ratings_response}</Text>
                        {isOwner && replyingTo !== review.rating_uid && (
                          <TouchableOpacity
                            style={styles.editReplyLink}
                            onPress={() => {
                              setReplyingTo(review.rating_uid);
                              setReplyText(review.ratings_response);
                            }}
                          >
                            <Ionicons name='pencil' size={12} color='#9C45F7' />
                            <Text style={styles.editReplyLinkText}>Edit Response</Text>
                          </TouchableOpacity>
                        )}
                        {isOwner && replyingTo === review.rating_uid && (
                          <View style={styles.replyInputSection}>
                            <TextInput
                              style={[styles.replyInput, darkMode && styles.darkReplyInput]}
                              value={replyText}
                              onChangeText={setReplyText}
                              placeholder='Edit your response...'
                              placeholderTextColor={darkMode ? "#888" : "#aaa"}
                              multiline
                              maxLength={1000}
                            />
                            <View style={styles.replyActions}>
                              <TouchableOpacity
                                style={styles.replyCancelButton}
                                onPress={() => {
                                  setReplyingTo(null);
                                  setReplyText("");
                                }}
                              >
                                <Text style={styles.replyCancelText}>Cancel</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={[styles.replySubmitButton, submittingReply && { opacity: 0.6 }]} onPress={() => handleSubmitReply(review.rating_uid)} disabled={submittingReply}>
                                <Text style={styles.replySubmitText}>{submittingReply ? "Saving..." : "Save Changes"}</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    ) : (
                      // No response yet — owner sees "Reply" button; non-owners see nothing
                      isOwner &&
                      (replyingTo === review.rating_uid ? (
                        <View style={[styles.ownerResponseSection, darkMode && styles.darkOwnerResponseSection]}>
                          <View style={styles.ownerResponseHeader}>
                            <Ionicons name='chatbubble-ellipses-outline' size={14} color='#9C45F7' />
                            <Text style={styles.ownerResponseLabel}>Write a Response</Text>
                          </View>
                          <TextInput
                            style={[styles.replyInput, darkMode && styles.darkReplyInput]}
                            value={replyText}
                            onChangeText={setReplyText}
                            placeholder='Write your response to this review...'
                            placeholderTextColor={darkMode ? "#888" : "#aaa"}
                            multiline
                            maxLength={1000}
                            autoFocus
                          />
                          <View style={styles.replyActions}>
                            <TouchableOpacity
                              style={styles.replyCancelButton}
                              onPress={() => {
                                setReplyingTo(null);
                                setReplyText("");
                              }}
                            >
                              <Text style={styles.replyCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.replySubmitButton, submittingReply && { opacity: 0.6 }]} onPress={() => handleSubmitReply(review.rating_uid)} disabled={submittingReply}>
                              <Text style={styles.replySubmitText}>{submittingReply ? "Posting..." : "Post Reply"}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.replyTriggerButton, darkMode && styles.darkReplyTriggerButton]}
                          onPress={() => {
                            setReplyingTo(review.rating_uid);
                            setReplyText("");
                          }}
                        >
                          <Ionicons name='chatbubble-outline' size={14} color='#9C45F7' />
                          <Text style={styles.replyTriggerText}>Reply to this review</Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                ))}
            </View>
          )}

          {/* Business Services Section */}
          {Array.isArray(business.business_services) && business.business_services.length > 0 && (
            <View style={styles.fieldContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowServices(!showServices)}>
                <Text style={styles.sectionHeaderText}>PRODUCTS & SERVICES</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  {/*checkout from the business*/}
                  {cartItems.length > 0 && (
                    <TouchableOpacity style={[styles.cartButton, darkMode && styles.darkCartButton]} onPress={handleViewCart}>
                      <Ionicons name='cart' size={24} color={darkMode ? "#fff" : "#9C45F7"} />
                      <Text style={[styles.cartCount, darkMode && styles.darkCartCount]}>{cartItems.length}</Text>
                    </TouchableOpacity>
                  )}
                  <Ionicons name={showServices ? "chevron-up" : "chevron-down"} size={20} color='#000' />
                </View>
              </TouchableOpacity>
              {showServices && business.business_services.map((service, idx) => <ProductCard key={idx} service={service} showEditButton={isOwner} onPress={() => handleProductPress(service)} />)}
            </View>
          )}

          {/* Shopping Cart Button - Only show if there are reviews */}
          {/* {!isOwner && allReviews.length > 0 && (
            <View style={styles.fieldContainer}>
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
          )} */}
        </ScrollView>

        <BottomNavBar navigation={navigation} />
      </SafeAreaView>

      <FeedbackPopup
        visible={showFeedbackPopup}
        onClose={() => setShowFeedbackPopup(false)}
        pageName='Business Profile'
        instructions={businessFeedbackInstructions}
        questions={businessFeedbackQuestions}
      />

      <Modal animationType='slide' transparent={true} visible={quantityModalVisible} onRequestClose={() => setQuantityModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "85%", width: "90%" }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: "center", width: "100%" }}>
              <Text style={styles.modalTitle}>Add to Cart</Text>
              <Text style={styles.serviceName}>{selectedService?.bs_service_name}</Text>

              {/* Quantity selector */}
              <View style={styles.quantityContainer}>
                <TouchableOpacity style={styles.quantityButton} onPress={() => setQuantity((prev) => Math.max(1, prev - 1))}>
                  <Ionicons name='remove' size={24} color='#9C45F7' />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{quantity}</Text>
                <TouchableOpacity style={styles.quantityButton} onPress={() => setQuantity((prev) => prev + 1)}>
                  <Ionicons name='add' size={24} color='#9C45F7' />
                </TouchableOpacity>
              </View>

              <Text style={styles.totalPrice}>Total: ${selectedService ? (parsePrice(selectedService.bs_cost) * quantity).toFixed(2) : "0.00"}</Text>

              {/* Bounty recipient picker — only show if there are verified reviews */}
              {allReviews.filter((r) => r.is_verified).length > 0 && (
                <View style={{ marginTop: 16, marginBottom: 8, width: "100%" }}>
                  <Text style={[styles.modalTitle, { fontSize: 16, marginBottom: 4, textAlign: "center" }]}>💰 Who referred you?</Text>
                  <Text style={{ fontSize: 12, color: "#888", marginBottom: 10, textAlign: "center" }}>Assign the bounty to a verified reviewer</Text>
                  {allReviews
                    .filter((r) => r.is_verified)
                    .map((review) => {
                      const isSelected = selectedBountyRecipient?.rating_uid === review.rating_uid;
                      const name = [review.profile_personal_first_name, review.profile_personal_last_name].filter(Boolean).join(" ") || `User ${review.rating_profile_id}`;
                      return (
                        <TouchableOpacity
                          key={review.rating_uid}
                          onPress={() => setSelectedBountyRecipient(isSelected ? null : review)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            padding: 10,
                            marginBottom: 8,
                            borderRadius: 10,
                            borderWidth: 1.5,
                            borderColor: isSelected ? "#9C45F7" : "#ddd",
                            backgroundColor: isSelected ? "#f5eeff" : "#fafafa",
                          }}
                        >
                          {/* Radio */}
                          <View
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 10,
                              borderWidth: 2,
                              borderColor: isSelected ? "#9C45F7" : "#ccc",
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 10,
                            }}
                          >
                            {isSelected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#9C45F7" }} />}
                          </View>

                          {/* Avatar */}
                          {review.profile_personal_image ? (
                            <Image
                              source={{ uri: review.profile_personal_image }}
                              style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }}
                              defaultSource={require("../assets/profile.png")}
                            />
                          ) : (
                            <View
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                marginRight: 10,
                                backgroundColor: "#e0e0e0",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text style={{ fontWeight: "bold", color: "#555" }}>{(review.profile_personal_first_name?.charAt(0) || "U").toUpperCase()}</Text>
                            </View>
                          )}

                          {/* Info */}
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: "600", color: "#333" }}>{name}</Text>
                            {review.circle_num_nodes !== null && review.circle_num_nodes !== undefined && (
                              <Text style={{ fontSize: 12, color: "#888" }}>{`Level ${review.circle_num_nodes} Connection`}</Text>
                            )}
                          </View>

                          {/* Bounty badge */}
                          {selectedService?.bs_bounty && (
                            <View
                              style={{
                                backgroundColor: isSelected ? "#9C45F7" : "#f0e8ff",
                                borderRadius: 8,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                              }}
                            >
                              <Text style={{ color: isSelected ? "#fff" : "#9C45F7", fontWeight: "700", fontSize: 12 }}>${parsePrice(selectedService.bs_bounty).toFixed(2)}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                </View>
              )}
            </ScrollView>

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
      zIndex: 1,
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
  content: {
    padding: 20,
    paddingBottom: 100,
    ...(Platform.OS === "web" && {
      width: "100%",
      maxWidth: "100%",
    }),
  },
  cardContainer: {
    padding: 0,
    alignItems: "flex-start",
    marginBottom: 0,
  },
  profileHeaderContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 8,
  },
  nameText: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 8,
    textAlign: "center",
  },
  profileId: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    fontStyle: "italic",
    textAlign: "center",
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
    backgroundColor: "#eee",
  },
  fieldContainer: {
    marginTop: 15,
    marginBottom: 0,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: "#000",
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#f5f5f5",
    marginBottom: 4,
  },
  inputText: {
    fontSize: 15,
    color: "#333",
    marginBottom: 4,
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
    textAlign: "center",
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
    boxShadow: "0px 2px 4px 0px rgba(0, 0, 0, 0.05)",
    ...(Platform.OS !== "web" && { elevation: 2 }),
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
  errorText: {
    fontSize: 18,
    color: "red",
    textAlign: "center",
    marginTop: 20,
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
  darkCardContainer: {
    backgroundColor: "#2d2d2d",
  },
  darkNameText: {
    color: "#ffffff",
  },
  darkProfileId: {
    color: "#cccccc",
  },
  darkLabel: {
    color: "#ffffff",
  },
  darkInputContainer: {
    backgroundColor: "#2d2d2d",
    borderColor: "#888",
    borderWidth: 1,
  },
  darkInputText: {
    color: "#ffffff",
  },
  darkEditIcon: {},
  darkTag: {
    backgroundColor: "#404040",
  },
  darkTagText: {
    color: "#64b5f6",
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
    boxShadow: "0px 1px 4px rgba(0, 0, 0, 0.2)",
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
  darkBusinessUserCard: {
    borderBottomColor: "#404040",
  },
  darkBusinessUserRole: {
    color: "#cccccc",
  },
  darkErrorText: {
    color: "#ff6b6b",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(175, 82, 222, 0.5)", // 50% opacity of Business Profile header color #AF52DE
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000",
    letterSpacing: 1,
  },
  linkText: {
    color: "#1a73e8",
    textDecorationLine: "underline",
  },
  verifiedText: {
    color: "#2e7d32",
    fontWeight: "600",
    fontSize: 11,
  },
  unverifiedText: {
    color: "#b71c1c",
    fontWeight: "600",
    fontSize: 11,
  },
  // Owner response section
  ownerResponseSection: {
    backgroundColor: "#f5eeff",
    borderLeftWidth: 3,
    borderLeftColor: "#9C45F7",
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    padding: 12,
    marginBottom: 4,
  },
  darkOwnerResponseSection: {
    backgroundColor: "#2a1f3d",
    borderLeftColor: "#b97af7",
  },
  ownerResponseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  ownerResponseLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#9C45F7",
    letterSpacing: 0.5,
  },
  ownerResponseText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  darkOwnerResponseText: {
    color: "#ddd",
  },
  editReplyLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  editReplyLinkText: {
    fontSize: 12,
    color: "#9C45F7",
    textDecorationLine: "underline",
  },
  replyTriggerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f5eeff",
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: "#d8b4fe",
  },
  darkReplyTriggerButton: {
    backgroundColor: "#2a1f3d",
    borderLeftColor: "#7c3aed",
  },
  replyTriggerText: {
    fontSize: 13,
    color: "#9C45F7",
    fontWeight: "600",
  },
  replyInputSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e0d0ff",
    paddingTop: 10,
  },
  replyInput: {
    borderWidth: 1,
    borderColor: "#c4b5fd",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#333",
    minHeight: 90,
    textAlignVertical: "top",
    backgroundColor: "#fff",
  },
  darkReplyInput: {
    borderColor: "#6d28d9",
    color: "#fff",
    backgroundColor: "#1e1433",
  },
  replyActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    gap: 10,
  },
  replyCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
  },
  replyCancelText: {
    color: "#555",
    fontWeight: "600",
    fontSize: 13,
  },
  replySubmitButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#9C45F7",
  },
  replySubmitText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },
});
