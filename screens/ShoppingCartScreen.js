import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MiniCard from "../components/MiniCard";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
import { TRANSACTIONS_ENDPOINT, USER_PROFILE_INFO_ENDPOINT, STRIPE_KEY_ENDPOINT, CREATE_PAYMENT_INTENT_ENDPOINT, GET_STRIPE_PUBLIC_KEY_ENDPOINT } from "../apiConfig";

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

// Use the publishable key from environment variables
const STRIPE_PUBLISHABLE_KEY = REACT_APP_STRIPE_PUBLIC_KEY;
console.log("STRIPE_PUBLISHABLE_KEY:", STRIPE_PUBLISHABLE_KEY);

const ShoppingCartScreen = ({ route, navigation }) => {
  const { cartItems: initialCartItems, onRemoveItem, businessName, business_uid, recommender_profile_id } = route.params;
  const [cartItems, setCartItems] = useState(initialCartItems);

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

  useEffect(() => {
    console.log("ShoppingCartScreen mounted");
    console.log("In shopping cart screen, STRIPE_PUBLISHABLE_KEY:", STRIPE_PUBLISHABLE_KEY);
    console.log("Initial cart items:", initialCartItems);

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
        Alert.alert("Error", "Payment system is not properly configured");
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

  // Update local state when initialCartItems changes
  useEffect(() => {
    setCartItems(initialCartItems);
  }, [initialCartItems]);

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

  const handleRemoveItem = async (index) => {
    try {
      // Get the business_uid from the item being removed
      const itemToRemove = cartItems[index];
      const itemBusinessUid = itemToRemove.business_uid;

      // Get current cart items from AsyncStorage for this specific business
      const storedCartData = await AsyncStorage.getItem(`cart_${itemBusinessUid}`);
      let cartData = storedCartData ? JSON.parse(storedCartData) : { items: [] };

      // Find and remove the specific item by bs_uid
      cartData.items = cartData.items.filter((item) => item.bs_uid !== itemToRemove.bs_uid);

      // Save updated cart
      await AsyncStorage.setItem(`cart_${itemBusinessUid}`, JSON.stringify(cartData));

      // Update local state immediately
      setCartItems((prevItems) => prevItems.filter((_, i) => i !== index));

      // Call the parent's onRemoveItem to update the UI in BusinessProfileScreen
      onRemoveItem(index);

      console.log(`Removed item ${itemToRemove.bs_service_name} from business ${itemBusinessUid}`);
    } catch (error) {
      console.error("Error removing item from cart:", error);
      Alert.alert("Error", "Failed to remove item from cart");
    }
  };

  const handleQuantityChange = async (index, change) => {
    try {
      const newCartItems = [...cartItems];
      const currentQuantity = newCartItems[index].quantity || 1;
      const newQuantity = Math.max(1, currentQuantity + change); // Ensure quantity is at least 1

      // Update the item's quantity and total price
      newCartItems[index] = {
        ...newCartItems[index],
        quantity: newQuantity,
        totalPrice: (parseFloat(newCartItems[index].bs_cost) * newQuantity).toFixed(2),
      };

      // Update local state
      setCartItems(newCartItems);

      // Update AsyncStorage for the specific business
      const businessUid = newCartItems[index].business_uid;
      const businessItems = newCartItems.filter((item) => item.business_uid === businessUid);

      // Group items by bs_uid and combine quantities
      const groupedItems = businessItems.reduce((acc, item) => {
        const existingItem = acc.find((i) => i.bs_uid === item.bs_uid);
        if (existingItem) {
          existingItem.quantity = (existingItem.quantity || 1) + (item.quantity || 1);
          existingItem.totalPrice = (parseFloat(existingItem.bs_cost) * existingItem.quantity).toFixed(2);
        } else {
          acc.push({ ...item });
        }
        return acc;
      }, []);

      // Save the grouped items to AsyncStorage
      await AsyncStorage.setItem(
        `cart_${businessUid}`,
        JSON.stringify({
          items: groupedItems,
        })
      );

      console.log(`Updated quantity for ${newCartItems[index].bs_service_name} to ${newQuantity}`);
    } catch (error) {
      console.error("Error updating quantity:", error);
      Alert.alert("Error", "Failed to update quantity");
    }
  };

  const calculateTotal = () => {
    // Group items by bs_uid and combine quantities before calculating total
    const groupedItems = cartItems.reduce((acc, item) => {
      const existingItem = acc.find((i) => i.bs_uid === item.bs_uid);
      if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 1) + (item.quantity || 1);
      } else {
        acc.push({ ...item });
      }
      return acc;
    }, []);

    const total = groupedItems.reduce((total, item) => {
      const cost = parseFloat(item.bs_cost) || 0;
      const quantity = item.quantity || 1;
      const itemTotal = cost * quantity;
      console.log(`Item ${item.bs_service_name}: ${cost.toFixed(2)} × ${quantity} = ${itemTotal.toFixed(2)}`);
      return total + itemTotal;
    }, 0);

    console.log("Calculated total:", total.toFixed(2));
    return total;
  };

  const createPaymentIntent = async () => {
    try {
      console.log("Creating payment intent...");
      const profile_uid = await AsyncStorage.getItem("profile_uid");
      console.log("User profile UID:", profile_uid);

      if (!profile_uid) {
        throw new Error("User profile not found");
      }

      const total = calculateTotal();
      console.log("Creating payment intent for amount:", total);

      const requestBody = {
        customer_uid: profile_uid,
        business_code: "ECTEST",
        payment_summary: {
          tax: 0,
          total: total.toString(),
        },
      };

      console.log("============================================");
      console.log("ENDPOINT: CREATE_PAYMENT_INTENT");
      console.log("URL:", CREATE_PAYMENT_INTENT_ENDPOINT);
      console.log("METHOD: POST");
      console.log("REQUEST BODY:", JSON.stringify(requestBody, null, 2));
      console.log("============================================");

      const response = await fetch(CREATE_PAYMENT_INTENT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("RESPONSE STATUS:", response.status);
      console.log("RESPONSE OK:", response.ok);

      const data = await response.json();
      console.log("RESPONSE BODY:", JSON.stringify(data, null, 2));
      console.log("Payment intent created:", data);

      // The API returns the client secret directly as a string
      if (typeof data !== "string") {
        throw new Error("Invalid response format from payment intent creation");
      }

      return data; // Return the client secret directly
    } catch (error) {
      console.error("Error creating payment intent:", error);
      throw error;
    }
  };

  const initializePayment = async () => {
    try {
      console.log("Initializing payment...");
      setLoading(true);

      const clientSecret = await createPaymentIntent();
      console.log("Initializing payment sheet with client secret", clientSecret);

      // Store the client secret for later use
      setCurrentClientSecret(clientSecret);

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: businessName,
        paymentIntentClientSecret: clientSecret,
        defaultBillingDetails: {
          name: "Customer Name",
        },
        appearance: {
          colors: {
            primary: "#9C45F7",
          },
        },
      });

      if (initError) {
        console.error("Payment initialization error:", initError);
        Alert.alert("Error", "Failed to initialize payment");
        return false;
      }

      console.log("Payment sheet initialized successfully");
      return true;
    } catch (error) {
      console.error("Payment initialization error:", error);
      Alert.alert("Error", "Failed to initialize payment");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getProfileId = async (userUid) => {
    try {
      console.log("Fetching profile ID for user:", userUid);
      const endpoint = `${USER_PROFILE_INFO_ENDPOINT}/${userUid}`;

      console.log("============================================");
      console.log("ENDPOINT: GET_PROFILE_ID");
      console.log("URL:", endpoint);
      console.log("METHOD: GET");
      console.log("============================================");

      const response = await fetch(endpoint);

      console.log("RESPONSE STATUS:", response.status);
      console.log("RESPONSE OK:", response.ok);

      const data = await response.json();
      console.log("RESPONSE BODY:", JSON.stringify(data, null, 2));
      console.log("Profile data received:", data);

      if (data && data.personal_info && data.personal_info.profile_personal_uid) {
        const profileId = data.personal_info.profile_personal_uid;
        console.log("Extracted profile ID:", profileId);
        return profileId;
      }
      throw new Error("Profile ID not found");
    } catch (error) {
      console.error("Error fetching profile ID:", error);
      throw error;
    }
  };

  const prepareTransactionData = (buyerUid, paymentIntent, totalAmount, processingFee = 0) => {
    // Use the referral profile ID from route params, or fallback to a default
    // If the recommender is "Charity", use a default referral ID
    const recommenderProfileId = recommender_profile_id && recommender_profile_id !== "Charity" ? recommender_profile_id : "110-000231"; // Default referral ID for charity purchases

    // For the business_id, we need to handle the case where we have multiple businesses
    // If business_uid is 'all' (from SearchScreen), we'll use the first item's business_uid
    // Otherwise, use the passed business_uid
    let transactionBusinessId = business_uid;
    if (business_uid === "all" && cartItems.length > 0) {
      // Use the business_uid from the first cart item
      transactionBusinessId = cartItems[0].business_uid;
      console.log("Using business_uid from first cart item:", transactionBusinessId);
    }

    const subtotal = parseFloat(calculateTotal());
    const transactionData = {
      profile_id: buyerUid,
      business_id: transactionBusinessId,
      stripe_payment_intent: paymentIntent,
      total_amount_paid: parseFloat(totalAmount),
      total_costs: subtotal,
      total_taxes: parseFloat(processingFee), // 3% processing fee for credit card payments
      items: cartItems.map((item) => ({
        bs_uid: item.bs_uid,
        bounty: parseFloat(item.bs_bounty) || 0,
        quantity: parseInt(item.quantity) || 1,
        recommender_profile_id: recommenderProfileId,
      })),
    };

    console.log("Prepared Transaction Data:", JSON.stringify(transactionData, null, 2));
    console.log("Subtotal:", subtotal);
    console.log("Processing Fee (tax):", processingFee);
    console.log("Total Amount Paid:", totalAmount);
    console.log("Using recommender profile ID:", recommenderProfileId);
    console.log("Original recommender from route:", recommender_profile_id);
    console.log("Transaction business ID:", transactionBusinessId);
    return transactionData;
  };

  const recordTransactions = async (buyerUid, paymentIntent, totalAmount = null, processingFee = null) => {
    try {
      console.log("Recording transactions for items:", cartItems);

      // Get the buyer's profile ID
      let buyerProfileId;
      if (!buyerUid.startsWith("110")) {
        buyerProfileId = await getProfileId(buyerUid);
        console.log("Buyer profile ID:", buyerProfileId);
      } else {
        buyerProfileId = buyerUid;
      }

      // Calculate processing fee if not provided (3% for web Stripe payments)
      const subtotal = calculateTotal();
      const fee = processingFee !== null ? processingFee : subtotal * 0.03;
      const total = totalAmount !== null ? totalAmount : subtotal + fee;

      console.log("Transaction amounts - Subtotal:", subtotal, "Fee:", fee, "Total:", total);

      // Prepare the transaction data
      const transactionData = prepareTransactionData(buyerProfileId, paymentIntent || "PAYMENT_INTENT_ID", total, fee);

      console.log("============================================");
      console.log("ENDPOINT: RECORD_TRANSACTIONS");
      console.log("URL:", TRANSACTIONS_ENDPOINT);
      console.log("METHOD: POST");
      console.log("REQUEST BODY:", JSON.stringify(transactionData, null, 2));
      console.log("============================================");

      // Make a single API call with all transaction data
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
      console.log("Transactions recorded:", result);

      if (!response.ok) {
        throw new Error(`Failed to record transactions: ${result.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error recording transactions:", error);
      throw error;
    }
  };

  // Handle fees dialog continue
  const handleFeesDialogContinue = async () => {
    try {
      setShowFeesDialog(false);
      setLoading(true);

      // Load Stripe public key
      await loadStripePublicKey("ECTEST"); // Using ECTEST for now, can be made dynamic

      // Calculate total with 3% fee
      const subtotal = calculateTotal();
      const fee = subtotal * 0.03;
      const total = subtotal + fee;

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

      // Calculate amounts with 3% processing fee
      const subtotal = calculateTotal();
      const processingFee = subtotal * 0.03;
      const totalAmount = subtotal + processingFee;

      console.log("Web payment amounts - Subtotal:", subtotal, "Processing Fee (3%):", processingFee, "Total:", totalAmount);

      // Record the transactions with fee included
      await recordTransactions(buyerUid, paymentIntent, totalAmount, processingFee);

      // Clear ALL cart data from AsyncStorage
      try {
        console.log("Clearing all cart data...");
        const keys = await AsyncStorage.getAllKeys();
        const cartKeys = keys.filter((key) => key.startsWith("cart_"));
        console.log("Found cart keys to clear:", cartKeys);

        // Clear each cart
        await Promise.all(cartKeys.map((key) => AsyncStorage.removeItem(key)));
        console.log("All cart data cleared successfully");

        // Clear local state
        setCartItems([]);

        Alert.alert("Success", "Payment successful! Your order has been placed.", [
          {
            text: "OK",
            onPress: () => {
              // Navigate to Search screen with refresh parameter
              navigation.navigate("Search", { refreshCart: true });
            },
          },
        ]);
      } catch (error) {
        console.error("Error clearing cart data:", error);
        Alert.alert("Error", "There was an error clearing your cart. Please try again.");
      }
    } catch (error) {
      console.error("Web payment submission error:", error);
      setPaymentError(error);
      setShowPaymentFailure(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    console.log("Checkout button pressed");
    console.log("Platform:", Platform.OS);

    if (!stripeInitialized) {
      Alert.alert("Error", "Payment system is not ready. Please try again.");
      return;
    }

    // Web Stripe flow
    if (isWeb) {
      try {
        setLoading(true);
        // Show fees dialog first
        setShowFeesDialog(true);
      } catch (error) {
        console.error("Error starting web checkout:", error);
        Alert.alert("Error", "An error occurred. Please try again.");
        setLoading(false);
      }
      return;
    }

    // Native Stripe flow (existing code)
    try {
      setLoading(true);
      console.log("Starting checkout process...");

      const initialized = await initializePayment();
      if (!initialized) {
        console.log("Payment initialization failed");
        return;
      }

      console.log("Presenting payment sheet...");
      const result = await presentPaymentSheet();

      // Log Stripe result structure for debugging
      console.log("Stripe result structure:", {
        hasError: "error" in result,
        hasPaymentOption: "paymentOption" in result,
        keys: Object.keys(result),
      });

      if (result.error) {
        console.error("Payment error:", result.error);
        Alert.alert("Error", "Payment failed. Please try again.");
        return;
      }

      console.log("Payment successful!");

      // For successful payments, Stripe only returns { error: undefined }
      // We need to use the original client secret which contains the payment intent ID
      console.log("Using stored client secret as payment intent:", currentClientSecret);
      const paymentIntent = currentClientSecret;

      // Get the buyer's ID
      const buyerUid = await AsyncStorage.getItem("profile_uid");
      if (!buyerUid) {
        throw new Error("User ID not found");
      }

      // Record the transactions
      await recordTransactions(buyerUid, paymentIntent);

      // Clear ALL cart data from AsyncStorage
      try {
        console.log("Clearing all cart data...");
        const keys = await AsyncStorage.getAllKeys();
        const cartKeys = keys.filter((key) => key.startsWith("cart_"));
        console.log("Found cart keys to clear:", cartKeys);

        // Clear each cart
        await Promise.all(cartKeys.map((key) => AsyncStorage.removeItem(key)));
        console.log("All cart data cleared successfully");

        // Clear local state
        setCartItems([]);

        Alert.alert("Success", "Payment successful! Your order has been placed.", [
          {
            text: "OK",
            onPress: () => {
              // Navigate to Search screen with refresh parameter
              navigation.navigate("Search", { refreshCart: true });
            },
          },
        ]);
      } catch (error) {
        console.error("Error clearing cart data:", error);
        Alert.alert("Error", "There was an error clearing your cart. Please try again.");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      Alert.alert("Error", "An error occurred during checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <View style={styles.container}>
      {/* Header */}
      <AppHeader title='Shopping Cart' backgroundColor='#9C45F7' darkModeBackgroundColor='#7B35C7' onBackPress={() => navigation.goBack()} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {cartItems.length === 0 ? (
            <Text style={styles.emptyCart}>Your cart is empty</Text>
          ) : (
            <>
              <Text style={styles.businessName}>{businessName}</Text>
              {cartItems.map((item, index) => (
                <View key={index} style={styles.cartItemContainer}>
                  <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveItem(index)}>
                    <Ionicons name='close-circle' size={24} color='#FF3B30' />
                  </TouchableOpacity>
                  <View style={styles.cartItemContent}>
                    <Text style={styles.itemName}>{item.bs_service_name}</Text>
                    <Text style={styles.itemDescription}>{item.bs_service_desc}</Text>

                    <View style={styles.priceContainer}>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Price:</Text>
                        <Text style={styles.priceValue}>
                          {item.bs_cost_currency || "USD"} {parseFloat(item.bs_cost).toFixed(2)}
                        </Text>
                      </View>

                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Bounty:</Text>
                        <Text style={styles.priceValue}>
                          {item.bs_bounty_currency || "USD"} {(parseFloat(item.bs_bounty) || 0).toFixed(2)}
                        </Text>
                      </View>

                      <View style={styles.quantityContainer}>
                        <Text style={styles.priceLabel}>Quantity:</Text>
                        <View style={styles.quantityControls}>
                          <TouchableOpacity style={styles.quantityButton} onPress={() => handleQuantityChange(index, -1)}>
                            <Ionicons name='remove' size={20} color='#9C45F7' />
                          </TouchableOpacity>
                          <Text style={styles.quantityText}>{item.quantity || 1}</Text>
                          <TouchableOpacity style={styles.quantityButton} onPress={() => handleQuantityChange(index, 1)}>
                            <Ionicons name='add' size={20} color='#9C45F7' />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total Price:</Text>
                        <Text style={styles.totalValue}>
                          {item.bs_cost_currency || "USD"} {(parseFloat(item.totalPrice) || parseFloat(item.bs_cost) * (item.quantity || 1)).toFixed(2)}
                        </Text>
                      </View>

                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total Bounty:</Text>
                        <Text style={styles.totalValue}>
                          {item.bs_bounty_currency || "USD"} {(parseFloat(item.bs_bounty) || 0).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
              <View style={styles.totalContainer}>
                <Text style={styles.totalText}>Grand Total: ${calculateTotal().toFixed(2)}</Text>
              </View>
            </>
          )}
        </ScrollView>

        {cartItems.length > 0 && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.checkoutButton, loading && styles.disabledButton]}
              onPress={() => {
                console.log("Checkout button pressed - direct handler");
                handleCheckout();
              }}
              disabled={loading}
            >
              <Text style={styles.checkoutButtonText}>{loading ? "Processing..." : "Proceed to Checkout"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.returnButton} onPress={() => navigation.goBack()} disabled={loading}>
              <Text style={styles.returnButtonText}>Return to Business</Text>
            </TouchableOpacity>
          </View>
        )}

        <BottomNavBar navigation={navigation} />
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
          {stripePromise && customerUid && (
            <StripePayment
              message='ECTEST'
              amount={calculateTotal() * 1.03} // Add 3% fee
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
              navigation.navigate("Search", { refreshCart: true });
            }}
          />
        </>
      )}
    </View>
  );

  // Only wrap with StripeProvider on native platforms
  if (StripeProvider && !isWeb && STRIPE_PUBLISHABLE_KEY) {
    return <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>{content}</StripeProvider>;
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 250,
  },
  emptyCart: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    marginTop: 50,
  },
  businessName: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
  cartItemContainer: {
    position: "relative",
    marginBottom: 15,
  },
  removeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 12,
  },
  footer: {
    backgroundColor: "#fff",
    padding: 20,
    paddingBottom: 110,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  checkoutButton: {
    backgroundColor: "#9C45F7",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  checkoutButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  returnButton: {
    backgroundColor: "#F5F5F5",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  returnButtonText: {
    color: "#9C45F7",
    fontSize: 16,
    fontWeight: "bold",
  },
  totalContainer: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    alignItems: "flex-end",
  },
  totalText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  disabledButton: {
    opacity: 0.7,
  },
  cartItemContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  itemName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  itemDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 10,
  },
  priceContainer: {
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
    paddingTop: 10,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  priceLabel: {
    fontSize: 14,
    color: "#666",
  },
  priceValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#9C45F7",
  },
  quantityContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 4,
  },
  quantityButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  quantityText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginHorizontal: 12,
    minWidth: 24,
    textAlign: "center",
  },
});

export default ShoppingCartScreen;
