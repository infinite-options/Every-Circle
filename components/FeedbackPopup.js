import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import WebTextInput from "./WebTextInput";
import { useDarkMode } from "../contexts/DarkModeContext";
import { API_BASE_URL, USER_PROFILE_INFO_ENDPOINT } from "../apiConfig";
import { sanitizeText } from "../utils/textSanitizer";

const FeedbackPopup = ({
  visible,
  onClose,
  pageName,
  instructions,
  questions = [],
}) => {
  const { darkMode } = useDarkMode();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userUid, setUserUid] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [ratings, setRatings] = useState([0, 0, 0]);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (visible) {
      loadUserData();
      setFeedbackText("");
      setRatings([0, 0, 0]);
      setSubmitSuccess(false);
      setSubmitError("");
    }
  }, [visible]);

  const loadUserData = async () => {
    try {
      const [storedUserUid, storedProfileUid] = await Promise.all([
        AsyncStorage.getItem("user_uid"),
        AsyncStorage.getItem("profile_uid"),
      ]);

      setUserUid(sanitizeText(storedUserUid || ""));

      if (storedProfileUid) {
        const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${storedProfileUid}`);
        if (response.ok) {
          const apiUser = await response.json();
          const p = apiUser?.personal_info || {};
          setFirstName(sanitizeText(p.profile_personal_first_name || ""));
          setLastName(sanitizeText(p.profile_personal_last_name || ""));
        }
      }
    } catch (e) {
      console.error("Error loading feedback user data:", e);
    }
  };

  const handleRatingChange = (index, value) => {
    const updated = [...ratings];
    updated[index] = value;
    setRatings(updated);
  };

  const handleSubmit = async () => {
    if (!feedbackText.trim()) {
      setSubmitError("Please enter your feedback");
      return;
    }

    if (ratings.some((r) => r === 0)) {
      setSubmitError("Please answer all questions");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_uid: userUid,
          first_name: firstName,
          last_name: lastName,
          page_name: pageName,
          feedback_text: feedbackText,
          question_1: ratings[0],
          question_2: ratings[1],
          question_3: ratings[2],
        }),
      });

      if (!response.ok) throw new Error("Submit failed");

      setSubmitSuccess(true);
      setTimeout(onClose, 2000);
    } catch {
      setSubmitError("Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const FeedbackInput =
    Platform.OS === "web" ? (
      <WebTextInput
        style={[styles.textArea, darkMode && styles.darkTextArea]}
        value={feedbackText}
        onChangeText={setFeedbackText}
        placeholder="Tell us what you think..."
        multiline
      />
    ) : (
      <TextInput
        style={[styles.textArea, darkMode && styles.darkTextArea]}
        value={feedbackText}
        onChangeText={setFeedbackText}
        placeholder="Tell us what you think..."
        multiline
        textAlignVertical="top"
        placeholderTextColor={darkMode ? "#888" : "#999"}
      />
    );

  const renderStars = (rating, index) => (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => handleRatingChange(index, star)}
        >
          <Ionicons
            name={star <= rating ? "star" : "star-outline"}
            size={28}
            color={star <= rating ? "#FFD700" : darkMode ? "#777" : "#ccc"}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <View style={[styles.popup, darkMode && styles.darkPopup]}>
          <View style={styles.header}>
            <Text style={[styles.title, darkMode && styles.darkText]}>
              Share Your Feedback
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={darkMode ? "#fff" : "#333"} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.contentContainer}>
            {instructions && (
              <Text style={[styles.instructionsText, darkMode && styles.darkText]}>
                {instructions}
              </Text>
            )}

            {questions.map((q, i) => (
              <View key={i} style={styles.questionBlock}>
                <Text style={[styles.questionText, darkMode && styles.darkText]}>
                  {q}
                </Text>
                {renderStars(ratings[i], i)}
              </View>
            ))}

            <View style={styles.section}>
              <Text style={[styles.sectionLabel, darkMode && styles.darkText]}>
                Additional feedback
              </Text>
              {FeedbackInput}
            </View>

            {submitError && <Text style={styles.errorText}>{submitError}</Text>}
            {submitSuccess && (
              <Text style={styles.successText}>Thank you for your feedback!</Text>
            )}

            {!submitSuccess && (
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Text style={styles.submitButtonText}>
                  {submitting ? "Submitting..." : "Submit Feedback"}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  popup: {
    backgroundColor: "#fff",
    borderRadius: 12,
    maxHeight: "90%",
  },
  darkPopup: {
    backgroundColor: "#2d2d2d",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  darkText: {
    color: "#fff",
  },
  contentContainer: {
    padding: 16,
  },
  questionBlock: {
    marginBottom: 20,
  },
  questionText: {
    fontWeight: "600",
    marginBottom: 6,
  },
  starRow: {
    flexDirection: "row",
  },
  section: {
    marginTop: 20,
  },
  sectionLabel: {
    fontWeight: "600",
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    borderColor: "#ccc",
  },
  darkTextArea: {
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderColor: "#444",
  },
  submitButton: {
    backgroundColor: "#AF52DE",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  errorText: {
    color: "red",
    textAlign: "center",
    marginTop: 12,
  },
  successText: {
    color: "#4CAF50",
    textAlign: "center",
    fontWeight: "600",
    marginTop: 12,
  },
  instructionsText: {
    marginBottom: 16,
  },
});

export default FeedbackPopup;
