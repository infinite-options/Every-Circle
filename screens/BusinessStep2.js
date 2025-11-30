// BusinessStep2.js
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Image, ScrollView, Dimensions, Alert, KeyboardAvoidingView, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Dropdown } from "react-native-element-dropdown";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomNavBar from "../components/BottomNavBar";
import ContinueButton from "../components/ContinueButton";
import { CATEGORY_LIST_ENDPOINT } from "../apiConfig";
import { useDarkMode } from "../contexts/DarkModeContext";

const { width } = Dimensions.get("window");

export default function BusinessStep2({ formData, setFormData, navigation }) {
  const { darkMode } = useDarkMode();
  console.log("BusinessStep2 - darkMode value:", darkMode);
  useEffect(() => {
    console.log("\nIn BusinessStep2", formData);
  }, []);
  const [allCategories, setAllCategories] = useState([]);
  const [mainCategories, setMainCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [subSubCategories, setSubSubCategories] = useState([]);
  const [selectedMain, setSelectedMain] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);
  const [selectedSubSub, setSelectedSubSub] = useState(null);
  const [customTag, setCustomTag] = useState("");
  const [customTags, setCustomTags] = useState(formData.customTags || []);

  const googlePhotos = formData.businessGooglePhotos || [];
  const userUploadedImages = formData.images || [];

  const combinedImages = [...googlePhotos, ...userUploadedImages];

  useEffect(() => {
    // console.log('In BusinessStep2');
    const fetchCategories = async () => {
      try {
        const res = await fetch(CATEGORY_LIST_ENDPOINT);
        const json = await res.json();
        setAllCategories(json.result);
        setMainCategories(json.result.filter((cat) => cat.category_parent_id === null));
      } catch (e) {
        console.error("Fetch category error:", e);
      }
    };
    fetchCategories();

    const loadSavedForm = async () => {
      try {
        const stored = await AsyncStorage.getItem("businessFormData");
        if (stored) {
          const parsed = JSON.parse(stored);
          setFormData((prev) => ({ ...prev, ...parsed }));
        }
      } catch (err) {
        console.error("Error loading saved form data:", err);
      }
    };
    loadSavedForm();
  }, []);

  useEffect(() => {
    const updated = allCategories.filter((c) => c.category_parent_id === selectedMain);
    setSubCategories(updated);
    setSelectedSub(null);
    setSelectedSubSub(null);
    setSubSubCategories([]);
  }, [selectedMain]);

  useEffect(() => {
    const updated = allCategories.filter((c) => c.category_parent_id === selectedSub);
    setSubSubCategories(updated);
    setSelectedSubSub(null);
  }, [selectedSub]);

  useEffect(() => {
    const selectedIds = [selectedMain, selectedSub, selectedSubSub].filter(Boolean);
    const updatedForm = {
      ...formData,
      businessCategoryId: selectedIds,
      customTags,
    };
    setFormData(updatedForm);
    AsyncStorage.setItem("businessFormData", JSON.stringify(updatedForm)).catch((err) => console.error("Save error", err));
  }, [selectedMain, selectedSub, selectedSubSub, customTags]);

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

  const addTag = () => {
    if (customTag.trim()) {
      const updatedTags = [...customTags, customTag.trim()];
      setCustomTags(updatedTags);
      setFormData((prev) => ({ ...prev, customTags: updatedTags }));
      AsyncStorage.setItem("businessFormData", JSON.stringify({ ...formData, customTags: updatedTags })).catch((err) => console.error("Save error", err));
      setCustomTag("");
    }
  };

  const removeTag = (tag) => {
    const updatedTags = customTags.filter((t) => t !== tag);
    setCustomTags(updatedTags);
    const newFormData = { ...formData, customTags: updatedTags };
    setFormData(newFormData);
    AsyncStorage.setItem("businessFormData", JSON.stringify(newFormData)).catch((err) => console.error("Save error", err));
  };

  return (
    <View style={{ flex: 1, backgroundColor: darkMode ? "#1a1a1a" : "#fff" }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={90}>
        <View style={{ flex: 1, paddingTop: 60, paddingHorizontal: 20, alignItems: "center" }}>
          <ScrollView
            style={{ flex: 1, width: "100%" }}
            contentContainerStyle={{ justifyContent: "center", alignItems: "center", paddingBottom: 120 }}
            keyboardShouldPersistTaps='handled'
            nestedScrollEnabled={true}
          >
            <View style={[styles.formCard, darkMode && styles.darkFormCard]}>
              <Text style={[styles.title, darkMode && styles.darkTitle]}>Select Category</Text>
              <Text style={[styles.subtitle, darkMode && styles.darkSubtitle]}>Select Tags for your business</Text>

              <Text style={[styles.label, darkMode && styles.darkLabel]}>Brief Description</Text>
              <TextInput
                style={[styles.textarea, darkMode && styles.darkTextarea]}
                placeholder='Describe your business...'
                placeholderTextColor={darkMode ? "#ffffff" : "#666"}
                value={formData.shortBio || ""}
                multiline
                numberOfLines={4}
                onChangeText={(text) => {
                  const updated = { ...formData, shortBio: text };
                  setFormData(updated);
                  AsyncStorage.setItem("businessFormData", JSON.stringify(updated)).catch((err) => console.error("Save error", err));
                }}
              />

              <Text style={[styles.label, darkMode && styles.darkLabel]}>Main Category *</Text>
              <Dropdown
                style={[styles.input, darkMode && styles.darkInput]}
                data={mainCategories.map((c) => ({ label: c.category_name, value: c.category_uid }))}
                labelField='label'
                valueField='value'
                placeholder='Select Main Category'
                placeholderTextColor={darkMode ? "#ffffff" : "#666"}
                value={selectedMain}
                onChange={(item) => setSelectedMain(item.value)}
              />

              {subCategories.length > 0 && (
                <>
                  <Text style={[styles.label, darkMode && styles.darkLabel]}>Sub Category (Optional)</Text>
                  <Dropdown
                    style={[styles.input, darkMode && styles.darkInput]}
                    data={subCategories.map((c) => ({ label: c.category_name, value: c.category_uid }))}
                    labelField='label'
                    valueField='value'
                    placeholder='Select Sub Category'
                    placeholderTextColor={darkMode ? "#ffffff" : "#666"}
                    value={selectedSub}
                    onChange={(item) => setSelectedSub(item.value)}
                  />
                </>
              )}

              {subSubCategories.length > 0 && (
                <>
                  <Text style={[styles.label, darkMode && styles.darkLabel]}>Sub-Sub Category (Optional)</Text>
                  <Dropdown
                    style={[styles.input, darkMode && styles.darkInput]}
                    data={subSubCategories.map((c) => ({ label: c.category_name, value: c.category_uid }))}
                    labelField='label'
                    valueField='value'
                    placeholder='Select Sub-Sub Category'
                    placeholderTextColor={darkMode ? "#ffffff" : "#666"}
                    value={selectedSubSub}
                    onChange={(item) => setSelectedSubSub(item.value)}
                  />
                </>
              )}

              <Text style={[styles.label, darkMode && styles.darkLabel]}>Custom Tags</Text>
              <View style={styles.tagRow}>
                <TextInput
                  style={[styles.tagInput, darkMode && styles.darkTagInput]}
                  placeholder='Add tag'
                  placeholderTextColor={darkMode ? "#ffffff" : "#666"}
                  value={customTag}
                  onChangeText={setCustomTag}
                  onSubmitEditing={addTag}
                />
                <TouchableOpacity onPress={addTag} style={styles.tagButton}>
                  <Text style={styles.tagButtonText}>Add</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.tagList}>
                {customTags.map((tag, i) => (
                  <TouchableOpacity key={i} onPress={() => removeTag(tag)} style={[styles.tagItem, darkMode && styles.darkTagItem]}>
                    <Text style={darkMode && styles.darkTagItemText}>{tag} ✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  // container: {
  //   width: width * 1.3,
  //   flex: 1,
  //   backgroundColor: "#00C721",
  //   borderTopLeftRadius: width,
  //   borderTopRightRadius: width,
  //   // borderBottomLeftRadius: width,
  //   // borderBottomRightRadius: width,
  //   alignSelf: "center",
  //   paddingLeft: 80,
  //   paddingRight: 80,
  // },
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
  scrollContent: {
    borderBottomLeftRadius: width,
    borderBottomRightRadius: width,
    padding: 30,
    paddingTop: 50,
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
  },
  textarea: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    height: 100,
    textAlignVertical: "top",
    marginBottom: 20,
    width: "100%",
  },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  tagInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    marginRight: 10,
  },
  tagButton: {
    backgroundColor: "#FFA500",
    padding: 10,
    borderRadius: 10,
  },
  tagButtonText: { color: "#fff", fontWeight: "bold" },
  tagList: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tagItem: {
    backgroundColor: "#fff",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },

  imageWrapper: {
    width: 80,
    height: 80,
    // aspectRatio: 1,
    borderRadius: 10,
    overflow: "hidden",
    marginRight: 10,
    backgroundColor: "#fff",
    position: "relative",
    // transform: [{ scale: 0.5 }],
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
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    borderWidth: 2,
    borderColor: "#ddd",
    borderStyle: "dashed",
  },
  uploadText: {
    color: "#666",
    fontSize: 12,
    textAlign: "center",
  },
  carousel: {
    marginVertical: 20,
    width: "100%",
    height: 120,
  },
  imageRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  carouselImageWrapper: {
    width: "100%",
    height: 200,
    marginRight: 10,
    borderRadius: 10,
    overflow: "hidden",
    position: "absolute",
    // transform: [{ scale: 0.5 }],
  },
  carouselImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 30,
    padding: 24,
    width: "90%",
    maxWidth: 420,
    alignSelf: "center",
    marginBottom: 16,
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.08,
    // shadowRadius: 8,
    // elevation: 4,
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
    borderColor: "#555",
  },
  darkTextarea: {
    backgroundColor: "#404040",
    color: "#ffffff",
    borderColor: "#555",
  },
  darkImageWrapper: {
    backgroundColor: "#404040",
  },
  darkUploadBox: {
    backgroundColor: "#404040",
    borderColor: "#555",
  },
  darkUploadText: {
    color: "#cccccc",
  },
  darkTagInput: {
    backgroundColor: "#404040",
    color: "#ffffff",
  },
  darkTagItem: {
    backgroundColor: "#404040",
  },
  darkTagItemText: {
    color: "#ffffff",
  },
});
