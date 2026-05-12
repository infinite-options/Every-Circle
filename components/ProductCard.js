import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { normalizeBsCcFeePayer } from "../utils/normalizeBusinessServiceFromApi";
import { parsePrice } from "../utils/priceUtils";

const DEFAULT_PRODUCT_IMAGE = require("../assets/profile.png");

const parseTags = (raw) => {
  if (raw == null || raw === "") return [];
  const s = typeof raw === "string" ? raw : String(raw);
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
};

const ProductCard = ({ service, onPress, onEdit, showEditButton, showOwnerTags, darkMode, businessUid, businessCcFeePayer }) => {
  const tags = useMemo(() => parseTags(service.bs_tags), [service.bs_tags]);

  const productImageUri = useMemo(() => {
    const pending = service._svcNewImageUri;
    if (pending != null && String(pending).trim() !== "") {
      const p = String(pending).trim();
      if (
        p.startsWith("http://") ||
        p.startsWith("https://") ||
        p.startsWith("file:") ||
        p.startsWith("content:") ||
        p.startsWith("data:") ||
        p.startsWith("blob:")
      ) {
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

  const quantityLine = useMemo(() => {
    const unlimited = service.bs_qty_unlimited === 1 || service.bs_qty_unlimited === "1" || service.bs_qty_unlimited === true;
    if (unlimited) {
      return "Available quantity: No limit";
    }
    const n =
      service.bs_available_quantity != null && String(service.bs_available_quantity).trim() !== ""
        ? String(service.bs_available_quantity).trim()
        : service.bs_quantity != null && String(service.bs_quantity).trim() !== ""
          ? String(service.bs_quantity).trim()
          : "";
    if (n !== "") {
      return `Available quantity: ${n}`;
    }
    if (service.bs_qty_unlimited === 0 || service.bs_qty_unlimited === "0") {
      return "Available quantity: Limited";
    }
    return "Available quantity: No limit";
  }, [service.bs_qty_unlimited, service.bs_available_quantity, service.bs_quantity]);

  const conditionLine = useMemo(() => {
    const c = service.bs_condition_type;
    if (c !== undefined && c !== null && String(c).trim() !== "") {
      const isUsed = String(c).toLowerCase() === "used";
      const detail = (service.bs_condition_detail || "").trim();
      if (isUsed) {
        return detail ? `Condition: Used — ${detail}` : "Condition: Used";
      }
      return "Condition: New";
    }
    const legacy = service.bs_condition;
    if (legacy != null && String(legacy).trim() !== "") {
      return `Condition: ${String(legacy).trim()}`;
    }
    return null;
  }, [service.bs_condition_type, service.bs_condition_detail, service.bs_condition]);

  const shippingLine = useMemo(() => {
    const free = service.bs_free_shipping === 1 || service.bs_free_shipping === "1" || service.bs_free_shipping === true;
    const buyer = service.bs_buyer_pays_shipping === 1 || service.bs_buyer_pays_shipping === "1" || service.bs_buyer_pays_shipping === true;
    if (free) return "Shipping: Free shipping";
    if (buyer) return "Shipping: Buyer pays shipping";
    const legacy = service.bs_shipping;
    if (legacy != null && String(legacy).trim() !== "") {
      return `Shipping: ${String(legacy).trim()}`;
    }
    return null;
  }, [service.bs_free_shipping, service.bs_buyer_pays_shipping, service.bs_shipping]);

  /** When bs_is_taxable is on, show bs_tax_rate as a percent (e.g. "4.00" → "Tax rate: 4.00%"). */
  const taxRateLine = useMemo(() => {
    const v = service.bs_is_taxable;
    const taxable =
      v === true ||
      v === 1 ||
      v === "1" ||
      (typeof v === "string" && ["true", "yes"].includes(v.trim().toLowerCase()));
    if (!taxable) return null;
    const n = parsePrice(service.bs_tax_rate != null ? service.bs_tax_rate : 0);
    if (!Number.isFinite(n)) return "Tax rate: —";
    return `Tax rate: ${n.toFixed(2)}%`;
  }, [service.bs_is_taxable, service.bs_tax_rate]);

  const ccLine = useMemo(() => {
    const fromBusiness =
      businessCcFeePayer != null && String(businessCcFeePayer).trim() !== "" ? normalizeBsCcFeePayer(businessCcFeePayer) : "";
    const p = fromBusiness === "buyer" || fromBusiness === "seller" ? fromBusiness : normalizeBsCcFeePayer(service.bs_cc_fee_payer);
    if (!p || String(p).trim() === "") return null;
    const low = String(p).toLowerCase();
    if (low === "buyer") return "Card processing fees: buyer pays";
    if (low === "seller") return "Card processing fees: seller pays";
    return null;
  }, [businessCcFeePayer, service.bs_cc_fee_payer]);

  const metaTextStyle = darkMode ? styles.metaTextDark : styles.metaText;
  const tagChipTextStyle = darkMode ? styles.tagChipTextDark : styles.tagChipText;

  const thumbSource = productImageUri ? { uri: productImageUri } : DEFAULT_PRODUCT_IMAGE;

  return (
    <TouchableOpacity style={[styles.cardContainer, darkMode && styles.cardContainerDark]} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={styles.cardTopRow}>
        <Image source={thumbSource} style={[styles.productThumbInline, darkMode && styles.productThumbInlineDark]} resizeMode='cover' />
        <View style={styles.cardRightColumn}>
          <View style={styles.header}>
            <Text style={[styles.name, darkMode && styles.nameDark]} numberOfLines={2}>
              {service.bs_service_name}
            </Text>
            {showEditButton && onEdit && (
              <TouchableOpacity onPress={() => onEdit(service)} style={styles.editButton}>
                <Ionicons name='pencil' size={20} color='#007AFF' />
              </TouchableOpacity>
            )}
          </View>
          {service.bs_service_desc ? (
            <Text style={[styles.desc, darkMode && styles.descDark]} numberOfLines={4}>
              {service.bs_service_desc}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.textContainer}>
        <View style={styles.pricingContainer}>
          {service.bs_cost ? (
            <View style={styles.costContainer}>
              <View style={styles.moneyBagIconContainer}>
                <Text style={styles.moneyBagDollarSymbol}>$</Text>
              </View>
              <Text style={[styles.amountText, darkMode && styles.amountTextDark]}>
                Cost: {service.bs_cost_currency === "USD" || !service.bs_cost_currency ? "$" : service.bs_cost_currency + " "}
                {service.bs_cost}
              </Text>
            </View>
          ) : null}
          {service.bs_bounty ? (
            <View style={styles.bountyContainerRight}>
              <Text style={styles.bountyEmojiIcon}>💰</Text>
              <Text style={[styles.amountText, darkMode && styles.amountTextDark]}>
                Bounty: {service.bs_bounty_currency === "USD" || !service.bs_bounty_currency ? "$" : service.bs_bounty_currency + " "}
                {service.bs_bounty}
                {service.bs_bounty_type === "per_item" ? " / item" : " total"}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={metaTextStyle}>{quantityLine}</Text>
        {conditionLine ? <Text style={metaTextStyle}>{conditionLine}</Text> : null}
        {shippingLine ? <Text style={metaTextStyle}>{shippingLine}</Text> : null}
        {taxRateLine ? <Text style={metaTextStyle}>{taxRateLine}</Text> : null}
        {ccLine ? <Text style={metaTextStyle}>{ccLine}</Text> : null}
        {showOwnerTags && tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {tags.map((tag, i) => (
              <View key={`${tag}-${i}`} style={[styles.tagChip, darkMode && styles.tagChipDark]}>
                <Text style={tagChipTextStyle}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
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
  cardRightColumn: {
    flex: 1,
    minWidth: 0,
  },
  cardContainer: {
    flexDirection: "column",
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
    ...(Platform.OS !== "web" && { elevation: 3 }),
    marginVertical: 5,
    marginBottom: 10,
  },
  cardContainerDark: {
    backgroundColor: "#2c2c2e",
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.3)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 0,
    color: "#333",
    flex: 1,
    minWidth: 0,
  },
  nameDark: {
    color: "#f2f2f7",
  },
  editButton: {
    padding: 5,
  },
  textContainer: {
    flex: 1,
  },
  desc: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  descDark: {
    color: "#aeaeb2",
  },
  metaText: {
    fontSize: 13,
    color: "#555",
    marginTop: 4,
  },
  metaTextDark: {
    color: "#c7c7cc",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
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
  pricingContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  costContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  moneyBagIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFCD3C",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  moneyBagDollarSymbol: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ffffff",
  },
  bountyContainerRight: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
  },
  bountyEmojiIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  amountText: {
    fontSize: 15,
    color: "#333",
    fontWeight: "600",
  },
  amountTextDark: {
    color: "#f2f2f7",
  },
});

export default ProductCard;
