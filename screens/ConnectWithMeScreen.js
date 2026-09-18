import React, { useCallback, useEffect, useState } from "react";
import { Alert, InteractionManager, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppHeader from "../components/AppHeader";
import ScannedProfilePopup from "../components/ScannedProfilePopup";
import { API_BASE_URL, CIRCLES_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "../utils/httpMiddleware";
import { addScannedCircleConnection } from "../utils/addScannedCircleConnection";
import { fetchPublicProfileCard } from "../utils/fetchPublicProfileCard";
import { savePendingScanConnection } from "../utils/pendingScanConnection";
import { getSessionProfile } from "../utils/sessionProfile";
import { upsertReferralNetworkRelationship } from "../utils/searchReferralProfiles";

const PLACEHOLDER_PROFILE = (profileUid) => ({
  profile_uid: profileUid,
  firstName: "",
  lastName: "",
  tagLine: "",
  email: "",
  phoneNumber: "",
  profileImage: "",
  city: "",
  state: "",
  imageIsPublic: false,
});

export default function ConnectWithMeScreen({ navigation, route }) {
  const {
    profileUid,
    profileData: initialProfileData,
    mode = "scan",
    title,
    actionLabel,
    relationshipRequired = false,
    initialData = null,
    circleUid = null,
    scannerIsNewSignup = false,
  } = route.params || {};

  const [profileData, setProfileData] = useState(initialProfileData || (profileUid ? PLACEHOLDER_PROFILE(profileUid) : null));
  const [loadingProfile, setLoadingProfile] = useState(!initialProfileData && !!profileUid);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialProfileData || !profileUid) return;
    let cancelled = false;
    (async () => {
      setLoadingProfile(true);
      try {
        const card = await fetchPublicProfileCard(profileUid);
        if (!cancelled) setProfileData(card);
      } catch (error) {
        console.error("ConnectWithMeScreen - failed to load profile:", error);
        if (!cancelled) {
          Alert.alert("Error", "Could not load profile. Please try again.");
          navigation.goBack();
        }
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileUid, initialProfileData, navigation]);

  const navigateAfterScanSave = useCallback(async () => {
    let first = "";
    let last = "";
    try {
      const pairs = await AsyncStorage.multiGet(["user_first_name", "user_last_name"]);
      first = String(pairs?.[0]?.[1] || "").trim();
      last = String(pairs?.[1]?.[1] || "").trim();
    } catch (_) {}

    if (!first || !last) {
      try {
        const session = await getSessionProfile();
        const p = session?.personalInfo || session?.rawProfile?.personal_info || {};
        first = first || String(p.profile_personal_first_name || "").trim();
        last = last || String(p.profile_personal_last_name || "").trim();
      } catch (_) {}
    }

    const hasFullName = Boolean(first && last);
    InteractionManager.runAfterInteractions(() => {
      if (hasFullName) {
        navigation.navigate({ name: "Connect", params: {}, merge: false });
      } else {
        navigation.navigate({ name: "Profile", params: {}, merge: false });
      }
    });
  }, [navigation]);

  const handleScanSave = useCallback(
    async (connectionData) => {
      if (!profileUid) return;
      const result = await addScannedCircleConnection(profileUid, connectionData);
      if (result.ok) {
        await navigateAfterScanSave();
      } else if (result.error && result.error !== "not_logged_in" && result.error !== "self") {
        Alert.alert("Error", result.error || "Failed to add connection.");
      }
    },
    [profileUid, navigateAfterScanSave],
  );

  const handleGuestSave = useCallback(
    async (connectionData) => {
      if (!profileUid) return;
      await savePendingScanConnection(profileUid, connectionData);
      await AsyncStorage.setItem("referral_uid", profileUid);
      navigation.navigate("ScanLanding", { profile_uid: profileUid, notesCommitted: true });
    },
    [profileUid, navigation],
  );

  const handleEditSave = useCallback(
    async (connectionData) => {
      const loggedInProfileUID = await AsyncStorage.getItem("profile_uid");
      if (!loggedInProfileUID) {
        Alert.alert("Error", "User profile not found. Please try again.");
        return;
      }
      if (!profileUid) {
        Alert.alert("Error", "Profile information not found.");
        return;
      }

      const selectedRelationship = connectionData?.relationship !== undefined ? connectionData.relationship : null;
      const validRelationships = ["friend", "colleague", "family"];
      if (!selectedRelationship || !validRelationships.includes(selectedRelationship)) {
        Alert.alert("Required", "Please select a relationship type.");
        return;
      }

      const circleDate =
        connectionData?.date?.trim() ||
        (() => {
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        })();

      const payload = {
        circle_relationship: selectedRelationship,
        circle_date: circleDate,
        circle_event: connectionData?.event?.trim() || null,
        circle_note: connectionData?.note?.trim() || null,
        circle_city: connectionData?.city?.trim() || null,
        circle_state: connectionData?.state?.trim() || null,
        circle_introduced_by: connectionData?.introducedBy?.trim() || null,
      };

      let savedCircleUid = circleUid;

      if (circleUid) {
        const response = await fetch(`${CIRCLES_ENDPOINT}/${circleUid}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || "Failed to update connection");
        }
      } else {
        let circleNumNodes = null;
        try {
          const pathResponse = await fetch(`${API_BASE_URL}/api/connections_path/${loggedInProfileUID}/${profileUid}`);
          if (pathResponse.ok) {
            const pathData = await pathResponse.json();
            const combinedPath = pathData.combined_path || "";
            if (combinedPath) {
              const nodes = combinedPath.split(",").filter((n) => n.trim());
              circleNumNodes = Math.max(0, nodes.length - 2) + 1;
            }
          }
        } catch (err) {
          console.warn("ConnectWithMeScreen - could not fetch connections_path:", err);
        }

        const requestBody = {
          circle_profile_id: loggedInProfileUID,
          circle_related_person_id: profileUid,
          circle_date: circleDate,
          ...payload,
          ...(circleNumNodes !== null && { circle_num_nodes: circleNumNodes }),
        };

        const response = await fetch(CIRCLES_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || "Failed to save connection");
        }
        savedCircleUid = result?.data?.circle_uid || result?.circle_uid || savedCircleUid;
      }

      await upsertReferralNetworkRelationship(profileUid, selectedRelationship);

      Alert.alert("Success", "Connection details saved.", [
        {
          text: "OK",
          onPress: () => {
            navigation.navigate({
              name: "Profile",
              params: {
                profile_uid: profileUid,
                connectionSaved: true,
                circleUid: savedCircleUid,
                relationship: selectedRelationship,
              },
              merge: true,
            });
            navigation.goBack();
          },
        },
      ]);
    },
    [profileUid, circleUid, navigation],
  );

  const handleAddConnection = useCallback(
    async (connectionData) => {
      if (saving) return;
      setSaving(true);
      try {
        if (mode === "guest") {
          await handleGuestSave(connectionData);
        } else if (mode === "edit") {
          await handleEditSave(connectionData);
        } else {
          await handleScanSave(connectionData);
        }
      } catch (error) {
        console.error("ConnectWithMeScreen - save failed:", error);
        Alert.alert("Error", error.message || "Failed to save connection details. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [saving, mode, handleGuestSave, handleEditSave, handleScanSave],
  );

  const headerTitle = title || "Connect With Me";
  const resolvedActionLabel = saving && mode === "guest" ? "Saving…" : actionLabel || "Add to Network";

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <AppHeader title={headerTitle} onBackPress={() => navigation.goBack()} />
      <View style={styles.formContainer}>
        <ScannedProfilePopup
          variant='screen'
          hideHeader
          visible
          profileData={profileData}
          loadingProfile={loadingProfile}
          onClose={() => navigation.goBack()}
          onAddConnection={handleAddConnection}
          initialData={initialData}
          actionLabel={resolvedActionLabel}
          title={headerTitle}
          relationshipRequired={relationshipRequired}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  formContainer: {
    flex: 1,
  },
});
