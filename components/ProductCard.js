import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const DEFAULT_PRODUCT_IMAGE = require("../assets/profile.png");

const parseTags = (raw) => {
  if (raw == null || raw === "") return [];
  const s = typeof raw === "string" ? raw : String(raw);
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
};

const ProductCard = ({ service, onPress, onEdit, showEditButton, showOwnerTags, darkMode, businessUid }) => {
  const tags = useMemo(() => parseTags(service.bs_tags), [service.bs_tags]);

  const productImageUri = useMemo(() => {
    const k = service.bs_image_key;
    if (!k || String(k).trim() === "") return null;
    const s = String(k).trim();
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    if (businessUid) return `https://s3-us-west-1.amazonaws.com/every-circle/business_personal/${businessUid}/${s}`;
    return null;
  }, [service.bs_image_key, businessUid]);

  const quantityLine = useMemo(() => {
    const unlimited = service.bs_qty_unlimited === 1 || service.bs_qty_unlimited === "1" || service.bs_qty_unlimited === true;
    if (unlimited || service.bs_qty_unlimited === undefined || service.bs_qty_unlimited === null || service.bs_qty_unlimited === "") {
      return "Available quantity: No limit";
    }
    const n = service.bs_available_quantity;
    if (n !== undefined && n !== null && String(n).trim() !== "") {
      return `Available quantity: ${String(n).trim()}`;
    }
    return "Available quantity: Limited";
  }, [service.bs_qty_unlimited, service.bs_available_quantity]);

  const conditionLine = useMemo(() => {
    const c = service.bs_condition_type;
    if (c === undefined || c === null || String(c).trim() === "") return null;
    const isUsed = String(c).toLowerCase() === "used";
    const detail = (service.bs_condition_detail || "").trim();
    if (isUsed) {
      return detail ? `Used — ${detail}` : "Used";
    }
    return "New";
  }, [service.bs_condition_type, service.bs_condition_detail]);

  const shippingLine = useMemo(() => {
    const free = service.bs_free_shipping === 1 || service.bs_free_shipping === "1" || service.bs_free_shipping === true;
    const buyer = service.bs_buyer_pays_shipping === 1 || service.bs_buyer_pays_shipping === "1" || service.bs_buyer_pays_shipping === true;
    if (free) return "Free shipping";
    if (buyer) return "Buyer pays shipping";
    return null;
  }, [service.bs_free_shipping, service.bs_buyer_pays_shipping]);

  const ccLine = useMemo(() => {
    const p = service.bs_cc_fee_payer;
    if (!p || String(p).trim() === "") return null;
    const low = String(p).toLowerCase();
    if (low === "buyer") return "Card processing fees: buyer pays";
    if (low === "seller") return "Card processing fees: seller pays";
    return null;
  }, [service.bs_cc_fee_payer]);

  const metaTextStyle = darkMode ? styles.metaTextDark : styles.metaText;
  const tagChipTextStyle = darkMode ? styles.tagChipTextDark : styles.tagChipText;

  return (
    <TouchableOpacity style={[styles.cardContainer, darkMode && styles.cardContainerDark]} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      {productImageUri ? (
        <Image source={{ uri: productImageUri }} style={[styles.productThumb, darkMode && styles.productThumbDark]} resizeMode='cover' />
      ) : (
        <Image source={DEFAULT_PRODUCT_IMAGE} style={[styles.productThumb, darkMode && styles.productThumbDark]} resizeMode='cover' />
      )}
      <View style={styles.header}>
        <Text style={[styles.name, darkMode && styles.nameDark]}>{service.bs_service_name}</Text>
        {showEditButton && onEdit && (
          <TouchableOpacity onPress={() => onEdit(service)} style={styles.editButton}>
            <Ionicons name='pencil' size={20} color='#007AFF' />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.textContainer}>
        {service.bs_service_desc ? <Text style={[styles.desc, darkMode && styles.descDark]}>{service.bs_service_desc}</Text> : null}
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
  productThumb: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: "#eee",
  },
  productThumbDark: {
    backgroundColor: "#3a3a3c",
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
    alignItems: "center",
    marginBottom: 5,
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#333",
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
