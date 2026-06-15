import React, { useEffect, useState, useRef } from "react";
import { View, Text, TextInput, StyleSheet, Dimensions, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Image, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBusinessSuggestions, getPlaceDetails } from "../utils/googlePlaces";
import { googlePhotoUrlsMatch, dedupeGooglePhotoUrls } from "../utils/resolveBusinessProfileImage";
import { BUSINESS_INFO_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "../utils/httpMiddleware";
import { useDarkMode } from "../contexts/DarkModeContext";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";

const { width } = Dimensions.get("window");

export default function BusinessStep0({ formData, setFormData, navigation }) {
  const { darkMode } = useDarkMode();
  // console.log("BusinessStep0 - darkMode value:", darkMode);
  const [loading, setLoading] = useState(false);
  const [placeSearchText, setPlaceSearchText] = useState("");
  const [placeSuggestions, setPlaceSuggestions] = useState([]);
  const placesDebounceRef = useRef(null);
  const userUploadedImages = formData.images || [];
  const hasGooglePlace = Boolean(formData.googleId);
  const googlePhotos = hasGooglePlace ? formData.businessGooglePhotos || [] : [];

  useEffect(() => {
    console.log("In BusinessStep0");
    // Don't load saved form data - start fresh for new business
    // const loadSavedForm = async () => {
    //   try {
    //     const stored = await AsyncStorage.getItem('businessFormData');
    //     if (stored) {
    //       const parsed = JSON.parse(stored);
    //       setFormData(prev => ({ ...prev, ...parsed }));
    //     }
    //   } catch (err) {
    //     console.error('Error loading saved form data:', err);
    //   }
    // };
    // loadSavedForm();
  }, []);

  const formatPhoneNumber = (text) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, "");

    // Limit to 10 digits
    if (cleaned.length > 10) {
      return text.slice(0, -1);
    }

    // Format based on length
    if (cleaned.length === 0) return "";
    if (cleaned.length <= 3) return `(${cleaned}`;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  };

  const updateFormData = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    AsyncStorage.setItem("businessFormData", JSON.stringify(updated)).catch((err) => console.error("Save error", err));
  };

  const addressIsPublic = formData.business_location_is_public === 1 || formData.business_location_is_public === "1";

  const toggleAddressVisibility = () => {
    updateFormData("business_location_is_public", addressIsPublic ? 0 : 1);
  };

  const selectBusinessImage = (uri) => {
    updateFormData("favImage", uri);
  };

  const pickNextLogo = (photos, uploads, excludeUri = "") => {
    const nextGoogle = photos.find((photo) => photo !== excludeUri);
    if (nextGoogle) return nextGoogle;
    const nextUpload = uploads.find((upload) => upload !== excludeUri);
    return nextUpload || "";
  };

  const removeBusinessImage = (uri, index) => {
    const photos = formData.businessGooglePhotos || [];
    const updatedPhotos = [...photos.slice(0, index), ...photos.slice(index + 1)];
    const updatedFavImage = googlePhotoUrlsMatch(formData.favImage, uri) ? pickNextLogo(updatedPhotos, userUploadedImages) : formData.favImage;
    const updated = {
      ...formData,
      businessGooglePhotos: updatedPhotos,
      favImage: updatedFavImage,
    };
    setFormData(updated);
    AsyncStorage.setItem("businessFormData", JSON.stringify(updated)).catch((err) => console.error("Save error", err));
  };

  const handleImagePick = async (index) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Permission to access media library is required!");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let fileSize = asset.fileSize;
        if (!fileSize && asset.uri) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(asset.uri);
            fileSize = fileInfo.size;
          } catch (e) {
            console.log("Could not get file size from FileSystem", e);
          }
        }
        if (fileSize && fileSize > 2 * 1024 * 1024) {
          Alert.alert("File not selectable", "Image size exceeds the 2MB upload limit.");
          return;
        }
        const updated = [...userUploadedImages];
        updated[index] = asset.uri;
        const newFormData = {
          ...formData,
          images: updated,
          favImage: formData.favImage || asset.uri,
        };
        setFormData(newFormData);
        AsyncStorage.setItem("businessFormData", JSON.stringify(newFormData)).catch((err) => console.error("Save error", err));
      }
    } catch (error) {
      let errorMessage = "Failed to pick image. ";
      if (error.name === "PermissionDenied") {
        errorMessage += "Permission was denied.";
      } else if (error.name === "ImagePickerError") {
        errorMessage += "There was an error with the image picker.";
      } else if (error.message && error.message.includes("permission")) {
        errorMessage += "Permission issue detected.";
      } else if (error.message && error.message.includes("canceled")) {
        errorMessage += "Operation was canceled.";
      }
      Alert.alert("Error", errorMessage);
    }
  };

  const removeUploadedImage = (index) => {
    const removedUri = userUploadedImages[index];
    const updated = [...userUploadedImages.slice(0, index), ...userUploadedImages.slice(index + 1)];
    const updatedFavImage = formData.favImage === removedUri ? pickNextLogo(googlePhotos, updated, removedUri) : formData.favImage;
    const newFormData = { ...formData, images: updated, favImage: updatedFavImage };
    setFormData(newFormData);
    AsyncStorage.setItem("businessFormData", JSON.stringify(newFormData)).catch((err) => console.error("Save error", err));
  };

  const onPlaceSearchChange = (text) => {
    setPlaceSearchText(text);
    if (placesDebounceRef.current) clearTimeout(placesDebounceRef.current);
    if (!text.trim()) {
      setPlaceSuggestions([]);
      return;
    }
    placesDebounceRef.current = setTimeout(async () => {
      try {
        const results = await getBusinessSuggestions(text);
        setPlaceSuggestions(results);
      } catch (err) {
        console.error("BusinessStep0 place suggestions error:", err);
      }
    }, 350);
  };

  const handleGooglePlaceSelect = async (place) => {
    setPlaceSuggestions([]);
    setPlaceSearchText(place.structured_formatting?.main_text || place.description || "");
    setLoading(true);

    try {
      const pd = await getPlaceDetails(place.place_id);
      const photoUrls = dedupeGooglePhotoUrls(pd.photo_urls || []);
      const updated = {
        ...formData,
        businessName: pd.name || place.structured_formatting?.main_text || "",
        location: pd.area_location || "",
        phoneNumber: pd.phone || "",
        website: pd.website || "",
        googleId: place.place_id || "",
        googleRating: pd.rating != null ? String(pd.rating) : "",
        businessGooglePhotos: photoUrls,
        favImage: photoUrls[0] || "",
        priceLevel: "",
        addressLine1: pd.address_line_1 || "",
        addressLine2: "",
        city: pd.city || "",
        state: pd.state || "",
        country: pd.country || "",
        zip: pd.zip || "",
        latitude: pd.lat ?? "",
        longitude: pd.lng ?? "",
        types: [],
      };

      setFormData(updated);
      await AsyncStorage.setItem("businessFormData", JSON.stringify(updated)).catch((err) => console.error("Save error", err));
      fetchProfile(place.place_id);
    } catch (err) {
      console.error("BusinessStep0 place select error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async (googlePlaceId) => {
    try {
      console.log("Fetching business for Place ID:", googlePlaceId);
      setLoading(true);
      const response = await fetch(`${BUSINESS_INFO_ENDPOINT}/${googlePlaceId}`);
      console.log("Business Fetch Response:", response);
      if (response.ok) {
        const result = await response.json();
        console.log("here 3");
        console.log("Business Fetch Result:", result);
        const business = result?.result?.[0];
        if (business) {
          console.log("Business claimed:", business);
        } else {
          console.log("Business not claimed.");
        }
      }
    } catch (error) {
      console.error("Error fetching business profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const businessRoles = [
    { label: "Owner", value: "owner" },
    { label: "Employee", value: "employee" },
    { label: "Partner", value: "partner" },
    { label: "Admin", value: "admin" },
    { label: "Other", value: "other" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: darkMode ? "#1a1a1a" : "#fff" }}>
      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={90}>
          <ScrollView
            style={{ flex: 1, width: "100%" }}
            contentContainerStyle={{
              padding: Platform.OS === "web" ? 40 : 20,
              alignItems: "center",
              paddingBottom: 140,
              minHeight: "100%",
            }}
            keyboardShouldPersistTaps='handled'
            nestedScrollEnabled={true}
          >
            <View style={[styles.formCard, darkMode && styles.darkFormCard, Platform.OS === "web" && styles.formCardWeb]}>
              <Text style={[styles.title, darkMode && styles.darkTitle]}>Welcome to Every Circle!</Text>
              <View style={styles.subtitleBlock}>
                <Text style={[styles.subtitle, darkMode && styles.darkSubtitle]}>Let's Start Building Your Business Page!</Text>
                <Text style={[styles.stepHint, darkMode && styles.darkSubtitle]}>(Step 1 of 2)</Text>
              </View>

              <Text style={[styles.label, darkMode && styles.darkLabel]}>Search for Google Maps Business or Organization</Text>
              <View style={{ width: "100%", marginBottom: 20, zIndex: 1000 }}>
                <TextInput
                  style={[styles.input, darkMode && styles.darkInput]}
                  placeholder='Enter a Business or Organization name'
                  placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                  value={placeSearchText}
                  onChangeText={onPlaceSearchChange}
                  accessibilityLabel='Search for a business or organization'
                  accessibilityHint='Type a business or organization name and choose one from the suggestions'
                  aria-label='Search for a business or organization'
                />
                {placeSuggestions.length > 0 && (
                  <View style={[styles.suggestionsList, darkMode && styles.darkSuggestionsList]}>
                    {placeSuggestions.map((item) => (
                      <TouchableOpacity key={item.place_id} style={[styles.suggestionRow, darkMode && styles.darkSuggestionRow]} onPress={() => handleGooglePlaceSelect(item)} activeOpacity={0.7}>
                        <Text style={[styles.suggestionMain, darkMode && styles.darkLabel]} numberOfLines={1}>
                          {item.structured_formatting?.main_text || item.description}
                        </Text>
                        {item.structured_formatting?.secondary_text ? (
                          <Text style={[styles.suggestionSub, darkMode && styles.darkSubtitle]} numberOfLines={1}>
                            {item.structured_formatting.secondary_text}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <Text style={[styles.orText, darkMode && styles.darkOrText]}>--- OR ---</Text>

              <Text style={[styles.label, darkMode && styles.darkLabel]}>Enter Business Name *</Text>
              <TextInput
                style={[styles.input, darkMode && styles.darkInput]}
                value={formData.businessName || ""}
                placeholder='Enter business name'
                placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                onChangeText={(text) => updateFormData("businessName", text)}
                accessibilitylabel='Business name'
                accessibilityHint='Required'
                aria-label='Business name'
              />

              <Text style={[styles.label, darkMode && styles.darkLabel]}>Phone Number</Text>
              <TextInput
                style={[styles.input, darkMode && styles.darkInput]}
                keyboardType='phone-pad'
                value={formData.phoneNumber || ""}
                placeholder='(000) 000-0000'
                placeholderTextColor={darkMode ? "#ffffff" : "#666"}
                onChangeText={(text) => updateFormData("phoneNumber", formatPhoneNumber(text))}
                accessibilitylabel='Phone number'
                accessibilityHint='Enter your phone number'
                aria-label='Phone number'
              />

              <View style={styles.addressHeaderRow}>
                <Text style={[styles.label, darkMode && styles.darkLabel, styles.addressLabel]}>Address</Text>
                <View style={styles.toggleContainer}>
                  <TouchableOpacity
                    onPress={toggleAddressVisibility}
                    style={[styles.togglePill, addressIsPublic && styles.togglePillActiveGreen]}
                    accessibilityRole='button'
                    accessibilityLabel={addressIsPublic ? "Address is visible on mini card" : "Show address on mini card"}
                  >
                    <Text style={[styles.togglePillText, addressIsPublic && styles.togglePillTextActive]}>{addressIsPublic ? "Visible" : "Show"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={toggleAddressVisibility}
                    style={[styles.togglePill, !addressIsPublic && styles.togglePillActiveRed]}
                    accessibilityRole='button'
                    accessibilityLabel={!addressIsPublic ? "Address is hidden on mini card" : "Hide address on mini card"}
                  >
                    <Text style={[styles.togglePillText, !addressIsPublic && styles.togglePillTextActive]}>{!addressIsPublic ? "Hidden" : "Hide"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={[styles.helperText, darkMode && styles.darkHelperText]}>
                Controls whether location and address appear on your Business Mini Card.
              </Text>
              <TextInput
                style={[styles.input, darkMode && styles.darkInput]}
                value={formData.addressLine1 || ""}
                placeholder='Enter street address'
                placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                onChangeText={(text) => updateFormData("addressLine1", text)}
                accessibilitylabel='Street address'
                accessibilityHint='Enter your street address'
                aria-label='Street address'
              />

              <View style={{ flexDirection: "row", width: "100%", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, darkMode && styles.darkLabel]}>Suite or Unit</Text>
                  <TextInput
                    style={[styles.input, darkMode && styles.darkInput]}
                    value={formData.addressLine2 || ""}
                    placeholder='Suite, unit, etc.'
                    placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                    onChangeText={(text) => updateFormData("addressLine2", text)}
                    accessibilitylabel='Suite or unit'
                    accessibilityHint='Optional suite or unit number'
                    aria-label='Suite or unit'
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, darkMode && styles.darkLabel]}>Location</Text>
                  <TextInput
                    style={[styles.input, darkMode && styles.darkInput]}
                    value={formData.location || ""}
                    placeholder='Neighborhood, area, or landmark'
                    placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                    onChangeText={(text) => updateFormData("location", text)}
                    accessibilitylabel='Location'
                    accessibilityHint='Optional area or location description'
                    aria-label='Location'
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", width: "100%", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, darkMode && styles.darkLabel]}>City</Text>
                  <TextInput
                    style={[styles.input, darkMode && styles.darkInput]}
                    value={formData.city || ""}
                    placeholder='City'
                    placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                    onChangeText={(text) => updateFormData("city", text)}
                    accessibilitylabel='City'
                    accessibilityHint='Enter your city'
                    aria-label='City'
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, darkMode && styles.darkLabel]}>State</Text>
                  <TextInput
                    style={[styles.input, darkMode && styles.darkInput]}
                    value={formData.state || ""}
                    placeholder='State'
                    placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                    onChangeText={(text) => updateFormData("state", text)}
                    accessibilitylabel='State'
                    accessibilityHint='Enter your state'
                    aria-label='State'
                  />
                </View>
              </View>

              <Text style={[styles.label, darkMode && styles.darkLabel]}>Zip Code</Text>
              <TextInput
                style={[styles.input, darkMode && styles.darkInput]}
                keyboardType='number-pad'
                value={formData.zip || ""}
                placeholder='Zip Code'
                placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                onChangeText={(text) => updateFormData("zip", text)}
                accessibilitylabel='Zip code'
                accessibilityHint='Enter your zip code'
                aria-label='Zip code'
              />

              {hasGooglePlace && formData.googleRating ? <Text style={[styles.googleRatingText, darkMode && styles.darkSubtitle]}>Google Rating: {formData.googleRating} ★</Text> : null}

              <Text style={[styles.label, darkMode && styles.darkLabel]}>Business Logo (Optional)</Text>
              <Text style={[styles.helperText, darkMode && styles.darkHelperText]}>Tap any image to select your business logo. Tap ✕ to remove.</Text>
              {hasGooglePlace && googlePhotos.length > 0 ? (
                <>
                  <Text style={[styles.sublabel, darkMode && styles.darkSubtitle]}>Google Images</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.googlePhotosRow} contentContainerStyle={styles.googlePhotosContent}>
                    {googlePhotos.map((uri, index) => {
                      const isSelected = googlePhotoUrlsMatch(formData.favImage, uri);
                      return (
                        <View key={`${uri}-${index}`} style={styles.googlePhotoWrapper}>
                          <TouchableOpacity
                            onPress={() => selectBusinessImage(uri)}
                            activeOpacity={0.8}
                            accessibilityLabel={`Google image ${index + 1}${isSelected ? ", selected as business logo" : ""}`}
                            accessibilityRole='button'
                          >
                            <Image source={{ uri }} style={[styles.googlePhoto, darkMode && styles.darkGooglePhoto, isSelected && styles.googlePhotoSelected]} resizeMode='cover' />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.googlePhotoDeleteIcon}
                            onPress={() => removeBusinessImage(uri, index)}
                            accessibilityLabel={`Remove Google image ${index + 1}`}
                            accessibilityRole='button'
                          >
                            <Text style={styles.googlePhotoDeleteText}>✕</Text>
                          </TouchableOpacity>
                          {isSelected ? (
                            <View style={styles.googlePhotoBadge}>
                              <Text style={styles.googlePhotoBadgeText}>✓</Text>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </ScrollView>
                </>
              ) : null}
              {userUploadedImages.length > 0 ? <Text style={[styles.sublabel, darkMode && styles.darkSubtitle]}>Your Uploads (Optional)</Text> : null}
              <View style={styles.carousel}>
                <View style={styles.imageRow}>
                  {userUploadedImages.map((img, index) => {
                    const isSelected = formData.favImage === img;
                    return (
                      <View key={index} style={styles.googlePhotoWrapper}>
                        <TouchableOpacity
                          onPress={() => selectBusinessImage(img)}
                          activeOpacity={0.8}
                          accessibilityLabel={`Uploaded image ${index + 1}${isSelected ? ", selected as business logo" : ""}`}
                          accessibilityRole='button'
                        >
                          <Image source={{ uri: img }} style={[styles.googlePhoto, darkMode && styles.darkGooglePhoto, isSelected && styles.googlePhotoSelected]} resizeMode='cover' />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.googlePhotoDeleteIcon}
                          onPress={() => removeUploadedImage(index)}
                          accessibilityLabel={`Remove uploaded logo ${index + 1}`}
                          accessibilityRole='button'
                        >
                          <Text style={styles.googlePhotoDeleteText}>✕</Text>
                        </TouchableOpacity>
                        {isSelected ? (
                          <View style={styles.googlePhotoBadge}>
                            <Text style={styles.googlePhotoBadgeText}>✓</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                  <TouchableOpacity
                    style={[styles.uploadBox, darkMode && styles.darkUploadBox]}
                    onPress={() => handleImagePick(userUploadedImages.length)}
                    accessibilityLabel='Upload business logo'
                    accessibilityRole='button'
                  >
                    <Text style={[styles.uploadText, darkMode && styles.darkUploadText]}>Upload Logo</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* <Text style={styles.label}>Business Role</Text>
              <Dropdown
                style={styles.input}
                data={businessRoles}
                labelField="label"
                valueField="value"
                placeholder="Select your role"
                value={formData.businessRole || ''}
                onChange={item => updateFormData('businessRole', item.value)}
                containerStyle={{ borderRadius: 10 }}
              />

              <Text style={styles.label}>EIN Number (Optional)</Text>
              <Text style={styles.helperText}>For verification purposes</Text>
              <TextInput
                style={styles.input}
                value={formData.einNumber || ''}
                placeholder="Enter EIN number"
                onChangeText={text => updateFormData('einNumber', text)}
              /> */}

              {loading && <ActivityIndicator size='large' color='#00C721' style={styles.loadingIndicator} />}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    width: width * 1.3,
    flex: 1,
    // borderRadius: width,
    borderTopLeftRadius: width,
    borderTopRightRadius: width,
    padding: 90,
    paddingTop: 80,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitleBlock: {
    marginBottom: 30,
    width: "100%",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 4,
  },
  stepHint: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  label: {
    alignSelf: "flex-start",
    color: "#333",
    fontWeight: "bold",
    marginBottom: 4,
    marginTop: 5,
  },
  addressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginTop: 5,
  },
  addressLabel: {
    marginTop: 0,
    marginBottom: 0,
  },
  toggleContainer: {
    flexDirection: "row",
    gap: 6,
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
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    width: "100%",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    ...(Platform.OS === "web" && {
      fontSize: 16,
      outlineStyle: "none",
    }),
  },
  loadingIndicator: {
    marginTop: 20,
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 30,
    padding: 20,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    marginBottom: 16,
  },
  formCardWeb: {
    maxWidth: "100%",
    width: "100%",
    borderRadius: 16,
    padding: 40,
  },
  helperText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  sublabel: {
    alignSelf: "flex-start",
    color: "#666",
    fontWeight: "600",
    fontSize: 13,
    marginBottom: 4,
  },
  carousel: {
    marginTop: 0,
    marginBottom: 12,
    width: "100%",
    minHeight: 80,
  },
  imageRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  uploadBox: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  darkUploadBox: {
    backgroundColor: "#404040",
    borderColor: "#555",
  },
  uploadText: {
    color: "#666",
    fontSize: 12,
    textAlign: "center",
  },
  darkUploadText: {
    color: "#cccccc",
  },
  darkHelperText: {
    color: "#cccccc",
  },
  googleRatingText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    alignSelf: "flex-start",
  },

  // Missing styles
  orText: {
    textAlign: "center",
    width: "100%",
    color: "#666",
    marginTop: 8,
    marginBottom: 20,
  },

  // Dark mode styles
  darkFormCard: {
    backgroundColor: "#2d2d2d",
  },
  darkTitle: {
    color: "#ffffff",
  },
  darkSubtitle: {
    color: "#cccccc",
  },
  darkLabel: {
    color: "#ffffff",
  },
  darkInput: {
    backgroundColor: "#404040",
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "#404040",
  },
  darkOrText: {
    color: "#cccccc",
  },
  suggestionsList: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#ddd",
    maxHeight: 220,
    overflow: "hidden",
  },
  darkSuggestionsList: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  suggestionRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  darkSuggestionRow: {
    borderBottomColor: "#404040",
  },
  suggestionMain: {
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
  },
  suggestionSub: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  googlePhotosRow: {
    width: "100%",
    marginBottom: 12,
  },
  googlePhotosContent: {
    flexDirection: "row",
    paddingVertical: 4,
  },
  googlePhotoWrapper: {
    position: "relative",
    marginRight: 10,
    width: 80,
    height: 80,
  },
  googlePhotoDeleteIcon: {
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
  googlePhotoDeleteText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  googlePhoto: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
  },
  googlePhotoSelected: {
    borderWidth: 3,
    borderColor: "#00C721",
  },
  googlePhotoBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "#00C721",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  googlePhotoBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  darkGooglePhoto: {
    backgroundColor: "#404040",
  },
});
