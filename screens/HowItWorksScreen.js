import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Platform, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { getHeaderColor, getHeaderColors } from "../config/headerColors";
import AppHeader from "../components/AppHeader";
import BottomNavBar from "../components/BottomNavBar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useDarkMode } from "../contexts/DarkModeContext";
import { SETTINGS_NETWORK_DEBUG_MODE_KEY } from "../config/networkDebug";
import { useFocusEffect } from "@react-navigation/native";

const isMobile = Platform.OS !== "web";

const HIW_GRAPHIC = require("../assets/EC_How_it_Works.png");
/** EC_How_it_Works.png intrinsic size (1536×1024). RN Web does not support Image.resolveAssetSource. */
const HIW_ASPECT_RATIO = 1536 / 1024;

const MAROON = "#6f130f";
const BORDER = "#2a2a2a";
const RECOMMEND_ORANGE = "#FF9500";
const EARN_GOLD = "#C47A00";

const CORE_STEPS = [
  {
    key: "profile",
    n: "1",
    title: "PROFILE",
    subtitle: "Tell your circle who you are",
    bg: getHeaderColor("profile"),
    iconSource: require("../assets/profile.png"),
    bullets: [
      { lead: "Individual profile", rest: " — experience, education, skills, interests, and expertise." },
      { lead: "Offerings", rest: " — products, services, and know-how you can provide." },
      { lead: "Seeking", rest: " — let connections know what you need." },
      { lead: "Business or organization", rest: " — create a profile for each one you represent." },
    ],
    takeaway: "Your profile tells your network how you can help — and what you are looking for.",
  },
  {
    key: "connect",
    n: "2",
    title: "CONNECT",
    subtitle: "Build your circle of influence",
    bg: getHeaderColor("network"),
    iconSource: require("../assets/connect.png"),
    bullets: [
      { rest: "Share contact information instantly with your custom QR code." },
      { rest: "See connections by relationship and how closely you are linked." },
      { rest: "Find people by geography, relationship, and distance." },
      { rest: "Turn new connections into new opportunities." },
    ],
    takeaway: "A larger network creates more opportunities to help others.",
  },
  {
    key: "search",
    n: "3",
    title: "SEARCH",
    subtitle: "Find people, businesses, and opportunities",
    bg: getHeaderColor("search"),
    iconSource: require("../assets/search.png"),
    bullets: [
      { rest: "Search people and businesses by name, location, and keywords." },
      { rest: "Discover experts and trusted providers inside your own network." },
      { rest: "Find products and services recommended by people you know." },
      { rest: "Help others in your circle find what they need." },
    ],
    takeaway: "Instead of searching the entire internet, start with people you trust.",
  },
  {
    key: "recommend",
    n: "4",
    title: "RECOMMEND",
    subtitle: "Help someone get what they need",
    bg: RECOMMEND_ORANGE,
    iconName: "people",
    bullets: [
      { rest: "Point someone to the right person, business, product, or service." },
      { rest: "Introduce a trusted provider when a friend or client has a need." },
      { rest: "Write a recommendation and share it with the network." },
      { rest: "Solve a problem through someone you know — not a stranger on the web." },
    ],
    takeaway: "A good recommendation creates value for everyone involved.",
  },
  {
    key: "earn",
    n: "5",
    title: "EARN",
    subtitle: "Get rewarded for creating value",
    bg: EARN_GOLD,
    iconName: "trophy",
    bullets: [
      { rest: "Businesses can offer a bounty to promote products or gain customers." },
      { rest: "When a recommendation leads to a purchase, the bounty is shared." },
      { rest: "The recommender, the people who connected them, and the buyer can all earn." },
      { rest: "everyCircle takes a platform share so the marketplace can keep running." },
    ],
    takeaway: "You help someone. The business gets a customer. The circle gets rewarded.",
  },
];

const MANAGE_STEPS = [
  {
    key: "account",
    n: "6",
    title: "ACCOUNT",
    subtitle: "Track activity and earnings",
    bg: getHeaderColor("account"),
    iconSource: require("../assets/pillar.png"),
    bullets: [
      { rest: "See what you bought and sold." },
      { rest: "Track recommendations and rewards." },
      { rest: "Monitor your account balance." },
      { rest: "View revenue and transaction activity over time." },
    ],
    takeaway: "All of your rewards, earnings and activities in one place.",
  },
  {
    key: "settings",
    n: "7",
    title: "SETTINGS",
    subtitle: "Control your experience",
    bg: getHeaderColor("settings"),
    iconSource: require("../assets/setting.png"),
    bullets: [
      { rest: "Manage account settings and preferences." },
      { rest: "Enable location so you can discover people and businesses nearby." },
      { rest: "Control privacy and how you appear in the network." },
      { rest: "Change your password and security settings." },
    ],
    takeaway: "You control how you use your circle.",
  },
];

const JUMP_CHIPS = [
  { key: "profile", label: "Profile", color: getHeaderColor("profile") },
  { key: "connect", label: "Connect", color: getHeaderColor("network") },
  { key: "search", label: "Search", color: getHeaderColor("search") },
  { key: "recommend", label: "Recommend", color: RECOMMEND_ORANGE },
  { key: "earn", label: "Earn", color: EARN_GOLD },
  { key: "account", label: "Account", color: getHeaderColor("account") },
  { key: "settings", label: "Settings", color: getHeaderColor("settings") },
];

const BOUNTY_SHARES = [
  { pct: "20%", label: "Recommender", hint: "Made the introduction", color: "#2E7D32" },
  { pct: "40%", label: "Connecting network", hint: "Passed it along", color: "#5E35B1" },
  { pct: "20%", label: "Buyer", hint: "Completed the purchase", color: "#1565C0" },
  { pct: "20%", label: "everyCircle", hint: "Runs the platform", color: MAROON },
];

const BEATS = [
  { icon: "people-circle-outline", title: "Connect", body: "Build a network of people you know and trust." },
  { icon: "chatbubbles-outline", title: "Recommend", body: "Help someone find the right person or business." },
  { icon: "trophy-outline", title: "Earn", body: "Share in the bounty when that recommendation helps creates a sale." },
];

function BrandEveryCircle() {
  return (
    <>
      <Text style={styles.brandEvery}>every</Text>
      <Text style={styles.brandCircle}>Circle</Text>
    </>
  );
}

function withBrand(text) {
  if (typeof text !== "string" || !text.includes("everyCircle")) return text;
  const parts = text.split("everyCircle");
  return parts.map((part, i) => (
    <React.Fragment key={i}>
      {part}
      {i < parts.length - 1 ? <BrandEveryCircle /> : null}
    </React.Fragment>
  ));
}

export default function HowItWorksScreen({ navigation }) {
  const { darkMode } = useDarkMode();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [audience, setAudience] = useState("individual");
  const [debugMode, setDebugMode] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef(null);
  const sectionY = useRef({});

  const contentWidth = Math.max(0, windowWidth - 32);
  const isWide = windowWidth >= 800;
  const hiwGraphicWidth = isMobile ? contentWidth : Math.round(Math.min(contentWidth * 1.5, windowWidth - 16));
  const hiwGraphicMarginH = isMobile ? 0 : (contentWidth - hiwGraphicWidth) / 2;
  const hiwGraphicHeight = hiwGraphicWidth / HIW_ASPECT_RATIO;

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const userUid = await AsyncStorage.getItem("user_uid");
        const profileUid = await AsyncStorage.getItem("profile_uid");
        setIsLoggedIn(!!(userUid || profileUid));
      } catch (error) {
        console.error("Error checking login status:", error);
        setIsLoggedIn(false);
      }
    };
    checkLoginStatus();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const nd = await AsyncStorage.getItem(SETTINGS_NETWORK_DEBUG_MODE_KEY);
          if (!cancelled) setDebugMode(nd !== null && JSON.parse(nd) === true);
        } catch {
          if (!cancelled) setDebugMode(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const recordSection = useCallback(
    (key) => (e) => {
      sectionY.current[key] = e.nativeEvent.layout.y;
    },
    [],
  );

  const scrollToSection = (key) => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const target = document.getElementById(`hiw-${key}`);
      if (target) {
        let scroller = target.parentElement;
        while (scroller) {
          const style = window.getComputedStyle(scroller);
          if (scroller.scrollHeight - scroller.clientHeight > 20 && (style.overflowY === "auto" || style.overflowY === "scroll")) {
            break;
          }
          scroller = scroller.parentElement;
        }
        if (scroller) {
          const top = Math.max(0, target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 8);
          scroller.scrollTop = top;
          return;
        }
      }
    }
    const y = sectionY.current[key];
    if (typeof y === "number") {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 6), animated: true });
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
      <AppHeader title='HOW IT WORKS' {...getHeaderColors("profileView")} onBackPress={() => navigation.goBack()} />

      <ScrollView ref={scrollRef} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        {/* Brand + value proposition */}
        <View style={[styles.card, darkMode && styles.darkCard]}>
          <View style={styles.smallRow}>
            <Image source={require("../assets/everycirclelogonew_400x400.jpg")} style={styles.smallLogo} />
            <View style={{ flex: 1 }}>
              <Text style={styles.smallTitle}>
                <Text style={[styles.smallItalic, darkMode && styles.darkText]}>every</Text>
                <Text style={styles.smallMaroon}>Circle</Text>
                <Text style={[styles.smallBlack, darkMode && styles.darkText]}>.com</Text>
              </Text>
              <Text style={[styles.smallSubtitle, darkMode && styles.darkMuted]}>It Pays to be Connected</Text>
            </View>
          </View>

          <Text style={[styles.heroHeadline, darkMode && styles.darkText]}>{withBrand("everyCircle helps Individuals and Businesses")}</Text>

          <View nativeID='hiw-audience' collapsable={false} style={styles.audienceInHero} onLayout={recordSection("audience")}>
            {!isWide && (
              <View style={[styles.segment, darkMode && styles.darkSegment]}>
                <TouchableOpacity
                  style={[styles.segmentBtn, audience === "individual" && styles.segmentBtnOn]}
                  onPress={() => setAudience("individual")}
                  activeOpacity={0.85}
                  accessibilityRole='button'
                  accessibilityState={{ selected: audience === "individual" }}
                >
                  <Text style={[styles.segmentText, darkMode && styles.darkMuted, audience === "individual" && styles.segmentTextOn]}>Individuals</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentBtn, audience === "business" && styles.segmentBtnOn]}
                  onPress={() => setAudience("business")}
                  activeOpacity={0.85}
                  accessibilityRole='button'
                  accessibilityState={{ selected: audience === "business" }}
                >
                  <Text style={[styles.segmentText, darkMode && styles.darkMuted, audience === "business" && styles.segmentTextOn]}>Businesses</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.audienceGrid, isWide && styles.audienceGridWide]}>
              {(isWide || audience === "individual") && (
                <AudienceCard
                  darkMode={darkMode}
                  wide={isWide}
                  kicker='For individuals'
                  // title='Build a meaningful — and profitable — circle'
                  title='Turn your network into a revenue stream'
                  intro='Your network is one of your most valuable resources. everyCircle helps you turn the things you know, the people you know, and the recommendations you make into something that benefits everyone.'
                  points={[
                    "Create a network of friends, colleagues, customers, and professionals you trust.",
                    "Get recommendations for businesses, products, and services from your own network.",
                    "Help someone in your circle find what they need.",
                    "Earn a bounty when your recommendation leads to a qualifying purchase.",
                  ]}
                  closer='Make money helping people in your network.'
                />
              )}
              {(isWide || audience === "business") && (
                <AudienceCard
                  darkMode={darkMode}
                  wide={isWide}
                  kicker='For businesses'
                  title='Grow with results-based marketing'
                  intro='Traditional advertising asks you to spend hoping someone becomes a customer. everyCircle lets you reward people for recommending you — and you pay only when those recommendations generate a sale.'
                  points={[
                    "Offer bounties that encourage people to recommend your products and services.",
                    "Spend marketing dollars only when a recommendation becomes a qualified sale.  No Advertising fee and No Subscription fee.",
                    "Turn customers, partners, employees, and your professional network into advocates.",
                    "See where sales and revenue actually come from.",
                  ]}
                  closer='Turn word-of-mouth into measurable results.'
                />
              )}
            </View>
          </View>
        </View>

        {debugMode && (
          <View style={[styles.beatRow, styles.beatRowBelowHero, isWide && styles.beatRowWide]}>
            {BEATS.map((beat) => (
              <View key={beat.title} style={[styles.beatCard, darkMode && styles.darkInset, isWide && styles.beatCardWide]}>
                <View style={styles.beatIconWrap}>
                  <Ionicons name={beat.icon} size={22} color={MAROON} />
                </View>
                <Text style={[styles.beatTitle, darkMode && styles.darkText]}>{beat.title}</Text>
                <Text style={[styles.beatBody, darkMode && styles.darkMuted]}>{beat.body}</Text>
              </View>
            ))}
          </View>
        )}

        {debugMode && (
          <View style={[styles.card, styles.exampleCard, darkMode && styles.darkCard]}>
            <Text style={styles.exampleKicker}>See it in action</Text>
            <Text style={[styles.exampleTitle, darkMode && styles.darkText]}>A recommendation that pays the circle</Text>
            <Text style={[styles.body, darkMode && styles.darkMuted]}>
              A loan officer's client is relocating. She recommends a realtor she trusts — and that realtor might introduce an insurer, a mover, or a contractor. If those recommendations lead to
              business and a bounty is offered, the reward can flow back through the people who made the connection possible.
            </Text>
            <View style={styles.storyRow}>
              {[
                { n: "1", t: "Need", d: "Client is moving" },
                { n: "2", t: "Recommend", d: "Trusted realtor" },
                { n: "3", t: "Purchase", d: "Home is bought" },
                { n: "4", t: "Reward", d: "Bounty is shared" },
              ].map((step, i) => (
                <View key={step.n} style={[styles.storyStep, darkMode && styles.darkInset]}>
                  <View style={styles.storyNum}>
                    <Text style={styles.storyNumText}>{step.n}</Text>
                  </View>
                  <Text style={[styles.storyTitle, darkMode && styles.darkText]}>{step.t}</Text>
                  <Text style={[styles.storyDetail, darkMode && styles.darkMuted]}>{step.d}</Text>
                  {i < 3 && isWide ? <Text style={styles.storyArrow}>→</Text> : null}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Infographic */}
        <View nativeID='hiw-graphic' collapsable={false} style={styles.fullWidth} onLayout={recordSection("graphic")}>
          <View style={[styles.hiwGraphicWrap, Platform.OS === "web" && styles.hiwGraphicWrapWeb]}>
            <Image
              source={HIW_GRAPHIC}
              resizeMode='contain'
              accessibilityLabel='How everyCircle works: a recommendation creates value for everyone'
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
          <Text style={[styles.graphicCaption, darkMode && styles.darkMuted]}>A recommendation does more than help — the bounty is shared across the circle.</Text>
        </View>

        {/* Bounty split */}
        <View style={[styles.card, darkMode && styles.darkCard]}>
          <Text style={[styles.secTitle, darkMode && styles.darkText]}>How a bounty is shared</Text>
          <Text style={[styles.body, darkMode && styles.darkMuted]}>When a recommendation leads to a qualifying purchase, the bounty is typically split like this:</Text>
          <View style={[styles.shareGrid, isWide && styles.shareGridWide]}>
            {BOUNTY_SHARES.map((share) => (
              <View key={share.label} style={[styles.shareCard, darkMode && styles.darkInset, isWide && styles.shareCardWide]}>
                <Text style={[styles.sharePct, { color: share.color }]}>{share.pct}</Text>
                <Text style={[styles.shareLabel, darkMode && styles.darkText]}>{withBrand(share.label)}</Text>
                <Text style={[styles.shareHint, darkMode && styles.darkMuted]}>{share.hint}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.takeaway, darkMode && styles.darkTakeaway]}>
            <Text style={[styles.takeawayText, darkMode && styles.darkText]}>{withBrand("That’s the everyCircle difference: Everyone who helps make a connection shares in the reward")}</Text>
          </View>
        </View>

        {/* Jump nav */}
        <Text style={[styles.heroHeadline, styles.sectionHeadline, darkMode && styles.darkText]}>{withBrand("How to use everyCircle")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={styles.chipScroll}>
          {JUMP_CHIPS.map((chip) => (
            <TouchableOpacity
              key={chip.key}
              style={[styles.chip, darkMode && styles.darkChip]}
              onPress={() => scrollToSection(chip.key)}
              activeOpacity={0.8}
              accessibilityRole='button'
              accessibilityLabel={`Jump to ${chip.label}`}
            >
              <View style={[styles.chipDot, { backgroundColor: chip.color }]} />
              <Text style={[styles.chipText, darkMode && styles.darkText]}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {CORE_STEPS.map((step) => (
          <StepBlock key={step.key} step={step} darkMode={darkMode} onLayout={recordSection(step.key)} />
        ))}

        <Text style={[styles.heroHeadline, styles.sectionHeadline, styles.controlHeadline, darkMode && styles.darkText]}>Stay in control</Text>
        {MANAGE_STEPS.map((step) => (
          <StepBlock key={step.key} step={step} darkMode={darkMode} onLayout={recordSection(step.key)} />
        ))}

        {debugMode && (
          <View style={[styles.card, darkMode && styles.darkCard]} onLayout={recordSection("advantage")}>
            <Text style={[styles.secTitle, darkMode && styles.darkText]}>{withBrand("The everyCircle advantage")}</Text>
            <Text style={[styles.body, darkMode && styles.darkMuted]}>{withBrand("everyCircle connects three things so relationships can become opportunities.")}</Text>
            <View style={[styles.advantageRow, isWide && styles.advantageRowWide]}>
              {[
                { icon: "person-outline", title: "People", body: "Build relationships, share knowledge, make recommendations, and earn rewards." },
                { icon: "git-network-outline", title: "Recommendations", body: "Help people find trusted products, services, businesses, and expertise." },
                { icon: "storefront-outline", title: "Businesses", body: "Reach customers through trusted introductions and reward the people who helped." },
              ].map((item) => (
                <View key={item.title} style={[styles.advantageCard, darkMode && styles.darkInset, isWide && styles.advantageCardWide]}>
                  <Ionicons name={item.icon} size={26} color={MAROON} />
                  <Text style={[styles.advantageTitle, darkMode && styles.darkText]}>{item.title}</Text>
                  <Text style={[styles.advantageBody, darkMode && styles.darkMuted]}>{item.body}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.circleClose, darkMode && styles.darkInset]}>
              <Text style={[styles.circleCloseLine, darkMode && styles.darkText]}>People help people.</Text>
              <Text style={[styles.circleCloseLine, darkMode && styles.darkText]}>Businesses reward recommendations.</Text>
              <Text style={[styles.circleCloseEmph, darkMode && styles.darkText]}>Everyone can benefit.</Text>
            </View>
          </View>
        )}

        {/* Closing CTA */}
        <View style={[styles.card, styles.ctaCard, darkMode && styles.darkCard]}>
          <Text style={[styles.ctaTitle, darkMode && styles.darkText]}>Start building your circle</Text>
          <Text style={[styles.body, styles.ctaBody, darkMode && styles.darkMuted]}>
            Create your profile. Connect with people you trust. Discover opportunities. Make recommendations. Get rewarded when those recommendations create value.
          </Text>
          <Text style={styles.ctaTagline}>It Pays to be Connected!</Text>
          {!isLoggedIn && (
            <TouchableOpacity style={styles.continueBtn} activeOpacity={0.9} onPress={() => navigation.navigate("SignUp")}>
              <Text style={styles.continueText}>Sign Up</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.card, darkMode && styles.darkCard]}>
          <Text style={[styles.secTitle, darkMode && styles.darkText]}>Policies</Text>
          <TouchableOpacity onPress={() => navigation.navigate("ChildSafety")} activeOpacity={0.7} accessibilityRole='link' accessibilityLabel='Child Safety Policy'>
            <Text style={styles.policyLink}>Child Safety Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("DeleteAccountInfo")} activeOpacity={0.7} accessibilityRole='link' accessibilityLabel='How to Delete Your Account'>
            <Text style={styles.policyLink}>How to Delete Your Account</Text>
          </TouchableOpacity>
        </View>

        <FeedbackBanner darkMode={darkMode} onPress={() => navigation.navigate("ContactUs")} />

        <View style={{ height: isLoggedIn ? 100 : 40 }} />
      </ScrollView>
      {isLoggedIn && <BottomNavBar navigation={navigation} />}
    </SafeAreaView>
  );
}

function AudienceCard({ darkMode, wide, kicker, title, intro, points, closer }) {
  return (
    <View style={[styles.card, styles.audienceCard, styles.audienceCardNested, wide && styles.audienceCardWide, darkMode && styles.darkCard]}>
      <Text style={styles.audienceKicker}>{kicker}</Text>
      <Text style={[styles.audienceTitle, darkMode && styles.darkText]}>{title}</Text>
      <Text style={[styles.body, darkMode && styles.darkMuted]}>{withBrand(intro)}</Text>
      {points.map((point) => (
        <Bullet key={point} darkMode={darkMode}>
          {point}
        </Bullet>
      ))}
      <View style={[styles.takeaway, styles.takeawayFooter, darkMode && styles.darkTakeaway]}>
        <Text style={[styles.takeawayText, darkMode && styles.darkText]}>{closer}</Text>
      </View>
    </View>
  );
}

function StepBlock({ step, darkMode, onLayout }) {
  return (
    <View nativeID={`hiw-${step.key}`} collapsable={false} style={styles.fullWidth} onLayout={onLayout}>
      <HeaderPill title={`${step.n}.  ${step.title}`} bg={step.bg} iconSource={step.iconSource} iconName={step.iconName} />
      <View style={[styles.card, darkMode && styles.darkCard]}>
        <Text style={[styles.secTitle, darkMode && styles.darkText]}>{step.subtitle}</Text>
        {step.bullets.map((bullet, i) => (
          <Bullet key={`${step.key}-${i}`} darkMode={darkMode}>
            {bullet.lead ? <Text style={styles.italicWord}>{bullet.lead}</Text> : null}
            <Text>{withBrand(bullet.rest)}</Text>
          </Bullet>
        ))}
        <View style={[styles.takeaway, darkMode && styles.darkTakeaway]}>
          <Text style={[styles.takeawayText, darkMode && styles.darkText]}>{withBrand(step.takeaway)}</Text>
        </View>
      </View>
    </View>
  );
}

function HeaderPill({ title, bg, iconSource, iconName }) {
  return (
    <View style={[styles.headerPill, { backgroundColor: bg }]}>
      <View style={styles.headerIcon}>{iconSource ? <Image source={iconSource} style={styles.headerIconImage} tintColor='#fff' /> : <Ionicons name={iconName} size={24} color='#fff' />}</View>
      <Text style={styles.headerPillText}>{title}</Text>
    </View>
  );
}

function Bullet({ children, darkMode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.bulletDot, darkMode && styles.darkText]}>•</Text>
      <Text style={[styles.bulletText, darkMode && styles.darkMuted]}>{children}</Text>
    </View>
  );
}

function FeedbackBanner({ darkMode, onPress }) {
  return (
    <TouchableOpacity style={[styles.feedbackBanner, darkMode && styles.darkFeedbackBanner]} onPress={onPress} activeOpacity={0.85} accessibilityRole='button' accessibilityLabel='Submit feedback'>
      <View style={{ flex: 1 }}>
        <Text style={styles.feedbackTitle}>Questions or ideas?</Text>
        <Text style={[styles.feedbackSub, darkMode && styles.darkMuted]}>Send us feedback — we read every note.</Text>
      </View>
      <View style={styles.feedbackIconBox}>
        <Ionicons name='chatbox-ellipses-outline' size={34} color={darkMode ? "#fff" : "#111"} />
      </View>
    </TouchableOpacity>
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
  fullWidth: {
    width: "100%",
  },

  hiwGraphicWrap: {
    width: "100%",
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 6,
  },
  hiwGraphicWrapWeb: {
    lineHeight: 0,
  },
  hiwGraphic: {},
  hiwGraphicWeb: {
    display: "block",
    verticalAlign: "top",
  },
  graphicCaption: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#444",
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 8,
    lineHeight: 20,
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
  darkInset: {
    backgroundColor: "#333",
    borderColor: "#4a4a4a",
  },
  darkText: { color: "#fff" },
  darkMuted: { color: "#ccc" },

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
  brandEvery: { fontStyle: "italic" },
  brandCircle: { color: MAROON },
  smallBlack: { color: "#111", fontWeight: "700" },
  smallSubtitle: {
    fontSize: 14,
    color: "#111",
    marginTop: 2,
  },

  heroHeadline: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
    marginTop: 16,
    lineHeight: 28,
  },
  sectionHeadline: {
    width: "100%",
    marginTop: 8,
    marginBottom: 10,
  },
  controlHeadline: {
    fontSize: 26,
    lineHeight: 32,
    marginTop: 18,
    marginBottom: 14,
  },

  beatRow: {
    marginTop: 14,
    gap: 10,
  },
  beatRowBelowHero: {
    width: "100%",
    marginTop: 0,
    marginBottom: isMobile ? 12 : 14,
  },
  beatRowWide: {
    flexDirection: "row",
  },
  beatCard: {
    backgroundColor: "#faf6ee",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    borderRadius: 16,
    padding: 12,
    flex: 1,
  },
  beatCardWide: {
    minWidth: 0,
  },
  beatIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  beatTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: MAROON,
    marginBottom: 4,
  },
  beatBody: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },

  segment: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: "#f3f1ea",
    borderRadius: 22,
    padding: 4,
    marginBottom: 12,
  },
  darkSegment: {
    backgroundColor: "#333",
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 18,
    alignItems: "center",
  },
  segmentBtnOn: {
    backgroundColor: MAROON,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#444",
  },
  segmentTextOn: {
    color: "#fff",
  },

  audienceInHero: {
    width: "100%",
    marginTop: 16,
  },
  audienceGrid: {
    width: "100%",
  },
  audienceGridWide: {
    flexDirection: "row",
    gap: 12,
    alignItems: "stretch",
  },
  audienceCard: {
    flexGrow: 1,
  },
  audienceCardNested: {
    marginBottom: 0,
  },
  audienceCardWide: {
    flex: 1,
    width: "auto",
    minWidth: 0,
    justifyContent: "flex-start",
  },
  audienceKicker: {
    fontSize: 14,
    fontWeight: "700",
    fontStyle: "italic",
    color: MAROON,
  },
  audienceTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginTop: 6,
    marginBottom: 8,
    lineHeight: 24,
  },

  exampleCard: {
    backgroundColor: "#fffaf0",
  },
  exampleKicker: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: RECOMMEND_ORANGE,
  },
  exampleTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginTop: 4,
    marginBottom: 6,
  },
  storyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  storyStep: {
    flexGrow: 1,
    flexBasis: 70,
    minWidth: 70,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    position: "relative",
  },
  storyNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: MAROON,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  storyNumText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  storyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111",
  },
  storyDetail: {
    fontSize: 12,
    color: "#555",
    textAlign: "center",
    marginTop: 2,
  },
  storyArrow: {
    position: "absolute",
    right: -10,
    top: 18,
    fontSize: 16,
    color: "#999",
  },

  chipScroll: {
    width: "100%",
    marginBottom: 12,
    flexGrow: 0,
  },
  chipRow: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  darkChip: {
    backgroundColor: "#2a2a2a",
    borderColor: "#444",
  },
  chipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111",
  },

  shareGrid: {
    marginTop: 10,
    gap: 8,
  },
  shareGridWide: {
    flexDirection: "row",
  },
  shareCard: {
    backgroundColor: "#f7f5f0",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    flex: 1,
  },
  shareCardWide: {
    minWidth: 0,
  },
  sharePct: {
    fontSize: 22,
    fontWeight: "800",
  },
  shareLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
    marginTop: 2,
  },
  shareHint: {
    fontSize: 12,
    color: "#555",
    marginTop: 2,
  },

  body: {
    fontSize: 16,
    color: "#333",
    lineHeight: 23,
    marginBottom: 8,
  },

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
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginRight: 18,
  },

  secTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
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
    color: "#333",
    lineHeight: 22,
  },
  italicWord: { fontStyle: "italic", fontWeight: "700" },

  takeaway: {
    marginTop: 12,
    backgroundColor: "#f4f2bf",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  takeawayFooter: {
    marginTop: "auto",
    paddingTop: 12,
  },
  darkTakeaway: {
    backgroundColor: "#3d3a1f",
  },
  takeawayText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
    lineHeight: 21,
  },

  advantageRow: {
    gap: 10,
    marginTop: 4,
  },
  advantageRowWide: {
    flexDirection: "row",
  },
  advantageCard: {
    flex: 1,
    backgroundColor: "#faf6ee",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  advantageCardWide: {
    minWidth: 0,
  },
  advantageTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: MAROON,
    marginTop: 8,
    marginBottom: 4,
  },
  advantageBody: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  circleClose: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: "#faf6ee",
    borderRadius: 16,
  },
  circleCloseLine: {
    fontSize: 16,
    color: "#111",
    lineHeight: 24,
  },
  circleCloseEmph: {
    fontSize: 17,
    fontWeight: "800",
    color: MAROON,
    marginTop: 6,
  },

  ctaCard: {
    alignItems: "center",
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
    textAlign: "center",
    marginBottom: 8,
  },
  ctaBody: {
    textAlign: "center",
  },
  ctaTagline: {
    fontSize: 15,
    fontWeight: "700",
    color: MAROON,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 12,
  },

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

  policyLink: {
    fontSize: 16,
    color: "#2434C2",
    textDecorationLine: "underline",
    marginTop: 8,
    lineHeight: 22,
  },

  feedbackBanner: {
    width: "100%",
    backgroundColor: "#d9f1ff",
    borderRadius: 26,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginTop: 4,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
  },
  darkFeedbackBanner: {
    backgroundColor: "#1c3a52",
    borderColor: "#3a5a72",
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
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
});
