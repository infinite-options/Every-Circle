import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Platform, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { getHeaderColor, getHeaderColors } from "../config/headerColors";
import AppHeader from "../components/AppHeader";
import BottomNavBar from "../components/BottomNavBar";
import AsyncStorage from "@react-native-async-storage/async-storage";

const isMobile = Platform.OS !== "web";

const HIW_GRAPHIC = require("../assets/EC_How_it_Works.png");
/** EC_How_it_Works.png intrinsic size (1536×1024). RN Web does not support Image.resolveAssetSource. */
const HIW_ASPECT_RATIO = 1536 / 1024;

export default function HowItWorksScreen({ navigation, route }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  /** Matches page paddingHorizontal 16 × 2 */
  const contentWidth = Math.max(0, windowWidth - 32);
  const hiwGraphicWidth = isMobile ? contentWidth : Math.round(Math.min(contentWidth * 1.5, windowWidth - 16));
  const hiwGraphicMarginH = isMobile ? 0 : (contentWidth - hiwGraphicWidth) / 2;
  const hiwGraphicHeight = hiwGraphicWidth / HIW_ASPECT_RATIO;

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const userUid = await AsyncStorage.getItem("user_uid");
        const profileUid = await AsyncStorage.getItem("profile_uid");
        // User is considered logged in if either user_uid or profile_uid exists
        setIsLoggedIn(!!(userUid || profileUid));
      } catch (error) {
        console.error("Error checking login status:", error);
        setIsLoggedIn(false);
      }
    };
    checkLoginStatus();
  }, []);
  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader title='HOW IT WORKS' {...getHeaderColors("profileView")} onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.page}>
        {/* SMALL LOGO CARD */}
        <View style={styles.card}>
          <View style={styles.smallRow}>
            <Image source={require("../assets/everycirclelogonew_400x400.jpg")} style={styles.smallLogo} />
            <View style={{ flex: 1 }}>
              <Text style={styles.smallTitle}>
                <Text style={styles.smallItalic}>every</Text>
                <Text style={styles.smallMaroon}>Circle</Text>
                <Text style={styles.smallBlack}>.com</Text>
              </Text>
              <Text style={styles.smallSubtitle}>It Pays to be Connected</Text>
              {/* <Text style={styles.smallSubtitle}>Connecting Circles of Influence</Text> */}
            </View>
          </View>
        </View>

        {/* GOT BUSINESS CARD */}
        <View style={styles.card}>
          <Text style={styles.gbTitle}>For the Individual</Text>

          <Text style={styles.gbHeading}>Create Meaningful and Profitable Circles of Influence</Text>

          <View style={styles.gbBodyContainer}>
            <Bullet>
              <Text style={styles.gbItalic}>Create groups of friends and colleagues you know and trust</Text>
            </Bullet>
            <Bullet>
              <Text style={styles.gbItalic}>Rely on your network's recommendations and expertise</Text>
            </Bullet>
            <Bullet>
              <Text style={styles.gbItalic}>Help your friends and get rewarded for connecting with others</Text>
            </Bullet>
            <Text style={[styles.gbBold, styles.gbBoldText]}>Make Money when you make a purchase or make a recommendation your network can use</Text>
          </View>

          <Text style={styles.gbTitle}>{"\n"}For Businesses</Text>

          <Text style={styles.gbHeading}>Grow your Business with Results-Based Marketing</Text>

          <View style={styles.gbBodyContainer}>
            <Bullet>
              <Text style={styles.gbItalic}>Encourage the network to promote your products and services by offering bounties</Text>
            </Bullet>
            <Bullet>
              <Text style={styles.gbItalic}>Spending markerting dollars only when you make a sale</Text>
            </Bullet>
            <Bullet>
              <Text style={styles.gbItalic}>Track your marketing effectivenesss</Text>
            </Bullet>
            <Text style={[styles.gbBold, styles.gbBoldText]}>Reward people for recommending your business</Text>
          </View>

          {/* <View style={styles.gbBodyContainer}>
            <Bullet>
              <Text style={styles.gbItalic}>Target your ad spend on people who are looking to buy your products and services</Text>
            </Bullet>
            <Bullet>
              <Text style={styles.gbItalic}>Track your marketing effectiveness</Text>
            </Bullet>
            <Bullet>
              <Text style={styles.gbItalic}>Encourage people to try your products and services</Text>
            </Bullet>
            <Text style={[styles.gbBold, styles.gbBoldText]}>Reward people for recommending your business</Text>
          </View> */}

          {/* <Text style={styles.gbMaroonHeading}>Save Time, Money, ...</Text>
          <Text style={styles.gbLine}>
            <Text style={styles.gbItalic}>Innovative, </Text>
            <Text style={styles.gbBold}>Results-Based</Text>
            <Text> Marketing System</Text>
          </Text>

          <Text style={styles.gbHeading2}>Generate Specific Connections</Text>
          <Text style={styles.gbLine}>Matching your criteria, geographical radius, ...</Text>

          <Text style={styles.gbHeading2}>Earn Multiple Revenue Streams</Text>
          <Text style={styles.gbLine}>
            with <Text style={styles.gbBold}>NO-COST</Text> Profiles for each
            {"\n"}
            individual, business, organization
          </Text> */}
        </View>

        <View style={[styles.hiwGraphicWrap, Platform.OS === "web" && styles.hiwGraphicWrapWeb]}>
          <Image
            source={HIW_GRAPHIC}
            resizeMode='contain'
            accessibilityLabel='How everyCircle works overview'
            style={[
              styles.hiwGraphic,
              Platform.OS === "web" && styles.hiwGraphicWeb,
              {
                width: hiwGraphicWidth,
                height: hiwGraphicHeight,
                marginHorizontal: hiwGraphicMarginH,
              },
            ]}
          />
        </View>

        {/* PROFILE HEADER PILL */}
        <HeaderPill title='PROFILE' bg={getHeaderColor("profile")} iconSource={require("../assets/profile.png")} />

        <View style={styles.card}>
          <Text style={styles.secTitle}>1. Create Your Profile(s)</Text>

          <Bullet>
            <Text>Create an </Text>
            <Text style={styles.italicWord}>Individual</Text>
            <Text> Profile to showcase your experience, education, skills, and interests</Text>

            <Bullet>
              <Text>Use </Text>
              <Text style={styles.italicWord}>Offering</Text>
              <Text> to showcase your products, services, and expertise</Text>
            </Bullet>

            <Bullet>
              <Text>Use </Text>
              <Text style={styles.italicWord}>Seeking</Text>
              <Text> to let your connections know what you're looking for</Text>
            </Bullet>
          </Bullet>

          <Bullet>
            <Text>Create a Profile for EACH Business or Organization highlighting its products and services</Text>
          </Bullet>
        </View>

        {/* CONNECT HEADER PILL */}
        <HeaderPill title='CONNECT' bg={getHeaderColor("network")} iconSource={require("../assets/connect.png")} />

        <View style={styles.card}>
          <Text style={styles.secTitle}>
            2. Connect with People in a <Text style={styles.boldWord}>meaningful</Text> way
          </Text>

          <Bullet>
            <Text>Share contact information using QR codes</Text>
          </Bullet>

          <Bullet>
            <Text>Visualize your connections by level and relationship </Text>
          </Bullet>

          <Bullet>
            <Text>Quickly find your connections by geography, relationship, and distance</Text>
          </Bullet>
        </View>

        {/* ACCOUNT HEADER PILL */}
        <HeaderPill title='ACCOUNT' bg={getHeaderColor("account")} iconSource={require("../assets/pillar.png")} />

        <View style={styles.card}>
          <Text style={styles.secTitle}>3. Manage your Purchases, Sales and Revenue</Text>

          <Bullet>
            <Text>Quickly see what you bough and sold</Text>
          </Bullet>

          <Bullet>
            <Text>Track your rewards and see your account balance</Text>
          </Bullet>

          <Bullet>
            <Text>Visualize you revenue over time</Text>
          </Bullet>
        </View>

        {/* SETTINGS HEADER PILL */}
        <HeaderPill title='SETTINGS' bg={getHeaderColor("settings")} iconSource={require("../assets/setting.png")} />

        <View style={styles.card}>
          <Text style={styles.secTitle}>
            4. Control and Manage <Text style={styles.boldWord}>YOUR</Text> Platform
          </Text>

          <Bullet>
            <Text>Manage your settings and preferences in one place</Text>
          </Bullet>

          <Bullet>
            <Text>Enable Locaton Based Services to find and connect with people nearby</Text>
          </Bullet>

          <Bullet>
            <Text>Change your password</Text>
          </Bullet>
        </View>

        {/* SEARCH HEADER PILL */}
        <HeaderPill title='SEARCH' bg={getHeaderColor("search")} iconSource={require("../assets/search.png")} />

        <View style={styles.card}>
          <Text style={styles.secTitle}>5. Find what you are Searching for</Text>
          <Bullet>
            <Text>Search for people, businesses, and organizations by name, location, and keywords</Text>
          </Bullet>

          <Bullet>
            <Text>Find experts in your own network</Text>
          </Bullet>

          <Bullet>
            <Text>Help others find what they are looking for</Text>
          </Bullet>
        </View>

        {/* SIGN UP BUTTON - Only show if user is not logged in */}
        {!isLoggedIn && (
          <TouchableOpacity style={styles.continueBtn} activeOpacity={0.9} onPress={() => navigation.navigate("SignUp")}>
            <Text style={styles.continueText}>Sign Up</Text>
          </TouchableOpacity>
        )}

        {/* FEEDBACK BANNER */}
        <FeedbackBanner />

        <View style={{ height: isLoggedIn ? 100 : 40 }} />
      </ScrollView>
      {isLoggedIn && <BottomNavBar navigation={navigation} />}
    </SafeAreaView>
  );
}

/* ---------- small UI helpers ---------- */
function Pill({ bg, rightIcon, rightIconBg, rightIconBorder, children }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <View style={styles.pillInner}>{children}</View>

      <View style={[styles.pillRightCircle, { backgroundColor: rightIconBg }, rightIconBorder ? styles.circleBorder : null]}>
        <Ionicons name={rightIcon} size={16} color='#111' />
      </View>
    </View>
  );
}

function HeaderPill({ title, bg, iconSource }) {
  return (
    <View style={[styles.headerPill, { backgroundColor: bg }]}>
      <View style={styles.headerIcon}>
        <Image source={iconSource} style={styles.headerIconImage} tintColor='#fff' />
      </View>
      <Text style={styles.headerPillText}>{title}</Text>
    </View>
  );
}

function Bullet({ children }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function FeedbackBanner() {
  return (
    <View style={styles.feedbackBanner}>
      <View style={{ flex: 1 }}>
        <Text style={styles.feedbackTitle}>Submit Feedback Here</Text>
        <Text style={styles.feedbackSub}>Future Banner Ad Here</Text>
      </View>
      <View style={styles.feedbackIconBox}>
        <Ionicons name='chatbox-ellipses-outline' size={34} color='#111' />
        <Ionicons name='create-outline' size={18} color='#111' style={{ position: "absolute", right: -2, top: -2 }} />
      </View>
    </View>
  );
}

/* ---------- colors ---------- */
const MAROON = "#6f130f";
const PALE_YELLOW = "#f4f2bf";
const HIGHLIGHT_YELLOW = "#ead34f";

const CONNECT_BLUE = "#2434C2";
const ACCOUNT_GREEN = "#2e7d3b";
const SETTINGS_PURPLE = "#47308a";
const SEARCH_TEAL = "#4f8a8b";

/* ---------- styles ---------- */
const BORDER = "#2a2a2a";

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },

  page: {
    paddingHorizontal: 16,
    paddingTop: 14,
    alignItems: "center",
  },

  hiwGraphicWrap: {
    width: "100%",
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  /** Web: remove inline-image baseline gap (most noticeable in narrow widths). */
  hiwGraphicWrapWeb: {
    lineHeight: 0,
  },
  hiwGraphic: {},
  hiwGraphicWeb: {
    display: "block",
    verticalAlign: "top",
  },

  everyItalic: {
    fontStyle: "italic",
    fontWeight: "700",
  },
  circleNormal: {
    fontStyle: "normal",
    fontWeight: "700",
  },

  /* Pills */
  pill: {
    width: "100%",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 26,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginBottom: 12,
    justifyContent: "center",
  },
  pillInner: { alignItems: "center", justifyContent: "center" },
  pillCenterText: { fontSize: 16, fontWeight: "700", color: "#111" },
  pillRightCircle: {
    position: "absolute",
    right: 14,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  circleBorder: { borderWidth: 1, borderColor: BORDER },

  hiwHighlightWrap: {
    backgroundColor: HIGHLIGHT_YELLOW,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
  },
  hiwHighlightText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },

  /* Cards */
  card: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 22,
    padding: isMobile ? 14 : 16,
    marginBottom: isMobile ? 12 : 14,
  },

  /* Video */
  videoBox: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    backgroundColor: "#fff",
  },
  videoImage: { width: 200, height: 200, resizeMode: "contain" },
  playOverlay: {
    position: "absolute",
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
  },
  playCircle: {
    position: "absolute",
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  cornerNav: {
    position: "absolute",
    bottom: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  cornerLeft: { left: 14 },
  cornerRight: { right: 14 },

  videoCaption: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 15,
    fontStyle: "italic",
    color: "#111",
  },

  /* Small logo card */
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

  /* Got Business card text */
  gbTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: MAROON,
    fontStyle: "italic",
    marginTop: 8,
  },
  gbHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    marginTop: 10,
    lineHeight: 22,
  },
  gbBodyContainer: {
    marginTop: 8,
  },
  gbBody: {
    fontSize: 16,
    color: "#111",
    marginTop: 6,
    lineHeight: 22,
  },
  gbItalic: {
    fontStyle: "italic",
    fontSize: 16,
    lineHeight: 18,
  },
  gbBold: {
    fontWeight: "700",
  },
  gbBoldText: {
    fontSize: 16,
    color: "#111",
    lineHeight: isMobile ? 22 : 26,
    marginTop: 2,
  },

  gbMaroonHeading: {
    fontSize: 18,
    fontWeight: "700",
    color: MAROON,
    marginTop: 14,
  },
  gbLine: { fontSize: 16, color: "#111", marginTop: 4, lineHeight: 22 },
  gbHeading2: { fontSize: 17, fontWeight: "700", color: MAROON, marginTop: 18 },

  /* Section header pills */
  headerPill: {
    width: "100%",
    borderRadius: 26,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 12,
  },
  headerIcon: {
    width: 46,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerIconImage: {
    width: 26,
    height: 26,
  },
  headerPillText: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginRight: 18,
  },

  /* Section body text */
  secTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    marginBottom: 6,
    lineHeight: 22,
  },

  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 2,
    marginBottom: 2,
  },
  bulletDot: {
    width: isMobile ? 18 : 20,
    fontSize: 16,
    color: "#111",
    lineHeight: 22,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 16,
    color: "#111",
    lineHeight: 22,
  },

  indentLine: {
    marginLeft: isMobile ? 18 : 22,
    marginTop: 10,
    fontSize: 16,
    color: "#111",
    lineHeight: 22,
  },

  italicWord: { fontStyle: "italic" },
  boldWord: { fontWeight: "700" },

  noteLine: {
    marginTop: 14,
    fontSize: 16,
    lineHeight: 22,
  },
  noteLabel: { color: MAROON, fontWeight: "700" },

  /* Continue button */
  continueBtn: {
    marginTop: 6,
    backgroundColor: "#FF9500",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  continueText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  /* Feedback banner */
  feedbackBanner: {
    width: "100%",
    backgroundColor: "#d9f1ff",
    borderRadius: 26,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginTop: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f3bbf",
    textAlign: "center",
  },
  feedbackSub: {
    marginTop: 6,
    fontSize: 14,
    fontStyle: "italic",
    color: "#111",
    textAlign: "center",
  },
  feedbackIconBox: {
    width: 70,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Dropdown pills at bottom */
  pillBig: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    textAlign: "center",
  },
  pillItalic: { fontStyle: "italic", fontWeight: "700" },

  /* bottom icons */
  bottomIconsRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    paddingHorizontal: 6,
  },
  bottomLogo: {
    width: 44,
    height: 44,
    resizeMode: "contain",
  },
  bottomIcon: {
    width: 34,
    height: 34,
  },
});
