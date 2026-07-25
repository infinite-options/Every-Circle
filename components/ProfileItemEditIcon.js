import React from "react";
import { Image, StyleSheet } from "react-native";

const EDIT_ICON = require("../assets/Edit.png");

/** Same pencil asset as Profile / Business Profile header edit — sized for inline card actions. */
export default function ProfileItemEditIcon({ size = 18, tintColor = "#9e4545", style }) {
  return <Image source={EDIT_ICON} style={[styles.icon, { width: size, height: size, tintColor }, style]} resizeMode='contain' />;
}

const styles = StyleSheet.create({
  icon: {},
});
