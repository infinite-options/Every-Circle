import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { publishNewConnectionOpened } from "./publishNewConnectionOpened";
import { resolveScannerProfileUid } from "./ensureSessionProfileUid";

/** Navigation params to open the connect modal on Connect for a scanned profile. */
export function networkScanConnectParams(scannedProfileUid) {
  return {
    scannedProfileUid,
    scanConnectToken: Date.now(),
  };
}

/**
 * Navigate to Connect for a scan connect flow and notify the QR owner (Exchange Contact Info).
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

  navigation.navigate("Connect", networkScanConnectParams(scannedProfileUid));

  // Notify QR owner (requires scanner profile_uid — set after UserInfo on new signup)
  if (scannerProfileUid) {
    await publishNewConnectionOpened(scannedProfileUid, {
      message: "QR Code Scanned",
      scannerProfileUid,
      scannerIsNewSignup: Boolean(options.scannerIsNewSignup),
    });
  }
}
