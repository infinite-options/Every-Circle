import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomNavBar from "../components/BottomNavBar";
import { BOUNTY_RESULTS_ENDPOINT, API_BASE_URL } from "../apiConfig";
import Svg, { Circle, Line, Text as SvgText, G, Path } from "react-native-svg";
import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useDarkMode } from "../contexts/DarkModeContext";
export default function AccountScreen({ navigation }) {
  const { darkMode } = useDarkMode();
  const [userUID, setUserUID] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bountyData, setBountyData] = useState(null);
  const [bountyLoading, setBountyLoading] = useState(true);
  const [transactionData, setTransactionData] = useState([]);
  const [transactionLoading, setTransactionLoading] = useState(true);
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

  useFocusEffect(
    useCallback(() => {
      checkAuth();
      refreshBountyData();
      refreshTransactionData();
    }, [])
  );

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
    const chartWidth = screenWidth;
    const chartHeight = 180;
    const paddingLeft = 50; // Space for left Y-axis
    const paddingRight = 50; // Space for right Y-axis
    const paddingTop = 20;
    const paddingBottom = 30; // Space for X-axis labels
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
      const normalized = Math.max(0, Math.min(1, value / chartData.maxDaily)); // Clamp between 0 and 1
      const y = paddingTop + plotHeight - normalized * plotHeight;
      return isFinite(y) ? y : paddingTop + plotHeight; // Fallback if Infinity
    });

    // Calculate Y positions for cumulative bounty (linear, right axis with different scale)
    const cumulativeYPositions = chartData.cumulativeBounty.map((value) => {
      const y = paddingTop + linearScale(value, chartData.maxCumulative, plotHeight);
      return isFinite(y) ? y : paddingTop + plotHeight; // Fallback if Infinity
    });

    // Generate X positions
    const xPositions = chartData.dates.map((_, index) => paddingLeft + index * xStep);

    // Generate left Y-axis ticks (linear)
    const leftTicks = 6;
    const leftTickValues = [];
    for (let i = 0; i <= leftTicks; i++) {
      leftTickValues.push((chartData.maxDaily / leftTicks) * i);
    }

    // Generate right Y-axis ticks (linear)
    const rightTickValues = generateLinearTicks(chartData.maxCumulative, 6);

    // Build path strings for lines
    const buildPath = (positions) => {
      return positions
        .map((y, index) => {
          const x = xPositions[index];
          // Ensure both x and y are finite numbers
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
      <View style={[styles.header, darkMode && styles.darkHeader]}>
        <Text style={styles.title}>Account</Text>
      </View>

      {/* Main content */}
      <ScrollView style={styles.contentContainer} contentContainerStyle={styles.scrollContentContainer} showsVerticalScrollIndicator={true}>
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
      </ScrollView>

      <BottomNavBar navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    backgroundColor: "#AF52DE",
    paddingTop: 30,
    paddingBottom: 15,
    alignItems: "center",
    borderBottomLeftRadius: 300,
    borderBottomRightRadius: 300,
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  darkContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkHeader: {
    backgroundColor: "#4b2c91",
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
    backgroundColor: "#AF52DE",
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

  // Bounty Results styles
  bountyTotals: {
    backgroundColor: "#f0f0f0",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  bountyTotalText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  bountyTableHeader: {
    flexDirection: "row",
    backgroundColor: "#AF52DE",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginBottom: 2,
  },
  bountyTableHeaderCell: {
    flex: 0.2,
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
    paddingHorizontal: 0,
  },
  bountyTableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  bountyTableCell: {
    flex: 0.2,
    fontSize: 12,
    paddingHorizontal: 0,
    color: "#333",
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
});
