import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import GoogleGLogo from "./GoogleGLogo";

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

const OFFICIAL_W = 312;
const OFFICIAL_H = 48;

/**
 * @param {"signIn" | "signUp"} [mode="signIn"]
 *   Native `GoogleSigninButton` only offers “Sign in” / “Sign in with Google” (no stock “Sign up” asset
 *   in the public SDK). For `signUp` we use the same compliant custom layout as web: multicolor G + label
 *   (Google custom-button guidelines) on all platforms, including iOS/Android.
 * Native (sign in only): official SDK `GoogleSigninButton` (light / wide) on light screens.
 * Web + sign up: custom G + text.
 */
export default function GoogleBrandedSignInButton({ onPress, label, disabled, signingIn, mode = "signIn" }) {
  const blocked = !!(disabled || signingIn);
  const { width: windowW } = useWindowDimensions();
  const hPad = 32; // keep below ScrollView/column side padding
  const buttonW = Math.min(OFFICIAL_W, Math.max(200, windowW - hPad));
  const displayLabel = label || (mode === "signUp" ? "Sign up with Google" : "Sign in with Google");

  const useCompliantCustomButton = isWeb || mode === "signUp";
  if (!useCompliantCustomButton && GoogleSigninButton) {
    return (
      <View style={[styles.nativeWrap, blocked && styles.dimmed]}>
        <GoogleSigninButton
          style={[styles.nativeButton, { width: buttonW, height: OFFICIAL_H }]}
          size={GoogleSigninButton.Size.Wide}
          color={GoogleSigninButton.Color.Light}
          onPress={blocked ? () => {} : onPress}
        />
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.fallbackButton, { minWidth: Math.min(280, buttonW), width: buttonW, maxWidth: "100%" }, blocked && styles.fallbackButtonDimmed]}
      onPress={onPress}
      disabled={blocked}
      activeOpacity={0.85}
      accessibilityRole='button'
    >
      {signingIn ? (
        <ActivityIndicator color='#5f6368' />
      ) : (
        <View style={styles.fallbackInner}>
          <View style={styles.logoSlot}>
            <GoogleGLogo size={18} />
          </View>
          <Text style={styles.fallbackLabel}>{displayLabel}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  nativeWrap: {
    marginBottom: 15,
    alignItems: "center",
  },
  nativeButton: {},
  dimmed: { opacity: 0.6 },
  fallbackButton: {
    height: OFFICIAL_H,
    marginBottom: 15,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#747775",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  fallbackButtonDimmed: { opacity: 0.5 },
  fallbackInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  logoSlot: { marginRight: 12, justifyContent: "center" },
  fallbackLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1f1f1f",
    letterSpacing: 0.25,
  },
});
