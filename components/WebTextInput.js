// WebTextInput.js - Native version (uses React Native TextInput)
import React from "react";
import { TextInput } from "react-native";

// Native version - just re-export TextInput with same API
const WebTextInput = ({ style, value, onChangeText, placeholder, keyboardType, ...props }) => {
  return (
    <TextInput
      style={style}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType={keyboardType}
      {...props}
    />
  );
};

export default WebTextInput;
