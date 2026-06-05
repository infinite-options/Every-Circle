// ScannedProfilePopup.js - Popup to display scanned profile information
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, ScrollView, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDarkMode } from "../contexts/DarkModeContext";
import MiniCard from "./MiniCard";
import WebTextInput from "./WebTextInput";
import { parseDateTime } from "../utils/profileDateTime";

const REL_TYPES = ["friend", "colleague", "family"];
const SCREEN_HEIGHT = Dimensions.get("window").height;
const MOBILE_MODAL_MAX_HEIGHT = SCREEN_HEIGHT * 0.85;
const MOBILE_SCROLL_MAX_HEIGHT = MOBILE_MODAL_MAX_HEIGHT - 76;

let DateTimePicker = null;
if (Platform.OS !== "web") {
  try {
    DateTimePicker = require("@react-native-community/datetimepicker").default;
  } catch (e) {
    console.warn("DateTimePicker not available:", e.message);
  }
}

const getTodayCircleDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const formatCircleDateForDisplay = (dateStr) => {
  const { date } = parseDateTime(dateStr || "");
  if (!date) return "Select date";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

const circleDateToDate = (dateStr) => {
  const { date } = parseDateTime(dateStr || "");
  return date || new Date();
};

const dateToCircleDate = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return getTodayCircleDate();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const ScannedProfilePopup = ({ visible, profileData, onClose, onAddConnection, initialData = null, actionLabel = "Add to Network", title = "Connect With Me" }) => {
  const { darkMode } = useDarkMode();
  const [selectedRelationship, setSelectedRelationship] = useState("friend");
  const [event, setEvent] = useState("");
  const [note, setNote] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [introducedBy, setIntroducedBy] = useState("");
  const [date, setDate] = useState(getTodayCircleDate());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // QR flow: no initialData → default friend. Profile / edit flow: pass initialData; unknown/null → none selected.
  const normalizedRelationship = (() => {
    if (!initialData) return "friend";
    const r = initialData.relationship;
    if (r && REL_TYPES.includes(r)) return r;
    return null;
  })();

  // Initialize/reset form values when popup visibility changes
  useEffect(() => {
    if (visible) {
      setSelectedRelationship(normalizedRelationship);
      setEvent(initialData?.event || "");
      setNote(initialData?.note || "");
      setCity(initialData?.city || "");
      setState(initialData?.state || "");
      setIntroducedBy(initialData?.introducedBy || "");
      setDate(initialData?.date || getTodayCircleDate());
      setShowDatePicker(false);
    } else {
      setSelectedRelationship("friend");
      setEvent("");
      setNote("");
      setCity("");
      setState("");
      setIntroducedBy("");
      setDate(getTodayCircleDate());
      setShowDatePicker(false);
    }
  }, [visible, normalizedRelationship]);

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
        date: date.trim() || getTodayCircleDate(),
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
        <View style={[styles.modalContent, Platform.OS !== "web" && styles.modalContentMobile, darkMode && styles.darkModalContent]}>
          <View style={styles.header}>
            <Text style={[styles.title, darkMode && styles.darkTitle]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name='close' size={24} color={darkMode ? "#fff" : "#333"} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={Platform.OS === "web" ? undefined : styles.scrollViewMobile}
            contentContainerStyle={styles.scrollContent}
            scrollEnabled={Platform.OS !== "web"}
            showsVerticalScrollIndicator={Platform.OS !== "web"}
          >
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
                    onPress={() => setSelectedRelationship((prev) => (prev === rel.value ? null : rel.value))}
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
              <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>Date:</Text>
              {Platform.OS === "web" ? (
                <WebTextInput style={[styles.textInput, darkMode && styles.darkTextInput]} type='date' value={date} onChangeText={setDate} />
              ) : DateTimePicker ? (
                <>
                  <TouchableOpacity style={[styles.dateButton, darkMode && styles.darkDateButton]} onPress={() => setShowDatePicker(true)}>
                    <Text style={[styles.dateButtonText, darkMode && styles.darkDateButtonText]}>{formatCircleDateForDisplay(date)}</Text>
                    <Ionicons name='calendar-outline' size={18} color={darkMode ? "#aaa" : "#666"} />
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={circleDateToDate(date)}
                      mode='date'
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={(_, selectedDate) => {
                        if (Platform.OS === "android") setShowDatePicker(false);
                        if (selectedDate) setDate(dateToCircleDate(selectedDate));
                      }}
                    />
                  )}
                  {Platform.OS === "ios" && showDatePicker && (
                    <TouchableOpacity style={styles.datePickerDone} onPress={() => setShowDatePicker(false)}>
                      <Text style={styles.datePickerDoneText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <WebTextInput
                  style={[styles.textInput, darkMode && styles.darkTextInput]}
                  value={date}
                  onChangeText={setDate}
                  placeholder='YYYY-MM-DD'
                  placeholderTextColor={darkMode ? "#666" : "#999"}
                />
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>Event:</Text>
              <WebTextInput
                style={[styles.textInput, darkMode && styles.darkTextInput]}
                value={event}
                onChangeText={setEvent}
                placeholder='Enter event name'
                placeholderTextColor={darkMode ? "#666" : "#999"}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>Note:</Text>
              <WebTextInput
                style={[styles.textInput, styles.textArea, darkMode && styles.darkTextInput]}
                value={note}
                onChangeText={setNote}
                placeholder='Enter notes or comments'
                placeholderTextColor={darkMode ? "#666" : "#999"}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputContainer, styles.inputHalf]}>
                <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>City:</Text>
                <WebTextInput style={[styles.textInput, darkMode && styles.darkTextInput]} value={city} onChangeText={setCity} placeholder='City' placeholderTextColor={darkMode ? "#666" : "#999"} />
              </View>

              <View style={[styles.inputContainer, styles.inputHalf]}>
                <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>State:</Text>
                <WebTextInput
                  style={[styles.textInput, darkMode && styles.darkTextInput]}
                  value={state}
                  onChangeText={setState}
                  placeholder='State'
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
                placeholder='Who introduced you?'
                placeholderTextColor={darkMode ? "#666" : "#999"}
              />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
                <Text style={styles.addButtonText}>{actionLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.viewButton} onPress={onClose}>
                <Text style={[styles.viewButtonText, darkMode && styles.darkViewButtonText]}>Close</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
    boxShadow: "0px 2px 4px 0px rgba(0,0,0,0.25)",
    ...(Platform.OS !== "web" && { elevation: 5 }),
  },
  modalContentMobile: {
    maxHeight: MOBILE_MODAL_MAX_HEIGHT,
  },
  scrollViewMobile: {
    maxHeight: MOBILE_SCROLL_MAX_HEIGHT,
  },
  scrollContent: {
    paddingBottom: 4,
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
    marginTop: 4,
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
    textAlign: "left",
  },
  darkTextInput: {
    borderColor: "#555",
    backgroundColor: "#333",
    color: "#fff",
    textAlign: "left",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  darkDateButton: {
    borderColor: "#555",
    backgroundColor: "#333",
  },
  dateButtonText: {
    fontSize: 14,
    color: "#333",
  },
  darkDateButtonText: {
    color: "#fff",
  },
  datePickerDone: {
    alignSelf: "flex-end",
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  datePickerDoneText: {
    color: "#AF52DE",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ScannedProfilePopup;
