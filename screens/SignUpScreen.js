import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Platform, Modal, ActivityIndicator } from "react-native";

// Only import GoogleSigninButton on native platforms (not web)
let GoogleSigninButton = null;
const isWeb = typeof window !== "undefined" && typeof document !== "undefined";
if (!isWeb) {
  try {
    const googleSigninModule = require("@react-native-google-signin/google-signin");
    GoogleSigninButton = googleSigninModule.GoogleSigninButton;
  } catch (e) {
    console.warn("GoogleSigninButton not available:", e.message);
  }
}

import AppleSignIn from "../AppleSignIn";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { ACCOUNT_SALT_ENDPOINT, CREATE_ACCOUNT_ENDPOINT, GOOGLE_SIGNUP_ENDPOINT, REFERRAL_API_ENDPOINT, LOGIN_ENDPOINT, USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";
// import CryptoJS from "react-native-crypto-js";
// import * as CryptoJS from "react-native-crypto-js";
import * as Crypto from "expo-crypto";
import ReferralSearch from "../components/ReferralSearch";
import AppHeader from "../components/AppHeader";
import { getHeaderColors } from "../config/headerColors";

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
  const [userExistsError, setUserExistsError] = useState("");
  const [isAttemptingLogin, setIsAttemptingLogin] = useState(false);

  // Handle pre-populated Google user info
  useEffect(() => {
    console.log("SignUpScreen - Rendering after Sign Up Button Press");
    if (route.params?.googleUserInfo) {
      console.log("SignUpScreen - Received Google user info:", route.params.googleUserInfo);
      const { email: googleEmail, firstName, lastName } = route.params.googleUserInfo;
      setEmail(googleEmail);
      setIsGoogleSignUp(true);
    }
  }, [route.params?.googleUserInfo]);

  // Listen for Apple sign up completion (if passed via route)
  useEffect(() => {
    if (route.params?.appleUserInfo) {
      setPendingAppleUserInfo(route.params.appleUserInfo);
      setShowReferralModal(true);
    }
  }, [route.params?.appleUserInfo]);

  const validateInputs = useCallback(
    (email, password, confirmPassword) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isEmailValid = emailRegex.test(email);
      const isPasswordValid = isGoogleSignUp ? true : password.length >= 6;
      const doPasswordsMatch = isGoogleSignUp ? true : password === confirmPassword;

      setIsValid(isEmailValid && isPasswordValid && doPasswordsMatch);
    },
    [isGoogleSignUp]
  );

  // Validate inputs whenever email, password, confirmPassword, or isGoogleSignUp changes
  useEffect(() => {
    validateInputs(email, password, confirmPassword);
  }, [email, password, confirmPassword, isGoogleSignUp, validateInputs]);

  const handleEmailChange = (text) => {
    setEmail(text);
    setUserExistsError(""); // Clear error when user changes email
    validateInputs(text, password, confirmPassword);
  };

  const handlePasswordChange = (text) => {
    setPassword(text);
    setUserExistsError(""); // Clear error when user changes password
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

    // Normalize emails for comparison (lowercase, trim)
    const referralEmailNormalized = referralId.trim().toLowerCase();
    const userEmailNormalized = email.trim().toLowerCase();
    const googleEmailNormalized = pendingGoogleUserInfo?.email?.trim().toLowerCase() || "";
    const appleEmailNormalized = pendingAppleUserInfo?.email?.trim().toLowerCase() || "";

    // Check if referral email matches the user's own email
    if (referralEmailNormalized === userEmailNormalized || referralEmailNormalized === googleEmailNormalized || referralEmailNormalized === appleEmailNormalized) {
      setReferralError("Please enter the email of the person who referred you, not your own email address.");
      console.log("Referral Modal: User tried to refer themselves");
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

  const handleReferralSelect = (selectedUid, selectedUserId) => {
    setShowReferralModal(false);

    if (pendingGoogleUserInfo) {
      navigation.navigate("UserInfo", {
        googleUserInfo: pendingGoogleUserInfo,
        referralId: selectedUid,
      });
      setPendingGoogleUserInfo(null);
    } else if (pendingAppleUserInfo) {
      navigation.navigate("UserInfo", {
        appleUserInfo: pendingAppleUserInfo,
        referralId: selectedUid,
      });
      setPendingAppleUserInfo(null);
    } else if (pendingRegularSignup) {
      navigation.navigate("UserInfo", { referralId: selectedUid });
      setPendingRegularSignup(false);
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
          console.log("Setting referral modal to true, should show now");
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
          // If user_uid is not provided, just show error
          if (!createAccountData.user_uid) {
            setUserExistsError("User Already Exists");
            return;
          }
          // User already exists - try to log them in with the password they entered
          console.log("SignUpScreen - User already exists, attempting login with provided password");
          setUserExistsError(""); // Clear any previous error
          setIsAttemptingLogin(true);

          try {
            // 1. Get salt for the existing user
            const saltResponse = await fetch(ACCOUNT_SALT_ENDPOINT, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            const saltObject = await saltResponse.json();

            if (saltObject.code !== 200) {
              setIsAttemptingLogin(false);
              setUserExistsError("User Already Exists");
              return;
            }

            // 2. Hash password with salt
            const salt = saltObject.result[0].password_salt;
            const value = password + salt;
            const hashedPassword = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value, {
              encoding: Crypto.CryptoEncoding.HEX,
            });

            // 3. Attempt login
            const loginResponse = await fetch(LOGIN_ENDPOINT, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password: hashedPassword }),
            });
            const loginObject = await loginResponse.json();

            // 4. Check if login succeeded
            if (loginObject.code === 200 && loginObject.result && loginObject.result.user_uid) {
              const user_uid = loginObject.result.user_uid;
              const user_email = loginObject.result.user_email_id;

              // Store user credentials
              await AsyncStorage.setItem("user_uid", user_uid);
              await AsyncStorage.setItem("user_email_id", user_email);

              // Fetch user profile
              const profileResponse = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${user_uid}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
              });
              const fullUser = await profileResponse.json();

              // Handle case where profile is not found (check status code and message)
              if (
                (!profileResponse.ok && profileResponse.status === 404) ||
                fullUser.message === "Profile not found for this user" ||
                (fullUser.code === 404 && fullUser.message === "Profile not found for this user")
              ) {
                console.log("SignUpScreen - Profile not found for user, routing to UserInfo");
                await AsyncStorage.multiRemove(["profile_uid", "user_first_name", "user_last_name", "user_phone_number"]);
                await AsyncStorage.setItem("user_uid", user_uid);
                await AsyncStorage.setItem("user_email_id", user_email);

                setIsAttemptingLogin(false);
                // Navigate directly to UserInfo without showing alert
                navigation.navigate("UserInfo");
                return;
              }

              // Store profile data and navigate to Profile
              await AsyncStorage.setItem("user_uid", user_uid);
              await AsyncStorage.setItem("user_email_id", user_email);
              await AsyncStorage.setItem("profile_uid", fullUser.personal_info?.profile_personal_uid || "");

              setIsAttemptingLogin(false);
              navigation.navigate("Profile", {
                user: {
                  ...fullUser,
                  user_email: user_email,
                },
                profile_uid: fullUser.personal_info?.profile_personal_uid || "",
              });
            } else {
              // Password doesn't match - show error and stay on sign up page
              setIsAttemptingLogin(false);
              setUserExistsError("User Already Exists");
            }
          } catch (loginError) {
            console.error("SignUpScreen - Error attempting login:", loginError);

            // If we have user_uid from the "User already exists" response, check if profile exists
            // If profile doesn't exist, route to UserInfo
            if (createAccountData.user_uid) {
              try {
                const profileCheckResponse = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${createAccountData.user_uid}`, {
                  method: "GET",
                  headers: { "Content-Type": "application/json" },
                });
                const profileCheckData = await profileCheckResponse.json();

                // If profile not found, route to UserInfo
                if (
                  (!profileCheckResponse.ok && profileCheckResponse.status === 404) ||
                  profileCheckData.message === "Profile not found for this user" ||
                  (profileCheckData.code === 404 && profileCheckData.message === "Profile not found for this user")
                ) {
                  console.log("SignUpScreen - Profile not found in catch block, routing to UserInfo");
                  await AsyncStorage.multiRemove(["profile_uid", "user_first_name", "user_last_name", "user_phone_number"]);
                  await AsyncStorage.setItem("user_uid", createAccountData.user_uid);
                  setIsAttemptingLogin(false);
                  navigation.navigate("UserInfo");
                  return;
                }
              } catch (profileError) {
                console.error("SignUpScreen - Error checking profile:", profileError);
              }
            }

            setIsAttemptingLogin(false);
            setUserExistsError("User Already Exists");
          }
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
      <AppHeader title='Sign Up' {...getHeaderColors("signUp")} />
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to Every Circle!</Text>
        <Text style={styles.subtitle}>{isGoogleSignUp ? "Complete your sign up" : "Please create your account to continue."}</Text>
      </View>

      <View style={styles.inputContainer}>
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} placeholder='Email' value={email} onChangeText={handleEmailChange} keyboardType='email-address' autoCapitalize='none' editable={!isGoogleSignUp} />
        </View>
        {!isGoogleSignUp && (
          <>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput style={styles.input} placeholder='Password' value={password} onChangeText={handlePasswordChange} secureTextEntry={!isPasswordVisible} autoCapitalize='none' />
                <TouchableOpacity style={styles.passwordVisibilityToggle} onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
                  <Ionicons name={isPasswordVisible ? "eye-off" : "eye"} size={24} color='#666' />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Confirm Password</Text>
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
            </View>
            {!!userExistsError && <Text style={styles.userExistsErrorText}>{userExistsError}</Text>}
          </>
        )}
      </View>

      <TouchableOpacity style={[styles.continueButton, isValid ? styles.continueButtonActive : null]} onPress={handleContinue} disabled={!isValid || isAttemptingLogin}>
        {isAttemptingLogin ? (
          <ActivityIndicator color='#fff' />
        ) : (
          <Text style={[styles.continueButtonText, isValid ? styles.continueButtonTextActive : null]}>{isGoogleSignUp ? "Complete Sign Up" : "Continue"}</Text>
        )}
      </TouchableOpacity>

      {!isGoogleSignUp && (
        <>
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.socialContainer}>
            {GoogleSigninButton && !isWeb ? (
              <GoogleSigninButton style={styles.googleButton} size={GoogleSigninButton.Size.Wide} color={GoogleSigninButton.Color.Dark} onPress={onGoogleSignUp} />
            ) : (
              <TouchableOpacity style={styles.googleButton} onPress={onGoogleSignUp}>
                <Text style={styles.googleButtonText}>Sign up with Google</Text>
              </TouchableOpacity>
            )}
            <AppleSignIn onSignIn={onAppleSignUp} onError={onError} buttonText='Sign up with Apple' />
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

      {/* Referral Modal */}
      <Modal visible={showReferralModal} transparent animationType='fade'>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: "#fff", padding: 24, borderRadius: 12, width: "90%", maxWidth: 500, maxHeight: "80%" }}>
            <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>Who referred you to Every Circle?</Text>

            {/* Email Input Section */}
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
            <TouchableOpacity
              style={{ backgroundColor: "#FF9500", paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, minWidth: 100, alignItems: "center", justifyContent: "center", marginBottom: 12 }}
              onPress={handleReferralSubmit}
              disabled={isCheckingReferral}
            >
              <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>{isCheckingReferral ? "Checking..." : "Continue"}</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 16 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: "#E5E5E5" }} />
              <Text style={{ marginHorizontal: 10, color: "#666", fontSize: 14 }}>OR SEARCH</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: "#E5E5E5" }} />
            </View>

            {/* Search Section - Embed ReferralSearch content here */}
            <ReferralSearch visible={true} onSelect={handleReferralSelect} onNewUser={handleNewUserReferral} onClose={() => setShowReferralModal(false)} embedded={true} />
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
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginTop: 100,
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
  fieldContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#000",
  },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ccc",
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
    backgroundColor: "#FF9500",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginVertical: 20,
  },
  continueButtonActive: {
    backgroundColor: "#FF9500",
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 16,
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
    borderRadius: 8,
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
  userExistsErrorText: {
    color: "red",
    fontSize: 14,
    marginTop: -10,
    marginBottom: 8,
    textAlign: "left",
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
  modalInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#E5E5E5",
  },
  modalButtonCancelText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "bold",
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
