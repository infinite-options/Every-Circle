// ConnectWebScreen.js - Web landing page for QR code links
// This screen is shown when someone scans a QR code on the web
// It tries to open the app, and if that fails, shows signup/vCard options
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Platform } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useDarkMode } from "../contexts/DarkModeContext";
import { USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";
import MiniCard from "../components/MiniCard";
import { sanitizeText } from "../utils/textSanitizer";
import AppHeader from "../components/AppHeader";

const ConnectWebScreen = () => {
  const { darkMode } = useDarkMode();
  const route = useRoute();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState(null);
  const [appOpened, setAppOpened] = useState(false);

  const profileUid = route.params?.profile_uid || (Platform.OS === "web" && typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("profile_uid") : null);

  useEffect(() => {
    if (profileUid) {
      fetchProfileData();
      // Try to open the app
      attemptOpenApp();
    } else {
      setError("No profile UID provided");
      setLoading(false);
    }
  }, [profileUid]);

  const attemptOpenApp = () => {
    if (!profileUid || Platform.OS !== "web") return;

    // Try to open the app using deep link (web approach)
    const deepLinkUrl = `everycircle://connect?profile_uid=${profileUid}`;

    // On web, try to open the app using window.location or a hidden iframe
    try {
      // Try using window.location (works for some browsers)
      const timeout = setTimeout(() => {
        console.log("App not opened, showing web options");
        setAppOpened(false);
      }, 2000);

      // Try to open the app
      if (typeof window !== "undefined") {
        // Create a hidden link and click it
        const link = document.createElement("a");
        link.href = deepLinkUrl;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setAppOpened(true);
        clearTimeout(timeout);
        setTimeout(() => {
          setAppOpened(false);
        }, 2000);
      }
    } catch (err) {
      console.error("Error attempting to open app:", err);
      setAppOpened(false);
    }
  };

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${profileUid}`);
      if (!response.ok) {
        throw new Error("Profile not found");
      }
      const apiUser = await response.json();

      const p = apiUser?.personal_info || {};
      const profileInfo = {
        profile_uid: profileUid,
        firstName: sanitizeText(p.profile_personal_first_name || ""),
        lastName: sanitizeText(p.profile_personal_last_name || ""),
        tagLine: sanitizeText(p.profile_personal_tag_line || p.profile_personal_tagline || ""),
        city: sanitizeText(p.profile_personal_city || ""),
        state: sanitizeText(p.profile_personal_state || ""),
        email: sanitizeText(apiUser?.user_email || ""),
        phoneNumber: sanitizeText(p.profile_personal_phone_number || ""),
        profileImage: sanitizeText(p.profile_personal_image ? String(p.profile_personal_image) : ""),
        emailIsPublic: p.profile_personal_email_is_public === 1,
        phoneIsPublic: p.profile_personal_phone_number_is_public === 1,
        tagLineIsPublic: p.profile_personal_tag_line_is_public === 1 || p.profile_personal_tagline_is_public === 1,
        locationIsPublic: p.profile_personal_location_is_public === 1,
        imageIsPublic: p.profile_personal_image_is_public === 1,
      };

      setProfileData(profileInfo);
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const createVCard = (data) => {
    const lines = ["BEGIN:VCARD", "VERSION:3.0"];

    const fullName = `${data.firstName} ${data.lastName}`.trim();
    if (fullName) {
      lines.push(`FN:${fullName}`);
      lines.push(`N:${data.lastName || ""};${data.firstName || ""};;;`);
    }

    if (data.tagLine) {
      lines.push(`ORG:${data.tagLine.replace(/[,;\\]/g, (m) => "\\" + m)}`);
    }

    if (data.city || data.state) {
      lines.push(`ADR;TYPE=home:;;${data.city || ""};${data.state || ""};;;`);
    }

    if (data.email) {
      lines.push(`EMAIL:${data.email}`);
    }

    if (data.phoneNumber) {
      const phone = data.phoneNumber.replace(/\D/g, "");
      lines.push(`TEL:${phone}`);
    }

    if (data.profileImage) {
      lines.push(`PHOTO;TYPE=URL:${data.profileImage}`);
    }

    lines.push("END:VCARD");
    return lines.join("\n");
  };

  const downloadVCard = () => {
    if (!profileData || Platform.OS !== "web") return;

    const vCard = createVCard(profileData);
    const blob = new Blob([vCard], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${profileData.firstName}_${profileData.lastName}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <View style={[styles.container, darkMode && styles.darkContainer]}>
        <AppHeader title='Connect' />
        <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size='large' color='#AF52DE' />
            <Text style={[styles.loadingText, darkMode && styles.darkLoadingText]}>Loading profile...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !profileData) {
    return (
      <View style={[styles.container, darkMode && styles.darkContainer]}>
        <AppHeader title='Connect' />
        <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, darkMode && styles.darkErrorText]}>{error || "Profile not found"}</Text>
            <TouchableOpacity style={styles.button} onPress={() => (Platform.OS === "web" && typeof window !== "undefined" ? (window.location.href = "/") : navigation.navigate("Home"))}>
              <Text style={styles.buttonText}>Go Home</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, darkMode && styles.darkContainer]}>
      <AppHeader title='Connect' />
      <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {appOpened ? (
            <View style={styles.appOpeningContainer}>
              <Text style={[styles.title, darkMode && styles.darkTitle]}>Opening EveryCircle App...</Text>
              <Text style={[styles.subtitle, darkMode && styles.darkSubtitle]}>If the app doesn't open, use the options below</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.title, darkMode && styles.darkTitle]}>Connect with {profileData.firstName}</Text>
              <Text style={[styles.subtitle, darkMode && styles.darkSubtitle]}>Add this person to your network</Text>

              <View style={styles.cardContainer}>
                <MiniCard user={profileData} />
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => (Platform.OS === "web" && typeof window !== "undefined" ? (window.location.href = "/SignUp") : navigation.navigate("SignUp"))}
                >
                  <Text style={styles.primaryButtonText}>Sign Up for EveryCircle</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryButton} onPress={downloadVCard}>
                  <Text style={[styles.secondaryButtonText, darkMode && styles.darkSecondaryButtonText]}>Download Contact (vCard)</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.linkButton} onPress={attemptOpenApp}>
                  <Text style={[styles.linkText, darkMode && styles.darkLinkText]}>Try Opening App Again</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  darkContainer: {
    backgroundColor: "#1a1a1a",
  },
  safeArea: {
    flex: 1,
  },
  darkSafeArea: {
    backgroundColor: "#1a1a1a",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#666",
  },
  darkLoadingText: {
    color: "#aaa",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "red",
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  darkErrorText: {
    color: "#f87171",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  darkTitle: {
    color: "#fff",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  darkSubtitle: {
    color: "#aaa",
  },
  appOpeningContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  cardContainer: {
    marginBottom: 30,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: "#AF52DE",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#AF52DE",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  secondaryButtonText: {
    color: "#AF52DE",
    fontSize: 16,
    fontWeight: "600",
  },
  darkSecondaryButtonText: {
    color: "#a78bfa",
  },
  linkButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  linkText: {
    color: "#AF52DE",
    fontSize: 14,
    fontWeight: "500",
  },
  darkLinkText: {
    color: "#a78bfa",
  },
  button: {
    backgroundColor: "#AF52DE",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});

export default ConnectWebScreen;
