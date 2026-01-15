//EditProfileScreen.js
import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, Image, Modal, ActivityIndicator, Keyboard, UIManager, findNodeHandle } from "react-native";
import axios from "axios";
import ExperienceSection from "../components/ExperienceSection";
import EducationSection from "../components/EducationSection";
import SeekingSection from "../components/SeekingSection";
import MiniCard from "../components/MiniCard";
import ExpertiseSection from "../components/ExpertiseSection";
import BusinessSection from "../components/BusinessSection";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";
import { useDarkMode } from "../contexts/DarkModeContext";
import { getHeaderColors } from "../config/headerColors";

const ProfileScreenAPI = USER_PROFILE_INFO_ENDPOINT;
const DEFAULT_PROFILE_IMAGE = require("../assets/profile.png");

const EditProfileScreen = ({ route, navigation }) => {
  const { darkMode } = useDarkMode();
  const { user, profile_uid: routeProfileUID } = route.params || {};
  const [profileUID, setProfileUID] = useState(routeProfileUID || user?.profile_uid || "");
  const scrollViewRef = useRef(null);

  // Always initialize profileImageUri with the current profile image from the user object
  const initialProfileImage = user?.profile_personal_image || user?.profileImage || "";
  const [originalProfileImage, setOriginalProfileImage] = useState(initialProfileImage);
  const [profileImage, setProfileImage] = useState(initialProfileImage);
  const [profileImageUri, setProfileImageUri] = useState(initialProfileImage);
  const [deleteProfileImage, setDeleteProfileImage] = useState("");
  const [imageError, setImageError] = useState(false);
  // const [pendingPicker, setPendingPicker] = useState(null);

  useEffect(() => {
    // This useEffect is only used to log the screen being mounted
    console.log("EditProfileScreen - Screen Mounted");
  }, []);

  const [formData, setFormData] = useState({
    email: user?.email || "",
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    phoneNumber: user?.phoneNumber || "",
    tagLine: user?.tagLine || "",
    shortBio: user?.shortBio || "",
    city: user?.city || "",
    state: user?.state || "",
    locationIsPublic: user?.locationIsPublic || false,
    emailIsPublic: user?.emailIsPublic || false,
    phoneIsPublic: user?.phoneIsPublic || false,
    tagLineIsPublic: user?.tagLineIsPublic || false,
    shortBioIsPublic: user?.shortBioIsPublic || false,
    experienceIsPublic: user?.experienceIsPublic || false,
    educationIsPublic: user?.educationIsPublic || false,
    expertiseIsPublic: user?.expertiseIsPublic || false,
    wishesIsPublic: user?.wishesIsPublic || false,
    businessIsPublic: user?.businessIsPublic || false,
    imageIsPublic: user?.imageIsPublic || false,
    businesses: user?.businesses?.map((biz) => ({
      profile_business_uid: biz.profile_business_uid || "",
      business_uid: biz.business_uid || biz.profile_business_business_id || "",
      name: biz.name || biz.profile_business_name || "",
      role: biz.role || biz.profile_business_role || "",
      isPublic: biz.isPublic !== undefined ? biz.isPublic : biz.profile_business_is_visible === 1,
      isApproved: biz.isApproved !== undefined ? biz.isApproved : biz.profile_business_approved === "1",
      individualIsPublic: biz.individualIsPublic !== undefined ? biz.individualIsPublic : biz.bu_individual_business_is_public === 1 || biz.bu_individual_business_is_public === "1",
      isNew: biz.isNew || false,
    })) || [{ name: "", role: "", isPublic: 0, isApproved: 0, isNew: false }],
    experience: user?.experience?.map((e) => ({
      profile_experience_uid: e.profile_experience_uid || "",
      company: e.company || e.profile_experience_company_name || "",
      title: e.title || e.profile_experience_position || "",
      description: e.description || e.profile_experience_description || "",
      startDate: e.startDate || e.profile_experience_start_date || "",
      endDate: e.endDate || e.profile_experience_end_date || "",
      isPublic: e.isPublic !== undefined ? e.isPublic : e.profile_experience_is_public === 1,
    })) || [{ company: "", title: "", description: "", startDate: "", endDate: "", isPublic: true }],
    education: user?.education?.map((e) => ({
      profile_education_uid: e.profile_education_uid || "",
      school: e.school || e.profile_education_school_name || "",
      degree: e.degree || e.profile_education_degree || "",
      startDate: e.startDate || e.profile_education_start_date || "",
      endDate: e.endDate || e.profile_education_end_date || "",
      isPublic: e.isPublic !== undefined ? e.isPublic : e.profile_education_is_public === 1,
    })) || [{ school: "", degree: "", startDate: "", endDate: "", isPublic: true }],
    expertise: user?.expertise?.map((e) => ({
      profile_expertise_uid: e.profile_expertise_uid || "",
      name: e.name || e.profile_expertise_title || "",
      description: e.description || e.profile_expertise_description || "",
      cost: e.cost || e.profile_expertise_cost || "",
      bounty: e.bounty || e.profile_expertise_bounty || "",
      isPublic: e.isPublic !== undefined ? e.isPublic : e.profile_expertise_is_public === 1,
    })) || [{ name: "", description: "", cost: "", bounty: "", isPublic: true }],
    wishes: user?.wishes?.map((e) => ({
      profile_wish_uid: e.profile_wish_uid || "",
      helpNeeds: e.helpNeeds || e.profile_wish_title || "",
      details: e.details || e.profile_wish_description || "",
      amount: e.amount || e.profile_wish_bounty || "",
      isPublic: e.isPublic !== undefined ? e.isPublic : e.profile_wish_is_public === 1,
    })) || [{ helpNeeds: "", details: "", amount: "", isPublic: true }],
    facebook: user?.facebook || "",
    twitter: user?.twitter || "",
    linkedin: user?.linkedin || "",
    youtube: user?.youtube || "",
  });
  // console.log("EditProfileScreen business_info:", formData.businesses);

  // Add state to track deleted items
  const [deletedItems, setDeletedItems] = useState({
    experiences: [],
    educations: [],
    expertises: [],
    wishes: [],
    businesses: [],
  });

  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [pendingBusinessNames, setPendingBusinessNames] = useState([]);
  const [isChanged, setIsChanged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shortBioHeight, setShortBioHeight] = useState(40); // Initial height for Short Bio

  const toggleVisibility = (fieldName) => {
    setFormData((prev) => {
      const newValue = !prev[fieldName];
      const updated = { ...prev, [fieldName]: newValue };

      // Update all items in the section when the section toggle is changed
      if (fieldName === "experienceIsPublic") {
        updated.experience = prev.experience.map((item) => ({
          ...item,
          isPublic: newValue,
        }));
      }
      if (fieldName === "educationIsPublic") {
        updated.education = prev.education.map((item) => ({
          ...item,
          isPublic: newValue,
        }));
      }
      if (fieldName === "wishesIsPublic") {
        updated.wishes = prev.wishes.map((item) => ({
          ...item,
          isPublic: newValue,
        }));
      }
      if (fieldName === "businessIsPublic") {
        updated.businesses = prev.businesses.map((item) => ({
          ...item,
          isPublic: newValue,
        }));
      }
      if (fieldName === "expertiseIsPublic") {
        updated.expertise = prev.expertise.map((item) => ({
          ...item,
          isPublic: newValue,
        }));
      }
      if (fieldName === "businessIsPublic") {
        updated.businesses = prev.businesses.map((item) => ({
          ...item,
          isPublic: newValue,
        }));
      }

      return updated;
    });
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

  // Update image picker to set isChanged to true
  const handlePickImage = async () => {
    console.log("handlePickImage called");
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
        if (originalProfileImage && originalProfileImage !== result.assets[0].uri) {
          console.log("Setting deleteProfileImage to:", originalProfileImage);
          setDeleteProfileImage(originalProfileImage);
        }
        console.log("Setting new profile image URI:", result.assets[0].uri);
        setProfileImageUri(result.assets[0].uri);
        setProfileImage(result.assets[0].uri);
        setImageError(false); // Reset error state when new image is selected
        setIsChanged(true);
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

  // Update the delete handlers in each section to track deleted items
  const handleDeleteExperience = (index) => {
    console.log("EditProfileScreen - handleDeleteExperience called");
    const deletedExp = formData.experience[index];
    if (deletedExp.profile_experience_uid) {
      setDeletedItems((prev) => ({
        ...prev,
        experiences: [...prev.experiences, deletedExp.profile_experience_uid],
      }));
    }
    const updated = formData.experience.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, experience: updated }));
    setIsChanged(true);
  };

  const handleDeleteEducation = (index) => {
    console.log("EditProfileScreen - handleDeleteEducation called");
    const deletedEdu = formData.education[index];
    if (deletedEdu.profile_education_uid) {
      setDeletedItems((prev) => ({
        ...prev,
        educations: [...prev.educations, deletedEdu.profile_education_uid],
      }));
    }
    const updated = formData.education.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, education: updated }));
    setIsChanged(true);
  };

  const handleDeleteExpertise = (index) => {
    const deletedExp = formData.expertise[index];
    if (deletedExp.profile_expertise_uid) {
      setDeletedItems((prev) => ({
        ...prev,
        expertises: [...prev.expertises, deletedExp.profile_expertise_uid],
      }));
    }
    const updated = formData.expertise.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, expertise: updated }));
    setIsChanged(true);
  };

  const handleDeleteWish = (index) => {
    const deletedWish = formData.wishes[index];
    if (deletedWish.profile_wish_uid) {
      setDeletedItems((prev) => ({
        ...prev,
        wishes: [...prev.wishes, deletedWish.profile_wish_uid],
      }));
    }
    const updated = formData.wishes.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, wishes: updated }));
    setIsChanged(true);
  };

  const handleDeleteBusiness = (index) => {
    const deletedBusiness = formData.businesses[index];
    if (deletedBusiness.profile_business_uid) {
      setDeletedItems((prev) => ({
        ...prev,
        businesses: [...prev.businesses, deletedBusiness.profile_business_uid],
      }));
    }
    const updated = formData.businesses.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, businesses: updated }));
    setIsChanged(true);
  };

  // Add image error handler
  const handleImageError = () => {
    console.log("EditProfileScreen - Image failed to load, using default image");
    setImageError(true);
    setProfileImageUri("");
    setProfileImage("");
  };

  const handleSave = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      Alert.alert("Error", "First Name and Last Name are required.");
      return;
    }

    const trimmedProfileUID = profileUID.trim();
    if (!trimmedProfileUID) {
      Alert.alert("Error", "Profile ID is missing.");
      return;
    }

    setIsLoading(true);
    try {
      const payload = new FormData();
      payload.append("profile_uid", trimmedProfileUID);
      // payload.append("user_email", formData.email);
      payload.append("profile_personal_first_name", formData.firstName);
      payload.append("profile_personal_last_name", formData.lastName);
      payload.append("profile_personal_phone_number", formData.phoneNumber);
      payload.append("profile_personal_tag_line", formData.tagLine);
      payload.append("profile_personal_short_bio", formData.shortBio);

      payload.append("profile_personal_city", formData.city);
      payload.append("profile_personal_state", formData.state);
      payload.append("profile_personal_location_is_public", formData.locationIsPublic ? 1 : 0);
      payload.append("profile_personal_phone_number_is_public", formData.phoneIsPublic ? 1 : 0);
      payload.append("profile_personal_email_is_public", formData.emailIsPublic ? 1 : 0);
      payload.append("profile_personal_tag_line_is_public", formData.tagLineIsPublic ? 1 : 0);
      payload.append("profile_personal_short_bio_is_public", formData.shortBioIsPublic ? 1 : 0);
      payload.append("profile_personal_experience_is_public", formData.experienceIsPublic ? 1 : 0);
      payload.append("profile_personal_education_is_public", formData.educationIsPublic ? 1 : 0);
      payload.append("profile_personal_expertise_is_public", formData.expertiseIsPublic ? 1 : 0);
      payload.append("profile_personal_wishes_is_public", formData.wishesIsPublic ? 1 : 0);
      payload.append("profile_personal_business_is_public", formData.businessIsPublic ? 1 : 0);
      console.log("EditProfileScreen - Sending businessIsPublic:", formData.businessIsPublic);
      console.log("EditProfileScreen - As value:", formData.businessIsPublic ? 1 : 0);
      payload.append("profile_personal_image_is_public", formData.imageIsPublic ? 1 : 0);

      // Map experience data to backend field names - using frontend field names for consistency
      const experiencePayload = (formData.experience || [])
        .map((exp) => {
          // Only process if company or title is present
          if (!exp.company && !exp.title) return null;

          // If it's an existing experience (has profile_experience_uid)
          if (exp.profile_experience_uid) {
            return {
              profile_experience_uid: exp.profile_experience_uid,
              company: exp.company || "",
              title: exp.title || "",
              description: exp.description || "",
              startDate: exp.startDate || "",
              endDate: exp.endDate || "",
              isPublic: exp.isPublic ? 1 : 0,
            };
          }

          // If it's a new experience, don't include profile_experience_uid
          return {
            company: exp.company || "",
            title: exp.title || "",
            description: exp.description || "",
            startDate: exp.startDate || "",
            endDate: exp.endDate || "",
            isPublic: exp.isPublic ? 1 : 0,
          };
        })
        .filter(Boolean);

      console.log("Experience payload being sent:", experiencePayload);
      payload.append("experience_info", JSON.stringify(experiencePayload));
      payload.append("education_info", JSON.stringify(formData.education || []));
      payload.append("expertise_info", JSON.stringify(formData.expertise || []));
      payload.append("wishes_info", JSON.stringify(formData.wishes || []));
      //payload.append("business_info", JSON.stringify(formData.businesses || []));

      // Add businesses to payload (for each business, add the correct fields)
      const businessesPayload = (formData.businesses || [])
        .map((biz) => {
          // Only process if business name is present
          if (!biz.name) return null;

          // If it's an existing business (has profile_business_uid)
          if (biz.profile_business_uid) {
            return {
              profile_business_uid: biz.profile_business_uid,
              business_id: biz.business_uid || "",
              profile_business_role: biz.role || "",
              isPublic: biz.isPublic ? 1 : 0,
              isApproved: biz.isApproved ? 1 : 0,
              individualIsPublic: biz.individualIsPublic ? 1 : 0,
            };
          }

          // If it's a new business, don't include profile_business_uid at all
          return {
            business_id: biz.business_uid || "",
            profile_business_role: biz.role || "",
            isPublic: biz.isPublic ? 1 : 0,
            isApproved: 1, // Set to approved for new businesses
            profile_business_approver_id: profileUID, // Use the current user's profile UID as approver
            individualIsPublic: biz.individualIsPublic ? 1 : 0,
          };
        })
        .filter(Boolean);

      console.log("Businesses payload being sent:", businessesPayload);
      payload.append("business_info", JSON.stringify(businessesPayload));

      payload.append(
        "social_links",
        JSON.stringify({
          facebook: formData.facebook,
          twitter: formData.twitter,
          linkedin: formData.linkedin,
          youtube: formData.youtube,
        })
      );

      let imageFileSize = 0;
      if (profileImageUri && !imageError && profileImageUri !== originalProfileImage) {
        const fileInfo = await FileSystem.getInfoAsync(profileImageUri);
        imageFileSize = fileInfo.size || 0;
        console.log("Image file size (bytes):", imageFileSize);

        const uriParts = profileImageUri.split(".");
        const fileType = uriParts[uriParts.length - 1];

        const imageFile = {
          uri: profileImageUri,
          name: `profile.${fileType}`,
          type: `image/${fileType}`,
        };

        payload.append("profile_image", imageFile);
      }

      // Only add delete_profile_image if there's an image to delete and it hasn't errored
      if (deleteProfileImage && !imageError) {
        console.log("Adding delete_profile_image to payload:", deleteProfileImage);
        payload.append("delete_profile_image", deleteProfileImage);
      }

      // Add deleted items to payload
      if (deletedItems.experiences.length > 0) {
        payload.append("delete_experiences", JSON.stringify(deletedItems.experiences));
      }
      if (deletedItems.educations.length > 0) {
        payload.append("delete_educations", JSON.stringify(deletedItems.educations));
      }
      if (deletedItems.expertises.length > 0) {
        payload.append("delete_expertises", JSON.stringify(deletedItems.expertises));
      }
      if (deletedItems.wishes.length > 0) {
        payload.append("delete_wishes", JSON.stringify(deletedItems.wishes));
      }
      if (deletedItems.businesses.length > 0) {
        payload.append("delete_businesses", JSON.stringify(deletedItems.businesses));
      }

      console.log("Deleted items being sent:", deletedItems);

      // Log all FormData entries before sending
      console.log("FormData being sent to API:");
      for (let pair of payload.entries()) {
        console.log(pair[0] + ":", pair[1]);
      }

      console.log("Payload being sent to API:", payload);
      console.log("==========================================");
      console.log("BUSINESSES PAYLOAD DETAIL:");
      console.log("formData.businesses:", JSON.stringify(formData.businesses, null, 2));
      console.log("businessesPayload:", JSON.stringify(businessesPayload, null, 2));
      console.log("==========================================");
      console.log("Sending payload to server... PUT");
      await new Promise((res) => setTimeout(res, 2000)); // Add this line to simulate a 2s delay
      const response = await axios({
        method: "put",
        url: `${ProfileScreenAPI}?profile_uid=${trimmedProfileUID}`,
        data: payload,
        headers: {
          "Content-Type": "multipart/form-data",
          Accept: "application/json",
        },
      });

      if (response.status === 200) {
        console.log("Profile update successful");
        Alert.alert("Success", "Profile updated successfully!");
        setOriginalProfileImage(profileImageUri); // Update the original image after successful save
        setIsChanged(false);

        // Only show modal for new businesses (those without profile_business_uid)
        const newBusinesses = formData.businesses?.filter((biz) => biz.name && !biz.profile_business_uid) || [];
        if (newBusinesses.length > 0) {
          setPendingBusinessNames(newBusinesses.map((biz) => biz.name));
          setShowBusinessModal(true);
        } else {
          navigation.replace("Profile", {
            updatedUser: {
              ...user,
              personal_info: {
                ...user.personal_info,
                profile_personal_city: formData.city,
                profile_personal_state: formData.state,
                profile_personal_location_is_public: formData.locationIsPublic ? 1 : 0,
              },
            },
          });
        }
      } else {
        console.error("Profile update failed:", response);
        Alert.alert("Error", "Failed to update profile.");
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

  const renderField = (label, value, isPublic, fieldName, visibilityFieldName, editable = true) => (
    <View style={styles.fieldContainer}>
      {/* Row: Label and Toggle */}
      <View style={styles.labelRow}>
        <Text style={[styles.label, darkMode && styles.darkLabel]}>{label}</Text>
        <TouchableOpacity onPress={() => handleToggleVisibility(visibilityFieldName)}>
          <Text style={[styles.toggleText, { color: isPublic ? (darkMode ? "#4ade80" : "green") : darkMode ? "#f87171" : "red" }]}>{isPublic ? "Display" : "Hide"}</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={[styles.input, !editable && (darkMode ? styles.darkDisabledInput : styles.disabledInput), darkMode && editable && styles.darkInput]}
        value={value}
        onChangeText={(text) => handleFieldChange(fieldName, text)}
        editable={editable}
        placeholder={`Enter ${label.toLowerCase()}`}
        placeholderTextColor={darkMode ? "#cccccc" : "#999999"}
      />
    </View>
  );

  const renderShortBioField = () => (
    <View style={styles.fieldContainer}>
      {/* Row: Label and Toggle */}
      <View style={styles.labelRow}>
        <Text style={[styles.label, darkMode && styles.darkLabel]}>Short Bio</Text>
        <TouchableOpacity onPress={() => handleToggleVisibility("shortBioIsPublic")}>
          <Text style={[styles.toggleText, { color: formData.shortBioIsPublic ? (darkMode ? "#4ade80" : "green") : darkMode ? "#f87171" : "red" }]}>
            {formData.shortBioIsPublic ? "Display" : "Hide"}
          </Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={[styles.input, styles.textarea, { height: Math.max(40, shortBioHeight) }, darkMode && styles.darkInput]}
        value={formData.shortBio}
        onChangeText={(text) => handleFieldChange("shortBio", text)}
        placeholder='Enter short bio'
        placeholderTextColor={darkMode ? "#cccccc" : "#999999"}
        multiline
        textAlignVertical='top'
        onContentSizeChange={(event) => {
          setShortBioHeight(event.nativeEvent.contentSize.height);
        }}
      />
    </View>
  );

  // Create a preview user object for the MiniCard that matches ProfileScreen structure
  const previewUser = {
    firstName: formData.firstName,
    lastName: formData.lastName,
    email: formData.email,
    phoneNumber: formData.phoneNumber,
    tagLine: formData.tagLine,
    city: formData.city,
    state: formData.state,
    locationIsPublic: formData.locationIsPublic,
    // Include visibility flags
    emailIsPublic: formData.emailIsPublic,
    phoneIsPublic: formData.phoneIsPublic,
    tagLineIsPublic: formData.tagLineIsPublic,
    shortBioIsPublic: formData.shortBioIsPublic,
    experienceIsPublic: formData.experienceIsPublic,
    educationIsPublic: formData.educationIsPublic,
    expertiseIsPublic: formData.expertiseIsPublic,
    wishesIsPublic: formData.wishesIsPublic,
    businessIsPublic: formData.businessIsPublic,
    imageIsPublic: formData.imageIsPublic,
    // Include the profile image - MiniCard will check imageIsPublic to decide whether to show it
    profileImage: profileImageUri || "",
  };

  // Profile Image Public/Private Toggle Handler
  const toggleProfileImageVisibility = () => {
    setFormData((prev) => ({
      ...prev,
      imageIsPublic: !prev.imageIsPublic,
    }));
  };

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
    <View style={{ flex: 1, backgroundColor: darkMode ? "#1a1a1a" : "#ffffff" }}>
      <AppHeader title='Edit Profile' {...getHeaderColors("editProfile")} onBackPress={() => navigation.goBack()} />
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1, padding: 20, backgroundColor: darkMode ? "#1a1a1a" : "#ffffff" }}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={true}
      >
        {/* Profile Image Upload Section */}
        <View style={[styles.imageSection, darkMode && styles.darkImageSection]}>
          <Text style={[styles.label, darkMode && styles.darkLabel]}>Profile Image</Text>
          <Image
            source={profileImageUri && !imageError ? { uri: profileImageUri } : DEFAULT_PROFILE_IMAGE}
            style={[styles.profileImage, darkMode && styles.darkProfileImage]}
            tintColor={darkMode ? "#ffffff" : undefined}
            onError={handleImageError}
          />
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <TouchableOpacity onPress={toggleProfileImageVisibility}>
              <Text style={[styles.toggleText, { fontWeight: "bold", color: formData.imageIsPublic ? (darkMode ? "#4ade80" : "green") : darkMode ? "#f87171" : "red" }]}>
                {formData.imageIsPublic ? "Display" : "Hide"}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handlePickImage}>
            <Text style={[styles.uploadLink, darkMode && styles.darkUploadLink]}>Upload Image</Text>
          </TouchableOpacity>
        </View>
        {renderField("First Name (Public)", formData.firstName, true, "firstName", "firstNameIsPublic")}
        {renderField("Last Name (Public)", formData.lastName, true, "lastName", "lastNameIsPublic")}
        {renderField("Phone Number", formData.phoneNumber, formData.phoneIsPublic, "phoneNumber", "phoneIsPublic")}
        {renderField("Email", formData.email, formData.emailIsPublic, "email", "emailIsPublic")}
        {renderField("City", formData.city, formData.locationIsPublic, "city", "locationIsPublic")}
        {renderField("State", formData.state, formData.locationIsPublic, "state", "locationIsPublic")}
        {renderField("Tag Line", formData.tagLine, formData.tagLineIsPublic, "tagLine", "tagLineIsPublic")}

        {/* MiniCard Live Preview Section */}
        <View style={[styles.previewSection, darkMode && styles.darkPreviewSection]}>
          <Text style={[styles.label, darkMode && styles.darkLabel]}>Mini Card (how you'll appear in searches):</Text>
          <View style={[styles.previewCard, darkMode && styles.darkPreviewCard]}>
            <MiniCard user={previewUser} />
          </View>
        </View>

        {renderShortBioField()}

        <ExperienceSection
          experience={formData.experience}
          setExperience={(e) => {
            setFormData({ ...formData, experience: e });
            setIsChanged(true);
          }}
          toggleVisibility={() => handleToggleVisibility("experienceIsPublic")}
          isPublic={formData.experienceIsPublic}
          handleDelete={handleDeleteExperience}
        />
        <EducationSection
          education={formData.education}
          setEducation={(e) => {
            setFormData({ ...formData, education: e });
            setIsChanged(true);
          }}
          toggleVisibility={() => handleToggleVisibility("educationIsPublic")}
          isPublic={formData.educationIsPublic}
          handleDelete={handleDeleteEducation}
        />
        <ExpertiseSection
          expertise={formData.expertise}
          setExpertise={(e) => {
            setFormData({ ...formData, expertise: e });
            setIsChanged(true);
          }}
          toggleVisibility={() => handleToggleVisibility("expertiseIsPublic")}
          isPublic={formData.expertiseIsPublic}
          handleDelete={handleDeleteExpertise}
          onInputFocus={(inputRef) => {
            focusedInputRef.current = inputRef;
            scrollToFocusedInput();
          }}
        />

        <SeekingSection
          wishes={formData.wishes}
          setWishes={(e) => {
            setFormData({ ...formData, wishes: e });
            setIsChanged(true);
          }}
          toggleVisibility={() => handleToggleVisibility("wishesIsPublic")}
          isPublic={formData.wishesIsPublic}
          handleDelete={handleDeleteWish}
          onInputFocus={(inputRef) => {
            focusedInputRef.current = inputRef;
            scrollToFocusedInput();
          }}
        />

        <BusinessSection
          businesses={formData.businesses}
          setBusinesses={(e) => {
            setFormData({ ...formData, businesses: e });
            setIsChanged(true);
          }}
          toggleVisibility={() => handleToggleVisibility("businessIsPublic")}
          isPublic={formData.businessIsPublic}
          handleDelete={handleDeleteBusiness}
          navigation={navigation}
        />

        <TouchableOpacity
          style={[styles.saveButton, !isChanged && (darkMode ? styles.darkDisabledButton : styles.disabledButton), darkMode && styles.darkSaveButton]}
          onPress={handleSave}
          disabled={!isChanged || isLoading}
        >
          {isLoading ? <ActivityIndicator size='small' color={darkMode ? "#ffffff" : "#fff"} /> : <Text style={[styles.saveText, darkMode && styles.darkSaveText]}>Submit</Text>}
        </TouchableOpacity>
      </ScrollView>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10 }}>
        <BottomNavBar navigation={navigation} />
      </View>
      {/* Business Approval Modal */}
      <Modal visible={showBusinessModal} transparent={true} animationType='fade' onRequestClose={() => setShowBusinessModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}>
          <View style={[styles.modalContainer, darkMode && styles.darkModalContainer]}>
            {pendingBusinessNames.map((name, idx) => (
              <Text key={idx} style={[styles.modalText, darkMode && styles.darkModalText]}>
                {`We've sent an email to the Owner of ${name}.\nAs soon as they approve your request, we will add your business to your Profile.`}
              </Text>
            ))}
            <TouchableOpacity
              style={[styles.modalButton, darkMode && styles.darkModalButton]}
              onPress={() => {
                setShowBusinessModal(false);
                navigation.replace("Profile");
              }}
            >
              <Text style={[styles.modalButtonText, darkMode && styles.darkModalButtonText]}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  pageContainer: { flex: 1, backgroundColor: "#fff", minHeight: "100%" },
  container: { flex: 1, padding: 20, minHeight: "100%" },
  header: { fontSize: 24, fontWeight: "bold", marginTop: 20, marginBottom: 20, color: "#000" },
  fieldContainer: { marginBottom: 15 },
  label: { fontSize: 16, fontWeight: "bold", marginBottom: 5, color: "#000" },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 5, backgroundColor: "#fff" },
  textarea: { minHeight: 40, maxHeight: 200 },
  disabledInput: { backgroundColor: "#eee", color: "#999" },
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
  disabledButton: {
    backgroundColor: "#ccc",
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
  darkDisabledInput: {
    backgroundColor: "#404040",
    color: "#666666",
  },
  darkSaveButton: {
    backgroundColor: "#660000", // Darker maroon for dark mode
  },
  darkSaveText: {
    color: "#ffffff",
  },
  darkImageSection: {
    backgroundColor: "#1a1a1a",
  },
  darkPreviewSection: {
    backgroundColor: "#1a1a1a",
  },
  darkDisabledButton: {
    backgroundColor: "#404040",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 24,
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
  },
  modalText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: "center",
    color: "#000",
  },
  modalButton: {
    marginTop: 10,
    backgroundColor: "#FF9500",
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 30,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  darkModalContainer: {
    backgroundColor: "#2d2d2d",
  },
  darkModalText: {
    color: "#ffffff",
  },
  darkModalButton: {
    backgroundColor: "#4a9eff",
  },
  darkModalButtonText: {
    color: "#ffffff",
  },
});

export default EditProfileScreen;
