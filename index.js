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

// Camera → mobile Chrome often leaves a blank white strip under #root because the
// layout viewport height doesn't match the visible area. Size the root to the
// visualViewport and match the scan-page background so that strip disappears.
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
      overflow: hidden;
    }
    #root {
      display: flex;
      flex-direction: column;
      width: 100%;
      background-color: ${PAGE_BG};
      overflow: hidden;
    }
  `;
  document.head.appendChild(style);

  const syncVisualViewportHeight = () => {
    const h = Math.max(1, Math.round(window.visualViewport?.height ?? window.innerHeight ?? 0));
    const px = `${h}px`;
    document.documentElement.style.height = px;
    document.documentElement.style.minHeight = px;
    document.body.style.height = px;
    document.body.style.minHeight = px;
    const root = document.getElementById("root");
    if (root) {
      root.style.height = px;
      root.style.minHeight = px;
    }
  };

  syncVisualViewportHeight();
  window.visualViewport?.addEventListener?.("resize", syncVisualViewportHeight);
  window.visualViewport?.addEventListener?.("scroll", syncVisualViewportHeight);
  window.addEventListener("resize", syncVisualViewportHeight);
  window.addEventListener("orientationchange", syncVisualViewportHeight);
  [50, 200, 500, 1000].forEach((ms) => setTimeout(syncVisualViewportHeight, ms));
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
