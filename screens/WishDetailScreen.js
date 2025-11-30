// WishDetailScreen.js
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MiniCard from "../components/MiniCard";
import { useDarkMode } from "../contexts/DarkModeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TRANSACTIONS_ENDPOINT, PROFILE_WISH_INFO_ENDPOINT } from "../apiConfig";

const WishDetailScreenContent = ({ route, navigation }) => {
  const { wishData, profileData, profile_uid, searchState, returnTo, profileState } = route.params;
  const { darkMode } = useDarkMode();
  const [loading, setLoading] = useState(false);
  const [howICanHelp, setHowICanHelp] = useState("");

  // Create user object for MiniCard
  const userForMiniCard = {
    firstName: profileData?.firstName || "",
    lastName: profileData?.lastName || "",
    email: profileData?.email || "",
    phoneNumber: profileData?.phone || "",
    profileImage: profileData?.image || "",
    tagLine: profileData?.tagLine || "",
    emailIsPublic: profileData?.emailIsPublic || false,
    phoneIsPublic: profileData?.phoneIsPublic || false,
    tagLineIsPublic: profileData?.tagLineIsPublic || false,
    imageIsPublic: profileData?.imageIsPublic || false,
  };

  const recordTransaction = async (buyerUid) => {
    try {
      console.log("Recording wish transaction...");
      console.log("Buyer UID:", buyerUid);
      console.log("Seller UID:", profile_uid);
      console.log("Wish UID:", wishData?.wish_uid);
      console.log("Amount: 0 (wishes have no cost)");
      console.log("Transaction Type:", "wish_purchase");

      // Format transaction data to match the API's expected format
      // For wish purchases, cost is always 0, no payment intent needed
      // Use seller UID (profile_uid) as business_id for wish transactions
      const transactionData = {
        profile_id: buyerUid,
        business_id: profile_uid, // Use seller's profile UID as business_id for wishes
        stripe_payment_intent: null, // No payment intent for wishes (cost = 0)
        total_amount_paid: 0, // Wishes have no cost
        total_costs: 0, // Wishes have no cost
        total_taxes: 0,
        items: [
          {
            wish_uid: wishData?.wish_uid,
            bounty: parseFloat(wishData?.bounty) || 0,
            quantity: 1,
            recommender_profile_id: null, // No recommender for direct wish purchases
          },
        ],
      };

      console.log("============================================");
      console.log("ENDPOINT: RECORD_TRANSACTIONS");
      console.log("URL:", TRANSACTIONS_ENDPOINT);
      console.log("METHOD: POST");
      console.log("REQUEST BODY:", JSON.stringify(transactionData, null, 2));
      console.log("============================================");

      const response = await fetch(TRANSACTIONS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transactionData),
      });

      console.log("RESPONSE STATUS:", response.status);
      console.log("RESPONSE OK:", response.ok);

      const result = await response.json();
      console.log("RESPONSE BODY:", JSON.stringify(result, null, 2));

      if (!response.ok) {
        throw new Error(`Failed to record transaction: ${result.message || "Unknown error"}`);
      }

      console.log("Transaction recorded successfully");
    } catch (error) {
      console.error("Error recording transaction:", error);
      throw error;
    }
  };

  const handleAccept = async () => {
    console.log("Submit clicked for wish:", wishData?.wish_uid);

    try {
      setLoading(true);

      // Get the current user's profile_uid
      const responder_id = await AsyncStorage.getItem("profile_uid");
      if (!responder_id) {
        Alert.alert("Error", "User profile not found. Please try again.");
        setLoading(false);
        return;
      }

      // Get the profile_wish_id from wishData
      const profile_wish_id = wishData?.wish_uid || wishData?.profile_wish_id;
      if (!profile_wish_id) {
        Alert.alert("Error", "Wish information not found. Please try again.");
        setLoading(false);
        return;
      }

      // Prepare the request body
      const requestBody = {
        profile_wish_id: profile_wish_id,
        responder_id: responder_id,
        responder_note: howICanHelp || "I can do this for you!",
      };

      console.log("============================================");
      console.log("ENDPOINT: PROFILE_WISH_INFO");
      console.log("URL:", PROFILE_WISH_INFO_ENDPOINT);
      console.log("METHOD: POST");
      console.log("REQUEST BODY:", JSON.stringify(requestBody, null, 2));
      console.log("============================================");

      // Make the API call
      const response = await fetch(PROFILE_WISH_INFO_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("RESPONSE STATUS:", response.status);
      console.log("RESPONSE OK:", response.ok);

      const result = await response.json();
      console.log("RESPONSE BODY:", JSON.stringify(result, null, 2));

      if (!response.ok) {
        throw new Error(result.message || "Failed to submit response");
      }

      console.log("Response submitted successfully");
      Alert.alert("Success", "Your response has been submitted!");

      // Navigate back to Profile if that's where we came from
      if (returnTo === "Profile" && profileState) {
        console.log("🔙 Returning to Profile after submitting wish with preserved state");
        navigation.navigate("Profile", profileState);
      } else if (searchState) {
        // Navigate back to Search page with preserved state
        console.log("🔙 Returning to Search after submitting wish with preserved state");
        navigation.navigate("Search", {
          restoreState: true,
          searchState: searchState,
        });
      } else {
        navigation.navigate("Search");
      }
    } catch (error) {
      console.error("Error submitting response:", error);
      Alert.alert("Error", error.message || "Failed to submit response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    // Return to Profile screen if that's where we came from
    if (returnTo === "Profile" && profileState) {
      console.log("🔙 Returning to Profile with preserved state:", profileState);
      navigation.navigate("Profile", profileState);
    } else if (searchState) {
      // Return to Search screen with preserved state
      console.log("🔙 Returning to Search with preserved state:", searchState);
      navigation.navigate("Search", {
        restoreState: true,
        searchState: searchState,
      });
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={[styles.pageContainer, darkMode && styles.darkPageContainer]}>
      {/* Header with Back Button */}
      <View style={[styles.headerBg, darkMode && styles.darkHeaderBg]}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name='arrow-back' size={24} color='#fff' />
          </TouchableOpacity>
          <Text style={[styles.header, darkMode && styles.darkHeader, styles.headerWithBack]}>Seeking</Text>
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* User MiniCard - Clickable */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            console.log("🏢 Navigating to Profile from MiniCard in WishDetail");
            if (profile_uid) {
              navigation.navigate("Profile", {
                profile_uid: profile_uid,
                returnTo: returnTo === "Profile" ? "WishDetail" : "WishDetail",
                wishDetailState: {
                  wishData,
                  profileData,
                  profile_uid,
                  searchState,
                  returnTo,
                  profileState,
                },
              });
            }
          }}
        >
          <View style={[styles.card, darkMode && styles.darkCard]}>
            <MiniCard user={userForMiniCard} />
          </View>
        </TouchableOpacity>

        {/* Wish Description */}
        <View style={[styles.card, darkMode && styles.darkCard]}>
          <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>Seeking Description</Text>

          {wishData?.title && <Text style={[styles.wishTitle, darkMode && styles.darkWishTitle]}>{wishData.title}</Text>}

          {wishData?.description && <Text style={[styles.wishDescription, darkMode && styles.darkWishDescription]}>{wishData.description}</Text>}

          {/* Wish Details */}
          {wishData?.details && (
            <View style={styles.detailsContainer}>
              <Text style={[styles.detailsTitle, darkMode && styles.darkDetailsTitle]}>Seeking Details</Text>
              <Text style={[styles.detailsText, darkMode && styles.darkDetailsText]}>{wishData.details}</Text>
            </View>
          )}

          {/* Bounty (wishes have no cost, only bounty) */}
          {wishData?.bounty && (
            <View style={styles.pricingContainer}>
              <View style={styles.pricingRow}>
                <Text style={styles.bountyEmojiIcon}>💰</Text>
                <Text style={[styles.pricingLabel, darkMode && styles.darkPricingLabel]}>Bounty: USD {wishData.bounty}</Text>
              </View>
            </View>
          )}
        </View>

        {/* How I Can Help Section */}
        <View style={[styles.card, darkMode && styles.darkCard]}>
          <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>How I Can Help</Text>
          <TextInput
            style={[styles.textInput, darkMode && styles.darkTextInput]}
            placeholder='Explain why you are perfect for this gig...'
            placeholderTextColor={darkMode ? "#888" : "#999"}
            multiline
            numberOfLines={6}
            value={howICanHelp}
            onChangeText={setHowICanHelp}
            textAlignVertical='top'
          />
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={[styles.acceptContainer, darkMode && styles.darkAcceptContainer]}>
        <TouchableOpacity style={[styles.acceptButton, darkMode && styles.darkAcceptButton, loading && styles.disabledButton]} onPress={handleAccept} disabled={loading}>
          <Text style={styles.acceptButtonText}>{loading ? "Submitting..." : "Submit"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default function WishDetailScreen({ route, navigation }) {
  return <WishDetailScreenContent route={route} navigation={navigation} />;
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  headerBg: {
    backgroundColor: "#FF9500",
    paddingVertical: 15,
    alignItems: "center",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 20,
    position: "relative",
  },
  backButton: {
    position: "absolute",
    left: 20,
    padding: 4,
    zIndex: 1,
  },
  header: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  headerWithBack: {
    marginLeft: 0,
  },
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    marginBottom: 15,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  wishTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  wishDescription: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
    marginBottom: 20,
  },
  pricingContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 10,
  },
  pricingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bountyEmojiIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  pricingLabel: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  detailsContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  detailsText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  acceptContainer: {
    padding: 20,
    paddingBottom: 30,
    backgroundColor: "#F5F5F5",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  acceptButton: {
    backgroundColor: "#00C7BE",
    borderRadius: 30,
    paddingVertical: 15,
    paddingHorizontal: 40,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    minWidth: 200,
  },
  acceptButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  // Dark mode styles
  darkPageContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkHeaderBg: {
    backgroundColor: "#CC7700",
  },
  darkHeader: {
    color: "#fff",
  },
  darkCard: {
    backgroundColor: "#2d2d2d",
  },
  darkCardTitle: {
    color: "#fff",
  },
  darkWishTitle: {
    color: "#fff",
  },
  darkWishDescription: {
    color: "#cccccc",
  },
  darkPricingLabel: {
    color: "#cccccc",
  },
  darkDetailsTitle: {
    color: "#fff",
  },
  darkDetailsText: {
    color: "#cccccc",
  },
  darkAcceptContainer: {
    backgroundColor: "#1a1a1a",
    borderTopColor: "#404040",
  },
  darkAcceptButton: {
    backgroundColor: "#00A69C",
  },
  disabledButton: {
    opacity: 0.6,
  },
  textInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333",
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    textAlignVertical: "top",
  },
  darkTextInput: {
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderColor: "#404040",
  },
});
