// ContinueButton.js
import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useDarkMode } from "../contexts/DarkModeContext";

export default function ContinueButton({ onNext, onBack, showBack = true }) {
  const { darkMode } = useDarkMode();

  return (
    <View style={styles.buttonRow}>
      {showBack && (
        <TouchableOpacity style={[styles.backButton, darkMode && styles.darkBackButton]} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={[styles.continueButton, darkMode && styles.darkContinueButton]} onPress={onNext}>
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 15,
    marginTop: 15,
    marginBottom: 20,
  },
  continueButton: {
    backgroundColor: "#FFA500",
    width: 80,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  continueButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  backButton: {
    backgroundColor: "#333",
    width: 80,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  darkBackButton: {
    backgroundColor: "#666",
  },
  darkContinueButton: {
    backgroundColor: "#555",
  },
});
