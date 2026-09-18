import React from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { useDarkMode } from "../contexts/DarkModeContext";
import { sanitizeText, isSafeForConditional } from "../utils/textSanitizer";
import { DELETED_USER_LABEL, isProfileDeleted } from "../utils/deletedProfile";
import { resolvePersonalDisplayFlag, PERSONAL_AUDIENCE_KEYS } from "../utils/profileAudience";

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

const MicroCard = ({ user, showRelationship = true, embedded = false, nameSuffix = null, headerAccessory = null, relationshipFooter = null, relationshipMeta = null, isNew = false }) => {
  const { darkMode } = useDarkMode();

  const deleted = isProfileDeleted(user);
  const showAsNew = !deleted && (isNew || user?.isNew === true);
  const firstName = deleted ? "" : sanitizeText(user?.firstName || user?.personal_info?.profile_personal_first_name);
  const lastName = deleted ? "" : sanitizeText(user?.lastName || user?.personal_info?.profile_personal_last_name);
  const tagLine = sanitizeText(user?.tagLine || user?.personal_info?.profile_personal_tagline || user?.personal_info?.profile_personal_tag_line);
  const profileImageRaw = user?.profileImage ?? user?.personal_info?.profile_personal_image ?? "";
  const profileImage = sanitizeText(typeof profileImageRaw === "string" ? profileImageRaw : String(profileImageRaw || ""));

  const tagLineIsPublic = resolvePersonalDisplayFlag(user?.tagLineIsPublic, user, PERSONAL_AUDIENCE_KEYS.tagLine);
  const imageIsPublic = resolvePersonalDisplayFlag(user?.imageIsPublic, user, PERSONAL_AUDIENCE_KEYS.image);

  const nameParts = deleted ? [] : [firstName, lastName].filter((part) => part && part !== "." && part.trim() !== "" && !part.match(/^[\s.,;:!?\-_=+]*$/));
  const displayName = deleted ? DELETED_USER_LABEL : nameParts.length ? nameParts.join(" ") : "Unknown";

  const hasUploadedImage = !deleted && profileImage && String(profileImage).trim() !== "" && isSafeForConditional(profileImage);
  const showUploadedImage = hasUploadedImage && imageIsPublic;
  const userImageSource = showUploadedImage ? { uri: String(profileImage) } : getDefaultProfileImageSource();
  const defaultImgSource = getDefaultProfileImageSource();
  const hasValidDefault = defaultImgSource && (typeof defaultImgSource === "number" || (typeof defaultImgSource === "object" && defaultImgSource?.uri !== ""));

  const showTagline = !deleted && tagLineIsPublic && isSafeForConditional(tagLine) && tagLine !== "." && tagLine.trim() !== "";
  const relationshipText = formatRelationship(user);
  const metaText = relationshipMeta != null && String(relationshipMeta).trim() !== "" ? String(relationshipMeta).trim() : null;
  const showRelationshipColumn = showRelationship || !!relationshipFooter || !!metaText;

  return (
    <View style={[styles.cardContainer, deleted && styles.deletedCardContainer, embedded && styles.embeddedCardContainer, darkMode && styles.darkCardContainer, deleted && darkMode && styles.darkDeletedCardContainer, embedded && darkMode && styles.darkEmbeddedCardContainer, showAsNew && styles.newCardContainer, showAsNew && darkMode && styles.darkNewCardContainer]}>
      <Image
        source={userImageSource}
        style={[styles.profileImage, darkMode && styles.darkProfileImage]}
        {...(hasValidDefault ? { defaultSource: defaultImgSource } : {})}
      />

      <View style={styles.textColumn}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, deleted && styles.deletedName, darkMode && styles.darkName, nameSuffix ? styles.nameWithSuffix : null]} numberOfLines={nameSuffix ? 2 : 1}>
            {displayName}
            {nameSuffix ? <Text style={[styles.nameSuffix, darkMode && styles.darkNameSuffix]}>{` ${nameSuffix}`}</Text> : null}
          </Text>
          {/* {showAsNew ? (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>New</Text>
            </View>
          ) : null} */}
          {headerAccessory}
        </View>
        {showTagline ? (
          <Text style={[styles.tagline, darkMode && styles.darkText]} numberOfLines={2}>
            {tagLine}
          </Text>
        ) : null}
      </View>

      {showRelationshipColumn ? (
        <View style={styles.relationshipColumn}>
          {showRelationship ? (
            <Text style={[styles.relationship, darkMode && styles.darkText]} numberOfLines={1} ellipsizeMode='clip'>
              {relationshipText}
            </Text>
          ) : null}
          {metaText ? (
            <Text style={[styles.relationshipMeta, darkMode && styles.darkRelationshipMeta]} numberOfLines={1} ellipsizeMode='clip'>
              {metaText}
            </Text>
          ) : null}
          {relationshipFooter}
        </View>
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
  embeddedCardContainer: {
    width: "100%",
    alignSelf: "stretch",
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  darkEmbeddedCardContainer: {
    backgroundColor: "transparent",
  },
  profileImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  darkProfileImage: {},
  // List avatar ring — unused for now; graph still uses a green ring.
  // avatarWrap: {
  //   marginRight: 12,
  // },
  // newAvatarRing: {
  //   borderWidth: 2.5,
  //   borderColor: "#22c55e",
  //   borderRadius: 24,
  //   padding: 1.5,
  // },
  newCardContainer: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },
  darkNewCardContainer: {
    borderColor: "#166534",
    backgroundColor: "#14532d33",
  },
  // New badge — keep styles handy if we re-enable the badge.
  // newBadge: {
  //   marginLeft: 8,
  //   paddingHorizontal: 6,
  //   paddingVertical: 2,
  //   borderRadius: 4,
  //   backgroundColor: "#22c55e",
  //   alignSelf: "center",
  // },
  // newBadgeText: {
  //   fontSize: 11,
  //   fontWeight: "700",
  //   color: "#ffffff",
  //   letterSpacing: 0.2,
  // },
  textColumn: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    flexShrink: 1,
  },
  nameWithSuffix: {
    flexWrap: "wrap",
  },
  nameSuffix: {
    fontSize: 12,
    fontWeight: "normal",
    color: "#666",
  },
  darkNameSuffix: {
    color: "#aaaaaa",
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
  relationshipColumn: {
    flexShrink: 0,
    alignItems: "flex-end",
  },
  relationship: {
    fontSize: 13,
    color: "#666",
    fontStyle: "italic",
    textAlign: "right",
    flexShrink: 0,
    ...(Platform.OS === "web" ? { whiteSpace: "nowrap" } : {}),
  },
  relationshipMeta: {
    fontSize: 11,
    color: "#999",
    textAlign: "right",
    marginTop: 2,
    flexShrink: 0,
    ...(Platform.OS === "web" ? { whiteSpace: "nowrap" } : {}),
  },
  darkRelationshipMeta: {
    color: "#888",
  },
  deletedCardContainer: {
    opacity: 0.72,
    backgroundColor: "#f0f0f0",
    borderColor: "#ccc",
  },
  darkDeletedCardContainer: {
    backgroundColor: "#2a2a2a",
    borderColor: "#555",
  },
  deletedName: {
    color: "#888",
    fontStyle: "italic",
  },
});

export default MicroCard;
