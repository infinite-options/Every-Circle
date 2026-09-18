import { Alert } from "react-native";
import { publishNewConnectionOpened } from "./publishNewConnectionOpened";
import { resolveScannerProfileUid } from "./ensureSessionProfileUid";

/** @deprecated Use navigation.navigate("ConnectWithMe", { profileUid, mode: "scan" }) instead. */
export function networkScanConnectParams(scannedProfileUid) {
  return {
    scannedProfileUid,
    scanConnectToken: Date.now(),
  };
}

/**
 * Navigate to Connect With Me for a scan connect flow and notify the QR owner (Exchange Contact Info).
 * @param {import("@react-navigation/native").NavigationProp<any>} navigation
 * @param {string} scannedProfileUid - profile_uid of the QR owner to connect with
 * @param {{ scannerIsNewSignup?: boolean }} [options] - when true, QR owner stays on Connect with Me after Add to Network
 */
export async function goToNetworkForScanConnect(navigation, scannedProfileUid, options = {}) {
  if (!scannedProfileUid) return;

  const scannerProfileUid = await resolveScannerProfileUid();

  if (scannerProfileUid && scannerProfileUid === scannedProfileUid) {
    Alert.alert("That's your QR", "You cannot add yourself as a connection.");
    return;
  }

  navigation.navigate("ConnectWithMe", {
    profileUid: scannedProfileUid,
    mode: "scan",
    scannerIsNewSignup: Boolean(options.scannerIsNewSignup),
  });

  // Notify QR owner in the background — do not block showing Connect with Me.
  if (scannerProfileUid) {
    void publishNewConnectionOpened(scannedProfileUid, {
      message: "QR Code Scanned",
      scannerProfileUid,
      scannerIsNewSignup: Boolean(options.scannerIsNewSignup),
    }).catch(() => {});
  }
}
