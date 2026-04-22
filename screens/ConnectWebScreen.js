// ConnectWebScreen.js - Web Connect tab: shows own profile + viewers, and handles QR code deep links
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Platform } from "react-native";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useDarkMode } from "../contexts/DarkModeContext";
import { USER_PROFILE_INFO_ENDPOINT, PROFILE_VIEWS_ENDPOINT } from "../apiConfig";
import MiniCard from "../components/MiniCard";
import { sanitizeText } from "../utils/textSanitizer";
import AppHeader from "../components/AppHeader";
import BottomNavBar from "../components/BottomNavBar";

const ConnectWebScreen = () => {
  const { darkMode } = useDarkMode();
  const route = useRoute();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);   // scanned person (QR)
  const [myProfileData, setMyProfileData] = useState(null); // logged-in user
  const [error, setError] = useState(null);
  const [appOpened, setAppOpened] = useState(false);

  // Viewer section state
  const [selectedAccount, setSelectedAccount] = useState("personal");
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [profileViewers, setProfileViewers] = useState([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [showViewers, setShowViewers] = useState(true);

  const profileUid = route.params?.profile_uid || (Platform.OS === "web" && typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("profile_uid") : null);

  useEffect(() => {
    if (profileUid) {
      setLoading(true);
      fetchProfileData();
      attemptOpenApp();
    }
  }, [profileUid]);

  // Load logged-in user's profile + businesses on focus
  useFocusEffect(
    React.useCallback(() => {
      fetchMyData();
    }, []),
  );

  // Reload viewers when account selection or businesses change
  useEffect(() => {
    fetchViewers();
  }, [selectedAccount, businesses]);

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

  const fetchMyData = async () => {
    try {
      const profileId = await AsyncStorage.getItem("profile_uid");
      if (!profileId) return;
      const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${profileId}`);
      if (!response.ok) return;
      const result = await response.json();
      const p = result?.personal_info || {};
      setMyProfileData({
        profile_uid: profileId,
        firstName: sanitizeText(p.profile_personal_first_name || ""),
        lastName: sanitizeText(p.profile_personal_last_name || ""),
        tagLine: sanitizeText(p.profile_personal_tag_line || p.profile_personal_tagline || ""),
        city: sanitizeText(p.profile_personal_city || ""),
        state: sanitizeText(p.profile_personal_state || ""),
        email: sanitizeText(result?.user_email || ""),
        phoneNumber: sanitizeText(p.profile_personal_phone_number || ""),
        profileImage: sanitizeText(p.profile_personal_image ? String(p.profile_personal_image) : ""),
        emailIsPublic: p.profile_personal_email_is_public === 1,
        phoneIsPublic: p.profile_personal_phone_number_is_public === 1,
        tagLineIsPublic: p.profile_personal_tag_line_is_public === 1 || p.profile_personal_tagline_is_public === 1,
        locationIsPublic: p.profile_personal_location_is_public === 1,
        imageIsPublic: p.profile_personal_image_is_public === 1,
      });
      const businessList = result.business_info
        ? typeof result.business_info === "string"
          ? JSON.parse(result.business_info)
          : result.business_info
        : [];
      setBusinesses(businessList);
    } catch (e) {
      console.warn("ConnectWebScreen - Failed to fetch my data:", e);
    }
  };

  const fetchViewers = async () => {
    try {
      setViewersLoading(true);
      const id = selectedAccount === "personal" ? await AsyncStorage.getItem("profile_uid") : selectedAccount;
      if (!id) return;
      const response = await fetch(`${PROFILE_VIEWS_ENDPOINT}/${id}`);
      if (response.ok) {
        const data = await response.json();
        setProfileViewers(data.viewers || []);
      } else {
        setProfileViewers([]);
      }
    } catch (e) {
      console.warn("ConnectWebScreen - Failed to fetch viewers:", e);
      setProfileViewers([]);
    } finally {
      setViewersLoading(false);
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
        <AppHeader
          title='Connect'
          rightButton={
            <TouchableOpacity style={styles.cameraButton} onPress={() => navigation.navigate("QRScanner")}>
              <Ionicons name='camera' size={20} color='#fff' />
            </TouchableOpacity>
          }
        />
        <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size='large' color='#AF52DE' />
            <Text style={[styles.loadingText, darkMode && styles.darkLoadingText]}>Loading profile...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }



  return (
    <View style={[styles.container, darkMode && styles.darkContainer]}>
      <AppHeader
        title='CONNECT'
        rightButton={
          <TouchableOpacity style={styles.cameraButton} onPress={() => navigation.navigate("Search")}>
            <Ionicons name='camera' size={20} color='#fff' />
          </TouchableOpacity>
        }
      />
      <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

          {/* Logged-in user's own profile card */}
          {myProfileData && (
            <View style={styles.myProfileCard}>
              <MiniCard user={myProfileData} />
            </View>
          )}

          {/* Select Profile Dropdown */}
          <View style={styles.selectProfileRow}>
            <Text style={[styles.selectProfileLabel, darkMode && styles.darkText]}>Select Profile</Text>
            <TouchableOpacity style={styles.selectProfileDropdown} onPress={() => setShowAccountDropdown(!showAccountDropdown)} activeOpacity={0.7}>
              <Text style={styles.selectProfileDropdownText}>
                {selectedAccount === "personal" ? "Personal" : businesses.find((b) => (b.business_uid || b.profile_business_uid) === selectedAccount)?.business_name || "Business"}
              </Text>
            </TouchableOpacity>
          </View>

          {showAccountDropdown && (
            <View style={styles.selectProfileMenu}>
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedAccount("personal");
                  setShowAccountDropdown(false);
                }}
              >
                <Text style={[styles.dropdownItemText, selectedAccount === "personal" && styles.dropdownItemTextActive]}>Personal</Text>
              </TouchableOpacity>
              {businesses.map((business, index) => {
                const businessId = business.business_uid || business.profile_business_uid;
                const businessName = business.business_name || business.profile_business_name || `Business ${index + 1}`;
                return (
                  <TouchableOpacity
                    key={businessId || index}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedAccount(businessId);
                      setShowAccountDropdown(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, selectedAccount === businessId && styles.dropdownItemTextActive]}>{businessName}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Who Viewed My Profile */}
          <View style={styles.viewersContainer}>
            <TouchableOpacity style={styles.viewersSectionHeader} onPress={() => setShowViewers(!showViewers)}>
              <Text style={styles.viewersSectionHeaderText}>
                {selectedAccount === "personal" ? "WHO VIEWED MY PROFILE" : "WHO VIEWED MY BUSINESS"}
              </Text>
              <Ionicons name={showViewers ? "chevron-up" : "chevron-down"} size={20} color='#000' />
            </TouchableOpacity>
            {showViewers && (
              viewersLoading ? (
                <ActivityIndicator size='small' color='#AF52DE' style={{ marginVertical: 12 }} />
              ) : profileViewers.length > 0 ? (
                profileViewers.map((viewer, index) => (
                  <TouchableOpacity
                    key={viewer.view_viewer_id || index}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate("Profile", { profile_uid: viewer.view_viewer_id, returnTo: "Connect" })}
                    style={index > 0 ? { marginTop: 4 } : undefined}
                  >
                    <MiniCard
                      user={{
                        firstName: viewer.viewer_first_name || "",
                        lastName: viewer.viewer_last_name || "",
                        email: viewer.viewer_email || "",
                        phoneNumber: viewer.viewer_phone || "",
                        tagLine: viewer.viewer_tag_line || "",
                        city: viewer.viewer_city || "",
                        state: viewer.viewer_state || "",
                        profileImage: viewer.viewer_image || "",
                        emailIsPublic: viewer.viewer_email_is_public === 1 || viewer.viewer_email_is_public === "1",
                        phoneIsPublic: viewer.viewer_phone_is_public === 1 || viewer.viewer_phone_is_public === "1",
                        tagLineIsPublic: viewer.viewer_tag_line_is_public === 1 || viewer.viewer_tag_line_is_public === "1",
                        imageIsPublic: viewer.viewer_image_is_public === 1 || viewer.viewer_image_is_public === "1",
                        locationIsPublic: viewer.viewer_location_is_public === 1 || viewer.viewer_location_is_public === "1",
                      }}
                    />
                    {viewer.view_timestamp ? (
                      <Text style={styles.viewedTimestamp}>
                        Viewed: {new Date(viewer.view_timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={[styles.noViewersText, darkMode && styles.darkNoViewersText]}>
                  {selectedAccount === "personal" ? "No profile views yet" : "No business profile views yet"}
                </Text>
              )
            )}
          </View>

          {/* Divider before scanned person card (QR scan) */}
          {profileData && <View style={styles.divider} />}

          {/* Scanned person card + web-specific actions (only when arriving via QR) */}
          {profileData && (
            appOpened ? (
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
            )
          )}

        </ScrollView>
        <BottomNavBar navigation={navigation} />
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
    paddingBottom: 120,
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
  cameraButton: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  myProfileCard: {
    marginBottom: 16,
  },
  selectProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 12,
    gap: 16,
  },
  selectProfileLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
    minWidth: 90,
  },
  darkText: {
    color: "#fff",
  },
  selectProfileDropdown: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  selectProfileDropdownText: {
    fontSize: 15,
    color: "#333",
  },
  selectProfileMenu: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 16,
    boxShadow: "0px 2px 4px rgba(0,0,0,0.15)",
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dropdownItemText: {
    fontSize: 15,
    color: "#333",
  },
  dropdownItemTextActive: {
    color: "#AF52DE",
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 20,
  },
  viewersContainer: {
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  viewersSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(175, 82, 222, 0.15)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  viewersSectionHeaderText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  viewedTimestamp: {
    fontSize: 11,
    color: "#999",
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  noViewersText: {
    fontStyle: "italic",
    color: "#666",
    padding: 12,
  },
  darkNoViewersText: {
    color: "#aaa",
  },
});

export default ConnectWebScreen;
