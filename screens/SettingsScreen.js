import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Switch, TouchableOpacity, SafeAreaView, ScrollView, Alert, Modal, ActivityIndicator, Image, FlatList, Platform } from "react-native";
import * as Location from "expo-location";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import { CommonActions } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import FeedbackPopup from "../components/FeedbackPopup";
import HowItWorksScreen from "./HowItWorksScreen";
import MiniCard from "../components/MiniCard";
import NearbyAlertBanner from "../components/NearbyAlertBanner";
import Constants from "expo-constants";
import { EXPO_PUBLIC_ABLY_API_KEY } from "@env";

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

// Color constants for Settings screen
const COLORS = {
  // Primary colors
  primary: "#4B2E83", // Settings header purple
  primaryTransparent: "rgba(75, 46, 131, 0.5)", // 50% opacity purple for switch track
  
  // Light mode colors
  lightBackground: "#fff",
  lightText: "#000",
  lightSecondaryText: "#333",
  lightTertiaryText: "#555",
  lightQuaternaryText: "#666",
  lightIconColor: "#666",
  lightBorderColor: "#000",
  lightBorderColorLight: "#ddd",
  lightGroupBackground: "#F5F5F5",
  lightGroupHeaderBackground: "#f0f0f0",
  lightModalBackground: "#fff",
  lightQrBackground: "#f8f8f8",
  
  // Dark mode colors
  darkBackground: "#1a1a1a",
  darkItemBackground: "#333",
  darkText: "#fff",
  darkSecondaryText: "#ccc",
  darkTertiaryText: "#999",
  darkGroupBackground: "#2d2d2d",
  darkBorderColor: "#444",
  darkModalBackground: "#333",
  
  // Switch colors
  switchTrackInactive: "#ccc",
  switchThumbInactive: "#f4f3f4",
  switchThumbActive: "#4B2E83", // Explicit active thumb color
  switchTrackActive: "rgba(75, 46, 131, 0.5)", // Explicit active track color
  
  // Warning/Alert colors
  warningRed: "#FF6B6B",
  
  // Modal overlay
  modalOverlay: "rgba(0,0,0,0.4)",
  
  // Cancel button
  cancelButtonBackground: "#ccc",
};

// --- Nearby POC: configurable constants (mirror the backend values) ---
const LOCATION_EXPIRY_HOURS = 1; // how long a manually-set location stays fresh

// AsyncStorage key for ignored nearby UIDs (cleared when the sharing session ends)
const NEARBY_IGNORED_KEY = "nearby_ignored_uids";

// AsyncStorage key for share / receive notification preferences
const NEARBY_SETTINGS_KEY = "nearby_share_settings";

// Default settings — mirrors the backend's default behaviour (all_circles for both)
const DEFAULT_NEARBY_SETTINGS = {
  shareWith:         "all_circles",  // 'everyone' | 'all_circles' | 'specific'
  shareWithTypes:    { friends: true, colleagues: true, family: true },
  receiveFrom:       "all_circles",  // 'everyone' | 'all_circles' | 'specific'
  receiveFromTypes:  { friends: true, colleagues: true, family: true },
  // TODO: Persist these settings to the DB so they can be enforced server-side
  //       and survive across devices/sessions without relying on AsyncStorage alone.
};

// --- Live location sharing constants ---
const SHARE_LOCATION_DURATION_HOURS  = 1;  // how long a sharing session lasts
const SHARE_LOCATION_DISTANCE_METERS = 50; // min movement before watcher fires a callback
const SHARE_LOCATION_MIN_PATCH_MINS  = 2;  // min gap between DB writes (throttle)

const DUMMY_LOCATIONS = [
  { name: "Dummy A — Salesforce Park, SF", lat: 37.7893, lng: -122.3966 },
  { name: "Dummy B — Ferry Building, SF",  lat: 37.7956, lng: -122.3935 }, // ~0.48 mi from A ✓
  { name: "Dummy C — Golden Gate Park, SF",lat: 37.7694, lng: -122.4862 }, // ~5.1 mi from A ✗
];

export default function SettingsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, profile_uid } = route.params || {};
  const [allowNotifications, setAllowNotifications] = useState(true);
  const [shareLocationActive, setShareLocationActive] = useState(false);
  const [shareLocationUntil, setShareLocationUntil]   = useState(null); // Date | null
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [allowCookies, setAllowCookies] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [displayEmail, setDisplayEmail] = useState(true);
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [personalProfileData, setPersonalProfileData] = useState(null);
  const [termsWarningVisible, setTermsWarningVisible] = useState(false);
  const [cookiesWarningVisible, setCookiesWarningVisible] = useState(false);
  const [showInformation, setShowInformation] = useState(true);
  const [showSettings, setShowSettings] = useState(true);

  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);

  // Nearby POC state
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [locationUpdating, setLocationUpdating] = useState(null); // key of option being saved
  const [storedCoords, setStoredCoords] = useState({ lat: null, lng: null, updatedAt: null });
  const [nearbyResultsVisible, setNearbyResultsVisible] = useState(false);
  const [nearbyPrivacyModalVisible, setNearbyPrivacyModalVisible] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [nearbyError, setNearbyError] = useState(null);

  // Live location sharing refs (stable across renders — no state needed)
  const locationWatcherRef = useRef(null); // expo-location subscription
  const autoOffTimerRef    = useRef(null); // setTimeout handle for 1-hour auto-off
  const lastPatchedAtRef   = useRef(0);    // ms timestamp of last successful PATCH

  // Ably nearby-alert subscription (live while sharing is active)
  const ablyClientRef      = useRef(null);
  const ablyChannelRef     = useRef(null);
  const notifiedUidsRef    = useRef(new Set()); // UIDs already alerted this session

  // Ignored nearby UIDs — persisted in AsyncStorage for the duration of the sharing session
  const ignoredNearbyRef   = useRef(new Set()); // ref for use inside callbacks
  const [ignoredNearbyUids, setIgnoredNearbyUids] = useState(new Set()); // state for reactive rendering

  // Nearby share / receive settings — ref for callbacks, state for rendering
  const nearbySettingsRef = useRef(DEFAULT_NEARBY_SETTINGS);
  const [nearbySettings, setNearbySettings] = useState(DEFAULT_NEARBY_SETTINGS);

  // In-app nearby banner
  const [nearbyAlert, setNearbyAlert] = useState(null); // { sender_uid, sender_name, sender_image, distance_miles }

  const settingsFeedbackInstructions = "Instructions for Settings";

  // Define custom questions for the Account page
  const settingsFeedbackQuestions = ["Settings - Question 1?", "Settings - Question 2?", "Settings - Question 3?"];

  console.log("In SettingsScreen");

  // on mount, pull saved values
  useEffect(() => {
    (async () => {
      const e = await AsyncStorage.getItem("displayEmail");
      const p = await AsyncStorage.getItem("displayPhone");
      const t = await AsyncStorage.getItem("termsAccepted");
      const c = await AsyncStorage.getItem("allowCookies");
      if (e !== null) setDisplayEmail(JSON.parse(e));
      if (p !== null) setDisplayPhoneNumber(JSON.parse(p));
      if (t !== null) setTermsAccepted(JSON.parse(t));
      if (c !== null) setAllowCookies(JSON.parse(c));

      // Restore ignored nearby UIDs (survives page refresh within a session)
      try {
        const storedIgnored = await AsyncStorage.getItem(NEARBY_IGNORED_KEY);
        if (storedIgnored) {
          const uids = JSON.parse(storedIgnored);
          const s = new Set(uids);
          ignoredNearbyRef.current = s;
          setIgnoredNearbyUids(new Set(s));
        }
      } catch (_) {}

      // Restore nearby share / receive settings
      try {
        const storedSettings = await AsyncStorage.getItem(NEARBY_SETTINGS_KEY);
        if (storedSettings) {
          const parsed = JSON.parse(storedSettings);
          nearbySettingsRef.current = parsed;
          setNearbySettings(parsed);
        }
      } catch (_) {}

      // Restore live location session if still within its window
      const storedUntil = await AsyncStorage.getItem("shareLiveLocationUntil");
      if (storedUntil) {
        const expiresAt = parseInt(storedUntil, 10);
        if (expiresAt > Date.now()) {
          setShareLocationActive(true);
          setShareLocationUntil(new Date(expiresAt));
          const restoredProfileId = await AsyncStorage.getItem("profile_uid");
          if (restoredProfileId) subscribeAblyNearby(restoredProfileId);
          startWatcher(expiresAt);
        } else {
          await AsyncStorage.removeItem("shareLiveLocationUntil");
        }
      }
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

        // Live location session
        "shareLiveLocationUntil",
        // Auto-cleanup of ignore list disabled — uncomment to clear on logout
        // NEARBY_IGNORED_KEY,

        // Apple authentication data
        ...appleKeys,

      ];

      console.log("SettingsScreen.js - Clearing AsyncStorage keys:", keysToRemove);
      console.log("SettingsScreen.js - Total keys to remove:", keysToRemove.length);
      await AsyncStorage.multiRemove(keysToRemove);
      console.log("SettingsScreen.js - AsyncStorage cleared successfully");

      // Reset dark mode to light mode when logging out
      toggleDarkMode(false);
      stopLiveLocationSharing();
      setStoredCoords({ lat: null, lng: null, updatedAt: null });
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
          // Load persisted nearby coords from DB
          const nearbyLat = result.personal_info.profile_personal_nearby_lat;
          const nearbyLng = result.personal_info.profile_personal_nearby_lng;
          const nearbyAt  = result.personal_info.profile_personal_nearby_updated_at;
          if (nearbyLat != null && nearbyLng != null) {
            setStoredCoords({ lat: nearbyLat, lng: nearbyLng, updatedAt: nearbyAt });
          }
        }
      } catch (e) {
        console.error("Error fetching profile for settings:", e);
      }
    };
    fetchProfile();
  }, []);

  // --- Live location sharing ---

  // Cleanup watcher + timer when component unmounts
  useEffect(() => {
    return () => {
      if (locationWatcherRef.current) locationWatcherRef.current.remove();
      if (autoOffTimerRef.current)    clearTimeout(autoOffTimerRef.current);
    };
  }, []);

  // Shared PATCH helper used by both manual picker and live watcher
  const patchNearbyLocation = async (profileId, lat, lng, liveSharing = false) => {
    const { NEARBY_LOCATION_ENDPOINT } = require("../apiConfig");
    const settings = nearbySettingsRef.current;
    try {
      const response = await fetch(NEARBY_LOCATION_ENDPOINT, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_uid:         profileId,
          lat,
          lng,
          live_sharing:        liveSharing,
          share_with:          settings.shareWith,
          share_with_types:    Object.keys(settings.shareWithTypes).filter(k => settings.shareWithTypes[k]),
          receive_from:        settings.receiveFrom,
          receive_from_types:  Object.keys(settings.receiveFromTypes).filter(k => settings.receiveFromTypes[k]),
        }),
      });
      const result = await response.json();
      if (result.code === 200) {
        lastPatchedAtRef.current = Date.now();
        setStoredCoords({ lat, lng, updatedAt: result.updated_at || null });
        return true;
      }
    } catch (err) {
      console.error("patchNearbyLocation error:", err);
    }
    return false;
  };

  // Subscribe to the user's personal Ably channel to receive nearby-alert messages
  const subscribeAblyNearby = async (profileId) => {
    try {
      let Ably;
      if (Platform.OS === "web" && typeof window !== "undefined" && window.Ably) {
        Ably = window.Ably;
      } else {
        Ably = require("ably");
      }
      const ablyApiKey = Constants.expoConfig?.extra?.ablyApiKey || process.env.EXPO_PUBLIC_ABLY_API_KEY || EXPO_PUBLIC_ABLY_API_KEY || "";
      if (!ablyApiKey) { console.warn("Ably API key missing — nearby alerts disabled"); return; }

      const client  = new Ably.Realtime({ key: ablyApiKey });
      const channel = client.channels.get(`/${profileId}`);

      channel.subscribe("nearby-alert", (msg) => {
        const data = msg.data || {};
        const uid  = data.sender_uid;

        // Skip if already notified or explicitly ignored this session
        if (!uid || notifiedUidsRef.current.has(uid) || ignoredNearbyRef.current.has(uid)) return;

        // Secondary client-side receiveFrom filter (Option A: backend sends broadly,
        // frontend drops messages that don't match the user's preference).
        // TODO: Once preferences are stored in the DB, move this filter server-side
        //       so notifications are never sent to uninterested recipients.
        const settings = nearbySettingsRef.current;
        if (settings.receiveFrom !== "everyone") {
          const inCircles = data.recipient_in_circles;
          const rel       = data.recipient_relationship;
          if (!inCircles) return; // sender is not in my circles at all
          if (settings.receiveFrom === "specific") {
            const activeTypes = Object.keys(settings.receiveFromTypes).filter(k => settings.receiveFromTypes[k]);
            const DB_TYPE_MAP = { friends: "friend", colleagues: "colleague", family: "family" };
            const dbTypes = activeTypes.map(t => DB_TYPE_MAP[t] || t);
            if (!rel || !dbTypes.includes(rel)) return;
          }
        }

        notifiedUidsRef.current.add(uid);
        setNearbyAlert({
          sender_uid:     uid,
          sender_name:    data.sender_name    || "Someone",
          sender_image:   data.sender_image   || null,
          distance_miles: data.distance_miles ?? "?",
        });
      });

      ablyClientRef.current  = client;
      ablyChannelRef.current = channel;
      console.log("✅ SettingsScreen - Ably nearby-alert subscription active");
    } catch (e) {
      console.warn("SettingsScreen - Ably subscribe failed:", e.message);
    }
  };

  // Unsubscribe and clean up Ably connection
  const unsubscribeAblyNearby = () => {
    try {
      if (ablyChannelRef.current) {
        ablyChannelRef.current.unsubscribe();
        ablyChannelRef.current = null;
      }
      if (ablyClientRef.current) {
        ablyClientRef.current.close();
        ablyClientRef.current = null;
      }
      notifiedUidsRef.current = new Set();
    } catch (e) {
      console.warn("SettingsScreen - Ably unsubscribe error:", e.message);
    }
  };

  // Add a UID to the ignore list
  const ignoreNearbyUser = async (uid) => {
    if (!uid) return;
    const next = new Set(ignoredNearbyRef.current);
    next.add(uid);
    ignoredNearbyRef.current = next;
    setIgnoredNearbyUids(new Set(next));
    try {
      await AsyncStorage.setItem(NEARBY_IGNORED_KEY, JSON.stringify([...next]));
    } catch (_) {}
  };

  // Remove a UID from the ignore list
  const unignoreNearbyUser = async (uid) => {
    if (!uid) return;
    const next = new Set(ignoredNearbyRef.current);
    next.delete(uid);
    ignoredNearbyRef.current = next;
    setIgnoredNearbyUids(new Set(next));
    try {
      await AsyncStorage.setItem(NEARBY_IGNORED_KEY, JSON.stringify([...next]));
    } catch (_) {}
  };

  // Persist updated nearby share/receive settings
  const updateNearbySettings = async (newSettings) => {
    nearbySettingsRef.current = newSettings;
    setNearbySettings(newSettings);
    try {
      await AsyncStorage.setItem(NEARBY_SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (_) {}
  };

  // Stop live sharing (manual off, auto-off, or logout)
  const stopLiveLocationSharing = async () => {
    if (locationWatcherRef.current) {
      try { locationWatcherRef.current.remove(); } catch (_) {}
      locationWatcherRef.current = null;
    }
    if (autoOffTimerRef.current) {
      clearTimeout(autoOffTimerRef.current);
      autoOffTimerRef.current = null;
    }
    unsubscribeAblyNearby();
    await AsyncStorage.removeItem("shareLiveLocationUntil");
    // Auto-cleanup of ignore list disabled — ignored users persist across sessions
    // await AsyncStorage.removeItem(NEARBY_IGNORED_KEY);
    // ignoredNearbyRef.current = new Set();
    // setIgnoredNearbyUids(new Set());
    setShareLocationActive(false);
    setShareLocationUntil(null);
    setNearbyAlert(null);
  };

  // Start the expo-location watcher (used by both fresh start and mount restore)
  const startWatcher = async (expiresAt) => {
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: SHARE_LOCATION_DISTANCE_METERS,
      },
      async (loc) => {
        const now = Date.now();
        // Check if session has expired (read AsyncStorage to avoid stale closure)
        const storedUntil = await AsyncStorage.getItem("shareLiveLocationUntil");
        if (!storedUntil || now > parseInt(storedUntil, 10)) {
          stopLiveLocationSharing();
          return;
        }
        // Throttle: skip if last patch was too recent
        if (now - lastPatchedAtRef.current < SHARE_LOCATION_MIN_PATCH_MINS * 60 * 1000) return;
        const profileId = await AsyncStorage.getItem("profile_uid");
        if (profileId) {
          await patchNearbyLocation(profileId, loc.coords.latitude, loc.coords.longitude, true);
        }
      }
    );
    locationWatcherRef.current = sub;

    // Schedule auto-off at the exact expiry time
    const timeLeft = expiresAt - Date.now();
    if (timeLeft > 0) {
      autoOffTimerRef.current = setTimeout(stopLiveLocationSharing, timeLeft);
    }
  };

  // Toggle ON handler — requests permission, sets expiry, patches immediately, starts watcher
  const startLiveLocationSharing = async () => {
    // Request permission (native only; web uses navigator.geolocation which needs no explicit request)
    if (!isWeb) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required to share live location.");
        return;
      }
    } else if (!navigator.geolocation) {
      Alert.alert("Unavailable", "Geolocation is not supported in this browser.");
      return;
    }

    const profileId = await AsyncStorage.getItem("profile_uid");
    if (!profileId) { Alert.alert("Error", "No profile found. Please log in again."); return; }

    const expiresAt = Date.now() + SHARE_LOCATION_DURATION_HOURS * 60 * 60 * 1000;
    await AsyncStorage.setItem("shareLiveLocationUntil", String(expiresAt));
    setShareLocationActive(true);
    setShareLocationUntil(new Date(expiresAt));

    // Subscribe to Ably to receive nearby-alert messages
    await subscribeAblyNearby(profileId);

    // Patch the current position immediately so nearby users see you right away
    try {
      let lat, lng;
      if (isWeb) {
        await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(
            (pos) => { lat = pos.coords.latitude; lng = pos.coords.longitude; resolve(); },
            reject,
            { timeout: 10000 }
          )
        );
      } else {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
      await patchNearbyLocation(profileId, lat, lng, true);
    } catch (e) {
      console.error("Initial position fetch failed:", e);
    }

    await startWatcher(expiresAt);
  };

  // --- Nearby POC handlers ---

  const updateLocation = async (option) => {
    const profileId = await AsyncStorage.getItem("profile_uid");
    if (!profileId) {
      Alert.alert("Error", "No profile found. Please log in again.");
      return;
    }

    setLocationUpdating(option.name);
    try {
      let lat, lng;

      if (option.name === "Live GPS") {
        if (isWeb) {
          await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => { lat = pos.coords.latitude; lng = pos.coords.longitude; resolve(); },
              (err) => reject(err),
              { timeout: 10000 }
            );
          });
        } else {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Permission Denied", "Location permission is required to use Live GPS.");
            setLocationUpdating(null);
            return;
          }
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      } else {
        lat = option.lat;
        lng = option.lng;
      }

      const success = await patchNearbyLocation(profileId, lat, lng, true);
      if (success) {
        setLocationPickerVisible(false);
      } else {
        Alert.alert("Error", "Failed to update location.");
      }
    } catch (err) {
      console.error("updateLocation error:", err);
      Alert.alert("Error", "Could not update location. Please try again.");
    } finally {
      setLocationUpdating(null);
    }
  };

  const fetchNearbyUsers = async () => {
    const { NEARBY_USERS_ENDPOINT } = require("../apiConfig");
    const profileId = await AsyncStorage.getItem("profile_uid");
    if (!profileId) {
      Alert.alert("Error", "No profile found. Please log in again.");
      return;
    }

    const settings = nearbySettingsRef.current;
    let nearbyUrl = `${NEARBY_USERS_ENDPOINT}/${profileId}?mode=${settings.receiveFrom}`;
    if (settings.receiveFrom === "specific") {
      const types = Object.keys(settings.receiveFromTypes).filter(k => settings.receiveFromTypes[k]);
      if (types.length > 0) nearbyUrl += `&types=${types.join(",")}`;
    }

    setNearbyLoading(true);
    setNearbyError(null);
    setNearbyUsers([]);
    setNearbyResultsVisible(true);

    try {
      const response = await fetch(nearbyUrl);
      const result = await response.json();

      if (result.code === 200) {
        setNearbyUsers(result.result || []);
      } else if (result.code === 410) {
        setNearbyError(`Your location has expired (>${LOCATION_EXPIRY_HOURS}h old). Tap "Update My Location" to refresh.`);
      } else {
        setNearbyError(result.message || "Could not fetch nearby users.");
      }
    } catch (err) {
      console.error("fetchNearbyUsers error:", err);
      setNearbyError("Network error. Please try again.");
    } finally {
      setNearbyLoading(false);
    }
  };

  return (
    <View style={[styles.container, darkMode && styles.darkContainer]}>
      {/* Nearby alert banner — floats above everything */}
      <NearbyAlertBanner
        alert={nearbyAlert}
        onDismiss={() => setNearbyAlert(null)}
        onPress={(senderUid) => {
          setNearbyAlert(null);
          navigation.navigate("Profile", { profile_uid: senderUid });
        }}
        onChat={(senderUid, senderName) => {
          setNearbyAlert(null);
          navigation.navigate("Chat", {
            other_uid: senderUid,
            other_name: senderName || "Chat",
          });
        }}
        onIgnore={(senderUid) => {
          setNearbyAlert(null);
          ignoreNearbyUser(senderUid);
        }}
      />

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

          {/* SETTINGS Section Header - Outside Box */}
          <TouchableOpacity style={styles.settingsSectionHeader} onPress={() => setShowSettings(!showSettings)}>
            <Text style={styles.settingsSectionHeaderText}>SETTINGS</Text>
            <Ionicons name={showSettings ? "chevron-up" : "chevron-down"} size={20} color={darkMode ? COLORS.darkText : COLORS.lightText} />
          </TouchableOpacity>

          {/* Settings/Toggles Container */}
          {showSettings && (
            <View style={[styles.settingsGroupContainer, darkMode && styles.darkSettingsGroupContainer]}>
              {/* Allow Cookies */}
            <View style={[styles.settingItem, darkMode && styles.darkSettingItem]}>
              <View style={styles.itemLabel}>
                <MaterialIcons name='cookie' size={20} style={styles.icon} color={darkMode ? COLORS.darkText : COLORS.lightIconColor} />
                <Text style={[styles.itemText, darkMode && styles.darkItemText]}>
                  <Text style={{ fontWeight: "bold", color: darkMode ? COLORS.darkText : COLORS.lightText }}>Allow Cookies </Text>
                  <Text style={{ color: darkMode ? COLORS.darkText : COLORS.lightText }}>No / Yes</Text>
                </Text>
              </View>
              <Switch 
                value={allowCookies} 
                onValueChange={handleCookiesToggle} 
                trackColor={{ false: COLORS.switchTrackInactive, true: COLORS.switchTrackActive }} 
                thumbColor={allowCookies ? COLORS.switchThumbActive : COLORS.switchThumbInactive}
                ios_backgroundColor={COLORS.switchTrackInactive}
                activeThumbColor={COLORS.switchThumbActive}
                activeTrackColor={COLORS.switchTrackActive}
              />
            </View>

            {/* Terms and Conditions */}
            <View style={[styles.settingItem, darkMode && styles.darkSettingItem]}>
              <TouchableOpacity style={styles.itemLabel} onPress={() => navigation.navigate("TermsAndConditions")} activeOpacity={0.7}>
                <MaterialIcons name='description' size={20} style={styles.icon} color={darkMode ? COLORS.darkText : COLORS.lightIconColor} />
                <Text style={[styles.itemText, darkMode && styles.darkItemText]}>
                  <Text style={{ fontWeight: "bold", color: darkMode ? COLORS.darkText : COLORS.lightText }}>Terms and Conditions </Text>
                  <Text style={{ color: darkMode ? COLORS.darkText : COLORS.lightText }}>Disagree / Agreed (Required)</Text>
                </Text>
              </TouchableOpacity>
              <Switch 
                value={termsAccepted} 
                onValueChange={handleTermsToggle} 
                trackColor={{ false: COLORS.switchTrackInactive, true: COLORS.switchTrackActive }} 
                thumbColor={termsAccepted ? COLORS.switchThumbActive : COLORS.switchThumbInactive}
                ios_backgroundColor={COLORS.switchTrackInactive}
                activeThumbColor={COLORS.switchThumbActive}
                activeTrackColor={COLORS.switchTrackActive}
              />
            </View>

            {/* Dark Mode */}
            <View style={[styles.settingItem, darkMode && styles.darkSettingItem]}>
              <View style={styles.itemLabel}>
                <MaterialIcons name='brightness-2' size={20} style={styles.icon} color={darkMode ? COLORS.darkText : COLORS.lightIconColor} />
                <Text style={[styles.itemText, darkMode && styles.darkItemText]}>
                  <Text style={{ fontWeight: "bold", color: darkMode ? COLORS.darkText : COLORS.lightText }}>Background </Text>
                  <Text style={{ color: darkMode ? COLORS.darkText : COLORS.lightText }}>Light / Dark</Text>
                </Text>
              </View>
              <Switch 
                value={darkMode} 
                onValueChange={toggleDarkMode} 
                trackColor={{ false: COLORS.switchTrackInactive, true: COLORS.switchTrackActive }} 
                thumbColor={darkMode ? COLORS.switchThumbActive : COLORS.switchThumbInactive}
                ios_backgroundColor={COLORS.switchTrackInactive}
                activeThumbColor={COLORS.switchThumbActive}
                activeTrackColor={COLORS.switchTrackActive}
              />
            </View>

            {/* Allow Notifications */}
            <View style={[styles.settingItem, darkMode && styles.darkSettingItem]}>
              <View style={styles.itemLabel}>
                <MaterialIcons name='notifications' size={20} style={styles.icon} color={darkMode ? COLORS.darkText : COLORS.lightIconColor} />
                <Text style={[styles.itemText, darkMode && styles.darkItemText]}>
                  <Text style={{ fontWeight: "bold", color: darkMode ? COLORS.darkText : COLORS.lightText }}>Allow Notifications </Text>
                  <Text style={{ color: darkMode ? COLORS.darkText : COLORS.lightText }}>No / Yes</Text>
                </Text>
              </View>
              <Switch 
                value={allowNotifications} 
                onValueChange={setAllowNotifications} 
                trackColor={{ false: COLORS.switchTrackInactive, true: COLORS.switchTrackActive }} 
                thumbColor={allowNotifications ? COLORS.switchThumbActive : COLORS.switchThumbInactive}
                ios_backgroundColor={COLORS.switchTrackInactive}
                activeThumbColor={COLORS.switchThumbActive}
                activeTrackColor={COLORS.switchTrackActive}
              />
            </View>

            {/* Share Live Location */}
            <View style={[styles.settingItem, darkMode && styles.darkSettingItem]}>
              <View style={[styles.itemLabel, { flex: 1, marginRight: 10 }]}>
                <MaterialIcons name='location-on' size={20} style={styles.icon} color={shareLocationActive ? COLORS.primary : (darkMode ? COLORS.darkText : COLORS.lightIconColor)} />
                <View>
                  <Text style={[styles.itemText, darkMode && styles.darkItemText]}>
                    <Text style={{ fontWeight: "bold", color: darkMode ? COLORS.darkText : COLORS.lightText }}>Share Live Location </Text>
                    <Text style={{ color: darkMode ? COLORS.darkText : COLORS.lightText }}>Off / On</Text>
                  </Text>
                  <Text style={[styles.nearbySubText, darkMode && styles.darkNearbySubText]}>
                    {shareLocationActive && shareLocationUntil
                      ? `Active · expires at ${shareLocationUntil.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : `Shares for ${SHARE_LOCATION_DURATION_HOURS}h · updates every ~${SHARE_LOCATION_MIN_PATCH_MINS} min`}
                  </Text>
                </View>
              </View>
              <Switch
                value={shareLocationActive}
                onValueChange={(value) => value ? startLiveLocationSharing() : stopLiveLocationSharing()}
                trackColor={{ false: COLORS.switchTrackInactive, true: COLORS.switchTrackActive }}
                thumbColor={shareLocationActive ? COLORS.switchThumbActive : COLORS.switchThumbInactive}
                ios_backgroundColor={COLORS.switchTrackInactive}
                activeThumbColor={COLORS.switchThumbActive}
                activeTrackColor={COLORS.switchTrackActive}
              />
            </View>

            {/* Location Privacy — opens modal */}
            {(() => {
              const PRIVACY_LABEL = { everyone: "Everyone", all_circles: "All Circles", specific: "Specific" };
              const shareLabel   = PRIVACY_LABEL[nearbySettings.shareWith]   || nearbySettings.shareWith;
              const receiveLabel = PRIVACY_LABEL[nearbySettings.receiveFrom] || nearbySettings.receiveFrom;
              return (
                <TouchableOpacity
                  style={[styles.settingItem, darkMode && styles.darkSettingItem]}
                  onPress={() => setNearbyPrivacyModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.itemLabel, { flex: 1, marginRight: 10 }]}>
                    <Ionicons name="shield-checkmark-outline" size={20} style={styles.icon} color={darkMode ? COLORS.darkText : COLORS.lightIconColor} />
                    <View>
                      <Text style={[styles.itemText, darkMode && styles.darkItemText]}>
                        <Text style={{ fontWeight: "bold", color: darkMode ? COLORS.darkText : COLORS.lightText }}>Location Privacy</Text>
                      </Text>
                      <Text style={[styles.nearbySubText, darkMode && styles.darkNearbySubText]}>
                        Share: {shareLabel} · Receive: {receiveLabel}
                      </Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color={darkMode ? COLORS.darkText : COLORS.lightIconColor} />
                </TouchableOpacity>
              );
            })()}
          </View>
          )}

          {/* NEARBY POC Section */}
          <View style={styles.nearbySectionHeader}>
            <MaterialIcons name='location-on' size={16} color="#000" />
            <Text style={styles.nearbySectionHeaderText}>NEARBY NETWORK (POC)</Text>
          </View>
          <View style={[styles.settingsGroupContainer, darkMode && styles.darkSettingsGroupContainer, { marginBottom: 16 }]}>
            {/* Update Location button */}
            <TouchableOpacity
              style={[styles.nearbyActionButton, darkMode && styles.darkNearbyActionButton]}
              onPress={() => setLocationPickerVisible(true)}
            >
              <MaterialIcons name='my-location' size={20} color={COLORS.primary} style={styles.icon} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.nearbyActionText, darkMode && styles.darkNearbyActionText]}>Update My Location</Text>
                <Text style={[styles.nearbySubText, darkMode && styles.darkNearbySubText]}>
                  {storedCoords.lat != null
                    ? `${parseFloat(storedCoords.lat).toFixed(5)}, ${parseFloat(storedCoords.lng).toFixed(5)}`
                    : "No location set"}
                </Text>
              </View>
              <MaterialIcons name='chevron-right' size={22} color={darkMode ? COLORS.darkText : COLORS.lightIconColor} />
            </TouchableOpacity>

            {/* Who's Nearby button */}
            <TouchableOpacity
              style={[styles.nearbyActionButton, darkMode && styles.darkNearbyActionButton]}
              onPress={fetchNearbyUsers}
            >
              <MaterialIcons name='people' size={20} color={COLORS.primary} style={styles.icon} />
              <Text style={[styles.nearbyActionText, darkMode && styles.darkNearbyActionText]}>Who's Nearby?</Text>
              <MaterialIcons name='chevron-right' size={22} color={darkMode ? COLORS.darkText : COLORS.lightIconColor} />
            </TouchableOpacity>
          </View>

          {/* INFORMATION Section Header - Outside Box */}
          <TouchableOpacity style={styles.informationSectionHeader} onPress={() => setShowInformation(!showInformation)}>
            <Text style={styles.informationSectionHeaderText}>INFORMATION</Text>
            <Ionicons name={showInformation ? "chevron-up" : "chevron-down"} size={20} color={darkMode ? COLORS.darkText : COLORS.lightText} />
          </TouchableOpacity>

          {/* Information & Links Container */}
          {showInformation && (
            <View style={[styles.settingsGroupContainer, darkMode && styles.darkSettingsGroupContainer, { marginBottom: 16 }]}>
              {/* Terms and Conditions */}
                <TouchableOpacity style={[styles.settingItem, darkMode && styles.darkSettingItem]} onPress={() => navigation.navigate("TermsAndConditions")}>
                  <View style={styles.itemLabel}>
                    <MaterialIcons name='description' size={20} style={styles.icon} color={darkMode ? COLORS.darkText : COLORS.lightIconColor} />
                    <Text style={[styles.itemText, darkMode && styles.darkItemText]}>Terms and Conditions</Text>
                  </View>
                  <MaterialIcons name='chevron-right' size={24} color={darkMode ? COLORS.darkText : COLORS.lightIconColor} />
                </TouchableOpacity>

                {/* Privacy Policy */}
                <TouchableOpacity style={[styles.settingItem, darkMode && styles.darkSettingItem]} onPress={() => navigation.navigate("PrivacyPolicy")}>
                  <View style={styles.itemLabel}>
                    <MaterialIcons name='privacy-tip' size={20} style={styles.icon} color={darkMode ? COLORS.darkText : COLORS.lightIconColor} />
                    <Text style={[styles.itemText, darkMode && styles.darkItemText]}>Privacy Policy</Text>
                  </View>
                  <MaterialIcons name='chevron-right' size={24} color={darkMode ? COLORS.darkText : COLORS.lightIconColor} />
                </TouchableOpacity>

                {/* Change Password */}
                <TouchableOpacity style={[styles.settingItem, darkMode && styles.darkSettingItem]} onPress={() => navigation.navigate("ChangePassword")}>
                  <View style={styles.itemLabel}>
                    <MaterialIcons name='lock' size={20} style={styles.icon} color={darkMode ? COLORS.darkText : COLORS.lightIconColor} />
                    <Text style={[styles.itemText, darkMode && styles.darkItemText]}>Change Password</Text>
                  </View>
                  <MaterialIcons name='chevron-right' size={24} color={darkMode ? COLORS.darkText : COLORS.lightIconColor} />
                </TouchableOpacity>

                {/* How It Works */}
                <TouchableOpacity style={[styles.settingItem, darkMode && styles.darkSettingItem]} onPress={() => navigation.navigate("HowItWorksScreen")}>
                  <View style={styles.itemLabel}>
                    <MaterialIcons name='help-outline' size={20} style={styles.icon} color={darkMode ? COLORS.darkText : COLORS.lightIconColor} />
                    <Text style={[styles.itemText, darkMode && styles.darkItemText]}>How It Works</Text>
                  </View>
                <MaterialIcons name='chevron-right' size={24} color={darkMode ? COLORS.darkText : COLORS.lightIconColor} />
              </TouchableOpacity>
            </View>
          )}

          {/* Logout Button OUTSIDE container */}
          <TouchableOpacity style={[styles.logoutButton, darkMode && styles.darkLogoutButton]} onPress={handleLogout}>
            <MaterialIcons name='logout' size={20} style={styles.icon} color={darkMode ? COLORS.darkText : COLORS.primary} />
            <Text style={[styles.logoutText, darkMode && styles.darkLogoutText]}>Log out</Text>
          </TouchableOpacity>

          {/* Build Info */}
          <View style={styles.buildInfoContainer}>
            <Text style={[styles.dateTimeText, darkMode && styles.darkDateTimeText]}>
              PM {versionData.pm_version} Version {versionData.major}.{versionData.build} - Last Change: {versionData.last_change}
            </Text>
          </View>

          {/* Bottom Logout Button - Styled like Submit button */}
          <TouchableOpacity style={[styles.bottomLogoutButton, darkMode && styles.darkBottomLogoutButton]} onPress={handleLogout}>
            <Text style={[styles.bottomLogoutText, darkMode && styles.darkBottomLogoutText]}>Log out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      {/* Location Picker Modal */}
      <Modal visible={locationPickerVisible} transparent={true} animationType='slide' onRequestClose={() => setLocationPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.nearbyModalBox, darkMode && styles.darkModalBox]}>
            <Text style={[styles.nearbyModalTitle, darkMode && styles.darkWarningTitle]}>Choose a Location</Text>
            <Text style={[styles.nearbyModalSubtitle, darkMode && styles.darkNearbySubText]}>
              Dummy A &amp; B are within 1 mile of each other.{"\n"}Dummy C is ~5 miles away.
            </Text>

            {[...DUMMY_LOCATIONS, { name: "Live GPS" }].map((option) => (
              <TouchableOpacity
                key={option.name}
                style={[styles.locationOptionRow, darkMode && styles.darkLocationOptionRow]}
                onPress={() => updateLocation(option)}
                disabled={locationUpdating !== null}
              >
                <MaterialIcons
                  name={option.name === "Live GPS" ? "gps-fixed" : "location-on"}
                  size={20}
                  color={COLORS.primary}
                  style={{ marginRight: 10 }}
                />
                <Text style={[styles.locationOptionText, darkMode && styles.darkItemText]}>{option.name}</Text>
                {locationUpdating === option.name && (
                  <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: "auto" }} />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setLocationPickerVisible(false)}
              style={[styles.closeModalButton, { marginTop: 16, alignSelf: "stretch" }]}
              disabled={locationUpdating !== null}
            >
              <Text style={[styles.closeButtonText, { textAlign: "center" }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Location Privacy Modal */}
      <Modal
        visible={nearbyPrivacyModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setNearbyPrivacyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.nearbyModalBox, darkMode && styles.darkModalBox]}>
            <Text style={[styles.nearbyModalTitle, darkMode && styles.darkWarningTitle]}>Location Privacy</Text>
            <Text style={[styles.nearbyModalSubtitle, darkMode && styles.darkNearbySubText]}>
              Control who can see your location and who you get notified about.
            </Text>

            {/* ── SHARE MY LOCATION WITH ── */}
            <Text style={[styles.nearbyPrivacyGroupLabel, darkMode && styles.darkItemText, { marginTop: 8 }]}>
              Share My Location With
            </Text>
            {[
              { key: "everyone",    label: "Everyone (all app users)" },
              { key: "all_circles", label: "All Circle Members" },
              { key: "specific",    label: "Specific Types", disabled: true },
            ].map(({ key, label, disabled }) => (
              <TouchableOpacity
                key={key}
                style={[styles.nearbyPrivacyOptionRow, disabled && { opacity: 0.38 }]}
                onPress={() => !disabled && updateNearbySettings({ ...nearbySettings, shareWith: key })}
                activeOpacity={disabled ? 1 : 0.7}
              >
                <Ionicons
                  name={nearbySettings.shareWith === key ? "radio-button-on" : "radio-button-off"}
                  size={18}
                  color={COLORS.primary}
                  style={{ marginRight: 10 }}
                />
                <Text style={[styles.nearbyPrivacyOptionText, darkMode && styles.darkNearbySubText]}>
                  {label}{disabled ? "  (coming soon)" : ""}
                </Text>
              </TouchableOpacity>
            ))}
            {nearbySettings.shareWith === "specific" && (
              <View style={styles.nearbyPrivacyCheckboxGroup}>
                {[
                  { key: "friends",    label: "Friends" },
                  { key: "colleagues", label: "Colleagues" },
                  { key: "family",     label: "Family" },
                ].map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    style={styles.nearbyPrivacyCheckboxRow}
                    onPress={() =>
                      updateNearbySettings({
                        ...nearbySettings,
                        shareWithTypes: { ...nearbySettings.shareWithTypes, [key]: !nearbySettings.shareWithTypes[key] },
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={nearbySettings.shareWithTypes[key] ? "checkbox" : "square-outline"}
                      size={17}
                      color={COLORS.primary}
                      style={{ marginRight: 10 }}
                    />
                    <Text style={[styles.nearbyPrivacyOptionText, darkMode && styles.darkNearbySubText]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ── RECEIVE NOTIFICATIONS FROM ── */}
            <View style={[styles.nearbyPrivacyDivider, darkMode && { borderBottomColor: "#555" }]} />
            <Text style={[styles.nearbyPrivacyGroupLabel, darkMode && styles.darkItemText]}>
              Receive Notifications From
            </Text>
            {[
              { key: "everyone",    label: "Everyone (all app users)" },
              { key: "all_circles", label: "All Circle Members" },
              { key: "specific",    label: "Specific Types", disabled: true },
            ].map(({ key, label, disabled }) => (
              <TouchableOpacity
                key={key}
                style={[styles.nearbyPrivacyOptionRow, disabled && { opacity: 0.38 }]}
                onPress={() => !disabled && updateNearbySettings({ ...nearbySettings, receiveFrom: key })}
                activeOpacity={disabled ? 1 : 0.7}
              >
                <Ionicons
                  name={nearbySettings.receiveFrom === key ? "radio-button-on" : "radio-button-off"}
                  size={18}
                  color={COLORS.primary}
                  style={{ marginRight: 10 }}
                />
                <Text style={[styles.nearbyPrivacyOptionText, darkMode && styles.darkNearbySubText]}>
                  {label}{disabled ? "  (coming soon)" : ""}
                </Text>
              </TouchableOpacity>
            ))}
            {nearbySettings.receiveFrom === "specific" && (
              <View style={styles.nearbyPrivacyCheckboxGroup}>
                {[
                  { key: "friends",    label: "Friends" },
                  { key: "colleagues", label: "Colleagues" },
                  { key: "family",     label: "Family" },
                ].map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    style={styles.nearbyPrivacyCheckboxRow}
                    onPress={() =>
                      updateNearbySettings({
                        ...nearbySettings,
                        receiveFromTypes: { ...nearbySettings.receiveFromTypes, [key]: !nearbySettings.receiveFromTypes[key] },
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={nearbySettings.receiveFromTypes[key] ? "checkbox" : "square-outline"}
                      size={17}
                      color={COLORS.primary}
                      style={{ marginRight: 10 }}
                    />
                    <Text style={[styles.nearbyPrivacyOptionText, darkMode && styles.darkNearbySubText]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              onPress={() => setNearbyPrivacyModalVisible(false)}
              style={[styles.closeModalButton, { marginTop: 20, alignSelf: "stretch" }]}
            >
              <Text style={[styles.closeButtonText, { textAlign: "center" }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Nearby Results Modal */}
      <Modal visible={nearbyResultsVisible} transparent={true} animationType='slide' onRequestClose={() => setNearbyResultsVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.nearbyModalBox, darkMode && styles.darkModalBox, { maxHeight: "70%" }]}>
            <Text style={[styles.nearbyModalTitle, darkMode && styles.darkWarningTitle]}>Who's Nearby?</Text>
            <Text style={[styles.nearbyModalSubtitle, darkMode && styles.darkNearbySubText]}>
              Circle members within 1 mile with a fresh location
            </Text>

            {nearbyLoading ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 30 }} />
            ) : nearbyError ? (
              <View style={styles.nearbyEmptyContainer}>
                <MaterialIcons name='location-off' size={40} color={darkMode ? COLORS.darkTertiaryText : COLORS.lightQuaternaryText} />
                <Text style={[styles.nearbyEmptyText, darkMode && styles.darkNearbySubText]}>{nearbyError}</Text>
              </View>
            ) : nearbyUsers.length === 0 ? (
              <View style={styles.nearbyEmptyContainer}>
                <MaterialIcons name='people-outline' size={40} color={darkMode ? COLORS.darkTertiaryText : COLORS.lightQuaternaryText} />
                <Text style={[styles.nearbyEmptyText, darkMode && styles.darkNearbySubText]}>
                  No one from your circles is nearby right now.
                </Text>
              </View>
            ) : (
              <FlatList
                data={nearbyUsers.filter((u) => !ignoredNearbyUids.has(u.profile_personal_uid))}
                keyExtractor={(item) => item.profile_personal_uid}
                style={{ width: "100%", marginTop: 8 }}
                renderItem={({ item }) => {
                  const distMiles = item.distance_meters != null
                    ? (item.distance_meters / 1609).toFixed(1)
                    : "?";
                  const initials = `${(item.profile_personal_first_name || "?")[0]}${(item.profile_personal_last_name || "?")[0]}`.toUpperCase();
                  const fullName = `${item.profile_personal_first_name || ""} ${item.profile_personal_last_name || ""}`.trim();
                  return (
                    <View style={[styles.nearbyUserRow, darkMode && styles.darkLocationOptionRow]}>
                      {item.profile_personal_image ? (
                        <Image
                          source={{ uri: item.profile_personal_image }}
                          style={styles.nearbyAvatar}
                        />
                      ) : (
                        <View style={[styles.nearbyAvatar, styles.nearbyAvatarFallback]}>
                          <Text style={styles.nearbyAvatarInitials}>{initials}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.nearbyUserName, darkMode && styles.darkItemText]}>
                          {fullName}
                        </Text>
                        <Text style={[styles.nearbyDistanceText, darkMode && styles.darkNearbySubText]}>
                          <MaterialIcons name='location-on' size={12} color={COLORS.primary} /> {distMiles} mi away
                        </Text>
                      </View>
                      {/* View profile */}
                      <TouchableOpacity
                        style={styles.nearbyActionBtn}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        onPress={() => {
                          setNearbyResultsVisible(false);
                          navigation.navigate("Profile", { profile_uid: item.profile_personal_uid });
                        }}
                      >
                        <Ionicons name="person-outline" size={17} color={COLORS.primary} />
                      </TouchableOpacity>
                      {/* Message */}
                      <TouchableOpacity
                        style={[styles.nearbyActionBtn, styles.nearbyMessageBtn]}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        onPress={() => {
                          setNearbyResultsVisible(false);
                          navigation.navigate("Chat", {
                            other_uid: item.profile_personal_uid,
                            other_name: fullName || "Chat",
                            other_image: item.profile_personal_image || null,
                          });
                        }}
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={17} color="#fff" />
                      </TouchableOpacity>
                      {/* Ignore */}
                      <TouchableOpacity
                        style={[styles.nearbyActionBtn, styles.nearbyIgnoreBtn]}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        onPress={() => ignoreNearbyUser(item.profile_personal_uid)}
                      >
                        <Ionicons name="eye-off-outline" size={17} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )}

            {/* Ignored section — only shown when there are ignored users who were also nearby */}
            {nearbyUsers.filter((u) => ignoredNearbyUids.has(u.profile_personal_uid)).length > 0 && (
              <>
                <View style={styles.ignoredSectionHeader}>
                  <Ionicons name="eye-off-outline" size={14} color={darkMode ? "#888" : "#aaa"} style={{ marginRight: 6 }} />
                  <Text style={[styles.ignoredSectionTitle, darkMode && styles.darkNearbySubText]}>
                    Ignored ({nearbyUsers.filter((u) => ignoredNearbyUids.has(u.profile_personal_uid)).length})
                  </Text>
                </View>
                {nearbyUsers
                  .filter((u) => ignoredNearbyUids.has(u.profile_personal_uid))
                  .map((item) => {
                    const iName = `${(item.profile_personal_first_name || "?")[0]}${(item.profile_personal_last_name || "?")[0]}`.toUpperCase();
                    const iFullName = `${item.profile_personal_first_name || ""} ${item.profile_personal_last_name || ""}`.trim();
                    return (
                      <View key={item.profile_personal_uid} style={[styles.nearbyUserRow, styles.ignoredRow, darkMode && styles.darkLocationOptionRow]}>
                        {item.profile_personal_image ? (
                          <Image source={{ uri: item.profile_personal_image }} style={[styles.nearbyAvatar, styles.ignoredAvatar]} />
                        ) : (
                          <View style={[styles.nearbyAvatar, styles.nearbyAvatarFallback, styles.ignoredAvatar]}>
                            <Text style={styles.nearbyAvatarInitials}>{iName}</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.nearbyUserName, styles.ignoredName, darkMode && styles.darkNearbySubText]}>{iFullName}</Text>
                        </View>
                        {/* Unignore */}
                        <TouchableOpacity
                          style={[styles.nearbyActionBtn, styles.nearbyUnignoreBtn]}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          onPress={() => unignoreNearbyUser(item.profile_personal_uid)}
                        >
                          <Ionicons name="eye-outline" size={17} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
              </>
            )}

            <TouchableOpacity
              onPress={() => setNearbyResultsVisible(false)}
              style={[styles.closeModalButton, { marginTop: 16, alignSelf: "stretch" }]}
            >
              <Text style={[styles.closeButtonText, { textAlign: "center" }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modals unchanged */}
      <Modal visible={qrModalVisible} transparent={true} animationType='fade'>
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalBox}>
            <Text style={styles.qrModalTitle}>QR Code</Text>
            <Text style={styles.qrModalSubtitle}>Scan to visit Infinite Options</Text>
            <View style={styles.qrCodeContainer}>
              <QRCode 
                value='https://infiniteoptions.com/' 
                size={200} 
                color={COLORS.lightText} 
                backgroundColor={COLORS.lightBackground} 
              />
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
            <MaterialIcons name='warning' size={48} color={COLORS.warningRed} style={{ marginBottom: 15 }} />
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
            <MaterialIcons name='warning' size={48} color={COLORS.warningRed} style={{ marginBottom: 15 }} />
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
    backgroundColor: COLORS.lightBackground,
  },
  safeArea: {
    flex: 1,
  },
  darkContainer: {
    backgroundColor: COLORS.darkBackground,
  },
  settingsContainer: {
    padding: 15,
    paddingBottom: 80,
  },
  settingItem: {
    borderRadius: 8,
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  darkSettingItem: {
    backgroundColor: COLORS.darkItemBackground,
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
    color: COLORS.lightSecondaryText,
  },
  darkItemText: {
    color: COLORS.darkText,
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: COLORS.modalOverlay, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  modalBox: { 
    backgroundColor: COLORS.lightModalBackground, 
    padding: 20, 
    borderRadius: 10, 
    alignItems: "center" 
  },
  modalText: { 
    fontSize: 18, 
    fontWeight: "bold" 
  },
  closeModalButton: { 
    marginTop: 15, 
    backgroundColor: COLORS.primary, 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 6 
  },
  closeButtonText: { 
    color: COLORS.darkText, 
    fontWeight: "bold" 
  },
  logoutButton: {
    backgroundColor: COLORS.lightBackground,
    borderRadius: 8,
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginTop: 20,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  darkLogoutButton: {
    backgroundColor: COLORS.darkItemBackground,
    borderColor: COLORS.primary,
  },
  logoutText: {
    fontSize: 16,
    color: COLORS.primary,
    marginLeft: 10,
  },
  darkLogoutText: {
    color: COLORS.primary,
  },
  bottomLogoutButton: {
    backgroundColor: "#4B2E83",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginVertical: 20,
    marginBottom: 30,
  },
  darkBottomLogoutButton: {
    backgroundColor: "#4B2E83",
  },
  bottomLogoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  darkBottomLogoutText: {
    color: "#fff",
  },
  qrModalBox: {
    backgroundColor: COLORS.lightModalBackground,
    padding: 30,
    borderRadius: 15,
    alignItems: "center",
    minWidth: 300,
  },
  qrModalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    color: COLORS.lightSecondaryText,
  },
  qrModalSubtitle: {
    fontSize: 16,
    marginBottom: 25,
    color: COLORS.lightQuaternaryText,
    textAlign: "center",
  },
  qrCodeContainer: {
    marginBottom: 25,
    padding: 15,
    backgroundColor: COLORS.lightQrBackground,
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
    color: COLORS.lightQuaternaryText,
    textAlign: "center",
  },
  darkDateTimeText: {
    color: COLORS.darkTertiaryText,
  },
  settingsGroupContainer: {
    borderWidth: 1,
    borderColor: COLORS.lightBorderColor,
    borderRadius: 10,
    backgroundColor: COLORS.lightGroupBackground,
    marginBottom: 16,
    overflow: "hidden",
  },
  darkSettingsGroupContainer: {
    backgroundColor: COLORS.darkGroupBackground,
    borderColor: COLORS.darkBorderColor,
  },
  settingsGroupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightBorderColorLight,
    backgroundColor: COLORS.lightGroupHeaderBackground,
  },
  settingsGroupHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.lightTertiaryText,
  },
  darkModalBox: {
    backgroundColor: COLORS.darkModalBackground,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.lightSecondaryText,
    marginBottom: 10,
    textAlign: "center",
  },
  darkWarningTitle: {
    color: COLORS.darkText,
  },
  warningText: {
    fontSize: 16,
    color: COLORS.lightQuaternaryText,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  darkWarningText: {
    color: COLORS.darkSecondaryText,
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
    backgroundColor: COLORS.cancelButtonBackground,
  },
  cancelButtonText: {
    color: COLORS.lightSecondaryText,
    fontWeight: "bold",
    fontSize: 16,
  },
  confirmButton: {
    backgroundColor: COLORS.warningRed,
  },
  confirmButtonText: {
    color: COLORS.darkText,
    fontWeight: "bold",
    fontSize: 16,
  },
  settingsSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(75, 46, 131, 0.5)", // 50% opacity of Settings header color #4B2E83
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  settingsSectionHeaderText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000",
    letterSpacing: 1,
  },
  informationSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(75, 46, 131, 0.5)", // 50% opacity of Settings header color #4B2E83
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    marginTop: 16,
  },
  informationSectionHeaderText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000",
    letterSpacing: 1,
  },

  // Nearby POC styles
  nearbySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(75, 46, 131, 0.5)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    marginTop: 16,
  },
  nearbySectionHeaderText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000",
    letterSpacing: 1,
  },
  nearbyActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginBottom: 10,
    borderRadius: 8,
  },
  darkNearbyActionButton: {
    backgroundColor: COLORS.darkItemBackground,
  },
  nearbyActionText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.lightSecondaryText,
    flex: 1,
  },
  darkNearbyActionText: {
    color: COLORS.darkText,
  },
  nearbySubText: {
    fontSize: 12,
    color: COLORS.lightQuaternaryText,
    marginTop: 2,
  },
  darkNearbySubText: {
    color: COLORS.darkTertiaryText,
  },
  nearbyModalBox: {
    backgroundColor: COLORS.lightModalBackground,
    padding: 24,
    borderRadius: 14,
    alignItems: "center",
    width: "88%",
  },
  nearbyModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.lightSecondaryText,
    marginBottom: 6,
    textAlign: "center",
  },
  nearbyModalSubtitle: {
    fontSize: 13,
    color: COLORS.lightQuaternaryText,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
  },
  locationOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.lightGroupBackground,
    marginBottom: 8,
    width: "100%",
  },
  darkLocationOptionRow: {
    backgroundColor: COLORS.darkItemBackground,
  },
  locationOptionText: {
    fontSize: 15,
    color: COLORS.lightSecondaryText,
  },
  nearbyEmptyContainer: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 10,
  },
  nearbyEmptyText: {
    fontSize: 14,
    color: COLORS.lightQuaternaryText,
    textAlign: "center",
    lineHeight: 20,
  },
  nearbyUserRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.lightGroupBackground,
    marginBottom: 8,
    width: "100%",
    gap: 10,
  },
  nearbyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  nearbyAvatarFallback: {
    backgroundColor: COLORS.primaryTransparent,
    justifyContent: "center",
    alignItems: "center",
  },
  nearbyAvatarInitials: {
    color: COLORS.darkText,
    fontWeight: "bold",
    fontSize: 14,
  },
  nearbyUserName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.lightSecondaryText,
  },
  nearbyDistanceText: {
    fontSize: 12,
    color: COLORS.lightQuaternaryText,
    marginTop: 2,
  },
  nearbyActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  nearbyMessageBtn: {
    backgroundColor: "#AF52DE",
    borderColor: "#AF52DE",
  },
  nearbyIgnoreBtn: {
    backgroundColor: "#e57373",
    borderColor: "#e57373",
  },
  nearbyUnignoreBtn: {
    backgroundColor: "#66bb6a",
    borderColor: "#66bb6a",
  },
  ignoredSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  ignoredSectionTitle: {
    fontSize: 12,
    color: "#aaa",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  ignoredRow: {
    opacity: 0.5,
  },
  ignoredAvatar: {
    opacity: 0.6,
  },
  ignoredName: {
    textDecorationLine: "line-through",
    color: "#999",
  },

  // ── Nearby privacy settings matrix (used inside modal) ───────────────────
  nearbyPrivacyGroupLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#555",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 4,
  },
  nearbyPrivacyOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingLeft: 4,
  },
  nearbyPrivacyOptionText: {
    fontSize: 14,
    color: "#333",
  },
  nearbyPrivacyCheckboxGroup: {
    paddingLeft: 28,
    marginTop: 2,
    marginBottom: 4,
  },
  nearbyPrivacyCheckboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  nearbyPrivacyDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    marginVertical: 10,
  },
});
