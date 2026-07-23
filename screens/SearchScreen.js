// SearchScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sanitizeEmptyStrings } from "../utils/endpointDataChecker";
import {
  BUSINESS_RESULTS_ENDPOINT,
  EXPERTISE_RESULTS_ENDPOINT,
  WISHES_RESULTS_ENDPOINT,
  TAG_SEARCH_DISTINCT_ENDPOINT,
  TAG_CATEGORY_DISTINCT_ENDPOINT,
  SEARCH_BASE_URL,
  SEARCH_GLOBAL_ENDPOINT,
  SEARCH_RESULT_LIMIT,
  BUSINESS_DETAILS_ENDPOINT,
  PROFILE_CONNECTION_DEGREES_ENDPOINT,
  // BUSINESS_TAG_SEARCH_ENDPOINT, // disabled for testing without businesstagsearch
  BUSINESS_INFO_ENDPOINT,
  USER_PROFILE_INFO_ENDPOINT,
  PROFILE_WISH_INFO_ENDPOINT,
  PROFILE_WISH_RESPONSE_ENDPOINT,
} from "../apiConfig";
import { fetchMiddleware as fetch } from "../utils/httpMiddleware";
import { fetchMyOfferingMessageResponses } from "../utils/offeringMessageResponse";
import { useDarkMode } from "../contexts/DarkModeContext";
import FeedbackPopup from "../components/FeedbackPopup";
import { isOfferingModeratedBlocked } from "../utils/offeringModeration";
import { isSeekingModeratedBlocked } from "../utils/seekingModeration";
import { isProfileVisibilityBlocked } from "../utils/profileModeration";
import { getHeaderColors } from "../config/headerColors";
import { isWishEnded } from "../utils/wishUtils";
import { formatExpertiseModeForDisplay, getExpertiseModeIoniconNames } from "../utils/expertiseMode";
import { parseCoordinateValue } from "../utils/validateCoordinates";
import { fetchSearchSuggestions, SEARCH_SUGGEST_MIN_LENGTH } from "../utils/searchSuggestions";
import MiniCard from "../components/MiniCard";
import MicroCard from "../components/MicroCard";
import ProfileSectionItemImage from "../components/ProfileSectionItemImage";
import SeekingCardDetails from "../components/SeekingCardDetails";
import OfferingCardDetails from "../components/OfferingCardDetails";
import { resolveProfileItemImageUri } from "../utils/resolveProfileItemImageUri";
import { mapBusinessToMiniCard, mapBusinessToMicroCard } from "../utils/mapBusinessToMiniCard";
import { searchBusinessLocationFieldsFromApi, searchResultsToMapBusinesses } from "../utils/searchResultsToMapBusinesses";
import { searchResultsToMapProfiles } from "../utils/searchResultsToMapProfiles";
import { searchReferralProfiles, loadReferralNetworkByUid, mapReferralProfileToSearchItem, enrichSearchItemsWithReferralRelationships } from "../utils/searchReferralProfiles";
import {
  SEARCH_LOCATION_HOME,
  SEARCH_LOCATION_CUSTOM,
  MAJOR_US_SEARCH_CITIES,
  resolveSearchLocationCoords,
  getSearchLocationFilterLabel,
  getSearchLocationFullLabel,
  buildCustomSearchCity,
  isNonHomeSearchLocation,
} from "../utils/searchLocationOptions";
import { getCitySuggestions, getPlaceDetails } from "../utils/googlePlaces";
import { sanitizeText, isSafeForConditional } from "../utils/textSanitizer";
import { SHOW_NETWORK_DEBUG_UI, SETTINGS_NETWORK_DEBUG_MODE_KEY } from "../config/networkDebug";
/** Matches 💰 bounty indicator: same emoji with a slash for “no bounty”. `muted` = grayed (e.g. no products / inactive bounty from API). */
function NoBountyIcon({ darkMode, muted }) {
  return (
    <View
      style={[styles.noBountyIconWrap, muted && styles.noBountyIconWrapMuted, darkMode && muted && styles.darkNoBountyIconWrapMuted]}
      accessibilityLabel={muted ? "No products or bounty" : "No bounty"}
    >
      <Text style={styles.noBountyEmoji}>💰</Text>
      <View
        pointerEvents='none'
        style={[styles.noBountySlash, darkMode && !muted && styles.darkNoBountySlash, muted && styles.noBountySlashMuted, darkMode && muted && styles.darkNoBountySlashMuted]}
      />
    </View>
  );
}

/** Normalize API bounty fields: "", null, NaN, or non‑positive → null so results row shows NoBountyIcon. */
function parseSearchMaxBounty(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/[$,]/g, "");
  if (s === "") return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function resolveBusinessUid(item) {
  const uid = item?.business_uid ?? item?.id;
  if (uid == null) return null;
  const s = String(uid).trim();
  return s === "" ? null : s;
}

/** True when a business row has any positive bounty from business_details enrichment. */
function businessHasBounty(item) {
  if (item?.itemType !== "businesses") return false;
  return getBusinessBountySortValue(item) != null;
}

/** Highest bounty dollar amount for ranking — no per-item vs total priority, just the max number. */
function getBusinessBountySortValue(item) {
  if (item?.itemType !== "businesses") return null;
  const candidates = [parseSearchMaxBounty(item.max_per_item_bounty), parseSearchMaxBounty(item.max_total_bounty), parseSearchMaxBounty(item.max_bounty)].filter((v) => v != null);
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

/** Bold/highlight the query substring inside an autocomplete suggestion. */
function renderHighlightedSuggestion(text, query, darkMode) {
  const source = String(text || "");
  const needle = String(query || "").trim();
  const baseStyle = [styles.suggestionMain, darkMode && styles.darkSuggestionMain];
  const highlightStyle = [styles.suggestionHighlight, darkMode && styles.darkSuggestionHighlight];

  if (!needle) {
    return (
      <Text style={baseStyle} numberOfLines={1}>
        {source}
      </Text>
    );
  }

  const lowerSource = source.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const matchIndex = lowerSource.indexOf(lowerNeedle);

  if (matchIndex === -1) {
    return (
      <Text style={baseStyle} numberOfLines={1}>
        {source}
      </Text>
    );
  }

  const before = source.slice(0, matchIndex);
  const match = source.slice(matchIndex, matchIndex + needle.length);
  const after = source.slice(matchIndex + needle.length);

  return (
    <Text style={baseStyle} numberOfLines={1}>
      {before}
      <Text style={highlightStyle}>{match}</Text>
      {after}
    </Text>
  );
}

function getBusinessDetailsRow(result, businessId) {
  if (!result || businessId == null) return null;
  const key = String(businessId).trim();
  if (Object.prototype.hasOwnProperty.call(result, key)) return result[key];
  const matchKey = Object.keys(result).find((k) => String(k).trim() === key);
  return matchKey != null ? result[matchKey] : null;
}

function locationFieldsFromApi(row) {
  if (!row || typeof row !== "object") return { location_boosted: false, distance_miles: null };
  return {
    location_boosted: !!row.location_boosted,
    distance_miles: Number.isFinite(row.distance_miles) ? row.distance_miles : null,
  };
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const la1 = parseFloat(lat1);
  const lo1 = parseFloat(lon1);
  const la2 = parseFloat(lat2);
  const lo2 = parseFloat(lon2);
  if (![la1, lo1, la2, lo2].every(Number.isFinite)) return null;
  const R = 3958.8;
  const dLat = ((la2 - la1) * Math.PI) / 180;
  const dLon = ((lo2 - lo1) * Math.PI) / 180;
  const rLat1 = (la1 * Math.PI) / 180;
  const rLat2 = (la2 * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function searchTypeSupportsDistanceFilter() {
  return true;
}

const DEFAULT_SELECTED_SEARCH_TABS = { businesses: true, expertise: true, organizations: false, seeking: false, individuals: false };

const CATALOG_SEARCH_TAB_KEYS = ["businesses", "expertise", "organizations"];

/** Seeking and Individuals are exclusive with businesses/offering/organizations; catalog mode keeps at least one catalog tab. */
function normalizeSearchTabs(tabs) {
  if (tabs?.individuals) {
    return { businesses: false, expertise: false, organizations: false, seeking: false, individuals: true };
  }
  if (tabs?.seeking) {
    return { businesses: false, expertise: false, organizations: false, seeking: true, individuals: false };
  }
  const businesses = tabs?.businesses !== false;
  const expertise = tabs?.expertise !== false;
  const organizations = !!tabs?.organizations;
  if (!businesses && !expertise && !organizations) {
    return { businesses: true, expertise: true, organizations: false, seeking: false, individuals: false };
  }
  return { businesses, expertise, organizations, seeking: false, individuals: false };
}

function searchTabsFromLegacyType(type) {
  if (!type || type === "global") return normalizeSearchTabs({ businesses: true, expertise: true, seeking: false });
  if (type === "seeking") return { businesses: false, expertise: false, organizations: false, seeking: true, individuals: false };
  if (type === "organizations") return normalizeSearchTabs({ businesses: false, expertise: false, organizations: true, seeking: false });
  return normalizeSearchTabs({
    businesses: type === "businesses",
    expertise: type === "expertise",
    organizations: false,
    seeking: false,
    individuals: false,
  });
}

function offeringDistanceCoords(item) {
  const offeringLat = parseCoordinateValue(item?.profile_expertise_latitude ?? item?.expertiseData?.profile_expertise_latitude);
  const offeringLng = parseCoordinateValue(item?.profile_expertise_longitude ?? item?.expertiseData?.profile_expertise_longitude);
  if (offeringLat != null && offeringLng != null) {
    return { lat: offeringLat, lng: offeringLng };
  }
  return {
    lat: parseCoordinateValue(item?.profile_personal_latitude),
    lng: parseCoordinateValue(item?.profile_personal_longitude),
  };
}

function profileLocationFieldsFromApi(row) {
  return {
    profile_personal_latitude: row?.profile_personal_latitude ?? null,
    profile_personal_longitude: row?.profile_personal_longitude ?? null,
    profile_expertise_latitude: row?.profile_expertise_latitude ?? null,
    profile_expertise_longitude: row?.profile_expertise_longitude ?? null,
    profile_wish_latitude: row?.profile_wish_latitude ?? null,
    profile_wish_longitude: row?.profile_wish_longitude ?? null,
    ...locationFieldsFromApi(row),
  };
}

function seekingDistanceCoords(item) {
  const wishLat = parseCoordinateValue(item?.profile_wish_latitude ?? item?.wishData?.profile_wish_latitude);
  const wishLng = parseCoordinateValue(item?.profile_wish_longitude ?? item?.wishData?.profile_wish_longitude);
  if (wishLat != null && wishLng != null) {
    return { lat: wishLat, lng: wishLng };
  }
  return {
    lat: parseCoordinateValue(item?.profile_personal_latitude),
    lng: parseCoordinateValue(item?.profile_personal_longitude),
  };
}

function itemDistanceMiles(item, homeCoords) {
  if (Number.isFinite(item?.distance_miles)) return item.distance_miles;
  if (homeCoords?.lat == null || homeCoords?.lng == null) return null;
  if (item?.itemType === "expertise") {
    const { lat, lng } = offeringDistanceCoords(item);
    return haversineMiles(homeCoords.lat, homeCoords.lng, lat, lng);
  }
  if (item?.itemType === "seeking") {
    const { lat, lng } = seekingDistanceCoords(item);
    return haversineMiles(homeCoords.lat, homeCoords.lng, lat, lng);
  }
  return haversineMiles(homeCoords.lat, homeCoords.lng, item?.business_latitude, item?.business_longitude);
}

/** Client-side safety net when API distance filtering is skipped or stale. */
function applyDistanceFilterToSearchResults(items, maxMiles, homeCoords) {
  if (maxMiles == null || homeCoords?.lat == null || homeCoords?.lng == null) return items;
  return (items || []).filter((item) => {
    const dist = itemDistanceMiles(item, homeCoords);
    return dist != null && dist <= maxMiles;
  });
}

/** Browse-all: strict network tiers within a section (not score-weighted). */
function sortByNetworkPriority(items) {
  return [...(items || [])].sort((a, b) => {
    const aDeg = getClosestNetworkDegree(a);
    const bDeg = getClosestNetworkDegree(b);
    const aTier = aDeg == null ? 1 : 0;
    const bTier = bDeg == null ? 1 : 0;
    if (aTier !== bTier) return aTier - bTier;
    if (aDeg != null && bDeg != null && aDeg !== bDeg) return aDeg - bDeg;
    const byName = String(a.company || "").localeCompare(String(b.company || ""), undefined, { sensitivity: "base" });
    if (byName !== 0) return byName;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

/** Global browse-all: keep accordion sections, network-sort inside each. */
function sortBrowseAllGlobalSections(items) {
  const businesses = sortByNetworkPriority((items || []).filter((item) => (item?.itemType || "businesses") === "businesses"));
  const expertise = sortByNetworkPriority((items || []).filter((item) => item?.itemType === "expertise"));
  const seeking = sortByNetworkPriority((items || []).filter((item) => item?.itemType === "seeking"));
  return [...businesses, ...expertise, ...seeking];
}

function applyBrowseAllOrdering(items, { global = false } = {}) {
  if (!items?.length) return items || [];
  return global ? sortBrowseAllGlobalSections(items) : sortByNetworkPriority(items);
}

function isBrowseModeResultSet(items) {
  return (items || []).some((item) => item?.score_breakdown?.browse_mode === true);
}

function browseResultListsDiffer(a, b) {
  if (!a || !b || a.length !== b.length) return true;
  return a.some((item, idx) => item?.id !== b[idx]?.id);
}

function offeringCityStateLabel(expertise) {
  const city = String(expertise?.profile_expertise_city || "").trim();
  const state = String(expertise?.profile_expertise_state || "").trim();
  return [city, state].filter(Boolean).join(", ");
}

function offeringLocationLabel(expertise) {
  const cityState = offeringCityStateLabel(expertise);
  if (cityState) return cityState;
  return String(expertise?.profile_expertise_location || "").trim();
}

/** True when the owner profile is taken down (1), pending review (2), or acknowledged (3). */
function isSearchOwnerProfileBlocked(item) {
  if (!item) return false;
  const profileModeration =
    item.profile_moderation ??
    item.owner_moderation ??
    item.moderation?.profile ??
    null;
  const moderatedValue =
    item.profile_personal_moderated ??
    item.owner_profile_moderated ??
    item.profile_moderated ??
    profileModeration?.moderated ??
    null;
  if (moderatedValue != null && moderatedValue !== "") {
    return isProfileVisibilityBlocked({
      profile_personal_moderated: moderatedValue,
      moderation: profileModeration,
    });
  }
  const status = String(
    profileModeration?.status ??
      item.profile_moderation_status ??
      item.owner_profile_status ??
      "",
  )
    .trim()
    .toLowerCase();
  return status === "pending_review" || status === "taken_down" || status === "acknowledged" || status === "rejected";
}

/** Drop zero-qty, moderated offerings, and offerings from taken-down / pending-review profiles. */
function shouldIncludeSearchExpertiseRow(item) {
  const qty = item?.profile_expertise_quantity;
  if (qty != null && qty !== "" && parseInt(qty, 10) === 0) return false;
  if (isOfferingModeratedBlocked(item)) return false;
  if (isSearchOwnerProfileBlocked(item)) return false;
  return true;
}

function filterPublicSearchModeratedResults(items) {
  return (items || []).filter((item) => {
    if (item?.itemType === "expertise") {
      if (isOfferingModeratedBlocked(item.expertiseData || item)) return false;
      return !isSearchOwnerProfileBlocked(item) && !isSearchOwnerProfileBlocked(item.expertiseData);
    }
    if (item?.itemType === "seeking") {
      if (isSeekingModeratedBlocked(item.wishData || item)) return false;
      return !isSearchOwnerProfileBlocked(item) && !isSearchOwnerProfileBlocked(item.wishData);
    }
    if (item?.itemType === "individuals") {
      return !isProfileVisibilityBlocked({
        profile_personal_moderated: item.profile_personal_moderated,
        moderation: item.moderation,
      });
    }
    return true;
  });
}

/** Drop zero-qty, moderated seeking posts, and seekings from taken-down / pending-review profiles. */
function shouldIncludeSearchSeekingRow(item) {
  const qty = item?.profile_wish_quantity;
  if (qty != null && qty !== "" && parseInt(qty, 10) === 0) return false;
  if (isSeekingModeratedBlocked(item)) return false;
  if (isSearchOwnerProfileBlocked(item)) return false;
  return true;
}

/** Strong matches by default; weaker ones available via Show more. Missing flag = keep (legacy/browse). */
function itemPassesRelevanceCutoff(item) {
  if (!item || item.itemType === "individuals") return true;
  if (item?.score_breakdown?.browse_mode === true) return true;
  if (item.passes_relevance_cutoff === false) return false;
  return true;
}

function mapSearchExpertiseRow(item, i) {
  return {
    id: `${item.profile_expertise_uid || i}`,
    company: item.profile_expertise_title || "Untitled Expertise",
    rating: typeof item.score === "number" ? Math.min(5, Math.max(1, Math.round(item.score * 5))) : 4,
    hasPriceTag: false,
    hasX: false,
    hasDollar: false,
    business_short_bio: item.profile_expertise_description || "",
    business_tag_line: item.profile_expertise_title || "",
    tags: [],
    score: item.score || 0,
    score_breakdown: item.score_breakdown || null,
    passes_relevance_cutoff: item.passes_relevance_cutoff !== false,
    itemType: "expertise",
    profile_uid: item.profile_expertise_profile_personal_id || item.profile_personal_uid || item.expertise_owner_profile_uid || null,
    profile_personal_moderated: item.profile_personal_moderated ?? item.owner_profile_moderated ?? null,
    ...profileLocationFieldsFromApi(item),
    ...locationFieldsFromApi(item),
    expertiseData: {
      title: item.profile_expertise_title,
      description: item.profile_expertise_description,
      details: item.profile_expertise_details,
      bounty: item.profile_expertise_bounty,
      cost: item.profile_expertise_cost,
      quantity: item.profile_expertise_quantity || item.quantity,
      profile_expertise_quantity: item.profile_expertise_quantity || item.quantity,
      expertise_uid: item.profile_expertise_uid,
      profile_expertise_start: item.profile_expertise_start || "",
      profile_expertise_end: item.profile_expertise_end || "",
      profile_expertise_location: item.profile_expertise_location || "",
      profile_expertise_latitude: item.profile_expertise_latitude ?? null,
      profile_expertise_longitude: item.profile_expertise_longitude ?? null,
      profile_expertise_city: item.profile_expertise_city || "",
      profile_expertise_state: item.profile_expertise_state || "",
      profile_expertise_mode: item.profile_expertise_mode || "",
      profile_expertise_image: item.profile_expertise_image || "",
      profile_expertise_image_is_public: item.profile_expertise_image_is_public,
      profile_expertise_updated_at: item.profile_expertise_updated_at ?? item.updated_at,
      profile_expertise_moderated: item.profile_expertise_moderated,
      profile_personal_moderated: item.profile_personal_moderated ?? item.owner_profile_moderated ?? null,
      moderation: item.moderation,
      profile_expertise_bounty_type: item.profile_expertise_bounty_type || "none",
      profile_expertise_is_taxable: item.profile_expertise_is_taxable,
      profile_expertise_tax_rate: item.profile_expertise_tax_rate || "",
      profile_expertise_condition_type: item.profile_expertise_condition_type || "na",
      profile_expertise_condition_detail: item.profile_expertise_condition_detail || "",
      profile_expertise_is_returnable: item.profile_expertise_is_returnable ?? 0,
      profile_expertise_return_window_days: item.profile_expertise_return_window_days || "",
      profile_expertise_free_shipping: item.profile_expertise_free_shipping ?? 0,
      profile_expertise_buyer_pays_shipping: item.profile_expertise_buyer_pays_shipping ?? 0,
      profile_expertise_refund_policy: item.profile_expertise_refund_policy || "",
    },
    profileData: {
      firstName: item.profile_personal_first_name || "",
      lastName: item.profile_personal_last_name || "",
      email: item.user_email_id || "",
      phone: item.profile_personal_phone_number || "",
      image: item.profile_personal_image || "",
      tagLine: item.profile_personal_tag_line || "",
      city: item.profile_personal_city || "",
      state: item.profile_personal_state || "",
      emailIsPublic: item.profile_personal_email_is_public == 1,
      phoneIsPublic: item.profile_personal_phone_number_is_public == 1,
      imageIsPublic: item.profile_personal_image_is_public == 1,
      tagLineIsPublic: item.profile_personal_tag_line_is_public == 1,
      locationIsPublic: item.profile_personal_location_is_public == 1,
    },
  };
}

function mapSearchWishRow(item, i) {
  return {
    id: `${item.profile_wish_uid || i}`,
    company: item.profile_wish_title || "Untitled Wish",
    rating: typeof item.score === "number" ? Math.min(5, Math.max(1, Math.round(item.score * 5))) : 4,
    hasPriceTag: false,
    hasX: false,
    hasDollar: false,
    hasBounty: !!item.profile_wish_bounty,
    business_short_bio: item.profile_wish_description || "",
    business_tag_line: item.profile_wish_title || "",
    tags: [],
    score: item.score || 0,
    score_breakdown: item.score_breakdown || null,
    passes_relevance_cutoff: item.passes_relevance_cutoff !== false,
    itemType: "seeking",
    profile_uid: item.profile_wish_profile_personal_id,
    profile_wish_end: item.profile_wish_end || "",
    profile_personal_moderated: item.profile_personal_moderated ?? item.owner_profile_moderated ?? null,
    ...profileLocationFieldsFromApi(item),
    ...locationFieldsFromApi(item),
    wishData: {
      title: item.profile_wish_title,
      description: item.profile_wish_description,
      bounty: item.profile_wish_bounty,
      cost: item.profile_wish_cost,
      wish_uid: item.profile_wish_uid,
      profile_wish_quantity: item.profile_wish_quantity || "",
      profile_wish_image: item.profile_wish_image || "",
      profile_wish_image_is_public: item.profile_wish_image_is_public,
      profile_wish_start: item.profile_wish_start || "",
      profile_wish_end: item.profile_wish_end || "",
      profile_wish_location: item.profile_wish_location || "",
      profile_wish_latitude: item.profile_wish_latitude ?? null,
      profile_wish_longitude: item.profile_wish_longitude ?? null,
      profile_wish_city: item.profile_wish_city || "",
      profile_wish_state: item.profile_wish_state || "",
      profile_wish_mode: item.profile_wish_mode || "",
      profile_wish_bounty_type: item.profile_wish_bounty_type || (item.profile_wish_bounty ? "per_item" : "none"),
      profile_wish_updated_at: item.profile_wish_updated_at ?? item.updated_at,
      profile_wish_moderated: item.profile_wish_moderated,
      profile_personal_moderated: item.profile_personal_moderated ?? item.owner_profile_moderated ?? null,
      moderation: item.moderation,
    },
    profileData: {
      firstName: item.profile_personal_first_name || "",
      lastName: item.profile_personal_last_name || "",
      email: item.user_email_id || "",
      phone: item.profile_personal_phone_number || "",
      image: item.profile_personal_image || "",
      tagLine: item.profile_personal_tag_line || "",
      emailIsPublic: item.profile_personal_email_is_public == 1,
      phoneIsPublic: item.profile_personal_phone_number_is_public == 1,
      imageIsPublic: item.profile_personal_image_is_public == 1,
      tagLineIsPublic: item.profile_personal_tag_line_is_public == 1,
    },
  };
}

function formatSearchDistanceMiles(miles) {
  if (!Number.isFinite(miles)) return null;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

function LocationBoostIcon({ darkMode, distanceMiles }) {
  const label = distanceMiles != null ? `Boosted: within ${distanceMiles.toFixed(1)} miles of your home` : "Boosted: near your home address";
  return <Ionicons name='navigate' size={14} color={darkMode ? "#7DD3FC" : "#0EA5E9"} style={{ marginLeft: 6 }} accessibilityLabel={label} />;
}

function SearchCardDistanceLabel({ miles, darkMode, style, centered = false }) {
  const label = formatSearchDistanceMiles(miles);
  if (!label) return null;
  return (
    <View style={[styles.searchCardDistancePill, centered && styles.searchCardDistancePillCentered, darkMode && styles.darkSearchCardDistancePill, style]}>
      <Ionicons name='navigate-outline' size={12} color={darkMode ? "#7DD3FC" : "#0EA5E9"} />
      <Text style={[styles.searchCardDistanceText, darkMode && styles.darkSearchCardDistanceText]}>{label}</Text>
    </View>
  );
}

function SearchCardNetworkBadge({ degree, darkMode, style }) {
  if (degree == null) return null;
  return (
    <View style={[styles.searchCardNetworkBadge, style]} accessibilityLabel={`Network degree ${degree}`}>
      <Image source={require("../assets/connect.png")} style={[styles.searchCardNetworkIcon, { tintColor: darkMode ? "#ffffff" : "#000000" }]} />
      <View style={styles.connectionBadge}>
        <Text style={styles.connectionBadgeText}>{degree}</Text>
      </View>
    </View>
  );
}

const SEARCH_SCORE_DETAIL_LABELS = {
  token_name: "Name Token",
  token_tagline: "Tagline Token",
  token_bio: "Bio Token",
  token_tag: "Tag Token",
  phrase_name: "Name Phrase",
  phrase_tag: "Tag Phrase",
};

const SEARCH_SCORE_IGNORED_KEYS = new Set(["semantic_score", "lexical_fuzzy_score", "total_lexical_boost", "final_score", "rescore_mode", "rrf_k", "rrf_rank_semantic", "rrf_rank_lexical", "rrf_raw"]);

/** Inline score suffix for business search rows, e.g. "(Score 0.984 Sem: 0.222, Lex 0.273, Tag Token 0.220)". */
function formatBusinessSearchScoreSuffix(item) {
  const breakdown = item?.score_breakdown;
  const segments = [];

  if (Number.isFinite(item?.score)) {
    segments.push(`Score ${Number(item.score).toFixed(3)}`);
  } else if (breakdown && Number.isFinite(breakdown.final_score)) {
    segments.push(`Score ${Number(breakdown.final_score).toFixed(3)}`);
  }

  if (breakdown && typeof breakdown === "object") {
    if (Number.isFinite(breakdown.semantic_score)) {
      segments.push(`Sem: ${Number(breakdown.semantic_score).toFixed(3)}`);
    }
    if (Number.isFinite(breakdown.lexical_fuzzy_score)) {
      segments.push(`Lex ${Number(breakdown.lexical_fuzzy_score).toFixed(3)}`);
    }

    Object.entries(breakdown)
      .filter(([key, value]) => SEARCH_SCORE_DETAIL_LABELS[key] && !SEARCH_SCORE_IGNORED_KEYS.has(key) && Number.isFinite(value) && Number(value) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .forEach(([key, value]) => {
        segments.push(`${SEARCH_SCORE_DETAIL_LABELS[key]} ${Number(value).toFixed(3)}`);
      });
  }

  if (!segments.length) return null;
  return `(${segments.join(", ")})`;
}

/** Merge API business_details bounty with any values already on the search row (never drop the higher amount). */
function mergeBountyFieldsFromRow(existing, detailsRow) {
  const fromApi = detailsRow
    ? {
        per: parseSearchMaxBounty(detailsRow.max_per_item_bounty),
        total: parseSearchMaxBounty(detailsRow.max_total_bounty),
        max: parseSearchMaxBounty(detailsRow.max_bounty),
      }
    : { per: null, total: null, max: null };
  const fromExisting = {
    per: parseSearchMaxBounty(existing.max_per_item_bounty),
    total: parseSearchMaxBounty(existing.max_total_bounty),
    max: parseSearchMaxBounty(existing.max_bounty),
  };
  const best = (a, b) => {
    if (a == null) return b;
    if (b == null) return a;
    return Math.max(a, b);
  };
  return {
    max_per_item_bounty: best(fromApi.per, fromExisting.per),
    max_total_bounty: best(fromApi.total, fromExisting.total),
    max_bounty: best(fromApi.max, fromExisting.max),
  };
}

/** Ascending / Descending: drop zero-bounty businesses, sort the rest by bounty amount (numeric). */
function applyBountyFilterAndSort(items, bountyMode) {
  if (bountyMode !== "Ascending" && bountyMode !== "Descending") {
    return items;
  }
  const dir = bountyMode === "Ascending" ? 1 : -1;
  const pruned = items.filter((item) => item.itemType !== "businesses" || businessHasBounty(item));
  const others = pruned.filter((item) => item.itemType !== "businesses");
  const businesses = pruned.filter((item) => item.itemType === "businesses");
  businesses.sort((a, b) => {
    const aVal = getBusinessBountySortValue(a) ?? 0;
    const bVal = getBusinessBountySortValue(b) ?? 0;
    if (aVal !== bVal) return dir * (aVal - bVal);
    const aScore = Number(a.globalScore ?? a.score) || 0;
    const bScore = Number(b.globalScore ?? b.score) || 0;
    return bScore - aScore;
  });
  return [...businesses, ...others];
}

function getResultSortLabel(item) {
  return String(item?.company || item?.business_name || "").trim();
}

/** A → Z / Z → A; global view sorts within each accordion section. */
function applyAlphabeticalSort(items, mode, { global = false } = {}) {
  if (mode !== "Ascending" && mode !== "Descending") {
    return items;
  }
  const dir = mode === "Ascending" ? 1 : -1;
  const sortList = (list) =>
    [...(list || [])].sort((a, b) => {
      const byName = getResultSortLabel(a).localeCompare(getResultSortLabel(b), undefined, { sensitivity: "base" });
      if (byName !== 0) return dir * byName;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });
  if (!global) return sortList(items);
  const businesses = sortList(items.filter((item) => (item?.itemType || "businesses") === "businesses"));
  const expertise = sortList(items.filter((item) => item?.itemType === "expertise"));
  const seeking = sortList(items.filter((item) => item?.itemType === "seeking"));
  return [...businesses, ...expertise, ...seeking];
}

/** Client-side ordering: browse network, alphabetical, or bounty (typed search only). */
function applyClientSorts(items, { browseAll = false, searchType = "global", bounty = null, alphabetical = null } = {}) {
  const global = searchType === "global";
  const list = items || [];

  if (browseAll) {
    if (alphabetical) return applyAlphabeticalSort(list, alphabetical, { global });
    return applyBrowseAllOrdering(list, { global });
  }

  if (alphabetical) return applyAlphabeticalSort(list, alphabetical, { global });
  if (bounty) return applyBountyFilterAndSort(list, bounty);
  return list;
}

// Display stored "YYYY-MM-DD HH:mm" or "YYYY-MM-DDTHH:mm" as "m/d/y hh:mm"
const formatDateTimeForDisplay = (value) => {
  if (!value || typeof value !== "string" || value.trim() === "") return "";
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[\sT]?(\d{1,2})?:?(\d{2})?/);
  if (match) {
    const [, y, m, d, h, min] = match;
    const timePart = h !== undefined && min !== undefined ? ` ${String(parseInt(h, 10)).padStart(2, "0")}:${min}` : "";
    return `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}${timePart}`;
  }
  return value;
};

/** Date-only display for wish response badges, e.g. "6/29/2026". */
const formatDateForDisplay = (value) => {
  if (!value || typeof value !== "string" || value.trim() === "") return "";
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    return `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}`;
  }
  return trimmed;
};

function parseConnectionDegree(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Network degree used for filter, sort, and badge. Businesses: review path only (owner excluded for now). */
function getClosestNetworkDegree(item) {
  const reviewDeg = parseConnectionDegree(item.review_connection_degree);
  if ((item?.itemType || "businesses") === "businesses") {
    return reviewDeg;
    // Owner path disabled for business network filter/sort/badge:
    // const ownerDeg = parseConnectionDegree(item.owner_connection_degree);
    // const parts = [];
    // if (reviewDeg != null) parts.push(reviewDeg);
    // if (ownerDeg != null) parts.push(ownerDeg);
    // if (parts.length) return Math.min(...parts);
    // return parseConnectionDegree(item.connection_degree);
  }
  const ownerDeg = parseConnectionDegree(item.owner_connection_degree);
  if (ownerDeg != null) return ownerDeg;
  return parseConnectionDegree(item.connection_degree);
}

/**
 * Cumulative network filter: level 1 appears when max is 2+, but level 2 does not when max is 1.
 * Businesses pass only via reviewer network path; owner path does not satisfy the filter.
 */
function itemPassesNetworkFilter(item, maxDegree) {
  if (maxDegree == null) return true;
  const max = Number(maxDegree);
  if (!Number.isFinite(max)) return true;
  const closest = getClosestNetworkDegree(item);
  return closest != null && closest <= max;
}

/**
 * POSTs to `/api/v1/business_details` (ratings, connection degree, max bounty fields, product_count) and merges into rows with `itemType === "businesses"`.
 * Used for accurate stars, review count, connection degree, and bounty vs search-index guesses.
 */
async function enrichBusinessSearchResultsWithAvgRatingsAndMaxBounty(items) {
  const businessIds = [
    ...new Set(
      items
        .filter((b) => b.itemType === "businesses")
        .map((b) => resolveBusinessUid(b))
        .filter(Boolean),
    ),
  ];
  if (businessIds.length === 0) return items;

  let profileUid = null;
  try {
    profileUid = await AsyncStorage.getItem("profile_uid");
  } catch (_) {
    /* ignore */
  }

  let merged = items;

  try {
    const DETAILS_BATCH_SIZE = 40;
    const detailsByUid = {};
    for (let i = 0; i < businessIds.length; i += DETAILS_BATCH_SIZE) {
      const chunk = businessIds.slice(i, i + DETAILS_BATCH_SIZE);
      const ratingsRes = await fetch(BUSINESS_DETAILS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          uids: chunk,
          profile_uid: profileUid || null,
        }),
      });
      const ratingsJson = await ratingsRes.json();
      if (ratingsJson.result && typeof ratingsJson.result === "object") {
        Object.assign(detailsByUid, ratingsJson.result);
      }
    }
    if (Object.keys(detailsByUid).length > 0) {
      merged = merged.map((b) => {
        if (b.itemType !== "businesses") return b;
        const row = getBusinessDetailsRow(detailsByUid, resolveBusinessUid(b) || b.id);
        const reviewDeg = parseConnectionDegree(row?.review_connection_degree);
        const ownerDeg = parseConnectionDegree(row?.owner_connection_degree);
        // const nearestDeg = parseConnectionDegree(row?.nearest_connection);
        // const badgeDegrees = [reviewDeg, ownerDeg, nearestDeg].filter((d) => d != null);
        const next = {
          ...b,
          ...mergeBountyFieldsFromRow(b, row),
          rating: row && Number.isFinite(parseFloat(row.avg_rating)) ? parseFloat(row.avg_rating) : null,
          ratingCount: row ? row.rating_count : 0,
          review_connection_degree: reviewDeg,
          owner_connection_degree: ownerDeg,
          // Badge uses reviewer path only; owner path kept on row but not shown in level badge.
          connection_degree: reviewDeg,
          // connection_degree: badgeDegrees.length ? Math.min(...badgeDegrees) : null,
        };
        if (row != null) {
          const raw = row.product_count;
          let product_count = null;
          if (raw != null && raw !== "") {
            const n = parseInt(String(raw), 10);
            if (Number.isFinite(n)) product_count = n;
          }
          next.product_count = product_count;
        }
        return next;
      });
    }
  } catch (e) {
    console.log("Could not fetch avg ratings / connections:", e);
  }

  return merged;
}

/** Owner profile degree for offering/seeking rows (review path not used for those item types yet). */
async function enrichOfferingOwnerConnectionDegrees(items) {
  const profileUids = [
    ...new Set(
      items
        .filter((i) => (i.itemType === "expertise" || i.itemType === "seeking") && i.profile_uid)
        .map((i) => String(i.profile_uid).trim())
        .filter(Boolean),
    ),
  ];
  if (profileUids.length === 0) return items;

  let profileUid = null;
  try {
    profileUid = await AsyncStorage.getItem("profile_uid");
  } catch (_) {
    /* ignore */
  }
  if (!profileUid) return items;

  try {
    const res = await fetch(PROFILE_CONNECTION_DEGREES_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ profile_uid: profileUid, uids: profileUids }),
    });
    const json = await res.json();
    const degreeMap = json.result || {};
    return items.map((item) => {
      if (item.itemType !== "expertise" && item.itemType !== "seeking") return item;
      const ownerDeg = parseConnectionDegree(degreeMap[item.profile_uid]);
      return {
        ...item,
        owner_connection_degree: ownerDeg,
        connection_degree: ownerDeg,
      };
    });
  } catch (e) {
    console.log("Could not fetch profile connection degrees:", e);
    return items;
  }
}

const SEARCH_CARD_COMPACT_MAX_WIDTH = 480;

export default function SearchScreen({ route }) {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isCompactSearchCard = Platform.OS !== "web" || windowWidth < SEARCH_CARD_COMPACT_MAX_WIDTH;
  const filterPanelMaxHeight = Math.max(240, Math.min(340, Math.round(windowHeight * 0.42)));
  const filterInlineLocationMaxHeight = Math.max(180, Math.min(260, Math.round(windowHeight * 0.32)));
  const [cartItems, setCartItems] = useState([]);
  const [cartCount, setCartCount] = useState(0);

  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [hasLoadedInitialSearch, setHasLoadedInitialSearch] = useState(false);

  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);

  const searchFeedbackInstructions = "Instructions for Search";

  // Define custom questions for the Account page
  const searchFeedbackQuestions = ["Search - Question 1?", "Search - Question 2?", "Search - Question 3?"];

  // Declare all state variables first
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestDebounceRef = useRef(null);
  const suggestPressRef = useRef(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filter states
  const [distance, setDistance] = useState(null);
  /** Search origin for distance filter and proximity ranking — home, preset city, or custom city. */
  const [searchLocation, setSearchLocation] = useState(SEARCH_LOCATION_HOME);
  /** Coords/label when searchLocation === SEARCH_LOCATION_CUSTOM. */
  const [customSearchCity, setCustomSearchCity] = useState(null);
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [citySuggestionsLoading, setCitySuggestionsLoading] = useState(false);
  const citySuggestDebounceRef = useRef(null);
  /** Home address from profile_personal_latitude/longitude (Settings → Home Address Coordinates) */
  const [userHomeCoords, setUserHomeCoords] = useState({ lat: null, lng: null });
  const [network, setNetwork] = useState(null);
  const [bounty, setBounty] = useState(null);
  const [sortAlphabetical, setSortAlphabetical] = useState(null);
  const [rating, setRating] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);

  // Multi-select search tabs (businesses / offering / seeking). Global tab hidden for now.
  const [selectedSearchTabs, setSelectedSearchTabs] = useState({ ...DEFAULT_SELECTED_SEARCH_TABS });
  /** True after an empty-query browse-all search completes (drives per-section network sort). */
  const [browseAllActive, setBrowseAllActive] = useState(false);
  /**
   * Progressive reveal of weaker matches:
   * 0 = strong (+ min 4), 1 = +4 more, 2 = all remaining.
   */
  const [showMoreStage, setShowMoreStage] = useState(0);

  const [currentProfileUid, setCurrentProfileUid] = useState(null);
  /** Settings → Debug Mode = Yes: show search ranking scores on result cards. */
  const [settingsDebugModeEnabled, setSettingsDebugModeEnabled] = useState(false);
  const showSearchScores = SHOW_NETWORK_DEBUG_UI !== 0 && settingsDebugModeEnabled;
  /** profile_wish_uid → wr_datetime for wishes the logged-in user has responded to (Seeking tab). */
  const [respondedWishesById, setRespondedWishesById] = useState({});
  /** profile_expertise_uid → er_datetime for offerings the logged-in user has messaged (Offering tab). */
  const [respondedOfferingsById, setRespondedOfferingsById] = useState({});
  const [connectionDegreeMap, setConnectionDegreeMap] = useState({});
  const connectionDegreeMapRef = useRef({});
  // Stores pre-client-sort results so bounty / alphabetical can re-sort without re-fetching
  const rawResultsRef = useRef([]);
  const bountyRef = useRef(bounty);
  const sortAlphabeticalRef = useRef(sortAlphabetical);
  const browseAllActiveRef = useRef(false);
  const selectedSearchTabsRef = useRef(selectedSearchTabs);
  const searchGenerationRef = useRef(0);
  useEffect(() => {
    bountyRef.current = bounty;
  }, [bounty]);
  useEffect(() => {
    sortAlphabeticalRef.current = sortAlphabetical;
  }, [sortAlphabetical]);
  useEffect(() => {
    selectedSearchTabsRef.current = selectedSearchTabs;
  }, [selectedSearchTabs]);

  const toggleSearchTab = useCallback((tabKey) => {
    setSelectedSearchTabs((prev) => {
      if (tabKey === "individuals") {
        if (prev.individuals) {
          return prev;
        }
        return { businesses: false, expertise: false, organizations: false, seeking: false, individuals: true };
      }

      if (tabKey === "seeking") {
        if (prev.seeking) {
          return prev;
        }
        return { businesses: false, expertise: false, organizations: false, seeking: true, individuals: false };
      }

      if (prev.seeking || prev.individuals) {
        return {
          businesses: tabKey === "businesses",
          expertise: tabKey === "expertise",
          organizations: tabKey === "organizations",
          seeking: false,
          individuals: false,
        };
      }

      if (!prev[tabKey]) {
        return { ...prev, [tabKey]: true, seeking: false, individuals: false };
      }

      const anotherCatalogOn = CATALOG_SEARCH_TAB_KEYS.some((key) => key !== tabKey && prev[key]);
      if (!anotherCatalogOn) {
        return prev;
      }
      return { ...prev, [tabKey]: false, seeking: false, individuals: false };
    });
  }, []);

  const commitSearchResults = useCallback((list, { browseAll = false } = {}) => {
    browseAllActiveRef.current = browseAll;
    setBrowseAllActive(browseAll);
    setShowMoreStage(0);
    const filtered = filterPublicSearchModeratedResults(list);
    rawResultsRef.current = [...filtered];
    setResults(
      applyClientSorts(filtered, {
        browseAll,
        searchType: "global",
        bounty: bountyRef.current,
        alphabetical: sortAlphabeticalRef.current,
      }),
    );
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("profile_uid").then((uid) => setCurrentProfileUid(uid));
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const nd = await AsyncStorage.getItem(SETTINGS_NETWORK_DEBUG_MODE_KEY);
          if (nd !== null) setSettingsDebugModeEnabled(JSON.parse(nd) === true);
          else setSettingsDebugModeEnabled(false);
        } catch {
          setSettingsDebugModeEnabled(false);
        }
      })();
    }, []),
  );

  useEffect(() => {
    return () => {
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    };
  }, []);

  const onSearchQueryChange = (text) => {
    setSearchQuery(text);
    if (selectedSearchTabsRef.current.individuals) {
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
      setSearchSuggestions([]);
      setShowSearchSuggestions(false);
      setSuggestionsLoading(false);
      return;
    }
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);

    if (!text.trim()) {
      setSearchSuggestions([]);
      setShowSearchSuggestions(false);
      setSuggestionsLoading(false);
      return;
    }

    if (text.trim().length < SEARCH_SUGGEST_MIN_LENGTH) {
      setSearchSuggestions([]);
      setShowSearchSuggestions(false);
      setSuggestionsLoading(false);
      return;
    }

    setShowSearchSuggestions(true);
    setSuggestionsLoading(true);

    suggestDebounceRef.current = setTimeout(async () => {
      try {
        const items = await fetchSearchSuggestions(text);
        setSearchSuggestions(items);
        setShowSearchSuggestions(true);
      } catch (e) {
        console.warn("[SearchScreen] suggestion fetch failed:", e);
        setSearchSuggestions([]);
        setShowSearchSuggestions(true);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 300);
  };

  const handleSuggestionSelect = (text) => {
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    suggestPressRef.current = false;
    setSearchQuery(text);
    setSearchSuggestions([]);
    setShowSearchSuggestions(false);
    performSearch(text);
  };

  const dismissSearchSuggestions = () => {
    setShowSearchSuggestions(false);
  };

  const onSearchInputBlur = () => {
    // TextInput blur fires before suggestion onPress on web; defer dismiss so tap can land.
    setTimeout(() => {
      if (suggestPressRef.current) {
        suggestPressRef.current = false;
        return;
      }
      dismissSearchSuggestions();
    }, 200);
  };

  const onSuggestionPressIn = () => {
    suggestPressRef.current = true;
  };

  const loadUserHomeCoords = useCallback(async () => {
    try {
      const { getSessionProfile } = require("../utils/sessionProfile");
      const session = await getSessionProfile({ forceRefresh: true });
      const pi = session?.personalInfo || session?.rawProfile?.personal_info;
      const lat = pi?.profile_personal_latitude;
      const lng = pi?.profile_personal_longitude;
      if (lat != null && lng != null && !Number.isNaN(parseFloat(lat)) && !Number.isNaN(parseFloat(lng))) {
        const coords = { lat: parseFloat(lat), lng: parseFloat(lng) };
        setUserHomeCoords(coords);
        return coords;
      }
      const empty = { lat: null, lng: null };
      setUserHomeCoords(empty);
      return empty;
    } catch (e) {
      console.warn("[SearchScreen] loadUserHomeCoords failed:", e);
      const empty = { lat: null, lng: null };
      setUserHomeCoords(empty);
      return empty;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUserHomeCoords();
    }, [loadUserHomeCoords]),
  );

  const fetchMyWishResponses = useCallback(async () => {
    const uid = (currentProfileUid || (await AsyncStorage.getItem("profile_uid")) || "").trim();
    if (!uid) {
      setRespondedWishesById({});
      return;
    }
    try {
      const res = await fetch(`${PROFILE_WISH_RESPONSE_ENDPOINT}/${encodeURIComponent(uid)}`);
      const json = await res.json();
      const rows = Array.isArray(json?.data) ? json.data : [];
      const byId = {};
      for (const row of rows) {
        const wishId = String(row.wr_profile_wish_id || "").trim();
        if (!wishId) continue;
        const respondedAt = row.wr_datetime || "";
        const prev = byId[wishId];
        if (!prev || String(respondedAt) > String(prev)) {
          byId[wishId] = respondedAt;
        }
      }
      setRespondedWishesById(byId);
    } catch (e) {
      console.warn("[SearchScreen] fetchMyWishResponses failed:", e);
      setRespondedWishesById({});
    }
  }, [currentProfileUid]);

  const fetchMyExpertiseResponses = useCallback(async () => {
    const uid = (currentProfileUid || (await AsyncStorage.getItem("profile_uid")) || "").trim();
    if (!uid) {
      setRespondedOfferingsById({});
      return;
    }
    try {
      const byId = await fetchMyOfferingMessageResponses(uid);
      setRespondedOfferingsById(byId);
    } catch (e) {
      console.warn("[SearchScreen] fetchMyExpertiseResponses failed:", e);
      setRespondedOfferingsById({});
    }
  }, [currentProfileUid]);

  useFocusEffect(
    useCallback(() => {
      if (selectedSearchTabs.seeking) {
        fetchMyWishResponses();
      }
    }, [selectedSearchTabs.seeking, fetchMyWishResponses]),
  );

  useEffect(() => {
    if (selectedSearchTabs.seeking) {
      fetchMyWishResponses();
    }
  }, [selectedSearchTabs.seeking, fetchMyWishResponses]);

  useFocusEffect(
    useCallback(() => {
      if (selectedSearchTabs.expertise) {
        fetchMyExpertiseResponses();
      }
    }, [selectedSearchTabs.expertise, fetchMyExpertiseResponses]),
  );

  useEffect(() => {
    if (selectedSearchTabs.expertise) {
      fetchMyExpertiseResponses();
    }
  }, [selectedSearchTabs.expertise, fetchMyExpertiseResponses]);

  // Restore search state when returning from Profile, then refresh individual relationship badges
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;

      const refreshIndividualRelationships = async (list) => {
        if (!Array.isArray(list) || !list.some((item) => item?.itemType === "individuals")) {
          return list;
        }
        try {
          const networkByUid = await loadReferralNetworkByUid();
          return enrichSearchItemsWithReferralRelationships(list, networkByUid);
        } catch (e) {
          console.warn("SearchScreen - could not refresh individual relationships:", e);
          return list;
        }
      };

      (async () => {
        if (route.params?.restoreState && route.params?.searchState) {
          const state = route.params.searchState;
          console.log("🔄 Restoring Search screen state:", state);
          if (state.searchQuery !== undefined) setSearchQuery(state.searchQuery);
          if (state.selectedSearchTabs) {
            setSelectedSearchTabs(normalizeSearchTabs(state.selectedSearchTabs));
          } else if (state.searchType !== undefined) {
            setSelectedSearchTabs(searchTabsFromLegacyType(state.searchType));
          }
          const raw = state.rawResults?.length ? state.rawResults : state.results;
          let listToShow = raw?.length ? raw : state.results;
          if (listToShow?.length) {
            listToShow = await refreshIndividualRelationships(listToShow);
            if (cancelled) return;
            rawResultsRef.current = [...listToShow];
            if (state.browseAllActive) browseAllActiveRef.current = true;
            const restoredBounty = state.bounty !== undefined ? state.bounty : bountyRef.current;
            const restoredAlphabetical = state.sortAlphabetical !== undefined ? state.sortAlphabetical : sortAlphabeticalRef.current;
            setResults(
              applyClientSorts(listToShow, {
                browseAll: !!state.browseAllActive,
                searchType: "global",
                bounty: restoredBounty,
                alphabetical: restoredAlphabetical,
              }),
            );
          }
          if (state.distance !== undefined) setDistance(state.distance);
          if (state.searchLocation !== undefined) setSearchLocation(state.searchLocation);
          if (state.customSearchCity !== undefined) setCustomSearchCity(state.customSearchCity);
          if (state.network !== undefined) setNetwork(state.network);
          if (state.bounty !== undefined) setBounty(state.bounty);
          if (state.sortAlphabetical !== undefined) setSortAlphabetical(state.sortAlphabetical);
          if (state.rating !== undefined) setRating(state.rating);
          if (state.browseAllActive) setBrowseAllActive(true);
          console.log(" Search screen state restored");
          return;
        }

        // Returning from Profile without restore payload — still refresh badges on current results.
        const current = rawResultsRef.current.length > 0 ? rawResultsRef.current : null;
        if (!current?.length) return;
        const enriched = await refreshIndividualRelationships(current);
        if (cancelled || enriched === current) return;
        rawResultsRef.current = [...enriched];
        setResults(
          applyClientSorts(enriched, {
            browseAll: browseAllActiveRef.current,
            searchType: "global",
            bounty: bountyRef.current,
            alphabetical: sortAlphabeticalRef.current,
          }),
        );
      })();

      return () => {
        cancelled = true;
      };
    }, [route.params?.restoreState, route.params?.searchState]),
  );

  const loadCartItems = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cartKeys = keys.filter((key) => key.startsWith("cart_"));

      let totalItems = 0;
      let allCartItems = [];

      for (const key of cartKeys) {
        const cartData = await AsyncStorage.getItem(key);
        if (cartData) {
          const parsed = JSON.parse(cartData);

          if (key.startsWith("cart_expertise_")) {
            totalItems += 1;
            allCartItems.push({ ...parsed, cart_key: key });
          } else {
            const items = parsed.items || [];
            totalItems += items.length;
            const businessUid = key.replace("cart_", "");
            const itemsWithBusiness = items.map((item) => ({
              ...item,
              business_uid: businessUid,
            }));
            allCartItems = [...allCartItems, ...itemsWithBusiness];
          }
        }
      }

      setCartCount(totalItems);
      setCartItems(allCartItems);
    } catch (error) {
      console.error("Error loading cart items:", error);
      setCartCount(0);
      setCartItems([]);
    }
  }, []);

  useEffect(() => {
    loadCartItems();

    const unsubscribe = navigation.addListener("focus", () => {
      console.log("SearchScreen focused - refreshing cart");
      loadCartItems();
    });

    return unsubscribe;
  }, [navigation, loadCartItems, route.params?.refreshCart]);

  // Load saved search state or perform initial "Chinese" search
  useEffect(() => {
    const loadSavedSearch = async () => {
      try {
        // Get current user's UID
        const userUid = await AsyncStorage.getItem("user_uid");

        if (!userUid) {
          console.log("⚠️ No user_uid found yet, will retry...");
          setHasLoadedInitialSearch(true);
          setLoading(false);
          return;
        }

        console.log("👤 Loading search for user:", userUid);

        // Use user-specific keys
        const savedSearchQuery = await AsyncStorage.getItem(`last_search_query_${userUid}`);
        const savedSearchType = await AsyncStorage.getItem(`last_search_type_${userUid}`);
        const savedResults = await AsyncStorage.getItem(`last_search_results_${userUid}`);

        console.log("📋 Saved search query:", savedSearchQuery);
        console.log("📋 Saved search type:", savedSearchType);
        console.log("📋 Has saved results:", !!savedResults);

        if (savedSearchQuery && savedResults) {
          // User has searched before, restore their last search
          console.log("📋 Restoring last search for user:", userUid, "Query:", savedSearchQuery);
          setSearchQuery(savedSearchQuery);
          if (savedSearchType) {
            try {
              const parsedTabs = JSON.parse(savedSearchType);
              if (parsedTabs && typeof parsedTabs === "object") {
                setSelectedSearchTabs(normalizeSearchTabs(parsedTabs));
              } else {
                setSelectedSearchTabs(searchTabsFromLegacyType(savedSearchType));
              }
            } catch {
              setSelectedSearchTabs(searchTabsFromLegacyType(savedSearchType));
            }
          }
          const parsedResults = filterPublicSearchModeratedResults(JSON.parse(savedResults).map((item) =>
            item.itemType === "businesses"
              ? {
                  ...item,
                  business_uid: item.business_uid || (item.id != null ? String(item.id).trim() : null),
                  rating: null,
                  ratingCount: 0,
                  connection_degree: null,
                  max_bounty: null,
                  max_per_item_bounty: null,
                  max_total_bounty: null,
                }
              : item,
          ));
          let initialResults = parsedResults;
          try {
            if (parsedResults.some((item) => item?.itemType === "individuals")) {
              const networkByUid = await loadReferralNetworkByUid();
              initialResults = enrichSearchItemsWithReferralRelationships(parsedResults, networkByUid);
            }
          } catch (e) {
            console.warn("Could not enrich restored individual relationships:", e);
          }
          setResults(initialResults);
          setIsFirstVisit(false);
          setHasLoadedInitialSearch(true);
          setLoading(false);
          const bizItems = initialResults.filter((r) => r.itemType === "businesses" && r.id);
          const enrichCachedResults = async () => {
            let updated = initialResults;
            if (bizItems.length > 0) {
              updated = await enrichBusinessSearchResultsWithAvgRatingsAndMaxBounty(updated);
            }
            updated = await enrichOfferingOwnerConnectionDegrees(updated);
            return updated;
          };
          enrichCachedResults()
            .then((updated) => {
              commitSearchResults(updated, { browseAll: false });
            })
            .catch((e) => {
              console.error("Could not enrich cached search results:", e);
              rawResultsRef.current = [...parsedResults];
            });
        } else {
          // First time user, search for "Chinese"
          console.log("🆕 First visit for user:", userUid, "- searching for 'Chinese'");
          setLoading(true);
          setSearchQuery("Chinese");
          setIsFirstVisit(true);
          setHasLoadedInitialSearch(true);
          // Trigger the search after a brief delay to ensure state is set
          setTimeout(() => {
            performSearch("Chinese");
          }, 100);
        }
      } catch (error) {
        console.error("Error loading saved search:", error);
        // On error, default to Chinese search
        setLoading(true);
        setSearchQuery("Chinese");
        setHasLoadedInitialSearch(true);
        setTimeout(() => {
          performSearch("Chinese");
        }, 100);
      }
    };

    // Only run once when component mounts or when we haven't loaded yet
    if (!hasLoadedInitialSearch) {
      // Add a small delay to ensure AsyncStorage is ready
      const timer = setTimeout(() => {
        loadSavedSearch();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [hasLoadedInitialSearch]);

  // Re-apply client-side sort when bounty or alphabetical filter changes (raw list kept for Reset)
  useEffect(() => {
    const base = rawResultsRef.current;
    if (base.length === 0) return;
    setResults(
      applyClientSorts(base, {
        browseAll: browseAllActiveRef.current,
        searchType: "global",
        bounty: bountyRef.current,
        alphabetical: sortAlphabeticalRef.current,
      }),
    );
  }, [bounty, sortAlphabetical]);

  // Save search state whenever results change (but not on initial load)
  useEffect(() => {
    const saveSearchState = async () => {
      // Only save if we have results and have completed initial load
      if (results.length > 0 && hasLoadedInitialSearch && searchQuery.trim() && !loading) {
        try {
          // Get current user's UID
          const userUid = await AsyncStorage.getItem("user_uid");

          if (!userUid) {
            console.log("⚠️ No user_uid found, cannot save search state");
            return;
          }

          // Save with user-specific keys
          await AsyncStorage.setItem(`last_search_query_${userUid}`, searchQuery);
          await AsyncStorage.setItem(`last_search_type_${userUid}`, JSON.stringify(selectedSearchTabs));
          const resultsToSave = rawResultsRef.current.length > 0 ? rawResultsRef.current : results;
          await AsyncStorage.setItem(`last_search_results_${userUid}`, JSON.stringify(resultsToSave));
          console.log("💾 Saved search state for user:", userUid, "Query:", searchQuery);
        } catch (error) {
          console.error("Error saving search state:", error);
        }
      }
    };

    saveSearchState();
  }, [results, searchQuery, selectedSearchTabs, hasLoadedInitialSearch, loading]);

  // Clear cart data when refreshCart is true
  useEffect(() => {
    const clearCartData = async () => {
      if (route.params?.refreshCart) {
        console.log("Clearing cart data due to refreshCart parameter");
        try {
          const keys = await AsyncStorage.getAllKeys();
          const cartKeys = keys.filter((key) => key.startsWith("cart_"));
          await Promise.all(cartKeys.map((key) => AsyncStorage.removeItem(key)));
          setCartCount(0);
          setCartItems([]);
          console.log("Cart data cleared successfully");
        } catch (error) {
          console.error("Error clearing cart data:", error);
        }
      }
    };

    clearCartData();
  }, [route.params?.refreshCart]);

  // Log results changes for debugging (runs only when results change, not on every render)
  useEffect(() => {
    if (!loading && results.length > 0) {
      console.log("🎨 Rendering results:", results.length, "items");
      // console.log("🎨 Results array:", results);
    }
  }, [results, loading]);

  const [showFilters, setShowFilters] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activeFilterMenu, setActiveFilterMenu] = useState(null);
  const [filterPanelDraft, setFilterPanelDraft] = useState({
    searchLocation: SEARCH_LOCATION_HOME,
    customSearchCity: null,
    distance: null,
    network: null,
    rating: null,
    bounty: null,
    sortAlphabetical: null,
  });
  const [showGlobalBusinesses, setShowGlobalBusinesses] = useState(true);
  const [showGlobalOrganizations, setShowGlobalOrganizations] = useState(true);
  const [showGlobalOffering, setShowGlobalOffering] = useState(true);
  const [showGlobalSeeking, setShowGlobalSeeking] = useState(true);
  const [showGlobalIndividuals, setShowGlobalIndividuals] = useState(true);

  const individualsSearchPlaceholder = "Email, location, or name";
  const defaultSearchPlaceholder = "What are you looking for?";
  const searchInputPlaceholder = selectedSearchTabs.individuals ? individualsSearchPlaceholder : defaultSearchPlaceholder;

  useEffect(() => {
    if (selectedSearchTabs.individuals) {
      rawResultsRef.current = [];
      setResults([]);
      setSearchSuggestions([]);
      setShowSearchSuggestions(false);
    }
  }, [selectedSearchTabs.individuals]);
  const distanceOptions = [5, 10, 15, 25, 50, 100];
  /** First modal row: omit user_lat / max_distance on Qdrant search. */
  const distanceModalOptions = [{ key: "any", label: "Any distance (no filter)", miles: null }, ...distanceOptions.map((d) => ({ key: String(d), label: `${d} mi`, miles: d }))];
  const networkOptions = [1, 2, 3, 4, 5];

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (isNonHomeSearchLocation(searchLocation)) count += 1;
    if (distance !== null) count += 1;
    if (network !== null) count += 1;
    if (bounty !== null) count += 1;
    if (sortAlphabetical !== null) count += 1;
    if (rating !== null) count += 1;
    return count;
  }, [searchLocation, distance, network, bounty, sortAlphabetical, rating]);

  const syncFilterPanelDraft = () => {
    setFilterPanelDraft({
      searchLocation,
      customSearchCity,
      distance,
      network,
      rating,
      bounty,
      sortAlphabetical,
    });
  };

  const clearCitySearchUi = useCallback(() => {
    if (citySuggestDebounceRef.current) clearTimeout(citySuggestDebounceRef.current);
    setCitySearchQuery("");
    setCitySuggestions([]);
    setCitySuggestionsLoading(false);
  }, []);

  const onCitySearchQueryChange = useCallback((text) => {
    setCitySearchQuery(text);
    if (citySuggestDebounceRef.current) clearTimeout(citySuggestDebounceRef.current);
    if (!text.trim()) {
      setCitySuggestions([]);
      setCitySuggestionsLoading(false);
      return;
    }
    setCitySuggestionsLoading(true);
    citySuggestDebounceRef.current = setTimeout(async () => {
      try {
        const results = await getCitySuggestions(text);
        setCitySuggestions(results);
      } catch (err) {
        console.error("[SearchScreen] city suggestions error:", err);
        setCitySuggestions([]);
      } finally {
        setCitySuggestionsLoading(false);
      }
    }, 350);
  }, []);

  const resolveCityFromPlace = useCallback(async (place) => {
    setCitySuggestionsLoading(true);
    try {
      const pd = await getPlaceDetails(place.place_id);
      if (pd.lat == null || pd.lng == null) {
        Alert.alert("Error", "Could not determine coordinates for this city.");
        return null;
      }
      const labelParts = [pd.city || place.structured_formatting?.main_text || place.description, pd.state, pd.country === "United States" ? null : pd.country].filter(Boolean);
      return buildCustomSearchCity({
        label: labelParts.join(", ") || place.description,
        lat: pd.lat,
        lng: pd.lng,
        placeId: place.place_id,
      });
    } catch (err) {
      console.error("[SearchScreen] city select error:", err);
      Alert.alert("Error", "Could not load city details. Please try again.");
      return null;
    } finally {
      setCitySuggestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (citySuggestDebounceRef.current) clearTimeout(citySuggestDebounceRef.current);
    };
  }, []);

  const handleFilterIconPress = () => {
    if (!showFilters) {
      syncFilterPanelDraft();
      setShowFilters(true);
      setShowFilterPanel(true);
      setActiveFilterMenu(null);
      clearCitySearchUi();
      return;
    }
    if (showFilterPanel) {
      setShowFilters(false);
      setShowFilterPanel(false);
      setActiveFilterMenu(null);
      clearCitySearchUi();
      return;
    }
    syncFilterPanelDraft();
    setShowFilterPanel(true);
    setActiveFilterMenu(null);
    clearCitySearchUi();
  };

  const toggleFilterMenu = (menuKey) => {
    setShowFilterPanel(false);
    setActiveFilterMenu((prev) => {
      const next = prev === menuKey ? null : menuKey;
      if (next !== "searchLocation") clearCitySearchUi();
      return next;
    });
  };

  const clearAllFilters = () => {
    setSearchLocation(SEARCH_LOCATION_HOME);
    setCustomSearchCity(null);
    clearCitySearchUi();
    setDistance(null);
    setNetwork(null);
    setRating(null);
    setBounty(null);
    setSortAlphabetical(null);
    setActiveFilterMenu(null);
    setFilterPanelDraft({
      searchLocation: SEARCH_LOCATION_HOME,
      customSearchCity: null,
      distance: null,
      network: null,
      rating: null,
      bounty: null,
      sortAlphabetical: null,
    });
    performSearch(searchQuery, {
      distanceMiles: null,
      networkValue: null,
      ratingValue: null,
      searchLocationValue: SEARCH_LOCATION_HOME,
      customSearchCityValue: null,
    });
  };

  const applyFilterPanel = () => {
    const nextSearchLocation = filterPanelDraft.searchLocation;
    const nextCustomCity = filterPanelDraft.customSearchCity;
    const nextDistance = filterPanelDraft.distance;
    const nextNetwork = filterPanelDraft.network;
    const nextRating = filterPanelDraft.rating;
    const nextBounty = filterPanelDraft.bounty;
    const nextSort = filterPanelDraft.sortAlphabetical;

    setSearchLocation(nextSearchLocation);
    setCustomSearchCity(nextSearchLocation === SEARCH_LOCATION_CUSTOM ? nextCustomCity : null);
    clearCitySearchUi();
    setDistance(nextDistance);
    setNetwork(nextNetwork);
    setRating(nextRating);
    setBounty(nextBounty);
    setSortAlphabetical(nextSort);
    setShowFilterPanel(false);
    setActiveFilterMenu(null);
    performSearch(searchQuery, {
      distanceMiles: nextDistance,
      networkValue: nextNetwork,
      ratingValue: nextRating,
      searchLocationValue: nextSearchLocation,
      customSearchCityValue: nextSearchLocation === SEARCH_LOCATION_CUSTOM ? nextCustomCity : null,
    });
  };

  const clearDistanceFilter = (reRunSearch = true) => {
    setDistance(null);
    setActiveFilterMenu(null);
    if (reRunSearch) {
      performSearch(searchQuery, { distanceMiles: null });
    }
  };

  const applyRatingFilter = (ratingValue) => {
    setRating(ratingValue);
    setActiveFilterMenu(null);
    performSearch(searchQuery, { ratingValue });
  };

  const applyNetworkFilter = (networkValue) => {
    setNetwork(networkValue);
    setActiveFilterMenu(null);
    performSearch(searchQuery, { networkValue });
  };

  /**
   * When a min rating is selected, exclude unrated businesses and those below threshold.
   * Non-business rows are left untouched.
   */
  const applyBusinessMinRatingFilter = (items, minRating) => {
    if (minRating == null) return items;
    return (items || []).filter((item) => {
      if (item?.itemType !== "businesses") return true;
      const r = item?.rating;
      return Number.isFinite(r) && r >= minRating;
    });
  };

  const filterResultsByNetwork = (items, maxDegree) => {
    if (maxDegree == null) return items;
    return (items || []).filter((item) => itemPassesNetworkFilter(item, maxDegree));
  };

  /** Send home coords for proximity ranking (independent of distance filter). */
  const appendHomeCoordsParams = (baseUrl, coords) => {
    if (coords?.lat == null || coords?.lng == null) return baseUrl;
    const sep = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${sep}user_lat=${encodeURIComponent(coords.lat)}&user_lon=${encodeURIComponent(coords.lng)}`;
  };

  /** Append Qdrant distance filter params (user home → result coordinates). */
  const appendDistanceParams = (baseUrl, miles, coords) => {
    if (miles == null || coords?.lat == null || coords?.lng == null) return baseUrl;
    const sep = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${sep}max_distance=${encodeURIComponent(miles)}`;
  };
  const bountyOptions = ["Ascending", "Descending"];
  const sortAlphabeticalOptions = ["Ascending", "Descending"];
  const sortAlphabeticalLabels = { Ascending: "A -> Z", Descending: "Z -> A" };
  const ratingOptions = ["> 1", "> 2", "> 3", "> 4", "> 4.5", "> 4.6", "> 4.8"];
  const showSearchResultsLoading = !hasLoadedInitialSearch || loading;
  const activeSearchCoords = resolveSearchLocationCoords(searchLocation, userHomeCoords, customSearchCity);

  const getSearchCardDistanceMiles = (item) => {
    if (distance == null) return null;
    return itemDistanceMiles(item, activeSearchCoords);
  };

  const renderBusinessCardHeaderAccessory = (item) => {
    if (distance != null) return null;
    if (item.location_boosted) {
      return <LocationBoostIcon darkMode={darkMode} distanceMiles={item.distance_miles} />;
    }
    return null;
  };

  const renderOfferingSearchDistance = (item) => {
    const miles = getSearchCardDistanceMiles(item);
    if (miles == null) return null;
    return (
      <View style={styles.searchCardMetaRowCentered}>
        <SearchCardDistanceLabel miles={miles} darkMode={darkMode} centered />
      </View>
    );
  };

  const renderOfferingNetworkBadge = (item) => {
    const networkDeg = getClosestNetworkDegree(item);
    if (networkDeg == null) return null;
    return <SearchCardNetworkBadge degree={networkDeg} darkMode={darkMode} />;
  };

  const businessSectionResultsAll = results.filter((item) => (item?.itemType || "businesses") === "businesses");
  const offeringSectionResultsAll = results.filter((item) => item?.itemType === "expertise");
  const seekingSectionResultsAll = results.filter((item) => item?.itemType === "seeking");
  const individualsSectionResults = results.filter((item) => item?.itemType === "individuals");

  // Keep all strong matches, but guarantee at least four visible results across
  // the selected tabs by backfilling with the highest-ranked weaker matches.
  // Show more: first tap adds 4 more; second tap reveals the rest.
  const selectedRankedResults = results.filter((item) => {
    const type = item?.itemType || "businesses";
    return (
      (type === "businesses" && (selectedSearchTabs.businesses || selectedSearchTabs.organizations)) ||
      (type === "expertise" && selectedSearchTabs.expertise) ||
      (type === "seeking" && selectedSearchTabs.seeking)
    );
  });
  const defaultVisibleResults = selectedRankedResults.filter(itemPassesRelevanceCutoff);
  if (!browseAllActive && defaultVisibleResults.length < 4) {
    const visibleSet = new Set(defaultVisibleResults);
    for (const item of selectedRankedResults) {
      if (visibleSet.has(item)) continue;
      defaultVisibleResults.push(item);
      visibleSet.add(item);
      if (defaultVisibleResults.length >= 4) break;
    }
  }
  const defaultVisibleResultSet = new Set(defaultVisibleResults);
  const remainingWeakerResults = selectedRankedResults.filter((item) => !defaultVisibleResultSet.has(item));
  const extraVisibleCount = browseAllActive || showMoreStage >= 2 ? remainingWeakerResults.length : showMoreStage >= 1 ? Math.min(4, remainingWeakerResults.length) : 0;
  const visibleResultSet = new Set([...defaultVisibleResults, ...remainingWeakerResults.slice(0, extraVisibleCount)]);
  const shouldDisplayResult = (item) => browseAllActive || visibleResultSet.has(item);

  const businessSectionResults = businessSectionResultsAll.filter(shouldDisplayResult);
  const offeringSectionResults = offeringSectionResultsAll.filter(shouldDisplayResult);
  const seekingSectionResults = seekingSectionResultsAll.filter(shouldDisplayResult);

  const hiddenWeakerMatchCount = browseAllActive ? 0 : Math.max(0, selectedRankedResults.length - visibleResultSet.size);
  const showMoreButtonVisible = !browseAllActive && (hiddenWeakerMatchCount > 0 || showMoreStage > 0);
  const nextShowMoreCount = showMoreStage === 0 ? Math.min(4, hiddenWeakerMatchCount) : hiddenWeakerMatchCount;
  const showMoreButtonLabel =
    showMoreStage >= 2 || hiddenWeakerMatchCount === 0
      ? "Show fewer"
      : showMoreStage === 0
        ? `Show more (${nextShowMoreCount})`
        : `Show all (${hiddenWeakerMatchCount})`;

  const handleShowMorePress = () => {
    if (showMoreStage >= 2 || hiddenWeakerMatchCount === 0) {
      setShowMoreStage(0);
      return;
    }
    if (showMoreStage === 0) {
      // If 4 or fewer remain, first tap already shows everything.
      setShowMoreStage(hiddenWeakerMatchCount <= 4 ? 2 : 1);
      return;
    }
    setShowMoreStage(2);
  };

  const handleOpenSearchMap = useCallback(async () => {
    const isProfileType = selectedSearchTabs.expertise || selectedSearchTabs.seeking;
    const showBusinessMapResults = selectedSearchTabs.businesses || selectedSearchTabs.organizations;

    const visibleResults = [
      ...(showBusinessMapResults ? businessSectionResults : []),
      ...(selectedSearchTabs.expertise ? offeringSectionResults : []),
      ...(selectedSearchTabs.seeking ? seekingSectionResults : []),
    ];

    if (visibleResults.length === 0) {
      Alert.alert("No results", "Select at least one tab and run a search to see results on the map.");
      return;
    }

    const mapMarkers =
      isProfileType && !showBusinessMapResults
        ? searchResultsToMapProfiles(visibleResults)
        : showBusinessMapResults
          ? searchResultsToMapBusinesses(businessSectionResults)
          : searchResultsToMapProfiles(visibleResults);

    // Search API may not include profile coordinates — fetch them from the profile endpoint
    if (isProfileType && mapMarkers.length === 0) {
      const needsCoords = visibleResults.filter((item) => item.profile_uid && (item.profile_personal_latitude == null || item.profile_personal_longitude == null));
      if (needsCoords.length > 0) {
        setMapLoading(true);
        try {
          const enriched = await Promise.all(
            needsCoords.map(async (item) => {
              try {
                const res = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${encodeURIComponent(item.profile_uid)}`);
                const json = await res.json();
                const pi = json.personal_info || {};
                return {
                  ...item,
                  profile_personal_latitude: pi.profile_personal_latitude ?? null,
                  profile_personal_longitude: pi.profile_personal_longitude ?? null,
                };
              } catch {
                return item;
              }
            }),
          );
          mapMarkers = searchResultsToMapProfiles(enriched);
        } catch (e) {
          console.warn("[Map] profile coordinate fetch failed:", e);
        } finally {
          setMapLoading(false);
        }
      }
    }

    if (mapMarkers.length === 0) {
      Alert.alert("No location data", "None of the current results have a home location set in their profile.");
      return;
    }

    navigation.navigate("EveryCircleMap", {
      fromSearch: true,
      searchQuery: searchQuery.trim(),
      searchMapBusinesses: mapMarkers,
      searchResultCount: visibleResults.length,
      selectedSearchTabs,
    });
  }, [businessSectionResults, navigation, offeringSectionResults, results, searchQuery, seekingSectionResults, selectedSearchTabs]);
  /** Append home coords and optional max_distance for business distance filtering / proximity boost. */
  const appendLocationSearchParams = (baseUrl, { distanceMiles, coords, sendProximityCoords = false }) => {
    let apiUrl = baseUrl;
    const shouldSendCoords = sendProximityCoords || distanceMiles != null;
    if (shouldSendCoords && coords?.lat != null && coords?.lng != null) {
      apiUrl = appendHomeCoordsParams(apiUrl, coords);
    }
    if (distanceMiles != null && coords?.lat != null && coords?.lng != null) {
      apiUrl = appendDistanceParams(apiUrl, distanceMiles, coords);
    }
    return apiUrl;
  };

  const fetchSearchJson = async (endpoint, q, { applyRatingFilter = false, distanceMiles = distance, ratingValue = rating, homeCoords = userHomeCoords, isBrowseAll = false } = {}) => {
    const limitParam = isBrowseAll ? "ALL" : SEARCH_RESULT_LIMIT;
    let apiUrl = `${endpoint}?q=${encodeURIComponent(q)}&limit=${limitParam}`;
    if (applyRatingFilter && ratingValue !== null) {
      apiUrl += `&min_rating=${ratingValue}`;
    }
    apiUrl = appendLocationSearchParams(apiUrl, {
      distanceMiles,
      coords: homeCoords,
      sendProximityCoords: true,
    });

    const fetchOptions =
      Platform.OS === "web"
        ? {
            method: "GET",
            mode: "cors",
            credentials: "omit",
            headers: { Accept: "application/json" },
            cache: "no-cache",
          }
        : {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          };

    const res = await fetch(apiUrl, fetchOptions);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP error! status: ${res.status}, message: ${errorText}`);
    }
    const responseText = await res.text();
    if (!responseText.trim().startsWith("{") && !responseText.trim().startsWith("[")) {
      throw new Error(`API returned non-JSON response: ${responseText.substring(0, 200)}`);
    }
    return JSON.parse(responseText);
  };

  // Extracted search function that can be called programmatically
  const performSearch = async (query, opts = {}) => {
    const q = query.trim();
    const isBrowseAll = !q;
    const searchGeneration = ++searchGenerationRef.current;
    browseAllActiveRef.current = isBrowseAll;
    setBrowseAllActive(isBrowseAll);
    const effectiveDistance = opts.distanceMiles !== undefined ? opts.distanceMiles : distance;
    const effectiveRating = opts.ratingValue !== undefined ? opts.ratingValue : rating;
    const effectiveNetwork = opts.networkValue !== undefined ? opts.networkValue : network;
    const effectiveSearchLocation = opts.searchLocationValue !== undefined ? opts.searchLocationValue : searchLocation;
    const effectiveCustomCity = opts.customSearchCityValue !== undefined ? opts.customSearchCityValue : customSearchCity;
    if (opts.searchLocationValue !== undefined) {
      setSearchLocation(opts.searchLocationValue);
    }
    if (opts.customSearchCityValue !== undefined) {
      setCustomSearchCity(opts.customSearchCityValue);
    }

    if (selectedSearchTabsRef.current.individuals) {
      setLoading(true);
      try {
        if (!q || q.length < 2) {
          if (searchGeneration !== searchGenerationRef.current) return;
          commitSearchResults([], { browseAll: false });
          setHasLoadedInitialSearch(true);
          return;
        }

        const [profiles, networkByUid] = await Promise.all([searchReferralProfiles(q), loadReferralNetworkByUid()]);
        const list = profiles.map((profile) => mapReferralProfileToSearchItem(profile, networkByUid.get(profile.profile_personal_uid)));
        if (searchGeneration !== searchGenerationRef.current) return;
        commitSearchResults(list, { browseAll: false });
        setHasLoadedInitialSearch(true);
      } catch (error) {
        console.error("Individual search failed:", error);
        if (searchGeneration === searchGenerationRef.current) {
          commitSearchResults([], { browseAll: false });
        }
      } finally {
        if (searchGeneration === searchGenerationRef.current) {
          setLoading(false);
        }
      }
      return;
    }

    let searchCoords = resolveSearchLocationCoords(effectiveSearchLocation, userHomeCoords, effectiveCustomCity);
    if (effectiveSearchLocation === SEARCH_LOCATION_HOME && (effectiveDistance != null || searchTypeSupportsDistanceFilter())) {
      const freshCoords = await loadUserHomeCoords();
      if (freshCoords?.lat != null && freshCoords?.lng != null) {
        searchCoords = freshCoords;
      }
    }

    if (effectiveDistance != null && (searchCoords.lat == null || searchCoords.lng == null)) {
      const alertMessage =
        effectiveSearchLocation === SEARCH_LOCATION_HOME
          ? "Set your home address coordinates in Settings to filter search results by distance."
          : "Unable to use the selected search location for distance filtering.";
      Alert.alert("Location needed", alertMessage, [
        { text: "Cancel", style: "cancel" },
        ...(effectiveSearchLocation === SEARCH_LOCATION_HOME
          ? [{ text: "Open Settings", onPress: () => navigation.navigate("Settings") }]
          : []),
      ]);
      return;
    }

    console.log("🔍 Performing search for:", isBrowseAll ? "(browse all)" : q);
    console.log("🔍 Browse all mode:", isBrowseAll);
    console.log("🔍 Selected tabs:", selectedSearchTabsRef.current);
    console.log("🔍 Search query length:", q.length);
    console.log("🔍 Search query type:", typeof q);
    console.log("🔍 Rating filter:", effectiveRating);
    console.log("🔍 Network filter:", effectiveNetwork);
    console.log("🔍 Distance filter (mi):", effectiveDistance);
    console.log("🔍 Search location:", getSearchLocationFullLabel(effectiveSearchLocation, effectiveCustomCity));
    console.log("🔍 Search coords:", searchCoords);

    setLoading(true);
    try {
      // Multi-type combined search via /search_global (Global tab hidden in UI).
      const globalJsonRaw = await fetchSearchJson(SEARCH_GLOBAL_ENDPOINT, q, {
        applyRatingFilter: true,
        distanceMiles: effectiveDistance,
        ratingValue: effectiveRating,
        homeCoords: searchCoords,
        isBrowseAll,
      });
      const globalJson = sanitizeEmptyStrings(globalJsonRaw);
      const globalResults = Array.isArray(globalJson) ? globalJson : globalJson.results || globalJson.result || [];
      const businessResults = globalResults.filter((item) => item.itemType === "businesses");
      const expertiseResults = globalResults.filter((item) => item.itemType === "expertise");
      const seekingResults = globalResults.filter((item) => item.itemType === "seeking");

      const sanitizeText = (text) => {
        if (!text) return "";
        const str = String(text).trim();
        return str === "." ? "" : str;
      };

      const mappedBusinesses = businessResults.map((b, i) => ({
        ...b,
        id: `${b.business_uid || i}`,
        business_uid: b.business_uid ? String(b.business_uid).trim() : null,
        company: sanitizeText(b.business_name || b.company) || "Unknown Business",
        business_profile_img: b.business_profile_img ? b.business_profile_img.trim() : null,
        rating: null,
        ratingCount: 0,
        connection_degree: null,
        max_bounty: null,
        max_per_item_bounty: null,
        max_total_bounty: null,
        hasPriceTag: b.has_price_tag || false,
        hasX: b.has_x || false,
        hasDollar: b.has_dollar_sign || false,
        business_short_bio: sanitizeText(b.business_short_bio),
        business_tag_line: sanitizeText(b.business_tag_line),
        tags: b.tags || [],
        score: b.score || 0,
        score_breakdown: b.score_breakdown || null,
        passes_relevance_cutoff: b.passes_relevance_cutoff !== false,
        itemType: "businesses",
        profile_uid: b.profile_personal_uid || b.business_profile_personal_uid || b.owner_profile_uid || null,
        ...searchBusinessLocationFieldsFromApi(b),
        ...locationFieldsFromApi(b),
      }));

      const mappedExpertise = expertiseResults.filter(shouldIncludeSearchExpertiseRow).map((item, i) => mapSearchExpertiseRow(item, i));
      const mappedSeeking = seekingResults
        .filter(shouldIncludeSearchSeekingRow)
        .map((item, i) => mapSearchWishRow(item, i))
        .filter((item) => !isWishEnded(item));

      const normalizeByType = (items) => {
        if (!items.length) return [];
        const maxScore = Math.max(...items.map((x) => Number(x.score) || 0), 0.000001);
        return items.map((x) => ({ ...x, globalScore: (Number(x.score) || 0) / maxScore }));
      };

      let list;
      if (isBrowseAll) {
        list = [...mappedBusinesses, ...mappedExpertise, ...mappedSeeking];
      } else {
        list = [...normalizeByType(mappedBusinesses), ...normalizeByType(mappedExpertise), ...normalizeByType(mappedSeeking)].sort((a, b) => b.globalScore - a.globalScore);
      }
      const enriched = await enrichBusinessSearchResultsWithAvgRatingsAndMaxBounty(list);
      const withOfferingDegrees = await enrichOfferingOwnerConnectionDegrees(enriched);
      let filteredEnriched = applyBusinessMinRatingFilter(withOfferingDegrees, effectiveRating);
      filteredEnriched = filterResultsByNetwork(filteredEnriched, effectiveNetwork);
      filteredEnriched = applyDistanceFilterToSearchResults(filteredEnriched, effectiveDistance, searchCoords);
      if (searchGeneration !== searchGenerationRef.current) return;
      commitSearchResults(filteredEnriched, { browseAll: isBrowseAll });
      setHasLoadedInitialSearch(true);
      setLoading(false);
      return;

      if (false) {
        // LEGACY single-tab search — kept for reference while Global tab is hidden.
        // Select the appropriate endpoint based on search type
        let baseEndpoint;
        switch (type) {
          case "expertise":
            baseEndpoint = EXPERTISE_RESULTS_ENDPOINT;
            break;
          case "seeking":
            baseEndpoint = WISHES_RESULTS_ENDPOINT;
            break;
          case "businesses":
          default:
            baseEndpoint = BUSINESS_RESULTS_ENDPOINT;
            break;
        }

        // Build the API URL with query parameter
        const limitParam = isBrowseAll ? "ALL" : SEARCH_RESULT_LIMIT;
        let apiUrl = `${baseEndpoint}?q=${encodeURIComponent(q)}&limit=${limitParam}`;

        // Add min_rating parameter if rating filter is set
        if (effectiveRating !== null) {
          apiUrl += `&min_rating=${effectiveRating}`;
        }
        if (searchTypeSupportsDistanceFilter(type)) {
          apiUrl = appendLocationSearchParams(apiUrl, {
            distanceMiles: effectiveDistance,
            coords: searchCoords,
            sendProximityCoords: type === "global" || type === "businesses",
          });
        }

        console.log("🎯 EXACT ENDPOINT BEING CALLED:", apiUrl);

        // Add CORS mode and headers for web requests
        const fetchOptions =
          Platform.OS === "web"
            ? {
                method: "GET",
                mode: "cors",
                credentials: "omit", // Don't send credentials for CORS
                // Don't include Content-Type for GET requests to avoid preflight
                headers: {
                  Accept: "application/json",
                },
                cache: "no-cache",
              }
            : {
                method: "GET",
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                },
              };

        console.log("📡 Fetch options:", JSON.stringify(fetchOptions, null, 2));

        let res;
        try {
          res = await fetch(apiUrl, fetchOptions);
        } catch (fetchError) {
          console.error("❌ Fetch error details:", fetchError);
          console.error("❌ Error name:", fetchError.name);
          console.error("❌ Error message:", fetchError.message);

          // Try with no-cors mode as a fallback (limited but might work)
          if (Platform.OS === "web" && fetchError.message === "Failed to fetch") {
            console.warn("⚠️ CORS error detected, trying no-cors mode as fallback...");
            try {
              const noCorsOptions = {
                method: "GET",
                mode: "no-cors", // This bypasses CORS but we can't read response headers
                credentials: "omit",
                cache: "no-cache",
              };
              res = await fetch(apiUrl, noCorsOptions);
              console.log("✅ no-cors request succeeded, but response may be opaque");
              // Note: With no-cors, we can't read response headers or check status properly
              // The response will be "opaque" - we can only read the body
            } catch (noCorsError) {
              console.error("❌ no-cors fallback also failed:", noCorsError);
              throw new Error(
                `CORS Error: The search server at ${SEARCH_BASE_URL} is not allowing requests from http://localhost:8081.\n\n` +
                  `To fix this, the server needs to:\n` +
                  `1. Allow requests from http://localhost:8081 (or your production domain)\n` +
                  `2. Include CORS headers: Access-Control-Allow-Origin, Access-Control-Allow-Methods\n\n` +
                  `You can test the endpoint directly in your browser:\n${apiUrl}\n\n` +
                  `Note: The server must respond to OPTIONS preflight requests with proper CORS headers.`,
              );
            }
          } else {
            throw fetchError;
          }
        }

        // Check if response is opaque (from no-cors mode)
        const isOpaque = res.type === "opaque" || res.type === "opaqueredirect";

        if (!isOpaque) {
          console.log("📡 Response status:", res.status);
          console.log("📡 Response ok:", res.ok);
          console.log("📡 Response headers:", Object.fromEntries(res.headers.entries()));
        }

        // Check if response is ok (skip check for opaque responses)
        if (!isOpaque && !res.ok) {
          const errorText = await res.text();
          console.error("❌ Response error text:", errorText);
          throw new Error(`HTTP error! status: ${res.status}, message: ${errorText}`);
        }

        // Get raw response text first
        const responseText = await res.text();
        console.log("📄 Raw response text length:", responseText.length);
        console.log("📄 Raw response text (first 500 chars):", responseText.substring(0, 500));

        // Check if response looks like JSON
        if (!responseText.trim().startsWith("{") && !responseText.trim().startsWith("[")) {
          console.error("❌ Response is not JSON. First 200 chars:", responseText.substring(0, 200));
          throw new Error(`API returned non-JSON response: ${responseText.substring(0, 200)}`);
        }

        // Parse JSON
        let json;
        try {
          json = JSON.parse(responseText);
          console.log("✅ JSON parsed successfully");
          console.log("📊 JSON type:", typeof json);
          console.log("📊 Is array?", Array.isArray(json));
          console.log("📊 JSON keys:", typeof json === "object" && json !== null ? Object.keys(json) : "N/A");
        } catch (parseError) {
          console.error("❌ JSON parse error:", parseError);
          console.error("❌ Response text that failed to parse:", responseText.substring(0, 500));
          throw new Error(`Failed to parse JSON response: ${parseError.message}`);
        }

        // Sanitize empty strings ("", " ") to null for expertise and wishes endpoints to prevent downstream errors
        if (type === "expertise" || type === "seeking") {
          json = sanitizeEmptyStrings(json);
        }

        // console.log("📡 Search API Response:", JSON.stringify(json, null, 2));
        // console.log("📊 Number of results returned:", Array.isArray(json) ? json.length : json.results?.length || json.result?.length || 0);

        // Handle both possible response structures
        // console.log("🔍 Raw JSON response:", json);
        // console.log("🔍 JSON type:", typeof json);
        // console.log("🔍 Is array?", Array.isArray(json));

        // The API returns an array directly, not wrapped in results/result
        const resultsArray = Array.isArray(json) ? json : json.results || json.result || [];
        console.log("🔍 Results array length:", resultsArray.length);
        // console.log("🔍 Results array length:", resultsArray.length);

        // Process results based on search type
        let list;
        if (type === "seeking") {
          // For seeking/wishes, the response includes profile data directly
          list = resultsArray
            .filter(shouldIncludeSearchSeekingRow)
            .map((item, i) => ({
              id: `${item.profile_wish_uid || i}`,
              company: item.profile_wish_title || "Untitled Wish",
              rating: typeof item.score === "number" ? Math.min(5, Math.max(1, Math.round(item.score * 5))) : 4,
              hasPriceTag: false,
              hasX: false,
              hasDollar: false,
              //hasBounty: b.has_bounty || b.business_bounty || false,
              hasBounty: item.profile_wish_bounty ? true : false,
              business_short_bio: item.profile_wish_description || "",
              business_tag_line: item.profile_wish_title || "",
              tags: [],
              score: item.score || 0,
              score_breakdown: item.score_breakdown || null,
              itemType: "seeking",
              profile_uid: item.profile_wish_profile_personal_id,
              profile_wish_end: item.profile_wish_end || "",
              profile_personal_moderated: item.profile_personal_moderated ?? item.owner_profile_moderated ?? null,
              ...locationFieldsFromApi(item),
              profile_personal_latitude: item.profile_personal_latitude ?? null,
              profile_personal_longitude: item.profile_personal_longitude ?? null,
              // Store wish data
              wishData: {
                title: item.profile_wish_title,
                description: item.profile_wish_description,
                bounty: item.profile_wish_bounty,
                cost: item.profile_wish_cost,
                wish_uid: item.profile_wish_uid,
                profile_wish_quantity: item.profile_wish_quantity || "",
                profile_wish_image: item.profile_wish_image || "",
                profile_wish_image_is_public: item.profile_wish_image_is_public,
                profile_wish_start: item.profile_wish_start || "",
                profile_wish_end: item.profile_wish_end || "",
                profile_wish_location: item.profile_wish_location || "",
                profile_wish_latitude: item.profile_wish_latitude ?? null,
                profile_wish_longitude: item.profile_wish_longitude ?? null,
                profile_wish_mode: item.profile_wish_mode || "",
                profile_wish_city: item.profile_wish_city || "",
                profile_wish_state: item.profile_wish_state || "",
                profile_wish_bounty_type: item.profile_wish_bounty_type || (item.profile_wish_bounty ? "per_item" : "none"),
                profile_wish_updated_at: item.profile_wish_updated_at ?? item.updated_at,
                profile_wish_moderated: item.profile_wish_moderated,
                profile_personal_moderated: item.profile_personal_moderated ?? item.owner_profile_moderated ?? null,
                moderation: item.moderation,
              },
              // Store profile data for MiniCard-like display
              profileData: {
                firstName: item.profile_personal_first_name || "",
                lastName: item.profile_personal_last_name || "",
                email: item.user_email_id || "",
                phone: item.profile_personal_phone_number || "",
                image: item.profile_personal_image || "",
                tagLine: item.profile_personal_tag_line || "",
                emailIsPublic: item.profile_personal_email_is_public == 1,
                phoneIsPublic: item.profile_personal_phone_number_is_public == 1,
                imageIsPublic: item.profile_personal_image_is_public == 1,
                tagLineIsPublic: item.profile_personal_tag_line_is_public == 1,
              },
            }))
            .filter((item) => !isWishEnded(item));
          // try {
          //   const profileFetches = list.map(async (item) => {
          //     if (!item.profile_uid) return item;
          //     try {
          //       const profileRes = await fetch(`${USER_PROFILE_INFO_ENDPOINT}/${item.profile_uid}`);
          //       const profileJson = await profileRes.json();
          //       const p = profileJson.personal_info || {};
          //       return {
          //         ...item,
          //         profileData: {
          //           firstName: p.profile_personal_first_name || "",
          //           lastName: p.profile_personal_last_name || "",
          //           email: p.user_email_id || "",
          //           phone: p.profile_personal_phone_number || "",
          //           image: p.profile_personal_image || "",
          //           tagLine: p.profile_personal_tag_line || "",
          //           emailIsPublic: p.profile_personal_email_is_public == 1,
          //           phoneIsPublic: p.profile_personal_phone_number_is_public == 1,
          //           imageIsPublic: p.profile_personal_image_is_public == 1,
          //           tagLineIsPublic: p.profile_personal_tag_line_is_public == 1,
          //         },
          //       };
          //     } catch (e) {
          //       return item;
          //     }
          //   });
          //   list = await Promise.all(profileFetches);
          // } catch (e) {
          //   console.log("Could not fetch wish profiles:", e);
          // }
        } else if (type === "expertise") {
          // For expertise, the response includes profile data directly
          list = resultsArray.filter(shouldIncludeSearchExpertiseRow).map((item, i) => ({
              id: `${item.profile_expertise_uid || i}`,
              company: item.profile_expertise_title || "Untitled Expertise",
              rating: typeof item.score === "number" ? Math.min(5, Math.max(1, Math.round(item.score * 5))) : 4,
              hasPriceTag: false,
              hasX: false,
              hasDollar: false,
              business_short_bio: item.profile_expertise_description || "",
              business_tag_line: item.profile_expertise_title || "",
              tags: [],
              score: item.score || 0,
              score_breakdown: item.score_breakdown || null,
              itemType: "expertise",
              profile_uid: item.profile_expertise_profile_personal_id || item.profile_personal_uid || item.expertise_owner_profile_uid || null,
              profile_personal_moderated: item.profile_personal_moderated ?? item.owner_profile_moderated ?? null,
              ...locationFieldsFromApi(item),
              profile_personal_latitude: item.profile_personal_latitude ?? null,
              profile_personal_longitude: item.profile_personal_longitude ?? null,
              expertiseData: {
                title: item.profile_expertise_title,
                description: item.profile_expertise_description,
                details: item.profile_expertise_details,
                bounty: item.profile_expertise_bounty,
                cost: item.profile_expertise_cost,
                quantity: item.profile_expertise_quantity || item.quantity,
                profile_expertise_quantity: item.profile_expertise_quantity || item.quantity,
                expertise_uid: item.profile_expertise_uid,
                profile_expertise_start: item.profile_expertise_start || "",
                profile_expertise_end: item.profile_expertise_end || "",
                profile_expertise_location: item.profile_expertise_location || "",
                profile_expertise_mode: item.profile_expertise_mode || "",
                profile_expertise_image: item.profile_expertise_image || "",
                profile_expertise_image_is_public: item.profile_expertise_image_is_public,
                profile_expertise_updated_at: item.profile_expertise_updated_at ?? item.updated_at,
                profile_expertise_moderated: item.profile_expertise_moderated,
                profile_personal_moderated: item.profile_personal_moderated ?? item.owner_profile_moderated ?? null,
                moderation: item.moderation,
                profile_expertise_bounty_type: item.profile_expertise_bounty_type || "none",
                profile_expertise_is_taxable: item.profile_expertise_is_taxable,
                profile_expertise_tax_rate: item.profile_expertise_tax_rate || "",
                profile_expertise_condition_type: item.profile_expertise_condition_type || "na",
                profile_expertise_condition_detail: item.profile_expertise_condition_detail || "",
                profile_expertise_is_returnable: item.profile_expertise_is_returnable ?? 0,
                profile_expertise_return_window_days: item.profile_expertise_return_window_days || "",
                profile_expertise_free_shipping: item.profile_expertise_free_shipping ?? 0,
                profile_expertise_buyer_pays_shipping: item.profile_expertise_buyer_pays_shipping ?? 0,
                profile_expertise_refund_policy: item.profile_expertise_refund_policy || "",
              },
              // Store profile data for MiniCard-like display (all public info for Add to Cart modal)
              profileData: {
                firstName: item.profile_personal_first_name || "",
                lastName: item.profile_personal_last_name || "",
                email: item.user_email_id || "",
                phone: item.profile_personal_phone_number || "",
                image: item.profile_personal_image || "",
                tagLine: item.profile_personal_tag_line || "",
                city: item.profile_personal_city || "",
                state: item.profile_personal_state || "",
                emailIsPublic: item.profile_personal_email_is_public == 1,
                phoneIsPublic: item.profile_personal_phone_number_is_public == 1,
                imageIsPublic: item.profile_personal_image_is_public == 1,
                tagLineIsPublic: item.profile_personal_tag_line_is_public == 1,
                locationIsPublic: item.profile_personal_location_is_public == 1,
              },
            }));
        } else {
          // For businesses, use the existing mapping
          const sanitizeText = (text) => {
            if (!text) return "";
            const str = String(text).trim();
            return str === "." ? "" : str;
          };

          list = resultsArray.map((b, i) => {
            console.log("All image fields:", b.business_profile_img, b.business_images_url, b.business_favorite_image, b.business_name);
            console.log("Business profile img:", b.business_profile_img, b.business_name);
            return {
              id: `${b.business_uid || i}`,
              business_uid: b.business_uid ? String(b.business_uid).trim() : null,
              company: sanitizeText(b.business_name || b.company) || "Unknown Business",
              business_profile_img: b.business_profile_img ? b.business_profile_img.trim() : null,
              rating: typeof b.rating_star === "number" ? b.rating_star : null,
              hasPriceTag: b.has_price_tag || false,
              hasX: b.has_x || false,
              hasDollar: b.has_dollar_sign || false,
              max_bounty: parseSearchMaxBounty(b.max_bounty ?? b.business_max_bounty),
              business_short_bio: sanitizeText(b.business_short_bio),
              business_tag_line: sanitizeText(b.business_tag_line),
              tags: b.tags || [],
              score: b.score || 0,
              score_breakdown: b.score_breakdown || null,
              itemType: "businesses",
              profile_uid: b.profile_personal_uid || b.business_profile_personal_uid || b.owner_profile_uid || null,
              ...searchBusinessLocationFieldsFromApi(b),
              ...locationFieldsFromApi(b),
            };
          });

          // Run tag search in parallel with main search — disabled for testing without businesstagsearch
          /*
        try {
          const tagRes = await fetch(`${BUSINESS_TAG_SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}`);
          const tagJson = await tagRes.json();
          const tagResults = tagJson.result || [];

          if (tagResults.length > 0) {
            const existingIds = new Set(list.map((b) => b.id));
            const sanitizeText = (text) => {
              if (!text) return "";
              const str = String(text).trim();
              return str === "." ? "" : str;
            };
            const tagList = tagResults
              .filter((b) => !existingIds.has(b.business_uid))
              .map((b) => ({
                id: b.business_uid,
                company: sanitizeText(b.business_name) || "Unknown Business",
                business_profile_img: b.business_profile_img ? b.business_profile_img.trim() : null,
                rating: null,
                hasPriceTag: false,
                hasX: false,
                hasDollar: false,
                business_short_bio: sanitizeText(b.business_short_bio),
                business_tag_line: sanitizeText(b.business_tag_line),
                tags: b.tags || [], // ← now includes tags
                score: 0,
                score_breakdown: null,
                itemType: "businesses",
              }));
            list = [...list, ...tagList];
            console.log("✅ Tag search added", tagList.length, "additional results");
          }
        } catch (e) {
          console.log("Could not fetch tag search results:", e);
        }
        */

          list = await enrichBusinessSearchResultsWithAvgRatingsAndMaxBounty(list);
          list = applyBusinessMinRatingFilter(list, effectiveRating);
          list = filterResultsByNetwork(list, effectiveNetwork);

          // Sort by highest rating if rating filter is active
          if (effectiveRating !== null) {
            list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
          }
        }

        if (type === "expertise" || type === "seeking") {
          list = await enrichOfferingOwnerConnectionDegrees(list);
          list = filterResultsByNetwork(list, effectiveNetwork);
        }

        if (searchTypeSupportsDistanceFilter(type)) {
          list = applyDistanceFilterToSearchResults(list, effectiveDistance, searchCoords);
        }

        if (searchGeneration !== searchGenerationRef.current) return;

        console.log("Processed search results:", list.length, "items");
        commitSearchResults(list, { browseAll: isBrowseAll });
        setHasLoadedInitialSearch(true);
      }
    } catch (err) {
      console.error(" Search failed for query:", q, "Error:", err);

      if (err.message.includes("Network request failed") || err.message.includes("Failed to fetch")) {
        Alert.alert("Network Error", "Unable to connect to the search server. Please check your internet connection or try again later.", [{ text: "OK" }]);
        setResults([]);
        return;
      }

      if (err.message.includes("404")) {
        console.log("🔄 Trying alternative endpoints...");
        await tryAlternativeEndpoints(q);
      } else {
        setResults([]);
      }
    }
    setLoading(false);
  };

  const onSearch = async () => {
    dismissSearchSuggestions();
    await performSearch(searchQuery);
  };

  const tryAlternativeEndpoints = async (query) => {
    const alternativeEndpoints = [
      // `${BUSINESS_RESULTS_ENDPOINT}/${encodeURIComponent(query)}`,
      // `${TAG_SEARCH_DISTINCT_ENDPOINT}/${encodeURIComponent(query)}`,
      // `${TAG_CATEGORY_DISTINCT_ENDPOINT}/${encodeURIComponent(query)}`
      `${TAG_SEARCH_DISTINCT_ENDPOINT}/${encodeURIComponent(query)}`,
      `${TAG_CATEGORY_DISTINCT_ENDPOINT}/${encodeURIComponent(query)}`,
    ];

    for (const endpoint of alternativeEndpoints) {
      try {
        console.log("🔄 Trying alternative endpoint:", endpoint);

        // Add CORS mode for web requests
        const altFetchOptions =
          Platform.OS === "web"
            ? {
                method: "GET",
                mode: "cors",
                credentials: "omit",
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                },
                cache: "no-cache",
              }
            : {
                method: "GET",
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                },
              };

        const res = await fetch(endpoint, altFetchOptions);

        if (res.ok) {
          const responseText = await res.text();
          if (responseText.trim().startsWith("{") || responseText.trim().startsWith("[")) {
            const json = JSON.parse(responseText);
            console.log("✅ Alternative endpoint worked! Response:", JSON.stringify(json, null, 2));

            // Handle both possible response structures
            const resultsArray = json.results || json.result || [];

            // Sanitize text fields to prevent periods from being rendered as text nodes
            const sanitizeText = (text) => {
              if (!text) return "";
              const str = String(text).trim();
              // If it's just a period or starts with a period that might cause issues, return empty
              return str === "." ? "" : str;
            };

            const list = resultsArray.map((b, i) => ({
              id: `${b.business_uid || i}`,
              company: sanitizeText(b.business_name || b.company) || "Unknown Business",
              business_profile_img: b.business_profile_img || null,
              // Use score as rating if rating_star not available, convert to 1-5 scale
              rating: typeof b.rating_star === "number" ? b.rating_star : null,
              hasPriceTag: b.has_price_tag || false,
              hasX: b.has_x || false,
              hasDollar: b.has_dollar_sign || false,
              // Add additional fields from the API response - sanitize to prevent period issues
              business_short_bio: sanitizeText(b.business_short_bio),
              business_tag_line: sanitizeText(b.business_tag_line),
              tags: b.tags || [],
              score: b.score || 0,
              score_breakdown: b.score_breakdown || null,
            }));

            console.log("✅ Processed results from alternative endpoint:", list);
            setResults(list);
            return;
          }
        }
      } catch (error) {
        console.log("❌ Alternative endpoint failed:", endpoint, error.message);
      }
    }

    console.log("❌ All endpoints failed, showing empty results");
    setResults([]);
  };

  // Render option chip for inline filter menus / panel
  const renderFilterChip = (label, selected, onPress, key) => (
    <TouchableOpacity
      key={key || label}
      style={[styles.filterChip, darkMode && styles.darkFilterChip, selected && styles.filterChipSelected, darkMode && selected && styles.darkFilterChipSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.filterChipText, darkMode && styles.darkFilterChipText, selected && styles.filterChipTextSelected, darkMode && selected && styles.darkFilterChipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderFilterPanelSection = (title, hint, children, options = {}) => (
    <View style={styles.filterPanelSection}>
      <Text style={[styles.filterPanelSectionTitle, darkMode && styles.darkFilterPanelSectionTitle]}>{title}</Text>
      {hint ? <Text style={[styles.filterPanelHint, darkMode && styles.darkFilterPanelHint]}>{hint}</Text> : null}
      {options.content || null}
      {children != null ? <View style={styles.filterChipRow}>{children}</View> : null}
    </View>
  );

  const renderCitySearchPicker = ({ selectedLocation, selectedCustomCity, onSelectPreset, onSelectCustomCity, compact = false }) => (
    <View style={styles.citySearchPicker}>
      <TextInput
        style={[styles.citySearchInput, darkMode && styles.darkCitySearchInput]}
        placeholder='Enter a city…'
        placeholderTextColor={darkMode ? "#999" : "#888"}
        value={citySearchQuery}
        onChangeText={onCitySearchQueryChange}
        autoCapitalize='words'
        autoCorrect={false}
      />
      {citySuggestionsLoading ? <ActivityIndicator size='small' color={darkMode ? "#fff" : "#333"} style={styles.citySearchSpinner} /> : null}
      {citySuggestions.length > 0 ? (
        <ScrollView
          style={[styles.citySuggestionsList, darkMode && styles.darkCitySuggestionsList]}
          nestedScrollEnabled
          keyboardShouldPersistTaps='handled'
        >
          {citySuggestions.map((item, idx) => (
            <TouchableOpacity
              key={item.place_id}
              style={[
                styles.citySuggestionRow,
                darkMode && styles.darkCitySuggestionRow,
                idx === citySuggestions.length - 1 && styles.citySuggestionRowLast,
              ]}
              onPress={async () => {
                const city = await resolveCityFromPlace(item);
                if (!city) return;
                clearCitySearchUi();
                onSelectCustomCity(city);
              }}
              activeOpacity={0.75}
            >
              <Ionicons name='location-outline' size={14} color={darkMode ? "#aaa" : "#666"} style={styles.citySuggestionIcon} />
              <View style={styles.citySuggestionTextWrap}>
                <Text style={[styles.citySuggestionMain, darkMode && styles.darkFilterButtonText]} numberOfLines={1}>
                  {item.structured_formatting?.main_text || item.description}
                </Text>
                {item.structured_formatting?.secondary_text ? (
                  <Text style={[styles.citySuggestionSub, darkMode && styles.darkFilterPanelHint]} numberOfLines={1}>
                    {item.structured_formatting.secondary_text}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
      <ScrollView
        style={compact ? styles.cityPresetChipsScrollCompact : styles.cityPresetChipsScroll}
        contentContainerStyle={styles.filterChipRow}
        nestedScrollEnabled
        keyboardShouldPersistTaps='handled'
      >
        {renderFilterChip("My home", selectedLocation === SEARCH_LOCATION_HOME, () => onSelectPreset(SEARCH_LOCATION_HOME, null), "search-location-home")}
        {selectedLocation === SEARCH_LOCATION_CUSTOM && selectedCustomCity
          ? renderFilterChip(selectedCustomCity.shortLabel || selectedCustomCity.label, true, () => onSelectCustomCity(selectedCustomCity), "search-location-custom-active")
          : null}
        {MAJOR_US_SEARCH_CITIES.map((city) =>
          renderFilterChip(city.shortLabel || city.label, selectedLocation === city.key, () => onSelectPreset(city.key, null), `search-location-${city.key}`),
        )}
      </ScrollView>
    </View>
  );

  const renderActiveFilterMenu = () => {
    if (!activeFilterMenu) return null;

    let chips = null;
    let customBody = null;
    if (activeFilterMenu === "searchLocation") {
      customBody = renderCitySearchPicker({
        selectedLocation: searchLocation,
        selectedCustomCity: customSearchCity,
        compact: true,
        onSelectPreset: (key) => {
          setSearchLocation(key);
          setCustomSearchCity(null);
          clearCitySearchUi();
          setActiveFilterMenu(null);
          performSearch(searchQuery, { searchLocationValue: key, customSearchCityValue: null });
        },
        onSelectCustomCity: (city) => {
          setCustomSearchCity(city);
          setSearchLocation(SEARCH_LOCATION_CUSTOM);
          setActiveFilterMenu(null);
          performSearch(searchQuery, { searchLocationValue: SEARCH_LOCATION_CUSTOM, customSearchCityValue: city });
        },
      });
    } else if (activeFilterMenu === "distance") {
      chips = distanceModalOptions.map((item) =>
        renderFilterChip(
          item.label,
          item.miles == null ? distance == null : distance === item.miles,
          () => {
            if (item.miles == null) {
              clearDistanceFilter(true);
              return;
            }
            setDistance(item.miles);
            setActiveFilterMenu(null);
            performSearch(searchQuery, { distanceMiles: item.miles });
          },
          item.key,
        ),
      );
    } else if (activeFilterMenu === "network") {
      chips = [
        renderFilterChip("Any", network == null, () => applyNetworkFilter(null), "network-any"),
        ...networkOptions.map((value) => renderFilterChip(String(value), network === value, () => applyNetworkFilter(value), `network-${value}`)),
      ];
    } else if (activeFilterMenu === "bounty") {
      chips = [
        renderFilterChip("Any", bounty == null, () => {
          setBounty(null);
          setActiveFilterMenu(null);
        }, "bounty-any"),
        ...bountyOptions.map((value) =>
          renderFilterChip(value, bounty === value, () => {
            setBounty(value);
            setActiveFilterMenu(null);
          }, `bounty-${value}`),
        ),
      ];
    } else if (activeFilterMenu === "sort") {
      chips = [
        renderFilterChip("Default", sortAlphabetical == null, () => {
          setSortAlphabetical(null);
          setActiveFilterMenu(null);
        }, "sort-any"),
        ...sortAlphabeticalOptions.map((value) =>
          renderFilterChip(sortAlphabeticalLabels[value], sortAlphabetical === value, () => {
            setSortAlphabetical(value);
            setActiveFilterMenu(null);
          }, `sort-${value}`),
        ),
      ];
    } else if (activeFilterMenu === "rating") {
      chips = [
        renderFilterChip("Any", rating == null, () => applyRatingFilter(null), "rating-any"),
        ...ratingOptions.map((item) =>
          renderFilterChip(
            item,
            rating !== null && item === `> ${rating}`,
            () => applyRatingFilter(parseFloat(item.slice(1).trim())),
            item,
          ),
        ),
      ];
    }

    const menuTitles = {
      searchLocation: "Search location",
      distance: "Distance",
      network: "Network",
      bounty: "Bounty sort",
      sort: "Alphabetical",
      rating: "Minimum rating",
    };

    return (
      <View
        style={[
          styles.filterInlineMenu,
          darkMode && styles.darkFilterInlineMenu,
          activeFilterMenu === "searchLocation" && { maxHeight: filterInlineLocationMaxHeight },
        ]}
      >
        <Text style={[styles.filterInlineMenuTitle, darkMode && styles.darkFilterInlineMenuTitle]}>{menuTitles[activeFilterMenu]}</Text>
        {customBody ? (
          <ScrollView
            style={styles.filterInlineMenuScroll}
            contentContainerStyle={styles.filterInlineMenuScrollContent}
            nestedScrollEnabled
            keyboardShouldPersistTaps='handled'
          >
            {customBody}
          </ScrollView>
        ) : (
          <View style={styles.filterChipRow}>{chips}</View>
        )}
      </View>
    );
  };

  const renderFilterPanel = () => (
    <View style={[styles.filterPanel, darkMode && styles.darkFilterPanel, { maxHeight: filterPanelMaxHeight }]}>
      <View style={[styles.filterPanelHeader, darkMode && styles.darkFilterPanelHeader]}>
        <Text style={[styles.filterPanelTitle, darkMode && styles.darkFilterPanelTitle]}>Filters</Text>
        <TouchableOpacity onPress={() => setShowFilterPanel(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name='close' size={22} color={darkMode ? "#fff" : "#333"} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.filterPanelBodyScroll}
        contentContainerStyle={styles.filterPanelBodyScrollContent}
        nestedScrollEnabled
        keyboardShouldPersistTaps='handled'
      >
        {renderFilterPanelSection(
          "Search location",
          filterPanelDraft.searchLocation === SEARCH_LOCATION_HOME
            ? "Distance and proximity use your home address from Settings. Or type any city below."
            : `Distance and proximity use ${getSearchLocationFullLabel(filterPanelDraft.searchLocation, filterPanelDraft.customSearchCity)}.`,
          null,
          {
            content: renderCitySearchPicker({
              selectedLocation: filterPanelDraft.searchLocation,
              selectedCustomCity: filterPanelDraft.customSearchCity,
              compact: true,
              onSelectPreset: (key) => setFilterPanelDraft((prev) => ({ ...prev, searchLocation: key, customSearchCity: null })),
              onSelectCustomCity: (city) => setFilterPanelDraft((prev) => ({ ...prev, searchLocation: SEARCH_LOCATION_CUSTOM, customSearchCity: city })),
            }),
          },
        )}

        {renderFilterPanelSection(
          "Distance",
          filterPanelDraft.distance == null
            ? "Showing all results regardless of distance."
            : `Results are limited to ${getSearchLocationFullLabel(filterPanelDraft.searchLocation, filterPanelDraft.customSearchCity)}.`,
          distanceModalOptions.map((item) =>
            renderFilterChip(
              item.label,
              item.miles == null ? filterPanelDraft.distance == null : filterPanelDraft.distance === item.miles,
              () => setFilterPanelDraft((prev) => ({ ...prev, distance: item.miles })),
              `panel-distance-${item.key}`,
            ),
          ),
        )}

        {renderFilterPanelSection(
          "Network",
          "Show results within this many degrees of connection.",
          [
            renderFilterChip("Any", filterPanelDraft.network == null, () => setFilterPanelDraft((prev) => ({ ...prev, network: null })), "panel-network-any"),
            ...networkOptions.map((value) =>
              renderFilterChip(String(value), filterPanelDraft.network === value, () => setFilterPanelDraft((prev) => ({ ...prev, network: value })), `panel-network-${value}`),
            ),
          ],
        )}

        {renderFilterPanelSection(
          "Minimum rating",
          "Applies to businesses with Google ratings.",
          [
            renderFilterChip("Any", filterPanelDraft.rating == null, () => setFilterPanelDraft((prev) => ({ ...prev, rating: null })), "panel-rating-any"),
            ...ratingOptions.map((item) =>
              renderFilterChip(
                item,
                filterPanelDraft.rating !== null && item === `> ${filterPanelDraft.rating}`,
                () => setFilterPanelDraft((prev) => ({ ...prev, rating: parseFloat(item.slice(1).trim()) })),
                `panel-${item}`,
              ),
            ),
          ],
        )}

        {renderFilterPanelSection(
          "Bounty sort",
          "Client-side sort for businesses with bounties.",
          [
            renderFilterChip("Default", filterPanelDraft.bounty == null, () => setFilterPanelDraft((prev) => ({ ...prev, bounty: null })), "panel-bounty-any"),
            ...bountyOptions.map((value) =>
              renderFilterChip(value, filterPanelDraft.bounty === value, () => setFilterPanelDraft((prev) => ({ ...prev, bounty: value })), `panel-bounty-${value}`),
            ),
          ],
        )}

        {renderFilterPanelSection("Alphabetical", null, [
          renderFilterChip("Default", filterPanelDraft.sortAlphabetical == null, () => setFilterPanelDraft((prev) => ({ ...prev, sortAlphabetical: null })), "panel-sort-any"),
          ...sortAlphabeticalOptions.map((value) =>
            renderFilterChip(
              sortAlphabeticalLabels[value],
              filterPanelDraft.sortAlphabetical === value,
              () => setFilterPanelDraft((prev) => ({ ...prev, sortAlphabetical: value })),
              `panel-sort-${value}`,
            ),
          ),
        ])}
      </ScrollView>

      <View style={styles.filterPanelActions}>
        <TouchableOpacity style={[styles.filterPanelClearButton, darkMode && styles.darkFilterPanelClearButton]} onPress={clearAllFilters}>
          <Text style={[styles.filterPanelClearText, darkMode && styles.darkFilterPanelClearText]}>Clear all</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterPanelApplyButton, darkMode && styles.darkFilterPanelApplyButton]} onPress={applyFilterPanel}>
          <Text style={styles.filterPanelApplyText}>Apply</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStars = (rating) => {
    return (
      <View style={{ flexDirection: "row" }}>
        {Array.from({ length: rating }).map((_, i) => (
          <View key={i} style={styles.starCircle} />
        ))}
      </View>
    );
  };

  const renderScoreBreakdown = (item) => {
    if (!showSearchScores) return null;
    const breakdown = item?.score_breakdown;
    if (!breakdown || typeof breakdown !== "object") return null;
    const sem = Number.isFinite(breakdown.semantic_score) ? Number(breakdown.semantic_score).toFixed(3) : null;
    // Fuzzy lexical score used for RRF / legacy ranking (not total_lexical_boost token bonuses).
    const lexFuzzy = Number(breakdown.lexical_fuzzy_score);
    const lex = Number.isFinite(lexFuzzy) ? lexFuzzy.toFixed(3) : null;
    const g = Number.isFinite(item?.global_score) ? Number(item.global_score).toFixed(3) : null;
    const parts = [];
    if (sem !== null) parts.push(`Sem: ${sem}`);
    if (lex !== null) parts.push(`Lex: ${lex}`);
    if (g !== null) parts.push(`Global: ${g}`);

    const detailKeyToLabel = {
      name_score: "Business Name",
      tagline_score: "Tagline",
      bio_score: "Bio",
      service_name_score: "Product/Service Name",
      service_tag_score: "Service Tags",
      custom_tag_score: "Business Tags",
      title_score: "Title",
      description_score: "Description",
      details_score: "Details",
      token_name: "Name Token",
      token_tagline: "Tagline Token",
      token_bio: "Bio Token",
      token_tag: "Tag Token",
      phrase_name: "Name Phrase",
      phrase_tag: "Tag Phrase",
    };

    const ignoredKeys = new Set(["semantic_score", "lexical_fuzzy_score", "total_lexical_boost", "final_score", "rescore_mode", "rrf_k", "rrf_rank_semantic", "rrf_rank_lexical", "rrf_raw"]);
    const detailParts = Object.entries(breakdown)
      .filter(([key, value]) => detailKeyToLabel[key] && !ignoredKeys.has(key) && Number.isFinite(value) && Number(value) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .map(([key, value]) => `${detailKeyToLabel[key]}: ${Number(value).toFixed(3)}`);

    if (!parts.length && !detailParts.length) return null;

    const text = detailParts.length ? `${parts.join(" | ")}\n${detailParts.join(" | ")}` : parts.join(" | ");

    return <Text style={[styles.scoreBreakdownText, darkMode && styles.darkScoreBreakdownText]}>{text}</Text>;
  };

  const getSearchStateForRestore = () => ({
    searchQuery,
    selectedSearchTabs,
    results,
    rawResults: rawResultsRef.current.length > 0 ? rawResultsRef.current : results,
    searchLocation,
    customSearchCity,
    distance,
    network,
    bounty,
    sortAlphabetical,
    rating,
    browseAllActive: browseAllActiveRef.current,
  });

  const renderWishItem = (item, idx) => {
    // Render wish item with MiniCard-like profile display
    const profile = item.profileData || {};
    const wish = item.wishData || {};

    const isOwnWish = currentProfileUid && item.profile_uid === currentProfileUid;
    const wishUid = String(wish.wish_uid || item.id || "").trim();
    const respondedAt = wishUid ? respondedWishesById[wishUid] : null;
    const hasResponded = !!respondedAt;
    const respondedDateLabel = respondedAt ? formatDateForDisplay(respondedAt) : "";
    const seekingTitle = wish.title ? String(wish.title).trim() : item.company ? String(item.company).trim() : "";
    const seekingImageUri = resolveProfileItemImageUri(wish.profile_wish_image, item.profile_uid);
    const scoreSuffix = showSearchScores ? formatBusinessSearchScoreSuffix(item) : null;

    return (
      <TouchableOpacity
        key={`${item.id}-${idx}`}
        activeOpacity={isOwnWish ? 1 : 0.7}
        //style={[styles.wishItem, darkMode && styles.darkWishItem]}
        style={[styles.wishItem, darkMode && styles.darkWishItem, isOwnWish && { opacity: 0.6 }]}
        onPress={() => {
          if (isOwnWish) return;
          console.log("🏢 Navigating to WishDetail from wish card:", wish.title, "Profile ID:", item.profile_uid);
          if (item.profile_uid && wish) {
            navigation.navigate("WishDetail", {
              wishData: wish,
              profileData: profile,
              profile_uid: item.profile_uid,
              searchState: getSearchStateForRestore(),
            });
          } else {
            console.warn("No profile_uid or wish data found for wish item");
          }
        }}
      >
        {/* Profile Image and Info (MiniCard-like) - Clickable */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={(e) => {
            e.stopPropagation(); // Prevent triggering parent onPress
            console.log("🏢 Navigating to profile from MiniCard:", profile.firstName, profile.lastName, "Profile ID:", item.profile_uid);
            if (item.profile_uid) {
              navigation.navigate("Profile", {
                profile_uid: item.profile_uid,
                returnTo: "Search",
                searchState: getSearchStateForRestore(),
              });
            } else {
              console.warn("No profile_uid found for wish item");
            }
          }}
        >
          <View style={styles.wishProfileContainer}>
            <Image
              source={profile.image && profile.imageIsPublic && profile.image !== "" && String(profile.image).trim() !== "" ? { uri: String(profile.image) } : require("../assets/profile.png")}
              style={[styles.wishProfileImage, darkMode && styles.darkWishProfileImage]}
              tintColor={darkMode ? "#ffffff" : undefined}
              onError={(error) => {
                console.log("Wish profile image failed to load:", error.nativeEvent.error);
              }}
              defaultSource={require("../assets/profile.png")}
            />
            <View style={styles.wishProfileInfo}>
              {/* Name is always visible */}
              <Text style={[styles.wishProfileName, darkMode && styles.darkWishProfileName]}>{[profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Anonymous User"}</Text>
              {/* Show email if public */}
              {(() => {
                const email = profile.emailIsPublic && profile.email ? String(profile.email).trim() : "";
                return isSafeForConditional(email) ? <Text style={[styles.wishProfileText, darkMode && styles.darkWishProfileText]}>{sanitizeText(email)}</Text> : null;
              })()}
              {/* Show phone if public */}
              {(() => {
                const phone = profile.phoneIsPublic && profile.phone ? String(profile.phone).trim() : "";
                return isSafeForConditional(phone) ? <Text style={[styles.wishProfileText, darkMode && styles.darkWishProfileText]}>{sanitizeText(phone)}</Text> : null;
              })()}
            </View>
          </View>
        </TouchableOpacity>

        {/* Wish Information */}
        <View style={[styles.wishInfoContainer, darkMode && styles.darkWishInfoContainer]}>
          <View style={styles.expertiseOfferingHeaderRow}>
            <ProfileSectionItemImage section='seeking' imageUri={seekingImageUri} imageIsPublic={wish.profile_wish_image_is_public} size={56} darkMode={darkMode} />
            <View style={styles.expertiseOfferingHeaderText}>
              <View style={styles.wishTitleRow}>
                <Text style={[styles.wishTitle, darkMode && styles.darkWishTitle, styles.wishTitleFlex, scoreSuffix && styles.wishTitleWithSuffix]}>
                  {seekingTitle}
                  {scoreSuffix ? <Text style={[styles.searchScoreSuffix, darkMode && styles.darkSearchScoreSuffix]}>{` ${scoreSuffix}`}</Text> : null}
                </Text>
                {hasResponded && <Text style={[styles.wishRespondedFlag, darkMode && styles.darkWishRespondedFlag]}>Responded{respondedDateLabel ? ` ${respondedDateLabel}` : ""}</Text>}
              </View>
              {(() => {
                const miles = getSearchCardDistanceMiles(item);
                return miles != null ? (
                  <View style={styles.searchCardMetaRowCentered}>
                    <SearchCardDistanceLabel miles={miles} darkMode={darkMode} centered />
                  </View>
                ) : null;
              })()}
              {isSafeForConditional(wish.description) ? <Text style={[styles.wishDescription, darkMode && styles.darkWishDescription]}>{sanitizeText(wish.description)}</Text> : null}
            </View>
          </View>
          <SeekingCardDetails seeking={wish} darkMode={darkMode} metaTextStyle={[styles.seekingMetaText, darkMode && styles.darkSeekingMetaText]} />
        </View>
        {isOwnWish && <Text style={[styles.ownExpertiseNotice, darkMode && styles.darkOwnExpertiseNotice]}>You cannot respond to your own request.</Text>}
      </TouchableOpacity>
    );
  };

  const renderExpertiseItem = (item, idx) => {
    const profile = item.profileData || {};
    const expertise = item.expertiseData || {};

    const isOwnExpertise = currentProfileUid && item.profile_uid === currentProfileUid;
    const offeringImageUri = resolveProfileItemImageUri(expertise.profile_expertise_image, item.profile_uid);
    const offeringTitle = expertise.title ? String(expertise.title).trim() : item.company ? String(item.company).trim() : "";
    const scoreSuffix = showSearchScores ? formatBusinessSearchScoreSuffix(item) : null;
    const expertiseUid = String(expertise.expertise_uid || item.id || "").trim();
    const respondedAt = expertiseUid ? respondedOfferingsById[expertiseUid] : null;
    const hasRespondedToOffering = !!respondedAt;
    const offeringRespondedDateLabel = respondedAt ? formatDateForDisplay(respondedAt) : null;
    const microCardUser = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      profileImage: profile.image,
      imageIsPublic: profile.imageIsPublic,
      tagLine: profile.tagLine,
      tagLineIsPublic: profile.tagLineIsPublic,
    };

    const openOfferingDetail = () => {
      if (isOwnExpertise || !item.profile_uid || !expertise) return;
      navigation.navigate("OfferingDetail", {
        expertiseData: expertise,
        profileData: profile,
        profile_uid: item.profile_uid,
        searchState: getSearchStateForRestore(),
      });
    };

    const openSellerProfile = () => {
      if (!item.profile_uid) return;
      navigation.navigate("Profile", {
        profile_uid: item.profile_uid,
        returnTo: "Search",
        searchState: getSearchStateForRestore(),
      });
    };

    const offeringNetworkBadge = renderOfferingNetworkBadge(item);

    return (
      <TouchableOpacity
        key={`${item.id}-${idx}`}
        activeOpacity={isOwnExpertise ? 1 : 0.7}
        style={[styles.wishItem, darkMode && styles.darkWishItem, isOwnExpertise && { opacity: 0.6 }]}
        onPress={openOfferingDetail}
      >
        <TouchableOpacity
          activeOpacity={item.profile_uid ? 0.7 : 1}
          disabled={!item.profile_uid}
          onPress={(e) => {
            e.stopPropagation();
            openSellerProfile();
          }}
          accessibilityRole='button'
          accessibilityLabel='View seller profile'
        >
          {isCompactSearchCard ? (
            <View style={styles.wishProfileContainer}>
              <View style={styles.wishProfileMain}>
                <MicroCard user={microCardUser} showRelationship={false} embedded />
              </View>
              {offeringNetworkBadge ? <View style={styles.wishProfileNetworkBadge}>{offeringNetworkBadge}</View> : null}
            </View>
          ) : (
            <View style={styles.wishProfileContainer}>
              <Image
                source={profile.image && profile.imageIsPublic && profile.image !== "" && String(profile.image).trim() !== "" ? { uri: String(profile.image) } : require("../assets/profile.png")}
                style={[styles.wishProfileImage, darkMode && styles.darkWishProfileImage]}
                tintColor={darkMode ? "#ffffff" : undefined}
                onError={(error) => {
                  console.log("Expertise profile image failed to load:", error.nativeEvent.error);
                }}
                defaultSource={require("../assets/profile.png")}
              />
              <View style={styles.wishProfileInfo}>
                <Text style={[styles.wishProfileName, darkMode && styles.darkWishProfileName]}>{[profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Anonymous User"}</Text>
                {(() => {
                  const email = profile.emailIsPublic && profile.email ? String(profile.email).trim() : "";
                  return isSafeForConditional(email) ? <Text style={[styles.wishProfileText, darkMode && styles.darkWishProfileText]}>{sanitizeText(email)}</Text> : null;
                })()}
                {(() => {
                  const phone = profile.phoneIsPublic && profile.phone ? String(profile.phone).trim() : "";
                  return isSafeForConditional(phone) ? <Text style={[styles.wishProfileText, darkMode && styles.darkWishProfileText]}>{sanitizeText(phone)}</Text> : null;
                })()}
              </View>
              {offeringNetworkBadge ? <View style={styles.wishProfileNetworkBadge}>{offeringNetworkBadge}</View> : null}
            </View>
          )}
        </TouchableOpacity>

        <View style={[styles.wishInfoContainer, darkMode && styles.darkWishInfoContainer]}>
          <View style={styles.expertiseOfferingHeaderRow}>
            <ProfileSectionItemImage section='offering' imageUri={offeringImageUri} imageIsPublic={expertise.profile_expertise_image_is_public} size={56} darkMode={darkMode} />
            <View style={styles.expertiseOfferingHeaderText}>
              <View style={styles.wishTitleRow}>
                <Text style={[styles.wishTitle, darkMode && styles.darkWishTitle, styles.wishTitleFlex, scoreSuffix && styles.wishTitleWithSuffix]}>
                  {offeringTitle}
                  {scoreSuffix ? <Text style={[styles.searchScoreSuffix, darkMode && styles.darkSearchScoreSuffix]}>{` ${scoreSuffix}`}</Text> : null}
                </Text>
                {hasRespondedToOffering && (
                  <Text style={[styles.wishRespondedFlag, darkMode && styles.darkWishRespondedFlag]}>Responded{offeringRespondedDateLabel ? ` ${offeringRespondedDateLabel}` : ""}</Text>
                )}
              </View>
              {isSafeForConditional(expertise.description) ? <Text style={[styles.wishDescription, darkMode && styles.darkWishDescription]}>{sanitizeText(expertise.description)}</Text> : null}
            </View>
          </View>
          {renderOfferingSearchDistance(item)}
          <OfferingCardDetails
            offering={expertise}
            darkMode={darkMode}
            variant='list'
            metaTextStyle={[styles.seekingMetaText, darkMode && styles.darkSeekingMetaText]}
          />
        </View>
        {isOwnExpertise && <Text style={[styles.ownExpertiseNotice, darkMode && styles.darkOwnExpertiseNotice]}>You cannot purchase your own expertise.</Text>}
      </TouchableOpacity>
    );
  };

  const renderBusinessResultActions = (item, { compact = false } = {}) => {
    const miles = getSearchCardDistanceMiles(item);
    const showDistanceCol = distance != null;

    return (
    <View style={[styles.businessResultActions, compact && styles.businessResultActionsCompact, compact && darkMode && styles.darkBusinessResultActionsCompact]}>
      {showDistanceCol ? (
        <View style={[styles.businessTableDistanceCol, compact && styles.businessTableColCompact]}>
          {miles != null ? <SearchCardDistanceLabel miles={miles} darkMode={darkMode} centered /> : <Text style={[styles.metricPlaceholder, darkMode && styles.darkMetricPlaceholder]}>—</Text>}
        </View>
      ) : null}
      <View style={[styles.businessTableRatingCol, compact && styles.businessTableColCompact]}>
        {Number.isFinite(item.rating) ? (
          <View style={styles.ratingContainer}>
            <Ionicons name='star' size={16} color='#FFCD3C' />
            <Text style={[styles.ratingText, darkMode && styles.darkRatingText]}>
              {item.rating.toFixed(1)}
              {item.ratingCount > 0 ? ` (${item.ratingCount})` : ""}
            </Text>
          </View>
        ) : (
          <Text style={[styles.metricPlaceholder, darkMode && styles.darkMetricPlaceholder]}>—</Text>
        )}
      </View>

      <View style={[styles.businessTableBountyCol, compact && styles.businessTableColCompact]}>
        {(() => {
          const hasProductDetail = item.product_count !== undefined;
          const noProducts = hasProductDetail && (item.product_count === 0 || item.product_count == null);
          if (noProducts) {
            return <NoBountyIcon darkMode={darkMode} muted />;
          }
          const hasBounty = getBusinessBountySortValue(item) != null;
          return hasBounty ? <Text style={[styles.bountyEmojiIcon, styles.bountyEmojiIconCompact]}>💰</Text> : <NoBountyIcon darkMode={darkMode} />;
        })()}
      </View>

      <View style={[styles.businessTableLevelCol, compact && styles.businessTableColCompact]}>
        {(() => {
          const reviewCount = Number(item.ratingCount);
          const hasBusinessReviews = Number.isFinite(reviewCount) && reviewCount > 0;
          const iconTint = hasBusinessReviews ? (darkMode ? "#ffffff" : "#000000") : darkMode ? "#5a5a5a" : "#b0b0b0";
          const wrapOpacity = hasBusinessReviews ? 1 : 0.5;
          return (
            <TouchableOpacity
              style={[styles.levelButton, { opacity: wrapOpacity }]}
              onPress={(e) => {
                e.stopPropagation();
                navigation.navigate("SearchTab", {
                  centerCompany: {
                    id: item.id,
                    name: item.company,
                    rating: item.rating,
                  },
                });
              }}
            >
              <View style={{ position: "relative" }}>
                <Image source={require("../assets/connect.png")} style={{ width: 22, height: 22, tintColor: iconTint }} />
                {item.connection_degree != null && (
                  <View style={[styles.connectionBadge, !hasBusinessReviews && { opacity: 0.85 }]}>
                    <Text style={[styles.connectionBadgeText, !hasBusinessReviews && { color: darkMode ? "#888" : "#666" }]}>{item.connection_degree}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })()}
      </View>

      {(item.hasBounty || item.hasX || item.hasPriceTag || item.hasDollar) && (
        <View style={styles.businessDemoExtras}>
          {item.hasBounty && (
            <TouchableOpacity style={styles.actionButton} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.bountyEmojiIcon}>💰</Text>
            </TouchableOpacity>
          )}
          {item.hasX && (
            <TouchableOpacity style={styles.actionButton} onPress={(e) => e.stopPropagation()}>
              <NoBountyIcon darkMode={darkMode} />
            </TouchableOpacity>
          )}
          {item.hasPriceTag && (
            <TouchableOpacity style={styles.actionButton} onPress={(e) => e.stopPropagation()}>
              <Text style={[styles.percentSymbol, darkMode && styles.darkPercentSymbol]}>:%</Text>
            </TouchableOpacity>
          )}
          {item.hasDollar && (
            <TouchableOpacity style={styles.actionButton} onPress={(e) => e.stopPropagation()}>
              <View style={[styles.moneyBagContainer, darkMode && styles.darkMoneyBagContainer]}>
                <Text style={[styles.dollarSymbol, darkMode && styles.darkDollarSymbol]}>$</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
    );
  };

  const renderBusinessResultItem = (item, idx) => {
    const miniCardBusiness = mapBusinessToMiniCard(item);
    const microCardBusiness = mapBusinessToMicroCard(item);
    const scoreSuffix = showSearchScores ? formatBusinessSearchScoreSuffix(item) : null;
    const headerAccessory = renderBusinessCardHeaderAccessory(item);

    return (
      <TouchableOpacity
        key={`${item.id}-${idx}`}
        style={[styles.resultItem, darkMode && styles.darkResultItem, isCompactSearchCard && styles.resultItemCompact]}
        activeOpacity={0.7}
        onPress={() => {
          console.log("🏢 Navigating to profile for:", item.company, "ID:", item.id);
          navigation.navigate("BusinessProfile", {
            business_uid: resolveBusinessUid(item) || item.id,
            returnTo: "Search",
            searchState: getSearchStateForRestore(),
          });
        }}
      >
        {isCompactSearchCard ? (
          <>
            {microCardBusiness ? (
              <MicroCard user={microCardBusiness} showRelationship={false} embedded nameSuffix={scoreSuffix} headerAccessory={headerAccessory} />
            ) : (
              <Text style={[styles.companyName, darkMode && styles.darkCompanyName]}>{item.company ? String(item.company).trim() : ""}</Text>
            )}
            {renderBusinessResultActions(item, { compact: true })}
          </>
        ) : (
          <>
            <View style={styles.searchMiniCardWrap}>
              {miniCardBusiness ? (
                <MiniCard business={miniCardBusiness} embedded nameSuffix={scoreSuffix} headerAccessory={headerAccessory} />
              ) : (
                <Text style={[styles.companyName, darkMode && styles.darkCompanyName]}>{item.company ? String(item.company).trim() : ""}</Text>
              )}
            </View>
            {renderBusinessResultActions(item)}
          </>
        )}
      </TouchableOpacity>
    );
  };

  const renderIndividualResultItem = (item, idx) => {
    const profileUid = item.profile_uid;
    return (
      <TouchableOpacity
        key={`${item.id}-${idx}`}
        style={[styles.individualResultItem, darkMode && styles.darkIndividualResultItem]}
        activeOpacity={0.7}
        onPress={() => {
          if (profileUid) {
            navigation.navigate("Profile", {
              profile_uid: profileUid,
              returnTo: "Search",
              searchState: getSearchStateForRestore(),
            });
          }
        }}
      >
        <MicroCard user={item.microCardUser || item.profileData} showRelationship embedded />
      </TouchableOpacity>
    );
  };

  const renderResultItem = (item, idx) => {
    if (item.itemType === "individuals") {
      return renderIndividualResultItem(item, idx);
    }
    // If it's a wish/seeking item, use the special wish renderer
    if (item.itemType === "seeking" && item.wishData) {
      return renderWishItem(item, idx);
    }
    // If it's an expertise item, use the special expertise renderer
    if (item.itemType === "expertise" && item.expertiseData) {
      return renderExpertiseItem(item, idx);
    }
    // Business search results use MiniCard with score suffix and table columns
    if (item.itemType === "businesses") {
      return renderBusinessResultItem(item, idx);
    }

    // console.log(`🎨 Rendering item ${idx}:`, item.company, "ID:", item.id);
    return (
      <TouchableOpacity
        key={`${item.id}-${idx}`}
        style={[styles.resultItem, darkMode && styles.darkResultItem]}
        activeOpacity={0.7}
        onPress={() => {
          console.log("🏢 Navigating to profile for:", item.company, "ID:", item.id, "Type:", item.itemType);
          if (item.itemType === "expertise" || item.itemType === "seeking") {
            // Navigate to user profile if we have profile_uid
            if (item.profile_uid) {
              navigation.navigate("Profile", {
                profile_uid: item.profile_uid,
                returnTo: "Search",
                searchState: getSearchStateForRestore(),
              });
            } else {
              console.warn("No profile_uid found for expertise/seeking item");
            }
          }
        }}
      >
        <View style={styles.resultContent}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image
              source={item.business_profile_img ? { uri: encodeURI(item.business_profile_img.trim()) } : require("../assets/profile.png")}
              style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }}
              onError={(e) => console.log("Image load error:", e.nativeEvent.error, item.business_profile_img)}
              onLoad={() => console.log("Image loaded successfully:", item.business_profile_img)}
              defaultSource={require("../assets/profile.png")}
            />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                <Text style={[styles.companyName, darkMode && styles.darkCompanyName]}>{item.company ? String(item.company).trim() : ""}</Text>
              </View>
              {showSearchScores && Number.isFinite(item.score) && <Text style={[styles.scoreText, darkMode && styles.darkScoreText]}>Score: {Number(item.score).toFixed(3)}</Text>}
              {showSearchScores && renderScoreBreakdown(item)}
              {(() => {
                const tagLine = item.business_tag_line ? String(item.business_tag_line).trim() : "";
                if (tagLine && tagLine !== "." && tagLine.length > 0) {
                  return <Text style={[styles.businessTagLine, darkMode && styles.darkBusinessTagLine]}>{tagLine}</Text>;
                }
                return null;
              })()}
            </View>
          </View>
        </View>
        {renderBusinessResultActions(item)}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, darkMode && styles.darkContainer]}>
      {/* Header */}
      <AppHeader
        title='SEARCH'
        {...getHeaderColors("search")}
        darkModeBackgroundColor='#4b2c91'
        onTitlePress={() => setShowFeedbackPopup(true)} // ✅ SAFE
        rightButton={
          <TouchableOpacity
            style={styles.cartButton}
            onPress={() =>
              navigation.navigate("ShoppingCart", {
                cartItems,
                businessName: "All Items",
                business_uid: "all",
                returnTo: "Search",
                searchState: getSearchStateForRestore(),
              })
            }
          >
            <Ionicons name='cart-outline' size={24} color='#fff' />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />

      <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
        {/* Main Content */}
        <View style={styles.contentContainer}>
          {/* Search type buttons - ALWAYS VISIBLE ABOVE SEARCH BAR */}
          <View style={[styles.searchTypeRow, { marginBottom: 10 }]}>
            <View style={styles.searchTypeButtonsGroup}>
              {/*
              <TouchableOpacity
                style={[
                  styles.filterButtonOption,
                  darkMode && styles.darkFilterButtonOption,
                  searchType === "global" && styles.searchTypeButtonGlobal,
                  darkMode && searchType === "global" && styles.darkSearchTypeButtonGlobal,
                ]}
                onPress={() => {
                  setSearchType("global");
                  performSearch(searchQuery);
                }}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    darkMode && styles.darkFilterButtonText,
                    searchType === "global" && styles.searchTypeButtonTextGlobal,
                    darkMode && searchType === "global" && styles.darkSearchTypeButtonTextGlobal,
                  ]}
                >
                  Global
                </Text>
              </TouchableOpacity>
              */}
              <TouchableOpacity
                style={[
                  styles.filterButtonOption,
                  styles.searchTypeTabOption,
                  darkMode && styles.darkFilterButtonOption,
                  selectedSearchTabs.businesses && styles.searchTypeButtonBusinesses,
                  darkMode && selectedSearchTabs.businesses && styles.darkSearchTypeButtonBusinesses,
                ]}
                onPress={() => toggleSearchTab("businesses")}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    styles.searchTypeTabText,
                    darkMode && styles.darkFilterButtonText,
                    selectedSearchTabs.businesses && styles.searchTypeButtonTextBusinesses,
                    darkMode && selectedSearchTabs.businesses && styles.darkSearchTypeButtonTextBusinesses,
                  ]}
                  numberOfLines={1}
                >
                  Businesses
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterButtonOption,
                  styles.searchTypeTabOption,
                  darkMode && styles.darkFilterButtonOption,
                  selectedSearchTabs.organizations && styles.searchTypeButtonOrganizations,
                  darkMode && selectedSearchTabs.organizations && styles.darkSearchTypeButtonOrganizations,
                ]}
                onPress={() => toggleSearchTab("organizations")}
                accessibilityLabel='Search organizations'
                accessibilityRole='button'
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    styles.searchTypeTabText,
                    darkMode && styles.darkFilterButtonText,
                    selectedSearchTabs.organizations && styles.searchTypeButtonTextOrganizations,
                    darkMode && selectedSearchTabs.organizations && styles.darkSearchTypeButtonTextOrganizations,
                  ]}
                  numberOfLines={1}
                >
                  Organizations
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterButtonOption,
                  styles.searchTypeTabOption,
                  darkMode && styles.darkFilterButtonOption,
                  selectedSearchTabs.expertise && styles.searchTypeButtonExpertise,
                  darkMode && selectedSearchTabs.expertise && styles.darkSearchTypeButtonExpertise,
                ]}
                onPress={() => toggleSearchTab("expertise")}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    styles.searchTypeTabText,
                    darkMode && styles.darkFilterButtonText,
                    selectedSearchTabs.expertise && styles.searchTypeButtonTextExpertise,
                    darkMode && selectedSearchTabs.expertise && styles.darkSearchTypeButtonTextExpertise,
                  ]}
                  numberOfLines={1}
                >
                  Offering
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterButtonOption,
                  styles.searchTypeTabOption,
                  darkMode && styles.darkFilterButtonOption,
                  selectedSearchTabs.seeking && styles.searchTypeButtonSeeking,
                  darkMode && selectedSearchTabs.seeking && styles.darkSearchTypeButtonSeeking,
                ]}
                onPress={() => toggleSearchTab("seeking")}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    styles.searchTypeTabText,
                    darkMode && styles.darkFilterButtonText,
                    selectedSearchTabs.seeking && styles.searchTypeButtonTextSeeking,
                    darkMode && selectedSearchTabs.seeking && styles.darkSearchTypeButtonTextSeeking,
                  ]}
                  numberOfLines={1}
                >
                  Seeking
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterButtonOption,
                  styles.searchTypeTabOption,
                  darkMode && styles.darkFilterButtonOption,
                  selectedSearchTabs.individuals && styles.searchTypeButtonIndividuals,
                  darkMode && selectedSearchTabs.individuals && styles.darkSearchTypeButtonIndividuals,
                ]}
                onPress={() => toggleSearchTab("individuals")}
                accessibilityLabel='Search individuals'
                accessibilityRole='button'
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    styles.searchTypeTabText,
                    darkMode && styles.darkFilterButtonText,
                    selectedSearchTabs.individuals && styles.searchTypeButtonTextIndividuals,
                    darkMode && selectedSearchTabs.individuals && styles.darkSearchTypeButtonTextIndividuals,
                  ]}
                  numberOfLines={1}
                >
                  Individuals
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search bar */}
          <View style={styles.searchBarWrap}>
            <View style={styles.searchContainer}>
              <TextInput
                style={[styles.searchInput, darkMode && styles.darkSearchInput]}
                placeholder={searchInputPlaceholder}
                placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                value={searchQuery}
                onChangeText={onSearchQueryChange}
                onFocus={() => {
                  if (searchQuery.trim().length >= SEARCH_SUGGEST_MIN_LENGTH) {
                    setShowSearchSuggestions(true);
                  }
                }}
                onBlur={onSearchInputBlur}
                returnKeyType='search'
                onSubmitEditing={onSearch}
                accessibilitylabel='Search'
                accessibilityHint='Enter text to search'
                accessibilityRole='search'
              />
              <TouchableOpacity style={[styles.searchBarIconButton, darkMode && styles.darkSearchBarIconButton]} onPress={onSearch}>
                <Ionicons name='search' size={20} color={darkMode ? "#ffffff" : "#000000"} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.searchBarIconButton,
                  darkMode && styles.darkSearchBarIconButton,
                  (showFilters || activeFilterCount > 0) && styles.filterIconButtonActive,
                  darkMode && (showFilters || activeFilterCount > 0) && styles.darkFilterIconButtonActive,
                ]}
                onPress={handleFilterIconPress}
                accessibilityLabel={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"}
                accessibilityRole='button'
              >
                <MaterialIcons name='filter-list' size={20} color={darkMode ? "#ffffff" : "#000000"} />
                {activeFilterCount > 0 ? (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.searchBarIconButton, darkMode && styles.darkSearchBarIconButton, mapLoading && { opacity: 0.6 }]}
                onPress={handleOpenSearchMap}
                disabled={mapLoading}
                accessibilityLabel='View on map'
                accessibilityRole='button'
              >
                {mapLoading ? <ActivityIndicator size='small' color={darkMode ? "#ffffff" : "#333333"} /> : <Ionicons name='map-outline' size={20} color={darkMode ? "#ffffff" : "#333333"} />}
              </TouchableOpacity>
            </View>

            {showSearchSuggestions && searchQuery.trim().length >= SEARCH_SUGGEST_MIN_LENGTH && (
              <View style={[styles.suggestionsList, darkMode && styles.darkSuggestionsList]}>
                {suggestionsLoading ? null : searchSuggestions.length > 0 ? (
                  searchSuggestions.map((item, idx) => (
                    <TouchableOpacity
                      key={`${item.text}-${idx}`}
                      style={[styles.suggestionRow, darkMode && styles.darkSuggestionRow, idx === searchSuggestions.length - 1 && styles.suggestionRowLast]}
                      onPressIn={onSuggestionPressIn}
                      onPress={() => handleSuggestionSelect(item.text)}
                      {...(Platform.OS === "web"
                        ? {
                            onMouseDown: (e) => {
                              e.preventDefault();
                            },
                          }
                        : {})}
                      activeOpacity={0.75}
                    >
                      <Ionicons name='search-outline' size={16} color={darkMode ? "#aaa" : "#666"} style={styles.suggestionIcon} />
                      {renderHighlightedSuggestion(item.text, searchQuery, darkMode)}
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={[styles.suggestionRow, styles.suggestionRowLast, darkMode && styles.darkSuggestionRow]}>
                    <Text style={[styles.suggestionEmpty, darkMode && styles.darkSuggestionEmpty]}>No suggestions found</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Distance, Network, Bounty, Rating filters */}
          {showFilters && !selectedSearchTabs.individuals && (
            <>
              <View style={styles.filterButtonsContainer}>
                <TouchableOpacity
                  style={[
                    styles.filterButtonOption,
                    darkMode && styles.darkFilterButtonOption,
                    (isNonHomeSearchLocation(searchLocation) || activeFilterMenu === "searchLocation") && styles.activeFilterButton,
                    darkMode && (isNonHomeSearchLocation(searchLocation) || activeFilterMenu === "searchLocation") && styles.darkActiveFilterButton,
                  ]}
                  onPress={() => toggleFilterMenu("searchLocation")}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      darkMode && styles.darkFilterButtonText,
                      (isNonHomeSearchLocation(searchLocation) || activeFilterMenu === "searchLocation") && styles.activeFilterButtonText,
                      darkMode && (isNonHomeSearchLocation(searchLocation) || activeFilterMenu === "searchLocation") && styles.darkActiveFilterButtonText,
                    ]}
                  >
                    {getSearchLocationFilterLabel(searchLocation, customSearchCity)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterButtonOption,
                    darkMode && styles.darkFilterButtonOption,
                    (distance !== null || activeFilterMenu === "distance") && styles.activeFilterButton,
                    darkMode && (distance !== null || activeFilterMenu === "distance") && styles.darkActiveFilterButton,
                  ]}
                  onPress={() => toggleFilterMenu("distance")}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      darkMode && styles.darkFilterButtonText,
                      (distance !== null || activeFilterMenu === "distance") && styles.activeFilterButtonText,
                      darkMode && (distance !== null || activeFilterMenu === "distance") && styles.darkActiveFilterButtonText,
                    ]}
                  >
                    {distance !== null ? `${distance} mi` : "Distance"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterButtonOption,
                    darkMode && styles.darkFilterButtonOption,
                    (network !== null || activeFilterMenu === "network") && styles.activeFilterButton,
                    darkMode && (network !== null || activeFilterMenu === "network") && styles.darkActiveFilterButton,
                  ]}
                  onPress={() => toggleFilterMenu("network")}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      darkMode && styles.darkFilterButtonText,
                      (network !== null || activeFilterMenu === "network") && styles.activeFilterButtonText,
                      darkMode && (network !== null || activeFilterMenu === "network") && styles.darkActiveFilterButtonText,
                    ]}
                  >
                    {network !== null ? network : "Network"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterButtonOption,
                    darkMode && styles.darkFilterButtonOption,
                    (bounty !== null || activeFilterMenu === "bounty") && styles.activeFilterButton,
                    darkMode && (bounty !== null || activeFilterMenu === "bounty") && styles.darkActiveFilterButton,
                  ]}
                  onPress={() => toggleFilterMenu("bounty")}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      darkMode && styles.darkFilterButtonText,
                      (bounty !== null || activeFilterMenu === "bounty") && styles.activeFilterButtonText,
                      darkMode && (bounty !== null || activeFilterMenu === "bounty") && styles.darkActiveFilterButtonText,
                    ]}
                  >
                    {bounty !== null ? bounty : "Bounty"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterButtonOption,
                    darkMode && styles.darkFilterButtonOption,
                    (sortAlphabetical !== null || activeFilterMenu === "sort") && styles.activeFilterButton,
                    darkMode && (sortAlphabetical !== null || activeFilterMenu === "sort") && styles.darkActiveFilterButton,
                  ]}
                  onPress={() => toggleFilterMenu("sort")}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      darkMode && styles.darkFilterButtonText,
                      (sortAlphabetical !== null || activeFilterMenu === "sort") && styles.activeFilterButtonText,
                      darkMode && (sortAlphabetical !== null || activeFilterMenu === "sort") && styles.darkActiveFilterButtonText,
                    ]}
                  >
                    {sortAlphabetical !== null ? sortAlphabeticalLabels[sortAlphabetical] : "A -> Z"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterButtonOption,
                    darkMode && styles.darkFilterButtonOption,
                    (rating !== null || activeFilterMenu === "rating") && styles.activeFilterButton,
                    darkMode && (rating !== null || activeFilterMenu === "rating") && styles.darkActiveFilterButton,
                  ]}
                  onPress={() => toggleFilterMenu("rating")}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      darkMode && styles.darkFilterButtonText,
                      (rating !== null || activeFilterMenu === "rating") && styles.activeFilterButtonText,
                      darkMode && (rating !== null || activeFilterMenu === "rating") && styles.darkActiveFilterButtonText,
                    ]}
                  >
                    {rating !== null ? `> ${rating}` : "Rating"}
                  </Text>
                </TouchableOpacity>
              </View>
              {renderActiveFilterMenu()}
              {showFilterPanel && renderFilterPanel()}
            </>
          )}

          <ScrollView style={styles.resultsContainer}>
            {showSearchResultsLoading ? (
              <View style={styles.searchLoadingContainer}>
                <ActivityIndicator size='large' color={darkMode ? "#ffffff" : "#333333"} />
                <Text style={[styles.loadingText, darkMode && styles.darkLoadingText]}>Loading search results…</Text>
              </View>
            ) : (
              <>
                {selectedSearchTabs.individuals && (
                  <>
                    <TouchableOpacity style={[styles.globalSectionHeader, darkMode && styles.darkGlobalSectionHeader]} onPress={() => setShowGlobalIndividuals((prev) => !prev)} activeOpacity={0.8}>
                      <Text style={[styles.globalSectionHeaderText, darkMode && styles.darkGlobalSectionHeaderText]}>Individuals ({individualsSectionResults.length})</Text>
                      <Ionicons name={showGlobalIndividuals ? "chevron-up" : "chevron-down"} size={18} color={darkMode ? "#fff" : "#333"} />
                    </TouchableOpacity>
                    {showGlobalIndividuals && individualsSectionResults.length > 0 ? (
                      individualsSectionResults.map((item, idx) => renderResultItem(item, idx))
                    ) : showGlobalIndividuals ? (
                      <Text style={[styles.individualsSearchHint, darkMode && styles.darkIndividualsSearchHint]}>
                        {searchQuery.trim().length < 2 ? "Search by email, city, state, or name (at least 2 characters)." : "No individuals found. Try another spelling, city, or email."}
                      </Text>
                    ) : null}
                  </>
                )}

                {selectedSearchTabs.businesses && (
                  <>
                    <TouchableOpacity style={[styles.globalSectionHeader, darkMode && styles.darkGlobalSectionHeader]} onPress={() => setShowGlobalBusinesses((prev) => !prev)} activeOpacity={0.8}>
                      <Text style={[styles.globalSectionHeaderText, darkMode && styles.darkGlobalSectionHeaderText]}>Businesses ({businessSectionResults.length})</Text>
                      <Ionicons name={showGlobalBusinesses ? "chevron-up" : "chevron-down"} size={18} color={darkMode ? "#fff" : "#333"} />
                    </TouchableOpacity>
                    {showGlobalBusinesses && businessSectionResults.map((item, idx) => renderResultItem(item, idx))}
                  </>
                )}

                {selectedSearchTabs.organizations && (
                  <>
                    <TouchableOpacity style={[styles.globalSectionHeader, darkMode && styles.darkGlobalSectionHeader]} onPress={() => setShowGlobalOrganizations((prev) => !prev)} activeOpacity={0.8}>
                      <Text style={[styles.globalSectionHeaderText, darkMode && styles.darkGlobalSectionHeaderText]}>Organizations ({businessSectionResults.length})</Text>
                      <Ionicons name={showGlobalOrganizations ? "chevron-up" : "chevron-down"} size={18} color={darkMode ? "#fff" : "#333"} />
                    </TouchableOpacity>
                    {showGlobalOrganizations && businessSectionResults.map((item, idx) => renderResultItem(item, `org-${idx}`))}
                  </>
                )}

                {selectedSearchTabs.expertise && (
                  <>
                    <TouchableOpacity style={[styles.globalSectionHeader, darkMode && styles.darkGlobalSectionHeader]} onPress={() => setShowGlobalOffering((prev) => !prev)} activeOpacity={0.8}>
                      <Text style={[styles.globalSectionHeaderText, darkMode && styles.darkGlobalSectionHeaderText]}>Offering ({offeringSectionResults.length})</Text>
                      <Ionicons name={showGlobalOffering ? "chevron-up" : "chevron-down"} size={18} color={darkMode ? "#fff" : "#333"} />
                    </TouchableOpacity>
                    {showGlobalOffering && offeringSectionResults.map((item, idx) => renderResultItem(item, idx))}
                  </>
                )}

                {selectedSearchTabs.seeking && (
                  <>
                    <TouchableOpacity style={[styles.globalSectionHeader, darkMode && styles.darkGlobalSectionHeader]} onPress={() => setShowGlobalSeeking((prev) => !prev)} activeOpacity={0.8}>
                      <Text style={[styles.globalSectionHeaderText, darkMode && styles.darkGlobalSectionHeaderText]}>Seeking ({seekingSectionResults.length})</Text>
                      <Ionicons name={showGlobalSeeking ? "chevron-up" : "chevron-down"} size={18} color={darkMode ? "#fff" : "#333"} />
                    </TouchableOpacity>
                    {showGlobalSeeking && seekingSectionResults.map((item, idx) => renderResultItem(item, idx))}
                  </>
                )}

                {!showSearchResultsLoading && showMoreButtonVisible ? (
                  <TouchableOpacity
                    style={[styles.showMoreResultsButton, darkMode && styles.darkShowMoreResultsButton]}
                    onPress={handleShowMorePress}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.showMoreResultsButtonText, darkMode && styles.darkShowMoreResultsButtonText]}>{showMoreButtonLabel}</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </ScrollView>

          <View style={[styles.bannerAd, darkMode && styles.darkBannerAd]}>
            <Text style={[styles.bannerAdText, darkMode && styles.darkBannerAdText]}>Relevant Banner Ad</Text>
          </View>
        </View>

        {/* Bottom Navigation Bar */}
        <BottomNavBar navigation={navigation} />
        <FeedbackPopup visible={showFeedbackPopup} onClose={() => setShowFeedbackPopup(false)} pageName='Search' instructions={searchFeedbackInstructions} questions={searchFeedbackQuestions} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  container: { flex: 1, backgroundColor: "#fff" },
  cartButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
    minWidth: 40,
    minHeight: 40,
  },
  cartBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  contentContainer: { flex: 1, padding: 20, paddingTop: 30, paddingBottom: 100 },
  searchBarWrap: { position: "relative", marginBottom: 25, zIndex: 100, elevation: 100 },
  searchContainer: { flexDirection: "row", alignItems: "center" },
  suggestionsList: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    maxHeight: 220,
    overflow: "hidden",
    zIndex: 101,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
  darkSuggestionsList: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  suggestionEmpty: {
    fontSize: 15,
    color: "#666",
    fontStyle: "italic",
  },
  darkSuggestionEmpty: {
    color: "#aaa",
  },
  suggestionRowLast: {
    borderBottomWidth: 0,
  },
  darkSuggestionRow: {
    borderBottomColor: "#404040",
  },
  suggestionIcon: {
    marginRight: 10,
  },
  suggestionMain: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
  },
  darkSuggestionMain: {
    color: "#fff",
  },
  suggestionHighlight: {
    fontWeight: "700",
    color: "#1565C0",
    backgroundColor: "#E3F2FD",
  },
  darkSuggestionHighlight: {
    color: "#90CAF9",
    backgroundColor: "#1E3A5F",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginRight: 6,
  },
  searchBarIconButton: { marginLeft: 6, backgroundColor: "#f0f0f0", borderRadius: 8, padding: 8 },

  resultsContainer: { flex: 1, marginBottom: 15 },
  searchLoadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: { textAlign: "center", marginVertical: 10 },

  individualResultItem: {
    width: "100%",
    alignSelf: "stretch",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  darkIndividualResultItem: {
    borderBottomColor: "#444",
  },

  resultItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "#fff",
    borderRadius: 8,
    marginVertical: 4,
  },
  resultItemCompact: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  searchMiniCardWrap: {
    flex: 1,
    marginRight: 8,
    minWidth: 0,
  },

  resultContent: { flex: 1 },
  companyName: { fontSize: 16, fontWeight: "500", color: "#333" },
  businessTagLine: { fontSize: 12, color: "#666", marginTop: 2, fontStyle: "italic" },
  businessResultActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  businessResultActionsCompact: {
    alignSelf: "stretch",
    justifyContent: "space-around",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ddd",
  },
  darkBusinessResultActionsCompact: {
    borderTopColor: "#444",
  },
  businessTableColCompact: {
    width: undefined,
    flex: 1,
  },
  businessTableRatingCol: {
    width: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  businessTableDistanceCol: {
    width: 72,
    justifyContent: "center",
    alignItems: "center",
  },
  businessTableBountyCol: {
    width: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  businessTableLevelCol: {
    width: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  levelButton: {
    padding: 4,
  },
  metricPlaceholder: {
    fontSize: 16,
    color: "#999",
    fontWeight: "500",
  },
  businessDemoExtras: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
  },
  actionButton: { marginLeft: 10 },

  ratingContainer: { flexDirection: "row" },
  starCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFCD3C",
    marginRight: 5,
  },
  noBountyIconWrap: {
    width: 24,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  noBountyIconWrapMuted: {
    opacity: 0.48,
  },
  darkNoBountyIconWrapMuted: {
    opacity: 0.42,
  },
  noBountyEmoji: {
    fontSize: 20,
  },
  noBountySlash: {
    position: "absolute",
    width: 26,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#1a1a1a",
    transform: [{ rotate: "-42deg" }],
  },
  noBountySlashMuted: {
    backgroundColor: "#9e9e9e",
  },
  darkNoBountySlashMuted: {
    backgroundColor: "#757575",
  },
  percentSymbol: {
    fontSize: 18,
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  moneyBagContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "black",
    alignItems: "center",
    justifyContent: "center",
  },
  dollarSymbol: { fontSize: 14, fontWeight: "bold" },

  bannerAd: {
    backgroundColor: "#e0e0e0",
    padding: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
    marginBottom: 10,
  },
  bannerAdText: { fontSize: 16, fontWeight: "bold" },

  // Filter buttons container
  searchTypeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchTypeButtonsGroup: {
    flexDirection: "row",
    flexWrap: "nowrap",
    flex: 1,
    gap: 4,
  },
  searchTypeTabOption: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 6,
    marginRight: 0,
    marginBottom: 0,
  },
  searchTypeTabText: {
    fontSize: 11,
  },
  filterButtonsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 15,
    gap: 6,
  },
  filterButtonOption: {
    backgroundColor: "#f0f0f0",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 4,
    marginBottom: 4,
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#333",
  },
  activeFilterButton: {
    backgroundColor: "#4F8A8B",
  },
  activeFilterButtonText: {
    color: "#fff",
  },
  filterIconButtonActive: {
    backgroundColor: "#dcefeb",
  },
  darkFilterIconButtonActive: {
    backgroundColor: "#3a524f",
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#4F8A8B",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  filterInlineMenu: {
    backgroundColor: "#fafafa",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    padding: 12,
    marginBottom: 12,
    gap: 8,
    overflow: "hidden",
  },
  darkFilterInlineMenu: {
    backgroundColor: "#2a2a2a",
    borderColor: "#404040",
  },
  filterInlineMenuScroll: {
    flex: 1,
    minHeight: 0,
  },
  filterInlineMenuScrollContent: {
    paddingBottom: 4,
  },
  filterInlineMenuTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  darkFilterInlineMenuTitle: {
    color: "#aaa",
  },
  filterChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  citySearchPicker: {
    width: "100%",
    alignSelf: "stretch",
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  citySearchInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 10 : 8,
    fontSize: 14,
    color: "#333",
    backgroundColor: "#fff",
    ...(Platform.OS === "web" ? { outlineStyle: "none" } : null),
  },
  darkCitySearchInput: {
    borderColor: "#555",
    backgroundColor: "#1f1f1f",
    color: "#fff",
  },
  citySearchSpinner: {
    alignSelf: "flex-start",
    marginTop: 2,
  },
  citySuggestionsList: {
    width: "100%",
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  darkCitySuggestionsList: {
    borderColor: "#555",
    backgroundColor: "#1f1f1f",
  },
  cityPresetChipsScroll: {
    maxHeight: 120,
  },
  cityPresetChipsScrollCompact: {
    maxHeight: 88,
  },
  citySuggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  citySuggestionRowLast: {
    borderBottomWidth: 0,
  },
  darkCitySuggestionRow: {
    borderBottomColor: "#444",
  },
  citySuggestionIcon: {
    marginRight: 8,
  },
  citySuggestionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  citySuggestionMain: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  citySuggestionSub: {
    fontSize: 11,
    color: "#777",
    marginTop: 1,
  },
  filterChip: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  darkFilterChip: {
    backgroundColor: "#333",
    borderColor: "#555",
  },
  filterChipSelected: {
    backgroundColor: "#4F8A8B",
    borderColor: "#4F8A8B",
  },
  darkFilterChipSelected: {
    backgroundColor: "#4F8A8B",
    borderColor: "#4F8A8B",
  },
  filterChipText: {
    fontSize: 13,
    color: "#333",
    fontWeight: "500",
  },
  darkFilterChipText: {
    color: "#eee",
  },
  filterChipTextSelected: {
    color: "#fff",
  },
  darkFilterChipTextSelected: {
    color: "#fff",
  },
  filterPanel: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 15,
    overflow: "hidden",
    flexShrink: 1,
    flexDirection: "column",
  },
  darkFilterPanel: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  filterPanelBodyScroll: {
    flex: 1,
    minHeight: 0,
  },
  filterPanelBodyScrollContent: {
    paddingBottom: 8,
  },
  filterPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  darkFilterPanelHeader: {
    borderBottomColor: "#404040",
  },
  filterPanelTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
  },
  darkFilterPanelTitle: {
    color: "#fff",
  },
  filterPanelSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 6,
  },
  filterPanelSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
  },
  darkFilterPanelSectionTitle: {
    color: "#ddd",
  },
  filterPanelHint: {
    fontSize: 12,
    color: "#777",
    lineHeight: 16,
  },
  darkFilterPanelHint: {
    color: "#999",
  },
  filterPanelActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  darkFilterPanelActions: {},
  filterPanelClearButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  darkFilterPanelClearButton: {},
  filterPanelClearText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#9C45F7",
  },
  darkFilterPanelClearText: {
    color: "#b794f6",
  },
  filterPanelApplyButton: {
    backgroundColor: "#4F8A8B",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 100,
    alignItems: "center",
  },
  darkFilterPanelApplyButton: {
    backgroundColor: "#4F8A8B",
  },
  filterPanelApplyText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },

  // Legacy modal styles (unused)
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  resetOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#f8f8f8",
  },
  resetOptionText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#9C45F7",
    textAlign: "center",
  },
  distanceModalHint: {
    fontSize: 13,
    color: "#666",
    paddingHorizontal: 20,
    paddingBottom: 12,
    lineHeight: 18,
  },
  darkDistanceModalHint: {
    color: "#aaa",
  },
  optionsList: {
    paddingHorizontal: 20,
  },
  optionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  selectedOption: {
    backgroundColor: "#f8f0ff",
  },
  optionText: {
    fontSize: 16,
    color: "#333",
  },
  selectedOptionText: {
    color: "#9C45F7",
    fontWeight: "500",
  },

  // Dark mode styles
  darkContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkSafeArea: {
    backgroundColor: "#1a1a1a",
  },
  darkSearchInput: {
    backgroundColor: "#404040",
    color: "#ffffff",
  },
  darkSearchBarIconButton: {
    backgroundColor: "#404040",
  },
  darkResultItem: {
    backgroundColor: "#2d2d2d",
    borderBottomColor: "#404040",
  },
  darkCompanyName: {
    color: "#ffffff",
  },
  darkBusinessTagLine: {
    color: "#cccccc",
  },
  darkRatingText: {
    color: "#cccccc",
  },
  darkMetricPlaceholder: {
    color: "#777777",
  },
  darkNoBountySlash: {
    backgroundColor: "#f0f0f0",
  },
  darkPercentSymbol: {
    color: "#ffffff",
    borderColor: "#ffffff",
  },
  darkMoneyBagContainer: {
    borderColor: "#ffffff",
  },
  darkDollarSymbol: {
    color: "#ffffff",
  },
  darkLoadingText: {
    color: "#cccccc",
  },
  darkBannerAd: {
    backgroundColor: "#404040",
  },
  darkBannerAdText: {
    color: "#ffffff",
  },
  // Dark mode filter button styles
  darkFilterButtonOption: {
    backgroundColor: "#404040",
  },
  darkFilterButtonText: {
    color: "#ffffff",
  },
  darkActiveFilterButton: {
    backgroundColor: "#4F8A8B",
  },
  darkActiveFilterButtonText: {
    color: "#ffffff",
  },
  // Dark mode modal styles
  darkModalContainer: {
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  darkModalContent: {
    backgroundColor: "#2d2d2d",
  },
  darkModalHeader: {
    borderBottomColor: "#404040",
  },
  darkModalTitle: {
    color: "#ffffff",
  },
  darkResetOption: {
    backgroundColor: "#404040",
    borderBottomColor: "#404040",
  },
  darkResetOptionText: {
    color: "#9C45F7",
  },
  darkOptionItem: {
    borderBottomColor: "#404040",
  },
  darkSelectedOption: {
    backgroundColor: "#3d2d4d",
  },
  darkOptionText: {
    color: "#ffffff",
  },
  darkSelectedOptionText: {
    color: "#9C45F7",
  },

  // Wish item styles
  wishItem: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginVertical: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: "#000",
    position: "relative",
  },
  wishProfileContainer: {
    flexDirection: "row",
    marginBottom: 15,
    alignItems: "center",
  },
  wishProfileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  wishProfileInfo: {
    flex: 1,
  },
  wishProfileMain: {
    flex: 1,
    minWidth: 0,
  },
  wishProfileNetworkBadge: {
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    paddingTop: 6,
    paddingRight: 6,
    flexShrink: 0,
  },
  wishProfileName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#333",
  },
  wishProfileText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  wishInfoContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    minWidth: 0,
  },
  wishTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    gap: 8,
  },
  wishTitleFlex: {
    flex: 1,
    marginBottom: 0,
  },
  wishTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  wishTitleWithSuffix: {
    flexWrap: "wrap",
  },
  searchScoreSuffix: {
    fontSize: 12,
    fontWeight: "normal",
    color: "#666",
  },
  darkSearchScoreSuffix: {
    color: "#aaaaaa",
  },
  wishRespondedFlag: {
    color: "#800000",
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 0,
  },
  darkWishRespondedFlag: {
    color: "#c77dff",
  },
  wishDateTime: {
    fontSize: 13,
    color: "#666",
    marginBottom: 8,
  },
  wishDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 10,
    lineHeight: 20,
  },
  wishBountyContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  wishBountyContainerRight: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    alignSelf: "flex-end",
  },
  moneyBagIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFCD3C",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  moneyBagDollarSymbol: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ffffff",
  },
  connectionBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#9C45F7",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  connectionBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
    lineHeight: 12,
  },
  searchCardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  searchCardMetaRowCentered: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    marginTop: 4,
    marginBottom: 2,
  },
  searchCardDistancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#e8f4fc",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  searchCardDistancePillCentered: {
    alignSelf: "center",
    justifyContent: "center",
  },
  darkSearchCardDistancePill: {
    backgroundColor: "#1e3a4f",
  },
  searchCardDistanceText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0EA5E9",
  },
  darkSearchCardDistanceText: {
    color: "#7DD3FC",
  },
  searchCardNetworkBadge: {
    position: "relative",
    width: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  searchCardNetworkIcon: {
    width: 22,
    height: 22,
  },
  bountyEmojiIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  bountyEmojiIconCompact: {
    fontSize: 20,
    marginRight: 0,
  },
  wishBountyLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  wishBountyValue: {
    fontSize: 16,
    color: "#AF52DE",
    fontWeight: "bold",
  },
  // Dark mode wish styles
  darkWishItem: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
    boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.3)",
  },
  darkWishProfileImage: {
    // tintColor moved to Image prop
  },
  darkWishProfileName: {
    color: "#ffffff",
  },
  darkWishProfileText: {
    color: "#cccccc",
  },
  darkWishTitle: {
    color: "#ffffff",
  },
  darkWishDateTime: {
    color: "#cccccc",
  },
  darkWishDescription: {
    color: "#cccccc",
  },
  darkWishBountyLabel: {
    color: "#cccccc",
  },
  darkWishBountyValue: {
    color: "#9C45F7",
  },
  darkWishInfoContainer: {
    borderTopColor: "#404040",
  },
  expertiseOfferingCostRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginLeft: 0,
    marginTop: 4,
  },
  expertiseOfferingHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 4,
  },
  expertiseOfferingHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  expertiseOfferingRightCluster: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 8,
  },
  expertiseOfferingBountyCompact: {
    textAlign: "right",
    minWidth: 60,
  },
  expertiseOfferingMetaRow: {
    marginTop: 6,
  },
  seekingMetaLineSpaceBetween: {
    justifyContent: "space-between",
  },
  seekingMetaSpacer: {
    flex: 1,
  },
  seekingMetaRow: {
    marginLeft: 0,
  },
  seekingMetaLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  seekingMetaText: {
    color: "#666",
    fontSize: 13,
  },
  darkSeekingMetaText: {
    color: "#999",
  },
  ownExpertiseNotice: {
    fontSize: 13,
    color: "#6e1010",
    fontStyle: "italic",
    marginTop: 4,
  },
  darkOwnExpertiseNotice: {
    color: "#e8a0a0",
  },

  // Search type button styles
  searchTypeButtonBusinesses: {
    backgroundColor: "#4F8A8B",
  },
  searchTypeButtonOrganizations: {
    backgroundColor: "#4F8A8B",
  },
  searchTypeButtonGlobal: {
    backgroundColor: "#4F8A8B",
  },
  searchTypeButtonExpertise: {
    backgroundColor: "#4F8A8B",
  },
  searchTypeButtonSeeking: {
    backgroundColor: "#4F8A8B",
  },
  searchTypeButtonIndividuals: {
    backgroundColor: "#4F8A8B",
  },
  searchTypeButtonTextBusinesses: {
    color: "#fff",
    fontWeight: "600",
  },
  searchTypeButtonTextOrganizations: {
    color: "#fff",
    fontWeight: "600",
  },
  searchTypeButtonTextGlobal: {
    color: "#fff",
    fontWeight: "600",
  },
  searchTypeButtonTextExpertise: {
    color: "#fff",
    fontWeight: "600",
  },
  searchTypeButtonTextSeeking: {
    color: "#fff",
    fontWeight: "600",
  },
  searchTypeButtonTextIndividuals: {
    color: "#fff",
    fontWeight: "600",
  },
  // Dark mode search type button styles
  darkSearchTypeButtonBusinesses: {
    backgroundColor: "#AF52DE",
  },
  darkSearchTypeButtonOrganizations: {
    backgroundColor: "#2A9D8F",
  },
  darkSearchTypeButtonGlobal: {
    backgroundColor: "#6A5ACD",
  },
  darkSearchTypeButtonExpertise: {
    backgroundColor: "#FFCD3C",
  },
  darkSearchTypeButtonSeeking: {
    backgroundColor: "#9C45F7",
  },
  darkSearchTypeButtonIndividuals: {
    backgroundColor: "#007AFF",
  },
  darkSearchTypeButtonTextBusinesses: {
    color: "#fff",
    fontWeight: "600",
  },
  darkSearchTypeButtonTextOrganizations: {
    color: "#fff",
    fontWeight: "600",
  },
  darkSearchTypeButtonTextGlobal: {
    color: "#fff",
    fontWeight: "600",
  },
  darkSearchTypeButtonTextExpertise: {
    color: "#000",
    fontWeight: "600",
  },
  darkSearchTypeButtonTextSeeking: {
    color: "#fff",
    fontWeight: "600",
  },
  darkSearchTypeButtonTextIndividuals: {
    color: "#fff",
    fontWeight: "600",
  },
  globalSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(79, 138, 139, 0.5)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  globalSectionHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
  darkGlobalSectionHeader: {
    backgroundColor: "rgba(61, 107, 108, 0.5)",
  },
  darkGlobalSectionHeaderText: {
    color: "#fff",
  },
  showMoreResultsButton: {
    marginTop: 12,
    marginBottom: 8,
    marginHorizontal: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  darkShowMoreResultsButton: {
    borderColor: "#666",
    backgroundColor: "#3a3a3a",
  },
  showMoreResultsButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  darkShowMoreResultsButtonText: {
    color: "#ffffff",
  },
  individualsSearchHint: {
    fontSize: 14,
    lineHeight: 20,
    color: "#666",
    paddingHorizontal: 4,
    paddingVertical: 12,
    textAlign: "center",
  },
  darkIndividualsSearchHint: {
    color: "#bbb",
  },
  scoreText: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  scoreBreakdownText: {
    fontSize: 10,
    color: "#7a7a7a",
    marginTop: 1,
  },
  darkScoreText: {
    color: "#cccccc",
  },
  darkScoreBreakdownText: {
    color: "#aaaaaa",
  },
});
