import Constants from "expo-constants";

/**
 * Resolve EXPO_PUBLIC_ENCRYPTION_ON for app code.
 * app.config.js loads .env via dotenv; Metro may not inline process.env in all runtimes (web/dev-client).
 * Fall back to expo.extra, which is always set at build time from app.config.js.
 */
export function isEncryptionOn() {
  const fromProcess = process.env.EXPO_PUBLIC_ENCRYPTION_ON;
  if (fromProcess === "true") return true;
  if (fromProcess === "false") return false;

  const extra = Constants.expoConfig?.extra ?? Constants.manifest2?.extra ?? Constants.manifest?.extra ?? {};
  if (extra.encryptionOn === true || extra.EXPO_PUBLIC_ENCRYPTION_ON === "true") {
    return true;
  }
  return false;
}

export const encryptionON = isEncryptionOn();

if (__DEV__) {
  console.log(
    "[encryptionEnv] process.env.EXPO_PUBLIC_ENCRYPTION_ON =",
    process.env.EXPO_PUBLIC_ENCRYPTION_ON,
    "| resolved encryptionON =",
    encryptionON
  );
}
