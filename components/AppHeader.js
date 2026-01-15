import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDarkMode } from "../contexts/DarkModeContext";
import { DARK_MODE_COLORS } from "../config/headerColors";

const HEADER_HEIGHT = 96;

const AppHeader = ({ title, backgroundColor = "#AF52DE", onBackPress, rightButton, darkModeBackgroundColor, onTitlePress }) => {
  const { darkMode } = useDarkMode();

  const baseBgColor = darkMode && darkModeBackgroundColor ? darkModeBackgroundColor : backgroundColor;

  const finalBgColor = darkMode ? DARK_MODE_COLORS[baseBgColor] || baseBgColor : baseBgColor;

  const Title = onTitlePress ? (
    <TouchableOpacity onPress={onTitlePress} activeOpacity={0.7}>
      <Text style={[styles.headerText, darkMode && styles.darkHeader]} numberOfLines={1}>
        {title}
      </Text>
    </TouchableOpacity>
  ) : (
    <Text style={[styles.headerText, darkMode && styles.darkHeader]} numberOfLines={1}>
      {title}
    </Text>
  );

  return (
    <View style={styles.wrapper}>
      {/* Decorative background ONLY */}
      <View style={[styles.background, { backgroundColor: finalBgColor }]} />

      {/* Interactive content */}
      <View style={styles.content}>
        {onBackPress && (
          <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
            <Ionicons name='chevron-back' size={20} color='#fff' />
          </TouchableOpacity>
        )}

        {Title}

        {rightButton && <View style={styles.rightButtonContainer}>{typeof rightButton === "function" ? rightButton() : rightButton}</View>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    height: HEADER_HEIGHT,
    width: "100%",
    position: "relative",
    zIndex: 10000,
  },

  background: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    borderBottomLeftRadius: 300,
    borderBottomRightRadius: 300,
  },

  content: {
    height: HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  backButton: {
    position: "absolute",
    left: 21,
    top: 5,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  headerText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginTop: 5,
  },

  darkHeader: {
    color: "#ffffff",
  },

  rightButtonContainer: {
    position: "absolute",
    right: 21,
    top: 5,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default AppHeader;
