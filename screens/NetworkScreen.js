// NetworkScreen.js - Web-compatible version
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useFocusEffect } from "@react-navigation/native";
import { API_BASE_URL, USER_PROFILE_INFO_ENDPOINT, CIRCLES_ENDPOINT } from "../apiConfig";
import MiniCard from "../components/MiniCard";
import WebTextInput from "../components/WebTextInput";
import { sanitizeText, isSafeForConditional } from "../utils/textSanitizer";

import FeedbackPopup from "../components/FeedbackPopup";
import { getHeaderColors } from "../config/headerColors";

// Web-compatible QR code - react-native-qrcode-svg works on both web and native
let QRCodeComponent = null;
try {
  QRCodeComponent = require("react-native-qrcode-svg").default;
} catch (e) {
  console.warn("QRCode not available:", e.message);
}

// WebView handling - use iframe on web, WebView on native
let WebViewComponent = null;
if (Platform.OS !== "web") {
  try {
    const webviewModule = require("react-native-webview");
    if (webviewModule && webviewModule.WebView) {
      WebViewComponent = webviewModule.WebView;
    }
  } catch (e) {
    console.warn("WebView not available on native platform");
  }
}

const NetworkScreen = ({ navigation }) => {
  const { darkMode } = useDarkMode();
  const [storageData, setStorageData] = useState([]);
  const [networkData, setNetworkData] = useState([]);
  const [groupedNetwork, setGroupedNetwork] = useState({});
  const [profileUid, setProfileUid] = useState("");
  const [degree, setDegree] = useState("2");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [userProfileData, setUserProfileData] = useState(null);
  const [qrCodeData, setQrCodeData] = useState("");
  const [showAsyncStorage, setShowAsyncStorage] = useState(true);
  const [relationshipFilter, setRelationshipFilter] = useState("All"); // All, Colleagues, Friends, Family
  const [dateFilter, setDateFilter] = useState("All"); // All, This Week, This Month, This Year
  const [locationFilter, setLocationFilter] = useState("All");
  const [eventFilter, setEventFilter] = useState("All"); 
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [graphHtml, setGraphHtml] = useState(""); // For web iframe
  const iframeContainerRef = React.useRef(null); // Ref for web iframe container
  const [activeView, setActiveView] = useState("connections"); // "connections" or "circles" - default to connections

  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);

  const networkFeedbackInstructions = "Instructions for Connect";

  //Define custom questions for the Network page
  const networkFeedbackQuestions = ["Connect - Question 1?", "Connect - Question 2?", "Connect - Question 3?"];

  // Load persisted Network screen settings
  const loadNetworkSettings = async () => {
    try {
      console.log("📥 Loading Network screen settings from AsyncStorage...");
      const [showAsyncStorageValue, degreeValue, viewModeValue, networkDataValue, groupedNetworkValue, dateFilterValue, locationFilterValue, eventFilterValue] = await Promise.all([
        AsyncStorage.getItem("network_showAsyncStorage"),
        AsyncStorage.getItem("network_degree"),
        AsyncStorage.getItem("network_viewMode"),
        AsyncStorage.getItem("network_data"),
        AsyncStorage.getItem("network_grouped"),
        AsyncStorage.getItem("network_dateFilter"),
        AsyncStorage.getItem("network_locationFilter"),
        AsyncStorage.getItem("network_eventFilter"),
      ]);

      console.log("📥 Loaded values:", {
        showAsyncStorage: showAsyncStorageValue,
        degree: degreeValue,
        viewMode: viewModeValue,
        hasNetworkData: networkDataValue !== null,
        hasGroupedNetwork: groupedNetworkValue !== null,
      });

      if (showAsyncStorageValue !== null) {
        const parsedValue = JSON.parse(showAsyncStorageValue);
        console.log("📥 Setting showAsyncStorage to:", parsedValue);
        setShowAsyncStorage(parsedValue);
      } else {
        console.log("📥 No persisted showAsyncStorage value, using default: true");
      }
      if (degreeValue !== null) {
        console.log("📥 Setting degree to:", degreeValue);
        setDegree(degreeValue);
      } else {
        console.log("📥 No persisted degree value, using default: 2");
      }
      if (viewModeValue !== null) {
        console.log("📥 Setting viewMode to:", viewModeValue);
        setViewMode(viewModeValue);
      } else {
        console.log("📥 No persisted viewMode value, using default: list");
      }

      if (dateFilterValue !== null) {
        console.log("📥 Setting dateFilter to:", dateFilterValue);
        setDateFilter(dateFilterValue);
      } else {
        console.log("📥 No persisted dateFilter value, using default: All");
      }

      if (locationFilterValue !== null) {
        console.log("📥 Setting locationFilter to:", locationFilterValue);
        setLocationFilter(locationFilterValue);
      } else {
        console.log("📥 No persisted locationFilter value, using default: All");
      }

      if (eventFilterValue !== null) {
        console.log("📥 Setting eventFilter to:", eventFilterValue);
        setEventFilter(eventFilterValue);
      } else {
        console.log("📥 No persisted eventFilter value, using default: All");
      }

      // Load network data if available
      if (networkDataValue !== null) {
        try {
          const parsedNetworkData = JSON.parse(networkDataValue);
          console.log("📥 Loading network data, items:", parsedNetworkData.length);
          setNetworkData(parsedNetworkData);
        } catch (e) {
          console.error("❌ Error parsing network data:", e);
        }
      } else {
        console.log("📥 No persisted network data");
      }

      if (groupedNetworkValue !== null) {
        try {
          const parsedGroupedNetwork = JSON.parse(groupedNetworkValue);
          console.log("📥 Loading grouped network data, degrees:", Object.keys(parsedGroupedNetwork).length);
          setGroupedNetwork(parsedGroupedNetwork);
        } catch (e) {
          console.error("❌ Error parsing grouped network data:", e);
        }
      } else {
        console.log("📥 No persisted grouped network data");
      }

      // Mark settings as loaded so we can start saving changes
      setSettingsLoaded(true);
      console.log("✅ Settings loaded, now tracking changes for persistence");
    } catch (e) {
      console.error("❌ Error loading network settings:", e);
    }
  };

  // Track if settings have been loaded to avoid saving defaults
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Save Network screen settings when they change (but only after initial load)
  useEffect(() => {
    if (!settingsLoaded) {
      // Don't save on initial render before settings are loaded
      return;
    }
    const saveSettings = async () => {
      try {
        console.log("💾 Saving Network screen settings:", {
          showAsyncStorage,
          degree,
          viewMode,
        });
        await Promise.all([
          AsyncStorage.setItem("network_showAsyncStorage", JSON.stringify(showAsyncStorage)),
          AsyncStorage.setItem("network_degree", degree),
          AsyncStorage.setItem("network_viewMode", viewMode),
          AsyncStorage.setItem("network_dateFilter", dateFilter),
          AsyncStorage.setItem("network_locationFilter", locationFilter),
          AsyncStorage.setItem("network_eventFilter", eventFilter),
        ]);
        console.log("✅ Network screen settings saved successfully");
      } catch (e) {
        console.error("❌ Error saving network settings:", e);
      }
    };
    saveSettings();
  }, [showAsyncStorage, degree, viewMode, dateFilter, locationFilter, eventFilter, settingsLoaded]);

  // Extract unique events from network data
  useEffect(() => {
    if (networkData && networkData.length > 0) {
      const events = new Set();
      networkData.forEach((node) => {
        const event = node.circle_event;
        if (event && event.trim() !== "") {
          events.add(event.trim());
        }
      });
      const sortedEvents = Array.from(events).sort();
      setAvailableEvents(sortedEvents);
      console.log("📋 Available events:", sortedEvents);
    } else {
      setAvailableEvents([]);
    }
  }, [networkData]);

  useEffect(() => {
    const loadAsyncStorage = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const stores = await AsyncStorage.multiGet(keys);
        setStorageData(stores);
        const profileEntry = stores.find(([key]) => key === "profile_uid");
        if (profileEntry) {
          let uid = profileEntry[1];
          // AsyncStorage.multiGet returns values as strings, but handle edge cases
          if (uid === null || uid === undefined) {
            uid = "";
          } else {
            // Try to parse if it's a JSON string
            try {
              const parsed = JSON.parse(uid);
              if (typeof parsed === "string") {
                uid = parsed;
              } else if (typeof parsed === "object" && parsed !== null) {
                // Extract UID from object
                uid = parsed.profile_uid || parsed.uid || parsed.id || parsed.profile_personal_uid || "";
                console.warn("⚠️ profile_uid was stored as JSON object, extracted:", uid);
              } else {
                uid = String(parsed);
              }
            } catch (e) {
              // Not JSON, use as string
              uid = String(uid).trim();
            }
          }

          uid = String(uid || "").trim();
          console.log("📋 Loaded profile_uid from AsyncStorage:", uid, "Type:", typeof uid);

          if (uid && uid !== "[object Object]") {
            setProfileUid(uid);
            // Fetch user profile data for QR code
            fetchUserProfileForQR(uid);
          } else {
            console.warn("⚠️ Invalid profile_uid loaded:", uid);
          }
        }
      } catch (e) {
        setStorageData([["error", e.message]]);
      }
    };
    loadAsyncStorage();
  }, []);

  // Load settings when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      console.log("🔄 Network screen focused - loading settings...");
      loadNetworkSettings();

      // Refetch network data when screen is focused to get updated relationship information
      // This ensures relationship changes are reflected immediately
      const refetchNetworkData = async () => {
        let currentProfileUid = await AsyncStorage.getItem("profile_uid");
        // Ensure currentProfileUid is always a string
        if (currentProfileUid) {
          try {
            // Try to parse if it's JSON, but ensure it's a string
            const parsed = JSON.parse(currentProfileUid);
            currentProfileUid = typeof parsed === "string" ? parsed : String(parsed);
          } catch (e) {
            // Not JSON, use as string
            currentProfileUid = String(currentProfileUid).trim();
          }
        } else {
          currentProfileUid = "";
        }
        if (currentProfileUid && currentProfileUid !== profileUid) {
          console.log("🔄 Updating profileUid from AsyncStorage:", currentProfileUid);
          setProfileUid(currentProfileUid);
        }
        const currentDegree = (await AsyncStorage.getItem("network_degree")) || "2";
        const hasNetworkData = await AsyncStorage.getItem("network_data");

        // Only refetch if we have network data already (user has fetched before)
        if (currentProfileUid && currentDegree && hasNetworkData) {
          console.log("🔄 Refetching network data to get updated relationships...");
          // Use AsyncStorage values directly to avoid state timing issues
          fetchNetwork(currentProfileUid, currentDegree);
        }
      };
      refetchNetworkData();
    }, [])
  );

  // Also load settings on initial mount
  useEffect(() => {
    console.log("🔄 Network screen mounted - loading settings...");
    loadNetworkSettings();
  }, []);

  // Fetch user profile data to create QR code with public miniCard info
  const fetchUserProfileForQR = async (profileUID) => {
    try {
      const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${profileUID}`);
      if (!response.ok) return;
      const apiUser = await response.json();

      // Fetch user_uid (the 110 number) from AsyncStorage
      let userUid = null;
      try {
        userUid = await AsyncStorage.getItem("user_uid");
        if (userUid) {
          userUid = String(userUid).trim();
          console.log("NetworkScreen - Fetched user_uid for QR code:", userUid);
        }
      } catch (e) {
        console.warn("NetworkScreen - Could not fetch user_uid from AsyncStorage:", e);
      }

      // Extract public miniCard information
      const p = apiUser?.personal_info || {};
      const tagLineIsPublic = p.profile_personal_tag_line_is_public === 1 || p.profile_personal_tagline_is_public === 1;
      const emailIsPublic = p.profile_personal_email_is_public === 1;
      const phoneIsPublic = p.profile_personal_phone_number_is_public === 1;
      const imageIsPublic = p.profile_personal_image_is_public === 1;

      const city = p.profile_personal_city || "";
      const state = p.profile_personal_state || "";
      const locationIsPublic = p.profile_personal_location_is_public === 1;

      // Sanitize all text fields when creating publicData
      const publicData = {
        profile_uid: profileUID,
        user_uid: userUid || "", // Add user_uid (the 110 number)
        firstName: sanitizeText(p.profile_personal_first_name),
        lastName: sanitizeText(p.profile_personal_last_name),
        tagLine: tagLineIsPublic ? sanitizeText(p.profile_personal_tag_line || p.profile_personal_tagline) : "",
        email: emailIsPublic ? sanitizeText(apiUser?.user_email) : "",
        phoneNumber: phoneIsPublic ? sanitizeText(p.profile_personal_phone_number) : "",
        profileImage: imageIsPublic ? sanitizeText(p.profile_personal_image ? String(p.profile_personal_image) : "") : "",
        city: locationIsPublic ? sanitizeText(p.profile_personal_city || "") : "",
        state: locationIsPublic ? sanitizeText(p.profile_personal_state || "") : "",
        locationIsPublic: p.profile_personal_city_is_public === 1 || p.profile_personal_state_is_public === 1,
        // Include visibility flags for MiniCard
        tagLineIsPublic,
        emailIsPublic,
        phoneIsPublic,
        imageIsPublic,
        locationIsPublic,
      };

      setUserProfileData(publicData);
      // Set QR code to redirect to /newconnection/{profile_uid}
      // Always use production domain so QR codes work for anyone who scans them
      // When opened in the EveryCircle app, deep linking will navigate to NewConnection screen
      const qrUrl = `https://everycircle.com/newconnection/${profileUID}`;
      console.log("🔗 QR Code Redirect URL:", qrUrl);
      setQrCodeData(qrUrl);
    } catch (error) {
      console.error("Error fetching user profile for QR code:", error);
    }
  };

  // Create vCard format (standard contact card format that QR scanners recognize)
  const createVCard = (data) => {
    const lines = ["BEGIN:VCARD", "VERSION:3.0"];

    // Name (required)
    const fullName = `${data.firstName} ${data.lastName}`.trim();
    if (fullName) {
      lines.push(`FN:${fullName}`);
      lines.push(`N:${data.lastName || ""};${data.firstName || ""};;;`);
    }

    // Organization/Title (using tagLine)
    if (data.tagLine) {
      lines.push(`ORG:${escapeVCardValue(data.tagLine)}`);
    }

    // Location (city, state)
    if (data.city || data.state) {
      lines.push(`ADR;TYPE=home:;;${data.city || ""};${data.state || ""};;;`);
    }

    // Email
    if (data.email) {
      lines.push(`EMAIL:${data.email}`);
    }

    // Phone
    if (data.phoneNumber) {
      // Remove any non-digit characters for phone
      const phone = data.phoneNumber.replace(/\D/g, "");
      lines.push(`TEL:${phone}`);
    }

    // Profile UID as a note
    if (data.profile_uid) {
      lines.push(`NOTE:Profile ID: ${data.profile_uid}`);
    }

    // User UID (the 110 number) as a note - important for identifying the user
    if (data.user_uid) {
      lines.push(`NOTE:User ID: ${data.user_uid}`);
    }

    // Profile Image URL (if available)
    if (data.profileImage) {
      lines.push(`PHOTO;TYPE=URL:${data.profileImage}`);
    }

    lines.push("END:VCARD");
    return lines.join("\n");
  };

  // Escape special characters in vCard values
  const escapeVCardValue = (value) => {
    if (!value) return "";
    return String(value).replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
  };

  // Update graph HTML when network data or view mode changes (for web)
  useEffect(() => {
    if (Platform.OS === "web" && viewMode === "graph" && networkData.length > 0 && profileUid) {
      const html = generateVisHTML(networkData, profileUid || "YOU");
      setGraphHtml(html);
    }
  }, [viewMode, networkData, profileUid]);

  // Create/update iframe element for web
  useEffect(() => {
    if (Platform.OS === "web" && viewMode === "graph" && graphHtml && iframeContainerRef.current && typeof document !== "undefined") {
      const container = iframeContainerRef.current;
      // Get the actual DOM element (in React Native Web, ref.current is the DOM element)
      const domElement = container;
      if (domElement && domElement.nodeName) {
        // Clear existing iframe
        while (domElement.firstChild) {
          domElement.removeChild(domElement.firstChild);
        }
        // Create new iframe
        const iframe = document.createElement("iframe");
        iframe.setAttribute("srcDoc", graphHtml);
        iframe.setAttribute("title", "Network Graph");
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        domElement.appendChild(iframe);
      }
    }

    // Cleanup function
    return () => {
      if (Platform.OS === "web" && iframeContainerRef.current && typeof document !== "undefined") {
        const domElement = iframeContainerRef.current;
        if (domElement && domElement.nodeName) {
          while (domElement.firstChild) {
            domElement.removeChild(domElement.firstChild);
          }
        }
      }
    };
  }, [graphHtml, viewMode]);

  const groupByDegree = (data) => {
    const grouped = {};
    data.forEach((item) => {
      const deg = Number(item.degree) || 0;
      if (!grouped[deg]) grouped[deg] = [];
      grouped[deg].push(item);
    });
    return grouped;
  };

  const pluckMiniCardFields = (apiUser) => {
    const p = apiUser?.personal_info || {};
    return {
      firstName: sanitizeText(p.profile_personal_first_name),
      lastName: sanitizeText(p.profile_personal_last_name),
      tagLine: sanitizeText(p.profile_personal_tag_line || p.profile_personal_tagline),
      city: sanitizeText(p.profile_personal_city || ""),
      state: sanitizeText(p.profile_personal_state || ""),
      email: sanitizeText(apiUser?.user_email),
      phoneNumber: sanitizeText(p.profile_personal_phone_number),
      profileImage: sanitizeText(p.profile_personal_image ? String(p.profile_personal_image) : ""),
    };
  };

  const getParentUid = (n) => {
    if (!n) return null;
    const tryJsonArray = (val) => {
      try {
        const arr = typeof val === "string" ? JSON.parse(val) : val;
        return Array.isArray(arr) && arr.length >= 2 ? arr[arr.length - 2] : null;
      } catch {
        return null;
      }
    };
    return (
      n.parent_uid ||
      n.via_uid ||
      n.source_uid ||
      n.connection_uid ||
      (Array.isArray(n.path) ? (n.path.length >= 2 ? n.path[n.path.length - 2] : null) : null) ||
      tryJsonArray(n.path) ||
      tryJsonArray(n.connection_path) ||
      null
    );
  };

  const fetchNetwork = async (overrideProfileUid = null, overrideDegree = null) => {
    console.log("🔘 Fetch Network");
    setActiveView("connections");

    try {
      // Get UID from AsyncStorage or use override
      //overrideProfileUid is the UID passed in, if any
      let uid = overrideProfileUid; //if uid provided use it, if not get from AsyncStorage
      if (!uid) {
        // No override uid, get from AsyncStorage
        try {
          const directUid = await AsyncStorage.getItem("profile_uid"); //getting uid from AsyncStorage
          if (directUid) {
            //directUid is the uid stored in AsyncStorage under "profile_uid"
            try {
              const parsed = JSON.parse(directUid); //try to parse it in case it's stored as JSON
              uid = typeof parsed === "string" ? parsed : String(parsed); //ensure it's a string
            } catch (e) {
              //not JSON, use as string
              uid = String(directUid).trim();
            }
          } else {
            uid = profileUid;
          }
        } catch (e) {
          uid = profileUid;
        }
      }

      uid = String(uid || "").trim();
      const deg = String(overrideDegree || degree || "1").trim(); //degree passed in or from last selected degree state or a default one

      if (!uid) {
        //final check for uid
        throw new Error("No profile UID available");
      }

      console.log("Fetching for UID:", uid, "Degree:", deg); //log final uid and degree being used

      // CORS handling for web
      const fetchOptions =
        Platform.OS === "web"
          ? {
              method: "GET",
              mode: "cors",
              credentials: "omit",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              cache: "no-cache",
            }
          : {
              method: "GET",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
            };

      const response = await fetch(`${API_BASE_URL}/api/network/${uid}/${deg}`, fetchOptions); //fetching network data from API

      if (!response.ok) {
        //check for HTTP errors
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json(); //parse JSON response
      console.log("✅ Received", data.length, "connections");
      console.log("✅ Sample data:", data[0]);

      // Format data - backend now has ALL fields, no need for additional API calls
      const formatted = data.map((node) => ({
        ...node,
        __mc: {
          firstName: sanitizeText(node.profile_personal_first_name || ""),
          lastName: sanitizeText(node.profile_personal_last_name || ""),
          tagLine: sanitizeText(node.profile_personal_tag_line || ""),
          city: sanitizeText(node.profile_personal_city || ""),
          state: sanitizeText(node.profile_personal_state || ""),
          phoneNumber: sanitizeText(node.profile_personal_phone_number || ""),
          profileImage: sanitizeText(node.profile_personal_image || ""),
          relationship: node.circle_relationship || null,
          emailIsPublic: node.profile_personal_email_is_public === 1,
          phoneIsPublic: node.profile_personal_phone_number_is_public === 1,
          tagLineIsPublic: node.profile_personal_tag_line_is_public === 1,
          locationIsPublic: node.profile_personal_location_is_public === 1,
          imageIsPublic: node.profile_personal_image_is_public === 1,
          personal_info: {
            profile_personal_first_name: sanitizeText(node.profile_personal_first_name || ""),
            profile_personal_last_name: sanitizeText(node.profile_personal_last_name || ""),
            profile_personal_tag_line: sanitizeText(node.profile_personal_tag_line || ""),
            profile_personal_phone_number: sanitizeText(node.profile_personal_phone_number || ""),
            profile_personal_image: sanitizeText(node.profile_personal_image || ""),
            profile_personal_email_is_public: node.profile_personal_email_is_public || 0,
            profile_personal_phone_number_is_public: node.profile_personal_phone_number_is_public || 0,
            profile_personal_tag_line_is_public: node.profile_personal_tag_line_is_public || 0,
            profile_personal_image_is_public: node.profile_personal_image_is_public || 0,
          },
        },
      }));

      console.log("✅ Formatted sample:", formatted[0]);

      // Update state
      setNetworkData(formatted);
      setGroupedNetwork(groupByDegree(formatted));

      // Save for asyncStorage
      try {
        await AsyncStorage.setItem("network_data", JSON.stringify(formatted)); //saving raw formatted data
        await AsyncStorage.setItem("network_grouped", JSON.stringify(groupByDegree(formatted))); //saving grouped data
      } catch (e) {
        console.error("❌ Error saving network data:", e);
      }
    } catch (err) {
      console.error("❌ Fetch failed:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCircle = async () => {
    console.log("🔘 Fetch Circle");
    setActiveView("circles");

    try {
      setLoading(true);
      setError(null);

      // Get UID from AsyncStorage
      let uid = null;
      try {
        const directUid = await AsyncStorage.getItem("profile_uid");
        if (directUid) {
          try {
            const parsed = JSON.parse(directUid);
            uid = typeof parsed === "string" ? parsed : String(parsed);
          } catch (e) {
            uid = String(directUid).trim();
          }
        } else {
          uid = profileUid;
        }
      } catch (e) {
        uid = profileUid;
      }

      uid = String(uid || "").trim();

      if (!uid) {
        throw new Error("No profile UID available");
      }

      console.log("Fetching circles for UID:", uid);

      // CORS handling for web
      const fetchOptions =
        Platform.OS === "web"
          ? {
              method: "GET",
              mode: "cors",
              credentials: "omit",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              cache: "no-cache",
            }
          : {
              method: "GET",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
            };

      // Fetch circles for the user
      const response = await fetch(`${CIRCLES_ENDPOINT}/${uid}`, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log("✅ Received circles response:", result);

      // Check if result has data array
      if (result && result.data && Array.isArray(result.data)) {
        const circles = result.data;
        console.log("✅ Received", circles.length, "circles");

        // For circles, we need to fetch profile info for each circle_related_person_id
        const formatted = await Promise.all(
          circles.map(async (circle) => {
            try {
              // Fetch profile info for the related person
              const profileResponse = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${circle.circle_related_person_id}`);
              if (profileResponse.ok) {
                const apiUser = await profileResponse.json();
                const p = apiUser?.personal_info || {};
                return {
                  ...circle,
                  __mc: {
                    firstName: sanitizeText(p.profile_personal_first_name || ""),
                    lastName: sanitizeText(p.profile_personal_last_name || ""),
                    tagLine: sanitizeText(p.profile_personal_tag_line || p.profile_personal_tagline || ""),
                    city: sanitizeText(p.profile_personal_city || ""),
                    state: sanitizeText(p.profile_personal_state || ""),
                    phoneNumber: sanitizeText(p.profile_personal_phone_number || ""),
                    profileImage: sanitizeText(p.profile_personal_image ? String(p.profile_personal_image) : ""),
                    relationship: circle.circle_relationship || null,
                    emailIsPublic: p.profile_personal_email_is_public === 1,
                    phoneIsPublic: p.profile_personal_phone_number_is_public === 1,
                    tagLineIsPublic: p.profile_personal_tag_line_is_public === 1 || p.profile_personal_tagline_is_public === 1,
                    locationIsPublic: p.profile_personal_location_is_public === 1,
                    imageIsPublic: p.profile_personal_image_is_public === 1,
                    personal_info: {
                      profile_personal_first_name: sanitizeText(p.profile_personal_first_name || ""),
                      profile_personal_last_name: sanitizeText(p.profile_personal_last_name || ""),
                      profile_personal_tag_line: sanitizeText(p.profile_personal_tag_line || ""),
                      profile_personal_phone_number: sanitizeText(p.profile_personal_phone_number || ""),
                      profile_personal_image: sanitizeText(p.profile_personal_image || ""),
                      profile_personal_email_is_public: p.profile_personal_email_is_public || 0,
                      profile_personal_phone_number_is_public: p.profile_personal_phone_number_is_public || 0,
                      profile_personal_tag_line_is_public: p.profile_personal_tag_line_is_public || 0,
                      profile_personal_image_is_public: p.profile_personal_image_is_public || 0,
                    },
                  },
                  network_profile_personal_uid: circle.circle_related_person_id,
                };
              }
            } catch (err) {
              console.error(`Error fetching profile for circle ${circle.circle_related_person_id}:`, err);
            }
            // Return circle data even if profile fetch fails
            return {
              ...circle,
              __mc: {
                firstName: "",
                lastName: "",
                tagLine: "",
                relationship: circle.circle_relationship || null,
              },
              network_profile_personal_uid: circle.circle_related_person_id,
            };
          })
        );

        // Update state with circles data
        setNetworkData(formatted);
        setGroupedNetwork({ 1: formatted }); // Group all circles as degree 1
        setError(null);
      } else {
        // No circles found or empty response
        setNetworkData([]);
        setGroupedNetwork({});
        setError(null);
      }
    } catch (err) {
      console.error("Error fetching circles:", err);
      setError(err.message || "Failed to fetch circles");
      setNetworkData([]);
      setGroupedNetwork({});
    } finally {
      setLoading(false);
    }
  };

  const degreeLabel = (deg) => {
    if (deg === 1) return "1st-Degree Connections";
    if (deg === 2) return "2nd-Degree Connections";
    if (deg === 3) return "3rd-Degree Connections";
    return `${deg}-Degree Connections`;
  };

  /** ✅ Build vis-network HTML (hierarchical layout by degree) */
  const generateVisHTML = (data, youId) => {
    console.log("🔷 generateVisHTML called with:");
    console.log("  - youId:", youId);
    console.log("  - data length:", data.length);
    console.log(
      "  - data sample (first 3):",
      JSON.stringify(
        data.slice(0, 3).map((n) => ({
          network_profile_personal_uid: n.network_profile_personal_uid,
          profile_personal_uid: n.profile_personal_uid,
          target_uid: n.target_uid,
          degree: n.degree,
          parent_uid: n.parent_uid,
          via_uid: n.via_uid,
          source_uid: n.source_uid,
          connection_uid: n.connection_uid,
        })),
        null,
        2
      )
    );

    // Get user's profile image if available
    const userImage = userProfileData?.profileImage || "";
    const hasUserImage = userImage && String(userImage).trim() !== "";

    // Calculate base size for other nodes (max of image nodes or dot nodes)
    const otherNodeSizes = data.map((n) => {
      const img = n.__mc?.personal_info?.profile_personal_image || n.__mc?.profileImage || n.profile_image || "";
      const hasImg = img && String(img).trim() !== "";
      return hasImg ? 18 : 10;
    });
    const maxOtherSize = otherNodeSizes.length > 0 ? Math.max(...otherNodeSizes) : 18;

    // User's node should be 150% of the max other node size
    const userNodeSize = Math.round(maxOtherSize * 1.5);

    const nodes = [
      {
        id: youId || "YOU",
        label: "You",
        shape: hasUserImage ? "circularImage" : "dot",
        image: hasUserImage ? userImage : undefined,
        size: userNodeSize,
        borderWidth: 2,
        color: hasUserImage ? undefined : { border: "#444444", background: "#b894ff" },
        font: { color: "#ffffff", size: 10 },
        level: 0,
      },
    ];

    const allUids = new Set([youId]);
    data.forEach((n) => allUids.add(n.network_profile_personal_uid));

    data.forEach((n) => {
      const name = n.__mc?.personal_info?.profile_personal_first_name || n.__mc?.firstName || "";
      const last = n.__mc?.personal_info?.profile_personal_last_name || n.__mc?.lastName || "";
      const label = [name, last].filter(Boolean).join(" ") || (n.network_profile_personal_uid ? n.network_profile_personal_uid.slice(-3) : "???");

      const img = n.__mc?.personal_info?.profile_personal_image || n.__mc?.profileImage || n.profile_image || "";

      const hasImg = img && String(img).trim() !== "";

      nodes.push({
        id: n.network_profile_personal_uid,
        label,
        shape: hasImg ? "circularImage" : "dot",
        image: hasImg ? img : undefined,
        size: hasImg ? 18 : 10,
        color: hasImg ? undefined : { border: "#FFFFFF", background: "#e9d4ff" },
        font: { size: 11, color: "#444" },
        level: Number(n.degree) || 1,
      });
    });

    const edges = [];
    console.log("🔷 Building edges...");
    data.forEach((n) => {
      const deg = Number(n.degree) || 1;
      const nodeUid = n.network_profile_personal_uid;
      console.log(`\n  Processing node ${nodeUid} (degree ${deg}):`, {
        profile_personal_referred_by: n.profile_personal_referred_by,
        profile_personal_uid: n.profile_personal_uid,
        target_uid: n.target_uid,
        parent_uid: n.parent_uid,
        via_uid: n.via_uid,
      });

      let parent = null;

      // HIGHEST PRIORITY: Use profile_personal_referred_by - this is who referred/connected this person
      if (n.profile_personal_referred_by && allUids.has(n.profile_personal_referred_by)) {
        const referredByNode = data.find((x) => x.network_profile_personal_uid === n.profile_personal_referred_by);
        if (referredByNode) {
          const referredByDeg = Number(referredByNode.degree) || 1;
          // For degree 1, the referrer should be YOU or in degree 1
          // For degree > 1, the referrer should be in degree-1
          if (deg === 1) {
            if (n.profile_personal_referred_by === youId || referredByDeg === 1) {
              parent = n.profile_personal_referred_by;
              console.log(`    ✅ Found parent via profile_personal_referred_by (degree 1): ${parent}`);
            }
          } else if (referredByDeg === deg - 1) {
            parent = n.profile_personal_referred_by;
            console.log(`    ✅ Found parent via profile_personal_referred_by (${parent} is in degree ${referredByDeg}): ${parent}`);
          } else {
            console.log(`    ⚠️ profile_personal_referred_by ${n.profile_personal_referred_by} exists but is degree ${referredByDeg}, not ${deg - 1}`);
          }
        } else if (n.profile_personal_referred_by === youId) {
          // If referrer is YOU, use it directly
          parent = youId;
          console.log(`    ✅ Found parent via profile_personal_referred_by (YOU): ${parent}`);
        }
      }

      // Fallback: try getParentUid (checks parent_uid, via_uid, etc.)
      if (!parent) {
        try {
          const p = getParentUid(n);
          if (p && allUids.has(p)) {
            parent = p;
            console.log(`    ✅ Found parent via getParentUid: ${parent}`);
          }
        } catch (e) {
          console.log(`    ❌ Error in getParentUid:`, e);
        }
      }

      // Fallback: Check if this node's profile_personal_uid or target_uid points to a valid parent
      if (!parent && (n.profile_personal_uid || n.target_uid)) {
        const directParentUid = n.profile_personal_uid || n.target_uid;
        if (allUids.has(directParentUid)) {
          const parentNode = data.find((x) => x.network_profile_personal_uid === directParentUid);
          if (parentNode) {
            const parentDeg = Number(parentNode.degree) || 1;
            if (deg === 1) {
              if (directParentUid === youId || parentDeg === 1) {
                parent = directParentUid;
                console.log(`    ✅ Found parent via profile_personal_uid/target_uid (degree 1): ${parent}`);
              }
            } else if (parentDeg === deg - 1) {
              parent = directParentUid;
              console.log(`    ✅ Found parent via profile_personal_uid/target_uid (${directParentUid} is in degree ${parentDeg}): ${parent}`);
            }
          }
        }
      }

      // For degree > 1, if still no parent, try reverse lookup
      // Find a node in degree-1 that has this node's UID as its profile_personal_uid or target_uid
      if (!parent && deg > 1) {
        const connectingNode = data.find((x) => {
          const xDeg = Number(x.degree) || 1;
          const connectsToThisNode = x.profile_personal_uid === nodeUid || x.target_uid === nodeUid;
          const isPreviousDegree = xDeg === deg - 1;
          return connectsToThisNode && isPreviousDegree;
        });

        if (connectingNode && allUids.has(connectingNode.network_profile_personal_uid)) {
          parent = connectingNode.network_profile_personal_uid;
          console.log(`    ✅ Found parent via reverse lookup (node ${parent} connects to ${nodeUid}): ${parent}`);
        }
      }

      // For degree 1, connect to YOU if no parent found
      if (!parent && deg === 1) {
        parent = youId || "YOU";
        console.log(`    ✅ Connecting to YOU (degree 1, no parent found)`);
      }

      // Last resort for degree > 1: find any node with degree-1
      if (!parent && deg > 1) {
        const fallbackParent = data.find((x) => Number(x.degree) === deg - 1);
        if (fallbackParent && allUids.has(fallbackParent.network_profile_personal_uid)) {
          parent = fallbackParent.network_profile_personal_uid;
          console.log(`    ⚠️ Using fallback parent (first degree-1 node): ${parent}`);
        } else {
          parent = youId || "YOU";
          console.log(`    ⚠️ No parent found, connecting to YOU`);
        }
      }

      if (parent) {
        console.log(`  ✅ Edge: ${parent} -> ${nodeUid} (degree ${deg})`);
        edges.push({
          from: parent,
          to: nodeUid,
          color: { color: deg === 1 ? "#bbbbbb" : "#cccccc" },
          width: deg === 1 ? 3 : 2,
          smooth: true,
        });
      }
    });

    console.log("🔷 Total edges created:", edges.length);
    console.log(
      "🔷 Edges:",
      JSON.stringify(
        edges.map((e) => `${e.from} -> ${e.to}`),
        null,
        2
      )
    );

    const payload = { nodes, edges };

    // For web, we need to handle message passing differently
    const messageHandler =
      Platform.OS === "web"
        ? `window.addEventListener('message', function(event) {
          if (event.data && event.data.type === 'nodeClick') {
            window.parent.postMessage({ type: 'nodeClick', uid: event.data.uid }, '*');
          }
        });`
        : "";

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<style>
  html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:#ffffff; }
  #mynetwork { width:100%; height:100%; background:#ffffff; }
</style>
<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
</head>
<body>
  <div id="mynetwork"></div>
  <script>
    (function() {
      const data = ${JSON.stringify(payload)};
      const container = document.getElementById('mynetwork');

      const options = {
        layout: {
          improvedLayout: true,
          randomSeed: 58  // for consistent layout
        },
        physics: {
          enabled: true,
          solver: "repulsion",
          repulsion: {
            nodeDistance: 180,     // controls how far apart the rings are
            centralGravity: 0.3,
            springLength: 100,
            springConstant: 0.02,
            damping: 0.15
          },
          stabilization: {
            iterations: 200,
            updateInterval: 25
          }
        },

        edges: {
          color: '#cccccc',
          width: 0.5,
          smooth: { enabled: true, type: 'continuous', roundness: 0.3 }
        },
        interaction: {
          hover: true,
          zoomView: true,
          dragView: true,
          dragNodes: true
        }
      };

      const network = new vis.Network(container, data, options);

      network.once('stabilizationIterationsDone', () => {
        network.fit({ animation: { duration: 200 }});
      });

      network.on('click', function(params) {
        if (params && params.nodes && params.nodes.length > 0) {
          const id = params.nodes[0];
          ${
            Platform.OS === "web"
              ? `window.parent.postMessage({ type: 'nodeClick', uid: String(id) }, '*');`
              : `if (id && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(String(id));
          }`
          }
        }
      });

      window.addEventListener('resize', () => {
        network.fit({ animation: false });
      });
    })();
  </script>
</body>
</html>
`;
  };

  // Handle iframe message for web
  useEffect(() => {
    if (Platform.OS === "web") {
      const handleMessage = (event) => {
        // In production, you should validate event.origin for security
        if (event.data && event.data.type === "nodeClick") {
          const uid = event.data.uid;
          if (uid && uid !== (profileUid || "YOU")) {
            navigation.navigate("Profile", {
              profile_uid: uid,
              returnTo: "Network",
            });
          }
        }
      };

      window.addEventListener("message", handleMessage);
      return () => {
        window.removeEventListener("message", handleMessage);
      };
    }
  }, [navigation, profileUid]);

  // Debug: Log render start
  if (__DEV__) {
    console.log("🔵 NetworkScreen - RENDER START");
    console.log("🔵 NetworkScreen - profileUid:", profileUid, "type:", typeof profileUid);
    console.log("🔵 NetworkScreen - storageData length:", storageData.length);
    console.log("🔵 NetworkScreen - networkData length:", networkData.length);
    console.log("🔵 NetworkScreen - groupedNetwork keys:", Object.keys(groupedNetwork));
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (Platform.OS === "web" && (showLocationDropdown || showEventDropdown)) {
      const handleClickOutside = () => {
        setShowLocationDropdown(false);
        setShowEventDropdown(false);
      };

      // Small delay to prevent immediate closure
      const timer = setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener("click", handleClickOutside);
      };
    }
  }, [showLocationDropdown, showEventDropdown]);

  return (
    <View style={[styles.pageContainer, darkMode && styles.darkPageContainer]}>
      {/* Header */}
      {/* <AppHeader title='Connect' backgroundColor='#AF52DE' /> */}
      <TouchableOpacity onPress={() => setShowFeedbackPopup(true)} activeOpacity={0.7}>
        <AppHeader title='Connect' {...getHeaderColors("network")} />
      </TouchableOpacity>

      <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
        <ScrollView
          style={[styles.scrollContainer, darkMode && styles.darkScrollContainer]}
          contentContainerStyle={{ padding: 10, paddingBottom: 120 }}
          keyboardShouldPersistTaps='handled'
          showsVerticalScrollIndicator
          nestedScrollEnabled={true}
        >
          {/* QR Code Section */}
          {(() => {
            if (__DEV__) console.log("🔵 NetworkScreen - Rendering QR Code Section");
            if (qrCodeData && userProfileData && QRCodeComponent) {
              if (__DEV__) console.log("🔵 NetworkScreen - QR Code data exists, rendering QR section");
              return (
                <View style={[styles.qrCodeContainer, darkMode && styles.darkQrCodeContainer]}>
                  <Text style={[styles.qrCodeTitle, darkMode && styles.darkQrCodeTitle]}>My Contact QR Code</Text>
                  <Text style={[styles.qrCodeSubtitle, darkMode && styles.darkQrCodeSubtitle]}>Let others scan this to share your public contact information</Text>
                  <View style={[styles.qrCodeWrapper, darkMode && styles.darkQrCodeWrapper]}>
                    <QRCodeComponent value={qrCodeData} size={200} color={darkMode ? "#ffffff" : "#000000"} backgroundColor={darkMode ? "#1a1a1a" : "#ffffff"} />
                  </View>

                  {/* Display MiniCard showing what information will be transferred */}
                  {(() => {
                    if (__DEV__) console.log("🔵 NetworkScreen - Rendering QR MiniCard, userProfileData:", userProfileData);
                    if (userProfileData) {
                      return (
                        <View style={styles.qrCodeMiniCardContainer}>
                          <MiniCard user={userProfileData} />
                        </View>
                      );
                    }
                    return null;
                  })()}
                </View>
              );
            }
            if (__DEV__) console.log("🔵 NetworkScreen - QR Code section not rendered (missing data)");
            return null;
          })()}

          {(() => {
            if (__DEV__) console.log("🔵 NetworkScreen - Rendering AsyncStorage Section");
            return (
              <View>
                <View style={styles.sectionTitleRow}>
                  <Text style={[styles.sectionTitle, darkMode && styles.darkSectionTitle]}>AsyncStorage Contents:</Text>
                  <TouchableOpacity
                    onPress={() => {
                      const newValue = !showAsyncStorage;
                      console.log("👁️ Toggling AsyncStorage visibility from", showAsyncStorage, "to", newValue);
                      setShowAsyncStorage(newValue);
                    }}
                    style={styles.eyeIconButton}
                  >
                    <Ionicons name={showAsyncStorage ? "eye" : "eye-off"} size={20} color={darkMode ? "#ffffff" : "#333"} />
                  </TouchableOpacity>
                </View>
                {(() => {
                  if (__DEV__) console.log("🔵 NetworkScreen - showAsyncStorage:", showAsyncStorage);
                  if (showAsyncStorage) {
                    if (__DEV__) console.log("🔵 NetworkScreen - Rendering AsyncStorage data, length:", storageData.length);
                    return (
                      <>
                        {storageData.length === 0 ? (
                          <Text style={[styles.noDataText, darkMode && styles.darkNoDataText]}>No data in AsyncStorage.</Text>
                        ) : (
                          storageData
                            .map(([key, value], idx) => {
                              if (__DEV__) console.log(`🔵 NetworkScreen - Processing AsyncStorage item ${idx}:`, { key, value, keyType: typeof key, valueType: typeof value });
                              const sanitizedKey = sanitizeText(key, "Unknown");
                              const sanitizedValue = sanitizeText(value, "N/A");
                              if (__DEV__) console.log(`🔵 NetworkScreen - After sanitization ${idx}:`, { sanitizedKey, sanitizedValue });
                              if (!isSafeForConditional(sanitizedKey) && !isSafeForConditional(sanitizedValue)) {
                                if (__DEV__) console.log(`🔵 NetworkScreen - Skipping item ${idx} (unsafe)`);
                                return null;
                              }
                              return (
                                <View key={key} style={{ marginBottom: 8 }}>
                                  {isSafeForConditional(sanitizedKey) && <Text style={[styles.keyText, darkMode && styles.darkKeyText]}>{sanitizedKey}:</Text>}
                                  {isSafeForConditional(sanitizedValue) && <Text style={[styles.valueText, darkMode && styles.darkValueText]}>{sanitizedValue}</Text>}
                                </View>
                              );
                            })
                            .filter(Boolean)
                        )}
                      </>
                    );
                  }
                  return null;
                })()}
              </View>
            );
          })()}

          {(() => {
            if (__DEV__) console.log("🔵 NetworkScreen - Rendering Network Section");
            if (__DEV__) console.log("🔵 NetworkScreen - profileUid for title:", profileUid, "type:", typeof profileUid);
            const titleSuffix = profileUid ? ` (${profileUid})` : "";
            if (__DEV__) console.log("🔵 NetworkScreen - titleSuffix:", titleSuffix);
            return (
              <View style={{ marginTop: 20 }}>
                <Text style={[styles.sectionTitle, darkMode && styles.darkSectionTitle]}>My Network{titleSuffix}</Text>

                <View style={styles.networkControlsRow}>
                  <Text style={[styles.networkControlLabel, darkMode && styles.darkNetworkControlLabel]}>Levels to Display:</Text>
                  <WebTextInput
                    style={[styles.networkInput, darkMode && styles.darkNetworkInput]}
                    value={degree}
                    onChangeText={setDegree}
                    placeholder='1'
                    keyboardType='numeric'
                    inputMode={Platform.OS === "web" ? "numeric" : undefined}
                  />
                  <TouchableOpacity
                    style={[styles.fetchButton, activeView === "connections" ? styles.fetchButtonActive : styles.fetchButtonInactive]}
                    onPress={() => {
                      setActiveView("connections");
                      fetchNetwork();
                    }}
                  >
                    <Text style={styles.fetchButtonText}>Show Connections</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.fetchButton, activeView === "circles" ? styles.fetchButtonActive : styles.fetchButtonInactive]}
                    onPress={() => {
                      setActiveView("circles");
                      fetchCircle();
                    }}
                  >
                    <Text style={styles.fetchButtonText}>Show Circle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setViewMode(viewMode === "list" ? "graph" : "list")} style={styles.toggleButton}>
                    <Text style={styles.toggleButtonText}>{viewMode === "list" ? "View as Graph" : "View as List"}</Text>
                  </TouchableOpacity>
                </View>

                {loading && <ActivityIndicator size='large' color='#AF52DE' />}
                {error && <Text style={[styles.errorText, darkMode && styles.darkErrorText]}>{error}</Text>}

                {viewMode === "graph" && networkData.length > 0 && (
                  <View
                    style={{
                      height: 400,
                      borderRadius: 10,
                      overflow: "hidden",
                      borderWidth: 0,
                    }}
                  >
                    {Platform.OS === "web" ? (
                      // Web: Use iframe via ref
                      graphHtml ? (
                        <View
                          ref={iframeContainerRef}
                          style={{
                            width: "100%",
                            height: "100%",
                          }}
                        />
                      ) : (
                        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                          <ActivityIndicator size='large' color='#AF52DE' />
                          <Text style={[styles.loadingText, darkMode && styles.darkLoadingText]}>Loading graph view...</Text>
                        </View>
                      )
                    ) : WebViewComponent ? (
                      // Native: Use WebView
                      <WebViewComponent
                        originWhitelist={["*"]}
                        source={{ html: generateVisHTML(networkData, profileUid || "YOU") }}
                        onMessage={(event) => {
                          const uid = event?.nativeEvent?.data;
                          if (uid && uid !== (profileUid || "YOU")) {
                            navigation.navigate("Profile", {
                              profile_uid: uid,
                              returnTo: "Network",
                            });
                          }
                        }}
                        javaScriptEnabled
                        domStorageEnabled
                        automaticallyAdjustContentInsets
                        allowsInlineMediaPlayback
                        androidLayerType={Platform.OS === "android" ? "hardware" : "none"}
                      />
                    ) : (
                      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
                        <Text style={[styles.errorText, darkMode && styles.darkErrorText, { textAlign: "center", marginBottom: 10 }]}>
                          WebView is not available. The native module needs to be linked.
                        </Text>
                        <Text style={[styles.helperText, darkMode && styles.darkHelperText, { textAlign: "center", marginTop: 5 }]}>
                          To fix: Run {"\n"}
                          npx expo prebuild --clean{"\n"}
                          npx expo run:android
                        </Text>
                        <Text style={[styles.helperText, darkMode && styles.darkHelperText, { textAlign: "center", marginTop: 5, fontSize: 10 }]}>(or run:ios for iOS)</Text>
                      </View>
                    )}
                  </View>
                )}

                {(() => {
                  if (__DEV__) console.log("🔵 NetworkScreen - Checking list view mode");
                  if (viewMode === "list" && Object.keys(groupedNetwork).length > 0) {
                    if (__DEV__) console.log("🔵 NetworkScreen - Rendering list view, groupedNetwork keys:", Object.keys(groupedNetwork));
                    return (
                      <View style={{ marginTop: 10 }}>
                        {/* Filter Buttons */}
                        {(() => {
                          if (__DEV__) console.log("🔵 NetworkScreen - Rendering filter buttons");
                          return (
                            <View style={styles.filterContainer}>
                              <TouchableOpacity
                                style={[
                                  styles.filterButton,
                                  relationshipFilter !== "All" && styles.filterButtonActive,
                                  darkMode && styles.darkFilterButton,
                                  relationshipFilter !== "All" && darkMode && styles.darkFilterButtonActive,
                                ]}
                                onPress={() => {
                                  const filters = ["All", "Colleagues", "Friends", "Family"];
                                  const currentIndex = filters.indexOf(relationshipFilter);
                                  const nextIndex = (currentIndex + 1) % filters.length;
                                  setRelationshipFilter(filters[nextIndex]);
                                }}
                              >
                                <Text
                                  style={[
                                    styles.filterButtonText,
                                    relationshipFilter !== "All" && styles.filterButtonTextActive,
                                    darkMode && styles.darkFilterButtonText,
                                    relationshipFilter !== "All" && darkMode && styles.darkFilterButtonTextActive,
                                  ]}
                                >
                                  {relationshipFilter === "All" ? "Relationship" : relationshipFilter}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.filterButton,
                                  dateFilter !== "All" && styles.filterButtonActive,
                                  darkMode && styles.darkFilterButton,
                                  dateFilter !== "All" && darkMode && styles.darkFilterButtonActive,
                                ]}
                                onPress={() => {
                                  const filters = ["All", "This Week", "This Month", "This Year"];
                                  const currentIndex = filters.indexOf(dateFilter);
                                  const nextIndex = (currentIndex + 1) % filters.length;
                                  setDateFilter(filters[nextIndex]);
                                }}
                              >
                                <Text
                                  style={[
                                    styles.filterButtonText,
                                    dateFilter !== "All" && styles.filterButtonTextActive,
                                    darkMode && styles.darkFilterButtonText,
                                    dateFilter !== "All" && darkMode && styles.darkFilterButtonTextActive,
                                  ]}
                                >
                                  {dateFilter === "All" ? "Date" : dateFilter}
                                </Text>
                              </TouchableOpacity>
                              <View style={styles.dropdownContainer}>
                                <TouchableOpacity
                                  style={[
                                    styles.filterButton,
                                    locationFilter !== "All" && styles.filterButtonActive,
                                    darkMode && styles.darkFilterButton,
                                    locationFilter !== "All" && darkMode && styles.darkFilterButtonActive,
                                  ]}
                                  onPress={() => {
                                    setShowLocationDropdown(!showLocationDropdown);
                                    setShowEventDropdown(false); // Close event dropdown
                                  }}
                                >
                                  <Text
                                    style={[
                                      styles.filterButtonText,
                                      locationFilter !== "All" && styles.filterButtonTextActive,
                                      darkMode && styles.darkFilterButtonText,
                                      locationFilter !== "All" && darkMode && styles.darkFilterButtonTextActive,
                                    ]}
                                  >
                                    {locationFilter === "All" ? "Location" : locationFilter}
                                  </Text>
                                </TouchableOpacity>
                                {showLocationDropdown && (
                                  <ScrollView style={[styles.dropdownMenu, darkMode && styles.darkDropdownMenu]}>
                                    {["All", "Same City", "Same State", "Other"].map((option) => (
                                      <TouchableOpacity
                                        key={option}
                                        style={[
                                          styles.dropdownItem,
                                          darkMode && styles.darkDropdownItem,
                                          locationFilter === option && styles.dropdownItemSelected,
                                          locationFilter === option && darkMode && styles.darkDropdownItemSelected,
                                        ]}
                                        onPress={() => {
                                          setLocationFilter(option);
                                          setShowLocationDropdown(false);
                                        }}
                                      >
                                        <Text style={[styles.dropdownItemText, darkMode && styles.darkDropdownItemText]}>
                                          {option}
                                        </Text>
                                      </TouchableOpacity>
                                    ))}
                                  </ScrollView>
                                )}
                              </View>
                              <View style={styles.dropdownContainer}>
                                <TouchableOpacity
                                  style={[
                                    styles.filterButton,
                                    eventFilter !== "All" && styles.filterButtonActive,
                                    darkMode && styles.darkFilterButton,
                                    eventFilter !== "All" && darkMode && styles.darkFilterButtonActive,
                                    availableEvents.length === 0 && styles.filterButtonDisabled,
                                  ]}
                                  onPress={() => {
                                    if (availableEvents.length === 0) return;
                                    setShowEventDropdown(!showEventDropdown);
                                    setShowLocationDropdown(false); // Close location dropdown
                                  }}
                                  disabled={availableEvents.length === 0}
                                >
                                  <Text
                                    style={[
                                      styles.filterButtonText,
                                      eventFilter !== "All" && styles.filterButtonTextActive,
                                      darkMode && styles.darkFilterButtonText,
                                      eventFilter !== "All" && darkMode && styles.darkFilterButtonTextActive,
                                      availableEvents.length === 0 && styles.filterButtonTextDisabled,
                                    ]}
                                  >
                                    {eventFilter === "All" ? "Event" : eventFilter}
                                  </Text>
                                </TouchableOpacity>
                                {showEventDropdown && availableEvents.length > 0 && (
                                  <ScrollView style={[styles.dropdownMenu, darkMode && styles.darkDropdownMenu]}>
                                    <TouchableOpacity
                                      style={[
                                        styles.dropdownItem,
                                        darkMode && styles.darkDropdownItem,
                                        eventFilter === "All" && styles.dropdownItemSelected,
                                        eventFilter === "All" && darkMode && styles.darkDropdownItemSelected,
                                      ]}
                                      onPress={() => {
                                        setEventFilter("All");
                                        setShowEventDropdown(false);
                                      }}
                                    >
                                      <Text style={[styles.dropdownItemText, darkMode && styles.darkDropdownItemText]}>
                                        All
                                      </Text>
                                    </TouchableOpacity>
                                    {availableEvents.map((event) => (
                                      <TouchableOpacity
                                        key={event}
                                        style={[
                                          styles.dropdownItem,
                                          darkMode && styles.darkDropdownItem,
                                          eventFilter === event && styles.dropdownItemSelected,
                                          eventFilter === event && darkMode && styles.darkDropdownItemSelected,
                                        ]}
                                        onPress={() => {
                                          setEventFilter(event);
                                          setShowEventDropdown(false);
                                        }}
                                      >
                                        <Text style={[styles.dropdownItemText, darkMode && styles.darkDropdownItemText]}>
                                          {event}
                                        </Text>
                                      </TouchableOpacity>
                                    ))}
                                  </ScrollView>
                                )}
                              </View>
                            </View>
                          );
                        })()}

                        {(() => {
                          if (__DEV__) console.log("🔵 NetworkScreen - Rendering network list items");
                          return Object.keys(groupedNetwork)
                            .map((d) => Number(d))
                            .sort((a, b) => a - b)
                            .map((deg) => {
                              if (__DEV__) console.log(`🔵 NetworkScreen - Processing degree ${deg}`);
                              // Filter the list based on relationship type
                              let list = groupedNetwork[deg];
                              if (relationshipFilter !== "All") {
                                list = list.filter((node) => {
                                  const relationship = node.circle_relationship;
                                  if (relationshipFilter === "Colleagues") {
                                    return relationship === "colleague";
                                  } else if (relationshipFilter === "Friends") {
                                    return relationship === "friend";
                                  } else if (relationshipFilter === "Family") {
                                    return relationship === "family";
                                  }
                                  return true;
                                });
                              }

                              // Apply date filter
                              if (dateFilter !== "All") {
                                console.log(`🔵 NetworkScreen - Applying date filter: ${dateFilter}`);
                                const now = new Date();
                                const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                                const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                                const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

                                list = list.filter((node) => {
                                  // Get the circle date - this could be circle_date or another date field
                                  const circleDateStr = node.circle_date || node.profile_personal_joined_timestamp;
                                  
                                  if (!circleDateStr) {
                                    // If no date, exclude from filtered results
                                    return false;
                                  }

                                  try {
                                    const circleDate = new Date(circleDateStr);
                                    
                                    if (dateFilter === "This Week") {
                                      return circleDate >= oneWeekAgo;
                                    } else if (dateFilter === "This Month") {
                                      return circleDate >= oneMonthAgo;
                                    } else if (dateFilter === "This Year") {
                                      return circleDate >= oneYearAgo;
                                    }
                                  } catch (e) {
                                    console.error("Error parsing date:", circleDateStr, e);
                                    return false;
                                  }
                                  
                                  return true;
                                });
                              }

                              // Apply location filter
                              if (locationFilter !== "All") {
                                console.log(`🔵 NetworkScreen - Applying location filter: ${locationFilter}`);
                                // Get current user's location
                                const userCity = userProfileData?.city?.toLowerCase().trim() || "";
                                const userState = userProfileData?.state?.toLowerCase().trim() || "";

                                list = list.filter((node) => {
                                  // Get node's location
                                  const nodeCity = (node.profile_personal_city || node.__mc?.city || "").toLowerCase().trim();
                                  const nodeState = (node.profile_personal_state || node.__mc?.state || "").toLowerCase().trim();

                                  if (locationFilter === "Same City") {
                                    // Must have both city values and they must match
                                    return userCity && nodeCity && userCity === nodeCity;
                                  } else if (locationFilter === "Same State") {
                                    // Must have both state values and they must match
                                    return userState && nodeState && userState === nodeState;
                                  } else if (locationFilter === "Other") {
                                    // Different state or no location data
                                    return !userState || !nodeState || userState !== nodeState;
                                  }
                                  
                                  return true;
                                });
                              }

                              //Apply event filter
                              if (eventFilter !== "All") {
                                console.log(`🔵 NetworkScreen - Applying event filter: ${eventFilter}`);
                              list = list.filter((node) => {
                                const nodeEvent = (node.circle_event || "").trim();
                                return nodeEvent === eventFilter;
                              });
                            }

                              if (list.length === 0) {
                                if (__DEV__) console.log(`🔵 NetworkScreen - Degree ${deg} has no items after filtering`);
                                return null; // Don't render degree section if no items after filtering
                              }

                              if (__DEV__) console.log(`🔵 NetworkScreen - Rendering degree ${deg} with ${list.length} items`);
                              return (
                                <View key={deg} style={{ marginBottom: 20 }}>
                                  {(() => {
                                    const label = degreeLabel(Number(deg));
                                    if (__DEV__) console.log(`🔵 NetworkScreen - Degree ${deg} label:`, label);
                                    return <Text style={[styles.degreeHeader, darkMode && styles.darkDegreeHeader]}>{label}</Text>;
                                  })()}

                                  {list.map((node, index) => {
                                    if (__DEV__) console.log(`🔵 NetworkScreen - Rendering node ${deg}-${index}, __mc:`, node.__mc);
                                    // Data is already sanitized when __mc is created, but double-check
                                    if (!node.__mc) {
                                      if (__DEV__) console.log(`🔵 NetworkScreen - Node ${deg}-${index} has no __mc, skipping`);
                                      return null;
                                    }
                                    if (__DEV__) console.log(`🔵 NetworkScreen - Rendering MiniCard for node ${deg}-${index}`);
                                    return (
                                      <TouchableOpacity
                                        key={`${deg}-${index}`}
                                        onPress={() =>
                                          navigation.navigate("Profile", {
                                            profile_uid: node.network_profile_personal_uid,
                                            returnTo: "Network",
                                          })
                                        }
                                        style={{ marginVertical: 6 }}
                                      >
                                        <MiniCard user={node.__mc} showRelationship={true} />
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              );
                            });
                        })()}
                      </View>
                    );
                  }
                  return null;
                })()}

                {(() => {
                  if (__DEV__) console.log("🔵 NetworkScreen - Rendering 'No connections' message");
                  if (!loading && !error && Object.keys(groupedNetwork).length === 0) {
                    return <Text style={[styles.noDataText, darkMode && styles.darkNoDataText]}>No network connections found.</Text>;
                  }
                  return null;
                })()}
              </View>
            );
          })()}
        </ScrollView>

        <BottomNavBar navigation={navigation} />
      </SafeAreaView>
      <FeedbackPopup visible={showFeedbackPopup} onClose={() => setShowFeedbackPopup(false)} pageName='Network' instructions={networkFeedbackInstructions} questions={networkFeedbackQuestions} />
    </View>
  );
};

const styles = StyleSheet.create({
  pageContainer: { flex: 1, backgroundColor: "#fff" },
  safeArea: { flex: 1 },
  scrollContainer: { flex: 1 },
  darkScrollContainer: { backgroundColor: "#1a1a1a" },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: { fontWeight: "bold", fontSize: 16, color: "#333" },
  eyeIconButton: {
    padding: 4,
  },
  keyText: { fontWeight: "bold", color: "#333" },
  valueText: { color: "#555", fontSize: 13 },
  inputRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
  },
  networkControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    flexWrap: "wrap",
    gap: 8,
  },
  networkControlLabel: {
    fontSize: 14,
    color: "#333",
    marginRight: 8,
  },
  darkNetworkControlLabel: {
    color: "#cccccc",
  },
  networkInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    width: 35,
    textAlign: "center",
    backgroundColor: "#fff",
    ...(Platform.OS === "web" &&
      {
        // Web-specific styles are handled in WebTextInput component
      }),
  },
  darkNetworkInput: {
    backgroundColor: "#444",
    color: "#fff",
    borderColor: "#666",
  },
  fetchButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  fetchButtonActive: {
    backgroundColor: "#2434C2", // Blue color like Connect header
  },
  fetchButtonInactive: {
    backgroundColor: "#AF52DE", // Purple color
  },
  fetchButtonText: { color: "#fff", fontWeight: "600" },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 12,
  },
  toggleButton: {
    backgroundColor: "#AF52DE",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  toggleButtonText: { color: "#fff", fontWeight: "600" },
  degreeHeader: { fontWeight: "700", fontSize: 15, color: "#6b46c1", marginBottom: 6 },
  noDataText: { color: "#888" },
  errorText: { color: "red", marginTop: 8 },
  darkPageContainer: { backgroundColor: "#1a1a1a" },
  darkSafeArea: { backgroundColor: "#1a1a1a" },
  darkHeader: { color: "#fff" },
  darkSectionTitle: { color: "#ccc" },
  darkKeyText: { color: "#ccc" },
  darkValueText: { color: "#aaa" },
  darkNoDataText: { color: "#888" },
  darkDegreeHeader: { color: "#a78bfa" },
  darkErrorText: { color: "#f87171" },
  loadingText: { color: "#666", marginTop: 10 },
  darkLoadingText: { color: "#aaa" },
  helperText: { color: "#888", fontSize: 12, marginTop: 5 },
  darkHelperText: { color: "#999" },
  qrCodeContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  darkQrCodeContainer: {
    backgroundColor: "#2d2d2d",
  },
  qrCodeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  darkQrCodeTitle: {
    color: "#ffffff",
  },
  qrCodeSubtitle: {
    fontSize: 12,
    color: "#666",
    marginBottom: 15,
    textAlign: "center",
  },
  darkQrCodeSubtitle: {
    color: "#aaa",
  },
  qrCodeWrapper: {
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 10,
  },
  darkQrCodeWrapper: {
    backgroundColor: "#1a1a1a",
  },
  qrCodeInfo: {
    marginTop: 10,
    alignItems: "center",
  },
  qrCodeInfoText: {
    fontSize: 18,
    color: "#333",
    marginBottom: 4,
  },
  darkQrCodeInfoText: {
    color: "#cccccc",
  },
  qrCodeMiniCardContainer: {
    marginTop: 15,
    width: "100%",
  },
  filterContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 15,
    gap: 8,
    zIndex: 9998,
  },
  filterButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 100,
    alignItems: "center",
  },
  filterButtonActive: {
    backgroundColor: "#2434C2",
    borderColor: "#2434C2",
  },
  filterButtonDisabled: {
    opacity: 0.5,
  },
  filterButtonText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  filterButtonTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  filterButtonTextDisabled: {
    color: "#999",
  },
  darkFilterButton: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  darkFilterButtonActive: {
    backgroundColor: "#AF52DE",
    borderColor: "#AF52DE",
  },
  darkFilterButtonDisabled: {
    opacity: 0.5,
  },
  darkFilterButtonText: {
    color: "#cccccc",
  },
  darkFilterButtonTextActive: {
    color: "#fff",
  },
  darkFilterButtonTextDisabled: {
    color: "#666",
  },
  dropdownContainer: {
    position: "relative",
    zIndex: 9999,
  },
  dropdownMenu: {
    position: "absolute",
    top: 40,
    left: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    minWidth: 150,
    maxHeight: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10, 
    zIndex: 10000,
  },
  darkDropdownMenu: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  darkDropdownItem: {
    borderBottomColor: "#404040",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#333",
  },
  darkDropdownItemText: {
    color: "#cccccc",
  },
  dropdownItemSelected: {
    backgroundColor: "#f0f0f0",
  },
  darkDropdownItemSelected: {
    backgroundColor: "#404040",
  },
});

export default NetworkScreen;
