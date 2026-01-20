// StripePaymentWeb.js - Web-compatible Stripe payment component
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Platform } from "react-native";
import { useElements, useStripe, CardElement, Elements } from "@stripe/react-stripe-js";
import { Ionicons } from "@expo/vector-icons";
import { useDarkMode } from "../contexts/DarkModeContext";
import { CREATE_PAYMENT_INTENT_ENDPOINT } from "../apiConfig";

const StripePaymentWebContent = ({ message, amount, paidBy, show, setShow, submit, onError }) => {
  const { darkMode } = useDarkMode();
  const [showSpinner, setShowSpinner] = useState(false);
  const elements = useElements();
  const stripe = useStripe();

  const handleClose = () => {
    setShow(false);
  };

  const submitPayment = async () => {
    console.log("StripePaymentWeb - Starting payment submission");
    setShowSpinner(true);

    try {
      // Check if Stripe is ready
      if (!stripe) {
        throw new Error("Stripe is not initialized. Please wait and try again.");
      }

      console.log("StripePaymentWeb - Stripe object:", {
        isReady: !!stripe,
        hasConfirmCardPayment: typeof stripe.confirmCardPayment === "function",
      });

      // Step 1: Create payment intent on backend
      // Map business code: ECTEST → PMTEST, EC → PM (matching ShoppingCartScreen logic)
      let businessCode = "PMTEST"; // default
      if (message === "ECTEST") {
        businessCode = "PMTEST";
      } else if (message === "EC") {
        businessCode = "PM";
      } else if (message === "PMTEST" || message === "PM") {
        businessCode = message;
      }
      
      const paymentData = {
        customer_uid: paidBy,
        business_code: businessCode,
        payment_summary: {
          total: parseFloat(amount),
        },
      };
      
      console.log("StripePaymentWeb - Business code mapping:", { message, businessCode });

      console.log("StripePaymentWeb - Creating payment intent with data:", paymentData);
      console.log("StripePaymentWeb - Using endpoint:", CREATE_PAYMENT_INTENT_ENDPOINT);

      const response = await fetch(CREATE_PAYMENT_INTENT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        throw new Error(`Failed to create payment intent: ${response.statusText}`);
      }

      // The API returns the client secret as plain text (not JSON)
      let clientSecret = await response.text();
      console.log("StripePaymentWeb - Received client secret (raw):", JSON.stringify(clientSecret));

      // Handle case where response might be JSON wrapped
      if (clientSecret.startsWith("{") || clientSecret.startsWith("[")) {
        try {
          const jsonData = JSON.parse(clientSecret);
          clientSecret = jsonData.clientSecret || jsonData;
        } catch (e) {
          // If parsing fails, use the text as-is
        }
      }

      // Clean the client secret: trim whitespace and remove quotes if present
      if (typeof clientSecret === "string") {
        clientSecret = clientSecret.trim();
        // Remove surrounding quotes if present
        if ((clientSecret.startsWith('"') && clientSecret.endsWith('"')) || 
            (clientSecret.startsWith("'") && clientSecret.endsWith("'"))) {
          clientSecret = clientSecret.slice(1, -1);
        }
      }

      console.log("StripePaymentWeb - Cleaned client secret:", JSON.stringify(clientSecret));
      console.log("StripePaymentWeb - Client secret length:", clientSecret?.length);
      console.log("StripePaymentWeb - Client secret format check:", {
        startsWithPi: clientSecret?.startsWith("pi_"),
        containsSecret: clientSecret?.includes("_secret_"),
        matchesPattern: /^pi_[a-zA-Z0-9]+_secret_[a-zA-Z0-9]+$/.test(clientSecret)
      });

      if (!clientSecret || typeof clientSecret !== "string") {
        throw new Error("Invalid client secret: not a string");
      }

      if (!clientSecret.startsWith("pi_") || !clientSecret.includes("_secret_")) {
        throw new Error(`Invalid client secret format. Expected format: pi_xxx_secret_xxx. Got: ${clientSecret.substring(0, 50)}...`);
      }

      // Step 2: Get card element and create payment method
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Card element not found");
      }

      console.log("StripePaymentWeb - Creating payment method");
      const stripeResponse = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
        billing_details: {
          name: "Customer Name", // Could be enhanced to get actual customer name
        },
      });

      if (stripeResponse.error) {
        throw new Error(stripeResponse.error.message);
      }

      const paymentMethodID = stripeResponse.paymentMethod.id;
      console.log("StripePaymentWeb - Payment method created:", paymentMethodID);

      // Step 3: Confirm the payment
      console.log("StripePaymentWeb - Confirming payment");
      console.log("StripePaymentWeb - Client secret (first 30 chars):", clientSecret.substring(0, 30));
      console.log("StripePaymentWeb - Client secret (last 20 chars):", clientSecret.substring(clientSecret.length - 20));
      console.log("StripePaymentWeb - Client secret length:", clientSecret.length);
      console.log("StripePaymentWeb - Payment method ID:", paymentMethodID);
      console.log("StripePaymentWeb - Stripe object type:", typeof stripe);
      console.log("StripePaymentWeb - Stripe has confirmCardPayment:", typeof stripe?.confirmCardPayment === "function");
      
      // Validate client secret one more time before passing to Stripe
      // Stripe client secrets have format: pi_xxx_secret_xxx (where xxx can contain underscores)
      if (!clientSecret || typeof clientSecret !== "string") {
        throw new Error(`Invalid client secret: not a string`);
      }
      
      if (!clientSecret.startsWith("pi_") || !clientSecret.includes("_secret_")) {
        throw new Error(`Invalid client secret format. Expected: pi_xxx_secret_xxx. Got: ${clientSecret.substring(0, 50)}`);
      }

      // Ensure client secret doesn't have any hidden characters
      const cleanClientSecret = clientSecret.trim().replace(/[\r\n\t]/g, "");
      console.log("StripePaymentWeb - Cleaned client secret length:", cleanClientSecret.length);
      console.log("StripePaymentWeb - Client secrets match:", clientSecret === cleanClientSecret);

      const confirmedCardPayment = await stripe.confirmCardPayment(cleanClientSecret, {
        payment_method: paymentMethodID,
        setup_future_usage: "off_session",
      });

      if (confirmedCardPayment.error) {
        throw new Error(confirmedCardPayment.error.message);
      }

      const paymentIntentID = confirmedCardPayment.paymentIntent.id;
      console.log("StripePaymentWeb - Payment confirmed, payment intent ID:", paymentIntentID);

      // Step 4: Call submit callback with payment details
      await submit(paymentIntentID, paymentMethodID);
      setShowSpinner(false);
      setShow(false);
    } catch (err) {
      console.error("StripePaymentWeb - Payment error:", err);
      setShowSpinner(false);
      if (onError) {
        onError(err);
      } else {
        // Fallback error handling
        alert(`Payment failed: ${err.message}`);
      }
    }
  };

  if (!show) return null;

  return (
    <Modal animationType='slide' transparent={true} visible={show} onRequestClose={handleClose}>
      <View style={[styles.modalOverlay, darkMode && styles.darkModalOverlay]}>
        <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, darkMode && styles.darkModalTitle]}>Payment</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name='close' size={24} color={darkMode ? "#fff" : "#333"} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.amountText, darkMode && styles.darkAmountText]}>Amount: ${parseFloat(amount).toFixed(2)}</Text>

          <View style={[styles.cardElementContainer, darkMode && styles.darkCardElementContainer]}>
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: "16px",
                    color: darkMode ? "#ffffff" : "#424770",
                    "::placeholder": {
                      color: "#aab7c4",
                    },
                  },
                  invalid: {
                    color: "#9e2146",
                  },
                },
              }}
            />
          </View>

          {showSpinner && (
            <View style={styles.spinnerContainer}>
              <ActivityIndicator size='large' color='#9C45F7' />
              <Text style={[styles.spinnerText, darkMode && styles.darkSpinnerText]}>Processing...</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.payButton, darkMode && styles.darkPayButton, showSpinner && styles.disabledButton]}
            onPress={submitPayment}
            disabled={showSpinner || !stripe}
          >
            <Text style={styles.payButtonText}>Pay Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Wrapper component that provides Elements context
const StripePaymentWeb = ({ message, amount, paidBy, show, setShow, submit, onError, stripePromise }) => {
  if (!stripePromise) {
    return null;
  }

  return (
    <Elements stripe={stripePromise}>
      <StripePaymentWebContent message={message} amount={amount} paidBy={paidBy} show={show} setShow={setShow} submit={submit} onError={onError} />
    </Elements>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    ...(Platform.OS === "web" && {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
    }),
  },
  darkModalOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "90%",
    maxWidth: 500,
    ...(Platform.OS === "web" && {
      position: "relative",
      zIndex: 10000,
    }),
  },
  darkModalContent: {
    backgroundColor: "#2d2d2d",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  darkModalTitle: {
    color: "#fff",
  },
  closeButton: {
    padding: 4,
  },
  amountText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 20,
    textAlign: "center",
  },
  darkAmountText: {
    color: "#fff",
  },
  cardElementContainer: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 20,
    backgroundColor: "#fff",
    minHeight: 50,
  },
  darkCardElementContainer: {
    borderColor: "#555",
    backgroundColor: "#404040",
  },
  spinnerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  spinnerText: {
    marginLeft: 10,
    fontSize: 16,
    color: "#333",
  },
  darkSpinnerText: {
    color: "#fff",
  },
  payButton: {
    backgroundColor: "#9C45F7",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  darkPayButton: {
    backgroundColor: "#7B35C7",
  },
  disabledButton: {
    opacity: 0.6,
  },
  payButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default StripePaymentWeb;

