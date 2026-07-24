import React, { useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ProfileSectionItemImage from "./ProfileSectionItemImage";
import { PROFILE_ITEM_FORM_ACCENT } from "../utils/profileItemCardFormStyles";

/**
 * Left column for Education / Experience / Offering / Seeking cards — matches EditBusinessProfile product image pattern.
 */
const ProfileItemImageColumn = ({
  darkMode = false,
  defaultSection,
  displayUri,
  imageError,
  onImageError,
  toolsVisible,
  onShowTools,
  onHideTools,
  onUploadNative,
  onWebFileChange,
  onRemoveImage,
  showRemove,
  accentColor = PROFILE_ITEM_FORM_ACCENT,
}) => {
  const webInputRef = useRef(null);
  const showCustomImage = displayUri && !imageError;

  const triggerUpload = () => {
    if (Platform.OS === "web") {
      webInputRef.current?.click?.();
    } else {
      onUploadNative?.();
    }
  };

  return (
    <View style={styles.mediaColumn}>
      {showCustomImage ? (
        <Image source={{ uri: displayUri }} style={[styles.image, darkMode && styles.imageDark, { borderColor: `${accentColor}47` }]} onError={onImageError} />
      ) : (
        <ProfileSectionItemImage section={defaultSection} size={88} darkMode={darkMode} />
      )}
      <View style={styles.showHideRow}>
        <TouchableOpacity
          onPress={onShowTools}
          style={[styles.togglePill, toolsVisible && styles.togglePillActive, darkMode && !toolsVisible && styles.togglePillDark, toolsVisible && { backgroundColor: accentColor, borderColor: accentColor }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.togglePillText, toolsVisible && styles.togglePillTextActive, !toolsVisible && darkMode && styles.togglePillTextMutedDark]}>
            Show
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onHideTools}
          style={[styles.togglePill, !toolsVisible && styles.togglePillActive, darkMode && toolsVisible && styles.togglePillDark, !toolsVisible && { backgroundColor: accentColor, borderColor: accentColor }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.togglePillText, !toolsVisible && styles.togglePillTextActive, toolsVisible && darkMode && styles.togglePillTextMutedDark]}>
            Hide
          </Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[styles.uploadBtn, darkMode && styles.uploadBtnDark, { borderColor: accentColor }]} onPress={triggerUpload} activeOpacity={0.8}>
        <Ionicons name='cloud-upload-outline' size={16} color={darkMode ? "#e8b4b4" : accentColor} />
        <Text style={[styles.uploadBtnText, darkMode && styles.uploadBtnTextDark, { color: darkMode ? "#e8b4b4" : accentColor }]} numberOfLines={1}>
          Upload
        </Text>
      </TouchableOpacity>
      {showRemove ? (
        <TouchableOpacity onPress={onRemoveImage} style={styles.removeBtn}>
          <Text style={[styles.removeText, darkMode && styles.removeTextDark]}>Remove image</Text>
        </TouchableOpacity>
      ) : null}
      {Platform.OS === "web" &&
        React.createElement("input", {
          ref: webInputRef,
          type: "file",
          accept: "image/*",
          style: { display: "none" },
          onChange: onWebFileChange,
        })}
    </View>
  );
};

const styles = StyleSheet.create({
  mediaColumn: {
    width: 120,
    alignItems: "center",
    gap: 8,
  },
  image: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
  },
  imageDark: {
    backgroundColor: "#404040",
  },
  showHideRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 6,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  togglePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "transparent",
  },
  togglePillActive: {
    backgroundColor: PROFILE_ITEM_FORM_ACCENT,
    borderColor: PROFILE_ITEM_FORM_ACCENT,
  },
  togglePillDark: {
    borderColor: "#555",
  },
  togglePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555",
  },
  togglePillTextActive: {
    color: "#fff",
  },
  togglePillTextMutedDark: {
    color: "#999",
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#fff",
    width: "100%",
  },
  uploadBtnDark: {
    backgroundColor: "#2d2d2d",
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  uploadBtnTextDark: {},
  removeBtn: {
    paddingVertical: 4,
  },
  removeText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "underline",
    textAlign: "center",
  },
  removeTextDark: {
    color: "#f87171",
  },
});

export default ProfileItemImageColumn;
