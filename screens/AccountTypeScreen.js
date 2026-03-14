import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, Image, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUserEmail } from "../utils/emailStorage";
import axios from "axios";
import { REFERRAL_API_ENDPOINT } from "../apiConfig";
import AppHeader from "../components/AppHeader";
import { getHeaderColors } from "../config/headerColors";
import BottomNavBar from "../components/BottomNavBar";

const isWeb = Platform.OS === "web";

const userProfileAPI = REFERRAL_API_ENDPOINT;

const ICON_SIZE = 40;

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

  const listItems = [
    { label: "Complete Your Profile", icon: require("../assets/profile.png"), textColor: "#800000", onPress: handleSelectAccount },
    { label: "How it works", icon: require("../assets/tour_icon.png"), textColor: "#2196F3", onPress: () => navigation.navigate("HowItWorksScreen") },
    { label: "Add a Business", icon: require("../assets/profile.png"), textColor: "#FFA500", onPress: () => navigation.navigate("BusinessSetup") },
    { label: "Add an Organization", icon: require("../assets/profile.png"), textColor: "#4CAF50", onPress: () => navigation.navigate("BusinessSetup") },
    { label: "Start a Search", icon: require("../assets/search.png"), textColor: "#9C27B0", onPress: () => navigation.navigate("Search") },
  ];

  return (
    <View style={styles.accountContainer}>
      <AppHeader title='NEXT STEPS' {...getHeaderColors("signUp")} />
      <Text style={styles.title}>What would you like to do next?</Text>
      <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        <View style={styles.listWrapper}>
          {listItems.map((item, index) => (
            <TouchableOpacity key={index} style={styles.listItem} onPress={item.onPress} activeOpacity={0.7}>
              <Image source={item.icon} style={styles.listItemIcon} resizeMode='contain' />
              <Text style={[styles.listItemText, { color: item.textColor }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
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
    marginTop: 60,
    marginBottom: 24,
    marginHorizontal: 20,
    textAlign: "center",
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingBottom: isWeb ? 80 : 100,
  },
  listWrapper: {
    width: "100%",
    maxWidth: 320,
    alignSelf: "center",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  listItemIcon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    marginRight: 16,
  },
  listItemText: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
  },
});
export default AccountTypeScreen;
