// WishResponsesScreen.js
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MiniCard from "../components/MiniCard";
import { useDarkMode } from "../contexts/DarkModeContext";
import AppHeader from "../components/AppHeader";

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
import { PROFILE_WISH_INFO_ENDPOINT, CREATE_PAYMENT_INTENT_ENDPOINT, TRANSACTIONS_ENDPOINT, GET_STRIPE_PUBLIC_KEY_ENDPOINT } from "../apiConfig";

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

const WishResponsesScreenContent = ({ route, navigation }) => {
  const { wishData, profileData, profile_uid, profileState } = route.params;
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
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState([]);
  const [accepting, setAccepting] = useState(null);
  const [stripeInitialized, setStripeInitialized] = useState(false);
  const [currentClientSecret, setCurrentClientSecret] = useState(null);

  // Web Stripe state
  const [stripePromise, setStripePromise] = useState(null);
  const [showStripePayment, setShowStripePayment] = useState(false);
  const [showFeesDialog, setShowFeesDialog] = useState(false);
  const [showPaymentFailure, setShowPaymentFailure] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [customerUid, setCustomerUid] = useState(null);
  const [pendingAccept, setPendingAccept] = useState(null); // { responderProfileUid, wishResponseUid, subtotal }

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

  // Initialize Stripe on mount
  useEffect(() => {
    // Initialize Stripe - for web, we load the key dynamically, for mobile we use env var
    if (isWeb) {
      console.log("WishResponsesScreen - Web platform detected - Stripe key will be loaded dynamically");
      setStripeInitialized(true);
    } else {
      if (STRIPE_PUBLISHABLE_KEY) {
        console.log("WishResponsesScreen - Initializing Stripe with publishable key");
        setStripeInitialized(true);
      } else {
        console.error("WishResponsesScreen - Stripe publishable key not found");
      }
    }

    // Get customer UID for web Stripe
    const getCustomerUid = async () => {
      try {
        const uid = await AsyncStorage.getItem("profile_uid");
        setCustomerUid(uid);
      } catch (error) {
        console.error("WishResponsesScreen - Error getting customer UID:", error);
      }
    };
    getCustomerUid();
  }, []);

  // Load Stripe public key for web
  const loadStripePublicKey = async (businessCode = "ECTEST") => {
    try {
      console.log("============================================");
      console.log("WishResponsesScreen - Loading Stripe public key for business code:", businessCode);
      // Determine environment: ECTEST → PMTEST, EC → PM
      const environment = businessCode === "ECTEST" ? "PMTEST" : businessCode === "EC" ? "PM" : "PMTEST";
      console.log("WishResponsesScreen - Mapped environment for Stripe key lookup:", environment);
      const url = `${GET_STRIPE_PUBLIC_KEY_ENDPOINT}/${environment}`;

      console.log("WishResponsesScreen - Fetching Stripe key from URL:", url);
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Stripe key: ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log("WishResponsesScreen - Full response data:", JSON.stringify(responseData, null, 2));
      console.log("WishResponsesScreen - Response keys:", Object.keys(responseData));

      // Handle both camelCase (publicKey) and UPPERCASE (PUBLISHABLE_KEY) response formats
      const publicKey = responseData.publicKey || responseData.PUBLISHABLE_KEY;
      if (!publicKey) {
        console.error("WishResponsesScreen - Response structure:", responseData);
        console.error("WishResponsesScreen - Available keys:", Object.keys(responseData));
        throw new Error("Public key not found in response. Expected 'publicKey' or 'PUBLISHABLE_KEY'");
      }

      const last4Digits = publicKey.length >= 4 ? publicKey.slice(-4) : "N/A";
      console.log("WishResponsesScreen - Stripe public key received (last 4 digits):", last4Digits);

      // Load Stripe with public key
      if (loadStripe) {
        const stripe = await loadStripe(publicKey);
        setStripePromise(stripe);
        console.log("WishResponsesScreen - Stripe loaded successfully with key ending in:", last4Digits);
        console.log("============================================");
        return stripe;
      }

      throw new Error("Stripe loadStripe function not available");
    } catch (error) {
      console.error("WishResponsesScreen - Error loading Stripe public key:", error);
      console.error("WishResponsesScreen - Error details:", error.message);
      console.log("============================================");
      Alert.alert("Error", "Failed to initialize payment system. Please try again.");
      throw error;
    }
  };

  // Handle fees dialog continue (web)
  const handleFeesDialogContinue = async () => {
    try {
      setShowFeesDialog(false);
      setLoading(true);
      await loadStripePublicKey("ECTEST");
      setShowStripePayment(true);
    } catch (error) {
      console.error("WishResponsesScreen - Error starting web Stripe modal:", error);
      Alert.alert("Error", "Failed to initialize payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Web Stripe payment submission handler
  const handleWebPaymentSubmit = async (paymentIntent, paymentMethod) => {
    try {
      setLoading(true);
      console.log("WishResponsesScreen - Web payment submitted - paymentIntent:", paymentIntent, "paymentMethod:", paymentMethod);

      const buyerUid = await AsyncStorage.getItem("profile_uid");
      if (!buyerUid) throw new Error("User ID not found");
      if (!pendingAccept) throw new Error("No pending acceptance found");

      const { responderProfileUid, wishResponseUid, subtotal } = pendingAccept;

      const processingFee = subtotal * 0.03;
      const totalAmount = subtotal + processingFee;

      await recordTransaction(buyerUid, paymentIntent, subtotal, responderProfileUid, wishResponseUid, processingFee, totalAmount);

      Alert.alert("Success", "Response accepted and payment processed successfully!");
      await fetchWishResponses();
    } catch (error) {
      console.error("WishResponsesScreen - Web payment submission error:", error);
      setPaymentError(error);
      setShowPaymentFailure(true);
    } finally {
      setPendingAccept(null);
      setAccepting(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishResponses();
  }, []);

  const fetchWishResponses = async () => {
    try {
      setLoading(true);
      const profile_wish_id = wishData?.wish_uid || wishData?.profile_wish_id;
      if (!profile_wish_id) {
        Alert.alert("Error", "Wish information not found.");
        setLoading(false);
        return;
      }

      const endpoint = `${PROFILE_WISH_INFO_ENDPOINT}/${profile_wish_id}`;
      console.log("Fetching wish responses from:", endpoint);

      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();
      console.log("Wish responses result:", JSON.stringify(result, null, 2));

      if (response.ok && result.code === 200 && result.data) {
        setResponses(result.data);
      } else {
        throw new Error(result.message || "Failed to fetch responses");
      }
    } catch (error) {
      console.error("Error fetching wish responses:", error);
      Alert.alert("Error", error.message || "Failed to load responses. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const createPaymentIntent = async (amount) => {
    try {
      console.log("WishResponsesScreen - Creating payment intent for wish acceptance...");
      const buyer_profile_uid = await AsyncStorage.getItem("profile_uid");
      console.log("WishResponsesScreen - Buyer profile UID:", buyer_profile_uid);

      if (!buyer_profile_uid) {
        throw new Error("User profile not found");
      }

      console.log("WishResponsesScreen - Creating payment intent for amount:", amount);

      const requestBody = {
        customer_uid: buyer_profile_uid,
        business_code: "ECTEST",
        payment_summary: {
          tax: 0,
          total: amount.toString(),
        },
      };

      console.log("WishResponsesScreen - Payment Intent Request:", JSON.stringify(requestBody, null, 2));

      const response = await fetch(CREATE_PAYMENT_INTENT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log("WishResponsesScreen - Payment intent created:", data);

      if (typeof data !== "string") {
        throw new Error("Invalid response format from payment intent creation");
      }

      return data; // Return the client secret
    } catch (error) {
      console.error("WishResponsesScreen - Error creating payment intent:", error);
      throw error;
    }
  };

  const recordTransaction = async (buyerUid, paymentIntent, amount, responderProfileUid, wishResponseUid, processingFee = 0, totalAmountPaid = null) => {
    try {
      console.log("WishResponsesScreen - Recording transaction...");
      console.log("WishResponsesScreen - Buyer UID:", buyerUid);
      console.log("WishResponsesScreen - Responder Profile UID (user_profile_id):", responderProfileUid);
      console.log("WishResponsesScreen - Payment Intent:", paymentIntent);
      console.log("WishResponsesScreen - Wish Response UID (ti_bs_id):", wishResponseUid);
      console.log("WishResponsesScreen - Amount (bounty):", amount);
      console.log("WishResponsesScreen - Transaction Type:", "wish_response_acceptance");

      // Format transaction data to match the API's expected format
      // For wish response acceptance, use responder's profile UID as business_id
      const subtotal = parseFloat(amount);
      const fee = parseFloat(processingFee) || 0;
      const totalPaid = totalAmountPaid !== null ? parseFloat(totalAmountPaid) : subtotal + fee;

      const transactionData = {
        profile_id: buyerUid,
        business_id: responderProfileUid, // Use responder's profile UID as business_id
        stripe_payment_intent: paymentIntent,
        total_amount_paid: totalPaid,
        total_costs: subtotal,
        total_taxes: fee,
        items: [
          {
            // Keep both for backward compatibility + explicit ti_bs_id for API mapping
            wish_response_uid: wishResponseUid,
            ti_bs_id: wishResponseUid,
            bs_uid: wishResponseUid,
            // Backend mapping expects profile_wish_bounty -> ti_bs_cost
            ti_bs_cost: subtotal,
            // Keep legacy field too (some endpoints/screens may still read this)
            bounty: subtotal,
            quantity: 1,
            recommender_profile_id: responderProfileUid, // Use responder's profile UID
          },
        ],
      };

      console.log("WishResponsesScreen - ============================================");
      console.log("WishResponsesScreen - ENDPOINT: RECORD_TRANSACTIONS");
      console.log("WishResponsesScreen - URL:", TRANSACTIONS_ENDPOINT);
      console.log("WishResponsesScreen - METHOD: POST");
      console.log("WishResponsesScreen - REQUEST BODY:", JSON.stringify(transactionData, null, 2));
      console.log("WishResponsesScreen - ============================================");

      const response = await fetch(TRANSACTIONS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transactionData),
      });

      console.log("WishResponsesScreen - RESPONSE STATUS:", response.status);
      console.log("WishResponsesScreen - RESPONSE OK:", response.ok);

      const result = await response.json();
      console.log("WishResponsesScreen - RESPONSE BODY:", JSON.stringify(result, null, 2));

      if (!response.ok) {
        throw new Error(`Failed to record transaction: ${result.message || "Unknown error"}`);
      }

      console.log("WishResponsesScreen - Transaction recorded successfully");
    } catch (error) {
      console.error("WishResponsesScreen - Error recording transaction:", error);
      throw error;
    }
  };

  const initializePayment = async (amount) => {
    try {
      console.log("WishResponsesScreen - Initializing payment...");

      if (amount <= 0) {
        Alert.alert("Error", "Invalid bounty amount");
        return { success: false, clientSecret: null };
      }

      const clientSecret = await createPaymentIntent(amount);
      console.log("WishResponsesScreen - Initializing payment sheet with client secret");

      setCurrentClientSecret(clientSecret);

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: wishData?.title || "Wish Response Acceptance",
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
        console.error("WishResponsesScreen - Payment initialization error:", initError);
        Alert.alert("Error", "Failed to initialize payment. Please try again.");
        return { success: false, clientSecret: null };
      }

      return { success: true, clientSecret: clientSecret };
    } catch (error) {
      console.error("WishResponsesScreen - Error initializing payment:", error);
      Alert.alert("Error", "Failed to initialize payment. Please try again.");
      return { success: false, clientSecret: null };
    }
  };

  const handleAccept = async (response) => {
    console.log("WishResponsesScreen - Accept clicked for response:", response.wish_response_uid);
    console.log("WishResponsesScreen - Response data:", JSON.stringify(response, null, 2));

    if (!stripeInitialized) {
      Alert.alert("Error", "Payment system is not ready. Please try again.");
      return;
    }

    if (!wishData?.bounty) {
      Alert.alert("Error", "Bounty information is not available for this wish.");
      return;
    }

    try {
      setAccepting(response.wish_response_uid);

      // Parse bounty amount (handle formats like "5", "USD 5", "$5", etc.)
      const bountyString = wishData?.bounty || "0";
      // Extract the first number
      const match = bountyString.match(/[\d.]+/);
      const amount = match ? parseFloat(match[0]) : 0;

      console.log("WishResponsesScreen - Parsed bounty amount:", amount);
      console.log("WishResponsesScreen - Original bounty string:", bountyString);

      if (amount <= 0) {
        Alert.alert("Error", "Invalid bounty amount");
        setAccepting(null);
        return;
      }

      // Web flow: open Stripe modal (same pattern as ShoppingCart)
      if (isWeb) {
        const wishResponseUid = response.wish_response_uid;
        const responderProfileUid = response.profile_personal_uid;

        console.log("WishResponsesScreen - Wish Response UID (ti_bs_id):", wishResponseUid);
        console.log("WishResponsesScreen - Responder Profile UID (user_profile_id):", responderProfileUid);

        if (!wishResponseUid) throw new Error("Wish Response ID not found");
        if (!responderProfileUid) throw new Error("Responder profile ID not found");

        setPendingAccept({ responderProfileUid, wishResponseUid, subtotal: amount });
        setShowFeesDialog(true);
        setLoading(false);
        return;
      }

      const initResult = await initializePayment(amount);
      if (!initResult.success || !initResult.clientSecret) {
        console.error("WishResponsesScreen - Payment initialization failed or client secret not returned");
        setAccepting(null);
        return;
      }

      // Store the client secret locally to avoid state timing issues
      const clientSecret = initResult.clientSecret;
      console.log("WishResponsesScreen - Stored client secret for transaction:", clientSecret);

      console.log("WishResponsesScreen - Presenting payment sheet...");
      const result = await presentPaymentSheet();

      if (result.error) {
        console.error("WishResponsesScreen - Payment error:", result.error);
        Alert.alert("Error", "Payment failed. Please try again.");
        setAccepting(null);
        return;
      }

      console.log("WishResponsesScreen - Payment successful!");

      // Record the transaction
      const buyerUid = await AsyncStorage.getItem("profile_uid");
      if (!buyerUid) {
        throw new Error("User ID not found");
      }

      // Extract payment intent ID from client secret
      // Client secret format: pi_xxx_secret_yyy
      // We need just the payment intent ID: pi_xxx
      if (!clientSecret) {
        console.error("WishResponsesScreen - clientSecret is null or undefined");
        throw new Error("Payment intent not found. Please try again.");
      }

      // Extract payment intent ID (the part before _secret_)
      const paymentIntentId = clientSecret.split("_secret_")[0];
      console.log("WishResponsesScreen - Extracted payment intent ID:", paymentIntentId);
      console.log("WishResponsesScreen - Full client secret:", clientSecret);

      if (!paymentIntentId || paymentIntentId.trim() === "") {
        console.error("WishResponsesScreen - Failed to extract payment intent ID from:", clientSecret);
        throw new Error("Invalid payment intent. Please try again.");
      }

      // Get the wish response UID and responder profile UID
      const wishResponseUid = response.wish_response_uid;
      const responderProfileUid = response.profile_personal_uid;

      console.log("WishResponsesScreen - Wish Response UID (ti_bs_id):", wishResponseUid);
      console.log("WishResponsesScreen - Responder Profile UID (user_profile_id):", responderProfileUid);

      if (!wishResponseUid) {
        throw new Error("Wish Response ID not found");
      }

      if (!responderProfileUid) {
        throw new Error("Responder profile ID not found");
      }

      // Use the same amount that was used for payment
      await recordTransaction(buyerUid, paymentIntentId, amount, responderProfileUid, wishResponseUid);

      Alert.alert("Success", "Response accepted and payment processed successfully!");

      // Refresh the responses list
      await fetchWishResponses();
    } catch (error) {
      console.error("WishResponsesScreen - Error processing payment:", error);
      Alert.alert("Error", error.message || "An error occurred during payment. Please try again.");
    } finally {
      // For web, we clear accepting after modal completion (success/failure/cancel)
      if (!isWeb) setAccepting(null);
    }
  };

  const handleBack = () => {
    // Return to Profile screen with preserved state
    if (profileState) {
      console.log("🔙 Returning to Profile with preserved state");
      navigation.navigate("Profile", profileState);
    } else {
      navigation.navigate("Profile", {
        profile_uid: profile_uid,
      });
    }
  };

  return (
    <SafeAreaView style={[styles.pageContainer, darkMode && styles.darkPageContainer]}>
      {/* Header with Back Button */}
      <AppHeader
        title="Seeking Responses"
        backgroundColor="#AF52DE"
        onBackPress={handleBack}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={darkMode ? "#AF52DE" : "#AF52DE"} />
        </View>
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {/* Wish Card */}
          <View style={[styles.card, darkMode && styles.darkCard]}>
            <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>Seeking</Text>
            {wishData?.title && <Text style={[styles.wishTitle, darkMode && styles.darkWishTitle]}>{wishData.title}</Text>}
            {wishData?.description && <Text style={[styles.wishDescription, darkMode && styles.darkWishDescription]}>{wishData.description}</Text>}
            {wishData?.details && (
              <View style={styles.detailsContainer}>
                <Text style={[styles.detailsTitle, darkMode && styles.darkDetailsTitle]}>Details</Text>
                <Text style={[styles.detailsText, darkMode && styles.darkDetailsText]}>{wishData.details}</Text>
              </View>
            )}
            {wishData?.bounty && (
              <View style={styles.pricingContainer}>
                <View style={styles.pricingRow}>
                  <Text style={styles.bountyEmojiIcon}>💰</Text>
                  <Text style={[styles.pricingLabel, darkMode && styles.darkPricingLabel]}>Bounty: USD {wishData.bounty}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Responses */}
          {responses.length > 0 ? (
            <>
              <Text style={[styles.responsesTitle, darkMode && styles.darkResponsesTitle]}>Responses ({responses.length})</Text>
              {responses.map((response, index) => {
                const responderUser = {
                  firstName: response.profile_personal_first_name || "",
                  lastName: response.profile_personal_last_name || "",
                  email: "",
                  phoneNumber: response.profile_personal_phone_number || "",
                  profileImage: response.profile_personal_image || "",
                  tagLine: response.profile_personal_tag_line || "",
                  emailIsPublic: response.profile_personal_email_is_public === 1,
                  phoneIsPublic: response.profile_personal_phone_number_is_public === 1,
                  tagLineIsPublic: response.profile_personal_tag_line_is_public === 1,
                  imageIsPublic: response.profile_personal_image_is_public === 1,
                };

                return (
                  <View key={response.wish_response_uid || index} style={[styles.responseCard, darkMode && styles.darkResponseCard]}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        console.log("🏢 Navigating to Profile from MiniCard in WishResponses");
                        if (response.profile_personal_uid) {
                          navigation.navigate("Profile", {
                            profile_uid: response.profile_personal_uid,
                            returnTo: "WishResponses",
                            wishResponsesState: {
                              wishData,
                              profileData,
                              profile_uid,
                              profileState,
                            },
                          });
                        }
                      }}
                    >
                      <View style={[styles.miniCardContainer, darkMode && styles.darkMiniCardContainer]}>
                        <MiniCard user={responderUser} />
                      </View>
                    </TouchableOpacity>
                    <View style={[styles.responseNoteContainer, darkMode && styles.darkResponseNoteContainer]}>
                      <Text style={[styles.responseNoteLabel, darkMode && styles.darkResponseNoteLabel]}>Response:</Text>
                      <Text style={[styles.responseNote, darkMode && styles.darkResponseNote]}>{response.wr_responder_note || "No note provided"}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.acceptButton, darkMode && styles.darkAcceptButton, accepting === response.wish_response_uid && styles.disabledButton]}
                      onPress={() => handleAccept(response)}
                      disabled={accepting === response.wish_response_uid}
                    >
                      {accepting === response.wish_response_uid ? <ActivityIndicator size='small' color='#fff' /> : <Text style={styles.acceptButtonText}>Accept</Text>}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          ) : (
            <View style={styles.noResponsesContainer}>
              <Text style={[styles.noResponsesText, darkMode && styles.darkNoResponsesText]}>No responses yet</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Web Stripe Components */}
      {isWeb && (
        <>
          <StripeFeesDialog
            show={showFeesDialog}
            setShow={setShowFeesDialog}
            onContinue={handleFeesDialogContinue}
            onCancel={() => {
              setShowFeesDialog(false);
              setPendingAccept(null);
              setAccepting(null);
              setLoading(false);
            }}
          />

          {stripePromise && customerUid && pendingAccept && (
            <StripePayment
              message='ECTEST'
              amount={pendingAccept.subtotal * 1.03} // Add 3% fee
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
              setPendingAccept(null);
              setAccepting(null);
              navigation.navigate("Profile", profileState || { profile_uid });
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  darkCard: {
    backgroundColor: "#2d2d2d",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  darkCardTitle: {
    color: "#fff",
  },
  wishTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  darkWishTitle: {
    color: "#fff",
  },
  wishDescription: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
    marginBottom: 20,
  },
  darkWishDescription: {
    color: "#cccccc",
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
  darkDetailsTitle: {
    color: "#fff",
  },
  detailsText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  darkDetailsText: {
    color: "#cccccc",
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
  darkPricingLabel: {
    color: "#cccccc",
  },
  responsesTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 15,
    color: "#333",
  },
  darkResponsesTitle: {
    color: "#fff",
  },
  responseCard: {
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
  darkResponseCard: {
    backgroundColor: "#2d2d2d",
  },
  miniCardContainer: {
    marginBottom: 15,
  },
  darkMiniCardContainer: {
    backgroundColor: "transparent",
  },
  responseNoteContainer: {
    marginBottom: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  darkResponseNoteContainer: {
    borderTopColor: "#404040",
  },
  responseNoteLabel: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  darkResponseNoteLabel: {
    color: "#fff",
  },
  responseNote: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
  },
  darkResponseNote: {
    color: "#cccccc",
  },
  acceptButton: {
    backgroundColor: "#00C7BE",
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 30,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    minWidth: 150,
  },
  darkAcceptButton: {
    backgroundColor: "#00A69C",
  },
  acceptButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  disabledButton: {
    opacity: 0.6,
  },
  noResponsesContainer: {
    padding: 40,
    alignItems: "center",
  },
  noResponsesText: {
    fontSize: 16,
    color: "#999",
    fontStyle: "italic",
  },
  darkNoResponsesText: {
    color: "#666",
  },
  darkPageContainer: {
    backgroundColor: "#1a1a1a",
  },
});

export default function WishResponsesScreen({ route, navigation }) {
  const content = <WishResponsesScreenContent route={route} navigation={navigation} />;
  
  // Only wrap with StripeProvider on native platforms
  if (StripeProvider && !isWeb && STRIPE_PUBLISHABLE_KEY) {
    return <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>{content}</StripeProvider>;
  }
  
  return content;
}
