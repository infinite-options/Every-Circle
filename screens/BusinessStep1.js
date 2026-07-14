import React, { useEffect, useState, useMemo } from "react";
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Dropdown } from "react-native-element-dropdown";
import { useDarkMode } from "../contexts/DarkModeContext";
import MiniCard from "../components/MiniCard";
import TagSectionLabel from "../components/TagSectionLabel";
import BusinessCategoryPicker from "../components/BusinessCategoryPicker";
import { mapBusinessToMiniCard } from "../utils/mapBusinessToMiniCard";
import { mergeCustomTags } from "../utils/tagListUtils";

export default function BusinessStep1({ formData, setFormData, onPendingTagsChange }) {
  const { darkMode } = useDarkMode();
  const [customTag, setCustomTag] = useState("");
  const customTags = formData.customTags || [];

  const updateCategoryIds = (categoryIds) => {
    setFormData((prev) => {
      const updated = { ...prev, businessCategoryId: categoryIds };
      AsyncStorage.setItem("businessFormData", JSON.stringify(updated)).catch((err) => console.error("Save error", err));
      return updated;
    });
  };

  useEffect(() => {
    onPendingTagsChange?.(customTag.trim().length > 0);
  }, [customTag, onPendingTagsChange]);

  useEffect(() => {
    return () => onPendingTagsChange?.(false);
  }, [onPendingTagsChange]);

  const updateFormData = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      AsyncStorage.setItem("businessFormData", JSON.stringify(updated)).catch((err) => console.error("Save error", err));
      return updated;
    });
  };

  const formatEINNumber = (text) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length > 9) return text.slice(0, -1);
    if (cleaned.length === 0) return "";
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 9) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
    return text;
  };

  const addTag = () => {
    if (!customTag.trim()) return;
    const updatedTags = mergeCustomTags(customTags, customTag);
    setFormData((prev) => {
      const updated = { ...prev, customTags: updatedTags };
      AsyncStorage.setItem("businessFormData", JSON.stringify(updated)).catch((err) => console.error("Save error", err));
      return updated;
    });
    setCustomTag("");
  };

  const removeTag = (tag) => {
    const updatedTags = customTags.filter((t) => t !== tag);
    setFormData((prev) => {
      const updated = { ...prev, customTags: updatedTags };
      AsyncStorage.setItem("businessFormData", JSON.stringify(updated)).catch((err) => console.error("Save error", err));
      return updated;
    });
  };

  const businessRoles = [
    { label: "Owner", value: "owner" },
    { label: "Employee", value: "employee" },
    { label: "Partner", value: "partner" },
    { label: "Admin", value: "admin" },
    { label: "Other", value: "other" },
  ];

  const previewBusiness = useMemo(
    () =>
      mapBusinessToMiniCard(
        {
          ...formData,
          business_name: formData.businessName,
          business_favorite_image: formData.favImage || "",
          images: formData.images,
          businessGooglePhotos: formData.businessGooglePhotos,
        },
        { previewMode: true },
      ),
    [formData],
  );

  return (
    <View style={{ flex: 1, backgroundColor: darkMode ? "#1a1a1a" : "#fff" }}>
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
          <View style={[styles.formCard, darkMode && styles.darkFormCard]}>
            <Text style={[styles.title, darkMode && styles.darkTitle]}>Welcome to Every Circle!</Text>
            <View style={styles.subtitleBlock}>
              <Text style={[styles.subtitle, darkMode && styles.darkSubtitle]}>Let's Build Your Business Page!</Text>
              <Text style={[styles.stepHint, darkMode && styles.darkSubtitle]}>(Click Submit to go Live!)</Text>
            </View>

            <Text style={[styles.label, darkMode && styles.darkLabel]}>Business Name</Text>
            <Text style={[styles.businessNameDisplay, darkMode && styles.darkBusinessNameDisplay]}>{formData.businessName || "No business name entered"}</Text>

            <Text style={[styles.label, darkMode && styles.darkLabel]}>Business Role *</Text>
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

            <BusinessCategoryPicker categoryIds={formData.businessCategoryId || []} onCategoryIdsChange={updateCategoryIds} darkMode={darkMode} />

            <TagSectionLabel title='Custom Tags' style={[styles.label, darkMode && styles.darkLabel]} darkMode={darkMode} />
            {customTag.trim().length > 0 ? <Text style={[styles.pendingTagsHint, darkMode && styles.darkPendingTagsHint]}>Click Add to save your tags before submitting.</Text> : null}
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

            <Text style={[styles.label, darkMode && styles.darkLabel]}>Tagline (Optional)</Text>
            <TextInput
              style={[styles.input, darkMode && styles.darkInput]}
              placeholder='A short tagline for your business'
              placeholderTextColor={darkMode ? "#cccccc" : "#666"}
              value={formData.tagLine || ""}
              onChangeText={(text) => updateFormData("tagLine", text)}
            />

            <Text style={[styles.label, darkMode && styles.darkLabel]}>Brief Description (Optional)</Text>
            <TextInput
              style={[styles.textarea, darkMode && styles.darkTextarea]}
              placeholder='Describe your business...'
              placeholderTextColor={darkMode ? "#ffffff" : "#666"}
              value={formData.shortBio || ""}
              multiline
              numberOfLines={4}
              onChangeText={(text) => updateFormData("shortBio", text)}
            />

            <Text style={[styles.label, darkMode && styles.darkLabel]}>Business Mini Card Preview</Text>
            <Text style={[styles.helperText, darkMode && styles.darkHelperText]}>This is how your business will appear on mini cards throughout the app.</Text>
            <View style={[styles.previewCard, darkMode && styles.darkPreviewCard]}>
              <MiniCard business={previewBusiness} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  categoryInput: {
    marginBottom: 5,
  },
  subCategoryLabel: {
    marginTop: 5,
  },
  helperText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 10,
    alignSelf: "flex-start",
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
    fontSize: 16,
  },
  pendingTagsHint: {
    fontSize: 12,
    color: "#b45309",
    marginBottom: 6,
    alignSelf: "flex-start",
  },
  darkPendingTagsHint: {
    color: "#fbbf24",
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
    fontSize: 16,
  },
  tagButton: {
    backgroundColor: "#FFA500",
    padding: 10,
    borderRadius: 10,
  },
  tagButtonText: { color: "#fff", fontWeight: "bold" },
  tagList: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  tagItem: {
    backgroundColor: "#fff",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  previewCard: {
    width: "100%",
    backgroundColor: "#f8f8f8",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 30,
    padding: 20,
    width: "100%",
    maxWidth: Platform.OS === "web" ? "100%" : 420,
    alignSelf: "center",
    marginBottom: 16,
  },
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
  darkTextarea: {
    backgroundColor: "#404040",
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "#404040",
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
  darkPreviewCard: {
    backgroundColor: "#333",
    borderColor: "#555",
  },
});
