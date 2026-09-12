import "react-native-gesture-handler";
import { registerRootComponent } from "expo";
import * as WebBrowser from "expo-web-browser";
import App from "./App";

const isWeb = typeof window !== "undefined" && typeof document !== "undefined";

// Required for expo-web-browser OAuth on web: popup return URL must call this so
// the opener receives postMessage with window.location (e.g. Apple /auth/.../callback?…).
if (isWeb) {
  try {
    WebBrowser.maybeCompleteAuthSession();
  } catch (e) {
    /* non-auth callbacks or no session in localStorage; safe to ignore */
  }
}

// On Camera → Chrome, #root is often shorter than the visible area, so a white
// body strip shows under the page. Size the root to the visual viewport and use
// the same page background — this is not a footer; it only fills that gap.
if (isWeb && typeof window !== "undefined" && typeof document !== "undefined") {
  const PAGE_BG = "#f6f7fb";
  const style = document.createElement("style");
  style.setAttribute("data-ec-viewport-fill", "1");
  style.textContent = `
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background-color: ${PAGE_BG};
    }
    #root {
      display: flex;
      flex-direction: column;
      width: 100%;
      background-color: ${PAGE_BG};
    }
  `;
  document.head.appendChild(style);

  const syncVisualViewportHeight = () => {
    const h = Math.max(1, Math.round(window.visualViewport?.height ?? window.innerHeight ?? 0));
    const px = `${h}px`;
    document.documentElement.style.minHeight = px;
    document.body.style.minHeight = px;
    document.body.style.backgroundColor = PAGE_BG;
    const root = document.getElementById("root");
    if (root) {
      root.style.minHeight = px;
      root.style.backgroundColor = PAGE_BG;
    }
  };

  syncVisualViewportHeight();
  window.visualViewport?.addEventListener?.("resize", syncVisualViewportHeight);
  window.addEventListener("resize", syncVisualViewportHeight);
  [50, 200, 500].forEach((ms) => setTimeout(syncVisualViewportHeight, ms));
}

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

registerRootComponent(App);
