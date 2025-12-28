import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { getHeaderColor } from "../config/headerColors";

export default function HowItWorksScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* TOP MAROON HEADER */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.topHeaderTitle}>How it Works</Text>

        {/* spacer */}
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.page}>
        {/* SMALL LOGO CARD */}
        <View style={styles.card}>
          <View style={styles.smallRow}>
            <Image
              source={require("../assets/everycirclelogonew_400x400.jpg")}
              style={styles.smallLogo}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.smallTitle}>
                <Text style={styles.smallItalic}>every</Text>
                <Text style={styles.smallMaroon}>Circle</Text>
                <Text style={styles.smallBlack}>.com</Text>
              </Text>
              <Text style={styles.smallSubtitle}>
                Connecting Circles of Influence
              </Text>
            </View>
          </View>
        </View>

        {/* GOT BUSINESS CARD */}
        <View style={styles.card}>
          <Text style={styles.gbTitle}>Got Business ?</Text>

          <Text style={styles.gbHeading}>One-Stop Marketing Platform</Text>

          <Text style={styles.gbBody}>
            <Text style={styles.gbItalic}>
              Comprehensive Turnkey Solution for{"\n"}
            </Text>
            <Text style={styles.gbItalic}>
              Businesses, Organizations and Professionals{"\n"}
            </Text>
            <Text style={styles.gbBold}>
              solves common, fundamental challenges:
            </Text>
          </Text>

          <Text style={styles.gbMaroonHeading}>Save Time, Money, ...</Text>
          <Text style={styles.gbLine}>
            <Text style={styles.gbItalic}>Innovative, </Text>
            <Text style={styles.gbBold}>Results-Based</Text>
            <Text> Marketing System</Text>
          </Text>

          <Text style={styles.gbHeading2}>Generate Specific Connections</Text>
          <Text style={styles.gbLine}>
            Matching your criteria, geographical radius, ...
          </Text>

          <Text style={styles.gbHeading2}>Earn Multiple Revenue Streams</Text>
          <Text style={styles.gbLine}>
            with <Text style={styles.gbBold}>NO-COST</Text> Profiles for each
            {"\n"}
            individual, business, organization
          </Text>
        </View>

        {/* PROFILE HEADER PILL */}
        <HeaderPill
          title="PROFILE"
          bg={getHeaderColor("profile")}
          iconSource={require("../assets/profile.png")}
        />

        <View style={styles.card}>
          <Text style={styles.secTitle}>1. Create Your Profile(s)</Text>

          <Bullet>
            <Text>Profile </Text>
            <Text style={styles.italicWord}>Individual</Text>
          </Bullet>

          <Bullet>
            <Text>Profile for EACH Business, Organization</Text>
          </Bullet>

          <Bullet>
            <Text>For each profile, submit:</Text>
          </Bullet>

          <Text style={styles.indentLine}>
            <Text style={styles.boldWord}>SEEKING, OFFERING{"\n"}</Text>
            <Text>including Other Vendor’s items{"\n"}</Text>
            <Text>Store </Text>
            <Text style={styles.italicWord}>Items</Text>
          </Text>

          <Bullet>
            <Text>
              Create Circles of Influence{"\n"}Join other users’ Circles of
              Influence
            </Text>
          </Bullet>

          <Bullet>
            <Text>MARKETING: Add Multiple Features</Text>
          </Bullet>

          <Text style={styles.noteLine}>
            <Text style={styles.noteLabel}>Note:</Text>
            <Text>
              {" "}
              You manage the narrative here{"\n"}Submit as little or as much as
              you desire
            </Text>
          </Text>
        </View>

        {/* CONNECT HEADER PILL */}
        <HeaderPill
          title="CONNECT"
          bg={getHeaderColor("network")}
          iconSource={require("../assets/connect.png")}
        />

        <View style={styles.card}>
          <Text style={styles.secTitle}>
            2. Generate <Text style={styles.boldWord}>SPECIFIC</Text>{" "}
            Connections
          </Text>

          <Bullet>
            <Text>
              Meet prospects in-person and online{"\n"}matching your criteria,
              geographical radius
            </Text>
          </Bullet>

          <Bullet>
            <Text>View heat maps of your Circles of Influence</Text>
          </Bullet>

          <Bullet>
            <Text>
              Grow your personal / professional networks{"\n"}
              Invite others with your custom QR code and{"\n"}
              marketing collateral to create their profiles
            </Text>
          </Bullet>
        </View>

        {/* ACCOUNT HEADER PILL */}
        <HeaderPill
          title="ACCOUNT"
          bg={getHeaderColor("account")}
          iconSource={require("../assets/pillar.png")}
        />

        <View style={styles.card}>
          <Text style={styles.secTitle}>
            3. Manage Multiple Revenue Streams
          </Text>

          <Bullet>
            <Text>Select attributes for advertisers</Text>
          </Bullet>

          <Bullet>
            <Text>Assign Bounties for Advertising</Text>
          </Bullet>

          <Text style={styles.indentLine}>
            <Text style={[styles.italicWord, styles.boldWord]}>Innovative</Text>
            <Text> Results-Based Marketing{"\n"}</Text>

            <Text style={styles.italicWord}>
              A bounty is money paid as a reward per{"\n"}
              transaction: Impression, Click, Action, Sale{"\n"}
            </Text>

            <Text>
              Bounties are deducted and shared,{"\n"}
              by different percentages,{" "}
              <Text style={[styles.boldWord, styles.italicWord]}>
                ONLY
              </Text>{" "}
              after{"\n"}
              completed transactions
            </Text>
          </Text>

          <Bullet>
            <Text>
              Review your Dashboards{"\n"}
              Revenue, Expenses (Shopping Cart){"\n"}
              Bounty Revenue Distribution Table{"\n"}
              Revenue Guide and Projections
            </Text>
          </Bullet>
        </View>

        {/* SETTINGS HEADER PILL */}
        <HeaderPill
          title="SETTINGS"
          bg={getHeaderColor("settings")}
          iconSource={require("../assets/setting.png")}
        />

        <View style={styles.card}>
          <Text style={styles.secTitle}>
            4. Control and Manage <Text style={styles.boldWord}>YOUR</Text>{" "}
            Platform
          </Text>

          <Bullet>
            <Text>
              Manage Settings{"\n"}
              Display / Hide profiles and features{"\n"}
              Select specific notification criteria
            </Text>
          </Bullet>
        </View>

        {/* SEARCH HEADER PILL */}
        <HeaderPill
          title="SEARCH"
          bg={getHeaderColor("search")}
          iconSource={require("../assets/search.png")}
        />

        <View style={styles.card}>
          <Text style={styles.secTitle}>5. Advanced Search</Text>
          <Bullet>
            <Text>
              Concepts, keywords{"\n"}
              Within a specific profile{"\n"}
              All profiles in the platform
            </Text>
          </Bullet>
        </View>

        {/* CONTINUE BUTTON */}
        <TouchableOpacity
          style={styles.continueBtn}
          activeOpacity={0.9}
          onPress={() => console.log("Continue")}
        >
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>

        {/* FEEDBACK BANNER */}
        <FeedbackBanner />

        {/* DROPDOWN PILLS */}
        <Pill
          bg="#fff"
          rightIcon="chevron-down"
          rightIconBg="#fff"
          rightIconBorder
        >
          <Text style={styles.pillBig}>HOME</Text>
        </Pill>

        <Pill
          bg="#fff"
          rightIcon="chevron-down"
          rightIconBg="#fff"
          rightIconBorder
        >
          <Text style={styles.pillBig}>
            Welcome! <Text style={styles.pillItalic}>Sign Up</Text>
          </Text>
        </Pill>

        <Pill
          bg="#fff"
          rightIcon="chevron-down"
          rightIconBg="#fff"
          rightIconBorder
        >
          <Text style={styles.pillBig}>
            Welcome Back! <Text style={styles.pillItalic}>Log In</Text>
          </Text>
        </Pill>

        <Pill
          bg="#fff"
          rightIcon="chevron-down"
          rightIconBg="#fff"
          rightIconBorder
        >
          <Text style={[styles.pillCenterText, { fontSize: 22 }]}>
            everyCircle
          </Text>
        </Pill>

        {/* CONTINUE BUTTON AGAIN */}
        <TouchableOpacity
          style={[styles.continueBtn, { marginTop: 10 }]}
          activeOpacity={0.9}
          onPress={() => console.log("Continue2")}
        >
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>

        {/* FEEDBACK BANNER AGAIN */}
        <FeedbackBanner />

        {/* BOTTOM ICON ROW */}
        <View style={styles.bottomIconsRow}>
          <Image
            source={require("../assets/everycirclelogonew_400x400.jpg")}
            style={styles.bottomLogo}
          />
          <Image source={require("../assets/connect.png")} style={styles.bottomIcon} tintColor="#111" />
          <Image source={require("../assets/profile.png")} style={styles.bottomIcon} tintColor="#111" />
          <Image source={require("../assets/pillar.png")} style={styles.bottomIcon} tintColor="#111" />
          <Image source={require("../assets/setting.png")} style={styles.bottomIcon} tintColor="#111" />
          <Image source={require("../assets/search.png")} style={styles.bottomIcon} tintColor="#111" />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- small UI helpers ---------- */
function Pill({ bg, rightIcon, rightIconBg, rightIconBorder, children }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <View style={styles.pillInner}>{children}</View>

      <View
        style={[
          styles.pillRightCircle,
          { backgroundColor: rightIconBg },
          rightIconBorder ? styles.circleBorder : null,
        ]}
      >
        <Ionicons name={rightIcon} size={16} color="#111" />
      </View>
    </View>
  );
}

function HeaderPill({ title, bg, iconSource }) {
  return (
    <View style={[styles.headerPill, { backgroundColor: bg }]}>
      <View style={styles.headerIcon}>
        <Image source={iconSource} style={styles.headerIconImage} tintColor="#fff" />
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
        <Ionicons name="chatbox-ellipses-outline" size={34} color="#111" />
        <Ionicons
          name="create-outline"
          size={18}
          color="#111"
          style={{ position: "absolute", right: -2, top: -2 }}
        />
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

  topHeader: {
    backgroundColor: MAROON,
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 36,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  topHeaderTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 24,
    letterSpacing: 1,
  },

  page: {
    paddingHorizontal: 16,
    paddingTop: 14,
    alignItems: "center",
  },

  everyItalic: {
    fontStyle: "italic",
    fontWeight: "900", // keep it bold 
  },
  circleNormal: {
    fontStyle: "normal",
    fontWeight: "900",
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
  pillCenterText: { fontSize: 28, fontWeight: "900", color: "#111" },
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
    fontSize: 22,
    fontWeight: "900",
    color: "#111",
  },

  /* Cards */
  card: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
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
    fontSize: 18,
    fontStyle: "italic",
    color: "#111",
  },

  /* Small logo card */
  smallRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  smallLogo: {
    width: 60,
    height: 60,
    resizeMode: "contain",
    backgroundColor: "#fff",
  },
  smallTitle: { fontSize: 26, fontWeight: "900", color: "#111" },
  smallItalic: { fontStyle: "italic", fontWeight: "900" },
  smallMaroon: { color: MAROON, fontWeight: "900" },
  smallBlack: { color: "#111", fontWeight: "900" },
  smallSubtitle: { fontSize: 18, color: "#111" },

  /* Got Business card text */
  gbTitle: {
    fontSize: 34,
    fontWeight: "900",
    color: MAROON,
    fontStyle: "italic",
  },
  gbHeading: { fontSize: 28, fontWeight: "900", color: "#111", marginTop: 10 },
  gbBody: { fontSize: 18, color: "#111", marginTop: 6, lineHeight: 26 },
  gbItalic: { fontStyle: "italic" },
  gbBold: { fontWeight: "900" },

  gbMaroonHeading: {
    fontSize: 26,
    fontWeight: "900",
    color: MAROON,
    marginTop: 14,
  },
  gbLine: { fontSize: 18, color: "#111", marginTop: 4, lineHeight: 26 },
  gbHeading2: { fontSize: 24, fontWeight: "900", color: MAROON, marginTop: 18 },

  /* Section header pills */
  headerPill: {
    width: "100%",
    borderRadius: 26,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
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
    fontSize: 30,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 1,
    marginRight: 18,
  },

  /* Section body text */
  secTitle: { fontSize: 28, fontWeight: "900", color: "#111", marginBottom: 6 },

  bulletRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 10 },
  bulletDot: { width: 22, fontSize: 24, color: "#111", lineHeight: 26 },
  bulletText: { flex: 1, fontSize: 22, color: "#111", lineHeight: 30 },

  indentLine: {
    marginLeft: 22,
    marginTop: 10,
    fontSize: 22,
    color: "#111",
    lineHeight: 30,
  },

  italicWord: { fontStyle: "italic" },
  boldWord: { fontWeight: "900" },

  noteLine: { marginTop: 14, fontSize: 22, lineHeight: 30 },
  noteLabel: { color: MAROON, fontWeight: "900" },

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
    fontSize: 26,
    fontWeight: "900",
    color: "#1f3bbf",
    textAlign: "center",
  },
  feedbackSub: {
    marginTop: 6,
    fontSize: 18,
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
    fontSize: 32,
    fontWeight: "900",
    color: "#111",
    textAlign: "center",
  },
  pillItalic: { fontStyle: "italic", fontWeight: "900" },

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
