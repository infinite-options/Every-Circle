import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { API_BASE_URL, PROFILE_AVATARS_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "../utils/httpMiddleware";
import { getSessionProfile } from "../utils/sessionProfile";
import { parseCombinedPath, truncateConnectionPath, buildCombinedPathFromPersonalPaths } from "../utils/connectionPathChain";
import { useDarkMode } from "../contexts/DarkModeContext";

const DEFAULT_AVATAR = require("../assets/profile.png");
const MAX_CHAIN_USERS = 5;

function initialsFromName(firstName, lastName) {
  const a = String(firstName || "").trim().charAt(0);
  const b = String(lastName || "").trim().charAt(0);
  const s = `${a}${b}`.toUpperCase();
  return s || "?";
}

/**
 * Horizontal chain of profile avatars: viewer → … → visited profile.
 * Max 5 people; longer paths collapse the middle with an ellipsis.
 */
export default function ConnectionPathChain({
  viewerUid,
  visitedUid,
  visitedFirstName,
  visitedLastName,
  visitedProfileImage,
  visitedImageIsPublic,
  visitedPersonalPath,
  returnTo = "Profile",
  style,
}) {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();
  const [pathUids, setPathUids] = useState([]);
  const [profilesByUid, setProfilesByUid] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const abortRef = useRef(0);

  const seedEnds = useCallback(async () => {
    const map = {};
    const visited = String(visitedUid || "").trim();
    if (visited) {
      map[visited] = {
        uid: visited,
        firstName: visitedFirstName || "",
        lastName: visitedLastName || "",
        profileImage: visitedImageIsPublic ? visitedProfileImage || "" : "",
        imageIsPublic: !!visitedImageIsPublic,
      };
    }
    try {
      const session = await getSessionProfile();
      const uid = String(viewerUid || session?.profileUid || "").trim();
      if (uid) {
        const p = session?.personalInfo || session?.rawProfile?.personal_info || {};
        map[uid] = {
          uid,
          firstName: p.profile_personal_first_name || "",
          lastName: p.profile_personal_last_name || "",
          profileImage: p.profile_personal_image_is_public === 1 ? String(p.profile_personal_image || "") : "",
          imageIsPublic: p.profile_personal_image_is_public === 1,
          isSelf: true,
        };
      }
    } catch (_) {}
    return map;
  }, [viewerUid, visitedUid, visitedFirstName, visitedLastName, visitedProfileImage, visitedImageIsPublic]);

  useEffect(() => {
    const viewer = String(viewerUid || "").trim();
    const visited = String(visitedUid || "").trim();
    if (!viewer || !visited || viewer === visited) {
      setPathUids([]);
      setLoadFailed(false);
      return;
    }

    const ticket = ++abortRef.current;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadFailed(false);
      const seeded = await seedEnds();
      if (cancelled || ticket !== abortRef.current) return;
      setProfilesByUid(seeded);

      let uids = [];
      try {
        const res = await fetch(`${API_BASE_URL}/api/connections_path/${encodeURIComponent(viewer)}/${encodeURIComponent(visited)}`);
        if (res.ok) {
          const data = await res.json();
          uids = parseCombinedPath(data?.combined_path);
        }
      } catch (e) {
        console.warn("[ConnectionPathChain] connections_path failed:", e?.message || e);
      }

      // Client-side fallback from stored personal paths when API fails / empty
      if (uids.length === 0) {
        try {
          const session = await getSessionProfile();
          const viewerPath =
            session?.personalInfo?.profile_personal_path ?? session?.rawProfile?.personal_info?.profile_personal_path ?? null;
          uids = buildCombinedPathFromPersonalPaths(viewerPath, visitedPersonalPath);
        } catch (_) {}
      }

      if (cancelled || ticket !== abortRef.current) return;

      if (uids.length < 2) {
        setPathUids([]);
        setLoadFailed(true);
        setLoading(false);
        return;
      }

      // Ensure ends are viewer → visited in display order
      if (uids[0] !== viewer && uids[uids.length - 1] === viewer) {
        uids = uids.slice().reverse();
      }
      setPathUids(uids);

      const display = truncateConnectionPath(uids, MAX_CHAIN_USERS);
      const needFetch = display.filter((n) => n.type === "user" && n.uid && !seeded[n.uid]).map((n) => n.uid);

      if (needFetch.length > 0) {
        const fetched = {};
        try {
          const res = await fetch(PROFILE_AVATARS_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profile_uids: needFetch }),
          });
          if (res.ok) {
            const json = await res.json();
            const avatars = Array.isArray(json?.avatars) ? json.avatars : [];
            for (const a of avatars) {
              const uid = a?.profile_uid;
              if (!uid) continue;
              const imagePublic = !!a.image_is_public;
              fetched[uid] = {
                uid,
                firstName: a.first_name || "",
                lastName: a.last_name || "",
                profileImage: imagePublic ? String(a.image_url || "") : "",
                imageIsPublic: imagePublic,
              };
            }
          }
        } catch (e) {
          console.warn("[ConnectionPathChain] profile avatars hydrate failed:", e?.message || e);
        }
        if (cancelled || ticket !== abortRef.current) return;
        setProfilesByUid((prev) => ({ ...prev, ...fetched }));
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [viewerUid, visitedUid, visitedPersonalPath, seedEnds]);

  const nodes = useMemo(() => truncateConnectionPath(pathUids, MAX_CHAIN_USERS), [pathUids]);

  const onPressUid = useCallback(
    (uid) => {
      const id = String(uid || "").trim();
      if (!id) return;
      if (id === String(visitedUid || "").trim()) return;
      if (id === String(viewerUid || "").trim()) {
        navigation.navigate("Profile", { returnTo });
        return;
      }
      navigation.navigate("Profile", { profile_uid: id, returnTo });
    },
    [navigation, viewerUid, visitedUid, returnTo],
  );

  if (!viewerUid || !visitedUid || viewerUid === visitedUid) return null;
  if (loadFailed && nodes.length === 0 && !loading) return null;
  if (!loading && nodes.length < 2) return null;

  return (
    <View style={[styles.wrap, darkMode && styles.darkWrap, style]} accessibilityRole='summary' accessibilityLabel='Connection path'>
      <Text style={[styles.label, darkMode && styles.darkLabel]}>Connected through</Text>
      {loading && nodes.length < 2 ? (
        <ActivityIndicator size='small' color={darkMode ? "#aaa" : "#666"} style={{ marginVertical: 8 }} />
      ) : (
        <View style={styles.row}>
          {nodes.map((node, index) => {
            if (node.type === "ellipsis") {
              return (
                <View key={`ellipsis-${index}`} style={styles.ellipsisBlock} accessibilityLabel={`${node.hiddenCount || 0} more in path`}>
                  {index > 0 ? <View style={[styles.connector, darkMode && styles.darkConnector]} /> : null}
                  <View style={[styles.ellipsisPill, darkMode && styles.darkEllipsisPill]}>
                    <Text style={[styles.ellipsisText, darkMode && styles.darkEllipsisText]}>···</Text>
                  </View>
                </View>
              );
            }

            const profile = profilesByUid[node.uid] || {};
            const isSelf = node.uid === viewerUid || profile.isSelf;
            const isVisited = node.uid === visitedUid;
            const uri = profile.profileImage && String(profile.profileImage).trim() !== "" ? String(profile.profileImage) : null;
            const label = isSelf
              ? "You"
              : [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || (isVisited ? "Profile" : "Member");

            return (
              <View key={node.uid} style={styles.nodeBlock}>
                {index > 0 ? <View style={[styles.connector, darkMode && styles.darkConnector]} /> : null}
                <TouchableOpacity
                  onPress={() => onPressUid(node.uid)}
                  activeOpacity={isVisited ? 1 : 0.75}
                  disabled={isVisited}
                  accessibilityRole='button'
                  accessibilityLabel={label}
                  style={styles.avatarPress}
                >
                  <View style={[styles.avatarRing, darkMode && styles.darkAvatarRing, isSelf && styles.selfRing, isVisited && styles.visitedRing]}>
                    {uri ? (
                      <Image source={{ uri }} style={styles.avatar} defaultSource={DEFAULT_AVATAR} />
                    ) : (
                      <View style={[styles.avatarFallback, darkMode && styles.darkAvatarFallback]}>
                        <Text style={[styles.initials, darkMode && styles.darkInitials]}>{initialsFromName(profile.firstName, profile.lastName)}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.name, darkMode && styles.darkName]} numberOfLines={1}>
                    {isSelf ? "You" : profile.firstName || (isVisited ? "Them" : "···")}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const AVATAR = 44;

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
    paddingVertical: 4,
  },
  darkWrap: {},
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  darkLabel: {
    color: "#aaa",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    flexWrap: "nowrap",
  },
  nodeBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    maxWidth: 72,
  },
  ellipsisBlock: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: AVATAR / 2 - 6,
  },
  connector: {
    width: 14,
    height: 2,
    backgroundColor: "#C8C8C8",
    marginTop: AVATAR / 2 - 1,
    marginHorizontal: 2,
  },
  darkConnector: {
    backgroundColor: "#555",
  },
  avatarPress: {
    alignItems: "center",
    width: 56,
  },
  avatarRing: {
    width: AVATAR + 4,
    height: AVATAR + 4,
    borderRadius: (AVATAR + 4) / 2,
    borderWidth: 2,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  darkAvatarRing: {
    borderColor: "#555",
    backgroundColor: "#1e1e1e",
  },
  selfRing: {
    borderColor: "#4A90D9",
  },
  visitedRing: {
    borderColor: "#2E7D32",
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
  },
  avatarFallback: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
  },
  darkAvatarFallback: {
    backgroundColor: "#444",
  },
  initials: {
    fontSize: 14,
    fontWeight: "700",
    color: "#555",
  },
  darkInitials: {
    color: "#ddd",
  },
  name: {
    marginTop: 4,
    fontSize: 11,
    color: "#444",
    maxWidth: 56,
    textAlign: "center",
    ...Platform.select({ web: { userSelect: "none" }, default: {} }),
  },
  darkName: {
    color: "#ccc",
  },
  ellipsisPill: {
    minWidth: 28,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E4E4E4",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  darkEllipsisPill: {
    backgroundColor: "#444",
  },
  ellipsisText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666",
    letterSpacing: 1,
  },
  darkEllipsisText: {
    color: "#bbb",
  },
});
