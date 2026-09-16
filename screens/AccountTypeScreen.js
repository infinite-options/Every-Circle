import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, Image, ScrollView, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUserEmail } from "../utils/emailStorage";
import { axiosMiddleware as axios } from "../utils/httpMiddleware";
import { REFERRAL_API_ENDPOINT } from "../apiConfig";
import { mergePendingOauthIdentityIntoPayload, getOauthProfileSetupStatus, setOauthProfileSetupStatus } from "../utils/oauthPendingProfileImage";
import { saveSessionProfilePayload } from "../utils/sessionProfile";
import AppHeader from "../components/AppHeader";
import { getHeaderColors } from "../config/headerColors";
import { useUnread } from "../contexts/UnreadContext";
import { persistMyBusinessUidsFromProfile } from "../utils/myBusinessUids";
import BottomNavBar from "../components/BottomNavBar";

const isWeb = Platform.OS === "web";

const userProfileAPI = REFERRAL_API_ENDPOINT;

const ICON_SIZE = 40;
/** Max time to block Next Steps while profile/photo setup finishes. */
const PROFILE_SETUP_WAIT_MS = 15000;
const PROFILE_SETUP_POLL_MS = 400;

const AccountTypeScreen = ({ navigation, route }) => {
  const { reinitialize } = useUnread();
  const [email, setEmail] = useState(route.params?.email || "");
  const { user_uid = "" } = route.params || {};
  const awaitingFromRoute = !!route.params?.awaitingProfileSetup;
  const [setupBlocking, setSetupBlocking] = useState(awaitingFromRoute);
  const [navigating, setNavigating] = useState(false);
  const waitCancelledRef = useRef(false);

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

  // Block taps until OAuth profile/photo setup status is done|failed, or 15s timeout.
  useEffect(() => {
    waitCancelledRef.current = false;
    let pollTimer = null;
    let timeoutTimer = null;

    const finishWait = async (reason) => {
      if (waitCancelledRef.current) return;
      waitCancelledRef.current = true;
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      console.log("[GooglePhoto] AccountType setup wait ended:", reason);
      setSetupBlocking(false);
    };

    const checkStatus = async () => {
      const status = await getOauthProfileSetupStatus();
      if (status === "done" || status === "failed") {
        await finishWait(status);
        return true;
      }
      // No status and not told to wait — allow interaction.
      if (!status && !awaitingFromRoute) {
        await finishWait("no-pending-setup");
        return true;
      }
      return false;
    };

    (async () => {
      const alreadyDone = await checkStatus();
      if (alreadyDone) return;

      setSetupBlocking(true);
      pollTimer = setInterval(() => {
        void checkStatus();
      }, PROFILE_SETUP_POLL_MS);

      timeoutTimer = setTimeout(() => {
        void (async () => {
          await setOauthProfileSetupStatus("done");
          await finishWait("timeout-15s");
        })();
      }, PROFILE_SETUP_WAIT_MS);
    })();

    return () => {
      waitCancelledRef.current = true;
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };
  }, [awaitingFromRoute]);

  console.log("AccountTypeScreen - Email: ", email);
  console.log("AccountTypeScreen - User UID: ", user_uid);

  const buttonsDisabled = setupBlocking || navigating;

  const handleSelectAccount = async () => {
    if (buttonsDisabled) return;
    if (!user_uid) {
      Alert.alert("Error", "User ID is missing. Cannot fetch profile.");
      return;
    }

    setNavigating(true);
    try {
      console.log(`Fetching profile for user_uid: ${user_uid}`);

      const url = userProfileAPI + user_uid;
      console.log("Check Email API: ", url);

      const response = await axios.get(url);

      // Check if we have valid profile data (personal_info exists)
      // Even if status is 500, the data might still be valid.
      // Merge pending Google photo so MiniCard shows it if the API has no image yet.
      const profileData = await mergePendingOauthIdentityIntoPayload(response.data);
      console.log("Profile API Response:", profileData);
      console.log(
        "[GooglePhoto] AccountType profile_personal_image =",
        profileData?.personal_info?.profile_personal_image || "(none)",
      );
      console.log(
        "[GooglePhoto] AccountType name =",
        profileData?.personal_info?.profile_personal_first_name,
        profileData?.personal_info?.profile_personal_last_name,
      );

      if (profileData && profileData.personal_info) {
        if (profileData.personal_info.profile_personal_uid) {
          await AsyncStorage.setItem("profile_uid", profileData.personal_info.profile_personal_uid);
        }
        try {
          await saveSessionProfilePayload(profileData);
        } catch (_) {}
        await persistMyBusinessUidsFromProfile(profileData);
        reinitialize().catch(() => {});

        navigation.navigate("Profile", {
          user: profileData,
          profile_uid: profileData.personal_info?.profile_personal_uid || "",
        });
      } else {
        Alert.alert("Error", "Profile data not found. Please try again.");
        setNavigating(false);
      }
    } catch (error) {
      console.error("Error fetching profile:", error.response?.data || error.message);

      const errorData = await mergePendingOauthIdentityIntoPayload(error.response?.data);
      if (errorData && errorData.personal_info) {
        console.log("Found valid profile data in error response, proceeding...");

        if (errorData.personal_info.profile_personal_uid) {
          await AsyncStorage.setItem("profile_uid", errorData.personal_info.profile_personal_uid);
        }
        try {
          await saveSessionProfilePayload(errorData);
        } catch (_) {}
        await persistMyBusinessUidsFromProfile(errorData);
        reinitialize().catch(() => {});

        navigation.navigate("Profile", {
          user: errorData,
          profile_uid: errorData.personal_info?.profile_personal_uid || "",
        });
      } else {
        Alert.alert("Error", "Could not load profile. Please try again.");
        setNavigating(false);
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
            <TouchableOpacity
              key={index}
              style={[styles.listItem, buttonsDisabled && styles.listItemDisabled]}
              onPress={item.onPress}
              activeOpacity={0.7}
              disabled={buttonsDisabled}
            >
              <Image source={item.icon} style={[styles.listItemIcon, buttonsDisabled && styles.listItemIconDisabled]} resizeMode='contain' />
              <Text style={[styles.listItemText, { color: item.textColor }, buttonsDisabled && styles.listItemTextDisabled]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <BottomNavBar navigation={navigation} />

      {setupBlocking ? (
        <View style={styles.blockingOverlay} pointerEvents='auto'>
          <ActivityIndicator size='large' color='#fff' />
          <Text style={styles.blockingText}>Finishing your profile…</Text>
          <Text style={styles.blockingSubText}>Please wait a moment</Text>
        </View>
      ) : null}
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
  listItemDisabled: {
    opacity: 0.45,
  },
  listItemIcon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    marginRight: 16,
  },
  listItemIconDisabled: {
    opacity: 0.7,
  },
  listItemText: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
  },
  listItemTextDisabled: {
    opacity: 0.85,
  },
  blockingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    elevation: 100,
    paddingHorizontal: 24,
  },
  blockingText: {
    marginTop: 16,
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  blockingSubText: {
    marginTop: 8,
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    textAlign: "center",
  },
});
export default AccountTypeScreen;
