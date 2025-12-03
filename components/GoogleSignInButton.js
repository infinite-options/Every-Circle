import React from "react";
import { View, Platform, StyleSheet, TouchableOpacity, Text, Image } from "react-native";

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

/**
 * Google Sign In Button Component
 * 
 * Follows Google's branding guidelines from:
 * https://codelabs.developers.google.com/codelabs/sign-in-with-google-button#0
 * 
 * Guidelines:
 * - Minimum size: 192x48px for wide button
 * - Colors: #4285F4 (blue) for filled, white with border for outline
 * - Proper typography and spacing
 */
const GoogleSignInButton = ({ onPress, disabled, text = "Sign in with Google", style, buttonText }) => {
  const displayText = buttonText || text;

  // Native button - uses official Google Sign In button
  if (!isWeb && GoogleSigninButton) {
    return (
      <GoogleSigninButton
        style={[styles.button, style]}
        size={GoogleSigninButton.Size.Wide}
        color={GoogleSigninButton.Color.Dark}
        onPress={onPress}
        disabled={disabled}
      />
    );
  }

  // Web button - styled to match Google's guidelines
  // According to Google guidelines: outline theme with proper colors
  return (
    <TouchableOpacity
      style={[styles.webButton, style, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View style={styles.webButtonContent}>
        <View style={styles.googleLogo}>
          <Text style={styles.googleLogoText}>G</Text>
        </View>
        <Text style={styles.webButtonText}>{displayText}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 192,
    height: 48,
    minWidth: 192,
    minHeight: 48,
  },
  webButton: {
    width: 192,
    height: 48,
    minWidth: 192,
    minHeight: 48,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DADCE0",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  webButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  googleLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#4285F4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  googleLogoText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  webButtonText: {
    color: "#3C4043",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: Platform.OS === "web" ? "'Google Sans', Roboto, sans-serif" : "System",
    letterSpacing: 0.25,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default GoogleSignInButton;

