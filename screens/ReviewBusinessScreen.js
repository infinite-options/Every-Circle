import React, { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Pressable, Platform, ActivityIndicator, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import { getHeaderColors } from "../config/headerColors";
import { RATINGS_ENDPOINT, TRANSACTIONS_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "../utils/httpMiddleware";
import { appendReviewImagesToFormData } from "../utils/reviewImageFormData";
import { formatTransactionDate, parseTransactionDateTime, withTimeZoneQuery } from "../utils/transactionDateTime";

function formatTransactionDateButtonLabel(date) {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return "Select Transaction Date";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `Transaction Date: ${month}/${day}/${year}`;
}

function resolvePurchaseSellerId(transaction) {
  if (!transaction || typeof transaction !== "object") return "";
  const profileId = String(transaction.transaction_profile_id || "").trim();
  const businessId = String(transaction.transaction_business_id || "").trim();
  const sellerId = String(transaction.seller_id || "").trim();
  if (businessId && sellerId === profileId) return businessId;
  if (sellerId) return sellerId;
  return businessId;
}

function buildTransactionReceiptLabel(transaction) {
  const dateLabel = formatTransactionDate(transaction);
  const itemLabel = transaction.purchased_item || "Purchase";
  const total = parseFloat(transaction.transaction_total || transaction.seller_total || 0);
  const totalLabel = Number.isFinite(total) ? `$${total.toFixed(2)}` : "";
  return [dateLabel, itemLabel, totalLabel].filter(Boolean).join(" — ");
}

function receiptFileExtension(name) {
  if (!name || typeof name !== "string") return "";
  const parts = name.split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1].split(/[?#]/)[0].toLowerCase();
}

function isReceiptPdf(asset) {
  if (!asset) return false;
  const mime = String(asset.mimeType || "").toLowerCase();
  if (mime === "application/pdf") return true;
  return receiptFileExtension(asset.name) === "pdf";
}

function isReceiptImage(asset) {
  if (!asset) return false;
  const mime = String(asset.mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  const ext = receiptFileExtension(asset.name);
  return ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"].includes(ext);
}

function resolveRatingUid(reviewData, routeParams) {
  const fromParams = routeParams?.rating_uid;
  if (fromParams != null && String(fromParams).trim() !== "") return String(fromParams).trim();
  if (!reviewData) return "";
  const uid = reviewData.rating_uid ?? reviewData.rating_id ?? reviewData.id;
  return uid != null && String(uid).trim() !== "" ? String(uid).trim() : "";
}

function isValidTransactionDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

export default function ReviewBusinessScreen({ route, navigation }) {
  const { business_uid, business_name, reviewData, isEdit } = route.params || {};
  const [profileId, setProfileId] = useState("");
  const [rating, setRating] = useState(0);
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(null);
  const [transactionDateMenuOpen, setTransactionDateMenuOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [favoriteIndex, setFavoriteIndex] = useState(0);
  const [businessTransactions, setBusinessTransactions] = useState([]);
  const [selectedTransactionUid, setSelectedTransactionUid] = useState(null);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [receiptMenuOpen, setReceiptMenuOpen] = useState(false);
  const webDateInputRef = useRef(null);

  const receiptOptions = useMemo(
    () =>
      businessTransactions.map((transaction) => ({
        value: transaction.transaction_uid,
        label: buildTransactionReceiptLabel(transaction),
        transaction,
      })),
    [businessTransactions],
  );

  const selectedReceiptLabel = useMemo(() => {
    const selected = receiptOptions.find((option) => option.value === selectedTransactionUid);
    return selected?.label || "";
  }, [receiptOptions, selectedTransactionUid]);

  const isValid = rating > 0 && description.trim() && isValidTransactionDate(transactionDate);

  useEffect(() => {
    AsyncStorage.getItem("profile_uid").then(setProfileId);
    if (reviewData) {
      setRating(Number(reviewData.rating_star) || 0);
      setDescription(reviewData.rating_description || "");
      if (reviewData.rating_receipt_date) {
        const parsed = new Date(reviewData.rating_receipt_date);
        if (isValidTransactionDate(parsed)) setTransactionDate(parsed);
      }
      const favIdx = Number(reviewData.rating_favorite_image_index ?? reviewData.favorite_image_index);
      if (!Number.isNaN(favIdx) && favIdx >= 0) {
        setFavoriteIndex(favIdx);
      }
    }
  }, [reviewData]);

  useEffect(() => {
    if (!profileId || !business_uid) return;

    let cancelled = false;
    const loadBusinessTransactions = async () => {
      setTransactionsLoading(true);
      try {
        const url = withTimeZoneQuery(`${TRANSACTIONS_ENDPOINT}/${profileId}`);
        const response = await fetch(url, { method: "GET" });
        const result = await response.json();
        if (cancelled) return;

        const transactions = Array.isArray(result?.data) ? result.data : [];
        const businessId = String(business_uid).trim();
        const filtered = transactions
          .filter((transaction) => resolvePurchaseSellerId(transaction) === businessId)
          .sort((a, b) => {
            const aMs = parseTransactionDateTime(a)?.getTime() || 0;
            const bMs = parseTransactionDateTime(b)?.getTime() || 0;
            return bMs - aMs;
          });

        setBusinessTransactions(filtered);
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to load purchase receipts for review:", error);
          setBusinessTransactions([]);
        }
      } finally {
        if (!cancelled) setTransactionsLoading(false);
      }
    };

    loadBusinessTransactions();
    return () => {
      cancelled = true;
    };
  }, [profileId, business_uid, isEdit]);

  const handleReceiptSelection = (option) => {
    if (!option?.value) return;
    setSelectedTransactionUid(option.value);
    const parsedDate = parseTransactionDateTime(option.transaction);
    if (parsedDate) setTransactionDate(parsedDate);
    setReceiptMenuOpen(false);
  };

  const toggleTransactionDateMenu = () => {
    if (Platform.OS === "web") {
      const input = webDateInputRef.current;
      if (!input) return;
      if (typeof input.showPicker === "function") {
        try {
          input.showPicker();
        } catch {
          input.click();
        }
      } else {
        input.click();
      }
      return;
    }
    setTransactionDateMenuOpen((open) => !open);
  };

  const handleTransactionDateChange = (selectedDate) => {
    if (!selectedDate || !isValidTransactionDate(selectedDate)) return;
    setTransactionDate(selectedDate);
    setTransactionDateMenuOpen(false);
  };

  const toggleReceiptMenu = () => {
    if (receiptOptions.length === 0) return;
    setReceiptMenuOpen((open) => !open);
  };

  const pickReceipt = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png", "image/*"],
        copyToCacheDirectory: true,
      });
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
        setUploadedImages((prev) => {
          const next = [...prev, ...result.assets];
          if (prev.length === 0) setFavoriteIndex(0);
          return next;
        });
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
    if (!rating || !description) {
      Alert.alert("Please fill all required fields.");
      return;
    }
    if (!isValidTransactionDate(transactionDate)) {
      Alert.alert("Please select a transaction date.");
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
    formData.append("rating_receipt_date", transactionDate.toISOString().split("T")[0]);
    if (selectedTransactionUid) {
      formData.append("transaction_uid", selectedTransactionUid);
    }
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
          rating_receipt_date: transactionDate.toISOString().split("T")[0],
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
      <AppHeader
        title={isEdit ? "EDIT REVIEW" : "REVIEW BUSINESS"}
        {...getHeaderColors("businessProfile")}
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
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
        <View style={styles.transactionDateSection}>
          {Platform.OS === "web" ? (
            <input
              ref={webDateInputRef}
              type='date'
              style={styles.hiddenWebDateInput}
              value={isValidTransactionDate(transactionDate) ? transactionDate.toISOString().split("T")[0] : ""}
              onChange={(e) => {
                if (e.target.value) handleTransactionDateChange(new Date(`${e.target.value}T12:00:00`));
              }}
            />
          ) : null}
          <TouchableOpacity onPress={toggleTransactionDateMenu} style={styles.uploadButton} activeOpacity={0.7}>
            <View style={styles.uploadButtonContent}>
              <Text style={styles.uploadButtonText} numberOfLines={1}>
                {formatTransactionDateButtonLabel(transactionDate)}
              </Text>
              <Ionicons name={transactionDateMenuOpen ? "chevron-up" : "chevron-down"} size={18} color='#333' />
            </View>
          </TouchableOpacity>
          {transactionDateMenuOpen && Platform.OS !== "web" ? (
            <View style={styles.transactionDatePicker}>
              <DateTimePicker
                value={isValidTransactionDate(transactionDate) ? transactionDate : new Date()}
                mode='date'
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={(event, selectedDate) => {
                  if (event.type === "dismissed") {
                    setTransactionDateMenuOpen(false);
                    return;
                  }
                  if (selectedDate) handleTransactionDateChange(selectedDate);
                }}
              />
            </View>
          ) : null}
        </View>
        {transactionsLoading ? (
          <View style={styles.receiptLoadingRow}>
            <ActivityIndicator size='small' color='#9C45F7' />
            <Text style={styles.receiptLoadingText}>Loading your purchases...</Text>
          </View>
        ) : receiptOptions.length > 0 ? (
          <View style={styles.receiptPickerSection}>
            <TouchableOpacity onPress={toggleReceiptMenu} style={styles.uploadButton} activeOpacity={0.7}>
              <View style={styles.uploadButtonContent}>
                <Text style={styles.uploadButtonText} numberOfLines={2}>
                  {selectedReceiptLabel || "Select Receipt"}
                </Text>
                <Ionicons name={receiptMenuOpen ? "chevron-up" : "chevron-down"} size={18} color='#333' />
              </View>
            </TouchableOpacity>
            {receiptMenuOpen ? (
              <View style={styles.receiptList}>
                {receiptOptions.map((option) => {
                  const isSelected = option.value === selectedTransactionUid;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => handleReceiptSelection(option)}
                      style={[styles.receiptListItem, isSelected && styles.receiptListItemSelected]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.receiptListItemText, isSelected && styles.receiptListItemTextSelected]} numberOfLines={2}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}
        <TouchableOpacity onPress={pickReceipt} style={styles.uploadButton}>
          <Text>{receiptOptions.length > 0 ? "Upload Receipt (optional)" : "Upload Receipt"}</Text>
        </TouchableOpacity>
        {receiptFile ? (
          <View style={styles.photoCarousel}>
            <View style={styles.photoImageRow}>
              <View style={styles.photoThumbWrapper}>
                {isReceiptImage(receiptFile) ? (
                  <Image source={{ uri: receiptFile.uri }} style={styles.photoThumb} resizeMode='cover' />
                ) : (
                  <View style={[styles.photoThumb, styles.receiptPdfThumb]}>
                    <Ionicons name='document-text-outline' size={30} color='#9C45F7' />
                    <Text style={styles.receiptPdfLabel}>{isReceiptPdf(receiptFile) ? "PDF" : "Receipt"}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.photoDeleteIcon} onPress={() => setReceiptFile(null)} accessibilityLabel='Remove receipt'>
                  <Text style={styles.photoDeleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
        <TouchableOpacity onPress={pickUploadedImages} style={styles.uploadButton}>
          <Text>Add Photos (optional)</Text>
        </TouchableOpacity>
        {uploadedImages.length > 0 ? (
          <View style={styles.photoCarousel}>
            <Text style={styles.photoHelperText}>Tap any image to set as favorite. Tap ✕ to remove.</Text>
            <View style={styles.photoImageRow}>
              {uploadedImages.map((asset, index) => {
                const isFavorite = favoriteIndex === index;
                return (
                  <View key={`${asset.uri}-${index}`} style={styles.photoThumbWrapper}>
                    <TouchableOpacity onPress={() => setFavoriteIndex(index)} activeOpacity={0.8} accessibilityLabel={`Review photo ${index + 1}${isFavorite ? ", favorite" : ""}`}>
                      <Image source={{ uri: asset.uri }} style={[styles.photoThumb, isFavorite && styles.photoThumbSelected]} resizeMode='cover' />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoDeleteIcon} onPress={() => removeUploadedImage(index)} accessibilityLabel={`Remove review photo ${index + 1}`}>
                      <Text style={styles.photoDeleteText}>✕</Text>
                    </TouchableOpacity>
                    {isFavorite ? (
                      <View style={styles.photoFavoriteBadge}>
                        <Text style={styles.photoFavoriteBadgeText}>✓</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
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
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  label: { fontSize: 16, marginTop: 10 },
  ratingRow: { flexDirection: "row", marginVertical: 10, alignItems: "center" },
  ratingTouchable: { cursor: "pointer", padding: 2 },
  ratingPressed: { opacity: 0.7 },
  circle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "#ccc", marginHorizontal: 5 },
  ratingText: { fontSize: 14, color: "#9C45F7", fontWeight: "600", marginTop: 5, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, minHeight: 80, marginTop: 5 },
  receiptLoadingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  receiptLoadingText: { fontSize: 14, color: "#666" },
  receiptPickerSection: { marginTop: 10 },
  transactionDateSection: { marginTop: 10 },
  transactionDatePicker: { marginTop: 4 },
  uploadButton: { padding: 10, backgroundColor: "#eee", borderRadius: 8, marginTop: 10, alignItems: "center" },
  uploadButtonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, width: "100%" },
  uploadButtonText: { flex: 1, textAlign: "center", fontSize: 16, color: "#333" },
  hiddenWebDateInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
    overflow: "hidden",
    pointerEvents: "none",
  },
  receiptList: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  receiptListItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  receiptListItemSelected: { backgroundColor: "#f3e8ff" },
  receiptListItemText: { fontSize: 14, color: "#333" },
  receiptListItemTextSelected: { color: "#9C45F7", fontWeight: "600" },
  photoCarousel: { marginTop: 10, width: "100%" },
  photoHelperText: { fontSize: 13, color: "#666", marginBottom: 8 },
  photoImageRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  photoThumbWrapper: { position: "relative", marginRight: 10, marginBottom: 10, width: 80, height: 80 },
  photoThumb: { width: 80, height: 80, borderRadius: 10, backgroundColor: "#f0f0f0" },
  photoThumbSelected: { borderWidth: 3, borderColor: "#9C45F7" },
  photoDeleteIcon: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#ff3b30",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  photoDeleteText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  photoFavoriteBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "#9C45F7",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  photoFavoriteBadgeText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  receiptPdfThumb: { justifyContent: "center", alignItems: "center", paddingHorizontal: 6 },
  receiptPdfLabel: { marginTop: 4, fontSize: 11, fontWeight: "600", color: "#9C45F7", textAlign: "center" },
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
