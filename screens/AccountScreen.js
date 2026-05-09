import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity, Platform, Modal, Alert, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import { ACCOUNT_SCREEN_PERSONAL_ENDPOINT, ACCOUNT_SCREEN_BUSINESS_ENDPOINT, API_BASE_URL, BUSINESS_INFO_ENDPOINT, TRANSACTION_RECEIPT_ENDPOINT } from "../apiConfig";
import Svg, { Circle, Line, Text as SvgText, G, Path } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";
import { useDarkMode } from "../contexts/DarkModeContext";
import FeedbackPopup from "../components/FeedbackPopup";
import { getHeaderColors } from "../config/headerColors";
import { getSessionProfile } from "../utils/sessionProfile";
// import { Picker } from '@react-native-picker/picker';
import MiniCard from "../components/MiniCard";

/** 1 = compact: Purchases (Date, Type, Seller, Paid, Amount) + Bounty Results (hide ID); 0 = full tables */
const ACCOUNT_TRANSACTION_HISTORY_COMPACT_COLUMNS = 0;

/**
 * Expected GET /api/v1/account-screen/personal/:profile_id JSON (flexible keys):
 * - data.transactions | purchase_transactions | personal_transactions | purchases | purchase: buyer rows as array, or { code, data }, or nested { data | items | rows | transactions | list | results | records }[]
 * - data.bounty | bounty_results | bounty_data: same shape as legacy /api/bountyresults body, or bounty_items[] + totals
 * - data.seller_transactions | seller_tx: line items for seller-side expertise qty OR { code, data } (omit key → legacy fetch)
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

function mapAccountScreenPersonalResponse(json) {
  const root = json && typeof json === "object" ? json : {};
  if (Array.isArray(root.data)) {
    return {
      transactions: isApiSuccessCode(root.code) ? root.data : [],
      bounty: null,
      sellerTransactions: undefined,
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

  let bounty = payload.bounty ?? payload.bounty_results ?? payload.bounty_data ?? null;
  if (!bounty && Array.isArray(payload.bounty_items)) {
    bounty = {
      data: payload.bounty_items,
      total_bounty_earned: payload.total_bounty_earned,
      total_bounties: payload.total_bounties,
    };
  }

  let sellerTransactions;
  const stRaw = payload.seller_transactions ?? payload.seller_tx ?? payload.seller_transaction_lines;
  if (stRaw === undefined) {
    sellerTransactions = undefined;
  } else if (Array.isArray(stRaw)) {
    sellerTransactions = stRaw;
  } else if (stRaw && isApiSuccessCode(stRaw.code) && Array.isArray(stRaw.data)) {
    sellerTransactions = stRaw.data;
  } else {
    sellerTransactions = [];
  }

  const profile = payload.profile ?? payload.user_profile ?? payload.personal_profile ?? null;

  return { transactions, bounty, sellerTransactions, profile };
}

/**
 * Expected GET /api/v1/account-screen/business/:business_uid JSON (flexible keys):
 * - data.bounty_results | business_bounty | bounty: { data: [...] } (business bounty lines)
 * - data.seller_transactions | transactions_seller: seller line rows OR { code, data } (same as legacy /transactions/seller/:id)
 */
function mapAccountScreenBusinessResponse(json) {
  const root = json && typeof json === "object" ? json : {};
  let payload = root;
  if (root.data !== undefined && typeof root.data === "object" && !Array.isArray(root.data)) {
    payload = root.data;
  }

  let bountyResult = payload.bounty_results ?? payload.business_bounty ?? payload.bounty ?? null;
  if (bountyResult && !bountyResult.data && Array.isArray(payload.bounty_lines)) {
    bountyResult = { ...bountyResult, data: payload.bounty_lines };
  }

  let sellerLines = [];
  const sellerRaw = payload.seller_transactions ?? payload.transactions_seller ?? payload.business_seller_transactions;
  if (Array.isArray(sellerRaw)) {
    sellerLines = sellerRaw;
  } else if (sellerRaw && sellerRaw.code === 200 && Array.isArray(sellerRaw.data)) {
    sellerLines = sellerRaw.data;
  } else if (root.code === 200 && Array.isArray(root.data) && !sellerRaw) {
    sellerLines = root.data;
  }

  if (!bountyResult) {
    bountyResult = { data: [] };
  }

  return { bountyResult, sellerLines };
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
    let totalQty = 0;
    sellerTx.forEach((transaction) => {
      if (transaction.ti_bs_id === expertiseUid) {
        const qty = parseInt(transaction.ti_bs_qty) || 0;
        totalQty += qty;
      }
    });
    return {
      name: exp.profile_expertise_title || "",
      cost,
      unit,
      bounty: exp.profile_expertise_bounty || "",
      quantity: totalQty,
      isPublic: exp.profile_expertise_is_public === 1 || exp.isPublic === true,
    };
  });
}

/** Same rows as GET /api/v1/transactions/:profile_id — used when account-screen omits purchases or uses unknown keys. */
async function fetchLegacyPersonalBuyerTransactions(profileId) {
  if (!profileId) return [];
  const transactionsUrl = `${API_BASE_URL}/api/v1/transactions/${profileId}`;
  try {
    const response = await fetch(transactionsUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (response.status === 400) return [];
    if (!response.ok) return [];
    const result = await response.json();
    if (result && result.code === 200 && Array.isArray(result.data)) return result.data;
  } catch (e) {
    console.error("Legacy buyer transactions fetch failed:", e);
  }
  return [];
}

async function fetchLegacySellerTransactionsForProfile(profileId) {
  const sellerTransactionsUrl = `${API_BASE_URL}/api/v1/transactions/seller/${profileId}`;
  try {
    const transactionsResponse = await fetch(sellerTransactionsUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (transactionsResponse.ok) {
      const transactionsResult = await transactionsResponse.json();
      if (transactionsResult && transactionsResult.code === 200 && Array.isArray(transactionsResult.data)) {
        return transactionsResult.data;
      }
    } else if (transactionsResponse.status === 400) {
      return [];
    }
  } catch (e) {
    console.error("Legacy seller transactions fetch failed:", e);
  }
  return [];
}

export default function AccountScreen({ navigation }) {
  const { darkMode } = useDarkMode();
  const [userUID, setUserUID] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bountyData, setBountyData] = useState(null);
  const [bountyLoading, setBountyLoading] = useState(true);
  const [transactionData, setTransactionData] = useState([]);
  const [transactionLoading, setTransactionLoading] = useState(true);
  const [expertiseData, setExpertiseData] = useState([]);
  const [expertiseLoading, setExpertiseLoading] = useState(true);
  const [accountType, setAccountType] = useState("personal"); // 'personal' or 'business'
  const [businessTransactionData, setBusinessTransactionData] = useState([]);
  const [businessTransactionLoading, setBusinessTransactionLoading] = useState(true);
  const [businessUID, setBusinessUID] = useState(null);
  const [businessBountyData, setBusinessBountyData] = useState(null);
  const [businessBountyLoading, setBusinessBountyLoading] = useState(true);
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
  const [showBusinessNetEarning, setShowBusinessNetEarning] = useState(true);
  const [showBusinessTransactionHistory, setShowBusinessTransactionHistory] = useState(true);
  const [showBalance, setShowBalance] = useState(true);

  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);
  const [showReceiveItemModal, setShowReceiveItemModal] = useState(false);
  const [pendingTransactionForConfirm, setPendingTransactionForConfirm] = useState(null);
  const [updatingEscrow, setUpdatingEscrow] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState([]);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const accountFeedbackInstructions = "Instructions for Account";

  // Define custom questions for the Account page
  const accountFeedbackQuestions = ["Account - Question 1?", "Account - Question 2?", "Account - Question 3?"];

  const [autoPaidTransactionIds, setAutoPaidTransactionIds] = useState(new Set());

  //for returns
  const [returnRequests, setReturnRequests] = useState({});
  const [receiptTransaction, setReceiptTransaction] = useState(null);

  //for return message
  const [returnNote, setReturnNote] = useState("");
  const [showReturnNoteModal, setShowReturnNoteModal] = useState(false);

  //seller can see return note in transaction details if return requested
  const [showReturnNoteViewModal, setShowReturnNoteViewModal] = useState(false);
  const [viewingReturnNote, setViewingReturnNote] = useState("");

  //Accept/Decline
  const [returnStatuses, setReturnStatuses] = useState({});
  const [viewingReturnTransactionUid, setViewingReturnTransactionUid] = useState(null);

  //select item to return
  const [selectedReturnItems, setSelectedReturnItems] = useState([]);
  const [returnModalReceiptData, setReturnModalReceiptData] = useState([]);

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
      setShowReceiptModal(true);
      const storedReturn = await AsyncStorage.getItem(`return_request_${transaction.transaction_uid}`);
      const parsedReturn = storedReturn ? JSON.parse(storedReturn) : null;
      setReceiptTransaction({
        ...transaction,
        transaction_return_note: transaction.transaction_return_note || parsedReturn?.note || "",
        transaction_return_requested: transaction.transaction_return_requested || (parsedReturn?.requested ? 1 : 0),
      });

      // Pass seller_id so backend filters to only this seller's items
      const sellerId = transaction.seller_id || "";
      const url = `${TRANSACTION_RECEIPT_ENDPOINT}/${profileId}/${transactionUid}${sellerId ? `?seller_id=${encodeURIComponent(sellerId)}` : ""}`;

      const response = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
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

      // No client-side filtering needed — backend handles it via seller_id param
      setReceiptData(items);
    } catch (error) {
      console.error("Error fetching receipt:", error);
      Alert.alert("Error", error.message || "Failed to load receipt.");
      setShowReceiptModal(false);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleReturnRequest = async (transaction, note) => {
    const uid = transaction?.transaction_uid;
    if (!uid) return;
    try {
      const existingNote = returnRequests[uid]?.notes?.map((n) => n.note).join("\n\n---RETURN---\n\n") || "";
      const allNotes = existingNote ? `${existingNote}\n\n---RETURN---\n\n${note}` : note;
      await fetch(`${API_BASE_URL}/api/v1/transactions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_uid: uid,
          transaction_return_requested: 1,
          transaction_return_note: allNotes,
        }),
      });
      const existing = returnRequests[uid] || { items: [], notes: [] };
      const updated = {
        items: [...(existing.items || []), ...selectedReturnItems],
        notes: [...(existing.notes || []), { items: selectedReturnItems, note: note || "", date: new Date().toISOString() }],
      };
      setReturnRequests((prev) => ({ ...prev, [uid]: updated }));
      await AsyncStorage.setItem(`return_request_${uid}`, JSON.stringify(updated));
      setReturnNote("");
    } catch (error) {
      console.error("Error requesting return:", error);
      Alert.alert("Error", "Failed to submit return request. Please try again.");
    }
  };

  const handleReturnAccept = async (transactionUid) => {
    try {
      await fetch(`${API_BASE_URL}/api/v1/transactions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_uid: transactionUid,
          transaction_return_status: "accepted",
        }),
      });
      setReturnStatuses((prev) => ({ ...prev, [transactionUid]: "accepted" }));
      await AsyncStorage.setItem(`return_status_${transactionUid}`, "accepted");
      setShowReturnNoteViewModal(false);
    } catch (error) {
      console.error("Error accepting return:", error);
      Alert.alert("Error", "Failed to accept return. Please try again.");
    }
  };

  const handleReturnDecline = async (transactionUid, note = "") => {
    try {
      const body = JSON.stringify({
        transaction_uid: transactionUid,
        action: "decline",
        transaction_return_seller_note: note,
      });
      console.log("=== DECLINE BODY BEING SENT:", body);
      const response = await fetch(`${API_BASE_URL}/api/v1/transactions/returns/declined`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      });
      console.log("=== DECLINE RESPONSE STATUS:", response.status);
      const result = await response.json();
      console.log("=== DECLINE RESULT:", result);
      if (result.code === 200) {
        setReturnStatuses((prev) => ({ ...prev, [transactionUid]: "declined" }));
        await AsyncStorage.setItem(`return_status_${transactionUid}`, "declined");
        setShowReturnNoteViewModal(false);
      }
    } catch (error) {
      console.error("Error declining return:", error);
      Alert.alert("Error", "Failed to decline return. Please try again.");
    }
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
    try {
      const keys = await AsyncStorage.getAllKeys();
      const returnKeys = keys.filter((k) => k.startsWith("return_request_"));
      console.log("=== STORED RETURN KEYS ===", returnKeys);
      const loaded = {};
      for (const key of returnKeys) {
        const uid = key.replace("return_request_", "");
        const val = await AsyncStorage.getItem(key);
        //loaded[uid] = val ? JSON.parse(val) : { items: [], notes: [] };
        if (val) {
          loaded[uid] = JSON.parse(val);
        }
        // skip entirely if no stored value — don't create empty entries
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
        loaded[uid] = val || "";
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

  /** GET /api/v1/account-screen/personal/:profile_id — maps to purchases, bounties, sales (expertise qty). */
  const refreshAccountScreenPersonal = async () => {
    try {
      setTransactionLoading(true);
      setBountyLoading(true);
      setExpertiseLoading(true);
      const rawProfileId = await AsyncStorage.getItem("profile_uid");
      const profileId = rawProfileId ? String(rawProfileId).trim() : "";
      if (!profileId) {
        console.log("No profile ID found, skipping account-screen personal fetch");
        setTransactionData([]);
        setBountyData(null);
        setExpertiseData([]);
        return;
      }
      const url = `${ACCOUNT_SCREEN_PERSONAL_ENDPOINT}/${profileId}`;
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (response.status === 400) {
        // Treat as empty aggregate payload but still load purchases/bounties/sales like legacy.
        const legacyTx = await fetchLegacyPersonalBuyerTransactions(profileId);
        setTransactionData(legacyTx);
        setBountyData({ data: [] });
        let sellerTx = await fetchLegacySellerTransactionsForProfile(profileId);
        const session = await getSessionProfile();
        const profileResult = session?.rawProfile;
        const expertiseList = profileResult?.expertise_info ? parseExpertiseInfo(profileResult.expertise_info) : [];
        setExpertiseData(buildExpertiseRows(expertiseList, sellerTx));
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
      const mapped = mapAccountScreenPersonalResponse(json);

      let purchaseRows = mapped.transactions;
      if (!purchaseRows.length) {
        purchaseRows = await fetchLegacyPersonalBuyerTransactions(profileId);
      }

      setTransactionData(purchaseRows);

      if (mapped.bounty) {
        setBountyData(mapped.bounty);
      } else {
        setBountyData({ data: [] });
      }

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

      let sellerTx = mapped.sellerTransactions;
      if (sellerTx === undefined) {
        sellerTx = await fetchLegacySellerTransactionsForProfile(profileId);
      }

      const session = await getSessionProfile();
      const profileResult = session?.rawProfile;
      let expertiseList = [];
      if (mapped.profile?.expertise_info != null) {
        expertiseList = parseExpertiseInfo(mapped.profile.expertise_info);
      } else if (profileResult?.expertise_info) {
        expertiseList = parseExpertiseInfo(profileResult.expertise_info);
      }
      setExpertiseData(buildExpertiseRows(expertiseList, sellerTx));
    } catch (error) {
      console.error("Error loading account-screen personal:", error);
      try {
        const rawPid = await AsyncStorage.getItem("profile_uid");
        const pid = rawPid ? String(rawPid).trim() : "";
        if (pid) {
          const legacy = await fetchLegacyPersonalBuyerTransactions(pid);
          setTransactionData(legacy);
        } else {
          setTransactionData([]);
        }
      } catch {
        setTransactionData([]);
      }
      setBountyData({ error: error.message });
      setExpertiseData([]);
    } finally {
      setTransactionLoading(false);
      setBountyLoading(false);
      setExpertiseLoading(false);
    }
  };

  const updateTransactionEscrow = async (transactionUid) => {
    try {
      setUpdatingEscrow(true);
      const url = `${API_BASE_URL}/api/v1/transactions`;
      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_uid: transactionUid,
          transaction_in_escrow: 0,
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update: ${response.status}`);
      }
      setShowReceiveItemModal(false);
      setPendingTransactionForConfirm(null);
      await refreshAccountScreenPersonal();
    } catch (error) {
      console.error("Error updating transaction escrow:", error);
      Alert.alert("Error", "Failed to update payment status. Please try again.");
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

      // Get the first business UID
      if (businessList.length > 0) {
        const firstBusiness = businessList[0];
        const businessId = firstBusiness.business_uid || firstBusiness.profile_business_uid;
        console.log("Setting business UID:", businessId);
        setBusinessUID(businessId);
        return businessId;
      }

      console.log("No businesses found for user");
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
        headers: {
          "Content-Type": "application/json",
        },
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
        const r = await fetch(`${TRANSACTION_RECEIPT_ENDPOINT}/${txn.transaction_profile_id}/${uid}?seller_id=${encodeURIComponent(biz)}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
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

  /**
   * GET /api/v1/account-screen/business/:business_uid — product results + seller lines for grouping/receipts.
   * @param {string} [primaryBusinessUidOverride] — use right after fetchUserBusinesses() before React state updates.
   */
  const refreshAccountScreenBusiness = async (primaryBusinessUidOverride) => {
    try {
      setBusinessTransactionLoading(true);
      setBusinessBountyLoading(true);
      const targetBusinessUID = selectedAccount !== "personal" ? selectedAccount : (primaryBusinessUidOverride ?? businessUID);

      if (!targetBusinessUID) {
        console.log("No business UID available");
        setBusinessTransactionData([]);
        setBusinessBountyData(null);
        setBusinessReceiptCache({});
        businessReceiptFetchedRef.current = new Set();
        return;
      }

      businessReceiptFetchedRef.current = new Set();
      setBusinessReceiptCache({});

      const response = await fetch(`${ACCOUNT_SCREEN_BUSINESS_ENDPOINT}/${targetBusinessUID}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.status === 400) {
        setBusinessBountyData({ data: [] });
        setBusinessTransactionData([]);
        setBusinessReceiptCache({});
        businessReceiptFetchedRef.current = new Set();
        return;
      }

      if (!response.ok) {
        console.error(`account-screen business HTTP ${response.status}`);
        setBusinessTransactionData([]);
        setBusinessBountyData(null);
        businessReceiptFetchedRef.current = new Set();
        return;
      }

      const json = await response.json();
      const { bountyResult, sellerLines } = mapAccountScreenBusinessResponse(json);

      const selectedBusiness = businesses.find((b) => (b.business_uid || b.profile_business_uid) === targetBusinessUID);

      if (bountyResult?.data && Array.isArray(bountyResult.data)) {
        bountyResult.data.forEach((bounty) => {
          bounty.business_name = selectedBusiness?.business_name || selectedBusiness?.profile_business_name || "Unknown Business";
        });
        bountyResult.data.sort((a, b) => {
          const dateA = new Date(a.transaction_datetime);
          const dateB = new Date(b.transaction_datetime);
          return dateB - dateA;
        });
        setBusinessBountyData(bountyResult);
      } else {
        setBusinessBountyData(null);
      }

      if (selectedAccount === "personal") {
        setBusinessTransactionData([]);
        setBusinessReceiptCache({});
        businessReceiptFetchedRef.current = new Set();
        return;
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
        setBusinessTransactionData([]);
        setBusinessReceiptCache({});
        businessReceiptFetchedRef.current = new Set();
        return;
      }

      const businessTransactions = sellerLines.filter((item) => item.ti_bs_id && item.ti_bs_id.startsWith("250-"));
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
            transaction_return_status: item.transaction_return_status || "",
          };
        }
      });

      const filteredTransactions = Object.values(transactionMap).sort((a, b) => {
        const dateA = new Date(a.transaction_datetime);
        const dateB = new Date(b.transaction_datetime);
        return dateB - dateA;
      });

      setBusinessTransactionData(filteredTransactions);
    } catch (error) {
      console.error("Error loading account-screen business:", error);
      setBusinessTransactionData([]);
      setBusinessBountyData({ error: error.message });
      setBusinessReceiptCache({});
      businessReceiptFetchedRef.current = new Set();
    } finally {
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
        const primaryBusinessUid = await fetchUserBusinesses();
        await refreshAccountScreenBusiness(primaryBusinessUid);
      };
      loadBusinessData();
    }, []),
  );

  // Load business data when switching to business account
  useEffect(() => {
    if (selectedAccount !== "personal") {
      refreshAccountScreenBusiness();
    }
  }, [selectedAccount, businesses]); // Add 'businesses' as dependency

  // Add this with your other useEffects
  useEffect(() => {
    const fetchSelectedBusinessFullData = async () => {
      if (selectedAccount === "personal" || !selectedAccount) {
        setSelectedBusinessFullData(null);
        return;
      }

      try {
        const response = await fetch(`${BUSINESS_INFO_ENDPOINT}/${selectedAccount}`);
        const result = await response.json();

        if (result && result.business) {
          const rawBusiness = result.business;

          const businessProfileImg = rawBusiness.business_profile_img && String(rawBusiness.business_profile_img).trim() !== "" ? String(rawBusiness.business_profile_img).trim() : null;
          const imageIsPublic =
            rawBusiness.business_profile_img_is_public === "1" ||
            rawBusiness.business_profile_img_is_public === 1 ||
            rawBusiness.business_image_is_public === "1" ||
            rawBusiness.business_image_is_public === 1;
          setSelectedBusinessFullData({
            business_name: rawBusiness.business_name,
            business_location: rawBusiness.business_location,
            business_address_line_1: rawBusiness.business_address_line_1,
            business_city: rawBusiness.business_city,
            business_state: rawBusiness.business_state,
            business_zip_code: rawBusiness.business_zip_code,
            business_phone_number: rawBusiness.business_phone_number,
            business_email_id: rawBusiness.business_email_id,
            business_website: rawBusiness.business_website,
            business_tag_line: rawBusiness.business_tag_line,
            tagline: rawBusiness.business_tag_line,
            first_image: businessProfileImg || rawBusiness.business_images_url?.[0] || rawBusiness.business_google_photos?.[0],
            business_profile_img: businessProfileImg,
            imageIsPublic: imageIsPublic,
            phoneIsPublic: rawBusiness.business_phone_number_is_public === "1" || rawBusiness.business_phone_number_is_public === 1,
            emailIsPublic: rawBusiness.business_email_id_is_public === "1" || rawBusiness.business_email_id_is_public === 1,
            taglineIsPublic: rawBusiness.business_tag_line_is_public === "1" || rawBusiness.business_tag_line_is_public === 1,
            locationIsPublic: rawBusiness.business_location_is_public === "1" || rawBusiness.business_location_is_public === 1,
          });
        }
      } catch (error) {
        console.error("Error fetching selected business full data:", error);
        setSelectedBusinessFullData(null);
      }
    };

    fetchSelectedBusinessFullData();
  }, [selectedAccount]);

  // Format date to dd/mm format
  const formatTransactionDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${month}/${day}`;
  };

  // Returns true if a pending transaction is 5+ days old and should auto-pay
  const isAutoPaid = (transaction) => {
    if (transaction.transaction_in_escrow !== 1) return false;
    if (!transaction.transaction_datetime) return false;
    const diffDays = (new Date() - new Date(transaction.transaction_datetime)) / (1000 * 60 * 60 * 24);
    console.log("isAutoPaid check:", transaction.transaction_uid, "diffDays:", diffDays); // ← add
    return diffDays >= 5;
  };

  // Silently releases escrow for aged-out transactions
  const triggerAutoPay = useCallback(async (transactionUid) => {
    try {
      await saveAutoPaidId(transactionUid); // persists + updates state
      await fetch(`${API_BASE_URL}/api/v1/transactions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_uid: transactionUid, transaction_in_escrow: 0 }),
      });
      await refreshAccountScreenPersonal();
    } catch (error) {
      console.error("Auto-pay failed for transaction:", transactionUid, error);
      setAutoPaidTransactionIds((prev) => {
        const next = new Set(prev);
        next.delete(transactionUid);
        return next;
      });
    }
  }, []);

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
      if (!transaction.transaction_datetime || !transaction.bounty_earned) return;

      const date = new Date(transaction.transaction_datetime);
      const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD

      if (!bountyByDate[dateKey]) {
        bountyByDate[dateKey] = 0;
      }
      bountyByDate[dateKey] += parseFloat(transaction.bounty_earned) || 0;
    });

    // Sort dates
    const sortedDates = Object.keys(bountyByDate).sort();

    // Get last 12 data points (or all if less than 12)
    const recentDates = sortedDates.slice(-12);

    // Build daily bounty array (one line)
    const dailyBounty = recentDates.map((date) => bountyByDate[date]);

    // Build cumulative bounty array (second line)
    const cumulativeBounty = [];
    let runningTotal = 0;
    recentDates.forEach((date) => {
      runningTotal += bountyByDate[date];
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
      if (!transaction.transaction_datetime || !transaction.net_earning) return;

      const date = new Date(transaction.transaction_datetime);
      const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD

      if (!earningsByDate[dateKey]) {
        earningsByDate[dateKey] = 0;
      }
      earningsByDate[dateKey] += parseFloat(transaction.net_earning) || 0; // Changed from transaction_total
    });

    // Rest of the function stays the same
    const sortedDates = Object.keys(earningsByDate).sort();
    const recentDates = sortedDates.slice(-12);
    const dailyEarnings = recentDates.map((date) => earningsByDate[date]);

    const cumulativeEarnings = [];
    let runningTotal = 0;
    recentDates.forEach((date) => {
      runningTotal += earningsByDate[date];
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

  // Format date for X-axis (MM/DD)
  const formatDateLabel = (dateString) => {
    const d = new Date(dateString);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${month}/${day}`;
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

          {/* X-axis labels (dates) */}
          {chartData.dates.map((date, index) => {
            const x = xPositions[index];
            return (
              <SvgText key={`x-label-${index}`} x={x} y={paddingTop + plotHeight + 15} fontSize='10' fill='#666' textAnchor='middle'>
                {formatDateLabel(date)}
              </SvgText>
            );
          })}

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

          {/* X-axis labels */}
          {chartData.dates.map((date, index) => {
            const x = xPositions[index];
            return (
              <SvgText key={`x-label-${index}`} x={x} y={paddingTop + plotHeight + 15} fontSize='10' fill='#666' textAnchor='middle'>
                {formatDateLabel(date)}
              </SvgText>
            );
          })}

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

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size='large' color='#007BFF' />
        <Text style={{ marginTop: 10 }}>Loading account data...</Text>
      </View>
    );
  }

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
        <View style={styles.sectionContainer}>
          {selectedAccount === "personal" ? personalProfileData && <MiniCard user={personalProfileData} /> : selectedBusinessFullData && <MiniCard business={selectedBusinessFullData} />}
        </View>
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
              onPress={() => {
                setAccountType("personal");
                setSelectedAccount("personal");
                setShowAccountDropdown(false);
              }}
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
                  onPress={() => {
                    setAccountType("business");
                    setSelectedAccount(businessId);
                    setShowAccountDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, selectedAccount === businessId && styles.dropdownItemTextActive]}>{businessName}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {accountType === "personal" ? (
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
                        <Text style={[styles.transactionHeaderDate, { flex: 1 }]}>Cost</Text>
                        <Text style={[styles.transactionHeaderDate, { flex: 1 }]}>Unit</Text>
                        <Text style={[styles.transactionHeaderDate, { flex: 1 }]}>Qty</Text>
                        <Text style={[styles.transactionHeaderAmount, { flex: 1, textAlign: "right" }]}>Bounty</Text>
                      </View>
                      {expertiseData.map((item, idx) => (
                        <View key={idx} style={styles.tableRow}>
                          <Text style={[styles.tableCell, { flex: 1.5, color: "#777" }]}>{item.name}</Text>
                          <Text style={[styles.tableCell, { flex: 1, color: "#777", marginLeft: 30 }]}>${item.cost}</Text>
                          <Text style={[styles.tableCell, { flex: 1, color: "#777", marginLeft: 12 }]}>{item.unit}</Text>
                          <Text style={[styles.tableCell, { flex: 1, color: "#777", marginLeft: 12 }]}>{item.quantity || 0}</Text>
                          <Text style={[styles.tableCell, { flex: 1, color: "#777", textAlign: "right", marginRight: 15 }]}>${item.bounty}</Text>
                        </View>
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
                        {ACCOUNT_TRANSACTION_HISTORY_COMPACT_COLUMNS !== 1 && <Text style={styles.transactionHeaderId}>Transaction ID</Text>}
                        <Text style={styles.transactionHeaderPurchaseType}>Type</Text>
                        <Text style={styles.transactionHeaderBusiness}>Seller</Text>
                        {ACCOUNT_TRANSACTION_HISTORY_COMPACT_COLUMNS !== 1 && <Text style={styles.transactionHeaderPurchasedItem}>Purchased Item</Text>}
                        {ACCOUNT_TRANSACTION_HISTORY_COMPACT_COLUMNS !== 1 && <Text style={styles.transactionHeaderQty}>Qty</Text>}
                        <Text style={styles.transactionHeaderPaid}>Paid</Text>
                        <Text style={styles.transactionHeaderAmount}>Amount</Text>
                      </View>
                      {/* Table Rows */}
                      {transactionData.map((transaction, i) => {
                        // const isSeeking = (transaction.purchase_type || "").toLowerCase() === "seeking";
                        // const isBusiness = (transaction.purchase_type || "").toLowerCase() === "business";
                        // const isPending = transaction.transaction_in_escrow === 1;
                        // const showPendingLink = (isSeeking || isBusiness) && isPending;
                        // const wasAutoPaid = autoPaidTransactionIds.has(transaction.transaction_uid);

                        const isSeeking = (transaction.purchase_type || "").toLowerCase() === "seeking";
                        const isBusiness = (transaction.purchase_type || "").toLowerCase() === "business";
                        const isPending = transaction.transaction_in_escrow === 1;
                        const purchaseDate = new Date(transaction.transaction_datetime);
                        const isOlderThan5Days = (new Date() - purchaseDate) / (1000 * 60 * 60 * 24) >= 5;
                        const showPendingLink = (isSeeking || isBusiness) && isPending;
                        const showAutoPaid = (isSeeking || isBusiness) && !isPending && isOlderThan5Days;

                        const compactTx = ACCOUNT_TRANSACTION_HISTORY_COMPACT_COLUMNS === 1;

                        return (
                          <View key={transaction.ti_uid || i} style={styles.transactionRow}>
                            <Text style={styles.transactionDate}>{formatTransactionDate(transaction.transaction_datetime)}</Text>
                            {!compactTx && <Text style={styles.transactionId}>{transaction.transaction_uid || "N/A"}</Text>}
                            <Text style={styles.transactionPurchaseType}>{transaction.purchase_type || "N/A"}</Text>
                            <View style={{ flex: 1, paddingHorizontal: 4, justifyContent: "center", minWidth: 0 }}>
                              <TouchableOpacity onPress={() => fetchReceipt(transaction)} activeOpacity={0.7}>
                                <Text style={[styles.transactionBusiness, styles.receiptLink]} numberOfLines={4}>
                                  {transaction.business_name || "N/A"}
                                </Text>
                              </TouchableOpacity>
                            </View>
                            {!compactTx && (
                              <View style={styles.transactionPurchasedItemCell}>
                                <Text style={styles.transactionPurchasedItem}>{transaction.purchased_item || "N/A"}</Text>
                              </View>
                            )}
                            {!compactTx && <Text style={styles.transactionQty}>{transaction.ti_bs_qty || 1}</Text>}
                            <View style={styles.transactionPaidCell}>
                              {(() => {
                                const uid = transaction.transaction_uid;
                                const returnStatus = returnStatuses[uid] || transaction.transaction_return_status || "";
                                const returnRequested = returnRequests[uid]?.items?.length > 0 || transaction.transaction_return_requested === 1;

                                // 1. Return accepted → Returned (final state)
                                if (returnStatus === "accepted") {
                                  return <Text style={[styles.transactionPaidText, { color: "#B71C1C", fontWeight: "600" }]}>Returned</Text>;
                                }
                                // 2. Return requested but not yet resolved → Returning
                                if (returnRequested && returnStatus !== "declined" && returnStatus !== "resolved") {
                                  return <Text style={[styles.transactionPaidText, { color: "#E65100", fontWeight: "600" }]}>Returning</Text>;
                                }
                                // 3. Auto-paid (older than 5 days, already released from escrow)
                                if (showAutoPaid) {
                                  return <Text style={styles.transactionPaidText}>Auto</Text>;
                                }
                                // 4. Pending but older than 5 days → trigger auto-pay
                                if (showPendingLink && isOlderThan5Days) {
                                  triggerAutoPay(transaction.transaction_uid);
                                  return <Text style={styles.transactionPaidText}>Auto</Text>;
                                }
                                // 5. Pending and within 5 days → show Pending link
                                if (showPendingLink) {
                                  return (
                                    <TouchableOpacity
                                      onPress={() => {
                                        setPendingTransactionForConfirm(transaction);
                                        setShowReceiveItemModal(true);
                                      }}
                                      activeOpacity={0.7}
                                    >
                                      <Text style={styles.pendingLink}>Pending</Text>
                                    </TouchableOpacity>
                                  );
                                }
                                // 6. Default → Pending or Received
                                return <Text style={styles.transactionPaidText}>{isPending ? "Pending" : "Received"}</Text>;
                              })()}
                            </View>
                            <Text style={styles.transactionAmount}>${parseFloat(transaction.seller_total || transaction.transaction_total || 0).toFixed(2)}</Text>
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
              {showNetEarning && <NetEarningChart />}
            </View>

            {/* Balance summary */}
            <View style={styles.sectionContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowBalance(!showBalance)}>
                <Text style={styles.sectionHeaderText}>BALANCE</Text>
                <Ionicons name={showBalance ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showBalance && (
                <>
                  {bountyLoading ? (
                    <Text style={styles.loadingText}>Loading balance...</Text>
                  ) : bountyData?.error ? (
                    <Text style={styles.errorText}>Unable to load balance.</Text>
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
                          {ACCOUNT_TRANSACTION_HISTORY_COMPACT_COLUMNS !== 1 && <Text style={styles.transactionHeaderId}>ID</Text>}
                          <Text style={styles.transactionHeaderDate}>Date</Text>
                          <Text style={styles.transactionHeaderBusiness}>Purchaser</Text>
                          <Text style={styles.transactionHeaderPurchasedItem}>Business</Text>
                          <Text style={styles.transactionHeaderPaid}>Paid</Text>
                          <Text style={styles.transactionHeaderAmount}>Bounty</Text>
                        </View>
                        {bountyData.data.map((item, index) => {
                          const formatDate = (dateString) => {
                            if (!dateString) return "N/A";
                            const date = new Date(dateString);
                            const month = String(date.getMonth() + 1).padStart(2, "0");
                            const day = String(date.getDate()).padStart(2, "0");
                            return `${month}/${day}`;
                          };
                          const paidLabel =
                            item.in_escrow === 1 && (new Date() - new Date(item.transaction_datetime)) / (1000 * 60 * 60 * 24) >= 30 ? "Paid" : item.in_escrow === 1 ? "Pending" : "Paid";
                          return (
                            <View key={item.tb_uid || item.ti_transaction_id || index} style={styles.transactionRow}>
                              {ACCOUNT_TRANSACTION_HISTORY_COMPACT_COLUMNS !== 1 && <Text style={styles.transactionId}>{item.ti_transaction_id || item.ti_uid || "N/A"}</Text>}
                              <Text style={styles.transactionDate}>{formatDate(item.transaction_datetime)}</Text>
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
            {/* Product Results formerly Business Bounty Results */}
            <View style={styles.sectionContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowProductResults(!showProductResults)}>
                <Text style={styles.sectionHeaderText}>PRODUCT RESULTS</Text>
                <Ionicons name={showProductResults ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showProductResults && (
                <>
                  {businessBountyLoading ? (
                    <Text style={styles.loadingText}>Loading business bounty data...</Text>
                  ) : businessBountyData?.error ? (
                    <Text style={styles.errorText}>Error: {businessBountyData.error}</Text>
                  ) : businessBountyData?.data ? (
                    <View>
                      {/* Table Header */}
                      <View style={styles.businessBountyTableHeader}>
                        <Text style={styles.businessBountyHeaderCell}>Date</Text>
                        <Text style={styles.businessBountyHeaderCell}>Product UID</Text>
                        <Text style={styles.businessBountyHeaderCell}>Product Name</Text>
                        <Text style={styles.businessBountyHeaderCell}>Cost</Text>
                        <Text style={styles.businessBountyHeaderCell}>Bounty</Text>
                        <Text style={styles.businessBountyHeaderCell}>Qty</Text>
                        <Text style={styles.businessBountyHeaderCell}>Bounty Paid</Text>
                      </View>
                      {/* Table Rows */}
                      {businessBountyData.data.map((transaction, index) => {
                        const formatDate = (dateString) => {
                          if (!dateString) return "N/A";
                          const date = new Date(dateString);
                          const month = String(date.getMonth() + 1).padStart(2, "0");
                          const day = String(date.getDate()).padStart(2, "0");
                          return `${month}/${day}`;
                        };
                        return (
                          <View key={transaction.transaction_uid || index} style={styles.businessBountyTableRow}>
                            <Text style={styles.businessBountyCell}>{formatDate(transaction.transaction_datetime)}</Text>
                            <Text style={styles.businessBountyCell}>{transaction.bs_uid || "N/A"}</Text>
                            <Text style={styles.businessBountyCell}>{transaction.bs_service_name || "N/A"}</Text>
                            <Text style={styles.businessBountyCell}>${parseFloat(transaction.bs_cost || 0).toFixed(2)}</Text>
                            <Text style={styles.businessBountyCell}>${parseFloat(transaction.bs_bounty || 0).toFixed(2)}</Text>
                            <Text style={styles.businessBountyCell}>{transaction.ti_bs_qty || 0}</Text>
                            <Text style={styles.businessBountyCell}>${parseFloat(transaction.bounty_paid || 0).toFixed(2)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.noDataText}>No business bounty data available.</Text>
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
              {showBusinessNetEarning && <BusinessNetEarningChart />}
            </View>

            {/* Balance summary */}
            <View style={styles.sectionContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowBalance(!showBalance)}>
                <Text style={styles.sectionHeaderText}>BALANCE</Text>
                <Ionicons name={showBalance ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showBalance && (
                <>
                  {businessTransactionLoading ? (
                    <Text style={styles.loadingText}>Loading balance...</Text>
                  ) : (
                    <View style={styles.balanceSectionBody}>
                      <View style={styles.balanceContainer}>
                        <Text style={[styles.sectionLabel, { color: darkMode ? "#e0e0e0" : "#333" }]}>Total net earnings</Text>
                        <Text style={[styles.balanceAmount, { color: darkMode ? "#fff" : "#000" }]}>${businessNetEarningsTotal.toFixed(2)}</Text>
                      </View>
                    </View>
                  )}
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

                        return (
                          <View key={transaction.transaction_uid || i}>
                            {/* Main Transaction Row */}
                            <TouchableOpacity
                              style={[
                                styles.businessTransactionRow,
                                (transaction.transaction_return_requested === 1 || returnRequests[transaction.transaction_uid]?.items?.length > 0) &&
                                  returnStatuses[transaction.transaction_uid] !== "accepted" &&
                                  returnStatuses[transaction.transaction_uid] !== "resolved" &&
                                  transaction.transaction_return_status !== "accepted" &&
                                  transaction.transaction_return_status !== "resolved" && {
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
                              <Text style={styles.businessTransactionCell}>{formatTransactionDate(transaction.transaction_datetime)}</Text>
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
                                    color: returnStatuses[transaction.transaction_uid] === "accepted" || transaction.transaction_return_status === "accepted" ? "#B71C1C" : "#333",
                                  },
                                ]}
                              >
                                {returnStatuses[transaction.transaction_uid] === "accepted" || transaction.transaction_return_status === "accepted"
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
                                    onPress={async () => {
                                      const localNotes = returnRequests[transaction.transaction_uid]?.notes || [];
                                      const noteText =
                                        localNotes.length > 0
                                          ? localNotes.map((n) => `[${new Date(n.date).toLocaleDateString()}]\n${n.note}`).join("\n\n---\n\n")
                                          : transaction.transaction_return_note || "No note provided.";
                                      await prefetchBusinessReceiptForTransaction(transaction);
                                      setViewingReturnNote(noteText);
                                      setViewingReturnTransactionUid(transaction.transaction_uid);
                                      setShowReturnNoteViewModal(true);
                                    }}
                                  >
                                    <Ionicons name='return-down-back-outline' size={14} color='#B71C1C' style={{ marginRight: 6 }} />
                                    <Text style={{ color: "#B71C1C", fontSize: 12, fontWeight: "600" }}>Return Requested by Customer — Tap to view details</Text>
                                  </TouchableOpacity>
                                )}
                                {(returnStatuses[transaction.transaction_uid] === "accepted" || transaction.transaction_return_status === "accepted") && (
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
                                    <Text style={{ flex: 1, fontSize: 11, color: "#B71C1C", textAlign: "center" }}>{formatTransactionDate(transaction.transaction_datetime)}</Text>
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
              <ActivityIndicator size='large' color='#18884A' style={{ marginVertical: 24 }} />
            ) : receiptData.length > 0 ? (
              <ScrollView style={styles.receiptScrollView} horizontal>
                <View>
                  <View style={styles.receiptTableHeader}>
                    <Text style={styles.receiptHeaderCell}>Item Name</Text>
                    <Text style={styles.receiptHeaderCell}>Qty</Text>
                    <Text style={styles.receiptHeaderCell}>Cost</Text>
                  </View>
                  {receiptData.map((item, index) => (
                    <View key={item.ti_uid || item.ti_bs_id || index} style={styles.receiptTableRow}>
                      <Text style={styles.receiptTableCell}>{item.bs_service_name || "N/A"}</Text>
                      <Text style={styles.receiptTableCell}>{item.ti_bs_qty ?? "N/A"}</Text>
                      <Text style={styles.receiptTableCell}>${parseFloat(item.ti_bs_cost || 0).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <Text style={[styles.noDataText, { marginVertical: 24 }]}>No receipt data available.</Text>
            )}

            {/* Return requested confirmation message */}
            {(returnRequests[receiptTransaction?.transaction_uid]?.requested || receiptTransaction?.transaction_return_requested === 1) && (
              <Text style={{ color: "#B71C1C", textAlign: "center", marginTop: 12, fontWeight: "600", fontSize: 14 }}>✓ Return has been requested</Text>
            )}

            {(() => {
              const uid = receiptTransaction?.transaction_uid;
              const storedItems = returnRequests[uid]?.items || [];
              const totalItems = receiptData.length;

              // Only count indices that are actually valid for this receipt
              const validIndices = Array.from({ length: totalItems }, (_, i) => String(i));
              const returnedValidIndices = validIndices.filter((id) => storedItems.includes(id));

              // Must have receipt items AND every valid index must be returned
              const allItemsReturned = totalItems > 0 && storedItems.length > 0 && returnedValidIndices.length >= totalItems;

              return (
                <TouchableOpacity
                  style={[styles.receiptCloseButton, { borderColor: "#B71C1C", marginTop: 12 }, allItemsReturned && { opacity: 0.4 }]}
                  disabled={allItemsReturned}
                  onPress={() => {
                    if (!allItemsReturned) {
                      setReturnModalReceiptData(receiptData);
                      setShowReceiptModal(false);
                      setTimeout(() => setShowReturnNoteModal(true), 300);
                    }
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
      <Modal animationType='fade' transparent={true} visible={showReturnNoteModal} onRequestClose={() => setShowReturnNoteModal(false)}>
        <View style={[styles.receiveItemModalOverlay, darkMode && styles.darkModalOverlay]}>
          <View style={[styles.receiveItemModalContent, darkMode && styles.darkModalContent, { maxHeight: "80%" }]}>
            <Text style={[styles.receiveItemModalHeader, { color: "#B71C1C" }, darkMode && styles.darkTitle]}>Request Return</Text>

            {/* Item selection */}
            <Text style={{ fontSize: 14, color: darkMode ? "#ccc" : "#555", marginBottom: 8 }}>Select item(s) to return:</Text>
            <ScrollView style={{ maxHeight: 160, marginBottom: 12 }}>
              {returnModalReceiptData.map((item, index) => {
                const itemId = String(index);
                const isSelected = selectedReturnItems.includes(itemId);
                const alreadyReturned = (returnRequests[receiptTransaction?.transaction_uid]?.items || []).includes(itemId);
                return (
                  <TouchableOpacity
                    key={itemId}
                    disabled={alreadyReturned}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 8,
                      paddingHorizontal: 4,
                      borderBottomWidth: 1,
                      borderBottomColor: darkMode ? "#444" : "#eee",
                      opacity: alreadyReturned ? 0.4 : 1,
                    }}
                    onPress={() => {
                      if (!alreadyReturned) {
                        setSelectedReturnItems((prev) => (isSelected ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={18} color={isSelected ? "#B71C1C" : "#555"} style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 13, color: darkMode ? "#fff" : "#333", flex: 1 }}>
                      {item.bs_service_name || "Item"} — ${parseFloat(item.ti_bs_cost || 0).toFixed(2)} x {item.ti_bs_qty || 1}
                    </Text>
                    {alreadyReturned && <Text style={{ fontSize: 11, color: "#B71C1C", marginLeft: 4 }}>Already returned</Text>}
                  </TouchableOpacity>
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

            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={[styles.receiveItemModalButton, styles.receiveItemNoButton, darkMode && styles.darkCancelButton]}
                onPress={() => {
                  setShowReturnNoteModal(false);
                  setReturnNote("");
                  setSelectedReturnItems([]);
                }}
              >
                <Text style={[styles.receiveItemModalButtonText, styles.receiveItemNoButtonText, darkMode && styles.darkCancelButtonText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.receiveItemModalButton, { backgroundColor: selectedReturnItems.length === 0 ? "#ccc" : "#B71C1C" }]}
                disabled={selectedReturnItems.length === 0}
                onPress={async () => {
                  const selectedNames = returnModalReceiptData
                    .filter((item, index) => selectedReturnItems.includes(String(index)))
                    .map((item) => `${item.bs_service_name || "Item"} x${item.ti_bs_qty || 1}`)
                    .join(", ");
                  // const fullNote = `Items: ${selectedNames}\n\nReason: ${returnNote}`;
                  const fullNote = `Buyer Note: ${returnNote}`;
                  await handleReturnRequest(receiptTransaction, fullNote);
                  setShowReturnNoteModal(false);
                  setReturnNote("");
                  setSelectedReturnItems([]);
                }}
              >
                <Text style={styles.receiveItemModalButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
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
                  const returnedItems = (entry.items || []).map((itemId) => cachedReceipt[parseInt(itemId)]).filter(Boolean);

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
                          {returnedItems.map((item, itemIdx) => (
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
                              <Text style={{ fontSize: 12, color: darkMode ? "#ccc" : "#666", marginHorizontal: 8 }}>x{item.ti_bs_qty || 1}</Text>
                              <Text style={{ fontSize: 12, color: darkMode ? "#ccc" : "#666" }}>${parseFloat(item.ti_bs_cost || 0).toFixed(2)}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      <Text style={{ fontSize: 13, color: darkMode ? "#fff" : "#333", lineHeight: 20, marginBottom: 8 }}>{entry.note || "No reason provided."}</Text>

                      {/* Per-return Accept/Decline */}
                      {returnStatuses[`${viewingReturnTransactionUid}_${idx}`] ? (
                        <Text
                          style={{
                            fontWeight: "600",
                            fontSize: 13,
                            color: returnStatuses[`${viewingReturnTransactionUid}_${idx}`] === "accepted" ? "#18884A" : "#B71C1C",
                          }}
                        >
                          {returnStatuses[`${viewingReturnTransactionUid}_${idx}`] === "accepted" ? "✓ Accepted" : "✗ Declined"}
                        </Text>
                      ) : (
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TouchableOpacity
                            style={{ flex: 1, padding: 10, borderRadius: 8, alignItems: "center", backgroundColor: "#18884A" }}
                            onPress={async () => {
                              await handleReturnAccept(viewingReturnTransactionUid);
                              setReturnStatuses((prev) => ({ ...prev, [`${viewingReturnTransactionUid}_${idx}`]: "accepted" }));
                              await AsyncStorage.setItem(`return_status_${viewingReturnTransactionUid}_${idx}`, "accepted");
                            }}
                          >
                            <Text style={{ color: "#fff", fontWeight: "bold" }}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flex: 1, padding: 10, borderRadius: 8, alignItems: "center", backgroundColor: "#B71C1C" }}
                            onPress={() => {
                              setPendingDeclineIdx(idx);
                              setDeclineNote("");
                              setShowDeclineNoteModal(true);
                            }}
                          >
                            <Text style={{ color: "#fff", fontWeight: "bold" }}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      )}
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
                  await handleReturnDecline(viewingReturnTransactionUid, declineNote);
                  setReturnStatuses((prev) => ({
                    ...prev,
                    [`${viewingReturnTransactionUid}_${idx}`]: "declined",
                    [viewingReturnTransactionUid]: "declined",
                  }));
                  await AsyncStorage.setItem(`return_status_${viewingReturnTransactionUid}_${idx}`, "declined");
                  await AsyncStorage.setItem(`return_status_${viewingReturnTransactionUid}`, "declined");
                  setShowDeclineNoteModal(false);
                  setDeclineNote("");
                  setPendingDeclineIdx(null);
                }}
              >
                <Text style={styles.receiveItemModalButtonText}>Confirm Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Receive Item Confirmation Modal - for Seeking/Business + Pending transactions */}
      <Modal animationType='fade' transparent={true} visible={showReceiveItemModal} onRequestClose={() => setShowReceiveItemModal(false)}>
        <View style={[styles.receiveItemModalOverlay, darkMode && styles.darkModalOverlay]}>
          <View style={[styles.receiveItemModalContent, darkMode && styles.darkModalContent]}>
            <Text style={[styles.receiveItemModalHeader, darkMode && styles.darkTitle]}>Delivery Verification</Text>
            <Text style={[styles.receiveItemModalTitle, darkMode && styles.darkTitle]}>
              Did you receive the quantity {pendingTransactionForConfirm?.ti_bs_qty ?? 1} of {pendingTransactionForConfirm?.purchased_item || "item"}?
            </Text>
            <View style={styles.receiveItemModalButtons}>
              <TouchableOpacity
                style={[styles.receiveItemModalButton, styles.receiveItemNoButton, darkMode && styles.darkCancelButton]}
                onPress={() => {
                  setShowReceiveItemModal(false);
                  setPendingTransactionForConfirm(null);
                }}
                disabled={updatingEscrow}
              >
                <Text style={[styles.receiveItemModalButtonText, styles.receiveItemNoButtonText, darkMode && styles.darkCancelButtonText]}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.receiveItemModalButton, styles.receiveItemYesButton]}
                onPress={() => {
                  if (pendingTransactionForConfirm?.transaction_uid) {
                    updateTransactionEscrow(pendingTransactionForConfirm.transaction_uid);
                  }
                }}
                disabled={updatingEscrow}
              >
                {updatingEscrow ? <ActivityIndicator size='small' color='#fff' /> : <Text style={styles.receiveItemModalButtonText}>Yes</Text>}
              </TouchableOpacity>
            </View>
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
  contentContainer: { flex: 1, padding: 20 },
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
  transactionPaidText: { fontSize: 11, color: "#333", textAlign: "center" },
  pendingLink: { fontSize: 11, color: "#007AFF", textDecorationLine: "underline" },
  // Header styles
  transactionHeaderDate: { width: 50, fontSize: 13, color: "#fff", fontWeight: "bold" },
  transactionHeaderId: { width: 100, fontSize: 13, color: "#fff", fontWeight: "bold" },
  transactionHeaderPurchaseType: { width: 90, fontSize: 13, color: "#fff", fontWeight: "bold", paddingHorizontal: 2 },
  transactionHeaderBusiness: { flex: 1, fontSize: 13, color: "#fff", fontWeight: "bold", paddingHorizontal: 4 },
  transactionHeaderPurchasedItem: { flex: 1, fontSize: 13, color: "#fff", fontWeight: "bold", paddingHorizontal: 4 },
  transactionHeaderAmount: { width: 70, fontSize: 13, color: "#fff", fontWeight: "bold", textAlign: "right" },
  transactionHeaderPaid: { width: 60, fontSize: 13, color: "#fff", fontWeight: "bold", textAlign: "center" },
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
    padding: 24,
    width: "90%",
    maxWidth: 500,
    maxHeight: "80%",
    ...(Platform.OS === "web" && {
      position: "relative",
      zIndex: 9999,
    }),
  },
  receiptScrollView: {
    maxHeight: 300,
    marginVertical: 16,
  },
  receiptTableHeader: {
    flexDirection: "row",
    backgroundColor: "#18884A",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 2,
  },
  receiptHeaderCell: {
    width: 120,
    fontSize: 13,
    color: "#fff",
    fontWeight: "bold",
    paddingHorizontal: 8,
  },
  receiptTableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  receiptTableCell: {
    width: 120,
    fontSize: 12,
    color: "#333",
    paddingHorizontal: 8,
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
