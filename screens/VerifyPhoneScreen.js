import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import AppHeader from "../components/AppHeader";
import BottomNavBar from "../components/BottomNavBar";
import { getHeaderColors } from "../config/headerColors";
import { useDarkMode } from "../contexts/DarkModeContext";
import { refreshSessionProfileFromNetwork } from "../utils/sessionProfile";
import PhoneVerifiedBadge from "../components/PhoneVerifiedBadge";
import {
  digitsForPhoneApi,
  fetchAuthMe,
  formatOtpCountdown,
  formatPhoneNumberInput,
  formatUsPhoneDisplay,
  getCachedPhoneIdentity,
  isValidUsPhoneInput,
  sendPhoneOtp,
  verifyPhoneOtp,
} from "../utils/phoneVerification";

export default function VerifyPhoneScreen() {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();

  const [mePhone, setMePhone] = useState(null);
  const [meVerified, setMeVerified] = useState(false);
  const [loadingMe, setLoadingMe] = useState(true);

  const [phoneInput, setPhoneInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [expiresIn, setExpiresIn] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const countdownRef = useRef(null);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(
    (seconds) => {
      clearCountdown();
      const total = Math.max(0, Math.floor(Number(seconds) || 0));
      setExpiresIn(total);
      if (total <= 0) return;
      countdownRef.current = setInterval(() => {
        setExpiresIn((prev) => {
          if (prev <= 1) {
            clearCountdown();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [clearCountdown],
  );

  useEffect(() => () => clearCountdown(), [clearCountdown]);

  const loadMe = useCallback(async () => {
    setLoadingMe(true);
    setError("");
    try {
      const cached = await getCachedPhoneIdentity();
      if (cached.phone_number) {
        setMePhone(cached.phone_number);
        setMeVerified(Boolean(cached.phone_verified));
        setPhoneInput((prev) => (prev && digitsForPhoneApi(prev).length === 10 ? prev : formatUsPhoneDisplay(cached.phone_number)));
      }
      const me = await fetchAuthMe();
      setMePhone(me.phone_number);
      setMeVerified(Boolean(me.phone_verified));
      setPhoneInput((prev) => {
        if (prev && digitsForPhoneApi(prev).length === 10) return prev;
        return me.phone_number ? formatUsPhoneDisplay(me.phone_number) : "";
      });
    } catch (e) {
      setError(e?.message || "Could not load phone status.");
    } finally {
      setLoadingMe(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMe();
    }, [loadMe]),
  );

  const draftDiffersFromMe =
    isValidUsPhoneInput(phoneInput) &&
    mePhone &&
    digitsForPhoneApi(phoneInput) !== digitsForPhoneApi(mePhone);

  const handleSendCode = async () => {
    setError("");
    setSuccess("");
    if (!isValidUsPhoneInput(phoneInput)) {
      setError("Enter a valid 10-digit US phone number.");
      return;
    }
    setSending(true);
    try {
      const result = await sendPhoneOtp(phoneInput);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOtpSent(true);
      setOtpInput("");
      startCountdown(result.expires_in);
      setSuccess(`Code sent to ${formatUsPhoneDisplay(result.phone_number)}.`);
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setSuccess("");
    if (!isValidUsPhoneInput(phoneInput)) {
      setError("Enter a valid 10-digit US phone number.");
      return;
    }
    const code = String(otpInput || "").replace(/\D/g, "");
    if (code.length !== 6) {
      setError("Enter the 6-digit verification code.");
      return;
    }
    setVerifying(true);
    try {
      const result = await verifyPhoneOtp(phoneInput, code);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMePhone(result.phone_number);
      setMeVerified(Boolean(result.phone_verified));
      setPhoneInput(formatUsPhoneDisplay(result.phone_number));
      setOtpSent(false);
      setOtpInput("");
      clearCountdown();
      setExpiresIn(0);
      setSuccess("Phone number verified.");
      try {
        await refreshSessionProfileFromNetwork();
      } catch (_) {}
      try {
        await fetchAuthMe();
      } catch (_) {}
    } finally {
      setVerifying(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.darkContainer]}>
      <AppHeader title='Verify Phone' {...getHeaderColors("verifyPhone")} onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
        <View style={[styles.formContainer, darkMode && styles.darkFormContainer]}>
          <Text style={[styles.subtitle, darkMode && styles.darkSubtitle]}>
            Verify or change the phone number on your account. We will text a 6-digit code — it never appears in the app.
          </Text>

          <View style={[styles.statusCard, darkMode && styles.darkStatusCard]}>
            {loadingMe ? (
              <ActivityIndicator color='#18884A' />
            ) : (
              <>
                <Text style={[styles.statusLabel, darkMode && styles.darkMuted]}>Account phone</Text>
                <Text style={[styles.statusPhone, darkMode && styles.darkText]}>
                  {mePhone ? formatUsPhoneDisplay(mePhone) : "No phone on file"}
                </Text>
                {meVerified ? (
                  <PhoneVerifiedBadge showLabel size={16} style={{ marginTop: 4 }} />
                ) : (
                  <View style={[styles.badge, styles.badgeUnverified]}>
                    <MaterialIcons name='error-outline' size={16} color='#E65100' />
                    <Text style={[styles.badgeText, styles.badgeTextUnverified]}>Not verified</Text>
                  </View>
                )}
                {draftDiffersFromMe ? (
                  <Text style={[styles.hint, darkMode && styles.darkMuted]}>
                    You changed the number below. Status stays “{meVerified ? "Verified" : "Not verified"}” until this new number is verified.
                  </Text>
                ) : null}
              </>
            )}
          </View>

          <Text style={[styles.fieldLabel, darkMode && styles.darkMuted]}>Phone number</Text>
          <View style={[styles.inputContainer, darkMode && styles.darkInputContainer]}>
            <MaterialIcons name='phone' size={20} color={darkMode ? "#aaa" : "#666"} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, darkMode && styles.darkInput]}
              placeholder='(555) 123-4567'
              placeholderTextColor={darkMode ? "#888" : "#999"}
              keyboardType='phone-pad'
              value={phoneInput}
              onChangeText={(text) => {
                setPhoneInput(formatPhoneNumberInput(text));
                setError("");
                setSuccess("");
                // Changing phone requires a fresh send + verify.
                if (otpSent) {
                  setOtpSent(false);
                  setOtpInput("");
                  clearCountdown();
                  setExpiresIn(0);
                }
              }}
              editable={!sending && !verifying}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, (!isValidUsPhoneInput(phoneInput) || sending) && styles.buttonDisabled]}
            onPress={handleSendCode}
            disabled={!isValidUsPhoneInput(phoneInput) || sending || verifying}
            activeOpacity={0.8}
          >
            {sending ? <ActivityIndicator color='#fff' /> : <Text style={styles.primaryButtonText}>{otpSent ? "Resend code" : "Send code"}</Text>}
          </TouchableOpacity>

          {otpSent ? (
            <>
              <Text style={[styles.fieldLabel, darkMode && styles.darkMuted]}>Verification code</Text>
              <View style={[styles.inputContainer, darkMode && styles.darkInputContainer]}>
                <MaterialIcons name='sms' size={20} color={darkMode ? "#aaa" : "#666"} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, darkMode && styles.darkInput]}
                  placeholder='6-digit code'
                  placeholderTextColor={darkMode ? "#888" : "#999"}
                  keyboardType='number-pad'
                  maxLength={6}
                  value={otpInput}
                  onChangeText={(text) => {
                    setOtpInput(String(text || "").replace(/\D/g, "").slice(0, 6));
                    setError("");
                    setSuccess("");
                  }}
                  editable={!verifying}
                />
              </View>
              <Text style={[styles.countdown, expiresIn <= 0 && styles.countdownExpired, darkMode && styles.darkMuted]}>
                {expiresIn > 0 ? `Code expires in ${formatOtpCountdown(expiresIn)}` : "Code expired — send a new one"}
              </Text>

              <TouchableOpacity
                style={[styles.primaryButton, styles.verifyButton, (otpInput.length !== 6 || verifying || expiresIn <= 0) && styles.buttonDisabled]}
                onPress={handleVerify}
                disabled={otpInput.length !== 6 || verifying || sending || expiresIn <= 0}
                activeOpacity={0.8}
              >
                {verifying ? <ActivityIndicator color='#fff' /> : <Text style={styles.primaryButtonText}>Verify</Text>}
              </TouchableOpacity>
            </>
          ) : null}

          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {!!success && <Text style={styles.successText}>{success}</Text>}
        </View>
      </ScrollView>

      <BottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f8f8" },
  darkContainer: { backgroundColor: "#121212" },
  scrollContent: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  formContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    ...(Platform.OS !== "web" ? { elevation: 3 } : { boxShadow: "0px 2px 3px 0px rgba(0, 0, 0, 0.1)" }),
  },
  darkFormContainer: { backgroundColor: "#1e1e1e" },
  subtitle: { fontSize: 14, color: "#555", marginBottom: 16, lineHeight: 20 },
  darkSubtitle: { color: "#bbb" },
  statusCard: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 14,
    marginBottom: 18,
  },
  darkStatusCard: { backgroundColor: "#2a2a2a" },
  statusLabel: { fontSize: 12, color: "#666", marginBottom: 4 },
  statusPhone: { fontSize: 18, fontWeight: "600", color: "#111", marginBottom: 8 },
  darkText: { color: "#fff" },
  darkMuted: { color: "#aaa" },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeVerified: { backgroundColor: "#E8F5E9" },
  badgeUnverified: { backgroundColor: "#FFF3E0" },
  badgeText: { fontSize: 13, fontWeight: "600" },
  badgeTextVerified: { color: "#1B5E20" },
  badgeTextUnverified: { color: "#E65100" },
  hint: { marginTop: 10, fontSize: 12, color: "#666", lineHeight: 17 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#444", marginBottom: 6 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  darkInputContainer: { borderColor: "#444", backgroundColor: "#2a2a2a" },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12, color: "#222" },
  darkInput: { color: "#fff" },
  primaryButton: {
    backgroundColor: "#18884A",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  verifyButton: { marginTop: 4 },
  buttonDisabled: { opacity: 0.45 },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  countdown: { fontSize: 13, color: "#555", marginBottom: 12 },
  countdownExpired: { color: "#B71C1C" },
  errorText: { color: "#B71C1C", fontSize: 14, marginTop: 4, lineHeight: 20 },
  successText: { color: "#18884A", fontSize: 14, marginTop: 4, lineHeight: 20 },
});
