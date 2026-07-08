import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MiniCard from "../components/MiniCard";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import ProfileSectionItemImage from "../components/ProfileSectionItemImage";
import OfferingCardDetails from "../components/OfferingCardDetails";
import AddToCartDetailsModal from "../components/AddToCartDetailsModal";
import { useDarkMode } from "../contexts/DarkModeContext";
import { getHeaderColors } from "../config/headerColors";
import { resolveProfileItemImageUri } from "../utils/resolveProfileItemImageUri";
import { recordOfferingMessageResponse } from "../utils/offeringMessageResponse";
import { buildOfferingReplyContext } from "../utils/chatReplyContext";
import DetailFlagButton, { detailActionRowStyle } from "../components/DetailFlagButton";
import FlagOfferingModal from "../components/FlagOfferingModal";
import OfferingModerationBanner from "../components/OfferingModerationBanner";
import { useHeaderCart } from "../components/HeaderCartButton";
import {
  acknowledgeOfferingModeration,
  canAcknowledgeTakenDownOffering,
  getOfferingModeratedState,
  isOfferingModeratedBlocked,
  MODERATED_ACKNOWLEDGED,
  MODERATED_TAKEN_DOWN,
} from "../utils/offeringModeration";
import { expertiseCartPersistedFields } from "../utils/offeringCartUtils";
import { upsertExpertiseCartItem } from "../utils/expertiseCartStorage";

const OfferingDetailScreenContent = ({ route, navigation }) => {
  const { expertiseData: initialExpertiseData, profileData, profile_uid, searchState, returnTo, profileState } = route.params || {};
  const { darkMode } = useDarkMode();
  const { refreshCart, headerCartButton } = useHeaderCart(navigation, { returnTo: "Search", searchState });
  const [currentProfileUid, setCurrentProfileUid] = useState(null);
  const [showCartModal, setShowCartModal] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [expertiseData, setExpertiseData] = useState(initialExpertiseData);
  const [acknowledging, setAcknowledging] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("profile_uid").then((uid) => setCurrentProfileUid(uid));
  }, []);

  useEffect(() => {
    setExpertiseData(initialExpertiseData);
  }, [initialExpertiseData]);

  const isOwnExpertise = currentProfileUid && profile_uid === currentProfileUid;
  const moderatedState = getOfferingModeratedState(expertiseData);
  const offeringTakenDown = moderatedState === MODERATED_TAKEN_DOWN;
  const offeringAcknowledged = moderatedState === MODERATED_ACKNOWLEDGED;
  const offeringModeratedBlocked = isOfferingModeratedBlocked(expertiseData);
  const canAcknowledge = isOwnExpertise && canAcknowledgeTakenDownOffering(expertiseData);
  const offeringTitle = expertiseData?.title ? String(expertiseData.title).trim() : "";
  const expertiseUid = String(expertiseData?.expertise_uid || expertiseData?.profile_expertise_uid || "").trim();
  const offeringImageUri = resolveProfileItemImageUri(expertiseData?.profile_expertise_image, profile_uid);

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

  const handleBack = () => {
    if (returnTo === "Profile" && profileState) {
      navigation.navigate("Profile", profileState);
    } else if (searchState) {
      navigation.navigate("Search", {
        restoreState: true,
        searchState,
      });
    } else {
      navigation.goBack();
    }
  };

  const handleMessagePress = async () => {
    if (!profile_uid) return;
    const offeringLabel = offeringTitle || "Offering";
    const responderUid = (currentProfileUid || (await AsyncStorage.getItem("profile_uid")) || "").trim();
    let expertiseResponseUid = null;
    if (expertiseUid && responderUid && profile_uid !== responderUid) {
      const recordResult = await recordOfferingMessageResponse(expertiseUid, responderUid);
      expertiseResponseUid = recordResult?.expertise_response_uid || null;
    }
    navigation.navigate("Chat", {
      other_uid: profile_uid,
      other_name: [profileData?.firstName, profileData?.lastName].filter(Boolean).join(" ").trim() || "Chat",
      other_image: profileData?.imageIsPublic && profileData?.image && String(profileData.image).trim() !== "" ? String(profileData.image) : null,
      reply_context: buildOfferingReplyContext({
        label: `Offering: ${offeringLabel}`,
        profileExpertiseUid: expertiseUid,
        expertiseResponseUid,
      }),
    });
  };

  const navigateAfterAcknowledge = () => {
    if (returnTo === "Profile" && profileState) {
      navigation.navigate("Profile", profileState);
    } else if (searchState) {
      navigation.navigate("Search", {
        restoreState: true,
        searchState,
      });
    } else {
      navigation.goBack();
    }
  };

  const submitAcknowledgeTakeDown = async () => {
    if (acknowledging) return;
    setAcknowledging(true);
    try {
      const result = await acknowledgeOfferingModeration({
        profileExpertiseUid: expertiseUid,
        profileUid: profile_uid || currentProfileUid,
      });
      setExpertiseData((prev) => ({
        ...prev,
        profile_expertise_moderated: MODERATED_ACKNOWLEDGED,
        moderation: {
          ...(prev?.moderation || {}),
          moderated: MODERATED_ACKNOWLEDGED,
          status: "acknowledged",
        },
      }));
      const already = result?.already_acknowledged === true || result?.data?.already_acknowledged === true;
      const doneTitle = already ? "Already acknowledged" : "Acknowledged";
      const doneMessage = already
        ? "This offering was already acknowledged and has been removed from your profile."
        : "This offering has been acknowledged and removed from your profile.";
      // Web: Alert.alert button callbacks are unreliable — navigate after a simple alert/confirm.
      if (Platform.OS === "web") {
        window.alert(doneMessage);
        navigateAfterAcknowledge();
      } else {
        Alert.alert(doneTitle, doneMessage, [{ text: "OK", onPress: navigateAfterAcknowledge }]);
      }
    } catch (error) {
      console.error("OfferingDetailScreen - acknowledge failed:", error);
      const message = error?.message || "Failed to acknowledge offering. Please try again.";
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setAcknowledging(false);
    }
  };

  const handleAcknowledgeTakeDown = () => {
    if (!canAcknowledge || acknowledging) return;
    const confirmMessage =
      "By acknowledging, you confirm you understand this offering was removed for violating our policies. It will be removed from your profile.";
    // On web, Alert.alert multi-button onPress does not fire — same pattern as Settings logout.
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

  const handleAddToCartConfirm = async (modalData) => {
    if (!expertiseData?.expertise_uid || !profile_uid) {
      Alert.alert("Error", "Missing offering or seller information.");
      setShowCartModal(false);
      return;
    }
    try {
      const { quantity: qty, escrow, subtotal, totalWithFee, taxAmount, taxRatePct } = modalData;
      const cartKey = `cart_expertise_${expertiseData.expertise_uid}`;
      const sellerDisplayName = [profileData?.firstName, profileData?.lastName].filter(Boolean).join(" ").trim();
      const cartItemDraft = {
        expertise_uid: expertiseData.expertise_uid,
        title: expertiseData.title,
        description: expertiseData.description,
        cost: expertiseData.cost,
        bounty: expertiseData.bounty,
        profile_uid,
        profileData,
        business_name: sellerDisplayName || "",
        itemType: "expertise",
        quantity: qty,
        escrow,
        subtotal,
        taxAmount,
        totalWithFee,
        ...expertiseCartPersistedFields(expertiseData, { taxRatePct }),
        cart_key: cartKey,
        addedAt: new Date().toISOString(),
      };
      const { cartItem, addedQty, mergedQty, capped, maxQty } = await upsertExpertiseCartItem(cartItemDraft);
      await refreshCart();
      setShowCartModal(false);
      const title = expertiseData?.title || "Item";
      const alertMessage = capped && maxQty != null
        ? `Only ${maxQty} available. ${title} is now at ${mergedQty} in your cart (added ${addedQty}).`
        : `${title}: added ${addedQty} — ${mergedQty} now in your cart.`;
      Alert.alert("Added to Cart", alertMessage, [
        { text: "Continue Browsing", style: "cancel" },
        {
          text: "View Cart",
          onPress: () =>
            navigation.navigate("ShoppingCart", {
              cartItems: [cartItem],
              businessName: "Expertise",
              business_uid: profile_uid,
              returnTo: "Search",
              ...(searchState ? { searchState } : {}),
            }),
        },
      ]);
    } catch (error) {
      console.error("OfferingDetailScreen - add to cart failed:", error);
      Alert.alert("Error", "Failed to add to cart. Please try again.");
    }
  };

  return (
    <SafeAreaView style={[styles.pageContainer, darkMode && styles.darkPageContainer]}>
      <AppHeader title='OFFERING' {...getHeaderColors("offeringDetail")} onBackPress={handleBack} rightButton={headerCartButton} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (profile_uid) {
              navigation.navigate("Profile", {
                profile_uid,
                returnTo: returnTo === "Profile" ? "OfferingDetail" : "OfferingDetail",
                offeringDetailState: {
                  expertiseData,
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

        <View
          style={[
            styles.card,
            darkMode && styles.darkCard,
            offeringTakenDown && (darkMode ? styles.darkTakenDownCard : styles.takenDownCard),
          ]}
        >
          {isOwnExpertise && offeringModeratedBlocked ? <OfferingModerationBanner item={expertiseData} darkMode={darkMode} /> : null}

          <Text style={[styles.cardTitle, darkMode && styles.darkCardTitle]}>Offering Description</Text>

          <ProfileSectionItemImage
            section='offering'
            imageUri={offeringImageUri}
            imageIsPublic={expertiseData?.profile_expertise_image_is_public}
            size={180}
            darkMode={darkMode}
            style={styles.heroImage}
            resizeMode='cover'
          />

          {offeringTitle ? <Text style={[styles.offeringTitle, darkMode && styles.darkOfferingTitle]}>{offeringTitle}</Text> : null}

          {expertiseData?.description ? <Text style={[styles.offeringDescription, darkMode && styles.darkOfferingDescription]}>{expertiseData.description}</Text> : null}

          {expertiseData?.details ? (
            <View style={styles.detailsContainer}>
              <Text style={[styles.detailsTitle, darkMode && styles.darkDetailsTitle]}>Offering Details</Text>
              <Text style={[styles.detailsText, darkMode && styles.darkDetailsText]}>{expertiseData.details}</Text>
            </View>
          ) : null}

          <OfferingCardDetails offering={expertiseData} darkMode={darkMode} variant='detail' />
        </View>

        {isOwnExpertise || offeringModeratedBlocked ? (
          <View style={styles.ownerActionsBlock}>
            <Text style={[styles.ownNotice, darkMode && styles.darkOwnNotice]}>
              {offeringAcknowledged
                ? "You acknowledged this take-down. The offering has been removed from your profile."
                : offeringTakenDown
                  ? "This offering has been taken down. You can view details but cannot edit or sell it."
                  : offeringModeratedBlocked
                    ? "This offering is under moderation review. You can view details but cannot edit or sell it."
                    : "You cannot purchase your own expertise."}
            </Text>
            {isOwnExpertise && canAcknowledge ? (
              <View style={styles.moderationActionRow}>
                <TouchableOpacity
                  style={[styles.moderationActionButton, styles.acknowledgeButton, darkMode && styles.darkAcknowledgeButton, acknowledging && styles.actionDisabled]}
                  onPress={handleAcknowledgeTakeDown}
                  disabled={acknowledging}
                  activeOpacity={0.85}
                >
                  {acknowledging ? (
                    <ActivityIndicator size='small' color='#fff' style={styles.actionIcon} />
                  ) : (
                    <Ionicons name='checkmark-done-outline' size={17} color='#fff' style={styles.actionIcon} />
                  )}
                  <Text style={styles.actionButtonText} numberOfLines={1}>
                    Acknowledge
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.moderationActionButton, styles.termsButton, darkMode && styles.darkTermsButton]}
                  onPress={() => navigation.navigate("TermsAndConditions")}
                  activeOpacity={0.85}
                >
                  <Ionicons name='document-text-outline' size={17} color='#fff' style={styles.actionIcon} />
                  <Text style={styles.actionButtonText} numberOfLines={1}>
                    Terms & Conditions
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={detailActionRowStyle}>
            <TouchableOpacity
              style={[styles.actionButton, styles.messageButton, darkMode && styles.darkMessageButton, !profile_uid && styles.actionDisabled]}
              onPress={handleMessagePress}
              disabled={!profile_uid}
              activeOpacity={0.85}
            >
              <Ionicons name='chatbubble-ellipses-outline' size={17} color='#fff' style={styles.actionIcon} />
              <Text style={styles.actionButtonText} numberOfLines={1}>
                Messaging
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cartButton, darkMode && styles.darkCartButton, !expertiseUid && styles.actionDisabled]}
              onPress={() => setShowCartModal(true)}
              disabled={!expertiseUid}
              activeOpacity={0.85}
            >
              <Ionicons name='cart-outline' size={20} color='#fff' style={styles.actionIcon} />
              <Text style={styles.actionButtonText} numberOfLines={1}>
                Add to Cart
              </Text>
            </TouchableOpacity>
            <DetailFlagButton onPress={() => setShowFlagModal(true)} disabled={!expertiseUid} />
          </View>
        )}
      </ScrollView>

      <AddToCartDetailsModal
        show={showCartModal}
        setShow={setShowCartModal}
        expertiseData={expertiseData}
        profileData={profileData}
        onAddToCart={handleAddToCartConfirm}
        onCancel={() => setShowCartModal(false)}
      />

      <FlagOfferingModal
        visible={showFlagModal}
        onClose={() => setShowFlagModal(false)}
        targetUid={expertiseUid}
        offeringTitle={offeringTitle}
      />

      <BottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
};

export default function OfferingDetailScreen({ route, navigation }) {
  return <OfferingDetailScreenContent route={route} navigation={navigation} />;
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
  heroImage: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    marginBottom: 12,
  },
  offeringTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  offeringDescription: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
    marginBottom: 12,
  },
  detailsContainer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    marginBottom: 4,
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
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 24,
  },
  actionIcon: {
    marginRight: 6,
  },
  messageButton: {
    backgroundColor: "#AF52DE",
  },
  darkMessageButton: {
    backgroundColor: "#8f47b5",
  },
  cartButton: {
    backgroundColor: "#00C7BE",
  },
  darkCartButton: {
    backgroundColor: "#009e98",
  },
  actionDisabled: {
    opacity: 0.45,
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  ownerActionsBlock: {
    marginTop: 4,
    marginBottom: 20,
  },
  ownNotice: {
    fontSize: 13,
    color: "#6e1010",
    fontStyle: "italic",
    textAlign: "center",
  },
  darkOwnNotice: {
    color: "#e8a0a0",
  },
  moderationActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 14,
  },
  moderationActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    minWidth: 150,
  },
  acknowledgeButton: {
    backgroundColor: "#B71C1C",
  },
  darkAcknowledgeButton: {
    backgroundColor: "#8B4545",
  },
  termsButton: {
    backgroundColor: "#AF52DE",
  },
  darkTermsButton: {
    backgroundColor: "#8f47b5",
  },
  darkPageContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkCard: {
    backgroundColor: "#2d2d2d",
  },
  takenDownCard: {
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#E57373",
  },
  darkTakenDownCard: {
    backgroundColor: "#3a2a2a",
    borderWidth: 1,
    borderColor: "#8B4545",
  },
  darkCardTitle: {
    color: "#fff",
  },
  darkOfferingTitle: {
    color: "#fff",
  },
  darkOfferingDescription: {
    color: "#cccccc",
  },
  darkDetailsTitle: {
    color: "#fff",
  },
  darkDetailsText: {
    color: "#cccccc",
  },
});
