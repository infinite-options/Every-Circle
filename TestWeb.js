// Simple test component to verify web rendering works
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function TestWeb() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Web Test - If you see this, React Native Web is working!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  text: {
    fontSize: 20,
    color: "#000",
  },
});

