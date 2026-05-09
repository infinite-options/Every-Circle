import "./polyfills";
// Inject borderless input CSS early on web (removes native input shadow/border for Levels to Display, etc.)
if (typeof document !== "undefined" && document.head) {
  require("./utils/injectBorderlessInputStyles");
}
import React, { useEffect, useState, useCallback, useRef } from "react";
import { LogBox, Platform, useWindowDimensions, StyleSheet, Text, View, Alert, ActivityIndicator, TouchableOpacity, Image } from "react-native";

// Check if we're on web by checking for window object (works at module load time)
// This must be defined before any code that uses it
const isWeb = typeof window !== "undefined" && typeof document !== "undefined";

// Set to false to POST to `APPLE_AUTH_ENDPOINT` and continue sign-in (profile) flow.
const DEBUG_APPLE_SIGNIN_SKIP_BACKEND = false;

// Video component removed - expo-av was causing build issues with new architecture
// If needed in the future, re-add expo-av and configure it properly

// Suppress VirtualizedList nesting warning - we're using nestedScrollEnabled and proper configuration
LogBox.ignoreLogs(["VirtualizedLists should never be nested inside plain ScrollViews"]);
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearUserProfileCacheStorage } from "./utils/sessionProfile";

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
import { GOOGLE_SOCIAL_AUTH_ENDPOINT, APPLE_AUTH_ENDPOINT, API_BASE_URL } from "./apiConfig";
import versionData from "./version.json";
import { DarkModeProvider } from "./contexts/DarkModeContext";
import { UnreadProvider } from "./contexts/UnreadContext";
import MessageNotificationBanner from "./components/MessageNotificationBanner";
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
import InboxScreen from "./screens/InboxScreen";
import ChatScreen from "./screens/ChatScreen";
import AddReviewSearchScreen from "./screens/AddReviewSearchScreen";
import { clearEphemeralReferralKeysOnLaunch, maybeClearAllStorageOnColdStartFromEnv } from "./utils/clearAppAsyncStorage";

const Stack = createNativeStackNavigator();

export const mapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const mapsApiKeyDisplay = mapsApiKey ? "..." + mapsApiKey.slice(-4) : "Not set";

/** Home screen: show version / last-build line (PM version, app version, last change). */
const SHOW_HOME_BUILD_INFO = true;

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

/** Body for POST `api/v2/AppleAuth/EVERY-CIRCLE` (snake_case keys for the API). */
function buildAppleAuthRequestBody(userInfo) {
  const { user, idToken, authorizationCode, firstName, lastName } = userInfo;
  let sub = user?.id ?? "";
  let email = user?.email ?? "";
  if (idToken && typeof idToken === "string" && idToken.includes(".")) {
    try {
      const part = idToken.split(".")[1];
      if (part) {
        const claims = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
        if (claims.sub) sub = claims.sub;
        if (claims.email && (!email || email === "Apple User")) email = claims.email;
      }
    } catch (_) {
      /* keep user id / email */
    }
  }
  if (email === "Apple User") {
    email = "";
  }
  let first_name = firstName != null && firstName !== "" ? firstName : "";
  let last_name = lastName != null && lastName !== "" ? lastName : "";
  if (first_name === "" && last_name === "" && user?.name && user.name !== "Apple User") {
    const p = String(user.name).trim().split(/\s+/).filter(Boolean);
    if (p.length) {
      first_name = p[0];
      last_name = p.slice(1).join(" ");
    }
  }
  return {
    code: authorizationCode != null && String(authorizationCode) !== "" ? String(authorizationCode) : null,
    id_token: idToken,
    sub: sub || "",
    email: email || "",
    first_name,
    last_name,
  };
}

/**
 * Sign in and Sign up with Apple: same POST to `APPLE_AUTH_ENDPOINT`, then profile or UserInfo.
 * @param {boolean} options.clearStorage - true for Sign Up (clean slate, like Google sign-up)
 */
async function completeAppleAuthSession(navigation, userInfo, options) {
  const { clearStorage = false, setError, failureAlertTitle = "Apple" } = options;
  try {
    if (clearStorage) {
      await AsyncStorage.clear();
    }
    const { user, idToken, authorizationCode } = userInfo;
    console.log("=== App.js: Apple — userInfo (from AppleSignIn) ===", userInfo);
    if (idToken && typeof idToken === "string" && idToken.includes(".")) {
      try {
        const b64 = idToken.split(".")[1];
        const claims = JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/")));
        console.log("=== App.js: id_token JWT payload ===", claims);
      } catch (e) {
        console.log("=== App.js: id_token not decodable as JWT ===", e?.message);
      }
    } else {
      console.log("=== App.js: no id_token in userInfo ===");
    }
    if (authorizationCode) {
      console.log("=== App.js: authorization code ===\n", authorizationCode);
    }
    const appleAuthBody = buildAppleAuthRequestBody(userInfo);
    console.log("=== App.js: AppleAuth POST body ===", JSON.stringify(appleAuthBody, null, 2));
    if (DEBUG_APPLE_SIGNIN_SKIP_BACKEND) {
      console.log("=== App.js: DEBUG_APPLE_SIGNIN_SKIP_BACKEND is true — skipping fetch to", APPLE_AUTH_ENDPOINT);
      return;
    }
    const response = await fetch(APPLE_AUTH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(appleAuthBody),
    });
    const result = await response.json();
    console.log("App.js - AppleAuth response:", response.status, result);
    if (!response.ok) {
      throw new Error(result.message || `Apple auth failed (${response.status})`);
    }
    const userEmail =
      appleAuthBody.email ||
      (idToken && idToken.includes(".")
        ? (() => {
            try {
              return JSON.parse(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).email;
            } catch (_) {
              return "";
            }
          })()
        : "") ||
      (user?.email && user.email !== "Apple User" ? user.email : "");
    let userUid = result.user_uid ?? result.userUid;
    if (userUid == null && Array.isArray(result.result) && result.result[0]) {
      userUid = result.result[0].user_uid ?? result.result[0].userUid;
    }
    if (userUid == null && result.data?.user_uid != null) {
      userUid = result.data.user_uid;
    }
    if (userUid == null) {
      console.warn("App.js - AppleAuth: no user_uid in response:", result);
      throw new Error("Apple auth did not return a user id");
    }
    await AsyncStorage.setItem("user_uid", String(userUid));
    await AsyncStorage.setItem("user_email_id", userEmail || "");
    await AsyncStorage.multiRemove(["profile_uid", "user_first_name", "user_last_name", "user_phone_number"]);
    await clearUserProfileCacheStorage();

    const appleUserInfoPayload = {
      email: userEmail,
      firstName: user.name?.split(" ")[0] || userInfo.firstName || "",
      lastName: user.name?.split(" ").slice(1).join(" ") || userInfo.lastName || "",
      appleId: user.id,
      idToken: idToken,
    };

    const existingAccount = isExistingSocialAccountApiResult(result);

    if (existingAccount) {
      navigation.navigate("Profile", {
        oauthPrefill: {
          appleUserInfo: appleUserInfoPayload,
        },
      });
    } else {
      navigation.navigate("SignUp", {
        pendingReferralAfterOAuth: true,
        appleUserInfo: appleUserInfoPayload,
      });
    }
  } catch (err) {
    setError?.(err.message);
    console.log("Fail");
    Alert.alert(`${failureAlertTitle} Failed`, err.message);
  }
}

/** Backend signals an existing account (login); new registrations should collect referrer first. */
function isExistingSocialAccountApiResult(result) {
  const msg = String(result?.message ?? "").toLowerCase();
  return msg.includes("user already exists") || msg.includes("already exists");
}

/**
 * Unified Google path (Sign in + Sign up): POST to social auth, then open Profile on success.
 * @param {string} googleAuthToken - Native access token, or web ID token (JWT)
 * @param {{ clearStorage?: boolean }} [options] - set true for Sign Up screen to start from a clean local session
 */
async function completeGoogleSocialAuth(navigation, userInfo, googleAuthToken, options = {}) {
  const { clearStorage = false } = options;
  if (clearStorage) {
    await AsyncStorage.clear();
  }

  const payload = {
    email: userInfo.user.email,
    password: "GOOGLE_LOGIN",
    google_auth_token: googleAuthToken,
    social_id: userInfo.user.id,
    first_name: userInfo.user.givenName || "",
    last_name: userInfo.user.familyName || "",
    profile_picture: userInfo.user.photo || "",
  };
  console.log("App.js - Google social auth POST:", GOOGLE_SOCIAL_AUTH_ENDPOINT, payload);

  const response = await fetch(GOOGLE_SOCIAL_AUTH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  console.log("App.js - Google social auth response:", result);

  let userUid;
  if (result.user_uid && result.code >= 200 && result.code < 300) {
    userUid = result.user_uid;
  } else if (result.message === "User already exists") {
    userUid = result.user_uid || userInfo.user.id;
  } else {
    console.log("App.js - Google social auth failed:", result);
    throw new Error("Failed to create account");
  }

  if (!userUid) {
    throw new Error("Failed to create account");
  }

  const existingAccount = isExistingSocialAccountApiResult(result);

  await AsyncStorage.setItem("user_uid", String(userUid));
  await AsyncStorage.setItem("user_email_id", userInfo.user.email);
  await AsyncStorage.multiRemove(["profile_uid", "user_first_name", "user_last_name", "user_phone_number"]);
  await clearUserProfileCacheStorage();

  const googleUserInfo = {
    email: userInfo.user.email,
    firstName: userInfo.user.givenName,
    lastName: userInfo.user.familyName,
    profilePicture: userInfo.user.photo,
    googleId: userInfo.user.id,
    accessToken: googleAuthToken,
  };

  if (existingAccount) {
    navigation.navigate("Profile", {
      oauthPrefill: {
        googleUserInfo,
      },
    });
  } else {
    navigation.navigate("SignUp", {
      pendingReferralAfterOAuth: true,
      googleUserInfo,
    });
  }
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState("Home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const navigationRef = useRef(null);
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
        // Optional full wipe (env): logs user out on every relaunch. Otherwise clear only signup referrer cache.
        await maybeClearAllStorageOnColdStartFromEnv();
        await clearEphemeralReferralKeysOnLaunch();

        // Check user first
        console.log("App.js - Checking if user in AsyncStorage...");
        const uid = await AsyncStorage.getItem("user_uid");
        console.log("App.js - User UID:", uid);

        // Check terms acceptance status
        const termsStatus = await AsyncStorage.getItem("termsAccepted");
        const termsAcceptedValue = termsStatus !== null ? JSON.parse(termsStatus) : true;
        setTermsAccepted(termsAcceptedValue);
        console.log("App.js - Terms Accepted:", termsAcceptedValue);

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

    // Failsafe: end splash if init hangs. Use functional setState so we read current
    // loading state (avoids a stale `loading` from the first render always being true at 5s).
    const timeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn("App.js - Loading timeout, forcing load complete");
          return false;
        }
        return prev;
      });
    }, 5000);

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
          initializeWebGoogleSignIn(navigation, resolve, reject, "signIn");
        };
        script.onerror = (error) => {
          console.error("App.js - Failed to load Google Identity Services:", error);
          reject(new Error("Failed to load Google Sign-In library"));
        };
        document.head.appendChild(script);
      } else {
        initializeWebGoogleSignIn(navigation, resolve, reject, "signIn");
      }
    });
  }, []);

  // Web Google Sign-Up: same GSI (JWT) as sign-in, then POST to GOOGLE_SOCIAL_AUTH_ENDPOINT
  const handleWebGoogleSignUp = useCallback(async (navigation) => {
    console.log("App.js - handleWebGoogleSignUp - Starting");
    return new Promise((resolve, reject) => {
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
          console.log("App.js - Google Identity Services script loaded (sign-up)");
          initializeWebGoogleSignIn(navigation, resolve, reject, "signUp");
        };
        script.onerror = (error) => {
          console.error("App.js - Failed to load Google Identity Services:", error);
          reject(new Error("Failed to load Google Sign-In library"));
        };
        document.head.appendChild(script);
      } else {
        initializeWebGoogleSignIn(navigation, resolve, reject, "signUp");
      }
    });
  }, []);

  const initializeWebGoogleSignIn = (navigation, resolve, reject, mode = "signIn") => {
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

          try {
            await completeGoogleSocialAuth(navigation, userInfo, credential, { clearStorage: mode === "signUp" });
            resolve();
          } catch (socialErr) {
            console.error("App.js - Web Google social auth error:", socialErr);
            const title = mode === "signUp" ? "Sign Up Failed" : "Sign In Failed";
            Alert.alert(title, socialErr.message || "Please try again.");
            reject(socialErr);
          }
        } catch (error) {
          console.error("App.js - Error processing Google Sign-In:", error);
          Alert.alert("Sign In Failed", error.message || "Please try again.");
          reject(error);
        }
      };

      // Initialize Google Identity Services
      // use_fedcm_for_prompt: false — avoids Chrome FedCM when user/site disabled it (otherwise
      // console: "FedCM was disabled..." / GSI_LOGGER NetworkError retrieving a token).
      window.google.accounts.id.initialize({
        client_id: webClientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: false,
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

      const tokens = await GoogleSignin.getTokens();
      await completeGoogleSocialAuth(navigation, userInfo, tokens.accessToken, { clearStorage: false });
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

  const signUpHandler = useCallback(
    async (navigation) => {
      console.log("App.js - signUpHandler - Google Button Pressed");

      if (isWeb) {
        try {
          await handleWebGoogleSignUp(navigation);
        } catch (error) {
          console.error("App.js - Web Google Sign-Up error:", error);
        }
        return;
      }

      if (!GoogleSignin) {
        Alert.alert("Not Available", "Google Sign-In is not available. Please use email/password sign up.");
        return;
      }

      try {
        const isSignedIn = await GoogleSignin.isSignedIn();
        if (isSignedIn) {
          await GoogleSignin.signOut();
        }
        await GoogleSignin.hasPlayServices();
        const userInfo = await GoogleSignin.signIn();
        const tokens = await GoogleSignin.getTokens();
        await completeGoogleSocialAuth(navigation, userInfo, tokens.accessToken, { clearStorage: true });
      } catch (err) {
        console.error("App.js - Google Sign Up error:", err);
        if (statusCodes) {
          if (err.code === statusCodes.SIGN_IN_CANCELLED) {
            console.log("App.js - User cancelled the sign-in flow");
            return;
          }
          if (err.code === statusCodes.IN_PROGRESS) {
            Alert.alert("Sign In In Progress", "Please wait for the current sign in process to complete.", [{ text: "OK" }]);
            return;
          }
        }
        Alert.alert("Sign Up Failed", "Unable to create account. Please try again.", [{ text: "OK" }]);
      }
    },
    [handleWebGoogleSignUp],
  );

  const handleAppleSignIn = useCallback(
    async (userInfo, navigation) => {
      await completeAppleAuthSession(navigation, userInfo, {
        clearStorage: false,
        setError,
        failureAlertTitle: "Apple Sign In",
      });
    },
    [setError],
  );

  const handleAppleSignUp = useCallback(
    async (userInfo, navigation) => {
      await completeAppleAuthSession(navigation, userInfo, {
        clearStorage: true,
        setError,
        failureAlertTitle: "Apple Sign Up",
      });
    },
    [setError],
  );

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
    const { width: windowWidth } = useWindowDimensions();
    const [hasLoggedPlaying, setHasLoggedPlaying] = useState(false);
    // Static timestamp - set once when component mounts (represents last build/change time)
    const [buildTimestamp] = useState(new Date());

    // Fit tagline on one line: slightly less horizontal padding on narrow devices + scale font
    const brandingPaddingH = windowWidth < 400 ? 8 : windowWidth < 480 ? 16 : 20;
    const taglineFontSize = Math.max(14, Math.min(24, (windowWidth - 56) / 14));
    // Version line: small enough to stay on one line; scales down on narrow screens
    const buildInfoFontSize = Math.max(9, Math.min(12, (windowWidth - 32) / 42));
    // Three circles in one row: contentBox padding 20*2, circles row padding 8*2, gaps 8*2 between circles
    const circlesInnerW = windowWidth - 40 - 32;
    const circleSize = Math.max(60, Math.min(102, (circlesInnerW - 16) / 3));
    const circleLabelSize = Math.max(10, Math.min(15, circleSize * 0.17));

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
            <Image source={require("./assets/everycirclelogonew_1024x1024.png")} style={{ width: 200, height: 200, resizeMode: "contain" }} accessibilitylabel='Every Circle Logo' />
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
          <View style={[styles.brandingContainer, { paddingHorizontal: brandingPaddingH }]}>
            <Text style={styles.brandName}>
              <Text style={styles.brandItalicText}>every</Text>
              <Text style={styles.brandRegularText}>Circle</Text>
              <Text style={styles.brandText}>.com</Text>
            </Text>
            <Text style={[styles.tagline, { fontSize: taglineFontSize }]} numberOfLines={1} adjustsFontSizeToFit={Platform.OS === "ios"} minimumFontScale={0.72}>
              Connecting Circles of Influence
            </Text>
            {/* <Text style={styles.tagline}>It Pays to Be Connected</Text> */}

            {SHOW_HOME_BUILD_INFO && (
              <Text style={[styles.dateTimeText, { fontSize: buildInfoFontSize }]} numberOfLines={1} adjustsFontSizeToFit={Platform.OS === "ios"} minimumFontScale={0.7}>
                PM {versionData.pm_version} Version {versionData.major}.{versionData.build} - Last Change: {versionData.last_change}
              </Text>
            )}
          </View>

          <View style={styles.circlesContainer}>
            <TouchableOpacity style={styles.circleBox} onPress={() => navigation.navigate("SignUp")} activeOpacity={0.85}>
              <View style={[styles.circle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2, backgroundColor: "#800000" }]}>
                <Text
                  style={[styles.circleText, { fontSize: circleLabelSize, lineHeight: Math.round(circleLabelSize * 1.2) }]}
                  numberOfLines={2}
                  adjustsFontSizeToFit={Platform.OS === "ios"}
                  minimumFontScale={0.75}
                >
                  Sign Up
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.circleBox} onPress={() => navigation.navigate("HowItWorksScreen")} activeOpacity={0.85}>
              <View style={[styles.circle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2, backgroundColor: "#FF9500" }]}>
                <Text
                  style={[styles.circleText, { fontSize: circleLabelSize, lineHeight: Math.round(circleLabelSize * 1.2) }]}
                  numberOfLines={2}
                  adjustsFontSizeToFit={Platform.OS === "ios"}
                  minimumFontScale={0.75}
                >
                  How It Works
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.circleBox}
              onPress={() => {
                console.log("App.js - Login Button Pressed");
                navigation.navigate("Login");
              }}
              activeOpacity={0.85}
            >
              <View style={[styles.circle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2, backgroundColor: "#2434C2" }]}>
                <Text
                  style={[styles.circleText, { fontSize: circleLabelSize, lineHeight: Math.round(circleLabelSize * 1.2) }]}
                  numberOfLines={2}
                  adjustsFontSizeToFit={Platform.OS === "ios"}
                  minimumFontScale={0.75}
                >
                  Log In
                </Text>
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
        Profile: {
          path: "profile",
          parse: {
            profile_uid: (v) => v,
          },
        },
        Network: "network",
        Search: "search",
        Settings: "settings",
        Inbox: "inbox",
        Chat: {
          path: "chat",
          parse: {
            conversation_uid: (v) => v,
            other_uid: (v) => v,
            other_name: (v) => v,
            other_image: (v) => v,
          },
        },
      },
    },
  };

  // Handle navigation state changes to enforce terms acceptance and cookies
  const onNavigationStateChange = async (state) => {
    if (!state) return;

    // Get current route name
    const getCurrentRoute = (navState) => {
      if (!navState) return null;
      const route = navState.routes[navState.index];
      if (route.state) {
        return getCurrentRoute(route.state);
      }
      return route.name;
    };

    const currentRouteName = getCurrentRoute(state);
    console.log("App.js - Current route:", currentRouteName);

    // Check terms acceptance and cookies status from AsyncStorage (in case they changed)
    const termsStatus = await AsyncStorage.getItem("termsAccepted");
    const termsAcceptedValue = termsStatus !== null ? JSON.parse(termsStatus) : true;
    setTermsAccepted(termsAcceptedValue);

    const cookiesStatus = await AsyncStorage.getItem("allowCookies");
    const cookiesAllowedValue = cookiesStatus !== null ? JSON.parse(cookiesStatus) : true;

    // Allowed screens when cookies are not allowed (only Settings)
    const cookiesAllowedScreens = ["Settings"];

    // Allowed screens when terms are not accepted
    const termsAllowedScreens = ["Home", "Login", "SignUp", "Settings", "TermsAndConditions"];

    // If cookies not allowed and trying to access any screen except Settings
    if (!cookiesAllowedValue && !cookiesAllowedScreens.includes(currentRouteName)) {
      console.log("App.js - Cookies not allowed, redirecting to Settings");

      // Show alert explaining the restriction
      const message = "Please allow cookies in Settings to access this feature.";
      if (isWeb) {
        window.alert(message);
      } else {
        Alert.alert("Cookies Required", message);
      }

      // Navigate to Settings
      if (navigationRef.current) {
        navigationRef.current.navigate("Settings");
      }
      return; // Exit early
    }

    // If terms not accepted and trying to access restricted screen, redirect to Settings
    if (!termsAcceptedValue && !termsAllowedScreens.includes(currentRouteName)) {
      console.log("App.js - Terms not accepted, redirecting to Settings");

      // Show alert explaining the restriction
      const message = "Please accept the Terms and Conditions in Settings to access this feature.";
      if (isWeb) {
        window.alert(message);
      } else {
        Alert.alert("Terms Required", message);
      }

      // Navigate to Settings
      if (navigationRef.current) {
        navigationRef.current.navigate("Settings");
      }
    }
  };

  return (
    <TextNodeErrorBoundary>
      <DarkModeProvider>
        <UnreadProvider>
          <View style={styles.appRoot}>
            <NavigationContainer ref={navigationRef} linking={isWeb ? linking : undefined} onReady={() => console.log("App.js - NavigationContainer ready")} onStateChange={onNavigationStateChange}>
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
                <Stack.Screen name='Connect' component={ConnectScreenWrapper} />
                <Stack.Screen name='NewConnection' component={NewConnectionScreen} />
                <Stack.Screen name='QRScanner' component={QRScannerScreen} options={{ headerShown: false }} />
                <Stack.Screen name='Inbox' component={InboxScreen} />
                <Stack.Screen name='Chat' component={ChatScreen} />
                <Stack.Screen name='AddReviewSearch' component={AddReviewSearchScreen} options={{ headerShown: false }} />
              </Stack.Navigator>
            </NavigationContainer>
            <MessageNotificationBanner
              onOpen={(conversationUid, senderUid, senderName, senderImage) => {
                if (navigationRef.current) {
                  navigationRef.current.navigate("Chat", {
                    conversation_uid: conversationUid,
                    other_uid: senderUid,
                    other_name: senderName,
                    other_image: senderImage || null,
                  });
                }
              }}
            />
          </View>
        </UnreadProvider>
      </DarkModeProvider>
    </TextNodeErrorBoundary>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    minWidth: 360,
    alignSelf: "stretch",
  },
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
    width: "100%",
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  circleBox: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
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
    justifyContent: "center",
    alignItems: "center",
    padding: 6,
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
    fontFamily: Platform.OS === "web" ? "Arial, sans-serif" : undefined,
    color: "#666",
    textAlign: "left",
    marginTop: 8,
    alignSelf: "stretch",
  },
  brandingContainer: {
    alignItems: "flex-start",
    marginTop: 20,
    marginBottom: 20,
    width: "100%",
  },
  brandName: {
    fontSize: 36,
    fontStyle: "normal",
    fontFamily: Platform.select({ web: "Arial, sans-serif", ios: "Georgia", android: "serif", default: undefined }),
    color: "#000",
    textAlign: "left",
  },
  brandItalicText: {
    fontStyle: "italic",
    fontFamily: Platform.select({ web: '"Castoro", serif', ios: "Georgia", android: "serif", default: "serif" }),
  },
  brandRegularText: {
    color: "#800000",
    fontStyle: "normal",
    fontWeight: "normal",
    fontFamily: Platform.select({ web: '"Castoro", serif', ios: "Georgia", android: "serif", default: "serif" }),
  },
  brandText: {
    color: "#000",
    fontSize: 20,
  },
  tagline: {
    alignSelf: "stretch",
    maxWidth: "100%",
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
