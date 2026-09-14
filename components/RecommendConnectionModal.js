// components/RecommendConnectionModal.js
// Lets a user pick one of their direct network connections to recommend a
// business to, then hands off to ChatScreen with a prefilled template
// message (see utils/chatReplyContext.js buildBusinessReplyContext).
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CIRCLES_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "../utils/httpMiddleware";
import { isProfileDeleted } from "../utils/deletedProfile";
import { useDarkMode } from "../contexts/DarkModeContext";

/**
 * @param {boolean} visible
 * @param {() => void} onClose
 * @param {(connection: { uid: string, name: string, image: string|null }) => void} onSelectConnection
 */
const RecommendConnectionModal = ({ visible, onClose, onSelectConnection }) => {
  const { darkMode } = useDarkMode();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connections, setConnections] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const loadConnections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const myUid = (await AsyncStorage.getItem("profile_uid")) || "";
      if (!myUid) {
        setError("Could not find your profile.");
        setConnections([]);
        return;
      }
      const response = await fetch(`${CIRCLES_ENDPOINT}/${myUid}`);
      const json = await response.json();
      const rows = Array.isArray(json?.data) ? json.data : [];
      const cleaned = rows
        .filter((row) => !isProfileDeleted(row))
        .map((row) => {
          const name = [row.profile_personal_first_name, row.profile_personal_last_name].filter(Boolean).join(" ").trim();
          return {
            uid: row.network_profile_personal_uid || row.profile_personal_uid,
            name: name || "Unknown",
            image: row.profile_personal_image_is_public === 1 ? row.profile_personal_image || null : null,
            location: [row.profile_personal_city, row.profile_personal_state].filter(Boolean).join(", "),
            relationship: row.circle_relationship || null,
          };
        })
        .filter((c) => c.uid);
      setConnections(cleaned);
    } catch (e) {
      setError("Could not load your connections.");
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setSearchQuery("");
      loadConnections();
    }
  }, [visible, loadConnections]);

  const filteredConnections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter(
      (c) => c.name.toLowerCase().includes(q) || c.location.toLowerCase().includes(q),
    );
  }, [connections, searchQuery]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.row, darkMode && styles.rowDark]}
      onPress={() => onSelectConnection(item)}
      accessibilityRole="button"
      accessibilityLabel={`Recommend to ${item.name}`}
    >
      <Image
        source={item.image ? { uri: item.image } : require("../assets/profile.png")}
        style={styles.avatar}
      />
      <View style={styles.rowText}>
        <Text style={[styles.name, darkMode && styles.nameDark]}>{item.name}</Text>
        {item.location ? <Text style={[styles.subtext, darkMode && styles.subtextDark]}>{item.location}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={darkMode ? "#888" : "#666"} />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, darkMode && styles.sheetDark]}>
          <View style={styles.header}>
            <Text style={[styles.title, darkMode && styles.titleDark]}>Recommend to a Connection</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={darkMode ? "#eee" : "#333"} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchBar, darkMode && styles.searchBarDark]}>
            <Ionicons name="search" size={18} color={darkMode ? "#999" : "#666"} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, darkMode && styles.searchInputDark]}
              placeholder="Search your connections"
              placeholderTextColor={darkMode ? "#888" : "#999"}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.listContainer}>
            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
              </View>
            ) : error ? (
              <View style={styles.centerContainer}>
                <Text style={[styles.subtext, darkMode && styles.subtextDark]}>{error}</Text>
              </View>
            ) : filteredConnections.length === 0 ? (
              <View style={styles.centerContainer}>
                <Ionicons name="people-outline" size={40} color="#ccc" />
                <Text style={[styles.subtext, darkMode && styles.subtextDark, { marginTop: 8 }]}>
                  {connections.length === 0 ? "You don't have any connections yet." : "No matches found."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredConnections}
                keyExtractor={(item) => item.uid}
                renderItem={renderItem}
              />
            )}
          </View>
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
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "100%",
    maxWidth: 480,
    maxHeight: "80%",
    minHeight: 360,
    padding: 20,
  },
  sheetDark: {
    backgroundColor: "#1e1e1e",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  titleDark: {
    color: "#eee",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchBarDark: {
    backgroundColor: "#2a2a2a",
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: "#333",
  },
  searchInputDark: {
    color: "#eee",
  },
  listContainer: {
    flex: 1,
    minHeight: 200,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  rowDark: {
    borderBottomColor: "#333",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: "#eee",
  },
  rowText: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  nameDark: {
    color: "#eee",
  },
  subtext: {
    fontSize: 13,
    color: "#777",
    textAlign: "center",
  },
  subtextDark: {
    color: "#999",
  },
});

export default RecommendConnectionModal;
