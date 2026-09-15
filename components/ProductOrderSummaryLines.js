import React from "react";
import { Text, View } from "react-native";
import { parsePrice } from "../utils/priceUtils";
import { formatChoiceLineText, getItemizedChoiceLines } from "../utils/selectedChoiceItems";
import { formatGiftCardCodeLabel } from "../utils/giftCard";

export function formatProductBaseLine(description, baseCost, currency = "USD") {
  const desc = String(description || "").trim();
  const symbol = !currency || currency === "USD" ? "$" : `${currency} `;
  const price = `${symbol}${parsePrice(baseCost).toFixed(2)}`;
  return desc ? `${desc}  ${price}` : price;
}

export function resolveProductSummaryDescription(item) {
  if (!item || typeof item !== "object") return "Item";
  if (item.itemType === "expertise") {
    return String(item.description || item.title || "Item").trim() || "Item";
  }
  return String(item.bs_service_desc || item.bs_service_name || "Item").trim() || "Item";
}

/**
 * Renders product summary in buyer-facing order:
 *   Description  $base
 *   Group: Option (+$extra)
 *   Note: ...
 *   Gift Card Code: ABC123
 */
export default function ProductOrderSummaryLines({
  description,
  baseCost,
  currency = "USD",
  choiceSource,
  specialInstructions = "",
  giftCardCodeLabel = null,
  baseTextStyle,
  choiceTextStyle,
  noteTextStyle,
  giftCardTextStyle,
  containerStyle,
}) {
  const choiceLines = getItemizedChoiceLines(choiceSource || {});
  const note = String(specialInstructions || "").trim();
  const giftCardLabel = giftCardCodeLabel || formatGiftCardCodeLabel(choiceSource);

  return (
    <View style={containerStyle}>
      <Text style={baseTextStyle}>{formatProductBaseLine(description, baseCost, currency)}</Text>
      {choiceLines.map((choiceLine, choiceIdx) => (
        <Text key={`${choiceLine.groupTitle}-${choiceLine.label}-${choiceIdx}`} style={choiceTextStyle}>
          {formatChoiceLineText(choiceLine)}
        </Text>
      ))}
      {note ? <Text style={noteTextStyle}>Note: {note}</Text> : null}
      {giftCardLabel ? <Text style={giftCardTextStyle || noteTextStyle}>{giftCardLabel}</Text> : null}
    </View>
  );
}
