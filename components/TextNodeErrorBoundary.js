/**
 * TextNodeErrorBoundary
 * 
 * Catches "Unexpected text node" errors and provides detailed debugging information
 * to help identify the exact component and props causing the issue.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";

class TextNodeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorInfo: null, error: null };
  }

  static getDerivedStateFromError(error) {
    // Check if this is a text node error
    if (error && error.message && error.message.includes("Unexpected text node")) {
      return { hasError: true, error };
    }
    return null;
  }

  componentDidCatch(error, errorInfo) {
    // Log detailed error information
    if (error && error.message && error.message.includes("Unexpected text node")) {
      console.error("🚨🚨🚨 TEXT NODE ERROR DETECTED 🚨🚨🚨");
      console.error("Error message:", error.message);
      console.error("Error object:", error);
      console.error("Error Info:", errorInfo);
      console.error("Full Component Stack:", errorInfo.componentStack);
      
      // Try to extract component names from the stack
      const componentMatches = errorInfo.componentStack?.matchAll(/at (\w+)/g);
      if (componentMatches) {
        const components = Array.from(componentMatches).map(m => m[1]);
        console.error("Components in stack:", components);
        console.error("Most likely culprit:", components[0] || "Unknown");
      }
      
      // Log the exact text node value if available
      const textNodeMatch = error.message.match(/Unexpected text node: (.*?)\./);
      if (textNodeMatch) {
        console.error("⚠️ PROBLEMATIC TEXT NODE VALUE:", JSON.stringify(textNodeMatch[1]));
        console.error("⚠️ Text node character codes:", textNodeMatch[1].split('').map(c => c.charCodeAt(0)));
      }
      
      // Log props if available
      if (this.props.children) {
        console.error("Children props:", this.props.children);
      }
      
      // Force a more detailed stack trace
      console.trace("Full stack trace:");
      
      this.setState({ errorInfo, error });
    }
  }

  render() {
    if (this.state.hasError) {
      // In development, show detailed error info
      if (__DEV__) {
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Text Node Error Detected</Text>
            <Text style={styles.errorText}>{this.state.error?.message}</Text>
            <Text style={styles.errorStack}>
              {this.state.errorInfo?.componentStack?.split("\n").slice(0, 5).join("\n")}
            </Text>
            <Text style={styles.errorHint}>
              Check console for detailed component and props information
            </Text>
          </View>
        );
      }
      // In production, return null to prevent crash
      return null;
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    padding: 20,
    backgroundColor: "#ffebee",
    borderWidth: 2,
    borderColor: "#f44336",
    borderRadius: 8,
    margin: 10,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#d32f2f",
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    color: "#c62828",
    marginBottom: 10,
  },
  errorStack: {
    fontSize: 12,
    color: "#666",
    fontFamily: "monospace",
    marginBottom: 10,
  },
  errorHint: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
});

export default TextNodeErrorBoundary;

