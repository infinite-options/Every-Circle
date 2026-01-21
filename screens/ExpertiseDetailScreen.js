// ExpertiseDetailScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MiniCard from "../components/MiniCard";
import AppHeader from "../components/AppHeader";
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
import { CREATE_PAYMENT_INTENT_ENDPOINT, TRANSACTIONS_ENDPOINT, GET_STRIPE_PUBLIC_KEY_ENDPOINT } from "../apiConfig";

// Web Stripe imports (only load on web)
let loadStripe = null;
if (isWeb) {
  try {
    loadStripe = require("@stripe/stripe-js").loadStripe;
  } catch (e) {
    console.warn("Stripe web library not available:", e.message);
  }
}

// Web Stripe components
import StripePayment from "../components/StripePaymentWeb";
import StripeFeesDialog from "../components/StripeFeesDialog";
import PaymentFailure from "../components/PaymentFailure";

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

  // Web Stripe state
  const [stripePromise, setStripePromise] = useState(null);
  const [showStripePayment, setShowStripePayment] = useState(false);
  const [showFeesDialog, setShowFeesDialog] = useState(false);
  const [showPaymentFailure, setShowPaymentFailure] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [customerUid, setCustomerUid] = useState(null);

  // Initialize Stripe on mount
  useEffect(() => {
    // Initialize Stripe - for web, we load the key dynamically, for mobile we use env var
    if (isWeb) {
      // Web: Don't require env var, we'll load Stripe key dynamically when needed
      console.log("Web platform detected - Stripe key will be loaded dynamically");
      setStripeInitialized(true);
    } else {
      // Mobile: Require env var for native Stripe
      if (STRIPE_PUBLISHABLE_KEY) {
        console.log("Initializing Stripe with publishable key");
        setStripeInitialized(true);
      } else {
        console.error("Stripe publishable key not found");
      }
    }

    // Get customer UID for web Stripe
    const getCustomerUid = async () => {
      try {
        const uid = await AsyncStorage.getItem("profile_uid");
        setCustomerUid(uid);
      } catch (error) {
        console.error("Error getting customer UID:", error);
      }
    };
    getCustomerUid();
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

  // Load Stripe public key for web
  const loadStripePublicKey = async (businessCode = "ECTEST") => {
    try {
      console.log("============================================");
      console.log("Loading Stripe public key for business code:", businessCode);
      // Determine environment: ECTEST → PMTEST, EC → PM
      const environment = businessCode === "ECTEST" ? "PMTEST" : businessCode === "EC" ? "PM" : "PMTEST";
      console.log("Mapped environment for Stripe key lookup:", environment);
      const url = `${GET_STRIPE_PUBLIC_KEY_ENDPOINT}/${environment}`;

      console.log("Fetching Stripe key from URL:", url);
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Stripe key: ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log("Full response data:", JSON.stringify(responseData, null, 2));
      console.log("Response keys:", Object.keys(responseData));

      // Handle both camelCase (publicKey) and UPPERCASE (PUBLISHABLE_KEY) response formats
      const publicKey = responseData.publicKey || responseData.PUBLISHABLE_KEY;

      if (!publicKey) {
        console.error("Response structure:", responseData);
        console.error("Available keys:", Object.keys(responseData));
        throw new Error("Public key not found in response. Expected 'publicKey' or 'PUBLISHABLE_KEY'");
      }
      const last4Digits = publicKey.length >= 4 ? publicKey.slice(-4) : "N/A";
      console.log("Stripe public key received (last 4 digits):", last4Digits);
      console.log("Full public key length:", publicKey.length);
      console.log("Public key starts with:", publicKey.substring(0, 10) + "...");

      // Load Stripe with public key
      if (loadStripe) {
        const stripe = await loadStripe(publicKey);
        setStripePromise(stripe);
        console.log("Stripe loaded successfully with key ending in:", last4Digits);
        console.log("============================================");
        return stripe;
      } else {
        throw new Error("Stripe loadStripe function not available");
      }
    } catch (error) {
      console.error("Error loading Stripe public key:", error);
      console.error("Error details:", error.message);
      console.log("============================================");
      Alert.alert("Error", "Failed to initialize payment system. Please try again.");
      throw error;
    }
  };

  // Handle fees dialog continue
  const handleFeesDialogContinue = async () => {
    try {
      setShowFeesDialog(false);
      setLoading(true);

      // Get the amount from stored state (we stored it as a string in currentClientSecret)
      const amount = parseFloat(currentClientSecret || "0");

      // Load Stripe public key
      await loadStripePublicKey("ECTEST");

      // Show Stripe payment modal
      setShowStripePayment(true);
      setLoading(false);
    } catch (error) {
      console.error("Error loading Stripe:", error);
      Alert.alert("Error", "Failed to initialize payment. Please try again.");
      setLoading(false);
    }
  };

  // Web Stripe payment submission handler
  const handleWebPaymentSubmit = async (paymentIntent, paymentMethod) => {
    try {
      setLoading(true);
      console.log("Web payment submitted - paymentIntent:", paymentIntent, "paymentMethod:", paymentMethod);

      // Get the buyer's ID
      const buyerUid = await AsyncStorage.getItem("profile_uid");
      if (!buyerUid) {
        throw new Error("User ID not found");
      }

      // Parse cost amount
      const costString = expertiseData?.cost || "0";
      const match = costString.match(/[\d.]+/);
      const amount = match ? parseFloat(match[0]) : 0;

      // Calculate amounts with 3% processing fee
      const processingFee = amount * 0.03;
      const totalAmount = amount + processingFee;

      console.log("Web payment amounts - Subtotal:", amount, "Processing Fee (3%):", processingFee, "Total:", totalAmount);

      // Extract payment intent ID from client secret
      const paymentIntentId = paymentIntent.split("_secret_")[0];

      // Record the transaction - update to include fee in total_amount_paid but keep costs separate
      // We'll modify recordTransaction to accept fee separately or update the transaction data
      const transactionData = {
        profile_id: buyerUid,
        business_id: profile_uid,
        stripe_payment_intent: paymentIntentId,
        total_amount_paid: totalAmount,
        total_costs: amount,
        total_taxes: processingFee,
        items: [
          {
            expertise_uid: expertiseData?.expertise_uid,
            bounty: parseFloat(expertiseData?.bounty) || 0,
            quantity: 1,
            recommender_profile_id: profile_uid,
          },
        ],
      };

      const response = await fetch(TRANSACTIONS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transactionData),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(`Failed to record transaction: ${result.message || "Unknown error"}`);
      }

      // Navigate back
      if (returnTo === "Profile" && profileState) {
        console.log("🔙 Returning to Profile after payment with preserved state");
        navigation.navigate("Profile", profileState);
      } else if (searchState) {
        console.log("🔙 Returning to Search after payment with preserved state");
        navigation.navigate("Search", {
          restoreState: true,
          searchState: searchState,
        });
      } else {
        navigation.navigate("Search");
      }

      Alert.alert("Success", "Payment successful! Your purchase has been completed.");
    } catch (error) {
      console.error("Web payment submission error:", error);
      setPaymentError(error);
      setShowPaymentFailure(true);
    } finally {
      setLoading(false);
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

    // Parse cost amount (handle formats like "25/hr", "USD 15", "$15", etc.)
    const costString = expertiseData?.cost || "0";
    const match = costString.match(/[\d.]+/);
    const amount = match ? parseFloat(match[0]) : 0;

    if (amount <= 0) {
      Alert.alert("Error", "Invalid cost amount");
      return;
    }

    // Web Stripe flow
    if (isWeb) {
      try {
        setLoading(true);
        // Show fees dialog first
        setShowFeesDialog(true);
        // Store amount for later use
        setCurrentClientSecret(amount.toString()); // Reuse this state to store amount temporarily
      } catch (error) {
        console.error("Error starting web checkout:", error);
        Alert.alert("Error", "An error occurred. Please try again.");
        setLoading(false);
      }
      return;
    }

    // Native Stripe flow
    try {
      setLoading(true);

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
      <AppHeader
        title="Expertise"
        backgroundColor="#FF9500"
        darkModeBackgroundColor="#CC7700"
        onBackPress={handleBack}
      />

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

      {/* Web Stripe Components */}
      {isWeb && (
        <>
          <StripeFeesDialog
            show={showFeesDialog}
            setShow={setShowFeesDialog}
            onContinue={handleFeesDialogContinue}
            onCancel={() => {
              setShowFeesDialog(false);
              setLoading(false);
            }}
          />
          {stripePromise && customerUid && currentClientSecret && (
            <StripePayment
              message='ECTEST'
              amount={parseFloat(currentClientSecret) * 1.03} // Add 3% fee
              paidBy={customerUid}
              show={showStripePayment}
              setShow={setShowStripePayment}
              submit={handleWebPaymentSubmit}
              stripePromise={stripePromise}
            />
          )}
          <PaymentFailure
            show={showPaymentFailure}
            setShow={setShowPaymentFailure}
            onGoToDashboard={() => {
              setShowPaymentFailure(false);
              if (returnTo === "Profile" && profileState) {
                navigation.navigate("Profile", profileState);
              } else if (searchState) {
                navigation.navigate("Search", {
                  restoreState: true,
                  searchState: searchState,
                });
              } else {
                navigation.navigate("Search");
              }
            }}
          />
        </>
      )}
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
  safeArea: {
    flex: 1,
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
