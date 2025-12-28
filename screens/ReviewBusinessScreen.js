import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, ScrollView, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import BottomNavBar from "../components/BottomNavBar";
import { RATINGS_ENDPOINT } from "../apiConfig";

export default function ReviewBusinessScreen({ route, navigation }) {
  const { business_uid, business_name, reviewData, isEdit } = route.params;
  const [profileId, setProfileId] = useState("");
  const [rating, setRating] = useState(0);
  const [description, setDescription] = useState("");
  const [receiptDate, setReceiptDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  // Validation state
  const isValid = rating > 0 && description.trim() && receiptDate;

  useEffect(() => {
    AsyncStorage.getItem("profile_uid").then(setProfileId);
    // Pre-populate if editing
    if (reviewData) {
      setRating(Number(reviewData.rating_star) || 0);
      setDescription(reviewData.rating_description || "");
      if (reviewData.rating_receipt_date) {
        setReceiptDate(new Date(reviewData.rating_receipt_date));
      }
      // Note: For files, we can't pre-populate the file picker, but we could show a label if needed
    }
  }, [reviewData]);

  const pickFile = async (setter, fileType) => {
    try {
      console.log(`============================================`);
      console.log(`PICKING FILE: ${fileType}`);
      console.log(`============================================`);
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*" });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log(`File selected:`, {
          name: asset.name,
          uri: asset.uri,
          mimeType: asset.mimeType,
          size: asset.size,
        });
        setter(asset);
      } else {
        console.log(`File selection canceled`);
      }
    } catch (error) {
      console.error(`Error picking file (${fileType}):`, error);
      Alert.alert("Error", `Failed to pick ${fileType}: ${error.message}`);
    }
  };

  const handleSave = async () => {
    if (!rating || !description || !receiptDate) {
      Alert.alert("Please fill all required fields.");
      return;
    }
    if (!profileId) {
      Alert.alert("Error", "Profile ID not found. Please try logging in again.");
      return;
    }
    console.log("============================================");
    console.log("SAVING REVIEW - Rating to be saved:", rating);
    console.log("Profile ID:", profileId);
    console.log("============================================");
    const formData = new FormData();
    formData.append("rating_profile_id", profileId);
    formData.append("rating_business_id", business_uid);
    formData.append("rating_star", rating);
    formData.append("rating_description", description);
    formData.append("rating_receipt_date", receiptDate.toISOString().split("T")[0]);
    if (receiptFile) {
      formData.append("rating_receipt_image", {
        uri: receiptFile.uri,
        name: receiptFile.name,
        type: receiptFile.mimeType || "image/jpeg",
      });
    }
    if (imageFile) {
      formData.append("rating_image", {
        uri: imageFile.uri,
        name: imageFile.name,
        type: imageFile.mimeType || "image/jpeg",
      });
    }

    // Build payload object for logging (excluding file objects)
    const payloadData = {
      rating_profile_id: profileId,
      rating_business_id: business_uid,
      rating_star: rating,
      rating_description: description,
      rating_receipt_date: receiptDate.toISOString().split("T")[0],
      rating_receipt_image: receiptFile ? `[FILE: ${receiptFile.name}, ${receiptFile.mimeType || "image/jpeg"}]` : "not provided",
      rating_image: imageFile ? `[FILE: ${imageFile.name}, ${imageFile.mimeType || "image/jpeg"}]` : "not provided",
    };

    const method = isEdit ? "PUT" : "POST";

    console.log("============================================");
    console.log("ENDPOINT: RATINGS");
    console.log("URL:", RATINGS_ENDPOINT);
    console.log("METHOD:", method);
    console.log("REQUEST BODY (FormData):");
    console.log("rating_profile_id:", payloadData.rating_profile_id);
    console.log("rating_business_id:", payloadData.rating_business_id);
    console.log("rating_star:", payloadData.rating_star);
    console.log("rating_description:", payloadData.rating_description);
    console.log("rating_receipt_date:", payloadData.rating_receipt_date);
    console.log("rating_receipt_image:", payloadData.rating_receipt_image);
    console.log("rating_image:", payloadData.rating_image);
    console.log("============================================");

    try {
      // Don't set Content-Type header - let the browser/fetch set it automatically with boundary
      // This is required for FormData to work correctly on Web
      const response = await fetch(RATINGS_ENDPOINT, {
        method,
        body: formData,
      });

      console.log("RESPONSE STATUS:", response.status);
      console.log("RESPONSE OK:", response.ok);

      const result = await response.json();
      console.log("RESPONSE BODY:", JSON.stringify(result, null, 2));

      if (response.ok) {
        // Build the new review object
        const newReview = {
          rating_profile_id: profileId,
          rating_business_id: business_uid,
          rating_star: rating,
          rating_description: description,
          rating_receipt_date: receiptDate.toISOString().split("T")[0],
          // Optionally add file info if you want to display it locally
        };

        try {
          // Get current ratings_info from AsyncStorage
          const ratingsInfoStr = await AsyncStorage.getItem("user_ratings_info");
          let ratingsInfo = [];
          if (ratingsInfoStr) {
            ratingsInfo = JSON.parse(ratingsInfoStr);
            // Remove any existing review for this business
            ratingsInfo = ratingsInfo.filter((r) => r.rating_business_id !== business_uid);
          }
          // Add the new/updated review
          ratingsInfo.push(newReview);
          // Save back to AsyncStorage
          await AsyncStorage.setItem("user_ratings_info", JSON.stringify(ratingsInfo));
          console.log("Updated user_ratings_info in AsyncStorage:", ratingsInfo);
        } catch (e) {
          console.warn("Failed to update user_ratings_info in AsyncStorage:", e);
        }

        Alert.alert("Success", isEdit ? "Review updated!" : "Review submitted!");
        navigation.goBack();
      } else {
        console.error("RESPONSE ERROR:", result);
        throw new Error(result.message || "Failed to submit review");
      }
    } catch (err) {
      console.error("FETCH ERROR:", err);
      console.error("Error details:", {
        message: err.message,
        name: err.name,
        stack: err.stack,
      });
      Alert.alert("Error", err.message || "Network request failed. Please check your connection and try again.");
    }
  };

  return (
    <View style={styles.pageContainer}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>
          {isEdit ? "Edit" : "Review"} {business_name}
        </Text>
        <Text style={styles.label}>Your Rating:</Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((i) => {
            const isSelected = rating >= i;
            return (
              <Pressable
                key={i}
                onPress={() => {
                  console.log("Rating selected:", i);
                  setRating(i);
                }}
                style={({ pressed }) => [styles.ratingTouchable, pressed && styles.ratingPressed]}
              >
                <View
                  style={[
                    styles.circle,
                    isSelected && {
                      backgroundColor: "#9C45F7",
                      borderColor: "#9C45F7",
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        {rating > 0 && <Text style={styles.ratingText}>Selected: {rating} out of 5</Text>}
        <Text style={styles.label}>Comments:</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder='Enter your comments' multiline />
        <Text style={styles.label}>Receipt Date:</Text>
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
          <Text>{receiptDate.toDateString()}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={receiptDate}
            mode='date'
            display='default'
            onChange={(_, date) => {
              setShowDatePicker(false);
              if (date) setReceiptDate(date);
            }}
          />
        )}
        <TouchableOpacity onPress={() => pickFile(setReceiptFile, "Receipt")} style={styles.uploadButton}>
          <Text>{receiptFile ? receiptFile.name : "Upload Receipt"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => pickFile(setImageFile, "Image")} style={styles.uploadButton}>
          <Text>{imageFile ? imageFile.name : "Upload Image"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.saveButton, !isValid && styles.saveButtonDisabled]} onPress={handleSave} disabled={!isValid}>
          <Text style={[styles.saveButtonText, !isValid && styles.saveButtonTextDisabled]}>{isEdit ? "Update Review" : "Submit Review"}</Text>
        </TouchableOpacity>
      </ScrollView>
      <BottomNavBar navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20, paddingTop: 50 },
  label: { fontSize: 16, marginTop: 10 },
  ratingRow: { flexDirection: "row", marginVertical: 10, alignItems: "center" },
  ratingTouchable: { cursor: "pointer", padding: 2 },
  ratingPressed: { opacity: 0.7 },
  circle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "#ccc", marginHorizontal: 5 },
  circleSelected: { backgroundColor: "#9C45F7", borderColor: "#9C45F7" },
  ratingText: { fontSize: 14, color: "#9C45F7", fontWeight: "600", marginTop: 5, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, minHeight: 80, marginTop: 5 },
  dateButton: { padding: 10, backgroundColor: "#eee", borderRadius: 8, marginTop: 5 },
  uploadButton: { padding: 10, backgroundColor: "#eee", borderRadius: 8, marginTop: 10, alignItems: "center" },
  saveButton: {
    backgroundColor: "#800000",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  saveButtonDisabled: {
    backgroundColor: "#999",
  },
  saveButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  saveButtonTextDisabled: {
    color: "#ccc",
  },
});
