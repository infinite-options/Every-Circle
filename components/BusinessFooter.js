import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDarkMode } from "../contexts/DarkModeContext";

const BusinessFooter = ({ activeStep, onBack, onContinue, onSubmit, totalSteps = 5, submitDisabled = false }) => {
  const { darkMode } = useDarkMode();
  const isFirstStep = activeStep === 0;
  const isLastStep = activeStep === totalSteps - 1;
  const isSubmitBlocked = isLastStep && submitDisabled;

  return (
    <SafeAreaView edges={["bottom"]} style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
      <View style={[styles.footerContainer, darkMode && styles.darkFooterContainer]}>
        <View style={styles.buttonRow}>
          {!isFirstStep && (
            <TouchableOpacity style={[styles.backButton, darkMode && styles.darkBackButton]} onPress={onBack}>
              <Text style={[styles.buttonText, darkMode && styles.darkButtonText]}>Back</Text>
            </TouchableOpacity>
          )}
          {isLastStep ? (
            <TouchableOpacity
              style={[
                styles.submitButton,
                darkMode && styles.darkSubmitButton,
                isSubmitBlocked && styles.submitButtonDisabled,
                isSubmitBlocked && darkMode && styles.darkSubmitButtonDisabled,
              ]}
              onPress={isSubmitBlocked ? undefined : onSubmit}
              disabled={isSubmitBlocked}
              accessibilityState={{ disabled: isSubmitBlocked }}
            >
              <Text style={[styles.buttonText, darkMode && styles.darkButtonText, isSubmitBlocked && styles.buttonTextDisabled]}>Submit</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.continueButton, darkMode && styles.darkContinueButton]} onPress={onContinue}>
              <Text style={[styles.buttonText, darkMode && styles.darkButtonText]}>Continue</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "transparent",
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 70, // Position above BottomNavBar (approximately 60-70px height)
    zIndex: 101, // Above BottomNavBar (zIndex 100)
    width: "100%",
  },
  footerContainer: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: "100%",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 15,
    alignItems: "center",
  },
  backButton: {
    backgroundColor: "#333",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  continueButton: {
    backgroundColor: "#FF9500",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    backgroundColor: "#800000",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  // Dark mode styles
  darkSafeArea: {
    backgroundColor: "#1a1a1a",
  },
  darkFooterContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkBackButton: {
    backgroundColor: "#666",
  },
  darkContinueButton: {
    backgroundColor: "#FF9500",
  },
  darkSubmitButton: {
    backgroundColor: "#800000",
  },
  submitButtonDisabled: {
    backgroundColor: "#b0b0b0",
    opacity: 0.7,
  },
  darkSubmitButtonDisabled: {
    backgroundColor: "#555",
  },
  buttonTextDisabled: {
    color: "#e8e8e8",
  },
  darkButtonText: {
    color: "#ffffff",
  },
});

export default BusinessFooter;
