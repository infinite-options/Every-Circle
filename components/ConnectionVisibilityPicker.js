// ConnectionVisibilityPicker.js
// Per-field "who can see this" control for Edit Profile: Hide plus a combined
// "Visible: <audience>" pill (opens the audience picker). Simple mode keeps a
// plain Visible/Hide toggle with no audience dropdown.
//
// Audience model (POST/PUT profile_personal_*_audience):
//   null  → Only Me
//   { degree: "all" | 1 | 2 | 3, circles: string[] }
// degree "all" = Everyone (no hop-distance limit)
// degree N = visible to connections at hop distance <= N (cumulative)
// circles [] / omit = no circle filter; non-empty ANDs with degree
// (viewer must be tagged friend | family | colleague).
//
// Internal picker value remains a compact string ("only_me" | "everyone" |
// "2" | "2:friend,family") so existing form state keeps working. For personal
// audience fields, degree options are single-select ("Level N or closer").
// Item-level offering/seeking can still use multi-select degrees via
// `allowMultiDegree`. Circle chips are optional multi-select. "Everyone"
// clears any degree. Circles alone with no degree map to
// { degree: "all", circles: [...] }.
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const PRIMARY = "#4B2E83";
const VISIBLE_GREEN = "#2e7d32"; // same shade as the Visible pill

const DEGREE_OPTIONS_CUMULATIVE = [
  { key: 1, label: "Level 1 or closer" },
  { key: 2, label: "Level 2 or closer" },
  { key: 3, label: "Level 3 or closer" },
];

const DEGREE_OPTIONS_MULTI = [
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
 * (nothing restricted at all) | "restricted" (a degree set and/or a circle filter is active).
 * Handles "<head>:<circlesCsv>" encoding; expands an older cumulative "degree2" into [1,2]
 * for multi-degree editing (item-level), or callers may take Math.max for audience. */
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
      : head
          .split(",")
          .map((d) => Number(d.trim()))
          .filter((n) => n === 1 || n === 2 || n === 3);
  }
  const level = degrees.length > 0 || circleTypes.length > 0 ? "restricted" : "everyone";
  return { level, degrees, circleTypes };
}

/** Inverse of parseVisibilityValue - build the single string this picker stores/emits. */
export function composeVisibilityValue(level, degrees, circleTypes) {
  const head = level === "only_me" ? "only_me" : degrees && degrees.length > 0 ? [...new Set(degrees)].sort().join(",") : "everyone";
  if (circleTypes && circleTypes.length > 0) return `${head}:${circleTypes.join(",")}`;
  return head;
}

/** Convert an *_audience API value (object, JSON string, or null) into the picker string. */
export function audienceToVisibilityValue(audience) {
  if (audience == null || audience === "" || audience === "null") return "only_me";
  let parsed = audience;
  if (typeof audience === "string") {
    try {
      parsed = JSON.parse(audience);
    } catch {
      return "everyone";
    }
  }
  if (parsed == null) return "only_me";
  if (typeof parsed !== "object" || Array.isArray(parsed)) return "everyone";

  const circles = Array.isArray(parsed.circles)
    ? parsed.circles.map((c) => String(c).trim()).filter((c) => c === "friend" || c === "family" || c === "colleague")
    : [];

  const deg = parsed.degree;
  if (deg === "all" || deg == null || deg === "") {
    return composeVisibilityValue("everyone", [], circles);
  }
  const n = Number(deg);
  if (n === 1 || n === 2 || n === 3) {
    // Audience degree N is cumulative; store as a single max for the Level-N picker.
    return composeVisibilityValue("everyone", [n], circles);
  }
  return composeVisibilityValue("everyone", [], circles);
}

/** Convert a picker string into an *_audience payload value (null or { degree, circles }). */
export function visibilityValueToAudience(value) {
  const { level, degrees, circleTypes } = parseVisibilityValue(value);
  if (level === "only_me") return null;
  return {
    degree: degrees.length > 0 ? Math.max(...degrees) : "all",
    circles: circleTypes || [],
  };
}

/**
 * Read `profile_personal_*_audience` into the picker string.
 * Audience is the only source of truth (null / missing → Only Me).
 * Does not read `*_is_public`.
 */
export function resolveAudienceLevel(personalInfo, audienceKey) {
  if (personalInfo && Object.prototype.hasOwnProperty.call(personalInfo, audienceKey)) {
    return audienceToVisibilityValue(personalInfo[audienceKey]);
  }
  return "only_me";
}

/** Legacy: read `<prefix>_visibility` (+ circles/degrees) for item-level expertise/wish fields. */
export function resolveVisibilityLevel(personalInfo, visibilityKey, isPublicKey, circlesKey, degreesKey) {
  const raw = personalInfo?.[visibilityKey];
  const isKnownLevel = raw === "specific" || raw === "everyone" || raw === "only_me" || /^degree[123]$/.test(raw || "");
  if (!isKnownLevel) {
    return visibilityFromIsPublic(
      personalInfo?.[isPublicKey] === 1 || personalInfo?.[isPublicKey] === "1" || personalInfo?.[isPublicKey] === true
    );
  }
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

function shortLabelFor(degrees, circleTypes, { cumulative = true } = {}) {
  const hasDegrees = degrees && degrees.length > 0;
  const hasCircles = circleTypes && circleTypes.length > 0;
  if (!hasDegrees && !hasCircles) return "Everyone";
  let degreeLabel = null;
  if (hasDegrees) {
    if (cumulative) {
      degreeLabel = `Level ${Math.max(...degrees)} or closer`;
    } else {
      degreeLabel = degrees.map((d) => `${d}${d === 1 ? "st" : d === 2 ? "nd" : "rd"}`).join("+") + " Degree";
    }
  }
  const circleLabel = hasCircles
    ? circleTypes.length === 1
      ? CIRCLE_TYPE_LABEL[circleTypes[0]] || "Circles"
      : circleTypes.map((t) => CIRCLE_TYPE_LABEL[t]).filter(Boolean).join(" + ")
    : null;
  return degreeLabel && circleLabel ? `${degreeLabel} · ${circleLabel}` : degreeLabel || circleLabel;
}

/** Small "who sees this" badge text for a preview card: null for Everyone / Only Me. */
export function visibilityBadgeLabel(value, options) {
  const { level, degrees, circleTypes } = parseVisibilityValue(value);
  if (level === "only_me" || level === "everyone") return null;
  return shortLabelFor(degrees, circleTypes, options);
}

export default function ConnectionVisibilityPicker({
  value,
  onChange,
  darkMode,
  disabled = false,
  allowCircleLevel = false,
  allowDegreeLevels = true,
  /** When true (offering/seeking items), degrees are multi-select. Personal audience uses single cumulative Level N. */
  allowMultiDegree = false,
  simple = false,
}) {
  const [degreeModalOpen, setDegreeModalOpen] = useState(false);
  const isHidden = value === "only_me" || !value;
  const { level: currentLevel, degrees: currentDegrees, circleTypes: currentCircleTypes } = parseVisibilityValue(isHidden ? "everyone" : value);

  const emit = (degrees, circleTypes) => onChange?.(composeVisibilityValue("everyone", degrees, circleTypes));
  const isEveryone = currentLevel === "everyone"; // both degrees and circleTypes empty
  const selectedDegree = currentDegrees.length > 0 ? Math.max(...currentDegrees) : null;
  const degreeOptions = allowMultiDegree ? DEGREE_OPTIONS_MULTI : DEGREE_OPTIONS_CUMULATIVE;

  const selectEveryone = () => emit([], []);
  const selectDegree = (n) => {
    emit([n], currentCircleTypes);
  };
  const toggleDegree = (n) => {
    const next = currentDegrees.includes(n) ? currentDegrees.filter((d) => d !== n) : [...currentDegrees, n];
    emit(next, currentCircleTypes);
  };
  const toggleCircleType = (typeKey) => {
    const next = currentCircleTypes.includes(typeKey) ? currentCircleTypes.filter((t) => t !== typeKey) : [...currentCircleTypes, typeKey];
    emit(currentDegrees, next);
  };

  const audienceSummary = shortLabelFor(currentDegrees, currentCircleTypes, { cumulative: !allowMultiDegree });
  const visiblePillLabel = simple || isHidden ? (!isHidden ? "Visible" : "Show") : `Visible: ${audienceSummary}`;

  return (
    <>
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          // simple mode: Visible always resolves straight to Everyone.
          // Full mode: combined Visible+audience pill opens the audience picker.
          onPress={() => {
            if (disabled) return;
            if (simple) {
              emit([], []);
              return;
            }
            if (isHidden) {
              emit(currentDegrees, currentCircleTypes);
            }
            setDegreeModalOpen(true);
          }}
          style={[
            styles.togglePill,
            !isHidden && (simple ? styles.togglePillActiveGreen : styles.degreePill),
            disabled && styles.pillDisabled,
          ]}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.togglePillText,
              !isHidden && styles.togglePillTextActive,
              !isHidden && !simple && styles.degreePillText,
            ]}
            numberOfLines={1}
          >
            {visiblePillLabel}
          </Text>
          {!isHidden && !simple ? (
            <Ionicons name='chevron-down' size={13} color='#fff' style={{ marginLeft: 3 }} />
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => !disabled && onChange?.("only_me")}
          style={[styles.togglePill, isHidden && styles.togglePillActiveRed, disabled && styles.pillDisabled]}
          disabled={disabled}
        >
          <Text style={[styles.togglePillText, isHidden && styles.togglePillTextActive]}>{isHidden ? "Hidden" : "Hide"}</Text>
        </TouchableOpacity>
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
              ? degreeOptions.map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    style={styles.optionRow}
                    onPress={() => (allowMultiDegree ? toggleDegree(key) : selectDegree(key))}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={
                        (allowMultiDegree ? currentDegrees.includes(key) : selectedDegree === key) ? "checkbox" : "square-outline"
                      }
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
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "#eee",
    marginLeft: 6,
    maxWidth: 260,
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
