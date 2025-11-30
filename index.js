import { registerRootComponent } from 'expo';

// Check if we're on web and if App fails to load
const isWeb = typeof window !== "undefined" && typeof document !== "undefined";

// Add global error handler for React Native Web text node errors
if (isWeb && typeof window !== "undefined") {
  const originalError = console.error;
  console.error = (...args) => {
    if (args[0] && typeof args[0] === "string" && args[0].includes("Unexpected text node")) {
      console.error("🚨🚨🚨 GLOBAL TEXT NODE ERROR CAUGHT 🚨🚨🚨");
      console.error("Full error:", ...args);
      console.trace("Stack trace:");
    }
    originalError.apply(console, args);
  };
}

let App;
try {
  App = require('./App').default;
} catch (error) {
  console.error("Failed to load App:", error);
  if (isWeb) {
    // Fallback to test component on web if App fails
    App = require('./TestWeb').default;
  } else {
    throw error;
  }
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
