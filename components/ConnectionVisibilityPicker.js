// ConnectionVisibilityPicker.js
// Per-field "who can see this" control for Edit Profile: the classic
// Visible/Hidden pills, plus - only while Visible is selected - a small
// secondary picker to narrow "Visible" down. Two independent, combinable
// checkbox filters live there: a circle-degree set (see
// utils/profilePathConnectionDegree.js / the "Level N Connection" concept
// shown elsewhere in the app - pick any mix of 1st/2nd/3rd, e.g. 1st + 3rd
// while skipping 2nd) and, where `allowCircleLevel` is set (personal-info
// fields and individual offering/seeking items), an optional circle-
// relationship filter (Friends/Colleagues/Family - same categories Messages
// Privacy and Nearby Location Privacy already use). Picking both ANDs them
// together, e.g. "2nd Degree" + "Family" = 2nd-degree connections who are
// also tagged Family. Either can also be picked on its own - a circle filter
// with no degree cap (any degree, just tagged Family) is valid, and so is a
// degree cap with no circle filter. "Everyone" is its own checkbox, fully
// exclusive of both: picking it clears any degree/circle selection (no
// restriction at all), and picking a degree or a circle - either one -
// clears Everyone in turn. Hidden always means only_me; Visible defaults to
// Everyone.
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const PRIMARY = "#4B2E83";
const VISIBLE_GREEN = "#2e7d32"; // same shade as the Visible pill

const DEGREE_OPTIONS = [
  { key: 1, label: "1st Degree Connections" },
  { key: 2, label: "2nd Degree Connections" },
  { key: 3, label: "3rd Degree Connections" },
];

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

/** Split a picker value into { level, degrees, circleTypes }. `level` is "only_me" | "everyone"
 * (nothing restricted at all) | "restricted" (a degree set and/or a circle filter is active - see
 * `degrees`/`circleTypes`; either can be picked without the other, e.g. circles alone with no
 * degree cap). Handles the current "<head>:<circlesCsv>" encoding, where <head> is
 * "everyone"/"only_me"/"specific" (legacy) or a CSV of exact degree numbers like "1,3"; also
 * expands an older single cumulative value (e.g. "degree2") into the equivalent explicit set
 * ([1,2]) for editing. */
export function parseVisibilityValue(value) {
  if (typeof value !== "string" || !value) return { level: "everyone", degrees: [], circleTypes: [] };
  const sep = value.indexOf(":");
  const head = sep === -1 ? value : value.slice(0, sep);
  const circleTypes = sep === -1 ? [] : value.slice(sep + 1).split(",").filter(Boolean);

  if (head === "only_me") return { level: "only_me", degrees: [], circleTypes: [] };

  let degrees = [];
  if (head !== "everyone" && head !== "specific") {
    const legacyMatch = /^degree([123])$/.exec(head);
    degrees = legacyMatch
      ? Array.from({ length: Number(legacyMatch[1]) }, (_, i) => i + 1)
      : head.split(",").map((d) => Number(d.trim())).filter((n) => n === 1 || n === 2 || n === 3);
  }
  const level = degrees.length > 0 || circleTypes.length > 0 ? "restricted" : "everyone";
  return { level, degrees, circleTypes };
}

/** Inverse of parseVisibilityValue - build the single string this picker stores/emits. `level`
 * only matters for "only_me"; otherwise the encoded head is derived straight from `degrees`
 * (falling back to "everyone" - no degree cap - when empty, circles alone included). */
export function composeVisibilityValue(level, degrees, circleTypes) {
  const head = level === "only_me" ? "only_me" : degrees && degrees.length > 0 ? [...new Set(degrees)].sort().join(",") : "everyone";
  if (circleTypes && circleTypes.length > 0) return `${head}:${circleTypes.join(",")}`;
  return head;
}

/** Read `<prefix>_visibility` (+ `<prefix>_visibility_circles` and `<prefix>_visibility_degrees`,
 * ANDed on top when present) off a personal_info-shaped object into this picker's single
 * composite value, falling back to the legacy `<prefix>_is_public` boolean for profiles saved
 * before this feature existed. `degreesKey` is optional - omit for fields whose picker doesn't
 * offer degree checkboxes; the raw enum's legacy cumulative value (e.g. "degree2") is still
 * expanded to an equivalent explicit set ([1,2]) when no degrees CSV has been saved yet. */
export function resolveVisibilityLevel(personalInfo, visibilityKey, isPublicKey, circlesKey, degreesKey) {
  const raw = personalInfo?.[visibilityKey];
  const isKnownLevel = raw === "specific" || raw === "everyone" || raw === "only_me" || /^degree[123]$/.test(raw || "");
  if (!isKnownLevel) return visibilityFromIsPublic(personalInfo?.[isPublicKey] === 1);
  if (raw === "only_me") return "only_me";

  const circleTypes = circlesKey ? (personalInfo?.[circlesKey] || "").split(",").filter(Boolean) : [];
  const degreesCsv = degreesKey ? personalInfo?.[degreesKey] || "" : "";
  let degrees;
  if (degreesCsv) {
    degrees = degreesCsv
      .split(",")
      .map((d) => Number(d.trim()))
      .filter((n) => n === 1 || n === 2 || n === 3);
  } else if (raw === "everyone" || raw === "specific") {
    degrees = [];
  } else {
    const n = Number(raw.slice(-1));
    degrees = Array.from({ length: n }, (_, i) => i + 1);
  }
  return composeVisibilityValue("everyone", degrees, circleTypes);
}

function shortLabelFor(degrees, circleTypes) {
  const hasDegrees = degrees && degrees.length > 0;
  const hasCircles = circleTypes && circleTypes.length > 0;
  if (!hasDegrees && !hasCircles) return "Everyone";
  const degreeLabel = hasDegrees ? degrees.map((d) => `${d}${d === 1 ? "st" : d === 2 ? "nd" : "rd"}`).join("+") + " Degree" : null;
  const circleLabel = hasCircles
    ? circleTypes.length === 1
      ? CIRCLE_TYPE_LABEL[circleTypes[0]] || "Circles"
      : circleTypes.map((t) => CIRCLE_TYPE_LABEL[t]).filter(Boolean).join(" + ")
    : null;
  return degreeLabel && circleLabel ? `${degreeLabel} · ${circleLabel}` : degreeLabel || circleLabel;
}

/** Small "who sees this" badge text for a preview card: null only for the fully-public state
 * (Everyone, no circle filter) and Only Me (field is hidden entirely); otherwise the same short
 * label the picker's own collapsed pill shows (e.g. "2nd Degree", "1st+3rd Degree · Family",
 * "Family" alone with no degree cap). */
export function visibilityBadgeLabel(value) {
  const { level, degrees, circleTypes } = parseVisibilityValue(value);
  if (level === "only_me" || level === "everyone") return null;
  return shortLabelFor(degrees, circleTypes);
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
  const { level: currentLevel, degrees: currentDegrees, circleTypes: currentCircleTypes } = parseVisibilityValue(isHidden ? "everyone" : value);

  const emit = (degrees, circleTypes) => onChange?.(composeVisibilityValue("everyone", degrees, circleTypes));
  const isEveryone = currentLevel === "everyone"; // both degrees and circleTypes empty
  // Everyone is exclusive of any restriction: picking it clears degrees AND circles. Picking a
  // degree or a circle - either one, independently, neither requires the other - moves away from
  // Everyone automatically (it's just whatever's left empty).
  const selectEveryone = () => emit([], []);
  const toggleDegree = (n) => {
    const next = currentDegrees.includes(n) ? currentDegrees.filter((d) => d !== n) : [...currentDegrees, n];
    emit(next, currentCircleTypes);
  };
  const toggleCircleType = (typeKey) => {
    const next = currentCircleTypes.includes(typeKey) ? currentCircleTypes.filter((t) => t !== typeKey) : [...currentCircleTypes, typeKey];
    emit(currentDegrees, next);
  };

  return (
    <>
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          // simple mode (fields that no longer offer degree/circle granularity at all): Visible
          // always resolves straight to Everyone rather than reopening whatever level was last set.
          onPress={() => !disabled && emit(simple ? [] : currentDegrees, simple ? [] : currentCircleTypes)}
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
            <Text style={[styles.degreePillText, darkMode && styles.degreePillTextDark]}>{shortLabelFor(currentDegrees, currentCircleTypes)}</Text>
            <Ionicons name='chevron-down' size={13} color='#fff' style={{ marginLeft: 3 }} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal visible={degreeModalOpen} transparent animationType='fade' onRequestClose={() => setDegreeModalOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setDegreeModalOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.box, darkMode && styles.boxDark]} onPress={() => {}}>
            <Text style={[styles.title, darkMode && styles.titleDark]}>Visible to</Text>
            <TouchableOpacity style={styles.optionRow} onPress={selectEveryone} activeOpacity={0.7}>
              <Ionicons name={isEveryone ? "checkbox" : "square-outline"} size={17} color={PRIMARY} style={{ marginRight: 10 }} />
              <Text style={[styles.optionText, darkMode && styles.optionTextDark]}>Everyone</Text>
            </TouchableOpacity>
            {allowDegreeLevels
              ? DEGREE_OPTIONS.map(({ key, label }) => (
                  <TouchableOpacity key={key} style={styles.optionRow} onPress={() => toggleDegree(key)} activeOpacity={0.7}>
                    <Ionicons
                      name={currentDegrees.includes(key) ? "checkbox" : "square-outline"}
                      size={17}
                      color={PRIMARY}
                      style={{ marginRight: 10 }}
                    />
                    <Text style={[styles.optionText, darkMode && styles.optionTextDark]}>{label}</Text>
                  </TouchableOpacity>
                ))
              : null}
            {allowCircleLevel ? (
              <>
                <View style={[styles.divider, darkMode && styles.dividerDark]} />
                <Text style={[styles.groupLabel, darkMode && styles.groupLabelDark]}>Limit Specific Circles</Text>
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
    backgroundColor: VISIBLE_GREEN,
    marginLeft: 6,
  },
  degreePillDark: {
    backgroundColor: VISIBLE_GREEN,
  },
  degreePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  degreePillTextDark: {
    color: "#fff",
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
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    marginTop: 10,
    marginBottom: 8,
  },
  dividerDark: {
    borderBottomColor: "#555",
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#555",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  groupLabelDark: {
    color: "#ccc",
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
