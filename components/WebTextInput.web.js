// WebTextInput.web.js - Web-only version (no React Native dependencies)
import React from "react";

// Web-compatible TextInput that uses native HTML input on web
const WebTextInput = ({ style, value, onChangeText, placeholder, keyboardType, inputMode, ...props }) => {
  // On web, use a native HTML input element
  const webStyle = {
    borderWidth: style?.borderWidth || 1,
    borderColor: style?.borderColor || "#ccc",
    borderRadius: style?.borderRadius || 8,
    padding: style?.padding || 8,
    paddingVertical: style?.paddingVertical || 8,
    paddingHorizontal: style?.paddingHorizontal || 4,
    backgroundColor: style?.backgroundColor || "#fff",
    color: style?.color || "#000",
    fontSize: style?.fontSize || 14,
    width: style?.width || "auto",
    height: style?.height || "auto",
    textAlign: style?.textAlign || "center",
    // Note: outline, WebkitAppearance, etc. are applied directly to the DOM element via React.createElement
    // They're not React Native style properties, so we apply them as HTML attributes
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  // Map keyboardType to input type
  const getInputType = () => {
    if (keyboardType === "numeric" || keyboardType === "number-pad" || keyboardType === "decimal-pad") {
      return "number";
    }
    if (keyboardType === "email-address") {
      return "email";
    }
    if (keyboardType === "phone-pad") {
      return "tel";
    }
    if (keyboardType === "url") {
      return "url";
    }
    return "text";
  };

  // Use React.createElement to avoid JSX issues with native HTML elements
  const inputElement = React.createElement("input", {
    type: getInputType(),
    value: value || "",
    onChange: (e) => onChangeText && onChangeText(e.target.value),
    placeholder: placeholder,
    inputMode: inputMode || (keyboardType === "numeric" ? "numeric" : undefined),
    style: {
      ...webStyle,
      outline: "none",
      WebkitAppearance: "none",
      MozAppearance: "textfield",
    },
    ...props,
  });
  
  return inputElement;
};

export default WebTextInput;

