# Dark Mode Implementation Guide

This app now supports a global dark mode that persists across all screens (except the Home page). Here's how to implement dark mode in your screens:

## 1. Import the Dark Mode Hook

```javascript
import { useDarkMode } from "../contexts/DarkModeContext";
```

## 2. Use the Hook in Your Component

```javascript
const YourScreen = () => {
  const { darkMode } = useDarkMode();

  // Your component logic here
};
```

## 3. Apply Dark Mode Styles

### Option A: Inline Styles with Conditional Classes

```javascript
<View style={[styles.container, darkMode && styles.darkContainer]}>
  <Text style={[styles.title, darkMode && styles.darkTitle]}>Your Title</Text>
</View>
```

### Option B: Using the Utility Function

```javascript
import { mergeDarkModeStyles } from "../utils/darkModeStyles";

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    padding: 20,
  },
  // ... other styles
});

// In your component:
const mergedStyles = mergeDarkModeStyles(styles, darkMode);

<View style={mergedStyles.container}>
  <Text style={mergedStyles.title}>Your Title</Text>
</View>;
```

## 4. Add Dark Mode Styles to Your Stylesheet

```javascript
const styles = StyleSheet.create({
  // Light mode styles
  container: {
    backgroundColor: "#fff",
    padding: 20,
  },
  title: {
    color: "#000",
    fontSize: 24,
  },

  // Dark mode styles
  darkContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkTitle: {
    color: "#ffffff",
  },
});
```

## 5. Common Dark Mode Color Palette

- **Primary Background**: `#1a1a1a` (dark) vs `#ffffff` (light)
- **Secondary Background**: `#2d2d2d` (dark) vs `#f5f5f5` (light)
- **Primary Text**: `#ffffff` (dark) vs `#000000` (light)
- **Secondary Text**: `#cccccc` (dark) vs `#666666` (light)
- **Borders**: `#404040` (dark) vs `#dddddd` (light)
- **Cards**: `#2d2d2d` (dark) vs `#ffffff` (light)

## 6. Example Implementation

```javascript
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useDarkMode } from "../contexts/DarkModeContext";

const ExampleScreen = () => {
  const { darkMode } = useDarkMode();

  return (
    <View style={[styles.container, darkMode && styles.darkContainer]}>
      <Text style={[styles.title, darkMode && styles.darkTitle]}>Welcome to Dark Mode!</Text>
      <Text style={[styles.subtitle, darkMode && styles.darkSubtitle]}>This text adapts to the theme</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },
  title: {
    fontSize: 24,
    color: "#000",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },

  // Dark mode styles
  darkContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkTitle: {
    color: "#ffffff",
  },
  darkSubtitle: {
    color: "#cccccc",
  },
});

export default ExampleScreen;
```

## 7. Important Notes

- **Home Page**: Dark mode is intentionally NOT applied to the Home page as per requirements
- **Persistence**: Dark mode setting is automatically saved to AsyncStorage and restored on app restart
- **Global State**: The dark mode state is shared across all screens through React Context
- **Performance**: Dark mode styles are applied efficiently with conditional rendering

## 8. Testing Dark Mode

1. Go to Settings → Toggle Dark Mode
2. Navigate to different screens to verify the theme persists
3. Restart the app to verify the setting is saved
4. Check that the Home page remains unaffected by dark mode

## 9. Troubleshooting

- **Dark mode not working**: Ensure your component is wrapped within the `DarkModeProvider` in App.js
- **Styles not applying**: Check that you're using the correct conditional syntax: `[styles.base, darkMode && styles.dark]`
- **Performance issues**: Avoid creating new style objects in render methods
