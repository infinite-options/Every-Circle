/**
 * Profile personal privacy: `*_audience` is the source of truth.
 * Do not read `profile_personal_*_is_public` for display gating.
 *
 * Audience: null → Only Me (hidden); { degree, circles } → visible to someone.
 */

export const EVERYONE_AUDIENCE = { degree: "all", circles: [] };

export const PERSONAL_AUDIENCE_KEYS = {
  email: "profile_personal_email_audience",
  phone: "profile_personal_phone_number_audience",
  city: "profile_personal_city_audience",
  state: "profile_personal_state_audience",
  tagLine: "profile_personal_tag_line_audience",
  shortBio: "profile_personal_short_bio_audience",
  image: "profile_personal_image_audience",
  resume: "profile_personal_resume_audience",
  experience: "profile_personal_experience_audience",
  education: "profile_personal_education_audience",
  expertise: "profile_personal_expertise_audience",
  wishes: "profile_personal_wishes_audience",
  business: "profile_personal_business_audience",
  social: "profile_personal_social_audience",
};

/** True when audience means visible to someone (not Only Me). */
export function isAudienceVisible(audience) {
  if (audience == null || audience === "" || audience === "null") return false;
  let parsed = audience;
  if (typeof audience === "string") {
    try {
      parsed = JSON.parse(audience);
    } catch {
      return false;
    }
  }
  if (parsed == null) return false;
  if (typeof parsed !== "object" || Array.isArray(parsed)) return false;
  return true;
}

function pickAudienceSource(source) {
  if (!source || typeof source !== "object") return {};
  if (source.personal_info && typeof source.personal_info === "object") {
    return { ...source, ...source.personal_info };
  }
  return source;
}

/** True when `source` has the audience key and it is not Only Me. */
export function isPersonalAudienceFieldVisible(source, audienceKey) {
  const p = pickAudienceSource(source);
  if (!audienceKey || !Object.prototype.hasOwnProperty.call(p, audienceKey)) return false;
  return isAudienceVisible(p[audienceKey]);
}

/**
 * Resolve a display flag: audience on the object wins; otherwise an already-mapped
 * boolean/1/"1" prop (from a caller that derived audience). Never reads *_is_public.
 */
export function resolvePersonalDisplayFlag(explicitProp, source, audienceKey) {
  const p = pickAudienceSource(source);
  if (audienceKey && Object.prototype.hasOwnProperty.call(p, audienceKey)) {
    return isAudienceVisible(p[audienceKey]);
  }
  if (explicitProp !== undefined && explicitProp !== null) {
    return explicitProp === true || explicitProp === 1 || explicitProp === "1" || explicitProp === "true";
  }
  return false;
}

/** City/state: visible if either audience is not Only Me. */
export function isPersonalLocationAudienceVisible(source) {
  const p = pickAudienceSource(source);
  const hasCity = Object.prototype.hasOwnProperty.call(p, PERSONAL_AUDIENCE_KEYS.city);
  const hasState = Object.prototype.hasOwnProperty.call(p, PERSONAL_AUDIENCE_KEYS.state);
  if (hasCity || hasState) {
    return (
      (hasCity && isAudienceVisible(p[PERSONAL_AUDIENCE_KEYS.city])) ||
      (hasState && isAudienceVisible(p[PERSONAL_AUDIENCE_KEYS.state]))
    );
  }
  return false;
}

/** Location display flag: audience on city/state wins; else flattened prop. */
export function resolveLocationDisplayFlag(explicitProp, source) {
  const p = pickAudienceSource(source);
  const hasCity = Object.prototype.hasOwnProperty.call(p, PERSONAL_AUDIENCE_KEYS.city);
  const hasState = Object.prototype.hasOwnProperty.call(p, PERSONAL_AUDIENCE_KEYS.state);
  if (hasCity || hasState) {
    return isPersonalLocationAudienceVisible(p);
  }
  if (explicitProp !== undefined && explicitProp !== null) {
    return explicitProp === true || explicitProp === 1 || explicitProp === "1" || explicitProp === "true";
  }
  return false;
}

/**
 * Flattened MiniCard-style flags derived only from `*_audience`.
 * Location uses city/state audiences (no location_audience column).
 */
export function getPersonalDisplayFlags(source) {
  const p = pickAudienceSource(source);
  return {
    emailIsPublic: isPersonalAudienceFieldVisible(p, PERSONAL_AUDIENCE_KEYS.email),
    phoneIsPublic: isPersonalAudienceFieldVisible(p, PERSONAL_AUDIENCE_KEYS.phone),
    tagLineIsPublic: isPersonalAudienceFieldVisible(p, PERSONAL_AUDIENCE_KEYS.tagLine),
    imageIsPublic: isPersonalAudienceFieldVisible(p, PERSONAL_AUDIENCE_KEYS.image),
    locationIsPublic: isPersonalLocationAudienceVisible(p),
    shortBioIsPublic: isPersonalAudienceFieldVisible(p, PERSONAL_AUDIENCE_KEYS.shortBio),
    experienceIsPublic: isPersonalAudienceFieldVisible(p, PERSONAL_AUDIENCE_KEYS.experience),
    educationIsPublic: isPersonalAudienceFieldVisible(p, PERSONAL_AUDIENCE_KEYS.education),
    expertiseIsPublic: isPersonalAudienceFieldVisible(p, PERSONAL_AUDIENCE_KEYS.expertise),
    wishesIsPublic: isPersonalAudienceFieldVisible(p, PERSONAL_AUDIENCE_KEYS.wishes),
    businessIsPublic: isPersonalAudienceFieldVisible(p, PERSONAL_AUDIENCE_KEYS.business),
    socialLinksIsPublic: isPersonalAudienceFieldVisible(p, PERSONAL_AUDIENCE_KEYS.social),
  };
}

/** FormData / JSON body value for an audience field. */
export function audienceJsonForForm(audience) {
  return JSON.stringify(audience == null ? null : audience);
}
