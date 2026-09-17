/**
 * Email format checks for login/signup.
 * - Allows known 2-letter TLDs (.io, .me, country codes, …)
 * - Allows normal 3+ letter TLDs (.com, .org, …)
 * - Blocks common misspellings (.con, .cmo, …)
 */

/** Two-letter TLDs we accept (ccTLDs + popular generics). */
const ALLOWED_TWO_LETTER_TLDS = new Set(
  [
    // Popular short generics / brands
    "io",
    "me",
    "ai",
    "tv",
    "co",
    "fm",
    "am",
    "gg",
    "to",
    "so",
    "ly",
    "cc",
    "ws",
    "nu",
    // Common country codes (ISO 3166-1 alpha-2 subset people actually use in email)
    "us",
    "uk",
    "de",
    "fr",
    "it",
    "nl",
    "ca",
    "au",
    "jp",
    "in",
    "ch",
    "se",
    "no",
    "dk",
    "be",
    "at",
    "pl",
    "cz",
    "ie",
    "nz",
    "sg",
    "hk",
    "tw",
    "kr",
    "mx",
    "br",
    "ar",
    "cl",
    "pe",
    "ph",
    "th",
    "vn",
    "id",
    "my",
    "za",
    "ae",
    "il",
    "ru",
    "ua",
    "es",
    "pt",
    "fi",
    "gr",
    "ro",
    "hu",
    "sk",
    "bg",
    "hr",
    "lt",
    "lv",
    "ee",
    "is",
    "lu",
    "mt",
    "cy",
    "tr",
    "sa",
    "qa",
    "kw",
    "bh",
    "eg",
    "ng",
    "ke",
    "gh",
    "cn",
    "pk",
    "bd",
    "lk",
    "np",
  ].map((t) => t.toLowerCase()),
);

/** Common TLD typos that should never pass client validation. */
const BLOCKED_TLD_TYPOS = new Set(
  [
    "con", // com
    "cmo",
    "ocm",
    "om", // com (missing c)
    "comm",
    "coom",
    "comn",
    "vom",
    "xom",
    "nett", // net
    "nte",
    "ent",
    "ogr", // org
    "gro",
    "rog",
    "orgg",
    "eddu", // edu
    "edi",
    "goc", // gov
    "gvo",
    "cim", // com again
    "coma",
    "coml",
  ].map((t) => t.toLowerCase()),
);

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Rightmost label after the final dot (e.g. user@foo.co.uk → uk). */
export function emailTld(email) {
  const trimmed = String(email || "").trim();
  const at = trimmed.lastIndexOf("@");
  if (at < 0) return "";
  const domain = trimmed.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  if (dot < 0 || dot === domain.length - 1) return "";
  return domain.slice(dot + 1).toLowerCase();
}

/**
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  const trimmed = String(email || "").trim();
  if (!trimmed || !EMAIL_SHAPE.test(trimmed)) return false;

  const tld = emailTld(trimmed);
  if (!tld || !/^[a-z]+$/i.test(tld)) return false;
  if (BLOCKED_TLD_TYPOS.has(tld)) return false;

  if (tld.length === 2) {
    return ALLOWED_TWO_LETTER_TLDS.has(tld);
  }

  // Normal TLDs are 3+ letters (.com, .info, .museum, …)
  return tld.length >= 3 && tld.length <= 24;
}
