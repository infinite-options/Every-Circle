// WebTextInput.js - Native version (uses React Native TextInput)
import React from "react";
import { TextInput } from "react-native";

// Native version - just re-export TextInput with same API
const WebTextInput = React.forwardRef(({ style, value, onChangeText, placeholder, keyboardType, ...props }, ref) => {
  return <TextInput ref={ref} style={style} value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} {...props} />;
});

WebTextInput.displayName = "WebTextInput";

export default WebTextInput;
