import React, { useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from "react-native";

const DEFAULT_ITEM_IMAGE = require("../assets/profile.png");

/**
 * Left column for Offering / Seeking cards — matches EditBusinessProfile product image pattern.
 */
const ProfileItemImageColumn = ({
  darkMode = false,
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
}) => {
  const webInputRef = useRef(null);

  const source = displayUri && !imageError ? { uri: displayUri } : DEFAULT_ITEM_IMAGE;

  const triggerUpload = () => {
    if (Platform.OS === "web") {
      webInputRef.current?.click?.();
    } else {
      onUploadNative?.();
    }
  };

  return (
    <View style={styles.left}>
      <Image source={source} style={[styles.image, darkMode && styles.imageDark]} onError={onImageError} />
      <View style={styles.showHideRow}>
        <TouchableOpacity
          onPress={onShowTools}
          style={[styles.togglePill, toolsVisible && styles.togglePillActive, darkMode && !toolsVisible && styles.togglePillDark]}
          activeOpacity={0.7}
        >
          <Text style={[styles.togglePillText, toolsVisible && styles.togglePillTextActive, !toolsVisible && darkMode && styles.togglePillTextMutedDark]}>
            Show
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onHideTools}
          style={[styles.togglePill, !toolsVisible && styles.togglePillActive, darkMode && toolsVisible && styles.togglePillDark]}
          activeOpacity={0.7}
        >
          <Text style={[styles.togglePillText, !toolsVisible && styles.togglePillTextActive, toolsVisible && darkMode && styles.togglePillTextMutedDark]}>
            Hide
          </Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[styles.uploadBtn, darkMode && styles.uploadBtnDark]} onPress={triggerUpload} activeOpacity={0.8}>
        <Text style={styles.uploadBtnText}>Upload</Text>
      </TouchableOpacity>
      {toolsVisible && showRemove ? (
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
  left: {
    width: 100,
    alignItems: "center",
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  imageDark: {
    backgroundColor: "#404040",
  },
  showHideRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 6,
    marginTop: 8,
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
    backgroundColor: "#9C45F7",
    borderColor: "#9C45F7",
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
    marginTop: 8,
    backgroundColor: "#00C721",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  uploadBtnDark: {
    backgroundColor: "#00a01b",
  },
  uploadBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  removeBtn: {
    marginTop: 6,
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
