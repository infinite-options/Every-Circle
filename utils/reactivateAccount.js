import { REACTIVATE_ACCOUNT_ENDPOINT } from "../apiConfig";
import { persistAuthTokens, unwrapAuthResult } from "./authSession";
import { fetchMiddleware as fetch } from "./httpMiddleware";

export const DEFAULT_DELETION_GRACE_DAYS = 30;

/**
 * POST /api/v1/account/reactivate — restore a soft-deleted account during the grace window.
 * No JWT. confirm_reactivation must be true.
 * @returns {{ ok: true, data: object } | { ok: false, status: number, message: string, code?: number }}
 */
export async function reactivateAccountApi({ email, password, confirmReactivation = true }) {
  const response = await fetch(REACTIVATE_ACCOUNT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: String(email || "").trim(),
      password: String(password || ""),
      confirm_reactivation: confirmReactivation === true,
    }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  if (response.ok && (data?.code === 200 || response.status === 200)) {
    const tokens = unwrapAuthResult(data) || data;
    await persistAuthTokens(tokens);
    return { ok: true, data: data || {} };
  }

  const status = response.status;
  const message =
    data?.message ||
    (status === 400
      ? "Please confirm reactivation."
      : status === 401
        ? "Incorrect password. Please try again."
        : status === 404
          ? "Account not found."
          : status === 410
            ? "The reactivation window has expired. This account has been permanently deleted."
            : "Could not reactivate account. Please try again.");

  return { ok: false, status, message, code: data?.code };
}

/** Whole days remaining until purge_scheduled_at (0 if past / invalid). */
export function daysUntilPurge(purgeScheduledAt, graceDays = DEFAULT_DELETION_GRACE_DAYS) {
  if (purgeScheduledAt) {
    const purge = new Date(purgeScheduledAt);
    if (!Number.isNaN(purge.getTime())) {
      const ms = purge.getTime() - Date.now();
      return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }
  }
  return typeof graceDays === "number" && graceDays >= 0 ? graceDays : DEFAULT_DELETION_GRACE_DAYS;
}

export function formatPurgeDate(purgeScheduledAt) {
  if (!purgeScheduledAt) return null;
  const d = new Date(purgeScheduledAt);
  if (Number.isNaN(d.getTime())) return String(purgeScheduledAt);
  try {
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  } catch (_) {
    return d.toISOString().slice(0, 10);
  }
}
