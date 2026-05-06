import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  SafeAreaView,
  TouchableWithoutFeedback,
  Platform,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
// import axios from 'axios';
import MiniCard from "../components/MiniCard";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import {
  API_BASE_URL,
  USER_PROFILE_INFO_ENDPOINT,
  BUSINESS_INFO_ENDPOINT,
  CIRCLES_ENDPOINT,
  PROFILE_VIEWS_ENDPOINT,
  BUSINESS_RESULTS_ENDPOINT,
  BUSINESS_AVG_RATINGS_ENDPOINT,
  BUSINESS_MAX_BOUNTY_ENDPOINT,
  BUSINESS_TAG_SEARCH_ENDPOINT,
} from "../apiConfig";
import config from "../config";
import { useDarkMode } from "../contexts/DarkModeContext";
import { reinitializeUnreadFromOutside } from "../contexts/UnreadContext";
import { persistMyBusinessUidsFromProfile } from "../utils/myBusinessUids";
import { sanitizeText } from "../utils/textSanitizer";
import { getBusinessSuggestions as fetchGooglePlaces, getPlaceDetails } from "../utils/googlePlaces";
import { isWishEnded } from "../utils/wishUtils";
import { resolveProfileItemImageUri } from "../utils/resolveProfileItemImageUri";
import FeedbackPopup from "../components/FeedbackPopup";
import ScannedProfilePopup from "../components/ScannedProfilePopup";
import { getHeaderColors } from "../config/headerColors";

const ProfileScreenAPI = USER_PROFILE_INFO_ENDPOINT;
console.log(`ProfileScreen - Full endpoint: ${ProfileScreenAPI}`);

/**
 * Unwrap common API shapes so ProfileScreen always sees flat { personal_info, experience_info, ... }.
 * Backend changes (Lambda proxy body, { data }, { result }) previously left user null: the user_uid
 * bootstrap required personal_info.profile_personal_uid on the raw JSON top level.
 */
function normalizeUserProfileInfoResponse(raw) {
  if (raw == null || typeof raw !== "object") return raw;
  let cur = raw;

  if (typeof cur.body === "string") {
    const trimmed = cur.body.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const inner = JSON.parse(cur.body);
        if (inner && typeof inner === "object") cur = inner;
      } catch (_) {}
    }
  }

  const missingPersonalBlock = (o) => o == null || (o.personal_info == null && o.profile_info == null);

  if (cur.data && typeof cur.data === "object" && missingPersonalBlock(cur)) {
    cur = cur.data;
  }
  if (cur.result && typeof cur.result === "object" && missingPersonalBlock(cur)) {
    cur = cur.result;
  }

  if (typeof cur.personal_info === "string") {
    try {
      const p = JSON.parse(cur.personal_info);
      if (p && typeof p === "object") cur = { ...cur, personal_info: p };
    } catch (_) {}
  }

  // Backend userprofileinfo uses profile_info + email_id; UI expects personal_info + user_email
  if (cur.personal_info == null && cur.profile_info != null && typeof cur.profile_info === "object") {
    cur = { ...cur, personal_info: cur.profile_info };
  }
  if ((cur.user_email == null || cur.user_email === "") && cur.email_id != null && cur.email_id !== "") {
    cur = { ...cur, user_email: cur.email_id };
  }

  if (cur.social_links == null && Array.isArray(cur.links_info) && cur.links_info.length > 0) {
    const social = {};
    for (const row of cur.links_info) {
      if (!row || typeof row !== "object") continue;
      const name = String(row.social_link_name || row.link_name || row.platform || "").toLowerCase();
      const url = row.social_link_url || row.url || row.link || "";
      if (name.includes("facebook")) social.facebook = url;
      else if (name.includes("twitter") || name === "x") social.twitter = url;
      else if (name.includes("linkedin")) social.linkedin = url;
      else if (name.includes("youtube")) social.youtube = url;
    }
    if (Object.keys(social).length > 0) cur = { ...cur, social_links: social };
  }

  return cur;
}

function getProfilePersonalUid(apiUser) {
  if (!apiUser || typeof apiUser !== "object") return "";
  const pi = apiUser.personal_info || apiUser.profile_info;
  const fromPi = pi && typeof pi === "object" ? pi.profile_personal_uid || pi.profile_uid : "";
  if (fromPi != null && String(fromPi).trim() !== "") return String(fromPi).trim();
  const top = apiUser.profile_personal_uid || apiUser.profile_uid;
  return top != null ? String(top).trim() : "";
}

/** API may return a JSON string, an array, or a single object; .map must not throw. */
function parseProfileJsonArray(val) {
  if (val == null || val === "") return [];
  let v = val;
  if (typeof val === "string") {
    try {
      v = JSON.parse(val);
    } catch {
      return [];
    }
  }
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return [v];
  return [];
}

/** Matches SearchScreen: 💰 with a slash overlay for "no bounty" */
function NoBountyIcon({ darkMode }) {
  return (
    <View style={profileStyles.noBountyIconWrap} accessibilitylabel='No bounty'>
      <Text style={profileStyles.noBountyEmoji}>💰</Text>
      <View pointerEvents='none' style={[profileStyles.noBountySlash, darkMode && profileStyles.darkNoBountySlash]} />
    </View>
  );
}

// Helper function to format phone number for display
const formatPhoneNumberForDisplay = (phoneNumber) => {
  if (!phoneNumber) return "";
  // Remove all non-digit characters
  const cleaned = ("" + phoneNumber).replace(/\D/g, "");
  // If it's not 10 digits, return as-is
  if (cleaned.length !== 10) return phoneNumber;
  // Format as (XXX) XXX-XXXX
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phoneNumber;
};

// Display stored "YYYY-MM-DD HH:mm" or "YYYY-MM-DDTHH:mm" as "mm-dd-yyyy hh:mm"
const formatDateTimeForDisplay = (value) => {
  if (!value || typeof value !== "string" || value.trim() === "") return "";
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{1,2}):(\d{2})/);
  if (match) {
    const [, y, m, d, h, min] = match;
    return `${m}/${d}/${y} ${String(parseInt(h, 10)).padStart(2, "0")}:${min}`;
  }
  return value;
};

const ProfileScreen = ({ route, navigation }) => {
  // modified on 11/08 - for network profile navigation
  // Allows opening a specific user's profile when navigating from the Network screen
  const { profile_uid: routeProfileUID, returnTo, searchState } = route.params || {};

  /** Forward Google/Apple prefill when routing incomplete profiles to UserInfo (OAuth skips App.js profile fetch). */
  const getOauthUserInfoNavigateParams = () => {
    const op = route.params?.oauthPrefill;
    if (!op) return {};
    return {
      ...(op.googleUserInfo ? { googleUserInfo: op.googleUserInfo } : {}),
      ...(op.appleUserInfo ? { appleUserInfo: op.appleUserInfo } : {}),
    };
  };

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profileUID, setProfileUID] = useState("");
  const [businessesData, setBusinessesData] = useState([]);
  const [isCurrentUserProfile, setIsCurrentUserProfile] = useState(false);
  const [showRelationshipDropdown, setShowRelationshipDropdown] = useState(false);
  const [showConnectPopup, setShowConnectPopup] = useState(false);
  const [existingRelationship, setExistingRelationship] = useState(null);
  const [relationshipType, setRelationshipType] = useState(null);
  const [circleUid, setCircleUid] = useState(null);
  const { darkMode } = useDarkMode();
  const [showExperience, setShowExperience] = useState(true);
  const [showEducation, setShowEducation] = useState(true);
  const [showBusiness, setShowBusiness] = useState(true);
  const [showReviews, setShowReviews] = useState(true);
  const [showOffering, setShowOffering] = useState(true);

  // Review search modal
  const [reviewSearchVisible, setReviewSearchVisible] = useState(false);
  const [reviewSearchQuery, setReviewSearchQuery] = useState("");
  const [reviewSearchResults, setReviewSearchResults] = useState([]);
  const [reviewSearchLoading, setReviewSearchLoading] = useState(false);
  const [reviewSearchDone, setReviewSearchDone] = useState(false);
  // Google Places autocomplete
  const [placeSuggestions, setPlaceSuggestions] = useState([]);
  const [savingGooglePlace, setSavingGooglePlace] = useState(false);
  const placesDebounceRef = useRef(null);

  const fetchPlacesSuggestions = (text) => {
    if (placesDebounceRef.current) clearTimeout(placesDebounceRef.current);
    if (!text.trim()) {
      setPlaceSuggestions([]);
      return;
    }
    placesDebounceRef.current = setTimeout(async () => {
      const results = await fetchGooglePlaces(text);
      setPlaceSuggestions(results);
    }, 400);
  };

  // ─── User picks a Google Place from the overlay ────────────────────────────
  const handleGooglePlaceSelect = async (place) => {
    setPlaceSuggestions([]);
    setReviewSearchVisible(false);
    setSavingGooglePlace(true);
    try {
      const pd = await getPlaceDetails(place.place_id);
      const uid = (await AsyncStorage.getItem("user_uid")) || (await AsyncStorage.getItem("profile_uid")) || "";

      const formData = new FormData();
      formData.append("user_uid", uid);
      formData.append("business_name", place.structured_formatting?.main_text || place.description);
      formData.append("business_google_id", place.place_id);
      formData.append("business_role", "unclaimed"); // reviewer-saved; owner can claim later
      if (pd.address_line_1) formData.append("business_address_line_1", pd.address_line_1);
      if (pd.city) formData.append("business_city", pd.city);
      if (pd.state) formData.append("business_state", pd.state);
      if (pd.country) formData.append("business_country", pd.country);
      if (pd.zip) formData.append("business_zip_code", pd.zip);
      if (pd.lat != null) formData.append("business_latitude", String(pd.lat));
      if (pd.lng != null) formData.append("business_longitude", String(pd.lng));
      if (pd.phone) formData.append("business_phone_number", pd.phone);
      if (pd.website) formData.append("business_website", pd.website);

      const saveRes = await fetch(BUSINESS_INFO_ENDPOINT, { method: "POST", body: formData });
      const saveJson = await saveRes.json();

      // Backend returns business_uid even on 409 (already exists)
      let businessUid = saveJson.business_uid;

      if (saveRes.status === 409 && !businessUid) {
        // Fallback for older backend versions
        const srRes = await fetch(`${BUSINESS_RESULTS_ENDPOINT}?q=${encodeURIComponent(place.structured_formatting?.main_text || place.description)}`);
        const srJson = await srRes.json();
        const arr = Array.isArray(srJson) ? srJson : srJson.results || srJson.result || [];
        businessUid = arr[0]?.business_uid;
      }

      if (!businessUid) {
        Alert.alert("Error", "Could not find or create this business. Please try again.");
        return;
      }

      navigation.navigate("ReviewBusiness", {
        business_uid: businessUid,
        business_name: place.structured_formatting?.main_text || place.description,
      });
    } catch (e) {
      console.error("[ProfileScreen] google place select error:", e);
      Alert.alert("Error", "Could not load business. Please try again.");
    } finally {
      setSavingGooglePlace(false);
    }
  };

  const searchBusinessesForReview = async (q) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setPlaceSuggestions([]);
    setReviewSearchLoading(true);
    setReviewSearchDone(false);

    // Fire Places in parallel — results will only be shown if DB returns nothing
    fetchPlacesSuggestions(trimmed);

    try {
      const res = await fetch(`${BUSINESS_RESULTS_ENDPOINT}?q=${encodeURIComponent(trimmed)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text || text.trimStart().startsWith("<")) throw new Error("Non-JSON");
      const json = JSON.parse(text);
      // SearchScreen checks Array.isArray first — the API may return an array directly
      const arr = Array.isArray(json) ? json : json.results || json.result || [];
      const sanitize = (t) => {
        if (!t) return "";
        const s = String(t).trim();
        return s === "." ? "" : s;
      };
      let list = arr.map((b) => ({
        id: String(b.business_uid || ""),
        company: sanitize(b.business_name || b.company) || "Unknown Business",
        business_profile_img: b.business_profile_img ? b.business_profile_img.trim() : null,
        business_tag_line: sanitize(b.business_tag_line),
        rating: null,
        ratingCount: 0,
        max_bounty: b.max_bounty || b.business_max_bounty || null,
        connection_degree: null,
      }));
      // Tag search — same as SearchScreen
      try {
        const tagRes = await fetch(`${BUSINESS_TAG_SEARCH_ENDPOINT}?q=${encodeURIComponent(trimmed)}`);
        const tagJson = await tagRes.json();
        const tagResults = tagJson.result || [];
        if (tagResults.length > 0) {
          const existingIds = new Set(list.map((b) => b.id));
          const tagList = tagResults
            .filter((b) => !existingIds.has(b.business_uid))
            .map((b) => ({
              id: b.business_uid,
              company: sanitize(b.business_name) || "Unknown Business",
              business_profile_img: b.business_profile_img ? b.business_profile_img.trim() : null,
              business_tag_line: sanitize(b.business_tag_line),
              rating: null,
              ratingCount: 0,
              max_bounty: null,
              connection_degree: null,
            }));
          list = [...list, ...tagList];
        }
      } catch (_) {}
      // Fetch avg ratings + connection degree (same as SearchScreen)
      try {
        const profileUid = await AsyncStorage.getItem("profile_uid");
        const uids = list.map((b) => b.id).join(",");
        const ratingsUrl = `${BUSINESS_AVG_RATINGS_ENDPOINT}?uids=${uids}${profileUid ? `&viewer_uid=${profileUid}` : ""}`;
        const ratingsRes = await fetch(ratingsUrl);
        const ratingsJson = await ratingsRes.json();
        if (ratingsJson.result) {
          list = list.map((b) => ({
            ...b,
            rating: ratingsJson.result[b.id] && Number.isFinite(parseFloat(ratingsJson.result[b.id].avg_rating)) ? parseFloat(ratingsJson.result[b.id].avg_rating) : null,
            ratingCount: ratingsJson.result[b.id] ? ratingsJson.result[b.id].rating_count : 0,
            connection_degree: ratingsJson.result[b.id]?.nearest_connection ?? null,
          }));
        }
      } catch (_) {}
      // Fetch max bounty (same as SearchScreen)
      try {
        const uids = list.map((b) => b.id).join(",");
        const bountyRes = await fetch(`${BUSINESS_MAX_BOUNTY_ENDPOINT}?uids=${encodeURIComponent(uids)}`);
        const bountyJson = await bountyRes.json();
        if (bountyJson.result) {
          list = list.map((b) => ({
            ...b,
            max_bounty: bountyJson.result[b.id] ? parseFloat(bountyJson.result[b.id].max_bounty) : null,
          }));
        }
      } catch (_) {}
      setReviewSearchResults(list);
      // Places fired in parallel — always let them show alongside DB results
    } catch (e) {
      console.error("[ProfileScreen] review search error:", e);
      setReviewSearchResults([]);
      // Places already fired in parallel — leave them to show
    } finally {
      setReviewSearchLoading(false);
      setReviewSearchDone(true);
    }
  };
  const [showSeeking, setShowSeeking] = useState(true);

  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);

  const profileFeedbackInstructions = "Instructions for Profile";

  // Define custom questions for the Account page
  const profileFeedbackQuestions = ["Profile - Question 1?", "Profile - Question 2?", "Profile - Question 3?"];

  useFocusEffect(
    React.useCallback(() => {
      async function loadProfile() {
        // console.log("ProfileScreen - useFocusEffect triggered, reloading profile data");
        setLoading(true);

        // Check if a specific profile_uid was passed via route params (for viewing other users' profiles)
        const loggedInProfileUID = await AsyncStorage.getItem("profile_uid");

        if (routeProfileUID) {
          // console.log("ProfileScreen - Loading profile from route params:", routeProfileUID);
          // console.log("ProfileScreen - Logged in profile UID:", loggedInProfileUID);
          setProfileUID(routeProfileUID);
          // Check if the profile being viewed matches the logged-in user's profile
          setIsCurrentUserProfile(routeProfileUID === loggedInProfileUID);
          await fetchUserData(routeProfileUID);
          // Fetch relationship if viewing another user's profile
          if (loggedInProfileUID && routeProfileUID !== loggedInProfileUID) {
            await fetchRelationship(loggedInProfileUID, routeProfileUID);
            // Record that the logged-in user viewed this profile
            recordProfileView(routeProfileUID, loggedInProfileUID);
          }
          return;
        }

        let profileId = loggedInProfileUID;
        // console.log("ProfileScreen - profileId from AsyncStorage:", profileId);
        if (profileId) {
          setProfileUID(profileId);
          // console.log("ProfileScreen - Setting profileUID state to:", profileId);
          // This is the logged-in user's own profile
          setIsCurrentUserProfile(true);
          await fetchUserData(profileId);
          return;
        }

        // If no profile_uid, try to get user_uid and fetch profile
        const userId = await AsyncStorage.getItem("user_uid");
        // console.log("ProfileScreen - userId:", userId);
        if (userId) {
          try {
            console.log("ProfileScreen - Profile Endpoint call loadProfile: ", `${ProfileScreenAPI}/${userId}`);
            const response = await fetch(`${ProfileScreenAPI}/${userId}`);
            const apiUser = normalizeUserProfileInfoResponse(await response.json());

            // Handle case where profile is not found (404 error)
            if ((!response.ok && response.status === 404) || apiUser.message === "Profile not found for this user" || (apiUser.code === 404 && apiUser.message === "Profile not found for this user")) {
              // console.log("ProfileScreen - Profile not found for current user, routing to UserInfo");
              setLoading(false);
              // Clear any existing profile data but keep user credentials
              await AsyncStorage.multiRemove(["profile_uid", "user_first_name", "user_last_name", "user_phone_number"]);
              reinitializeUnreadFromOutside().catch(() => {});
              navigation.navigate("UserInfo", getOauthUserInfoNavigateParams());
              return;
            }

            const resolvedProfileUid = getProfilePersonalUid(apiUser);
            if (apiUser && resolvedProfileUid) {
              profileId = resolvedProfileUid;
              setProfileUID(profileId);
              // This is the logged-in user's own profile (fetched via user_uid)
              setIsCurrentUserProfile(true);
              await AsyncStorage.setItem("profile_uid", profileId);
              reinitializeUnreadFromOutside().catch(() => {});
              // Same payload as GET by profile id — hydrate from this response (avoid duplicate GET)
              await processProfileApiUser(apiUser, profileId, response);
              return;
            }
          } catch (err) {
            console.error("Error fetching profile by user_uid:", err);
          }
        }

        // // If still not found, show error
        setLoading(false);
        Alert.alert("Error", "Failed to load profile data. Please log in again.");
      }
      loadProfile();
    }, [routeProfileUID, JSON.stringify(route.params?.oauthPrefill ?? null)]), // oauthPrefill: OAuth → Profile → UserInfo prefill
  );

  async function recordProfileView(viewedProfileId, viewerProfileId) {
    try {
      console.log("[ProfileScreen] recordProfileView - view_profile_id:", viewedProfileId, "view_viewer_id:", viewerProfileId);
      await fetch(PROFILE_VIEWS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_view_profile_id: viewedProfileId, profile_view_viewer_id: viewerProfileId }),
      });
    } catch (e) {
      console.warn("ProfileScreen - Failed to record profile view:", e);
    }
  }

  /**
   * Maps GET /userprofileinfo/:id JSON into screen state. Call with the parsed body from a single fetch;
   * :id may be profile_personal_uid or user_uid if the API resolves both to the same document shape.
   */
  async function processProfileApiUser(apiUser, profileUID, response) {
    apiUser = normalizeUserProfileInfoResponse(apiUser);

    // Handle case where profile is not found (404 error)
    if (
      (!response.ok && response.status === 404) ||
      !apiUser ||
      apiUser.message === "Profile not found for this user" ||
      (apiUser.code === 404 && apiUser.message === "Profile not found for this user")
    ) {
      const currentUserUid = await AsyncStorage.getItem("user_uid");
      const currentProfileUid = await AsyncStorage.getItem("profile_uid");

      if (isCurrentUserProfile || profileUID === currentUserUid || profileUID === currentProfileUid) {
        setLoading(false);
        await AsyncStorage.multiRemove(["profile_uid", "user_first_name", "user_last_name", "user_phone_number"]);
        navigation.navigate("UserInfo", getOauthUserInfoNavigateParams());
        return;
      }

      console.log("No profile data found for user (viewing other user's profile)");
      setUser(null);
      setLoading(false);
      return;
    }

    const storedProfileUid = await AsyncStorage.getItem("profile_uid");
    if (storedProfileUid && profileUID === storedProfileUid) {
      const bizListChanged = await persistMyBusinessUidsFromProfile(apiUser);
      if (bizListChanged) reinitializeUnreadFromOutside().catch(() => {});
    }

    try {
      const userData = {
        profile_uid: profileUID,
        email: apiUser?.user_email || "",
        firstName: apiUser.personal_info?.profile_personal_first_name || "",
        lastName: apiUser.personal_info?.profile_personal_last_name || "",
        phoneNumber: apiUser.personal_info?.profile_personal_phone_number || "",
        tagLine: apiUser.personal_info?.profile_personal_tag_line || "",
        city: apiUser.personal_info?.profile_personal_city || "",
        state: apiUser.personal_info?.profile_personal_state || "",
        shortBio: apiUser.personal_info?.profile_personal_short_bio || "",
        emailIsPublic: apiUser.personal_info?.profile_personal_email_is_public === 1,
        phoneIsPublic: apiUser.personal_info?.profile_personal_phone_number_is_public === 1,
        imageIsPublic: apiUser.personal_info?.profile_personal_image_is_public === 1,
        tagLineIsPublic: apiUser.personal_info?.profile_personal_tag_line_is_public === 1,
        locationIsPublic: apiUser.personal_info?.profile_personal_location_is_public === 1,
        shortBioIsPublic: apiUser.personal_info?.profile_personal_short_bio_is_public === 1,
        experienceIsPublic: apiUser.personal_info?.profile_personal_experience_is_public === 1,
        educationIsPublic: apiUser.personal_info?.profile_personal_education_is_public === 1,
        expertiseIsPublic: apiUser.personal_info?.profile_personal_expertise_is_public === 1,
        wishesIsPublic: apiUser.personal_info?.profile_personal_wishes_is_public === 1,
        businessIsPublic: apiUser.personal_info?.profile_personal_business_is_public === 1,
        profileImage: apiUser.personal_info?.profile_personal_image ? String(apiUser.personal_info.profile_personal_image) : "",
      };
      userData.experience = apiUser.experience_info
        ? (typeof apiUser.experience_info === "string" ? JSON.parse(apiUser.experience_info) : apiUser.experience_info).map((exp) => ({
            profile_experience_uid: exp.profile_experience_uid || "",
            company: exp.profile_experience_company_name || "",
            title: exp.profile_experience_position || "",
            description: exp.profile_experience_description || "",
            quantity: exp.profile_experience_quantity || "",
            startDate: exp.profile_experience_start_date || "",
            endDate: exp.profile_experience_end_date || "",
            isPublic: exp.profile_experience_is_public === 1 || exp.isPublic === true,
          }))
        : [];
      userData.education = apiUser.education_info
        ? (typeof apiUser.education_info === "string" ? JSON.parse(apiUser.education_info) : apiUser.education_info).map((edu) => ({
            profile_education_uid: edu.profile_education_uid || "",
            school: edu.profile_education_school_name || "",
            degree: edu.profile_education_degree || "",
            startDate: edu.profile_education_start_date || "",
            endDate: edu.profile_education_end_date || "",
            isPublic: edu.profile_education_is_public === 1 || edu.isPublic === true,
          }))
        : [];
      // Log business_info from API
      // console.log("ProfileScreen - apiUser.business_info (raw):", apiUser.business_info);
      // console.log("ProfileScreen - apiUser.business_info type:", typeof apiUser.business_info);

      // Map business_info to userData.businesses
      // Ensure business_info is parsed correctly
      userData.businesses = parseProfileJsonArray(apiUser.business_info).map((bus) => ({
        profile_business_uid: bus.business_uid || bus.profile_business_uid || "",
        name: bus.business_name || bus.profile_business_name || "",
        role: bus.profile_business_role || bus.role || bus.bu_role || "",
        isApproved: bus.profile_business_approved === "1" || bus.profile_business_approved === 1 || bus.isApproved === true || bus.isApproved === "1",
        isPublic: bus.profile_business_is_visible === "1" || bus.profile_business_is_visible === 1 || bus.isPublic === true || bus.isPublic === "1",
        bu_individual_business_is_public: bus.bu_individual_business_is_public === "1" || bus.bu_individual_business_is_public === 1 || bus.bu_individual_business_is_public === true,
        individualIsPublic: bus.bu_individual_business_is_public === true || bus.bu_individual_business_is_public === 1 || bus.bu_individual_business_is_public === "1",
      }));

      // console.log("ProfileScreen - userData.businesses (after mapping):", JSON.stringify(userData.businesses, null, 2));
      // console.log("ProfileScreen - userData.businesses.length:", userData.businesses.length);

      userData.expertise = parseProfileJsonArray(apiUser.expertise_info).map((exp) => ({
        profile_expertise_uid: exp.profile_expertise_uid || "",
        name: exp.profile_expertise_title || "",
        description: exp.profile_expertise_description || "",
        quantity: exp.profile_expertise_quantity || exp.quantity || "",
        cost: exp.profile_expertise_cost || "",
        bounty: exp.profile_expertise_bounty || "",
        profile_expertise_image: exp.profile_expertise_image || "",
        profile_expertise_image_is_public: exp.profile_expertise_image_is_public === 0 || exp.profile_expertise_image_is_public === "0" ? 0 : 1,
        profile_expertise_start: exp.profile_expertise_start || "",
        profile_expertise_end: exp.profile_expertise_end || "",
        profile_expertise_location: exp.profile_expertise_location || "",
        profile_expertise_mode: exp.profile_expertise_mode || "",
        isPublic: exp.profile_expertise_is_public === 1 || exp.isPublic === true,
      }));
      userData.wishes = parseProfileJsonArray(apiUser.wishes_info).map((wish) => ({
        profile_wish_uid: wish.profile_wish_uid || "",
        helpNeeds: wish.profile_wish_title || "",
        details: wish.profile_wish_description || "",
        amount: wish.profile_wish_bounty || "",
        cost: wish.profile_wish_cost != null && wish.profile_wish_cost !== "" ? wish.profile_wish_cost : "0",
        profile_wish_quantity: wish.profile_wish_quantity != null ? String(wish.profile_wish_quantity) : "",
        profile_wish_image: wish.profile_wish_image || "",
        profile_wish_image_is_public: wish.profile_wish_image_is_public === 0 || wish.profile_wish_image_is_public === "0" ? 0 : 1,
        profile_wish_start: wish.profile_wish_start || "",
        profile_wish_end: wish.profile_wish_end || "",
        profile_wish_location: wish.profile_wish_location || "",
        profile_wish_mode: wish.profile_wish_mode || "",
        isPublic: wish.profile_wish_is_public === 1 || wish.isPublic === true,
        wish_responses: wish.wish_responses || 0,
      }));
      const socialLinks =
        typeof apiUser.social_links === "string"
          ? (() => {
              try {
                return JSON.parse(apiUser.social_links);
              } catch {
                return {};
              }
            })()
          : apiUser.social_links && typeof apiUser.social_links === "object"
            ? apiUser.social_links
            : {};
      userData.facebook = socialLinks.facebook || "";
      userData.twitter = socialLinks.twitter || "";
      userData.linkedin = socialLinks.linkedin || "";
      userData.youtube = socialLinks.youtube || "";
      // console.log("ProfileScreen - Setting user data:", userData);
      // console.log("ProfileScreen - Profile UID in userData:", userData.profile_uid);
      setUser(userData);

      userData.ratings = apiUser.ratings_info || [];
      setUser(userData);
      // console.log("ProfileScreen - API business_is_public value:", apiUser.personal_info?.profile_personal_business_is_public);
      // console.log("ProfileScreen - userData.businessIsPublic:", userData.businessIsPublic);

      const rawBusinessInfo = parseProfileJsonArray(apiUser.business_info);
      const mappedBusinesses = rawBusinessInfo.map((bus, index) => {
        const businessProfileImg = bus.business_profile_img && String(bus.business_profile_img).trim() !== "" ? String(bus.business_profile_img).trim() : null;
        const imageIsPublic = bus.business_profile_img_is_public === 1 || bus.business_profile_img_is_public === "1" || bus.business_image_is_public === 1 || bus.business_image_is_public === "1";
        return {
          business_name: bus.business_name || "",
          business_city: bus.business_city || "",
          business_state: bus.business_state || "",
          business_zip_code: bus.business_zip_code || "",
          business_phone_number: bus.business_phone_number || "",
          business_address_line_1: bus.business_address_line_1 || "",
          business_tag_line: bus.business_tag_line || bus.tagline || "",
          business_email_id: bus.business_email_id || bus.business_email || "",
          business_website: bus.business_website || "",
          phoneIsPublic: bus.business_phone_number_is_public === 1 || bus.business_phone_number_is_public === "1" || bus.business_phone_number_is_public === true,
          emailIsPublic: bus.business_email_id_is_public === 1 || bus.business_email_id_is_public === "1" || true,
          taglineIsPublic: bus.business_tag_line_is_public === 1 || bus.business_tag_line_is_public === "1" || true,
          business_uid: bus.business_uid || "",
          profile_business_uid: bus.business_uid || bus.profile_business_uid || "",
          role: bus.bu_role || "",
          individualIsPublic: bus.bu_individual_business_is_public === 1 || bus.bu_individual_business_is_public === "1" || bus.bu_individual_business_is_public === true,
          first_image: businessProfileImg || null,
          business_profile_img: businessProfileImg,
          imageIsPublic: !!imageIsPublic,
          index,
        };
      });
      // console.log("mappedBusinesses result:", JSON.stringify(mappedBusinesses, null, 2));
      setBusinessesData(mappedBusinesses);
      setLoading(false);
    } catch (error) {
      console.error("ProfileScreen - processProfileApiUser:", error);
      setUser(null);
      setLoading(false);
    }
  }

  async function fetchUserData(profileUID) {
    try {
      console.log("ProfileScreen - Profile Endpoint call fetchUserData: ", `${ProfileScreenAPI}/${profileUID}`);
      const response = await fetch(`${ProfileScreenAPI}/${profileUID}`);
      const apiUser = normalizeUserProfileInfoResponse(await response.json());
      await processProfileApiUser(apiUser, profileUID, response);
    } catch (error) {
      console.error("ProfileScreen - fetchUserData:", error);
      setUser(null);
      setLoading(false);
    }
  }

  // Log businessesData changes for debugging (runs only when businessesData changes, not on every render)
  useEffect(() => {
    console.log("ProfileScreen - businessesData changed:", businessesData);
    console.log("ProfileScreen - businessesData.length:", businessesData?.length);
  }, [businessesData]);

  // Handle clicking outside dropdown on web
  useEffect(() => {
    if (Platform.OS !== "web" || !showRelationshipDropdown) return;

    const handleClickOutside = (event) => {
      // Get the dropdown elements
      const dropdownButton = document.querySelector("[data-dropdown-button]");
      const dropdownMenu = document.querySelector("[data-dropdown-menu]");
      const target = event.target;

      // console.log("ProfileScreen - Click outside handler triggered");
      // console.log("ProfileScreen - Target:", target);
      // console.log("ProfileScreen - Dropdown button:", dropdownButton);
      // console.log("ProfileScreen - Dropdown menu:", dropdownMenu);

      // Check if click is inside the dropdown menu or button
      // Check if target or any of its parents is the dropdown button or menu
      let clickedButton = false;
      let clickedMenu = false;

      let element = target;
      while (element) {
        if (element === dropdownButton || element.getAttribute?.("data-dropdown-button")) {
          clickedButton = true;
          // console.log("ProfileScreen - Click detected on dropdown button");
          break;
        }
        if (element === dropdownMenu || element.getAttribute?.("data-dropdown-menu")) {
          clickedMenu = true;
          // console.log("ProfileScreen - Click detected on dropdown menu");
          break;
        }
        element = element.parentElement;
      }

      // Only close if click is completely outside both button and menu
      if (!clickedButton && !clickedMenu) {
        // console.log("ProfileScreen - Click outside detected, closing dropdown");
        setShowRelationshipDropdown(false);
      } else {
        console.log("ProfileScreen - Click inside dropdown, not closing");
      }
    };

    // Use click event with a delay to let onPress handlers fire first
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside, false); // Use bubble phase, not capture
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside, false);
    };
  }, [showRelationshipDropdown]);

  const fetchBusinessesData = async (businesses) => {
    try {
      // console.log("ProfileScreen - fetchBusinessesData called with businesses:", JSON.stringify(businesses, null, 2));
      // console.log("ProfileScreen - Number of businesses to fetch:", businesses.length);
      // console.log("ProfileScreen - fetchBusinessesData called with businesses:", JSON.stringify(businesses, null, 2));

      const businessPromises = businesses.map(async (bus, index) => {
        // console.log("ProfileScreen - Processing business:", bus);
        if (!bus.profile_business_uid) {
          console.log("ProfileScreen - Skipping business - no profile_business_uid:", bus);
          return null;
        }

        try {
          const businessEndpoint = `${BUSINESS_INFO_ENDPOINT}/${bus.profile_business_uid}`;
          // console.log("ProfileScreen - Fetching business from:", businessEndpoint);
          const response = await fetch(businessEndpoint);
          const result = await response.json();
          // console.log("ProfileScreen - Business API response for", bus.profile_business_uid, ":", JSON.stringify(result, null, 2));

          if (!result || !result.business) {
            console.log("ProfileScreen - No business data in response for", bus.profile_business_uid);
            return null;
          }

          const rawBusiness = result.business;

          let businessImages = [];
          if (rawBusiness.business_google_photos) {
            if (typeof rawBusiness.business_google_photos === "string") {
              try {
                businessImages = JSON.parse(rawBusiness.business_google_photos);
              } catch (e) {
                businessImages = [rawBusiness.business_google_photos];
              }
            } else if (Array.isArray(rawBusiness.business_google_photos)) {
              businessImages = rawBusiness.business_google_photos;
            }
          }

          if (rawBusiness.business_images_url) {
            let uploadedImages = [];
            if (typeof rawBusiness.business_images_url === "string") {
              try {
                uploadedImages = JSON.parse(rawBusiness.business_images_url);
              } catch (e) {
                uploadedImages = [];
              }
            } else if (Array.isArray(rawBusiness.business_images_url)) {
              uploadedImages = rawBusiness.business_images_url;
            }
            uploadedImages = uploadedImages
              .map((img) => {
                if (img && typeof img === "string") {
                  if (img.startsWith("http://") || img.startsWith("https://")) {
                    return img;
                  }
                  return `https://s3-us-west-1.amazonaws.com/every-circle/business_personal/${rawBusiness.business_uid}/${img}`;
                }
                return null;
              })
              .filter(Boolean);
            businessImages = [...uploadedImages, ...businessImages];
          }

          // Get role and approval status from the original business_info entry
          const originalBusiness = businesses.find((b) => b.profile_business_uid === bus.profile_business_uid);
          // console.log("ProfileScreen - originalBusiness for", rawBusiness.business_name, ":", JSON.stringify(originalBusiness, null, 2));

          // Profile image from business_profile_img; fallback to first of business_images_url for MiniCard
          const businessProfileImg = rawBusiness.business_profile_img && String(rawBusiness.business_profile_img).trim() !== "" ? String(rawBusiness.business_profile_img).trim() : null;
          const firstImage = businessProfileImg || (businessImages && businessImages.length > 0 ? businessImages[0] : null);
          const imageIsPublic =
            rawBusiness.business_profile_img_is_public === "1" ||
            rawBusiness.business_profile_img_is_public === 1 ||
            rawBusiness.business_image_is_public === "1" ||
            rawBusiness.business_image_is_public === 1 ||
            rawBusiness.image_is_public === "1" ||
            rawBusiness.image_is_public === 1;
          // console.log("ProfileScreen - Business image data for", rawBusiness.business_name, ":", {
          //   businessProfileImg: !!businessProfileImg,
          //   businessImagesLength: businessImages?.length || 0,
          //   firstImage: !!firstImage,
          //   imageIsPublic,
          // });
          return {
            business_name: sanitizeText(rawBusiness.business_name, ""),
            tagline: sanitizeText(rawBusiness.business_tag_line || rawBusiness.tagline || "", ""),
            business_address_line_1: sanitizeText(rawBusiness.business_address_line_1, ""),
            business_city: sanitizeText(rawBusiness.business_city || "", ""),
            business_state: sanitizeText(rawBusiness.business_state || "", ""),
            business_zip_code: sanitizeText(rawBusiness.business_zip_code, ""),
            business_phone_number: sanitizeText(rawBusiness.business_phone_number, ""),
            business_email: sanitizeText(rawBusiness.business_email_id, ""),
            business_website: sanitizeText(rawBusiness.business_website, ""),
            first_image: firstImage,
            business_profile_img: businessProfileImg,
            imageIsPublic,
            phoneIsPublic:
              rawBusiness.business_phone_number_is_public === "1" || rawBusiness.business_phone_number_is_public === 1 || rawBusiness.phone_is_public === "1" || rawBusiness.phone_is_public === 1,
            emailIsPublic: rawBusiness.business_email_id_is_public === "1" || rawBusiness.business_email_id_is_public === 1 || rawBusiness.email_is_public === "1" || rawBusiness.email_is_public === 1,
            taglineIsPublic:
              rawBusiness.business_tag_line_is_public === "1" || rawBusiness.business_tag_line_is_public === 1 || rawBusiness.tagline_is_public === "1" || rawBusiness.tagline_is_public === 1,
            business_uid: sanitizeText(rawBusiness.business_uid, ""),
            profile_business_uid: bus.profile_business_uid || "",
            role: sanitizeText(originalBusiness?.role, ""),
            isApproved: originalBusiness?.isApproved || false,
            individualIsPublic:
              originalBusiness?.bu_individual_business_is_public === 1 || originalBusiness?.bu_individual_business_is_public === "1" || originalBusiness?.bu_individual_business_is_public === true,
            index: index, // Store original index for BusinessSection to map back to businesses array
          };
        } catch (error) {
          console.error(`Error fetching business ${bus.profile_business_uid}:`, error);
          return null;
        }
      });
      const fetchedBusinesses = await Promise.all(businessPromises);
      // console.log("ProfileScreen - Fetched businesses (before filter):", JSON.stringify(fetchedBusinesses, null, 2));
      const validBusinesses = fetchedBusinesses.filter(Boolean);
      // console.log("ProfileScreen - Valid businesses (after filter):", JSON.stringify(validBusinesses, null, 2));
      // console.log("ProfileScreen - Setting businessesData with", validBusinesses.length, "businesses");
      setBusinessesData(validBusinesses);
    } catch (error) {
      // console.error("ProfileScreen - Error fetching businesses data:", error);
      setBusinessesData([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelationship = async (loggedInProfileUID, viewedProfileUID) => {
    try {
      // console.log("ProfileScreen - Fetching relationship...");
      // console.log("ProfileScreen - Logged in profile UID:", loggedInProfileUID);
      // console.log("ProfileScreen - Viewed profile UID:", viewedProfileUID);

      const endpoint = `${CIRCLES_ENDPOINT}/${loggedInProfileUID}?circle_related_person_id=${viewedProfileUID}`;
      // console.log("ProfileScreen - Relationship endpoint:", endpoint);

      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // console.log("ProfileScreen - Relationship response status:", response.status);
      // console.log("ProfileScreen - Relationship response ok:", response.ok);

      const result = await response.json();
      // console.log("ProfileScreen - ============================================");
      // console.log("ProfileScreen - ENDPOINT RETURN (GET Relationship):");
      // console.log("ProfileScreen - URL:", endpoint);
      // console.log("ProfileScreen - RESPONSE STATUS:", response.status);
      // console.log("ProfileScreen - RESPONSE BODY:", JSON.stringify(result, null, 2));
      // console.log("ProfileScreen - ============================================");

      if (response.ok && result && result.data && result.data.length > 0) {
        // Extract relationship data from the first item in the data array
        const relationshipData = result.data[0];
        const relationship = relationshipData.circle_relationship;
        const uid = relationshipData.circle_uid;

        // Store the full relationship data, relationship type, and circle_uid
        setExistingRelationship(relationshipData);
        setRelationshipType(relationship);
        setCircleUid(uid);

        // console.log("ProfileScreen - Relationship found:", relationshipData);
        // console.log("ProfileScreen - Relationship type extracted:", relationship);
        // console.log("ProfileScreen - Circle UID extracted:", uid);
        // console.log("ProfileScreen - Data passed to ProfileScreen - relationshipType:", relationship);
        // console.log("ProfileScreen - Data passed to ProfileScreen - circleUid:", uid);
      } else {
        // No relationship found or error
        setExistingRelationship(null);
        setRelationshipType(null);
        setCircleUid(null);
        // console.log("ProfileScreen - No relationship found or error");
        // console.log("ProfileScreen - Data passed to ProfileScreen - relationshipType: null");
        // console.log("ProfileScreen - Data passed to ProfileScreen - circleUid: null");
      }
    } catch (error) {
      console.error("ProfileScreen - Error fetching relationship:", error);
      setExistingRelationship(null);
      setRelationshipType(null);
      setCircleUid(null);
      // console.log("ProfileScreen - Data passed to ProfileScreen - relationshipType: null (error)");
      // console.log("ProfileScreen - Data passed to ProfileScreen - circleUid: null (error)");
    }
  };

  const renderField = (label, value, isPublic) => {
    if (isPublic && value && value.trim() !== "") {
      return (
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>{label}:</Text>
          <Text style={styles.plainText}>{value}</Text>
        </View>
      );
    }
    return null;
  };

  // Format date from YYYY-MM-DD to readable format
  const formatCircleDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateString; // Return original if parsing fails
    }
  };

  // Format geotag from "latitude,longitude" to "Latitude: X, Longitude: Y"
  const formatCircleGeotag = (geotag) => {
    if (!geotag) return null;
    try {
      const [lat, lon] = geotag.split(",");
      if (lat && lon) {
        return `Latitude: ${parseFloat(lat).toFixed(6)}, Longitude: ${parseFloat(lon).toFixed(6)}`;
      }
    } catch (error) {
      console.error("Error formatting geotag:", error);
    }
    return null;
  };

  const handleRelationshipSelect = async (relationship) => {
    // console.log("============================================");
    // console.log("ProfileScreen - handleRelationshipSelect CALLED");
    // console.log("ProfileScreen - Selected relationship:", relationship);
    // console.log("ProfileScreen - Current relationshipType:", relationshipType);
    // console.log("ProfileScreen - Current circleUid:", circleUid);
    // console.log("============================================");

    try {
      // Close dropdown immediately for better UX
      setShowRelationshipDropdown(false);

      // Check if the relationship has changed (handle null comparison)
      const currentRel = relationshipType === null || relationshipType === "null" ? null : relationshipType;
      const newRel = relationship === null || relationship === "null" ? null : relationship;
      if (currentRel === newRel) {
        console.log("ProfileScreen - Relationship unchanged, no update needed");
        return;
      }

      // Get the current logged-in user's profile_uid
      const loggedInProfileUID = await AsyncStorage.getItem("profile_uid");
      // console.log("ProfileScreen - loggedInProfileUID:", loggedInProfileUID);
      if (!loggedInProfileUID) {
        console.error("ProfileScreen - ERROR: User profile not found");
        Alert.alert("Error", "User profile not found. Please try again.");
        return;
      }

      // Get the profile_uid of the user being viewed
      const viewedProfileUID = routeProfileUID || profileUID;
      // console.log("ProfileScreen - viewedProfileUID:", viewedProfileUID);
      // console.log("ProfileScreen - routeProfileUID:", routeProfileUID);
      // console.log("ProfileScreen - profileUID:", profileUID);
      if (!viewedProfileUID) {
        console.error("ProfileScreen - ERROR: Profile information not found");
        Alert.alert("Error", "Profile information not found.");
        return;
      }

      // If a relationship already exists (circleUid exists), DELETE or PUT depending on selection
      if (circleUid) {
        const circleEndpoint = `${CIRCLES_ENDPOINT}/${circleUid}`;

        if (relationship === null) {
          // "Select None" — remove the connection entirely
          // console.log("ProfileScreen - ============================================");
          // console.log("ProfileScreen - MAKING API CALL: CIRCLES (DELETE — remove connection)");
          // console.log("ProfileScreen - URL:", circleEndpoint);
          // console.log("ProfileScreen - METHOD: DELETE");
          // console.log("ProfileScreen - circleUid:", circleUid);
          // console.log("ProfileScreen - ============================================");

          const response = await fetch(circleEndpoint, { method: "DELETE" });

          // console.log("ProfileScreen - DELETE RESPONSE STATUS:", response.status);
          const result = await response.json();
          // console.log("ProfileScreen - DELETE RESPONSE BODY:", JSON.stringify(result, null, 2));

          if (!response.ok) {
            throw new Error(result.message || "Failed to remove connection");
          }

          // Clear both relationship and circleUid — the row no longer exists
          setRelationshipType(null);
          setCircleUid(null);
          Alert.alert("Success", "Connection removed");
          return; // skip the refresh below — there is no circle row to re-fetch
        }

        // Changing to a different relationship label — use PUT
        const updateRequestBody = { circle_relationship: relationship };

        // console.log("ProfileScreen - ============================================");
        // console.log("ProfileScreen - MAKING API CALL: CIRCLES (UPDATE)");
        // console.log("ProfileScreen - URL:", circleEndpoint);
        // console.log("ProfileScreen - METHOD: PUT");
        // console.log("ProfileScreen - REQUEST BODY:", JSON.stringify(updateRequestBody, null, 2));
        // console.log("ProfileScreen - ============================================");

        const response = await fetch(circleEndpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateRequestBody),
        });

        // console.log("ProfileScreen - UPDATE RESPONSE STATUS:", response.status);
        const result = await response.json();
        // console.log("ProfileScreen - UPDATE RESPONSE BODY:", JSON.stringify(result, null, 2));

        if (!response.ok) {
          throw new Error(result.message || "Failed to update relationship");
        }

        setRelationshipType(relationship);
        Alert.alert("Success", `Relationship updated to ${relationship.charAt(0).toUpperCase() + relationship.slice(1)}!`);
      } else if (relationship !== null) {
        // No existing relationship, create new one with POST
        // Format current date (YYYY-MM-DD)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const circleDate = `${year}-${month}-${day}`;

        // Prepare request body
        const requestBody = {
          circle_profile_id: loggedInProfileUID,
          circle_related_person_id: viewedProfileUID,
          circle_relationship: relationship,
          circle_date: circleDate,
        };

        // console.log("ProfileScreen - ============================================");
        // console.log("ProfileScreen - MAKING API CALL: CIRCLES (CREATE)");
        // console.log("ProfileScreen - URL:", CIRCLES_ENDPOINT);
        // console.log("ProfileScreen - METHOD: POST");
        // console.log("ProfileScreen - REQUEST BODY:", JSON.stringify(requestBody, null, 2));
        // console.log("ProfileScreen - loggedInProfileUID:", loggedInProfileUID);
        // console.log("ProfileScreen - viewedProfileUID:", viewedProfileUID);
        // console.log("ProfileScreen - ============================================");

        // Make the API call
        const response = await fetch(CIRCLES_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        // console.log("ProfileScreen - API CALL COMPLETED");
        // console.log("ProfileScreen - Response status:", response.status);

        // console.log("ProfileScreen - CREATE RESPONSE STATUS:", response.status);
        // console.log("ProfileScreen - CREATE RESPONSE OK:", response.ok);

        const result = await response.json();
        // console.log("ProfileScreen - CREATE RESPONSE BODY:", JSON.stringify(result, null, 2));

        if (!response.ok) {
          throw new Error(result.message || "Failed to save relationship");
        }

        // console.log("ProfileScreen - Relationship saved successfully");
        // Update state immediately for better UX
        setRelationshipType(relationship);
        if (result && result.data && result.data.circle_uid) {
          setCircleUid(result.data.circle_uid);
        } else if (result && result.circle_uid) {
          setCircleUid(result.circle_uid);
        }
        Alert.alert("Success", `Relationship saved as ${relationship.charAt(0).toUpperCase() + relationship.slice(1)}!`);
      } else {
        // relationship is null and no circleUid exists - nothing to do
        // console.log("ProfileScreen - No relationship selected and no existing circle, nothing to do");
        setRelationshipType(null);
      }

      // Refresh the relationship data to ensure consistency
      if (loggedInProfileUID && viewedProfileUID) {
        await fetchRelationship(loggedInProfileUID, viewedProfileUID);
        // console.log("ProfileScreen - Relationship refreshed after save/update");
        // console.log("ProfileScreen - Updated relationshipType:", relationshipType);
        // console.log("ProfileScreen - Updated circleUid:", circleUid);
      }
    } catch (error) {
      console.error("ProfileScreen - ============================================");
      console.error("ProfileScreen - ERROR in handleRelationshipSelect");
      console.error("ProfileScreen - Error message:", error.message);
      console.error("ProfileScreen - Error stack:", error.stack);
      console.error("ProfileScreen - Full error:", error);
      console.error("ProfileScreen - ============================================");
      Alert.alert("Error", error.message || "Failed to save relationship. Please try again.");
    }
  };

  const handleConnectPopupSave = async (connectionData) => {
    try {
      setShowConnectPopup(false);

      const loggedInProfileUID = await AsyncStorage.getItem("profile_uid");
      if (!loggedInProfileUID) {
        Alert.alert("Error", "User profile not found. Please try again.");
        return;
      }

      const viewedProfileUID = routeProfileUID || profileUID;
      if (!viewedProfileUID) {
        Alert.alert("Error", "Profile information not found.");
        return;
      }

      const selectedRelationship = connectionData?.relationship !== undefined ? connectionData.relationship : null;
      const payload = {
        circle_relationship: selectedRelationship,
        circle_event: connectionData?.event?.trim() || null,
        circle_note: connectionData?.note?.trim() || null,
        circle_city: connectionData?.city?.trim() || null,
        circle_state: connectionData?.state?.trim() || null,
        circle_introduced_by: connectionData?.introducedBy?.trim() || null,
      };

      if (circleUid) {
        const response = await fetch(`${CIRCLES_ENDPOINT}/${circleUid}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || "Failed to update connection");
        }
      } else {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const circleDate = `${year}-${month}-${day}`;

        // Calculate circle_num_nodes
        let circleNumNodes = null;
        try {
          const pathResponse = await fetch(`${API_BASE_URL}/api/connections_path/${loggedInProfileUID}/${viewedProfileUID}`);
          if (pathResponse.ok) {
            const pathData = await pathResponse.json();
            const combinedPath = pathData.combined_path || "";
            if (combinedPath) {
              const nodes = combinedPath.split(",").filter((n) => n.trim());
              circleNumNodes = Math.max(0, nodes.length - 2) + 1;
            }
          }
        } catch (err) {
          console.warn("Could not fetch connections_path:", err);
        }

        const requestBody = {
          circle_profile_id: loggedInProfileUID,
          circle_related_person_id: viewedProfileUID,
          circle_date: circleDate,
          ...payload,
          ...(circleNumNodes !== null && { circle_num_nodes: circleNumNodes }),
        };

        const response = await fetch(CIRCLES_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || "Failed to save connection");
        }
        if (result?.data?.circle_uid) {
          setCircleUid(result.data.circle_uid);
        } else if (result?.circle_uid) {
          setCircleUid(result.circle_uid);
        }
      }

      setRelationshipType(selectedRelationship);
      await fetchRelationship(loggedInProfileUID, viewedProfileUID);
      Alert.alert("Success", "Connection details saved.");
    } catch (error) {
      console.error("ProfileScreen - Error saving connection from popup:", error);
      Alert.alert("Error", error.message || "Failed to save connection details. Please try again.");
    }
  };

  if (loading) {
    return (
      <View style={[styles.pageContainer, darkMode && styles.darkPageContainer, { flex: 1, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size='large' color={darkMode ? "#ffffff" : "#007BFF"} style={{ marginTop: 50 }} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.pageContainer, darkMode && styles.darkPageContainer, { flex: 1, justifyContent: "center", alignItems: "center" }]}>
        <Text style={[styles.errorText, darkMode && styles.darkErrorText]}>No user data available. Please try again.</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Home")}
          style={{
            backgroundColor: "#007AFF",
            padding: 12,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "bold" }}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isWeb = Platform.OS === "web";

  return (
    <View style={[styles.pageContainer, darkMode && styles.darkPageContainer]}>
      {/* Close dropdown when clicking outside */}
      {showRelationshipDropdown && !isWeb && (
        <TouchableWithoutFeedback onPress={() => setShowRelationshipDropdown(false)}>
          <View style={styles.dropdownOverlay} />
        </TouchableWithoutFeedback>
      )}
      {/* Header */}
      <AppHeader
        title={isCurrentUserProfile ? "YOUR PROFILE" : "PROFILE"}
        {...(routeProfileUID && !isCurrentUserProfile ? getHeaderColors("profileView") : getHeaderColors("profile"))}
        onTitlePress={() => setShowFeedbackPopup(true)}
        onBackPress={
          routeProfileUID && !isCurrentUserProfile
            ? () => {
                // Navigate back to the screen we came from with preserved state
                if (returnTo === "Search" && searchState) {
                  console.log("🔙 Returning to Search with preserved state:", searchState);
                  navigation.navigate("Search", {
                    restoreState: true,
                    searchState: searchState,
                  });
                } else if (returnTo === "ExpertiseDetail" && route.params?.expertiseDetailState) {
                  // Navigate back to ExpertiseDetail screen
                  console.log("🔙 Returning to ExpertiseDetail");
                  const { expertiseData, profileData, profile_uid, searchState, returnTo: detailReturnTo, profileState: detailProfileState } = route.params.expertiseDetailState;
                  navigation.navigate("ExpertiseDetail", {
                    expertiseData,
                    profileData,
                    profile_uid,
                    searchState,
                    returnTo: detailReturnTo,
                    profileState: detailProfileState,
                  });
                } else if (returnTo === "WishDetail" && route.params?.wishDetailState) {
                  // Navigate back to WishDetail screen
                  console.log("🔙 Returning to WishDetail");
                  const { wishData, profileData, profile_uid, searchState, returnTo: detailReturnTo, profileState: detailProfileState } = route.params.wishDetailState;
                  navigation.navigate("WishDetail", {
                    wishData,
                    profileData,
                    profile_uid,
                    searchState,
                    returnTo: detailReturnTo,
                    profileState: detailProfileState,
                  });
                } else if (returnTo === "WishResponses" && route.params?.wishResponsesState) {
                  // Navigate back to WishResponses screen
                  console.log("🔙 Returning to WishResponses");
                  const { wishData, profileData, profile_uid, profileState: wishResponsesProfileState } = route.params.wishResponsesState;
                  navigation.navigate("WishResponses", {
                    wishData,
                    profileData,
                    profile_uid,
                    profileState: wishResponsesProfileState,
                  });
                } else if (returnTo === "Network") {
                  // Navigate back to Network screen
                  console.log("🔙 Returning to Network");
                  navigation.navigate("Network");
                } else {
                  // Default: Navigate to Network screen when viewing another user's profile
                  navigation.navigate("Network");
                }
              }
            : undefined
        }
        rightButton={
          isCurrentUserProfile ? (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() =>
                navigation.navigate("EditProfile", {
                  user: user,
                  profile_uid: profileUID,
                  businessesData: businessesData, // Pass pre-fetched business data to avoid redundant API calls
                })
              }
            >
              <Image source={require("../assets/Edit.png")} style={[styles.editIcon, darkMode && styles.darkEditIcon]} tintColor={darkMode ? "#fff" : "#fff"} />
            </TouchableOpacity>
          ) : routeProfileUID && !isCurrentUserProfile ? (
            <View style={styles.dropdownWrapper} pointerEvents='box-none'>
              <Pressable
                style={styles.addButton}
                {...(isWeb && { "data-dropdown-button": true })}
                onPress={(e) => {
                  console.log("Dropdown button clicked for profile:", profileUID);
                  // Stop event propagation to prevent parent TouchableOpacity from handling it
                  if (e?.stopPropagation) {
                    e.stopPropagation();
                  }
                  if (Platform.OS === "web" && e?.nativeEvent) {
                    e.nativeEvent.stopPropagation?.();
                  }
                  setShowRelationshipDropdown(false);
                  setShowConnectPopup(true);
                }}
                onPressIn={(e) => {
                  // Also stop propagation on press in to prevent parent from capturing
                  if (e?.stopPropagation) {
                    e.stopPropagation();
                  }
                }}
                onStartShouldSetResponder={() => true}
                onResponderTerminationRequest={() => false}
              >
                <Ionicons name='add' size={28} color='#fff' />
              </Pressable>
              {showRelationshipDropdown &&
                (() => {
                  const headerColors = getHeaderColors("profileView");
                  const highlightColor = darkMode ? headerColors.darkModeBackgroundColor : headerColors.backgroundColor;
                  const isHighlighted = (rel) => {
                    if (rel === null) return relationshipType == null || relationshipType === "null" || !relationshipType;
                    return relationshipType === rel;
                  };
                  return (
                    <View style={[styles.dropdownMenu, darkMode && styles.darkDropdownMenu]} {...(isWeb && { "data-dropdown-menu": true })}>
                      <Pressable
                        style={styles.dropdownItem}
                        onPress={(e) => {
                          if (Platform.OS === "web" && e?.nativeEvent) e.nativeEvent.stopPropagation?.();
                          handleRelationshipSelect("friend");
                        }}
                      >
                        <Text style={[styles.dropdownItemText, darkMode && styles.darkDropdownItemText, isHighlighted("friend") && { color: highlightColor, fontWeight: "bold" }]}>Friend</Text>
                      </Pressable>
                      <View style={[styles.dropdownDivider, darkMode && styles.darkDropdownDivider]} />
                      <Pressable
                        style={styles.dropdownItem}
                        onPress={(e) => {
                          if (Platform.OS === "web" && e?.nativeEvent) e.nativeEvent.stopPropagation?.();
                          handleRelationshipSelect("colleague");
                        }}
                      >
                        <Text style={[styles.dropdownItemText, darkMode && styles.darkDropdownItemText, isHighlighted("colleague") && { color: highlightColor, fontWeight: "bold" }]}>Colleague</Text>
                      </Pressable>
                      <View style={[styles.dropdownDivider, darkMode && styles.darkDropdownDivider]} />
                      <Pressable
                        style={styles.dropdownItem}
                        onPress={(e) => {
                          if (Platform.OS === "web" && e?.nativeEvent) e.nativeEvent.stopPropagation?.();
                          handleRelationshipSelect("family");
                        }}
                      >
                        <Text style={[styles.dropdownItemText, darkMode && styles.darkDropdownItemText, isHighlighted("family") && { color: highlightColor, fontWeight: "bold" }]}>Family</Text>
                      </Pressable>
                      <View style={[styles.dropdownDivider, darkMode && styles.darkDropdownDivider]} />
                      <Pressable
                        style={styles.dropdownItem}
                        onPress={(e) => {
                          if (Platform.OS === "web" && e?.nativeEvent) e.nativeEvent.stopPropagation?.();
                          handleRelationshipSelect(null);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, darkMode && styles.darkDropdownItemText, isHighlighted(null) && { color: highlightColor, fontWeight: "bold" }]}>Select None</Text>
                      </Pressable>
                    </View>
                  );
                })()}
            </View>
          ) : null
        }
      />

      <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
        <ScrollView
          style={[styles.scrollContainer, darkMode && styles.darkScrollContainer]}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          {...(Platform.OS === "web" && {
            style: [styles.scrollContainer, darkMode && styles.darkScrollContainer, { zIndex: 1 }],
          })}
        >
          {/* <View style={[styles.cardContainer, darkMode && styles.darkCardContainer]}>
            <View style={styles.profileHeaderContainer}>
              <Image
                source={
                  user.profileImage && (isCurrentUserProfile || user.imageIsPublic) && user.profileImage !== "" && String(user.profileImage).trim() !== ""
                    ? { uri: String(user.profileImage) }
                    : require("../assets/profile.png")
                }
                style={styles.profileImage}
                onError={(error) => {
                  console.log("ProfileScreen image failed to load:", error.nativeEvent.error);
                  console.log("Problematic profile image URI:", user.profileImage);
                }}
                defaultSource={require("../assets/profile.png")}
              />
              <Text style={[styles.nameText, darkMode && styles.darkNameText]}>
                {user.firstName} {user.lastName}
              </Text>
              <Text style={[styles.profileId, darkMode && styles.darkProfileId]}>Profile ID: {profileUID}</Text>
            </View>
            {(() => {
              // Only show relationship when viewing another user's profile
              if (routeProfileUID && !isCurrentUserProfile) {
                const relType = relationshipType ? String(relationshipType).trim() : "";
                if (relType && relType !== "." && relType !== "null") {
                  return <Text style={[styles.relationshipText, darkMode && styles.darkRelationshipText]}>Relationship: {relType.charAt(0).toUpperCase() + relType.slice(1)}</Text>;
                } else {
                  return <Text style={[styles.relationshipText, darkMode && styles.darkRelationshipText]}>Relationship: Relationship not Assigned</Text>;
                }
              }
              return null;
            })()}
            {(() => {
              // Display circle details when viewing another user's profile and relationship exists
              if (routeProfileUID && !isCurrentUserProfile && existingRelationship) {
                const circleDetails = [];

                // Format and add date if available
                const formattedDate = formatCircleDate(existingRelationship.circle_date);
                if (formattedDate) {
                  circleDetails.push(
                    <Text key='date' style={[styles.relationshipText, darkMode && styles.darkRelationshipText]}>
                      Date: {formattedDate}
                    </Text>
                  );
                }

                // Add event if available
                if (existingRelationship.circle_event) {
                  circleDetails.push(
                    <Text key='event' style={[styles.relationshipText, darkMode && styles.darkRelationshipText]}>
                      Event: {existingRelationship.circle_event}
                    </Text>
                  );
                }

                // Add note if available
                if (existingRelationship.circle_note) {
                  circleDetails.push(
                    <Text key='note' style={[styles.relationshipText, darkMode && styles.darkRelationshipText]}>
                      Note: {existingRelationship.circle_note}
                    </Text>
                  );
                }

                // Format and add geotag if available
                const formattedGeotag = formatCircleGeotag(existingRelationship.circle_geotag);
                if (formattedGeotag) {
                  circleDetails.push(
                    <Text key='geotag' style={[styles.relationshipText, darkMode && styles.darkRelationshipText]}>
                      Location: {formattedGeotag}
                    </Text>
                  );
                }

                // Add introduced_by if available
                if (existingRelationship.circle_introduced_by) {
                  circleDetails.push(
                    <Text key='introduced_by' style={[styles.relationshipText, darkMode && styles.darkRelationshipText]}>
                      Introduced By: {existingRelationship.circle_introduced_by}
                    </Text>
                  );
                }

                // Return View with all circle details if any exist
                if (circleDetails.length > 0) {
                  return <View>{circleDetails}</View>;
                }
              }
              return null;
            })()}
            {(() => {
              // Tagline hidden per user request
              return null;
              // const tagLine = user.tagLine && (isCurrentUserProfile || user.tagLineIsPublic) ? sanitizeText(user.tagLine) : "";
              // return tagLine ? <Text style={[styles.tagline, darkMode && styles.darkTagline]}>{tagLine}</Text> : null;
            })()}
            {(() => {
              // City and State hidden per user request
              return null;
              // const location = user.city && user.state && (isCurrentUserProfile || user.locationIsPublic) ? `${sanitizeText(user.city)}, ${sanitizeText(user.state)}` : "";
              // return location ? <Text style={[styles.tagline, darkMode && styles.darkTagline]}>{location}</Text> : null;
            })()}
            {(() => {
              // ShortBio moved below MiniCard
              return null;
            })()}
            {(() => {
              // Phone number hidden per user request
              return null;
              // const phoneNumber = user.phoneNumber && (isCurrentUserProfile || user.phoneIsPublic) ? sanitizeText(user.phoneNumber) : "";
              // const formattedPhone = phoneNumber ? formatPhoneNumberForDisplay(phoneNumber) : "";
              // return formattedPhone ? <Text style={[styles.contact, darkMode && styles.darkContact]}>{formattedPhone}</Text> : null;
            })()}
            {(() => {
              // Email hidden per user request
              return null;
              // const email = user.email && (isCurrentUserProfile || user.emailIsPublic) ? sanitizeText(user.email) : "";
              // return email ? <Text style={[styles.contact, darkMode && styles.darkContact]}>{email}</Text> : null;
            })()}
          </View> */}

          {/* Large profile pic at top - circular, no gray background */}
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <View style={{ width: 200, height: 200, borderRadius: 100, overflow: "hidden" }}>
              <Image
                source={
                  user.profileImage && (isCurrentUserProfile || user.imageIsPublic) && String(user.profileImage).trim() !== "" ? { uri: String(user.profileImage) } : require("../assets/profile.png")
                }
                style={{ width: 200, height: 200 }}
                resizeMode='cover'
                defaultSource={require("../assets/profile.png")}
              />
            </View>
          </View>

          <MiniCard
            user={{
              ...user,
              imageIsPublic: user.imageIsPublic,
              profileImage: isCurrentUserProfile || user.imageIsPublic ? user.profileImage : "",
            }}
          />

          {/* Message button — only when viewing someone else's profile */}
          {routeProfileUID && !isCurrentUserProfile && (
            <TouchableOpacity
              style={styles.chatButton}
              activeOpacity={0.8}
              onPress={() =>
                navigation.navigate("Chat", {
                  other_uid: profileUID,
                  other_name: `${user.firstName} ${user.lastName}`.trim() || "Chat",
                  other_image: user.profileImage && user.imageIsPublic ? user.profileImage : null,
                })
              }
            >
              <Ionicons name='chatbubble-ellipses-outline' size={17} color='#fff' style={{ marginRight: 7 }} />
              <Text style={styles.chatButtonText}>Message</Text>
            </TouchableOpacity>
          )}

          {/* Bio section */}
          {user.shortBioIsPublic && (
            <View style={[styles.fieldContainer, { borderWidth: 1, borderColor: "#000", borderRadius: 8 }]}>
              <Text style={[styles.label, darkMode && styles.darkLabel]}>Bio:</Text>
              {user.shortBio && user.shortBio.trim() !== "" ? (
                <View style={[styles.inputContainer, darkMode && styles.darkInputContainer]}>
                  <Text style={[styles.inputText, darkMode && styles.darkInputText]}>{sanitizeText(user.shortBio)}</Text>
                </View>
              ) : (
                <Text style={[styles.inputText, darkMode && styles.darkInputText, styles.emptySectionPlaceholder, { fontStyle: "italic", color: darkMode ? "#999" : "#666" }]}>No bio added yet</Text>
              )}
            </View>
          )}

          {/* Only show Expertise section if there are public expertise entries, or if viewing own profile */}
          {/*{(isCurrentUserProfile || (user.expertise && user.expertise.filter((exp) => exp.isPublic).length > 0)) && ( */}
          {user.expertiseIsPublic && (
            <View style={styles.fieldContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowOffering(!showOffering)}>
                <Text style={styles.sectionHeaderText}>OFFERING</Text>
                <Ionicons name={showOffering ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showOffering &&
                (user.expertise && user.expertise.filter((exp) => exp.isPublic).length > 0 ? (
                  user.expertise
                    .filter((exp) => exp.isPublic)
                    .map((exp, index) => {
                      const expImageUri = resolveProfileItemImageUri(exp.profile_expertise_image, profileUID);
                      // Same rule as detail screens: explicit 0/"0"/false hides; 1, "1", true, or undefined (legacy) shows.
                      const expertiseImageIsHidden =
                        exp.profile_expertise_image_is_public === 0 ||
                        exp.profile_expertise_image_is_public === "0" ||
                        exp.profile_expertise_image_is_public === false;
                      const showExpImage =
                        exp.profile_expertise_image &&
                        String(exp.profile_expertise_image).trim() !== "" &&
                        !expertiseImageIsHidden;
                      const expertiseItem = (
                        <View key={index} style={[styles.sectionItemContainer, darkMode && styles.darkSectionItemContainer, index > 0 && { marginTop: 4 }]}>
                          <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 8, gap: 10 }}>
                            {showExpImage ? (
                              <Image
                                source={{ uri: expImageUri }}
                                style={{
                                  width: 56,
                                  height: 56,
                                  borderRadius: 8,
                                  backgroundColor: darkMode ? "#333" : "#eee",
                                }}
                              />
                            ) : null}
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                                {sanitizeText(exp.name) ? (
                                  <Text style={[styles.inputText, darkMode && styles.darkInputText, { fontWeight: "500" }]}>{sanitizeText(exp.name)}</Text>
                                ) : null}
                              </View>
                              {sanitizeText(exp.description) ? (
                                <Text style={[styles.inputText, darkMode && styles.darkInputText, { marginLeft: 0, color: "#666" }]}>
                                  {sanitizeText(exp.description)}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginLeft: 0 }}>
                            {exp.cost ? (
                              <View style={{ flexDirection: "row", alignItems: "center" }}>
                                <View style={styles.moneyBagIconContainer}>
                                  <Text style={styles.moneyBagDollarSymbol}>$</Text>
                                </View>
                                <Text style={[styles.inputText, darkMode && styles.darkInputText]}>
                                  {exp.cost.toLowerCase() !== "free" ? `Cost: $${exp.cost.replace(/^\$/, "")}` : `Cost: ${exp.cost}`}
                                </Text>
                              </View>
                            ) : null}
                            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "flex-end", flexWrap: "wrap", gap: 8 }}>
                              {exp.quantity ? (
                                <Text style={[styles.inputText, darkMode && styles.darkInputText]}>Qty: {String(exp.quantity).trim()}</Text>
                              ) : null}
                              {exp.bounty ? (
                                <Text style={[styles.inputText, { textAlign: "right", minWidth: 60 }, darkMode && styles.darkInputText]}>
                                  {exp.bounty.toLowerCase() !== "free" ? `💰 $${exp.bounty.replace(/^\$/, "")}` : `💰 ${exp.bounty}`}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                          {exp.profile_expertise_start || exp.profile_expertise_end || exp.profile_expertise_location || exp.profile_expertise_mode ? (
                            <View style={[styles.seekingMetaRow, { marginTop: 6 }]}>
                              {exp.profile_expertise_start || exp.profile_expertise_end ? (
                                <View style={styles.seekingMetaLine}>
                                  <Ionicons name='calendar-outline' size={14} color={darkMode ? "#999" : "#666"} style={{ marginRight: 6 }} />
                                  <Text style={[styles.inputText, styles.seekingMetaText, darkMode && styles.darkSeekingMetaText]}>
                                    {exp.profile_expertise_start ? formatDateTimeForDisplay(exp.profile_expertise_start) : "—"}
                                    {exp.profile_expertise_start && exp.profile_expertise_end ? " → " : ""}
                                    {exp.profile_expertise_end ? formatDateTimeForDisplay(exp.profile_expertise_end) : ""}
                                  </Text>
                                </View>
                              ) : null}
                              {exp.profile_expertise_location || exp.profile_expertise_mode ? (
                                <View style={[styles.seekingMetaLine, styles.seekingMetaLineSpaceBetween, (exp.profile_expertise_start || exp.profile_expertise_end) && { marginTop: 4 }]}>
                                  {exp.profile_expertise_location ? (
                                    <View style={styles.seekingMetaLine}>
                                      <Ionicons name='location-outline' size={14} color={darkMode ? "#999" : "#666"} style={{ marginRight: 6 }} />
                                      <Text style={[styles.inputText, styles.seekingMetaText, darkMode && styles.darkSeekingMetaText]}>{exp.profile_expertise_location}</Text>
                                    </View>
                                  ) : (
                                    <View style={styles.seekingMetaSpacer} />
                                  )}
                                  {exp.profile_expertise_mode ? (
                                    <View style={styles.seekingMetaLine}>
                                      <Ionicons
                                        name={String(exp.profile_expertise_mode).toLowerCase() === "virtual" ? "videocam-outline" : "people-outline"}
                                        size={14}
                                        color={darkMode ? "#999" : "#666"}
                                        style={{ marginRight: 6 }}
                                      />
                                      <Text style={[styles.inputText, styles.seekingMetaText, darkMode && styles.darkSeekingMetaText]}>{exp.profile_expertise_mode}</Text>
                                    </View>
                                  ) : null}
                                </View>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      );
                      if (routeProfileUID && !isCurrentUserProfile) {
                        return (
                          <TouchableOpacity
                            key={index}
                            activeOpacity={0.7}
                            onPress={() => {
                              const expertiseData = {
                                expertise_uid: exp.profile_expertise_uid,
                                title: exp.name,
                                description: exp.description,
                                quantity: exp.quantity,
                                cost: exp.cost,
                                bounty: exp.bounty,
                                profile_expertise_start: exp.profile_expertise_start,
                                profile_expertise_end: exp.profile_expertise_end,
                                profile_expertise_location: exp.profile_expertise_location,
                                profile_expertise_mode: exp.profile_expertise_mode,
                                profile_expertise_image: exp.profile_expertise_image,
                                profile_expertise_image_is_public: exp.profile_expertise_image_is_public,
                              };
                              const profileData = {
                                firstName: user.firstName,
                                lastName: user.lastName,
                                email: user.email,
                                phone: user.phoneNumber,
                                image: user.profileImage,
                                tagLine: user.tagLine,
                                city: user.city,
                                state: user.state,
                                emailIsPublic: user.emailIsPublic,
                                phoneIsPublic: user.phoneIsPublic,
                                imageIsPublic: user.imageIsPublic,
                                tagLineIsPublic: user.tagLineIsPublic,
                                locationIsPublic: user.locationIsPublic,
                              };
                              navigation.navigate("ExpertiseDetail", {
                                expertiseData,
                                profileData,
                                profile_uid: profileUID,
                                returnTo: "Profile",
                                profileState: { profile_uid: profileUID, returnTo, searchState },
                              });
                            }}
                          >
                            {expertiseItem}
                          </TouchableOpacity>
                        );
                      }
                      return expertiseItem;
                    })
                ) : (
                  <Text style={[styles.inputText, darkMode && styles.darkInputText, styles.emptySectionPlaceholder, { fontStyle: "italic", color: "#666" }]}>No expertise added yet</Text>
                ))}
            </View>
          )}

          {/* Only show Seeking section if there are public wishes, or if viewing own profile */}
          {/*{(isCurrentUserProfile || (user.wishes && user.wishes.filter((wish) => wish.isPublic).length > 0)) && ( */}
          {user.wishesIsPublic && (
            <View style={styles.fieldContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowSeeking(!showSeeking)}>
                <Text style={styles.sectionHeaderText}>SEEKING</Text>
                <Ionicons name={showSeeking ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showSeeking &&
                (user.wishes && user.wishes.filter((wish) => wish.isPublic && !isWishEnded(wish)).length > 0 ? (
                  user.wishes
                    .filter((wish) => wish.isPublic && !isWishEnded(wish))
                    .map((wish, index) => {
                      const wishImageUri = resolveProfileItemImageUri(wish.profile_wish_image, profileUID);
                      const wishImageIsHidden =
                        wish.profile_wish_image_is_public === 0 ||
                        wish.profile_wish_image_is_public === "0" ||
                        wish.profile_wish_image_is_public === false;
                      const showWishImage =
                        wish.profile_wish_image &&
                        String(wish.profile_wish_image).trim() !== "" &&
                        !wishImageIsHidden;
                      const wishItem = (
                        <View key={index} style={[styles.sectionItemContainer, darkMode && styles.darkSectionItemContainer, index > 0 && { marginTop: 4 }]}>
                          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 2 }}>
                            {showWishImage ? (
                              <Image
                                source={{ uri: wishImageUri }}
                                style={{
                                  width: 56,
                                  height: 56,
                                  borderRadius: 8,
                                  backgroundColor: darkMode ? "#333" : "#eee",
                                }}
                              />
                            ) : null}
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                                <Text style={[styles.inputText, darkMode && styles.darkInputText, { fontWeight: "500", flex: 1 }]}>{wish.helpNeeds || ""}</Text>
                                {isCurrentUserProfile && wish.wish_responses !== undefined && wish.wish_responses > 0 && (
                                  <TouchableOpacity
                                    onPress={() => {
                                      const wishDataForNavigation = {
                                        wish_uid: wish.profile_wish_uid,
                                        title: wish.helpNeeds,
                                        description: wish.details,
                                        bounty: wish.amount,
                                        cost: wish.cost,
                                        profile_wish_quantity: wish.profile_wish_quantity,
                                        profile_wish_image: wish.profile_wish_image,
                                        profile_wish_image_is_public: wish.profile_wish_image_is_public,
                                        profile_wish_start: wish.profile_wish_start,
                                        profile_wish_end: wish.profile_wish_end,
                                        profile_wish_location: wish.profile_wish_location,
                                        profile_wish_mode: wish.profile_wish_mode,
                                      };
                                  const profileDataForNavigation = {
                                    firstName: user.firstName,
                                    lastName: user.lastName,
                                    email: user.email,
                                    phone: user.phoneNumber,
                                    image: user.profileImage,
                                    tagLine: user.tagLine,
                                    city: user.city,
                                    state: user.state,
                                    emailIsPublic: user.emailIsPublic,
                                    phoneIsPublic: user.phoneIsPublic,
                                    imageIsPublic: user.imageIsPublic,
                                    tagLineIsPublic: user.tagLineIsPublic,
                                    locationIsPublic: user.locationIsPublic,
                                  };
                                  navigation.navigate("WishResponses", {
                                    wishData: wishDataForNavigation,
                                    profileData: profileDataForNavigation,
                                    profile_uid: profileUID,
                                    profileState: { profile_uid: profileUID, returnTo, searchState },
                                  });
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={[styles.wishResponseLinkText, darkMode && styles.darkWishResponseLinkText]}>Responses: {wish.wish_responses || 0}</Text>
                              </TouchableOpacity>
                            )}
                              </View>
                              {wish.details ? (
                                <Text style={[styles.inputText, darkMode && styles.darkInputText, { marginLeft: 0, color: "#666" }]}>{wish.details}</Text>
                              ) : null}
                            </View>
                          </View>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginLeft: 0 }}>
                            {wish.cost ? (
                              <View style={{ flexDirection: "row", alignItems: "center" }}>
                                <View style={styles.moneyBagIconContainer}>
                                  <Text style={styles.moneyBagDollarSymbol}>$</Text>
                                </View>
                                <Text style={[styles.inputText, darkMode && styles.darkInputText]}>
                                  {wish.cost.toLowerCase() !== "free" ? `Cost: $${wish.cost.replace(/^\$/, "")}` : `Cost: ${wish.cost}`}
                                </Text>
                              </View>
                            ) : null}
                            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "flex-end", flexWrap: "wrap", gap: 8 }}>
                              {wish.profile_wish_quantity ? (
                                <Text style={[styles.inputText, darkMode && styles.darkInputText]}>Qty: {String(wish.profile_wish_quantity).trim()}</Text>
                              ) : null}
                              {wish.amount ? (
                                <Text style={[styles.inputText, { textAlign: "right", minWidth: 60 }, darkMode && styles.darkInputText]}>
                                  {wish.amount.toLowerCase() !== "free" ? `💰 $${wish.amount.replace(/^\$/, "")}` : `💰 ${wish.amount}`}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                          {wish.profile_wish_start || wish.profile_wish_end || wish.profile_wish_location || wish.profile_wish_mode ? (
                            <View style={[styles.seekingMetaRow, { marginTop: 6 }]}>
                              {wish.profile_wish_start || wish.profile_wish_end ? (
                                <View style={styles.seekingMetaLine}>
                                  <Ionicons name='calendar-outline' size={14} color={darkMode ? "#999" : "#666"} style={{ marginRight: 6 }} />
                                  <Text style={[styles.inputText, styles.seekingMetaText, darkMode && styles.darkSeekingMetaText]}>
                                    {wish.profile_wish_start ? formatDateTimeForDisplay(wish.profile_wish_start) : "—"}
                                    {wish.profile_wish_start && wish.profile_wish_end ? " → " : ""}
                                    {wish.profile_wish_end ? formatDateTimeForDisplay(wish.profile_wish_end) : ""}
                                  </Text>
                                </View>
                              ) : null}
                              {wish.profile_wish_location || wish.profile_wish_mode ? (
                                <View style={[styles.seekingMetaLine, styles.seekingMetaLineSpaceBetween, (wish.profile_wish_start || wish.profile_wish_end) && { marginTop: 4 }]}>
                                  {wish.profile_wish_location ? (
                                    <View style={styles.seekingMetaLine}>
                                      <Ionicons name='location-outline' size={14} color={darkMode ? "#999" : "#666"} style={{ marginRight: 6 }} />
                                      <Text style={[styles.inputText, styles.seekingMetaText, darkMode && styles.darkSeekingMetaText]}>{wish.profile_wish_location}</Text>
                                    </View>
                                  ) : (
                                    <View style={styles.seekingMetaSpacer} />
                                  )}
                                  {wish.profile_wish_mode ? (
                                    <View style={styles.seekingMetaLine}>
                                      <Ionicons
                                        name={wish.profile_wish_mode.toLowerCase() === "virtual" ? "videocam-outline" : "people-outline"}
                                        size={14}
                                        color={darkMode ? "#999" : "#666"}
                                        style={{ marginRight: 6 }}
                                      />
                                      <Text style={[styles.inputText, styles.seekingMetaText, darkMode && styles.darkSeekingMetaText]}>{wish.profile_wish_mode}</Text>
                                    </View>
                                  ) : null}
                                </View>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      );
                      if (routeProfileUID && !isCurrentUserProfile) {
                        return (
                          <TouchableOpacity
                            key={index}
                            activeOpacity={0.7}
                            onPress={() => {
                              const wishData = {
                                wish_uid: wish.profile_wish_uid,
                                title: wish.helpNeeds,
                                description: wish.details,
                                bounty: wish.amount,
                                cost: wish.cost,
                                profile_wish_quantity: wish.profile_wish_quantity,
                                profile_wish_image: wish.profile_wish_image,
                                profile_wish_image_is_public: wish.profile_wish_image_is_public,
                                profile_wish_start: wish.profile_wish_start,
                                profile_wish_end: wish.profile_wish_end,
                                profile_wish_location: wish.profile_wish_location,
                                profile_wish_mode: wish.profile_wish_mode,
                              };
                              const profileData = {
                                firstName: user.firstName,
                                lastName: user.lastName,
                                email: user.email,
                                phone: user.phoneNumber,
                                image: user.profileImage,
                                tagLine: user.tagLine,
                                city: user.city,
                                state: user.state,
                                emailIsPublic: user.emailIsPublic,
                                phoneIsPublic: user.phoneIsPublic,
                                imageIsPublic: user.imageIsPublic,
                                tagLineIsPublic: user.tagLineIsPublic,
                                locationIsPublic: user.locationIsPublic,
                              };
                              navigation.navigate("WishDetail", {
                                wishData,
                                profileData,
                                profile_uid: profileUID,
                                returnTo: "Profile",
                                profileState: { profile_uid: profileUID, returnTo, searchState },
                              });
                            }}
                          >
                            {wishItem}
                          </TouchableOpacity>
                        );
                      }
                      return wishItem;
                    })
                ) : (
                  <Text style={[styles.inputText, darkMode && styles.darkInputText, styles.emptySectionPlaceholder, { fontStyle: "italic", color: "#666" }]}>No seeking added yet</Text>
                ))}
            </View>
          )}

          {/* Only show Experience section if there are public experiences, or if viewing own profile */}
          {/*{(isCurrentUserProfile || (user.experience && user.experience.filter((exp) => exp.isPublic).length > 0)) && ( */}
          {user.experienceIsPublic && (
            <View style={styles.fieldContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowExperience(!showExperience)}>
                <Text style={styles.sectionHeaderText}>EXPERIENCE</Text>
                <Ionicons name={showExperience ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showExperience &&
                (user.experience && user.experience.filter((exp) => exp.isPublic).length > 0 ? (
                  user.experience
                    .filter((exp) => exp.isPublic)
                    .map((exp, index) => (
                      <View key={index} style={[styles.sectionItemContainer, darkMode && styles.darkSectionItemContainer]}>
                        {exp.title ? <Text style={[styles.inputText, darkMode && styles.darkInputText, { fontWeight: "bold" }]}>{exp.title}</Text> : null}
                        {exp.company ? <Text style={[styles.inputText, darkMode && styles.darkInputText, { fontWeight: "bold" }]}>{exp.company}</Text> : null}
                        {exp.description ? <Text style={[styles.inputText, darkMode && styles.darkInputText]}>{exp.description}</Text> : null}
                        {exp.startDate || exp.endDate ? (
                          <Text style={[styles.inputText, darkMode && styles.darkInputText, { color: "#666" }]}>
                            {(exp.startDate || "") + (exp.startDate && exp.endDate ? " - " : "") + (exp.endDate || "")}
                          </Text>
                        ) : null}
                      </View>
                    ))
                ) : (
                  <Text style={[styles.inputText, darkMode && styles.darkInputText, styles.emptySectionPlaceholder, { fontStyle: "italic", color: "#666" }]}>No experience added yet</Text>
                ))}
            </View>
          )}

          {/* Only show Education section if there are public education entries, or if viewing own profile */}
          {/*{(isCurrentUserProfile || (user.education && user.education.filter((edu) => edu.isPublic).length > 0)) && ( */}
          {user.educationIsPublic && (
            <View style={styles.fieldContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowEducation(!showEducation)}>
                <Text style={styles.sectionHeaderText}>EDUCATION</Text>
                <Ionicons name={showEducation ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showEducation &&
                (user.education && user.education.filter((edu) => edu.isPublic).length > 0 ? (
                  user.education
                    .filter((edu) => edu.isPublic)
                    .map((edu, index) => (
                      <View key={index} style={[styles.sectionItemContainer, darkMode && styles.darkSectionItemContainer]}>
                        {edu.degree ? <Text style={[styles.inputText, darkMode && styles.darkInputText, { fontWeight: "bold" }]}>{edu.degree}</Text> : null}
                        {edu.school ? <Text style={[styles.inputText, darkMode && styles.darkInputText, { fontWeight: "bold" }]}>{edu.school}</Text> : null}
                        {edu.startDate || edu.endDate ? (
                          <Text style={[styles.inputText, darkMode && styles.darkInputText, { color: "#666" }]}>
                            {(edu.startDate || "") + (edu.startDate && edu.endDate ? "  to  " : "") + (edu.endDate || "")}
                          </Text>
                        ) : null}
                      </View>
                    ))
                ) : (
                  <Text style={[styles.inputText, darkMode && styles.darkInputText, styles.emptySectionPlaceholder, { fontStyle: "italic", color: "#666" }]}>No education added yet</Text>
                ))}
            </View>
          )}

          {/* Only show Businesses section if there are businesses, or if viewing own profile */}
          {/*{(isCurrentUserProfile || (businessesData && businessesData.length > 0)) && ( */}

          {user.businessIsPublic && (
            <View style={styles.fieldContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowBusiness(!showBusiness)}>
                <Text style={styles.sectionHeaderText}>BUSINESSES / ORGANIZATIONS</Text>
                <Ionicons name={showBusiness ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
              {showBusiness &&
                (() => {
                  const businessesToShow = Array.isArray(businessesData)
                    ? businessesData.filter((b) => b.individualIsPublic === true)
                    : [];
                  return businessesToShow.length > 0 ? (
                    businessesToShow.map((business, index) => (
                      <View
                        key={business.profile_business_uid || business.business_uid || index}
                        style={[styles.sectionItemContainer, darkMode && styles.darkSectionItemContainer, index > 0 && { marginTop: 4 }]}
                      >
                        <TouchableOpacity
                          onPress={() => {
                            const uid = business.business_uid || business.profile_business_uid;
                            if (uid) {
                              navigation.navigate("BusinessProfile", { business_uid: uid });
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <MiniCard
                            business={{
                              ...business,
                              tagline: business.tagline || business.business_tag_line || "",
                              taglineIsPublic: business.taglineIsPublic !== false,
                            }}
                          />
                        </TouchableOpacity>
                        {business.role ? (
                          <View style={styles.roleContainer}>
                            <Text style={[styles.roleText, darkMode && styles.darkRoleText]}>Role: {sanitizeText(business.role)}</Text>
                          </View>
                        ) : null}
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.inputText, darkMode && styles.darkInputText, styles.emptySectionPlaceholder, { fontStyle: "italic", color: "#666" }]}>No businesses added yet</Text>
                  );
                })()}
            </View>
          )}

          {/* Reviews — collapsible section */}
          <View style={styles.fieldContainer}>
            <View style={[styles.sectionHeader, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <TouchableOpacity onPress={() => setShowReviews(!showReviews)} activeOpacity={0.7}>
                  <Text style={styles.sectionHeaderText}>REVIEWS</Text>
                </TouchableOpacity>
                {isCurrentUserProfile && (
                  <TouchableOpacity
                    onPress={() => {
                      setReviewSearchQuery("");
                      setReviewSearchResults([]);
                      setReviewSearchDone(false);
                      setReviewSearchVisible(!reviewSearchVisible);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.sectionHeaderText, { fontSize: 28, lineHeight: 28 }]}>+</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowReviews(!showReviews)} activeOpacity={0.7}>
                <Ionicons name={showReviews ? "chevron-up" : "chevron-down"} size={20} color='#000' />
              </TouchableOpacity>
            </View>
            {/* Review search overlay modal */}
            <Modal
              visible={reviewSearchVisible}
              transparent
              animationType='fade'
              onRequestClose={() => {
                setReviewSearchVisible(false);
                setPlaceSuggestions([]);
              }}
            >
              <TouchableWithoutFeedback
                onPress={() => {
                  setReviewSearchVisible(false);
                  setPlaceSuggestions([]);
                }}
              >
                <View style={profileStyles.overlayBackdrop} />
              </TouchableWithoutFeedback>
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={profileStyles.overlayContainer} pointerEvents='box-none'>
                <View style={[profileStyles.overlayCard, darkMode && profileStyles.darkOverlayCard]}>
                  {/* Header */}
                  <View style={profileStyles.overlayHeader}>
                    <Text style={[profileStyles.overlayTitle, darkMode && { color: "#fff" }]}>Add a Review</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setReviewSearchVisible(false);
                        setPlaceSuggestions([]);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name='close' size={22} color={darkMode ? "#fff" : "#333"} />
                    </TouchableOpacity>
                  </View>
                  {/* Search row — matches SearchScreen layout */}
                  <View style={profileStyles.overlaySearchRow}>
                    <TextInput
                      style={[profileStyles.inlineSearchInput, darkMode && profileStyles.darkInlineSearchInput]}
                      placeholder='What are you looking for?'
                      placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                      value={reviewSearchQuery}
                      onChangeText={setReviewSearchQuery}
                      onSubmitEditing={() => searchBusinessesForReview(reviewSearchQuery)}
                      returnKeyType='search'
                      autoCapitalize='none'
                      autoCorrect={false}
                      autoFocus={true}
                    />
                    <TouchableOpacity
                      style={[profileStyles.inlineSearchBtn, darkMode && profileStyles.darkInlineSearchBtn]}
                      onPress={() => searchBusinessesForReview(reviewSearchQuery)}
                      disabled={reviewSearchLoading}
                    >
                      {reviewSearchLoading ? <ActivityIndicator size='small' color={darkMode ? "#fff" : "#000"} /> : <Ionicons name='search' size={22} color={darkMode ? "#ffffff" : "#000000"} />}
                    </TouchableOpacity>
                  </View>
                  {/* Results — identical to SearchScreen renderResultItem */}
                  <FlatList
                    data={reviewSearchResults}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps='handled'
                    style={{ maxHeight: 340 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[profileStyles.inlineResultCard, darkMode && profileStyles.darkInlineResultCard]}
                        onPress={() => {
                          setReviewSearchVisible(false);
                          navigation.navigate("ReviewBusiness", { business_uid: item.id, business_name: item.company });
                        }}
                        activeOpacity={0.7}
                      >
                        {/* Left: image + name/tagline — same as SearchScreen resultContent */}
                        <View style={profileStyles.resultContent}>
                          <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <Image
                              source={item.business_profile_img ? { uri: encodeURI(item.business_profile_img.trim()) } : require("../assets/profile.png")}
                              style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }}
                              defaultSource={require("../assets/profile.png")}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={[profileStyles.companyName, darkMode && profileStyles.darkCompanyName]} numberOfLines={1}>
                                {item.company ? String(item.company).trim() : ""}
                              </Text>
                              {(() => {
                                const tagLine = item.business_tag_line ? String(item.business_tag_line).trim() : "";
                                if (tagLine && tagLine !== "." && tagLine.length > 0) {
                                  return (
                                    <Text style={[profileStyles.businessTagLine, darkMode && profileStyles.darkBusinessTagLine]} numberOfLines={1}>
                                      {tagLine}
                                    </Text>
                                  );
                                }
                                return null;
                              })()}
                            </View>
                          </View>
                        </View>
                        {/* Right: Rating | Bounty | Level — same as SearchScreen businessResultActions */}
                        <View style={profileStyles.businessResultActions}>
                          <View style={profileStyles.businessTableRatingCol}>
                            {Number.isFinite(item.rating) ? (
                              <View style={profileStyles.ratingContainer}>
                                <Ionicons name='star' size={16} color='#FFCD3C' />
                                <Text style={[profileStyles.ratingText, darkMode && profileStyles.darkRatingText]}>
                                  {item.rating.toFixed(1)}
                                  {item.ratingCount > 0 ? ` (${item.ratingCount})` : ""}
                                </Text>
                              </View>
                            ) : (
                              <Text style={[profileStyles.metricPlaceholder, darkMode && profileStyles.darkMetricPlaceholder]}>—</Text>
                            )}
                          </View>
                          <View style={profileStyles.businessTableBountyCol}>
                            {item.max_bounty != null ? <Text style={[profileStyles.bountyEmojiIcon, profileStyles.bountyEmojiIconCompact]}>💰</Text> : <NoBountyIcon darkMode={darkMode} />}
                          </View>
                          <View style={profileStyles.businessTableLevelCol}>
                            <View style={profileStyles.levelButton}>
                              <View style={{ position: "relative" }}>
                                <Image source={require("../assets/connect.png")} style={{ width: 22, height: 22, tintColor: darkMode ? "#ffffff" : "#000000" }} />
                                {item.connection_degree != null && (
                                  <View style={profileStyles.connectionBadge}>
                                    <Text style={profileStyles.connectionBadgeText}>{item.connection_degree}</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      reviewSearchDone && !reviewSearchLoading && reviewSearchResults.length === 0 && placeSuggestions.length === 0 ? (
                        <Text style={[profileStyles.inlineEmptyText, darkMode && { color: "#aaa" }]}>No results found for "{reviewSearchQuery}"</Text>
                      ) : null
                    }
                  />
                  {/* Google Places — always shown below DB results when search has been done */}
                  {reviewSearchDone && placeSuggestions.length > 0 && (
                    <>
                      <View style={profileStyles.placesSeparator}>
                        <View style={profileStyles.placesSeparatorLine} />
                        <Text style={[profileStyles.placesSeparatorLabel, darkMode && { color: "#aaa" }]}>Also on Google</Text>
                        <View style={profileStyles.placesSeparatorLine} />
                      </View>
                      <FlatList
                        data={placeSuggestions}
                        keyExtractor={(item) => item.place_id}
                        keyboardShouldPersistTaps='handled'
                        style={{ maxHeight: 260 }}
                        renderItem={({ item }) => (
                          <TouchableOpacity style={[profileStyles.inlineResultCard, darkMode && profileStyles.darkInlineResultCard]} onPress={() => handleGooglePlaceSelect(item)} activeOpacity={0.7}>
                            {/* Left: pin icon + name + address — same layout as DB card */}
                            <View style={profileStyles.resultContent}>
                              <View style={{ flexDirection: "row", alignItems: "center" }}>
                                <View
                                  style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    marginRight: 10,
                                    backgroundColor: darkMode ? "#404040" : "#f0f0f0",
                                    justifyContent: "center",
                                    alignItems: "center",
                                  }}
                                >
                                  <Ionicons name='location-outline' size={22} color={darkMode ? "#aaa" : "#666"} />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[profileStyles.companyName, darkMode && profileStyles.darkCompanyName]} numberOfLines={1}>
                                    {item.structured_formatting?.main_text || item.description}
                                  </Text>
                                  {item.structured_formatting?.secondary_text ? (
                                    <Text style={[profileStyles.businessTagLine, darkMode && profileStyles.darkBusinessTagLine]} numberOfLines={1}>
                                      📍 {item.structured_formatting.secondary_text}
                                    </Text>
                                  ) : null}
                                </View>
                              </View>
                            </View>
                            {/* Right: same 3-column layout as DB card */}
                            <View style={profileStyles.businessResultActions}>
                              <View style={profileStyles.businessTableRatingCol}>
                                <Text style={[profileStyles.metricPlaceholder, darkMode && profileStyles.darkMetricPlaceholder, { fontSize: 10, textAlign: "center" }]}>No{"\n"}reviews</Text>
                              </View>
                              <View style={profileStyles.businessTableBountyCol}>
                                <NoBountyIcon darkMode={darkMode} />
                              </View>
                              <View style={profileStyles.businessTableLevelCol}>
                                <View style={profileStyles.levelButton}>
                                  <Image source={require("../assets/connect.png")} style={{ width: 22, height: 22, tintColor: darkMode ? "#ffffff" : "#000000" }} />
                                </View>
                              </View>
                            </View>
                          </TouchableOpacity>
                        )}
                      />
                    </>
                  )}
                </View>
              </KeyboardAvoidingView>
            </Modal>
            {showReviews &&
              (user.ratings && user.ratings.length > 0 ? (
                user.ratings.map((review, index) => (
                  <TouchableOpacity
                    key={review.rating_uid || index}
                    style={[styles.inputContainer, darkMode && styles.darkInputContainer, index > 0 && { marginTop: 4 }]}
                    onPress={() => navigation.navigate("BusinessProfile", { business_uid: review.rating_business_id })}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <Text style={[styles.inputText, darkMode && styles.darkInputText, { fontWeight: "bold" }]}>{review.business_name || review.rating_business_id}</Text>
                      <Text style={[styles.inputText, darkMode && styles.darkInputText, { color: "#999", fontSize: 12 }]}>{review.rating_receipt_date}</Text>
                    </View>
                    {review.business_phone_number ? <Text style={[styles.inputText, darkMode && styles.darkInputText]}>{review.business_phone_number}</Text> : null}
                    {review.business_city || review.business_state ? (
                      <Text style={[styles.inputText, darkMode && styles.darkInputText]}>{[review.business_city, review.business_state].filter(Boolean).join(", ")}</Text>
                    ) : null}
                    <Text style={[styles.inputText, darkMode && styles.darkInputText]}>
                      {"⭐".repeat(review.rating_star)} {review.rating_star}/5
                    </Text>
                    {review.rating_description ? <Text style={[styles.inputText, darkMode && styles.darkInputText]}>{review.rating_description}</Text> : null}
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={[styles.inputText, darkMode && styles.darkInputText, styles.emptySectionPlaceholder, { fontStyle: "italic", color: "#666" }]}>No reviews yet</Text>
              ))}
          </View>
        </ScrollView>

        <BottomNavBar navigation={navigation} />
      </SafeAreaView>
      <ScannedProfilePopup
        visible={showConnectPopup}
        profileData={user}
        title='Connection Details'
        initialData={{
          relationship: relationshipType,
          event: existingRelationship?.circle_event || "",
          note: existingRelationship?.circle_note || "",
          city: existingRelationship?.circle_city || "",
          state: existingRelationship?.circle_state || "",
          introducedBy: existingRelationship?.circle_introduced_by || "",
        }}
        actionLabel='Save Connection'
        onClose={() => setShowConnectPopup(false)}
        onAddConnection={handleConnectPopupSave}
      />
      <FeedbackPopup visible={showFeedbackPopup} onClose={() => setShowFeedbackPopup(false)} pageName='Profile' instructions={profileFeedbackInstructions} questions={profileFeedbackQuestions} />
      {/* Full-screen spinner while saving a Google Place business to DB */}
      {savingGooglePlace && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 24, alignItems: "center", gap: 12 }}>
            <ActivityIndicator size='large' color='#9C45F7' />
            <Text style={{ fontSize: 14, color: "#333", fontWeight: "500" }}>Setting up business…</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 0,
    ...(Platform.OS === "web" && {
      position: "relative",
      zIndex: 1, // Lower z-index so dropdown can appear above
    }),
  },
  safeArea: { flex: 1, backgroundColor: "#fff" },
  scrollContainer: { flex: 1 },
  fieldContainer: {
    marginTop: 15,
    marginBottom: 0,
    backgroundColor: "#fff",
    // padding: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
    paddingLeft: 10,
    paddingTop: 10,
  },
  inputContainer: {
    // borderWidth: 1,
    // borderColor: "#ccc",
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#ffffff",
    marginBottom: 4,
  },
  inputText: { fontSize: 15, color: "#333", marginBottom: 4 },
  plainText: { fontSize: 15, color: "#333", marginBottom: 10 },
  editButton: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  editIcon: { width: 20, height: 20 },
  dropdownWrapper: {
    zIndex: 10001,
    overflow: "visible", // IMPORTANT FOR WEB
  },
  addButton: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownMenu: {
    position: "absolute",
    top: 45,
    right: 0,
    width: 170,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 6,
    boxShadow: "0px 2px 4px 0px rgba(0, 0, 0, 0.2)",
    ...(Platform.OS !== "web" && { elevation: 5 }),
    zIndex: 10002, // REQUIRED FOR WEB - must be above all content
    pointerEvents: "auto", // REQUIRED FOR WEB
    overflow: "visible", // Ensure all items are visible
  },
  darkDropdownMenu: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
    borderWidth: 1,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#000",
  },
  darkDropdownItemText: {
    color: "#fff",
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: "#ddd",
  },
  darkDropdownDivider: {
    backgroundColor: "#404040",
  },
  dropdownOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9,
  },
  errorText: { fontSize: 18, color: "red", textAlign: "center", marginTop: 20 },
  cardContainer: {
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#000",
    marginVertical: 5,
  },
  darkCardContainer: {
    backgroundColor: "#2d2d2d",
    borderColor: "#fff",
    borderWidth: 1,
  },
  profileHeaderContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 8,
  },
  nameText: { fontSize: 26, fontWeight: "bold", color: "#000", marginBottom: 8, textAlign: "center" },
  profileId: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    fontStyle: "italic",
    textAlign: "center",
  },
  relationshipText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    fontStyle: "italic",
  },
  darkRelationshipText: {
    color: "#cccccc",
  },
  tagline: {
    fontSize: 18,
    fontWeight: "600",
    color: "#777",
    marginBottom: 12,
  },

  bio: {
    fontSize: 16,
    color: "#777",
    marginBottom: 20,
  },
  contact: {
    fontSize: 16,
    color: "#555",
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
    backgroundColor: "#eee",
  },
  // Dark mode styles
  darkPageContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkSafeArea: {
    backgroundColor: "#1a1a1a",
  },
  darkScrollContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkNameText: {
    color: "#ffffff",
  },
  darkProfileId: {
    color: "#cccccc",
  },
  darkTagline: {
    color: "#cccccc",
  },
  darkBio: {
    color: "#cccccc",
  },
  darkContact: {
    color: "#cccccc",
  },
  darkLabel: {
    color: "#ffffff",
  },
  darkInputContainer: {
    // backgroundColor: "#2d2d2d",
    borderColor: "#fff",
  },
  darkInputText: {
    color: "#ffffff",
  },
  darkErrorText: {
    color: "#ff6b6b",
  },
  darkEditIcon: {
    // tintColor moved to Image prop
  },
  businessCardContainer: {
    marginBottom: 10,
    borderRadius: 10,
    overflow: "visible",
  },
  darkBusinessCardContainer: {
    backgroundColor: "transparent",
  },
  roleContainer: {
    marginTop: 8,
    paddingLeft: 10,
  },
  roleText: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#666",
  },
  darkRoleText: {
    color: "#999",
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
  wishResponseLinkText: {
    color: "#800000",
    fontSize: 14,
    fontWeight: "600",
  },
  darkWishResponseLinkText: {
    color: "#c77dff",
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
  chatButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: "#AF52DE",
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 24,
    marginTop: 14,
    marginBottom: 4,
  },
  chatButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgb(243, 165, 165)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000",
    letterSpacing: 1,
  },
  sectionItemContainer: {
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  darkSectionItemContainer: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  /** Empty-state lines: "No bio added yet", etc. */
  emptySectionPlaceholder: {
    marginLeft: 5,
  },
});

const profileStyles = StyleSheet.create({
  /* Overlay backdrop */
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  overlayContainer: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: Platform.OS === "ios" ? 80 : 60,
    paddingHorizontal: 16,
  },
  overlayCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  darkOverlayCard: { backgroundColor: "#1e1e1e" },
  overlayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  overlayTitle: { fontSize: 16, fontWeight: "700", color: "#000" },
  /* Search bar — identical to SearchScreen */
  overlaySearchRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  inlineSearchInput: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    padding: 12,
    marginRight: 10,
    fontSize: 14,
    color: "#000",
  },
  darkInlineSearchInput: { backgroundColor: "#404040", color: "#fff" },
  /* search button — matches SearchScreen searchButton */
  inlineSearchBtn: { marginLeft: 10, backgroundColor: "#f0f0f0", borderRadius: 8, padding: 12, justifyContent: "center", alignItems: "center" },
  darkInlineSearchBtn: { backgroundColor: "#404040" },
  /* Result cards — exact copy of SearchScreen resultItem */
  inlineResultCard: {
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
  darkInlineResultCard: { backgroundColor: "#2d2d2d", borderBottomColor: "#404040" },
  resultContent: { flex: 1 },
  companyName: { fontSize: 16, fontWeight: "500", color: "#333" },
  darkCompanyName: { color: "#ffffff" },
  businessTagLine: { fontSize: 12, color: "#666", marginTop: 2, fontStyle: "italic" },
  darkBusinessTagLine: { color: "#cccccc" },
  /* Right-side actions — exact copy of SearchScreen */
  businessResultActions: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
  businessTableRatingCol: { width: 100, justifyContent: "center", alignItems: "center" },
  businessTableBountyCol: { width: 40, justifyContent: "center", alignItems: "center" },
  businessTableLevelCol: { width: 52, justifyContent: "center", alignItems: "center" },
  levelButton: { padding: 4 },
  ratingContainer: { flexDirection: "row", alignItems: "center" },
  ratingText: { marginLeft: 4, fontSize: 14, fontWeight: "500", color: "#333" },
  darkRatingText: { color: "#cccccc" },
  metricPlaceholder: { fontSize: 16, color: "#999", fontWeight: "500" },
  darkMetricPlaceholder: { color: "#777777" },
  bountyEmojiIcon: { fontSize: 20, marginRight: 6 },
  bountyEmojiIconCompact: { fontSize: 20, marginRight: 0 },
  /* NoBountyIcon — exact copy of SearchScreen */
  noBountyIconWrap: { width: 24, height: 22, justifyContent: "center", alignItems: "center" },
  noBountyEmoji: { fontSize: 20 },
  noBountySlash: {
    position: "absolute",
    width: 26,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#1a1a1a",
    transform: [{ rotate: "-42deg" }],
  },
  darkNoBountySlash: { backgroundColor: "#f0f0f0" },
  /* Connection badge — exact copy of SearchScreen */
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
  connectionBadgeText: { fontSize: 10, fontWeight: "700", color: "#ffffff", lineHeight: 12 },
  inlineEmptyText: { fontSize: 13, color: "#666", textAlign: "center", paddingVertical: 10 },
  placesSeparator: { flexDirection: "row", alignItems: "center", marginVertical: 10 },
  placesSeparatorLine: { flex: 1, height: 1, backgroundColor: "#ddd" },
  placesSeparatorLabel: { fontSize: 11, color: "#666", marginHorizontal: 8, fontWeight: "600" },
});

export default ProfileScreen;
