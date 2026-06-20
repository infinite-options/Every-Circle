import { GET_STRIPE_PUBLIC_KEY_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "./httpMiddleware";

/** Map app business code to backend Stripe environment key segment. */
export function stripeEnvironmentForBusinessCode(businessCode = "ECTEST") {
  if (businessCode === "ECTEST") return "PMTEST";
  if (businessCode === "EC") return "PM";
  if (businessCode === "PMTEST" || businessCode === "PM") return businessCode;
  return "PMTEST";
}

/**
 * Fetch Stripe publishable key from backend (no keys stored in the app bundle).
 * @param {string} businessCode - e.g. ECTEST, EC, PMTEST, PM
 * @returns {Promise<string>}
 */
export async function fetchStripePublishableKey(businessCode = "ECTEST") {
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
