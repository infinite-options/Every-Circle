import React from "react";
import { SafeAreaView, ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import { useDarkMode } from "../contexts/DarkModeContext";

const DELETE_ACCOUNT_INFO_TEXT = `Last updated: September 3, 2026

1. Overview

EveryCircle allows you to delete your account from within the application.

This page explains how to delete your EveryCircle account, what happens after you request deletion, and how you may reinstate your account during the 30-day retention period.

You may also contact EveryCircle Support at support@everycircle.com if you need help with account deletion.

2. How to Delete Your Account

To delete your EveryCircle account, complete the following steps:

1. Log in to your EveryCircle account.
2. Go to the Settings page.
3. Click Delete Account.
4. Review the on-screen warnings.
5. Type DELETE to confirm that you want to delete your account.

You must be logged in to delete your account. The Delete Account option is available in Settings on the EveryCircle website and in the EveryCircle mobile applications.

3. What Happens After Deletion

After you confirm deletion, your account is removed from public view and is no longer available for ordinary use.

EveryCircle holds account information for 30 days after deletion.

During this 30-day period, you may reinstate your account by logging in to EveryCircle again with the same credentials you used before deletion.

If you log in during the 30-day retention period, your account may be restored and you may continue using EveryCircle.

4. After the 30-Day Period

If you do not log in and reinstate your account within 30 days, deletion becomes permanent.

After the 30-day period, you will not be able to restore the deleted account by logging in.

Certain information may still be retained when required or permitted by law, including transaction history, financial records, tax and accounting records, fraud-prevention information, and other information EveryCircle is legally required or permitted to keep.

Wallet balances, if any, are frozen upon deletion and cannot be withdrawn after the account is deleted.

5. Contact

Questions about account deletion or reinstatement may be directed to:

EveryCircle Support
support@everycircle.com`;

const NUMBERED_HEADING_PATTERN = /^\d+(?:\.\d+)?\. .+$/;
const SUBHEADING_PATTERN = /^[A-Z][A-Za-z0-9 &'/-]+$/;

function renderPolicyBlocks(text, darkMode) {
  return text.split("\n\n").map((block, index) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    const isNumberedHeading = NUMBERED_HEADING_PATTERN.test(trimmed) && !trimmed.includes("\n");
    const isSubheading = !isNumberedHeading && SUBHEADING_PATTERN.test(trimmed) && !trimmed.includes("\n");

    if (isNumberedHeading || isSubheading) {
      return (
        <Text key={`heading-${index}`} style={[styles.sectionHeading, darkMode && styles.darkSectionHeading]}>
          {trimmed}
        </Text>
      );
    }

    return (
      <Text key={`block-${index}`} style={[styles.body, darkMode && styles.darkBody]}>
        {trimmed}
      </Text>
    );
  });
}

export default function DeleteAccountInfoScreen() {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.darkContainer]}>
      <AppHeader title='DELETE ACCOUNT' backgroundColor='#AF52DE' onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, darkMode && styles.darkTitle]}>How to Delete Your Account</Text>
        {renderPolicyBlocks(DELETE_ACCOUNT_INFO_TEXT, darkMode)}

        <TouchableOpacity style={[styles.closeButton, darkMode && styles.darkCloseButton]} onPress={() => navigation.goBack()}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>

        <View style={styles.bottomBuffer} />
      </ScrollView>

      <BottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  darkContainer: { backgroundColor: "#1a1a1a" },
  content: { padding: 20, paddingBottom: 40 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#000",
  },
  darkTitle: {
    color: "#ffffff",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: "#333",
    marginBottom: 16,
  },
  darkBody: {
    color: "#cccccc",
  },
  sectionHeading: {
    fontSize: 19,
    fontWeight: "700",
    lineHeight: 28,
    color: "#111",
    marginTop: 4,
    marginBottom: 8,
  },
  darkSectionHeading: {
    color: "#ffffff",
  },
  closeButton: {
    marginTop: 30,
    alignSelf: "center",
    backgroundColor: "#AF52DE",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 6,
  },
  darkCloseButton: {
    backgroundColor: "#AF52DE",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  bottomBuffer: {
    height: 100,
    marginBottom: 20,
  },
});
