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
        if (onScanComplete) {
          onScanComplete(parsed);
          navigation.goBack();
        } else {
          // Pass the full parsed QR code data
          navigation.navigate("Connect", {
            profile_uid: parsed.profile_uid,
            qr_code_data: JSON.stringify(parsed), // Pass full QR code data as JSON string
            ...parsed, // Also spread individual fields for backward compatibility
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

      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      />

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
    boxShadow: "0px 0px 10px rgba(175, 82, 222, 0.8)",
    ...(Platform.OS !== "web" && { elevation: 5 }),
  },
  
});
