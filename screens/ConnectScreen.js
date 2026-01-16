// ConnectScreen.js - Handles QR code deep links to add connections
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Platform, Alert } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useDarkMode } from "../contexts/DarkModeContext";
import { USER_PROFILE_INFO_ENDPOINT, CIRCLES_ENDPOINT } from "../apiConfig";
import MiniCard from "../components/MiniCard";
import { sanitizeText } from "../utils/textSanitizer";
import AppHeader from "../components/AppHeader";
import BottomNavBar from "../components/BottomNavBar";

const ConnectScreen = () => {
  const { darkMode } = useDarkMode();
  const route = useRoute();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState(null);
  const [addingConnection, setAddingConnection] = useState(false);

  const profileUid = route.params?.profile_uid;

  useEffect(() => {
    if (profileUid) {
      fetchProfileData();
    } else {
      setError("No profile UID provided");
      setLoading(false);
    }
  }, [profileUid]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${profileUid}`);
      if (!response.ok) {
        throw new Error("Profile not found");
      }
      const apiUser = await response.json();

      const p = apiUser?.personal_info || {};
      const profileInfo = {
        profile_uid: profileUid,
        firstName: sanitizeText(p.profile_personal_first_name || ""),
        lastName: sanitizeText(p.profile_personal_last_name || ""),
        tagLine: sanitizeText(p.profile_personal_tag_line || p.profile_personal_tagline || ""),
        city: sanitizeText(p.profile_personal_city || ""),
        state: sanitizeText(p.profile_personal_state || ""),
        email: sanitizeText(apiUser?.user_email || ""),
        phoneNumber: sanitizeText(p.profile_personal_phone_number || ""),
        profileImage: sanitizeText(p.profile_personal_image ? String(p.profile_personal_image) : ""),
        emailIsPublic: p.profile_personal_email_is_public === 1,
        phoneIsPublic: p.profile_personal_phone_number_is_public === 1,
        tagLineIsPublic: p.profile_personal_tag_line_is_public === 1 || p.profile_personal_tagline_is_public === 1,
        locationIsPublic: p.profile_personal_location_is_public === 1,
        imageIsPublic: p.profile_personal_image_is_public === 1,
      };

      setProfileData(profileInfo);
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleAddConnection = async (relationship = null) => {
    try {
      setAddingConnection(true);
      const loggedInProfileUID = await AsyncStorage.getItem("profile_uid");

      if (!loggedInProfileUID) {
        Alert.alert("Not Logged In", "Please log in to add connections.");
        navigation.navigate("Login");
        return;
      }

      if (loggedInProfileUID === profileUid) {
        Alert.alert("Cannot Add Self", "You cannot add yourself as a connection.");
        return;
      }

      // Format current date (YYYY-MM-DD)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const circleDate = `${year}-${month}-${day}`;

      const requestBody = {
        circle_profile_id: loggedInProfileUID,
        circle_related_person_id: profileUid,
        circle_relationship: relationship || "friend",
        circle_date: circleDate,
      };

      const response = await fetch(CIRCLES_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        Alert.alert("Success", "Connection added successfully!", [
          {
            text: "OK",
            onPress: () => navigation.navigate("Network"),
          },
        ]);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add connection");
      }
    } catch (err) {
      console.error("Error adding connection:", err);
      Alert.alert("Error", err.message || "Failed to add connection");
    } finally {
      setAddingConnection(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, darkMode && styles.darkContainer]}>
        <AppHeader
          title='Connect'
          rightButton={
            <TouchableOpacity style={styles.cameraButton} onPress={() => navigation.navigate("QRScanner")}>
              <Ionicons name='camera' size={20} color='#fff' />
            </TouchableOpacity>
          }
        />
        <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size='large' color='#AF52DE' />
            <Text style={[styles.loadingText, darkMode && styles.darkLoadingText]}>Loading profile...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !profileData) {
    return (
      <View style={[styles.container, darkMode && styles.darkContainer]}>
        <AppHeader
          title='Connect'
          rightButton={
            <TouchableOpacity style={styles.cameraButton} onPress={() => navigation.navigate("QRScanner")}>
              <Ionicons name='camera' size={20} color='#fff' />
            </TouchableOpacity>
          }
        />
        <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, darkMode && styles.darkErrorText]}>{error || "Profile not found"}</Text>
            <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
              <Text style={styles.buttonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, darkMode && styles.darkContainer]}>
      <AppHeader
        title='Connect'
        rightButton={
          <TouchableOpacity style={styles.cameraButton} onPress={() => navigation.navigate("Search")}>
            <Ionicons name='camera' size={20} color='#fff' />
          </TouchableOpacity>
        }
      />
      <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.title, darkMode && styles.darkTitle]}>Add to Your Network</Text>
          <Text style={[styles.subtitle, darkMode && styles.darkSubtitle]}>Scan this person's QR code to connect</Text>

          <View style={styles.cardContainer}>
            <MiniCard user={profileData} />
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.addButton, addingConnection && styles.addButtonDisabled]} onPress={() => handleAddConnection("friend")} disabled={addingConnection}>
              {addingConnection ? <ActivityIndicator size='small' color='#fff' /> : <Text style={styles.addButtonText}>Add as Friend</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.addButton, styles.addButtonSecondary, addingConnection && styles.addButtonDisabled]}
              onPress={() => handleAddConnection("colleague")}
              disabled={addingConnection}
            >
              {addingConnection ? <ActivityIndicator size='small' color='#AF52DE' /> : <Text style={[styles.addButtonText, styles.addButtonTextSecondary]}>Add as Colleague</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.addButton, styles.addButtonSecondary, addingConnection && styles.addButtonDisabled]}
              onPress={() => handleAddConnection("family")}
              disabled={addingConnection}
            >
              {addingConnection ? <ActivityIndicator size='small' color='#AF52DE' /> : <Text style={[styles.addButtonText, styles.addButtonTextSecondary]}>Add as Family</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.viewProfileButton} onPress={() => navigation.navigate("Profile", { profile_uid: profileUid })}>
            <Text style={[styles.viewProfileText, darkMode && styles.darkViewProfileText]}>View Full Profile</Text>
          </TouchableOpacity>
        </ScrollView>
        <BottomNavBar navigation={navigation} />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  darkContainer: {
    backgroundColor: "#1a1a1a",
  },
  safeArea: {
    flex: 1,
  },
  darkSafeArea: {
    backgroundColor: "#1a1a1a",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#666",
  },
  darkLoadingText: {
    color: "#aaa",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "red",
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  darkErrorText: {
    color: "#f87171",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  darkTitle: {
    color: "#fff",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  darkSubtitle: {
    color: "#aaa",
  },
  cardContainer: {
    marginBottom: 30,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: "#AF52DE",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  addButtonSecondary: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#AF52DE",
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  addButtonTextSecondary: {
    color: "#AF52DE",
  },
  viewProfileButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  viewProfileText: {
    color: "#AF52DE",
    fontSize: 14,
    fontWeight: "500",
  },
  darkViewProfileText: {
    color: "#a78bfa",
  },
  button: {
    backgroundColor: "#AF52DE",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  cameraButton: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
});

export default ConnectScreen;
