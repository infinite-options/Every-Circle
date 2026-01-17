// ScannedProfilePopup.js - Popup to display scanned profile information
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDarkMode } from "../contexts/DarkModeContext";
import MiniCard from "./MiniCard";
import WebTextInput from "./WebTextInput";

const ScannedProfilePopup = ({ visible, profileData, onClose, onAddConnection }) => {
  const { darkMode } = useDarkMode();
  const [selectedRelationship, setSelectedRelationship] = useState("friend");
  const [event, setEvent] = useState("");
  const [note, setNote] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [introducedBy, setIntroducedBy] = useState("");

  // Reset form when popup closes
  useEffect(() => {
    if (!visible) {
      setSelectedRelationship("friend");
      setEvent("");
      setNote("");
      setCity("");
      setState("");
      setIntroducedBy("");
    }
  }, [visible]);

  if (!profileData) return null;

  const relationships = [
    { value: "friend", label: "Friend" },
    { value: "colleague", label: "Colleague" },
    { value: "family", label: "Family" },
  ];

  const handleAdd = () => {
    if (onAddConnection) {
      onAddConnection({
        relationship: selectedRelationship,
        event: event.trim(),
        note: note.trim(),
        city: city.trim(),
        state: state.trim(),
        introducedBy: introducedBy.trim(),
      });
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

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>Event:</Text>
              <WebTextInput
                style={[styles.textInput, darkMode && styles.darkTextInput]}
                value={event}
                onChangeText={setEvent}
                placeholder="Enter event name"
                placeholderTextColor={darkMode ? "#666" : "#999"}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>Note:</Text>
              <WebTextInput
                style={[styles.textInput, styles.textArea, darkMode && styles.darkTextInput]}
                value={note}
                onChangeText={setNote}
                placeholder="Enter notes or comments"
                placeholderTextColor={darkMode ? "#666" : "#999"}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputContainer, styles.inputHalf]}>
                <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>City:</Text>
                <WebTextInput
                  style={[styles.textInput, darkMode && styles.darkTextInput]}
                  value={city}
                  onChangeText={setCity}
                  placeholder="City"
                  placeholderTextColor={darkMode ? "#666" : "#999"}
                />
              </View>

              <View style={[styles.inputContainer, styles.inputHalf]}>
                <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>State:</Text>
                <WebTextInput
                  style={[styles.textInput, darkMode && styles.darkTextInput]}
                  value={state}
                  onChangeText={setState}
                  placeholder="State"
                  placeholderTextColor={darkMode ? "#666" : "#999"}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>Introduced By:</Text>
              <WebTextInput
                style={[styles.textInput, darkMode && styles.darkTextInput]}
                value={introducedBy}
                onChangeText={setIntroducedBy}
                placeholder="Who introduced you?"
                placeholderTextColor={darkMode ? "#666" : "#999"}
              />
            </View>
          </ScrollView>

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
    maxHeight: "85%",
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
  scrollView: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingBottom: 10,
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
  inputContainer: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  darkInputLabel: {
    color: "#fff",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#333",
    backgroundColor: "#fff",
  },
  darkTextInput: {
    borderColor: "#555",
    backgroundColor: "#333",
    color: "#fff",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
});

export default ScannedProfilePopup;
