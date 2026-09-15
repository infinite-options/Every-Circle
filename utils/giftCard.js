/** Truthy TINYINT / boolean gift-card flags from catalog or order lines. */
export function isGiftCardFlag(value) {
  return value === 1 || value === "1" || value === true;
}

/** True when a product/service or order line is a gift card. */
export function isGiftCardItem(item) {
  if (!item || typeof item !== "object") return false;
  return (
    isGiftCardFlag(item.bs_is_gift_card) ||
    isGiftCardFlag(item.ti_bs_is_gift_card) ||
    isGiftCardFlag(item.is_gift_card) ||
    isGiftCardFlag(item.gift_card)
  );
}

function normalizeGiftCardCode(raw) {
  const code = String(raw ?? "").trim().toUpperCase();
  return code || null;
}

/**
 * Resolve gift-card redemption code(s) from an order / receipt line.
 * BE may send a single code or an array (multi-qty purchases).
 * @returns {string[]}
 */
export function resolveGiftCardCodes(item) {
  if (!item || typeof item !== "object") return [];

  const collected = [];
  const push = (raw) => {
    const code = normalizeGiftCardCode(raw);
    if (code && !collected.includes(code)) collected.push(code);
  };

  const singleKeys = [
    "gift_card_code",
    "ti_gift_card_code",
    "bs_gift_card_code",
    "gift_code",
    "ti_gift_code",
    "redemption_code",
  ];
  for (const key of singleKeys) {
    push(item[key]);
  }

  const arrayKeys = ["gift_card_codes", "ti_gift_card_codes", "gift_codes"];
  for (const key of arrayKeys) {
    const arr = item[key];
    if (Array.isArray(arr)) arr.forEach(push);
    else if (typeof arr === "string" && arr.trim()) {
      arr.split(/[\s,;]+/).forEach(push);
    }
  }

  const units = item.units;
  if (units && typeof units === "object") {
    push(units.gift_card_code);
    if (Array.isArray(units.gift_card_codes)) units.gift_card_codes.forEach(push);
    if (Array.isArray(units.items)) {
      for (const unit of units.items) {
        if (unit && typeof unit === "object") push(unit.gift_card_code || unit.code);
      }
    }
  }

  return collected;
}

/** Single display string for one or more gift-card codes. */
export function formatGiftCardCodeLabel(item) {
  const codes = resolveGiftCardCodes(item);
  if (!codes.length) return null;
  if (codes.length === 1) return `Gift Card Code: ${codes[0]}`;
  return `Gift Card Codes: ${codes.join(", ")}`;
}

/** True when a bounty is restricted to first-time customers. */
export function isNewCustomersOnlyBounty(item) {
  if (!item || typeof item !== "object") return false;
  const flag =
    item.bs_new_customers_only === 1 ||
    item.bs_new_customers_only === "1" ||
    item.bs_new_customers_only === true ||
    item.profile_expertise_new_customers_only === 1 ||
    item.profile_expertise_new_customers_only === "1" ||
    item.profile_expertise_new_customers_only === true ||
    item.ti_bs_new_customers_only === 1 ||
    item.ti_bs_new_customers_only === "1" ||
    item.ti_bs_new_customers_only === true;
  if (!flag) return false;

  const bountyType = String(
    item.bs_bounty_type || item.profile_expertise_bounty_type || item.ti_bs_bounty_type || ""
  )
    .trim()
    .toLowerCase();
  const bountyAmount = String(item.bs_bounty || item.bounty || item.profile_expertise_bounty || item.ti_bs_bounty || "").trim();
  if (bountyType === "none") return false;
  // Business API stores "none" as empty bounty + per_item type.
  if (!bountyAmount || bountyAmount === "0" || bountyAmount === "0.00") return false;
  return true;
}
