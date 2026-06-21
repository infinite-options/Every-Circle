import React from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { useDarkMode } from "../contexts/DarkModeContext";
import { sanitizeText, isSafeForConditional } from "../utils/textSanitizer";

let PROFILE_IMAGE_SOURCE;
try {
  PROFILE_IMAGE_SOURCE = require("../assets/profile.png");
} catch (e) {
  if (Platform.OS !== "web") {
    console.warn("Could not load profile.png on native");
  }
  PROFILE_IMAGE_SOURCE = null;
}

function getDefaultProfileImageSource() {
  if (PROFILE_IMAGE_SOURCE) return PROFILE_IMAGE_SOURCE;
  try {
    return require("../assets/profile.png");
  } catch (e) {
    return { uri: "" };
  }
}

function formatRelationship(user) {
  const relationship = user?.relationship || user?.circle_relationship;
  if (relationship && String(relationship).trim() !== "") {
    const text = String(relationship).trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  return "Relationship not Assigned";
}

const MicroCard = ({ user, showRelationship = true }) => {
  const { darkMode } = useDarkMode();

  const firstName = sanitizeText(user?.firstName || user?.personal_info?.profile_personal_first_name);
  const lastName = sanitizeText(user?.lastName || user?.personal_info?.profile_personal_last_name);
  const tagLine = sanitizeText(user?.tagLine || user?.personal_info?.profile_personal_tagline || user?.personal_info?.profile_personal_tag_line);
  const profileImageRaw = user?.profileImage ?? user?.personal_info?.profile_personal_image ?? "";
  const profileImage = sanitizeText(typeof profileImageRaw === "string" ? profileImageRaw : String(profileImageRaw || ""));

  const tagLineIsPublic = user?.personal_info?.profile_personal_tagline_is_public == 1 || user?.personal_info?.profile_personal_tag_line_is_public == 1 || user?.tagLineIsPublic;
  const imageIsPublic = user?.personal_info?.profile_personal_image_is_public == 1 || user?.imageIsPublic === true || user?.imageIsPublic === 1 || user?.imageIsPublic === "1";

  const nameParts = [firstName, lastName].filter((part) => part && part !== "." && part.trim() !== "" && !part.match(/^[\s.,;:!?\-_=+]*$/));
  const displayName = nameParts.length ? nameParts.join(" ") : "Unknown";

  const hasUploadedImage = profileImage && String(profileImage).trim() !== "" && isSafeForConditional(profileImage);
  const showUploadedImage = hasUploadedImage && imageIsPublic;
  const userImageSource = showUploadedImage ? { uri: String(profileImage) } : getDefaultProfileImageSource();
  const defaultImgSource = getDefaultProfileImageSource();
  const hasValidDefault = defaultImgSource && (typeof defaultImgSource === "number" || (typeof defaultImgSource === "object" && defaultImgSource?.uri !== ""));

  const showTagline = tagLineIsPublic && isSafeForConditional(tagLine) && tagLine !== "." && tagLine.trim() !== "";
  const relationshipText = formatRelationship(user);

  return (
    <View style={[styles.cardContainer, darkMode && styles.darkCardContainer]}>
      <Image
        source={userImageSource}
        style={[styles.profileImage, darkMode && styles.darkProfileImage]}
        {...(hasValidDefault ? { defaultSource: defaultImgSource } : {})}
      />

      <View style={styles.textColumn}>
        <Text style={[styles.name, darkMode && styles.darkName]} numberOfLines={1}>
          {displayName}
        </Text>
        {showTagline ? (
          <Text style={[styles.tagline, darkMode && styles.darkText]} numberOfLines={2}>
            {tagLine}
          </Text>
        ) : null}
      </View>

      {showRelationship ? (
        <Text style={[styles.relationship, darkMode && styles.darkText]} numberOfLines={2}>
          {relationshipText}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  darkCardContainer: {
    backgroundColor: "#2d2d2d",
    borderColor: "#444",
  },
  profileImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  darkProfileImage: {},
  textColumn: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  darkName: {
    color: "#fff",
  },
  tagline: {
    fontSize: 13,
    color: "#666",
  },
  darkText: {
    color: "#ccc",
  },
  relationship: {
    fontSize: 13,
    color: "#666",
    fontStyle: "italic",
    textAlign: "right",
    maxWidth: 96,
    flexShrink: 0,
  },
});

export default MicroCard;
