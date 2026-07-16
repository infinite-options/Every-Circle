import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { getFlagReasonLabel } from "../utils/profileModeration";
import { getOwnerVisibleReports } from "../utils/ownerVisibleReports";

/**
 * Owner-facing report details: reason type + message only (no reporter identity).
 */
const OwnerContentReports = ({ item, reports: reportsProp, darkMode = false, compact = false }) => {
  const reports = Array.isArray(reportsProp) ? reportsProp : getOwnerVisibleReports(item);
  if (!reports.length) return null;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.heading, compact && styles.headingCompact, darkMode && styles.headingDark]}>
        {reports.length === 1 ? "Report details" : `Report details (${reports.length})`}
      </Text>
      {reports.map((report) => {
        const label = getFlagReasonLabel(report.category);
        return (
          <View key={report.id} style={[styles.card, compact && styles.cardCompact, darkMode && styles.cardDark]}>
            <Text style={[styles.category, compact && styles.categoryCompact, darkMode && styles.categoryDark]}>{label}</Text>
            {report.message ? (
              <Text style={[styles.message, compact && styles.messageCompact, darkMode && styles.messageDark]}>{report.message}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  wrapCompact: {
    marginTop: 6,
  },
  heading: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  headingCompact: {
    fontSize: 12,
    marginBottom: 6,
  },
  headingDark: {
    color: "#eee",
  },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e8e8e8",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  cardCompact: {
    padding: 8,
    marginBottom: 6,
  },
  cardDark: {
    backgroundColor: "#333",
    borderColor: "#555",
  },
  category: {
    fontSize: 13,
    fontWeight: "700",
    color: "#B71C1C",
  },
  categoryCompact: {
    fontSize: 12,
  },
  categoryDark: {
    color: "#ff8a80",
  },
  message: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: "#444",
  },
  messageCompact: {
    fontSize: 11,
    lineHeight: 15,
  },
  messageDark: {
    color: "#ccc",
  },
});

export default OwnerContentReports;
