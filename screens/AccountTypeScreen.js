import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUserEmail } from "../utils/emailStorage";
import axios from "axios";
import { REFERRAL_API_ENDPOINT } from "../apiConfig";
import AppHeader from "../components/AppHeader";

const { width } = Dimensions.get("window");
const isWeb = Platform.OS === "web";

const userProfileAPI = REFERRAL_API_ENDPOINT;

const AccountTypeScreen = ({ navigation, route }) => {
  const [email, setEmail] = useState(route.params?.email || "");
  const { user_uid = "" } = route.params || {};

  useEffect(() => {
    // If email is not provided in route params, try to get it from AsyncStorage
    if (!email) {
      const getEmailFromStorage = async () => {
        try {
          const storedEmail = await getUserEmail();
          if (storedEmail) {
            setEmail(storedEmail);
            console.log("AccountTypeScreen - Retrieved email from AsyncStorage:", storedEmail);
          }
        } catch (error) {
          console.error("Error retrieving email from AsyncStorage:", error);
        }
      };
      getEmailFromStorage();
    }
  }, [email]);

  console.log("AccountTypeScreen - Email: ", email);
  console.log("AccountTypeScreen - User UID: ", user_uid);

  const handleSelectAccount = async () => {
    if (!user_uid) {
      Alert.alert("Error", "User ID is missing. Cannot fetch profile.");
      return;
    }

    try {
      console.log(`Fetching profile for user_uid: ${user_uid}`);

      const url = userProfileAPI + user_uid;
      console.log("Check Email API: ", url);

      const response = await axios.get(url);

      console.log("Profile API Response:", response.data);

      // Check if we have valid profile data (personal_info exists)
      // Even if status is 500, the data might still be valid
      const profileData = response.data;
      
      if (profileData && profileData.personal_info) {
        // Store profile_uid in AsyncStorage for consistency with other screens
        if (profileData.personal_info.profile_personal_uid) {
          await AsyncStorage.setItem("profile_uid", profileData.personal_info.profile_personal_uid);
        }
        
        navigation.navigate("Profile", {
          user: profileData,
          profile_uid: profileData.personal_info?.profile_personal_uid || "",
        });
      } else {
        Alert.alert("Error", "Profile data not found. Please try again.");
      }
    } catch (error) {
      console.error("Error fetching profile:", error.response?.data || error.message);
      
      // Check if error response contains valid data despite the error
      const errorData = error.response?.data;
      if (errorData && errorData.personal_info) {
        console.log("Found valid profile data in error response, proceeding...");
        
        // Store profile_uid in AsyncStorage
        if (errorData.personal_info.profile_personal_uid) {
          await AsyncStorage.setItem("profile_uid", errorData.personal_info.profile_personal_uid);
        }
        
        navigation.navigate("Profile", {
          user: errorData,
          profile_uid: errorData.personal_info?.profile_personal_uid || "",
        });
      } else {
        Alert.alert("Error", "Could not load profile. Please try again.");
      }
    }
  };

  return (
    <View style={styles.accountContainer}>
      <AppHeader title="Choose Your Account" backgroundColor="#007AFF" />
      <View style={styles.circlesContainer}>
        <TouchableOpacity style={[styles.accountButton, styles.personal]} onPress={handleSelectAccount}>
          <Text style={styles.accountText}>Personal</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.accountButton, styles.business]} onPress={() => navigation.navigate("BusinessSetup")}>
          <Text style={styles.accountText}>Business</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  accountContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  circlesContainer: {
    flex: 1,
    flexDirection: isWeb ? "row" : "column",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: isWeb ? 40 : 20,
    paddingVertical: isWeb ? 40 : 60,
    ...(isWeb && {
      maxWidth: 1200,
      alignSelf: "center",
      width: "100%",
    }),
  },
  accountButton: {
    width: isWeb ? Math.min(300, width * 0.25) : width * 0.6,
    height: isWeb ? Math.min(300, width * 0.25) : width * 0.6,
    borderRadius: isWeb ? Math.min(150, width * 0.125) : width * 0.3,
    justifyContent: "center",
    alignItems: "center",
    ...(isWeb
      ? {
          minWidth: 200,
          minHeight: 200,
          maxWidth: 350,
          maxHeight: 350,
          marginHorizontal: 20,
        }
      : {
          marginVertical: 15,
        }),
  },
  personal: {
    backgroundColor: "#FFA500",
  },
  business: {
    backgroundColor: "#00C721",
  },
  accountText: {
    color: "#000",
    fontSize: isWeb ? 28 : 22,
    fontWeight: "bold",
  },
});
export default AccountTypeScreen;
