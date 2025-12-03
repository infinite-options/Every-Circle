import React, { useState } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStripe, useElements, CardElement } from "@stripe/react-stripe-js";
import { CREATE_PAYMENT_INTENT_ENDPOINT } from "../apiConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";

const StripePaymentModal = ({ visible, onClose, amount, onSubmit, businessCode = "ECTEST" }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const stripe = useStripe();
  const elements = useElements();

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const submitPayment = async () => {
    if (!stripe || !elements) {
      Alert.alert("Error", "Stripe is not initialized. Please try again.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log("StripePaymentModal - Starting payment process");

      // Step 1: Get customer UID
      const customerUid = await AsyncStorage.getItem("profile_uid");
      if (!customerUid) {
        throw new Error("User ID not found");
      }

      // Step 2: Create payment intent on backend
      const paymentData = {
        customer_uid: customerUid,
        business_code: businessCode,
        payment_summary: {
          total: parseFloat(amount).toFixed(2),
        },
      };

      console.log("Creating payment intent with data:", paymentData);

      const response = await fetch(CREATE_PAYMENT_INTENT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create payment intent: ${response.statusText} - ${errorText}`);
      }

      // Handle both JSON and plain text responses
      const responseText = await response.text();
      let clientSecret;
      
      try {
        // Try parsing as JSON first
        const jsonResponse = JSON.parse(responseText);
        clientSecret = jsonResponse.client_secret || jsonResponse.clientSecret || jsonResponse;
      } catch (e) {
        // If not JSON, treat as plain text
        clientSecret = responseText;
      }

      if (!clientSecret || typeof clientSecret !== "string") {
        throw new Error("Invalid payment intent response format");
      }

      console.log("Payment intent created, client secret received");

      // Step 3: Get card element and create payment method
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Card element not found");
      }

      console.log("Creating payment method from card element");
      const { paymentMethod, error: pmError } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
        billing_details: {
          name: "Customer", // Could be enhanced with actual customer name
        },
      });

      if (pmError) {
        throw new Error(pmError.message || "Failed to create payment method");
      }

      if (!paymentMethod) {
        throw new Error("Payment method creation returned no result");
      }

      const paymentMethodID = paymentMethod.id;
      console.log("Payment method created:", paymentMethodID);

      // Step 4: Confirm the payment
      console.log("Confirming payment with client secret");
      const { paymentIntent, error: confirmError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: paymentMethodID,
      });

      if (confirmError) {
        throw new Error(confirmError.message || "Payment confirmation failed");
      }

      if (!paymentIntent) {
        throw new Error("Payment confirmation returned no result");
      }

      const paymentIntentID = paymentIntent.id;
      console.log("Payment confirmed successfully:", paymentIntentID);

      // Step 5: Call submit callback with payment details
      setLoading(false);
      await onSubmit(paymentIntentID, paymentMethodID);
      handleClose();
    } catch (err) {
      console.error("Payment error:", err);
      setError(err.message || "Payment failed. Please try again.");
      setLoading(false);
    }
  };

  // Web-specific styles for CardElement container
  const cardElementStyle = Platform.OS === "web" ? {
    base: {
      fontSize: "16px",
      color: "#424770",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      "::placeholder": {
        color: "#aab7c4",
      },
    },
    invalid: {
      color: "#9e2146",
    },
  } : {};

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>

          {/* Title */}
          <Text style={styles.modalTitle}>Enter Payment Details</Text>
          <Text style={styles.modalSubtitle}>Amount: ${parseFloat(amount).toFixed(2)}</Text>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Card Element Container */}
          <View style={styles.cardElementContainer}>
            {Platform.OS === "web" ? (
              <CardElement
                options={{
                  style: cardElementStyle,
                }}
              />
            ) : (
              <Text style={styles.notSupportedText}>
                Card input is only available on web. Please use the mobile app for payments.
              </Text>
            )}
          </View>

          {/* Loading Indicator */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#9C45F7" />
              <Text style={styles.loadingText}>Processing payment...</Text>
            </View>
          )}

          {/* Pay Button */}
          <TouchableOpacity
            style={[styles.payButton, loading && styles.payButtonDisabled]}
            onPress={submitPayment}
            disabled={loading || Platform.OS !== "web"}
          >
            <Text style={styles.payButtonText}>{loading ? "Processing..." : "Pay Now"}</Text>
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity style={styles.cancelButton} onPress={handleClose} disabled={loading}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    }),
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    width: Platform.OS === "web" ? 500 : "90%",
    maxWidth: 500,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 18,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
  },
  errorContainer: {
    backgroundColor: "#fee",
    borderColor: "#fcc",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#c33",
    fontSize: 14,
    textAlign: "center",
  },
  cardElementContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    minHeight: 50,
    ...(Platform.OS === "web" && {
      padding: 16,
    }),
  },
  notSupportedText: {
    color: "#666",
    fontSize: 14,
    textAlign: "center",
    padding: 20,
  },
  loadingContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  payButton: {
    backgroundColor: "#9C45F7",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelButton: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "500",
  },
});

export default StripePaymentModal;

