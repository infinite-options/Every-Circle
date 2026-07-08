import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatExpertiseModeForDisplay } from "../utils/expertiseMode";
import { formatDateTimeForDisplay } from "../utils/profileDateTime";
import { getFlagReasonLabel, getModerationStatusLabel, normalizeOfferingReviewDetail } from "../utils/offeringModeration";

const DetailRow = ({ label, value, darkMode }) => {
  const text = value != null && String(value).trim() !== "" ? String(value).trim() : null;
  if (!text) return null;
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, darkMode && styles.rowLabelDark]}>{label}</Text>
      <Text style={[styles.rowValue, darkMode && styles.rowValueDark]}>{text}</Text>
    </View>
  );
};

const Section = ({ title, children, darkMode }) => {
  if (!children) return null;
  return (
    <View style={[styles.section, darkMode && styles.sectionDark]}>
      <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>{title}</Text>
      {children}
    </View>
  );
};

function formatOfferingCost(cost) {
  const raw = String(cost || "").trim();
  if (!raw) return "";
  if (raw.toLowerCase() === "free") return "Free";
  return raw.startsWith("$") ? raw : `$${raw}`;
}

function buildOfferingDetailRows(offering, darkMode) {
  if (!offering) return null;
  const start = offering.profile_expertise_start || offering.startDateTime;
  const end = offering.profile_expertise_end || offering.endDateTime;
  const dateRange = [start ? formatDateTimeForDisplay(start) : "", end ? formatDateTimeForDisplay(end) : ""].filter(Boolean).join(" → ");
  const location = [offering.profile_expertise_city, offering.profile_expertise_state].filter(Boolean).join(", ") || offering.profile_expertise_location || offering.location;
  const mode = formatExpertiseModeForDisplay(offering.profile_expertise_mode || offering.mode);

  return (
    <>
      <DetailRow label='Title' value={offering.profile_expertise_title || offering.title} darkMode={darkMode} />
      <DetailRow label='Description' value={offering.profile_expertise_description || offering.description} darkMode={darkMode} />
      <DetailRow label='Cost' value={formatOfferingCost(offering.profile_expertise_cost || offering.cost)} darkMode={darkMode} />
      <DetailRow label='Quantity' value={offering.profile_expertise_quantity ?? offering.quantity} darkMode={darkMode} />
      <DetailRow label='Bounty' value={formatOfferingCost(offering.profile_expertise_bounty || offering.bounty)} darkMode={darkMode} />
      <DetailRow label='Schedule' value={dateRange} darkMode={darkMode} />
      <DetailRow label='Location' value={location} darkMode={darkMode} />
      <DetailRow label='Mode' value={mode} darkMode={darkMode} />
      <DetailRow
        label='Tax'
        value={
          offering.profile_expertise_is_taxable === 1 || offering.isTaxable === 1
            ? `Taxable${offering.profile_expertise_tax_rate || offering.taxRate ? ` (${offering.profile_expertise_tax_rate || offering.taxRate}%)` : ""}`
            : "No tax"
        }
        darkMode={darkMode}
      />
      <DetailRow
        label='Condition'
        value={
          offering.profile_expertise_condition_type && offering.profile_expertise_condition_type !== "na"
            ? `${offering.profile_expertise_condition_type}${offering.profile_expertise_condition_detail ? ` — ${offering.profile_expertise_condition_detail}` : ""}`
            : ""
        }
        darkMode={darkMode}
      />
      <DetailRow
        label='Shipping'
        value={
          offering.profile_expertise_free_shipping === 1
            ? "Free shipping"
            : offering.profile_expertise_buyer_pays_shipping === 1
              ? "Buyer pays shipping"
              : ""
        }
        darkMode={darkMode}
      />
      <DetailRow
        label='Returns'
        value={
          offering.profile_expertise_is_returnable === 1
            ? `${offering.profile_expertise_return_window_days || "—"} day window`
            : ""
        }
        darkMode={darkMode}
      />
      <DetailRow label='Refund policy' value={offering.profile_expertise_refund_policy || offering.refundPolicy} darkMode={darkMode} />
      <DetailRow label='Public' value={offering.profile_expertise_is_public === 1 || offering.isPublic === 1 ? "Yes" : "No"} darkMode={darkMode} />
      <DetailRow label='Offering ID' value={offering.profile_expertise_uid || offering.uid} darkMode={darkMode} />
      <DetailRow label='Last updated' value={offering.profile_expertise_updated_at} darkMode={darkMode} />
    </>
  );
}

function buildSnapshotRows(snapshot, darkMode) {
  if (!snapshot || typeof snapshot !== "object") return null;
  return (
    <>
      <DetailRow label='Title' value={snapshot.title} darkMode={darkMode} />
      <DetailRow label='Description' value={snapshot.description} darkMode={darkMode} />
      <DetailRow label='Cost' value={formatOfferingCost(snapshot.cost)} darkMode={darkMode} />
      <DetailRow label='Quantity' value={snapshot.quantity} darkMode={darkMode} />
      <DetailRow label='Bounty' value={formatOfferingCost(snapshot.bounty)} darkMode={darkMode} />
      <DetailRow
        label='Schedule'
        value={[snapshot.startDateTime, snapshot.endDateTime].filter(Boolean).map((d) => formatDateTimeForDisplay(d)).join(" → ")}
        darkMode={darkMode}
      />
      <DetailRow label='Location' value={[snapshot.city, snapshot.state].filter(Boolean).join(", ") || snapshot.location} darkMode={darkMode} />
      <DetailRow label='Mode' value={formatExpertiseModeForDisplay(snapshot.mode)} darkMode={darkMode} />
      <DetailRow label='Public at flag time' value={snapshot.isPublic === 1 ? "Yes" : "No"} darkMode={darkMode} />
    </>
  );
}

const OfferingReviewDetailPanel = ({ detail, queueItem, darkMode = false }) => {
  const { offering, moderation, pendingFlags, latestResubmission, snapshot } = normalizeOfferingReviewDetail(detail);
  const ownerFirst = queueItem?.owner_first_name || queueItem?.profile_personal_first_name || "";
  const ownerLast = queueItem?.owner_last_name || queueItem?.profile_personal_last_name || "";
  const ownerName = [ownerFirst, ownerLast].filter(Boolean).join(" ");
  const ownerUid = offering?.profile_expertise_profile_personal_id || queueItem?.profile_expertise_profile_personal_id || "";

  const moderationItem = { moderation, profile_expertise_moderated: offering?.profile_expertise_moderated };

  return (
    <View style={styles.container}>
      <Text style={[styles.mainTitle, darkMode && styles.mainTitleDark]}>
        {offering?.profile_expertise_title || queueItem?.profile_expertise_title || "Offering review"}
      </Text>

      <Section title='Owner' darkMode={darkMode}>
        <DetailRow label='Name' value={ownerName} darkMode={darkMode} />
        <DetailRow label='Profile ID' value={ownerUid} darkMode={darkMode} />
      </Section>

      <Section title='Moderation' darkMode={darkMode}>
        <DetailRow label='Status' value={getModerationStatusLabel(moderationItem)} darkMode={darkMode} />
        <DetailRow label='Flag count' value={moderation?.flagCount ?? moderation?.flag_count} darkMode={darkMode} />
        <DetailRow label='Moderated code' value={offering?.profile_expertise_moderated ?? moderation?.moderated} darkMode={darkMode} />
        <DetailRow label='Review queue status' value={moderation?.resubmissionStatus ?? moderation?.resubmission_status} darkMode={darkMode} />
        <DetailRow label='Queued at' value={moderation?.resubmissionCreatedAt ?? moderation?.resubmission_created_at} darkMode={darkMode} />
        <DetailRow label='Owner can edit' value={moderation?.canEdit === false ? "No" : moderation?.canEdit === true ? "Yes" : ""} darkMode={darkMode} />
      </Section>

      <Section title='Current offering' darkMode={darkMode}>
        {buildOfferingDetailRows(offering, darkMode)}
      </Section>

      {snapshot ? (
        <Section title='Flagged snapshot' darkMode={darkMode}>
          <DetailRow label='Snapshot status' value={latestResubmission?.resubmission_status ?? latestResubmission?.resubmissionStatus} darkMode={darkMode} />
          <DetailRow label='Snapshot created' value={latestResubmission?.resubmission_created_at ?? latestResubmission?.resubmissionCreatedAt} darkMode={darkMode} />
          {buildSnapshotRows(snapshot, darkMode)}
        </Section>
      ) : null}

      {pendingFlags.length > 0 ? (
        <Section title={`Pending flags (${pendingFlags.length})`} darkMode={darkMode}>
          {pendingFlags.map((flag, i) => {
            const reporter = [flag.reporter_first_name, flag.reporter_last_name].filter(Boolean).join(" ") || flag.reporter_name || flag.report_reporter_profile_uid;
            const category = getFlagReasonLabel(flag.report_reason_category || flag.reason_category);
            const reasonText = flag.report_reason_text || flag.reason_text || "";
            const createdAt = flag.report_created_at || flag.created_at || "";
            return (
              <View key={flag.report_uid || flag.content_reports_uid || i} style={[styles.flagCard, darkMode && styles.flagCardDark]}>
                <Text style={[styles.flagCategory, darkMode && styles.flagCategoryDark]}>{category}</Text>
                {reasonText ? <Text style={[styles.flagText, darkMode && styles.flagTextDark]}>{reasonText}</Text> : null}
                {reporter ? <Text style={[styles.flagMeta, darkMode && styles.flagMetaDark]}>Reporter: {reporter}</Text> : null}
                {createdAt ? <Text style={[styles.flagMeta, darkMode && styles.flagMetaDark]}>Reported: {createdAt}</Text> : null}
                {flag.report_uid || flag.content_reports_uid ? (
                  <Text style={[styles.flagMeta, darkMode && styles.flagMetaDark]}>Report ID: {flag.report_uid || flag.content_reports_uid}</Text>
                ) : null}
              </View>
            );
          })}
        </Section>
      ) : (
        <Section title='Pending flags' darkMode={darkMode}>
          <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No pending flags on record.</Text>
        </Section>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8,
  },
  mainTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
    marginBottom: 12,
  },
  mainTitleDark: {
    color: "#fff",
  },
  section: {
    marginBottom: 14,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#eee",
  },
  sectionDark: {
    backgroundColor: "#2a2a2a",
    borderColor: "#444",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B71C1C",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sectionTitleDark: {
    color: "#ff8a80",
  },
  row: {
    marginBottom: 6,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
    marginBottom: 2,
  },
  rowLabelDark: {
    color: "#aaa",
  },
  rowValue: {
    fontSize: 13,
    lineHeight: 18,
    color: "#333",
  },
  rowValueDark: {
    color: "#eee",
  },
  flagCard: {
    marginBottom: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#fff5f5",
    borderWidth: 1,
    borderColor: "#f5c6c6",
  },
  flagCardDark: {
    backgroundColor: "#3a2a2a",
    borderColor: "#664444",
  },
  flagCategory: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B71C1C",
    marginBottom: 4,
  },
  flagCategoryDark: {
    color: "#ff8a80",
  },
  flagText: {
    fontSize: 12,
    lineHeight: 17,
    color: "#444",
    marginBottom: 4,
  },
  flagTextDark: {
    color: "#ddd",
  },
  flagMeta: {
    fontSize: 10,
    color: "#888",
    marginTop: 2,
  },
  flagMetaDark: {
    color: "#aaa",
  },
  emptyText: {
    fontSize: 12,
    color: "#888",
    fontStyle: "italic",
  },
  emptyTextDark: {
    color: "#aaa",
  },
});

export default OfferingReviewDetailPanel;
