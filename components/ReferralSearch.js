// components/ReferralSearch.js
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList, Image, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SEARCH_REFERRAL_ENDPOINT } from "../apiConfig";

const ReferralSearch = ({ visible, onSelect, onNewUser, onClose, embedded = false }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const url = `${SEARCH_REFERRAL_ENDPOINT}?query=${encodeURIComponent(searchQuery.trim())}`;
      console.log("Search URL:", url); // DEBUG

      const response = await fetch(url);
      console.log("Response status:", response.status); // DEBUG

      const data = await response.json();
      console.log("Response data:", data); // DEBUG
      console.log("Results array:", data.results); // DEBUG
      console.log("Results length:", data.results?.length); // DEBUG

      if (data.code === 200) {
        setSearchResults(data.results || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Error searching referrals:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = (user) => {
    onSelect(user.profile_personal_uid, user.profile_personal_user_id);
    // Reset modal state
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
  };

  const renderUserItem = ({ item }) => {
    const fullName = `${item.profile_personal_first_name || ""} ${item.profile_personal_last_name || ""}`.trim();

    const location = [item.profile_personal_city, item.profile_personal_state].filter(Boolean).join(", ");

    return (
      <TouchableOpacity style={styles.userItem} onPress={() => handleSelectUser(item)}>
        <Image source={item.profile_personal_image ? { uri: item.profile_personal_image } : require("../assets/profile.png")} style={styles.userImage} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{fullName || "Unknown"}</Text>
          {location ? <Text style={styles.userLocation}>{location}</Text> : null}
        </View>
        <Ionicons name='chevron-forward' size={20} color='#666' />
      </TouchableOpacity>
    );
  };

  return embedded ? (
    // Embedded version (no modal wrapper)
    <>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name='search' size={20} color='#666' style={styles.searchIcon} />
        <TextInput style={styles.searchInput} placeholder='Search by name or city' value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={handleSearch} autoCapitalize='words' />
        <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      <View style={[styles.resultsContainer, { minHeight: 150 }]}>
        {isSearching ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size='large' color='#007AFF' />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        ) : hasSearched && searchResults.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name='search' size={48} color='#ccc' />
            <Text style={styles.noResultsText}>No users found</Text>
            <Text style={styles.noResultsSubtext}>Try a different name or location</Text>
          </View>
        ) : searchResults.length > 0 ? (
          <FlatList data={searchResults} renderItem={renderUserItem} keyExtractor={(item) => item.profile_personal_uid} style={styles.resultsList} />
        ) : (
          <View style={styles.centerContainer}>
            <Ionicons name='people' size={48} color='#ccc' />
            <Text style={styles.instructionText}>Search for the person who referred you</Text>
          </View>
        )}
      </View>

      {/* New User Button */}
      <TouchableOpacity style={styles.newUserButton} onPress={onNewUser}>
        <Text style={styles.newUserButtonText}>I'm a New User</Text>
      </TouchableOpacity>
    </>
  ) : (
    // Original standalone modal version
    <Modal visible={visible} transparent animationType='fade'>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Who referred you?</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name='close' size={24} color='#333' />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name='search' size={20} color='#666' style={styles.searchIcon} />
            <TextInput style={styles.searchInput} placeholder='Search by name or city' value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={handleSearch} autoCapitalize='words' />
            <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>

          {/* Results */}
          <View style={styles.resultsContainer}>
            {isSearching ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size='large' color='#007AFF' />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            ) : hasSearched && searchResults.length === 0 ? (
              <View style={styles.centerContainer}>
                <Ionicons name='search' size={48} color='#ccc' />
                <Text style={styles.noResultsText}>No users found</Text>
                <Text style={styles.noResultsSubtext}>Try a different name or location</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <FlatList data={searchResults} renderItem={renderUserItem} keyExtractor={(item) => item.profile_personal_uid} style={styles.resultsList} />
            ) : (
              <View style={styles.centerContainer}>
                <Ionicons name='people' size={48} color='#ccc' />
                <Text style={styles.instructionText}>Search for the person who referred you</Text>
              </View>
            )}
          </View>

          {/* New User Button */}
          <TouchableOpacity style={styles.newUserButton} onPress={onNewUser}>
            <Text style={styles.newUserButtonText}>I'm a New User</Text>
          </TouchableOpacity>
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
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "100%",
    maxWidth: 500,
    maxHeight: "80%",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
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
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  searchButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  resultsContainer: {
    flex: 1,
    minHeight: 200,
  },
  resultsList: {
    flex: 1,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  userImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: "#eee",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  userLocation: {
    fontSize: 14,
    color: "#666",
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
  },
  instructionText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  newUserButton: {
    backgroundColor: "#FFA500",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
  },
  newUserButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default ReferralSearch;
