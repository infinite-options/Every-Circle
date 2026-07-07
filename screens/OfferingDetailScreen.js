import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from "react-native";
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

const OfferingDetailScreenContent = ({ route, navigation }) => {
  const { expertiseData, profileData, profile_uid, searchState, returnTo, profileState } = route.params || {};
  const { darkMode } = useDarkMode();
  const [currentProfileUid, setCurrentProfileUid] = useState(null);
  const [showCartModal, setShowCartModal] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("profile_uid").then((uid) => setCurrentProfileUid(uid));
  }, []);

  const isOwnExpertise = currentProfileUid && profile_uid === currentProfileUid;
  const offeringTitle = expertiseData?.title ? String(expertiseData.title).trim() : "";
  const expertiseUid = String(expertiseData?.expertise_uid || "").trim();
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

  const handleAddToCartConfirm = async (modalData) => {
    if (!expertiseData?.expertise_uid || !profile_uid) {
      Alert.alert("Error", "Missing offering or seller information.");
      setShowCartModal(false);
      return;
    }
    try {
      const { quantity: qty, escrow, subtotal, totalWithFee } = modalData;
      const cartKey = `cart_expertise_${expertiseData.expertise_uid}`;
      const sellerDisplayName = [profileData?.firstName, profileData?.lastName].filter(Boolean).join(" ").trim();
      const cartItem = {
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
        totalWithFee,
        cart_key: cartKey,
        addedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(cartKey, JSON.stringify(cartItem));
      setShowCartModal(false);
      Alert.alert("Added to Cart", `${expertiseData?.title || "Item"} (x${qty}) has been added to your cart.`, [
        { text: "Continue Browsing", style: "cancel" },
        {
          text: "View Cart",
          onPress: () =>
            navigation.navigate("ShoppingCart", {
              cartItems: [cartItem],
              businessName: "Expertise",
              business_uid: profile_uid,
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
      <AppHeader title='OFFERING' {...getHeaderColors("offeringDetail")} onBackPress={handleBack} />

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

        <View style={[styles.card, darkMode && styles.darkCard]}>
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

        {isOwnExpertise ? (
          <Text style={[styles.ownNotice, darkMode && styles.darkOwnNotice]}>You cannot purchase your own expertise.</Text>
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.messageButton, darkMode && styles.darkMessageButton, !profile_uid && styles.actionDisabled]}
              onPress={handleMessagePress}
              disabled={!profile_uid}
              activeOpacity={0.85}
            >
              <Ionicons name='chatbubble-ellipses-outline' size={17} color='#fff' style={{ marginRight: 7 }} />
              <Text style={styles.actionButtonText}>Messaging</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cartButton, darkMode && styles.darkCartButton, !expertiseUid && styles.actionDisabled]}
              onPress={() => setShowCartModal(true)}
              disabled={!expertiseUid}
              activeOpacity={0.85}
            >
              <Ionicons name='cart-outline' size={20} color='#fff' style={{ marginRight: 6 }} />
              <Text style={styles.actionButtonText}>Add to Cart</Text>
            </TouchableOpacity>
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
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    marginTop: 4,
    marginBottom: 20,
  },
  messageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#AF52DE",
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 24,
    minWidth: 192,
  },
  darkMessageButton: {
    backgroundColor: "#8f47b5",
  },
  cartButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C7BE",
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 24,
    minWidth: 192,
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
  ownNotice: {
    fontSize: 13,
    color: "#6e1010",
    fontStyle: "italic",
    marginTop: 4,
    marginBottom: 20,
    textAlign: "center",
  },
  darkOwnNotice: {
    color: "#e8a0a0",
  },
  darkPageContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkCard: {
    backgroundColor: "#2d2d2d",
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
