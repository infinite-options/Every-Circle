import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Modal, ScrollView, ActivityIndicator } from "react-native";
import { BUSINESSES_ENDPOINT, BUSINESS_INFO_ENDPOINT } from "../apiConfig";
import MiniCard from "./MiniCard";
import { useDarkMode } from "../contexts/DarkModeContext";

const BusinessSection = ({ businesses, setBusinesses, toggleVisibility, isPublic, navigation, handleDelete }) => {
  const { darkMode } = useDarkMode();
  const [modalVisible, setModalVisible] = useState(false);
  const [businessList, setBusinessList] = useState([]);
  const [activeBusinessIndex, setActiveBusinessIndex] = useState(null);
  const [businessesData, setBusinessesData] = useState([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(false);

  // Debugging: Log businesses prop whenever it changes
  useEffect(() => {
    console.log("BusinessSection received businesses prop:", businesses);
  }, [businesses]);

  const addBusiness = () => {
    // Navigate to BusinessSetup screen to add a new business
    if (navigation) {
      navigation.navigate("BusinessSetup");
    } else {
      // Fallback: add entry if navigation not provided
      const newEntry = { name: "", role: "", isPublic: false, isNew: false };
      setBusinesses([...businesses, newEntry]);
    }
  };

  const fetchBusinesses = async (index) => {
    try {
      const response = await fetch(BUSINESSES_ENDPOINT);
      const data = await response.json();
      setBusinessList(data);
      setActiveBusinessIndex(index);
      setModalVisible(true);
    } catch (error) {
      console.error("Failed to fetch businesses:", error);
    }
  };

  const deleteBusiness = (index) => {
    if (handleDelete) {
      handleDelete(index);
    } else {
      const updated = businesses.filter((_, i) => i !== index);
      setBusinesses(updated);
    }
  };

  const handleInputChange = (index, field, value) => {
    const updated = [...businesses];
    updated[index][field] = value;
    setBusinesses(updated);
  };

  const toggleEntryVisibility = (index) => {
    const updated = [...businesses];
    updated[index].isPublic = !updated[index].isPublic;
    setBusinesses(updated);

    // Sync outer toggle if it's the only one
    if (updated.length === 1) {
      toggleVisibility("businessIsPublic");
    }
  };

  const toggleIndividualVisibility = (index) => {
    const updated = [...businesses];
    updated[index].individualIsPublic = !updated[index].individualIsPublic;
    setBusinesses(updated);
  };

  // Fetch business details for MiniCards
  useEffect(() => {
    if (businesses && businesses.length > 0) {
      fetchBusinessesData(businesses);
    } else {
      setBusinessesData([]);
    }
  }, [businesses]);

  const fetchBusinessesData = async (businesses) => {
    try {
      setLoadingBusinesses(true);
      console.log("Starting fetchBusinessesData with businesses:", businesses);
      const businessPromises = businesses.map(async (bus) => {
        // Only fetch details for businesses that have a business_uid (existing businesses)
        if (!bus.profile_business_uid && !bus.business_uid) {
          return null; // Skip new businesses without UID
        }

        try {
          const businessUid = bus.profile_business_uid || bus.business_uid;
          console.log(`Fetching business ${businessUid}, bus object:`, bus);
          const businessEndpoint = `${BUSINESS_INFO_ENDPOINT}/${businessUid}`;
          const response = await fetch(businessEndpoint);
          const result = await response.json();

          if (!result || !result.business) {
            return null;
          }

          const rawBusiness = result.business;

          // Process images similar to ProfileScreen
          let businessImages = [];
          if (rawBusiness.business_google_photos) {
            if (typeof rawBusiness.business_google_photos === "string") {
              try {
                businessImages = JSON.parse(rawBusiness.business_google_photos);
              } catch (e) {
                businessImages = [rawBusiness.business_google_photos];
              }
            } else if (Array.isArray(rawBusiness.business_google_photos)) {
              businessImages = rawBusiness.business_google_photos;
            }
          }

          // Handle business_images_url
          if (rawBusiness.business_images_url) {
            let uploadedImages = [];
            if (typeof rawBusiness.business_images_url === "string") {
              try {
                uploadedImages = JSON.parse(rawBusiness.business_images_url);
              } catch (e) {
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

          // Get role and approval status from the original business entry
          const originalBusiness = businesses.find((b) => (b.profile_business_uid || b.business_uid) === businessUid);
          console.log(`For business ${businessUid}, found originalBusiness:`, originalBusiness);
          console.log(`individualIsPublic value:`, originalBusiness?.individualIsPublic);
          return {
            business_name: rawBusiness.business_name || "",
            business_address_line_1: rawBusiness.business_address_line_1 || "",
            business_zip_code: rawBusiness.business_zip_code || "",
            business_phone_number: rawBusiness.business_phone_number || "",
            business_email: rawBusiness.business_email_id || "",
            business_website: rawBusiness.business_website || "",
            first_image: businessImages && businessImages.length > 0 ? businessImages[0] : null,
            phoneIsPublic:
              rawBusiness.business_phone_number_is_public === "1" || rawBusiness.business_phone_number_is_public === 1 || rawBusiness.phone_is_public === "1" || rawBusiness.phone_is_public === 1,
            emailIsPublic: rawBusiness.business_email_id_is_public === "1" || rawBusiness.business_email_id_is_public === 1 || rawBusiness.email_is_public === "1" || rawBusiness.email_is_public === 1,
            business_uid: rawBusiness.business_uid || "",
            profile_business_uid: bus.profile_business_uid || "",
            role: originalBusiness?.role || "",
            isApproved: originalBusiness?.isApproved || false,
            // Get individualIsPublic from the businesses prop (which has the latest data from backend)
            individualIsPublic: originalBusiness?.individualIsPublic ?? 
                             (bus.bu_individual_business_is_public === 1 || 
                              bus.bu_individual_business_is_public === "1" || 
                              bus.bu_individual_business_is_public === true),
            index: businesses.indexOf(bus), // Store original index for editing/deleting
          };
        } catch (error) {
          console.error(`Error fetching business ${bus.profile_business_uid || bus.business_uid}:`, error);
          return null;
        }
      });

      const fetchedBusinesses = await Promise.all(businessPromises);
      const validBusinesses = fetchedBusinesses.filter(Boolean);
      console.log("Final businessesData:", validBusinesses);
      setBusinessesData(validBusinesses);
    } catch (error) {
      console.error("BusinessSection - Error fetching businesses data:", error);
      setBusinessesData([]);
    } finally {
      setLoadingBusinesses(false);
    }
  };

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.headerRow}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, darkMode && styles.darkLabel]}>Businesses</Text>
          <TouchableOpacity onPress={addBusiness}>
            <Text style={[styles.addText, darkMode && styles.darkAddText]}>+</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={toggleVisibility}>
          <Text style={[styles.toggleText, { color: isPublic ? (darkMode ? "#4ade80" : "#4CAF50") : darkMode ? "#f87171" : "#f44336" }]}>{isPublic ? "Display" : "Hide"}</Text>
        </TouchableOpacity>
      </View>

      {loadingBusinesses ? (
        <ActivityIndicator size='small' color={darkMode ? "#ffffff" : "#000000"} style={{ marginVertical: 20 }} />
      ) : businessesData && businessesData.length > 0 ? (
        businessesData.map((business, idx) => {
          const originalIndex = business.index;
          const originalBusiness = businesses[originalIndex];
          return (
            <View key={business.business_uid || business.profile_business_uid || idx} style={[styles.card, darkMode && styles.darkCard, idx > 0 && { marginTop: 10 }]}>
              {/* Header with toggle */}
              <View style={styles.rowHeader}>
                <Text style={[styles.label, darkMode && styles.darkLabel]}>Business #{idx + 1}</Text>
                <TouchableOpacity onPress={() => toggleIndividualVisibility(originalIndex)}>
                  <Text style={{ color: business.individualIsPublic ? (darkMode ? "#4ade80" : "#4CAF50") : (darkMode ? "#f87171" : "#f44336"), fontWeight: "bold" }}>
                    {business.individualIsPublic ? "Display" : "Hide"}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* Business card */}
              <TouchableOpacity
                onPress={() => {
                  if (business.business_uid && navigation) {
                    navigation.navigate("BusinessProfile", { business_uid: business.business_uid });
                  }
                }}
                activeOpacity={0.7}
              >
                <MiniCard business={business} />
              </TouchableOpacity>
              
              {/* Role text */}
              {business.role && (
                <View style={styles.roleContainer}>
                  <Text style={[styles.roleText, darkMode && styles.darkRoleText]}>Role: {business.role}</Text>
                </View>
              )}
            </View>
          );
        })
      ) : businesses && businesses.length > 0 ? (
        // Show input form for new businesses without UID
        businesses
          .filter((item) => !item.profile_business_uid && !item.business_uid)
          .map((item, index) => {
            const actualIndex = businesses.indexOf(item);
            return (
              <View key={index} style={[styles.card, darkMode && styles.darkCard]}>
                <View style={styles.rowHeader}>
                  <Text style={[styles.label, darkMode && styles.darkLabel]}>Business #{actualIndex + 1}</Text>
                  <TouchableOpacity onPress={() => toggleEntryVisibility(actualIndex)}>
                    <Text style={{ color: item.isPublic ? "#4CAF50" : "#f44336", fontWeight: "bold", marginLeft: 10 }}>{item.isPublic ? "Display" : "Hide"}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                  <TouchableOpacity
                    onPress={async () => {
                      const updated = [...businesses];
                      updated[actualIndex].isNew = !updated[actualIndex].isNew;
                      setBusinesses(updated);
                      if (!updated[actualIndex].isNew) return;
                      await fetchBusinesses(actualIndex);
                    }}
                    style={{ marginRight: 8 }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderWidth: 1,
                        borderColor: darkMode ? "#555" : "#ccc",
                        backgroundColor: item.isNew ? "#4CAF50" : darkMode ? "#404040" : "#fff",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {item.isNew && <View style={{ width: 12, height: 12, backgroundColor: "#4CAF50" }} />}
                    </View>
                  </TouchableOpacity>
                  <Text style={[styles.existingBusinessText, darkMode && styles.darkExistingBusinessText]}>Existing Business?</Text>
                </View>

                <TextInput
                  style={[styles.input, darkMode && styles.darkInput]}
                  placeholder='Business Name'
                  placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                  value={item.name}
                  onChangeText={(text) => handleInputChange(actualIndex, "name", text)}
                />
                <TextInput
                  style={[styles.input, darkMode && styles.darkInput]}
                  placeholder='Your Role / Designation'
                  placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                  value={item.role}
                  onChangeText={(text) => handleInputChange(actualIndex, "role", text)}
                />
                
              </View>
            );
          })
      ) : (
        <Text style={[styles.emptyText, darkMode && styles.darkEmptyText]}>No businesses added yet</Text>
      )}

      {/* Modal for selecting existing business */}
      <Modal visible={modalVisible} transparent={true} animationType='slide' onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 10, padding: 20, width: "80%", maxHeight: "70%" }}>
            <Text style={{ fontWeight: "bold", fontSize: 18, marginBottom: 10 }}>Select a Business</Text>
            <ScrollView>
              {businessList.map((biz) => (
                <TouchableOpacity
                  key={biz.business_uid}
                  style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: "#eee" }}
                  onPress={() => {
                    if (activeBusinessIndex !== null) {
                      const updated = [...businesses];
                      // For new businesses, don't include profile_business_uid at all
                      const newBusiness = {
                        name: biz.business_name,
                        business_uid: biz.business_uid,
                        isNew: false,
                        isPublic: false,
                        isApproved: false,
                        role: updated[activeBusinessIndex].role || "",
                      };
                      updated[activeBusinessIndex] = newBusiness;
                      console.log("Updated business after selection:", updated[activeBusinessIndex]);
                      setBusinesses(updated);
                    }
                    setModalVisible(false);
                  }}
                >
                  <Text>{biz.business_name || "(No Name)"}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={{ marginTop: 15, alignSelf: "flex-end" }}>
              <Text style={{ color: "#007AFF", fontWeight: "bold" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: { marginBottom: 20 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  label: { fontSize: 18, fontWeight: "bold", color: "#000" },
  darkLabel: { color: "#ffffff" },
  addText: { fontSize: 24, fontWeight: "bold", color: "#000" },
  darkAddText: { color: "#ffffff" },
  toggleText: { fontWeight: "bold" },
  card: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  darkCard: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  darkInput: {
    backgroundColor: "#404040",
    borderColor: "#555",
    color: "#ffffff",
  },
  deleteButton: {
    alignItems: "flex-end",
    marginTop: 5,
  },
  deleteIcon: { width: 20, height: 20 },
  darkDeleteIcon: {
    /* tintColor moved to Image prop */
  },
  businessCardWrapper: {
    marginBottom: 10,
    borderRadius: 10,
    overflow: "visible",
  },
  darkBusinessCardWrapper: {
    backgroundColor: "transparent",
  },
  roleContainer: {
    marginTop: 8,
    paddingLeft: 10,
  },
  roleText: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#666",
  },
  darkRoleText: {
    color: "#999",
  },
  businessActions: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 8,
  paddingLeft: 10,
  paddingRight: 10,
},
  existingBusinessText: {
    fontSize: 16,
    color: "#000",
  },
  darkExistingBusinessText: {
    color: "#ffffff",
  },
  emptyText: {
    fontSize: 15,
    fontStyle: "italic",
    color: "#666",
    marginTop: 10,
  },
  darkEmptyText: {
    color: "#999",
  },
});

export default BusinessSection;
