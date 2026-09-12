import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Share, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MiniCard from "../components/MiniCard";
import GoogleBrandedSignInButton from "../components/GoogleBrandedSignInButton";
import AppleSignIn from "../AppleSignIn";
import { fetchPublicProfileCard } from "../utils/fetchPublicProfileCard";
import { goToNetworkForScanConnect } from "../utils/goToNetworkForScanConnect";
import versionData from "../version.json";

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const redirectStartedRef = useRef(false);

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

  const redirectToNetwork = useCallback(async () => {
    if (!profileUid || redirectStartedRef.current) return;
    const myUid = await AsyncStorage.getItem("profile_uid");
    if (!myUid) return;

    redirectStartedRef.current = true;
    setRedirecting(true);
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

  const goToSignUpWithEmail = useCallback(() => {
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError("");
    persistReferral();
    navigation.navigate("SignUp", { ...authParams, email: trimmed });
  }, [email, navigation, authParams, persistReferral]);

  const handleGoogleSignUp = useCallback(async () => {
    if (signingIn || !onGoogleSignUp) return;
    persistReferral();
    setSigningIn(true);
    try {
      await onGoogleSignUp(authParams);
    } finally {
      setSigningIn(false);
    }
  }, [signingIn, onGoogleSignUp, authParams, persistReferral]);

  const handleAppleSignUp = useCallback(
    async (...args) => {
      if (signingIn || !onAppleSignUp) return;
      persistReferral();
      setSigningIn(true);
      try {
        await onAppleSignUp(...args);
      } finally {
        setSigningIn(false);
      }
    },
    [signingIn, onAppleSignUp, persistReferral],
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

  const showGuestActions = !checkingSession && !isLoggedIn && !redirecting;
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
          background-color: #EF4444 !important; /* match ScrollView while debugging */
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
          background-color: #EF4444 !important;
        }
      `;
      document.head.appendChild(styleEl);
      html.classList.add("ec-scan-landing");

      const fill = () => {
        // Also set inline sizes from the largest available metric (camera handoff settles late).
        const vv = window.visualViewport;
        const vvBottom = vv ? Math.round(vv.height + (vv.offsetTop || 0)) : 0;
        const h = Math.max(
          1,
          Math.round(vv?.height || 0),
          Math.round(window.innerHeight || 0),
          Math.round(html.clientHeight || 0),
          vvBottom,
        );
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

  // Layout model (debug colors):
  // - Red  = outer frame padding only (top/side/bottom gutters around the card)
  // - Green = flex:1 panel that always fills the frame (scroll lives INSIDE the panel)
  // Bottom red was large before because the panel sat inside ScrollView and only
  // sized to its content — RN-web often ignores flexGrow there, so empty ScrollView showed red.
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.frame}>
        <View style={styles.panel}>
          <Text style={styles.debugLabelDark}>green = flex:1 panel · red outside = frame padding only</Text>
          <ScrollView
            style={styles.panelScroll}
            contentContainerStyle={styles.panelScrollContent}
            keyboardShouldPersistTaps='handled'
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.body}>
              <Text style={styles.headline}>Connect on everyCircle</Text>
              <Text style={styles.sub}>
                {showRedirecting
                  ? "Taking you to your network…"
                  : "You're one click from the most trusted network on the planet. Join with Google or Apple, or enter your email."}
              </Text>

              {(loading || showRedirecting) && (
                <View style={styles.centerRow}>
                  <ActivityIndicator size='large' color='#2434C2' />
                  <Text style={styles.muted}>{loading ? "Loading profile…" : "Opening connect…"}</Text>
                </View>
              )}

              {!loading && error && <Text style={styles.error}>{error}</Text>}

              {!loading && !error && profileData && showGuestActions && (
                <>
                  <View style={styles.cardWrap}>
                    <MiniCard user={profileData} />
                  </View>

                  <View style={styles.socialContainer}>
                    <GoogleBrandedSignInButton mode='signUp' onPress={handleGoogleSignUp} disabled={signingIn} signingIn={signingIn} />
                    <AppleSignIn mode='signUp' onSignIn={handleAppleSignUp} onError={onError} disabled={signingIn} />
                  </View>

                  <View style={styles.dividerContainer}>
                    <View style={styles.divider} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.divider} />
                  </View>

                  <TextInput
                    style={styles.emailInput}
                    placeholder='Email'
                    placeholderTextColor='#888'
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (emailError) setEmailError("");
                    }}
                    keyboardType='email-address'
                    autoCapitalize='none'
                    autoCorrect={false}
                    accessibilityLabel='Email'
                    accessibilityHint='Enter your email address to sign up'
                    returnKeyType='go'
                    onSubmitEditing={goToSignUpWithEmail}
                  />
                  {!!emailError && <Text style={styles.emailError}>{emailError}</Text>}

                  <TouchableOpacity
                    style={[styles.primaryBtn, !EMAIL_REGEX.test(email.trim()) && styles.primaryBtnDisabled]}
                    onPress={goToSignUpWithEmail}
                    activeOpacity={0.85}
                    disabled={!EMAIL_REGEX.test(email.trim())}
                  >
                    <Text style={styles.primaryBtnText}>Continue with email</Text>
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
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // DEBUG COLORS — temporary layout visualization
  safe: { flex: 1, backgroundColor: "#0066FF" }, // blue = SafeArea insets only
  // Red = ONLY the padding gutters around the green card (top / sides / bottom).
  frame: {
    flex: 1,
    backgroundColor: "#EF4444",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  // Green fills all remaining space inside the frame (flex:1).
  panel: {
    flex: 1,
    backgroundColor: "#22C55E",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 12,
    overflow: "hidden",
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
  panelScroll: {
    flex: 1,
  },
  panelScrollContent: {
    flexGrow: 1,
    paddingBottom: 14,
  },
  debugLabelDark: {
    fontSize: 11,
    fontWeight: "700",
    color: "#053B1A",
    textAlign: "center",
    marginBottom: 8,
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
    color: "#053B1A",
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
    color: "#053B1A",
  },
});
