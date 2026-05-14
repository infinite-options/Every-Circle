import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Share, SafeAreaView } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import MiniCard from "../components/MiniCard";
import { USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";
import { sanitizeText } from "../utils/textSanitizer";

function escapeVCardValue(value) {
  if (!value) return "";
  return String(value).replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function buildVCard(data) {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  const fullName = `${data.firstName} ${data.lastName}`.trim();
  if (fullName) {
    lines.push(`FN:${fullName}`);
    lines.push(`N:${data.lastName || ""};${data.firstName || ""};;;`);
  }
  if (data.tagLine) {
    lines.push(`ORG:${escapeVCardValue(data.tagLine)}`);
  }
  if (data.city || data.state) {
    lines.push(`ADR;TYPE=home:;;${data.city || ""};${data.state || ""};;;`);
  }
  if (data.email) {
    lines.push(`EMAIL:${data.email}`);
  }
  if (data.phoneNumber) {
    const phone = String(data.phoneNumber).replace(/\D/g, "");
    if (phone) lines.push(`TEL:${phone}`);
  }
  if (data.profile_uid) {
    lines.push(`NOTE:EveryCircle profile: ${data.profile_uid}`);
  }
  if (data.user_uid) {
    lines.push(`NOTE:User ID: ${data.user_uid}`);
  }
  if (data.profileImage) {
    lines.push(`PHOTO;TYPE=URL:${data.profileImage}`);
  }
  lines.push("END:VCARD");
  return lines.join("\n");
}

function resolveProfileUidFromRoute(route) {
  const fromParams = route?.params?.profile_uid;
  if (fromParams) return String(fromParams).trim();
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const seg = window.location.pathname.split("/scan/")[1];
    if (seg) return seg.split("/")[0]?.split("?")[0]?.trim() || null;
  }
  return null;
}

export default function ScanLandingScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const profileUid = resolveProfileUidFromRoute(route);

  const [loading, setLoading] = useState(!!profileUid);
  const [error, setError] = useState(null);
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    if (!profileUid) {
      setLoading(false);
      setError("Invalid or missing link.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${profileUid}`);
        if (!response.ok) {
          throw new Error("Profile not found");
        }
        const apiUser = await response.json();
        const p = apiUser?.personal_info || {};
        const tagLineIsPublic = p.profile_personal_tag_line_is_public === 1 || p.profile_personal_tagline_is_public === 1;
        const emailIsPublic = p.profile_personal_email_is_public === 1;
        const phoneIsPublic = p.profile_personal_phone_number_is_public === 1;
        const imageIsPublic = p.profile_personal_image_is_public === 1;
        const locationIsPublic = p.profile_personal_location_is_public === 1;

        const next = {
          profile_uid: profileUid,
          user_uid: apiUser?.user_uid != null ? String(apiUser.user_uid) : "",
          firstName: sanitizeText(p.profile_personal_first_name || ""),
          lastName: sanitizeText(p.profile_personal_last_name || ""),
          tagLine: tagLineIsPublic ? sanitizeText(p.profile_personal_tag_line || p.profile_personal_tagline || "") : "",
          email: emailIsPublic ? sanitizeText(apiUser?.user_email || "") : "",
          phoneNumber: phoneIsPublic ? sanitizeText(p.profile_personal_phone_number || "") : "",
          profileImage: imageIsPublic ? sanitizeText(p.profile_personal_image ? String(p.profile_personal_image) : "") : "",
          city: locationIsPublic ? sanitizeText(p.profile_personal_city || "") : "",
          state: locationIsPublic ? sanitizeText(p.profile_personal_state || "") : "",
          emailIsPublic,
          phoneIsPublic,
          tagLineIsPublic,
          locationIsPublic,
          imageIsPublic,
        };

        if (!cancelled) setProfileData(next);
      } catch (e) {
        if (!cancelled) setError(e.message || "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profileUid]);

  const goToSignUp = useCallback(() => {
    navigation.navigate("SignUp", { ref_profile_uid: profileUid });
  }, [navigation, profileUid]);

  const downloadVCard = useCallback(() => {
    if (!profileData) return;
    const vcard = buildVCard(profileData);
    const safeName = `${profileData.firstName}-${profileData.lastName}`.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "") || "everycircle-contact";
    const filename = `${safeName}.vcf`;

    if (Platform.OS === "web" && typeof document !== "undefined") {
      const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
      return;
    }

    Share.share({
      message: vcard,
      title: `${profileData.firstName} ${profileData.lastName}`.trim() || "Contact",
    }).catch(() => {});
  }, [profileData]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>EveryCircle</Text>
        <Text style={styles.headline}>Connect on EveryCircle</Text>
        <Text style={styles.sub}>Someone shared their profile with you. Join the app to connect, or save their public contact card below.</Text>

        {loading && (
          <View style={styles.centerRow}>
            <ActivityIndicator size="large" color="#2434C2" />
            <Text style={styles.muted}>Loading profile…</Text>
          </View>
        )}

        {!loading && error && <Text style={styles.error}>{error}</Text>}

        {!loading && !error && profileData && (
          <>
            <View style={styles.cardWrap}>
              <MiniCard user={profileData} />
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={goToSignUp} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Sign up for EveryCircle</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={downloadVCard} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>No thanks — save contact (.vcf)</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f7fb" },
  scroll: { padding: 24, paddingBottom: 48, maxWidth: 480, width: "100%", alignSelf: "center" },
  brand: { fontSize: 14, fontWeight: "600", color: "#2434C2", marginBottom: 8, textAlign: "center" },
  headline: { fontSize: 22, fontWeight: "700", color: "#111", marginBottom: 10, textAlign: "center" },
  sub: { fontSize: 15, color: "#444", lineHeight: 22, marginBottom: 24, textAlign: "center" },
  centerRow: { alignItems: "center", paddingVertical: 32, gap: 12 },
  muted: { fontSize: 14, color: "#666" },
  error: { color: "#b00020", textAlign: "center", fontSize: 15, marginTop: 16 },
  cardWrap: { marginBottom: 24 },
  primaryBtn: {
    backgroundColor: "#2434C2",
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600", textAlign: "center" },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2434C2",
    backgroundColor: "#fff",
  },
  secondaryBtnText: { color: "#2434C2", fontSize: 15, fontWeight: "600", textAlign: "center" },
});
