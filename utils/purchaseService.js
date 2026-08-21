import { axiosMiddleware as axios } from "./httpMiddleware";
import { BUSINESS_SERVICE_PURCHASE_ENDPOINT, BUSINESS_SERVICE_RESTOCK_ENDPOINT, PROFILE_EXPERTISE_RESTOCK_ENDPOINT } from "../apiConfig";

/**
 * @deprecated Inventory is decremented in POST /api/v1/transactions. Do not call after checkout.
 * Legacy fallback only — pass transaction_uid for idempotent replay.
 */
export const recordServicePurchase = async (bs_uid, quantity = 1, transaction_uid = null) => {
  try {
    const body = { bs_uid, quantity };
    const txnUid = transaction_uid != null ? String(transaction_uid).trim() : "";
    if (txnUid) body.transaction_uid = txnUid;

    const res = await axios.post(
      BUSINESS_SERVICE_PURCHASE_ENDPOINT,
      body,
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
  const sellerId = String(ctx.sellerId || "").trim();
  if (!bs_uid || safeQty <= 0) {
    return { success: false, remaining: null, message: "Invalid restock quantity" };
  }
  if (!sellerId) {
    return { success: false, remaining: null, message: "Missing seller_id for restock" };
  }
  try {
    const body = { bs_uid, quantity: safeQty, seller_id: sellerId };
    const trrUid = String(ctx.trrUid || "").trim();
    const orderUid = String(ctx.orderUid || "").trim();
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

/** Sum quantities when hybrid return/cancel splits map to the same product uid. */
export function consolidateRestockItemsByProduct(items) {
  const byKey = new Map();
  for (const item of items || []) {
    if (!item || typeof item !== "object") continue;
    const profileExpertiseUid = String(item.profile_expertise_uid || "").trim();
    const bsUid = String(item.bs_uid || "").trim();
    const key = profileExpertiseUid ? `offering:${profileExpertiseUid}` : bsUid ? `business:${bsUid}` : "";
    if (!key) continue;
    const quantity = Math.max(0, parseInt(item.quantity, 10) || 0);
    if (quantity <= 0) continue;
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      byKey.set(key, {
        ...(profileExpertiseUid ? { profile_expertise_uid: profileExpertiseUid } : { bs_uid: bsUid }),
        quantity,
        ...(item.kind ? { kind: item.kind } : {}),
      });
    }
  }
  return [...byKey.values()];
}

/**
 * Restock multiple products after a return/cancel confirm.
 * @param {Array<{ bs_uid: string, quantity: number }>} items
 * @param {{ sellerId?: string, trrUid?: string, orderUid?: string }} [ctx]
 */
export const restockReturnedItems = async (items, ctx = {}) => {
  const payload = consolidateRestockItemsByProduct(items).filter((item) => item.bs_uid && (parseInt(item.quantity, 10) || 0) > 0);
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

/**
 * Increment limited offering inventory when a seller restocks returned/cancelled units.
 *
 * @param {string} profile_expertise_uid
 * @param {number} quantity
 * @param {{ sellerId?: string, trrUid?: string, orderUid?: string }} [ctx]
 */
export const recordOfferingRestock = async (profile_expertise_uid, quantity = 1, ctx = {}) => {
  const uid = String(profile_expertise_uid || "").trim();
  const safeQty = Math.max(0, parseInt(quantity, 10) || 0);
  const sellerId = String(ctx.sellerId || "").trim();
  if (!uid || safeQty <= 0) {
    return { success: false, remaining: null, message: "Invalid restock quantity" };
  }
  if (!sellerId) {
    return { success: false, remaining: null, message: "Missing seller_id for restock" };
  }
  try {
    const body = { profile_expertise_uid: uid, quantity: safeQty, seller_id: sellerId };
    const trrUid = String(ctx.trrUid || "").trim();
    const orderUid = String(ctx.orderUid || "").trim();
    if (trrUid) body.trr_uid = trrUid;
    if (orderUid) body.order_uid = orderUid;

    const res = await axios.post(PROFILE_EXPERTISE_RESTOCK_ENDPOINT, body, { headers: { "Content-Type": "application/json" } });
    const data = res.data?.data && typeof res.data.data === "object" ? res.data.data : res.data || {};
    const remaining = data.remaining ?? data.available_quantity ?? null;
    return {
      success: true,
      remaining: remaining == null ? null : parseInt(remaining, 10),
      message: data.message || null,
      profile_expertise_uid: uid,
    };
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data?.data && typeof error.response.data.data === "object" ? error.response.data.data : error.response?.data || {};
    if (status === 409) {
      const remaining = data.remaining ?? data.available_quantity ?? null;
      return {
        success: true,
        remaining: remaining == null ? null : parseInt(remaining, 10),
        message: data.message || "Already restocked for this return",
        profile_expertise_uid: uid,
        duplicate: true,
      };
    }
    const message = data.message || error.message || "Offering restock failed";
    console.error(`recordOfferingRestock failed for ${uid}:`, message);
    return { success: false, remaining: null, message, profile_expertise_uid: uid };
  }
};

/**
 * Restock multiple offerings after a return/cancel confirm.
 * @param {Array<{ profile_expertise_uid: string, quantity: number }>} items
 * @param {{ sellerId?: string, trrUid?: string, orderUid?: string }} [ctx]
 */
export const restockReturnedOfferingItems = async (items, ctx = {}) => {
  const payload = consolidateRestockItemsByProduct(items).filter(
    (item) => item.profile_expertise_uid && (parseInt(item.quantity, 10) || 0) > 0,
  );
  if (!payload.length) return { ok: true, results: [], failures: [] };

  const results = [];
  const failures = [];
  for (const item of payload) {
    const profile_expertise_uid = String(item.profile_expertise_uid).trim();
    const quantity = Math.max(1, parseInt(item.quantity, 10) || 0);
    const outcome = await recordOfferingRestock(profile_expertise_uid, quantity, ctx);
    if (outcome.success) {
      results.push({ profile_expertise_uid, quantity, remaining: outcome.remaining });
    } else {
      failures.push({ profile_expertise_uid, quantity, message: outcome.message || "Offering restock failed" });
    }
  }
  return { ok: failures.length === 0, results, failures, partial: results.length > 0 && failures.length > 0 };
};
