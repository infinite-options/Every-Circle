import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import { BOUNTY_RESULTS_ENDPOINT, API_BASE_URL, USER_PROFILE_INFO_ENDPOINT, BUSINESS_BOUNTY_RESULTS_ENDPOINT, BUSINESS_INFO_ENDPOINT } from "../apiConfig";
import Svg, { Circle, Line, Text as SvgText, G, Path } from "react-native-svg";
import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useDarkMode } from "../contexts/DarkModeContext";
import FeedbackPopup from "../components/FeedbackPopup";
import { getHeaderColors } from "../config/headerColors";
import MiniCard from "../components/MiniCard";
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
  const [accountType, setAccountType] = useState('personal'); // 'personal' or 'business'
  const [businessTransactionData, setBusinessTransactionData] = useState([]);
  const [businessTransactionLoading, setBusinessTransactionLoading] = useState(true);
  const [businessUID, setBusinessUID] = useState(null);
  const [businessBountyData, setBusinessBountyData] = useState(null);
  const [businessBountyLoading, setBusinessBountyLoading] = useState(true);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('personal'); // 'personal' or business UID
  const [selectedBusinessFullData, setSelectedBusinessFullData] = useState(null);
  const [expandedTransactionId, setExpandedTransactionId] = useState(null);
  const [transactionServices, setTransactionServices] = useState({});

  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);

  const accountFeedbackInstructions = "Instructions for Account";

  // Define custom questions for the Account page
  const accountFeedbackQuestions = ["Account - Question 1?", "Account - Question 2?", "Account - Question 3?"];

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

  // Transaction data loader
  const refreshTransactionData = async () => {
    try {
      console.log("=== STARTING TRANSACTION DATA LOAD ===");
      setTransactionLoading(true);
      const profileId = await AsyncStorage.getItem("profile_uid");
      console.log("Profile ID from AsyncStorage:", profileId);
      if (profileId) {
        const transactionsUrl = `${API_BASE_URL}/api/v1/transactions/${profileId}`;
        console.log("Making GET request to:", transactionsUrl);
        const response = await fetch(transactionsUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        console.log("Response status:", response.status);
        console.log("Response ok:", response.ok);

        // Handle 400 status as empty transactions (no transactions found)
        if (response.status === 400) {
          console.log("No transactions found (400 status), treating as empty result");
          setTransactionData([]);
          return;
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("=== TRANSACTION API RESPONSE ===");
        console.log("Full API response:", JSON.stringify(result, null, 2));
        console.log("Response code:", result?.code);
        console.log("Response message:", result?.message);
        console.log("Data array length:", result?.data?.length);
        console.log("Count:", result?.count);
        if (result?.data && result.data.length > 0) {
          console.log("First transaction:", JSON.stringify(result.data[0], null, 2));
        }
        console.log("=== END TRANSACTION API RESPONSE ===");

        // Extract transactions from response.data
        const transactions = result && result.code === 200 && Array.isArray(result.data) ? result.data : [];
        console.log("Final transactions array length:", transactions.length);
        setTransactionData(transactions);
      } else {
        console.log("No profile ID found, skipping transaction data fetch");
        setTransactionData([]);
      }
    } catch (error) {
      console.error("Error loading transaction data:", error);
      // Set empty array instead of showing error - no transactions is a valid state
      setTransactionData([]);
    } finally {
      setTransactionLoading(false);
    }
  };

  // Bounty data loader
  const refreshBountyData = async () => {
    try {
      setBountyLoading(true);
      const profileId = await AsyncStorage.getItem("profile_uid");
      if (profileId) {
        const response = await fetch(`${BOUNTY_RESULTS_ENDPOINT}/${profileId}`);

        // Check if response is ok before parsing JSON
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Check content type to ensure we're getting JSON
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const textResponse = await response.text();
          console.error("Non-JSON response received:", textResponse.substring(0, 200));
          throw new Error("API returned non-JSON response. Please check the endpoint.");
        }

        const result = await response.json();
        console.log("Bounty results:", result);
        setBountyData(result);
      }
    } catch (error) {
      console.error("Error loading bounty data:", error);
      setBountyData({ error: error.message });
    } finally {
      setBountyLoading(false);
    }
  };

 
  // Expertise data 
  const refreshExpertiseData = async () => {
    try {
      setExpertiseLoading(true);
      const profileId = await AsyncStorage.getItem("profile_uid");
      if (profileId) {
        // First, fetch profile expertise data
        const profileResponse = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${profileId}`);
        
        if (!profileResponse.ok) {
          throw new Error(`HTTP error! status: ${profileResponse.status}`);
        }

        const profileResult = await profileResponse.json();
        console.log("Expertise API response:", profileResult);

        // Parse expertise_info
        const expertiseList = profileResult.expertise_info
          ? (typeof profileResult.expertise_info === "string" 
              ? JSON.parse(profileResult.expertise_info) 
              : profileResult.expertise_info
            )
          : [];

        // Fetch transactions where I am the SELLER
        const sellerTransactionsUrl = `${API_BASE_URL}/api/v1/transactions/seller/${profileId}`;
        let sellerTransactions = [];
        
        try {
          console.log("Fetching seller transactions from:", sellerTransactionsUrl);
          const transactionsResponse = await fetch(sellerTransactionsUrl, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (transactionsResponse.ok) {
            const transactionsResult = await transactionsResponse.json();
            console.log("Seller transactions result:", transactionsResult);
            
            if (transactionsResult && transactionsResult.code === 200 && Array.isArray(transactionsResult.data)) {
              sellerTransactions = transactionsResult.data;
            }
          } else if (transactionsResponse.status === 400) {
            console.log("No seller transactions found (400 status)");
            sellerTransactions = [];
          }
        } catch (error) {
          console.error("Error fetching seller transactions for expertise quantities:", error);
        }

        // Map expertise with quantities from seller transactions
        const expertise = expertiseList.map((exp) => {
          const expertiseUid = exp.profile_expertise_uid;
          const costString = exp.profile_expertise_cost || "";
          
          // Parse cost to separate amount and unit
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

          // Calculate total quantity sold for this expertise
          let totalQty = 0;
          console.log(`Checking seller transactions for expertise: ${exp.profile_expertise_title} (UID: ${expertiseUid})`);
          console.log(`Total seller transaction items to check: ${sellerTransactions.length}`);

          sellerTransactions.forEach((transaction) => {
            console.log(`Seller transaction item ti_bs_id: ${transaction.ti_bs_id}, ti_bs_qty: ${transaction.ti_bs_qty}`);
            
            if (transaction.ti_bs_id === expertiseUid) {
              console.log(`✓ MATCH found for ${exp.profile_expertise_title}!`);
              const qty = parseInt(transaction.ti_bs_qty) || 0;
              totalQty += qty;
              console.log(`Added quantity: ${qty}, New total: ${totalQty}`);
            }
          });

          console.log(`Final quantity for ${exp.profile_expertise_title}: ${totalQty}`);
          
          return {
            name: exp.profile_expertise_title || "",
            cost: cost,
            unit: unit,
            bounty: exp.profile_expertise_bounty || "",
            quantity: totalQty,
            isPublic: exp.profile_expertise_is_public === 1 || exp.isPublic === true,
          };
        });
        
        setExpertiseData(expertise);
      }
    } catch (error) {
      console.error("Error loading expertise data:", error);
      setExpertiseData([]);
    } finally {
      setExpertiseLoading(false);
    }
  };

  // Fetch user's businesses to get business_uid
  const fetchUserBusinesses = async () => {
    try {
      const profileId = await AsyncStorage.getItem("profile_uid");
      if (!profileId) {
        console.log("No profile ID found");
        return null;
      }

      const response = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${profileId}`);
      if (!response.ok) {
        console.log("Failed to fetch user profile");
        return null;
      }

      const result = await response.json();
      console.log("User businesses:", result.business_info);

      // Parse business_info to get business UIDs
      const businessList = result.business_info
        ? (typeof result.business_info === "string" 
            ? JSON.parse(result.business_info) 
            : result.business_info
          )
        : [];

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

    const response = await fetch(
      `${API_BASE_URL}/api/v1/business_services/transaction/${transactionUid}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      const result = await response.json();
      if (result && result.code === 200 && Array.isArray(result.data)) {
        // Cache the data
        setTransactionServices(prev => ({
          ...prev,
          [transactionUid]: result.data
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

  const refreshBusinessTransactionData = async () => {
    try {
      console.log("=== STARTING BUSINESS TRANSACTION DATA LOAD ===");
      setBusinessTransactionLoading(true);
      
      // If personal account is selected, don't load business data
      if (selectedAccount === 'personal') {
        setBusinessTransactionData([]);
        setBusinessTransactionLoading(false);
        return;
      }

      // Get the selected business UID
      const targetBusinessUID = selectedAccount;
      
      if (!targetBusinessUID) {
        console.log("No business UID available");
        setBusinessTransactionData([]);
        setBusinessTransactionLoading(false);
        return;
      }

      console.log(`Fetching transactions for business: ${targetBusinessUID}`);
      
      // First, fetch the business bounty data which has bs_bounty and ti_bs_qty
      let bountyDataByTransaction = {};
      try {
        const bountyResponse = await fetch(`${BUSINESS_BOUNTY_RESULTS_ENDPOINT}/${targetBusinessUID}`);
        if (bountyResponse.ok) {
          const bountyResult = await bountyResponse.json();
          console.log("Business bounty result:", bountyResult);
          
          if (bountyResult && bountyResult.data && Array.isArray(bountyResult.data)) {
            // Group by transaction_uid and sum bounty_paid
            bountyResult.data.forEach(item => {
              const txnId = item.transaction_uid;
              if (!bountyDataByTransaction[txnId]) {
                bountyDataByTransaction[txnId] = {
                  total_bounty: 0,
                  items: []
                };
              }
              // bounty_paid is already calculated as bs_bounty * ti_bs_qty in the API
              const bountyPaid = parseFloat(item.bounty_paid) || 0;
              bountyDataByTransaction[txnId].total_bounty += bountyPaid;
              bountyDataByTransaction[txnId].items.push(item);
            });
          }
        }
      } catch (error) {
        console.error("Error fetching bounty data:", error);
      }

      // Now fetch transaction data
      const businessTransactionsUrl = `${API_BASE_URL}/api/v1/transactions/seller/${targetBusinessUID}`;
      const response = await fetch(businessTransactionsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.status === 400) {
        console.log(`No transactions found for business ${targetBusinessUID}`);
        setBusinessTransactionData([]);
        setBusinessTransactionLoading(false);
        return;
      }

      if (!response.ok) {
        console.error(`Error fetching transactions for business ${targetBusinessUID}`);
        setBusinessTransactionData([]);
        setBusinessTransactionLoading(false);
        return;
      }

      const result = await response.json();
      
      if (result && result.code === 200 && Array.isArray(result.data)) {
        // Filter to only business service transactions (250-)
        const businessTransactions = result.data.filter(
          item => item.ti_bs_id && item.ti_bs_id.startsWith('250-')
        );
        
        // Add business name
        const selectedBusiness = businesses.find(
          b => (b.business_uid || b.profile_business_uid) === targetBusinessUID
        );
        businessTransactions.forEach(txn => {
          txn.business_name = selectedBusiness?.business_name || 
                            selectedBusiness?.profile_business_name || 
                            "Unknown Business";
        });

        // Group by transaction_uid
        const transactionMap = {};
        businessTransactions.forEach(item => {
          const txnId = item.transaction_uid;
          
          if (!transactionMap[txnId]) {
            const total = parseFloat(item.transaction_total || 0);
            const taxes = parseFloat(item.transaction_taxes || 0);
            // Get bounty from bountyDataByTransaction
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
            };
          }
        });

        // Convert to array and sort by date
        const filteredTransactions = Object.values(transactionMap).sort((a, b) => {
          const dateA = new Date(a.transaction_datetime);
          const dateB = new Date(b.transaction_datetime);
          return dateB - dateA;
        });

        console.log(`Total business transactions found: ${filteredTransactions.length}`);
        console.log("Sample transaction with bounty:", filteredTransactions[0]);
        setBusinessTransactionData(filteredTransactions);
      }
      
    } catch (error) {
      console.error("Error loading business transaction data:", error);
      setBusinessTransactionData([]);
    } finally {
      setBusinessTransactionLoading(false);
    }
  };

 // Business Bounty data 
  const refreshBusinessBountyData = async () => {
    try {
      setBusinessBountyLoading(true);
      
      // If specific business is selected, only load that business's data
      const targetBusinessUID = selectedAccount !== 'personal' ? selectedAccount : businessUID;
      
      if (!targetBusinessUID) {
        console.log("No business UID available");
        setBusinessBountyData(null);
        setBusinessBountyLoading(false);
        return;
      }

      console.log(`Fetching bounty results for business: ${targetBusinessUID}`);
      
      try {
        const response = await fetch(`${BUSINESS_BOUNTY_RESULTS_ENDPOINT}/${targetBusinessUID}`);

        if (!response.ok) {
          console.error(`Error fetching bounties for business ${targetBusinessUID}`);
          setBusinessBountyData(null);
          setBusinessBountyLoading(false);
          return;
        }

        const result = await response.json();
        
        if (result && result.data && Array.isArray(result.data)) {
          // Add business name to each bounty record
          const selectedBusiness = businesses.find(
            b => (b.business_uid || b.profile_business_uid) === targetBusinessUID
          );
          
          result.data.forEach(bounty => {
            bounty.business_name = selectedBusiness?.business_name || 
                                  selectedBusiness?.profile_business_name || 
                                  "Unknown Business";
          });
          
          // Sort by date (most recent first)
          result.data.sort((a, b) => {
            const dateA = new Date(a.transaction_datetime);
            const dateB = new Date(b.transaction_datetime);
            return dateB - dateA;
          });

          console.log("Business Bounty results:", result);
          setBusinessBountyData(result);
        }
      } catch (error) {
        console.error(`Error fetching bounties for business:`, error);
        setBusinessBountyData({ error: error.message });
      }
      
    } catch (error) {
      console.error("Error loading business bounty data:", error);
      setBusinessBountyData({ error: error.message });
    } finally {
      setBusinessBountyLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      checkAuth();
      refreshBountyData();
      refreshTransactionData();
      refreshExpertiseData();
      
      // Fetch businesses first, then business transactions and bounties
      const loadBusinessData = async () => {
        await fetchUserBusinesses();
        await refreshBusinessTransactionData();
        await refreshBusinessBountyData();  // ← ADD THIS LINE
      };
      loadBusinessData();
    }, [])
  );

  // Load business data when switching to business account
  useEffect(() => {
    if (selectedAccount !== 'personal') {
      console.log("Switched to business account, loading business data for:", selectedAccount);
      const loadBusinessData = async () => {
        await refreshBusinessTransactionData();
        await refreshBusinessBountyData();
      };
      loadBusinessData();
    }
  }, [selectedAccount, businesses]); // Add 'businesses' as dependency
    
  // Add this with your other useEffects
  useEffect(() => {
    const fetchSelectedBusinessFullData = async () => {
      if (selectedAccount === 'personal' || !selectedAccount) {
        setSelectedBusinessFullData(null);
        return;
      }
      
      try {
        const response = await fetch(`${BUSINESS_INFO_ENDPOINT}/${selectedAccount}`);
        const result = await response.json();
        
        if (result && result.business) {
          const rawBusiness = result.business;
          
          setSelectedBusinessFullData({
            business_name: rawBusiness.business_name,
            business_address_line_1: rawBusiness.business_address_line_1,
            business_city: rawBusiness.business_city,
            business_state: rawBusiness.business_state,
            business_zip_code: rawBusiness.business_zip_code,
            business_phone_number: rawBusiness.business_phone_number,
            business_website: rawBusiness.business_website,
            business_tag_line: rawBusiness.business_tag_line,
            first_image: rawBusiness.business_images_url?.[0] || rawBusiness.business_google_photos?.[0],
            phoneIsPublic: true,
            taglineIsPublic: true,
            imageIsPublic: true,
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

  const budgetData = [
    { item: "per Impression", costPer: "$0.01", monthlyCap: "$10.00", currentSpend: "$0.50" },
    { item: "per Click", costPer: "$0.10", monthlyCap: "$10.00", currentSpend: "$7.20" },
    { item: "per Request", costPer: "$1.00", monthlyCap: "$10.00", currentSpend: "$3.00" },
  ];

  const screenWidth = Dimensions.get("window").width - 40;

  // Process bounty data for Net Earnings chart with dual axes
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

  // Process business transaction data for  business Net Earnings chart 
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
        <Text style={{ color: "#888" }}>No data available</Text>
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
    const y = paddingTop + linearScale(value, chartData.maxCumulative, plotHeight);
    return isFinite(y) ? y : paddingTop + plotHeight;
  });

  // Generate X positions
  const xPositions = chartData.dates.map((_, index) => paddingLeft + index * xStep);

  // Generate left Y-axis ticks (linear)
  // const leftTicks = 6;
  // const leftTickValues = [];
  // for (let i = 0; i <= leftTicks; i++) {
  //   leftTickValues.push((chartData.maxDaily / leftTicks) * i);
  // }

  // Generate left Y-axis ticks (increment by $1.50)
  const leftTickValues = [];
  const increment = 1.50;
  const maxTicks = Math.ceil(chartData.maxDaily / increment);
  for (let i = 0; i <= maxTicks; i++) {
    leftTickValues.push(increment * i);
  }

  // Generate right Y-axis ticks (linear)
  const rightTickValues = [];
  const rightIncrement = 1.50;
  const maxRightTicks = Math.ceil(chartData.maxCumulative / rightIncrement);
  for (let i = 0; i <= maxRightTicks; i++) {
    rightTickValues.push(rightIncrement * i);
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

        {/* Left Y-axis (linear) */}
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

        {/* Right Y-axis (linear) */}
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
        <SvgText 
          x={paddingLeft + plotWidth / 2} 
          y={paddingTop + plotHeight + 35} 
          fontSize='12' 
          fill='#333' 
          fontWeight='600'
          textAnchor='middle'
        >
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

  const leftTicks = 6;
  const leftTickValues = [];
  for (let i = 0; i <= leftTicks; i++) {
    leftTickValues.push((chartData.maxDaily / leftTicks) * i);
  }

  const rightTickValues = generateLinearTicks(chartData.maxCumulative, 6);

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
        <SvgText 
          x={paddingLeft + plotWidth / 2} 
          y={paddingTop + plotHeight + 35} 
          fontSize='12' 
          fill='#333' 
          fontWeight='600'
          textAnchor='middle'
        >
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
      {/* Header with Dropdown */}
      <View style={{ position: 'relative', overflow: 'visible', zIndex: 1000 }}>
        <AppHeader 
          title='Account' 
          {...getHeaderColors("account")}
          onTitlePress={() => setShowFeedbackPopup(true)}
          rightButton={
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => {
                console.log("Dropdown arrow clicked, toggling from:", showAccountDropdown);
                setShowAccountDropdown(!showAccountDropdown);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>
          }
        />
        
        {/* Dropdown positioned outside header to avoid clipping */}
        {showAccountDropdown && (
          <View style={styles.dropdownMenu}>
            {/* Personal Account Option */}
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                console.log("Personal clicked");
                setAccountType('personal');
                setSelectedAccount('personal');
                setShowAccountDropdown(false);
              }}
              activeOpacity={0.6}
            >
              <Text style={[
                styles.dropdownItemText,
                selectedAccount === 'personal' && styles.dropdownItemTextActive
              ]}>
                Personal
              </Text>
            </TouchableOpacity>
            
            {/* Business Account Options */}
            {businesses.length > 0 && (
              <>
                <View style={styles.dropdownDivider} />
                {businesses.map((business, index) => {
                  const businessId = business.business_uid || business.profile_business_uid;
                  const businessName = business.business_name || business.profile_business_name || `Business ${index + 1}`;
                  
                  return (
                    <TouchableOpacity
                      key={businessId || index}
                      style={styles.dropdownItem}
                      onPress={() => {
                        console.log("Business clicked:", businessName);
                        setAccountType('business');
                        setSelectedAccount(businessId);
                        setShowAccountDropdown(false);
                      }}
                      activeOpacity={0.6}
                    >
                      <Text style={[
                        styles.dropdownItemText,
                        selectedAccount === businessId && styles.dropdownItemTextActive
                      ]}>
                        {businessName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </View>
        )}
      </View>
      {/* Main content */}
      <ScrollView style={styles.contentContainer} contentContainerStyle={styles.scrollContentContainer} showsVerticalScrollIndicator={true}>
        {accountType === 'personal' ? (
          <>
        {/* Balance */}
        <View style={styles.balanceContainer}>
          <Text style={styles.sectionLabel}>Balance:</Text>
          <Text style={styles.balanceAmount}>$48.20</Text>
        </View>

        {/* Budget */}
        <View style={styles.sectionContainer}>
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <View style={{ flex: 1.5, flexDirection: "row", alignItems: "center" }}>
                <Text style={[styles.tableHeaderText, { fontSize: 16, fontWeight: "600" }]}>Budget</Text>
                <View style={[styles.questionCircle, { marginLeft: 4 }]}>
                  <Text style={styles.questionMark}>?</Text>
                </View>
              </View>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Cost per</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Monthly Cap</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>Current Spend</Text>
            </View>
            {budgetData.map((item, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 1.5, color: "#777" }]}>{item.item}</Text>
                <Text style={[styles.tableCell, { flex: 1, color: "#777" }]}>{item.costPer}</Text>
                <Text style={[styles.tableCell, { flex: 1, color: "#777" }]}>{item.monthlyCap}</Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: "right", color: "#777" }]}>{item.currentSpend}</Text>
              </View>
            ))}
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1.5, color: "#777" }]}>Max Monthly Spend</Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginRight: 5 }}>
                <View style={styles.questionCircle}>
                  <Text style={styles.questionMark}>?</Text>
                </View>
              </View>
              <Text style={[styles.tableCell, { flex: 0.2, color: "#777" }]}>:</Text>
              <Text style={[styles.tableCell, { flex: 1, color: "#777" }]}>$30.00</Text>
              <Text style={[styles.tableCell, { flex: 1, textAlign: "right", color: "#777" }]}>$10.70</Text>
            </View>
          </View>
        </View>

        {/* Expertise */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Expertise</Text>
            <View style={styles.questionCircle}>
              <Text style={styles.questionMark}>?</Text>
            </View>
          </View>
          {expertiseLoading ? (
            <Text style={styles.loadingText}>Loading expertise data...</Text>
          ) : expertiseData.length > 0 ? (
            <View style={styles.tableContainer}>
              <View style={styles.transactionHeaderRow}>
                <Text style={[styles.transactionHeaderBusiness, { flex: 1.5 }]}>Expertise</Text>
                <Text style={[styles.transactionHeaderDate, { flex: 1 }]}>Cost</Text>
                <Text style={[styles.transactionHeaderDate, { flex: 1 }]}>Unit</Text>
                <Text style={[styles.transactionHeaderDate, { flex: 1 }]}>Qty</Text>
                <Text style={[styles.transactionHeaderAmount, { flex: 1, textAlign: 'right'}]}>Bounty</Text>
              </View>
              {expertiseData.map((item, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 1.5, color: "#777" }]}>{item.name}</Text>
                  <Text style={[styles.tableCell, { flex: 1, color: "#777", marginLeft: 30 }]}>${item.cost}</Text>
                  <Text style={[styles.tableCell, { flex: 1, color: "#777", marginLeft: 12 }]}>{item.unit}</Text>
                  <Text style={[styles.tableCell, { flex: 1, color: "#777", marginLeft: 12 }]}>{item.quantity || 0}</Text>
                  <Text style={[styles.tableCell, { flex: 1, color: "#777", textAlign: 'right', marginRight: 15 }]}>${item.bounty}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noDataText}>No expertise data available.</Text>
          )}
        </View>

        {/* Transaction History */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
            <View style={styles.questionCircle}>
              <Text style={styles.questionMark}>?</Text>
            </View>
          </View>
          {transactionLoading ? (
            <Text style={styles.loadingText}>Loading transaction data...</Text>
          ) : transactionData.length > 0 ? (
            <View style={styles.transactionsContainer}>
              {/* Table Header */}
              <View style={styles.transactionHeaderRow}>
                <Text style={styles.transactionHeaderDate}>Date</Text>
                <Text style={styles.transactionHeaderId}>Transaction ID</Text>
                <Text style={styles.transactionHeaderBusiness}>Business</Text>
                <Text style={styles.transactionHeaderAmount}>Amount</Text>
              </View>
              {/* Table Rows */}
              {transactionData.map((transaction, i) => {
                return (
                  <View key={transaction.transaction_uid || i} style={styles.transactionRow}>
                    <Text style={styles.transactionDate}>{formatTransactionDate(transaction.transaction_datetime)}</Text>
                    <Text style={styles.transactionId}>{transaction.transaction_uid || "N/A"}</Text>
                    <Text style={styles.transactionBusiness}>{transaction.business_name || "N/A"}</Text>
                    <Text style={styles.transactionAmount}>${parseFloat(transaction.transaction_total || 0).toFixed(2)}</Text>
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
        </View>

        {/* Net Earning */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Net Earning</Text>
          <NetEarningChart />
        </View>

        {/* Bounty Results */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Bounty Results</Text>
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
              {/* Table Header */}
              <View style={styles.bountyTableHeader}>
                <Text style={styles.bountyTableHeaderCell}>ID</Text>
                <Text style={styles.bountyTableHeaderCell}>Date</Text>
                <Text style={styles.bountyTableHeaderCell}>Purchaser</Text>
                <Text style={styles.bountyTableHeaderCell}>Business</Text>
                <Text style={styles.bountyTableHeaderCell}>Bounty Earned</Text>
              </View>
              {/* Table Rows */}
              {bountyData.data.map((transaction, index) => {
                // Format date to MM/DD
                const formatDate = (dateString) => {
                  if (!dateString) return "N/A";
                  const date = new Date(dateString);
                  const month = String(date.getMonth() + 1).padStart(2, "0");
                  const day = String(date.getDate()).padStart(2, "0");
                  return `${month}/${day}`;
                };
                return (
                  <View key={transaction.transaction_uid || index} style={styles.bountyTableRow}>
                    <Text style={styles.bountyTableCell}>{transaction.transaction_uid}</Text>
                    <Text style={styles.bountyTableCell}>{formatDate(transaction.transaction_datetime)}</Text>
                    <Text style={styles.bountyTableCell}>{transaction.transaction_profile_id || "N/A"}</Text>
                    <Text style={styles.bountyTableCell}>{transaction.transaction_business_id || "N/A"}</Text>
                    <Text style={styles.bountyTableCell}>${transaction.bounty_earned?.toFixed(2)}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.noDataText}>No bounty data available.</Text>
          )}
        </View>
      </>
    ) : (
      
      <>

        {/* Business MiniCard */}
        <View style={styles.sectionContainer}>
          {selectedBusinessFullData && (
            <View>
              <MiniCard business={selectedBusinessFullData} />
            </View>
          )}
        </View>

        {/* Product Results formerly Business Bounty Results */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Product Results</Text>
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
                      <Text style={styles.businessBountyCell}>
                        {formatDate(transaction.transaction_datetime)}
                      </Text>
                      <Text style={styles.businessBountyCell}>
                        {transaction.bs_uid || "N/A"}
                      </Text>
                      <Text style={styles.businessBountyCell}>
                        {transaction.bs_service_name || "N/A"}
                      </Text>
                      <Text style={styles.businessBountyCell}>
                        ${parseFloat(transaction.bs_cost || 0).toFixed(2)}
                      </Text>
                      <Text style={styles.businessBountyCell}>
                        ${parseFloat(transaction.bs_bounty || 0).toFixed(2)}
                      </Text>
                      <Text style={styles.businessBountyCell}>
                        {transaction.ti_bs_qty || 0}
                      </Text>
                      <Text style={styles.businessBountyCell}>
                        ${parseFloat(transaction.bounty_paid || 0).toFixed(2)}
                      </Text>
                    </View>
                  );
                })}
              </View>
          ) : (
            <Text style={styles.noDataText}>No business bounty data available.</Text>
          )}
        </View>

        {/* Business Net Earning */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Net Earning</Text>
          <BusinessNetEarningChart />
        </View>

        {/* Business Transaction History */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Business Transaction History</Text>
            <View style={styles.questionCircle}>
              <Text style={styles.questionMark}>?</Text>
            </View>
          </View>
          {businessTransactionLoading ? (
            <Text style={styles.loadingText}>Loading business transaction data...</Text>
          ) : businessTransactionData.length > 0 ? (
              <View style={styles.transactionsContainer}>
                {/* Table Header */}
                <View style={styles.businessTransactionHeaderRow}>
                  <Text style={styles.businessTransactionHeaderCell}>Transaction ID</Text>
                  <Text style={styles.businessTransactionHeaderCell}>Date</Text>
                  <Text style={styles.businessTransactionHeaderCell}>Buyer</Text>
                  <Text style={styles.businessTransactionHeaderCell}>Total</Text>
                  <Text style={styles.businessTransactionHeaderCell}>Bounty</Text>
                  <Text style={styles.businessTransactionHeaderCell}>Tax</Text>
                  <Text style={styles.businessTransactionHeaderCell}>Net Earning</Text>
                </View>
                {/* Table Rows */}
                {businessTransactionData.map((transaction, i) => {
                  const isExpanded = expandedTransactionId === transaction.transaction_uid;
                  
                  // Get services for this transaction from businessBountyData
                  const transactionServices = businessBountyData?.data?.filter(
                    item => item.transaction_uid === transaction.transaction_uid
                  ) || [];
                  
                  return (
                    <View key={transaction.transaction_uid || i}>
                      {/* Main Transaction Row */}
                      <TouchableOpacity
                        style={styles.businessTransactionRow}
                        onPress={() => {
                          setExpandedTransactionId(isExpanded ? null : transaction.transaction_uid);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.businessTransactionCell}>
                          {transaction.transaction_uid || "N/A"} {isExpanded ? "▲" : "▼"}
                        </Text>
                        <Text style={styles.businessTransactionCell}>
                          {formatTransactionDate(transaction.transaction_datetime)}
                        </Text>
                        <Text style={styles.businessTransactionCell}>
                          {transaction.transaction_profile_id?.substring(0, 10) || "N/A"}
                        </Text>
                        <Text style={styles.businessTransactionCell}>
                          ${transaction.transaction_total.toFixed(2)}
                        </Text>
                        <Text style={styles.businessTransactionCell}>
                          ${transaction.bounty_paid.toFixed(2)}
                        </Text>
                        <Text style={styles.businessTransactionCell}>
                          ${transaction.transaction_taxes.toFixed(2)}
                        </Text>
                        <Text style={styles.businessTransactionCell}>
                          ${transaction.net_earning.toFixed(2)}
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
                                  <Text style={styles.servicesCell}>{service.bs_uid || "N/A"}</Text>
                                  <Text style={styles.servicesCell}>{service.bs_service_name || "N/A"}</Text>
                                  <Text style={styles.servicesCell}>${parseFloat(service.bs_cost || 0).toFixed(2)}</Text>
                                  <Text style={styles.servicesCell}>${parseFloat(service.bs_bounty || 0).toFixed(2)}</Text>
                                  <Text style={styles.servicesCell}>{service.ti_bs_qty || 0}</Text>
                                  <Text style={styles.servicesCell}>${parseFloat(service.bounty_paid || 0).toFixed(2)}</Text>
                                </View>
                              ))}
                            </>
                          ) : (
                            <Text style={styles.noServicesText}>No services data available</Text>
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
        </View>
  
      </>
    )}
  </ScrollView>

      <BottomNavBar navigation={navigation} />
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
  transactionsContainer: { backgroundColor: "transparent", paddingVertical: 6 },
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
  transactionBusiness: { flex: 1, fontSize: 11, color: "#333", paddingHorizontal: 4 },
  transactionAmount: { width: 70, fontSize: 11, color: "#333", textAlign: "right" },
  // Header styles
  transactionHeaderDate: { width: 50, fontSize: 13, color: "#fff", fontWeight: "bold" },
  transactionHeaderId: { width: 100, fontSize: 13, color: "#fff", fontWeight: "bold" },
  transactionHeaderBusiness: { flex: 1, fontSize: 13, color: "#fff", fontWeight: "bold", paddingHorizontal: 4 },
  transactionHeaderAmount: { width: 70, fontSize: 13, color: "#fff", fontWeight: "bold", textAlign: "right" },
  centeredContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  bountyTotals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  bountyTotalText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  bountyTableHeader: {
    flexDirection: "row",
    backgroundColor: "#18884A",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginBottom: 2,
  },
  bountyTableHeaderCell: {
    flex: 1,
    fontSize: 12,
    color: "#fff",
    fontWeight: "bold",
    paddingHorizontal: 2,
    textAlign: 'center',
  },
  bountyTableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  bountyTableCell: {
    flex: 1,
    fontSize: 10,
    color: "#333",
    paddingHorizontal: 2,
    textAlign: 'center',
  },
  loadingText: {
    color: "#888",
  },
  errorText: {
    color: "red",
  },
  noDataText: {
    color: "#888",
  },
  // Dropdown styles
  dropdownButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownArrow: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 42,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10000,  
    pointerEvents: 'auto',  
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#333',
  },
  dropdownItemTextActive: {
    color: '#18884A',
    fontWeight: '600',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
  transactionHeaderQty: { 
    width: 50, 
    fontSize: 13, 
    color: "#fff", 
    fontWeight: "bold", 
    textAlign: "center" 
  },
  transactionQty: { 
    width: 50, 
    fontSize: 11, 
    color: "#333", 
    textAlign: "center" 
  },
  businessBountyTableHeader: {
    flexDirection: "row",
    backgroundColor: "#18884A",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginBottom: 2,
    minWidth: 700, //ensures table stretches
    width: '100%',
    flex: 1,
  },
  businessBountyHeaderCell: {
    //width: 100, // Keep fixed width for horizontal scroll
    flex: 1,
    fontSize: 12,
    color: "#fff",
    fontWeight: "bold",
    paddingHorizontal: 2,
    textAlign: 'center',
  },
  businessBountyTableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    width: '100%',
    flex: 1,
  },
  businessBountyCell: {
    flex: 1,
    fontSize: 10,
    color: "#333",
    paddingHorizontal: 2,
    textAlign: 'center',
  },
  businessTransactionHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#18884A",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginBottom: 2,
    minWidth: 770, 
    width: '100%',
    flex: 1,
  },
  businessTransactionHeaderCell: {
    //width: 110, 
    flex: 1,
    fontSize: 12,
    color: "#fff",
    fontWeight: "bold",
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  businessTransactionRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    width: '100%',
    flex: 1,
  },
  businessTransactionCell: {
    //width: 110,
    flex: 1,
    fontSize: 11,
    color: "#333",
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  servicesHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#2a5a3a",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 4,
    marginBottom: 2,
    width: '100%',
    flex: 1,
  },
  servicesHeaderCell: {
    //width: 100,
    flex: 1,
    fontSize: 11,
    color: "#fff",
    fontWeight: "bold",
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  servicesRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    width: '100%',
    flex: 1,
  },
  servicesCell: {
    //width: 100,
    flex: 1,
    fontSize: 10,
    color: "#333",
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  expandedServicesContainer: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  
  noServicesText: {
    fontSize: 12,
    color: "#888",
    textAlign: 'center',
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
});