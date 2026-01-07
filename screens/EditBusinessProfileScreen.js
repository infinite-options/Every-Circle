import React, { useState, useRef, useEffect, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, Image, Keyboard, UIManager, findNodeHandle } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Dropdown } from "react-native-element-dropdown";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MiniCard from "../components/MiniCard";
import BottomNavBar from "../components/BottomNavBar";
import ProductCard from "../components/ProductCard";
import { BUSINESS_INFO_ENDPOINT, USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";
import { useDarkMode } from "../contexts/DarkModeContext";
import AppHeader from "../components/AppHeader";
import { getHeaderColors } from "../config/headerColors";

const BusinessProfileAPI = BUSINESS_INFO_ENDPOINT;

export default function EditBusinessProfileScreen({ route, navigation }) {
  const { darkMode } = useDarkMode();
  // console.log("Edit Button Pressed: EditBusinessProfileScreen", route.params.business);
  const { business, business_users } = route.params || {};
  const [businessUID, setBusinessUID] = useState(business?.business_uid || "");
  const scrollViewRef = useRef(null);

  const [formData, setFormData] = useState({
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
    images: Array.isArray(business?.images) ? business.images : [],
    businessGooglePhotos: Array.isArray(business?.businessGooglePhotos) ? business.businessGooglePhotos : [],
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
  });

  // Validation state - computed after formData is initialized
  const isValid = useMemo(() => {
    return formData.name.trim() && businessUID.trim();
  }, [formData.name, businessUID]);

  const [customTagInput, setCustomTagInput] = useState("");
  const [additionalBusinessUsers, setAdditionalBusinessUsers] = useState([]);
  const [existingBusinessUsers, setExistingBusinessUsers] = useState(Array.isArray(business_users) ? business_users : []);
  const [deletedBusinessUsers, setDeletedBusinessUsers] = useState([]);
  const [isOwner, setIsOwner] = useState(false);

  const businessRoles = [
    { label: "Owner", value: "owner" },
    { label: "Employee", value: "employee" },
    { label: "Partner", value: "partner" },
    { label: "Admin", value: "admin" },
    { label: "Other", value: "other" },
  ];

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
    setFormData((prev) => ({ ...prev, [fieldName]: !prev[fieldName] }));
  };

  const addBusinessEditor = () => {
    setAdditionalBusinessUsers([...additionalBusinessUsers, { email: "", role: "" }]);
  };

  const removeBusinessEditor = (index) => {
    const updated = additionalBusinessUsers.filter((_, i) => i !== index);
    setAdditionalBusinessUsers(updated);
  };

  const updateBusinessEditor = (index, field, value) => {
    const updated = [...additionalBusinessUsers];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalBusinessUsers(updated);
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
        },
      },
    ]);
  };

  const handleSave = async () => {
    console.log("Save Button Pressed: handleSave");
    if (!formData.name.trim() || !businessUID.trim()) {
      Alert.alert("Error", "Business name and ID are required.");
      return;
    }

    try {
      // Retrieve user_uid from AsyncStorage
      const userUid = await AsyncStorage.getItem("user_uid");
      if (!userUid) {
        Alert.alert("Error", "User UID not found. Please log in again.");
        return;
      }

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
      payload.append("user_uid", userUid);
      payload.append("business_uid", businessUID);
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

      // Separate images: existing S3 URLs vs new local files to upload
      // Only include images that are currently in formData.images (deleted ones are already removed)
      const allImages = (formData.images || []).filter((img) => img && typeof img === "string" && img.trim() !== "");
      const existingS3Urls = [];
      const newLocalFiles = [];

      console.log("🔍 All images in formData.images:", allImages);

      allImages.forEach((imageUri) => {
        if (imageUri && typeof imageUri === "string") {
          // Check if it's already an S3 URL (existing uploaded image)
          if (imageUri.startsWith("https://") || imageUri.startsWith("http://")) {
            existingS3Urls.push(imageUri);
          }
          // Check if it's a new local file that needs to be uploaded
          else if (imageUri.startsWith("file://") || imageUri.startsWith("content://")) {
            newLocalFiles.push(imageUri);
          }
        }
      });

      console.log("📸 Existing S3 URLs:", existingS3Urls);
      console.log("📁 New local files to upload:", newLocalFiles);

      // Append Google images as URLs (if any - these are separate from user-uploaded)
      // For now, keep existing Google photos separate
      const googleImages = formData.businessGooglePhotos || [];
      if (googleImages.length > 0) {
        payload.append("business_google_photos", JSON.stringify(googleImages));
      }

      // Append new user-uploaded images as files and collect their filenames
      const userImageFilenames = [];
      newLocalFiles.forEach((imageUri, index) => {
        if (imageUri && (imageUri.startsWith("file://") || imageUri.startsWith("content://"))) {
          const uriParts = imageUri.split(".");
          const fileType = uriParts[uriParts.length - 1] || "jpg";
          const fileName = `business_img_${index}_${Date.now()}.${fileType}`;
          userImageFilenames.push(fileName);
          // Backend expects business_img_0, business_img_1, etc.
          payload.append(`business_img_${index}`, {
            uri: imageUri,
            type: `image/${fileType}`,
            name: fileName,
          });
        }
      });

      // Combine existing S3 URLs with new filenames (new ones will be uploaded and converted to S3 URLs by backend)
      // For existing URLs, extract just the filename from the full URL
      const existingFilenames = existingS3Urls.map((url) => {
        // Extract filename from S3 URL: https://s3-.../business_personal/UID/filename
        const parts = url.split("/");
        const filename = parts[parts.length - 1];
        console.log(`📝 Extracted filename from ${url}: ${filename}`);
        return filename;
      });

      // Combine existing filenames with new filenames
      // Only include images that are currently in formData.images (deleted ones are excluded)
      const allImageFilenames = [...existingFilenames, ...userImageFilenames];

      console.log("📋 Final image filenames to send:", allImageFilenames);

      // Always send business_images_url, even if empty (to signal deletion)
      payload.append("business_images_url", JSON.stringify(allImageFilenames));

      payload.append("social_links", JSON.stringify(formData.socialLinks));
      payload.append("business_email_id_is_public", formData.emailIsPublic ? "1" : "0");
      payload.append("business_phone_number_is_public", formData.phoneIsPublic ? "1" : "0");
      payload.append("business_tag_line_is_public", formData.taglineIsPublic ? "1" : "0");
      payload.append("business_short_bio_is_public", formData.shortBioIsPublic ? "1" : "0");

      const cleanLinks = {};
      ["facebook", "instagram", "linkedin", "youtube"].forEach((platform) => {
        if (formData.socialLinks[platform]) {
          cleanLinks[platform] = formData.socialLinks[platform];
        }
      });

      const fullServiceSchema = (service, idx) => {
        // Create base schema without bs_uid
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

        // Only include bs_uid if it exists and is not empty
        if (service.bs_uid && service.bs_uid.trim() !== "") {
          return {
            ...baseSchema,
            bs_uid: service.bs_uid,
          };
        }

        return baseSchema;
      };

      const servicesToSend = services.map(fullServiceSchema);
      console.log(
        "Services being sent to backend:",
        servicesToSend.map((s) => ({
          name: s.bs_service_name,
          bs_uid: s.bs_uid || "not included",
        }))
      );
      payload.append("business_services", JSON.stringify(servicesToSend));

      // Combine existing business users (excluding deleted ones) with new users
      const remainingExistingUsers = existingBusinessUsers.filter((user) => !deletedBusinessUsers.includes(user.business_user_id));

      // Get emails and roles from existing users
      const existingEmails = remainingExistingUsers.map((user) => user.user_email || "").filter((email) => email);
      const existingRoles = remainingExistingUsers.map((user) => user.business_role || "").filter((role) => role);

      // Get emails and roles from new users
      const validNewUsers = additionalBusinessUsers.filter((user) => user.email.trim() && user.role);
      const newEmails = validNewUsers.map((user) => user.email.trim());
      const newRoles = validNewUsers.map((user) => user.role);

      // Combine existing and new users into single arrays
      const allEmails = [...existingEmails, ...newEmails];
      const allRoles = [...existingRoles, ...newRoles];

      // Send all users (existing + new) in additional_business_user and additional_business_role
      if (allEmails.length > 0 && allRoles.length > 0) {
        payload.append("additional_business_user", JSON.stringify(allEmails));
        payload.append("additional_business_role", JSON.stringify(allRoles));
        console.log("All business users (existing + new):", allEmails);
        console.log("All business roles (existing + new):", allRoles);
      }

      // ============================================
      // CONSOLE LOGS FOR DEBUGGING / POSTMAN TESTING
      // ============================================
      console.log("============================================");
      console.log("📡 BUSINESS INFO API REQUEST (PUT)");
      console.log("============================================");
      console.log("🔗 ENDPOINT:", BusinessProfileAPI);
      console.log("📝 METHOD: PUT");
      console.log("============================================");
      console.log("📦 FORM DATA (Key-Value Pairs for Postman):");
      console.log("============================================");

      // Collect all FormData entries and format for Postman
      const formDataEntries = [];
      for (let pair of payload.entries()) {
        const [key, value] = pair;
        // Skip file objects to avoid logging large binary data
        if (typeof value === "object" && value?.uri) {
          formDataEntries.push([key, `[FILE] ${value.name || "image"}`]);
        } else {
          formDataEntries.push([key, value]);
        }
      }

      // Log in Postman-friendly format (key:value)
      formDataEntries.forEach(([key, value]) => {
        const displayValue = typeof value === "object" ? JSON.stringify(value) : String(value);
        console.log(`${key}:${displayValue}`);
      });

      console.log("============================================");

      const response = await axios.put(`${BusinessProfileAPI}`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.status === 200) {
        Alert.alert("Success", "Business profile updated.");
        navigation.navigate("BusinessProfile", { business_uid: businessUID });
      } else {
        Alert.alert("Error", "Update failed. Try again.");
      }
    } catch (error) {
      // Handle 413 Payload Too Large
      if (error.response && error.response.status === 413) {
        Alert.alert("File Too Large", `One or more images were too large to upload (total size: ${(newTotal / 1024).toFixed(1)} KB). Please select images under 2MB.`);
        return;
      }
      console.error("Save error:", error);
      Alert.alert("Error", "Something went wrong.");
    }
  };

  const addCustomTag = () => {
    if (customTagInput.trim() && !(formData.customTags || []).includes(customTagInput.trim())) {
      const updatedTags = [...(formData.customTags || []), customTagInput.trim()];
      setFormData({ ...formData, customTags: updatedTags });
      setCustomTagInput("");
    }
  };

  const removeCustomTag = (tagToRemove) => {
    const updatedTags = (formData.customTags || []).filter((tag) => tag !== tagToRemove);
    setFormData({ ...formData, customTags: updatedTags });
  };

  const handleImagePick = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      // Calculate total size of current images (if any have fileSize info)
      let currentTotal = 0;
      // If images are local files, we can't get their size here, so we only check new ones
      // If you want to enforce stricter checks, you could store fileSize in state for each image

      // Calculate total size of new images
      let newTotal = 0;
      let newImages = [];
      for (const asset of result.assets) {
        if (asset.fileSize) {
          newTotal += asset.fileSize;
        }
        newImages.push(asset.uri);
      }
      // 2MB = 2 * 1024 * 1024 = 2,097,152 bytes
      const MAX_SIZE = 2 * 1024 * 1024;
      if (newTotal > MAX_SIZE) {
        Alert.alert("File not selectable", `Total image size (${(newTotal / 1024).toFixed(1)} KB) will exceed the 2MB upload limit.`);
        return;
      }
      const currentImages = formData.images || [];
      setFormData({ ...formData, images: [...currentImages, ...newImages] });
    }
  };

  const removeImage = (indexToRemove) => {
    const updatedImages = (formData.images || []).filter((_, index) => index !== indexToRemove);
    console.log(`🗑️ Removing image at index ${indexToRemove}`);
    console.log(`📸 Images before removal:`, formData.images);
    console.log(`📸 Images after removal:`, updatedImages);
    setFormData({ ...formData, images: updatedImages });
  };

  const renderField = (label, value, key, placeholder, visibilityKey = null, keyboardType = "default", maxLength = null, formatter = null) => (
    <View style={styles.fieldContainer}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, darkMode && styles.darkLabel]}>{label}</Text>
        {visibilityKey && (
          <TouchableOpacity onPress={() => toggleVisibility(visibilityKey)}>
            <Text style={{ color: formData[visibilityKey] ? (darkMode ? "#4CAF50" : "green") : darkMode ? "#FF6B6B" : "red" }}>{formData[visibilityKey] ? "Public" : "Private"}</Text>
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
          setFormData({ ...formData, [key]: formattedText });
        }}
      />
    </View>
  );

  const renderSocialField = (label, platform) => (
    <View style={styles.fieldContainer}>
      <Text style={[styles.label, darkMode && styles.darkLabel]}>{label}</Text>
      <TextInput
        style={[styles.input, darkMode && styles.darkInput]}
        value={formData.socialLinks[platform]}
        placeholder={`Enter ${platform} link`}
        placeholderTextColor={darkMode ? "#cccccc" : "#666"}
        onChangeText={(text) =>
          setFormData({
            ...formData,
            socialLinks: { ...formData.socialLinks, [platform]: text },
          })
        }
      />
    </View>
  );

  const previewBusiness = {
    business_name: formData.name,
    tagline: formData.tagline,
    business_short_bio: formData.shortBio,
    business_phone_number: formData.phone,
    business_email: formData.email,
    business_email_id: formData.email,
    phoneIsPublic: formData.phoneIsPublic,
    emailIsPublic: formData.emailIsPublic,
  };

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

  const renderImagesSection = () => (
    <View style={styles.fieldContainer}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, darkMode && styles.darkLabel]}>Business Images</Text>
        <TouchableOpacity onPress={handleImagePick}>
          <Text style={[styles.addText, darkMode && styles.darkAddText]}>+</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
        <View style={styles.imageRow}>
          {(formData.images || []).map((imageUri, index) => (
            <View key={index} style={[styles.imageWrapper, darkMode && styles.darkImageWrapper]}>
              <Image source={{ uri: imageUri }} style={styles.businessImage} resizeMode='cover' />
              <TouchableOpacity style={styles.deleteIcon} onPress={() => removeImage(index)}>
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );

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
        onChange={(item) => setFormData({ ...formData, businessRole: item.value })}
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

  const [services, setServices] = useState(() => {
    // Initialize services with proper bs_uid preservation
    const initialServices = business?.business_services || business?.services || [];
    console.log(
      "Initial services with bs_uid and bs_tags:",
      initialServices.map((s) => ({ name: s.bs_service_name, bs_uid: s.bs_uid, bs_tags: s.bs_tags }))
    );
    return initialServices.map((service) => ({
      // ...defaultService,  //Commented out so businesses with services can be edited.  Not sure if other defaultService line work?
      ...service,
      bs_uid: service.bs_uid || "", // Ensure bs_uid is preserved
      bs_tags: service.bs_tags || "", // Ensure bs_tags is preserved
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
      // Update existing service - preserve the bs_uid
      const updatedServices = [...services];
      const existingService = updatedServices[editingServiceIndex];
      console.log("Editing existing service with bs_uid:", existingService.bs_uid);
      updatedServices[editingServiceIndex] = {
        ...serviceForm,
        bs_uid: existingService.bs_uid, // Preserve the original bs_uid
      };
      setServices(updatedServices);
    } else {
      // Add new service - explicitly set bs_uid to empty string
      console.log("Adding new service - no bs_uid");
      setServices((prev) => [
        ...prev,
        {
          ...defaultService,
          ...serviceForm,
          bs_uid: "", // Explicitly set empty bs_uid for new services
        },
      ]);
    }

    // Reset form and state
    setServiceForm({ ...defaultService });
    setShowServiceForm(false);
    setEditingServiceIndex(null);
  };

  const handleEditService = (service, index) => {
    console.log("Editing service with bs_uid:", service.bs_uid, "bs_tags:", service.bs_tags);
    // When editing, make sure to include the bs_uid and bs_tags in the form
    setServiceForm({
      ...defaultService,
      ...service,
      bs_uid: service.bs_uid || "", // Ensure bs_uid is preserved, default to empty string if missing
      bs_tags: service.bs_tags || "", // Ensure bs_tags is preserved, default to empty string if missing
    });
    setEditingServiceIndex(index);
    setShowServiceForm(true);
  };

  const handleCancelEdit = () => {
    setServiceForm({ ...defaultService });
    setShowServiceForm(false);
    setEditingServiceIndex(null);
  };

  // Check if current user is owner/editor of the business (same logic as BusinessProfileScreen)
  useEffect(() => {
    const checkBusinessOwnership = async () => {
      try {
        // Method 1: Check business_user_id directly from business object (most reliable)
        if (business && business.business_user_id) {
          const currentUserUid = await AsyncStorage.getItem("user_uid");
          console.log("EditBusinessProfileScreen - Checking ownership via business_user_id:");
          console.log("  - business.business_user_id:", business.business_user_id);
          console.log("  - currentUserUid:", currentUserUid);

          if (business.business_user_id === currentUserUid) {
            console.log("EditBusinessProfileScreen - User is owner (via business_user_id match)");
            setIsOwner(true);
            return;
          }
        }

        // Method 2: Check via user profile business_info array (fallback)
        const userUid = await AsyncStorage.getItem("user_uid");
        const profileUID = await AsyncStorage.getItem("profile_uid");
        console.log("EditBusinessProfileScreen - Checking ownership via profile business_info:");

        if (!userUid && !profileUID) {
          console.log("EditBusinessProfileScreen - No user/profile UID found");
          setIsOwner(false);
          return;
        }

        // Try with profile_uid first (more accurate)
        let uidToUse = profileUID || userUid;
        const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${uidToUse}`);
        const userData = await response.json();

        if (userData && userData.business_info) {
          const businessInfo = typeof userData.business_info === "string" ? JSON.parse(userData.business_info) : userData.business_info;
          const isBusinessOwner = businessInfo.some((biz) => {
            const matches = biz.business_uid === businessUID || biz.profile_business_business_id === businessUID;
            return matches;
          });

          console.log("EditBusinessProfileScreen - isBusinessOwner result:", isBusinessOwner);
          setIsOwner(isBusinessOwner);
        } else {
          console.log("EditBusinessProfileScreen - No business_info in user profile");
          setIsOwner(false);
        }
      } catch (error) {
        console.error("EditBusinessProfileScreen - Error checking business ownership:", error);
        setIsOwner(false);
      }
    };

    // Only check ownership if we have business data
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

    // Small delay to ensure keyboard is fully shown and layout is updated
    setTimeout(() => {
      try {
        const inputHandle = findNodeHandle(focusedInputRef.current);
        const scrollHandle = findNodeHandle(scrollViewRef.current);

        if (!inputHandle || !scrollHandle) return;

        UIManager.measureLayout(
          inputHandle,
          scrollHandle,
          (success) => {
            // Input is not a child of ScrollView, try alternative approach
            scrollViewRef.current?.scrollToEnd({ animated: true });
          },
          (x, y, width, height) => {
            // y is the input's top position relative to ScrollView content
            const { Dimensions } = require("react-native");
            const screenHeight = Dimensions.get("window").height;
            const bottomNavBarHeight = 80; // Approximate height of bottom nav bar
            const keyboardHeight = keyboardHeightRef.current || 300;

            // Calculate how much space is available above the keyboard
            const availableHeight = screenHeight - keyboardHeight - bottomNavBarHeight;

            // The input's bottom position in content coordinates
            const inputBottom = y + height;

            // We want to scroll so the input is visible above the keyboard with some padding
            const padding = 30; // Padding above the input

            // Calculate target scroll position: position input so it's visible above keyboard
            // We want the input to be positioned at (availableHeight - input height - padding) from top
            // So we scroll to: input's y position minus (availableHeight - height - padding)
            const targetScrollY = y - (availableHeight - height - padding);

            scrollViewRef.current?.scrollTo({
              y: Math.max(0, targetScrollY),
              animated: true,
            });
          }
        );
      } catch (error) {
        // Fallback: scroll to end
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
    <View style={[styles.pageContainer, darkMode && styles.darkPageContainer]}>
      <AppHeader title='Edit Business Profile' {...getHeaderColors("editBusinessProfile")} onBackPress={() => navigation.goBack()} />
      <ScrollView
        ref={scrollViewRef}
        style={[styles.container, darkMode && styles.darkContainer]}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 100 }]}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={true}
      >
        {renderField("Business Name", formData.name, "name")}
        {renderField("Phone Number", formData.phone, "phone", "", "phoneIsPublic")}
        {renderField("Email", formData.email, "email", "", "emailIsPublic")}
        {renderField("Location", formData.location, "location")}
        {renderField("Address Line 2", formData.addressLine2, "addressLine2")}
        {renderField("City", formData.city, "city")}
        {renderField("State", formData.state, "state")}
        {renderField("Zip Code", formData.zip, "zip")}
        {renderField("Country", formData.country, "country")}
        {renderField("Tag Line", formData.tagline, "tagline", "", "taglineIsPublic")}
        {renderField("Short Bio", formData.shortBio, "shortBio", "", "shortBioIsPublic")}
        {renderField("Business Category", formData.category, "category")}
        {renderBusinessRoleField()}
        {renderField("EIN Number", formData.einNumber, "einNumber", "##-#######", null, "numeric", 10, formatEINNumber)}
        {renderField("Website", formData.website, "website")}

        {/* Business Editors & Owners Section */}
        <View style={[styles.fieldContainer, darkMode && styles.darkFieldContainer]}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, darkMode && styles.darkLabel]}>Business Editors & Owners</Text>
            <TouchableOpacity onPress={addBusinessEditor}>
              <Text style={[styles.addText, darkMode && styles.darkAddText]}>+</Text>
            </TouchableOpacity>
          </View>
          {existingBusinessUsers.map((businessUser, index) => {
            // Format user data for MiniCard component
            const userForMiniCard = {
              firstName: businessUser.first_name || "",
              lastName: businessUser.last_name || "",
              email: businessUser.user_email || "",
              profileImage: businessUser.profile_photo || "",
              emailIsPublic: true,
              phoneIsPublic: false,
              phoneNumber: "",
            };

            // Check if current user can delete this user
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

        {isOwner && renderCustomTagsSection()}

        <View style={[styles.previewSection, darkMode && styles.darkPreviewSection]}>
          <Text style={[styles.label, darkMode && styles.darkLabel]}>MiniCard Preview:</Text>
          <MiniCard business={previewBusiness} />
        </View>

        <Text style={[styles.label, darkMode && styles.darkLabel]}>Social Links</Text>
        {renderSocialField("Facebook", "facebook")}
        {renderSocialField("Instagram", "instagram")}
        {renderSocialField("LinkedIn", "linkedin")}
        {renderSocialField("YouTube", "youtube")}

        {renderImagesSection()}

        {/* Products & Services Section */}
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

        <TouchableOpacity style={[styles.saveButton, !isValid && styles.saveButtonDisabled]} onPress={handleSave} disabled={!isValid}>
          <Text style={[styles.saveButtonText, !isValid && styles.saveButtonTextDisabled]}>Submit</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNavBar navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 120 },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  fieldContainer: { marginBottom: 15 },
  label: { fontSize: 16, fontWeight: "bold", marginBottom: 5 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  addText: { fontSize: 24, fontWeight: "bold", color: "#000" },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 5 },
  saveButton: {
    backgroundColor: "#800000",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 30,
    marginBottom: 20,
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
  previewSection: {
    marginVertical: 20,
    backgroundColor: "#f5f5f5",
    padding: 10,
    borderRadius: 8,
  },
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

  // Missing styles that were referenced
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

  // Dark mode styles
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
  darkPageContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkHeader: {
    color: "#ffffff",
  },
  darkLabel: {
    color: "#ffffff",
  },
  darkAddText: {
    color: "#ffffff",
  },
  darkInput: {
    backgroundColor: "#2d2d2d",
    color: "#ffffff",
    borderColor: "#404040",
  },
  darkPreviewSection: {
    backgroundColor: "#404040",
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
});