import React, { useState, useEffect, useCallback, useRef } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Platform, Modal, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppleSignIn from "../AppleSignIn";
import GoogleBrandedSignInButton from "../components/GoogleBrandedSignInButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { CREATE_ACCOUNT_ENDPOINT, CREATE_ACCOUNT_TEMP_PASSWORD_ENDPOINT, GOOGLE_SOCIAL_AUTH_ENDPOINT, REFERRAL_API_ENDPOINT, UPDATE_EMAIL_PASSWORD_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "../utils/httpMiddleware";
import ReferralSearch from "../components/ReferralSearch";
import AppHeader from "../components/AppHeader";
import { getHeaderColors } from "../config/headerColors";
import { clearUserProfileCacheStorage } from "../utils/sessionProfile";
import { fetchCircleAuthSocial, googleCircleAuthPayload, issueCircleTokensFromPassword, persistAuthTokens } from "../utils/authSession";
import { refreshAllowCookies, subscribeCookieBannerHeight } from "../utils/cookieConsent";
import { isPendingDeletionAuthResponse, isSoftDeletedRegisterConflict, reactivateNavParamsFromAuthPayload } from "../utils/deletedProfile";
import { clearSessionAsyncStorage } from "../utils/clearAppAsyncStorage";
import { finishSignupAfterReferral } from "../utils/finishSignupAfterReferral";

function authContinuationParams(route) {
  const p = route?.params || {};
  const out = {};
  if (p.profile_uid) out.profile_uid = p.profile_uid;
  if (p.referralProfileUid) out.referralProfileUid = p.referralProfileUid;
  if (p.returnToScanLanding) out.returnToScanLanding = true;
  if (p.returnToNewConnection) out.returnToNewConnection = true;
  return out;
}

/** Explicit "I was not referred" choice — only saved when the user taps that option. */
const NOT_REFERRED_REFERRAL_UID = "110-000001";

export default function SignUpScreen({ onGoogleSignUp, onAppleSignUp, onError, navigation, route }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [isGoogleSignUp, setIsGoogleSignUp] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralId, setReferralId] = useState("");
  const [pendingGoogleUserInfo, setPendingGoogleUserInfo] = useState(null);
  const [pendingAppleUserInfo, setPendingAppleUserInfo] = useState(null);
  const [pendingRegularSignup, setPendingRegularSignup] = useState(false);
  const [referralError, setReferralError] = useState("");
  const [isCheckingReferral, setIsCheckingReferral] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [userExistsError, setUserExistsError] = useState("");
  const [isAttemptingLogin, setIsAttemptingLogin] = useState(false);
  const [showPasswordFallbackModal, setShowPasswordFallbackModal] = useState(false);
  const [passwordFallbackError, setPasswordFallbackError] = useState("");
  const [pendingTempSignupUserUid, setPendingTempSignupUserUid] = useState(null);
  /** No BottomNavBar on this screen — pad the scroll content so the persistent cookie
   *  banner (shown after account creation clears storage) never covers the Log In footer. */
  const [cookieBannerHeight, setCookieBannerHeight] = useState(0);
  useEffect(() => subscribeCookieBannerHeight(setCookieBannerHeight), []);
  /** Account exists but referrer not chosen — hide signup form until referral step completes. */
  const [blockingOAuthReferral, setBlockingOAuthReferral] = useState(false);
  /** User must pick a referrer (or "I was not referred") before finishing signup; no default is persisted. */
  const [pendingReferralCompletion, setPendingReferralCompletion] = useState(false);
  const oauthReferralHandledRef = useRef(false);
  const requireReferralHandledRef = useRef(false);
  const referralRequired = blockingOAuthReferral || pendingReferralCompletion;
  /** No post-signup consent gate anymore — website cookie consent is handled by
   *  CookieConsentBanner (web only). Native apps do not collect cookies for tracking
   *  and do not show cookie prompts (Apple Guideline 5.1.2(i)).
   *  Kept as a passthrough so existing call sites don't need to change. */
  const proceedAfterAccountCreation = useCallback(async (next) => {
    await next();
  }, []);

  const openReferralModal = async () => {
    await AsyncStorage.multiRemove(["referral_uid", "referral_email"]);
    setReferralId("");
    setReferralError("");
    setPendingReferralCompletion(true);
    setShowReferralModal(true);
  };

  const completeReferralAndNavigate = async (selectedReferralUid) => {
    await AsyncStorage.setItem("referral_uid", selectedReferralUid);
    setShowReferralModal(false);
    setReferralError("");

    const oauthFirst =
      pendingGoogleUserInfo?.firstName || pendingAppleUserInfo?.firstName || route.params?.googleUserInfo?.firstName || route.params?.appleUserInfo?.firstName || "";
    const oauthLast =
      pendingGoogleUserInfo?.lastName || pendingAppleUserInfo?.lastName || route.params?.googleUserInfo?.lastName || route.params?.appleUserInfo?.lastName || "";

    try {
      await finishSignupAfterReferral(navigation, {
        referralUid: selectedReferralUid,
        routeParams: { ...authContinuationParams(route), referralProfileUid: route.params?.referralProfileUid },
        email: email || pendingGoogleUserInfo?.email || pendingAppleUserInfo?.email || "",
        firstName: oauthFirst,
        lastName: oauthLast,
      });
    } catch (err) {
      console.error("SignUpScreen - finishSignupAfterReferral failed:", err);
      Alert.alert("Error", err?.message || "Could not finish sign up. Please try again.");
      return;
    }

    setPendingGoogleUserInfo(null);
    setPendingAppleUserInfo(null);
    setPendingRegularSignup(false);
    setPendingReferralCompletion(false);
    setBlockingOAuthReferral(false);
  };

  const promptReferralBeforeUserInfo = async () => {
    const fromRoute = String(route.params?.referralProfileUid || "").trim();
    const fromStorage = String((await AsyncStorage.getItem("referral_uid")) || "").trim();
    const knownReferralUid = fromRoute || fromStorage;
    if (knownReferralUid) {
      setBlockingOAuthReferral(true);
      await completeReferralAndNavigate(knownReferralUid);
      return;
    }
    await AsyncStorage.multiRemove(["referral_uid", "referral_email"]);
    setBlockingOAuthReferral(true);
    await openReferralModal();
  };

  // Handle pre-populated Google user info
  useEffect(() => {
    console.log("SignUpScreen - Rendering after Sign Up Button Press");
    if (route.params?.googleUserInfo) {
      console.log("SignUpScreen - Received Google user info:", route.params.googleUserInfo);
      const { email: googleEmail, firstName, lastName } = route.params.googleUserInfo;
      setEmail(googleEmail);
      setIsGoogleSignUp(true);
    }
  }, [route.params?.googleUserInfo]);

  // Google / Apple account created in App.js — collect referrer before UserInfo (same as email signup modal).
  useEffect(() => {
    if (!route.params?.pendingReferralAfterOAuth || oauthReferralHandledRef.current) return;
    oauthReferralHandledRef.current = true;

    const { googleUserInfo: gInfo, appleUserInfo: aInfo } = route.params || {};

    proceedAfterAccountCreation(async () => {
      const refUid =
        String(route.params?.referralProfileUid || (await AsyncStorage.getItem("referral_uid")) || "").trim() || null;

      if (refUid) {
        await AsyncStorage.setItem("referral_uid", refUid);
        if (gInfo) setPendingGoogleUserInfo(gInfo);
        if (aInfo) setPendingAppleUserInfo(aInfo);
        await completeReferralAndNavigate(refUid);
        return;
      }

      setBlockingOAuthReferral(true);
      if (gInfo?.email) {
        setEmail(gInfo.email);
        setIsGoogleSignUp(true);
      }
      if (gInfo) setPendingGoogleUserInfo(gInfo);
      if (aInfo) setPendingAppleUserInfo(aInfo);
      openReferralModal();
    });
  }, [navigation, route.params, proceedAfterAccountCreation]);

  // Listen for Apple sign up completion (if passed via route)
  useEffect(() => {
    if (route.params?.pendingReferralAfterOAuth) return;
    if (route.params?.appleUserInfo) {
      setPendingAppleUserInfo(route.params.appleUserInfo);
      proceedAfterAccountCreation(async () => {
        const refUid =
          String(route.params?.referralProfileUid || (await AsyncStorage.getItem("referral_uid")) || "").trim() || null;
        if (refUid) {
          await AsyncStorage.setItem("referral_uid", refUid);
          await completeReferralAndNavigate(refUid);
        } else {
          openReferralModal();
        }
      });
    }
  }, [route.params?.appleUserInfo, route.params?.referralProfileUid, proceedAfterAccountCreation]);

  // Returning user logged in elsewhere (e.g. Login → Profile) but never chose a referrer.
  useEffect(() => {
    if (!route.params?.requireReferralCompletion || requireReferralHandledRef.current) return;
    requireReferralHandledRef.current = true;

    const { googleUserInfo: gInfo, appleUserInfo: aInfo } = route.params || {};
    if (gInfo?.email) {
      setEmail(gInfo.email);
      setIsGoogleSignUp(true);
      setPendingGoogleUserInfo(gInfo);
    }
    if (aInfo) setPendingAppleUserInfo(aInfo);
    promptReferralBeforeUserInfo();
  }, [route.params?.requireReferralCompletion, route.params?.googleUserInfo, route.params?.appleUserInfo]);

  const validateInputs = useCallback(
    (email, password, confirmPassword) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isEmailValid = emailRegex.test(email);
      // Main signup is email-only (or Google complete). Password fields are fallback-modal only.
      if (isGoogleSignUp) {
        setIsValid(isEmailValid);
        return;
      }
      setIsValid(isEmailValid);
    },
    [isGoogleSignUp],
  );

  // Validate inputs whenever email, password, confirmPassword, or isGoogleSignUp changes
  useEffect(() => {
    validateInputs(email, password, confirmPassword);
  }, [email, password, confirmPassword, isGoogleSignUp, validateInputs]);

  const handleEmailChange = (text) => {
    setEmail(text);
    setUserExistsError(""); // Clear error when user changes email
    validateInputs(text, password, confirmPassword);
  };

  const handlePasswordChange = (text) => {
    setPassword(text);
    setUserExistsError(""); // Clear error when user changes password
    validateInputs(email, text, confirmPassword);
  };

  const handleConfirmPasswordChange = (text) => {
    setConfirmPassword(text);
    validateInputs(email, password, text);
  };

  //   const encryptPassword = (password) => {
  //     console.log("Encrypting password:", password);
  //     return CryptoJS.SHA256(password).toString();
  //   };

  const handleReferralSubmit = async () => {
    setReferralError("");
    if (!referralId) {
      setReferralError("Please select who referred you, search for them, or tap I was not referred.");
      console.log("Referral Modal: No referral email entered");
      return;
    }

    // Normalize emails for comparison (lowercase, trim)
    const referralEmailNormalized = referralId.trim().toLowerCase();
    const userEmailNormalized = email.trim().toLowerCase();
    const googleEmailNormalized = pendingGoogleUserInfo?.email?.trim().toLowerCase() || "";
    const appleEmailNormalized = pendingAppleUserInfo?.email?.trim().toLowerCase() || "";

    // Check if referral email matches the user's own email
    if (referralEmailNormalized === userEmailNormalized || referralEmailNormalized === googleEmailNormalized || referralEmailNormalized === appleEmailNormalized) {
      setReferralError("Please enter the email of the person who referred you, not your own email address.");
      console.log("Referral Modal: User tried to refer themselves");
      return;
    }

    setIsCheckingReferral(true);
    try {
      console.log("Referral Modal: Checking referral for email:", referralEmailNormalized);
      const response = await fetch(REFERRAL_API_ENDPOINT + encodeURIComponent(referralEmailNormalized));
      const data = await response.json();
      console.log("Referral Modal: Backend response:", data);
      const foundReferralUid = data.personal_info?.profile_personal_uid;
      if (foundReferralUid && foundReferralUid !== "unknown") {
        console.log("Referral Modal: Referral UID returned from backend:", foundReferralUid);
        await completeReferralAndNavigate(foundReferralUid);
      } else {
        console.log("Referral Modal: No referral UID returned, user should enter another email or tap I was not referred.");
        setReferralError("Referral email not found. Please try another or tap I was not referred.");
      }
    } catch (error) {
      setReferralError("Error checking referral. Please try again.");
      console.log("Referral Modal: Error checking referral:", error);
    } finally {
      setIsCheckingReferral(false);
    }
  };

  const handleReferralSelect = async (selectedUid) => {
    await completeReferralAndNavigate(selectedUid);
  };

  const handleNewUserReferral = async () => {
    setReferralError("");
    await AsyncStorage.setItem("referral_email", "");
    await completeReferralAndNavigate(NOT_REFERRED_REFERRAL_UID);
  };

  const beginPostAccountFlow = async (preservedReferralUid) => {
    setPendingRegularSignup(true);
    await proceedAfterAccountCreation(async () => {
      if (preservedReferralUid) {
        await AsyncStorage.setItem("referral_uid", preservedReferralUid);
        await completeReferralAndNavigate(preservedReferralUid);
        setPendingRegularSignup(false);
      } else {
        await openReferralModal();
      }
    });
  };

  const openPasswordFallbackModal = (userUid = null) => {
    setPendingTempSignupUserUid(userUid);
    setPassword("");
    setConfirmPassword("");
    setPasswordFallbackError("");
    setShowPasswordFallbackModal(true);
  };

  const handlePasswordFallbackSubmit = async () => {
    setPasswordFallbackError("");
    if (password.length < 6) {
      setPasswordFallbackError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordFallbackError("Passwords do not match.");
      return;
    }

    setIsAttemptingLogin(true);
    try {
      const preservedReferralUid =
        String(route.params?.referralProfileUid || (await AsyncStorage.getItem("referral_uid")) || "").trim() || null;
      const emailTrimmed = email.trim();

      if (pendingTempSignupUserUid) {
        const updateResponse = await fetch(UPDATE_EMAIL_PASSWORD_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: emailTrimmed,
            user_uid: pendingTempSignupUserUid,
            password,
          }),
        });
        const updateData = await updateResponse.json().catch(() => ({}));
        const updated =
          updateResponse.ok &&
          String(updateData.message || "")
            .toLowerCase()
            .includes("updated successfully");
        if (!updated && updateResponse.status >= 400) {
          setPasswordFallbackError(updateData.message || "Could not save password. Please try again.");
          return;
        }
        await AsyncStorage.setItem("user_uid", String(pendingTempSignupUserUid));
        await AsyncStorage.setItem("user_email_id", emailTrimmed);
      } else {
        const createAccountResponse = await fetch(CREATE_ACCOUNT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailTrimmed, password }),
        });
        const createAccountData = await createAccountResponse.json();
        if (isSoftDeletedRegisterConflict(createAccountData, createAccountResponse.status)) {
          setShowPasswordFallbackModal(false);
          navigation.navigate("Reactivate", reactivateNavParamsFromAuthPayload(createAccountData, { email: emailTrimmed, password }));
          return;
        }
        if (createAccountData.message === "User already exists") {
          setPasswordFallbackError("User already exists. Please log in instead.");
          return;
        }
        if (!(createAccountData.code === 281 && createAccountData.user_uid)) {
          setPasswordFallbackError(createAccountData.message || "Failed to create account.");
          return;
        }
        await AsyncStorage.clear();
        refreshAllowCookies();
        await AsyncStorage.setItem("user_uid", createAccountData.user_uid);
        await AsyncStorage.setItem("user_email_id", emailTrimmed);
        if (preservedReferralUid) await AsyncStorage.setItem("referral_uid", preservedReferralUid);
      }

      const circleAuth = await issueCircleTokensFromPassword(emailTrimmed, password, fetch);
      if (circleAuth?.pendingDeletion) {
        setShowPasswordFallbackModal(false);
        await clearSessionAsyncStorage();
        await clearUserProfileCacheStorage();
        navigation.navigate("Reactivate", reactivateNavParamsFromAuthPayload(circleAuth.data || {}, { email: emailTrimmed, password }));
        return;
      }

      setShowPasswordFallbackModal(false);
      setPendingTempSignupUserUid(null);
      await beginPostAccountFlow(preservedReferralUid);
    } catch (err) {
      console.error("Password fallback signup failed:", err);
      setPasswordFallbackError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setIsAttemptingLogin(false);
    }
  };

  const handleContinue = async () => {
    try {
      if (isGoogleSignUp) {
        console.log("SignUpScreen - Google Signup");
        const { googleUserInfo } = route.params;
        const payload = {
          email: googleUserInfo.email,
          password: "GOOGLE_LOGIN",
          google_auth_token: googleUserInfo.accessToken,
          social_id: googleUserInfo.googleId,
          first_name: googleUserInfo.firstName,
          last_name: googleUserInfo.lastName,
          profile_picture: googleUserInfo.profilePicture,
        };

        const response = await fetch(GOOGLE_SOCIAL_AUTH_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        console.log("SignUpScreen - Google Signup Response:", response);
        const result = await response.json();
        if (isPendingDeletionAuthResponse(result, response.status) || isSoftDeletedRegisterConflict(result, response.status)) {
          navigation.navigate(
            "Reactivate",
            reactivateNavParamsFromAuthPayload(result, {
              email: googleUserInfo.email,
              password: "GOOGLE_LOGIN",
            }),
          );
          return;
        }
        if (result.user_uid) {
          const preservedReferralUid =
            String(route.params?.referralProfileUid || (await AsyncStorage.getItem("referral_uid")) || "").trim() || null;
          await AsyncStorage.clear();
          refreshAllowCookies();
          await AsyncStorage.setItem("user_uid", result.user_uid);
          await AsyncStorage.setItem("user_email_id", googleUserInfo.email);
          if (preservedReferralUid) {
            await AsyncStorage.setItem("referral_uid", preservedReferralUid);
          }
          const circleAuth = await fetchCircleAuthSocial(googleCircleAuthPayload(googleUserInfo.accessToken), fetch);
          if (circleAuth?.pendingDeletion) {
            await clearSessionAsyncStorage();
            await clearUserProfileCacheStorage();
            navigation.navigate(
              "Reactivate",
              reactivateNavParamsFromAuthPayload(circleAuth.data || {}, {
                email: googleUserInfo.email,
                password: "GOOGLE_LOGIN",
              }),
            );
            return;
          }
          setPendingGoogleUserInfo(googleUserInfo);

          await proceedAfterAccountCreation(async () => {
            if (preservedReferralUid) {
              await completeReferralAndNavigate(preservedReferralUid);
            } else {
              await openReferralModal();
            }
          });
        } else {
          throw new Error("Failed to create account");
        }
        return;
      }

      console.log("SignUpScreen - Email-only signup (temp password)");
      setUserExistsError("");
      setIsAttemptingLogin(true);
      const emailTrimmed = email.trim();
      const preservedReferralUid =
        String(route.params?.referralProfileUid || (await AsyncStorage.getItem("referral_uid")) || "").trim() || null;

      let createAccountData = null;
      let createAccountResponse = null;
      try {
        createAccountResponse = await fetch(CREATE_ACCOUNT_TEMP_PASSWORD_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailTrimmed }),
        });
        createAccountData = await createAccountResponse.json().catch(() => ({}));
      } catch (endpointErr) {
        console.warn("Temp-password signup endpoint unavailable, falling back to password modal:", endpointErr);
        openPasswordFallbackModal(null);
        return;
      }

      console.log("SignUpScreen - Temp password signup response:", createAccountResponse?.status, createAccountData);

      // Endpoint missing / not deployed yet → ask user to set a password.
      if (createAccountResponse.status === 404 || createAccountResponse.status === 501) {
        openPasswordFallbackModal(null);
        return;
      }

      if (isSoftDeletedRegisterConflict(createAccountData, createAccountResponse.status)) {
        navigation.navigate("Reactivate", reactivateNavParamsFromAuthPayload(createAccountData, { email: emailTrimmed, password: "" }));
        return;
      }

      if (createAccountData.message === "User already exists") {
        setUserExistsError("User Already Exists — please Log In");
        return;
      }

      if (createAccountData.code === 281 && createAccountData.user_uid) {
        await AsyncStorage.clear();
        refreshAllowCookies();
        await AsyncStorage.setItem("user_uid", String(createAccountData.user_uid));
        await AsyncStorage.setItem("user_email_id", emailTrimmed);
        if (preservedReferralUid) {
          await AsyncStorage.setItem("referral_uid", preservedReferralUid);
        }

        await persistAuthTokens(createAccountData);

        if (createAccountData.email_sent === false) {
          openPasswordFallbackModal(String(createAccountData.user_uid));
          return;
        }

        // Email sent. Prefer tokens from BE; without them the session may be limited until login.
        if (!createAccountData.access_token && !createAccountData.refresh_token) {
          const nested = createAccountData.result || createAccountData.data;
          if (nested) await persistAuthTokens(nested);
        }

        await beginPostAccountFlow(preservedReferralUid);
        return;
      }

      // Unknown failure — offer password fallback so signup can still complete.
      if (!createAccountResponse.ok) {
        console.warn("Temp-password signup failed; opening password fallback", createAccountData);
        openPasswordFallbackModal(createAccountData.user_uid ? String(createAccountData.user_uid) : null);
        return;
      }

      throw new Error(createAccountData.message || "Failed to create account");
    } catch (error) {
      console.error("Error in account creation:", error);
      Alert.alert("Error", "Failed to create account. Please try again.");
    } finally {
      setIsAttemptingLogin(false);
    }
  };

  return (
    <View style={styles.pageContainer}>
      <AppHeader title='SIGN UP' {...getHeaderColors("signUp")} onBackPress={() => navigation.goBack()} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={[styles.contentContainer, cookieBannerHeight > 0 && { paddingBottom: 20 + cookieBannerHeight }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Welcome to everyCircle!</Text>
            <Text style={styles.subtitle}>
              {referralRequired
                ? "Who referred you? Finish this step to complete your sign up."
                : isGoogleSignUp
                  ? "Complete your sign up"
                  : "Sign up with Google, Apple, or your email. We'll email you a temporary password."}
            </Text>
          </View>

          {!referralRequired && !isGoogleSignUp && (
            <>
              <View style={styles.socialContainer}>
                <GoogleBrandedSignInButton mode='signUp' onPress={onGoogleSignUp} disabled={isAttemptingLogin} />
                <AppleSignIn mode='signUp' onSignIn={onAppleSignUp} onError={onError} disabled={isAttemptingLogin} />
              </View>

              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.divider} />
              </View>
            </>
          )}

          {!referralRequired && (
            <View style={styles.inputContainer}>
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder='Email'
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType='email-address'
                  autoCapitalize='none'
                  editable={!isGoogleSignUp}
                  accessibilitylabel='Email'
                  accessibilityHint='Enter your email address'
                />
              </View>
              {!!userExistsError && <Text style={styles.userExistsErrorText}>{userExistsError}</Text>}
            </View>
          )}

          {!referralRequired && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.continueButton, isValid ? styles.continueButtonActive : styles.continueButtonDisabled]}
                onPress={handleContinue}
                disabled={!isValid || isAttemptingLogin}
              >
                {isAttemptingLogin ? (
                  <ActivityIndicator color='#fff' />
                ) : (
                  <Text style={[styles.continueButtonText, isValid ? styles.continueButtonTextActive : styles.continueButtonTextDisabled]}>
                    {isGoogleSignUp ? "Complete Sign Up" : "Continue"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {!referralRequired && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Already have an account?{" "}
                <Text style={styles.logInText} onPress={() => navigation.navigate("Login", authContinuationParams(route))}>
                  Log In
                </Text>
              </Text>
            </View>
          )}

          {/* Referral Modal */}
          <Modal visible={showReferralModal} transparent animationType='fade'>
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
              <View style={{ backgroundColor: "#fff", padding: 24, borderRadius: 12, width: "90%", maxWidth: 500, maxHeight: "80%" }}>
                <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>Who referred you to everyCircle?</Text>

                {/* Email Input Section */}
                {/* <TextInput
                  style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, marginBottom: 8 }}
                  placeholder='Enter referral email (optional)'
                  value={referralId}
                  onChangeText={setReferralId}
                  keyboardType='email-address'
                  autoCapitalize='none'
                  editable={!isCheckingReferral}
                  accessibilitylabel='Referral email'
                  accessibilityHint='Enter the email address of the person who referred you, or leave it blank'
                  accessibilityState={{ disabled: isCheckingReferral }}
                /> */}
                {/* {!!referralError && <Text style={{ color: "red", marginBottom: 8 }}>{referralError}</Text>}
                <TouchableOpacity
                  style={{ backgroundColor: "#FF9500", paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, minWidth: 100, alignItems: "center", justifyContent: "center", marginBottom: 12 }}
                  onPress={handleReferralSubmit}
                  disabled={isCheckingReferral}
                  accessibilityRole='button'
                  accessibilitylabel={isCheckingReferral ? "Checking referral" : "Continue"}
                  accessibilityHint='Checks the referral email and continues'
                  accessibilityState={{ disabled: isCheckingReferral, busy: isCheckingReferral }}
                >
                  <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>{isCheckingReferral ? "Checking..." : "Continue"}</Text>
                </TouchableOpacity> */}

                {/* Divider */}
                {/* <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 16 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: "#E5E5E5" }} />
                  <Text style={{ marginHorizontal: 10, color: "#666", fontSize: 14 }}>OR SEARCH</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: "#E5E5E5" }} />
                </View> */}

                {/* Search Section - Embed ReferralSearch content here */}
                <ReferralSearch
                  visible={true}
                  onSelect={handleReferralSelect}
                  onNewUser={handleNewUserReferral}
                  onClose={
                    referralRequired
                      ? () => {}
                      : () => {
                          setShowReferralModal(false);
                          setPendingReferralCompletion(false);
                          AsyncStorage.multiRemove(["referral_uid", "referral_email"]);
                        }
                  }
                  embedded={true}
                  instructionText='Search by email, city, state, or name'
                  searchPlaceholder='Email, location, or name'
                  noResultsSubtext='Try another spelling, city, or email.'
                />
              </View>
            </View>
          </Modal>

          <Modal visible={showPasswordFallbackModal} transparent animationType='fade'>
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
              <View style={{ backgroundColor: "#fff", padding: 24, borderRadius: 12, width: "90%", maxWidth: 500 }}>
                <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 8 }}>Set a password</Text>
                <Text style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
                  We couldn't email a temporary password. Please create a password to finish signing up.
                </Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder='Password'
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!isPasswordVisible}
                    autoCapitalize='none'
                  />
                  <TouchableOpacity style={styles.passwordVisibilityToggle} onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
                    <Ionicons name={isPasswordVisible ? "eye-off" : "eye"} size={24} color='#666' />
                  </TouchableOpacity>
                </View>
                <View style={[styles.passwordInputContainer, { marginTop: 12 }]}>
                  <TextInput
                    style={styles.input}
                    placeholder='Confirm Password'
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!isConfirmPasswordVisible}
                    autoCapitalize='none'
                  />
                  <TouchableOpacity style={styles.passwordVisibilityToggle} onPress={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)}>
                    <Ionicons name={isConfirmPasswordVisible ? "eye-off" : "eye"} size={24} color='#666' />
                  </TouchableOpacity>
                </View>
                {!!passwordFallbackError && <Text style={styles.userExistsErrorText}>{passwordFallbackError}</Text>}
                <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                  <TouchableOpacity
                    style={[styles.continueButton, styles.continueButtonDisabled, { flex: 1 }]}
                    onPress={() => {
                      setShowPasswordFallbackModal(false);
                      setPendingTempSignupUserUid(null);
                      setPasswordFallbackError("");
                    }}
                    disabled={isAttemptingLogin}
                  >
                    <Text style={styles.continueButtonTextDisabled}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.continueButton, styles.continueButtonActive, { flex: 1 }]}
                    onPress={handlePasswordFallbackSubmit}
                    disabled={isAttemptingLogin}
                  >
                    {isAttemptingLogin ? <ActivityIndicator color='#fff' /> : <Text style={styles.continueButtonTextActive}>Continue</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginTop: 0,
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#007AFF",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 30,
  },
  fieldContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#000",
  },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ccc",
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
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
  },
  continueButton: {
    backgroundColor: "#FF9500",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  continueButtonActive: {
    backgroundColor: "#FF9500",
  },
  continueButtonDisabled: {
    backgroundColor: "#999",
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  continueButtonTextActive: {
    color: "#fff",
  },
  continueButtonTextDisabled: {
    color: "#ccc",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E5E5",
  },
  dividerText: {
    marginHorizontal: 10,
    color: "#666",
  },
  socialContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  footer: {
    alignItems: "center",
  },
  footerText: {
    fontSize: 16,
    color: "#666",
  },
  logInText: {
    color: "#FF9500",
    fontWeight: "bold",
  },
  userExistsErrorText: {
    color: "red",
    fontSize: 14,
    marginTop: -10,
    marginBottom: 8,
    textAlign: "left",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 12,
    width: "85%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#007AFF",
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#E5E5E5",
  },
  modalButtonCancelText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalButtonSubmit: {
    backgroundColor: "#FF9500",
  },
  modalButtonSubmitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
