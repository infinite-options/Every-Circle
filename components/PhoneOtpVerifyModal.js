import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
} from "react-native";
import {
  digitsForPhoneApi,
  formatOtpCountdown,
  formatUsPhoneDisplay,
  isValidUsPhoneInput,
  sendPhoneOtp,
  verifyPhoneOtp,
} from "../utils/phoneVerification";

/**
 * Modal OTP flow for settings/profile phone verify-change.
 * Bearer token is attached by httpMiddleware.
 */
export default function PhoneOtpVerifyModal({
  visible,
  phoneNumber,
  darkMode = false,
  title = "Verify your new number",
  autoSend = true,
  onClose,
  onVerified,
}) {
  const [otpInput, setOtpInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [expiresIn, setExpiresIn] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const countdownRef = useRef(null);
  const autoSentForRef = useRef("");

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

  const resetLocalState = useCallback(() => {
    clearCountdown();
    setOtpInput("");
    setOtpSent(false);
    setExpiresIn(0);
    setSending(false);
    setVerifying(false);
    setError("");
    setInfo("");
    autoSentForRef.current = "";
  }, [clearCountdown]);

  useEffect(() => () => clearCountdown(), [clearCountdown]);

  useEffect(() => {
    if (!visible) {
      resetLocalState();
    }
  }, [visible, resetLocalState]);

  const handleSendCode = useCallback(async () => {
    setError("");
    setInfo("");
    if (!isValidUsPhoneInput(phoneNumber)) {
      setError("Enter a valid 10-digit US phone number.");
      return;
    }
    setSending(true);
    try {
      const result = await sendPhoneOtp(phoneNumber);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOtpSent(true);
      setOtpInput("");
      startCountdown(result.expires_in);
      setInfo(`Code sent to ${formatUsPhoneDisplay(result.phone_number)}.`);
      autoSentForRef.current = digitsForPhoneApi(phoneNumber);
    } finally {
      setSending(false);
    }
  }, [phoneNumber, startCountdown]);

  useEffect(() => {
    if (!visible || !autoSend) return;
    const key = digitsForPhoneApi(phoneNumber);
    if (key.length !== 10) return;
    if (autoSentForRef.current === key) return;
    handleSendCode();
  }, [visible, autoSend, phoneNumber, handleSendCode]);

  const handleVerify = async () => {
    setError("");
    setInfo("");
    if (!isValidUsPhoneInput(phoneNumber)) {
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
      const result = await verifyPhoneOtp(phoneNumber, code);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      clearCountdown();
      if (typeof onVerified === "function") {
        await onVerified(result);
      }
    } finally {
      setVerifying(false);
    }
  };

  const displayPhone = formatUsPhoneDisplay(phoneNumber) || String(phoneNumber || "").trim();

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={() => !sending && !verifying && onClose?.()}>
      <View style={[styles.overlay, darkMode && styles.darkOverlay]}>
        <View style={[styles.card, darkMode && styles.darkCard]}>
          <Text style={[styles.title, darkMode && styles.darkTitle]}>{title}</Text>
          <Text style={[styles.subtitle, darkMode && styles.darkMuted]}>
            We texted a 6-digit code to {displayPhone || "your phone"}. Enter it below to verify.
          </Text>

          <Text style={[styles.fieldLabel, darkMode && styles.darkMuted]}>Verification code</Text>
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
            }}
            editable={!verifying}
            autoFocus
          />

          <Text style={[styles.countdown, expiresIn <= 0 && otpSent && styles.countdownExpired, darkMode && styles.darkMuted]}>
            {!otpSent && sending
              ? "Sending code…"
              : expiresIn > 0
                ? `Code expires in ${formatOtpCountdown(expiresIn)}`
                : otpSent
                  ? "Code expired — send a new one"
                  : " "}
          </Text>

          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {!!info && !error && <Text style={styles.infoText}>{info}</Text>}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, darkMode && styles.darkSecondaryButton]}
              disabled={sending || verifying}
              onPress={() => onClose?.()}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryButtonText, darkMode && styles.darkSecondaryButtonText]}>Later</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.resendButton, (sending || verifying) && styles.buttonDisabled]}
              disabled={sending || verifying}
              onPress={handleSendCode}
              activeOpacity={0.8}
            >
              {sending ? <ActivityIndicator color='#18884A' /> : <Text style={styles.resendButtonText}>{otpSent ? "Resend" : "Send code"}</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, (otpInput.length !== 6 || verifying || (otpSent && expiresIn <= 0)) && styles.buttonDisabled]}
              disabled={otpInput.length !== 6 || verifying || sending || (otpSent && expiresIn <= 0)}
              onPress={handleVerify}
              activeOpacity={0.8}
            >
              {verifying ? <ActivityIndicator color='#fff' /> : <Text style={styles.primaryButtonText}>Verify</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  darkOverlay: { backgroundColor: "rgba(0,0,0,0.7)" },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    ...(Platform.OS !== "web" ? { elevation: 4 } : { boxShadow: "0px 4px 16px rgba(0,0,0,0.2)" }),
  },
  darkCard: { backgroundColor: "#1e1e1e" },
  title: { fontSize: 18, fontWeight: "700", color: "#111", marginBottom: 8 },
  darkTitle: { color: "#fff" },
  subtitle: { fontSize: 14, color: "#555", lineHeight: 20, marginBottom: 16 },
  darkMuted: { color: "#aaa" },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#444", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 18,
    letterSpacing: 4,
    backgroundColor: "#fafafa",
    color: "#222",
    marginBottom: 8,
  },
  darkInput: { borderColor: "#444", backgroundColor: "#2a2a2a", color: "#fff" },
  countdown: { fontSize: 13, color: "#555", marginBottom: 8, minHeight: 18 },
  countdownExpired: { color: "#B71C1C" },
  errorText: { color: "#B71C1C", fontSize: 13, marginBottom: 8, lineHeight: 18 },
  infoText: { color: "#18884A", fontSize: 13, marginBottom: 8, lineHeight: 18 },
  buttonRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  secondaryButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#eee",
  },
  darkSecondaryButton: { backgroundColor: "#333" },
  secondaryButtonText: { color: "#333", fontWeight: "600", fontSize: 14 },
  darkSecondaryButtonText: { color: "#eee" },
  resendButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#18884A",
  },
  resendButtonText: { color: "#18884A", fontWeight: "700", fontSize: 14 },
  primaryButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#18884A",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  buttonDisabled: { opacity: 0.45 },
});
