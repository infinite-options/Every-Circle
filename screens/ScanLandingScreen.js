import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Share, TextInput, Alert, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import MiniCard from "../components/MiniCard";
import ScannedProfilePopup from "../components/ScannedProfilePopup";
import GoogleBrandedSignInButton from "../components/GoogleBrandedSignInButton";
import AppleSignIn from "../AppleSignIn";
import { CREATE_ACCOUNT_ENDPOINT, CREATE_ACCOUNT_TEMP_PASSWORD_ENDPOINT, UPDATE_EMAIL_PASSWORD_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "../utils/httpMiddleware";
import { issueCircleTokensFromPassword, persistAuthTokens } from "../utils/authSession";
import { refreshAllowCookies } from "../utils/cookieConsent";
import { clearSessionAsyncStorage } from "../utils/clearAppAsyncStorage";
import { isSoftDeletedRegisterConflict, reactivateNavParamsFromAuthPayload } from "../utils/deletedProfile";
import { finishSignupAfterReferral } from "../utils/finishSignupAfterReferral";
import { fetchPublicProfileCard } from "../utils/fetchPublicProfileCard";
import { goToNetworkForScanConnect } from "../utils/goToNetworkForScanConnect";
import { clearUserProfileCacheStorage } from "../utils/sessionProfile";
import { markTempPasswordGracePeriod } from "../utils/tempPasswordGrace";
import { isValidEmail } from "../utils/emailValidation";
import {
  savePendingScanConnection,
  hasPendingScanConnectionFor,
  captureEphemeralSignupKeys,
  restoreEphemeralSignupKeys,
  flushPendingScanConnectionAfterAuth,
} from "../utils/pendingScanConnection";
import versionData from "../version.json";

const OAUTH_TIMEOUT_MS = 30000;
const CREATE_ACCOUNT_TIMEOUT_MS = 30000;

function withTimeout(promise, ms, message) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

async function fetchWithTimeout(url, options = {}, ms = CREATE_ACCOUNT_TIMEOUT_MS) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller?.signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("Request timed out. Please try again or set a password.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function escapeVCardValue(value) {
  if (!value) return "";
  return String(value).replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function buildVCard(data) {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  const fullName = `${data.firstName} ${data.lastName}`.trim();
  if (fullName) {
    lines.push(`FN:${fullName}`);
    lines.push(`N:${data.lastName || ""};${data.firstName || ""};;;`);
  }
  if (data.tagLine) {
    lines.push(`ORG:${escapeVCardValue(data.tagLine)}`);
  }
  if (data.city || data.state) {
    lines.push(`ADR;TYPE=home:;;${data.city || ""};${data.state || ""};;;`);
  }
  if (data.email) {
    lines.push(`EMAIL:${data.email}`);
  }
  if (data.phoneNumber) {
    const phone = String(data.phoneNumber).replace(/\D/g, "");
    if (phone) lines.push(`TEL:${phone}`);
  }
  if (data.profile_uid) {
    lines.push(`NOTE:everyCircle profile: ${data.profile_uid}`);
  }
  if (data.user_uid) {
    lines.push(`NOTE:User ID: ${data.user_uid}`);
  }
  if (data.profileImage) {
    lines.push(`PHOTO;TYPE=URL:${data.profileImage}`);
  }
  lines.push("END:VCARD");
  return lines.join("\n");
}

function resolveProfileUidFromRoute(route) {
  const fromParams = route?.params?.profile_uid;
  if (fromParams) return String(fromParams).trim();
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const seg = window.location.pathname.split("/scan/")[1];
    if (seg) return seg.split("/")[0]?.split("?")[0]?.trim() || null;
  }
  return null;
}

/** Params for Login / SignUp when continuing from a scan link (QR owner's profile_uid). */
export function scanLandingAuthParams(profileUid) {
  return {
    returnToScanLanding: true,
    profile_uid: profileUid,
    referralProfileUid: profileUid,
  };
}

function buildVersionLabel() {
  const pm = versionData?.pm_version || "";
  const major = versionData?.major ?? "";
  const build = versionData?.build ?? "";
  return `PM ${pm} · v${major}.${build} · preview`;
}

export default function ScanLandingScreen({ onGoogleSignUp, onAppleSignUp, onError }) {
  const route = useRoute();
  const navigation = useNavigation();
  const profileUid = resolveProfileUidFromRoute(route);

  const [loading, setLoading] = useState(!!profileUid);
  const [error, setError] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [showPasswordFallbackModal, setShowPasswordFallbackModal] = useState(false);
  const [pendingTempSignupUserUid, setPendingTempSignupUserUid] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [passwordFallbackError, setPasswordFallbackError] = useState("");
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [emailFallbackHint, setEmailFallbackHint] = useState("");
  const [scrollViewportH, setScrollViewportH] = useState(0);
  /** Guest QR: notes saved (or valid draft) before showing Google/Apple/email auth. */
  const [notesCommitted, setNotesCommitted] = useState(false);
  const [showGuestConnectPopup, setShowGuestConnectPopup] = useState(false);
  const [savingGuestNotes, setSavingGuestNotes] = useState(false);
  const [checkingDraft, setCheckingDraft] = useState(!!profileUid);
  const redirectStartedRef = useRef(false);
  const emailInputRef = useRef(null);
  const oauthWatchdogRef = useRef(null);
  const appleAuthInFlightRef = useRef(false);
  const fallbackPromptedRef = useRef(false);
  const oauthAbandonedRef = useRef(false);

  const loadProfile = useCallback(async () => {
    if (!profileUid) {
      setError("Invalid or missing link.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const card = await fetchPublicProfileCard(profileUid);
      setProfileData(card);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [profileUid]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const checkSession = useCallback(async () => {
    setCheckingSession(true);
    try {
      const uid = await AsyncStorage.getItem("profile_uid");
      setIsLoggedIn(!!uid);
    } catch {
      setIsLoggedIn(false);
    } finally {
      setCheckingSession(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkSession();
    }, [checkSession]),
  );

  // Resume auth step if a valid draft already exists for this QR owner (within TTL).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profileUid) {
        setCheckingDraft(false);
        return;
      }
      setCheckingDraft(true);
      try {
        const hasDraft = await hasPendingScanConnectionFor(profileUid);
        if (cancelled) return;
        setNotesCommitted(hasDraft);
        if (!hasDraft) {
          setShowGuestConnectPopup(true);
        }
      } finally {
        if (!cancelled) setCheckingDraft(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileUid]);

  const clearAndRestoreEphemeralKeys = useCallback(async (referralUidOverride) => {
    const ephemeral = await captureEphemeralSignupKeys();
    await AsyncStorage.clear();
    refreshAllowCookies();
    await restoreEphemeralSignupKeys(ephemeral, referralUidOverride || ephemeral.referralUid);
  }, []);

  const handleGuestAddConnection = useCallback(
    async (connectionData) => {
      if (!profileUid || savingGuestNotes) return;
      setSavingGuestNotes(true);
      try {
        await savePendingScanConnection(profileUid, connectionData);
        await AsyncStorage.setItem("referral_uid", profileUid);
        setNotesCommitted(true);
        setShowGuestConnectPopup(false);
      } catch (e) {
        console.warn("ScanLanding - save pending connection failed:", e?.message || e);
        Alert.alert("Error", "Could not save your notes. Please try again.");
      } finally {
        setSavingGuestNotes(false);
      }
    },
    [profileUid, savingGuestNotes],
  );

  const redirectToNetwork = useCallback(async () => {
    if (!profileUid || redirectStartedRef.current) return;
    const myUid = await AsyncStorage.getItem("profile_uid");
    if (!myUid) return;

    redirectStartedRef.current = true;
    setRedirecting(true);

    // Returning after auth with a notes draft: create connection + notify owner (no empty Connect with Me).
    const flushResult = await flushPendingScanConnectionAfterAuth({
      scannerIsNewSignup: true,
      relatedProfileUid: profileUid,
    });
    if (flushResult.flushed) {
      navigation.navigate("Profile", { profile_uid: flushResult.relatedProfileUid || profileUid });
      return;
    }

    await goToNetworkForScanConnect(navigation, profileUid);
  }, [profileUid, navigation]);

  // Already logged in, or returning after login/signup (openConnectModal)
  useEffect(() => {
    if (!profileUid || loading || checkingSession || redirectStartedRef.current) return;

    const shouldRedirect = isLoggedIn || route.params?.openConnectModal === true;
    if (!shouldRedirect) return;

    if (route.params?.openConnectModal === true && !isLoggedIn) {
      let cancelled = false;
      let tries = 0;
      const poll = setInterval(async () => {
        if (cancelled) return;
        const myUid = await AsyncStorage.getItem("profile_uid");
        if (myUid) {
          clearInterval(poll);
          setIsLoggedIn(true);
          redirectToNetwork();
          navigation.setParams({ openConnectModal: undefined });
        } else if (++tries > 24) {
          clearInterval(poll);
        }
      }, 500);
      return () => {
        cancelled = true;
        clearInterval(poll);
      };
    }

    if (isLoggedIn) {
      redirectToNetwork();
    }
  }, [profileUid, loading, checkingSession, isLoggedIn, route.params?.openConnectModal, redirectToNetwork, navigation]);

  const authParams = useMemo(() => (profileUid ? scanLandingAuthParams(profileUid) : {}), [profileUid]);

  // Persist QR owner as referrer as soon as the scan link is opened (survives OAuth storage wipes if restored).
  useEffect(() => {
    if (!profileUid) return;
    AsyncStorage.setItem("referral_uid", profileUid).catch(() => {});
  }, [profileUid]);

  const persistReferral = useCallback(() => {
    if (profileUid) {
      AsyncStorage.setItem("referral_uid", profileUid).catch(() => {});
    }
  }, [profileUid]);

  const goToLogin = useCallback(() => {
    persistReferral();
    navigation.navigate("Login", authParams);
  }, [navigation, authParams, persistReferral]);

  const clearOauthWatchdog = useCallback(() => {
    if (oauthWatchdogRef.current) {
      clearTimeout(oauthWatchdogRef.current);
      oauthWatchdogRef.current = null;
    }
  }, []);

  useEffect(() => () => clearOauthWatchdog(), [clearOauthWatchdog]);

  const promptEmailFallback = useCallback(
    (message) => {
      clearOauthWatchdog();
      setSigningIn(false);
      appleAuthInFlightRef.current = false;
      oauthAbandonedRef.current = true;
      if (fallbackPromptedRef.current) return;
      fallbackPromptedRef.current = true;
      const hint = message || "Google or Apple didn’t finish in time. Enter your email below to continue.";
      setEmailFallbackHint(hint);
      setTimeout(() => emailInputRef.current?.focus?.(), 100);
    },
    [clearOauthWatchdog],
  );

  const openPasswordFallbackModal = useCallback((userUid) => {
    setPendingTempSignupUserUid(userUid ? String(userUid) : null);
    setPassword("");
    setConfirmPassword("");
    setPasswordFallbackError("");
    setIsPasswordVisible(false);
    setIsConfirmPasswordVisible(false);
    setShowPasswordFallbackModal(true);
  }, []);

  const finishAfterPasswordSet = useCallback(
    async (userUid, trimmed, preservedReferralUid, passwordValue) => {
      await AsyncStorage.setItem("user_uid", String(userUid));
      await AsyncStorage.setItem("user_email_id", trimmed);
      if (preservedReferralUid) {
        await AsyncStorage.setItem("referral_uid", preservedReferralUid);
      }

      const circleAuth = await issueCircleTokensFromPassword(trimmed, passwordValue, fetch);
      if (circleAuth?.pendingDeletion) {
        setShowPasswordFallbackModal(false);
        await clearSessionAsyncStorage();
        await clearUserProfileCacheStorage();
        navigation.navigate("Reactivate", reactivateNavParamsFromAuthPayload(circleAuth.data || {}, { email: trimmed, password: passwordValue }));
        return;
      }

      setShowPasswordFallbackModal(false);
      setPendingTempSignupUserUid(null);
      await finishSignupAfterReferral(navigation, {
        referralUid: preservedReferralUid,
        routeParams: { ...authParams, referralProfileUid: preservedReferralUid },
        userUid: String(userUid),
        email: trimmed,
      });
    },
    [authParams, navigation],
  );

  const handlePasswordFallbackSubmit = useCallback(async () => {
    setPasswordFallbackError("");
    if (password.length < 6) {
      setPasswordFallbackError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordFallbackError("Passwords do not match.");
      return;
    }

    setSubmittingPassword(true);
    try {
      const trimmed = email.trim();
      if (!isValidEmail(trimmed)) {
        setPasswordFallbackError("Enter a valid email address first.");
        return;
      }
      const preservedReferralUid = String(profileUid || authParams.referralProfileUid || (await AsyncStorage.getItem("referral_uid")) || "").trim() || null;

      if (pendingTempSignupUserUid) {
        const userUid = String(pendingTempSignupUserUid);
        const updateResponse = await fetch(UPDATE_EMAIL_PASSWORD_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: trimmed,
            user_uid: userUid,
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
        await finishAfterPasswordSet(userUid, trimmed, preservedReferralUid, password);
        return;
      }

      // No user_uid yet (create-account timed out / never returned) → create with password.
      const createAccountResponse = await fetch(CREATE_ACCOUNT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, password }),
      });
      const createAccountData = await createAccountResponse.json().catch(() => ({}));
      if (isSoftDeletedRegisterConflict(createAccountData, createAccountResponse.status)) {
        setShowPasswordFallbackModal(false);
        navigation.navigate("Reactivate", reactivateNavParamsFromAuthPayload(createAccountData, { email: trimmed, password }));
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
      await clearAndRestoreEphemeralKeys(preservedReferralUid);
      await finishAfterPasswordSet(createAccountData.user_uid, trimmed, preservedReferralUid, password);
    } catch (err) {
      console.error("ScanLanding - password fallback failed:", err);
      setPasswordFallbackError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmittingPassword(false);
    }
  }, [password, confirmPassword, pendingTempSignupUserUid, email, profileUid, authParams, navigation, finishAfterPasswordSet, clearAndRestoreEphemeralKeys]);

  /** Email-only signup on this page: temp password email + stub profile → Connect + reverse-contact notify. */
  const handleEmailContinue = useCallback(async () => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    if (submittingEmail || signingIn) return;

    setEmailError("");
    setEmailFallbackHint("");
    setSubmittingEmail(true);
    persistReferral();

    const preservedReferralUid = String(profileUid || authParams.referralProfileUid || (await AsyncStorage.getItem("referral_uid")) || "").trim() || null;

    try {
      let createAccountResponse;
      let createAccountData = {};
      try {
        createAccountResponse = await fetchWithTimeout(
          CREATE_ACCOUNT_TEMP_PASSWORD_ENDPOINT,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: trimmed }),
          },
          CREATE_ACCOUNT_TIMEOUT_MS,
        );
        createAccountData = await createAccountResponse.json().catch(() => ({}));
      } catch (endpointErr) {
        console.warn("ScanLanding - temp-password signup unavailable/timeout:", endpointErr);
        // Timed out or network failure after possible create — ask user to set a password.
        openPasswordFallbackModal(null);
        Alert.alert("Continue with a password", "We couldn’t confirm a temporary password email in time. Please set a password to finish signing up.");
        return;
      }

      console.log("ScanLanding - Temp password signup response:", createAccountResponse?.status, createAccountData);

      if (createAccountResponse.status === 404 || createAccountResponse.status === 501) {
        openPasswordFallbackModal(null);
        return;
      }

      if (isSoftDeletedRegisterConflict(createAccountData, createAccountResponse.status)) {
        navigation.navigate("Reactivate", reactivateNavParamsFromAuthPayload(createAccountData, { email: trimmed, password: "" }));
        return;
      }

      if (createAccountData.message === "User already exists") {
        setEmailError("User already exists — please Log in");
        return;
      }

      if (createAccountData.code === 281 && createAccountData.user_uid) {
        await clearAndRestoreEphemeralKeys(preservedReferralUid);
        await AsyncStorage.setItem("user_uid", String(createAccountData.user_uid));
        await AsyncStorage.setItem("user_email_id", trimmed);
        if (preservedReferralUid) {
          await AsyncStorage.setItem("referral_uid", preservedReferralUid);
        }

        await persistAuthTokens(createAccountData);
        if (!createAccountData.access_token && !createAccountData.refresh_token) {
          const nested = createAccountData.result || createAccountData.data;
          if (nested) await persistAuthTokens(nested);
        }

        if (createAccountData.email_sent === false) {
          openPasswordFallbackModal(createAccountData.user_uid);
          return;
        }

        await markTempPasswordGracePeriod();
        await finishSignupAfterReferral(navigation, {
          referralUid: preservedReferralUid,
          routeParams: { ...authParams, referralProfileUid: preservedReferralUid },
          userUid: String(createAccountData.user_uid),
          email: trimmed,
        });
        return;
      }

      if (!createAccountResponse.ok) {
        openPasswordFallbackModal(createAccountData.user_uid ? String(createAccountData.user_uid) : null);
        return;
      }

      throw new Error(createAccountData.message || "Failed to create account");
    } catch (err) {
      console.error("ScanLanding - email signup failed:", err);
      openPasswordFallbackModal(null);
    } finally {
      setSubmittingEmail(false);
    }
  }, [email, submittingEmail, signingIn, persistReferral, profileUid, authParams, navigation, openPasswordFallbackModal, clearAndRestoreEphemeralKeys]);

  const handleGoogleSignUp = useCallback(async () => {
    if (signingIn || submittingEmail || !onGoogleSignUp) return;
    persistReferral();
    fallbackPromptedRef.current = false;
    setEmailFallbackHint("");
    setSigningIn(true);
    clearOauthWatchdog();
    oauthAbandonedRef.current = false;
    try {
      await withTimeout(Promise.resolve(onGoogleSignUp(authParams)), OAUTH_TIMEOUT_MS, "Google Sign-Up timed out. Enter your email below to continue.");
      if (oauthAbandonedRef.current) return;
    } catch (err) {
      console.warn("ScanLanding - Google signup failed/timeout:", err);
      promptEmailFallback(err?.message || "Google Sign-Up didn’t finish. Enter your email below to continue.");
      return;
    } finally {
      clearOauthWatchdog();
      setSigningIn(false);
    }
  }, [signingIn, submittingEmail, onGoogleSignUp, authParams, persistReferral, clearOauthWatchdog, promptEmailFallback]);

  const handleAppleAuthStart = useCallback(() => {
    if (signingIn || submittingEmail) return;
    persistReferral();
    fallbackPromptedRef.current = false;
    setEmailFallbackHint("");
    appleAuthInFlightRef.current = true;
    oauthAbandonedRef.current = false;
    setSigningIn(true);
    clearOauthWatchdog();
    oauthWatchdogRef.current = setTimeout(() => {
      if (!appleAuthInFlightRef.current) return;
      promptEmailFallback("Apple Sign-Up timed out. Enter your email below to continue.");
    }, OAUTH_TIMEOUT_MS);
  }, [signingIn, submittingEmail, persistReferral, clearOauthWatchdog, promptEmailFallback]);

  const handleAppleSignUp = useCallback(
    async (...args) => {
      if (oauthAbandonedRef.current) return;
      try {
        if (!onAppleSignUp) return;
        await withTimeout(Promise.resolve(onAppleSignUp(...args)), OAUTH_TIMEOUT_MS, "Apple Sign-Up timed out. Enter your email below to continue.");
      } catch (err) {
        console.warn("ScanLanding - Apple signup failed/timeout:", err);
        promptEmailFallback(err?.message || "Apple Sign-Up didn’t finish. Enter your email below to continue.");
        throw err;
      }
    },
    [onAppleSignUp, promptEmailFallback],
  );

  const handleAppleAuthEnd = useCallback(
    (result) => {
      appleAuthInFlightRef.current = false;
      clearOauthWatchdog();
      setSigningIn(false);
      if (result?.status === "cancelled") {
        promptEmailFallback("Apple Sign-Up was cancelled. Enter your email below to continue, or try again.");
      } else if (result?.status === "error") {
        promptEmailFallback("Apple Sign-Up failed. Enter your email below to continue, or try again.");
      }
    },
    [clearOauthWatchdog, promptEmailFallback],
  );

  const handleAppleError = useCallback(
    (message) => {
      onError?.(message);
      promptEmailFallback(typeof message === "string" && message ? message : "Apple Sign-Up failed. Enter your email below to continue.");
    },
    [onError, promptEmailFallback],
  );

  const downloadVCard = useCallback(() => {
    if (!profileData) return;
    const vcard = buildVCard(profileData);
    const safeName = `${profileData.firstName}-${profileData.lastName}`.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "") || "everycircle-contact";
    const filename = `${safeName}.vcf`;

    if (Platform.OS === "web" && typeof document !== "undefined") {
      const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
      return;
    }

    Share.share({
      message: vcard,
      title: `${profileData.firstName} ${profileData.lastName}`.trim() || "Contact",
    }).catch(() => {});
  }, [profileData]);

  const showGuestActions = !checkingSession && !checkingDraft && !isLoggedIn && !redirecting;
  const showGuestNotesStep = showGuestActions && !notesCommitted;
  const showGuestAuthStep = showGuestActions && notesCommitted;
  const showRedirecting = redirecting || (isLoggedIn && !showGuestActions);
  const versionLabel = buildVersionLabel();

  // Web only (QR camera → Safari/Chrome): pin #root to the visible viewport so the
  // under-root yellow/white strip is covered. Restored when leaving this screen.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "web" || typeof document === "undefined") return undefined;

      const root = document.getElementById("root");
      const html = document.documentElement;
      const body = document.body;
      if (!root || !html || !body) return undefined;

      window.__EC_SCAN_LANDING_VIEWPORT_FILL__ = true;

      const prev = {
        htmlClass: html.className,
        htmlBg: html.style.backgroundColor,
        htmlHeight: html.style.height,
        htmlMinHeight: html.style.minHeight,
        bodyBg: body.style.backgroundColor,
        bodyHeight: body.style.height,
        bodyMinHeight: body.style.minHeight,
        bodyOverflow: body.style.overflow,
        rootCssText: root.style.cssText,
      };

      const styleEl = document.createElement("style");
      styleEl.setAttribute("data-ec-scan-landing-fill", "1");
      styleEl.textContent = `
        html.ec-scan-landing,
        html.ec-scan-landing body {
          height: 100% !important;
          min-height: 100% !important;
          min-height: 100dvh !important;
          min-height: -webkit-fill-available !important;
          background-color: #ECEEF5 !important;
          overflow: hidden !important;
        }
        html.ec-scan-landing #root {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 100% !important;
          min-height: 100dvh !important;
          min-height: -webkit-fill-available !important;
          max-height: none !important;
          overflow: hidden !important;
          background-color: #ECEEF5 !important;
        }
      `;
      document.head.appendChild(styleEl);
      html.classList.add("ec-scan-landing");

      const fill = () => {
        // Also set inline sizes from the largest available metric (camera handoff settles late).
        const vv = window.visualViewport;
        const vvBottom = vv ? Math.round(vv.height + (vv.offsetTop || 0)) : 0;
        const h = Math.max(1, Math.round(vv?.height || 0), Math.round(window.innerHeight || 0), Math.round(html.clientHeight || 0), vvBottom);
        const px = `${h}px`;
        html.style.height = px;
        html.style.minHeight = px;
        body.style.height = px;
        body.style.minHeight = px;
        root.style.height = px;
        root.style.minHeight = px;
        root.style.top = "0px";
        root.style.bottom = "0px";
      };

      fill();
      window.visualViewport?.addEventListener?.("resize", fill);
      window.visualViewport?.addEventListener?.("scroll", fill);
      window.addEventListener("resize", fill);
      window.addEventListener("orientationchange", fill);
      const timers = [50, 200, 500, 1000, 2000, 3000].map((ms) => setTimeout(fill, ms));

      return () => {
        window.__EC_SCAN_LANDING_VIEWPORT_FILL__ = false;
        window.visualViewport?.removeEventListener?.("resize", fill);
        window.visualViewport?.removeEventListener?.("scroll", fill);
        window.removeEventListener("resize", fill);
        window.removeEventListener("orientationchange", fill);
        timers.forEach(clearTimeout);
        styleEl.remove();
        html.classList.remove("ec-scan-landing");
        html.style.backgroundColor = prev.htmlBg;
        html.style.height = prev.htmlHeight;
        html.style.minHeight = prev.htmlMinHeight;
        body.style.backgroundColor = prev.bodyBg;
        body.style.height = prev.bodyHeight;
        body.style.minHeight = prev.bodyMinHeight;
        body.style.overflow = prev.bodyOverflow;
        root.style.cssText = prev.rootCssText;
      };
    }, []),
  );

  // Scroll content padding (keep in sync with styles.scroll)
  const SCROLL_PAD_TOP = 56;
  const SCROLL_PAD_BOTTOM = 24;
  // RN-web ScrollView often ignores flexGrow for children; minHeight fills short viewports.
  // When content is taller than the viewport, the panel grows past minHeight and ScrollView scrolls.
  const panelMinHeight = scrollViewportH > 0 ? Math.max(0, scrollViewportH - SCROLL_PAD_TOP - SCROLL_PAD_BOTTOM) : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scroll, scrollViewportH > 0 && { minHeight: scrollViewportH }]}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator
        bounces
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.height);
          if (h > 0 && h !== scrollViewportH) setScrollViewportH(h);
        }}
      >
        <View style={[styles.panel, panelMinHeight ? { minHeight: panelMinHeight } : null]}>
          <View style={styles.body}>
            <Text style={styles.headline}>{showGuestNotesStep ? "Connect With Me" : "Connect on everyCircle"}</Text>
            <Text style={styles.sub}>
              {showRedirecting
                ? "Taking you to your network…"
                : showGuestNotesStep
                  ? "Add a few notes about how you know this person, then join everyCircle to save the connection."
                  : "You're one click from joining the most trusted network on the planet. Join with Google or Apple, or enter your email."}
            </Text>

            {(loading || checkingDraft || showRedirecting) && (
              <View style={styles.centerRow}>
                <ActivityIndicator size='large' color='#2434C2' />
                <Text style={styles.muted}>{loading || checkingDraft ? "Loading profile…" : "Opening connect…"}</Text>
              </View>
            )}

            {!loading && error && <Text style={styles.error}>{error}</Text>}

            {!loading && !error && profileData && showGuestNotesStep && (
              <>
                <View style={styles.cardWrap}>
                  <MiniCard user={profileData} />
                </View>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => setShowGuestConnectPopup(true)}
                  activeOpacity={0.85}
                  disabled={savingGuestNotes}
                >
                  <Text style={styles.primaryBtnText}>Add connection details</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryBtn, styles.lastSecondaryBtn]} onPress={downloadVCard} activeOpacity={0.85}>
                  <Text style={styles.secondaryBtnText}>No thanks — save contact in Phone</Text>
                </TouchableOpacity>
              </>
            )}

            {!loading && !error && profileData && showGuestAuthStep && (
              <>
                <View style={styles.cardWrap}>
                  <MiniCard user={profileData} />
                </View>

                <View style={styles.socialContainer}>
                  <GoogleBrandedSignInButton mode='signUp' onPress={handleGoogleSignUp} disabled={signingIn} signingIn={signingIn} />
                  <AppleSignIn
                    mode='signUp'
                    onSignIn={handleAppleSignUp}
                    onError={handleAppleError}
                    onAuthSessionStart={handleAppleAuthStart}
                    onAuthSessionEnd={handleAppleAuthEnd}
                    disabled={signingIn}
                  />
                </View>

                <View style={styles.dividerContainer}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.divider} />
                </View>

                {!!emailFallbackHint && <Text style={styles.emailFallbackHint}>{emailFallbackHint}</Text>}

                <TextInput
                  ref={emailInputRef}
                  style={styles.emailInput}
                  placeholder='Email'
                  placeholderTextColor='#888'
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailError) setEmailError("");
                    if (emailFallbackHint) setEmailFallbackHint("");
                  }}
                  keyboardType='email-address'
                  autoCapitalize='none'
                  autoCorrect={false}
                  editable={!submittingEmail && !signingIn}
                  accessibilityLabel='Email'
                  accessibilityHint='Enter your email address to sign up'
                  returnKeyType='go'
                  onSubmitEditing={handleEmailContinue}
                />
                {!!emailError && <Text style={styles.emailError}>{emailError}</Text>}

                <TouchableOpacity
                  style={[styles.primaryBtn, (!isValidEmail(email.trim()) || submittingEmail) && styles.primaryBtnDisabled]}
                  onPress={handleEmailContinue}
                  activeOpacity={0.85}
                  disabled={!isValidEmail(email.trim()) || submittingEmail || signingIn}
                >
                  {submittingEmail ? <ActivityIndicator color='#fff' /> : <Text style={styles.primaryBtnText}>Continue with email</Text>}
                </TouchableOpacity>

                <View style={styles.sectionRule} />

                <TouchableOpacity style={styles.secondaryBtn} onPress={goToLogin} activeOpacity={0.85}>
                  <Text style={styles.secondaryBtnText}>Log in</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.secondaryBtn, styles.lastSecondaryBtn]} onPress={downloadVCard} activeOpacity={0.85}>
                  <Text style={styles.secondaryBtnText}>No thanks — save contact in Phone</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <Text style={styles.version}>{versionLabel}</Text>
        </View>
      </ScrollView>

      <ScannedProfilePopup
        visible={showGuestNotesStep && showGuestConnectPopup && !!profileData}
        profileData={profileData}
        onClose={() => setShowGuestConnectPopup(false)}
        onAddConnection={handleGuestAddConnection}
        title='Connect With Me'
        actionLabel={savingGuestNotes ? "Saving…" : "Add to Network"}
      />

      <Modal visible={showPasswordFallbackModal} transparent animationType='fade'>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set a password</Text>
            <Text style={styles.modalSubtitle}>We couldn't email a temporary password. Please create a password to finish signing up.</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder='Password'
                placeholderTextColor='#888'
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!isPasswordVisible}
                autoCapitalize='none'
                editable={!submittingPassword}
              />
              <TouchableOpacity style={styles.passwordVisibilityToggle} onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
                <Ionicons name={isPasswordVisible ? "eye-off" : "eye"} size={24} color='#666' />
              </TouchableOpacity>
            </View>
            <View style={[styles.passwordInputContainer, { marginTop: 12 }]}>
              <TextInput
                style={styles.passwordInput}
                placeholder='Confirm Password'
                placeholderTextColor='#888'
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!isConfirmPasswordVisible}
                autoCapitalize='none'
                editable={!submittingPassword}
              />
              <TouchableOpacity style={styles.passwordVisibilityToggle} onPress={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)}>
                <Ionicons name={isConfirmPasswordVisible ? "eye-off" : "eye"} size={24} color='#666' />
              </TouchableOpacity>
            </View>
            {!!passwordFallbackError && <Text style={styles.passwordFallbackError}>{passwordFallbackError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => {
                  setShowPasswordFallbackModal(false);
                  setPendingTempSignupUserUid(null);
                  setPasswordFallbackError("");
                }}
                disabled={submittingPassword}
                activeOpacity={0.85}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handlePasswordFallbackSubmit} disabled={submittingPassword} activeOpacity={0.85}>
                {submittingPassword ? <ActivityIndicator color='#fff' /> : <Text style={styles.modalBtnPrimaryText}>Continue</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ECEEF5" },
  scrollView: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scroll: {
    paddingHorizontal: 14,
    paddingTop: 56,
    paddingBottom: 24,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  panel: {
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 12px rgba(20, 30, 70, 0.08)",
      },
      default: {
        shadowColor: "#141E46",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  body: {
    width: "100%",
  },
  headline: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
    marginBottom: 6,
    textAlign: "center",
  },
  sub: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
    marginBottom: 12,
    textAlign: "center",
  },
  centerRow: { alignItems: "center", paddingVertical: 24, gap: 12 },
  muted: { fontSize: 14, color: "#666" },
  error: { color: "#b00020", textAlign: "center", fontSize: 15, marginTop: 8, marginBottom: 8 },
  cardWrap: { marginBottom: 10 },
  socialContainer: {
    alignItems: "center",
    marginBottom: 2,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 10,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#C8CCD8",
  },
  dividerText: {
    marginHorizontal: 10,
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
  },
  emailInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#CFD3DE",
    marginBottom: 8,
    color: "#111",
  },
  emailError: {
    color: "#b00020",
    fontSize: 13,
    marginBottom: 8,
    textAlign: "center",
  },
  emailFallbackHint: {
    color: "#8A5A00",
    backgroundColor: "#FFF6E5",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: "#2434C2",
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  primaryBtnDisabled: {
    backgroundColor: "#9AA3D9",
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600", textAlign: "center" },
  sectionRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#C8CCD8",
    marginTop: 12,
    marginBottom: 12,
  },
  secondaryBtn: {
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2434C2",
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  lastSecondaryBtn: {
    marginBottom: 0,
  },
  secondaryBtnText: { color: "#2434C2", fontSize: 15, fontWeight: "600", textAlign: "center" },
  version: {
    marginTop: "auto",
    paddingTop: 14,
    textAlign: "center",
    fontSize: 12,
    color: "#9AA0B0",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalCard: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 12,
    width: "90%",
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    color: "#111",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    lineHeight: 20,
  },
  passwordInputContainer: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingRight: 48,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#CFD3DE",
    color: "#111",
  },
  passwordVisibilityToggle: {
    position: "absolute",
    right: 12,
    height: "100%",
    justifyContent: "center",
  },
  passwordFallbackError: {
    color: "#b00020",
    fontSize: 13,
    marginTop: 10,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  modalBtnSecondary: {
    backgroundColor: "#F0F1F5",
  },
  modalBtnSecondaryText: {
    color: "#444",
    fontSize: 15,
    fontWeight: "600",
  },
  modalBtnPrimary: {
    backgroundColor: "#2434C2",
  },
  modalBtnPrimaryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
