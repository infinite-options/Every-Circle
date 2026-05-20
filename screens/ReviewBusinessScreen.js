import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Pressable, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import BottomNavBar from "../components/BottomNavBar";
import { RATINGS_ENDPOINT } from "../apiConfig";
import { appendReviewImagesToFormData } from "../utils/reviewImageFormData";

function resolveRatingUid(reviewData, routeParams) {
  const fromParams = routeParams?.rating_uid;
  if (fromParams != null && String(fromParams).trim() !== "") return String(fromParams).trim();
  if (!reviewData) return "";
  const uid = reviewData.rating_uid ?? reviewData.rating_id ?? reviewData.id;
  return uid != null && String(uid).trim() !== "" ? String(uid).trim() : "";
}

export default function ReviewBusinessScreen({ route, navigation }) {
  const { business_uid, business_name, reviewData, isEdit } = route.params || {};
  const [profileId, setProfileId] = useState("");
  const [rating, setRating] = useState(0);
  const [description, setDescription] = useState("");
  const [receiptDate, setReceiptDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [favoriteIndex, setFavoriteIndex] = useState(0);

  const isValid = rating > 0 && description.trim() && receiptDate;

  useEffect(() => {
    AsyncStorage.getItem("profile_uid").then(setProfileId);
    if (reviewData) {
      setRating(Number(reviewData.rating_star) || 0);
      setDescription(reviewData.rating_description || "");
      if (reviewData.rating_receipt_date) {
        setReceiptDate(new Date(reviewData.rating_receipt_date));
      }
      const favIdx = Number(reviewData.rating_favorite_image_index ?? reviewData.favorite_image_index);
      if (!Number.isNaN(favIdx) && favIdx >= 0) {
        setFavoriteIndex(favIdx);
      }
    }
  }, [reviewData]);

  const pickReceipt = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.length > 0) {
        setReceiptFile(result.assets[0]);
      }
    } catch (error) {
      Alert.alert("Error", `Failed to pick receipt: ${error.message}`);
    }
  };

  const pickUploadedImages = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setUploadedImages((prev) => [...prev, ...result.assets]);
      }
    } catch (error) {
      Alert.alert("Error", `Failed to pick images: ${error.message}`);
    }
  };

  const removeUploadedImage = (index) => {
    setUploadedImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (favoriteIndex >= next.length) {
        setFavoriteIndex(Math.max(0, next.length - 1));
      } else if (index < favoriteIndex) {
        setFavoriteIndex((f) => Math.max(0, f - 1));
      }
      return next;
    });
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

    const ratingUid = resolveRatingUid(reviewData, route.params);
    if (isEdit && !ratingUid) {
      Alert.alert("Error", "Review ID is missing. Please go back and try editing again.");
      return;
    }

    const formData = new FormData();
    formData.append("rating_profile_id", profileId);
    formData.append("rating_business_id", business_uid);
    formData.append("rating_star", rating);
    formData.append("rating_description", description);
    formData.append("rating_receipt_date", receiptDate.toISOString().split("T")[0]);
    if (isEdit && ratingUid) {
      formData.append("rating_uid", ratingUid);
    }

    const imageFieldLog = await appendReviewImagesToFormData(formData, {
      receiptFile,
      uploadedImages,
      favoriteIndex,
    });

    const method = isEdit ? "PUT" : "POST";

    console.log("============================================");
    console.log("ENDPOINT: RATINGS");
    console.log("URL:", RATINGS_ENDPOINT);
    console.log("METHOD:", method);
    console.log("rating_uid:", ratingUid || "(new review)");
    console.log("image fields:", imageFieldLog.length ? imageFieldLog.join(", ") : "none");
    console.log("platform:", Platform.OS);
    console.log("============================================");

    try {
      const response = await fetch(RATINGS_ENDPOINT, {
        method,
        body: formData,
        // Do not set Content-Type — fetch must add multipart boundary automatically.
      });

      const result = await response.json();
      console.log("RESPONSE STATUS:", response.status);
      console.log("RESPONSE BODY:", JSON.stringify(result, null, 2));

      if (response.ok) {
        const newReview = {
          ...(ratingUid ? { rating_uid: ratingUid } : {}),
          rating_profile_id: profileId,
          rating_business_id: business_uid,
          rating_star: rating,
          rating_description: description,
          rating_receipt_date: receiptDate.toISOString().split("T")[0],
          ...(uploadedImages.length > 0 ? { rating_favorite_image_index: favoriteIndex } : {}),
        };

        try {
          const ratingsInfoStr = await AsyncStorage.getItem("user_ratings_info");
          let ratingsInfo = [];
          if (ratingsInfoStr) {
            ratingsInfo = JSON.parse(ratingsInfoStr);
            ratingsInfo = ratingsInfo.filter((r) => r.rating_business_id !== business_uid);
          }
          ratingsInfo.push(newReview);
          await AsyncStorage.setItem("user_ratings_info", JSON.stringify(ratingsInfo));
        } catch (e) {
          console.warn("Failed to update user_ratings_info in AsyncStorage:", e);
        }

        Alert.alert("Success", isEdit ? "Review updated!" : "Review submitted!");
        navigation.goBack();
      } else {
        throw new Error(result.message || "Failed to submit review");
      }
    } catch (err) {
      console.error("FETCH ERROR:", err);
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
              <Pressable key={i} onPress={() => setRating(i)} style={({ pressed }) => [styles.ratingTouchable, pressed && styles.ratingPressed]}>
                <View style={[styles.circle, isSelected && { backgroundColor: "#9C45F7", borderColor: "#9C45F7" }]} />
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
        <TouchableOpacity onPress={pickReceipt} style={styles.uploadButton}>
          <Text>{receiptFile ? `Receipt: ${receiptFile.name}` : "Upload Receipt"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={pickUploadedImages} style={styles.uploadButton}>
          <Text>Add Photos</Text>
        </TouchableOpacity>
        {uploadedImages.length > 0 && (
          <View style={styles.imageList}>
            {uploadedImages.map((asset, index) => (
              <View key={`${asset.uri}-${index}`} style={styles.imageRow}>
                <Text style={styles.imageRowLabel} numberOfLines={1}>
                  img_{index}
                  {favoriteIndex === index ? " ★ favorite (img_favorite)" : ""}
                </Text>
                <View style={styles.imageRowActions}>
                  {favoriteIndex !== index && (
                    <TouchableOpacity onPress={() => setFavoriteIndex(index)}>
                      <Text style={styles.setFavoriteText}>Set favorite</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => removeUploadedImage(index)}>
                    <Text style={styles.removeImageText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
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
  ratingText: { fontSize: 14, color: "#9C45F7", fontWeight: "600", marginTop: 5, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, minHeight: 80, marginTop: 5 },
  dateButton: { padding: 10, backgroundColor: "#eee", borderRadius: 8, marginTop: 5 },
  uploadButton: { padding: 10, backgroundColor: "#eee", borderRadius: 8, marginTop: 10, alignItems: "center" },
  imageList: { marginTop: 12 },
  imageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  imageRowLabel: { flex: 1, fontSize: 14, color: "#333", marginRight: 8 },
  imageRowActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  setFavoriteText: { color: "#9C45F7", fontWeight: "600", fontSize: 13 },
  removeImageText: { color: "#c00", fontSize: 13 },
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
  saveButtonDisabled: { backgroundColor: "#999" },
  saveButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  saveButtonTextDisabled: { color: "#ccc" },
});
