//EditBusinessProfileScreen.js
import React, { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, Image, Keyboard, UIManager, findNodeHandle, ActivityIndicator, Platform } from "react-native";
import axios from "axios";
import MiniCard from "../components/MiniCard";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { useDarkMode } from "../contexts/DarkModeContext";
import { getHeaderColors } from "../config/headerColors";
import AsyncStorage from "@react-native-async-storage/async-storage";

// BUSINESS-SPECIFIC
import { Dropdown } from "react-native-element-dropdown";
import ProductCard from "../components/ProductCard";
import { BUSINESS_INFO_ENDPOINT, USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";


const BusinessProfileAPI = BUSINESS_INFO_ENDPOINT;
const DEFAULT_BUSINESS_IMAGE = require("../assets/profile.png");

const EditBusinessProfileScreen = ({ route, navigation }) => {
  const { darkMode } = useDarkMode();
  const { business, business_users } = route.params || {};
  const [businessUID, setBusinessUID] = useState(business?.business_uid || "");
  const scrollViewRef = useRef(null);
  const fileInputRef = useRef(null); // For web file input

  // Business image state (identical to EditProfileScreen profile image handling)
  // Get first image from images array if it exists, or use business_image field
  const initialBusinessImage = (() => {
    if (business?.images && Array.isArray(business.images) && business.images.length > 0) {
      return business.images[0];
    }
    return business?.business_image || business?.business_profile_image || "";
  })();
  const [originalBusinessImage, setOriginalBusinessImage] = useState(initialBusinessImage);
  const [businessImage, setBusinessImage] = useState(initialBusinessImage);
  const [businessImageUri, setBusinessImageUri] = useState(initialBusinessImage);
  const [deleteBusinessImage, setDeleteBusinessImage] = useState("");
  const [imageError, setImageError] = useState(false);
  const [webImageFile, setWebImageFile] = useState(null); // Store the actual File object for web uploads
  const [imageUpdateKey, setImageUpdateKey] = useState(0); // Key to force MiniCard re-render when image changes

  useEffect(() => {
    // This useEffect is only used to log the screen being mounted
    console.log("EditBusinessProfileScreen - Screen Mounted");
  }, []);

  const [formData, setFormData] = useState({
    // BUSINESS-SPECIFIC: Different field names - uses business_* instead of profile_personal_*
    name: business?.business_name || "",
    location: business?.business_address_line_1 || "",
    addressLine2: business?.business_address_line_2 || "",
    city: business?.business_city || "",
    state: business?.business_state || "",
    country: business?.business_country || "",
    zip: business?.business_zip_code || "",
    phone: business?.business_phone_number || "",
    email: business?.business_email_id || business?.business_email || "",
    category: business?.business_category || "",
    tagline: business?.business_tag_line || business?.tagline || "",
    shortBio: business?.business_short_bio || business?.short_bio || "",
    businessRole: business?.business_role || business?.role || business?.bu_role || "",
    einNumber: business?.business_ein_number || "",
    website: business?.business_website || "",
    // BUSINESS-SPECIFIC: customTags array (not in EditProfileScreen)
    customTags: (() => {
      // Handle custom_tags - could be array, string, or already parsed as customTags
      // Also check for 'tags' field from backend API
      console.log("EditBusinessProfileScreen - Loading custom tags from business object:", {
        customTags: business?.customTags,
        custom_tags: business?.custom_tags,
        tags: business?.tags,
        businessKeys: business ? Object.keys(business) : "business is null/undefined",
      });

      // First check if already parsed as customTags (from BusinessProfileScreen)
      if (business?.customTags && Array.isArray(business.customTags)) {
        console.log("EditBusinessProfileScreen - Using customTags array:", business.customTags);
        return business.customTags;
      }

      // Check for 'tags' field (from backend API response)
      if (business?.tags && Array.isArray(business.tags)) {
        console.log("EditBusinessProfileScreen - Using tags array:", business.tags);
        return business.tags;
      }

      // Check for custom_tags as array
      if (business?.custom_tags && Array.isArray(business.custom_tags)) {
        console.log("EditBusinessProfileScreen - Using custom_tags array:", business.custom_tags);
        return business.custom_tags;
      }

      // Check for custom_tags as string (JSON)
      if (business?.custom_tags && typeof business.custom_tags === "string") {
        try {
          const parsed = JSON.parse(business.custom_tags);
          if (Array.isArray(parsed)) {
            console.log("EditBusinessProfileScreen - Parsed custom_tags string:", parsed);
            return parsed;
          }
        } catch (e) {
          console.log("EditBusinessProfileScreen - Failed to parse custom_tags as JSON:", e);
        }
      }

      console.log("EditBusinessProfileScreen - No custom tags found, returning empty array");
      return [];
    })(),
    // Business image is now handled separately in state (like EditProfileScreen)
    businessGooglePhotos: Array.isArray(business?.businessGooglePhotos) ? business.businessGooglePhotos : [],
    // BUSINESS-SPECIFIC: Social links as object with nested properties (EditProfileScreen has separate fields: facebook, twitter, linkedin, youtube)
    socialLinks: {
      facebook: business?.facebook || "",
      instagram: business?.instagram || "",
      linkedin: business?.linkedin || "",
      youtube: business?.youtube || "",
    },
    emailIsPublic: business?.business_email_id_is_public === "1" || business?.email_is_public === "1" || business?.emailIsPublic === true,
    phoneIsPublic: business?.business_phone_number_is_public === "1" || business?.phone_is_public === "1" || business?.phoneIsPublic === true,
    taglineIsPublic: business?.business_tag_line_is_public === "1" || business?.tagline_is_public === "1" || business?.taglineIsPublic === true,
    shortBioIsPublic: business?.business_short_bio_is_public === "1" || business?.short_bio_is_public === "1" || business?.shortBioIsPublic === true,
    imageIsPublic: business?.business_image_is_public === "1" || business?.image_is_public === "1" || business?.imageIsPublic === true || false,
    // MISSING: Section visibility flags (EditProfileScreen has: experienceIsPublic, educationIsPublic, expertiseIsPublic, wishesIsPublic, businessIsPublic)
    // Note: Business profile doesn't have these sections, so these flags are not needed
    // MISSING: Arrays for experience, education, expertise, wishes, businesses (EditProfileScreen has these)
    // Note: Business profile uses services array instead (handled separately below)
  });

  // BUSINESS-SPECIFIC: deletedItems structure is different - tracks deleted business users instead of experience/education/etc.
  // MISSING: deletedItems state object with arrays for experiences, educations, expertises, wishes, businesses (EditProfileScreen has this)
  // Note: Business profile doesn't have these sections, so deletedItems is not needed in the same way
  // BUSINESS-SPECIFIC: deletedBusinessUsers array tracks deleted business users instead

  // MISSING: showBusinessModal and pendingBusinessNames states (EditProfileScreen has these for business approval)
  // Note: Not needed for business profile editing
  // MISSING: shortBioHeight state (EditProfileScreen has this for dynamic textarea height)
  // Note: Could be added if shortBio textarea needs dynamic height
  // MISSING: fileInputRef for web file input (EditProfileScreen has this)
  // Note: Could be added if web image upload is needed for business images
  // MISSING: imageUpdateKey state (EditProfileScreen has this to force MiniCard re-render)
  // Note: Could be added if MiniCard preview needs to update when images change

  // Validation state - computed after formData is initialized
  const isValid = useMemo(() => {
    // BUSINESS-SPECIFIC: Validates name instead of firstName and lastName
    return formData.name.trim() && businessUID.trim();
  }, [formData.name, businessUID]);

  // BUSINESS-SPECIFIC: Additional state for business-specific features
  const [customTagInput, setCustomTagInput] = useState("");
  const [additionalBusinessUsers, setAdditionalBusinessUsers] = useState([]);
  const [existingBusinessUsers, setExistingBusinessUsers] = useState(Array.isArray(business_users) ? business_users : []);
  const [deletedBusinessUsers, setDeletedBusinessUsers] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isChanged, setIsChanged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // BUSINESS-SPECIFIC: businessRoles constant (not in EditProfileScreen)
  const businessRoles = [
    { label: "Owner", value: "owner" },
    { label: "Employee", value: "employee" },
    { label: "Partner", value: "partner" },
    { label: "Admin", value: "admin" },
    { label: "Other", value: "other" },
  ];

  // BUSINESS-SPECIFIC: formatEINNumber function (not in EditProfileScreen)
  const formatEINNumber = (text) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, "");

    // Limit to 9 digits (2 + 7)
    if (cleaned.length > 9) {
      return text.slice(0, -1);
    }

    // Format based on length: ##-#######
    if (cleaned.length === 0) return "";
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 9) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
    return text;
  };

  const toggleVisibility = (fieldName) => {
    setFormData((prev) => {
      const newValue = !prev[fieldName];
      const updated = { ...prev, [fieldName]: newValue };

      // MISSING: Comments about section-level toggles (EditProfileScreen has detailed comments)
      // Note: Business profile doesn't have section-level toggles like experienceIsPublic, etc.

      return updated;
    });
    setIsChanged(true);
  };

  // Update all field changes to set isChanged to true
  const handleFieldChange = (fieldName, value) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    setIsChanged(true);
  };

  // Update all toggles to set isChanged to true
  const handleToggleVisibility = (fieldName) => {
    setIsChanged(true);
    toggleVisibility(fieldName);
  };

  // Web-specific image picker handler (identical to EditProfileScreen)
  const handleWebImagePick = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      Alert.alert("File not selectable", `Image size (${(file.size / 1024).toFixed(1)} KB) exceeds the 2MB upload limit.`);
      return;
    }

    // Check if it's an image file
    if (!file.type.startsWith("image/")) {
      Alert.alert("Invalid file type", "Please select an image file.");
      return;
    }

    // Store the actual File object for upload
    setWebImageFile(file);

    // Create a local URL for preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageUri = reader.result;
      if (originalBusinessImage && originalBusinessImage !== imageUri) {
        setDeleteBusinessImage(originalBusinessImage);
      }
      setBusinessImageUri(imageUri);
      setBusinessImage(imageUri);
      setImageError(false);
      setIsChanged(true);
      setImageUpdateKey(prev => prev + 1); // Increment key to force MiniCard re-render
    };
    reader.readAsDataURL(file);

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Image picker handler (identical to EditProfileScreen)
  const handlePickImage = async () => {
    console.log("handlePickImage called");
    
    // On web, use file input instead of ImagePicker
    if (Platform.OS === "web") {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
      return;
    }

    // Mobile implementation
    try {
      console.log("Requesting media library permissions...");
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log("Media library permission status:", status);

      if (status !== "granted") {
        console.log("Permission not granted");
        Alert.alert("Permission required", "Permission to access media library is required!");
        return;
      }

      console.log("Launching image library...");
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      console.log("Image picker result:", JSON.stringify(result, null, 2));

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // File size check (2MB = 2 * 1024 * 1024 = 2,097,152 bytes)
        const asset = result.assets[0];
        let fileSize = asset.fileSize;
        if (!fileSize && asset.uri) {
          // Try to get file size using FileSystem
          try {
            const fileInfo = await FileSystem.getInfoAsync(asset.uri);
            fileSize = fileInfo.size;
          } catch (e) {
            console.log("Could not get file size from FileSystem", e);
          }
        }
        if (fileSize && fileSize > 2 * 1024 * 1024) {
          Alert.alert("File not selectable", `Image size (${(fileSize / 1024).toFixed(1)} KB) exceeds the 2MB upload limit.`);
          return;
        }
        console.log("Image selected successfully");
        if (originalBusinessImage && originalBusinessImage !== result.assets[0].uri) {
          console.log("Setting deleteBusinessImage to:", originalBusinessImage);
          setDeleteBusinessImage(originalBusinessImage);
        }
        console.log("Setting new business image URI:", result.assets[0].uri);
        setBusinessImageUri(result.assets[0].uri);
        setBusinessImage(result.assets[0].uri);
        setImageError(false); // Reset error state when new image is selected
        setIsChanged(true);
        setImageUpdateKey(prev => prev + 1); // Increment key to force MiniCard re-render
      } else {
        console.log("No image selected or picker was canceled");
      }
    } catch (error) {
      console.error("Error picking image - Full error:", error);
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);

      // More specific error messages based on error type
      let errorMessage = "Failed to pick image. ";
      if (error.name === "PermissionDenied") {
        errorMessage += "Permission was denied.";
      } else if (error.name === "ImagePickerError") {
        errorMessage += "There was an error with the image picker.";
      } else if (error.message.includes("permission")) {
        errorMessage += "Permission issue detected.";
      } else if (error.message.includes("canceled")) {
        errorMessage += "Operation was canceled.";
      }

      Alert.alert("Error", errorMessage);
    }
  };

  // Add image error handler (identical to EditProfileScreen)
  const handleImageError = () => {
    console.log("EditBusinessProfileScreen - Image failed to load, using default image");
    setImageError(true);
    setBusinessImageUri("");
    setBusinessImage("");
  };

  // MISSING: handleDeleteExperience, handleDeleteEducation, handleDeleteExpertise, handleDeleteWish, handleDeleteBusiness functions (EditProfileScreen has these)
  // Note: Business profile doesn't have these sections, so delete handlers are not needed
  // BUSINESS-SPECIFIC: Business user management functions instead
  const addBusinessEditor = () => {
    setAdditionalBusinessUsers([...additionalBusinessUsers, { email: "", role: "" }]);
    setIsChanged(true);
  };

  const removeBusinessEditor = (index) => {
    const updated = additionalBusinessUsers.filter((_, i) => i !== index);
    setAdditionalBusinessUsers(updated);
    setIsChanged(true);
  };

  const updateBusinessEditor = (index, field, value) => {
    const updated = [...additionalBusinessUsers];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalBusinessUsers(updated);
    setIsChanged(true);
  };

  // Delete existing business user (only for employee/admin/other roles)
  const deleteExistingBusinessUser = async (businessUser) => {
    // Check if current user is owner or partner
    const userUid = await AsyncStorage.getItem("user_uid");
    const currentUser = existingBusinessUsers.find((user) => user.business_user_id === userUid);
    const currentUserRole = currentUser?.business_role || formData.businessRole || "";

    // Only allow deletion if current user is owner or partner
    if (currentUserRole.toLowerCase() !== "owner" && currentUserRole.toLowerCase() !== "partner") {
      Alert.alert("Permission Denied", "Only owners and partners can remove business users.");
      return;
    }

    // Only allow deletion of employee, admin, or other roles
    const userRole = businessUser.business_role?.toLowerCase() || "";
    if (userRole === "owner" || userRole === "partner") {
      Alert.alert("Cannot Delete", "Owners and partners cannot be removed.");
      return;
    }

    Alert.alert("Remove Business User", `Are you sure you want to remove ${businessUser.first_name || ""} ${businessUser.last_name || ""} (${businessUser.business_role || ""})?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          // Remove from existing users
          const updated = existingBusinessUsers.filter((user) => user.business_user_id !== businessUser.business_user_id);
          setExistingBusinessUsers(updated);
          // Add to deleted users list
          setDeletedBusinessUsers((prev) => [...prev, businessUser.business_user_id]);
          setIsChanged(true);
        },
      },
    ]);
  };

  // BUSINESS-SPECIFIC: Custom tags management functions (not in EditProfileScreen)
  const addCustomTag = () => {
    if (customTagInput.trim() && !(formData.customTags || []).includes(customTagInput.trim())) {
      const updatedTags = [...(formData.customTags || []), customTagInput.trim()];
      setFormData({ ...formData, customTags: updatedTags });
      setCustomTagInput("");
      setIsChanged(true);
    }
  };

  const removeCustomTag = (tagToRemove) => {
    const updatedTags = (formData.customTags || []).filter((tag) => tag !== tagToRemove);
    setFormData({ ...formData, customTags: updatedTags });
    setIsChanged(true);
  };

  // MISSING: handleImageError function (EditProfileScreen has this)
  // Note: Could be added if image error handling is needed for business images

  const handleSave = async () => {
    console.log("Save Button Pressed: handleSave");
    // BUSINESS-SPECIFIC: Validates name instead of firstName and lastName
    if (!formData.name.trim() || !businessUID.trim()) {
      Alert.alert("Error", "Business name and ID are required.");
      return;
    }

    setIsLoading(true);
    try {
      // BUSINESS-SPECIFIC: Retrieves user_uid (EditProfileScreen doesn't need this at start)
      // Retrieve user_uid from AsyncStorage
      const userUid = await AsyncStorage.getItem("user_uid");
      if (!userUid) {
        Alert.alert("Error", "User UID not found. Please log in again.");
        return;
      }

      // BUSINESS-SPECIFIC: Gets current user's role from existingBusinessUsers
      // Get current user's role from existingBusinessUsers if businessRole is empty
      let currentBusinessRole = formData.businessRole;
      if (!currentBusinessRole && existingBusinessUsers.length > 0) {
        const currentUser = existingBusinessUsers.find((user) => user.business_user_id === userUid);
        if (currentUser?.business_role) {
          currentBusinessRole = currentUser.business_role;
          console.log("Setting business_role from existingBusinessUsers:", currentBusinessRole);
        }
      }

      const payload = new FormData();
      // BUSINESS-SPECIFIC: Uses user_uid and business_uid (EditProfileScreen uses profile_uid)
      payload.append("user_uid", userUid);
      payload.append("business_uid", businessUID);
      // BUSINESS-SPECIFIC: Uses business_* field names instead of profile_personal_*
      payload.append("business_name", formData.name);
      payload.append("business_address_line_1", formData.location);
      payload.append("business_address_line_2", formData.addressLine2);
      payload.append("business_city", formData.city);
      payload.append("business_state", formData.state);
      payload.append("business_country", formData.country);
      payload.append("business_zip_code", formData.zip);
      payload.append("business_phone_number", formData.phone);
      payload.append("business_email_id", formData.email);
      payload.append("business_category_id", formData.category);
      payload.append("business_short_bio", formData.shortBio);
      payload.append("business_tag_line", formData.tagline);
      payload.append("business_role", currentBusinessRole || "");
      payload.append("business_ein_number", formData.einNumber);
      payload.append("business_website", formData.website);
      payload.append("custom_tags", JSON.stringify(formData.customTags));

      // Business image handling - backend expects business_img_0 (not business_image)
      let imageFileSize = 0;
      if (businessImageUri && !imageError && businessImageUri !== originalBusinessImage) {
        if (Platform.OS === "web" && webImageFile) {
          // On web, use the actual File object
          imageFileSize = webImageFile.size || 0;
          console.log("Business image file size (bytes):", imageFileSize);
          // Backend expects business_img_0 for the file field name
          payload.append("business_img_0", webImageFile);
        } else {
          // On mobile, use FileSystem to get file info
          try {
            const fileInfo = await FileSystem.getInfoAsync(businessImageUri);
            imageFileSize = fileInfo.size || 0;
            console.log("Business image file size (bytes):", imageFileSize);

            const uriParts = businessImageUri.split(".");
            const fileType = uriParts[uriParts.length - 1] || "jpg";

            const imageFile = {
              uri: businessImageUri,
              name: `business_img_0.${fileType}`,
              type: `image/${fileType}`,
            };

            // Backend expects business_img_0 for the file field name
            payload.append("business_img_0", imageFile);
          } catch (error) {
            console.error("Error getting file info:", error);
            // If FileSystem fails, try to use the URI directly (for web fallback)
            if (businessImageUri.startsWith("data:")) {
              // Convert data URL to blob for web
              const response = await fetch(businessImageUri);
              const blob = await response.blob();
              imageFileSize = blob.size || 0;
              const file = new File([blob], "business_img_0.jpg", { type: blob.type });
              // Backend expects business_img_0 for the file field name
              payload.append("business_img_0", file);
            }
          }
        }
      }

      // Only add delete_business_img_0 if there's an image to delete and it hasn't errored
      if (deleteBusinessImage && !imageError) {
        console.log("Adding delete_business_img_0 to payload:", deleteBusinessImage);
        payload.append("delete_business_img_0", deleteBusinessImage);
      }

      // Append Google images as URLs (if any - these are separate from user-uploaded)
      const googleImages = formData.businessGooglePhotos || [];
      if (googleImages.length > 0) {
        payload.append("business_google_photos", JSON.stringify(googleImages));
      }

      payload.append("business_image_is_public", formData.imageIsPublic ? "1" : "0");

      payload.append("social_links", JSON.stringify(formData.socialLinks));
      payload.append("business_email_id_is_public", formData.emailIsPublic ? "1" : "0");
      payload.append("business_phone_number_is_public", formData.phoneIsPublic ? "1" : "0");
      payload.append("business_tag_line_is_public", formData.taglineIsPublic ? "1" : "0");
      payload.append("business_short_bio_is_public", formData.shortBioIsPublic ? "1" : "0");

      // BUSINESS-SPECIFIC: Services/products handling (EditProfileScreen handles experience, education, expertise, wishes, businesses arrays)
      const fullServiceSchema = (service, idx) => {
        const baseSchema = {
          bs_service_name: service.bs_service_name || "",
          bs_service_desc: service.bs_service_desc || "",
          bs_notes: service.bs_notes || "",
          bs_sku: service.bs_sku || "",
          bs_bounty: service.bs_bounty || "",
          bs_bounty_currency: service.bs_bounty_currency || "USD",
          bs_is_taxable: typeof service.bs_is_taxable === "undefined" ? 1 : service.bs_is_taxable,
          bs_tax_rate: service.bs_tax_rate || "0",
          bs_discount_allowed: typeof service.bs_discount_allowed === "undefined" ? 1 : service.bs_discount_allowed,
          bs_refund_policy: service.bs_refund_policy || "",
          bs_return_window_days: service.bs_return_window_days || "0",
          bs_display_order: typeof service.bs_display_order === "undefined" ? idx + 1 : service.bs_display_order,
          bs_tags: service.bs_tags || "",
          bs_duration_minutes: service.bs_duration_minutes || "",
          bs_cost: service.bs_cost || "",
          bs_cost_currency: service.bs_cost_currency || "USD",
          bs_is_visible: typeof service.bs_is_visible === "undefined" ? 1 : service.bs_is_visible,
          bs_status: service.bs_status || "active",
          bs_image_key: service.bs_image_key || "",
        };

        if (service.bs_uid && service.bs_uid.trim() !== "") {
          return {
            ...baseSchema,
            bs_uid: service.bs_uid,
          };
        }

        return baseSchema;
      };

      const servicesToSend = services.map(fullServiceSchema);
      payload.append("business_services", JSON.stringify(servicesToSend));

      // BUSINESS-SPECIFIC: Business users handling (EditProfileScreen doesn't have this)
      const remainingExistingUsers = existingBusinessUsers.filter((user) => !deletedBusinessUsers.includes(user.business_user_id));
      const existingEmails = remainingExistingUsers.map((user) => user.user_email || "").filter((email) => email);
      const existingRoles = remainingExistingUsers.map((user) => user.business_role || "").filter((role) => role);
      const validNewUsers = additionalBusinessUsers.filter((user) => user.email.trim() && user.role);
      const newEmails = validNewUsers.map((user) => user.email.trim());
      const newRoles = validNewUsers.map((user) => user.role);
      const allEmails = [...existingEmails, ...newEmails];
      const allRoles = [...existingRoles, ...newRoles];

      if (allEmails.length > 0 && allRoles.length > 0) {
        payload.append("additional_business_user", JSON.stringify(allEmails));
        payload.append("additional_business_role", JSON.stringify(allRoles));
      }

      // MISSING: Deleted items handling (EditProfileScreen appends delete_experiences, delete_educations, etc.)
      // Note: Business profile doesn't have these sections, so deleted items handling is not needed

      // BUSINESS-SPECIFIC: Console logs for debugging (EditProfileScreen has simpler logging)
      console.log("============================================");
      console.log("📡 BUSINESS INFO API REQUEST (PUT)");
      console.log("============================================");
      console.log("🔗 ENDPOINT:", BusinessProfileAPI);
      console.log("📝 METHOD: PUT");
      console.log("============================================");

      const response = await axios.put(`${BusinessProfileAPI}`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.status === 200) {
        Alert.alert("Success", "Business profile updated.");
        setIsChanged(false);
        navigation.navigate("BusinessProfile", { business_uid: businessUID });
      } else {
        Alert.alert("Error", "Update failed. Try again.");
      }
    } catch (error) {
      // Handle 413 Payload Too Large
      if (error.response && error.response.status === 413) {
        Alert.alert("File Too Large", `The selected image (${(imageFileSize / 1024).toFixed(1)} KB) was too large to upload. Please select an image under 2MB.`);
        return;
      }
      console.error("Update Error:", error);
      let errorMsg = "Update failed. Please try again.";
      if (imageFileSize > 0) {
        errorMsg += ` (Image file size: ${(imageFileSize / 1024).toFixed(1)} KB)`;
      }
      Alert.alert("Error", errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // BUSINESS-SPECIFIC: renderField signature differs - has more parameters (key, placeholder, visibilityKey, keyboardType, maxLength, formatter)
  // EditProfileScreen renderField signature: (label, value, isPublic, fieldName, visibilityFieldName, editable = true)
  const renderField = (label, value, key, placeholder, visibilityKey = null, keyboardType = "default", maxLength = null, formatter = null) => (
    <View style={styles.fieldContainer}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, darkMode && styles.darkLabel]}>{label}</Text>
        {visibilityKey && (
          <TouchableOpacity onPress={() => handleToggleVisibility(visibilityKey)}>
            <Text style={{ color: formData[visibilityKey] ? (darkMode ? "#4CAF50" : "green") : darkMode ? "#FF6B6B" : "red" }}>{formData[visibilityKey] ? "Display" : "Hide"}</Text>
          </TouchableOpacity>
        )}
      </View>
      <TextInput
        style={[styles.input, darkMode && styles.darkInput]}
        value={value}
        placeholder={placeholder || label}
        placeholderTextColor={darkMode ? "#cccccc" : "#666"}
        keyboardType={keyboardType}
        maxLength={maxLength}
        onChangeText={(text) => {
          const formattedText = formatter ? formatter(text) : text;
          handleFieldChange(key, formattedText);
        }}
      />
    </View>
  );

  // MISSING: renderShortBioField function (EditProfileScreen has this with dynamic height)
  // Note: Business profile uses regular renderField for shortBio, could be enhanced to match EditProfileScreen

  // BUSINESS-SPECIFIC: renderSocialField function (EditProfileScreen doesn't have this - social links handled differently)
  const renderSocialField = (label, platform) => (
    <View style={styles.fieldContainer}>
      <Text style={[styles.label, darkMode && styles.darkLabel]}>{label}</Text>
      <TextInput
        style={[styles.input, darkMode && styles.darkInput]}
        value={formData.socialLinks[platform]}
        placeholder={`Enter ${platform} link`}
        placeholderTextColor={darkMode ? "#cccccc" : "#666"}
        onChangeText={(text) => {
          setFormData({
            ...formData,
            socialLinks: { ...formData.socialLinks, [platform]: text },
          });
          setIsChanged(true);
        }}
      />
    </View>
  );

  // BUSINESS-SPECIFIC: renderCustomTagsSection function (not in EditProfileScreen)
  const renderCustomTagsSection = () => (
    <View style={styles.fieldContainer}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, darkMode && styles.darkLabel]}>Custom Tags</Text>
        <TouchableOpacity onPress={addCustomTag}>
          <Text style={[styles.addText, darkMode && styles.darkAddText]}>+</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.tagInputContainer}>
        <TextInput
          style={[styles.input, { flex: 1, marginBottom: 0 }, darkMode && styles.darkInput]}
          value={customTagInput}
          placeholder='Add a custom tag'
          placeholderTextColor={darkMode ? "#cccccc" : "#666"}
          onChangeText={setCustomTagInput}
        />
      </View>
      <View style={styles.tagsContainer}>
        {(formData.customTags || []).map((tag, index) => (
          <View key={index} style={[styles.tagChip, darkMode && styles.darkTagChip]}>
            <Text style={[styles.tagText, darkMode && styles.darkTagText]}>{tag}</Text>
            <TouchableOpacity onPress={() => removeCustomTag(tag)}>
              <Text style={styles.removeTagText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );

  // Business Image Visibility Toggle Handler (identical to EditProfileScreen)
  const toggleBusinessImageVisibility = () => {
    setFormData((prev) => ({
      ...prev,
      imageIsPublic: !prev.imageIsPublic,
    }));
    setIsChanged(true);
  };

  // Business Image Section (identical to EditProfileScreen profile image section)
  const renderBusinessImageSection = () => (
    <View style={[styles.imageSection, darkMode && styles.darkImageSection]}>
      <Text style={[styles.label, darkMode && styles.darkLabel]}>Business Image</Text>
      <Image
        source={businessImageUri && !imageError ? { uri: businessImageUri } : DEFAULT_BUSINESS_IMAGE}
        style={[styles.profileImage, darkMode && styles.darkProfileImage]}
        tintColor={darkMode ? "#ffffff" : undefined}
        onError={handleImageError}
      />
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
        <TouchableOpacity onPress={toggleBusinessImageVisibility}>
          <Text style={[styles.toggleText, { fontWeight: "bold", color: formData.imageIsPublic ? (darkMode ? "#4ade80" : "green") : darkMode ? "#f87171" : "red" }]}>
            {formData.imageIsPublic ? "Display" : "Hide"}
          </Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={handlePickImage}>
        <Text style={[styles.uploadLink, darkMode && styles.darkUploadLink]}>Upload Image</Text>
      </TouchableOpacity>
      {/* Hidden file input for web */}
      {Platform.OS === "web" &&
        React.createElement("input", {
          ref: fileInputRef,
          type: "file",
          accept: "image/*",
          style: { display: "none" },
          onChange: handleWebImagePick,
        })}
    </View>
  );

  // BUSINESS-SPECIFIC: renderBusinessRoleField function (not in EditProfileScreen)
  const renderBusinessRoleField = () => (
    <View style={styles.fieldContainer}>
      <Text style={[styles.label, darkMode && styles.darkLabel]}>Business Role</Text>
      <Dropdown
        style={[styles.input, darkMode && styles.darkInput]}
        data={businessRoles}
        labelField='label'
        valueField='value'
        placeholder='Select your role'
        placeholderTextColor={darkMode ? "#ffffff" : "#666"}
        value={formData.businessRole}
        onChange={(item) => {
          setFormData({ ...formData, businessRole: item.value });
          setIsChanged(true);
        }}
        containerStyle={[{ borderRadius: 10 }, darkMode && { backgroundColor: "#1a1a1a", borderColor: "#404040" }]}
        itemTextStyle={{ color: darkMode ? "#ffffff" : "#000000" }}
        selectedTextStyle={{ color: darkMode ? "#ffffff" : "#000000" }}
        activeColor={darkMode ? "#404040" : "#f0f0f0"}
        itemContainerStyle={darkMode ? { backgroundColor: "#1a1a1a" } : {}}
        renderItem={(item, selected) => (
          <View style={[styles.dropdownItem, darkMode && styles.darkDropdownItem, selected && (darkMode ? styles.darkDropdownItemSelected : styles.dropdownItemSelected)]}>
            <Text style={[styles.dropdownItemText, darkMode && styles.darkDropdownItemText, selected && (darkMode ? styles.darkDropdownItemTextSelected : styles.dropdownItemTextSelected)]}>
              {item.label}
            </Text>
          </View>
        )}
      />
    </View>
  );

  // BUSINESS-SPECIFIC: previewBusiness object (EditProfileScreen has previewUser with more fields)
  const previewBusiness = {
    business_name: formData.name,
    tagline: formData.tagline,
    business_short_bio: formData.shortBio,
    business_phone_number: formData.phone,
    business_email: formData.email,
    business_email_id: formData.email,
    phoneIsPublic: formData.phoneIsPublic,
    emailIsPublic: formData.emailIsPublic,
    imageIsPublic: formData.imageIsPublic,
    // Include the business image - MiniCard checks first_image field
    first_image: businessImageUri || "",
  };

  // MISSING: toggleProfileImageVisibility function (EditProfileScreen has this)
  // Note: Business profile doesn't have single profile image visibility toggle

  // BUSINESS-SPECIFIC: Services state and management (EditProfileScreen uses formData.experience, formData.education, etc.)
  const [services, setServices] = useState(() => {
    const initialServices = business?.business_services || business?.services || [];
    return initialServices.map((service) => ({
      ...service,
      bs_uid: service.bs_uid || "",
      bs_tags: service.bs_tags || "",
    }));
  });

  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingServiceIndex, setEditingServiceIndex] = useState(null);

  const defaultService = {
    bs_uid: "",
    bs_service_name: "",
    bs_service_desc: "",
    bs_notes: "",
    bs_sku: "",
    bs_bounty: "",
    bs_bounty_currency: "USD",
    bs_is_taxable: 1,
    bs_tax_rate: "0",
    bs_discount_allowed: 1,
    bs_refund_policy: "",
    bs_return_window_days: "0",
    bs_display_order: 1,
    bs_tags: "",
    bs_duration_minutes: "",
    bs_cost: "",
    bs_cost_currency: "USD",
    bs_is_visible: 1,
    bs_status: "active",
    bs_image_key: "",
  };

  const [serviceForm, setServiceForm] = useState({ ...defaultService });

  const handleServiceChange = (field, value) => {
    setServiceForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddService = () => {
    if (!serviceForm.bs_service_name.trim()) {
      Alert.alert("Validation", "Product or Service name is required.");
      return;
    }

    if (editingServiceIndex !== null) {
      const updatedServices = [...services];
      const existingService = updatedServices[editingServiceIndex];
      updatedServices[editingServiceIndex] = {
        ...serviceForm,
        bs_uid: existingService.bs_uid,
      };
      setServices(updatedServices);
    } else {
      setServices((prev) => [
        ...prev,
        {
          ...defaultService,
          ...serviceForm,
          bs_uid: "",
        },
      ]);
    }

    setIsChanged(true);
    setServiceForm({ ...defaultService });
    setShowServiceForm(false);
    setEditingServiceIndex(null);
  };

  const handleEditService = (service, index) => {
    setServiceForm({
      ...defaultService,
      ...service,
      bs_uid: service.bs_uid || "",
      bs_tags: service.bs_tags || "",
    });
    setEditingServiceIndex(index);
    setShowServiceForm(true);
  };

  const handleCancelEdit = () => {
    setServiceForm({ ...defaultService });
    setShowServiceForm(false);
    setEditingServiceIndex(null);
  };

  // BUSINESS-SPECIFIC: Ownership check useEffect (EditProfileScreen doesn't have this)
  // Check if current user is owner/editor of the business
  useEffect(() => {
    const checkBusinessOwnership = async () => {
      try {
        if (business && business.business_user_id) {
          const currentUserUid = await AsyncStorage.getItem("user_uid");
          if (business.business_user_id === currentUserUid) {
            setIsOwner(true);
            return;
          }
        }

        const userUid = await AsyncStorage.getItem("user_uid");
        const profileUID = await AsyncStorage.getItem("profile_uid");
        if (!userUid && !profileUID) {
          setIsOwner(false);
          return;
        }

        let uidToUse = profileUID || userUid;
        const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${uidToUse}`);
        const userData = await response.json();

        if (userData && userData.business_info) {
          const businessInfo = typeof userData.business_info === "string" ? JSON.parse(userData.business_info) : userData.business_info;
          const isBusinessOwner = businessInfo.some((biz) => {
            return biz.business_uid === businessUID || biz.profile_business_business_id === businessUID;
          });
          setIsOwner(isBusinessOwner);
        } else {
          setIsOwner(false);
        }
      } catch (error) {
        console.error("EditBusinessProfileScreen - Error checking business ownership:", error);
        setIsOwner(false);
      }
    };

    if (business && businessUID) {
      checkBusinessOwnership();
    }
  }, [business, businessUID]);

  // Track the currently focused input
  const focusedInputRef = useRef(null);
  const keyboardHeightRef = useRef(0);

  // Function to scroll to a focused input
  const scrollToFocusedInput = () => {
    if (!focusedInputRef.current || !scrollViewRef.current) return;

    setTimeout(() => {
      try {
        const inputHandle = findNodeHandle(focusedInputRef.current);
        const scrollHandle = findNodeHandle(scrollViewRef.current);

        if (!inputHandle || !scrollHandle) return;

        UIManager.measureLayout(
          inputHandle,
          scrollHandle,
          (success) => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          },
          (x, y, width, height) => {
            const { Dimensions } = require("react-native");
            const screenHeight = Dimensions.get("window").height;
            const bottomNavBarHeight = 80;
            const keyboardHeight = keyboardHeightRef.current || 300;
            const availableHeight = screenHeight - keyboardHeight - bottomNavBarHeight;
            const inputBottom = y + height;
            const padding = 30;
            const targetScrollY = y - (availableHeight - height - padding);

            scrollViewRef.current?.scrollTo({
              y: Math.max(0, targetScrollY),
              animated: true,
            });
          }
        );
      } catch (error) {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    }, 200);
  };

  // Handle keyboard show/hide to scroll to focused input
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener("keyboardDidShow", (e) => {
      keyboardHeightRef.current = e.endCoordinates.height;
      scrollToFocusedInput();
    });

    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: darkMode ? "#1a1a1a" : "#ffffff" }}>
      <AppHeader title='Edit Business Profile' {...getHeaderColors("editBusinessProfile")} onBackPress={() => navigation.goBack()} />
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1, padding: 20, backgroundColor: darkMode ? "#1a1a1a" : "#ffffff" }}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={true}
      >
        {/* Business Image Upload Section (identical to EditProfileScreen profile image section) */}
        {renderBusinessImageSection()}

        {renderField("Business Name", formData.name, "name")}
        {renderField("Location", formData.location, "location")}
        {renderField("Address Line 2", formData.addressLine2, "addressLine2")}
        {renderField("City", formData.city, "city")}
        {renderField("State", formData.state, "state")}
        {renderField("Country", formData.country, "country")}
        {renderField("Zip Code", formData.zip, "zip")}
        {renderField("Phone Number", formData.phone, "phone", "", "phoneIsPublic")}
        {renderField("Email", formData.email, "email", "", "emailIsPublic")}
        {renderField("Business Category", formData.category, "category")}
        {renderField("Tag Line", formData.tagline, "tagline", "", "taglineIsPublic")}
        {renderField("Short Bio", formData.shortBio, "shortBio", "", "shortBioIsPublic")}
        {renderBusinessRoleField()}
        {renderField("EIN Number", formData.einNumber, "einNumber", "##-#######", null, "numeric", 10, formatEINNumber)}
        {renderField("Website", formData.website, "website")}

        {/* MISSING: renderField calls for First Name, Last Name (EditProfileScreen has these) */}
        {/* Note: Business profile doesn't have firstName/lastName fields */}

        {/* BUSINESS-SPECIFIC: Business Editors & Owners Section (not in EditProfileScreen) */}
        <View style={[styles.fieldContainer, darkMode && styles.darkFieldContainer]}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, darkMode && styles.darkLabel]}>Business Editors & Owners</Text>
            <TouchableOpacity onPress={addBusinessEditor}>
              <Text style={[styles.addText, darkMode && styles.darkAddText]}>+</Text>
            </TouchableOpacity>
          </View>
          {existingBusinessUsers.map((businessUser, index) => {
            const userForMiniCard = {
              firstName: businessUser.first_name || "",
              lastName: businessUser.last_name || "",
              email: businessUser.user_email || "",
              profileImage: businessUser.profile_photo || "",
              emailIsPublic: true,
              phoneIsPublic: false,
              phoneNumber: "",
            };

            const userRole = businessUser.business_role?.toLowerCase() || "";
            const canDelete = userRole === "employee" || userRole === "admin" || userRole === "other";

            return (
              <View key={businessUser.business_user_id || index} style={[styles.existingBusinessUserCard, darkMode && styles.darkExistingBusinessUserCard]}>
                <View style={styles.existingBusinessUserHeader}>
                  <View style={styles.existingBusinessUserInfo}>
                    <MiniCard user={userForMiniCard} />
                    <Text style={[styles.existingBusinessUserRole, darkMode && styles.darkExistingBusinessUserRole]}>Role: {businessUser.business_role || "N/A"}</Text>
                  </View>
                  {canDelete && (
                    <TouchableOpacity onPress={() => deleteExistingBusinessUser(businessUser)} style={[styles.deleteButton, darkMode && styles.darkDeleteButton]}>
                      <Text style={[styles.deleteButtonText, darkMode && styles.darkDeleteButtonText]}>🗑️</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
          {additionalBusinessUsers.map((user, index) => (
            <View key={index} style={[styles.businessEditorCard, darkMode && styles.darkBusinessEditorCard]}>
              <View style={styles.businessEditorHeader}>
                <Text style={[styles.businessEditorLabel, darkMode && styles.darkBusinessEditorLabel]}>Editor #{index + 1}</Text>
                <TouchableOpacity onPress={() => removeBusinessEditor(index)}>
                  <Text style={[styles.removeButtonText, darkMode && styles.darkRemoveButtonText]}>Remove</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.sublabel, darkMode && styles.darkSublabel]}>Email Address</Text>
              <TextInput
                style={[styles.input, darkMode && styles.darkInput]}
                value={user.email}
                placeholder='Enter email address'
                placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                keyboardType='email-address'
                autoCapitalize='none'
                onChangeText={(text) => updateBusinessEditor(index, "email", text)}
              />
              <Text style={[styles.sublabel, darkMode && styles.darkSublabel]}>Business Role</Text>
              <Dropdown
                style={[styles.input, darkMode && styles.darkInput]}
                data={businessRoles}
                labelField='label'
                valueField='value'
                placeholder='Select role'
                placeholderTextColor={darkMode ? "#ffffff" : "#666"}
                value={user.role}
                onChange={(item) => updateBusinessEditor(index, "role", item.value)}
                containerStyle={[{ borderRadius: 10, marginTop: 5 }, darkMode && { backgroundColor: "#1a1a1a", borderColor: "#404040" }]}
                itemTextStyle={{ color: darkMode ? "#ffffff" : "#000000" }}
                selectedTextStyle={{ color: darkMode ? "#ffffff" : "#000000" }}
                activeColor={darkMode ? "#404040" : "#f0f0f0"}
                itemContainerStyle={darkMode ? { backgroundColor: "#1a1a1a" } : {}}
                flatListProps={{
                  nestedScrollEnabled: true,
                }}
              />
            </View>
          ))}
        </View>

        {/* BUSINESS-SPECIFIC: Custom Tags Section (not in EditProfileScreen) */}
        {isOwner && renderCustomTagsSection()}

        {/* MiniCard Live Preview Section */}
        <View style={[styles.previewSection, darkMode && styles.darkPreviewSection]}>
          <Text style={[styles.label, darkMode && styles.darkLabel]}>Mini Card (how you'll appear in searches):</Text>
          <View style={[styles.previewCard, darkMode && styles.darkPreviewCard]}>
            <MiniCard key={`minicard-${imageUpdateKey}`} business={previewBusiness} />
          </View>
        </View>

        {/* MISSING: renderShortBioField() call (EditProfileScreen has this) */}
        {/* Note: Business profile uses regular renderField for shortBio */}

        {/* MISSING: ExperienceSection, EducationSection, ExpertiseSection, SeekingSection, BusinessSection components (EditProfileScreen has these) */}
        {/* Note: Business profile doesn't have these sections, uses Products & Services instead */}

        {/* BUSINESS-SPECIFIC: Social Links Section (EditProfileScreen doesn't have this section in edit) */}
        <Text style={[styles.label, darkMode && styles.darkLabel]}>Social Links</Text>
        {renderSocialField("Facebook", "facebook")}
        {renderSocialField("Instagram", "instagram")}
        {renderSocialField("LinkedIn", "linkedin")}
        {renderSocialField("YouTube", "youtube")}

        {/* BUSINESS-SPECIFIC: Products & Services Section (EditProfileScreen has ExperienceSection, EducationSection, etc.) */}
        <View style={styles.fieldContainer}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, darkMode && styles.darkLabel]}>Products & Services</Text>
            {!showServiceForm && (
              <TouchableOpacity
                onPress={() => {
                  setServiceForm({ ...defaultService });
                  setEditingServiceIndex(null);
                  setShowServiceForm(true);
                }}
              >
                <Text style={[styles.addText, darkMode && styles.darkAddText]}>+</Text>
              </TouchableOpacity>
            )}
          </View>
          {services.length === 0 && <Text style={[styles.noServicesText, darkMode && styles.darkNoServicesText]}>No products or services added yet.</Text>}
          {services.map((service, idx) => (
            <ProductCard key={idx} service={service} onEdit={() => handleEditService(service, idx)} showEditButton={true} />
          ))}
          {showServiceForm && (
            <View style={[styles.serviceFormContainer, darkMode && styles.darkServiceFormContainer]}>
              <Text style={[styles.formTitle, darkMode && styles.darkFormTitle]}>{editingServiceIndex !== null ? "Edit Product/Service" : "Add New Product/Service"}</Text>
              <TextInput
                style={[styles.input, darkMode && styles.darkInput]}
                value={serviceForm.bs_service_name}
                onChangeText={(t) => handleServiceChange("bs_service_name", t)}
                placeholder='Product or Service Name'
                placeholderTextColor={darkMode ? "#cccccc" : "#666"}
              />
              <TextInput
                style={[styles.input, darkMode && styles.darkInput]}
                value={serviceForm.bs_service_desc}
                onChangeText={(t) => handleServiceChange("bs_service_desc", t)}
                placeholder='Description'
                placeholderTextColor={darkMode ? "#cccccc" : "#666"}
              />
              <TextInput
                style={[styles.input, darkMode && styles.darkInput]}
                value={serviceForm.bs_cost}
                onChangeText={(t) => handleServiceChange("bs_cost", t)}
                placeholder='Cost (e.g. 25.00)'
                keyboardType='decimal-pad'
                placeholderTextColor={darkMode ? "#cccccc" : "#666"}
              />
              <TextInput
                style={styles.input}
                value={serviceForm.bs_cost_currency}
                onChangeText={(t) => handleServiceChange("bs_cost_currency", t)}
                placeholder='Currency (e.g. USD)'
                placeholderTextColor={darkMode ? "#cccccc" : "#666"}
              />
              <TextInput
                style={[styles.input, darkMode && styles.darkInput]}
                value={serviceForm.bs_bounty}
                onChangeText={(t) => handleServiceChange("bs_bounty", t)}
                placeholder='Bounty (e.g. 10.00)'
                keyboardType='decimal-pad'
                placeholderTextColor={darkMode ? "#cccccc" : "#666"}
              />
              <TextInput
                style={styles.input}
                value={serviceForm.bs_bounty_currency}
                onChangeText={(t) => handleServiceChange("bs_bounty_currency", t)}
                placeholder='Bounty Currency (e.g. USD)'
                placeholderTextColor={darkMode ? "#cccccc" : "#666"}
              />
              <TextInput
                style={[styles.input, darkMode && styles.darkInput]}
                value={serviceForm.bs_tags}
                onChangeText={(t) => handleServiceChange("bs_tags", t)}
                placeholder='Tags (comma separated, e.g. Suit, Men)'
                placeholderTextColor={darkMode ? "#cccccc" : "#666"}
              />
              <View style={styles.formButtons}>
                <TouchableOpacity style={[styles.formButton, styles.cancelButton, darkMode && styles.darkCancelButton]} onPress={handleCancelEdit}>
                  <Text style={[styles.cancelButtonText, darkMode && styles.darkCancelButtonText]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formButton, styles.addButton]} onPress={handleAddService}>
                  <Text style={styles.addButtonText}>{editingServiceIndex !== null ? "Update" : "Add"} Product/Service</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, (!isValid || !isChanged) && (darkMode ? styles.darkDisabledButton : styles.saveButtonDisabled), darkMode && styles.darkSaveButton]}
          onPress={handleSave}
          disabled={!isValid || !isChanged || isLoading}
        >
          {isLoading ? <ActivityIndicator size='small' color={darkMode ? "#ffffff" : "#fff"} /> : <Text style={[styles.saveButtonText, (!isValid || !isChanged) && styles.saveButtonTextDisabled, darkMode && styles.darkSaveText]}>Submit</Text>}
        </TouchableOpacity>
      </ScrollView>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10 }}>
        <BottomNavBar navigation={navigation} />
      </View>
      {/* MISSING: Business Approval Modal (EditProfileScreen has this) */}
      {/* Note: Not needed for business profile editing */}
    </View>
  );
};

const styles = StyleSheet.create({
  pageContainer: { flex: 1, backgroundColor: "#fff", minHeight: "100%" },
  container: { flex: 1, padding: 20, minHeight: "100%" },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  fieldContainer: { marginBottom: 15 },
  label: { fontSize: 16, fontWeight: "bold", marginBottom: 5, color: "#000" },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 5, backgroundColor: "#fff" },
  // MISSING: textarea style (EditProfileScreen has this)
  // MISSING: disabledInput style (EditProfileScreen has this)
  saveButton: {
    backgroundColor: "#800000",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginVertical: 20,
  },
  saveButtonDisabled: {
    backgroundColor: "#999",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  saveButtonTextDisabled: {
    color: "#ccc",
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "500",
  },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  imageSection: { alignItems: "center", marginBottom: 20 },
  profileImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 10, backgroundColor: "#eee" },
  uploadLink: { color: "#007AFF", textDecorationLine: "underline", marginBottom: 10 },
  previewSection: { marginBottom: 20 },
  previewCard: { padding: 10, borderWidth: 1, borderColor: "#ccc", borderRadius: 5 },
  // BUSINESS-SPECIFIC: Additional styles for business-specific features
  tagInputContainer: { flexDirection: "row", alignItems: "center" },
  addTagButton: {
    backgroundColor: "#00C721",
    padding: 10,
    borderRadius: 5,
  },
  addTagButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 5,
  },
  tagChip: {
    backgroundColor: "#f0f0f0",
    padding: 8,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  tagText: {
    fontSize: 14,
    marginRight: 5,
  },
  removeTagText: {
    color: "red",
    fontSize: 18,
    fontWeight: "bold",
  },
  imageScroll: {
    marginTop: 10,
    height: 120,
  },
  imageRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  imageWrapper: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: "hidden",
    marginRight: 10,
    backgroundColor: "#fff",
    position: "relative",
  },
  businessImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },
  deleteIcon: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#ff3b30",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  deleteText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  addImageButton: {
    backgroundColor: "#00C721",
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
  },
  addImageButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  formButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  formButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  addButton: {
    backgroundColor: "#00C721",
  },
  cancelButtonText: {
    color: "#666",
    textAlign: "center",
    fontWeight: "bold",
  },
  addButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  noServicesText: {
    color: "#888",
    textAlign: "center",
  },
  serviceFormContainer: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  businessEditorCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  businessEditorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  businessEditorLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  removeButtonText: {
    color: "#ff3b30",
    fontSize: 14,
    fontWeight: "600",
  },
  sublabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    marginTop: 10,
    marginBottom: 5,
  },
  addEditorButton: {
    backgroundColor: "#00C721",
    padding: 10,
    borderRadius: 8,
    marginLeft: 10,
  },
  addEditorButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  existingBusinessUserCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  existingBusinessUserHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  existingBusinessUserInfo: {
    flex: 1,
  },
  existingBusinessUserRole: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    fontStyle: "italic",
  },
  deleteButton: {
    padding: 8,
    marginLeft: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: 20,
  },
  addText: { fontSize: 24, fontWeight: "bold", color: "#000" },
  contentContainer: { padding: 20, paddingBottom: 120 },

  // Dark mode styles
  darkPageContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkContainer: {
    backgroundColor: "#1a1a1a",
    padding: 20,
  },
  darkHeader: {
    color: "#ffffff",
  },
  darkLabel: {
    color: "#ffffff",
  },
  darkInput: {
    backgroundColor: "#2d2d2d",
    color: "#ffffff",
    borderColor: "#404040",
  },
  darkProfileImage: {
    // tintColor moved to Image prop
    tintColor: "#ffffff",
    backgroundColor: "#404040",
  },
  darkUploadLink: {
    color: "#4a9eff",
  },
  darkPreviewCard: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  // MISSING: darkDisabledInput style (EditProfileScreen has this)
  darkSaveButton: {
    backgroundColor: "#660000",
  },
  darkSaveText: {
    color: "#ffffff",
  },
  darkPreviewSection: {
    backgroundColor: "#1a1a1a",
  },
  darkDisabledButton: {
    backgroundColor: "#404040",
  },
  darkImageSection: {
    backgroundColor: "#1a1a1a",
  },
  darkFieldContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkAddEditorButton: {
    backgroundColor: "#00C721",
  },
  darkAddEditorButtonText: {
    color: "#ffffff",
  },
  darkBusinessEditorCard: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  darkBusinessEditorLabel: {
    color: "#ffffff",
  },
  darkRemoveButtonText: {
    color: "#ff6b6b",
  },
  darkSublabel: {
    color: "#cccccc",
  },
  darkExistingBusinessUserCard: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  darkExistingBusinessUserRole: {
    color: "#cccccc",
  },
  darkDeleteButton: {
    // No special styling needed for dark mode
  },
  darkDeleteButtonText: {
    // No special styling needed for dark mode
  },
  darkAddText: {
    color: "#ffffff",
  },
  darkNoServicesText: {
    color: "#cccccc",
  },
  darkServiceFormContainer: {
    backgroundColor: "#404040",
  },
  darkFormTitle: {
    color: "#ffffff",
  },
  darkCancelButton: {
    backgroundColor: "#404040",
  },
  darkCancelButtonText: {
    color: "#cccccc",
  },
  darkTagChip: {
    backgroundColor: "#404040",
  },
  darkTagText: {
    color: "#ffffff",
  },
  darkImageWrapper: {
    backgroundColor: "#404040",
  },

  // Dropdown styles
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  dropdownItemSelected: {
    backgroundColor: "#f0f0f0",
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#000000",
  },
  dropdownItemTextSelected: {
    fontWeight: "bold",
  },

  // Dark mode dropdown styles
  darkDropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
    backgroundColor: "#1a1a1a",
  },
  darkDropdownItemSelected: {
    backgroundColor: "#404040",
  },
  darkDropdownItemText: {
    fontSize: 16,
    color: "#ffffff",
  },
  darkDropdownItemTextSelected: {
    fontWeight: "bold",
    color: "#ffffff",
  },
  // MISSING: modalContainer, modalText, modalButton, modalButtonText, darkModalContainer, darkModalText, darkModalButton, darkModalButtonText styles (EditProfileScreen has these)
  // Note: Business profile doesn't have business approval modal
});

export default EditBusinessProfileScreen;
