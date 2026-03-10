import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Switch, TouchableOpacity, SafeAreaView, ScrollView, Alert, Modal } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import { CommonActions } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import FeedbackPopup from "../components/FeedbackPopup";
import HowItWorksScreen from "./HowItWorksScreen";
import MiniCard from "../components/MiniCard";

// Only import GoogleSignin on native platforms (not web)
let GoogleSignin = null;
const isWeb = typeof window !== "undefined" && typeof document !== "undefined";
if (!isWeb) {
  try {
    const googleSigninModule = require("@react-native-google-signin/google-signin");
    GoogleSignin = googleSigninModule.GoogleSignin;
  } catch (e) {
    console.warn("GoogleSignin not available:", e.message);
  }
}

import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import QRCode from "react-native-qrcode-svg";
import { useDarkMode } from "../contexts/DarkModeContext";
import { getHeaderColors } from "../config/headerColors";
import versionData from "../version.json";

export default function SettingsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, profile_uid } = route.params || {};
  const [allowNotifications, setAllowNotifications] = useState(true);
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [allowCookies, setAllowCookies] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [displayEmail, setDisplayEmail] = useState(true);
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [personalProfileData, setPersonalProfileData] = useState(null);
  const [termsWarningVisible, setTermsWarningVisible] = useState(false);
  const [cookiesWarningVisible, setCookiesWarningVisible] = useState(false);

  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);

  const settingsFeedbackInstructions = "Instructions for Settings";

  // Define custom questions for the Account page
  const settingsFeedbackQuestions = ["Settings - Question 1?", "Settings - Question 2?", "Settings - Question 3?"];

  console.log("In SettingsScreen");

  // on mount, pull saved values
  useEffect(() => {
    // console.log('In SettingsScreen');
    (async () => {
      const e = await AsyncStorage.getItem("displayEmail");
      const p = await AsyncStorage.getItem("displayPhone");
      const t = await AsyncStorage.getItem("termsAccepted");
      const c = await AsyncStorage.getItem("allowCookies");
      if (e !== null) setDisplayEmail(JSON.parse(e));
      if (p !== null) setDisplayPhoneNumber(JSON.parse(p));
      if (t !== null) setTermsAccepted(JSON.parse(t));
      if (c !== null) setAllowCookies(JSON.parse(c));
    })();
  }, []);
  const [termsModalVisible, setTermsModalVisible] = useState(false);

  const handleTermsToggle = async (value) => {
    if (!value) {
      // User is trying to turn off terms acceptance - show warning
      setTermsWarningVisible(true);
    } else {
      // User is accepting terms
      setTermsAccepted(true);
      await AsyncStorage.setItem("termsAccepted", JSON.stringify(true));
    }
  };

  const confirmTermsRejection = async () => {
    setTermsAccepted(false);
    await AsyncStorage.setItem("termsAccepted", JSON.stringify(false));
    setTermsWarningVisible(false);
  };

  const cancelTermsRejection = () => {
    setTermsWarningVisible(false);
    // Keep the switch in the "Yes" position
  };

  const handleCookiesToggle = async (value) => {
    if (!value) {
      // User is trying to turn off cookies - show warning
      setCookiesWarningVisible(true);
    } else {
      // User is accepting cookies
      setAllowCookies(true);
      await AsyncStorage.setItem("allowCookies", JSON.stringify(true));
    }
  };

  const confirmCookiesRejection = async () => {
    setAllowCookies(false);
    await AsyncStorage.setItem("allowCookies", JSON.stringify(false));
    setCookiesWarningVisible(false);
  };

  const cancelCookiesRejection = () => {
    setCookiesWarningVisible(false);
    // Keep the switch in the "Yes" position
  };

  const handleLogout = async () => {
    console.log("SettingsScreen.js - Logout Button pressed ==> handleLogout called");
    console.log("SettingsScreen.js - Platform:", isWeb ? "Web" : "Native");

    // On web, use window.confirm() since Alert.alert with multiple buttons doesn't work
    // On native, use Alert.alert with proper buttons
    let userConfirmed = false;

    if (isWeb) {
      console.log("SettingsScreen.js - Web platform: Using window.confirm()");
      userConfirmed = window.confirm("Are you sure you want to logout?");
      console.log("SettingsScreen.js - User confirmed logout:", userConfirmed);
    } else {
      // On native, show Alert with buttons
      Alert.alert("Log Out", "Are you sure you want to log out?", [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            console.log("SettingsScreen.js - User cancelled log out");
          },
        },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            userConfirmed = true;
            await performLogout();
          },
        },
      ]);
      return; // Return early on native, performLogout will be called from Alert callback
    }

    // On web, proceed with logout if confirmed
    if (userConfirmed) {
      await performLogout();
    } else {
      console.log("SettingsScreen.js - User cancelled logout");
    }
  };

  const performLogout = async () => {
    try {
      console.log("SettingsScreen.js - User confirmed logout - starting logout process");

      // Sign out from Google (only on native platforms)
      if (!isWeb && GoogleSignin) {
        console.log("SettingsScreen.js - Attempting Google Sign Out");
        const isSignedIn = await GoogleSignin.isSignedIn();
        if (isSignedIn) {
          await GoogleSignin.signOut();
          console.log("SettingsScreen.js - Google Sign Out successful");
        } else {
          console.log("SettingsScreen.js - User not signed in to Google");
        }
      } else if (isWeb) {
        console.log("SettingsScreen.js - Web platform: Skipping Google Sign Out");
      }

      // Get all keys to clear Apple authentication data
      const allKeys = await AsyncStorage.getAllKeys();
      const appleKeys = allKeys.filter((key) => key.startsWith("apple_"));

      // Clear all stored data - comprehensive cleanup
      const keysToRemove = [
        // User authentication data
        "user_uid",
        "user_email_id",
        "profile_uid",
        "user_id",
        "user_name",

        // User profile data
        "user_email",
        "user_first_name",
        "user_last_name",
        "user_phone_number",

        // Settings
        "displayEmail",
        "displayPhone",
        "darkMode",

        // Business data
        "businessFormData",

        // Cart data (all cart keys)
        ...allKeys.filter((key) => key.startsWith("cart_")),

        // Ratings data
        "user_ratings_info",

        // Apple authentication data
        ...appleKeys,
      ];

      console.log("SettingsScreen.js - Clearing AsyncStorage keys:", keysToRemove);
      console.log("SettingsScreen.js - Total keys to remove:", keysToRemove.length);
      await AsyncStorage.multiRemove(keysToRemove);
      console.log("SettingsScreen.js - AsyncStorage cleared successfully");

      // Reset dark mode to light mode when logging out
      toggleDarkMode(false);
      console.log("SettingsScreen.js - Dark mode reset to light");

      // Navigate to Home screen using CommonActions.reset for reliable navigation
      console.log("SettingsScreen.js - Navigating to Home screen");
      console.log("SettingsScreen.js - Platform:", isWeb ? "Web" : "Native");

      // Use CommonActions.reset() which works reliably on both web and native
      // This ensures the navigation stack is properly cleared
      try {
        console.log("SettingsScreen.js - Using CommonActions.reset() to navigate to Home");

        // On web, no need to wait since we're using window.confirm() which is synchronous
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "Home" }],
          }),
        );
        console.log("SettingsScreen.js - CommonActions.reset() dispatched successfully");
        console.log("SettingsScreen.js - Logout completed successfully");
      } catch (navError) {
        console.error("SettingsScreen.js - Navigation error:", navError);
        console.error("SettingsScreen.js - Navigation error details:", navError.message, navError.stack);

        // Fallback: try direct navigation methods
        try {
          if (isWeb) {
            // On web, try replace or navigate
            if (typeof navigation.replace === "function") {
              navigation.replace("Home");
              console.log("SettingsScreen.js - Fallback: navigation.replace() succeeded");
            } else {
              navigation.navigate("Home");
              console.log("SettingsScreen.js - Fallback: navigation.navigate() succeeded");
            }
          } else {
            // On native, try reset
            navigation.reset({
              index: 0,
              routes: [{ name: "Home" }],
            });
            console.log("SettingsScreen.js - Fallback: navigation.reset() succeeded");
          }
        } catch (fallbackError) {
          console.error("SettingsScreen.js - All navigation methods failed:", fallbackError);
          // Last resort on web: reload the page
          if (isWeb && typeof window !== "undefined") {
            console.log("SettingsScreen.js - Using window.location.href as last resort");
            window.location.href = "/";
          } else {
            Alert.alert("Navigation Error", "Logged out successfully, but navigation failed. Please restart the app.");
          }
        }
      }
    } catch (error) {
      console.error("SettingsScreen.js - Logout error:", error);
      console.error("SettingsScreen.js - Error details:", error.message, error.stack);
      if (isWeb) {
        window.alert("Error: Failed to logout. Please try again.");
      } else {
        Alert.alert("Error", "Failed to logout. Please try again.");
      }
    }
  };

  const handleNavigateProfile = async () => {
    const user_uid = await AsyncStorage.getItem("user_uid");
    if (user_uid) {
      navigation.navigate("Profile", { profile_uid: user_uid });
    } else {
      navigation.navigate("Profile");
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileId = await AsyncStorage.getItem("profile_uid");
        if (!profileId) return;
        const { USER_PROFILE_INFO_ENDPOINT } = require("../apiConfig");
        const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${profileId}`);
        const result = await response.json();
        if (result && result.personal_info) {
          setPersonalProfileData({
            firstName: result.personal_info.profile_personal_first_name || "",
            lastName: result.personal_info.profile_personal_last_name || "",
            email: result.user_email || "",
            phoneNumber: result.personal_info.profile_personal_phone_number || "",
            tagLine: result.personal_info.profile_personal_tag_line || "",
            city: result.personal_info.profile_personal_city || "",
            state: result.personal_info.profile_personal_state || "",
            profileImage: result.personal_info.profile_personal_image || "",
            emailIsPublic: result.personal_info.profile_personal_email_is_public === 1,
            phoneIsPublic: result.personal_info.profile_personal_phone_number_is_public === 1,
            tagLineIsPublic: result.personal_info.profile_personal_tag_line_is_public === 1,
            locationIsPublic: result.personal_info.profile_personal_location_is_public === 1,
            imageIsPublic: result.personal_info.profile_personal_image_is_public === 1,
          });
        }
      } catch (e) {
        console.error("Error fetching profile for settings:", e);
      }
    };
    fetchProfile();
  }, []);

  return (
    <View style={[styles.container, darkMode && styles.darkContainer]}>
      <TouchableOpacity onPress={() => setShowFeedbackPopup(true)} activeOpacity={0.7}>
        <AppHeader title='SETTINGS' {...getHeaderColors("settings")} />
      </TouchableOpacity>

      <SafeAreaView style={[styles.safeArea, darkMode && styles.darkContainer]}>
        <ScrollView contentContainerStyle={styles.settingsContainer}>
          {/* Profile MiniCard at top */}
          {personalProfileData && (
            <View style={{ marginBottom: 16 }}>
              <MiniCard user={personalProfileData} />
            </View>
          )}

          {/* Settings/Toggles Container */}
          <View style={[styles.settingsGroupContainer, darkMode && styles.darkSettingsGroupContainer]}>
            <View style={styles.settingsGroupHeader}>
              <Text style={[styles.settingsGroupHeaderText, darkMode && { color: "#fff" }, { fontStyle: "italic", color: "#000", fontSize: 16 }]}> </Text>
              <Text style={[styles.settingsGroupHeaderText, darkMode && { color: "#fff" }, { fontStyle: "italic", color: "#000", fontSize: 16, textAlign: "right" }]}>Selection</Text>
            </View>

            {/* Allow Cookies */}
            <View style={[styles.settingItem, darkMode && styles.darkSettingItem]}>
              <View style={styles.itemLabel}>
                <MaterialIcons name='cookie' size={20} style={styles.icon} color={darkMode ? "#fff" : "#666"} />
                <Text style={[styles.itemText, darkMode && styles.darkItemText]}>
                  <Text style={{ fontWeight: "bold", color: darkMode ? "#fff" : "#000" }}>Allow Cookies </Text>
                  <Text style={{ color: darkMode ? "#fff" : "#000" }}>Yes / No</Text>
                </Text>
              </View>
              <Switch value={allowCookies} onValueChange={handleCookiesToggle} trackColor={{ false: "#ccc", true: "#000" }} thumbColor={allowCookies ? "#fff" : "#f4f3f4"} />
            </View>

            {/* Terms and Conditions */}
            <View style={[styles.settingItem, darkMode && styles.darkSettingItem]}>
              <TouchableOpacity style={styles.itemLabel} onPress={() => navigation.navigate("TermsAndConditions")} activeOpacity={0.7}>
                <MaterialIcons name='description' size={20} style={styles.icon} color={darkMode ? "#fff" : "#666"} />
                <Text style={[styles.itemText, darkMode && styles.darkItemText]}>
                  <Text style={{ fontWeight: "bold", color: darkMode ? "#fff" : "#000" }}>Terms and Conditions </Text>
                  <Text style={{ color: darkMode ? "#fff" : "#000" }}>Disagree / Agreed (Required)</Text>
                </Text>
              </TouchableOpacity>
              <Switch value={termsAccepted} onValueChange={handleTermsToggle} trackColor={{ false: "#ccc", true: "#000" }} thumbColor={termsAccepted ? "#fff" : "#f4f3f4"} />
            </View>

            {/* Dark Mode */}
            <View style={[styles.settingItem, darkMode && styles.darkSettingItem]}>
              <View style={styles.itemLabel}>
                <MaterialIcons name='brightness-2' size={20} style={styles.icon} color={darkMode ? "#fff" : "#666"} />
                <Text style={[styles.itemText, darkMode && styles.darkItemText]}>
                  <Text style={{ fontWeight: "bold", color: darkMode ? "#fff" : "#000" }}>Background </Text>
                  <Text style={{ color: darkMode ? "#fff" : "#000" }}>Light / Dark</Text>
                </Text>
              </View>
              <Switch value={darkMode} onValueChange={toggleDarkMode} trackColor={{ false: "#ccc", true: "#000" }} thumbColor={darkMode ? "#fff" : "#f4f3f4"} />
            </View>

            {/* Allow Notifications */}
            <View style={[styles.settingItem, darkMode && styles.darkSettingItem]}>
              <View style={styles.itemLabel}>
                <MaterialIcons name='notifications' size={20} style={styles.icon} color={darkMode ? "#fff" : "#666"} />
                <Text style={[styles.itemText, darkMode && styles.darkItemText]}>
                  <Text style={{ fontWeight: "bold", color: darkMode ? "#fff" : "#000" }}>Allow Notifications </Text>
                  <Text style={{ color: darkMode ? "#fff" : "#000" }}>No / Yes</Text>
                </Text>
              </View>
              <Switch value={allowNotifications} onValueChange={setAllowNotifications} trackColor={{ false: "#ccc", true: "#000" }} thumbColor={allowNotifications ? "#fff" : "#f4f3f4"} />
            </View>
          </View>

          {/* Information & Links Container */}
          <View style={[styles.settingsGroupContainer, darkMode && styles.darkSettingsGroupContainer, { marginBottom: 16 }]}>
            <View style={styles.settingsGroupHeader}>
              <Text style={[styles.settingsGroupHeaderText, darkMode && { color: "#fff" }, { fontStyle: "italic", color: "#000", fontSize: 16 }]}>Information</Text>
            </View>

            {/* Terms and Conditions */}
            <TouchableOpacity style={[styles.settingItem, darkMode && styles.darkSettingItem]} onPress={() => navigation.navigate("TermsAndConditions")}>
              <View style={styles.itemLabel}>
                <MaterialIcons name='description' size={20} style={styles.icon} color={darkMode ? "#fff" : "#666"} />
                <Text style={[styles.itemText, darkMode && styles.darkItemText]}>Terms and Conditions</Text>
              </View>
              <MaterialIcons name='chevron-right' size={24} color={darkMode ? "#fff" : "#666"} />
            </TouchableOpacity>

            {/* Privacy Policy */}
            <TouchableOpacity style={[styles.settingItem, darkMode && styles.darkSettingItem]} onPress={() => navigation.navigate("PrivacyPolicy")}>
              <View style={styles.itemLabel}>
                <MaterialIcons name='privacy-tip' size={20} style={styles.icon} color={darkMode ? "#fff" : "#666"} />
                <Text style={[styles.itemText, darkMode && styles.darkItemText]}>Privacy Policy</Text>
              </View>
              <MaterialIcons name='chevron-right' size={24} color={darkMode ? "#fff" : "#666"} />
            </TouchableOpacity>

            {/* Change Password */}
            <TouchableOpacity style={[styles.settingItem, darkMode && styles.darkSettingItem]} onPress={() => navigation.navigate("ChangePassword")}>
              <View style={styles.itemLabel}>
                <MaterialIcons name='lock' size={20} style={styles.icon} color={darkMode ? "#fff" : "#666"} />
                <Text style={[styles.itemText, darkMode && styles.darkItemText]}>Change Password</Text>
              </View>
              <MaterialIcons name='chevron-right' size={24} color={darkMode ? "#fff" : "#666"} />
            </TouchableOpacity>

            {/* How It Works */}
            <TouchableOpacity style={[styles.settingItem, darkMode && styles.darkSettingItem]} onPress={() => navigation.navigate("HowItWorksScreen")}>
              <View style={styles.itemLabel}>
                <MaterialIcons name='help-outline' size={20} style={styles.icon} color={darkMode ? "#fff" : "#666"} />
                <Text style={[styles.itemText, darkMode && styles.darkItemText]}>How It Works</Text>
              </View>
              <MaterialIcons name='chevron-right' size={24} color={darkMode ? "#fff" : "#666"} />
            </TouchableOpacity>
          </View>

          {/* Logout Button OUTSIDE container */}
          <TouchableOpacity style={[styles.logoutButton, darkMode && styles.darkLogoutButton]} onPress={handleLogout}>
            <MaterialIcons name='logout' size={20} style={styles.icon} color={darkMode ? "#fff" : "#AF52DE"} />
            <Text style={[styles.logoutText, darkMode && styles.darkLogoutText]}>Log out</Text>
          </TouchableOpacity>

          {/* Build Info */}
          <View style={styles.buildInfoContainer}>
            <Text style={[styles.dateTimeText, darkMode && styles.darkDateTimeText]}>
              PM {versionData.pm_version} Version {versionData.major}.{versionData.build} - Last Change: {versionData.last_change}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Modals unchanged */}
      <Modal visible={qrModalVisible} transparent={true} animationType='fade'>
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalBox}>
            <Text style={styles.qrModalTitle}>QR Code</Text>
            <Text style={styles.qrModalSubtitle}>Scan to visit Infinite Options</Text>
            <View style={styles.qrCodeContainer}>
              <QRCode value='https://infiniteoptions.com/' size={200} color='#000' backgroundColor='#fff' />
            </View>
            <TouchableOpacity onPress={() => setQrModalVisible(false)} style={styles.closeModalButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={termsModalVisible} transparent={true} animationType='fade'>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalText}></Text>
            <TouchableOpacity onPress={() => setTermsModalVisible(false)} style={styles.closeModalButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Terms Warning Modal */}
      <Modal visible={termsWarningVisible} transparent={true} animationType='fade'>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, darkMode && styles.darkModalBox]}>
            <MaterialIcons name='warning' size={48} color='#FF6B6B' style={{ marginBottom: 15 }} />
            <Text style={[styles.warningTitle, darkMode && styles.darkWarningTitle]}>Terms & Conditions Required</Text>
            <Text style={[styles.warningText, darkMode && styles.darkWarningText]}>If you do not agree to the Terms and Conditions, you will only have access to Login and Settings screens.</Text>
            <View style={styles.warningButtonContainer}>
              <TouchableOpacity onPress={cancelTermsRejection} style={[styles.warningButton, styles.cancelButton]}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmTermsRejection} style={[styles.warningButton, styles.confirmButton]}>
                <Text style={styles.confirmButtonText}>I Understand</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cookies Warning Modal */}
      <Modal visible={cookiesWarningVisible} transparent={true} animationType='fade'>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, darkMode && styles.darkModalBox]}>
            <MaterialIcons name='warning' size={48} color='#FF6B6B' style={{ marginBottom: 15 }} />
            <Text style={[styles.warningTitle, darkMode && styles.darkWarningTitle]}>Cookies Required</Text>
            <Text style={[styles.warningText, darkMode && styles.darkWarningText]}>If you do not allow cookies, you will only have access to the Settings screen.</Text>
            <View style={styles.warningButtonContainer}>
              <TouchableOpacity onPress={cancelCookiesRejection} style={[styles.warningButton, styles.cancelButton]}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmCookiesRejection} style={[styles.warningButton, styles.confirmButton]}>
                <Text style={styles.confirmButtonText}>I Understand</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNavBar navigation={navigation} />
      <FeedbackPopup visible={showFeedbackPopup} onClose={() => setShowFeedbackPopup(false)} pageName='Settings' instructions={settingsFeedbackInstructions} questions={settingsFeedbackQuestions} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    backgroundColor: "#fff",
  },
  safeArea: {
    flex: 1,
  },
  darkContainer: {
    backgroundColor: "#1a1a1a",
  },
  settingsContainer: {
    padding: 15,
    paddingBottom: 80,
  },
  settingItem: {
    // backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  darkSettingItem: {
    backgroundColor: "#333",
  },
  itemLabel: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    marginRight: 10,
  },
  itemText: {
    fontSize: 16,
    color: "#333",
  },
  darkItemText: {
    color: "#fff",
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: "#fff", padding: 20, borderRadius: 10, alignItems: "center" },
  modalText: { fontSize: 18, fontWeight: "bold" },
  closeModalButton: { marginTop: 15, backgroundColor: "#AF52DE", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  closeButtonText: { color: "#fff", fontWeight: "bold" },
  logoutButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginTop: 20,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#AF52DE",
  },
  darkLogoutButton: {
    backgroundColor: "#333",
    borderColor: "#AF52DE",
  },
  logoutText: {
    fontSize: 16,
    color: "#AF52DE",
    marginLeft: 10,
  },
  darkLogoutText: {
    color: "#AF52DE",
  },
  qrModalBox: {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 15,
    alignItems: "center",
    minWidth: 300,
  },
  qrModalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  qrModalSubtitle: {
    fontSize: 16,
    marginBottom: 25,
    color: "#666",
    textAlign: "center",
  },
  qrCodeContainer: {
    marginBottom: 25,
    padding: 15,
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
  },
  buildInfoContainer: {
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  dateTimeText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  darkDateTimeText: {
    color: "#999",
  },
  settingsGroupContainer: {
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 10,
    backgroundColor: "#F5F5F5",
    // backgroundColor: "rgba(225, 211, 237, 0.9)",
    marginBottom: 16,
    overflow: "hidden",
  },
  darkSettingsGroupContainer: {
    backgroundColor: "#2d2d2d",
    borderColor: "#444",
  },
  settingsGroupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    backgroundColor: "#f0f0f0",
  },
  settingsGroupHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
  },
  darkModalBox: {
    backgroundColor: "#333",
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    textAlign: "center",
  },
  darkWarningTitle: {
    color: "#fff",
  },
  warningText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  darkWarningText: {
    color: "#ccc",
  },
  warningButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 10,
  },
  warningButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#ccc",
  },
  cancelButtonText: {
    color: "#333",
    fontWeight: "bold",
    fontSize: 16,
  },
  confirmButton: {
    backgroundColor: "#FF6B6B",
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
