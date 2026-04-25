import React, { useState, useEffect } from "react";
import { StyleSheet, View, Platform, Text, useWindowDimensions, Pressable, ActivityIndicator } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppleLogomarkWhite from "./components/AppleLogomarkWhite";
import { EXPO_PUBLIC_APPLE_SERVICES_ID, EXPO_PUBLIC_APPLE_REDIRECT_URI, EXPO_PUBLIC_EXPO_ACCOUNT } from "@env";

const AUTH_BTN_H = 48;

function decodeJwtPayload(jwt) {
  if (!jwt || typeof jwt !== "string" || !jwt.includes(".")) return null;
  try {
    const part = jwt.split(".")[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch (e) {
    return { _decodeError: String(e) };
  }
}

/** Logs everything useful from Apple; safe to use while wiring up a backend. */
function logAppleAuthSummary(platform, details) {
  console.log("=== Apple auth —", platform, "— raw summary ===");
  console.log(JSON.stringify(details, null, 2));
}

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
  // Only used on iOS: native Sign in with Apple is not available on all devices/configurations.
  const [iosAppleAvailable, setIosAppleAvailable] = useState(Platform.OS === "ios" ? null : true);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let cancelled = false;
    (async () => {
      try {
        const available = await AppleAuthentication.isAvailableAsync();
        if (!cancelled) setIosAppleAvailable(available);
      } catch (e) {
        console.warn("AppleSignIn - isAvailableAsync failed:", e);
        if (!cancelled) setIosAppleAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const handleAppleSignIn = async () => {
    if (disabled) return;
    try {
      console.log("AppleSignIn - handleAppleSignIn");
      if (Platform.OS === "ios") {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        });
        const idTokenString = credential.idToken || credential.identityToken;
        logAppleAuthSummary("iOS (native ASAuthorizationAppleIDCredential via expo-apple-authentication)", {
          user: credential.user,
          email: credential.email ?? null,
          realUserStatus: credential.realUserStatus,
          state: credential.state ?? null,
          fullName: credential.fullName
            ? {
                givenName: credential.fullName.givenName,
                familyName: credential.fullName.familyName,
                middleName: credential.fullName.middleName,
                namePrefix: credential.fullName.namePrefix,
                nameSuffix: credential.fullName.nameSuffix,
                nickname: credential.fullName.nickname,
              }
            : null,
          hasIdentityToken: Boolean(credential.identityToken),
          hasIdToken: Boolean(credential.idToken),
          identityTokenLength: credential.identityToken ? String(credential.identityToken).length : 0,
          idTokenLength: credential.idToken ? String(credential.idToken).length : 0,
          identityTokenJwtPayload: idTokenString ? decodeJwtPayload(idTokenString) : null,
        });
        if (idTokenString) {
          console.log("=== Apple auth — iOS — identity / id token (JWT string) ===\n", idTokenString);
        }

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
          const idTok = credential.idToken || credential.identityToken;
          const userInfo = {
            user: {
              id: credential.user,
              email: credential.email,
              name: credential.fullName?.givenName ? `${credential.fullName.givenName} ${credential.fullName.familyName}` : "Apple User",
            },
            idToken: idTok,
            authorizationCode: credential.authorizationCode,
            firstName: credential.fullName?.givenName || "",
            lastName: credential.fullName?.familyName || "",
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

          const idTok = credential.idToken || credential.identityToken;
          const userInfo = {
            user: {
              id: credential.user,
              email: userEmail || "Apple User",
              name: "Apple User",
            },
            idToken: idTok,
            authorizationCode: credential.authorizationCode,
            firstName: "",
            lastName: "",
          };
          console.log("AppleSignIn - userInfo saved", userInfo);
          onSignIn(userInfo);
        }
      } else {
        console.log("AppleSignIn - non-iOS (web or Android) web auth session");
        const servicesId = EXPO_PUBLIC_APPLE_SERVICES_ID;
        const redirectUri = EXPO_PUBLIC_APPLE_REDIRECT_URI?.trim();
        console.log("AppleSignIn - servicesId:", servicesId);
        console.log("AppleSignIn - redirectUri:", redirectUri);

        if (!servicesId || !redirectUri) {
          onError("Missing EXPO_PUBLIC_APPLE_SERVICES_ID or EXPO_PUBLIC_APPLE_REDIRECT_URI");
          return;
        }

        const authUrl = `https://appleid.apple.com/auth/authorize?client_id=${encodeURIComponent(
          servicesId,
        )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code%20id_token&scope=name%20email&response_mode=form_post`;
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

        if (result.type === "success" && result.url) {
          const u = new URL(result.url);
          const oidcError = u.searchParams.get("error");
          const allParams = Object.fromEntries(u.searchParams.entries());
          const idToken = u.searchParams.get("id_token");
          const code = u.searchParams.get("code");
          const state = u.searchParams.get("state");
          const userRaw = u.searchParams.get("user");

          logAppleAuthSummary("web (browser redirect / openAuthSessionAsync result)", {
            resultType: result.type,
            fullRedirectUrl: result.url,
            urlOrigin: u.origin,
            urlPath: u.pathname,
            searchParams: allParams,
            error: oidcError,
            errorDescription: u.searchParams.get("error_description"),
            hasIdToken: Boolean(idToken),
            hasCode: Boolean(code),
            hasState: Boolean(state),
            hasUser: Boolean(userRaw),
            idTokenLength: idToken ? idToken.length : 0,
            idTokenJwtPayload: idToken ? decodeJwtPayload(idToken) : null,
            userObjectFromApple: (() => {
              if (!userRaw) return null;
              try {
                return JSON.parse(userRaw);
              } catch (e) {
                return { _parseError: String(e), raw: userRaw };
              }
            })(),
          });
          if (idToken) {
            console.log("=== Apple auth — web — id_token (JWT string) ===\n", idToken);
          }

          if (oidcError) {
            onError(u.searchParams.get("error_description") || oidcError);
            return;
          }
          if (!idToken) {
            onError(
              code
                ? "Apple returned a code but no id_token in the callback URL. If this persists, your server may need to exchange the code for tokens (response_type=code only)."
                : "Apple did not return an id_token in the callback URL",
            );
            return;
          }
          let sub = "apple_web";
          try {
            const part = idToken.split(".")[1];
            if (part) {
              const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
              if (json.sub) sub = json.sub;
            }
          } catch (_) {
            /* keep default sub */
          }
          let email = null;
          let name = "Apple User";
          let firstName = "";
          let lastName = "";
          const userParam = u.searchParams.get("user");
          if (userParam) {
            try {
              const userObj = JSON.parse(userParam);
              if (userObj.email) email = userObj.email;
              if (userObj.name) {
                if (userObj.name.firstName) firstName = userObj.name.firstName;
                if (userObj.name.lastName) lastName = userObj.name.lastName;
                if (userObj.name.firstName || userObj.name.lastName) {
                  name = [userObj.name.firstName, userObj.name.lastName].filter(Boolean).join(" ") || name;
                }
              }
            } catch (_) {
              /* ignore */
            }
          }
          if (!email) {
            try {
              const part = idToken.split(".")[1];
              if (part) {
                const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
                if (json.email) email = json.email;
              }
            } catch (_) {
              /* ignore */
            }
          }
          onSignIn({
            user: { id: sub, email: email || "Apple User", name },
            idToken,
            authorizationCode: code || null,
            firstName,
            lastName,
          });
        } else {
          console.log("Web authentication cancelled or failed", result);
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
    if (iosAppleAvailable === null) {
      return null;
    }
    if (iosAppleAvailable === false) {
      return null;
    }
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
