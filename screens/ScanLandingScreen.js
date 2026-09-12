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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.column}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
      >
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

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity style={styles.secondaryBtn} onPress={goToLogin} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>Log in</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.spacer} />

        {!loading && !error && profileData && showGuestActions && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={downloadVCard} activeOpacity={0.85}>
            <Text style={styles.secondaryBtnText}>No thanks — save contact in Phone</Text>
          </TouchableOpacity>
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
  flex: { flex: 1 },
  column: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  spacer: { flexGrow: 1, minHeight: 12 },
  headline: { fontSize: 22, fontWeight: "700", color: "#111", marginBottom: 6, textAlign: "center" },
  sub: { fontSize: 14, color: "#444", lineHeight: 19, marginBottom: 24, textAlign: "center" },
  centerRow: { alignItems: "center", paddingVertical: 16, gap: 10 },
  muted: { fontSize: 14, color: "#666" },
  error: { color: "#b00020", textAlign: "center", fontSize: 15, marginTop: 16 },
  cardWrap: { marginBottom: 12 },
  socialContainer: { alignItems: "center" },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  divider: { flex: 1, height: 1, backgroundColor: "#D0D4E4" },
  dividerText: { marginHorizontal: 10, color: "#666", fontSize: 12, fontWeight: "600" },
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
  emailError: { color: "#b00020", fontSize: 13, marginBottom: 8, textAlign: "center" },
  primaryBtn: {
    backgroundColor: "#2434C2",
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 0,
  },
  primaryBtnDisabled: { backgroundColor: "#9AA3D9" },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600", textAlign: "center" },
  secondaryBtn: {
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2434C2",
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  secondaryBtnText: { color: "#2434C2", fontSize: 15, fontWeight: "600", textAlign: "center" },
  versionText: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 12,
    color: "#889",
  },
});
