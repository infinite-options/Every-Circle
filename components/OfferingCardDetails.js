import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatDateTimeForDisplay } from "../utils/profileDateTime";
import { formatExpertiseModeForDisplay } from "../utils/expertiseMode";
import { getOfferingCardLayout, getOfferingListMetricColumns } from "../utils/offeringDisplayLines";
import NoBountyIcon from "./NoBountyIcon";
import BountyInfoTooltip from "./BountyInfoTooltip";
import ProfileItemAttributeBadges from "./ProfileItemAttributeBadges";

function MetricBox({ columnLabel, value, subtext, darkMode, align = "left" }) {
  const showNoBounty = columnLabel === "Bounty" && !value && !subtext;
  if (!value && !subtext && !showNoBounty) return null;
  const alignStyle = align === "center" ? styles.metricAlignCenter : align === "right" ? styles.metricAlignRight : null;
  const alignTextStyle = align === "center" ? styles.metricTextCenter : align === "right" ? styles.metricTextRight : null;
  const isBounty = columnLabel === "Bounty";
  return (
    <View style={[styles.metricBox, darkMode && styles.metricBoxDark, alignStyle]}>
      {columnLabel ? (
        <View style={[styles.metricLabelRow, alignStyle]}>
          <Text style={[styles.metricLabel, darkMode && styles.metricLabelDark, isBounty && styles.metricLabelWithInfo]}>{columnLabel}</Text>
          {isBounty ? <BountyInfoTooltip perspective='referrer' darkMode={darkMode} placement={align === "right" ? "left" : "right"} /> : null}
        </View>
      ) : null}
      {showNoBounty ? (
        <NoBountyIcon darkMode={darkMode} />
      ) : value ? (
        <Text
          style={[styles.metricValue, darkMode && styles.metricValueDark, alignStyle, alignTextStyle]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {value}
        </Text>
      ) : null}
      {subtext ? <Text style={[styles.metricSubtext, darkMode && styles.metricSubtextDark, alignStyle]}>{subtext}</Text> : null}
    </View>
  );
}

const LIST_METRIC_ALIGN = {
  Cost: "left",
  Qty: "center",
  Bounty: "right",
};

/** Offering metrics, when/where, and fulfillment — list (Search) or detail (full) variant. */
export default function OfferingCardDetails({ offering, darkMode = false, style, metaTextStyle, variant = "detail" }) {
  const layout = getOfferingCardLayout(offering);
  const metricColumns = getOfferingListMetricColumns(offering);
  const hasMetrics = metricColumns.length > 0;
  const hasFulfillment = !!(layout.attributeBadges?.length || layout.conditionLine || layout.refundPolicyLine);
  const hasListContent = variant === "list" && (hasMetrics || layout.whenWhere.hasContent || hasFulfillment);
  const hasDetailContent = variant === "detail" && (hasMetrics || layout.whenWhere.hasContent || hasFulfillment);
  if (!hasListContent && !hasDetailContent) return null;

  const rowTextStyle = [styles.metaRowText, darkMode && styles.metaRowTextDark, metaTextStyle];

  const fulfillmentBlock = hasFulfillment ? (
    <View style={[styles.fulfillmentSection, variant === "list" && styles.listFulfillmentSection, variant === "list" && darkMode && styles.listFulfillmentSectionDark]}>
      {variant === "detail" && (layout.conditionLine || layout.attributeBadges?.length || layout.refundPolicyLine) ? (
        <Text style={[styles.sectionHeader, styles.fulfillmentSectionHeader, darkMode && styles.sectionHeaderDark]}>FULFILLMENT</Text>
      ) : null}
      {layout.conditionLine ? (
        <Text style={[styles.conditionLine, rowTextStyle, darkMode && styles.conditionLineDark]} numberOfLines={2}>
          Condition: <Text style={[styles.conditionKind, darkMode && styles.conditionKindDark]}>{layout.conditionLine}</Text>
        </Text>
      ) : null}
      {layout.attributeBadges?.length ? <ProfileItemAttributeBadges badges={layout.attributeBadges} darkMode={darkMode} /> : null}
      {layout.refundPolicyLine ? (
        <Text style={[styles.refundPolicyLine, rowTextStyle]} numberOfLines={3}>
          Refund policy: {layout.refundPolicyLine}
        </Text>
      ) : null}
    </View>
  ) : null;

  const modeLabel = formatExpertiseModeForDisplay(layout.whenWhere.mode);
  const scheduleText = [
    layout.whenWhere.start ? formatDateTimeForDisplay(layout.whenWhere.start) : "—",
    layout.whenWhere.start && layout.whenWhere.end ? " → " : "",
    layout.whenWhere.end ? formatDateTimeForDisplay(layout.whenWhere.end) : "",
  ].join("");

  const whenWhereBlock = layout.whenWhere.hasContent ? (
    <View style={[styles.section, variant === "list" && styles.listWhenWhereSection, variant === "list" && darkMode && styles.listWhenWhereSectionDark]}>
      {variant === "detail" ? <Text style={[styles.sectionHeader, darkMode && styles.sectionHeaderDark]}>WHEN AND WHERE</Text> : null}
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
  ) : null;

  const metricsRow = hasMetrics ? (
    <View style={styles.metricsRow}>
      {metricColumns.map((col) => (
        <MetricBox key={col.label} columnLabel={col.label} value={col.value} subtext={col.subtext} darkMode={darkMode} align={LIST_METRIC_ALIGN[col.label] || "left"} />
      ))}
    </View>
  ) : null;

  if (variant === "list") {
    return (
      <View style={[styles.container, style]}>
        {metricsRow}
        {whenWhereBlock}
        {fulfillmentBlock}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {metricsRow}
      {whenWhereBlock}
      {fulfillmentBlock}
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
    gap: Platform.OS === "web" ? 10 : 6,
  },
  metricBox: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#f7f7f8",
    borderRadius: 10,
    paddingVertical: Platform.OS === "web" ? 12 : 10,
    paddingHorizontal: Platform.OS === "web" ? 14 : 8,
  },
  metricBoxDark: {
    backgroundColor: "#2a2a2a",
  },
  metricAlignCenter: {
    alignItems: "center",
  },
  metricAlignRight: {
    alignItems: "flex-end",
  },
  metricTextCenter: {
    width: "100%",
    textAlign: "center",
  },
  metricTextRight: {
    width: "100%",
    textAlign: "right",
  },
  metricLabel: {
    fontSize: 12,
    color: "#888",
    marginBottom: 4,
  },
  metricLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
    zIndex: 2,
  },
  metricLabelWithInfo: {
    marginBottom: 0,
  },
  metricLabelDark: {
    color: "#aaa",
  },
  metricValue: {
    fontSize: Platform.OS === "web" ? 22 : 20,
    fontWeight: "700",
    color: "#111",
    lineHeight: Platform.OS === "web" ? 28 : 24,
  },
  metricValueDark: {
    color: "#f5f5f5",
  },
  metricSubtext: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },
  metricSubtextDark: {
    color: "#aaa",
  },
  section: {
    gap: 8,
  },
  listWhenWhereSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
    gap: 6,
  },
  listWhenWhereSectionDark: {
    borderTopColor: "#404040",
  },
  listFulfillmentSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
  },
  listFulfillmentSectionDark: {
    borderTopColor: "#404040",
  },
  fulfillmentSection: {
    gap: 8,
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
  conditionLine: {
    fontSize: 13,
    color: "#666",
  },
  conditionLineDark: {
    color: "#999",
  },
  conditionKind: {
    fontWeight: "700",
    color: "#111827",
  },
  conditionKindDark: {
    color: "#f9fafb",
  },
  refundPolicyLine: {
    fontSize: 13,
    color: "#666",
  },
});
