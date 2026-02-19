// NewConnectionScreen.js - Simple Hello World page or MiniCard display
import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView, Platform, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useDarkMode } from "../contexts/DarkModeContext";
import AppHeader from "../components/AppHeader";
import MiniCard from "../components/MiniCard";
import BottomNavBar from "../components/BottomNavBar";
import { USER_PROFILE_INFO_ENDPOINT, CIRCLES_ENDPOINT } from "../apiConfig";
import { sanitizeText } from "../utils/textSanitizer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import WebTextInput from "../components/WebTextInput";
import * as Location from "expo-location";
import { Dropdown } from "react-native-element-dropdown";

const NewConnectionScreen = () => {
  const { darkMode } = useDarkMode();
  const route = useRoute();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingLogin, setCheckingLogin] = useState(true);
  const [loggedInUser, setLoggedInUser] = useState(null);

  // Form fields for logged-in users
  const [introducedBy, setIntroducedBy] = useState("");
  const [commentsNotes, setCommentsNotes] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingEvent, setMeetingEvent] = useState("");
  const [relationship, setRelationship] = useState("friend");
  const [dateTimeStamp, setDateTimeStamp] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingRelationship, setExistingRelationship] = useState(null);
  const [circleUid, setCircleUid] = useState(null);
  const [checkingRelationship, setCheckingRelationship] = useState(false);
  const [formSwitchEnabled, setFormSwitchEnabled] = useState(false); // Track if Form Switch is enabled from QR code
  const formOpenedMessageSent = useRef(false); // Track if we've already sent the "Form is Open" message
  const [ablyChannelName, setAblyChannelName] = useState(null); // Track Ably channel name from QR code
  const [ablyMessageSent, setAblyMessageSent] = useState(false); // Track if Ably message was sent successfully

  // Relationship options matching ConnectScreen.js
  const relationshipOptions = [
    { label: "Friend", value: "friend" },
    { label: "Colleague", value: "colleague" },
    { label: "Family", value: "family" },
  ];

  // Get profile_uid from route params or URL
  // Handles both /connect?profile_uid=xxx and /newconnection/xxx URLs
  const profileUid =
    route.params?.profile_uid ||
    (Platform.OS === "web" && typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("profile_uid") || window.location.pathname.split("/newconnection/")[1]?.split("?")[0] || window.location.pathname.split("/newconnection/")[1]
      : null);

  // Helper function to send "QR code was scanned" message to User 1
  const sendQRCodeScannedMessage = async (channelName) => {
    try {
      console.log("📡 NewConnectionScreen - Starting to send 'QR code was scanned' message");
      console.log("📡 NewConnectionScreen - Channel name:", channelName);
      console.log("📡 NewConnectionScreen - Profile UID:", profileUid);
      
      // Dynamically import Ably
      let Ably;
      try {
        Ably = require("ably");
        console.log("✅ NewConnectionScreen - Ably module loaded");
      } catch (e) {
        console.warn("❌ NewConnectionScreen - Ably not installed. Skipping QR code scanned message.");
        return;
      }

      const ablyApiKey = process.env.EXPO_PUBLIC_ABLY_API_KEY || "";
      if (!ablyApiKey) {
        console.warn("❌ NewConnectionScreen - Ably API key not configured. Skipping QR code scanned message.");
        return;
      }
      console.log("✅ NewConnectionScreen - Ably API key found (length:", ablyApiKey.length, ")");

      if (!channelName) {
        console.warn("❌ NewConnectionScreen - No channel name provided. Skipping QR code scanned message.");
        return;
      }

      // Create Ably client
      console.log("🔵 NewConnectionScreen - Creating Ably client...");
      const client = new Ably.Realtime({ key: ablyApiKey });
      const channel = client.channels.get(channelName);
      console.log("✅ NewConnectionScreen - Ably client and channel created");

      // Wait for connection to be ready
      return new Promise((resolve, reject) => {
        const connectionTimeout = setTimeout(() => {
          console.error("❌ NewConnectionScreen - Timeout waiting for Ably connection");
          client.close();
          reject(new Error("Timeout waiting for Ably connection"));
        }, 10000); // 10 second timeout

        client.connection.on("connected", async () => {
          console.log("✅ NewConnectionScreen - Ably connection established");
          
          // Wait for channel to be attached
          const attachChannel = () => {
            return new Promise((attachResolve, attachReject) => {
              const attachTimeout = setTimeout(() => {
                console.error("❌ NewConnectionScreen - Timeout waiting for channel attachment");
                attachReject(new Error("Timeout waiting for channel attachment"));
              }, 5000);

              if (channel.state === "attached") {
                clearTimeout(attachTimeout);
                attachResolve();
              } else {
                channel.on("attached", () => {
                  clearTimeout(attachTimeout);
                  console.log("✅ NewConnectionScreen - Channel attached, ready to publish");
                  attachResolve();
                });
                
                // Attach to channel if not already attached
                if (channel.state !== "attached" && channel.state !== "attaching") {
                  console.log("🔵 NewConnectionScreen - Attaching to channel...");
                  channel.attach((err) => {
                    if (err) {
                      clearTimeout(attachTimeout);
                      console.error("❌ NewConnectionScreen - Error attaching to channel:", err);
                      attachReject(err);
                    }
                  });
                }
              }
            });
          };

          try {
            await attachChannel();
            
            // Now publish the message
            console.log("📤 NewConnectionScreen - Publishing 'qr-code-scanned' message...");
            await channel.publish("qr-code-scanned", {
              message: "QR code was scanned",
              timestamp: new Date().toISOString(),
              profile_uid: profileUid,
            });
            console.log(`✅ NewConnectionScreen - 'QR code was scanned' message PUBLISHED to channel: ${channelName}`);
            
            // Update UI to show message was sent
            setAblyMessageSent(true);
            
            // Wait a bit to ensure message is sent before closing
            setTimeout(() => {
              console.log("🔵 NewConnectionScreen - Closing Ably connection");
              client.close();
              clearTimeout(connectionTimeout);
              resolve();
            }, 500);
          } catch (error) {
            clearTimeout(connectionTimeout);
            console.error("❌ NewConnectionScreen - Error in channel attachment or publishing:", error);
            client.close();
            reject(error);
          }
        });

        client.connection.on("failed", (stateChange) => {
          clearTimeout(connectionTimeout);
          console.error("❌ NewConnectionScreen - Ably connection failed:", stateChange);
          client.close();
          reject(new Error("Ably connection failed"));
        });
      });
    } catch (error) {
      console.error("❌ NewConnectionScreen - Error sending 'QR code was scanned' message:", error);
      console.error("❌ NewConnectionScreen - Error details:", error.message, error.stack);
    }
  };

  // Check for form_switch_enabled and ably_channel_name in route params (from QR code)
  useEffect(() => {
    const loadChannelName = async () => {
      console.log("🔵 NewConnectionScreen - Route params changed:", route.params);
      console.log("🔵 NewConnectionScreen - Route params type:", typeof route.params);
      console.log("🔵 NewConnectionScreen - Route params keys:", route.params ? Object.keys(route.params) : "null");
      
      // Check route params
      if (route.params?.form_switch_enabled !== undefined) {
        setFormSwitchEnabled(route.params.form_switch_enabled);
        console.log("✅ NewConnectionScreen - Form switch enabled set to:", route.params.form_switch_enabled);
      }
      
      // Store Ably channel name for display - check route.params first
      let channelNameFromParams = route.params?.ably_channel_name;
      console.log("📡 NewConnectionScreen - Channel name from route.params:", channelNameFromParams);
      console.log("📡 NewConnectionScreen - Channel name type:", typeof channelNameFromParams);
      console.log("📡 NewConnectionScreen - Channel name truthy check:", !!channelNameFromParams);
      
      // If not in route params, try AsyncStorage backup (set by QRScannerScreen)
      if (!channelNameFromParams && profileUid) {
        try {
          const storedChannelName = await AsyncStorage.getItem(`ably_channel_${profileUid}`);
          if (storedChannelName) {
            channelNameFromParams = storedChannelName;
            console.log("✅ NewConnectionScreen - Found channel name in AsyncStorage backup:", storedChannelName);
            // Clean up after reading
            await AsyncStorage.removeItem(`ably_channel_${profileUid}`);
          }
        } catch (e) {
          console.warn("⚠️ NewConnectionScreen - Error reading from AsyncStorage:", e);
        }
      }
      
      // Also check if it might be in the URL (for web)
      if (!channelNameFromParams && Platform.OS === "web" && typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const urlChannelName = urlParams.get("ably_channel_name");
        console.log("📡 NewConnectionScreen - Checking URL params for channel name:", urlChannelName);
        if (urlChannelName) {
          channelNameFromParams = urlChannelName;
        }
      }
      
      if (channelNameFromParams) {
        setAblyChannelName(channelNameFromParams);
        console.log("✅ NewConnectionScreen - Ably channel name set for display:", channelNameFromParams);
        
        // If we have an Ably channel name from QR code, send "QR code was scanned" message
        if (profileUid) {
          console.log("📡 NewConnectionScreen - Detected Ably channel name from QR code:", channelNameFromParams);
          console.log("📡 NewConnectionScreen - Profile UID available:", profileUid);
          sendQRCodeScannedMessage(channelNameFromParams).catch((error) => {
            console.error("❌ NewConnectionScreen - Failed to send QR code scanned message:", error);
          });
        }
      } else {
        console.warn("⚠️ NewConnectionScreen - No ably_channel_name found in route params, AsyncStorage, or URL");
        console.log("📋 NewConnectionScreen - Full route.params:", JSON.stringify(route.params, null, 2));
        if (!profileUid) {
          console.warn("⚠️ NewConnectionScreen - No profileUid available yet");
        }
      }
    };
    
    loadChannelName();
  }, [route.params, profileUid]);

  // Check login status on mount
  useEffect(() => {
    checkLoginStatus();
  }, []);

  useEffect(() => {
    if (profileUid) {
      fetchProfileData();
    }
  }, [profileUid]);

  // Fetch existing relationship when user is logged in and viewing a profile
  useEffect(() => {
    if (isLoggedIn && profileUid && !checkingRelationship) {
      fetchExistingRelationship();
    }
  }, [isLoggedIn, profileUid]);

  // Fetch location when user is logged in and viewing a profile
  useEffect(() => {
    if (isLoggedIn && profileData && !fetchingLocation && latitude === null) {
      fetchCurrentLocation();
    }
  }, [isLoggedIn, profileData]);

  // Send "The Form is Open" message to User 1 when form is displayed (only once)
  useEffect(() => {
    if (isLoggedIn && profileData && formSwitchEnabled && profileUid && !formOpenedMessageSent.current) {
      formOpenedMessageSent.current = true;
      sendAblyMessage("form-opened", "The Form is Open");
    }
  }, [isLoggedIn, profileData, formSwitchEnabled, profileUid]);

  const handleContinue = async () => {
    try {
      setSubmitting(true);

      // Check if user is logged in
      const loggedInProfileUID = await AsyncStorage.getItem("profile_uid");
      if (!loggedInProfileUID) {
        Alert.alert("Not Logged In", "Please log in to add connections.");
        navigation.navigate("Login");
        setSubmitting(false);
        return;
      }

      // Check if trying to add self
      if (loggedInProfileUID === profileUid) {
        Alert.alert("Cannot Add Self", "You cannot add yourself as a connection.");
        setSubmitting(false);
        return;
      }

      // Format date from dateTimeStamp (YYYY-MM-DD)
      let circleDate = "";
      if (dateTimeStamp) {
        const date = new Date(dateTimeStamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        circleDate = `${year}-${month}-${day}`;
      } else {
        // Fallback to current date if no timestamp
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        circleDate = `${year}-${month}-${day}`;
      }

      // Format geotag from latitude and longitude
      let circleGeotag = null;
      if (latitude !== null && longitude !== null) {
        // Format as "latitude,longitude" with proper precision
        circleGeotag = `${latitude},${longitude}`;
        console.log("NewConnectionScreen - Geotag formatted:", circleGeotag);
      } else {
        console.log("NewConnectionScreen - No geotag available (latitude:", latitude, "longitude:", longitude, ")");
      }

      // Make API call - use PUT if updating, POST if creating new
      const isUpdate = circleUid !== null;
      const endpoint = isUpdate ? `${CIRCLES_ENDPOINT}/${circleUid}` : CIRCLES_ENDPOINT;
      const method = isUpdate ? "PUT" : "POST";

      // Build request body - for PUT, only include updatable fields
      const requestBody = isUpdate
        ? {
            circle_relationship: relationship || "None",
            circle_date: circleDate,
            circle_event: meetingEvent || null,
            circle_note: commentsNotes || null,
            circle_introduced_by: introducedBy || null,
            circle_geotag: circleGeotag,
          }
        : {
            circle_profile_id: loggedInProfileUID,
            circle_related_person_id: profileUid,
            circle_relationship: relationship || "None",
            circle_date: circleDate,
            circle_event: meetingEvent || null,
            circle_note: commentsNotes || null,
            circle_introduced_by: introducedBy || null,
            circle_geotag: circleGeotag,
          };

      console.log("NewConnectionScreen - Making API call:", {
        endpoint,
        method,
        isUpdate,
        requestBody,
      });

      const response = await fetch(endpoint, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("NewConnectionScreen - API response status:", response.status, "ok:", response.ok);

      // Check if response is successful (200-299 range)
      const isSuccess = response.ok || (response.status >= 200 && response.status < 300);

      if (isSuccess) {
        // If Form Switch is enabled, send messages to User 1
        if (formSwitchEnabled && !isUpdate) {
          // Send "Continue button clicked" message
          await sendAblyMessage("continue-clicked", "The Continue button has been Clicked");
          // Send connection request with User 2's profile info
          await sendAblyConnectionRequest();
        }

        const successMessage = isUpdate ? "Contact successfully updated" : "Contact successfully added";
        console.log("NewConnectionScreen - Success! Showing alert:", successMessage);

        // Handle web vs native differently for alerts
        if (Platform.OS === "web") {
          // On web, use window.alert and navigate immediately after
          window.alert(successMessage);
          console.log("NewConnectionScreen - Navigating to Network page");
          navigation.navigate("Network");
        } else {
          // On native, use Alert.alert with button callback
          Alert.alert("Success", successMessage, [
            {
              text: "OK",
              onPress: () => {
                console.log("NewConnectionScreen - Navigating to Network page");
                // Navigate to Network page (shows QR code and network)
                navigation.navigate("Network");
              },
            },
          ]);
        }
      } else {
        let errorMessage = "Failed to add connection";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || (isUpdate ? "Failed to update connection" : "Failed to add connection");
        } catch (parseError) {
          // If response is not JSON, use status text
          errorMessage = `Error ${response.status}: ${response.statusText || (isUpdate ? "Failed to update connection" : "Failed to add connection")}`;
        }
        console.error("NewConnectionScreen - API error:", errorMessage);

        // Handle web vs native for error alerts
        if (Platform.OS === "web") {
          window.alert(`Error: ${errorMessage}`);
        } else {
          Alert.alert("Error", errorMessage);
        }
      }
    } catch (err) {
      console.error("Error adding connection:", err);
      const errorMsg = err.message || "Failed to add connection. Please try again.";

      // Handle web vs native for error alerts
      if (Platform.OS === "web") {
        window.alert(`Error: ${errorMsg}`);
      } else {
        Alert.alert("Error", errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fetchCurrentLocation = async () => {
    try {
      setFetchingLocation(true);
      setLocationError(null);

      if (Platform.OS === "web") {
        // Use browser geolocation API on web
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setLatitude(position.coords.latitude);
              setLongitude(position.coords.longitude);
              setFetchingLocation(false);
            },
            (error) => {
              console.error("Geolocation error:", error);
              setLocationError("Failed to get location: " + error.message);
              setFetchingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        } else {
          setLocationError("Geolocation is not supported by this browser");
          setFetchingLocation(false);
        }
      } else {
        // Use expo-location on native
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationError("Location permission denied");
          setFetchingLocation(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setLatitude(location.coords.latitude);
        setLongitude(location.coords.longitude);
        setFetchingLocation(false);
      }
    } catch (err) {
      console.error("Error fetching location:", err);
      setLocationError("Failed to get location");
      setFetchingLocation(false);
    }
  };

  const checkLoginStatus = async () => {
    try {
      setCheckingLogin(true);
      const userUid = await AsyncStorage.getItem("user_uid");
      const profileUid = await AsyncStorage.getItem("profile_uid");

      console.log("NewConnectionScreen - checkLoginStatus - userUid:", userUid, "profileUid:", profileUid);

      if (userUid || profileUid) {
        setIsLoggedIn(true);
        setLoggedInUser({
          user_uid: userUid,
          profile_uid: profileUid,
        });
        console.log("NewConnectionScreen - User is logged in");
      } else {
        setIsLoggedIn(false);
        setLoggedInUser(null);
        console.log("NewConnectionScreen - User is NOT logged in");
      }
    } catch (err) {
      console.error("Error checking login status:", err);
      setIsLoggedIn(false);
      setLoggedInUser(null);
    } finally {
      setCheckingLogin(false);
      console.log("NewConnectionScreen - checkLoginStatus complete, checkingLogin:", false, "isLoggedIn:", isLoggedIn);
    }
  };

  const fetchExistingRelationship = async () => {
    try {
      setCheckingRelationship(true);
      const loggedInProfileUID = await AsyncStorage.getItem("profile_uid");

      if (!loggedInProfileUID || !profileUid) {
        setExistingRelationship(null);
        setCircleUid(null);
        return;
      }

      const endpoint = `${CIRCLES_ENDPOINT}/${loggedInProfileUID}?circle_related_person_id=${profileUid}`;
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result && result.data && result.data.length > 0) {
          const relationshipData = result.data[0];
          setExistingRelationship(relationshipData);
          setCircleUid(relationshipData.circle_uid);

          // Populate form fields with existing data
          if (relationshipData.circle_relationship) {
            setRelationship(relationshipData.circle_relationship);
          }
          if (relationshipData.circle_event) {
            setMeetingEvent(relationshipData.circle_event);
          }
          if (relationshipData.circle_note) {
            setCommentsNotes(relationshipData.circle_note);
          }
          if (relationshipData.circle_introduced_by) {
            setIntroducedBy(relationshipData.circle_introduced_by);
          }
          if (relationshipData.circle_date) {
            // Format date for display
            const date = new Date(relationshipData.circle_date);
            setDateTimeStamp(date.toISOString());
          }
          if (relationshipData.circle_geotag && latitude === null && longitude === null) {
            // Parse geotag (format: "latitude,longitude")
            // Only set if location hasn't been fetched yet
            const [lat, lng] = relationshipData.circle_geotag.split(",");
            if (lat && lng) {
              setLatitude(parseFloat(lat));
              setLongitude(parseFloat(lng));
            }
          }
        } else {
          setExistingRelationship(null);
          setCircleUid(null);
        }
      } else {
        setExistingRelationship(null);
        setCircleUid(null);
      }
    } catch (error) {
      console.error("Error fetching existing relationship:", error);
      setExistingRelationship(null);
      setCircleUid(null);
    } finally {
      setCheckingRelationship(false);
    }
  };

  // Helper function to send simple Ably messages to User 1
  // Uses the channel name from the QR code (User 1's channel)
  const sendAblyMessage = async (messageType, messageText) => {
    try {
      // Use the channel name from QR code if available, otherwise fall back to fetching User 1's profile
      let channelName = ablyChannelName;
      
      if (!channelName) {
        console.warn("⚠️ NewConnectionScreen - No channel name from QR code, fetching User 1's profile...");
        // Dynamically import Ably
        let Ably;
        try {
          Ably = require("ably");
        } catch (e) {
          console.warn("Ably not installed. Skipping Ably message.");
          return;
        }

        const ablyApiKey = process.env.EXPO_PUBLIC_ABLY_API_KEY || "";
        if (!ablyApiKey) {
          console.warn("Ably API key not configured. Skipping Ably message.");
          return;
        }

        // Get User 1's profile to find their user_uid for the channel (fallback)
        const user1ProfileResponse = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${profileUid}`);
        if (!user1ProfileResponse.ok) {
          console.warn("Could not fetch User 1's profile for Ably message.");
          return;
        }
        const user1Profile = await user1ProfileResponse.json();
        const user1Uid = user1Profile?.user_uid || user1Profile?.user?.user_uid;

        if (!user1Uid) {
          console.warn("User 1's user_uid not found. Skipping Ably message.");
          return;
        }

        channelName = `profile:${user1Uid}`;
      }

      console.log(`📡 NewConnectionScreen - Sending Ably message (${messageType}) to User 1's channel: ${channelName}`);

      // Dynamically import Ably
      let Ably;
      try {
        Ably = require("ably");
      } catch (e) {
        console.warn("Ably not installed. Skipping Ably message.");
        return;
      }

      const ablyApiKey = process.env.EXPO_PUBLIC_ABLY_API_KEY || "";
      if (!ablyApiKey) {
        console.warn("Ably API key not configured. Skipping Ably message.");
        return;
      }

      // Create Ably client and send message to User 1's channel
      const client = new Ably.Realtime({ key: ablyApiKey });
      const channel = client.channels.get(channelName);

      await channel.publish(messageType, {
        message: messageText,
        timestamp: new Date().toISOString(),
      });
      console.log(`✅ NewConnectionScreen - Ably message sent to User 1's channel (${messageType}):`, messageText);
      console.log(`✅ NewConnectionScreen - Channel used: ${channelName}`);

      // Close Ably connection
      client.close();
    } catch (error) {
      console.error("❌ NewConnectionScreen - Error sending Ably message:", error);
      // Don't show error to user - this is a background operation
    }
  };

  // Send Ably message to User 1 with User 2's profile info
  // Uses the channel name from the QR code (User 1's channel)
  const sendAblyConnectionRequest = async () => {
    try {
      // Use the channel name from QR code if available, otherwise fall back to fetching User 1's profile
      let channelName = ablyChannelName;
      
      if (!channelName) {
        console.warn("⚠️ NewConnectionScreen - No channel name from QR code, fetching User 1's profile...");
        // Dynamically import Ably
        let Ably;
        try {
          Ably = require("ably");
        } catch (e) {
          console.warn("Ably not installed. Skipping Ably message.");
          return;
        }

        const ablyApiKey = process.env.EXPO_PUBLIC_ABLY_API_KEY || "";
        if (!ablyApiKey) {
          console.warn("Ably API key not configured. Skipping Ably message.");
          return;
        }

        // Get User 1's profile to find their user_uid for the channel (fallback)
        const user1ProfileResponse = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${profileUid}`);
        if (!user1ProfileResponse.ok) {
          console.warn("Could not fetch User 1's profile for Ably message.");
          return;
        }
        const user1Profile = await user1ProfileResponse.json();
        const user1Uid = user1Profile?.user_uid || user1Profile?.user?.user_uid;

        if (!user1Uid) {
          console.warn("User 1's user_uid not found. Skipping Ably message.");
          return;
        }

        channelName = `profile:${user1Uid}`;
      }

      console.log(`📡 NewConnectionScreen - Sending connection request to User 1's channel: ${channelName}`);

      // Dynamically import Ably
      let Ably;
      try {
        Ably = require("ably");
      } catch (e) {
        console.warn("Ably not installed. Skipping Ably message.");
        return;
      }

      const ablyApiKey = process.env.EXPO_PUBLIC_ABLY_API_KEY || "";
      if (!ablyApiKey) {
        console.warn("Ably API key not configured. Skipping Ably message.");
        return;
      }

      // Get User 2's (logged in user's) profile info
      const loggedInProfileUID = await AsyncStorage.getItem("profile_uid");
      if (!loggedInProfileUID) {
        console.warn("Logged in user profile UID not found. Skipping Ably message.");
        return;
      }

      const user2ProfileResponse = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${loggedInProfileUID}`);
      if (!user2ProfileResponse.ok) {
        console.warn("Could not fetch User 2's profile for Ably message.");
        return;
      }
      const user2Profile = await user2ProfileResponse.json();
      const p2 = user2Profile?.personal_info || {};

      // Extract public miniCard information for User 2
      const tagLineIsPublic2 = p2.profile_personal_tag_line_is_public === 1 || p2.profile_personal_tagline_is_public === 1;
      const emailIsPublic2 = p2.profile_personal_email_is_public === 1;
      const phoneIsPublic2 = p2.profile_personal_phone_number_is_public === 1;
      const imageIsPublic2 = p2.profile_personal_image_is_public === 1;
      const locationIsPublic2 = p2.profile_personal_location_is_public === 1;

      // Only set profileImage if it's public and exists
      const profileImageValue = imageIsPublic2 && p2.profile_personal_image 
        ? sanitizeText(String(p2.profile_personal_image)) 
        : null;

      const user2PublicData = {
        profile_uid: loggedInProfileUID,
        firstName: sanitizeText(p2.profile_personal_first_name || ""),
        lastName: sanitizeText(p2.profile_personal_last_name || ""),
        tagLine: tagLineIsPublic2 ? sanitizeText(p2.profile_personal_tag_line || p2.profile_personal_tagline) : "",
        email: emailIsPublic2 ? sanitizeText(user2Profile?.user_email || "") : "",
        phoneNumber: phoneIsPublic2 ? sanitizeText(p2.profile_personal_phone_number || "") : "",
        profileImage: profileImageValue,
        city: locationIsPublic2 ? sanitizeText(p2.profile_personal_city || "") : "",
        state: locationIsPublic2 ? sanitizeText(p2.profile_personal_state || "") : "",
        tagLineIsPublic: tagLineIsPublic2,
        emailIsPublic: emailIsPublic2,
        phoneIsPublic: phoneIsPublic2,
        imageIsPublic: imageIsPublic2,
        locationIsPublic: locationIsPublic2,
      };

      // Create Ably client and send message to User 1's channel (from QR code)
      const client = new Ably.Realtime({ key: ablyApiKey });
      const channel = client.channels.get(channelName);

      await channel.publish("connection-request", user2PublicData);
      console.log(`✅ NewConnectionScreen - Connection request sent to User 1's channel: ${channelName}`);

      // Close Ably connection
      client.close();
    } catch (error) {
      console.error("Error sending Ably message:", error);
      // Don't show error to user - this is a background operation
    }
  };

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      setError(null);
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
      // Set date/time stamp when profile is loaded
      const now = new Date();
      setDateTimeStamp(now.toISOString());
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, darkMode && styles.darkContainer]}>
      <AppHeader title='New Connection' />
      <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Login Status Display */}
          <View style={[styles.loginStatusContainer, darkMode && styles.darkLoginStatusContainer]}>
            {checkingLogin ? (
              <Text style={[styles.loginStatusText, darkMode && styles.darkLoginStatusText]}>Checking login status...</Text>
            ) : (
              <>
                <Text style={[styles.loginStatusLabel, darkMode && styles.darkLoginStatusLabel]}>Login Status:</Text>
                <View style={[styles.loginStatusBadge, isLoggedIn ? styles.loggedInBadge : styles.loggedOutBadge]}>
                  <Text style={styles.loginStatusBadgeText}>{isLoggedIn ? "Logged In" : "Not Logged In"}</Text>
                </View>
                {isLoggedIn && loggedInUser && (
                  <View style={styles.userInfoContainer}>
                    {loggedInUser.user_uid && <Text style={[styles.userInfoText, darkMode && styles.darkUserInfoText]}>User UID: {loggedInUser.user_uid}</Text>}
                    {loggedInUser.profile_uid && <Text style={[styles.userInfoText, darkMode && styles.darkUserInfoText]}>Profile UID: {loggedInUser.profile_uid}</Text>}
                  </View>
                )}
              </>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size='large' color='#AF52DE' />
              <Text style={[styles.loadingText, darkMode && styles.darkLoadingText]}>Loading profile...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, darkMode && styles.darkErrorText]}>{error}</Text>
              <Text style={[styles.helloText, darkMode && styles.darkHelloText]}>Hello World</Text>
            </View>
          ) : profileData ? (
            <>
              <View style={styles.cardContainer}>
                <MiniCard user={profileData} />
                
                {/* Display Ably Channel Name and Status */}
                <View style={[styles.ablyInfoContainer, darkMode && styles.darkAblyInfoContainer]}>
                  {ablyChannelName ? (
                    <>
                      <Text style={[styles.ablyLabel, darkMode && styles.darkAblyLabel]}>Ably Channel:</Text>
                      <Text style={[styles.ablyChannelName, darkMode && styles.darkAblyChannelName]}>{ablyChannelName}</Text>
                      {ablyMessageSent ? (
                        <View style={styles.ablyStatusContainer}>
                          <Text style={[styles.ablyStatusSent, darkMode && styles.darkAblyStatusSent]}>✅ Ably Note Sent</Text>
                        </View>
                      ) : (
                        <View style={styles.ablyStatusContainer}>
                          <Text style={[styles.ablyStatusPending, darkMode && styles.darkAblyStatusPending]}>⏳ Sending Ably Note...</Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={[styles.ablyLabel, darkMode && styles.darkAblyLabel]}>
                        ⚠️ No Ably Channel Name in QR Code
                      </Text>
                      <Text style={[styles.ablyInfoText, darkMode && styles.darkAblyInfoText]}>
                        Debug: route.params?.ably_channel_name = {route.params?.ably_channel_name ? String(route.params.ably_channel_name) : "undefined/null"}
                      </Text>
                      <Text style={[styles.ablyInfoText, darkMode && styles.darkAblyInfoText]}>
                        Debug: ablyChannelName state = {ablyChannelName ? String(ablyChannelName) : "null"}
                      </Text>
                    </>
                  )}
                </View>
              </View>

              {/* Login/SignUp buttons for non-logged-in users */}
              {(() => {
                const shouldShowAuth = !checkingLogin && !isLoggedIn;
                console.log("NewConnectionScreen - Render check:", {
                  checkingLogin,
                  isLoggedIn,
                  shouldShowAuth,
                  hasProfileData: !!profileData,
                });
                return shouldShowAuth ? (
                  <View style={[styles.authContainer, darkMode && styles.darkAuthContainer]}>
                    <Text style={[styles.authTitle, darkMode && styles.darkAuthTitle]}>Connect with {profileData.firstName}</Text>
                    <Text style={[styles.authSubtitle, darkMode && styles.darkAuthSubtitle]}>Sign in or create an account to add this person to your network</Text>

                    <TouchableOpacity
                      style={[styles.authButton, styles.loginButton, darkMode && styles.darkLoginButton]}
                      onPress={() => navigation.navigate("Login", { returnToNewConnection: true, profile_uid: profileUid })}
                    >
                      <Text style={styles.authButtonText}>Login</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.authButton, styles.signupButton, darkMode && styles.darkSignupButton]}
                      onPress={() => navigation.navigate("SignUp", { referralProfileUid: profileUid, returnToNewConnection: true, profile_uid: profileUid })}
                    >
                      <Text style={styles.authButtonText}>Sign Up</Text>
                    </TouchableOpacity>
                  </View>
                ) : null;
              })()}

              {/* Form fields for logged-in users */}
              {isLoggedIn && (
                <View style={[styles.formContainer, darkMode && styles.darkFormContainer]}>
                  <Text style={[styles.formTitle, darkMode && styles.darkFormTitle]}>Connection Details</Text>

                  {/* Already Connected indicator */}
                  {existingRelationship && (
                    <View style={[styles.alreadyConnectedContainer, darkMode && styles.darkAlreadyConnectedContainer]}>
                      <Text style={[styles.alreadyConnectedText, darkMode && styles.darkAlreadyConnectedText]}>Already Connected</Text>
                    </View>
                  )}

                  {/* Date Time Stamp */}
                  <View style={styles.fieldContainer}>
                    <Text style={[styles.fieldLabel, darkMode && styles.darkFieldLabel]}>Date Time Stamp:</Text>
                    <Text style={[styles.fieldValue, darkMode && styles.darkFieldValue]}>{dateTimeStamp ? new Date(dateTimeStamp).toLocaleString() : "Not set"}</Text>
                  </View>

                  {/* Geo Location */}
                  <View style={styles.fieldContainer}>
                    <Text style={[styles.fieldLabel, darkMode && styles.darkFieldLabel]}>Geo Location:</Text>
                    {fetchingLocation ? (
                      <View style={styles.locationLoading}>
                        <ActivityIndicator size='small' color='#AF52DE' />
                        <Text style={[styles.locationText, darkMode && styles.darkLocationText]}>Fetching location...</Text>
                      </View>
                    ) : locationError ? (
                      <Text style={[styles.errorText, darkMode && styles.darkErrorText]}>{locationError}</Text>
                    ) : latitude !== null && longitude !== null ? (
                      <Text style={[styles.locationText, darkMode && styles.darkLocationText]}>
                        Latitude: {latitude.toFixed(6)}, Longitude: {longitude.toFixed(6)}
                      </Text>
                    ) : (
                      <Text style={[styles.locationText, darkMode && styles.darkLocationText]}>Location not available</Text>
                    )}
                  </View>

                  {/* Relationship */}
                  <View style={styles.fieldContainer}>
                    <Text style={[styles.fieldLabel, darkMode && styles.darkFieldLabel]}>Relationship (defaults to Friend):</Text>
                    <Dropdown
                      style={[styles.dropdown, darkMode && styles.darkDropdown]}
                      data={relationshipOptions}
                      labelField='label'
                      valueField='value'
                      placeholder='Select relationship'
                      placeholderTextColor={darkMode ? "#666" : "#999"}
                      value={relationship}
                      onChange={(item) => setRelationship(item.value)}
                      containerStyle={[styles.dropdownContainer, darkMode && styles.darkDropdownContainer]}
                      itemTextStyle={[styles.dropdownItemText, darkMode && styles.darkDropdownItemText]}
                      selectedTextStyle={[styles.dropdownSelectedText, darkMode && styles.darkDropdownSelectedText]}
                      activeColor={darkMode ? "#404040" : "#f0f0f0"}
                      maxHeight={250}
                      renderItem={(item) => (
                        <View style={styles.dropdownItem}>
                          <Text style={[styles.dropdownItemText, darkMode && styles.darkDropdownItemText]}>{item.label}</Text>
                        </View>
                      )}
                      flatListProps={{
                        nestedScrollEnabled: true,
                        ItemSeparatorComponent: () => <View style={[styles.dropdownSeparator, darkMode && styles.darkDropdownSeparator]} />,
                      }}
                    />
                  </View>

                  {/* Introduced By */}
                  <View style={styles.fieldContainer}>
                    <Text style={[styles.fieldLabel, darkMode && styles.darkFieldLabel]}>Introduced By (optional):</Text>
                    <WebTextInput
                      style={[styles.textInput, darkMode && styles.darkTextInput]}
                      value={introducedBy}
                      onChangeText={setIntroducedBy}
                      placeholder='Enter who introduced you to this person'
                      placeholderTextColor={darkMode ? "#666" : "#999"}
                    />
                  </View>

                  {/* Meeting Location */}
                  <View style={styles.fieldContainer}>
                    <Text style={[styles.fieldLabel, darkMode && styles.darkFieldLabel]}>Meeting Location (optional):</Text>
                    <WebTextInput
                      style={[styles.textInput, darkMode && styles.darkTextInput]}
                      value={meetingLocation}
                      onChangeText={setMeetingLocation}
                      placeholder='Enter where you met this person'
                      placeholderTextColor={darkMode ? "#666" : "#999"}
                    />
                  </View>

                  {/* Meeting Event */}
                  <View style={styles.fieldContainer}>
                    <Text style={[styles.fieldLabel, darkMode && styles.darkFieldLabel]}>Meeting Event (optional):</Text>
                    <WebTextInput
                      style={[styles.textInput, darkMode && styles.darkTextInput]}
                      value={meetingEvent}
                      onChangeText={setMeetingEvent}
                      placeholder='Enter the event where you met'
                      placeholderTextColor={darkMode ? "#666" : "#999"}
                    />
                  </View>

                  {/* Comments, Notes, Reminder */}
                  <View style={styles.fieldContainer}>
                    <Text style={[styles.fieldLabel, darkMode && styles.darkFieldLabel]}>Comments, Notes, Reminder (optional):</Text>
                    <WebTextInput
                      style={[styles.textArea, darkMode && styles.darkTextInput]}
                      value={commentsNotes}
                      onChangeText={setCommentsNotes}
                      placeholder='Enter any comments, notes, or reminders about this connection'
                      placeholderTextColor={darkMode ? "#666" : "#999"}
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  {/* Continue/Update Button */}
                  <TouchableOpacity style={[styles.continueButton, darkMode && styles.darkContinueButton, submitting && styles.continueButtonDisabled]} onPress={handleContinue} disabled={submitting}>
                    {submitting ? <ActivityIndicator size='small' color='#fff' /> : <Text style={styles.continueButtonText}>{existingRelationship ? "Update" : "Continue"}</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <View style={styles.content}>
              <Text style={[styles.helloText, darkMode && styles.darkHelloText]}>Hello World</Text>
            </View>
          )}
        </ScrollView>
        {isLoggedIn && <BottomNavBar navigation={navigation} />}
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
    paddingBottom: 120, // Extra padding to ensure content is visible above BottomNavBar
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 400,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 400,
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
    minHeight: 400,
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
  cardContainer: {
    marginTop: 20,
  },
  ablyInfoContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  darkAblyInfoContainer: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  ablyLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
  },
  darkAblyLabel: {
    color: "#aaa",
  },
  ablyChannelName: {
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#333",
    marginBottom: 8,
  },
  darkAblyChannelName: {
    color: "#fff",
  },
  ablyStatusContainer: {
    marginTop: 4,
  },
  ablyStatusSent: {
    fontSize: 14,
    fontWeight: "600",
    color: "#28a745",
  },
  darkAblyStatusSent: {
    color: "#4ade80",
  },
  ablyStatusPending: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ff9500",
  },
  darkAblyStatusPending: {
    color: "#ffb84d",
  },
  helloText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
  },
  darkHelloText: {
    color: "#fff",
  },
  loginStatusContainer: {
    backgroundColor: "#f5f5f5",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  darkLoginStatusContainer: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  loginStatusLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  darkLoginStatusLabel: {
    color: "#aaa",
  },
  loginStatusText: {
    fontSize: 14,
    color: "#666",
  },
  darkLoginStatusText: {
    color: "#aaa",
  },
  loginStatusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  loggedInBadge: {
    backgroundColor: "#4caf50",
  },
  loggedOutBadge: {
    backgroundColor: "#f44336",
  },
  loginStatusBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  userInfoContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  userInfoText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  darkUserInfoText: {
    color: "#aaa",
  },
  formContainer: {
    marginTop: 30,
    padding: 20,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  darkFormContainer: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
  },
  darkFormTitle: {
    color: "#fff",
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  darkFieldLabel: {
    color: "#ccc",
  },
  fieldValue: {
    fontSize: 14,
    color: "#666",
    fontFamily: Platform.OS === "web" ? "monospace" : "monospace",
  },
  darkFieldValue: {
    color: "#aaa",
  },
  locationLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    color: "#666",
    fontFamily: Platform.OS === "web" ? "monospace" : "monospace",
  },
  darkLocationText: {
    color: "#aaa",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: "#fff",
    color: "#333",
  },
  darkTextInput: {
    backgroundColor: "#1a1a1a",
    borderColor: "#404040",
    color: "#fff",
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: "#fff",
    color: "#333",
    minHeight: 100,
    textAlignVertical: "top",
  },
  continueButton: {
    backgroundColor: "#FF9500",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 20,
    marginBottom: 10,
  },
  darkContinueButton: {
    backgroundColor: "#FF9500",
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  alreadyConnectedContainer: {
    backgroundColor: "#e8f5e9",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#4caf50",
  },
  darkAlreadyConnectedContainer: {
    backgroundColor: "#1b5e20",
    borderColor: "#66bb6a",
  },
  alreadyConnectedText: {
    color: "#2e7d32",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  darkAlreadyConnectedText: {
    color: "#81c784",
  },
  dropdown: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    minHeight: 48,
  },
  darkDropdown: {
    backgroundColor: "#1a1a1a",
    borderColor: "#404040",
  },
  dropdownContainer: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fff",
    zIndex: 1000,
    ...(Platform.OS === "web" && {
      boxShadow: "0px 2px 4px 0px rgba(0, 0, 0, 0.1)",
    }),
  },
  darkDropdownContainer: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  dropdownItem: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#333",
  },
  darkDropdownItemText: {
    color: "#fff",
  },
  dropdownSelectedText: {
    fontSize: 16,
    color: "#333",
  },
  darkDropdownSelectedText: {
    color: "#fff",
  },
  dropdownSeparator: {
    height: 1,
    backgroundColor: "#e0e0e0",
  },
  darkDropdownSeparator: {
    backgroundColor: "#404040",
  },
  authContainer: {
    marginTop: 30,
    padding: 20,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  darkAuthContainer: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  authTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  darkAuthTitle: {
    color: "#fff",
  },
  authSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  darkAuthSubtitle: {
    color: "#aaa",
  },
  authButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    marginBottom: 12,
  },
  loginButton: {
    backgroundColor: "#AF52DE",
  },
  darkLoginButton: {
    backgroundColor: "#AF52DE",
  },
  signupButton: {
    backgroundColor: "#FF9500",
  },
  darkSignupButton: {
    backgroundColor: "#FF9500",
  },
  authButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default NewConnectionScreen;
