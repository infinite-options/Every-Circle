import { parsePrice } from "./priceUtils";

function isTruthyFlag(v) {
  return v === 1 || v === "1" || v === true;
}

function parseOfferingCost(cost) {
  const raw = String(cost ?? "").trim();
  if (!raw) return null;
  if (raw.toLowerCase() === "free") {
    return { columnLabel: "Total cost", value: "Free", subtext: null };
  }
  const cleaned = raw.replace(/^\$/, "").trim();
  if (cleaned.toLowerCase().endsWith("total")) {
    const amount = cleaned.replace(/\s*total$/i, "").trim();
    return { columnLabel: "Total cost", value: `$${amount}`, subtext: null };
  }
  const slashIdx = cleaned.indexOf("/");
  if (slashIdx >= 0) {
    const amount = cleaned.slice(0, slashIdx).trim();
    const unit = cleaned.slice(slashIdx + 1).trim();
    return { columnLabel: "Cost", value: `$${amount}/${unit}`, subtext: null };
  }
  return { columnLabel: "Total cost", value: `$${cleaned}`, subtext: null };
}

function getOfferingTaxSubtext(offering) {
  if (!isTruthyFlag(offering?.profile_expertise_is_taxable)) return null;
  const rateStr = String(offering?.profile_expertise_tax_rate ?? "").trim();
  if (rateStr) {
    const n = parsePrice(rateStr);
    if (Number.isFinite(n) && n > 0) {
      const pct = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
      return `plus ${pct}% sales tax`;
    }
  }
  return "plus sales tax";
}

function parseOfferingBountyAmountParts(raw) {
  const str = String(raw ?? "").trim();
  if (!str || str.toLowerCase() === "free") return null;
  const cleaned = str.replace(/^\$/, "").trim();
  if (!cleaned) return null;

  if (cleaned.toLowerCase().endsWith("total")) {
    const amount = cleaned.replace(/\s*total$/i, "").trim();
    return { amount, suffix: " total" };
  }

  const slashIdx = cleaned.indexOf("/");
  if (slashIdx >= 0) {
    const amount = cleaned.slice(0, slashIdx).trim();
    const unit = cleaned.slice(slashIdx + 1).trim();
    return { amount, suffix: unit ? `/${unit}` : "" };
  }

  return { amount: cleaned, suffix: "" };
}

function getOfferingBountyMetricValue(offering) {
  const bountyType = String(offering?.profile_expertise_bounty_type ?? "none").trim().toLowerCase();
  if (bountyType === "none") return null;
  const raw = String(offering?.bounty ?? offering?.profile_expertise_bounty ?? "").trim();
  const parts = parseOfferingBountyAmountParts(raw);
  if (!parts?.amount || parsePrice(parts.amount) <= 0) return null;

  let suffix = parts.suffix;
  if (!suffix) {
    if (bountyType === "total") suffix = " total";
    else suffix = "/each";
  }
  return `$${parts.amount}${suffix}`;
}

function getOfferingBountySubtext(offering) {
  const metric = getOfferingBountyMetricValue(offering);
  if (!metric) return null;
  const bountyType = String(offering?.profile_expertise_bounty_type ?? "none").trim();
  if (bountyType === "total") return `${metric} single bounty`;
  return `${metric} bounty each`;
}

function getOfferingCostMetricValue(offering) {
  const cost = offering?.cost ?? offering?.profile_expertise_cost ?? "";
  const col = parseOfferingCost(cost);
  return col?.value || null;
}

function getOfferingQtyMetricValue(offering) {
  const qty = offering?.quantity ?? offering?.profile_expertise_quantity ?? "";
  const raw = String(qty).trim();
  if (!raw || raw === "0") return null;
  return raw;
}

/** Three-column metrics for Search list cards — Cost, Qty, Bounty. */
export function getOfferingListMetricColumns(offering) {
  return [
    { label: "Cost", value: getOfferingCostMetricValue(offering) },
    { label: "Qty", value: getOfferingQtyMetricValue(offering) },
    { label: "Bounty", value: getOfferingBountyMetricValue(offering) },
  ].filter((col) => col.value);
}

export function getOfferingLocationLabel(offering) {
  const city = String(offering?.profile_expertise_city ?? "").trim();
  const state = String(offering?.profile_expertise_state ?? "").trim();
  const cityState = [city, state].filter(Boolean).join(", ");
  if (cityState) return cityState;
  return String(offering?.profile_expertise_location ?? "").trim();
}

function getOfferingConditionValue(offering) {
  const c = offering?.profile_expertise_condition_type;
  if (c === undefined || c === null) return null;
  const cLow = String(c).trim().toLowerCase();
  if (cLow === "" || cLow === "na") return null;
  if (cLow === "used") {
    const detail = String(offering.profile_expertise_condition_detail || "").trim();
    return detail ? `Used — ${detail}` : "Used";
  }
  if (cLow === "new") return "New";
  return null;
}

function getOfferingShippingValue(offering) {
  if (isTruthyFlag(offering?.profile_expertise_free_shipping)) return "Free";
  if (isTruthyFlag(offering?.profile_expertise_buyer_pays_shipping)) return "Buyer pays";
  return null;
}

function getOfferingReturnsValue(offering) {
  if (!isTruthyFlag(offering?.profile_expertise_is_returnable)) return "No";
  const days = String(offering?.profile_expertise_return_window_days ?? "").trim();
  const daysLabel = days && days !== "0" ? days : "30";
  return `Yes, within ${daysLabel} days`;
}

function getOfferingRefundPolicyValue(offering) {
  const policy = String(offering?.profile_expertise_refund_policy ?? "").trim();
  return policy || null;
}

/** Structured layout data for Offering card (Profile, Search). */
export function getOfferingCardLayout(offering) {
  const cost = offering?.cost ?? offering?.profile_expertise_cost ?? "";
  const qty = offering?.quantity ?? offering?.profile_expertise_quantity ?? "";
  const costCol = parseOfferingCost(cost);
  const taxSubtext = costCol ? getOfferingTaxSubtext(offering) : null;
  const qtyRaw = qty != null ? String(qty).trim() : "";
  const bountySubtext = getOfferingBountySubtext(offering);

  const metrics = {
    hasContent: !!(costCol || qtyRaw || bountySubtext),
    costColumnLabel: costCol?.columnLabel || "Total cost",
    costValue: costCol?.value || null,
    costSubtext: taxSubtext,
    availabilityValue: qtyRaw ? `${qtyRaw} qty` : null,
    availabilitySubtext: bountySubtext,
  };

  const location = getOfferingLocationLabel(offering);
  const hasSchedule = !!(offering?.profile_expertise_start || offering?.profile_expertise_end);
  const whenWhere = {
    hasContent: !!(hasSchedule || location || offering?.profile_expertise_mode),
    start: offering?.profile_expertise_start || "",
    end: offering?.profile_expertise_end || "",
    location,
    mode: offering?.profile_expertise_mode || "",
  };

  const fulfillmentRows = [
    { label: "Condition", value: getOfferingConditionValue(offering) },
    { label: "Shipping", value: getOfferingShippingValue(offering) },
    { label: "Returns", value: getOfferingReturnsValue(offering) },
    { label: "Refund policy", value: getOfferingRefundPolicyValue(offering) },
  ].filter((row) => row.value);

  return { metrics, whenWhere, fulfillmentRows };
}

export function offeringCardHasDetails(layout) {
  return !!(layout.metrics.hasContent || layout.whenWhere.hasContent || layout.fulfillmentRows.length);
}

/** @deprecated Use getOfferingCardLayout */
export function getOfferingCommerceGrid(offering) {
  const layout = getOfferingCardLayout(offering);
  return {
    costLabel: layout.metrics.costValue,
    qtyLabel: layout.metrics.availabilityValue,
    bountyLabel: layout.metrics.availabilitySubtext,
    taxLine: layout.metrics.costSubtext,
    conditionLine: layout.fulfillmentRows.find((r) => r.label === "Condition")?.value || null,
    shippingLine: layout.fulfillmentRows.find((r) => r.label === "Shipping")?.value || null,
    returnableLine: layout.fulfillmentRows.find((r) => r.label === "Returns")?.value || null,
    refundLine: layout.fulfillmentRows.find((r) => r.label === "Refund policy")?.value || null,
  };
}

export function offeringCommerceGridHasContent(grid) {
  return !!(
    grid.costLabel ||
    grid.qtyLabel ||
    grid.bountyLabel ||
    grid.taxLine ||
    grid.conditionLine ||
    grid.shippingLine ||
    grid.returnableLine ||
    grid.refundLine
  );
}

export function getOfferingCommerceMetaLines(offering) {
  const layout = getOfferingCardLayout(offering);
  return layout.fulfillmentRows.map((r) => `${r.label}: ${r.value}`);
}
