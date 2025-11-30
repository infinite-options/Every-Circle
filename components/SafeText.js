/**
 * SafeText Component
 * 
 * A wrapper component that ensures text is always safely rendered.
 * Prevents "Unexpected text node" errors by:
 * 1. Sanitizing all text values
 * 2. Returning null if text is invalid
 * 3. Always wrapping text in a <Text> component
 */

import React from "react";
import { Text } from "react-native";
import { sanitizeText } from "../utils/textSanitizer";

/**
 * SafeText - Safely renders text, preventing "Unexpected text node" errors
 * @param {any} children - The text content to render
 * @param {string} fallback - Fallback text if children is invalid (default: null, renders nothing)
 * @param {object} style - Style object to apply to Text component
 * @param {object} ...props - Other props to pass to Text component
 * @returns {JSX.Element|null} - Text component or null
 */
const SafeText = ({ children, fallback = null, style, ...props }) => {
  // Handle different types of children
  let textValue = null;
  
  if (children === null || children === undefined) {
    textValue = fallback;
  } else if (typeof children === "string") {
    textValue = sanitizeText(children, fallback);
  } else if (typeof children === "number") {
    textValue = sanitizeText(String(children), fallback);
  } else {
    // For other types, convert to string and sanitize
    textValue = sanitizeText(String(children), fallback);
  }
  
  // If no valid text, return null (don't render anything)
  if (!textValue || textValue === "." || textValue.trim() === "") {
    return null;
  }
  
  return <Text style={style} {...props}>{textValue}</Text>;
};

export default SafeText;

