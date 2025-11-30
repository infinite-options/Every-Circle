import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MenuBar from "../components/MenuBar";
import { USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";

export default function UserProfile({ onContinue, onEdit }) {
  console.log("UserProfile - Rendering");
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const userUid = await AsyncStorage.getItem("user_uid");
      if (!userUid) {
        throw new Error("User UID not found");
      }

      console.log("Fetching profile for user:", userUid);
      const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${userUid}`);

      const data = await response.json();
      console.log("User profile data:", JSON.stringify(data));

      if (data.message === "Profile not found for this user") {
        console.log("Profile not found, navigating to UserInfoScreen");
        onEdit();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch user profile");
      }

      console.log("User profile data:", JSON.stringify(data));
      setProfileData(data);
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size='large' color='#007AFF' />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.button} onPress={onEdit}>
          <Text style={styles.buttonText}>Complete Your Profile</Text>
        </TouchableOpacity>
        <MenuBar />
      </View>
    );
  }

  // Extract personal info from the profile data
  const personalInfo = profileData?.personal_info || {};

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile Information</Text>
          <TouchableOpacity onPress={onEdit} style={styles.editButton}>
            <Image source={require("../assets/EditIcon.png")} style={styles.editIcon} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>First Name</Text>
            <Text style={styles.value}>{personalInfo.profile_personal_first_name || "N/A"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Last Name</Text>
            <Text style={styles.value}>{personalInfo.profile_personal_last_name || "N/A"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Phone Number</Text>
            <Text style={styles.value}>{personalInfo.profile_personal_phone_number || "N/A"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{profileData?.user_email || "N/A"}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.button} onPress={onContinue}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>

      <MenuBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    width: "100%",
  },
  contentContainer: {
    flex: 1,
    paddingTop: 60, // Manual safe area handling
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  editButton: {
    padding: 8,
  },
  editIcon: {
    width: 24,
    height: 24,
  },
  infoContainer: {
    flex: 1,
    marginBottom: 20,
  },
  infoRow: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
  },
  label: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
  },
  value: {
    fontSize: 18,
    color: "#333",
    fontWeight: "500",
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 80, // Added to ensure button is above menu bar
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  errorText: {
    color: "red",
    textAlign: "center",
    marginBottom: 20,
  },
});
