import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDarkMode } from "../contexts/DarkModeContext";

const { width, height } = Dimensions.get("window");

const BottomNavBar = ({ navigation, onSharePress, businessStep, onBack, onContinue, onBeforeNavigate }) => {
  const { darkMode } = useDarkMode();

  // Helper function to handle navigation with interceptor
  const handleNavigate = (destination) => {
    if (onBeforeNavigate) {
      const shouldNavigate = onBeforeNavigate(destination);
      if (!shouldNavigate) return; // Navigation intercepted
    }
    navigation.navigate(destination);
  };

  return (
    <SafeAreaView edges={["bottom"]} style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
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
          // Regular Navigation: Connect, Profile, Account, Settings, Search, Inbox
          <>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => {
                if (onSharePress) onSharePress();
                handleNavigate("Network");
              }}
            >
              <Image source={require("../assets/connect.png")} style={[styles.navIcon, darkMode && styles.darkNavIcon]} tintColor={darkMode ? "#ffffff" : undefined} />
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

            <TouchableOpacity style={styles.navButton} onPress={() => handleNavigate("Inbox")}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={26}
                color={darkMode ? "#ffffff" : "#222222"}
                style={styles.navIcon}
              />
              {/* <Text style={[styles.navLabel, darkMode && styles.darkNavLabel]}>Inbox</Text> */}
            </TouchableOpacity>
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
