import React, { useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Platform, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { resolveProfileItemImageUri, isRemoteHttpUrl } from "../utils/resolveProfileItemImageUri";
import ProfileItemImageColumn from "./ProfileItemImageColumn";

const EducationSection = ({
  education,
  setEducation,
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

  const addEducation = () => {
    // Mark the next card index before state update, then notify parent after render.
    pendingNewIndexRef.current = education.length;
    const newEntry = {
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
    };
    setEducation([...education, newEntry]);
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
  }, [education.length, onInputFocus]);

  const deleteEducation = (index) => {
    handleDelete(index);
  };

  const handleInputChange = (index, field, value) => {
    const updated = [...education];
    updated[index][field] = value;
    setEducation(updated);
  };

  const handleDateChange = (index, field, value) => {
    const formattedValue = formatDateInput(value);
    handleInputChange(index, field, formattedValue);
  };

  const toggleEntryVisibility = (index) => {
    const updated = [...education];
    updated[index].isPublic = !updated[index].isPublic;
    setEducation(updated);
  };

  const getEducationDisplayUri = (item) => {
    const pending = item._eduNewImageUri;
    if (pending != null && String(pending).trim() !== "") return String(pending).trim();
    return resolveProfileItemImageUri(item.profile_education_image, profileUid);
  };

  const pickEducationImage = async (index) => {
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
        const updated = [...education];
        const prev = updated[index];
        const orig = prev._eduOriginalImage || resolveProfileItemImageUri(prev.profile_education_image, profileUid);
        updated[index]._eduDeleteImageUrl = isRemoteHttpUrl(orig) ? orig : "";
        updated[index]._eduNewImageUri = asset.uri;
        updated[index]._eduWebImageFile = null;
        updated[index]._eduImageError = false;
        setEducation(updated);
      }
    } catch (error) {
      console.error("Education image pick error:", error);
      Alert.alert("Error", "Failed to pick image.");
    }
  };

  const handleEducationWebImagePick = (index, event) => {
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
      const updated = [...education];
      const prev = updated[index];
      const orig = prev._eduOriginalImage || resolveProfileItemImageUri(prev.profile_education_image, profileUid);
      updated[index]._eduDeleteImageUrl = isRemoteHttpUrl(orig) ? orig : "";
      updated[index]._eduNewImageUri = imageUri;
      updated[index]._eduWebImageFile = file;
      updated[index]._eduImageError = false;
      setEducation(updated);
    };
    reader.readAsDataURL(file);
  };

  const removeEducationImage = (index) => {
    const updated = [...education];
    const prev = updated[index];
    const orig = prev._eduOriginalImage || resolveProfileItemImageUri(prev.profile_education_image, profileUid);
    updated[index]._eduDeleteImageUrl = isRemoteHttpUrl(orig) ? orig : "";
    updated[index]._eduNewImageUri = "";
    updated[index]._eduWebImageFile = null;
    updated[index].profile_education_image = "";
    updated[index]._eduOriginalImage = "";
    updated[index]._eduImageError = false;
    setEducation(updated);
  };

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.headerRow}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Education</Text>
          <TouchableOpacity onPress={addEducation}>
            <Text style={styles.addText}>+</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.toggleContainer}>
          <TouchableOpacity onPress={toggleVisibility} style={[styles.togglePill, isPublic && styles.togglePillActiveGreen]}>
            <Text style={[styles.togglePillText, isPublic && styles.togglePillTextActive]}>{isPublic ? "Visible" : "Show"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleVisibility} style={[styles.togglePill, !isPublic && styles.togglePillActiveRed]}>
             <Text style={[styles.togglePillText, !isPublic && styles.togglePillTextActive]}>{!isPublic ? "Hidden" : "Hide"}</Text>
          </TouchableOpacity>
          </View>
      </View>

      {education.map((item, index) => (
        <View
          key={index}
          ref={(ref) => {
            // Capture each card ref for new-card scroll targeting.
            if (ref) cardRefs.current[index] = ref;
          }}
          style={[styles.card, index > 0 && styles.cardSpacing]}
        >
          <View style={styles.rowHeader}>
            <Text style={styles.label}>Entry #{index + 1}</Text>

            {/* Individual public/private toggle */}
            <View style={styles.toggleContainer}>
                          <TouchableOpacity
                           onPress={() => toggleEntryVisibility(index)}
                            style={[styles.togglePill, item.isPublic && styles.togglePillActiveGreen]}
                          >
                            <Text style={[styles.togglePillText, item.isPublic && styles.togglePillTextActive]}>{item.isPublic ? "Visible" : "Show"}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => toggleEntryVisibility(index)}
                            style={[styles.togglePill, !item.isPublic && styles.togglePillActiveRed]}
                          >
                            <Text style={[styles.togglePillText, !item.isPublic && styles.togglePillTextActive]}>{!item.isPublic ? "Hidden" : "Hide"}</Text>
                          </TouchableOpacity>
                        </View>
          </View>
          <View style={[styles.miniCard, darkMode && styles.miniCardDark]}>
            <ProfileItemImageColumn
              darkMode={darkMode}
              displayUri={getEducationDisplayUri(item)}
              imageError={!!item._eduImageError}
              onImageError={() => handleInputChange(index, "_eduImageError", true)}
              toolsVisible={
                item.profile_education_image_is_public === 1 ||
                item.profile_education_image_is_public === "1" ||
                item.profile_education_image_is_public === true
              }
              onShowTools={() => handleInputChange(index, "profile_education_image_is_public", 1)}
              onHideTools={() => handleInputChange(index, "profile_education_image_is_public", 0)}
              onUploadNative={() => pickEducationImage(index)}
              onWebFileChange={(e) => handleEducationWebImagePick(index, e)}
              onRemoveImage={() => removeEducationImage(index)}
              showRemove={!!getEducationDisplayUri(item)}
            />
            <View style={styles.miniCardFields}>
              <TextInput style={styles.input} placeholder='School' value={item.school} onChangeText={(text) => handleInputChange(index, "school", text)} />
              <TextInput style={styles.input} placeholder='Degree' value={item.degree} onChangeText={(text) => handleInputChange(index, "degree", text)} />
            </View>
          </View>
          <View style={styles.dateRow}>
            <TextInput style={styles.dateInput} placeholder='MM/YYYY' value={item.startDate} onChangeText={(text) => handleDateChange(index, "startDate", text)} />
            <Text style={styles.dash}> - </Text>
            <TextInput style={styles.dateInput} placeholder='MM/YYYY' value={item.endDate} onChangeText={(text) => handleDateChange(index, "endDate", text)} />
            <TouchableOpacity onPress={() => deleteEducation(index)}>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  label: { fontSize: 18, fontWeight: "bold" },
  addText: { color: "#000000", fontWeight: "bold", fontSize: 24 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10, // spacing between label and +
  },
  toggleText: { fontWeight: "bold" },
  card: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 10,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  rowHeader: {
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
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#fff",
    marginBottom: 5,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#fff",
    width: "35%",
  },
  dash: { fontSize: 16, fontWeight: "bold" },

  deleteIcon: { width: 20, height: 20 },
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

export default EducationSection;
