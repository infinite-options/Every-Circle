/**
 * Normalizes a business service row from GET /businessinfo (and related) so the app
 * can use one shape in UI and forms. Maps alternate/legacy API fields:
 * - bs_image_url → bs_image_key (when key empty)
 * - bs_quantity → bs_available_quantity / bs_qty_unlimited
 * - bs_condition → bs_condition_type / bs_condition_detail
 * - bs_shipping → bs_free_shipping / bs_buyer_pays_shipping when flags are absent
 */

/** Canonical values for backend JSON: "buyer" | "seller" | "". */
export function normalizeBsCcFeePayer(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "buyer") return "buyer";
  if (s === "seller") return "seller";
  return "";
}

/** True = business/seller pays CC fees (default). False = buyer pays. */
export function businessPaysCcFeeFromApiPayer(raw) {
  return normalizeBsCcFeePayer(raw) !== "buyer";
}

/** For business-level display/API: "buyer" or "seller" (defaults to seller). */
export function canonicalBusinessCcFeePayer(raw) {
  return normalizeBsCcFeePayer(raw) === "buyer" ? "buyer" : "seller";
}

export function normalizeBusinessServiceFromApi(service) {
  if (!service || typeof service !== "object") return service;
   
  console.log("DEBUG normalize input:", {
    bs_uid: service.bs_uid,
    bs_quantity: service.bs_quantity,
    bs_available_quantity: service.bs_available_quantity,
    bs_qty_unlimited: service.bs_qty_unlimited,
  });

  const imgKey =
    service.bs_image_key != null && String(service.bs_image_key).trim() !== ""
      ? String(service.bs_image_key).trim()
      : service.bs_image_url != null && String(service.bs_image_url).trim() !== ""
        ? String(service.bs_image_url).trim()
        : "";

  const pubRaw = service.bs_service_image_is_public ?? service.bs_image_url_is_public;
  const imgIsPublic = pubRaw === 0 || pubRaw === "0" || pubRaw === false ? 0 : 1;

  let bs_available_quantity =
    service.bs_available_quantity != null && String(service.bs_available_quantity).trim() !== ""
      ? String(service.bs_available_quantity).trim()
      : "";
  if (bs_available_quantity === "" && service.bs_quantity != null && String(service.bs_quantity).trim() !== "") {
    bs_available_quantity = String(service.bs_quantity).trim();
  }

  // let bs_qty_unlimited = service.bs_qty_unlimited === 0 || service.bs_qty_unlimited === "0" ? 0 : 1;
  let bs_qty_unlimited =
  service.bs_qty_unlimited === 0 || service.bs_qty_unlimited === "0" ? 0
  : service.bs_qty_unlimited === 1 || service.bs_qty_unlimited === "1" || service.bs_qty_unlimited === true ? 1
  : // Not explicitly set — infer from bs_quantity
    service.bs_quantity != null && String(service.bs_quantity).trim() !== "" &&
    String(service.bs_quantity).trim().toLowerCase() !== "unlimited"
      ? 0   // has a numeric quantity → limited
      : 1;  // no quantity at all → treat as unlimited
      
  if (
    (service.bs_qty_unlimited === undefined || service.bs_qty_unlimited === null || service.bs_qty_unlimited === "") &&
    service.bs_quantity != null &&
    String(service.bs_quantity).trim() !== ""
  ) {
    bs_qty_unlimited = 0;
  }

  // Legacy / inconsistent rows: limited flag with quantity text "unlimited"
  if (
    bs_qty_unlimited === 0 &&
    bs_available_quantity !== "" &&
    String(bs_available_quantity).trim().toLowerCase() === "unlimited"
  ) {
    bs_qty_unlimited = 1;
    bs_available_quantity = "";
  }

  let bs_condition_type = service.bs_condition_type;
  let bs_condition_detail = service.bs_condition_detail || service.bs_used_condition || "";
  if (
    (bs_condition_type === undefined || bs_condition_type === null || String(bs_condition_type).trim() === "") &&
    service.bs_condition != null &&
    String(service.bs_condition).trim() !== ""
  ) {
    const bc = String(service.bs_condition).trim();
    const low = bc.toLowerCase();
    if (low === "new" || low === "used") {
      bs_condition_type = low;
    } else {
      bs_condition_type = "used";
      bs_condition_detail = (bs_condition_detail || bc).trim();
    }
  }

  let bs_free_shipping = service.bs_free_shipping === 1 || service.bs_free_shipping === "1" || service.bs_free_shipping === true ? 1 : 0;
  let bs_buyer_pays_shipping =
    service.bs_buyer_pays_shipping === 1 || service.bs_buyer_pays_shipping === "1" || service.bs_buyer_pays_shipping === true ? 1 : 0;

  if (bs_free_shipping === 0 && bs_buyer_pays_shipping === 0 && service.bs_shipping != null && String(service.bs_shipping).trim() !== "") {
    const sh = String(service.bs_shipping).trim().toLowerCase();
    if (sh === "free" || sh === "1" || sh === "yes" || sh.includes("free")) {
      bs_free_shipping = 1;
    } else if (sh.includes("buyer") || sh.includes("buyer pays") || sh === "buyer_pays") {
      bs_buyer_pays_shipping = 1;
    }
  }

  const next = {
    ...service,
    bs_uid: service.bs_uid || "",
    bs_tags: service.bs_tags || "",
    bs_image_key: imgKey,
    bs_condition_detail,
    bs_free_shipping,
    bs_buyer_pays_shipping,
    // CC fee payer is business-level only; strip legacy per-product values for UI.
    bs_cc_fee_payer: "",
    bs_qty_unlimited,
    bs_available_quantity,
    bs_quantity: bs_available_quantity,
    bs_service_image_is_public: imgIsPublic,
  };

  if (bs_condition_type !== undefined && bs_condition_type !== null && String(bs_condition_type).trim() !== "") {
    next.bs_condition_type = String(bs_condition_type).toLowerCase() === "used" ? "used" : "new";
  }

  return next;
}
