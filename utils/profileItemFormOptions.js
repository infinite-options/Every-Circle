/** Dropdown options aligned with EditBusinessProfile Add New Product/Service form. */

export const PROFILE_COST_UNIT_OPTIONS = [
  { label: "total", value: "total" },
  { label: "/each", value: "each" },
  { label: "/hr", value: "hr" },
  { label: "/day", value: "day" },
  { label: "/week", value: "week" },
  { label: "/2 weeks", value: "2 weeks" },
  { label: "/month", value: "month" },
  { label: "/quarter", value: "quarter" },
  { label: "/year", value: "year" },
];

export const PROFILE_TAX_OPTIONS = [
  { label: "No tax", value: "no_tax" },
  { label: "Taxable", value: "taxable" },
];

export const PROFILE_BOUNTY_TYPE_OPTIONS = [
  { label: "No bounty", value: "none" },
  { label: "Per item", value: "per_item" },
  { label: "Single bounty", value: "total" },
];

export const PROFILE_CONDITION_OPTIONS = [
  { label: "Not applicable", value: "na" },
  { label: "New", value: "new" },
  { label: "Used", value: "used" },
];

export const PROFILE_OFFERING_SHIPPING_OPTIONS = [
  { label: "Not applicable", value: "na" },
  { label: "Free delivery charge", value: "free" },
  { label: "Buyer pays (fixed)", value: "buyer_fixed" },
  { label: "Buyer pays (actual)", value: "buyer_actual" },
];

export const PROFILE_QUANTITY_OPTIONS = [
  { label: "No limit", value: "unlimited" },
  { label: "Limited", value: "limited" },
];

export const PROFILE_RETURNABLE_OPTIONS = [
  { label: "No", value: "no" },
  { label: "Yes", value: "yes" },
];

export { getOfferingShippingDropdownValue, applyOfferingShippingDropdownValue } from "./profileOfferingShipping";
export { getSeekingShippingDropdownValue, applySeekingShippingDropdownValue } from "./profileSeekingShipping";

export const getOfferingReturnableDropdownValue = (item) => {
  if (item?.profile_expertise_is_returnable === 1 || item?.profile_expertise_is_returnable === "1") {
    return "yes";
  }
  return "no";
};

export const getSeekingReturnableDropdownValue = (item) => {
  if (item?.profile_wish_is_returnable === 1 || item?.profile_wish_is_returnable === "1") {
    return "yes";
  }
  return "no";
};
