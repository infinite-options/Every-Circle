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
  { label: "Free shipping", value: "free" },
  { label: "Buyer pays", value: "buyer_pays" },
];

export const PROFILE_RETURNABLE_OPTIONS = [
  { label: "No", value: "no" },
  { label: "Yes", value: "yes" },
];

export const getOfferingShippingDropdownValue = (item) => {
  if (item?.profile_expertise_free_shipping === 1 || item?.profile_expertise_free_shipping === "1" || item?.profile_expertise_free_shipping === true) {
    return "free";
  }
  if (item?.profile_expertise_buyer_pays_shipping === 1 || item?.profile_expertise_buyer_pays_shipping === "1" || item?.profile_expertise_buyer_pays_shipping === true) {
    return "buyer_pays";
  }
  return "na";
};

export const applyOfferingShippingDropdownValue = (value) => {
  if (value === "free") {
    return { profile_expertise_free_shipping: 1, profile_expertise_buyer_pays_shipping: 0 };
  }
  if (value === "buyer_pays") {
    return { profile_expertise_free_shipping: 0, profile_expertise_buyer_pays_shipping: 1 };
  }
  return { profile_expertise_free_shipping: 0, profile_expertise_buyer_pays_shipping: 0 };
};

export const getOfferingReturnableDropdownValue = (item) => {
  if (item?.profile_expertise_is_returnable === 1 || item?.profile_expertise_is_returnable === "1") {
    return "yes";
  }
  return "no";
};
