import { parsePrice } from "./priceUtils";

function parseSeekingRateValue(cost) {
  const raw = String(cost ?? "").trim();
  if (!raw || raw === "0" || raw.toLowerCase() === "free") return null;
  if (raw.startsWith("$")) return raw;
  const cleaned = raw.replace(/^\$/, "").trim();
  if (cleaned.toLowerCase().endsWith("total")) {
    const amount = cleaned.replace(/\s*total$/i, "").trim();
    return amount ? `$${amount} total` : null;
  }
  const slashIdx = cleaned.indexOf("/");
  if (slashIdx >= 0) {
    const amount = cleaned.slice(0, slashIdx).trim();
    const unit = cleaned.slice(slashIdx + 1).trim();
    return amount && unit ? `$${amount}/${unit}` : amount ? `$${amount}` : null;
  }
  return `$${cleaned}`;
}

function getSeekingQtyValue(seeking) {
  const qty = seeking?.profile_wish_quantity ?? seeking?.quantity ?? "";
  const raw = String(qty).trim();
  if (!raw || raw === "0") return null;
  return raw;
}

function getSeekingRewardValue(seeking) {
  const raw = String(seeking?.bounty ?? seeking?.amount ?? seeking?.profile_wish_bounty ?? "").trim();
  if (!raw || raw.toLowerCase() === "free") return null;

  const bountyType = String(seeking?.profile_wish_bounty_type ?? "").trim().toLowerCase();
  if (bountyType === "none") return null;

  const cleaned = raw.replace(/^\$/, "").trim();
  if (!cleaned) return null;

  let amount;
  let suffix = "";

  if (cleaned.toLowerCase().endsWith("total")) {
    amount = cleaned.replace(/\s*total$/i, "").trim();
    suffix = " total";
  } else {
    const slashIdx = cleaned.indexOf("/");
    if (slashIdx >= 0) {
      amount = cleaned.slice(0, slashIdx).trim();
      const unit = cleaned.slice(slashIdx + 1).trim();
      if (unit) suffix = `/${unit}`;
    } else {
      amount = cleaned;
    }
  }

  if (!amount || parsePrice(amount) <= 0) return null;

  if (!suffix) {
    if (bountyType === "total") suffix = " total";
    else suffix = "/each";
  }

  return `$${amount}${suffix}`;
}

export function getSeekingLocationLabel(seeking) {
  const location = String(seeking?.profile_wish_location ?? "").trim();
  if (location) return location;
  const city = String(seeking?.profile_wish_city ?? "").trim();
  const state = String(seeking?.profile_wish_state ?? "").trim();
  return [city, state].filter(Boolean).join(", ");
}

/** Metric columns for Seeking cards — Rate, Desired Qty, Bounty (Bounty always shown). */
export function getSeekingMetricColumns(seeking) {
  const cost = seeking?.cost ?? seeking?.profile_wish_cost ?? "";
  return [
    { label: "Rate", value: parseSeekingRateValue(cost) },
    { label: "Desired Qty", value: getSeekingQtyValue(seeking) },
    { label: "Bounty", value: getSeekingRewardValue(seeking) },
  ].filter((col) => col.label === "Bounty" || col.value);
}

export function getSeekingCardLayout(seeking) {
  const metrics = getSeekingMetricColumns(seeking);
  const location = getSeekingLocationLabel(seeking);
  const hasSchedule = !!(seeking?.profile_wish_start || seeking?.profile_wish_end);

  return {
    metrics,
    whenWhere: {
      hasContent: !!(hasSchedule || location || seeking?.profile_wish_mode),
      start: seeking?.profile_wish_start || "",
      end: seeking?.profile_wish_end || "",
      location,
      mode: seeking?.profile_wish_mode || "",
    },
  };
}

export function seekingCardHasDetails(layout) {
  return !!(layout.metrics.length || layout.whenWhere.hasContent);
}
