// BusinessSetupController.js
import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import BusinessStep0 from "./BusinessStep0";
import BusinessStep1 from "./BusinessStep1";
import BusinessStep2 from "./BusinessStep2";
// NOTE: BusinessStep3 and BusinessStep4 are no longer in the flow as of Jan 21, 2026.
// They can be deleted in the future once confirmed they're no longer needed.
import BusinessStep3 from "./BusinessStep3";
import BusinessStep4 from "./BusinessStep4";
import BusinessFooter from "../components/BusinessFooter";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import { BUSINESS_INFO_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "../utils/httpMiddleware";
import { useDarkMode } from "../contexts/DarkModeContext";

const BusinessProfileApi = BUSINESS_INFO_ENDPOINT;

export default function BusinessSetupController({ navigation, route }) {
  const { darkMode } = useDarkMode();

  useEffect(() => {
    console.log("BusinessSetupController - darkMode value:", darkMode);
  }, []);

  // Initialize empty form data
  const getInitialFormData = () => ({
    businessName: "",
    location: "",
    phoneNumber: "",
    businessRole: "",
    einNumber: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "",
    zip: "",
    latitude: "",
    longitude: "",
    googleRating: "",
    businessGooglePhotos: [],
    favImage: "",
    priceLevel: "",
    googleId: "",
    types: [],
    yelp: "",
    google: "",
    website: "",
    shortBio: "",
    tagLine: "",
    images: [],
    businessCategoryId: "",
    categories: [],
    customTags: [],
    socialLinks: {
      facebook: "",
      twitter: "",
      linkedin: "",
      youtube: "",
    },
    business_is_active: 1,
    business_email_id_is_public: 1,
    business_phone_number_is_public: 1,
    // business_address_line_1_is_public: 1,
    // business_address_line_2_is_public: 1,
    // business_city_is_public: 1,
    // business_state_is_public: 1,
    // business_country_is_public: 1,
    business_tag_line_is_public: 1,
    business_short_bio_is_public: 1,
    // business_google_rating_is_public: 1,
    // business_google_photos_is_public: 1,
    // business_yelp_is_public: 1,
    // business_website_is_public: 1,
    business_images_is_public: 1,
    business_banner_ad_is_public: 1,
    business_short_bio_is_public: 1,
    business_services_is_public: 1,
    business_owners_is_public: 1,
    business_services: [],
    social_links: [],
    // email, phone number, tagline, shortbio, images, bannerads, shortbio, services,
    // owners.
  });

  const [activeStep, setActiveStep] = useState(0);
  const [userUid, setUserUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(getInitialFormData());
  const formDataRef = useRef(formData);
  const [step2HasPendingTags, setStep2HasPendingTags] = useState(false);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Reset form when screen is focused to ensure fresh start for new business
  useFocusEffect(
    React.useCallback(() => {
      const resetForm = async () => {
        // Clear any existing business form data from AsyncStorage
        await AsyncStorage.removeItem("businessFormData");

        // Reset form data to initial empty state
        setFormData(getInitialFormData());

        // Reset to step 0
        setActiveStep(0);

        console.log("BusinessSetupController - Reset for NEW business creation");
      };

      resetForm();
    }, []),
  );

  useEffect(() => {
    const initializeBusinessSetup = async () => {
      const uid = await AsyncStorage.getItem("user_uid");
      console.log("user_uid", uid);
      if (!uid) {
        Alert.alert("Error", "User UID not found");
        return;
      }
      setUserUid(uid);

      // Always start fresh for new business creation
      // Clear any existing business form data from AsyncStorage
      await AsyncStorage.removeItem("businessFormData");

      // Reset form data to initial empty state
      setFormData(getInitialFormData());

      // Reset to step 0
      setActiveStep(0);

      console.log("BusinessSetupController - Initialized for NEW business creation");
      setLoading(false);
    };

    initializeBusinessSetup();
  }, []);

  const handleNext = () => {
    console.log("activeStep", activeStep);
    if (activeStep < 2) {
      setActiveStep((prev) => prev + 1);
    } else {
      submitBusinessData();
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    } else {
      // If we're at Step 0, go back to the previous screen (Settings, Profile, or AccountType)
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        // Fallback to Settings if we can't go back
        navigation.navigate("Settings");
      }
    }
  };

  const handleHeaderBack = () => {
    handleBack();
  };

  const validateCurrentStep = () => {
    switch (activeStep) {
      case 0:
        // Step 0: Must have Business Name
        return formData.businessName && formData.businessName.trim() !== "";
      case 1:
        // Step 1: No required fields
        return true;
      case 2:
        // Step 2: Must select at least a Main Category
        return formData.businessCategoryId && formData.businessCategoryId.length > 0;
      case 3:
        // Step 3: No required fields
        return true;
      case 4:
        // Step 4: No required fields
        return true;
      default:
        return false;
    }
  };

  const handleContinue = () => {
    if (activeStep === 2 && step2HasPendingTags) {
      Alert.alert("Unsaved Tags", "Click Add to save your custom tags, or clear the tag field before submitting.");
      return;
    }

    if (validateCurrentStep()) {
      if (activeStep < 2) {
        setActiveStep((prev) => prev + 1);
      } else {
        submitBusinessData();
      }
    } else {
      // Show validation error
      let errorMessage = "";
      switch (activeStep) {
        case 0:
          errorMessage = "Please enter a Business Name to continue.";
          break;
        case 2:
          errorMessage = "Please select at least a Main Category to continue.";
          break;
        default:
          errorMessage = "Please complete all required fields to continue.";
      }
      Alert.alert("Validation Error", errorMessage);
    }
  };

  const formatBusinessCategoryId = (categoryId) => {
    if (Array.isArray(categoryId)) return categoryId.filter(Boolean).join(",");
    return categoryId || "";
  };

  const submitBusinessData = async () => {
    try {
      const currentFormData = formDataRef.current;
      const customTags = currentFormData.customTags || [];

      // Build payload object for logging
      const payloadData = {
        user_uid: userUid,
        business_name: currentFormData.businessName,
        business_location: currentFormData.location || currentFormData.addressLine1 || "",
        business_phone_number: currentFormData.phoneNumber,
        business_ein_number: currentFormData.einNumber,
        business_address_line_1: currentFormData.addressLine1,
        business_address_line_2: currentFormData.addressLine2,
        business_city: currentFormData.city,
        business_state: currentFormData.state,
        business_country: currentFormData.country,
        business_zip_code: currentFormData.zip,
        business_latitude: currentFormData.latitude,
        business_longitude: currentFormData.longitude,
        business_short_bio: currentFormData.shortBio,
        business_tag_line: currentFormData.tagLine,
        business_category_id: formatBusinessCategoryId(currentFormData.businessCategoryId),
        business_google_rating: currentFormData.googleRating,
        business_google_photos: JSON.stringify(currentFormData.businessGooglePhotos),
        business_favorite_image: currentFormData.favImage || "",
        business_price_level: currentFormData.priceLevel,
        business_google_id: currentFormData.googleId,
        business_yelp: currentFormData.yelp,
        business_website: currentFormData.website,
        business_is_active: currentFormData.business_is_active,
        business_email_id_is_public: currentFormData.business_email_id_is_public,
        business_phone_number_is_public: currentFormData.business_phone_number_is_public,
        business_tag_line_is_public: currentFormData.business_tag_line_is_public,
        business_short_bio_is_public: currentFormData.business_short_bio_is_public,
        business_images_is_public: currentFormData.business_images_is_public,
        business_banner_ads_is_public: currentFormData.business_banner_ad_is_public,
        business_services_is_public: currentFormData.business_services_is_public,
        business_owners_is_public: currentFormData.business_owners_is_public,
        business_services: JSON.stringify(currentFormData.business_services || []),
        business_images_url: currentFormData.images && currentFormData.images.length > 0 ? `[${currentFormData.images.length} user-uploaded image(s)]` : "[]",
        user_uploaded_images_count: currentFormData.images ? currentFormData.images.length : 0,
        custom_tags: JSON.stringify(customTags),
      };

      // Create FormData and append all fields
      const data = new FormData();
      data.append("user_uid", userUid);
      data.append("business_name", currentFormData.businessName);
      data.append("business_location", currentFormData.location || currentFormData.addressLine1 || "");
      data.append("business_phone_number", currentFormData.phoneNumber);
      data.append("business_ein_number", currentFormData.einNumber);
      data.append("business_address_line_1", currentFormData.addressLine1);
      data.append("business_address_line_2", currentFormData.addressLine2); // Optional
      data.append("business_city", currentFormData.city);
      data.append("business_state", currentFormData.state);
      data.append("business_country", currentFormData.country);
      data.append("business_zip_code", currentFormData.zip);
      data.append("business_latitude", currentFormData.latitude);
      data.append("business_longitude", currentFormData.longitude);
      data.append("business_short_bio", currentFormData.shortBio);
      data.append("business_tag_line", currentFormData.tagLine);
      data.append("business_role", currentFormData.businessRole);
      data.append("business_category_id", formatBusinessCategoryId(currentFormData.businessCategoryId));
      data.append("custom_tags", JSON.stringify(customTags));
      data.append("business_google_rating", currentFormData.googleRating);
      data.append("business_google_photos", JSON.stringify(currentFormData.businessGooglePhotos));
      if (currentFormData.favImage) {
        data.append("business_favorite_image", currentFormData.favImage);
      }
      data.append("business_price_level", currentFormData.priceLevel);
      data.append("business_google_id", currentFormData.googleId);
      data.append("business_yelp", currentFormData.yelp);
      data.append("business_website", currentFormData.website);

      data.append("business_is_active", currentFormData.business_is_active);

      data.append("business_email_id_is_public", currentFormData.business_email_id_is_public);
      data.append("business_phone_number_is_public", currentFormData.business_phone_number_is_public);
      data.append("business_tag_line_is_public", currentFormData.business_tag_line_is_public);
      data.append("business_short_bio_is_public", currentFormData.business_short_bio_is_public);
      data.append("business_images_is_public", currentFormData.business_images_is_public);
      data.append("business_banner_ads_is_public", currentFormData.business_banner_ad_is_public);
      data.append("business_short_bio_is_public", currentFormData.business_short_bio_is_public);
      data.append("business_services_is_public", currentFormData.business_services_is_public);
      data.append("business_owners_is_public", currentFormData.business_owners_is_public);

      // Add business_services array as JSON string
      data.append("business_services", JSON.stringify(currentFormData.business_services || []));

      // Append user-uploaded images as files (supports file://, content://, blob:, data: URIs)
      if (currentFormData.images && currentFormData.images.length > 0) {
        const userImageFilenames = [];
        const isWeb = Platform.OS === "web";
        const isBlobOrDataUri = (uri) => uri && (uri.startsWith("blob:") || uri.startsWith("data:"));

        for (let index = 0; index < currentFormData.images.length; index++) {
          const imageUri = currentFormData.images[index];
          if (!imageUri || typeof imageUri !== "string") continue;

          let fileType = "jpg";
          if (imageUri.startsWith("data:")) {
            const match = imageUri.match(/data:image\/(\w+)/);
            fileType = match ? (match[1] === "jpeg" ? "jpg" : match[1]) : "jpg";
          } else {
            const uriParts = imageUri.split(".");
            fileType = uriParts.length > 1 ? uriParts[uriParts.length - 1].split(/[?#]/)[0] : "jpg";
          }
          const mimeType = ["jpg", "jpeg", "png", "gif", "webp"].includes(fileType.toLowerCase()) ? `image/${fileType === "jpg" ? "jpeg" : fileType}` : "image/jpeg";
          const fileName = `business_image_${index}.${fileType}`;

          let fileToAppend = null;

          if (isWeb && isBlobOrDataUri(imageUri)) {
            try {
              const response = await fetch(imageUri);
              const blob = await response.blob();
              fileToAppend = new File([blob], fileName, { type: mimeType });
            } catch (err) {
              console.error("Failed to fetch image for upload:", err);
              continue;
            }
          } else {
            fileToAppend = {
              uri: imageUri,
              type: mimeType,
              name: fileName,
            };
          }

          userImageFilenames.push(fileName);
          data.append(`business_img_${index}`, fileToAppend);
          if (index === 0) {
            const profileFileName = `business_profile_img.${fileType}`;
            const profileFile = fileToAppend instanceof File ? new File([fileToAppend], profileFileName, { type: mimeType }) : { uri: imageUri, type: mimeType, name: profileFileName };
            data.append("business_profile_img", profileFile);
          }
        }

        if (userImageFilenames.length > 0) {
          data.append("business_images_url", JSON.stringify(userImageFilenames));
        }
      } else if (currentFormData.favImage) {
        const isWeb = Platform.OS === "web";
        try {
          const response = await fetch(currentFormData.favImage);
          const blob = await response.blob();
          const mimeType = blob.type || "image/jpeg";
          const fileType = mimeType.split("/")[1] === "jpeg" ? "jpg" : mimeType.split("/")[1] || "jpg";
          const profileFileName = `business_profile_img.${fileType}`;

          if (isWeb) {
            data.append("business_profile_img", new File([blob], profileFileName, { type: mimeType }));
          } else {
            data.append("business_profile_img", {
              uri: currentFormData.favImage,
              type: mimeType,
              name: profileFileName,
            });
          }
        } catch (err) {
          console.error("Failed to upload selected Google image as business profile image:", err);
        }
      }

      data.append("business_profile_img_is_public", currentFormData.business_images_is_public);

      // ============================================
      // CONSOLE LOGS FOR DEBUGGING / POSTMAN TESTING
      // ============================================
      console.log("============================================");
      console.log("📡 BUSINESS INFO API REQUEST");
      console.log("============================================");
      console.log("🔗 ENDPOINT:", BusinessProfileApi);
      console.log("📝 METHOD: POST");
      console.log("============================================");
      console.log("📦 FORM DATA (Key-Value Pairs for Postman):");
      console.log("============================================");

      // Collect all FormData entries and format for Postman
      const formDataEntries = [];
      for (let pair of data.entries()) {
        const [key, value] = pair;
        // Skip file objects to avoid logging large binary data
        if (typeof value === "object" && (value?.uri || value instanceof File)) {
          formDataEntries.push([key, `[FILE] ${value.name || "image"}`]);
        } else {
          formDataEntries.push([key, value]);
        }
      }

      // Log in Postman-friendly format (key:value - no space after colon for easy copy-paste)
      formDataEntries.forEach(([key, value]) => {
        const displayValue = typeof value === "object" ? JSON.stringify(value) : String(value);
        console.log(`${key}:${displayValue}`);
      });

      console.log("============================================");
      console.log("📋 AS JSON (for Postman body - form-data):");
      console.log("============================================");
      console.log(JSON.stringify(payloadData, null, 2));

      console.log("============================================");
      console.log("📋 RAW FORM DATA PARTS:");
      console.log("============================================");
      if (data && data._parts) {
        data._parts.forEach(([key, value]) => {
          console.log(`${key}:`, value);
        });
      }
      console.log("============================================");

      const response = await fetch(BusinessProfileApi, {
        method: "POST",
        body: data,
      });

      const result = await response.json();

      // Log response details
      console.log("============================================");
      console.log("📥 API RESPONSE");
      console.log("============================================");
      console.log("📊 STATUS:", response.status, response.statusText);
      console.log("📋 RESPONSE BODY:");
      console.log(JSON.stringify(result, null, 2));
      console.log("============================================");

      if (response.ok) {
        // Clear any cached profile data to force refresh
        await AsyncStorage.removeItem("cachedProfileData");

        console.log("✅ Business created successfully");
        console.log("🆔 Business UID:", result.business_uid);
        navigation.navigate("BusinessProfile", { business_uid: result.business_uid });
        // navigation.navigate('BusinessProfile');
      } else {
        console.error("❌ Business creation failed:", result.message || "Unknown error");
        throw new Error(result.message || "Business creation failed.");
      }
    } catch (error) {
      console.error("============================================");
      console.error("❌ ERROR IN BUSINESS CREATION");
      console.error("============================================");
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      console.error("Full error:", error);
      console.error("============================================");
      Alert.alert("Submission Error", error.message);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 100 }} size='large' color='#00C721' />;

  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return <BusinessStep0 formData={formData} setFormData={setFormData} navigation={navigation} />;
      case 1:
        return <BusinessStep1 formData={formData} setFormData={setFormData} navigation={navigation} />;
      case 2:
        return (
          <BusinessStep2
            formData={formData}
            setFormData={setFormData}
            navigation={navigation}
            onPendingTagsChange={setStep2HasPendingTags}
          />
        );
      case 3:
        return <BusinessStep3 formData={formData} setFormData={setFormData} navigation={navigation} />;
      case 4:
        return <BusinessStep4 formData={formData} setFormData={setFormData} navigation={navigation} />;
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, darkMode && styles.darkContainer]}>
      <AppHeader title='Business Setup' backgroundColor='#FF9500' onBackPress={handleHeaderBack} />
      {renderStep()}
      <BusinessFooter
        activeStep={activeStep}
        onBack={handleBack}
        onContinue={handleContinue}
        onSubmit={handleContinue}
        totalSteps={3}
        submitDisabled={activeStep === 2 && step2HasPendingTags}
      />
      <BottomNavBar navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
  },
  // Dark mode styles
  darkContainer: {
    backgroundColor: "#1a1a1a",
  },
});
