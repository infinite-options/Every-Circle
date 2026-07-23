// WishDetailScreen.js
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Platform, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MiniCard from "../components/MiniCard";
import ReferralSearch from "../components/ReferralSearch";
import BottomNavBar from "../components/BottomNavBar";
import { useDarkMode } from "../contexts/DarkModeContext";
import AppHeader from "../components/AppHeader";
import { getHeaderColors, getHeaderColor, getDarkModeHeaderColor } from "../config/headerColors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TRANSACTIONS_ENDPOINT, PROFILE_WISH_INFO_ENDPOINT, PROFILE_WISH_RESPONSE_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "../utils/httpMiddleware";
import { resolveProfileItemImageUri } from "../utils/resolveProfileItemImageUri";
import ProfileSectionItemImage from "../components/ProfileSectionItemImage";
import SeekingCardDetails from "../components/SeekingCardDetails";
import DetailFlagButton, { detailActionRowStyle } from "../components/DetailFlagButton";
import FlagSeekingModal from "../components/FlagSeekingModal";
import SeekingModerationBanner from "../components/SeekingModerationBanner";
import { useHeaderCart } from "../components/HeaderCartButton";
import { recordWishMessageResponse } from "../utils/wishMessageResponse";
import {
  acknowledgeSeekingModeration,
  canAcknowledgeTakenDownSeeking,
  fetchSeekingModerationDetail,
  getSeekingModeratedState,
  isSeekingModeratedBlocked,
  MODERATED_ACKNOWLEDGED,
  MODERATED_TAKEN_DOWN,
  normalizeSeekingReviewDetail,
} from "../utils/seekingModeration";

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

const WishDetailScreenContent = ({ route, navigation }) => {
  const { wishData: initialWishData, profileData, profile_uid, searchState, returnTo, profileState } = route.params;
  const { darkMode } = useDarkMode();
  const { headerCartButton } = useHeaderCart(navigation, { returnTo: "Search", searchState });
  const [loading, setLoading] = useState(false);
  const [currentProfileUid, setCurrentProfileUid] = useState(null);
  const [wishData, setWishData] = useState(initialWishData);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [helpType, setHelpType] = useState(null); // "help" | "refer"
  const [howICanHelp, setHowICanHelp] = useState("");
  const [referralFirstName, setReferralFirstName] = useState("");
  const [referralLastName, setReferralLastName] = useState("");
  const [referralEmail, setReferralEmail] = useState("");
  const [referralPhone, setReferralPhone] = useState("");
  const [referralNote, setReferralNote] = useState("");
  const [referredProfileUid, setReferredProfileUid] = useState(null); // Seller - the person being referred (can help)
  const [existingResponses, setExistingResponses] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem("profile_uid").then((uid) => setCurrentProfileUid(uid));
  }, []);

  useEffect(() => {
    setWishData(initialWishData);
  }, [initialWishData]);

  const isOwnWish = currentProfileUid && profile_uid === currentProfileUid;
  const moderatedState = getSeekingModeratedState(wishData);
  const seekingTakenDown = moderatedState === MODERATED_TAKEN_DOWN;
  const seekingAcknowledged = moderatedState === MODERATED_ACKNOWLEDGED;
  const seekingModeratedBlocked = isSeekingModeratedBlocked(wishData);
  const canAcknowledge = isOwnWish && canAcknowledgeTakenDownSeeking(wishData);
  const wishUid = String(wishData?.wish_uid || wishData?.profile_wish_uid || wishData?.profile_wish_id || "").trim();
  const seekingTitle = wishData?.title ? String(wishData.title).trim() : "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const wishId = String(wishData?.wish_uid || wishData?.profile_wish_id || "").trim();
      const profileUid = (await AsyncStorage.getItem("profile_uid"))?.trim();
      if (!wishId || !profileUid) {
        if (!cancelled) setExistingResponses([]);
        return;
      }
      try {
        const res = await fetch(`${PROFILE_WISH_RESPONSE_ENDPOINT}/${encodeURIComponent(profileUid)}`);
        const json = await res.json();
        const rows = Array.isArray(json?.data) ? json.data : [];
        const matches = rows.filter((row) => String(row.wr_profile_wish_id || "").trim() === wishId).sort((a, b) => String(b.wr_datetime || "").localeCompare(String(a.wr_datetime || "")));
        if (!cancelled) setExistingResponses(matches);
      } catch (e) {
        console.warn("[WishDetailScreen] fetchMyWishResponse failed:", e);
        if (!cancelled) setExistingResponses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wishData?.wish_uid, wishData?.profile_wish_id, wishData?.profile_wish_uid]);

  useEffect(() => {
    if (!currentProfileUid || !profile_uid || currentProfileUid !== profile_uid || !wishUid) return;
    if (getSeekingModeratedState(wishData) !== MODERATED_TAKEN_DOWN) return;
    if (canAcknowledgeTakenDownSeeking(wishData)) return;

    const mod = wishData?.moderation || {};
    const hasRejectionMeta =
      mod?.resubmissionStatus ||
      mod?.resubmission_status ||
      mod?.status === "rejected" ||
      mod?.rejectionNote ||
      mod?.rejection_note;
    if (hasRejectionMeta) return;

    let cancelled = false;
    (async () => {
      try {
        const detail = await fetchSeekingModerationDetail(wishUid);
        if (cancelled) return;
        const { seeking, moderation } = normalizeSeekingReviewDetail(detail);
        setWishData((prev) => ({
          ...prev,
          profile_wish_moderated: seeking?.profile_wish_moderated ?? prev?.profile_wish_moderated,
          moderation: {
            ...(prev?.moderation || {}),
            ...(seeking?.moderation || {}),
            ...(moderation || {}),
          },
        }));
      } catch (e) {
        console.warn("[WishDetailScreen] fetch moderation detail failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentProfileUid, profile_uid, wishUid, wishData?.profile_wish_moderated, wishData?.moderation]);

  const navigateAfterAcknowledge = () => {
    if (returnTo === "Profile" && profileState) {
      navigation.navigate("Profile", profileState);
    } else if (searchState) {
      navigation.navigate("Search", { restoreState: true, searchState });
    } else {
      navigation.goBack();
    }
  };

  const submitAcknowledgeTakeDown = async () => {
    if (acknowledging) return;
    setAcknowledging(true);
    try {
      const result = await acknowledgeSeekingModeration({
        profileWishUid: wishUid,
        profileUid: profile_uid || currentProfileUid,
      });
      setWishData((prev) => ({
        ...prev,
        profile_wish_moderated: MODERATED_ACKNOWLEDGED,
        moderation: {
          ...(prev?.moderation || {}),
          moderated: MODERATED_ACKNOWLEDGED,
          status: "acknowledged",
        },
      }));
      const already = result?.already_acknowledged === true || result?.data?.already_acknowledged === true;
      const doneTitle = already ? "Already acknowledged" : "Acknowledged";
      const doneMessage = already
        ? "This seeking post was already acknowledged and has been removed from your profile."
        : "This seeking post has been acknowledged and removed from your profile.";
      if (Platform.OS === "web") {
        window.alert(doneMessage);
        navigateAfterAcknowledge();
      } else {
        Alert.alert(doneTitle, doneMessage, [{ text: "OK", onPress: navigateAfterAcknowledge }]);
      }
    } catch (error) {
      console.error("WishDetailScreen - acknowledge failed:", error);
      Alert.alert("Error", error?.message || "Failed to acknowledge take-down.");
    } finally {
      setAcknowledging(false);
    }
  };

  const handleAcknowledgeTakeDown = () => {
    if (!canAcknowledge || acknowledging) return;
    const confirmMessage =
      "By acknowledging, you confirm you understand this seeking post was removed for violating our policies. It will be removed from your profile.";
    if (Platform.OS === "web") {
      if (window.confirm(`Acknowledge take-down\n\n${confirmMessage}`)) {
        submitAcknowledgeTakeDown();
      }
      return;
    }
    Alert.alert("Acknowledge take-down", confirmMessage, [
      { text: "Cancel", style: "cancel" },
      { text: "Acknowledge", style: "destructive", onPress: submitAcknowledgeTakeDown },
    ]);
  };

  // Create user object for MiniCard
  const userForMiniCard = {
    firstName: profileData?.firstName || "",
    lastName: profileData?.lastName || "",
    email: profileData?.email || "",
    phoneNumber: profileData?.phone || "",
    profileImage: profileData?.image || "",
    tagLine: profileData?.tagLine || "",
    emailIsPublic: profileData?.emailIsPublic || false,
    phoneIsPublic: profileData?.phoneIsPublic || false,
    tagLineIsPublic: profileData?.tagLineIsPublic || false,
    imageIsPublic: profileData?.imageIsPublic || false,
  };

  const recordTransaction = async (buyerUid) => {
    try {
      console.log("Recording wish transaction...");
      console.log("Buyer UID:", buyerUid);
      console.log("Seller UID:", profile_uid);
      console.log("Wish UID:", wishData?.wish_uid);
      console.log("Amount: 0 (wishes have no cost)");
      console.log("Transaction Type:", "wish_purchase");

      // Format transaction data to match the API's expected format
      // For wish purchases, cost is always 0, no payment intent needed
      // Use seller UID (profile_uid) as business_id for wish transactions
      const transactionData = {
        profile_id: buyerUid,
        business_id: profile_uid, // Use seller's profile UID as business_id for wishes
        stripe_payment_intent: null, // No payment intent for wishes (cost = 0)
        total_amount_paid: 0, // Wishes have no cost
        total_costs: 0, // Wishes have no cost
        total_taxes: 0,
        total_fees: 0,
        items: [
          {
            wish_uid: wishData?.wish_uid,
            bounty: parseFloat(wishData?.bounty) || 0,
            quantity: 1,
            recommender_profile_id: null, // No recommender for direct wish purchases
          },
        ],
      };

      console.log("============================================");
      console.log("ENDPOINT: RECORD_TRANSACTIONS");
      console.log("URL:", TRANSACTIONS_ENDPOINT);
      console.log("METHOD: POST");
      console.log("REQUEST BODY:", JSON.stringify(transactionData, null, 2));
      console.log("============================================");

      const response = await fetch(TRANSACTIONS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transactionData),
      });

      console.log("RESPONSE STATUS:", response.status);
      console.log("RESPONSE OK:", response.ok);

      const result = await response.json();
      console.log("RESPONSE BODY:", JSON.stringify(result, null, 2));

      if (!response.ok) {
        throw new Error(`Failed to record transaction: ${result.message || "Unknown error"}`);
      }

      console.log("Transaction recorded successfully");
    } catch (error) {
      console.error("Error recording transaction:", error);
      throw error;
    }
  };

  const handleAccept = async () => {
    console.log("Submit clicked for wish:", wishData?.wish_uid);

    if (!helpType) {
      Alert.alert("Please select an option", "Choose either 'I am referring someone else' or 'I can help' before submitting.");
      return;
    }

    if (helpType === "help" && !howICanHelp.trim()) {
      Alert.alert("Please add a note", "Explain why you are perfect for this gig before submitting.");
      return;
    }

    if (helpType === "refer") {
      if (!referralFirstName.trim() || !referralLastName.trim() || !referralEmail.trim()) {
        Alert.alert("Please complete the referral", "First Name, Last Name, and Email Address are required.");
        return;
      }
    }

    try {
      setLoading(true);

      // Get the current user's profile_uid
      const responder_id = await AsyncStorage.getItem("profile_uid");
      if (!responder_id) {
        Alert.alert("Error", "User profile not found. Please try again.");
        setLoading(false);
        return;
      }

      // Get the profile_wish_id from wishData
      const profile_wish_id = wishData?.wish_uid || wishData?.profile_wish_id;
      if (!profile_wish_id) {
        Alert.alert("Error", "Wish information not found. Please try again.");
        setLoading(false);
        return;
      }

      // Prepare the request body
      const requestBody = {
        profile_wish_id: profile_wish_id,
        responder_id: responder_id,
        responder_note: helpType === "help" ? howICanHelp || "I can do this for you!" : referralNote || "",
        help_type: helpType,
      };

      if (helpType === "refer") {
        requestBody.referral_first_name = referralFirstName.trim();
        requestBody.referral_last_name = referralLastName.trim();
        requestBody.referral_email = referralEmail.trim();
        requestBody.referral_phone = referralPhone.trim();
        if (referredProfileUid) {
          requestBody.referral_profile_uid = referredProfileUid;
        }
      }

      // Console log role mapping on every Submit
      const buyerProfileUid = profile_uid; // Seeker - the wish owner
      const referrerProfileUid = responder_id; // Logged in user
      const referredPersonUid = helpType === "refer" ? referredProfileUid : null; // Person searched for (refer flow only)
      console.log("============================================");
      console.log("WISH SUBMIT - ROLE MAPPING:");
      console.log("  Buyer (seeker's profile UID):", buyerProfileUid);
      console.log("  Referrer (logged in user's profile UID):", referrerProfileUid);
      console.log("  Referred person (searched for UID):", referredPersonUid);
      console.log("============================================");

      console.log("============================================");
      console.log("ENDPOINT: PROFILE_WISH_INFO");
      console.log("URL:", PROFILE_WISH_INFO_ENDPOINT);
      console.log("METHOD: POST");
      console.log("REQUEST BODY:", JSON.stringify(requestBody, null, 2));
      console.log("============================================");

      // Make the API call
      const response = await fetch(PROFILE_WISH_INFO_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("RESPONSE STATUS:", response.status);
      console.log("RESPONSE OK:", response.ok);

      const result = await response.json();
      console.log("RESPONSE BODY:", JSON.stringify(result, null, 2));

      if (!response.ok) {
        throw new Error(result.message || "Failed to submit response");
      }

      console.log("Response submitted successfully");
      try {
        await recordWishMessageResponse(profile_wish_id, responder_id);
      } catch (e) {
        console.warn("[WishDetailScreen] recordWishMessageResponse failed:", e);
      }
      Alert.alert("Success", "Your response has been submitted!");

      // Navigate back to Profile if that's where we came from
      if (returnTo === "Profile" && profileState) {
        console.log("🔙 Returning to Profile after submitting wish with preserved state");
        navigation.navigate("Profile", profileState);
      } else if (searchState) {
        // Navigate back to Search page with preserved state
        console.log("🔙 Returning to Search after submitting wish with preserved state");
        navigation.navigate("Search", {
          restoreState: true,
          searchState: searchState,
        });
      } else {
        navigation.navigate("Search");
      }
    } catch (error) {
      console.error("Error submitting response:", error);
      Alert.alert("Error", error.message || "Failed to submit response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    // Return to Profile screen if that's where we came from
    if (returnTo === "Profile" && profileState) {
      console.log("🔙 Returning to Profile with preserved state:", profileState);
      navigation.navigate("Profile", profileState);
    } else if (searchState) {
      // Return to Search screen with preserved state
      console.log("🔙 Returning to Search with preserved state:", searchState);
      navigation.navigate("Search", {
        restoreState: true,
        searchState: searchState,
      });
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={[styles.pageContainer, darkMode && styles.darkPageContainer]}>
      {/* Header with Back Button */}
      <AppHeader title='SEEKING' {...getHeaderColors("search")} onBackPress={handleBack} rightButton={headerCartButton} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* User MiniCard - Clickable */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            console.log("🏢 Navigating to Profile from MiniCard in WishDetail");
            if (profile_uid) {
              navigation.navigate("Profile", {
                profile_uid: profile_uid,
                returnTo: returnTo === "Profile" ? "WishDetail" : "WishDetail",
                wishDetailState: {
                  wishData,
                  profileData,
                  profile_uid,
                  searchState,
                  returnTo,
                  profileState,
                },
              });
            }
          }}
        >
          <View style={[styles.card, darkMode && styles.darkCard]}>
            <MiniCard user={userForMiniCard} />
          </View>
        </TouchableOpacity>

        {/* Wish Description */}
        <View
          style={[
            styles.card,
            darkMode && styles.darkCard,
            seekingTakenDown && (darkMode ? styles.darkTakenDownCard : styles.takenDownCard),
          ]}
        >
          {isOwnWish && seekingModeratedBlocked ? <SeekingModerationBanner item={wishData} darkMode={darkMode} /> : null}

          <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>Seeking Description</Text>

          <ProfileSectionItemImage
            section='seeking'
            imageUri={resolveProfileItemImageUri(wishData?.profile_wish_image, profile_uid)}
            imageIsPublic={wishData?.profile_wish_image_is_public}
            size={180}
            darkMode={darkMode}
            style={styles.wishHeroImage}
            resizeMode='cover'
          />

          {wishData?.title && <Text style={[styles.wishTitle, darkMode && styles.darkWishTitle]}>{wishData.title}</Text>}

          {wishData?.description && <Text style={[styles.wishDescription, darkMode && styles.darkWishDescription]}>{wishData.description}</Text>}

          {/* Wish Details */}
          {wishData?.details && (
            <View style={styles.detailsContainer}>
              <Text style={[styles.detailsTitle, darkMode && styles.darkDetailsTitle]}>Seeking Details</Text>
              <Text style={[styles.detailsText, darkMode && styles.darkDetailsText]}>{wishData.details}</Text>
            </View>
          )}

          <SeekingCardDetails seeking={wishData} darkMode={darkMode} />
        </View>

        {existingResponses.length > 0 && (
          <View style={[styles.card, darkMode && styles.darkCard]}>
            <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>
              {existingResponses.length === 1 ? "Your Response" : "Your Responses"}
              {existingResponses.length === 1 && existingResponses[0].wr_datetime ? ` · ${formatDateForDisplay(existingResponses[0].wr_datetime)}` : ""}
            </Text>
            {existingResponses.map((response, index) => (
              <View
                key={response.wish_response_uid || `${response.wr_datetime || "response"}-${index}`}
                style={[styles.existingResponseEntry, index > 0 && styles.existingResponseEntryBorder, darkMode && index > 0 && styles.darkExistingResponseEntryBorder]}
              >
                {existingResponses.length > 1 && response.wr_datetime ? (
                  <Text style={[styles.existingResponseDate, darkMode && styles.darkExistingResponseDate]}>{formatDateForDisplay(response.wr_datetime)}</Text>
                ) : null}
                <Text style={[styles.existingResponseType, darkMode && styles.darkExistingResponseType]}>{response.wr_type === "refer" ? "I am referring someone else" : "I can help"}</Text>
                {response.wr_responder_note ? (
                  <Text style={[styles.existingResponseNote, darkMode && styles.darkExistingResponseNote]}>{response.wr_responder_note}</Text>
                ) : (
                  <Text style={[styles.existingResponseNote, styles.existingResponseNoteMuted, darkMode && styles.darkExistingResponseNoteMuted]}>No note provided</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Help Type Selection */}
        {!isOwnWish && !seekingModeratedBlocked ? (
        <View style={[styles.card, darkMode && styles.darkCard]}>
          <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>How I Can Help</Text>
          <View style={styles.helpTypeOptions}>
            <TouchableOpacity
              style={[
                styles.helpTypeOption,
                darkMode && styles.darkHelpTypeOption,
                helpType === "refer" && styles.helpTypeOptionSelected,
                darkMode && helpType === "refer" && styles.darkHelpTypeOptionSelected,
              ]}
              onPress={() => setHelpType("refer")}
            >
              <Text
                style={[
                  styles.helpTypeOptionText,
                  darkMode && styles.darkHelpTypeOptionText,
                  helpType === "refer" && styles.helpTypeOptionTextSelected,
                  darkMode && helpType === "refer" && styles.darkHelpTypeOptionTextSelected,
                ]}
              >
                I am referring someone else
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.helpTypeOption,
                darkMode && styles.darkHelpTypeOption,
                helpType === "help" && styles.helpTypeOptionSelected,
                darkMode && helpType === "help" && styles.darkHelpTypeOptionSelected,
              ]}
              onPress={() => setHelpType("help")}
            >
              <Text
                style={[
                  styles.helpTypeOptionText,
                  darkMode && styles.darkHelpTypeOptionText,
                  helpType === "help" && styles.helpTypeOptionTextSelected,
                  darkMode && helpType === "help" && styles.darkHelpTypeOptionTextSelected,
                ]}
              >
                I can help
              </Text>
            </TouchableOpacity>
          </View>

          {helpType === "help" && (
            <>
              <TextInput
                style={[styles.textInput, darkMode && styles.darkTextInput]}
                placeholder='Explain why you are perfect for this gig...'
                placeholderTextColor={darkMode ? "#888" : "#999"}
                multiline
                numberOfLines={6}
                value={howICanHelp}
                onChangeText={setHowICanHelp}
                textAlignVertical='top'
              />
            </>
          )}

          {helpType === "refer" && (
            <>
              <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>Let me refer someone who can help</Text>
              <Text style={[styles.searchSectionHeader, darkMode && styles.darkSearchSectionHeader]}>Search</Text>
              <ReferralSearch
                visible={true}
                embedded={true}
                onSelectUser={(user) => {
                  setReferralFirstName(user.profile_personal_first_name || "");
                  setReferralLastName(user.profile_personal_last_name || "");
                  // Backend returns profile_email_id, profile_personal_email, etc.; populate from whatever is available
                  const email = user.profile_email_id || user.profile_personal_email || user.user_email || user.email || "";
                  const phone = user.profile_personal_phone_number || user.phone || user.phone_number || "";
                  setReferralEmail(email);
                  setReferralPhone(phone);
                  setReferredProfileUid(user.profile_personal_uid || user.profile_uid || null);
                }}
                showNewUserButton={false}
                hideEmptyState={true}
                searchButtonColor={darkMode ? "#3D6B6C" : "#4F8A8B"}
              />
              <Text style={[styles.searchSectionHeader, darkMode && styles.darkSearchSectionHeader]}>Or enter details manually</Text>
              <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>First Name</Text>
              <TextInput
                style={[styles.textInput, styles.singleLineInput, darkMode && styles.darkTextInput]}
                placeholder='First Name'
                placeholderTextColor={darkMode ? "#888" : "#999"}
                value={referralFirstName}
                onChangeText={(t) => {
                  setReferralFirstName(t);
                  setReferredProfileUid(null); // Clear when manually edited
                }}
              />
              <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>Last Name</Text>
              <TextInput
                style={[styles.textInput, styles.singleLineInput, darkMode && styles.darkTextInput]}
                placeholder='Last Name'
                placeholderTextColor={darkMode ? "#888" : "#999"}
                value={referralLastName}
                onChangeText={(t) => {
                  setReferralLastName(t);
                  setReferredProfileUid(null);
                }}
              />
              <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>Email Address</Text>
              <TextInput
                style={[styles.textInput, styles.singleLineInput, darkMode && styles.darkTextInput]}
                placeholder='Email Address'
                placeholderTextColor={darkMode ? "#888" : "#999"}
                keyboardType='email-address'
                autoCapitalize='none'
                value={referralEmail}
                onChangeText={(t) => {
                  setReferralEmail(t);
                  setReferredProfileUid(null);
                }}
              />
              <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>Phone Number</Text>
              <TextInput
                style={[styles.textInput, styles.singleLineInput, darkMode && styles.darkTextInput]}
                placeholder='Phone Number'
                placeholderTextColor={darkMode ? "#888" : "#999"}
                keyboardType='phone-pad'
                value={referralPhone}
                onChangeText={(t) => {
                  setReferralPhone(t);
                  setReferredProfileUid(null);
                }}
              />
              <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>Note</Text>
              <Text style={[styles.helperText, darkMode && styles.darkHelperText]}>This is why I think they would be perfect</Text>
              <TextInput
                style={[styles.textInput, darkMode && styles.darkTextInput]}
                placeholder='This is why I think they would be perfect...'
                placeholderTextColor={darkMode ? "#888" : "#999"}
                multiline
                numberOfLines={4}
                value={referralNote}
                onChangeText={setReferralNote}
                textAlignVertical='top'
              />
            </>
          )}
        </View>
        ) : null}

        {isOwnWish || seekingModeratedBlocked ? (
          <View style={[styles.ownerActionsBlock, darkMode && styles.darkCard]}>
            <Text style={[styles.ownNotice, darkMode && styles.darkOwnNotice]}>
              {seekingAcknowledged
                ? "You acknowledged this take-down. The seeking post has been removed from your profile."
                : seekingTakenDown
                  ? "This seeking post has been taken down. You can view details but cannot edit or receive responses."
                  : seekingModeratedBlocked
                    ? "This seeking post is under moderation review. You can view details but cannot edit or receive responses."
                    : "You cannot respond to your own seeking post."}
            </Text>
            {isOwnWish && canAcknowledge ? (
              <View style={styles.moderationActionRow}>
                <TouchableOpacity
                  style={[styles.moderationActionButton, styles.acknowledgeButton, darkMode && styles.darkAcknowledgeButton, acknowledging && styles.submitButtonDisabled]}
                  onPress={handleAcknowledgeTakeDown}
                  disabled={acknowledging}
                  activeOpacity={0.85}
                >
                  {acknowledging ? (
                    <ActivityIndicator size='small' color='#fff' style={{ marginRight: 6 }} />
                  ) : (
                    <Ionicons name='checkmark-done-outline' size={17} color='#fff' style={{ marginRight: 6 }} />
                  )}
                  <Text style={styles.moderationActionButtonText}>Acknowledge</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.moderationActionButton, styles.termsButton, darkMode && styles.darkTermsButton]}
                  onPress={() => navigation.navigate("TermsAndConditions")}
                  activeOpacity={0.85}
                >
                  <Ionicons name='document-text-outline' size={17} color='#fff' style={{ marginRight: 6 }} />
                  <Text style={styles.moderationActionButtonText}>Terms & Conditions</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : (
        <View style={detailActionRowStyle}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              darkMode && styles.darkSubmitButton,
              (loading || !helpType) && styles.submitButtonDisabled,
            ]}
            onPress={handleAccept}
            disabled={loading || !helpType}
            activeOpacity={0.85}
          >
            <Text style={styles.submitButtonText}>{loading ? "Submitting..." : "Submit"}</Text>
          </TouchableOpacity>
          <DetailFlagButton onPress={() => setShowFlagModal(true)} disabled={!wishUid} />
        </View>
        )}
      </ScrollView>

      <FlagSeekingModal
        visible={showFlagModal}
        onClose={() => setShowFlagModal(false)}
        targetUid={wishUid}
        seekingTitle={seekingTitle}
      />

      <BottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
};

export default function WishDetailScreen({ route, navigation }) {
  return <WishDetailScreenContent route={route} navigation={navigation} />;
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    marginBottom: 15,
    borderRadius: 12,
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.05)",
    ...(Platform.OS !== "web" && { elevation: 2 }),
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  wishHeroImage: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    marginBottom: 12,
  },
  wishTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  wishDescription: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
    marginBottom: 20,
  },
  pricingContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  pricingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  wishBountyContainer: {
    flexDirection: "row",
    alignItems: "center",
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
  bountyEmojiIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  pricingLabel: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  detailsContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  detailsText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  existingResponseType: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4F8A8B",
    marginBottom: 10,
  },
  existingResponseEntry: {
    marginBottom: 4,
  },
  existingResponseEntryBorder: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  existingResponseDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 6,
  },
  existingResponseNote: {
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
  },
  existingResponseNoteMuted: {
    color: "#888",
    fontStyle: "italic",
  },
  submitAtEnd: {
    marginTop: 4,
    marginBottom: 20,
    alignItems: "center",
  },
  submitButton: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: "#4F8A8B",
  },
  darkSubmitButton: {
    backgroundColor: "#3D6B6C",
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  // Dark mode styles
  darkPageContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkCard: {
    backgroundColor: "#2d2d2d",
  },
  darkCardTitle: {
    color: "#fff",
  },
  darkWishTitle: {
    color: "#fff",
  },
  darkWishDescription: {
    color: "#cccccc",
  },
  darkPricingLabel: {
    color: "#cccccc",
  },
  darkDetailsTitle: {
    color: "#fff",
  },
  darkDetailsText: {
    color: "#cccccc",
  },
  darkExistingResponseType: {
    color: "#7eb8b9",
  },
  darkExistingResponseEntryBorder: {
    borderTopColor: "#404040",
  },
  darkExistingResponseDate: {
    color: "#aaa",
  },
  darkExistingResponseNote: {
    color: "#e0e0e0",
  },
  darkExistingResponseNoteMuted: {
    color: "#888",
  },
  textInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333",
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    textAlignVertical: "top",
  },
  singleLineInput: {
    minHeight: 44,
    marginBottom: 12,
  },
  helpTypeOptions: {
    marginBottom: 4,
  },
  helpTypeOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#E5E5E5",
    backgroundColor: "#FAFAFA",
    marginBottom: 12,
  },
  helpTypeOptionSelected: {
    borderColor: getHeaderColor("search"),
    backgroundColor: "rgba(79, 138, 139, 0.15)",
  },
  helpTypeOptionText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  helpTypeOptionTextSelected: {
    color: getHeaderColor("search"),
    fontWeight: "600",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: "#888",
    marginBottom: 6,
    fontStyle: "italic",
  },
  searchSectionHeader: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000",
    letterSpacing: 1,
    backgroundColor: "rgba(79, 138, 139, 0.5)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    marginTop: 12,
  },
  darkTextInput: {
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderColor: "#404040",
  },
  darkHelpTypeOption: {
    borderColor: "#404040",
    backgroundColor: "#1a1a1a",
  },
  darkHelpTypeOptionSelected: {
    borderColor: getDarkModeHeaderColor("search"),
    backgroundColor: "rgba(61, 107, 108, 0.35)",
  },
  darkHelpTypeOptionText: {
    color: "#e0e0e0",
  },
  darkHelpTypeOptionTextSelected: {
    color: getDarkModeHeaderColor("search"),
  },
  darkInputLabel: {
    color: "#e0e0e0",
  },
  darkHelperText: {
    color: "#888",
  },
  darkSearchSectionHeader: {
    backgroundColor: "rgba(61, 107, 108, 0.6)",
    color: "#ffffff",
  },
  takenDownCard: {
    borderWidth: 1,
    borderColor: "#F5C6C6",
    backgroundColor: "#FFFAFA",
  },
  darkTakenDownCard: {
    borderColor: "#664444",
    backgroundColor: "#3a2a2a",
  },
  ownerActionsBlock: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    ...(Platform.OS !== "web" && { elevation: 2 }),
  },
  ownNotice: {
    fontSize: 14,
    lineHeight: 20,
    color: "#555",
    marginBottom: 12,
    textAlign: "center",
  },
  darkOwnNotice: {
    color: "#ccc",
  },
  moderationActionRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  moderationActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  moderationActionButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  acknowledgeButton: {
    backgroundColor: "#18884A",
  },
  darkAcknowledgeButton: {
    backgroundColor: "#2E7D32",
  },
  termsButton: {
    backgroundColor: "#4B2E83",
  },
  darkTermsButton: {
    backgroundColor: "#6A4C9C",
  },
});
