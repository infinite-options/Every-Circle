import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUserEmail } from "../utils/emailStorage";
import axios from "axios";
import { REFERRAL_API_ENDPOINT } from "../apiConfig";
import AppHeader from "../components/AppHeader";
import { getHeaderColors } from "../config/headerColors";
import BottomNavBar from "../components/BottomNavBar";

const { width, height } = Dimensions.get("window");
const isWeb = Platform.OS === "web";

const userProfileAPI = REFERRAL_API_ENDPOINT;

// Calculate position for buttons around a circle
const calculateCirclePosition = (index, totalButtons, radius) => {
  // Start from top (-90 degrees) and distribute evenly
  const angle = (index * 2 * Math.PI) / totalButtons - Math.PI / 2;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  return { x, y };
};

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

      // const response = await axios.get(
      //   https://ioec2ecaspm.infiniteoptions.com/api/v1/userprofileinfo/${user_uid}
      // );

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
      <AppHeader title='Your Profile' {...getHeaderColors("signUp")} />
      {/* <AppHeader title='Choose Your Account' backgroundColor='#007AFF' /> */}
      <Text style={styles.title}>What would you like to do next?</Text>
      <View style={styles.circlesContainer}>
        {(() => {
          const buttons = [
            { label: "Complete Your Profile", style: styles.personal, onPress: handleSelectAccount, index: 0 },
            { label: "Add a Business", style: styles.business, onPress: () => navigation.navigate("BusinessSetup"), index: 1 },
            { label: "Add an Organization", style: styles.organization, onPress: () => navigation.navigate("BusinessSetup"), index: 2 },
            { label: "Start a Search", style: styles.search, onPress: () => navigation.navigate("BusinessSetup"), index: 3 },
            { label: "Take a Tour", style: styles.tour, onPress: () => navigation.navigate("HowItWorksScreen"), index: 4 },
          ];

          // Calculate responsive radius based on available space
          const headerHeight = isWeb ? 80 : 100;
          const titleHeight = 60;
          const titleMarginTop = 100;
          const spacingFromTitle = 117;
          const bottomNavHeight = isWeb ? 60 : 100;
          const availableHeight = height - headerHeight - titleMarginTop - titleHeight - spacingFromTitle - bottomNavHeight;
          const availableWidth = width - (isWeb ? 80 : 40);

          // Use the smaller dimension to ensure circle fits
          const maxRadius = Math.min(availableWidth, availableHeight) * 0.4;
          const radius = Math.max(isWeb ? Math.min(maxRadius, 250) : Math.min(maxRadius, 180), isWeb ? 200 : 140);

          // Button size - responsive but consistent
          const buttonSize = isWeb ? Math.min(180, width * 0.15) : Math.min(120, width * 0.25);
          const circleSize = radius * 2;

          return (
            <View style={[styles.largeCircle, { width: circleSize, height: circleSize, borderRadius: radius }]}>
              {buttons.map((button) => {
                const position = calculateCirclePosition(button.index, buttons.length, radius);
                return (
                  <TouchableOpacity
                    key={button.index}
                    style={[
                      styles.accountButton,
                      button.style,
                      {
                        position: "absolute",
                        left: radius + position.x - buttonSize / 2,
                        top: radius + position.y - buttonSize / 2,
                        width: buttonSize,
                        height: buttonSize,
                        borderRadius: buttonSize / 2,
                      },
                    ]}
                    onPress={button.onPress}
                  >
                    <Text style={[styles.accountText, { fontSize: isWeb ? Math.max(14, buttonSize * 0.1) : Math.max(12, buttonSize * 0.11) }]}>{button.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })()}
      </View>
      <BottomNavBar navigation={navigation} />
    </View>
  );
};

const styles = StyleSheet.create({
  accountContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 100,
    marginBottom: 117,
    textAlign: "center",
  },
  circlesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: isWeb ? 60 : 100,
  },
  largeCircle: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ddd",
    borderStyle: "dashed",
  },
  accountButton: {
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
  },
  personal: {
    backgroundColor: "#800000",
  },
  business: {
    backgroundColor: "#FFA500",
  },
  organization: {
    backgroundColor: "#4CAF50",
  },
  search: {
    backgroundColor: "#9C27B0",
  },
  tour: {
    backgroundColor: "#2196F3",
  },
  accountText: {
    color: "#000",
    fontSize: isWeb ? 28 : 22,
    fontWeight: "bold",
    textAlign: "center",
    width: "100%",
  },
});
export default AccountTypeScreen;
