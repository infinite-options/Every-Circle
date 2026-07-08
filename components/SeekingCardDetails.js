import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatDateTimeForDisplay } from "../utils/profileDateTime";
import { formatExpertiseModeForDisplay } from "../utils/expertiseMode";
import { getSeekingCardLayout, seekingCardHasDetails } from "../utils/seekingDisplayLines";
import NoBountyIcon from "./NoBountyIcon";

function MetricBox({ columnLabel, value, darkMode, align = "left" }) {
  const alignStyle = align === "center" ? styles.metricAlignCenter : align === "right" ? styles.metricAlignRight : null;
  const showNoBounty = columnLabel === "Bounty" && !value;
  return (
    <View style={[styles.metricBox, darkMode && styles.metricBoxDark, alignStyle]}>
      <Text style={[styles.metricLabel, darkMode && styles.metricLabelDark, alignStyle]}>{columnLabel}</Text>
      {showNoBounty ? (
        <NoBountyIcon darkMode={darkMode} />
      ) : value ? (
        <Text style={[styles.metricValue, darkMode && styles.metricValueDark, alignStyle]} numberOfLines={2}>
          {value}
        </Text>
      ) : null}
    </View>
  );
}

const METRIC_ALIGN = {
  Rate: "left",
  "Desired Qty": "center",
  Bounty: "right",
};

/** Seeking metrics (2–3 columns), schedule, and location — matches profile/search card mockup. */
export default function SeekingCardDetails({ seeking, darkMode = false, style, metaTextStyle }) {
  const layout = getSeekingCardLayout(seeking);
  if (!seekingCardHasDetails(layout)) return null;

  const rowTextStyle = [styles.metaRowText, darkMode && styles.metaRowTextDark, metaTextStyle];
  const modeLabel = formatExpertiseModeForDisplay(layout.whenWhere.mode) || String(layout.whenWhere.mode || "").trim();
  const scheduleText = [
    layout.whenWhere.start ? formatDateTimeForDisplay(layout.whenWhere.start) : "—",
    layout.whenWhere.start && layout.whenWhere.end ? " → " : "",
    layout.whenWhere.end ? formatDateTimeForDisplay(layout.whenWhere.end) : "",
  ].join("");

  return (
    <View style={[styles.container, style]}>
      {layout.metrics.length > 0 ? (
        <View style={styles.metricsRow}>
          {layout.metrics.map((col) => (
            <MetricBox key={col.label} columnLabel={col.label} value={col.value} darkMode={darkMode} align={METRIC_ALIGN[col.label] || "left"} />
          ))}
        </View>
      ) : null}

      {layout.whenWhere.hasContent ? (
        <View style={[styles.whenWhereSection, darkMode && styles.whenWhereSectionDark]}>
          {layout.whenWhere.start || layout.whenWhere.end ? (
            <View style={styles.whenWhereLine}>
              <Ionicons name='calendar-outline' size={14} color={darkMode ? "#999" : "#666"} style={styles.lineIcon} />
              <Text style={rowTextStyle}>{scheduleText}</Text>
            </View>
          ) : null}
          {layout.whenWhere.location || modeLabel ? (
            <View style={[styles.whenWhereLine, styles.whenWhereLocationRow, (layout.whenWhere.start || layout.whenWhere.end) && styles.whenWhereLineSpaced]}>
              {layout.whenWhere.location ? (
                <View style={styles.locationCluster}>
                  <Ionicons name='location-outline' size={14} color={darkMode ? "#999" : "#666"} style={styles.lineIcon} />
                  <Text style={rowTextStyle}>{layout.whenWhere.location}</Text>
                </View>
              ) : (
                <View style={styles.locationCluster} />
              )}
              {modeLabel ? (
                <View style={[styles.modeBadge, darkMode && styles.modeBadgeDark]}>
                  <Text style={[styles.modeBadgeText, darkMode && styles.modeBadgeTextDark]}>{modeLabel}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    gap: 0,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  metricBox: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#f7f7f8",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  metricBoxDark: {
    backgroundColor: "#2a2a2a",
  },
  metricLabel: {
    fontSize: 12,
    color: "#888",
    marginBottom: 4,
  },
  metricLabelDark: {
    color: "#aaa",
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
    lineHeight: 28,
  },
  metricValueDark: {
    color: "#f5f5f5",
  },
  metricAlignCenter: {
    alignItems: "center",
    textAlign: "center",
  },
  metricAlignRight: {
    alignItems: "flex-end",
    textAlign: "right",
  },
  whenWhereSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
    gap: 6,
  },
  whenWhereSectionDark: {
    borderTopColor: "#404040",
  },
  whenWhereLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  whenWhereLineSpaced: {
    marginTop: 2,
  },
  whenWhereLocationRow: {
    justifyContent: "space-between",
    gap: 8,
  },
  locationCluster: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  lineIcon: {
    marginRight: 6,
  },
  modeBadge: {
    backgroundColor: "#e8f0fe",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  modeBadgeDark: {
    backgroundColor: "#1e3a5f",
  },
  modeBadgeText: {
    fontSize: 12,
    color: "#1a56db",
    fontWeight: "500",
  },
  modeBadgeTextDark: {
    color: "#93c5fd",
  },
  metaRowText: {
    fontSize: 13,
    color: "#666",
    flexShrink: 1,
  },
  metaRowTextDark: {
    color: "#999",
  },
});
