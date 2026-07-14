import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  getFlagReasonLabel,
  getBusinessModerationStatusLabel,
  normalizeBusinessReviewDetail,
} from "../utils/businessModeration";
import { sanitizeText } from "../utils/textSanitizer";

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

function businessDisplayName(business, queueItem) {
  return business?.business_name || queueItem?.business_name || "";
}

const BusinessReviewDetailPanel = ({ detail, queueItem, darkMode = false }) => {
  const { business, moderation, pendingFlags } = normalizeBusinessReviewDetail(detail);
  const name = businessDisplayName(business, queueItem);
  const businessUid = business?.business_uid || queueItem?.business_uid || "";
  const email = business?.business_email_id || queueItem?.business_email_id || "";
  const phone = business?.business_phone_number || queueItem?.business_phone_number || "";
  const category = sanitizeText(business?.business_category || queueItem?.business_category || "");
  const shortBio = sanitizeText(business?.business_short_bio || business?.short_bio || "");
  const city = business?.business_city || queueItem?.business_city || "";
  const state = business?.business_state || queueItem?.business_state || "";
  const location = [city, state].filter(Boolean).join(", ") || business?.business_location || queueItem?.business_location || "";
  const ownerName = [queueItem?.owner_first_name, queueItem?.owner_last_name].filter(Boolean).join(" ");

  const moderationItem = {
    moderation,
    business_moderated: business?.business_moderated ?? queueItem?.business_moderated,
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.mainTitle, darkMode && styles.mainTitleDark]}>{name || "Business review"}</Text>

      <Section title='Business' darkMode={darkMode}>
        <DetailRow label='Name' value={name} darkMode={darkMode} />
        <DetailRow label='Business ID' value={businessUid} darkMode={darkMode} />
        <DetailRow label='Owner' value={ownerName} darkMode={darkMode} />
        <DetailRow label='Email' value={email} darkMode={darkMode} />
        <DetailRow label='Phone' value={phone} darkMode={darkMode} />
        <DetailRow label='Category' value={category} darkMode={darkMode} />
        <DetailRow label='Short bio' value={shortBio} darkMode={darkMode} />
        <DetailRow label='Location' value={location} darkMode={darkMode} />
      </Section>

      <Section title='Moderation' darkMode={darkMode}>
        <DetailRow label='Status' value={getBusinessModerationStatusLabel(moderationItem)} darkMode={darkMode} />
        <DetailRow label='Flag count' value={moderation?.flagCount ?? moderation?.flag_count ?? queueItem?.flagCount ?? queueItem?.flag_count} darkMode={darkMode} />
        <DetailRow
          label='Moderated code'
          value={business?.business_moderated ?? moderation?.moderated ?? queueItem?.business_moderated}
          darkMode={darkMode}
        />
        <DetailRow label='Rejection note' value={moderation?.rejectionNote ?? moderation?.rejection_note} darkMode={darkMode} />
      </Section>

      {pendingFlags.length > 0 ? (
        <Section title={`Pending flags (${pendingFlags.length})`} darkMode={darkMode}>
          {pendingFlags.map((flag, i) => {
            const reporter =
              [flag.reporter_first_name, flag.reporter_last_name].filter(Boolean).join(" ") ||
              flag.reporter_name ||
              flag.report_reporter_profile_uid;
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
    color: "#222",
    lineHeight: 18,
  },
  rowValueDark: {
    color: "#eee",
  },
  flagCard: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 8,
  },
  flagCardDark: {
    backgroundColor: "#1f1f1f",
    borderColor: "#444",
  },
  flagCategory: {
    fontSize: 13,
    fontWeight: "700",
    color: "#B71C1C",
    marginBottom: 4,
  },
  flagCategoryDark: {
    color: "#ff8a80",
  },
  flagText: {
    fontSize: 12,
    color: "#444",
    marginBottom: 4,
    lineHeight: 17,
  },
  flagTextDark: {
    color: "#ccc",
  },
  flagMeta: {
    fontSize: 11,
    color: "#888",
    marginTop: 2,
  },
  flagMetaDark: {
    color: "#aaa",
  },
  emptyText: {
    fontSize: 12,
    color: "#888",
  },
  emptyTextDark: {
    color: "#aaa",
  },
});

export default BusinessReviewDetailPanel;
