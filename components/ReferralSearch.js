// components/ReferralSearch.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList, ActivityIndicator, StyleSheet, Platform, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { searchReferralProfiles } from "../utils/searchReferralProfiles";
import MicroCard from "./MicroCard";
import { getPersonalDisplayFlags } from "../utils/profileAudience";

const SEARCH_DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;
/** Fixed results panel height so the popup does not resize when matches appear. */
const RESULTS_AREA_HEIGHT = Math.min(320, Math.round(Dimensions.get("window").height * 0.42));
const MODAL_HEIGHT = Math.min(560, Math.round(Dimensions.get("window").height * 0.88));

function referralProfileToMicroCardUser(item, relationship) {
  const imageUrl = item.profile_personal_image ? String(item.profile_personal_image).trim() : "";
  const flags = getPersonalDisplayFlags(item);

  return {
    firstName: item.profile_personal_first_name || "",
    lastName: item.profile_personal_last_name || "",
    tagLine: item.profile_personal_tag_line || item.profile_personal_tagline || "",
    tagLineIsPublic: flags.tagLineIsPublic || Boolean(item.profile_personal_tag_line || item.profile_personal_tagline),
    profileImage: imageUrl,
    imageIsPublic: flags.imageIsPublic || Boolean(imageUrl),
    circle_relationship: relationship || null,
  };
}

const ReferralSearch = ({
  visible,
  onSelect,
  onNewUser,
  onClose,
  embedded = false,
  onSelectUser,
  showNewUserButton = true,
  instructionText = "Type at least 2 characters to see matching people",
  hideEmptyState = false,
  searchButtonColor,
  modalTitle = "Who referred you?",
  helperText,
  searchPlaceholder = "Name, email, or location",
  noResultsSubtext = "Try a different name or location",
  networkData = [],
  preparingNetwork = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef(null);
  const searchRequestIdRef = useRef(0);

  const resetSearchState = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    searchRequestIdRef.current += 1;
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
    setIsSearching(false);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Clear when standalone modal closes so the next open starts fresh.
  useEffect(() => {
    if (!embedded && !visible) {
      resetSearchState();
    }
  }, [embedded, visible, resetSearchState]);

  const runSearch = useCallback(async (rawQuery) => {
    const query = String(rawQuery || "").trim();
    if (query.length < MIN_QUERY_LENGTH) {
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    setIsSearching(true);
    setHasSearched(true);

    try {
      const results = await searchReferralProfiles(query);
      if (requestId !== searchRequestIdRef.current) return;
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching referrals:", error);
      if (requestId !== searchRequestIdRef.current) return;
      setSearchResults([]);
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setIsSearching(false);
      }
    }
  }, []);

  const handleQueryChange = useCallback(
    (text) => {
      setSearchQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      const trimmed = String(text || "").trim();
      if (trimmed.length < MIN_QUERY_LENGTH) {
        searchRequestIdRef.current += 1;
        setSearchResults([]);
        setHasSearched(false);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      debounceRef.current = setTimeout(() => {
        runSearch(text);
      }, SEARCH_DEBOUNCE_MS);
    },
    [runSearch],
  );

  const handleSelectUser = (user) => {
    if (onSelectUser) {
      onSelectUser(user);
    } else if (onSelect) {
      onSelect(user.profile_personal_uid, user.profile_personal_user_id);
    }
    resetSearchState();
  };

  const renderUserItem = ({ item }) => {
    const existingConnection = networkData.find((n) => n.network_profile_personal_uid === item.profile_personal_uid);
    const relationship = existingConnection?.circle_relationship;
    const degree = existingConnection?.degree;
    const hasNetworkMeta = Boolean(relationship || degree);

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => handleSelectUser(item)}
        accessibilityRole='button'
        accessibilityLabel={`Select ${item.profile_personal_first_name || ""} ${item.profile_personal_last_name || ""}`.trim()}
      >
        <View style={styles.cardWrap}>
          <MicroCard
            user={referralProfileToMicroCardUser(item, relationship)}
            embedded
            showRelationship={Boolean(relationship)}
            relationshipMeta={degree ? `Level ${degree}` : null}
          />
        </View>
        {!hasNetworkMeta ? <Ionicons name='chevron-forward' size={18} color='#999' /> : null}
      </TouchableOpacity>
    );
  };

  const searchField = (
    <View style={styles.searchContainer}>
      <Ionicons
        name='search'
        size={20}
        color='#666'
        style={styles.searchIcon}
        importantForAccessibility='no'
        {...(Platform.OS === "web" ? { "aria-hidden": true } : { accessible: false })}
      />
      <TextInput
        style={styles.searchInput}
        placeholder={searchPlaceholder}
        value={searchQuery}
        onChangeText={handleQueryChange}
        onSubmitEditing={() => runSearch(searchQuery)}
        autoCapitalize='none'
        autoCorrect={false}
        keyboardType={searchPlaceholder.toLowerCase().includes("email") ? "email-address" : "default"}
        accessibilityLabel={searchPlaceholder}
        accessibilityHint='Results update as you type'
        accessibilityRole='search'
        returnKeyType='search'
      />
      {searchQuery.length > 0 ? (
        <TouchableOpacity
          onPress={() => handleQueryChange("")}
          style={styles.clearButton}
          accessibilityRole='button'
          accessibilityLabel='Clear search'
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name='close-circle' size={20} color='#999' />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const resultsBlock = (
    <View style={[styles.resultsContainer, hideEmptyState && !hasSearched && searchResults.length === 0 ? styles.resultsContainerCollapsed : null]}>
      {isSearching ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size='large' color={searchButtonColor || "#007AFF"} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : hasSearched && searchResults.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name='search' size={40} color='#ccc' />
          <Text style={styles.noResultsText}>No users found</Text>
          <Text style={styles.noResultsSubtext}>{noResultsSubtext}</Text>
        </View>
      ) : searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          renderItem={renderUserItem}
          keyExtractor={(item, index) => `${item.profile_personal_uid || "user"}-${index}`}
          style={styles.resultsList}
          keyboardShouldPersistTaps='handled'
          nestedScrollEnabled
        />
      ) : hideEmptyState ? null : (
        <View style={styles.centerContainer}>
          <Ionicons name='people' size={40} color='#ccc' />
          <Text style={styles.instructionText}>{instructionText}</Text>
          <Text style={styles.instructionHint}>Matches appear after you type at least {MIN_QUERY_LENGTH} characters.</Text>
        </View>
      )}
    </View>
  );

  const newUserButton =
    showNewUserButton && onNewUser ? (
      <TouchableOpacity style={styles.newUserButton} onPress={onNewUser}>
        <Text style={styles.newUserButtonText}>I was not referred</Text>
      </TouchableOpacity>
    ) : null;

  if (embedded) {
    return (
      <View style={styles.embeddedRoot}>
        {searchField}
        {resultsBlock}
        {newUserButton}
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>{modalTitle}</Text>
              {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name='close' size={24} color='#333' />
            </TouchableOpacity>
          </View>

          {preparingNetwork ? (
            <View style={styles.preparingBanner} accessibilityRole='progressbar' accessibilityLabel='Loading network data'>
              <ActivityIndicator size='small' color='#007AFF' />
              <Text style={styles.preparingBannerText}>Loading your network for connection details…</Text>
            </View>
          ) : null}

          {searchField}
          {resultsBlock}
          {newUserButton}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "100%",
    maxWidth: 720,
    height: MODAL_HEIGHT,
    padding: 20,
  },
  embeddedRoot: {
    width: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  helperText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#666",
  },
  preparingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f0f6ff",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  preparingBannerText: {
    flex: 1,
    fontSize: 14,
    color: "#5060a0",
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 0,
    fontSize: 16,
    color: "#333",
    ...(Platform.OS === "web" ? { outlineStyle: "none" } : null),
  },
  clearButton: {
    marginLeft: 4,
    padding: 4,
  },
  resultsContainer: {
    height: RESULTS_AREA_HEIGHT,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    overflow: "hidden",
  },
  resultsContainerCollapsed: {
    height: 0,
    borderWidth: 0,
  },
  resultsList: {
    flex: 1,
    backgroundColor: "#fff",
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
  },
  cardWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  noResultsText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  noResultsSubtext: {
    marginTop: 4,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  instructionText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  instructionHint: {
    marginTop: 8,
    fontSize: 13,
    color: "#999",
    textAlign: "center",
  },
  newUserButton: {
    backgroundColor: "#FFA500",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  newUserButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default ReferralSearch;
