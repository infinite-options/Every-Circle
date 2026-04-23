import React from "react";
import { StyleSheet, View, Platform, Text, useWindowDimensions, Pressable, ActivityIndicator } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppleLogomarkWhite from "./components/AppleLogomarkWhite";

const AUTH_BTN_H = 48;
function buttonWidthForWindow(windowW) {
  return Math.min(312, Math.max(200, windowW - 32));
}

function iosMajorVersion() {
  if (Platform.OS !== "ios" || !Platform.Version) return 0;
  const v = String(Platform.Version);
  return parseFloat(v);
}

const AppleSignIn = ({ onSignIn, onError, disabled, mode = "signIn", buttonText: buttonTextOverride }) => {
  const { width: windowW } = useWindowDimensions();
  const btnW = buttonWidthForWindow(windowW);
  const label = buttonTextOverride || (mode === "signUp" ? "Sign up with Apple" : "Sign in with Apple");
  const useSignUpType = mode === "signUp" && iosMajorVersion() >= 13.2;

  // console.log("AppleSignIn - Rendering");
  const handleAppleSignIn = async () => {
    if (disabled) return;
    try {
      console.log("AppleSignIn - handleAppleSignIn");
      if (Platform.OS === "ios") {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        });
        console.log("AppleSignIn Success- received credential", credential);
        console.log("AppleSignIn - credential.email:", credential.email);
        console.log("AppleSignIn - credential.idToken:", credential.idToken);
        console.log("AppleSignIn - credential.identityToken:", credential.identityToken);
        console.log("AppleSignIn - credential.user:", credential.user);
        console.log("AppleSignIn - credential.fullName:", credential.fullName);

        // User is authenticated.  Do we need an if statement here?
        // if no email use credential to look up user info

        // If we received the user's name, store it for future use
        if (credential.fullName && credential.fullName.familyName !== null) {
          console.log("AppleSignIn - received name details", credential.fullName);
          const userFullName = {
            givenName: credential.fullName.givenName,
            familyName: credential.fullName.familyName,
          };
          console.log("AppleSignIn - storing user id:", credential.user);
          try {
            await AsyncStorage.setItem(`apple_user_${credential.user}`, JSON.stringify(userFullName));
            console.log("User full name stored successfully");
          } catch (error) {
            console.error("Error storing user full name:", error);
          }

          // User is authenticated
          const userInfo = {
            user: {
              id: credential.user,
              email: credential.email,
              name: credential.fullName?.givenName ? `${credential.fullName.givenName} ${credential.fullName.familyName}` : "Apple User",
            },
            idToken: credential.idToken || credential.identityToken,
          };
          console.log("AppleSignIn - userInfo saved", userInfo);
          onSignIn(userInfo);
        } else {
          console.log("AppleSignIn - did not receive name details");

          // Try to get stored email if not provided in current sign-in
          let userEmail = credential.email;
          if (!userEmail) {
            console.log("AppleSignIn - email is null, trying to get from storage");
            try {
              const storedEmail = await AsyncStorage.getItem(`apple_email_${credential.user}`);
              if (storedEmail) {
                userEmail = storedEmail;
                console.log("AppleSignIn - retrieved stored email:", userEmail);
              }
            } catch (error) {
              console.log("Error retrieving stored email:", error);
            }
          } else {
            try {
              await AsyncStorage.setItem(`apple_email_${credential.user}`, userEmail);
              console.log("AppleSignIn - stored email for future use");
            } catch (error) {
              console.log("Error storing email:", error);
            }
          }

          const userInfo = {
            user: {
              id: credential.user,
              email: userEmail || "Apple User",
              name: "Apple User",
            },
            idToken: credential.idToken || credential.identityToken,
          };
          console.log("AppleSignIn - userInfo saved", userInfo);
          onSignIn(userInfo);
        }
      } else {
        console.log("AppleSignIn - non-iOS (web or Android) web auth session");
        const result = await WebBrowser.openAuthSessionAsync(
          `https://appleid.apple.com/auth/authorize?client_id=${process.env.EXPO_PUBLIC_APPLE_SERVICES_ID}&redirect_uri=${encodeURIComponent(
            "https://auth.expo.io/@pmarathay/google-auth-demo/redirect",
          )}&response_type=code id_token&scope=name email&response_mode=form_post`,
          "https://auth.expo.io/@pmarathay/google-auth-demo/redirect",
        );

        if (result.type === "success") {
          console.log("Web authentication successful:", result);
          const userInfo = {
            user: {
              id: "web_user_id",
              email: "email_from_response",
              name: "name_from_response",
            },
            idToken: "token_from_response",
          };
          onSignIn(userInfo);
        } else {
          console.log("Web authentication cancelled or failed");
        }
      }
    } catch (error) {
      if (error.code === "ERR_CANCELED") {
        console.log("User canceled Apple Sign-in");
      } else {
        console.error("Apple Sign-In Error:", error);
        onError(error.message);
      }
    }
  };

  if (Platform.OS === "ios") {
    return (
      <View style={styles.container}>
        <View style={[styles.iosButtonWrap, disabled && styles.iosButtonWrapDisabled]} pointerEvents={disabled ? "none" : "auto"}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={useSignUpType ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={6}
            style={[styles.appleButtonBase, { width: btnW, height: AUTH_BTN_H }]}
            onPress={handleAppleSignIn}
          />
        </View>
      </View>
    );
  }

  // Android and Web: App Store HIG on iOS requires the system control above; for other
  // platforms follow “Creating a custom Sign in with Apple button” (black fill, 44+ pt
  // min height, system-type label, and the Apple mark to the left of the text).
  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [
          styles.fallbackButton,
          { width: btnW, minWidth: 200, maxWidth: 312, height: AUTH_BTN_H },
          disabled && styles.fallbackButtonDisabled,
          pressed && !disabled && styles.fallbackButtonPressed,
        ]}
        onPress={handleAppleSignIn}
        disabled={!!disabled}
        accessibilityRole='button'
        accessibilityLabel={label}
        android_ripple={{ color: "rgba(255,255,255,0.2)" }}
      >
        {disabled ? (
          <ActivityIndicator color='#FFFFFF' />
        ) : (
          <View style={styles.fallbackButtonInner}>
            <View style={styles.fallbackLogomark}>
              <AppleLogomarkWhite size={18} />
            </View>
            <Text style={styles.fallbackButtonText} numberOfLines={1} adjustsFontSizeToFit>
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  iosButtonWrap: {},
  iosButtonWrapDisabled: {
    opacity: 0.45,
  },
  appleButtonBase: {
    // width/height set per layout
  },
  fallbackButton: {
    alignSelf: "center",
    backgroundColor: "#000000",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    ...Platform.select({
      web: { boxShadow: "0px 1px 2px 0px rgba(0, 0, 0, 0.2)" },
      default: { elevation: 2 },
    }),
  },
  fallbackButtonDisabled: { opacity: 0.5 },
  fallbackButtonPressed: { opacity: 0.86 },
  fallbackButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
  },
  fallbackLogomark: { marginRight: 8, justifyContent: "center" },
  fallbackButtonText: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "600",
    ...Platform.select({
      web: { fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
      android: { fontSize: 17 },
    }),
  },
});

export default AppleSignIn;
