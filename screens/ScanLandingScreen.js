import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Share, SafeAreaView } from "react-native";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MiniCard from "../components/MiniCard";
import { fetchPublicProfileCard } from "../utils/fetchPublicProfileCard";
import { goToNetworkForScanConnect } from "../utils/goToNetworkForScanConnect";

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
    lines.push(`NOTE:EveryCircle profile: ${data.profile_uid}`);
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

export default function ScanLandingScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const profileUid = resolveProfileUidFromRoute(route);

  const [loading, setLoading] = useState(!!profileUid);
  const [error, setError] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
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

  const goToSignUp = useCallback(() => {
    navigation.navigate("SignUp", authParams);
  }, [navigation, authParams]);

  const goToLogin = useCallback(() => {
    navigation.navigate("Login", authParams);
  }, [navigation, authParams]);

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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>EveryCircle</Text>
        <Text style={styles.headline}>Connect on EveryCircle</Text>
        <Text style={styles.sub}>
          {showRedirecting
            ? "Taking you to your network…"
            : "Someone shared their profile with you. Log in or sign up to connect, or save their public contact card."}
        </Text>

        {(loading || showRedirecting) && (
          <View style={styles.centerRow}>
            <ActivityIndicator size="large" color="#2434C2" />
            <Text style={styles.muted}>{loading ? "Loading profile…" : "Opening connect…"}</Text>
          </View>
        )}

        {!loading && error && <Text style={styles.error}>{error}</Text>}

        {!loading && !error && profileData && showGuestActions && (
          <>
            <View style={styles.cardWrap}>
              <MiniCard user={profileData} />
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={goToSignUp} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Sign up for EveryCircle</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.secondaryBtn, styles.loginBtn]} onPress={goToLogin} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>Log in</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={downloadVCard} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>No thanks — save contact (.vcf)</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f7fb" },
  scroll: { padding: 24, paddingBottom: 48, maxWidth: 480, width: "100%", alignSelf: "center" },
  brand: { fontSize: 14, fontWeight: "600", color: "#2434C2", marginBottom: 8, textAlign: "center" },
  headline: { fontSize: 22, fontWeight: "700", color: "#111", marginBottom: 10, textAlign: "center" },
  sub: { fontSize: 15, color: "#444", lineHeight: 22, marginBottom: 24, textAlign: "center" },
  centerRow: { alignItems: "center", paddingVertical: 32, gap: 12 },
  muted: { fontSize: 14, color: "#666" },
  error: { color: "#b00020", textAlign: "center", fontSize: 15, marginTop: 16 },
  cardWrap: { marginBottom: 24 },
  primaryBtn: {
    backgroundColor: "#2434C2",
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600", textAlign: "center" },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2434C2",
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  loginBtn: {
    marginBottom: 12,
  },
  secondaryBtnText: { color: "#2434C2", fontSize: 15, fontWeight: "600", textAlign: "center" },
});
