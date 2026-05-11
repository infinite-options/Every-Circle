// NetworkScreen.js - Web-compatible version
import React, { useEffect, useState, useRef, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Platform, Switch, InteractionManager, Image, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useUnread } from "../contexts/UnreadContext";
import { useFocusEffect } from "@react-navigation/native";
import { API_BASE_URL, USER_PROFILE_INFO_ENDPOINT, CIRCLES_ENDPOINT, CHAT_CONVERSATIONS_ENDPOINT, NEARBY_USERS_ENDPOINT, PROFILE_VIEWS_ENDPOINT } from "../apiConfig";
import MiniCard from "../components/MiniCard";
import WebTextInput from "../components/WebTextInput";
import { sanitizeText, isSafeForConditional } from "../utils/textSanitizer";

import FeedbackPopup from "../components/FeedbackPopup";
import ReferralSearch from "../components/ReferralSearch";
import ScannedProfilePopup from "../components/ScannedProfilePopup";
import { getHeaderColors, getHeaderColor } from "../config/headerColors";
import { SHOW_NETWORK_DEBUG_UI, SETTINGS_NETWORK_DEBUG_MODE_KEY } from "../config/networkDebug";
import { createAblyRealtimeClient, getAblyTokenObscuredIfStillValid, markAblyTokenNoLongerActive } from "../utils/ablyClient";
import { getSessionProfile } from "../utils/sessionProfile";
import { normalizeConversationsResponse } from "../utils/chatConversations";

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

/** Short label for filter dropdown button when value is long (e.g. notes). */
function formatFilterButtonLabel(value) {
  if (value == null || value === "All") return "All";
  const s = String(value);
  return s.length > 28 ? `${s.slice(0, 28)}…` : s;
}

/** One filter field: opens its own list (replaces multi-column “Filter Connections” popup). */
function ConnectionFilterModal({ visible, title, options, selected, onSelect, onClose, darkMode }) {
  const accent = "#535db7";
  const bg = darkMode ? "#1e1e2e" : "#ffffff";
  const borderColor = darkMode ? "#3a3a5c" : "#e0e4f7";
  const labelColor = darkMode ? "#a0a8d0" : "#5060a0";
  const textColor = darkMode ? "#e8eaf6" : "#1a1a2e";

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
      <TouchableOpacity style={connectionFilterModalStyles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={[connectionFilterModalStyles.sheet, { backgroundColor: bg, borderColor }]}>
          <View style={[connectionFilterModalStyles.header, { borderBottomColor: borderColor, backgroundColor: darkMode ? "#252538" : "#f0f2ff" }]}>
            <Text style={[connectionFilterModalStyles.headerTitle, { color: textColor }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }} accessibilityRole='button' accessibilityLabel='Close'>
              <Ionicons name='close-circle' size={26} color={darkMode ? "#7880c0" : "#8890c8"} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps='handled'>
            {options.map((opt, idx) => {
              const isActive = selected === opt;
              const rowLabel = opt === "All" ? "All" : opt.length > 120 ? `${opt.slice(0, 120)}…` : opt;
              return (
                <TouchableOpacity
                  key={`conn-filter-${idx}-${opt.length}`}
                  onPress={() => {
                    onSelect(opt);
                    onClose();
                  }}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: borderColor,
                    backgroundColor: isActive ? accent : "transparent",
                  }}
                >
                  <Text style={{ fontSize: 14, color: isActive ? "#fff" : textColor, fontWeight: isActive ? "700" : "400" }} numberOfLines={opt === "All" ? 1 : 4}>
                    {rowLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={{ fontSize: 12, color: labelColor, padding: 12, textAlign: "center" }}>Tap a row to apply</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const RELATIONSHIP_FILTER_OPTIONS = ["All", "Colleagues", "Friends", "Family"];
const DATE_FILTER_OPTIONS = ["All", "This Week", "This Month", "This Year"];

const connectionFilterModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  sheet: {
    borderRadius: 16,
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    flex: 1,
    paddingRight: 8,
  },
});

const NetworkScreen = ({ navigation }) => {
  const { darkMode } = useDarkMode();
  const { clearUnread } = useUnread();
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
  const [qrCodeDataObject, setQrCodeDataObject] = useState(null); // Store parsed QR code data object for display
  /** Ably `connection.state` and `Channel.state` (exact strings from the SDK) */
  const [ablyConnectionStatus, setAblyConnectionStatus] = useState("—");
  const [ablyChannelStatus, setAblyChannelStatus] = useState("—");
  /** Channel name this screen subscribed to, e.g. /110-000016 */
  const [ablyListeningChannel, setAblyListeningChannel] = useState("");
  /** `null` = no active token for display; string = obscured credential from Ably auth. */
  const [ablyTokenObscured, setAblyTokenObscured] = useState(null);
  const [ablyMessageReceived, setAblyMessageReceived] = useState(null); // Store Ably message received info: { channel, message, timestamp }
  const ablyNewConnectionHandlerRef = useRef(null);
  const ablyAnyMessageHandlerRef = useRef(null);
  const ablyNetworkChannelRef = useRef(null);
  const ablyStateSyncCleanupRef = useRef(null);
  const [formSwitchEnabled, setFormSwitchEnabled] = useState(false); // Form Switch: show form when others scan your QR code
  const formSwitchEnabledRef = React.useRef(false); // Ref to track current value for Ably callback
  const [showDebugBlocks, setShowDebugBlocks] = useState(false); // Toggle visibility of QR Code Contains and Ably Messages Received blocks
  const [settingsDebugModeEnabled, setSettingsDebugModeEnabled] = useState(false); // Settings → Debug Mode (requires SHOW_NETWORK_DEBUG_UI)
  const [showAsyncStorage, setShowAsyncStorage] = useState(false);
  const [relationshipFilter, setRelationshipFilter] = useState("All"); // All, Colleagues, Friends, Family
  const [dateFilter, setDateFilter] = useState("All"); // All, This Week, This Month, This Year
  const [locationFilter, setLocationFilter] = useState("All");
  const [eventFilter, setEventFilter] = useState("All");
  const [availableEvents, setAvailableEvents] = useState([]);
  const [availableCities, setAvailableCities] = useState([]);
  const [notesFilter, setNotesFilter] = useState("All");
  const [introducedByFilter, setIntroducedByFilter] = useState("All");
  const [availableNotes, setAvailableNotes] = useState([]);
  const [availableIntroducedBy, setAvailableIntroducedBy] = useState([]);
  /** Which single filter list is open: relationship | date | location | event | notes | introduced */
  const [filterModalKind, setFilterModalKind] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [graphHtml, setGraphHtml] = useState(""); // For web iframe
  const iframeContainerRef = React.useRef(null); // Ref for web iframe container
  const [activeView, setActiveView] = useState("connections"); // "connections" or "circles" - default to connections
  const activeViewRef = React.useRef(activeView);
  activeViewRef.current = activeView;

  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);
  const [scannedProfileData, setScannedProfileData] = useState(null);
  const [showScannedProfilePopup, setShowScannedProfilePopup] = useState(false);
  const [showViewMyNetwork, setShowViewMyNetwork] = useState(true);
  /** Bumped on each screen focus so debounced fetch runs once per visit (avoids duplicate immediate refetch). */
  const [focusTick, setFocusTick] = useState(0);
  const [showMessages, setShowMessages] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);

  const [showNearby, setShowNearby] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState(null);
  const [ignoredNearbyUids, setIgnoredNearbyUids] = useState(new Set());
  const [expandedDegrees, setExpandedDegrees] = useState({}); // { [deg]: boolean } - undefined/true = expanded

  // Who Viewed My Profile
  const [profileViewers, setProfileViewers] = useState([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [showProfileViewers, setShowProfileViewers] = useState(false);
  const [viewersSelectedAccount, setViewersSelectedAccount] = useState("personal");
  const [viewerBusinesses, setViewerBusinesses] = useState([]);
  const [showViewersAccountDropdown, setShowViewersAccountDropdown] = useState(false);
  const [connectDirectlyVisible, setConnectDirectlyVisible] = useState(false);

  const fetchProfileViewers = async (accountId) => {
    try {
      setViewersLoading(true);
      const id = accountId || (await AsyncStorage.getItem("profile_uid"));
      if (!id) return;
      const response = await fetch(`${PROFILE_VIEWS_ENDPOINT}/${id}`);
      if (response.ok) {
        const data = await response.json();
        setProfileViewers(data.viewers || []);
      } else {
        setProfileViewers([]);
      }
    } catch (e) {
      console.warn("NetworkScreen - Failed to fetch viewers:", e);
      setProfileViewers([]);
    } finally {
      setViewersLoading(false);
    }
  };

  const networkFeedbackInstructions = "Instructions for Connect";

  //Define custom questions for the Network page
  const networkFeedbackQuestions = ["Connect - Question 1?", "Connect - Question 2?", "Connect - Question 3?"];

  // Load persisted Network screen settings
  const loadNetworkSettings = async () => {
    try {
      console.log("📥 Loading Network screen settings from AsyncStorage...");
      const [
        showAsyncStorageValue,
        degreeValue,
        viewModeValue,
        networkDataValue,
        groupedNetworkValue,
        activeViewValue,
        showViewMyNetworkValue,
        dateFilterValue,
        locationFilterValue,
        eventFilterValue,
        notesFilterValue,
        introducedByFilterValue,
        settingsDebugModeValue,
      ] = await Promise.all([
        AsyncStorage.getItem("network_showAsyncStorage"),
        AsyncStorage.getItem("network_degree"),
        AsyncStorage.getItem("network_viewMode"),
        AsyncStorage.getItem("network_data"),
        AsyncStorage.getItem("network_grouped"),
        AsyncStorage.getItem("network_activeView"),
        AsyncStorage.getItem("network_showViewMyNetwork"),
        AsyncStorage.getItem("network_dateFilter"),
        AsyncStorage.getItem("network_locationFilter"),
        AsyncStorage.getItem("network_eventFilter"),
        AsyncStorage.getItem("network_notesFilter"),
        AsyncStorage.getItem("network_introducedByFilter"),
        AsyncStorage.getItem(SETTINGS_NETWORK_DEBUG_MODE_KEY),
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
        console.log("📥 No persisted showAsyncStorage value, using default: false (collapsed)");
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

      if (notesFilterValue !== null) {
        setNotesFilter(notesFilterValue);
      }
      if (introducedByFilterValue !== null) {
        setIntroducedByFilter(introducedByFilterValue);
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

      if (activeViewValue === "connections" || activeViewValue === "circles") {
        console.log("📥 Loading activeView:", activeViewValue);
        setActiveView(activeViewValue);
      } else {
        console.log("📥 No persisted activeView, using default: connections");
      }

      if (showViewMyNetworkValue !== null) {
        try {
          setShowViewMyNetwork(JSON.parse(showViewMyNetworkValue) === true);
        } catch (e) {
          /* keep state */
        }
      }

      if (settingsDebugModeValue !== null) {
        try {
          setSettingsDebugModeEnabled(JSON.parse(settingsDebugModeValue) === true);
        } catch (e) {
          setSettingsDebugModeEnabled(false);
        }
      } else {
        setSettingsDebugModeEnabled(false);
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
          showViewMyNetwork,
        });
        await Promise.all([
          AsyncStorage.setItem("network_showAsyncStorage", JSON.stringify(showAsyncStorage)),
          AsyncStorage.setItem("network_degree", degree),
          AsyncStorage.setItem("network_viewMode", viewMode),
          AsyncStorage.setItem("network_showViewMyNetwork", JSON.stringify(showViewMyNetwork)),
          AsyncStorage.setItem("network_dateFilter", dateFilter),
          AsyncStorage.setItem("network_locationFilter", locationFilter),
          AsyncStorage.setItem("network_eventFilter", eventFilter),
          AsyncStorage.setItem("network_notesFilter", notesFilter),
          AsyncStorage.setItem("network_introducedByFilter", introducedByFilter),
        ]);
        console.log("✅ Network screen settings saved successfully");
      } catch (e) {
        console.error("❌ Error saving network settings:", e);
      }
    };
    saveSettings();
  }, [showAsyncStorage, degree, viewMode, showViewMyNetwork, dateFilter, locationFilter, eventFilter, notesFilter, introducedByFilter, settingsLoaded]);

  // Debounced GET /api/network: settings ready, panel open, connections view, and on focus (focusTick) or degree change.
  // useFocusEffect no longer calls fetchNetwork — avoids duplicate with this effect. activeView via ref so Circles→Connections does not schedule twice.
  useEffect(() => {
    if (!settingsLoaded || !showViewMyNetwork || activeViewRef.current !== "connections") return;
    const deg = String(degree || "").trim();
    if (!deg || Number(deg) < 1) return;

    const timer = setTimeout(() => {
      fetchNetwork(null, deg);
    }, 400);

    return () => clearTimeout(timer);
  }, [degree, settingsLoaded, showViewMyNetwork, focusTick]);

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

  // Extract unique cities from circle data
  useEffect(() => {
    if (networkData && networkData.length > 0) {
      const locations = new Set();
      networkData.forEach((node) => {
        const city = node.circle_city || "";
        const state = node.circle_state || "";

        // Create location string
        if (city && state) {
          locations.add(`${city.trim()}, ${state.trim()}`);
        } else if (city) {
          locations.add(city.trim());
        } else if (state) {
          locations.add(state.trim());
        }
      });
      const sortedLocations = Array.from(locations).sort();
      setAvailableCities(sortedLocations);
      console.log("📋 Available locations:", sortedLocations);
    } else {
      setAvailableCities([]);
    }
  }, [networkData]);

  // Unique circle_note / circle_introduced_by values for filters 7–8
  useEffect(() => {
    if (networkData && networkData.length > 0) {
      const notes = new Set();
      const intros = new Set();
      networkData.forEach((node) => {
        const n = (node.circle_note || "").trim();
        if (n) notes.add(n);
        const i = (node.circle_introduced_by || "").trim();
        if (i) intros.add(i);
      });
      setAvailableNotes(Array.from(notes).sort());
      setAvailableIntroducedBy(Array.from(intros).sort());
    } else {
      setAvailableNotes([]);
      setAvailableIntroducedBy([]);
    }
  }, [networkData]);

  const noteOptionsForModal = useMemo(() => {
    const s = new Set(availableNotes);
    if (notesFilter !== "All") s.add(notesFilter);
    return ["All", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [availableNotes, notesFilter]);

  const introducedOptionsForModal = useMemo(() => {
    const s = new Set(availableIntroducedBy);
    if (introducedByFilter !== "All") s.add(introducedByFilter);
    return ["All", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [availableIntroducedBy, introducedByFilter]);

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
            // Load businesses for "Who Viewed My Profile" account switcher
            try {
              const profRes = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${uid}`);
              if (profRes.ok) {
                const profJson = await profRes.json();
                const bizList = profJson.business_info ? (typeof profJson.business_info === "string" ? JSON.parse(profJson.business_info) : profJson.business_info) : [];
                setViewerBusinesses(bizList);
              }
            } catch (e) {
              console.warn("NetworkScreen - Failed to load viewer businesses:", e);
            }
          } else {
            console.warn("⚠️ Invalid profile_uid loaded:", uid);
          }
        }

        // Load Form Switch setting
        const formSwitchSetting = await AsyncStorage.getItem("form_switch_enabled");
        if (formSwitchSetting !== null) {
          const isEnabled = formSwitchSetting === "true";
          setFormSwitchEnabled(isEnabled);
          formSwitchEnabledRef.current = isEnabled; // Update ref
          console.log("📋 Loaded form_switch_enabled from AsyncStorage:", isEnabled);
        }
      } catch (e) {
        setStorageData([["error", e.message]]);
      }
    };
    loadAsyncStorage();
  }, []);

  // Load settings when screen is focused; bump focusTick so debounced effect runs one /api/network fetch.
  useFocusEffect(
    React.useCallback(() => {
      console.log("Network screen focused - loading settings...");
      loadNetworkSettings();
      setFocusTick((t) => t + 1);

      const syncProfileUidFromStorage = async () => {
        let currentProfileUid = await AsyncStorage.getItem("profile_uid");
        if (currentProfileUid) {
          try {
            const parsed = JSON.parse(currentProfileUid);
            currentProfileUid = typeof parsed === "string" ? parsed : String(parsed);
          } catch (e) {
            currentProfileUid = String(currentProfileUid).trim();
          }
        } else {
          currentProfileUid = "";
        }
        if (currentProfileUid && currentProfileUid !== profileUid) {
          console.log("Updating profileUid from AsyncStorage:", currentProfileUid);
          setProfileUid(currentProfileUid);
        }
      };
      syncProfileUidFromStorage();
    }, []),
  );

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
          // console.log("NetworkScreen - Fetched user_uid for QR code:", userUid);
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
      // Create QR code data with EveryCircle identifier
      // Format: JSON with type identifier for app scanning, URL for web compatibility
      const qrData = {
        type: "everycircle",
        profile_uid: profileUID,
        version: "1.0",
        // Include URL for web compatibility
        url: `https://everycircle.com/newconnection/${profileUID}`,
        // Form Switch: if true, User 1 will see a form to add User 2 when they scan
        form_switch_enabled: formSwitchEnabled,
      };
      const qrDataString = JSON.stringify(qrData);
      console.log("🔗 QR Code Data:", qrDataString);
      // Store both the string (for QR code) and the object (for display)
      setQrCodeData(qrDataString);
      setQrCodeDataObject(qrData);

      // Initialize Ably channel when QR code is generated
      initializeAblyChannel(profileUID);
    } catch (error) {
      console.error("Error fetching user profile for QR code:", error);
    }
  };

  // Initialize Ably channel when QR code is generated
  const initializeAblyChannel = async (profileUid) => {
    if (!profileUid) {
      console.warn("⚠️ NetworkScreen - Cannot initialize Ably: no profile_uid");
      return;
    }

    try {
      if (ablyStateSyncCleanupRef.current) {
        try {
          ablyStateSyncCleanupRef.current();
        } catch (_) {}
        ablyStateSyncCleanupRef.current = null;
      }
      // Remove previous handlers before setting a new channel subscription.
      try {
        const prevCh = ablyNetworkChannelRef.current;
        if (prevCh) {
          if (ablyNewConnectionHandlerRef.current) {
            prevCh.unsubscribe("new-connection-opened", ablyNewConnectionHandlerRef.current);
          }
          if (ablyAnyMessageHandlerRef.current) {
            prevCh.unsubscribe(ablyAnyMessageHandlerRef.current);
          }
        }
      } catch (_) {}
      ablyNetworkChannelRef.current = null;

      // Dynamically import Ably - handle web vs native differently
      let Ably;
      const isWeb = Platform.OS === "web";

      try {
        if (isWeb) {
          // On web, try dynamic import or use Ably from window if available
          if (typeof window !== "undefined" && window.Ably) {
            Ably = window.Ably;
            // console.log("✅ NetworkScreen - Ably loaded from window.Ably (web)");
          } else {
            // Try require for web (might work with bundler)
            try {
              Ably = require("ably");
              // console.log("✅ NetworkScreen - Ably module loaded via require (web)");
            } catch (requireError) {
              // Try dynamic import for web
              console.warn("⚠️ NetworkScreen - require() failed on web, trying dynamic import");
              throw new Error("Ably package not available on web. Please install: npm install ably");
            }
          }
        } else {
          // On native, use require
          Ably = require("ably");
          // console.log("✅ NetworkScreen - Ably module loaded (native)");
        }
      } catch (e) {
        const errorMessage = e.message || String(e);
        console.warn("⚠️ NetworkScreen - Ably not available:", errorMessage);
        console.error("❌ NetworkScreen - Ably import error details:", e);
        console.error("❌ NetworkScreen - Platform:", Platform.OS);
        console.error("❌ NetworkScreen - Is Web:", isWeb);

        setAblyMessageReceived({
          channel: `/${profileUid}`,
          message: "Error: Ably module not found",
          timestamp: new Date().toISOString(),
          error: `Ably not installed or not available on ${Platform.OS}. Please run: npm install ably`,
        });
        return;
      }

      // Verify Ably is actually available
      if (!Ably || !Ably.Realtime) {
        const errorMsg = "Ably module loaded but Realtime class not found";
        console.error("❌ NetworkScreen -", errorMsg);
        setAblyMessageReceived({
          channel: `/${profileUid}`,
          message: "Error: Ably module incomplete",
          timestamp: new Date().toISOString(),
          error: errorMsg,
        });
        return;
      }

      // console.log("🔵 NetworkScreen - Initializing Ably channel for profile_uid:", profileUid);

      // Old key-based auth (kept for reference):
      // const ablyApiKey = Constants.expoConfig?.extra?.ablyApiKey || process.env.EXPO_PUBLIC_ABLY_API_KEY || EXPO_PUBLIC_ABLY_API_KEY || "";
      // if (!ablyApiKey) {
      //   console.warn("⚠️ NetworkScreen - Ably API key not configured. Please add EXPO_PUBLIC_ABLY_API_KEY to your .env file");
      //   return;
      // }
      // const client = new Ably.Realtime({ key: ablyApiKey });
      const client = createAblyRealtimeClient(profileUid, {
        onTokenObtained: (obscured) => setAblyTokenObscured(obscured),
      });

      // Create channel name using profile_uid (e.g., /110-000014)
      const channelName = `/${profileUid}`;
      setAblyListeningChannel(channelName);

      const channel = client.channels.get(channelName);
      ablyNetworkChannelRef.current = channel;

      // Mirror exact Ably `connection.state` and `Channel.state` (see ably-js ConnectionState / ChannelState)
      const onConnectionStateChange = (stateChange) => {
        const state = String(stateChange && stateChange.current != null ? stateChange.current : client.connection.state);
        if (state === "failed" || state === "closed") {
          markAblyTokenNoLongerActive();
          setAblyTokenObscured(null);
        }
        setAblyConnectionStatus(state);
      };
      const onChannelStateChange = (stateChange) => {
        setAblyChannelStatus(String(stateChange && stateChange.current != null ? stateChange.current : channel.state));
      };
      client.connection.on(onConnectionStateChange);
      channel.on(onChannelStateChange);
      setAblyConnectionStatus(String(client.connection.state));
      setAblyChannelStatus(String(channel.state));

      ablyStateSyncCleanupRef.current = () => {
        try {
          client.connection.off(onConnectionStateChange);
        } catch (_) {}
        try {
          channel.off(onChannelStateChange);
        } catch (_) {}
      };

      // Attach to channel
      console.log("🔵 NetworkScreen - Initial channel state:", channel.state);
      console.log("🔵 NetworkScreen - Attaching to channel:", channelName);

      channel.attach((err) => {
        if (err) {
          console.error("❌ NetworkScreen - Error attaching to Ably channel:", err);
        } else {
          console.log("✅ NetworkScreen - Ready to receive messages on channel:", channelName);
        }
        setAblyChannelStatus(String(channel.state));
      });

      // Subscribe to messages on this channel
      const newConnectionHandler = async (message) => {
        console.log("📨 NetworkScreen - Received message on channel:", channelName);
        // console.log("📨 NetworkScreen - Message data:", JSON.stringify(message.data, null, 2));
        // console.log("📨 NetworkScreen - Message name:", message.name);

        if (message.data && message.data.message) {
          // console.log("✅ NetworkScreen -", message.data.message);

          // Update state to display message info
          setAblyMessageReceived({
            channel: channelName,
            message: message.data.message,
            timestamp: message.data.timestamp || new Date().toISOString(),
            scanner_profile_uid: message.data.scanner_profile_uid || null,
          });

          // If Form Switch is enabled and we have User 2's profile_uid, navigate to New Connection page
          // console.log("🔵 NetworkScreen - Checking Form Switch:", formSwitchEnabledRef.current, "scanner_profile_uid:", message.data.scanner_profile_uid);
          if (formSwitchEnabledRef.current && message.data.scanner_profile_uid) {
            const scannerProfileUid = message.data.scanner_profile_uid;
            // console.log("🔵 NetworkScreen - Form Switch is ON, navigating to NewConnection page for User 2:", scannerProfileUid);
            // Defer navigation so it runs in the main React/UI context (fixes iOS where Ably callback can run before navigation is ready)
            InteractionManager.runAfterInteractions(() => {
              navigation.navigate("NewConnection", {
                profile_uid: scannerProfileUid,
                fromFormSwitch: true, // Flag to indicate this came from Form Switch
              });
            });
          } else {
            console.log("🔵 NetworkScreen - Form Switch is OFF or no scanner_profile_uid, not navigating");
          }
        } else {
          console.warn("⚠️ NetworkScreen - Message received but data structure unexpected:", message.data);
        }
      };
      ablyNewConnectionHandlerRef.current = newConnectionHandler;
      channel.subscribe("new-connection-opened", newConnectionHandler);

      // Also subscribe to all messages for debugging
      const anyMessageHandler = (message) => {
        console.log("📨 NetworkScreen - Received ANY message on channel:", channelName);
        // console.log("📨 NetworkScreen - Message name:", message.name);
        // console.log("📨 NetworkScreen - Message data:", JSON.stringify(message.data, null, 2));
      };
      ablyAnyMessageHandlerRef.current = anyMessageHandler;
      channel.subscribe(anyMessageHandler);
    } catch (error) {
      console.error("❌ NetworkScreen - Error initializing Ably:", error);
    }
  };

  // Unsubscribe and remove this screen's state listeners on unmount only (do not close shared client).
  useEffect(() => {
    return () => {
      if (ablyStateSyncCleanupRef.current) {
        try {
          ablyStateSyncCleanupRef.current();
        } catch (_) {}
        ablyStateSyncCleanupRef.current = null;
      }
      const ch = ablyNetworkChannelRef.current;
      try {
        if (ch) {
          if (ablyNewConnectionHandlerRef.current) {
            ch.unsubscribe("new-connection-opened", ablyNewConnectionHandlerRef.current);
          }
          if (ablyAnyMessageHandlerRef.current) {
            ch.unsubscribe(ablyAnyMessageHandlerRef.current);
          }
        }
      } catch (_) {}
      ablyNetworkChannelRef.current = null;
      setAblyConnectionStatus("—");
      setAblyChannelStatus("—");
      setAblyListeningChannel("");
      setAblyTokenObscured(null);
    };
  }, []);

  // Keep token row in sync when JWT `exp` passes (Ably may refresh in the background separately).
  useEffect(() => {
    if (!ablyListeningChannel) {
      return undefined;
    }
    const id = setInterval(() => {
      setAblyTokenObscured(getAblyTokenObscuredIfStillValid());
    }, 5000);
    return () => clearInterval(id);
  }, [ablyListeningChannel]);

  // Handle QR scan complete - fetch profile data and show popup
  const handleQRScanComplete = async (scanData) => {
    try {
      if (!scanData || !scanData.profile_uid) {
        console.error("Invalid scan data:", scanData);
        return;
      }

      // Fetch the profile data
      const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${scanData.profile_uid}`);
      if (!response.ok) {
        throw new Error("Profile not found");
      }
      const apiUser = await response.json();

      // Extract and sanitize profile information
      const p = apiUser?.personal_info || {};
      const tagLineIsPublic = p.profile_personal_tag_line_is_public === 1 || p.profile_personal_tagline_is_public === 1;
      const emailIsPublic = p.profile_personal_email_is_public === 1;
      const phoneIsPublic = p.profile_personal_phone_number_is_public === 1;
      const imageIsPublic = p.profile_personal_image_is_public === 1;
      const locationIsPublic = p.profile_personal_location_is_public === 1;

      const profileInfo = {
        profile_uid: scanData.profile_uid,
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

      setScannedProfileData(profileInfo);
      setShowScannedProfilePopup(true);
    } catch (error) {
      console.error("Error fetching scanned profile:", error);
      // You might want to show an error alert here
    }
  };

  // Handle adding connection from scanned profile
  const handleAddScannedConnection = async (connectionData) => {
    try {
      if (!scannedProfileData || !scannedProfileData.profile_uid) {
        return;
      }

      const loggedInProfileUID = await AsyncStorage.getItem("profile_uid");
      if (!loggedInProfileUID) {
        // Handle not logged in
        return;
      }

      if (loggedInProfileUID === scannedProfileData.profile_uid) {
        // Handle cannot add self
        return;
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const circleDate = `${year}-${month}-${day}`;

      // Handle both old format (just relationship string) and new format (object)
      const relationship = typeof connectionData === "string" ? connectionData : (connectionData?.relationship ?? null);
      const event = typeof connectionData === "object" ? connectionData.event || "" : "";
      const note = typeof connectionData === "object" ? connectionData.note || "" : "";
      const city = typeof connectionData === "object" ? connectionData.city || "" : "";
      const state = typeof connectionData === "object" ? connectionData.state || "" : "";
      const introducedBy = typeof connectionData === "object" ? connectionData.introducedBy || "" : "";

      // Calculate circle_num_nodes
      let circleNumNodes = null;
      try {
        const pathResponse = await fetch(`${API_BASE_URL}/api/connections_path/${loggedInProfileUID}/${scannedProfileData.profile_uid}`);
        if (pathResponse.ok) {
          const pathData = await pathResponse.json();
          const combinedPath = pathData.combined_path || "";
          if (combinedPath) {
            const nodes = combinedPath.split(",").filter((n) => n.trim());
            circleNumNodes = Math.max(0, nodes.length - 2) + 1;
          }
        }
      } catch (err) {
        console.warn("Could not fetch connections_path:", err);
      }

      const requestBody = {
        circle_profile_id: loggedInProfileUID,
        circle_related_person_id: scannedProfileData.profile_uid,
        circle_relationship: relationship ?? null,
        circle_date: circleDate,
        ...(event && { circle_event: event }),
        ...(note && { circle_note: note }),
        ...(city && { circle_city: city }),
        ...(state && { circle_state: state }),
        ...(introducedBy && { circle_introduced_by: introducedBy }),
        ...(circleNumNodes !== null && { circle_num_nodes: circleNumNodes }),
      };

      const response = await fetch(CIRCLES_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        // Refresh network data by refetching
        const currentProfileUID = await AsyncStorage.getItem("profile_uid");
        const currentDegree = (await AsyncStorage.getItem("network_degree")) || "2";
        if (currentProfileUID) {
          fetchNetwork(currentProfileUID, currentDegree);
        }
        setShowScannedProfilePopup(false);
        setScannedProfileData(null);
        // You might want to show a success message here
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add connection");
      }
    } catch (error) {
      console.error("Error adding scanned connection:", error);
      // You might want to show an error alert here
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

  // Update graph HTML when network data or view mode or filters change (for web)
  useEffect(() => {
    if (Platform.OS === "web" && viewMode === "graph" && networkData.length > 0 && profileUid) {
      // Apply filters before generating HTML
      let filtered = networkData;

      if (relationshipFilter !== "All") {
        filtered = filtered.filter((node) => {
          const relationship = node.circle_relationship;
          if (relationshipFilter === "Colleagues") return relationship === "colleague";
          if (relationshipFilter === "Friends") return relationship === "friend";
          if (relationshipFilter === "Family") return relationship === "family";
          return true;
        });
      }

      if (dateFilter !== "All") {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

        filtered = filtered.filter((node) => {
          const circleDateStr = node.circle_date || node.profile_personal_joined_timestamp;
          if (!circleDateStr) return false;
          try {
            const circleDate = new Date(circleDateStr);
            if (dateFilter === "This Week") return circleDate >= oneWeekAgo;
            if (dateFilter === "This Month") return circleDate >= oneMonthAgo;
            if (dateFilter === "This Year") return circleDate >= oneYearAgo;
          } catch (e) {
            return false;
          }
          return true;
        });
      }

      if (locationFilter !== "All") {
        filtered = filtered.filter((node) => {
          const city = node.circle_city || "";
          const state = node.circle_state || "";
          let nodeLocation = "";
          if (city && state) nodeLocation = `${city.trim()}, ${state.trim()}`;
          else if (city) nodeLocation = city.trim();
          else if (state) nodeLocation = state.trim();
          return nodeLocation === locationFilter;
        });
      }

      if (eventFilter !== "All") {
        filtered = filtered.filter((node) => {
          const nodeEvent = (node.circle_event || "").trim();
          return nodeEvent === eventFilter;
        });
      }

      if (notesFilter !== "All") {
        filtered = filtered.filter((node) => (node.circle_note || "").trim() === notesFilter);
      }

      if (introducedByFilter !== "All") {
        filtered = filtered.filter((node) => (node.circle_introduced_by || "").trim() === introducedByFilter);
      }

      // SEARCH FILTER RIGHT HERE
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter((node) => {
          const searchableText = [
            node.__mc?.firstName || "",
            node.__mc?.lastName || "",
            node.__mc?.tagLine || "",
            node.__mc?.city || "",
            node.__mc?.state || "",
            node.__mc?.phoneNumber || "",
            node.circle_event || "",
            node.circle_note || "",
            node.circle_introduced_by || "",
            node.circle_relationship || "",
            node.network_profile_personal_uid || "",
          ]
            .join(" ")
            .toLowerCase();

          return searchableText.includes(query);
        });
      }

      const html = generateVisHTML(filtered, profileUid || "YOU");
      setGraphHtml(html);
    }
  }, [viewMode, networkData, profileUid, relationshipFilter, dateFilter, locationFilter, eventFilter, notesFilter, introducedByFilter, searchQuery]);

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
    // Keep current viewMode (list or graph) so user stays on View as Graph if they switched Network
    setRelationshipFilter("All");
    setDateFilter("All");
    setLocationFilter("All");
    setEventFilter("All");
    setNotesFilter("All");
    setIntroducedByFilter("All");
    setLoading(true);
    setError(null);

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

      console.log("Fetching for UID:", uid, "Level:", deg); //log final uid and degree being used

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
      // console.log("✅ Received", data.length, "connections");
      // console.log("✅ Sample data:", data[0]);

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

      // console.log("✅ Formatted sample:", formatted[0]);

      // Update state
      setNetworkData(formatted);
      setGroupedNetwork(groupByDegree(formatted));
      // console.log("🟢 groupedNetwork keys:", Object.keys(groupByDegree(formatted)));
      // console.log("🟢 formatted length:", formatted.length);
      // console.log("🟢 formatted[0].__mc:", formatted[0]?.__mc);

      // Save for asyncStorage
      try {
        await AsyncStorage.setItem("network_data", JSON.stringify(formatted)); //saving raw formatted data
        await AsyncStorage.setItem("network_grouped", JSON.stringify(groupByDegree(formatted))); //saving grouped data
        await AsyncStorage.setItem("network_activeView", "connections");
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
    // console.log("🔘 Fetch Circle");
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

      // console.log("Fetching circles for UID:", uid);

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
      // console.log("✅ Received circles response:", result);

      // Check if result has data array
      if (result && result.data && Array.isArray(result.data)) {
        const circles = result.data;
        // console.log("✅ Received", circles.length, "circles");

        // Circles payload includes profile fields per row — no N+1 profile requests
        const formatted = circles.map((circle) => {
          const p = circle;
          const tagLineRaw = p.profile_personal_tag_line || p.profile_personal_tagline || "";
          const emailRaw = p.user_email_id ?? p.user_email ?? "";
          return {
            ...circle,
            degree: 1,
            __mc: {
              firstName: sanitizeText(p.profile_personal_first_name || ""),
              lastName: sanitizeText(p.profile_personal_last_name || ""),
              tagLine: sanitizeText(tagLineRaw || ""),
              city: sanitizeText(p.profile_personal_city || ""),
              state: sanitizeText(p.profile_personal_state || ""),
              email: sanitizeText(emailRaw || ""),
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
                profile_personal_tag_line: sanitizeText(tagLineRaw || ""),
                profile_personal_tagline: sanitizeText(tagLineRaw || ""),
                profile_personal_phone_number: sanitizeText(p.profile_personal_phone_number || ""),
                profile_personal_image: sanitizeText(p.profile_personal_image || ""),
                profile_personal_city: sanitizeText(p.profile_personal_city || ""),
                profile_personal_state: sanitizeText(p.profile_personal_state || ""),
                profile_personal_email_is_public: p.profile_personal_email_is_public || 0,
                profile_personal_phone_number_is_public: p.profile_personal_phone_number_is_public || 0,
                profile_personal_tag_line_is_public: p.profile_personal_tag_line_is_public || p.profile_personal_tagline_is_public || 0,
                profile_personal_image_is_public: p.profile_personal_image_is_public || 0,
                profile_personal_location_is_public: p.profile_personal_location_is_public || 0,
              },
            },
            network_profile_personal_uid: circle.circle_related_person_id || circle.profile_personal_uid,
          };
        });

        // Update state with circles data
        setNetworkData(formatted);
        setGroupedNetwork({ 1: formatted }); // Group all circles as degree 1
        setError(null);

        // Save circles data and activeView for persistence (so View as Graph shows correct data on reload)
        try {
          await AsyncStorage.setItem("network_data", JSON.stringify(formatted));
          await AsyncStorage.setItem("network_grouped", JSON.stringify({ 1: formatted }));
          await AsyncStorage.setItem("network_activeView", "circles");
        } catch (e) {
          console.error("❌ Error saving circles data:", e);
        }
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
    if (deg === 1) return "1st-Level Connections";
    if (deg === 2) return "2nd-Level Connections";
    if (deg === 3) return "3rd-Level Connections";
    return `${deg}-Level Connections`;
  };

  /** ✅ Build vis-network HTML (hierarchical layout by degree) */
  const generateVisHTML = (data, youId) => {
    // console.log("🔷 generateVisHTML called with:");
    // console.log("  - youId:", youId);
    // console.log("  - data length:", data.length);
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
        2,
      ),
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

    // Current user: red circle (border + fill); image nodes get a red ring via border
    const userNodeColor = { border: "#b71c1c", background: "#e53935" };

    const nodes = [
      {
        id: youId || "YOU",
        label: "You",
        shape: hasUserImage ? "circularImage" : "dot",
        image: hasUserImage ? userImage : undefined,
        size: userNodeSize,
        borderWidth: hasUserImage ? 3 : 2,
        color: userNodeColor,
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
    // console.log("🔷 Building edges...");
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
      if (n.profile_personal_referred_by && n.profile_personal_referred_by !== nodeUid && allUids.has(n.profile_personal_referred_by)) {
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
      // Circle API rows set profile_personal_uid to the *contact* (same as network_profile_personal_uid).
      // Treating that as "parent" sets parent === nodeUid (self-loop) and breaks vis-network layout
      // (image vs ring misalignment, missing-looking edges). Connections rows use these as real parent refs.
      if (!parent && (n.profile_personal_uid || n.target_uid)) {
        const directParentUid = n.profile_personal_uid || n.target_uid;
        if (directParentUid !== nodeUid && allUids.has(directParentUid)) {
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
        2,
      ),
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
    // console.log("🔵 NetworkScreen - profileUid:", profileUid, "type:", typeof profileUid);
    // console.log("🔵 NetworkScreen - storageData length:", storageData.length);
    // console.log("🔵 NetworkScreen - networkData length:", networkData.length);
    // console.log("🔵 NetworkScreen - groupedNetwork keys:", Object.keys(groupedNetwork));
  }

  // Apply filters to network data for graph view
  let filteredNetworkData = networkData;

  // Apply relationship filter
  if (relationshipFilter !== "All") {
    filteredNetworkData = filteredNetworkData.filter((node) => {
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
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    filteredNetworkData = filteredNetworkData.filter((node) => {
      const circleDateStr = node.circle_date || node.profile_personal_joined_timestamp;
      if (!circleDateStr) return false;

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
        return false;
      }
      return true;
    });
  }

  // Apply location filter
  if (locationFilter !== "All") {
    filteredNetworkData = filteredNetworkData.filter((node) => {
      const city = node.circle_city || "";
      const state = node.circle_state || "";
      let nodeLocation = "";
      if (city && state) {
        nodeLocation = `${city.trim()}, ${state.trim()}`;
      } else if (city) {
        nodeLocation = city.trim();
      } else if (state) {
        nodeLocation = state.trim();
      }
      return nodeLocation === locationFilter;
    });
  }

  // Apply event filter
  if (eventFilter !== "All") {
    filteredNetworkData = filteredNetworkData.filter((node) => {
      const nodeEvent = (node.circle_event || "").trim();
      return nodeEvent === eventFilter;
    });
  }

  if (notesFilter !== "All") {
    filteredNetworkData = filteredNetworkData.filter((node) => (node.circle_note || "").trim() === notesFilter);
  }

  if (introducedByFilter !== "All") {
    filteredNetworkData = filteredNetworkData.filter((node) => (node.circle_introduced_by || "").trim() === introducedByFilter);
  }

  const NEARBY_IGNORED_KEY = "nearby_ignored_uids";
  const NEARBY_SETTINGS_KEY = "nearby_share_settings";

  const fetchNearbyUsers = async () => {
    const uid = profileUid || (await AsyncStorage.getItem("profile_uid"));
    if (!uid) return;

    // Reuse the same privacy settings that SettingsScreen persists
    let mode = "all_circles";
    try {
      const raw = await AsyncStorage.getItem(NEARBY_SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        mode = s.receiveFrom || "all_circles";
      }
    } catch (_) {}

    // Load ignored UIDs from storage
    try {
      const raw = await AsyncStorage.getItem(NEARBY_IGNORED_KEY);
      if (raw) setIgnoredNearbyUids(new Set(JSON.parse(raw)));
    } catch (_) {}

    setNearbyLoading(true);
    setNearbyError(null);
    setNearbyUsers([]);
    try {
      const res = await fetch(`${NEARBY_USERS_ENDPOINT}/${uid}?mode=${mode}`);
      const json = await res.json();
      if (json.code === 200) {
        setNearbyUsers(json.result || []);
      } else if (json.code === 410) {
        setNearbyError("Your location has expired. Update it in Settings to see who's nearby.");
      } else {
        setNearbyError(json.message || "Could not fetch nearby users.");
      }
    } catch (_) {
      setNearbyError("Network error. Please try again.");
    }
    setNearbyLoading(false);
  };

  const ignoreNearbyUser = async (uid) => {
    const next = new Set(ignoredNearbyUids);
    next.add(uid);
    setIgnoredNearbyUids(next);
    try {
      await AsyncStorage.setItem(NEARBY_IGNORED_KEY, JSON.stringify([...next]));
    } catch (_) {}
  };

  const unignoreNearbyUser = async (uid) => {
    const next = new Set(ignoredNearbyUids);
    next.delete(uid);
    setIgnoredNearbyUids(next);
    try {
      await AsyncStorage.setItem(NEARBY_IGNORED_KEY, JSON.stringify([...next]));
    } catch (_) {}
  };

  const fetchConversations = async () => {
    const session = await getSessionProfile();
    const uid = (profileUid || session?.profileUid || (await AsyncStorage.getItem("profile_uid")) || "").trim();
    if (!uid) return;
    setConversationsLoading(true);
    try {
      const res = await fetch(`${CHAT_CONVERSATIONS_ENDPOINT}/${encodeURIComponent(uid)}`);
      const json = await res.json();
      setConversations(normalizeConversationsResponse(json, uid));
    } catch (_) {
      setConversations([]);
    }
    setConversationsLoading(false);
  };

  const _convRelTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso.replace(" ", "T") + "Z");
    const diffMs = Date.now() - d;
    const m = Math.floor(diffMs / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <View style={[styles.pageContainer, darkMode && styles.darkPageContainer]}>
      {/* Header */}
      {/* <AppHeader title='Connect' backgroundColor='#AF52DE' /> */}
      <TouchableOpacity onPress={() => setShowFeedbackPopup(true)} activeOpacity={0.7}>
        <AppHeader title='CONNECT' {...getHeaderColors("network")} />
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
            // if (__DEV__) console.log("🔵 NetworkScreen - Rendering QR Code Section");
            if (qrCodeData && userProfileData && QRCodeComponent) {
              // if (__DEV__) console.log("🔵 NetworkScreen - QR Code data exists, rendering QR section");
              return (
                <View style={styles.qrCodeContainer}>
                  {/* Display MiniCard */}
                  {(() => {
                    // if (__DEV__) console.log("🔵 NetworkScreen - Rendering QR MiniCard, userProfileData:", userProfileData);
                    if (userProfileData) {
                      return (
                        <View style={styles.qrCodeMiniCardContainer}>
                          <MiniCard user={userProfileData} />
                        </View>
                      );
                    }
                    return null;
                  })()}

                  <Text accessibilityRole='header' style={[styles.qrCodeTitle, darkMode && styles.darkQrCodeTitle]}>
                    Connect with Me!
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 15 }}>
                    <Text style={[styles.qrCodeSubtitle, darkMode && styles.darkQrCodeSubtitle, { marginBottom: 0 }]}>SCAN My QR Code</Text>
                    {/* <TouchableOpacity
                      style={{ padding: 6 }}
                      onPress={() =>
                        navigation.navigate("QRScanner", {
                          onScanComplete: handleQRScanComplete,
                        })
                      }
                    >
                      <Ionicons name='camera-outline' size={25} color='#000' />
                    </TouchableOpacity> */}
                  </View>

                  {/* QR at original 220px; form rows wider (286px) */}
                  <View style={styles.qrCodeSectionWrapper}>
                    <View style={[styles.qrCodeWrapper, darkMode && styles.darkQrCodeWrapper]}>
                      <QRCodeComponent value={qrCodeData} size={200} color={darkMode ? "#ffffff" : "#000000"} backgroundColor={darkMode ? "#1a1a1a" : "#ffffff"} />
                    </View>

                    {/* Form Switch Toggle */}
                    <View style={[styles.formSwitchContainer, darkMode && styles.darkFormSwitchContainer]}>
                      <View style={styles.formSwitchTextContainer}>
                        {/* <Text style={[styles.formSwitchDescription, darkMode && styles.darkFormSwitchDescription]}>Automatically add user scanning my QR Code to my Circles of Influence</Text> */}
                        <Text style={[styles.formSwitchDescription, darkMode && styles.darkFormSwitchDescription]}>Exchange Contact Info</Text>
                      </View>
                      <Switch
                        value={formSwitchEnabled}
                        onValueChange={async (value) => {
                          setFormSwitchEnabled(value);
                          formSwitchEnabledRef.current = value; // Update ref
                          // Persist the setting
                          await AsyncStorage.setItem("form_switch_enabled", value ? "true" : "false");
                          console.log("🔵 NetworkScreen - Form Switch set to:", value);
                          // Update QR code with new setting
                          if (profileUid) {
                            fetchUserProfileForQR(profileUid);
                          }
                        }}
                        trackColor={{ false: "#767577", true: "rgba(36, 52, 194, 0.5)" }}
                        thumbColor={formSwitchEnabled ? getHeaderColor("network") : "#f4f3f4"}
                        ios_backgroundColor='#767577'
                        activeThumbColor={getHeaderColor("network")}
                        activeTrackColor='rgba(36, 52, 194, 0.5)'
                        accessibilityRole='switch'
                        accessibilitylabel='Exchange contact info'
                        accessibilityHint='Turns contact info exchange on or off when someone scans your QR code'
                        accessibilityState={{ checked: formSwitchEnabled }}
                      />
                    </View>

                    {/* Scan Other's QR Code Button */}
                    <TouchableOpacity
                      style={[styles.formSwitchContainer, darkMode && styles.darkFormSwitchContainer]}
                      onPress={() =>
                        navigation.navigate("QRScanner", {
                          onScanComplete: handleQRScanComplete,
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <View style={styles.formSwitchTextContainer}>
                        <Text style={[styles.formSwitchDescription, darkMode && styles.darkFormSwitchDescription]}>Scan Other's QR Code</Text>
                      </View>
                      <Ionicons name='camera-outline' size={28} color={darkMode ? "#ffffff" : "#000000"} />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.formSwitchContainer, darkMode && styles.darkFormSwitchContainer]} onPress={() => setConnectDirectlyVisible(true)} activeOpacity={0.7}>
                      <View style={styles.formSwitchTextContainer}>
                        <Text style={[styles.formSwitchDescription, darkMode && styles.darkFormSwitchDescription]}>Connect Directly</Text>
                      </View>
                      <Ionicons name='person-add-outline' size={28} color={darkMode ? "#ffffff" : "#000000"} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }
            // if (__DEV__) console.log("🔵 NetworkScreen - QR Code section not rendered (missing data)");
            return null;
          })()}

          {(() => {
            // if (__DEV__) console.log("🔵 NetworkScreen - Rendering Network Section");
            return (
              <View style={{ marginTop: 20 }}>
                {/* View My Network Dropdown Header */}
                <TouchableOpacity
                  style={[styles.viewMyNetworkHeader, darkMode && styles.darkViewMyNetworkHeader]}
                  onPress={() => {
                    const willExpand = !showViewMyNetwork;
                    setShowViewMyNetwork(willExpand);
                    if (willExpand) {
                      setDegree("3");
                      setViewMode("list");
                      setActiveView("connections");
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.viewMyNetworkHeaderText, darkMode && styles.darkViewMyNetworkHeaderText]}>View My Network</Text>
                  <Ionicons name={showViewMyNetwork ? "chevron-up" : "chevron-down"} size={24} color={darkMode ? "#e0e0e0" : "#333"} />
                </TouchableOpacity>

                {showViewMyNetwork && (
                  <>
                    {/* Search Input - wrapped with borderless strategy to match Levels/Relationship boxes */}
                    {Object.keys(groupedNetwork).length > 0 && (
                      <View style={{ width: "100%", marginBottom: 12, marginTop: 8 }}>
                        <View style={[styles.searchInputWrapper, darkMode && styles.darkSearchInputWrapper]}>
                          <WebTextInput
                            style={[styles.searchInputInner, darkMode && { color: "#fff" }]}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder='Search Connections...'
                            placeholderTextColor={darkMode ? "#888" : "#999"}
                            borderless
                            accessibilitylabel='Search connections'
                            accessibilityHint='Type to search your connections by name, location, event, or relationship'
                            accessibilityRole='search'
                            aria-label='search connection'
                          />
                        </View>
                      </View>
                    )}

                    {/* Graph/List View Mode Toggle */}
                    <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                      <TouchableOpacity onPress={() => setViewMode("list")} style={[styles.toggleButton, viewMode === "list" && styles.toggleButtonActive]}>
                        <Text style={[styles.toggleButtonText, viewMode === "list" && styles.toggleButtonTextActive]}>View as List</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setViewMode("graph")} style={[styles.toggleButton, viewMode === "graph" && styles.toggleButtonActive]}>
                        <Text style={[styles.toggleButtonText, viewMode === "graph" && styles.toggleButtonTextActive]}>View as Graph</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ marginTop: 10 }}>
                      {/* Row 1: Network - Toggle between Connections (multi-degree) and Circles (direct) */}
                      <View style={styles.controlRow}>
                        <Text style={styles.controlRowLabel}>1. Network</Text>
                        <TouchableOpacity
                          style={[styles.pullDownButton, styles.pullDownButtonActive]}
                          onPress={() => {
                            if (activeView === "connections") {
                              fetchCircle();
                            } else {
                              fetchNetwork(null, degree);
                            }
                          }}
                        >
                          <Text style={[styles.pullDownButtonText, styles.pullDownButtonTextActive]}>{activeView === "connections" ? "Connections" : "Circles"}</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Row 2: Levels to Display - only for Connections view (Circles are all 1st-level) */}
                      {activeView === "connections" && (
                        <View style={styles.controlRow}>
                          <Text style={styles.controlRowLabel}>2. Levels to Display</Text>
                          <View style={[styles.pullDownButton, { overflow: "hidden", height: 30 }]}>
                            <WebTextInput
                              style={styles.pullDownButtonInputInner}
                              value={degree}
                              onChangeText={setDegree}
                              keyboardType='numeric'
                              borderless
                              accessibilitylabel='Levels to display'
                              accessibilityHint='Enter the number of connection levels to show'
                              aria-label='Levels to display'
                            />
                          </View>
                        </View>
                      )}

                      {/* Row 3: Relationship */}
                      <View style={styles.controlRow}>
                        <Text style={styles.controlRowLabel}>3. Relationship</Text>
                        <TouchableOpacity style={[styles.pullDownButton, relationshipFilter !== "All" && styles.pullDownButtonActive]} onPress={() => setFilterModalKind("relationship")}>
                          <Text style={[styles.pullDownButtonText, relationshipFilter !== "All" && styles.pullDownButtonTextActive]}>{relationshipFilter === "All" ? "All" : relationshipFilter}</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Row 4: Date(s) */}
                      <View style={styles.controlRow}>
                        <Text style={styles.controlRowLabel}>4. Date(s)</Text>
                        <TouchableOpacity style={[styles.pullDownButton, dateFilter !== "All" && styles.pullDownButtonActive]} onPress={() => setFilterModalKind("date")}>
                          <Text style={[styles.pullDownButtonText, dateFilter !== "All" && styles.pullDownButtonTextActive]}>{dateFilter === "All" ? "All" : dateFilter}</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Row 5: Location(s) */}
                      <View style={styles.controlRow}>
                        <Text style={styles.controlRowLabel}>5. Location(s)</Text>
                        <TouchableOpacity style={[styles.pullDownButton, locationFilter !== "All" && styles.pullDownButtonActive]} onPress={() => setFilterModalKind("location")}>
                          <Text style={[styles.pullDownButtonText, locationFilter !== "All" && styles.pullDownButtonTextActive]}>{locationFilter === "All" ? "All" : locationFilter}</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Row 6: Event(s) */}
                      <View style={styles.controlRow}>
                        <Text style={styles.controlRowLabel}>6. Event(s)</Text>
                        <TouchableOpacity style={[styles.pullDownButton, eventFilter !== "All" && styles.pullDownButtonActive]} onPress={() => setFilterModalKind("event")}>
                          <Text style={[styles.pullDownButtonText, eventFilter !== "All" && styles.pullDownButtonTextActive]}>{eventFilter === "All" ? "All" : eventFilter}</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Row 7: Notes */}
                      <View style={styles.controlRow}>
                        <Text style={styles.controlRowLabel}>7. Notes</Text>
                        <TouchableOpacity style={[styles.pullDownButton, notesFilter !== "All" && styles.pullDownButtonActive]} onPress={() => setFilterModalKind("notes")}>
                          <Text style={[styles.pullDownButtonText, notesFilter !== "All" && styles.pullDownButtonTextActive]}>{formatFilterButtonLabel(notesFilter)}</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Row 8: Introduced by */}
                      <View style={styles.controlRow}>
                        <Text style={styles.controlRowLabel}>8. Introduced by</Text>
                        <TouchableOpacity style={[styles.pullDownButton, introducedByFilter !== "All" && styles.pullDownButtonActive]} onPress={() => setFilterModalKind("introduced")}>
                          <Text style={[styles.pullDownButtonText, introducedByFilter !== "All" && styles.pullDownButtonTextActive]}>{formatFilterButtonLabel(introducedByFilter)}</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        onPress={() => {
                          setRelationshipFilter("All");
                          setDateFilter("All");
                          setLocationFilter("All");
                          setEventFilter("All");
                          setNotesFilter("All");
                          setIntroducedByFilter("All");
                          setFilterModalKind(null);
                        }}
                        style={{ alignSelf: "center", marginTop: 8, paddingVertical: 8, paddingHorizontal: 14 }}
                      >
                        <Text style={{ color: "#535db7", fontWeight: "600", fontSize: 13 }}>Reset filters (3–8)</Text>
                      </TouchableOpacity>
                    </View>

                    {loading && <ActivityIndicator size='large' color='#AF52DE' />}
                    {error && <Text style={[styles.errorText, darkMode && styles.darkErrorText]}>{error}</Text>}

                    {/* Graph View */}
                    {viewMode === "graph" && filteredNetworkData.length > 0 && (
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
                            source={{ html: generateVisHTML(filteredNetworkData, profileUid || "YOU") }}
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
                      // if (__DEV__) console.log("🔵 NetworkScreen - Checking list view mode");
                      return (
                        <>
                          {/* List View */}
                          {viewMode === "list" && Object.keys(groupedNetwork).length > 0 && (
                            <View style={{ marginTop: 10 }}>
                              {(() => {
                                // if (__DEV__) console.log("🔵 NetworkScreen - Rendering network list items");
                                return Object.keys(groupedNetwork)
                                  .map((d) => Number(d))
                                  .sort((a, b) => a - b)
                                  .map((deg) => {
                                    // if (__DEV__) console.log(`🔵 NetworkScreen - Processing degree ${deg}`);
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
                                      // console.log(`🔵 NetworkScreen - Applying date filter: ${dateFilter}`);
                                      const now = new Date();
                                      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                                      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                                      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

                                      list = list.filter((node) => {
                                        const circleDateStr = node.circle_date || node.profile_personal_joined_timestamp;
                                        if (!circleDateStr) return false;

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
                                      // console.log(`🔵 NetworkScreen - Applying location filter: ${locationFilter}`);
                                      list = list.filter((node) => {
                                        const city = node.circle_city || "";
                                        const state = node.circle_state || "";
                                        let nodeLocation = "";
                                        if (city && state) {
                                          nodeLocation = `${city.trim()}, ${state.trim()}`;
                                        } else if (city) {
                                          nodeLocation = city.trim();
                                        } else if (state) {
                                          nodeLocation = state.trim();
                                        }
                                        return nodeLocation === locationFilter;
                                      });
                                    }

                                    // Apply event filter
                                    if (eventFilter !== "All") {
                                      // console.log(`🔵 NetworkScreen - Applying event filter: ${eventFilter}`);
                                      list = list.filter((node) => {
                                        const nodeEvent = (node.circle_event || "").trim();
                                        return nodeEvent === eventFilter;
                                      });
                                    }

                                    if (notesFilter !== "All") {
                                      list = list.filter((node) => (node.circle_note || "").trim() === notesFilter);
                                    }

                                    if (introducedByFilter !== "All") {
                                      list = list.filter((node) => (node.circle_introduced_by || "").trim() === introducedByFilter);
                                    }

                                    // Apply search filter
                                    if (searchQuery.trim() !== "") {
                                      const query = searchQuery.toLowerCase();
                                      list = list.filter((node) => {
                                        const searchableText = [
                                          node.__mc?.firstName || "",
                                          node.__mc?.lastName || "",
                                          node.__mc?.tagLine || "",
                                          node.__mc?.city || "",
                                          node.__mc?.state || "",
                                          node.__mc?.phoneNumber || "",
                                          node.circle_event || "",
                                          node.circle_note || "",
                                          node.circle_introduced_by || "",
                                          node.circle_relationship || "",
                                          node.network_profile_personal_uid || "",
                                        ]
                                          .join(" ")
                                          .toLowerCase();

                                        return searchableText.includes(query);
                                      });
                                    }

                                    if (list.length === 0) {
                                      if (__DEV__) console.log(`🔵 NetworkScreen - Degree ${deg} has no items after filtering`);
                                      return null;
                                    }

                                    // if (__DEV__) console.log(`🔵 NetworkScreen - Rendering degree ${deg} with ${list.length} items`);
                                    const label = activeView === "circles" ? "Circles" : degreeLabel(Number(deg));
                                    const isExpanded = expandedDegrees[deg] !== false;
                                    return (
                                      <View key={deg} style={{ marginBottom: 12 }}>
                                        <TouchableOpacity
                                          style={[styles.degreeLevelHeader, darkMode && styles.darkDegreeLevelHeader]}
                                          onPress={() => setExpandedDegrees((prev) => ({ ...prev, [deg]: !(prev[deg] !== false) }))}
                                          activeOpacity={0.7}
                                        >
                                          <Text style={[styles.degreeLevelHeaderText, darkMode && styles.darkDegreeLevelHeaderText]}>{label}</Text>
                                          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={24} color={darkMode ? "#e0e0e0" : "#333"} />
                                        </TouchableOpacity>

                                        {isExpanded && (
                                          <View style={{ marginTop: 8 }}>
                                            {list.map((node, index) => {
                                              // if (__DEV__) console.log(`🔵 NetworkScreen - Rendering node ${deg}-${index}, __mc:`, node.__mc);
                                              if (!node.__mc) {
                                                if (__DEV__) console.log(`🔵 NetworkScreen - Node ${deg}-${index} has no __mc, skipping`);
                                                return null;
                                              }
                                              // if (__DEV__) console.log(`🔵 NetworkScreen - Rendering MiniCard for node ${deg}-${index}`);
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
                                        )}
                                      </View>
                                    );
                                  });
                              })()}
                            </View>
                          )}
                        </>
                      );
                    })()}

                    {(() => {
                      // if (__DEV__) console.log("🔵 NetworkScreen - Rendering 'No connections' message");
                      if (!loading && !error && Object.keys(groupedNetwork).length === 0) {
                        return <Text style={[styles.noDataText, darkMode && styles.darkNoDataText]}>{activeView === "circles" ? "No circles found." : "No network connections found."}</Text>;
                      }
                      return null;
                    })()}
                  </>
                )}
              </View>
            );
          })()}
          {/* ── Who's Nearby Accordion ───────────────────────────────── */}
          <TouchableOpacity
            style={[styles.viewMyNetworkHeader, darkMode && styles.darkViewMyNetworkHeader, { marginTop: 8 }]}
            onPress={() => {
              const willExpand = !showNearby;
              setShowNearby(willExpand);
              if (willExpand) fetchNearbyUsers();
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewMyNetworkHeaderText, darkMode && styles.darkViewMyNetworkHeaderText]}>Who's Nearby?</Text>
            <Ionicons name={showNearby ? "chevron-up" : "chevron-down"} size={24} color={darkMode ? "#e0e0e0" : "#333"} />
          </TouchableOpacity>

          {showNearby && (
            <View style={[styles.messagesAccordionBody, darkMode && styles.messagesAccordionBodyDark]}>
              {nearbyLoading ? (
                <ActivityIndicator size='small' color='#AF52DE' style={{ paddingVertical: 20 }} />
              ) : nearbyError ? (
                <View style={styles.messagesEmpty}>
                  <Ionicons name='location-outline' size={40} color={darkMode ? "#555" : "#ccc"} />
                  <Text style={[styles.messagesEmptyText, darkMode && styles.messagesEmptyTextDark, { textAlign: "center", paddingHorizontal: 16 }]}>{nearbyError}</Text>
                </View>
              ) : nearbyUsers.filter((u) => !ignoredNearbyUids.has(u.profile_personal_uid)).length === 0 && nearbyUsers.filter((u) => ignoredNearbyUids.has(u.profile_personal_uid)).length === 0 ? (
                <View style={styles.messagesEmpty}>
                  <Ionicons name='people-outline' size={40} color={darkMode ? "#555" : "#ccc"} />
                  <Text style={[styles.messagesEmptyText, darkMode && styles.messagesEmptyTextDark]}>No one nearby right now</Text>
                </View>
              ) : (
                <>
                  {/* Active (non-ignored) users */}
                  {nearbyUsers
                    .filter((u) => !ignoredNearbyUids.has(u.profile_personal_uid))
                    .map((item, idx) => {
                      const fullName = `${item.profile_personal_first_name || ""} ${item.profile_personal_last_name || ""}`.trim();
                      const initials = `${(item.profile_personal_first_name || "?")[0]}${(item.profile_personal_last_name || "?")[0]}`.toUpperCase();
                      const distMiles = item.distance_meters != null ? (item.distance_meters / 1609).toFixed(1) : "?";
                      return (
                        <View
                          key={item.profile_personal_uid}
                          style={[styles.nearbyRow, darkMode && styles.nearbyRowDark, idx > 0 && (darkMode ? styles.messagesRowBorderDark : styles.messagesRowBorder)]}
                        >
                          {item.profile_personal_image ? (
                            <Image source={{ uri: item.profile_personal_image }} style={styles.nearbyAvatar} />
                          ) : (
                            <View style={[styles.nearbyAvatar, styles.nearbyAvatarFallback]}>
                              <Text style={styles.nearbyAvatarText}>{initials}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.messagesName, darkMode && styles.messagesNameDark]} numberOfLines={1}>
                              {fullName}
                            </Text>
                            <Text style={[styles.nearbyDist, darkMode && styles.nearbyDistDark]}>{distMiles} mi away</Text>
                          </View>
                          {/* View profile */}
                          <TouchableOpacity
                            style={styles.nearbyBtn}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            onPress={() => navigation.navigate("Profile", { profile_uid: item.profile_personal_uid })}
                          >
                            <Ionicons name='person-outline' size={16} color='#4B2E83' />
                          </TouchableOpacity>
                          {/* Chat */}
                          <TouchableOpacity
                            style={[styles.nearbyBtn, styles.nearbyBtnChat]}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            onPress={() =>
                              navigation.navigate("Chat", {
                                other_uid: item.profile_personal_uid,
                                other_name: fullName || "Chat",
                                other_image: item.profile_personal_image || null,
                              })
                            }
                          >
                            <Ionicons name='chatbubble-ellipses-outline' size={16} color='#fff' />
                          </TouchableOpacity>
                          {/* Ignore */}
                          <TouchableOpacity
                            style={[styles.nearbyBtn, styles.nearbyBtnIgnore]}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            onPress={() => ignoreNearbyUser(item.profile_personal_uid)}
                          >
                            <Ionicons name='eye-off-outline' size={16} color='#fff' />
                          </TouchableOpacity>
                        </View>
                      );
                    })}

                  {/* Ignored section */}
                  {nearbyUsers.filter((u) => ignoredNearbyUids.has(u.profile_personal_uid)).length > 0 && (
                    <>
                      <View style={[styles.nearbyIgnoredHeader, darkMode && styles.nearbyIgnoredHeaderDark]}>
                        <Ionicons name='eye-off-outline' size={13} color={darkMode ? "#888" : "#aaa"} style={{ marginRight: 5 }} />
                        <Text style={[styles.nearbyIgnoredTitle, darkMode && styles.nearbyIgnoredTitleDark]}>
                          Ignored ({nearbyUsers.filter((u) => ignoredNearbyUids.has(u.profile_personal_uid)).length})
                        </Text>
                      </View>
                      {nearbyUsers
                        .filter((u) => ignoredNearbyUids.has(u.profile_personal_uid))
                        .map((item) => {
                          const iName = `${(item.profile_personal_first_name || "?")[0]}${(item.profile_personal_last_name || "?")[0]}`.toUpperCase();
                          const iFullName = `${item.profile_personal_first_name || ""} ${item.profile_personal_last_name || ""}`.trim();
                          return (
                            <View key={item.profile_personal_uid} style={[styles.nearbyRow, styles.nearbyRowIgnored, darkMode && styles.nearbyRowDark]}>
                              {item.profile_personal_image ? (
                                <Image source={{ uri: item.profile_personal_image }} style={[styles.nearbyAvatar, { opacity: 0.4 }]} />
                              ) : (
                                <View style={[styles.nearbyAvatar, styles.nearbyAvatarFallback, { opacity: 0.4 }]}>
                                  <Text style={styles.nearbyAvatarText}>{iName}</Text>
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.messagesName, { opacity: 0.5 }, darkMode && styles.messagesNameDark]} numberOfLines={1}>
                                  {iFullName}
                                </Text>
                              </View>
                              {/* Unignore */}
                              <TouchableOpacity
                                style={[styles.nearbyBtn, styles.nearbyBtnUnignore]}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                onPress={() => unignoreNearbyUser(item.profile_personal_uid)}
                              >
                                <Ionicons name='eye-outline' size={16} color='#fff' />
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                    </>
                  )}
                </>
              )}
            </View>
          )}

          {/* ── Messages Accordion ─────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.viewMyNetworkHeader, darkMode && styles.darkViewMyNetworkHeader, { marginTop: 8 }]}
            onPress={() => {
              const willExpand = !showMessages;
              setShowMessages(willExpand);
              if (willExpand) {
                fetchConversations();
                clearUnread();
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewMyNetworkHeaderText, darkMode && styles.darkViewMyNetworkHeaderText]}>Messages</Text>
            <Ionicons name={showMessages ? "chevron-up" : "chevron-down"} size={24} color={darkMode ? "#e0e0e0" : "#333"} />
          </TouchableOpacity>

          {showMessages && (
            <View style={[styles.messagesAccordionBody, darkMode && styles.messagesAccordionBodyDark]}>
              {conversationsLoading ? (
                <ActivityIndicator size='small' color='#AF52DE' style={{ paddingVertical: 20 }} />
              ) : conversations.length === 0 ? (
                <View style={styles.messagesEmpty}>
                  <Ionicons name='chatbubbles-outline' size={40} color={darkMode ? "#555" : "#ccc"} />
                  <Text style={[styles.messagesEmptyText, darkMode && styles.messagesEmptyTextDark]}>No conversations yet</Text>
                </View>
              ) : (
                conversations.map((conv, idx) => {
                  const listTitle = conv.connectListTitle || conv.displayName || `${conv.first_name || ""} ${conv.last_name || ""}`.trim() || conv.other_uid || "Unknown";
                  const initials = conv.connectListInitials || ((conv.first_name || "").charAt(0) + (conv.last_name || "").charAt(0)).toUpperCase() || "?";
                  const preview = conv.last_message || "No messages yet";
                  const time = _convRelTime(conv.last_sent_at || conv.last_message_at);
                  const chatHeaderName = conv.displayName || listTitle;
                  return (
                    <TouchableOpacity
                      key={conv.conversation_uid}
                      style={[styles.messagesRow, darkMode && styles.messagesRowDark, idx > 0 && (darkMode ? styles.messagesRowBorderDark : styles.messagesRowBorder)]}
                      onPress={() => {
                        navigation.navigate("Chat", {
                          conversation_uid: conv.conversation_uid,
                          other_uid: conv.other_uid,
                          other_name: chatHeaderName,
                          other_image: conv.image || null,
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.messagesAvatar}>
                        {conv.image ? (
                          <Image source={{ uri: conv.image }} style={styles.messagesAvatarImg} />
                        ) : (
                          <View style={[styles.messagesAvatarImg, styles.messagesAvatarFallback]}>
                            <Text style={styles.messagesAvatarText}>{initials}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.messagesTextBlock}>
                        <View style={styles.messagesNameRow}>
                          <Text style={[styles.messagesName, darkMode && styles.messagesNameDark]} numberOfLines={2}>
                            {listTitle}
                          </Text>
                          <Text style={[styles.messagesTime, darkMode && styles.messagesTimeDark]}>{time}</Text>
                        </View>
                        <Text style={[styles.messagesPreview, darkMode && styles.messagesPreviewDark]} numberOfLines={1}>
                          {preview}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {/* ── Who Viewed My Profile ─────────────────────────────── */}
          <TouchableOpacity
            style={[styles.viewMyNetworkHeader, darkMode && styles.darkViewMyNetworkHeader, { marginTop: 8 }]}
            onPress={() => {
              const willExpand = !showProfileViewers;
              setShowProfileViewers(willExpand);
              if (willExpand) fetchProfileViewers(viewersSelectedAccount === "personal" ? null : viewersSelectedAccount);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewMyNetworkHeaderText, darkMode && styles.darkViewMyNetworkHeaderText]}>Who Viewed My Profile</Text>
            <Ionicons name={showProfileViewers ? "chevron-up" : "chevron-down"} size={24} color={darkMode ? "#e0e0e0" : "#333"} />
          </TouchableOpacity>
          {showProfileViewers && (
            <View style={[styles.messagesAccordionBody, darkMode && styles.messagesAccordionBodyDark]}>
              <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 }}>
                <TouchableOpacity style={styles.viewersDropdownBtn} onPress={() => setShowViewersAccountDropdown((p) => !p)} activeOpacity={0.7}>
                  <Text style={[styles.viewersDropdownBtnText, darkMode && { color: "#e0e0e0" }]}>
                    {viewersSelectedAccount === "personal"
                      ? "Personal"
                      : viewerBusinesses.find((b) => (b.business_uid || b.profile_business_uid) === viewersSelectedAccount)?.business_name || "Business"}
                  </Text>
                  <Ionicons name={showViewersAccountDropdown ? "chevron-up" : "chevron-down"} size={16} color={darkMode ? "#e0e0e0" : "#333"} />
                </TouchableOpacity>
                {showViewersAccountDropdown && (
                  <View style={[styles.viewersDropdownMenu, darkMode && { backgroundColor: "#2a2a2a", borderColor: "#444" }]}>
                    <TouchableOpacity
                      style={styles.viewersDropdownItem}
                      onPress={() => {
                        setViewersSelectedAccount("personal");
                        setShowViewersAccountDropdown(false);
                        fetchProfileViewers(null);
                      }}
                    >
                      <Text style={[styles.viewersDropdownItemText, viewersSelectedAccount === "personal" && styles.viewersDropdownItemActive, darkMode && { color: "#e0e0e0" }]}>Personal</Text>
                    </TouchableOpacity>
                    {viewerBusinesses.map((b, idx) => {
                      const bId = b.business_uid || b.profile_business_uid;
                      const bName = b.business_name || b.profile_business_name || `Business ${idx + 1}`;
                      return (
                        <TouchableOpacity
                          key={bId || idx}
                          style={styles.viewersDropdownItem}
                          onPress={() => {
                            setViewersSelectedAccount(bId);
                            setShowViewersAccountDropdown(false);
                            fetchProfileViewers(bId);
                          }}
                        >
                          <Text style={[styles.viewersDropdownItemText, viewersSelectedAccount === bId && styles.viewersDropdownItemActive, darkMode && { color: "#e0e0e0" }]}>{bName}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
              {viewersLoading ? (
                <ActivityIndicator size='small' color='#AF52DE' style={{ paddingVertical: 20 }} />
              ) : profileViewers.length > 0 ? (
                profileViewers.map((viewer, index) => (
                  <TouchableOpacity
                    key={viewer.view_viewer_id || index}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate("Profile", { profile_uid: viewer.view_viewer_id, returnTo: "Network" })}
                    style={{ paddingHorizontal: 8, marginTop: index > 0 ? 4 : 0 }}
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
                      <Text style={styles.viewedTimestamp}>Viewed: {new Date(viewer.view_timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</Text>
                    ) : null}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.messagesEmpty}>
                  <Ionicons name='eye-outline' size={40} color={darkMode ? "#555" : "#ccc"} />
                  <Text style={[styles.messagesEmptyText, darkMode && styles.messagesEmptyTextDark]}>
                    {viewersSelectedAccount === "personal" ? "No profile views yet" : "No business profile views yet"}
                  </Text>
                </View>
              )}
            </View>
          )}

          {SHOW_NETWORK_DEBUG_UI !== 0 && settingsDebugModeEnabled && (
            <>
              {/* QR / ABLY DEBUG Dropdown */}
              <TouchableOpacity style={[styles.debugDropdownHeader, darkMode && styles.darkDebugDropdownHeader]} onPress={() => setShowDebugBlocks((prev) => !prev)} activeOpacity={0.7}>
                <Text style={[styles.debugDropdownHeaderText, darkMode && styles.darkDebugDropdownHeaderText]}>QR / ABLY DEBUG</Text>
                <Ionicons name={showDebugBlocks ? "chevron-up" : "chevron-down"} size={24} color={darkMode ? "#e0e0e0" : "#333"} />
              </TouchableOpacity>
              {showDebugBlocks && (
                <>
                  {/* Display QR Code Contains Block */}
                  {qrCodeDataObject && (
                    <View style={[styles.qrCodeContainsContainer, darkMode && styles.darkQrCodeContainsContainer]}>
                      <Text style={[styles.qrCodeContainsTitle, darkMode && styles.darkQrCodeContainsTitle]}>📋 QR Code Contains:</Text>
                      <View style={[styles.qrCodeContainsContent, darkMode && styles.darkQrCodeContainsContent]}>
                        {Object.entries(qrCodeDataObject).map(([key, value]) => (
                          <View key={key} style={styles.qrCodeContainsRow}>
                            <Text style={[styles.qrCodeContainsKey, darkMode && styles.darkQrCodeContainsKey]}>{key}:</Text>
                            <Text style={[styles.qrCodeContainsValue, darkMode && styles.darkQrCodeContainsValue]}>{typeof value === "object" ? JSON.stringify(value) : String(value)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Display Ably Messages Received Block */}
                  <View style={[styles.ablyMessageContainer, darkMode && styles.darkAblyMessageContainer]}>
                    <Text style={[styles.ablyMessageTitle, darkMode && styles.darkAblyMessageTitle]}>📨 Ably Messages Received:</Text>
                    <View style={[styles.ablyMessageContent, darkMode && styles.darkAblyMessageContent]}>
                      {ablyMessageReceived ? (
                        <>
                          <View style={styles.ablyMessageRow}>
                            <Text style={[styles.ablyMessageKey, darkMode && styles.darkAblyMessageKey]}>Channel:</Text>
                            <Text style={[styles.ablyMessageValue, darkMode && styles.darkAblyMessageValue]}>{ablyMessageReceived.channel}</Text>
                          </View>
                          <View style={styles.ablyMessageRow}>
                            <Text style={[styles.ablyMessageKey, darkMode && styles.darkAblyMessageKey]}>Message:</Text>
                            <Text style={[styles.ablyMessageValue, darkMode && styles.darkAblyMessageValue]}>{ablyMessageReceived.message}</Text>
                          </View>
                          <View style={styles.ablyMessageRow}>
                            <Text style={[styles.ablyMessageKey, darkMode && styles.darkAblyMessageKey]}>Timestamp:</Text>
                            <Text style={[styles.ablyMessageValue, darkMode && styles.darkAblyMessageValue]}>{new Date(ablyMessageReceived.timestamp).toLocaleString()}</Text>
                          </View>
                        </>
                      ) : (
                        <View style={styles.ablyMessageRow}>
                          <Text style={[styles.ablyMessageValue, darkMode && styles.darkAblyMessageValue, { fontStyle: "italic", color: "#999" }]}>
                            No messages received yet. Listening for messages...
                          </Text>
                        </View>
                      )}
                      {qrCodeDataObject?.profile_uid && (
                        <>
                          <View style={styles.ablyMessageRow}>
                            <Text style={[styles.ablyMessageKey, darkMode && styles.darkAblyMessageKey]}>Listening on channel:</Text>
                            <Text style={[styles.ablyMessageValue, darkMode && styles.darkAblyMessageValue]}>{ablyListeningChannel || `/${String(qrCodeDataObject.profile_uid)}`}</Text>
                          </View>
                          <View style={styles.ablyMessageRow}>
                            <Text style={[styles.ablyMessageKey, darkMode && styles.darkAblyMessageKey]}>Connection state (Ably):</Text>
                            <Text style={[styles.ablyMessageValue, darkMode && styles.darkAblyMessageValue]}>{ablyConnectionStatus}</Text>
                          </View>
                          <View style={styles.ablyMessageRow}>
                            <Text style={[styles.ablyMessageKey, darkMode && styles.darkAblyMessageKey]}>Channel state (Ably):</Text>
                            <Text style={[styles.ablyMessageValue, darkMode && styles.darkAblyMessageValue]}>{ablyChannelStatus}</Text>
                          </View>
                          <View style={styles.ablyMessageRow}>
                            <Text style={[styles.ablyMessageKey, darkMode && styles.darkAblyMessageKey]}>Token (obscured):</Text>
                            <Text style={[styles.ablyMessageValue, darkMode && styles.darkAblyMessageValue]}>{ablyTokenObscured == null ? "null" : ablyTokenObscured}</Text>
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                </>
              )}

              {(() => {
                return (
                  <View>
                    <TouchableOpacity
                      style={[styles.debugDropdownHeader, darkMode && styles.darkDebugDropdownHeader]}
                      onPress={() => {
                        const newValue = !showAsyncStorage;
                        console.log("👁️ Toggling AsyncStorage visibility from", showAsyncStorage, "to", newValue);
                        setShowAsyncStorage(newValue);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.debugDropdownHeaderText, darkMode && styles.darkDebugDropdownHeaderText]}>ASYNC STORAGE</Text>
                      <Ionicons name={showAsyncStorage ? "chevron-up" : "chevron-down"} size={24} color={darkMode ? "#e0e0e0" : "#333"} />
                    </TouchableOpacity>
                    {(() => {
                      if (showAsyncStorage) {
                        return (
                          <>
                            {storageData.length === 0 ? (
                              <Text style={[styles.noDataText, darkMode && styles.darkNoDataText]}>No data in AsyncStorage.</Text>
                            ) : (
                              storageData
                                .map(([key, value], idx) => {
                                  const sanitizedKey = sanitizeText(key, "Unknown");
                                  const sanitizedValue = sanitizeText(value, "N/A");
                                  if (!isSafeForConditional(sanitizedKey) && !isSafeForConditional(sanitizedValue)) {
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
            </>
          )}
        </ScrollView>

        <BottomNavBar navigation={navigation} />
      </SafeAreaView>
      <FeedbackPopup visible={showFeedbackPopup} onClose={() => setShowFeedbackPopup(false)} pageName='Network' instructions={networkFeedbackInstructions} questions={networkFeedbackQuestions} />
      <ReferralSearch
        visible={connectDirectlyVisible}
        onClose={() => setConnectDirectlyVisible(false)}
        onSelectUser={(user) => {
          const uid = user.profile_personal_uid || user.profile_uid;
          if (uid) {
            setConnectDirectlyVisible(false);
            navigation.navigate("Profile", { profile_uid: uid, returnTo: "Network" });
          }
        }}
        showNewUserButton={false}
        modalTitle='Connect Directly'
        instructionText='Search by email, city, state, or name, then choose someone to open their profile.'
        searchPlaceholder='Email, location, or name'
        noResultsSubtext='Try another spelling, city, or email.'
        searchButtonColor={getHeaderColor("network")}
      />
      <ScannedProfilePopup
        visible={showScannedProfilePopup}
        profileData={scannedProfileData}
        onClose={() => {
          setShowScannedProfilePopup(false);
          setScannedProfileData(null);
        }}
        onAddConnection={(relationship) => handleAddScannedConnection(relationship)}
      />

      {filterModalKind === "relationship" && (
        <ConnectionFilterModal
          visible
          title='3. Relationship'
          options={RELATIONSHIP_FILTER_OPTIONS}
          selected={relationshipFilter}
          onSelect={setRelationshipFilter}
          onClose={() => setFilterModalKind(null)}
          darkMode={darkMode}
        />
      )}
      {filterModalKind === "date" && (
        <ConnectionFilterModal visible title='4. Date(s)' options={DATE_FILTER_OPTIONS} selected={dateFilter} onSelect={setDateFilter} onClose={() => setFilterModalKind(null)} darkMode={darkMode} />
      )}
      {filterModalKind === "location" && (
        <ConnectionFilterModal
          visible
          title='5. Location(s)'
          options={["All", ...availableCities]}
          selected={locationFilter}
          onSelect={setLocationFilter}
          onClose={() => setFilterModalKind(null)}
          darkMode={darkMode}
        />
      )}
      {filterModalKind === "event" && (
        <ConnectionFilterModal
          visible
          title='6. Event(s)'
          options={["All", ...availableEvents]}
          selected={eventFilter}
          onSelect={setEventFilter}
          onClose={() => setFilterModalKind(null)}
          darkMode={darkMode}
        />
      )}
      {filterModalKind === "notes" && (
        <ConnectionFilterModal visible title='7. Notes' options={noteOptionsForModal} selected={notesFilter} onSelect={setNotesFilter} onClose={() => setFilterModalKind(null)} darkMode={darkMode} />
      )}
      {filterModalKind === "introduced" && (
        <ConnectionFilterModal
          visible
          title='8. Introduced by'
          options={introducedOptionsForModal}
          selected={introducedByFilter}
          onSelect={setIntroducedByFilter}
          onClose={() => setFilterModalKind(null)}
          darkMode={darkMode}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  pageContainer: { flex: 1, backgroundColor: "#fff" },
  scrollContainer: { flex: 1, backgroundColor: "#fff" },
  darkScrollContainer: { backgroundColor: "#d4d4d4" },
  pageContainer: { flex: 1, backgroundColor: "#fff" },
  safeArea: { flex: 1 },
  viewMyNetworkHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(36, 52, 194, 0.5)", // 50% of Connect header (#2434C2)
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  darkViewMyNetworkHeader: {
    backgroundColor: "rgba(28, 40, 153, 0.5)", // 50% of Connect dark mode (#1C2899)
  },
  viewMyNetworkHeaderText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    letterSpacing: 0.5,
  },
  darkViewMyNetworkHeaderText: {
    color: "#e0e0e0",
  },
  degreeLevelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(36, 52, 194, 0.5)", // 50% of Connect header (#2434C2)
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 4,
  },
  darkDegreeLevelHeader: {
    backgroundColor: "rgba(28, 40, 153, 0.5)", // 50% of Connect dark mode (#1C2899)
  },
  degreeLevelHeaderText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333",
    letterSpacing: 0.5,
  },
  darkDegreeLevelHeaderText: {
    color: "#e0e0e0",
  },
  // ── Messages accordion ───────────────────────────────────────
  messagesAccordionBody: {
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#eee",
  },
  messagesAccordionBodyDark: {
    backgroundColor: "#1e1e1e",
    borderColor: "#2a2a2a",
  },
  messagesRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
  },
  messagesRowDark: { backgroundColor: "#1e1e1e" },
  messagesRowBorder: { borderTopWidth: 1, borderTopColor: "#f0f0f0" },
  messagesRowBorderDark: { borderTopWidth: 1, borderTopColor: "#2a2a2a" },
  messagesAvatar: { marginRight: 12 },
  messagesAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  messagesAvatarFallback: {
    backgroundColor: "#AF52DE",
    alignItems: "center",
    justifyContent: "center",
  },
  messagesAvatarText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  messagesTextBlock: { flex: 1 },
  messagesNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  messagesName: { fontSize: 14, fontWeight: "600", color: "#222", flex: 1, marginRight: 8 },
  messagesNameDark: { color: "#fff" },
  messagesTime: { fontSize: 11, color: "#999" },
  messagesTimeDark: { color: "#666" },
  messagesPreview: { fontSize: 12, color: "#666" },
  messagesPreviewDark: { color: "#aaa" },
  viewersDropdownBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#f5f5f5",
    marginBottom: 4,
  },
  viewersDropdownBtnText: { fontSize: 14, color: "#333" },
  viewersDropdownMenu: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 8,
  },
  viewersDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  viewersDropdownItemText: { fontSize: 14, color: "#333" },
  viewersDropdownItemActive: { color: "#AF52DE", fontWeight: "600" },
  viewedTimestamp: { fontSize: 11, color: "#999", paddingHorizontal: 12, paddingBottom: 6 },
  messagesEmpty: { alignItems: "center", paddingVertical: 28 },
  messagesEmptyText: { marginTop: 10, fontSize: 14, color: "#aaa" },
  messagesEmptyTextDark: { color: "#666" },

  // ── Nearby accordion ─────────────────────────────────────────
  nearbyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    gap: 10,
  },
  nearbyRowDark: { backgroundColor: "#1e1e1e" },
  nearbyRowIgnored: { opacity: 0.6 },
  nearbyAvatar: { width: 40, height: 40, borderRadius: 20 },
  nearbyAvatarFallback: {
    backgroundColor: "#AF52DE",
    alignItems: "center",
    justifyContent: "center",
  },
  nearbyAvatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  nearbyDist: { fontSize: 11, color: "#888", marginTop: 2 },
  nearbyDistDark: { color: "#666" },
  nearbyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: "#4B2E83",
    alignItems: "center",
    justifyContent: "center",
  },
  nearbyBtnChat: { backgroundColor: "#AF52DE", borderColor: "#AF52DE" },
  nearbyBtnIgnore: { backgroundColor: "#e57373", borderColor: "#e57373" },
  nearbyBtnUnignore: { backgroundColor: "#66bb6a", borderColor: "#66bb6a" },
  nearbyIgnoredHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    backgroundColor: "#fafafa",
  },
  nearbyIgnoredHeaderDark: { backgroundColor: "#252525", borderTopColor: "#2a2a2a" },
  nearbyIgnoredTitle: { fontSize: 12, color: "#aaa" },
  nearbyIgnoredTitleDark: { color: "#666" },

  debugDropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(36, 52, 194, 0.5)", // 50% of Connect header (#2434C2)
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  darkDebugDropdownHeader: {
    backgroundColor: "rgba(28, 40, 153, 0.5)", // 50% of Connect dark mode (#1C2899)
  },
  debugDropdownHeaderText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    letterSpacing: 0.5,
  },
  darkDebugDropdownHeaderText: {
    color: "#e0e0e0",
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#e0e0e0",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbb",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: "900",
    fontSize: 15,
    color: "#111",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  asyncStorageTitle: {
    fontWeight: "300",
    fontSize: 20,
    textAlign: "center",
    flex: 1,
    borderRadius: 8,
    padding: 10,
    height: 40,
  },
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
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  toggleButtonActive: {
    borderColor: "#2434C2",
    backgroundColor: "#2434C2",
  },
  toggleButtonText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  toggleButtonTextActive: {
    color: "#fff",
  },
  qrCodeContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  qrCodeTitle: {
    fontSize: 30,
    fontWeight: "600",
    color: "#333",
    marginBottom: 5,
    fontStyle: "italic",
  },
  darkQrCodeTitle: {
    color: "#ffffff",
  },
  qrCodeSubtitle: {
    fontSize: 18,
    fontWeight: "400",
    color: "#000",
    marginBottom: 15,
    textAlign: "center",
  },
  darkQrCodeSubtitle: {
    color: "#aaa",
  },
  qrCodeSectionWrapper: {
    alignItems: "center",
    alignSelf: "center",
    width: "100%",
  },
  qrCodeWrapper: {
    width: 220,
    alignSelf: "center",
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#000",
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
    // marginTop: 15,
    // marginBottom: 15,
    width: "100%",
    // borderWidth: 1,
    // borderColor: "#000",
    // borderRadius: 10,
    //overflow: "hidden",
  },
  debugToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    width: "100%",
  },
  darkDebugToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#e0e0e0",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbb",
    width: "100%",
  },
  debugToggleLabel: {
    fontWeight: "300",
    fontSize: 20,
    textAlign: "center",
    flex: 1,
    borderRadius: 8,
    padding: 10,
  },
  darkDebugToggleLabel: {
    color: "#b0b0b0",
  },
  eyeToggleButton: {
    padding: 8,
  },
  darkEyeToggleButton: {
    padding: 8,
  },
  qrCodeContainsContainer: {
    marginTop: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f0f8ff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4a90e2",
    width: "100%",
  },
  darkQrCodeContainsContainer: {
    backgroundColor: "#1a2332",
    borderColor: "#4a90e2",
  },
  qrCodeContainsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2c5282",
    marginBottom: 10,
  },
  darkQrCodeContainsTitle: {
    color: "#90cdf4",
  },
  qrCodeContainsContent: {
    backgroundColor: "#ffffff",
    borderRadius: 4,
    padding: 10,
    borderWidth: 1,
    borderColor: "#cbd5e0",
  },
  darkQrCodeContainsContent: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
  },
  qrCodeContainsRow: {
    flexDirection: "row",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  qrCodeContainsKey: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4a5568",
    marginRight: 8,
    minWidth: 120,
  },
  darkQrCodeContainsKey: {
    color: "#cbd5e0",
  },
  qrCodeContainsValue: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#1a202c",
    flex: 1,
  },
  darkQrCodeContainsValue: {
    color: "#e2e8f0",
  },
  ablyMessageContainer: {
    marginTop: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f59e0b",
    width: "100%",
  },
  darkAblyMessageContainer: {
    backgroundColor: "#2e1f0a",
    borderColor: "#f59e0b",
  },
  ablyMessageTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400e",
    marginBottom: 10,
  },
  darkAblyMessageTitle: {
    color: "#fcd34d",
  },
  ablyMessageContent: {
    backgroundColor: "#ffffff",
    borderRadius: 4,
    padding: 10,
    borderWidth: 1,
    borderColor: "#cbd5e0",
  },
  darkAblyMessageContent: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
  },
  ablyMessageRow: {
    flexDirection: "row",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  ablyMessageKey: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4a5568",
    marginRight: 8,
    minWidth: 100,
  },
  darkAblyMessageKey: {
    color: "#cbd5e0",
  },
  ablyMessageValue: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#1a202c",
    flex: 1,
  },
  darkAblyMessageValue: {
    color: "#e2e8f0",
  },
  filterContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 15,
    marginTop: 15,
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
    boxShadow: "0px 2px 4px 0px rgba(0,0,0,0.1)",
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
  searchContainer: {
    flexDirection: "row",
    marginTop: 10,
    alignItems: "center",
    position: "relative",
    minWidth: 200,
    width: "100%",
    flex: 1,
  },
  searchInputWrapper: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  searchInputInner: {
    borderWidth: 0,
    width: "100%",
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontSize: 14,
    lineHeight: 18,
    color: "#333",
    backgroundColor: "transparent",
    minWidth: 0,
  },
  darkSearchInputWrapper: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  clearSearchButton: {
    position: "absolute",
    right: 10,
    padding: 5,
  },
  // Form Switch styles
  formSwitchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 0,
    height: 56,
    marginTop: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    alignSelf: "center",
    width: 286,
  },
  darkFormSwitchContainer: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  formSwitchTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  formSwitchLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  darkFormSwitchLabel: {
    color: "#fff",
  },
  formSwitchDescription: {
    fontSize: 13,
    color: "#666",
  },
  darkFormSwitchDescription: {
    color: "#aaa",
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 0,
    minWidth: 150,
  },
  controlRowLabel: {
    fontSize: 15,
    color: "#333",
    flex: 1,
  },
  pullDownButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    width: 180,
    minWidth: 180,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  pullDownButtonCompact: {
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  pullDownButtonInputInner: {
    borderWidth: 0,
    width: "100%",
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontSize: 14,
    height: 18,
    lineHeight: 18,
    color: "#333",
    backgroundColor: "transparent",
    minWidth: 0,
  },
  pullDownButtonActive: {
    borderColor: "#2434C2",
    backgroundColor: "#2434C2",
  },
  pullDownButtonText: {
    fontSize: 14,
    color: "#333",
    minWidth: 150,
  },
  pullDownButtonTextActive: {
    color: "#fff",
  },
});

export default NetworkScreen;
