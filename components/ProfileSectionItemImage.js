import React, { useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { getProfileSectionIconName, hasCustomProfileSectionImage, isProfileItemImageHidden } from "../utils/profileSectionDefaults";

export function ProfileSectionDefaultIcon({ section, size = 56, darkMode = false, style }) {
  const iconName = getProfileSectionIconName(section);
  const iconSize = Math.round(size * 0.52);

  return (
    <View style={[styles.iconBox, { width: size, height: size }, darkMode && styles.iconBoxDark, style]}>
      <MaterialIcons name={iconName} size={iconSize} color={darkMode ? "#cccccc" : "#555555"} />
    </View>
  );
}

/**
 * Shows a uploaded section image when visible, otherwise a crisp Material default icon.
 */
export default function ProfileSectionItemImage({ section, imageUri, imageIsHidden, imageIsPublic, size = 56, darkMode = false, style, resizeMode = "cover" }) {
  const [imageError, setImageError] = useState(false);
  const hidden = imageIsHidden ?? isProfileItemImageHidden(imageIsPublic);
  const showCustom = hasCustomProfileSectionImage({ imageUri, imageIsHidden: hidden, imageError });

  if (!showCustom) {
    return <ProfileSectionDefaultIcon section={section} size={size} darkMode={darkMode} style={style} />;
  }

  return <Image source={{ uri: imageUri }} style={[styles.image, { width: size, height: size }, darkMode && styles.imageDark, style]} resizeMode={resizeMode} onError={() => setImageError(true)} />;
}

const styles = StyleSheet.create({
  iconBox: {
    borderRadius: 8,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxDark: {
    backgroundColor: "#404040",
  },
  image: {
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  imageDark: {
    backgroundColor: "#333",
  },
});
