import "./polyfills";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { LogBox, Platform } from "react-native";

import { StyleSheet, Text, View, Alert, ActivityIndicator, TouchableOpacity, Image } from "react-native";

// Check if we're on web by checking for window object (works at module load time)
// This must be defined before any code that uses it
const isWeb = typeof window !== "undefined" && typeof document !== "undefined";

// Video component removed - expo-av was causing build issues with new architecture
// If needed in the future, re-add expo-av and configure it properly

// Suppress VirtualizedList nesting warning - we're using nestedScrollEnabled and proper configuration
LogBox.ignoreLogs(["VirtualizedLists should never be nested inside plain ScrollViews"]);
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Only import GoogleSignin on native platforms (not web)
let GoogleSignin = null;
let statusCodes = null;
if (!isWeb) {
  try {
    const googleSigninModule = require("@react-native-google-signin/google-signin");
    GoogleSignin = googleSigninModule.GoogleSignin;
    statusCodes = googleSigninModule.statusCodes;
  } catch (e) {
    console.warn("GoogleSignin not available:", e.message);
  }
}

import config from "./config";
import { GOOGLE_SIGNUP_ENDPOINT, GOOGLE_SIGNIN_ENDPOINT, APPLE_SIGNIN_ENDPOINT, API_BASE_URL } from "./apiConfig";
import versionData from "./version.json";
import { DarkModeProvider } from "./contexts/DarkModeContext";
import TextNodeErrorBoundary from "./components/TextNodeErrorBoundary";
import LoginScreen from "./screens/LoginScreen";
import SignUpScreen from "./screens/SignUpScreen";
import HowItWorksScreen from "./screens/HowItWorksScreen";
import UserInfoScreen from "./screens/UserInfoScreen";
import ProfileScreen from "./screens/ProfileScreen";
import EditProfileScreen from "./screens/EditProfileScreen";
import SettingsScreen from "./screens/SettingsScreen";
import AccountScreen from "./screens/AccountScreen";
import NetworkScreen from "./screens/NetworkScreen";
import SearchScreen from "./screens/SearchScreen";
import AppleSignIn from "./AppleSignIn";
import AccountTypeScreen from "./screens/AccountTypeScreen";
import BusinessSetupController from "./screens/BusinessSetupController";
import BusinessProfileScreen from "./screens/BusinessProfileScreen";
import SearchTab from "./screens/SearchTab";
import ChangePasswordScreen from "./screens/ChangePasswordScreen";
import FilterScreen from "./screens/FilterScreen-DNU";
import TermsAndConditionsScreen from "./screens/TermsAndConditionsScreen";
import PrivacyPolicyScreen from "./screens/PrivacyPolicyScreen";
//import SearchResults from './screens/SearchResults';
import EditBusinessProfileScreen from "./screens/EditBusinessProfileScreen";
import ShoppingCartScreen from "./screens/ShoppingCartScreen";
import ReviewBusinessScreen from "./screens/ReviewBusinessScreen";
import ReviewDetailScreen from "./screens/ReviewDetailScreen";
import ExpertiseDetailScreen from "./screens/ExpertiseDetailScreen";
import WishDetailScreen from "./screens/WishDetailScreen";
import WishResponsesScreen from "./screens/WishResponsesScreen";
import ConnectScreen from "./screens/ConnectScreen";
import ConnectWebScreen from "./screens/ConnectWebScreen";
import NewConnectionScreen from "./screens/NewConnectionScreen";
import QRScannerScreen from "./screens/QRScannerScreen";

const Stack = createNativeStackNavigator();

export const mapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const mapsApiKeyDisplay = mapsApiKey ? "..." + mapsApiKey.slice(-4) : "Not set";

// Wrapper component for Connect screen to handle conditional rendering
const ConnectScreenWrapper = (props) => {
  // If profile_uid is present in route params or URL, use NewConnectionScreen
  const profileUid = props.route?.params?.profile_uid || (isWeb && typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("profile_uid") : null);
  if (profileUid) {
    return <NewConnectionScreen {...props} />;
  }
  // Otherwise use the original Connect screen
  return Platform.OS === "web" ? <ConnectWebScreen {...props} /> : <ConnectScreen {...props} />;
};

export default function App() {
  const [initialRoute, setInitialRoute] = useState("Home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // const [showSpinner, setShowSpinner] = useState(false);
  // const [signInInProgress, setSignInInProgress] = useState(false);
  // const [showUserInfo, setShowUserInfo] = useState(false);
  // const [showUserProfile, setShowUserProfile] = useState(false);
  // const [showSignUp, setShowSignUp] = useState(false);
  // const [showLogin, setShowLogin] = useState(false);
  // const [appleAuthStatus, setAppleAuthStatus] = useState("Checking...");

  useEffect(() => {
    console.log("------- Program Starting in App.js -------");
    console.log("App.js - Platform:", Platform.OS);
    console.log("App.js - isWeb:", isWeb);

    const initialize = async () => {
      try {
        // Check user first
        console.log("App.js - Checking if user in AsyncStorage...");
        const uid = await AsyncStorage.getItem("user_uid");
        console.log("App.js - User UID:", uid);
        if (uid) setInitialRoute("Profile");

        // Configure Google Sign-In (only on native platforms)
        if (!isWeb && GoogleSignin) {
          console.log("App.js - Configuring Google Sign-In...");
          await GoogleSignin.configure({
            iosClientId: config.googleClientIds.ios,
            androidClientId: config.googleClientIds.android,
            webClientId: config.googleClientIds.web,
            offlineAccess: true,
          });
          console.log("App.js - Google Sign-In configured successfully");
        } else {
          console.log("App.js - Skipping Google Sign-In configuration on web");
        }
      } catch (err) {
        console.error("App.js - Initialization error:", err);
        setError(err.message || "Initialization failed");
      } finally {
        console.log("App.js - Initialization complete, setting loading to false");
        setLoading(false);
      }
    };

    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn("App.js - Loading timeout, forcing load complete");
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    initialize();

    return () => clearTimeout(timeout);
  }, []);

  // Web Google Sign-In handler using Google Identity Services
  const handleWebGoogleSignIn = useCallback(async (navigation) => {
    console.log("App.js - handleWebGoogleSignIn - Starting");

    return new Promise((resolve, reject) => {
      // Load Google Identity Services script if not already loaded
      if (typeof window === "undefined") {
        reject(new Error("Window object not available"));
        return;
      }

      if (!window.google || !window.google.accounts) {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          console.log("App.js - Google Identity Services script loaded");
          initializeWebGoogleSignIn(navigation, resolve, reject);
        };
        script.onerror = (error) => {
          console.error("App.js - Failed to load Google Identity Services:", error);
          reject(new Error("Failed to load Google Sign-In library"));
        };
        document.head.appendChild(script);
      } else {
        initializeWebGoogleSignIn(navigation, resolve, reject);
      }
    });
  }, []);

  const initializeWebGoogleSignIn = (navigation, resolve, reject) => {
    try {
      const webClientId = config.googleClientIds.web;
      console.log("App.js - Initializing Google Sign-In with client ID:", webClientId?.substring(0, 20) + "...");

      if (!webClientId) {
        const error = new Error("Web Client ID not configured");
        console.error("App.js - Error:", error);
        Alert.alert("Configuration Error", "Google Sign-In is not properly configured for web.");
        reject(error);
        return;
      }

      // Use OAuth 2.0 flow with popup
      const handleCredentialResponse = async (response) => {
        try {
          console.log("App.js - Google Sign-In callback received");

          // Decode the credential (JWT token)
          const credential = response.credential;
          console.log("App.js - Credential received (first 50 chars):", credential?.substring(0, 50));

          // Decode JWT to get user info (payload is base64url encoded)
          const parts = credential.split(".");
          if (parts.length !== 3) {
            throw new Error("Invalid credential format");
          }

          // Decode the payload (second part)
          const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
          console.log("App.js - Decoded payload:", {
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
          });

          const userEmail = payload.email;
          const userInfo = {
            user: {
              email: userEmail,
              name: payload.name,
              givenName: payload.given_name,
              familyName: payload.family_name,
              photo: payload.picture,
              id: payload.sub,
            },
            idToken: credential,
          };

          console.log("App.js - User info extracted:", userInfo);

          // Call the backend API to sign in
          const apiResponse = await fetch(`${GOOGLE_SIGNIN_ENDPOINT}/${userEmail}`);
          const result = await apiResponse.json();
          console.log("App.js - Google Sign In result:", result);

          if (result.message === "Correct Email" && result.result?.[0]) {
            const user_uid = result.result[0];
            console.log("App.js - User UID (from IO Login API):", user_uid);
            await AsyncStorage.setItem("user_uid", user_uid);

            const baseURI = API_BASE_URL;
            const endpointPath = `/api/v1/userprofileinfo/${user_uid}`;
            const endpoint = baseURI + endpointPath;
            console.log(`App.js - Full endpoint: ${endpoint}`);

            const profileResponse = await fetch(endpoint);
            const fullUser = await profileResponse.json();

            console.log("App.js - Endpoint Response:", JSON.stringify(fullUser, null, 2));

            // Handle case where profile is not found (404 error)
            const is404 = !profileResponse.ok && profileResponse.status === 404;
            const isProfileNotFound = fullUser.message === "Profile not found for this user";
            const is404Code = fullUser.code === 404;

            if (is404 || isProfileNotFound || (is404Code && isProfileNotFound) || (is404Code && !fullUser.personal_info)) {
              Alert.alert("User Not Found", "This account is not registered. Would you like to sign up?", [
                {
                  text: "Cancel",
                  style: "cancel",
                },
                {
                  text: "Sign Up",
                  onPress: () => {
                    navigation.navigate("UserInfo", {
                      googleUserInfo: {
                        email: userInfo.user.email,
                        firstName: userInfo.user.givenName,
                        lastName: userInfo.user.familyName,
                        profilePicture: userInfo.user.photo,
                        googleId: userInfo.user.id,
                        accessToken: userInfo.idToken,
                      },
                    });
                  },
                },
              ]);
              resolve();
              return;
            }

            // Store additional user data in AsyncStorage
            if (fullUser.personal_info?.profile_personal_uid) {
              await AsyncStorage.setItem("profile_uid", fullUser.personal_info.profile_personal_uid);
              console.log("App.js - Stored profile_uid in AsyncStorage:", fullUser.personal_info.profile_personal_uid);
            }
            if (userInfo.user.email) {
              await AsyncStorage.setItem("user_email_id", userInfo.user.email);
              console.log("App.js - Stored user_email_id in AsyncStorage:", userInfo.user.email);
            }

            // Navigate to Profile
            navigation.navigate("Profile", {
              user: {
                ...fullUser,
                user_email: userInfo.user.email,
              },
              profile_uid: fullUser.personal_info?.profile_personal_uid || "",
            });
            resolve();
          } else {
            Alert.alert("User Not Found", "This account is not registered. Would you like to sign up?", [
              {
                text: "Cancel",
                style: "cancel",
              },
              {
                text: "Sign Up",
                onPress: () => {
                  navigation.navigate("UserInfo", {
                    googleUserInfo: {
                      email: userInfo.user.email,
                      firstName: userInfo.user.givenName,
                      lastName: userInfo.user.familyName,
                      profilePicture: userInfo.user.photo,
                      googleId: userInfo.user.id,
                      accessToken: userInfo.idToken,
                    },
                  });
                },
              },
            ]);
            resolve();
          }
        } catch (error) {
          console.error("App.js - Error processing Google Sign-In:", error);
          Alert.alert("Sign In Failed", error.message || "Please try again.");
          reject(error);
        }
      };

      // Initialize Google Identity Services
      window.google.accounts.id.initialize({
        client_id: webClientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Trigger the Google Sign-In prompt (One Tap or popup)
      console.log("App.js - Triggering Google Sign-In");
      window.google.accounts.id.prompt((notification) => {
        console.log("App.js - Prompt notification:", notification);
        if (notification.isNotDisplayed()) {
          const reason = notification.getNotDisplayedReason();
          console.log("App.js - Prompt not displayed, reason:", reason);
          // If One Tap doesn't work, we can show a fallback message
          // The user can still use the button which will trigger the flow
        } else if (notification.isSkippedMoment()) {
          console.log("App.js - Prompt skipped, reason:", notification.getSkippedReason());
        } else if (notification.isDismissedMoment()) {
          console.log("App.js - Prompt dismissed, reason:", notification.getDismissedReason());
        }
      });
    } catch (error) {
      console.error("App.js - Error initializing Google Sign-In:", error);
      Alert.alert("Error", "Failed to initialize Google Sign-In. Please try again.");
      reject(error);
    }
  };

  const signInHandler = useCallback(async (navigation) => {
    console.log("App.js - Google Sign In Pressed - signInHandler - Starting");
    console.log("App.js - Platform:", isWeb ? "Web" : "Native");

    // Handle web Google Sign-In differently
    if (isWeb) {
      console.log("App.js - Web platform: Using Google Identity Services");
      try {
        await handleWebGoogleSignIn(navigation);
      } catch (error) {
        console.error("App.js - Web Google Sign-In error:", error);
        Alert.alert("Sign In Failed", "Please try again.");
      }
      return;
    }

    // Native Google Sign-In
    if (!GoogleSignin) {
      Alert.alert("Not Available", "Google Sign-In is not available. Please use email/password login.");
      return;
    }

    try {
      // First check if user is already signed in
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (isSignedIn) {
        await GoogleSignin.signOut();
      }

      // Check for Play Services
      await GoogleSignin.hasPlayServices();

      // Start new sign in process
      const userInfo = await GoogleSignin.signIn();
      console.log("App.js - Google Sign In successful:", userInfo);

      const response = await fetch(`${GOOGLE_SIGNIN_ENDPOINT}/${userInfo.user.email}`);
      const result = await response.json();
      console.log("App.js - Google Sign In result:", result);

      if (result.message === "Correct Email" && result.result?.[0]) {
        const user_uid = result.result[0];
        console.log("App.js - User UID (from IO Login API):", user_uid);
        await AsyncStorage.setItem("user_uid", user_uid);

        // const profileResponse = await fetch(`https://ioec2ecaspm.infiniteoptions.com/api/v1/userprofileinfo/${user_uid}`);
        const baseURI = API_BASE_URL;
        const endpointPath = `/api/v1/userprofileinfo/${user_uid}`;
        const endpoint = baseURI + endpointPath;
        console.log(`App.js - Full endpoint 1: ${endpoint}`);

        const profileResponse = await fetch(endpoint);
        const fullUser = await profileResponse.json();

        console.log("App.js - Endpoint Response:", JSON.stringify(fullUser, null, 2));

        // Handle case where profile is not found (404 error)
        const is404 = !profileResponse.ok && profileResponse.status === 404;
        const isProfileNotFound = fullUser.message === "Profile not found for this user";
        const is404Code = fullUser.code === 404;

        if (is404 || isProfileNotFound || (is404Code && isProfileNotFound) || (is404Code && !fullUser.personal_info)) {
          // Sign out from Google when profile is not found
          await GoogleSignin.signOut();

          Alert.alert("User Not Found", "This account is not registered. Would you like to sign up?", [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => {
                // No need to do anything here as we've already signed out
              },
            },
            {
              text: "Sign Up",
              onPress: () => {
                // Navigate directly to UserInfo with Google user info
                navigation.navigate("UserInfo", {
                  googleUserInfo: {
                    email: userInfo.user.email,
                    firstName: userInfo.user.givenName,
                    lastName: userInfo.user.familyName,
                    profilePicture: userInfo.user.photo,
                    googleId: userInfo.user.id,
                    accessToken: userInfo.idToken,
                  },
                });
              },
            },
          ]);
          return;
        }

        // Store additional user data in AsyncStorage for ProfileScreen
        if (fullUser.personal_info?.profile_personal_uid) {
          await AsyncStorage.setItem("profile_uid", fullUser.personal_info.profile_personal_uid);
          console.log("App.js - Stored profile_uid in AsyncStorage:", fullUser.personal_info.profile_personal_uid);
        } else {
          console.log("App.js - Warning: No profile_personal_uid found in fullUser:", fullUser);
        }
        if (userInfo.user.email) {
          await AsyncStorage.setItem("user_email_id", userInfo.user.email);
          console.log("App.js - Stored user_email_id in AsyncStorage:", userInfo.user.email);
        } else {
          console.log("App.js - Warning: No email found in userInfo:", userInfo);
        }

        // Log all AsyncStorage values for debugging
        const storedUid = await AsyncStorage.getItem("user_uid");
        const storedProfileUid = await AsyncStorage.getItem("profile_uid");
        const storedEmail = await AsyncStorage.getItem("user_email_id");
        console.log("App.js - AsyncStorage after update - user_uid:", storedUid, "profile_uid:", storedProfileUid, "user_email_id:", storedEmail);

        console.log("App.js - Navigating to Profile with user data:", {
          user: {
            ...fullUser,
            user_email: userInfo.user.email,
          },
          profile_uid: fullUser.personal_info?.profile_personal_uid || "",
        });

        navigation.navigate("Profile", {
          user: {
            ...fullUser,
            user_email: userInfo.user.email,
          },
          profile_uid: fullUser.personal_info?.profile_personal_uid || "",
        });
      } else {
        // Sign out from Google when user is not found
        await GoogleSignin.signOut();

        Alert.alert("User Not Found", "This account is not registered. Would you like to sign up?", [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {
              // No need to do anything here as we've already signed out
            },
          },
          {
            text: "Sign Up",
            onPress: () => {
              // Navigate directly to UserInfo with Google user info
              navigation.navigate("UserInfo", {
                googleUserInfo: {
                  email: userInfo.user.email,
                  firstName: userInfo.user.givenName,
                  lastName: userInfo.user.familyName,
                  profilePicture: userInfo.user.photo,
                  googleId: userInfo.user.id,
                  accessToken: userInfo.idToken,
                },
              });
            },
          },
        ]);
      }
    } catch (err) {
      console.error("App.js - Google Sign In error:", err);
      if (statusCodes) {
        if (err.code === statusCodes.SIGN_IN_CANCELLED) {
          // User cancelled the login flow
          return;
        }
        if (err.code === statusCodes.IN_PROGRESS) {
          // Sign in is in progress already
          Alert.alert("Sign In In Progress", "Please wait for the current sign in process to complete.");
          return;
        }
      }
      Alert.alert("Sign In Failed", "Please try again.");
    }
  }, []);

  const signUpHandler = useCallback(async (navigation) => {
    console.log("App.js - signUpHandler - Google Button Pressed");

    // Google Sign-In is not available on web
    if (isWeb || !GoogleSignin) {
      Alert.alert("Not Available", "Google Sign-In is not available on web. Please use email/password sign up.");
      return;
    }

    try {
      // Clear AsyncStorage before starting sign up to avoid stale data
      await AsyncStorage.clear();
      // Check if already signed in
      const isSignedIn = await GoogleSignin.isSignedIn();
      console.log("App.js - Is user already signed in?", isSignedIn);

      if (isSignedIn) {
        console.log("App.js - Signing out existing user");
        await GoogleSignin.signOut();
      }

      // Check for Play Services
      console.log("App.js - Checking Play Services");
      await GoogleSignin.hasPlayServices();
      console.log("App.js - Play Services available");

      // Get user info from Google
      console.log("App.js - Starting Google Sign In");
      const userInfo = await GoogleSignin.signIn();
      console.log("App.js - Google Sign In successful");
      console.log("App.js - User Info:", {
        email: userInfo.user.email,
        name: userInfo.user.name,
        givenName: userInfo.user.givenName,
        familyName: userInfo.user.familyName,
        photo: userInfo.user.photo,
        id: userInfo.user.id,
      });

      // Get tokens for backend authentication
      console.log("App.js - Getting tokens");
      const tokens = await GoogleSignin.getTokens();
      console.log("App.js - Tokens received:", {
        accessToken: tokens.accessToken ? "Present" : "Missing",
        idToken: tokens.idToken ? "Present" : "Missing",
      });

      // Create the sign-up payload
      const payload = {
        email: userInfo.user.email,
        password: "GOOGLE_LOGIN",
        google_auth_token: tokens.accessToken,
        social_id: userInfo.user.id,
        first_name: userInfo.user.givenName || "",
        last_name: userInfo.user.familyName || "",
        profile_picture: userInfo.user.photo || "",
      };
      console.log("App.js - Sign up payload prepared:", payload);

      // Make the sign-up request
      console.log("App.js - Making sign-up request");
      const response = await fetch(GOOGLE_SIGNUP_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log("App.js - Sign up response:", result);

      if (result.user_uid && result.code >= 200 && result.code < 300) {
        console.log("App.js - Sign up successful, storing user data");
        await AsyncStorage.setItem("user_uid", result.user_uid);
        await AsyncStorage.setItem("user_email_id", userInfo.user.email);
        // if (user_uid) {
        //   navigation.navigate("UserInfo");
        // } else {
        //   Alert.alert("Error", "Failed to store user ID. Please try again.");
        // }
      } else if (result.message === "User already exists") {
        console.log("App.js - User already exists, treating as successful login");

        // Store user data as if it was a successful login
        await AsyncStorage.setItem("user_uid", result.user_uid || userInfo.user.id);
        await AsyncStorage.setItem("user_email_id", userInfo.user.email);

        // Fetch user profile data
        const baseURI = API_BASE_URL;
        const endpointPath = `/api/v1/userprofileinfo/${result.user_uid || userInfo.user.id}`;
        const endpoint = baseURI + endpointPath;
        console.log(`App.js - Fetching profile for existing user: ${endpoint}`);

        const profileResponse = await fetch(endpoint);
        const fullUser = await profileResponse.json();
        console.log("App.js - Existing user profile:", JSON.stringify(fullUser, null, 2));

        // Handle case where profile is not found (404 error)
        // Check response status, response body message, and code
        const is404 = !profileResponse.ok && profileResponse.status === 404;
        const isProfileNotFound = fullUser.message === "Profile not found for this user";
        const is404Code = fullUser.code === 404;

        if (is404 || isProfileNotFound || (is404Code && isProfileNotFound) || (is404Code && !fullUser.personal_info)) {
          console.log("App.js - Profile not found for existing user, routing to UserInfo");
          // Clear any existing profile data but keep user credentials
          await AsyncStorage.multiRemove(["profile_uid", "user_first_name", "user_last_name", "user_phone_number"]);
          await AsyncStorage.setItem("user_uid", result.user_uid || userInfo.user.id);
          await AsyncStorage.setItem("user_email_id", userInfo.user.email);

          // Navigate to UserInfo to complete profile
          navigation.navigate("UserInfo", {
            googleUserInfo: {
              email: userInfo.user.email,
              firstName: userInfo.user.givenName,
              lastName: userInfo.user.familyName,
              profilePicture: userInfo.user.photo,
              googleId: userInfo.user.id,
              accessToken: tokens.accessToken,
            },
          });
          return;
        }

        if (fullUser && fullUser.personal_info?.profile_personal_uid) {
          await AsyncStorage.setItem("profile_uid", fullUser.personal_info.profile_personal_uid);

          // Navigate to Profile page as if it was a successful login
          navigation.navigate("Profile", {
            user: {
              ...fullUser,
              user_email: userInfo.user.email,
            },
            profile_uid: fullUser.personal_info.profile_personal_uid,
          });
        } else {
          // Fallback if profile not found (but not a 404)
          Alert.alert("Profile Not Found", "Your account exists but profile data could not be loaded. Please try signing in instead.", [
            {
              text: "OK",
              onPress: () => navigation.navigate("Login"),
            },
          ]);
        }
        return; // Add return to prevent further execution
      } else {
        console.log("App.js - Failed to create account");
        throw new Error("Failed to create account");
      }
      if (await AsyncStorage.getItem("user_uid")) {
        // Pass Google user info to UserInfoScreen for pre-filling
        navigation.navigate("UserInfo", {
          googleUserInfo: {
            email: userInfo.user.email,
            firstName: userInfo.user.givenName,
            lastName: userInfo.user.familyName,
            profilePicture: userInfo.user.photo,
            googleId: userInfo.user.id,
            accessToken: tokens.accessToken,
          },
        });
      } else {
        Alert.alert("Error", "Failed to store user ID. Please try again.");
      }
    } catch (err) {
      console.error("App.js - Google Sign Up error:", err);
      if (statusCodes) {
        if (err.code === statusCodes.SIGN_IN_CANCELLED) {
          console.log("App.js - User cancelled the sign-in flow");
          return;
        }
        if (err.code === statusCodes.IN_PROGRESS) {
          console.log("App.js - Sign in already in progress");
          Alert.alert("Sign In In Progress", "Please wait for the current sign in process to complete.", [{ text: "OK" }]);
          return;
        }
      }
      Alert.alert("Sign Up Failed", "Unable to create account. Please try again.", [{ text: "OK" }]);
    }
  }, []);

  const handleAppleSignIn = useCallback(async (userInfo, navigation) => {
    try {
      console.log("App.js - handleAppleSignIn - userInfo:", userInfo);
      const { user, idToken } = userInfo;
      // console.log("App.js - handleAppleSignIn - user:", user);
      // console.log("App.js - handleAppleSignIn - idToken:", idToken);
      let userEmail = user.email;
      // console.log("App.js - handleAppleSignIn - userEmail:", userEmail);
      if (!userEmail && idToken) {
        // console.log("App.js - handleAppleSignIn - idToken:", idToken);
        const payload = JSON.parse(atob(idToken.split(".")[1]));
        userEmail = payload?.email || `apple_user_${user.id}@example.com`;
        // console.log("App.js - handleAppleSignIn - userEmail:", userEmail);
      }
      console.log("App.js - handleAppleSignIn - before APPLE_SIGNIN_ENDPOINT:", APPLE_SIGNIN_ENDPOINT);
      const response = await fetch(APPLE_SIGNIN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: user.id,
        }),
      });
      console.log("App.js - handleAppleSignIn - after APPLE_SIGNIN_ENDPOINT:", response);
      const result = await response.json();
      console.log("App.js - handleAppleSignIn - result:", result);
      // if (result.message === "Correct Email" && result.result?.[0]) {
      if (result.message === "Successfully executed SQL query." && result.result?.[0]) {
        const userUid = result.result[0].user_uid;
        await AsyncStorage.setItem("user_uid", userUid);
        // console.log("Success", userUid);

        // Get full user profile data
        // const profileResponse = await fetch(`https://ioec2ecaspm.infiniteoptions.com/api/v1/userprofileinfo/${userUid}`);
        const baseURI = API_BASE_URL;
        const endpointPath = `/api/v1/userprofileinfo/${userUid}`;
        const endpoint = baseURI + endpointPath;
        console.log(`App.js - Full endpoint 2: ${endpoint}`);

        const profileResponse = await fetch(endpoint);
        const fullUser = await profileResponse.json();
        console.log("App.js - Full user 2:", JSON.stringify(fullUser, null, 2));

        // Handle case where profile is not found (404 error)
        const is404 = !profileResponse.ok && profileResponse.status === 404;
        const isProfileNotFound = fullUser.message === "Profile not found for this user";
        const is404Code = fullUser.code === 404;

        if (is404 || isProfileNotFound || (is404Code && isProfileNotFound) || (is404Code && !fullUser.personal_info)) {
          console.log("App.js - Profile not found for Apple sign in user, routing to UserInfo");
          // Clear any existing profile data but keep user credentials
          await AsyncStorage.multiRemove(["profile_uid", "user_first_name", "user_last_name", "user_phone_number"]);
          await AsyncStorage.setItem("user_uid", userUid);
          await AsyncStorage.setItem("user_email_id", userEmail);

          // Navigate to UserInfo to complete profile
          navigation.navigate("UserInfo", {
            appleUserInfo: {
              email: userEmail,
              firstName: user.name?.split(" ")[0] || "",
              lastName: user.name?.split(" ").slice(1).join(" ") || "",
              appleId: user.id,
              idToken: idToken,
            },
          });
          return;
        }

        await AsyncStorage.setItem("profile_uid", fullUser.personal_info?.profile_personal_uid || "");
        await AsyncStorage.setItem("user_email_id", fullUser.user_email || "");
        // await AsyncStorage.setItem("user_name", user.name);
        // await AsyncStorage.setItem("user_id", fullUser.personal_info?.profile_personal_user_id || "");

        navigation.navigate("Profile", {
          user: {
            ...fullUser,
            user_email: userEmail,
          },
          profile_uid: fullUser.personal_info?.profile_personal_uid || "",
        });
      }
    } catch (err) {
      setError(err.message);
      console.log("Fail");
      Alert.alert("Apple Sign In Failed", err.message);
    }
  }, []);

  const handleAppleSignUp = useCallback(async (userInfo, navigation) => {
    try {
      const { user, idToken } = userInfo;
      let userEmail = user.email || `apple_user_${user.id}@example.com`;
      const payload = {
        email: userEmail,
        password: "APPLE_LOGIN",
        google_auth_token: idToken,
        google_refresh_token: "apple",
        social_id: user.id,
        first_name: user.name?.split(" ")[0] || "",
        last_name: user.name?.split(" ").slice(1).join(" ") || "",
        profile_picture: "",
        login_type: "apple",
      };
      const response = await fetch(GOOGLE_SIGNUP_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result.user_uid) {
        await AsyncStorage.setItem("user_uid", result.user_uid);
        // Pass Apple user info to UserInfoScreen for pre-filling
        navigation.navigate("UserInfo", {
          appleUserInfo: {
            email: userEmail,
            firstName: user.name?.split(" ")[0] || "",
            lastName: user.name?.split(" ").slice(1).join(" ") || "",
            appleId: user.id,
            idToken: idToken,
          },
        });
      }
    } catch (err) {
      setError(err.message);
      Alert.alert("Apple Sign Up Failed", err.message);
    }
  }, []);

  if (loading) {
    console.log("App.js - Showing loading screen");
    return (
      <SafeAreaProvider>
        <View style={styles.centeredContainer}>
          <ActivityIndicator size='large' color='#0000ff' />
          <Text style={{ marginTop: 10 }}>Loading...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (error) {
    console.error("App.js - Showing error screen:", error);
    return (
      <SafeAreaProvider>
        <View style={styles.centeredContainer}>
          <Text style={{ color: "red", marginBottom: 10 }}>Error: {error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Text>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  const HomeScreen = ({ navigation }) => {
    console.log("App.js - Rendering HomeScreen");
    const [hasLoggedPlaying, setHasLoggedPlaying] = useState(false);
    // Static timestamp - set once when component mounts (represents last build/change time)
    const [buildTimestamp] = useState(new Date());

    // Format date and time
    const formatDateTime = (date) => {
      const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      };
      return date.toLocaleString("en-US", options);
    };

    // Load Castoro font for web (both regular and italic variants)
    useEffect(() => {
      if (Platform.OS === "web" && typeof document !== "undefined") {
        // Check if font is already loaded
        if (!document.getElementById("castoro-font")) {
          const link = document.createElement("link");
          link.id = "castoro-font";
          link.rel = "stylesheet";
          link.href = "https://fonts.googleapis.com/css2?family=Castoro:ital,wght@0,400;1,400&display=swap";
          document.head.appendChild(link);
        }
      }
    }, []);

    return (
      <View style={styles.container}>
        <View style={styles.contentBox}>
          {/* Welcome Text */}
          <Text style={styles.welcomeText}>Welcome!</Text>

          <View style={styles.circleMain}>
            <Image source={require("./assets/everycirclelogonew_1024x1024.png")} style={{ width: 200, height: 200, resizeMode: "contain" }} accessibilityLabel='Every Circle Logo' />
            {/* <View style={styles.videoContainer}>
            <Video
              source={{ uri: "https://every-circle.s3.us-west-1.amazonaws.com/EveryB2B.mp4" }}
              style={styles.video}
              resizeMode='contain'
              isLooping
              shouldPlay
              isMuted={true}
              useNativeControls={false}
            />
          </View> */}
          </View>

          {/* Branding Text */}
          <View style={styles.brandingContainer}>
            <Text style={styles.brandName}>
              <Text style={styles.brandItalicText}>every</Text>
              <Text style={styles.brandRegularText}>Circle</Text>
              <Text style={styles.brandText}>.com</Text>
            </Text>
            <Text style={styles.tagline}>Connecting Circles of Influence</Text>
            {/* <Text style={styles.tagline}>It Pays to Be Connected</Text> */}

            {/* Build Timestamp - Last Change Date/Time with Version */}
            <Text style={styles.dateTimeText}>
              PM 1.0.5 Version {versionData.major}.{versionData.build} - Last Change: {versionData.last_change}
            </Text>
          </View>

          <View style={styles.circlesContainer}>
            <TouchableOpacity style={styles.circleBox} onPress={() => navigation.navigate("SignUp")}>
              {/* <View style={[styles.circle, { backgroundColor: "#007AFF" }]}> */}
              <View style={[styles.circle, { backgroundColor: "#800000" }]}>
                <Text style={styles.circleText}>Sign Up</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.circleBox} onPress={() => navigation.navigate("HowItWorksScreen")}>
              {/* <View style={[styles.circle, { backgroundColor: "#00C7BE" }]}> */}
              <View style={[styles.circle, { backgroundColor: "#FF9500" }]}>
                <Text style={styles.circleText}>How It Works</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.circleBox}
              onPress={() => {
                console.log("App.js - Login Button Pressed");
                navigation.navigate("Login");
              }}
            >
              {/* <View style={[styles.circle, { backgroundColor: "#AF52DE" }]}> */}
              <View style={[styles.circle, { backgroundColor: "#2434C2" }]}>
                <Text style={styles.circleText}>Log In</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  console.log("App.js - Rendering main App component with initialRoute:", initialRoute);

  // Add error boundary wrapper
  if (error) {
    console.error("App.js - Error state:", error);
  }

  // Configure linking for web URL routing
  const linking = {
    prefixes: ["everycircle://", "https://everycircle.com", "http://everycircle.com", "http://localhost:8081"],
    config: {
      screens: {
        Home: "",
        NewConnection: {
          path: "newconnection/:profile_uid?",
          parse: {
            profile_uid: (profile_uid) => profile_uid,
          },
        },
        Connect: {
          path: "connect",
          parse: {
            profile_uid: (profile_uid) => profile_uid,
          },
        },
        Login: "login",
        SignUp: "signup",
        Profile: "profile",
        Network: "network",
        Search: "search",
        Settings: "settings",
      },
    },
  };

  return (
    <TextNodeErrorBoundary>
      <DarkModeProvider>
        <NavigationContainer
          linking={isWeb ? linking : undefined}
          onReady={() => console.log("App.js - NavigationContainer ready")}
          onStateChange={() => console.log("App.js - Navigation state changed")}
        >
          <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
            <Stack.Screen name='Home' component={HomeScreen} />
            <Stack.Screen
              name='Login'
              children={(props) => (
                <LoginScreen {...props} onGoogleSignIn={() => signInHandler(props.navigation)} onAppleSignIn={(userInfo) => handleAppleSignIn(userInfo, props.navigation)} onError={setError} />
              )}
            />
            <Stack.Screen
              name='SignUp'
              children={(props) => (
                <SignUpScreen {...props} onGoogleSignUp={() => signUpHandler(props.navigation)} onAppleSignUp={(userInfo) => handleAppleSignUp(userInfo, props.navigation)} onError={setError} />
              )}
            />
            <Stack.Screen name='HowItWorksScreen' component={HowItWorksScreen} />
            <Stack.Screen name='UserInfo' component={UserInfoScreen} />
            {/* <Stack.Screen name="UserProfile" component={UserProfile} /> */}
            <Stack.Screen name='AccountType' component={AccountTypeScreen} />
            <Stack.Screen name='Profile' component={ProfileScreen} />
            <Stack.Screen name='EditProfile' component={EditProfileScreen} />
            <Stack.Screen name='Settings' component={SettingsScreen} />
            <Stack.Screen name='Account' component={AccountScreen} />
            <Stack.Screen name='Network' component={NetworkScreen} />
            <Stack.Screen name='Search' component={SearchScreen} />
            <Stack.Screen name='BusinessSetup' component={BusinessSetupController} />
            <Stack.Screen name='BusinessProfile' component={BusinessProfileScreen} />
            <Stack.Screen name='ChangePassword' component={ChangePasswordScreen} />
            <Stack.Screen name='Filters' component={FilterScreen} />
            <Stack.Screen name='SearchTab' component={SearchTab} />

            <Stack.Screen name='TermsAndConditions' component={TermsAndConditionsScreen} options={{ title: "Terms & Conditions" }} />
            <Stack.Screen name='PrivacyPolicy' component={PrivacyPolicyScreen} options={{ title: "Privacy Policy" }} />
            <Stack.Screen name='EditBusinessProfile' component={EditBusinessProfileScreen} />
            <Stack.Screen name='ShoppingCart' component={ShoppingCartScreen} />
            <Stack.Screen name='ReviewBusiness' component={ReviewBusinessScreen} options={{ headerShown: false }} />
            <Stack.Screen name='ReviewDetail' component={ReviewDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name='ExpertiseDetail' component={ExpertiseDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name='WishDetail' component={WishDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name='WishResponses' component={WishResponsesScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name='Connect'
              component={ConnectScreenWrapper}
            />
            <Stack.Screen name='NewConnection' component={NewConnectionScreen} />
            <Stack.Screen name='QRScanner' component={QRScannerScreen} options={{ headerShown: false }} />
          </Stack.Navigator>
        </NavigationContainer>
      </DarkModeProvider>
    </TextNodeErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  contentBox: {
    borderWidth: 2,
    borderColor: "#fff",
    alignSelf: "center",
    padding: 20,
    alignItems: "center",
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  circlesContainer: {
    marginTop: 50,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    padding: 20,
  },
  circleBox: {
    margin: 10,
    alignItems: "center",
  },
  circleMain: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
    position: "relative",
  },
  videoContainer: {
    width: 300,
    height: 300,
    overflow: "hidden",
    borderRadius: 150,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "red",
  },
  video: {
    width: 200,
    height: 200,
  },
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
  },
  circleText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  welcomeText: {
    fontSize: 36,
    fontFamily: "Georgia",
    fontStyle: "italic",
    color: "#000",
    textAlign: "center",
    marginTop: 40,
    marginBottom: 20,
  },
  dateTimeText: {
    fontSize: 14,
    fontFamily: Platform.OS === "web" ? "Arial, sans-serif" : undefined,
    color: "#666",
    textAlign: "left",
    marginTop: 8,
  },
  brandingContainer: {
    alignItems: "flex-start",
    marginTop: 20,
    marginBottom: 20,
    width: "100%",
    paddingHorizontal: 30, // Match circlesContainer padding (20) + circleBox margin (10) to align with Sign Up button
  },
  brandName: {
    fontSize: 36,
    fontStyle: "regular",
    // fontWeight: "bold",
    fontFamily: Platform.OS === "web" ? "Arial, sans-serif" : undefined,
    color: "#000",
    textAlign: "left",
  },
  brandItalicText: {
    fontStyle: "italic",
    fontFamily: Platform.OS === "web" ? '"Castoro", serif' : "Castoro",
  },
  brandRegularText: {
    color: "#800000",
    fontFamily: Platform.OS === "web" ? '"Castoro", serif' : "Castoro",
    fontStyle: "normal", // Explicitly set to normal to override any italic inheritance
    fontWeight: "normal", // Ensure normal weight
  },
  brandText: {
    color: "#000",
    fontSize: 20,
  },
  tagline: {
    fontSize: 24,
    // fontStyle: "italic",
    fontFamily: Platform.OS === "web" ? "Arial, sans-serif" : undefined,
    color: "#000",
    textAlign: "left",
    marginTop: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    fontFamily: "Georgia",
    marginTop: 100,
    textAlign: "center",
    // borderWidth: 2,
    // borderColor: "red",
    padding: 10,
  },
  italicText: {
    fontStyle: "italic",
    fontFamily: "Georgia",
  },
  apiKeysContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    padding: 10,
    borderRadius: 5,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    position: "absolute",
    top: "60%",
    width: "90%",
  },
});
