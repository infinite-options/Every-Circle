import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MiniCard from "../components/MiniCard";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import ProfileSectionItemImage from "../components/ProfileSectionItemImage";
import { useDarkMode } from "../contexts/DarkModeContext";
import { getHeaderColors } from "../config/headerColors";
import { PROFILE_EXPERTISE_RESPONSE_OFFERING_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "../utils/httpMiddleware";
import { resolveProfileItemImageUri } from "../utils/resolveProfileItemImageUri";

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

const OfferingResponsesScreenContent = ({ route, navigation }) => {
  const { expertiseData, profileData, profile_uid, profileState } = route.params || {};
  const { darkMode } = useDarkMode();
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState([]);

  const fetchOfferingResponses = async () => {
    try {
      setLoading(true);
      const expertiseUid = String(expertiseData?.expertise_uid || expertiseData?.profile_expertise_uid || "").trim();
      if (!expertiseUid) {
        Alert.alert("Error", "Offering information not found.");
        return;
      }

      const response = await fetch(`${PROFILE_EXPERTISE_RESPONSE_OFFERING_ENDPOINT}/${encodeURIComponent(expertiseUid)}`);
      const result = await response.json();
      if (response.ok && result.code === 200 && Array.isArray(result.data)) {
        setResponses(result.data);
      } else {
        throw new Error(result.message || "Failed to fetch responses");
      }
    } catch (error) {
      console.error("OfferingResponsesScreen fetch error:", error);
      Alert.alert("Error", error.message || "Failed to load responses. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfferingResponses();
  }, [expertiseData?.expertise_uid, expertiseData?.profile_expertise_uid]);

  const offeringTitle = expertiseData?.title || expertiseData?.profile_expertise_title || "Offering";
  const offeringImageUri = resolveProfileItemImageUri(expertiseData?.profile_expertise_image, profile_uid);

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.darkContainer]} edges={["top"]}>
      <AppHeader
        title='Offering Responses'
        showBackButton
        onBackPress={() => {
          if (profile_uid) {
            navigation.navigate("Profile", {
              profile_uid,
              returnTo: "OfferingResponses",
              offeringResponsesState: { expertiseData, profileData, profile_uid, profileState },
              ...profileState,
            });
          } else {
            navigation.goBack();
          }
        }}
        headerColors={getHeaderColors(darkMode)}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={darkMode ? "#c77dff" : "#800000"} />
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={[styles.offeringCard, darkMode && styles.darkOfferingCard]}>
            <View style={styles.offeringHeaderRow}>
              <ProfileSectionItemImage section='offering' imageUri={offeringImageUri} imageIsPublic={expertiseData?.profile_expertise_image_is_public} size={56} darkMode={darkMode} />
              <View style={styles.offeringHeaderText}>
                <Text style={[styles.offeringTitle, darkMode && styles.darkOfferingTitle]}>{offeringTitle}</Text>
                {expertiseData?.description ? (
                  <Text style={[styles.offeringDescription, darkMode && styles.darkOfferingDescription]}>{String(expertiseData.description).trim()}</Text>
                ) : null}
              </View>
            </View>
          </View>

          {responses.length > 0 ? (
            <>
              <Text style={[styles.responsesTitle, darkMode && styles.darkResponsesTitle]}>Responses ({responses.length})</Text>
              {responses.map((response, index) => {
                const responderName = [response.responder_first_name, response.responder_last_name].filter(Boolean).join(" ").trim();
                const responderProfileUid = String(response.er_responder_id || "").trim();
                const miniCardUser = {
                  firstName: response.responder_first_name || "",
                  lastName: response.responder_last_name || "",
                  email: response.responder_email || "",
                  phoneNumber: response.responder_phone || "",
                  profileImage: response.responder_image || "",
                  tagLine: response.responder_tag_line || "",
                  emailIsPublic: response.responder_email_is_public === 1,
                  phoneIsPublic: response.responder_phone_is_public === 1,
                  tagLineIsPublic: response.responder_tag_line_is_public === 1,
                  imageIsPublic: response.responder_image_is_public === 1,
                };

                return (
                  <View key={response.expertise_response_uid || `${response.er_datetime || "response"}-${index}`} style={[styles.responseCard, darkMode && styles.darkResponseCard]}>
                    <View style={styles.responseMetaRow}>
                      {responderName ? <Text style={[styles.responderName, darkMode && styles.darkResponderName]}>{responderName}</Text> : null}
                      {response.er_datetime ? (
                        <Text style={[styles.responseDate, darkMode && styles.darkResponseDate]}>{formatDateForDisplay(response.er_datetime)}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        if (!responderProfileUid) return;
                        navigation.navigate("Profile", {
                          profile_uid: responderProfileUid,
                          returnTo: "OfferingResponses",
                          offeringResponsesState: { expertiseData, profileData, profile_uid, profileState },
                        });
                      }}
                    >
                      <View style={[styles.miniCardContainer, darkMode && styles.darkMiniCardContainer]}>
                        <MiniCard user={miniCardUser} />
                      </View>
                    </TouchableOpacity>
                    {responderProfileUid ? (
                      <TouchableOpacity
                        style={[styles.messageButton, darkMode && styles.darkMessageButton]}
                        activeOpacity={0.85}
                        onPress={() =>
                          navigation.navigate("Chat", {
                            other_uid: responderProfileUid,
                            other_name: responderName || "Chat",
                            other_image: response.responder_image_is_public === 1 && response.responder_image ? response.responder_image : null,
                            reply_context: { label: `Offering: ${offeringTitle}` },
                          })
                        }
                      >
                        <Ionicons name='chatbubble-ellipses-outline' size={16} color='#fff' style={{ marginRight: 6 }} />
                        <Text style={styles.messageButtonText}>Message</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </>
          ) : (
            <View style={styles.noResponsesContainer}>
              <Text style={[styles.noResponsesText, darkMode && styles.darkNoResponsesText]}>No responses yet</Text>
            </View>
          )}
        </ScrollView>
      )}

      <BottomNavBar navigation={navigation} activeTab='Profile' />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  darkContainer: { backgroundColor: "#121212" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  offeringCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    backgroundColor: "#fafafa",
  },
  darkOfferingCard: { borderColor: "#444", backgroundColor: "#1e1e1e" },
  offeringHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  offeringHeaderText: { flex: 1, minWidth: 0 },
  offeringTitle: { fontSize: 18, fontWeight: "600", color: "#222", marginBottom: 4 },
  darkOfferingTitle: { color: "#f5f5f5" },
  offeringDescription: { fontSize: 14, color: "#666", lineHeight: 20 },
  darkOfferingDescription: { color: "#aaa" },
  responsesTitle: { fontSize: 18, fontWeight: "700", color: "#222", marginBottom: 12 },
  darkResponsesTitle: { color: "#f5f5f5" },
  responseCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  darkResponseCard: { borderColor: "#444", backgroundColor: "#1e1e1e" },
  responseMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  responderName: { fontSize: 16, fontWeight: "600", color: "#800000", flex: 1 },
  darkResponderName: { color: "#c77dff" },
  responseDate: { fontSize: 13, color: "#666" },
  darkResponseDate: { color: "#999" },
  miniCardContainer: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    backgroundColor: "#fafafa",
  },
  darkMiniCardContainer: { borderColor: "#444", backgroundColor: "#2a2a2a" },
  messageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4B2E83",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  darkMessageButton: { backgroundColor: "#5a3d9e" },
  messageButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  noResponsesContainer: { paddingVertical: 40, alignItems: "center" },
  noResponsesText: { fontSize: 16, color: "#666" },
  darkNoResponsesText: { color: "#999" },
});

export default function OfferingResponsesScreen(props) {
  return (
    <OfferingResponsesScreenContent {...props} />
  );
}
