import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { parsePrice, formatCostValue } from "../utils/priceUtils";
import { parseTagList } from "../utils/tagListUtils";
import { canonicalBusinessCcFeePayer } from "../utils/normalizeBusinessServiceFromApi";
import {
  BS_SHIPPING_BUYER_ACTUAL,
  BS_SHIPPING_BUYER_FIXED,
  BS_SHIPPING_FREE,
  isBusinessShippingApplicable,
  isBuyerPaysShippingValue,
  parseBsShipping,
  parseBsShippingAmount,
} from "../utils/businessServiceShipping";
import { normServiceShippingRefundable } from "../utils/buildBusinessServiceForApi";

const DEFAULT_PRODUCT_IMAGE = require("../assets/profile.png");

function isNaDisplayValue(value) {
  const s = value != null ? String(value).trim() : "";
  if (!s) return true;
  const low = s.toLowerCase();
  return low === "na" || low === "n/a" || low === "—" || low === "-" || low === "not applicable" || low === "null";
}

function isTruthyFlag(value) {
  return value === true || value === 1 || value === "1" || (typeof value === "string" && ["true", "yes"].includes(value.trim().toLowerCase()));
}

function formatPriceHeader(service) {
  const costStr = String(service.bs_cost || "").trim();
  let unitSuffix = "/each";
  if (costStr.toLowerCase().endsWith("total")) {
    unitSuffix = " total";
  } else {
    const unitMatch = costStr.match(/\/(hr|day|week|2 weeks|month|quarter|year|each)$/i);
    if (unitMatch) unitSuffix = `/${unitMatch[1]}`;
  }
  const formatted = formatCostValue(parsePrice(service.bs_cost));
  const amount = formatted === "" ? "0" : formatted;
  const prefix = !service.bs_cost_currency || service.bs_cost_currency === "USD" ? "$" : `${service.bs_cost_currency} `;
  return `${prefix}${amount}${unitSuffix}`;
}

function formatTaxBadgeValue(service) {
  if (!isTruthyFlag(service.bs_is_taxable)) return null;
  const n = parsePrice(service.bs_tax_rate != null ? service.bs_tax_rate : 0);
  if (!Number.isFinite(n)) return null;
  const pct = n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2).replace(/\.?0+$/, "");
  return `${pct}%`;
}

function formatBountyDisplayValue(service) {
  const bountyType = String(service.bs_bounty_type || "").trim().toLowerCase();
  if (bountyType === "none" || bountyType === "") return null;
  const bounty = parsePrice(service.bs_bounty);
  if (!Number.isFinite(bounty) || bounty <= 0) return null;
  const currency = service.bs_bounty_currency === "USD" || !service.bs_bounty_currency ? "$" : `${service.bs_bounty_currency} `;
  const amount = String(service.bs_bounty).trim() || formatCostValue(bounty);
  const suffix = bountyType === "per_item" ? "/item" : " total";
  return `${currency}${amount}${suffix}`;
}

function formatSkuBadgeValue(service) {
  const sku = service.bs_sku != null ? String(service.bs_sku).trim() : "";
  if (isNaDisplayValue(sku)) return null;
  return sku;
}

function formatShipBadgeValue(service) {
  if (!isBusinessShippingApplicable(service)) return null;
  const shipping = parseBsShipping(service);
  if (shipping === BS_SHIPPING_FREE) return "Free";
  if (shipping === BS_SHIPPING_BUYER_ACTUAL) return "Buyer pays (actual)";
  if (shipping === BS_SHIPPING_BUYER_FIXED) {
    const amount = parseBsShippingAmount(service?.bs_shipping_amount ?? service?.bs_fixed_shipping_amount);
    if (amount == null && (service?.bs_shipping_amount === 0 || service?.bs_shipping_amount === "0")) {
      return "Buyer pays $0.00";
    }
    if (amount == null) return "Buyer pays (fixed)";
    return `Buyer pays $${Number(amount).toFixed(2)}`;
  }
  return null;
}

function formatReturnableBadgeValue(service) {
  const returnable =
    service.bs_is_returnable === 1 ||
    service.bs_is_returnable === "1" ||
    service.bs_is_returnable === true ||
    service.is_returnable === 1 ||
    service.is_returnable === "1" ||
    service.is_returnable === true;
  if (!returnable) return null;
  const days = String(service.bs_return_window_days ?? service.return_window_days ?? "").trim();
  const daysLabel = days && days !== "0" ? days : "5";
  if (isBuyerPaysShippingValue(service) && normServiceShippingRefundable(service) !== 1) {
    return `Yes, ${daysLabel}d   (Shipping not refundable)`;
  }
  return `Yes, ${daysLabel}d`;
}

function formatQtyBadgeValue(service) {
  const unlimited = service.bs_qty_unlimited === 1 || service.bs_qty_unlimited === "1" || service.bs_qty_unlimited === true;
  if (unlimited) return null;

  const raw =
    service.bs_available_quantity != null && String(service.bs_available_quantity).trim() !== ""
      ? String(service.bs_available_quantity).trim()
      : service.bs_quantity != null && String(service.bs_quantity).trim() !== ""
        ? String(service.bs_quantity).trim()
        : "";
  if (!raw || raw.toLowerCase() === "unlimited") {
    if (service.bs_qty_unlimited === 0 || service.bs_qty_unlimited === "0") return "Limited";
    return null;
  }
  return `Limited, ${raw} left`;
}

function buildAttributeBadges(service) {
  const badges = [];
  const tax = formatTaxBadgeValue(service);
  if (tax) badges.push({ key: "tax", label: "Tax", value: tax });
  const sku = formatSkuBadgeValue(service);
  if (sku) badges.push({ key: "sku", label: "SKU", value: sku });
  const ship = formatShipBadgeValue(service);
  if (ship) badges.push({ key: "ship", label: "Ship", value: ship });
  const returnable = formatReturnableBadgeValue(service);
  if (returnable) badges.push({ key: "returnable", label: "Returnable", value: returnable });
  const qty = formatQtyBadgeValue(service);
  if (qty) badges.push({ key: "qty", label: "Qty", value: qty });
  return badges;
}

function formatChoiceOptionLabel(opt) {
  const label = (opt?.label || "").trim();
  if (!label) return null;
  const extra = parsePrice(opt?.extra_cost);
  if (extra > 0) {
    const extraStr = extra % 1 === 0 ? String(Math.round(extra)) : extra.toFixed(2).replace(/\.?0+$/, "");
    return `${label} +$${extraStr}`;
  }
  return label;
}

function creditCardFeeBuyerBadgeValue(service) {
  const raw = service?.business_cc_fee_payer ?? service?.bs_cc_fee_payer;
  if (canonicalBusinessCcFeePayer(raw) !== "buyer") return null;
  return "3% paid by Buyer";
}

const ProductCard = ({ service, onPress, onEdit, onDelete, showEditButton, showTags = true, darkMode, businessUid }) => {
  const tags = useMemo(() => parseTagList(service.bs_tags), [service.bs_tags]);

  const productImageUri = useMemo(() => {
    const pending = service._svcNewImageUri;
    if (pending != null && String(pending).trim() !== "") {
      const p = String(pending).trim();
      if (p.startsWith("http://") || p.startsWith("https://") || p.startsWith("file:") || p.startsWith("content:") || p.startsWith("data:") || p.startsWith("blob:")) {
        return p;
      }
    }
    const k = service.bs_image_key || service.bs_image_url;
    if (!k || String(k).trim() === "") return null;
    const s = String(k).trim();
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    if (businessUid) return `https://s3-us-west-1.amazonaws.com/every-circle/business_personal/${businessUid}/${s}`;
    return null;
  }, [service._svcNewImageUri, service.bs_image_key, service.bs_image_url, businessUid]);

  const conditionContent = useMemo(() => {
    const c = service.bs_condition_type;
    if (c !== undefined && c !== null) {
      const cLow = String(c).trim().toLowerCase();
      if (cLow === "" || cLow === "na") return null;
      if (cLow === "used") {
        const detail = (service.bs_condition_detail || service.bs_used_condition || "").trim();
        return { kind: "Used", detail };
      }
      if (cLow === "new") return { kind: "New", detail: "" };
    }
    const legacy = service.bs_condition;
    if (legacy != null && String(legacy).trim() !== "") {
      const low = String(legacy).trim().toLowerCase();
      if (low === "na") return null;
      if (low === "new") return { kind: "New", detail: "" };
      if (low === "used") return { kind: "Used", detail: (service.bs_condition_detail || service.bs_used_condition || "").trim() };
      return { kind: String(legacy).trim(), detail: "" };
    }
    return null;
  }, [service.bs_condition_type, service.bs_condition_detail, service.bs_used_condition, service.bs_condition]);

  const attributeBadges = useMemo(() => {
    const badges = buildAttributeBadges(service);
    const ccFee = creditCardFeeBuyerBadgeValue(service);
    if (ccFee) badges.push({ key: "cc_fee", label: "Credit Card Fee", value: ccFee });
    return badges;
  }, [service]);

  const choiceGroups = useMemo(
    () =>
      (service.bs_choice_groups || []).filter(
        (group) => String(group?.title || "").trim() && Array.isArray(group?.options) && group.options.some((opt) => formatChoiceOptionLabel(opt)),
      ),
    [service.bs_choice_groups],
  );

  const priceHeader = useMemo(() => formatPriceHeader(service), [service.bs_cost, service.bs_cost_currency]);
  const bountyHeader = useMemo(() => formatBountyDisplayValue(service), [service.bs_bounty, service.bs_bounty_type, service.bs_bounty_currency]);

  const specialInstructionsAllowed =
    service.bs_special_instructions_enabled === 1 ||
    service.bs_special_instructions_enabled === "1" ||
    service.bs_special_instructions_enabled === true;

  const metaTextStyle = darkMode ? styles.metaTextDark : styles.metaText;
  const tagChipTextStyle = darkMode ? styles.tagChipTextDark : styles.tagChipText;
  const badgeStyle = [styles.attributeBadge, darkMode && styles.attributeBadgeDark];
  const badgeLabelStyle = [styles.attributeBadgeLabel, darkMode && styles.attributeBadgeLabelDark];
  const badgeValueStyle = [styles.attributeBadgeValue, darkMode && styles.attributeBadgeValueDark];

  const thumbSource = productImageUri ? { uri: productImageUri } : DEFAULT_PRODUCT_IMAGE;

  const isSoldOut = (() => {
    const unlimited = service.bs_qty_unlimited === 1 || service.bs_qty_unlimited === "1" || service.bs_qty_unlimited === true;
    if (unlimited) return false;
    const raw =
      service.bs_quantity != null && String(service.bs_quantity).trim() !== ""
        ? String(service.bs_quantity).trim()
        : service.bs_available_quantity != null && String(service.bs_available_quantity).trim() !== ""
          ? String(service.bs_available_quantity).trim()
          : null;
    if (!raw || raw.toLowerCase() === "unlimited") return false;
    const num = parseInt(raw, 10);
    return !isNaN(num) && num === 0;
  })();

  const showFooterActions = (showEditButton && onEdit) || onDelete;
  const cardStyle = [styles.cardContainer, darkMode && styles.cardContainerDark, isSoldOut && { opacity: 0.5 }];

  const body = renderProductCardBody({
    service,
    darkMode,
    showTags,
    onEdit,
    onDelete,
    showEditButton,
    showFooterActions,
    thumbSource,
    metaTextStyle,
    tagChipTextStyle,
    badgeStyle,
    badgeLabelStyle,
    badgeValueStyle,
    tags,
    conditionContent,
    attributeBadges,
    choiceGroups,
    priceHeader,
    bountyHeader,
    specialInstructionsAllowed,
    isSoldOut,
  });

  if (!onPress || isSoldOut) {
    return <View style={cardStyle}>{body}</View>;
  }

  return (
    <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.7} disabled={isSoldOut}>
      {body}
    </TouchableOpacity>
  );
};

function renderProductCardBody({
  service,
  darkMode,
  showTags,
  onEdit,
  onDelete,
  showEditButton,
  showFooterActions,
  thumbSource,
  metaTextStyle,
  tagChipTextStyle,
  badgeStyle,
  badgeLabelStyle,
  badgeValueStyle,
  tags,
  conditionContent,
  attributeBadges,
  choiceGroups,
  priceHeader,
  bountyHeader,
  specialInstructionsAllowed,
  isSoldOut,
}) {
  return (
    <>
      <View style={styles.cardTopRow}>
        <Image source={thumbSource} style={[styles.productThumbInline, darkMode && styles.productThumbInlineDark]} resizeMode='cover' />
        <View style={styles.cardMiddleColumn}>
          <Text style={[styles.name, darkMode && styles.nameDark]} numberOfLines={2}>
            {service.bs_service_name}
          </Text>
          {service.bs_service_desc ? (
            <Text style={[styles.desc, darkMode && styles.descDark]} numberOfLines={2}>
              {service.bs_service_desc}
            </Text>
          ) : null}
          {showTags && tags.length > 0 ? (
            <View style={styles.tagsRow}>
              {tags.map((tag, i) => (
                <View key={`${tag}-${i}`} style={[styles.tagChip, darkMode && styles.tagChipDark]}>
                  <Text style={tagChipTextStyle}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        <View style={styles.headerPricingColumn}>
          <Text style={[styles.priceAmount, darkMode && styles.priceAmountDark]} numberOfLines={1}>
            {priceHeader}
          </Text>
        </View>
      </View>

      {conditionContent ? (
        <Text style={[metaTextStyle, styles.conditionLine, darkMode && styles.conditionLineDark]}>
          Condition:{" "}
          <Text style={[styles.conditionKind, darkMode && styles.conditionKindDark]}>{conditionContent.kind}</Text>
          {conditionContent.detail ? ` — ${conditionContent.detail}` : ""}
        </Text>
      ) : null}

      {attributeBadges.length > 0 || bountyHeader ? (
        <View style={styles.attributeBadgeRow}>
          <View style={styles.attributeBadgeWrap}>
            {attributeBadges.map((badge) => (
              <View key={badge.key} style={badgeStyle}>
                <Text style={badgeLabelStyle}>
                  {badge.label}  <Text style={badgeValueStyle}>{badge.value}</Text>
                </Text>
              </View>
            ))}
          </View>
          {bountyHeader ? (
            <View style={styles.bountyBadgeColumn}>
              <View style={styles.bountyBadge}>
                <Text style={styles.bountyEmojiIcon}>💰</Text>
                <Text style={[styles.bountyBadgeText, darkMode && styles.bountyBadgeTextDark]} numberOfLines={2}>
                  {bountyHeader}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {isSoldOut ? (
        <View style={styles.soldOutBadge}>
          <Text style={styles.soldOutBadgeText}>Sold Out</Text>
        </View>
      ) : null}

      {choiceGroups.map((group, gIdx) => (
        <View key={group.id || `${group.title}-${gIdx}`} style={styles.choiceGroupBlock}>
          <Text style={[styles.choiceGroupLabel, darkMode && styles.choiceGroupLabelDark]}>{String(group.title).trim().toUpperCase()}</Text>
          <View style={styles.choiceOptionsRow}>
            {(group.options || []).map((opt, oIdx) => {
              const label = formatChoiceOptionLabel(opt);
              if (!label) return null;
              return (
                <View key={opt.id || `${gIdx}-${oIdx}`} style={[styles.choiceOptionChip, darkMode && styles.choiceOptionChipDark]}>
                  <Text style={[styles.choiceOptionChipText, darkMode && styles.choiceOptionChipTextDark]}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}

      {showFooterActions || specialInstructionsAllowed ? (
        <View style={[styles.cardFooter, darkMode && styles.cardFooterDark]}>
          {specialInstructionsAllowed ? (
            <Text style={[styles.footerNote, darkMode && styles.footerNoteDark]}>Special instructions allowed</Text>
          ) : (
            <View style={styles.footerSpacer} />
          )}
          {showFooterActions ? (
            <View style={styles.footerActions}>
              {showEditButton && onEdit ? (
                <TouchableOpacity onPress={() => onEdit(service)} style={[styles.footerActionButton, styles.footerEditButton, darkMode && styles.footerEditButtonDark]} activeOpacity={0.8}>
                  <Ionicons name='pencil' size={16} color={darkMode ? "#C98AEF" : "#7B35C7"} />
                </TouchableOpacity>
              ) : null}
              {onDelete ? (
                <TouchableOpacity onPress={onDelete} style={[styles.footerActionButton, styles.footerDeleteButton, darkMode && styles.footerDeleteButtonDark]} activeOpacity={0.8} accessibilityLabel='Delete product or service'>
                  <Ionicons name='trash-outline' size={16} color={darkMode ? "#f87171" : "#dc2626"} />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },
  productThumbInline: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#eee",
    flexShrink: 0,
  },
  productThumbInlineDark: {
    backgroundColor: "#3a3a3c",
  },
  cardMiddleColumn: {
    flex: 1,
    minWidth: 0,
  },
  headerPricingColumn: {
    alignItems: "flex-end",
    flexShrink: 0,
    maxWidth: 120,
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  priceAmountDark: {
    color: "#f9fafb",
  },
  attributeBadgeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  attributeBadgeWrap: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    minWidth: 0,
  },
  bountyBadgeColumn: {
    alignItems: "flex-end",
    flexShrink: 0,
    maxWidth: 120,
    paddingTop: 2,
  },
  bountyBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  bountyEmojiIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  bountyBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    textAlign: "right",
  },
  bountyBadgeTextDark: {
    color: "#f2f2f7",
  },
  cardContainer: {
    flexDirection: "column",
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
    ...(Platform.OS !== "web" && { elevation: 3 }),
    marginVertical: 5,
    marginBottom: 10,
  },
  cardContainerDark: {
    backgroundColor: "#2c2c2e",
    borderColor: "#48484a",
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.3)",
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
    color: "#111827",
  },
  nameDark: {
    color: "#f2f2f7",
  },
  desc: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 6,
  },
  descDark: {
    color: "#aeaeb2",
  },
  metaText: {
    fontSize: 13,
    color: "#555",
  },
  metaTextDark: {
    color: "#c7c7cc",
  },
  conditionLine: {
    marginBottom: 8,
  },
  conditionLineDark: {
    color: "#c7c7cc",
  },
  conditionKind: {
    fontWeight: "700",
    color: "#111827",
  },
  conditionKindDark: {
    color: "#f9fafb",
  },
  attributeBadge: {
    backgroundColor: "#f3f4f6",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  attributeBadgeDark: {
    backgroundColor: "#3a3a3c",
    borderColor: "#555",
  },
  attributeBadgeLabel: {
    fontSize: 12,
    color: "#374151",
  },
  attributeBadgeLabelDark: {
    color: "#d1d5db",
  },
  attributeBadgeValue: {
    fontWeight: "700",
    color: "#111827",
  },
  attributeBadgeValueDark: {
    color: "#f9fafb",
  },
  soldOutBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#fee2e2",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  soldOutBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#dc2626",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagChip: {
    backgroundColor: "#f0e6ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d4bdf5",
  },
  tagChipDark: {
    backgroundColor: "#3a2d4d",
    borderColor: "#6b5a7d",
  },
  tagChipText: {
    fontSize: 12,
    color: "#5c2d91",
    fontWeight: "500",
  },
  tagChipTextDark: {
    color: "#d4bdf5",
  },
  choiceGroupBlock: {
    marginTop: 4,
    marginBottom: 8,
  },
  choiceGroupLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  choiceGroupLabelDark: {
    color: "#9ca3af",
  },
  choiceOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  choiceOptionChip: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  choiceOptionChipDark: {
    backgroundColor: "#2c2c2e",
    borderColor: "#555",
  },
  choiceOptionChipText: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "500",
  },
  choiceOptionChipTextDark: {
    color: "#f3f4f6",
  },
  cardFooter: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardFooterDark: {
    borderTopColor: "#48484a",
  },
  footerNote: {
    flex: 1,
    fontSize: 12,
    color: "#6b7280",
  },
  footerNoteDark: {
    color: "#9ca3af",
  },
  footerSpacer: {
    flex: 1,
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footerActionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  footerEditButton: {
    backgroundColor: "rgba(175, 82, 222, 0.14)",
  },
  footerEditButtonDark: {
    backgroundColor: "rgba(175, 82, 222, 0.24)",
  },
  footerDeleteButton: {
    backgroundColor: "#fee2e2",
  },
  footerDeleteButtonDark: {
    backgroundColor: "rgba(220, 38, 38, 0.18)",
  },
});

export default ProductCard;
