/**
 * SafeView Component
 * 
 * A wrapper around View that automatically sanitizes all text children
 * to prevent "Unexpected text node" errors.
 */

import React from "react";
import { View } from "react-native";
import { sanitizeText } from "../utils/textSanitizer";

/**
 * Recursively sanitizes React children to ensure no text nodes are direct children of View
 */
const sanitizeChildren = (children) => {
  if (children == null) {
    return null;
  }

  // Handle arrays
  if (Array.isArray(children)) {
    return children
      .map((child) => sanitizeChildren(child))
      .filter((child) => child !== null && child !== undefined);
  }

  // Handle strings - these should NEVER be direct children of View
  if (typeof children === "string") {
    const sanitized = sanitizeText(children);
    if (!sanitized || sanitized === "." || sanitized.trim() === "") {
      console.warn("⚠️ SafeView: Filtered out invalid text node:", children);
      return null;
    }
    // Return null - strings should be wrapped in Text components, not rendered directly
    console.warn("⚠️ SafeView: String detected as direct child, should be wrapped in <Text>:", children);
    return null;
  }

  // Handle numbers - convert to string and check
  if (typeof children === "number") {
    const sanitized = sanitizeText(String(children));
    if (!sanitized || sanitized === ".") {
      return null;
    }
    // Numbers should also be wrapped in Text
    console.warn("⚠️ SafeView: Number detected as direct child, should be wrapped in <Text>:", children);
    return null;
  }

  // Handle React elements - recursively sanitize their children
  if (React.isValidElement(children)) {
    // If it's already a Text component, it's safe
    if (children.type && (children.type.displayName === "Text" || children.type === "Text")) {
      return children;
    }

    // For other components, recursively sanitize children
    if (children.props && children.props.children) {
      return React.cloneElement(children, {
        ...children.props,
        children: sanitizeChildren(children.props.children),
      });
    }

    return children;
  }

  // For other types, return as-is
  return children;
};

/**
 * SafeView - A View component that automatically sanitizes children
 */
const SafeView = ({ children, ...props }) => {
  const sanitizedChildren = sanitizeChildren(children);
  return <View {...props}>{sanitizedChildren}</View>;
};

export default SafeView;

