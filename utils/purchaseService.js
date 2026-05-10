import axios from "axios";
import { BUSINESS_SERVICE_PURCHASE_ENDPOINT } from "../apiConfig";

/**
 * Decrement stock for a service after a confirmed purchase.
 * Called after Stripe payment succeeds — never blocks the success flow.
 *
 * @param {string} bs_uid      - Service UID
 * @param {number} quantity    - Units purchased (default 1)
 * @returns {{ success: boolean, remaining: number|null, outOfStock: boolean }}
 */
export const recordServicePurchase = async (bs_uid, quantity = 1) => {
  try {
    const res = await axios.post(
      BUSINESS_SERVICE_PURCHASE_ENDPOINT,
      { bs_uid, quantity },
      { headers: { "Content-Type": "application/json" } }
    );

    const data = res.data;

    if (data.code === 409 || res.status === 409) {
      console.warn(`Stock conflict for ${bs_uid}: item may now be out of stock`);
      return { success: false, remaining: 0, outOfStock: true };
    }

    return {
      success: true,
      remaining: data.remaining,   // null = unlimited, number = units left
      outOfStock: data.remaining === 0,
    };
  } catch (error) {
    if (error.response?.status === 409) {
      console.warn(`Stock conflict (409) for ${bs_uid}`);
      return { success: false, remaining: 0, outOfStock: true };
    }
    // Don't alert — payment succeeded; stock sync failure is a backend concern
    console.error(`recordServicePurchase failed for ${bs_uid}:`, error.message);
    return { success: false, remaining: null, outOfStock: false };
  }
};