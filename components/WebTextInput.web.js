// WebTextInput.web.js - Web-only version (no React Native dependencies)
import React from "react";

// Flatten RN-style arrays / nested styles so backgroundColor etc. actually apply on web.
function flattenStyle(style) {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce((acc, item) => Object.assign(acc, flattenStyle(item)), {});
  }
  return typeof style === "object" ? style : {};
}

// Inject global CSS to remove native input styling when borderless (used for inputs that sit inside styled wrappers)
function ensureBorderlessStyles() {
  const BORDERLESS_STYLE_ID = "webtextinput-borderless-style";
  if (typeof document !== "undefined" && document.head && !document.getElementById(BORDERLESS_STYLE_ID)) {
    const style = document.createElement("style");
    style.id = BORDERLESS_STYLE_ID;
    style.textContent = `
      input.webtextinput-borderless, textarea.webtextinput-borderless,
      input[data-borderless="true"], textarea[data-borderless="true"] {
        border: none !important;
        border-width: 0 !important;
        box-shadow: none !important;
        -webkit-box-shadow: none !important;
        outline: none !important;
        background: transparent !important;
        -webkit-appearance: none !important;
        -moz-appearance: none !important;
        appearance: none !important;
      }
      input.webtextinput-borderless:focus, textarea.webtextinput-borderless:focus,
      input.webtextinput-borderless:active, textarea.webtextinput-borderless:active,
      input[data-borderless="true"]:focus, input[data-borderless="true"]:active {
        border: none !important;
        box-shadow: none !important;
        outline: none !important;
      }
      input.webtextinput-borderless[type=number]::-webkit-outer-spin-button,
      input.webtextinput-borderless[type=number]::-webkit-inner-spin-button {
        -webkit-appearance: none !important;
        margin: 0 !important;
      }
      input.webtextinput-borderless[type=number] {
        -moz-appearance: textfield !important;
      }
    `;
    document.head.appendChild(style);
  }
}

// Web-compatible TextInput that uses native HTML input on web
const WebTextInput = ({ style, value, onChangeText, placeholder, keyboardType, inputMode, multiline, numberOfLines, textAlignVertical, placeholderTextColor, borderless, ...props }) => {
  // Ensure borderless CSS is injected before first borderless input renders
  if (borderless && typeof document !== "undefined") {
    ensureBorderlessStyles();
  }
  // Filter out React Native–specific props (they are not valid HTML attributes; passing them
  // to <input> / <textarea> triggers "React does not recognize the `accessibilityHint` prop…" on web).
  const {
    secureTextEntry,
    autoCapitalize,
    autoCorrect,
    autoFocus,
    returnKeyType,
    accessibilityActions,
    accessibilityElementsHidden,
    accessibilityHint,
    accessibilityIgnoresInvertColors,
    accessibilityLabel,
    accessibilityLanguage,
    accessibilityLiveRegion,
    accessibilityRole,
    accessibilityState,
    accessibilityValue,
    accessible,
    onAccessibilityAction,
    onAccessibilityTap,
    onMagicTap,
    onAccessibilityEscape,
    testID,
    underlineColorAndroid,
    selectionColor,
    showSoftInputOnFocus,
    allowFontScaling,
    maxFontSizeMultiplier,
    caretHidden,
    contextMenuHidden,
    editable,
    selectTextOnFocus,
    dataDetectorType,
    dataDetectorTypes,
    inputAccessoryViewID,
    rejectResponderTermination,
    scrollEnabled,
    submitBehavior,
    lineBreakStrategyIOS,
    lineBreakModeIOS,
    ...domProps
  } = props;  // On web, use a native HTML input element

  // Map RN a11y to standard HTML.
  const a11yForDom = {
    ...(accessibilityLabel != null && typeof accessibilityLabel === "string" && accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
    ...(accessibilityHint != null && typeof accessibilityHint === "string" && accessibilityHint ? { title: accessibilityHint } : {}),
  };
  // On web, use a native HTML input element
  const flatStyle = flattenStyle(style);
  const solidBackground = flatStyle.backgroundColor || "#fff";
  const webStyle = {
    borderWidth: flatStyle.borderWidth || 1,
    borderColor: flatStyle.borderColor || "#ccc",
    borderRadius: flatStyle.borderRadius || 8,
    padding: flatStyle.padding || 8,
    paddingVertical: flatStyle.paddingVertical || 8,
    paddingHorizontal: flatStyle.paddingHorizontal || 4,
    // Use both background + backgroundColor so browsers can't keep a default gradient (e.g. date inputs).
    background: solidBackground,
    backgroundImage: "none",
    backgroundColor: solidBackground,
    color: flatStyle.color || "#000",
    fontSize: flatStyle.fontSize || 14,
    width: flatStyle.width || "auto",
    height: flatStyle.height || "auto",
    minHeight: flatStyle.minHeight || "auto",
    textAlign: flatStyle.textAlign || "left",
    // Note: outline, WebkitAppearance, etc. are applied directly to the DOM element via React.createElement
    // They're not React Native style properties, so we apply them as HTML attributes
    boxSizing: "border-box",
    fontFamily: flatStyle.fontFamily || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  };

  // Map keyboardType to input type
  // When borderless, use "text" + inputMode="numeric" to avoid number input's stubborn browser styling (inset shadow, etc.)
  const getInputType = () => {
    if (borderless && (keyboardType === "numeric" || keyboardType === "number-pad" || keyboardType === "decimal-pad")) {
      return "text";
    }
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
        fontFamily: flatStyle.fontFamily || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        ...(placeholderTextColor && {
          // Use CSS custom property for placeholder color
          "--placeholder-color": placeholderTextColor,
        }),
      },
      ...domProps,
      ...a11yForDom,
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
  // When borderless, input sits inside a styled wrapper - CSS with !important overrides native styling
  const inputStyle = borderless
    ? {
        ...webStyle,
        border: "none",
        boxShadow: "none",
        outline: "none",
        background: "transparent",
        backgroundImage: "none",
        backgroundColor: "transparent",
        width: "100%",
        paddingVertical: flatStyle.paddingVertical ?? 0,
        paddingHorizontal: flatStyle.paddingHorizontal ?? 0,
        fontSize: flatStyle.fontSize ?? 14,
        color: flatStyle.color ?? "#333",
        lineHeight: flatStyle.lineHeight ?? 18,
        height: flatStyle.height ?? 18,
        minHeight: flatStyle.minHeight ?? 18,
        ...(placeholderTextColor && { "--placeholder-color": placeholderTextColor }),
      }
    : {
        ...webStyle,
        outline: "none",
        boxShadow: "none",
        WebkitAppearance: "none",
        MozAppearance: "none",
        appearance: "none",
        ...(placeholderTextColor && { "--placeholder-color": placeholderTextColor }),
      };

  const inputElement = React.createElement("input", {
    type: getInputType(),
    value: value || "",
    onChange: (e) => onChangeText && onChangeText(e.target.value),
    placeholder: placeholder,
    inputMode: inputMode || (keyboardType === "numeric" ? "numeric" : undefined),
    className: borderless ? "webtextinput-borderless" : undefined,
    "data-borderless": borderless ? "true" : undefined,
    style: inputStyle,
    ...domProps,
    ...a11yForDom,
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
