import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ProfileItemAttributeBadges from "./ProfileItemAttributeBadges";
import {
  getCartLineAttributeBadges,
  getCartLineFulfillmentSummary,
  getCartLineRefundPolicyLine,
} from "../utils/cartLineDisplay";
import { FULFILLMENT_VIRTUAL } from "../utils/cartFulfillmentMethod";

const FULFILLMENT_METHOD_ICONS = {
  virtual: "videocam-outline",
  ship: "car-outline",
  pickup: "people-outline",
};

/** Fulfillment, return window, and refund policy — aligned with Offering / Product cards. */
export default function CartLineDetails({ item, onFulfillmentSelect }) {
  const fulfillment = getCartLineFulfillmentSummary(item);
  const badges = getCartLineAttributeBadges(item);
  const refundPolicyLine = getCartLineRefundPolicyLine(item);

  if (!fulfillment.options.length && !badges.length && !refundPolicyLine) return null;

  return (
    <View style={styles.container}>
      {fulfillment.options.length ? (
        <View style={styles.fulfillmentBlock}>
          <Text style={styles.sectionLabel}>FULFILLMENT</Text>
          {fulfillment.needsChoice ? (
            <View style={styles.fulfillmentChoiceRow}>
              {fulfillment.options.map((option) => {
                const active = fulfillment.method === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.fulfillmentChoiceBtn, active && styles.fulfillmentChoiceBtnActive]}
                    onPress={() => onFulfillmentSelect?.(option.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={option.icon} size={16} color={active ? "#fff" : "#9C45F7"} />
                    <Text style={[styles.fulfillmentChoiceBtnText, active && styles.fulfillmentChoiceBtnTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.fulfillmentSummaryRow}>
              <Ionicons name={FULFILLMENT_METHOD_ICONS[fulfillment.method] || "cube-outline"} size={16} color="#9C45F7" style={styles.fulfillmentIcon} />
              <Text style={styles.fulfillmentSummaryText}>
                <Text style={styles.fulfillmentSummaryKind}>{fulfillment.selectedLabel}</Text>
                {fulfillment.detail ? ` · ${fulfillment.detail}` : ""}
              </Text>
            </View>
          )}
          {fulfillment.needsChoice && fulfillment.detail ? <Text style={styles.fulfillmentHint}>{fulfillment.detail}</Text> : null}
          {fulfillment.needsChoice && fulfillment.method === FULFILLMENT_VIRTUAL ? (
            <Text style={styles.fulfillmentHint}>No shipping required</Text>
          ) : null}
        </View>
      ) : null}

      {badges.length || refundPolicyLine ? (
        <View style={styles.policyBlock}>
          {badges.length ? <ProfileItemAttributeBadges badges={badges} /> : null}
          {refundPolicyLine ? (
            <Text style={styles.refundPolicyLine} numberOfLines={3}>
              Refund policy: {refundPolicyLine}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    color: "#999",
    marginBottom: 6,
  },
  fulfillmentBlock: {
    gap: 8,
  },
  fulfillmentSummaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  fulfillmentIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  fulfillmentSummaryText: {
    flex: 1,
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  fulfillmentSummaryKind: {
    fontWeight: "700",
    color: "#111827",
  },
  fulfillmentChoiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  fulfillmentChoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#9C45F7",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  fulfillmentChoiceBtnActive: {
    backgroundColor: "#9C45F7",
  },
  fulfillmentChoiceBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9C45F7",
  },
  fulfillmentChoiceBtnTextActive: {
    color: "#fff",
  },
  fulfillmentHint: {
    fontSize: 12,
    color: "#888",
    lineHeight: 17,
  },
  policyBlock: {
    gap: 8,
  },
  refundPolicyLine: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
});
