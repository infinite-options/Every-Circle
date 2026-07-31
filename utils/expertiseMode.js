/**
 * Offering / seeking delivery modes: optional Virtual, Delivered, and/or In-Person.
 * Stored as a comma-separated string on profile_expertise_mode / profile_wish_mode.
 */

/** @deprecated Legacy combined label; still parsed for older rows. */
export const EXPERTISE_MODE_BOTH_LABEL = "Virtual or In-Person";

export const EXPERTISE_MODE_VIRTUAL_LABEL = "Virtual";
export const EXPERTISE_MODE_DELIVERED_LABEL = "Delivered";
export const EXPERTISE_MODE_IN_PERSON_LABEL = "In-Person";

const MODE_ORDER = [
  ["virtual", EXPERTISE_MODE_VIRTUAL_LABEL],
  ["delivered", EXPERTISE_MODE_DELIVERED_LABEL],
  ["inPerson", EXPERTISE_MODE_IN_PERSON_LABEL],
];

/**
 * Parse stored mode string into flags (supports legacy single/combined values).
 * @param {string|null|undefined} modeStr
 * @returns {{ virtual: boolean, delivered: boolean, inPerson: boolean }}
 */
export function parseExpertiseModeFlags(modeStr) {
  const raw = String(modeStr ?? "").trim();
  if (!raw) return { virtual: false, delivered: false, inPerson: false };

  const lower = raw.toLowerCase();
  if (lower === "virtual or in-person" || lower === "virtual and in-person") {
    return { virtual: true, delivered: false, inPerson: true };
  }
  if (lower === "virtual") return { virtual: true, delivered: false, inPerson: false };
  if (lower === "in-person" || lower === "in person") return { virtual: false, delivered: false, inPerson: true };
  if (lower === "delivered" || lower === "delivery") return { virtual: false, delivered: true, inPerson: false };

  const hasVirtual = /\bvirtual\b/i.test(raw);
  const hasDelivered = /\bdeliver(ed|y)\b/i.test(raw);
  const hasInPerson = /in-?\s*person/i.test(raw);
  return {
    virtual: hasVirtual,
    delivered: hasDelivered,
    inPerson: hasInPerson,
  };
}

/**
 * Serialize flags to the string persisted on profile_expertise_mode / profile_wish_mode.
 * @param {{ virtual?: boolean, delivered?: boolean, inPerson?: boolean }} flags
 * @returns {string}
 */
export function serializeExpertiseMode(flags) {
  const parts = [];
  for (const [key, label] of MODE_ORDER) {
    if (flags?.[key]) parts.push(label);
  }
  return parts.join(", ");
}

/**
 * Human-readable label for profile/search UI.
 * @param {string|null|undefined} modeStr
 * @returns {string}
 */
export function formatExpertiseModeForDisplay(modeStr) {
  return serializeExpertiseMode(parseExpertiseModeFlags(modeStr));
}

/** Ionicons names for the mode row (one icon per active mode). */
export function getExpertiseModeIoniconNames(modeStr) {
  const { virtual, delivered, inPerson } = parseExpertiseModeFlags(modeStr);
  const icons = [];
  if (virtual) icons.push("videocam-outline");
  if (delivered) icons.push("car-outline");
  if (inPerson) icons.push("people-outline");
  return icons;
}

/** Count of active modes on an offering/seeking row. */
export function countExpertiseModes(modeStr) {
  const flags = parseExpertiseModeFlags(modeStr);
  return Number(flags.virtual) + Number(flags.delivered) + Number(flags.inPerson);
}
