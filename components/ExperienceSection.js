import React, { useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Platform, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { resolveProfileItemImageUri, isRemoteHttpUrl } from "../utils/resolveProfileItemImageUri";
import ProfileItemImageColumn from "./ProfileItemImageColumn";

const ExperienceSection = ({
  experience,
  setExperience,
  toggleVisibility,
  isPublic,
  handleDelete,
  onInputFocus,
  profileUid = "",
  darkMode = false,
}) => {
  // Stores each rendered card's ref by index so parent can scroll to the new one.
  const cardRefs = useRef({});
  // Tracks which index was just added via "+".
  const pendingNewIndexRef = useRef(null);
  // Helper function to format date input
  const formatDateInput = (text) => {
    // If the user manually entered a slash after 2 digits, preserve it
    if (text.length === 3 && text[2] === '/') {
      return text;
    }
    
    // Remove any non-digit characters except for manually entered slashes
    const cleaned = text.replace(/[^\d/]/g, '');
    
    // Limit to 7 characters (MM/YYYY)
    const limited = cleaned.slice(0, 7);
    
    // If we have exactly 2 digits and the next character is a slash, keep it
    if (limited.length === 3 && limited[2] === '/') {
      return limited;
    }
    
    // If we have more than 2 digits and no slash, add one
    if (limited.length > 2 && !limited.includes('/')) {
      return limited.slice(0, 2) + '/' + limited.slice(2);
    }
    
    // If we have a slash and the month part is only 1 digit, pad it with a leading zero
    if (limited.includes('/')) {
      const parts = limited.split('/');
      if (parts[0].length === 1 && parts[0] !== '') {
        return '0' + parts[0] + '/' + (parts[1] || '');
      }
    }
    
    // Validate month value - if month is greater than 12, treat it as single digit
    if (limited.includes('/')) {
      const parts = limited.split('/');
      if (parts[0] && parts[0].length === 2) {
        const month = parseInt(parts[0], 10);
        if (month > 12) {
          // If month is > 12, treat first digit as month and second digit as start of year
          return parts[0][0] + '/' + parts[0][1] + (parts[1] || '');
        }
        // Don't allow month 00
        if (month === 0) {
          return parts[0][0] + '/' + (parts[1] || '');
        }
      }
    }
    
    return limited;
  };

  const addExperience = () => {
    // Mark the next card index before state update, then notify parent after render.
    pendingNewIndexRef.current = experience.length;
    const newEntry = {
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
    };
    setExperience([...experience, newEntry]);
  };

  useEffect(() => {
    // After add + render, pass the new card ref up so parent can auto-scroll.
    const index = pendingNewIndexRef.current;
    if (index === null || index === undefined) return;
    const newCardRef = cardRefs.current[index];
    if (!newCardRef) return;
    setTimeout(() => {
      onInputFocus?.(newCardRef);
      pendingNewIndexRef.current = null;
    }, 100);
  }, [experience.length, onInputFocus]);
// Because right after pressing +, the new card is not guaranteed to be laid out yet.

// setTimeout gives React Native one tick to:

// apply state update
// render the new card
// attach its ref
// compute layout
// Without that delay, measureLayout often runs too early and returns wrong/empty measurements, so scrolling is unreliable.

  const deleteExperience = (index) => {
    handleDelete(index);
  };

  const handleInputChange = (index, field, value) => {
    const updatedExperience = [...experience];
    updatedExperience[index][field] = value;
    setExperience(updatedExperience);
  };

  const handleDateChange = (index, field, value) => {
    const formattedValue = formatDateInput(value);
    handleInputChange(index, field, formattedValue);
  };

  const getExperienceDisplayUri = (item) => {
    const pending = item._jobNewImageUri;
    if (pending != null && String(pending).trim() !== "") return String(pending).trim();
    return resolveProfileItemImageUri(item.profile_experience_image, profileUid);
  };

  const pickExperienceImage = async (index) => {
    if (Platform.OS === "web") return;
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
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        let fileSize = asset.fileSize;
        if (!fileSize && asset.uri) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(asset.uri);
            fileSize = fileInfo.size;
          } catch (e) {
            /* ignore */
          }
        }
        if (fileSize && fileSize > 2 * 1024 * 1024) {
          Alert.alert("File not selectable", "Image size exceeds the 2MB upload limit.");
          return;
        }
        const updated = [...experience];
        const prev = updated[index];
        const orig = prev._jobOriginalImage || resolveProfileItemImageUri(prev.profile_experience_image, profileUid);
        updated[index]._jobDeleteImageUrl = isRemoteHttpUrl(orig) ? orig : "";
        updated[index]._jobNewImageUri = asset.uri;
        updated[index]._jobWebImageFile = null;
        updated[index]._jobImageError = false;
        setExperience(updated);
      }
    } catch (error) {
      console.error("Experience image pick error:", error);
      Alert.alert("Error", "Failed to pick image.");
    }
  };

  const handleExperienceWebImagePick = (index, event) => {
    const file = event.target?.files?.[0];
    if (event?.target) event.target.value = "";
    if (!file) return;
    if (!file.type?.startsWith?.("image/")) {
      Alert.alert("Invalid file type", "Please select an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      Alert.alert("File not selectable", "Image size exceeds the 2MB upload limit.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageUri = reader.result;
      const updated = [...experience];
      const prev = updated[index];
      const orig = prev._jobOriginalImage || resolveProfileItemImageUri(prev.profile_experience_image, profileUid);
      updated[index]._jobDeleteImageUrl = isRemoteHttpUrl(orig) ? orig : "";
      updated[index]._jobNewImageUri = imageUri;
      updated[index]._jobWebImageFile = file;
      updated[index]._jobImageError = false;
      setExperience(updated);
    };
    reader.readAsDataURL(file);
  };

  const removeExperienceImage = (index) => {
    const updated = [...experience];
    const prev = updated[index];
    const orig = prev._jobOriginalImage || resolveProfileItemImageUri(prev.profile_experience_image, profileUid);
    updated[index]._jobDeleteImageUrl = isRemoteHttpUrl(orig) ? orig : "";
    updated[index]._jobNewImageUri = "";
    updated[index]._jobWebImageFile = null;
    updated[index].profile_experience_image = "";
    updated[index]._jobOriginalImage = "";
    updated[index]._jobImageError = false;
    setExperience(updated);
  };

  return (
    <View style={styles.sectionContainer}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Experience</Text>

          {/* Add Experience Button */}
          <TouchableOpacity onPress={addExperience}>
            <Text style={styles.addText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Public Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity onPress={toggleVisibility} style={[styles.togglePill, isPublic && styles.togglePillActiveGreen]}>
            <Text style={[styles.togglePillText, isPublic && styles.togglePillTextActive]}>{isPublic ? "Visible" : "Show"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleVisibility} style={[styles.togglePill, !isPublic && styles.togglePillActiveRed]}>
              <Text style={[styles.togglePillText, !isPublic && styles.togglePillTextActive]}>{!isPublic ? "Hidden" : "Hide"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Experience List */}
      {experience.map((item, index) => (
        <View
          key={index}
          ref={(ref) => {
            // Capture each card ref for new-card scroll targeting.
            if (ref) cardRefs.current[index] = ref;
          }}
          style={[styles.experienceCard, index > 0 && styles.cardSpacing]}
        >
          {/* That ref stores the rendered card’s native view reference so parent scroll logic can target it. */}
          {/* Specifically:
          When + adds a new card, we need that exact card’s ref.
          Parent uses the ref in measureLayout to find where it is.
          Then parent scrolls to center it if needed.
          Without this ref, we can’t reliably scroll to the newly added card. */}
          <View style={styles.expHeaderRow}>
            <Text style={styles.label}>Experience #{index + 1}</Text>
            {/* Individual public/private toggle */}
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                onPress={() => { const u = [...experience]; u[index].isPublic = !u[index].isPublic; setExperience(u); }}
                style={[styles.togglePill, item.isPublic && styles.togglePillActiveGreen]}
              >
                <Text style={[styles.togglePillText, item.isPublic && styles.togglePillTextActive]}>{item.isPublic ? "Visible" : "Show"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { const u = [...experience]; u[index].isPublic = !u[index].isPublic; setExperience(u); }}
                style={[styles.togglePill, !item.isPublic && styles.togglePillActiveRed]}
              >
                <Text style={[styles.togglePillText, !item.isPublic && styles.togglePillTextActive]}>{!item.isPublic ? "Hidden" : "Hide"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.miniCard, darkMode && styles.miniCardDark]}>
            <ProfileItemImageColumn
              darkMode={darkMode}
              displayUri={getExperienceDisplayUri(item)}
              imageError={!!item._jobImageError}
              onImageError={() => handleInputChange(index, "_jobImageError", true)}
              toolsVisible={
                item.profile_experience_image_is_public === 1 ||
                item.profile_experience_image_is_public === "1" ||
                item.profile_experience_image_is_public === true
              }
              onShowTools={() => handleInputChange(index, "profile_experience_image_is_public", 1)}
              onHideTools={() => handleInputChange(index, "profile_experience_image_is_public", 0)}
              onUploadNative={() => pickExperienceImage(index)}
              onWebFileChange={(e) => handleExperienceWebImagePick(index, e)}
              onRemoveImage={() => removeExperienceImage(index)}
              showRemove={!!getExperienceDisplayUri(item)}
            />
            <View style={styles.miniCardFields}>
              <TextInput style={styles.input} placeholder='Company' value={item.company} onChangeText={(text) => handleInputChange(index, "company", text)} />
              <TextInput style={styles.input} placeholder='Job Title' value={item.title} onChangeText={(text) => handleInputChange(index, "title", text)} />
              <TextInput
                style={styles.descriptionInput}
                placeholder='Description'
                value={item.description}
                onChangeText={(text) => handleInputChange(index, "description", text)}
                multiline={true}
                textAlignVertical='top'
                scrollEnabled={false}
              />
            </View>
          </View>

          <View style={styles.dateContainer}>
            <TextInput style={styles.dateInput} placeholder='MM/YYYY' value={item.startDate} onChangeText={(text) => handleDateChange(index, "startDate", text)} />
            <Text> - </Text>
            <TextInput style={styles.dateInput} placeholder='MM/YYYY' value={item.endDate} onChangeText={(text) => handleDateChange(index, "endDate", text)} />
            <TouchableOpacity onPress={() => deleteExperience(index)} style={styles.deleteButton}>
              <Image source={require("../assets/delete.png")} style={styles.deleteIcon} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: { marginBottom: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  label: { fontSize: 18, fontWeight: "bold" },
  addText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },

  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10, // spacing between label and +
  },

  toggleText: { fontSize: 14, fontWeight: "bold" },
  experienceCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
    marginBottom: 8,
    minHeight: 40,
    maxHeight: 120,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
    width: "35%",
  },
  dateSeparator: { fontSize: 16, fontWeight: "bold" },

  deleteIcon: { width: 20, height: 20 },
  expHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  miniCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  miniCardDark: {
    borderColor: "#404040",
    backgroundColor: "#2d2d2d",
  },
  miniCardFields: {
    flex: 1,
    minWidth: 0,
  },
  cardSpacing: {
    marginTop: 16,
  },
  toggleContainer: { flexDirection: "row", gap: 4 },
  togglePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: "transparent" },
  togglePillActiveGreen: { backgroundColor: "#4CAF50" },
  togglePillActiveRed: { backgroundColor: "#ef9a9a" },
  togglePillText: { fontSize: 13, color: "#4e4e4e", fontWeight: "500" },
  togglePillTextActive: { color: "#fff", fontWeight: "bold" },
});

export default ExperienceSection;
