import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storeUserEmail, getUserEmail } from "../utils/emailStorage";
import { USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";

export default function UserInfoScreen({ navigation, route }) {
  // console.log("UserInfoScreen - route.params:", route.params);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const [profilePersonalUid, setProfilePersonalUid] = useState(null);

  useEffect(() => {
    console.log("UserInfoScreen - route.params:", route.params);

    // Pre-populate from Google user info if present
    if (route?.params?.googleUserInfo) {
      const { firstName: gFirst, lastName: gLast, email: gEmail } = route.params.googleUserInfo;
      console.log("UserInfoScreen - Pre-filling with Google user info:", { gFirst, gLast, gEmail });
      if (gFirst) setFirstName(gFirst);
      if (gLast) setLastName(gLast);
      if (gEmail) {
        storeUserEmail(gEmail);
      }
    }

    // Pre-populate from Apple user info if present
    if (route?.params?.appleUserInfo) {
      const { firstName: aFirst, lastName: aLast, email: aEmail } = route.params.appleUserInfo;
      console.log("UserInfoScreen - Pre-filling with Apple user info:", { aFirst, aLast, aEmail });
      if (aFirst) setFirstName(aFirst);
      if (aLast) setLastName(aLast);
      if (aEmail) {
        storeUserEmail(aEmail);
      }
    }

    // Load saved first and last name if they exist (only if not already set by social login)
    const loadSavedData = async () => {
      try {
        const savedEmail = await getUserEmail();
        const savedFirstName = await AsyncStorage.getItem("user_first_name");
        const savedLastName = await AsyncStorage.getItem("user_last_name");
        const userUid = await AsyncStorage.getItem("user_uid");

        console.log("Loading saved data:", {
          savedEmail,
          savedFirstName,
          savedLastName,
          userUid,
        });

        // Only set saved names if not already set by social login
        if (savedFirstName && !firstName) setFirstName(savedFirstName);
        if (savedLastName && !lastName) setLastName(savedLastName);

        // Check if profile exists
        if (userUid) {
          console.log("Checking for existing profile with userUid:", userUid);
          const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${userUid}`);
          const data = await response.json();
          console.log("Profile check response:", JSON.stringify(data, null, 2));

          if (data.message !== "Profile not found for this user") {
            console.log("Profile exists, setting profile data");
            setProfileExists(true);
            setProfilePersonalUid(data.personal_info?.profile_personal_uid);
            console.log("Profile personal UID:", data.personal_info?.profile_personal_uid);

            // Pre-fill the form with existing data (only if not already set by social login)
            if (data.personal_info) {
              console.log("Pre-filling form with existing data:", data.personal_info);
              if (!firstName) setFirstName(data.personal_info.profile_personal_first_name || "");
              if (!lastName) setLastName(data.personal_info.profile_personal_last_name || "");
              setPhoneNumber(data.personal_info.profile_personal_phone_number || "");
            }

            // After fetching the user profile (e.g., fullUser)
            if (data.ratings_info) {
              await AsyncStorage.setItem("user_ratings_info", JSON.stringify(data.ratings_info));
            }
          } else {
            console.log("No existing profile found for user");
          }
        }
      } catch (error) {
        console.error("Error loading saved data:", error);
      }
    };

    loadSavedData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.googleUserInfo, route?.params?.appleUserInfo]);

  const formatPhoneNumber = (text) => {
    // Remove all non-digit characters and limit to 10 digits
    const cleaned = ("" + text).replace(/\D/g, "").slice(0, 10);

    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);

    if (!match) return text;

    let formatted = "";
    if (match[1]) formatted += `(${match[1]}`;
    if (match[1] && match[1].length === 3) formatted += ") ";
    if (match[2]) formatted += match[2];
    if (match[2] && match[2].length === 3) formatted += "-";
    if (match[3]) formatted += match[3];

    return formatted;
  };

  const handleContinue = async () => {
    console.log("UserInfoScreen - Continue button pressed");
    if (!firstName.trim() || !lastName.trim() || !phoneNumber.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    // Validate phone number is exactly 10 digits
    const cleanPhoneNumber = phoneNumber.replace(/\D/g, "");
    if (cleanPhoneNumber.length !== 10) {
      Alert.alert("Error", "Please enter a valid 10-digit phone number");
      return;
    }

    setLoading(true);
    try {
      // Save the updated information to AsyncStorage
      await AsyncStorage.setItem("user_first_name", firstName.trim());
      await AsyncStorage.setItem("user_last_name", lastName.trim());
      await AsyncStorage.setItem("user_phone_number", phoneNumber.trim());
      console.log("UserInfoScreen - AsyncStorage - saved data");

      // Get the user_uid from AsyncStorage
      const userUid = await AsyncStorage.getItem("user_uid");
      const email = await getUserEmail();
      let referralId = route?.params?.referralId;
      if (!referralId) {
        referralId = await AsyncStorage.getItem("referral_uid");
      }
      if (!userUid) {
        throw new Error("User UID not found");
      }

      // Ensure referral ID is not the same as user_uid (user cannot refer themselves)
      if (referralId === userUid) {
        console.log("UserInfoScreen - Referral ID matches user_uid, using default referral ID instead");
        referralId = "100-000001"; // Default referral ID for new users
      }

      console.log("UserInfoScreen - AsyncStorage - userUid", userUid);
      console.log("UserInfoScreen - AsyncStorage - email", email);
      console.log("UserInfoScreen - Referral UID", referralId);

      // Create form data for the API request
      // Phone number is already validated and cleaned above

      const formData = new FormData();
      formData.append("profile_personal_first_name", firstName.trim());
      formData.append("profile_personal_last_name", lastName.trim());
      formData.append("profile_personal_phone_number", cleanPhoneNumber);
      formData.append("profile_personal_referred_by", referralId || "100-000001");
      formData.append("user_uid", userUid);

      // Add profile_uid to form data only for PUT requests
      if (profileExists && profilePersonalUid) {
        formData.append("profile_uid", profilePersonalUid);
      }

      // Log the form data contents
      console.log("Form data contents:");
      console.log(`profile_personal_first_name: ${firstName.trim()}`);
      console.log(`profile_personal_last_name: ${lastName.trim()}`);
      console.log(`profile_personal_phone_number: ${cleanPhoneNumber} (formatted: ${phoneNumber.trim()})`);
      console.log(`profile_personal_referred_by: ${referralId || "100-000001"}`);
      console.log(`user_uid: ${userUid}`);
      if (profileExists && profilePersonalUid) {
        console.log(`profile_uid: ${profilePersonalUid}`);
      }

      const endpoint = USER_PROFILE_INFO_ENDPOINT;
      const method = profileExists ? "PUT" : "POST";

      console.log("Making API request:", {
        endpoint,
        method,
        profileExists,
        profilePersonalUid,
      });

      // Verify FormData contents by iterating through it
      console.log("============================================");
      console.log("📦 FORM DATA CONTENTS (verifying all fields):");
      console.log("============================================");
      for (let pair of formData.entries()) {
        console.log(`${pair[0]}: ${pair[1]}`);
      }
      console.log("============================================");

      // Make the appropriate request based on whether profile exists
      // Don't set Content-Type header - let the browser/fetch set it automatically with boundary
      // This is required for FormData to work correctly on Web
      const response = await fetch(endpoint, {
        method,
        body: formData,
      });

      console.log("API Response status:", response.status);
      // console.log("API Response headers:", JSON.stringify(response.headers, null, 2));

      const responseObject = await response.json();
      console.log("API Response body:", JSON.stringify(responseObject, null, 2));

      if (!response.ok) {
        const errorMessage = responseObject.message || responseObject.error || "Unknown error";
        const errorCode = responseObject.code || response.status;
        console.error(`API Error Details:`, {
          status: response.status,
          code: errorCode,
          message: errorMessage,
          fullResponse: responseObject,
        });
        throw new Error(`Failed to ${method.toLowerCase()} user profile: ${errorMessage} (Code: ${errorCode})`);
      }

      console.log("Profile update successful, proceeding to next screen");

      // navigate to account type screen
      Alert.alert("Success", "Profile saved successfully!");
      console.log("UserInfoScreen - Navigating to AccountType with:", { user_uid: userUid, email: email });
      navigation.navigate("AccountType", {
        user_uid: userUid,
        email: email,
      });
    } catch (error) {
      console.error("Error updating user profile:", error);
      Alert.alert("Error", `Failed to update profile: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Complete Your Profile</Text>
      <Text style={styles.subtitle}>Please provide your information to continue</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>First Name (Required)</Text>
        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder='Enter your first name' autoCapitalize='words' />

        <Text style={styles.label}>Last Name (Required)</Text>
        <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder='Enter your last name' autoCapitalize='words' />

        <Text style={styles.label}>Phone Number (Required for password recovery)</Text>
        <TextInput style={styles.input} value={phoneNumber} onChangeText={(text) => setPhoneNumber(formatPhoneNumber(text))} placeholder='(000) 000-0000' keyboardType='phone-pad' />
      </View>

      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleContinue} disabled={loading}>
        {loading ? <ActivityIndicator color='#fff' /> : <Text style={styles.buttonText}>Continue</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 100,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 30,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#999",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
