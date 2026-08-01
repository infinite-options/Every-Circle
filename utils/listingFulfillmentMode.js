import {
  countExpertiseModes,
  formatExpertiseModeForDisplay,
  getExpertiseModeIoniconNames,
  parseExpertiseModeFlags,
  serializeExpertiseMode,
} from "./expertiseMode";
import { isOfferingShippingConfigured } from "./profileOfferingShipping";
import { parseBsShipping, BS_SHIPPING_BUYER_FIXED, parseBsShippingAmount } from "./businessServiceShipping";

/** Mode string from an offering or business service row / cart line. */
export function getListingModeString(item) {
  if (!item || typeof item !== "object") return "";
  if (item.itemType === "expertise") {
    return String(item.profile_expertise_mode || "").trim();
  }
  return String(item.bs_mode || "").trim();
}

export function parseListingModeFlags(itemOrModeStr) {
  const raw = typeof itemOrModeStr === "string" ? itemOrModeStr : getListingModeString(itemOrModeStr);
  return parseExpertiseModeFlags(raw);
}

export function serializeListingMode(flags) {
  return serializeExpertiseMode(flags);
}

export function formatListingModeForDisplay(itemOrModeStr) {
  const raw = typeof itemOrModeStr === "string" ? itemOrModeStr : getListingModeString(itemOrModeStr);
  return formatExpertiseModeForDisplay(raw);
}

export function getListingModeIoniconNames(itemOrModeStr) {
  const raw = typeof itemOrModeStr === "string" ? itemOrModeStr : getListingModeString(itemOrModeStr);
  return getExpertiseModeIoniconNames(raw);
}

export function countListingModes(itemOrModeStr) {
  const raw = typeof itemOrModeStr === "string" ? itemOrModeStr : getListingModeString(itemOrModeStr);
  return countExpertiseModes(raw);
}

/** True when Delivered mode is selected on a business service. */
export function businessDeliveredModeSelected(item) {
  if (!item || typeof item !== "object" || item.itemType === "expertise") return false;
  return parseListingModeFlags(item).delivered;
}

/** True when Delivered fulfillment is allowed for cart/checkout (mode + delivery charge when required). */
export function listingDeliveredFulfillmentAllowed(item) {
  if (!item || typeof item !== "object") return false;
  const flags = parseListingModeFlags(item);
  if (!flags.delivered) return false;
  if (item.itemType === "expertise") {
    return isOfferingShippingConfigured(item);
  }
  return parseBsShipping(item) != null;
}

/** Validate business service or offering row before save. Returns error string or null. */
export function validateListingFulfillmentForSave(item) {
  if (!item || typeof item !== "object") return "Fulfillment mode is required";
  const modeStr = getListingModeString(item);
  if (!modeStr) return "Select at least one mode: Virtual, Delivered, and/or In-Person";
  const flags = parseListingModeFlags(item);
  if (!flags.virtual && !flags.delivered && !flags.inPerson) {
    return "Select at least one mode: Virtual, Delivered, and/or In-Person";
  }
  if (flags.delivered) {
    if (item.itemType === "expertise") {
      if (!isOfferingShippingConfigured(item)) {
        return "Delivered mode requires delivery charge to be configured";
      }
    } else {
      const shipping = parseBsShipping(item);
      if (shipping == null) {
        return "Delivered mode requires delivery charge to be configured";
      }
      if (shipping === BS_SHIPPING_BUYER_FIXED) {
        const raw = item.bs_shipping_amount ?? item.bs_fixed_shipping_amount;
        const amount = parseBsShippingAmount(raw);
        const zeroOk = raw === 0 || raw === "0" || raw === "0.00";
        if (amount == null && !zeroOk) {
          return "Buyer pays (fixed) delivery charge requires an amount";
        }
      }
    }
  }
  return null;
}

export function toggleListingModeFlags(currentModeStr, key) {
  const flags = parseExpertiseModeFlags(currentModeStr);
  flags[key] = !flags[key];
  return serializeListingMode(flags);
}
