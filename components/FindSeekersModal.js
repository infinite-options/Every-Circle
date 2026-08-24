import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDarkMode } from "../contexts/DarkModeContext";
import { WISHES_RESULTS_ENDPOINT, SEARCH_RESULT_LIMIT } from "../apiConfig";
import { fetchMiddleware as fetch } from "../utils/httpMiddleware";
import { sanitizeText } from "../utils/textSanitizer";
import { isWishEnded } from "../utils/wishUtils";
import { isSeekingModeratedBlocked } from "../utils/seekingModeration";
import { pickSeekingListingCommerceFields } from "../utils/wishResubmission";

const isWeb = typeof window !== "undefined" && typeof document !== "undefined";

function isOwnerProfileBlocked(item) {
  const moderated = item?.profile_personal_moderated ?? item?.owner_profile_moderated;
  if (moderated == null || moderated === "") return false;
  const n = Number(moderated);
  return n === 1 || n === 3;
}

function shouldIncludeWishRow(item) {
  const qty = item?.profile_wish_quantity;
  if (qty != null && qty !== "" && parseInt(qty, 10) === 0) return false;
  if (isSeekingModeratedBlocked(item)) return false;
  if (isOwnerProfileBlocked(item)) return false;
  return true;
}

function mapWishRow(item, i) {
  return {
    id: `${item.profile_wish_uid || i}`,
    score: item.score || 0,
    search_result_category: item.search_result_category || null,
    passes_relevance_cutoff: item.passes_relevance_cutoff !== false,
    profile_uid: item.profile_wish_profile_personal_id,
    profile_wish_end: item.profile_wish_end || "",
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
      profile_wish_zip: item.profile_wish_zip || "",
      profile_wish_mode: item.profile_wish_mode || "",
      profile_wish_bounty_type: item.profile_wish_bounty_type || (item.profile_wish_bounty ? "per_item" : "none"),
      ...pickSeekingListingCommerceFields(item),
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

function passesRelevanceCutoff(item) {
  if (item.search_result_category) {
    return item.search_result_category !== "other";
  }
  if (item.passes_relevance_cutoff === false) return false;
  return true;
}

/**
 * Searches public seeking posts that match an offering title, and lists people who need it.
 */
const FindSeekersModal = ({ visible, onClose, offeringTitle, excludeProfileUid, navigation }) => {
  const { darkMode } = useDarkMode();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);

  const titleLabel = sanitizeText(offeringTitle) || "this offering";

  useEffect(() => {
    if (!visible) {
      setLoading(false);
      setError("");
      setResults([]);
      setSearched(false);
      return;
    }

    const query = String(offeringTitle || "").trim();
    if (!query) {
      setError("No offering title to search.");
      setSearched(true);
      setResults([]);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");
      setResults([]);
      setSearched(false);
      try {
        const apiUrl = `${WISHES_RESULTS_ENDPOINT}?q=${encodeURIComponent(query)}&limit=${SEARCH_RESULT_LIMIT}`;
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`Search failed (${response.status})`);
        }
        const data = await response.json();
        const rows = Array.isArray(data) ? data : data?.results || data?.wishes || [];
        const exclude = String(excludeProfileUid || "").trim();
        const mapped = rows
          .filter(shouldIncludeWishRow)
          .map((item, i) => mapWishRow(item, i))
          .filter((item) => !isWishEnded(item))
          .filter((item) => passesRelevanceCutoff(item))
          .filter((item) => !exclude || String(item.profile_uid || "").trim() !== exclude);

        if (!cancelled) {
          setResults(mapped);
          setSearched(true);
        }
      } catch (e) {
        console.warn("[FindSeekersModal] search failed:", e);
        if (!cancelled) {
          setError(e?.message || "Could not find matching seekers.");
          setResults([]);
          setSearched(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [visible, offeringTitle, excludeProfileUid]);

  const handleClose = () => {
    if (loading) return;
    onClose?.();
  };

  const openWish = (item) => {
    if (!item?.profile_uid || !item?.wishData || !navigation) return;
    onClose?.();
    navigation.navigate("WishDetail", {
      wishData: item.wishData,
      profileData: item.profileData,
      profile_uid: item.profile_uid,
      returnTo: "Profile",
    });
  };

  const openProfile = (item) => {
    if (!item?.profile_uid || !navigation) return;
    onClose?.();
    navigation.navigate("Profile", {
      profile_uid: item.profile_uid,
      returnTo: "Profile",
    });
  };

  const renderItem = ({ item }) => {
    const name = `${item.profileData?.firstName || ""} ${item.profileData?.lastName || ""}`.trim() || "Someone";
    const wishTitle = sanitizeText(item.wishData?.title) || "Untitled seeking";
    const wishDesc = sanitizeText(item.wishData?.description);
    const imageUri =
      item.profileData?.imageIsPublic && item.profileData?.image ? String(item.profileData.image).trim() : "";

    return (
      <TouchableOpacity
        style={[styles.resultRow, darkMode && styles.resultRowDark]}
        onPress={() => openWish(item)}
        activeOpacity={0.75}
        accessibilityRole='button'
        accessibilityLabel={`View seeking: ${wishTitle} by ${name}`}
      >
        <TouchableOpacity onPress={() => openProfile(item)} activeOpacity={0.7} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
          <Image
            source={imageUri ? { uri: imageUri } : require("../assets/profile.png")}
            style={styles.avatar}
            defaultSource={require("../assets/profile.png")}
          />
        </TouchableOpacity>
        <View style={styles.resultTextCol}>
          <Text style={[styles.personName, darkMode && styles.personNameDark]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.wishTitle, darkMode && styles.wishTitleDark]} numberOfLines={2}>
            {wishTitle}
          </Text>
          {wishDesc ? (
            <Text style={[styles.wishDesc, darkMode && styles.wishDescDark]} numberOfLines={2}>
              {wishDesc}
            </Text>
          ) : null}
        </View>
        <Ionicons name='chevron-forward' size={18} color={darkMode ? "#aaa" : "#888"} />
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={[styles.box, darkMode && styles.boxDark]}>
          <View style={[styles.header, darkMode && styles.headerDark]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.headerTitle, darkMode && styles.headerTitleDark]}>People seeking this</Text>
              <Text style={[styles.subtitle, darkMode && styles.subtitleDark]} numberOfLines={2}>
                Matches for “{titleLabel}”
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel='Close'>
              <Ionicons name='close' size={22} color={darkMode ? "#fff" : "#333"} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centeredBody}>
              <ActivityIndicator size='large' color={darkMode ? "#c77dff" : "#9C45F7"} />
              <Text style={[styles.statusText, darkMode && styles.statusTextDark]}>Searching…</Text>
            </View>
          ) : error ? (
            <View style={styles.centeredBody}>
              <Ionicons name='alert-circle-outline' size={36} color={darkMode ? "#ff8a80" : "#B71C1C"} />
              <Text style={[styles.statusText, darkMode && styles.statusTextDark]}>{error}</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              keyboardShouldPersistTaps='handled'
              contentContainerStyle={results.length === 0 ? styles.emptyListContent : styles.listContent}
              ListEmptyComponent={
                searched ? (
                  <View style={styles.centeredBody}>
                    <Ionicons name='people-outline' size={36} color={darkMode ? "#888" : "#999"} />
                    <Text style={[styles.statusText, darkMode && styles.statusTextDark]}>No one is seeking this right now.</Text>
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  box: {
    width: isWeb ? 440 : "92%",
    maxWidth: 480,
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  boxDark: {
    backgroundColor: "#2a2a2a",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerDark: {
    borderBottomColor: "#444",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#333",
  },
  headerTitleDark: {
    color: "#fff",
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  subtitleDark: {
    color: "#bbb",
  },
  listContent: {
    paddingVertical: 6,
    paddingBottom: 16,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  centeredBody: {
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 160,
  },
  statusText: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
  },
  statusTextDark: {
    color: "#ccc",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e8e8e8",
    gap: 10,
  },
  resultRowDark: {
    borderBottomColor: "#444",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#eee",
  },
  resultTextCol: {
    flex: 1,
    minWidth: 0,
  },
  personName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
    marginBottom: 2,
  },
  personNameDark: {
    color: "#fff",
  },
  wishTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#444",
  },
  wishTitleDark: {
    color: "#ddd",
  },
  wishDesc: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },
  wishDescDark: {
    color: "#999",
  },
});

export default FindSeekersModal;
