import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Platform, KeyboardAvoidingView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import WebTextInput from "./WebTextInput";
import { useDarkMode } from "../contexts/DarkModeContext";
import { FLAG_REASON_CATEGORIES, submitSeekingFlag } from "../utils/seekingModeration";
import { sanitizeText } from "../utils/textSanitizer";

const isWeb = typeof window !== "undefined" && typeof document !== "undefined";

const FlagSeekingModal = ({ visible, onClose, targetUid, seekingTitle, onSubmitted }) => {
  const { darkMode } = useDarkMode();
  const [reasonCategory, setReasonCategory] = useState(FLAG_REASON_CATEGORIES[0].value);
  const [reasonText, setReasonText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (visible) {
      setReasonCategory(FLAG_REASON_CATEGORIES[0].value);
      setReasonText("");
      setSubmitting(false);
      setSubmitSuccess(false);
      setSubmitError("");
    }
  }, [visible, targetUid]);

  const handleSubmit = async () => {
    setSubmitError("");
    if (!reasonCategory) {
      setSubmitError("Please select a reason.");
      return;
    }
    if (reasonCategory === "other" && !reasonText.trim()) {
      setSubmitError("Please describe the issue.");
      return;
    }

    setSubmitting(true);
    try {
      await submitSeekingFlag({
        targetUid,
        reasonCategory,
        reasonText: reasonText.trim(),
      });
      setSubmitSuccess(true);
      onSubmitted?.();
    } catch (e) {
      if (e?.code === 409) {
        setSubmitError(e.message);
      } else {
        setSubmitError(e?.message || "Failed to submit report.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    onClose?.();
  };

  const titleLabel = sanitizeText(seekingTitle) || "this seeking post";

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={[styles.box, darkMode && styles.boxDark]}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, darkMode && styles.headerTitleDark]}>Report seeking</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name='close' size={22} color={darkMode ? "#fff" : "#333"} />
            </TouchableOpacity>
          </View>

          {submitSuccess ? (
            <View style={styles.successBody}>
              <Ionicons name='checkmark-circle' size={40} color='#18884A' style={{ marginBottom: 12 }} />
              <Text style={[styles.successText, darkMode && styles.successTextDark]}>Thank you. Your report was submitted.</Text>
              <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={styles.body}>
              <Text style={[styles.subtitle, darkMode && styles.subtitleDark]}>
                Why are you reporting {titleLabel}?
              </Text>

              {FLAG_REASON_CATEGORIES.map((cat) => {
                const selected = reasonCategory === cat.value;
                return (
                  <TouchableOpacity
                    key={cat.value}
                    style={[styles.reasonRow, selected && styles.reasonRowSelected, darkMode && styles.reasonRowDark]}
                    onPress={() => setReasonCategory(cat.value)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={selected ? "#4B2E83" : darkMode ? "#aaa" : "#888"}
                      style={{ marginRight: 10 }}
                    />
                    <Text style={[styles.reasonLabel, darkMode && styles.reasonLabelDark]}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}

              <Text style={[styles.detailsLabel, darkMode && styles.detailsLabelDark]}>
                Additional details {reasonCategory === "other" ? "(required)" : "(optional)"}
              </Text>
              <WebTextInput
                style={[styles.detailsInput, darkMode && styles.detailsInputDark]}
                value={reasonText}
                onChangeText={setReasonText}
                placeholder='Describe the issue...'
                placeholderTextColor={darkMode ? "#888" : "#aaa"}
                multiline
                numberOfLines={4}
                textAlignVertical='top'
              />

              {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color='#fff' size='small' />
                ) : (
                  <Text style={styles.submitButtonText}>Submit report</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  box: {
    width: isWeb ? 420 : "92%",
    maxWidth: 440,
    maxHeight: "85%",
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  boxDark: {
    backgroundColor: "#2a2a2a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#333",
  },
  headerTitleDark: {
    color: "#fff",
  },
  body: {
    padding: 16,
    paddingBottom: 24,
  },
  subtitle: {
    fontSize: 14,
    color: "#444",
    marginBottom: 12,
  },
  subtitleDark: {
    color: "#ddd",
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#eee",
  },
  reasonRowSelected: {
    borderColor: "#4B2E83",
    backgroundColor: "rgba(75, 46, 131, 0.06)",
  },
  reasonRowDark: {
    borderColor: "#444",
  },
  reasonLabel: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  reasonLabelDark: {
    color: "#eee",
  },
  detailsLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginTop: 12,
    marginBottom: 6,
  },
  detailsLabelDark: {
    color: "#ccc",
  },
  detailsInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    minHeight: 88,
    padding: 10,
    fontSize: 14,
    color: "#333",
    backgroundColor: "#fafafa",
  },
  detailsInputDark: {
    borderColor: "#555",
    backgroundColor: "#1f1f1f",
    color: "#fff",
  },
  errorText: {
    color: "#B71C1C",
    fontSize: 13,
    marginTop: 10,
  },
  submitButton: {
    marginTop: 16,
    backgroundColor: "#B71C1C",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  successBody: {
    padding: 24,
    alignItems: "center",
  },
  successText: {
    fontSize: 15,
    color: "#333",
    textAlign: "center",
    marginBottom: 16,
  },
  successTextDark: {
    color: "#eee",
  },
  doneButton: {
    backgroundColor: "#4B2E83",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  doneButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});

export default FlagSeekingModal;
