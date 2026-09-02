import { GET_STRIPE_PUBLIC_KEY_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "./httpMiddleware";

/** Default IO-Payments business_code for checkout (dev → ECTEST, release → EC). */
export function defaultStripeBusinessCode() {
  return __DEV__ ? "ECTEST" : "EC";
}

/** Max length for transaction_buyer_note (matches BE column). */
export const TRANSACTION_BUYER_NOTE_MAX_LENGTH = 500;

/**
 * Buyer checkout note selects which Stripe account to charge (IO-Payments business_code).
 * Only the exact note "ECTEST" (all caps) selects the test account; anything else → EC (live).
 */
export function resolveCheckoutBusinessCode(buyerNote) {
  const n = String(buyerNote ?? "").trim();
  if (n === "ECTEST") return "ECTEST";
  return "EC";
}

/** Trim and cap buyer note before sending to APIs. */
export function normalizeTransactionBuyerNote(buyerNote) {
  return String(buyerNote ?? "")
    .trim()
    .slice(0, TRANSACTION_BUYER_NOTE_MAX_LENGTH);
}

/**
 * Normalize business_code for stripe_key URL path and createPaymentIntent / createRefund.
 * EC and ECTEST use Every-Circle Stripe keys; PM / PMTEST remain for legacy refunds if needed.
 */
export function stripeEnvironmentForBusinessCode(businessCode) {
  const n = String(businessCode ?? defaultStripeBusinessCode())
    .trim()
    .toUpperCase();
  if (n === "ECTEST" || n === "EC" || n === "PMTEST" || n === "PM") return n;
  return defaultStripeBusinessCode();
}

/**
 * Fetch Stripe publishable key from backend (no keys stored in the app bundle).
 * @param {string} businessCode - e.g. ECTEST, EC, PMTEST, PM
 * @returns {Promise<string>}
 */
export async function fetchStripePublishableKey(businessCode) {
  const environment = stripeEnvironmentForBusinessCode(businessCode);
  const url = `${GET_STRIPE_PUBLIC_KEY_ENDPOINT}/${environment}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Stripe key: ${response.statusText}`);
  }

  const responseData = await response.json();
  const publicKey = responseData.publicKey || responseData.PUBLISHABLE_KEY;

  if (!publicKey || typeof publicKey !== "string") {
    throw new Error("Public key not found in response. Expected 'publicKey' or 'PUBLISHABLE_KEY'");
  }

  return publicKey;
}
