import { axiosMiddleware as axios } from "./httpMiddleware";
import { BUSINESS_SERVICE_PURCHASE_ENDPOINT, BUSINESS_SERVICE_RESTOCK_ENDPOINT } from "../apiConfig";

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

/**
 * Increment limited inventory when a seller restocks returned/cancelled units.
 *
 * @param {string} bs_uid
 * @param {number} quantity
 * @param {{ sellerId?: string, trrUid?: string, orderUid?: string }} [ctx]
 * @returns {{ success: boolean, remaining: number|null, message?: string }}
 */
export const recordServiceRestock = async (bs_uid, quantity = 1, ctx = {}) => {
  const safeQty = Math.max(0, parseInt(quantity, 10) || 0);
  if (!bs_uid || safeQty <= 0) {
    return { success: false, remaining: null, message: "Invalid restock quantity" };
  }
  try {
    const body = { bs_uid, quantity: safeQty };
    const sellerId = String(ctx.sellerId || "").trim();
    const trrUid = String(ctx.trrUid || "").trim();
    const orderUid = String(ctx.orderUid || "").trim();
    if (sellerId) body.seller_id = sellerId;
    if (trrUid) body.trr_uid = trrUid;
    if (orderUid) body.order_uid = orderUid;

    const res = await axios.post(BUSINESS_SERVICE_RESTOCK_ENDPOINT, body, { headers: { "Content-Type": "application/json" } });
    const data = res.data?.data && typeof res.data.data === "object" ? res.data.data : res.data || {};
    const remaining = data.remaining ?? data.bs_available_quantity ?? data.available_quantity ?? null;
    return {
      success: true,
      remaining: remaining == null ? null : parseInt(remaining, 10),
      message: data.message || null,
    };
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Restock failed";
    console.error(`recordServiceRestock failed for ${bs_uid}:`, message);
    return { success: false, remaining: null, message };
  }
};

/**
 * Restock multiple products after a return/cancel confirm.
 * @param {Array<{ bs_uid: string, quantity: number }>} items
 * @param {{ sellerId?: string, trrUid?: string, orderUid?: string }} [ctx]
 */
export const restockReturnedItems = async (items, ctx = {}) => {
  const payload = (items || []).filter((item) => item && String(item.bs_uid || "").trim() && (parseInt(item.quantity, 10) || 0) > 0);
  if (!payload.length) return { ok: true, results: [], failures: [] };

  const results = [];
  const failures = [];
  for (const item of payload) {
    const bs_uid = String(item.bs_uid).trim();
    const quantity = Math.max(1, parseInt(item.quantity, 10) || 0);
    const outcome = await recordServiceRestock(bs_uid, quantity, ctx);
    if (outcome.success) {
      results.push({ bs_uid, quantity, remaining: outcome.remaining });
    } else {
      failures.push({ bs_uid, quantity, message: outcome.message || "Restock failed" });
    }
  }
  return { ok: failures.length === 0, results, failures, partial: results.length > 0 && failures.length > 0 };
};
