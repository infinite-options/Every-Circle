// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Custom resolver to alias TextInput on web
const defaultResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, realModuleName, platform, moduleName) => {
  // On web, redirect TextInput-related imports to our stubs
  if (platform === "web") {
    if (realModuleName && realModuleName.includes("TextInput/TextInput")) {
      return {
        filePath: path.resolve(__dirname, "web-stubs/TextInput.js"),
        type: "sourceFile",
      };
    }
    if (realModuleName && realModuleName.includes("TextInput/TextInputState")) {
      return {
        filePath: path.resolve(__dirname, "web-stubs/TextInputState.js"),
        type: "sourceFile",
      };
    }
  }

  // Use default resolver for everything else
  if (defaultResolver) {
    return defaultResolver(context, realModuleName, platform, moduleName);
  }
  return context.resolveRequest(context, realModuleName, platform);
};

module.exports = config;
