import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MicroCard from "../components/MicroCard";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import ProfileSectionItemImage from "../components/ProfileSectionItemImage";
import { useDarkMode } from "../contexts/DarkModeContext";
import { PROFILE_EXPERTISE_RESPONSE_OFFERING_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "../utils/httpMiddleware";
import { resolveProfileItemImageUri } from "../utils/resolveProfileItemImageUri";
import { formatExpertiseModeForDisplay, getExpertiseModeIoniconNames } from "../utils/expertiseMode";
import { buildOfferingReplyContext } from "../utils/chatReplyContext";

const formatDateTimeForDisplay = (value) => {
  if (!value || typeof value !== "string" || value.trim() === "") return "";
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[\sT]?(\d{1,2})?:?(\d{2})?/);
  if (match) {
    const [, y, m, d, h, min] = match;
    const timePart = h !== undefined && min !== undefined ? ` ${String(parseInt(h, 10)).padStart(2, "0")}:${min}` : "";
    return `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}${timePart}`;
  }
  return trimmed;
};

/** Strip the ↪ Offering:/Seeking: header line from a stored chat message body. */
const parseChatMessageBody = (rawBody) => {
  const body = String(rawBody || "").trim();
  if (!body) return "";
  const match = body.match(/^↪\s+[^\n]+\n([\s\S]*)$/);
  return (match ? match[1] : body).trim();
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

  const handleBack = () => {
    if (profileState) {
      navigation.navigate("Profile", profileState);
    } else if (profile_uid) {
      navigation.navigate("Profile", {
        profile_uid,
        returnTo: "OfferingResponses",
        offeringResponsesState: { expertiseData, profileData, profile_uid, profileState },
      });
    } else {
      navigation.goBack();
    }
  };

  const offeringTitle = expertiseData?.title || expertiseData?.profile_expertise_title || "";
  const offeringDescription = String(expertiseData?.description || expertiseData?.profile_expertise_description || "").trim();
  const offeringImageUri = resolveProfileItemImageUri(expertiseData?.profile_expertise_image, profile_uid);
  const offeringQty =
    expertiseData?.quantity != null && String(expertiseData.quantity).trim() !== ""
      ? String(expertiseData.quantity).trim()
      : expertiseData?.profile_expertise_quantity != null && String(expertiseData.profile_expertise_quantity).trim() !== ""
        ? String(expertiseData.profile_expertise_quantity).trim()
        : "";
  const offeringCost = expertiseData?.cost || expertiseData?.profile_expertise_cost || "";
  const offeringBounty = expertiseData?.bounty || expertiseData?.profile_expertise_bounty || "";
  const offeringLocation =
    [expertiseData?.profile_expertise_city, expertiseData?.profile_expertise_state].filter(Boolean).join(", ") ||
    expertiseData?.profile_expertise_location ||
    "";
  const offeringModeDisplay = formatExpertiseModeForDisplay(expertiseData?.profile_expertise_mode);

  return (
    <SafeAreaView style={[styles.pageContainer, darkMode && styles.darkPageContainer]} edges={["top"]}>
      <AppHeader title='OFFERING RESPONSES' backgroundColor='#AF52DE' onBackPress={handleBack} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color='#AF52DE' />
        </View>
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {/* Offering item — same layout as Profile OFFERING cards */}
          <View style={[styles.offeringCard, darkMode && styles.darkOfferingCard]}>
            <View style={styles.offeringHeaderRow}>
              <ProfileSectionItemImage section='offering' imageUri={offeringImageUri} imageIsPublic={expertiseData?.profile_expertise_image_is_public} size={56} darkMode={darkMode} />
              <View style={styles.offeringHeaderText}>
                {offeringTitle ? <Text style={[styles.offeringTitle, darkMode && styles.darkOfferingTitle]}>{offeringTitle}</Text> : null}
                {offeringDescription ? <Text style={[styles.offeringDescription, darkMode && styles.darkOfferingDescription]}>{offeringDescription}</Text> : null}
              </View>
            </View>
            {expertiseData?.profile_expertise_start ||
            expertiseData?.profile_expertise_end ||
            offeringLocation ||
            offeringModeDisplay ? (
              <View style={[styles.offeringMetaRow, { marginTop: 6 }]}>
                {expertiseData?.profile_expertise_start || expertiseData?.profile_expertise_end ? (
                  <View style={styles.offeringMetaLine}>
                    <Ionicons name='calendar-outline' size={14} color={darkMode ? "#999" : "#666"} style={{ marginRight: 6 }} />
                    <Text style={[styles.offeringMetaText, darkMode && styles.darkOfferingMetaText]}>
                      {expertiseData.profile_expertise_start ? formatDateTimeForDisplay(expertiseData.profile_expertise_start) : "—"}
                      {expertiseData.profile_expertise_start && expertiseData.profile_expertise_end ? " → " : ""}
                      {expertiseData.profile_expertise_end ? formatDateTimeForDisplay(expertiseData.profile_expertise_end) : ""}
                    </Text>
                  </View>
                ) : null}
                {offeringLocation || offeringModeDisplay ? (
                  <View
                    style={[
                      styles.offeringMetaLine,
                      styles.offeringMetaLineSpaceBetween,
                      (expertiseData?.profile_expertise_start || expertiseData?.profile_expertise_end) && { marginTop: 4 },
                    ]}
                  >
                    {offeringLocation ? (
                      <View style={styles.offeringMetaLine}>
                        <Ionicons name='location-outline' size={14} color={darkMode ? "#999" : "#666"} style={{ marginRight: 6 }} />
                        <Text style={[styles.offeringMetaText, darkMode && styles.darkOfferingMetaText]}>{offeringLocation}</Text>
                      </View>
                    ) : (
                      <View style={styles.offeringMetaSpacer} />
                    )}
                    {offeringModeDisplay ? (
                      <View style={styles.offeringMetaLine}>
                        {getExpertiseModeIoniconNames(expertiseData?.profile_expertise_mode).map((iconName, iconIdx, arr) => (
                          <Ionicons key={iconName} name={iconName} size={14} color={darkMode ? "#999" : "#666"} style={{ marginRight: iconIdx < arr.length - 1 ? 4 : 6 }} />
                        ))}
                        <Text style={[styles.offeringMetaText, darkMode && styles.darkOfferingMetaText]}>{offeringModeDisplay}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}
            {offeringCost || offeringQty || offeringBounty ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginLeft: 0, marginTop: 6 }}>
                {offeringCost ? (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={styles.moneyBagIconContainer}>
                      <Text style={styles.moneyBagDollarSymbol}>$</Text>
                    </View>
                    <Text style={[styles.offeringCostText, darkMode && styles.darkOfferingCostText]}>
                      {String(offeringCost).toLowerCase() !== "free" ? `Cost: $${String(offeringCost).replace(/^\$/, "")}` : `Cost: ${offeringCost}`}
                    </Text>
                  </View>
                ) : null}
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "flex-end", flexWrap: "wrap", gap: 8 }}>
                  {offeringQty ? <Text style={[styles.offeringCostText, darkMode && styles.darkOfferingCostText]}>Qty: {offeringQty}</Text> : null}
                  {offeringBounty ? (
                    <Text style={[styles.offeringCostText, { textAlign: "right", minWidth: 60 }, darkMode && styles.darkOfferingCostText]}>
                      {String(offeringBounty).toLowerCase() !== "free" ? `💰 $${String(offeringBounty).replace(/^\$/, "")}` : `💰 ${offeringBounty}`}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>

          {responses.length > 0 ? (
            <>
              <Text style={[styles.responsesTitle, darkMode && styles.darkResponsesTitle]}>Responses ({responses.length})</Text>
              {responses.map((response, index) => {
                const responderProfileUid = String(response.er_responder_id || response.responder_id || "").trim();
                const responderMicroCardUser = {
                  firstName: response.responder_first_name || "",
                  lastName: response.responder_last_name || "",
                  profileImage: response.responder_image || "",
                  tagLine: response.responder_tag_line || "",
                  tagLineIsPublic: response.responder_tag_line_is_public === 1,
                  imageIsPublic: response.responder_image_is_public === 1,
                };
                const responseNote = String(response.er_responder_note || response.responder_note || "").trim();
                const messageBody = parseChatMessageBody(response.message_body);
                const responseDateLabel = response.er_datetime ? formatDateTimeForDisplay(response.er_datetime) : "";
                const responseDisplayText =
                  messageBody || responseNote || (responseDateLabel ? `Messaged on ${responseDateLabel}` : "");
                const responderName = [responderMicroCardUser.firstName, responderMicroCardUser.lastName].filter(Boolean).join(" ").trim();

                return (
                  <View key={response.expertise_response_uid || `${response.er_datetime || "response"}-${index}`} style={[styles.responseCard, darkMode && styles.darkResponseCard]}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      disabled={!responderProfileUid}
                      onPress={() => {
                        if (!responderProfileUid) return;
                        navigation.navigate("Profile", {
                          profile_uid: responderProfileUid,
                          returnTo: "OfferingResponses",
                          offeringResponsesState: { expertiseData, profileData, profile_uid, profileState },
                        });
                      }}
                    >
                      <MicroCard user={responderMicroCardUser} showRelationship={false} embedded />
                    </TouchableOpacity>
                    <Text style={[styles.responseNote, darkMode && styles.darkResponseNote]}>{responseDisplayText || "No note provided"}</Text>
                    {responderProfileUid ? (
                      <View style={styles.responseActionsRow}>
                        <TouchableOpacity
                          style={[styles.messageButton, darkMode && styles.darkMessageButton]}
                          activeOpacity={0.85}
                          onPress={() =>
                            navigation.navigate("Chat", {
                              other_uid: responderProfileUid,
                              other_name: responderName || "Chat",
                              other_image:
                                responderMicroCardUser.imageIsPublic && responderMicroCardUser.profileImage
                                  ? responderMicroCardUser.profileImage
                                  : null,
                              reply_context: buildOfferingReplyContext({
                                label: `Offering: ${offeringTitle || "Offering"}`,
                                quote: responseDisplayText || undefined,
                                profileExpertiseUid: expertiseData?.expertise_uid || expertiseData?.profile_expertise_uid,
                                expertiseResponseUid: response.expertise_response_uid,
                              }),
                            })
                          }
                        >
                          <Ionicons name='chatbubble-ellipses-outline' size={16} color='#fff' style={{ marginRight: 6 }} />
                          <Text style={styles.messageButtonText}>Message</Text>
                        </TouchableOpacity>
                      </View>
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
  pageContainer: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  darkPageContainer: {
    backgroundColor: "#1a1a1a",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  offeringCard: {
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  darkOfferingCard: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  offeringHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 2,
  },
  offeringHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  offeringTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },
  darkOfferingTitle: {
    color: "#fff",
  },
  offeringDescription: {
    fontSize: 15,
    color: "#666",
    lineHeight: 22,
  },
  darkOfferingDescription: {
    color: "#aaa",
  },
  offeringMetaRow: {
    marginLeft: 0,
  },
  offeringMetaLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  offeringMetaLineSpaceBetween: {
    justifyContent: "space-between",
  },
  offeringMetaSpacer: {
    flex: 1,
  },
  offeringMetaText: {
    color: "#666",
    fontSize: 13,
  },
  darkOfferingMetaText: {
    color: "#999",
  },
  offeringCostText: {
    fontSize: 15,
    color: "#333",
  },
  darkOfferingCostText: {
    color: "#fff",
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
  responsesTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 15,
    color: "#333",
  },
  darkResponsesTitle: {
    color: "#fff",
  },
  responseCard: {
    backgroundColor: "#fff",
    padding: 20,
    marginBottom: 15,
    borderRadius: 12,
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.05)",
    ...(Platform.OS !== "web" && { elevation: 2 }),
  },
  darkResponseCard: {
    backgroundColor: "#2d2d2d",
  },
  responseNote: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 16,
  },
  darkResponseNote: {
    color: "#cccccc",
  },
  responseActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  messageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4B2E83",
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minWidth: 150,
  },
  darkMessageButton: {
    backgroundColor: "#5a3d9e",
  },
  messageButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  noResponsesContainer: {
    padding: 40,
    alignItems: "center",
  },
  noResponsesText: {
    fontSize: 16,
    color: "#999",
    fontStyle: "italic",
  },
  darkNoResponsesText: {
    color: "#666",
  },
});

export default function OfferingResponsesScreen(props) {
  return <OfferingResponsesScreenContent {...props} />;
}
