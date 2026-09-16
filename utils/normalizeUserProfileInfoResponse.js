/**
 * Unwrap common userprofileinfo API shapes into flat { personal_info, user_email, ... }.
 * Matches ProfileScreen normalization so QR/public cards see the same fields.
 */
export function normalizeUserProfileInfoResponse(raw) {
  if (raw == null || typeof raw !== "object") return raw;
  let cur = raw;

  if (typeof cur.body === "string") {
    const trimmed = cur.body.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const inner = JSON.parse(cur.body);
        if (inner && typeof inner === "object") cur = inner;
      } catch (_) {}
    }
  }

  const missingPersonalBlock = (o) => o == null || (o.personal_info == null && o.profile_info == null);

  if (cur.data && typeof cur.data === "object" && missingPersonalBlock(cur)) {
    cur = cur.data;
  }
  if (cur.result && typeof cur.result === "object" && missingPersonalBlock(cur)) {
    cur = cur.result;
  }

  if (typeof cur.personal_info === "string") {
    try {
      const p = JSON.parse(cur.personal_info);
      if (p && typeof p === "object") cur = { ...cur, personal_info: p };
    } catch (_) {}
  }

  if (cur.personal_info == null && cur.profile_info != null && typeof cur.profile_info === "object") {
    cur = { ...cur, personal_info: cur.profile_info };
  }
  if ((cur.user_email == null || cur.user_email === "") && cur.email_id != null && cur.email_id !== "") {
    cur = { ...cur, user_email: cur.email_id };
  }

  return cur;
}
