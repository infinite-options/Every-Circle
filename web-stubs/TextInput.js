// TextInput stub for web - prevents bundling errors
import React from "react";

// Stub TextInput component for web that uses native HTML input
const TextInput = React.forwardRef(({ style, value, onChangeText, placeholder, keyboardType, ...props }, ref) => {
  const webStyle = {
    borderWidth: style?.borderWidth || 1,
    borderColor: style?.borderColor || "#ccc",
    borderRadius: style?.borderRadius || 8,
    padding: style?.padding || 8,
    paddingVertical: style?.paddingVertical || 8,
    paddingHorizontal: style?.paddingHorizontal || 12,
    backgroundColor: style?.backgroundColor || "#fff",
    color: style?.color || "#000",
    fontSize: style?.fontSize || 14,
    width: style?.width || "100%",
    height: style?.height || "auto",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

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

  return React.createElement("input", {
    ref: ref,
    type: getInputType(),
    value: value || "",
    onChange: (e) => onChangeText && onChangeText(e.target.value),
    placeholder: placeholder,
    style: {
      ...webStyle,
      outline: "none",
      WebkitAppearance: "none",
      MozAppearance: "textfield",
    },
    ...props,
  });
});

TextInput.displayName = "TextInput";

export default TextInput;

