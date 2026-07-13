import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  getFlagReasonLabel,
  getProfileModerationStatusLabel,
  normalizeProfileReviewDetail,
} from "../utils/profileModeration";
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

function profileDisplayName(profile, queueItem) {
  const first =
    profile?.profile_personal_first_name ||
    profile?.first_name ||
    queueItem?.profile_personal_first_name ||
    queueItem?.owner_first_name ||
    queueItem?.first_name ||
    "";
  const last =
    profile?.profile_personal_last_name ||
    profile?.last_name ||
    queueItem?.profile_personal_last_name ||
    queueItem?.owner_last_name ||
    queueItem?.last_name ||
    "";
  return [first, last].filter(Boolean).join(" ");
}

const ProfileReviewDetailPanel = ({ detail, queueItem, darkMode = false }) => {
  const { profile, moderation, pendingFlags } = normalizeProfileReviewDetail(detail);
  const name = profileDisplayName(profile, queueItem);
  const profileUid =
    profile?.profile_personal_uid ||
    queueItem?.profile_personal_uid ||
    queueItem?.profile_uid ||
    "";
  const email =
    profile?.user_email ||
    profile?.user_email_id ||
    queueItem?.user_email ||
    queueItem?.user_email_id ||
    "";
  const tagLine = sanitizeText(profile?.profile_personal_tag_line || profile?.tag_line || queueItem?.profile_personal_tag_line || "");
  const shortBio = sanitizeText(profile?.profile_personal_short_bio || profile?.short_bio || "");
  const city = profile?.profile_personal_city || queueItem?.profile_personal_city || "";
  const state = profile?.profile_personal_state || queueItem?.profile_personal_state || "";
  const location = [city, state].filter(Boolean).join(", ");
  const phone = profile?.profile_personal_phone_number || queueItem?.profile_personal_phone_number || "";

  const moderationItem = {
    moderation,
    profile_personal_moderated: profile?.profile_personal_moderated ?? queueItem?.profile_personal_moderated,
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.mainTitle, darkMode && styles.mainTitleDark]}>{name || "Profile review"}</Text>

      <Section title='Profile' darkMode={darkMode}>
        <DetailRow label='Name' value={name} darkMode={darkMode} />
        <DetailRow label='Profile ID' value={profileUid} darkMode={darkMode} />
        <DetailRow label='Email' value={email} darkMode={darkMode} />
        <DetailRow label='Phone' value={phone} darkMode={darkMode} />
        <DetailRow label='Tag line' value={tagLine} darkMode={darkMode} />
        <DetailRow label='Short bio' value={shortBio} darkMode={darkMode} />
        <DetailRow label='Location' value={location} darkMode={darkMode} />
      </Section>

      <Section title='Moderation' darkMode={darkMode}>
        <DetailRow label='Status' value={getProfileModerationStatusLabel(moderationItem)} darkMode={darkMode} />
        <DetailRow label='Flag count' value={moderation?.flagCount ?? moderation?.flag_count ?? queueItem?.flagCount ?? queueItem?.flag_count} darkMode={darkMode} />
        <DetailRow
          label='Moderated code'
          value={profile?.profile_personal_moderated ?? moderation?.moderated ?? queueItem?.profile_personal_moderated}
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
    color: "#6A1B9A",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sectionTitleDark: {
    color: "#ce93d8",
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
    color: "#6A1B9A",
    marginBottom: 4,
  },
  flagCategoryDark: {
    color: "#ce93d8",
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

export default ProfileReviewDetailPanel;
