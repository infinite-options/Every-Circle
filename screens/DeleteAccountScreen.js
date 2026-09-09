import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import AppHeader from "../components/AppHeader";
import BottomNavBar from "../components/BottomNavBar";
import { getHeaderColors } from "../config/headerColors";
import { useDarkMode } from "../contexts/DarkModeContext";
import { deleteAccountApi, clearLocalSessionAfterAccountDeletion } from "../utils/deleteAccount";
import { formatPurgeDate, DEFAULT_DELETION_GRACE_DAYS } from "../utils/reactivateAccount";

const CONFIRM_PHRASE = "DELETE";

export default function DeleteAccountScreen() {
  const navigation = useNavigation();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [step, setStep] = useState("warning");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const handleFinalDelete = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await deleteAccountApi();
      if (!result.ok) {
        setError(result.message || "Could not delete account.");
        setLoading(false);
        return;
      }
      setConfirmation(result.data?.confirmation || null);
      await clearLocalSessionAfterAccountDeletion();
      toggleDarkMode(false);
      setStep("success");
    } catch (e) {
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const finishAndGoHome = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Home" }],
      }),
    );
  };

  const renderWarning = () => (
    <View style={styles.contentBlock}>
      <View style={[styles.iconCircle, darkMode && styles.darkIconCircle]}>
        <MaterialIcons name='warning-amber' size={36} color='#B71C1C' />
      </View>
      <Text style={[styles.title, darkMode && styles.darkTitle]}>Delete your account?</Text>
      <Text style={[styles.bodyText, darkMode && styles.darkBodyText]}>
        Your account will be scheduled for deletion. It will be permanently removed after 30 days.
      </Text>
      <Text style={[styles.bodyText, darkMode && styles.darkBodyText]}>
        During those 30 days, you can reactivate by logging in again. Your profile and network will stay hidden until you reactivate.
      </Text>
      <Text style={[styles.bodyText, darkMode && styles.darkBodyText]}>
        Transaction history and financial records are retained as required by law.
      </Text>
      <Text style={[styles.bodyText, darkMode && styles.darkBodyText]}>
        Any wallet balance will be frozen and cannot be withdrawn after deletion.
      </Text>
      <Text style={[styles.bodyText, styles.emphasis, darkMode && styles.darkEmphasis]}>
        After 30 days, deletion cannot be undone.
      </Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.secondaryButton, darkMode && styles.darkSecondaryButton]} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Text style={[styles.secondaryButtonText, darkMode && styles.darkSecondaryButtonText]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.destructiveButton} onPress={() => setStep("confirm")} activeOpacity={0.8}>
          <Text style={styles.destructiveButtonText}>Delete my account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderConfirm = () => (
    <View style={styles.contentBlock}>
      <Text style={[styles.title, darkMode && styles.darkTitle]}>Final confirmation</Text>
      <Text style={[styles.bodyText, darkMode && styles.darkBodyText]}>
        Type <Text style={styles.mono}>{CONFIRM_PHRASE}</Text> below to schedule deletion of your account.
      </Text>
      <TextInput
        value={confirmText}
        onChangeText={(t) => {
          setConfirmText(t);
          if (error) setError("");
        }}
        placeholder={CONFIRM_PHRASE}
        placeholderTextColor={darkMode ? "#888" : "#aaa"}
        autoCapitalize='characters'
        autoCorrect={false}
        style={[styles.confirmInput, darkMode && styles.darkConfirmInput]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, darkMode && styles.darkSecondaryButton]}
          onPress={() => {
            setConfirmText("");
            setError("");
            setStep("warning");
          }}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={[styles.secondaryButtonText, darkMode && styles.darkSecondaryButtonText]}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.destructiveButton, (loading || confirmText.trim() !== CONFIRM_PHRASE) && styles.buttonDisabled]}
          onPress={handleFinalDelete}
          disabled={loading || confirmText.trim() !== CONFIRM_PHRASE}
          activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator color='#fff' size='small' /> : <Text style={styles.destructiveButtonText}>Confirm delete</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSuccess = () => {
    const graceDays = confirmation?.grace_days ?? DEFAULT_DELETION_GRACE_DAYS;
    const purgeAt = confirmation?.purge_scheduled_at;
    const purgeLabel = formatPurgeDate(purgeAt) || purgeAt;
    const reactivationAvailable = confirmation?.reactivation_available !== false;

    return (
      <View style={styles.contentBlock}>
        <View style={[styles.iconCircle, styles.successIconCircle]}>
          <Ionicons name='time-outline' size={40} color='#2E7D32' />
        </View>
        <Text style={[styles.title, darkMode && styles.darkTitle]}>Deletion scheduled</Text>
        <Text style={[styles.bodyText, darkMode && styles.darkBodyText]}>
          Your account will be permanently removed in {graceDays} days.
          {reactivationAvailable
            ? " You can reactivate anytime before then by logging in with this account."
            : ""}
        </Text>
        {purgeLabel ? (
          <Text style={[styles.metaText, darkMode && styles.darkMetaText]}>Permanent removal scheduled for: {purgeLabel}</Text>
        ) : null}
        {confirmation?.profile_personal_uid ? (
          <Text style={[styles.metaText, darkMode && styles.darkMetaText]}>Profile ID: {confirmation.profile_personal_uid}</Text>
        ) : null}
        {confirmation?.wallet_frozen ? (
          <Text style={[styles.metaText, darkMode && styles.darkMetaText]}>Wallet balance frozen per policy.</Text>
        ) : null}
        {confirmation?.financial_records_retained ? (
          <Text style={[styles.metaText, darkMode && styles.darkMetaText]}>Financial records retained as required by law.</Text>
        ) : null}

        <TouchableOpacity style={styles.primaryButton} onPress={finishAndGoHome} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>Return to welcome</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.darkContainer]}>
      <AppHeader title='DELETE ACCOUNT' {...getHeaderColors("settings")} onBackPress={step === "success" ? finishAndGoHome : () => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
        {step === "warning" && renderWarning()}
        {step === "confirm" && renderConfirm()}
        {step === "success" && renderSuccess()}
      </ScrollView>
      {step !== "success" ? <BottomNavBar navigation={navigation} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  darkContainer: {
    backgroundColor: "#121212",
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 32,
  },
  contentBlock: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    ...Platform.select({
      web: { maxWidth: 560, alignSelf: "center", width: "100%" },
      default: {},
    }),
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFEBEE",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  darkIconCircle: {
    backgroundColor: "#3a2020",
  },
  successIconCircle: {
    backgroundColor: "#E8F5E9",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
    marginBottom: 16,
  },
  darkTitle: {
    color: "#f0f0f0",
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#444",
    marginBottom: 10,
  },
  darkBodyText: {
    color: "#ccc",
  },
  emphasis: {
    fontWeight: "700",
    color: "#B71C1C",
    marginTop: 4,
    marginBottom: 20,
  },
  darkEmphasis: {
    color: "#ef9a9a",
  },
  mono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: "700",
  },
  confirmInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: "#fafafa",
    color: "#222",
  },
  darkConfirmInput: {
    borderColor: "#555",
    backgroundColor: "#1e1e1e",
    color: "#eee",
  },
  errorText: {
    color: "#B71C1C",
    fontSize: 14,
    marginBottom: 12,
  },
  metaText: {
    fontSize: 13,
    color: "#666",
    marginBottom: 6,
    lineHeight: 18,
  },
  darkMetaText: {
    color: "#aaa",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  darkSecondaryButton: {
    backgroundColor: "#2a2a2a",
    borderColor: "#555",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  darkSecondaryButtonText: {
    color: "#ddd",
  },
  destructiveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#B71C1C",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  destructiveButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  primaryButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#007BFF",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
