import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Switch, TouchableOpacity, SafeAreaView, ScrollView, Alert, Modal } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import { CommonActions } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import FeedbackPopup from "../components/FeedbackPopup";

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

export default function SettingsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, profile_uid } = route.params || {};
  const [allowNotifications, setAllowNotifications] = useState(true);
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [allowCookies, setAllowCookies] = useState(false);
  const [displayEmail, setDisplayEmail] = useState(true);
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);

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
      if (e !== null) setDisplayEmail(JSON.parse(e));
      if (p !== null) setDisplayPhoneNumber(JSON.parse(p));
    })();
  }, []);
  const [termsModalVisible, setTermsModalVisible] = useState(false);

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
      Alert.alert("Logout", "Are you sure you want to logout?", [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            console.log("SettingsScreen.js - User cancelled logout");
          },
        },
        {
          text: "Logout",
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
          })
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

  return (
    <View style={[styles.container, darkMode && styles.darkContainer]}>
      {/* Header */}
      {/* <AppHeader title="Settings" backgroundColor="#AF52DE" /> */}
      <TouchableOpacity onPress={() => setShowFeedbackPopup(true)} activeOpacity={0.7}>
        <AppHeader title='Settings' {...getHeaderColors("settings")} />
      </TouchableOpacity>

      {/* Settings Options */}
      <SafeAreaView style={[styles.safeArea, darkMode && styles.darkContainer]}>
        <ScrollView contentContainerStyle={styles.settingsContainer}>
          {/* Allow Notifications */}
          <View style={[styles.settingItem, darkMode && styles.darkSettingItem]}>
            <View style={styles.itemLabel}>
              <MaterialIcons name='notifications' size={20} style={styles.icon} color={darkMode ? "#fff" : "#666"} />
              <Text style={[styles.itemText, darkMode && styles.darkItemText]}>Allow notifications</Text>
            </View>
            <Switch value={allowNotifications} onValueChange={setAllowNotifications} trackColor={{ false: "#ccc", true: "#AF52DE" }} thumbColor={allowNotifications ? "#fff" : "#f4f3f4"} />
          </View>

          {/* Dark Mode */}
          <View style={[styles.settingItem, darkMode && styles.darkSettingItem]}>
            <View style={styles.itemLabel}>
              <MaterialIcons name='brightness-2' size={20} style={styles.icon} color={darkMode ? "#fff" : "#666"} />
              <Text style={[styles.itemText, darkMode && styles.darkItemText]}>Dark mode</Text>
            </View>
            <Switch value={darkMode} onValueChange={toggleDarkMode} trackColor={{ false: "#ccc", true: "#AF52DE" }} thumbColor={darkMode ? "#fff" : "#f4f3f4"} />
          </View>

          {/* Allow Cookies */}
          <View style={[styles.settingItem, darkMode && styles.darkSettingItem]}>
            <View style={styles.itemLabel}>
              <MaterialIcons name='cookie' size={20} style={styles.icon} color={darkMode ? "#fff" : "#666"} />
              <Text style={[styles.itemText, darkMode && styles.darkItemText]}>Allow Cookies</Text>
            </View>
            <Switch value={allowCookies} onValueChange={setAllowCookies} trackColor={{ false: "#ccc", true: "#AF52DE" }} thumbColor={allowCookies ? "#fff" : "#f4f3f4"} />
          </View>

          {/* Generate QR Code */}
          <TouchableOpacity style={[styles.settingItem, darkMode && styles.darkSettingItem]} onPress={() => setQrModalVisible(true)}>
            <View style={styles.itemLabel}>
              <MaterialIcons name='qr-code' size={20} style={styles.icon} color={darkMode ? "#fff" : "#666"} />
              <Text style={[styles.itemText, darkMode && styles.darkItemText]}>Generate QR Code</Text>
            </View>
          </TouchableOpacity>

          {/* Privacy Policy */}
          <TouchableOpacity style={[styles.settingItem, darkMode && styles.darkSettingItem]} onPress={() => navigation.navigate("PrivacyPolicy")}>
            <View style={styles.itemLabel}>
              <MaterialIcons name='privacy-tip' size={20} style={styles.icon} color={darkMode ? "#fff" : "#666"} />
              <Text style={[styles.itemText, darkMode && styles.darkItemText]}>Privacy Policy</Text>
            </View>
          </TouchableOpacity>

          {/* Terms and Conditions */}
          <TouchableOpacity style={[styles.settingItem, darkMode && styles.darkSettingItem]} onPress={() => navigation.navigate("TermsAndConditions")}>
            <View style={styles.itemLabel}>
              <MaterialIcons name='description' size={20} style={styles.icon} color={darkMode ? "#fff" : "#666"} />
              <Text style={[styles.itemText, darkMode && styles.darkItemText]}>Terms and Conditions</Text>
            </View>
          </TouchableOpacity>

          {/* Edit User Information */}
          <TouchableOpacity style={[styles.settingItem, darkMode && styles.darkSettingItem]} onPress={() => navigation.navigate("BusinessSetup")}>
            <View style={styles.itemLabel}>
              <MaterialIcons name='business' size={20} style={styles.icon} color={darkMode ? "#fff" : "#666"} />
              <Text style={[styles.itemText, darkMode && styles.darkItemText]}>Add a Business</Text>
            </View>
          </TouchableOpacity>

          {/* Change Password */}
          <TouchableOpacity style={[styles.settingItem, darkMode && styles.darkSettingItem]} onPress={() => navigation.navigate("ChangePassword")}>
            <View style={styles.itemLabel}>
              <MaterialIcons name='lock' size={20} style={styles.icon} color={darkMode ? "#fff" : "#666"} />
              <Text style={[styles.itemText, darkMode && styles.darkItemText]}>Change Password</Text>
            </View>
          </TouchableOpacity>

          {/* Logout Button */}
          <TouchableOpacity style={[styles.logoutButton, darkMode && styles.darkLogoutButton]} onPress={handleLogout}>
            <MaterialIcons name='logout' size={20} style={styles.icon} color={darkMode ? "#fff" : "#FF3B30"} />
            <Text style={[styles.logoutText, darkMode && styles.darkLogoutText]}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      {/* QR Code Modal */}
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

      {/* Bottom Navigation */}
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
    backgroundColor: "#fff",
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
    borderColor: "#FF3B30",
  },
  darkLogoutButton: {
    backgroundColor: "#333",
    borderColor: "#FF3B30",
  },
  logoutText: {
    fontSize: 16,
    color: "#FF3B30",
    marginLeft: 10,
  },
  darkLogoutText: {
    color: "#FF3B30",
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
});
