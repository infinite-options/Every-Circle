import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity, Platform, Modal, Alert, TextInput, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import {
  ACCOUNT_SCREEN_PERSONAL_ENDPOINT,
  ACCOUNT_SCREEN_BUSINESS_ENDPOINT,
  ORDERS_ENDPOINT,
  API_BASE_URL,
  TRANSACTION_RECEIPT_ENDPOINT,
  TRANSACTIONS_ENDPOINT,
  TRANSACTIONS_RETURN_ENDPOINT,
  TRANSACTIONS_RETURN_CONFIRM_ENDPOINT,
  TRANSACTIONS_RETURNS_DECLINED_ENDPOINT,
} from "../apiConfig";
import Svg, { Circle, Line, Text as SvgText, G, Path } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";
import { useDarkMode } from "../contexts/DarkModeContext";
import FeedbackPopup from "../components/FeedbackPopup";
import { getHeaderColors } from "../config/headerColors";
import { SHOW_NETWORK_DEBUG_UI, SETTINGS_NETWORK_DEBUG_MODE_KEY } from "../config/networkDebug";
import { getSessionProfile } from "../utils/sessionProfile";
// import { Picker } from '@react-native-picker/picker';
import MiniCard from "../components/MiniCard";
import { mapBusinessToMiniCard } from "../utils/mapBusinessToMiniCard";
import { parsePrice } from "../utils/priceUtils";
import { cartChoiceEnrichmentFromItem, getItemizedChoiceLines } from "../utils/selectedChoiceItems";
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

/** 1 = compact: Purchases (Date, Type, Seller, Delivered, Received, Amount) + Bounty Results (hide ID); 0 = full tables */
const ACCOUNT_TRANSACTION_HISTORY_COMPACT_COLUMNS = 0;

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
  return serviceId.startsWith("250-");
}

function navigateToPurchaseSeller(navigation, transaction) {
  const sellerId = resolvePurchaseSellerId(transaction);
  if (!sellerId) {
    Alert.alert("Unavailable", "Seller profile is not available for this purchase.");
    return;
  }
  if (isPurchaseFromBusiness(transaction)) {
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

/** Remaining quantity the buyer can still confirm on a line. */
function getRemainingQtyToReceive(row) {
  return Math.max(0, getReceiptLineQty(row) - getPreviouslyReceivedQty(row));
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

/** True when every receipt line has been fully marked as received. */
function areAllReceiptLinesFullyReceived(receiptRows, selectedItemIds, receivedQuantities) {
  if (!Array.isArray(receiptRows) || receiptRows.length === 0) return false;
  return receiptRows.every((row, index) => {
    const purchasedQty = getReceiptLineQty(row);
    const alreadyReceived = getPreviouslyReceivedQty(row);
    const itemId = String(index);
    const newlySelected = selectedItemIds.includes(itemId);
    const raw = receivedQuantities[itemId];
    const newlyReceived = newlySelected ? (typeof raw === "number" ? raw : parseInt(String(raw), 10) || 0) : 0;
    return alreadyReceived + newlyReceived >= purchasedQty;
  });
}

/** Sum return qty already requested for a line (supports partial multi-qty returns). */
function getReturnedQtyForLine(returnRequestData, itemIndex, purchasedQty) {
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
  const choicesExtraCost =
    parseFloat(row.choices_extra_cost ?? row.ti_choices_extra_cost ?? NaN) ||
    optionsExtraCost ||
    0;
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
      return (
        bountyRows.find(
          (row) =>
            String(row?.ti_transaction_id || row?.transaction_uid || "").trim() === txnUid &&
            String(row?.ti_bs_id || row?.bs_uid || "").trim() === bsId,
        ) || null
      );
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
  const bountyType = String(
    receiptLine?.bs_bounty_type || receiptLine?.ti_bs_bounty_type || bountyRow?.bs_bounty_type || "",
  )
    .trim()
    .toLowerCase();
  const unitRaw = parseFloat(
    receiptLine?.bs_bounty ?? receiptLine?.ti_bs_bounty ?? receiptLine?.bounty_amount ?? receiptLine?.item_bounty ?? NaN,
  );
  let lineBounty = Number.isFinite(unitRaw) && unitRaw > 0 ? (bountyType === "total" ? unitRaw : unitRaw * Math.max(1, qty)) : null;

  const earnedRaw = parseFloat(bountyRow?.bounty_earned ?? bountyRow?.tb_amount ?? receiptLine?.bounty_earned ?? receiptLine?.tb_amount ?? NaN);
  const earned = Number.isFinite(earnedRaw) ? earnedRaw : null;
  const pctRaw = parseFloat(bountyRow?.tb_percentage ?? receiptLine?.tb_percentage ?? receiptLine?.bounty_percentage ?? NaN);
  const percentage = Number.isFinite(pctRaw) ? pctRaw : null;

  if (lineBounty == null && earned != null && percentage != null && percentage > 0) {
    lineBounty = earned / percentage;
  }

  if (lineBounty == null && earned == null) return null;

  const pctLabel =
    percentage != null
      ? percentage > 0 && percentage <= 1
        ? `${Math.round(percentage * 1000) / 10}%`
        : `${Math.round(percentage * 10) / 10}%`
      : null;

  let itemLabel = null;
  if (lineBounty != null) {
    if (bountyType === "per_item" && Number.isFinite(unitRaw) && unitRaw > 0 && qty > 1) {
      itemLabel = `$${lineBounty.toFixed(2)} ($${unitRaw.toFixed(2)} × ${qty})`;
    } else {
      itemLabel = `$${lineBounty.toFixed(2)}${bountyType === "per_item" ? " / item total" : bountyType === "total" ? " total" : ""}`;
    }
  }

  const shareLabel =
    earned != null ? `$${earned.toFixed(2)}${pctLabel ? ` (${pctLabel})` : ""}` : null;

  return { itemLabel, shareLabel, lineBounty, earned, percentage };
}

/** Below receipt line items: merchandise, tax, fees, shipping, bounty, total, and check vs amount paid. */
function ReceiptTransactionTotalsFooter({ receiptRows, transactionFallback, darkMode }) {
  if (!Array.isArray(receiptRows) || receiptRows.length === 0) return null;
  const first = receiptRows[0] || {};
  const fallback = transactionFallback && typeof transactionFallback === "object" ? transactionFallback : {};
  const fromLines = sumReceiptLineMerchandise(receiptRows);
  const txnMerch = getReceiptTransactionAmount(receiptRows);
  const txnTaxes = receiptMoneyFromSources(first, fallback, ["transaction_taxes", "total_taxes"]);
  const txnFees = receiptMoneyFromSources(first, fallback, ["transaction_fees", "total_fees"]);
  const txnShipping = receiptMoneyFromSources(first, fallback, [
    "transaction_shipping",
    "shipping_amount",
    "shipping_cost",
    "shipping",
  ]);
  const txnBounty = receiptMoneyFromSources(first, fallback, ["bounty_paid", "transaction_bounty", "total_bounty_paid"]);
  const txnTotal = receiptMoneyFromSources(first, fallback, ["transaction_total", "total_amount_paid", "seller_total"]);

  const hasAnyBreakdown =
    txnMerch != null ||
    txnTaxes != null ||
    txnFees != null ||
    txnShipping != null ||
    txnBounty != null ||
    txnTotal != null;
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
      <Text style={{ fontSize: 12, fontWeight: "600", color: valueColor }}>{valueText}</Text>
    </View>
  );

  const taxesStr = txnTaxes != null ? formatReceiptUsd(txnTaxes) : "—";
  const feesStr = txnFees != null ? formatReceiptUsd(txnFees) : "—";
  const shippingStr = txnShipping != null ? formatReceiptUsd(txnShipping) : "—";
  const totalStr = txnTotal != null ? formatReceiptUsd(txnTotal) : "—";
  const showBounty = txnBounty != null && txnBounty > 0;

  const linesVsMerch = txnMerch != null && fromLines > 0 && Math.abs(fromLines - txnMerch) > RECEIPT_TOTAL_EPS;

  let verifyText = "";
  let verifyColor = secondaryColor;

  if (txnTotal != null) {
    const merchForSum = txnMerch != null ? txnMerch : fromLines;
    const sumParts = [merchForSum];
    if (txnTaxes != null) sumParts.push(txnTaxes);
    if (txnFees != null) sumParts.push(txnFees);
    if (txnShipping != null) sumParts.push(txnShipping);
    const sum = sumParts.reduce((a, b) => a + b, 0);
    if (txnTaxes != null || txnFees != null || txnShipping != null) {
      if (Math.abs(sum - txnTotal) <= RECEIPT_TOTAL_EPS) {
        verifyText = `Subtotal + tax + fees + shipping matches amount paid (${formatReceiptUsd(txnTotal)}).`;
        verifyColor = "#18884A";
      } else {
        const partsLabel = [
          formatReceiptUsd(merchForSum),
          txnTaxes != null ? formatReceiptUsd(txnTaxes) : null,
          txnFees != null ? formatReceiptUsd(txnFees) : null,
          txnShipping != null ? formatReceiptUsd(txnShipping) : null,
        ]
          .filter(Boolean)
          .join(" + ");
        verifyText = `Totals do not match: ${partsLabel} = ${formatReceiptUsd(sum)}, but amount paid is ${formatReceiptUsd(txnTotal)}.`;
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
      {row("Credit card fees", feesStr)}
      {row("Shipping", shippingStr)}
      {showBounty ? row("Bounty (paid by seller)", formatReceiptUsd(txnBounty)) : null}
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
  const w =
    root?.wallet ??
    bag?.wallet ??
    bag?.bounty_results?.wallet ??
    bountyBag?.wallet ??
    null;
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

function mapAccountScreenPersonalResponse(json) {
  const root = json && typeof json === "object" ? json : {};

  if (Array.isArray(root.data)) {
    const bountyResultsBlock = root.bounty_results ?? null;
    const walletEarly = extractPersonalWallet(root, root, bountyResultsBlock ?? { data: root.data, wallet: root.wallet });
    const hasBountyTotals = root.total_bounty_earned != null || root.total_bounties != null || walletEarly != null || bountyResultsBlock != null;
    if (hasBountyTotals) {
      const purchasesRaw = root.purchases ?? root.purchase_transactions ?? root.personal_transactions ?? root.buyer_transactions;
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
      return {
        transactions: extractTransactionArray(purchasesRaw),
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
  transactions = extractTransactionArray(txRaw);
  // Nested legacy shape: { message, code: 200, data: [ rows ] } embedded under payload
  if (!transactions.length && payload && typeof payload === "object") {
    const legacyBlock = payload.transactions_legacy ?? payload.transaction_payload ?? payload.transaction_response ?? payload.buyer_transaction_response;
    if (legacyBlock && isApiSuccessCode(legacyBlock.code) && Array.isArray(legacyBlock.data)) {
      transactions = legacyBlock.data;
    } else if (isApiSuccessCode(payload.code) && Array.isArray(payload.data)) {
      const sample = payload.data[0];
      if (sample && (sample.transaction_uid != null || sample.ti_uid != null)) {
        transactions = payload.data;
      }
    }
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

function getSaleLineUnitCost(row) {
  const cost = parseFloat(row?.ti_bs_cost ?? row?.bs_cost ?? 0);
  return Number.isFinite(cost) ? cost : 0;
}

function aggregateBusinessProductSales(bountyLines) {
  if (!Array.isArray(bountyLines)) return [];
  const byProduct = {};
  for (const row of bountyLines) {
    if (isReturnListRow(row)) continue;
    const productUid = resolveProductUidFromSaleLine(row);
    if (!productUid) continue;

    const qty = getSaleLineQty(row);
    const unitCost = getSaleLineUnitCost(row);
    const bountyPaid = parseFloat(row?.bounty_paid ?? 0) || 0;
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
  return "Paid";
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
  return String(row?.order_uid ?? row?.transaction_uid ?? "").trim() || "—";
}

function resolveSaleOrderUid(saleRow) {
  return resolveListRowOrderUid(saleRow);
}

function isReturnListRow(row) {
  return Number(row?.is_return) === 1 || String(row?.transaction_type || "").toLowerCase() === "return";
}

/**
 * Normalize backend return/refund pair (plus legacy accepted/declined values).
 * return_status: returning | returned
 * refund_status: pending | refunded | rejected
 */
function extractReturnRefundState(source = {}, override = {}) {
  const pick = (...vals) => {
    for (const v of vals) {
      if (v == null || v === "") continue;
      return String(v).trim().toLowerCase();
    }
    return "";
  };

  let returnStatus = pick(
    override.return_status,
    override.returnStatus,
    typeof override === "string" ? override : null,
    source.return_status,
    source.transaction_return_status,
  );
  let refundStatus = pick(
    override.refund_status,
    override.refundStatus,
    source.refund_status,
    source.transaction_refund_status,
  );
  let displayStatus = String(override.display_status ?? source.display_status ?? "").trim();

  if (displayStatus) {
    const match = displayStatus.match(/^(returning|returned)\s*[-–]\s*(pending|refunded|rejected)$/i);
    if (match) {
      if (!returnStatus) returnStatus = match[1].toLowerCase();
      if (!refundStatus) refundStatus = match[2].toLowerCase();
    }
  }

  // Legacy single-field values from older FE / AsyncStorage.
  if (returnStatus === "accepted") {
    returnStatus = "returned";
    if (!refundStatus || refundStatus === "accepted") refundStatus = "refunded";
  } else if (returnStatus === "declined") {
    refundStatus = refundStatus || "rejected";
    // Decline before receipt → Returning - Rejected
    returnStatus = "returning";
  } else if (returnStatus === "resolved" || returnStatus === "completed") {
    returnStatus = "returned";
    refundStatus = refundStatus || "refunded";
  } else if (returnStatus === "rejected" && !refundStatus) {
    refundStatus = "rejected";
    returnStatus = "returning";
  }

  if (refundStatus === "declined") refundStatus = "rejected";
  if (refundStatus === "accepted") refundStatus = "refunded";

  const returnRequested =
    override.returnRequested === true ||
    override.returnRequested === 1 ||
    Number(source.transaction_return_requested) === 1 ||
    !!returnStatus ||
    !!refundStatus ||
    !!displayStatus ||
    isReturnListRow(source);

  if (!displayStatus && returnStatus && refundStatus) {
    const deliveredWord = returnStatus === "returned" ? "Returned" : "Returning";
    const receivedWord =
      refundStatus === "refunded" ? "Refunded" : refundStatus === "rejected" ? "Rejected" : "Pending";
    displayStatus = `${deliveredWord} - ${receivedWord}`;
  }

  return {
    return_status: returnStatus,
    refund_status: refundStatus,
    display_status: displayStatus,
    active: returnRequested,
  };
}

/**
 * Delivered / Received chips for returns.
 * Canonical:
 *   Returning - Pending
 *   Returned  - Pending
 *   Returned  - Refunded | Returned - Rejected
 * Also: Returning - Rejected (seller rejects before receiving)
 */
function resolveReturnLogisticsLabels(row, override = {}) {
  if (!row || typeof row !== "object") return null;
  const state = extractReturnRefundState(row, override);
  if (!state.active) return null;

  const isReturnTxn = isReturnListRow(row);
  let returnStatus = state.return_status;
  let refundStatus = state.refund_status;

  // Return txn rows without status fields are post-confirm refunds.
  if (isReturnTxn && !returnStatus) {
    returnStatus = "returned";
    refundStatus = refundStatus || (Number(row.transaction_in_escrow ?? row.in_escrow) === 1 ? "pending" : "refunded");
  }
  if (!returnStatus) returnStatus = "returning";
  if (!refundStatus) refundStatus = "pending";

  const delivered = returnStatus === "returned" ? "Returned" : "Returning";
  const received =
    refundStatus === "refunded" ? "Refunded" : refundStatus === "rejected" ? "Rejected" : "Pending";

  return {
    delivered,
    received,
    return_status: returnStatus,
    refund_status: refundStatus,
    display_status: state.display_status || `${delivered} - ${received}`,
  };
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
  if (Number.isFinite(fromRow) && fromRow !== 0) return fromRow;
  if (listTxnUid && bountyByTransactionUid?.[listTxnUid] != null) {
    return bountyByTransactionUid[listTxnUid];
  }
  if (isReturn) return 0;
  const orderUid = resolveListRowOrderUid(row);
  return bountyByOrderUid?.[orderUid] ?? 0;
}

function mapTransactionListRowToOrderTableRow(row, bountyByOrderUid, bountyByTransactionUid, shippingProgressByKey, returnStatusesByKey) {
  const orderUid = resolveListRowOrderUid(row);
  const isReturn = isReturnListRow(row);
  const dateMs = transactionDateMs(row);
  const total = parseFloat(row.transaction_total);
  const bountyPaid = resolveListRowBountyPaid(row, null, bountyByOrderUid, bountyByTransactionUid);
  const listTransactionUid = String(row.transaction_uid || "").trim();
  // Prefer fulfillment fields from account-screen list rows over hydration overrides.
  const shippingProgressOverride = listRowHasExplicitShippingProgress(row)
    ? null
    : (shippingProgressByKey && (shippingProgressByKey[orderUid] || shippingProgressByKey[listTransactionUid])) || null;
  const statusOverride = getReturnStatusOverrideFromCache(returnStatusesByKey, orderUid, listTransactionUid);
  const returnLogistics = resolveReturnLogisticsLabels(row, statusOverride);

  // Keep Order rows on shipping/receipt chips. Return logistics belong on the Return row only.
  if (isReturn) {
    return {
      key: String(row.transaction_uid || `return-${orderUid}-${dateMs}`),
      orderUid,
      rowLabel: "Return",
      listTransactionUid,
      isReturn: true,
      isSyntheticReturn: false,
      placedBy: resolveSalePlacedByUid(row),
      dateLabel: formatOrderShortDate(dateMs),
      dateMs,
      total: Number.isFinite(total) ? total : 0,
      bountyPaid: Number.isFinite(bountyPaid) ? bountyPaid : 0,
      delivered: returnLogistics?.delivered || "Returned",
      received: returnLogistics?.received || "Pending",
      daysOpen: "—",
      returnLogistics,
      rawRow: row,
    };
  }

  return {
    key: String(row.transaction_uid || `${orderUid}-${dateMs}`),
    orderUid,
    rowLabel: "Order",
    listTransactionUid,
    isReturn: false,
    isSyntheticReturn: false,
    placedBy: resolveSalePlacedByUid(row),
    dateLabel: formatOrderShortDate(dateMs),
    dateMs,
    total: Number.isFinite(total) ? total : 0,
    bountyPaid: Number.isFinite(bountyPaid) ? bountyPaid : 0,
    delivered: getOrderDeliveredStatus([row], shippingProgressOverride),
    received: getOrderReceivedStatusFromSaleRows([row]),
    daysOpen: formatOrderDaysOpen(dateMs),
    returnLogistics,
    rawRow: row,
  };
}

/** Companion Return row while a return is requested but no reverse txn exists in the seller list yet. */
function buildSyntheticReturnOrderRow(orderRow, logistics) {
  const raw = orderRow?.rawRow || {};
  const total = parseFloat(raw.transaction_total);
  const bountyPaid = Number(orderRow.bountyPaid) || 0;
  const dateMs = orderRow.dateMs || transactionDateMs(raw) || Date.now();
  return {
    key: `return-request-${orderRow.orderUid}`,
    orderUid: orderRow.orderUid,
    rowLabel: "Return",
    listTransactionUid: orderRow.listTransactionUid,
    isReturn: true,
    isSyntheticReturn: true,
    placedBy: orderRow.placedBy,
    dateLabel: orderRow.dateLabel || formatOrderShortDate(dateMs),
    dateMs,
    total: Number.isFinite(total) ? -Math.abs(total) : 0,
    bountyPaid: bountyPaid ? -Math.abs(bountyPaid) : 0,
    delivered: logistics?.delivered || "Returning",
    received: logistics?.received || "Pending",
    daysOpen: "—",
    returnLogistics: logistics,
    rawRow: {
      ...raw,
      is_return: 1,
      transaction_type: "return",
      return_status: logistics?.return_status,
      refund_status: logistics?.refund_status,
      display_status: logistics?.display_status,
      transaction_return_status: logistics?.return_status,
      transaction_refund_status: logistics?.refund_status,
      transaction_return_requested: 1,
    },
  };
}

function buildBusinessOrdersListFromSellerTransactions(sellerLines, bountyLines, shippingProgressByKey, returnStatusesByKey) {
  if (!Array.isArray(sellerLines)) return [];
  const bountyByOrderUid = buildBountyPaidByOrderUid(bountyLines);
  const bountyByTransactionUid = buildBountyPaidByTransactionUid(bountyLines);
  const mapped = sellerLines.map((row) =>
    mapTransactionListRowToOrderTableRow(row, bountyByOrderUid, bountyByTransactionUid, shippingProgressByKey, returnStatusesByKey),
  );

  const orderUidsWithReturnTxn = new Set(mapped.filter((row) => row.isReturn && !row.isSyntheticReturn).map((row) => row.orderUid));
  const syntheticReturns = [];
  for (const orderRow of mapped) {
    if (orderRow.isReturn) continue;
    if (!orderRow.orderUid || orderRow.orderUid === "—") continue;
    if (orderUidsWithReturnTxn.has(orderRow.orderUid)) continue;
    const logistics =
      orderRow.returnLogistics ||
      resolveReturnLogisticsLabels(
        orderRow.rawRow || {},
        getReturnStatusOverrideFromCache(returnStatusesByKey, orderRow.orderUid, orderRow.listTransactionUid),
      );
    if (!logistics) continue;
    syntheticReturns.push(buildSyntheticReturnOrderRow(orderRow, logistics));
  }

  return [...mapped, ...syntheticReturns].sort((a, b) => {
    const byDate = (b.dateMs || 0) - (a.dateMs || 0);
    if (byDate !== 0) return byDate;
    if (a.orderUid === b.orderUid) {
      // Same order: Order first, then Return.
      return (a.isReturn ? 1 : 0) - (b.isReturn ? 1 : 0);
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

function buildOrderDetailUrl(orderUid, { profileId, businessUid } = {}) {
  const params = new URLSearchParams();
  if (profileId) params.set("profile_id", profileId);
  if (businessUid) params.set("business_uid", businessUid);
  const qs = params.toString();
  const base = `${ORDERS_ENDPOINT}/${encodeURIComponent(orderUid)}`;
  return withTimeZoneQuery(qs ? `${base}?${qs}` : base);
}

async function fetchOrderDetailApi(orderUid, ctx = {}) {
  const url = buildOrderDetailUrl(orderUid, ctx);
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Failed to load order (${response.status})`);
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

function buildReturnModalSelectableLines(orderLines, receiptLines, returnRequestData) {
  if (Array.isArray(orderLines) && orderLines.length > 0) {
    return orderLines
      .map((line) => {
        const purchasedQty = Math.max(0, parseInt(line.ti_bs_qty, 10) || 0);
        const remainingQty = Math.max(0, parseInt(line.remaining_qty, 10) ?? purchasedQty - (parseInt(line.returned_qty, 10) || 0));
        const transactionItemUid = String(line.ti_uid || "").trim();
        if (!transactionItemUid) return null;
        return {
          itemId: transactionItemUid,
          itemName: line.item_name || "Item",
          unitCost: line.ti_bs_cost,
          purchasedQty,
          remainingQty,
          transactionItemUid,
        };
      })
      .filter(Boolean);
  }

  return (receiptLines || []).map((item, index) => {
    const purchasedQty = getReceiptLineQty(item);
    const alreadyReturnedQty = getReturnedQtyForLine(returnRequestData, index, purchasedQty);
    const remainingQty = Math.max(0, purchasedQty - alreadyReturnedQty);
    return {
      itemId: String(index),
      itemName: item.bs_service_name || "Item",
      unitCost: item.ti_bs_cost,
      purchasedQty,
      remainingQty,
      transactionItemUid: getReceiptLineTransactionItemUid(item),
      receiptIndex: index,
    };
  });
}

function parseOrderMoneyField(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function buildOrderDetailFinancialBreakdown(sale, returns, summary) {
  const saleAmount = parseOrderMoneyField(sale?.transaction_amount);
  const saleTaxes = parseOrderMoneyField(sale?.transaction_taxes);
  const saleFees = parseOrderMoneyField(sale?.transaction_fees);
  const saleTotal = parseOrderMoneyField(sale?.transaction_total) || parseOrderMoneyField(summary?.gross_total);

  let returnedAmount = 0;
  let returnedTaxes = 0;
  let returnedFees = 0;
  let returnedTotal = 0;
  for (const ret of returns || []) {
    returnedAmount += parseOrderMoneyField(ret.transaction_amount);
    returnedTaxes += parseOrderMoneyField(ret.transaction_taxes);
    returnedFees += parseOrderMoneyField(ret.transaction_fees);
    returnedTotal += parseOrderMoneyField(ret.transaction_total);
  }

  const hasReturns = (returns || []).length > 0;
  const netAmount = saleAmount + returnedAmount;
  const netTaxes = saleTaxes + returnedTaxes;
  const netFees = saleFees + returnedFees;
  const netTotal = parseOrderMoneyField(summary?.net_total) || saleTotal + returnedTotal;

  return {
    saleAmount,
    saleTaxes,
    saleFees,
    saleTotal,
    returnedAmount,
    returnedTaxes,
    returnedFees,
    returnedTotal: parseOrderMoneyField(summary?.returned_total) || returnedTotal,
    netAmount,
    netTaxes,
    netFees,
    netTotal,
    hasReturns,
  };
}

/** Reverse (return) money details for Return Details modal — amount, tax, fees, bounty, total. */
function buildReverseTransactionDetails(sale, returns, bountyPaidFallback = 0, refundBreakdown = null) {
  if (refundBreakdown && typeof refundBreakdown === "object") {
    const amount = parseOrderMoneyField(
      refundBreakdown.amount ?? refundBreakdown.merchandise ?? refundBreakdown.transaction_amount,
    );
    const taxes = parseOrderMoneyField(refundBreakdown.taxes ?? refundBreakdown.transaction_taxes);
    const fees = parseOrderMoneyField(refundBreakdown.fees ?? refundBreakdown.transaction_fees);
    const bounty = parseOrderMoneyField(refundBreakdown.bounty ?? refundBreakdown.bounty_paid);
    const total = parseOrderMoneyField(refundBreakdown.total ?? refundBreakdown.transaction_total);
    const asNegative = (n) => (n > 0 ? -Math.abs(n) : n);
    return {
      amount: asNegative(amount),
      taxes: asNegative(taxes),
      fees: asNegative(fees),
      bounty: asNegative(bounty),
      total: asNegative(total || amount + taxes + fees),
      hasActualReturn: true,
      returnTxnUids: refundBreakdown.return_transaction_uid ? [String(refundBreakdown.return_transaction_uid)] : [],
      isEstimate: false,
    };
  }

  const returnRows = Array.isArray(returns) ? returns : [];
  if (returnRows.length > 0) {
    let amount = 0;
    let taxes = 0;
    let fees = 0;
    let bounty = 0;
    let total = 0;
    const txnIds = [];
    for (const ret of returnRows) {
      amount += parseOrderMoneyField(ret.transaction_amount);
      taxes += parseOrderMoneyField(ret.transaction_taxes);
      fees += parseOrderMoneyField(ret.transaction_fees);
      const rowBounty = parseOrderMoneyField(
        ret.bounty_paid ?? ret.transaction_bounty ?? ret.total_bounty ?? ret.bounty,
      );
      bounty += rowBounty;
      total += parseOrderMoneyField(ret.transaction_total);
      if (ret.transaction_uid) txnIds.push(String(ret.transaction_uid));
    }
    if (!bounty && Number.isFinite(bountyPaidFallback) && bountyPaidFallback !== 0) {
      bounty = bountyPaidFallback < 0 ? bountyPaidFallback : -Math.abs(bountyPaidFallback);
    }
    return {
      amount,
      taxes,
      fees,
      bounty,
      total,
      hasActualReturn: true,
      returnTxnUids: txnIds,
      isEstimate: false,
    };
  }

  // No reverse txn yet — show expected refund from the original sale (negative).
  const amount = -Math.abs(parseOrderMoneyField(sale?.transaction_amount));
  const taxes = -Math.abs(parseOrderMoneyField(sale?.transaction_taxes));
  const fees = -Math.abs(parseOrderMoneyField(sale?.transaction_fees));
  const bountyRaw = parseOrderMoneyField(
    sale?.bounty_paid ?? sale?.transaction_bounty ?? sale?.total_bounty ?? bountyPaidFallback,
  );
  const bounty = bountyRaw === 0 ? 0 : -Math.abs(bountyRaw);
  const total = -Math.abs(parseOrderMoneyField(sale?.transaction_total));
  return {
    amount,
    taxes,
    fees,
    bounty,
    total,
    hasActualReturn: false,
    returnTxnUids: [],
    isEstimate: true,
  };
}

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
      const qty = Math.max(1, parseInt(item.return_quantity ?? item.quantity ?? item.qty, 10) || 1);
      return {
        ...base,
        ...item,
        ti_uid: uid || base.ti_uid,
        item_name: item.item_name || item.bs_service_name || base.item_name || "Item",
        ti_bs_id: item.ti_bs_id || base.ti_bs_id,
        ti_bs_cost: item.ti_bs_cost ?? base.ti_bs_cost,
        return_quantity: qty,
        ti_bs_qty: qty,
      };
    })
    .filter((line) => line.ti_uid || line.item_name);
}

function collectReturnDetailLines(orderDetail) {
  const returns = Array.isArray(orderDetail?.returns) ? orderDetail.returns : [];
  const fromReturns = [];
  for (const ret of returns) {
    for (const line of ret.lines || []) {
      fromReturns.push(line);
    }
  }
  if (fromReturns.length) return fromReturns;

  const sale = orderDetail?.sale || null;
  const saleLines = Array.isArray(sale?.lines) ? sale.lines : [];
  const pendingItems =
    orderDetail?.pending_return?.items ||
    sale?.pending_return?.items ||
    orderDetail?.pending_return_items ||
    sale?.transaction_return_items ||
    [];
  const fromPending = mapPendingReturnItemsToLines(pendingItems, saleLines);
  if (fromPending.length) return fromPending;

  const markedReturned = saleLines.filter((line) => {
    const returnedQty = parseInt(line.returned_qty ?? line.return_quantity, 10);
    return Number.isFinite(returnedQty) && returnedQty > 0;
  });
  if (markedReturned.length) return markedReturned;

  const logistics = resolveReturnLogisticsLabels(sale || orderDetail || {});
  if (logistics || Number(sale?.transaction_return_requested) === 1) {
    return saleLines;
  }
  return [];
}

function OrderDetailFinancialSummary({ sale, returns, summary, darkMode }) {
  const breakdown = buildOrderDetailFinancialBreakdown(sale, returns, summary);
  const labelStyle = [styles.orderDetailSectionText, darkMode && { color: "#ddd" }];
  const valueStyle = [styles.orderDetailSummaryValue, darkMode && { color: "#eee" }];
  const sectionTitle = (text) => (
    <Text style={[styles.orderDetailSummarySectionLabel, darkMode && { color: "#aaa" }]}>{text}</Text>
  );
  const row = (label, value, { signed = false, emphasize = false } = {}) => (
    <View style={styles.orderDetailSummaryRow} key={label}>
      <Text style={labelStyle}>{label}</Text>
      <Text
        style={[
          ...valueStyle,
          emphasize && styles.orderDetailSummaryNet,
          signed && parseFloat(value) < 0 && { color: "#B71C1C" },
        ]}
      >
        {signed ? formatSignedOrderMoney(value) : formatOrderMoney(value)}
      </Text>
    </View>
  );

  return (
    <View style={[styles.orderDetailSummaryCard, darkMode && styles.orderDetailSectionCardDark]}>
      {breakdown.hasReturns ? sectionTitle("Original order") : null}
      {row("Merchandise (subtotal)", breakdown.saleAmount)}
      {row("Sales tax", breakdown.saleTaxes)}
      {row("Credit card fees", breakdown.saleFees)}
      {breakdown.hasReturns ? row("Order total", breakdown.saleTotal, { emphasize: true }) : null}

      {breakdown.hasReturns ? (
        <>
          {sectionTitle("Returns")}
          {row("Returned merchandise", breakdown.returnedAmount, { signed: true })}
          {row("Returned sales tax", breakdown.returnedTaxes, { signed: true })}
          {row("Returned credit card fees", breakdown.returnedFees, { signed: true })}
          {row("Returned total", breakdown.returnedTotal, { signed: true, emphasize: true })}
          {sectionTitle("Net after returns")}
          {row("Net merchandise", breakdown.netAmount, { signed: breakdown.netAmount < 0 })}
          {row("Net sales tax", breakdown.netTaxes, { signed: breakdown.netTaxes < 0 })}
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
  const dateLabel = transaction?.transaction_datetime
    ? formatTransactionDate({ transaction_datetime: transaction.transaction_datetime })
    : "—";
  const buyerNote = String(transaction?.transaction_return_note || "").trim();

  return (
    <Text style={[styles.productSalesModalSubtitle, styles.orderDetailReturnSubtitle, darkMode && { color: "#aaa" }]}>
      {txnId}
      {dateLabel !== "—" ? ` · ${dateLabel}` : ""}
      {buyerNote ? ` · Buyer's note: ${buyerNote}` : ""}
    </Text>
  );
}

function OrderDetailLinesTable({ lines, darkMode, footerLabel, footerAmount, footerAmountSigned, signedRows: signedRowsProp, showFulfillmentColumns }) {
  const signedRows = signedRowsProp ?? !!footerAmountSigned;
  const includeFulfillment = !!showFulfillmentColumns && !signedRows;
  const detailRows = (lines || []).map((line, index) => {
    const unitCost = Math.abs(parseFloat(line.ti_bs_cost) || 0);
    const qty = Math.abs(
      line.return_quantity != null ? parseInt(line.return_quantity, 10) || 0 : parseInt(line.ti_bs_qty, 10) || 0,
    );
    const lineTotal = unitCost * qty;
    const displayQty = signedRows ? -qty : qty;
    const displayUnitCost = signedRows ? -unitCost : unitCost;
    const displayLineTotal = signedRows ? -lineTotal : lineTotal;
    const fulfillment = includeFulfillment ? formatLineFulfillmentDisplay(line) : null;
    return {
      key: line.ti_uid || `${line.ti_bs_id}-${index}`,
      productId: line.ti_bs_id || "—",
      description: line.item_name || "—",
      unitCost: displayUnitCost,
      qty: displayQty,
      lineTotal: displayLineTotal,
      shippedStatus: fulfillment?.statusLabel || "—",
      tracking: fulfillment?.trackingLabel || "—",
      isLast: index === lines.length - 1,
    };
  });

  if (!detailRows.length) {
    return <Text style={[styles.noDataText, darkMode && { color: "#aaa" }]}>No line items.</Text>;
  }

  const formatFooterAmount = footerAmountSigned ? formatSignedOrderMoney : formatOrderMoney;
  const formatCellAmount = signedRows ? formatSignedOrderMoney : formatOrderMoney;
  const footerValue = footerAmount ?? detailRows.reduce((sum, row) => sum + row.lineTotal, 0);
  const signedCellStyle = signedRows ? { color: "#B71C1C" } : null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={[styles.businessOrderDetailTable, includeFulfillment && styles.businessOrderDetailTableWithFulfillment]}>
        <View style={[styles.businessOrderDetailHeaderRow, darkMode && styles.productSalesDetailHeaderRowDark]}>
          <Text style={[styles.businessOrderDetailHeaderCell, styles.businessOrderDetailColProductId]}>Product ID</Text>
          <Text style={[styles.businessOrderDetailHeaderCell, styles.businessOrderDetailColDescription]}>Description</Text>
          <Text style={[styles.businessOrderDetailHeaderCell, styles.businessOrderDetailColUnitCost]}>Unit cost</Text>
          <Text style={[styles.businessOrderDetailHeaderCell, styles.businessOrderDetailColQty]}>Qty</Text>
          <Text style={[styles.businessOrderDetailHeaderCell, styles.businessOrderDetailColMoney]}>Line total</Text>
          {includeFulfillment ? (
            <>
              <Text style={[styles.businessOrderDetailHeaderCell, styles.businessOrderDetailColShipped]}>Shipped</Text>
              <Text style={[styles.businessOrderDetailHeaderCell, styles.businessOrderDetailColTracking]}>Tracking</Text>
            </>
          ) : null}
        </View>
        {detailRows.map((row) => (
          <View
            key={row.key}
            style={[
              styles.businessOrderDetailDataRow,
              !row.isLast && styles.productSalesDetailDataRowBorder,
              darkMode && styles.productSalesDetailDataRowDark,
            ]}
          >
            <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColProductId, styles.businessOrderDetailProductId, darkMode && { color: "#eee" }]}>
              {row.productId}
            </Text>
            <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColDescription, darkMode && { color: "#ccc" }]} numberOfLines={3}>
              {row.description}
            </Text>
            <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColUnitCost, signedCellStyle, darkMode && !signedRows && { color: "#ccc" }]}>
              {formatCellAmount(row.unitCost)}
            </Text>
            <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColQty, signedCellStyle, darkMode && !signedRows && { color: "#ccc" }]}>
              {row.qty}
            </Text>
            <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColMoney, signedCellStyle, darkMode && !signedRows && { color: "#ccc" }]}>
              {formatCellAmount(row.lineTotal)}
            </Text>
            {includeFulfillment ? (
              <>
                <View style={[styles.businessOrderDetailColShipped, styles.productSalesDetailStatusCell]}>
                  {row.shippedStatus && row.shippedStatus !== "—" ? (
                    (() => {
                      const badgeStyle = getProductSaleStatusBadgeStyle("shippedLine", row.shippedStatus);
                      return (
                        <View style={[styles.productSalesDetailStatusBadge, badgeStyle.badge]}>
                          <Text style={[styles.productSalesDetailStatusBadgeText, badgeStyle.text]}>{row.shippedStatus}</Text>
                        </View>
                      );
                    })()
                  ) : (
                    <Text style={[styles.businessOrderDetailCell, darkMode && { color: "#aaa" }]}>—</Text>
                  )}
                </View>
                <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColTracking, darkMode && { color: "#ccc" }]} numberOfLines={2}>
                  {row.tracking}
                </Text>
              </>
            ) : null}
          </View>
        ))}
        {footerLabel ? (
          <View style={[styles.orderDetailLineTableFooterRow, darkMode && styles.productSalesDetailTotalRowDark]}>
            <Text style={[styles.orderDetailLineTableFooterLabel, styles.businessOrderDetailColProductId, darkMode && { color: "#eee" }]}>{footerLabel}</Text>
            <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColDescription]} />
            <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColUnitCost]} />
            <Text style={[styles.businessOrderDetailCell, styles.businessOrderDetailColQty]} />
            <Text
              style={[
                styles.orderDetailLineTableFooterValue,
                styles.businessOrderDetailColMoney,
                footerAmountSigned && { color: "#B71C1C" },
                darkMode && !footerAmountSigned && { color: "#eee" },
              ]}
            >
              {formatFooterAmount(footerValue)}
            </Text>
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
      {shippingAddress.address_line_1 ? (
        <Text style={[styles.orderDetailSectionText, darkMode && { color: "#ddd" }]}>{shippingAddress.address_line_1}</Text>
      ) : null}
      {shippingAddress.address_line_2 ? (
        <Text style={[styles.orderDetailSectionText, darkMode && { color: "#ddd" }]}>{shippingAddress.address_line_2}</Text>
      ) : null}
      {locality ? <Text style={[styles.orderDetailSectionText, darkMode && { color: "#ddd" }]}>{locality}</Text> : null}
      {!name && !shippingAddress.address_line_1 && !locality ? (
        <Text style={[styles.orderDetailSectionText, darkMode && { color: "#aaa" }]}>No shipping address on file.</Text>
      ) : null}
    </View>
  );
}

const SHIPPING_CARRIER_OPTIONS = ["USPS", "UPS", "FedEx", "DHL", "Other"];

function OrderDetailModal({ visible, onClose, orderUid, orderDetail, loading, error, darkMode, isSellerView, onSaveFulfillment }) {
  const sale = orderDetail?.sale || null;
  const returns = Array.isArray(orderDetail?.returns) ? orderDetail.returns : [];
  const summary = orderDetail?.summary || null;
  const saleLines = Array.isArray(sale?.lines) ? sale.lines : [];
  const orderReturnLogistics = resolveReturnLogisticsLabels(sale || orderDetail || {}, {
    return_status: sale?.return_status || orderDetail?.return_status,
    refund_status: sale?.refund_status || orderDetail?.refund_status,
    display_status: sale?.display_status || orderDetail?.display_status,
  });
  const shippingAddress = extractShippingAddress(sale) || extractShippingAddress(orderDetail);
  const needsShipping = orderNeedsShipping(sale) || orderNeedsShipping(orderDetail) || !!shippingAddress;
  const transactionUid = String(sale?.transaction_uid || orderDetail?.transaction_uid || orderUid || "").trim();

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
          const remainingQty = Math.max(0, purchasedQty - shippedQty);
          const trackingCarrier = String(line.tracking_carrier || line.ti_tracking_carrier || "").trim();
          const trackingNumber = String(line.tracking_number || line.ti_tracking_number || "").trim();
          return {
            key: transactionItemUid || `line-${index}`,
            transactionItemUid,
            itemName: line.item_name || line.ti_bs_id || "Item",
            purchasedQty,
            shippedQty,
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

  const unshippedItemUids = useMemo(
    () => shippableLines.filter((row) => row.remainingQty > 0).map((row) => row.transactionItemUid),
    [shippableLines],
  );

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

  if (!visible) return null;

  const showSellerShipControls = isSellerView && needsShipping && unshippedItemUids.length > 0;
  const showFulfillmentColumns =
    needsShipping || saleLines.some((line) => lineRequiresShipping(line) || isLineFullyShipped(line) || getLineShippedQty(line) > 0 || !!getLineFulfillmentStatus(line));
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
          <Text style={[styles.productSalesModalSubtitle, darkMode && { color: "#aaa" }]}>
            {orderDetail?.order_uid || orderUid || "—"}
            {sale?.transaction_datetime ? ` · ${formatTransactionDate({ transaction_datetime: sale.transaction_datetime })}` : ""}
            {isSellerView && sale?.transaction_profile_id ? ` · Placed by ${sale.transaction_profile_id}` : ""}
          </Text>

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
              <OrderDetailLinesTable lines={saleLines} darkMode={darkMode} showFulfillmentColumns={showFulfillmentColumns} />

              {showSellerShipControls ? (
                <View style={[styles.orderDetailSummaryCard, darkMode && styles.orderDetailSectionCardDark, { marginTop: 12 }]}>
                  <Text style={[styles.orderDetailSectionTitle, darkMode && styles.darkTitle]}>Mark items shipped</Text>
                  <Text style={[styles.orderDetailSectionNote, darkMode && { color: "#aaa" }]}>
                    Check items to ship and set how many are going out now. Qty defaults to the remaining amount. Carrier and tracking are optional.
                  </Text>

                  {shippableLines
                    .filter((row) => row.remainingQty > 0)
                    .map((row) => {
                    const isSelected = selectedShipItemUids.includes(row.transactionItemUid);
                    const shipQty = shipItemQuantities[row.transactionItemUid] ?? row.remainingQty;
                    const needsQtyPicker = isSelected && row.remainingQty > 1;
                    return (
                      <View key={row.key} style={styles.orderDetailShipRowBlock}>
                        <TouchableOpacity
                          style={styles.orderDetailShipRow}
                          disabled={savingFulfillment}
                          onPress={() => toggleShipItem(row.transactionItemUid, row.remainingQty)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={isSelected ? "checkbox" : "square-outline"}
                            size={20}
                            color={isSelected ? "#9C45F7" : darkMode ? "#aaa" : "#555"}
                            style={{ marginRight: 10 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.orderDetailSectionText, darkMode && { color: "#ddd" }]} numberOfLines={2}>
                              {row.itemName}
                            </Text>
                            <Text style={[styles.orderDetailShipTrackingMeta, darkMode && { color: "#aaa" }]}>
                              {row.shippedQty > 0
                                ? `${row.shippedQty}/${row.purchasedQty} shipped · ${row.remainingQty} left`
                                : `Qty ${row.purchasedQty}`}
                            </Text>
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
                                keyboardType="number-pad"
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
                          style={[
                            styles.orderDetailCarrierChip,
                            darkMode && styles.orderDetailCarrierChipDark,
                            selected && styles.orderDetailCarrierChipSelected,
                          ]}
                          disabled={savingFulfillment || !unshippedItemUids.length}
                          onPress={() => setShippingCarrier((prev) => (prev === carrier ? "" : carrier))}
                        >
                          <Text
                            style={[
                              styles.orderDetailCarrierChipText,
                              darkMode && { color: "#ddd" },
                              selected && styles.orderDetailCarrierChipTextSelected,
                            ]}
                          >
                            {carrier}
                          </Text>
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
                      style={[
                        styles.orderDetailShipSaveButton,
                        (!canSaveShipSelection || savingFulfillment) && styles.orderDetailShipSaveButtonDisabled,
                      ]}
                      disabled={!canSaveShipSelection || savingFulfillment}
                      onPress={handleSaveShipped}
                    >
                      {savingFulfillment ? (
                        <ActivityIndicator size='small' color='#fff' />
                      ) : (
                        <Text style={styles.orderDetailShipSaveButtonText}>Save</Text>
                      )}
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
                      <OrderDetailLinesTable lines={ret.lines || []} darkMode={darkMode} signedRows />
                    </View>
                  ))}
                </>
              ) : null}

              <OrderDetailFinancialSummary sale={sale} returns={returns} summary={summary} darkMode={darkMode} />

              {orderReturnLogistics ? (
                <Text
                  style={[
                    styles.businessOrderDetailReturnBanner,
                    orderReturnLogistics.refund_status === "refunded"
                      ? styles.businessOrderDetailReturnBannerAccepted
                      : styles.businessOrderDetailReturnBanner,
                  ]}
                >
                  {orderReturnLogistics.display_status ||
                    `${orderReturnLogistics.delivered} - ${orderReturnLogistics.received}`}
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
  bountyPaidFallback,
  itemReceived,
  onToggleItemReceived,
  confirming,
  declining,
  confirmResult,
  onConfirmReceipt,
  onDecline,
}) {
  const sale = orderDetail?.sale || null;
  const returns = Array.isArray(orderDetail?.returns) ? orderDetail.returns : [];
  const returnLines = collectReturnDetailLines(orderDetail);
  const reverse = buildReverseTransactionDetails(
    sale,
    returns,
    bountyPaidFallback,
    confirmResult?.refund_breakdown || orderDetail?.refund_breakdown || null,
  );
  const logistics = resolveReturnLogisticsLabels(sale || orderDetail || {}, statusOverride || {});
  const returnStatus = logistics?.return_status || "";
  const refundStatus = logistics?.refund_status || "";
  const displayStatus = logistics?.display_status || "";
  const awaitingSellerAction = returnStatus === "returning" && refundStatus === "pending";
  const refundPendingAfterConfirm = returnStatus === "returned" && refundStatus === "pending";
  const isRefunded = refundStatus === "refunded";
  const isRejected = refundStatus === "rejected";
  const buyerNote = String(
    sale?.transaction_return_note ||
      orderDetail?.pending_return?.note ||
      returns[0]?.transaction_return_note ||
      "",
  ).trim();
  const stripeRefund = confirmResult?.stripe_refund || orderDetail?.stripe_refund || null;
  const labelStyle = [styles.orderDetailSectionText, darkMode && { color: "#ddd" }];
  const valueStyle = [styles.orderDetailSummaryValue, darkMode && { color: "#eee" }];
  const moneyRow = (label, value) => (
    <View style={styles.orderDetailSummaryRow} key={label}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={[...valueStyle, parseFloat(value) < 0 && { color: "#B71C1C" }]}>
        {formatSignedOrderMoney(value)}
      </Text>
    </View>
  );

  const statusBanner = (() => {
    if (!logistics) return null;
    if (awaitingSellerAction) return null;
    if (refundPendingAfterConfirm) {
      return "Item received — Delivered: Returned · Received: Pending (processing refund)";
    }
    if (isRefunded) return "Delivered: Returned · Received: Refunded";
    if (isRejected && returnStatus === "returning") {
      return "Return rejected — Delivered: Returning · Received: Rejected";
    }
    if (isRejected) return "Delivered: Returned · Received: Rejected";
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
            {sale?.transaction_profile_id ? ` · Buyer ${sale.transaction_profile_id}` : ""}
          </Text>
          {displayStatus ? (
            <Text style={[styles.productSalesModalSubtitle, { color: "#B71C1C", fontWeight: "600" }]}>{displayStatus}</Text>
          ) : null}

          {loading ? (
            <ActivityIndicator size='large' color='#B71C1C' style={{ marginVertical: 24 }} />
          ) : error ? (
            <Text style={[styles.errorText, darkMode && { color: "#f88" }]}>{error}</Text>
          ) : !sale ? (
            <Text style={[styles.noDataText, darkMode && { color: "#aaa" }]}>No return data available.</Text>
          ) : (
            <ScrollView style={styles.businessOrderDetailScroll} nestedScrollEnabled keyboardShouldPersistTaps='handled'>
              <Text style={[styles.orderDetailSectionTitle, darkMode && styles.darkTitle, { marginTop: 8 }]}>
                Items to return
              </Text>
              {returnLines.length > 0 ? (
                <OrderDetailLinesTable lines={returnLines} darkMode={darkMode} signedRows />
              ) : (
                <Text style={[styles.noDataText, darkMode && { color: "#aaa" }]}>
                  No pending return line items on this order.
                </Text>
              )}

              {buyerNote ? (
                <View style={[styles.orderDetailSummaryCard, darkMode && styles.orderDetailSectionCardDark, { marginTop: 12 }]}>
                  <Text style={[styles.orderDetailSectionTitle, darkMode && styles.darkTitle]}>Buyer's note</Text>
                  <Text style={[styles.orderDetailSectionText, darkMode && { color: "#ddd" }]}>{buyerNote}</Text>
                </View>
              ) : null}

              <View style={[styles.orderDetailSummaryCard, darkMode && styles.orderDetailSectionCardDark, { marginTop: 12 }]}>
                <Text style={[styles.orderDetailSectionTitle, darkMode && styles.darkTitle]}>
                  Reverse transaction{reverse.isEstimate ? " (estimated)" : ""}
                </Text>
                {(confirmResult?.return_transaction_uid || reverse.returnTxnUids.length > 0) ? (
                  <Text style={[styles.orderDetailSectionNote, darkMode && { color: "#aaa" }]}>
                    Return txn: {confirmResult?.return_transaction_uid || reverse.returnTxnUids.join(", ")}
                  </Text>
                ) : null}
                {moneyRow("Merchandise", reverse.amount)}
                {moneyRow("Sales tax", reverse.taxes)}
                {moneyRow("Credit card fees", reverse.fees)}
                {moneyRow("Bounty", reverse.bounty)}
                <View style={[styles.orderDetailSummaryRow, styles.orderDetailSummaryRowTotal]}>
                  <Text style={[styles.orderDetailSectionTitle, darkMode && styles.darkTitle]}>Refund total</Text>
                  <Text style={[styles.orderDetailSummaryValue, styles.orderDetailSummaryNet, { color: "#B71C1C" }]}>
                    {formatSignedOrderMoney(reverse.total)}
                  </Text>
                </View>
              </View>

              {stripeRefund?.message || (stripeRefund && (stripeRefund.ok === false || stripeRefund.skipped)) ? (
                <Text style={[styles.orderDetailSectionNote, { marginTop: 10, color: "#B71C1C" }]}>
                  {stripeRefund.message ||
                    (stripeRefund.skipped ? "Stripe refund skipped." : "Stripe refund failed.")}
                </Text>
              ) : null}

              {statusBanner ? (
                <Text
                  style={[
                    styles.businessOrderDetailReturnBanner,
                    isRefunded ? styles.businessOrderDetailReturnBannerAccepted : styles.businessOrderDetailReturnBanner,
                    { marginTop: 12 },
                  ]}
                >
                  {statusBanner}
                </Text>
              ) : null}

              {awaitingSellerAction ? (
                <View style={[styles.orderDetailSummaryCard, darkMode && styles.orderDetailSectionCardDark, { marginTop: 12 }]}>
                  <TouchableOpacity
                    style={styles.orderDetailShipRow}
                    onPress={onToggleItemReceived}
                    activeOpacity={0.7}
                    disabled={confirming || declining}
                  >
                    <Ionicons
                      name={itemReceived ? "checkbox" : "square-outline"}
                      size={22}
                      color={itemReceived ? "#18884A" : darkMode ? "#aaa" : "#666"}
                      style={{ marginRight: 10 }}
                    />
                    <Text style={[styles.orderDetailSectionText, darkMode && { color: "#ddd" }, { flex: 1 }]}>
                      I received the returned item(s)
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.orderDetailSectionNote, darkMode && { color: "#aaa" }, { marginTop: 8 }]}>
                    Confirm receipt to move to Returned and trigger the refund attempt. Reject before confirming leaves this as Returning - Rejected.
                  </Text>

                  <View style={[styles.orderDetailShipActions, { marginTop: 14 }]}>
                    <TouchableOpacity
                      style={[
                        styles.orderDetailShipSaveButton,
                        { backgroundColor: "#18884A", flex: 1 },
                        (!itemReceived || confirming || declining) && styles.orderDetailShipSaveButtonDisabled,
                      ]}
                      disabled={!itemReceived || confirming || declining}
                      onPress={onConfirmReceipt}
                    >
                      {confirming ? (
                        <ActivityIndicator size='small' color='#fff' />
                      ) : (
                        <Text style={styles.orderDetailShipSaveButtonText}>Confirm receipt</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.orderDetailShipSecondaryButton,
                        { borderColor: "#B71C1C", flex: 1 },
                        (confirming || declining) && { opacity: 0.5 },
                      ]}
                      disabled={confirming || declining}
                      onPress={onDecline}
                    >
                      {declining ? (
                        <ActivityIndicator size='small' color='#B71C1C' />
                      ) : (
                        <Text style={[styles.orderDetailShipSecondaryButtonText, { color: "#B71C1C" }]}>Reject return</Text>
                      )}
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
  return value === true || value === 1 || value === "1" || String(value || "").trim().toLowerCase() === "true";
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
 * Order/line does not require shipping (pickup, digital, or fulfillment_status=not_required).
 * Delivered should show "—" in that case — not Shipped / Pending.
 */
function orderFulfillmentIsNotRequired(row) {
  if (!row || typeof row !== "object") return false;
  const status = String(
    row.fulfillment_status || row.shipping_status || row.order_fulfillment_status || row.transaction_fulfillment_status || "",
  )
    .trim()
    .toLowerCase();
  if (NOT_REQUIRED_FULFILLMENT_STATUSES.has(status)) return true;
  if (isTruthyShippingFlag(row.shipping_not_required) || isTruthyShippingFlag(row.fulfillment_not_required)) return true;

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
  if (
    ["not_shipped", "pending_shipment", "awaiting_shipment", "unfulfilled", "pending", "ready_to_ship", "partial", "partially_shipped"].includes(
      status,
    )
  ) {
    return true;
  }
  // If backend already set a fulfillment_status and it isn't shippable/shipped, don't assume shipping.
  if (status) return false;
  return true;
}

function getLinePurchasedQty(line) {
  return Math.max(0, parseInt(line?.ti_bs_qty, 10) || 0);
}

function getLineShippedQty(line) {
  if (!line || typeof line !== "object") return 0;
  const explicit = parseInt(line.shipped_qty ?? line.ti_shipped_qty ?? line.fulfillment_shipped_qty ?? line.shipped_quantity ?? line.ti_shipped_quantity, 10);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  // Legacy: fully marked shipped/in_transit with no qty fields → treat purchased qty as shipped.
  const status = getLineFulfillmentStatus(line);
  if (SHIPPED_FULFILLMENT_STATUSES.has(status) || isTruthyShippingFlag(line.shipped) || isTruthyShippingFlag(line.is_shipped) || isTruthyShippingFlag(line.ti_shipped) || line.ti_shipped_at || line.shipped_at || line.fulfilled_at) {
    return getLinePurchasedQty(line);
  }
  return 0;
}

function getLineRemainingShipQty(line) {
  const purchased = getLinePurchasedQty(line);
  if (purchased <= 0) return 0;
  return Math.max(0, purchased - getLineShippedQty(line));
}

function isLineFullyShipped(line) {
  if (!line || typeof line !== "object") return false;
  if (!lineRequiresShipping(line) && getLineShippedQty(line) <= 0) return false;
  const purchased = getLinePurchasedQty(line);
  if (purchased <= 0) {
    const status = getLineFulfillmentStatus(line);
    return SHIPPED_FULFILLMENT_STATUSES.has(status) || isTruthyShippingFlag(line.shipped) || isTruthyShippingFlag(line.is_shipped) || isTruthyShippingFlag(line.ti_shipped) || !!(line.ti_shipped_at || line.shipped_at || line.fulfilled_at);
  }
  return getLineRemainingShipQty(line) <= 0;
}

/** @deprecated use isLineFullyShipped — kept as alias for existing call sites */
function isLineShipped(line) {
  return isLineFullyShipped(line);
}

function formatLineFulfillmentDisplay(line) {
  if (!line || typeof line !== "object") {
    return { statusLabel: "—", trackingLabel: "—" };
  }
  const status = getLineFulfillmentStatus(line);
  const carrier = String(line.tracking_carrier || line.ti_tracking_carrier || "").trim();
  const trackingNumber = String(line.tracking_number || line.ti_tracking_number || "").trim();
  const trackingLabel = [carrier, trackingNumber].filter(Boolean).join(" · ") || "—";
  const purchased = getLinePurchasedQty(line);
  const shipped = getLineShippedQty(line);

  if (NOT_REQUIRED_FULFILLMENT_STATUSES.has(status) || (!lineRequiresShipping(line) && shipped <= 0)) {
    return { statusLabel: "—", trackingLabel: "—" };
  }
  if (purchased > 0) {
    if (shipped <= 0) return { statusLabel: "Not shipped", trackingLabel: "—" };
    if (shipped >= purchased) return { statusLabel: "Shipped", trackingLabel };
    return { statusLabel: `${shipped}/${purchased}`, trackingLabel };
  }
  if (isLineFullyShipped(line) || SHIPPED_FULFILLMENT_STATUSES.has(status)) {
    return { statusLabel: "Shipped", trackingLabel };
  }
  if (["not_shipped", "pending_shipment", "awaiting_shipment", "unfulfilled", "pending", "ready_to_ship"].includes(status) || lineRequiresShipping(line)) {
    return { statusLabel: "Not shipped", trackingLabel: "—" };
  }
  return { statusLabel: "—", trackingLabel: "—" };
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

  if (isTruthyShippingFlag(first.all_items_shipped) || ["in_transit", "shipped", "delivered", "fulfilled", "complete"].includes(txnStatus)) {
    return "complete";
  }
  if (txnStatus === "partial" || txnStatus === "partially_shipped") return "partial";
  if (["not_shipped", "pending_shipment", "awaiting_shipment", "unfulfilled"].includes(txnStatus)) return "none";

  if (!scoreLines.length) {
    // Nested lines present but all not_required → shipping N/A.
    if (withItemUid.length > 0 && withItemUid.every((line) => !lineRequiresShipping(line))) {
      return "not_required";
    }
    // Summary-only list row (shipping address, no line statuses) → unknown until hydrated from order detail.
    return "unknown";
  }

  let shippedCount = 0;
  let anyKnownStatus = false;
  let anyPartialQty = false;
  for (const line of scoreLines) {
    const status = getLineFulfillmentStatus(line);
    const purchased = getLinePurchasedQty(line);
    const shippedQty = getLineShippedQty(line);
    if (status || isTruthyShippingFlag(line.shipped) || line.ti_shipped_at || line.shipped_at || shippedQty > 0) anyKnownStatus = true;
    if (purchased > 0 && shippedQty > 0 && shippedQty < purchased) anyPartialQty = true;
    if (isLineFullyShipped(line)) shippedCount += 1;
  }

  if (shippedCount <= 0) {
    if (anyPartialQty) return "partial";
    return anyKnownStatus || rows.some(orderNeedsShipping) ? "none" : "unknown";
  }
  if (shippedCount >= scoreLines.length) return "complete";
  return "partial";
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

function getOrderDeliveredStatus(saleRows, shippingProgressOverride) {
  if (!Array.isArray(saleRows) || !saleRows.length) return "—";
  const inEscrow = saleRows.some((row) => Number(row.transaction_in_escrow ?? row.in_escrow) === 1);

  // No shipping needed: "—" while still in escrow; "Paid" once funds are released.
  if (saleRows.every(orderFulfillmentIsNotRequired)) {
    return inEscrow ? "—" : "Paid";
  }

  const progress =
    shippingProgressOverride === "complete" ||
    shippingProgressOverride === "partial" ||
    shippingProgressOverride === "none" ||
    shippingProgressOverride === "not_required"
      ? shippingProgressOverride
      : getOrderShippingProgress(saleRows);
  if (progress === "not_required") return inEscrow ? "—" : "Paid";
  if (progress === "none") return "Not Shipped";
  if (progress === "partial") return "Partial";
  // progress === "complete": all shipping work done → escrow-aware Shipped / Paid
  // progress === "unknown" with shipping but no line-level data: wait for order-detail hydration (don't flash Not Shipped)
  if (progress === "unknown" && saleRows.some((row) => orderNeedsShipping(row))) {
    return "—";
  }
  if (progress === "complete") {
    if (inEscrow) return "Shipped";
    return "Paid";
  }
  if (inEscrow) return "Pending";
  return "Paid";
}

/** True when purchase qty evidence shows the buyer has confirmed full receipt (ignores escrow). */
function isPurchaseFullyReceivedByQty(transaction) {
  if (!transaction || typeof transaction !== "object") return false;
  const purchased = Math.max(0, parseInt(transaction.ti_bs_qty, 10) || 0);
  if (purchased > 0 && transaction.ti_received_qty != null && String(transaction.ti_received_qty).trim() !== "") {
    const received = Math.max(0, Math.round(parsePrice(transaction.ti_received_qty)));
    if (received >= purchased) return true;
  }
  const receivedCount = parseInt(transaction.received_item_count ?? transaction.delivered_item_count, 10);
  const totalItems = parseInt(
    transaction.item_count ?? transaction.total_item_count ?? transaction.shippable_item_count ?? purchased,
    10,
  );
  if (Number.isFinite(receivedCount) && Number.isFinite(totalItems) && totalItems > 0 && receivedCount >= totalItems) {
    return true;
  }
  return false;
}

/** Buyer PURCHASES Delivered column — return logistics first, then shipping progress. */
function getBuyerPurchaseDeliveredLabel(transaction, statusOverride = {}) {
  const returnLogistics = resolveReturnLogisticsLabels(transaction, statusOverride);
  if (returnLogistics) return returnLogistics.delivered;
  if (!transaction || isReturnListRow(transaction)) return "—";
  if (orderFulfillmentIsNotRequired(transaction)) {
    return Number(transaction.transaction_in_escrow) === 1 ? "—" : "Paid";
  }
  return getOrderDeliveredStatus([transaction]);
}

/**
 * Buyer PURCHASES Received column.
 * Return money state (Pending / Refunded / Rejected) first; otherwise shipping receipt Yes/No/Partial.
 */
function getBuyerPurchaseReceivedLabel(transaction, statusOverride = {}) {
  const returnLogistics = resolveReturnLogisticsLabels(transaction, statusOverride);
  if (returnLogistics) return returnLogistics.received;
  if (!transaction || isReturnListRow(transaction)) return "—";

  const fromRows = getOrderReceivedStatusFromSaleRows([transaction]);
  if (fromRows === "Yes" || fromRows === "Partial" || fromRows === "No") return fromRows;

  if (Number(transaction.transaction_in_escrow) === 1) return "No";
  return "Yes";
}

/**
 * Received status for seller ORDERS (and product-sales order rows).
 * Prefers unit totals / list counts / per-line ti_received_qty.
 * Partial = some but not all units confirmed received while order is still open.
 */
function getOrderReceivedStatusFromSaleRows(saleRows) {
  if (!Array.isArray(saleRows) || !saleRows.length) return "—";
  const first = saleRows[0] || {};
  const inEscrow = saleRows.some((row) => Number(row.transaction_in_escrow ?? row.in_escrow) === 1);

  // Hydrated unit totals from order-detail lines (most accurate for Partial).
  const hydratedReceived = parseInt(first.received_units ?? first.received_units_total, 10);
  const hydratedPurchased = parseInt(first.purchased_units ?? first.purchased_units_total, 10);
  if (Number.isFinite(hydratedReceived) && Number.isFinite(hydratedPurchased) && hydratedPurchased > 0) {
    if (hydratedReceived <= 0) return inEscrow ? "No" : "Yes";
    if (hydratedReceived >= hydratedPurchased) return "Yes";
    return "Partial";
  }

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

  let hasExplicitLineReceived = false;
  let anyReceived = false;
  let allReceived = true;
  let purchasedTracked = 0;
  let receivedTracked = 0;
  for (const row of saleRows) {
    if (row?.ti_received_qty == null || String(row.ti_received_qty).trim() === "") continue;
    hasExplicitLineReceived = true;
    const purchased = getSaleLineQty(row);
    const received = Math.max(0, Math.round(parsePrice(row.ti_received_qty)));
    purchasedTracked += purchased;
    receivedTracked += received;
    if (received > 0) anyReceived = true;
    if (received < purchased) allReceived = false;
  }
  if (hasExplicitLineReceived) {
    if (purchasedTracked > 0) {
      if (receivedTracked <= 0) return "No";
      if (receivedTracked >= purchasedTracked) return "Yes";
      return "Partial";
    }
    if (allReceived) return "Yes";
    if (!anyReceived) return "No";
    return "Partial";
  }

  // Account-screen seller summary rows often omit received fields.
  // Escrow released ⇒ Delivered shows Paid ⇒ treat as fully received for list display.
  if (!inEscrow) return "Yes";
  return "No";
}

/** Sum purchased vs received units from an order-detail sale.lines payload. */
function summarizeReceivedUnitsFromOrderDetail(orderDetail) {
  const sale = orderDetail?.sale || orderDetail;
  const lines = Array.isArray(sale?.lines) ? sale.lines : [];
  if (!lines.length) return null;
  let purchased = 0;
  let received = 0;
  for (const line of lines) {
    purchased += Math.max(0, getSaleLineQty(line));
    received += Math.max(0, Math.round(parsePrice(line.ti_received_qty ?? line.received_qty)));
  }
  if (purchased <= 0) return null;
  return { purchased, received };
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
  return buildBusinessOrdersListFromSellerTransactions(
    scopedLines,
    bountyLines,
    shippingProgressByKey,
    returnStatusesByKey,
  );
}

function BusinessOrdersTable({ rows, darkMode, maxBodyHeight = 320, onOrderPress, onReturnPress }) {
  const detailRows = rows || [];
  const totals = sumBusinessOrderRows(detailRows);

  const renderStatusBadge = (kind, label) => {
    const badgeStyle = getProductSaleStatusBadgeStyle(kind, label);
    return (
      <View style={[styles.productSalesDetailStatusBadge, badgeStyle.badge]}>
        <Text style={[styles.productSalesDetailStatusBadgeText, badgeStyle.text]}>{label}</Text>
      </View>
    );
  };

  const isShipActionDeliveredLabel = (label) => {
    const normalized = String(label || "").trim().toLowerCase();
    return normalized === "not shipped" || normalized === "partial";
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
          <Text style={[styles.productSalesDetailHeaderCell, styles.productSalesDetailColMoney]}>Total</Text>
          <Text style={[styles.productSalesDetailHeaderCell, styles.productSalesDetailColMoney]}>Bounty</Text>
          <Text style={[styles.productSalesDetailHeaderCell, styles.productSalesDetailColStatus]}>Delivered</Text>
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
            <View
              key={row.key}
              style={[
                styles.productSalesDetailDataRow,
                index < detailRows.length - 1 && styles.productSalesDetailDataRowBorder,
                darkMode && styles.productSalesDetailDataRowDark,
              ]}
            >
              <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColType, isReturnRow && { color: "#B71C1C", fontWeight: "600" }, darkMode && !isReturnRow && { color: "#ccc" }]}>
                {row.rowLabel || "Order"}
              </Text>
              {onOrderPress || onReturnPress ? (
                <TouchableOpacity
                  style={styles.productSalesDetailColOrder}
                  onPress={() => (isReturnRow ? openReturn() : openOrder())}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.productSalesDetailCell, styles.productSalesDetailTxnLink]}>{row.orderUid}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColOrder, styles.productSalesDetailTxnLink]}>{row.orderUid}</Text>
              )}
              <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColPlacedBy, styles.productSalesDetailOrderText, darkMode && { color: "#eee" }]}>
                {row.placedBy}
              </Text>
              <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColDate, darkMode && { color: "#ccc" }]}>{row.dateLabel}</Text>
              <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColMoney, isReturnRow && { color: "#B71C1C" }, darkMode && !isReturnRow && { color: "#ccc" }]}>
                {formatSignedOrderMoney(row.total)}
              </Text>
              <Text style={[styles.productSalesDetailCell, styles.productSalesDetailColMoney, isReturnRow && { color: "#B71C1C" }, darkMode && !isReturnRow && { color: "#ccc" }]}>
                {formatSignedOrderMoney(row.bountyPaid)}
              </Text>
              <View style={[styles.productSalesDetailColStatus, styles.productSalesDetailStatusCell]}>
                {isReturnRow && onReturnPress ? (
                  <TouchableOpacity onPress={openReturn} activeOpacity={0.7}>
                    {renderStatusBadge("delivered", row.delivered)}
                  </TouchableOpacity>
                ) : onOrderPress && !isReturnRow && isShipActionDeliveredLabel(row.delivered) ? (
                  <TouchableOpacity onPress={openOrder} activeOpacity={0.7}>
                    {renderStatusBadge("delivered", row.delivered)}
                  </TouchableOpacity>
                ) : (
                  renderStatusBadge("delivered", row.delivered)
                )}
              </View>
              <View style={[styles.productSalesDetailColStatus, styles.productSalesDetailStatusCell]}>
                {isReturnRow && onReturnPress ? (
                  <TouchableOpacity onPress={openReturn} activeOpacity={0.7}>
                    {renderStatusBadge("received", row.received)}
                  </TouchableOpacity>
                ) : (
                  renderStatusBadge("received", row.received)
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
          <Text style={[styles.productSalesDetailTotalValue, styles.productSalesDetailColMoney, darkMode && { color: "#eee" }]}>
            {formatSignedOrderMoney(totals.total)}
          </Text>
          <Text style={[styles.productSalesDetailTotalValue, styles.productSalesDetailColMoney, darkMode && { color: "#eee" }]}>
            {formatSignedOrderMoney(totals.bountyPaid)}
          </Text>
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
    if (normalized === "pending") {
      return { badge: { backgroundColor: "#FFF8E1" }, text: { color: "#F57F17" } };
    }
    if (normalized === "shipped") {
      return { badge: { backgroundColor: "#E3F2FD" }, text: { color: "#1565C0" } };
    }
    if (normalized === "returning") {
      return { badge: { backgroundColor: "#FFF3E0" }, text: { color: "#E65100" } };
    }
    if (normalized === "returned") {
      return { badge: { backgroundColor: "#FFEBEE" }, text: { color: "#B71C1C" } };
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
    if (normalized.includes("/")) {
      return { badge: { backgroundColor: "#FFF8E1" }, text: { color: "#F57F17" } };
    }
    return { badge: { backgroundColor: "#F5F5F5" }, text: { color: "#616161" } };
  }
  if (normalized === "yes" || normalized === "complete" || normalized === "refunded") {
    return { badge: { backgroundColor: "#E8F5E9" }, text: { color: "#2E7D32" } };
  }
  if (normalized === "verify") {
    return { badge: { backgroundColor: "#E3F2FD" }, text: { color: "#1565C0" } };
  }
  if (normalized === "partial" || normalized === "pending") {
    return { badge: { backgroundColor: "#FFF8E1" }, text: { color: "#F57F17" } };
  }
  if (normalized === "returning") {
    return { badge: { backgroundColor: "#FFF3E0" }, text: { color: "#E65100" } };
  }
  if (normalized === "returned" || normalized === "rejected") {
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

  return { bountyResult, sellerLines, businessForMiniCardRaw, businessServices };
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

function buildUnitsAvailableByProductUid(services) {
  const map = {};
  for (const service of services || []) {
    const uid = String(service?.bs_uid || service?.ti_bs_id || "").trim();
    if (!uid) continue;
    map[uid] = formatBusinessServiceUnitsAvailable(service.bs_quantity ?? service.quantity);
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
    sellerTx.forEach((transaction) => {
      if (transaction.ti_bs_id === expertiseUid) {
        const qty = parseInt(transaction.ti_bs_qty) || 0;
        soldQty += qty;
      }
    });
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

export default function AccountScreen({ navigation }) {
  const { darkMode } = useDarkMode();
  const { width: windowWidth } = useWindowDimensions();
  const [userUID, setUserUID] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bountyData, setBountyData] = useState(null);
  const [bountyLoading, setBountyLoading] = useState(true);
  const [personalWallet, setPersonalWallet] = useState(null);
  const [transactionData, setTransactionData] = useState([]);
  const [transactionLoading, setTransactionLoading] = useState(true);
  const [expertiseData, setExpertiseData] = useState([]);
  const [expertiseLoading, setExpertiseLoading] = useState(true);
  const [sellerTxData, setSellerTxData] = useState([]);
  const [salesModal, setSalesModal] = useState({ visible: false, item: null, transactions: [] });
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
  });
  const [returnDetailModal, setReturnDetailModal] = useState({
    visible: false,
    orderUid: null,
    transactionUid: null,
    orderDetail: null,
    loading: false,
    error: null,
    bountyPaidFallback: 0,
  });
  const [returnItemReceivedChecked, setReturnItemReceivedChecked] = useState(false);
  const [returnDetailAccepting, setReturnDetailAccepting] = useState(false);
  const [returnDetailDeclining, setReturnDetailDeclining] = useState(false);
  const [returnConfirmResult, setReturnConfirmResult] = useState(null);
  const [businessTransactionData, setBusinessTransactionData] = useState([]);
  const [businessTransactionLoading, setBusinessTransactionLoading] = useState(true);
  const [businessUID, setBusinessUID] = useState(null);
  const [businessBountyData, setBusinessBountyData] = useState(null);
  const [businessBountyLoading, setBusinessBountyLoading] = useState(true);
  const [businessServices, setBusinessServices] = useState([]);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [businesses, setBusinesses] = useState([]);
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
  const [showWallet, setShowWallet] = useState(true);

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

  const [autoPaidTransactionIds, setAutoPaidTransactionIds] = useState(new Set());
  const autoPayAttemptedRef = useRef(new Set());

  //for returns
  const [returnRequests, setReturnRequests] = useState({});
  const [receiptTransaction, setReceiptTransaction] = useState(null);
  /** Settings → Debug Mode = Yes: show Transaction ID, Type, Purchased Item in PURCHASES (wide enough); Purchased Item on web also when width > 600. */
  const [settingsDebugModeEnabled, setSettingsDebugModeEnabled] = useState(false);

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
  /** Ignore in-flight account-screen responses after a profile switch. */
  const personalFetchGenRef = useRef(0);
  const businessFetchGenRef = useRef(0);

  /** Avoid stale `selectedAccount` / `businessUID` / `businesses` inside `refreshAccountScreenBusiness` when invoked from a focus callback with `[]` deps */
  const selectedAccountRef = useRef(selectedAccount);
  const businessUIDRef = useRef(businessUID);
  const businessesRef = useRef(businesses);

  const [receiptEnrichedItems, setReceiptEnrichedItems] = useState({});

  useEffect(() => {
    selectedAccountRef.current = selectedAccount;
  }, [selectedAccount]);
  useEffect(() => {
    businessUIDRef.current = businessUID;
  }, [businessUID]);
  useEffect(() => {
    businessesRef.current = businesses;
  }, [businesses]);

  const clearPersonalAccountSections = () => {
    setTransactionData([]);
    setExpertiseData([]);
    setSellerTxData([]);
    setBountyData(null);
    setPersonalWallet(null);
    setTransactionLoading(true);
    setBountyLoading(true);
    setExpertiseLoading(true);
  };

  const clearBusinessAccountSections = () => {
    setBusinessTransactionData([]);
    setBusinessBountyData(null);
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
  const [returnModalReceiptData, setReturnModalReceiptData] = useState([]);
  const [returnModalOrderLines, setReturnModalOrderLines] = useState([]);
  const [returnModalLoading, setReturnModalLoading] = useState(false);
  const [receiptOrderDetail, setReceiptOrderDetail] = useState(null);

  const [businessReceiptCache, setBusinessReceiptCache] = useState({});
  /** Avoid duplicate receipt GETs when re-expanding the same business transaction */
  const businessReceiptFetchedRef = useRef(new Set());

  const [showDeclineNoteModal, setShowDeclineNoteModal] = useState(false);
  const [declineNote, setDeclineNote] = useState("");
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
        const unitCost = tiCost > 0 ? tiCost : (qty > 0 ? totalAmt / qty : totalAmt);
        // Prefer ti_bs_id (expertise UID) from the transaction row; if missing use any key
        // from localEnrichedItems that has an offeringCostString so the lookup still works.
        const txExpertiseId = String(transaction.ti_bs_id || "").trim();
        const enrichedExpertiseKey = txExpertiseId
          || Object.keys(localEnrichedItems).find((k) => localEnrichedItems[k]?.offeringCostString)
          || String(transaction.transaction_uid || "").trim();
        items = [{
          ti_uid: String(transaction.ti_uid || transaction.transaction_uid || "").trim(),
          ti_bs_id: enrichedExpertiseKey,
          bs_uid: enrichedExpertiseKey,
          bs_service_name: transaction.purchased_item || "",
          bs_service_desc: "",
          ti_bs_cost: unitCost,
          ti_bs_qty: qty,
        }];
      }

      const apiEnrichMap = {};
      items.forEach((row) => {
        const parsed = enrichFromReceiptRow(row);
        if (!parsed) return;
        const tiUid = row.ti_uid != null ? String(row.ti_uid).trim() : "";
        const bsId =
          row.ti_bs_id != null && String(row.ti_bs_id).trim() !== ""
            ? String(row.ti_bs_id).trim()
            : row.bs_uid != null && String(row.bs_uid).trim() !== ""
              ? String(row.bs_uid).trim()
              : "";
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

  const handleReturnRequest = async (transaction, buyerNote, transactionReturnItems) => {
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
    try {
      const note = (buyerNote || "").trim();
      const existingNote = returnRequests[saleUid]?.notes?.map((n) => n.note).join("\n\n---RETURN---\n\n") || "";
      const allNotes = existingNote ? `${existingNote}\n\n---RETURN---\n\n${note}` : note;
      const response = await fetch(TRANSACTIONS_RETURN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          transaction_uid: saleUid,
          transaction_return_requested: 1,
          transaction_return_note: allNotes,
          transaction_return_items: transactionReturnItems,
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
      const resultPayload =
        requestResult?.data && typeof requestResult.data === "object" ? requestResult.data : requestResult || {};
      const returningState = extractReturnRefundState(resultPayload, {
        return_status: resultPayload.return_status || "returning",
        refund_status: resultPayload.refund_status || "pending",
        display_status: resultPayload.display_status || "Returning - Pending",
        returnRequested: 1,
      });
      setReturnStatuses((prev) => ({
        ...prev,
        [saleUid]: {
          return_status: returningState.return_status || "returning",
          refund_status: returningState.refund_status || "pending",
          display_status: returningState.display_status || "Returning - Pending",
        },
      }));
      await AsyncStorage.setItem(
        `return_status_${saleUid}`,
        JSON.stringify({
          return_status: returningState.return_status || "returning",
          refund_status: returningState.refund_status || "pending",
          display_status: returningState.display_status || "Returning - Pending",
        }),
      );
      const existing = returnRequests[saleUid] || { items: [], notes: [] };
      const itemQuantities = selectedReturnItems.reduce((acc, id) => {
        acc[id] = returnItemQuantities[id] ?? 1;
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
    const fromAccount =
      selectedAccount && selectedAccount !== "personal"
        ? String(selectedAccount).trim()
        : businessUID
          ? String(businessUID).trim()
          : "";
    if (fromAccount) return fromAccount;
    const fromDetail = String(
      returnDetailModal.orderDetail?.sale?.transaction_business_id ||
        returnDetailModal.orderDetail?.sale?.business_id ||
        returnDetailModal.orderDetail?.business_uid ||
        "",
    ).trim();
    if (fromDetail) return fromDetail;
    const fromList = (businessSellerTransactionList || []).find((row) => {
      const uid = String(row.transaction_uid || "").trim();
      const orderUid = resolveListRowOrderUid(row);
      return uid === transactionUid || orderUid === transactionUid;
    });
    return String(fromList?.transaction_business_id || fromList?.business_uid || "").trim();
  };

  const persistReturnRefundState = async (statusKeys, state) => {
    const payload = {
      return_status: state.return_status,
      refund_status: state.refund_status,
      display_status: state.display_status,
    };
    setReturnStatuses((prev) => {
      const next = { ...prev };
      for (const key of statusKeys) next[key] = payload;
      return next;
    });
    await Promise.all(statusKeys.map((key) => AsyncStorage.setItem(`return_status_${key}`, JSON.stringify(payload))));
    setBusinessSellerTransactionList((prev) =>
      (prev || []).map((row) => {
        const uid = String(row.transaction_uid || "").trim();
        const orderUid = resolveListRowOrderUid(row);
        if (statusKeys.includes(uid) || statusKeys.includes(orderUid)) {
          return applyReturnRefundFieldsToRow(row, payload);
        }
        return row;
      }),
    );
    setBusinessTransactionData((prev) =>
      (prev || []).map((row) => {
        const uid = String(row.transaction_uid || "").trim();
        if (statusKeys.includes(uid)) {
          return applyReturnRefundFieldsToRow(row, payload);
        }
        return row;
      }),
    );
  };

  const handleSellerReturnConfirmAction = async ({
    transactionUid,
    orderUidForStatus,
    action,
    sellerNote = "",
  }) => {
    const sellerId = resolveSellerIdForReturn(transactionUid);
    if (!sellerId) {
      Alert.alert("Error", "Missing seller_id for return confirmation.");
      return { ok: false };
    }
    try {
      const body = {
        transaction_uid: transactionUid,
        seller_id: sellerId,
        action,
        transaction_return_seller_note: sellerNote || (action === "confirm" ? "Item received" : ""),
      };
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
      const state = extractReturnRefundState(payload, {
        return_status: payload.return_status || defaults.return_status,
        refund_status: payload.refund_status || defaults.refund_status,
        display_status: payload.display_status || defaults.display_status,
        returnRequested: 1,
      });
      const statusKeys = [transactionUid, orderUidForStatus].map((k) => String(k || "").trim()).filter(Boolean);
      await persistReturnRefundState(statusKeys, state);
      setShowReturnNoteViewModal(false);
      return {
        ok: true,
        state,
        result: payload,
        stripe_refund: payload.stripe_refund,
        return_transaction_uid: payload.return_transaction_uid,
        refund_breakdown: payload.refund_breakdown,
      };
    } catch (error) {
      console.error(`Error on return ${action}:`, error);
      Alert.alert("Error", action === "confirm" ? "Failed to confirm return receipt." : "Failed to reject return.");
      return { ok: false };
    }
  };

  const handleReturnAccept = async (transactionUid, orderUidForStatus, sellerNote = "Item received") => {
    return handleSellerReturnConfirmAction({
      transactionUid,
      orderUidForStatus,
      action: "confirm",
      sellerNote,
    });
  };

  const handleReturnDecline = async (transactionUid, note = "", orderUidForStatus) => {
    return handleSellerReturnConfirmAction({
      transactionUid,
      orderUidForStatus,
      action: "decline",
      sellerNote: note,
    });
  };

  const loadAutoPaidIds = async () => {
    try {
      const stored = await AsyncStorage.getItem("auto_paid_transaction_ids");
      if (stored) {
        setAutoPaidTransactionIds(new Set(JSON.parse(stored)));
      }
    } catch (e) {
      console.error("Failed to load auto-paid IDs:", e);
    }
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
      setReceiptEnrichedItems({ ...cartEnrichMap, ...persistedChoices });
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
    } catch (e) {
      console.error("Failed to load return statuses:", e);
    }
  };

  const saveAutoPaidId = async (transactionUid) => {
    try {
      console.log("saveAutoPaidId called with:", transactionUid); // ← add
      const stored = await AsyncStorage.getItem("auto_paid_transaction_ids");
      console.log("existing stored value:", stored); // ← add
      const existing = stored ? JSON.parse(stored) : [];
      const updated = [...new Set([...existing, transactionUid])];
      await AsyncStorage.setItem("auto_paid_transaction_ids", JSON.stringify(updated));
      console.log("saved updated list:", updated); // ← add
      setAutoPaidTransactionIds(new Set(updated));
    } catch (e) {
      console.error("Failed to save auto-paid ID:", e);
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
          setExpertiseData(buildExpertiseRows(expertiseList, []));
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
        const mapped = mapAccountScreenPersonalResponse(json);

        const purchaseRows = Array.isArray(mapped.transactions) ? mapped.transactions : [];
        setTransactionData(purchaseRows);

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

        const sellerTx = Array.isArray(mapped.sellerTransactions) ? mapped.sellerTransactions : [];

        const session = await getSessionProfile();
        const profileResult = session?.rawProfile;
        let expertiseList = [];
        if (mapped.profile?.expertise_info != null) {
          expertiseList = parseExpertiseInfo(mapped.profile.expertise_info);
        } else if (profileResult?.expertise_info) {
          expertiseList = parseExpertiseInfo(profileResult.expertise_info);
        }
        if (fetchGen !== personalFetchGenRef.current || selectedAccountRef.current !== "personal") return;
        setSellerTxData(sellerTx);
        setExpertiseData(buildExpertiseRows(expertiseList, sellerTx));
      } catch (error) {
        if (fetchGen !== personalFetchGenRef.current || selectedAccountRef.current !== "personal") return;
        console.error("Error loading account-screen personal:", error);
        setTransactionData([]);
        setBountyData({ error: error.message });
        setPersonalWallet(null);
        setExpertiseData([]);
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
      setDeliveryVerificationReceiptData(items);
    } catch (error) {
      console.error("Error loading delivery verification items:", error);
      Alert.alert("Error", error.message || "Failed to load order items.");
      resetDeliveryVerificationModal();
    } finally {
      setDeliveryVerificationLoading(false);
    }
  };

  const updateTransactionEscrow = async (transactionUid, deliveryVerificationItems, releaseEscrow) => {
    const profileId =
      pendingTransactionForConfirm?.transaction_profile_id ||
      (await getSessionProfile())?.profileUid ||
      (await AsyncStorage.getItem("profile_uid"));
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
        const detail = await formatFetchErrorAlertMessage(response, [
          "Failed to confirm delivery.",
          `Request:\n${JSON.stringify(requestBody, null, 2)}`,
        ]);
        console.error("Error updating transaction escrow:", detail);
        Alert.alert("Could not confirm delivery", detail);
        return;
      }
      resetDeliveryVerificationModal();
      await refreshAccountScreenPersonal();
      if (!releaseEscrow) {
        Alert.alert("Partial delivery recorded", "Escrow will release when all items in this order are confirmed received.");
      }
    } catch (error) {
      console.error("Error updating transaction escrow:", error);
      const detail = [
        "Failed to confirm delivery.",
        error?.message ? String(error.message) : "Please try again.",
        `Request:\n${JSON.stringify(requestBody, null, 2)}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      Alert.alert("Could not confirm delivery", detail);
    } finally {
      setUpdatingEscrow(false);
    }
  };

  // Fetch user's businesses to get business_uid
  const fetchUserBusinesses = async () => {
    try {
      const session = await getSessionProfile();
      const profileId = session?.profileUid || (await AsyncStorage.getItem("profile_uid"));
      if (!profileId) {
        console.log("No profile ID found");
        return null;
      }

      const result = session?.rawProfile;
      if (!result) {
        console.log("Failed to load user profile");
        return null;
      }
      console.log("User businesses:", result.business_info);

      // Parse business_info to get business UIDs
      const businessList = result.business_info ? (typeof result.business_info === "string" ? JSON.parse(result.business_info) : result.business_info) : [];

      // Store all businesses in state
      setBusinesses(businessList);
      businessesRef.current = Array.isArray(businessList) ? businessList : [];

      // Get the first business UID
      if (businessList.length > 0) {
        const firstBusiness = businessList[0];
        const businessId = firstBusiness.business_uid || firstBusiness.profile_business_uid;
        console.log("Setting business UID:", businessId);
        setBusinessUID(businessId);
        businessUIDRef.current = businessId;
        return businessId;
      }

      console.log("No businesses found for user");
      businessUIDRef.current = null;
      return null;
    } catch (error) {
      console.error("Error fetching user businesses:", error);
      return null;
    }
  };

  // const fetchUserBusinesses = async () => {
  //   try {
  //     const profileId = await AsyncStorage.getItem("profile_uid");
  //     if (!profileId) {
  //       console.log("No profile ID found");
  //       return null;
  //     }

  //     const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${profileId}`);
  //     if (!response.ok) {
  //       console.log("Failed to fetch user profile");
  //       return null;
  //     }

  //     const result = await response.json();
  //     console.log("User businesses:", result.business_info);

  //     // Parse business_info to get business UIDs
  //     const businessList = result.business_info
  //       ? (typeof result.business_info === "string"
  //           ? JSON.parse(result.business_info)
  //           : result.business_info
  //         )
  //       : [];

  //     // Business details are already in the array — use them directly
  //     console.log("Businesses:", businessList);
  //     setBusinesses(businessList);

  //     // Get the first business UID
  //     if (businessList.length > 0) {
  //       const firstBusiness = businessList[0];
  //       const businessId = firstBusiness.business_uid || firstBusiness.profile_business_uid;
  //       console.log("Setting business UID:", businessId);
  //       setBusinessUID(businessId);
  //       return businessId;
  //     }

  //     console.log("No businesses found for user");
  //     return null;
  //   } catch (error) {
  //     console.error("Error fetching user businesses:", error);
  //     return null;
  //   }
  // };

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
      const biz = selectedAccount !== "personal" ? selectedAccount : businessUID;
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
    [selectedAccount, businessUID],
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
    });
  }, []);

  const closeReturnDetailModal = useCallback(() => {
    setReturnDetailModal({
      visible: false,
      orderUid: null,
      transactionUid: null,
      orderDetail: null,
      loading: false,
      error: null,
      bountyPaidFallback: 0,
    });
    setReturnItemReceivedChecked(false);
    setReturnDetailAccepting(false);
    setReturnDetailDeclining(false);
    setReturnConfirmResult(null);
  }, []);

  const openReturnDetails = useCallback(
    async (orderRow) => {
      const orderUid = orderRow?.orderUid || resolveListRowOrderUid(orderRow?.rawRow || orderRow);
      if (!orderUid || orderUid === "—") return;
      const transactionUid = String(
        orderRow?.listTransactionUid ||
          orderRow?.transaction_uid ||
          orderRow?.rawRow?.transaction_uid ||
          orderUid,
      ).trim();
      const bountyPaidFallback = Number(orderRow?.bountyPaid ?? orderRow?.bounty_paid ?? 0) || 0;

      setReturnItemReceivedChecked(false);
      setReturnConfirmResult(null);
      setReturnDetailModal({
        visible: true,
        orderUid,
        transactionUid,
        orderDetail: null,
        loading: true,
        error: null,
        bountyPaidFallback,
      });

      try {
        const ctx = {};
        const bizUid = selectedAccount !== "personal" ? selectedAccount || businessUID : businessUID;
        if (bizUid) ctx.businessUid = bizUid;
        const orderDetail = await fetchOrderDetailApi(orderUid, ctx);
        setReturnDetailModal((prev) => ({
          ...prev,
          orderDetail,
          loading: false,
          error: null,
          transactionUid:
            String(orderDetail?.sale?.transaction_uid || prev.transactionUid || orderUid).trim(),
        }));
      } catch (err) {
        setReturnDetailModal((prev) => ({
          ...prev,
          loading: false,
          error: err?.message || "Failed to load return details.",
        }));
      }
    },
    [selectedAccount, businessUID],
  );

  const openOrderDetail = useCallback(
    async (orderRow) => {
      const orderUid = orderRow?.orderUid || resolveListRowOrderUid(orderRow?.rawRow || orderRow);
      if (!orderUid || orderUid === "—") return;

      const isSellerView = selectedAccount !== "personal";
      setOrderDetailModal({
        visible: true,
        orderUid,
        orderDetail: null,
        loading: true,
        error: null,
        isSellerView,
      });

      try {
        const ctx = {};
        if (isSellerView) {
          const bizUid = selectedAccount || businessUID;
          if (bizUid) ctx.businessUid = bizUid;
        } else {
          const profileId = (await AsyncStorage.getItem("profile_uid")) || "";
          if (profileId) ctx.profileId = String(profileId).trim();
        }
        const orderDetail = await fetchOrderDetailApi(orderUid, ctx);
        setOrderDetailModal((prev) => ({
          ...prev,
          orderDetail,
          loading: false,
          error: null,
        }));
        const progress = getOrderShippingProgress([orderDetail?.sale || orderDetail].filter(Boolean));
        if (progress === "complete" || progress === "partial" || progress === "none") {
          const keys = [orderUid, orderDetail?.order_uid, orderDetail?.sale?.transaction_uid, orderRow?.listTransactionUid]
            .map((k) => String(k || "").trim())
            .filter(Boolean);
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
    [selectedAccount, businessUID],
  );

  const saveOrderFulfillmentUpdates = useCallback(
    async (requestBody) => {
      if (!requestBody?.transaction_uid || !Array.isArray(requestBody.fulfillment_updates) || !requestBody.fulfillment_updates.length) {
        return false;
      }
      const sellerIdFromAccount =
        selectedAccount && selectedAccount !== "personal"
          ? String(selectedAccount).trim()
          : businessUID
            ? String(businessUID).trim()
            : "";
      const sellerIdFromOrder = String(
        orderDetailModal.orderDetail?.sale?.transaction_business_id ||
          orderDetailModal.orderDetail?.sale?.business_id ||
          orderDetailModal.orderDetail?.sale?.seller_id ||
          orderDetailModal.orderDetail?.business_uid ||
          "",
      ).trim();
      const sellerId = sellerIdFromAccount || sellerIdFromOrder;
      if (!sellerId) {
        Alert.alert("Could not save shipment", "Missing seller business id. Switch to a business profile and try again.");
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
          const detail = await formatFetchErrorAlertMessage(response, [
            "Failed to save shipped items.",
            `Request:\n${JSON.stringify(payload, null, 2)}`,
          ]);
          Alert.alert("Could not save shipment", detail);
          return false;
        }

        const orderUid = orderDetailModal.orderUid;
        const isSellerView = orderDetailModal.isSellerView;
        const transactionUid = String(payload.transaction_uid || "").trim();

        // Optimistic list update: account-screen seller rows often omit per-item fulfillment fields.
        const shippedItemUids = new Set(
          (payload.fulfillment_updates || []).map((u) => String(u.transaction_item_uid || "").trim()).filter(Boolean),
        );
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
                  const prevShipped = getLineShippedQty(line);
                  const thisShipQty = Math.max(1, parseInt(update?.shipped_quantity, 10) || purchased - prevShipped);
                  const nextShipped = Math.min(purchased, prevShipped + thisShipQty);
                  return {
                    ...line,
                    fulfillment_status: nextShipped >= purchased ? "in_transit" : "partial",
                    ti_fulfillment_status: nextShipped >= purchased ? "in_transit" : "partial",
                    shipped_qty: nextShipped,
                    ti_shipped_qty: nextShipped,
                    shipped_quantity: nextShipped,
                    tracking_carrier: update?.tracking_carrier || line.tracking_carrier,
                    tracking_number: update?.tracking_number || line.tracking_number,
                  };
                }),
              }
            : priorSale
              ? { ...priorSale, fulfillment_status: "in_transit", all_items_shipped: 1 }
              : { transaction_uid: transactionUid, fulfillment_status: "in_transit", all_items_shipped: 1 };
        const optimisticProgress = getOrderShippingProgress([optimisticSale]);
        const keysToUpdate = [transactionUid, orderUid, priorDetail?.order_uid, priorSale?.transaction_uid]
          .map((k) => String(k || "").trim())
          .filter(Boolean);
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
        }
        if (orderUid && orderUid !== "—") {
          try {
            const ctx = {};
            if (isSellerView) {
              const bizUid = selectedAccount || businessUID;
              if (bizUid) ctx.businessUid = bizUid;
            } else {
              const profileId = (await AsyncStorage.getItem("profile_uid")) || "";
              if (profileId) ctx.profileId = String(profileId).trim();
            }
            const orderDetail = await fetchOrderDetailApi(orderUid, ctx);
            setOrderDetailModal((prev) => ({
              ...prev,
              orderDetail,
              loading: false,
              error: null,
            }));
            const refreshedProgress = getOrderShippingProgress([orderDetail?.sale || orderDetail].filter(Boolean));
            const refreshKeys = [
              transactionUid,
              orderUid,
              orderDetail?.order_uid,
              orderDetail?.sale?.transaction_uid,
            ]
              .map((k) => String(k || "").trim())
              .filter(Boolean);
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
          [
            "Failed to save shipped items.",
            error?.message ? String(error.message) : "Please try again.",
            `Request:\n${JSON.stringify(payload, null, 2)}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        );
        return false;
      }
    },
    [orderDetailModal.orderUid, orderDetailModal.isSellerView, orderDetailModal.orderDetail, selectedAccount, businessUID],
  );

  const openReturnNoteModalFromReceipt = useCallback(async () => {
    const orderUid = resolveListRowOrderUid(receiptTransaction);
    setReturnModalOrderLines([]);
    setReturnModalReceiptData([]);
    setSelectedReturnItems([]);
    setReturnItemQuantities({});
    setShowReceiptModal(false);
    setShowReturnNoteModal(true);
    setReturnModalLoading(true);

    const saleLines = receiptOrderDetail?.sale?.lines;
    if (Array.isArray(saleLines) && saleLines.length > 0) {
      setReturnModalOrderLines(saleLines);
      setReturnModalLoading(false);
      return;
    }

    try {
      const profileId = receiptTransaction?.transaction_profile_id || (await AsyncStorage.getItem("profile_uid"));
      if (!profileId || !orderUid || orderUid === "—") {
        throw new Error("Missing profile or order id.");
      }
      const orderDetail = await fetchOrderDetailApi(orderUid, { profileId: String(profileId).trim() });
      setReturnModalOrderLines(Array.isArray(orderDetail?.sale?.lines) ? orderDetail.sale.lines : []);
      setReceiptOrderDetail(orderDetail);
    } catch (error) {
      console.warn("openReturnNoteModalFromReceipt:", error?.message || error);
      if (Array.isArray(receiptData) && receiptData.length > 0) {
        setReturnModalReceiptData(receiptData);
        setReturnModalOrderLines([]);
      } else {
        setReturnModalOrderLines([]);
        Alert.alert("Error", "Could not load order lines for return. Please try again.");
        setShowReturnNoteModal(false);
      }
    } finally {
      setReturnModalLoading(false);
    }
  }, [receiptTransaction, receiptOrderDetail, receiptData]);

  /**
   * GET /api/v1/account-screen/business/:business_uid — product results + seller lines for grouping/receipts.
   * @param {string} [primaryBusinessUidOverride] — optional first-business uid before `businessUID` state commits.
   */
  const refreshAccountScreenBusiness = async (primaryBusinessUidOverride) => {
    const fetchGen = businessFetchGenRef.current;
    const targetBusinessUID =
      selectedAccountRef.current !== "personal"
        ? selectedAccountRef.current
        : primaryBusinessUidOverride ?? businessUIDRef.current;

    const shouldApplyBusinessResponse = () =>
      fetchGen === businessFetchGenRef.current &&
      selectedAccountRef.current !== "personal" &&
      targetBusinessUID != null &&
      String(selectedAccountRef.current) === String(targetBusinessUID);

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
        const row = businessesRef.current.find((b) => (b.business_uid || b.profile_business_uid) === targetBusinessUID);
        setSelectedBusinessFullData(mapSessionBusinessRowToMiniCard(row));
        return;
      }

      if (!response.ok) {
        console.error(`account-screen business HTTP ${response.status}`);
        setBusinessTransactionData([]);
        setBusinessBountyData(null);
        setBusinessServices([]);
        businessReceiptFetchedRef.current = new Set();
        const row = businessesRef.current.find((b) => (b.business_uid || b.profile_business_uid) === targetBusinessUID);
        setSelectedBusinessFullData(mapSessionBusinessRowToMiniCard(row));
        return;
      }

      const json = await response.json();
      if (!shouldApplyBusinessResponse()) return;
      if (!accountScreenResponseMatches(json, "business", targetBusinessUID)) return;

      const { bountyResult, sellerLines, businessForMiniCardRaw, businessServices: servicesFromPayload } = mapAccountScreenBusinessResponse(json);
      setBusinessServices(Array.isArray(servicesFromPayload) ? servicesFromPayload : []);

      const selectedBusiness = businessesRef.current.find((b) => (b.business_uid || b.profile_business_uid) === targetBusinessUID);

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

      setBusinessSellerTransactionList(sellerLines);
      // Reset hydration overrides so account-screen list fulfillment fields win on first paint.
      setOrderShippingProgressByKey({});

      // List rows often omit fulfillment / received line qty; hydrate from order detail.
      const orderUidsToHydrate = [
        ...new Set([
          ...collectOrderUidsNeedingShippingProgressHydration(sellerLines),
          ...collectOrderUidsNeedingReceivedHydration(sellerLines),
        ]),
      ];
      if (orderUidsToHydrate.length) {
        void (async () => {
          const hydratedShipping = {};
          const hydratedReceivedByOrder = {};
          const results = await Promise.allSettled(
            orderUidsToHydrate.map(async (orderUid) => {
              const orderDetail = await fetchOrderDetailApi(orderUid, { businessUid: targetBusinessUID });
              const progress = getOrderShippingProgress([orderDetail?.sale || orderDetail].filter(Boolean));
              const receivedSummary = summarizeReceivedUnitsFromOrderDetail(orderDetail);
              return { orderUid, orderDetail, progress, receivedSummary };
            }),
          );
          if (!shouldApplyBusinessResponse()) return;
          for (const result of results) {
            if (result.status !== "fulfilled") continue;
            const { orderUid, orderDetail, progress, receivedSummary } = result.value;
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
          }
          if (!Object.keys(hydratedShipping).length && !Object.keys(hydratedReceivedByOrder).length) return;
          if (Object.keys(hydratedShipping).length) {
            setOrderShippingProgressByKey((prev) => ({ ...prev, ...hydratedShipping }));
          }
          setBusinessSellerTransactionList((prev) =>
            (prev || []).map((row) => {
              const orderUid = resolveListRowOrderUid(row);
              const txnUid = String(row.transaction_uid || "").trim();
              const progress = hydratedShipping[orderUid] || hydratedShipping[txnUid];
              const receivedSummary = hydratedReceivedByOrder[orderUid] || hydratedReceivedByOrder[txnUid];
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
                  delivered_item_count: receivedSummary.received,
                  received_item_count: receivedSummary.received,
                };
              }
              return next;
            }),
          );
        })();
      }

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
          const netEarning = total - bounty - taxes;
          transactionMap[txnId] = {
            transaction_uid: item.transaction_uid,
            transaction_datetime: item.transaction_datetime,
            transaction_profile_id: item.transaction_profile_id,
            transaction_business_id: item.transaction_business_id,
            transaction_total: total,
            transaction_taxes: taxes,
            bounty_paid: bounty,
            net_earning: netEarning,
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
      const row = businessesRef.current.find((b) => (b.business_uid || b.profile_business_uid) === targetBusinessUID);
      setSelectedBusinessFullData(mapSessionBusinessRowToMiniCard(row));
    } finally {
      if (!shouldApplyBusinessResponse()) return;
      setBusinessTransactionLoading(false);
      setBusinessBountyLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      checkAuth();
      loadAutoPaidIds();
      loadReturnRequests();
      loadReturnStatuses();
      refreshAccountScreenPersonal();

      const loadBusinessData = async () => {
        await fetchUserBusinesses();
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
    }, []),
  );

  // Refresh the active profile's account-screen payload when selection changes.
  useEffect(() => {
    if (selectedAccount === "personal" || !selectedAccount) {
      setSelectedBusinessFullData(null);
      setBusinessSellerTransactionList([]);
      refreshAccountScreenPersonal();
      return;
    }
    refreshAccountScreenBusiness();
  }, [selectedAccount, businesses]);

  // Silently releases escrow for aged-out / already-received no-ship transactions.
  // Guarded so the same uid is only attempted once per session (never from render).
  const triggerAutoPay = useCallback(async (transactionUid, { refresh = true } = {}) => {
    const uid = String(transactionUid || "").trim();
    if (!uid) return false;
    if (autoPayAttemptedRef.current.has(uid)) return false;
    autoPayAttemptedRef.current.add(uid);
    try {
      await saveAutoPaidId(uid);
      const response = await fetch(TRANSACTIONS_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_uid: uid, transaction_in_escrow: 0 }),
      });
      if (!response.ok) {
        autoPayAttemptedRef.current.delete(uid);
        console.error("Auto-pay failed for transaction:", uid, response.status);
        return false;
      }
      if (refresh) await refreshAccountScreenPersonal();
      return true;
    } catch (error) {
      console.error("Auto-pay failed for transaction:", uid, error);
      autoPayAttemptedRef.current.delete(uid);
      setAutoPaidTransactionIds((prev) => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
      return false;
    }
  }, []);

  // Run auto-pay once when purchase list loads — never from row render (that spam-fired PUTs).
  useEffect(() => {
    if (selectedAccount !== "personal") return;
    if (!Array.isArray(transactionData) || transactionData.length === 0) return;

    let cancelled = false;
    (async () => {
      const eligibleUids = [];
      for (const transaction of transactionData) {
        if (isReturnListRow(transaction)) continue;
        if (Number(transaction.transaction_in_escrow) !== 1) continue;
        const uid = String(transaction.transaction_uid || "").trim();
        if (!uid) continue;
        if (autoPayAttemptedRef.current.has(uid) || autoPaidTransactionIds.has(uid)) continue;

        const purchaseDate = parseTransactionDateTime(transaction);
        const isOlderThan5Days =
          Number.isFinite(purchaseDate?.getTime()) &&
          (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24) >= 5;
        const shouldRelease =
          isOlderThan5Days ||
          (orderFulfillmentIsNotRequired(transaction) && isPurchaseFullyReceivedByQty(transaction));
        if (shouldRelease) eligibleUids.push(uid);
      }
      if (!eligibleUids.length || cancelled) return;

      let anySuccess = false;
      for (const uid of eligibleUids) {
        if (cancelled) break;
        const ok = await triggerAutoPay(uid, { refresh: false });
        if (ok) anySuccess = true;
      }
      if (anySuccess && !cancelled) {
        await refreshAccountScreenPersonal();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [transactionData, selectedAccount, autoPaidTransactionIds, triggerAutoPay]);

  const budgetData = [
    { item: "per Impression", costPer: "$0.01", monthlyCap: "$10.00", currentSpend: "$0.50" },
    { item: "per Click", costPer: "$0.10", monthlyCap: "$10.00", currentSpend: "$7.20" },
    { item: "per Request", costPer: "$1.00", monthlyCap: "$10.00", currentSpend: "$3.00" },
  ];

  const screenWidth = Dimensions.get("window").width - 40;

  // Process bounty data for Bounties chart with dual axes
  const processBountyDataForChart = () => {
    if (!bountyData || !bountyData.data || !Array.isArray(bountyData.data) || bountyData.data.length === 0) {
      return {
        dates: [],
        dailyBounty: [],
        cumulativeBounty: [],
        maxDaily: 0,
        maxCumulative: 0,
      };
    }

    // Group bounty by date and calculate cumulative
    const bountyByDate = {};

    bountyData.data.forEach((transaction) => {
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

    // Build cumulative bounty array (second line)
    const cumulativeBounty = [];
    let runningTotal = 0;
    recentDates.forEach((date) => {
      runningTotal += bountyByDate[date] || 0;
      cumulativeBounty.push(runningTotal);
    });

    const maxDaily = Math.max(...dailyBounty, 0.01); // Use 0.01 instead of 1 to avoid division issues
    const maxCumulative = Math.max(...cumulativeBounty, 0.01);

    return {
      dates: recentDates,
      dailyBounty,
      cumulativeBounty,
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
    const chartData = processBountyDataForChart();
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

    return (
      <View style={{ width: chartWidth, height: chartHeight, marginVertical: 8 }}>
        {/* Legend */}
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 8, gap: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 12, height: 3, backgroundColor: "#B71C1C", marginRight: 6 }} />
            <Text style={{ fontSize: 12, color: "#666" }}>Daily Bounty</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 12, height: 3, backgroundColor: "#000", marginRight: 6 }} />
            <Text style={{ fontSize: 12, color: "#666" }}>Cumulative Bounty</Text>
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
                <SvgText x={paddingLeft - 8} y={y + 4} fontSize='10' fill='#B71C1C' textAnchor='end'>
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
                <SvgText x={paddingLeft + plotWidth + 8} y={y + 4} fontSize='10' fill='#666' textAnchor='start'>
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
                  <SvgText key={`x-label-${index}`} x={x} y={paddingTop + plotHeight + 15} fontSize='10' fill='#666' textAnchor='middle'>
                    {formatDateLabel(date)}
                  </SvgText>
                );
              })
            : buildMobileEarningsXAxisTicksByTime(chartData.dates, xPositions, paddingLeft, paddingLeft + plotWidth).map((tick) => (
                <SvgText key={tick.key} x={tick.x} y={paddingTop + plotHeight + 15} fontSize='10' fill='#666' textAnchor='middle'>
                  {tick.label}
                </SvgText>
              ))}

          {/* X-axis title label */}
          <SvgText x={paddingLeft + plotWidth / 2} y={paddingTop + plotHeight + 35} fontSize='12' fill='#333' fontWeight='600' textAnchor='middle'>
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
            <Text style={{ fontSize: 12, color: "#666" }}>Daily Net Earnings</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 12, height: 3, backgroundColor: "#000", marginRight: 6 }} />
            <Text style={{ fontSize: 12, color: "#666" }}>Cumulative Net Earnings</Text>
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
                <SvgText x={paddingLeft - 8} y={y + 4} fontSize='10' fill='#666' textAnchor='end'>
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
                <SvgText x={paddingLeft + plotWidth + 8} y={y + 4} fontSize='10' fill='#666' textAnchor='start'>
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
                  <SvgText key={`x-label-${index}`} x={x} y={paddingTop + plotHeight + 15} fontSize='10' fill='#666' textAnchor='middle'>
                    {formatDateLabel(date)}
                  </SvgText>
                );
              })
            : buildMobileEarningsXAxisTicksByTime(chartData.dates, xPositions, paddingLeft, paddingLeft + plotWidth).map((tick) => (
                <SvgText key={tick.key} x={tick.x} y={paddingTop + plotHeight + 15} fontSize='10' fill='#666' textAnchor='middle'>
                  {tick.label}
                </SvgText>
              ))}

          {/* X-axis title label */}
          <SvgText x={paddingLeft + plotWidth / 2} y={paddingTop + plotHeight + 35} fontSize='12' fill='#333' fontWeight='600' textAnchor='middle'>
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

  const personalPendingEscrowBounty =
    bountyData?.data && Array.isArray(bountyData.data) ? bountyData.data.filter((i) => i.in_escrow === 1).reduce((s, i) => s + parseFloat(i.bounty_earned || 0), 0) : 0;

  const businessNetEarningsTotal = businessTransactionData.reduce((s, t) => s + parseFloat(t.net_earning || 0), 0);
  const productSalesSummary = useMemo(() => {
    const products = aggregateBusinessProductSales(businessBountyData?.data || []);
    const unitsAvailableByUid = buildUnitsAvailableByProductUid(businessServices);
    return products.map((product) => ({
      ...product,
      unitsAvailable: unitsAvailableByUid[product.productUid] ?? "—",
    }));
  }, [businessBountyData, businessServices]);
  const businessOrdersSummary = useMemo(
    () =>
      buildBusinessOrdersListFromSellerTransactions(
        businessSellerTransactionList,
        businessBountyData?.data || [],
        orderShippingProgressByKey,
        returnStatuses,
      ),
    [businessSellerTransactionList, businessBountyData, orderShippingProgressByKey, returnStatuses],
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
      <View style={styles.centeredContainer}>
        <ActivityIndicator size='large' color='#007BFF' />
        <Text style={{ marginTop: 10 }}>Loading account data...</Text>
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
        {selectedAccount === "personal" ? (
          personalProfileData && (
            <TouchableOpacity activeOpacity={0.7} onPress={handleAccountMiniCardPress}>
              <View style={{ marginBottom: 16 }}>
                <MiniCard user={personalProfileData} />
              </View>
            </TouchableOpacity>
          )
        ) : (
          selectedBusinessFullData && (
            <TouchableOpacity activeOpacity={0.7} onPress={handleAccountMiniCardPress}>
              <View style={{ marginBottom: 16 }}>
                <MiniCard business={selectedBusinessFullData} />
              </View>
            </TouchableOpacity>
          )
        )}
        {/* Select Profile Dropdown Row */}
        <View style={styles.selectProfileRow}>
          <Text style={styles.selectProfileLabel}>Select Profile</Text>
          <TouchableOpacity style={styles.selectProfileDropdown} onPress={() => setShowAccountDropdown(!showAccountDropdown)} activeOpacity={0.7}>
            <Text style={styles.selectProfileDropdownText}>
              {selectedAccount === "personal" ? "Personal" : businesses.find((b) => (b.business_uid || b.profile_business_uid) === selectedAccount)?.business_name || "Business"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dropdown Menu */}
        {showAccountDropdown && (
          <View style={styles.selectProfileMenu}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => handleProfileSelection("personal")}
            >
              <Text style={[styles.dropdownItemText, selectedAccount === "personal" && styles.dropdownItemTextActive]}>Personal</Text>
            </TouchableOpacity>
            {businesses.map((business, index) => {
              const businessId = business.business_uid || business.profile_business_uid;
              const businessName = business.business_name || business.profile_business_name || `Business ${index + 1}`;
              return (
                <TouchableOpacity
                  key={businessId || index}
                  style={styles.dropdownItem}
                  onPress={() => handleProfileSelection(businessId)}
                >
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
                      {expertiseData.map((item, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={styles.tableRow}
                          onPress={() => {
                            const txs = sellerTxData.filter((tx) => tx.ti_bs_id === item.expertiseUid);
                            setSalesModal({ visible: true, item, transactions: txs });
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.tableCell, { flex: 1.5, color: "#1a73e8", textDecorationLine: "underline" }]}>{item.name}</Text>
                          <Text style={[styles.tableCell, { flex: 0.9, color: "#777", marginLeft: 30 }]}>${item.cost}</Text>
                          <Text style={[styles.tableCell, { flex: 0.7, color: "#777", marginLeft: 12 }]}>{item.unit}</Text>
                          <Text style={[styles.tableCell, { flex: 0.7, color: "#777", marginLeft: 12 }]}>{item.soldQty}</Text>
                          <Text style={[styles.tableCell, { flex: 0.7, color: item.remaining === 0 ? "#c00" : "#777", marginLeft: 12 }]}>
                            {item.remaining === null ? "∞" : item.remaining}
                          </Text>
                          <Text style={[styles.tableCell, { flex: 1, color: "#777", textAlign: "right", marginRight: 15 }]}>${item.bounty}</Text>
                        </TouchableOpacity>
                      ))}
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
                  ) : transactionData.length > 0 ? (
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
                      {transactionData.map((transaction, i) => {
                        const isReturnRow = isReturnListRow(transaction);
                        const orderUid = resolveListRowOrderUid(transaction);
                        const isPending = !isReturnRow && Number(transaction.transaction_in_escrow) === 1;
                        const showPendingLink = isPending;
                        const compactTx = compactPurchasesLayout;
                        const sellerId = resolvePurchaseSellerId(transaction);
                        const displayAmount = parseFloat(transaction.transaction_total ?? transaction.seller_total ?? 0);

                        return (
                          <View key={transaction.transaction_uid || transaction.ti_uid || i} style={styles.transactionRow}>
                            <Text style={styles.transactionDate}>{formatTransactionDate(transaction)}</Text>
                            {showPurchasesTxnIdColumn ? (
                              <TouchableOpacity onPress={() => openOrderDetail({ orderUid })} activeOpacity={0.7} disabled={orderUid === "—"}>
                                <Text style={[styles.transactionId, orderUid !== "—" && styles.receiptLink]}>{transaction.transaction_uid || "N/A"}</Text>
                              </TouchableOpacity>
                            ) : null}
                            {showPurchasesTypeColumn ? (
                              <Text style={styles.transactionPurchaseType}>
                                {isReturnRow ? "Return" : transaction.purchase_type || "N/A"}
                              </Text>
                            ) : null}
                            <View style={{ flex: 1, paddingHorizontal: 4, justifyContent: "center", minWidth: 0 }}>
                              <TouchableOpacity
                                onPress={() => navigateToPurchaseSeller(navigation, transaction)}
                                activeOpacity={0.7}
                                disabled={!sellerId}
                              >
                                <Text
                                  style={[styles.transactionBusiness, sellerId ? styles.receiptLink : null]}
                                  numberOfLines={4}
                                >
                                  {transaction.business_name || "N/A"}
                                </Text>
                              </TouchableOpacity>
                            </View>
                            {showPurchasesItemColumn ? (
                              <View style={styles.transactionPurchasedItemCell}>
                                {isReturnRow ? (
                                  <TouchableOpacity onPress={() => openOrderDetail({ orderUid })} activeOpacity={0.7}>
                                    <Text style={[styles.transactionPurchasedItem, styles.receiptLink]} numberOfLines={4}>
                                      {formatPurchasedItemDisplay(transaction.purchased_item) || "View order"}
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
                              const txnUid = String(transaction.transaction_uid || "").trim();
                              const statusOverride = {
                                ...getReturnStatusOverrideFromCache(returnStatuses, orderUid, txnUid),
                                returnRequested:
                                  returnRequests[orderUid]?.items?.length > 0 ||
                                  returnRequests[txnUid]?.items?.length > 0 ||
                                  transaction.transaction_return_requested === 1,
                              };
                              const deliveredLabel = getBuyerPurchaseDeliveredLabel(transaction, statusOverride);
                              const receivedLabel = getBuyerPurchaseReceivedLabel(transaction, statusOverride);
                              const deliveredBadge = getProductSaleStatusBadgeStyle("delivered", deliveredLabel);
                              const canVerifyReceipt =
                                !isReturnRow &&
                                showPendingLink &&
                                (receivedLabel === "No" || receivedLabel === "Partial");
                              const receivedDisplayLabel = canVerifyReceipt ? "Verify" : receivedLabel;
                              const receivedBadge = getProductSaleStatusBadgeStyle(
                                "received",
                                canVerifyReceipt ? "verify" : receivedLabel,
                              );

                              const renderBadge = (label, badgeStyle) => (
                                <View style={[styles.purchaseStatusBadge, badgeStyle.badge]}>
                                  <Text style={[styles.purchaseStatusBadgeText, badgeStyle.text]} numberOfLines={1}>
                                    {label}
                                  </Text>
                                </View>
                              );

                              return (
                                <>
                                  <View style={styles.transactionDeliveredCell}>
                                    {renderBadge(deliveredLabel, deliveredBadge)}
                                  </View>
                                  <View style={styles.transactionReceivedCell}>
                                    {canVerifyReceipt ? (
                                      <TouchableOpacity onPress={() => openDeliveryVerification(transaction)} activeOpacity={0.7}>
                                        {renderBadge(receivedDisplayLabel, receivedBadge)}
                                      </TouchableOpacity>
                                    ) : (
                                      renderBadge(receivedLabel, receivedBadge)
                                    )}
                                  </View>
                                </>
                              );
                            })()}
                            <TouchableOpacity onPress={() => openOrderDetail({ orderUid })} activeOpacity={0.7} disabled={orderUid === "—"}>
                              <Text style={[styles.transactionAmount, isReturnRow && { color: "#B71C1C" }, orderUid !== "—" && styles.receiptLink]}>
                                {formatSignedOrderMoney(displayAmount)}
                              </Text>
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
                      {personalPendingEscrowBounty > 0 ? (
                        <View style={styles.balanceContainer}>
                          <Text style={[styles.sectionLabel, { color: darkMode ? "#e0e0e0" : "#333" }]}>Pending (escrow)</Text>
                          <Text style={[styles.balanceAmount, { color: darkMode ? "#ffb74d" : "#e65100" }]}>${personalPendingEscrowBounty.toFixed(2)}</Text>
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
                      <View style={styles.balanceContainer}>
                        <Text style={[styles.sectionLabel, { color: darkMode ? "#e0e0e0" : "#333" }]}>Useable Balance</Text>
                        <Text style={[styles.balanceAmount, { color: darkMode ? "#81c784" : "#2e7d32" }]}>{formatWalletUsd(personalWallet.wallet_useable_balance)}</Text>
                      </View>
                      <View style={styles.balanceContainer}>
                        <Text style={[styles.sectionLabel, { color: darkMode ? "#e0e0e0" : "#333" }]}>Actual Balance</Text>
                        <Text style={[styles.balanceAmount, { color: darkMode ? "#fff" : "#000" }]}>{formatWalletUsd(personalWallet.wallet_actual_balance)}</Text>
                      </View>
                      <View style={styles.balanceContainer}>
                        <Text style={[styles.sectionLabel, { color: darkMode ? "#e0e0e0" : "#333" }]}>Pending</Text>
                        <Text style={[styles.balanceAmount, { color: darkMode ? "#ffb74d" : "#e65100" }]}>{formatWalletUsd(personalWallet.wallet_pending)}</Text>
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
                          <Text style={styles.transactionHeaderPaid}>Paid</Text>
                          <Text style={styles.transactionHeaderAmount}>Bounty</Text>
                        </View>
                        {bountyData.data.map((item, index) => {
                          const paidLabel =
                            item.in_escrow === 1 && (Date.now() - (transactionDateMs(item) || 0)) / (1000 * 60 * 60 * 24) >= 30 ? "Paid" : item.in_escrow === 1 ? "Pending" : "Paid";
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
                                <Text style={styles.transactionPaidText}>{paidLabel}</Text>
                              </View>
                              <Text style={styles.transactionAmount}>${parseFloat(item.bounty_earned || 0).toFixed(2)}</Text>
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
                        <TouchableOpacity
                          key={product.productUid}
                          style={styles.productSalesTableRow}
                          onPress={() => openProductSalesModal(product)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.productSalesCell, styles.productSalesCellProduct, styles.productSalesCellLink]} numberOfLines={2}>
                            {product.productName}
                          </Text>
                          <Text style={styles.productSalesCell}>{product.productUid}</Text>
                          <Text style={styles.productSalesCell}>{product.unitsSold}</Text>
                          <Text
                            style={[
                              styles.productSalesCell,
                              product.unitsAvailable === "0" && { color: "#c00", fontWeight: "600" },
                            ]}
                          >
                            {product.unitsAvailable}
                          </Text>
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
                    <BusinessOrdersTable
                      rows={businessOrdersSummary}
                      darkMode={darkMode}
                      maxBodyHeight={360}
                      onOrderPress={openOrderDetail}
                      onReturnPress={openReturnDetails}
                    />
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
                        const returnLogistics = getReturnLogisticsForCachedUid(
                          transaction,
                          returnStatuses,
                          transaction.transaction_uid,
                        ) || resolveReturnLogisticsLabels(transaction, {
                          returnRequested:
                            transaction.transaction_return_requested === 1 ||
                            returnRequests[transaction.transaction_uid]?.items?.length > 0,
                        });
                        const awaitingReturnAction =
                          returnLogistics?.return_status === "returning" && returnLogistics?.refund_status === "pending";
                        const returnRefunded = returnLogistics?.refund_status === "refunded";

                        return (
                          <View key={transaction.transaction_uid || i}>
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
                                    color: returnRefunded || returnLogistics?.return_status === "returned" ? "#B71C1C" : "#333",
                                  },
                                ]}
                              >
                                {returnRefunded || returnLogistics?.return_status === "returned"
                                  ? `-$${transaction.transaction_taxes.toFixed(2)}`
                                  : `$${transaction.transaction_taxes.toFixed(2)}`}
                              </Text>
                              <Text style={[styles.businessTransactionCell, { width: 55, flex: 0, textAlign: "right" }]}>${transaction.net_earning.toFixed(2)}</Text>
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
                                {(transaction.transaction_return_requested === 1 || returnRequests[transaction.transaction_uid]?.items?.length > 0) && (
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
                                {(returnRefunded || returnLogistics?.return_status === "returned") && (
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
              <ActivityIndicator size="large" color="#18884A" style={{ marginVertical: 24 }} />
            ) : receiptData.length > 0 ? (
              <>
                <ScrollView style={styles.receiptScrollView} contentContainerStyle={styles.receiptScrollViewContent}>
                  <View style={styles.receiptTableWrap}>
                    <View style={styles.receiptTableHeader}>
                      <Text style={[styles.receiptHeaderCell, styles.receiptHeaderCellItem]}>Item</Text>
                      <Text style={[styles.receiptHeaderCell, styles.receiptHeaderCellQty]}>Qty</Text>
                      <Text style={[styles.receiptHeaderCell, styles.receiptHeaderCellCost]}>Unit</Text>
                      <Text style={[styles.receiptHeaderCell, styles.receiptHeaderCellCost]}>Total</Text>
                    </View>

                    {receiptData.map((item, index) => {
                      const baseCost = parseFloat(item.ti_bs_cost || 0);
                      const qty = parseInt(item.ti_bs_qty || 1, 10);
                      const tiUid = item.ti_uid != null ? String(item.ti_uid).trim() : "";
                      const bountyRow = findBountyResultForReceiptLine(
                        bountyData?.data,
                        item,
                        receiptTransaction?.transaction_uid,
                      );
                      const bountyDisplay = resolveReceiptLineBountyDisplay(item, bountyRow);
                      const bountyMetaColor = darkMode ? "#aaa" : "#666";

                      const enrich = {
                        ...(receiptEnrichedItems[tiUid] || enrichFromReceiptRow(item) || receiptEnrichedItems[item.ti_bs_id] || receiptEnrichedItems[item.bs_uid] || {}),
                        ...(Array.isArray(item.selected_options) && item.selected_options.length > 0 ? { selected_options: item.selected_options } : {}),
                      };

                      if (isOfferingReceipt) {
                        const offeringName = String(item.bs_service_name || item.bs_service_desc || "N/A").trim() || "N/A";
                        const costString = enrich.offeringCostString
                          || Object.values(receiptEnrichedItems).find((e) => e && e.offeringCostString)?.offeringCostString
                          || "";
                        const qtyTypeLabel = getOfferingQtyTypeLabel(costString);
                        const lineTotal = baseCost * qty;
                        return (
                          <View key={item.ti_uid || item.ti_bs_id || index} style={styles.receiptTableRow}>
                            <View style={styles.receiptTableCellItem}>
                              <Text style={{ fontSize: 12, color: darkMode ? "#eee" : "#333", lineHeight: 17 }} numberOfLines={3}>
                                {offeringName}
                              </Text>
                              {qtyTypeLabel ? (
                                <Text style={{ fontSize: 10, color: darkMode ? "#aaa" : "#777", fontStyle: "italic", lineHeight: 14 }}>
                                  {qtyTypeLabel}
                                </Text>
                              ) : null}
                              {bountyDisplay?.itemLabel ? (
                                <Text style={{ fontSize: 10, color: bountyMetaColor, lineHeight: 14, marginTop: 2 }}>
                                  Bounty: {bountyDisplay.itemLabel}
                                </Text>
                              ) : null}
                              {bountyDisplay?.shareLabel ? (
                                <Text style={{ fontSize: 10, color: bountyMetaColor, lineHeight: 14 }}>
                                  Your share: {bountyDisplay.shareLabel}
                                </Text>
                              ) : null}
                            </View>
                            <Text style={[styles.receiptTableCell, styles.receiptTableCellQty]}>{qty}</Text>
                            <Text style={[styles.receiptTableCell, styles.receiptTableCellCost]}>${baseCost.toFixed(2)}</Text>
                            <Text style={[styles.receiptTableCell, styles.receiptTableCellCost, { fontWeight: "600" }]}>
                              ${lineTotal.toFixed(2)}
                            </Text>
                          </View>
                        );
                      }

                      const choicesExtraCost = getReceiptLineChoicesExtraCost(item, enrich);
                      const unitPrice = getReceiptLineUnitPrice(item, enrich);
                      const lineTotal = unitPrice * qty;
                      const summaryDescription =
                        String(item.bs_service_desc || item.bs_service_name || "N/A").trim() || "N/A";

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
                            {bountyDisplay?.itemLabel ? (
                              <Text style={{ fontSize: 10, color: bountyMetaColor, lineHeight: 14, marginTop: 2 }}>
                                Bounty: {bountyDisplay.itemLabel}
                              </Text>
                            ) : null}
                            {bountyDisplay?.shareLabel ? (
                              <Text style={{ fontSize: 10, color: bountyMetaColor, lineHeight: 14 }}>
                                Your share: {bountyDisplay.shareLabel}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={[styles.receiptTableCell, styles.receiptTableCellQty]}>{qty}</Text>
                          <Text style={[styles.receiptTableCell, styles.receiptTableCellCost]}>${unitPrice.toFixed(2)}</Text>
                          <Text style={[styles.receiptTableCell, styles.receiptTableCellCost, { fontWeight: "600" }]}>
                            ${lineTotal.toFixed(2)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
                <ReceiptTransactionTotalsFooter
                  receiptRows={receiptData}
                  transactionFallback={receiptTransaction}
                  darkMode={darkMode}
                />
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
                const saleLines = receiptOrderDetail?.sale?.lines;
                const allItemsReturned =
                  Array.isArray(saleLines) && saleLines.length > 0
                    ? saleLines.every((line) => Math.max(0, parseInt(line.remaining_qty, 10) ?? 0) <= 0)
                    : receiptData.length > 0 &&
                      receiptData.every((row, index) => {
                        const purchasedQty = getReceiptLineQty(row);
                        const returnData = returnRequests[orderUid];
                        return getReturnedQtyForLine(returnData, index, purchasedQty) >= purchasedQty;
                      });

                return (
                  <TouchableOpacity
                    style={[styles.receiptCloseButton, { borderColor: "#B71C1C", marginTop: 12 }, allItemsReturned && { opacity: 0.4 }]}
                    disabled={allItemsReturned}
                    onPress={() => {
                      if (!allItemsReturned) openReturnNoteModalFromReceipt();
                    }}
                  >
                    <Text style={[styles.receiptCloseButtonText, { color: "#B71C1C" }]}>{allItemsReturned ? "All Items Returned" : "Request Return"}</Text>
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
          setShowReturnNoteModal(false);
          setReturnNote("");
          setSelectedReturnItems([]);
          setReturnItemQuantities({});
        }}
      >
        <View style={[styles.receiveItemModalOverlay, darkMode && styles.darkModalOverlay]}>
          <View style={[styles.receiveItemModalContent, darkMode && styles.darkModalContent, { maxHeight: "80%" }]}>
            <Text style={[styles.receiveItemModalHeader, { color: "#B71C1C" }, darkMode && styles.darkTitle]}>Request Return</Text>

            {returnModalLoading ? (
              <ActivityIndicator size='large' color='#B71C1C' style={{ marginVertical: 24 }} />
            ) : (
              <>
            {/* Item selection */}
            <Text style={{ fontSize: 14, color: darkMode ? "#ccc" : "#555", marginBottom: 8 }}>Select item(s) to return:</Text>
            <ScrollView style={{ maxHeight: 220, marginBottom: 12 }}>
              {buildReturnModalSelectableLines(
                returnModalOrderLines,
                returnModalReceiptData,
                returnRequests[resolveListRowOrderUid(receiptTransaction)],
              ).map((row) => {
                const itemId = row.itemId;
                const isSelected = selectedReturnItems.includes(itemId);
                const purchasedQty = row.purchasedQty;
                const remainingQty = row.remainingQty;
                const alreadyReturned = remainingQty <= 0;
                const returnQty = returnItemQuantities[itemId] ?? 1;
                const needsQtyPicker = isSelected && purchasedQty > 1 && remainingQty > 1;

                return (
                  <View
                    key={itemId}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 4,
                      borderBottomWidth: 1,
                      borderBottomColor: darkMode ? "#444" : "#eee",
                      opacity: alreadyReturned ? 0.4 : 1,
                    }}
                  >
                    <TouchableOpacity
                      disabled={alreadyReturned}
                      style={{ flexDirection: "row", alignItems: "center" }}
                      onPress={() => {
                        if (alreadyReturned) return;
                        if (isSelected) {
                          setSelectedReturnItems((prev) => prev.filter((id) => id !== itemId));
                          setReturnItemQuantities((prev) => {
                            const next = { ...prev };
                            delete next[itemId];
                            return next;
                          });
                        } else {
                          setSelectedReturnItems((prev) => [...prev, itemId]);
                          setReturnItemQuantities((prev) => ({
                            ...prev,
                            [itemId]: Math.min(1, remainingQty) || 1,
                          }));
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={18} color={isSelected ? "#B71C1C" : "#555"} style={{ marginRight: 8 }} />
                      <Text style={{ fontSize: 13, color: darkMode ? "#fff" : "#333", flex: 1 }}>
                        {row.itemName} — ${parseFloat(row.unitCost || 0).toFixed(2)} x {purchasedQty}
                      </Text>
                      {alreadyReturned ? (
                        <Text style={{ fontSize: 11, color: "#B71C1C", marginLeft: 4 }}>Already returned</Text>
                      ) : purchasedQty > remainingQty ? (
                        <Text style={{ fontSize: 11, color: "#888", marginLeft: 4 }}>{remainingQty} left</Text>
                      ) : null}
                    </TouchableOpacity>

                    {needsQtyPicker && (
                      <View style={{ marginTop: 8, marginLeft: 26 }}>
                        <Text style={{ fontSize: 12, color: darkMode ? "#ccc" : "#555", marginBottom: 6 }}>How many are you returning?</Text>
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
                              setReturnItemQuantities((prev) => ({
                                ...prev,
                                [itemId]: Math.max(1, (prev[itemId] ?? 1) - 1),
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
                            value={String(returnQty)}
                            onChangeText={(t) => {
                              const digits = t.replace(/[^0-9]/g, "");
                              const n = digits === "" ? "" : parseInt(digits, 10);
                              setReturnItemQuantities((prev) => ({
                                ...prev,
                                [itemId]: n === "" ? "" : Math.min(remainingQty, Math.max(1, n)),
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
                              setReturnItemQuantities((prev) => ({
                                ...prev,
                                [itemId]: Math.min(remainingQty, (prev[itemId] ?? 1) + 1),
                              }))
                            }
                          >
                            <Text style={{ fontSize: 18, color: darkMode ? "#fff" : "#333" }}>+</Text>
                          </TouchableOpacity>
                          <Text style={{ fontSize: 12, color: darkMode ? "#aaa" : "#666", marginLeft: 8 }}>of {remainingQty}</Text>
                        </View>
                      </View>
                    )}
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
              const selectableLines = buildReturnModalSelectableLines(
                returnModalOrderLines,
                returnModalReceiptData,
                returnRequests[resolveListRowOrderUid(receiptTransaction)],
              );
              const lineById = Object.fromEntries(selectableLines.map((line) => [line.itemId, line]));
              const hasInvalidQty = selectedReturnItems.some((id) => {
                const row = lineById[id];
                if (!row) return true;
                const remainingQty = row.remainingQty;
                const raw = returnItemQuantities[id];
                const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
                if (row.purchasedQty > 1 && remainingQty > 1) {
                  return !Number.isFinite(n) || n < 1 || n > remainingQty;
                }
                return false;
              });
              const canSubmitReturn = selectedReturnItems.length > 0 && !hasInvalidQty && !returnModalLoading;

              return (
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <TouchableOpacity
                    style={[styles.receiveItemModalButton, styles.receiveItemNoButton, darkMode && styles.darkCancelButton]}
                    onPress={() => {
                      setShowReturnNoteModal(false);
                      setReturnNote("");
                      setSelectedReturnItems([]);
                      setReturnItemQuantities({});
                      setReturnModalOrderLines([]);
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
                        if (!row) continue;
                        const transaction_item_uid = row.transactionItemUid;
                        if (!transaction_item_uid) {
                          Alert.alert("Error", "Order line is missing ti_uid. Cannot submit return.");
                          return;
                        }
                        const remainingQty = row.remainingQty;
                        const raw = returnItemQuantities[id];
                        const return_quantity =
                          row.purchasedQty > 1 && remainingQty > 1
                            ? typeof raw === "number"
                              ? raw
                              : parseInt(String(raw), 10) || 1
                            : Math.min(1, remainingQty) || 1;
                        transactionReturnItems.push({ transaction_item_uid, return_quantity });
                      }
                      if (transactionReturnItems.length === 0) {
                        Alert.alert("Error", "Could not build return items.");
                        return;
                      }
                      const ok = await handleReturnRequest(receiptTransaction, returnNote, transactionReturnItems);
                      if (!ok) return;
                      setShowReturnNoteModal(false);
                      setReturnNote("");
                      setSelectedReturnItems([]);
                      setReturnItemQuantities({});
                      setReturnModalOrderLines([]);
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
                        const logistics = resolveReturnLogisticsLabels(
                          {},
                          getReturnStatusOverrideFromCache(returnStatuses, perKey, viewingReturnTransactionUid),
                        );
                        const decided =
                          logistics &&
                          !(logistics.return_status === "returning" && logistics.refund_status === "pending");
                        if (decided) {
                          return (
                            <Text
                              style={{
                                fontWeight: "600",
                                fontSize: 13,
                                color: logistics.refund_status === "refunded" ? "#18884A" : "#B71C1C",
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
                            onPress={async () => {
                              const outcome = await handleReturnAccept(viewingReturnTransactionUid, viewingReturnTransactionUid);
                              if (outcome?.ok) {
                                setReturnStatuses((prev) => ({
                                  ...prev,
                                  [perKey]: outcome.state,
                                  [viewingReturnTransactionUid]: outcome.state,
                                }));
                                await AsyncStorage.setItem(`return_status_${perKey}`, JSON.stringify(outcome.state));
                              }
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
                  const txnUid = viewingReturnTransactionUid || returnDetailModal.transactionUid || returnDetailModal.orderUid;
                  const orderUid = returnDetailModal.orderUid || txnUid;
                  setReturnDetailDeclining(true);
                  try {
                    const outcome = await handleReturnDecline(txnUid, declineNote, orderUid);
                    if (outcome?.ok) {
                      if (idx != null) {
                        setReturnStatuses((prev) => ({
                          ...prev,
                          [`${txnUid}_${idx}`]: outcome.state,
                          [txnUid]: outcome.state,
                        }));
                        await AsyncStorage.setItem(`return_status_${txnUid}_${idx}`, JSON.stringify(outcome.state));
                      }
                      setReturnConfirmResult(outcome.result || outcome);
                      setReturnDetailModal((prev) =>
                        prev.visible
                          ? {
                              ...prev,
                              orderDetail: prev.orderDetail
                                ? {
                                    ...prev.orderDetail,
                                    sale: prev.orderDetail.sale
                                      ? applyReturnRefundFieldsToRow(prev.orderDetail.sale, outcome.state)
                                      : prev.orderDetail.sale,
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
                  const remainingQty = getRemainingQtyToReceive(item);
                  const verifiableQty = getVerifiableReceiveRemaining(item, pendingTransactionForConfirm);
                  const fullyReceived = remainingQty <= 0;
                  const awaitingShipment = !fullyReceived && verifiableQty <= 0;
                  const canSelect = canSelectReceiptLineForVerification(item, pendingTransactionForConfirm);
                  const receivedQty = receivedItemQuantities[itemId] ?? verifiableQty;
                  const needsQtyPicker = isSelected && verifiableQty > 1;
                  const shipDisplay = formatLineFulfillmentDisplay(item);
                  const shippedQty = getLineShippedQty(item);
                  const showShipMeta =
                    orderNeedsShipping(item) ||
                    orderNeedsShipping(pendingTransactionForConfirm) ||
                    listRowHasExplicitShippingProgress(item) ||
                    shippedQty > 0 ||
                    awaitingShipment ||
                    (shipDisplay.statusLabel && shipDisplay.statusLabel !== "—");

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
                            <Text style={{ fontSize: 11, color: darkMode ? "#aaa" : "#666", marginTop: 2 }}>
                              {awaitingShipment
                                ? shipDisplay.statusLabel === "—"
                                  ? "Not shipped yet — verify after shipping"
                                  : `${shipDisplay.statusLabel === "Not shipped" ? "Not shipped yet" : shipDisplay.statusLabel} — verify after shipping`
                                : shipDisplay.statusLabel === "—"
                                  ? "Ready to verify"
                                  : shipDisplay.statusLabel === "Shipped" && shippedQty > 0 && purchasedQty > 1
                                    ? `Shipped ${shippedQty}/${purchasedQty}`
                                    : shipDisplay.statusLabel.includes("/")
                                      ? `Shipped ${shipDisplay.statusLabel}`
                                      : shipDisplay.statusLabel}
                              {!awaitingShipment && shipDisplay.trackingLabel && shipDisplay.trackingLabel !== "—"
                                ? ` · ${shipDisplay.trackingLabel}`
                                : ""}
                            </Text>
                          ) : null}
                        </View>
                        {fullyReceived ? (
                          <Text style={{ fontSize: 11, color: "#9C45F7", marginLeft: 4 }}>Received</Text>
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
                        const received_quantity =
                          verifiableQty > 1 ? (typeof raw === "number" ? raw : parseInt(String(raw), 10) || 1) : Math.min(1, verifiableQty);
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
                rows={buildProductSalesOrderRows(
                  productSalesModal.product,
                  businessSellerTransactionList,
                  businessBountyData?.data || [],
                  orderShippingProgressByKey,
                  returnStatuses,
                )}
                darkMode={darkMode}
                onOrderPress={openOrderDetail}
                onReturnPress={openReturnDetails}
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
      />

      <ReturnDetailsModal
        visible={returnDetailModal.visible}
        onClose={closeReturnDetailModal}
        orderUid={returnDetailModal.orderUid}
        orderDetail={returnDetailModal.orderDetail}
        loading={returnDetailModal.loading}
        error={returnDetailModal.error}
        darkMode={darkMode}
        statusOverride={getReturnStatusOverrideFromCache(
          returnStatuses,
          returnDetailModal.orderUid,
          returnDetailModal.transactionUid,
        )}
        bountyPaidFallback={returnDetailModal.bountyPaidFallback}
        itemReceived={returnItemReceivedChecked}
        onToggleItemReceived={() => setReturnItemReceivedChecked((prev) => !prev)}
        confirming={returnDetailAccepting}
        declining={returnDetailDeclining}
        confirmResult={returnConfirmResult}
        onConfirmReceipt={async () => {
          const txnUid = returnDetailModal.transactionUid || returnDetailModal.orderUid;
          if (!txnUid || !returnItemReceivedChecked) return;
          setReturnDetailAccepting(true);
          try {
            const outcome = await handleReturnAccept(txnUid, returnDetailModal.orderUid);
            if (outcome?.ok) {
              setReturnConfirmResult(outcome.result || outcome);
              setReturnDetailModal((prev) => ({
                ...prev,
                orderDetail: prev.orderDetail
                  ? {
                      ...prev.orderDetail,
                      sale: prev.orderDetail.sale
                        ? applyReturnRefundFieldsToRow(prev.orderDetail.sale, outcome.state)
                        : prev.orderDetail.sale,
                      return_status: outcome.state?.return_status,
                      refund_status: outcome.state?.refund_status,
                      display_status: outcome.state?.display_status,
                      stripe_refund: outcome.stripe_refund,
                    }
                  : prev.orderDetail,
              }));
              try {
                const ctx = {};
                const bizUid = selectedAccount !== "personal" ? selectedAccount || businessUID : businessUID;
                if (bizUid) ctx.businessUid = bizUid;
                const refreshed = await fetchOrderDetailApi(returnDetailModal.orderUid, ctx);
                setReturnDetailModal((prev) => ({ ...prev, orderDetail: refreshed }));
              } catch (_) {
                /* keep local status update */
              }
            }
          } finally {
            setReturnDetailAccepting(false);
          }
        }}
        onDecline={() => {
          setPendingDeclineIdx(null);
          setDeclineNote("");
          setViewingReturnTransactionUid(returnDetailModal.transactionUid || returnDetailModal.orderUid);
          setShowDeclineNoteModal(true);
        }}
      />

      {/* Sales Detail Modal */}
      <Modal animationType='slide' transparent={true} visible={salesModal.visible} onRequestClose={() => setSalesModal({ visible: false, item: null, transactions: [] })}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 20, width: "90%", maxHeight: "80%" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 4, color: "#222" }}>{salesModal.item?.name}</Text>
            <Text style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
              {salesModal.transactions?.length
                ? `${salesModal.transactions.length} purchase${salesModal.transactions.length !== 1 ? "s" : ""}`
                : "No purchases yet"}
            </Text>

            <ScrollView>
              {salesModal.transactions?.length === 0 ? (
                <Text style={{ color: "#888", fontStyle: "italic" }}>No one has purchased this offering yet.</Text>
              ) : (
                salesModal.transactions.map((tx, i) => {
                  const name = [tx.buyer_first_name, tx.buyer_last_name].filter(Boolean).join(" ") || "Unknown buyer";
                  const qty = parseInt(tx.ti_bs_qty) || 0;
                  const unitPrice = parseFloat(tx.unit_price) || 0;
                  const total = parseFloat(tx.transaction_total) || 0;
                  const showEmail = tx.buyer_email_is_public == 1 && tx.buyer_email;
                  const showPhone = tx.buyer_phone_is_public == 1 && tx.buyer_phone;
                  const showLocation = tx.buyer_location_is_public == 1 && (tx.buyer_city || tx.buyer_state);
                  const purchaseDateObj = parseTransactionDateTime(tx);
                  const purchaseDate = purchaseDateObj
                    ? purchaseDateObj.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                    : null;
                  return (
                    <View key={i} style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: "#eee", paddingTop: i > 0 ? 14 : 0, marginBottom: 14 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                        <Text style={{ fontSize: 15, fontWeight: "600", color: "#222" }}>{name}</Text>
                        {purchaseDate ? <Text style={{ fontSize: 12, color: "#999" }}>{purchaseDate}</Text> : null}
                      </View>
                      {showEmail ? <Text style={{ fontSize: 13, color: "#555", marginBottom: 2 }}>{tx.buyer_email}</Text> : null}
                      {showPhone ? <Text style={{ fontSize: 13, color: "#555", marginBottom: 2 }}>{tx.buyer_phone}</Text> : null}
                      {showLocation ? (
                        <Text style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>
                          {[tx.buyer_city, tx.buyer_state].filter(Boolean).join(", ")}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }}>
                        <Text style={{ fontSize: 13, color: "#444" }}>Qty: <Text style={{ fontWeight: "600" }}>{qty}</Text></Text>
                        <Text style={{ fontSize: 13, color: "#444" }}>Unit: <Text style={{ fontWeight: "600" }}>${unitPrice.toFixed(2)}</Text></Text>
                        <Text style={{ fontSize: 13, color: "#444" }}>Total: <Text style={{ fontWeight: "600" }}>${total.toFixed(2)}</Text></Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setSalesModal({ visible: false, item: null, transactions: [] })}
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
  sectionLabel: { fontSize: 16, fontWeight: "600" },
  balanceAmount: { fontSize: 16, fontWeight: "600" },
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
    minWidth: 780,
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
  },
  businessOrderDetailDataRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  businessOrderDetailCell: {
    fontSize: 13,
    color: "#333",
    paddingHorizontal: 6,
  },
  businessOrderDetailColProductId: {
    width: 100,
  },
  businessOrderDetailColDescription: {
    width: 180,
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
    width: 80,
    textAlign: "right",
  },
  businessOrderDetailColQty: {
    width: 44,
    textAlign: "right",
  },
  businessOrderDetailColMoney: {
    width: 84,
    textAlign: "right",
  },
  businessOrderDetailTableWithFulfillment: {
    minWidth: 780,
  },
  businessOrderDetailColShipped: {
    width: 100,
  },
  businessOrderDetailColTracking: {
    width: 160,
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
    width: "100%",
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
    width: 30,
    textAlign: "center",
  },
  receiptHeaderCellCost: {
    width: 54,
    textAlign: "right",
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
    width: 30,
    textAlign: "center",
  },
  receiptTableCellCost: {
    width: 54,
    textAlign: "right",
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
