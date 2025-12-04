// StripeFeesDialog.js - Dialog to show Stripe processing fees
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from "react-native";
import { useDarkMode } from "../contexts/DarkModeContext";

const StripeFeesDialog = ({ show, setShow, onContinue, onCancel }) => {
  const { darkMode } = useDarkMode();

  return (
    <Modal animationType='fade' transparent={true} visible={show} onRequestClose={onCancel}>
      <View style={[styles.modalOverlay, darkMode && styles.darkModalOverlay]}>
        <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
          <Text style={[styles.title, darkMode && styles.darkTitle]}>Payment Processing Fees</Text>
          <Text style={[styles.message, darkMode && styles.darkMessage]}>An additional 3% will be charged as credit card processing fees</Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.button, styles.cancelButton, darkMode && styles.darkCancelButton]} onPress={onCancel}>
              <Text style={[styles.buttonText, styles.cancelButtonText, darkMode && styles.darkCancelButtonText]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.continueButton, darkMode && styles.darkContinueButton]} onPress={onContinue}>
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    ...(Platform.OS === "web" && {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9998,
    }),
  },
  darkModalOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "90%",
    maxWidth: 400,
    ...(Platform.OS === "web" && {
      position: "relative",
      zIndex: 9999,
    }),
  },
  darkModalContent: {
    backgroundColor: "#2d2d2d",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  darkTitle: {
    color: "#fff",
  },
  message: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
  },
  darkMessage: {
    color: "#ccc",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#F5F5F5",
    borderWidth: 2,
    borderColor: "#9C45F7",
  },
  darkCancelButton: {
    backgroundColor: "#404040",
    borderColor: "#7B35C7",
  },
  continueButton: {
    backgroundColor: "#9C45F7",
  },
  darkContinueButton: {
    backgroundColor: "#7B35C7",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  cancelButtonText: {
    color: "#9C45F7",
  },
  darkCancelButtonText: {
    color: "#7B35C7",
  },
});

export default StripeFeesDialog;

