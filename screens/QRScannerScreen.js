import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Camera, CameraView } from "expo-camera";
// Note: BarCodeScanner is deprecated and doesn't show camera preview on web
// Using CameraView for web (shows preview) and BarCodeScanner as fallback for native if needed
import { BarCodeScanner } from "expo-barcode-scanner";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import AppHeader from "../components/AppHeader";
import { useDarkMode } from "../contexts/DarkModeContext";

export default function QRScannerScreen({ route }) {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();
  const onScanComplete = route?.params?.onScanComplete;

  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  console.log("🚀 QRScannerScreen MOUNTED");
  console.log("🖥 Platform:", Platform.OS);

  // Request permission (OLD, STABLE API)
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        console.log("📸 Camera permission status:", status);
        setHasPermission(status === "granted");
      } catch (err) {
        console.error("❌ Permission error:", err);
        setHasPermission(false);
      }
    })();
  }, []);

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;

    setScanned(true);
    setLoading(true);

    console.log("📦 QR DATA:", data);

    try {
      let parsed;

      try {
        parsed = JSON.parse(data);
      } catch {
        if (data.startsWith("https://everycircle.com/newconnection/")) {
          parsed = {
            type: "everycircle",
            profile_uid: data.split("/").pop(),
          };
        } else {
          throw new Error("Invalid QR");
        }
      }

      if (parsed?.profile_uid) {
        console.log("📋 QRScannerScreen - Parsed QR code data:", JSON.stringify(parsed, null, 2));
        console.log("📡 QRScannerScreen - Ably channel name from QR:", parsed.ably_channel_name);
        
        if (onScanComplete) {
          onScanComplete(parsed);
          navigation.goBack();
        } else {
          // Navigate to NewConnection (not Connect) to pass form_switch_enabled and ably_channel_name
          console.log("📡 QRScannerScreen - Navigating to NewConnection with:");
          console.log("   profile_uid:", parsed.profile_uid);
          console.log("   form_switch_enabled:", parsed.form_switch_enabled || false);
          console.log("   ably_channel_name:", parsed.ably_channel_name || null);
          
          navigation.navigate("NewConnection", {
            profile_uid: parsed.profile_uid,
            form_switch_enabled: parsed.form_switch_enabled || false,
            ably_channel_name: parsed.ably_channel_name || null,
          });
        }
      } else {
        throw new Error("Invalid QR format");
      }
    } catch (err) {
      Alert.alert(
        "Invalid QR Code",
        "This is not a valid EveryCircle QR code.",
        [
          { text: "Try Again", onPress: () => setScanned(false) },
          { text: "Cancel", style: "cancel", onPress: () => navigation.goBack() },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  // Permission loading
  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <AppHeader title="QR Scanner" onBackPress={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.text}>Requesting camera permission…</Text>
        </View>
      </View>
    );
  }

  // Permission denied
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <AppHeader title="QR Scanner" onBackPress={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.error}>Camera access denied</Text>
          <Text style={styles.text}>
            {Platform.OS === "web"
              ? "Enable camera access in your browser settings."
              : "Enable camera access in system settings."}
          </Text>
        </View>
      </View>
    );
  }

  console.log("🎥 Rendering camera");

  return (
    <View style={styles.container}>
      <AppHeader title="QR Scanner" onBackPress={() => navigation.goBack()} />

      {Platform.OS === "web" ? (
        // Use CameraView on web - it shows the actual camera preview
        <CameraView
          style={StyleSheet.absoluteFillObject}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
        />
      ) : (
        // Use BarCodeScanner on native platforms
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          barCodeTypes={[BarCodeScanner.Constants.BarCodeType.qr]}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      <View style={styles.frameContainer}>
        <View style={styles.scanFrame} />
      </View>

      <View style={styles.overlay}>
        <Text style={styles.scanText}>Align QR code in the frame</Text>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Processing…</Text>
        </View>
      )}

      {scanned && !loading && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.scanAgainButton}
            onPress={() => setScanned(false)}
          >
            <Text style={styles.scanAgainText}>Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { color: "#ccc", fontSize: 16, textAlign: "center" },
  error: { color: "#ff3b30", fontSize: 16, marginBottom: 12 },
  overlay: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 12,
    borderRadius: 8,
  },
  scanText: { color: "#fff", fontSize: 16 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: "#fff", marginTop: 10 },
  buttonContainer: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    padding: 20,
  },
  scanAgainButton: {
    backgroundColor: "#AF52DE",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  scanAgainText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  frameContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
    pointerEvents: "none", // Allow touches to pass through to camera
  },
  scanFrame: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: "#AF52DE",
    borderRadius: 16,
    backgroundColor: "transparent",
    shadowColor: "#AF52DE",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5, // For Android
  },
  
});
