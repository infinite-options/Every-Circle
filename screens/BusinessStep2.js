// BusinessStep2.js
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Image, ScrollView, Dimensions, Alert, KeyboardAvoidingView, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Dropdown } from "react-native-element-dropdown";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CATEGORY_LIST_ENDPOINT } from "../apiConfig";
import { useDarkMode } from "../contexts/DarkModeContext";

const businessRoles = [
    { label: "Owner", value: "owner" },
    { label: "Employee", value: "employee" },
    { label: "Partner", value: "partner" },
    { label: "Admin", value: "admin" },
    { label: "Other", value: "other" },
];

const { width } = Dimensions.get("window");

export default function BusinessStep2({ formData, setFormData, navigation }) {
  const { darkMode } = useDarkMode();

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

  return (
    <View style={{ flex: 1, backgroundColor: darkMode ? "#1a1a1a" : "#fff" }}>
      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={90}>
           <View style={{ flex: 1, paddingTop: 20, paddingHorizontal: 20, alignItems: "center" }}>
          <ScrollView
            style={{ flex: 1, width: "100%" }}
            contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 20, alignItems: "center", paddingBottom: 140 }}
            keyboardShouldPersistTaps='handled'
            nestedScrollEnabled={true}
          >
            <View style={[styles.formCard, darkMode && styles.darkFormCard]}>
              <Text style={[styles.title, darkMode && styles.darkTitle]}>Welcome to Every Circle!</Text>
              <Text style={[styles.subtitle, darkMode && styles.darkSubtitle]}>Let's Build Your Business Page! Step 2</Text>

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
            </View>
          </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
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
    borderWidth: 1,
    borderColor: "#ddd",
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
  tagRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  tagInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#ddd",
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
    borderWidth: 1,
    borderColor: "#404040",
  },
  darkTextarea: {
    backgroundColor: "#404040",
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "#404040",
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
    borderWidth: 1,
    borderColor: "#404040",
  },
  darkTagItem: {
    backgroundColor: "#404040",
  },
  darkTagItemText: {
    color: "#ffffff",
  },
  darkHelperText: {
  color: "#cccccc",
},
});