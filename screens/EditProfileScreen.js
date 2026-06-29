//EditProfileScreen.js
import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, Image, Modal, ActivityIndicator, Keyboard, UIManager, findNodeHandle, Platform, BackHandler } from "react-native";
import MiniCard from "../components/MiniCard";
import MicroCard from "../components/MicroCard";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { useDarkMode } from "../contexts/DarkModeContext";
import { getHeaderColors } from "../config/headerColors";

// PROFILE-SPECIFIC
import ExperienceSection from "../components/ExperienceSection";
import EducationSection from "../components/EducationSection";
import ExpertiseSection, { validateExpertise } from "../components/ExpertiseSection";
import SeekingSection, { validateSeeking } from "../components/SeekingSection";
import BusinessSection from "../components/BusinessSection";
import { USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";
import { refreshSessionProfileFromNetwork } from "../utils/sessionProfile";
import { resolveProfileItemImageUri, isRemoteHttpUrl } from "../utils/resolveProfileItemImageUri";
import { parseCoordinateValue } from "../utils/validateCoordinates";
import { getAddressSuggestions, getPlaceDetails } from "../utils/googlePlaces";
import { Ionicons } from "@expo/vector-icons";

const ProfileScreenAPI = USER_PROFILE_INFO_ENDPOINT;
const DEFAULT_PROFILE_IMAGE = require("../assets/profile.png");

function getInitialHomeLatLng(user) {
  const pi = user?.personal_info;
  let lat = parseCoordinateValue(pi?.profile_personal_latitude);
  let lng = parseCoordinateValue(pi?.profile_personal_longitude);
  if ((lat == null || lng == null) && user?.homeCoordinates) {
    const parts = String(user.homeCoordinates)
      .split(/[,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 2) {
      lat = parseCoordinateValue(parts[0]);
      lng = parseCoordinateValue(parts[1]);
    }
  }
  return { lat, lng };
}

const EditProfileScreen = ({ route, navigation }) => {
  const { darkMode } = useDarkMode();
  const { user, profile_uid: routeProfileUID, businessesData: preFetchedBusinessesData } = route.params || {};
  const initialFormProfileUid = (routeProfileUID || user?.profile_uid || "").trim();
  const [profileUID, setProfileUID] = useState(routeProfileUID || user?.profile_uid || "");
  const scrollViewRef = useRef(null);
  // Tracks current ScrollView Y offset to compute relative scroll targets.
  const scrollOffsetYRef = useRef(0);
  // Tracks visible viewport height of ScrollView to center new cards.
  const scrollViewportHeightRef = useRef(0);

  // Always initialize profileImageUri with the current profile image from the user object
  const initialProfileImage = user?.profile_personal_image || user?.profileImage || "";
  const [originalProfileImage, setOriginalProfileImage] = useState(initialProfileImage);
  const [profileImage, setProfileImage] = useState(initialProfileImage);
  const [profileImageUri, setProfileImageUri] = useState(initialProfileImage);
  const [deleteProfileImage, setDeleteProfileImage] = useState("");
  const [imageError, setImageError] = useState(false);
  const [webImageFile, setWebImageFile] = useState(null); // Store the actual File object for web uploads
  // const [pendingPicker, setPendingPicker] = useState(null);

  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  const [showProfile, setShowProfile] = useState(true);
  const [showBio, setShowBio] = useState(true);
  const [showOffering, setShowOffering] = useState(true);
  const [showSeeking, setShowSeeking] = useState(true);
  const [showExperience, setShowExperience] = useState(true);
  const [showEducation, setShowEducation] = useState(true);
  const [showBusiness, setShowBusiness] = useState(true);

  useEffect(() => {
    // This useEffect is only used to log the screen being mounted
    console.log("EditProfileScreen - Screen Mounted");
  }, []);

  // Add this at the very top of EditProfileScreen component (around line 19, right after the route params)
  useEffect(() => {
    console.log("=== RAW USER DATA FROM BACKEND ===");
    console.log("user?.wishes:", JSON.stringify(user?.wishes, null, 2));
  }, []);

  const initialHomeLatLng = getInitialHomeLatLng(user);

  const [formData, setFormData] = useState({
    email: user?.email || "",
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    phoneNumber: user?.phoneNumber || "",
    tagLine: user?.tagLine || "",
    shortBio: user?.shortBio || "",
    city: user?.city || "",
    state: user?.state || "",
    homeLatitude: initialHomeLatLng.lat,
    homeLongitude: initialHomeLatLng.lng,
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
      // isPublic: biz.isPublic !== undefined ? biz.isPublic : biz.profile_business_is_visible === 1,
      isPublic: biz.individualIsPublic === true || biz.isPublic === true,
      isApproved: biz.isApproved !== undefined ? biz.isApproved : biz.profile_business_approved === "1",
      individualIsPublic:
        biz.individualIsPublic !== undefined
          ? biz.individualIsPublic
          : biz.bu_individual_business_is_public === true || biz.bu_individual_business_is_public === 1 || biz.bu_individual_business_is_public === "1",
      isNew: biz.isNew || false,
      business_updated_at: biz.business_updated_at ?? biz.updated_at,
    })) || [{ name: "", role: "", isPublic: 0, isApproved: 0, isNew: false }],
    experience: (() => {
      const uid = initialFormProfileUid;
      return (
        user?.experience?.map((e) => {
          const rawImg = e.profile_experience_image || "";
          const resolved = resolveProfileItemImageUri(rawImg, uid);
          return {
            profile_experience_uid: e.profile_experience_uid || "",
            company: e.company || e.profile_experience_company_name || "",
            title: e.title || e.profile_experience_position || "",
            description: e.description || e.profile_experience_description || "",
            startDate: e.startDate || e.profile_experience_start_date || "",
            endDate: e.endDate || e.profile_experience_end_date || "",
            isPublic: e.isPublic !== undefined ? e.isPublic : e.profile_experience_is_public === 1,
            profile_experience_image: rawImg,
            profile_experience_image_is_public: e.profile_experience_image_is_public === 0 || e.profile_experience_image_is_public === "0" ? 0 : 1,
            _jobNewImageUri: "",
            _jobWebImageFile: null,
            _jobOriginalImage: isRemoteHttpUrl(resolved) ? resolved : "",
            _jobDeleteImageUrl: "",
            _jobImageError: false,
          };
        }) || [
          {
            company: "",
            title: "",
            description: "",
            startDate: "",
            endDate: "",
            isPublic: true,
            profile_experience_image: "",
            profile_experience_image_is_public: 1,
            _jobNewImageUri: "",
            _jobWebImageFile: null,
            _jobOriginalImage: "",
            _jobDeleteImageUrl: "",
            _jobImageError: false,
          },
        ]
      );
    })(),
    education: (() => {
      const uid = initialFormProfileUid;
      return (
        user?.education?.map((e) => {
          const rawImg = e.profile_education_image || "";
          const resolved = resolveProfileItemImageUri(rawImg, uid);
          return {
            profile_education_uid: e.profile_education_uid || "",
            school: e.school || e.profile_education_school_name || "",
            degree: e.degree || e.profile_education_degree || "",
            startDate: e.startDate || e.profile_education_start_date || "",
            endDate: e.endDate || e.profile_education_end_date || "",
            isPublic: e.isPublic !== undefined ? e.isPublic : e.profile_education_is_public === 1,
            profile_education_image: rawImg,
            profile_education_image_is_public: e.profile_education_image_is_public === 0 || e.profile_education_image_is_public === "0" ? 0 : 1,
            _eduNewImageUri: "",
            _eduWebImageFile: null,
            _eduOriginalImage: isRemoteHttpUrl(resolved) ? resolved : "",
            _eduDeleteImageUrl: "",
            _eduImageError: false,
          };
        }) || [
          {
            school: "",
            degree: "",
            startDate: "",
            endDate: "",
            isPublic: true,
            profile_education_image: "",
            profile_education_image_is_public: 1,
            _eduNewImageUri: "",
            _eduWebImageFile: null,
            _eduOriginalImage: "",
            _eduDeleteImageUrl: "",
            _eduImageError: false,
          },
        ]
      );
    })(),
    expertise: (() => {
      const uid = initialFormProfileUid;
      return (
        user?.expertise?.map((e) => {
          const rawImg = e.profile_expertise_image || "";
          const resolved = resolveProfileItemImageUri(rawImg, uid);
          return {
            profile_expertise_uid: e.profile_expertise_uid || "",
            name: e.name || e.profile_expertise_title || "",
            description: e.description || e.profile_expertise_description || "",
            quantity: e.quantity || e.profile_expertise_quantity || "",
            cost: e.cost || e.profile_expertise_cost || "",
            bounty: e.bounty || e.profile_expertise_bounty || "",
            profile_expertise_image: rawImg,
            profile_expertise_image_is_public: e.profile_expertise_image_is_public === 0 || e.profile_expertise_image_is_public === "0" ? 0 : 1,
            profile_expertise_start: e.profile_expertise_start || "",
            profile_expertise_end: e.profile_expertise_end || "",
            profile_expertise_location: e.profile_expertise_location || "",
            profile_expertise_latitude: e.profile_expertise_latitude ?? null,
            profile_expertise_longitude: e.profile_expertise_longitude ?? null,
            profile_expertise_city: e.profile_expertise_city || "",
            profile_expertise_state: e.profile_expertise_state || "",
            profile_expertise_mode: e.profile_expertise_mode || "",
            profile_expertise_is_taxable: e.profile_expertise_is_taxable ?? 0,
            profile_expertise_tax_rate: e.profile_expertise_tax_rate ?? "",
            profile_expertise_updated_at: e.profile_expertise_updated_at ?? e.updated_at,
            isPublic: e.isPublic !== undefined ? e.isPublic : e.profile_expertise_is_public === 1,
            _expNewImageUri: "",
            _expWebImageFile: null,
            _expOriginalImage: isRemoteHttpUrl(resolved) ? resolved : "",
            _expDeleteImageUrl: "",
            _expImageError: false,
          };
        }) || [
          {
            name: "",
            description: "",
            quantity: "",
            cost: "",
            bounty: "",
            profile_expertise_image: "",
            profile_expertise_image_is_public: 1,
            profile_expertise_start: "",
            profile_expertise_end: "",
            profile_expertise_location: "",
            profile_expertise_latitude: null,
            profile_expertise_longitude: null,
            profile_expertise_city: "",
            profile_expertise_state: "",
            profile_expertise_mode: "",
            isPublic: true,
            _expNewImageUri: "",
            _expWebImageFile: null,
            _expOriginalImage: "",
            _expDeleteImageUrl: "",
            _expImageError: false,
          },
        ]
      );
    })(),
    wishes: (() => {
      const uid = initialFormProfileUid;
      return (
        user?.wishes?.map((e) => {
          const rawImg = e.profile_wish_image || "";
          const resolved = resolveProfileItemImageUri(rawImg, uid);
          return {
            profile_wish_uid: e.profile_wish_uid || "",
            helpNeeds: e.helpNeeds || e.profile_wish_title || "",
            details: e.details || e.profile_wish_description || "",
            amount: e.amount || e.profile_wish_bounty || "",
            cost: e.cost || e.profile_wish_cost || "",
            profile_wish_quantity: e.profile_wish_quantity != null ? String(e.profile_wish_quantity) : "",
            profile_wish_image: rawImg,
            profile_wish_image_is_public: e.profile_wish_image_is_public === 0 || e.profile_wish_image_is_public === "0" ? 0 : 1,
            profile_wish_start: e.profile_wish_start || "",
            profile_wish_end: e.profile_wish_end || "",
            profile_wish_location: e.profile_wish_location || "",
            profile_wish_mode: e.profile_wish_mode || "",
            profile_wish_updated_at: e.profile_wish_updated_at ?? e.updated_at,
            isPublic: e.isPublic !== undefined ? e.isPublic : e.profile_wish_is_public === 1,
            _wishNewImageUri: "",
            _wishWebImageFile: null,
            _wishOriginalImage: isRemoteHttpUrl(resolved) ? resolved : "",
            _wishDeleteImageUrl: "",
            _wishImageError: false,
          };
        }) || [
          {
            helpNeeds: "",
            details: "",
            amount: "",
            cost: "",
            profile_wish_quantity: "",
            profile_wish_image: "",
            profile_wish_image_is_public: 1,
            profile_wish_start: "",
            profile_wish_end: "",
            profile_wish_location: "",
            profile_wish_mode: "",
            isPublic: true,
            _wishNewImageUri: "",
            _wishWebImageFile: null,
            _wishOriginalImage: "",
            _wishDeleteImageUrl: "",
            _wishImageError: false,
          },
        ]
      );
    })(),
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
  const fileInputRef = useRef(null); // For web file input
  const [imageUpdateKey, setImageUpdateKey] = useState(0); // Key to force MiniCard re-render when image changes
  const [homeAddress, setHomeAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressSearchLoading, setAddressSearchLoading] = useState(false);
  const addressDebounceRef = useRef(null);

  const toggleVisibility = (fieldName) => {
    setFormData((prev) => {
      const newValue = !prev[fieldName];
      const updated = { ...prev, [fieldName]: newValue };

      // Update all items in the section when the section toggle is changed
      // Removed: Section-level toggles should not change individual entry visibility
      // Individual entries maintain their own isPublic values
      // The section-level toggle (experienceIsPublic, educationIsPublic, etc.) only controls
      // whether the section itself is visible, not the individual entries within it

      return updated;
    });
  };

  // Update all field changes to set isChanged to true
  const handleFieldChange = (fieldName, value) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    setIsChanged(true);
  };

  const onHomeAddressChange = (text) => {
    setHomeAddress(text);
    setIsChanged(true);
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);

    if (!text.trim()) {
      setAddressSuggestions([]);
      setFormData((prev) => ({ ...prev, homeLatitude: null, homeLongitude: null }));
      return;
    }

    addressDebounceRef.current = setTimeout(async () => {
      try {
        const results = await getAddressSuggestions(text);
        setAddressSuggestions(results);
      } catch (err) {
        console.error("EditProfileScreen address suggestions error:", err);
      }
    }, 350);
  };

  const handleHomeAddressSelect = async (place) => {
    setAddressSuggestions([]);
    setAddressSearchLoading(true);
    try {
      const pd = await getPlaceDetails(place.place_id);
      if (pd.lat == null || pd.lng == null) {
        Alert.alert("Error", "Could not determine coordinates for this address.");
        return;
      }
      setHomeAddress(pd.formatted_address || place.description || "");
      setFormData((prev) => ({
        ...prev,
        homeLatitude: pd.lat,
        homeLongitude: pd.lng,
        city: pd.city || prev.city,
        state: pd.state || prev.state,
      }));
      setIsChanged(true);
    } catch (err) {
      console.error("EditProfileScreen address select error:", err);
      Alert.alert("Error", "Could not load address details. Please try again.");
    } finally {
      setAddressSearchLoading(false);
    }
  };

  const renderHomeAddressField = () => {
    const hasRecordedLocation = formData.homeLatitude != null && formData.homeLongitude != null;
    const addressPlaceholder = hasRecordedLocation ? "Location recorded. Enter new address to change location." : "Start typing your home address";

    return (
      <View style={[styles.fieldContainer, styles.placesSearchContainer]}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, darkMode && styles.darkLabel]}>Address (for location services only)</Text>
          <Text style={[styles.toggleText, styles.alwaysHiddenLabel, darkMode && styles.darkAlwaysHiddenLabel]}>Always Hidden</Text>
        </View>
        <TextInput
          style={[styles.input, darkMode && styles.darkInput]}
          placeholder={addressPlaceholder}
          placeholderTextColor={darkMode ? "#cccccc" : "#999999"}
          value={homeAddress}
          onChangeText={onHomeAddressChange}
          autoCapitalize='words'
          autoCorrect={false}
        />
        {addressSearchLoading ? <ActivityIndicator size='small' color='#4B2E83' style={{ marginTop: 8 }} /> : null}
        {addressSuggestions.length > 0 && (
          <View style={[styles.placesSuggestionsList, darkMode && styles.darkPlacesSuggestionsList]}>
            {addressSuggestions.map((item) => (
              <TouchableOpacity key={item.place_id} style={[styles.placesSuggestionRow, darkMode && styles.darkPlacesSuggestionRow]} onPress={() => handleHomeAddressSelect(item)} activeOpacity={0.7}>
                <Text style={[styles.placesSuggestionMain, darkMode && styles.darkLabel]}>{item.structured_formatting?.main_text || item.description}</Text>
                {item.structured_formatting?.secondary_text ? (
                  <Text style={[styles.placesSuggestionSub, darkMode && styles.darkHomeCoordHint]}>{item.structured_formatting.secondary_text}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Update all toggles to set isChanged to true
  const handleToggleVisibility = (fieldName) => {
    setIsChanged(true);
    toggleVisibility(fieldName);
  };

  // Web-specific image picker handler
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
      if (originalProfileImage && originalProfileImage !== imageUri) {
        setDeleteProfileImage(originalProfileImage);
      }
      setProfileImageUri(imageUri);
      setProfileImage(imageUri);
      setImageError(false);
      setIsChanged(true);
      setImageUpdateKey((prev) => prev + 1); // Increment key to force MiniCard re-render
    };
    reader.readAsDataURL(file);

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Update image picker to set isChanged to true
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
        if (originalProfileImage && originalProfileImage !== result.assets[0].uri) {
          console.log("Setting deleteProfileImage to:", originalProfileImage);
          setDeleteProfileImage(originalProfileImage);
        }
        console.log("Setting new profile image URI:", result.assets[0].uri);
        setProfileImageUri(result.assets[0].uri);
        setProfileImage(result.assets[0].uri);
        setImageError(false); // Reset error state when new image is selected
        setIsChanged(true);
        setImageUpdateKey((prev) => prev + 1); // Increment key to force MiniCard re-render
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
    if (!validateExpertise(formData.expertise)) {
      Alert.alert("Required Field", "Please select a unit for all Offering entries before submitting.");
      return;
    }

    if (!validateSeeking(formData.wishes)) {
      Alert.alert("Required Field", "Please select a unit for all Seeking entries before submitting.");
      return;
    }

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      Alert.alert("Error", "First Name and Last Name are required.");
      return;
    }

    const homeLat = formData.homeLatitude;
    const homeLng = formData.homeLongitude;

    const trimmedProfileUID = profileUID.trim();
    if (!trimmedProfileUID) {
      Alert.alert("Error", "Profile ID is missing.");
      return;
    }

    setIsLoading(true);
    let imageFileSize = 0;
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
      if (homeLat != null && homeLng != null) {
        payload.append("profile_personal_latitude", String(homeLat));
        payload.append("profile_personal_longitude", String(homeLng));
      } else {
        payload.append("profile_personal_latitude", "");
        payload.append("profile_personal_longitude", "");
      }
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

      const wishesPayload = (formData.wishes || []).map((w) => ({
        profile_wish_uid: w.profile_wish_uid || "",
        profile_wish_title: w.helpNeeds || "",
        profile_wish_description: w.details || "",
        profile_wish_cost: w.cost || "",
        profile_wish_quantity: w.profile_wish_quantity != null && w.profile_wish_quantity !== "" ? String(w.profile_wish_quantity) : "",
        profile_wish_bounty: w.amount || "",
        profile_wish_is_public: w.isPublic ? 1 : 0,
        profile_wish_image: w.profile_wish_image || "",
        profile_wish_image_is_public: w.profile_wish_image_is_public === 0 || w.profile_wish_image_is_public === "0" ? 0 : 1,
        profile_wish_start: w.profile_wish_start || "",
        profile_wish_end: w.profile_wish_end || "",
        profile_wish_location: w.profile_wish_location || "",
        profile_wish_mode: w.profile_wish_mode || "",
        ...(w.profile_wish_uid && (w.profile_wish_updated_at != null || w.updated_at != null) ? { profile_wish_updated_at: w.profile_wish_updated_at ?? w.updated_at } : {}),
        helpNeeds: w.helpNeeds || "",
        details: w.details || "",
        amount: w.amount || "",
        cost: w.cost || "",
        isPublic: w.isPublic,
      }));
      payload.append("wishes_info", JSON.stringify(wishesPayload));

      const experiencePayload = (formData.experience || []).map((exp) => {
        const base = {
          company: exp.company || "",
          title: exp.title || "",
          description: exp.description || "",
          startDate: exp.startDate || "",
          endDate: exp.endDate || "",
          isPublic: exp.isPublic ? 1 : 0,
          profile_experience_image: exp.profile_experience_image || "",
          profile_experience_image_is_public: exp.profile_experience_image_is_public === 0 || exp.profile_experience_image_is_public === "0" ? 0 : 1,
        };
        if (exp.profile_experience_uid) {
          return { profile_experience_uid: exp.profile_experience_uid, ...base };
        }
        return base;
      });

      console.log("Experience payload being sent:", experiencePayload);
      payload.append("experience_info", JSON.stringify(experiencePayload));

      const educationPayload = (formData.education || []).map((edu) => {
        const base = {
          school: edu.school || "",
          degree: edu.degree || "",
          startDate: edu.startDate || "",
          endDate: edu.endDate || "",
          isPublic: edu.isPublic ? 1 : 0,
          profile_education_image: edu.profile_education_image || "",
          profile_education_image_is_public: edu.profile_education_image_is_public === 0 || edu.profile_education_image_is_public === "0" ? 0 : 1,
          profile_education_school_name: edu.school || "",
          profile_education_degree: edu.degree || "",
          profile_education_start_date: edu.startDate || "",
          profile_education_end_date: edu.endDate || "",
          profile_education_is_public: edu.isPublic ? 1 : 0,
        };
        if (edu.profile_education_uid) {
          return { profile_education_uid: edu.profile_education_uid, ...base };
        }
        return base;
      });
      payload.append("education_info", JSON.stringify(educationPayload));

      const expertisePayload = (formData.expertise || []).map((e) => ({
        profile_expertise_uid: e.profile_expertise_uid || "",
        profile_expertise_title: e.name || "",
        profile_expertise_description: e.description || "",
        profile_expertise_quantity: e.quantity != null && e.quantity !== "" ? String(e.quantity) : "",
        profile_expertise_cost: e.cost || "",
        profile_expertise_bounty: e.bounty || "",
        profile_expertise_is_public: e.isPublic ? 1 : 0,
        profile_expertise_image: e.profile_expertise_image || "",
        profile_expertise_image_is_public: e.profile_expertise_image_is_public === 0 || e.profile_expertise_image_is_public === "0" ? 0 : 1,
        profile_expertise_start: e.profile_expertise_start || "",
        profile_expertise_end: e.profile_expertise_end || "",
        profile_expertise_location: e.profile_expertise_location || "",
        profile_expertise_latitude: e.profile_expertise_latitude ?? null,
        profile_expertise_longitude: e.profile_expertise_longitude ?? null,
        profile_expertise_city: e.profile_expertise_city || "",
        profile_expertise_state: e.profile_expertise_state || "",
        profile_expertise_mode: e.profile_expertise_mode || "",
        profile_expertise_is_taxable: e.profile_expertise_is_taxable === 1 || e.profile_expertise_is_taxable === "1" ? 1 : 0,
        profile_expertise_tax_rate: e.profile_expertise_tax_rate || "",
        ...(e.profile_expertise_uid && (e.profile_expertise_updated_at != null || e.updated_at != null) ? { profile_expertise_updated_at: e.profile_expertise_updated_at ?? e.updated_at } : {}),
        name: e.name || "",
        description: e.description || "",
        quantity: e.quantity || "",
        cost: e.cost || "",
        bounty: e.bounty || "",
        isPublic: e.isPublic,
      }));
      payload.append("expertise_info", JSON.stringify(expertisePayload));
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
              // individualIsPublic: biz.individualIsPublic ? 1 : 0,
              individualIsPublic: biz.isPublic ? 1 : 0,
              ...(biz.business_updated_at != null || biz.updated_at != null ? { business_updated_at: biz.business_updated_at ?? biz.updated_at } : {}),
            };
          }

          // If it's a new business, don't include profile_business_uid at all
          return {
            business_id: biz.business_uid || "",
            profile_business_role: biz.role || "",
            isPublic: biz.isPublic ? 1 : 0,
            isApproved: 1, // Set to approved for new businesses
            profile_business_approver_id: profileUID, // Use the current user's profile UID as approver
            // individualIsPublic: biz.individualIsPublic ? 1 : 0,
            individualIsPublic: biz.isPublic ? 1 : 0,
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
        }),
      );

      if (profileImageUri && !imageError && profileImageUri !== originalProfileImage) {
        if (Platform.OS === "web" && webImageFile) {
          // On web, use the actual File object
          imageFileSize = webImageFile.size || 0;
          console.log("Image file size (bytes):", imageFileSize);
          payload.append("profile_image", webImageFile);
        } else {
          // On mobile, use FileSystem to get file info
          try {
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
          } catch (error) {
            console.error("Error getting file info:", error);
            // If FileSystem fails, try to use the URI directly (for web fallback)
            if (profileImageUri.startsWith("data:")) {
              // Convert data URL to blob for web
              const response = await fetch(profileImageUri);
              const blob = await response.blob();
              imageFileSize = blob.size || 0;
              const file = new File([blob], "profile.jpg", { type: blob.type });
              payload.append("profile_image", file);
            }
          }
        }
      }

      // Only add delete_profile_image if there's an image to delete and it hasn't errored
      if (deleteProfileImage && !imageError) {
        payload.append("delete_profile_image", deleteProfileImage);
      }

      const isBlobOrDataUri = (uri) => uri && (uri.startsWith("blob:") || uri.startsWith("data:"));

      for (let index = 0; index < (formData.expertise || []).length; index++) {
        const e = formData.expertise[index];
        if (e._expDeleteImageUrl) {
          payload.append(`delete_profile_expertise_image_${index}`, e._expDeleteImageUrl);
        }
        const newUri = e._expNewImageUri;
        const webFile = e._expWebImageFile;
        if (!newUri && !(Platform.OS === "web" && webFile)) continue;

        let fileToAppend = null;
        if (Platform.OS === "web" && webFile) {
          fileToAppend = webFile;
        } else if (Platform.OS === "web" && newUri && isBlobOrDataUri(newUri)) {
          try {
            const response = await fetch(newUri);
            const blob = await response.blob();
            fileToAppend = new File([blob], `profile_expertise_image_${index}.jpg`, { type: blob.type || "image/jpeg" });
          } catch (err) {
            console.error("Failed to prepare offering image (web):", err);
          }
        } else if (newUri && (newUri.startsWith("file:") || newUri.startsWith("content:"))) {
          const uriParts = newUri.split(".");
          const fileType = uriParts.length > 1 ? uriParts[uriParts.length - 1].split(/[?#]/)[0] : "jpg";
          const mimeType = ["jpg", "jpeg", "png", "gif", "webp"].includes(fileType.toLowerCase()) ? `image/${fileType === "jpg" ? "jpeg" : fileType}` : "image/jpeg";
          fileToAppend = { uri: newUri, type: mimeType, name: `profile_expertise_image_${index}.${fileType}` };
        } else if (newUri && newUri.startsWith("data:")) {
          try {
            const response = await fetch(newUri);
            const blob = await response.blob();
            fileToAppend = new File([blob], `profile_expertise_image_${index}.jpg`, { type: blob.type || "image/jpeg" });
          } catch (err) {
            console.error("Failed to prepare offering image:", err);
          }
        }

        if (fileToAppend) {
          payload.append(`profile_expertise_image_${index}`, fileToAppend);
        }
      }

      for (let index = 0; index < (formData.expertise || []).length; index++) {
        const e = formData.expertise[index];
        const imgPublic = e.profile_expertise_image_is_public === 1 || e.profile_expertise_image_is_public === "1" || e.profile_expertise_image_is_public === true;
        payload.append(`profile_expertise_image_${index}_is_public`, imgPublic ? "1" : "0");
      }

      for (let index = 0; index < (formData.wishes || []).length; index++) {
        const w = formData.wishes[index];
        if (w._wishDeleteImageUrl) {
          payload.append(`delete_profile_wish_image_${index}`, w._wishDeleteImageUrl);
        }
        const newUri = w._wishNewImageUri;
        const webFile = w._wishWebImageFile;
        if (!newUri && !(Platform.OS === "web" && webFile)) continue;

        let fileToAppend = null;
        if (Platform.OS === "web" && webFile) {
          fileToAppend = webFile;
        } else if (Platform.OS === "web" && newUri && isBlobOrDataUri(newUri)) {
          try {
            const response = await fetch(newUri);
            const blob = await response.blob();
            fileToAppend = new File([blob], `profile_wish_image_${index}.jpg`, { type: blob.type || "image/jpeg" });
          } catch (err) {
            console.error("Failed to prepare seeking image (web):", err);
          }
        } else if (newUri && (newUri.startsWith("file:") || newUri.startsWith("content:"))) {
          const uriParts = newUri.split(".");
          const fileType = uriParts.length > 1 ? uriParts[uriParts.length - 1].split(/[?#]/)[0] : "jpg";
          const mimeType = ["jpg", "jpeg", "png", "gif", "webp"].includes(fileType.toLowerCase()) ? `image/${fileType === "jpg" ? "jpeg" : fileType}` : "image/jpeg";
          fileToAppend = { uri: newUri, type: mimeType, name: `profile_wish_image_${index}.${fileType}` };
        } else if (newUri && newUri.startsWith("data:")) {
          try {
            const response = await fetch(newUri);
            const blob = await response.blob();
            fileToAppend = new File([blob], `profile_wish_image_${index}.jpg`, { type: blob.type || "image/jpeg" });
          } catch (err) {
            console.error("Failed to prepare seeking image:", err);
          }
        }

        if (fileToAppend) {
          payload.append(`profile_wish_image_${index}`, fileToAppend);
        }
      }

      for (let index = 0; index < (formData.wishes || []).length; index++) {
        const w = formData.wishes[index];
        const imgPublic = w.profile_wish_image_is_public === 1 || w.profile_wish_image_is_public === "1" || w.profile_wish_image_is_public === true;
        payload.append(`profile_wish_image_${index}_is_public`, imgPublic ? "1" : "0");
      }

      for (let index = 0; index < (formData.experience || []).length; index++) {
        const exp = formData.experience[index];
        if (exp._jobDeleteImageUrl) {
          payload.append(`delete_profile_experience_image_${index}`, exp._jobDeleteImageUrl);
        }
        const newUri = exp._jobNewImageUri;
        const webFile = exp._jobWebImageFile;
        if (!newUri && !(Platform.OS === "web" && webFile)) continue;

        let fileToAppend = null;
        if (Platform.OS === "web" && webFile) {
          fileToAppend = webFile;
        } else if (Platform.OS === "web" && newUri && isBlobOrDataUri(newUri)) {
          try {
            const response = await fetch(newUri);
            const blob = await response.blob();
            fileToAppend = new File([blob], `profile_experience_image_${index}.jpg`, { type: blob.type || "image/jpeg" });
          } catch (err) {
            console.error("Failed to prepare experience image (web):", err);
          }
        } else if (newUri && (newUri.startsWith("file:") || newUri.startsWith("content:"))) {
          const uriParts = newUri.split(".");
          const fileType = uriParts.length > 1 ? uriParts[uriParts.length - 1].split(/[?#]/)[0] : "jpg";
          const mimeType = ["jpg", "jpeg", "png", "gif", "webp"].includes(fileType.toLowerCase()) ? `image/${fileType === "jpg" ? "jpeg" : fileType}` : "image/jpeg";
          fileToAppend = { uri: newUri, type: mimeType, name: `profile_experience_image_${index}.${fileType}` };
        } else if (newUri && newUri.startsWith("data:")) {
          try {
            const response = await fetch(newUri);
            const blob = await response.blob();
            fileToAppend = new File([blob], `profile_experience_image_${index}.jpg`, { type: blob.type || "image/jpeg" });
          } catch (err) {
            console.error("Failed to prepare experience image:", err);
          }
        }

        if (fileToAppend) {
          payload.append(`profile_experience_image_${index}`, fileToAppend);
        }
      }

      for (let index = 0; index < (formData.experience || []).length; index++) {
        const exp = formData.experience[index];
        const imgPublic = exp.profile_experience_image_is_public === 1 || exp.profile_experience_image_is_public === "1" || exp.profile_experience_image_is_public === true;
        payload.append(`profile_experience_image_${index}_is_public`, imgPublic ? "1" : "0");
      }

      for (let index = 0; index < (formData.education || []).length; index++) {
        const edu = formData.education[index];
        if (edu._eduDeleteImageUrl) {
          payload.append(`delete_profile_education_image_${index}`, edu._eduDeleteImageUrl);
        }
        const newUri = edu._eduNewImageUri;
        const webFile = edu._eduWebImageFile;
        if (!newUri && !(Platform.OS === "web" && webFile)) continue;

        let fileToAppend = null;
        if (Platform.OS === "web" && webFile) {
          fileToAppend = webFile;
        } else if (Platform.OS === "web" && newUri && isBlobOrDataUri(newUri)) {
          try {
            const response = await fetch(newUri);
            const blob = await response.blob();
            fileToAppend = new File([blob], `profile_education_image_${index}.jpg`, { type: blob.type || "image/jpeg" });
          } catch (err) {
            console.error("Failed to prepare education image (web):", err);
          }
        } else if (newUri && (newUri.startsWith("file:") || newUri.startsWith("content:"))) {
          const uriParts = newUri.split(".");
          const fileType = uriParts.length > 1 ? uriParts[uriParts.length - 1].split(/[?#]/)[0] : "jpg";
          const mimeType = ["jpg", "jpeg", "png", "gif", "webp"].includes(fileType.toLowerCase()) ? `image/${fileType === "jpg" ? "jpeg" : fileType}` : "image/jpeg";
          fileToAppend = { uri: newUri, type: mimeType, name: `profile_education_image_${index}.${fileType}` };
        } else if (newUri && newUri.startsWith("data:")) {
          try {
            const response = await fetch(newUri);
            const blob = await response.blob();
            fileToAppend = new File([blob], `profile_education_image_${index}.jpg`, { type: blob.type || "image/jpeg" });
          } catch (err) {
            console.error("Failed to prepare education image:", err);
          }
        }

        if (fileToAppend) {
          payload.append(`profile_education_image_${index}`, fileToAppend);
        }
      }

      for (let index = 0; index < (formData.education || []).length; index++) {
        const edu = formData.education[index];
        const imgPublic = edu.profile_education_image_is_public === 1 || edu.profile_education_image_is_public === "1" || edu.profile_education_image_is_public === true;
        payload.append(`profile_education_image_${index}_is_public`, imgPublic ? "1" : "0");
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

      // Standardized console log (same format as EditBusinessProfileScreen for easy comparison)
      console.log("============================================");
      console.log("📡 PERSONAL PROFILE – IMAGE PAYLOAD SENT TO BACKEND");
      console.log("============================================");
      console.log("🔗 ENDPOINT:", `${ProfileScreenAPI}?profile_uid=${trimmedProfileUID}`);
      console.log("📝 METHOD: PUT");
      console.log("--------------------------------------------");
      console.log("Image fields (compare with backend expectations):");
      console.log("  profile_image (file):", profileImageUri && !imageError && profileImageUri !== originalProfileImage ? "SENT (file)" : "not sent");
      if (profileImageUri && !imageError && profileImageUri !== originalProfileImage) {
        console.log("    -> file size (bytes):", imageFileSize);
        console.log("    -> (web) file name:", Platform.OS === "web" && webImageFile ? webImageFile.name : "N/A");
      }
      console.log("  delete_profile_image (URL):", deleteProfileImage || "(not sent)");
      console.log("  profile_personal_image_is_public:", formData.imageIsPublic ? "1" : "0");
      console.log("--------------------------------------------");
      console.log("============================================");

      console.log("Deleted items being sent:", deletedItems);
      // Use fetch (not axios) for multipart FormData — axios often throws Network Error on native.
      const response = await fetch(`${ProfileScreenAPI}?profile_uid=${encodeURIComponent(trimmedProfileUID)}`, {
        method: "PUT",
        body: payload,
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 413) {
          Alert.alert("File Too Large", `The selected image (${(imageFileSize / 1024).toFixed(1)} KB) was too large to upload. Please select an image under 2MB.`);
          return;
        }
        let errBody = "";
        try {
          const errJson = await response.json();
          errBody = errJson?.message || JSON.stringify(errJson);
        } catch {
          /* ignore */
        }
        throw new Error(errBody || `Update failed (${response.status})`);
      }

      if (response.status === 200) {
        console.log("Profile update successful");
        try {
          await refreshSessionProfileFromNetwork(trimmedProfileUID);
        } catch (e) {
          console.warn("EditProfileScreen - refreshSessionProfileFromNetwork failed:", e);
        }
        Alert.alert("Success", "Profile updated successfully!");
        setOriginalProfileImage(profileImageUri); // Update the original image after successful save
        setWebImageFile(null); // Clear the web file after successful upload
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
                profile_personal_latitude: homeLat,
                profile_personal_longitude: homeLng,
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
      console.error("Update Error:", error);
      let errorMsg = error.message || "Update failed. Please try again.";
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
        <View style={styles.toggleContainer}>
          <TouchableOpacity onPress={() => handleToggleVisibility(visibilityFieldName)} style={[styles.togglePill, isPublic && styles.togglePillActiveGreen]}>
            <Text style={[styles.togglePillText, isPublic && styles.togglePillTextActive]}>{isPublic ? "Visible" : "Show"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleToggleVisibility(visibilityFieldName)} style={[styles.togglePill, !isPublic && styles.togglePillActiveRed]}>
            <Text style={[styles.togglePillText, !isPublic && styles.togglePillTextActive]}>{!isPublic ? "Hidden" : "Hide"}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TextInput
        style={[styles.input, !editable && (darkMode ? styles.darkDisabledInput : styles.disabledInput), darkMode && editable && styles.darkInput]}
        value={value}
        onChangeText={(text) => handleFieldChange(fieldName, text)}
        editable={editable}
        placeholder={`Enter ${label.toLowerCase()}`}
        placeholderTextColor={darkMode ? "#cccccc" : "#999999"}
        maxLength={fieldName === "phoneNumber" ? 14 : undefined}
        keyboardType={fieldName === "phoneNumber" ? "phone-pad" : "default"}
      />
    </View>
  );

  const renderShortBioField = () => (
    <View style={styles.fieldContainer}>
      {/* Row: Label and Toggle */}
      <View style={styles.labelRow}>
        <Text style={[styles.label, darkMode && styles.darkLabel]}>Short Bio (max 500 characters)</Text>
        <View style={styles.toggleContainer}>
          <TouchableOpacity onPress={() => handleToggleVisibility("shortBioIsPublic")} style={[styles.togglePill, formData.shortBioIsPublic && styles.togglePillActiveGreen]}>
            <Text style={[styles.togglePillText, formData.shortBioIsPublic && styles.togglePillTextActive]}>{formData.shortBioIsPublic ? "Visible" : "Show"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleToggleVisibility("shortBioIsPublic")} style={[styles.togglePill, !formData.shortBioIsPublic && styles.togglePillActiveRed]}>
            <Text style={[styles.togglePillText, !formData.shortBioIsPublic && styles.togglePillTextActive]}>{!formData.shortBioIsPublic ? "Hidden" : "Hide"}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TextInput
        style={[styles.input, styles.textarea, { height: Math.max(40, shortBioHeight) }, darkMode && styles.darkInput]}
        value={formData.shortBio}
        onChangeText={(text) => handleFieldChange("shortBio", text)}
        placeholder='Submit Here'
        placeholderTextColor={darkMode ? "#aaaaaa" : "#999999"}
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
    setIsChanged(true);
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
          },
        );
      } catch (error) {
        // Fallback: scroll to end
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    }, 200);
  };

  // Center a newly added section card if it appears below current viewport.
  const scrollNewCardToMiddleIfNeeded = (targetRef) => {
    // targetRef is the newly added card view passed up from child sections.
    if (!targetRef || !scrollViewRef.current) return;

    setTimeout(() => {
      try {
        const targetHandle = findNodeHandle(targetRef);
        const scrollHandle = findNodeHandle(scrollViewRef.current);
        if (!targetHandle || !scrollHandle) return;

        UIManager.measureLayout(
          targetHandle,
          scrollHandle,
          () => {},
          (x, y, width, height) => {
            // y/height are relative to current viewport origin (current scroll position).
            const viewportHeight = scrollViewportHeightRef.current;
            const currentScrollY = scrollOffsetYRef.current;
            if (!viewportHeight) return;

            // If card is already in viewport, do not scroll.
            const elementBottomInViewport = y + height;
            if (elementBottomInViewport <= viewportHeight) return;

            // Scroll just enough to place the new card near viewport center.
            const centerOffset = viewportHeight / 2 - height / 2;
            const targetScrollY = Math.max(0, currentScrollY + (y - centerOffset));
            scrollViewRef.current?.scrollTo({ y: targetScrollY, animated: true });
          },
        );
      } catch (error) {}
    }, 100);
  };

  // To get the new card’s exact on-screen position relative to the ScrollView.

  // We need that y + height to decide:

  // Is the card already visible?
  // If not, how far should we scroll so it lands near center?
  // Without UIManager.measureLayout, scrollTo would be guesswork.
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

  // Handle back button press with unsaved changes warning
  useEffect(() => {
    const handleBackPress = () => {
      if (isChanged) {
        Alert.alert("Unsaved Changes", "You have unsaved changes. Are you sure you want to leave this page?", [
          {
            text: "No",
            style: "cancel",
          },
          {
            text: "Yes",
            onPress: () => navigation.goBack(),
          },
        ]);
        return true; // Prevent default back action
      }
      return false; // Allow default back action
    };

    if (Platform.OS === "android") {
      const sub = BackHandler.addEventListener("hardwareBackPress", handleBackPress);
      return () => sub.remove();
    }
  }, [isChanged, navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: darkMode ? "#1a1a1a" : "#ffffff" }}>
      <AppHeader
        title='EDIT PROFILE'
        {...getHeaderColors("editProfile")}
        onBackPress={() => {
          console.log("Back button pressed, isChanged:", isChanged);
          if (isChanged) {
            setShowUnsavedChangesModal(true);
          } else {
            navigation.goBack();
          }
        }}
      />
      <ScrollView
        ref={scrollViewRef}
        onLayout={(e) => {
          // Keep viewport height updated for center calculations.
          scrollViewportHeightRef.current = e.nativeEvent.layout.height;
        }}
        onScroll={(e) => {
          // Keep current scroll position updated for center calculations.
          scrollOffsetYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        style={{ flex: 1, padding: 20, backgroundColor: darkMode ? "#1a1a1a" : "#ffffff" }}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={true}
      >
        <View style={[styles.imageSection, darkMode && styles.darkImageSection]}>
          <Text style={[styles.label, darkMode && styles.darkLabel]}>Profile Image</Text>
          <Image
            source={profileImageUri && !imageError ? { uri: profileImageUri } : DEFAULT_PROFILE_IMAGE}
            style={[styles.profileImage, darkMode && styles.darkProfileImage]}
            tintColor={darkMode ? "#ffffff" : undefined}
            onError={handleImageError}
          />
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View style={styles.toggleContainer}>
              <TouchableOpacity onPress={toggleProfileImageVisibility} style={[styles.togglePill, !formData.imageIsPublic && styles.togglePillActiveRed]}>
                <Text style={[styles.togglePillText, !formData.imageIsPublic && styles.togglePillTextActive]}>{!formData.imageIsPublic ? "Hidden" : "Hide"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleProfileImageVisibility} style={[styles.togglePill, formData.imageIsPublic && styles.togglePillActiveGreen]}>
                <Text style={[styles.togglePillText, formData.imageIsPublic && styles.togglePillTextActive]}>{formData.imageIsPublic ? "Visible" : "Show"}</Text>
              </TouchableOpacity>
            </View>
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

        {/* Card Live Preview Section */}
        <View style={[styles.previewSection, darkMode && styles.darkPreviewSection]}>
          <Text style={[styles.label, darkMode && styles.darkLabel]}>Micro Card (how you'll appear in Connections):</Text>
          <View style={styles.previewCardSpacing}>
            <MicroCard key={`microcard-${imageUpdateKey}`} user={previewUser} showRelationship={false} />
          </View>
          <Text style={[styles.label, darkMode && styles.darkLabel]}>Mini Card (how you'll appear in Searches):</Text>
          <MiniCard key={`minicard-${imageUpdateKey}`} user={previewUser} />
        </View>

        {/* PROFILE Section */}
        <TouchableOpacity style={[styles.sectionHeader, darkMode && styles.darkSectionHeader]} onPress={() => setShowProfile(!showProfile)} activeOpacity={0.7}>
          <Text style={[styles.sectionHeaderText, darkMode && styles.darkSectionHeaderText]}>PROFILE</Text>
          <Ionicons name={showProfile ? "chevron-up" : "chevron-down"} size={20} color={darkMode ? "#ffffff" : "#000"} />
        </TouchableOpacity>
        {showProfile && (
          <>
            {renderField("First Name (Public)", formData.firstName, true, "firstName", "firstNameIsPublic")}
            {renderField("Last Name (Public)", formData.lastName, true, "lastName", "lastNameIsPublic")}
            {renderField("Phone Number", formData.phoneNumber, formData.phoneIsPublic, "phoneNumber", "phoneIsPublic")}
            {renderField("Email", formData.email, formData.emailIsPublic, "email", "emailIsPublic")}
            {renderHomeAddressField()}
            {renderField("City", formData.city, formData.locationIsPublic, "city", "locationIsPublic")}
            {renderField("State", formData.state, formData.locationIsPublic, "state", "locationIsPublic")}
          </>
        )}

        {/* BIO Section */}
        <TouchableOpacity style={[styles.sectionHeader, darkMode && styles.darkSectionHeader]} onPress={() => setShowBio(!showBio)} activeOpacity={0.7}>
          <Text style={[styles.sectionHeaderText, darkMode && styles.darkSectionHeaderText]}>BIO</Text>
          <Ionicons name={showBio ? "chevron-up" : "chevron-down"} size={20} color={darkMode ? "#ffffff" : "#000"} />
        </TouchableOpacity>
        {showBio && (
          <>
            {renderField("Tagline", formData.tagLine, formData.tagLineIsPublic, "tagLine", "tagLineIsPublic")}
            {renderShortBioField()}
          </>
        )}

        {/* OFFERING Section */}
        <TouchableOpacity style={[styles.sectionHeader, darkMode && styles.darkSectionHeader]} onPress={() => setShowOffering(!showOffering)} activeOpacity={0.7}>
          <Text style={[styles.sectionHeaderText, darkMode && styles.darkSectionHeaderText]}>OFFERING</Text>
          <Ionicons name={showOffering ? "chevron-up" : "chevron-down"} size={20} color={darkMode ? "#ffffff" : "#000"} />
        </TouchableOpacity>
        {showOffering && (
          <ExpertiseSection
            expertise={formData.expertise}
            setExpertise={(e) => {
              setFormData((prev) => ({ ...prev, expertise: e }));
              setIsChanged(true);
            }}
            toggleVisibility={() => handleToggleVisibility("expertiseIsPublic")}
            isPublic={formData.expertiseIsPublic}
            handleDelete={handleDeleteExpertise}
            profileUid={profileUID.trim()}
            darkMode={darkMode}
            onInputFocus={(inputRef) => {
              // Called by child after "+" render with new card ref.
              scrollNewCardToMiddleIfNeeded(inputRef);
            }}
          />
        )}

        {/* SEEKING Section */}
        <TouchableOpacity style={[styles.sectionHeader, darkMode && styles.darkSectionHeader]} onPress={() => setShowSeeking(!showSeeking)} activeOpacity={0.7}>
          <Text style={[styles.sectionHeaderText, darkMode && styles.darkSectionHeaderText]}>SEEKING</Text>
          <Ionicons name={showSeeking ? "chevron-up" : "chevron-down"} size={20} color={darkMode ? "#ffffff" : "#000"} />
        </TouchableOpacity>
        {showSeeking && (
          <SeekingSection
            wishes={formData.wishes}
            setWishes={(e) => {
              setFormData((prev) => ({ ...prev, wishes: e }));
              setIsChanged(true);
            }}
            toggleVisibility={() => handleToggleVisibility("wishesIsPublic")}
            isPublic={formData.wishesIsPublic}
            handleDelete={handleDeleteWish}
            profileUid={profileUID.trim()}
            darkMode={darkMode}
            onInputFocus={(inputRef) => {
              // Called by child after "+" render with new card ref.
              scrollNewCardToMiddleIfNeeded(inputRef);
            }}
          />
        )}

        {/* EXPERIENCE Section */}
        <TouchableOpacity style={[styles.sectionHeader, darkMode && styles.darkSectionHeader]} onPress={() => setShowExperience(!showExperience)} activeOpacity={0.7}>
          <Text style={[styles.sectionHeaderText, darkMode && styles.darkSectionHeaderText]}>EXPERIENCE</Text>
          <Ionicons name={showExperience ? "chevron-up" : "chevron-down"} size={20} color={darkMode ? "#ffffff" : "#000"} />
        </TouchableOpacity>
        {showExperience && (
          <ExperienceSection
            experience={formData.experience}
            setExperience={(e) => {
              setFormData((prev) => ({ ...prev, experience: e }));
              setIsChanged(true);
            }}
            toggleVisibility={() => handleToggleVisibility("experienceIsPublic")}
            isPublic={formData.experienceIsPublic}
            handleDelete={handleDeleteExperience}
            profileUid={profileUID.trim()}
            darkMode={darkMode}
            onInputFocus={(inputRef) => {
              // Called by child after "+" render with new card ref.
              scrollNewCardToMiddleIfNeeded(inputRef);
            }}
          />
        )}

        {/* EDUCATION Section */}
        <TouchableOpacity style={[styles.sectionHeader, darkMode && styles.darkSectionHeader]} onPress={() => setShowEducation(!showEducation)} activeOpacity={0.7}>
          <Text style={[styles.sectionHeaderText, darkMode && styles.darkSectionHeaderText]}>EDUCATION</Text>
          <Ionicons name={showEducation ? "chevron-up" : "chevron-down"} size={20} color={darkMode ? "#ffffff" : "#000"} />
        </TouchableOpacity>
        {showEducation && (
          <EducationSection
            education={formData.education}
            setEducation={(e) => {
              setFormData((prev) => ({ ...prev, education: e }));
              setIsChanged(true);
            }}
            toggleVisibility={() => handleToggleVisibility("educationIsPublic")}
            isPublic={formData.educationIsPublic}
            handleDelete={handleDeleteEducation}
            profileUid={profileUID.trim()}
            darkMode={darkMode}
            onInputFocus={(inputRef) => {
              // Called by child after "+" render with new card ref.
              scrollNewCardToMiddleIfNeeded(inputRef);
            }}
          />
        )}

        {/* BUSINESSES / ORGANIZATIONS Section */}
        <TouchableOpacity style={[styles.sectionHeader, darkMode && styles.darkSectionHeader]} onPress={() => setShowBusiness(!showBusiness)} activeOpacity={0.7}>
          <Text style={[styles.sectionHeaderText, darkMode && styles.darkSectionHeaderText]}>BUSINESSES / ORGANIZATIONS</Text>
          <Ionicons name={showBusiness ? "chevron-up" : "chevron-down"} size={20} color={darkMode ? "#ffffff" : "#000"} />
        </TouchableOpacity>
        {showBusiness && (
          <BusinessSection
            businesses={formData.businesses}
            setBusinesses={(e) => {
              setFormData((prev) => ({ ...prev, businesses: e }));
              setIsChanged(true);
            }}
            toggleVisibility={() => handleToggleVisibility("businessIsPublic")}
            isPublic={formData.businessIsPublic}
            handleDelete={handleDeleteBusiness}
            navigation={navigation}
            preFetchedBusinessesData={preFetchedBusinessesData}
            onInputFocus={(inputRef) => {
              // Called by child after "+" render with new card ref.
              scrollNewCardToMiddleIfNeeded(inputRef);
            }}
          />
        )}

        <TouchableOpacity
          style={[styles.saveButton, !isChanged && (darkMode ? styles.darkDisabledButton : styles.disabledButton), darkMode && styles.darkSaveButton]}
          onPress={handleSave}
          disabled={!isChanged || isLoading}
        >
          {isLoading ? <ActivityIndicator size='small' color={darkMode ? "#ffffff" : "#fff"} /> : <Text style={[styles.saveText, darkMode && styles.darkSaveText]}>Submit</Text>}
        </TouchableOpacity>
      </ScrollView>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10 }}>
        <BottomNavBar
          navigation={navigation}
          onBeforeNavigate={(destination) => {
            console.log("BottomNavBar navigation intercepted, destination:", destination, "isChanged:", isChanged);
            if (isChanged) {
              setPendingNavigation(destination);
              setShowUnsavedChangesModal(true);
              return false; // Prevent navigation
            }
            return true; // Allow navigation
          }}
        />
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

      {/* Unsaved Changes Modal */}
      <Modal visible={showUnsavedChangesModal} transparent={true} animationType='fade' onRequestClose={() => setShowUnsavedChangesModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}>
          <View style={[styles.modalContainer, darkMode && styles.darkModalContainer]}>
            <Text style={[styles.modalText, darkMode && styles.darkModalText]}>You have unsaved changes. Are you sure you want to leave this page?</Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#999" }]}
                onPress={() => {
                  setShowUnsavedChangesModal(false);
                  setPendingNavigation(null);
                }}
              >
                <Text style={[styles.modalButtonText, darkMode && styles.darkModalButtonText]}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, darkMode && styles.darkModalButton]}
                onPress={() => {
                  setShowUnsavedChangesModal(false);
                  if (pendingNavigation) {
                    navigation.navigate(pendingNavigation);
                    setPendingNavigation(null);
                  } else {
                    navigation.goBack();
                  }
                }}
              >
                <Text style={[styles.modalButtonText, darkMode && styles.darkModalButtonText]}>Yes</Text>
              </TouchableOpacity>
            </View>
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
  previewCardSpacing: { marginBottom: 16 },

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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgb(243, 165, 165)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    marginTop: 16,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000",
    letterSpacing: 1,
  },
  darkSectionHeader: {
    backgroundColor: "rgb(180, 100, 100)",
  },
  darkSectionHeaderText: {
    color: "#ffffff",
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
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 25,
    backgroundColor: "#f0f0f0",
    color: "#000",
  },
  textarea: {
    minHeight: 40,
    maxHeight: 200,
    borderRadius: 12,
  },
  toggleContainer: {
    flexDirection: "row",
    gap: 4,
  },
  togglePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  togglePillActiveGreen: {
    backgroundColor: "#4CAF50",
  },
  togglePillActiveRed: {
    backgroundColor: "#ef9a9a",
  },
  togglePillText: {
    fontSize: 13,
    color: "#4e4e4e",
    fontWeight: "500",
  },
  togglePillTextActive: {
    color: "#fff",
    fontWeight: "bold",
  },
  homeCoordHint: {
    fontSize: 13,
    color: "#666",
    marginBottom: 8,
    lineHeight: 18,
  },
  darkHomeCoordHint: {
    color: "#aaa",
  },
  alwaysHiddenLabel: {
    color: "#666666",
    fontStyle: "italic",
  },
  darkAlwaysHiddenLabel: {
    color: "#999999",
  },
  placesSearchContainer: {
    zIndex: 10,
  },
  placesSuggestionsList: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#ccc",
    maxHeight: 220,
    overflow: "hidden",
  },
  darkPlacesSuggestionsList: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  placesSuggestionRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  darkPlacesSuggestionRow: {
    borderBottomColor: "#404040",
  },
  placesSuggestionMain: {
    fontSize: 15,
    color: "#333",
    fontWeight: "600",
  },
  placesSuggestionSub: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  inputError: {
    borderColor: "#c62828",
  },
});

export default EditProfileScreen;
