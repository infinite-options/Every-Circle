import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatDateTimeForDisplay } from "../utils/profileDateTime";
import { formatExpertiseModeForDisplay } from "../utils/expertiseMode";
import { getOfferingCardLayout, offeringCardHasDetails } from "../utils/offeringDisplayLines";

function FulfillmentRow({ label, value, rowTextStyle }) {
  return (
    <View style={styles.fulfillmentRow}>
      <Text style={[styles.fulfillmentLabel, rowTextStyle]}>{label}</Text>
      <Text style={[styles.fulfillmentValue, rowTextStyle]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function MetricBox({ columnLabel, value, subtext, darkMode, align = "left" }) {
  if (!value && !subtext) return null;
  return (
    <View style={[styles.metricBox, darkMode && styles.metricBoxDark]}>
      {columnLabel ? <Text style={[styles.metricLabel, darkMode && styles.metricLabelDark, align === "right" && styles.metricLabelRight]}>{columnLabel}</Text> : null}
      {value ? (
        <Text style={[styles.metricValue, darkMode && styles.metricValueDark, align === "right" && styles.metricValueRight]} numberOfLines={2}>
          {value}
        </Text>
      ) : null}
      {subtext ? <Text style={[styles.metricSubtext, darkMode && styles.metricSubtextDark, align === "right" && styles.metricSubtextRight]}>{subtext}</Text> : null}
    </View>
  );
}

/** Offering metrics, when/where, and fulfillment — matches profile/search card mockup. */
export default function OfferingCardDetails({ offering, darkMode = false, style, metaTextStyle }) {
  const layout = getOfferingCardLayout(offering);
  if (!offeringCardHasDetails(layout)) return null;

  const rowTextStyle = [styles.metaRowText, darkMode && styles.metaRowTextDark, metaTextStyle];
  const modeLabel = formatExpertiseModeForDisplay(layout.whenWhere.mode);
  const scheduleText = [
    layout.whenWhere.start ? formatDateTimeForDisplay(layout.whenWhere.start) : "—",
    layout.whenWhere.start && layout.whenWhere.end ? " → " : "",
    layout.whenWhere.end ? formatDateTimeForDisplay(layout.whenWhere.end) : "",
  ].join("");

  return (
    <View style={[styles.container, style]}>
      {layout.metrics.hasContent ? (
        <View style={styles.metricsRow}>
          <MetricBox columnLabel={layout.metrics.costColumnLabel} value={layout.metrics.costValue} subtext={layout.metrics.costSubtext} darkMode={darkMode} />
          <MetricBox columnLabel='Availability' value={layout.metrics.availabilityValue} subtext={layout.metrics.availabilitySubtext} darkMode={darkMode} align='right' />
        </View>
      ) : null}

      {layout.whenWhere.hasContent ? (
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, darkMode && styles.sectionHeaderDark]}>WHEN AND WHERE</Text>
          {layout.whenWhere.start || layout.whenWhere.end ? (
            <View style={styles.whenWhereLine}>
              <Ionicons name='calendar-outline' size={14} color={darkMode ? "#999" : "#666"} style={styles.lineIcon} />
              <Text style={rowTextStyle}>{scheduleText}</Text>
            </View>
          ) : null}
          {layout.whenWhere.location || modeLabel ? (
            <View style={[styles.whenWhereLine, styles.whenWhereLocationRow]}>
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

      {layout.fulfillmentRows.length > 0 ? (
        <View style={styles.fulfillmentSection}>
          <Text style={[styles.sectionHeader, styles.fulfillmentSectionHeader, darkMode && styles.sectionHeaderDark]}>FULFILLMENT</Text>
          {layout.fulfillmentRows.map((row) => (
            <FulfillmentRow key={row.label} label={row.label} value={row.value} rowTextStyle={rowTextStyle} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    gap: 14,
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
  metricLabelRight: {
    textAlign: "right",
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
  metricValueRight: {
    textAlign: "right",
  },
  metricSubtext: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },
  metricSubtextDark: {
    color: "#aaa",
  },
  metricSubtextRight: {
    textAlign: "right",
  },
  section: {
    gap: 8,
  },
  fulfillmentSection: {
    gap: 0,
  },
  fulfillmentSectionHeader: {
    marginBottom: 4,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    color: "#999",
    marginBottom: 2,
  },
  sectionHeaderDark: {
    color: "#777",
  },
  whenWhereLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
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
  fulfillmentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 1,
  },
  fulfillmentLabel: {
    flex: 1,
    minWidth: 0,
  },
  fulfillmentValue: {
    flex: 1,
    minWidth: 0,
    textAlign: "right",
  },
});
