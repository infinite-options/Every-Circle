// FeedbackPopup.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet, 
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import WebTextInput from "./WebTextInput";
import { useDarkMode } from "../contexts/DarkModeContext";
import { API_BASE_URL, USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";
import { sanitizeText } from "../utils/textSanitizer";

const FeedbackPopup = ({ visible, onClose, pageName, instructions, questions = [
    "Question 1?",
    "Question 2?",
    "Question 3?"
  ] }) => {
  const { darkMode } = useDarkMode();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userUid, setUserUid] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [rating1, setRating1] = useState(0); 
  const [rating2, setRating2] = useState(0); 
  const [rating3, setRating3] = useState(0); 
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Load user data when popup opens
  useEffect(() => {
    if (visible) {
      loadUserData();
      // Reset form when opening
      setFeedbackText("");
      setRating1(0);
      setRating2(0);
      setRating3(0);
      setSubmitSuccess(false);
      setSubmitError("");
    }
  }, [visible]);

  const loadUserData = async () => {
    try {
      console.log("📥 Loading user data for feedback...");
      
      // Get user_uid and profile_uid from AsyncStorage
      const [storedUserUid, storedProfileUid] = await Promise.all([
        AsyncStorage.getItem("user_uid"),
        AsyncStorage.getItem("profile_uid"),
      ]);

      console.log("📥 Raw values from AsyncStorage:", {
        userUid: storedUserUid,
        profileUid: storedProfileUid
      });

      // Parse user_uid
      let uid = storedUserUid || "";
      try {
        const parsed = JSON.parse(uid);
        uid = typeof parsed === "string" ? parsed : String(parsed);
      } catch (e) {
        uid = String(uid).trim();
      }
      setUserUid(sanitizeText(uid));

      // Parse profile_uid to fetch user profile data
      let profileUid = storedProfileUid || "";
      try {
        const parsed = JSON.parse(profileUid);
        profileUid = typeof parsed === "string" ? parsed : String(parsed);
      } catch (e) {
        profileUid = String(profileUid).trim();
      }

      console.log("📥 Parsed UIDs:", {
        userUid: uid,
        profileUid: profileUid
      });

      // Fetch user profile data from API to get first and last name
      if (profileUid) {
        try {
          console.log("📥 Fetching user profile from API:", `${USER_PROFILE_INFO_ENDPOINT}/${profileUid}`);
          const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${profileUid}`);
          if (response.ok) {
            const apiUser = await response.json();
            console.log("📥 API response:", apiUser);
            
            const p = apiUser?.personal_info || {};
            const firstName = sanitizeText(p.profile_personal_first_name || "");
            const lastName = sanitizeText(p.profile_personal_last_name || "");
            
            console.log("✅ Setting names from API:", { firstName, lastName });
            setFirstName(firstName);
            setLastName(lastName);
          } else {
            console.warn("⚠️ Failed to fetch user profile from API");
          }
        } catch (error) {
          console.error("❌ Error fetching user profile from API:", error);
        }
      } else {
        console.warn("⚠️ No profile_uid available to fetch user data");
      }
      
      console.log("✅ User data loading complete");
    } catch (error) {
      console.error("❌ Error loading user data for feedback:", error);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!feedbackText.trim()) {
      setSubmitError("Please enter your feedback");
      return;
    }
    if (rating1 === 0 || rating2 === 0 || rating3 === 0) {
      setSubmitError("Please rate all questions");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_uid: userUid,
          first_name: firstName,
          last_name: lastName,
          page_name: pageName,
          feedback_text: feedbackText,
          question_1: rating1,
          question_2: rating2,
          question_3: rating3,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }

      setSubmitSuccess(true);
      
      // Close popup after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      setSubmitError("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const RatingSelector = ({ value, onChange, label }) => (
    <View style={styles.ratingContainer}>
      <Text style={[styles.ratingLabel, darkMode && styles.darkText]}>{label}</Text>
      <View style={styles.ratingButtons}>
        {[1, 2, 3, 4, 5].map((num) => (
          <TouchableOpacity
            key={num}
            style={[
              styles.ratingButton,
              value === num && styles.ratingButtonSelected,
              darkMode && styles.darkRatingButton,
              value === num && darkMode && styles.darkRatingButtonSelected,
            ]}
            onPress={() => onChange(num)}
          >
            <Text
              style={[
                styles.ratingButtonText,
                value === num && styles.ratingButtonTextSelected,
                darkMode && styles.darkText,
                value === num && styles.ratingButtonTextSelected,
              ]}
            >
              {num}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.popup, darkMode && styles.darkPopup]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, darkMode && styles.darkText]}>
              Share Your Feedback
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons
                name="close"
                size={24}
                color={darkMode ? "#ffffff" : "#333333"}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator
          >
            {/* Instructions */}
            {instructions && (
              <View style={styles.instructionsSection}>
                <Text style={[styles.instructionsText, darkMode && styles.darkText]}>
                  {instructions}
                </Text>
              </View>
            )}

            {/* User Info Display */}
            <View style={styles.infoSection}>
              <Text style={[styles.infoText, darkMode && styles.darkText]}>
                <Text style={styles.infoLabel}>Name: </Text>
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : "(Name not set)"}
              </Text>
              <Text style={[styles.infoText, darkMode && styles.darkText]}>
                <Text style={styles.infoLabel}>User ID: </Text>
                {userUid || "(Not available)"}
              </Text>
              <Text style={[styles.infoText, darkMode && styles.darkText]}>
                <Text style={styles.infoLabel}>Page: </Text>
                {pageName || "(Unknown)"}
              </Text>
            </View>

            {/* Feedback Text */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, darkMode && styles.darkText]}>
                Your Feedback
              </Text>
              <WebTextInput
                style={[
                  styles.textArea,
                  darkMode && styles.darkTextArea,
                ]}
                value={feedbackText}
                onChangeText={setFeedbackText}
                placeholder="Tell us what you think..."
                placeholderTextColor={darkMode ? "#888888" : "#999999"}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Rating Questions */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, darkMode && styles.darkText]}>
                Rate Your Experience
              </Text>
              
              <RatingSelector
                label={`1. ${questions[0]}`}
                value={rating1}
                onChange={setRating1}
              />
              
              <RatingSelector
                label={`2. ${questions[1]}`}
                value={rating2}
                onChange={setRating2}
              />
              
              <RatingSelector
                label={`3. ${questions[2]}`}
                value={rating3}
                onChange={setRating3}
              />
            </View>

            {/* Error Message */}
            {submitError ? (
              <Text style={styles.errorText}>{submitError}</Text>
            ) : null}

            {/* Success Message */}
            {submitSuccess ? (
              <View style={styles.successContainer}>
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                <Text style={styles.successText}>
                  Thank you for your feedback!
                </Text>
              </View>
            ) : null}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                submitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting || submitSuccess}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? "Submitting..." : "Submit Feedback"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  popup: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  darkPopup: {
    backgroundColor: "#2d2d2d",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333333",
  },
  darkText: {
    color: "#ffffff",
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  instructionsSection: {
  padding: 12,
  borderRadius: 8,
  marginBottom: 15,
  borderLeftWidth: 4,
  borderLeftColor: "#AF52DE",
  backgroundColor: "#F1F0F2",
  },
  instructionsText: {
    fontSize: 14,
    color: "#333333",
    lineHeight: 20,
  },
  infoSection: {
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 14,
    color: "#333333",
    marginBottom: 4,
  },
  infoLabel: {
    fontWeight: "600",
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 16,
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    backgroundColor: "#ffffff",
  },
  darkTextArea: {
    backgroundColor: "#1a1a1a",
    borderColor: "#444444",
    color: "#ffffff",
  },
  ratingContainer: {
    marginBottom: 16,
  },
  ratingLabel: {
    fontSize: 14,
    color: "#333333",
    marginBottom: 8,
  },
  ratingButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ratingButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#cccccc",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  ratingButtonSelected: {
    backgroundColor: "#AF52DE",
    borderColor: "#AF52DE",
  },
  darkRatingButton: {
    backgroundColor: "#1a1a1a",
    borderColor: "#444444",
  },
  darkRatingButtonSelected: {
    backgroundColor: "#AF52DE",
    borderColor: "#AF52DE",
  },
  ratingButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333333",
  },
  ratingButtonTextSelected: {
    color: "#ffffff",
  },
  submitButton: {
    backgroundColor: "#AF52DE",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    color: "#ff0000",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 10,
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    backgroundColor: "#e8f5e9",
    borderRadius: 8,
    marginBottom: 10,
  },
  successText: {
    color: "#4CAF50",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});

export default FeedbackPopup;