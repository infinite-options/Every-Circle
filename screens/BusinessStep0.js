import React, { useEffect, useState, useRef } from "react";
import { View, Text, TextInput, StyleSheet, Dimensions, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import AsyncStorage from "@react-native-async-storage/async-storage";
import config from "../config";
import { Dropdown } from "react-native-element-dropdown";
import { BUSINESS_INFO_ENDPOINT } from "../apiConfig";
import { useDarkMode } from "../contexts/DarkModeContext";

const { width } = Dimensions.get("window");

export default function BusinessStep0({ formData, setFormData, navigation }) {
  const { darkMode } = useDarkMode();
  console.log("BusinessStep0 - darkMode value:", darkMode);
  const [loading, setLoading] = useState(false);
  const googlePlacesRef = useRef();

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
            contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 20, alignItems: "center", paddingBottom: 140 }}
            keyboardShouldPersistTaps='handled'
            nestedScrollEnabled={true}
          >
            <View style={[styles.formCard, darkMode && styles.darkFormCard]}>
              <Text style={[styles.title, darkMode && styles.darkTitle]}>Welcome to Every Circle!</Text>
              <Text style={[styles.subtitle, darkMode && styles.darkSubtitle]}>Let's Start Building Your Business Page!</Text>

              <Text style={[styles.label, darkMode && styles.darkLabel]}>Search for Google Maps Business or Organization</Text>
              <View style={{ width: "100%", marginBottom: 20, zIndex: 1000 }}>
                {(() => {
                  const apiKey = config.googleMapsApiKey;
                  console.log("BusinessStep0 - Google Maps API Key being used:", apiKey ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}` : "NOT SET");
                  console.log("BusinessStep0 - API Key length:", apiKey ? apiKey.length : 0);
                  return null;
                })()}
                <GooglePlacesAutocomplete
                  ref={googlePlacesRef}
                  placeholder='Enter a Business or Organization name'
                  placeholderTextColor={darkMode ? "#ffffff" : "#666"}
                  fetchDetails={true}
                  onPress={handleGooglePlaceSelect}
                  query={{
                    key: config.googleMapsApiKey,
                    language: "en",
                    types: "establishment",
                  }}
                  styles={{
                    textInput: {
                      backgroundColor: darkMode ? "#2d2d2d" : "#fff",
                      color: darkMode ? "#ffffff" : "#000",
                      borderRadius: 10,
                      padding: 12,
                      fontSize: 16,
                      borderWidth: 1,
                      borderColor: darkMode ? "#404040" : "#ddd",
                    },
                    listView: {
                      backgroundColor: darkMode ? "#2d2d2d" : "#fff",
                      zIndex: 9999,
                      position: "absolute",
                      top: 60,
                      borderRadius: 10,
                      elevation: 3,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                    },
                  }}
                  enablePoweredByContainer={false}
                  flatListProps={{
                    nestedScrollEnabled: true,
                  }}
                />
              </View>

              <Text style={[styles.orText, darkMode && styles.darkOrText]}>--- OR ---</Text>

              <Text style={[styles.label, darkMode && styles.darkLabel]}>Enter Business Name *</Text>
              <TextInput
                style={[styles.input, darkMode && styles.darkInput]}
                value={formData.businessName || ""}
                placeholder='Enter business name'
                placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                onChangeText={(text) => updateFormData("businessName", text)}
              />

              <Text style={[styles.label, darkMode && styles.darkLabel]}>Phone Number</Text>
              <TextInput
                style={[styles.input, darkMode && styles.darkInput]}
                keyboardType='phone-pad'
                value={formData.phoneNumber || ""}
                placeholder='(000) 000-0000'
                placeholderTextColor={darkMode ? "#ffffff" : "#666"}
                onChangeText={(text) => updateFormData("phoneNumber", formatPhoneNumber(text))}
              />

              <Text style={[styles.label, darkMode && styles.darkLabel]}>Address</Text>
              <TextInput
                style={[styles.input, darkMode && styles.darkInput]}
                value={formData.addressLine1 || ""}
                placeholder='Enter street address'
                placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                onChangeText={(text) => updateFormData("addressLine1", text)}
              />

              <View style={{ flexDirection: "row", width: "100%", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, darkMode && styles.darkLabel]}>City</Text>
                  <TextInput
                    style={[styles.input, darkMode && styles.darkInput]}
                    value={formData.city || ""}
                    placeholder='City'
                    placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                    onChangeText={(text) => updateFormData("city", text)}
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
              />

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
  },
  loadingIndicator: {
    marginTop: 20,
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 30,
    padding: 24,
    width: "90%",
    maxWidth: 420,
    alignSelf: "center",
    marginBottom: 16,
  },
  helperText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 10,
    alignSelf: "flex-start",
  },

  // Missing styles
  orText: {
    textAlign: "center",
    width: "100%",
    color: "#666",
    marginVertical: 20,
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
});
