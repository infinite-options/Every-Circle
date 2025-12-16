import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, Alert, ActivityIndicator, ScrollView, Image, Dimensions, Modal } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import * as Crypto from "expo-crypto";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import { USER_PROFILE_INFO_ENDPOINT, ACCOUNT_SALT_ENDPOINT, LOGIN_ENDPOINT, UPDATE_EMAIL_PASSWORD_ENDPOINT } from "../apiConfig";

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Fetch user information when component mounts
    const getUserInfo = async () => {
      try {
        const uid = await AsyncStorage.getItem("user_uid");
        const storedEmail = await AsyncStorage.getItem("user_email_id");

        if (uid) {
          setUserId(uid);
          console.log("User UID:", uid);

          if (storedEmail) {
            setUserEmail(storedEmail);
            console.log("Using stored email:", storedEmail);
            return;
          }

          // Fetch user details to get email if not in AsyncStorage
          try {
            const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${uid}`);
            const userData = await response.json();
            console.log("User data fetched:", userData);

            // Get the email from the correct field
            const email = userData.user_email || (userData.personal_info ? userData.personal_info.profile_personal_email : null);

            if (email) {
              setUserEmail(email);
              console.log("Setting user email to:", email);
            } else {
              Alert.alert("Error", "Could not retrieve user email. Please log in again.");
            }
          } catch (fetchError) {
            console.error("Error fetching user profile:", fetchError);
            Alert.alert("Error", "Could not retrieve user profile. Please try again later.");
          }
        } else {
          Alert.alert("Error", "User ID not found. Please log in again.");
        }
      } catch (error) {
        console.error("Error accessing AsyncStorage:", error);
      }
    };

    getUserInfo();
  }, []);

  const isFormValid = () => {
    return currentPassword.length >= 6 && newPassword.length >= 6 && newPassword === confirmPassword && confirmPassword.length > 0;
  };

  const validateInputs = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "All fields are required");
      return false;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New password and confirm password do not match");
      return false;
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "Password should be at least 6 characters long");
      return false;
    }

    return true;
  };

  const handleChangePassword = async () => {
    if (!validateInputs()) return;

    if (!userEmail) {
      Alert.alert("Error", "User email not found. Please try again later.");
      return;
    }

    setIsLoading(true);
    try {
      console.log("Starting password change process for email:", userEmail);

      // Get the password salt first
      console.log("Fetching password salt...");
      const saltResponse = await fetch(ACCOUNT_SALT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userEmail,
        }),
      });

      const saltData = await saltResponse.json();
      console.log("Salt response:", saltData);

      if (saltData.code !== 200) {
        Alert.alert("Error", "Failed to retrieve account information");
        setIsLoading(false);
        return;
      }

      const salt = saltData.result[0].password_salt;
      console.log("Got salt:", salt);

      // Hash the current password to verify using password + salt order
      console.log("Hashing current password...");
      const currentPasswordHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        currentPassword + salt // Order: password then salt
      );
      console.log("Current password hash generated:", currentPasswordHash);

      // Verify current password by attempting login
      console.log("Verifying current password...");
      const verifyResponse = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userEmail,
          password: currentPasswordHash,
        }),
      });

      const verifyData = await verifyResponse.json();
      console.log("Verify response:", verifyData);

      if (verifyData.code !== 200) {
        setPasswordError("Incorrect password. Please try again.");
        setIsLoading(false);
        return;
      }

      // Instead of hashing the new password, we now directly send the new plain text password.
      console.log("Using new password in plain text.");

      // Create the request payload with plain new password
      const updateRequest = {
        email: userEmail,
        user_uid: userId,
        password: newPassword,
      };

      console.log("Sending update request:", JSON.stringify(updateRequest));

      // Updated endpoint: using UpdateEmailPassword instead of UpdatePassword.
      const updateResponse = await fetch(UPDATE_EMAIL_PASSWORD_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateRequest),
      });

      // Get response as text first to debug
      const responseText = await updateResponse.text();
      console.log("Raw update response:", responseText);

      let updateData;
      // After receiving responseText and parsing it:

      try {
        updateData = JSON.parse(responseText);
        console.log("Parsed update response:", updateData);

        // Option A: Check if message includes "updated successfully"
        if (updateData.message && updateData.message.toLowerCase().includes("updated successfully")) {
          // Optionally store the new password plain text or clear it from storage.
          // await AsyncStorage.setItem("current_password_hash", newPassword); // For example purposes only

          setShowSuccessModal(true);
        } else {
          setErrorMessage(`Failed to update password: ${updateData.message || "Unknown error"}. Please try again later.`);
          setShowErrorModal(true);
        }
      } catch (parseError) {
        console.error("Error parsing update response:", parseError);
        setErrorMessage("The server returned an unexpected response. Please try again later.");
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error("Error changing password:", error);
      setErrorMessage("Something went wrong. Please try again.");
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button */}
      <AppHeader title='Change Password' backgroundColor='#AF52DE' onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formContainer}>
          <Text style={styles.subtitle}>Enter your current password and a new password below</Text>

          {/* Current Password Input */}
          <View style={styles.inputContainer}>
            <MaterialIcons name='lock' size={20} color='#666' style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder='Current Password'
              placeholderTextColor='#999'
              secureTextEntry={!showCurrentPassword}
              value={currentPassword}
              onChangeText={(text) => {
                setCurrentPassword(text);
                // Clear password error when user starts typing
                if (passwordError) {
                  setPasswordError("");
                }
              }}
            />
            <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={styles.eyeIcon}>
              <MaterialIcons name={showCurrentPassword ? "visibility-off" : "visibility"} size={20} color='#666' />
            </TouchableOpacity>
          </View>
          {!!passwordError && <Text style={styles.passwordErrorText}>{passwordError}</Text>}

          {/* New Password Input */}
          <View style={styles.inputContainer}>
            <MaterialIcons name='lock' size={20} color='#666' style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder='New Password' placeholderTextColor='#999' secureTextEntry={!showNewPassword} value={newPassword} onChangeText={setNewPassword} />
            <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeIcon}>
              <MaterialIcons name={showNewPassword ? "visibility-off" : "visibility"} size={20} color='#666' />
            </TouchableOpacity>
          </View>

          {/* Confirm New Password Input */}
          <View style={styles.inputContainer}>
            <MaterialIcons name='lock' size={20} color='#666' style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder='Confirm New Password'
              placeholderTextColor='#999'
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
              <MaterialIcons name={showConfirmPassword ? "visibility-off" : "visibility"} size={20} color='#666' />
            </TouchableOpacity>
          </View>

          {/* Password Requirements */}
          <View style={styles.requirementsContainer}>
            <Text style={styles.requirementsTitle}>Password Requirements:</Text>
            <View style={styles.requirementItem}>
              <MaterialIcons name={newPassword.length >= 6 ? "check-circle" : "cancel"} size={16} color={newPassword.length >= 6 ? "#4CAF50" : "#ccc"} />
              <Text style={styles.requirementText}>At least 6 characters</Text>
            </View>
            <View style={styles.requirementItem}>
              <MaterialIcons
                name={newPassword === confirmPassword && newPassword.length > 0 ? "check-circle" : "cancel"}
                size={16}
                color={newPassword === confirmPassword && newPassword.length > 0 ? "#4CAF50" : "#ccc"}
              />
              <Text style={styles.requirementText}>Passwords match</Text>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity style={[styles.submitButton, (!isFormValid() || isLoading) && styles.submitButtonDisabled]} onPress={handleChangePassword} disabled={!isFormValid() || isLoading}>
            {isLoading ? (
              <ActivityIndicator size='small' color='#fff' />
            ) : (
              <Text style={[styles.submitButtonText, (!isFormValid() || isLoading) && styles.submitButtonTextDisabled]}>Update Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      {/* Bottom Navigation Bar */}
      <BottomNavBar navigation={navigation} />

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType='fade'>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Password Reset</Text>
            <Text style={styles.modalSubtitle}>Password Reset Successfully</Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSubmit]}
              onPress={() => {
                setShowSuccessModal(false);
                navigation.goBack();
              }}
            >
              <Text style={styles.modalButtonSubmitText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal visible={showErrorModal} transparent animationType='fade'>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Error</Text>
            <Text style={styles.modalSubtitle}>{errorMessage}</Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSubmit]}
              onPress={() => {
                setShowErrorModal(false);
                setErrorMessage("");
              }}
            >
              <Text style={styles.modalButtonSubmitText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f8f8" },
  scrollContent: { flexGrow: 1, padding: 20 },
  formContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 25,
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 10,
    backgroundColor: "#f9f9f9",
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, color: "#333" },
  eyeIcon: { padding: 10 },
  requirementsContainer: {
    marginVertical: 15,
    padding: 15,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#555",
    marginBottom: 10,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 5,
  },
  requirementText: { marginLeft: 8, fontSize: 14, color: "#555" },
  submitButton: {
    backgroundColor: "#AF52DE",
    borderRadius: 8,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 15,
  },
  submitButtonDisabled: {
    backgroundColor: "#E5E5E5",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  submitButtonTextDisabled: {
    color: "#999",
  },
  passwordErrorText: {
    color: "red",
    fontSize: 14,
    marginTop: -10,
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 12,
    width: "85%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#007AFF",
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  modalButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  modalButtonSubmit: {
    backgroundColor: "#FF9500",
  },
  modalButtonSubmitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
