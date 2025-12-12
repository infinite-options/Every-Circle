// WebTextInput.web.js - Web-only version (no React Native dependencies)
import React from "react";

// Web-compatible TextInput that uses native HTML input on web
const WebTextInput = ({ style, value, onChangeText, placeholder, keyboardType, inputMode, multiline, numberOfLines, textAlignVertical, placeholderTextColor, ...props }) => {
  // Filter out React Native-specific props that shouldn't be passed to DOM elements
  const {
    // Remove React Native-specific props
    secureTextEntry,
    autoCapitalize,
    autoCorrect,
    autoFocus,
    returnKeyType,
    ...domProps
  } = props;
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
    minHeight: style?.minHeight || "auto",
    textAlign: style?.textAlign || (multiline ? "left" : "center"),
    // Note: outline, WebkitAppearance, etc. are applied directly to the DOM element via React.createElement
    // They're not React Native style properties, so we apply them as HTML attributes
    boxSizing: "border-box",
    fontFamily: style?.fontFamily || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
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

  // Use textarea for multiline inputs, input for single-line
  if (multiline) {
    const textareaElement = React.createElement("textarea", {
      value: value || "",
      onChange: (e) => onChangeText && onChangeText(e.target.value),
      placeholder: placeholder,
      rows: numberOfLines || 4,
      style: {
        ...webStyle,
        outline: "none",
        resize: "vertical",
        fontFamily: style?.fontFamily || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        ...(placeholderTextColor && {
          // Use CSS custom property for placeholder color
          "--placeholder-color": placeholderTextColor,
        }),
      },
      ...domProps,
    });

    // Apply placeholder color via a style tag if needed
    if (placeholderTextColor) {
      const styleId = "webtextinput-placeholder-style";
      if (typeof document !== "undefined" && !document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
          textarea[style*="--placeholder-color"]::placeholder {
            color: var(--placeholder-color) !important;
          }
        `;
        document.head.appendChild(style);
      }
    }

    return textareaElement;
  }

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
      ...(placeholderTextColor && {
        "--placeholder-color": placeholderTextColor,
      }),
    },
    ...domProps,
  });

  // Apply placeholder color via a style tag if needed
  if (placeholderTextColor && typeof document !== "undefined") {
    const styleId = "webtextinput-placeholder-style-input";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        input[style*="--placeholder-color"]::placeholder {
          color: var(--placeholder-color) !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  return inputElement;
};

export default WebTextInput;
