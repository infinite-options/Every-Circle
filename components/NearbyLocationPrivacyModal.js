import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DEFAULT_NEARBY_SETTINGS, persistNearbySettings, subscribeNearbySettings } from "../utils/nearbySettings";

const PRIMARY = "#4B2E83";

const SHARE_OPTIONS = [
  { key: "everyone", label: "Everyone (all app users)" },
  { key: "all_circles", label: "All Circle Members" },
  { key: "specific", label: "Specific Circles" },
];

const CIRCLE_TYPES = [
  { key: "friends", label: "Friends" },
  { key: "colleagues", label: "Colleagues" },
  { key: "family", label: "Family" },
];

export default function NearbyLocationPrivacyModal({ visible, onClose, darkMode, onSettingsChange }) {
  const [settings, setSettings] = useState(DEFAULT_NEARBY_SETTINGS);

  useEffect(() => {
    if (!visible) return undefined;
    return subscribeNearbySettings(setSettings);
  }, [visible]);

  const updateSettings = (next) => {
    setSettings(next);
    void persistNearbySettings(next);
    onSettingsChange?.(next);
  };

  return (
    <Modal visible={visible} transparent animationType='slide' onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
          <Text style={[styles.title, darkMode && styles.titleDark]}>Location Privacy</Text>
          <Text style={[styles.subtitle, darkMode && styles.subtitleDark]}>Control who can see your location and who you get notified about.</Text>

          <Text style={[styles.groupLabel, darkMode && styles.groupLabelDark, { marginTop: 8 }]}>Share My Location With</Text>
          {SHARE_OPTIONS.map(({ key, label }) => (
            <TouchableOpacity key={key} style={styles.optionRow} onPress={() => updateSettings({ ...settings, shareWith: key })} activeOpacity={0.7}>
              <Ionicons name={settings.shareWith === key ? "radio-button-on" : "radio-button-off"} size={18} color={PRIMARY} style={{ marginRight: 10 }} />
              <Text style={[styles.optionText, darkMode && styles.optionTextDark]}>{label}</Text>
            </TouchableOpacity>
          ))}
          {settings.shareWith === "specific" && (
            <View style={styles.checkboxGroup}>
              {CIRCLE_TYPES.map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={styles.checkboxRow}
                  onPress={() =>
                    updateSettings({
                      ...settings,
                      shareWithTypes: { ...settings.shareWithTypes, [key]: !settings.shareWithTypes[key] },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <Ionicons name={settings.shareWithTypes[key] ? "checkbox" : "square-outline"} size={17} color={PRIMARY} style={{ marginRight: 10 }} />
                  <Text style={[styles.optionText, darkMode && styles.optionTextDark]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={[styles.divider, darkMode && styles.dividerDark]} />
          <Text style={[styles.groupLabel, darkMode && styles.groupLabelDark]}>Receive Notifications From</Text>
          {SHARE_OPTIONS.map(({ key, label }) => (
            <TouchableOpacity key={key} style={styles.optionRow} onPress={() => updateSettings({ ...settings, receiveFrom: key })} activeOpacity={0.7}>
              <Ionicons name={settings.receiveFrom === key ? "radio-button-on" : "radio-button-off"} size={18} color={PRIMARY} style={{ marginRight: 10 }} />
              <Text style={[styles.optionText, darkMode && styles.optionTextDark]}>{label}</Text>
            </TouchableOpacity>
          ))}
          {settings.receiveFrom === "specific" && (
            <View style={styles.checkboxGroup}>
              {CIRCLE_TYPES.map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={styles.checkboxRow}
                  onPress={() =>
                    updateSettings({
                      ...settings,
                      receiveFromTypes: { ...settings.receiveFromTypes, [key]: !settings.receiveFromTypes[key] },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <Ionicons name={settings.receiveFromTypes[key] ? "checkbox" : "square-outline"} size={17} color={PRIMARY} style={{ marginRight: 10 }} />
                  <Text style={[styles.optionText, darkMode && styles.optionTextDark]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity onPress={onClose} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Done</Text>
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
  groupLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#555",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 4,
    alignSelf: "stretch",
  },
  groupLabelDark: {
    color: "#ccc",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingLeft: 4,
    alignSelf: "stretch",
  },
  optionText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  optionTextDark: {
    color: "#ccc",
  },
  checkboxGroup: {
    paddingLeft: 28,
    marginTop: 2,
    marginBottom: 4,
    alignSelf: "stretch",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    marginVertical: 10,
    alignSelf: "stretch",
  },
  dividerDark: {
    borderBottomColor: "#555",
  },
  doneButton: {
    marginTop: 20,
    alignSelf: "stretch",
    backgroundColor: PRIMARY,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  doneButtonText: {
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  },
});
