import React, { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { fetchStripePublishableKey } from "../utils/stripePublishableKey";

let StripeProvider = null;
const isWeb = typeof window !== "undefined" && typeof document !== "undefined";
if (!isWeb) {
  try {
    StripeProvider = require("@stripe/stripe-react-native").StripeProvider;
  } catch (e) {
    console.warn("StripeNativeProvider: Stripe not available:", e.message);
  }
}

/**
 * Loads publishable key from backend and wraps children in StripeProvider on native.
 * Web passes children through unchanged (web uses @stripe/stripe-js separately).
 */
export default function StripeNativeProvider({ children, businessCode = "ECTEST" }) {
  const [publishableKey, setPublishableKey] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isWeb || !StripeProvider) return;

    let cancelled = false;
    fetchStripePublishableKey(businessCode)
      .then((key) => {
        if (!cancelled) setPublishableKey(key);
      })
      .catch((err) => {
        console.error("StripeNativeProvider: failed to load publishable key:", err);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [businessCode]);

  if (isWeb || !StripeProvider) {
    return children;
  }

  if (failed) {
    return children;
  }

  if (!publishableKey) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#9C45F7" />
      </View>
    );
  }

  return <StripeProvider publishableKey={publishableKey}>{children}</StripeProvider>;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
});
