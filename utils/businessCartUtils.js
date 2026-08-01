import { resolveCartLine } from "./cartFulfillmentMethod";
import { applyBsShippingFromApi } from "./businessServiceShipping";

/** Fields to persist on business cart lines for fulfillment + delivery charge recomputation. */
export function businessCartPersistedFields(service, business = null) {
  const shippingFields = applyBsShippingFromApi(service);
  const draft = {
    bs_mode: String(service?.bs_mode || "").trim(),
    bs_shipping: shippingFields.bs_shipping ?? service?.bs_shipping ?? null,
    bs_shipping_amount: shippingFields.bs_shipping_amount ?? service?.bs_shipping_amount ?? null,
    bs_free_shipping: shippingFields.bs_free_shipping ?? 0,
    bs_buyer_pays_shipping: shippingFields.bs_buyer_pays_shipping ?? 0,
    bs_shipping_cost_type: shippingFields.bs_shipping_cost_type ?? "",
    bs_fixed_shipping_amount: shippingFields.bs_fixed_shipping_amount ?? "",
    business_location: String(business?.business_location || service?.business_location || "").trim(),
    business_city: String(business?.business_city || service?.business_city || "").trim(),
    business_state: String(business?.business_state || service?.business_state || "").trim(),
    business_zip: String(business?.business_zip || service?.business_zip || "").trim(),
  };
  return {
    ...draft,
    fulfillment_method: resolveCartLine({ ...service, ...draft, itemType: "business" }).fulfillment_method,
  };
}
