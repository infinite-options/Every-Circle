import React, { useEffect, useState, useRef } from "react";
import { View, Text, TextInput, StyleSheet, Dimensions, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Image, Alert } from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import AsyncStorage from "@react-native-async-storage/async-storage";
import config from "../config";
import { Dropdown } from "react-native-element-dropdown";
import { BUSINESS_INFO_ENDPOINT } from "../apiConfig";
import { useDarkMode } from "../contexts/DarkModeContext";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";

const { width } = Dimensions.get("window");

export default function BusinessStep1({ formData, setFormData, navigation }) {
  const { darkMode } = useDarkMode();
  console.log("BusinessStep1 - darkMode value:", darkMode);
  const [loading, setLoading] = useState(false);
  const googlePlacesRef = useRef();

  const googlePhotos = formData.businessGooglePhotos || [];
  const userUploadedImages = formData.images || [];
  const combinedImages = [...googlePhotos, ...userUploadedImages];

  const handleImagePick = async (index) => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Permission to access media library is required!");
        return;
      }
      // Launch picker with new API
      let result = await ImagePicker.launchImageLibraryAsync({
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
        const newImageUri = asset.uri;
        const updated = [...userUploadedImages];
        updated[index] = newImageUri;
        const newFormData = { ...formData, images: updated };
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

  useEffect(() => {
    console.log("In BusinessStep1");
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

  const updateFormData = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Save to AsyncStorage asynchronously without blocking
      AsyncStorage.setItem("businessFormData", JSON.stringify(updated)).catch((err) => console.error("Save error", err));
      return updated;
    });
  };

  const handleGooglePlaceSelect = async (data, details = null) => {
    if (!details) return;

    console.log("handleGooglePlaceSelect Data: ", data);
    // console.log("handleGooglePlaceSelect Details: ", details);

    const addressComponents = details.address_components || [];
    const getComponent = (type) => addressComponents.find((comp) => comp.types.includes(type))?.long_name || "";

    const addressLine1 = `${getComponent("street_number")} ${getComponent("route")}`.trim();
    const addressLine2 = getComponent("subpremise");
    const city = getComponent("locality");
    const state = getComponent("administrative_area_level_1");
    const country = getComponent("country");
    const zip = getComponent("postal_code");

    const latFn = details.geometry?.location?.lat;
    const lngFn = details.geometry?.location?.lng;
    const latitude = typeof latFn === "function" ? latFn() : latFn ?? "";
    const longitude = typeof lngFn === "function" ? lngFn() : lngFn ?? "";

    const photoReferences = details.photos?.map((photo) => photo.photo_reference) || [];
    const photoUrls = photoReferences.map((ref) => `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${ref}&key=${config.googleMapsApiKey}`);

    const updated = {
      ...formData,
      businessName: details.name || "", // Only the name
      location: details.vicinity || details.formatted_address || "", // Just the address
      phoneNumber: details.formatted_phone_number || "", // Phone
      website: details.website || "",
      googleId: details.place_id || "",
      googleRating: details.rating || "",
      businessGooglePhotos: photoUrls,
      favImage: photoUrls[0] || "",
      priceLevel: details.price_level || "",
      addressLine1: details.vicinity || details.formatted_address || "",
      addressLine2,
      city,
      state,
      country,
      zip,
      latitude,
      longitude,
      types: details.types || [],
    };

    setFormData(updated);
    await AsyncStorage.setItem("businessFormData", JSON.stringify(updated)).catch((err) => console.error("Save error", err));

    fetchProfile(details.place_id);
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
            contentContainerStyle={{ paddingTop: 20, alignItems: "center", paddingBottom: 140 }}
            keyboardShouldPersistTaps='handled'
            nestedScrollEnabled={true}
          >
            <View style={[styles.formCard, darkMode && styles.darkFormCard]}>
              <Text style={[styles.title, darkMode && styles.darkTitle]}>Welcome to Every Circle!</Text>
              <Text style={[styles.subtitle, darkMode && styles.darkSubtitle]}>Let's Build Your Business Page! Step 1</Text>

              <Text style={[styles.label, darkMode && styles.darkLabel]}>Business Name</Text>
              <Text style={[styles.businessNameDisplay, darkMode && styles.darkBusinessNameDisplay]}>
                {formData.businessName || "No business name entered"}
              </Text>

              <Text style={[styles.label, darkMode && styles.darkLabel]}>Location (Optional)</Text>
              <TextInput
                style={[styles.input, darkMode && styles.darkInput]}
                value={formData.location || ""}
                placeholder='Enter location'
                placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                onChangeText={(text) => updateFormData("location", text)}
              />

              <Text style={[styles.label, darkMode && styles.darkLabel]}>Business Role</Text>
              <Dropdown
                style={[styles.input, darkMode && styles.darkInput]}
                data={businessRoles}
                labelField='label'
                valueField='value'
                placeholder='Select your role'
                placeholderTextColor={darkMode ? "#ffffff" : "#666"}
                value={formData.businessRole || ""}
                onChange={(item) => updateFormData("businessRole", item.value)}
                containerStyle={[{ borderRadius: 10, zIndex: 1000 }, darkMode && { backgroundColor: "#2d2d2d", borderColor: "#404040" }]}
                itemTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 16 }}
                selectedTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 16 }}
                activeColor={darkMode ? "#404040" : "#f0f0f0"}
                maxHeight={250}
                renderItem={(item) => (
                  <View style={{ paddingVertical: 6, paddingHorizontal: 12 }}>
                    <Text style={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 16 }}>{item.label}</Text>
                  </View>
                )}
                flatListProps={{
                  nestedScrollEnabled: true,
                  ItemSeparatorComponent: () => <View style={{ height: 2 }} />,
                }}
              />

              <Text style={[styles.label, darkMode && styles.darkLabel]}>EIN Number (Optional)</Text>
              <Text style={[styles.helperText, darkMode && styles.darkHelperText]}>For verification purposes only</Text>
              <TextInput
                style={[styles.input, darkMode && styles.darkInput]}
                value={formData.einNumber || ""}
                placeholder='##-#######'
                placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                keyboardType='numeric'
                maxLength={10}
                onChangeText={(text) => updateFormData("einNumber", formatEINNumber(text))}
              />

              <Text style={[styles.label, darkMode && styles.darkLabel]}>Upload Business Logo (Optional)</Text>
              <View style={styles.carousel}>
                <View style={styles.imageRow}>
                  {combinedImages.map((img, index) => {
                    return (
                      <View key={index} style={[styles.imageWrapper, darkMode && styles.darkImageWrapper]}>
                        <Image source={{ uri: img }} style={styles.uploadedImage} resizeMode='cover' />
                        <TouchableOpacity
                          style={styles.deleteIcon}
                          onPress={() => {
                            const isGoogle = index < googlePhotos.length;
                            const updated = isGoogle
                              ? [...googlePhotos.slice(0, index), ...googlePhotos.slice(index + 1)]
                              : [...userUploadedImages.slice(0, index - googlePhotos.length), ...userUploadedImages.slice(index - googlePhotos.length + 1)];

                            const newFormData = {
                              ...formData,
                              businessGooglePhotos: isGoogle ? updated : googlePhotos,
                              images: !isGoogle ? updated : userUploadedImages,
                            };
                            setFormData(newFormData);
                            AsyncStorage.setItem("businessFormData", JSON.stringify(newFormData)).catch((err) => console.error("Save error", err));
                          }}
                        >
                          <Text style={styles.deleteText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}

                  <TouchableOpacity style={[styles.uploadBox, darkMode && styles.darkUploadBox]} onPress={() => handleImagePick(userUploadedImages.length)}>
                    <Text style={[styles.uploadText, darkMode && styles.darkUploadText]}>Upload Logo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Loading indicator positioned outside ScrollView to avoid flickering */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <View style={[styles.loadingContent, darkMode && styles.darkLoadingContent]}>
              <ActivityIndicator size='large' color='#00C721' />
              <Text style={[styles.loadingText, darkMode && styles.darkLoadingText]}>Loading...</Text>
            </View>
          </View>
        )}
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
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
  },
  label: {
    alignSelf: "flex-start",
    color: "#333",
    fontWeight: "bold",
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    width: "100%",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#ddd",
    fontSize: 16,
  },
  businessNameDisplay: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 12,
    width: "100%",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#ddd",
    fontSize: 16,
    color: "#333",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  loadingContent: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
  },
  darkLoadingContent: {
    backgroundColor: "#2d2d2d",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#333",
  },
  darkLoadingText: {
    color: "#ffffff",
  },
  loadingContainer: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 1000,
  },
  loadingIndicator: {
    marginTop: 20,
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 30,
    padding: 0,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    marginBottom: 16,
    position: "relative",
  },
  helperText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 10,
    alignSelf: "flex-start",
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
  darkBusinessNameDisplay: {
    backgroundColor: "#404040",
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "#404040",
  },
  darkHelperText: {
    color: "#cccccc",
  },
  textarea: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    height: 100,
    textAlignVertical: "top",
    marginBottom: 20,
    width: "100%",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  carousel: {
    marginTop: 0,
    marginBottom: 20,
    width: "100%",
    height: 120,
  },
  imageRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    flexWrap: "wrap",
  },
  imageWrapper: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: "hidden",
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: "#fff",
    position: "relative",
  },
  darkImageWrapper: {
    backgroundColor: "#404040",
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
  uploadedImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
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
  darkTextarea: {
    backgroundColor: "#404040",
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "#404040",
  },
});
