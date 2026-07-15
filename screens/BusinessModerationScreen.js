import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppHeader from "../components/AppHeader";
import BottomNavBar from "../components/BottomNavBar";
import { useDarkMode } from "../contexts/DarkModeContext";
import { getHeaderColors } from "../config/headerColors";
import {
  acknowledgeBusinessModeration,
  canAcknowledgeTakenDownBusiness,
  getBusinessModerationOwnerMessage,
  getBusinessModerationStatus,
  getBusinessModerationStatusLabel,
  MODERATED_ACKNOWLEDGED,
  MODERATION_STATUS,
  BUSINESS_SUPPORT_EMAIL,
} from "../utils/businessModeration";

const MAROON = "#6f130f";

export default function BusinessModerationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { darkMode } = useDarkMode();
  const [moderationItem, setModerationItem] = useState(route.params?.moderationItem || null);
  const businessUid = route.params?.businessUid || route.params?.business_uid || "";
  const businessName = route.params?.businessName || "";
  const [acknowledging, setAcknowledging] = useState(false);

  const status = getBusinessModerationStatus(moderationItem);
  const isPending = status === MODERATION_STATUS.PENDING_REVIEW;
  const isAcknowledged = status === MODERATION_STATUS.ACKNOWLEDGED;
  // Acknowledged (3) uses the same taken-down screen as moderated === 1
  const isTakenDown =
    status === MODERATION_STATUS.TAKEN_DOWN ||
    status === MODERATION_STATUS.REJECTED ||
    isAcknowledged ||
    (!isPending && status != null);
  const statusLabel = isTakenDown && !isPending ? "Taken down" : getBusinessModerationStatusLabel(moderationItem);
  const message = getBusinessModerationOwnerMessage(moderationItem);
  const canAcknowledge = canAcknowledgeTakenDownBusiness(moderationItem);

  const openSupportEmail = () => Linking.openURL(`mailto:${BUSINESS_SUPPORT_EMAIL}`);

  const handleAcknowledge = async () => {
    if (!canAcknowledge || acknowledging) return;
    setAcknowledging(true);
    try {
      const profileUid = ((await AsyncStorage.getItem("profile_uid")) || "").trim();
      const result = await acknowledgeBusinessModeration({
        businessUid,
        profileUid,
      });
      const already = result?.already_acknowledged === true || result?.data?.already_acknowledged === true;
      setModerationItem((prev) => ({
        ...(prev || {}),
        business_moderated: MODERATED_ACKNOWLEDGED,
        moderation: {
          ...(prev?.moderation || {}),
          moderated: MODERATED_ACKNOWLEDGED,
          status: MODERATION_STATUS.ACKNOWLEDGED,
        },
      }));
      Alert.alert(
        already ? "Already acknowledged" : "Acknowledged",
        already
          ? "This take-down was already acknowledged. Your business remains hidden."
          : "You acknowledged this take-down. Your business remains hidden from others.",
      );
    } catch (e) {
      console.error("BusinessModerationScreen - acknowledge failed:", e);
      Alert.alert("Error", e?.message || "Failed to acknowledge business take-down.");
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
      <AppHeader title='YOUR BUSINESS' {...getHeaderColors("businessProfile")} />

      <ScrollView contentContainerStyle={styles.page}>
        <View style={[styles.iconWrap, isPending ? styles.iconWrapPending : styles.iconWrapTakenDown]}>
          <Ionicons name={isPending ? "hourglass-outline" : "warning-outline"} size={42} color={isPending ? "#B45309" : "#B71C1C"} />
        </View>

        <Text style={[styles.title, darkMode && styles.darkText]}>{statusLabel}</Text>
        {businessName ? <Text style={[styles.businessName, darkMode && styles.darkSubtitle]}>{businessName}</Text> : null}

        <View style={[styles.card, darkMode && styles.darkCard]}>
          <Text style={[styles.bodyText, darkMode && styles.darkBodyText]}>{message || "Your business is currently unavailable."}</Text>
        </View>

        <View style={[styles.card, darkMode && styles.darkCard]}>
          <Text style={[styles.secTitle, darkMode && styles.darkText]}>Disputes</Text>
          <Text style={[styles.bodyText, darkMode && styles.darkBodyText]}>
            If you believe this action was made in error, contact our support team to request a review.
          </Text>
          <TouchableOpacity style={styles.contactRow} onPress={openSupportEmail} activeOpacity={0.7}>
            <Ionicons name='mail-outline' size={22} color={MAROON} />
            <Text style={styles.contactLink}>{BUSINESS_SUPPORT_EMAIL}</Text>
          </TouchableOpacity>
        </View>

        {isTakenDown ? (
          <View style={[styles.card, darkMode && styles.darkCard]}>
            <Text style={[styles.bodyText, darkMode && styles.darkBodyText]}>
              While your business is taken down, it is hidden from search and other members cannot view it.
            </Text>
          </View>
        ) : null}

        {isPending ? (
          <View style={[styles.card, darkMode && styles.darkCard]}>
            <Text style={[styles.bodyText, darkMode && styles.darkBodyText]}>
              Your business is temporarily hidden while our team reviews reports. You will regain access if your business is approved.
            </Text>
          </View>
        ) : null}

        {canAcknowledge ? (
          <TouchableOpacity
            style={[styles.acknowledgeButton, acknowledging && styles.buttonDisabled]}
            onPress={handleAcknowledge}
            disabled={acknowledging}
            activeOpacity={0.85}
          >
            {acknowledging ? (
              <ActivityIndicator color='#fff' size='small' />
            ) : (
              <>
                <Ionicons name='checkmark-circle-outline' size={18} color='#fff' style={{ marginRight: 8 }} />
                <Text style={styles.settingsButtonText}>Acknowledge take-down</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.settingsButton} onPress={() => navigation.navigate("Settings")} activeOpacity={0.85}>
          <Ionicons name='settings-outline' size={18} color='#fff' style={{ marginRight: 8 }} />
          <Text style={styles.settingsButtonText}>Account settings</Text>
        </TouchableOpacity>

        <View style={styles.bottomBuffer} />
      </ScrollView>

      <BottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  darkSafeArea: { backgroundColor: "#1a1a1a" },
  page: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: "center",
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  iconWrapPending: {
    backgroundColor: "#FFFBEB",
  },
  iconWrapTakenDown: {
    backgroundColor: "#FFF5F5",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#B71C1C",
    textAlign: "center",
    marginBottom: 6,
  },
  businessName: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  card: {
    width: "100%",
    backgroundColor: "#fafafa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 16,
    marginBottom: 14,
  },
  darkCard: {
    backgroundColor: "#2a2a2a",
    borderColor: "#444",
  },
  secTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#444",
  },
  darkText: {
    color: "#fff",
  },
  darkSubtitle: {
    color: "#bbb",
  },
  darkBodyText: {
    color: "#ccc",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 10,
  },
  contactLink: {
    fontSize: 15,
    color: MAROON,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  acknowledgeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#B71C1C",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 4,
    marginBottom: 10,
    minWidth: 220,
  },
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4B2E83",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  settingsButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  bottomBuffer: {
    height: 24,
  },
});
