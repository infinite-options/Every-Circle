import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CommonActions, useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../components/AppHeader";
import { getHeaderColors } from "../config/headerColors";
import { daysUntilPurge, formatPurgeDate, reactivateAccountApi, DEFAULT_DELETION_GRACE_DAYS } from "../utils/reactivateAccount";
import { ensureSessionProfileUid } from "../utils/ensureSessionProfileUid";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Confirm reactivation for an account in the soft-delete grace window.
 * Route params: email, password, purge_scheduled_at, grace_days, can_reactivate
 */
export default function ReactivateScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params || {};

  const email = String(params.email || "").trim();
  const password = params.password != null ? String(params.password) : "";
  const purgeScheduledAt = params.purge_scheduled_at || null;
  const graceDays = params.grace_days ?? DEFAULT_DELETION_GRACE_DAYS;
  const canReactivate = params.can_reactivate !== false;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const daysLeft = useMemo(() => daysUntilPurge(purgeScheduledAt, graceDays), [purgeScheduledAt, graceDays]);
  const purgeLabel = useMemo(() => formatPurgeDate(purgeScheduledAt), [purgeScheduledAt]);

  const goToLogin = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Login");
  };

  const enterApp = async () => {
    const userUid = String((await AsyncStorage.getItem("user_uid")) || "").trim();
    if (userUid) {
      await ensureSessionProfileUid(userUid);
    }
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Profile" }],
      }),
    );
  };

  const handleConfirm = async () => {
    setError("");
    if (!canReactivate) {
      setError("This account can no longer be reactivated.");
      return;
    }
    if (!email) {
      setError("Missing email. Please go back and sign in again.");
      return;
    }
    if (!password) {
      setError("Missing password. Please go back and sign in with your email and password to reactivate.");
      return;
    }

    setLoading(true);
    try {
      const result = await reactivateAccountApi({
        email,
        password,
        confirmReactivation: true,
      });
      if (!result.ok) {
        setError(result.message || "Could not reactivate account.");
        return;
      }
      setDone(true);
      await enterApp();
    } catch (e) {
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.pageContainer}>
      <AppHeader title='REACTIVATE' {...getHeaderColors("login")} onBackPress={goToLogin} />
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps='handled'>
          <View style={styles.iconCircle}>
            <Ionicons name='refresh-circle' size={48} color='#007AFF' />
          </View>
          <Text style={styles.title}>You are about to reactivate your account</Text>
          <Text style={styles.body}>
            Confirming will restore your profile and network visibility, and unfreeze your wallet so you can use everyCircle again.
          </Text>
          {email ? (
            <Text style={styles.meta}>
              Account: <Text style={styles.metaStrong}>{email}</Text>
            </Text>
          ) : null}
          <Text style={styles.meta}>
            {daysLeft === 1
              ? "1 day left before permanent deletion."
              : `${daysLeft} days left before permanent deletion.`}
          </Text>
          {purgeLabel ? <Text style={styles.meta}>Scheduled permanent removal: {purgeLabel}</Text> : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={goToLogin} disabled={loading || done} activeOpacity={0.8}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, (loading || done || !canReactivate) && styles.buttonDisabled]}
              onPress={handleConfirm}
              disabled={loading || done || !canReactivate}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color='#fff' size='small' /> : <Text style={styles.primaryButtonText}>Confirm reactivation</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: { flex: 1, backgroundColor: "#fff" },
  safeArea: { flex: 1, backgroundColor: "#fff" },
  contentContainer: {
    padding: 24,
    ...Platform.select({
      web: { maxWidth: 560, alignSelf: "center", width: "100%" },
      default: {},
    }),
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E3F2FD",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#007AFF",
    textAlign: "center",
    marginBottom: 14,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#444",
    textAlign: "center",
    marginBottom: 16,
  },
  meta: {
    fontSize: 14,
    lineHeight: 20,
    color: "#666",
    textAlign: "center",
    marginBottom: 6,
  },
  metaStrong: {
    fontWeight: "700",
    color: "#222",
  },
  errorText: {
    color: "#B71C1C",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
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
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF9500",
    minHeight: 48,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
