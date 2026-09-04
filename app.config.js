const path = require("path");
const { config } = require("dotenv");

config({ path: path.resolve(__dirname, ".env") });

function firstNonEmpty(...values) {
  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

/** Native Android Maps SDK key (must match EXPO_PUBLIC_GOOGLE_API_KEY_ANDROID). */
function androidGoogleMapsApiKey() {
  return firstNonEmpty(
    process.env.EXPO_PUBLIC_GOOGLE_API_KEY_ANDROID,
    process.env.EXPO_PUBLIC_GOOGLE_API_KEY,
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
  );
}

module.exports = ({ config: expoConfig }) => ({
  expo: {
    owner: "pmarathay",
    name: process.env.EXPO_PUBLIC_APP_NAME,
    slug: process.env.EXPO_PUBLIC_APP_SLUG,
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,

    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },

    assetBundlePatterns: ["**/*"],

    ios: {
      supportsTablet: true,
      bundleIdentifier: process.env.EXPO_PUBLIC_BUNDLE_IDENTIFIER,

      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [process.env.EXPO_PUBLIC_GOOGLE_URL_SCHEME],
            CFBundleURLName: "google",
          },
        ],
        NSLocationWhenInUseUsageDescription: "This app needs access to location to show it on the map.",
        NSLocationAlwaysUsageDescription: "This app needs access to location to show it on the map.",
        NSPhotoLibraryUsageDescription:
          "everyCircle uses your photo library so you can add pictures to your profile and listings. For example, you can choose a headshot from your camera roll as your profile photo, or add product photos to a business offering.",
      },

      config: {
        usesNonExemptEncryption: false,
        googleServicesFile: "./GoogleService-Info.plist",
      },

      usesAppleSignIn: true,
      buildNumber: "2",
      deploymentTarget: "13.0",
    },

    android: {
      package: process.env.EXPO_PUBLIC_BUNDLE_IDENTIFIER,

      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },

      permissions: ["android.permission.ACCESS_COARSE_LOCATION", "android.permission.ACCESS_FINE_LOCATION", "android.permission.CAMERA"],

      config: {
        googleMaps: {
          apiKey: androidGoogleMapsApiKey(),
        },
      },
    },

    web: {
      favicon: "./assets/favicon.png",
      // bundler: "metro", // Let Expo choose the bundler
    },

    scheme: process.env.EXPO_PUBLIC_GOOGLE_URL_SCHEME,

    plugins: [
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_URL_SCHEME,
        },
      ],

      [
        "expo-build-properties",
        {
          ios: {
            // OPTIONAL:
            // useFrameworks: "static",
          },

          android: {
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            buildToolsVersion: "35.0.0",
            minSdkVersion: 24,
            ndkVersion: "25.1.8937393",
          },

          gradleProperties: {
            MAPS_API_KEY: androidGoogleMapsApiKey(),
            "android.builder.sdkDownload": "true",
          },
        },
      ],

      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow $(PRODUCT_NAME) to use your location.",
        },
      ],

      "expo-dev-client",
      "expo-font",
      "expo-web-browser",
      "expo-apple-authentication",
      [
        "expo-camera",
        {
          cameraPermission: "Allow $(PRODUCT_NAME) to use the camera to scan QR codes.",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "everyCircle uses your photo library so you can add pictures to your profile and listings. For example, you can choose a headshot from your camera roll as your profile photo, or add product photos to a business offering.",
        },
      ],
    ],

    extra: {
      eas: {
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      },

      androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID_DEBUG || process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID_RELEASE,

      iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID,

      webClientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID,

      appleServicesId: process.env.EXPO_PUBLIC_APPLE_SERVICES_ID,

      // ablyApiKey: process.env.EXPO_PUBLIC_ABLY_API_KEY,
    },
  },
});
