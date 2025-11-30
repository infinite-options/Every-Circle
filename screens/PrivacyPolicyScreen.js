import React from "react";
import { SafeAreaView, ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import BottomNavBar from "../components/BottomNavBar";
import { useDarkMode } from "../contexts/DarkModeContext";

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.darkContainer]}>
      {/* Header */}
      <View style={[styles.header, darkMode && styles.darkHeader]}>
        <Text style={styles.headerText}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, darkMode && styles.darkTitle]}>Every Circle Privacy Policy</Text>
        <Text style={[styles.body, darkMode && styles.darkBody]}>
          Last updated: August 1, 2024 {"\n\n"}
          Privacy Policy{"\n"}
          Infinite Options, LLC ("us", "we", or "our") operates Manifest My Space (the "Application"). This page informs you of our policies regarding the collection, use and disclosure of Personal
          Information we receive from users of the mobile application and web applications (the "Platforms"). We use your Personal Information only for providing and improving the Application. By
          using the Application, you agree to the collection and use of information in accordance with this policy.
          {"\n\n"}Information Collection And Use
          {"\n"}While using our Application, we may ask you to provide us with certain personally identifiable information that can be used to contact or identify you. Personally identifiable
          information may include, but is not limited to your name, email, social id (if you used social media to log in), street address, phone number, and payment information ("Personal
          Information"). This data is stored within our secure databases and we use this data to identify you with your account and purchases. We also use this data to pre-populate the information
          into your Application profile.
          {"\n\n"}Log Data
          {"\n"}Like many application operators, we collect information that your Platform sends whenever you visit our Application ("Log Data").
          {"\n"}This Log Data may include information such as your phone's Internet Protocol ("IP") address, phone type, software version, the pages of our Application that you visit, the time and
          date of your visit, the time spent on those pages and other statistics.
          {"\n"}In addition, we may use third party services such as Google Analytics that collect, monitor and analyze this information to improve the Application.
          {"\n\n"}Communications
          {"\n"}We may use your Personal Information to contact you with newsletters, marketing or promotional materials and other information regarding the mobile application.
          {"\n\n"}Security
          {"\n"}The security of your Personal Information is important to us, but remember that no method of transmission over the Internet, or method of electronic storage, is 100% secure. While we
          strive to use commercially acceptable means to protect your Personal Information, we cannot guarantee its absolute security.
          {"\n\n"}Your Rights to Your Data
          {"\n"}We believe that your personal data is your data. As such, should you ever request to be removed from our email lists or database you need only send us an email at
          info@infiniteoptions.com stating your request. We will comply within 5 working days of receiving your email.
          {"\n\n"}Changes To This Privacy Policy
          {"\n"}This Privacy Policy is effective as of August 1, 2024 and will remain in effect except with respect to any changes in its provisions in the future, which will be in effect immediately
          after being posted on this page.
          {"\n"}We reserve the right to update or change our Privacy Policy at any time and you should check this Privacy Policy periodically. Your continued use of the Service after we post any
          modifications to the Privacy Policy on this page will constitute your acknowledgment of the modifications and your consent to abide and be bound by the modified Privacy Policy.
          {"\n"}If we make any material changes to this Privacy Policy, we will notify you either through the email address you have provided us, or by placing a prominent notice on our mobile
          application.
          {"\n\n"}Contact Us
          {"\n"}If you have any questions about this Privacy Policy, please contact us:
          {"\n"}Infinite Options, LLC
          {"\n"}info@infiniteoptions.com
        </Text>

        {/* Close button */}
        <TouchableOpacity style={[styles.closeButton, darkMode && styles.darkCloseButton]} onPress={() => navigation.goBack()}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>

        {/* Bottom buffer space to ensure Close button is visible above BottomNavBar */}
        <View style={styles.bottomBuffer} />
      </ScrollView>

      <BottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  darkContainer: { backgroundColor: "#1a1a1a" },
  header: {
    backgroundColor: "#AF52DE",
    paddingTop: 30,
    paddingBottom: 15,
    alignItems: "center",
    borderBottomLeftRadius: 300,
    borderBottomRightRadius: 300,
  },
  darkHeader: {
    backgroundColor: "#4b2c91",
  },
  headerText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
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
  },
  darkBody: {
    color: "#cccccc",
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
    height: 100, // Provides space above BottomNavBar
    marginBottom: 20,
  },
});
