// WishResponsesScreen.js
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MicroCard from "../components/MicroCard";
import BottomNavBar from "../components/BottomNavBar";
import { useDarkMode } from "../contexts/DarkModeContext";
import AppHeader from "../components/AppHeader";
import ProfileSectionItemImage from "../components/ProfileSectionItemImage";
import { resolveProfileItemImageUri } from "../utils/resolveProfileItemImageUri";
import { buildSeekingReplyContext } from "../utils/chatReplyContext";

// Only import Stripe on native platforms (not web)
let useStripe = null;
const isWeb = typeof window !== "undefined" && typeof document !== "undefined";
if (!isWeb) {
  try {
    useStripe = require("@stripe/stripe-react-native").useStripe;
  } catch (e) {
    console.warn("Stripe not available:", e.message);
  }
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { PROFILE_WISH_INFO_ENDPOINT, CREATE_PAYMENT_INTENT_ENDPOINT, TRANSACTIONS_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "../utils/httpMiddleware";
import { fetchStripePublishableKey } from "../utils/stripePublishableKey";
import StripeNativeProvider from "../components/StripeNativeProvider";

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
import PaymentFailure from "../components/PaymentFailure";
import AcceptDetailsModal from "../components/AcceptDetailsModal";

// Display stored "YYYY-MM-DD HH:mm" or "YYYY-MM-DDTHH:mm" as "m/d/y hh:mm"
const formatDateTimeForDisplay = (value) => {
  if (!value || typeof value !== "string" || value.trim() === "") return "";
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[\sT]?(\d{1,2})?:?(\d{2})?/);
  if (match) {
    const [, y, m, d, h, min] = match;
    const timePart = h !== undefined && min !== undefined ? ` ${String(parseInt(h, 10)).padStart(2, "0")}:${min}` : "";
    return `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}${timePart}`;
  }
  return value;
};

/** Person who will fulfill the wish vs person who submitted the response. */
function getWishResponseAcceptProfileIds(response) {
  const recommendedProfileUid = String(response?.profile_personal_uid || response?.wr_recommended_id || "").trim();
  const recommenderProfileUid = String(response?.wr_responder_id || response?.responder_id || "").trim();
  return { recommendedProfileUid, recommenderProfileUid };
}

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
  const [showAcceptDetailsModal, setShowAcceptDetailsModal] = useState(false);
  const [acceptModalResponse, setAcceptModalResponse] = useState(null);
  const [showPaymentFailure, setShowPaymentFailure] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [customerUid, setCustomerUid] = useState(null);
  const [pendingAccept, setPendingAccept] = useState(null); // { recommendedProfileUid, recommenderProfileUid, wishResponseUid, subtotal }

  // Initialize Stripe on mount
  useEffect(() => {
    // Native: mounts only after StripeNativeProvider loads the key; web loads key at checkout.
    setStripeInitialized(true);

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

  const loadStripePublicKey = async (businessCode = "ECTEST") => {
    try {
      const publicKey = await fetchStripePublishableKey(businessCode);
      if (loadStripe) {
        const stripe = await loadStripe(publicKey);
        setStripePromise(stripe);
        return stripe;
      }
      throw new Error("Stripe loadStripe function not available");
    } catch (error) {
      console.error("WishResponsesScreen - Error loading Stripe public key:", error);
      Alert.alert("Error", "Failed to initialize payment system. Please try again.");
      throw error;
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

      const { recommendedProfileUid, recommenderProfileUid, wishResponseUid, subtotal, escrow, bountyAmount, quantity, costAmount, costValue } = pendingAccept;

      const processingFee = subtotal * 0.03;
      const totalAmount = subtotal + processingFee;

      await recordTransaction(
        buyerUid,
        paymentIntent,
        subtotal,
        recommendedProfileUid,
        wishResponseUid,
        processingFee,
        totalAmount,
        escrow,
        bountyAmount,
        quantity,
        costAmount,
        costValue,
        recommenderProfileUid,
      );

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

  const recordTransaction = async (
    buyerUid,
    paymentIntent,
    amount,
    recommendedProfileUid,
    wishResponseUid,
    processingFee = 0,
    totalAmountPaid = null,
    transactionInEscrow = false,
    bountyAmount = null,
    quantity = 1,
    costAmount = 0,
    costValue = 0,
    recommenderProfileUid = null,
  ) => {
    try {
      console.log("WishResponsesScreen - Recording transaction...");
      console.log("WishResponsesScreen - Buyer UID:", buyerUid);
      console.log("WishResponsesScreen - Recommended Profile UID:", recommendedProfileUid);
      console.log("WishResponsesScreen - Recommender Profile UID:", recommenderProfileUid);
      console.log("WishResponsesScreen - Payment Intent:", paymentIntent);
      console.log("WishResponsesScreen - Wish Response UID (ti_bs_id):", wishResponseUid);
      console.log("WishResponsesScreen - Amount (bounty):", amount);
      console.log("WishResponsesScreen - Transaction Type:", "wish_response_acceptance");

      // Format transaction data to match the API's expected format
      // For wish response acceptance, use recommended person's profile UID as business_id
      const subtotal = parseFloat(amount);
      const fee = parseFloat(processingFee) || 0;
      const totalPaid = totalAmountPaid !== null ? parseFloat(totalAmountPaid) : subtotal + fee;

      const roundedFee = Math.round(fee * 100) / 100;
      const roundedSubtotal = Math.round(subtotal * 100) / 100;
      const recommendedId = String(recommendedProfileUid || "").trim();
      const recommenderId = String(recommenderProfileUid || recommendedProfileUid || "").trim();

      const transactionData = {
        profile_id: buyerUid,
        business_id: recommendedId,
        stripe_payment_intent: paymentIntent,
        total_amount_paid: totalPaid,
        total_costs: roundedSubtotal,
        total_taxes: 0,
        total_fees: roundedFee,
        // Ensure tinyint: 1 or 0 only (backend expects tinyint)
        transaction_in_escrow: transactionInEscrow === true || transactionInEscrow === 1 ? 1 : 0,
        items: [
          {
            // Keep both for backward compatibility + explicit ti_bs_id for API mapping
            wish_response_uid: wishResponseUid,
            ti_bs_id: wishResponseUid,
            bs_uid: wishResponseUid,
            // Backend mapping expects profile_wish_bounty -> ti_bs_cost
            ti_bs_cost: subtotal,
            // Bounty is the wish bounty amount (e.g. 110), not the subtotal
            bounty: bountyAmount != null ? parseFloat(bountyAmount) : subtotal,
            quantity: Number(quantity) || 1,
            cost: costAmount != null ? parseFloat(costAmount) : 0,
            item_cost: costValue != null ? parseFloat(costValue) : 0,
            recommended_profile_id: recommendedId,
            recommender_profile_id: recommenderId,
            ti_bs_sales_tax: 0,
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

  const handleAccept = (response) => {
    console.log("WishResponsesScreen - Accept clicked for response:", response.wish_response_uid);

    if (!stripeInitialized) {
      Alert.alert("Error", "Payment system is not ready. Please try again.");
      return;
    }

    const bountyMatch = String(wishData?.bounty || "0").match(/[\d.]+/);
    const bountyAmount = bountyMatch ? parseFloat(bountyMatch[0]) : 0;
    const costStr = wishData?.cost || "";
    const costMatch = String(costStr).replace(/^\$/, "").match(/^([\d.]+)/);
    const costValue = costMatch ? parseFloat(costMatch[1]) : 0;

    if (bountyAmount <= 0 && costValue <= 0) {
      Alert.alert("Error", "Cost or bounty must be greater than 0 to accept.");
      return;
    }

    setAccepting(response.wish_response_uid);
    setAcceptModalResponse(response);
    setShowAcceptDetailsModal(true);
  };

  const handleAcceptDetailsContinue = async (details) => {
    const response = acceptModalResponse;
    if (!response) return;

    const { subtotal, totalWithFee } = details;
    const wishResponseUid = response.wish_response_uid;
    const { recommendedProfileUid, recommenderProfileUid } = getWishResponseAcceptProfileIds(response);

    if (!wishResponseUid || !recommendedProfileUid || !recommenderProfileUid) {
      Alert.alert("Error", "Invalid response data.");
      setAccepting(null);
      setAcceptModalResponse(null);
      setShowAcceptDetailsModal(false);
      return;
    }

    setPendingAccept({
      recommendedProfileUid,
      recommenderProfileUid,
      wishResponseUid,
      subtotal,
      totalWithFee,
      escrow: details.escrow,
      bountyAmount: details.bountyAmount,
      quantity: details.quantity,
      costAmount: details.costAmount,
      costValue: details.costValue,
    });

    try {
      if (isWeb) {
        await loadStripePublicKey("ECTEST");
        setShowStripePayment(true);
        setLoading(false);
        return;
      }

      const initResult = await initializePayment(totalWithFee);
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

      // Get the wish response UID and profile UIDs for recommended vs recommender
      const wishResponseUid = response.wish_response_uid;
      const { recommendedProfileUid, recommenderProfileUid } = getWishResponseAcceptProfileIds(response);

      console.log("WishResponsesScreen - Wish Response UID (ti_bs_id):", wishResponseUid);
      console.log("WishResponsesScreen - Recommended Profile UID:", recommendedProfileUid);
      console.log("WishResponsesScreen - Recommender Profile UID:", recommenderProfileUid);

      if (!wishResponseUid) {
        throw new Error("Wish Response ID not found");
      }

      if (!recommendedProfileUid) {
        throw new Error("Recommended profile ID not found");
      }

      if (!recommenderProfileUid) {
        throw new Error("Recommender profile ID not found");
      }

      // Use subtotal for transaction record (totalWithFee includes 3% processing fee)
      const processingFee = subtotal * 0.03;
      await recordTransaction(
        buyerUid,
        paymentIntentId,
        subtotal,
        recommendedProfileUid,
        wishResponseUid,
        processingFee,
        totalWithFee,
        details.escrow,
        details.bountyAmount,
        details.quantity,
        details.costAmount,
        details.costValue,
        recommenderProfileUid,
      );

      Alert.alert("Success", "Response accepted and payment processed successfully!");

      // Refresh the responses list
      await fetchWishResponses();
    } catch (error) {
      console.error("WishResponsesScreen - Error processing payment:", error);
      Alert.alert("Error", error.message || "An error occurred during payment. Please try again.");
    } finally {
      if (!isWeb) {
        setAccepting(null);
        setAcceptModalResponse(null);
        setShowAcceptDetailsModal(false);
      }
    }
  };

  const handleAcceptDetailsCancel = () => {
    setAccepting(null);
    setAcceptModalResponse(null);
    setShowAcceptDetailsModal(false);
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

  const wishWebPayeeName = acceptModalResponse
    ? [acceptModalResponse.responder_first_name, acceptModalResponse.responder_last_name].filter(Boolean).join(" ").trim() ||
      [acceptModalResponse.profile_personal_first_name, acceptModalResponse.profile_personal_last_name].filter(Boolean).join(" ").trim() ||
      (wishData?.title != null && String(wishData.title).trim() !== "" ? String(wishData.title).trim() : null)
    : wishData?.title != null && String(wishData.title).trim() !== ""
      ? String(wishData.title).trim()
      : null;

  const wishTitle = wishData?.title ? String(wishData.title).trim() : "";
  const wishDescription = String(wishData?.description || wishData?.details || "").trim();
  const wishImageUri = resolveProfileItemImageUri(wishData?.profile_wish_image, profile_uid);
  const wishQty =
    wishData?.profile_wish_quantity != null && String(wishData.profile_wish_quantity).trim() !== "" ? String(wishData.profile_wish_quantity).trim() : "";
  const wishCost = wishData?.cost || "";
  const wishBounty = wishData?.bounty || "";

  return (
    <SafeAreaView style={[styles.pageContainer, darkMode && styles.darkPageContainer]}>
      {/* Header with Back Button */}
      <AppHeader title='SEEKING RESPONSES' backgroundColor='#AF52DE' onBackPress={handleBack} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={darkMode ? "#AF52DE" : "#AF52DE"} />
        </View>
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {/* Seeking item — same layout as Profile SEEKING cards */}
          <View style={[styles.seekingCard, darkMode && styles.darkSeekingCard]}>
            <View style={styles.seekingHeaderRow}>
              <ProfileSectionItemImage section='seeking' imageUri={wishImageUri} imageIsPublic={wishData?.profile_wish_image_is_public} size={56} darkMode={darkMode} />
              <View style={styles.seekingHeaderText}>
                {wishTitle ? <Text style={[styles.seekingTitle, darkMode && styles.darkSeekingTitle]}>{wishTitle}</Text> : null}
                {wishDescription ? <Text style={[styles.seekingDescription, darkMode && styles.darkSeekingDescription]}>{wishDescription}</Text> : null}
              </View>
            </View>
            {wishData?.profile_wish_start || wishData?.profile_wish_end || wishData?.profile_wish_location || wishData?.profile_wish_mode ? (
              <View style={[styles.seekingMetaRow, { marginTop: 6 }]}>
                {wishData?.profile_wish_start || wishData?.profile_wish_end ? (
                  <View style={styles.seekingMetaLine}>
                    <Ionicons name='calendar-outline' size={14} color={darkMode ? "#999" : "#666"} style={{ marginRight: 6 }} />
                    <Text style={[styles.seekingMetaText, darkMode && styles.darkSeekingMetaText]}>
                      {wishData.profile_wish_start ? formatDateTimeForDisplay(wishData.profile_wish_start) : "—"}
                      {wishData.profile_wish_start && wishData.profile_wish_end ? " → " : ""}
                      {wishData.profile_wish_end ? formatDateTimeForDisplay(wishData.profile_wish_end) : ""}
                    </Text>
                  </View>
                ) : null}
                {wishData?.profile_wish_location || wishData?.profile_wish_mode ? (
                  <View
                    style={[
                      styles.seekingMetaLine,
                      styles.seekingMetaLineSpaceBetween,
                      (wishData?.profile_wish_start || wishData?.profile_wish_end) && { marginTop: 4 },
                    ]}
                  >
                    {wishData?.profile_wish_location ? (
                      <View style={styles.seekingMetaLine}>
                        <Ionicons name='location-outline' size={14} color={darkMode ? "#999" : "#666"} style={{ marginRight: 6 }} />
                        <Text style={[styles.seekingMetaText, darkMode && styles.darkSeekingMetaText]}>{wishData.profile_wish_location}</Text>
                      </View>
                    ) : (
                      <View style={styles.seekingMetaSpacer} />
                    )}
                    {wishData?.profile_wish_mode ? (
                      <View style={styles.seekingMetaLine}>
                        <Ionicons
                          name={wishData.profile_wish_mode.toLowerCase() === "virtual" ? "videocam-outline" : "people-outline"}
                          size={14}
                          color={darkMode ? "#999" : "#666"}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.seekingMetaText, darkMode && styles.darkSeekingMetaText]}>{wishData.profile_wish_mode}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}
            {wishCost || wishQty || wishBounty ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginLeft: 0, marginTop: 6 }}>
                {wishCost ? (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={styles.moneyBagIconContainer}>
                      <Text style={styles.moneyBagDollarSymbol}>$</Text>
                    </View>
                    <Text style={[styles.seekingCostText, darkMode && styles.darkSeekingCostText]}>
                      {String(wishCost).toLowerCase() !== "free" ? `Cost: $${String(wishCost).replace(/^\$/, "")}` : `Cost: ${wishCost}`}
                    </Text>
                  </View>
                ) : null}
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "flex-end", flexWrap: "wrap", gap: 8 }}>
                  {wishQty ? <Text style={[styles.seekingCostText, darkMode && styles.darkSeekingCostText]}>Qty: {wishQty}</Text> : null}
                  {wishBounty ? (
                    <Text style={[styles.seekingCostText, { textAlign: "right", minWidth: 60 }, darkMode && styles.darkSeekingCostText]}>
                      {String(wishBounty).toLowerCase() !== "free" ? `💰 $${String(wishBounty).replace(/^\$/, "")}` : `💰 ${wishBounty}`}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>

          {/* Responses */}
          {responses.length > 0 ? (
            <>
              <Text style={[styles.responsesTitle, darkMode && styles.darkResponsesTitle]}>Responses ({responses.length})</Text>
              {responses.map((response, index) => {
                const responderProfileUid = String(response.wr_responder_id || response.responder_id || "").trim();
                const recommendedProfileUid = String(response.profile_personal_uid || response.wr_recommended_id || "").trim();
                const useRecommendedProfileForDisplay = !response.responder_first_name && !response.responder_last_name && recommendedProfileUid === responderProfileUid;
                const responderMicroCardUser = {
                  firstName: response.responder_first_name || (useRecommendedProfileForDisplay ? response.profile_personal_first_name : "") || "",
                  lastName: response.responder_last_name || (useRecommendedProfileForDisplay ? response.profile_personal_last_name : "") || "",
                  profileImage: response.responder_image || (useRecommendedProfileForDisplay ? response.profile_personal_image : "") || "",
                  tagLine: response.responder_tag_line || (useRecommendedProfileForDisplay ? response.profile_personal_tag_line : "") || "",
                  tagLineIsPublic:
                    response.responder_tag_line_is_public === 1 ||
                    (useRecommendedProfileForDisplay && response.profile_personal_tag_line_is_public === 1),
                  imageIsPublic:
                    response.responder_image_is_public === 1 ||
                    (useRecommendedProfileForDisplay && response.profile_personal_image_is_public === 1),
                };
                const responseNote = String(response.wr_responder_note || "").trim();
                const responderName = [responderMicroCardUser.firstName, responderMicroCardUser.lastName].filter(Boolean).join(" ").trim();

                return (
                  <View key={response.wish_response_uid || index} style={[styles.responseCard, darkMode && styles.darkResponseCard]}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      disabled={!responderProfileUid}
                      onPress={() => {
                        if (!responderProfileUid) return;
                        navigation.navigate("Profile", {
                          profile_uid: responderProfileUid,
                          returnTo: "WishResponses",
                          wishResponsesState: {
                            wishData,
                            profileData,
                            profile_uid,
                            profileState,
                          },
                        });
                      }}
                    >
                      <MicroCard user={responderMicroCardUser} showRelationship={false} embedded />
                    </TouchableOpacity>
                    <Text style={[styles.responseNote, darkMode && styles.darkResponseNote]}>{responseNote || "No note provided"}</Text>
                    <View style={styles.responseActionsRow}>
                      {responderProfileUid ? (
                        <TouchableOpacity
                          style={[styles.messageButton, darkMode && styles.darkMessageButton]}
                          activeOpacity={0.85}
                          onPress={() =>
                            navigation.navigate("Chat", {
                              other_uid: responderProfileUid,
                              other_name: responderName || "Chat",
                              other_image:
                                responderMicroCardUser.imageIsPublic && responderMicroCardUser.profileImage
                                  ? responderMicroCardUser.profileImage
                                  : null,
                              reply_context: buildSeekingReplyContext({
                                label: `Seeking: ${wishTitle || "Seeking"}`,
                                quote: responseNote || undefined,
                                profileWishUid: wishData?.wish_uid || wishData?.profile_wish_id,
                                wishResponseUid: response.wish_response_uid,
                              }),
                            })
                          }
                        >
                          <Ionicons name='chatbubble-ellipses-outline' size={16} color='#fff' style={{ marginRight: 6 }} />
                          <Text style={styles.messageButtonText}>Message</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        style={[styles.acceptButton, darkMode && styles.darkAcceptButton, accepting === response.wish_response_uid && styles.disabledButton]}
                        onPress={() => handleAccept(response)}
                        disabled={accepting === response.wish_response_uid}
                      >
                        {accepting === response.wish_response_uid ? <ActivityIndicator size='small' color='#fff' /> : <Text style={styles.acceptButtonText}>Accept</Text>}
                      </TouchableOpacity>
                    </View>
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

      {/* Accept Details Modal (Escrow, Quantity, Total) */}
      <AcceptDetailsModal
        show={showAcceptDetailsModal}
        setShow={setShowAcceptDetailsModal}
        wishData={wishData}
        response={acceptModalResponse}
        onContinue={handleAcceptDetailsContinue}
        onCancel={handleAcceptDetailsCancel}
      />

      {/* Web Stripe Components */}
      {isWeb && (
        <>
          {stripePromise && customerUid && pendingAccept && (
            <StripePayment
              message='ECTEST'
              amount={pendingAccept.totalWithFee ?? pendingAccept.subtotal * 1.03}
              paidBy={customerUid}
              payeeBusinessName={wishWebPayeeName}
              show={showStripePayment}
              setShow={(v) => {
                setShowStripePayment(v);
                if (!v) {
                  setPendingAccept(null);
                  setAccepting(null);
                  setAcceptModalResponse(null);
                }
              }}
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

      <BottomNavBar navigation={navigation} />
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
    paddingBottom: 120, // Extra padding to ensure content is visible above BottomNavBar
  },
  seekingCard: {
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  darkSeekingCard: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  seekingHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 2,
  },
  seekingHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  seekingTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },
  darkSeekingTitle: {
    color: "#fff",
  },
  seekingDescription: {
    fontSize: 15,
    color: "#666",
    lineHeight: 22,
  },
  darkSeekingDescription: {
    color: "#aaa",
  },
  seekingMetaRow: {
    marginLeft: 0,
  },
  seekingMetaLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  seekingMetaLineSpaceBetween: {
    justifyContent: "space-between",
  },
  seekingMetaSpacer: {
    flex: 1,
  },
  seekingMetaText: {
    color: "#666",
    fontSize: 13,
  },
  darkSeekingMetaText: {
    color: "#999",
  },
  seekingCostText: {
    fontSize: 15,
    color: "#333",
  },
  darkSeekingCostText: {
    color: "#fff",
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
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.05)",
    ...(Platform.OS !== "web" && { elevation: 2 }),
  },
  darkResponseCard: {
    backgroundColor: "#2d2d2d",
  },
  responseNote: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 16,
  },
  darkResponseNote: {
    color: "#cccccc",
  },
  responseActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  messageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4B2E83",
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minWidth: 150,
  },
  darkMessageButton: {
    backgroundColor: "#5a3d9e",
  },
  messageButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  acceptButton: {
    backgroundColor: "#00C7BE",
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 30,
    alignItems: "center",
    justifyContent: "center",
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

export default function WishResponsesScreen(props) {
  return (
    <StripeNativeProvider businessCode="ECTEST">
      <WishResponsesScreenContent {...props} />
    </StripeNativeProvider>
  );
}
