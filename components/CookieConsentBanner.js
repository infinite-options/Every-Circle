import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useDarkMode } from "../contexts/DarkModeContext";
import { getAllowCookies, setAllowCookies, subscribeAllowCookies, reportCookieBannerHeight, subscribeBottomNavBarHeight } from "../utils/cookieConsent";

/**
 * CookieConsentBanner
 *
 * Persistent footer-style bar shown app-wide (mounted once in App.js) until the
 * user makes a choice — it does not auto-dismiss and has no close button.
 * - "Accept Necessary Cookies" saves allowCookies = true and hides the banner.
 * - "Opt-out" surfaces the same "Cookies Required" warning Settings shows when
 *   turning cookies off; confirming there saves allowCookies = false and hides
 *   the banner, canceling leaves the banner up (still unanswered).
 *
 * @param {{ navigationRef?: React.RefObject }} props - used to open Privacy Policy from the inline link.
 */
export default function CookieConsentBanner({ navigationRef }) {
  const { darkMode } = useDarkMode();
  const [visible, setVisible] = useState(false);
  const [warningVisible, setWarningVisible] = useState(false);
  // Sits directly above the BottomNavBar (0 on screens that don't render one).
  const [navBarHeight, setNavBarHeight] = useState(0);
  useEffect(() => subscribeBottomNavBarHeight(setNavBarHeight), []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const value = await getAllowCookies();
      if (mounted) setVisible(value === null);
    })();
    const unsubscribe = subscribeAllowCookies((value) => {
      setVisible(value === null);
      if (value !== null) setWarningVisible(false);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Let fixed footers (BottomNavBar) know how tall the banner is so they can shift
  // above it instead of being covered; 0 once it's hidden/unmounted.
  useEffect(() => {
    if (!visible) {
      reportCookieBannerHeight(0);
    }
    return () => reportCookieBannerHeight(0);
  }, [visible]);

  if (!visible) return null;

  const handleAllow = async () => {
    await setAllowCookies(true);
  };

  const confirmOptOut = async () => {
    setWarningVisible(false);
    await setAllowCookies(false);
    // Opting out only leaves Settings reachable (see App.js's cookiesAllowedScreens
    // enforcement) — send the user there right away instead of stranding them.
    navigationRef?.current?.navigate("Settings");
  };

  const openPrivacyPolicy = () => {
    navigationRef?.current?.navigate("PrivacyPolicy");
  };

  return (
    <>
      <View
        style={[
          styles.banner,
          darkMode && styles.darkBanner,
          // Above a BottomNavBar: the nav bar already clears the home-indicator safe
          // area, so sit right on top of it with a plain, smaller bottom padding.
          navBarHeight > 0 && { bottom: navBarHeight, paddingBottom: 14 },
        ]}
        onLayout={(e) => reportCookieBannerHeight(e.nativeEvent.layout.height)}
        accessibilityRole='alert'
      >
        <View style={styles.textRow}>
          <MaterialIcons name='cookie' size={22} color={darkMode ? "#fff" : "#4B2E83"} style={styles.icon} />
          <Text style={[styles.text, darkMode && styles.darkText]}>
            Some U.S. state privacy laws offer their residents specific consumer privacy rights, which we respect as described in our{" "}
            <Text style={[styles.link, darkMode && styles.darkLink]} onPress={openPrivacyPolicy} accessibilityRole='link' accessibilityLabel='Open Privacy Policy'>
              Privacy Policy
            </Text>
            . We never share your information with third parties. Cookies are only used to enable your user experience. To exercise other rights you may have related to cookies, see our{" "}
            <Text style={[styles.link, darkMode && styles.darkLink]} onPress={openPrivacyPolicy} accessibilityRole='link' accessibilityLabel='Open Privacy Policy'>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.optOutButton, darkMode && styles.darkOptOutButton]}
            onPress={() => setWarningVisible(true)}
            accessibilityRole='button'
            accessibilityLabel='Opt out of cookies'
          >
            <Text style={[styles.optOutText, darkMode && styles.darkOptOutText]}>Opt-out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.allowButton]} onPress={handleAllow} accessibilityRole='button' accessibilityLabel='Accept necessary cookies'>
            <Text style={styles.allowText}>Accept Necessary Cookies</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Opt-out warning — matches the copy Settings shows for turning cookies off */}
      <Modal visible={warningVisible} transparent animationType='fade'>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, darkMode && styles.darkModalBox]}>
            <MaterialIcons name='warning' size={48} color='#FF6B6B' style={{ marginBottom: 15 }} />
            <Text style={[styles.warningTitle, darkMode && styles.darkWarningTitle]}>Cookies Required</Text>
            <Text style={[styles.warningText, darkMode && styles.darkWarningText]}>If you do not allow cookies, you will only have access to the Settings screen.</Text>
            <View style={styles.warningButtonContainer}>
              <TouchableOpacity onPress={() => setWarningVisible(false)} style={[styles.warningButton, styles.cancelButton]} accessibilityRole='button' accessibilityLabel='Cancel'>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmOptOut} style={[styles.warningButton, styles.confirmButton]} accessibilityRole='button' accessibilityLabel='I understand, opt out of cookies'>
                <Text style={styles.confirmButtonText}>I Understand</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 20,
    backgroundColor: "#fff",
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 30 : 14,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    gap: 12,
  },
  darkBanner: {
    backgroundColor: "#1a1a1a",
    borderTopColor: "#444",
  },
  textRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  icon: {
    marginTop: 1,
  },
  text: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    color: "#333",
  },
  darkText: {
    color: "#ccc",
  },
  link: {
    color: "#4B2E83",
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  darkLink: {
    color: "#C8A8FF",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 8,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  optOutButton: {
    backgroundColor: "#E5E5E5",
  },
  darkOptOutButton: {
    backgroundColor: "#333",
  },
  optOutText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "bold",
  },
  darkOptOutText: {
    color: "#ccc",
  },
  allowButton: {
    backgroundColor: "#4B2E83",
  },
  allowText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalBox: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 12,
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
  },
  darkModalBox: {
    backgroundColor: "#333",
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#000",
    textAlign: "center",
  },
  darkWarningTitle: {
    color: "#fff",
  },
  warningText: {
    fontSize: 15,
    color: "#555",
    textAlign: "center",
    marginBottom: 20,
  },
  darkWarningText: {
    color: "#ccc",
  },
  warningButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    width: "100%",
  },
  warningButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#ccc",
  },
  cancelButtonText: {
    color: "#333",
    fontSize: 15,
    fontWeight: "bold",
  },
  confirmButton: {
    backgroundColor: "#FF6B6B",
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
  },
});
