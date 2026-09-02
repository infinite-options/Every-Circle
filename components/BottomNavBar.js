import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useUnread } from "../contexts/UnreadContext";
import { triggerTabRefresh } from "../utils/tabRefreshRegistry";
import { reportBottomNavBarHeight } from "../utils/cookieConsent";

const getFocusedRoute = (nav) => {
  try {
    const state = nav.getState?.();
    if (!state?.routes?.length) return null;
    return state.routes[state.index] ?? null;
  } catch {
    return null;
  }
};

const getFocusedRouteName = (nav) => getFocusedRoute(nav)?.name ?? null;

const { width, height } = Dimensions.get("window");

const BottomNavBar = ({ navigation, onSharePress, businessStep, onBack, onContinue, onBeforeNavigate }) => {
  const { darkMode } = useDarkMode();
  const { hasUnread } = useUnread();
  // Report our own height so the cookie consent banner can sit directly above us
  // instead of covering us; report 0 on unmount (screen without this nav bar).
  useEffect(() => {
    return () => reportBottomNavBarHeight(0);
  }, []);

  // Navigate to a tab, or refresh if already on that tab (footer "tap again to refresh").
  const handleNavigate = (destination) => {
    if (onBeforeNavigate) {
      const shouldNavigate = onBeforeNavigate(destination);
      if (!shouldNavigate) return; // Navigation intercepted
    }
    const currentRoute = getFocusedRouteName(navigation);
    const focusedRoute = getFocusedRoute(navigation);

    // Profile is a single stack screen. Viewing another user sets route.params.profile_uid;
    // a bare navigate("Profile") reuses that route and keeps the other user. Always open
    // the logged-in user's profile from the footer (merge: false clears sticky params).
    if (destination === "Profile") {
      const profileRoute = navigation.getState?.()?.routes?.find((r) => r.name === "Profile");
      const viewingOtherProfile =
        !!profileRoute?.params?.profile_uid ||
        (focusedRoute?.name === "Profile" && !!focusedRoute?.params?.profile_uid);
      if (viewingOtherProfile || currentRoute !== "Profile") {
        navigation.navigate({ name: "Profile", params: {}, merge: false });
        return;
      }
      triggerTabRefresh("Profile");
      return;
    }

    if (currentRoute === destination) {
      triggerTabRefresh(destination);
      return;
    }
    navigation.navigate(destination);
  };

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.safeArea, darkMode && styles.darkSafeArea]}
      onLayout={(e) => reportBottomNavBarHeight(e.nativeEvent.layout.height)}
    >
      <View style={[styles.navContainer, darkMode && styles.darkNavContainer]}>
        {businessStep ? (
          // Business Step Navigation: Back, Profile, Account, Settings, Continue
          <>
            <TouchableOpacity style={styles.navButton} onPress={onBack}>
              <Ionicons name='chevron-back' size={28} color={darkMode ? "#ffffff" : "#007AFF"} style={styles.navIcon} />
              <Text style={[styles.navLabel, darkMode && styles.darkNavLabel]}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navButton} onPress={() => handleNavigate("Profile")}>
              <Image source={require("../assets/profile.png")} style={[styles.navIcon, darkMode && styles.darkNavIcon]} tintColor={darkMode ? "#ffffff" : undefined} />
              <Text style={[styles.navLabel, darkMode && styles.darkNavLabel]}>Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navButton} onPress={() => handleNavigate("Account")}>
              <Image source={require("../assets/pillar.png")} style={[styles.navIcon, darkMode && styles.darkNavIcon]} tintColor={darkMode ? "#ffffff" : undefined} />
              <Text style={[styles.navLabel, darkMode && styles.darkNavLabel]}>Account</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navButton} onPress={() => handleNavigate("Settings")}>
              <Image source={require("../assets/setting.png")} style={[styles.navIcon, darkMode && styles.darkNavIcon]} tintColor={darkMode ? "#ffffff" : undefined} />
              <Text style={[styles.navLabel, darkMode && styles.darkNavLabel]}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navButton} onPress={onContinue}>
              <Ionicons name='chevron-forward' size={28} color={darkMode ? "#ffffff" : "#00C721"} style={styles.navIcon} />
              <Text style={[styles.navLabel, darkMode && styles.darkNavLabel]}>Continue</Text>
            </TouchableOpacity>
          </>
        ) : (
          // Regular Navigation: Connect, Profile, Account, Settings, Search (Inbox hidden — see comment below)
          <>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => {
                const currentRoute = getFocusedRouteName(navigation);
                if (currentRoute !== "Connect" && onSharePress) onSharePress();
                handleNavigate("Connect");
              }}
            >
              <View style={styles.iconWrap}>
                <Image source={require("../assets/connect.png")} style={[styles.navIcon, darkMode && styles.darkNavIcon]} tintColor={darkMode ? "#ffffff" : undefined} />
                {hasUnread && <View style={styles.unreadDot} />}
              </View>
              {/* <Text style={[styles.navLabel, darkMode && styles.darkNavLabel]}>Connect</Text> */}
            </TouchableOpacity>

            <TouchableOpacity style={styles.navButton} onPress={() => handleNavigate("Profile")}>
              <Image source={require("../assets/profile.png")} style={[styles.navIcon, darkMode && styles.darkNavIcon]} tintColor={darkMode ? "#ffffff" : undefined} />
              {/* <Text style={[styles.navLabel, darkMode && styles.darkNavLabel]}>Profile</Text> */}
            </TouchableOpacity>

            <TouchableOpacity style={styles.navButton} onPress={() => handleNavigate("Account")}>
              <Image source={require("../assets/pillar.png")} style={[styles.navIcon, darkMode && styles.darkNavIcon]} tintColor={darkMode ? "#ffffff" : undefined} />
              {/* <Text style={[styles.navLabel, darkMode && styles.darkNavLabel]}>Account</Text> */}
            </TouchableOpacity>

            <TouchableOpacity style={styles.navButton} onPress={() => handleNavigate("Settings")}>
              <Image source={require("../assets/setting.png")} style={[styles.navIcon, darkMode && styles.darkNavIcon]} tintColor={darkMode ? "#ffffff" : undefined} />
              {/* <Text style={[styles.navLabel, darkMode && styles.darkNavLabel]}>Settings</Text> */}
            </TouchableOpacity>

            <TouchableOpacity style={styles.navButton} onPress={() => handleNavigate("Search")}>
              <Image source={require("../assets/search.png")} style={[styles.navIcon, darkMode && styles.darkNavIcon]} tintColor={darkMode ? "#ffffff" : undefined} />
              {/* <Text style={[styles.navLabel, darkMode && styles.darkNavLabel]}>Search</Text> */}
            </TouchableOpacity>

            {/* Inbox button — hidden for now, unread dot moved to Network icon above
            <TouchableOpacity style={styles.navButton} onPress={() => handleNavigate("Inbox")}>
              <View style={styles.iconWrap}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={26}
                  color={darkMode ? "#ffffff" : "#222222"}
                  style={styles.navIcon}
                />
                {hasUnread && <View style={styles.unreadDot} />}
              </View>
            </TouchableOpacity>
            */}
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#fff",
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    width: "100%",
  },
  navContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    paddingTop: 6,
    width: "100%",
  },
  navButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  navIcon: {
    width: 28,
    height: 28,
    marginBottom: 2,
  },
  navLabel: {
    fontSize: 13,
    color: "#222",
    marginTop: 2,
    fontWeight: "400",
    letterSpacing: 0.2,
  },

  iconWrap: {
    position: "relative",
    width: 28,
    height: 28,
    marginBottom: 2,
  },
  unreadDot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#FF3B30",
    borderWidth: 1.5,
    borderColor: "#fff",
  },

  // Dark mode styles
  darkSafeArea: {
    backgroundColor: "#1a1a1a",
  },
  darkNavContainer: {
    backgroundColor: "#1a1a1a",
    borderColor: "#404040",
  },
  darkNavLabel: {
    color: "#ffffff",
  },
  darkNavIcon: {
    // tintColor moved to Image prop
  },
});

export default BottomNavBar;
