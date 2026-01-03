import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDarkMode } from "../contexts/DarkModeContext";
import { DARK_MODE_COLORS } from "../config/headerColors";

/**
 * Reusable App Header Component
 *
 * @param {string} title - The header text to display
 * @param {string} backgroundColor - Background color (default: "#AF52DE")
 * @param {function} onBackPress - Callback for back button press (if provided, shows back button)
 * @param {React.ReactNode|function} rightButton - Right side button/icon (can be a component or render function)
 * @param {string} darkModeBackgroundColor - Background color for dark mode (optional)
 */
const AppHeader = ({ title, backgroundColor = "#AF52DE", onBackPress, rightButton, darkModeBackgroundColor }) => {
  const { darkMode } = useDarkMode();

  // Determine background color based on dark mode
  const bgColor = darkMode && darkModeBackgroundColor ? darkModeBackgroundColor : backgroundColor;

  // Dark mode color adjustments for common colors
  const getDarkModeColor = (color) => {
    if (!darkMode) return color;
    // Use centralized dark mode color mapping
    return DARK_MODE_COLORS[color] || color;
  };

  const finalBgColor = darkMode ? getDarkModeColor(bgColor) : bgColor;

  return (
    <View style={[styles.headerBg, { backgroundColor: finalBgColor }, Platform.OS === "web" && { width: "100%" }]}>
      <View style={styles.headerContent}>
        {/* Back Button */}
        {onBackPress && (
          <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
            <Ionicons name='chevron-back' size={18} color='#fff' />
          </TouchableOpacity>
        )}

        {/* Header Text */}
        <Text style={[styles.header, darkMode && styles.darkHeader, onBackPress && styles.headerWithBack]}>{title}</Text>

        {/* Right Button/Icon */}
        {rightButton && <View style={styles.rightButtonContainer}>{typeof rightButton === "function" ? rightButton() : rightButton}</View>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerBg: {
    backgroundColor: "#AF52DE",
    paddingTop: 14,
    paddingBottom: 16,
    alignItems: "center",
    borderBottomLeftRadius: 300,
    borderBottomRightRadius: 300,
    overflow: "visible", // Allow dropdown to extend beyond header
    zIndex: 10000,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 16,
    position: "relative",
    zIndex: 10000,
  },
  backButton: {
    position: "absolute",
    left: 16,
    top: 0,
    width: 36,
    height: 26,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  headerWithBack: {
    marginLeft: 0,
  },
  darkHeader: {
    color: "#ffffff",
  },
  rightButtonContainer: {
    position: "absolute",
    right: 16,
    top: 0,
    zIndex: 10001,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible", // IMPORTANT FOR WEB - allows dropdowns to extend beyond
  },
});

export default AppHeader;
