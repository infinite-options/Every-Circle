// ScannedProfilePopup.js - Popup to display scanned profile information
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDarkMode } from "../contexts/DarkModeContext";
import MiniCard from "./MiniCard";

const ScannedProfilePopup = ({ visible, profileData, onClose, onAddConnection }) => {
  const { darkMode } = useDarkMode();
  const [selectedRelationship, setSelectedRelationship] = useState("friend");

  if (!profileData) return null;

  const relationships = [
    { value: "friend", label: "Friend" },
    { value: "colleague", label: "Colleague" },
    { value: "family", label: "Family" },
  ];

  const handleAdd = () => {
    if (onAddConnection) {
      onAddConnection(selectedRelationship);
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType='fade' onRequestClose={onClose}>
      <View style={[styles.modalOverlay, darkMode && styles.darkModalOverlay]}>
        <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
          <View style={styles.header}>
            <Text style={[styles.title, darkMode && styles.darkTitle]}>Scanned Profile</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name='close' size={24} color={darkMode ? "#fff" : "#333"} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <MiniCard user={profileData} />
          </View>

          <View style={styles.relationshipContainer}>
            <Text style={[styles.relationshipLabel, darkMode && styles.darkRelationshipLabel]}>Relationship:</Text>
            <View style={styles.relationshipButtons}>
              {relationships.map((rel) => (
                <TouchableOpacity
                  key={rel.value}
                  style={[
                    styles.relationshipButton,
                    selectedRelationship === rel.value && styles.relationshipButtonActive,
                    darkMode && styles.darkRelationshipButton,
                    selectedRelationship === rel.value && darkMode && styles.darkRelationshipButtonActive,
                  ]}
                  onPress={() => setSelectedRelationship(rel.value)}
                >
                  <Text
                    style={[
                      styles.relationshipButtonText,
                      selectedRelationship === rel.value && styles.relationshipButtonTextActive,
                      darkMode && styles.darkRelationshipButtonText,
                      selectedRelationship === rel.value && darkMode && styles.darkRelationshipButtonTextActive,
                    ]}
                  >
                    {rel.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
              <Text style={styles.addButtonText}>Add to Network</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.viewButton} onPress={onClose}>
              <Text style={[styles.viewButtonText, darkMode && styles.darkViewButtonText]}>Close</Text>
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
    padding: 20,
  },
  darkModalOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
      },
      default: {
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
    }),
  },
  darkModalContent: {
    backgroundColor: "#2a2a2a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  darkTitle: {
    color: "#fff",
  },
  closeButton: {
    padding: 4,
  },
  content: {
    marginBottom: 20,
  },
  buttonContainer: {
    gap: 12,
  },
  addButton: {
    backgroundColor: "#AF52DE",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  viewButton: {
    backgroundColor: "transparent",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#AF52DE",
  },
  viewButtonText: {
    color: "#AF52DE",
    fontSize: 16,
    fontWeight: "600",
  },
  darkViewButtonText: {
    color: "#a78bfa",
    borderColor: "#a78bfa",
  },
  relationshipContainer: {
    marginBottom: 20,
  },
  relationshipLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  darkRelationshipLabel: {
    color: "#fff",
  },
  relationshipButtons: {
    flexDirection: "row",
    gap: 8,
  },
  relationshipButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  relationshipButtonActive: {
    backgroundColor: "#AF52DE",
    borderColor: "#AF52DE",
  },
  darkRelationshipButton: {
    backgroundColor: "#333",
    borderColor: "#555",
  },
  darkRelationshipButtonActive: {
    backgroundColor: "#AF52DE",
    borderColor: "#AF52DE",
  },
  relationshipButtonText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  relationshipButtonTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  darkRelationshipButtonText: {
    color: "#aaa",
  },
  darkRelationshipButtonTextActive: {
    color: "#fff",
  },
});

export default ScannedProfilePopup;
