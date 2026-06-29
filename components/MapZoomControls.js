import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function MapZoomControls({ onZoomIn, onZoomOut }) {
  return (
    <View style={styles.zoomControls} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.zoomButton}
        onPress={onZoomIn}
        accessibilityRole="button"
        accessibilityLabel="Zoom in"
      >
        <Text style={styles.zoomButtonText}>+</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.zoomButton}
        onPress={onZoomOut}
        accessibilityRole="button"
        accessibilityLabel="Zoom out"
      >
        <Text style={styles.zoomButtonText}>−</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  zoomControls: {
    position: "absolute",
    right: 12,
    top: "50%",
    zIndex: 15,
    elevation: 15,
    transform: [{ translateY: -44 }],
  },
  zoomButton: {
    backgroundColor: "#ffffff",
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    ...(Platform.OS === "android" ? { elevation: 4 } : {}),
  },
  zoomButtonText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#333",
    lineHeight: 28,
  },
});
