// WishDetailScreen.js
import React, { useState } from "react";
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
import { TRANSACTIONS_ENDPOINT, PROFILE_WISH_INFO_ENDPOINT } from "../apiConfig";
import { resolveProfileItemImageUri } from "../utils/resolveProfileItemImageUri";

const WishDetailScreenContent = ({ route, navigation }) => {
  const { wishData, profileData, profile_uid, searchState, returnTo, profileState } = route.params;
  const { darkMode } = useDarkMode();
  const [loading, setLoading] = useState(false);
  const [helpType, setHelpType] = useState(null); // "help" | "refer"
  const [howICanHelp, setHowICanHelp] = useState("");
  const [referralFirstName, setReferralFirstName] = useState("");
  const [referralLastName, setReferralLastName] = useState("");
  const [referralEmail, setReferralEmail] = useState("");
  const [referralPhone, setReferralPhone] = useState("");
  const [referralNote, setReferralNote] = useState("");
  const [referredProfileUid, setReferredProfileUid] = useState(null); // Seller - the person being referred (can help)

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
      <AppHeader title='SEEKING' {...getHeaderColors("search")} onBackPress={handleBack} />

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
        <View style={[styles.card, darkMode && styles.darkCard]}>
          <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>Seeking Description</Text>

          {wishData?.profile_wish_image &&
          String(wishData.profile_wish_image).trim() &&
          (wishData?.profile_wish_image_is_public === 1 ||
            wishData?.profile_wish_image_is_public === "1" ||
            wishData?.profile_wish_image_is_public === undefined) ? (
            <Image
              source={{ uri: resolveProfileItemImageUri(wishData.profile_wish_image, profile_uid) }}
              style={[styles.wishHeroImage, { backgroundColor: darkMode ? "#333" : "#eee" }]}
              resizeMode='cover'
            />
          ) : null}

          {wishData?.title && <Text style={[styles.wishTitle, darkMode && styles.darkWishTitle]}>{wishData.title}</Text>}

          {wishData?.description && <Text style={[styles.wishDescription, darkMode && styles.darkWishDescription]}>{wishData.description}</Text>}

          {/* Wish Details */}
          {wishData?.details && (
            <View style={styles.detailsContainer}>
              <Text style={[styles.detailsTitle, darkMode && styles.darkDetailsTitle]}>Seeking Details</Text>
              <Text style={[styles.detailsText, darkMode && styles.darkDetailsText]}>{wishData.details}</Text>
            </View>
          )}

          {/* Cost and Bounty */}
          {(wishData?.cost || wishData?.profile_wish_cost || wishData?.bounty) && (
            <View style={styles.pricingContainer}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flex: 1 }}>
                {(wishData?.cost || wishData?.profile_wish_cost) && (
                  <View style={styles.wishBountyContainer}>
                    <View style={styles.moneyBagIconContainer}>
                      <Text style={styles.moneyBagDollarSymbol}>$</Text>
                    </View>
                    <Text style={[styles.pricingLabel, darkMode && styles.darkPricingLabel]}>
                      Cost: {wishData?.profile_wish_cost_currency ? `${wishData.profile_wish_cost_currency} ` : ""}
                      {wishData?.cost || wishData?.profile_wish_cost}
                    </Text>
                  </View>
                )}
                {wishData?.bounty && (
                  <View style={styles.pricingRow}>
                    <Text style={styles.bountyEmojiIcon}>💰</Text>
                    <Text style={[styles.pricingLabel, darkMode && styles.darkPricingLabel]}>Bounty: USD {wishData.bounty}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Help Type Selection */}
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
                  const email =
                    user.profile_email_id ||
                    user.profile_personal_email ||
                    user.user_email ||
                    user.email ||
                    "";
                  const phone =
                    user.profile_personal_phone_number ||
                    user.phone ||
                    user.phone_number ||
                    "";
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

        <View style={styles.submitAtEnd}>
          <TouchableOpacity
            style={[styles.acceptButton, darkMode && styles.darkAcceptButton, (loading || !helpType) && styles.disabledButton]}
            onPress={handleAccept}
            disabled={loading || !helpType}
          >
            <Text style={styles.acceptButtonText}>{loading ? "Submitting..." : "Submit"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
  submitAtEnd: {
    marginTop: 4,
    marginBottom: 20,
    alignItems: "center",
  },
  acceptButton: {
    backgroundColor: "#4F8A8B",
    borderRadius: 30,
    paddingVertical: 15,
    paddingHorizontal: 40,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    minWidth: 200,
  },
  acceptButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
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
  darkAcceptButton: {
    backgroundColor: "#3D6B6C",
  },
  disabledButton: {
    opacity: 0.6,
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
});
