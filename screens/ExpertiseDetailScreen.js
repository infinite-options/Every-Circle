// ExpertiseDetailScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MiniCard from "../components/MiniCard";
import { useDarkMode } from "../contexts/DarkModeContext";

// Only import Stripe on native platforms (not web)
let StripeProvider = null;
let useStripe = null;
const isWeb = typeof window !== "undefined" && typeof document !== "undefined";
if (!isWeb) {
  try {
    const stripeModule = require("@stripe/stripe-react-native");
    StripeProvider = stripeModule.StripeProvider;
    useStripe = stripeModule.useStripe;
  } catch (e) {
    console.warn("Stripe not available:", e.message);
  }
}

import { REACT_APP_STRIPE_PUBLIC_KEY } from "@env";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CREATE_PAYMENT_INTENT_ENDPOINT, TRANSACTIONS_ENDPOINT } from "../apiConfig";

const STRIPE_PUBLISHABLE_KEY = REACT_APP_STRIPE_PUBLIC_KEY;

const ExpertiseDetailScreenContent = ({ route, navigation }) => {
  const { expertiseData, profileData, profile_uid, searchState, returnTo, profileState } = route.params;
  const { darkMode } = useDarkMode();
  
  // Only use Stripe hook if available (not on web)
  let initPaymentSheet, presentPaymentSheet;
  if (useStripe && !isWeb) {
    const stripeHook = useStripe();
    initPaymentSheet = stripeHook.initPaymentSheet;
    presentPaymentSheet = stripeHook.presentPaymentSheet;
  } else {
    // Fallback functions for web
    initPaymentSheet = () => Promise.resolve({ error: null });
    presentPaymentSheet = () => Promise.resolve({ error: { message: "Stripe not available on web" } });
  }
  const [loading, setLoading] = useState(false);
  const [stripeInitialized, setStripeInitialized] = useState(false);
  const [currentClientSecret, setCurrentClientSecret] = useState(null);

  // Initialize Stripe on mount
  useEffect(() => {
    if (STRIPE_PUBLISHABLE_KEY) {
      console.log("Initializing Stripe with publishable key");
      setStripeInitialized(true);
    } else {
      console.error("Stripe publishable key not found");
    }
  }, []);

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

  const createPaymentIntent = async (amount) => {
    try {
      console.log("Creating payment intent for expertise purchase...");
      const profile_uid = await AsyncStorage.getItem("profile_uid");
      console.log("User profile UID:", profile_uid);

      if (!profile_uid) {
        throw new Error("User profile not found");
      }

      console.log("Creating payment intent for amount:", amount);

      const requestBody = {
        customer_uid: profile_uid,
        business_code: "ECTEST",
        payment_summary: {
          tax: 0,
          total: amount.toString(),
        },
      };

      console.log("Payment Intent Request:", JSON.stringify(requestBody, null, 2));

      const response = await fetch(CREATE_PAYMENT_INTENT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log("Expertise Payment intent created:", data);

      if (typeof data !== "string") {
        throw new Error("Invalid response format from payment intent creation");
      }

      return data; // Return the client secret
    } catch (error) {
      console.error("Error creating payment intent:", error);
      throw error;
    }
  };

  const recordTransaction = async (buyerUid, paymentIntent, amount) => {
    try {
      console.log("Recording transaction...");
      console.log("Buyer UID:", buyerUid);
      console.log("Seller UID:", profile_uid);
      console.log("Payment Intent:", paymentIntent);
      console.log("Expertise UID:", expertiseData?.expertise_uid);
      console.log("Amount:", amount);
      console.log("Transaction Type:", "expertise_purchase");

      // Format transaction data to match the API's expected format
      // For expertise purchases, we'll use a format similar to business transactions
      // Use seller UID (profile_uid) as business_id for expertise transactions
      const transactionData = {
        profile_id: buyerUid,
        business_id: profile_uid, // Use seller's profile UID as business_id for expertise
        stripe_payment_intent: paymentIntent,
        total_amount_paid: parseFloat(amount),
        total_costs: parseFloat(amount),
        total_taxes: 0,
        items: [
          {
            expertise_uid: expertiseData?.expertise_uid,
            bounty: parseFloat(expertiseData?.bounty) || 0,
            quantity: 1,
            recommender_profile_id: profile_uid, // Use seller UID as recommender for expertise purchases
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

  const initializePayment = async (amount) => {
    try {
      console.log("Initializing payment...");
      setLoading(true);

      if (amount <= 0) {
        Alert.alert("Error", "Invalid cost amount");
        setLoading(false);
        return { success: false, clientSecret: null };
      }

      const clientSecret = await createPaymentIntent(amount);
      console.log("Initializing payment sheet with client secret");

      setCurrentClientSecret(clientSecret);

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: expertiseData?.title || "Expertise Purchase",
        paymentIntentClientSecret: clientSecret,
        defaultBillingDetails: {
          name: `${profileData?.firstName || ""} ${profileData?.lastName || ""}`.trim() || "Customer Name",
        },
        appearance: {
          colors: {
            primary: "#9C45F7",
          },
        },
      });

      if (initError) {
        console.error("Payment initialization error:", initError);
        Alert.alert("Error", "Failed to initialize payment. Please try again.");
        setLoading(false);
        return { success: false, clientSecret: null };
      }

      setLoading(false);
      return { success: true, clientSecret: clientSecret };
    } catch (error) {
      console.error("Error initializing payment:", error);
      Alert.alert("Error", "Failed to initialize payment. Please try again.");
      setLoading(false);
      return { success: false, clientSecret: null };
    }
  };

  const handleBuyNow = async () => {
    console.log("Buy Now clicked for expertise:", expertiseData?.expertise_uid);

    if (!stripeInitialized) {
      Alert.alert("Error", "Payment system is not ready. Please try again.");
      return;
    }

    if (!expertiseData?.cost) {
      Alert.alert("Error", "Cost information is not available for this expertise.");
      return;
    }

    try {
      setLoading(true);

      // Parse cost amount (handle formats like "25/hr", "USD 15", "$15", etc.)
      const costString = expertiseData?.cost || "0";
      // Extract the first number (before any "/" or space)
      const match = costString.match(/[\d.]+/);
      const amount = match ? parseFloat(match[0]) : 0;

      if (amount <= 0) {
        Alert.alert("Error", "Invalid cost amount");
        setLoading(false);
        return;
      }

      const initResult = await initializePayment(amount);
      if (!initResult.success || !initResult.clientSecret) {
        console.error("Payment initialization failed or client secret not returned");
        return;
      }

      // Store the client secret locally to avoid state timing issues
      const clientSecret = initResult.clientSecret;
      console.log("Stored client secret for transaction:", clientSecret);

      console.log("Presenting payment sheet...");
      const result = await presentPaymentSheet();

      if (result.error) {
        console.error("Payment error:", result.error);
        Alert.alert("Error", "Payment failed. Please try again.");
        setLoading(false);
        return;
      }

      console.log("Payment successful!");

      // Record the transaction
      const buyerUid = await AsyncStorage.getItem("profile_uid");
      if (!buyerUid) {
        throw new Error("User ID not found");
      }

      // Extract payment intent ID from client secret
      // Client secret format: pi_xxx_secret_yyy
      // We need just the payment intent ID: pi_xxx
      if (!clientSecret) {
        console.error("clientSecret is null or undefined");
        throw new Error("Payment intent not found. Please try again.");
      }

      // Extract payment intent ID (the part before _secret_)
      const paymentIntentId = clientSecret.split("_secret_")[0];
      console.log("Extracted payment intent ID:", paymentIntentId);
      console.log("Full client secret:", clientSecret);

      if (!paymentIntentId || paymentIntentId.trim() === "") {
        console.error("Failed to extract payment intent ID from:", clientSecret);
        throw new Error("Invalid payment intent. Please try again.");
      }

      // Use the same amount that was used for payment
      await recordTransaction(buyerUid, paymentIntentId, amount);

      // Navigate back to Profile if that's where we came from
      if (returnTo === "Profile" && profileState) {
        console.log("🔙 Returning to Profile after payment with preserved state");
        navigation.navigate("Profile", profileState);
      } else if (searchState) {
        // Navigate back to Search page with preserved state
        console.log("🔙 Returning to Search after payment with preserved state");
        navigation.navigate("Search", {
          restoreState: true,
          searchState: searchState,
        });
      } else {
        navigation.navigate("Search");
      }
    } catch (error) {
      console.error("Error processing payment:", error);
      Alert.alert("Error", "An error occurred during payment. Please try again.");
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
    <View style={[styles.pageContainer, darkMode && styles.darkPageContainer]}>
      {/* Header with Back Button */}
      <View style={[styles.headerBg, darkMode && styles.darkHeaderBg]}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name='arrow-back' size={24} color='#fff' />
          </TouchableOpacity>
          <Text style={[styles.header, darkMode && styles.darkHeader, styles.headerWithBack]}>Expertise</Text>
        </View>
      </View>

      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {/* User MiniCard - Clickable */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              console.log("🏢 Navigating to Profile from MiniCard in ExpertiseDetail");
              if (profile_uid) {
                navigation.navigate("Profile", {
                  profile_uid: profile_uid,
                  returnTo: returnTo === "Profile" ? "ExpertiseDetail" : "ExpertiseDetail",
                  expertiseDetailState: {
                    expertiseData,
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

          {/* Expertise Description */}
          <View style={[styles.card, darkMode && styles.darkCard]}>
            <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>Expertise Description</Text>

            {expertiseData?.title && <Text style={[styles.expertiseTitle, darkMode && styles.darkExpertiseTitle]}>{expertiseData.title}</Text>}

            {expertiseData?.description && <Text style={[styles.expertiseDescription, darkMode && styles.darkExpertiseDescription]}>{expertiseData.description}</Text>}

            {/* Expertise Details */}
            {expertiseData?.details && (
              <View style={styles.detailsContainer}>
                <Text style={[styles.detailsTitle, darkMode && styles.darkDetailsTitle]}>Expertise Details</Text>
                <Text style={[styles.detailsText, darkMode && styles.darkDetailsText]}>{expertiseData.details}</Text>
              </View>
            )}

            {/* Cost and Bounty */}
            <View style={styles.pricingContainer}>
              {expertiseData?.cost && (
                <View style={styles.pricingRow}>
                  <View style={styles.moneyBagIconContainer}>
                    <Text style={styles.moneyBagDollarSymbol}>$</Text>
                  </View>
                  <Text style={[styles.pricingLabel, darkMode && styles.darkPricingLabel]}>Cost: {expertiseData.cost}</Text>
                </View>
              )}
              {expertiseData?.bounty && (
                <View style={styles.pricingRow}>
                  <Text style={styles.bountyEmojiIcon}>💰</Text>
                  <Text style={[styles.pricingLabel, darkMode && styles.darkPricingLabel]}>Bounty: USD {expertiseData.bounty}</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Buy Now Button */}
        <View style={[styles.buyNowContainer, darkMode && styles.darkBuyNowContainer]}>
          <TouchableOpacity style={[styles.buyNowButton, darkMode && styles.darkBuyNowButton, loading && styles.disabledButton]} onPress={handleBuyNow} disabled={loading}>
            <Text style={styles.buyNowButtonText}>{loading ? "Processing..." : "Buy Now"}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

export default function ExpertiseDetailScreen({ route, navigation }) {
  const content = <ExpertiseDetailScreenContent route={route} navigation={navigation} />;
  
  // Only wrap with StripeProvider on native platforms
  if (StripeProvider && !isWeb && STRIPE_PUBLISHABLE_KEY) {
    return <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>{content}</StripeProvider>;
  }
  
  return content;
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  headerBg: {
    backgroundColor: "#FF9500",
    paddingTop: 30,
    paddingBottom: 15,
    alignItems: "center",
    borderBottomLeftRadius: 300,
    borderBottomRightRadius: 300,
  },
  darkHeaderBg: {
    backgroundColor: "#CC7700",
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
    left: 53,
    padding: 4,
    zIndex: 1,
  },
  safeArea: {
    flex: 1,
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
  expertiseTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  expertiseDescription: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
    marginBottom: 20,
  },
  pricingContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  pricingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  moneyBagIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFCD3C",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  moneyBagDollarSymbol: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ffffff",
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
  buyNowContainer: {
    padding: 20,
    paddingBottom: 30,
    backgroundColor: "#F5F5F5",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  buyNowButton: {
    backgroundColor: "#00C7BE",
    borderRadius: 30,
    paddingVertical: 15,
    paddingHorizontal: 40,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    minWidth: 200,
  },
  buyNowButtonText: {
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
  darkExpertiseTitle: {
    color: "#fff",
  },
  darkExpertiseDescription: {
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
  darkBuyNowContainer: {
    backgroundColor: "#1a1a1a",
    borderTopColor: "#404040",
  },
  darkBuyNowButton: {
    backgroundColor: "#00A69C",
  },
  disabledButton: {
    opacity: 0.6,
  },
});
