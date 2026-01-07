import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
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
 * @param {function} onTitlePress - Callback for title press (if provided, makes title clickable)
 */
const AppHeader = ({ title, backgroundColor = "#AF52DE", onBackPress, rightButton, darkModeBackgroundColor, onTitlePress }) => {
  const { darkMode } = useDarkMode();

  // Determine background color based on dark mode
  const baseBgColor = darkMode && darkModeBackgroundColor ? darkModeBackgroundColor : backgroundColor;

  const finalBgColor = darkMode ? DARK_MODE_COLORS[baseBgColor] || baseBgColor : baseBgColor;

  const Title = onTitlePress ? (
    <TouchableOpacity onPress={onTitlePress} activeOpacity={0.7} style={styles.titleTouchable}>
      <Text style={[styles.header, darkMode && styles.darkHeader, onBackPress && styles.headerWithBack]} numberOfLines={1}>
        {title}
      </Text>
    </TouchableOpacity>
  ) : (
    <Text style={[styles.header, darkMode && styles.darkHeader, onBackPress && styles.headerWithBack]} numberOfLines={1}>
      {title}
    </Text>
  );

  return (
    <View style={[styles.headerBg, { backgroundColor: finalBgColor }, Platform.OS === "web" && { width: "100%" }]}>
      <View style={styles.headerContent}>
        {/* Back Button */}
        {onBackPress && (
          <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
            <Ionicons name='chevron-back' size={20} color='#fff' />
          </TouchableOpacity>
        )}

        {/* Title */}
        {Title}

        {/* Right Button */}
        {rightButton && <View style={styles.rightButtonContainer}>{typeof rightButton === "function" ? rightButton() : rightButton}</View>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerBg: {
    backgroundColor: "#AF52DE",
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 300,
    borderBottomRightRadius: 300,
    zIndex: 10000,
    overflow: "visible",
  },

  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    minHeight: 56, // 🔒 consistent header height across platforms
    position: "relative",
    width: "100%",
    zIndex: 10000,
  },

  backButton: {
    position: "absolute",
    left: 16,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },

  header: {
    flex: 1, // ✅ FLEX MUST LIVE HERE
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    textAlignVertical: "center",
  },

  headerWithBack: {
    marginLeft: 0,
  },

  titleTouchable: {
    justifyContent: "center",
    alignItems: "center",
  },

  darkHeader: {
    color: "#ffffff",
  },

  rightButtonContainer: {
    position: "absolute",
    right: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10001,
    overflow: "visible",
  },
});

export default AppHeader;
