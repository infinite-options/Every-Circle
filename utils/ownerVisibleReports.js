/**
 * Pending reports on owner-facing moderation payloads.
 * Backend shape (moderation.reports): { reportUid, category, message, createdAt }
 * Also accepts admin pendingFlags aliases; never reads reporter identity.
 */
export function getOwnerVisibleReports(item) {
  const raw =
    item?.moderation?.reports ??
    item?.reports ??
    item?.moderation?.pendingFlags ??
    item?.moderation?.pending_flags ??
    item?.pendingFlags ??
    item?.pending_flags ??
    [];
  if (!Array.isArray(raw) || raw.length === 0) return [];

  return raw
    .map((r, index) => {
      if (!r || typeof r !== "object") return null;
      const category = String(r.category ?? r.report_reason_category ?? r.reason_category ?? "").trim();
      const message = String(r.message ?? r.report_reason_text ?? r.reason_text ?? "").trim();
      if (!category && !message) return null;
      return {
        id: String(r.reportUid ?? r.report_uid ?? r.content_reports_uid ?? index),
        category,
        message,
      };
    })
    .filter(Boolean);
}
