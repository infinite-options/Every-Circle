// StripePaymentWeb.js - Web-compatible Stripe payment component
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Platform } from "react-native";
import { useElements, useStripe, CardElement, Elements } from "@stripe/react-stripe-js";
import { Ionicons } from "@expo/vector-icons";
import { useDarkMode } from "../contexts/DarkModeContext";

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
      // Step 1: Create payment intent on backend
      const paymentData = {
        customer_uid: paidBy,
        business_code: message === "PMTEST" ? message : "PM",
        payment_summary: {
          total: parseFloat(amount),
        },
      };

      console.log("StripePaymentWeb - Creating payment intent with data:", paymentData);
      const createPaymentIntentURL = "https://huo8rhh76i.execute-api.us-west-1.amazonaws.com/dev/api/v2/createPaymentIntent";

      const response = await fetch(createPaymentIntentURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        throw new Error(`Failed to create payment intent: ${response.statusText}`);
      }

      // The API returns the client secret as plain text (not JSON)
      let clientSecret = await response.text();
      console.log("StripePaymentWeb - Received client secret");

      // Handle case where response might be JSON wrapped
      if (clientSecret.startsWith("{") || clientSecret.startsWith("[")) {
        try {
          const jsonData = JSON.parse(clientSecret);
          clientSecret = jsonData.clientSecret || jsonData;
        } catch (e) {
          // If parsing fails, use the text as-is
        }
      }

      if (!clientSecret || (!clientSecret.startsWith("pi_") && !clientSecret.includes("_secret_"))) {
        throw new Error("Invalid client secret received from server");
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
      const confirmedCardPayment = await stripe.confirmCardPayment(clientSecret, {
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

