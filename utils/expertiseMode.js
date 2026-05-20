/**
 * Offering (expertise) delivery mode: optional Virtual and/or In-Person.
 * Stored as a single string on profile_expertise_mode.
 */

/** Canonical value when both modes apply (matches product copy). */
export const EXPERTISE_MODE_BOTH_LABEL = "Virtual or In-Person";

/**
 * Parse stored profile_expertise_mode into flags (supports legacy single values).
 * @param {string|null|undefined} modeStr
 * @returns {{ virtual: boolean, inPerson: boolean }}
 */
export function parseExpertiseModeFlags(modeStr) {
  const raw = String(modeStr ?? "").trim();
  if (!raw) return { virtual: false, inPerson: false };

  const lower = raw.toLowerCase();
  if (lower === "virtual or in-person" || lower === "virtual and in-person") {
    return { virtual: true, inPerson: true };
  }
  if (lower === "virtual") return { virtual: true, inPerson: false };
  if (lower === "in-person" || lower === "in person") return { virtual: false, inPerson: true };

  const hasVirtual = /\bvirtual\b/i.test(raw);
  const hasInPerson = /in-?\s*person/i.test(raw);
  if (hasVirtual && hasInPerson) return { virtual: true, inPerson: true };
  if (hasVirtual) return { virtual: true, inPerson: false };
  if (hasInPerson) return { virtual: false, inPerson: true };
  return { virtual: false, inPerson: false };
}

/**
 * Serialize flags to the string persisted on profile_expertise_mode.
 * @param {{ virtual?: boolean, inPerson?: boolean }} flags
 * @returns {string}
 */
export function serializeExpertiseMode(flags) {
  const v = !!flags?.virtual;
  const ip = !!flags?.inPerson;
  if (v && ip) return EXPERTISE_MODE_BOTH_LABEL;
  if (v) return "Virtual";
  if (ip) return "In-Person";
  return "";
}

/**
 * Human-readable label for profile/search UI.
 * @param {string|null|undefined} modeStr
 * @returns {string}
 */
export function formatExpertiseModeForDisplay(modeStr) {
  return serializeExpertiseMode(parseExpertiseModeFlags(modeStr));
}

/** Ionicons names for the mode row (one or two icons). */
export function getExpertiseModeIoniconNames(modeStr) {
  const { virtual, inPerson } = parseExpertiseModeFlags(modeStr);
  if (virtual && inPerson) return ["videocam-outline", "people-outline"];
  if (virtual) return ["videocam-outline"];
  if (inPerson) return ["people-outline"];
  return [];
}
