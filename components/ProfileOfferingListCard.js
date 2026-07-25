import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ProfileSectionItemImage from "./ProfileSectionItemImage";
import OfferingCardDetails from "./OfferingCardDetails";
import OfferingModerationBanner from "./OfferingModerationBanner";
import ProfileItemEditIcon from "./ProfileItemEditIcon";
import { SEEKING_FORM_ACCENT, SEEKING_FORM_ACCENT_DARK } from "../utils/profileItemCardFormStyles";
import { resolveProfileItemImageUri } from "../utils/resolveProfileItemImageUri";
import { buildOfferingCardModel } from "../utils/offeringResubmission";

function resolveDisplayUri(item, profileUid) {
  const pending = item?._expNewImageUri;
  if (pending != null && String(pending).trim() !== "") return String(pending).trim();
  return resolveProfileItemImageUri(item?.profile_expertise_image, profileUid);
}

/** Collapsed offering row for Edit Profile — matches profile listing with edit/delete actions. */
export default function ProfileOfferingListCard({
  item,
  profileUid = "",
  darkMode = false,
  onEdit,
  onDelete,
  showActions = true,
  showModerationBanner = true,
}) {
  const title = String(item?.name || "").trim() || "Untitled offering";
  const description = String(item?.description || "").trim();
  const imageUri = resolveDisplayUri(item, profileUid);
  const offering = buildOfferingCardModel(item, profileUid);
  const showFooter = showActions && (onEdit || onDelete);

  return (
    <View style={[styles.card, darkMode && styles.cardDark]}>
      {showModerationBanner ? <OfferingModerationBanner item={item} darkMode={darkMode} compact /> : null}
      <View style={styles.topRow}>
        <ProfileSectionItemImage section='offering' imageUri={imageUri} imageIsPublic={item?.profile_expertise_image_is_public} size={56} darkMode={darkMode} />
        <View style={styles.textColumn}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, darkMode && styles.titleDark]} numberOfLines={2}>
              {title}
            </Text>
            {item?.isPublic === false ? (
              <View style={[styles.hiddenBadge, darkMode && styles.hiddenBadgeDark]}>
                <Text style={styles.hiddenBadgeText}>Hidden</Text>
              </View>
            ) : null}
          </View>
          {description ? (
            <Text style={[styles.description, darkMode && styles.descriptionDark]} numberOfLines={2}>
              {description}
            </Text>
          ) : null}
        </View>
      </View>
      <OfferingCardDetails offering={offering} darkMode={darkMode} variant='list' metaTextStyle={[styles.metaText, darkMode && styles.metaTextDark]} />
      {showFooter ? (
        <View style={[styles.footer, darkMode && styles.footerDark]}>
          <View style={styles.footerSpacer} />
          <View style={styles.footerActions}>
            {onEdit ? (
              <TouchableOpacity onPress={onEdit} style={[styles.actionButton, styles.editButton, darkMode && styles.editButtonDark]} activeOpacity={0.8}>
                <ProfileItemEditIcon size={18} tintColor={darkMode ? "#f0c0c0" : "#9e4545"} />
              </TouchableOpacity>
            ) : null}
            {onDelete ? (
              <TouchableOpacity onPress={onDelete} style={[styles.actionButton, styles.deleteButton, darkMode && styles.deleteButtonDark]} activeOpacity={0.8} accessibilityLabel='Delete offering'>
                <Ionicons name='trash-outline' size={16} color={darkMode ? "#f87171" : "#dc2626"} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fff",
  },
  cardDark: {
    borderColor: "#404040",
    backgroundColor: "#2d2d2d",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 4,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  titleDark: {
    color: "#f9fafb",
  },
  description: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
  },
  descriptionDark: {
    color: "#d1d5db",
  },
  hiddenBadge: {
    backgroundColor: "#fee2e2",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  hiddenBadgeDark: {
    backgroundColor: "#4a2020",
  },
  hiddenBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#b91c1c",
  },
  metaText: {
    fontSize: 13,
    color: "#666",
  },
  metaTextDark: {
    color: "#bbb",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  footerDark: {
    borderTopColor: "#404040",
  },
  footerSpacer: {
    flex: 1,
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  editButton: {
    borderColor: "#e8bcbc",
    backgroundColor: "#fdf5f5",
  },
  editButtonDark: {
    borderColor: SEEKING_FORM_ACCENT_DARK,
    backgroundColor: "#3a2828",
  },
  deleteButton: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  deleteButtonDark: {
    borderColor: "#991b1b",
    backgroundColor: "#450a0a",
  },
});
