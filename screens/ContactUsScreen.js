import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Linking, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { getHeaderColors } from "../config/headerColors";
import AppHeader from "../components/AppHeader";
import BottomNavBar from "../components/BottomNavBar";
import { useDarkMode } from "../contexts/DarkModeContext";

const CONTACT_EMAIL = "cplata@everycircle.com";
const CONTACT_PHONE = "408-239-9006";
const CONTACT_PHONE_TEL = "4082399006";

const isMobile = Platform.OS !== "web";
const BORDER = "#2a2a2a";
const MAROON = "#6f130f";

export default function ContactUsScreen() {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();

  const openEmail = () => Linking.openURL(`mailto:${CONTACT_EMAIL}`);
  const openPhone = () => Linking.openURL(`tel:${CONTACT_PHONE_TEL}`);

  return (
    <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
      <AppHeader title='CONTACT US' {...getHeaderColors("profileView")} onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.page}>
        <View style={[styles.card, darkMode && styles.darkCard]}>
          <View style={styles.smallRow}>
            <Image source={require("../assets/everycirclelogonew_400x400.jpg")} style={styles.smallLogo} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.smallTitle, darkMode && styles.darkText]}>
                <Text style={styles.smallItalic}>every</Text>
                <Text style={styles.smallMaroon}>Circle</Text>
                <Text style={[styles.smallBlack, darkMode && styles.darkText]}>.com</Text>
              </Text>
              <Text style={[styles.smallSubtitle, darkMode && styles.darkSubtitle]}>It Pays to be Connected</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, darkMode && styles.darkCard]}>
          <Text style={[styles.secTitle, darkMode && styles.darkText]}>We're Here to Help</Text>
          <Text style={[styles.bodyText, darkMode && styles.darkBodyText]}>
            If you have questions about everyCircle, need assistance with your account, or would like to share feedback, please reach out to us. Our team is happy to help.
          </Text>
        </View>

        <View style={[styles.card, darkMode && styles.darkCard]}>
          <Text style={[styles.secTitle, darkMode && styles.darkText]}>Get in Touch</Text>

          <TouchableOpacity style={styles.contactRow} onPress={openEmail} activeOpacity={0.7}>
            <Ionicons name='mail-outline' size={22} color={MAROON} />
            <Text style={styles.contactLink}>{CONTACT_EMAIL}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactRow} onPress={openPhone} activeOpacity={0.7}>
            <Ionicons name='call-outline' size={22} color={MAROON} />
            <Text style={styles.contactLink}>{CONTACT_PHONE}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomBuffer} />
      </ScrollView>

      <BottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  darkSafeArea: { backgroundColor: "#1a1a1a" },

  page: {
    paddingHorizontal: 16,
    paddingTop: 14,
    alignItems: "center",
  },

  card: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 22,
    padding: isMobile ? 14 : 16,
    marginBottom: isMobile ? 12 : 14,
  },
  darkCard: {
    backgroundColor: "#2a2a2a",
    borderColor: "#444",
  },

  smallRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: isMobile ? 10 : 14,
  },
  smallLogo: {
    width: isMobile ? 50 : 60,
    height: isMobile ? 50 : 60,
    resizeMode: "contain",
    backgroundColor: "#fff",
  },
  smallTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
  },
  smallItalic: { fontStyle: "italic", fontWeight: "700" },
  smallMaroon: { color: MAROON, fontWeight: "700" },
  smallBlack: { color: "#111", fontWeight: "700" },
  smallSubtitle: {
    fontSize: 14,
    color: "#111",
    marginTop: 2,
  },
  darkText: { color: "#fff" },
  darkSubtitle: { color: "#ccc" },

  secTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
    lineHeight: 22,
  },
  bodyText: {
    fontSize: 16,
    color: "#111",
    lineHeight: 22,
  },
  darkBodyText: { color: "#ccc" },

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    paddingVertical: 4,
  },
  contactLink: {
    fontSize: 16,
    color: MAROON,
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  bottomBuffer: {
    height: 100,
    marginBottom: 20,
  },
});
