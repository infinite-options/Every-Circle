// LoginScreen.js

import React, { useState } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform } from "react-native";

// Only import GoogleSigninButton on native platforms (not web)
let GoogleSigninButton = null;
const isWeb = typeof window !== "undefined" && typeof document !== "undefined";
if (!isWeb) {
  try {
    const googleSigninModule = require("@react-native-google-signin/google-signin");
    GoogleSigninButton = googleSigninModule.GoogleSigninButton;
  } catch (e) {
    console.warn("GoogleSigninButton not available:", e.message);
  }
}

import AppleSignIn from "../AppleSignIn";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";
import config from "../config";
import { Ionicons } from "@expo/vector-icons";
import { ACCOUNT_SALT_ENDPOINT, LOGIN_ENDPOINT, USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";
// import SignUpScreen from "./screens/SignUpScreen";

// Helper function to extract the last two digits before .apps.googleusercontent.com
const getLastTwoDigits = (clientId) => {
  if (!clientId) return "Not set";

  // Extract the part before .apps.googleusercontent.com
  const match = clientId.match(/(.+)\.apps\.googleusercontent\.com$/);
  if (match) {
    const idPart = match[1];
    // Get the last two digits of the ID part
    return "..." + idPart.slice(-2);
  }

  // Fallback if the pattern doesn't match
  return "..." + clientId.slice(-2);
};

// Helper function to extract the first four digits/letters of the unique part before .apps.googleusercontent.com
const getFirstFourDigits = (clientId) => {
  if (!clientId) return "Not set";

  // Extract the part before .apps.googleusercontent.com
  const match = clientId.match(/([\w-]+)-([\w]+)\.apps\.googleusercontent\.com$/);
  if (match) {
    const uniquePart = match[2];
    return uniquePart.slice(0, 4);
  }

  // Fallback: try to extract the part after the first hyphen
  const fallback = clientId.split("-")[1];
  if (fallback) {
    return fallback.slice(0, 4);
  }

  return "Not found";
};

// Accept navigation from props
export default function LoginScreen({ navigation, onGoogleSignIn, onAppleSignIn, onError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const validateInputs = (email, password) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmailValid = emailRegex.test(email);
    const isPasswordValid = password.length >= 6;
    setIsValid(isEmailValid && isPasswordValid);
  };

  const handleEmailChange = (text) => {
    // console.log("handleEmailChange", text);
    setEmail(text);
    validateInputs(text, password);
  };

  const handlePasswordChange = (text) => {
    // console.log("handlePasswordChange", text);
    setPassword(text);
    validateInputs(email, text);
  };

  const handleContinue = async () => {
    console.log("LoginScreen - Continue Button Pressed");
    try {
      // console.log("LoginScreen - handleContinue - try block");
      setShowSpinner(true);
      // console.log("LoginScreen - handleContinue", email, password);

      // 1. Get salt
      console.log("LoginScreen - ACCOUNT_SALT_ENDPOINT", ACCOUNT_SALT_ENDPOINT);
      const saltResponse = await fetch(ACCOUNT_SALT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const saltObject = await saltResponse.json();
      // console.log("saltObject", saltObject);

      if (saltObject.code !== 200) {
        Alert.alert("Error", "User does not exist. Please Sign Up.");
        return;
      }

      // 2. Hash password
      console.log("LoginScreen - saltObject", saltObject);
      const salt = saltObject.result[0].password_salt;
      // const hashedPassword = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password + salt);
      const value = password + salt;

      // Convert the value to UTF-8 bytes (similar to Python's str(value).encode())
      const hashedPassword = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value, {
        encoding: Crypto.CryptoEncoding.HEX, // Ensures hex encoding like Python's hexdigest()
      });
      // console.log("LoginScreen - hashedPassword", hashedPassword);

      // 3. Login
      console.log("LoginScreen - LOGIN_ENDPOINT", LOGIN_ENDPOINT);
      const loginResponse = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: hashedPassword }),
      });
      const loginObject = await loginResponse.json();
      console.log("LoginScreen - loginObject returned", loginObject);

      const user_uid = loginObject.result.user_uid;
      const user_email = loginObject.result.user_email_id;

      // Store user_uid and user_email_id in AsyncStorage
      await AsyncStorage.setItem("user_uid", user_uid);
      await AsyncStorage.setItem("user_email_id", user_email);

      console.log("LoginScreen - user_uid", user_uid);
      // console.log("LoginScreen - User Email", user_email);

      // Handle case where no use_uid is returned
      if (!user_uid) {
        console.log("LoginScreen - No user data returned, redirecting to sign up");

        // Clear all user-related data from AsyncStorage
        await AsyncStorage.multiRemove(["user_uid", "user_email_id", "profile_uid", "user_first_name", "user_last_name", "user_phone_number"]);
        console.log("LoginScreen - Cleared AsyncStorage for no user_uid case");

        Alert.alert("Account Not Found", "This email is not registered. Please sign up to create an account.", [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {
              setShowSpinner(false);
            },
          },
          {
            text: "Sign Up",
            onPress: () => {
              setShowSpinner(false);
              navigation.navigate("SignUp");
            },
          },
        ]);
        return;
      }

      // 4. Fetch user profile
      // console.log("user_uid", user_uid);
      // console.log("PROFILE_ENDPOINT", PROFILE_ENDPOINT);
      console.log("LoginScreen - Profile Endpoint call: ", `${USER_PROFILE_INFO_ENDPOINT}/${user_uid}`);

      const profileResponse = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${user_uid}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      // console.log("profileResponse", profileResponse);

      const fullUser = await profileResponse.json();
      console.log("LoginScreen - user profile info", fullUser);

      // Handle case where profile is not found for existing user
      if (fullUser.message === "Profile not found for this user") {
        console.log("LoginScreen - Profile not found for existing user, redirecting to UserInfo");

        // Clear any existing profile data but keep the new user credentials
        await AsyncStorage.multiRemove(["profile_uid", "user_first_name", "user_last_name", "user_phone_number"]);
        console.log("LoginScreen - Cleared profile data from AsyncStorage for incomplete profile case");

        // Store the user_uid so UserInfo screen can use it
        await AsyncStorage.setItem("user_uid", user_uid);
        await AsyncStorage.setItem("user_email_id", user_email);

        Alert.alert("Complete Your Profile", "Your account exists but your profile is incomplete. Please complete your profile information.", [
          {
            text: "Continue",
            onPress: () => {
              setShowSpinner(false);
              navigation.navigate("UserInfo");
            },
          },
        ]);
        return;
      }

      // Store both user_uid and profile_uid in AsyncStorage
      await AsyncStorage.setItem("user_uid", user_uid);
      await AsyncStorage.setItem("user_email_id", user_email);
      await AsyncStorage.setItem("profile_uid", fullUser.personal_info?.profile_personal_uid || "");

      console.log("LoginScreen - user_uid", user_uid);
      // console.log("LoginScreen - User Email", user_email);

      // 5. Navigate to Profile screen
      navigation.navigate("Profile", {
        user: {
          ...fullUser,
          user_email: user_email,
        },
        profile_uid: fullUser.personal_info?.profile_personal_uid || "",
      });
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setShowSpinner(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to everyCircle!</Text>
        <Text style={styles.subtitle}>Please choose a login option to continue.</Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput style={styles.input} placeholder='Email' value={email} onChangeText={handleEmailChange} keyboardType='email-address' autoCapitalize='none' />
        <View style={styles.passwordInputContainer}>
          <TextInput style={styles.input} placeholder='Password' value={password} onChangeText={handlePasswordChange} secureTextEntry={!isPasswordVisible} autoCapitalize='none' />
          <TouchableOpacity style={styles.passwordVisibilityToggle} onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
            <Ionicons name={isPasswordVisible ? "eye-off" : "eye"} size={24} color='#666' />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={[styles.continueButton, isValid && styles.continueButtonActive]} onPress={handleContinue} disabled={!isValid || showSpinner}>
        {showSpinner ? <ActivityIndicator color='#fff' /> : <Text style={[styles.continueButtonText, isValid && styles.continueButtonTextActive]}>Continue</Text>}
      </TouchableOpacity>

      <View style={styles.dividerContainer}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.divider} />
      </View>

      <View style={styles.socialContainer}>
        {GoogleSigninButton && !isWeb ? (
          <GoogleSigninButton
            style={styles.googleButton}
            size={GoogleSigninButton.Size.Wide}
            color={GoogleSigninButton.Color.Dark}
            onPress={async () => {
              if (!signingIn) {
                setSigningIn(true);
                try {
                  await onGoogleSignIn();
                } finally {
                  setSigningIn(false);
                }
              }
            }}
            disabled={signingIn}
          />
        ) : (
          <TouchableOpacity
            style={styles.googleButton}
            onPress={async () => {
              if (!signingIn) {
                setSigningIn(true);
                try {
                  await onGoogleSignIn();
                } finally {
                  setSigningIn(false);
                }
              }
            }}
            disabled={signingIn}
          >
            <Text style={styles.googleButtonText}>Sign in with Google</Text>
          </TouchableOpacity>
        )}
        {Platform.OS === "ios" && (
          <AppleSignIn
            onSignIn={async (...args) => {
              if (!signingIn) {
                setSigningIn(true);
                try {
                  await onAppleSignIn(...args);
                } finally {
                  setSigningIn(false);
                }
              }
            }}
            onError={onError}
            disabled={signingIn}
          />
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Don't have an account?{" "}
          <Text style={styles.signUpText} onPress={() => navigation.navigate("SignUp")}>
            Sign Up
          </Text>
        </Text>
      </View>

      {/* API Keys Info - For debugging */}
      {__DEV__ && (
        <View style={styles.apiKeysContainer}>
          <Text style={styles.apiKeysTitle}>API Keys (First 4 Digits):</Text>
          <Text style={styles.apiKeysText}>iOS: {getFirstFourDigits(config.googleClientIds.ios)}</Text>
          <Text style={styles.apiKeysText}>Android: {getFirstFourDigits(config.googleClientIds.android)}</Text>
          <Text style={styles.apiKeysText}>Web: {getFirstFourDigits(config.googleClientIds.web)}</Text>
          <Text style={styles.apiKeysText}>URL Scheme: {config.googleURLScheme ? config.googleURLScheme.split("-").pop().slice(0, 4) : "Not set"}</Text>
          <Text style={styles.apiKeysText}>Maps API: {getLastTwoDigits(config.googleMapsApiKey)}</Text>
          <Text style={styles.apiKeysText}>Environment: {__DEV__ ? "Development" : "Production"}</Text>
          <Text style={styles.apiKeysText}>iOS Build: {Constants.expoConfig?.ios?.buildNumber || "Not set"}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 100, padding: 20 },
  header: { alignItems: "center", marginBottom: 40 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 10, color: "#007AFF" },
  subtitle: { fontSize: 16, color: "#666", textAlign: "center" },
  inputContainer: { marginBottom: 30 },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  passwordInputContainer: {
    position: "relative",
  },
  passwordVisibilityToggle: {
    position: "absolute",
    right: 15,
    top: 15,
    zIndex: 1,
  },
  continueButton: {
    backgroundColor: "#E5E5E5",
    borderRadius: 25,
    padding: 15,
    alignItems: "center",
    marginBottom: 30,
  },
  continueButtonActive: {
    backgroundColor: "#FF9500",
  },
  continueButtonText: {
    color: "#999",
    fontSize: 18,
    fontWeight: "bold",
  },
  continueButtonTextActive: {
    color: "#fff",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
  },
  divider: { flex: 1, height: 1, backgroundColor: "#E5E5E5" },
  dividerText: { marginHorizontal: 10, color: "#666" },
  socialContainer: { alignItems: "center", marginBottom: 30 },
  googleButton: { width: 192, height: 48, marginBottom: 15 },
  googleButtonText: { color: "#fff", textAlign: "center", padding: 12, backgroundColor: "#4285F4", borderRadius: 4 },
  footer: { alignItems: "center" },
  footerText: { fontSize: 16, color: "#666" },
  signUpText: { color: "#FF9500", fontWeight: "bold" },
  apiKeysContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    padding: 10,
    borderRadius: 5,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    width: "90%",
    alignSelf: "center",
  },
  apiKeysTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  apiKeysText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
});
