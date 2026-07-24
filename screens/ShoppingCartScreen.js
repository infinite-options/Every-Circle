// ShoppingCartScreen.js
import React, { useEffect, useState, useRef, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, InteractionManager, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MiniCard from "../components/MiniCard";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

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

import { TRANSACTIONS_ENDPOINT, USER_PROFILE_INFO_ENDPOINT, CREATE_PAYMENT_INTENT_ENDPOINT } from "../apiConfig";
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
import StripeFeesDialog from "../components/StripeFeesDialog";
import PaymentFailure from "../components/PaymentFailure";
import { parsePrice } from "../utils/priceUtils";
import { cartChoiceEnrichmentFromItem, getItemizedChoiceLines, normalizeSelectedChoiceItemsForApi } from "../utils/selectedChoiceItems";
import { canonicalBusinessCcFeePayer } from "../utils/normalizeBusinessServiceFromApi";
import { recordServicePurchase } from "../utils/purchaseService";
import { expertiseLineMerchandiseAndTax, roundCartMoney, taxRatePercentForCalculation } from "../utils/cartLineTax";
import {
  getOfferingBountyLineTotal,
  getOfferingBountyTypeForCheckout,
  getOfferingLinePretax,
  getCartLineRemainingAddQuantity,
  getCartLineStockMax,
  formatCartLineStockBadge,
  getCartLineStockBadgeStyle,
  hasOfferingBounty,
  formatOfferingUnitPriceLabel,
  parseOfferingBountyAmount,
  isCartItemReturnable,
  isCartItemShippingApplicable,
  isCartItemBuyerPaysShipping,
} from "../utils/offeringCartUtils";
import { getCartItemBuyerShippingCharge, sumBuyerShippingCharges } from "../utils/businessServiceShipping";

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
  return roundCartMoney(n);
}

function CartStockBadge({ item }) {
  const label = formatCartLineStockBadge(item);
  const colors = getCartLineStockBadgeStyle(item);
  if (!label || !colors) return null;
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: colors.backgroundColor,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginBottom: 6,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.color }}>{label}</Text>
    </View>
  );
}

/** Bounty amount string for cart copy (matches Price row currency rules). */
function formatCartBountyAmountStr(item, amountNum) {
  const n = Number(amountNum);
  const fixed = Number.isFinite(n) ? n.toFixed(2) : "0.00";
  if (item.itemType === "expertise") return `$${fixed}`;
  const cur = item.bs_cost_currency;
  if (cur === "USD" || !cur) return `$${fixed}`;
  return `${cur} ${fixed}`;
}

/** e.g. "Bounty ($3.50 total paid by Seller)" vs "… per item …" */
function formatCartBountyPaidBySellerLine(item) {
  if (item.itemType === "expertise") {
    if (!hasOfferingBounty(item)) return null;
    const amt = parseOfferingBountyAmount(item);
    const amountStr = formatCartBountyAmountStr(item, amt);
    const isTotal = getOfferingBountyTypeForCheckout(item) === "total";
    return `Bounty (${amountStr} ${isTotal ? "total" : "per item"} paid by Seller)`;
  }
  const amt = parsePrice(item.bs_bounty);
  const amountStr = formatCartBountyAmountStr(item, amt);
  const isTotal = item.bs_bounty_type === "total";
  return `Bounty (${amountStr} ${isTotal ? "total" : "per item"} paid by Seller)`;
}

/** Total bounty $ for this cart line (matches checkout / old right column). */
function formatCartBountyLineTotalValueStr(item) {
  const qty = item.quantity || 1;
  let num;
  if (item.itemType === "expertise") {
    num = getOfferingBountyLineTotal(item, qty);
  } else if (item.bs_bounty_type === "total") {
    num = parsePrice(item.bs_bounty);
  } else {
    num = parsePrice(item.bs_bounty) * qty;
  }
  return formatCartBountyAmountStr(item, num);
}

function formatCartMoney(item, amountNum) {
  const n = Number(amountNum);
  const fixed = Number.isFinite(n) ? n.toFixed(2) : "0.00";
  if (item.itemType === "expertise") return `$${fixed}`;
  const cur = item.bs_cost_currency;
  if (cur === "USD" || !cur) return `$${fixed}`;
  return `${cur} ${fixed}`;
}

/** Per-line charge breakdown shown on each cart card (matches checkout grouping math). */
function getCartLineChargeBreakdown(item) {
  const qty = parseInt(item.quantity, 10) || 1;
  const { pretax, tax, taxable, ratePercentUsed } = lineMerchandiseAndTax(item);
  const unitPrice = qty > 0 ? roundMoney(pretax / qty) : pretax;
  const shipCharge = getCartItemBuyerShippingCharge(item);
  let shippingAmount = 0;
  let shippingIsActual = false;
  let shippingApplicable = false;
  if (shipCharge?.type === "fixed") {
    shippingApplicable = true;
    shippingAmount = roundMoney(shipCharge.amount);
  } else if (shipCharge?.type === "actual") {
    shippingApplicable = true;
    shippingIsActual = true;
  }
  const buyerPaysCardFee = groupBuyerPaysCardFee([item]);
  const subtotalWithShipping = roundMoney(pretax + tax + shippingAmount);
  const processingFee = buyerPaysCardFee ? roundMoney(subtotalWithShipping * 0.03) : 0;
  const totalCharge = roundMoney(subtotalWithShipping + processingFee);
  return {
    qty,
    unitPrice,
    itemSubtotal: pretax,
    shippingAmount,
    shippingIsActual,
    shippingApplicable,
    processingFee,
    buyerPaysCardFee,
    tax,
    taxable,
    taxRateLabel: ratePercentUsed != null ? `${ratePercentUsed}%` : null,
    totalCharge,
  };
}

function getCartLineBountyTotal(item) {
  const qty = item.quantity || 1;
  if (item.itemType === "expertise") {
    return hasOfferingBounty(item) ? getOfferingBountyLineTotal(item, qty) : 0;
  }
  if (parsePrice(item.bs_bounty) <= 0) return 0;
  return item.bs_bounty_type === "total" ? parsePrice(item.bs_bounty) : parsePrice(item.bs_bounty) * qty;
}

function CartBreakdownRow({ label, value, valueStyle }) {
  return (
    <View style={styles.cartBreakdownRow}>
      <Text style={styles.cartBreakdownLabel}>{label}</Text>
      <Text style={[styles.cartBreakdownValue, valueStyle]}>{value}</Text>
    </View>
  );
}

function CartItemCustomizationText({ item }) {
  if (item.itemType === "expertise") {
    const desc = String(item.description || "").trim();
    if (!desc) return null;
    return <Text style={styles.cartItemCustomization}>{desc}</Text>;
  }
  const choiceLines = getItemizedChoiceLines(item);
  const note = String(item.specialInstructions || "").trim();
  if (!choiceLines.length && !note) return null;
  return (
    <Text style={styles.cartItemCustomization}>
      {choiceLines.map((line, idx) => {
        const extra = parseFloat(line.extra_cost) || 0;
        const label = String(line.label || line.groupTitle || "").trim();
        const segment = extra > 0 ? `${label} +$${extra.toFixed(2)}` : label;
        return (
          <Text key={`${label}-${idx}`}>
            {idx > 0 ? " · " : ""}
            {segment}
          </Text>
        );
      })}
      {note ? (
        <Text>
          {choiceLines.length ? " · " : ""}
          <Text style={styles.cartItemCustomizationNote}>&ldquo;{note}&rdquo;</Text>
        </Text>
      ) : null}
    </Text>
  );
}

/**
 * `navigate("ShoppingCart", { cartItems })` is not always an array: params may be missing, or callers
 * occasionally pass the AsyncStorage shape `{ items: [...] }`. Coerce once when syncing into state so
 * the rest of the screen can assume `cartItems` is always `[]` or a row array.
 */
function cartItemsFromRouteParams(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object" && Array.isArray(raw.items)) return raw.items;
  return [];
}

/** True when shipping is off, or all required shipping fields are non-empty (line 2 optional). */
function isShippingAddressComplete({ enabled, firstName, lastName, streetLine1, city, state, zip }) {
  if (!enabled) return true;
  return [firstName, lastName, streetLine1, city, state, zip].every((value) => String(value || "").trim() !== "");
}

/** Shipping address payload for transaction POST when the Shipping checkbox is checked. */
function buildShippingAddressPayload({ enabled, firstName, lastName, streetLine1, streetLine2, city, state, zip }) {
  if (!enabled) return null;
  const payload = {
    first_name: String(firstName || "").trim(),
    last_name: String(lastName || "").trim(),
    address_line_1: String(streetLine1 || "").trim(),
    city: String(city || "").trim(),
    state: String(state || "").trim(),
    zip: String(zip || "").trim(),
  };
  const line2 = String(streetLine2 || "").trim();
  if (line2) payload.address_line_2 = line2;
  return payload;
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
 * Pretax line total, sales tax, and metadata for cart display / checkout.
 * Services: pretax = bs_cost × qty; tax when taxable and rate > 0.
 */
function lineMerchandiseAndTax(item) {
  const qty = parseInt(item.quantity, 10) || 1;
  if (item.itemType === "expertise") {
    return expertiseLineMerchandiseAndTax(item);
  }
  const pretax = roundMoney(parsePrice(item.bs_cost_with_extras || item.bs_cost) * qty);
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
  if (!items || items.length === 0) return false;
  // Expertise lines don't carry business_cc_fee_payer; AddToCartDetailsModal always quotes 3% to the buyer.
  if (items.some((it) => it && it.itemType === "expertise")) {
    return true;
  }
  const raw = items[0]?.business_cc_fee_payer ?? items[0]?.bs_cc_fee_payer;
  return canonicalBusinessCcFeePayer(raw) === "buyer";
}

/**
 * One entry per seller: merchandise, sales tax, buyer shipping, optional 3% card fee, Stripe total.
 */
function buildSellerCheckoutGroups(cartItems, resolveBusinessName) {
  if (!Array.isArray(cartItems)) return [];
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
    const shippingInfo = sumBuyerShippingCharges(items);
    const shippingSubtotal = roundMoney(shippingInfo.shippingSubtotal);
    const subtotalAfterTax = roundMoney(merchandiseSubtotal + salesTaxTotal);
    const subtotalWithShipping = roundMoney(subtotalAfterTax + shippingSubtotal);
    const buyerPaysCardFee = groupBuyerPaysCardFee(items);
    const processingFee = buyerPaysCardFee ? roundMoney(subtotalWithShipping * 0.03) : 0;
    const total = roundMoney(subtotalWithShipping + processingFee);
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
      shippingSubtotal,
      hasFixedShipping: shippingInfo.hasFixedShipping,
      hasActualShipping: shippingInfo.hasActualShipping,
      hasBuyerPaysShipping: items.some((it) => isCartItemBuyerPaysShipping(it)),
      subtotalAfterTax,
      subtotalWithShipping,
      buyerPaysCardFee,
      processingFee,
      total,
      displayName,
    };
  });
}

const ShoppingCartScreenContent = ({ route, navigation }) => {
  const { cartItems: initialCartItems, businessName, business_uid, recommender_profile_id, returnTo, searchState } = route.params || {};
  const [cartItems, setCartItems] = useState(Array.isArray(initialCartItems) ? initialCartItems : []);

  const handleReturnPress = () => {
    if (returnTo === "BusinessProfile") {
      const uid = business_uid && business_uid !== "all" ? business_uid : null;
      if (uid) {
        navigation.navigate("BusinessProfile", {
          business_uid: uid,
          ...(searchState ? { returnTo: "Search", searchState } : {}),
        });
        return;
      }
    }
    if (returnTo === "Search") {
      navigation.navigate("Search", {
        restoreState: Boolean(searchState),
        ...(searchState ? { searchState } : {}),
      });
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Search");
  };

  const returnButtonLabel = returnTo === "BusinessProfile" ? "Return to Business" : returnTo === "Search" ? "Return to Search" : "Go Back";

  const resolveItemBusinessName = (item) => {
    if (item.itemType === "expertise") {
      if (item.business_name && String(item.business_name).trim()) return String(item.business_name).trim();
      const p = item.profileData;
      const n = p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() : "";
      return n || null;
    }
    const fromItem = item.business_name && String(item.business_name).trim();
    if (fromItem) return fromItem;
    if (business_uid && business_uid !== "all" && item.business_uid === business_uid && businessName && !GENERIC_CART_TITLES.includes(String(businessName))) {
      return String(businessName).trim();
    }
    return null;
  };

  const showVendorHeader = Boolean(businessName && String(businessName).trim()) && business_uid && business_uid !== "all" && !GENERIC_CART_TITLES.includes(String(businessName));

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
  const [shippingEnabled, setShippingEnabled] = useState(false);
  const [shippingFirstName, setShippingFirstName] = useState("");
  const [shippingLastName, setShippingLastName] = useState("");
  const [shippingStreetLine1, setShippingStreetLine1] = useState("");
  const [shippingStreetLine2, setShippingStreetLine2] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingZip, setShippingZip] = useState("");
  const scrollViewRef = useRef(null);
  /** Y offset of refund policy block within ScrollView content (from onLayout). */
  const refundSectionScrollYRef = useRef(0);

  /** Web: one Stripe payment per seller; kept in ref + state so submit handler sees latest step. */
  const webCheckoutSessionRef = useRef(null);
  const [webCheckoutSession, setWebCheckoutSession] = useState(null); // { groups, index } | null

  useEffect(() => {
    webCheckoutSessionRef.current = webCheckoutSession;
  }, [webCheckoutSession]);

  useEffect(() => {
    const hasShippingItems = cartItems.some((it) => isCartItemShippingApplicable(it));
    const hasBuyerPays = cartItems.some((it) => isCartItemBuyerPaysShipping(it));
    if (!hasShippingItems && shippingEnabled) {
      setShippingEnabled(false);
      return;
    }
    // Buyer-pays shipping requires a shipping address — force Shipping on.
    if (hasBuyerPays && !shippingEnabled) {
      setShippingEnabled(true);
    }
  }, [cartItems, shippingEnabled]);

  /** Start at top of the list whenever this screen is opened so users review items first; refund scroll runs only from Proceed without acknowledgement. */
  useFocusEffect(
    useCallback(() => {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      });
    }, []),
  );

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

      await decrementStockForPurchasedItems();

      webCheckoutSessionRef.current = null;
      setWebCheckoutSession(null);

      try {
        const choicesRecord = {};
        cartItems.forEach((item) => {
          if (item.itemType === "expertise" && item.expertise_uid && item.cost) {
            choicesRecord[item.expertise_uid] = { offeringCostString: item.cost };
          } else {
            const enrichment = cartChoiceEnrichmentFromItem(item);
            if (enrichment) {
              choicesRecord[item.bs_uid] = enrichment;
            }
          }
        });
        if (Object.keys(choicesRecord).length > 0) {
          const existing = await AsyncStorage.getItem("receipt_choices_by_bs_uid");
          const existingParsed = existing ? JSON.parse(existing) : {};
          await AsyncStorage.setItem("receipt_choices_by_bs_uid", JSON.stringify({ ...existingParsed, ...choicesRecord }));
          console.log("Saved receipt choices:", JSON.stringify(choicesRecord));
        }
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

  const focusRefundPolicySection = () => {
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const scroll = scrollViewRef.current;
          if (!scroll) return;
          const y = refundSectionScrollYRef.current;
          if (y > 0) {
            scroll.scrollTo({ y: Math.max(0, y - 16), animated: true });
          } else {
            scroll.scrollToEnd({ animated: true });
          }
        }, 80);
      });
    });
  };

  const handleCheckout = async () => {
    console.log("Checkout button pressed");
    console.log("Platform:", Platform.OS);

    if (!stripeInitialized) {
      Alert.alert("Error", "Payment system is not ready. Please try again.");
      return;
    }

    if (cartItems.some((it) => isCartItemReturnable(it)) && !refundAcknowledged) {
      setRefundError(true);
      focusRefundPolicySection();
      return;
    }
    setRefundError(false);

    const shippingNeeded = cartItems.some((it) => isCartItemShippingApplicable(it));
    const buyerPaysShippingRequired = cartItems.some((it) => isCartItemBuyerPaysShipping(it));
    const shippingMustBeOn = shippingNeeded && (shippingEnabled || buyerPaysShippingRequired);
    if (
      shippingMustBeOn &&
      !isShippingAddressComplete({
        enabled: true,
        firstName: shippingFirstName,
        lastName: shippingLastName,
        streetLine1: shippingStreetLine1,
        city: shippingCity,
        state: shippingState,
        zip: shippingZip,
      })
    ) {
      if (buyerPaysShippingRequired && !shippingEnabled) {
        setShippingEnabled(true);
      }
      Alert.alert(
        "Shipping address required",
        buyerPaysShippingRequired
          ? "One or more items require buyer-paid shipping. Please complete First Name, Last Name, Street Address, City, State, and Zip before checkout."
          : "Please complete all required shipping fields before checkout.",
      );
      return;
    }

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

        const clientSecret = await createPaymentIntent(group.total, group.salesTaxTotal);
        const ok = await initializePaymentSheetForGroup(clientSecret, group.displayName);
        if (!ok) {
          throw new Error("Failed to initialize payment sheet");
        }

        const result = await presentPaymentSheet();
        if (result.error) {
          console.error("Payment error:", result.error);
          throw new Error(result.error.message || "Payment failed");
        }

        // Client secret is pi_xxx_secret_yyy — store only the PaymentIntent ID for refunds
        const paymentIntentId = String(clientSecret || "").split("_secret_")[0];
        if (!paymentIntentId) {
          throw new Error("Invalid payment intent. Please try again.");
        }
        await recordSingleBusinessTransaction(buyerUid, paymentIntentId, group, escrowBySeller[group.sellerId] !== false);
        completedGroups.push(group);
      }

      try {
        const choicesRecord = {};
        cartItems.forEach((item) => {
          if (item.itemType === "expertise" && item.expertise_uid && item.cost) {
            choicesRecord[item.expertise_uid] = { offeringCostString: item.cost };
          } else {
            const enrichment = cartChoiceEnrichmentFromItem(item);
            if (enrichment) {
              choicesRecord[item.bs_uid] = enrichment;
            }
          }
        });
        if (Object.keys(choicesRecord).length > 0) {
          const existing = await AsyncStorage.getItem("receipt_choices_by_bs_uid");
          const existingParsed = existing ? JSON.parse(existing) : {};
          await AsyncStorage.setItem("receipt_choices_by_bs_uid", JSON.stringify({ ...existingParsed, ...choicesRecord }));
          console.log("Saved receipt choices:", JSON.stringify(choicesRecord));
        }
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

        await decrementStockForPurchasedItems();
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
        const paidKeys = new Set(completedGroups.flatMap((g) => g.items.map((it) => (it.itemType === "expertise" ? `e:${it.expertise_uid}` : `s:${it.business_uid}:${it.bs_uid}`))));
        setCartItems((prev) => prev.filter((it) => !paidKeys.has(it.itemType === "expertise" ? `e:${it.expertise_uid}` : `s:${it.business_uid}:${it.bs_uid}`)));
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
    console.log("Initial cart items:", initialCartItems);

    // Native: mounts only after StripeNativeProvider loads the key; web loads key at checkout.
    setStripeInitialized(true);

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
    // setCartItems(initialCartItems);
    setCartItems(Array.isArray(initialCartItems) ? initialCartItems : []);
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
      console.error("Error loading Stripe public key:", error);
      Alert.alert("Error", "Failed to initialize payment system. Please try again.");
      throw error;
    }
  };

  const handleRemoveItem = async (index) => {
    try {
      const itemToRemove = cartItems[index];
      if (!itemToRemove) return;

      if (itemToRemove.itemType === "expertise") {
        await AsyncStorage.removeItem(itemToRemove.cart_key || `cart_expertise_${itemToRemove.expertise_uid}`);
      } else {
        const itemBusinessUid = itemToRemove.business_uid;
        const storedCartData = await AsyncStorage.getItem(`cart_${itemBusinessUid}`);
        let cartData = storedCartData ? JSON.parse(storedCartData) : { items: [] };
        cartData.items = cartData.items.filter((item) => item.bs_uid !== itemToRemove.bs_uid);
        if (cartData.items.length === 0) {
          await AsyncStorage.removeItem(`cart_${itemBusinessUid}`);
        } else {
          await AsyncStorage.setItem(`cart_${itemBusinessUid}`, JSON.stringify(cartData));
        }
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
      const item = newCartItems[index];
      const currentQuantity = item.quantity || 1;
      const newQuantity = Math.max(1, currentQuantity + change);

      const availableStock = item.itemType === "expertise" || item.bs_quantity != null ? getCartLineStockMax(item) : null;
      if (change > 0 && availableStock != null) {
        const maxQty = parseInt(availableStock, 10);
        if (!isNaN(maxQty) && newQuantity > maxQty) {
          Alert.alert("Stock limit", `Only ${maxQty} available for this item.`);
          return;
        }
      }

      if (newCartItems[index].itemType === "expertise") {
        newCartItems[index] = { ...newCartItems[index], quantity: newQuantity };
        setCartItems(newCartItems);
        const cartKey = newCartItems[index].cart_key || `cart_expertise_${newCartItems[index].expertise_uid}`;
        await AsyncStorage.setItem(cartKey, JSON.stringify(newCartItems[index]));
      } else {
        const itemUnitPrice = parsePrice(newCartItems[index].unitPrice ?? newCartItems[index].bs_cost_with_extras ?? newCartItems[index].bs_cost);
        newCartItems[index] = {
          ...newCartItems[index],
          quantity: newQuantity,
          totalPrice: (itemUnitPrice * newQuantity).toFixed(2),
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

  // Add this helper alongside the other handlers (e.g. after recordTransactions)
  const decrementStockForPurchasedItems = async () => {
    const eligibleItems = cartItems.filter((item) => {
      if (item.itemType === "expertise") return false;
      const qty = item.bs_quantity;
      if (!qty || String(qty).toLowerCase() === "unlimited") return false;
      return true;
    });

    const results = await Promise.allSettled(eligibleItems.map((item) => recordServicePurchase(item.bs_uid, item.quantity || 1)));

    // Update local cartItems state with new remaining quantities from backend response
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.itemType === "expertise") return item;
        const eligibleIndex = eligibleItems.findIndex((e) => e.bs_uid === item.bs_uid);
        if (eligibleIndex === -1) return item;

        const result = results[eligibleIndex];
        if (result.status === "fulfilled" && result.value?.success) {
          const remaining = result.value.remaining;
          return {
            ...item,
            bs_quantity: remaining === null ? "unlimited" : String(remaining),
          };
        }
        return item;
      }),
    );

    results.forEach((result, i) => {
      if (result.status === "rejected") {
        console.error(`Stock decrement failed for item index ${i}:`, result.reason);
      } else if (!result.value?.success) {
        console.warn(`Stock decrement returned failure for item index ${i}:`, result.value);
      }
    });
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

  const createPaymentIntent = async (paymentTotal, salesTaxTotal = 0) => {
    try {
      console.log("Creating payment intent...");
      const profile_uid = await AsyncStorage.getItem("profile_uid");
      console.log("User profile UID:", profile_uid);

      if (!profile_uid) {
        throw new Error("User profile not found");
      }

      const total = paymentTotal !== undefined && paymentTotal !== null ? Number(paymentTotal) : calculateTotal();
      if (!Number.isFinite(total) || total <= 0) {
        throw new Error("Invalid payment amount");
      }
      console.log("Creating payment intent for amount:", total);

      const requestBody = {
        customer_uid: profile_uid,
        business_code: "ECTEST",
        payment_summary: {
          tax: parseFloat(Number(salesTaxTotal).toFixed(2)),
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

      const merchandiseSubtotal = group.merchandiseSubtotal;
      const salesTaxTotal = group.salesTaxTotal;
      const processingFee = group.processingFee;
      const chargedTotal = group.total;

      const defaultRecommender = recommender_profile_id && recommender_profile_id !== "Charity" ? recommender_profile_id : buyerProfileId;

      const transactionInEscrow = escrowValue === true || escrowValue === 1 ? 1 : 0;

      // In recordSingleBusinessTransaction, update the items map:
      const items = group.items.map((item) => {
        const qty = parseInt(item.quantity, 10) || 1;
        const bountyType = item.itemType === "expertise" ? getOfferingBountyTypeForCheckout(item) : item.bs_bounty_type || "per_item";
        const bounty = item.itemType === "expertise" ? parseOfferingBountyAmount(item) : parsePrice(item.bs_bounty);
        const sellerBusinessId = item.business_uid || item.profile_uid;
        const { pretax, tax } = lineMerchandiseAndTax(item);
        return {
          business_id: sellerBusinessId,
          bs_uid: item.itemType === "expertise" ? item.expertise_uid : item.bs_uid,
          item_type: item.itemType === "expertise" ? "expertise" : "service",
          bounty,
          bounty_type: bountyType,
          quantity: qty,
          recommender_profile_id: item.bounty_recommender_profile_id || defaultRecommender,
          // Pass choices data so backend can store it on the transaction item
          choices_extra_cost: item.choicesExtraCost || 0,
          unit_price: item.unitPrice || parsePrice(item.bs_cost),
          selected_choices: item.selectedChoices || {},
          selected_choice_labels: item.selectedChoiceLabels || {},
          selected_choice_items: normalizeSelectedChoiceItemsForApi(item),
          special_instructions: item.specialInstructions || "",
        };
      });

      // total_costs = pretax merchandise only (matches "Merchandise subtotal" in fee dialog).
      // total_amount_paid = Stripe charged amount (merchandise + sales tax + card processing).
      // total_taxes / total_fees break out the tax and fee portions of the charge.
      const salesTaxRounded = parseFloat(Number(salesTaxTotal).toFixed(2));
      const merchandiseRounded = parseFloat(Number(merchandiseSubtotal).toFixed(2));
      const shippingRounded = parseFloat(Number(group.shippingSubtotal || 0).toFixed(2));
      const buyerPaysShippingRequired = group.items.some((it) => isCartItemBuyerPaysShipping(it));
      const shippingAddress = buildShippingAddressPayload({
        enabled: (shippingEnabled || buyerPaysShippingRequired) && cartItems.some((it) => isCartItemShippingApplicable(it)),
        firstName: shippingFirstName,
        lastName: shippingLastName,
        streetLine1: shippingStreetLine1,
        streetLine2: shippingStreetLine2,
        city: shippingCity,
        state: shippingState,
        zip: shippingZip,
      });
      const transactionData = {
        profile_id: buyerProfileId,
        business_id: group.sellerId,
        stripe_payment_intent: paymentIntent,
        total_amount_paid: parseFloat(Number(chargedTotal).toFixed(2)),
        total_costs: merchandiseRounded,
        total_taxes: salesTaxRounded,
        total_shipping: shippingRounded,
        total_fees: parseFloat(Number(processingFee).toFixed(2)),
        transaction_in_escrow: transactionInEscrow,
        items,
      };
      if (shippingAddress) {
        transactionData.shipping_address = shippingAddress;
      }
      if (group.hasActualShipping) {
        transactionData.shipping_actual_pending = 1;
        transactionData.shipping_note = "Seller will contact the buyer directly for actual shipping cost.";
      }

      console.log("[ShoppingCart] Transaction POST — each field before endpoint:");
      console.log({
        profile_id: transactionData.profile_id,
        business_id: transactionData.business_id,
        stripe_payment_intent: transactionData.stripe_payment_intent,
        total_amount_paid: transactionData.total_amount_paid,
        total_costs: transactionData.total_costs,
        total_taxes: transactionData.total_taxes,
        total_shipping: transactionData.total_shipping,
        total_fees: transactionData.total_fees,
        transaction_in_escrow: transactionData.transaction_in_escrow,
        items_count: Array.isArray(transactionData.items) ? transactionData.items.length : 0,
        items: transactionData.items,
      });

      console.log("Posting transaction for one seller (full JSON):", JSON.stringify(transactionData, null, 2));

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
  const hasExpertiseInCart = cartItems.some((it) => it.itemType === "expertise");
  const cartRequiresReturnAcknowledgement = cartItems.some((it) => isCartItemReturnable(it));
  const cartHasShippingApplicableItems = cartItems.some((it) => isCartItemShippingApplicable(it));
  const cartRequiresBuyerPaysShipping = cartItems.some((it) => isCartItemBuyerPaysShipping(it));
  const feeDialogFirstGroup = sellerGroupsPreview[0];
  const webStripeAmount = webCheckoutSession && webCheckoutSession.groups[webCheckoutSession.index] ? webCheckoutSession.groups[webCheckoutSession.index].total : 0;
  const webCheckoutPayeeDisplayName =
    (webCheckoutSession?.groups?.[webCheckoutSession.index]?.displayName && String(webCheckoutSession.groups[webCheckoutSession.index].displayName).trim()) ||
    (feeDialogFirstGroup?.displayName && String(feeDialogFirstGroup.displayName).trim()) ||
    null;
  const shippingEffectiveEnabled = cartHasShippingApplicableItems && (shippingEnabled || cartRequiresBuyerPaysShipping);
  const shippingAddressComplete = isShippingAddressComplete({
    enabled: shippingEffectiveEnabled,
    firstName: shippingFirstName,
    lastName: shippingLastName,
    streetLine1: shippingStreetLine1,
    city: shippingCity,
    state: shippingState,
    zip: shippingZip,
  });
  const checkoutBlockedByShipping = shippingEffectiveEnabled && !shippingAddressComplete;
  const checkoutDisabled = loading || checkoutBlockedByShipping;

  const content = (
    <View style={styles.container}>
      {/* Header */}
      <AppHeader title='Shopping Cart' backgroundColor='#9C45F7' darkModeBackgroundColor='#7B35C7' onBackPress={() => navigation.goBack()} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView ref={scrollViewRef} style={styles.scrollView} contentContainerStyle={styles.content}>
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
                const showLineBusiness = Boolean(lineBusiness) && (item.itemType === "expertise" || business_uid === "all" || !showVendorHeader);
                const productName = String(item.bs_service_name || "").trim();
                const itemTitle = item.itemType === "expertise" ? String(item.title || "Offering").trim() : productName || "Item";
                const breakdown = getCartLineChargeBreakdown(item);
                const bountyTotal = getCartLineBountyTotal(item);
                const remainingAddQty = getCartLineRemainingAddQuantity(item);
                return (
                  <View key={index} style={styles.cartItemContainer}>
                    <View style={styles.cartItemCard}>
                      <View style={styles.cartItemTopRow}>
                        <View style={styles.cartItemDetails}>
                          {showLineBusiness ? <Text style={styles.cartItemSeller}>{lineBusiness}</Text> : null}
                          <Text style={styles.cartItemTitle}>{itemTitle}</Text>
                          <CartItemCustomizationText item={item} />
                          <CartStockBadge item={item} />
                        </View>
                        <View style={styles.cartItemActions}>
                          <TouchableOpacity style={styles.cartItemRemoveButton} onPress={() => handleRemoveItem(index)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                            <Ionicons name='close' size={14} color='#fff' />
                          </TouchableOpacity>
                          <View style={styles.cartItemQtyPill}>
                            <TouchableOpacity style={styles.cartItemQtyButton} onPress={() => handleQuantityChange(index, -1)}>
                              <Ionicons name='remove' size={18} color='#9C45F7' />
                            </TouchableOpacity>
                            <Text style={styles.cartItemQtyValue}>{breakdown.qty}</Text>
                            <TouchableOpacity
                              style={styles.cartItemQtyButton}
                              onPress={() => handleQuantityChange(index, 1)}
                              disabled={remainingAddQty != null && remainingAddQty <= 0}
                            >
                              <Ionicons name='add' size={18} color='#9C45F7' />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>

                      <View style={styles.cartItemDivider} />

                      <View style={styles.cartBreakdownSection}>
                        <CartBreakdownRow
                          label={`Item (${breakdown.qty} × ${formatCartMoney(item, breakdown.unitPrice)})`}
                          value={formatCartMoney(item, breakdown.itemSubtotal)}
                        />
                        {breakdown.shippingApplicable ? (
                          <CartBreakdownRow label='Shipping' value={formatCartMoney(item, breakdown.shippingAmount)} />
                        ) : null}
                        {breakdown.buyerPaysCardFee ? (
                          <CartBreakdownRow label='Card processing fee' value={formatCartMoney(item, breakdown.processingFee)} />
                        ) : null}
                        {breakdown.taxable && breakdown.tax > 0 ? (
                          <CartBreakdownRow
                            label={breakdown.taxRateLabel ? `Tax (${breakdown.taxRateLabel})` : "Tax"}
                            value={formatCartMoney(item, breakdown.tax)}
                          />
                        ) : null}
                        {breakdown.shippingIsActual ? (
                          <Text style={styles.cartShippingActualNote}>Seller will contact the buyer directly for actual shipping cost.</Text>
                        ) : null}
                      </View>

                      <View style={styles.cartItemDivider} />

                      <View style={styles.cartChargeRow}>
                        <Text style={styles.cartChargeLabel}>You&apos;ll be charged</Text>
                        <Text style={styles.cartChargeValue}>{formatCartMoney(item, breakdown.totalCharge)}</Text>
                      </View>

                      {bountyTotal > 0 ? (
                        <Text style={styles.cartBountyDisclosure}>Seller-paid bounty of {formatCartMoney(item, bountyTotal)} is not part of your charge.</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
              {cartHasShippingApplicableItems ? (
                <View style={styles.shippingCard}>
                  <TouchableOpacity
                    style={styles.escrowRow}
                    onPress={() => {
                      if (cartRequiresBuyerPaysShipping) return;
                      setShippingEnabled((prev) => !prev);
                    }}
                    activeOpacity={cartRequiresBuyerPaysShipping ? 1 : 0.7}
                    disabled={cartRequiresBuyerPaysShipping}
                  >
                    <View style={[styles.checkbox, shippingEffectiveEnabled && styles.checkboxChecked]}>{shippingEffectiveEnabled && <Text style={styles.checkmark}>✓</Text>}</View>
                    <Text style={styles.escrowLabel}>Shipping{cartRequiresBuyerPaysShipping ? " (required — at least one item requires shipping)" : ""}</Text>
                  </TouchableOpacity>
                  {cartRequiresBuyerPaysShipping ? <Text style={styles.shippingRequiredNote}>Shipping address is required because one or more items use buyer-paid shipping.</Text> : null}
                  {shippingEffectiveEnabled ? (
                    <View style={styles.shippingFields}>
                      <Text style={styles.shippingFieldLabel}>First Name *</Text>
                      <TextInput style={styles.shippingInput} value={shippingFirstName} onChangeText={setShippingFirstName} placeholder='First Name' autoCapitalize='words' autoCorrect={false} />
                      <Text style={styles.shippingFieldLabel}>Last Name *</Text>
                      <TextInput style={styles.shippingInput} value={shippingLastName} onChangeText={setShippingLastName} placeholder='Last Name' autoCapitalize='words' autoCorrect={false} />
                      <Text style={styles.shippingFieldLabel}>Street Address *</Text>
                      <TextInput
                        style={styles.shippingInput}
                        value={shippingStreetLine1}
                        onChangeText={setShippingStreetLine1}
                        placeholder='Street Address Line 1'
                        autoCapitalize='words'
                        autoCorrect={false}
                      />
                      <TextInput
                        style={styles.shippingInput}
                        value={shippingStreetLine2}
                        onChangeText={setShippingStreetLine2}
                        placeholder='Street Address Line 2 (optional)'
                        autoCapitalize='words'
                        autoCorrect={false}
                      />
                      <View style={styles.shippingCityStateZipRow}>
                        <View style={styles.shippingCityField}>
                          <Text style={styles.shippingFieldLabel}>City *</Text>
                          <TextInput style={styles.shippingInput} value={shippingCity} onChangeText={setShippingCity} placeholder='City' autoCapitalize='words' autoCorrect={false} />
                        </View>
                        <View style={styles.shippingStateField}>
                          <Text style={styles.shippingFieldLabel}>State *</Text>
                          <TextInput style={styles.shippingInput} value={shippingState} onChangeText={setShippingState} placeholder='State' autoCapitalize='words' autoCorrect={false} />
                        </View>
                        <View style={styles.shippingZipField}>
                          <Text style={styles.shippingFieldLabel}>Zip *</Text>
                          <TextInput
                            style={[styles.shippingInput, styles.shippingInputLast]}
                            value={shippingZip}
                            onChangeText={setShippingZip}
                            placeholder='Zip'
                            keyboardType='number-pad'
                            autoCorrect={false}
                          />
                        </View>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.totalContainer}>
                <Text style={styles.multiSellerHint}>
                  {hasExpertiseInCart ? "Offering and expertise purchases include a 3% credit card processing fee in each seller total below (same as when you added them to the cart). " : null}
                  {multiSellerCheckout
                    ? `You will complete ${sellerGroupsPreview.length} separate payments (one per business). Sales tax is computed per item. For business services only, credit card processing (3%) applies when that business has “buyer pays” card fees.`
                    : hasExpertiseInCart
                      ? "Sales tax is computed per item when applicable (including taxable offerings). For business services only, credit card processing (3%) applies when the business has “buyer pays” card fees."
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
                    {g.hasFixedShipping ? (
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Shipping (buyer fixed)</Text>
                        <Text style={styles.totalValue}>${g.shippingSubtotal.toFixed(2)}</Text>
                      </View>
                    ) : null}
                    {g.hasActualShipping ? (
                      <View style={styles.shippingActualBlock}>
                        <View style={styles.totalRow}>
                          <Text style={styles.totalLabel}>Shipping (actual cost)</Text>
                          <Text style={styles.totalValue}>$0.00</Text>
                        </View>
                        <Text style={styles.shippingActualNote}>Seller will contact the buyer directly for actual shipping cost.</Text>
                      </View>
                    ) : null}
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Credit card processing (3%)</Text>
                      <Text style={styles.totalValue}>${g.processingFee.toFixed(2)}</Text>
                    </View>
                    {!g.buyerPaysCardFee ? <Text style={styles.cardFeeWaivedNote}>Business pays card fees — the processing line above is $0.00.</Text> : null}
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
                    <Text style={styles.grandTotalValue}>${sellerGroupsPreview.reduce((sum, g) => sum + g.total, 0).toFixed(2)}</Text>
                  </View>
                ) : null}
              </View>

              {cartRequiresReturnAcknowledgement ? (
                <View
                  collapsable={false}
                  style={styles.escrowSection}
                  onLayout={(e) => {
                    refundSectionScrollYRef.current = e.nativeEvent.layout.y;
                  }}
                >
                  <TouchableOpacity
                    style={styles.escrowRow}
                    onPress={() => {
                      setRefundAcknowledged(!refundAcknowledged);
                      setRefundError(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, refundAcknowledged && styles.checkboxChecked, refundError && { borderColor: "#FF3B30" }]}>
                      {refundAcknowledged && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.escrowLabel, { flex: 1 }, refundError && { color: "#FF3B30" }]}>
                      Return must be made in 5 days for a full refund, any returns past 5 days will result in a partial refund. Check the box to acknowledge.
                    </Text>
                  </TouchableOpacity>
                  {refundError && <Text style={{ color: "#FF3B30", fontSize: 13, marginTop: 6, marginLeft: 34 }}>You must acknowledge the return policy before checking out.</Text>}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        {cartItems.length > 0 && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.checkoutButton, checkoutDisabled && styles.checkoutButtonDisabled]}
              onPress={() => {
                console.log("Checkout button pressed - direct handler");
                handleCheckout();
              }}
              disabled={checkoutDisabled}
            >
              <Text style={[styles.checkoutButtonText, checkoutDisabled && styles.checkoutButtonTextDisabled]}>{loading ? "Processing..." : "Proceed to Checkout"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.returnButton} onPress={handleReturnPress} disabled={loading}>
              <Text style={styles.returnButtonText}>{returnButtonLabel}</Text>
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
            shippingSubtotal={feeDialogFirstGroup ? feeDialogFirstGroup.shippingSubtotal : undefined}
            hasActualShipping={feeDialogFirstGroup ? feeDialogFirstGroup.hasActualShipping : undefined}
            cardProcessingFee={feeDialogFirstGroup ? feeDialogFirstGroup.processingFee : undefined}
            buyerPaysCardFee={feeDialogFirstGroup ? feeDialogFirstGroup.buyerPaysCardFee : undefined}
            subtotal={feeDialogFirstGroup ? (feeDialogFirstGroup.subtotalWithShipping ?? feeDialogFirstGroup.subtotalAfterTax) : null}
            totalWithFee={feeDialogFirstGroup ? feeDialogFirstGroup.total : null}
            payeeBusinessName={feeDialogFirstGroup?.displayName ?? null}
          />
          {stripePromise && customerUid && (
            <StripePayment
              key={`stripe-pay-${webCheckoutSession?.index ?? 0}-${webStripeAmount}`}
              message='ECTEST'
              amount={webStripeAmount || 0}
              paidBy={customerUid}
              payeeBusinessName={webCheckoutPayeeDisplayName}
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

  return content;
};

export default function ShoppingCartScreen(props) {
  return (
    <StripeNativeProvider businessCode='ECTEST'>
      <ShoppingCartScreenContent {...props} />
    </StripeNativeProvider>
  );
}

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
    marginBottom: 16,
  },
  cartItemCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    padding: 16,
    ...(Platform.OS !== "web" && { elevation: 1 }),
  },
  cartItemTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cartItemDetails: {
    flex: 1,
    paddingRight: 12,
  },
  cartItemSeller: {
    fontSize: 13,
    color: "#999",
    marginBottom: 4,
  },
  cartItemTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
    marginBottom: 6,
  },
  cartItemCustomization: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 6,
  },
  cartItemCustomizationNote: {
    fontStyle: "italic",
  },
  cartItemActions: {
    alignItems: "flex-end",
    gap: 10,
  },
  cartItemRemoveButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  cartItemQtyPill: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 999,
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  cartItemQtyButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  cartItemQtyValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    minWidth: 24,
    textAlign: "center",
    marginHorizontal: 2,
  },
  cartItemDivider: {
    height: 1,
    backgroundColor: "#ECECEC",
    marginVertical: 14,
  },
  cartBreakdownSection: {
    gap: 8,
  },
  cartBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cartBreakdownLabel: {
    flex: 1,
    fontSize: 14,
    color: "#666",
    marginRight: 12,
  },
  cartBreakdownValue: {
    fontSize: 14,
    color: "#444",
    fontWeight: "500",
  },
  cartShippingActualNote: {
    fontSize: 11,
    color: "#888",
    fontStyle: "italic",
    marginTop: 2,
  },
  cartChargeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cartChargeLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },
  cartChargeValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#9C45F7",
  },
  cartBountyDisclosure: {
    fontSize: 12,
    color: "#999",
    marginTop: 10,
    lineHeight: 17,
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
  checkoutButtonDisabled: {
    backgroundColor: "#B8B8B8",
    opacity: 1,
  },
  checkoutButtonTextDisabled: {
    color: "#F5F5F5",
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
  shippingCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  shippingRequiredNote: {
    fontSize: 12,
    color: "#666",
    marginTop: 6,
    marginBottom: 4,
    marginLeft: 28,
  },
  shippingActualBlock: {
    marginBottom: 2,
  },
  shippingActualNote: {
    fontSize: 11,
    color: "#666",
    fontStyle: "italic",
    marginBottom: 6,
  },
  shippingFields: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
  shippingFieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  shippingInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    width: "100%",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    fontSize: 16,
    color: "#333",
    ...(Platform.OS === "web" && {
      outlineStyle: "none",
    }),
  },
  shippingInputLast: {
    marginBottom: 0,
  },
  shippingCityStateZipRow: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
  },
  shippingCityField: {
    flex: 2,
  },
  shippingStateField: {
    flex: 1,
  },
  shippingZipField: {
    flex: 1.2,
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
    fontSize: 17,
    fontWeight: "700",
    color: "#9C45F7",
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
  orderSummaryBase: {
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
    marginBottom: 4,
  },
  orderSummaryChoice: {
    fontSize: 14,
    color: "#444",
    lineHeight: 20,
  },
  orderSummaryNote: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
    lineHeight: 20,
    marginTop: 4,
  },
  lineTaxBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  lineTaxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  lineTaxMetaLeft: {
    flex: 1,
    flexShrink: 1,
    fontSize: 12,
    color: "#555",
    lineHeight: 17,
    marginRight: 10,
  },
  lineTaxAmount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    lineHeight: 17,
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
    fontSize: 12,
    lineHeight: 17,
    color: "#888",
    fontStyle: "italic",
  },
  bountyNoteValue: {
    fontSize: 12,
    lineHeight: 17,
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
