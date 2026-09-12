import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Share, TextInput, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MiniCard from "../components/MiniCard";
import GoogleBrandedSignInButton from "../components/GoogleBrandedSignInButton";
import AppleSignIn from "../AppleSignIn";
import { fetchPublicProfileCard } from "../utils/fetchPublicProfileCard";
import { goToNetworkForScanConnect } from "../utils/goToNetworkForScanConnect";
import versionData from "../version.json";

/** Walk up from a DOM node and zero every scrollable ancestor (RN Web ScrollView included). */
function resetDomScrollChain(startNode) {
  if (!startNode || typeof startNode !== "object") return;
  let node = startNode;
  while (node) {
    try {
      if (typeof node.scrollTop === "number" && node.scrollTop !== 0) node.scrollTop = 0;
      if (typeof node.scrollLeft === "number" && node.scrollLeft !== 0) node.scrollLeft = 0;
    } catch (_) {
      /* ignore */
    }
    node = node.parentElement;
  }
  if (typeof window !== "undefined") {
    window.scrollTo?.(0, 0);
    document.documentElement && (document.documentElement.scrollTop = 0);
    document.body && (document.body.scrollTop = 0);
    document.scrollingElement && (document.scrollingElement.scrollTop = 0);
  }
}

function resolveWebNode(ref) {
  const cur = ref?.current ?? ref;
  if (!cur) {
    return typeof document !== "undefined" ? document.getElementById("scan-landing-top") : null;
  }
  if (cur.nodeType === 1) return cur;
  if (cur._nativeNode?.nodeType === 1) return cur._nativeNode;
  if (typeof document !== "undefined") {
    return document.getElementById("scan-landing-top");
  }
  return null;
}

function isMobileWeb() {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "") || (typeof window !== "undefined" && window.innerWidth < 700);
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ScanLandingScreen({ onGoogleSignUp, onAppleSignUp, onError }) {
  const route = useRoute();
  const navigation = useNavigation();
  const profileUid = resolveProfileUidFromRoute(route);
  const { height: windowHeight } = useWindowDimensions();

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
  const compact = windowHeight < 780;
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const topAnchorRef = useRef(null);
  // Camera → Chrome paints under the URL bar and often reports safe-area 0.
  // Keep this modest — oversized padding is what forced scrolling after the top fix.
  const [webTopPad, setWebTopPad] = useState(() => (isMobileWeb() ? 40 : Platform.OS === "web" ? 12 : 0));

  const ensureTopVisible = useCallback(() => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });

    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const node = resolveWebNode(topAnchorRef);
    resetDomScrollChain(node);

    if (node && typeof node.getBoundingClientRect === "function") {
      const rect = node.getBoundingClientRect();
      // If the headline is still above the visible viewport (scrolled/clipped), push it down.
      if (rect.top < 8) {
        const needed = Math.ceil(8 - rect.top);
        setWebTopPad((prev) => Math.min(96, prev + needed));
      }
    }
  }, []);

  useEffect(() => {
    ensureTopVisible();
    if (Platform.OS !== "web" || typeof window === "undefined") return undefined;

    const onViewportChange = () => ensureTopVisible();
    window.visualViewport?.addEventListener?.("resize", onViewportChange);
    window.visualViewport?.addEventListener?.("scroll", onViewportChange);
    window.addEventListener("pageshow", onViewportChange);
    window.addEventListener("orientationchange", onViewportChange);

    // Camera handoff settles across a few frames — keep correcting briefly.
    const timers = [50, 150, 300, 600, 1000, 2000].map((ms) => setTimeout(ensureTopVisible, ms));

    return () => {
      window.visualViewport?.removeEventListener?.("resize", onViewportChange);
      window.visualViewport?.removeEventListener?.("scroll", onViewportChange);
      window.removeEventListener("pageshow", onViewportChange);
      window.removeEventListener("orientationchange", onViewportChange);
      timers.forEach(clearTimeout);
    };
  }, [ensureTopVisible, loading, showGuestActions, profileData]);

  useFocusEffect(
    useCallback(() => {
      ensureTopVisible();
    }, [ensureTopVisible]),
  );

  const scrollPadTop = Platform.OS === "web" ? Math.max(insets.top, 0) + webTopPad : 12;

  return (
    // Skip bottom safe-area on web — mobile browser chrome already insets the visual
    // viewport; a second bottom inset leaves a blank strip under the app.
    <SafeAreaView style={styles.safe} edges={Platform.OS === "web" ? ["left", "right"] : ["top", "left", "right", "bottom"]}>
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scroll, { paddingTop: scrollPadTop }]}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode='never'
      >
        <View ref={topAnchorRef} nativeID='scan-landing-top' collapsable={false}>
          <Text style={[styles.headline, compact && styles.headlineCompact]}>Connect on everyCircle</Text>
          <Text style={[styles.sub, compact && styles.subCompact]}>
            {showRedirecting ? "Taking you to your network…" : "You're one click from the most trusted network on the planet. Join with Google or Apple, or enter your email."}
          </Text>
        </View>

        {(loading || showRedirecting) && (
          <View style={styles.centerRow}>
            <ActivityIndicator size='large' color='#2434C2' />
            <Text style={styles.muted}>{loading ? "Loading profile…" : "Opening connect…"}</Text>
          </View>
        )}

        {!loading && error && <Text style={styles.error}>{error}</Text>}

        {!loading && !error && profileData && showGuestActions && (
          <>
            <View style={[styles.cardWrap, compact && styles.cardWrapCompact]}>
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

            <TouchableOpacity style={[styles.secondaryBtn, styles.loginBtn]} onPress={goToLogin} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>Log in</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={downloadVCard} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>No thanks — save contact in Phone</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.versionText}>
          PM {versionData.pm_version} · v{versionData.major}.{versionData.build} · {versionData.last_change}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f7fb" },
  scrollView: { flex: 1 },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  headline: { fontSize: 22, fontWeight: "700", color: "#111", marginBottom: 6, textAlign: "center" },
  headlineCompact: { fontSize: 20, marginBottom: 4 },
  sub: { fontSize: 14, color: "#444", lineHeight: 19, marginBottom: 10, textAlign: "center" },
  subCompact: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  centerRow: { alignItems: "center", paddingVertical: 16, gap: 10 },
  muted: { fontSize: 14, color: "#666" },
  error: { color: "#b00020", textAlign: "center", fontSize: 15, marginTop: 16 },
  cardWrap: { marginBottom: 10 },
  cardWrapCompact: { marginBottom: 8 },
  socialContainer: {
    alignItems: "center",
    marginBottom: 0,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#D0D4E4",
  },
  dividerText: {
    marginHorizontal: 10,
    color: "#666",
    fontSize: 12,
    fontWeight: "600",
  },
  emailInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ccc",
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
    marginBottom: 8,
  },
  primaryBtnDisabled: {
    backgroundColor: "#9AA3D9",
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600", textAlign: "center" },
  secondaryBtn: {
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2434C2",
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  loginBtn: {
    marginTop: 2,
  },
  secondaryBtnText: { color: "#2434C2", fontSize: 15, fontWeight: "600", textAlign: "center" },
  versionText: {
    marginTop: 12,
    marginBottom: 4,
    textAlign: "center",
    fontSize: 12,
    color: "#889",
  },
});
