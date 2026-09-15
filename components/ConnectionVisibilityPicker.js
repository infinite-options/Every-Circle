// ConnectionVisibilityPicker.js
// Per-field "who can see this" control for Edit Profile: the classic
// Visible/Hidden pills, plus - only while Visible is selected - a small
// secondary picker to narrow "Visible" down to either a circle-degree level
// (see utils/profilePathConnectionDegree.js / the "Level N Connection"
// concept already shown elsewhere in the app) or, where `allowCircleLevel` is
// set (personal-info fields only), a specific mix of circle relationship
// types (Friends/Family/Colleagues) - the same friend/colleague/family
// categories Messages Privacy and Nearby Location Privacy already use.
// Hidden always means only_me; Visible defaults to Everyone.
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const PRIMARY = "#4B2E83";

export const VISIBILITY_LEVELS = [
  { key: "everyone", label: "Everyone", shortLabel: "Everyone" },
  { key: "degree1", label: "1st Degree Connections", shortLabel: "1st Degree" },
  { key: "degree2", label: "2nd Degree Connections & closer", shortLabel: "2nd Degree" },
  { key: "degree3", label: "3rd Degree Connections & closer", shortLabel: "3rd Degree" },
  { key: "only_me", label: "Only Me", shortLabel: "Only Me" },
];

// Degree choices offered once a field is set to Visible (everything but Only Me).
const DEGREE_OPTIONS = VISIBILITY_LEVELS.filter((lvl) => lvl.key !== "only_me");
// Fallback list when a field opts out of degree levels (allowDegreeLevels={false}) - just
// Everyone, the base "Visible" state; Specific Circles (if allowed) still gets added separately.
const EVERYONE_ONLY_OPTION = VISIBILITY_LEVELS.filter((lvl) => lvl.key === "everyone");

const LEVEL_BY_KEY = VISIBILITY_LEVELS.reduce((acc, lvl) => {
  acc[lvl.key] = lvl;
  return acc;
}, {});

export const CIRCLE_TYPE_OPTIONS = [
  { key: "friend", label: "Friends" },
  { key: "colleague", label: "Colleagues" },
  { key: "family", label: "Family" },
];

const CIRCLE_TYPE_LABEL = CIRCLE_TYPE_OPTIONS.reduce((acc, t) => {
  acc[t.key] = t.label;
  return acc;
}, {});

/** Map a legacy boolean is_public flag to a visibility level string. */
export function visibilityFromIsPublic(isPublic) {
  return isPublic ? "everyone" : "only_me";
}

/** Split a picker value into its plain level and (for 'specific') circle types. */
export function parseVisibilityValue(value) {
  if (typeof value === "string" && value.startsWith("specific:")) {
    return { level: "specific", circleTypes: value.slice(9).split(",").filter(Boolean) };
  }
  return { level: value || "everyone", circleTypes: [] };
}

/** Inverse of parseVisibilityValue - build the single string this picker stores/emits. */
export function composeVisibilityValue(level, circleTypes) {
  if (level === "specific") return `specific:${(circleTypes || []).join(",")}`;
  return level;
}

/** Read `<prefix>_visibility` (+ `<prefix>_visibility_circles` when `specific`) off a
 * personal_info-shaped object into this picker's single composite value, falling back to the
 * legacy `<prefix>_is_public` boolean for profiles saved before this feature existed. */
export function resolveVisibilityLevel(personalInfo, visibilityKey, isPublicKey, circlesKey) {
  const raw = personalInfo?.[visibilityKey];
  if (raw === "specific" && circlesKey) {
    const csv = personalInfo?.[circlesKey] || "";
    return composeVisibilityValue("specific", csv.split(",").filter(Boolean));
  }
  if (raw && LEVEL_BY_KEY[raw]) return raw;
  return visibilityFromIsPublic(personalInfo?.[isPublicKey] === 1);
}

function shortLabelFor(level, circleTypes) {
  if (level !== "specific") return LEVEL_BY_KEY[level]?.shortLabel || LEVEL_BY_KEY.everyone.shortLabel;
  if (circleTypes.length === 0) return "Specific Circles";
  if (circleTypes.length === 1) return CIRCLE_TYPE_LABEL[circleTypes[0]] || "Specific Circles";
  return circleTypes.map((t) => CIRCLE_TYPE_LABEL[t]).filter(Boolean).join(" + ");
}

/** Small "who sees this" badge text for a preview card: null for Everyone (the common case, no
 * clutter) and Only Me (field is hidden entirely, no badge needed); otherwise the same short
 * label the picker's own collapsed pill shows (e.g. "2nd Degree", "Friends + Family"), so a
 * preview can visibly differentiate every level instead of collapsing them all into show/hide. */
export function visibilityBadgeLabel(value) {
  const { level, circleTypes } = parseVisibilityValue(value);
  if (level === "everyone" || level === "only_me") return null;
  return shortLabelFor(level, circleTypes);
}

export default function ConnectionVisibilityPicker({
  value,
  onChange,
  darkMode,
  disabled = false,
  allowCircleLevel = false,
  allowDegreeLevels = true,
  simple = false,
}) {
  const [degreeModalOpen, setDegreeModalOpen] = useState(false);
  const isHidden = value === "only_me" || !value;
  const { level: currentLevel, circleTypes: currentCircleTypes } = parseVisibilityValue(isHidden ? "everyone" : value);
  const degreeOptions = allowDegreeLevels ? DEGREE_OPTIONS : EVERYONE_ONLY_OPTION;

  const emit = (level, circleTypes) => onChange?.(composeVisibilityValue(level, circleTypes));
  const toggleCircleType = (typeKey) => {
    const next = currentCircleTypes.includes(typeKey) ? currentCircleTypes.filter((t) => t !== typeKey) : [...currentCircleTypes, typeKey];
    emit("specific", next);
  };

  return (
    <>
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          // simple mode (section-level toggles that no longer offer degree/circle granularity -
          // that lives per individual item instead): Visible always resolves straight to
          // Everyone rather than reopening whatever degree/circle level was last set.
          onPress={() => !disabled && emit(simple ? "everyone" : currentLevel, simple ? [] : currentCircleTypes)}
          style={[styles.togglePill, !isHidden && styles.togglePillActiveGreen, disabled && styles.pillDisabled]}
          disabled={disabled}
        >
          <Text style={[styles.togglePillText, !isHidden && styles.togglePillTextActive]}>{!isHidden ? "Visible" : "Show"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => !disabled && onChange?.("only_me")}
          style={[styles.togglePill, isHidden && styles.togglePillActiveRed, disabled && styles.pillDisabled]}
          disabled={disabled}
        >
          <Text style={[styles.togglePillText, isHidden && styles.togglePillTextActive]}>{isHidden ? "Hidden" : "Hide"}</Text>
        </TouchableOpacity>
        {!isHidden && !simple ? (
          <TouchableOpacity
            style={[styles.degreePill, darkMode && styles.degreePillDark]}
            onPress={() => !disabled && setDegreeModalOpen(true)}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Text style={[styles.degreePillText, darkMode && styles.degreePillTextDark]}>{shortLabelFor(currentLevel, currentCircleTypes)}</Text>
            <Ionicons name='chevron-down' size={13} color={darkMode ? "#ddd" : "#555"} style={{ marginLeft: 3 }} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal visible={degreeModalOpen} transparent animationType='fade' onRequestClose={() => setDegreeModalOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setDegreeModalOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.box, darkMode && styles.boxDark]} onPress={() => {}}>
            <Text style={[styles.title, darkMode && styles.titleDark]}>Visible to</Text>
            {degreeOptions.map(({ key, label }) => (
              <TouchableOpacity key={key} style={styles.optionRow} onPress={() => emit(key, [])} activeOpacity={0.7}>
                <Ionicons name={currentLevel === key ? "radio-button-on" : "radio-button-off"} size={18} color={PRIMARY} style={{ marginRight: 10 }} />
                <Text style={[styles.optionText, darkMode && styles.optionTextDark]}>{label}</Text>
              </TouchableOpacity>
            ))}
            {allowCircleLevel ? (
              <>
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => emit("specific", currentCircleTypes)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={currentLevel === "specific" ? "radio-button-on" : "radio-button-off"} size={18} color={PRIMARY} style={{ marginRight: 10 }} />
                  <Text style={[styles.optionText, darkMode && styles.optionTextDark]}>Specific Circles</Text>
                </TouchableOpacity>
                {currentLevel === "specific" ? (
                  <View style={styles.circleTypeGroup}>
                    {CIRCLE_TYPE_OPTIONS.map(({ key, label }) => (
                      <TouchableOpacity key={key} style={styles.optionRow} onPress={() => toggleCircleType(key)} activeOpacity={0.7}>
                        <Ionicons
                          name={currentCircleTypes.includes(key) ? "checkbox" : "square-outline"}
                          size={17}
                          color={PRIMARY}
                          style={{ marginRight: 10 }}
                        />
                        <Text style={[styles.optionText, darkMode && styles.optionTextDark]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
            <TouchableOpacity onPress={() => setDegreeModalOpen(false)} style={styles.doneButton}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  togglePill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "#eee",
    marginLeft: 6,
  },
  togglePillActiveGreen: {
    backgroundColor: "#2e7d32",
  },
  togglePillActiveRed: {
    backgroundColor: "#c62828",
  },
  togglePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  togglePillTextActive: {
    color: "#fff",
  },
  pillDisabled: {
    opacity: 0.5,
  },
  degreePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "#eee",
    marginLeft: 6,
  },
  degreePillDark: {
    backgroundColor: "#444",
  },
  degreePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  degreePillTextDark: {
    color: "#eee",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  box: {
    backgroundColor: "#fff",
    padding: 22,
    borderRadius: 14,
    width: "85%",
  },
  boxDark: {
    backgroundColor: "#333",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  titleDark: {
    color: "#fff",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
  },
  optionText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  optionTextDark: {
    color: "#ddd",
  },
  circleTypeGroup: {
    paddingLeft: 28,
    marginBottom: 2,
  },
  doneButton: {
    marginTop: 16,
    alignSelf: "stretch",
    backgroundColor: PRIMARY,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  doneButtonText: {
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  },
});
