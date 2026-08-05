import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity, Platform, Modal, Alert, TextInput, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import {
  ACCOUNT_SCREEN_PERSONAL_ENDPOINT,
  ACCOUNT_SCREEN_BUSINESS_ENDPOINT,
  WALLET_LEDGER_ENDPOINT,
  ORDERS_ENDPOINT,
  API_BASE_URL,
  TRANSACTION_RECEIPT_ENDPOINT,
  TRANSACTIONS_ENDPOINT,
  TRANSACTIONS_RETURN_ENDPOINT,
  TRANSACTIONS_RETURN_CONFIRM_ENDPOINT,
  TRANSACTIONS_RETURNS_DECLINED_ENDPOINT,
  CREATE_REFUND_ENDPOINT,
} from "../apiConfig";
import Svg, { Circle, Line, Text as SvgText, G, Path } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";
import { useTabRefresh } from "../hooks/useTabRefresh";
import { useDarkMode } from "../contexts/DarkModeContext";
import FeedbackPopup from "../components/FeedbackPopup";
import { getHeaderColors } from "../config/headerColors";
import { SHOW_NETWORK_DEBUG_UI, SETTINGS_NETWORK_DEBUG_MODE_KEY } from "../config/networkDebug";
import { getSessionProfile, resolveBusinessUid } from "../utils/sessionProfile";
import { useSessionBusinesses } from "../contexts/SessionProfileContext";
import { restockReturnedItems, restockReturnedOfferingItems } from "../utils/purchaseService";
import { isOfferingQtyUnlimited } from "../utils/profileOfferingShipping";
// import { Picker } from '@react-native-picker/picker';
import MiniCard from "../components/MiniCard";
import { mapBusinessToMiniCard } from "../utils/mapBusinessToMiniCard";
import { parsePrice } from "../utils/priceUtils";
import { cartChoiceEnrichmentFromItem, formatChoiceLineText, getItemizedChoiceLines } from "../utils/selectedChoiceItems";
import ProductOrderSummaryLines from "../components/ProductOrderSummaryLines";
import { fetchMiddleware as fetch } from "../utils/httpMiddleware";
import {
  formatLocalMonthDayFromKey,
  formatTransactionDate,
  lastNDaysKeys,
  localDateKey,
  parseTransactionDateTime,
  parseUtcDateTime,
  transactionDateMs,
  withTimeZoneQuery,
} from "../utils/transactionDateTime";
import { businessCcFeePayerFromSource } from "../utils/businessCcFeePayer";
import { computeCreditCardProcessingFee, roundCreditCardMoney } from "../utils/cartCreditCardFee";

/** 1 = compact: Purchases (Date, Type, Seller, Delivered, Received, Amount) + Bounty Results (hide ID); 0 = full tables */
const ACCOUNT_TRANSACTION_HISTORY_COMPACT_COLUMNS = 0;

/** Matches React Native Web default body text; SVG chart labels do not inherit this unless set explicitly. */
const ACCOUNT_UI_FONT_FAMILY = Platform.select({
  web: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  default: null,
});
const accountUiFontStyle = ACCOUNT_UI_FONT_FAMILY ? { fontFamily: ACCOUNT_UI_FONT_FAMILY } : {};
const accountChartSvgFontProps = ACCOUNT_UI_FONT_FAMILY ? { fontFamily: ACCOUNT_UI_FONT_FAMILY } : {};

/** Purchased Item cell: list up to two comma-separated names; more than two → "Multiple". */
function formatPurchasedItemDisplay(purchasedItem) {
  const raw = String(purchasedItem || "").trim();
  if (!raw) return "";
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length <= 2) return parts.join(", ");
  return "Multiple";
}

function resolvePurchaseSellerId(transaction) {
  if (!transaction || typeof transaction !== "object") return "";
  const profileId = String(transaction.transaction_profile_id || "").trim();
  const businessId = String(transaction.transaction_business_id || "").trim();
  const sellerId = String(transaction.seller_id || "").trim();
  // API sometimes sets seller_id to the buyer profile; prefer the business/seller uid in that case.
  if (businessId && sellerId === profileId) return businessId;
  if (sellerId) return sellerId;
  return businessId;
}

/** GET /api/transactionreceipt/:profile_id/:transaction_uid — optional ?seller_id= for business seller view */
function buildTransactionReceiptUrl(transaction, profileIdOverride, { sellerId } = {}) {
  const profileId = profileIdOverride || transaction?.transaction_profile_id;
  const transactionUid = transaction?.transaction_uid;
  if (!profileId || !transactionUid) return null;
  const base = `${TRANSACTION_RECEIPT_ENDPOINT}/${profileId}/${transactionUid}`;
  const resolvedSellerId = String(sellerId || "").trim();
  return resolvedSellerId ? `${base}?seller_id=${encodeURIComponent(resolvedSellerId)}` : base;
}

/** Business product purchases use business profile; offerings/seeking use personal profile. */
function isPurchaseFromBusiness(transaction) {
  const purchaseType = String(transaction?.purchase_type || "").toLowerCase();
  if (purchaseType === "business") return true;
  const serviceId = String(transaction?.ti_bs_id ?? transaction?.bs_uid ?? "").trim();
  if (serviceId.startsWith("250-")) return true;
  // Prefer UID prefix when list rows omit purchase_type (common on return rows).
  const sellerUid = resolvePurchaseSellerId(transaction);
  if (sellerUid.startsWith("200-")) return true;
  if (sellerUid.startsWith("110-")) return false;
  return false;
}

function navigateToPurchaseSeller(navigation, transaction) {
  const sellerId = resolvePurchaseSellerId(transaction);
  if (!sellerId) {
    Alert.alert("Unavailable", "Seller profile is not available for this purchase.");
    return;
  }
  if (isPurchaseFromBusiness(transaction) || sellerId.startsWith("200-")) {
    navigation.navigate("BusinessProfile", { business_uid: sellerId, returnTo: "Account" });
    return;
  }
  navigation.navigate("Profile", { profile_uid: sellerId, returnTo: "Account" });
}

/**
 * Expected GET /api/v1/account-screen/personal/:profile_id JSON (flexible keys):
 * - data.transactions | purchase_transactions | personal_transactions | purchases | purchase: buyer rows as array, or { code, data }, or nested { data | items | rows | transactions | list | results | records }[]
 * - data.bounty | bounty_results | bounty_data: same shape as legacy /api/bountyresults body, or bounty_items[] + totals
 * - wallet: root, data, or bounty_results.wallet ({ wallet_actual_balance, wallet_pending, wallet_useable_balance, ... })
 * - Aggregate shape: { purchases: { data }, bounty_results: { data, totals, wallet }, seller_transactions: { data } }
 * - Top-level bounty shape: data[] + total_bounties + total_bounty_earned + wallet (purchases may be in purchases / purchase_transactions)
 * - data.seller_transactions | seller_tx: line items for seller-side expertise qty OR { code, data } (omit key → treat as no seller lines)
 * - data.profile | user_profile: optional { user_email, personal_info, expertise_info } for MiniCard + expertise list
 * - order_list_hydration: (backend) map order_uid -> trimmed order payload (list chips; replaces N order GETs on load)
 */
/** Backend may send numeric or string success codes (e.g. 200 vs "200"). */
function isApiSuccessCode(code) {
  return code === 200 || code === "200" || Number(code) === 200;
}

/** Unwrap buyer tx list when API nests rows (e.g. purchases: { code, data: [...] } or { items: [...] }). */
function extractTransactionArray(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "object") return [];
  if (isApiSuccessCode(raw.code) && Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.data) && (raw.code === undefined || raw.code === null || isApiSuccessCode(raw.code))) return raw.data;
  for (const key of ["items", "rows", "transactions", "list", "results", "records", "purchase_list"]) {
    if (Array.isArray(raw[key])) return raw[key];
  }
  return [];
}

const RECEIPT_TOTAL_EPS = 0.02;

/** Parse optional money from receipt API; `null` if absent (not same as $0). */
function receiptMoneyNullable(v) {
  if (v == null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = parsePrice(v);
  return Number.isFinite(n) ? n : null;
}

/** Purchased quantity on a receipt line (defaults to 1). */
function getReceiptLineQty(row) {
  const q = parsePrice(row?.ti_bs_qty);
  return q > 0 ? Math.round(q) : 1;
}

/** Quantity already confirmed received on a receipt line (from backend). */
function getPreviouslyReceivedQty(row) {
  const q = parsePrice(row?.ti_received_qty);
  return q > 0 ? Math.round(q) : 0;
}

/** Qty still expected to arrive (purchased minus cancelled / pre-ship returned units). */
function getReceivableQty(row) {
  const purchased = Math.max(getReceiptLineQty(row), getLinePurchasedQty(row) || 0);
  const cancelled = getLineCancelledFromShipQty(row);
  return Math.max(0, purchased - cancelled);
}

/** Remaining quantity the buyer can still confirm on a line (excludes cancelled units). */
function getRemainingQtyToReceive(row) {
  return Math.max(0, getReceivableQty(row) - getPreviouslyReceivedQty(row));
}

/** Stable id for a receipt line in API payloads (prefer transaction line uid). */
function getReceiptLineTransactionItemUid(row) {
  const uid = row?.ti_uid != null && String(row.ti_uid).trim() !== "" ? String(row.ti_uid).trim() : "";
  if (uid) return uid;
  const bsId = row?.ti_bs_id != null && String(row.ti_bs_id).trim() !== "" ? String(row.ti_bs_id).trim() : "";
  return bsId;
}

/** Build user-visible error text from a failed fetch response (status, server message, body). */
async function formatFetchErrorAlertMessage(response, contextLines = []) {
  const lines = [...contextLines];
  if (response?.status != null) {
    const statusText = response.statusText ? ` ${response.statusText}` : "";
    lines.push(`HTTP ${response.status}${statusText}`);
  }
  try {
    const text = await response.text();
    if (text?.trim()) {
      try {
        const json = JSON.parse(text);
        if (json.message) lines.push(String(json.message));
        if (json.error && json.error !== json.message) lines.push(String(json.error));
        const { message, error, ...rest } = json;
        if (Object.keys(rest).length > 0) {
          lines.push(JSON.stringify(rest, null, 2));
        }
      } catch {
        lines.push(text.trim());
      }
    }
  } catch (_) {
    // ignore body read failures
  }
  return lines.filter(Boolean).join("\n\n");
}

/** Load receipt line items for a transaction (delivery verification, returns, etc.). */
async function fetchReceiptLinesForTransaction(transaction) {
  const profileId = transaction.transaction_profile_id || (await AsyncStorage.getItem("profile_uid"));
  const transactionUid = transaction.transaction_uid;
  if (!profileId || !transactionUid) {
    throw new Error("Cannot load receipt: missing transaction data.");
  }

  const url = buildTransactionReceiptUrl(transaction, profileId);
  if (!url) {
    throw new Error("Cannot load receipt: missing transaction data.");
  }
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Failed to load receipt: ${response.status}`);
  }

  const result = await response.json();
  let items = [];
  if (Array.isArray(result)) {
    items = result;
  } else if (Array.isArray(result?.data)) {
    items = result.data;
  } else if (result?.data && typeof result.data === "object" && !Array.isArray(result.data)) {
    items = [result.data];
  } else if (result?.data) {
    items = [result.data];
  }

  const purchaseTypeFallback = (transaction.purchase_type || "").toLowerCase();
  if (items.length === 0 && (purchaseTypeFallback === "expertise" || purchaseTypeFallback === "offering")) {
    const qty = Math.max(1, parseInt(transaction.ti_bs_qty || 1, 10));
    const totalAmt = parseFloat(transaction.seller_total || transaction.transaction_total || 0);
    const tiCost = parseFloat(transaction.ti_bs_cost);
    const unitCost = tiCost > 0 ? tiCost : qty > 0 ? totalAmt / qty : totalAmt;
    const txExpertiseId = String(transaction.ti_bs_id || transaction.transaction_uid || "").trim();
    items = [
      {
        ti_uid: String(transaction.ti_uid || transaction.transaction_uid || "").trim(),
        ti_bs_id: txExpertiseId,
        bs_uid: txExpertiseId,
        bs_service_name: transaction.purchased_item || "",
        bs_service_desc: "",
        ti_bs_cost: unitCost,
        ti_bs_qty: qty,
      },
    ];
  }

  if (items.length === 0) {
    const qty = Math.max(1, parseInt(transaction.ti_bs_qty || 1, 10));
    items = [
      {
        ti_uid: String(transaction.ti_uid || transaction.transaction_uid || "line_0"),
        ti_bs_id: String(transaction.ti_bs_id || "").trim(),
        bs_service_name: transaction.purchased_item || "Item",
        ti_bs_cost: parseFloat(transaction.ti_bs_cost || transaction.seller_total || transaction.transaction_total || 0),
        ti_bs_qty: qty,
      },
    ];
  }

  return items;
}

/** True when every receipt line has been fully marked as received (cancelled units excluded). */
function areAllReceiptLinesFullyReceived(receiptRows, selectedItemIds, receivedQuantities) {
  if (!Array.isArray(receiptRows) || receiptRows.length === 0) return false;
  return receiptRows.every((row, index) => {
    const receivableQty = getReceivableQty(row);
    if (receivableQty <= 0) return true;
    const alreadyReceived = getPreviouslyReceivedQty(row);
    const itemId = String(index);
    const newlySelected = selectedItemIds.includes(itemId);
    const raw = receivedQuantities[itemId];
    const newlyReceived = newlySelected ? (typeof raw === "number" ? raw : parseInt(String(raw), 10) || 0) : 0;
    return alreadyReceived + newlyReceived >= receivableQty;
  });
}

/** Sum return qty already requested for a line (supports partial multi-qty returns). */
function getReturnedQtyForLine(returnRequestData, itemIndex, purchasedQty) {
  const split = getLocalReturnSplitForLine(returnRequestData, itemIndex);
  if (split.total > 0) return split.total;
  if (!returnRequestData?.notes?.length) return 0;
  const id = String(itemIndex);
  let total = 0;
  for (const entry of returnRequestData.notes) {
    if (!(entry.items || []).includes(id)) continue;
    const q = entry.itemQuantities?.[id];
    if (q != null && Number(q) > 0) {
      total += Math.round(Number(q));
    } else {
      total += purchasedQty;
    }
  }
  return total;
}

/** Shipped vs unshipped qty already requested locally before backend confirms. */
function getLocalReturnSplitForLine(returnRequestData, itemIndex) {
  const id = String(itemIndex);
  let shipped = 0;
  let unshipped = 0;
  let total = 0;
  let splitKnown = false;

  for (const entry of returnRequestData?.notes || []) {
    if (!(entry.items || []).includes(id)) continue;
    const split = entry.itemSplitQuantities?.[id];
    if (split && typeof split === "object") {
      const s = Math.max(0, parseInt(split.shipped, 10) || 0);
      const u = Math.max(0, parseInt(split.unshipped, 10) || 0);
      if (s + u > 0) {
        shipped += s;
        unshipped += u;
        total += s + u;
        splitKnown = true;
        continue;
      }
    }
    const q = entry.itemQuantities?.[id];
    if (q != null && Number(q) > 0) {
      total += Math.round(Number(q));
    }
  }

  return { shipped, unshipped, total, splitKnown };
}

/** Unit cost × qty for each receipt row (same rule as return modal: qty defaults to 1). */
function sumReceiptLineMerchandise(rows) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, row) => {
    const unit = parsePrice(row.ti_bs_cost);
    const q = parsePrice(row.ti_bs_qty);
    const qty = q > 0 ? q : 1;
    return sum + unit * qty;
  }, 0);
}

/** Merchandise subtotal from receipt API: transaction_amount only (not transaction_total). */
function getReceiptTransactionAmount(receiptRows) {
  if (!Array.isArray(receiptRows)) return null;
  for (const row of receiptRows) {
    const amt = receiptMoneyNullable(row?.transaction_amount);
    if (amt != null) return amt;
  }
  return null;
}

/** Merchandise subtotal: transaction_amount when present, else sum of line unit × qty. */
function getReceiptMerchandiseSubtotal(receiptRows) {
  const txnMerch = getReceiptTransactionAmount(receiptRows);
  if (txnMerch != null) return txnMerch;
  return sumReceiptLineMerchandise(receiptRows);
}

function isReturnReceipt(receiptRows) {
  const merch = getReceiptMerchandiseSubtotal(receiptRows);
  return merch != null && merch < 0;
}

function getOfferingQtyTypeLabel(costString) {
  if (!costString) return "";
  const s = String(costString).toLowerCase().replace(/^\$/, "").trim();
  if (s.includes("total") || !s.match(/\/\w+/)) return "One Time";
  const match = s.match(/\/(\w+)/);
  if (!match) return "";
  const unit = match[1];
  if (unit === "hr" || unit === "hour") return "Per Hour";
  if (unit === "day") return "Per Day";
  if (unit === "week") return "Per Week";
  if (unit === "month") return "Per Month";
  if (unit === "quarter") return "Per Quarter";
  if (unit === "year") return "Per Year";
  if (unit === "each" || unit === "item") return "Per Item";
  return `Per ${unit.charAt(0).toUpperCase() + unit.slice(1)}`;
}

function formatReceiptUsd(n) {
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

function parseReceiptJsonField(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Build receipt line enrichment from a transaction-receipt API row when choices were stored server-side. */
function enrichFromReceiptRow(row) {
  if (!row || typeof row !== "object") return null;

  const selectedChoices = parseReceiptJsonField(row.selected_choices ?? row.ti_selected_choices, {});
  const selectedChoiceLabels = parseReceiptJsonField(row.selected_choice_labels ?? row.ti_selected_choice_labels, {});
  const selectedChoiceItems = parseReceiptJsonField(row.selected_choice_items ?? row.ti_selected_choice_items, []);
  const selectedOptions = Array.isArray(row.selected_options) ? row.selected_options : [];
  const specialInstructions = String(row.special_instructions ?? row.ti_special_instructions ?? "").trim();
  const unitPriceRaw = row.unit_price ?? row.ti_unit_price;
  const unitPrice = unitPriceRaw != null && unitPriceRaw !== "" ? parseFloat(unitPriceRaw) : undefined;
  const optionsExtraCost = selectedOptions.reduce((sum, opt) => sum + (parseFloat(opt?.extra_cost) || 0), 0);
  const choicesExtraCost = parseFloat(row.choices_extra_cost ?? row.ti_choices_extra_cost ?? NaN) || optionsExtraCost || 0;
  const itemizedLines = getItemizedChoiceLines({
    selectedChoiceItems,
    selectedChoiceLabels,
    selected_options: selectedOptions,
    choicesExtraCost,
  });
  const hasLabels = selectedChoiceLabels && typeof selectedChoiceLabels === "object" && Object.keys(selectedChoiceLabels).length > 0;
  const hasChoices = selectedChoices && typeof selectedChoices === "object" && Object.keys(selectedChoices).length > 0;
  const hasItemized = itemizedLines.length > 0;
  const hasSelectedOptions = selectedOptions.length > 0;

  if (choicesExtraCost <= 0 && !hasLabels && !hasChoices && !hasItemized && !hasSelectedOptions && !specialInstructions) return null;

  return {
    choicesExtraCost,
    selectedChoiceLabels: hasLabels ? selectedChoiceLabels : {},
    selectedChoiceItems: itemizedLines,
    selectedChoices: hasChoices ? selectedChoices : {},
    selected_options: hasSelectedOptions ? selectedOptions : [],
    specialInstructions,
    unitPrice,
  };
}

/** Option extras for one receipt line — prefer server fields on the row, not a shared product map. */
function getReceiptLineChoicesExtraCost(row, enrich) {
  const fromField = receiptMoneyNullable(row?.ti_choices_extra_cost ?? row?.choices_extra_cost);
  if (fromField != null) return fromField;
  const selectedOptions = Array.isArray(row?.selected_options) ? row.selected_options : enrich?.selected_options || [];
  if (selectedOptions.length) {
    return selectedOptions.reduce((sum, opt) => sum + (parseFloat(opt?.extra_cost) || 0), 0);
  }
  return parseFloat(enrich?.choicesExtraCost || 0) || 0;
}

function getReceiptLineUnitPrice(row, enrich) {
  const baseCost = parseFloat(row?.ti_bs_cost ?? row?.bs_cost ?? 0) || 0;
  const unitFromReceipt = parseFloat(row?.unit_price ?? row?.ti_unit_price);
  if (Number.isFinite(unitFromReceipt) && unitFromReceipt > 0) return unitFromReceipt;
  const enrichUnit = parseFloat(enrich?.unitPrice);
  if (Number.isFinite(enrichUnit) && enrichUnit > 0) return enrichUnit;
  // API ti_bs_cost is already the configured unit price (selected variant included).
  return baseCost;
}

/** First non-null money field from a receipt row or transaction summary. */
function receiptMoneyFromSources(row, fallback, keys) {
  for (const key of keys) {
    const fromRow = receiptMoneyNullable(row?.[key]);
    if (fromRow != null) return fromRow;
    const fromFallback = receiptMoneyNullable(fallback?.[key]);
    if (fromFallback != null) return fromFallback;
  }
  return null;
}

/** Match personal bounty_results row to a receipt line (ti_uid / tb_ti_id). */
function findBountyResultForReceiptLine(bountyRows, receiptLine, transactionUid) {
  if (!Array.isArray(bountyRows) || !receiptLine) return null;
  const tiUid = String(receiptLine.ti_uid || receiptLine.transaction_item_uid || "").trim();
  const txnUid = String(transactionUid || "").trim();
  if (tiUid) {
    const byTi = bountyRows.find((row) => String(row?.ti_uid || row?.tb_ti_id || "").trim() === tiUid);
    if (byTi) return byTi;
  }
  if (txnUid) {
    const bsId = String(receiptLine.ti_bs_id || receiptLine.bs_uid || "").trim();
    if (bsId) {
      return bountyRows.find((row) => String(row?.ti_transaction_id || row?.transaction_uid || "").trim() === txnUid && String(row?.ti_bs_id || row?.bs_uid || "").trim() === bsId) || null;
    }
  }
  return null;
}

/**
 * Resolve item bounty (seller pool for the line) and this user's share.
 * Prefers receipt fields; falls back to bounty_results (amount + percentage).
 */
function resolveReceiptLineBountyDisplay(receiptLine, bountyRow) {
  const qty = getReceiptLineQty(receiptLine);
  const bountyType = String(receiptLine?.bs_bounty_type || receiptLine?.ti_bs_bounty_type || bountyRow?.bs_bounty_type || "")
    .trim()
    .toLowerCase();
  const unitRaw = parseFloat(receiptLine?.bs_bounty ?? receiptLine?.ti_bs_bounty ?? receiptLine?.bounty_amount ?? receiptLine?.item_bounty ?? NaN);
  let lineBounty = Number.isFinite(unitRaw) && unitRaw > 0 ? (bountyType === "total" ? unitRaw : unitRaw * Math.max(1, qty)) : null;

  const earnedRaw = parseFloat(bountyRow?.bounty_earned ?? bountyRow?.tb_amount ?? receiptLine?.bounty_earned ?? receiptLine?.tb_amount ?? NaN);
  const earned = Number.isFinite(earnedRaw) ? earnedRaw : null;
  const pctRaw = parseFloat(bountyRow?.tb_percentage ?? receiptLine?.tb_percentage ?? receiptLine?.bounty_percentage ?? NaN);
  const percentage = Number.isFinite(pctRaw) ? pctRaw : null;

  if (lineBounty == null && earned != null && percentage != null && percentage > 0) {
    lineBounty = earned / percentage;
  }

  if (lineBounty == null && earned == null) return null;

  const pctLabel = percentage != null ? (percentage > 0 && percentage <= 1 ? `${Math.round(percentage * 1000) / 10}%` : `${Math.round(percentage * 10) / 10}%`) : null;

  let itemLabel = null;
  if (lineBounty != null) {
    if (bountyType === "per_item" && Number.isFinite(unitRaw) && unitRaw > 0 && qty > 1) {
      itemLabel = `$${lineBounty.toFixed(2)} ($${unitRaw.toFixed(2)} × ${qty})`;
    } else {
      itemLabel = `$${lineBounty.toFixed(2)}${bountyType === "per_item" ? " / item total" : bountyType === "total" ? " total" : ""}`;
    }
  }

  const shareLabel = earned != null ? `$${earned.toFixed(2)}${pctLabel ? ` (${pctLabel})` : ""}` : null;

  return { itemLabel, shareLabel, lineBounty, earned, percentage };
}

/** Format tb_percentage for display (0.25 → 25%, 25 → 25%). */
function formatBountySharePercentLabel(percentage) {
  if (percentage == null || !Number.isFinite(Number(percentage))) return null;
  const pct = Number(percentage);
  return pct > 0 && pct <= 1 ? `${Math.round(pct * 1000) / 10}%` : `${Math.round(pct * 10) / 10}%`;
}

/** Personal bounty_results row: total pool bounty, this user's earned share, and %. */
function resolveBountyResultsRowDisplay(item) {
  return resolveReceiptLineBountyDisplay(item, item);
}

/** Below receipt line items: merchandise, tax, shipping, bounty, card fees, total. */
function ReceiptTransactionTotalsFooter({ receiptRows, transactionFallback, darkMode }) {
  if (!Array.isArray(receiptRows) || receiptRows.length === 0) return null;
  const first = receiptRows[0] || {};
  const fallback = transactionFallback && typeof transactionFallback === "object" ? transactionFallback : {};
  const fromLines = sumReceiptLineMerchandise(receiptRows);
  const txnMerch = getReceiptTransactionAmount(receiptRows);
  const txnTaxes = receiptMoneyFromSources(first, fallback, ["transaction_taxes", "total_taxes"]);
  const txnFeesReported = receiptMoneyFromSources(first, fallback, ["transaction_fees", "total_fees"]);
  const txnOtherFees = receiptMoneyFromSources(first, fallback, ["other_fees", "service_fees", "platform_fees"]);
  const txnShipping = receiptMoneyFromSources(first, fallback, ["transaction_shipping", "shipping_amount", "shipping_cost", "shipping"]);
  const txnBounty = receiptMoneyFromSources(first, fallback, ["bounty_paid", "transaction_bounty", "total_bounty_paid"]);
  const txnTotal = receiptMoneyFromSources(first, fallback, ["transaction_total", "total_amount_paid", "seller_total"]);

  const purchaseType = String(fallback.purchase_type || first.purchase_type || "").toLowerCase();
  const ccPayer = businessCcFeePayerFromSource(fallback) || businessCcFeePayerFromSource(first);
  const buyerPaysCardFee = purchaseType === "expertise" || purchaseType === "offering" || ccPayer === "buyer" || (ccPayer !== "seller" && txnFeesReported != null && txnFeesReported > 0);

  const merchForFee = txnMerch != null ? txnMerch : fromLines;
  const creditCardFeeBase = roundCreditCardMoney((merchForFee || 0) + (txnTaxes || 0) + (txnShipping || 0) + (txnOtherFees || 0));
  const txnFees = buyerPaysCardFee ? computeCreditCardProcessingFee(creditCardFeeBase, true) : 0;

  const hasAnyBreakdown = txnMerch != null || txnTaxes != null || txnFeesReported != null || txnShipping != null || txnBounty != null || txnTotal != null || creditCardFeeBase > 0;
  if (!hasAnyBreakdown) return null;

  const merchDisplay = txnMerch != null ? txnMerch : fromLines;
  const merchLabel = txnMerch != null ? "Merchandise (subtotal)" : "Merchandise (from line items)";

  const labelColor = darkMode ? "#ccc" : "#444";
  const valueColor = darkMode ? "#eee" : "#222";
  const secondaryColor = darkMode ? "#aaa" : "#666";
  const borderColor = darkMode ? "#444" : "#ddd";

  const row = (label, valueText) => (
    <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5, paddingHorizontal: 2 }}>
      <Text style={{ fontSize: 12, color: labelColor, flex: 1, paddingRight: 8 }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: "600", color: valueColor, flexShrink: 0, ...(Platform.OS === "web" ? { whiteSpace: "nowrap" } : {}) }} numberOfLines={1}>
        {valueText}
      </Text>
    </View>
  );

  const taxesStr = txnTaxes != null ? formatReceiptUsd(txnTaxes) : "—";
  const shippingStr = txnShipping != null ? formatReceiptUsd(txnShipping) : "—";
  const feesStr = buyerPaysCardFee ? formatReceiptUsd(txnFees) : "—";
  const totalStr = txnTotal != null ? formatReceiptUsd(txnTotal) : "—";
  const showBounty = txnBounty != null && txnBounty > 0;

  const linesVsMerch = txnMerch != null && fromLines > 0 && Math.abs(fromLines - txnMerch) > RECEIPT_TOTAL_EPS;

  let verifyText = "";
  let verifyColor = secondaryColor;

  if (txnTotal != null) {
    const sumParts = [merchForFee || 0];
    if (txnTaxes != null) sumParts.push(txnTaxes);
    if (txnShipping != null) sumParts.push(txnShipping);
    if (txnOtherFees != null && txnOtherFees > 0) sumParts.push(txnOtherFees);
    if (buyerPaysCardFee && txnFees > 0) sumParts.push(txnFees);
    const sum = roundCreditCardMoney(sumParts.reduce((a, b) => a + b, 0));
    if (txnTaxes != null || txnShipping != null || buyerPaysCardFee || txnOtherFees != null) {
      if (Math.abs(sum - txnTotal) <= RECEIPT_TOTAL_EPS) {
        verifyText = `Subtotal + tax + shipping${txnOtherFees != null && txnOtherFees > 0 ? " + other fees" : ""}${buyerPaysCardFee ? " + card fees" : ""} matches amount paid (${formatReceiptUsd(txnTotal)}).`;
        verifyColor = "#18884A";
      } else {
        const partsLabel = [
          formatReceiptUsd(merchForFee || 0),
          txnTaxes != null ? formatReceiptUsd(txnTaxes) : null,
          txnShipping != null ? formatReceiptUsd(txnShipping) : null,
          txnOtherFees != null && txnOtherFees > 0 ? formatReceiptUsd(txnOtherFees) : null,
          buyerPaysCardFee && txnFees > 0 ? formatReceiptUsd(txnFees) : null,
        ]
          .filter(Boolean)
          .join(" + ");
        verifyText = `Totals do not match: ${partsLabel} = ${formatReceiptUsd(sum)}, but amount paid is ${formatReceiptUsd(txnTotal)}.`;
        verifyColor = "#B71C1C";
      }
      if (buyerPaysCardFee && txnFeesReported != null && Math.abs(txnFeesReported - txnFees) > RECEIPT_TOTAL_EPS) {
        verifyText = `${verifyText ? `${verifyText} ` : ""}Reported card fees (${formatReceiptUsd(txnFeesReported)}) differ from computed (${formatReceiptUsd(txnFees)}) on base ${formatReceiptUsd(creditCardFeeBase)}.`;
        verifyColor = "#B71C1C";
      }
    } else {
      verifyText = "Tax, fee, or shipping fields were not returned; skipped automatic check against amount paid.";
      verifyColor = secondaryColor;
    }
  } else {
    verifyText = "Transaction total was not returned; cannot verify amount paid.";
    verifyColor = secondaryColor;
  }

  return (
    <View style={{ marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: borderColor, width: "100%" }}>
      {row(merchLabel, formatReceiptUsd(merchDisplay))}
      {txnMerch != null && linesVsMerch ? (
        <Text style={{ fontSize: 12, color: secondaryColor, marginBottom: 8, paddingHorizontal: 2 }}>
          Note: Sum of unit cost × quantity on lines ({formatReceiptUsd(fromLines)}) differs from reported merchandise subtotal ({formatReceiptUsd(txnMerch)}).
        </Text>
      ) : null}
      {row("Sales tax", taxesStr)}
      {row("Shipping", shippingStr)}
      {showBounty ? row("Bounty (paid by seller)", formatReceiptUsd(txnBounty)) : null}
      {row("Credit card fees", feesStr)}
      {row("Amount paid", totalStr)}
      {verifyText && verifyColor === "#B71C1C" ? (
        <Text
          style={{
            fontSize: 11,
            color: verifyColor,
            marginTop: 4,
            fontWeight: "600",
            paddingHorizontal: 2,
          }}
        >
          {verifyText}
        </Text>
      ) : null}
    </View>
  );
}

/** Wallet block from account-screen/personal (root, data, or inside bounty_results). */
function extractPersonalWallet(root, payload, bountyBlock) {
  const bag = payload && typeof payload === "object" ? payload : null;
  const bountyBag = bountyBlock && typeof bountyBlock === "object" ? bountyBlock : null;
  const w = root?.wallet ?? bag?.wallet ?? bag?.bounty_results?.wallet ?? bountyBag?.wallet ?? null;
  return w && typeof w === "object" && !Array.isArray(w) ? w : null;
}

/** Normalize bounty_results / legacy bounty shapes to { data, total_bounty_earned, total_bounties }. */
function normalizePersonalBounty(bountyRaw, root, payload) {
  if (bountyRaw == null) return null;
  if (Array.isArray(bountyRaw)) {
    return {
      data: bountyRaw,
      total_bounty_earned: root?.total_bounty_earned ?? payload?.total_bounty_earned,
      total_bounties: root?.total_bounties ?? payload?.total_bounties,
    };
  }
  if (typeof bountyRaw !== "object") return null;
  const rows = Array.isArray(bountyRaw.data)
    ? bountyRaw.data
    : Array.isArray(bountyRaw.bounty_items)
      ? bountyRaw.bounty_items
      : isApiSuccessCode(bountyRaw.code) && Array.isArray(bountyRaw.data)
        ? bountyRaw.data
        : [];
  return {
    data: rows,
    total_bounty_earned: bountyRaw.total_bounty_earned ?? root?.total_bounty_earned ?? payload?.total_bounty_earned,
    total_bounties: bountyRaw.total_bounties ?? root?.total_bounties ?? payload?.total_bounties,
  };
}

function formatWalletUsd(val) {
  return `$${parsePrice(val).toFixed(2)}`;
}

function formatLedgerAmount(val) {
  const amount = parsePrice(val);
  const prefix = amount >= 0 ? "+" : "−";
  return `${prefix}$${Math.abs(amount).toFixed(2)}`;
}

function formatLedgerColumnAmount(val) {
  if (val == null || val === "" || Math.abs(parsePrice(val)) < 0.0001) return "—";
  return formatLedgerAmount(val);
}

function ledgerAmountColor(amount, darkMode) {
  const n = parsePrice(amount);
  if (Math.abs(n) < 0.0001) return undefined;
  return n >= 0 ? (darkMode ? "#81c784" : "#2e7d32") : darkMode ? "#ef5350" : "#c62828";
}

function formatLedgerEntryDate(entry) {
  if (!entry || typeof entry !== "object") return "N/A";
  return formatTransactionDate({
    transaction_datetime: entry.entry_datetime,
    transaction_datetime_local: entry.entry_datetime_local,
  });
}

function enrichBountyLineFromPurchases(line, transactionData) {
  if (!line || !Array.isArray(transactionData)) return line;
  const linkedTxnUid = String(line.ti_transaction_id || line.transaction_uid || "").trim();
  const linkedTxn = linkedTxnUid ? transactionData.find((t) => String(t.transaction_uid || "").trim() === linkedTxnUid) : null;
  if (!linkedTxn) return line;
  return {
    ...line,
    ti_received_qty: line.ti_received_qty ?? linkedTxn.ti_received_qty ?? linkedTxn.received_item_count,
    ti_bs_qty: line.ti_bs_qty ?? linkedTxn.ti_bs_qty ?? linkedTxn.item_count,
    ti_bs_return_window_days: line.ti_bs_return_window_days ?? linkedTxn.ti_bs_return_window_days ?? linkedTxn.return_window_days,
    ti_bs_is_returnable: line.ti_bs_is_returnable ?? linkedTxn.ti_bs_is_returnable ?? linkedTxn.is_returnable,
    bounty_released_at: line.bounty_released_at ?? linkedTxn.bounty_released_at,
  };
}

/** Merge receipt fields from bounty_results lines onto purchase list rows (same account-screen payload). */
function enrichPurchasesFromBountyResults(purchaseRows, bountyLines) {
  if (!Array.isArray(purchaseRows) || !purchaseRows.length || !Array.isArray(bountyLines) || !bountyLines.length) {
    return purchaseRows;
  }
  const bountyByTxnUid = {};
  const bountyByTiUid = {};
  for (const line of bountyLines) {
    if (!line || typeof line !== "object") continue;
    const txnUid = String(line.ti_transaction_id || line.transaction_uid || "").trim();
    const tiUid = String(line.ti_uid || line.tb_ti_id || "").trim();
    if (txnUid) bountyByTxnUid[txnUid] = line;
    if (tiUid) bountyByTiUid[tiUid] = line;
  }
  return purchaseRows.map((row) => {
    if (!row || typeof row !== "object" || isReturnListRow(row)) return row;
    const txnUid = String(row.transaction_uid || "").trim();
    const tiUid = String(row.ti_uid || row.transaction_item_uid || "").trim();
    const bountyLine = (tiUid && bountyByTiUid[tiUid]) || (txnUid && bountyByTxnUid[txnUid]);
    if (!bountyLine) return row;

    const patches = {};
    const bountyReceived = bountyLine.ti_received_qty;
    if (bountyReceived != null && String(bountyReceived).trim() !== "" && (row.ti_received_qty == null || String(row.ti_received_qty).trim() === "")) {
      patches.ti_received_qty = bountyReceived;
    }
    if (bountyLine.ti_received_at && !row.ti_received_at) {
      patches.ti_received_at = bountyLine.ti_received_at;
    }
    const receivedCount = parseInt(row.received_item_count ?? row.delivered_item_count, 10);
    const bountyReceivedNum = Math.max(0, Math.round(parsePrice(bountyReceived)));
    if (bountyReceivedNum > 0 && !Number.isFinite(receivedCount)) {
      patches.received_item_count = bountyReceivedNum;
      patches.delivered_item_count = bountyReceivedNum;
    }
    return Object.keys(patches).length ? { ...row, ...patches } : row;
  });
}

/** Bounty dollars still pending on a chart date (earned by then, not yet released by then). */
function bountyAmountPendingOnChartDate(line, dateKey, ledgerAvailabilityByTxnUid, ledgerRows) {
  const amount = parseFloat(line.bounty_earned) || 0;
  if (amount <= 0) return 0;
  const earnedDt = parseTransactionDateTime(line);
  if (!earnedDt || localDateKey(earnedDt) > dateKey) return 0;

  const releasedRaw = line?.bounty_released_at;
  if (releasedRaw != null && String(releasedRaw).trim() !== "") {
    const releaseDt = new Date(releasedRaw);
    if (!Number.isNaN(releaseDt.getTime()) && localDateKey(releaseDt) <= dateKey) return 0;
    return amount;
  }

  const status = bountyProceedsStatus(line, ledgerAvailabilityByTxnUid, ledgerRows);
  return status === "useable" ? 0 : amount;
}

/** Match a wallet ledger row to a bounty_results line (transaction + earned amount). */
function resolveLedgerAvailabilityForBountyLine(line, ledgerRows) {
  if (!line || !Array.isArray(ledgerRows)) return null;
  const txnUid = String(line?.ti_transaction_id || line?.transaction_uid || "").trim();
  if (!txnUid) return null;
  const earned = parsePrice(line?.bounty_earned ?? line?.tb_amount);
  const candidates = ledgerRows.filter((entry) => {
    if (String(entry?.transaction_uid || "").trim() !== txnUid) return false;
    const type = String(entry?.entry_type || "")
      .trim()
      .toLowerCase();
    return type === "bounty_earned" || type === "bounty_reversal";
  });
  if (!candidates.length) return null;
  if (Number.isFinite(earned) && earned > 0) {
    const byAmount = candidates.find((entry) => Math.abs(parsePrice(entry.amount) - earned) < 0.01);
    if (byAmount?.availability) return byAmount.availability;
  }
  if (candidates.some((entry) => entry.availability === "pending")) return "pending";
  if (candidates.some((entry) => entry.availability === "useable")) return "useable";
  return candidates[0]?.availability ?? null;
}

function bountyLineIsReleased(line) {
  const releasedAt = line?.bounty_released_at;
  return releasedAt != null && String(releasedAt).trim() !== "";
}

/** Prefer wallet ledger availability when present; otherwise infer from line + wallet rules. */
function bountyProceedsStatus(line, ledgerAvailabilityByTxnUid, ledgerRows = null) {
  const ledgerAvail = resolveLedgerAvailabilityForBountyLine(line, ledgerRows);
  const txnUid = String(line?.ti_transaction_id || line?.transaction_uid || "").trim();
  const ledgerAvailTxn = !ledgerAvail && txnUid && ledgerAvailabilityByTxnUid ? ledgerAvailabilityByTxnUid[txnUid] : null;
  const availability = ledgerAvail || ledgerAvailTxn;

  if (availability === "useable") return "useable";
  if (availability === "pending") {
    const received = parsePrice(line?.ti_received_qty ?? 0);
    const ordered = parsePrice(line?.ti_bs_qty ?? 0);
    const verified = ordered > 0 && received >= ordered;
    return verified ? "pending_until_window" : "pending";
  }

  const received = parsePrice(line?.ti_received_qty ?? 0);
  const ordered = parsePrice(line?.ti_bs_qty ?? 0);
  const verified = ordered > 0 && received >= ordered;
  const returnWindowDays = parsePrice(line?.ti_bs_return_window_days ?? line?.return_window_days ?? 0);
  const isReturnable = parseOptionalBoolean(line?.ti_bs_is_returnable ?? line?.is_returnable ?? line?.bs_is_returnable) !== false;
  if (!verified || !bountyLineIsReleased(line)) return "pending";
  if (isReturnable && returnWindowDays > 0) return "pending_until_window";
  return "useable";
}

function bountyProceedsStatusLabel(status) {
  switch (status) {
    case "useable":
      return "Available";
    case "pending_until_window":
      return "Pending (return window)";
    case "pending":
    default:
      return "Pending";
  }
}

/** Latest ledger availability per transaction_uid (bounty + sale proceeds entries). Pending wins over useable. */
function buildLedgerAvailabilityByTxnUid(ledgerRows) {
  const map = {};
  if (!Array.isArray(ledgerRows)) return map;
  for (const entry of ledgerRows) {
    const txnUid = String(entry?.transaction_uid || "").trim();
    if (!txnUid || !entry.availability) continue;
    if (entry.availability === "pending") map[txnUid] = "pending";
    else if (!map[txnUid] && entry.availability === "useable") map[txnUid] = "useable";
  }
  return map;
}

function resolveOrderUidForTransactionUid(txnUid, ...sources) {
  const uid = String(txnUid || "").trim();
  if (!uid) return null;
  for (const list of sources) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      const rowTxn = String(row?.transaction_uid || row?.ti_transaction_id || "").trim();
      if (rowTxn !== uid) continue;
      const orderUid = resolveListRowOrderUid(row);
      if (orderUid && orderUid !== "—") return orderUid;
    }
  }
  return null;
}

/** Seller net earnings follow the same verification / return-window rules as bounty. */
function sellerProceedsStatus(row, ledgerAvailabilityByTxnUid, ledgerRows = null) {
  return bountyProceedsStatus(row, ledgerAvailabilityByTxnUid, ledgerRows);
}

/** Settings Debug Mode: log account-screen/personal purchase extraction (txRaw + duplicate txn uids). */
function summarizeAccountScreenPurchaseRow(row, index) {
  if (!row || typeof row !== "object") return { index, row };
  return {
    index,
    transaction_uid: row.transaction_uid ?? null,
    trr_uid: row.trr_uid ?? row.pending_return?.trr_uid ?? null,
    trr_transaction_uid: row.trr_transaction_uid ?? null,
    transaction_original_uid: row.transaction_original_uid ?? null,
    order_uid: row.order_uid ?? null,
    resolved_order_uid: resolveListRowOrderUid(row),
    is_return: row.is_return ?? null,
    is_pending_return: row.is_pending_return ?? null,
    transaction_type: row.transaction_type ?? null,
    ti_uid: row.ti_uid ?? null,
  };
}

function logAccountScreenPersonalPurchasesDebug({ source, purchasesRawKey, txRaw, transactions }) {
  const rows = Array.isArray(transactions) ? transactions : [];
  const uidCounts = {};
  for (const row of rows) {
    const uid = String(row?.transaction_uid || "").trim();
    if (!uid) continue;
    uidCounts[uid] = (uidCounts[uid] || 0) + 1;
  }
  const duplicateTransactionUids = Object.entries(uidCounts)
    .filter(([, count]) => count > 1)
    .map(([transaction_uid, count]) => ({ transaction_uid, count }));

  console.log(
    `[AccountScreen] Debug — account-screen/personal purchases (${source}):`,
    JSON.stringify(
      {
        purchasesRawKey,
        txRawType: txRaw == null ? "null" : Array.isArray(txRaw) ? "array" : typeof txRaw,
        txRaw,
        extractedCount: rows.length,
        duplicateTransactionUids,
        rowSummaries: rows.map(summarizeAccountScreenPurchaseRow),
      },
      null,
      2,
    ),
  );
}

function mapAccountScreenPersonalResponse(json, options = {}) {
  const root = json && typeof json === "object" ? json : {};

  if (Array.isArray(root.data)) {
    const bountyResultsBlock = root.bounty_results ?? null;
    const walletEarly = extractPersonalWallet(root, root, bountyResultsBlock ?? { data: root.data, wallet: root.wallet });
    const hasBountyTotals = root.total_bounty_earned != null || root.total_bounties != null || walletEarly != null || bountyResultsBlock != null;
    if (hasBountyTotals) {
      const purchasesRaw = root.purchases ?? root.purchase_transactions ?? root.personal_transactions ?? root.buyer_transactions;
      const purchasesRawKey =
        root.purchases != null
          ? "root.purchases"
          : root.purchase_transactions != null
            ? "root.purchase_transactions"
            : root.personal_transactions != null
              ? "root.personal_transactions"
              : root.buyer_transactions != null
                ? "root.buyer_transactions"
                : null;
      let sellerTransactions = [];
      const stRaw = root.seller_transactions ?? root.seller_tx;
      if (Array.isArray(stRaw)) {
        sellerTransactions = stRaw;
      } else if (stRaw && isApiSuccessCode(stRaw.code) && Array.isArray(stRaw.data)) {
        sellerTransactions = stRaw.data;
      }
      const bountyRaw = bountyResultsBlock ?? {
        data: root.data,
        total_bounty_earned: root.total_bounty_earned,
        total_bounties: root.total_bounties,
        wallet: root.wallet,
      };
      const transactions = extractTransactionArray(purchasesRaw);
      if (options.debug) {
        logAccountScreenPersonalPurchasesDebug({
          source: "root.data + bounty aggregate",
          purchasesRawKey,
          txRaw: purchasesRaw,
          transactions,
        });
      }
      return {
        transactions,
        bounty: normalizePersonalBounty(bountyRaw, root, root),
        wallet: extractPersonalWallet(root, root, bountyRaw),
        sellerTransactions,
        profile: root.profile ?? root.user_profile ?? null,
      };
    }
    return {
      transactions: isApiSuccessCode(root.code) ? root.data : [],
      bounty: null,
      wallet: extractPersonalWallet(root, root, null),
      /** Top-level `data` array is buyer rows only; no nested seller list in this shape */
      sellerTransactions: [],
      profile: null,
    };
  }
  const payload = root.data !== undefined && root.data !== null && typeof root.data === "object" && !Array.isArray(root.data) ? root.data : root;

  let transactions = [];
  /** Purchases often live in data.purchases; some APIs put the same block on the root next to data. */
  const txRaw =
    payload.transactions ??
    payload.purchase_transactions ??
    payload.personal_transactions ??
    payload.buyer_transactions ??
    payload.transaction_list ??
    payload.purchases ??
    payload.purchase ??
    payload.purchase_list ??
    root.purchases;
  const purchasesRawKey =
    payload.transactions != null
      ? "payload.transactions"
      : payload.purchase_transactions != null
        ? "payload.purchase_transactions"
        : payload.personal_transactions != null
          ? "payload.personal_transactions"
          : payload.buyer_transactions != null
            ? "payload.buyer_transactions"
            : payload.transaction_list != null
              ? "payload.transaction_list"
              : payload.purchases != null
                ? "payload.purchases"
                : payload.purchase != null
                  ? "payload.purchase"
                  : payload.purchase_list != null
                    ? "payload.purchase_list"
                    : root.purchases != null
                      ? "root.purchases"
                      : null;
  transactions = extractTransactionArray(txRaw);
  let transactionsSource = "txRaw";
  // Nested legacy shape: { message, code: 200, data: [ rows ] } embedded under payload
  if (!transactions.length && payload && typeof payload === "object") {
    const legacyBlock = payload.transactions_legacy ?? payload.transaction_payload ?? payload.transaction_response ?? payload.buyer_transaction_response;
    if (legacyBlock && isApiSuccessCode(legacyBlock.code) && Array.isArray(legacyBlock.data)) {
      transactions = legacyBlock.data;
      transactionsSource = "legacyBlock.data";
    } else if (isApiSuccessCode(payload.code) && Array.isArray(payload.data)) {
      const sample = payload.data[0];
      if (sample && (sample.transaction_uid != null || sample.ti_uid != null)) {
        transactions = payload.data;
        transactionsSource = "payload.data (buyer rows)";
      }
    }
  }

  if (options.debug) {
    logAccountScreenPersonalPurchasesDebug({
      source: transactionsSource === "txRaw" ? "payload/root purchases" : transactionsSource,
      purchasesRawKey: transactionsSource === "txRaw" ? purchasesRawKey : transactionsSource,
      txRaw: transactionsSource === "txRaw" ? txRaw : null,
      transactions,
    });
  }

  /** Legacy buyer rows use transaction_business_id; aggregate may only send seller_id. */
  transactions = transactions.map((row) => {
    if (!row || typeof row !== "object") return row;
    if (row.transaction_business_id == null && row.seller_id != null) {
      return { ...row, transaction_business_id: row.seller_id };
    }
    return row;
  });

  const bountyRaw = payload.bounty ?? payload.bounty_results ?? payload.bounty_data ?? null;
  let bounty = bountyRaw;
  if (!bounty && Array.isArray(payload.bounty_items)) {
    bounty = {
      data: payload.bounty_items,
      total_bounty_earned: payload.total_bounty_earned,
      total_bounties: payload.total_bounties,
    };
  }
  bounty = normalizePersonalBounty(bounty, root, payload);

  const walletFromResponse = extractPersonalWallet(root, payload, bountyRaw);

  let sellerTransactions;
  const stRaw = payload.seller_transactions ?? payload.seller_tx ?? payload.seller_transaction_lines;
  if (stRaw === undefined) {
    sellerTransactions = [];
  } else if (Array.isArray(stRaw)) {
    sellerTransactions = stRaw;
  } else if (stRaw && isApiSuccessCode(stRaw.code) && Array.isArray(stRaw.data)) {
    sellerTransactions = stRaw.data;
  } else {
    sellerTransactions = [];
  }

  const profile = payload.profile ?? payload.user_profile ?? payload.personal_profile ?? null;

  return { transactions, bounty, sellerTransactions, profile, wallet: walletFromResponse };
}

/**
 * Expected GET /api/v1/account-screen/business/:business_uid JSON (flexible keys):
 * - data.bounty_results | business_bounty_results | business_bounty | bounty: { data: [...] } (business bounty lines)
 * - data.seller_transactions | transactions_seller: seller line rows OR { code, data } (same as legacy /transactions/seller/:id)
 * - data.business | business_profile | profile (optional): same field names as GET /api/v1/businessinfo/:uid `business` object for MiniCard
 * - data.services | business_services | business_info.services: product catalog for Product Inventory
 * - order_list_hydration: (backend) map order_uid -> trimmed order payload (seller shipping/received chips)
 */
/** Seller line is a business product sale (API uses purchase_type and/or bs_uid 250-*, not always ti_bs_id on the line). */
function isBusinessProductSellerLine(item) {
  if (!item || typeof item !== "object") return false;
  const purchaseType = String(item.purchase_type || "").toLowerCase();
  if (purchaseType === "business") return true;
  const serviceId = String(item.ti_bs_id ?? item.bs_uid ?? "").trim();
  return serviceId.startsWith("250-");
}

function resolveProductUidFromSaleLine(row) {
  return String(row?.ti_bs_id ?? row?.bs_uid ?? "").trim();
}

function getSaleLineQty(row) {
  const q = parseInt(row?.ti_bs_qty, 10);
  return Number.isFinite(q) && q > 0 ? q : 1;
}

/** Signed qty for product-sales totals; return lines store negative ti_bs_qty. */
function getSignedProductSalesLineQty(row) {
  const q = parseInt(row?.ti_bs_qty, 10);
  if (Number.isFinite(q) && q !== 0) return q;
  if (isReturnListRow(row)) return 0;
  return 1;
}

function getSaleLineUnitCost(row) {
  const cost = parseFloat(row?.ti_bs_cost ?? row?.bs_cost ?? 0);
  return Number.isFinite(cost) ? cost : 0;
}

function aggregateBusinessProductSales(bountyLines) {
  if (!Array.isArray(bountyLines)) return [];
  const byProduct = {};
  for (const row of bountyLines) {
    if (isPendingReturnListRow(row)) continue;
    const productUid = resolveProductUidFromSaleLine(row);
    if (!productUid) continue;

    let qty = getSignedProductSalesLineQty(row);
    if (isReturnListRow(row) && qty > 0) qty = -qty;
    if (qty === 0) continue;
    const unitCost = getSaleLineUnitCost(row);
    const bountyPaid = parseFloat(row?.bounty_earned ?? row?.bounty_paid ?? 0) || 0;
    const productName = String(row?.bs_service_name || row?.bs_service_desc || "Unknown product").trim() || "Unknown product";

    if (!byProduct[productUid]) {
      byProduct[productUid] = {
        productUid,
        productName,
        unitsSold: 0,
        revenue: 0,
        bountyPaid: 0,
        sales: [],
      };
    }

    const bucket = byProduct[productUid];
    bucket.unitsSold += qty;
    bucket.revenue += unitCost * qty;
    bucket.bountyPaid += bountyPaid;
    if (bucket.productName === "Unknown product" && productName !== "Unknown product") {
      bucket.productName = productName;
    }
    bucket.sales.push(row);
  }

  return Object.values(byProduct)
    .map((product) => ({
      ...product,
      unitsSold: Math.max(0, product.unitsSold),
      sales: [...product.sales].sort((a, b) => (transactionDateMs(b) || 0) - (transactionDateMs(a) || 0)),
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName));
}

function findReceiptLineForProductSale(receiptLines, saleRow, productUid) {
  if (!Array.isArray(receiptLines)) return null;
  const tiUid = saleRow?.ti_uid != null ? String(saleRow.ti_uid).trim() : "";
  if (tiUid) {
    const byTiUid = receiptLines.find((line) => String(line?.ti_uid ?? "").trim() === tiUid);
    if (byTiUid) return byTiUid;
  }
  return receiptLines.find((line) => resolveProductUidFromSaleLine(line) === productUid) || null;
}

function getProductSaleChoiceEnrichment(receiptLine) {
  if (!receiptLine) return null;
  return enrichFromReceiptRow(receiptLine);
}

function formatProductSaleReceivedStatus(receiptLine, saleRow) {
  const purchasedQty = receiptLine ? getReceiptLineQty(receiptLine) : getSaleLineQty(saleRow);
  const receivedQty = receiptLine ? getPreviouslyReceivedQty(receiptLine) : Math.max(0, Math.round(parsePrice(saleRow?.ti_received_qty)));
  if (receivedQty >= purchasedQty) return "Yes";
  if (receivedQty > 0) return `${receivedQty}/${purchasedQty}`;
  return "No";
}

function formatProductSaleDeliveryStatus(saleRow, receiptLine) {
  if (orderNeedsShipping(saleRow) || (receiptLine && orderNeedsShipping(receiptLine))) {
    const progress = getOrderShippingProgress([saleRow, receiptLine].filter(Boolean));
    if (progress === "none" || progress === "unknown") return "Not Shipped";
    if (progress === "partial") return "Partial";
  }
  const inEscrow = saleRow?.transaction_in_escrow ?? saleRow?.in_escrow;
  if (Number(inEscrow) === 1) return "Pending";
  if (receiptLine) {
    const purchasedQty = getReceiptLineQty(receiptLine);
    const receivedQty = getPreviouslyReceivedQty(receiptLine);
    if (receivedQty >= purchasedQty) return "Complete";
  }
  return "Delivered";
}

function getProductSaleAmountCharged(saleRow, receiptLine) {
  const qty = receiptLine ? getReceiptLineQty(receiptLine) : getSaleLineQty(saleRow);
  const enrich = receiptLine ? getProductSaleChoiceEnrichment(receiptLine) : null;
  const unitPrice = receiptLine ? getReceiptLineUnitPrice(receiptLine, enrich) : getSaleLineUnitCost(saleRow);
  return unitPrice * qty;
}

function formatProductSaleShortDate(saleRow) {
  const date = parseTransactionDateTime(saleRow);
  if (!date) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function resolveListRowOrderUid(row) {
  // Parent purchase uid: return-request sale link, completed-return original, else self.
  const resolved = String(row?.trr_transaction_uid ?? row?.transaction_original_uid ?? row?.order_uid ?? row?.transaction_uid ?? "").trim();
  if (resolved) return resolved;
  if (isReturnListRow(row)) {
    console.error("Error: cannot resolve parent sale uid for return row", {
      transaction_uid: row?.transaction_uid,
      trr_uid: row?.trr_uid,
      trr_uids: row?.trr_uids,
      transaction_type: row?.transaction_type,
      parent_sale_resolve_error: row?.parent_sale_resolve_error,
    });
  }
  return "—";
}

function resolveSaleOrderUid(saleRow) {
  return resolveListRowOrderUid(saleRow);
}

/** True for reverse-txn returns and pending return request rows (is_pending_return). */
function isReturnListRow(row) {
  return Number(row?.is_return) === 1 || row?.is_pending_return === true || Number(row?.is_pending_return) === 1 || String(row?.transaction_type || "").toLowerCase() === "return";
}

/** Open return-request list rows — not ledger yet; must not affect sold counts. */
function isPendingReturnListRow(row) {
  return row?.is_pending_return === true || Number(row?.is_pending_return) === 1;
}

/**
 * Return-request uid for concurrent pending returns.
 * Prefer explicit trr_uid / trr_uids; do not treat transaction_uid as a trr.
 */
function resolveTrrUid(row) {
  if (!row || typeof row !== "object") return "";
  const explicit = String(row.trr_uid ?? row.pending_return?.trr_uid ?? "").trim();
  if (explicit && !explicit.startsWith("return-request-") && !explicit.startsWith("batch:")) return explicit;
  const fromList = Array.isArray(row.trr_uids) ? String(row.trr_uids[0] || "").trim() : "";
  if (fromList && !fromList.startsWith("return-request-") && !fromList.startsWith("batch:")) return fromList;
  const fromPendingList = Array.isArray(row.pending_return?.trr_uids) ? String(row.pending_return.trr_uids[0] || "").trim() : "";
  if (fromPendingList && !fromPendingList.startsWith("return-request-") && !fromPendingList.startsWith("batch:")) return fromPendingList;
  return "";
}

/** Concurrent pending returns: prefer pending_returns[], else singular pending_return. */
function getPendingReturnsList(row) {
  if (!row || typeof row !== "object") return [];
  if (Array.isArray(row.pending_returns) && row.pending_returns.length) {
    return row.pending_returns.filter((p) => p && typeof p === "object");
  }
  if (row.pending_return && typeof row.pending_return === "object") return [row.pending_return];
  return [];
}

/** Collect unique trr_uid values from rows / arrays / scalar ids (skip synthetic batch keys). */
function normalizeTrrUidList(...sources) {
  const out = [];
  const seen = new Set();
  const push = (id) => {
    const s = String(id || "").trim();
    if (!s || s.startsWith("return-request-") || s.startsWith("batch:")) return;
    if (seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  const walk = (src) => {
    if (src == null) return;
    if (Array.isArray(src)) {
      src.forEach(walk);
      return;
    }
    if (typeof src === "object") {
      push(src.trr_uid);
      push(src.trrUid);
      if (Array.isArray(src.trr_uids)) src.trr_uids.forEach(push);
      if (Array.isArray(src.trrUids)) src.trrUids.forEach(push);
      if (src.pending_return) walk(src.pending_return);
      return;
    }
    push(src);
  };
  sources.forEach(walk);
  return out;
}

function pendingMatchesTrrScope(pending, trrUidSet) {
  if (!pending || !trrUidSet?.size) return false;
  return normalizeTrrUidList(pending).some((id) => trrUidSet.has(id));
}

function completedReturnMatchesScope(ret, trrUidSet, returnTxnUid = "") {
  if (!ret || typeof ret !== "object") return false;
  const txn = String(ret.transaction_uid || "").trim();
  const wantTxn = String(returnTxnUid || "").trim();
  if (wantTxn && txn && txn === wantTxn) return true;
  if (!trrUidSet?.size) return false;
  return normalizeTrrUidList(ret, ret.linked_trr_uid, ret.return_request_uid, ret.request_uid).some((id) => trrUidSet.has(id));
}

/** Merge concurrent pending entries that belong to one list-row batch into one estimate/note/items object. */
function mergePendingReturnEstimates(pendings) {
  const list = (Array.isArray(pendings) ? pendings : []).filter((p) => p && typeof p === "object");
  if (!list.length) return null;
  if (list.length === 1) return list[0];

  let subtotal = 0;
  let taxes = 0;
  let shipping = 0;
  let fees = 0;
  let totalCredit = 0;
  let bounty = 0;
  const notes = [];
  const items = [];
  const trrUids = normalizeTrrUidList(list);
  for (const pending of list) {
    const est = pending.estimated_refund || {};
    subtotal += Math.abs(parseOrderMoneyField(est.subtotal) || 0);
    taxes += Math.abs(parseOrderMoneyField(est.taxes ?? est.transaction_taxes) || 0);
    shipping += Math.abs(parseOrderMoneyField(est.shipping_refund ?? est.returned_shipping ?? est.shipping) || 0);
    fees += Math.abs(parseOrderMoneyField(est.fees_allocated ?? est.fees) || 0);
    totalCredit += Math.abs(parseOrderMoneyField(est.total_customer_credit ?? est.total) || 0);
    bounty += Math.abs(parseOrderMoneyField(pending.bounty_to_reclaim) || 0);
    const note = String(pending.note || "").trim();
    if (note && !notes.includes(note)) notes.push(note);
    if (Array.isArray(pending.items)) items.push(...pending.items);
  }
  const computedTotal = Math.round((subtotal + taxes + shipping) * 100) / 100;
  return {
    ...list[0],
    trr_uid: trrUids[0] || list[0].trr_uid,
    trr_uids: trrUids,
    items,
    note: notes.join("\n") || list[0].note,
    bounty_to_reclaim: bounty || list[0].bounty_to_reclaim,
    estimated_refund: {
      ...(list[0].estimated_refund || {}),
      subtotal: subtotal || list[0].estimated_refund?.subtotal,
      taxes: taxes || list[0].estimated_refund?.taxes,
      shipping_refund: shipping || list[0].estimated_refund?.shipping_refund || list[0].estimated_refund?.shipping,
      fees_allocated: fees || list[0].estimated_refund?.fees_allocated,
      total_customer_credit: computedTotal || totalCredit || list[0].estimated_refund?.total_customer_credit,
      total: computedTotal || totalCredit || list[0].estimated_refund?.total,
    },
  };
}

/**
 * Scope order-detail return payload to the clicked return request / reverse txn.
 * Without scope keys, returns empty matched sets (caller may fall back to order-wide).
 */
function resolveScopedReturnDetail(orderDetail, { trrUids = [], trrUid = null, returnTxnUid = null } = {}) {
  const scopedTrrUids = normalizeTrrUidList(trrUids, trrUid);
  const trrUidSet = new Set(scopedTrrUids);
  const wantReturnTxn = String(returnTxnUid || "").trim();
  const hasScope = trrUidSet.size > 0 || !!wantReturnTxn;
  if (!hasScope) {
    return { hasScope: false, trrUids: [], trrUidSet, matchedPendings: [], matchedReturns: [], scopedPending: null };
  }

  const sale = orderDetail?.sale || null;
  const pendingCandidates = [];
  const seenPending = new Set();
  for (const pending of [...getPendingReturnsList(orderDetail), ...getPendingReturnsList(sale)]) {
    if (!pendingMatchesTrrScope(pending, trrUidSet)) continue;
    const key = String(pending.trr_uid || normalizeTrrUidList(pending).join(",") || JSON.stringify(pending.items || [])).trim();
    if (seenPending.has(key)) continue;
    seenPending.add(key);
    pendingCandidates.push(pending);
  }

  const allReturns = Array.isArray(orderDetail?.returns) ? orderDetail.returns : [];
  const matchedReturns = allReturns.filter((ret) => completedReturnMatchesScope(ret, trrUidSet, wantReturnTxn));

  return {
    hasScope: true,
    trrUids: scopedTrrUids,
    trrUidSet,
    matchedPendings: pendingCandidates,
    matchedReturns,
    scopedPending: mergePendingReturnEstimates(pendingCandidates),
  };
}

/** Flatten return-line stubs across concurrent pending returns. */
function collectItemsFromPendingReturns(row) {
  const items = [];
  for (const pending of getPendingReturnsList(row)) {
    if (Array.isArray(pending?.items) && pending.items.length) items.push(...pending.items);
  }
  if (!items.length && Array.isArray(row?.transaction_return_items)) {
    items.push(...row.transaction_return_items);
  }
  return items;
}

function resolvePendingReturnEntryMoney(pending) {
  if (!pending || typeof pending !== "object") return { total: 0, bountyPaid: 0 };
  const est = pending.estimated_refund || {};
  const subtotal = Math.abs(parseOrderMoneyField(est.subtotal) || 0);
  const taxes = Math.abs(parseOrderMoneyField(est.taxes ?? est.transaction_taxes) || 0);
  const shipping = Math.abs(parseOrderMoneyField(est.shipping_refund ?? est.returned_shipping ?? est.shipping) || 0);
  const fromComponents = Math.round((subtotal + taxes + shipping) * 100) / 100;
  const credit = parseFloat(est.total_customer_credit ?? est.total ?? pending.estimated_total ?? pending.total_customer_credit ?? pending.total ?? NaN);
  let total = 0;
  if (fromComponents > 0.01) {
    total = -fromComponents;
  } else if (Number.isFinite(credit) && credit !== 0) {
    total = -Math.abs(credit);
  }
  const bounty = parseFloat(pending.bounty_to_reclaim ?? NaN);
  return {
    total,
    bountyPaid: Number.isFinite(bounty) && bounty !== 0 ? -Math.abs(bounty) : 0,
  };
}

/**
 * Seller confirm note selects which Stripe account (IO-Payments business_code) to refund on.
 * Test codes (ECTEST / PMTEST) must match the account used at purchase; anything else → EC / PM live.
 */
function resolveRefundBusinessCode(sellerNote) {
  const n = String(sellerNote || "")
    .trim()
    .toUpperCase();
  if (n === "ECTEST" || n === "PMTEST") return n;
  if (n === "EC" || n === "PM") return n;
  // Default live (createPaymentIntent uses ECTEST in dev; live purchases use EC)
  return "EC";
}

/**
 * Split a return credit between wallet restore and Stripe card refund.
 * Uses estimated_refund.wallet_refund / stripe_refund when present; otherwise
 * derives from sale.transaction_wallet_amount vs transaction_total.
 */
function splitReturnRefundByPaymentMethod(sale, refundGrand, estimatedRefund = null) {
  const totalCredit = Math.max(0, Math.abs(Number(refundGrand) || 0));
  const est = estimatedRefund && typeof estimatedRefund === "object" ? estimatedRefund : null;
  if (est && (est.wallet_refund != null || est.stripe_refund != null)) {
    const walletRefund = Math.max(0, Math.abs(Number(est.wallet_refund) || 0));
    const stripeFromEst = est.stripe_refund != null ? Math.abs(Number(est.stripe_refund) || 0) : Math.max(0, totalCredit - walletRefund);
    return {
      walletRefund: Math.round(walletRefund * 100) / 100,
      stripeRefund: Math.round(Math.max(0, stripeFromEst) * 100) / 100,
    };
  }
  const orderTotal = Math.abs(Number(sale?.transaction_total) || 0);
  const walletPaid = Math.abs(Number(sale?.transaction_wallet_amount) || 0);
  if (!(orderTotal > 0) || !(walletPaid > 0) || !(totalCredit > 0)) {
    return { walletRefund: 0, stripeRefund: Math.round(totalCredit * 100) / 100 };
  }
  const cappedWallet = Math.min(walletPaid, orderTotal);
  const walletRatio = cappedWallet / orderTotal;
  const walletRefund = Math.round(totalCredit * walletRatio * 100) / 100;
  const stripeRefund = Math.round(Math.max(0, totalCredit - walletRefund) * 100) / 100;
  return { walletRefund, stripeRefund };
}

/**
 * POST createRefund on IO-Payments — same shape as createPaymentIntent, plus payment_intent.
 * Caller is responsible for using the same business_code family as the original charge.
 */
async function createStripeRefund({ customerUid, businessCode, paymentIntent, refundAmount, tax = 0, metadata = null }) {
  const total = Number(refundAmount);
  if (!customerUid) throw new Error("customer_uid is required for refund");
  if (!paymentIntent) throw new Error("payment_intent is required for refund");
  if (!Number.isFinite(total) || total <= 0) throw new Error("Invalid refund amount");

  const requestBody = {
    customer_uid: customerUid,
    business_code: businessCode || "EC",
    payment_intent: String(paymentIntent).split("_secret_")[0],
    payment_summary: {
      tax: parseFloat(Number(tax || 0).toFixed(2)),
      total: Number(total).toFixed(2),
    },
  };
  if (metadata && typeof metadata === "object") {
    requestBody.metadata = metadata;
  }

  console.log("============================================");
  console.log("ENDPOINT: CREATE_REFUND");
  console.log("URL:", CREATE_REFUND_ENDPOINT);
  console.log("METHOD: POST");
  console.log("REQUEST BODY:", JSON.stringify(requestBody, null, 2));
  console.log("============================================");

  const response = await fetch(CREATE_REFUND_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  console.log("RESPONSE STATUS:", response.status);
  console.log("RESPONSE OK:", response.ok);

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }
  console.log("RESPONSE BODY:", JSON.stringify(data, null, 2));

  if (!response.ok) {
    const message = (data && typeof data === "object" && (data.error || data.message)) || `Refund request failed (HTTP ${response.status})`;
    return {
      ok: false,
      skipped: false,
      refund_id: null,
      message: String(message),
      stripe_response: data,
      http_status: response.status,
    };
  }

  const refundId = (typeof data === "string" && data.startsWith("re_") ? data : null) || data?.id || data?.refund_id || data?.refund?.id || null;

  return {
    ok: true,
    skipped: false,
    refund_id: refundId,
    message: data?.message || "Refund created",
    stripe_response: data,
    http_status: response.status,
  };
}

/**
 * Normalize backend return/refund pair (plus legacy accepted/declined values).
 * return_status: returning | returned | cancelled
 * refund_status: pending | refunded | rejected | stripe_fail
 *   - rejected     = seller declined before receipt (Returning - Rejected)
 *   - stripe_fail  = return confirmed but Stripe refund failed/skipped (Returned - Stripe Fail)
 *     Backend often still sends Returned - Rejected for Stripe failures; we remap those here.
 *   - cancelled    = pre-shipment cancel (no physical return); refund side still applies
 */
function extractReturnRefundState(source = {}, override = {}) {
  const pick = (...vals) => {
    for (const v of vals) {
      if (v == null || v === "") continue;
      return String(v).trim().toLowerCase();
    }
    return "";
  };

  let returnStatus = pick(override.return_status, override.returnStatus, typeof override === "string" ? override : null, source.return_status, source.transaction_return_status);
  let refundStatus = pick(override.refund_status, override.refundStatus, source.refund_status, source.transaction_refund_status);
  let displayStatus = String(override.display_status ?? source.display_status ?? "").trim();

  // Explicit cancel-before-ship signals from API / FE.
  const cancelSignal =
    override.cancel_unshipped === true ||
    override.cancel_unshipped === 1 ||
    override.is_cancel_before_ship === true ||
    source.is_cancel_before_ship === true ||
    source.cancel_unshipped === true ||
    Number(source.cancel_unshipped) === 1 ||
    source.pre_ship_cancel === true ||
    Number(source.pre_ship_cancel) === 1 ||
    returnStatus === "cancelled" ||
    returnStatus === "canceled" ||
    /^cancell?ed\s*[-–]/i.test(displayStatus);

  // If the list/API row itself says CC Issue / stripe_fail, don't let a stale cache "refunded" win.
  const sourceRefund = pick(source.refund_status, source.transaction_refund_status);
  const sourceDisplay = String(source.display_status || "").trim();
  if (sourceRefund === "stripe_fail" || sourceRefund === "stripe_failed" || /(?:returned|cancell?ed)\s*[-–]\s*(cc\s*issue|stripe\s*fail|stripe_fail|stripe_failed)/i.test(sourceDisplay)) {
    refundStatus = "stripe_fail";
    returnStatus = pick(source.return_status, source.transaction_return_status) || (cancelSignal ? "cancelled" : "returned");
    if (sourceDisplay) displayStatus = sourceDisplay;
  }

  const returnDisplayMatch = displayStatus.match(/^(returning|returned|cancell?ed)\s*[-–]\s*(pending|refunded|rejected|stripe\s*fail|stripe_fail|stripe_failed|cc\s*issue)$/i);
  if (returnDisplayMatch) {
    if (!returnStatus) {
      const word = returnDisplayMatch[1].toLowerCase();
      returnStatus = word.startsWith("cancel") ? "cancelled" : word;
    }
    if (!refundStatus) {
      const received = returnDisplayMatch[2].toLowerCase().replace(/\s+/g, "_");
      refundStatus = received === "stripe_fail" || received === "stripe_failed" || received === "cc_issue" ? "stripe_fail" : received;
    }
  }

  if (returnStatus === "canceled") returnStatus = "cancelled";
  // Pre-ship cancel: prefer cancelled unless this is an explicit Returning-Rejected decline.
  if (cancelSignal && !(returnStatus === "returning" && refundStatus === "rejected")) {
    returnStatus = "cancelled";
  }

  const explicitReturnSignal =
    override.returnRequested === true ||
    override.returnRequested === 1 ||
    Number(source.transaction_return_requested) === 1 ||
    isReturnListRow(source) ||
    !!returnDisplayMatch ||
    returnStatus === "returning" ||
    returnStatus === "returned" ||
    returnStatus === "cancelled" ||
    cancelSignal;

  // Legacy single-field values from older FE / AsyncStorage.
  // Only remap order-lifecycle words (completed/accepted/etc.) when this is actually a return.
  if (explicitReturnSignal || returnStatus === "returning" || returnStatus === "returned" || returnStatus === "cancelled") {
    if (returnStatus === "accepted") {
      returnStatus = "returned";
      if (!refundStatus || refundStatus === "accepted") refundStatus = "refunded";
    } else if (returnStatus === "declined") {
      refundStatus = refundStatus || "rejected";
      // Decline before receipt → Returning - Rejected
      returnStatus = "returning";
    } else if (returnStatus === "resolved" || returnStatus === "completed") {
      returnStatus = cancelSignal ? "cancelled" : "returned";
      refundStatus = refundStatus || "refunded";
    } else if (returnStatus === "rejected" && !refundStatus) {
      refundStatus = "rejected";
      returnStatus = "returning";
    }
  } else if (["accepted", "declined", "resolved", "completed", "rejected"].includes(returnStatus)) {
    // Sale/order rows sometimes carry lifecycle statuses in return_status fields — ignore them.
    returnStatus = "";
  }

  if (refundStatus === "declined") refundStatus = "rejected";
  if (refundStatus === "accepted") refundStatus = "refunded";

  const isKnownReturnStatus = returnStatus === "returning" || returnStatus === "returned" || returnStatus === "cancelled";
  const isKnownRefundStatus = refundStatus === "pending" || refundStatus === "refunded" || refundStatus === "rejected" || refundStatus === "stripe_fail";

  // Do NOT treat an arbitrary display_status (or unknown status strings) as a return.
  // That was falsely marking Business Purchases as Returned when no return was requested.
  const returnRequested =
    override.returnRequested === true ||
    override.returnRequested === 1 ||
    Number(source.transaction_return_requested) === 1 ||
    isReturnListRow(source) ||
    !!returnDisplayMatch ||
    isKnownReturnStatus ||
    cancelSignal ||
    (isKnownRefundStatus && isKnownReturnStatus);

  const stripeRefund = override.stripe_refund || source.stripe_refund || null;
  const stripeRefundFailed = stripeRefund && typeof stripeRefund === "object" && (stripeRefund.ok === false || stripeRefund.skipped === true);
  const displayIndicatesStripeFail =
    /(?:returned|cancell?ed)\s*[-–]\s*(cc\s*issue|stripe\s*fail|stripe_fail|stripe_failed)/i.test(String(displayStatus || "")) ||
    (returnDisplayMatch &&
      ["stripe_fail", "stripe_failed", "cc_issue"].includes(
        String(returnDisplayMatch[2] || "")
          .toLowerCase()
          .replace(/\s+/g, "_"),
      ));

  // Returned/Cancelled + rejected / stripe_refund fail / display_status CC Issue = Stripe fail (not a completed refund).
  // Prefer these signals over a stale refund_status=refunded (common on buyer list rows).
  if (
    refundStatus === "stripe_fail" ||
    refundStatus === "stripe_failed" ||
    ((returnStatus === "returned" || returnStatus === "cancelled") && refundStatus === "rejected") ||
    ((returnStatus === "returned" || returnStatus === "cancelled") && stripeRefundFailed) ||
    displayIndicatesStripeFail ||
    stripeRefundFailed
  ) {
    returnStatus = returnStatus === "cancelled" || cancelSignal ? "cancelled" : "returned";
    refundStatus = "stripe_fail";
  }

  if (!displayStatus && returnStatus && refundStatus) {
    const deliveredWord = returnStatus === "cancelled" ? "Cancelled" : returnStatus === "returned" ? "Returned" : "Returning";
    const receivedWord = refundStatus === "refunded" ? "Refunded" : refundStatus === "stripe_fail" ? "CC Issue" : refundStatus === "rejected" ? "Rejected" : "Pending";
    displayStatus = `${deliveredWord} - ${receivedWord}`;
  } else if (displayStatus) {
    // Normalize API "Returned - Rejected" / "Stripe Fail" (post-confirm Stripe fail) for chips.
    displayStatus = displayStatus
      .replace(/Returned\s*[-–]\s*Rejected/i, "Returned - CC Issue")
      .replace(/Returned\s*[-–]\s*Stripe\s*Fail/i, "Returned - CC Issue")
      .replace(/Cancell?ed\s*[-–]\s*Rejected/i, "Cancelled - CC Issue")
      .replace(/Cancell?ed\s*[-–]\s*Stripe\s*Fail/i, "Cancelled - CC Issue");
  }
  if (refundStatus === "stripe_fail") {
    displayStatus = returnStatus === "cancelled" ? "Cancelled - CC Issue" : "Returned - CC Issue";
  }

  return {
    return_status: returnStatus,
    refund_status: refundStatus,
    display_status: displayStatus,
    active: returnRequested,
    is_cancel_before_ship: returnStatus === "cancelled" || !!cancelSignal,
  };
}

/**
 * Delivered / Received chips for returns.
 * Canonical:
 *   Returning - Pending
 *   Returned  - Pending
 *   Returned  - Refunded
 *   Returned  - CC Issue     (confirm ok, Stripe refund failed/skipped)
 *   Returning - Rejected     (seller rejects before receiving)
 *   Cancelled - Pending|Refunded|CC Issue  (pre-shipment cancel; no physical return)
 */
function resolveReturnLogisticsLabels(row, override = {}) {
  if (!row || typeof row !== "object") return null;
  const saleSibling = override.saleSibling || override.sale || null;
  const inferredCancel = isPreShipCancelReturn(row, saleSibling);
  const state = extractReturnRefundState(row, {
    ...override,
    ...(inferredCancel ? { cancel_unshipped: true } : {}),
  });
  if (!state.active) return null;

  const isReturnTxn = isReturnListRow(row);
  let returnStatus = state.return_status;
  let refundStatus = state.refund_status;

  // Return txn rows without status fields are post-confirm refunds.
  // Do not guess "refunded" when stripe fail signals are present on the row.
  if (isReturnTxn && !returnStatus) {
    returnStatus = inferredCancel || state.is_cancel_before_ship ? "cancelled" : "returned";
    if (!refundStatus) {
      const stripeRefund = row.stripe_refund;
      const stripeRefundFailed = stripeRefund && typeof stripeRefund === "object" && (stripeRefund.ok === false || stripeRefund.skipped === true);
      const displayFail = /cc\s*issue|stripe\s*fail|stripe_fail|stripe_failed/i.test(String(row.display_status || state.display_status || ""));
      if (stripeRefundFailed || displayFail) refundStatus = "stripe_fail";
      else refundStatus = Number(row.transaction_in_escrow ?? row.in_escrow) === 1 ? "pending" : "refunded";
    }
  }
  if (!returnStatus) returnStatus = inferredCancel ? "cancelled" : "returning";
  if (!refundStatus) refundStatus = "pending";

  // Stripe fail: item received (returned) but refund rejected/failed.
  if (refundStatus === "stripe_fail" || refundStatus === "stripe_failed" || (returnStatus === "returned" && refundStatus === "rejected")) {
    refundStatus = "stripe_fail";
  }

  // Stale cancel flags after the order was fully shipped/verified: show Returning instead.
  // Keep Cancelled when the sale still has unshipped units (hybrid cancel-before-ship).
  if (returnStatus === "cancelled" && saleSibling && !isReturnListRow(saleSibling)) {
    const unshippedLeft = parseInt(saleSibling.unshipped_item_count ?? saleSibling.unshipped_count ?? saleSibling.open_shipping_count, 10);
    const fullyShipped = isTruthyShippingFlag(saleSibling.all_items_shipped) || (Number.isFinite(unshippedLeft) && unshippedLeft <= 0 && saleHasLeftSellerEvidence(saleSibling));
    if (fullyShipped) {
      returnStatus = isReturnTxn && refundStatus !== "pending" ? "returned" : "returning";
    }
  }

  const delivered = returnStatus === "cancelled" ? "Cancelled" : returnStatus === "returned" ? "Returned" : "Returning";
  const received = refundStatus === "refunded" ? "Refunded" : refundStatus === "stripe_fail" ? "CC Issue" : refundStatus === "rejected" ? "Rejected" : "Pending";

  return {
    delivered,
    received,
    return_status: returnStatus,
    refund_status: refundStatus,
    display_status: `${delivered} - ${received}`,
    is_cancel_before_ship: returnStatus === "cancelled",
  };
}

/** Sale-level evidence that inventory already shipped and/or was buyer-verified. */
function saleHasLeftSellerEvidence(sale) {
  if (!sale || typeof sale !== "object" || isReturnListRow(sale)) return false;
  if (isTruthyShippingFlag(sale.all_items_shipped)) return true;
  const shippedCount = parseInt(sale.shipped_item_count ?? sale.shipped_count ?? sale.items_shipped, 10);
  if (Number.isFinite(shippedCount) && shippedCount > 0) return true;
  const receivedUnits = parseInt(sale.received_units ?? sale.received_units_total ?? sale.received_item_count ?? sale.delivered_item_count ?? sale.ti_received_qty, 10);
  if (Number.isFinite(receivedUnits) && receivedUnits > 0) return true;
  const saleFs = String(sale.fulfillment_status || sale.shipping_status || sale.order_fulfillment_status || sale.transaction_fulfillment_status || "")
    .trim()
    .toLowerCase();
  if (SHIPPED_FULFILLMENT_STATUSES.has(saleFs) || saleFs === "complete" || saleFs === "partial" || saleFs === "partially_shipped" || saleFs === "received" || saleFs === "paid") {
    return true;
  }
  const saleLines = Array.isArray(sale.lines) ? sale.lines : Array.isArray(sale.items) ? sale.items : null;
  if (saleLines && saleLines.some((line) => lineHasLeftSeller(line))) return true;
  return false;
}

/** True when a line has already shipped and/or been buyer-verified (not eligible for pre-ship cancel). */
function lineHasLeftSeller(line) {
  if (!line || typeof line !== "object") return false;
  if (getLineShippedQty(line) > 0) return true;
  if (getPreviouslyReceivedQty(line) > 0) return true;
  const status = getLineFulfillmentStatus(line);
  return SHIPPED_FULFILLMENT_STATUSES.has(status) || status === "complete" || status === "partial" || status === "partially_shipped" || status === "received" || status === "paid";
}

/** True when this return/cancel targets inventory that has not shipped yet. */
function isPreShipCancelReturn(row, saleSibling = null) {
  if (!row || typeof row !== "object") return false;
  const status = String(row.return_status || row.transaction_return_status || "")
    .trim()
    .toLowerCase();
  // Explicit physical-return statuses must never be remapped to Cancelled.
  if (status === "returning" || status === "returned") return false;
  if (/^returning\s*[-–]/i.test(String(row.display_status || ""))) return false;
  if (/^returned\s*[-–]/i.test(String(row.display_status || ""))) return false;

  if (status === "cancelled" || status === "canceled") return true;
  if (row.is_cancel_before_ship === true || Number(row.is_cancel_before_ship) === 1) return true;
  if (row.cancel_unshipped === true || Number(row.cancel_unshipped) === 1) return true;
  if (row.pre_ship_cancel === true || Number(row.pre_ship_cancel) === 1) return true;
  if (/^cancell?ed\s*[-–]/i.test(String(row.display_status || ""))) return true;

  const sale = saleSibling && typeof saleSibling === "object" && !isReturnListRow(saleSibling) ? saleSibling : null;
  if (!sale) return false;

  // Do not infer a pre-ship cancel once the sale has clear ship/receive evidence.
  if (saleHasLeftSellerEvidence(sale)) return false;

  const shippedCount = parseInt(sale.shipped_item_count ?? sale.shipped_count ?? sale.items_shipped, 10);
  const shippableCount = parseInt(sale.shippable_item_count ?? sale.unshipped_item_count, 10);
  // Only infer pre-ship cancel when we positively know nothing has shipped yet.
  if (Number.isFinite(shippedCount) && shippedCount === 0) {
    if ((Number.isFinite(shippableCount) && shippableCount > 0) || orderNeedsShipping(sale) || !!extractShippingAddress(sale)) {
      return true;
    }
    const fs = String(sale.fulfillment_status || sale.shipping_status || "")
      .trim()
      .toLowerCase();
    if (["not_shipped", "pending_shipment", "awaiting_shipment", "unfulfilled", "ready_to_ship"].includes(fs)) return true;
  }
  return false;
}

/**
 * Given order-detail sale lines + return lines, true when every returned unit
 * maps to an original sale line that still has shipped_qty === 0.
 */
function areScopedReturnItemsUnshipped(orderDetail, returnLines) {
  const saleLines = Array.isArray(orderDetail?.sale?.lines) ? orderDetail.sale.lines : [];
  const lines = Array.isArray(returnLines) ? returnLines : [];
  if (!saleLines.length || !lines.length) return false;
  let matched = 0;
  for (const retLine of lines) {
    const originalTi = String(retLine?.ti_original_ti_uid || retLine?.transaction_item_uid || retLine?.ti_uid || "").trim();
    if (!originalTi) continue;
    const saleLine = saleLines.find((line) => String(line?.ti_uid || line?.transaction_item_uid || "").trim() === originalTi);
    if (!saleLine) continue;
    matched += 1;
    if (lineHasLeftSeller(saleLine)) return false;
  }
  return matched > 0;
}

/** Ship / pickup / virtual from checkout snapshot (ti_fulfillment_method). */
function getLineFulfillmentMethod(line) {
  return String(line?.ti_fulfillment_method || line?.fulfillment_method || "")
    .trim()
    .toLowerCase();
}

/** True when the line was purchased for ship fulfillment (not pickup/virtual). */
function lineWasPurchasedForShipping(line) {
  if (!line || typeof line !== "object") return false;
  const method = getLineFulfillmentMethod(line);
  if (method === "pickup" || method === "virtual") return false;
  if (method === "ship") return true;
  if (NOT_REQUIRED_FULFILLMENT_STATUSES.has(getLineFulfillmentStatus(line))) return false;
  return lineRequiresShipping(line);
}

/**
 * True when return lines include units that were purchased for shipping
 * and have not left the seller yet (pre-ship cancel, not pickup/virtual).
 */
function returnIncludesUnshippedShippableUnits(orderDetail, returnLines) {
  const saleLines = Array.isArray(orderDetail?.sale?.lines) ? orderDetail.sale.lines : [];
  const lines = Array.isArray(returnLines) ? returnLines : [];
  if (!lines.length) return false;

  for (const retLine of lines) {
    const originalTi = String(retLine?.ti_original_ti_uid || retLine?.transaction_item_uid || retLine?.ti_uid || "").trim();
    const saleLine = (originalTi && saleLines.find((line) => String(line?.ti_uid || line?.transaction_item_uid || "").trim() === originalTi)) || retLine;
    if (!lineWasPurchasedForShipping(saleLine)) continue;
    if (lineHasLeftSeller(saleLine)) continue;
    return true;
  }
  return false;
}

function getReturnStatusOverrideFromCache(returnStatusesByKey, ...keys) {
  if (!returnStatusesByKey) return {};
  for (const key of keys) {
    const k = String(key || "").trim();
    if (!k) continue;
    const cached = returnStatusesByKey[k];
    if (cached == null || cached === "") continue;
    if (typeof cached === "object") return cached;
    return { return_status: cached, transaction_return_status: cached };
  }
  return {};
}

/**
 * Status cache lookup for a list row.
 * Return rows must prefer trr_uid / return txn uid — never inherit a sibling return's
 * order-level cached "refunded"/"pending" status when concurrent returns share an order_uid.
 */
function getReturnStatusOverrideForRow(returnStatusesByKey, row, orderUid, listTransactionUid) {
  const trrUid = resolveTrrUid(row);
  const isPendingReturnRow = row?.is_pending_return === true || Number(row?.is_pending_return) === 1 || String(row?.transaction_uid || "").startsWith("return-request-");
  if (isReturnListRow(row) || trrUid) {
    return getReturnStatusOverrideFromCache(
      returnStatusesByKey,
      trrUid,
      listTransactionUid,
      row?.transaction_uid,
      // Legacy single pending return may use order_uid; completed reverse txns must not.
      isPendingReturnRow && !trrUid ? orderUid : null,
    );
  }
  return getReturnStatusOverrideFromCache(returnStatusesByKey, orderUid, listTransactionUid);
}

function applyReturnRefundFieldsToRow(row, state) {
  if (!row || !state) return row;
  return {
    ...row,
    transaction_return_requested: 1,
    return_status: state.return_status,
    refund_status: state.refund_status,
    display_status: state.display_status,
    transaction_return_status: state.return_status,
    transaction_refund_status: state.refund_status,
  };
}

/** True when a list row should receive a confirm/decline status patch for these keys. */
function rowMatchesReturnStatusKeys(row, statusKeys, { scopeTrrUid = null, scopeReturnTxnUid = null } = {}) {
  if (!row || !Array.isArray(statusKeys) || !statusKeys.length) return false;
  const uid = String(row.transaction_uid || "").trim();
  const orderUid = resolveListRowOrderUid(row);
  const originalUid = String(row.original_transaction_uid || "").trim();
  const rowTrrs = normalizeTrrUidList(row);
  const rowTrr = rowTrrs[0] || resolveTrrUid(row);
  const scopeTrr = String(scopeTrrUid || "").trim();
  const scopeReturnTxn = String(scopeReturnTxnUid || "").trim();

  // Concurrent returns: only the matching pending request / reverse txn.
  if (scopeTrr || scopeReturnTxn) {
    if (scopeTrr && rowTrrs.some((id) => id === scopeTrr || statusKeys.includes(id))) return true;
    if (scopeReturnTxn && uid && uid === scopeReturnTxn) return true;
    if (scopeTrr && rowTrr && statusKeys.includes(rowTrr)) return true;
    if (scopeReturnTxn && statusKeys.includes(uid)) return true;
    return false;
  }

  return statusKeys.includes(uid) || statusKeys.includes(orderUid) || (originalUid && statusKeys.includes(originalUid)) || rowTrrs.some((id) => statusKeys.includes(id));
}

/** Order UIDs that need return/refund chip hydration from order_list_hydration (buyer PURCHASES). */
function collectOrderUidsNeedingReturnStatusHydration(purchaseRows) {
  const uids = new Set();
  if (!Array.isArray(purchaseRows)) return [];
  for (const row of purchaseRows) {
    if (!row || typeof row !== "object") continue;
    const hasReturn =
      isReturnListRow(row) ||
      Number(row.transaction_return_requested) === 1 ||
      row.return_status ||
      row.refund_status ||
      row.transaction_return_status ||
      row.transaction_refund_status ||
      row.display_status ||
      row.pending_return ||
      row.stripe_refund;
    if (!hasReturn) continue;
    const orderUid = resolveListRowOrderUid(row);
    if (orderUid && orderUid !== "—") uids.add(orderUid);
  }
  return [...uids];
}

/** Buyer PURCHASES: shipped orders whose received totals are missing or incomplete on the list row. */
function collectOrderUidsNeedingBuyerPurchaseReceivedHydration(purchaseRows) {
  const uids = new Set();
  for (const row of purchaseRows || []) {
    if (isReturnListRow(row)) continue;
    if (!orderNeedsShipping(row)) continue;
    const orderUid = resolveListRowOrderUid(row);
    if (!orderUid || orderUid === "—") continue;
    if (getOrderReceivedStatusFromSaleRows([row]) === "Yes") continue;
    const progress = getOrderShippingProgress([row]);
    if (progress !== "partial" && progress !== "complete") continue;
    uids.add(orderUid);
  }
  return [...uids];
}

/** Personal PURCHASES: order UIDs needing order_list_hydration (return chips + shipping + received). */
function collectOrderUidsNeedingPersonalPurchaseHydration(purchaseRows) {
  return [
    ...new Set([
      ...collectOrderUidsNeedingReturnStatusHydration(purchaseRows),
      ...collectOrderUidsNeedingShippingProgressHydration(purchaseRows),
      ...collectOrderUidsNeedingBuyerPurchaseReceivedHydration(purchaseRows),
    ]),
  ];
}

/** Top-level map from GET account-screen/personal|business. */
function extractOrderListHydrationMap(json) {
  const root = json && typeof json === "object" ? json : {};
  const map = root.order_list_hydration;
  return map && typeof map === "object" && !Array.isArray(map) ? map : null;
}

/** order_list_hydration entries use the same field names as order detail (sale, returns, pending_returns, …). */
function normalizeListHydrationAsOrderDetail(entry, orderUid) {
  if (!entry || typeof entry !== "object") return null;
  const normalized = { ...entry };
  if (!normalized.order_uid && orderUid) normalized.order_uid = orderUid;
  if (normalized.sale == null && (normalized.transaction_uid || normalized.lines)) {
    normalized.sale = normalized;
  }
  return normalized;
}

function buildPersonalPurchaseHydrationResult(orderUid, orderDetail) {
  return {
    orderUid,
    orderDetail,
    hydrated: extractReturnRefundStateFromOrderDetail(orderDetail),
    itemHydration: extractReturnItemHydrationFromOrderDetail(orderDetail),
    progress: getOrderShippingProgress([orderDetail?.sale || orderDetail].filter(Boolean)),
    receivedSummary: summarizeReceivedUnitsFromOrderDetail(orderDetail),
    shippingSummary: summarizeShippedUnitsFromOrderDetail(orderDetail),
  };
}

function foldPersonalPurchaseHydrationResults(results) {
  const stateByOrderUid = {};
  const itemHydrationByOrderUid = {};
  const statusPatch = {};
  const hydratedShipping = {};
  const hydratedReceivedByOrder = {};
  const hydratedShippedByOrder = {};
  for (const { orderUid, orderDetail, hydrated, itemHydration, progress, receivedSummary, shippingSummary } of results) {
    if (itemHydration) itemHydrationByOrderUid[orderUid] = itemHydration;
    if (hydrated) {
      stateByOrderUid[orderUid] = hydrated;
      const payload = {
        return_status: hydrated.return_status,
        refund_status: hydrated.refund_status,
        display_status: hydrated.display_status,
      };
      statusPatch[orderUid] = payload;
      if (hydrated.saleTxnUid && hydrated.saleTxnUid !== orderUid) {
        statusPatch[hydrated.saleTxnUid] = payload;
      }
      const completedPayload =
        hydrated.refund_status === "stripe_fail"
          ? payload
          : {
              return_status: "returned",
              refund_status: "refunded",
              display_status: "Returned - Refunded",
            };
      for (const returnTxnUid of hydrated.returnTxnUids || []) {
        if (returnTxnUid && returnTxnUid !== orderUid && returnTxnUid !== hydrated.saleTxnUid) {
          statusPatch[returnTxnUid] = completedPayload;
        }
      }
    }
    if (progress === "complete" || progress === "partial" || progress === "none") {
      hydratedShipping[orderUid] = progress;
      const txnUid = String(orderDetail?.sale?.transaction_uid || orderDetail?.transaction_uid || "").trim();
      if (txnUid) hydratedShipping[txnUid] = progress;
    }
    if (receivedSummary) {
      hydratedReceivedByOrder[orderUid] = receivedSummary;
      const txnUid = String(orderDetail?.sale?.transaction_uid || orderDetail?.transaction_uid || "").trim();
      if (txnUid) hydratedReceivedByOrder[txnUid] = receivedSummary;
    }
    if (shippingSummary) {
      hydratedShippedByOrder[orderUid] = shippingSummary;
      const txnUid = String(orderDetail?.sale?.transaction_uid || orderDetail?.transaction_uid || "").trim();
      if (txnUid) hydratedShippedByOrder[txnUid] = shippingSummary;
    }
  }
  return { stateByOrderUid, itemHydrationByOrderUid, statusPatch, hydratedShipping, hydratedReceivedByOrder, hydratedShippedByOrder };
}

async function applyPersonalPurchaseHydrationPatches(normalizedPurchases, folded, { setReturnStatuses, setOrderShippingProgressByKey }) {
  let nextRows = normalizedPurchases;
  const { stateByOrderUid, itemHydrationByOrderUid, statusPatch, hydratedShipping, hydratedReceivedByOrder, hydratedShippedByOrder } = folded;
  if (Object.keys(stateByOrderUid).length || Object.keys(itemHydrationByOrderUid).length) {
    nextRows = applyHydratedReturnStateToPurchaseRows(nextRows, stateByOrderUid, itemHydrationByOrderUid);
    if (Object.keys(statusPatch).length) {
      setReturnStatuses((prev) => ({ ...prev, ...statusPatch }));
      await Promise.all(Object.keys(statusPatch).map((key) => AsyncStorage.setItem(`return_status_${key}`, JSON.stringify(statusPatch[key]))));
    }
  }
  if (Object.keys(hydratedShipping).length || Object.keys(hydratedReceivedByOrder || {}).length || Object.keys(hydratedShippedByOrder || {}).length) {
    if (Object.keys(hydratedShipping).length) {
      setOrderShippingProgressByKey((prev) => ({ ...prev, ...hydratedShipping }));
    }
    nextRows = nextRows.map((row) => {
      if (isReturnListRow(row)) return row;
      const orderUid = resolveListRowOrderUid(row);
      const txnUid = String(row.transaction_uid || "").trim();
      const progress = hydratedShipping[orderUid] || hydratedShipping[txnUid];
      const receivedSummary = hydratedReceivedByOrder?.[orderUid] || hydratedReceivedByOrder?.[txnUid];
      const shippingSummary = hydratedShippedByOrder?.[orderUid] || hydratedShippedByOrder?.[txnUid];
      let next = row;
      if (progress === "complete") {
        next = { ...next, fulfillment_status: "in_transit", all_items_shipped: 1, unshipped_item_count: 0 };
      } else if (progress === "partial") {
        next = { ...next, fulfillment_status: "partial", all_items_shipped: 0 };
      } else if (progress === "none") {
        next = { ...next, fulfillment_status: "not_shipped", all_items_shipped: 0 };
      }
      if (receivedSummary) {
        next = {
          ...next,
          received_units: receivedSummary.received,
          purchased_units: receivedSummary.purchased,
          received_item_count: receivedSummary.received,
        };
      }
      if (shippingSummary) {
        next = {
          ...next,
          shipped_item_count: shippingSummary.shipped,
          shippable_item_count: shippingSummary.shippable,
          unshipped_item_count: Math.max(0, shippingSummary.shippable - shippingSummary.shipped),
          all_items_shipped: shippingSummary.shipped >= shippingSummary.shippable && shippingSummary.shippable > 0 ? 1 : next.all_items_shipped,
          fulfillment_status: shippingSummary.shipped >= shippingSummary.shippable && shippingSummary.shippable > 0 ? "in_transit" : shippingSummary.shipped > 0 ? "partial" : next.fulfillment_status,
        };
      }
      return next;
    });
  }
  return nextRows;
}

function buildBusinessSellerHydrationResult(orderUid, orderDetail) {
  return {
    orderUid,
    orderDetail,
    progress: getOrderShippingProgress([orderDetail?.sale || orderDetail].filter(Boolean)),
    receivedSummary: summarizeReceivedUnitsFromOrderDetail(orderDetail),
    shippingSummary: summarizeShippedUnitsFromOrderDetail(orderDetail),
  };
}

function foldBusinessSellerHydrationResults(results) {
  const hydratedShipping = {};
  const hydratedReceivedByOrder = {};
  const hydratedShippedByOrder = {};
  for (const { orderUid, orderDetail, progress, receivedSummary, shippingSummary } of results) {
    if (progress === "complete" || progress === "partial" || progress === "none") {
      hydratedShipping[orderUid] = progress;
      const txnUid = String(orderDetail?.sale?.transaction_uid || orderDetail?.transaction_uid || "").trim();
      if (txnUid) hydratedShipping[txnUid] = progress;
    }
    if (receivedSummary) {
      hydratedReceivedByOrder[orderUid] = receivedSummary;
      const txnUid = String(orderDetail?.sale?.transaction_uid || orderDetail?.transaction_uid || "").trim();
      if (txnUid) hydratedReceivedByOrder[txnUid] = receivedSummary;
    }
    if (shippingSummary) {
      hydratedShippedByOrder[orderUid] = shippingSummary;
      const txnUid = String(orderDetail?.sale?.transaction_uid || orderDetail?.transaction_uid || "").trim();
      if (txnUid) hydratedShippedByOrder[txnUid] = shippingSummary;
    }
  }
  return { hydratedShipping, hydratedReceivedByOrder, hydratedShippedByOrder };
}

function applyBusinessSellerHydrationPatches(sellerRows, folded) {
  const { hydratedShipping, hydratedReceivedByOrder, hydratedShippedByOrder } = folded;
  if (!Object.keys(hydratedShipping).length && !Object.keys(hydratedReceivedByOrder).length && !Object.keys(hydratedShippedByOrder || {}).length) {
    return sellerRows;
  }
  return (sellerRows || []).map((row) => {
    const orderUid = resolveListRowOrderUid(row);
    const txnUid = String(row.transaction_uid || "").trim();
    const progress = hydratedShipping[orderUid] || hydratedShipping[txnUid];
    const receivedSummary = hydratedReceivedByOrder[orderUid] || hydratedReceivedByOrder[txnUid];
    const shippingSummary = hydratedShippedByOrder?.[orderUid] || hydratedShippedByOrder?.[txnUid];
    let next = row;
    if (progress === "complete") {
      next = { ...next, fulfillment_status: "in_transit", all_items_shipped: 1, unshipped_item_count: 0 };
    } else if (progress === "partial") {
      next = { ...next, fulfillment_status: "partial", all_items_shipped: 0 };
    } else if (progress === "none") {
      next = { ...next, fulfillment_status: "not_shipped", all_items_shipped: 0 };
    }
    if (receivedSummary) {
      next = {
        ...next,
        received_units: receivedSummary.received,
        purchased_units: receivedSummary.purchased,
        received_item_count: receivedSummary.received,
      };
    }
    if (shippingSummary) {
      next = {
        ...next,
        shipped_item_count: shippingSummary.shipped,
        shippable_item_count: shippingSummary.shippable,
        unshipped_item_count: Math.max(0, shippingSummary.shippable - shippingSummary.shipped),
      };
      if (Array.isArray(shippingSummary.lines) && shippingSummary.lines.length) {
        next = { ...next, _sale_detail_lines: shippingSummary.lines };
      }
    }
    return next;
  });
}

/** Snapshot list-row fields when hydration data is missing (for red console diagnostics). */
function summarizeListRowForHydrationLog(row) {
  if (!row || typeof row !== "object") return null;
  return {
    transaction_uid: row.transaction_uid,
    fulfillment_status: row.fulfillment_status ?? row.shipping_status,
    shipped_item_count: row.shipped_item_count ?? row.shipped_count,
    unshipped_item_count: row.unshipped_item_count ?? row.unshipped_count,
    all_items_shipped: row.all_items_shipped,
    received_units: row.received_units ?? row.received_item_count,
    ti_received_qty: row.ti_received_qty,
    ti_shipped_qty: row.ti_shipped_qty,
    return_status: row.return_status ?? row.transaction_return_status,
    refund_status: row.refund_status ?? row.transaction_refund_status,
    in_escrow: row.transaction_in_escrow ?? row.in_escrow,
    has_sale_detail_lines: !!(Array.isArray(row._sale_detail_lines) && row._sale_detail_lines.length) || !!(Array.isArray(row.lines) && row.lines.length),
  };
}

/**
 * Purchases table (personal account): Delivered / Received / return chips.
 * Returns only gaps that would show wrong or ambiguous text on AccountScreen load.
 */
function auditPurchaseRowAccountScreenGaps(row, { shippingProgressByKey = {}, returnStatusesByKey = {} } = {}) {
  const gaps = [];
  if (!row) return gaps;

  if (isReturnListRow(row)) {
    const needsChip = Number(row.transaction_return_requested) === 1 || row.return_status || row.refund_status || row.display_status || row.pending_return;
    if (!needsChip) return gaps;
    const logistics = resolveReturnLogisticsLabels(row, returnStatusesByKey);
    if (!logistics?.delivered || !logistics?.received) {
      gaps.push("Purchases return row chip text (Delivered/Received on return row): display_status or return_status + refund_status");
    }
    return gaps;
  }

  if (orderNeedsShipping(row) && !purchaseRowDeliveredNotApplicable(row)) {
    const delivered = getBuyerPurchaseDeliveredLabel(row, returnStatusesByKey, shippingProgressByKey);
    const progress = resolveShippingProgressForDisplay([row], shippingProgressByKey[resolveListRowOrderUid(row)] || shippingProgressByKey[String(row.transaction_uid || "").trim()] || null);
    if (delivered === "—" && progress === "unknown") {
      gaps.push('Purchases Delivered column shows "—": need ti_shipped_qty, fulfillment_status, or shipped_item_count on list row');
    }
    if (delivered === "Partial" && progress === "partial") {
      const shipped = resolvePurchaseRowShippedUnits(row);
      const purchased = resolvePurchaseRowShippableUnits(row);
      if (shipped <= 0 || purchased <= 0) {
        gaps.push('Purchases Delivered column shows generic "Partial" (not "3/5"): need ti_shipped_qty or shipped_item_count + ti_bs_qty');
      }
    }
  }

  if (orderNeedsShipping(row) && !purchaseRowDeliveredNotApplicable(row)) {
    const progress = resolveShippingProgressForDisplay([row], shippingProgressByKey[resolveListRowOrderUid(row)] || null);
    if (progress === "partial" || progress === "complete") {
      const received = getBuyerPurchaseReceivedLabel(row, returnStatusesByKey);
      const hasReceivedSignal = row.ti_received_qty != null || row.received_units != null || row.received_item_count != null || getUnitReceivedStatusFromSaleRows([row]) != null;
      if (received === "Partial" && !hasReceivedSignal) {
        gaps.push('Purchases Received column may be wrong ("Partial" without ti_received_qty / received_units): need line received qty on list row or order_list_hydration');
      }
    }
  }

  return gaps;
}

/**
 * SALES table on personal account (expertise list): Sold count + red/orange Sold highlight only.
 * Does NOT include offering sales modal (opened separately).
 */
function auditPersonalExpertiseLoadGaps(row, sellerLines, returnStatusesByKey, shippingProgressByKey) {
  const gaps = [];
  if (!row || isReturnListRow(row)) return gaps;

  if (orderNeedsShipping(row) && !orderFulfillmentIsNotRequired(row)) {
    const progressOverride = resolveSellerShippingProgressOverride(row, shippingProgressByKey);
    const shipping = summarizeSaleRowShipping(row, sellerLines || [row], returnStatusesByKey);
    const total = shipping.shippableTotal > 0 ? shipping.shippableTotal : shipping.activeTotal;
    const progress =
      progressOverride === "complete" || progressOverride === "partial" || progressOverride === "none" || progressOverride === "not_required" ? progressOverride : getOrderShippingProgress([row]);

    if (total > 0 && shipping.shipped <= 0 && progress !== "none" && progress !== "not_required") {
      gaps.push("SALES Sold highlight: in-transit order but cannot compute shipped count — need shipped_item_count or sale.lines[].ti_shipped_qty");
    }
  }

  return gaps;
}

/** Business orders table + offering sales modal: Delivered / Received columns. */
function auditSellerOrdersTableGaps(row, sellerLines, returnStatusesByKey, shippingProgressByKey) {
  const gaps = [];
  if (!row || isReturnListRow(row)) return gaps;

  const progressOverride = resolveSellerShippingProgressOverride(row, shippingProgressByKey);

  if (orderNeedsShipping(row) && !orderFulfillmentIsNotRequired(row)) {
    const delivered = formatOrderDeliveredStatusLabel([row], sellerLines, returnStatusesByKey, progressOverride);
    const progress =
      progressOverride === "complete" || progressOverride === "partial" || progressOverride === "none" || progressOverride === "not_required" ? progressOverride : getOrderShippingProgress([row]);

    if (delivered === "—" && (progress === "unknown" || progress === "partial" || progress === "complete")) {
      gaps.push('Orders Delivered column shows "—": need shipped_item_count + unshipped/shippable counts or sale.lines ship qty');
    }
    if (delivered === "Partial") {
      gaps.push('Orders Delivered column shows generic "Partial" (not "7/9"): need shipped_item_count + shippable count or sale.lines with cancelled_qty');
    }
  }

  if (Number(row.transaction_in_escrow ?? row.in_escrow) === 1) {
    const received = formatOrderReceivedStatusLabel([row], sellerLines, returnStatusesByKey);
    const totals = summarizeSaleRowVerification(row, sellerLines, returnStatusesByKey);
    const hasReceivedSignal = row.ti_received_qty != null || row.received_units != null || row.received_item_count != null;
    const shipping = summarizeSaleRowShipping(row, sellerLines, returnStatusesByKey);
    if (totals.activePurchased > 0 && shipping.shipped > 0 && received === "No" && !hasReceivedSignal && totals.received <= 0) {
      // Only flag when shipped but we cannot show partial verification — buyer may truly have verified 0
      // Skip — "No" is accurate when nothing received yet
    }
    if (received === "Partial" && !hasReceivedSignal && totals.received <= 0) {
      gaps.push('Orders Received column shows "Partial" without unit counts: need ti_received_qty or received_units on list row');
    }
  }

  return gaps;
}

/**
 * Log only when AccountScreen UI would be wrong or ambiguous after order_list_hydration merge.
 * Uses console.error (red in dev tools). Silent when list data is sufficient.
 */
function logAccountScreenHydrationGaps({ screenContext, rows, listHydrationByOrderUid, auditRowGaps, auditOptions = {} }) {
  if (!Array.isArray(rows) || !rows.length) return;

  const logged = new Set();
  for (const row of rows) {
    const orderUid = resolveListRowOrderUid(row);
    if (!orderUid || orderUid === "—" || logged.has(orderUid)) continue;

    const gaps = auditRowGaps(row, auditOptions);
    if (!gaps.length) continue;
    logged.add(orderUid);

    const hasMapEntry = !!(listHydrationByOrderUid || {})[orderUid];
    const sourceHint = hasMapEntry
      ? "order_list_hydration entry exists but list row still incomplete after merge"
      : "no order_list_hydration entry — add fields to seller_transactions row or order_list_hydration map";

    console.error(
      `[AccountScreen HYDRATION GAP] ${screenContext} · order ${orderUid}`,
      `\n  AccountScreen impact:\n  · ${gaps.join("\n  · ")}`,
      `\n  ${sourceHint}`,
      "\n  list_row:",
      summarizeListRowForHydrationLog(row),
    );
  }
}

/** Apply order_list_hydration from account-screen/personal to purchase list rows. */
function hydratePersonalPurchasesFromListMap(purchaseRows, listHydrationByOrderUid, { debugHydration = false } = {}) {
  const orderUidsToHydrate = collectOrderUidsNeedingPersonalPurchaseHydration(purchaseRows);
  if (!orderUidsToHydrate.length) return null;

  const listHydration = listHydrationByOrderUid || {};
  const missing = orderUidsToHydrate.filter((uid) => !listHydration[uid]);
  if (debugHydration) {
    console.log(`[AccountScreen] purchase hydration from order_list_hydration: ${orderUidsToHydrate.length - missing.length}/${orderUidsToHydrate.length}`, orderUidsToHydrate);
    if (missing.length) {
      console.warn("[AccountScreen] purchase hydration missing order_list_hydration for:", missing);
    }
  }

  const results = [];
  for (const orderUid of orderUidsToHydrate) {
    const listEntry = listHydration[orderUid];
    if (!listEntry) continue;
    const orderDetail = normalizeListHydrationAsOrderDetail(listEntry, orderUid);
    results.push(buildPersonalPurchaseHydrationResult(orderUid, orderDetail));
  }
  if (!results.length) return missing.length ? { folded: null, missingCount: missing.length } : null;
  return { folded: foldPersonalPurchaseHydrationResults(results), missingCount: missing.length };
}

/** Apply order_list_hydration from account-screen/business to seller list rows. */
function hydrateBusinessSellerFromListMap(sellerRows, listHydrationByOrderUid, { debugHydration = false } = {}) {
  const orderUidsToHydrate = collectOrderUidsNeedingSellerOrderDetailHydration(sellerRows);
  if (!orderUidsToHydrate.length) return null;

  const listHydration = listHydrationByOrderUid || {};
  const missing = orderUidsToHydrate.filter((uid) => !listHydration[uid]);
  if (debugHydration) {
    console.log(`[AccountScreen] business hydration from order_list_hydration: ${orderUidsToHydrate.length - missing.length}/${orderUidsToHydrate.length}`, orderUidsToHydrate);
    if (missing.length) {
      console.warn("[AccountScreen] business hydration missing order_list_hydration for:", missing);
    }
  }

  const results = [];
  for (const orderUid of orderUidsToHydrate) {
    const listEntry = listHydration[orderUid];
    if (!listEntry) continue;
    const orderDetail = normalizeListHydrationAsOrderDetail(listEntry, orderUid);
    results.push(buildBusinessSellerHydrationResult(orderUid, orderDetail));
  }
  if (!results.length) return missing.length ? { folded: null, missingCount: missing.length } : null;
  return { folded: foldBusinessSellerHydrationResults(results), missingCount: missing.length };
}

/** Merge received qty from order detail into seller list rows (used by modal fallback fetches). */
function mergeSellerLineReceivedFromOrderDetail(sellerRows, orderUid, orderDetail) {
  const sale = orderDetail?.sale || orderDetail;
  const lines = Array.isArray(sale?.lines) ? sale.lines : [];
  if (!lines.length || !Array.isArray(sellerRows)) return sellerRows;

  const receivedByBsId = {};
  for (const line of lines) {
    const bsId = String(line.ti_bs_id || line.bs_uid || "").trim();
    if (!bsId) continue;
    const received = Math.max(0, Math.round(parsePrice(line.ti_received_qty ?? line.received_qty)));
    receivedByBsId[bsId] = (receivedByBsId[bsId] || 0) + received;
  }
  if (!Object.keys(receivedByBsId).length) return sellerRows;

  return sellerRows.map((row) => {
    if (resolveListRowOrderUid(row) !== orderUid) return row;
    const bsId = String(row.ti_bs_id || row.bs_uid || "").trim();
    if (!bsId || receivedByBsId[bsId] == null) return row;
    return { ...row, ti_received_qty: receivedByBsId[bsId] };
  });
}

/** Fallback GET /orders/:uid — offering sales modal only; account-screen load uses logAccountScreenHydrationGaps instead. */
async function hydrateSellerRowsReceivedFromOrderDetails(sellerRows, orderUids, fetchCtx = {}) {
  const targets = [...new Set((orderUids || []).filter((uid) => uid && uid !== "—"))];
  if (!targets.length || !Array.isArray(sellerRows)) return sellerRows;

  const results = [];
  let nextRows = sellerRows;
  for (const orderUid of targets) {
    try {
      const orderDetail = await fetchOrderDetailApi(orderUid, fetchCtx);
      results.push(buildBusinessSellerHydrationResult(orderUid, orderDetail));
      nextRows = mergeSellerLineReceivedFromOrderDetail(nextRows, orderUid, orderDetail);
    } catch (err) {
      console.warn(`[AccountScreen] seller received hydration fetch failed for ${orderUid}:`, err?.message || err);
    }
  }
  if (!results.length) return nextRows;
  return applyBusinessSellerHydrationPatches(nextRows, foldBusinessSellerHydrationResults(results));
}

/** Fallback GET /orders/:uid for buyer received totals — not used on account-screen load (see logAccountScreenHydrationGaps). */
async function hydratePersonalPurchasesReceivedFromOrderDetails(purchaseRows, orderUids, fetchCtx = {}, patchSetters = {}) {
  const targets = [...new Set((orderUids || []).filter((uid) => uid && uid !== "—"))];
  if (!targets.length || !Array.isArray(purchaseRows)) return purchaseRows;

  const results = [];
  let nextRows = purchaseRows;
  for (const orderUid of targets) {
    try {
      const orderDetail = await fetchOrderDetailApi(orderUid, fetchCtx);
      results.push(buildPersonalPurchaseHydrationResult(orderUid, orderDetail));
      nextRows = mergeSellerLineReceivedFromOrderDetail(nextRows, orderUid, orderDetail);
    } catch (err) {
      console.warn(`[AccountScreen] purchase received hydration fetch failed for ${orderUid}:`, err?.message || err);
    }
  }
  if (!results.length) return nextRows;
  return applyPersonalPurchaseHydrationPatches(nextRows, foldPersonalPurchaseHydrationResults(results), patchSetters);
}

/**
 * Prefer order-detail return/refund fields (and stripe_refund) over thin account-screen list rows.
 * Buyer list often shows Returned/Pending until Return Details is opened otherwise.
 */
function extractReturnRefundStateFromOrderDetail(orderDetail) {
  if (!orderDetail || typeof orderDetail !== "object") return null;
  const sale = orderDetail.sale || orderDetail;
  const returns = Array.isArray(orderDetail.returns) ? orderDetail.returns : [];
  const firstReturn = returns[0] || null;
  const state = extractReturnRefundState(
    {
      ...sale,
      display_status: sale?.display_status || firstReturn?.display_status || orderDetail.display_status,
      return_status: sale?.return_status || sale?.transaction_return_status || firstReturn?.return_status || firstReturn?.transaction_return_status,
      refund_status: sale?.refund_status || sale?.transaction_refund_status || firstReturn?.refund_status || firstReturn?.transaction_refund_status,
      stripe_refund: orderDetail.stripe_refund || sale?.stripe_refund || firstReturn?.stripe_refund,
      transaction_return_requested: 1,
      is_return: firstReturn ? 1 : sale?.is_return,
    },
    {
      returnRequested: 1,
      stripe_refund: orderDetail.stripe_refund || sale?.stripe_refund || firstReturn?.stripe_refund,
      display_status: sale?.display_status || firstReturn?.display_status || orderDetail.display_status,
    },
  );
  if (!state?.active || !state.return_status || !state.refund_status) return null;
  const delivered = state.return_status === "cancelled" ? "Cancelled" : state.return_status === "returned" ? "Returned" : "Returning";
  const received = state.refund_status === "refunded" ? "Refunded" : state.refund_status === "stripe_fail" ? "CC Issue" : state.refund_status === "rejected" ? "Rejected" : "Pending";
  return {
    return_status: state.return_status,
    refund_status: state.refund_status,
    display_status: state.display_status || `${delivered} - ${received}`,
    stripe_refund: orderDetail.stripe_refund || sale?.stripe_refund || firstReturn?.stripe_refund || null,
    saleTxnUid: String(sale?.transaction_uid || "").trim(),
    returnTxnUids: returns.map((ret) => String(ret?.transaction_uid || "").trim()).filter(Boolean),
    is_cancel_before_ship: !!state.is_cancel_before_ship || state.return_status === "cancelled",
  };
}

/** Sale/return line payloads from order detail / order_list_hydration for Purchases item-name resolution. */
function extractReturnItemHydrationFromOrderDetail(orderDetail) {
  if (!orderDetail || typeof orderDetail !== "object") return null;
  const sale = orderDetail.sale || null;
  const returns = Array.isArray(orderDetail.returns) ? orderDetail.returns : [];
  const pendingReturns =
    (Array.isArray(orderDetail.pending_returns) && orderDetail.pending_returns.length ? orderDetail.pending_returns : null) ||
    (Array.isArray(sale?.pending_returns) && sale.pending_returns.length ? sale.pending_returns : null) ||
    null;
  const pending =
    (pendingReturns && pendingReturns[0]) ||
    orderDetail.pending_return ||
    sale?.pending_return ||
    (Array.isArray(orderDetail.pending_return_items) ? { items: orderDetail.pending_return_items } : null) ||
    null;
  const pendingItems = pendingReturns ? pendingReturns.flatMap((p) => (Array.isArray(p?.items) ? p.items : [])) : pending?.items || null;
  const returnItems = sale?.transaction_return_items || orderDetail.transaction_return_items || pendingItems || null;
  const saleLines = Array.isArray(sale?.lines) ? sale.lines : [];
  const returnLines = [];
  for (const ret of returns) {
    for (const line of ret.lines || []) returnLines.push(line);
  }
  if (!saleLines.length && !returnLines.length && !(pendingItems || []).length && !(returnItems || []).length && !(pendingReturns || []).length && !returns.length) {
    return null;
  }
  return {
    lines: saleLines,
    pending_return: pending || undefined,
    pending_returns: pendingReturns || undefined,
    completed_returns: returns.length ? returns : undefined,
    transaction_return_items: Array.isArray(returnItems) ? returnItems : undefined,
    return_lines: returnLines,
  };
}

function applyHydratedReturnStateToPurchaseRows(rows, stateByOrderUid, itemHydrationByOrderUid) {
  if (!Array.isArray(rows)) return rows;
  const hasStatus = stateByOrderUid && Object.keys(stateByOrderUid).length > 0;
  const hasItems = itemHydrationByOrderUid && Object.keys(itemHydrationByOrderUid).length > 0;
  if (!hasStatus && !hasItems) return rows;
  return rows.map((row) => {
    const orderUid = resolveListRowOrderUid(row);
    const state = stateByOrderUid?.[orderUid];
    const items = itemHydrationByOrderUid?.[orderUid];
    let next = row;
    const isReturn = isReturnListRow(next);
    // Sale-level return_status (often still "returning" while one reverse txn is refunded)
    // must not overwrite completed reverse-txn rows that share order_uid.
    if (state && !isReturn) {
      next = applyReturnRefundFieldsToRow(next, state);
      if (state.stripe_refund) next = { ...next, stripe_refund: state.stripe_refund };
    }
    if (items) {
      if (!isReturn) {
        // Sale rows may receive order-wide pending_returns for companion UI; return rows keep their own scope.
        next = {
          ...next,
          ...(items.pending_returns?.length ? { pending_returns: next.pending_returns?.length ? next.pending_returns : items.pending_returns } : {}),
          ...(items.pending_return ? { pending_return: next.pending_return || items.pending_return } : {}),
          ...(items.transaction_return_items?.length ? { transaction_return_items: next.transaction_return_items?.length ? next.transaction_return_items : items.transaction_return_items } : {}),
        };
        if (items.lines?.length) {
          next = { ...next, lines: items.lines, _sale_detail_lines: items.lines };
        }
      } else {
        // Return rows: never replace this row's return_lines / pending_return with order-wide
        // aggregates (sibling concurrent returns share the same order_uid).
        if (items.lines?.length) next = { ...next, _sale_detail_lines: items.lines };
        const hasOwnReturnLines =
          (Array.isArray(next.return_lines) && next.return_lines.length) ||
          (Array.isArray(next.lines) && next.lines.length) ||
          (Array.isArray(next._return_detail_lines) && next._return_detail_lines.length);
        if (!hasOwnReturnLines) {
          const detailLines = items.return_lines?.length ? items.return_lines : null;
          if (detailLines?.length) {
            next = { ...next, lines: detailLines, _return_detail_lines: detailLines };
          }
        }
      }
    }
    return next;
  });
}

/** Normalize list/API return rows so stripe_fail (and returned+rejected) surface consistently when read. */
function normalizeListRowReturnRefundFields(row) {
  if (!row || typeof row !== "object") return row;
  const hasReturnSignal =
    isReturnListRow(row) ||
    Number(row.transaction_return_requested) === 1 ||
    row.return_status ||
    row.refund_status ||
    row.transaction_return_status ||
    row.transaction_refund_status ||
    row.display_status ||
    row.stripe_refund;
  if (!hasReturnSignal) return row;
  const state = extractReturnRefundState(row);
  if (!state.active) return row;
  if (!state.return_status && !state.refund_status) return row;
  return applyReturnRefundFieldsToRow(row, state);
}

function getReturnLogisticsForCachedUid(row, returnStatusesByKey, uid) {
  return resolveReturnLogisticsLabels(row || {}, getReturnStatusOverrideFromCache(returnStatusesByKey, uid));
}

function buildBountyPaidByOrderUid(bountyLines) {
  const map = {};
  for (const row of bountyLines || []) {
    const orderUid = resolveListRowOrderUid(row);
    if (orderUid === "—" || isReturnListRow(row)) continue;
    map[orderUid] = (map[orderUid] || 0) + (parseFloat(row.bounty_paid ?? 0) || 0);
  }
  return map;
}

function buildBountyPaidByTransactionUid(bountyLines) {
  const map = {};
  for (const row of bountyLines || []) {
    const txnUid = String(row?.transaction_uid ?? "").trim();
    if (!txnUid) continue;
    map[txnUid] = (map[txnUid] || 0) + (parseFloat(row.bounty_paid ?? 0) || 0);
  }
  return map;
}

function resolveListRowBountyPaid(row, bountyLines, bountyByOrderUid, bountyByTransactionUid) {
  const isReturn = isReturnListRow(row);
  const listTxnUid = String(row?.transaction_uid ?? "").trim();
  const fromRow = parseFloat(row?.bounty_paid);
  // Return rows must never inherit the parent sale's order-level bounty.
  if (isReturn) {
    const reclaim = parseFloat(row?.pending_return?.bounty_to_reclaim ?? row?.bounty_to_reclaim ?? NaN);
    if (Number.isFinite(reclaim) && reclaim !== 0) return -Math.abs(reclaim);
    if (Number.isFinite(fromRow) && fromRow !== 0) return fromRow;
    const returnedBounty = parseFloat(row?.returned_bounty ?? row?.return_bounty_paid ?? row?.pending_return?.bounty_paid ?? row?.pending_return?.bounty ?? row?.transaction_bounty ?? NaN);
    if (Number.isFinite(returnedBounty) && returnedBounty !== 0) return -Math.abs(returnedBounty);
    if (listTxnUid && bountyByTransactionUid?.[listTxnUid] != null) {
      const mapped = bountyByTransactionUid[listTxnUid];
      if (Number.isFinite(mapped) && mapped !== 0) return mapped > 0 ? -Math.abs(mapped) : mapped;
    }
    return 0;
  }
  // Order bounty paid by the business — prefer dedicated order-level field.
  const orderBounty = parseFloat(row?.order_bounty_paid);
  if (Number.isFinite(orderBounty)) return orderBounty;
  if (Number.isFinite(fromRow)) return fromRow;
  return 0;
}

/** Order Total / Bounty columns for Business ORDERS (seller_transactions row). */
function resolveSellerOrderTableBounty(row) {
  const orderBounty = parseFloat(row?.order_bounty_paid);
  if (Number.isFinite(orderBounty)) return orderBounty;
  const fromRow = parseFloat(row?.bounty_paid);
  return Number.isFinite(fromRow) ? fromRow : 0;
}

/** Seller bounty pool paid on the original sale (order detail or seller_transactions row). */
function resolveSaleOrderBountyPaid(sale) {
  if (!sale || typeof sale !== "object") return 0;
  const n = parseFloat(sale.order_bounty_paid ?? sale.bounty_paid ?? sale.transaction_bounty ?? NaN);
  return Number.isFinite(n) && n !== 0 ? Math.abs(n) : 0;
}

/** Sum per-line bounty pool from order/receipt lines (bs_bounty × qty, etc.). */
function sumBountyFromSaleLines(saleLines) {
  if (!Array.isArray(saleLines) || !saleLines.length) return 0;
  return saleLines.reduce((sum, line) => {
    const qty = Math.max(1, parseInt(line?.ti_bs_qty, 10) || 1);
    const display = resolveReceiptLineBountyDisplay(line, null);
    const pool = Number(display?.lineBounty);
    if (Number.isFinite(pool) && pool > 0) return sum + pool;
    const paid = parseFloat(line?.bounty_paid ?? line?.ti_bounty ?? line?.order_bounty_paid ?? NaN);
    if (Number.isFinite(paid) && paid !== 0) return sum + Math.abs(paid);
    return sum;
  }, 0);
}

/** Order-level bounty_paid on seller_transactions rows for one sale transaction. */
function sumOrderBountyFromSellerTransactionRows(rows, transactionUid) {
  const txnUid = String(transactionUid || "").trim();
  if (!txnUid || !Array.isArray(rows)) return 0;
  for (const row of rows) {
    if (String(row?.transaction_uid || "").trim() !== txnUid) continue;
    const orderBounty = parseFloat(row?.order_bounty_paid ?? NaN);
    if (Number.isFinite(orderBounty) && orderBounty !== 0) return Math.abs(orderBounty);
  }
  return rows.reduce((sum, row) => {
    if (String(row?.transaction_uid || "").trim() !== txnUid) return sum;
    return sum + Math.abs(parseFloat(row?.bounty_paid) || 0);
  }, 0);
}

/** Resolve seller order bounty for Order Details — sale, bounty rows, list fallbacks, line fields. */
function resolveOrderDetailSaleBountyPaid(sale, bountyRows, transactionUid, { bountyPaidFallback = 0, orderDetail = null, sellerTransactionRows = [] } = {}) {
  const fromSale = resolveSaleOrderBountyPaid(sale);
  if (fromSale > 0) return fromSale;

  const summary = orderDetail?.summary;
  const fromSummary = parseFloat(summary?.order_bounty_paid ?? summary?.bounty_paid ?? summary?.transaction_bounty ?? NaN);
  if (Number.isFinite(fromSummary) && fromSummary !== 0) return Math.abs(fromSummary);

  const fromRows = sumBountyPaidForTransaction(bountyRows, transactionUid);
  if (fromRows > 0) return fromRows;

  const fromSellerRows = sumOrderBountyFromSellerTransactionRows(sellerTransactionRows, transactionUid);
  if (fromSellerRows > 0) return fromSellerRows;

  const fallback = Math.abs(Number(bountyPaidFallback) || 0);
  if (fallback > 0) return fallback;

  const fromLines = sumBountyFromSaleLines(sale?.lines);
  if (fromLines > 0) return fromLines;

  return 0;
}

/** Scale seller order_bounty_paid by returned qty when API omits bounty_to_reclaim. */
function resolveReturnBountyFromSaleRow(returnRow, saleRow) {
  if (!returnRow || !saleRow) return 0;
  const reclaim = parseFloat(returnRow?.pending_return?.bounty_to_reclaim ?? returnRow?.bounty_to_reclaim ?? NaN);
  if (Number.isFinite(reclaim) && reclaim !== 0) return -Math.abs(reclaim);
  const saleBounty = resolveSaleOrderBountyPaid(saleRow);
  if (!(saleBounty > 0)) return 0;
  const purchasedQty = Math.max(1, parseInt(saleRow?.ti_bs_qty ?? saleRow?.transaction_qty ?? NaN, 10) || 1);
  let returnQty = parseInt(returnRow?.return_quantity_total ?? NaN, 10);
  if (!Number.isFinite(returnQty) || returnQty <= 0) {
    const lineSources = [...(Array.isArray(returnRow?.return_lines) ? returnRow.return_lines : []), ...collectItemsFromPendingReturns(returnRow)];
    returnQty = lineSources.reduce((sum, line) => sum + Math.max(0, parseInt(line.return_quantity ?? line.ti_bs_qty ?? line.quantity ?? 0, 10) || 0), 0);
  }
  if (!(returnQty > 0)) returnQty = Math.max(1, parseInt(returnRow?.ti_bs_qty ?? 1, 10) || 1);
  const scaled = scaleAmountForReturnQty(saleBounty, purchasedQty, returnQty);
  return scaled > 0 ? -Math.abs(scaled) : 0;
}

/** Sum seller bounty_paid on bounty_results rows for one sale transaction. */
function sumBountyPaidForTransaction(bountyRows, transactionUid) {
  const txnUid = String(transactionUid || "").trim();
  if (!txnUid || !Array.isArray(bountyRows)) return 0;
  return bountyRows.reduce((sum, row) => {
    const rowTxn = String(row?.transaction_uid || row?.ti_transaction_id || "").trim();
    if (rowTxn !== txnUid) return sum;
    return sum + Math.abs(parseFloat(row?.bounty_paid) || 0);
  }, 0);
}

/** Bounty pool for Return Details — sale fields, bounty rows, list-row fallback, pending reclaim. */
function resolveReturnDetailBountyPool(sale, bountyRows, transactionUid, { bountyPaidFallback = 0, sourceReturnRow = null } = {}) {
  const fromSale = resolveSaleOrderBountyPaid(sale);
  if (fromSale > 0) return fromSale;
  const fromRows = sumBountyPaidForTransaction(bountyRows, transactionUid);
  if (fromRows > 0) return fromRows;
  const fromFallback = Math.abs(Number(bountyPaidFallback) || 0);
  if (fromFallback > 0) return fromFallback;
  const fromSource = Math.abs(parseFloat(sourceReturnRow?.order_bounty_paid ?? 0) || 0);
  if (fromSource > 0) return fromSource;
  return 0;
}

/** Bounty rows for return/refund UI — offering sellers on personal account use personal bounty data. */
function resolveAccountBountyRowsForReturn(isSellerView, selectedAccount, bountyData, businessBountyData) {
  const personalRows = bountyData?.data || [];
  const businessRows = businessBountyData?.data || [];
  if (!isSellerView) return personalRows;
  if (selectedAccount && selectedAccount !== "personal") return businessRows;
  return personalRows;
}

/** Order detail line bounty lookup — buyer uses referrer bounty_results; seller merges bounty_results + seller tx lines. */
function resolveOrderDetailBountyRows(isSellerView, selectedAccount, bountyData, businessBountyData, sellerTxData, businessSellerTransactionList, transactionUid) {
  const txnUid = String(transactionUid || "").trim();
  const filterRowsForTxn = (rows) => {
    if (!Array.isArray(rows) || !rows.length) return [];
    if (!txnUid) return rows;
    const scoped = rows.filter((row) => String(row?.transaction_uid || row?.ti_transaction_id || "").trim() === txnUid);
    return scoped.length ? scoped : rows;
  };

  if (!isSellerView) return filterRowsForTxn(bountyData?.data || []);

  const accountBountyRows = selectedAccount && selectedAccount !== "personal" ? businessBountyData?.data || [] : bountyData?.data || [];
  const scopedBounty = filterRowsForTxn(accountBountyRows);

  const sellerLines = Array.isArray(sellerTxData) ? sellerTxData : [];
  const scopedSeller = txnUid ? sellerLines.filter((row) => String(row?.transaction_uid || "").trim() === txnUid) : sellerLines;

  if (scopedBounty.length && scopedSeller.length) {
    const bountyKeys = new Set(scopedBounty.map((row) => String(row?.ti_uid || row?.tb_ti_id || row?.transaction_uid || row?.ti_transaction_id || "").trim()).filter(Boolean));
    const extraSeller = scopedSeller.filter((row) => {
      const key = String(row?.ti_uid || row?.transaction_item_uid || row?.transaction_uid || "").trim();
      return !key || !bountyKeys.has(key);
    });
    return [...scopedBounty, ...extraSeller];
  }
  if (scopedBounty.length) return scopedBounty;
  return scopedSeller.length ? scopedSeller : sellerLines;
}

function resolveOrderDetailBountyPaidFallback(orderRow) {
  const fromTable = parseFloat(orderRow?.bountyPaid);
  if (Number.isFinite(fromTable) && fromTable !== 0) return Math.abs(fromTable);
  const raw = orderRow?.rawRow && typeof orderRow.rawRow === "object" ? orderRow.rawRow : orderRow;
  return resolveSaleOrderBountyPaid(raw);
}

/**
 * Pending (or just-completed) return money from seller_transactions.pending_return(s).
 * Total = estimated customer credit (subtotal + tax + shipping; card fees excluded); Bounty = bounty_to_reclaim.
 * Sums concurrent pending_returns when present.
 */
function resolvePendingReturnTableMoney(row) {
  const list = getPendingReturnsList(row);
  if (list.length) {
    let total = 0;
    let bountyPaid = 0;
    for (const pending of list) {
      const m = resolvePendingReturnEntryMoney(pending);
      total += m.total;
      bountyPaid += m.bountyPaid;
    }
    if (total || bountyPaid) return { total, bountyPaid };
  }
  return { total: 0, bountyPaid: 0 };
}

function scaleAmountForReturnQty(fullQtyAmount, purchasedQty, returnQty) {
  const amount = Number(fullQtyAmount);
  if (!Number.isFinite(amount) || amount === 0) return 0;
  const purchased = Math.max(1, parseInt(purchasedQty, 10) || 1);
  const returning = Math.max(0, parseInt(returnQty, 10) || 0);
  if (returning <= 0) return 0;
  if (returning >= purchased) return amount;
  return (amount / purchased) * returning;
}

/**
 * Mirror buyer-receipt bounty math for a returned qty.
 * Returns pool bounty (lineBounty), buyer share (earnedShare), and seller bounty_paid reversed.
 */
function resolveReturnLineBountyAmounts(line, returnQty, bountyRows, transactionUid, saleBountyPaid = 0, salePurchasedQty = null) {
  const qty = Math.max(1, parseInt(returnQty, 10) || 1);
  const bountyRow = findBountyResultForReceiptLine(bountyRows, line, transactionUid);
  const purchasedQty = Math.max(
    qty,
    parseInt(salePurchasedQty ?? line?.purchased_qty ?? line?.ti_purchased_qty ?? line?.original_qty ?? bountyRow?.ti_bs_qty ?? bountyRow?.purchased_qty ?? NaN, 10) || qty,
  );
  const lineForDisplay = {
    ...line,
    ...(bountyRow || {}),
    ti_bs_qty: purchasedQty,
    ti_uid: line?.ti_uid || line?.transaction_item_uid || bountyRow?.ti_uid || bountyRow?.tb_ti_id,
  };
  const display = resolveReceiptLineBountyDisplay(lineForDisplay, bountyRow);

  const poolForPurchased = Number(display?.lineBounty);
  const shareForPurchased = Number(display?.earned);
  const paidForPurchased = parseFloat(bountyRow?.bounty_paid ?? line?.bounty_paid ?? line?.return_bounty ?? line?.ti_bounty ?? NaN);

  const lineBounty = scaleAmountForReturnQty(Number.isFinite(poolForPurchased) ? poolForPurchased : 0, purchasedQty, qty);
  const earnedShare = scaleAmountForReturnQty(Number.isFinite(shareForPurchased) ? shareForPurchased : 0, purchasedQty, qty);
  // Orders "Bounty" column uses seller bounty_paid — reverse that when available.
  let bountyPaidReversed = scaleAmountForReturnQty(Number.isFinite(paidForPurchased) ? Math.abs(paidForPurchased) : 0, purchasedQty, qty);
  if (saleBountyPaid > 0) {
    bountyPaidReversed = scaleAmountForReturnQty(saleBountyPaid, purchasedQty, qty);
  } else if (!bountyPaidReversed) {
    bountyPaidReversed = lineBounty || earnedShare || 0;
  }

  // Rebuild labels for the returned qty (not the full purchase qty).
  const scaledDisplay = resolveReceiptLineBountyDisplay(
    {
      ...lineForDisplay,
      ti_bs_qty: qty,
      // Keep unit bounty for per_item labels when present.
      bs_bounty: lineForDisplay.bs_bounty ?? lineForDisplay.ti_bs_bounty,
      ti_bs_bounty: lineForDisplay.ti_bs_bounty ?? lineForDisplay.bs_bounty,
      bounty_earned: earnedShare || undefined,
      tb_amount: earnedShare || undefined,
      tb_percentage: display?.percentage ?? bountyRow?.tb_percentage ?? line?.tb_percentage,
    },
    bountyRow
      ? {
          ...bountyRow,
          bounty_earned: earnedShare || bountyRow.bounty_earned,
          tb_amount: earnedShare || bountyRow.tb_amount,
          bounty_paid: bountyPaidReversed,
        }
      : { bounty_earned: earnedShare, tb_amount: earnedShare, bounty_paid: bountyPaidReversed },
  );

  return {
    lineBounty: Math.abs(lineBounty) || 0,
    earnedShare: Math.abs(earnedShare) || 0,
    bountyPaidReversed: Math.abs(bountyPaidReversed) || 0,
    percentage: display?.percentage ?? scaledDisplay?.percentage ?? null,
    itemLabel: scaledDisplay?.itemLabel || (lineBounty > 0 ? `$${lineBounty.toFixed(2)}` : null),
    shareLabel: scaledDisplay?.shareLabel || (earnedShare > 0 ? `$${earnedShare.toFixed(2)}` : null),
  };
}

/** Prefer the return/refund money fields — never fall back to the original sale total. */
function resolveReturnRowMoney(row, bountyByTransactionUid, bountyLines) {
  const fromPending = resolvePendingReturnTableMoney(row);
  const listTxnUid = String(row?.transaction_uid ?? "").trim();
  const orderUid = resolveListRowOrderUid(row);
  const cached = row?._pending_return_money;

  let total = fromPending.total;
  let bountyPaid = fromPending.bountyPaid;

  // pending_return often has customer credit but omits bounty_to_reclaim — keep looking for bounty.
  if (cached && typeof cached === "object") {
    const cachedTotal = Number(cached.total);
    const cachedBounty = Number(cached.bountyPaid);
    if (!total && Number.isFinite(cachedTotal) && cachedTotal !== 0) {
      total = cachedTotal > 0 ? -Math.abs(cachedTotal) : cachedTotal;
    }
    if (!bountyPaid && Number.isFinite(cachedBounty) && cachedBounty !== 0) {
      bountyPaid = cachedBounty > 0 ? -Math.abs(cachedBounty) : cachedBounty;
    }
  }

  if (!total) {
    const fromComponents = resolveReturnCustomerCreditTotal(row);
    if (fromComponents) {
      total = fromComponents;
    } else {
      const totalRaw = parseFloat(
        row?.transaction_total ?? row?.returned_total ?? row?.return_total ?? row?.refund_total ?? row?.pending_return?.total ?? row?.pending_return?.transaction_total ?? NaN,
      );
      total = Number.isFinite(totalRaw) ? totalRaw : 0;
      // Display returns as credits (negative). Keep already-negative API values.
      if (total > 0) total = -Math.abs(total);
    }
  } else {
    const fromComponents = resolveReturnCustomerCreditTotal(row);
    if (fromComponents && Math.abs(fromComponents) > Math.abs(total) + 0.01) {
      total = fromComponents;
    }
  }

  if (!bountyPaid) {
    bountyPaid = resolveListRowBountyPaid(row, null, null, bountyByTransactionUid);
  }
  const saleTxnUid = String(row?.original_transaction_uid || row?.order_uid || orderUid || "").trim();
  // Real return txns may omit bounty_paid — derive from matching sale bounty lines / return lines.
  if ((!Number.isFinite(bountyPaid) || bountyPaid === 0) && Array.isArray(bountyLines) && bountyLines.length) {
    const returnLines = [...(Array.isArray(row?.return_lines) ? row.return_lines : []), ...(Array.isArray(row?.lines) ? row.lines : [])];
    const pendingItems = row?.pending_return?.items || row?.transaction_return_items || returnLines || [];
    if (Array.isArray(pendingItems) && pendingItems.length) {
      bountyPaid = pendingItems.reduce((sum, item) => {
        const qty = Math.max(1, parseInt(item.return_quantity ?? item.ti_bs_qty ?? item.quantity, 10) || 1);
        const amounts = resolveReturnLineBountyAmounts(item, qty, bountyLines, saleTxnUid || listTxnUid || orderUid);
        return sum + amounts.bountyPaidReversed;
      }, 0);
    }
  }
  if (!Number.isFinite(bountyPaid)) bountyPaid = 0;
  if (bountyPaid > 0) bountyPaid = -Math.abs(bountyPaid);
  else if (bountyPaid < 0) bountyPaid = -Math.abs(bountyPaid);

  return { total, bountyPaid };
}

/**
 * Collect return-request line payloads from local buyer request notes / ids.
 * Prefers structured transactionReturnItems; falls back to item ids + sale lines.
 */
function collectPendingReturnItemsFromRequestData(returnRequestData, saleLines = []) {
  const pending = [];
  if (!returnRequestData || typeof returnRequestData !== "object") return pending;
  const lines = Array.isArray(saleLines) ? saleLines : [];

  const pushFromIds = (ids, itemQuantities) => {
    for (const rawId of ids || []) {
      const id = String(rawId ?? "").trim();
      if (!id) continue;
      const qty = Math.max(1, parseInt(itemQuantities?.[id], 10) || 1);
      const byUid = lines.find((line) => String(line.ti_uid || line.transaction_item_uid || "").trim() === id);
      if (byUid) {
        pending.push({
          ...byUid,
          transaction_item_uid: byUid.ti_uid || byUid.transaction_item_uid,
          ti_uid: byUid.ti_uid || byUid.transaction_item_uid,
          return_quantity: qty,
          ti_bs_qty: qty,
        });
        continue;
      }
      const idx = parseInt(id, 10);
      if (Number.isFinite(idx) && idx >= 0 && lines[idx]) {
        const line = lines[idx];
        pending.push({
          ...line,
          transaction_item_uid: line.ti_uid || line.transaction_item_uid || id,
          ti_uid: line.ti_uid || line.transaction_item_uid,
          return_quantity: qty,
          ti_bs_qty: qty,
        });
      }
    }
  };

  for (const note of returnRequestData.notes || []) {
    if (Array.isArray(note?.transactionReturnItems) && note.transactionReturnItems.length) {
      pending.push(...note.transactionReturnItems);
      continue;
    }
    pushFromIds(note?.items, note?.itemQuantities);
  }
  if (!pending.length) {
    pushFromIds(returnRequestData.items, returnRequestData.itemQuantities || returnRequestData.notes?.[0]?.itemQuantities);
  }
  return pending;
}

/**
 * Estimate return merchandise/bounty for a pending request before a reverse txn exists.
 * Prefer seller_transactions.pending_return from account-screen:
 *   estimated_refund.total_customer_credit + bounty_to_reclaim
 * Legacy fallback: pending items / local return request notes.
 */
function estimatePendingReturnMoney(saleRow, returnRequestData, bountyLines = []) {
  const fromApi = resolvePendingReturnTableMoney(saleRow);
  let total = fromApi.total;
  let bountyPaid = fromApi.bountyPaid;

  const cached = saleRow?._pending_return_money;
  if (cached && typeof cached === "object") {
    const cachedTotal = Number(cached.total);
    const cachedBounty = Number(cached.bountyPaid);
    if (!total && Number.isFinite(cachedTotal) && cachedTotal !== 0) {
      total = cachedTotal > 0 ? -Math.abs(cachedTotal) : cachedTotal;
    }
    if (!bountyPaid && Number.isFinite(cachedBounty) && cachedBounty !== 0) {
      bountyPaid = cachedBounty > 0 ? -Math.abs(cachedBounty) : cachedBounty;
    }
  }

  // Prefer API total+bounty when both present; otherwise keep deriving the missing side.
  if (total && bountyPaid) {
    return { total, bountyPaid };
  }

  const explicitTotal = parseFloat(
    saleRow?.returned_total ?? saleRow?.return_total ?? saleRow?.refund_total ?? saleRow?.pending_return?.total ?? saleRow?.pending_return?.transaction_total ?? saleRow?.pending_return?.amount ?? NaN,
  );
  const explicitBounty = parseFloat(saleRow?.returned_bounty ?? saleRow?.return_bounty_paid ?? saleRow?.pending_return?.bounty_paid ?? saleRow?.pending_return?.bounty ?? NaN);

  const saleLines = Array.isArray(saleRow?.lines) ? saleRow.lines : [];
  const pendingItems = [...collectItemsFromPendingReturns(saleRow), ...collectPendingReturnItemsFromRequestData(returnRequestData, saleLines)];

  const enrichedPending = mapPendingReturnItemsToLines(pendingItems, saleLines);
  const itemsForMoney = enrichedPending.length ? enrichedPending : pendingItems;
  const txnUid = String(saleRow?.transaction_uid || saleRow?.order_uid || "").trim();

  let merchandise = 0;
  let bountyFromLines = 0;
  for (const item of itemsForMoney) {
    const qty = Math.max(0, parseInt(item.return_quantity ?? item.quantity ?? item.qty ?? item.ti_bs_qty, 10) || 0) || 1;
    const enrichment = enrichFromReceiptRow(item);
    const unit = Math.abs(getReceiptLineUnitPrice(item, enrichment) || parseFloat(item.ti_bs_cost ?? item.unit_cost ?? item.cost ?? item.bs_cost ?? 0) || 0);
    merchandise += unit * qty;
    const saleBountyPool = resolveSaleOrderBountyPaid(saleRow);
    const amounts = resolveReturnLineBountyAmounts(item, qty, bountyLines, txnUid, saleBountyPool);
    bountyFromLines += amounts.bountyPaidReversed;
  }
  let taxes = Math.abs(
    parseFloat(
      saleRow?.pending_return?.estimated_refund?.taxes ?? saleRow?.pending_return?.taxes ?? saleRow?.pending_return?.transaction_taxes ?? saleRow?.return_taxes ?? saleRow?.returned_taxes ?? NaN,
    ) || 0,
  );
  if (!taxes && merchandise > 0) {
    const saleAmount = Math.abs(parseOrderMoneyField(saleRow?.transaction_amount));
    const saleTaxes = Math.abs(parseOrderMoneyField(saleRow?.transaction_taxes));
    if (saleAmount > 0 && saleTaxes > 0) {
      taxes = saleTaxes * (merchandise / saleAmount);
    }
  }

  if (!total) {
    if (Number.isFinite(explicitTotal) && explicitTotal !== 0) total = -Math.abs(explicitTotal);
    else if (merchandise > 0) total = -(merchandise + taxes);
  }

  if (!bountyPaid) {
    if (bountyFromLines > 0) bountyPaid = -Math.abs(bountyFromLines);
    else if (Number.isFinite(explicitBounty) && explicitBounty !== 0) bountyPaid = -Math.abs(explicitBounty);
    else {
      const saleBounty = resolveSaleOrderBountyPaid(saleRow);
      if (saleBounty > 0) {
        const purchasedQty = Math.max(1, parseInt(saleRow?.ti_bs_qty ?? NaN, 10) || 1);
        const returnQty = itemsForMoney.reduce((sum, item) => sum + Math.max(0, parseInt(item.return_quantity ?? item.quantity ?? item.qty ?? item.ti_bs_qty ?? 0, 10) || 0), 0);
        const scaled = returnQty > 0 ? scaleAmountForReturnQty(saleBounty, purchasedQty, returnQty) : saleBounty;
        if (scaled > 0) bountyPaid = -Math.abs(scaled);
      }
    }
  }

  return { total, bountyPaid };
}

/** Snapshot pending-return fields from GET /orders/:uid onto a seller list row (legacy helper). */
function pendingReturnFieldsFromOrderDetail(orderDetail, bountyLines = []) {
  if (!orderDetail || typeof orderDetail !== "object") return null;
  const sale = orderDetail.sale || null;
  const pending = orderDetail.pending_return || sale?.pending_return || (Array.isArray(orderDetail.pending_return_items) ? { items: orderDetail.pending_return_items } : null) || null;
  const returnItems = sale?.transaction_return_items || orderDetail.transaction_return_items || pending?.items || null;
  const lines = Array.isArray(sale?.lines) ? sale.lines : [];
  const money = estimatePendingReturnMoney(
    {
      ...(sale || {}),
      transaction_uid: sale?.transaction_uid || orderDetail.order_uid,
      order_uid: orderDetail.order_uid || sale?.order_uid,
      pending_return: pending,
      transaction_return_items: returnItems,
      lines,
      returned_total: orderDetail.returned_total ?? sale?.returned_total ?? pending?.total,
      return_taxes: pending?.taxes ?? pending?.transaction_taxes,
      returned_bounty: pending?.bounty_paid ?? pending?.bounty,
    },
    null,
    bountyLines,
  );
  if (!money.total && !money.bountyPaid && !(pending?.items || []).length && !(returnItems || []).length && !lines.length) {
    if (!pending && !returnItems) return null;
  }
  return {
    pending_return: pending || (returnItems ? { items: returnItems } : undefined),
    transaction_return_items: returnItems || undefined,
    lines: lines.length ? lines : undefined,
    returned_total: money.total ? Math.abs(money.total) : pending?.total,
    return_taxes: pending?.taxes ?? pending?.transaction_taxes,
    returned_bounty: money.bountyPaid ? Math.abs(money.bountyPaid) : pending?.bounty_paid,
    _pending_return_money: money,
  };
}

function mapTransactionListRowToOrderTableRow(row, shippingProgressByKey, returnStatusesByKey, saleSibling = null, sellerLines = null) {
  const orderUid = resolveListRowOrderUid(row);
  const isReturn = isReturnListRow(row);
  const dateMs = transactionDateMs(row);
  const trrUidEarly = resolveTrrUid(row);
  const listTransactionUid = String(row.transaction_uid || trrUidEarly || "").trim();
  // Prefer hydrated progress when present — list "Partial" often still counts cancelled units.
  const shippingProgressOverride = (shippingProgressByKey && (shippingProgressByKey[orderUid] || shippingProgressByKey[listTransactionUid])) || null;
  const statusOverride = getReturnStatusOverrideForRow(returnStatusesByKey, row, orderUid, listTransactionUid);
  const returnLogistics = resolveReturnLogisticsLabels(row, {
    ...statusOverride,
    saleSibling,
    ...(isPreShipCancelReturn(row, saleSibling) ? { cancel_unshipped: true } : {}),
  });

  // Keep Order rows on shipping/receipt chips. Return logistics belong on the Return row only.
  if (isReturn) {
    // Prefer pending_return for total/bounty when present, but still fill missing bounty via return txn / lines.
    const money = resolveReturnRowMoney(row, null, null);
    const trrUid = trrUidEarly;
    const trrUids = normalizeTrrUidList(row);
    const delivered = returnLogistics?.delivered || "Returned";
    const received = returnLogistics?.received || "Pending";
    return {
      key: String(trrUid || row.transaction_uid || `return-${orderUid}-${dateMs}`),
      orderUid,
      rowLabel: "Return",
      listTransactionUid,
      trrUid: trrUid || undefined,
      trrUids: trrUids.length ? trrUids : undefined,
      isReturn: true,
      isSyntheticReturn: false,
      placedBy: resolveSalePlacedByUid(row),
      dateLabel: formatOrderShortDate(dateMs),
      dateMs,
      total: money.total,
      bountyPaid: money.bountyPaid,
      delivered,
      received,
      attentionLevel: resolveSellerReturnRowAttentionLevel(row, returnStatusesByKey),
      daysOpen: shouldDisplayOrderDaysOpen(delivered, received) ? formatOrderDaysOpen(dateMs) : "—",
      returnLogistics,
      rawRow: row,
    };
  }

  const total = parseFloat(row.transaction_total);
  const bountyPaid = resolveSellerOrderTableBounty(row);
  const delivered = formatOrderDeliveredStatusLabel([row], sellerLines, returnStatusesByKey, shippingProgressOverride);
  const received = formatOrderReceivedStatusLabel([row], sellerLines, returnStatusesByKey);
  const attentionLevel = resolveSellerOrderAttentionLevel(row, shippingProgressByKey, sellerLines, returnStatusesByKey);
  return {
    key: String(row.transaction_uid || `${orderUid}-${dateMs}`),
    orderUid,
    rowLabel: "Order",
    listTransactionUid,
    trrUid: resolveTrrUid(row) || undefined,
    isReturn: false,
    isSyntheticReturn: false,
    placedBy: resolveSalePlacedByUid(row),
    dateLabel: formatOrderShortDate(dateMs),
    dateMs,
    total: Number.isFinite(total) ? total : 0,
    bountyPaid: Number.isFinite(bountyPaid) ? bountyPaid : 0,
    delivered,
    received,
    attentionLevel,
    daysOpen: shouldDisplayOrderDaysOpen(delivered, received) ? formatOrderDaysOpen(dateMs) : "—",
    returnLogistics,
    rawRow: row,
  };
}

/**
 * Business ORDERS table from account-screen seller_transactions.
 * Renders API sale + return rows only (backend owns pending/completed return rows).
 * Order bounty: order_bounty_paid
 * Return money: pending_return.estimated_refund.total_customer_credit + bounty_to_reclaim
 *   (falls back to return txn / bounty lines when reclaim is missing)
 * Return chips: display_status / return_status + refund_status on the list row
 */
function buildBusinessOrdersListFromSellerTransactions(sellerLines, bountyLines, shippingProgressByKey, returnStatusesByKey) {
  if (!Array.isArray(sellerLines)) return [];
  const bountyByTransactionUid = buildBountyPaidByTransactionUid(bountyLines);
  const saleByOrderUid = {};
  for (const row of sellerLines) {
    if (isReturnListRow(row)) continue;
    const orderUid = resolveListRowOrderUid(row);
    if (orderUid && orderUid !== "—") saleByOrderUid[orderUid] = row;
  }
  const mapped = sellerLines.map((row) => {
    const orderUid = resolveListRowOrderUid(row);
    const saleSibling = isReturnListRow(row) ? saleByOrderUid[orderUid] || null : null;
    const mappedRow = mapTransactionListRowToOrderTableRow(row, shippingProgressByKey, returnStatusesByKey, saleSibling, sellerLines);
    if (mappedRow.isReturn) {
      let money = resolveReturnRowMoney(row, bountyByTransactionUid, bountyLines);
      if (saleSibling) {
        if (!money.bountyPaid) {
          money = { ...money, bountyPaid: resolveReturnBountyFromSaleRow(row, saleSibling) };
        }
        if (!money.total || !money.bountyPaid) {
          const est = estimatePendingReturnMoney(
            {
              ...saleSibling,
              pending_return: row.pending_return || saleSibling.pending_return,
              pending_returns: row.pending_returns || saleSibling.pending_returns,
              transaction_return_items: row.transaction_return_items || saleSibling.transaction_return_items,
              return_lines: row.return_lines || saleSibling.return_lines,
              lines: saleSibling.lines || row.return_lines,
            },
            null,
            bountyLines,
          );
          if (!money.total && est.total) {
            money = { ...money, total: est.total };
          } else if (!money.total && (isPreShipCancelReturn(row, saleSibling) || isPreShipCancelReturn(row.pending_return, saleSibling))) {
            const saleTotal = parseFloat(saleSibling.transaction_total ?? saleSibling.transaction_amount);
            if (Number.isFinite(saleTotal) && saleTotal > 0) {
              money = { ...money, total: -Math.abs(saleTotal) };
            }
          }
          if (!money.bountyPaid && est.bountyPaid) money = { ...money, bountyPaid: est.bountyPaid };
        }
      }
      return { ...mappedRow, total: money.total, bountyPaid: money.bountyPaid };
    }
    return mappedRow;
  });

  return mapped.sort((a, b) => {
    const byDate = (b.dateMs || 0) - (a.dateMs || 0);
    if (byDate !== 0) return byDate;
    if (a.orderUid === b.orderUid) {
      // Same order: Return above Order (processed after the original purchase).
      return (b.isReturn ? 1 : 0) - (a.isReturn ? 1 : 0);
    }
    return 0;
  });
}

/** Real product/service name from a line or pending-return stub (ignores placeholder "Item"). */
function resolveLineItemDisplayName(line) {
  if (!line || typeof line !== "object") return null;
  const candidates = [
    line.item_name,
    line.bs_service_name,
    line.bs_service_desc,
    line.profile_expertise_title,
    line.profile_wish_title,
    line.service_name,
    line.product_name,
    line.purchased_item,
    line.name,
    line.description,
  ];
  for (const candidate of candidates) {
    const s = String(candidate ?? "").trim();
    if (!s) continue;
    if (s.toLowerCase() === "item") continue;
    // Pending-return stubs sometimes put the ti_uid in item_name / purchased_item.
    if (/^\d{3}-\d+$/.test(s)) continue;
    return s;
  }
  return null;
}

/**
 * Purchased Item + Qty for a return list row: only items being returned (not the full original order).
 * Uses pending_returns[] / pending_return / transaction_return_items / local return request / return txn lines.
 */
function resolveReturnRowItemSummary(returnOrSaleRow, saleSibling, returnRequestData) {
  const lookupLines = [
    ...(Array.isArray(saleSibling?._sale_detail_lines) ? saleSibling._sale_detail_lines : []),
    ...(Array.isArray(saleSibling?.lines) ? saleSibling.lines : []),
    ...(Array.isArray(returnOrSaleRow?._sale_detail_lines) ? returnOrSaleRow._sale_detail_lines : []),
    ...(Array.isArray(returnOrSaleRow?._return_detail_lines) ? returnOrSaleRow._return_detail_lines : []),
    ...(Array.isArray(returnOrSaleRow?.return_lines) ? returnOrSaleRow.return_lines : []),
    ...(Array.isArray(returnOrSaleRow?.lines) ? returnOrSaleRow.lines : []),
  ];
  // De-dupe lookup lines by ti_uid while keeping first occurrence.
  const seenLookup = new Set();
  const uniqueLookupLines = [];
  for (const line of lookupLines) {
    const uid = String(line?.ti_uid || line?.transaction_item_uid || "").trim();
    const key = uid || `anon-${uniqueLookupLines.length}`;
    if (seenLookup.has(key)) continue;
    seenLookup.add(key);
    uniqueLookupLines.push(line);
  }

  const isPendingReturnRow =
    returnOrSaleRow?.is_pending_return === true || Number(returnOrSaleRow?.is_pending_return) === 1 || String(returnOrSaleRow?.transaction_uid || "").startsWith("return-request-");

  // Prefer this return row's own lines first (pending or completed).
  // Do not use order-wide pending_returns[] / sale-sibling pending items — concurrent
  // returns for the same order would otherwise share each other's item lists.
  // Use one source only — hydration often mirrors the same lines onto `_return_detail_lines`,
  // `return_lines`, and `lines`; concatenating them triple-counts Qty.
  const ownReturnLines = (() => {
    // For a specific pending return list row, trust backend return_lines over hydrated
    // order-wide `_return_detail_lines` (which can include sibling concurrent returns).
    if (isPendingReturnRow && Array.isArray(returnOrSaleRow?.return_lines) && returnOrSaleRow.return_lines.length) {
      return returnOrSaleRow.return_lines;
    }
    if (Array.isArray(returnOrSaleRow?._return_detail_lines) && returnOrSaleRow._return_detail_lines.length) {
      return returnOrSaleRow._return_detail_lines;
    }
    if (Array.isArray(returnOrSaleRow?.return_lines) && returnOrSaleRow.return_lines.length) {
      return returnOrSaleRow.return_lines;
    }
    if (isReturnListRow(returnOrSaleRow) && Array.isArray(returnOrSaleRow.lines) && returnOrSaleRow.lines.length) {
      return returnOrSaleRow.lines;
    }
    return [];
  })();

  let enriched = [];
  if (ownReturnLines.length) {
    enriched = ownReturnLines.map((line) => {
      const qty = Math.abs(parseInt(line.return_quantity ?? line.ti_bs_qty ?? line.quantity, 10) || 1);
      return {
        ...line,
        item_name: resolveLineItemDisplayName(line) || "Item",
        return_quantity: qty,
        ti_bs_qty: qty,
      };
    });
  }

  if (!enriched.length) {
    // Scope to this row's singular pending_return first (trr-specific), not pending_returns[]
    // which order-detail hydration may fill with every open return for the sale.
    const thisRowPendingItems = (() => {
      const singular = returnOrSaleRow?.pending_return;
      if (singular && typeof singular === "object" && Array.isArray(singular.items) && singular.items.length) {
        return singular.items;
      }
      return collectItemsFromPendingReturns(returnOrSaleRow);
    })();
    const pendingCandidates = [
      thisRowPendingItems,
      returnOrSaleRow?.transaction_return_items,
      // Local AsyncStorage request only — never sibling sale pending_returns.
      collectPendingReturnItemsFromRequestData(returnRequestData, uniqueLookupLines),
    ];
    let pendingItems = [];
    for (const candidate of pendingCandidates) {
      if (Array.isArray(candidate) && candidate.length) {
        pendingItems = candidate;
        break;
      }
    }
    enriched = mapPendingReturnItemsToLines(pendingItems, uniqueLookupLines);
  }

  // Sale lines marked with returned_qty > 0.
  if (!enriched.length && uniqueLookupLines.length) {
    const marked = uniqueLookupLines.filter((line) => {
      const returnedQty = parseInt(line.returned_qty ?? line.return_quantity, 10);
      return Number.isFinite(returnedQty) && returnedQty > 0;
    });
    if (marked.length) {
      enriched = marked.map((line) => {
        const qty = Math.max(1, parseInt(line.returned_qty ?? line.return_quantity, 10) || 1);
        return {
          ...line,
          item_name: resolveLineItemDisplayName(line) || "Item",
          return_quantity: qty,
          ti_bs_qty: qty,
        };
      });
    }
  }

  if (!enriched.length) return { purchased_item: null, qty: null };

  // Re-resolve placeholder names ("Item") against sale/order lines by ti_uid.
  enriched = enriched.map((line) => {
    const name = resolveLineItemDisplayName(line);
    if (name) return { ...line, item_name: name };
    const uid = String(line.ti_uid || line.transaction_item_uid || "").trim();
    if (!uid) return line;
    const match = uniqueLookupLines.find((l) => String(l.ti_uid || l.transaction_item_uid || "").trim() === uid);
    const matchedName = resolveLineItemDisplayName(match);
    return matchedName ? { ...line, item_name: matchedName, bs_service_name: matchedName } : line;
  });

  const byKey = {};
  const order = [];
  for (const line of enriched) {
    const key = String(line.ti_uid || line.transaction_item_uid || line.item_name || "").trim() || `idx-${order.length}`;
    const qty = Math.max(1, parseInt(line.return_quantity ?? line.ti_bs_qty ?? line.quantity, 10) || 1);
    const name = resolveLineItemDisplayName(line) || "Item";
    if (!byKey[key]) {
      byKey[key] = { name, qty: 0 };
      order.push(key);
    }
    // Same ti_uid twice is a duplicate source, not additive qty.
    byKey[key].qty = Math.max(byKey[key].qty, qty);
    if (byKey[key].name === "Item" && name !== "Item") byKey[key].name = name;
  }

  const names = order.map((k) => byKey[k].name);
  // If we still only have placeholders, don't show the misleading "Item" label.
  const hasRealName = names.some((n) => n && n !== "Item");
  return {
    purchased_item: hasRealName ? names.filter((n) => n && n !== "Item").join(", ") || names.join(", ") : null,
    qty: order.reduce((sum, k) => sum + byKey[k].qty, 0),
  };
}

/**
 * Personal PURCHASES list from account-screen purchase rows.
 * Renders API sale + return rows only (backend owns pending/completed return rows).
 * Return Amount = expected customer refund (pending_return / reverse txn), not the original sale.
 */
function buildPersonalPurchasesListWithReturns(purchaseRows, returnStatusesByKey, returnRequestsByKey, bountyLines = []) {
  if (!Array.isArray(purchaseRows) || purchaseRows.length === 0) return [];

  const orderSaleByUid = {};
  for (const row of purchaseRows) {
    if (isReturnListRow(row)) continue;
    const orderUid = resolveListRowOrderUid(row);
    if (orderUid && orderUid !== "—") orderSaleByUid[orderUid] = row;
  }

  const normalizedPurchaseRows = purchaseRows.map((row) => {
    if (!isReturnListRow(row)) return row;
    const orderUid = resolveListRowOrderUid(row);
    const txnUid = String(row.original_transaction_uid || row.transaction_uid || "").trim();
    const saleSibling = orderSaleByUid[orderUid] || null;
    const isPendingReturnRow = row.is_pending_return === true || Number(row.is_pending_return) === 1 || String(row.transaction_uid || "").startsWith("return-request-");
    // Prefer return-row fields, but inherit Stripe-fail / display_status from the parent sale when the
    // reverse-txn list row still says refunded (buyer account-screen quirk).
    const siblingState = saleSibling ? extractReturnRefundState(saleSibling, { returnRequested: 1 }) : null;
    const rowRefund = String(row.refund_status || row.transaction_refund_status || "")
      .trim()
      .toLowerCase();
    const preferSiblingStripeFail = siblingState?.refund_status === "stripe_fail" && (rowRefund === "refunded" || !rowRefund);
    const statusSource = {
      ...row,
      return_status:
        (preferSiblingStripeFail ? "returned" : null) ||
        row.return_status ||
        row.transaction_return_status ||
        (isPendingReturnRow ? saleSibling?.return_status || saleSibling?.transaction_return_status : null),
      refund_status: preferSiblingStripeFail
        ? "stripe_fail"
        : row.refund_status || row.transaction_refund_status || (isPendingReturnRow ? saleSibling?.refund_status || saleSibling?.transaction_refund_status : null),
      display_status:
        (preferSiblingStripeFail ? siblingState.display_status || "Returned - CC Issue" : null) ||
        row.display_status ||
        (isPendingReturnRow ? saleSibling?.display_status || saleSibling?.pending_return?.display_status : null),
      stripe_refund: row.stripe_refund || saleSibling?.stripe_refund || saleSibling?.pending_return?.stripe_refund,
      pending_return: isPendingReturnRow ? row.pending_return || saleSibling?.pending_return : row.pending_return,
    };
    const statusOverride = getReturnStatusOverrideForRow(returnStatusesByKey, row, orderUid, txnUid);
    // Completed reverse txns: ignore sale-level "returning/pending" cache leftovers.
    const completedStatusOverride = isPendingReturnRow
      ? statusOverride
      : {
          ...statusOverride,
          ...(statusOverride.return_status === "returning" ? { return_status: "returned" } : {}),
          ...(statusOverride.refund_status === "pending" ? { refund_status: "refunded" } : {}),
        };
    const logistics = resolveReturnLogisticsLabels(statusSource, {
      ...completedStatusOverride,
      returnRequested: true,
      saleSibling,
      ...(isPreShipCancelReturn(statusSource, saleSibling) ? { cancel_unshipped: true } : {}),
      ...(isPendingReturnRow
        ? {}
        : {
            return_status: completedStatusOverride.return_status || statusSource.return_status || (isPreShipCancelReturn(statusSource, saleSibling) ? "cancelled" : "returned"),
            refund_status: completedStatusOverride.refund_status || statusSource.refund_status || "refunded",
            display_status:
              completedStatusOverride.display_status || statusSource.display_status || (isPreShipCancelReturn(statusSource, saleSibling) ? "Cancelled - Refunded" : "Returned - Refunded"),
          }),
    });
    const returnRequestData = returnRequestsByKey?.[orderUid] || returnRequestsByKey?.[txnUid] || null;
    const money = resolveReturnRowMoney(row, null, bountyLines);
    const estimated = isPendingReturnRow
      ? estimatePendingReturnMoney(
          {
            ...row,
            pending_return: row.pending_return || saleSibling?.pending_return,
            lines: Array.isArray(row.lines) ? row.lines : Array.isArray(saleSibling?.lines) ? saleSibling.lines : [],
          },
          returnRequestData,
          bountyLines,
        )
      : { total: 0, bountyPaid: 0 };
    const total = money.total || estimated.total || 0;
    const bountyPaid = money.bountyPaid || estimated.bountyPaid || 0;
    const itemSummary = resolveReturnRowItemSummary(row, saleSibling, returnRequestData);
    const rawPurchasedItem = String(row.purchased_item || "").trim();
    const purchasedItemLooksLikeUid = /^\d{3}-\d+$/.test(rawPurchasedItem);
    const withMoney = {
      ...row,
      // Pending return list rows often omit business_name but include seller_id.
      business_name: row.business_name || saleSibling?.business_name || saleSibling?.transaction_business_name || null,
      seller_id: row.seller_id || saleSibling?.seller_id || saleSibling?.transaction_business_id || null,
      transaction_business_id: row.transaction_business_id || saleSibling?.transaction_business_id || saleSibling?.seller_id || null,
      purchase_type: row.purchase_type || saleSibling?.purchase_type || null,
      ti_bs_id: row.ti_bs_id || saleSibling?.ti_bs_id || null,
      transaction_total: total,
      seller_total: total,
      bounty_paid: bountyPaid,
      _pending_return_money: { total, bountyPaid },
      stripe_refund: statusSource.stripe_refund || row.stripe_refund,
      display_status: statusSource.display_status || row.display_status,
      purchased_item:
        itemSummary.purchased_item || (itemSummary.qty != null || purchasedItemLooksLikeUid ? null : rawPurchasedItem && rawPurchasedItem.toLowerCase() !== "item" ? rawPurchasedItem : null),
      ...(itemSummary.qty != null ? { ti_bs_qty: itemSummary.qty } : {}),
      original_transaction_uid: row.original_transaction_uid || row.transaction_original_uid || saleSibling?.transaction_uid || null,
    };
    if (!logistics) return withMoney;
    return applyReturnRefundFieldsToRow(withMoney, logistics);
  });

  return normalizedPurchaseRows.sort((a, b) => {
    const aMs = a._sortDateMs || transactionDateMs(a) || 0;
    const bMs = b._sortDateMs || transactionDateMs(b) || 0;
    const byDate = bMs - aMs;
    if (byDate !== 0) return byDate;
    const aOrder = resolveListRowOrderUid(a);
    const bOrder = resolveListRowOrderUid(b);
    if (aOrder === bOrder) {
      return (isReturnListRow(b) ? 1 : 0) - (isReturnListRow(a) ? 1 : 0);
    }
    return 0;
  });
}

function normalizeOrderDetailPayload(json) {
  const root = json && typeof json === "object" ? json : {};
  const payload = root.data !== undefined && root.data !== null && typeof root.data === "object" && !Array.isArray(root.data) ? root.data : root;
  if (!isApiSuccessCode(payload.code ?? root.code) && payload.sale == null && root.sale == null) {
    throw new Error(String(payload.message || root.message || "Failed to load order detail."));
  }
  return payload.sale != null ? payload : root;
}

function buildOrderDetailUrl(orderUid, { profileId, businessUid, sellerId } = {}) {
  const params = new URLSearchParams();
  if (profileId) params.set("profile_id", profileId);
  if (businessUid) params.set("business_uid", businessUid);
  if (sellerId) params.set("seller_id", sellerId);
  const qs = params.toString();
  const base = `${ORDERS_ENDPOINT}/${encodeURIComponent(orderUid)}`;
  return withTimeZoneQuery(qs ? `${base}?${qs}` : base);
}

/** GET /orders/:uid — personal offering sellers use profile_id + seller_id; business sellers use business_uid + seller_id. */
function buildSellerOrderDetailFetchContext(sellerId, selectedAccount) {
  const sid = String(sellerId || "").trim();
  const ctx = {};
  if (!sid) return ctx;
  ctx.sellerId = sid;
  if (selectedAccount && selectedAccount !== "personal") {
    ctx.businessUid = sid;
  } else {
    ctx.profileId = sid;
  }
  return ctx;
}

async function fetchOrderDetailApi(orderUid, ctx = {}) {
  const url = buildOrderDetailUrl(orderUid, ctx);
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    let message = `Failed to load order (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson?.message) message = String(errJson.message);
    } catch (_) {
      /* ignore */
    }
    throw new Error(message);
  }
  const json = await response.json();
  return normalizeOrderDetailPayload(json);
}

function formatOrderMoney(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

function formatSignedOrderMoney(value) {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return "—";
  if (n < 0) return `-$${Math.abs(n).toFixed(2)}`;
  return `$${n.toFixed(2)}`;
}

/** Return rows for one sale already included in the account-screen payload. */
function getExistingReturnRowsForOrder(rows, orderUid) {
  if (!Array.isArray(rows) || !orderUid || orderUid === "—") return [];
  return rows.filter((row) => isReturnListRow(row) && resolveListRowOrderUid(row) === orderUid);
}

/** Line payloads attached to one return / pending-return event on the account screen. */
function collectReturnEventLinesFromRow(row) {
  if (!row || typeof row !== "object") return [];
  if (Array.isArray(row.return_lines) && row.return_lines.length) return row.return_lines;
  if (Array.isArray(row.pending_return?.items) && row.pending_return.items.length) return row.pending_return.items;
  if (Array.isArray(row.pending_returns) && row.pending_returns.length) {
    return row.pending_returns.flatMap((pending) => (Array.isArray(pending?.items) ? pending.items : []));
  }
  if (Array.isArray(row.transaction_return_items) && row.transaction_return_items.length) return row.transaction_return_items;
  if (Array.isArray(row.lines) && row.lines.length) return row.lines;
  if (row.ti_uid || row.transaction_item_uid) return [row];
  return [];
}

function isReturnEventCancelUnshipped(eventRow) {
  if (!eventRow || typeof eventRow !== "object") return false;
  if (eventRow.cancel_unshipped === true || Number(eventRow.cancel_unshipped) === 1) return true;
  if (eventRow.pre_ship_cancel === true || eventRow.is_cancel_before_ship === true) return true;
  const status = String(eventRow.return_status || eventRow.trr_return_status || "").toLowerCase();
  if (status === "cancelled" || status === "canceled") return true;
  if (/^cancell?ed\s*[-–]/i.test(String(eventRow.display_status || ""))) return true;
  if (returnEventRefundedShipping(eventRow)) return true;
  return false;
}

/** True when a completed return event refunded shipping — strong signal of pre-ship cancel. */
function returnEventRefundedShipping(eventRow) {
  if (!eventRow || typeof eventRow !== "object") return false;
  const shipping = parseFloat(eventRow.transaction_shipping ?? eventRow.shipping_refund ?? 0);
  return Number.isFinite(shipping) && shipping < 0;
}

/** Shipped vs unshipped split for one return line on a prior return request or ledger row. */
function parseReturnEventLineSplit(line, eventRow) {
  if (!line || typeof line !== "object") return { shipped: 0, unshipped: 0, total: 0, splitKnown: true };

  const shippedRaw = line.return_shipped_qty ?? line.shipped_return_qty;
  const unshippedRaw = line.cancel_unshipped_qty ?? line.return_unshipped_qty ?? line.unshipped_return_qty;
  const hasExplicitShipped = shippedRaw != null && String(shippedRaw).trim() !== "";
  const hasExplicitUnshipped = unshippedRaw != null && String(unshippedRaw).trim() !== "";

  if (hasExplicitShipped || hasExplicitUnshipped) {
    const shipped = Math.max(0, parseInt(shippedRaw, 10) || 0);
    const unshipped = Math.max(0, parseInt(unshippedRaw, 10) || 0);
    const total = shipped + unshipped;
    if (total > 0) return { shipped, unshipped, total, splitKnown: true };
  }

  const qty = Math.abs(parseInt(line.return_quantity ?? line.ti_bs_qty ?? line.quantity, 10) || 0);
  if (qty <= 0) return { shipped: 0, unshipped: 0, total: 0, splitKnown: true };

  if (isReturnEventCancelUnshipped(eventRow) || returnEventRefundedShipping(eventRow)) {
    return { shipped: 0, unshipped: qty, total: qty, splitKnown: true };
  }

  if (isReturnListRow(eventRow)) {
    return { shipped: qty, unshipped: 0, total: qty, splitKnown: true };
  }

  return { shipped: 0, unshipped: 0, total: qty, splitKnown: false };
}

/**
 * Shipped vs unshipped quantities already returned/reserved, keyed by transaction-item UID.
 * Uses return_shipped_qty / cancel_unshipped_qty when stored on prior requests.
 */
function buildExistingReturnSplitByLine(returnRows) {
  const splitByLine = {};
  const seenEvents = new Set();

  for (const row of returnRows || []) {
    if (!row || typeof row !== "object") continue;
    const eventUid = String(resolveTrrUid(row) || row.transaction_uid || "").trim();
    const eventKey = eventUid || JSON.stringify(row);
    if (seenEvents.has(eventKey)) continue;
    seenEvents.add(eventKey);

    const eventSplitByLine = {};
    for (const line of collectReturnEventLinesFromRow(row)) {
      const tiUid = String(line?.ti_original_ti_uid || line?.transaction_item_uid || line?.ti_uid || "").trim();
      if (!tiUid) continue;
      const parsed = parseReturnEventLineSplit(line, row);
      const prev = eventSplitByLine[tiUid];
      if (!prev || parsed.total > prev.total) {
        eventSplitByLine[tiUid] = parsed;
      }
    }

    for (const [tiUid, parsed] of Object.entries(eventSplitByLine)) {
      if (!splitByLine[tiUid]) {
        splitByLine[tiUid] = { shipped: 0, unshipped: 0, total: 0, splitKnown: true };
      }
      const bucket = splitByLine[tiUid];
      if (parsed.splitKnown) {
        bucket.shipped += parsed.shipped;
        bucket.unshipped += parsed.unshipped;
        bucket.total += parsed.total;
      } else {
        bucket.total += parsed.total;
        bucket.splitKnown = false;
      }
    }
  }

  return splitByLine;
}

/**
 * Quantities already unavailable for return, keyed by transaction-item UID.
 * Uses one line source per backend return row so mirrored return_lines/lines/pending_return
 * payloads are not counted more than once.
 */
function buildExistingReturnQtyByLine(returnRows) {
  const quantities = {};
  const seenEvents = new Set();

  for (const row of returnRows || []) {
    if (!row || typeof row !== "object") continue;
    const eventUid = String(resolveTrrUid(row) || row.transaction_uid || "").trim();
    const eventKey = eventUid || JSON.stringify(row);
    if (seenEvents.has(eventKey)) continue;
    seenEvents.add(eventKey);

    const eventQtyByLine = {};
    for (const line of collectReturnEventLinesFromRow(row)) {
      const tiUid = String(line?.ti_original_ti_uid || line?.transaction_item_uid || line?.ti_uid || "").trim();
      if (!tiUid) continue;
      const qty = Math.abs(parseInt(line.return_quantity ?? line.ti_bs_qty ?? line.quantity, 10) || 1);
      eventQtyByLine[tiUid] = Math.max(eventQtyByLine[tiUid] || 0, qty);
    }

    for (const [tiUid, qty] of Object.entries(eventQtyByLine)) {
      quantities[tiUid] = (quantities[tiUid] || 0) + qty;
    }
  }

  return quantities;
}

function parseOptionalBoolean(value) {
  if (value === true || value === 1 || String(value).trim().toLowerCase() === "true" || String(value).trim() === "1") return true;
  if (value === false || value === 0 || String(value).trim().toLowerCase() === "false" || String(value).trim() === "0") return false;
  return null;
}

/** Snapshotted return-policy fields from order-detail or receipt line items. */
const RETURN_POLICY_LINE_FIELD_KEYS = [
  "return_eligible",
  "is_return_eligible",
  "return_ineligible_reason",
  "return_eligibility_reason",
  "returnable",
  "is_returnable",
  "bs_is_returnable",
  "ti_bs_is_returnable",
  "return_window_days",
  "bs_return_window_days",
  "ti_bs_return_window_days",
  "return_window_expired",
  "is_return_window_expired",
  "return_window_expires_at",
  "return_eligible_until",
  "return_deadline",
  "profile_expertise_is_returnable",
  "profile_expertise_return_window_days",
  "returned_qty",
  "remaining_qty",
];

function pickReturnPolicyFields(line) {
  if (!line || typeof line !== "object") return {};
  const out = {};
  for (const key of RETURN_POLICY_LINE_FIELD_KEYS) {
    const val = line[key];
    if (val === undefined || val === null) continue;
    if (typeof val === "string" && val.trim() === "") continue;
    out[key] = val;
  }
  return out;
}

function mergeReceiptLineWithOrderDetail(receiptLine, orderLine) {
  if (!orderLine) return receiptLine;
  return {
    ...receiptLine,
    ...pickReturnPolicyFields(orderLine),
    ti_uid: receiptLine?.ti_uid || orderLine.ti_uid || orderLine.transaction_item_uid,
    ti_bs_id: receiptLine?.ti_bs_id || orderLine.ti_bs_id || orderLine.bs_uid,
    bs_uid: receiptLine?.bs_uid || orderLine.bs_uid || orderLine.ti_bs_id,
    bs_service_name: receiptLine?.bs_service_name || orderLine.item_name || orderLine.bs_service_name,
    ti_bs_cost: receiptLine?.ti_bs_cost ?? orderLine.ti_bs_cost,
    ti_bs_qty: receiptLine?.ti_bs_qty ?? orderLine.ti_bs_qty,
    returned_qty: orderLine.returned_qty ?? receiptLine?.returned_qty,
    remaining_qty: orderLine.remaining_qty ?? receiptLine?.remaining_qty,
  };
}

/**
 * Prefer GET /orders/:uid sale.lines (snapshotted return policy + fulfillment qty).
 * Receipt API omits those fields; merge from order detail when both exist.
 */
function resolveReturnModalOrderLines(receiptOrderDetail, receiptLines) {
  const orderLines = Array.isArray(receiptOrderDetail?.sale?.lines) ? receiptOrderDetail.sale.lines : [];
  const receipt = Array.isArray(receiptLines) ? receiptLines : [];

  if (orderLines.length > 0) {
    if (receipt.length === 0) return orderLines;
    return orderLines.map((orderLine) => {
      const tiUid = String(orderLine?.ti_uid || orderLine?.transaction_item_uid || "").trim();
      const bsId = String(orderLine?.ti_bs_id || orderLine?.bs_uid || "").trim();
      const receiptMatch = receipt.find((row) => {
        const rowTiUid = String(row?.ti_uid || row?.transaction_item_uid || "").trim();
        const rowBsId = String(row?.ti_bs_id || row?.bs_uid || "").trim();
        return (tiUid && rowTiUid === tiUid) || (bsId && rowBsId === bsId);
      });
      return receiptMatch ? mergeReceiptLineWithOrderDetail(receiptMatch, orderLine) : orderLine;
    });
  }

  return receipt.map((line) => ({ ...line, ...pickReturnPolicyFields(line) }));
}

/**
 * Prefer the backend's authoritative per-line eligibility. Older payloads may
 * only include the snapshotted returnable/window fields; unknown stays eligible
 * for backward compatibility and is still enforced by the POST endpoint.
 */
function resolveLineReturnEligibility(line) {
  if (!line || typeof line !== "object") return { eligible: true, reason: null };

  const backendEligible = parseOptionalBoolean(line.return_eligible ?? line.is_return_eligible);
  const backendReason = String(line.return_ineligible_reason ?? line.return_eligibility_reason ?? "").trim();
  const snapshottedReturnable = parseOptionalBoolean(line.returnable ?? line.is_returnable ?? line.bs_is_returnable ?? line.ti_bs_is_returnable ?? line.profile_expertise_is_returnable);
  if (backendEligible === false) {
    return {
      eligible: false,
      reason: backendReason || (snapshottedReturnable === false ? "Not returnable" : "Outside return window"),
    };
  }

  const returnable = snapshottedReturnable;
  const windowDaysRaw = line.return_window_days ?? line.bs_return_window_days ?? line.ti_bs_return_window_days ?? line.profile_expertise_return_window_days;
  const windowDays = windowDaysRaw == null || String(windowDaysRaw).trim() === "" ? null : parseInt(windowDaysRaw, 10);
  if (returnable === false || (returnable == null && windowDays === 0)) {
    return { eligible: false, reason: "Not returnable" };
  }

  const expired = parseOptionalBoolean(line.return_window_expired ?? line.is_return_window_expired);
  const expiresAtRaw = line.return_window_expires_at ?? line.return_eligible_until ?? line.return_deadline;
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).getTime() : NaN;
  if (expired === true || (Number.isFinite(expiresAt) && Date.now() > expiresAt)) {
    return { eligible: false, reason: backendReason || "Outside return window" };
  }

  return { eligible: true, reason: null };
}

function buildReturnModalSelectableLines(orderLines, receiptLines, returnRequestData, existingReturnRows = []) {
  const backendReturnQtyByLine = buildExistingReturnQtyByLine(existingReturnRows);
  const backendReturnSplitByLine = buildExistingReturnSplitByLine(existingReturnRows);

  if (Array.isArray(orderLines) && orderLines.length > 0) {
    return orderLines
      .map((line) => {
        const purchasedQty = Math.max(0, parseInt(line.ti_bs_qty, 10) || 0);
        const transactionItemUid = String(line.ti_uid || "").trim();
        if (!transactionItemUid) return null;
        const completedQty = getLineCancelledQty(line) + getLineReturnedQty(line);
        const localSplit = getLocalReturnSplitForLine(returnRequestData, transactionItemUid);
        const localRequestedQty = localSplit.total || getReturnedQtyForLine(returnRequestData, transactionItemUid, purchasedQty);
        const backendUnavailableQty = backendReturnQtyByLine[transactionItemUid] || 0;
        const unavailableQty = Math.max(completedQty, localRequestedQty, backendUnavailableQty);
        const explicitRemaining = parseInt(line.remaining_qty, 10);
        const calculatedRemaining = Math.max(0, purchasedQty - unavailableQty);
        const remainingQty = Number.isFinite(explicitRemaining) ? Math.min(explicitRemaining, calculatedRemaining) : calculatedRemaining;
        const eligibility = resolveLineReturnEligibility(line);
        const shippedOnLine = Math.min(purchasedQty, getLineShippedQty(line));
        const unshippedOnLine = Math.max(0, purchasedQty - shippedOnLine);
        const backendSplit = backendReturnSplitByLine[transactionItemUid] || { shipped: 0, unshipped: 0, splitKnown: false };
        const returnedShippedQty = backendSplit.shipped + localSplit.shipped;
        const returnedUnshippedQty = backendSplit.unshipped + localSplit.unshipped;
        const returnSplitKnown = (backendSplit.splitKnown && (backendSplit.shipped + backendSplit.unshipped > 0 || backendSplit.total === 0)) || localSplit.splitKnown;
        return {
          itemId: transactionItemUid,
          itemName: resolveLineItemDisplayName(line) || "Item",
          unitCost: line.ti_bs_cost,
          purchasedQty,
          remainingQty,
          transactionItemUid,
          shippedQty: shippedOnLine,
          unshippedOnLine,
          returnedShippedQty,
          returnedUnshippedQty,
          returnSplitKnown,
          returnEligible: eligibility.eligible,
          returnIneligibleReason: eligibility.reason,
          line,
        };
      })
      .filter(Boolean);
  }

  return (receiptLines || []).map((item, index) => {
    const purchasedQty = getReceiptLineQty(item);
    const transactionItemUid = getReceiptLineTransactionItemUid(item);
    const localSplit = getLocalReturnSplitForLine(returnRequestData, index);
    const localRequestedQty = localSplit.total || getReturnedQtyForLine(returnRequestData, index, purchasedQty);
    const backendUnavailableQty = backendReturnQtyByLine[transactionItemUid] || 0;
    const alreadyReturnedQty = Math.max(localRequestedQty, backendUnavailableQty);
    const remainingQty = Math.max(0, purchasedQty - alreadyReturnedQty);
    const eligibility = resolveLineReturnEligibility(item);
    const shippedOnLine = Math.min(purchasedQty, getLineShippedQty(item));
    const unshippedOnLine = Math.max(0, purchasedQty - shippedOnLine);
    const backendSplit = backendReturnSplitByLine[transactionItemUid] || { shipped: 0, unshipped: 0, splitKnown: false };
    const returnedShippedQty = backendSplit.shipped + localSplit.shipped;
    const returnedUnshippedQty = backendSplit.unshipped + localSplit.unshipped;
    const returnSplitKnown = (backendSplit.splitKnown && (backendSplit.shipped + backendSplit.unshipped > 0 || backendSplit.total === 0)) || localSplit.splitKnown;
    return {
      itemId: String(index),
      itemName: resolveLineItemDisplayName(item) || "Item",
      unitCost: item.ti_bs_cost,
      purchasedQty,
      remainingQty,
      transactionItemUid,
      receiptIndex: index,
      shippedQty: shippedOnLine,
      unshippedOnLine,
      returnedShippedQty,
      returnedUnshippedQty,
      returnSplitKnown,
      returnEligible: eligibility.eligible,
      returnIneligibleReason: eligibility.reason,
      line: item,
    };
  });
}

function getReturnModalLineLeftSellerQty(line, purchasedQty) {
  if (!line || purchasedQty <= 0) return 0;
  const shipped = Math.min(purchasedQty, getLineShippedQty(line));
  const verified = Math.min(purchasedQty, getPreviouslyReceivedQty(line));
  // Shipping-required lines: buyer may only return units they have verified received.
  if (lineWasPurchasedForShipping(line)) return Math.min(shipped, verified);
  return Math.max(shipped, verified);
}

function getReturnModalQtyLabels(line) {
  const receivedWording = !lineWasPurchasedForShipping(line);
  if (receivedWording) {
    return {
      leftShort: "Received items to return",
      notLeftShort: "Unreceived items to cancel",
      leftSimple: "How many received items are you returning?",
      notLeftSimple: "How many unreceived items are you cancelling?",
      mixedIntro: "This item has both received and unreceived units",
      hintMixed: (left, notLeft) => `${left} received · ${notLeft} unreceived`,
      hintAllLeft: (n) => `${n} received`,
      hintAllNotLeft: (n) => `${n} unreceived`,
    };
  }
  return {
    leftShort: "Shipped items to return",
    notLeftShort: "Unshipped items to cancel",
    leftSimple: "How many shipped items are you returning?",
    notLeftSimple: "How many unshipped items are you cancelling?",
    mixedIntro: "This item has both shipped and unshipped units.",
    hintMixed: (left, notLeft) => `${left} shipped · ${notLeft} not shipped`,
    hintAllLeft: (n) => `${n} shipped`,
    hintAllNotLeft: (n) => `${n} not shipped`,
  };
}

function getReturnModalLineFulfillmentCaps(row) {
  const line = row?.line || row;
  const purchasedQty = Math.max(0, row?.purchasedQty ?? getLinePurchasedQty(line));
  const remainingQty = Math.max(0, row?.remainingQty ?? 0);
  const shippedOnOrder = Math.min(purchasedQty, getLineShippedQty(line));
  const verifiedOnOrder = Math.min(purchasedQty, getPreviouslyReceivedQty(line));
  const returnableShippedPool = lineWasPurchasedForShipping(line) ? Math.min(shippedOnOrder, verifiedOnOrder) : Math.max(shippedOnOrder, verifiedOnOrder);
  const unshippedOnOrder = Math.max(0, purchasedQty - shippedOnOrder);
  const alreadyCancelled = getLineCancelledQty(line);
  const cancelableUnshippedPool = Math.max(0, unshippedOnOrder - alreadyCancelled);
  const alreadyReturned = Math.max(0, purchasedQty - remainingQty);

  let returnedFromLeft = 0;
  let returnedFromNotLeft = 0;
  if (row?.returnSplitKnown) {
    returnedFromLeft = Math.max(0, parseInt(row.returnedShippedQty, 10) || 0);
    returnedFromNotLeft = Math.max(0, parseInt(row.returnedUnshippedQty, 10) || 0);
    const splitTotal = returnedFromLeft + returnedFromNotLeft;
    if (alreadyReturned > 0 && splitTotal > alreadyReturned) {
      // Prefer unshipped when prior cancels were misclassified as shipped returns.
      if (returnedFromNotLeft >= alreadyReturned) {
        returnedFromNotLeft = alreadyReturned;
        returnedFromLeft = 0;
      } else {
        returnedFromLeft = Math.min(returnedFromLeft, Math.max(0, alreadyReturned - returnedFromNotLeft));
        returnedFromNotLeft = Math.max(0, alreadyReturned - returnedFromLeft);
      }
    }
  } else if (alreadyReturned > 0) {
    // Legacy rows without split metadata: assume unshipped/cancel units returned first.
    returnedFromNotLeft = Math.min(alreadyReturned, cancelableUnshippedPool + alreadyCancelled);
    returnedFromLeft = Math.max(0, alreadyReturned - returnedFromNotLeft);
  }

  let remainingLeft = Math.max(0, returnableShippedPool - returnedFromLeft);
  let remainingNotLeft = Math.max(0, cancelableUnshippedPool - returnedFromNotLeft);
  if (remainingLeft + remainingNotLeft > remainingQty && remainingQty > 0) {
    remainingLeft = Math.min(remainingLeft, remainingQty);
    remainingNotLeft = Math.min(remainingNotLeft, Math.max(0, remainingQty - remainingLeft));
  }
  const hasMixedFulfillment = remainingLeft > 0 && remainingNotLeft > 0 && remainingQty > 0;
  return {
    purchasedQty,
    remainingQty,
    shippedOnLine: shippedOnOrder,
    unshippedOnLine: unshippedOnOrder,
    remainingLeft,
    remainingNotLeft,
    returnedFromLeft,
    returnedFromNotLeft,
    hasMixedFulfillment,
    allShipped: remainingLeft > 0 && remainingNotLeft <= 0,
    allUnshipped: remainingNotLeft > 0 && remainingLeft <= 0,
    maxReturnShippedQty: Math.min(remainingQty, remainingLeft),
    maxCancelUnshippedQty: Math.min(remainingQty, remainingNotLeft),
  };
}

/** Subtitle under item row, e.g. "3 shipped (1 verified) · 5 not shipped" — actual fulfillment, not returnable caps. */
function buildReturnModalFulfillmentSubtitle(row, caps) {
  const line = row?.line || row;
  const shippedOnOrder = Math.max(0, caps?.shippedOnLine ?? 0);
  const returnedFromLeft = Math.max(0, caps?.returnedFromLeft ?? 0);
  const shippedCount = Math.max(0, shippedOnOrder - returnedFromLeft);
  const notShippedCount = Math.max(0, caps?.remainingNotLeft ?? 0);
  if (shippedCount < 1 && notShippedCount < 1) return null;

  const parts = [];
  if (shippedCount > 0) {
    if (lineWasPurchasedForShipping(line)) {
      const verifiedQty = Math.min(shippedCount, getPreviouslyReceivedQty(line));
      const returnableVerified = Math.max(0, verifiedQty - Math.max(0, caps?.returnedFromLeft ?? 0));
      if (returnableVerified > 0 && returnableVerified < shippedCount) {
        parts.push(`${shippedCount} shipped (${returnableVerified} verified returnable)`);
      } else if (verifiedQty > 0) {
        parts.push(`${shippedCount} shipped (${verifiedQty} verified)`);
      } else {
        parts.push(`${shippedCount} shipped`);
      }
    } else {
      parts.push(`${shippedCount} received`);
    }
  }
  if (notShippedCount > 0) {
    parts.push(lineWasPurchasedForShipping(line) ? `${notShippedCount} not shipped` : `${notShippedCount} unreceived`);
  }
  return parts.join(" · ");
}

function normalizeReturnItemSplitQty(split, caps) {
  const shipped = Math.max(0, parseInt(split?.shipped, 10) || 0);
  const unshipped = Math.max(0, parseInt(split?.unshipped, 10) || 0);
  let s = Math.min(shipped, caps.maxReturnShippedQty);
  let u = Math.min(unshipped, caps.maxCancelUnshippedQty);
  if (s + u > caps.remainingQty) {
    u = Math.max(0, Math.min(u, caps.remainingQty - s));
    s = Math.max(0, Math.min(s, caps.remainingQty - u));
  }
  if (s + u < 1 && caps.remainingQty > 0) {
    if (caps.allUnshipped) u = Math.min(1, caps.maxCancelUnshippedQty);
    else if (caps.allShipped || caps.hasMixedFulfillment) s = Math.min(1, caps.maxReturnShippedQty);
    else u = Math.min(1, caps.maxCancelUnshippedQty);
  }
  return { shipped: s, unshipped: u };
}

function initialReturnItemSplitQty(row) {
  const caps = getReturnModalLineFulfillmentCaps(row);
  if (caps.hasMixedFulfillment) {
    return { shipped: 0, unshipped: Math.min(1, caps.maxCancelUnshippedQty) };
  }
  if (caps.allUnshipped) {
    return { shipped: 0, unshipped: Math.min(1, caps.remainingQty) };
  }
  return { shipped: Math.min(1, caps.remainingQty), unshipped: 0 };
}

function isReturnItemSplitValid(row, split) {
  const caps = getReturnModalLineFulfillmentCaps(row);
  if (caps.remainingQty <= 0) return false;
  const { shipped, unshipped } = normalizeReturnItemSplitQty(split, caps);
  if (shipped + unshipped < 1) return false;
  if (shipped + unshipped > caps.remainingQty) return false;
  if (shipped > caps.maxReturnShippedQty || unshipped > caps.maxCancelUnshippedQty) return false;
  return true;
}

function buildTransactionReturnItemPayload(row, split) {
  const caps = getReturnModalLineFulfillmentCaps(row);
  const { shipped, unshipped } = normalizeReturnItemSplitQty(split, caps);
  return {
    transaction_item_uid: row.transactionItemUid,
    return_quantity: shipped + unshipped,
    return_shipped_qty: shipped,
    cancel_unshipped_qty: unshipped,
    item_name: row.itemName || undefined,
    bs_service_name: row.itemName || undefined,
  };
}

function resolveReturnRequestCancelFlags(transactionReturnItems) {
  const items = Array.isArray(transactionReturnItems) ? transactionReturnItems : [];
  const hasCancelUnshipped = items.some((item) => (parseInt(item.cancel_unshipped_qty, 10) || 0) > 0);
  const hasShippedReturn = items.some((item) => (parseInt(item.return_shipped_qty, 10) || 0) > 0);
  const cancelOnly = hasCancelUnshipped && !hasShippedReturn && items.every((item) => (parseInt(item.return_shipped_qty, 10) || 0) === 0);
  return { hasCancelUnshipped, hasShippedReturn, cancelOnly };
}

function parseOrderMoneyField(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

const ORDER_TRANSACTION_SHIPPING_KEYS = ["transaction_shipping", "total_shipping", "shipping_amount", "shipping_cost", "shipping"];

function parseOrderTransactionShipping(source, fallback) {
  const value = receiptMoneyFromSources(source, fallback, ORDER_TRANSACTION_SHIPPING_KEYS);
  return value != null ? value : null;
}

const ORDER_LINE_SHIPPING_TOTAL_KEYS = ["ti_line_shipping_amount", "line_shipping_amount", "ti_shipping_total", "line_shipping_total", "shipping_total", "ti_total_shipping", "total_line_shipping"];
const ORDER_LINE_SHIPPING_UNIT_KEYS = ["ti_shipping_amount", "ti_shipping_unit", "shipping_unit", "ti_shipping_per_unit", "unit_shipping"];
const ORDER_LINE_SHIPPING_KEYS = ["line_shipping", "shipping_amount", "shipping_cost", "shipping", "ti_shipping", "ti_shipping_cost", "item_shipping"];

/** Per-line shipping charged on an order detail row (line total, not unit merchandise). */
function getOrderLineShippingAmount(line, qty = 1) {
  if (!line || typeof line !== "object") return null;
  for (const key of ORDER_LINE_SHIPPING_TOTAL_KEYS) {
    const total = receiptMoneyNullable(line[key]);
    if (total != null) return total;
  }
  const safeQty = Math.max(1, parseInt(qty, 10) || 1);
  for (const key of ORDER_LINE_SHIPPING_UNIT_KEYS) {
    const unit = receiptMoneyNullable(line[key]);
    if (unit != null) return unit * safeQty;
  }
  for (const key of ORDER_LINE_SHIPPING_KEYS) {
    const amount = receiptMoneyNullable(line[key]);
    if (amount != null) return amount;
  }
  return null;
}

const ORDER_LINE_SHIPPING_REFUNDABLE_KEYS = ["ti_bs_shipping_refundable", "bs_shipping_refundable", "shipping_refundable", "ti_shipping_refundable", "is_shipping_refundable"];

function isLineShippingRefundable(line) {
  if (!line || typeof line !== "object") return false;
  for (const key of ORDER_LINE_SHIPPING_REFUNDABLE_KEYS) {
    const v = line[key];
    if (v === true || v === 1 || v === "1") return true;
    if (v === false || v === 0 || v === "0") return false;
  }
  return false;
}

/** Return-line qty that never shipped (backend may override with return_unshipped_qty). */
function getReturnLineUnshippedQty(line, returnQtyOverride) {
  if (!line || typeof line !== "object") return 0;
  const returnQty = Math.max(0, parseInt(returnQtyOverride ?? line?.return_quantity ?? line?.ti_bs_qty, 10) || 0);
  if (returnQty <= 0) return 0;
  for (const key of ["return_unshipped_qty", "unshipped_return_qty", "cancel_unshipped_qty", "ti_return_unshipped_qty"]) {
    const explicit = parseInt(line[key], 10);
    if (Number.isFinite(explicit) && explicit >= 0) return Math.min(returnQty, explicit);
  }
  const purchasedQty = Math.max(1, getLinePurchasedQty(line) || 1);
  const shippedQty = Math.min(purchasedQty, getLineShippedQty(line));
  const unshippedOnLine = Math.max(0, purchasedQty - shippedQty);
  return Math.min(returnQty, unshippedOnLine);
}

/** Per-unit buyer shipping snapshotted at checkout (ti_shipping_amount). */
function getReturnLinePerUnitShippingAmount(line) {
  if (!line || typeof line !== "object") return 0;
  for (const key of ORDER_LINE_SHIPPING_UNIT_KEYS) {
    const unit = receiptMoneyNullable(line[key]);
    if (unit != null && unit > 0) return unit;
  }
  const purchasedQty = Math.max(1, getLinePurchasedQty(line) || getReceiptLineQty(line) || 1);
  for (const key of ORDER_LINE_SHIPPING_TOTAL_KEYS) {
    const total = receiptMoneyNullable(line[key]);
    if (total != null && total > 0) {
      return Math.round((total / purchasedQty) * 100) / 100;
    }
  }
  for (const key of ORDER_LINE_SHIPPING_KEYS) {
    const amount = receiptMoneyNullable(line[key]);
    if (amount != null && amount > 0) {
      return Math.round((amount / purchasedQty) * 100) / 100;
    }
  }
  return 0;
}

/** Total line shipping charged at checkout (all units on the line). */
function getReturnLineFlatShippingAmount(line) {
  const purchasedQty = Math.max(1, getLinePurchasedQty(line) || 1);
  const perUnit = getReturnLinePerUnitShippingAmount(line);
  if (perUnit > 0) {
    return Math.round(perUnit * purchasedQty * 100) / 100;
  }
  const lineShipping = getOrderLineShippingAmount(line, purchasedQty);
  if (lineShipping == null || lineShipping <= 0) return 0;
  return Math.round(lineShipping * 100) / 100;
}

/**
 * Refundable shipping for a return line — per-unit × returned/cancelled qty.
 * - Refundable lines: per_unit × return_quantity (shipped or cancelled units).
 * - Non-refundable: per_unit × cancel_unshipped_qty only (pre-ship cancel).
 */
function getReturnLineRefundableShippingAmount(line, returnQtyOverride) {
  const returnQty = Math.max(0, parseInt(returnQtyOverride ?? line?.return_quantity ?? line?.ti_bs_qty, 10) || 0);
  if (returnQty <= 0) return 0;

  const perUnit = getReturnLinePerUnitShippingAmount(line);
  if (perUnit <= 0) return 0;

  const explicitShippedReturn = parseInt(line?.return_shipped_qty ?? line?.ti_return_shipped_qty, 10);
  const explicitCancelUnshipped = parseInt(line?.cancel_unshipped_qty ?? line?.ti_cancel_unshipped_qty, 10);
  const hasExplicitSplit = (Number.isFinite(explicitShippedReturn) && explicitShippedReturn >= 0) || (Number.isFinite(explicitCancelUnshipped) && explicitCancelUnshipped >= 0);

  let refundableQty = 0;
  if (hasExplicitSplit) {
    if (isLineShippingRefundable(line)) {
      refundableQty = returnQty;
    } else {
      refundableQty = Number.isFinite(explicitCancelUnshipped) && explicitCancelUnshipped >= 0 ? explicitCancelUnshipped : 0;
    }
  } else if (isLineShippingRefundable(line)) {
    refundableQty = returnQty;
  } else {
    refundableQty = getReturnLineUnshippedQty(line, returnQty);
  }

  if (refundableQty <= 0) return 0;
  return Math.round(perUnit * refundableQty * 100) / 100;
}

function parseReturnRefundShippingFromSource(source, keys = ["shipping_refund", "returned_shipping", "refund_shipping", "transaction_shipping", "total_shipping", "shipping_amount"]) {
  if (!source || typeof source !== "object") return null;
  for (const key of keys) {
    const n = receiptMoneyNullable(source[key]);
    if (n != null) return Math.abs(n);
  }
  return null;
}

function parseEstimatedRefundShipping(estimated) {
  return parseReturnRefundShippingFromSource(estimated, ["shipping_refund", "returned_shipping", "refund_shipping"]);
}

/** True when returned merchandise equals the original sale merchandise (full-line or full-order return). */
function isFullMerchandiseReturn(sale, itemMerchandise) {
  const saleAmount = Math.abs(parseOrderMoneyField(sale?.transaction_amount));
  const merch = Math.abs(Number(itemMerchandise) || 0);
  if (!saleAmount || !merch) return false;
  return merch >= saleAmount - 0.02;
}

/** Proportional sales tax for a pending/completed return — full tax when entire order is returned. */
function estimateProportionalReturnTax(sale, itemMerchandise, pending = null) {
  const merch = Math.abs(Number(itemMerchandise) || 0);
  if (!merch) return 0;
  const fromEstimated = parseOrderMoneyField(pending?.estimated_refund?.taxes ?? pending?.estimated_refund?.transaction_taxes);
  if (fromEstimated > 0) return fromEstimated;
  const fromPending = parseOrderMoneyField(pending?.taxes ?? pending?.transaction_taxes);
  if (fromPending > 0) return fromPending;
  const saleAmount = Math.abs(parseOrderMoneyField(sale?.transaction_amount));
  const saleTaxes = Math.abs(parseOrderMoneyField(sale?.transaction_taxes));
  if (saleAmount > 0 && saleTaxes > 0) {
    if (isFullMerchandiseReturn(sale, merch)) return saleTaxes;
    return saleTaxes * (merch / saleAmount);
  }
  return 0;
}

/** Customer credit for a return row: merchandise + tax + shipping (excludes non-refundable card fees). */
function resolveReturnCustomerCreditTotal(row) {
  if (!row || typeof row !== "object") return 0;
  const amount = Math.abs(parseOrderMoneyField(row.transaction_amount));
  const taxes = Math.abs(parseOrderMoneyField(row.transaction_taxes));
  const shipping = Math.abs(parseOrderTransactionShipping(row, null) ?? parseReturnRefundShippingFromSource(row) ?? 0);
  const fromComponents = Math.round((amount + taxes + shipping) * 100) / 100;
  // List rows may omit transaction_shipping; transaction_total is refund_grand (authoritative when larger).
  // For pre-fix returns, component sum can exceed an under-credited transaction_total.
  const txnTotalAbs = Math.abs(parseOrderMoneyField(row.transaction_total));
  const creditAbs = Math.round(Math.max(fromComponents, txnTotalAbs) * 100) / 100;
  if (creditAbs > 0.01) return -creditAbs;
  return 0;
}

/** Customer-refundable order total (merchandise + tax + shipping; excludes non-refundable card fees). */
function orderRefundableCustomerTotal(sale) {
  const amount = Math.abs(parseOrderMoneyField(sale?.transaction_amount));
  const taxes = Math.abs(parseOrderMoneyField(sale?.transaction_taxes));
  const shipping = Math.abs(parseOrderTransactionShipping(sale, null) ?? 0);
  return Math.round((amount + taxes + shipping) * 100) / 100;
}

/** Refundable shipping — line-item proration first, then pending estimate, then full order on full returns. */
function estimateReverseReturnShipping(sale, itemMerchandise, computedShippingRefund, estimatedTax, pending = null) {
  if (computedShippingRefund > 0) return computedShippingRefund;
  const fromEstimated = parseEstimatedRefundShipping(pending?.estimated_refund);
  if (fromEstimated > 0) return fromEstimated;
  const merch = Math.abs(Number(itemMerchandise) || 0);
  if (!isFullMerchandiseReturn(sale, merch)) return 0;
  const orderShipping = parseOrderTransactionShipping(sale, null);
  if (orderShipping != null && orderShipping > 0) return Math.abs(orderShipping);
  return 0;
}

function formatOrderShippingCell(value, signedRows) {
  if (value == null || !Number.isFinite(value)) return "—";
  return signedRows ? formatSignedOrderMoney(value) : formatOrderMoney(value);
}

function buildOrderDetailFinancialBreakdown(sale, returns, summary) {
  const saleAmount = parseOrderMoneyField(sale?.transaction_amount);
  const saleTaxes = parseOrderMoneyField(sale?.transaction_taxes);
  const saleShipping = parseOrderTransactionShipping(sale, summary) ?? 0;
  const saleFees = parseOrderMoneyField(sale?.transaction_fees);
  const saleTotal = parseOrderMoneyField(sale?.transaction_total) || parseOrderMoneyField(summary?.gross_total);

  let returnedAmount = 0;
  let returnedTaxes = 0;
  let returnedShipping = 0;
  let returnedFees = 0;
  let returnedTotal = 0;
  for (const ret of returns || []) {
    returnedAmount += parseOrderMoneyField(ret.transaction_amount);
    returnedTaxes += parseOrderMoneyField(ret.transaction_taxes);
    returnedShipping += parseOrderTransactionShipping(ret, null) ?? 0;
    returnedFees += parseOrderMoneyField(ret.transaction_fees);
    returnedTotal += parseOrderMoneyField(ret.transaction_total);
  }

  const hasReturns = (returns || []).length > 0;
  const netAmount = saleAmount + returnedAmount;
  const netTaxes = saleTaxes + returnedTaxes;
  const netShipping = saleShipping + returnedShipping;
  const netFees = saleFees + returnedFees;
  const netTotal = parseOrderMoneyField(summary?.net_total) || saleTotal + returnedTotal;

  return {
    saleAmount,
    saleTaxes,
    saleShipping,
    saleFees,
    saleTotal,
    returnedAmount,
    returnedTaxes,
    returnedShipping,
    returnedFees,
    returnedTotal: parseOrderMoneyField(summary?.returned_total) || returnedTotal,
    netAmount,
    netTaxes,
    netShipping,
    netFees,
    netTotal,
    hasReturns,
  };
}

/** Reverse (return) money details for Return Details modal — amount, tax, fees, bounty, total. */
function mapPendingReturnItemsToLines(pendingItems, saleLines = []) {
  if (!Array.isArray(pendingItems) || !pendingItems.length) return [];
  const byUid = {};
  for (const line of saleLines || []) {
    const uid = String(line.ti_uid || line.transaction_item_uid || "").trim();
    if (uid) byUid[uid] = line;
  }
  return pendingItems
    .map((item) => {
      const uid = String(item.transaction_item_uid || item.ti_uid || "").trim();
      const base = byUid[uid] || {};
      const shippedReturnQty = Math.max(0, parseInt(item.return_shipped_qty ?? item.shipped_return_qty, 10) || 0);
      const cancelUnshippedQty = Math.max(0, parseInt(item.cancel_unshipped_qty ?? item.return_unshipped_qty, 10) || 0);
      const explicitTotal = shippedReturnQty + cancelUnshippedQty;
      const qty = Math.max(1, parseInt(item.return_quantity ?? item.quantity ?? item.qty, 10) || explicitTotal || 1);
      const purchasedQty = Math.max(qty, parseInt(base.ti_bs_qty ?? base.purchased_qty ?? item.purchased_qty, 10) || qty);
      const itemName = resolveLineItemDisplayName(item) || resolveLineItemDisplayName(base) || "Item";
      return {
        ...base,
        ...item,
        ti_uid: uid || base.ti_uid,
        item_name: itemName,
        bs_service_name: item.bs_service_name || base.bs_service_name || (itemName !== "Item" ? itemName : undefined),
        ti_bs_id: item.ti_bs_id || base.ti_bs_id,
        ti_bs_cost: item.ti_bs_cost ?? base.ti_bs_cost,
        return_quantity: qty,
        ti_bs_qty: qty,
        return_shipped_qty: item.return_shipped_qty ?? item.shipped_return_qty,
        cancel_unshipped_qty: item.cancel_unshipped_qty ?? item.return_unshipped_qty,
        purchased_qty: purchasedQty,
        ti_purchased_qty: purchasedQty,
      };
    })
    .filter((line) => line.ti_uid || resolveLineItemDisplayName(line));
}

function collectReturnDetailLines(orderDetail, scope = null) {
  const scoped = resolveScopedReturnDetail(orderDetail, scope || {});
  const sale = orderDetail?.sale || null;
  const saleLines = Array.isArray(sale?.lines) ? sale.lines : [];
  const sourceRow = scope?.sourceReturnRow && typeof scope.sourceReturnRow === "object" ? scope.sourceReturnRow : null;

  const returns = scoped.hasScope ? scoped.matchedReturns : Array.isArray(orderDetail?.returns) ? orderDetail.returns : [];
  const fromReturns = [];
  for (const ret of returns) {
    for (const line of ret.lines || []) {
      fromReturns.push(line);
    }
  }
  if (fromReturns.length) return fromReturns;

  let pendingItems = [];
  if (scoped.hasScope) {
    pendingItems = (scoped.matchedPendings || []).flatMap((pending) => (Array.isArray(pending?.items) ? pending.items : []));
    if (!pendingItems.length && sourceRow) {
      const rowLines = Array.isArray(sourceRow.return_lines) ? sourceRow.return_lines : [];
      if (rowLines.length) return rowLines;
      pendingItems = collectItemsFromPendingReturns(sourceRow);
    }
  } else {
    pendingItems = orderDetail?.pending_return?.items || sale?.pending_return?.items || orderDetail?.pending_return_items || sale?.transaction_return_items || [];
  }
  const fromPending = mapPendingReturnItemsToLines(pendingItems, saleLines);
  if (fromPending.length) return fromPending;

  // When scoped to a specific return, never fall back to other returns / all marked lines.
  if (scoped.hasScope) return [];

  const markedReturned = saleLines.filter((line) => {
    const returnedQty = parseInt(line.returned_qty ?? line.return_quantity, 10);
    return Number.isFinite(returnedQty) && returnedQty > 0;
  });
  if (markedReturned.length) {
    return markedReturned.map((line) => ({
      ...line,
      return_quantity: Math.max(1, parseInt(line.returned_qty ?? line.return_quantity, 10) || 1),
      ti_bs_qty: Math.max(1, parseInt(line.returned_qty ?? line.return_quantity, 10) || 1),
    }));
  }

  // Do not fall back to the full order — that inflates reverse totals.
  return [];
}

/** Shipped-return vs pre-ship-cancel quantities on one pending return line. */
function parseReturnDetailLineSplit(line, saleLine = null) {
  if (!line || typeof line !== "object") return { shipped: 0, unshipped: 0, total: 0, splitKnown: false };
  const shipped = Math.max(0, parseInt(line.return_shipped_qty ?? line.ti_return_shipped_qty ?? line.shipped_return_qty, 10) || 0);
  const unshipped = Math.max(0, parseInt(line.cancel_unshipped_qty ?? line.ti_cancel_unshipped_qty ?? line.return_unshipped_qty ?? line.unshipped_return_qty, 10) || 0);
  if (shipped > 0 || unshipped > 0) {
    return { shipped, unshipped, total: shipped + unshipped, splitKnown: true };
  }
  const total = Math.max(0, parseInt(line.return_quantity ?? line.ti_bs_qty ?? line.quantity, 10) || 0);
  if (total <= 0) return { shipped: 0, unshipped: 0, total: 0, splitKnown: false };
  if (saleLine && lineHasLeftSeller(saleLine)) {
    return { shipped: total, unshipped: 0, total, splitKnown: false };
  }
  if (saleLine && !lineHasLeftSeller(saleLine)) {
    return { shipped: 0, unshipped: total, total, splitKnown: false };
  }
  return { shipped: total, unshipped: 0, total, splitKnown: false };
}

/** Expand raw return lines into separate return vs cancel rows for seller confirmation. */
function collectReturnDetailSplitLines(orderDetail, scope = null) {
  const rawLines = collectReturnDetailLines(orderDetail, scope);
  const saleLines = Array.isArray(orderDetail?.sale?.lines) ? orderDetail.sale.lines : [];
  const splitLines = [];
  for (const line of rawLines) {
    const tiUid = String(line.ti_uid || line.transaction_item_uid || "").trim();
    const saleLine = saleLines.find((row) => String(row?.ti_uid || row?.transaction_item_uid || "").trim() === tiUid) || null;
    const split = parseReturnDetailLineSplit(line, saleLine);
    if (split.shipped > 0) {
      splitLines.push({
        ...line,
        return_quantity: split.shipped,
        ti_bs_qty: split.shipped,
        return_kind: "return",
        return_shipped_qty: split.shipped,
        cancel_unshipped_qty: 0,
        _splitKey: `${tiUid || "line"}:return`,
        parent_ti_uid: tiUid || null,
      });
    }
    if (split.unshipped > 0) {
      splitLines.push({
        ...line,
        return_quantity: split.unshipped,
        ti_bs_qty: split.unshipped,
        return_kind: "cancel",
        return_shipped_qty: 0,
        cancel_unshipped_qty: split.unshipped,
        _splitKey: `${tiUid || "line"}:cancel`,
        parent_ti_uid: tiUid || null,
      });
    }
    if (split.shipped === 0 && split.unshipped === 0 && split.total > 0) {
      const kind = saleLine && !lineHasLeftSeller(saleLine) ? "cancel" : "return";
      splitLines.push({
        ...line,
        return_quantity: split.total,
        ti_bs_qty: split.total,
        return_kind: kind,
        _splitKey: `${tiUid || "line"}:${kind}`,
        parent_ti_uid: tiUid || null,
      });
    }
  }
  return splitLines;
}

function analyzeReturnDetailSplit(returnItems) {
  const items = Array.isArray(returnItems) ? returnItems : [];
  let returnQty = 0;
  let cancelQty = 0;
  for (const item of items) {
    const qty = Math.max(0, parseInt(item.qty, 10) || 0);
    if (item.returnKind === "cancel") cancelQty += qty;
    else returnQty += qty;
  }
  const hasReturn = returnQty > 0;
  const hasCancel = cancelQty > 0;
  return {
    hasReturn,
    hasCancel,
    isHybrid: hasReturn && hasCancel,
    cancelOnly: hasCancel && !hasReturn,
    returnOnly: hasReturn && !hasCancel,
    returnQty,
    cancelQty,
  };
}

/** Seller receipt summary keyed by split row — for confirm payload / future backend sync. */
function buildReturnReceivedSplitSummary(returnItems, receivedKeys = []) {
  const receivedSet = new Set(receivedKeys || []);
  return (returnItems || []).map((item) => ({
    transaction_item_uid: String(item.line?.ti_uid || item.line?.transaction_item_uid || item.parentKey || "").trim() || null,
    return_kind: item.returnKind || null,
    qty: Math.max(0, parseInt(item.qty, 10) || 0),
    received: item.returnKind === "cancel" ? true : receivedSet.has(item.key),
  }));
}

/** Enriched return-line rows for Return Details (options, amounts, bounty). */
function buildReturnDetailDisplayItems(orderDetail, bountyRows = [], scope = null, saleBountyPool = null, { splitByKind = true } = {}) {
  const sale = orderDetail?.sale || null;
  const transactionUid = String(sale?.transaction_uid || orderDetail?.order_uid || "").trim();
  const saleBountyPaid =
    saleBountyPool != null && saleBountyPool > 0 ? saleBountyPool : resolveReturnDetailBountyPool(sale, bountyRows, transactionUid, { sourceReturnRow: scope?.sourceReturnRow || null });
  const salePurchasedQty = Math.max(
    1,
    parseInt(sale?.ti_bs_qty ?? (Array.isArray(sale?.lines) && sale.lines.length ? Math.max(...sale.lines.map((l) => parseInt(l?.ti_bs_qty ?? 0, 10) || 0)) : null) ?? NaN, 10) || 1,
  );
  const lines = splitByKind ? collectReturnDetailSplitLines(orderDetail, scope) : collectReturnDetailLines(orderDetail, scope);
  return lines.map((line, index) => {
    const parentKey = String(line.parent_ti_uid || line.ti_uid || line.transaction_item_uid || `return-line-${index}`).trim();
    const key = String(line._splitKey || parentKey).trim();
    const returnKind = line.return_kind === "cancel" ? "cancel" : line.return_kind === "return" ? "return" : null;
    const qty = Math.max(1, parseInt(line.return_quantity ?? line.ti_bs_qty, 10) || 1);
    const unitCost = Math.abs(parseFloat(line.ti_bs_cost ?? line.unit_cost ?? line.unit_price ?? 0) || 0);
    const baseCost = Math.abs(parseFloat(line.unit_price ?? line.ti_unit_price ?? line.base_cost ?? line.ti_bs_cost ?? unitCost) || 0);
    const lineTotal = unitCost * qty;
    const enrichment = enrichFromReceiptRow(line);
    const choiceSource = enrichment || {
      selectedChoiceItems: parseReceiptJsonField(line.selected_choice_items ?? line.ti_selected_choice_items, []),
      selectedChoiceLabels: parseReceiptJsonField(line.selected_choice_labels ?? line.ti_selected_choice_labels, {}),
      selected_options: Array.isArray(line.selected_options) ? line.selected_options : [],
      choicesExtraCost: parseFloat(line.choices_extra_cost ?? line.ti_choices_extra_cost ?? 0) || 0,
    };
    const bountyAmounts = resolveReturnLineBountyAmounts(line, qty, bountyRows, transactionUid, saleBountyPaid, salePurchasedQty);
    const refundableShipping = getReturnLineRefundableShippingAmount(line, qty);

    return {
      key,
      parentKey,
      returnKind,
      itemName: line.item_name || line.bs_service_name || "Item",
      description: line.item_name || line.bs_service_desc || line.bs_service_name || "Item",
      qty,
      unitCost,
      baseCost,
      lineTotal,
      refundableShipping,
      lineBounty: bountyAmounts.lineBounty,
      earnedShare: bountyAmounts.earnedShare,
      bountyPaidReversed: bountyAmounts.bountyPaidReversed,
      bountyItemLabel: bountyAmounts.itemLabel,
      bountyShareLabel: bountyAmounts.shareLabel,
      choiceSource,
      specialInstructions: enrichment?.specialInstructions || String(line.special_instructions ?? line.ti_special_instructions ?? "").trim(),
      line,
    };
  });
}

/**
 * Bounty reversed on a return — prefer line-level math for partial returns,
 * never the full order bounty pool when return line items are present.
 */
function resolveReverseTransactionBountyAmount({ items, itemBounty, pendingBountyExplicit, bountyPool }) {
  const pending = Math.round(Math.abs(Number(pendingBountyExplicit) || 0) * 100) / 100;
  if (pending > 0) return pending;
  const lineTotal = Math.round(Math.abs(Number(itemBounty) || 0) * 100) / 100;
  const hasReturnLineItems = Array.isArray(items) && items.length > 0;
  if (hasReturnLineItems && lineTotal > 0) {
    return lineTotal;
  }
  if (lineTotal > 0) return lineTotal;
  return Math.round(Math.abs(Number(bountyPool) || 0) * 100) / 100;
}

/**
 * Reverse totals from returned items only (never the full original sale).
 * Prefers pending_return.estimated_refund for customer credit; bounty uses line-level totals.
 */
function buildReverseTransactionFromReturnItems(items, sale, { refundBreakdown, returns, pendingReturn, saleBountyPool = 0, refundTotalFallback = 0 } = {}) {
  const asNegative = (n) => (n === 0 ? 0 : -Math.abs(n));
  const itemMerchandise = (items || []).reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0);
  const itemShippingRefund = (items || []).reduce((sum, item) => sum + (Number(item.refundableShipping) || 0), 0);
  const itemShippingFromLines = (items || []).reduce((sum, item) => {
    if (item.line && typeof item.line === "object") {
      return sum + getReturnLineRefundableShippingAmount(item.line, item.qty);
    }
    return sum;
  }, 0);
  const computedShippingRefund = itemShippingRefund > 0 ? itemShippingRefund : itemShippingFromLines;
  // Prefer seller bounty_paid reversed (Orders Bounty column), else pool bounty.
  const itemBounty = (items || []).reduce((sum, item) => sum + (Number(item.bountyPaidReversed) || Number(item.lineBounty) || 0), 0);
  const bountyPool = saleBountyPool > 0 ? saleBountyPool : resolveSaleOrderBountyPaid(sale);

  const pending = pendingReturn || sale?.pending_return || null;
  const estimated = pending?.estimated_refund;
  const pendingSubtotal = parseOrderMoneyField(estimated?.subtotal);
  const pendingTaxes = parseOrderMoneyField(estimated?.taxes ?? estimated?.transaction_taxes);
  const pendingShippingFromApi = parseEstimatedRefundShipping(estimated);
  const pendingShippingRefund = computedShippingRefund > 0 ? computedShippingRefund : (pendingShippingFromApi ?? computedShippingRefund);
  const pendingComponentCredit = Math.round((pendingSubtotal + pendingTaxes + (pendingShippingRefund || 0)) * 100) / 100;
  const pendingCreditRaw = parseOrderMoneyField(estimated?.total_customer_credit ?? estimated?.total ?? pending?.estimated_total ?? pending?.total_customer_credit ?? pending?.total);
  const pendingCredit = pendingComponentCredit > 0.01 ? pendingComponentCredit : pendingCreditRaw;
  const pendingBountyExplicit = pending?.bounty_to_reclaim != null && String(pending.bounty_to_reclaim).trim() !== "" ? parseOrderMoneyField(pending.bounty_to_reclaim) : null;
  const resolvedBounty = resolveReverseTransactionBountyAmount({
    items,
    itemBounty,
    pendingBountyExplicit,
    bountyPool,
  });
  if (pending && (pendingCredit || pendingSubtotal || resolvedBounty)) {
    const merchAbs = pendingSubtotal || itemMerchandise;
    const amount = asNegative(merchAbs || Math.max(0, pendingCredit - pendingTaxes - pendingShippingRefund) || itemMerchandise);
    const taxAmount = pendingTaxes > 0 ? pendingTaxes : estimateProportionalReturnTax(sale, merchAbs || itemMerchandise, pending);
    const shippingAmount = pendingShippingRefund > 0 ? pendingShippingRefund : estimateReverseReturnShipping(sale, merchAbs || itemMerchandise, computedShippingRefund, taxAmount, pending);
    const taxes = asNegative(taxAmount);
    const shipping = asNegative(shippingAmount);
    const bounty = asNegative(resolvedBounty);
    const computedRefund = Math.abs(amount) + Math.abs(taxes) + Math.abs(shipping);
    let totalAbs = computedRefund;
    if (pendingCredit > 0) {
      const usedCorrectedLineShipping = computedShippingRefund > 0 && pendingShippingFromApi != null && Math.abs(pendingShippingFromApi - computedShippingRefund) > 0.02;
      if (!usedCorrectedLineShipping && pendingCredit >= computedRefund - 0.02) {
        totalAbs = pendingCredit;
      }
      // else API under-refunded (e.g. card fees wrongly withheld) — use merchandise + tax + shipping
    }
    const refundTarget = refundTotalFallback > 0 ? Math.abs(refundTotalFallback) : 0;
    const refundableCap = orderRefundableCustomerTotal(sale);
    if (refundTarget > 0 && Math.abs(totalAbs - refundTarget) <= 0.02) {
      totalAbs = refundTarget;
    } else if (refundableCap > 0 && isFullMerchandiseReturn(sale, merchAbs || itemMerchandise)) {
      totalAbs = Math.min(totalAbs, refundableCap);
    }
    const total = asNegative(totalAbs);
    return {
      amount,
      taxes,
      shipping,
      bounty,
      total,
      returnTxnUids: [],
      isEstimate: !(String(sale?.refund_status || pending?.refund_status || "").toLowerCase() === "refunded"),
    };
  }

  if (refundBreakdown && typeof refundBreakdown === "object") {
    const amount = asNegative(parseOrderMoneyField(refundBreakdown.amount ?? refundBreakdown.merchandise ?? refundBreakdown.transaction_amount ?? itemMerchandise) || itemMerchandise);
    const taxes = asNegative(parseOrderMoneyField(refundBreakdown.taxes ?? refundBreakdown.transaction_taxes));
    const shippingRefund = parseEstimatedRefundShipping(refundBreakdown) ?? parseReturnRefundShippingFromSource(refundBreakdown) ?? computedShippingRefund;
    const shipping = asNegative(shippingRefund);
    const bounty = asNegative(
      resolveReverseTransactionBountyAmount({
        items,
        itemBounty,
        pendingBountyExplicit: parseOrderMoneyField(refundBreakdown.bounty ?? refundBreakdown.bounty_paid ?? 0),
        bountyPool,
      }),
    );
    return {
      amount,
      taxes,
      shipping,
      bounty,
      total: asNegative(Math.abs(amount) + Math.abs(taxes) + Math.abs(shipping)),
      returnTxnUids: refundBreakdown.return_transaction_uid ? [String(refundBreakdown.return_transaction_uid)] : [],
      isEstimate: false,
    };
  }

  const returnRows = Array.isArray(returns) ? returns : [];
  if (returnRows.length > 0) {
    let amount = 0;
    let taxes = 0;
    let shipping = 0;
    let bounty = 0;
    const txnIds = [];
    for (const ret of returnRows) {
      amount += parseOrderMoneyField(ret.transaction_amount);
      taxes += parseOrderMoneyField(ret.transaction_taxes);
      const retShipping = parseReturnRefundShippingFromSource(ret) ?? parseOrderTransactionShipping(ret, null);
      if (retShipping != null) shipping += retShipping;
      bounty += parseOrderMoneyField(ret.bounty_paid ?? ret.transaction_bounty ?? ret.total_bounty ?? ret.bounty);
      if (ret.transaction_uid) txnIds.push(String(ret.transaction_uid));
    }
    if (!amount && itemMerchandise > 0) amount = -itemMerchandise;
    const resolvedReturnBounty = resolveReverseTransactionBountyAmount({
      items,
      itemBounty,
      pendingBountyExplicit: bounty !== 0 ? Math.abs(bounty) : null,
      bountyPool,
    });
    bounty = asNegative(resolvedReturnBounty);
    if (!taxes && itemMerchandise > 0) {
      const taxEst = estimateProportionalReturnTax(sale, itemMerchandise, pending);
      if (taxEst > 0) taxes = -taxEst;
    }
    amount = amount > 0 ? -amount : amount;
    taxes = taxes > 0 ? -taxes : taxes;
    const shippingRefund = shipping > 0 ? shipping : estimateReverseReturnShipping(sale, itemMerchandise, computedShippingRefund, Math.abs(taxes), pending);
    const shippingOut = shippingRefund === 0 ? 0 : shipping < 0 ? shipping : asNegative(shippingRefund);
    let totalAbs = Math.abs(amount) + Math.abs(taxes) + Math.abs(shippingOut);
    const refundTarget = refundTotalFallback > 0 ? Math.abs(refundTotalFallback) : 0;
    const refundableCap = orderRefundableCustomerTotal(sale);
    if (refundTarget > 0 && Math.abs(totalAbs - refundTarget) <= 0.02) {
      totalAbs = refundTarget;
    } else if (refundableCap > 0 && isFullMerchandiseReturn(sale, itemMerchandise)) {
      totalAbs = Math.min(totalAbs, refundableCap);
    }
    return {
      amount,
      taxes,
      shipping: shippingOut,
      bounty,
      total: asNegative(totalAbs),
      returnTxnUids: txnIds,
      isEstimate: false,
    };
  }

  let taxes = estimateProportionalReturnTax(sale, itemMerchandise, pending);
  if (!taxes) {
    const pendingTax = parseFloat(pending?.taxes ?? pending?.transaction_taxes ?? sale?.return_taxes ?? sale?.returned_taxes ?? NaN);
    if (Number.isFinite(pendingTax)) taxes = Math.abs(pendingTax);
  }

  const shippingRefund = estimateReverseReturnShipping(sale, itemMerchandise, computedShippingRefund, taxes, pending);
  const bountyOut = resolveReverseTransactionBountyAmount({
    items,
    itemBounty,
    pendingBountyExplicit,
    bountyPool,
  });
  let totalAbs = itemMerchandise + taxes + shippingRefund;
  const refundTarget = refundTotalFallback > 0 ? Math.abs(refundTotalFallback) : 0;
  const refundableCap = orderRefundableCustomerTotal(sale);
  if (refundTarget > 0 && Math.abs(totalAbs - refundTarget) <= 0.02) {
    totalAbs = refundTarget;
  } else if (refundableCap > 0 && isFullMerchandiseReturn(sale, itemMerchandise)) {
    totalAbs = Math.min(totalAbs, refundableCap);
  }

  return {
    amount: asNegative(itemMerchandise),
    taxes: asNegative(taxes),
    shipping: asNegative(shippingRefund),
    bounty: asNegative(bountyOut),
    total: asNegative(totalAbs),
    returnTxnUids: [],
    isEstimate: true,
  };
}

function filterWalletLedgerEntriesForOrder(entries, orderUid) {
  const uid = String(orderUid || "").trim();
  if (!uid || !Array.isArray(entries)) return [];
  return entries.filter((entry) => {
    const txnUid = String(entry?.transaction_uid || "").trim();
    const entryOrderUid = String(entry?.order_uid || "").trim();
    return txnUid === uid || entryOrderUid === uid;
  });
}

/** Refresh wallet ledger pending-shipment counts from order line remaining_to_ship. */
function patchWalletLedgerEntriesPendingShipment(entries, sale) {
  if (!Array.isArray(entries) || !entries.length || !sale) return entries;
  const pendingShipment = (Array.isArray(sale.lines) ? sale.lines : []).reduce((sum, line) => sum + getLineRemainingShipQty(line), 0);
  return entries.map((entry) => {
    const description = String(entry?.description || "");
    if (!/pending shipment/i.test(description)) return entry;
    const patched = description.replace(/(\()\s*\d+\s+(pending shipment)/i, `$1${pendingShipment} $2`);
    return patched === description ? entry : { ...entry, description: patched };
  });
}

/** Buyer/counterparty label on wallet ledger rows — API field or trailing " — Name" on description. */
function parseWalletLedgerCounterpartyLabel(entry) {
  if (!entry || typeof entry !== "object") return "";
  const explicit = String(entry.counterparty_name || entry.counterparty_label || entry.counterparty || "").trim();
  if (explicit) return explicit;
  const description = String(entry.description || "").trim();
  const dashMatch = description.match(/\s+[—–-]\s+(.+)$/);
  return dashMatch ? dashMatch[1].trim() : "";
}

/** Buyer display name for seller order detail — ledger, sale fields, shipping name, then profile id. */
function resolveOrderDetailBuyerLabel({ orderDetail, sale, walletLedgerEntries = [] }) {
  for (const entry of walletLedgerEntries || []) {
    const fromLedger = parseWalletLedgerCounterpartyLabel(entry);
    if (fromLedger) return fromLedger;
  }
  const src = sale || orderDetail || {};
  const fromSale = String(src.purchaser_name || src.buyer_name || src.transaction_profile_name || src.profile_name || src.customer_name || src.buyer_profile_name || "").trim();
  if (fromSale) return fromSale;
  const shipping = extractShippingAddress(sale) || extractShippingAddress(orderDetail);
  if (shipping) {
    const name = [shipping.first_name, shipping.last_name].filter(Boolean).join(" ").trim();
    if (name) return name;
  }
  return String(sale?.transaction_profile_id || orderDetail?.transaction_profile_id || "").trim();
}

/** Order Details subtitle: `500-000702. 8/03. PM Test28` */
function formatOrderDetailModalSubtitle({ orderUid, orderDetail, sale, buyerLabel }) {
  const id = String(orderDetail?.order_uid || orderUid || "—").trim();
  const parts = [id];
  const date = sale?.transaction_datetime ? parseTransactionDateTime({ transaction_datetime: sale.transaction_datetime }) : null;
  if (date) {
    parts.push(`${date.getMonth() + 1}/${String(date.getDate()).padStart(2, "0")}`);
  }
  const name = String(buyerLabel || "").trim();
  if (name) parts.push(name);
  return parts.join(". ");
}

function resolveOrderDetailPendingReturn(orderDetail) {
  if (!orderDetail || typeof orderDetail !== "object") return null;
  const sale = orderDetail.sale || null;
  const pendingReturns =
    (Array.isArray(orderDetail.pending_returns) && orderDetail.pending_returns.length ? orderDetail.pending_returns : null) ||
    (Array.isArray(sale?.pending_returns) && sale.pending_returns.length ? sale.pending_returns : null) ||
    null;
  return (pendingReturns && pendingReturns[0]) || orderDetail.pending_return || sale?.pending_return || null;
}

function OrderDetailPendingReturnSummary({ pendingReturn, darkMode }) {
  if (!pendingReturn || typeof pendingReturn !== "object") return null;
  const estimated = pendingReturn.estimated_refund || {};
  const subtotal = parseOrderMoneyField(estimated.subtotal);
  const taxes = parseOrderMoneyField(estimated.taxes ?? estimated.transaction_taxes);
  const shipping = parseOrderMoneyField(estimated.shipping_refund ?? estimated.shipping);
  const total = parseOrderMoneyField(estimated.total ?? estimated.total_customer_credit ?? pendingReturn.estimated_total ?? pendingReturn.total);
  const bounty = parseOrderMoneyField(pendingReturn.bounty_to_reclaim);
  const items = Array.isArray(pendingReturn.items) ? pendingReturn.items : [];
  const labelStyle = [styles.orderDetailSectionText, darkMode && { color: "#ddd" }];
  const valueStyle = [styles.orderDetailSummaryValue, darkMode && { color: "#eee" }];
  const row = (label, value, { signed = false } = {}) => (
    <View style={styles.orderDetailSummaryRow} key={label}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={[...valueStyle, signed && parseFloat(value) < 0 && { color: "#B71C1C" }]}>{signed ? formatSignedOrderMoney(value) : formatOrderMoney(value)}</Text>
    </View>
  );

  return (
    <View style={[styles.orderDetailSummaryCard, darkMode && styles.orderDetailSectionCardDark, { marginTop: 12 }]}>
      <Text style={[styles.orderDetailSectionTitle, darkMode && styles.darkTitle]}>Pending return (buyer refund estimate)</Text>
      <Text style={[styles.orderDetailSectionNote, darkMode && { color: "#aaa" }]}>
        This is what the buyer will be refunded if the return is confirmed. It is separate from your sale-proceeds wallet adjustment below.
      </Text>
      {items.map((item, index) => {
        const shipped = parseInt(item.return_shipped_qty, 10) || 0;
        const cancelled = parseInt(item.cancel_unshipped_qty, 10) || 0;
        const parts = [];
        if (shipped > 0) parts.push(`${shipped} return`);
        if (cancelled > 0) parts.push(`${cancelled} cancel`);
        const splitLabel = parts.length ? parts.join(", ") : `${item.return_quantity || "—"} unit(s)`;
        return (
          <Text key={`pending-item-${index}`} style={[styles.orderDetailSectionText, darkMode && { color: "#ddd" }, { marginTop: index === 0 ? 8 : 4 }]}>
            {splitLabel}
          </Text>
        );
      })}
      {subtotal ? row("Returned items", -Math.abs(subtotal), { signed: true }) : null}
      {taxes ? row("Sales tax", -Math.abs(taxes), { signed: true }) : null}
      {shipping ? row("Shipping", -Math.abs(shipping), { signed: true }) : null}
      {total ? (
        <View style={[styles.orderDetailSummaryRow, styles.orderDetailSummaryRowTotal]}>
          <Text style={[styles.orderDetailSectionTitle, darkMode && styles.darkTitle]}>Refund total</Text>
          <Text style={[styles.orderDetailSummaryValue, styles.orderDetailSummaryNet, { color: "#B71C1C" }]}>{formatSignedOrderMoney(-Math.abs(total))}</Text>
        </View>
      ) : null}
      {bounty ? row("Bounty reversed", -Math.abs(bounty), { signed: true }) : null}
    </View>
  );
}

function parseWalletLedgerEntryStatusNote(description) {
  const text = String(description || "").trim();
  const pendingMatch = text.match(/\(([^)]*pending[^)]*)\)/i);
  if (pendingMatch) return `(${pendingMatch[1].trim()})`;
  const paren = text.match(/\(([^)]+)\)/);
  return paren ? `(${paren[1].trim()})` : "";
}

/** Unit count for a partial sale-proceeds ledger row (e.g. "1 unit(s) returned"). */
function parseWalletLedgerEntryItemizeQty(entry, purchasedQty) {
  if (!entry || purchasedQty <= 0) return null;

  for (const key of ["itemize_qty", "units", "unit_count", "item_qty", "return_quantity", "quantity"]) {
    const v = parseInt(entry[key], 10);
    if (Number.isFinite(v) && v > 0 && v <= purchasedQty) return v;
  }

  const text = String(entry.description || entry.entry_type_label || "").trim();
  const unitMatch = text.match(/(\d+)\s+unit\(s\)\s+(returned|cancelled|canceled)/i);
  if (unitMatch) {
    const qty = parseInt(unitMatch[1], 10);
    if (Number.isFinite(qty) && qty > 0) return Math.min(qty, purchasedQty);
  }

  return null;
}

/** Scale a full-order proceeds breakdown to a partial ledger entry (return/cancel). */
function scaleWalletLedgerProceedsBreakdown(breakdown, itemizeQty, purchasedQty) {
  if (!breakdown || !itemizeQty || itemizeQty >= purchasedQty) return breakdown;

  const scaledMerchandiseRows = breakdown.merchandiseRows.map((row) => {
    const lineShare = purchasedQty > 0 ? row.qty / purchasedQty : 0;
    const qty =
      breakdown.merchandiseRows.length === 1
        ? itemizeQty
        : Math.max(0, Math.min(row.qty, Math.round(itemizeQty * lineShare) || (itemizeQty > 0 && row.qty > 0 ? 1 : 0)));
    const total = Math.round(row.unitCost * qty * 100) / 100;
    return { ...row, qty, total };
  });

  const scaledShipping = Math.round((breakdown.shippingTotal / purchasedQty) * itemizeQty * 100) / 100;
  const scaledBounty = breakdown.bounty
    ? {
        ...breakdown.bounty,
        qty: itemizeQty,
        total: Math.round(breakdown.bounty.unitCost * itemizeQty * 100) / 100,
      }
    : null;

  const merchandiseTotal = Math.round(scaledMerchandiseRows.reduce((sum, row) => sum + row.total, 0) * 100) / 100;
  const bountyAbs = scaledBounty ? Math.abs(scaledBounty.total) : 0;
  const computedTotal = Math.round((merchandiseTotal + scaledShipping - bountyAbs) * 100) / 100;

  return {
    ...breakdown,
    merchandiseRows: scaledMerchandiseRows,
    shippingTotal: scaledShipping,
    bounty: scaledBounty,
    computedTotal,
  };
}

/** Itemized seller sale-proceeds breakdown that should sum to a wallet ledger entry. */
function buildWalletLedgerProceedsBreakdown({ sale, bountyRows, transactionUid, saleBountyPaid, salePurchasedQty, entry }) {
  const saleLines = Array.isArray(sale?.lines) ? sale.lines : [];
  const statusNote = parseWalletLedgerEntryStatusNote(entry?.description);
  const merchandiseRows = saleLines.map((line, index) => {
    const qty = Math.max(0, parseInt(line?.ti_bs_qty, 10) || 0);
    const enrichment = enrichFromReceiptRow(line);
    const unitCost = Math.abs(getReceiptLineUnitPrice(line, enrichment) || parseFloat(line?.ti_bs_cost) || 0);
    const total = Math.round(unitCost * qty * 100) / 100;
    return {
      key: String(line?.ti_uid || line?.transaction_item_uid || `line-${index}`).trim(),
      description: line?.item_name || line?.bs_service_name || line?.bs_service_desc || "Item",
      qty,
      unitCost,
      total,
      statusNote: index === 0 ? statusNote : "",
    };
  });

  let shippingTotal = parseOrderTransactionShipping(sale, null);
  if (shippingTotal == null || shippingTotal === 0) {
    shippingTotal = saleLines.reduce((sum, line) => {
      const qty = Math.max(1, parseInt(line?.ti_bs_qty, 10) || 1);
      const sh = getOrderLineShippingAmount(line, qty);
      return sum + (sh != null ? sh : 0);
    }, 0);
  }
  shippingTotal = Math.round(Math.abs(Number(shippingTotal) || 0) * 100) / 100;

  const purchasedQty = Math.max(1, salePurchasedQty || merchandiseRows.reduce((sum, row) => sum + row.qty, 0) || parseInt(sale?.ti_bs_qty, 10) || 1);
  const bountyTotal = saleBountyPaid > 0 ? saleBountyPaid : sumBountyPaidForTransaction(bountyRows, transactionUid) || resolveSaleOrderBountyPaid(sale) || sumBountyFromSaleLines(sale?.lines);
  const bountyAbs = Math.round(Math.abs(Number(bountyTotal) || 0) * 100) / 100;
  const bountyUnit = purchasedQty > 0 ? Math.round((-bountyAbs / purchasedQty) * 100) / 100 : 0;

  const merchandiseTotal = Math.round(merchandiseRows.reduce((sum, row) => sum + row.total, 0) * 100) / 100;
  const computedTotal = Math.round((merchandiseTotal + shippingTotal - bountyAbs) * 100) / 100;
  const ledgerAmount = Math.round(parsePrice(entry?.amount) * 100) / 100;

  const fullBreakdown = {
    merchandiseRows,
    shippingTotal,
    bounty:
      bountyAbs > 0
        ? {
            description: "Bounty",
            qty: purchasedQty,
            unitCost: bountyUnit,
            total: -bountyAbs,
          }
        : null,
    computedTotal,
    ledgerAmount,
  };

  const itemizeQty = parseWalletLedgerEntryItemizeQty(entry, purchasedQty);
  return scaleWalletLedgerProceedsBreakdown(fullBreakdown, itemizeQty, purchasedQty);
}

function OrderDetailWalletLedgerBreakdownTable({ breakdown, darkMode }) {
  if (!breakdown) return null;
  const { merchandiseRows, shippingTotal, bounty, computedTotal, ledgerAmount } = breakdown;
  const headerColor = darkMode ? "#ccc" : "#555";
  const cellColor = darkMode ? "#ddd" : "#333";
  const metaColor = darkMode ? "#aaa" : "#777";
  const borderColor = darkMode ? "#444" : "#ddd";

  const col = {
    desc: { flex: 1.6, paddingRight: 6 },
    qty: { width: 36, textAlign: "right" },
    unit: { width: 72, textAlign: "right", paddingHorizontal: 4 },
    total: { width: 72, textAlign: "right" },
  };

  const Header = () => (
    <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: borderColor, paddingBottom: 4, marginBottom: 4 }}>
      <Text style={{ ...col.desc, fontSize: 11, fontWeight: "700", color: headerColor }}>Description</Text>
      <Text style={{ ...col.qty, fontSize: 11, fontWeight: "700", color: headerColor }}>Qty</Text>
      <Text style={{ ...col.unit, fontSize: 11, fontWeight: "700", color: headerColor }}>Unit Cost</Text>
      <Text style={{ ...col.total, fontSize: 11, fontWeight: "700", color: headerColor }}>Total</Text>
    </View>
  );

  const DataRow = ({ description, qty, unitCost, total, statusNote, emphasize = false }) => (
    <View style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <Text style={{ ...col.desc, fontSize: 12, color: cellColor, fontWeight: emphasize ? "700" : "400" }} numberOfLines={3}>
          {description}
        </Text>
        <Text style={{ ...col.qty, fontSize: 12, color: cellColor, fontWeight: emphasize ? "700" : "400" }}>{qty != null && qty !== "" ? qty : ""}</Text>
        <Text style={{ ...col.unit, fontSize: 12, color: cellColor, fontWeight: emphasize ? "700" : "400" }}>
          {unitCost != null && unitCost !== "" ? (Number(unitCost) < 0 ? formatSignedOrderMoney(unitCost) : formatOrderMoney(unitCost)) : ""}
        </Text>
        <Text style={{ ...col.total, fontSize: 12, color: total < 0 ? "#B71C1C" : cellColor, fontWeight: emphasize ? "700" : "600" }}>
          {total != null && total !== "" ? formatSignedOrderMoney(total) : ""}
        </Text>
      </View>
      {statusNote ? (
        <Text style={{ fontSize: 10, color: metaColor, fontStyle: "italic", marginTop: 2, paddingLeft: 2 }} numberOfLines={3}>
          {statusNote}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={{ marginTop: 8 }}>
      <Header />
      {merchandiseRows.map((row) => (
        <DataRow key={row.key} description={row.description} qty={row.qty} unitCost={row.unitCost} total={row.total} statusNote={row.statusNote} />
      ))}
      {shippingTotal > 0 ? <DataRow description='Shipping' total={shippingTotal} /> : null}
      {bounty ? <DataRow description={bounty.description} qty={bounty.qty} unitCost={bounty.unitCost} total={bounty.total} /> : null}
      <View style={{ borderTopWidth: 1, borderTopColor: borderColor, marginTop: 4, paddingTop: 6 }}>
        <DataRow description='Total' total={ledgerAmount || computedTotal} emphasize />
      </View>
      {Math.abs((ledgerAmount < 0 ? -Math.abs(computedTotal) : computedTotal) - ledgerAmount) > 0.02 ? (
        <Text style={{ fontSize: 10, color: "#B71C1C", marginTop: 4 }}>
          Itemized total ({formatSignedOrderMoney(computedTotal)}) differs from ledger entry ({formatSignedOrderMoney(ledgerAmount)}).
        </Text>
      ) : null}
    </View>
  );
}

function OrderDetailWalletLedgerSummary({ entries, highlightEntryId, darkMode, sale, bountyRows = [], transactionUid = "", saleBountyPaid = 0, salePurchasedQty = null }) {
  if (!Array.isArray(entries) || !entries.length) return null;
  const labelStyle = [styles.orderDetailSectionText, darkMode && { color: "#ddd" }];
  const valueStyle = [styles.orderDetailSummaryValue, darkMode && { color: "#eee" }];

  return (
    <View style={[styles.orderDetailSummaryCard, darkMode && styles.orderDetailSectionCardDark, { marginTop: 12 }]}>
      <Text style={[styles.orderDetailSectionTitle, darkMode && styles.darkTitle]}>Wallet ledger (your sale proceeds)</Text>
      <Text style={[styles.orderDetailSectionNote, darkMode && { color: "#aaa" }]}>
        Itemized below is how your sale proceeds are calculated. This is separate from the buyer refund — see pending return above for the customer credit.
      </Text>
      {entries.map((entry, index) => {
        const isHighlight = highlightEntryId != null && String(entry.entry_id || "") === String(highlightEntryId);
        const amount = parsePrice(entry.amount);
        const signed = amount < 0 ? amount : amount > 0 ? amount : 0;
        const canItemize = sale && (signed > 0 || entry?.entry_type === "sale_proceeds" || /sale proceeds/i.test(String(entry?.description || entry?.entry_type_label || "")));
        const breakdown = canItemize
          ? buildWalletLedgerProceedsBreakdown({
              sale,
              bountyRows,
              transactionUid,
              saleBountyPaid,
              salePurchasedQty,
              entry,
            })
          : null;

        return (
          <View
            key={entry.entry_id || `wallet-entry-${index}`}
            style={[
              { marginTop: index === 0 ? 8 : 14, paddingTop: index === 0 ? 0 : 10, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: darkMode ? "#444" : "#eee" },
              isHighlight && { backgroundColor: darkMode ? "#3a2a2a" : "#fff8f8", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 },
            ]}
          >
            <View style={[styles.orderDetailSummaryRow, { alignItems: "flex-start", paddingVertical: breakdown ? 4 : 6 }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[labelStyle, { fontWeight: isHighlight ? "600" : "400" }]} numberOfLines={4}>
                  {entry.description || entry.entry_type_label || "Sale proceeds"}
                </Text>
                <Text style={[styles.orderDetailSectionNote, darkMode && { color: "#aaa" }, { marginTop: 2 }]}>
                  {entry.entry_type_label || entry.entry_type || "—"} · {entry.availability || "—"}
                </Text>
              </View>
              <Text style={[...valueStyle, signed < 0 && { color: "#B71C1C" }, signed > 0 && { color: "#2e7d32" }]}>{formatSignedOrderMoney(signed)}</Text>
            </View>
            {breakdown && breakdown.merchandiseRows.length > 0 ? <OrderDetailWalletLedgerBreakdownTable breakdown={breakdown} darkMode={darkMode} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function OrderDetailFinancialSummary({ sale, returns, summary, darkMode }) {
  const breakdown = buildOrderDetailFinancialBreakdown(sale, returns, summary);
  const labelStyle = [styles.orderDetailSectionText, darkMode && { color: "#ddd" }];
  const valueStyle = [styles.orderDetailSummaryValue, darkMode && { color: "#eee" }];
  const sectionTitle = (text) => <Text style={[styles.orderDetailSummarySectionLabel, darkMode && { color: "#aaa" }]}>{text}</Text>;
  const row = (label, value, { signed = false, emphasize = false } = {}) => (
    <View style={styles.orderDetailSummaryRow} key={label}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={[...valueStyle, emphasize && styles.orderDetailSummaryNet, signed && parseFloat(value) < 0 && { color: "#B71C1C" }]}>
        {signed ? formatSignedOrderMoney(value) : formatOrderMoney(value)}
      </Text>
    </View>
  );

  return (
    <View style={[styles.orderDetailSummaryCard, darkMode && styles.orderDetailSectionCardDark]}>
      {breakdown.hasReturns ? sectionTitle("Original order") : null}
      {row("Merchandise (subtotal)", breakdown.saleAmount)}
      {row("Sales tax", breakdown.saleTaxes)}
      {row("Shipping", breakdown.saleShipping)}
      {row("Credit card fees", breakdown.saleFees)}
      {breakdown.hasReturns ? row("Order total", breakdown.saleTotal, { emphasize: true }) : null}

      {breakdown.hasReturns ? (
        <>
          {sectionTitle("Returns")}
          {row("Returned merchandise", breakdown.returnedAmount, { signed: true })}
          {row("Returned sales tax", breakdown.returnedTaxes, { signed: true })}
          {row("Returned shipping", breakdown.returnedShipping, { signed: true })}
          {row("Returned credit card fees", breakdown.returnedFees, { signed: true })}
          {row("Returned total", breakdown.returnedTotal, { signed: true, emphasize: true })}
          {sectionTitle("Net after returns")}
          {row("Net merchandise", breakdown.netAmount, { signed: breakdown.netAmount < 0 })}
          {row("Net sales tax", breakdown.netTaxes, { signed: breakdown.netTaxes < 0 })}
          {row("Net shipping", breakdown.netShipping, { signed: breakdown.netShipping < 0 })}
          {row("Net credit card fees", breakdown.netFees, { signed: breakdown.netFees < 0 })}
        </>
      ) : null}

      <View style={[styles.orderDetailSummaryRow, styles.orderDetailSummaryRowTotal]}>
        <Text style={[styles.orderDetailSectionTitle, darkMode && styles.darkTitle]}>{breakdown.hasReturns ? "Net total" : "Amount paid"}</Text>
        <Text style={[styles.orderDetailSummaryValue, styles.orderDetailSummaryNet, darkMode && { color: "#eee" }]}>
          {formatOrderMoney(breakdown.hasReturns ? breakdown.netTotal : breakdown.saleTotal)}
        </Text>
      </View>
    </View>
  );
}

function OrderDetailReturnHeader({ transaction, darkMode }) {
  const txnId = transaction?.transaction_uid || "—";
  const dateLabel = transaction?.transaction_datetime ? formatTransactionDate({ transaction_datetime: transaction.transaction_datetime }) : "—";
  const buyerNote = String(transaction?.transaction_return_note || "").trim();

  return (
    <Text style={[styles.productSalesModalSubtitle, styles.orderDetailReturnSubtitle, darkMode && { color: "#aaa" }]}>
      {txnId}
      {dateLabel !== "—" ? ` · ${dateLabel}` : ""}
      {buyerNote ? ` · Buyer's note: ${buyerNote}` : ""}
    </Text>
  );
}

function OrderDetailLinesTable({
  lines,
  darkMode,
  footerLabel,
  footerAmount,
  footerAmountSigned,
  signedRows: signedRowsProp,
  showFulfillmentColumns,
  bountyRows = [],
  transactionUid = "",
  saleBountyPaid = 0,
  salePurchasedQty = null,
  isSellerView = false,
  selectable = false,
  selectedKeys = [],
  onToggleSelect,
  selectionDisabled = false,
}) {
  const signedRows = signedRowsProp ?? !!footerAmountSigned;
  const includeFulfillment = !!showFulfillmentColumns && !signedRows;
  const selected = Array.isArray(selectedKeys) ? selectedKeys : [];
  const [expandedTrackingKeys, setExpandedTrackingKeys] = useState({});
  const detailRows = (lines || []).map((line, index) => {
    const qty = Math.abs(line.return_quantity != null ? parseInt(line.return_quantity, 10) || 0 : parseInt(line.ti_bs_qty, 10) || 0);
    const enrichment = enrichFromReceiptRow(line);
    const choiceSource = enrichment || {
      selectedChoiceItems: parseReceiptJsonField(line.selected_choice_items ?? line.ti_selected_choice_items, []),
      selectedChoiceLabels: parseReceiptJsonField(line.selected_choice_labels ?? line.ti_selected_choice_labels, {}),
      selected_options: Array.isArray(line.selected_options) ? line.selected_options : [],
      choicesExtraCost: parseFloat(line.choices_extra_cost ?? line.ti_choices_extra_cost ?? 0) || 0,
    };
    const choiceLines = getItemizedChoiceLines(choiceSource || {});
    const specialInstructions = enrichment?.specialInstructions || String(line.special_instructions ?? line.ti_special_instructions ?? "").trim();
    const unitCost = Math.abs(getReceiptLineUnitPrice(line, enrichment) || parseFloat(line.ti_bs_cost) || 0);
    const lineTotal = unitCost * qty;
    const rawLineShipping = signedRows ? getReturnLineRefundableShippingAmount(line, qty) : getOrderLineShippingAmount(line, qty);
    const lineShipping = rawLineShipping == null ? null : Math.abs(rawLineShipping);
    const bountyAmounts = resolveReturnLineBountyAmounts(line, qty || 1, bountyRows, transactionUid, saleBountyPaid, salePurchasedQty);
    const bountyAmount = isSellerView ? bountyAmounts.bountyPaidReversed || bountyAmounts.lineBounty || 0 : bountyAmounts.lineBounty || bountyAmounts.bountyPaidReversed || 0;
    const shareAmount = Math.abs(bountyAmounts.earnedShare || 0);
    const displayPct = bountyAmounts.percentage;
    let bountyPctLabel = null;
    if (displayPct != null && Number.isFinite(displayPct)) {
      bountyPctLabel = displayPct > 0 && displayPct <= 1 ? `${Math.round(displayPct * 1000) / 10}%` : `${Math.round(displayPct * 10) / 10}%`;
    } else if (bountyAmount > 0 && shareAmount > 0) {
      bountyPctLabel = `${Math.round((shareAmount / bountyAmount) * 1000) / 10}%`;
    }
    const displayQty = signedRows ? -qty : qty;
    const displayUnitCost = signedRows ? -unitCost : unitCost;
    const displayLineTotal = signedRows ? -lineTotal : lineTotal;
    const displayLineShipping = lineShipping == null ? null : signedRows ? -lineShipping : lineShipping;
    const displayBounty = signedRows ? -Math.abs(bountyAmount) : Math.abs(bountyAmount);
    const displayShare = signedRows ? -shareAmount : shareAmount;
    const fulfillment = includeFulfillment ? formatLineFulfillmentDisplay(line) : null;
    const qtyNote = signedRows ? "" : formatOrderDetailLineQtyNote(line);
    const returnKind = line.return_kind === "cancel" ? "cancel" : line.return_kind === "return" ? "return" : null;
    const typeLabel = returnKind === "cancel" ? "Cancellation · not shipped" : returnKind === "return" ? "Return · must receive" : "";
    const rowKey = String(line._splitKey || line.ti_uid || line.transaction_item_uid || `${line.ti_bs_id}-${index}`).trim();
    const rowSelectable = selectable && returnKind !== "cancel";
    return {
      key: rowKey,
      productId: line.ti_bs_id || "—",
      description: line.item_name || line.bs_service_name || line.bs_service_desc || "—",
      typeLabel,
      returnKind,
      choiceLines,
      specialInstructions,
      unitCost: displayUnitCost,
      qty: displayQty,
      qtyNote,
      bounty: displayBounty,
      bountyPctLabel,
      share: displayShare,
      lineTotal: displayLineTotal,
      lineShipping: displayLineShipping,
      shippedStatus: fulfillment?.statusLabel || "—",
      tracking: fulfillment?.trackingLabel || "—",
      trackingPairs: fulfillment?.trackingPairs || [],
      isLast: index === lines.length - 1,
      isSelected: selected.includes(rowKey),
      rowSelectable,
    };
  });

  if (!detailRows.length) {
    return <Text style={[styles.noDataText, darkMode && { color: "#aaa" }]}>No line items.</Text>;
  }

  const formatFooterAmount = footerAmountSigned ? formatSignedOrderMoney : formatOrderMoney;
  const formatCellAmount = signedRows ? formatSignedOrderMoney : formatOrderMoney;
  const footerValue = footerAmount ?? detailRows.reduce((sum, row) => sum + row.lineTotal, 0);
  const signedCellStyle = signedRows ? { color: "#B71C1C" } : null;
  const optionTextColor = darkMode ? "#bbb" : "#666";
  const noteTextColor = darkMode ? "#aaa" : "#777";
  const showBuyerShareColumns = !isSellerView;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View
        style={[
          styles.businessOrderDetailTable,
          styles.businessOrderDetailTableWithBounty,
          showBuyerShareColumns && styles.businessOrderDetailTableWithBuyerShare,
          includeFulfillment && styles.businessOrderDetailTableWithFulfillment,
        ]}
      >
        <View style={[styles.businessOrderDetailHeaderRow, darkMode && styles.productSalesDetailHeaderRowDark]}>
          {selectable ? <View style={styles.businessOrderDetailColSelect} /> : null}
          <Text style={[styles.businessOrderDetailHeaderCell, styles.businessOrderDetailColProductId]} numberOfLines={1}>
            Product ID
          </Text>
          <Text style={[styles.businessOrderDetailHeaderCell, styles.businessOrderDetailColDescription]} numberOfLines={1}>
            Description
          </Text>
          <Text style={[styles.businessOrderDetailHeaderCell, styles.businessOrderDetailColQty]} numberOfLines={1}>
            Qty
          </Text>
          <Text style={[styles.businessOrderDetailHeaderCell, styles.businessOrderDetailColUnitCost]} numberOfLines={1}>
            Unit Cost
          </Text>
          <Text style={[styles.businessOrderDetailHeaderCell, styles.businessOrderDetailColMoney]} numberOfLines={1}>
            Line Total
          </Text>
          <Text style={[styles.businessOrderDetailHeaderCell, styles.businessOrderDetailColShipping]} numberOfLines={1}>
            Shipping
          </Text>
          <Text style={[styles.businessOrderDetailHeaderCell, styles.businessOrderDetailColBounty]} numberOfLines={1}>
            Bounty
          </Text>
          {showBuyerShareColumns ? (
            <>
              <Text style={[styles.businessOrderDetailHeaderCell, styles.businessOrderDetailColBountyPct]} numberOfLines={1}>
                Bounty %
              </Text>
              <Text style={[styles.businessOrderDetailHeaderCell, styles.businessOrderDetailColShare]} numberOfLines={1}>
                Your Share
              </Text>
            </>
          ) : null}
          {includeFulfillment ? (
            <>
              <Text style={[styles.businessOrderDetailHeaderCell, styles.businessOrderDetailColShipped]} numberOfLines={1}>
                Shipped
              </Text>
              <Text style={[styles.businessOrderDetailHeaderCell, styles.businessOrderDetailColTracking]} numberOfLines={1}>
                Tracking
              </Text>
            </>
          ) : null}
        </View>
        {detailRows.map((row) => {
          const rowContent = (
            <>
              {selectable ? (
                <View style={[styles.businessOrderDetailColSelect, { justifyContent: "flex-start", paddingTop: 2 }]}>
                  {row.rowSelectable ? (
                    <Ionicons name={row.isSelected ? "checkbox" : "square-outline"} size={20} color={row.isSelected ? "#18884A" : darkMode ? "#aaa" : "#555"} />
                  ) : (
                    <Text style={{ fontSize: 11, color: noteTextColor }}>—</Text>
                  )}
                </View>
              ) : null}
              <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColProductId, styles.businessOrderDetailProductId, darkMode && { color: "#eee" }]}>{row.productId}</Text>
              <View style={[styles.businessOrderDetailCell, styles.businessOrderDetailColDescription]}>
                <Text style={[{ fontSize: 13, color: darkMode ? "#ccc" : "#333" }]} numberOfLines={3}>
                  {row.description}
                </Text>
                {row.typeLabel ? (
                  <Text
                    style={{
                      fontSize: 11,
                      color: row.returnKind === "cancel" ? "#E65100" : "#1565C0",
                      marginTop: 2,
                      fontWeight: "600",
                      lineHeight: 15,
                    }}
                    numberOfLines={2}
                  >
                    {row.typeLabel}
                  </Text>
                ) : null}
                {(row.choiceLines || []).map((choiceLine, choiceIdx) => (
                  <Text key={`${row.key}-opt-${choiceIdx}`} style={{ fontSize: 11, color: optionTextColor, marginTop: 2, lineHeight: 15 }} numberOfLines={2}>
                    {formatChoiceLineText(choiceLine)}
                  </Text>
                ))}
                {row.specialInstructions ? (
                  <Text style={{ fontSize: 11, color: noteTextColor, marginTop: 2, fontStyle: "italic", lineHeight: 15 }} numberOfLines={2}>
                    Note: {row.specialInstructions}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.businessOrderDetailCell, styles.businessOrderDetailColQty, { alignItems: "flex-end" }]}>
                <Text style={[signedCellStyle, darkMode && !signedRows && { color: "#ccc" }, { fontSize: 13 }]}>{row.qty}</Text>
                {row.qtyNote ? <Text style={{ fontSize: 10, color: noteTextColor, marginTop: 2, textAlign: "right", lineHeight: 13 }}>{row.qtyNote}</Text> : null}
              </View>
              <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColUnitCost, signedCellStyle, darkMode && !signedRows && { color: "#ccc" }]}>
                {formatCellAmount(row.unitCost)}
              </Text>
              <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColMoney, signedCellStyle, darkMode && !signedRows && { color: "#ccc" }]} numberOfLines={1}>
                {formatCellAmount(row.lineTotal)}
              </Text>
              <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColShipping, signedCellStyle, darkMode && !signedRows && { color: "#ccc" }]} numberOfLines={1}>
                {formatOrderShippingCell(row.lineShipping, signedRows)}
              </Text>
              <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColBounty, signedCellStyle, darkMode && !signedRows && { color: "#ccc" }]} numberOfLines={1}>
                {Math.abs(row.bounty) > 0 ? formatCellAmount(row.bounty) : "—"}
              </Text>
              {showBuyerShareColumns ? (
                <>
                  <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColBountyPct, darkMode && { color: "#ccc" }]}>{row.bountyPctLabel || "—"}</Text>
                  <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColShare, signedCellStyle, darkMode && !signedRows && { color: "#ccc" }]}>
                    {Math.abs(row.share) > 0 ? formatCellAmount(row.share) : "—"}
                  </Text>
                </>
              ) : null}
              {includeFulfillment ? (
                <>
                  <View style={[styles.businessOrderDetailColShipped, styles.productSalesDetailStatusCell]}>
                    {row.shippedStatus && row.shippedStatus !== "—" ? (
                      (() => {
                        const badgeStyle = getProductSaleStatusBadgeStyle("shippedLine", row.shippedStatus);
                        return (
                          <View style={[styles.productSalesDetailStatusBadge, badgeStyle.badge]}>
                            <Text style={[styles.productSalesDetailStatusBadgeText, badgeStyle.text]} numberOfLines={1}>
                              {row.shippedStatus}
                            </Text>
                          </View>
                        );
                      })()
                    ) : (
                      <Text style={[styles.businessOrderDetailCell, darkMode && { color: "#aaa" }]}>—</Text>
                    )}
                  </View>
                  {(() => {
                    const trackingExpanded = !!expandedTrackingKeys[row.key];
                    const trackingPairs = Array.isArray(row.trackingPairs) ? row.trackingPairs : [];
                    const hasTracking = trackingPairs.length > 0;
                    const longestPair = trackingPairs.reduce((max, pair) => Math.max(max, pair.length), 0);
                    const trackingLikelyTruncated = hasTracking && (trackingPairs.length > 2 || longestPair > 48);
                    const visiblePairs = trackingExpanded || !trackingLikelyTruncated ? trackingPairs : trackingPairs.slice(0, 2);
                    const showExpandControl = hasTracking && trackingLikelyTruncated;
                    return (
                      <TouchableOpacity
                        style={[styles.businessOrderDetailCell, styles.businessOrderDetailColTracking]}
                        disabled={!showExpandControl}
                        onPress={() => {
                          if (!showExpandControl) return;
                          setExpandedTrackingKeys((prev) => ({ ...prev, [row.key]: !prev[row.key] }));
                        }}
                        activeOpacity={0.7}
                      >
                        {hasTracking ? (
                          visiblePairs.map((pair, pairIndex) => (
                            <Text
                              key={`${row.key}-tracking-${pairIndex}`}
                              style={[styles.businessOrderDetailTrackingText, pairIndex > 0 && styles.businessOrderDetailTrackingTextSpaced, darkMode && { color: "#ccc" }]}
                              numberOfLines={trackingExpanded ? undefined : 1}
                            >
                              {pair}
                            </Text>
                          ))
                        ) : (
                          <Text style={[styles.businessOrderDetailTrackingText, darkMode && { color: "#ccc" }]}>—</Text>
                        )}
                        {showExpandControl ? <Text style={styles.businessOrderDetailTrackingExpandHint}>{trackingExpanded ? "Show less" : "…"}</Text> : null}
                      </TouchableOpacity>
                    );
                  })()}
                </>
              ) : null}
            </>
          );

          return selectable && row.rowSelectable ? (
            <TouchableOpacity
              key={row.key}
              style={[styles.businessOrderDetailDataRow, !row.isLast && styles.productSalesDetailDataRowBorder, darkMode && styles.productSalesDetailDataRowDark]}
              onPress={() => onToggleSelect?.(row.key)}
              activeOpacity={0.7}
              disabled={selectionDisabled}
            >
              {rowContent}
            </TouchableOpacity>
          ) : (
            <View key={row.key} style={[styles.businessOrderDetailDataRow, !row.isLast && styles.productSalesDetailDataRowBorder, darkMode && styles.productSalesDetailDataRowDark]}>
              {rowContent}
            </View>
          );
        })}
        {footerLabel ? (
          <View style={[styles.orderDetailLineTableFooterRow, darkMode && styles.productSalesDetailTotalRowDark]}>
            {selectable ? <View style={styles.businessOrderDetailColSelect} /> : null}
            <Text style={[styles.orderDetailLineTableFooterLabel, styles.businessOrderDetailColProductId, darkMode && { color: "#eee" }]}>{footerLabel}</Text>
            <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColDescription]} />
            <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColQty]} />
            <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColUnitCost]} />
            <Text
              style={[styles.orderDetailLineTableFooterValue, styles.businessOrderDetailColMoney, footerAmountSigned && { color: "#B71C1C" }, darkMode && !footerAmountSigned && { color: "#eee" }]}
            >
              {formatFooterAmount(footerValue)}
            </Text>
            <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColShipping]} />
            <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColBounty]} />
            {showBuyerShareColumns ? (
              <>
                <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColBountyPct]} />
                <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColShare]} />
              </>
            ) : null}
            {includeFulfillment ? (
              <>
                <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColShipped]} />
                <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColTracking]} />
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function OrderDetailShippingCard({ shippingAddress, darkMode }) {
  if (!shippingAddress) return null;
  const name = [shippingAddress.first_name, shippingAddress.last_name].filter(Boolean).join(" ").trim();
  const cityPart = shippingAddress.city || "";
  const stateZip = [shippingAddress.state, shippingAddress.zip].filter(Boolean).join(" ");
  const locality = [cityPart, stateZip].filter(Boolean).join(cityPart && stateZip ? ", " : "");

  return (
    <View style={[styles.orderDetailSummaryCard, darkMode && styles.orderDetailSectionCardDark, { marginTop: 12 }]}>
      <Text style={[styles.orderDetailSectionTitle, darkMode && styles.darkTitle]}>Shipping details</Text>
      {name ? <Text style={[styles.orderDetailSectionText, darkMode && { color: "#ddd" }]}>{name}</Text> : null}
      {shippingAddress.address_line_1 ? <Text style={[styles.orderDetailSectionText, darkMode && { color: "#ddd" }]}>{shippingAddress.address_line_1}</Text> : null}
      {shippingAddress.address_line_2 ? <Text style={[styles.orderDetailSectionText, darkMode && { color: "#ddd" }]}>{shippingAddress.address_line_2}</Text> : null}
      {locality ? <Text style={[styles.orderDetailSectionText, darkMode && { color: "#ddd" }]}>{locality}</Text> : null}
      {!name && !shippingAddress.address_line_1 && !locality ? <Text style={[styles.orderDetailSectionText, darkMode && { color: "#aaa" }]}>No shipping address on file.</Text> : null}
    </View>
  );
}

const SHIPPING_CARRIER_OPTIONS = ["USPS", "UPS", "FedEx", "DHL", "Other"];

function OrderDetailModal({
  visible,
  onClose,
  orderUid,
  orderDetail,
  loading,
  error,
  darkMode,
  isSellerView,
  onSaveFulfillment,
  bountyRows = [],
  bountyPaidFallback = 0,
  walletLedgerEntries = [],
  highlightLedgerEntryId = null,
  sellerTransactionRows = [],
}) {
  const sale = orderDetail?.sale || null;
  const returns = Array.isArray(orderDetail?.returns) ? orderDetail.returns : [];
  const summary = orderDetail?.summary || null;
  const saleLines = Array.isArray(sale?.lines) ? sale.lines : [];
  const transactionUid = String(sale?.transaction_uid || orderDetail?.transaction_uid || orderUid || "").trim();
  const saleBountyPaid = useMemo(
    () =>
      resolveOrderDetailSaleBountyPaid(sale, bountyRows, transactionUid, {
        bountyPaidFallback,
        orderDetail,
        sellerTransactionRows,
      }),
    [sale, bountyRows, transactionUid, bountyPaidFallback, orderDetail, sellerTransactionRows],
  );
  const salePurchasedQty = useMemo(() => {
    if (!sale) return null;
    const fromLines = saleLines.reduce((sum, line) => sum + Math.max(0, parseInt(line?.ti_bs_qty, 10) || 0), 0);
    return Math.max(1, parseInt(sale?.ti_bs_qty ?? (fromLines > 0 ? fromLines : null) ?? NaN, 10) || 1);
  }, [sale, saleLines]);
  const orderReturnLogistics = resolveReturnLogisticsLabels(sale || orderDetail || {}, {
    return_status: sale?.return_status || orderDetail?.return_status,
    refund_status: sale?.refund_status || orderDetail?.refund_status,
    display_status: sale?.display_status || orderDetail?.display_status,
  });
  const shippingAddress = extractShippingAddress(sale) || extractShippingAddress(orderDetail);
  const needsShipping = orderNeedsShipping(sale) || orderNeedsShipping(orderDetail) || !!shippingAddress;

  const shippableLines = useMemo(
    () =>
      saleLines
        .map((line, index) => {
          const transactionItemUid = String(line.ti_uid || line.transaction_item_uid || "").trim();
          if (!transactionItemUid) return null;
          // Backend rejects in_transit updates when fulfillment_status=not_required.
          if (!lineRequiresShipping(line) && getLineShippedQty(line) <= 0) return null;
          const purchasedQty = Math.max(1, getLinePurchasedQty(line) || 1);
          const shippedQty = getLineShippedQty(line);
          const returnedQty = getLineReturnedQty(line);
          const remainingQty = getLineRemainingShipQty(line);
          const cancelledQty = getLineCancelledQty(line) || getLineCancelledFromShipQty(line);
          const trackingCarrier = String(line.tracking_carrier || line.ti_tracking_carrier || "").trim();
          const trackingNumber = String(line.tracking_number || line.ti_tracking_number || "").trim();
          return {
            key: transactionItemUid || `line-${index}`,
            transactionItemUid,
            itemName: line.item_name || line.ti_bs_id || "Item",
            purchasedQty,
            shippedQty,
            returnedQty,
            cancelledQty,
            remainingQty,
            alreadyShipped: remainingQty <= 0,
            trackingCarrier,
            trackingNumber,
            line,
          };
        })
        .filter(Boolean),
    [saleLines],
  );

  const unshippedItemUids = useMemo(() => shippableLines.filter((row) => row.remainingQty > 0).map((row) => row.transactionItemUid), [shippableLines]);

  const [selectedShipItemUids, setSelectedShipItemUids] = useState([]);
  const [shipItemQuantities, setShipItemQuantities] = useState({});
  const [shippingCarrier, setShippingCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [savingFulfillment, setSavingFulfillment] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSelectedShipItemUids([]);
      setShipItemQuantities({});
      setShippingCarrier("");
      setTrackingNumber("");
      setSavingFulfillment(false);
      return;
    }
    setSelectedShipItemUids([]);
    setShipItemQuantities({});
    setShippingCarrier("");
    setTrackingNumber("");
  }, [visible, transactionUid, orderDetail?.sale?.transaction_uid]);

  const orderWalletEntries = Array.isArray(walletLedgerEntries) && walletLedgerEntries.length ? walletLedgerEntries : [];
  const buyerLabel = useMemo(
    () => (isSellerView || orderWalletEntries.length ? resolveOrderDetailBuyerLabel({ orderDetail, sale, walletLedgerEntries: orderWalletEntries }) : ""),
    [isSellerView, orderDetail, sale, orderWalletEntries],
  );
  const orderDetailSubtitle = useMemo(() => formatOrderDetailModalSubtitle({ orderUid, orderDetail, sale, buyerLabel }), [orderUid, orderDetail, sale, buyerLabel]);

  if (!visible) return null;

  const showSellerShipControls = isSellerView && needsShipping && unshippedItemUids.length > 0;
  const showFulfillmentColumns = needsShipping || saleLines.some((line) => lineRequiresShipping(line) || isLineFullyShipped(line) || getLineShippedQty(line) > 0 || !!getLineFulfillmentStatus(line));
  const verifiedSummary = formatOrderDetailVerifiedSummary(orderDetail, isSellerView);
  const pendingReturn = resolveOrderDetailPendingReturn(orderDetail);
  const showPendingReturnSummary = !!pendingReturn && String(pendingReturn.refund_status || "").toLowerCase() === "pending";
  const allUnshippedSelected = unshippedItemUids.length > 0 && unshippedItemUids.every((uid) => selectedShipItemUids.includes(uid));
  const canSaveShipSelection = selectedShipItemUids.some((uid) => unshippedItemUids.includes(uid));

  const toggleShipItem = (transactionItemUid, remainingQty) => {
    if (remainingQty <= 0) return;
    setSelectedShipItemUids((prev) => {
      if (prev.includes(transactionItemUid)) {
        setShipItemQuantities((qtyPrev) => {
          const next = { ...qtyPrev };
          delete next[transactionItemUid];
          return next;
        });
        return prev.filter((id) => id !== transactionItemUid);
      }
      setShipItemQuantities((qtyPrev) => ({ ...qtyPrev, [transactionItemUid]: remainingQty }));
      return [...prev, transactionItemUid];
    });
  };

  const handleSelectAllShipped = () => {
    if (!unshippedItemUids.length) return;
    if (allUnshippedSelected) {
      setSelectedShipItemUids([]);
      setShipItemQuantities({});
      return;
    }
    const nextQty = {};
    for (const row of shippableLines) {
      if (row.remainingQty > 0) nextQty[row.transactionItemUid] = row.remainingQty;
    }
    setSelectedShipItemUids([...unshippedItemUids]);
    setShipItemQuantities(nextQty);
  };

  const handleSaveShipped = async () => {
    const toShip = selectedShipItemUids.filter((uid) => unshippedItemUids.includes(uid));
    if (!toShip.length || !transactionUid || typeof onSaveFulfillment !== "function") return;
    const carrier = String(shippingCarrier || "").trim();
    const tracking = String(trackingNumber || "").trim();
    const remainingByUid = Object.fromEntries(shippableLines.map((row) => [row.transactionItemUid, row.remainingQty]));
    setSavingFulfillment(true);
    try {
      const ok = await onSaveFulfillment({
        transaction_uid: transactionUid,
        fulfillment_updates: toShip.map((transaction_item_uid) => {
          const remaining = remainingByUid[transaction_item_uid] || 1;
          const qty = Math.min(Math.max(1, parseInt(shipItemQuantities[transaction_item_uid], 10) || remaining), remaining);
          const update = {
            transaction_item_uid,
            fulfillment_status: "in_transit",
            shipped_quantity: qty,
          };
          if (carrier) update.tracking_carrier = carrier;
          if (tracking) update.tracking_number = tracking;
          return update;
        }),
      });
      if (ok) {
        setSelectedShipItemUids([]);
        setShipItemQuantities({});
        setShippingCarrier("");
        setTrackingNumber("");
      }
    } finally {
      setSavingFulfillment(false);
    }
  };

  return (
    <Modal animationType='slide' transparent visible={visible} onRequestClose={onClose}>
      <View style={[styles.productSalesModalOverlay, darkMode && styles.darkModalOverlay]}>
        <View style={[styles.productSalesModalContent, styles.businessOrderDetailModalContent, darkMode && styles.darkModalContent]}>
          <Text style={[styles.productSalesModalTitle, darkMode && styles.darkTitle]}>Order Details</Text>
          <Text style={[styles.productSalesModalSubtitle, darkMode && { color: "#aaa" }]}>{orderDetailSubtitle}</Text>

          {loading ? (
            <ActivityIndicator size='large' color='#18884A' style={{ marginVertical: 24 }} />
          ) : error ? (
            <Text style={[styles.errorText, darkMode && { color: "#f88" }]}>{error}</Text>
          ) : !sale ? (
            <Text style={[styles.noDataText, darkMode && { color: "#aaa" }]}>No order data available.</Text>
          ) : (
            <ScrollView style={styles.businessOrderDetailScroll} nestedScrollEnabled keyboardShouldPersistTaps='handled'>
              {needsShipping ? <OrderDetailShippingCard shippingAddress={shippingAddress} darkMode={darkMode} /> : null}

              <Text style={[styles.orderDetailSectionTitle, darkMode && styles.darkTitle, { marginTop: 8 }]}>Items purchased</Text>
              {verifiedSummary ? <Text style={[styles.orderDetailSectionNote, darkMode && { color: "#aaa" }, { marginBottom: 8 }]}>{verifiedSummary}</Text> : null}
              <OrderDetailLinesTable
                lines={saleLines}
                darkMode={darkMode}
                showFulfillmentColumns={showFulfillmentColumns}
                bountyRows={bountyRows}
                transactionUid={transactionUid}
                saleBountyPaid={saleBountyPaid}
                salePurchasedQty={salePurchasedQty}
                isSellerView={isSellerView}
              />

              {showSellerShipControls ? (
                <View style={[styles.orderDetailSummaryCard, darkMode && styles.orderDetailSectionCardDark, { marginTop: 12 }]}>
                  <Text style={[styles.orderDetailSectionTitle, darkMode && styles.darkTitle]}>Mark items shipped</Text>
                  <Text style={[styles.orderDetailSectionNote, darkMode && { color: "#aaa" }]}>
                    Check items to ship and set how many are going out now. Qty defaults to the remaining amount (cancelled units are excluded). Carrier and tracking are optional.
                  </Text>

                  {shippableLines
                    .filter((row) => row.remainingQty > 0)
                    .map((row) => {
                      const isSelected = selectedShipItemUids.includes(row.transactionItemUid);
                      const shipQty = shipItemQuantities[row.transactionItemUid] ?? row.remainingQty;
                      const needsQtyPicker = isSelected && row.remainingQty > 1;
                      return (
                        <View key={row.key} style={styles.orderDetailShipRowBlock}>
                          <TouchableOpacity style={styles.orderDetailShipRow} disabled={savingFulfillment} onPress={() => toggleShipItem(row.transactionItemUid, row.remainingQty)} activeOpacity={0.7}>
                            <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={20} color={isSelected ? "#9C45F7" : darkMode ? "#aaa" : "#555"} style={{ marginRight: 10 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.orderDetailSectionText, darkMode && { color: "#ddd" }]} numberOfLines={2}>
                                {row.itemName}
                              </Text>
                              <Text style={[styles.orderDetailShipTrackingMeta, darkMode && { color: "#aaa" }]}>{formatOrderDetailShipLineMeta(row)}</Text>
                            </View>
                          </TouchableOpacity>
                          {needsQtyPicker ? (
                            <View style={styles.orderDetailShipQtyPicker}>
                              <Text style={[styles.orderDetailShipQtyLabel, darkMode && { color: "#ccc" }]}>How many are you shipping?</Text>
                              <View style={styles.orderDetailShipQtyControls}>
                                <TouchableOpacity
                                  style={[styles.orderDetailShipQtyButton, darkMode && styles.orderDetailShipQtyButtonDark]}
                                  disabled={savingFulfillment}
                                  onPress={() =>
                                    setShipItemQuantities((prev) => ({
                                      ...prev,
                                      [row.transactionItemUid]: Math.max(1, (prev[row.transactionItemUid] ?? row.remainingQty) - 1),
                                    }))
                                  }
                                >
                                  <Text style={[styles.orderDetailShipQtyButtonText, darkMode && { color: "#fff" }]}>−</Text>
                                </TouchableOpacity>
                                <TextInput
                                  style={[styles.orderDetailShipQtyInput, darkMode && styles.orderDetailTrackingInputDark]}
                                  value={String(shipQty)}
                                  keyboardType='number-pad'
                                  editable={!savingFulfillment}
                                  onChangeText={(text) => {
                                    const parsed = parseInt(String(text).replace(/[^\d]/g, ""), 10);
                                    if (!Number.isFinite(parsed)) {
                                      setShipItemQuantities((prev) => ({ ...prev, [row.transactionItemUid]: 1 }));
                                      return;
                                    }
                                    setShipItemQuantities((prev) => ({
                                      ...prev,
                                      [row.transactionItemUid]: Math.min(row.remainingQty, Math.max(1, parsed)),
                                    }));
                                  }}
                                />
                                <TouchableOpacity
                                  style={[styles.orderDetailShipQtyButton, darkMode && styles.orderDetailShipQtyButtonDark]}
                                  disabled={savingFulfillment}
                                  onPress={() =>
                                    setShipItemQuantities((prev) => ({
                                      ...prev,
                                      [row.transactionItemUid]: Math.min(row.remainingQty, (prev[row.transactionItemUid] ?? row.remainingQty) + 1),
                                    }))
                                  }
                                >
                                  <Text style={[styles.orderDetailShipQtyButtonText, darkMode && { color: "#fff" }]}>+</Text>
                                </TouchableOpacity>
                                <Text style={[styles.orderDetailShipQtyHint, darkMode && { color: "#aaa" }]}>of {row.remainingQty}</Text>
                              </View>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}

                  <Text style={[styles.orderDetailShipFieldLabel, darkMode && { color: "#ddd" }]}>Carrier</Text>
                  <View style={styles.orderDetailCarrierRow}>
                    {SHIPPING_CARRIER_OPTIONS.map((carrier) => {
                      const selected = shippingCarrier === carrier;
                      return (
                        <TouchableOpacity
                          key={carrier}
                          style={[styles.orderDetailCarrierChip, darkMode && styles.orderDetailCarrierChipDark, selected && styles.orderDetailCarrierChipSelected]}
                          disabled={savingFulfillment || !unshippedItemUids.length}
                          onPress={() => setShippingCarrier((prev) => (prev === carrier ? "" : carrier))}
                        >
                          <Text style={[styles.orderDetailCarrierChipText, darkMode && { color: "#ddd" }, selected && styles.orderDetailCarrierChipTextSelected]}>{carrier}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.orderDetailShipFieldLabel, darkMode && { color: "#ddd" }]}>Tracking number</Text>
                  <TextInput
                    style={[styles.orderDetailTrackingInput, darkMode && styles.orderDetailTrackingInputDark]}
                    value={trackingNumber}
                    onChangeText={setTrackingNumber}
                    placeholder='Enter tracking number'
                    placeholderTextColor={darkMode ? "#888" : "#999"}
                    autoCapitalize='characters'
                    autoCorrect={false}
                    editable={!savingFulfillment && unshippedItemUids.length > 0}
                  />

                  <View style={styles.orderDetailShipActions}>
                    <TouchableOpacity
                      style={[styles.orderDetailShipSecondaryButton, (!unshippedItemUids.length || savingFulfillment) && { opacity: 0.5 }]}
                      disabled={!unshippedItemUids.length || savingFulfillment}
                      onPress={handleSelectAllShipped}
                    >
                      <Text style={styles.orderDetailShipSecondaryButtonText}>{allUnshippedSelected ? "Clear selection" : "Select all"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.orderDetailShipSaveButton, (!canSaveShipSelection || savingFulfillment) && styles.orderDetailShipSaveButtonDisabled]}
                      disabled={!canSaveShipSelection || savingFulfillment}
                      onPress={handleSaveShipped}
                    >
                      {savingFulfillment ? <ActivityIndicator size='small' color='#fff' /> : <Text style={styles.orderDetailShipSaveButtonText}>Save</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {returns.length > 0 ? (
                <>
                  <Text style={[styles.orderDetailSectionTitle, darkMode && styles.darkTitle, { marginTop: 16 }]}>Returns</Text>
                  {returns.map((ret, retIndex) => (
                    <View key={ret.transaction_uid || retIndex} style={styles.orderDetailReturnBlock}>
                      <OrderDetailReturnHeader transaction={ret} darkMode={darkMode} />
                      <OrderDetailLinesTable
                        lines={ret.lines || []}
                        darkMode={darkMode}
                        signedRows
                        bountyRows={bountyRows}
                        transactionUid={String(ret.transaction_uid || transactionUid || "").trim()}
                        saleBountyPaid={saleBountyPaid}
                        salePurchasedQty={salePurchasedQty}
                        isSellerView={isSellerView}
                      />
                    </View>
                  ))}
                </>
              ) : null}

              {showPendingReturnSummary ? <OrderDetailPendingReturnSummary pendingReturn={pendingReturn} darkMode={darkMode} /> : null}

              {orderWalletEntries.length > 0 ? (
                <OrderDetailWalletLedgerSummary
                  entries={orderWalletEntries}
                  highlightEntryId={highlightLedgerEntryId}
                  darkMode={darkMode}
                  sale={sale}
                  bountyRows={bountyRows}
                  transactionUid={transactionUid}
                  saleBountyPaid={saleBountyPaid}
                  salePurchasedQty={salePurchasedQty}
                />
              ) : null}

              <OrderDetailFinancialSummary sale={sale} returns={returns} summary={summary} darkMode={darkMode} />

              {orderReturnLogistics ? (
                <Text
                  style={[
                    styles.businessOrderDetailReturnBanner,
                    orderReturnLogistics.refund_status === "refunded" ? styles.businessOrderDetailReturnBannerAccepted : styles.businessOrderDetailReturnBanner,
                  ]}
                >
                  {orderReturnLogistics.display_status || `${orderReturnLogistics.delivered} - ${orderReturnLogistics.received}`}
                </Text>
              ) : null}
            </ScrollView>
          )}

          <TouchableOpacity onPress={onClose} style={styles.productSalesModalCloseButton} disabled={savingFulfillment}>
            <Text style={styles.productSalesModalCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ReturnDetailsModal({
  visible,
  onClose,
  orderUid,
  orderDetail,
  loading,
  error,
  darkMode,
  statusOverride,
  bountyRows,
  receivedItemKeys,
  onToggleReceivedItem,
  confirming,
  declining,
  confirmResult,
  onConfirmReceipt,
  onDecline,
  isSellerView = true,
  trrUid = null,
  trrUids = null,
  returnTxnUid = null,
  sourceReturnRow = null,
  restockCandidates = [],
  restockQtyByKey = {},
  onRestockQtyChange,
  onRestockFillAll,
  onRestockClearAll,
  bountyPaidFallback = 0,
  refundTotalFallback = 0,
}) {
  const sale = orderDetail?.sale || null;
  const scope = {
    trrUid,
    trrUids: Array.isArray(trrUids) && trrUids.length ? trrUids : normalizeTrrUidList(trrUid, sourceReturnRow),
    returnTxnUid,
    sourceReturnRow,
  };
  const scoped = resolveScopedReturnDetail(orderDetail, scope);
  const transactionUid = String(sale?.transaction_uid || orderUid || "").trim();
  const saleBountyPool = resolveReturnDetailBountyPool(sale, bountyRows, transactionUid, { bountyPaidFallback, sourceReturnRow });
  const salePurchasedQty = Math.max(
    1,
    parseInt(sale?.ti_bs_qty ?? (Array.isArray(sale?.lines) && sale.lines.length ? Math.max(...sale.lines.map((l) => parseInt(l?.ti_bs_qty ?? 0, 10) || 0)) : null) ?? NaN, 10) || 1,
  );
  const returns = scoped.hasScope ? scoped.matchedReturns : Array.isArray(orderDetail?.returns) ? orderDetail.returns : [];
  const returnLines = collectReturnDetailSplitLines(orderDetail, scope);
  const returnItems = buildReturnDetailDisplayItems(orderDetail, bountyRows, scope, saleBountyPool);
  const splitInfo = analyzeReturnDetailSplit(returnItems);
  const reverse = buildReverseTransactionFromReturnItems(returnItems, sale, {
    refundBreakdown: confirmResult?.refund_breakdown || orderDetail?.refund_breakdown || null,
    returns,
    pendingReturn: scoped.hasScope ? scoped.scopedPending || sourceReturnRow?.pending_return || null : sale?.pending_return || orderDetail?.pending_return || null,
    saleBountyPool,
    refundTotalFallback,
  });
  const statusSource = sourceReturnRow || (scoped.hasScope && (scoped.scopedPending || scoped.matchedReturns[0])) || sale || orderDetail || {};
  const preShipCancel =
    splitInfo.cancelOnly ||
    (areScopedReturnItemsUnshipped(orderDetail, returnLines) && !splitInfo.hasReturn) ||
    isPreShipCancelReturn(statusSource, sale) ||
    isPreShipCancelReturn(sourceReturnRow, sale);
  const logistics = resolveReturnLogisticsLabels(statusSource, {
    returnRequested: true,
    ...(preShipCancel && !splitInfo.isHybrid ? { cancel_unshipped: true, saleSibling: sale } : { saleSibling: sale }),
    ...(statusOverride || {}),
  });
  const returnStatus = logistics?.return_status || "";
  const refundStatus = logistics?.refund_status || "";
  const displayStatus = logistics?.display_status || "";
  const isCancelBeforeShip = (returnStatus === "cancelled" || !!logistics?.is_cancel_before_ship || preShipCancel) && !splitInfo.isHybrid;
  const includesUnshippedShippableUnits = returnIncludesUnshippedShippableUnits(orderDetail, returnLines);
  const pendingSellerDecision = returnStatus === "returning" && refundStatus === "pending";
  const pendingCancelDecision = isSellerView && pendingSellerDecision && splitInfo.cancelOnly;
  const awaitingReturnReceipt = isSellerView && pendingSellerDecision && splitInfo.hasReturn;
  const awaitingHybridConfirm = isSellerView && pendingSellerDecision && splitInfo.isHybrid;
  const awaitingSellerAction = awaitingReturnReceipt;
  const awaitingCancelConfirm = pendingCancelDecision;
  const refundPendingAfterConfirm = (returnStatus === "returned" || returnStatus === "cancelled") && refundStatus === "pending";
  const isRefunded = refundStatus === "refunded";
  const isRejected = refundStatus === "rejected";
  const isStripeFail = refundStatus === "stripe_fail" || refundStatus === "stripe_failed";
  const receivedKeys = Array.isArray(receivedItemKeys) ? receivedItemKeys : [];
  const returnReceiptItems = returnItems.filter((item) => item.returnKind === "return");
  const allReturnUnitsReceived = returnReceiptItems.length === 0 || returnReceiptItems.every((item) => receivedKeys.includes(item.key));
  const canConfirmReceipt = pendingSellerDecision && (splitInfo.cancelOnly ? returnItems.length > 0 : allReturnUnitsReceived);
  const canConfirmCancel = awaitingCancelConfirm && returnItems.length > 0;
  const receivedSplitSummary = buildReturnReceivedSplitSummary(returnItems, receivedKeys);
  const receivedReturnQty = receivedSplitSummary.filter((row) => row.return_kind === "return" && row.received).reduce((sum, row) => sum + row.qty, 0);
  const pendingReturnQty = receivedSplitSummary.filter((row) => row.return_kind === "return").reduce((sum, row) => sum + row.qty, 0);
  const cancelQtyTotal = receivedSplitSummary.filter((row) => row.return_kind === "cancel").reduce((sum, row) => sum + row.qty, 0);
  const buyerNote = String(
    (scoped.hasScope
      ? scoped.scopedPending?.note || scoped.matchedReturns[0]?.transaction_return_note || sourceReturnRow?.pending_return?.note || sourceReturnRow?.transaction_return_note || ""
      : sale?.transaction_return_note || orderDetail?.pending_return?.note || returns[0]?.transaction_return_note || "") || "",
  ).trim();
  const stripeRefund = confirmResult?.stripe_refund || orderDetail?.stripe_refund || null;
  const sellerBusinessName = String(sale?.business_name || sale?.transaction_business_name || orderDetail?.business_name || "").trim();
  const labelStyle = [styles.orderDetailSectionText, darkMode && { color: "#ddd" }];
  const valueStyle = [styles.orderDetailSummaryValue, darkMode && { color: "#eee" }];
  const moneyRow = (label, value) => (
    <View style={styles.orderDetailSummaryRow} key={label}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={[...valueStyle, parseFloat(value) < 0 && { color: "#B71C1C" }]}>{formatSignedOrderMoney(value)}</Text>
    </View>
  );

  const showRestockSection = isSellerView && restockCandidates.length > 0 && (awaitingSellerAction || awaitingCancelConfirm || awaitingHybridConfirm);
  const renderRestockSection = () => {
    if (!showRestockSection) return null;
    return (
      <View style={[styles.orderDetailSummaryCard, darkMode && styles.orderDetailSectionCardDark, { marginTop: 12 }]}>
        <Text style={[styles.orderDetailSectionTitle, darkMode && styles.darkTitle]}>Restore to inventory (optional)</Text>
        <Text style={[styles.orderDetailSectionNote, darkMode && { color: "#aaa" }]}>
          {splitInfo.cancelOnly
            ? "Add cancelled units back to inventory when they are sellable again."
            : splitInfo.isHybrid
              ? "For returned units you received, choose how many to put back on sale. Cancelled units can also be restocked if applicable."
              : "For each item you received, choose how many units to put back on sale."}
        </Text>
        {restockCandidates.map((candidate) => (
          <ReturnModalQtyStepper
            key={candidate.key}
            label={`${candidate.itemName} · available now ${candidate.currentAvailableLabel}`}
            value={restockQtyByKey[candidate.key] ?? 0}
            max={candidate.maxQty}
            onChange={(next) => onRestockQtyChange?.(candidate.key, next)}
            darkMode={darkMode}
            suffix={`of ${candidate.maxQty} ${candidate.returnKind === "cancel" ? "cancelled" : "returned"}`}
          />
        ))}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
          <TouchableOpacity
            style={[styles.orderDetailShipSecondaryButton, { flex: 1 }, (confirming || declining) && { opacity: 0.5 }]}
            disabled={confirming || declining}
            onPress={() => onRestockFillAll?.()}
          >
            <Text style={styles.orderDetailShipSecondaryButtonText}>Restock all</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.orderDetailShipSecondaryButton, { flex: 1 }, (confirming || declining) && { opacity: 0.5 }]}
            disabled={confirming || declining}
            onPress={() => onRestockClearAll?.()}
          >
            <Text style={styles.orderDetailShipSecondaryButtonText}>Restock none</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const statusBanner = (() => {
    if (!logistics) return null;
    if (pendingSellerDecision && isSellerView && (splitInfo.hasReturn || splitInfo.isHybrid)) return null;
    if (pendingCancelDecision && isSellerView) return null;
    if (pendingCancelDecision && !isSellerView) {
      return includesUnshippedShippableUnits ? "Items were not shipped — waiting for seller to confirm cancel and refund." : "Waiting for seller to confirm cancel and refund.";
    }
    if (pendingSellerDecision && !isSellerView) {
      return "Waiting for seller to confirm receipt of your return.";
    }
    if (refundPendingAfterConfirm) {
      if (isCancelBeforeShip) {
        return isSellerView ? "Cancel confirmed — Delivered: Cancelled · Received: Pending (processing refund)" : "Seller confirmed your cancel — refund is processing.";
      }
      return isSellerView ? "Item received — Delivered: Returned · Received: Pending (processing refund)" : "Seller received your return — refund is processing.";
    }
    if (isRefunded) {
      return isCancelBeforeShip
        ? isSellerView
          ? "Delivered: Cancelled · Received: Refunded"
          : includesUnshippedShippableUnits
            ? "Cancel completed — refund issued (item was never shipped)."
            : "Cancel completed — refund issued."
        : isSellerView
          ? "Delivered: Returned · Received: Refunded"
          : "Refund completed.";
    }
    if (isStripeFail) {
      return isCancelBeforeShip
        ? isSellerView
          ? "CC Issue — Delivered: Cancelled · Received: CC Issue (refund not completed)"
          : "Refund could not be completed (card issue). Contact the seller if this persists."
        : isSellerView
          ? "CC Issue — Delivered: Returned · Received: CC Issue (refund not completed)"
          : "Refund could not be completed (card issue). Contact the seller if this persists.";
    }
    if (isRejected && returnStatus === "returning") {
      return isSellerView ? "Return rejected — Delivered: Returning · Received: Rejected" : "Seller rejected this return.";
    }
    if (isRejected) return isSellerView ? "Delivered: Returning · Received: Rejected" : "Seller rejected this return.";
    return displayStatus || `${logistics.delivered} - ${logistics.received}`;
  })();

  return (
    <Modal animationType='slide' transparent visible={visible} onRequestClose={onClose}>
      <View style={[styles.productSalesModalOverlay, darkMode && styles.darkModalOverlay]}>
        <View style={[styles.productSalesModalContent, styles.businessOrderDetailModalContent, darkMode && styles.darkModalContent]}>
          <Text style={[styles.productSalesModalTitle, { color: "#B71C1C" }, darkMode && styles.darkTitle]}>Return Details</Text>
          <Text style={[styles.productSalesModalSubtitle, darkMode && { color: "#aaa" }]}>
            {orderDetail?.order_uid || orderUid || "—"}
            {sale?.transaction_datetime ? ` · ${formatTransactionDate({ transaction_datetime: sale.transaction_datetime })}` : ""}
            {isSellerView && sale?.transaction_profile_id ? ` · Buyer ${sale.transaction_profile_id}` : ""}
            {!isSellerView && sellerBusinessName ? ` · ${sellerBusinessName}` : ""}
          </Text>
          {displayStatus ? <Text style={[styles.productSalesModalSubtitle, { color: "#B71C1C", fontWeight: "600" }]}>{displayStatus}</Text> : null}

          {loading ? (
            <ActivityIndicator size='large' color='#B71C1C' style={{ marginVertical: 24 }} />
          ) : error ? (
            <Text style={[styles.errorText, darkMode && { color: "#f88" }]}>{error}</Text>
          ) : !sale ? (
            <Text style={[styles.noDataText, darkMode && { color: "#aaa" }]}>No return data available.</Text>
          ) : (
            <ScrollView style={styles.businessOrderDetailScroll} nestedScrollEnabled keyboardShouldPersistTaps='handled'>
              <Text style={[styles.orderDetailSectionTitle, darkMode && styles.darkTitle, { marginTop: 8 }]}>
                {awaitingSellerAction || awaitingHybridConfirm
                  ? splitInfo.isHybrid
                    ? "Confirm returns and cancellations:"
                    : "Select return item(s) received:"
                  : isCancelBeforeShip
                    ? includesUnshippedShippableUnits
                      ? "Items cancelled (not shipped)"
                      : "Items cancelled"
                    : splitInfo.isHybrid
                      ? "Returns and cancellations"
                      : "Items being returned"}
              </Text>

              {awaitingSellerAction && (splitInfo.hasReturn || splitInfo.hasCancel) ? (
                <Text style={[styles.orderDetailSectionNote, darkMode && { color: "#aaa" }, { marginBottom: 8 }]}>
                  {splitInfo.hasReturn ? `Returns received: ${receivedReturnQty} of ${pendingReturnQty}` : null}
                  {splitInfo.hasReturn && splitInfo.hasCancel ? " · " : null}
                  {splitInfo.hasCancel ? `Cancellations: ${cancelQtyTotal} (no receipt required)` : null}
                </Text>
              ) : null}

              {awaitingSellerAction && splitInfo.isHybrid ? (
                <Text style={[styles.orderDetailSectionNote, darkMode && { color: "#aaa" }, { marginBottom: 8 }]}>
                  Check each return (shipped) row you physically received. Cancellation rows were never shipped and do not require receipt.
                </Text>
              ) : null}

              {returnLines.length > 0 ? (
                <OrderDetailLinesTable
                  lines={returnLines}
                  darkMode={darkMode}
                  signedRows
                  bountyRows={bountyRows}
                  transactionUid={transactionUid}
                  saleBountyPaid={saleBountyPool}
                  salePurchasedQty={salePurchasedQty}
                  isSellerView={isSellerView}
                  selectable={awaitingSellerAction || awaitingHybridConfirm}
                  selectedKeys={receivedKeys}
                  onToggleSelect={onToggleReceivedItem}
                  selectionDisabled={confirming || declining}
                />
              ) : (
                <Text style={[styles.noDataText, darkMode && { color: "#aaa" }]}>
                  {isCancelBeforeShip || splitInfo.cancelOnly ? "No cancelled line items on this order." : "No pending return line items on this order."}
                </Text>
              )}

              {buyerNote ? (
                <View style={[styles.orderDetailSummaryCard, darkMode && styles.orderDetailSectionCardDark, { marginTop: 12 }]}>
                  <Text style={[styles.orderDetailSectionTitle, darkMode && styles.darkTitle]}>{isSellerView ? "Buyer's note" : "Your note"}</Text>
                  <Text style={[styles.orderDetailSectionText, darkMode && { color: "#ddd" }]}>{buyerNote}</Text>
                </View>
              ) : null}

              <View style={[styles.orderDetailSummaryCard, darkMode && styles.orderDetailSectionCardDark, { marginTop: 12 }]}>
                <Text style={[styles.orderDetailSectionTitle, darkMode && styles.darkTitle]}>
                  {isSellerView ? `Reverse transaction${reverse.isEstimate ? " (estimated)" : ""}` : `Expected refund${reverse.isEstimate ? " (estimated)" : ""}`}
                </Text>
                {confirmResult?.return_transaction_uid || reverse.returnTxnUids.length > 0 ? (
                  <Text style={[styles.orderDetailSectionNote, darkMode && { color: "#aaa" }]}>Return txn: {confirmResult?.return_transaction_uid || reverse.returnTxnUids.join(", ")}</Text>
                ) : null}
                {moneyRow("Returned items", reverse.amount)}
                {moneyRow("Sales tax", reverse.taxes)}
                {Math.abs(Number(reverse.shipping) || 0) > 0.01 ? moneyRow("Shipping", reverse.shipping) : null}
                <View style={[styles.orderDetailSummaryRow, styles.orderDetailSummaryRowTotal]}>
                  <Text style={[styles.orderDetailSectionTitle, darkMode && styles.darkTitle]}>{isSellerView ? "Refund total" : "Refund you should expect"}</Text>
                  <Text style={[styles.orderDetailSummaryValue, styles.orderDetailSummaryNet, { color: "#B71C1C" }]}>{formatSignedOrderMoney(reverse.total)}</Text>
                </View>
                {moneyRow(isSellerView ? "Bounty reversed" : "Bounty returned", reverse.bounty)}
              </View>

              {isStripeFail || stripeRefund?.message || (stripeRefund && (stripeRefund.ok === false || stripeRefund.skipped)) ? (
                <Text style={[styles.orderDetailSectionNote, { marginTop: 10, color: "#E65100" }]}>
                  {stripeRefund?.message || (stripeRefund?.skipped ? "Stripe Fail — refund skipped." : "Stripe Fail — refund did not complete. Debug later from this status.")}
                </Text>
              ) : null}

              {statusBanner ? (
                <Text style={[styles.businessOrderDetailReturnBanner, isRefunded ? styles.businessOrderDetailReturnBannerAccepted : styles.businessOrderDetailReturnBanner, { marginTop: 12 }]}>
                  {statusBanner}
                </Text>
              ) : null}

              {awaitingSellerAction ? (
                <View style={[styles.orderDetailSummaryCard, darkMode && styles.orderDetailSectionCardDark, { marginTop: 12 }]}>
                  <Text style={[styles.orderDetailSectionNote, darkMode && { color: "#aaa" }]}>
                    {splitInfo.isHybrid
                      ? "After checking all returned (shipped) items, confirm to issue the refund. Cancellations are included automatically. Reject before confirming leaves this as Returning - Rejected."
                      : "Check each item you received, then confirm to trigger the refund. Reject before confirming leaves this as Returning - Rejected."}
                  </Text>
                  {!allReturnUnitsReceived && returnReceiptItems.length > 0 ? (
                    <Text style={{ color: "#B71C1C", fontSize: 12, marginTop: 8, textAlign: "center" }}>Please confirm receipt of every returned (shipped) item.</Text>
                  ) : null}
                  {renderRestockSection()}

                  <View style={[styles.orderDetailShipActions, { marginTop: 14 }]}>
                    <TouchableOpacity
                      style={[styles.orderDetailShipSaveButton, { backgroundColor: "#18884A", flex: 1 }, (!canConfirmReceipt || confirming || declining) && styles.orderDetailShipSaveButtonDisabled]}
                      disabled={!canConfirmReceipt || confirming || declining}
                      onPress={onConfirmReceipt}
                    >
                      {confirming ? (
                        <ActivityIndicator size='small' color='#fff' />
                      ) : (
                        <Text style={styles.orderDetailShipSaveButtonText}>{splitInfo.isHybrid ? "Confirm receipt & refund" : "Confirm receipt"}</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.orderDetailShipSecondaryButton, { borderColor: "#B71C1C", flex: 1 }, (confirming || declining) && { opacity: 0.5 }]}
                      disabled={confirming || declining}
                      onPress={onDecline}
                    >
                      {declining ? <ActivityIndicator size='small' color='#B71C1C' /> : <Text style={[styles.orderDetailShipSecondaryButtonText, { color: "#B71C1C" }]}>Reject return</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {awaitingCancelConfirm ? (
                <View style={[styles.orderDetailSummaryCard, darkMode && styles.orderDetailSectionCardDark, { marginTop: 12 }]}>
                  <Text style={[styles.orderDetailSectionNote, darkMode && { color: "#aaa" }]}>
                    {includesUnshippedShippableUnits
                      ? "These items were never shipped. Confirming cancels the ship quantity and issues the refund. No physical return is required."
                      : "Confirming cancels the order and issues the refund. No physical return is required."}
                  </Text>
                  {renderRestockSection()}
                  <View style={[styles.orderDetailShipActions, { marginTop: 14 }]}>
                    <TouchableOpacity
                      style={[styles.orderDetailShipSaveButton, { backgroundColor: "#18884A", flex: 1 }, (!canConfirmCancel || confirming || declining) && styles.orderDetailShipSaveButtonDisabled]}
                      disabled={!canConfirmCancel || confirming || declining}
                      onPress={onConfirmReceipt}
                    >
                      {confirming ? <ActivityIndicator size='small' color='#fff' /> : <Text style={styles.orderDetailShipSaveButtonText}>Confirm cancel & refund</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.orderDetailShipSecondaryButton, { borderColor: "#B71C1C", flex: 1 }, (confirming || declining) && { opacity: 0.5 }]}
                      disabled={confirming || declining}
                      onPress={onDecline}
                    >
                      {declining ? <ActivityIndicator size='small' color='#B71C1C' /> : <Text style={[styles.orderDetailShipSecondaryButtonText, { color: "#B71C1C" }]}>Reject cancel</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </ScrollView>
          )}

          <TouchableOpacity onPress={onClose} style={[styles.productSalesModalCloseButton, { borderColor: "#B71C1C" }]} disabled={confirming || declining}>
            <Text style={[styles.productSalesModalCloseButtonText, { color: "#B71C1C" }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function resolveSalePlacedByUid(saleRow) {
  return String(saleRow?.transaction_profile_id ?? saleRow?.purchaser_profile_id ?? "").trim() || "—";
}

function formatOrderShortDate(dateMs) {
  if (!dateMs) return "—";
  return new Date(dateMs).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatOrderDaysOpen(dateMs) {
  if (!dateMs) return "—";
  const days = Math.max(1, Math.ceil((Date.now() - dateMs) / 86400000));
  return days === 1 ? "1 day" : `${days} days`;
}

function shouldDisplayOrderDaysOpen(delivered, received) {
  const deliveredStatus = String(delivered || "")
    .trim()
    .toLowerCase();
  const receivedStatus = String(received || "")
    .trim()
    .toLowerCase();
  // Cancelled - Refunded/Rejected are closed (—). Cancelled - Pending still counts via received=pending.
  return (
    deliveredStatus === "not shipped" ||
    deliveredStatus === "returning" ||
    deliveredStatus === "partial" ||
    /^\d+\/\d+$/.test(deliveredStatus) ||
    receivedStatus === "no" ||
    receivedStatus === "pending" ||
    receivedStatus === "partial" ||
    /^\d+\/\d+$/.test(receivedStatus)
  );
}

/** Normalize shipping_address from order detail / list transaction payloads. */
function extractShippingAddress(source) {
  if (!source || typeof source !== "object") return null;
  const nested = source.shipping_address || source.transaction_shipping_address || source.shippingAddress || null;
  const addr = nested && typeof nested === "object" && !Array.isArray(nested) ? nested : source;
  const first_name = String(addr.first_name || addr.shipping_first_name || "").trim();
  const last_name = String(addr.last_name || addr.shipping_last_name || "").trim();
  const address_line_1 = String(addr.address_line_1 || addr.shipping_address_line_1 || addr.street_address || "").trim();
  const address_line_2 = String(addr.address_line_2 || addr.shipping_address_line_2 || "").trim();
  const city = String(addr.city || addr.shipping_city || "").trim();
  const state = String(addr.state || addr.shipping_state || "").trim();
  const zip = String(addr.zip || addr.zip_code || addr.postal_code || addr.shipping_zip || "").trim();
  if (!first_name && !last_name && !address_line_1 && !city && !state && !zip) return null;
  const out = { first_name, last_name, address_line_1, city, state, zip };
  if (address_line_2) out.address_line_2 = address_line_2;
  return out;
}

function isTruthyShippingFlag(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    String(value || "")
      .trim()
      .toLowerCase() === "true"
  );
}

const SHIPPED_FULFILLMENT_STATUSES = new Set(["in_transit", "shipped", "delivered", "fulfilled"]);
const NOT_REQUIRED_FULFILLMENT_STATUSES = new Set(["not_required", "n/a", "na", "none"]);

/** True when buyer opted into shipping / a ship-to address exists. */
function orderNeedsShipping(source) {
  if (!source || typeof source !== "object") return false;
  if (orderFulfillmentIsNotRequired(source)) return false;
  if (
    isTruthyShippingFlag(source.needs_shipping) ||
    isTruthyShippingFlag(source.requires_shipping) ||
    isTruthyShippingFlag(source.has_shipping_address) ||
    isTruthyShippingFlag(source.shipping_required) ||
    isTruthyShippingFlag(source.transaction_needs_shipping)
  ) {
    return true;
  }
  if (extractShippingAddress(source)) return true;
  const lines = Array.isArray(source.lines) ? source.lines : Array.isArray(source.items) ? source.items : null;
  if (lines && lines.some((line) => orderNeedsShipping(line))) return true;
  return false;
}

/**
 * Order/line does not require shipping (pickup, virtual, or fulfillment_status=not_required).
 * Delivered column shows "—" — not Shipped / Delivered / Pending.
 */
function orderFulfillmentIsNotRequired(row) {
  if (!row || typeof row !== "object") return false;
  const method = getLineFulfillmentMethod(row);
  if (method === "pickup" || method === "virtual") return true;
  if (isTruthyShippingFlag(row.ti_shipping_not_required) || isTruthyShippingFlag(row.shipping_not_required)) return true;

  const status = String(row.fulfillment_status || row.shipping_status || row.order_fulfillment_status || row.transaction_fulfillment_status || row.ti_fulfillment_status || "")
    .trim()
    .toLowerCase();
  if (NOT_REQUIRED_FULFILLMENT_STATUSES.has(status)) return true;
  if (isTruthyShippingFlag(row.fulfillment_not_required)) return true;

  if (row.has_shippable_items === 0 || row.has_shippable_items === "0" || row.has_shippable_items === false) return true;

  const shippableCount = parseInt(row.shippable_item_count ?? row.items_requiring_shipping, 10);
  if (row.shippable_item_count != null && String(row.shippable_item_count).trim() !== "" && Number.isFinite(shippableCount) && shippableCount <= 0) {
    return true;
  }

  if (
    (row.requires_shipping === false || row.requires_shipping === 0 || row.requires_shipping === "0") &&
    !extractShippingAddress(row) &&
    !isTruthyShippingFlag(row.needs_shipping) &&
    !isTruthyShippingFlag(row.needs_shipment)
  ) {
    return true;
  }
  return false;
}

function getLineFulfillmentStatus(line) {
  return String(line?.fulfillment_status || line?.ti_fulfillment_status || line?.shipping_status || line?.ti_shipping_status || "")
    .trim()
    .toLowerCase();
}

/** False when backend marks the line as not requiring shipping (do not send in_transit for these). */
function lineRequiresShipping(line) {
  if (!line || typeof line !== "object") return false;
  const method = getLineFulfillmentMethod(line);
  if (method === "pickup" || method === "virtual") return false;
  if (isTruthyShippingFlag(line.ti_shipping_not_required) || isTruthyShippingFlag(line.shipping_not_required)) return false;

  const status = getLineFulfillmentStatus(line);
  if (NOT_REQUIRED_FULFILLMENT_STATUSES.has(status)) return false;
  if (isTruthyShippingFlag(line.shipping_required) || isTruthyShippingFlag(line.needs_shipping) || isTruthyShippingFlag(line.requires_shipping)) {
    return true;
  }
  if (isTruthyShippingFlag(line.shipping_not_required) || isTruthyShippingFlag(line.fulfillment_not_required)) {
    return false;
  }
  // Explicit pending/ship statuses mean shipping applies; empty status is treated as shippable when the order has an address.
  if (SHIPPED_FULFILLMENT_STATUSES.has(status)) return true;
  if (["not_shipped", "pending_shipment", "awaiting_shipment", "unfulfilled", "pending", "ready_to_ship", "partial", "partially_shipped"].includes(status)) {
    return true;
  }
  // If backend already set a fulfillment_status and it isn't shippable/shipped, don't assume shipping.
  if (status) return false;
  return true;
}

function getLinePurchasedQty(line) {
  const qty = parseInt(line?.purchased_qty ?? line?.ti_purchased_qty ?? line?.original_qty ?? line?.ti_bs_qty, 10);
  return Number.isFinite(qty) && qty >= 0 ? qty : 0;
}

function getLineShippedQty(line) {
  if (!line || typeof line !== "object") return 0;
  const explicit = parseInt(line.shipped_qty ?? line.ti_shipped_qty ?? line.fulfillment_shipped_qty ?? line.shipped_quantity ?? line.ti_shipped_quantity, 10);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;

  const purchased = getLinePurchasedQty(line);
  const status = getLineFulfillmentStatus(line);
  const hasSellerShipEvidence =
    isTruthyShippingFlag(line.shipped) ||
    isTruthyShippingFlag(line.is_shipped) ||
    isTruthyShippingFlag(line.ti_shipped) ||
    !!line.ti_shipped_at ||
    !!line.shipped_at ||
    !!line.fulfilled_at ||
    !!(line.ti_tracking_number || line.tracking_number || line.ti_tracking_carrier || line.tracking_carrier);

  // Seller ship workflow only — buyer verify-only ti_fulfillment_status=delivered must not count as shipped.
  if (hasSellerShipEvidence && (status === "in_transit" || status === "shipped" || status === "fulfilled")) {
    return purchased > 0 ? purchased : 0;
  }
  return 0;
}

/** Pre-shipment cancels — units removed from the shipping obligation before ship. */
function getLineCancelledQty(line) {
  if (!line || typeof line !== "object") return 0;
  const explicit = parseInt(
    line.cancelled_qty ?? line.canceled_qty ?? line.cancelled_quantity ?? line.canceled_quantity ?? line.cancel_qty ?? line.cancel_unshipped_qty ?? line.ti_cancel_unshipped_qty,
    10,
  );
  return Number.isFinite(explicit) && explicit > 0 ? explicit : 0;
}

/** Post-shipment physical returns — does not reduce remaining_to_ship. */
function getLineReturnedQty(line) {
  if (!line || typeof line !== "object") return 0;
  const explicit = parseInt(line.returned_qty ?? line.returned_quantity ?? line.return_quantity_completed ?? line.return_shipped_qty ?? line.ti_return_shipped_qty ?? line.shipped_return_qty, 10);
  return Number.isFinite(explicit) && explicit > 0 ? explicit : 0;
}

/**
 * Qty still allowed to ship. Prefer backend remaining_to_ship (accounts for
 * ledger returns + open cancel/return reservations). Fallback subtracts cancelled_qty.
 */
function getLineRemainingShipQty(line) {
  if (!line || typeof line !== "object") return 0;
  const purchased = getLinePurchasedQty(line);
  if (purchased <= 0) return 0;
  const backendRemaining = parseInt(line.remaining_to_ship ?? line.remaining_ship_qty, 10);
  if (Number.isFinite(backendRemaining) && backendRemaining >= 0) {
    return Math.min(purchased, backendRemaining);
  }
  const shipped = getLineShippedQty(line);
  const cancelled = getLineCancelledQty(line);
  const unshipped = Math.max(0, purchased - shipped);
  const cancelledUnshipped = Math.min(cancelled, unshipped);
  return Math.max(0, unshipped - cancelledUnshipped);
}

/** Pre-ship cancels that remove units from the shipping obligation. */
function getLineCancelledFromShipQty(line) {
  if (!line || typeof line !== "object") return 0;
  const explicit = getLineCancelledQty(line);
  if (explicit > 0) return explicit;
  const purchased = getLinePurchasedQty(line);
  const shipped = getLineShippedQty(line);
  const remaining = getLineRemainingShipQty(line);
  return Math.max(0, purchased - shipped - remaining);
}

function isLineFullyShipped(line) {
  if (!line || typeof line !== "object") return false;
  if (!lineRequiresShipping(line) && getLineShippedQty(line) <= 0) return false;
  const purchased = getLinePurchasedQty(line);
  if (purchased <= 0) {
    const status = getLineFulfillmentStatus(line);
    return (
      SHIPPED_FULFILLMENT_STATUSES.has(status) ||
      isTruthyShippingFlag(line.shipped) ||
      isTruthyShippingFlag(line.is_shipped) ||
      isTruthyShippingFlag(line.ti_shipped) ||
      !!(line.ti_shipped_at || line.shipped_at || line.fulfilled_at)
    );
  }
  return getLineRemainingShipQty(line) <= 0;
}

/** @deprecated use isLineFullyShipped — kept as alias for existing call sites */
function isLineShipped(line) {
  return isLineFullyShipped(line);
}

/** Split multi-shipment carrier / tracking fields (backend joins with " | "). */
function splitTrackingField(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "—") return [];
  return raw
    .split(/\s*\|\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Build carrier+number pairs for one or more shipments.
 * e.g. carriers "UPS | DHL" + numbers "111 | 222" → ["UPS 111", "DHL 222"]
 */
function getTrackingPairs(carrierRaw, trackingRaw) {
  const carriers = splitTrackingField(carrierRaw);
  const numbers = splitTrackingField(trackingRaw);
  if (!carriers.length && !numbers.length) return [];

  if (carriers.length === 1 && numbers.length > 1) {
    return numbers.map((n) => `${carriers[0]} ${n}`.trim()).filter(Boolean);
  }
  if (numbers.length === 1 && carriers.length > 1) {
    return carriers.map((c) => `${c} ${numbers[0]}`.trim()).filter(Boolean);
  }

  const count = Math.max(carriers.length, numbers.length);
  const pairs = [];
  for (let i = 0; i < count; i++) {
    const pair = [carriers[i], numbers[i]].filter(Boolean).join(" ");
    if (pair) pairs.push(pair);
  }
  return pairs;
}

/** Inline label (comma-separated) for compact contexts like Delivery Verification. */
function formatTrackingLabel(carrierRaw, trackingRaw) {
  const pairs = getTrackingPairs(carrierRaw, trackingRaw);
  return pairs.length ? pairs.join(", ") : "—";
}

function formatLineFulfillmentDisplay(line) {
  if (!line || typeof line !== "object") {
    return { statusLabel: "—", trackingLabel: "—", trackingPairs: [], cancelNote: "" };
  }
  const status = getLineFulfillmentStatus(line);
  const carrier = String(line.tracking_carrier || line.ti_tracking_carrier || "").trim();
  const trackingNumber = String(line.tracking_number || line.ti_tracking_number || "").trim();
  const trackingPairs = getTrackingPairs(carrier, trackingNumber);
  const trackingLabel = trackingPairs.length ? trackingPairs.join(", ") : "—";
  const purchased = getLinePurchasedQty(line);
  const shipped = getLineShippedQty(line);

  if (NOT_REQUIRED_FULFILLMENT_STATUSES.has(status) || (!lineRequiresShipping(line) && shipped <= 0)) {
    return { statusLabel: "—", trackingLabel: "—", trackingPairs: [], cancelNote: "" };
  }
  if (purchased > 0) {
    const returned = getLineReturnedQty(line);
    const remaining = getLineRemainingShipQty(line);
    const cancelled = getLineCancelledFromShipQty(line);
    const cancelNote = cancelled > 0 ? `${cancelled}/${purchased} cancelled` : "";
    if (shipped <= 0 && cancelled > 0 && remaining <= 0) {
      return { statusLabel: "Cancelled", trackingLabel: "—", trackingPairs: [], cancelNote };
    }
    if (shipped <= 0) return { statusLabel: "Not shipped", trackingLabel: "—", trackingPairs: [], cancelNote: "" };
    // Nothing left to ship (remaining shipped and/or cancelled).
    if (remaining <= 0 && shipped >= purchased - Math.max(returned, cancelled)) {
      if (cancelled > 0 && shipped < purchased) {
        return { statusLabel: `Shipped ${shipped}/${purchased}`, trackingLabel, trackingPairs, cancelNote };
      }
      return { statusLabel: "Shipped", trackingLabel, trackingPairs, cancelNote };
    }
    if (shipped >= purchased) return { statusLabel: "Shipped", trackingLabel, trackingPairs, cancelNote };
    // Still awaiting more units to ship.
    return { statusLabel: `${shipped}/${purchased}`, trackingLabel, trackingPairs, cancelNote };
  }
  if (isLineFullyShipped(line) || SHIPPED_FULFILLMENT_STATUSES.has(status)) {
    return { statusLabel: "Shipped", trackingLabel, trackingPairs, cancelNote: "" };
  }
  if (["not_shipped", "pending_shipment", "awaiting_shipment", "unfulfilled", "pending", "ready_to_ship"].includes(status) || lineRequiresShipping(line)) {
    return { statusLabel: "Not shipped", trackingLabel: "—", trackingPairs: [], cancelNote: "" };
  }
  return { statusLabel: "—", trackingLabel: "—", trackingPairs: [], cancelNote: "" };
}

/** Sub-label under Qty in order detail when shipped/cancelled/returned/verified counts differ from purchased. */
function formatOrderDetailLineQtyNote(line) {
  if (!line || typeof line !== "object") return "";
  const purchased = getLinePurchasedQty(line);
  if (purchased <= 0) return "";
  const shipped = getLineShippedQty(line);
  const cancelled = getLineCancelledFromShipQty(line);
  const returned = getLineReturnedQty(line);
  const verified = getPreviouslyReceivedQty(line);
  const parts = [];
  if (shipped > 0 && shipped < purchased) parts.push(`${shipped} shipped`);
  if (cancelled > 0) parts.push(`${cancelled} cancelled`);
  if (returned > 0) parts.push(`${returned} returned`);
  if (verified > 0) {
    parts.push(verified >= purchased ? "all verified" : `${verified} verified`);
  }
  return parts.join(" · ");
}

/** Meta line under Mark items shipped rows (Ordered · cancelled · returned · left to ship). */
function formatOrderDetailShipLineMeta(row) {
  if (!row) return "";
  const parts = [`Ordered ${row.purchasedQty}`];
  if (row.cancelledQty > 0) parts.push(`${row.cancelledQty} cancelled`);
  if (row.returnedQty > 0) parts.push(`${row.returnedQty} returned`);
  if (row.remainingQty > 0) {
    parts.push(`${row.remainingQty} left to ship`);
  } else if (row.cancelledQty > 0 || row.returnedQty > 0) {
    parts.push("nothing left to ship");
  } else if (row.shippedQty > 0) {
    parts.push(`${row.shippedQty}/${row.purchasedQty} shipped`);
  } else {
    parts.push(`Qty ${row.purchasedQty}`);
  }
  return parts.join(" · ");
}

/** Order-level buyer verification summary for Order Details header / section. */
function formatOrderDetailVerifiedSummary(orderDetail, isSellerView = false) {
  const totals = summarizeReceivedUnitsFromOrderDetail(orderDetail);
  if (!totals || totals.received <= 0) return null;
  if (totals.received >= totals.purchased) {
    return isSellerView ? "Buyer verified all units" : "All units verified";
  }
  return isSellerView ? `Buyer verified ${totals.received} of ${totals.purchased} units` : `Verified ${totals.received} of ${totals.purchased} units`;
}

/**
 * How many units on a receipt line the buyer may still mark received.
 * Shipping-required lines are capped to shipped − already received.
 * Lines with fulfillment_status=not_required (no shipping) stay fully verifiable.
 */
function getVerifiableReceiveRemaining(line, orderRow) {
  const remaining = getRemainingQtyToReceive(line);
  if (remaining <= 0) return 0;

  const status = getLineFulfillmentStatus(line);
  if (NOT_REQUIRED_FULFILLMENT_STATUSES.has(status)) return remaining;

  const hasShipFields =
    !!status ||
    line?.shipped_qty != null ||
    line?.ti_shipped_qty != null ||
    line?.shipped_quantity != null ||
    line?.ti_shipped_quantity != null ||
    line?.fulfillment_shipped_qty != null ||
    isTruthyShippingFlag(line?.shipped) ||
    isTruthyShippingFlag(line?.is_shipped) ||
    !!line?.ti_shipped_at ||
    !!line?.shipped_at;

  const orderNeedsShip = orderRow ? orderNeedsShipping(orderRow) : false;
  // Pickup / non-ship orders (or lines with no ship signal and no order shipping) → fully verifiable.
  if (!hasShipFields && !orderNeedsShip) return remaining;
  if (!hasShipFields && !lineRequiresShipping(line) && !orderNeedsShip) return remaining;

  const shipped = getLineShippedQty(line);
  const alreadyReceived = getPreviouslyReceivedQty(line);
  const shippedNotYetReceived = Math.max(0, shipped - alreadyReceived);
  return Math.min(remaining, shippedNotYetReceived);
}

function canSelectReceiptLineForVerification(line, orderRow) {
  return getVerifiableReceiveRemaining(line, orderRow) > 0;
}

/**
 * Shipping progress for an order: none | partial | complete | unknown.
 * Works for transaction summary rows and order-detail `sale` objects with `lines`.
 * Lines with fulfillment_status=not_required are ignored.
 * Cancelled / returned unshipped units do not keep the order in "partial" —
 * remaining_to_ship (or returned_qty fallback) is the source of truth.
 */
function getOrderShippingProgress(sources) {
  const rows = Array.isArray(sources) ? sources.filter(Boolean) : sources ? [sources] : [];
  if (!rows.length) return "unknown";

  if (rows.every(orderFulfillmentIsNotRequired)) return "not_required";

  let candidateLines = [];
  for (const row of rows) {
    const lines = Array.isArray(row.lines) ? row.lines : Array.isArray(row.items) ? row.items : null;
    if (lines && lines.length) {
      candidateLines = candidateLines.concat(lines);
      continue;
    }
    candidateLines.push(row);
  }

  const withItemUid = candidateLines.filter((line) => String(line?.ti_uid || line?.transaction_item_uid || "").trim());
  // Only score real line items. Transaction summary rows (no ti_uid) must not be treated as unshipped items.
  const scoreLines = withItemUid.filter(lineRequiresShipping);

  const first = rows[0] || {};
  const unshippedCount = parseInt(first.unshipped_item_count ?? first.unshipped_count ?? first.items_unshipped ?? first.open_shipping_count, 10);
  const shippedCountField = parseInt(first.shipped_item_count ?? first.shipped_count ?? first.items_shipped, 10);
  const shippableCount = parseInt(first.shippable_item_count ?? first.items_requiring_shipping ?? first.shipping_required_count, 10);
  const txnStatus = String(first.fulfillment_status || first.shipping_status || first.order_fulfillment_status || first.transaction_fulfillment_status || "")
    .trim()
    .toLowerCase();

  if (NOT_REQUIRED_FULFILLMENT_STATUSES.has(txnStatus)) return "not_required";
  if (Number.isFinite(shippableCount) && shippableCount <= 0 && (first.shippable_item_count != null || first.has_shippable_items != null)) {
    return "not_required";
  }

  // Prefer line-level remaining qty when available — summary "partial" often still counts cancelled units.
  if (scoreLines.length) {
    let anyRemaining = false;
    let anyShipped = false;
    let anyKnownStatus = false;
    for (const line of scoreLines) {
      const status = getLineFulfillmentStatus(line);
      const shippedQty = getLineShippedQty(line);
      const remaining = getLineRemainingShipQty(line);
      if (status || isTruthyShippingFlag(line.shipped) || line.ti_shipped_at || line.shipped_at || shippedQty > 0 || remaining > 0) {
        anyKnownStatus = true;
      }
      if (remaining > 0) anyRemaining = true;
      if (shippedQty > 0) anyShipped = true;
    }
    if (!anyRemaining) {
      // Nothing left to ship (all shipped and/or cancelled before ship).
      return "complete";
    }
    if (anyShipped) return "partial";
    return anyKnownStatus || rows.some(orderNeedsShipping) ? "none" : "unknown";
  }

  if (Number.isFinite(unshippedCount)) {
    if (unshippedCount <= 0) return "complete";
    if (Number.isFinite(shippedCountField) && shippedCountField > 0) return "partial";
    if (Number.isFinite(shippableCount) && unshippedCount < shippableCount) return "partial";
    return "none";
  }
  if (Number.isFinite(shippableCount) && Number.isFinite(shippedCountField)) {
    if (shippableCount <= 0) return "not_required";
    if (shippedCountField >= shippableCount) return "complete";
    if (shippedCountField > 0) return "partial";
    return "none";
  }

  if (isTruthyShippingFlag(first.all_items_shipped)) {
    return "complete";
  }
  if (txnStatus === "delivered") {
    // Buyer receipt verify can set delivered without seller ship — require shipped qty evidence.
    if (Number.isFinite(shippedCountField) && Number.isFinite(shippableCount) && shippableCount > 0) {
      if (shippedCountField >= shippableCount) return "complete";
      if (shippedCountField > 0) return "partial";
    }
    return "none";
  }
  if (["in_transit", "shipped", "fulfilled", "complete"].includes(txnStatus)) {
    if (Number.isFinite(shippedCountField) && shippedCountField > 0) {
      if (Number.isFinite(shippableCount) && shippableCount > 0) {
        return shippedCountField >= shippableCount ? "complete" : "partial";
      }
      return "complete";
    }
    return "none";
  }
  if (txnStatus === "partial" || txnStatus === "partially_shipped") return "partial";
  // Summary status can stay not_shipped while individual lines are partially shipped.
  if (Number.isFinite(shippedCountField) && shippedCountField > 0) {
    if (Number.isFinite(unshippedCount) && unshippedCount > 0) return "partial";
    if (Number.isFinite(shippableCount) && shippedCountField < shippableCount) return "partial";
    return "complete";
  }
  if (["not_shipped", "pending_shipment", "awaiting_shipment", "unfulfilled"].includes(txnStatus)) return "none";

  // Summary-only list row (shipping address, no line statuses) → unknown until hydrated from order detail.
  if (withItemUid.length > 0 && withItemUid.every((line) => !lineRequiresShipping(line))) {
    return "not_required";
  }
  return "unknown";
}

/**
 * Receipt APIs often omit remaining_to_ship / cancelled_qty / tracking.
 * Merge those fields from order detail so Delivery Verification can treat
 * cancelled units as non-receivable instead of "awaiting ship".
 */
function enrichReceiptLinesWithOrderFulfillment(receiptLines, orderDetail) {
  if (!Array.isArray(receiptLines) || !receiptLines.length || !orderDetail) return receiptLines || [];
  const sale = orderDetail.sale || orderDetail;
  const saleLines = Array.isArray(sale?.lines) ? sale.lines : [];
  const saleByTiUid = {};
  for (const line of saleLines) {
    const uid = String(line?.ti_uid || line?.transaction_item_uid || "").trim();
    if (uid) saleByTiUid[uid] = line;
  }
  const returnRows = Array.isArray(orderDetail.returns) ? orderDetail.returns : [];
  const returnSplitByLine = buildExistingReturnSplitByLine(returnRows);
  const progress = getOrderShippingProgress([sale].filter(Boolean));

  return receiptLines.map((receipt) => {
    const tiUid = String(receipt?.ti_uid || receipt?.transaction_item_uid || "").trim();
    const saleLine = tiUid ? saleByTiUid[tiUid] : null;
    const merged = { ...receipt };

    if (saleLine) {
      const copyIfMissing = ["fulfillment_status", "ti_fulfillment_status", "shipped", "is_shipped", "ti_shipped", "ti_shipped_at", "shipped_at", "fulfilled_at"];
      for (const field of copyIfMissing) {
        if ((merged[field] == null || merged[field] === "") && saleLine[field] != null && saleLine[field] !== "") {
          merged[field] = saleLine[field];
        }
      }
      if (saleLine.shipped_qty != null || saleLine.ti_shipped_qty != null || saleLine.shipped_quantity != null || saleLine.fulfillment_shipped_qty != null) {
        const shipped = saleLine.shipped_qty ?? saleLine.ti_shipped_qty ?? saleLine.shipped_quantity ?? saleLine.fulfillment_shipped_qty;
        merged.shipped_qty = shipped;
        merged.ti_shipped_qty = shipped;
      }
      if (saleLine.remaining_to_ship != null || saleLine.remaining_ship_qty != null) {
        merged.remaining_to_ship = saleLine.remaining_to_ship ?? saleLine.remaining_ship_qty;
      }
      if (saleLine.cancelled_qty != null && saleLine.cancelled_qty !== "") merged.cancelled_qty = saleLine.cancelled_qty;
      if (saleLine.canceled_qty != null && saleLine.canceled_qty !== "") merged.canceled_qty = saleLine.canceled_qty;
      if (saleLine.returned_qty != null && saleLine.returned_qty !== "") merged.returned_qty = saleLine.returned_qty;
      const carrier = saleLine.tracking_carrier || saleLine.ti_tracking_carrier;
      const tracking = saleLine.tracking_number || saleLine.ti_tracking_number;
      if (carrier) {
        merged.tracking_carrier = carrier;
        merged.ti_tracking_carrier = carrier;
      }
      if (tracking) {
        merged.tracking_number = tracking;
        merged.ti_tracking_number = tracking;
      }
    }

    const fromSplit = tiUid ? returnSplitByLine[tiUid] : null;
    if (fromSplit?.splitKnown) {
      if (fromSplit.unshipped > 0) merged.cancelled_qty = Math.max(getLineCancelledQty(merged), fromSplit.unshipped);
      if (fromSplit.shipped > 0) merged.returned_qty = Math.max(getLineReturnedQty(merged), fromSplit.shipped);
    }

    // Order has nothing left to ship: any unshipped units on this line were cancelled.
    if (progress === "complete") {
      const purchased = Math.max(getLinePurchasedQty(merged), getReceiptLineQty(merged));
      const shipped = getLineShippedQty(merged);
      if (purchased > shipped) {
        merged.remaining_to_ship = 0;
        const cancelled = Math.max(getLineCancelledQty(merged), purchased - shipped);
        if (cancelled > 0) merged.cancelled_qty = cancelled;
      }
    }

    return merged;
  });
}

/** True when list payload itself has enough fulfillment signal (no order-detail fetch needed). */
function listRowHasExplicitShippingProgress(row) {
  if (!row || typeof row !== "object") return false;
  if (Number.isFinite(parseInt(row.unshipped_item_count ?? row.unshipped_count ?? row.items_unshipped ?? row.open_shipping_count, 10))) {
    return true;
  }
  if (Number.isFinite(parseInt(row.shipped_item_count ?? row.shipped_count ?? row.items_shipped, 10))) return true;
  if (Number.isFinite(parseInt(row.shippable_item_count ?? row.items_requiring_shipping, 10))) return true;
  if (row.all_items_shipped != null && String(row.all_items_shipped).trim() !== "") return true;
  const status = String(row.fulfillment_status || row.shipping_status || row.order_fulfillment_status || row.transaction_fulfillment_status || "")
    .trim()
    .toLowerCase();
  if (status) return true;
  const lines = Array.isArray(row.lines) ? row.lines : Array.isArray(row.items) ? row.items : null;
  if (lines && lines.some((line) => getLineFulfillmentStatus(line) || isLineShipped(line) || NOT_REQUIRED_FULFILLMENT_STATUSES.has(getLineFulfillmentStatus(line)))) {
    return true;
  }
  if (String(row.ti_uid || row.transaction_item_uid || "").trim() && getLineFulfillmentStatus(row)) return true;
  return false;
}

function collectOrderUidsNeedingShippingProgressHydration(sellerLines) {
  const uids = new Set();
  for (const row of sellerLines || []) {
    if (isReturnListRow(row)) continue;
    const orderUid = resolveListRowOrderUid(row);
    if (!orderUid || orderUid === "—") continue;
    if (!orderNeedsShipping(row)) continue;
    const status = String(row.fulfillment_status || row.shipping_status || row.order_fulfillment_status || row.transaction_fulfillment_status || "")
      .trim()
      .toLowerCase();
    // Always hydrate partial/mixed from order detail — list summaries often lag line-level ship qty.
    if (status === "partial" || status === "partially_shipped") {
      uids.add(orderUid);
      continue;
    }
    // Order-level not_shipped is often stale once any line has shipped_qty > 0.
    if (["not_shipped", "pending_shipment", "awaiting_shipment", "unfulfilled", "ready_to_ship"].includes(status)) {
      uids.add(orderUid);
      continue;
    }
    const shippedCount = parseInt(row.shipped_item_count ?? row.shipped_count ?? row.items_shipped, 10);
    const unshippedCount = parseInt(row.unshipped_item_count ?? row.unshipped_count ?? row.items_unshipped ?? row.open_shipping_count, 10);
    if (Number.isFinite(shippedCount) && Number.isFinite(unshippedCount) && shippedCount > 0 && unshippedCount > 0) {
      uids.add(orderUid);
      continue;
    }
    if (isTruthyShippingFlag(row.all_items_shipped)) continue;
    if (Number.isFinite(unshippedCount) && unshippedCount <= 0) continue;
    const receivedUnits = Math.max(0, parseInt(row.received_units ?? row.received_item_count ?? row.ti_received_qty, 10) || 0);
    // Buyer verified units but list shipped count is missing/stale — need order-detail line qty.
    if (receivedUnits > 0 && (!Number.isFinite(shippedCount) || shippedCount < receivedUnits)) {
      uids.add(orderUid);
      continue;
    }
    if (listRowHasExplicitShippingProgress(row)) continue;
    uids.add(orderUid);
  }
  return [...uids];
}

/** In-escrow orders without clear received totals need order-detail line qty to show Partial. */
function collectOrderUidsNeedingReceivedHydration(sellerLines) {
  const uids = new Set();
  for (const row of sellerLines || []) {
    if (isReturnListRow(row)) continue;
    if (Number(row.transaction_in_escrow ?? row.in_escrow) !== 1) continue;
    const orderUid = resolveListRowOrderUid(row);
    if (!orderUid || orderUid === "—") continue;
    if (row.received_units != null || row.purchased_units != null) continue;
    const receivedCount = parseInt(row.received_item_count ?? row.delivered_item_count, 10);
    // Explicit positive received count already yields Partial/Yes without hydration.
    if (Number.isFinite(receivedCount) && receivedCount > 0) continue;
    uids.add(orderUid);
  }
  return [...uids];
}

/** Orders missing line-level shipped counts (list row often has received_units but not shipped_item_count). */
function collectOrderUidsNeedingSellerOrderDetailHydration(sellerLines) {
  const uids = new Set([...collectOrderUidsNeedingShippingProgressHydration(sellerLines), ...collectOrderUidsNeedingReceivedHydration(sellerLines)]);
  for (const row of sellerLines || []) {
    if (isReturnListRow(row)) continue;
    if (!orderNeedsShipping(row)) continue;
    const orderUid = resolveListRowOrderUid(row);
    if (!orderUid || orderUid === "—") continue;
    const hasDetailLines = (Array.isArray(row._sale_detail_lines) && row._sale_detail_lines.length > 0) || (Array.isArray(row.lines) && row.lines.length > 0);
    const shippedCount = parseInt(row.shipped_item_count ?? row.shipped_count ?? row.items_shipped, 10);
    const receivedUnits = Math.max(0, parseInt(row.received_units ?? row.received_item_count ?? row.ti_received_qty, 10) || 0);
    const progress = getOrderShippingProgress([row]);
    if (receivedUnits > 0 && (!Number.isFinite(shippedCount) || shippedCount < receivedUnits)) {
      uids.add(orderUid);
      continue;
    }
    if ((progress === "partial" || progress === "complete") && (!hasDetailLines || !Number.isFinite(shippedCount) || shippedCount <= 0)) {
      uids.add(orderUid);
      continue;
    }
    // In-escrow shipping orders without line-level ship qty still show "Not Shipped" incorrectly.
    if (Number(row.transaction_in_escrow ?? row.in_escrow) === 1 && !hasDetailLines && (!Number.isFinite(shippedCount) || shippedCount <= 0)) {
      uids.add(orderUid);
    }
  }
  return [...uids];
}

/** True when the purchase list Delivered column should show "—" (pickup/virtual/no shippable items). */
function purchaseRowDeliveredNotApplicable(row) {
  if (!row || typeof row !== "object") return true;
  if (row.has_shippable_items === 0 || row.has_shippable_items === "0" || row.has_shippable_items === false) return true;
  const status = String(row.fulfillment_status || row.ti_fulfillment_status || row.shipping_status || "")
    .trim()
    .toLowerCase();
  if (status === "not_required") return true;
  return orderFulfillmentIsNotRequired(row);
}

/** Purchased units on a purchase list row — backend source: ti_bs_qty. */
function resolvePurchaseRowShippableUnits(row) {
  if (!row || typeof row !== "object") return 0;
  return Math.max(0, parseInt(row.ti_bs_qty, 10) || 0);
}

/** Seller-shipped units on a purchase list row — backend source: ti_shipped_qty, all_items_shipped. */
function resolvePurchaseRowShippedUnits(row) {
  if (!row || typeof row !== "object") return 0;
  const purchased = resolvePurchaseRowShippableUnits(row);
  if (isTruthyShippingFlag(row.all_items_shipped) && purchased > 0) return purchased;
  return Math.max(0, parseInt(row.ti_shipped_qty, 10) || 0);
}

/** Prefer live ti_shipped_qty / all_items_shipped over stale hydration cache. */
function resolveShippingProgressForDisplay(saleRows, shippingProgressOverride) {
  const rows = Array.isArray(saleRows) ? saleRows.filter(Boolean) : [];
  const first = rows[0] || {};
  if (rows.every(purchaseRowDeliveredNotApplicable)) return "not_required";

  const shippedUnits = resolvePurchaseRowShippedUnits(first);
  const purchasedUnits = resolvePurchaseRowShippableUnits(first);
  if (!purchaseRowDeliveredNotApplicable(first) && purchasedUnits > 0) {
    if (isTruthyShippingFlag(first.all_items_shipped) || shippedUnits >= purchasedUnits) return "complete";
    if (shippedUnits > 0) return "partial";
    return "none";
  }

  const fromRow = getOrderShippingProgress(rows);
  if (fromRow === "complete" || fromRow === "not_required") return fromRow;
  if (fromRow === "none" && shippedUnits <= 0) return "none";

  if (isTruthyShippingFlag(first.all_items_shipped)) return "complete";
  if (shippedUnits > 0 && purchasedUnits > 0) {
    return shippedUnits >= purchasedUnits ? "complete" : "partial";
  }

  if (shippingProgressOverride === "complete" || shippingProgressOverride === "partial" || shippingProgressOverride === "none" || shippingProgressOverride === "not_required") {
    return shippingProgressOverride;
  }
  return fromRow;
}

function getOrderDeliveredStatus(saleRows, shippingProgressOverride) {
  if (!Array.isArray(saleRows) || !saleRows.length) return "—";
  const inEscrow = saleRows.some((row) => Number(row.transaction_in_escrow ?? row.in_escrow) === 1);

  // Pickup / virtual / not_required — shipping column does not apply.
  if (saleRows.every(purchaseRowDeliveredNotApplicable)) {
    return "—";
  }

  const progress = resolveShippingProgressForDisplay(saleRows, shippingProgressOverride);
  if (progress === "not_required") return "—";
  if (progress === "none") return "Not Shipped";
  if (progress === "partial") return "Partial";
  // progress === "complete": all shipping work done → escrow-aware Shipped / Delivered
  // progress === "unknown" with shipping but no line-level data: wait for order-detail hydration (don't flash Not Shipped)
  if (progress === "unknown" && saleRows.some((row) => orderNeedsShipping(row))) {
    return "—";
  }
  if (progress === "complete") {
    if (inEscrow) return "Shipped";
    return "Delivered";
  }
  if (inEscrow) return "Pending";
  return "Not Shipped";
}

/** True when purchase qty evidence shows the buyer has confirmed full receipt (ignores escrow). */
function isPurchaseFullyReceivedByQty(transaction) {
  if (!transaction || typeof transaction !== "object") return false;
  if (isTruthyShippingFlag(transaction.all_items_received)) return true;
  const hydratedReceived = parseInt(transaction.received_units ?? transaction.received_units_total, 10);
  const hydratedPurchased = parseInt(transaction.purchased_units ?? transaction.purchased_units_total, 10);
  if (Number.isFinite(hydratedReceived) && Number.isFinite(hydratedPurchased) && hydratedPurchased > 0 && hydratedReceived >= hydratedPurchased) {
    return true;
  }
  const purchased = Math.max(0, parseInt(transaction.ti_bs_qty, 10) || 0);
  if (purchased > 0 && transaction.ti_received_qty != null && String(transaction.ti_received_qty).trim() !== "") {
    const received = Math.max(0, Math.round(parsePrice(transaction.ti_received_qty)));
    if (received >= purchased) return true;
  }
  const receivedCount = parseInt(transaction.received_item_count ?? transaction.delivered_item_count, 10);
  const totalItems = parseInt(transaction.item_count ?? transaction.total_item_count ?? transaction.shippable_item_count ?? purchased, 10);
  if (Number.isFinite(receivedCount) && Number.isFinite(totalItems) && totalItems > 0 && receivedCount >= totalItems) {
    return true;
  }
  return false;
}

/** Buyer PURCHASES Delivered column — return logistics only on Return rows; Order rows show shipping. */
function getBuyerPurchaseDeliveredLabel(transaction, statusOverride = {}, shippingProgressByKey = null) {
  if (isReturnListRow(transaction)) {
    const returnLogistics = resolveReturnLogisticsLabels(transaction, statusOverride);
    if (returnLogistics) return returnLogistics.delivered;
    return "—";
  }
  if (!transaction) return "—";
  if (purchaseRowDeliveredNotApplicable(transaction)) {
    return "—";
  }
  const orderUid = resolveListRowOrderUid(transaction);
  const txnUid = String(transaction.transaction_uid || "").trim();
  const shippingProgressOverride = (shippingProgressByKey && ((orderUid && orderUid !== "—" && shippingProgressByKey[orderUid]) || (txnUid && shippingProgressByKey[txnUid]))) || null;
  const inEscrow = Number(transaction.transaction_in_escrow ?? transaction.in_escrow) === 1;

  const shippedUnits = resolvePurchaseRowShippedUnits(transaction);
  const purchasedUnits = resolvePurchaseRowShippableUnits(transaction);
  if (isTruthyShippingFlag(transaction.all_items_shipped) || (purchasedUnits > 0 && shippedUnits >= purchasedUnits)) {
    return inEscrow ? "Shipped" : "Delivered";
  }
  if (shippedUnits > 0 && purchasedUnits > 0 && shippedUnits < purchasedUnits) {
    return `${shippedUnits}/${purchasedUnits}`;
  }

  const progress = resolveShippingProgressForDisplay([transaction], shippingProgressOverride);

  if (progress === "complete") {
    return inEscrow ? "Shipped" : "Delivered";
  }
  if (progress === "partial") {
    const shipped = shippedUnits > 0 ? shippedUnits : parseInt(transaction.shipped_item_count ?? transaction.shipped_count, 10);
    const total = purchasedUnits > 0 ? purchasedUnits : parseInt(transaction.shippable_item_count ?? transaction.items_requiring_shipping, 10);
    if (Number.isFinite(shipped) && total > 0 && shipped < total) {
      return `${shipped}/${total}`;
    }
    return "Partial";
  }

  return getOrderDeliveredStatus([transaction], shippingProgressOverride);
}

/**
 * Buyer PURCHASES Received column.
 * Return money state only on Return rows; Order rows show Yes/No/Partial shipping receipt.
 */
function getBuyerPurchaseReceivedLabel(transaction, statusOverride = {}) {
  if (isReturnListRow(transaction)) {
    const returnLogistics = resolveReturnLogisticsLabels(transaction, statusOverride);
    if (returnLogistics) return returnLogistics.received;
    return "—";
  }
  if (!transaction) return "—";

  const fromRows = getOrderReceivedStatusFromSaleRows([transaction]);
  if (fromRows === "Yes" || fromRows === "Partial" || fromRows === "No") return fromRows;

  return "No";
}

/** True when the buyer can still open delivery verification for this purchase row. */
function buyerPurchaseNeedsReceiptVerification(transaction, receivedLabel, deliveredLabel, shippingProgressByKey = null) {
  if (!transaction || isReturnListRow(transaction)) return false;
  if (receivedLabel === "Yes") return false;
  if (isPurchaseFullyReceivedByQty(transaction)) return false;
  if (receivedLabel !== "No" && receivedLabel !== "Partial") return false;

  if (orderFulfillmentIsNotRequired(transaction)) {
    const purchased = Math.max(0, parseInt(transaction.ti_bs_qty, 10) || 0);
    const received = Math.max(0, Math.round(parsePrice(transaction.ti_received_qty ?? transaction.received_item_count ?? transaction.delivered_item_count)));
    if (purchased > 0 && received >= purchased) return false;
    return purchased <= 0 || received < purchased;
  }

  const purchasedUnits = resolvePurchaseRowShippableUnits(transaction);
  const receivedUnits = Math.max(0, Math.round(parsePrice(transaction.ti_received_qty ?? transaction.received_units ?? transaction.received_item_count)));
  const shippedUnits = resolvePurchaseRowShippedUnits(transaction);
  if (purchasedUnits > 0 && receivedUnits < purchasedUnits && shippedUnits > receivedUnits) {
    return true;
  }

  const orderUid = resolveListRowOrderUid(transaction);
  const txnUid = String(transaction.transaction_uid || "").trim();
  const cachedProgress = (shippingProgressByKey && ((orderUid && orderUid !== "—" && shippingProgressByKey[orderUid]) || (txnUid && shippingProgressByKey[txnUid]))) || null;
  const progress = resolveShippingProgressForDisplay([transaction], cachedProgress);

  const delivered = String(deliveredLabel || "").trim();
  const deliveredLower = delivered.toLowerCase();
  const deliveredIndicatesShipped =
    progress === "partial" || progress === "complete" || deliveredLower === "partial" || deliveredLower === "shipped" || deliveredLower === "delivered" || !!parseFractionStatusLabel(delivered);

  if (!deliveredIndicatesShipped) return false;

  const hydratedReceived = parseInt(transaction.received_units ?? transaction.received_units_total, 10);
  const hydratedPurchased = parseInt(transaction.purchased_units ?? transaction.purchased_units_total, 10);
  if (Number.isFinite(hydratedReceived) && Number.isFinite(hydratedPurchased) && hydratedPurchased > 0) {
    if (hydratedReceived >= hydratedPurchased) return false;
    const shipped = shippedUnits;
    if (shipped > 0) {
      return hydratedReceived < shipped;
    }
    return hydratedReceived < hydratedPurchased;
  }

  if (shippedUnits > 0) {
    if (receivedUnits < shippedUnits) return true;
    if (purchasedUnits > shippedUnits) return false;
    return false;
  }

  return receivedLabel === "No" || receivedLabel === "Partial";
}

/** Yes/No/Partial from ti_received_qty vs purchased units on list rows (buyer-confirmed receipt). */
function getUnitReceivedStatusFromSaleRows(saleRows) {
  if (!Array.isArray(saleRows) || !saleRows.length) return null;
  let hasExplicitLineReceived = false;
  let purchasedTracked = 0;
  let receivedTracked = 0;
  for (const row of saleRows) {
    if (row?.ti_received_qty == null || String(row.ti_received_qty).trim() === "") continue;
    hasExplicitLineReceived = true;
    purchasedTracked += getSaleLineQty(row);
    receivedTracked += Math.max(0, Math.round(parsePrice(row.ti_received_qty)));
  }
  if (!hasExplicitLineReceived || purchasedTracked <= 0) return null;
  if (receivedTracked <= 0) return "No";
  if (receivedTracked >= purchasedTracked) return "Yes";
  return "Partial";
}

/**
 * Received status for seller ORDERS (and product-sales order rows).
 * Prefers unit totals / ti_received_qty / list counts.
 * Partial = some but not all units confirmed received while order is still open.
 */
function getOrderReceivedStatusFromSaleRows(saleRows) {
  if (!Array.isArray(saleRows) || !saleRows.length) return "—";
  const first = saleRows[0] || {};

  if (isTruthyShippingFlag(first.all_items_received)) return "Yes";

  // Hydrated unit totals from order-detail lines (most accurate for Partial).
  const hydratedReceived = parseInt(first.received_units ?? first.received_units_total, 10);
  const hydratedPurchased = parseInt(first.purchased_units ?? first.purchased_units_total, 10);
  if (Number.isFinite(hydratedReceived) && Number.isFinite(hydratedPurchased) && hydratedPurchased > 0) {
    if (hydratedReceived <= 0) return "No";
    if (hydratedReceived >= hydratedPurchased) return "Yes";
    return "Partial";
  }

  // ti_received_qty is unit-level buyer confirmation — prefer over received_item_count (often line counts).
  const fromUnitReceived = getUnitReceivedStatusFromSaleRows(saleRows);
  if (fromUnitReceived) return fromUnitReceived;

  const receivedCount = parseInt(first.received_item_count ?? first.delivered_item_count ?? first.items_received, 10);
  const shippableCount = parseInt(first.shippable_item_count ?? first.items_requiring_shipping, 10);
  const purchasedUnits = saleRows.reduce((sum, row) => sum + getSaleLineQty(row), 0);

  if (Number.isFinite(receivedCount) && receivedCount >= 0) {
    // Prefer shippable line-item counts when the API provides them.
    if (Number.isFinite(shippableCount) && shippableCount > 0) {
      if (receivedCount >= shippableCount) return "Yes";
      if (receivedCount > 0) return "Partial";
    } else if (purchasedUnits > 0) {
      // Unit totals on summary rows (no shippable line counts).
      if (receivedCount >= purchasedUnits) return "Yes";
      if (receivedCount > 0) return "Partial";
    }
  }

  // No buyer-verified receipt evidence — do not infer received from escrow release.
  return "No";
}

/** Seller order-table Received label — Partial becomes received/active-purchased when unit counts are known. */
function formatOrderReceivedStatusLabel(saleRows, sellerLines = null, returnStatusesByKey = null) {
  const row = saleRows?.[0];
  if (row && sellerLines && !isReturnListRow(row)) {
    const inEscrow = Number(row.transaction_in_escrow ?? row.in_escrow) === 1;
    const totals = summarizeSaleRowVerification(row, sellerLines, returnStatusesByKey);
    if (totals.activePurchased > 0) {
      if (totals.received <= 0) return "No";
      if (totals.received >= totals.activePurchased) return "Yes";
      return `${totals.received}/${totals.activePurchased}`;
    }
    if (totals.purchased > 0 && totals.returned >= totals.purchased) return inEscrow ? "—" : "Yes";
  }

  const status = getOrderReceivedStatusFromSaleRows(saleRows);
  if (status !== "Partial") return status;

  const first = saleRows?.[0] || {};
  const hydratedReceived = parseInt(first.received_units ?? first.received_units_total, 10);
  const hydratedPurchased = parseInt(first.purchased_units ?? first.purchased_units_total, 10);
  if (Number.isFinite(hydratedReceived) && Number.isFinite(hydratedPurchased) && hydratedPurchased > 0 && hydratedReceived > 0 && hydratedReceived < hydratedPurchased) {
    return `${hydratedReceived}/${hydratedPurchased}`;
  }

  let purchasedTracked = 0;
  let receivedTracked = 0;
  for (const row of saleRows || []) {
    if (row?.ti_received_qty == null || String(row.ti_received_qty).trim() === "") continue;
    purchasedTracked += getSaleLineQty(row);
    receivedTracked += Math.max(0, Math.round(parsePrice(row.ti_received_qty)));
  }
  if (purchasedTracked > 0 && receivedTracked > 0 && receivedTracked < purchasedTracked) {
    return `${receivedTracked}/${purchasedTracked}`;
  }

  const receivedCount = parseInt(first.received_item_count ?? first.items_received, 10);
  const shippableCount = parseInt(first.shippable_item_count ?? first.items_requiring_shipping, 10);
  const purchasedUnits = (saleRows || []).reduce((sum, row) => sum + getSaleLineQty(row), 0);
  const totalItems = Number.isFinite(shippableCount) && shippableCount > 0 ? shippableCount : purchasedUnits;
  if (Number.isFinite(receivedCount) && receivedCount > 0 && totalItems > receivedCount) {
    return `${receivedCount}/${totalItems}`;
  }

  return "Partial";
}

function parseFractionStatusLabel(label) {
  const match = String(label || "")
    .trim()
    .match(/^(\d+)\/(\d+)$/);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  const den = parseInt(match[2], 10);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  return { num, den };
}

function getReturnRowUnits(row) {
  const qty = parseInt(row?.ti_bs_qty, 10);
  if (Number.isFinite(qty) && qty !== 0) return Math.abs(qty);
  const returnQty = parseInt(row?.return_quantity ?? row?.return_qty, 10);
  if (Number.isFinite(returnQty) && returnQty > 0) return returnQty;
  return 1;
}

function sellerReturnRowIsPendingAttention(row, returnStatusesByKey) {
  if (!row || !isReturnListRow(row)) return false;
  if (isPendingReturnListRow(row)) return true;
  const orderUid = resolveListRowOrderUid(row);
  const txnUid = String(row.transaction_uid || "").trim();
  const override = getReturnStatusOverrideForRow(returnStatusesByKey, row, orderUid, txnUid);
  const logistics = resolveReturnLogisticsLabels(row, override);
  if (!logistics) return false;
  if (logistics.return_status === "returning") return true;
  if (logistics.refund_status === "pending" || logistics.refund_status === "stripe_fail") return true;
  return false;
}

function sumCompletedReturnUnitsForOrder(orderUid, sellerLines, expertiseUid, returnStatusesByKey) {
  let total = 0;
  for (const row of sellerLines || []) {
    if (!isReturnListRow(row)) continue;
    if (resolveListRowOrderUid(row) !== orderUid) continue;
    if (expertiseUid) {
      const rowProduct = String(row.ti_bs_id || "").trim();
      if (rowProduct && rowProduct !== expertiseUid) continue;
    }
    if (isPendingReturnListRow(row)) continue;
    const txnUid = String(row.transaction_uid || "").trim();
    const override = getReturnStatusOverrideForRow(returnStatusesByKey, row, orderUid, txnUid);
    const logistics = resolveReturnLogisticsLabels(row, override);
    if (!logistics) continue;
    const completed = (logistics.return_status === "returned" && logistics.refund_status === "refunded") || (logistics.return_status === "cancelled" && logistics.refund_status === "refunded");
    if (completed) total += getReturnRowUnits(row);
  }
  return total;
}

/** Purchased/received totals with completed returns subtracted from the verification denominator. */
function summarizeSaleRowVerification(row, sellerLines, returnStatusesByKey) {
  const orderUid = resolveListRowOrderUid(row);
  const expertiseUid = String(row?.ti_bs_id || "").trim();

  let purchased = 0;
  let received = 0;

  const hydratedPurchased = parseInt(row?.purchased_units ?? row?.purchased_units_total, 10);
  const hydratedReceived = parseInt(row?.received_units ?? row?.received_units_total, 10);
  if (Number.isFinite(hydratedPurchased) && hydratedPurchased > 0) {
    purchased = hydratedPurchased;
    received = Number.isFinite(hydratedReceived) ? Math.max(0, hydratedReceived) : 0;
  } else {
    purchased = getSaleLineQty(row);
    if (row?.ti_received_qty != null && String(row.ti_received_qty).trim() !== "") {
      received = Math.max(0, Math.round(parsePrice(row.ti_received_qty)));
    } else {
      const receivedCount = parseInt(row?.received_item_count ?? row?.delivered_item_count ?? row?.items_received, 10);
      if (Number.isFinite(receivedCount) && receivedCount >= 0) received = receivedCount;
    }
  }

  let cancelledFromLines = 0;
  let returnedFromLines = 0;
  for (const line of [...(Array.isArray(row?.lines) ? row.lines : []), ...(Array.isArray(row?._sale_detail_lines) ? row._sale_detail_lines : [])]) {
    cancelledFromLines += getLineCancelledQty(line);
    returnedFromLines += getLineReturnedQty(line);
  }
  const returnedFromRows = sumCompletedReturnUnitsForOrder(orderUid, sellerLines, expertiseUid, returnStatusesByKey);
  const hasLineSplit = cancelledFromLines > 0 || returnedFromLines > 0;
  const cancelled = cancelledFromLines;
  const returned = hasLineSplit ? returnedFromLines : Math.max(returnedFromLines, returnedFromRows);
  const activePurchased = hasLineSplit ? Math.max(0, purchased - cancelled - returned) : Math.max(0, purchased - returned);

  return { purchased, received, cancelled, returned, activePurchased };
}

/** Shipped vs active shippable units (returns reduce the ship obligation). */
function summarizeSaleRowShipping(row, sellerLines, returnStatusesByKey) {
  const verification = summarizeSaleRowVerification(row, sellerLines, returnStatusesByKey);
  const activeTotal = verification.activePurchased > 0 ? verification.activePurchased : verification.purchased;

  let shipped = 0;
  let shippableTotal = 0;
  let hasLineData = false;

  for (const line of [...(Array.isArray(row?.lines) ? row.lines : []), ...(Array.isArray(row?._sale_detail_lines) ? row._sale_detail_lines : [])]) {
    if (!lineRequiresShipping(line) && getLineShippedQty(line) <= 0) continue;
    hasLineData = true;
    const purchased = getLinePurchasedQty(line) || getSaleLineQty(line);
    const cancelled = getLineCancelledQty(line);
    const shippableLine = Math.max(0, purchased - cancelled);
    shippableTotal += shippableLine;
    shipped += Math.min(getLineShippedQty(line), shippableLine);
  }

  if (!hasLineData) {
    const shippedCount = parseInt(row?.shipped_item_count ?? row?.shipped_count ?? row?.items_shipped, 10);
    const shippableCount = parseInt(row?.shippable_item_count ?? row?.items_requiring_shipping ?? row?.shipping_required_count, 10);
    const unshippedCount = parseInt(row?.unshipped_item_count ?? row?.unshipped_count ?? row?.items_unshipped ?? row?.open_shipping_count, 10);
    if (Number.isFinite(shippedCount) && shippedCount >= 0) shipped = shippedCount;
    if (Number.isFinite(shippableCount) && shippableCount > 0) {
      shippableTotal = Math.max(0, shippableCount - verification.cancelled);
    } else {
      shippableTotal = activeTotal;
    }
    if (shipped <= 0 && Number.isFinite(unshippedCount) && shippableTotal > unshippedCount) {
      shipped = Math.max(0, shippableTotal - unshippedCount);
    }
  }

  if (shippableTotal <= 0 && orderNeedsShipping(row)) shippableTotal = activeTotal;

  return { shipped: Math.max(0, shipped), shippableTotal: Math.max(0, shippableTotal), activeTotal, returned: verification.returned };
}

/** Seller order-table Delivered label — partial shipping becomes shipped/shippable (e.g. 3/5). */
function formatOrderDeliveredStatusLabel(saleRows, sellerLines = null, returnStatusesByKey = null, shippingProgressOverride = null) {
  const row = saleRows?.[0];
  if (!row) return "—";

  const inEscrow = Number(row.transaction_in_escrow ?? row.in_escrow) === 1;
  if (orderFulfillmentIsNotRequired(row) || !orderNeedsShipping(row)) {
    return "—";
  }

  const progress =
    shippingProgressOverride === "complete" || shippingProgressOverride === "partial" || shippingProgressOverride === "none" || shippingProgressOverride === "not_required"
      ? shippingProgressOverride
      : getOrderShippingProgress([row]);

  if (progress === "not_required") return "—";
  if (progress === "unknown") return "—";

  const shipping = summarizeSaleRowShipping(row, sellerLines, returnStatusesByKey);
  const total = shipping.shippableTotal > 0 ? shipping.shippableTotal : shipping.activeTotal;
  const verification = summarizeSaleRowVerification(row, sellerLines, returnStatusesByKey);

  if (total > 0) {
    // List row can lag behind order detail — buyer cannot verify unshipped units.
    if (shipping.shipped <= 0 && verification.received > 0) return "—";
    if (shipping.shipped <= 0) return "Not Shipped";
    if (shipping.shipped >= total) return inEscrow ? "Shipped" : "Delivered";
    return `${shipping.shipped}/${total}`;
  }

  return getOrderDeliveredStatus(saleRows, shippingProgressOverride);
}

const SELLER_ATTENTION_PRIORITY = { red: 3, orange: 2, purple: 1 };

function maxSellerAttentionLevel(current, next) {
  if (!next) return current;
  if (!current) return next;
  return SELLER_ATTENTION_PRIORITY[next] > SELLER_ATTENTION_PRIORITY[current] ? next : current;
}

function resolveSellerShippingProgressOverride(row, shippingProgressByKey) {
  const orderUid = resolveListRowOrderUid(row);
  const txnUid = String(row?.transaction_uid || "").trim();
  return (shippingProgressByKey && ((orderUid && orderUid !== "—" && shippingProgressByKey[orderUid]) || (txnUid && shippingProgressByKey[txnUid]))) || null;
}

/** True when the seller still has units to ship on a shipping-required order. */
function sellerOrderNeedsShippingAction(row, shippingProgressOverride, sellerLines = null, returnStatusesByKey = null) {
  if (!row || isReturnListRow(row)) return false;
  if (!orderNeedsShipping(row) || orderFulfillmentIsNotRequired(row)) return false;

  if (sellerLines) {
    const shipping = summarizeSaleRowShipping(row, sellerLines, returnStatusesByKey);
    const total = shipping.shippableTotal > 0 ? shipping.shippableTotal : shipping.activeTotal;
    if (total > 0) return shipping.shipped < total;
  }

  const progress =
    shippingProgressOverride === "complete" || shippingProgressOverride === "partial" || shippingProgressOverride === "none" || shippingProgressOverride === "not_required"
      ? shippingProgressOverride
      : getOrderShippingProgress([row]);

  if (progress === "complete" || progress === "not_required") return false;

  const unshippedCount = parseInt(row.unshipped_item_count ?? row.unshipped_count ?? row.items_unshipped ?? row.open_shipping_count, 10);
  if (Number.isFinite(unshippedCount) && unshippedCount <= 0) return false;
  if (isTruthyShippingFlag(row.all_items_shipped)) return false;

  const delivered = getOrderDeliveredStatus([row], progress);
  if (delivered === "Not Shipped" || delivered === "Partial" || delivered === "Pending") return true;
  const fraction = parseFractionStatusLabel(delivered);
  if (fraction && fraction.num < fraction.den) return true;
  return progress === "partial" || progress === "none";
}

/** In-escrow sale where the buyer has not fully verified active (non-returned) units. */
function sellerOrderNeedsVerificationAction(row, sellerLines, returnStatusesByKey) {
  if (!row || isReturnListRow(row)) return false;
  if (Number(row.transaction_in_escrow ?? row.in_escrow) !== 1) return false;

  const totals = summarizeSaleRowVerification(row, sellerLines, returnStatusesByKey);
  if (totals.activePurchased <= 0) return false;
  return totals.received < totals.activePurchased;
}

function sellerOrderHasPendingReturnAttention(row, sellerLines, returnStatusesByKey) {
  if (!row || isReturnListRow(row)) return false;
  const orderUid = resolveListRowOrderUid(row);
  const expertiseUid = String(row.ti_bs_id || "").trim();
  for (const sibling of sellerLines || []) {
    if (!isReturnListRow(sibling)) continue;
    if (resolveListRowOrderUid(sibling) !== orderUid) continue;
    if (expertiseUid && String(sibling.ti_bs_id || "").trim() !== expertiseUid) continue;
    if (sellerReturnRowIsPendingAttention(sibling, returnStatusesByKey)) return true;
  }
  if (isPendingReturnListRow(row)) return true;
  if (row.pending_return || (Array.isArray(row.pending_returns) && row.pending_returns.length)) return true;
  return false;
}

/** Priority: red (shipping) > orange (verification) > purple (pending return/refund). */
function resolveSellerOrderAttentionLevel(row, shippingProgressByKey, sellerLines, returnStatusesByKey) {
  if (!row || isReturnListRow(row)) return null;
  const progressOverride = resolveSellerShippingProgressOverride(row, shippingProgressByKey);
  if (sellerOrderNeedsShippingAction(row, progressOverride, sellerLines, returnStatusesByKey)) return "red";
  if (sellerOrderNeedsVerificationAction(row, sellerLines, returnStatusesByKey)) return "orange";
  if (sellerOrderHasPendingReturnAttention(row, sellerLines, returnStatusesByKey)) return "purple";
  return null;
}

function resolveSellerReturnRowAttentionLevel(row, returnStatusesByKey) {
  return sellerReturnRowIsPendingAttention(row, returnStatusesByKey) ? "purple" : null;
}

function resolveOfferingSoldQtyAttentionLevel(expertiseUid, sellerTx, shippingProgressByKey, returnStatusesByKey) {
  const uid = String(expertiseUid || "").trim();
  if (!uid) return null;
  let level = null;
  for (const row of sellerTx || []) {
    if (String(row.ti_bs_id || "").trim() !== uid) continue;
    if (isReturnListRow(row)) {
      level = maxSellerAttentionLevel(level, resolveSellerReturnRowAttentionLevel(row, returnStatusesByKey));
      continue;
    }
    level = maxSellerAttentionLevel(level, resolveSellerOrderAttentionLevel(row, shippingProgressByKey, sellerTx, returnStatusesByKey));
  }
  return level;
}

/** Sum purchased vs received units from an order-detail sale.lines payload. */
function summarizeReceivedUnitsFromOrderDetail(orderDetail) {
  const sale = orderDetail?.sale || orderDetail;
  const lines = Array.isArray(sale?.lines) ? sale.lines : [];
  if (!lines.length) return null;
  let purchased = 0;
  let received = 0;
  for (const line of lines) {
    purchased += Math.max(0, getLinePurchasedQty(line) || getReceiptLineQty(line));
    received += Math.max(0, Math.round(parsePrice(line.ti_received_qty ?? line.received_qty)));
  }
  if (purchased <= 0) return null;
  return { purchased, received };
}

/** Sum shipped vs shippable units from order-detail sale.lines (source of truth for Delivered column). */
function summarizeShippedUnitsFromOrderDetail(orderDetail) {
  const sale = orderDetail?.sale || orderDetail;
  const lines = Array.isArray(sale?.lines) ? sale.lines : [];
  if (lines.length) {
    let shipped = 0;
    let shippable = 0;
    for (const line of lines) {
      if (!lineRequiresShipping(line) && getLineShippedQty(line) <= 0) continue;
      const purchased = Math.max(0, getLinePurchasedQty(line) || getReceiptLineQty(line));
      const cancelled = getLineCancelledQty(line);
      const shippableLine = Math.max(0, purchased - cancelled);
      shippable += shippableLine;
      shipped += Math.min(getLineShippedQty(line), shippableLine);
    }
    if (shippable > 0) return { shipped, shippable, lines };
  }
  const shippedField = parseInt(sale?.shipped_item_count ?? sale?.shipped_count ?? sale?.items_shipped, 10);
  const shippableField = parseInt(sale?.shippable_item_count ?? sale?.items_requiring_shipping ?? sale?.shipping_required_count, 10);
  if (Number.isFinite(shippedField) || Number.isFinite(shippableField)) {
    return {
      shipped: Number.isFinite(shippedField) ? Math.max(0, shippedField) : 0,
      shippable: Number.isFinite(shippableField) ? Math.max(0, shippableField) : 0,
      lines,
    };
  }
  return null;
}

function sumBusinessOrderRows(rows) {
  return (rows || []).reduce(
    (acc, row) => ({
      total: acc.total + (row.total || 0),
      bountyPaid: acc.bountyPaid + (row.bountyPaid || 0),
    }),
    { total: 0, bountyPaid: 0 },
  );
}

function buildProductSalesOrderRows(product, sellerLines, bountyLines, shippingProgressByKey, returnStatusesByKey) {
  const orderUids = new Set();
  for (const sale of product?.sales || []) {
    const uid = resolveListRowOrderUid(sale);
    if (uid !== "—") orderUids.add(uid);
  }
  const scopedLines = (sellerLines || []).filter((row) => orderUids.has(resolveListRowOrderUid(row)));
  return buildBusinessOrdersListFromSellerTransactions(scopedLines, bountyLines, shippingProgressByKey, returnStatusesByKey);
}

function BusinessOrdersTable({ rows, darkMode, maxBodyHeight = 320, onOrderPress, onReturnPress }) {
  const detailRows = rows || [];
  const totals = sumBusinessOrderRows(detailRows);

  const renderStatusBadge = (kind, label, attentionLevel = null) => {
    let badgeStyle;
    if (attentionLevel === "red") {
      badgeStyle = { badge: { backgroundColor: "#FFEBEE" }, text: { color: "#B71C1C", fontWeight: "600" } };
    } else if (attentionLevel === "orange") {
      badgeStyle = { badge: { backgroundColor: "#FFF3E0" }, text: { color: "#E65100", fontWeight: "600" } };
    } else if (attentionLevel === "purple") {
      badgeStyle = { badge: { backgroundColor: "#F3E5F5" }, text: { color: "#7B1FA2", fontWeight: "600" } };
    } else {
      badgeStyle = getProductSaleStatusBadgeStyle(kind, label);
    }
    return (
      <View style={[styles.productSalesDetailStatusBadge, badgeStyle.badge]}>
        <Text style={[styles.productSalesDetailStatusBadgeText, badgeStyle.text]}>{label}</Text>
      </View>
    );
  };

  const isShipActionDeliveredLabel = (label) => {
    const normalized = String(label || "")
      .trim()
      .toLowerCase();
    if (normalized === "not shipped" || normalized === "partial") return true;
    const fraction = parseFractionStatusLabel(label);
    return !!(fraction && fraction.num < fraction.den);
  };

  if (!detailRows.length) {
    return null;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productSalesDetailTableScroll}>
      <View style={styles.productSalesDetailTable}>
        <View style={[styles.productSalesDetailHeaderRow, darkMode && styles.productSalesDetailHeaderRowDark]}>
          <Text style={[styles.productSalesDetailHeaderCell, styles.productSalesDetailColType]}>Type</Text>
          <Text style={[styles.productSalesDetailHeaderCell, styles.productSalesDetailColOrder]}>Order</Text>
          <Text style={[styles.productSalesDetailHeaderCell, styles.productSalesDetailColPlacedBy]}>Placed by</Text>
          <Text style={[styles.productSalesDetailHeaderCell, styles.productSalesDetailColDate]}>Date</Text>
          <Text style={[styles.productSalesDetailHeaderCell, styles.productSalesDetailColTotal]}>Total</Text>
          <Text style={[styles.productSalesDetailHeaderCell, styles.productSalesDetailColMoney]}>Bounty</Text>
          <Text style={[styles.productSalesDetailHeaderCell, styles.productSalesDetailColStatus]}>Shipped</Text>
          <Text style={[styles.productSalesDetailHeaderCell, styles.productSalesDetailColStatus]}>Received</Text>
          <Text style={[styles.productSalesDetailHeaderCell, styles.productSalesDetailColDaysOpen]}>Days open</Text>
        </View>

        <ScrollView style={[styles.productSalesDetailBodyScroll, { maxHeight: maxBodyHeight }]} nestedScrollEnabled>
          {detailRows.map((row, index) => {
            const openReturn = () => {
              if (typeof onReturnPress === "function") onReturnPress(row);
              else if (typeof onOrderPress === "function") onOrderPress(row);
            };
            const openOrder = () => {
              if (typeof onOrderPress === "function") onOrderPress(row);
            };
            const isReturnRow = !!row.isReturn;

            return (
              <View key={row.key} style={[styles.productSalesDetailDataRow, index < detailRows.length - 1 && styles.productSalesDetailDataRowBorder, darkMode && styles.productSalesDetailDataRowDark]}>
                <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColType, isReturnRow && { color: "#B71C1C", fontWeight: "600" }, darkMode && !isReturnRow && { color: "#ccc" }]}>
                  {row.rowLabel || "Order"}
                </Text>
                {onOrderPress || onReturnPress ? (
                  <TouchableOpacity style={styles.productSalesDetailColOrder} onPress={() => (isReturnRow ? openReturn() : openOrder())} activeOpacity={0.7}>
                    <Text style={[styles.productSalesDetailCell, styles.productSalesDetailTxnLink]}>{row.orderUid}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColOrder, styles.productSalesDetailTxnLink]}>{row.orderUid}</Text>
                )}
                <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColPlacedBy, styles.productSalesDetailOrderText, darkMode && { color: "#eee" }]}>{row.placedBy}</Text>
                <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColDate, darkMode && { color: "#ccc" }]}>{row.dateLabel}</Text>
                <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColTotal, isReturnRow && { color: "#B71C1C" }, darkMode && !isReturnRow && { color: "#ccc" }]} numberOfLines={1}>
                  {formatSignedOrderMoney(row.total)}
                </Text>
                <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColMoney, isReturnRow && { color: "#B71C1C" }, darkMode && !isReturnRow && { color: "#ccc" }]}>
                  {formatSignedOrderMoney(row.bountyPaid)}
                </Text>
                <View style={[styles.productSalesDetailColStatus, styles.productSalesDetailStatusCell]}>
                  {isReturnRow && onReturnPress ? (
                    <TouchableOpacity onPress={openReturn} activeOpacity={0.7}>
                      {renderStatusBadge("delivered", row.delivered, row.attentionLevel === "purple" ? "purple" : null)}
                    </TouchableOpacity>
                  ) : onOrderPress && !isReturnRow && isShipActionDeliveredLabel(row.delivered) ? (
                    <TouchableOpacity onPress={openOrder} activeOpacity={0.7}>
                      {renderStatusBadge("delivered", row.delivered, row.attentionLevel === "red" ? "red" : null)}
                    </TouchableOpacity>
                  ) : (
                    renderStatusBadge("delivered", row.delivered, row.attentionLevel === "red" ? "red" : null)
                  )}
                </View>
                <View style={[styles.productSalesDetailColStatus, styles.productSalesDetailStatusCell]}>
                  {isReturnRow && onReturnPress ? (
                    <TouchableOpacity onPress={openReturn} activeOpacity={0.7}>
                      {renderStatusBadge("received", row.received, row.attentionLevel === "purple" ? "purple" : null)}
                    </TouchableOpacity>
                  ) : (
                    renderStatusBadge("received", row.received, row.attentionLevel)
                  )}
                </View>
                <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColDaysOpen, darkMode && { color: "#ccc" }]}>{row.daysOpen}</Text>
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.productSalesDetailTotalRow, darkMode && styles.productSalesDetailTotalRowDark]}>
          <Text style={[styles.productSalesDetailTotalLabel, styles.productSalesDetailColType, darkMode && { color: "#eee" }]}>Total</Text>
          <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColOrder]} />
          <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColPlacedBy]} />
          <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColDate]} />
          <Text style={[styles.productSalesDetailTotalValue, styles.productSalesDetailColTotal, darkMode && { color: "#eee" }]} numberOfLines={1}>
            {formatSignedOrderMoney(totals.total)}
          </Text>
          <Text style={[styles.productSalesDetailTotalValue, styles.productSalesDetailColMoney, darkMode && { color: "#eee" }]}>{formatSignedOrderMoney(totals.bountyPaid)}</Text>
          <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColStatus]} />
          <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColStatus]} />
          <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColDaysOpen]} />
        </View>
      </View>
    </ScrollView>
  );
}

function getProductSaleStatusBadgeStyle(kind, label) {
  const normalized = String(label || "").toLowerCase();
  if (kind === "delivered") {
    if (normalized === "—" || normalized === "-" || normalized === "–" || normalized === "n/a") {
      return { badge: { backgroundColor: "#F5F5F5" }, text: { color: "#9E9E9E" } };
    }
    if (normalized === "not shipped") {
      return { badge: { backgroundColor: "#FFF3E0" }, text: { color: "#E65100" } };
    }
    if (normalized === "partial") {
      return { badge: { backgroundColor: "#FFF8E1" }, text: { color: "#F57F17" } };
    }
    if (/^\d+\/\d+$/.test(normalized)) {
      return { badge: { backgroundColor: "#FFF8E1" }, text: { color: "#F57F17" } };
    }
    if (normalized === "pending") {
      return { badge: { backgroundColor: "#FFF8E1" }, text: { color: "#F57F17" } };
    }
    if (normalized === "shipped") {
      return { badge: { backgroundColor: "#E3F2FD" }, text: { color: "#1565C0" } };
    }
    if (normalized === "returning") {
      return { badge: { backgroundColor: "#FFF3E0" }, text: { color: "#E65100" } };
    }
    if (normalized === "cancelled" || normalized === "canceled") {
      return { badge: { backgroundColor: "#ECEFF1" }, text: { color: "#546E7A" } };
    }
    if (normalized === "returned") {
      return { badge: { backgroundColor: "#FFF3E0" }, text: { color: "#E65100" } };
    }
    if (normalized === "delivered" || normalized === "paid") {
      return { badge: { backgroundColor: "#E8F5E9" }, text: { color: "#2E7D32" } };
    }
    return { badge: { backgroundColor: "#E8F5E9" }, text: { color: "#2E7D32" } };
  }
  if (kind === "shippedLine") {
    if (normalized === "shipped") {
      return { badge: { backgroundColor: "#E3F2FD" }, text: { color: "#1565C0" } };
    }
    if (normalized === "not shipped") {
      return { badge: { backgroundColor: "#FFF3E0" }, text: { color: "#E65100" } };
    }
    if (normalized === "cancelled" || normalized === "canceled") {
      return { badge: { backgroundColor: "#ECEFF1" }, text: { color: "#546E7A" } };
    }
    if (normalized.includes("/")) {
      return { badge: { backgroundColor: "#FFF8E1" }, text: { color: "#F57F17" } };
    }
    return { badge: { backgroundColor: "#F5F5F5" }, text: { color: "#616161" } };
  }
  if (normalized === "yes" || normalized === "complete" || normalized === "refunded") {
    return { badge: { backgroundColor: "#E8F5E9" }, text: { color: "#2E7D32" } };
  }
  if (normalized === "verify") {
    return { badge: { backgroundColor: "#FFEBEE" }, text: { color: "#B71C1C" } };
  }
  if (/^\d+\/\d+$/.test(normalized) || normalized === "partial" || normalized === "pending") {
    return { badge: { backgroundColor: "#FFF8E1" }, text: { color: "#F57F17" } };
  }
  if (normalized === "returning") {
    return { badge: { backgroundColor: "#FFF3E0" }, text: { color: "#E65100" } };
  }
  if (normalized === "stripe fail" || normalized === "stripe_fail" || normalized === "stripe_failed" || normalized === "cc issue" || normalized === "cc_issue") {
    return { badge: { backgroundColor: "#FFF3E0" }, text: { color: "#E65100" } };
  }
  if (normalized === "returned") {
    return { badge: { backgroundColor: "#FFF3E0" }, text: { color: "#E65100" } };
  }
  if (normalized === "rejected") {
    return { badge: { backgroundColor: "#FFEBEE" }, text: { color: "#B71C1C" } };
  }
  if (normalized.startsWith("no")) {
    return { badge: { backgroundColor: "#FFF3E0" }, text: { color: "#E65100" } };
  }
  return { badge: { backgroundColor: "#F5F5F5" }, text: { color: "#616161" } };
}

function extractBusinessRawFromAccountScreenPayload(root, payload) {
  const tryNode = (node) => {
    if (node == null || typeof node !== "object") return null;
    if (node.business && typeof node.business === "object" && !Array.isArray(node.business)) {
      return tryNode(node.business);
    }
    if (node.business_name != null || node.profile_business_name != null || node.business_phone_number != null) {
      return node;
    }
    return null;
  };
  for (const bag of [payload, root]) {
    if (!bag || typeof bag !== "object") continue;
    for (const key of ["business", "business_profile", "business_details", "business_info"]) {
      const hit = tryNode(bag[key]);
      if (hit) return hit;
    }
    const prof = bag.profile;
    if (prof && typeof prof === "object") {
      const hit = tryNode(prof);
      if (hit) return hit;
    }
  }
  return null;
}

function mapRawBusinessToSelectedBusinessFullData(rawBusiness) {
  return mapBusinessToMiniCard(rawBusiness);
}

function mapSessionBusinessRowToMiniCard(row) {
  if (!row || typeof row !== "object") return null;
  return mapBusinessToMiniCard({
    ...row,
    business_name: row.business_name || row.profile_business_name || "",
    business_tag_line: row.business_tag_line || row.profile_business_tag_line || row.tag_line || "",
    business_location: row.business_location || row.profile_business_location || "",
    business_phone_number: row.business_phone_number || row.profile_business_phone_number || "",
    business_profile_img: row.business_profile_img || row.profile_business_image || null,
  });
}

function mapAccountScreenBusinessResponse(json) {
  const root = json && typeof json === "object" ? json : {};
  let payload = root;
  if (root.data !== undefined && typeof root.data === "object" && !Array.isArray(root.data)) {
    payload = root.data;
  }

  let bountyResult = payload.bounty_results ?? payload.business_bounty_results ?? payload.business_bounty ?? payload.bounty ?? null;
  if (bountyResult && !bountyResult.data && Array.isArray(payload.bounty_lines)) {
    bountyResult = { ...bountyResult, data: payload.bounty_lines };
  }
  if (bountyResult && !Array.isArray(bountyResult.data)) {
    const bountyLines = extractTransactionArray(bountyResult);
    if (bountyLines.length) {
      bountyResult = { ...bountyResult, data: bountyLines };
    }
  }

  let sellerLines = [];
  const sellerRaw = payload.seller_transactions ?? payload.transactions_seller ?? payload.business_seller_transactions;
  if (Array.isArray(sellerRaw)) {
    sellerLines = sellerRaw;
  } else if (sellerRaw && isApiSuccessCode(sellerRaw.code) && Array.isArray(sellerRaw.data)) {
    sellerLines = sellerRaw.data;
  } else if (isApiSuccessCode(root.code) && Array.isArray(root.data) && !sellerRaw) {
    sellerLines = root.data;
  }

  if (!bountyResult) {
    bountyResult = { data: [] };
  }

  const businessForMiniCardRaw = extractBusinessRawFromAccountScreenPayload(root, payload);
  const businessServices = extractBusinessServicesFromAccountScreenPayload(root, payload);
  let offerings = [];
  for (const bag of [payload, root]) {
    if (!bag || typeof bag !== "object") continue;
    if (Array.isArray(bag.offerings)) {
      offerings = bag.offerings;
      break;
    }
    const info = bag.business_info;
    if (info && typeof info === "object" && Array.isArray(info.offerings)) {
      offerings = info.offerings;
      break;
    }
  }

  return { bountyResult, sellerLines, businessForMiniCardRaw, businessServices, offerings };
}

/** Services list from account-screen/business (business_info.services or top-level services). */
function extractBusinessServicesFromAccountScreenPayload(root, payload) {
  const bags = [payload, root].filter((bag) => bag && typeof bag === "object");
  for (const bag of bags) {
    const info = bag.business_info;
    if (info && typeof info === "object") {
      if (Array.isArray(info.services)) return info.services;
      if (Array.isArray(info.business_services)) return info.business_services;
    }
    if (Array.isArray(bag.services)) return bag.services;
    if (Array.isArray(bag.business_services)) return bag.business_services;
  }
  return [];
}

/** Display remaining inventory from bs_quantity ("unlimited" → ∞). */
function formatBusinessServiceUnitsAvailable(rawQty) {
  if (rawQty == null || rawQty === "") return "—";
  const asString = String(rawQty).trim();
  if (!asString) return "—";
  if (/^unlimited$/i.test(asString) || asString === "∞") return "∞";
  const n = parseInt(asString, 10);
  if (Number.isFinite(n)) return String(Math.max(0, n));
  return asString;
}

function formatBusinessServiceUnitsAvailableFromService(service) {
  const unlimited = service?.bs_qty_unlimited === 1 || service?.bs_qty_unlimited === "1" || service?.bs_qty_unlimited === true;
  if (unlimited) return "∞";
  return formatBusinessServiceUnitsAvailable(service?.bs_quantity ?? service?.bs_available_quantity ?? service?.quantity);
}

function isBusinessServiceInventoryLimited(service) {
  if (!service || typeof service !== "object") return false;
  return !(service.bs_qty_unlimited === 1 || service.bs_qty_unlimited === "1" || service.bs_qty_unlimited === true);
}

function findBusinessServiceForLine(services, line) {
  const productUid = String(line?.ti_bs_id || line?.bs_uid || "").trim();
  if (!productUid) return null;
  return (services || []).find((service) => String(service?.bs_uid || service?.ti_bs_id || "").trim() === productUid) || null;
}

function findOfferingForLine(catalog, line) {
  const uid = String(line?.ti_bs_id || line?.profile_expertise_uid || line?.bs_uid || "").trim();
  if (!uid) return null;
  return (catalog || []).find((row) => String(row?.profile_expertise_uid || "").trim() === uid) || null;
}

function formatOfferingUnitsAvailable(offering) {
  if (!offering || isOfferingQtyUnlimited(offering)) return "∞";
  const raw = offering.profile_expertise_quantity ?? offering.quantity;
  if (raw == null || raw === "") return "—";
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? String(Math.max(0, n)) : String(raw).trim();
}

function isOfferingInventoryLimited(offering) {
  return offering && typeof offering === "object" && !isOfferingQtyUnlimited(offering);
}

/** Limited-inventory return lines — business products and personal offerings. */
function buildReturnRestockCandidates(returnItems, inventorySources = {}, { receivedKeys = [], isPreShipCancel = false } = {}) {
  const businessServices = inventorySources.businessServices || inventorySources || [];
  const expertiseCatalog = inventorySources.expertiseCatalog || [];
  const receivedSet = new Set(receivedKeys || []);
  const candidates = [];

  for (const item of returnItems || []) {
    const line = item?.line || {};
    const maxQty = Math.max(0, parseInt(item.qty, 10) || 0);
    if (maxQty <= 0) continue;
    const isCancelRow = item.returnKind === "cancel";
    const isReturnRow = item.returnKind === "return";
    if (isReturnRow && !receivedSet.has(item.key)) continue;
    if (!isPreShipCancel && !isCancelRow && !isReturnRow && !receivedSet.has(item.key)) continue;

    const service = findBusinessServiceForLine(businessServices, line);
    if (service && isBusinessServiceInventoryLimited(service)) {
      const bs_uid = String(service.bs_uid || line.ti_bs_id || "").trim();
      if (bs_uid) {
        candidates.push({
          key: item.key,
          bs_uid,
          itemName: item.itemName || item.description || "Item",
          maxQty,
          returnKind: item.returnKind || null,
          currentAvailableLabel: formatBusinessServiceUnitsAvailableFromService(service),
          kind: "business",
        });
        continue;
      }
    }

    const offering = findOfferingForLine(expertiseCatalog, line);
    if (offering && isOfferingInventoryLimited(offering)) {
      const profile_expertise_uid = String(offering.profile_expertise_uid || line.ti_bs_id || "").trim();
      if (profile_expertise_uid) {
        candidates.push({
          key: item.key,
          profile_expertise_uid,
          itemName: item.itemName || item.description || offering.profile_expertise_title || "Item",
          maxQty,
          returnKind: item.returnKind || null,
          currentAvailableLabel: formatOfferingUnitsAvailable(offering),
          kind: "offering",
        });
      }
    }
  }

  return candidates;
}

function buildRestockItemsPayload(candidates, restockQtyByKey) {
  return (candidates || [])
    .map((candidate) => {
      const quantity = Math.max(0, Math.min(candidate.maxQty, parseInt(restockQtyByKey?.[candidate.key], 10) || 0));
      if (quantity <= 0) return null;
      if (candidate.profile_expertise_uid) {
        return { profile_expertise_uid: candidate.profile_expertise_uid, quantity, kind: "offering" };
      }
      return { bs_uid: candidate.bs_uid, quantity, kind: "business" };
    })
    .filter(Boolean);
}

function partitionRestockItems(items) {
  const business = [];
  const offering = [];
  for (const item of items || []) {
    const quantity = Math.max(0, parseInt(item.quantity, 10) || 0);
    if (quantity <= 0) continue;
    if (item.profile_expertise_uid) {
      offering.push({ profile_expertise_uid: String(item.profile_expertise_uid).trim(), quantity });
    } else if (item.bs_uid) {
      business.push({ bs_uid: String(item.bs_uid).trim(), quantity });
    }
  }
  return { business, offering };
}

function applyLocalInventoryRestock(setter, results) {
  if (!Array.isArray(results) || !results.length) return;
  setter((prev) =>
    (prev || []).map((service) => {
      const uid = String(service?.bs_uid || service?.ti_bs_id || "").trim();
      const hit = results.find((row) => String(row.bs_uid || "").trim() === uid);
      if (!hit) return service;
      if (hit.remaining != null && Number.isFinite(hit.remaining)) {
        const nextQty = String(Math.max(0, hit.remaining));
        return { ...service, bs_available_quantity: nextQty, bs_quantity: nextQty };
      }
      const current = parseInt(service.bs_available_quantity ?? service.bs_quantity, 10);
      const base = Number.isFinite(current) ? current : 0;
      const nextQty = String(base + (parseInt(hit.quantity, 10) || 0));
      return { ...service, bs_available_quantity: nextQty, bs_quantity: nextQty };
    }),
  );
}

function nextOfferingRemainingAfterRestock(currentRemaining, hit) {
  if (hit?.remaining != null && Number.isFinite(hit.remaining)) {
    return Math.max(0, hit.remaining);
  }
  const current = currentRemaining != null && Number.isFinite(Number(currentRemaining)) ? Number(currentRemaining) : 0;
  return Math.max(0, current + (parseInt(hit?.quantity, 10) || 0));
}

/**
 * Optimistic SALES "Left" update after restock. Writes overrides synchronously so a following
 * refreshAccountScreenPersonal merge still sees them before React re-renders the catalog.
 */
function applyLocalOfferingRestock(setExpertiseData, setExpertiseCatalog, results, restockOverridesRef, catalogRef) {
  if (!Array.isArray(results) || !results.length) return;
  const byUid = {};
  for (const row of results) {
    const uid = String(row.profile_expertise_uid || "").trim();
    if (uid) byUid[uid] = row;
  }
  if (!Object.keys(byUid).length) return;

  const overrides = restockOverridesRef?.current && typeof restockOverridesRef.current === "object" ? restockOverridesRef.current : null;
  const catalog = catalogRef?.current;

  // Sync overrides before any await/refresh so mergeExpertiseListWithRestockOverrides can see them.
  if (overrides) {
    for (const [uid, hit] of Object.entries(byUid)) {
      const catalogRow = Array.isArray(catalog) ? catalog.find((row) => String(row?.profile_expertise_uid || "").trim() === uid) : null;
      const catalogQty = parseInt(catalogRow?.profile_expertise_quantity, 10);
      const base = Number.isFinite(catalogQty) ? catalogQty : 0;
      overrides[uid] = nextOfferingRemainingAfterRestock(base, hit);
    }
  }

  setExpertiseCatalog((prev) =>
    (prev || []).map((offering) => {
      const uid = String(offering?.profile_expertise_uid || "").trim();
      const hit = byUid[uid];
      if (!hit) return offering;
      const current = parseInt(offering.profile_expertise_quantity, 10);
      const nextQty = nextOfferingRemainingAfterRestock(Number.isFinite(current) ? current : 0, hit);
      return { ...offering, profile_expertise_quantity: nextQty };
    }),
  );

  setExpertiseData((prev) =>
    (prev || []).map((row) => {
      const uid = String(row?.expertiseUid || "").trim();
      const hit = byUid[uid];
      if (!hit) return row;
      return { ...row, remaining: nextOfferingRemainingAfterRestock(row.remaining, hit) };
    }),
  );
}

function formatInventoryMoney(raw, currency) {
  const n = parsePrice(raw);
  if (!Number.isFinite(n)) return "—";
  const prefix = !currency || currency === "USD" ? "$" : `${currency} `;
  return `${prefix}${n.toFixed(2)}`;
}

function formatInventoryBounty(service) {
  const n = parsePrice(service?.bs_bounty);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const prefix = !service?.bs_bounty_currency || service.bs_bounty_currency === "USD" ? "$" : `${service.bs_bounty_currency} `;
  const suffix = String(service?.bs_bounty_type || "").toLowerCase() === "per_item" ? " / item" : "";
  return `${prefix}${n.toFixed(2)}${suffix}`;
}

/** Catalog rows for Product Inventory from account-screen business services. */
function buildProductInventoryRows(services) {
  if (!Array.isArray(services)) return [];
  return services
    .map((service, index) => {
      const productUid = String(service?.bs_uid || service?.ti_bs_id || "").trim();
      const productName = String(service?.bs_service_name || service?.bs_service_desc || "Unnamed product").trim() || "Unnamed product";
      const sku = String(service?.bs_sku || "").trim();
      return {
        key: productUid || `inventory-${index}`,
        productUid: productUid || "—",
        productName,
        sku: sku || "—",
        costLabel: formatInventoryMoney(service?.bs_cost, service?.bs_cost_currency),
        bountyLabel: formatInventoryBounty(service),
        unitsAvailable: formatBusinessServiceUnitsAvailableFromService(service),
      };
    })
    .sort((a, b) => a.productName.localeCompare(b.productName));
}

function buildUnitsAvailableByProductUid(services, offerings) {
  const map = {};
  for (const service of services || []) {
    const uid = String(service?.bs_uid || service?.ti_bs_id || "").trim();
    if (!uid) continue;
    map[uid] = formatBusinessServiceUnitsAvailableFromService(service);
  }
  for (const offering of offerings || []) {
    const uid = String(offering?.profile_expertise_uid || "").trim();
    if (!uid || map[uid]) continue;
    map[uid] = formatOfferingUnitsAvailable(offering);
  }
  return map;
}

/** Drop stale account-screen responses when the API tags type/id or the user switched profiles. */
function accountScreenResponseMatches(json, expectedType, expectedId) {
  if (!json || typeof json !== "object") return true;
  const root = json.data !== undefined && json.data !== null && typeof json.data === "object" && !Array.isArray(json.data) ? json.data : json;
  const type = json.account_screen_type ?? root.account_screen_type;
  const id = json.account_screen_id ?? root.account_screen_id;
  if (type != null && String(type).toLowerCase() !== String(expectedType).toLowerCase()) {
    return false;
  }
  if (id != null && expectedId != null && String(id) !== String(expectedId)) {
    return false;
  }
  return true;
}

function parseExpertiseInfo(raw) {
  if (raw == null) return [];
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
}

function buildExpertiseRows(expertiseList, sellerTransactions) {
  const list = Array.isArray(expertiseList) ? expertiseList : [];
  const sellerTx = Array.isArray(sellerTransactions) ? sellerTransactions : [];
  return list.map((exp) => {
    const expertiseUid = exp.profile_expertise_uid;
    const costString = exp.profile_expertise_cost || "";
    let cost = "";
    let unit = "";
    if (costString) {
      const match = costString.match(/\$?(\d+(?:\.\d+)?)\s*(\/\w+|\w+)?/);
      if (match) {
        cost = match[1] || "";
        unit = match[2] || "";
      } else {
        cost = costString;
      }
    }
    let soldQty = 0;
    const offeringUid = String(expertiseUid || "").trim();
    sellerTx.forEach((transaction) => {
      if (String(transaction.ti_bs_id || "").trim() !== offeringUid) return;
      if (isPendingReturnListRow(transaction)) return;
      soldQty += getSignedProductSalesLineQty(transaction);
    });
    soldQty = Math.max(0, soldQty);
    // profile_expertise_quantity is the remaining quantity in the DB (decremented on each sale).
    // null/0 with no sales = unlimited ("—"); 0 with sales = sold out.
    const rawDbQty = exp.profile_expertise_quantity;
    const dbQty = rawDbQty != null && rawDbQty !== "" ? parseInt(rawDbQty) : null;
    const remaining = dbQty == null ? null : dbQty > 0 ? dbQty : soldQty > 0 ? 0 : null;
    return {
      expertiseUid,
      name: exp.profile_expertise_title || "",
      cost,
      unit,
      bounty: exp.profile_expertise_bounty || "",
      soldQty,
      remaining,
      isPublic: exp.profile_expertise_is_public === 1 || exp.isPublic === true,
    };
  });
}

/**
 * Prefer live profile expertise qty so SALES "Left" drops after sales.
 * Only keep an optimistic restock override while the account-screen/profile payload still lags.
 */
function mergeExpertiseListWithRestockOverrides(incoming, restockOverrides) {
  const overrides = restockOverrides && typeof restockOverrides === "object" ? restockOverrides : null;
  return (incoming || []).map((exp) => {
    const uid = String(exp?.profile_expertise_uid || "").trim();
    if (!uid || !overrides || !Object.prototype.hasOwnProperty.call(overrides, uid)) return exp;
    const overrideQty = parseInt(overrides[uid], 10);
    if (!Number.isFinite(overrideQty)) {
      delete overrides[uid];
      return exp;
    }
    const profileQty = parseInt(exp.profile_expertise_quantity, 10);
    if (Number.isFinite(profileQty) && profileQty >= overrideQty) {
      delete overrides[uid];
      return exp;
    }
    return { ...exp, profile_expertise_quantity: overrideQty };
  });
}

function ReturnModalQtyStepper({ label, value, max, onChange, darkMode, suffix }) {
  const safeMax = Math.max(0, parseInt(max, 10) || 0);
  const safeValue = Math.max(0, Math.min(safeMax, parseInt(value, 10) || 0));
  return (
    <View style={{ marginBottom: 10 }}>
      {label ? <Text style={{ fontSize: 12, color: darkMode ? "#ccc" : "#555", marginBottom: 6 }}>{label}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TouchableOpacity
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: darkMode ? "#555" : "#ccc",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: darkMode ? "#3a3a3a" : "#f5f5f5",
          }}
          onPress={() => onChange(Math.max(0, safeValue - 1))}
        >
          <Text style={{ fontSize: 18, color: darkMode ? "#fff" : "#333" }}>−</Text>
        </TouchableOpacity>
        <TextInput
          style={{
            width: 48,
            marginHorizontal: 10,
            borderWidth: 1,
            borderColor: darkMode ? "#555" : "#ccc",
            borderRadius: 8,
            paddingVertical: 6,
            textAlign: "center",
            fontSize: 14,
            color: darkMode ? "#fff" : "#333",
            backgroundColor: darkMode ? "#3a3a3a" : "#fff",
          }}
          value={String(safeValue)}
          onChangeText={(t) => {
            const digits = t.replace(/[^0-9]/g, "");
            const n = digits === "" ? 0 : parseInt(digits, 10);
            onChange(Math.max(0, Math.min(safeMax, n)));
          }}
          keyboardType='number-pad'
          maxLength={4}
        />
        <TouchableOpacity
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: darkMode ? "#555" : "#ccc",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: darkMode ? "#3a3a3a" : "#f5f5f5",
          }}
          onPress={() => onChange(Math.min(safeMax, safeValue + 1))}
        >
          <Text style={{ fontSize: 18, color: darkMode ? "#fff" : "#333" }}>+</Text>
        </TouchableOpacity>
        {suffix ? <Text style={{ fontSize: 12, color: darkMode ? "#aaa" : "#666", marginLeft: 8 }}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export default function AccountScreen({ navigation, route }) {
  const { darkMode } = useDarkMode();
  const { businesses, primaryBusinessUid, refreshFromSession } = useSessionBusinesses();
  const { width: windowWidth } = useWindowDimensions();
  const [userUID, setUserUID] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bountyData, setBountyData] = useState(null);
  const [bountyLoading, setBountyLoading] = useState(true);
  const [personalWallet, setPersonalWallet] = useState(null);
  const [walletLedgerRows, setWalletLedgerRows] = useState([]);
  const [walletLedgerTotalEntries, setWalletLedgerTotalEntries] = useState(0);
  const [walletLedgerLoading, setWalletLedgerLoading] = useState(true);
  const [walletLedgerError, setWalletLedgerError] = useState(null);
  const [transactionData, setTransactionData] = useState([]);
  const [transactionLoading, setTransactionLoading] = useState(true);
  const [expertiseData, setExpertiseData] = useState([]);
  const [expertiseCatalog, setExpertiseCatalog] = useState([]);
  const expertiseCatalogRef = useRef([]);
  /** uid -> remaining qty after local restock; cleared once profile payload catches up */
  const expertiseRestockOverridesRef = useRef({});
  const [expertiseLoading, setExpertiseLoading] = useState(true);
  const [sellerTxData, setSellerTxData] = useState([]);
  const [salesModal, setSalesModal] = useState({ visible: false, item: null, transactions: [], loading: false });
  const salesDeepLinkKeyRef = useRef("");
  const [productSalesModal, setProductSalesModal] = useState({
    visible: false,
    product: null,
    sales: [],
    receiptByTxn: {},
    loading: false,
  });
  const [businessSellerTransactionList, setBusinessSellerTransactionList] = useState([]);
  /** order_uid / transaction_uid → shipping progress from order detail (list API often lacks fulfillment fields). */
  const [orderShippingProgressByKey, setOrderShippingProgressByKey] = useState({});
  const [orderDetailModal, setOrderDetailModal] = useState({
    visible: false,
    orderUid: null,
    orderDetail: null,
    loading: false,
    error: null,
    isSellerView: false,
    sellerId: null,
    bountyPaidFallback: 0,
    walletLedgerEntries: [],
    highlightLedgerEntryId: null,
  });
  const [returnDetailModal, setReturnDetailModal] = useState({
    visible: false,
    orderUid: null,
    transactionUid: null,
    trrUid: null,
    trrUids: [],
    returnTxnUid: null,
    sourceReturnRow: null,
    orderDetail: null,
    loading: false,
    error: null,
    bountyPaidFallback: 0,
    refundTotalFallback: 0,
    isSellerView: true,
    sellerId: null,
  });
  const [returnReceivedItemKeys, setReturnReceivedItemKeys] = useState([]);
  const [returnRestockQtyByKey, setReturnRestockQtyByKey] = useState({});
  const [returnDetailAccepting, setReturnDetailAccepting] = useState(false);
  const [returnDetailDeclining, setReturnDetailDeclining] = useState(false);
  const [returnConfirmResult, setReturnConfirmResult] = useState(null);
  const [businessTransactionData, setBusinessTransactionData] = useState([]);
  const [businessTransactionLoading, setBusinessTransactionLoading] = useState(true);
  const [businessBountyData, setBusinessBountyData] = useState(null);
  const [businessBountyLoading, setBusinessBountyLoading] = useState(true);
  const [businessServices, setBusinessServices] = useState([]);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("personal"); // 'personal' or business UID
  const [selectedBusinessFullData, setSelectedBusinessFullData] = useState(null);
  const [expandedTransactionId, setExpandedTransactionId] = useState(null);
  const [transactionServices, setTransactionServices] = useState({});
  const [personalProfileData, setPersonalProfileData] = useState(null);

  // Section collapse states
  const [showExpertise, setShowExpertise] = useState(true);
  const [showTransactionHistory, setShowTransactionHistory] = useState(true);
  const [showNetEarning, setShowNetEarning] = useState(true);
  const [showBountyResults, setShowBountyResults] = useState(true);
  const [showProductResults, setShowProductResults] = useState(true);
  const [showBusinessOrders, setShowBusinessOrders] = useState(true);
  const [showBusinessNetEarning, setShowBusinessNetEarning] = useState(true);
  const [showBusinessTransactionHistory, setShowBusinessTransactionHistory] = useState(true);
  const [showProductInventory, setShowProductInventory] = useState(true);
  const [showWallet, setShowWallet] = useState(true);
  const [showWalletLedger, setShowWalletLedger] = useState(false);

  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);
  const [showReceiveItemModal, setShowReceiveItemModal] = useState(false);
  const [pendingTransactionForConfirm, setPendingTransactionForConfirm] = useState(null);
  const [updatingEscrow, setUpdatingEscrow] = useState(false);
  const [deliveryVerificationReceiptData, setDeliveryVerificationReceiptData] = useState([]);
  const [deliveryVerificationLoading, setDeliveryVerificationLoading] = useState(false);
  const [selectedReceivedItems, setSelectedReceivedItems] = useState([]);
  const [receivedItemQuantities, setReceivedItemQuantities] = useState({});
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState([]);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const accountFeedbackInstructions = "Instructions for Account";

  // Define custom questions for the Account page
  const accountFeedbackQuestions = ["Account - Question 1?", "Account - Question 2?", "Account - Question 3?"];

  const [settingsDebugModeEnabled, setSettingsDebugModeEnabled] = useState(false);

  const [returnRequests, setReturnRequests] = useState({});
  const [receiptTransaction, setReceiptTransaction] = useState(null);

  const handleAccountMiniCardPress = async () => {
    if (selectedAccount === "personal") {
      const profileId = (await getSessionProfile())?.profileUid || (await AsyncStorage.getItem("profile_uid"));
      if (profileId) {
        navigation.navigate("Profile", { profile_uid: profileId, returnTo: "Account" });
      } else {
        navigation.navigate("Profile");
      }
      return;
    }

    if (selectedAccount && selectedAccount !== "personal") {
      navigation.navigate("BusinessProfile", { business_uid: selectedAccount, returnTo: "Account" });
    }
  };

  //for return message
  const [returnNote, setReturnNote] = useState("");
  const [showReturnNoteModal, setShowReturnNoteModal] = useState(false);

  /** Coalesce overlapping refreshAccountScreenPersonal calls (focus + escrow update, Strict Mode, etc.) */
  const refreshPersonalInFlightRef = useRef(null);
  /** Coalesce overlapping wallet ledger fetches (focus + selectedAccount effect on mount). */
  const refreshWalletLedgerInFlightRef = useRef(null);
  /** Skip wallet fetch in selectedAccount effect when useFocusEffect already loaded it. */
  const skipWalletOnNextPersonalEffectRef = useRef(true);
  /** Ignore in-flight account-screen responses after a profile switch. */
  const personalFetchGenRef = useRef(0);
  const businessFetchGenRef = useRef(0);

  /** Avoid stale `selectedAccount` / `primaryBusinessUid` / `businesses` inside `refreshAccountScreenBusiness` when invoked from a focus callback with `[]` deps */
  const selectedAccountRef = useRef(selectedAccount);
  const businessUIDRef = useRef(primaryBusinessUid);
  const businessesRef = useRef(businesses);

  const [receiptEnrichedItems, setReceiptEnrichedItems] = useState({});

  useEffect(() => {
    selectedAccountRef.current = selectedAccount;
  }, [selectedAccount]);
  useEffect(() => {
    businessUIDRef.current = primaryBusinessUid;
  }, [primaryBusinessUid]);
  useEffect(() => {
    businessesRef.current = businesses;
  }, [businesses]);
  useEffect(() => {
    expertiseCatalogRef.current = expertiseCatalog;
  }, [expertiseCatalog]);

  const clearPersonalAccountSections = () => {
    setTransactionData([]);
    setExpertiseData([]);
    setExpertiseCatalog([]);
    expertiseRestockOverridesRef.current = {};
    setSellerTxData([]);
    setBountyData(null);
    setPersonalWallet(null);
    setWalletLedgerRows([]);
    setWalletLedgerTotalEntries(0);
    setWalletLedgerError(null);
    setWalletLedgerLoading(true);
    setTransactionLoading(true);
    setBountyLoading(true);
    setExpertiseLoading(true);
  };

  const clearBusinessAccountSections = () => {
    setBusinessTransactionData([]);
    setBusinessBountyData(null);
    setBusinessServices([]);
    setBusinessReceiptCache({});
    businessReceiptFetchedRef.current = new Set();
    setSelectedBusinessFullData(null);
    setBusinessTransactionLoading(true);
    setBusinessBountyLoading(true);
  };

  const handleProfileSelection = (nextAccount) => {
    setShowAccountDropdown(false);
    const current = selectedAccountRef.current;
    if (nextAccount === current) return;

    if (nextAccount === "personal") {
      businessFetchGenRef.current += 1;
      personalFetchGenRef.current += 1;
      refreshPersonalInFlightRef.current = null;
      refreshWalletLedgerInFlightRef.current = null;
      skipWalletOnNextPersonalEffectRef.current = false;
      clearBusinessAccountSections();
      clearPersonalAccountSections();
    } else {
      personalFetchGenRef.current += 1;
      businessFetchGenRef.current += 1;
      clearBusinessAccountSections();
    }
    setSelectedAccount(nextAccount);
  };

  //seller can see return note in transaction details if return requested
  const [showReturnNoteViewModal, setShowReturnNoteViewModal] = useState(false);
  const [viewingReturnNote, setViewingReturnNote] = useState("");

  //Accept/Decline
  const [returnStatuses, setReturnStatuses] = useState({});
  const [viewingReturnTransactionUid, setViewingReturnTransactionUid] = useState(null);

  //select item to return
  const [selectedReturnItems, setSelectedReturnItems] = useState([]);
  const [returnItemQuantities, setReturnItemQuantities] = useState({});
  const [returnItemSplitQty, setReturnItemSplitQty] = useState({});
  const [returnModalReceiptData, setReturnModalReceiptData] = useState([]);
  const [returnModalOrderLines, setReturnModalOrderLines] = useState([]);
  const [returnModalLoading, setReturnModalLoading] = useState(false);
  const [returnSubmitLoading, setReturnSubmitLoading] = useState(false);
  const [receiptOrderDetail, setReceiptOrderDetail] = useState(null);

  const [businessReceiptCache, setBusinessReceiptCache] = useState({});
  /** Avoid duplicate receipt GETs when re-expanding the same business transaction */
  const businessReceiptFetchedRef = useRef(new Set());

  const [showDeclineNoteModal, setShowDeclineNoteModal] = useState(false);
  const [declineNote, setDeclineNote] = useState("");
  const [showConfirmReceiptNoteModal, setShowConfirmReceiptNoteModal] = useState(false);
  const [confirmReceiptNote, setConfirmReceiptNote] = useState("");
  const [pendingConfirmReceipt, setPendingConfirmReceipt] = useState(null); // { transactionUid, orderUid, trrUid, orderDetail, listIdx }
  const [pendingDeclineIdx, setPendingDeclineIdx] = useState(null);

  // above your effect or focus logic
  const checkAuth = async () => {
    try {
      const uid = await AsyncStorage.getItem("user_uid");
      setUserUID(uid ?? "");
    } catch {
      setUserUID("");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReceipt = async (transaction) => {
    const profileId = transaction.transaction_profile_id || (await AsyncStorage.getItem("profile_uid"));
    const transactionUid = transaction.transaction_uid;
    if (!profileId || !transactionUid) {
      Alert.alert("Error", "Cannot load receipt: missing transaction data.");
      return;
    }
    try {
      setReceiptLoading(true);
      setReceiptData([]);
      setReceiptOrderDetail(null);
      setShowReceiptModal(true);
      const storedReturn = await AsyncStorage.getItem(`return_request_${transaction.transaction_uid}`);
      const parsedReturn = storedReturn ? JSON.parse(storedReturn) : null;
      setReceiptTransaction({
        ...transaction,
        transaction_return_note: transaction.transaction_return_note || parsedReturn?.note || "",
        transaction_return_requested: transaction.transaction_return_requested || (parsedReturn?.requested ? 1 : 0),
      });

      // Load enriched choices FIRST so they're ready when receipt data arrives
      let localEnrichedItems = {};
      try {
        // 1. Persistent choices saved at checkout time
        const stored = await AsyncStorage.getItem("receipt_choices_by_bs_uid");
        const persistedChoices = stored ? JSON.parse(stored) : {};

        // 2. Active cart items as fallback (not yet checked out)
        const allKeys = await AsyncStorage.getAllKeys();
        const cartKeys = allKeys.filter((k) => k.startsWith("cart_"));
        const allCartRaw = await AsyncStorage.multiGet(cartKeys);
        const cartEnrichMap = {};
        allCartRaw.forEach(([key, val]) => {
          if (!val) return;
          try {
            const parsed = JSON.parse(val);
            // Expertise/offering cart items (cart_expertise_*) store cost string directly
            if (key.startsWith("cart_expertise_") && parsed.expertise_uid && parsed.cost) {
              cartEnrichMap[parsed.expertise_uid] = { offeringCostString: parsed.cost };
              return;
            }
            (parsed.items || []).forEach((cartItem) => {
              const enrichment = cartChoiceEnrichmentFromItem(cartItem);
              if (enrichment) {
                cartEnrichMap[cartItem.bs_uid] = enrichment;
              }
            });
          } catch {}
        });

        // Persisted data takes priority over active cart
        localEnrichedItems = { ...cartEnrichMap, ...persistedChoices };
        console.log("fetchReceipt - enriched items loaded:", Object.keys(localEnrichedItems).length, "keys");
        console.log("fetchReceipt - enriched items:", JSON.stringify(localEnrichedItems));
        setReceiptEnrichedItems(localEnrichedItems);
      } catch (e) {
        console.warn("fetchReceipt - failed to load enriched items:", e);
      }

      const url = buildTransactionReceiptUrl(transaction, profileId);
      if (!url) {
        throw new Error("Cannot load receipt: missing transaction data.");
      }

      const response = await fetch(url, { method: "GET" });
      if (!response.ok) {
        throw new Error(`Failed to load receipt: ${response.status}`);
      }
      const result = await response.json();
      let items = [];
      if (Array.isArray(result)) {
        items = result;
      } else if (Array.isArray(result?.data)) {
        items = result.data;
      } else if (result?.data && typeof result.data === "object" && !Array.isArray(result.data)) {
        items = [result.data];
      } else if (result?.data) {
        items = [result.data];
      }

      // For expertise/offering purchases the receipt endpoint often has no line items.
      // Synthesize a row from the transaction summary so the modal always shows something.
      const purchaseTypeFallback = (transaction.purchase_type || "").toLowerCase();
      if (items.length === 0 && (purchaseTypeFallback === "expertise" || purchaseTypeFallback === "offering")) {
        const qty = Math.max(1, parseInt(transaction.ti_bs_qty || 1, 10));
        const totalAmt = parseFloat(transaction.seller_total || transaction.transaction_total || 0);
        const tiCost = parseFloat(transaction.ti_bs_cost);
        const unitCost = tiCost > 0 ? tiCost : qty > 0 ? totalAmt / qty : totalAmt;
        // Prefer ti_bs_id (expertise UID) from the transaction row; if missing use any key
        // from localEnrichedItems that has an offeringCostString so the lookup still works.
        const txExpertiseId = String(transaction.ti_bs_id || "").trim();
        const enrichedExpertiseKey = txExpertiseId || Object.keys(localEnrichedItems).find((k) => localEnrichedItems[k]?.offeringCostString) || String(transaction.transaction_uid || "").trim();
        items = [
          {
            ti_uid: String(transaction.ti_uid || transaction.transaction_uid || "").trim(),
            ti_bs_id: enrichedExpertiseKey,
            bs_uid: enrichedExpertiseKey,
            bs_service_name: transaction.purchased_item || "",
            bs_service_desc: "",
            ti_bs_cost: unitCost,
            ti_bs_qty: qty,
          },
        ];
      }

      const apiEnrichMap = {};
      items.forEach((row) => {
        const parsed = enrichFromReceiptRow(row);
        if (!parsed) return;
        const tiUid = row.ti_uid != null ? String(row.ti_uid).trim() : "";
        const bsId = row.ti_bs_id != null && String(row.ti_bs_id).trim() !== "" ? String(row.ti_bs_id).trim() : row.bs_uid != null && String(row.bs_uid).trim() !== "" ? String(row.bs_uid).trim() : "";
        if (tiUid) apiEnrichMap[tiUid] = parsed;
        if (bsId) apiEnrichMap[bsId] = parsed;
      });
      setReceiptEnrichedItems({ ...localEnrichedItems, ...apiEnrichMap });
      setReceiptData(items);

      const orderUid = resolveListRowOrderUid(transaction);
      if (orderUid && orderUid !== "—") {
        try {
          const orderDetail = await fetchOrderDetailApi(orderUid, { profileId });
          setReceiptOrderDetail(orderDetail);
          const enrichedLines = resolveReturnModalOrderLines(orderDetail, items);
          if (enrichedLines.length > 0) {
            setReceiptData(enrichedLines);
          }
        } catch (orderErr) {
          console.warn("fetchReceipt - order detail unavailable:", orderErr?.message || orderErr);
          setReceiptOrderDetail(null);
        }
      }
    } catch (error) {
      console.error("Error fetching receipt:", error);
      Alert.alert("Error", error.message || "Failed to load receipt.");
      setShowReceiptModal(false);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleReturnRequest = async (transaction, buyerNote, transactionReturnItems, options = {}) => {
    const saleUid = resolveListRowOrderUid(transaction);
    if (!saleUid || saleUid === "—") return false;
    if (!Array.isArray(transactionReturnItems) || transactionReturnItems.length === 0) {
      Alert.alert("Error", "No return line items to submit.");
      return false;
    }
    const profileId = transaction?.transaction_profile_id || (await AsyncStorage.getItem("profile_uid"));
    if (!profileId) {
      Alert.alert("Error", "Cannot submit return: missing profile.");
      return false;
    }
    const cancelUnshipped = options.cancel_unshipped === true;
    const cancelOnly = options.cancel_only === true;
    try {
      // One note per return request row (trr_note); do not append prior returns.
      const note = (buyerNote || "").trim();
      const response = await fetch(TRANSACTIONS_RETURN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          transaction_uid: saleUid,
          transaction_return_requested: 1,
          transaction_return_note: note,
          transaction_return_items: transactionReturnItems,
          ...(cancelUnshipped || cancelOnly ? { cancel_unshipped: true } : {}),
          ...(cancelOnly ? { pre_ship_cancel: true } : {}),
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      let requestResult = null;
      try {
        requestResult = await response.json();
      } catch (_) {
        requestResult = null;
      }
      const resultPayload = requestResult?.data && typeof requestResult.data === "object" ? requestResult.data : requestResult || {};
      const defaultReturnStatus = cancelOnly ? "cancelled" : "returning";
      const defaultDisplay = cancelOnly ? "Cancelled - Pending" : "Returning - Pending";
      const returningState = extractReturnRefundState(resultPayload, {
        return_status: resultPayload.return_status || defaultReturnStatus,
        refund_status: resultPayload.refund_status || "pending",
        display_status: resultPayload.display_status || defaultDisplay,
        returnRequested: 1,
        ...(cancelOnly ? { cancel_unshipped: true } : {}),
      });
      const statusPayload = {
        return_status: returningState.return_status || defaultReturnStatus,
        refund_status: returningState.refund_status || "pending",
        display_status: returningState.display_status || defaultDisplay,
        ...(cancelOnly || returningState.is_cancel_before_ship ? { is_cancel_before_ship: true, cancel_unshipped: true } : {}),
      };
      setReturnStatuses((prev) => ({
        ...prev,
        [saleUid]: statusPayload,
      }));
      await AsyncStorage.setItem(`return_status_${saleUid}`, JSON.stringify(statusPayload));
      const existing = returnRequests[saleUid] || { items: [], notes: [] };
      const itemQuantities = selectedReturnItems.reduce((acc, id) => {
        const split = returnItemSplitQty[id];
        acc[id] = split ? split.shipped + split.unshipped : (returnItemQuantities[id] ?? 1);
        return acc;
      }, {});
      const mergedItems = [...new Set([...(existing.items || []), ...selectedReturnItems])];
      const updated = {
        items: mergedItems,
        notes: [
          ...(existing.notes || []),
          {
            items: selectedReturnItems,
            itemQuantities,
            itemSplitQuantities: selectedReturnItems.reduce((acc, id) => {
              if (returnItemSplitQty[id]) acc[id] = returnItemSplitQty[id];
              return acc;
            }, {}),
            transactionReturnItems,
            note: note || "",
            date: new Date().toISOString(),
          },
        ],
      };
      setReturnRequests((prev) => ({ ...prev, [saleUid]: updated }));
      await AsyncStorage.setItem(`return_request_${saleUid}`, JSON.stringify(updated));
      setReturnNote("");
      setReturnItemQuantities({});
      setReturnItemSplitQty({});
      if (selectedAccountRef.current === "personal") {
        await refreshAccountScreenPersonal();
      }
      return true;
    } catch (error) {
      console.error("Error requesting return:", error);
      Alert.alert("Error", "Failed to submit return request. Please try again.");
      return false;
    }
  };

  const resolveSellerIdForReturn = (transactionUid) => {
    const fromModal = String(returnDetailModal.sellerId || "").trim();
    if (fromModal) return fromModal;
    if (selectedAccount && selectedAccount !== "personal") {
      return String(selectedAccount).trim();
    }
    const sale = returnDetailModal.orderDetail?.sale;
    const fromSale = String(sale?.seller_id || sale?.transaction_seller_id || sale?.profile_seller_id || "").trim();
    if (fromSale) return fromSale;
    const fromList = (businessSellerTransactionList || []).find((row) => {
      const uid = String(row.transaction_uid || "").trim();
      const orderUid = resolveListRowOrderUid(row);
      return uid === transactionUid || orderUid === transactionUid;
    });
    return String(fromList?.seller_id || fromList?.transaction_seller_id || "").trim();
  };

  const persistReturnRefundState = async (statusKeys, state, { scopeTrrUid = null, scopeReturnTxnUid = null, clearOrderUids = [] } = {}) => {
    const payload = {
      return_status: state.return_status,
      refund_status: state.refund_status,
      display_status: state.display_status,
    };
    const keys = (statusKeys || []).map((k) => String(k || "").trim()).filter(Boolean);
    const scopeTrr = String(scopeTrrUid || "").trim();
    const orderUidsToClear = (clearOrderUids || []).map((k) => String(k || "").trim()).filter(Boolean);
    setReturnStatuses((prev) => {
      const next = { ...prev };
      for (const key of keys) next[key] = payload;
      // Drop legacy order-level cache entries when confirming a specific concurrent return,
      // otherwise sibling return rows keep inheriting Refunded via order_uid.
      if (scopeTrr) {
        for (const orderUid of orderUidsToClear) {
          if (orderUid && orderUid !== scopeTrr) delete next[orderUid];
        }
      }
      return next;
    });
    await Promise.all(keys.map((key) => AsyncStorage.setItem(`return_status_${key}`, JSON.stringify(payload))));
    if (scopeTrr && orderUidsToClear.length) {
      await Promise.all(orderUidsToClear.filter((orderUid) => orderUid && orderUid !== scopeTrr).map((orderUid) => AsyncStorage.removeItem(`return_status_${orderUid}`)));
    }
    const patchRows = (prev) =>
      (prev || []).map((row) => {
        if (!rowMatchesReturnStatusKeys(row, keys, { scopeTrrUid, scopeReturnTxnUid })) return row;
        return applyReturnRefundFieldsToRow(row, payload);
      });
    setBusinessSellerTransactionList(patchRows);
    setBusinessTransactionData(patchRows);
    // Buyer PURCHASES list — keep Delivered/Received chips in sync with return-detail / confirm outcomes.
    setTransactionData(patchRows);
  };

  /**
   * Persist Stripe-fail outcome on the backend so account-screen reads match local chips.
   * Uses confirm endpoint with action=set_refund_status (no Stripe re-attempt).
   * Status field names stay canonical: return_status=returned, refund_status=stripe_fail.
   */
  const persistStripeFailRefundStatusToBackend = async ({ transactionUid, sellerId, orderUid, returnTransactionUid, state, stripeRefund }) => {
    const body = {
      transaction_uid: transactionUid,
      seller_id: sellerId,
      action: "set_refund_status",
      return_status: "returned",
      refund_status: "stripe_fail",
      display_status: state?.display_status || "Returned - CC Issue",
      transaction_return_status: "returned",
      transaction_refund_status: "stripe_fail",
    };
    const orderKey = String(orderUid || "").trim();
    const returnTxn = String(returnTransactionUid || "").trim();
    if (orderKey) body.order_uid = orderKey;
    if (returnTxn) body.return_transaction_uid = returnTxn;
    if (stripeRefund && typeof stripeRefund === "object") body.stripe_refund = stripeRefund;

    const response = await fetch(TRANSACTIONS_RETURN_CONFIRM_ENDPOINT, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let result = null;
    try {
      result = await response.json();
    } catch (_) {
      result = null;
    }
    const apiCode = result?.code ?? result?.data?.code;
    if (!response.ok || (apiCode != null && !isApiSuccessCode(apiCode))) {
      const message = result?.message || result?.data?.message || `HTTP ${response.status}`;
      console.warn("Failed to persist stripe_fail refund status to backend:", message, body);
      return { ok: false, result };
    }
    return { ok: true, result: result?.data && typeof result.data === "object" ? result.data : result };
  };

  /**
   * Persist successful IO-Payments createRefund when confirm still stored rejected/CC Issue
   * (Every-Circle local Stripe path had no secret key).
   */
  const persistRefundedStatusToBackend = async ({ transactionUid, sellerId, orderUid, returnTransactionUid, state, stripeRefund, trrUids = null }) => {
    const body = {
      transaction_uid: transactionUid,
      seller_id: sellerId,
      action: "set_refund_status",
      return_status: "returned",
      refund_status: "refunded",
      display_status: state?.display_status || "Returned - Refunded",
      transaction_return_status: "returned",
      transaction_refund_status: "refunded",
    };
    const orderKey = String(orderUid || "").trim();
    const returnTxn = String(returnTransactionUid || "").trim();
    const resolvedTrrUids = normalizeTrrUidList(trrUids);
    if (orderKey) body.order_uid = orderKey;
    if (returnTxn) body.return_transaction_uid = returnTxn;
    if (resolvedTrrUids.length > 1) {
      body.trr_uids = resolvedTrrUids;
      body.trr_uid = resolvedTrrUids[0];
    } else if (resolvedTrrUids[0]) {
      body.trr_uid = resolvedTrrUids[0];
    }
    if (stripeRefund && typeof stripeRefund === "object") body.stripe_refund = stripeRefund;
    if (stripeRefund?.refund_id) body.stripe_refund_id = stripeRefund.refund_id;

    console.log("============================================");
    console.log("ENDPOINT: TRANSACTIONS_RETURN_CONFIRM (set_refund_status → refunded)");
    console.log("URL:", TRANSACTIONS_RETURN_CONFIRM_ENDPOINT);
    console.log("METHOD: PUT");
    console.log("REQUEST BODY:", JSON.stringify(body, null, 2));
    console.log("============================================");

    const response = await fetch(TRANSACTIONS_RETURN_CONFIRM_ENDPOINT, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let result = null;
    try {
      result = await response.json();
    } catch (_) {
      result = null;
    }
    const apiCode = result?.code ?? result?.data?.code;
    if (!response.ok || (apiCode != null && !isApiSuccessCode(apiCode))) {
      const message = result?.message || result?.data?.message || `HTTP ${response.status}`;
      // Deployed API may still be the old confirm handler (confirm|decline only).
      if (/action must be ['"]confirm['"] or ['"]decline['"]/i.test(String(message))) {
        console.warn("Every-Circle-Backend is not deployed with set_refund_status yet. Deploy transactions.py so refunded/CC Issue can be persisted. Local UI will still show refunded.", body);
        return { ok: false, undeployed: true, result };
      }
      console.warn("Failed to persist refunded status to backend:", message, body);
      return { ok: false, result };
    }
    return { ok: true, result: result?.data && typeof result.data === "object" ? result.data : result };
  };

  const handleSellerReturnConfirmAction = async ({ transactionUid, orderUidForStatus, trrUid = null, trrUids = null, action, sellerNote = "", stripeRefundResult = null, restockItems = null }) => {
    // Backend batch-confirm: pass trr_uids[] for a multi-item wave → one ledger + one Stripe.
    const batchTrrUids = normalizeTrrUidList(trrUids, trrUid);
    // transaction_uid must ALWAYS be the sale (500-… / order_uid). On pending rows, transaction_uid is the trr_uid.
    const saleUid = String(orderUidForStatus || transactionUid || "").trim();
    const resolvedTrr = String(batchTrrUids[0] || trrUid || "").trim();
    const sellerId = resolveSellerIdForReturn(saleUid);
    if (!sellerId) {
      Alert.alert("Error", "Missing seller_id for return confirmation.");
      return { ok: false };
    }
    try {
      const body = {
        transaction_uid: saleUid,
        seller_id: sellerId,
        action,
        transaction_return_seller_note: sellerNote || (action === "confirm" ? "Item received" : ""),
      };
      if (batchTrrUids.length > 1) {
        body.trr_uids = batchTrrUids;
        body.trr_uid = batchTrrUids[0];
      } else if (resolvedTrr) {
        body.trr_uid = resolvedTrr;
      }
      // When FE already called IO-Payments createRefund, pass result so backend does not re-call Stripe.
      if (action === "confirm" && stripeRefundResult && typeof stripeRefundResult === "object") {
        body.stripe_refund = {
          ok: Boolean(stripeRefundResult.ok),
          skipped: Boolean(stripeRefundResult.skipped),
          refund_id: stripeRefundResult.refund_id || null,
          message: stripeRefundResult.message || null,
        };
        if (stripeRefundResult.refund_id) {
          body.stripe_refund_id = stripeRefundResult.refund_id;
        }
      }
      if (action === "confirm" && Array.isArray(restockItems) && restockItems.length) {
        body.restock_items = restockItems
          .map((item) => ({
            bs_uid: String(item.bs_uid || "").trim(),
            quantity: Math.max(0, parseInt(item.quantity, 10) || 0),
          }))
          .filter((item) => item.bs_uid && item.quantity > 0);
      }
      const response = await fetch(TRANSACTIONS_RETURN_CONFIRM_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let result = null;
      try {
        result = await response.json();
      } catch (_) {
        result = null;
      }
      const apiCode = result?.code ?? result?.data?.code;
      if (!response.ok || (apiCode != null && !isApiSuccessCode(apiCode))) {
        Alert.alert("Error", result?.message || result?.data?.message || `Failed to ${action} return (${response.status}).`);
        return { ok: false, result };
      }
      const payload = result?.data && typeof result.data === "object" ? result.data : result || {};
      const defaults =
        action === "confirm"
          ? { return_status: "returned", refund_status: "pending", display_status: "Returned - Pending" }
          : { return_status: "returning", refund_status: "rejected", display_status: "Returning - Rejected" };

      // Prefer the IO-Payments createRefund result from the FE when present.
      // Deployed Every-Circle confirm may still report "Stripe secret key not configured"
      // from its local key path even after createRefund already succeeded on Stripe.
      const clientStripeOk = action === "confirm" && stripeRefundResult?.ok === true;
      const stripeRefund = clientStripeOk
        ? {
            ok: true,
            skipped: false,
            refund_id: stripeRefundResult.refund_id || payload.stripe_refund?.refund_id || null,
            message: stripeRefundResult.message || "Refund created",
          }
        : payload.stripe_refund || stripeRefundResult || null;

      const stripeFailedOnConfirm =
        action === "confirm" &&
        !clientStripeOk &&
        (payload.refund_status === "rejected" || payload.refund_status === "stripe_fail" || payload.refund_status === "stripe_failed" || stripeRefund?.ok === false || stripeRefund?.skipped === true);

      const state = extractReturnRefundState(payload, {
        return_status: payload.return_status || defaults.return_status,
        refund_status: clientStripeOk ? "refunded" : stripeFailedOnConfirm ? "stripe_fail" : payload.refund_status || defaults.refund_status,
        display_status: clientStripeOk ? "Returned - Refunded" : stripeFailedOnConfirm ? "Returned - CC Issue" : payload.display_status || defaults.display_status,
        returnRequested: 1,
        stripe_refund: stripeRefund,
      });
      if (clientStripeOk) {
        state.return_status = "returned";
        state.refund_status = "refunded";
        state.display_status = "Returned - Refunded";
        // If backend still stored rejected/CC Issue (old local Stripe path), correct it.
        const backendRefund = String(payload.refund_status || payload.transaction_refund_status || "")
          .trim()
          .toLowerCase();
        if (backendRefund !== "refunded") {
          try {
            await persistRefundedStatusToBackend({
              transactionUid: saleUid,
              sellerId,
              orderUid: saleUid,
              returnTransactionUid: payload.return_transaction_uid || payload.transaction_uid,
              state,
              stripeRefund,
              trrUids: batchTrrUids.length ? batchTrrUids : normalizeTrrUidList(payload.trr_uids, payload.trr_uid, resolvedTrr),
            });
          } catch (persistErr) {
            console.warn("Error persisting refunded status after successful createRefund:", persistErr);
          }
        }
      } else if (stripeFailedOnConfirm) {
        state.return_status = "returned";
        state.refund_status = "stripe_fail";
        state.display_status = "Returned - CC Issue";
        Alert.alert(
          "Stripe Fail",
          stripeRefund?.message ||
            (stripeRefund?.skipped ? "Stripe refund was skipped. Marked as Stripe Fail for later debugging." : "Stripe refund failed. Marked as Stripe Fail for later debugging."),
        );
        // Persist canonical statuses so personal/business account-screen reloads match local chips.
        const alreadyPersisted =
          String(payload.refund_status || payload.transaction_refund_status || "")
            .trim()
            .toLowerCase() === "stripe_fail";
        if (!alreadyPersisted) {
          try {
            await persistStripeFailRefundStatusToBackend({
              transactionUid: saleUid,
              sellerId,
              orderUid: saleUid,
              returnTransactionUid: payload.return_transaction_uid || payload.transaction_uid,
              state,
              stripeRefund,
            });
          } catch (persistErr) {
            console.warn("Error persisting stripe_fail refund status:", persistErr);
          }
        }
      }
      // Scope status to this return request / reverse txn — never write order_uid when trr is known,
      // or sibling concurrent returns will all show Refunded.
      const returnTxnUid = String(payload.return_transaction_uid || "").trim();
      const responseTrrUids = normalizeTrrUidList(payload.trr_uids, payload.trr_uid, batchTrrUids, resolvedTrr);
      const statusKeys = (responseTrrUids.length ? [...responseTrrUids, returnTxnUid] : [saleUid, transactionUid, orderUidForStatus, returnTxnUid]).map((k) => String(k || "").trim()).filter(Boolean);
      await persistReturnRefundState(statusKeys, state, {
        scopeTrrUid: responseTrrUids[0] || resolvedTrr || null,
        scopeReturnTxnUid: returnTxnUid || null,
        clearOrderUids: responseTrrUids.length || resolvedTrr ? [saleUid, orderUidForStatus, transactionUid] : [],
      });
      // Patch list row money/status from confirm response when present (avoid waiting only on AsyncStorage).
      setBusinessSellerTransactionList((prev) =>
        (prev || []).map((row) => {
          if (
            !rowMatchesReturnStatusKeys(row, statusKeys, {
              scopeTrrUid: responseTrrUids[0] || resolvedTrr || null,
              scopeReturnTxnUid: returnTxnUid || null,
            })
          ) {
            return row;
          }
          return {
            ...applyReturnRefundFieldsToRow(row, state),
            ...(payload.pending_return != null ? { pending_return: payload.pending_return } : {}),
            ...(payload.order_bounty_paid != null ? { order_bounty_paid: payload.order_bounty_paid } : {}),
            ...(payload.refund_breakdown != null ? { refund_breakdown: payload.refund_breakdown } : {}),
            ...(stripeRefund ? { stripe_refund: stripeRefund } : {}),
          };
        }),
      );
      setShowReturnNoteViewModal(false);
      return {
        ok: true,
        state,
        result: payload,
        stripe_refund: payload.stripe_refund,
        return_transaction_uid: payload.return_transaction_uid,
        refund_breakdown: payload.refund_breakdown,
        pending_return: payload.pending_return,
      };
    } catch (error) {
      console.error(`Error on return ${action}:`, error);
      Alert.alert("Error", action === "confirm" ? "Failed to confirm return receipt." : "Failed to reject return.");
      return { ok: false };
    }
  };

  const handleReturnAccept = async (transactionUid, orderUidForStatus, sellerNote = "Item received", stripeRefundResult = null, trrUid = null, trrUids = null, restockItems = null) => {
    return handleSellerReturnConfirmAction({
      transactionUid,
      orderUidForStatus,
      trrUid,
      trrUids,
      action: "confirm",
      sellerNote,
      stripeRefundResult,
      restockItems,
    });
  };

  /**
   * Prompt for seller note, call IO-Payments createRefund (business_code from note), then confirm on EC backend.
   */
  const openConfirmReceiptNoteModal = ({ transactionUid, orderUid, trrUid = null, trrUids = null, orderDetail = null, listIdx = null, restockItems = null, receivedSplit = null }) => {
    const detail = orderDetail || returnDetailModal.orderDetail || null;
    const resolvedTrrUids = normalizeTrrUidList(trrUids, trrUid, returnDetailModal.trrUids, returnDetailModal.trrUid, returnDetailModal.sourceReturnRow);
    setPendingConfirmReceipt({
      transactionUid,
      orderUid,
      trrUid: trrUid || resolvedTrrUids[0] || null,
      trrUids: resolvedTrrUids,
      orderDetail: detail,
      listIdx,
      restockItems: Array.isArray(restockItems) ? restockItems : [],
      receivedSplit: Array.isArray(receivedSplit) ? receivedSplit : [],
    });
    setConfirmReceiptNote("");
    // Close Return Details / legacy return-note view first so Confirm Receipt is interactive.
    setShowReturnNoteViewModal(false);
    setReturnDetailModal((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    setShowConfirmReceiptNoteModal(true);
  };

  const submitConfirmReceiptWithNote = async () => {
    const pending = pendingConfirmReceipt;
    if (!pending?.transactionUid && !pending?.orderUid) {
      setShowConfirmReceiptNoteModal(false);
      return;
    }
    const sellerNote = String(confirmReceiptNote || "").trim() || "Item received";
    const businessCode = resolveRefundBusinessCode(sellerNote);
    const orderDetail = pending.orderDetail || returnDetailModal.orderDetail;
    const sale = orderDetail?.sale || orderDetail || {};
    const paymentIntent = String(sale.transaction_stripe_pi || "").split("_secret_")[0];
    const buyerUid = String(sale.transaction_profile_id || "").trim();
    const trrUids = normalizeTrrUidList(pending.trrUids, pending.trrUid, returnDetailModal.trrUids, returnDetailModal.trrUid, returnDetailModal.sourceReturnRow);
    const returnScope = {
      trrUid: pending.trrUid || returnDetailModal.trrUid || trrUids[0] || null,
      trrUids,
      returnTxnUid: returnDetailModal.returnTxnUid || null,
      sourceReturnRow: returnDetailModal.sourceReturnRow || null,
    };
    const scoped = resolveScopedReturnDetail(orderDetail, returnScope);
    const confirmBountyRows = resolveAccountBountyRowsForReturn(returnDetailModal.isSellerView, selectedAccount, bountyData, businessBountyData);
    const confirmTxnUid = String(sale?.transaction_uid || pending.transactionUid || pending.orderUid || "").trim();
    const confirmBountyPool = resolveReturnDetailBountyPool(sale, confirmBountyRows, confirmTxnUid, {
      bountyPaidFallback: returnDetailModal.bountyPaidFallback,
      sourceReturnRow: returnDetailModal.sourceReturnRow || null,
    });
    const returnItems = buildReturnDetailDisplayItems(orderDetail, confirmBountyRows, returnScope, confirmBountyPool);
    const reverse = buildReverseTransactionFromReturnItems(returnItems, sale, {
      refundBreakdown: orderDetail?.refund_breakdown || null,
      returns: scoped.hasScope ? scoped.matchedReturns : Array.isArray(orderDetail?.returns) ? orderDetail.returns : [],
      pendingReturn: scoped.hasScope ? scoped.scopedPending || returnDetailModal.sourceReturnRow?.pending_return || null : sale?.pending_return || orderDetail?.pending_return || null,
      saleBountyPool: confirmBountyPool,
      refundTotalFallback: returnDetailModal.refundTotalFallback,
    });
    const refundAmount = Math.abs(Number(reverse?.total) || 0);
    const refundTax = Math.abs(Number(reverse?.taxes) || 0);
    const pendingEstimated =
      (scoped.hasScope ? scoped.scopedPending?.estimated_refund : null) || sale?.pending_return?.estimated_refund || orderDetail?.pending_return?.estimated_refund || reverse?.estimated_refund || null;
    const { walletRefund, stripeRefund } = splitReturnRefundByPaymentMethod(sale, refundAmount, pendingEstimated);
    const saleUid = String(pending.orderUid || pending.transactionUid || "").trim();
    const trrUid = String(pending.trrUid || returnDetailModal.trrUid || trrUids[0] || "").trim();

    setReturnDetailAccepting(true);
    setShowConfirmReceiptNoteModal(false);
    let stripeRefundResult = null;
    let confirmSucceeded = false;
    try {
      // Only refund the card portion to Stripe. Wallet-paid amounts are restored
      // to the buyer's useable balance by the backend confirm/ledger path.
      if (paymentIntent && stripeRefund > 0 && buyerUid) {
        const stripeTaxShare = refundAmount > 0 ? Math.round(refundTax * (stripeRefund / refundAmount) * 100) / 100 : 0;
        stripeRefundResult = await createStripeRefund({
          customerUid: buyerUid,
          businessCode,
          paymentIntent,
          refundAmount: stripeRefund,
          tax: stripeTaxShare,
          metadata: {
            order_uid: saleUid,
            transaction_uid: saleUid,
            ...(trrUid ? { trr_uid: trrUid } : {}),
            ...(trrUids.length > 1 ? { trr_uids: trrUids.join(",") } : {}),
            seller_note: sellerNote,
            wallet_refund: walletRefund,
            stripe_refund: stripeRefund,
          },
        });
      } else {
        stripeRefundResult = {
          ok: true,
          skipped: true,
          refund_id: null,
          message:
            stripeRefund <= 0
              ? "No card portion to refund (wallet covered refund)"
              : !paymentIntent
                ? "No Stripe payment intent on sale"
                : !buyerUid
                  ? "Missing buyer customer_uid"
                  : "Refund amount too small",
        };
      }

      const outcome = await handleReturnAccept(saleUid, saleUid, sellerNote, stripeRefundResult, trrUid || null, trrUids, pending.restockItems || null);
      if (outcome?.ok) {
        confirmSucceeded = true;
        const restockItems = Array.isArray(pending.restockItems) ? pending.restockItems.filter((item) => (parseInt(item.quantity, 10) || 0) > 0) : [];
        if (restockItems.length) {
          const sellerId = resolveSellerIdForReturn(saleUid);
          const { business: businessRestockItems, offering: offeringRestockItems } = partitionRestockItems(restockItems);
          const backendRestocked = Boolean(outcome.result?.restock_applied || outcome.result?.inventory_restocked);
          const restockCtx = { sellerId, trrUid, orderUid: saleUid };
          let businessRestockFailed = false;
          let offeringRestockFailed = false;

          if (!backendRestocked && businessRestockItems.length) {
            const restockOutcome = await restockReturnedItems(businessRestockItems, restockCtx);
            if (restockOutcome.ok) {
              applyLocalInventoryRestock(setBusinessServices, restockOutcome.results);
            } else if (restockOutcome.partial) {
              applyLocalInventoryRestock(setBusinessServices, restockOutcome.results);
              businessRestockFailed = true;
            } else {
              businessRestockFailed = true;
            }
          }

          if (offeringRestockItems.length) {
            const offeringOutcome = await restockReturnedOfferingItems(offeringRestockItems, restockCtx);
            if (offeringOutcome.ok) {
              applyLocalOfferingRestock(setExpertiseData, setExpertiseCatalog, offeringOutcome.results, expertiseRestockOverridesRef, expertiseCatalogRef);
            } else if (offeringOutcome.partial) {
              applyLocalOfferingRestock(setExpertiseData, setExpertiseCatalog, offeringOutcome.results, expertiseRestockOverridesRef, expertiseCatalogRef);
              offeringRestockFailed = true;
            } else {
              offeringRestockFailed = true;
            }
          }

          if (businessRestockFailed || offeringRestockFailed) {
            Alert.alert(
              "Inventory",
              businessRestockFailed && offeringRestockFailed
                ? "Return confirmed, but some product and offering units could not be restocked. Update inventory manually if needed."
                : businessRestockFailed
                  ? "Return confirmed, but some product units could not be restocked. Update Product Inventory manually if needed."
                  : "Return confirmed, but some offering units could not be restocked. Update offering quantity on your profile if needed.",
            );
          }
        }
        if (pending.listIdx != null) {
          const statusIds = trrUids.length ? trrUids : trrUid ? [trrUid] : [];
          setReturnStatuses((prev) => {
            const next = { ...prev };
            if (statusIds.length) {
              statusIds.forEach((id) => {
                next[id] = outcome.state;
                next[`${id}_${pending.listIdx}`] = outcome.state;
              });
              if (next[saleUid]) delete next[saleUid];
            } else {
              next[saleUid] = outcome.state;
              next[`${saleUid}_${pending.listIdx}`] = outcome.state;
            }
            return next;
          });
          for (const id of statusIds.length ? statusIds : [saleUid]) {
            const perKey = `${id}_${pending.listIdx}`;
            await AsyncStorage.setItem(`return_status_${perKey}`, JSON.stringify(outcome.state));
          }
          if (statusIds.length) {
            try {
              await AsyncStorage.removeItem(`return_status_${saleUid}`);
            } catch (_) {
              /* ignore */
            }
          }
        }
        setReturnConfirmResult(outcome.result || outcome);
        setReturnDetailModal((prev) =>
          prev.visible
            ? {
                ...prev,
                orderDetail: prev.orderDetail
                  ? {
                      ...prev.orderDetail,
                      sale: prev.orderDetail.sale ? applyReturnRefundFieldsToRow(prev.orderDetail.sale, outcome.state) : prev.orderDetail.sale,
                      return_status: outcome.state?.return_status,
                      refund_status: outcome.state?.refund_status,
                      display_status: outcome.state?.display_status,
                      stripe_refund: outcome.stripe_refund || stripeRefundResult,
                    }
                  : prev.orderDetail,
              }
            : prev,
        );
        try {
          const sellerId = String(returnDetailModal.sellerId || "").trim();
          const ctx = sellerId
            ? buildSellerOrderDetailFetchContext(sellerId, selectedAccount)
            : selectedAccount !== "personal"
              ? buildSellerOrderDetailFetchContext(selectedAccount || primaryBusinessUid, selectedAccount)
              : {};
          if (pending.orderUid || saleUid) {
            const refreshed = await fetchOrderDetailApi(pending.orderUid || saleUid, ctx);
            setReturnDetailModal((prev) => (prev.visible ? { ...prev, orderDetail: refreshed } : prev));
          }
        } catch (_) {
          /* keep local status update */
        }
        if (selectedAccountRef.current && selectedAccountRef.current !== "personal") {
          try {
            await refreshAccountScreenBusiness();
          } catch (refreshErr) {
            console.warn("Error refreshing business account after return confirm:", refreshErr);
          }
        } else if (confirmSucceeded) {
          try {
            await refreshAccountScreenPersonal();
          } catch (refreshErr) {
            console.warn("Error refreshing personal account after return confirm:", refreshErr);
          }
        }
      }
    } finally {
      setReturnDetailAccepting(false);
      setPendingConfirmReceipt(null);
      setConfirmReceiptNote("");
    }
  };

  const handleReturnDecline = async (transactionUid, note = "", orderUidForStatus, trrUid = null, trrUids = null) => {
    return handleSellerReturnConfirmAction({
      transactionUid,
      orderUidForStatus,
      trrUid,
      trrUids,
      action: "decline",
      sellerNote: note,
    });
  };

  const loadReturnRequests = async () => {
    // Load persistent receipt choices saved at checkout time
    try {
      const stored = await AsyncStorage.getItem("receipt_choices_by_bs_uid");
      const persistedChoices = stored ? JSON.parse(stored) : {};

      // Also scan active carts as fallback (items not yet checked out)
      const keys = await AsyncStorage.getAllKeys();
      const cartKeys = keys.filter((k) => k.startsWith("cart_"));
      const allCartRaw = await AsyncStorage.multiGet(cartKeys);
      const cartEnrichMap = {};
      allCartRaw.forEach(([, val]) => {
        if (!val) return;
        try {
          const parsed = JSON.parse(val);
          (parsed.items || []).forEach((cartItem) => {
            const enrichment = cartChoiceEnrichmentFromItem(cartItem);
            if (enrichment) {
              cartEnrichMap[cartItem.bs_uid] = enrichment;
            }
          });
        } catch {}
      });

      // Merge: persisted checkout data takes priority over active cart
      const mergedReceiptEnrichments = { ...cartEnrichMap, ...persistedChoices };
      setReceiptEnrichedItems(mergedReceiptEnrichments);
      console.log(
        "[AccountScreen] loadReturnRequests — receipt enrichments (checkout choices + active cart):",
        JSON.stringify(
          {
            persistedChoiceKeys: Object.keys(persistedChoices),
            activeCartKeys: Object.keys(cartEnrichMap),
            mergedCount: Object.keys(mergedReceiptEnrichments).length,
            merged: mergedReceiptEnrichments,
          },
          null,
          2,
        ),
      );
    } catch {}

    // Also load actual return requests
    try {
      const keys = await AsyncStorage.getAllKeys();
      const returnKeys = keys.filter((k) => k.startsWith("return_request_"));
      const loaded = {};
      for (const key of returnKeys) {
        const uid = key.replace("return_request_", "");
        const val = await AsyncStorage.getItem(key);
        if (val) loaded[uid] = JSON.parse(val);
      }
      setReturnRequests(loaded);
      console.log(
        "[AccountScreen] loadReturnRequests — buyer return requests (return_request_*):",
        JSON.stringify(
          {
            count: Object.keys(loaded).length,
            keys: Object.keys(loaded),
            data: loaded,
          },
          null,
          2,
        ),
      );
    } catch (e) {
      console.error("Failed to load return requests:", e);
    }
  };

  const loadReturnStatuses = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const statusKeys = keys.filter((k) => k.startsWith("return_status_"));
      const loaded = {};
      for (const key of statusKeys) {
        const uid = key.replace("return_status_", "");
        const val = await AsyncStorage.getItem(key);
        if (!val) {
          loaded[uid] = "";
          continue;
        }
        try {
          const parsed = JSON.parse(val);
          loaded[uid] = parsed && typeof parsed === "object" ? parsed : val;
        } catch (_) {
          loaded[uid] = val;
        }
      }
      setReturnStatuses(loaded);
      console.log(
        "[AccountScreen] loadReturnStatuses — cached return/refund chips (return_status_*):",
        JSON.stringify(
          {
            count: Object.keys(loaded).length,
            keys: Object.keys(loaded),
            data: loaded,
          },
          null,
          2,
        ),
      );
    } catch (e) {
      console.error("Failed to load return statuses:", e);
    }
  };

  const fetchPersonalProfileData = async () => {
    try {
      const session = await getSessionProfile();
      const profileId = session?.profileUid || (await AsyncStorage.getItem("profile_uid"));
      if (!profileId) return;
      const result = session?.rawProfile;
      if (result && result.personal_info) {
        setPersonalProfileData({
          firstName: result.personal_info.profile_personal_first_name || "",
          lastName: result.personal_info.profile_personal_last_name || "",
          email: result.user_email || "",
          phoneNumber: result.personal_info.profile_personal_phone_number || "",
          tagLine: result.personal_info.profile_personal_tag_line || "",
          city: result.personal_info.profile_personal_city || "",
          state: result.personal_info.profile_personal_state || "",
          profileImage: result.personal_info.profile_personal_image || "",
          emailIsPublic: result.personal_info.profile_personal_email_is_public === 1,
          phoneIsPublic: result.personal_info.profile_personal_phone_number_is_public === 1,
          tagLineIsPublic: result.personal_info.profile_personal_tag_line_is_public === 1,
          locationIsPublic: result.personal_info.profile_personal_location_is_public === 1,
          imageIsPublic: result.personal_info.profile_personal_image_is_public === 1,
        });
      }
    } catch (error) {
      console.error("Error fetching personal profile data:", error);
    }
  };

  /** GET /api/v1/account-screen/personal/:profile_id — maps to purchases, bounties, sales (expertise qty). One in-flight request; no GET /transactions fallbacks. */
  const refreshAccountScreenPersonal = async () => {
    if (refreshPersonalInFlightRef.current) {
      return refreshPersonalInFlightRef.current;
    }
    const fetchGen = personalFetchGenRef.current;
    const task = (async () => {
      try {
        setTransactionData([]);
        setExpertiseData([]);
        setExpertiseCatalog([]);
        setSellerTxData([]);
        setTransactionLoading(true);
        setBountyLoading(true);
        setExpertiseLoading(true);
        const rawProfileId = await AsyncStorage.getItem("profile_uid");
        const profileId = rawProfileId ? String(rawProfileId).trim() : "";
        if (!profileId) {
          console.log("No profile ID found, skipping account-screen personal fetch");
          if (fetchGen !== personalFetchGenRef.current || selectedAccountRef.current !== "personal") return;
          setTransactionData([]);
          setBountyData(null);
          setPersonalWallet(null);
          setExpertiseData([]);
          setExpertiseCatalog([]);
          expertiseRestockOverridesRef.current = {};
          return;
        }
        const url = withTimeZoneQuery(`${ACCOUNT_SCREEN_PERSONAL_ENDPOINT}/${profileId}`);
        const response = await fetch(url, {
          method: "GET",
        });
        if (fetchGen !== personalFetchGenRef.current || selectedAccountRef.current !== "personal") return;
        if (response.status === 400) {
          // Aggregate unavailable: show empty purchases/bounties; expertise from cached profile + no seller lines.
          setTransactionData([]);
          setBountyData({ data: [] });
          const session = await getSessionProfile();
          const profileResult = session?.rawProfile;
          const expertiseList = profileResult?.expertise_info ? parseExpertiseInfo(profileResult.expertise_info) : [];
          const mergedExpertiseList = mergeExpertiseListWithRestockOverrides(expertiseList, expertiseRestockOverridesRef.current);
          setExpertiseCatalog(mergedExpertiseList);
          setExpertiseData(buildExpertiseRows(mergedExpertiseList, []));
          await fetchPersonalProfileData();
          return;
        }
        if (!response.ok) {
          throw new Error(`account-screen personal HTTP ${response.status}`);
        }
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("account-screen personal returned non-JSON");
        }
        const json = await response.json();
        if (fetchGen !== personalFetchGenRef.current || selectedAccountRef.current !== "personal") return;
        if (!accountScreenResponseMatches(json, "personal", profileId)) return;
        let debugPurchases = false;
        if (SHOW_NETWORK_DEBUG_UI !== 0) {
          try {
            const nd = await AsyncStorage.getItem(SETTINGS_NETWORK_DEBUG_MODE_KEY);
            debugPurchases = nd !== null && JSON.parse(nd) === true;
          } catch (_) {}
        }
        const mapped = mapAccountScreenPersonalResponse(json, { debug: debugPurchases });

        const purchaseRows = Array.isArray(mapped.transactions) ? mapped.transactions : [];
        let normalizedPurchases = purchaseRows.map(normalizeListRowReturnRefundFields);
        const bountyLines = Array.isArray(mapped.bounty?.data) ? mapped.bounty.data : [];
        normalizedPurchases = enrichPurchasesFromBountyResults(normalizedPurchases, bountyLines);

        const listHydrationByOrderUid = extractOrderListHydrationMap(json);
        const hydrationOutcome = hydratePersonalPurchasesFromListMap(normalizedPurchases, listHydrationByOrderUid, {
          debugHydration: debugPurchases,
        });
        const patchSetters = { setReturnStatuses, setOrderShippingProgressByKey };
        if (hydrationOutcome?.folded) {
          normalizedPurchases = await applyPersonalPurchaseHydrationPatches(normalizedPurchases, hydrationOutcome.folded, patchSetters);
        }
        logAccountScreenHydrationGaps({
          screenContext: "personal / purchases",
          rows: normalizedPurchases,
          listHydrationByOrderUid,
          auditRowGaps: auditPurchaseRowAccountScreenGaps,
          auditOptions: {
            shippingProgressByKey: hydrationOutcome?.folded?.hydratedShipping || {},
          },
        });

        if (fetchGen !== personalFetchGenRef.current || selectedAccountRef.current !== "personal") return;
        setTransactionData(normalizedPurchases);

        if (mapped.bounty) {
          setBountyData(mapped.bounty);
        } else {
          setBountyData({ data: [] });
        }
        setPersonalWallet(mapped.wallet ?? null);

        if (mapped.profile?.personal_info) {
          const result = mapped.profile;
          setPersonalProfileData({
            firstName: result.personal_info.profile_personal_first_name || "",
            lastName: result.personal_info.profile_personal_last_name || "",
            email: result.user_email || "",
            phoneNumber: result.personal_info.profile_personal_phone_number || "",
            tagLine: result.personal_info.profile_personal_tag_line || "",
            city: result.personal_info.profile_personal_city || "",
            state: result.personal_info.profile_personal_state || "",
            profileImage: result.personal_info.profile_personal_image || "",
            emailIsPublic: result.personal_info.profile_personal_email_is_public === 1,
            phoneIsPublic: result.personal_info.profile_personal_phone_number_is_public === 1,
            tagLineIsPublic: result.personal_info.profile_personal_tag_line_is_public === 1,
            locationIsPublic: result.personal_info.profile_personal_location_is_public === 1,
            imageIsPublic: result.personal_info.profile_personal_image_is_public === 1,
          });
        } else {
          await fetchPersonalProfileData();
        }

        let sellerTx = (Array.isArray(mapped.sellerTransactions) ? mapped.sellerTransactions : []).map(normalizeListRowReturnRefundFields);
        const sellerHydrationOutcome = hydrateBusinessSellerFromListMap(sellerTx, listHydrationByOrderUid, {
          debugHydration: debugPurchases,
        });
        if (sellerHydrationOutcome?.folded) {
          const { hydratedShipping } = sellerHydrationOutcome.folded;
          if (Object.keys(hydratedShipping).length) {
            setOrderShippingProgressByKey((prev) => ({ ...prev, ...hydratedShipping }));
          }
          sellerTx = applyBusinessSellerHydrationPatches(sellerTx, sellerHydrationOutcome.folded);
        }
        logAccountScreenHydrationGaps({
          screenContext: "personal / SALES table (expertise list)",
          rows: sellerTx,
          listHydrationByOrderUid,
          auditRowGaps: (row, opts) => auditPersonalExpertiseLoadGaps(row, sellerTx, {}, opts.shippingProgressByKey || {}),
          auditOptions: {
            shippingProgressByKey: sellerHydrationOutcome?.folded?.hydratedShipping || {},
          },
        });

        const session = await getSessionProfile();
        const profileResult = session?.rawProfile;
        let expertiseList = [];
        if (mapped.profile?.expertise_info != null) {
          expertiseList = parseExpertiseInfo(mapped.profile.expertise_info);
        } else if (profileResult?.expertise_info) {
          expertiseList = parseExpertiseInfo(profileResult.expertise_info);
        }
        if (fetchGen !== personalFetchGenRef.current || selectedAccountRef.current !== "personal") return;
        const mergedExpertiseList = mergeExpertiseListWithRestockOverrides(expertiseList, expertiseRestockOverridesRef.current);
        setSellerTxData(sellerTx);
        setExpertiseCatalog(mergedExpertiseList);
        setExpertiseData(buildExpertiseRows(mergedExpertiseList, sellerTx));
      } catch (error) {
        if (fetchGen !== personalFetchGenRef.current || selectedAccountRef.current !== "personal") return;
        console.error("Error loading account-screen personal:", error);
        setTransactionData([]);
        setBountyData({ error: error.message });
        setPersonalWallet(null);
        setExpertiseData([]);
        setExpertiseCatalog([]);
      } finally {
        if (fetchGen !== personalFetchGenRef.current || selectedAccountRef.current !== "personal") return;
        setTransactionLoading(false);
        setBountyLoading(false);
        setExpertiseLoading(false);
      }
    })();
    refreshPersonalInFlightRef.current = task;
    task.finally(() => {
      if (refreshPersonalInFlightRef.current === task) {
        refreshPersonalInFlightRef.current = null;
      }
    });
    return task;
  };

  /** GET /api/v1/wallet_ledger/:profile_id — bounty credits, sale proceeds, wallet payments/refunds. */
  const refreshWalletLedger = async () => {
    if (refreshWalletLedgerInFlightRef.current) {
      return refreshWalletLedgerInFlightRef.current;
    }
    const fetchGen = personalFetchGenRef.current;
    const task = (async () => {
      try {
        setWalletLedgerLoading(true);
        setWalletLedgerError(null);
        const rawProfileId = await AsyncStorage.getItem("profile_uid");
        const profileId = rawProfileId ? String(rawProfileId).trim() : "";
        if (!profileId) {
          if (fetchGen !== personalFetchGenRef.current || selectedAccountRef.current !== "personal") return [];
          setWalletLedgerRows([]);
          setWalletLedgerTotalEntries(0);
          return [];
        }
        const url = withTimeZoneQuery(`${WALLET_LEDGER_ENDPOINT}/${profileId}`);
        const response = await fetch(url, { method: "GET" });
        if (fetchGen !== personalFetchGenRef.current || selectedAccountRef.current !== "personal") return [];
        if (!response.ok) {
          throw new Error(`wallet ledger HTTP ${response.status}`);
        }
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("wallet ledger returned non-JSON");
        }
        const json = await response.json();
        if (fetchGen !== personalFetchGenRef.current || selectedAccountRef.current !== "personal") return [];
        const rows = Array.isArray(json.data) ? json.data : [];
        setWalletLedgerRows(rows);
        setWalletLedgerTotalEntries(Number(json.total_entries) || rows.length);
        const ledgerWallet = json?.wallet && typeof json.wallet === "object" && !Array.isArray(json.wallet) ? json.wallet : null;
        if (ledgerWallet) setPersonalWallet(ledgerWallet);
        return rows;
      } catch (error) {
        if (fetchGen !== personalFetchGenRef.current || selectedAccountRef.current !== "personal") return [];
        console.warn("[AccountScreen] wallet ledger fetch failed:", error?.message || error);
        setWalletLedgerError(error?.message || "Unable to load wallet ledger.");
        setWalletLedgerRows([]);
        setWalletLedgerTotalEntries(0);
        return [];
      } finally {
        if (fetchGen === personalFetchGenRef.current && selectedAccountRef.current === "personal") {
          setWalletLedgerLoading(false);
        }
      }
    })();
    refreshWalletLedgerInFlightRef.current = task;
    task.finally(() => {
      if (refreshWalletLedgerInFlightRef.current === task) {
        refreshWalletLedgerInFlightRef.current = null;
      }
    });
    return task;
  };

  const resetDeliveryVerificationModal = () => {
    setShowReceiveItemModal(false);
    setPendingTransactionForConfirm(null);
    setDeliveryVerificationReceiptData([]);
    setSelectedReceivedItems([]);
    setReceivedItemQuantities({});
    setDeliveryVerificationLoading(false);
  };

  const openDeliveryVerification = async (transaction) => {
    setPendingTransactionForConfirm(transaction);
    setDeliveryVerificationReceiptData([]);
    setSelectedReceivedItems([]);
    setReceivedItemQuantities({});
    setShowReceiveItemModal(true);
    setDeliveryVerificationLoading(true);
    try {
      const items = await fetchReceiptLinesForTransaction(transaction);
      let enriched = items;
      try {
        const orderUid = resolveListRowOrderUid(transaction);
        const profileId = transaction.transaction_profile_id || (await AsyncStorage.getItem("profile_uid"));
        if (orderUid && orderUid !== "—") {
          const orderDetail = await fetchOrderDetailApi(orderUid, { profileId });
          enriched = enrichReceiptLinesWithOrderFulfillment(items, orderDetail);
        }
      } catch (enrichErr) {
        console.warn("Delivery verification fulfillment enrich failed:", enrichErr);
      }
      setDeliveryVerificationReceiptData(enriched);
    } catch (error) {
      console.error("Error loading delivery verification items:", error);
      Alert.alert("Error", error.message || "Failed to load order items.");
      resetDeliveryVerificationModal();
    } finally {
      setDeliveryVerificationLoading(false);
    }
  };

  const updateTransactionEscrow = async (transactionUid, deliveryVerificationItems, releaseEscrow) => {
    const profileId = pendingTransactionForConfirm?.transaction_profile_id || (await getSessionProfile())?.profileUid || (await AsyncStorage.getItem("profile_uid"));
    if (!profileId) {
      Alert.alert("Error", "Cannot confirm delivery: missing profile.");
      return;
    }
    const requestBody = {
      profile_id: profileId,
      transaction_uid: transactionUid,
      transaction_in_escrow: releaseEscrow ? 0 : 1,
      delivery_verification_items: deliveryVerificationItems,
    };
    try {
      setUpdatingEscrow(true);
      const response = await fetch(TRANSACTIONS_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        const detail = await formatFetchErrorAlertMessage(response, ["Failed to confirm delivery.", `Request:\n${JSON.stringify(requestBody, null, 2)}`]);
        console.error("Error updating transaction escrow:", detail);
        Alert.alert("Could not confirm delivery", detail);
        return;
      }
      resetDeliveryVerificationModal();
      await Promise.all([refreshAccountScreenPersonal(), refreshWalletLedger()]);
      if (!releaseEscrow) {
        Alert.alert("Partial delivery recorded", "Receipt confirmation saved. Earnings may remain pending until all items are verified and any return window ends.");
      } else {
        Alert.alert("Delivery confirmed", "Receipt confirmed. Bounty and seller proceeds may stay pending until any return window ends before they become available to spend.");
      }
    } catch (error) {
      console.error("Error updating transaction escrow:", error);
      const detail = ["Failed to confirm delivery.", error?.message ? String(error.message) : "Please try again.", `Request:\n${JSON.stringify(requestBody, null, 2)}`].filter(Boolean).join("\n\n");
      Alert.alert("Could not confirm delivery", detail);
    } finally {
      setUpdatingEscrow(false);
    }
  };

  const fetchTransactionServices = async (transactionUid) => {
    try {
      // Check if we already have this data cached
      if (transactionServices[transactionUid]) {
        return transactionServices[transactionUid];
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/business_services/transaction/${transactionUid}`, {
        method: "GET",
      });

      if (response.ok) {
        const result = await response.json();
        if (result && result.code === 200 && Array.isArray(result.data)) {
          // Cache the data
          setTransactionServices((prev) => ({
            ...prev,
            [transactionUid]: result.data,
          }));
          return result.data;
        }
      }
      return [];
    } catch (error) {
      console.error("Error fetching transaction services:", error);
      return [];
    }
  };

  /** Loads receipt line items for one business transaction (seller_id = current business). Call only when user expands a row or opens return details. */
  const prefetchBusinessReceiptForTransaction = useCallback(
    async (txn) => {
      const uid = txn?.transaction_uid;
      const biz = selectedAccount !== "personal" ? selectedAccount : primaryBusinessUid;
      if (!uid || !biz || !txn?.transaction_profile_id) return;
      if (businessReceiptFetchedRef.current.has(uid)) return;
      businessReceiptFetchedRef.current.add(uid);
      try {
        const r = await fetch(buildTransactionReceiptUrl(txn, txn.transaction_profile_id, { sellerId: biz }), {
          method: "GET",
        });
        let items = [];
        if (r.ok) {
          const data = await r.json();
          items = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        }
        setBusinessReceiptCache((prev) => ({ ...prev, [uid]: items }));
      } catch {
        businessReceiptFetchedRef.current.delete(uid);
        setBusinessReceiptCache((prev) => ({ ...prev, [uid]: [] }));
      }
    },
    [selectedAccount, primaryBusinessUid],
  );

  const openProductSalesModal = useCallback((product) => {
    if (!product) return;
    setProductSalesModal({
      visible: true,
      product,
      sales: product.sales || [],
      receiptByTxn: {},
      loading: false,
    });
  }, []);

  const openOfferingSalesHistory = useCallback(
    async (item) => {
      if (!item) return;
      const expertiseUid = String(item.expertiseUid || "").trim();
      const transactions = sellerTxData.filter((tx) => String(tx.ti_bs_id || "").trim() === expertiseUid);
      setSalesModal({ visible: true, item, transactions, loading: true });

      try {
        const profileId = String((await AsyncStorage.getItem("profile_uid")) || "").trim();
        const orderUidsToHydrate = collectOrderUidsNeedingSellerOrderDetailHydration(transactions);
        let nextSellerTx = sellerTxData;
        if (profileId && orderUidsToHydrate.length) {
          nextSellerTx = await hydrateSellerRowsReceivedFromOrderDetails(sellerTxData, orderUidsToHydrate, buildSellerOrderDetailFetchContext(profileId, selectedAccount));
          if (nextSellerTx !== sellerTxData) {
            setSellerTxData(nextSellerTx);
          }
        }
        const enrichedTransactions = nextSellerTx.filter((tx) => String(tx.ti_bs_id || "").trim() === expertiseUid);
        setSalesModal({ visible: true, item, transactions: enrichedTransactions, loading: false });
      } catch (error) {
        console.warn("[AccountScreen] offering sales received hydration failed:", error?.message || error);
        setSalesModal({ visible: true, item, transactions, loading: false });
      }
    },
    [sellerTxData, selectedAccount],
  );

  useEffect(() => {
    const expertiseUid = String(route?.params?.offeringSalesUid || "").trim();
    if (!expertiseUid || expertiseLoading) return;

    const deepLinkKey = `${expertiseUid}:${String(route?.params?.offeringSalesToken || "")}`;
    if (salesDeepLinkKeyRef.current === deepLinkKey) return;

    const item = expertiseData.find((entry) => String(entry.expertiseUid || "").trim() === expertiseUid);
    if (!item) return;

    salesDeepLinkKeyRef.current = deepLinkKey;
    openOfferingSalesHistory(item);
  }, [route?.params?.offeringSalesUid, route?.params?.offeringSalesToken, expertiseLoading, expertiseData, openOfferingSalesHistory]);

  const openOfferingListing = useCallback(
    async (item) => {
      const expertiseUid = String(item?.expertiseUid || "").trim();
      if (!expertiseUid) return;
      const session = await getSessionProfile();
      const profileUid = String(session?.profileUid || (await AsyncStorage.getItem("profile_uid")) || "").trim();
      if (!profileUid) {
        Alert.alert("Error", "Profile not loaded. Please try again.");
        return;
      }
      navigation.navigate("Profile", {
        profile_uid: profileUid,
        returnTo: "Account",
        focusOfferingUid: expertiseUid,
        focusOfferingToken: Date.now(),
      });
    },
    [navigation],
  );

  const closeProductSalesModal = useCallback(() => {
    setProductSalesModal({
      visible: false,
      product: null,
      sales: [],
      receiptByTxn: {},
      loading: false,
    });
  }, []);

  const closeOrderDetailModal = useCallback(() => {
    setOrderDetailModal({
      visible: false,
      orderUid: null,
      orderDetail: null,
      loading: false,
      error: null,
      isSellerView: false,
      sellerId: null,
      bountyPaidFallback: 0,
      walletLedgerEntries: [],
      highlightLedgerEntryId: null,
    });
  }, []);

  const closeReturnDetailModal = useCallback(() => {
    setReturnDetailModal({
      visible: false,
      orderUid: null,
      transactionUid: null,
      trrUid: null,
      trrUids: [],
      returnTxnUid: null,
      sourceReturnRow: null,
      orderDetail: null,
      loading: false,
      error: null,
      bountyPaidFallback: 0,
      refundTotalFallback: 0,
      isSellerView: true,
      sellerId: null,
    });
    setReturnReceivedItemKeys([]);
    setReturnRestockQtyByKey({});
    setReturnDetailAccepting(false);
    setReturnDetailDeclining(false);
    setReturnConfirmResult(null);
  }, []);

  const openReturnDetails = useCallback(
    async (orderRow, options = {}) => {
      const orderUid = orderRow?.orderUid || resolveListRowOrderUid(orderRow?.rawRow || orderRow);
      if (!orderUid || orderUid === "—") return;
      const raw = orderRow?.rawRow || orderRow;
      // On pending return rows, transaction_uid is the trr_uid — keep sale uid separate.
      const saleUid = String(orderUid).trim();
      const trrUids = normalizeTrrUidList(orderRow?.trrUid, orderRow?.trrUids, raw);
      const trrUid = String(orderRow?.trrUid || resolveTrrUid(raw) || trrUids[0] || "").trim();
      const isPendingReturn = Number(raw?.is_pending_return) === 1 || raw?.is_pending_return === true;
      const candidateReturnTxn = String(orderRow?.returnTxnUid || raw?.return_transaction_uid || (!isPendingReturn && isReturnListRow(raw) ? raw?.transaction_uid : "") || "").trim();
      const returnTxnUid = candidateReturnTxn && candidateReturnTxn !== saleUid && candidateReturnTxn !== trrUid ? candidateReturnTxn : "";
      const transactionUid = String(
        orderRow?.original_transaction_uid || raw?.original_transaction_uid || (!trrUid || String(raw?.transaction_uid || "").trim() !== trrUid ? raw?.transaction_uid : null) || saleUid,
      ).trim();
      const saleSibling = (selectedAccount === "personal" ? sellerTxData : businessSellerTransactionList).find((row) => !isReturnListRow(row) && resolveListRowOrderUid(row) === saleUid) || null;
      const bountyPaidFallback = resolveSaleOrderBountyPaid(saleSibling);
      const refundTotalFallback = Math.abs(Number(orderRow?.total ?? orderRow?.transaction_total ?? raw?.transaction_total ?? 0) || 0);
      const isSellerView = options.isSellerView ?? selectedAccount !== "personal";
      let sellerId = String(options.sellerId || "").trim();
      if (isSellerView && !sellerId) {
        if (selectedAccount !== "personal") {
          sellerId = String(selectedAccount || primaryBusinessUid || "").trim();
        } else {
          sellerId = String((await AsyncStorage.getItem("profile_uid")) || "").trim();
        }
      }
      const sourceReturnRow = isReturnListRow(raw) ? raw : null;

      setReturnReceivedItemKeys([]);
      setReturnRestockQtyByKey({});
      setReturnConfirmResult(null);
      setReturnDetailModal({
        visible: true,
        orderUid: saleUid,
        transactionUid,
        trrUid: trrUid || null,
        trrUids: trrUids.length ? trrUids : trrUid ? [trrUid] : [],
        returnTxnUid: returnTxnUid || null,
        sourceReturnRow,
        orderDetail: null,
        loading: true,
        error: null,
        bountyPaidFallback,
        refundTotalFallback,
        isSellerView,
        sellerId: sellerId || null,
      });

      try {
        const ctx = {};
        if (isSellerView) {
          Object.assign(ctx, buildSellerOrderDetailFetchContext(sellerId, selectedAccount));
        } else {
          const profileId = (await AsyncStorage.getItem("profile_uid")) || "";
          if (profileId) ctx.profileId = String(profileId).trim();
        }
        const orderDetail = await fetchOrderDetailApi(saleUid, ctx);
        const saleTxnUid = String(orderDetail?.sale?.transaction_uid || transactionUid || saleUid).trim();
        setReturnDetailModal((prev) => ({
          ...prev,
          orderDetail,
          loading: false,
          error: null,
          // Prefer sale transaction_uid; never keep a pending-row trr_uid here.
          transactionUid: saleTxnUid,
          // Keep the clicked return scope — do not replace with orderDetail.pending_return (first only).
          trrUid: prev.trrUid || null,
          trrUids: Array.isArray(prev.trrUids) && prev.trrUids.length ? prev.trrUids : prev.trrUid ? [prev.trrUid] : [],
          returnTxnUid: prev.returnTxnUid || null,
          sourceReturnRow: prev.sourceReturnRow || null,
        }));

        // Keep PURCHASES chips aligned when order-detail is the authoritative Stripe-fail source.
        const sale = orderDetail?.sale || orderDetail || {};
        const detailState = extractReturnRefundState(sale, {
          returnRequested: 1,
          stripe_refund: orderDetail?.stripe_refund || sale?.stripe_refund,
        });
        if (detailState.active && detailState.refund_status === "stripe_fail") {
          const scopeTrr = String(trrUid || "").trim();
          const returnTxnUids = (Array.isArray(orderDetail?.returns) ? orderDetail.returns : []).map((ret) => String(ret?.transaction_uid || "").trim()).filter(Boolean);
          const statusKeys = (scopeTrr ? [scopeTrr, ...trrUids, ...returnTxnUids] : [saleUid, saleTxnUid, transactionUid, ...returnTxnUids]).map((k) => String(k || "").trim()).filter(Boolean);
          await persistReturnRefundState(
            statusKeys,
            {
              return_status: "returned",
              refund_status: "stripe_fail",
              display_status: detailState.display_status || "Returned - CC Issue",
            },
            {
              scopeTrrUid: scopeTrr || null,
              clearOrderUids: scopeTrr ? [saleUid, saleTxnUid, transactionUid] : [],
            },
          );
        }
      } catch (err) {
        setReturnDetailModal((prev) => ({
          ...prev,
          loading: false,
          error: err?.message || "Failed to load return details.",
        }));
      }
    },
    [selectedAccount, primaryBusinessUid, persistReturnRefundState, sellerTxData, businessSellerTransactionList],
  );

  const openOrderDetail = useCallback(
    async (orderRow, options = {}) => {
      const orderUid = orderRow?.orderUid || resolveListRowOrderUid(orderRow?.rawRow || orderRow);
      if (!orderUid || orderUid === "—") return;

      const isSellerView = options.isSellerView ?? (selectedAccount !== "personal" || (Array.isArray(options.walletLedgerEntries) && options.walletLedgerEntries.length > 0));
      let sellerId = String(options.sellerId || "").trim();
      if (isSellerView && !sellerId) {
        if (selectedAccount !== "personal") {
          sellerId = String(selectedAccount || primaryBusinessUid || "").trim();
        } else {
          sellerId = String((await AsyncStorage.getItem("profile_uid")) || "").trim();
        }
      }
      const ledgerEntries =
        Array.isArray(options.walletLedgerEntries) && options.walletLedgerEntries.length ? options.walletLedgerEntries : filterWalletLedgerEntriesForOrder(walletLedgerRows, orderUid);
      setOrderDetailModal({
        visible: true,
        orderUid,
        orderDetail: null,
        loading: true,
        error: null,
        isSellerView,
        sellerId: sellerId || null,
        bountyPaidFallback: resolveOrderDetailBountyPaidFallback(orderRow),
        walletLedgerEntries: ledgerEntries,
        highlightLedgerEntryId: options.highlightLedgerEntryId || options.ledgerEntry?.entry_id || null,
      });

      try {
        const ctx = {};
        if (isSellerView) {
          Object.assign(ctx, buildSellerOrderDetailFetchContext(sellerId, selectedAccount));
        } else {
          const profileId = (await AsyncStorage.getItem("profile_uid")) || "";
          if (profileId) ctx.profileId = String(profileId).trim();
        }
        const orderDetail = await fetchOrderDetailApi(orderUid, ctx);
        const txnUid = String(orderDetail?.sale?.transaction_uid || "").trim();
        const bountyRowsForOrder = resolveOrderDetailBountyRows(isSellerView, selectedAccount, bountyData, businessBountyData, sellerTxData, businessSellerTransactionList, txnUid);
        const bountyPaidFallback =
          resolveOrderDetailBountyPaidFallback(orderRow) ||
          resolveOrderDetailSaleBountyPaid(orderDetail?.sale, bountyRowsForOrder, txnUid, {
            orderDetail,
            sellerTransactionRows: sellerTxData,
          });
        setOrderDetailModal((prev) => ({
          ...prev,
          orderDetail,
          loading: false,
          error: null,
          bountyPaidFallback,
        }));
        const progress = getOrderShippingProgress([orderDetail?.sale || orderDetail].filter(Boolean));
        if (progress === "complete" || progress === "partial" || progress === "none") {
          const keys = [orderUid, orderDetail?.order_uid, orderDetail?.sale?.transaction_uid, orderRow?.listTransactionUid].map((k) => String(k || "").trim()).filter(Boolean);
          setOrderShippingProgressByKey((prev) => {
            const next = { ...prev };
            for (const key of keys) next[key] = progress;
            return next;
          });
        }
      } catch (error) {
        setOrderDetailModal((prev) => ({
          ...prev,
          loading: false,
          error: error?.message || "Failed to load order.",
        }));
      }
    },
    [selectedAccount, primaryBusinessUid, walletLedgerRows, bountyData, businessBountyData, sellerTxData, businessSellerTransactionList],
  );

  const saveOrderFulfillmentUpdates = useCallback(
    async (requestBody) => {
      if (!requestBody?.transaction_uid || !Array.isArray(requestBody.fulfillment_updates) || !requestBody.fulfillment_updates.length) {
        return false;
      }
      const sellerIdFromModal = String(orderDetailModal.sellerId || "").trim();
      const sellerIdFromAccount = selectedAccount && selectedAccount !== "personal" ? String(selectedAccount).trim() : primaryBusinessUid ? String(primaryBusinessUid).trim() : "";
      const sellerIdFromOrder = String(
        orderDetailModal.orderDetail?.sale?.transaction_business_id ||
          orderDetailModal.orderDetail?.sale?.business_id ||
          orderDetailModal.orderDetail?.sale?.seller_id ||
          orderDetailModal.orderDetail?.business_uid ||
          "",
      ).trim();
      const sellerId = sellerIdFromModal || sellerIdFromAccount || sellerIdFromOrder;
      if (!sellerId) {
        Alert.alert("Could not save shipment", "Missing seller id. Close the order and open it from Sales, then try again.");
        return false;
      }
      const payload = {
        ...requestBody,
        seller_id: sellerId,
      };
      try {
        const response = await fetch(TRANSACTIONS_ENDPOINT, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const detail = await formatFetchErrorAlertMessage(response, ["Failed to save shipped items.", `Request:\n${JSON.stringify(payload, null, 2)}`]);
          Alert.alert("Could not save shipment", detail);
          return false;
        }

        const orderUid = orderDetailModal.orderUid;
        const isSellerView = orderDetailModal.isSellerView;
        const transactionUid = String(payload.transaction_uid || "").trim();

        // Optimistic list update: account-screen seller rows often omit per-item fulfillment fields.
        const shippedItemUids = new Set((payload.fulfillment_updates || []).map((u) => String(u.transaction_item_uid || "").trim()).filter(Boolean));
        const priorDetail = orderDetailModal.orderDetail;
        const priorSale = priorDetail?.sale || null;
        const priorLines = Array.isArray(priorSale?.lines) ? priorSale.lines : [];
        const optimisticSale =
          priorSale && priorLines.length
            ? {
                ...priorSale,
                lines: priorLines.map((line) => {
                  const lineUid = String(line.ti_uid || line.transaction_item_uid || "").trim();
                  if (!lineUid || !shippedItemUids.has(lineUid)) return line;
                  const update = (payload.fulfillment_updates || []).find((u) => String(u.transaction_item_uid) === lineUid);
                  const purchased = getLinePurchasedQty(line) || 1;
                  const cancelled = getLineCancelledQty(line);
                  const prevShipped = getLineShippedQty(line);
                  const thisShipQty = Math.max(1, parseInt(update?.shipped_quantity, 10) || purchased - prevShipped);
                  const nextShipped = Math.min(purchased, prevShipped + thisShipQty);
                  const unshipped = Math.max(0, purchased - nextShipped);
                  const cancelledUnshipped = Math.min(cancelled, unshipped);
                  const nextRemaining = Math.max(0, unshipped - cancelledUnshipped);
                  return {
                    ...line,
                    fulfillment_status: nextRemaining <= 0 ? "in_transit" : "partial",
                    ti_fulfillment_status: nextRemaining <= 0 ? "in_transit" : "partial",
                    shipped_qty: nextShipped,
                    ti_shipped_qty: nextShipped,
                    shipped_quantity: nextShipped,
                    remaining_to_ship: nextRemaining,
                    remaining_ship_qty: nextRemaining,
                    ti_remaining_to_ship: nextRemaining,
                    tracking_carrier: update?.tracking_carrier || line.tracking_carrier,
                    tracking_number: update?.tracking_number || line.tracking_number,
                  };
                }),
              }
            : priorSale
              ? { ...priorSale, fulfillment_status: "in_transit", all_items_shipped: 1 }
              : { transaction_uid: transactionUid, fulfillment_status: "in_transit", all_items_shipped: 1 };
        const optimisticOrderDetail = priorDetail ? { ...priorDetail, sale: optimisticSale } : { order_uid: orderUid, sale: optimisticSale };
        setOrderDetailModal((prev) => ({
          ...prev,
          orderDetail: optimisticOrderDetail,
          walletLedgerEntries: patchWalletLedgerEntriesPendingShipment(prev.walletLedgerEntries, optimisticSale),
        }));
        const optimisticProgress = getOrderShippingProgress([optimisticSale]);
        const keysToUpdate = [transactionUid, orderUid, priorDetail?.order_uid, priorSale?.transaction_uid].map((k) => String(k || "").trim()).filter(Boolean);
        setOrderShippingProgressByKey((prev) => {
          const next = { ...prev };
          for (const key of keysToUpdate) next[key] = optimisticProgress;
          return next;
        });
        setBusinessSellerTransactionList((prev) =>
          (prev || []).map((row) => {
            const rowTxn = String(row.transaction_uid || "").trim();
            const rowOrder = resolveListRowOrderUid(row);
            if (rowTxn !== transactionUid && !keysToUpdate.includes(rowOrder)) return row;
            if (optimisticProgress === "complete") {
              return {
                ...row,
                fulfillment_status: "in_transit",
                all_items_shipped: 1,
                unshipped_item_count: 0,
              };
            }
            if (optimisticProgress === "partial") {
              return {
                ...row,
                fulfillment_status: "partial",
                all_items_shipped: 0,
              };
            }
            return row;
          }),
        );

        if (selectedAccount !== "personal") {
          await refreshAccountScreenBusiness();
        } else {
          await refreshAccountScreenPersonal();
        }
        let refreshedLedgerRows = null;
        if (orderUid && orderUid !== "—") {
          try {
            const ctx = {};
            if (isSellerView) {
              Object.assign(ctx, buildSellerOrderDetailFetchContext(sellerId, selectedAccount));
            } else {
              const profileId = (await AsyncStorage.getItem("profile_uid")) || "";
              if (profileId) ctx.profileId = String(profileId).trim();
            }
            const ledgerRefreshPromise = selectedAccount === "personal" || !selectedAccount ? refreshWalletLedger() : Promise.resolve(null);
            const [orderDetail, ledgerRows] = await Promise.all([fetchOrderDetailApi(orderUid, ctx), ledgerRefreshPromise]);
            refreshedLedgerRows = ledgerRows;
            const sumShippedQty = (detail) => (Array.isArray(detail?.sale?.lines) ? detail.sale.lines : []).reduce((sum, line) => sum + getLineShippedQty(line), 0);
            const detailToApply = sumShippedQty(orderDetail) >= sumShippedQty(optimisticOrderDetail) ? orderDetail : optimisticOrderDetail;
            const ledgerEntriesForOrder = Array.isArray(refreshedLedgerRows) && refreshedLedgerRows.length ? filterWalletLedgerEntriesForOrder(refreshedLedgerRows, orderUid) : null;
            setOrderDetailModal((prev) => ({
              ...prev,
              orderDetail: detailToApply,
              loading: false,
              error: null,
              ...(ledgerEntriesForOrder?.length ? { walletLedgerEntries: ledgerEntriesForOrder } : {}),
            }));
            const refreshedProgress = getOrderShippingProgress([detailToApply?.sale || detailToApply].filter(Boolean));
            const refreshKeys = [transactionUid, orderUid, detailToApply?.order_uid, detailToApply?.sale?.transaction_uid].map((k) => String(k || "").trim()).filter(Boolean);
            setOrderShippingProgressByKey((prev) => {
              const next = { ...prev };
              for (const key of refreshKeys) next[key] = refreshedProgress;
              return next;
            });
            setBusinessSellerTransactionList((prev) =>
              (prev || []).map((row) => {
                const rowTxn = String(row.transaction_uid || "").trim();
                const rowOrder = resolveListRowOrderUid(row);
                if (rowTxn !== transactionUid && !refreshKeys.includes(rowOrder)) return row;
                if (refreshedProgress === "complete") {
                  return {
                    ...row,
                    fulfillment_status: "in_transit",
                    all_items_shipped: 1,
                    unshipped_item_count: 0,
                  };
                }
                if (refreshedProgress === "partial") {
                  return {
                    ...row,
                    fulfillment_status: "partial",
                    all_items_shipped: 0,
                  };
                }
                return row;
              }),
            );
          } catch (reloadError) {
            console.warn("Could not reload order detail after fulfillment save:", reloadError);
          }
        }
        Alert.alert("Saved", "Shipped items were recorded.");
        return true;
      } catch (error) {
        console.error("Error saving fulfillment updates:", error);
        Alert.alert(
          "Could not save shipment",
          ["Failed to save shipped items.", error?.message ? String(error.message) : "Please try again.", `Request:\n${JSON.stringify(payload, null, 2)}`].filter(Boolean).join("\n\n"),
        );
        return false;
      }
    },
    [orderDetailModal.orderUid, orderDetailModal.isSellerView, orderDetailModal.orderDetail, orderDetailModal.sellerId, selectedAccount, primaryBusinessUid],
  );

  const openReturnNoteModalFromReceipt = useCallback(() => {
    setReturnModalOrderLines([]);
    setReturnModalReceiptData([]);
    setSelectedReturnItems([]);
    setReturnItemQuantities({});
    setReturnItemSplitQty({});
    setReturnSubmitLoading(false);
    setShowReceiptModal(false);
    setShowReturnNoteModal(true);
    setReturnModalLoading(true);

    const modalLines = resolveReturnModalOrderLines(receiptOrderDetail, receiptData);
    if (modalLines.length > 0) {
      setReturnModalOrderLines(modalLines);
    } else {
      Alert.alert("Error", "No receipt lines are available for return.");
      setShowReturnNoteModal(false);
    }
    setReturnModalLoading(false);
  }, [receiptTransaction, receiptOrderDetail, receiptData]);

  /**
   * GET /api/v1/account-screen/business/:business_uid — product results + seller lines for grouping/receipts.
   * @param {string} [primaryBusinessUidOverride] — optional first-business uid before session primaryBusinessUid is available in refs.
   */
  const refreshAccountScreenBusiness = async (primaryBusinessUidOverride) => {
    const fetchGen = businessFetchGenRef.current;
    const targetBusinessUID = selectedAccountRef.current !== "personal" ? selectedAccountRef.current : (primaryBusinessUidOverride ?? businessUIDRef.current);

    const shouldApplyBusinessResponse = () =>
      fetchGen === businessFetchGenRef.current && selectedAccountRef.current !== "personal" && targetBusinessUID != null && String(selectedAccountRef.current) === String(targetBusinessUID);

    try {
      setBusinessTransactionData([]);
      setBusinessBountyData(null);
      setBusinessSellerTransactionList([]);
      setBusinessServices([]);
      setBusinessTransactionLoading(true);
      setBusinessBountyLoading(true);

      if (!targetBusinessUID) {
        console.log("No business UID available");
        if (!shouldApplyBusinessResponse()) return;
        setBusinessReceiptCache({});
        businessReceiptFetchedRef.current = new Set();
        setSelectedBusinessFullData(null);
        setBusinessServices([]);
        return;
      }

      businessReceiptFetchedRef.current = new Set();
      setBusinessReceiptCache({});

      const response = await fetch(withTimeZoneQuery(`${ACCOUNT_SCREEN_BUSINESS_ENDPOINT}/${targetBusinessUID}`), {
        method: "GET",
      });

      if (!shouldApplyBusinessResponse()) return;

      if (response.status === 400) {
        setBusinessBountyData({ data: [] });
        setBusinessTransactionData([]);
        setBusinessServices([]);
        setBusinessReceiptCache({});
        businessReceiptFetchedRef.current = new Set();
        const row = businessesRef.current.find((b) => resolveBusinessUid(b) === targetBusinessUID);
        setSelectedBusinessFullData(mapSessionBusinessRowToMiniCard(row));
        return;
      }

      if (!response.ok) {
        console.error(`account-screen business HTTP ${response.status}`);
        setBusinessTransactionData([]);
        setBusinessBountyData(null);
        setBusinessServices([]);
        businessReceiptFetchedRef.current = new Set();
        const row = businessesRef.current.find((b) => resolveBusinessUid(b) === targetBusinessUID);
        setSelectedBusinessFullData(mapSessionBusinessRowToMiniCard(row));
        return;
      }

      const json = await response.json();
      if (!shouldApplyBusinessResponse()) return;
      if (!accountScreenResponseMatches(json, "business", targetBusinessUID)) return;

      const { bountyResult, sellerLines, businessForMiniCardRaw, businessServices: servicesFromPayload, offerings: offeringsFromPayload } = mapAccountScreenBusinessResponse(json);
      setBusinessServices(Array.isArray(servicesFromPayload) ? servicesFromPayload : []);
      if (Array.isArray(offeringsFromPayload) && offeringsFromPayload.length) {
        setExpertiseCatalog(offeringsFromPayload);
      }

      const selectedBusiness = businessesRef.current.find((b) => resolveBusinessUid(b) === targetBusinessUID);

      let miniForCard = businessForMiniCardRaw ? mapRawBusinessToSelectedBusinessFullData(businessForMiniCardRaw) : null;
      if (!miniForCard) miniForCard = mapSessionBusinessRowToMiniCard(selectedBusiness);
      setSelectedBusinessFullData(miniForCard);

      if (bountyResult?.data && Array.isArray(bountyResult.data)) {
        bountyResult.data.forEach((bounty) => {
          bounty.business_name = selectedBusiness?.business_name || selectedBusiness?.profile_business_name || "Unknown Business";
        });
        bountyResult.data.sort((a, b) => {
          const dateA = parseTransactionDateTime(a);
          const dateB = parseTransactionDateTime(b);
          return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
        });
        setBusinessBountyData(bountyResult);
      } else {
        setBusinessBountyData(null);
      }

      const bountyDataByTransaction = {};
      if (bountyResult?.data && Array.isArray(bountyResult.data)) {
        bountyResult.data.forEach((item) => {
          const txnId = item.transaction_uid;
          if (!bountyDataByTransaction[txnId]) {
            bountyDataByTransaction[txnId] = { total_bounty: 0, items: [] };
          }
          const bountyPaid = parseFloat(item.bounty_paid) || 0;
          bountyDataByTransaction[txnId].total_bounty += bountyPaid;
          bountyDataByTransaction[txnId].items.push(item);
        });
      }

      if (!sellerLines.length) {
        setBusinessSellerTransactionList([]);
        setBusinessTransactionData([]);
        setBusinessReceiptCache({});
        businessReceiptFetchedRef.current = new Set();
        setOrderShippingProgressByKey({});
        return;
      }

      setBusinessSellerTransactionList(sellerLines.map(normalizeListRowReturnRefundFields));
      // Reset hydration overrides so account-screen list fulfillment fields win on first paint.
      setOrderShippingProgressByKey({});

      const listHydrationByOrderUid = extractOrderListHydrationMap(json);
      let debugHydration = false;
      if (SHOW_NETWORK_DEBUG_UI !== 0) {
        try {
          const nd = await AsyncStorage.getItem(SETTINGS_NETWORK_DEBUG_MODE_KEY);
          debugHydration = nd !== null && JSON.parse(nd) === true;
        } catch (_) {}
      }
      const hydrationOutcome = hydrateBusinessSellerFromListMap(sellerLines, listHydrationByOrderUid, { debugHydration });
      let patchedSellerLines = sellerLines.map(normalizeListRowReturnRefundFields);
      if (hydrationOutcome?.folded) {
        const { hydratedShipping, hydratedReceivedByOrder } = hydrationOutcome.folded;
        if (Object.keys(hydratedShipping).length || Object.keys(hydratedReceivedByOrder).length) {
          if (Object.keys(hydratedShipping).length) {
            setOrderShippingProgressByKey((prev) => ({ ...prev, ...hydratedShipping }));
          }
          patchedSellerLines = applyBusinessSellerHydrationPatches(patchedSellerLines, hydrationOutcome.folded);
          setBusinessSellerTransactionList(patchedSellerLines);
        }
      }
      logAccountScreenHydrationGaps({
        screenContext: "business / ORDERS table",
        rows: patchedSellerLines,
        listHydrationByOrderUid,
        auditRowGaps: (row, opts) => auditSellerOrdersTableGaps(row, patchedSellerLines, {}, opts.shippingProgressByKey || {}),
        auditOptions: {
          shippingProgressByKey: hydrationOutcome?.folded?.hydratedShipping || {},
        },
      });

      const businessTransactions = sellerLines.filter(isBusinessProductSellerLine).filter((row) => !isReturnListRow(row));
      businessTransactions.forEach((txn) => {
        txn.business_name = selectedBusiness?.business_name || selectedBusiness?.profile_business_name || "Unknown Business";
      });

      const transactionMap = {};
      businessTransactions.forEach((item) => {
        const txnId = item.transaction_uid;
        if (!transactionMap[txnId]) {
          const total = parseFloat(item.transaction_total || 0);
          const taxes = parseFloat(item.transaction_taxes || 0);
          const bounty = bountyDataByTransaction[txnId]?.total_bounty || 0;
          const proceedsStatus = sellerProceedsStatus(item, null);
          const netEarning = proceedsStatus === "useable" ? total - bounty - taxes : 0;
          transactionMap[txnId] = {
            transaction_uid: item.transaction_uid,
            transaction_datetime: item.transaction_datetime,
            transaction_profile_id: item.transaction_profile_id,
            transaction_business_id: item.transaction_business_id,
            transaction_total: total,
            transaction_taxes: taxes,
            bounty_paid: bounty,
            net_earning: netEarning,
            proceeds_status: proceedsStatus,
            business_name: item.business_name,
            transaction_return_requested: item.transaction_return_requested || 0,
            transaction_return_note: item.transaction_return_note || "",
            transaction_return_status: item.return_status || item.transaction_return_status || "",
            transaction_refund_status: item.refund_status || item.transaction_refund_status || "",
            return_status: item.return_status || item.transaction_return_status || "",
            refund_status: item.refund_status || item.transaction_refund_status || "",
            display_status: item.display_status || "",
          };
        }
      });

      const filteredTransactions = Object.values(transactionMap).sort((a, b) => {
        const dateA = parseTransactionDateTime(a);
        const dateB = parseTransactionDateTime(b);
        return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
      });

      if (!shouldApplyBusinessResponse()) return;
      setBusinessTransactionData(filteredTransactions);
    } catch (error) {
      if (!shouldApplyBusinessResponse()) return;
      console.error("Error loading account-screen business:", error);
      setBusinessTransactionData([]);
      setBusinessBountyData({ error: error.message });
      setBusinessReceiptCache({});
      businessReceiptFetchedRef.current = new Set();
      const row = businessesRef.current.find((b) => resolveBusinessUid(b) === targetBusinessUID);
      setSelectedBusinessFullData(mapSessionBusinessRowToMiniCard(row));
    } finally {
      if (!shouldApplyBusinessResponse()) return;
      setBusinessTransactionLoading(false);
      setBusinessBountyLoading(false);
    }
  };

  const reloadAccountScreen = useCallback(() => {
    checkAuth();
    // Load cached return state first, then personal list (which may hydrate over thin API rows).
    void (async () => {
      await loadReturnRequests();
      await loadReturnStatuses();
      await refreshAccountScreenPersonal();
      await refreshWalletLedger();
    })();

    const loadBusinessData = async () => {
      await refreshFromSession({ forceRefresh: true });
      // Session cache fills the dropdown; skip account-screen/business until a business profile is selected (or tab refocus while on business).
      if (selectedAccountRef.current !== "personal") {
        await refreshAccountScreenBusiness();
      } else {
        setBusinessTransactionLoading(false);
        setBusinessBountyLoading(false);
      }
    };
    loadBusinessData();

    (async () => {
      try {
        const nd = await AsyncStorage.getItem(SETTINGS_NETWORK_DEBUG_MODE_KEY);
        if (nd !== null) setSettingsDebugModeEnabled(JSON.parse(nd) === true);
        else setSettingsDebugModeEnabled(false);
      } catch {
        setSettingsDebugModeEnabled(false);
      }
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadAccountScreen();
    }, [reloadAccountScreen]),
  );

  useTabRefresh("Account", reloadAccountScreen);

  // Refresh the active profile's account-screen payload when selection changes.
  useEffect(() => {
    if (selectedAccount === "personal" || !selectedAccount) {
      setSelectedBusinessFullData(null);
      setBusinessSellerTransactionList([]);
      refreshAccountScreenPersonal();
      if (skipWalletOnNextPersonalEffectRef.current) {
        skipWalletOnNextPersonalEffectRef.current = false;
      } else {
        refreshWalletLedger();
      }
      return;
    }
    refreshAccountScreenBusiness();
  }, [selectedAccount, businesses]);

  const budgetData = [
    { item: "per Impression", costPer: "$0.01", monthlyCap: "$10.00", currentSpend: "$0.50" },
    { item: "per Click", costPer: "$0.10", monthlyCap: "$10.00", currentSpend: "$7.20" },
    { item: "per Request", costPer: "$1.00", monthlyCap: "$10.00", currentSpend: "$3.00" },
  ];

  const screenWidth = Dimensions.get("window").width - 40;

  // Process bounty data for Bounties chart with dual axes
  const processBountyDataForChart = (ledgerAvailabilityByTxnUid = {}, ledgerRows = [], purchaseRows = []) => {
    if (!bountyData || !bountyData.data || !Array.isArray(bountyData.data) || bountyData.data.length === 0) {
      return {
        dates: [],
        dailyBounty: [],
        cumulativeBounty: [],
        cumulativePending: [],
        cumulativeUseable: [],
        maxDaily: 0,
        maxCumulative: 0,
      };
    }

    const enrichedRows = bountyData.data.map((row) => enrichBountyLineFromPurchases(row, purchaseRows));

    // Group bounty by date and calculate cumulative
    const bountyByDate = {};

    enrichedRows.forEach((transaction) => {
      if (!transaction.transaction_datetime || transaction.bounty_earned == null) return;

      const date = parseTransactionDateTime(transaction);
      if (!date) return;
      const dateKey = localDateKey(date);

      if (!bountyByDate[dateKey]) {
        bountyByDate[dateKey] = 0;
      }
      bountyByDate[dateKey] += parseFloat(transaction.bounty_earned) || 0;
    });

    const recentDates = lastNDaysKeys(12);

    const dailyBounty = recentDates.map((date) => bountyByDate[date] || 0);

    // Build cumulative bounty, pending, and useable (same right-axis scale)
    const cumulativeBounty = [];
    const cumulativePending = [];
    const cumulativeUseable = [];
    let runningTotal = 0;
    recentDates.forEach((date) => {
      runningTotal += bountyByDate[date] || 0;
      cumulativeBounty.push(runningTotal);
      const pendingTotal = enrichedRows.reduce((sum, row) => sum + bountyAmountPendingOnChartDate(row, date, ledgerAvailabilityByTxnUid, ledgerRows), 0);
      cumulativePending.push(pendingTotal);
      cumulativeUseable.push(Math.max(0, runningTotal - pendingTotal));
    });

    const maxDaily = Math.max(...dailyBounty, 0.01);
    const maxCumulative = Math.max(...cumulativeBounty, ...cumulativePending, ...cumulativeUseable, 0.01);

    return {
      dates: recentDates,
      dailyBounty,
      cumulativeBounty,
      cumulativePending,
      cumulativeUseable,
      maxDaily,
      maxCumulative,
    };
  };

  // Process business transaction data for business Bounties chart
  const processBusinessTransactionDataForChart = () => {
    if (!businessTransactionData || !Array.isArray(businessTransactionData) || businessTransactionData.length === 0) {
      return {
        dates: [],
        dailyEarnings: [],
        cumulativeEarnings: [],
        maxDaily: 0,
        maxCumulative: 0,
      };
    }

    // Group earnings by date
    const earningsByDate = {};

    businessTransactionData.forEach((transaction) => {
      if (!transaction.transaction_datetime || transaction.net_earning == null) return;

      const date = parseTransactionDateTime(transaction);
      if (!date) return;
      const dateKey = localDateKey(date);

      if (!earningsByDate[dateKey]) {
        earningsByDate[dateKey] = 0;
      }
      earningsByDate[dateKey] += parseFloat(transaction.net_earning) || 0;
    });

    const recentDates = lastNDaysKeys(12);
    const dailyEarnings = recentDates.map((date) => earningsByDate[date] || 0);

    const cumulativeEarnings = [];
    let runningTotal = 0;
    recentDates.forEach((date) => {
      runningTotal += earningsByDate[date] || 0;
      cumulativeEarnings.push(runningTotal);
    });

    const maxDaily = Math.max(...dailyEarnings, 0.01);
    const maxCumulative = Math.max(...cumulativeEarnings, 0.01);

    return {
      dates: recentDates,
      dailyEarnings,
      cumulativeEarnings,
      maxDaily,
      maxCumulative,
    };
  };

  // Linear scale helper for right axis (with different scale)
  const linearScale = (value, maxValue, height) => {
    if (value <= 0 || !isFinite(value)) return height;
    if (maxValue <= 0 || !isFinite(maxValue)) return height;
    const normalized = Math.max(0, Math.min(1, value / maxValue));
    const result = height - normalized * height;
    return isFinite(result) ? result : height;
  };

  const formatDateLabel = (dateKey) => formatLocalMonthDayFromKey(dateKey);

  /** Mobile earnings charts: month abbr on calendar day 1 only (e.g. Apr); on 7,14,21,28 show day number only; else no label. */
  const formatEarningsChartXAxisLabelMobile = (dateString) => {
    const [y, m, d] = String(dateString).split("-").map(Number);
    if (!y || !m || !d) return "";
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    const day = dt.getDate();
    if (day === 1) {
      return dt.toLocaleString("en-US", { month: "short" });
    }
    if (day >= 7 && day <= 28 && day % 7 === 0) {
      return String(day);
    }
    return "";
  };

  /** Milliseconds at local noon for chart YYYY-MM-DD keys (matches label rules). */
  const dayMsFromChartDateKey = (dateString) => {
    const [y, m, d] = String(dateString).split("-").map(Number);
    if (!y || !m || !d) return NaN;
    return new Date(y, m - 1, d, 12, 0, 0).getTime();
  };

  /**
   * Mobile: place month / 7-14-21-28 labels on a **time** scale between sparse data points
   * (so e.g. Apr 28 and May 1 still appear between Apr 21 and May 7 when those days have no rows).
   */
  const buildMobileEarningsXAxisTicksByTime = (dates, xPositions, clipMinX, clipMaxX) => {
    if (!dates.length) return [];
    const tKey = dayMsFromChartDateKey;

    const xAtTime = (t) => {
      const t0 = tKey(dates[0]);
      const tN = tKey(dates[dates.length - 1]);
      if (!Number.isFinite(t0) || !Number.isFinite(tN) || !Number.isFinite(t)) return xPositions[0];
      if (dates.length === 1 || t0 === tN) return xPositions[0];
      if (t <= t0) return xPositions[0];
      if (t >= tN) return xPositions[dates.length - 1];
      for (let i = 0; i < dates.length - 1; i++) {
        const ta = tKey(dates[i]);
        const tb = tKey(dates[i + 1]);
        if (t >= ta && t <= tb) {
          const denom = Math.max(1, tb - ta);
          const frac = (t - ta) / denom;
          return xPositions[i] + frac * (xPositions[i + 1] - xPositions[i]);
        }
      }
      return xPositions[dates.length - 1];
    };

    const ticks = [];
    const [y0, mo0, da0] = dates[0].split("-").map(Number);
    const [y1, mo1, da1] = dates[dates.length - 1].split("-").map(Number);
    let cur = new Date(y0, mo0 - 1, da0, 12, 0, 0);
    const end = new Date(y1, mo1 - 1, da1, 12, 0, 0);

    while (cur.getTime() <= end.getTime()) {
      const y = cur.getFullYear();
      const mo = cur.getMonth() + 1;
      const da = cur.getDate();
      const key = `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
      const label = formatEarningsChartXAxisLabelMobile(key);
      if (label) {
        const t = new Date(y, mo - 1, da, 12, 0, 0).getTime();
        const rawX = xAtTime(t);
        const x = Math.min(clipMaxX, Math.max(clipMinX, rawX));
        ticks.push({ key: `mob-x-${key}`, x, label });
      }
      cur.setDate(cur.getDate() + 1);
    }
    return ticks;
  };

  // Format Y-axis label with 2 decimal places
  const formatYLabel = (value) => {
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  // Generate linear tick values for right axis
  const generateLinearTicks = (maxValue, numTicks = 6) => {
    const ticks = [];
    const step = maxValue / numTicks;
    for (let i = 0; i <= numTicks; i++) {
      ticks.push(step * i);
    }
    return ticks;
  };

  const NetEarningChart = () => {
    const chartData = processBountyDataForChart(ledgerAvailabilityByTxnUid, walletLedgerRows, transactionData);
    const screenWidth = Dimensions.get("window").width - 40;
    const chartWidth = screenWidth;
    const chartHeight = 200; // Increased from 180 to make room for x-axis label
    const paddingLeft = 50;
    const paddingRight = 50;
    const paddingTop = 20;
    const paddingBottom = 50; // Increased from 30 to make room for x-axis label
    const plotWidth = chartWidth - paddingLeft - paddingRight;
    const plotHeight = chartHeight - paddingTop - paddingBottom;

    if (chartData.dates.length === 0) {
      return (
        <View style={{ width: chartWidth, height: chartHeight, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "#717171" }}>No data available</Text>
        </View>
      );
    }

    const dataPoints = chartData.dates.length;
    const xStep = plotWidth / Math.max(dataPoints - 1, 1);

    // Calculate Y positions for daily bounty (linear, left axis)
    const dailyYPositions = chartData.dailyBounty.map((value) => {
      const normalized = Math.max(0, Math.min(1, value / chartData.maxDaily));
      const y = paddingTop + plotHeight - normalized * plotHeight;
      return isFinite(y) ? y : paddingTop + plotHeight;
    });

    // Calculate Y positions for cumulative bounty (linear, right axis with different scale)
    const cumulativeYPositions = chartData.cumulativeBounty.map((value) => {
      const normalized = Math.max(0, Math.min(1, value / chartData.maxCumulative));
      const y = paddingTop + plotHeight - normalized * plotHeight;
      return isFinite(y) ? y : paddingTop + plotHeight;
    });

    const cumulativePendingYPositions = (chartData.cumulativePending || []).map((value) => {
      const normalized = Math.max(0, Math.min(1, value / chartData.maxCumulative));
      const y = paddingTop + plotHeight - normalized * plotHeight;
      return isFinite(y) ? y : paddingTop + plotHeight;
    });

    const cumulativeUseableYPositions = (chartData.cumulativeUseable || []).map((value) => {
      const normalized = Math.max(0, Math.min(1, value / chartData.maxCumulative));
      const y = paddingTop + plotHeight - normalized * plotHeight;
      return isFinite(y) ? y : paddingTop + plotHeight;
    });

    // Generate X positions
    const xPositions = chartData.dates.map((_, index) => paddingLeft + index * xStep);

    // Generate left Y-axis ticks (linear) - Limited to 4 ticks
    const leftTickCount = 4;
    const leftTickValues = [];
    for (let i = 0; i <= leftTickCount; i++) {
      leftTickValues.push((chartData.maxDaily / leftTickCount) * i);
    }

    // Generate right Y-axis ticks (linear) - Limited to 4 ticks
    const rightTickCount = 4;
    const rightTickValues = [];
    for (let i = 0; i <= rightTickCount; i++) {
      rightTickValues.push((chartData.maxCumulative / rightTickCount) * i);
    }

    // Build path strings for lines
    const buildPath = (positions) => {
      return positions
        .map((y, index) => {
          const x = xPositions[index];
          const safeX = isFinite(x) ? x : 0;
          const safeY = isFinite(y) ? y : paddingTop + plotHeight;
          return index === 0 ? `M ${safeX} ${safeY}` : `L ${safeX} ${safeY}`;
        })
        .join(" ");
    };

    const dailyPath = buildPath(dailyYPositions);
    const cumulativePath = buildPath(cumulativeYPositions);
    const cumulativePendingPath = buildPath(cumulativePendingYPositions);
    const cumulativeUseablePath = buildPath(cumulativeUseableYPositions);

    return (
      <View style={{ width: chartWidth, height: chartHeight, marginVertical: 8 }}>
        {/* Legend */}
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 8, gap: 16, flexWrap: "wrap" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 12, height: 3, backgroundColor: "#B71C1C", marginRight: 6 }} />
            <Text style={{ fontSize: 12, color: "#666", ...accountUiFontStyle }}>Daily Bounty</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 12, height: 3, backgroundColor: "#000", marginRight: 6 }} />
            <Text style={{ fontSize: 12, color: "#666", ...accountUiFontStyle }}>Cumulative Bounty</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 12, height: 3, backgroundColor: "#2E7D32", marginRight: 6 }} />
            <Text style={{ fontSize: 12, color: "#666", ...accountUiFontStyle }}>Cumulative Useable</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 12, height: 3, backgroundColor: "#E65100", marginRight: 6 }} />
            <Text style={{ fontSize: 12, color: "#666", ...accountUiFontStyle }}>Cumulative Pending</Text>
          </View>
        </View>
        <Svg width={chartWidth} height={chartHeight}>
          {/* Grid lines (horizontal) */}
          {leftTickValues.map((tick, index) => {
            const y = paddingTop + plotHeight - (tick / chartData.maxDaily) * plotHeight;
            return <Line key={`grid-${index}`} x1={paddingLeft} y1={y} x2={paddingLeft + plotWidth} y2={y} stroke='#ddd' strokeWidth='1' />;
          })}

          {/* Left Y-axis (linear) - Red to match Daily Bounty line */}
          <Line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + plotHeight} stroke='#B71C1C' strokeWidth='2' />
          {leftTickValues.map((tick, index) => {
            const y = paddingTop + plotHeight - (tick / chartData.maxDaily) * plotHeight;
            return (
              <G key={`left-tick-${index}`}>
                <Line x1={paddingLeft} y1={y} x2={paddingLeft - 5} y2={y} stroke='#B71C1C' strokeWidth='1' />
                <SvgText x={paddingLeft - 8} y={y + 4} fontSize='10' fill='#B71C1C' textAnchor='end' {...accountChartSvgFontProps}>
                  {formatYLabel(tick)}
                </SvgText>
              </G>
            );
          })}

          {/* Right Y-axis (linear) */}
          <Line x1={paddingLeft + plotWidth} y1={paddingTop} x2={paddingLeft + plotWidth} y2={paddingTop + plotHeight} stroke='#666' strokeWidth='2' />
          {rightTickValues.map((tick, index) => {
            const y = paddingTop + plotHeight - (tick / chartData.maxCumulative) * plotHeight;
            return (
              <G key={`right-tick-${index}`}>
                <Line x1={paddingLeft + plotWidth} y1={y} x2={paddingLeft + plotWidth + 5} y2={y} stroke='#666' strokeWidth='1' />
                <SvgText x={paddingLeft + plotWidth + 8} y={y + 4} fontSize='10' fill='#666' textAnchor='start' {...accountChartSvgFontProps}>
                  {formatYLabel(tick)}
                </SvgText>
              </G>
            );
          })}

          {/* X-axis */}
          <Line x1={paddingLeft} y1={paddingTop + plotHeight} x2={paddingLeft + plotWidth} y2={paddingTop + plotHeight} stroke='#666' strokeWidth='2' />

          {/* X-axis labels (web: per point; mobile: calendar ticks interpolated by time between points) */}
          {Platform.OS === "web"
            ? chartData.dates.map((date, index) => {
                const x = xPositions[index];
                return (
                  <SvgText key={`x-label-${index}`} x={x} y={paddingTop + plotHeight + 15} fontSize='10' fill='#666' textAnchor='middle' {...accountChartSvgFontProps}>
                    {formatDateLabel(date)}
                  </SvgText>
                );
              })
            : buildMobileEarningsXAxisTicksByTime(chartData.dates, xPositions, paddingLeft, paddingLeft + plotWidth).map((tick) => (
                <SvgText key={tick.key} x={tick.x} y={paddingTop + plotHeight + 15} fontSize='10' fill='#666' textAnchor='middle' {...accountChartSvgFontProps}>
                  {tick.label}
                </SvgText>
              ))}

          {/* X-axis title label */}
          <SvgText x={paddingLeft + plotWidth / 2} y={paddingTop + plotHeight + 35} fontSize='12' fill='#333' fontWeight='600' textAnchor='middle' {...accountChartSvgFontProps}>
            Date
          </SvgText>

          {/* Daily bounty line (red, left axis) */}
          <Path d={dailyPath} stroke='#B71C1C' strokeWidth='3' fill='none' />
          {dailyYPositions.map((y, index) => (
            <Circle key={`daily-dot-${index}`} cx={xPositions[index]} cy={y} r='4' fill='#B71C1C' />
          ))}

          {/* Cumulative bounty line (black, right axis) */}
          <Path d={cumulativePath} stroke='black' strokeWidth='3' fill='none' />
          {cumulativeYPositions.map((y, index) => (
            <Circle key={`cumulative-dot-${index}`} cx={xPositions[index]} cy={y} r='4' fill='black' />
          ))}

          {/* Cumulative pending line (orange, right axis) */}
          <Path d={cumulativePendingPath} stroke='#E65100' strokeWidth='3' fill='none' strokeDasharray='6,4' />
          {cumulativePendingYPositions.map((y, index) => (
            <Circle key={`pending-dot-${index}`} cx={xPositions[index]} cy={y} r='4' fill='#E65100' />
          ))}

          {/* Cumulative useable line (green, right axis) */}
          <Path d={cumulativeUseablePath} stroke='#2E7D32' strokeWidth='3' fill='none' />
          {cumulativeUseableYPositions.map((y, index) => (
            <Circle key={`useable-dot-${index}`} cx={xPositions[index]} cy={y} r='4' fill='#2E7D32' />
          ))}
        </Svg>
      </View>
    );
  };

  const BusinessNetEarningChart = () => {
    const chartData = processBusinessTransactionDataForChart();
    const screenWidth = Dimensions.get("window").width - 40;
    const chartWidth = screenWidth;
    const chartHeight = 200; // Increased from 180
    const paddingLeft = 50;
    const paddingRight = 50;
    const paddingTop = 20;
    const paddingBottom = 50; // Increased from 30
    const plotWidth = chartWidth - paddingLeft - paddingRight;
    const plotHeight = chartHeight - paddingTop - paddingBottom;

    if (chartData.dates.length === 0) {
      return (
        <View style={{ width: chartWidth, height: chartHeight, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "#888" }}>No data available</Text>
        </View>
      );
    }

    const dataPoints = chartData.dates.length;
    const xStep = plotWidth / Math.max(dataPoints - 1, 1);

    const dailyYPositions = chartData.dailyEarnings.map((value) => {
      const normalized = Math.max(0, Math.min(1, value / chartData.maxDaily));
      const y = paddingTop + plotHeight - normalized * plotHeight;
      return isFinite(y) ? y : paddingTop + plotHeight;
    });

    const cumulativeYPositions = chartData.cumulativeEarnings.map((value) => {
      const y = paddingTop + linearScale(value, chartData.maxCumulative, plotHeight);
      return isFinite(y) ? y : paddingTop + plotHeight;
    });

    const xPositions = chartData.dates.map((_, index) => paddingLeft + index * xStep);

    // Generate left Y-axis ticks - Limited to 4 ticks
    const leftTickCount = 4;
    const leftTickValues = [];
    for (let i = 0; i <= leftTickCount; i++) {
      leftTickValues.push((chartData.maxDaily / leftTickCount) * i);
    }

    // Generate right Y-axis ticks - Limited to 4 ticks
    const rightTickCount = 4;
    const rightTickValues = [];
    for (let i = 0; i <= rightTickCount; i++) {
      rightTickValues.push((chartData.maxCumulative / rightTickCount) * i);
    }

    const buildPath = (positions) => {
      return positions
        .map((y, index) => {
          const x = xPositions[index];
          const safeX = isFinite(x) ? x : 0;
          const safeY = isFinite(y) ? y : paddingTop + plotHeight;
          return index === 0 ? `M ${safeX} ${safeY}` : `L ${safeX} ${safeY}`;
        })
        .join(" ");
    };

    const dailyPath = buildPath(dailyYPositions);
    const cumulativePath = buildPath(cumulativeYPositions);

    return (
      <View style={{ width: chartWidth, height: chartHeight, marginVertical: 8 }}>
        {/* Legend */}
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 8, gap: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 12, height: 3, backgroundColor: "#B71C1C", marginRight: 6 }} />
            <Text style={{ fontSize: 12, color: "#666", ...accountUiFontStyle }}>Daily Net Earnings</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 12, height: 3, backgroundColor: "#000", marginRight: 6 }} />
            <Text style={{ fontSize: 12, color: "#666", ...accountUiFontStyle }}>Cumulative Net Earnings</Text>
          </View>
        </View>
        <Svg width={chartWidth} height={chartHeight}>
          {/* Grid lines */}
          {leftTickValues.map((tick, index) => {
            const y = paddingTop + plotHeight - (tick / chartData.maxDaily) * plotHeight;
            return <Line key={`grid-${index}`} x1={paddingLeft} y1={y} x2={paddingLeft + plotWidth} y2={y} stroke='#ddd' strokeWidth='1' />;
          })}

          {/* Left Y-axis */}
          <Line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + plotHeight} stroke='#666' strokeWidth='2' />
          {leftTickValues.map((tick, index) => {
            const y = paddingTop + plotHeight - (tick / chartData.maxDaily) * plotHeight;
            return (
              <G key={`left-tick-${index}`}>
                <Line x1={paddingLeft} y1={y} x2={paddingLeft - 5} y2={y} stroke='#666' strokeWidth='1' />
                <SvgText x={paddingLeft - 8} y={y + 4} fontSize='10' fill='#666' textAnchor='end' {...accountChartSvgFontProps}>
                  {formatYLabel(tick)}
                </SvgText>
              </G>
            );
          })}

          {/* Right Y-axis */}
          <Line x1={paddingLeft + plotWidth} y1={paddingTop} x2={paddingLeft + plotWidth} y2={paddingTop + plotHeight} stroke='#666' strokeWidth='2' />
          {rightTickValues.map((tick, index) => {
            const y = paddingTop + linearScale(tick, chartData.maxCumulative, plotHeight);
            return (
              <G key={`right-tick-${index}`}>
                <Line x1={paddingLeft + plotWidth} y1={y} x2={paddingLeft + plotWidth + 5} y2={y} stroke='#666' strokeWidth='1' />
                <SvgText x={paddingLeft + plotWidth + 8} y={y + 4} fontSize='10' fill='#666' textAnchor='start' {...accountChartSvgFontProps}>
                  {formatYLabel(tick)}
                </SvgText>
              </G>
            );
          })}

          {/* X-axis */}
          <Line x1={paddingLeft} y1={paddingTop + plotHeight} x2={paddingLeft + plotWidth} y2={paddingTop + plotHeight} stroke='#666' strokeWidth='2' />

          {/* X-axis labels (web: per point; mobile: calendar ticks by time) */}
          {Platform.OS === "web"
            ? chartData.dates.map((date, index) => {
                const x = xPositions[index];
                return (
                  <SvgText key={`x-label-${index}`} x={x} y={paddingTop + plotHeight + 15} fontSize='10' fill='#666' textAnchor='middle' {...accountChartSvgFontProps}>
                    {formatDateLabel(date)}
                  </SvgText>
                );
              })
            : buildMobileEarningsXAxisTicksByTime(chartData.dates, xPositions, paddingLeft, paddingLeft + plotWidth).map((tick) => (
                <SvgText key={tick.key} x={tick.x} y={paddingTop + plotHeight + 15} fontSize='10' fill='#666' textAnchor='middle' {...accountChartSvgFontProps}>
                  {tick.label}
                </SvgText>
              ))}

          {/* X-axis title label */}
          <SvgText x={paddingLeft + plotWidth / 2} y={paddingTop + plotHeight + 35} fontSize='12' fill='#333' fontWeight='600' textAnchor='middle' {...accountChartSvgFontProps}>
            Date
          </SvgText>

          {/* Daily earnings line */}
          <Path d={dailyPath} stroke='#B71C1C' strokeWidth='3' fill='none' />
          {dailyYPositions.map((y, index) => (
            <Circle key={`daily-dot-${index}`} cx={xPositions[index]} cy={y} r='4' fill='#B71C1C' />
          ))}

          {/* Cumulative earnings line */}
          <Path d={cumulativePath} stroke='black' strokeWidth='3' fill='none' />
          {cumulativeYPositions.map((y, index) => (
            <Circle key={`cumulative-dot-${index}`} cx={xPositions[index]} cy={y} r='4' fill='black' />
          ))}
        </Svg>
      </View>
    );
  };

  const ledgerAvailabilityByTxnUid = useMemo(() => buildLedgerAvailabilityByTxnUid(walletLedgerRows), [walletLedgerRows]);

  const personalPendingBountyTotal = useMemo(() => {
    if (personalWallet?.wallet_pending != null) return parsePrice(personalWallet.wallet_pending);
    if (!bountyData?.data || !Array.isArray(bountyData.data)) return 0;
    return bountyData.data.reduce((sum, item) => {
      const status = bountyProceedsStatus(item, ledgerAvailabilityByTxnUid, walletLedgerRows);
      if (status === "useable") return sum;
      return sum + parseFloat(item.bounty_earned || 0);
    }, 0);
  }, [personalWallet, bountyData, ledgerAvailabilityByTxnUid, walletLedgerRows]);

  const personalUseableBountyTotal = useMemo(() => {
    if (!bountyData?.data || !Array.isArray(bountyData.data)) {
      return Math.max(0, parsePrice(bountyData?.total_bounty_earned) - personalPendingBountyTotal);
    }
    return bountyData.data.reduce((sum, item) => {
      if (bountyProceedsStatus(item, ledgerAvailabilityByTxnUid, walletLedgerRows) === "useable") {
        return sum + parseFloat(item.bounty_earned || 0);
      }
      return sum;
    }, 0);
  }, [bountyData, ledgerAvailabilityByTxnUid, walletLedgerRows, personalPendingBountyTotal]);

  const businessNetEarningsTotal = businessTransactionData.reduce((s, t) => {
    if (t.proceeds_status && t.proceeds_status !== "useable") return s;
    return s + parseFloat(t.net_earning || 0);
  }, 0);
  const productSalesSummary = useMemo(() => {
    const products = aggregateBusinessProductSales(businessBountyData?.data || []);
    const unitsAvailableByUid = buildUnitsAvailableByProductUid(businessServices, expertiseCatalog);
    return products.map((product) => ({
      ...product,
      unitsAvailable: unitsAvailableByUid[product.productUid] ?? "—",
    }));
  }, [businessBountyData, businessServices, expertiseCatalog]);
  const productInventorySummary = useMemo(() => buildProductInventoryRows(businessServices), [businessServices]);
  const returnDetailBountyRows = useMemo(
    () => resolveAccountBountyRowsForReturn(returnDetailModal.isSellerView, selectedAccount, bountyData, businessBountyData),
    [returnDetailModal.isSellerView, selectedAccount, bountyData, businessBountyData],
  );
  const sellerOrderBountyRows = useMemo(() => resolveAccountBountyRowsForReturn(true, selectedAccount, bountyData, businessBountyData), [selectedAccount, bountyData, businessBountyData]);
  const returnDetailRestockCandidates = useMemo(() => {
    if (!returnDetailModal.visible || returnDetailModal.isSellerView === false || !returnDetailModal.orderDetail) return [];
    const returnScope = {
      trrUid: returnDetailModal.trrUid || null,
      trrUids: returnDetailModal.trrUids || [],
      returnTxnUid: returnDetailModal.returnTxnUid || null,
      sourceReturnRow: returnDetailModal.sourceReturnRow || null,
    };
    const restockTxnUid = String(returnDetailModal.orderDetail?.sale?.transaction_uid || returnDetailModal.orderUid || "").trim();
    const restockBountyPool = resolveReturnDetailBountyPool(returnDetailModal.orderDetail?.sale, returnDetailBountyRows, restockTxnUid, {
      bountyPaidFallback: returnDetailModal.bountyPaidFallback,
      sourceReturnRow: returnDetailModal.sourceReturnRow || null,
    });
    const returnItems = buildReturnDetailDisplayItems(returnDetailModal.orderDetail, returnDetailBountyRows, returnScope, restockBountyPool);
    const splitInfo = analyzeReturnDetailSplit(returnItems);
    return buildReturnRestockCandidates(
      returnItems,
      { businessServices, expertiseCatalog },
      {
        receivedKeys: returnReceivedItemKeys,
        isPreShipCancel: splitInfo.cancelOnly,
      },
    );
  }, [
    returnDetailModal.visible,
    returnDetailModal.isSellerView,
    returnDetailModal.orderDetail,
    returnDetailModal.trrUid,
    returnDetailModal.trrUids,
    returnDetailModal.returnTxnUid,
    returnDetailModal.sourceReturnRow,
    businessServices,
    expertiseCatalog,
    returnDetailModal.bountyPaidFallback,
    returnDetailBountyRows,
    returnReceivedItemKeys,
  ]);
  useEffect(() => {
    if (!returnDetailRestockCandidates.length) return;
    setReturnRestockQtyByKey((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const candidate of returnDetailRestockCandidates) {
        if (next[candidate.key] == null) {
          next[candidate.key] = candidate.maxQty;
          changed = true;
        } else if (next[candidate.key] > candidate.maxQty) {
          next[candidate.key] = candidate.maxQty;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [returnDetailRestockCandidates]);
  const businessOrdersSummary = useMemo(
    () => buildBusinessOrdersListFromSellerTransactions(businessSellerTransactionList, sellerOrderBountyRows, orderShippingProgressByKey, returnStatuses),
    [businessSellerTransactionList, sellerOrderBountyRows, orderShippingProgressByKey, returnStatuses],
  );
  const personalPurchasesDisplayList = useMemo(
    () => buildPersonalPurchasesListWithReturns(transactionData, returnStatuses, returnRequests, bountyData?.data || []),
    [transactionData, returnStatuses, returnRequests, bountyData],
  );

  /** Debug Mode Yes (Settings): show Transaction ID, Type, Purchased Item. Narrow web (<700px) uses the same compact layout as mobile without those debug columns. Purchased Item also shows on web when width > 600 regardless of Debug Mode (unless compact dev flag hides it). */
  const purchasesShowDebugColumns = SHOW_NETWORK_DEBUG_UI !== 0 && settingsDebugModeEnabled;
  const narrowWebPurchasesLayout = Platform.OS === "web" && windowWidth < 700;
  const effectivePurchasesShowDebugColumns = purchasesShowDebugColumns && !narrowWebPurchasesLayout;
  const compactPurchasesLayout = ACCOUNT_TRANSACTION_HISTORY_COMPACT_COLUMNS === 1;
  /** Purchases: Transaction ID; Bounty Results: ID — same visibility (debug + wide web, not compact dev flag). */
  const showPurchasesTxnIdColumn = effectivePurchasesShowDebugColumns && !compactPurchasesLayout;
  const showPurchasesTypeColumn = effectivePurchasesShowDebugColumns;
  const showWebWidePurchasedItemColumn = Platform.OS === "web" && windowWidth > 600;
  const showPurchasesPurchasedItemColumn = !compactPurchasesLayout && (effectivePurchasesShowDebugColumns || showWebWidePurchasedItemColumn);
  /** Purchases always show item column so receipt opens from the purchased item, not the seller. */
  const showPurchasesItemColumn = true;

  if (isLoading) {
    return (
      <View style={[styles.container, darkMode && styles.darkContainer]}>
        <AppHeader title='ACCOUNT' {...getHeaderColors("account")} />
        <View style={[styles.centeredContainer, { flex: 1 }]}>
          <ActivityIndicator size='large' color='#007BFF' />
          <Text style={{ marginTop: 10 }}>Loading account data...</Text>
        </View>
        <BottomNavBar navigation={navigation} />
      </View>
    );
  }

  const receiptIsReturnReceipt = !receiptLoading && receiptData.length > 0 && isReturnReceipt(receiptData);
  const receiptPurchaseType = (receiptTransaction?.purchase_type || "").toLowerCase();
  const isOfferingReceipt = receiptPurchaseType === "expertise" || receiptPurchaseType === "offering";

  return (
    <View style={[styles.container, darkMode && styles.darkContainer]}>
      {/* Header */}
      <AppHeader
        title='ACCOUNT'
        {...getHeaderColors("account")}
        onTitlePress={() => setShowFeedbackPopup(true)}
        //Drop to the right in Header*
        // rightButton={
        //   <TouchableOpacity
        //     style={styles.dropdownButton}
        //     onPress={() => {
        //       console.log("Dropdown arrow clicked, toggling from:", showAccountDropdown);
        //       setShowAccountDropdown(!showAccountDropdown);
        //     }}
        //     activeOpacity={0.7}
        //   >
        //     <Text style={styles.dropdownArrow}>▼</Text>
        //   </TouchableOpacity>
        // }
      />

      {/* Main content */}
      <ScrollView style={styles.contentContainer} contentContainerStyle={styles.scrollContentContainer} showsVerticalScrollIndicator={true}>
        {/* MiniCard - shows personal or business depending on selection */}
        {selectedAccount === "personal"
          ? personalProfileData && (
              <TouchableOpacity activeOpacity={0.7} onPress={handleAccountMiniCardPress}>
                <View style={{ marginBottom: 16 }}>
                  <MiniCard user={personalProfileData} />
                </View>
              </TouchableOpacity>
            )
          : selectedBusinessFullData && (
              <TouchableOpacity activeOpacity={0.7} onPress={handleAccountMiniCardPress}>
                <View style={{ marginBottom: 16 }}>
                  <MiniCard business={selectedBusinessFullData} />
                </View>
              </TouchableOpacity>
            )}
        {/* Select Profile Dropdown Row */}
        <View style={styles.selectProfileRow}>
          <Text style={styles.selectProfileLabel}>Select Profile</Text>
          <TouchableOpacity style={styles.selectProfileDropdown} onPress={() => setShowAccountDropdown(!showAccountDropdown)} activeOpacity={0.7}>
            <Text style={styles.selectProfileDropdownText}>
              {selectedAccount === "personal" ? "Personal" : businesses.find((b) => resolveBusinessUid(b) === selectedAccount)?.business_name || "Business"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dropdown Menu */}
        {showAccountDropdown && (
          <View style={styles.selectProfileMenu}>
            <TouchableOpacity style={styles.dropdownItem} onPress={() => handleProfileSelection("personal")}>
              <Text style={[styles.dropdownItemText, selectedAccount === "personal" && styles.dropdownItemTextActive]}>Personal</Text>
            </TouchableOpacity>
            {businesses.map((business, index) => {
              const businessId = resolveBusinessUid(business);
              const businessName = business.business_name || business.profile_business_name || `Business ${index + 1}`;
              return (
                <TouchableOpacity key={businessId || index} style={styles.dropdownItem} onPress={() => handleProfileSelection(businessId)}>
                  <Text style={[styles.dropdownItemText, selectedAccount === businessId && styles.dropdownItemTextActive]}>{businessName}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {selectedAccount === "personal" ? (
          <>
            {/* Sales (profile offerings / seller activity) */}
            <View style={styles.sectionContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowExpertise(!showExpertise)}>
                <Text style={styles.sectionHeaderText}>SALES</Text>
                <Ionicons name={showExpertise ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showExpertise && (
                <>
                  {expertiseLoading ? (
                    <Text style={styles.loadingText}>Loading sales data...</Text>
                  ) : expertiseData.length > 0 ? (
                    <View style={styles.tableContainer}>
                      <View style={styles.transactionHeaderRow}>
                        <Text style={[styles.transactionHeaderBusiness, { flex: 1.5 }]}>Item</Text>
                        <Text style={[styles.transactionHeaderDate, { flex: 0.9 }]}>Cost</Text>
                        <Text style={[styles.transactionHeaderDate, { flex: 0.7 }]}>Unit</Text>
                        <Text style={[styles.transactionHeaderDate, { flex: 0.7 }]}>Sold</Text>
                        <Text style={[styles.transactionHeaderDate, { flex: 0.7 }]}>Left</Text>
                        <Text style={[styles.transactionHeaderAmount, { flex: 1, textAlign: "right" }]}>Bounty</Text>
                      </View>
                      {expertiseData.map((item, idx) => {
                        const soldAttention = resolveOfferingSoldQtyAttentionLevel(item.expertiseUid, sellerTxData, orderShippingProgressByKey, returnStatuses);
                        return (
                          <View key={item.expertiseUid || idx} style={styles.tableRow}>
                            <TouchableOpacity style={{ flex: 1.5 }} onPress={() => openOfferingListing(item)} activeOpacity={0.7}>
                              <Text style={[styles.tableCell, styles.receiptLink]} numberOfLines={2}>
                                {item.name}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.salesTableDataPressable} onPress={() => openOfferingSalesHistory(item)} activeOpacity={0.7}>
                              <Text style={[styles.tableCell, { flex: 0.9, color: "#777", marginLeft: 30 }]}>${item.cost}</Text>
                              <Text style={[styles.tableCell, { flex: 0.7, color: "#777", marginLeft: 12 }]}>{item.unit}</Text>
                              <Text
                                style={[
                                  styles.tableCell,
                                  {
                                    flex: 0.7,
                                    marginLeft: 12,
                                    color: soldAttention === "red" ? "#B71C1C" : soldAttention === "orange" ? "#E65100" : soldAttention === "purple" ? "#7B1FA2" : "#777",
                                    fontWeight: soldAttention ? "600" : "400",
                                  },
                                ]}
                              >
                                {item.soldQty}
                              </Text>
                              <Text style={[styles.tableCell, { flex: 0.7, color: item.remaining === 0 ? "#c00" : "#777", marginLeft: 12 }]}>{item.remaining === null ? "∞" : item.remaining}</Text>
                              <Text style={[styles.tableCell, { flex: 1, color: "#777", textAlign: "right", marginRight: 15 }]}>${item.bounty}</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.noDataText}>No sales data available.</Text>
                  )}
                </>
              )}
            </View>

            {/* Purchases */}
            <View style={styles.sectionContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowTransactionHistory(!showTransactionHistory)}>
                <Text style={styles.sectionHeaderText}>PURCHASES</Text>
                <Ionicons name={showTransactionHistory ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showTransactionHistory && (
                <>
                  {transactionLoading ? (
                    <Text style={styles.loadingText}>Loading transaction data...</Text>
                  ) : personalPurchasesDisplayList.length > 0 ? (
                    <View style={styles.transactionsContainer}>
                      {/* Table Header */}
                      <View style={styles.transactionHeaderRow}>
                        <Text style={styles.transactionHeaderDate}>Date</Text>
                        {showPurchasesTxnIdColumn ? <Text style={styles.transactionHeaderId}>Transaction ID</Text> : null}
                        {showPurchasesTypeColumn ? <Text style={styles.transactionHeaderPurchaseType}>Type</Text> : null}
                        <Text style={styles.transactionHeaderBusiness}>Seller</Text>
                        {showPurchasesItemColumn ? <Text style={styles.transactionHeaderPurchasedItem}>Purchased Item</Text> : null}
                        {ACCOUNT_TRANSACTION_HISTORY_COMPACT_COLUMNS !== 1 && <Text style={styles.transactionHeaderQty}>Qty</Text>}
                        <Text style={styles.transactionHeaderDelivered}>Delivered</Text>
                        <Text style={styles.transactionHeaderReceived}>Received</Text>
                        <Text style={styles.transactionHeaderAmount}>Amount</Text>
                      </View>
                      {/* Table Rows */}
                      {personalPurchasesDisplayList.map((transaction, i) => {
                        const isReturnRow = isReturnListRow(transaction);
                        const isSyntheticReturn = !!transaction._isSyntheticReturn;
                        const orderUid = resolveListRowOrderUid(transaction);
                        const compactTx = compactPurchasesLayout;
                        const sellerId = resolvePurchaseSellerId(transaction);
                        const returnMoney = isReturnRow ? resolveReturnRowMoney(transaction, null, bountyData?.data || []) : null;
                        const displayAmount = isReturnRow
                          ? returnMoney?.total || parseFloat(transaction.transaction_total ?? transaction.seller_total ?? 0) || 0
                          : parseFloat(transaction.transaction_total ?? transaction.seller_total ?? 0);
                        const rowIdentity = resolveTrrUid(transaction) || transaction.transaction_uid || transaction.ti_uid || "purchase";
                        const rowKey = `${rowIdentity}-${isReturnRow ? "return" : "sale"}-${i}`;
                        const openPurchaseRowDetail = () => {
                          if (orderUid === "—") return;
                          if (isReturnRow) {
                            openReturnDetails({
                              orderUid,
                              listTransactionUid: String(transaction.original_transaction_uid || orderUid).trim(),
                              trrUid: resolveTrrUid(transaction) || undefined,
                              trrUids: normalizeTrrUidList(transaction),
                              bountyPaid: returnMoney?.bountyPaid ?? transaction.bounty_paid ?? 0,
                              rawRow: transaction,
                            });
                            return;
                          }
                          openOrderDetail({ orderUid });
                        };

                        return (
                          <View key={rowKey} style={styles.transactionRow}>
                            <Text style={styles.transactionDate}>{formatTransactionDate(transaction)}</Text>
                            {showPurchasesTxnIdColumn ? (
                              <TouchableOpacity onPress={openPurchaseRowDetail} activeOpacity={0.7} disabled={orderUid === "—"}>
                                <Text style={[styles.transactionId, orderUid !== "—" && styles.receiptLink]}>{isSyntheticReturn ? orderUid : transaction.transaction_uid || "N/A"}</Text>
                              </TouchableOpacity>
                            ) : null}
                            {showPurchasesTypeColumn ? <Text style={styles.transactionPurchaseType}>{isReturnRow ? "Return" : transaction.purchase_type || "N/A"}</Text> : null}
                            <View style={{ flex: 1, paddingHorizontal: 4, justifyContent: "center", minWidth: 0 }}>
                              <TouchableOpacity onPress={() => navigateToPurchaseSeller(navigation, transaction)} activeOpacity={0.7} disabled={!sellerId}>
                                <Text style={[styles.transactionBusiness, sellerId ? styles.receiptLink : null]} numberOfLines={4}>
                                  {transaction.business_name || transaction.transaction_business_name || "N/A"}
                                </Text>
                              </TouchableOpacity>
                            </View>
                            {showPurchasesItemColumn ? (
                              <View style={styles.transactionPurchasedItemCell}>
                                {isReturnRow ? (
                                  <TouchableOpacity onPress={openPurchaseRowDetail} activeOpacity={0.7}>
                                    <Text style={[styles.transactionPurchasedItem, styles.receiptLink]} numberOfLines={4}>
                                      {formatPurchasedItemDisplay(transaction.purchased_item) || "View return"}
                                    </Text>
                                  </TouchableOpacity>
                                ) : (
                                  <TouchableOpacity onPress={() => fetchReceipt(transaction)} activeOpacity={0.7}>
                                    <Text style={[styles.transactionPurchasedItem, styles.receiptLink]} numberOfLines={4}>
                                      {formatPurchasedItemDisplay(transaction.purchased_item) || "View receipt"}
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            ) : null}
                            {!compactTx && (
                              <Text style={[styles.transactionQty, isReturnRow && { color: "#B71C1C" }]}>
                                {isReturnRow ? Math.abs(parseInt(transaction.ti_bs_qty, 10) || 1) : transaction.ti_bs_qty || 1}
                              </Text>
                            )}
                            {(() => {
                              const txnUid = String(transaction.original_transaction_uid || transaction.transaction_uid || "").trim();
                              const statusOverride = isReturnRow
                                ? {
                                    ...getReturnStatusOverrideForRow(returnStatuses, transaction, orderUid, txnUid),
                                    returnRequested: true,
                                  }
                                : getReturnStatusOverrideFromCache(returnStatuses, orderUid, txnUid);
                              const deliveredLabel = getBuyerPurchaseDeliveredLabel(transaction, statusOverride, orderShippingProgressByKey);
                              const receivedLabel = getBuyerPurchaseReceivedLabel(transaction, statusOverride);
                              const deliveredBadge = getProductSaleStatusBadgeStyle("delivered", deliveredLabel);
                              const canVerifyReceipt = buyerPurchaseNeedsReceiptVerification(transaction, receivedLabel, deliveredLabel, orderShippingProgressByKey);
                              const receivedDisplayLabel = canVerifyReceipt ? "Verify" : receivedLabel;
                              const receivedBadge = getProductSaleStatusBadgeStyle("received", canVerifyReceipt ? "verify" : receivedLabel);

                              const renderBadge = (label, badgeStyle) => (
                                <View style={[styles.purchaseStatusBadge, badgeStyle.badge]}>
                                  <Text style={[styles.purchaseStatusBadgeText, badgeStyle.text]} numberOfLines={1}>
                                    {label}
                                  </Text>
                                </View>
                              );

                              const openVerifyReceipt = () => openDeliveryVerification(transaction);

                              return (
                                <>
                                  <View style={styles.transactionDeliveredCell}>
                                    {isReturnRow ? (
                                      <TouchableOpacity onPress={openPurchaseRowDetail} activeOpacity={0.7}>
                                        {renderBadge(deliveredLabel, deliveredBadge)}
                                      </TouchableOpacity>
                                    ) : canVerifyReceipt ? (
                                      <TouchableOpacity onPress={openVerifyReceipt} activeOpacity={0.7}>
                                        {renderBadge(deliveredLabel, deliveredBadge)}
                                      </TouchableOpacity>
                                    ) : (
                                      renderBadge(deliveredLabel, deliveredBadge)
                                    )}
                                  </View>
                                  <View style={styles.transactionReceivedCell}>
                                    {canVerifyReceipt ? (
                                      <TouchableOpacity onPress={openVerifyReceipt} activeOpacity={0.7}>
                                        {renderBadge(receivedDisplayLabel, receivedBadge)}
                                      </TouchableOpacity>
                                    ) : isReturnRow ? (
                                      <TouchableOpacity onPress={openPurchaseRowDetail} activeOpacity={0.7}>
                                        {renderBadge(receivedLabel, receivedBadge)}
                                      </TouchableOpacity>
                                    ) : (
                                      renderBadge(receivedLabel, receivedBadge)
                                    )}
                                  </View>
                                </>
                              );
                            })()}
                            <TouchableOpacity onPress={openPurchaseRowDetail} activeOpacity={0.7} disabled={orderUid === "—"}>
                              <Text style={[styles.transactionAmount, isReturnRow && { color: "#B71C1C" }, orderUid !== "—" && styles.receiptLink]}>{formatSignedOrderMoney(displayAmount)}</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <View>
                      <Text style={styles.noDataText}>No transaction data available.</Text>
                      <Text style={styles.noDataText}>Transaction data length: {transactionData.length}</Text>
                      <Text style={styles.noDataText}>Transaction loading: {transactionLoading.toString()}</Text>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Bounties (earnings chart) */}
            <View style={styles.sectionContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowNetEarning(!showNetEarning)}>
                <Text style={styles.sectionHeaderText}>EARNINGS</Text>
                <Ionicons name={showNetEarning ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showNetEarning && (
                <>
                  {bountyLoading ? (
                    <Text style={styles.loadingText}>Loading earnings...</Text>
                  ) : bountyData?.error ? (
                    <Text style={styles.errorText}>Unable to load earnings.</Text>
                  ) : (
                    <View style={styles.balanceSectionBody}>
                      <View style={styles.balanceContainer}>
                        <Text style={[styles.sectionLabel, { color: darkMode ? "#e0e0e0" : "#333" }]}>Total bounties earned</Text>
                        <Text style={[styles.balanceAmount, { color: darkMode ? "#fff" : "#000" }]}>${Number(bountyData?.total_bounty_earned ?? 0).toFixed(2)}</Text>
                      </View>
                      <View style={styles.walletBalanceRow}>
                        <View style={styles.walletBalanceLabelCol}>
                          <Text style={[styles.sectionLabel, { color: darkMode ? "#e0e0e0" : "#333" }]}>Useable</Text>
                          <Text style={[styles.walletBalanceHint, darkMode && { color: "#aaa" }]}>Ready to use on purchases</Text>
                        </View>
                        <Text style={[styles.balanceAmount, { color: darkMode ? "#81c784" : "#2e7d32" }]}>${personalUseableBountyTotal.toFixed(2)}</Text>
                      </View>
                      {personalPendingBountyTotal > 0 ? (
                        <View style={styles.walletBalanceRow}>
                          <View style={styles.walletBalanceLabelCol}>
                            <Text style={[styles.sectionLabel, { color: darkMode ? "#e0e0e0" : "#333" }]}>Pending</Text>
                            <Text style={[styles.walletBalanceHint, darkMode && { color: "#aaa" }]}>Earned but not yet available — waiting for delivery confirmation or return window</Text>
                          </View>
                          <Text style={[styles.balanceAmount, { color: darkMode ? "#ffb74d" : "#e65100" }]}>${personalPendingBountyTotal.toFixed(2)}</Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                  <NetEarningChart />
                </>
              )}
            </View>

            {/* Wallet */}
            <View style={styles.sectionContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowWallet(!showWallet)}>
                <Text style={styles.sectionHeaderText}>WALLET</Text>
                <Ionicons name={showWallet ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showWallet && (
                <>
                  {bountyLoading ? (
                    <Text style={styles.loadingText}>Loading wallet...</Text>
                  ) : bountyData?.error ? (
                    <Text style={styles.errorText}>Unable to load wallet.</Text>
                  ) : personalWallet ? (
                    <View style={styles.balanceSectionBody}>
                      <View style={styles.walletBalanceRow}>
                        <View style={styles.walletBalanceLabelCol}>
                          <Text style={[styles.sectionLabel, { color: darkMode ? "#e0e0e0" : "#333" }]}>Available to spend</Text>
                          <Text style={[styles.walletBalanceHint, darkMode && { color: "#aaa" }]}>Ready to use on purchases</Text>
                        </View>
                        <Text style={[styles.balanceAmount, { color: darkMode ? "#81c784" : "#2e7d32" }]}>{formatWalletUsd(personalWallet.wallet_useable_balance)}</Text>
                      </View>
                      <View style={styles.walletBalanceRow}>
                        <View style={styles.walletBalanceLabelCol}>
                          <Text style={[styles.sectionLabel, { color: darkMode ? "#e0e0e0" : "#333" }]}>Pending</Text>
                          <Text style={[styles.walletBalanceHint, darkMode && { color: "#aaa" }]}>Earned but not yet available — waiting for delivery confirmation or return window</Text>
                        </View>
                        <Text style={[styles.balanceAmount, { color: darkMode ? "#ffb74d" : "#e65100" }]}>{formatWalletUsd(personalWallet.wallet_pending)}</Text>
                      </View>
                      <View style={styles.walletBalanceRow}>
                        <View style={styles.walletBalanceLabelCol}>
                          <Text style={[styles.sectionLabel, { color: darkMode ? "#e0e0e0" : "#333" }]}>Total on hand</Text>
                        </View>
                        <Text style={[styles.balanceAmount, { color: darkMode ? "#fff" : "#000" }]}>{formatWalletUsd(personalWallet.wallet_actual_balance)}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.noDataText}>No wallet data available.</Text>
                  )}
                </>
              )}
            </View>

            {/* Bounty Results */}
            <View style={styles.sectionContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowBountyResults(!showBountyResults)}>
                <Text style={styles.sectionHeaderText}>BOUNTY RESULTS</Text>
                <Ionicons name={showBountyResults ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showBountyResults && (
                <>
                  {bountyLoading ? (
                    <Text style={styles.loadingText}>Loading bounty data...</Text>
                  ) : bountyData?.error ? (
                    <Text style={styles.errorText}>Error: {bountyData.error}</Text>
                  ) : bountyData?.data ? (
                    <View>
                      {/* Totals */}
                      <View style={styles.bountyTotals}>
                        <Text style={styles.bountyTotalText}>Total Transactions: {bountyData.total_bounties}</Text>
                        <Text style={styles.bountyTotalText}>Total Earned: ${bountyData.total_bounty_earned?.toFixed(2)}</Text>
                      </View>
                      {/* Table — same layout as Transaction History (full-width rows) */}
                      <View style={styles.transactionsContainer}>
                        <View style={styles.transactionHeaderRow}>
                          {showPurchasesTxnIdColumn ? <Text style={styles.transactionHeaderId}>ID</Text> : null}
                          <Text style={styles.transactionHeaderDate}>Date</Text>
                          <Text style={styles.transactionHeaderBusiness}>Purchaser</Text>
                          <Text style={styles.transactionHeaderPurchasedItem}>Business</Text>
                          <Text style={styles.transactionHeaderPaid}>Status</Text>
                          <Text style={styles.transactionHeaderTotalBounty}>Total</Text>
                          <Text style={styles.transactionHeaderSharePct}>%</Text>
                          <Text style={styles.transactionHeaderAmount}>Bounty</Text>
                        </View>
                        {bountyData.data.map((item, index) => {
                          const linkedTxnUid = String(item.ti_transaction_id || item.transaction_uid || "").trim();
                          const linkedTxn = linkedTxnUid ? transactionData.find((t) => String(t.transaction_uid || "").trim() === linkedTxnUid) : null;
                          const enrichedItem = linkedTxn
                            ? {
                                ...item,
                                ti_received_qty: item.ti_received_qty ?? linkedTxn.ti_received_qty ?? linkedTxn.received_item_count,
                                ti_bs_qty: item.ti_bs_qty ?? linkedTxn.ti_bs_qty ?? linkedTxn.item_count,
                                ti_bs_return_window_days: item.ti_bs_return_window_days ?? linkedTxn.ti_bs_return_window_days ?? linkedTxn.return_window_days,
                                ti_bs_is_returnable: item.ti_bs_is_returnable ?? linkedTxn.ti_bs_is_returnable ?? linkedTxn.is_returnable,
                                bounty_released_at: item.bounty_released_at ?? linkedTxn.bounty_released_at,
                              }
                            : item;
                          const proceedsStatus = bountyProceedsStatus(enrichedItem, ledgerAvailabilityByTxnUid, walletLedgerRows);
                          const statusLabel = bountyProceedsStatusLabel(proceedsStatus);
                          const bountyDisplay = resolveBountyResultsRowDisplay(item);
                          const totalLabel = bountyDisplay?.lineBounty != null && bountyDisplay.lineBounty > 0 ? `$${bountyDisplay.lineBounty.toFixed(2)}` : "—";
                          const percentLabel = formatBountySharePercentLabel(bountyDisplay?.percentage) || "—";
                          const earnedAmount = bountyDisplay?.earned != null ? bountyDisplay.earned : parseFloat(item.bounty_earned || 0) || 0;
                          return (
                            <View key={item.tb_uid || item.ti_transaction_id || index} style={styles.transactionRow}>
                              {showPurchasesTxnIdColumn ? <Text style={styles.transactionId}>{item.ti_transaction_id || item.ti_uid || "N/A"}</Text> : null}
                              <Text style={styles.transactionDate}>{formatTransactionDate(item)}</Text>
                              <Text style={styles.transactionBusiness} numberOfLines={4}>
                                {item.purchaser_name || item.transaction_profile_id || "N/A"}
                              </Text>
                              <Text style={styles.transactionPurchasedItem} numberOfLines={4}>
                                {item.display_name || item.transaction_business_id || "N/A"}
                              </Text>
                              <View style={styles.transactionPaidCell}>
                                <Text style={styles.transactionPaidText}>{statusLabel}</Text>
                              </View>
                              <Text style={styles.transactionTotalBounty}>{totalLabel}</Text>
                              <Text style={styles.transactionSharePct}>{percentLabel}</Text>
                              <Text style={styles.transactionAmount}>${earnedAmount.toFixed(2)}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.noDataText}>No bounty data available.</Text>
                  )}
                </>
              )}
            </View>

            {/* Wallet Ledger */}
            <View style={styles.sectionContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowWalletLedger(!showWalletLedger)}>
                <Text style={styles.sectionHeaderText}>WALLET LEDGER</Text>
                <Ionicons name={showWalletLedger ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showWalletLedger && (
                <>
                  {walletLedgerLoading ? (
                    <Text style={styles.loadingText}>Loading wallet ledger...</Text>
                  ) : walletLedgerError ? (
                    <Text style={styles.errorText}>{walletLedgerError}</Text>
                  ) : walletLedgerRows.length > 0 ? (
                    <View>
                      {walletLedgerTotalEntries > walletLedgerRows.length ? (
                        <Text style={styles.bountyTotalText}>
                          Showing {walletLedgerRows.length} of {walletLedgerTotalEntries} entries
                        </Text>
                      ) : null}
                      <View style={styles.transactionsContainer}>
                        <View style={styles.transactionHeaderRow}>
                          <Text style={styles.transactionHeaderDate}>Date</Text>
                          <Text style={styles.transactionHeaderId}>Transaction ID</Text>
                          <Text style={[styles.transactionHeaderBusiness, { flex: 1 }]}>Type</Text>
                          <Text style={[styles.transactionHeaderPurchasedItem, { flex: 1.2 }]}>Description</Text>
                          <Text style={[styles.transactionHeaderAmount, { flex: 0.75 }]}>Pending</Text>
                          <Text style={[styles.transactionHeaderAmount, { flex: 0.75 }]}>Useable</Text>
                          <Text style={[styles.transactionHeaderAmount, { flex: 0.85 }]}>Total Balance</Text>
                          <Text style={[styles.transactionHeaderAmount, { flex: 0.95 }]}>Spendable Balance</Text>
                        </View>
                        {walletLedgerRows.map((entry, index) => {
                          const isPending = entry.availability === "pending";
                          const isUseable = entry.availability === "useable";
                          const pendingAmount = isPending ? entry.amount : null;
                          const useableAmount = isUseable ? entry.amount : null;
                          const pendingColor = ledgerAmountColor(pendingAmount, darkMode);
                          const useableColor = ledgerAmountColor(useableAmount, darkMode);
                          const ledgerOrderUid =
                            resolveOrderUidForTransactionUid(entry.transaction_uid, transactionData, bountyData?.data, sellerTxData, businessSellerTransactionList) ||
                            (String(entry.transaction_uid || "").startsWith("500-") ? String(entry.transaction_uid).trim() : null);
                          const openLedgerEntry = () => {
                            if (!ledgerOrderUid) return;
                            const scopedLedgerEntries = filterWalletLedgerEntriesForOrder(walletLedgerRows, ledgerOrderUid);
                            openOrderDetail(
                              { orderUid: ledgerOrderUid },
                              {
                                isSellerView: true,
                                walletLedgerEntries: scopedLedgerEntries.length ? scopedLedgerEntries : [entry],
                                highlightLedgerEntryId: entry.entry_id || null,
                                ledgerEntry: entry,
                              },
                            );
                          };
                          const LedgerRowWrapper = ledgerOrderUid ? TouchableOpacity : View;
                          const ledgerRowProps = ledgerOrderUid ? { onPress: openLedgerEntry, activeOpacity: 0.7 } : {};
                          return (
                            <LedgerRowWrapper key={entry.entry_id || `ledger-${index}`} style={styles.transactionRow} {...ledgerRowProps}>
                              <Text style={styles.transactionDate}>{formatLedgerEntryDate(entry)}</Text>
                              <Text style={[styles.transactionId, ledgerOrderUid && styles.receiptLink]} numberOfLines={1}>
                                {entry.transaction_uid || "—"}
                              </Text>
                              <Text style={[styles.transactionBusiness, { flex: 1 }]} numberOfLines={2}>
                                {entry.entry_type_label || entry.entry_type || "—"}
                              </Text>
                              <Text style={[styles.transactionPurchasedItem, { flex: 1.2 }, ledgerOrderUid && styles.receiptLink]} numberOfLines={3}>
                                {entry.description || entry.counterparty_name || "—"}
                              </Text>
                              <Text style={[styles.transactionAmount, { flex: 0.75 }, pendingColor ? { color: pendingColor } : null]}>{formatLedgerColumnAmount(pendingAmount)}</Text>
                              <Text style={[styles.transactionAmount, { flex: 0.75 }, useableColor ? { color: useableColor } : null]}>{formatLedgerColumnAmount(useableAmount)}</Text>
                              <Text style={[styles.transactionAmount, { flex: 0.85 }]}>{formatWalletUsd(entry.balance_after)}</Text>
                              <Text style={[styles.transactionAmount, { flex: 0.95 }]}>{formatWalletUsd(entry.useable_balance_after)}</Text>
                            </LedgerRowWrapper>
                          );
                        })}
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.noDataText}>No wallet ledger entries.</Text>
                  )}
                </>
              )}
            </View>
          </>
        ) : (
          <>
            {/* Product Sales formerly Product Results / Business Bounty Results */}
            <View style={styles.sectionContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowProductResults(!showProductResults)}>
                <Text style={styles.sectionHeaderText}>PRODUCT SALES</Text>
                <Ionicons name={showProductResults ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showProductResults && (
                <>
                  {businessBountyLoading ? (
                    <Text style={styles.loadingText}>Loading product sales...</Text>
                  ) : businessBountyData?.error ? (
                    <Text style={styles.errorText}>Error: {businessBountyData.error}</Text>
                  ) : productSalesSummary.length > 0 ? (
                    <View>
                      <View style={styles.productSalesTableHeader}>
                        <Text style={[styles.productSalesHeaderCell, styles.productSalesHeaderCellProduct]}>Product</Text>
                        <Text style={styles.productSalesHeaderCell}>UID</Text>
                        <Text style={styles.productSalesHeaderCell}>Units sold</Text>
                        <Text style={styles.productSalesHeaderCell}>Available</Text>
                        <Text style={styles.productSalesHeaderCell}>Revenue</Text>
                        <Text style={styles.productSalesHeaderCell}>Bounty paid</Text>
                      </View>
                      {productSalesSummary.map((product) => (
                        <TouchableOpacity key={product.productUid} style={styles.productSalesTableRow} onPress={() => openProductSalesModal(product)} activeOpacity={0.7}>
                          <Text style={[styles.productSalesCell, styles.productSalesCellProduct, styles.productSalesCellLink]} numberOfLines={2}>
                            {product.productName}
                          </Text>
                          <Text style={styles.productSalesCell}>{product.productUid}</Text>
                          <Text style={styles.productSalesCell}>{product.unitsSold}</Text>
                          <Text style={[styles.productSalesCell, product.unitsAvailable === "0" && { color: "#c00", fontWeight: "600" }]}>{product.unitsAvailable}</Text>
                          <Text style={styles.productSalesCell}>${product.revenue.toFixed(2)}</Text>
                          <Text style={styles.productSalesCell}>${product.bountyPaid.toFixed(2)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noDataText}>No product sales available.</Text>
                  )}
                </>
              )}
            </View>

            {/* Orders */}
            <View style={styles.sectionContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowBusinessOrders(!showBusinessOrders)}>
                <Text style={styles.sectionHeaderText}>ORDERS</Text>
                <Ionicons name={showBusinessOrders ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showBusinessOrders && (
                <>
                  {businessBountyLoading ? (
                    <Text style={styles.loadingText}>Loading orders...</Text>
                  ) : businessBountyData?.error ? (
                    <Text style={styles.errorText}>Error: {businessBountyData.error}</Text>
                  ) : businessOrdersSummary.length > 0 ? (
                    <BusinessOrdersTable rows={businessOrdersSummary} darkMode={darkMode} maxBodyHeight={360} onOrderPress={openOrderDetail} onReturnPress={openReturnDetails} />
                  ) : (
                    <Text style={styles.noDataText}>No orders available.</Text>
                  )}
                </>
              )}
            </View>

            {/* Bounties (business net earnings chart) */}
            <View style={styles.sectionContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowBusinessNetEarning(!showBusinessNetEarning)}>
                <Text style={styles.sectionHeaderText}>BOUNTIES</Text>
                <Ionicons name={showBusinessNetEarning ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showBusinessNetEarning && (
                <>
                  {businessTransactionLoading ? (
                    <Text style={styles.loadingText}>Loading earnings...</Text>
                  ) : (
                    <View style={styles.balanceSectionBody}>
                      <View style={styles.balanceContainer}>
                        <Text style={[styles.sectionLabel, { color: darkMode ? "#e0e0e0" : "#333" }]}>Total net earnings</Text>
                        <Text style={[styles.balanceAmount, { color: darkMode ? "#fff" : "#000" }]}>${businessNetEarningsTotal.toFixed(2)}</Text>
                      </View>
                    </View>
                  )}
                  <BusinessNetEarningChart />
                </>
              )}
            </View>

            {/* Business purchases */}
            <View style={styles.sectionContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowBusinessTransactionHistory(!showBusinessTransactionHistory)}>
                <Text style={styles.sectionHeaderText}>BUSINESS PURCHASES</Text>
                <Ionicons name={showBusinessTransactionHistory ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showBusinessTransactionHistory && (
                <>
                  {businessTransactionLoading ? (
                    <Text style={styles.loadingText}>Loading business transaction data...</Text>
                  ) : businessTransactionData.length > 0 ? (
                    <View style={styles.transactionsContainer}>
                      {/* Table Header */}
                      <View style={styles.transactionHeaderRow}>
                        <Text style={styles.transactionHeaderDate}>Date</Text>
                        <Text style={styles.transactionHeaderId}>Transaction ID</Text>
                        <Text style={styles.transactionHeaderPurchaseType}>Type</Text>
                        <Text style={styles.transactionHeaderBusiness}>Seller</Text>
                        <Text style={styles.transactionHeaderPurchasedItem}>Item</Text>
                        <Text style={styles.transactionHeaderQty}>Qty</Text>
                        <Text style={styles.transactionHeaderPaid}>Paid</Text>
                        <Text style={styles.transactionHeaderAmount}>Amount</Text>
                      </View>
                      {/* Table Rows */}
                      {businessTransactionData.map((transaction, i) => {
                        const isExpanded = expandedTransactionId === transaction.transaction_uid;

                        // Get services for this transaction from businessBountyData
                        //const transactionServices = businessBountyData?.data?.filter((item) => item.transaction_uid === transaction.transaction_uid) || [];

                        const transactionServices =
                          businessReceiptCache[transaction.transaction_uid] || businessBountyData?.data?.filter((item) => item.transaction_uid === transaction.transaction_uid) || [];
                        // Seller Business Purchases: only trust API return fields (or cache when API
                        // already says a return exists). Do not invent a return from:
                        // - buyer-local returnRequests leftovers
                        // - unrelated display_status / lifecycle strings on the sale row
                        // - stale return_status_* AsyncStorage alone
                        const apiReturnRequested = Number(transaction.transaction_return_requested) === 1;
                        const rowReturnLogistics = resolveReturnLogisticsLabels(transaction);
                        const returnLogistics =
                          apiReturnRequested || rowReturnLogistics
                            ? getReturnLogisticsForCachedUid(transaction, returnStatuses, transaction.transaction_uid) ||
                              rowReturnLogistics ||
                              (apiReturnRequested ? resolveReturnLogisticsLabels(transaction, { returnRequested: 1 }) : null)
                            : null;
                        const hasCustomerReturnRequest = apiReturnRequested || !!returnLogistics;
                        const awaitingReturnAction = returnLogistics?.return_status === "returning" && returnLogistics?.refund_status === "pending";
                        const returnRefunded = returnLogistics?.refund_status === "refunded";
                        const showReturnCompletedRow = returnRefunded || returnLogistics?.return_status === "returned";

                        return (
                          <View key={`${transaction.transaction_uid || "biz-tx"}-${i}`}>
                            {/* Main Transaction Row */}
                            <TouchableOpacity
                              style={[
                                styles.businessTransactionRow,
                                awaitingReturnAction && {
                                  backgroundColor: "#FDECEA",
                                  borderLeftWidth: 4,
                                  borderLeftColor: "#b35454",
                                },
                              ]}
                              onPress={async () => {
                                if (isExpanded) {
                                  setExpandedTransactionId(null);
                                  return;
                                }
                                await prefetchBusinessReceiptForTransaction(transaction);
                                setExpandedTransactionId(transaction.transaction_uid);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.businessTransactionCell}>{formatTransactionDate(transaction)}</Text>
                              <Text style={styles.businessTransactionCell}>
                                {transaction.transaction_uid || "N/A"} {isExpanded ? "▲" : "▼"}
                              </Text>

                              <Text style={styles.businessTransactionCell}>{transaction.transaction_profile_id?.substring(0, 10) || "N/A"}</Text>
                              <Text style={styles.businessTransactionCell}>${transaction.transaction_total.toFixed(2)}</Text>
                              <Text style={styles.businessTransactionCell}>${transaction.bounty_paid.toFixed(2)}</Text>
                              <Text
                                style={[
                                  styles.businessTransactionCell,
                                  {
                                    color: showReturnCompletedRow ? "#B71C1C" : "#333",
                                  },
                                ]}
                              >
                                {showReturnCompletedRow ? `-$${transaction.transaction_taxes.toFixed(2)}` : `$${transaction.transaction_taxes.toFixed(2)}`}
                              </Text>
                              <Text style={[styles.businessTransactionCell, { width: 55, flex: 0, textAlign: "right" }]}>
                                {transaction.proceeds_status && transaction.proceeds_status !== "useable"
                                  ? bountyProceedsStatusLabel(transaction.proceeds_status)
                                  : `$${transaction.net_earning.toFixed(2)}`}
                              </Text>
                            </TouchableOpacity>

                            {/* Expanded Services Details */}
                            {isExpanded && (
                              <View style={styles.expandedServicesContainer}>
                                {transactionServices.length > 0 ? (
                                  <>
                                    {/* Services Header */}
                                    <View style={styles.servicesHeaderRow}>
                                      <Text style={styles.servicesHeaderCell}>Product UID</Text>
                                      <Text style={styles.servicesHeaderCell}>Product Name</Text>
                                      <Text style={styles.servicesHeaderCell}>Cost</Text>
                                      <Text style={styles.servicesHeaderCell}>Bounty</Text>
                                      <Text style={styles.servicesHeaderCell}>Qty</Text>
                                      <Text style={styles.servicesHeaderCell}>Bounty Paid</Text>
                                    </View>
                                    {/* Services Rows */}
                                    {transactionServices.map((service, idx) => (
                                      <View key={idx} style={styles.servicesRow}>
                                        <Text style={styles.servicesCell}>{service.ti_bs_id || service.bs_uid || "N/A"}</Text>
                                        <Text style={styles.servicesCell}>{service.bs_service_name || "N/A"}</Text>
                                        <Text style={styles.servicesCell}>${parseFloat(service.ti_bs_cost || service.bs_cost || 0).toFixed(2)}</Text>
                                        <Text style={styles.servicesCell}>{service.ti_bs_qty || 0}</Text>
                                      </View>
                                    ))}
                                  </>
                                ) : (
                                  <Text style={styles.noServicesText}>No services data available</Text>
                                )}
                                {/* Return request indicator */}
                                {hasCustomerReturnRequest && (
                                  <TouchableOpacity
                                    style={{
                                      marginTop: 8,
                                      padding: 8,
                                      backgroundColor: "#FDECEA",
                                      borderRadius: 6,
                                      borderWidth: 1,
                                      borderColor: "#B71C1C",
                                      flexDirection: "row",
                                      alignItems: "center",
                                    }}
                                    onPress={() =>
                                      openReturnDetails({
                                        orderUid: transaction.transaction_uid,
                                        listTransactionUid: transaction.transaction_uid,
                                        bountyPaid: transaction.bounty_paid,
                                        rawRow: transaction,
                                      })
                                    }
                                  >
                                    <Ionicons name='return-down-back-outline' size={14} color='#B71C1C' style={{ marginRight: 6 }} />
                                    <Text style={{ color: "#B71C1C", fontSize: 12, fontWeight: "600" }}>Return Requested by Customer — Tap for Return Details</Text>
                                  </TouchableOpacity>
                                )}
                                {showReturnCompletedRow && (
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      paddingVertical: 8,
                                      paddingHorizontal: 4,
                                      backgroundColor: "#FDECEA",
                                      borderLeftWidth: 4,
                                      borderLeftColor: "#B71C1C",
                                      marginTop: 4,
                                      borderRadius: 4,
                                    }}
                                  >
                                    <Text style={{ flex: 1, fontSize: 11, color: "#B71C1C", textAlign: "center" }}>RETURN</Text>
                                    <Text style={{ flex: 1, fontSize: 11, color: "#B71C1C", textAlign: "center" }}>{formatTransactionDate(transaction)}</Text>
                                    <Text style={{ flex: 1, fontSize: 11, color: "#B71C1C", textAlign: "center" }}>Refund</Text>
                                    <Text style={{ flex: 1, fontSize: 11, color: "#B71C1C", textAlign: "center" }}>—</Text>
                                    <Text style={{ flex: 1, fontSize: 11, color: "#B71C1C", textAlign: "center" }}>—</Text>
                                    <Text style={{ flex: 1, fontSize: 11, color: "#B71C1C", textAlign: "center" }}>—</Text>
                                    <Text style={{ width: 55, flex: 0, fontSize: 11, color: "#B71C1C", textAlign: "right" }}>-${transaction.transaction_taxes.toFixed(2)}</Text>
                                  </View>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <View>
                      <Text style={styles.noDataText}>No business transaction data available.</Text>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Product Inventory — catalog of products the business offers */}
            <View style={styles.sectionContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowProductInventory(!showProductInventory)}>
                <Text style={styles.sectionHeaderText}>PRODUCT INVENTORY</Text>
                <Ionicons name={showProductInventory ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showProductInventory && (
                <>
                  {businessBountyLoading ? (
                    <Text style={styles.loadingText}>Loading product inventory...</Text>
                  ) : productInventorySummary.length > 0 ? (
                    <View>
                      <View style={styles.productSalesTableHeader}>
                        <Text style={[styles.productSalesHeaderCell, styles.productSalesHeaderCellProduct]}>Product</Text>
                        <Text style={styles.productSalesHeaderCell}>UID</Text>
                        <Text style={styles.productSalesHeaderCell}>SKU</Text>
                        <Text style={styles.productSalesHeaderCell}>Cost</Text>
                        <Text style={styles.productSalesHeaderCell}>Bounty</Text>
                        <Text style={styles.productSalesHeaderCell}>Available</Text>
                      </View>
                      {productInventorySummary.map((product) => (
                        <View key={product.key} style={styles.productSalesTableRow}>
                          <Text style={[styles.productSalesCell, styles.productSalesCellProduct]} numberOfLines={2}>
                            {product.productName}
                          </Text>
                          <Text style={styles.productSalesCell}>{product.productUid}</Text>
                          <Text style={styles.productSalesCell}>{product.sku}</Text>
                          <Text style={styles.productSalesCell}>{product.costLabel}</Text>
                          <Text style={styles.productSalesCell}>{product.bountyLabel}</Text>
                          <Text style={[styles.productSalesCell, product.unitsAvailable === "0" && { color: "#c00", fontWeight: "600" }]}>{product.unitsAvailable}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noDataText}>No products in inventory.</Text>
                  )}
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <BottomNavBar navigation={navigation} />

      {/* Receipt Modal */}
      <Modal animationType='fade' transparent={true} visible={showReceiptModal} onRequestClose={() => setShowReceiptModal(false)}>
        <View style={[styles.receiveItemModalOverlay, darkMode && styles.darkModalOverlay]}>
          <View style={[styles.receiptModalContent, darkMode && styles.darkModalContent]}>
            <Text style={[styles.receiveItemModalHeader, darkMode && styles.darkTitle, { textAlign: "center" }]}>Transaction Receipt</Text>

            {receiptLoading ? (
              <ActivityIndicator size='large' color='#18884A' style={{ marginVertical: 24 }} />
            ) : receiptData.length > 0 ? (
              <>
                <ScrollView style={styles.receiptScrollView} contentContainerStyle={styles.receiptScrollViewContent}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.receiptTableWrap}>
                      <View style={styles.receiptTableHeader}>
                        <Text style={[styles.receiptHeaderCell, styles.receiptHeaderCellItem]}>Item</Text>
                        <Text style={[styles.receiptHeaderCell, styles.receiptHeaderCellQty]}>Qty</Text>
                        <Text style={[styles.receiptHeaderCell, styles.receiptHeaderCellBounty]}>Bounty</Text>
                        <Text style={[styles.receiptHeaderCell, styles.receiptHeaderCellShare]}>Your Share</Text>
                        <Text style={[styles.receiptHeaderCell, styles.receiptHeaderCellCost]}>Unit</Text>
                        <Text style={[styles.receiptHeaderCell, styles.receiptHeaderCellCost]}>Total</Text>
                        <Text style={[styles.receiptHeaderCell, styles.receiptHeaderCellShipping]}>Shipping</Text>
                      </View>

                      {receiptData.map((item, index) => {
                        const baseCost = parseFloat(item.ti_bs_cost || 0);
                        const qty = parseInt(item.ti_bs_qty || 1, 10);
                        const tiUid = item.ti_uid != null ? String(item.ti_uid).trim() : "";
                        const bountyRow = findBountyResultForReceiptLine(bountyData?.data, item, receiptTransaction?.transaction_uid);
                        const bountyDisplay = resolveReceiptLineBountyDisplay(item, bountyRow);
                        const bountyCell = bountyDisplay?.lineBounty != null && bountyDisplay.lineBounty > 0 ? `$${bountyDisplay.lineBounty.toFixed(2)}` : "—";
                        const shareCell = bountyDisplay?.earned != null ? `$${bountyDisplay.earned.toFixed(2)}` : "—";
                        const sharePct =
                          bountyDisplay?.percentage != null
                            ? bountyDisplay.percentage > 0 && bountyDisplay.percentage <= 1
                              ? `${Math.round(bountyDisplay.percentage * 1000) / 10}%`
                              : `${Math.round(bountyDisplay.percentage * 10) / 10}%`
                            : null;
                        const moneyCellColor = darkMode ? "#ddd" : "#333";
                        const moneyMetaColor = darkMode ? "#aaa" : "#666";
                        const shippingCell = formatOrderShippingCell(getOrderLineShippingAmount(item, qty), false);

                        const enrich = {
                          ...(receiptEnrichedItems[tiUid] || enrichFromReceiptRow(item) || receiptEnrichedItems[item.ti_bs_id] || receiptEnrichedItems[item.bs_uid] || {}),
                          ...(Array.isArray(item.selected_options) && item.selected_options.length > 0 ? { selected_options: item.selected_options } : {}),
                        };

                        if (isOfferingReceipt) {
                          const offeringName = String(item.bs_service_name || item.bs_service_desc || "N/A").trim() || "N/A";
                          const costString = enrich.offeringCostString || Object.values(receiptEnrichedItems).find((e) => e && e.offeringCostString)?.offeringCostString || "";
                          const qtyTypeLabel = getOfferingQtyTypeLabel(costString);
                          const lineTotal = baseCost * qty;
                          return (
                            <View key={item.ti_uid || item.ti_bs_id || index} style={styles.receiptTableRow}>
                              <View style={styles.receiptTableCellItem}>
                                <Text style={{ fontSize: 12, color: darkMode ? "#eee" : "#333", lineHeight: 17 }} numberOfLines={3}>
                                  {offeringName}
                                </Text>
                                {qtyTypeLabel ? <Text style={{ fontSize: 10, color: darkMode ? "#aaa" : "#777", fontStyle: "italic", lineHeight: 14 }}>{qtyTypeLabel}</Text> : null}
                              </View>
                              <Text style={[styles.receiptTableCell, styles.receiptTableCellQty, styles.receiptMoneyText, { color: moneyCellColor }]} numberOfLines={1}>
                                {qty}
                              </Text>
                              <Text style={[styles.receiptTableCell, styles.receiptTableCellBounty, styles.receiptMoneyText, { color: moneyCellColor }]} numberOfLines={1}>
                                {bountyCell}
                              </Text>
                              <View style={styles.receiptTableCellShare}>
                                <Text style={[styles.receiptTableCell, styles.receiptMoneyText, { color: moneyCellColor, width: "100%", textAlign: "right", paddingHorizontal: 0 }]} numberOfLines={1}>
                                  {shareCell}
                                </Text>
                                {sharePct && shareCell !== "—" ? <Text style={{ fontSize: 9, color: moneyMetaColor, textAlign: "right", lineHeight: 12 }}>{sharePct}</Text> : null}
                              </View>
                              <Text style={[styles.receiptTableCell, styles.receiptTableCellCost, styles.receiptMoneyText, { color: moneyCellColor }]} numberOfLines={1}>
                                ${baseCost.toFixed(2)}
                              </Text>
                              <Text style={[styles.receiptTableCell, styles.receiptTableCellCost, styles.receiptMoneyText, { fontWeight: "600", color: moneyCellColor }]} numberOfLines={1}>
                                ${lineTotal.toFixed(2)}
                              </Text>
                              <Text style={[styles.receiptTableCell, styles.receiptTableCellShipping, styles.receiptMoneyText, { color: moneyCellColor }]} numberOfLines={1}>
                                {shippingCell}
                              </Text>
                            </View>
                          );
                        }

                        const unitPrice = getReceiptLineUnitPrice(item, enrich);
                        const lineTotal = unitPrice * qty;
                        const summaryDescription = String(item.bs_service_desc || item.bs_service_name || "N/A").trim() || "N/A";

                        return (
                          <View key={item.ti_uid || item.ti_bs_id || index} style={styles.receiptTableRow}>
                            <View style={styles.receiptTableCellItem}>
                              <ProductOrderSummaryLines
                                description={summaryDescription}
                                baseCost={baseCost}
                                choiceSource={enrich}
                                specialInstructions={enrich.specialInstructions}
                                baseTextStyle={{ fontSize: 12, color: darkMode ? "#eee" : "#333", lineHeight: 17, marginBottom: 2 }}
                                choiceTextStyle={{ fontSize: 10, color: darkMode ? "#ccc" : "#555", lineHeight: 14 }}
                                noteTextStyle={{
                                  fontSize: 10,
                                  color: darkMode ? "#aaa" : "#888",
                                  fontStyle: "italic",
                                  lineHeight: 14,
                                  marginTop: 2,
                                }}
                              />
                            </View>
                            <Text style={[styles.receiptTableCell, styles.receiptTableCellQty, styles.receiptMoneyText, { color: moneyCellColor }]} numberOfLines={1}>
                              {qty}
                            </Text>
                            <Text style={[styles.receiptTableCell, styles.receiptTableCellBounty, styles.receiptMoneyText, { color: moneyCellColor }]} numberOfLines={1}>
                              {bountyCell}
                            </Text>
                            <View style={styles.receiptTableCellShare}>
                              <Text style={[styles.receiptTableCell, styles.receiptMoneyText, { color: moneyCellColor, width: "100%", textAlign: "right", paddingHorizontal: 0 }]} numberOfLines={1}>
                                {shareCell}
                              </Text>
                              {sharePct && shareCell !== "—" ? <Text style={{ fontSize: 9, color: moneyMetaColor, textAlign: "right", lineHeight: 12 }}>{sharePct}</Text> : null}
                            </View>
                            <Text style={[styles.receiptTableCell, styles.receiptTableCellCost, styles.receiptMoneyText, { color: moneyCellColor }]} numberOfLines={1}>
                              ${unitPrice.toFixed(2)}
                            </Text>
                            <Text style={[styles.receiptTableCell, styles.receiptTableCellCost, styles.receiptMoneyText, { fontWeight: "600", color: moneyCellColor }]} numberOfLines={1}>
                              ${lineTotal.toFixed(2)}
                            </Text>
                            <Text style={[styles.receiptTableCell, styles.receiptTableCellShipping, styles.receiptMoneyText, { color: moneyCellColor }]} numberOfLines={1}>
                              {shippingCell}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </ScrollView>
                <ReceiptTransactionTotalsFooter receiptRows={receiptData} transactionFallback={receiptTransaction} darkMode={darkMode} />
              </>
            ) : (
              <Text style={[styles.noDataText, { marginVertical: 24 }]}>No receipt data available.</Text>
            )}

            {/* Return requested confirmation message */}
            {(returnRequests[resolveListRowOrderUid(receiptTransaction)]?.requested || receiptTransaction?.transaction_return_requested === 1) && (
              <Text style={{ color: "#B71C1C", textAlign: "center", marginTop: 12, fontWeight: "600", fontSize: 14 }}>✓ Return has been requested</Text>
            )}

            {!receiptIsReturnReceipt &&
              (() => {
                const orderUid = resolveListRowOrderUid(receiptTransaction);
                const returnModalLines = resolveReturnModalOrderLines(receiptOrderDetail, receiptData);
                const existingReturnRows = getExistingReturnRowsForOrder(transactionData, orderUid);
                const selectableLines = buildReturnModalSelectableLines(returnModalLines, receiptData, returnRequests[orderUid], existingReturnRows);
                const allItemsReturned = selectableLines.length > 0 && selectableLines.every((line) => line.remainingQty <= 0);
                const hasEligibleReturnItem = selectableLines.some((line) => line.remainingQty > 0 && line.returnEligible);
                const returnButtonDisabled = allItemsReturned || !hasEligibleReturnItem;

                return (
                  <TouchableOpacity
                    style={[styles.receiptCloseButton, { borderColor: "#B71C1C", marginTop: 12 }, returnButtonDisabled && { opacity: 0.4 }]}
                    disabled={returnButtonDisabled}
                    onPress={() => {
                      if (!returnButtonDisabled) openReturnNoteModalFromReceipt();
                    }}
                  >
                    <Text style={[styles.receiptCloseButtonText, { color: "#B71C1C" }]}>
                      {allItemsReturned ? "All Items Returned" : !hasEligibleReturnItem ? "No Items Eligible for Return" : "Request Return"}
                    </Text>
                  </TouchableOpacity>
                );
              })()}

            {/* Request Return button */}
            {/* <TouchableOpacity
              style={[
                styles.receiptCloseButton,
                { borderColor: "#B71C1C", marginTop: 12 },
                returnRequests[receiptTransaction?.transaction_uid] && { opacity: 0.4 },
              ]}
              onPress={() => {
                if (!returnRequests[receiptTransaction?.transaction_uid]) {
                  handleReturnRequest(receiptTransaction);
                }
              }}
              disabled={!!(returnRequests[receiptTransaction?.transaction_uid] || receiptTransaction?.transaction_return_requested === 1)}
            >
              <Text style={[styles.receiptCloseButtonText, { color: "#B71C1C" }]}>
                {returnRequests[receiptTransaction?.transaction_uid] ? "Return Requested" : "Request Return"}
              </Text>
            </TouchableOpacity> */}

            <TouchableOpacity style={[styles.receiptCloseButton, darkMode && styles.darkCancelButton]} onPress={() => setShowReceiptModal(false)}>
              <Text style={[styles.receiptCloseButtonText, darkMode && styles.darkCancelButtonText]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Return Note Input Modal */}
      <Modal
        animationType='fade'
        transparent={true}
        visible={showReturnNoteModal}
        onRequestClose={() => {
          if (returnSubmitLoading) return;
          setShowReturnNoteModal(false);
          setReturnNote("");
          setSelectedReturnItems([]);
          setReturnItemQuantities({});
          setReturnItemSplitQty({});
          setReturnSubmitLoading(false);
        }}
      >
        <View style={[styles.receiveItemModalOverlay, darkMode && styles.darkModalOverlay]}>
          <View style={[styles.receiveItemModalContent, darkMode && styles.darkModalContent, { maxHeight: "80%" }]}>
            <Text style={[styles.receiveItemModalHeader, { color: "#B71C1C" }, darkMode && styles.darkTitle]}>Request Return</Text>

            {returnModalLoading || returnSubmitLoading ? (
              <View style={{ alignItems: "center", marginVertical: 24 }}>
                <ActivityIndicator size='large' color='#B71C1C' />
                {returnSubmitLoading ? <Text style={{ fontSize: 14, color: darkMode ? "#ccc" : "#555", marginTop: 12, textAlign: "center" }}>Submitting return request...</Text> : null}
              </View>
            ) : (
              <>
                {/* Item selection */}
                <Text style={{ fontSize: 14, color: darkMode ? "#ccc" : "#555", marginBottom: 8 }}>Select item(s) to return:</Text>
                <ScrollView style={{ maxHeight: 220, marginBottom: 12 }}>
                  {buildReturnModalSelectableLines(
                    returnModalOrderLines,
                    returnModalReceiptData,
                    returnRequests[resolveListRowOrderUid(receiptTransaction)],
                    getExistingReturnRowsForOrder(transactionData, resolveListRowOrderUid(receiptTransaction)),
                  ).map((row) => {
                    const itemId = row.itemId;
                    const isSelected = selectedReturnItems.includes(itemId);
                    const purchasedQty = row.purchasedQty;
                    const remainingQty = row.remainingQty;
                    const alreadyReturned = remainingQty <= 0;
                    const returnIneligible = !row.returnEligible;
                    const selectionDisabled = alreadyReturned || returnIneligible;
                    const caps = getReturnModalLineFulfillmentCaps(row);
                    const qtyLabels = getReturnModalQtyLabels(row.line);
                    const split = returnItemSplitQty[itemId] || initialReturnItemSplitQty(row);
                    const needsMixedQtyPicker = isSelected && caps.hasMixedFulfillment;
                    const simplePickerMax = caps.allUnshipped ? caps.maxCancelUnshippedQty : caps.maxReturnShippedQty;
                    const needsSimpleQtyPicker = isSelected && !caps.hasMixedFulfillment && caps.remainingQty > 1 && simplePickerMax > 1;
                    const fulfillmentSubtitle = !alreadyReturned && !returnIneligible ? buildReturnModalFulfillmentSubtitle(row, caps) : null;

                    return (
                      <View
                        key={itemId}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 4,
                          borderBottomWidth: 1,
                          borderBottomColor: darkMode ? "#444" : "#eee",
                          opacity: selectionDisabled ? 0.4 : 1,
                        }}
                      >
                        <TouchableOpacity
                          disabled={selectionDisabled}
                          style={{ flexDirection: "row", alignItems: "flex-start" }}
                          onPress={() => {
                            if (selectionDisabled) return;
                            if (isSelected) {
                              setSelectedReturnItems((prev) => prev.filter((id) => id !== itemId));
                              setReturnItemQuantities((prev) => {
                                const next = { ...prev };
                                delete next[itemId];
                                return next;
                              });
                              setReturnItemSplitQty((prev) => {
                                const next = { ...prev };
                                delete next[itemId];
                                return next;
                              });
                            } else {
                              setSelectedReturnItems((prev) => [...prev, itemId]);
                              setReturnItemSplitQty((prev) => ({
                                ...prev,
                                [itemId]: initialReturnItemSplitQty(row),
                              }));
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={isSelected ? "checkbox" : "square-outline"}
                            size={18}
                            color={selectionDisabled ? "#999" : isSelected ? "#B71C1C" : "#555"}
                            style={{ marginRight: 8, marginTop: 1 }}
                          />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ fontSize: 13, color: selectionDisabled ? (darkMode ? "#888" : "#777") : darkMode ? "#fff" : "#333" }}>
                              {row.itemName} — ${parseFloat(row.unitCost || 0).toFixed(2)} x {purchasedQty}
                            </Text>
                            {fulfillmentSubtitle ? <Text style={{ fontSize: 11, color: darkMode ? "#aaa" : "#666", marginTop: 2 }}>{fulfillmentSubtitle}</Text> : null}
                          </View>
                          {alreadyReturned ? (
                            <Text style={{ fontSize: 11, color: "#B71C1C", marginLeft: 4 }}>Already returned</Text>
                          ) : returnIneligible ? (
                            <Text style={{ fontSize: 11, color: darkMode ? "#aaa" : "#666", marginLeft: 4 }}>{row.returnIneligibleReason || "Not eligible for return"}</Text>
                          ) : purchasedQty > remainingQty ? (
                            <Text style={{ fontSize: 11, color: "#888", marginLeft: 4 }}>{remainingQty} left</Text>
                          ) : null}
                        </TouchableOpacity>

                        {needsMixedQtyPicker ? (
                          <View style={{ marginTop: 8, marginLeft: 26 }}>
                            <Text style={{ fontSize: 12, color: darkMode ? "#ccc" : "#555", marginBottom: 6 }}>{qtyLabels.mixedIntro}</Text>
                            <ReturnModalQtyStepper
                              label={qtyLabels.leftShort}
                              value={split.shipped}
                              max={Math.min(caps.maxReturnShippedQty, Math.max(0, caps.remainingQty - split.unshipped))}
                              suffix={`up to ${caps.maxReturnShippedQty}`}
                              darkMode={darkMode}
                              onChange={(shipped) =>
                                setReturnItemSplitQty((prev) => ({
                                  ...prev,
                                  [itemId]: normalizeReturnItemSplitQty({ ...split, shipped }, caps),
                                }))
                              }
                            />
                            <ReturnModalQtyStepper
                              label={qtyLabels.notLeftShort}
                              value={split.unshipped}
                              max={Math.min(caps.maxCancelUnshippedQty, Math.max(0, caps.remainingQty - split.shipped))}
                              suffix={`up to ${caps.maxCancelUnshippedQty}`}
                              darkMode={darkMode}
                              onChange={(unshipped) =>
                                setReturnItemSplitQty((prev) => ({
                                  ...prev,
                                  [itemId]: normalizeReturnItemSplitQty({ ...split, unshipped }, caps),
                                }))
                              }
                            />
                          </View>
                        ) : null}

                        {needsSimpleQtyPicker ? (
                          <View style={{ marginTop: 8, marginLeft: 26 }}>
                            <ReturnModalQtyStepper
                              label={caps.allUnshipped ? qtyLabels.notLeftSimple : qtyLabels.leftSimple}
                              value={caps.allUnshipped ? split.unshipped : split.shipped}
                              max={simplePickerMax}
                              suffix={`of ${simplePickerMax}`}
                              darkMode={darkMode}
                              onChange={(qty) =>
                                setReturnItemSplitQty((prev) => ({
                                  ...prev,
                                  [itemId]: caps.allUnshipped ? { shipped: 0, unshipped: qty } : { shipped: qty, unshipped: 0 },
                                }))
                              }
                            />
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </ScrollView>

                {/* Note input */}
                <Text style={{ fontSize: 14, color: darkMode ? "#ccc" : "#555", marginBottom: 8 }}>Reason for return:</Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: "#ddd",
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    minHeight: 80,
                    textAlignVertical: "top",
                    backgroundColor: darkMode ? "#3a3a3a" : "#f9f9f9",
                    color: darkMode ? "#fff" : "#333",
                    marginBottom: 16,
                  }}
                  placeholder='Enter return reason...'
                  placeholderTextColor={darkMode ? "#888" : "#aaa"}
                  multiline
                  value={returnNote}
                  onChangeText={setReturnNote}
                />

                {selectedReturnItems.length === 0 && <Text style={{ color: "#B71C1C", fontSize: 12, marginBottom: 8, textAlign: "center" }}>Please select at least one item to return.</Text>}

                {(() => {
                  const orderUid = resolveListRowOrderUid(receiptTransaction);
                  const selectableLines = buildReturnModalSelectableLines(
                    returnModalOrderLines,
                    returnModalReceiptData,
                    returnRequests[orderUid],
                    getExistingReturnRowsForOrder(transactionData, orderUid),
                  );
                  const lineById = Object.fromEntries(selectableLines.map((line) => [line.itemId, line]));
                  const hasInvalidQty = selectedReturnItems.some((id) => {
                    const row = lineById[id];
                    if (!row || !row.returnEligible || row.remainingQty <= 0) return true;
                    const split = returnItemSplitQty[id] || initialReturnItemSplitQty(row);
                    return !isReturnItemSplitValid(row, split);
                  });
                  const canSubmitReturn = selectedReturnItems.length > 0 && !hasInvalidQty && !returnModalLoading && !returnSubmitLoading;

                  return (
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <TouchableOpacity
                        style={[styles.receiveItemModalButton, styles.receiveItemNoButton, darkMode && styles.darkCancelButton]}
                        disabled={returnSubmitLoading}
                        onPress={() => {
                          if (returnSubmitLoading) return;
                          setShowReturnNoteModal(false);
                          setReturnNote("");
                          setSelectedReturnItems([]);
                          setReturnItemQuantities({});
                          setReturnItemSplitQty({});
                          setReturnModalOrderLines([]);
                          setReturnSubmitLoading(false);
                        }}
                      >
                        <Text style={[styles.receiveItemModalButtonText, styles.receiveItemNoButtonText, darkMode && styles.darkCancelButtonText]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.receiveItemModalButton, { backgroundColor: canSubmitReturn ? "#B71C1C" : "#ccc" }]}
                        disabled={!canSubmitReturn}
                        onPress={async () => {
                          const transactionReturnItems = [];
                          for (const id of selectedReturnItems) {
                            const row = lineById[id];
                            if (!row || !row.returnEligible || row.remainingQty <= 0) {
                              Alert.alert("Item not eligible", row?.returnIneligibleReason || "This item cannot be returned.");
                              return;
                            }
                            if (!row.transactionItemUid) {
                              Alert.alert("Error", "Order line is missing ti_uid. Cannot submit return.");
                              return;
                            }
                            const split = returnItemSplitQty[id] || initialReturnItemSplitQty(row);
                            if (!isReturnItemSplitValid(row, split)) {
                              Alert.alert("Invalid quantities", "Please enter valid quantities for each group.");
                              return;
                            }
                            transactionReturnItems.push(buildTransactionReturnItemPayload(row, split));
                          }
                          if (transactionReturnItems.length === 0) {
                            Alert.alert("Error", "Could not build return items.");
                            return;
                          }
                          const { cancelOnly } = resolveReturnRequestCancelFlags(transactionReturnItems);
                          setReturnSubmitLoading(true);
                          try {
                            const ok = await handleReturnRequest(receiptTransaction, returnNote, transactionReturnItems, {
                              cancel_unshipped: cancelOnly,
                              cancel_only: cancelOnly,
                            });
                            if (!ok) return;
                            setShowReturnNoteModal(false);
                            setReturnNote("");
                            setSelectedReturnItems([]);
                            setReturnItemQuantities({});
                            setReturnItemSplitQty({});
                            setReturnModalOrderLines([]);
                          } finally {
                            setReturnSubmitLoading(false);
                          }
                        }}
                      >
                        <Text style={styles.receiveItemModalButtonText}>Submit</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Return Note Modal */}
      <Modal animationType='fade' transparent={true} visible={showReturnNoteViewModal} onRequestClose={() => setShowReturnNoteViewModal(false)}>
        <View style={[styles.receiveItemModalOverlay, darkMode && styles.darkModalOverlay]}>
          <View style={[styles.receiveItemModalContent, darkMode && styles.darkModalContent, { maxHeight: "85%" }]}>
            <Text style={[styles.receiveItemModalHeader, { color: "#B71C1C" }, darkMode && styles.darkTitle]}>Return Requests</Text>

            <ScrollView style={{ maxHeight: 400 }}>
              {(returnRequests[viewingReturnTransactionUid]?.notes?.length > 0 ? returnRequests[viewingReturnTransactionUid].notes : [{ note: viewingReturnNote, date: null, items: [] }]).map(
                (entry, idx) => {
                  // Look up the receipt items for this transaction from the cache
                  const cachedReceipt = businessReceiptCache[viewingReturnTransactionUid] || [];
                  const returnedItems = (entry.items || [])
                    .map((itemId) => {
                      const item = cachedReceipt[parseInt(itemId, 10)];
                      if (!item) return null;
                      const returnQty = entry.itemQuantities?.[itemId];
                      return { item, returnQty: returnQty != null && Number(returnQty) > 0 ? Math.round(Number(returnQty)) : getReceiptLineQty(item) };
                    })
                    .filter(Boolean);

                  return (
                    <View
                      key={idx}
                      style={{
                        borderWidth: 1,
                        borderColor: "#B71C1C",
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 12,
                        backgroundColor: darkMode ? "#3a3a3a" : "#fff5f5",
                      }}
                    >
                      {entry.date && <Text style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>{new Date(entry.date).toLocaleDateString()}</Text>}

                      {/* Show returned items */}
                      {returnedItems.length > 0 && (
                        <View style={{ marginBottom: 10 }}>
                          <Text style={{ fontSize: 12, fontWeight: "600", color: darkMode ? "#ccc" : "#555", marginBottom: 6 }}>Items to Return:</Text>
                          {returnedItems.map(({ item, returnQty }, itemIdx) => (
                            <View
                              key={itemIdx}
                              style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                backgroundColor: darkMode ? "#4a2a2a" : "#ffe8e8",
                                borderRadius: 4,
                                marginBottom: 4,
                              }}
                            >
                              <Text style={{ fontSize: 12, color: darkMode ? "#fff" : "#333", flex: 1 }}>{item.bs_service_name || "Item"}</Text>
                              <Text style={{ fontSize: 12, color: darkMode ? "#ccc" : "#666", marginHorizontal: 8 }}>x{returnQty}</Text>
                              <Text style={{ fontSize: 12, color: darkMode ? "#ccc" : "#666" }}>${parseFloat(item.ti_bs_cost || 0).toFixed(2)}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      <Text style={{ fontSize: 13, color: darkMode ? "#fff" : "#333", lineHeight: 20, marginBottom: 8 }}>{entry.note || "No reason provided."}</Text>

                      {/* Per-return Confirm/Reject (legacy note view) */}
                      {(() => {
                        const perKey = `${viewingReturnTransactionUid}_${idx}`;
                        const logistics = resolveReturnLogisticsLabels({}, getReturnStatusOverrideFromCache(returnStatuses, perKey, viewingReturnTransactionUid));
                        const decided = logistics && !(logistics.return_status === "returning" && logistics.refund_status === "pending");
                        if (decided) {
                          return (
                            <Text
                              style={{
                                fontWeight: "600",
                                fontSize: 13,
                                color: logistics.refund_status === "refunded" ? "#18884A" : logistics.refund_status === "stripe_fail" ? "#E65100" : "#B71C1C",
                              }}
                            >
                              {logistics.display_status || `${logistics.delivered} - ${logistics.received}`}
                            </Text>
                          );
                        }
                        return (
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <TouchableOpacity
                              style={{ flex: 1, padding: 10, borderRadius: 8, alignItems: "center", backgroundColor: "#18884A" }}
                              onPress={() => {
                                openConfirmReceiptNoteModal({
                                  transactionUid: returnDetailModal.orderUid || viewingReturnTransactionUid,
                                  orderUid: returnDetailModal.orderUid || viewingReturnTransactionUid,
                                  trrUid: returnDetailModal.trrUid || null,
                                  trrUids: returnDetailModal.trrUids || [],
                                  listIdx: idx,
                                });
                              }}
                            >
                              <Text style={{ color: "#fff", fontWeight: "bold" }}>Confirm receipt</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ flex: 1, padding: 10, borderRadius: 8, alignItems: "center", backgroundColor: "#B71C1C" }}
                              onPress={() => {
                                setPendingDeclineIdx(idx);
                                setDeclineNote("");
                                setShowDeclineNoteModal(true);
                              }}
                            >
                              <Text style={{ color: "#fff", fontWeight: "bold" }}>Reject</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })()}
                    </View>
                  );
                },
              )}
            </ScrollView>

            <TouchableOpacity style={[styles.receiptCloseButton, { borderColor: "#B71C1C" }]} onPress={() => setShowReturnNoteViewModal(false)}>
              <Text style={[styles.receiptCloseButtonText, { color: "#B71C1C" }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirm Receipt Note Modal — note stored on sale; ECTEST/PMTEST selects test Stripe account */}
      <Modal
        animationType='fade'
        transparent={true}
        visible={showConfirmReceiptNoteModal}
        onRequestClose={() => {
          if (returnDetailAccepting) return;
          setShowConfirmReceiptNoteModal(false);
          setConfirmReceiptNote("");
          setPendingConfirmReceipt(null);
        }}
      >
        <View style={[styles.receiveItemModalOverlay, darkMode && styles.darkModalOverlay]}>
          <View style={[styles.receiveItemModalContent, darkMode && styles.darkModalContent]}>
            <Text style={[styles.receiveItemModalHeader, { color: "#18884A" }, darkMode && styles.darkTitle]}>Confirm Receipt</Text>
            <Text style={{ fontSize: 14, color: darkMode ? "#ccc" : "#555", marginBottom: 8 }}>
              Add a note for this return (optional). Enter ECTEST or PMTEST to refund on the test Stripe account; otherwise EC / PM (live) is used.
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: "#ddd",
                borderRadius: 8,
                padding: 12,
                fontSize: 14,
                minHeight: 80,
                textAlignVertical: "top",
                backgroundColor: darkMode ? "#3a3a3a" : "#f9f9f9",
                color: darkMode ? "#fff" : "#333",
                marginBottom: 16,
              }}
              placeholder='e.g. Item received in good condition — or ECTEST'
              placeholderTextColor={darkMode ? "#888" : "#aaa"}
              multiline
              value={confirmReceiptNote}
              onChangeText={setConfirmReceiptNote}
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={[styles.receiveItemModalButton, styles.receiveItemNoButton, darkMode && styles.darkCancelButton]}
                disabled={returnDetailAccepting}
                onPress={() => {
                  setShowConfirmReceiptNoteModal(false);
                  setConfirmReceiptNote("");
                  setPendingConfirmReceipt(null);
                }}
              >
                <Text style={[styles.receiveItemModalButtonText, styles.receiveItemNoButtonText, darkMode && styles.darkCancelButtonText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.receiveItemModalButton, { backgroundColor: "#18884A" }, returnDetailAccepting && { opacity: 0.6 }]}
                disabled={returnDetailAccepting}
                onPress={submitConfirmReceiptWithNote}
              >
                {returnDetailAccepting ? <ActivityIndicator size='small' color='#fff' /> : <Text style={[styles.receiveItemModalButtonText, { color: "#fff" }]}>Confirm & refund</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Blocking overlay while confirm + inventory/sales refresh completes */}
      <Modal animationType='fade' transparent visible={returnDetailAccepting} onRequestClose={() => {}}>
        <View style={[styles.receiveItemModalOverlay, darkMode && styles.darkModalOverlay]}>
          <View style={[styles.receiveItemModalContent, darkMode && styles.darkModalContent, { alignItems: "center", maxWidth: 340 }]}>
            <ActivityIndicator size='large' color='#18884A' />
            <Text style={[styles.receiveItemModalHeader, { color: "#18884A", marginTop: 16, marginBottom: 8, textAlign: "center" }, darkMode && styles.darkTitle]}>Confirming return…</Text>
            <Text style={{ fontSize: 14, color: darkMode ? "#ccc" : "#555", textAlign: "center", lineHeight: 20 }}>Updating inventory and sales totals. Please wait a moment.</Text>
          </View>
        </View>
      </Modal>

      {/* Decline Note Modal */}
      <Modal animationType='fade' transparent={true} visible={showDeclineNoteModal} onRequestClose={() => setShowDeclineNoteModal(false)}>
        <View style={[styles.receiveItemModalOverlay, darkMode && styles.darkModalOverlay]}>
          <View style={[styles.receiveItemModalContent, darkMode && styles.darkModalContent]}>
            <Text style={[styles.receiveItemModalHeader, { color: "#B71C1C" }, darkMode && styles.darkTitle]}>Decline Reason</Text>
            <Text style={{ fontSize: 14, color: darkMode ? "#ccc" : "#555", marginBottom: 8 }}>Provide a reason for declining this return (optional):</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: "#ddd",
                borderRadius: 8,
                padding: 12,
                fontSize: 14,
                minHeight: 80,
                textAlignVertical: "top",
                backgroundColor: darkMode ? "#3a3a3a" : "#f9f9f9",
                color: darkMode ? "#fff" : "#333",
                marginBottom: 16,
              }}
              placeholder='Enter decline reason...'
              placeholderTextColor={darkMode ? "#888" : "#aaa"}
              multiline
              value={declineNote}
              onChangeText={setDeclineNote}
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={[styles.receiveItemModalButton, styles.receiveItemNoButton, darkMode && styles.darkCancelButton]}
                onPress={() => {
                  setShowDeclineNoteModal(false);
                  setDeclineNote("");
                  setPendingDeclineIdx(null);
                }}
              >
                <Text style={[styles.receiveItemModalButtonText, styles.receiveItemNoButtonText, darkMode && styles.darkCancelButtonText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.receiveItemModalButton, { backgroundColor: "#B71C1C" }]}
                onPress={async () => {
                  const idx = pendingDeclineIdx;
                  const orderUid = returnDetailModal.orderUid || viewingReturnTransactionUid || returnDetailModal.transactionUid;
                  const saleUid = String(orderUid || "").trim();
                  const trrUid = String(returnDetailModal.trrUid || "").trim();
                  const trrUids = normalizeTrrUidList(returnDetailModal.trrUids, trrUid, returnDetailModal.sourceReturnRow);
                  setReturnDetailDeclining(true);
                  try {
                    const outcome = await handleReturnDecline(saleUid, declineNote, saleUid, trrUid || null, trrUids);
                    if (outcome?.ok) {
                      if (idx != null) {
                        const statusIds = trrUids.length ? trrUids : trrUid ? [trrUid] : [];
                        setReturnStatuses((prev) => {
                          const next = { ...prev };
                          if (statusIds.length) {
                            statusIds.forEach((id) => {
                              next[id] = outcome.state;
                              next[`${id}_${idx}`] = outcome.state;
                            });
                            if (next[saleUid]) delete next[saleUid];
                          } else {
                            next[saleUid] = outcome.state;
                            next[`${saleUid}_${idx}`] = outcome.state;
                          }
                          return next;
                        });
                        for (const id of statusIds.length ? statusIds : [saleUid]) {
                          await AsyncStorage.setItem(`return_status_${id}_${idx}`, JSON.stringify(outcome.state));
                        }
                        if (statusIds.length) {
                          try {
                            await AsyncStorage.removeItem(`return_status_${saleUid}`);
                          } catch (_) {
                            /* ignore */
                          }
                        }
                      }
                      setReturnConfirmResult(outcome.result || outcome);
                      setReturnDetailModal((prev) =>
                        prev.visible
                          ? {
                              ...prev,
                              orderDetail: prev.orderDetail
                                ? {
                                    ...prev.orderDetail,
                                    sale: prev.orderDetail.sale ? applyReturnRefundFieldsToRow(prev.orderDetail.sale, outcome.state) : prev.orderDetail.sale,
                                    return_status: outcome.state?.return_status,
                                    refund_status: outcome.state?.refund_status,
                                    display_status: outcome.state?.display_status,
                                  }
                                : prev.orderDetail,
                            }
                          : prev,
                      );
                      setShowDeclineNoteModal(false);
                      setDeclineNote("");
                      setPendingDeclineIdx(null);
                    }
                  } finally {
                    setReturnDetailDeclining(false);
                  }
                }}
              >
                <Text style={styles.receiveItemModalButtonText}>Confirm Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Receive Item Confirmation Modal - for Seeking/Business + Pending transactions */}
      <Modal animationType='fade' transparent={true} visible={showReceiveItemModal} onRequestClose={resetDeliveryVerificationModal}>
        <View style={[styles.receiveItemModalOverlay, darkMode && styles.darkModalOverlay]}>
          <View style={[styles.receiveItemModalContent, darkMode && styles.darkModalContent, { maxHeight: "80%" }]}>
            <Text style={[styles.receiveItemModalHeader, darkMode && styles.darkTitle]}>Delivery Verification</Text>
            <Text style={[styles.receiveItemModalTitle, darkMode && styles.darkTitle]}>Select shipped item(s) you have received:</Text>

            {deliveryVerificationLoading ? (
              <ActivityIndicator size='small' color='#9C45F7' style={{ marginVertical: 24 }} />
            ) : (
              <ScrollView style={{ maxHeight: 260, marginBottom: 16 }}>
                {deliveryVerificationReceiptData.map((item, index) => {
                  const itemId = String(index);
                  const isSelected = selectedReceivedItems.includes(itemId);
                  const purchasedQty = getReceiptLineQty(item);
                  const alreadyReceivedQty = getPreviouslyReceivedQty(item);
                  const cancelledQty = getLineCancelledFromShipQty(item);
                  const remainingQty = getRemainingQtyToReceive(item);
                  const verifiableQty = getVerifiableReceiveRemaining(item, pendingTransactionForConfirm);
                  const fullyReceived = remainingQty <= 0;
                  const awaitingShipment = !fullyReceived && verifiableQty <= 0;
                  const canSelect = canSelectReceiptLineForVerification(item, pendingTransactionForConfirm);
                  const receivedQty = receivedItemQuantities[itemId] ?? verifiableQty;
                  const needsQtyPicker = isSelected && verifiableQty > 1;
                  const shipDisplay = formatLineFulfillmentDisplay(item);
                  const shippedQty = getLineShippedQty(item);
                  const cancelNote = shipDisplay.cancelNote || (cancelledQty > 0 ? `${cancelledQty}/${purchasedQty} cancelled` : "");
                  const showShipMeta =
                    orderNeedsShipping(item) ||
                    orderNeedsShipping(pendingTransactionForConfirm) ||
                    listRowHasExplicitShippingProgress(item) ||
                    shippedQty > 0 ||
                    cancelledQty > 0 ||
                    awaitingShipment ||
                    (shipDisplay.statusLabel && shipDisplay.statusLabel !== "—");

                  let shipStatusText = "Ready to verify";
                  if (awaitingShipment) {
                    shipStatusText =
                      shipDisplay.statusLabel === "—" || shipDisplay.statusLabel === "Not shipped" ? "Not shipped yet — verify after shipping" : `${shipDisplay.statusLabel} — verify after shipping`;
                  } else if (shipDisplay.statusLabel && shipDisplay.statusLabel !== "—") {
                    if (shipDisplay.statusLabel === "Shipped" && shippedQty > 0 && purchasedQty > 1) {
                      shipStatusText = `Shipped ${shippedQty}/${purchasedQty}`;
                    } else if (shipDisplay.statusLabel.includes("/") && !String(shipDisplay.statusLabel).startsWith("Shipped")) {
                      shipStatusText = `Shipped ${shipDisplay.statusLabel}`;
                    } else {
                      shipStatusText = shipDisplay.statusLabel;
                    }
                  }
                  const trackingLines =
                    !awaitingShipment && shipDisplay.trackingPairs?.length
                      ? shipDisplay.trackingPairs
                      : !awaitingShipment && shipDisplay.trackingLabel && shipDisplay.trackingLabel !== "—"
                        ? shipDisplay.trackingLabel
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        : [];
                  const shipMetaSubtextStyle = { fontSize: 11, color: darkMode ? "#aaa" : "#666", marginTop: 2 };

                  return (
                    <View
                      key={itemId}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 4,
                        borderBottomWidth: 1,
                        borderBottomColor: darkMode ? "#444" : "#eee",
                        opacity: fullyReceived || awaitingShipment ? 0.45 : 1,
                      }}
                    >
                      <TouchableOpacity
                        disabled={!canSelect}
                        style={{ flexDirection: "row", alignItems: "center" }}
                        onPress={() => {
                          if (!canSelect) return;
                          if (isSelected) {
                            setSelectedReceivedItems((prev) => prev.filter((id) => id !== itemId));
                            setReceivedItemQuantities((prev) => {
                              const next = { ...prev };
                              delete next[itemId];
                              return next;
                            });
                          } else {
                            setSelectedReceivedItems((prev) => [...prev, itemId]);
                            setReceivedItemQuantities((prev) => ({ ...prev, [itemId]: verifiableQty }));
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={fullyReceived ? "checkbox" : isSelected ? "checkbox" : "square-outline"}
                          size={18}
                          color={fullyReceived || isSelected ? "#9C45F7" : awaitingShipment ? "#aaa" : "#555"}
                          style={{ marginRight: 8 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, color: darkMode ? "#fff" : "#333" }}>
                            {item.bs_service_name || "Item"} — ${parseFloat(item.ti_bs_cost || 0).toFixed(2)} x {purchasedQty}
                          </Text>
                          {showShipMeta ? (
                            <View style={{ marginTop: 2 }}>
                              <Text style={shipMetaSubtextStyle}>
                                {shipStatusText}
                                {cancelNote ? ` · ${cancelNote}` : ""}
                              </Text>
                              {trackingLines.map((line, trackingIdx) => (
                                <Text key={`${itemId}-tracking-${trackingIdx}`} style={shipMetaSubtextStyle}>
                                  {line}
                                </Text>
                              ))}
                            </View>
                          ) : null}
                        </View>
                        {fullyReceived ? (
                          <Text style={{ fontSize: 11, color: "#9C45F7", marginLeft: 4 }}>{alreadyReceivedQty > 0 ? "Received" : cancelledQty >= purchasedQty ? "Cancelled" : "Shipped"}</Text>
                        ) : awaitingShipment ? (
                          <Text style={{ fontSize: 11, color: "#E65100", marginLeft: 4 }}>Awaiting ship</Text>
                        ) : alreadyReceivedQty > 0 || (shippedQty > 0 && shippedQty < purchasedQty) ? (
                          <Text style={{ fontSize: 11, color: "#888", marginLeft: 4 }}>{verifiableQty} to verify</Text>
                        ) : null}
                      </TouchableOpacity>

                      {needsQtyPicker && (
                        <View style={{ marginTop: 8, marginLeft: 26 }}>
                          <Text style={{ fontSize: 12, color: darkMode ? "#ccc" : "#555", marginBottom: 6 }}>How many did you receive?</Text>
                          <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <TouchableOpacity
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: darkMode ? "#555" : "#ccc",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: darkMode ? "#3a3a3a" : "#f5f5f5",
                              }}
                              onPress={() =>
                                setReceivedItemQuantities((prev) => ({
                                  ...prev,
                                  [itemId]: Math.max(1, (prev[itemId] ?? verifiableQty) - 1),
                                }))
                              }
                            >
                              <Text style={{ fontSize: 18, color: darkMode ? "#fff" : "#333" }}>−</Text>
                            </TouchableOpacity>
                            <TextInput
                              style={{
                                width: 48,
                                marginHorizontal: 10,
                                borderWidth: 1,
                                borderColor: darkMode ? "#555" : "#ccc",
                                borderRadius: 8,
                                paddingVertical: 6,
                                textAlign: "center",
                                fontSize: 14,
                                color: darkMode ? "#fff" : "#333",
                                backgroundColor: darkMode ? "#3a3a3a" : "#fff",
                              }}
                              value={String(receivedQty)}
                              onChangeText={(t) => {
                                const digits = t.replace(/[^0-9]/g, "");
                                const n = digits === "" ? "" : parseInt(digits, 10);
                                setReceivedItemQuantities((prev) => ({
                                  ...prev,
                                  [itemId]: n === "" ? "" : Math.min(verifiableQty, Math.max(1, n)),
                                }));
                              }}
                              keyboardType='number-pad'
                              maxLength={4}
                            />
                            <TouchableOpacity
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: darkMode ? "#555" : "#ccc",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: darkMode ? "#3a3a3a" : "#f5f5f5",
                              }}
                              onPress={() =>
                                setReceivedItemQuantities((prev) => ({
                                  ...prev,
                                  [itemId]: Math.min(verifiableQty, (prev[itemId] ?? verifiableQty) + 1),
                                }))
                              }
                            >
                              <Text style={{ fontSize: 18, color: darkMode ? "#fff" : "#333" }}>+</Text>
                            </TouchableOpacity>
                            <Text style={{ fontSize: 12, color: darkMode ? "#aaa" : "#666", marginLeft: 8 }}>of {verifiableQty} shipped</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {selectedReceivedItems.length === 0 && !deliveryVerificationLoading ? (
              <Text style={{ color: "#9C45F7", fontSize: 12, marginBottom: 12, textAlign: "center" }}>
                {deliveryVerificationReceiptData.some((line) => canSelectReceiptLineForVerification(line, pendingTransactionForConfirm))
                  ? "Please select at least one shipped item you received."
                  : deliveryVerificationReceiptData.length > 0 && deliveryVerificationReceiptData.every((line) => getRemainingQtyToReceive(line) <= 0)
                    ? "All receivable items on this order have been verified."
                    : "No shipped items available to verify yet."}
              </Text>
            ) : null}

            {(() => {
              const hasInvalidQty = selectedReceivedItems.some((id) => {
                const index = parseInt(id, 10);
                const item = deliveryVerificationReceiptData[index];
                if (!item) return true;
                const verifiableQty = getVerifiableReceiveRemaining(item, pendingTransactionForConfirm);
                if (verifiableQty <= 0) return true;
                const raw = receivedItemQuantities[id];
                const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
                if (verifiableQty > 1) {
                  return !Number.isFinite(n) || n < 1 || n > verifiableQty;
                }
                return false;
              });
              const canConfirmReceived = selectedReceivedItems.length > 0 && !hasInvalidQty && !deliveryVerificationLoading;

              return (
                <View style={styles.receiveItemModalButtons}>
                  <TouchableOpacity
                    style={[styles.receiveItemModalButton, styles.receiveItemNoButton, darkMode && styles.darkCancelButton]}
                    onPress={resetDeliveryVerificationModal}
                    disabled={updatingEscrow}
                  >
                    <Text style={[styles.receiveItemModalButtonText, styles.receiveItemNoButtonText, darkMode && styles.darkCancelButtonText]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.receiveItemModalButton, styles.receiveItemYesButton, !canConfirmReceived && { opacity: 0.5 }]}
                    disabled={!canConfirmReceived || updatingEscrow}
                    onPress={() => {
                      const transactionUid = pendingTransactionForConfirm?.transaction_uid;
                      if (!transactionUid) return;

                      const deliveryVerificationItems = [];
                      for (const id of selectedReceivedItems) {
                        const index = parseInt(id, 10);
                        const item = deliveryVerificationReceiptData[index];
                        if (!item) continue;
                        const transaction_item_uid = getReceiptLineTransactionItemUid(item);
                        if (!transaction_item_uid) {
                          Alert.alert("Error", "Receipt line is missing a transaction item id (ti_uid or ti_bs_id). Cannot confirm delivery.");
                          return;
                        }
                        const verifiableQty = getVerifiableReceiveRemaining(item, pendingTransactionForConfirm);
                        if (verifiableQty <= 0) {
                          Alert.alert("Not shipped yet", "You can only verify items after the seller has marked them shipped.");
                          return;
                        }
                        const raw = receivedItemQuantities[id];
                        const received_quantity = verifiableQty > 1 ? (typeof raw === "number" ? raw : parseInt(String(raw), 10) || 1) : Math.min(1, verifiableQty);
                        if (received_quantity < 1 || received_quantity > verifiableQty) continue;
                        deliveryVerificationItems.push({ transaction_item_uid, received_quantity });
                      }

                      if (deliveryVerificationItems.length === 0) {
                        Alert.alert("Error", "Could not build delivery verification items.");
                        return;
                      }

                      const releaseEscrow = areAllReceiptLinesFullyReceived(deliveryVerificationReceiptData, selectedReceivedItems, receivedItemQuantities);
                      updateTransactionEscrow(transactionUid, deliveryVerificationItems, releaseEscrow);
                    }}
                  >
                    {updatingEscrow ? <ActivityIndicator size='small' color='#fff' /> : <Text style={styles.receiveItemModalButtonText}>Confirm</Text>}
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Product Sales Detail Modal */}
      <Modal animationType='slide' transparent={true} visible={productSalesModal.visible} onRequestClose={closeProductSalesModal}>
        <View style={[styles.productSalesModalOverlay, darkMode && styles.darkModalOverlay]}>
          <View style={[styles.productSalesModalContent, darkMode && styles.darkModalContent]}>
            <Text style={[styles.productSalesModalTitle, darkMode && styles.darkTitle]}>Orders</Text>
            <Text style={[styles.productSalesModalSubtitle, darkMode && { color: "#aaa" }]}>
              {productSalesModal.product?.productName || "Product"} · {productSalesModal.product?.productUid || "—"}
            </Text>

            {productSalesModal.loading ? (
              <ActivityIndicator size='large' color='#18884A' style={{ marginVertical: 24 }} />
            ) : productSalesModal.sales?.length === 0 ? (
              <Text style={[styles.noDataText, darkMode && { color: "#aaa" }]}>No orders recorded for this product yet.</Text>
            ) : (
              <BusinessOrdersTable
                rows={buildProductSalesOrderRows(productSalesModal.product, businessSellerTransactionList, sellerOrderBountyRows, orderShippingProgressByKey, returnStatuses)}
                darkMode={darkMode}
                onOrderPress={openOrderDetail}
                onReturnPress={(row) => openReturnDetails(row, { isSellerView: true })}
              />
            )}

            <TouchableOpacity onPress={closeProductSalesModal} style={styles.productSalesModalCloseButton}>
              <Text style={styles.productSalesModalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <OrderDetailModal
        visible={orderDetailModal.visible}
        onClose={closeOrderDetailModal}
        orderUid={orderDetailModal.orderUid}
        orderDetail={orderDetailModal.orderDetail}
        loading={orderDetailModal.loading}
        error={orderDetailModal.error}
        isSellerView={orderDetailModal.isSellerView}
        darkMode={darkMode}
        onSaveFulfillment={saveOrderFulfillmentUpdates}
        bountyPaidFallback={orderDetailModal.bountyPaidFallback}
        walletLedgerEntries={orderDetailModal.walletLedgerEntries}
        highlightLedgerEntryId={orderDetailModal.highlightLedgerEntryId}
        bountyRows={resolveOrderDetailBountyRows(
          orderDetailModal.isSellerView,
          selectedAccount,
          bountyData,
          businessBountyData,
          sellerTxData,
          businessSellerTransactionList,
          orderDetailModal.orderDetail?.sale?.transaction_uid,
        )}
        sellerTransactionRows={sellerTxData}
      />

      <ReturnDetailsModal
        visible={returnDetailModal.visible}
        onClose={closeReturnDetailModal}
        orderUid={returnDetailModal.orderUid}
        orderDetail={returnDetailModal.orderDetail}
        loading={returnDetailModal.loading}
        error={returnDetailModal.error}
        darkMode={darkMode}
        isSellerView={returnDetailModal.isSellerView}
        trrUid={returnDetailModal.trrUid || null}
        trrUids={returnDetailModal.trrUids || []}
        returnTxnUid={returnDetailModal.returnTxnUid || null}
        sourceReturnRow={returnDetailModal.sourceReturnRow || null}
        statusOverride={getReturnStatusOverrideForRow(
          returnStatuses,
          {
            is_return: 1,
            is_pending_return: returnDetailModal.trrUid ? 1 : 0,
            trr_uid: returnDetailModal.trrUid,
            trr_uids: returnDetailModal.trrUids,
            transaction_uid: returnDetailModal.returnTxnUid || returnDetailModal.transactionUid,
            order_uid: returnDetailModal.orderUid,
            ...(returnDetailModal.sourceReturnRow || {}),
          },
          returnDetailModal.orderUid,
          returnDetailModal.transactionUid,
        )}
        bountyRows={returnDetailBountyRows}
        bountyPaidFallback={returnDetailModal.bountyPaidFallback}
        refundTotalFallback={returnDetailModal.refundTotalFallback}
        receivedItemKeys={returnReceivedItemKeys}
        onToggleReceivedItem={(itemKey) => {
          setReturnReceivedItemKeys((prev) => (prev.includes(itemKey) ? prev.filter((key) => key !== itemKey) : [...prev, itemKey]));
        }}
        restockCandidates={returnDetailRestockCandidates}
        restockQtyByKey={returnRestockQtyByKey}
        onRestockQtyChange={(itemKey, qty) => {
          setReturnRestockQtyByKey((prev) => ({ ...prev, [itemKey]: qty }));
        }}
        onRestockFillAll={() => {
          setReturnRestockQtyByKey((prev) => {
            const next = { ...prev };
            for (const candidate of returnDetailRestockCandidates) {
              next[candidate.key] = candidate.maxQty;
            }
            return next;
          });
        }}
        onRestockClearAll={() => {
          setReturnRestockQtyByKey((prev) => {
            const next = { ...prev };
            for (const candidate of returnDetailRestockCandidates) {
              next[candidate.key] = 0;
            }
            return next;
          });
        }}
        confirming={returnDetailAccepting}
        declining={returnDetailDeclining}
        confirmResult={returnConfirmResult}
        onConfirmReceipt={async () => {
          const saleUid = returnDetailModal.orderUid || returnDetailModal.transactionUid;
          const returnScope = {
            trrUid: returnDetailModal.trrUid || null,
            trrUids: returnDetailModal.trrUids || [],
            returnTxnUid: returnDetailModal.returnTxnUid || null,
            sourceReturnRow: returnDetailModal.sourceReturnRow || null,
          };
          const returnItems = buildReturnDetailDisplayItems(returnDetailModal.orderDetail, returnDetailBountyRows, returnScope);
          const splitInfo = analyzeReturnDetailSplit(returnItems);
          const returnReceiptItems = returnItems.filter((item) => item.returnKind === "return");
          const allReturnUnitsReceived = returnReceiptItems.length === 0 || returnReceiptItems.every((item) => returnReceivedItemKeys.includes(item.key));
          if (!saleUid) return;
          if (!splitInfo.cancelOnly && !allReturnUnitsReceived) return;
          const restockItems = buildRestockItemsPayload(returnDetailRestockCandidates, returnRestockQtyByKey);
          const receivedSplit = buildReturnReceivedSplitSummary(returnItems, returnReceivedItemKeys);
          openConfirmReceiptNoteModal({
            transactionUid: saleUid,
            orderUid: returnDetailModal.orderUid || saleUid,
            trrUid: returnDetailModal.trrUid || null,
            trrUids: returnDetailModal.trrUids || [],
            orderDetail: returnDetailModal.orderDetail,
            restockItems,
            receivedSplit,
          });
        }}
        onDecline={() => {
          setPendingDeclineIdx(null);
          setDeclineNote("");
          setViewingReturnTransactionUid(returnDetailModal.orderUid || returnDetailModal.transactionUid);
          setShowDeclineNoteModal(true);
        }}
      />

      {/* Sales Detail Modal */}
      <Modal animationType='slide' transparent={true} visible={salesModal.visible} onRequestClose={() => setSalesModal({ visible: false, item: null, transactions: [], loading: false })}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 20, width: "90%", maxHeight: "80%" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 4, color: "#222" }}>{salesModal.item?.name}</Text>
            <Text style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
              {salesModal.transactions?.length ? `${salesModal.transactions.length} purchase${salesModal.transactions.length !== 1 ? "s" : ""}` : "No purchases yet"}
            </Text>

            {salesModal.loading ? (
              <ActivityIndicator size='large' color='#18884A' style={{ marginVertical: 24 }} />
            ) : salesModal.transactions?.length === 0 ? (
              <Text style={{ color: "#888", fontStyle: "italic" }}>No one has purchased this offering yet.</Text>
            ) : (
              <BusinessOrdersTable
                rows={buildProductSalesOrderRows({ sales: salesModal.transactions || [] }, sellerTxData, bountyData?.data || [], orderShippingProgressByKey, returnStatuses)}
                darkMode={false}
                maxBodyHeight={360}
                onOrderPress={(row) => {
                  setSalesModal({ visible: false, item: null, transactions: [] });
                  openOrderDetail(row, { isSellerView: true });
                }}
                onReturnPress={(row) => {
                  setSalesModal({ visible: false, item: null, transactions: [] });
                  openReturnDetails(row, { isSellerView: true });
                }}
              />
            )}

            <TouchableOpacity
              onPress={() => setSalesModal({ visible: false, item: null, transactions: [], loading: false })}
              style={{ marginTop: 16, alignSelf: "center", paddingHorizontal: 32, paddingVertical: 10, backgroundColor: "#222", borderRadius: 8 }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FeedbackPopup visible={showFeedbackPopup} onClose={() => setShowFeedbackPopup(false)} pageName='Account' instructions={accountFeedbackInstructions} questions={accountFeedbackQuestions} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  darkContainer: {
    backgroundColor: "#1a1a1a",
  },
  contentContainer: { flex: 1, padding: 15 },
  scrollContentContainer: {
    paddingBottom: 120, // Extra padding to ensure content is visible above BottomNavBar
  },
  balanceContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  walletBalanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  walletBalanceLabelCol: {
    flex: 1,
    paddingRight: 12,
  },
  sectionLabel: { fontSize: 16, fontWeight: "600" },
  balanceAmount: { fontSize: 16, fontWeight: "600" },
  walletBalanceHint: { fontSize: 12, color: "#666", marginTop: 4, lineHeight: 16, flexShrink: 1 },
  balanceSectionBody: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sectionContainer: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  questionCircle: {
    width: 12,
    height: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 5,
  },
  questionMark: { fontSize: 8, fontWeight: "bold" },
  tableContainer: { backgroundColor: "transparent", paddingVertical: 6 },
  tableHeader: { flexDirection: "row", paddingVertical: 6 },
  tableHeaderText: { fontSize: 12, color: "#000" },
  tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  salesTableDataPressable: { flex: 5.8, flexDirection: "row", alignItems: "center" },
  tableCell: { fontSize: 12 },
  transactionsContainer: { backgroundColor: "transparent", paddingVertical: 6, alignSelf: "stretch", width: "100%" },
  transactionHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#18884A",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginBottom: 2,
  },
  transactionRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#eee" },
  transactionDate: { width: 60, fontSize: 11, color: "#333" },
  transactionId: { width: 95, fontSize: 11, color: "#333" },
  transactionPurchaseType: { width: 90, fontSize: 11, color: "#333", paddingHorizontal: 2 },
  transactionBusiness: { flex: 1, fontSize: 11, color: "#333", paddingHorizontal: 4 },
  transactionPurchasedItem: { flex: 1, fontSize: 11, color: "#333", paddingHorizontal: 4 },
  transactionAmount: { width: 70, fontSize: 11, color: "#333", textAlign: "right" },
  transactionTotalBounty: { width: 62, fontSize: 11, color: "#333", textAlign: "right", paddingHorizontal: 2 },
  transactionSharePct: { width: 44, fontSize: 11, color: "#333", textAlign: "center", paddingHorizontal: 2 },
  transactionPaid: { width: 60, fontSize: 11, color: "#333", textAlign: "center" },
  transactionPaidCell: { width: 60, justifyContent: "center", alignItems: "center" },
  transactionDeliveredCell: { width: 96, justifyContent: "center", alignItems: "center", paddingHorizontal: 2 },
  transactionReceivedCell: { width: 72, justifyContent: "center", alignItems: "center", paddingHorizontal: 2 },
  transactionPaidText: { fontSize: 11, color: "#333", textAlign: "center" },
  pendingLink: { fontSize: 11, color: "#007AFF", textDecorationLine: "underline", textAlign: "center", marginTop: 2 },
  buyerStatusStack: { alignItems: "center", justifyContent: "center", gap: 2 },
  buyerStatusTracking: { fontSize: 10, color: "#666", textAlign: "center", maxWidth: 90 },
  purchaseStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
    minWidth: 52,
    alignItems: "center",
  },
  purchaseStatusBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  // Header styles
  transactionHeaderDate: { width: 50, fontSize: 13, color: "#fff", fontWeight: "bold" },
  transactionHeaderId: { width: 100, fontSize: 13, color: "#fff", fontWeight: "bold" },
  transactionHeaderPurchaseType: { width: 90, fontSize: 13, color: "#fff", fontWeight: "bold", paddingHorizontal: 2 },
  transactionHeaderBusiness: { flex: 1, fontSize: 13, color: "#fff", fontWeight: "bold", paddingHorizontal: 4 },
  transactionHeaderPurchasedItem: { flex: 1, fontSize: 13, color: "#fff", fontWeight: "bold", paddingHorizontal: 4 },
  transactionHeaderAmount: { width: 70, fontSize: 13, color: "#fff", fontWeight: "bold", textAlign: "right" },
  transactionHeaderTotalBounty: { width: 62, fontSize: 13, color: "#fff", fontWeight: "bold", textAlign: "right", paddingHorizontal: 2 },
  transactionHeaderSharePct: { width: 44, fontSize: 13, color: "#fff", fontWeight: "bold", textAlign: "center", paddingHorizontal: 2 },
  transactionHeaderPaid: { width: 60, fontSize: 13, color: "#fff", fontWeight: "bold", textAlign: "center" },
  transactionHeaderDelivered: { width: 96, fontSize: 12, color: "#fff", fontWeight: "bold", textAlign: "center" },
  transactionHeaderReceived: { width: 72, fontSize: 12, color: "#fff", fontWeight: "bold", textAlign: "center" },
  centeredContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  bountyTotals: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
  },
  bountyTotalText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  loadingText: {
    color: "#888",
  },
  errorText: {
    color: "red",
  },
  noDataText: {
    color: "#6f6e6e",
  },
  // Dropdown styles
  dropdownButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownArrow: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  dropdownMenu: {
    position: "absolute",
    top: 42,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 140,
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.25)",
    ...(Platform.OS !== "web" && { elevation: 5 }),
    zIndex: 10000,
    pointerEvents: "auto",
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dropdownItemText: {
    fontSize: 15,
    color: "#333",
  },
  dropdownItemTextActive: {
    color: "#18884A",
    fontWeight: "600",
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 8,
  },
  transactionHeaderQty: {
    width: 50,
    fontSize: 13,
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  },
  transactionQty: {
    width: 50,
    fontSize: 11,
    color: "#333",
    textAlign: "center",
  },
  businessBountyTableHeader: {
    flexDirection: "row",
    backgroundColor: "#18884A",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginBottom: 2,
    minWidth: 700, //ensures table stretches
    width: "100%",
    flex: 1,
  },
  businessBountyHeaderCell: {
    //width: 100, // Keep fixed width for horizontal scroll
    flex: 1,
    fontSize: 12,
    color: "#fff",
    fontWeight: "bold",
    paddingHorizontal: 2,
    textAlign: "center",
  },
  businessBountyTableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    width: "100%",
    flex: 1,
  },
  businessBountyCell: {
    flex: 1,
    fontSize: 10,
    color: "#333",
    paddingHorizontal: 2,
    textAlign: "center",
  },
  productSalesTableHeader: {
    flexDirection: "row",
    backgroundColor: "#18884A",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginBottom: 2,
    width: "100%",
  },
  productSalesHeaderCell: {
    flex: 1,
    fontSize: 12,
    color: "#fff",
    fontWeight: "bold",
    paddingHorizontal: 2,
    textAlign: "center",
  },
  productSalesHeaderCellProduct: {
    flex: 1.6,
    textAlign: "left",
    paddingLeft: 6,
  },
  productSalesTableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    width: "100%",
    alignItems: "center",
  },
  productSalesCell: {
    flex: 1,
    fontSize: 11,
    color: "#333",
    paddingHorizontal: 2,
    textAlign: "center",
  },
  productSalesCellProduct: {
    flex: 1.6,
    textAlign: "left",
    paddingLeft: 6,
  },
  productSalesCellLink: {
    color: "#1a73e8",
    textDecorationLine: "underline",
  },
  productSalesModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  productSalesModalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "96%",
    maxWidth: 960,
    maxHeight: "88%",
  },
  productSalesModalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#222",
    marginBottom: 4,
  },
  productSalesModalSubtitle: {
    fontSize: 13,
    color: "#888",
    marginBottom: 20,
  },
  productSalesDetailTableScroll: {
    flexGrow: 0,
  },
  productSalesDetailTable: {
    minWidth: 804,
  },
  productSalesDetailHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    marginBottom: 4,
  },
  productSalesDetailHeaderRowDark: {
    borderBottomColor: "#444",
  },
  productSalesDetailHeaderCell: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
    paddingHorizontal: 6,
  },
  productSalesDetailBodyScroll: {
    maxHeight: 320,
  },
  productSalesDetailDataRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  productSalesDetailDataRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  productSalesDetailDataRowDark: {
    borderBottomColor: "#333",
  },
  productSalesDetailCell: {
    fontSize: 13,
    color: "#333",
    paddingHorizontal: 6,
  },
  productSalesDetailColOrder: {
    width: 118,
  },
  productSalesDetailColType: {
    width: 64,
  },
  productSalesDetailColPlacedBy: {
    width: 108,
  },
  productSalesDetailColDate: {
    width: 64,
  },
  productSalesDetailColQty: {
    width: 44,
    textAlign: "right",
  },
  productSalesDetailColTotal: {
    width: 96,
    textAlign: "right",
  },
  productSalesDetailColMoney: {
    width: 72,
    textAlign: "right",
  },
  productSalesDetailColStatus: {
    width: 104,
  },
  productSalesDetailColDaysOpen: {
    width: 76,
    textAlign: "right",
  },
  productSalesDetailTxnLink: {
    color: "#1a73e8",
    fontWeight: "500",
  },
  productSalesDetailOrderText: {
    fontWeight: "700",
    color: "#222",
  },
  productSalesDetailStatusCell: {
    alignItems: "center",
    justifyContent: "center",
  },
  productSalesDetailStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 72,
    alignItems: "center",
  },
  productSalesDetailStatusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  productSalesDetailTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  productSalesDetailTotalRowDark: {
    borderTopColor: "#444",
  },
  productSalesDetailTotalLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#222",
    paddingHorizontal: 6,
  },
  productSalesDetailTotalValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#222",
    paddingHorizontal: 6,
    textAlign: "right",
  },
  productSalesModalCloseButton: {
    marginTop: 16,
    alignSelf: "center",
    paddingHorizontal: 32,
    paddingVertical: 10,
    backgroundColor: "#222",
    borderRadius: 8,
  },
  productSalesModalCloseButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  businessOrderDetailModalContent: {
    maxWidth: 720,
  },
  businessOrderDetailScroll: {
    maxHeight: 460,
  },
  businessOrderDetailTable: {
    minWidth: 520,
    marginBottom: 8,
  },
  businessOrderDetailTableWithBounty: {
    minWidth: 780,
  },
  businessOrderDetailTableWithBuyerShare: {
    minWidth: 980,
  },
  businessOrderDetailHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    marginBottom: 4,
  },
  businessOrderDetailHeaderCell: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
    paddingHorizontal: 6,
    flexShrink: 0,
  },
  businessOrderDetailDataRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  businessOrderDetailColSelect: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  businessOrderDetailCell: {
    fontSize: 13,
    color: "#333",
    paddingHorizontal: 6,
    flexShrink: 0,
  },
  businessOrderDetailColProductId: {
    width: 104,
  },
  businessOrderDetailColDescription: {
    width: 200,
  },
  businessOrderDetailProductId: {
    fontWeight: "600",
  },
  businessOrderDetailProductName: {
    fontSize: 11,
    color: "#777",
    marginTop: 2,
  },
  orderDetailLineTableFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  orderDetailLineTableFooterLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#222",
    paddingHorizontal: 6,
  },
  orderDetailLineTableFooterValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#222",
    paddingHorizontal: 6,
    textAlign: "right",
  },
  orderDetailReturnBlock: {
    marginBottom: 14,
    paddingBottom: 4,
  },
  orderDetailReturnSubtitle: {
    marginBottom: 12,
    marginTop: -4,
  },
  businessOrderDetailColUnitCost: {
    width: 86,
    textAlign: "right",
  },
  businessOrderDetailColQty: {
    width: 72,
    textAlign: "right",
  },
  businessOrderDetailColBounty: {
    width: 72,
    textAlign: "right",
  },
  businessOrderDetailColBountyPct: {
    width: 78,
    textAlign: "right",
  },
  businessOrderDetailColShare: {
    width: 92,
    textAlign: "right",
  },
  businessOrderDetailColMoney: {
    width: 90,
    textAlign: "right",
  },
  businessOrderDetailColShipping: {
    width: 86,
    textAlign: "right",
  },
  businessOrderDetailTableWithFulfillment: {
    minWidth: 1360,
  },
  businessOrderDetailColShipped: {
    width: 112,
  },
  /** Carrier label + space + up to 40-digit tracking number at 12px. */
  businessOrderDetailColTracking: {
    width: 380,
  },
  businessOrderDetailTrackingText: {
    fontSize: 12,
    lineHeight: 16,
    color: "#333",
  },
  businessOrderDetailTrackingTextSpaced: {
    marginTop: 4,
  },
  businessOrderDetailTrackingExpandHint: {
    fontSize: 11,
    color: "#9C45F7",
    marginTop: 2,
  },
  businessOrderDetailColReturns: {
    width: 110,
    textAlign: "left",
  },
  businessOrderDetailReturnActive: {
    color: "#E65100",
    fontWeight: "600",
  },
  businessOrderDetailReturnRefunded: {
    color: "#B71C1C",
    fontWeight: "600",
  },
  businessOrderDetailReturnBanner: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#FFF3E0",
    color: "#E65100",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  businessOrderDetailReturnBannerAccepted: {
    backgroundColor: "#FDECEA",
    color: "#B71C1C",
  },
  orderDetailSectionCard: {
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fafafa",
  },
  orderDetailSectionCardDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  orderDetailSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#222",
    marginBottom: 6,
  },
  orderDetailSectionText: {
    fontSize: 13,
    color: "#444",
    marginBottom: 4,
  },
  orderDetailSectionNote: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    fontStyle: "italic",
  },
  orderDetailReturnLine: {
    fontSize: 12,
    color: "#555",
    marginTop: 4,
  },
  orderDetailReturnTotal: {
    fontSize: 14,
    fontWeight: "600",
    color: "#B71C1C",
    marginTop: 8,
    textAlign: "right",
  },
  orderDetailSummaryCard: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f9f9f9",
  },
  orderDetailSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderDetailSummaryRowTotal: {
    marginTop: 4,
    marginBottom: 0,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  orderDetailSummaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
  },
  orderDetailSummaryNet: {
    fontSize: 16,
    fontWeight: "700",
    color: "#18884A",
  },
  orderDetailSummarySectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 10,
    marginBottom: 6,
  },
  orderDetailShipRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  orderDetailShipRowBlock: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  orderDetailShipQtyPicker: {
    marginLeft: 30,
    marginBottom: 10,
  },
  orderDetailShipQtyLabel: {
    fontSize: 12,
    color: "#555",
    marginBottom: 6,
  },
  orderDetailShipQtyControls: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderDetailShipQtyButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
  },
  orderDetailShipQtyButtonDark: {
    borderColor: "#555",
    backgroundColor: "#3a3a3a",
  },
  orderDetailShipQtyButtonText: {
    fontSize: 18,
    color: "#333",
  },
  orderDetailShipQtyInput: {
    width: 48,
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    textAlign: "center",
    paddingVertical: 8,
    fontSize: 14,
    color: "#222",
    backgroundColor: "#fff",
  },
  orderDetailShipQtyHint: {
    marginLeft: 8,
    fontSize: 12,
    color: "#777",
  },
  orderDetailShipTrackingMeta: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },
  orderDetailShipFieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginTop: 14,
    marginBottom: 8,
  },
  orderDetailCarrierRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  orderDetailCarrierChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  orderDetailCarrierChipDark: {
    borderColor: "#555",
    backgroundColor: "#2a2a2a",
  },
  orderDetailCarrierChipSelected: {
    borderColor: "#9C45F7",
    backgroundColor: "#9C45F7",
  },
  orderDetailCarrierChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
  },
  orderDetailCarrierChipTextSelected: {
    color: "#fff",
  },
  orderDetailTrackingInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#222",
    backgroundColor: "#fff",
    marginBottom: 4,
  },
  orderDetailTrackingInputDark: {
    borderColor: "#555",
    backgroundColor: "#2a2a2a",
    color: "#eee",
  },
  orderDetailShipActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 14,
  },
  orderDetailShipSecondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#9C45F7",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  orderDetailShipSecondaryButtonText: {
    color: "#9C45F7",
    fontWeight: "600",
    fontSize: 14,
  },
  orderDetailShipSaveButton: {
    flex: 1,
    backgroundColor: "#9C45F7",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
  },
  orderDetailShipSaveButtonDisabled: {
    backgroundColor: "#B8B8B8",
  },
  orderDetailShipSaveButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  businessTransactionHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#18884A",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginBottom: 2,
    minWidth: 770,
    width: "100%",
    flex: 1,
  },
  businessTransactionHeaderCell: {
    //width: 110,
    flex: 1,
    fontSize: 12,
    color: "#fff",
    fontWeight: "bold",
    paddingHorizontal: 4,
    textAlign: "center",
  },
  businessTransactionRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    width: "100%",
    flex: 1,
  },
  businessTransactionCell: {
    //width: 110,
    flex: 1,
    fontSize: 11,
    color: "#333",
    paddingHorizontal: 4,
    textAlign: "center",
  },
  servicesHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#2a5a3a",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 4,
    marginBottom: 2,
    width: "100%",
    flex: 1,
  },
  servicesHeaderCell: {
    //width: 100,
    flex: 1,
    fontSize: 11,
    color: "#fff",
    fontWeight: "bold",
    paddingHorizontal: 4,
    textAlign: "center",
  },
  servicesRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    width: "100%",
    flex: 1,
  },
  servicesCell: {
    //width: 100,
    flex: 1,
    fontSize: 10,
    color: "#333",
    paddingHorizontal: 4,
    textAlign: "center",
  },
  expandedServicesContainer: {
    backgroundColor: "#f5f5f5",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },

  noServicesText: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    paddingVertical: 10,
  },
  businessCardContainer: {
    marginBottom: 10,
    borderRadius: 10,
    overflow: "visible",
  },
  darkBusinessCardContainer: {
    backgroundColor: "transparent",
  },
  selectProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 16,
  },
  selectProfileLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
    minWidth: 90,
  },
  selectProfileDropdown: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  selectProfileDropdownText: {
    fontSize: 15,
    color: "#333",
  },
  selectProfileMenu: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 16,
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.15)",
    ...(Platform.OS !== "web" && { elevation: 4 }),
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(24, 136, 74, 0.3)", // 30% opacity of #18884A (account header green)
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000",
    letterSpacing: 1,
  },
  // Receive Item Modal
  receiveItemModalOverlay: {
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
      zIndex: 9998,
    }),
  },
  darkModalOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  receiveItemModalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "90%",
    maxWidth: 400,
    ...(Platform.OS === "web" && {
      position: "relative",
      zIndex: 9999,
    }),
  },
  darkModalContent: {
    backgroundColor: "#2d2d2d",
  },
  receiveItemModalHeader: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  receiveItemModalTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 24,
    textAlign: "center",
  },
  darkTitle: {
    color: "#fff",
  },
  receiveItemModalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  receiveItemModalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  receiveItemNoButton: {
    backgroundColor: "#F5F5F5",
    borderWidth: 2,
    borderColor: "#9C45F7",
  },
  darkCancelButton: {
    backgroundColor: "#404040",
    borderColor: "#7B35C7",
  },
  receiveItemYesButton: {
    backgroundColor: "#9C45F7",
  },
  receiveItemModalButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  receiveItemNoButtonText: {
    color: "#9C45F7",
  },
  darkCancelButtonText: {
    color: "#7B35C7",
  },
  transactionPurchasedItemCell: {
    flex: 1,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  receiptLink: {
    fontSize: 11,
    color: "#007AFF",
    textDecorationLine: "underline",
    paddingVertical: 2,
  },
  receiptModalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    width: "92%",
    maxWidth: 500,
    maxHeight: "85%",
    ...(Platform.OS === "web" && {
      position: "relative",
      zIndex: 9999,
    }),
  },
  receiptScrollView: {
    maxHeight: 200,
    marginTop: 12,
    marginBottom: 4,
    width: "100%",
    alignSelf: "stretch",
  },
  receiptScrollViewContent: {
    width: "100%",
    flexGrow: 1,
  },
  receiptTableWrap: {
    minWidth: 620,
  },
  receiptTableHeader: {
    flexDirection: "row",
    backgroundColor: "#18884A",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 2,
    width: "100%",
    alignItems: "center",
  },
  receiptHeaderCell: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "bold",
    paddingHorizontal: 4,
  },
  receiptHeaderCellItem: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  receiptHeaderCellQty: {
    width: 28,
    minWidth: 28,
    flexShrink: 0,
    textAlign: "center",
  },
  receiptHeaderCellBounty: {
    width: 54,
    minWidth: 54,
    flexShrink: 0,
    textAlign: "right",
    fontSize: 10,
  },
  receiptHeaderCellShare: {
    width: 58,
    minWidth: 58,
    flexShrink: 0,
    textAlign: "right",
    fontSize: 10,
  },
  receiptHeaderCellCost: {
    width: 64,
    minWidth: 64,
    flexShrink: 0,
    textAlign: "right",
  },
  receiptHeaderCellShipping: {
    width: 64,
    minWidth: 64,
    flexShrink: 0,
    textAlign: "right",
    fontSize: 10,
  },
  receiptTableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    width: "100%",
    alignItems: "flex-start",
  },
  receiptTableCell: {
    fontSize: 11,
    color: "#333",
    paddingHorizontal: 4,
  },
  receiptTableCellItem: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  receiptTableCellQty: {
    width: 28,
    minWidth: 28,
    flexShrink: 0,
    textAlign: "center",
  },
  receiptTableCellBounty: {
    width: 54,
    minWidth: 54,
    flexShrink: 0,
    textAlign: "right",
  },
  receiptTableCellShare: {
    width: 58,
    minWidth: 58,
    flexShrink: 0,
    paddingHorizontal: 4,
    alignItems: "flex-end",
  },
  receiptTableCellCost: {
    width: 64,
    minWidth: 64,
    flexShrink: 0,
    textAlign: "right",
  },
  receiptTableCellShipping: {
    width: 64,
    minWidth: 64,
    flexShrink: 0,
    textAlign: "right",
  },
  receiptMoneyText: {
    ...(Platform.OS === "web" ? { whiteSpace: "nowrap" } : {}),
  },
  receiptCloseButton: {
    backgroundColor: "#F5F5F5",
    borderWidth: 2,
    borderColor: "#18884A",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
  },
  receiptCloseButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#18884A",
  },
});
