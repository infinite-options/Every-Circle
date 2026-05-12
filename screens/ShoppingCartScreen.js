// ShoppingCartScreen.js
import React, { useEffect, useState, useRef } from "react";
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
import { parsePrice } from "../utils/priceUtils";
import { canonicalBusinessCcFeePayer } from "../utils/normalizeBusinessServiceFromApi";

// Use the publishable key from environment variables
const STRIPE_PUBLISHABLE_KEY = REACT_APP_STRIPE_PUBLIC_KEY;
// console.log("STRIPE_PUBLISHABLE_KEY:", STRIPE_PUBLISHABLE_KEY);

const GENERIC_CART_TITLES = ["All Items", "My Cart", "Cart"];

/** Seller id for checkout grouping (business_uid or expertise profile_uid). */
function getCheckoutSellerId(item) {
  if (!item || typeof item !== "object") return null;
  if (item.itemType === "expertise") {
    const p = item.profile_uid != null && String(item.profile_uid).trim() !== "" ? String(item.profile_uid).trim() : null;
    const b = item.business_uid != null && String(item.business_uid).trim() !== "" ? String(item.business_uid).trim() : null;
    return p || b || null;
  }
  const b = item.business_uid != null && String(item.business_uid).trim() !== "" ? String(item.business_uid).trim() : null;
  return b || null;
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

/** Whether this service line is subject to sales tax (expertise handled separately). */
function isLineTaxable(item) {
  if (!item || item.itemType === "expertise") return false;
  const v = item.bs_is_taxable;
  if (v === undefined || v === null || v === "") {
    return parsePrice(item.bs_tax_rate) > 0;
  }
  if (v === false || v === 0) return false;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "0" || t === "false" || t === "no") return false;
    if (t === "1" || t === "true" || t === "yes") return true;
    const n = parseInt(t, 10);
    if (!Number.isNaN(n)) return n !== 0;
  }
  if (typeof v === "number") return v !== 0;
  return Boolean(v);
}

/**
 * Tax rate as a percentage for formula: pretax × (rate ÷ 100).
 * Matches product edit: enter "8.25" for 8.25%. Stored value is shown on each cart line for verification.
 */
function taxRatePercentForCalculation(raw) {
  return parsePrice(raw != null ? raw : 0);
}

/**
 * Pretax line total, sales tax, and metadata for cart display / checkout.
 * Services: pretax = bs_cost × qty; tax when taxable and rate > 0.
 */
function lineMerchandiseAndTax(item) {
  const qty = parseInt(item.quantity, 10) || 1;
  if (item.itemType === "expertise") {
    const pretax = roundMoney(parsePrice(item.cost) * qty);
    return {
      pretax,
      tax: 0,
      taxable: false,
      rawTaxRate: null,
      ratePercentUsed: null,
    };
  }
  const pretax = roundMoney(parsePrice(item.bs_cost) * qty);
  const rawTaxRate = item.bs_tax_rate;
  const taxable = isLineTaxable(item);
  const ratePercent = taxRatePercentForCalculation(rawTaxRate);
  const tax = taxable && ratePercent > 0 ? roundMoney(pretax * (ratePercent / 100)) : 0;
  return {
    pretax,
    tax,
    taxable,
    rawTaxRate,
    ratePercentUsed: taxable && ratePercent > 0 ? ratePercent : null,
  };
}

function calculateSubtotalForCartItems(items) {
  return items.reduce((sum, item) => sum + lineMerchandiseAndTax(item).pretax, 0);
}

/** True when buyer pays Stripe card fees (business_cc_fee_payer === buyer). */
function groupBuyerPaysCardFee(items) {
  const raw = items[0]?.business_cc_fee_payer ?? items[0]?.bs_cc_fee_payer;
  return canonicalBusinessCcFeePayer(raw) === "buyer";
}

/**
 * One entry per seller: merchandise, sales tax, optional 3% card fee (buyer only), Stripe total.
 */
function buildSellerCheckoutGroups(cartItems, resolveBusinessName) {
  const map = new Map();
  for (const item of cartItems) {
    const sid = getCheckoutSellerId(item);
    if (!sid) continue;
    if (!map.has(sid)) map.set(sid, []);
    map.get(sid).push(item);
  }
  return Array.from(map.entries()).map(([sellerId, items]) => {
    let merchandiseSubtotal = 0;
    let salesTaxTotal = 0;
    for (const item of items) {
      const { pretax, tax } = lineMerchandiseAndTax(item);
      merchandiseSubtotal += pretax;
      salesTaxTotal += tax;
    }
    merchandiseSubtotal = roundMoney(merchandiseSubtotal);
    salesTaxTotal = roundMoney(salesTaxTotal);
    const subtotalAfterTax = roundMoney(merchandiseSubtotal + salesTaxTotal);
    const buyerPaysCardFee = groupBuyerPaysCardFee(items);
    const processingFee = buyerPaysCardFee ? roundMoney(subtotalAfterTax * 0.03) : 0;
    const total = roundMoney(subtotalAfterTax + processingFee);
    const first = items[0];
    const displayName =
      (typeof resolveBusinessName === "function" && resolveBusinessName(first)) ||
      (first?.business_name && String(first.business_name).trim()) ||
      (first?.itemType === "expertise" && first?.title && String(first.title).trim()) ||
      "Purchase";
    return {
      sellerId,
      items,
      merchandiseSubtotal,
      salesTaxTotal,
      subtotalAfterTax,
      buyerPaysCardFee,
      processingFee,
      total,
      displayName,
    };
  });
}

const ShoppingCartScreen = ({ route, navigation }) => {
  const { cartItems: initialCartItems, onRemoveItem, businessName, business_uid, recommender_profile_id } = route.params;
  const [cartItems, setCartItems] = useState(initialCartItems);

  const resolveItemBusinessName = (item) => {
    if (item.itemType === "expertise") {
      if (item.business_name && String(item.business_name).trim()) return String(item.business_name).trim();
      const p = item.profileData;
      const n = p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() : "";
      return n || null;
    }
    const fromItem = item.business_name && String(item.business_name).trim();
    if (fromItem) return fromItem;
    if (
      business_uid &&
      business_uid !== "all" &&
      item.business_uid === business_uid &&
      businessName &&
      !GENERIC_CART_TITLES.includes(String(businessName))
    ) {
      return String(businessName).trim();
    }
    return null;
  };

  const showVendorHeader =
    Boolean(businessName && String(businessName).trim()) &&
    business_uid &&
    business_uid !== "all" &&
    !GENERIC_CART_TITLES.includes(String(businessName));

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
  /** Per seller (business / expertise profile): whether this checkout uses escrow. */
  const [escrowBySeller, setEscrowBySeller] = useState({});
  const [refundAcknowledged, setRefundAcknowledged] = useState(false); //refund acknowledgement state
  const [refundError, setRefundError] = useState(false);

  /** Web: one Stripe payment per seller; kept in ref + state so submit handler sees latest step. */
  const webCheckoutSessionRef = useRef(null);
  const [webCheckoutSession, setWebCheckoutSession] = useState(null); // { groups, index } | null

  useEffect(() => {
    webCheckoutSessionRef.current = webCheckoutSession;
  }, [webCheckoutSession]);

  // Handle fees dialog continue
  const handleFeesDialogContinue = async () => {
    try {
      setShowFeesDialog(false);
      setLoading(true);

      const groups = buildSellerCheckoutGroups(cartItems, resolveItemBusinessName);
      if (!groups.length) {
        Alert.alert("Error", "No billable items in your cart (missing seller information).");
        setLoading(false);
        return;
      }

      const totalRows = cartItems.filter((it) => getCheckoutSellerId(it)).length;
      if (totalRows < cartItems.length) {
        Alert.alert("Error", "Some cart items cannot be checked out. Remove or fix items without a business or profile.");
        setLoading(false);
        return;
      }

      const session = { groups, index: 0 };
      webCheckoutSessionRef.current = session;
      setWebCheckoutSession(session);

      await loadStripePublicKey("ECTEST");

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
    console.log("=== handleWebPaymentSubmit CALLED ===");
    try {
      setLoading(true);
      console.log("Web payment submitted - paymentIntent:", paymentIntent, "paymentMethod:", paymentMethod);

      const buyerUid = await AsyncStorage.getItem("profile_uid");
      if (!buyerUid) {
        throw new Error("User ID not found");
      }

      const sess = webCheckoutSessionRef.current;
      if (!sess || !sess.groups.length || sess.index >= sess.groups.length) {
        throw new Error("Checkout session expired. Please start again.");
      }

      const group = sess.groups[sess.index];
      console.log(`Recording web payment step ${sess.index + 1}/${sess.groups.length} for`, group.sellerId);

      await recordSingleBusinessTransaction(buyerUid, paymentIntent, group, escrowBySeller[group.sellerId] !== false);

      const nextIndex = sess.index + 1;
      if (nextIndex < sess.groups.length) {
        const nextSession = { groups: sess.groups, index: nextIndex };
        webCheckoutSessionRef.current = nextSession;
        setWebCheckoutSession(nextSession);
        setShowStripePayment(false);
        setTimeout(() => setShowStripePayment(true), 200);
        setLoading(false);
        return;
      }

      webCheckoutSessionRef.current = null;
      setWebCheckoutSession(null);

      try {
        console.log("Clearing all cart data...");
        const keys = await AsyncStorage.getAllKeys();
        const cartKeys = keys.filter((key) => key.startsWith("cart_"));
        await Promise.all(cartKeys.map((key) => AsyncStorage.removeItem(key)));
        setCartItems([]);
        Alert.alert("Success", "Payment successful! Your order has been placed.", [
          {
            text: "OK",
            onPress: () => {
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
      const sess = webCheckoutSessionRef.current;
      if (sess && sess.index > 0) {
        try {
          const paid = sess.groups.slice(0, sess.index).flatMap((g) => g.items);
          await removePaidItemsFromStorage(paid);
        } catch (e) {
          console.warn("Could not trim cart after failed multi-step web checkout:", e);
        }
        webCheckoutSessionRef.current = null;
        setWebCheckoutSession(null);
        setShowStripePayment(false);
      }
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

    if (!refundAcknowledged) {
      setRefundError(true);
      return;
    }
    setRefundError(false);

    // Web Stripe flow
    if (isWeb) {
      try {
        setLoading(true);
        setShowFeesDialog(true);
      } catch (error) {
        console.error("Error starting web checkout:", error);
        Alert.alert("Error", "An error occurred. Please try again.");
        setLoading(false);
      }
      return;
    }

    const groups = buildSellerCheckoutGroups(cartItems, resolveItemBusinessName);
    if (!groups.length) {
      Alert.alert("Error", "No billable items in your cart (missing seller information).");
      return;
    }
    const totalRows = cartItems.filter((it) => getCheckoutSellerId(it)).length;
    if (totalRows < cartItems.length) {
      Alert.alert("Error", "Some cart items cannot be checked out. Remove or fix items without a business or profile.");
      return;
    }

    const buyerUid = await AsyncStorage.getItem("profile_uid");
    if (!buyerUid) {
      Alert.alert("Error", "User ID not found. Please log in again.");
      return;
    }

    const completedGroups = [];
    try {
      setLoading(true);
      console.log("Starting checkout —", groups.length, "separate payment(s) for", groups.length, "seller(s)");

      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        console.log(`Native checkout step ${i + 1}/${groups.length}`, group.sellerId, group.total);

        const clientSecret = await createPaymentIntent(group.total);
        const ok = await initializePaymentSheetForGroup(clientSecret, group.displayName);
        if (!ok) {
          throw new Error("Failed to initialize payment sheet");
        }

        const result = await presentPaymentSheet();
        if (result.error) {
          console.error("Payment error:", result.error);
          throw new Error(result.error.message || "Payment failed");
        }

        await recordSingleBusinessTransaction(buyerUid, clientSecret, group, escrowBySeller[group.sellerId] !== false);
        completedGroups.push(group);
      }

      try {
        console.log("Clearing all cart data...");
        const keys = await AsyncStorage.getAllKeys();
        const cartKeys = keys.filter((key) => key.startsWith("cart_"));
        await Promise.all(cartKeys.map((key) => AsyncStorage.removeItem(key)));
        setCartItems([]);

        Alert.alert("Success", "Payment successful! Your order has been placed.", [
          {
            text: "OK",
            onPress: () => {
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
      if (completedGroups.length > 0) {
        try {
          await removePaidItemsFromStorage(completedGroups.flatMap((g) => g.items));
        } catch (e) {
          console.warn("Failed to trim cart after partial checkout:", e);
        }
        const paidKeys = new Set(
          completedGroups.flatMap((g) =>
            g.items.map((it) => (it.itemType === "expertise" ? `e:${it.expertise_uid}` : `s:${it.business_uid}:${it.bs_uid}`)),
          ),
        );
        setCartItems((prev) =>
          prev.filter((it) => !paidKeys.has(it.itemType === "expertise" ? `e:${it.expertise_uid}` : `s:${it.business_uid}:${it.bs_uid}`)),
        );
        Alert.alert(
          "Partial checkout",
          `${completedGroups.length} of ${groups.length} payment(s) succeeded. Those items were removed from your cart. Remaining items are still in your cart. Please try again for the rest, or contact support if you were charged incorrectly.`,
        );
      } else {
        Alert.alert("Error", error.message || "An error occurred during checkout. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    const ids = new Set(cartItems.map(getCheckoutSellerId).filter(Boolean));
    if (ids.size === 0) return;
    setEscrowBySeller((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (next[id] === undefined) next[id] = true;
      });
      Object.keys(next).forEach((k) => {
        if (!ids.has(k)) delete next[k];
      });
      return next;
    });
  }, [cartItems]);

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
      const itemToRemove = cartItems[index];

      if (itemToRemove.itemType === "expertise") {
        await AsyncStorage.removeItem(itemToRemove.cart_key || `cart_expertise_${itemToRemove.expertise_uid}`);
      } else {
        const itemBusinessUid = itemToRemove.business_uid;
        const storedCartData = await AsyncStorage.getItem(`cart_${itemBusinessUid}`);
        let cartData = storedCartData ? JSON.parse(storedCartData) : { items: [] };
        cartData.items = cartData.items.filter((item) => item.bs_uid !== itemToRemove.bs_uid);
        await AsyncStorage.setItem(`cart_${itemBusinessUid}`, JSON.stringify(cartData));
        if (onRemoveItem) onRemoveItem(index);
      }

      setCartItems((prevItems) => prevItems.filter((_, i) => i !== index));
    } catch (error) {
      console.error("Error removing item from cart:", error);
      Alert.alert("Error", "Failed to remove item from cart");
    }
  };

  const handleQuantityChange = async (index, change) => {
    try {
      const newCartItems = [...cartItems];
      const currentQuantity = newCartItems[index].quantity || 1;
      const newQuantity = Math.max(1, currentQuantity + change);

      if (newCartItems[index].itemType === "expertise") {
        newCartItems[index] = { ...newCartItems[index], quantity: newQuantity };
        setCartItems(newCartItems);
        const cartKey = newCartItems[index].cart_key || `cart_expertise_${newCartItems[index].expertise_uid}`;
        await AsyncStorage.setItem(cartKey, JSON.stringify(newCartItems[index]));
      } else {
        newCartItems[index] = {
          ...newCartItems[index],
          quantity: newQuantity,
          totalPrice: (parsePrice(newCartItems[index].bs_cost) * newQuantity).toFixed(2),
        };
        setCartItems(newCartItems);
        const businessUid = newCartItems[index].business_uid;
        const businessItems = newCartItems.filter((item) => item.business_uid === businessUid);
        await AsyncStorage.setItem(`cart_${businessUid}`, JSON.stringify({ items: businessItems }));
      }
    } catch (error) {
      console.error("Error updating quantity:", error);
      Alert.alert("Error", "Failed to update quantity");
    }
  };

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => {
      if (item.itemType === "expertise") {
        const cost = parsePrice(item.cost);
        const quantity = item.quantity || 1;
        return total + cost * quantity;
      }
      const cost = parsePrice(item.bs_cost);
      const quantity = item.quantity || 1;
      return total + cost * quantity;
    }, 0);
  };

  const createPaymentIntent = async (paymentTotal) => {
    try {
      console.log("Creating payment intent...");
      const profile_uid = await AsyncStorage.getItem("profile_uid");
      console.log("User profile UID:", profile_uid);

      if (!profile_uid) {
        throw new Error("User profile not found");
      }

      const total =
        paymentTotal !== undefined && paymentTotal !== null ? Number(paymentTotal) : calculateTotal();
      if (!Number.isFinite(total) || total <= 0) {
        throw new Error("Invalid payment amount");
      }
      console.log("Creating payment intent for amount:", total);

      const requestBody = {
        customer_uid: profile_uid,
        business_code: "ECTEST",
        payment_summary: {
          tax: 0,
          total: Number(total).toFixed(2),
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

  const initializePaymentSheetForGroup = async (clientSecret, merchantDisplayName) => {
    try {
      console.log("Initializing payment sheet with client secret", clientSecret);
      setCurrentClientSecret(clientSecret);

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: merchantDisplayName || businessName || "Every Circle",
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
    }
  };

  /** POST one transaction row for one Stripe payment (one seller's lines only). */
  const recordSingleBusinessTransaction = async (buyerUid, paymentIntent, group, escrowValue = true) => {
    try {
      console.log("Recording transaction for seller", group.sellerId, "items:", group.items);

      let buyerProfileId;
      if (!buyerUid.startsWith("110")) {
        buyerProfileId = await getProfileId(buyerUid);
        console.log("Buyer profile ID:", buyerProfileId);
      } else {
        buyerProfileId = buyerUid;
      }

      const subtotalAfterTax = group.subtotalAfterTax;
      const fee = group.processingFee;
      const total = group.total;

      const defaultRecommender =
        recommender_profile_id && recommender_profile_id !== "Charity" ? recommender_profile_id : "110-000231";

      const transactionInEscrow = escrowValue === true || escrowValue === 1 ? 1 : 0;

      const items = group.items.map((item) => {
        const qty = parseInt(item.quantity, 10) || 1;
        const bountyType = item.itemType === "expertise" ? "per_item" : item.bs_bounty_type || "per_item";
        const bounty = item.itemType === "expertise" ? parsePrice(item.bounty) : parsePrice(item.bs_bounty);
        const sellerBusinessId = item.business_uid || item.profile_uid;
        return {
          business_id: sellerBusinessId,
          bs_uid: item.itemType === "expertise" ? item.expertise_uid : item.bs_uid,
          item_type: item.itemType === "expertise" ? "expertise" : "service",
          bounty,
          bounty_type: bountyType,
          quantity: qty,
          recommender_profile_id: item.bounty_recommender_profile_id || defaultRecommender,
        };
      });

      const transactionData = {
        profile_id: buyerProfileId,
        business_id: group.sellerId,
        stripe_payment_intent: paymentIntent,
        total_amount_paid: parseFloat(Number(total).toFixed(2)),
        total_costs: parseFloat(Number(subtotalAfterTax).toFixed(2)),
        total_taxes: parseFloat(Number(fee).toFixed(2)),
        transaction_in_escrow: transactionInEscrow,
        items,
      };

      console.log("Posting transaction for one seller:", JSON.stringify(transactionData, null, 2));

      const response = await fetch(TRANSACTIONS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transactionData),
      });

      console.log("RESPONSE STATUS:", response.status);
      console.log("RESPONSE OK:", response.ok);

      const result = await response.json();
      console.log("RESPONSE BODY:", JSON.stringify(result, null, 2));
      console.log("Transaction recorded:", result);

      if (!response.ok) {
        throw new Error(`Failed to record transaction: ${result.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error recording transactions:", error);
      throw error;
    }
  };

  /** Remove specific line items from AsyncStorage (partial checkout success). */
  const removePaidItemsFromStorage = async (paidItems) => {
    const businessUidToRemoveBsUids = new Map();
    for (const item of paidItems) {
      if (item.itemType === "expertise") {
        const key = item.cart_key || `cart_expertise_${item.expertise_uid}`;
        await AsyncStorage.removeItem(key);
        continue;
      }
      const biz = item.business_uid;
      if (!biz || !item.bs_uid) continue;
      if (!businessUidToRemoveBsUids.has(biz)) businessUidToRemoveBsUids.set(biz, new Set());
      businessUidToRemoveBsUids.get(biz).add(item.bs_uid);
    }
    for (const [biz, uidSet] of businessUidToRemoveBsUids) {
      const stored = await AsyncStorage.getItem(`cart_${biz}`);
      if (!stored) continue;
      const cartData = JSON.parse(stored);
      cartData.items = (cartData.items || []).filter((row) => !uidSet.has(row.bs_uid));
      await AsyncStorage.setItem(`cart_${biz}`, JSON.stringify(cartData));
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

  const sellerGroupsPreview = buildSellerCheckoutGroups(cartItems, resolveItemBusinessName);
  const multiSellerCheckout = sellerGroupsPreview.length > 1;
  const feeDialogFirstGroup = sellerGroupsPreview[0];
  const webStripeAmount =
    webCheckoutSession && webCheckoutSession.groups[webCheckoutSession.index]
      ? webCheckoutSession.groups[webCheckoutSession.index].total
      : 0;

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
              {showVendorHeader ? (
                <View style={styles.cartVendorHeader}>
                  <Text style={styles.cartVendorLabel}>Business</Text>
                  <Text style={styles.businessName}>{businessName}</Text>
                </View>
              ) : (
                <Text style={styles.cartOverviewTitle}>Your cart</Text>
              )}
              {cartItems.map((item, index) => {
                const lineBusiness = resolveItemBusinessName(item);
                const showLineBusiness =
                  Boolean(lineBusiness) &&
                  (item.itemType === "expertise" || business_uid === "all" || !showVendorHeader);
                const lineTax = lineMerchandiseAndTax(item);
                const rawRateLabel =
                  lineTax.rawTaxRate === undefined || lineTax.rawTaxRate === null || String(lineTax.rawTaxRate).trim() === ""
                    ? "—"
                    : String(lineTax.rawTaxRate);
                return (
                <View key={index} style={styles.cartItemContainer}>
                  <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveItem(index)}>
                    <Ionicons name='close-circle' size={24} color='#FF3B30' />
                  </TouchableOpacity>
                  <View style={styles.cartItemContent}>
                    <Text style={styles.itemName}>{item.itemType === "expertise" ? item.title : item.bs_service_name}</Text>
                    {showLineBusiness ? <Text style={styles.itemBusinessName}>{lineBusiness}</Text> : null}
                    <Text style={styles.itemDescription}>{item.itemType === "expertise" ? item.description : item.bs_service_desc}</Text>
                    <View style={styles.priceContainer}>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Price:</Text>
                        <Text style={styles.priceValue}>
                          {item.itemType === "expertise"
                            ? `$${parsePrice(item.cost).toFixed(2)}`
                            : `${item.bs_cost_currency === "USD" || !item.bs_cost_currency ? "$" : item.bs_cost_currency + " "}${parsePrice(item.bs_cost).toFixed(2)}`}
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
                          {item.itemType === "expertise"
                            ? `$${(parsePrice(item.cost) * (item.quantity || 1)).toFixed(2)}`
                            : `${item.bs_cost_currency === "USD" || !item.bs_cost_currency ? "$" : item.bs_cost_currency + " "}${(parsePrice(item.totalPrice) || parsePrice(item.bs_cost) * (item.quantity || 1)).toFixed(2)}`}
                        </Text>
                      </View>
                      {(item.itemType === "expertise" ? parsePrice(item.bounty) : parsePrice(item.bs_bounty)) > 0 && (
                        <View style={[styles.totalRow, styles.bountyNoteRow]}>
                          <Text style={styles.bountyNoteLabel}>Bounty (paid by Seller)</Text>
                          <Text style={styles.bountyNoteValue}>
                            $
                            {item.itemType === "expertise"
                              ? (parsePrice(item.bounty) * (item.quantity || 1)).toFixed(2)
                              : item.bs_bounty_type === "total"
                                ? parsePrice(item.bs_bounty).toFixed(2)
                                : (parsePrice(item.bs_bounty) * (item.quantity || 1)).toFixed(2)}
                          </Text>
                        </View>
                      )}
                      {item.itemType === "expertise" ? (
                        <Text style={styles.lineTaxMeta}>Sales tax: n/a (expertise)</Text>
                      ) : (
                        <View style={styles.lineTaxBlock}>
                          <Text style={styles.lineTaxMeta}>
                            Taxable: {lineTax.taxable ? "Yes" : "No"}
                            {" · "}
                            <Text style={styles.lineTaxMetaEm}>bs_tax_rate</Text> (stored): {rawRateLabel}
                          </Text>
                          <Text style={styles.lineTaxMeta}>
                            Rate used for this line:{" "}
                            {lineTax.ratePercentUsed != null ? `${Number(lineTax.ratePercentUsed).toFixed(4)}%` : "—"}{" "}
                            · Line sales tax: ${lineTax.tax.toFixed(2)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
              })}
              <View style={styles.totalContainer}>
                <Text style={styles.multiSellerHint}>
                  {multiSellerCheckout
                    ? `You will complete ${sellerGroupsPreview.length} separate payments (one per business). Sales tax is computed per item. Credit card processing (3%) applies only when that business has “buyer pays” card fees.`
                    : "Sales tax is computed per item. Credit card processing (3%) applies only when the business has “buyer pays” card fees."}
                </Text>
                {sellerGroupsPreview.map((g) => (
                  <View key={g.sellerId} style={styles.perBusinessBlock}>
                    {multiSellerCheckout ? <Text style={styles.perBusinessTitle}>{g.displayName}</Text> : null}
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Merchandise subtotal</Text>
                      <Text style={styles.totalValue}>${g.merchandiseSubtotal.toFixed(2)}</Text>
                    </View>
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Sales tax</Text>
                      <Text style={styles.totalValue}>${g.salesTaxTotal.toFixed(2)}</Text>
                    </View>
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Credit card processing (3%)</Text>
                      <Text style={styles.totalValue}>${g.processingFee.toFixed(2)}</Text>
                    </View>
                    {!g.buyerPaysCardFee ? (
                      <Text style={styles.cardFeeWaivedNote}>Business pays card fees — the processing line above is $0.00.</Text>
                    ) : null}
                    <View style={[styles.totalRow, styles.perBusinessTotalRow]}>
                      <Text style={styles.totalLabel}>Business total</Text>
                      <Text style={styles.totalValue}>${g.total.toFixed(2)}</Text>
                    </View>
                    <View style={styles.escrowSection}>
                      <TouchableOpacity
                        style={styles.escrowRow}
                        onPress={() =>
                          setEscrowBySeller((prev) => {
                            const cur = prev[g.sellerId] !== false;
                            return { ...prev, [g.sellerId]: !cur };
                          })
                        }
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, escrowBySeller[g.sellerId] !== false && styles.checkboxChecked]}>
                          {escrowBySeller[g.sellerId] !== false && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.escrowLabel}>Escrow ({g.displayName})</Text>
                        <Ionicons name='information-circle-outline' size={18} color='#666' style={styles.infoIcon} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {multiSellerCheckout ? (
                  <View style={[styles.totalRow, styles.grandTotalRow]}>
                    <Text style={styles.grandTotalLabel}>Grand total</Text>
                    <Text style={styles.grandTotalValue}>
                      ${sellerGroupsPreview.reduce((sum, g) => sum + g.total, 0).toFixed(2)}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.escrowSection}>
                <TouchableOpacity
                  style={styles.escrowRow}
                  onPress={() => {
                    setRefundAcknowledged(!refundAcknowledged);
                    setRefundError(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.checkbox,
                    refundAcknowledged && styles.checkboxChecked,
                    refundError && { borderColor: "#FF3B30" },
                  ]}>
                    {refundAcknowledged && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[styles.escrowLabel, { flex: 1 }, refundError && { color: "#FF3B30" }]}>
                    Return must be made in 5 days for a full refund, any returns past 5 days will result in a partial refund. Check the box to acknowledge.
                  </Text>
                </TouchableOpacity>
                {refundError && (
                  <Text style={{ color: "#FF3B30", fontSize: 13, marginTop: 6, marginLeft: 34 }}>
                    You must acknowledge the return policy before checking out.
                  </Text>
                )}
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
              webCheckoutSessionRef.current = null;
              setWebCheckoutSession(null);
            }}
            subtitle={
              cartItems.length > 0 && multiSellerCheckout && feeDialogFirstGroup
                ? `You will complete ${sellerGroupsPreview.length} separate payments (one per business). This step is for: ${feeDialogFirstGroup.displayName}.`
                : null
            }
            merchandiseSubtotal={feeDialogFirstGroup ? feeDialogFirstGroup.merchandiseSubtotal : undefined}
            salesTaxTotal={feeDialogFirstGroup ? feeDialogFirstGroup.salesTaxTotal : undefined}
            cardProcessingFee={feeDialogFirstGroup ? feeDialogFirstGroup.processingFee : undefined}
            buyerPaysCardFee={feeDialogFirstGroup ? feeDialogFirstGroup.buyerPaysCardFee : undefined}
            subtotal={feeDialogFirstGroup ? feeDialogFirstGroup.subtotalAfterTax : null}
            totalWithFee={feeDialogFirstGroup ? feeDialogFirstGroup.total : null}
          />
          {stripePromise && customerUid && (
            <StripePayment
              key={`stripe-pay-${webCheckoutSession?.index ?? 0}-${webStripeAmount}`}
              message='ECTEST'
              amount={webStripeAmount || 0}
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
  cartVendorHeader: {
    marginBottom: 16,
  },
  cartVendorLabel: {
    fontSize: 12,
    color: "#888",
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  cartOverviewTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    color: "#333",
  },
  businessName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  itemBusinessName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginTop: 4,
    marginBottom: 8,
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
    alignItems: "stretch",
  },
  multiSellerHint: {
    fontSize: 13,
    color: "#555",
    marginBottom: 12,
    lineHeight: 18,
  },
  perBusinessBlock: {
    borderWidth: 1,
    borderColor: "#e8e0f5",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#faf8fc",
  },
  perBusinessTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  perBusinessTotalRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  cardFeeWaivedNote: {
    fontSize: 13,
    color: "#666",
    fontStyle: "italic",
    marginTop: 4,
    marginBottom: 4,
  },
  grandTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#9C45F7",
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#9C45F7",
  },
  escrowSection: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  escrowRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: "#9C45F7",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: "#9C45F7",
  },
  checkmark: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  escrowLabel: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  infoIcon: {
    marginLeft: 6,
  },
  disabledButton: {
    opacity: 0.7,
  },
  cartItemContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
    ...(Platform.OS !== "web" && { elevation: 2 }),
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
  lineTaxBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  lineTaxMeta: {
    fontSize: 12,
    color: "#555",
    lineHeight: 17,
    marginBottom: 4,
  },
  lineTaxMetaEm: {
    fontWeight: "700",
    color: "#444",
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
  bountyNoteRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  bountyNoteLabel: {
    fontSize: 13,
    color: "#888",
    fontStyle: "italic",
  },
  bountyNoteValue: {
    fontSize: 13,
    color: "#888",
    fontStyle: "italic",
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
