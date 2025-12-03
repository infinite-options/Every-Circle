import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Platform, Modal } from "react-native";

import GoogleSignInButton from "../components/GoogleSignInButton";
import AppleSignIn from "../AppleSignIn";

const isWeb = typeof window !== "undefined" && typeof document !== "undefined";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { ACCOUNT_SALT_ENDPOINT, CREATE_ACCOUNT_ENDPOINT, GOOGLE_SIGNUP_ENDPOINT, REFERRAL_API_ENDPOINT } from "../apiConfig";
// import CryptoJS from "react-native-crypto-js";
// import * as CryptoJS from "react-native-crypto-js";
import * as Crypto from "expo-crypto";

export default function SignUpScreen({ onGoogleSignUp, onAppleSignUp, onError, navigation, route }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [isGoogleSignUp, setIsGoogleSignUp] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralId, setReferralId] = useState("");
  const [pendingGoogleUserInfo, setPendingGoogleUserInfo] = useState(null);
  const [pendingAppleUserInfo, setPendingAppleUserInfo] = useState(null);
  const [pendingRegularSignup, setPendingRegularSignup] = useState(false);
  const [referralError, setReferralError] = useState("");
  const [isCheckingReferral, setIsCheckingReferral] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // Handle pre-populated Google user info
  useEffect(() => {
    console.log("SignUpScreen - Rendering after Sign Up Button Press");
    if (route.params?.googleUserInfo) {
      console.log("SignUpScreen - Received Google user info:", route.params.googleUserInfo);
      const { email: googleEmail, firstName, lastName } = route.params.googleUserInfo;
      setEmail(googleEmail);
      setIsGoogleSignUp(true);
      // Pre-populate other fields if needed
    }
  }, [route.params?.googleUserInfo]);

  // Listen for Apple sign up completion (if passed via route)
  useEffect(() => {
    if (route.params?.appleUserInfo) {
      setPendingAppleUserInfo(route.params.appleUserInfo);
      setShowReferralModal(true);
    }
  }, [route.params?.appleUserInfo]);

  const validateInputs = (email, password, confirmPassword) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmailValid = emailRegex.test(email);
    const isPasswordValid = isGoogleSignUp ? true : password.length >= 6;
    const doPasswordsMatch = isGoogleSignUp ? true : password === confirmPassword;

    setIsValid(isEmailValid && isPasswordValid && doPasswordsMatch);
  };

  const handleEmailChange = (text) => {
    setEmail(text);
    validateInputs(text, password, confirmPassword);
  };

  const handlePasswordChange = (text) => {
    setPassword(text);
    validateInputs(email, text, confirmPassword);
  };

  const handleConfirmPasswordChange = (text) => {
    setConfirmPassword(text);
    validateInputs(email, password, text);
  };

  //   const encryptPassword = (password) => {
  //     console.log("Encrypting password:", password);
  //     return CryptoJS.SHA256(password).toString();
  //   };

  const encryptPassword = async (password) => {
    console.log("Encrypting password:", password);
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
    // console.log("Encrypted password:", hash);
    return hash;
  };

  const handleReferralSubmit = async () => {
    setReferralError("");
    if (!referralId) {
      setReferralError("Please enter a referral email or click New User.");
      console.log("Referral Modal: No referral email entered");
      return;
    }
    setIsCheckingReferral(true);
    try {
      console.log("Referral Modal: Checking referral for email:", referralId);
      const response = await fetch(REFERRAL_API_ENDPOINT + encodeURIComponent(referralId));
      const data = await response.json();
      console.log("Referral Modal: Backend response:", data);
      if (data.user_uid && data.user_uid !== "unknown") {
        console.log("Referral Modal: Referral UID returned from backend:", data.user_uid);
        // Store both the email and the UID
        // await AsyncStorage.setItem("referral_email", referralId);
        await AsyncStorage.setItem("referral_uid", data.user_uid);
        setShowReferralModal(false);
        const foundReferralUid = data.user_uid;
        if (pendingGoogleUserInfo) {
          navigation.navigate("UserInfo", {
            googleUserInfo: pendingGoogleUserInfo,
            referralId: foundReferralUid,
          });
          setPendingGoogleUserInfo(null);
        } else if (pendingAppleUserInfo) {
          navigation.navigate("UserInfo", {
            appleUserInfo: pendingAppleUserInfo,
            referralId: foundReferralUid,
          });
          setPendingAppleUserInfo(null);
        } else if (pendingRegularSignup) {
          navigation.navigate("UserInfo", { referralId: foundReferralUid });
          setPendingRegularSignup(false);
        }
      } else {
        console.log("Referral Modal: No referral UID returned, user should enter another email or click New User.");
        setReferralError("Referral email not found. Please try another or click New User.");
      }
    } catch (error) {
      setReferralError("Error checking referral. Please try again.");
      console.log("Referral Modal: Error checking referral:", error);
    } finally {
      setIsCheckingReferral(false);
    }
  };

  const handleNewUserReferral = async () => {
    setReferralError("");
    setShowReferralModal(false);
    const newUserReferralId = "110-000001";
    // Store both email (empty for new user) and UID
    await AsyncStorage.setItem("referral_email", "");
    await AsyncStorage.setItem("referral_uid", newUserReferralId);
    if (pendingGoogleUserInfo) {
      navigation.navigate("UserInfo", {
        googleUserInfo: pendingGoogleUserInfo,
        referralId: newUserReferralId,
      });
      setPendingGoogleUserInfo(null);
    } else if (pendingAppleUserInfo) {
      navigation.navigate("UserInfo", {
        appleUserInfo: pendingAppleUserInfo,
        referralId: newUserReferralId,
      });
      setPendingAppleUserInfo(null);
    } else if (pendingRegularSignup) {
      navigation.navigate("UserInfo", { referralId: newUserReferralId });
      setPendingRegularSignup(false);
    }
  };

  const handleContinue = async () => {
    try {
      if (isGoogleSignUp) {
        console.log("SignUpScreen - Google Signup");
        const { googleUserInfo } = route.params;
        const payload = {
          email: googleUserInfo.email,
          password: "GOOGLE_LOGIN",
          google_auth_token: googleUserInfo.accessToken,
          social_id: googleUserInfo.googleId,
          first_name: googleUserInfo.firstName,
          last_name: googleUserInfo.lastName,
          profile_picture: googleUserInfo.profilePicture,
        };

        const response = await fetch(GOOGLE_SIGNUP_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        console.log("SignUpScreen - Google Signup Response:", response);
        const result = await response.json();
        if (result.user_uid) {
          // Clear AsyncStorage before storing new user data
          await AsyncStorage.clear();
          await AsyncStorage.setItem("user_uid", result.user_uid);
          await AsyncStorage.setItem("user_email_id", googleUserInfo.email);
          setPendingGoogleUserInfo(googleUserInfo);
          setShowReferralModal(true);
        } else {
          throw new Error("Failed to create account");
        }
      } else {
        console.log("SignUpScreen - Regular Signup");
        // Regular email/password signup
        const createAccountResponse = await fetch(CREATE_ACCOUNT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const createAccountData = await createAccountResponse.json();
        console.log("SignUpScreen - Regular Signup Response:", createAccountData);
        if (createAccountData.message === "User already exists") {
          Alert.alert("User Already Exists", "This email is already registered. Please log in instead.", [{ text: "OK", style: "cancel" }]);
        } else if (createAccountData.code === 281 && createAccountData.user_uid) {
          // Clear AsyncStorage before storing new user data
          await AsyncStorage.clear();
          await AsyncStorage.setItem("user_uid", createAccountData.user_uid);
          await AsyncStorage.setItem("user_email_id", email);
          setPendingRegularSignup(true);
          setShowReferralModal(true);
        } else {
          throw new Error("Failed to create account");
        }
      }
    } catch (error) {
      console.error("Error in account creation:", error);
      Alert.alert("Error", "Failed to create account. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to Every Circle!</Text>
        <Text style={styles.subtitle}>{isGoogleSignUp ? "Complete your sign up" : "Please create your account to continue."}</Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput style={styles.input} placeholder='Email' value={email} onChangeText={handleEmailChange} keyboardType='email-address' autoCapitalize='none' editable={!isGoogleSignUp} />
        {!isGoogleSignUp && (
          <>
            <View style={styles.passwordInputContainer}>
              <TextInput style={styles.input} placeholder='Password' value={password} onChangeText={handlePasswordChange} secureTextEntry={!isPasswordVisible} autoCapitalize='none' />
              <TouchableOpacity style={styles.passwordVisibilityToggle} onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
                <Ionicons name={isPasswordVisible ? "eye-off" : "eye"} size={24} color='#666' />
              </TouchableOpacity>
            </View>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.input}
                placeholder='Confirm Password'
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                secureTextEntry={!isConfirmPasswordVisible}
                autoCapitalize='none'
              />
              <TouchableOpacity style={styles.passwordVisibilityToggle} onPress={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)}>
                <Ionicons name={isConfirmPasswordVisible ? "eye-off" : "eye"} size={24} color='#666' />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <TouchableOpacity style={[styles.continueButton, isValid && styles.continueButtonActive]} onPress={handleContinue} disabled={!isValid}>
        <Text style={[styles.continueButtonText, isValid && styles.continueButtonTextActive]}>{isGoogleSignUp ? "Complete Sign Up" : "Continue"}</Text>
      </TouchableOpacity>

      {!isGoogleSignUp && (
        <>
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.socialContainer}>
            <GoogleSignInButton
              style={styles.googleButton}
              onPress={async () => {
                if (!signingIn) {
                  setSigningIn(true);
                  try {
                    await onGoogleSignUp();
                  } finally {
                    setSigningIn(false);
                  }
                }
              }}
              disabled={signingIn}
              text='Sign up with Google'
              buttonText='Sign up with Google'
            />
            <AppleSignIn
              onSignIn={async (...args) => {
                if (!signingIn) {
                  setSigningIn(true);
                  try {
                    await onAppleSignUp(...args);
                  } finally {
                    setSigningIn(false);
                  }
                }
              }}
              onError={onError}
              disabled={signingIn}
              buttonText='Sign up with Apple'
            />
          </View>
        </>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Already have an account?{" "}
          <Text style={styles.logInText} onPress={() => navigation.navigate("Login")}>
            Log In
          </Text>
        </Text>
      </View>

      <Modal visible={showReferralModal} transparent animationType='fade'>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: "#fff", padding: 24, borderRadius: 12, width: 300 }}>
            <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>Who referred you to Every Circle?</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, marginBottom: 8 }}
              placeholder='Enter referral email (optional)'
              value={referralId}
              onChangeText={setReferralId}
              keyboardType='email-address'
              autoCapitalize='none'
              editable={!isCheckingReferral}
            />
            {!!referralError && <Text style={{ color: "red", marginBottom: 8 }}>{referralError}</Text>}
            <TouchableOpacity style={{ backgroundColor: "#007AFF", padding: 12, borderRadius: 8, alignItems: "center", marginBottom: 8 }} onPress={handleReferralSubmit} disabled={isCheckingReferral}>
              <Text style={{ color: "#fff", fontWeight: "bold" }}>{isCheckingReferral ? "Checking..." : "Continue"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ backgroundColor: "#FFA500", padding: 12, borderRadius: 8, alignItems: "center" }} onPress={handleNewUserReferral} disabled={isCheckingReferral}>
              <Text style={{ color: "#fff", fontWeight: "bold" }}>New User</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#007AFF",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 30,
  },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  passwordInputContainer: {
    position: "relative",
  },
  passwordVisibilityToggle: {
    position: "absolute",
    right: 15,
    top: 15,
    zIndex: 1,
  },
  continueButton: {
    backgroundColor: "#E5E5E5",
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginVertical: 20,
  },
  continueButtonActive: {
    backgroundColor: "#FF9500",
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  continueButtonTextActive: {
    color: "#fff",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E5E5",
  },
  dividerText: {
    marginHorizontal: 10,
    color: "#666",
  },
  socialContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  googleButton: {
    width: 192,
    height: 48,
    marginBottom: 15,
  },
  googleButtonText: {
    color: "#fff",
    textAlign: "center",
    padding: 12,
    backgroundColor: "#4285F4",
    borderRadius: 4,
  },
  footer: {
    alignItems: "center",
  },
  footerText: {
    fontSize: 16,
    color: "#666",
  },
  logInText: {
    color: "#FF9500",
    fontWeight: "bold",
  },
});
