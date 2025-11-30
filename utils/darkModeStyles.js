// Common dark mode styles that can be used across different screens
export const getDarkModeStyles = (darkMode) => ({
  // Container styles
  container: darkMode
    ? {
        backgroundColor: "#1a1a1a",
      }
    : {},

  // Text styles
  text: darkMode
    ? {
        color: "#ffffff",
      }
    : {},

  title: darkMode
    ? {
        color: "#ffffff",
      }
    : {},

  subtitle: darkMode
    ? {
        color: "#cccccc",
      }
    : {},

  // Card styles
  card: darkMode
    ? {
        backgroundColor: "#2d2d2d",
        borderColor: "#404040",
      }
    : {},

  // Input styles
  input: darkMode
    ? {
        backgroundColor: "#2d2d2d",
        color: "#ffffff",
        borderColor: "#404040",
      }
    : {},

  // Button styles
  button: darkMode
    ? {
        backgroundColor: "#404040",
      }
    : {},

  buttonText: darkMode
    ? {
        color: "#ffffff",
      }
    : {},

  // Header styles
  header: darkMode
    ? {
        backgroundColor: "#1a1a1a",
      }
    : {},

  headerText: darkMode
    ? {
        color: "#ffffff",
      }
    : {},

  // Safe area styles
  safeArea: darkMode
    ? {
        backgroundColor: "#1a1a1a",
      }
    : {},

  // Background styles
  background: darkMode
    ? {
        backgroundColor: "#1a1a1a",
      }
    : {},

  // Border styles
  border: darkMode
    ? {
        borderColor: "#404040",
      }
    : {},

  // Icon styles
  icon: darkMode
    ? {
        tintColor: "#ffffff",
      }
    : {},
});

// Helper function to merge dark mode styles with existing styles
export const mergeDarkModeStyles = (baseStyles, darkMode) => {
  if (!darkMode) return baseStyles;

  const darkStyles = getDarkModeStyles(darkMode);
  const mergedStyles = {};

  // Merge base styles with dark mode styles
  Object.keys(baseStyles).forEach((key) => {
    if (darkStyles[key]) {
      mergedStyles[key] = { ...baseStyles[key], ...darkStyles[key] };
    } else {
      mergedStyles[key] = baseStyles[key];
    }
  });

  // Add any additional dark mode styles that don't exist in base
  Object.keys(darkStyles).forEach((key) => {
    if (!mergedStyles[key]) {
      mergedStyles[key] = darkStyles[key];
    }
  });

  return mergedStyles;
};
