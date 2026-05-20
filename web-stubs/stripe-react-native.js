// Stub for @stripe/stripe-react-native on web (native-only SDK).
import React from "react";

export function StripeProvider({ children }) {
  return children;
}

export function useStripe() {
  return {
    initPaymentSheet: async () => ({ error: null }),
    presentPaymentSheet: async () => ({
      error: { message: "Stripe native SDK is not available on web" },
    }),
  };
}
