import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { NEARBY_LOCATION_PICKER_OPTIONS, updateNearbyLocationFromOption } from "../utils/nearbyLocationUpdate";

const PRIMARY = "#4B2E83";

export default function NearbyLocationPickerModal({ visible, onClose, darkMode, onLocationUpdated }) {
  const [updating, setUpdating] = useState(null);

  const handleSelect = async (option) => {
    setUpdating(option.name);
    try {
      const coords = await updateNearbyLocationFromOption(option);
      if (coords) {
        onLocationUpdated?.(coords);
        onClose();
      }
    } finally {
      setUpdating(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType='slide' onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
          <Text style={[styles.title, darkMode && styles.titleDark]}>Choose Nearby Location</Text>
          <Text style={[styles.subtitle, darkMode && styles.subtitleDark]}>
            Updates your temporary nearby location (expires in 1 hour).{"\n"}A & B: SF (nearby) · C: SF ~5 mi · D: San Diego · E: Austin · F: Toronto
          </Text>

          {NEARBY_LOCATION_PICKER_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.name}
              style={[styles.optionRow, darkMode && styles.optionRowDark]}
              onPress={() => handleSelect(option)}
              disabled={updating !== null}
              activeOpacity={0.7}
            >
              <MaterialIcons name={option.name === "Live GPS" ? "gps-fixed" : "location-on"} size={20} color={PRIMARY} style={{ marginRight: 10 }} />
              <Text style={[styles.optionText, darkMode && styles.optionTextDark]}>{option.name}</Text>
              {updating === option.name && <ActivityIndicator size='small' color={PRIMARY} style={{ marginLeft: "auto" }} />}
            </TouchableOpacity>
          ))}

          <TouchableOpacity onPress={onClose} style={styles.cancelButton} disabled={updating !== null}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 14,
    alignItems: "center",
    width: "88%",
  },
  modalBoxDark: {
    backgroundColor: "#333",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 6,
    textAlign: "center",
  },
  titleDark: {
    color: "#fff",
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
  },
  subtitleDark: {
    color: "#ccc",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    marginBottom: 8,
    alignSelf: "stretch",
  },
  optionRowDark: {
    backgroundColor: "#2d2d2d",
  },
  optionText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  optionTextDark: {
    color: "#fff",
  },
  cancelButton: {
    marginTop: 16,
    alignSelf: "stretch",
    backgroundColor: PRIMARY,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  },
});
