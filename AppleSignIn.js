import React from "react";
import { StyleSheet, View, Platform, TouchableOpacity, Text } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

const AppleSignIn = ({ onSignIn, onError, disabled, buttonText = "Sign in with Apple" }) => {
  // console.log("AppleSignIn - Rendering");
  const handleAppleSignIn = async () => {
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
            idToken: credential.idToken || credential.identityToken, // Check both token properties
          };
          console.log("AppleSignIn - userInfo saved", userInfo);
          onSignIn(userInfo);
        } else {
          console.log("AppleSignIn - did not receive name details");
          console.log("AppleSignIn - Call endpoint to get user info");

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
            // Store email for future use
            try {
              await AsyncStorage.setItem(`apple_email_${credential.user}`, userEmail);
              console.log("AppleSignIn - stored email for future use");
            } catch (error) {
              console.log("Error storing email:", error);
            }
          }

          // Use actual credential data instead of hardcoded values
          const userInfo = {
            user: {
              id: credential.user,
              email: userEmail || "Apple User", // Use stored email or fallback
              name: "Apple User",
            },
            idToken: credential.idToken || credential.identityToken, // Use actual token from credential
          };
          console.log("AppleSignIn - userInfo saved", userInfo);
          onSignIn(userInfo);
        }

        // // Try to get stored name if not provided in current sign-in
        // let fullName = credential.fullName;
        // if (!fullName?.givenName) {
        //   console.log("AppleSignIn - fullName?.givenName is null");
        //   try {
        //     const storedName = await AsyncStorage.getItem(`apple_user_${credential.user}`);
        //     if (storedName) {
        //       fullName = JSON.parse(storedName);
        //     }
        //   } catch (error) {
        //     console.log("Error retrieving stored name:", error);
        //   }
        // }

        // // User is authenticated
        // const userInfo = {
        //   user: {
        //     id: credential.user,
        //     email: credential.email,
        //     name: fullName?.givenName ? `${fullName.givenName} ${fullName.familyName}` : "Apple User",
        //   },
        //   idToken: credential.identityToken,
        // };
        // console.log("AppleSignIn - userInfo", userInfo);
      } else {
        console.log("AppleSignIn - Android");
        // For Android, open web-based Sign in with Apple
        const result = await WebBrowser.openAuthSessionAsync(
          `https://appleid.apple.com/auth/authorize?client_id=${process.env.EXPO_PUBLIC_APPLE_SERVICES_ID}&redirect_uri=${encodeURIComponent(
            "https://auth.expo.io/@pmarathay/google-auth-demo/redirect"
          )}&response_type=code id_token&scope=name email&response_mode=form_post`,
          "https://auth.expo.io/@pmarathay/google-auth-demo/redirect"
        );

        if (result.type === "success") {
          // Handle successful web authentication
          // You'll need to implement server-side validation for the web flow
          console.log("Web authentication successful:", result);
          // Parse the authentication response and create userInfo object
          // This is a simplified example - you'll need to implement proper token validation
          const userInfo = {
            user: {
              id: "web_user_id", // TODO: Extract from response
              email: "email_from_response", // TODO: Extract from response
              name: "name_from_response", // TODO: Extract from response
            },
            idToken: "token_from_response", // TODO: Extract from response
          };
          onSignIn(userInfo);
        } else {
          console.log("Web authentication cancelled or failed");
        }
      }
    } catch (error) {
      if (error.code === "ERR_CANCELED") {
        // Handle user canceling the sign-in flow
        console.log("User canceled Apple Sign-in");
      } else {
        console.error("Apple Sign-In Error:", error);
        onError(error.message);
      }
    }
  };

  // Render platform-specific button
  if (Platform.OS === "ios") {
    return (
      <View style={styles.container}>
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={8}
          style={styles.appleButton}
          onPress={handleAppleSignIn}
        />
      </View>
    );
  }

  // Android/Web button - Must match Apple's design guidelines
  // Apple HIG: Black background (#000000), white text, rounded corners (8-10pt), minimum 44pt height
  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.appleButtonWeb, { opacity: disabled ? 0.6 : 1 }]} 
        onPress={handleAppleSignIn}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <View style={styles.appleButtonContent}>
          <View style={styles.appleLogo}>
            <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.appleButtonText}>{buttonText}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  appleButton: {
    width: 192,
    height: 48,
    minWidth: 192,
    minHeight: 48,
  },
  appleButtonWeb: {
    width: 192,
    height: 48,
    minWidth: 192,
    minHeight: 48,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  appleButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  appleLogo: {
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  appleButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: Platform.OS === "web" ? "'Google Sans', Roboto, sans-serif" : "System",
    letterSpacing: 0.25,
  },
});

export default AppleSignIn;
