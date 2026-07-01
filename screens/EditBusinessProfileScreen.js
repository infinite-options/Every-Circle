//EditBusinessProfileScreen.js
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  Image,
  Keyboard,
  UIManager,
  findNodeHandle,
  ActivityIndicator,
  Platform,
  InteractionManager,
  Modal,
  BackHandler,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fetchMiddleware as fetch } from "../utils/httpMiddleware";
import MiniCard from "../components/MiniCard";
import { buildBusinessMiniCardBusiness } from "../utils/mapBusinessToMiniCard";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { useDarkMode } from "../contexts/DarkModeContext";
import { getHeaderColors } from "../config/headerColors";
import AsyncStorage from "@react-native-async-storage/async-storage";

// BUSINESS-SPECIFIC
import { Dropdown } from "react-native-element-dropdown";
import { Ionicons } from "@expo/vector-icons";
import ProductCard from "../components/ProductCard";
import TagSectionLabel from "../components/TagSectionLabel";
import { API_BASE_URL, BUSINESS_INFO_ENDPOINT, USER_PROFILE_INFO_ENDPOINT, CATEGORY_LIST_ENDPOINT } from "../apiConfig";
import { normalizeBusinessServiceFromApi as normalizeBusinessServiceRow, businessPaysCcFeeFromApiPayer, canonicalBusinessCcFeePayer } from "../utils/normalizeBusinessServiceFromApi";
import { parsePrice, formatCostValue } from "../utils/priceUtils";
import { mergeCustomTags, parseTagList, serializeTagList } from "../utils/tagListUtils";
import { buildBusinessServiceForApi, DEFAULT_RETURN_WINDOW_DAYS, normServiceReturnable, normServiceReturnWindowDays, normServiceTags } from "../utils/buildBusinessServiceForApi";
import { formatCoordinatePairForInput, parseCoordinatePairInput } from "../utils/validateCoordinates";
import { getBusinessSuggestions, getPlaceDetails, resolveRestGooglePhotoUrl } from "../utils/googlePlaces";
import { obscureSecretsInString } from "../utils/obscureSecretForDisplay";
import {
  resolveBusinessProfileImage,
  resolveBusinessProfileImgUrl,
  profileImgMatchesUri,
  galleryItemMatchesProfileImg,
  isGooglePhotoInList,
  resolveGooglePhotoUrl,
  dedupeGooglePhotoUrls,
  mergeRefreshedGooglePhotos,
  googlePhotoUrlsMatch,
  resolveFavoriteGoogleImage,
  isGoogleHostedPhotoUrl,
  buildBusinessGalleryUploads,
  resolveBusinessUploadUri,
  normalizeBusinessUploadKey,
  isBusinessUserUploadImage,
  businessUploadUrisMatch,
  businessGalleryIncludesUri,
  coalesceBusinessProfileImg,
  resolveGalleryItemDisplayUri,
  reconcileGalleryUploadsWithProfile,
  parseBusinessGooglePhotos,
  filterFreshGooglePhotoUrls,
  buildGooglePhotosForSave,
  collectKeptUserUploadS3Urls,
  resolveFavoriteImageForSave,
  favoritesMatch,
  isPersistedGoogleS3Url,
  isPermanentS3Url,
  isEphemeralGooglePhotoUrl,
  parseGalleryS3Urls,
  findNewGalleryS3Urls,
  dedupeGalleryUploadsByS3Key,
  extractGooglePhotoReference,
} from "../utils/resolveBusinessProfileImage";

const BusinessProfileAPI = BUSINESS_INFO_ENDPOINT;
const DEFAULT_BUSINESS_IMAGE = require("../assets/profile.png");

const parseInitialGalleryUploads = (business, businessUID) => buildBusinessGalleryUploads(business, businessUID);

const pickNextProfileImage = (googlePhotos, galleryUploads, excludeUri = "", uid = "") => {
  const nextInGallery = (galleryUploads || []).find((item) => item?.uri && !businessUploadUrisMatch(item.uri, excludeUri, uid) && !googlePhotoUrlsMatch(item.uri, excludeUri));
  if (nextInGallery?.uri) return nextInGallery.uri;
  const nextGoogle = (googlePhotos || []).find((photo) => photo && !googlePhotoUrlsMatch(photo, excludeUri) && photo !== excludeUri);
  return nextGoogle || "";
};

const isRemoteImageUri = (uri) => uri && (uri.startsWith("http://") || uri.startsWith("https://"));
const isLocalImageUri = (uri) => uri && !isRemoteImageUri(uri);
const isBlobOrDataUri = (uri) => uri && (uri.startsWith("blob:") || uri.startsWith("data:"));

const inferProfileImageFileMeta = (uri, galleryItem) => {
  if (galleryItem?.webFile?.name) {
    const parts = galleryItem.webFile.name.split(".");
    const fileType = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "jpg";
    return { fileType, mimeType: `image/${fileType === "jpg" ? "jpeg" : fileType}` };
  }
  if (uri?.startsWith("data:image/")) {
    const match = uri.match(/data:image\/(\w+)/);
    const fileType = match ? (match[1] === "jpeg" ? "jpg" : match[1]) : "jpg";
    return { fileType, mimeType: `image/${fileType === "jpg" ? "jpeg" : fileType}` };
  }
  const extRaw =
    String(uri || "")
      .split(".")
      .pop() || "jpg";
  const fileType = extRaw.split("?")[0].toLowerCase().replace("jpeg", "jpg") || "jpg";
  return { fileType, mimeType: `image/${fileType === "jpg" ? "jpeg" : fileType}` };
};

/** Reference an object already stored on S3 (no browser fetch — S3 CORS blocks localhost). */
const appendS3ProfileReference = (payload, galleryItem, profileUri, uid) => {
  const s3Key = galleryItem?.s3Key || normalizeBusinessUploadKey(profileUri, uid);
  const fullUri = resolveBusinessUploadUri(s3Key || profileUri, uid) || profileUri;
  payload.append("business_profile_img", s3Key && !s3Key.startsWith("http") ? s3Key : fullUri);
  return true;
};

const profileUriIsOnS3 = (profileUri, galleryItem, uid) => {
  if (isPermanentS3Url(profileUri) && !isGoogleHostedPhotoUrl(profileUri)) return true;
  const s3Key = galleryItem?.s3Key || normalizeBusinessUploadKey(profileUri, uid);
  return Boolean(s3Key && !s3Key.startsWith("http") && (isPersistedGoogleS3Url(s3Key) || isBusinessUserUploadImage(s3Key)));
};

/** Set profile from an already-uploaded gallery image (re-upload file or reference existing S3 object). */
const appendExistingUploadAsProfile = async (payload, galleryItem, profileUri, uid) => {
  const s3Key = galleryItem?.s3Key || normalizeBusinessUploadKey(profileUri, uid);
  const fullUri = resolveBusinessUploadUri(s3Key || profileUri, uid) || profileUri;
  const extRaw = (s3Key || fullUri).split(".").pop() || "jpg";
  const fileType = extRaw.split("?")[0].toLowerCase().replace("jpeg", "jpg") || "jpg";
  const mimeType = `image/${fileType === "jpg" ? "jpeg" : fileType}`;
  const profileFileName = `business_profile_img.${fileType}`;

  if (Platform.OS === "web" && galleryItem?.webFile) {
    payload.append("business_profile_img", new File([galleryItem.webFile], profileFileName, { type: mimeType }));
    return true;
  }

  if (profileUriIsOnS3(profileUri, galleryItem, uid)) {
    return appendS3ProfileReference(payload, galleryItem, profileUri, uid);
  }

  if (isRemoteImageUri(fullUri) && !isGoogleHostedPhotoUrl(fullUri)) {
    try {
      const response = await fetch(fullUri);
      if (response.ok) {
        const blob = await response.blob();
        if (Platform.OS === "web") {
          payload.append("business_profile_img", new File([blob], profileFileName, { type: blob.type || mimeType }));
        } else {
          payload.append("business_profile_img", { uri: fullUri, type: mimeType, name: profileFileName });
        }
        return true;
      }
    } catch (err) {
      console.warn("appendExistingUploadAsProfile fetch failed, using existing S3 reference:", err);
    }
  }

  return appendS3ProfileReference(payload, galleryItem, profileUri, uid);
};

const profileUriNeedsGoogleBlob = (uri) => isGoogleHostedPhotoUrl(uri) || isEphemeralGooglePhotoUrl(uri);

/** After step-1 PUT persists business_google_photos, resolve matching google_photo_* S3 URL for profile. */
const resolveGoogleProfileS3AfterSave = (biz, selectedUri, photosSent, uid, s3Before) => {
  const selected = resolveRestGooglePhotoUrl(selectedUri) || selectedUri;
  const after = parseBusinessGooglePhotos(biz?.business_google_photos).map((raw) => (isPermanentS3Url(raw) ? raw : resolveBusinessUploadUri(raw, uid)));
  const sent = photosSent || [];
  let idx = sent.findIndex((u) => u === selected || googlePhotoUrlsMatch(u, selected));
  if (idx < 0) {
    const selRef = extractGooglePhotoReference(selected);
    if (selRef) {
      idx = sent.findIndex((u) => extractGooglePhotoReference(u) === selRef);
    }
  }
  if (idx >= 0 && after[idx] && isPersistedGoogleS3Url(after[idx])) return after[idx];

  const beforeKeys = new Set((s3Before || []).map((u) => normalizeBusinessUploadKey(u, uid)));
  const newS3 = after.filter((u) => isPersistedGoogleS3Url(u) && !beforeKeys.has(normalizeBusinessUploadKey(u, uid)));
  if (newS3.length === 0) return "";

  const freshSent = sent.filter((u) => isGoogleHostedPhotoUrl(u));
  const freshIdx = freshSent.findIndex((u) => u === selected || googlePhotoUrlsMatch(u, selected));
  if (freshIdx >= 0 && newS3[freshIdx]) return newS3[freshIdx];
  return newS3[0];
};

/** Download Google/gallery/local profile source and append business_profile_img as a file upload. */
const appendProfileImageAsFile = async (payload, profileUri, galleryItem, uid) => {
  if (!profileUri) return false;

  const { fileType, mimeType } = inferProfileImageFileMeta(profileUri, galleryItem);
  const profileFileName = `business_profile_img.${fileType}`;

  if (Platform.OS === "web" && galleryItem?.webFile) {
    payload.append("business_profile_img", new File([galleryItem.webFile], profileFileName, { type: galleryItem.webFile.type || mimeType }));
    return true;
  }

  if (isBlobOrDataUri(profileUri)) {
    try {
      const response = await fetch(profileUri);
      const blob = await response.blob();
      const type = blob.type || mimeType;
      const ext = type.split("/")[1]?.replace("jpeg", "jpg") || fileType;
      const name = `business_profile_img.${ext}`;
      if (Platform.OS === "web") {
        payload.append("business_profile_img", new File([blob], name, { type }));
      } else {
        payload.append("business_profile_img", { uri: profileUri, type, name });
      }
      return true;
    } catch (err) {
      console.warn("appendProfileImageAsFile blob/data failed:", err);
      return false;
    }
  }

  if (Platform.OS !== "web" && isLocalImageUri(profileUri)) {
    payload.append("business_profile_img", { uri: profileUri, type: mimeType, name: profileFileName });
    return true;
  }

  if (profileUriNeedsGoogleBlob(profileUri)) {
    const downloadUrl = resolveRestGooglePhotoUrl(profileUri) || profileUri;
    if (Platform.OS === "web") {
      // Browser cannot fetch Google photo bytes (CORS). Caller defers profile to step-2 PUT.
      return false;
    }
    try {
      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (baseDir) {
        const tempUri = `${baseDir}${profileFileName}`;
        const downloaded = await FileSystem.downloadAsync(downloadUrl, tempUri);
        if (downloaded.status === 200) {
          payload.append("business_profile_img", { uri: downloaded.uri, type: mimeType, name: profileFileName });
          return true;
        }
      }
    } catch (err) {
      console.warn("appendProfileImageAsFile Google native download failed:", err);
    }
    return false;
  }

  if (isRemoteImageUri(profileUri)) {
    if (profileUriIsOnS3(profileUri, galleryItem, uid)) {
      return appendS3ProfileReference(payload, galleryItem, profileUri, uid);
    }

    try {
      if (Platform.OS === "web") {
        const response = await fetch(profileUri);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const type = blob.type || mimeType;
        const ext = type.split("/")[1]?.replace("jpeg", "jpg") || fileType;
        payload.append("business_profile_img", new File([blob], `business_profile_img.${ext}`, { type }));
        return true;
      }

      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!baseDir) throw new Error("No cache directory");
      const tempUri = `${baseDir}${profileFileName}`;
      const downloaded = await FileSystem.downloadAsync(profileUri, tempUri);
      if (downloaded.status !== 200) throw new Error(`Download ${downloaded.status}`);
      payload.append("business_profile_img", { uri: downloaded.uri, type: mimeType, name: profileFileName });
      return true;
    } catch (err) {
      console.warn("appendProfileImageAsFile remote download failed:", err);
      if (!isGoogleHostedPhotoUrl(profileUri)) {
        return appendExistingUploadAsProfile(payload, galleryItem, profileUri, uid);
      }
      return false;
    }
  }

  return appendExistingUploadAsProfile(payload, galleryItem, profileUri, uid);
};

const SERVICE_CURRENCY_OPTIONS = [
  { label: "USD", value: "USD" },
  { label: "EUR", value: "EUR" },
  { label: "GBP", value: "GBP" },
  { label: "CAD", value: "CAD" },
  { label: "AUD", value: "AUD" },
  { label: "JPY", value: "JPY" },
  { label: "INR", value: "INR" },
  { label: "MXN", value: "MXN" },
];

const SERVICE_COST_UNIT_OPTIONS = [
  { label: "total", value: "total" },
  { label: "/each", value: "each" },
  { label: "/hr", value: "hr" },
  { label: "/day", value: "day" },
  { label: "/week", value: "week" },
  { label: "/2 weeks", value: "2 weeks" },
  { label: "/month", value: "month" },
  { label: "/quarter", value: "quarter" },
  { label: "/year", value: "year" },
];

const parseServiceCost = (cost) => {
  if (!cost || String(cost).trim() === "") {
    return { amount: "", unit: "" };
  }
  if (String(cost).toLowerCase() === "free") {
    return { amount: "Free", unit: "" };
  }
  const cleaned = String(cost).replace(/\$/g, "").trim();
  if (cleaned.toLowerCase().endsWith("total")) {
    const amount = cleaned.replace(/total$/i, "").trim();
    return { amount: amount || "Free", unit: "total" };
  }
  const parts = cleaned.split("/");
  if (parts.length >= 2) {
    const amount = parts[0].trim();
    const unit = parts.slice(1).join("/").trim();
    return { amount, unit };
  }
  return { amount: cleaned, unit: "" };
};

const serviceCostHasUnit = (cost) => {
  if (!cost || String(cost).trim() === "") return true;
  const unit = String(cost).match(/\/(hr|day|week|2 weeks|month|quarter|year|each)$|(\btotal\b)/i);
  return !!unit;
};

const returnWindowDaysForForm = (service) => {
  if (!normServiceReturnable(service)) return "0";
  const days = normServiceReturnWindowDays(service);
  return days > 0 ? String(days) : DEFAULT_RETURN_WINDOW_DAYS;
};

const ChoiceGroupsEditor = ({ groups = [], onChange, darkMode }) => {
  const addGroup = () => {
    onChange([
      ...groups,
      {
        id: Date.now(),
        title: "",
        type: "single", // single | multi
        required: false,
        max_selections: 1,
        options: [],
      },
    ]);
  };

  const removeGroup = (gIdx) => onChange(groups.filter((_, i) => i !== gIdx));

  const updateGroup = (gIdx, field, value) => {
    const next = groups.map((g, i) => (i === gIdx ? { ...g, [field]: value } : g));
    onChange(next);
  };

  const addOption = (gIdx) => {
    const next = groups.map((g, i) => (i === gIdx ? { ...g, options: [...(g.options || []), { id: Date.now(), label: "", extra_cost: "" }] } : g));
    onChange(next);
  };

  const removeOption = (gIdx, oIdx) => {
    const next = groups.map((g, i) => (i === gIdx ? { ...g, options: g.options.filter((_, j) => j !== oIdx) } : g));
    onChange(next);
  };

  const updateOption = (gIdx, oIdx, field, value) => {
    const next = groups.map((g, i) =>
      i === gIdx
        ? {
            ...g,
            options: g.options.map((o, j) => (j === oIdx ? { ...o, [field]: value } : o)),
          }
        : g,
    );
    onChange(next);
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: darkMode ? "#555" : "#ddd",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 14,
    color: darkMode ? "#fff" : "#000",
    backgroundColor: darkMode ? "#2d2d2d" : "#fff",
    flex: 1,
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: "700",
    color: darkMode ? "#ccc" : "#555",
    marginBottom: 4,
    marginTop: 8,
  };

  return (
    <View>
      {groups.map((group, gIdx) => (
        <View
          key={group.id || gIdx}
          style={{
            borderWidth: 1,
            borderColor: darkMode ? "#555" : "#ddd",
            borderRadius: 10,
            padding: 12,
            marginBottom: 10,
            backgroundColor: darkMode ? "#333" : "#fafafa",
          }}
        >
          {/* Group header */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ flex: 1, fontWeight: "700", fontSize: 13, color: darkMode ? "#fff" : "#333" }}>Choice Group {gIdx + 1}</Text>
            <TouchableOpacity onPress={() => removeGroup(gIdx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name='close-circle' size={20} color='#ef4444' />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={labelStyle}>Group Title (e.g. "Choice of Meat")</Text>
          <TextInput style={inputStyle} value={group.title} onChangeText={(t) => updateGroup(gIdx, "title", t)} placeholder='e.g. Choice of Meat' placeholderTextColor={darkMode ? "#888" : "#999"} />

          {/* Type: single vs multi */}
          <Text style={labelStyle}>Selection Type</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
            {["single", "multi"].map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => updateGroup(gIdx, "type", t)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: group.type === t ? "#9C45F7" : darkMode ? "#555" : "#ccc",
                  backgroundColor: group.type === t ? "#9C45F7" : "transparent",
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: group.type === t ? "#fff" : darkMode ? "#ccc" : "#555" }}>{t === "single" ? "Choose 1" : "Choose Multiple"}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Max selections (multi only) */}
          {group.type === "multi" && (
            <>
              <Text style={labelStyle}>Max Selections</Text>
              <TextInput
                style={[inputStyle, { flex: 0, width: 80 }]}
                value={String(group.max_selections || "")}
                onChangeText={(t) => updateGroup(gIdx, "max_selections", t.replace(/\D/g, ""))}
                keyboardType='number-pad'
                placeholder='e.g. 2'
                placeholderTextColor={darkMode ? "#888" : "#999"}
              />
            </>
          )}

          {/* Required toggle */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, marginBottom: 6 }}>
            <TouchableOpacity onPress={() => updateGroup(gIdx, "required", !group.required)} activeOpacity={0.7}>
              <Ionicons name={group.required ? "checkbox" : "square-outline"} size={20} color={group.required ? "#9C45F7" : darkMode ? "#aaa" : "#666"} />
            </TouchableOpacity>
            <Text style={{ fontSize: 13, color: darkMode ? "#ddd" : "#444" }}>Required</Text>
            <Text style={{ fontSize: 11, color: darkMode ? "#888" : "#999" }}>{group.required ? `(REQUIRED)` : `(OPTIONAL)`}</Text>
            {group.type === "multi" && <Text style={{ fontSize: 11, color: darkMode ? "#888" : "#999" }}>· UP TO {group.max_selections || 1}</Text>}
          </View>

          {/* Options */}
          <Text style={labelStyle}>Options</Text>
          {(group.options || []).map((opt, oIdx) => (
            <View key={opt.id || oIdx} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Ionicons name={group.type === "single" ? "radio-button-off" : "square-outline"} size={16} color={darkMode ? "#888" : "#aaa"} />
              <TextInput
                style={[inputStyle, { flex: 2 }]}
                value={opt.label}
                onChangeText={(t) => updateOption(gIdx, oIdx, "label", t)}
                placeholder='Option name'
                placeholderTextColor={darkMode ? "#888" : "#999"}
              />
              <Text style={{ color: darkMode ? "#888" : "#999", fontSize: 13 }}>+$</Text>
              <TextInput
                style={[inputStyle, { flex: 1, minWidth: 60 }]}
                value={opt.extra_cost}
                onChangeText={(t) => updateOption(gIdx, oIdx, "extra_cost", t.replace(/[^0-9.]/g, ""))}
                placeholder='0.00'
                keyboardType='decimal-pad'
                placeholderTextColor={darkMode ? "#888" : "#999"}
              />
              <TouchableOpacity onPress={() => removeOption(gIdx, oIdx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name='close-circle-outline' size={18} color='#ef4444' />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            onPress={() => addOption(gIdx)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 4,
              paddingVertical: 6,
            }}
          >
            <Ionicons name='add-circle-outline' size={18} color='#9C45F7' />
            <Text style={{ fontSize: 13, color: "#9C45F7", fontWeight: "600" }}>Add Option</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        onPress={addGroup}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: darkMode ? "#666" : "#bbb",
          marginTop: 4,
        }}
      >
        <Ionicons name='add-circle-outline' size={18} color={darkMode ? "#aaa" : "#666"} />
        <Text style={{ fontSize: 13, color: darkMode ? "#aaa" : "#666", fontWeight: "600" }}>Add Choice Group</Text>
      </TouchableOpacity>
    </View>
  );
};

const EditBusinessProfileScreen = ({ route, navigation }) => {
  const { darkMode } = useDarkMode();
  const { business, business_users } = route.params || {};
  const [businessUID, setBusinessUID] = useState(business?.business_uid || "");
  const scrollViewRef = useRef(null);
  const fileInputRef = useRef(null); // For web gallery file input
  const serviceImageFileInputRef = useRef(null); // Product/service image (web)
  const serviceSalesTaxSectionRef = useRef(null);
  const serviceTaxRateInputRef = useRef(null);
  const serviceQuantitySectionRef = useRef(null);
  const serviceQuantityInputRef = useRef(null);
  const pendingRemoveActionRef = useRef(null);
  /** Skip unsaved `beforeRemove` while navigating away after a successful submit (isChanged clears async). */
  const suppressLeavePromptRef = useRef(false);
  const googlePhotosUserEditedRef = useRef(false);

  // Business profile image state (backend: business_profile_img, delete_business_profile_img, business_profile_img_is_public)
  // Profile image comes from business_profile_img; other images stay in business_images_url
  const initialProfileImage = resolveBusinessProfileImgUrl(business, business?.business_uid || "") || "";
  const [originalFavoriteImage, setOriginalFavoriteImage] = useState(business?.business_favorite_image || initialProfileImage);
  const [originalBusinessImage, setOriginalBusinessImage] = useState(initialProfileImage);
  const [businessImage, setBusinessImage] = useState(initialProfileImage);
  const [businessImageUri, setBusinessImageUri] = useState(initialProfileImage);
  const [deleteBusinessProfileImg, setDeleteBusinessProfileImg] = useState(""); // Full S3 URL to remove (backend: delete_business_profile_img)
  const [imageError, setImageError] = useState(false);
  const [webImageFile, setWebImageFile] = useState(null); // Legacy; gallery items store webFile per upload
  const [imageUpdateKey, setImageUpdateKey] = useState(0); // Key to force MiniCard re-render when image changes
  const [galleryUploads, setGalleryUploads] = useState(() =>
    dedupeGalleryUploadsByS3Key(
      reconcileGalleryUploadsWithProfile(
        parseInitialGalleryUploads(business, business?.business_uid || ""),
        resolveBusinessProfileImgUrl(business, business?.business_uid || "") || "",
        business?.business_uid || "",
      ),
      business?.business_uid || "",
    ),
  );
  const [deletedGalleryImageUrls, setDeletedGalleryImageUrls] = useState([]);
  const [refreshingGooglePhotos, setRefreshingGooglePhotos] = useState(false);
  const [showGooglePhotosPanel, setShowGooglePhotosPanel] = useState(false);
  const [googlePanelPhotos, setGooglePanelPhotos] = useState([]);
  const googlePanelTouchedRef = useRef(false);
  const googlePanelPhotosRef = useRef([]);
  const galleryUserTouchedRef = useRef(false);
  const galleryUploadsRef = useRef([]);
  const businessImageUriRef = useRef("");

  const businessGoogleId = business?.business_google_id || business?.googleId || "";

  // Product/service row image (multipart bs_service_image_{index} on save; bs_image_key in business_services JSON)
  const [serviceProductImageUri, setServiceProductImageUri] = useState("");
  const [originalServiceProductImage, setOriginalServiceProductImage] = useState("");
  const [serviceProductWebFile, setServiceProductWebFile] = useState(null);
  const [serviceProductImageError, setServiceProductImageError] = useState(false);

  // BUSINESS-SPECIFIC: Category selection (3-level hierarchy like BusinessStep2) - must be before useEffects that use them
  const [allCategories, setAllCategories] = useState([]);
  const [mainCategories, setMainCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [subSubCategories, setSubSubCategories] = useState([]);
  const [selectedMain, setSelectedMain] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);
  const [selectedSubSub, setSelectedSubSub] = useState(null);
  const hasInitializedSub = useRef(false);
  const hasInitializedSubSub = useRef(false);

  useEffect(() => {
    galleryUploadsRef.current = galleryUploads;
  }, [galleryUploads]);

  useEffect(() => {
    businessImageUriRef.current = businessImageUri;
  }, [businessImageUri]);

  useEffect(() => {
    googlePanelPhotosRef.current = googlePanelPhotos;
  }, [googlePanelPhotos]);

  const loadGalleryFromBusiness = useCallback((sourceBusiness, uid, profileOverride = "") => {
    const profileImgUrl = profileOverride || resolveBusinessProfileImgUrl(sourceBusiness, uid) || "";
    const parsed = dedupeGalleryUploadsByS3Key(reconcileGalleryUploadsWithProfile(buildBusinessGalleryUploads(sourceBusiness, uid), profileImgUrl, uid), uid);
    setGalleryUploads(parsed);
    const profileUrl = profileImgUrl;
    if (profileUrl) {
      setBusinessImageUri(profileUrl);
      setBusinessImage(profileUrl);
      setOriginalBusinessImage(profileUrl);
      setOriginalFavoriteImage(sourceBusiness?.business_favorite_image || profileUrl);
    }
  }, []);

  useEffect(() => {
    console.log("EditBusinessProfileScreen - Screen Mounted");
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const refreshGalleryFromApi = async () => {
        if (!businessUID || galleryUserTouchedRef.current) return;
        try {
          const res = await fetch(`${BUSINESS_INFO_ENDPOINT}/${businessUID}`);
          const result = await res.json();
          const raw = result?.business;
          if (!raw || cancelled || galleryUserTouchedRef.current) return;
          const mergedBusiness = {
            ...business,
            ...raw,
            business_uid: businessUID,
            business_profile_img: coalesceBusinessProfileImg(raw?.business_profile_img, business?.business_profile_img),
            business_images_url: raw?.business_images_url ?? business?.business_images_url,
            business_google_photos: raw?.business_google_photos ?? business?.business_google_photos,
            business_favorite_image: raw?.business_favorite_image ?? business?.business_favorite_image,
          };
          loadGalleryFromBusiness(mergedBusiness, businessUID);
        } catch (e) {
          console.warn("EditBusinessProfileScreen - could not refresh gallery uploads:", e);
        }
      };
      refreshGalleryFromApi();
      return () => {
        cancelled = true;
      };
    }, [businessUID, business, loadGalleryFromBusiness]),
  );

  useEffect(() => {
    if (galleryUserTouchedRef.current) return;
    const uid = businessUID || business?.business_uid || "";
    if (!businessImageUri) return;
    setGalleryUploads((prev) => {
      const reconciled = reconcileGalleryUploadsWithProfile(prev, businessImageUri, uid);
      return dedupeGalleryUploadsByS3Key(reconciled, uid);
    });
  }, [businessImageUri, businessUID, business?.business_uid]);

  // Fetch categories and initialize from business_category_id
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(CATEGORY_LIST_ENDPOINT);
        const json = await res.json();
        const categories = json.result || [];
        setAllCategories(categories);
        setMainCategories(categories.filter((c) => c.category_parent_id === null));

        // Initialize from existing business_category_id (comma-separated: main, sub, sub-sub)
        const categoryIdStr = business?.business_category_id || "";
        if (categoryIdStr.trim()) {
          const ids = categoryIdStr
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean);
          if (ids.length > 0) setSelectedMain(ids[0]);
          if (ids.length > 1) setSelectedSub(ids[1]);
          if (ids.length > 2) setSelectedSubSub(ids[2]);
        }
      } catch (e) {
        console.error("EditBusinessProfileScreen - Fetch category error:", e);
      }
    };
    fetchCategories();
  }, [business?.business_category_id]);

  useEffect(() => {
    const updated = allCategories.filter((c) => c.category_parent_id === selectedMain);
    setSubCategories(updated);
    setSelectedSub((prev) => (prev && updated.some((c) => c.category_uid === prev) ? prev : null));
    setSelectedSubSub(null);
    setSubSubCategories([]);
  }, [selectedMain, allCategories]);

  useEffect(() => {
    if (!selectedSub) {
      setSubSubCategories([]);
      return;
    }
    const updated = allCategories.filter((c) => c.category_parent_id === selectedSub);
    setSubSubCategories(updated);
    setSelectedSubSub((prev) => (prev && updated.some((c) => c.category_uid === prev) ? prev : null));
  }, [selectedSub, allCategories]);

  // Initialize sub/sub-sub from business_category_id (run once when categories first load)
  useEffect(() => {
    const ids =
      business?.business_category_id
        ?.split(",")
        .map((id) => id.trim())
        .filter(Boolean) || [];
    if (!hasInitializedSub.current && ids.length > 1 && subCategories.length > 0 && subCategories.some((c) => c.category_uid === ids[1])) {
      setSelectedSub(ids[1]);
      hasInitializedSub.current = true;
    }
  }, [subCategories, business?.business_category_id]);
  useEffect(() => {
    const ids =
      business?.business_category_id
        ?.split(",")
        .map((id) => id.trim())
        .filter(Boolean) || [];
    if (!hasInitializedSubSub.current && ids.length > 2 && subSubCategories.length > 0 && subSubCategories.some((c) => c.category_uid === ids[2])) {
      setSelectedSubSub(ids[2]);
      hasInitializedSubSub.current = true;
    }
  }, [subSubCategories, business?.business_category_id]);

  const [formData, setFormData] = useState(() => ({
    // BUSINESS-SPECIFIC: Different field names - uses business_* instead of profile_personal_*
    name: business?.business_name || "",
    location: business?.business_location || "",
    addressLine2: business?.business_address_line_1 || "",
    city: business?.business_city || "",
    state: business?.business_state || "",
    country: business?.business_country || "",
    zip: business?.business_zip_code || "",
    coordinates: formatCoordinatePairForInput(business?.business_latitude, business?.business_longitude),
    phone: business?.business_phone_number || "",
    email: business?.business_email_id || business?.business_email || "",
    category: business?.business_category || "",
    tagline: business?.business_tag_line || business?.tagline || "",
    shortBio: business?.business_short_bio || business?.short_bio || "",
    businessRole: business?.business_role || business?.role || business?.bu_role || "",
    einNumber: business?.business_ein_number || "",
    businessPaysCcFee: businessPaysCcFeeFromApiPayer(business?.business_cc_fee_payer ?? business?.bs_cc_fee_payer ?? business?.business_bs_cc_fee_payer ?? business?.cc_fee_payer),
    website: business?.business_website || "",
    // BUSINESS-SPECIFIC: customTags array (not in EditProfileScreen)
    customTags: (() => {
      // Handle custom_tags - could be array, string, or already parsed as customTags
      // Also check for 'tags' field from backend API
      if (business?.customTags && Array.isArray(business.customTags)) {
        return business.customTags;
      }
      if (business?.tags && Array.isArray(business.tags)) {
        return business.tags;
      }
      if (business?.custom_tags && Array.isArray(business.custom_tags)) {
        return business.custom_tags;
      }
      if (business?.custom_tags && typeof business.custom_tags === "string") {
        try {
          const parsed = JSON.parse(business.custom_tags);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        } catch (e) {
          /* ignore invalid JSON */
        }
      }
      return [];
    })(),
    // Business image is now handled separately in state (like EditProfileScreen)
    // BUSINESS-SPECIFIC: Social links as object with nested properties (EditProfileScreen has separate fields: facebook, twitter, linkedin, youtube)
    socialLinks: {
      facebook: business?.facebook || "",
      instagram: business?.instagram || "",
      linkedin: business?.linkedin || "",
      youtube: business?.youtube || "",
    },
    emailIsPublic: business?.business_email_id_is_public === "1" || business?.email_is_public === "1" || business?.emailIsPublic === true,
    phoneIsPublic: business?.business_phone_number_is_public === "1" || business?.phone_is_public === "1" || business?.phoneIsPublic === true,
    taglineIsPublic: business?.business_tag_line_is_public === "1" || business?.tagline_is_public === "1" || business?.taglineIsPublic === true,
    shortBioIsPublic: business?.business_short_bio_is_public === "1" || business?.short_bio_is_public === "1" || business?.shortBioIsPublic === true,
    imageIsPublic:
      business?.business_profile_img_is_public === "1" ||
      business?.business_profile_img_is_public === 1 ||
      business?.business_image_is_public === "1" ||
      business?.image_is_public === "1" ||
      business?.imageIsPublic === true ||
      false,
    locationIsPublic: business?.business_location_is_public === "1" || business?.business_location_is_public === 1 || false,
    business_updated_at: business?.business_updated_at ?? business?.updated_at ?? "",
    // MISSING: Section visibility flags (EditProfileScreen has: experienceIsPublic, educationIsPublic, expertiseIsPublic, wishesIsPublic, businessIsPublic)
    // Note: Business profile doesn't have these sections, so these flags are not needed
    // MISSING: Arrays for experience, education, expertise, wishes, businesses (EditProfileScreen has these)
    // Note: Business profile uses services array instead (handled separately below)
  }));

  // BUSINESS-SPECIFIC: deletedItems structure is different - tracks deleted business users instead of experience/education/etc.
  // MISSING: deletedItems state object with arrays for experiences, educations, expertises, wishes, businesses (EditProfileScreen has this)
  // Note: Business profile doesn't have these sections, so deletedItems is not needed in the same way
  // BUSINESS-SPECIFIC: deletedBusinessUsers array tracks deleted business users instead

  // MISSING: showBusinessModal and pendingBusinessNames states (EditProfileScreen has these for business approval)
  // Note: Not needed for business profile editing
  // MISSING: shortBioHeight state (EditProfileScreen has this for dynamic textarea height)
  // Note: Could be added if shortBio textarea needs dynamic height
  // MISSING: fileInputRef for web file input (EditProfileScreen has this)
  // Note: Could be added if web image upload is needed for business images
  // MISSING: imageUpdateKey state (EditProfileScreen has this to force MiniCard re-render)
  // Note: Could be added if MiniCard preview needs to update when images change

  // Validation state - computed after formData is initialized
  const isValid = useMemo(() => {
    // BUSINESS-SPECIFIC: Validates name instead of firstName and lastName
    return formData.name.trim() && businessUID.trim();
  }, [formData.name, businessUID]);

  // BUSINESS-SPECIFIC: Additional state for business-specific features
  const [customTagInput, setCustomTagInput] = useState("");
  const [productTagInput, setProductTagInput] = useState("");
  const [additionalBusinessUsers, setAdditionalBusinessUsers] = useState([]);
  const [existingBusinessUsers, setExistingBusinessUsers] = useState(Array.isArray(business_users) ? business_users : []);
  const [deletedBusinessUsers, setDeletedBusinessUsers] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isChanged, setIsChanged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [coordinatesError, setCoordinatesError] = useState("");
  const [placeSearchText, setPlaceSearchText] = useState("");
  const [placeSuggestions, setPlaceSuggestions] = useState([]);
  const [placeSearchLoading, setPlaceSearchLoading] = useState(false);
  const placesDebounceRef = useRef(null);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  // BUSINESS-SPECIFIC: businessRoles constant (not in EditProfileScreen)
  const businessRoles = [
    { label: "Owner", value: "owner" },
    { label: "Employee", value: "employee" },
    { label: "Partner", value: "partner" },
    { label: "Admin", value: "admin" },
    { label: "Other", value: "other" },
  ];

  // BUSINESS-SPECIFIC: formatEINNumber function (not in EditProfileScreen)
  const formatEINNumber = (text) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, "");

    // Limit to 9 digits (2 + 7)
    if (cleaned.length > 9) {
      return text.slice(0, -1);
    }

    // Format based on length: ##-#######
    if (cleaned.length === 0) return "";
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 9) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
    return text;
  };

  const toggleVisibility = (fieldName) => {
    setFormData((prev) => {
      const newValue = !prev[fieldName];
      const updated = { ...prev, [fieldName]: newValue };

      // MISSING: Comments about section-level toggles (EditProfileScreen has detailed comments)
      // Note: Business profile doesn't have section-level toggles like experienceIsPublic, etc.

      return updated;
    });
    setIsChanged(true);
  };

  // Update all field changes to set isChanged to true
  const handleFieldChange = (fieldName, value) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    setIsChanged(true);
  };

  const onPlaceSearchChange = (text) => {
    setPlaceSearchText(text);
    if (placesDebounceRef.current) clearTimeout(placesDebounceRef.current);
    if (!text.trim()) {
      setPlaceSuggestions([]);
      return;
    }
    placesDebounceRef.current = setTimeout(async () => {
      try {
        const results = await getBusinessSuggestions(text);
        setPlaceSuggestions(results);
      } catch (err) {
        console.error("EditBusinessProfile place suggestions error:", err);
      }
    }, 350);
  };

  const handleGooglePlaceSelect = async (place) => {
    setPlaceSuggestions([]);
    setPlaceSearchText(place.structured_formatting?.main_text || place.description || "");
    setPlaceSearchLoading(true);
    try {
      const pd = await getPlaceDetails(place.place_id);
      setFormData((prev) => {
        const coordsStr = pd.lat != null && pd.lng != null ? formatCoordinatePairForInput(pd.lat, pd.lng) : prev.coordinates;
        return {
          ...prev,
          location: pd.formatted_address || prev.location,
          addressLine2: pd.address_line_1 || pd.formatted_address || prev.addressLine2,
          city: pd.city || prev.city,
          state: pd.state || prev.state,
          country: pd.country || prev.country,
          zip: pd.zip || prev.zip,
          coordinates: coordsStr,
        };
      });
      setCoordinatesError("");
      setIsChanged(true);
    } catch (err) {
      console.error("EditBusinessProfile place select error:", err);
      Alert.alert("Error", "Could not load place details. Please try again.");
    } finally {
      setPlaceSearchLoading(false);
    }
  };

  // Update all toggles to set isChanged to true
  const handleToggleVisibility = (fieldName) => {
    setIsChanged(true);
    toggleVisibility(fieldName);
  };

  const selectProfileImage = (uri) => {
    if (!uri) return;
    const normalized = profileUriNeedsGoogleBlob(uri) ? resolveRestGooglePhotoUrl(uri) || uri : uri;
    galleryUserTouchedRef.current = true;
    businessImageUriRef.current = normalized;
    setBusinessImageUri(normalized);
    setBusinessImage(normalized);
    setWebImageFile(null);
    setImageError(false);
    setImageUpdateKey((prev) => prev + 1);
    setIsChanged(true);
  };

  const addGalleryUpload = (uri, webFile = null) => {
    galleryUserTouchedRef.current = true;
    const newItem = {
      id: `new-${Date.now()}`,
      uri,
      s3Key: null,
      isNew: true,
      webFile,
    };
    setGalleryUploads((prev) => {
      const next = [...prev, newItem];
      galleryUploadsRef.current = next;
      return next;
    });
    if (!businessImageUri || imageError) {
      selectProfileImage(uri);
    }
    setIsChanged(true);
  };

  const handleWebImagePick = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      Alert.alert("File not selectable", `Image size (${(file.size / 1024).toFixed(1)} KB) exceeds the 2MB upload limit.`);
      return;
    }

    if (!file.type.startsWith("image/")) {
      Alert.alert("Invalid file type", "Please select an image file.");
      return;
    }

    const reader = new FileReader();
    const previewUri = URL.createObjectURL(file);
    addGalleryUpload(previewUri, file);
    reader.onloadend = () => {
      if (reader.result) {
        setGalleryUploads((prev) => {
          const next = prev.map((item) => (item.uri === previewUri ? { ...item, uri: reader.result, webFile: file } : item));
          galleryUploadsRef.current = next;
          return next;
        });
        if (businessImageUriRef.current === previewUri) {
          businessImageUriRef.current = reader.result;
          setBusinessImageUri(reader.result);
          setBusinessImage(reader.result);
        }
      }
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePickGalleryImage = async () => {
    if (Platform.OS === "web") {
      fileInputRef.current?.click();
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Permission to access media library is required!");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let fileSize = asset.fileSize;
        if (!fileSize && asset.uri) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(asset.uri);
            fileSize = fileInfo.size;
          } catch (e) {
            console.log("Could not get file size from FileSystem", e);
          }
        }
        if (fileSize && fileSize > 2 * 1024 * 1024) {
          Alert.alert("File not selectable", `Image size (${(fileSize / 1024).toFixed(1)} KB) exceeds the 2MB upload limit.`);
          return;
        }
        addGalleryUpload(asset.uri);
        selectProfileImage(asset.uri);
      }
    } catch (error) {
      let errorMessage = "Failed to pick image. ";
      if (error.name === "PermissionDenied") {
        errorMessage += "Permission was denied.";
      } else if (error.message?.includes("permission")) {
        errorMessage += "Permission issue detected.";
      } else if (error.message?.includes("canceled")) {
        errorMessage += "Operation was canceled.";
      }
      Alert.alert("Error", errorMessage);
    }
  };

  const removeGooglePhoto = (uri, index) => {
    googlePhotosUserEditedRef.current = true;
    googlePanelTouchedRef.current = true;
    const photos = googlePanelPhotos || [];
    const updatedPhotos = dedupeGooglePhotoUrls([...photos.slice(0, index), ...photos.slice(index + 1)]);
    setGooglePanelPhotos(updatedPhotos);
    if (updatedPhotos.length === 0) {
      setShowGooglePhotosPanel(false);
    }
    if (googlePhotoUrlsMatch(businessImageUri, uri)) {
      const next = pickNextProfileImage(updatedPhotos, galleryUploads, uri);
      if (next) {
        selectProfileImage(next);
      } else {
        if (originalBusinessImage === uri && isRemoteImageUri(uri)) {
          setDeleteBusinessProfileImg(uri);
        }
        setBusinessImageUri("");
        setBusinessImage("");
        setImageUpdateKey((prev) => prev + 1);
      }
    }
    setIsChanged(true);
  };

  const removeGalleryUpload = (index) => {
    const item = galleryUploads[index];
    if (!item) return;
    galleryUserTouchedRef.current = true;
    const removedUri = item.uri;
    if (!item.isNew && isRemoteImageUri(removedUri)) {
      setDeletedGalleryImageUrls((prev) => [...prev, removedUri]);
      if (googlePhotoUrlsMatch(originalBusinessImage, removedUri)) {
        setDeleteBusinessProfileImg(removedUri);
      }
    }
    const updated = [...galleryUploads.slice(0, index), ...galleryUploads.slice(index + 1)];
    setGalleryUploads(updated);
    if (businessImageUri === removedUri) {
      const next = pickNextProfileImage(googlePanelPhotos, updated, removedUri);
      if (next) {
        selectProfileImage(next);
      } else {
        if (originalBusinessImage === removedUri && isRemoteImageUri(removedUri)) {
          setDeleteBusinessProfileImg(removedUri);
        }
        setBusinessImageUri("");
        setBusinessImage("");
        setImageUpdateKey((prev) => prev + 1);
      }
    }
    setIsChanged(true);
  };

  const handleGalleryImageError = (item) => {
    if (!item) return;
    const uid = businessUID || business?.business_uid || "";
    if (businessUploadUrisMatch(item.uri, businessImageUri, uid) || businessUploadUrisMatch(item.uri, originalBusinessImage, uid)) {
      return;
    }
    galleryUserTouchedRef.current = true;

    if (!item.isNew && isRemoteImageUri(item.uri)) {
      setDeletedGalleryImageUrls((deleted) => (deleted.includes(item.uri) ? deleted : [...deleted, item.uri]));
    }

    setGalleryUploads((prev) => {
      if (!prev.some((entry) => entry.id === item.id)) return prev;
      const updated = prev.filter((entry) => entry.id !== item.id);
      if (googlePhotoUrlsMatch(businessImageUri, item.uri)) {
        const next = pickNextProfileImage(googlePanelPhotos, updated, item.uri);
        if (next) {
          selectProfileImage(next);
        } else {
          setBusinessImageUri("");
          setBusinessImage("");
          setImageUpdateKey((prevKey) => prevKey + 1);
        }
      }
      return updated;
    });
    setIsChanged(true);
  };

  const handleRefreshGooglePhotos = async () => {
    if (!businessGoogleId) {
      Alert.alert("No Google Business", "This business is not linked to a Google Maps listing.");
      return;
    }
    setRefreshingGooglePhotos(true);
    try {
      const pd = await getPlaceDetails(businessGoogleId);
      const freshPhotos = dedupeGooglePhotoUrls((pd.photo_urls || []).map((url) => resolveRestGooglePhotoUrl(url) || url));
      if (freshPhotos.length === 0) {
        Alert.alert("No Photos", "Google did not return any photos for this business.");
        return;
      }
      const currentPhotos = filterFreshGooglePhotoUrls(googlePanelPhotos || []).map((url) => resolveRestGooglePhotoUrl(url) || url);
      const mergedPhotos = mergeRefreshedGooglePhotos(currentPhotos, freshPhotos);
      const photosToSet = mergedPhotos.length > 0 ? mergedPhotos : freshPhotos;
      googlePhotosUserEditedRef.current = true;
      googlePanelTouchedRef.current = true;
      setGooglePanelPhotos(photosToSet);
      setShowGooglePhotosPanel(true);
      setBusinessImageUri((prev) => {
        if (!prev) return photosToSet[0] || prev;
        const favorite = resolveFavoriteGoogleImage(prev, photosToSet);
        return favorite || prev;
      });
      setImageUpdateKey((k) => k + 1);
      setIsChanged(true);
    } catch (e) {
      console.warn("EditBusinessProfileScreen - Google photo refresh failed:", e);
      Alert.alert("Refresh Failed", "Could not load photos from Google. Please try again.");
    } finally {
      setRefreshingGooglePhotos(false);
    }
  };

  // Add image error handler (identical to EditProfileScreen)
  const handleImageError = () => {
    console.log("EditBusinessProfileScreen - Image failed to load, using default image");
    setImageError(true);
    setBusinessImageUri("");
    setBusinessImage("");
  };

  const resolveServiceImageDisplayUri = React.useCallback(
    (keyOrUrl) => {
      if (!keyOrUrl || String(keyOrUrl).trim() === "") return "";
      const s = String(keyOrUrl).trim();
      if (s.startsWith("http://") || s.startsWith("https://")) return s;
      if (businessUID) return `https://s3-us-west-1.amazonaws.com/every-circle/business_personal/${businessUID}/${s}`;
      return s;
    },
    [businessUID],
  );

  const handleWebServiceProductImagePick = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      Alert.alert("File not selectable", `Image size (${(file.size / 1024).toFixed(1)} KB) exceeds the 2MB upload limit.`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      Alert.alert("Invalid file type", "Please select an image file.");
      return;
    }
    setServiceProductWebFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageUri = reader.result;
      setServiceProductImageUri(imageUri);
      setServiceProductImageError(false);
      setIsChanged(true);
    };
    reader.readAsDataURL(file);
    if (serviceImageFileInputRef.current) {
      serviceImageFileInputRef.current.value = "";
    }
  };

  const handlePickServiceProductImage = async () => {
    if (Platform.OS === "web") {
      serviceImageFileInputRef.current?.click();
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Permission to access media library is required!");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        let fileSize = asset.fileSize;
        if (!fileSize && asset.uri) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(asset.uri);
            fileSize = fileInfo.size;
          } catch (e) {
            console.log("Could not get file size from FileSystem", e);
          }
        }
        if (fileSize && fileSize > 2 * 1024 * 1024) {
          Alert.alert("File not selectable", `Image size (${(fileSize / 1024).toFixed(1)} KB) exceeds the 2MB upload limit.`);
          return;
        }
        setServiceProductWebFile(null);
        setServiceProductImageUri(asset.uri);
        setServiceProductImageError(false);
        setIsChanged(true);
      }
    } catch (error) {
      console.error("Error picking product image:", error);
      Alert.alert("Error", "Failed to pick image.");
    }
  };

  const handleRemoveServiceProductImage = () => {
    setServiceProductImageUri("");
    setServiceProductWebFile(null);
    setServiceProductImageError(false);
    setIsChanged(true);
  };

  const handleServiceProductImageError = () => {
    setServiceProductImageError(true);
  };

  // MISSING: handleDeleteExperience, handleDeleteEducation, handleDeleteExpertise, handleDeleteWish, handleDeleteBusiness functions (EditProfileScreen has these)
  // Note: Business profile doesn't have these sections, so delete handlers are not needed
  // BUSINESS-SPECIFIC: Business user management functions instead
  const addBusinessEditor = () => {
    setAdditionalBusinessUsers([...additionalBusinessUsers, { email: "", role: "" }]);
    setIsChanged(true);
  };

  const removeBusinessEditor = (index) => {
    const updated = additionalBusinessUsers.filter((_, i) => i !== index);
    setAdditionalBusinessUsers(updated);
    setIsChanged(true);
  };

  const updateBusinessEditor = (index, field, value) => {
    const updated = [...additionalBusinessUsers];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalBusinessUsers(updated);
    setIsChanged(true);
  };

  // Toggle Hide/Display for a business user (bu_individual_business_is_public: 0 = hide, 1 = display)
  const toggleBusinessUserIndividualPublic = (businessUser) => {
    const current = businessUser.bu_individual_business_is_public;
    const isPublic = current === 1 || current === "1" || current === true;
    const nextValue = isPublic ? 0 : 1;
    setExistingBusinessUsers((prev) => prev.map((u) => (u.business_user_id === businessUser.business_user_id ? { ...u, bu_individual_business_is_public: nextValue } : u)));
    setIsChanged(true);
  };

  // BUSINESS-SPECIFIC: Custom tags management functions (not in EditProfileScreen)
  const alertUnsavedTags = (message) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(message);
    } else {
      Alert.alert("Unsaved Tags", message);
    }
  };

  const addCustomTag = () => {
    if (!customTagInput.trim()) return;
    const updatedTags = mergeCustomTags(formData.customTags || [], customTagInput);
    setFormData((prev) => ({ ...prev, customTags: updatedTags }));
    setCustomTagInput("");
    setIsChanged(true);
  };

  const removeCustomTag = (tagToRemove) => {
    const updatedTags = (formData.customTags || []).filter((tag) => tag !== tagToRemove);
    setFormData({ ...formData, customTags: updatedTags });
    setIsChanged(true);
  };

  const addProductTag = () => {
    if (!productTagInput.trim()) return;
    const updatedTags = mergeCustomTags(parseTagList(serviceForm.bs_tags), productTagInput);
    handleServiceChange("bs_tags", serializeTagList(updatedTags));
    setProductTagInput("");
    setIsChanged(true);
  };

  const removeProductTag = (tagToRemove) => {
    const updatedTags = parseTagList(serviceForm.bs_tags).filter((tag) => tag !== tagToRemove);
    handleServiceChange("bs_tags", serializeTagList(updatedTags));
    setIsChanged(true);
  };

  const renderTagEditor = ({ inputValue, onChangeInput, onAdd, tags, onRemove }) => (
    <View style={styles.tagEditorBlock}>
      {inputValue.trim().length > 0 ? <Text style={[styles.pendingTagsHint, darkMode && styles.darkPendingTagsHint]}>Click Add to save your tags before submitting.</Text> : null}
      <View style={styles.tagRow}>
        <TextInput
          style={[styles.tagInput, darkMode && styles.darkTagInput]}
          placeholder='Add tag'
          placeholderTextColor={darkMode ? "#cccccc" : "#666"}
          value={inputValue}
          onChangeText={onChangeInput}
          onSubmitEditing={onAdd}
        />
        <TouchableOpacity onPress={onAdd} style={styles.tagAddButton} activeOpacity={0.8}>
          <Text style={styles.tagAddButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
      {tags.length > 0 ? (
        <View style={styles.tagsContainer}>
          {tags.map((tag, index) => (
            <TouchableOpacity key={`${tag}-${index}`} onPress={() => onRemove(tag)} style={[styles.tagChip, darkMode && styles.darkTagChip]} activeOpacity={0.7}>
              <Text style={[styles.tagText, darkMode && styles.darkTagText]}>{tag}</Text>
              <Text style={styles.removeTagText}> ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );

  // MISSING: handleImageError function (EditProfileScreen has this)
  // Note: Could be added if image error handling is needed for business images

  const handleSave = async () => {
    console.log("Save Button Pressed: handleSave");
    // BUSINESS-SPECIFIC: Validates name instead of firstName and lastName
    if (!formData.name.trim() || !businessUID.trim()) {
      Alert.alert("Error", "Business name and ID are required.");
      return;
    }

    const businessCoords = parseCoordinatePairInput(formData.coordinates);
    if (businessCoords.error) {
      setCoordinatesError(businessCoords.error);
      Alert.alert("Invalid coordinates", businessCoords.error);
      return;
    }
    setCoordinatesError("");

    const customTagsForSave = customTagInput.trim() ? mergeCustomTags(formData.customTags || [], customTagInput) : formData.customTags || [];
    const editingOpenProduct = showServiceForm && editingServiceIndex !== null;
    const resolvedServiceForm = editingOpenProduct
      ? productTagInput.trim()
        ? {
            ...serviceForm,
            bs_tags: serializeTagList(mergeCustomTags(parseTagList(serviceForm.bs_tags), productTagInput)),
          }
        : serviceForm
      : null;

    // New product form is open but nothing was added to the list — block submit (not the generic "leave" modal).
    if (showServiceForm && editingServiceIndex === null) {
      const f = serviceForm;
      const hasDraftContent =
        String(f.bs_service_name || "").trim() !== "" ||
        String(f.bs_service_desc || "").trim() !== "" ||
        String(f.bs_notes || "").trim() !== "" ||
        String(f.bs_sku || "").trim() !== "" ||
        String(f.bs_tags || "").trim() !== "" ||
        String(f.bs_duration_minutes || "").trim() !== "" ||
        String(f.bs_cost || "").trim() !== "" ||
        String(f.bs_bounty || "").trim() !== "" ||
        (f.bs_bounty_type && f.bs_bounty_type !== "none") ||
        f.bs_qty_unlimited === 0 ||
        f.bs_qty_unlimited === "0" ||
        f.bs_is_taxable === 1 ||
        f.bs_is_taxable === "1" ||
        f.bs_free_shipping === 1 ||
        f.bs_free_shipping === "1" ||
        f.bs_buyer_pays_shipping === 1 ||
        f.bs_buyer_pays_shipping === "1" ||
        f.bs_is_returnable === 1 ||
        f.bs_is_returnable === "1" ||
        String(f.bs_refund_policy || "").trim() !== "" ||
        (String(f.bs_return_window_days || "").trim() !== "" && String(f.bs_return_window_days).trim() !== "0") ||
        f.bs_condition_type === "used" ||
        f.bs_condition_type === "new" ||
        productTagInput.trim() !== "" ||
        (serviceProductImageUri && String(serviceProductImageUri).trim() !== "" && !serviceProductImageError) ||
        !!serviceProductWebFile;
      if (hasDraftContent) {
        const msg = 'You have a new product or service that is not on the list yet. Tap "Add Product/Service" to add it, or tap Cancel on the product form to discard it, then submit.';
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.alert(msg);
        } else {
          Alert.alert("Product not added", msg);
        }
        return;
      }
    }

    if (editingOpenProduct) {
      const costSave = String(resolvedServiceForm.bs_cost || "").trim();
      if (costSave && parsePrice(costSave) > 0 && !serviceCostHasUnit(costSave)) {
        setServiceFormCostUnitError(true);
        setServiceFormTaxRateError(false);
        setServiceFormQuantityError(false);
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.alert("Fix the product cost unit before saving — select total, /hr, /day, etc.");
        } else {
          Alert.alert("Validation", "Fix the product cost unit before saving — select total, /hr, /day, etc.");
        }
        return;
      }
    }

    setIsLoading(true);
    // Declare imageFileSize outside try block so it's accessible in catch block
    let imageFileSize = 0;
    try {
      // Merge open product form into payload (same row as "Update Product") so Submit cannot omit
      // edits if the user saves without tapping Update again.
      let servicesForPayload = services;
      if (editingOpenProduct) {
        const pendingRow = buildServiceRowForList(resolvedServiceForm);
        if (pendingRow) {
          servicesForPayload = [...services];
          servicesForPayload[editingServiceIndex] = pendingRow;
        } else {
          const isUnlimitedSave = serviceForm.bs_qty_unlimited === 1 || serviceForm.bs_qty_unlimited === "1" || serviceForm.bs_qty_unlimited === true;
          if (!isUnlimitedSave) {
            const qSave = String(serviceForm.bs_available_quantity || "").trim();
            if (!qSave || !/^\d+$/.test(qSave) || parseInt(qSave, 10) < 1) {
              setServiceFormQuantityError(true);
              setServiceFormTaxRateError(false);
              focusServiceFormQuantitySection();
              setTimeout(() => serviceQuantityInputRef.current?.focus(), 120);
              if (Platform.OS === "web" && typeof window !== "undefined") {
                window.alert("Fix the product quantity before saving — enter a whole number ≥ 1 or choose No limit.");
              } else {
                Alert.alert("Validation", "Fix the product quantity before saving — enter a whole number ≥ 1 or choose No limit.");
              }
              return;
            }
          }
          const formTaxableSave = serviceForm.bs_is_taxable === 1 || serviceForm.bs_is_taxable === "1" || serviceForm.bs_is_taxable === true;
          const rateSave = parsePrice(serviceForm.bs_tax_rate);
          if (formTaxableSave && (!Number.isFinite(rateSave) || rateSave <= 0)) {
            setServiceFormTaxRateError(true);
            setServiceFormQuantityError(false);
            focusServiceFormSalesTaxSection();
            setTimeout(() => serviceTaxRateInputRef.current?.focus(), 120);
            if (Platform.OS === "web" && typeof window !== "undefined") {
              window.alert("Fix the product tax rate before saving — taxable items need a rate greater than 0% (for example 8.25).");
            } else {
              Alert.alert("Validation", "Fix the product tax rate before saving — taxable items need a rate greater than 0% (for example 8.25).");
            }
            return;
          }
          return;
        }
      }

      // BUSINESS-SPECIFIC: Retrieves user_uid (EditProfileScreen doesn't need this at start)
      // Retrieve user_uid from AsyncStorage
      const userUid = await AsyncStorage.getItem("user_uid");
      if (!userUid) {
        Alert.alert("Error", "User UID not found. Please log in again.");
        return;
      }

      // BUSINESS-SPECIFIC: Gets current user's role from existingBusinessUsers
      // Get current user's role from existingBusinessUsers if businessRole is empty
      let currentBusinessRole = formData.businessRole;
      if (!currentBusinessRole && existingBusinessUsers.length > 0) {
        const currentUser = existingBusinessUsers.find((user) => user.business_user_id === userUid);
        if (currentUser?.business_role) {
          currentBusinessRole = currentUser.business_role;
          console.log("Setting business_role from existingBusinessUsers:", currentBusinessRole);
        }
      }

      const payload = new FormData();
      // BUSINESS-SPECIFIC: Uses user_uid and business_uid (EditProfileScreen uses profile_uid)
      payload.append("user_uid", userUid);
      payload.append("business_uid", businessUID);
      if (formData.business_updated_at) {
        payload.append("business_updated_at", String(formData.business_updated_at));
      }
      // BUSINESS-SPECIFIC: Uses business_* field names instead of profile_personal_*
      payload.append("business_name", formData.name);
      payload.append("business_location_is_public", formData.locationIsPublic ? "1" : "0");
      payload.append("business_location", formData.location);
      payload.append("business_address_line_1", formData.addressLine2);
      payload.append("business_city", formData.city);
      payload.append("business_state", formData.state);
      payload.append("business_country", formData.country);
      payload.append("business_zip_code", formData.zip);
      if (businessCoords.lat != null && businessCoords.lng != null) {
        payload.append("business_latitude", String(businessCoords.lat));
        payload.append("business_longitude", String(businessCoords.lng));
      } else {
        payload.append("business_latitude", "");
        payload.append("business_longitude", "");
      }
      payload.append("business_phone_number", formData.phone);
      payload.append("business_email_id", formData.email);
      const categoryIds = [selectedMain, selectedSub, selectedSubSub].filter(Boolean);
      payload.append("business_category_id", categoryIds.join(","));
      payload.append("business_short_bio", formData.shortBio);
      payload.append("business_tag_line", formData.tagline);
      payload.append("business_role", currentBusinessRole || "");
      payload.append("business_ein_number", formData.einNumber);
      payload.append("business_cc_fee_payer", formData.businessPaysCcFee ? "seller" : "buyer");
      payload.append("business_website", formData.website);
      const customTagsJson = JSON.stringify(customTagsForSave);
      payload.append("custom_tags", customTagsJson);
      payload.append("tags", customTagsJson);

      const imagesTouched = galleryUserTouchedRef.current || googlePanelTouchedRef.current;
      const currentGalleryUploads = galleryUploadsRef.current;
      const currentBusinessImageUri = businessImageUriRef.current;
      const currentGooglePanel = googlePanelPhotosRef.current;
      const galleryS3UrlsBeforeSave = parseGalleryS3Urls(business, businessUID);
      const googleS3UrlsBeforeSave = parseBusinessGooglePhotos(business?.business_google_photos)
        .map((raw) => (isPermanentS3Url(raw) ? raw : resolveBusinessUploadUri(raw, businessUID)))
        .filter((url) => isPersistedGoogleS3Url(url));

      const isProfileGalleryItem = (item) =>
        businessUploadUrisMatch(item.uri, currentBusinessImageUri, businessUID) ||
        googlePhotoUrlsMatch(item.uri, currentBusinessImageUri) ||
        businessUploadUrisMatch(resolveGalleryItemDisplayUri(item, currentBusinessImageUri, businessUID), currentBusinessImageUri, businessUID);

      const profileGalleryItem =
        currentGalleryUploads.find(isProfileGalleryItem) ||
        currentGalleryUploads.find((item) => businessUploadUrisMatch(resolveGalleryItemDisplayUri(item, currentBusinessImageUri, businessUID), currentBusinessImageUri, businessUID));

      const googlePhotosToSend = buildGooglePhotosForSave(currentGalleryUploads, currentGooglePanel, deletedGalleryImageUrls, businessUID);
      const sendGooglePhotos = imagesTouched && Boolean(businessGoogleId);

      const { favoriteUrl: favoriteForSave, deferFavoriteAfterUpload } = resolveFavoriteImageForSave({
        selectedUri: currentBusinessImageUri,
        googlePhotosToSend,
        googlePanelPhotos: currentGooglePanel,
        galleryItem: profileGalleryItem,
        uid: businessUID,
      });

      const profileSelectionChanged = currentBusinessImageUri && !imageError && !profileImgMatchesUri(currentBusinessImageUri, originalBusinessImage, businessUID);

      const profileIsFreshGoogle = profileSelectionChanged && profileUriNeedsGoogleBlob(currentBusinessImageUri) && !profileUriIsOnS3(currentBusinessImageUri, profileGalleryItem, businessUID);

      const deferProfileToSecondPut = Platform.OS === "web" && profileIsFreshGoogle;

      const favoriteChanged = deferFavoriteAfterUpload || profileSelectionChanged || (favoriteForSave && !favoritesMatch(favoriteForSave, originalFavoriteImage, businessUID));

      const hasNewFileUploads = currentGalleryUploads.some((item) => item.isNew);
      let deferFavoriteToSecondPut = deferFavoriteAfterUpload || (hasNewFileUploads && favoriteChanged && Boolean(favoriteForSave));

      payload.append("business_google_rating", String(business?.business_google_rating ?? business?.googleRating ?? ""));
      if (sendGooglePhotos) {
        payload.append("business_google_photos", JSON.stringify(googlePhotosToSend));
      }
      const profileFavoriteUrl = resolveRestGooglePhotoUrl(currentBusinessImageUri) || currentBusinessImageUri;
      if (deferProfileToSecondPut) {
        payload.append("business_favorite_image", favoriteForSave || profileFavoriteUrl);
      } else if (favoriteChanged && favoriteForSave && !deferFavoriteToSecondPut) {
        payload.append("business_favorite_image", favoriteForSave);
      }

      let profileImageSent = false;
      if (profileSelectionChanged && !deferProfileToSecondPut) {
        profileImageSent = await appendProfileImageAsFile(
          payload,
          currentBusinessImageUri,
          profileGalleryItem || {
            uri: currentBusinessImageUri,
            s3Key: normalizeBusinessUploadKey(currentBusinessImageUri, businessUID),
          },
          businessUID,
        );
        if (!profileImageSent) {
          Alert.alert("Error", "Could not prepare the profile image for upload. Please try again or pick a different image.");
          setIsLoading(false);
          return;
        }
      }
      if (businessGoogleId) {
        payload.append("business_google_id", businessGoogleId);
      }

      payload.append("business_profile_img_is_public", formData.imageIsPublic ? "1" : "0");

      const deleteUserUrls = deletedGalleryImageUrls.filter((url) => !isPersistedGoogleS3Url(url));
      if (deleteUserUrls.length > 0) {
        payload.append("delete_business_images", JSON.stringify(deleteUserUrls));
      }

      const isBlobOrDataUriLocal = (uri) => uri && (uri.startsWith("blob:") || uri.startsWith("data:"));
      const keptUserUploadS3Urls = collectKeptUserUploadS3Urls(currentGalleryUploads, deletedGalleryImageUrls, businessUID);
      let newFileIndex = 0;
      let newUploadCount = 0;

      for (const item of currentGalleryUploads) {
        if (!item.isNew) continue;
        const imageUri = item.uri;
        let fileType = "jpg";
        if (imageUri.startsWith("data:")) {
          const match = imageUri.match(/data:image\/(\w+)/);
          fileType = match ? (match[1] === "jpeg" ? "jpg" : match[1]) : "jpg";
        } else if (item.webFile?.name) {
          const nameParts = item.webFile.name.split(".");
          fileType = nameParts.length > 1 ? nameParts[nameParts.length - 1].toLowerCase() : "jpg";
        } else {
          const uriParts = imageUri.split(".");
          fileType = uriParts.length > 1 ? uriParts[uriParts.length - 1].split(/[?#]/)[0] : "jpg";
        }
        const mimeType = ["jpg", "jpeg", "png", "gif", "webp"].includes(fileType.toLowerCase()) ? `image/${fileType === "jpg" ? "jpeg" : fileType}` : "image/jpeg";
        let fileToAppend = null;

        if (Platform.OS === "web" && item.webFile) {
          fileToAppend = item.webFile;
        } else if (Platform.OS === "web" && isBlobOrDataUriLocal(imageUri)) {
          try {
            const response = await fetch(imageUri);
            const blob = await response.blob();
            fileToAppend = new File([blob], `business_img_${newFileIndex}.${fileType}`, { type: mimeType });
          } catch (err) {
            console.error("Failed to fetch gallery image for upload:", err);
            continue;
          }
        } else {
          fileToAppend = {
            uri: imageUri,
            type: mimeType,
            name: `business_img_${newFileIndex}.${fileType}`,
          };
        }

        payload.append(`business_img_${newFileIndex}`, fileToAppend);
        if (fileToAppend instanceof File) {
          imageFileSize = fileToAppend.size || imageFileSize;
        }
        newFileIndex += 1;
        newUploadCount += 1;
      }

      if (newUploadCount > 0 && newFileIndex === 0) {
        Alert.alert("Error", "Could not prepare your uploaded image for save. Please try uploading again.");
        setIsLoading(false);
        return;
      }

      if (imagesTouched && keptUserUploadS3Urls.length > 0) {
        payload.append("business_images_url", JSON.stringify(keptUserUploadS3Urls));
      }

      payload.append("business_email_id_is_public", formData.emailIsPublic ? "1" : "0");
      payload.append("business_phone_number_is_public", formData.phoneIsPublic ? "1" : "0");
      payload.append("business_tag_line_is_public", formData.taglineIsPublic ? "1" : "0");
      payload.append("business_short_bio_is_public", formData.shortBioIsPublic ? "1" : "0");

      // BUSINESS-SPECIFIC: Services/products handling (EditProfileScreen handles experience, education, expertise, wishes, businesses arrays)
      const servicesToSend = servicesForPayload.map((service, idx) => buildBusinessServiceForApi(service, idx));
      payload.append("business_services", JSON.stringify(servicesToSend));

      if (deletedBusinessServiceUids.length > 0) {
        payload.append("delete_business_services", JSON.stringify(deletedBusinessServiceUids));
      }

      console.log("EditBusinessProfileScreen - custom_tags/tags payload:", customTagsJson);
      console.log(
        "EditBusinessProfileScreen - business_services payload sample:",
        JSON.stringify(
          servicesToSend.map((s) => ({
            bs_uid: s.bs_uid,
            bs_service_name: s.bs_service_name,
            bs_tags: s.bs_tags,
            bs_is_returnable: s.bs_is_returnable,
            bs_return_window_days: s.bs_return_window_days,
          })),
        ),
      );

      for (let index = 0; index < servicesForPayload.length; index++) {
        const svc = servicesForPayload[index];
        if (svc._svcDeleteImageUrl) {
          payload.append(`delete_bs_service_image_${index}`, svc._svcDeleteImageUrl);
        }
        const newUri = svc._svcNewImageUri;
        const webFile = svc._svcWebImageFile;
        if (!newUri && !(Platform.OS === "web" && webFile)) continue;

        let fileToAppend = null;
        if (Platform.OS === "web" && webFile) {
          fileToAppend = webFile;
        } else if (Platform.OS === "web" && newUri && isBlobOrDataUriLocal(newUri)) {
          try {
            const response = await fetch(newUri);
            const blob = await response.blob();
            fileToAppend = new File([blob], `bs_service_image_${index}.jpg`, { type: blob.type || "image/jpeg" });
          } catch (err) {
            console.error("Failed to prepare web product image:", err);
          }
        } else if (newUri && (newUri.startsWith("file:") || newUri.startsWith("content:"))) {
          const uriParts = newUri.split(".");
          const fileType = uriParts.length > 1 ? uriParts[uriParts.length - 1].split(/[?#]/)[0] : "jpg";
          const mimeType = ["jpg", "jpeg", "png", "gif", "webp"].includes(fileType.toLowerCase()) ? `image/${fileType === "jpg" ? "jpeg" : fileType}` : "image/jpeg";
          fileToAppend = { uri: newUri, type: mimeType, name: `bs_service_image_${index}.${fileType}` };
        } else if (newUri && newUri.startsWith("data:")) {
          try {
            const response = await fetch(newUri);
            const blob = await response.blob();
            fileToAppend = new File([blob], `bs_service_image_${index}.jpg`, { type: blob.type || "image/jpeg" });
          } catch (err) {
            console.error("Failed to prepare product image:", err);
          }
        }

        if (fileToAppend) {
          payload.append(`bs_service_image_${index}`, fileToAppend);
        }
      }

      for (let index = 0; index < servicesForPayload.length; index++) {
        const svc = servicesForPayload[index];
        const imgPublic = svc.bs_service_image_is_public === 1 || svc.bs_service_image_is_public === "1" || svc.bs_service_image_is_public === true;
        payload.append(`bs_service_image_${index}_is_public`, imgPublic ? "1" : "0");
      }

      // BUSINESS-SPECIFIC: Business users handling (EditProfileScreen doesn't have this)
      const remainingExistingUsers = existingBusinessUsers.filter((user) => !deletedBusinessUsers.includes(user.business_user_id));
      const existingEmails = remainingExistingUsers.map((user) => user.user_email || "").filter((email) => email);
      const existingRoles = remainingExistingUsers.map((user) => user.business_role || "").filter((role) => role);
      const validNewUsers = additionalBusinessUsers.filter((user) => user.email.trim() && user.role);
      const newEmails = validNewUsers.map((user) => user.email.trim());
      const newRoles = validNewUsers.map((user) => user.role);
      const allEmails = [...existingEmails, ...newEmails];
      const allRoles = [...existingRoles, ...newRoles];

      if (allEmails.length > 0 && allRoles.length > 0) {
        payload.append("additional_business_user", JSON.stringify(allEmails));
        payload.append("additional_business_role", JSON.stringify(allRoles));
      }

      // bu_individual_business_is_public per business user (0 = hide, 1 = display) for business_user table
      const businessUsersIndividualPublic = remainingExistingUsers.map((u) => ({
        business_user_id: u.business_user_id,
        bu_individual_business_is_public: u.bu_individual_business_is_public === 1 || u.bu_individual_business_is_public === "1" || u.bu_individual_business_is_public === true ? 1 : 0,
      }));
      if (businessUsersIndividualPublic.length > 0) {
        payload.append("business_users_individual_public", JSON.stringify(businessUsersIndividualPublic));
      }

      // BUSINESS-SPECIFIC: Social links handling
      const socialLinksPayload = {
        facebook: formData.socialLinks?.facebook || "",
        instagram: formData.socialLinks?.instagram || "",
        linkedin: formData.socialLinks?.linkedin || "",
        youtube: formData.socialLinks?.youtube || "",
      };
      console.log("EditBusinessProfileScreen - Social links payload:", JSON.stringify(socialLinksPayload, null, 2));
      payload.append("social_links", JSON.stringify(socialLinksPayload));

      // MISSING: Deleted items handling (EditProfileScreen appends delete_experiences, delete_educations, etc.)
      // Note: Business profile doesn't have these sections, so deleted items handling is not needed

      // Standardized console log (same format as EditProfileScreen for easy comparison)
      const businessImagesUrlValue = imagesTouched && keptUserUploadS3Urls.length > 0 ? JSON.stringify(keptUserUploadS3Urls) : "(not sent)";
      console.log("============================================");
      console.log("📡 BUSINESS PROFILE – IMAGE PAYLOAD SENT TO BACKEND");
      console.log("============================================");
      console.log("🔗 ENDPOINT:", BusinessProfileAPI);
      console.log("📝 METHOD: PUT");
      console.log("--------------------------------------------");
      console.log("Image fields (backend contract):");
      console.log("  business_img_* count:", newFileIndex);
      console.log("  business_profile_img:", deferProfileToSecondPut ? "(deferred – step 2)" : profileSelectionChanged ? (profileImageSent ? "SENT" : "attempted") : "not sent");
      console.log("  business_images_url:", obscureSecretsInString(businessImagesUrlValue));
      console.log("  delete_business_images:", deleteUserUrls.length > 0 ? obscureSecretsInString(JSON.stringify(deleteUserUrls)) : "(not sent)");
      console.log("  business_google_id:", businessGoogleId || "(not sent)");
      console.log("  business_google_photos:", sendGooglePhotos ? `sent (${googlePhotosToSend.length}: kept S3 + fresh Google)` : "not sent");
      console.log("  business_favorite_image:", deferFavoriteToSecondPut ? "(deferred – step 2)" : obscureSecretsInString(favoriteForSave) || "(not sent)");
      console.log("  business_profile_img_is_public:", formData.imageIsPublic ? "1" : "0");
      console.log("--------------------------------------------");
      console.log("============================================");
      console.log("Custom tags being sent:", customTagsJson);
      const response = await fetch(`${BusinessProfileAPI}`, {
        method: "PUT",
        body: payload,
      });

      if (!response.ok) {
        if (response.status === 413) {
          Alert.alert("File Too Large", `The selected image (${(imageFileSize / 1024).toFixed(1)} KB) was too large to upload. Please select an image under 2MB.`);
          return;
        }
        let errBody = "";
        try {
          const errJson = await response.json();
          errBody = errJson?.message || JSON.stringify(errJson);
        } catch {
          /* ignore */
        }
        throw new Error(errBody || `Update failed (${response.status})`);
      }

      if (response.status === 200) {
        // Fetch the saved services to get their bs_uid values
        let returnedServices = [];
        try {
          // const bizRes = await fetch(`${API_BASE_URL}/api/v1/businessinfo/${businessUID}`);
          // const bizData = await bizRes.json();
          // const rawServices = bizData?.result?.[0]?.business_services || bizData?.business_services || [];
          const bizRes = await fetch(`${BUSINESS_INFO_ENDPOINT}/${businessUID}`);
          const bizData = await bizRes.json();
          const rawServices = bizData?.services || [];
          returnedServices = typeof rawServices === "string" ? JSON.parse(rawServices) : rawServices;
          console.log(
            "🔵 Fetched services after save:",
            returnedServices.map((s) => ({ bs_uid: s.bs_uid, name: s.bs_service_name })),
          );
        } catch (e) {
          console.warn("Could not fetch services after save:", e);
        }

        // Save options for each service
        // const optionSavePromises = servicesForPayload.map((localSvc) => {
        //   const uid =
        //     (localSvc.bs_uid && String(localSvc.bs_uid).trim() !== "" && localSvc.bs_uid) ||
        //     returnedServices.find(
        //       (r) =>
        //         String(r.bs_service_name || "").trim() === String(localSvc.bs_service_name || "").trim() &&
        //         String(r.bs_uid || "").trim() !== ""
        //     )?.bs_uid;

        //   console.log(`🔵 Service "${localSvc.bs_service_name}" -> uid: ${uid}, groups: ${(localSvc.bs_choice_groups || []).length}`);

        //   if (!uid) {
        //     console.warn(`⚠️ No uid for "${localSvc.bs_service_name}", skipping`);
        //     return Promise.resolve();
        //   }

        //   return fetch(`${API_BASE_URL}/api/business_service_options/${uid}`, {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     body: JSON.stringify({
        //       choice_groups: localSvc.bs_choice_groups || [],
        //       special_instructions_enabled: localSvc.bs_special_instructions_enabled || 0,
        //       special_instructions_max_chars: localSvc.bs_special_instructions_max_chars || 80,
        //     }),
        //   })
        //     .then((res) => { console.log(`🔵 Options save status for ${uid}:`, res.status); return res.json(); })
        //     .then((data) => console.log(`🔵 Options save result for ${uid}:`, JSON.stringify(data)))
        //     .catch((e) => console.warn(`Failed to save options for ${uid}:`, e));
        // });

        // Replace the entire optionSavePromises block with:
        const optionSavePromises = servicesForPayload.map(async (localSvc) => {
          // For existing services, bs_uid is already known
          let uid = localSvc.bs_uid && String(localSvc.bs_uid).trim() !== "" ? localSvc.bs_uid : null;

          // For new services (no bs_uid), match by name from returnedServices
          if (!uid) {
            uid = returnedServices.find((r) => String(r.bs_service_name || "").trim() === String(localSvc.bs_service_name || "").trim() && String(r.bs_uid || "").trim() !== "")?.bs_uid || null;
          }

          console.log(`🔵 Service "${localSvc.bs_service_name}" -> uid: ${uid}, groups: ${(localSvc.bs_choice_groups || []).length}`);
          console.log(`🔵 Choice groups content:`, JSON.stringify(localSvc.bs_choice_groups));

          if (!uid) {
            console.warn(`⚠️ No uid for "${localSvc.bs_service_name}", skipping`);
            return Promise.resolve();
          }

          // Always save options even if bs_choice_groups is empty (to clear removed groups)
          return fetch(`${API_BASE_URL}/api/business_service_options/${uid}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              choice_groups: localSvc.bs_choice_groups || [],
              special_instructions_enabled: localSvc.bs_special_instructions_enabled || 0,
              special_instructions_max_chars: localSvc.bs_special_instructions_max_chars || 80,
            }),
          })
            .then((res) => {
              console.log(`🔵 Options save status for ${uid}:`, res.status);
              return res.json();
            })
            .then((data) => console.log(`🔵 Options save result for ${uid}:`, JSON.stringify(data)))
            .catch((e) => console.warn(`Failed to save options for ${uid}:`, e));
        });

        await Promise.all(optionSavePromises);

        if (deferFavoriteToSecondPut || deferProfileToSecondPut) {
          try {
            const bizRes = await fetch(`${BUSINESS_INFO_ENDPOINT}/${businessUID}`);
            const bizData = await bizRes.json();
            const biz = bizData?.business;

            if (deferFavoriteToSecondPut) {
              let favoriteS3 = "";
              if (deferFavoriteAfterUpload) {
                const afterUrls = parseGalleryS3Urls(biz, businessUID);
                const newUrls = findNewGalleryS3Urls(galleryS3UrlsBeforeSave, afterUrls, businessUID);
                const newItems = currentGalleryUploads.filter((item) => item.isNew);
                const favNewIdx = newItems.findIndex((item) => isProfileGalleryItem(item));
                favoriteS3 = newUrls[favNewIdx >= 0 ? favNewIdx : newUrls.length - 1] || "";
              } else if (favoriteForSave) {
                favoriteS3 = favoriteForSave;
              }
              if (favoriteS3) {
                const favPayload = new FormData();
                favPayload.append("user_uid", userUid);
                favPayload.append("business_uid", businessUID);
                favPayload.append("business_favorite_image", favoriteS3);
                const favRes = await fetch(`${BusinessProfileAPI}`, { method: "PUT", body: favPayload });
                if (!favRes.ok) {
                  console.warn("EditBusinessProfileScreen - step-2 favorite save failed:", favRes.status);
                } else {
                  setOriginalFavoriteImage(favoriteS3);
                }
              }
            }

            if (deferProfileToSecondPut) {
              const profileS3 = resolveGoogleProfileS3AfterSave(biz, currentBusinessImageUri, googlePhotosToSend, businessUID, googleS3UrlsBeforeSave);
              if (profileS3) {
                const profilePayload = new FormData();
                profilePayload.append("user_uid", userUid);
                profilePayload.append("business_uid", businessUID);
                appendS3ProfileReference(profilePayload, { s3Key: normalizeBusinessUploadKey(profileS3, businessUID), uri: profileS3 }, profileS3, businessUID);
                const profileRes = await fetch(`${BusinessProfileAPI}`, { method: "PUT", body: profilePayload });
                if (!profileRes.ok) {
                  console.warn("EditBusinessProfileScreen - step-2 profile save failed:", profileRes.status);
                } else {
                  setOriginalBusinessImage(profileS3);
                  setOriginalFavoriteImage(profileS3);
                }
              } else {
                console.warn("EditBusinessProfileScreen - step-2 profile: no matching google_photo S3 after save");
              }
            }
          } catch (e) {
            console.warn("EditBusinessProfileScreen - step-2 image save error:", e);
          }
        }

        suppressLeavePromptRef.current = true;
        setIsChanged(false);
        if (JSON.stringify(formData.customTags || []) !== JSON.stringify(customTagsForSave)) {
          setFormData((prev) => ({ ...prev, customTags: customTagsForSave }));
        }
        if (customTagInput.trim()) {
          setCustomTagInput("");
        }
        if (productTagInput.trim()) {
          setProductTagInput("");
        }
        if (!deferProfileToSecondPut) {
          setOriginalBusinessImage(currentBusinessImageUri || originalBusinessImage);
        }
        if (favoriteForSave && !deferFavoriteToSecondPut) {
          setOriginalFavoriteImage(favoriteForSave);
        }
        navigation.navigate("BusinessProfile", { business_uid: businessUID });
        Alert.alert("Success", "Business profile updated.");
        setTimeout(() => {
          suppressLeavePromptRef.current = false;
        }, 1500);
      }
    } catch (error) {
      if (error.response && error.response.status === 413) {
        Alert.alert("File Too Large", `The selected image (${(imageFileSize / 1024).toFixed(1)} KB) was too large to upload. Please select an image under 2MB.`);
        return;
      }
      console.error("Update Error:", error);
      let errorMsg = error.message || "Update failed. Please try again.";
      if (imageFileSize > 0) {
        errorMsg += ` (Image file size: ${(imageFileSize / 1024).toFixed(1)} KB)`;
      }
      Alert.alert("Error", errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // BUSINESS-SPECIFIC: renderField signature differs - has more parameters (key, placeholder, visibilityKey, keyboardType, maxLength, formatter)
  // EditProfileScreen renderField signature: (label, value, isPublic, fieldName, visibilityFieldName, editable = true)
  const renderField = (label, value, key, placeholder, visibilityKey = null, keyboardType = "default", maxLength = null, formatter = null) => (
    <View style={styles.fieldContainer}>
      {/* Row: Label and Toggle */}
      <View style={styles.labelRow}>
        <Text style={[styles.label, darkMode && styles.darkLabel]}>{label}</Text>
        {visibilityKey && (
          <View style={styles.toggleContainer}>
            <TouchableOpacity onPress={() => handleToggleVisibility(visibilityKey)} style={[styles.togglePill, formData[visibilityKey] && styles.togglePillActiveGreen]}>
              <Text style={[styles.togglePillText, formData[visibilityKey] && styles.togglePillTextActive]}>{formData[visibilityKey] ? "Visible" : "Show"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleToggleVisibility(visibilityKey)} style={[styles.togglePill, !formData[visibilityKey] && styles.togglePillActiveRed]}>
              <Text style={[styles.togglePillText, !formData[visibilityKey] && styles.togglePillTextActive]}>{!formData[visibilityKey] ? "Hidden" : "Hide"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <TextInput
        style={[styles.input, darkMode && styles.darkInput]}
        value={value}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        placeholderTextColor={darkMode ? "#cccccc" : "#999999"}
        keyboardType={keyboardType}
        maxLength={maxLength}
        onChangeText={(text) => {
          const formattedText = formatter ? formatter(text) : text;
          handleFieldChange(key, formattedText);
        }}
      />
    </View>
  );

  const renderUpdateLocationFromGoogle = () => (
    <View style={[styles.fieldContainer, styles.placesSearchContainer]}>
      <Text style={[styles.label, darkMode && styles.darkLabel]}>Update Location from Google</Text>
      <TextInput
        style={[styles.input, darkMode && styles.darkInput]}
        placeholder='Search for a place on Google Maps'
        placeholderTextColor={darkMode ? "#cccccc" : "#999999"}
        value={placeSearchText}
        onChangeText={onPlaceSearchChange}
        autoCapitalize='words'
        autoCorrect={false}
      />
      {placeSearchLoading ? <ActivityIndicator size='small' color='#4B2E83' style={{ marginTop: 8 }} /> : null}
      {placeSuggestions.length > 0 && (
        <View style={[styles.placesSuggestionsList, darkMode && styles.darkPlacesSuggestionsList]}>
          {placeSuggestions.map((item) => (
            <TouchableOpacity key={item.place_id} style={[styles.placesSuggestionRow, darkMode && styles.darkPlacesSuggestionRow]} onPress={() => handleGooglePlaceSelect(item)} activeOpacity={0.7}>
              <Text style={[styles.placesSuggestionMain, darkMode && styles.darkLabel]}>{item.structured_formatting?.main_text || item.description}</Text>
              {item.structured_formatting?.secondary_text ? <Text style={[styles.placesSuggestionSub, darkMode && styles.darkCoordHint]}>{item.structured_formatting.secondary_text}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderCoordinatesField = () => (
    <View style={styles.fieldContainer}>
      <Text style={[styles.label, darkMode && styles.darkLabel]}>Coordinates</Text>
      <Text style={[styles.coordHint, darkMode && styles.darkCoordHint]}>Decimal degrees (WGS84). Format: latitude, longitude. Leave empty to clear.</Text>
      <TextInput
        style={[styles.input, darkMode && styles.darkInput, coordinatesError ? styles.inputError : null]}
        value={formData.coordinates}
        onChangeText={(text) => {
          handleFieldChange("coordinates", text);
          if (coordinatesError) setCoordinatesError("");
        }}
        placeholder='e.g. 37.7893, -122.3966'
        placeholderTextColor={darkMode ? "#cccccc" : "#999999"}
        autoCapitalize='none'
        autoCorrect={false}
      />
      {coordinatesError ? <Text style={styles.coordErrorText}>{coordinatesError}</Text> : null}
    </View>
  );

  // MISSING: renderShortBioField function (EditProfileScreen has this with dynamic height)
  // Note: Business profile uses regular renderField for shortBio, could be enhanced to match EditProfileScreen

  // BUSINESS-SPECIFIC: renderEINField function - displays "Always Hidden" instead of toggle
  const renderEINField = () => (
    <View style={styles.fieldContainer}>
      {/* Row: Label and "Always Hidden" text */}
      <View style={styles.labelRow}>
        <Text style={[styles.label, darkMode && styles.darkLabel]}>EIN Number</Text>
        <Text style={[styles.toggleText, { color: darkMode ? "#999999" : "#666666", fontStyle: "italic" }]}>Always Hidden</Text>
      </View>
      <TextInput
        style={[styles.input, darkMode && styles.darkInput]}
        value={formData.einNumber}
        placeholder='##-#######'
        placeholderTextColor={darkMode ? "#cccccc" : "#999999"}
        keyboardType='numeric'
        maxLength={10}
        onChangeText={(text) => {
          const formattedText = formatEINNumber(text);
          handleFieldChange("einNumber", formattedText);
        }}
      />
    </View>
  );

  const renderBusinessCcFeeField = () => (
    <View style={styles.fieldContainer}>
      <View style={[styles.labelRow, { alignItems: "flex-start", marginBottom: 0 }]}>
        <View style={{ flex: 1, marginRight: 8, minWidth: 0 }}>
          <Text style={[styles.label, darkMode && styles.darkLabel, { marginBottom: 0 }]}>Business Pays Credit Card Fee</Text>
        </View>
        <View style={[styles.toggleContainer, { flexShrink: 0, paddingTop: 2 }]}>
          <TouchableOpacity style={[styles.togglePill, formData.businessPaysCcFee && styles.togglePillActiveGreen]} onPress={() => handleFieldChange("businessPaysCcFee", true)} activeOpacity={0.7}>
            <Text style={[styles.togglePillText, formData.businessPaysCcFee && styles.togglePillTextActive]}>True</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.togglePill, !formData.businessPaysCcFee && styles.togglePillActiveRed]} onPress={() => handleFieldChange("businessPaysCcFee", false)} activeOpacity={0.7}>
            <Text style={[styles.togglePillText, !formData.businessPaysCcFee && styles.togglePillTextActive]}>False</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={{ fontSize: 13, color: darkMode ? "#aaa" : "#666", marginTop: 0, lineHeight: 18 }}>
        True: Credit Card Fees paid by the business. False: Credit Card Fees paid by the buyer (shown on their receipt).
      </Text>
    </View>
  );

  // BUSINESS-SPECIFIC: renderSocialField function (EditProfileScreen doesn't have this - social links handled differently)
  const renderSocialField = (label, platform) => (
    <View style={styles.fieldContainer}>
      <Text style={[styles.label, darkMode && styles.darkLabel]}>{label}</Text>
      <TextInput
        style={[styles.input, darkMode && styles.darkInput]}
        value={formData.socialLinks[platform]}
        placeholder={`Enter ${platform} link`}
        placeholderTextColor={darkMode ? "#cccccc" : "#666"}
        onChangeText={(text) => {
          setFormData({
            ...formData,
            socialLinks: { ...formData.socialLinks, [platform]: text },
          });
          setIsChanged(true);
        }}
      />
    </View>
  );

  // BUSINESS-SPECIFIC: renderCustomTagsSection function (not in EditProfileScreen)
  const renderCustomTagsSection = () => (
    <View style={styles.fieldContainer}>
      <TagSectionLabel title='Custom Tags' style={[styles.label, darkMode && styles.darkLabel]} darkMode={darkMode} />
      {renderTagEditor({
        inputValue: customTagInput,
        onChangeInput: (text) => {
          setCustomTagInput(text);
          if (text.trim()) setIsChanged(true);
        },
        onAdd: addCustomTag,
        tags: formData.customTags || [],
        onRemove: removeCustomTag,
      })}
    </View>
  );

  // Business Image Visibility Toggle Handler (identical to EditProfileScreen)
  const toggleBusinessImageVisibility = () => {
    setFormData((prev) => ({
      ...prev,
      imageIsPublic: !prev.imageIsPublic,
    }));
    setIsChanged(true);
  };

  const googlePhotos = googlePanelPhotos;
  const hasGooglePlace = Boolean(businessGoogleId);

  const renderBusinessImageSection = () => (
    <View style={[styles.imageSection, darkMode && styles.darkImageSection]}>
      <Text style={[styles.label, darkMode && styles.darkLabel]}>Business Image</Text>
      <Text style={[styles.imageHelperText, darkMode && styles.darkSublabel]}>
        Tap any image to select your business profile. Tap ✕ to remove. Use Refresh Google Images to load photos from Google.
      </Text>
      <Image
        source={businessImageUri && !imageError ? { uri: businessImageUri } : DEFAULT_BUSINESS_IMAGE}
        style={[styles.profileImage, darkMode && styles.darkProfileImage]}
        tintColor={darkMode ? "#ffffff" : undefined}
        onError={handleImageError}
      />
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
        <View style={styles.toggleContainer}>
          <TouchableOpacity onPress={toggleBusinessImageVisibility} style={[styles.togglePill, formData.imageIsPublic && styles.togglePillActiveGreen]}>
            <Text style={[styles.togglePillText, formData.imageIsPublic && styles.togglePillTextActive]}>{formData.imageIsPublic ? "Visible" : "Show"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleBusinessImageVisibility} style={[styles.togglePill, !formData.imageIsPublic && styles.togglePillActiveRed]}>
            <Text style={[styles.togglePillText, !formData.imageIsPublic && styles.togglePillTextActive]}>{!formData.imageIsPublic ? "Hidden" : "Hide"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.googleImagesHeaderRow}>
        <Text style={[styles.sublabel, darkMode && styles.darkSublabel, styles.gallerySectionLabel, styles.googleImagesHeaderLabel]}>Your Uploads</Text>
        {hasGooglePlace ? (
          <TouchableOpacity
            style={[styles.googleRefreshButton, darkMode && styles.darkGoogleRefreshButton, refreshingGooglePhotos && styles.googleRefreshButtonDisabled]}
            onPress={handleRefreshGooglePhotos}
            disabled={refreshingGooglePhotos}
            accessibilityLabel='Refresh Google Images'
            accessibilityRole='button'
          >
            {refreshingGooglePhotos ? (
              <ActivityIndicator size='small' color={darkMode ? "#fff" : "#007AFF"} />
            ) : (
              <>
                <Ionicons name='refresh' size={16} color={darkMode ? "#60a5fa" : "#007AFF"} />
                <Text style={[styles.googleRefreshText, darkMode && styles.darkGoogleRefreshText]}>Refresh Google Images</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll} contentContainerStyle={styles.imageRow}>
        {galleryUploads.map((item, index) => {
          const displayUri = resolveGalleryItemDisplayUri(item, businessImageUri, businessUID);
          const isSelected = galleryItemMatchesProfileImg(item, businessImageUri, businessUID);
          return (
            <View key={item.id} style={styles.galleryImageWrapper}>
              <TouchableOpacity style={styles.galleryThumbTouchable} onPress={() => selectProfileImage(displayUri)} activeOpacity={0.8}>
                <Image
                  source={{ uri: displayUri }}
                  style={[styles.galleryThumb, darkMode && styles.darkGalleryThumb, isSelected && styles.galleryImageSelected]}
                  resizeMode='cover'
                  onError={() => handleGalleryImageError(item)}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteIcon} onPress={() => removeGalleryUpload(index)}>
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
              {isSelected ? (
                <View style={styles.gallerySelectedBadge}>
                  <Text style={styles.gallerySelectedBadgeText}>✓</Text>
                </View>
              ) : null}
            </View>
          );
        })}
        <TouchableOpacity style={[styles.galleryUploadBox, darkMode && styles.darkGalleryUploadBox]} onPress={handlePickGalleryImage}>
          <Text style={[styles.galleryUploadText, darkMode && styles.darkGalleryUploadText]}>Upload</Text>
        </TouchableOpacity>
      </ScrollView>

      {showGooglePhotosPanel && googlePhotos.length > 0 ? (
        <>
          <Text style={[styles.sublabel, darkMode && styles.darkSublabel, styles.gallerySectionLabel, styles.googlePhotosPanelLabel]}>Google Images</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll} contentContainerStyle={styles.imageRow}>
            {googlePhotos
              .filter((uri) => uri && String(uri).trim())
              .map((uri, index) => {
                const isSelected = profileImgMatchesUri(businessImageUri, uri, businessUID);
                return (
                  <View key={`google-${uri}-${index}`} style={styles.galleryImageWrapper}>
                    <TouchableOpacity style={styles.galleryThumbTouchable} onPress={() => selectProfileImage(uri)} activeOpacity={0.8}>
                      <Image source={{ uri }} style={[styles.galleryThumb, darkMode && styles.darkGalleryThumb, isSelected && styles.galleryImageSelected]} resizeMode='cover' />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteIcon} onPress={() => removeGooglePhoto(uri, index)}>
                      <Text style={styles.deleteText}>✕</Text>
                    </TouchableOpacity>
                    {isSelected ? (
                      <View style={styles.gallerySelectedBadge}>
                        <Text style={styles.gallerySelectedBadgeText}>✓</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
          </ScrollView>
        </>
      ) : null}

      {Platform.OS === "web" &&
        React.createElement("input", {
          ref: fileInputRef,
          type: "file",
          accept: "image/*",
          style: { display: "none" },
          onChange: handleWebImagePick,
        })}
    </View>
  );

  // BUSINESS-SPECIFIC: renderCategoryField - 3-level dropdown like BusinessStep2
  const renderCategoryField = () => (
    <View style={styles.fieldContainer}>
      <Text style={[styles.label, darkMode && styles.darkLabel]}>Business Category</Text>
      <Text style={[styles.sublabel, darkMode && styles.darkSublabel]}>Main Category *</Text>
      <Dropdown
        style={[styles.input, darkMode && styles.darkInput]}
        data={mainCategories.map((c) => ({ label: c.category_name, value: c.category_uid }))}
        labelField='label'
        valueField='value'
        placeholder='Select Main Category'
        placeholderTextColor={darkMode ? "#999" : "#666"}
        value={selectedMain}
        onChange={(item) => {
          setSelectedMain(item.value);
          setIsChanged(true);
        }}
        containerStyle={[{ borderRadius: 10, zIndex: 3000 }, darkMode && { backgroundColor: "#2d2d2d", borderColor: "#404040" }]}
        itemTextStyle={{ color: darkMode ? "#fff" : "#000", fontSize: 16 }}
        selectedTextStyle={{ color: darkMode ? "#fff" : "#000", fontSize: 16 }}
        activeColor={darkMode ? "#404040" : "#f0f0f0"}
        maxHeight={250}
        renderItem={(item) => (
          <View style={{ paddingVertical: 6, paddingHorizontal: 12 }}>
            <Text style={{ color: darkMode ? "#fff" : "#000", fontSize: 16 }}>{item.label}</Text>
          </View>
        )}
        flatListProps={{ nestedScrollEnabled: true, ItemSeparatorComponent: () => <View style={{ height: 2 }} /> }}
      />
      <Text style={[styles.sublabel, darkMode && styles.darkSublabel, { marginTop: 8 }]}>Sub Category (Optional)</Text>
      <Dropdown
        style={[styles.input, darkMode && styles.darkInput]}
        data={subCategories.map((c) => ({ label: c.category_name, value: c.category_uid }))}
        labelField='label'
        valueField='value'
        placeholder={subCategories.length > 0 ? "Select Sub Category" : "Select Main Category first"}
        placeholderTextColor={darkMode ? "#999" : "#666"}
        value={selectedSub}
        onChange={(item) => {
          setSelectedSub(item.value);
          setIsChanged(true);
        }}
        disabled={subCategories.length === 0}
        containerStyle={[{ borderRadius: 10, zIndex: 2000 }, darkMode && { backgroundColor: "#2d2d2d", borderColor: "#404040" }]}
        itemTextStyle={{ color: darkMode ? "#fff" : "#000", fontSize: 16 }}
        selectedTextStyle={{ color: darkMode ? "#fff" : "#000", fontSize: 16 }}
        activeColor={darkMode ? "#404040" : "#f0f0f0"}
        maxHeight={250}
        renderItem={(item) => (
          <View style={{ paddingVertical: 6, paddingHorizontal: 12 }}>
            <Text style={{ color: darkMode ? "#fff" : "#000", fontSize: 16 }}>{item.label}</Text>
          </View>
        )}
        flatListProps={{ nestedScrollEnabled: true, ItemSeparatorComponent: () => <View style={{ height: 2 }} /> }}
      />
      <Text style={[styles.sublabel, darkMode && styles.darkSublabel, { marginTop: 8 }]}>Sub-Sub Category (Optional)</Text>
      <Dropdown
        style={[styles.input, darkMode && styles.darkInput]}
        data={subSubCategories.map((c) => ({ label: c.category_name, value: c.category_uid }))}
        labelField='label'
        valueField='value'
        placeholder={subSubCategories.length > 0 ? "Select Sub-Sub Category" : "Select Sub Category first"}
        placeholderTextColor={darkMode ? "#999" : "#666"}
        value={selectedSubSub}
        onChange={(item) => {
          setSelectedSubSub(item.value);
          setIsChanged(true);
        }}
        disabled={subSubCategories.length === 0}
        containerStyle={[{ borderRadius: 10, zIndex: 1000 }, darkMode && { backgroundColor: "#2d2d2d", borderColor: "#404040" }]}
        itemTextStyle={{ color: darkMode ? "#fff" : "#000", fontSize: 16 }}
        selectedTextStyle={{ color: darkMode ? "#fff" : "#000", fontSize: 16 }}
        activeColor={darkMode ? "#404040" : "#f0f0f0"}
        maxHeight={250}
        renderItem={(item) => (
          <View style={{ paddingVertical: 6, paddingHorizontal: 12 }}>
            <Text style={{ color: darkMode ? "#fff" : "#000", fontSize: 16 }}>{item.label}</Text>
          </View>
        )}
        flatListProps={{ nestedScrollEnabled: true, ItemSeparatorComponent: () => <View style={{ height: 2 }} /> }}
      />
    </View>
  );

  // BUSINESS-SPECIFIC: renderBusinessRoleField function (not in EditProfileScreen)
  const renderBusinessRoleField = () => (
    <View style={styles.fieldContainer}>
      <Text style={[styles.label, darkMode && styles.darkLabel]}>Business Role</Text>
      <Dropdown
        style={[styles.input, darkMode && styles.darkInput]}
        data={businessRoles}
        labelField='label'
        valueField='value'
        placeholder='Select your role'
        placeholderTextColor={darkMode ? "#ffffff" : "#666"}
        value={formData.businessRole}
        onChange={(item) => {
          setFormData({ ...formData, businessRole: item.value });
          setIsChanged(true);
        }}
        containerStyle={[{ borderRadius: 10 }, darkMode && { backgroundColor: "#1a1a1a", borderColor: "#404040" }]}
        itemTextStyle={{ color: darkMode ? "#ffffff" : "#000000" }}
        selectedTextStyle={{ color: darkMode ? "#ffffff" : "#000000" }}
        activeColor={darkMode ? "#404040" : "#f0f0f0"}
        itemContainerStyle={darkMode ? { backgroundColor: "#1a1a1a" } : {}}
        renderItem={(item, selected) => (
          <View style={[styles.dropdownItem, darkMode && styles.darkDropdownItem, selected && (darkMode ? styles.darkDropdownItemSelected : styles.dropdownItemSelected)]}>
            <Text style={[styles.dropdownItemText, darkMode && styles.darkDropdownItemText, selected && (darkMode ? styles.darkDropdownItemTextSelected : styles.dropdownItemTextSelected)]}>
              {item.label}
            </Text>
          </View>
        )}
      />
    </View>
  );

  // BUSINESS-SPECIFIC: previewBusiness object (EditProfileScreen has previewUser with more fields)
  const previewBusiness = buildBusinessMiniCardBusiness(
    {
      business_name: formData.name,
      tagline: formData.tagline,
      location: formData.location,
      addressLine2: formData.addressLine2,
      city: formData.city,
      state: formData.state,
      phone: formData.phone,
      email: formData.email,
      phoneIsPublic: formData.phoneIsPublic,
      emailIsPublic: formData.emailIsPublic,
      taglineIsPublic: formData.taglineIsPublic,
      locationIsPublic: formData.locationIsPublic,
      imageIsPublic: formData.imageIsPublic,
    },
    businessUID,
    {
      profileImageUri: businessImageUri || "",
      miniCardOptions: {
        previewMode: true,
        phoneIsPublic: formData.phoneIsPublic,
        emailIsPublic: formData.emailIsPublic,
        taglineIsPublic: formData.taglineIsPublic,
        locationIsPublic: formData.locationIsPublic,
        imageIsPublic: formData.imageIsPublic,
      },
    },
  );

  // MISSING: toggleProfileImageVisibility function (EditProfileScreen has this)
  // Note: Business profile doesn't have single profile image visibility toggle

  // BUSINESS-SPECIFIC: Services state and management (EditProfileScreen uses formData.experience, formData.education, etc.)
  const normalizeServiceFromApi = (service) => normalizeBusinessServiceRow(service);

  const [services, setServices] = useState(() => {
    const initialServices = business?.business_services || business?.services || [];
    const profileCcFeePayer = canonicalBusinessCcFeePayer(business?.business_cc_fee_payer ?? business?.bs_cc_fee_payer ?? business?.business_bs_cc_fee_payer ?? business?.cc_fee_payer);
    return initialServices.map((service) => ({
      ...normalizeServiceFromApi(service),
      business_cc_fee_payer: profileCcFeePayer,
    }));
  });

  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingServiceIndex, setEditingServiceIndex] = useState(null);
  /** Persisted rows removed this session (bs_uid); sent on save like delete_experiences on Edit Profile */
  const [deletedBusinessServiceUids, setDeletedBusinessServiceUids] = useState([]);

  useEffect(() => {
    const p = formData.businessPaysCcFee ? "seller" : "buyer";
    setServices((prev) => prev.map((row) => ({ ...row, business_cc_fee_payer: p })));
  }, [formData.businessPaysCcFee]);

  const defaultService = {
    bs_uid: "",
    bs_service_name: "",
    bs_service_desc: "",
    bs_notes: "",
    bs_sku: "",
    bs_bounty: "",
    bs_bounty_currency: "USD",
    bs_bounty_type: "none",
    bs_is_taxable: 0,
    bs_tax_rate: "0",
    bs_discount_allowed: 1,
    bs_refund_policy: "",
    bs_return_window_days: "0",
    bs_is_returnable: 0,
    bs_display_order: 1,
    bs_tags: "",
    bs_duration_minutes: "",
    bs_cost: "",
    bs_cost_currency: "USD",
    bs_is_visible: 1,
    bs_status: "active",
    bs_image_key: "",
    bs_quantity: "",
    bs_qty_unlimited: 1,
    bs_available_quantity: "",
    bs_condition_type: "na",
    bs_condition_detail: "",
    bs_free_shipping: 0,
    bs_buyer_pays_shipping: 0,
    bs_service_image_is_public: 1,
    bs_choice_groups: [],
    bs_special_instructions_enabled: 0,
    bs_special_instructions_max_chars: 80,
  };

  const [serviceForm, setServiceForm] = useState({ ...defaultService });
  /** Highlight tax row + focus input when Add/Update or Submit blocked by missing tax rate (see ShoppingCart refund highlight). */
  const [serviceFormTaxRateError, setServiceFormTaxRateError] = useState(false);
  /** Highlight quantity row when Limited is selected but count is missing or invalid. */
  const [serviceFormQuantityError, setServiceFormQuantityError] = useState(false);
  /** Highlight cost unit when cost is set but unit is missing. */
  const [serviceFormCostUnitError, setServiceFormCostUnitError] = useState(false);

  const handleServiceChange = (field, value) => {
    setServiceForm((prev) => ({ ...prev, [field]: value }));
    setIsChanged(true);
  };

  const toggleFreeShipping = () => {
    setServiceForm((prev) => {
      if (prev.bs_free_shipping === 1) {
        return { ...prev, bs_free_shipping: 0 };
      }
      return { ...prev, bs_free_shipping: 1, bs_buyer_pays_shipping: 0 };
    });
    setIsChanged(true);
  };

  const toggleBuyerPaysShipping = () => {
    setServiceForm((prev) => {
      if (prev.bs_buyer_pays_shipping === 1) {
        return { ...prev, bs_buyer_pays_shipping: 0 };
      }
      return { ...prev, bs_buyer_pays_shipping: 1, bs_free_shipping: 0 };
    });
    setIsChanged(true);
  };

  const setShippingNotApplicable = () => {
    setServiceForm((prev) => ({ ...prev, bs_free_shipping: 0, bs_buyer_pays_shipping: 0 }));
    setIsChanged(true);
  };

  const handleServiceCostAmountChange = (value) => {
    const parsed = parseServiceCost(serviceForm.bs_cost || "");
    const newAmount = value.replace(/\$/g, "");
    if (newAmount.toLowerCase() === "free") {
      handleServiceChange("bs_cost", "Free");
      return;
    }
    if (parsed.unit === "total") {
      handleServiceChange("bs_cost", newAmount ? `${newAmount} total` : "total");
    } else if (parsed.unit) {
      handleServiceChange("bs_cost", `${newAmount}/${parsed.unit}`);
    } else {
      handleServiceChange("bs_cost", newAmount);
    }
    setServiceFormCostUnitError(false);
    setIsChanged(true);
  };

  const handleServiceCostAmountBlur = () => {
    const parsed = parseServiceCost(serviceForm.bs_cost || "");
    if (parsed.amount.toLowerCase() === "free") return;
    const formattedAmount = formatCostValue(parsed.amount);
    if (parsed.unit === "total") {
      handleServiceChange("bs_cost", formattedAmount ? `${formattedAmount} total` : "total");
    } else if (parsed.unit) {
      handleServiceChange("bs_cost", `${formattedAmount}/${parsed.unit}`);
    } else {
      handleServiceChange("bs_cost", formattedAmount);
    }
    setIsChanged(true);
  };

  const handleServiceCostUnitChange = (selectedItem) => {
    const parsed = parseServiceCost(serviceForm.bs_cost || "");
    if (parsed.amount.toLowerCase() === "free") return;
    if (!selectedItem || !selectedItem.value) {
      handleServiceChange("bs_cost", parsed.amount);
    } else if (selectedItem.value === "total") {
      handleServiceChange("bs_cost", parsed.amount ? `${parsed.amount} total` : "total");
    } else {
      handleServiceChange("bs_cost", `${parsed.amount}/${selectedItem.value}`);
    }
    setServiceFormCostUnitError(false);
    setIsChanged(true);
  };

  const isShippingNotApplicable = (form) => !(form.bs_free_shipping === 1 || form.bs_free_shipping === "1") && !(form.bs_buyer_pays_shipping === 1 || form.bs_buyer_pays_shipping === "1");

  const buildServiceRowForList = (formSource = serviceForm) => {
    const existingService = editingServiceIndex !== null ? services[editingServiceIndex] : null;
    const isUnlimited = formSource.bs_qty_unlimited === 1 || formSource.bs_qty_unlimited === "1" || formSource.bs_qty_unlimited === true;
    if (!isUnlimited) {
      const q = String(formSource.bs_available_quantity || "").trim();
      if (!q || !/^\d+$/.test(q) || parseInt(q, 10) < 1) {
        return null;
      }
    }

    const formTaxable = formSource.bs_is_taxable === 1 || formSource.bs_is_taxable === "1" || formSource.bs_is_taxable === true;
    if (formTaxable) {
      const rate = parsePrice(formSource.bs_tax_rate);
      if (!Number.isFinite(rate) || rate <= 0) {
        return null;
      }
    }

    let nextBsImageKey = existingService?.bs_image_key ?? formSource.bs_image_key ?? "";
    let _svcNewImageUri = null;
    let _svcWebImageFile = null;
    let _svcDeleteImageUrl = null;

    const orig = originalServiceProductImage;
    const cur = serviceProductImageUri;

    if (!cur || serviceProductImageError) {
      if (orig && (orig.startsWith("http://") || orig.startsWith("https://"))) {
        _svcDeleteImageUrl = orig;
        nextBsImageKey = "";
      }
    } else if (cur !== orig) {
      const isLocal = cur.startsWith("file:") || cur.startsWith("content:") || cur.startsWith("data:") || cur.startsWith("blob:");
      if (isLocal || (Platform.OS === "web" && serviceProductWebFile)) {
        _svcNewImageUri = cur;
        _svcWebImageFile = Platform.OS === "web" ? serviceProductWebFile : null;
        if (orig && (orig.startsWith("http://") || orig.startsWith("https://"))) {
          _svcDeleteImageUrl = orig;
        }
        nextBsImageKey = "";
      }
    }

    const bountyTypeForList = formSource.bs_bounty_type === "none" ? "per_item" : formSource.bs_bounty_type === "total" ? "total" : "per_item";
    const bountyAmtForList = formSource.bs_bounty_type === "none" ? "" : formSource.bs_bounty || "";

    const condForm = formSource.bs_condition_type;
    const conditionTypeForList = condForm === "used" ? "used" : "new";
    const conditionDetailForList = condForm === "used" ? String(formSource.bs_condition_detail || "").trim() : "";

    return {
      ...formSource,
      business_cc_fee_payer: formData.businessPaysCcFee ? "seller" : "buyer",
      bs_qty_unlimited: isUnlimited ? 1 : 0,
      bs_available_quantity: isUnlimited ? "" : String(formSource.bs_available_quantity || "").trim(),
      bs_bounty_type: bountyTypeForList,
      bs_bounty: bountyAmtForList,
      bs_condition_type: conditionTypeForList,
      bs_condition_detail: conditionDetailForList,
      bs_is_taxable: formTaxable ? 1 : 0,
      bs_tax_rate: formTaxable ? String(parsePrice(formSource.bs_tax_rate) || "0") : "0",
      bs_is_returnable: normServiceReturnable(formSource),
      bs_return_window_days: returnWindowDaysForForm(formSource),
      bs_tags: normServiceTags(formSource),
      bs_image_key: nextBsImageKey,
      bs_uid: existingService?.bs_uid || "",
      bs_choice_groups: formSource.bs_choice_groups || [],
      bs_special_instructions_enabled: formSource.bs_special_instructions_enabled || 0,
      bs_special_instructions_max_chars: formSource.bs_special_instructions_max_chars || 80,
      _svcNewImageUri,
      _svcWebImageFile,
      _svcDeleteImageUrl,
    };
  };

  const resetServiceProductImageState = () => {
    setServiceProductImageUri("");
    setOriginalServiceProductImage("");
    setServiceProductWebFile(null);
    setServiceProductImageError(false);
  };

  const handleAddService = () => {
    if (!serviceForm.bs_service_name.trim()) {
      Alert.alert("Validation", "Product or Service name is required.");
      return;
    }

    if (productTagInput.trim()) {
      alertUnsavedTags("Click Add to save your product tags, or clear the tag field before adding/updating the product.");
      return;
    }

    if (!affirmServiceQuantityOrHighlight()) return;
    if (!affirmServiceTaxRateOrHighlight()) return;
    if (!affirmServiceCostUnitOrHighlight()) return;

    const row = buildServiceRowForList();
    if (!row) return;

    console.log("🟢 handleAddService - row.bs_choice_groups:", JSON.stringify(row.bs_choice_groups));
    console.log("🟢 handleAddService - serviceForm.bs_choice_groups:", JSON.stringify(serviceForm.bs_choice_groups));

    if (editingServiceIndex !== null) {
      const updatedServices = [...services];
      updatedServices[editingServiceIndex] = row;
      setServices(updatedServices);
    } else {
      setServices((prev) => [...prev, row]);
    }

    setIsChanged(true);
    setServiceForm({ ...defaultService });
    setShowServiceForm(false);
    setEditingServiceIndex(null);
    setServiceFormTaxRateError(false);
    setServiceFormQuantityError(false);
    setServiceFormCostUnitError(false);
    setProductTagInput("");
    resetServiceProductImageState();
  };

  const handleEditService = (service, index) => {
    setServiceForm({
      ...defaultService,
      ...service,
      bs_uid: service.bs_uid || "",
      bs_tags: service.bs_tags || "",
      bs_condition_type: (() => {
        if (service.bs_condition_type === "used") return "used";
        if (service.bs_condition_type === "na") return "na";
        return "new";
      })(),
      bs_condition_detail: service.bs_condition_type === "used" ? service.bs_condition_detail || "" : "",
      bs_bounty_type: (() => {
        const b = service.bs_bounty;
        if (b == null || String(b).trim() === "" || parsePrice(b) === 0) return "none";
        if (service.bs_bounty_type === "total") return "total";
        return "per_item";
      })(),
      bs_bounty: service.bs_bounty == null || String(service.bs_bounty).trim() === "" || parsePrice(service.bs_bounty) === 0 ? "" : String(service.bs_bounty),
      bs_free_shipping: service.bs_free_shipping === 1 || service.bs_free_shipping === "1" || service.bs_free_shipping === true ? 1 : 0,
      bs_buyer_pays_shipping: service.bs_buyer_pays_shipping === 1 || service.bs_buyer_pays_shipping === "1" || service.bs_buyer_pays_shipping === true ? 1 : 0,
      bs_choice_groups: service.bs_choice_groups || [],
      bs_special_instructions_enabled: service.bs_special_instructions_enabled || 0,
      bs_special_instructions_max_chars: service.bs_special_instructions_max_chars || 80,
      bs_qty_unlimited: service.bs_qty_unlimited === 0 || service.bs_qty_unlimited === "0" ? 0 : 1,
      bs_available_quantity: service.bs_available_quantity != null ? String(service.bs_available_quantity) : "",
      bs_service_image_is_public: service.bs_service_image_is_public === 0 || service.bs_service_image_is_public === "0" ? 0 : 1,
      bs_is_taxable: (() => {
        if (service.bs_is_taxable === 1 || service.bs_is_taxable === "1" || service.bs_is_taxable === true) return 1;
        if (service.bs_is_taxable === 0 || service.bs_is_taxable === "0" || service.bs_is_taxable === false) return 0;
        return parsePrice(service.bs_tax_rate) > 0 ? 1 : 0;
      })(),
      bs_tax_rate: (() => {
        const taxable =
          service.bs_is_taxable === 1 ||
          service.bs_is_taxable === "1" ||
          service.bs_is_taxable === true ||
          (!(service.bs_is_taxable === 0 || service.bs_is_taxable === "0" || service.bs_is_taxable === false) && parsePrice(service.bs_tax_rate) > 0);
        return taxable ? String(service.bs_tax_rate ?? "").trim() || "0" : "0";
      })(),
      bs_is_returnable: normServiceReturnable(service),
      bs_return_window_days: returnWindowDaysForForm(service),
    });
    const remoteDisplay = resolveServiceImageDisplayUri(service.bs_image_key);
    const pendingUri = service._svcNewImageUri && String(service._svcNewImageUri).trim() !== "" ? String(service._svcNewImageUri).trim() : "";
    const disp = pendingUri || remoteDisplay;
    setServiceProductImageUri(disp);
    setOriginalServiceProductImage(remoteDisplay);
    setServiceProductWebFile(service._svcWebFile || null);
    setServiceProductImageError(false);
    setEditingServiceIndex(index);
    setServiceFormTaxRateError(false);
    setServiceFormQuantityError(false);
    setServiceFormCostUnitError(false);
    setProductTagInput("");
    setShowServiceForm(true);

    // Load choice groups from backend only if not already set locally
    if (service.bs_uid && service.bs_uid.trim() !== "") {
      const localGroups = service.bs_choice_groups || [];
      if (localGroups.length === 0) {
        fetch(`${API_BASE_URL}/api/business_service_options/${service.bs_uid}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.result && data.result.length > 0) {
              handleServiceChange("bs_choice_groups", data.result);
            }
          })
          .catch((e) => console.warn("Failed to load service options:", e));
      }
      // If local groups exist, keep them (don't overwrite with backend)
    }
  };

  const handleCancelEdit = () => {
    setServiceForm({ ...defaultService });
    setShowServiceForm(false);
    setEditingServiceIndex(null);
    setServiceFormTaxRateError(false);
    setServiceFormQuantityError(false);
    setServiceFormCostUnitError(false);
    setProductTagInput("");
    resetServiceProductImageState();
  };

  const handleDeleteService = (index) => {
    const svc = services[index];
    if (!svc) return;
    const name = (svc.bs_service_name && String(svc.bs_service_name).trim()) || "this item";

    const applyDelete = () => {
      const uid = svc.bs_uid && String(svc.bs_uid).trim();
      if (uid) {
        setDeletedBusinessServiceUids((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
      }
      // Delete options for this service
      if (uid) {
        fetch(`${API_BASE_URL}/api/business_service_options/${uid}`, {
          method: "DELETE",
        }).catch((e) => console.warn("Failed to delete service options:", e));
      }
      setServices((prev) => prev.filter((_, i) => i !== index));
      setIsChanged(true);
      if (showServiceForm) {
        if (editingServiceIndex === index) {
          setShowServiceForm(false);
          setEditingServiceIndex(null);
          setServiceForm({ ...defaultService });
          setProductTagInput("");
          resetServiceProductImageState();
        } else if (editingServiceIndex !== null && editingServiceIndex > index) {
          setEditingServiceIndex(editingServiceIndex - 1);
        }
      }
    };

    // react-native-web often does not run Alert action-button onPress; use sync confirm on web.
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const ok = window.confirm(`Delete "${name}"?\n\nIt will be removed from this list. Save the profile to apply on the server.`);
      if (ok) applyDelete();
      return;
    }

    Alert.alert("Delete", `Are you sure you want to delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: applyDelete },
    ]);
  };

  // BUSINESS-SPECIFIC: Ownership check useEffect (EditProfileScreen doesn't have this)
  // Check if current user is owner/editor of the business

  useEffect(() => {
    const checkBusinessOwnership = async () => {
      try {
        const userUid = await AsyncStorage.getItem("user_uid");
        if (!userUid) {
          setIsOwner(false);
          return;
        }

        // Check if current user is in the business_users list
        if (Array.isArray(business_users) && business_users.length > 0) {
          const isInBusinessUsers = business_users.some((u) => u.business_user_id === userUid);
          setIsOwner(isInBusinessUsers);
          return;
        }

        // Fallback: if business_users is empty but we're on edit screen, assume owner
        setIsOwner(true);
      } catch (error) {
        console.error("EditBusinessProfileScreen - Error checking business ownership:", error);
        setIsOwner(true); // Default to true since they navigated to edit screen
      }
    };

    checkBusinessOwnership();
  }, [business_users]);

  // Warn before leaving with unsaved changes (same pattern as EditProfileScreen: beforeRemove + modal + BottomNavBar).
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (suppressLeavePromptRef.current) return;
      if (!isChanged) return;
      e.preventDefault();
      pendingRemoveActionRef.current = e.data.action;
      setShowUnsavedChangesModal(true);
    });
    return unsubscribe;
  }, [navigation, isChanged]);

  useEffect(() => {
    const handleHardwareBack = () => {
      if (suppressLeavePromptRef.current) return false;
      if (!isChanged) return false;
      pendingRemoveActionRef.current = null;
      setShowUnsavedChangesModal(true);
      return true;
    };
    if (Platform.OS === "android") {
      const sub = BackHandler.addEventListener("hardwareBackPress", handleHardwareBack);
      return () => sub.remove();
    }
  }, [isChanged]);

  // Track the currently focused input
  const focusedInputRef = useRef(null);
  const keyboardHeightRef = useRef(0);

  // Function to scroll to a focused input
  const scrollToFocusedInput = () => {
    if (!focusedInputRef.current || !scrollViewRef.current) return;

    setTimeout(() => {
      try {
        const inputHandle = findNodeHandle(focusedInputRef.current);
        const scrollHandle = findNodeHandle(scrollViewRef.current);

        if (!inputHandle || !scrollHandle) return;

        UIManager.measureLayout(
          inputHandle,
          scrollHandle,
          (success) => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          },
          (x, y, width, height) => {
            const { Dimensions } = require("react-native");
            const screenHeight = Dimensions.get("window").height;
            const bottomNavBarHeight = 80;
            const keyboardHeight = keyboardHeightRef.current || 300;
            const availableHeight = screenHeight - keyboardHeight - bottomNavBarHeight;
            const inputBottom = y + height;
            const padding = 30;
            const targetScrollY = y - (availableHeight - height - padding);

            scrollViewRef.current?.scrollTo({
              y: Math.max(0, targetScrollY),
              animated: true,
            });
          },
        );
      } catch (error) {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    }, 200);
  };

  /** Scroll sales tax row into view when validation fails (same pattern as ShoppingCartScreen focusRefundPolicySection). */
  const focusServiceFormSalesTaxSection = () => {
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const scroll = scrollViewRef.current;
          const target = serviceSalesTaxSectionRef.current;
          if (!scroll) return;
          if (!target) {
            scroll.scrollToEnd({ animated: true });
            return;
          }
          const scrollNative = findNodeHandle(scroll);
          if (!scrollNative) {
            scroll.scrollToEnd({ animated: true });
            return;
          }
          try {
            target.measureLayout(
              scrollNative,
              (_x, y) => {
                scroll.scrollTo({ y: Math.max(0, y - 16), animated: true });
              },
              () => {
                scroll.scrollToEnd({ animated: true });
              },
            );
          } catch {
            scroll.scrollToEnd({ animated: true });
          }
        }, 80);
      });
    });
  };

  const focusServiceFormQuantitySection = () => {
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const scroll = scrollViewRef.current;
          const target = serviceQuantitySectionRef.current;
          if (!scroll) return;
          if (!target) {
            scroll.scrollToEnd({ animated: true });
            return;
          }
          const scrollNative = findNodeHandle(scroll);
          if (!scrollNative) {
            scroll.scrollToEnd({ animated: true });
            return;
          }
          try {
            target.measureLayout(
              scrollNative,
              (_x, y) => {
                scroll.scrollTo({ y: Math.max(0, y - 16), animated: true });
              },
              () => {
                scroll.scrollToEnd({ animated: true });
              },
            );
          } catch {
            scroll.scrollToEnd({ animated: true });
          }
        }, 80);
      });
    });
  };

  const affirmServiceTaxRateOrHighlight = () => {
    const formTaxable = serviceForm.bs_is_taxable === 1 || serviceForm.bs_is_taxable === "1" || serviceForm.bs_is_taxable === true;
    if (!formTaxable) {
      setServiceFormTaxRateError(false);
      return true;
    }
    const rate = parsePrice(serviceForm.bs_tax_rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      setServiceFormTaxRateError(true);
      setServiceFormQuantityError(false);
      focusServiceFormSalesTaxSection();
      setTimeout(() => serviceTaxRateInputRef.current?.focus(), 120);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert("Taxable items need a tax rate greater than 0% (for example 8.25).");
      } else {
        Alert.alert("Validation", "Taxable items need a tax rate greater than 0% (for example 8.25).");
      }
      return false;
    }
    setServiceFormTaxRateError(false);
    return true;
  };

  const affirmServiceQuantityOrHighlight = () => {
    const isUnlimited = serviceForm.bs_qty_unlimited === 1 || serviceForm.bs_qty_unlimited === "1" || serviceForm.bs_qty_unlimited === true;
    if (isUnlimited) {
      setServiceFormQuantityError(false);
      return true;
    }
    const q = String(serviceForm.bs_available_quantity || "").trim();
    if (!q || !/^\d+$/.test(q) || parseInt(q, 10) < 1) {
      setServiceFormQuantityError(true);
      setServiceFormTaxRateError(false);
      setServiceFormCostUnitError(false);
      focusServiceFormQuantitySection();
      setTimeout(() => serviceQuantityInputRef.current?.focus(), 120);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert("Please enter a valid available quantity (whole number ≥ 1) or choose No limit.");
      } else {
        Alert.alert("Validation", "Please enter a valid available quantity (whole number ≥ 1) or choose No limit.");
      }
      return false;
    }
    setServiceFormQuantityError(false);
    return true;
  };

  const affirmServiceCostUnitOrHighlight = () => {
    const costStr = String(serviceForm.bs_cost || "").trim();
    if (!costStr || parsePrice(costStr) <= 0) {
      setServiceFormCostUnitError(false);
      return true;
    }
    if (serviceCostHasUnit(costStr)) {
      setServiceFormCostUnitError(false);
      return true;
    }
    setServiceFormCostUnitError(true);
    setServiceFormTaxRateError(false);
    setServiceFormQuantityError(false);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert("Please select a cost unit (total, /hr, /day, etc.) when a cost is entered.");
    } else {
      Alert.alert("Validation", "Please select a cost unit (total, /hr, /day, etc.) when a cost is entered.");
    }
    return false;
  };

  // Handle keyboard show/hide to scroll to focused input
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener("keyboardDidShow", (e) => {
      keyboardHeightRef.current = e.endCoordinates.height;
      scrollToFocusedInput();
    });

    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  const renderProductsServicesForm = () => {
    const formTaxableFlag = serviceForm.bs_is_taxable === 1 || serviceForm.bs_is_taxable === "1" || serviceForm.bs_is_taxable === true;
    const taxRateParsed = parsePrice(serviceForm.bs_tax_rate);
    const taxAddBlocked = formTaxableFlag && (!Number.isFinite(taxRateParsed) || taxRateParsed <= 0);
    const isUnlimitedFlag = serviceForm.bs_qty_unlimited === 1 || serviceForm.bs_qty_unlimited === "1" || serviceForm.bs_qty_unlimited === true;
    const qFlag = String(serviceForm.bs_available_quantity || "").trim();
    const quantityAddBlocked = !isUnlimitedFlag && (!qFlag || !/^\d+$/.test(qFlag) || parseInt(qFlag, 10) < 1);
    const costStrFlag = String(serviceForm.bs_cost || "").trim();
    const costUnitAddBlocked = costStrFlag !== "" && parsePrice(costStrFlag) > 0 && !serviceCostHasUnit(costStrFlag);
    const parsedServiceCost = parseServiceCost(serviceForm.bs_cost || "");
    const addServiceBlocked = taxAddBlocked || quantityAddBlocked || costUnitAddBlocked;
    return (
      <View style={[styles.serviceFormContainer, darkMode && styles.darkServiceFormContainer]}>
        <Text style={[styles.formTitle, darkMode && styles.darkFormTitle]}>{editingServiceIndex !== null ? "Edit Product/Service" : "Add New Product/Service"}</Text>

        <View style={[styles.serviceFormMiniCard, darkMode && styles.darkServiceFormMiniCard]}>
          <View style={styles.serviceFormMiniCardLeft}>
            <Image
              source={serviceProductImageUri && !serviceProductImageError ? { uri: serviceProductImageUri } : DEFAULT_BUSINESS_IMAGE}
              style={[styles.serviceFormMiniCardImage, darkMode && styles.serviceFormMiniCardImageDark]}
              onError={handleServiceProductImageError}
            />
            <View style={styles.serviceImageShowHideRow}>
              <TouchableOpacity
                onPress={() => {
                  handleServiceChange("bs_service_image_is_public", 1);
                  setIsChanged(true);
                }}
                style={[
                  styles.serviceImageTogglePill,
                  (serviceForm.bs_service_image_is_public === 1 || serviceForm.bs_service_image_is_public === "1") && styles.serviceImageTogglePillActive,
                  darkMode && !(serviceForm.bs_service_image_is_public === 1 || serviceForm.bs_service_image_is_public === "1") && styles.serviceImageTogglePillDark,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.serviceImageTogglePillText,
                    (serviceForm.bs_service_image_is_public === 1 || serviceForm.bs_service_image_is_public === "1") && styles.serviceImageTogglePillTextActive,
                    !(serviceForm.bs_service_image_is_public === 1 || serviceForm.bs_service_image_is_public === "1") && darkMode && styles.serviceImageTogglePillTextMutedDark,
                  ]}
                >
                  Show
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  handleServiceChange("bs_service_image_is_public", 0);
                  setIsChanged(true);
                }}
                style={[
                  styles.serviceImageTogglePill,
                  !(serviceForm.bs_service_image_is_public === 1 || serviceForm.bs_service_image_is_public === "1") && styles.serviceImageTogglePillActive,
                  darkMode && (serviceForm.bs_service_image_is_public === 1 || serviceForm.bs_service_image_is_public === "1") && styles.serviceImageTogglePillDark,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.serviceImageTogglePillText,
                    !(serviceForm.bs_service_image_is_public === 1 || serviceForm.bs_service_image_is_public === "1") && styles.serviceImageTogglePillTextActive,
                    (serviceForm.bs_service_image_is_public === 1 || serviceForm.bs_service_image_is_public === "1") && darkMode && styles.serviceImageTogglePillTextMutedDark,
                  ]}
                >
                  Hide
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.serviceUploadButton, darkMode && styles.darkServiceUploadButton]} onPress={handlePickServiceProductImage} activeOpacity={0.8}>
              <Text style={styles.serviceUploadButtonText}>Upload</Text>
            </TouchableOpacity>
            {serviceProductImageUri ? (
              <TouchableOpacity onPress={handleRemoveServiceProductImage} style={styles.serviceRemoveImageBtn}>
                <Text style={[styles.serviceRemoveImageText, darkMode && styles.darkServiceRemoveImageText]}>Remove image</Text>
              </TouchableOpacity>
            ) : null}
            {Platform.OS === "web" &&
              React.createElement("input", {
                ref: serviceImageFileInputRef,
                type: "file",
                accept: "image/*",
                style: { display: "none" },
                onChange: handleWebServiceProductImagePick,
              })}
          </View>
          <View style={styles.serviceFormMiniCardFields}>
            <TextInput
              style={[styles.input, styles.serviceFormMiniFieldInput, styles.serviceFormCompactInput, darkMode && styles.darkInput]}
              value={serviceForm.bs_service_name}
              onChangeText={(t) => handleServiceChange("bs_service_name", t)}
              placeholder='Product or Service Name'
              placeholderTextColor={darkMode ? "#cccccc" : "#666"}
            />
            <TextInput
              style={[styles.input, styles.serviceFormDescInput, styles.serviceFormCompactDesc, darkMode && styles.darkInput]}
              value={serviceForm.bs_service_desc}
              onChangeText={(t) => handleServiceChange("bs_service_desc", t)}
              placeholder='Description'
              placeholderTextColor={darkMode ? "#cccccc" : "#666"}
              multiline
              numberOfLines={3}
              textAlignVertical='top'
            />
          </View>
        </View>

        <View style={styles.serviceFormCompactRow}>
          <Text style={[styles.serviceFormRowTitle, darkMode && styles.darkServiceFormRowTitle]}>SKU</Text>
          <View style={styles.serviceFormRowBody}>
            <TextInput
              style={[styles.serviceFormRowInput, darkMode && styles.darkServiceFormRowInput]}
              value={serviceForm.bs_sku || ""}
              onChangeText={(t) => handleServiceChange("bs_sku", t)}
              placeholder='Optional'
              placeholderTextColor={darkMode ? "#888" : "#999"}
              autoCapitalize='characters'
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={{ marginBottom: 8 }}>
          <TagSectionLabel title='Product Tags' style={[styles.serviceFormRowTitle, darkMode && styles.darkServiceFormRowTitle, { width: "100%", marginBottom: 4 }]} darkMode={darkMode} />
          {renderTagEditor({
            inputValue: productTagInput,
            onChangeInput: (text) => {
              setProductTagInput(text);
              if (text.trim()) setIsChanged(true);
            },
            onAdd: addProductTag,
            tags: parseTagList(serviceForm.bs_tags),
            onRemove: removeProductTag,
          })}
        </View>

        <View style={styles.serviceFormCompactRow}>
          <Text style={[styles.serviceFormRowTitle, darkMode && styles.darkServiceFormRowTitle, serviceFormCostUnitError && { color: "#FF3B30" }]}>Cost</Text>
          <View style={styles.serviceFormRowBody}>
            <Dropdown
              style={[
                styles.serviceCurrencyDropdown,
                styles.serviceCurrencyDropdownCompact,
                styles.serviceCurrencyDropdownGreen,
                darkMode && styles.darkServiceCurrencyDropdown,
                darkMode && styles.darkServiceCurrencyDropdownGreen,
              ]}
              data={SERVICE_CURRENCY_OPTIONS}
              labelField='label'
              valueField='value'
              placeholder='USD'
              placeholderTextColor={darkMode ? "#999" : "#666"}
              value={serviceForm.bs_cost_currency || "USD"}
              onChange={(item) => {
                handleServiceChange("bs_cost_currency", item.value);
                setIsChanged(true);
              }}
              containerStyle={[{ borderRadius: 10, width: 84, borderWidth: 2, borderColor: "#00C721" }, darkMode && { backgroundColor: "#1a2e1f", borderColor: "#4ade80" }]}
              itemTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 14 }}
              selectedTextStyle={{ color: darkMode ? "#86efac" : "#166534", fontSize: 14, fontWeight: "600" }}
              activeColor={darkMode ? "#14532d" : "#dcfce7"}
              maxHeight={220}
              renderItem={(item) => (
                <View style={{ paddingVertical: 0, paddingHorizontal: 12 }}>
                  <Text style={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 14 }}>{item.label}</Text>
                </View>
              )}
              flatListProps={{ nestedScrollEnabled: true }}
            />
            <TextInput
              style={[styles.input, styles.serviceAmountInput, styles.serviceAmountInputCompact, darkMode && styles.darkInput, serviceFormCostUnitError && { borderWidth: 2, borderColor: "#FF3B30" }]}
              value={(() => {
                const parsed = parsedServiceCost;
                const amount = parsed.amount;
                if (!amount) return "";
                if (amount.toLowerCase() === "free") return "Free";
                return amount;
              })()}
              onChangeText={handleServiceCostAmountChange}
              onBlur={handleServiceCostAmountBlur}
              placeholder='0.00'
              keyboardType='decimal-pad'
              placeholderTextColor={darkMode ? "#cccccc" : "#666"}
            />
            <Dropdown
              style={[
                styles.serviceCostUnitDropdown,
                darkMode && styles.darkServiceCostUnitDropdown,
                serviceFormCostUnitError && { borderWidth: 2, borderColor: "#FF3B30" },
                !parsedServiceCost.unit && parsePrice(serviceForm.bs_cost) > 0 && styles.serviceCostUnitDropdownRequired,
              ]}
              data={SERVICE_COST_UNIT_OPTIONS}
              labelField='label'
              valueField='value'
              placeholder='Unit *'
              placeholderStyle={{ color: serviceFormCostUnitError || (parsePrice(serviceForm.bs_cost) > 0 && !parsedServiceCost.unit) ? "#FF3B30" : darkMode ? "#999" : "#666" }}
              value={parsedServiceCost.unit || null}
              onChange={handleServiceCostUnitChange}
              containerStyle={[{ borderRadius: 10, minWidth: 88 }, darkMode && { backgroundColor: "#2d2d2d" }]}
              itemTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 14 }}
              selectedTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 14 }}
              activeColor={darkMode ? "#404040" : "#f0f0f0"}
              maxHeight={220}
              flatListProps={{ nestedScrollEnabled: true }}
            />
          </View>
        </View>

        <View ref={serviceSalesTaxSectionRef} collapsable={false} style={styles.serviceFormCompactRow}>
          <Text style={[styles.serviceFormRowTitle, darkMode && styles.darkServiceFormRowTitle, serviceFormTaxRateError && { color: "#FF3B30" }]}>Sales tax</Text>
          <View style={styles.serviceFormRowBody}>
            <TouchableOpacity
              style={[styles.bountyTypeBtn, styles.bountyTypeBtnCompact, !(serviceForm.bs_is_taxable === 1 || serviceForm.bs_is_taxable === "1") && styles.bountyTypeBtnActive]}
              onPress={() => {
                setServiceForm((prev) => ({ ...prev, bs_is_taxable: 0, bs_tax_rate: "0" }));
                setServiceFormTaxRateError(false);
                setIsChanged(true);
              }}
            >
              <Text style={[styles.bountyTypeBtnText, styles.bountyTypeBtnTextCompact, !(serviceForm.bs_is_taxable === 1 || serviceForm.bs_is_taxable === "1") && styles.bountyTypeBtnTextActive]}>
                No tax
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bountyTypeBtn, styles.bountyTypeBtnCompact, (serviceForm.bs_is_taxable === 1 || serviceForm.bs_is_taxable === "1") && styles.bountyTypeBtnActive]}
              onPress={() => {
                setServiceForm((prev) => ({
                  ...prev,
                  bs_is_taxable: 1,
                  bs_tax_rate: prev.bs_tax_rate && String(prev.bs_tax_rate).trim() !== "" && String(prev.bs_tax_rate).trim() !== "0" ? String(prev.bs_tax_rate) : "",
                }));
                setServiceFormTaxRateError(false);
                setIsChanged(true);
              }}
            >
              <Text style={[styles.bountyTypeBtnText, styles.bountyTypeBtnTextCompact, (serviceForm.bs_is_taxable === 1 || serviceForm.bs_is_taxable === "1") && styles.bountyTypeBtnTextActive]}>
                Taxable
              </Text>
            </TouchableOpacity>
            {serviceForm.bs_is_taxable === 1 || serviceForm.bs_is_taxable === "1" ? (
              <TextInput
                ref={serviceTaxRateInputRef}
                style={[styles.serviceFormRowInput, darkMode && styles.darkServiceFormRowInput, serviceFormTaxRateError && { borderWidth: 2, borderColor: "#FF3B30" }]}
                value={String(serviceForm.bs_tax_rate ?? "")}
                onChangeText={(t) => {
                  handleServiceChange("bs_tax_rate", t.replace(/[^0-9.]/g, ""));
                  setServiceFormTaxRateError(false);
                  setIsChanged(true);
                }}
                placeholder='% e.g. 8.25'
                keyboardType='decimal-pad'
                placeholderTextColor={darkMode ? "#888" : "#999"}
              />
            ) : null}
          </View>
        </View>

        <View style={styles.serviceFormCompactRow}>
          <Text style={[styles.serviceFormRowTitle, darkMode && styles.darkServiceFormRowTitle]}>Bounty</Text>
          <View style={styles.serviceFormRowBody}>
            <TouchableOpacity
              style={[styles.bountyTypeBtn, styles.bountyTypeBtnCompact, serviceForm.bs_bounty_type === "none" && styles.bountyTypeBtnActive]}
              onPress={() => {
                setServiceForm((prev) => ({ ...prev, bs_bounty_type: "none", bs_bounty: "" }));
                setIsChanged(true);
              }}
            >
              <Text style={[styles.bountyTypeBtnText, styles.bountyTypeBtnTextCompact, serviceForm.bs_bounty_type === "none" && styles.bountyTypeBtnTextActive]}>No Bounty</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bountyTypeBtn, styles.bountyTypeBtnCompact, styles.bountyTypeBtnLong, serviceForm.bs_bounty_type === "per_item" && styles.bountyTypeBtnActive]}
              onPress={() => {
                setServiceForm((prev) => ({ ...prev, bs_bounty_type: "per_item" }));
                setIsChanged(true);
              }}
            >
              <Text style={[styles.bountyTypeBtnText, styles.bountyTypeBtnTextCompact, styles.bountyTypeBtnTextLong, serviceForm.bs_bounty_type === "per_item" && styles.bountyTypeBtnTextActive]}>
                Pay Bounty Per Item
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bountyTypeBtn, styles.bountyTypeBtnCompact, styles.bountyTypeBtnLong, serviceForm.bs_bounty_type === "total" && styles.bountyTypeBtnActive]}
              onPress={() => {
                setServiceForm((prev) => ({ ...prev, bs_bounty_type: "total" }));
                setIsChanged(true);
              }}
            >
              <Text style={[styles.bountyTypeBtnText, styles.bountyTypeBtnTextCompact, styles.bountyTypeBtnTextLong, serviceForm.bs_bounty_type === "total" && styles.bountyTypeBtnTextActive]}>
                Pay Single Bounty
              </Text>
            </TouchableOpacity>
            {serviceForm.bs_bounty_type !== "none" ? (
              <>
                <Dropdown
                  style={[
                    styles.serviceCurrencyDropdown,
                    styles.serviceCurrencyDropdownCompact,
                    styles.serviceCurrencyDropdownGreen,
                    darkMode && styles.darkServiceCurrencyDropdown,
                    darkMode && styles.darkServiceCurrencyDropdownGreen,
                  ]}
                  data={SERVICE_CURRENCY_OPTIONS}
                  labelField='label'
                  valueField='value'
                  placeholder='USD'
                  placeholderTextColor={darkMode ? "#999" : "#666"}
                  value={serviceForm.bs_bounty_currency || "USD"}
                  onChange={(item) => {
                    handleServiceChange("bs_bounty_currency", item.value);
                    setIsChanged(true);
                  }}
                  containerStyle={[{ borderRadius: 10, width: 84, borderWidth: 2, borderColor: "#00C721" }, darkMode && { backgroundColor: "#1a2e1f", borderColor: "#4ade80" }]}
                  itemTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 14 }}
                  selectedTextStyle={{ color: darkMode ? "#86efac" : "#166534", fontSize: 14, fontWeight: "600" }}
                  activeColor={darkMode ? "#14532d" : "#dcfce7"}
                  maxHeight={220}
                  renderItem={(item) => (
                    <View style={{ paddingVertical: 6, paddingHorizontal: 12 }}>
                      <Text style={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 14 }}>{item.label}</Text>
                    </View>
                  )}
                  flatListProps={{ nestedScrollEnabled: true }}
                />
                <TextInput
                  style={[styles.input, styles.serviceAmountInput, styles.serviceAmountInputCompact, darkMode && styles.darkInput]}
                  value={serviceForm.bs_bounty}
                  onChangeText={(t) => handleServiceChange("bs_bounty", t)}
                  placeholder='0.00'
                  keyboardType='decimal-pad'
                  placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                />
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.serviceFormCompactRow}>
          <Text style={[styles.serviceFormRowTitle, darkMode && styles.darkServiceFormRowTitle]}>Condition</Text>
          <View style={styles.serviceFormRowBody}>
            <TouchableOpacity
              style={[styles.bountyTypeBtn, styles.bountyTypeBtnCompact, styles.bountyTypeBtnLong, serviceForm.bs_condition_type === "na" && styles.bountyTypeBtnActive]}
              onPress={() => {
                setServiceForm((prev) => ({ ...prev, bs_condition_type: "na", bs_condition_detail: "" }));
                setIsChanged(true);
              }}
            >
              <Text style={[styles.bountyTypeBtnText, styles.bountyTypeBtnTextCompact, styles.bountyTypeBtnTextLong, serviceForm.bs_condition_type === "na" && styles.bountyTypeBtnTextActive]}>
                Not Applicable
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bountyTypeBtn, styles.bountyTypeBtnCompact, styles.bountyTypeBtnLong, serviceForm.bs_condition_type === "new" && styles.bountyTypeBtnActive]}
              onPress={() => {
                setServiceForm((prev) => ({ ...prev, bs_condition_type: "new", bs_condition_detail: "" }));
                setIsChanged(true);
              }}
            >
              <Text style={[styles.bountyTypeBtnText, styles.bountyTypeBtnTextCompact, styles.bountyTypeBtnTextLong, serviceForm.bs_condition_type === "new" && styles.bountyTypeBtnTextActive]}>
                New
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bountyTypeBtn, styles.bountyTypeBtnCompact, styles.bountyTypeBtnLong, serviceForm.bs_condition_type === "used" && styles.bountyTypeBtnActive]}
              onPress={() => {
                setServiceForm((prev) => ({ ...prev, bs_condition_type: "used" }));
                setIsChanged(true);
              }}
            >
              <Text style={[styles.bountyTypeBtnText, styles.bountyTypeBtnTextCompact, styles.bountyTypeBtnTextLong, serviceForm.bs_condition_type === "used" && styles.bountyTypeBtnTextActive]}>
                Used
              </Text>
            </TouchableOpacity>
            {serviceForm.bs_condition_type === "used" ? (
              <TextInput
                style={[styles.serviceFormRowInput, darkMode && styles.darkServiceFormRowInput]}
                value={serviceForm.bs_condition_detail}
                onChangeText={(t) => handleServiceChange("bs_condition_detail", t)}
                placeholder='Description'
                placeholderTextColor={darkMode ? "#888" : "#999"}
              />
            ) : null}
          </View>
        </View>

        <View style={styles.serviceFormCompactRow}>
          <Text style={[styles.serviceFormRowTitle, darkMode && styles.darkServiceFormRowTitle]}>Returnable</Text>
          <View style={styles.serviceFormRowBody}>
            <TouchableOpacity
              style={[styles.bountyTypeBtn, styles.bountyTypeBtnCompact, !(serviceForm.bs_is_returnable === 1 || serviceForm.bs_is_returnable === "1") && styles.bountyTypeBtnActive]}
              onPress={() => {
                setServiceForm((prev) => ({ ...prev, bs_is_returnable: 0, bs_return_window_days: "0" }));
                setIsChanged(true);
              }}
            >
              <Text
                style={[styles.bountyTypeBtnText, styles.bountyTypeBtnTextCompact, !(serviceForm.bs_is_returnable === 1 || serviceForm.bs_is_returnable === "1") && styles.bountyTypeBtnTextActive]}
              >
                No
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bountyTypeBtn, styles.bountyTypeBtnCompact, (serviceForm.bs_is_returnable === 1 || serviceForm.bs_is_returnable === "1") && styles.bountyTypeBtnActive]}
              onPress={() => {
                setServiceForm((prev) => ({
                  ...prev,
                  bs_is_returnable: 1,
                  bs_return_window_days:
                    prev.bs_return_window_days != null && String(prev.bs_return_window_days).trim() !== "" && String(prev.bs_return_window_days).trim() !== "0"
                      ? String(prev.bs_return_window_days).trim()
                      : DEFAULT_RETURN_WINDOW_DAYS,
                }));
                setIsChanged(true);
              }}
            >
              <Text style={[styles.bountyTypeBtnText, styles.bountyTypeBtnTextCompact, (serviceForm.bs_is_returnable === 1 || serviceForm.bs_is_returnable === "1") && styles.bountyTypeBtnTextActive]}>
                Yes
              </Text>
            </TouchableOpacity>
            {serviceForm.bs_is_returnable === 1 || serviceForm.bs_is_returnable === "1" ? (
              <>
                <TextInput
                  style={[styles.serviceFormRowInput, darkMode && styles.darkServiceFormRowInput, { flex: 0, width: 56 }]}
                  value={String(serviceForm.bs_return_window_days ?? DEFAULT_RETURN_WINDOW_DAYS)}
                  onChangeText={(t) => {
                    handleServiceChange("bs_return_window_days", t.replace(/\D/g, ""));
                    setIsChanged(true);
                  }}
                  placeholder={DEFAULT_RETURN_WINDOW_DAYS}
                  keyboardType='number-pad'
                  placeholderTextColor={darkMode ? "#888" : "#999"}
                />
                <Text style={[styles.serviceCheckboxLabelCompact, darkMode && styles.darkServiceCheckboxLabelCompact]}>days</Text>
              </>
            ) : null}
          </View>
        </View>

        <View ref={serviceQuantitySectionRef} collapsable={false} style={styles.serviceFormCompactRow}>
          <Text style={[styles.serviceFormRowTitle, darkMode && styles.darkServiceFormRowTitle, serviceFormQuantityError && { color: "#FF3B30" }]}>Quantity</Text>
          <View style={styles.serviceFormRowBody}>
            <TouchableOpacity
              style={[styles.bountyTypeBtn, styles.bountyTypeBtnCompact, (serviceForm.bs_qty_unlimited === 1 || serviceForm.bs_qty_unlimited === "1") && styles.bountyTypeBtnActive]}
              onPress={() => {
                handleServiceChange("bs_qty_unlimited", 1);
                setServiceFormQuantityError(false);
                setIsChanged(true);
              }}
            >
              <Text style={[styles.bountyTypeBtnText, styles.bountyTypeBtnTextCompact, (serviceForm.bs_qty_unlimited === 1 || serviceForm.bs_qty_unlimited === "1") && styles.bountyTypeBtnTextActive]}>
                No limit
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bountyTypeBtn, styles.bountyTypeBtnCompact, !(serviceForm.bs_qty_unlimited === 1 || serviceForm.bs_qty_unlimited === "1") && styles.bountyTypeBtnActive]}
              onPress={() => {
                handleServiceChange("bs_qty_unlimited", 0);
                setIsChanged(true);
              }}
            >
              <Text
                style={[styles.bountyTypeBtnText, styles.bountyTypeBtnTextCompact, !(serviceForm.bs_qty_unlimited === 1 || serviceForm.bs_qty_unlimited === "1") && styles.bountyTypeBtnTextActive]}
              >
                Limited
              </Text>
            </TouchableOpacity>
            {!(serviceForm.bs_qty_unlimited === 1 || serviceForm.bs_qty_unlimited === "1") ? (
              <TextInput
                ref={serviceQuantityInputRef}
                style={[styles.serviceFormRowInput, darkMode && styles.darkServiceFormRowInput, serviceFormQuantityError && { borderWidth: 2, borderColor: "#FF3B30" }]}
                value={serviceForm.bs_available_quantity}
                onChangeText={(t) => {
                  handleServiceChange("bs_available_quantity", t.replace(/\D/g, ""));
                  setServiceFormQuantityError(false);
                  setIsChanged(true);
                }}
                placeholder='Count'
                keyboardType='number-pad'
                placeholderTextColor={darkMode ? "#888" : "#999"}
              />
            ) : null}
          </View>
        </View>

        <View style={styles.serviceFormCompactRow}>
          <Text style={[styles.serviceFormRowTitle, darkMode && styles.darkServiceFormRowTitle]}>Shipping</Text>
          <View style={[styles.serviceFormRowBody, { flexWrap: "wrap", gap: 10 }]}>
            <TouchableOpacity style={styles.serviceCheckboxRowInline} onPress={setShippingNotApplicable} activeOpacity={0.7}>
              <Ionicons name={isShippingNotApplicable(serviceForm) ? "checkbox" : "square-outline"} size={20} color={isShippingNotApplicable(serviceForm) ? "#9C45F7" : darkMode ? "#aaa" : "#666"} />
              <Text style={[styles.serviceCheckboxLabelCompact, darkMode && styles.darkServiceCheckboxLabelCompact]}>Not applicable</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.serviceCheckboxRowInline} onPress={toggleFreeShipping} activeOpacity={0.7}>
              <Ionicons name={serviceForm.bs_free_shipping === 1 ? "checkbox" : "square-outline"} size={20} color={serviceForm.bs_free_shipping === 1 ? "#9C45F7" : darkMode ? "#aaa" : "#666"} />
              <Text style={[styles.serviceCheckboxLabelCompact, darkMode && styles.darkServiceCheckboxLabelCompact]}>Free</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.serviceCheckboxRowInline} onPress={toggleBuyerPaysShipping} activeOpacity={0.7}>
              <Ionicons
                name={serviceForm.bs_buyer_pays_shipping === 1 ? "checkbox" : "square-outline"}
                size={20}
                color={serviceForm.bs_buyer_pays_shipping === 1 ? "#9C45F7" : darkMode ? "#aaa" : "#666"}
              />
              <Text style={[styles.serviceCheckboxLabelCompact, darkMode && styles.darkServiceCheckboxLabelCompact]}>Buyer pays</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Choice Groups */}
        <View style={{ marginBottom: 8 }}>
          <Text style={[styles.serviceFormRowTitle, darkMode && styles.darkServiceFormRowTitle, { width: "100%", marginBottom: 8 }]}>Customer Choices</Text>
          <ChoiceGroupsEditor
            groups={serviceForm.bs_choice_groups || []}
            onChange={(groups) => {
              handleServiceChange("bs_choice_groups", groups);
              setIsChanged(true);
            }}
            darkMode={darkMode}
          />
        </View>

        {/* Special Instructions */}
        <View style={[styles.serviceFormCompactRow, { alignItems: "flex-start", flexWrap: "wrap" }]}>
          <Text style={[styles.serviceFormRowTitle, darkMode && styles.darkServiceFormRowTitle]}>Special Instructions</Text>
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <TouchableOpacity
                style={[
                  styles.bountyTypeBtn,
                  styles.bountyTypeBtnCompact,
                  (serviceForm.bs_special_instructions_enabled === 1 || serviceForm.bs_special_instructions_enabled === "1") && styles.bountyTypeBtnActive,
                ]}
                onPress={() => {
                  handleServiceChange("bs_special_instructions_enabled", 1);
                  setIsChanged(true);
                }}
              >
                <Text
                  style={[
                    styles.bountyTypeBtnText,
                    styles.bountyTypeBtnTextCompact,
                    (serviceForm.bs_special_instructions_enabled === 1 || serviceForm.bs_special_instructions_enabled === "1") && styles.bountyTypeBtnTextActive,
                  ]}
                >
                  Enabled
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.bountyTypeBtn,
                  styles.bountyTypeBtnCompact,
                  !(serviceForm.bs_special_instructions_enabled === 1 || serviceForm.bs_special_instructions_enabled === "1") && styles.bountyTypeBtnActive,
                ]}
                onPress={() => {
                  handleServiceChange("bs_special_instructions_enabled", 0);
                  setIsChanged(true);
                }}
              >
                <Text
                  style={[
                    styles.bountyTypeBtnText,
                    styles.bountyTypeBtnTextCompact,
                    !(serviceForm.bs_special_instructions_enabled === 1 || serviceForm.bs_special_instructions_enabled === "1") && styles.bountyTypeBtnTextActive,
                  ]}
                >
                  Disabled
                </Text>
              </TouchableOpacity>
            </View>
            {(serviceForm.bs_special_instructions_enabled === 1 || serviceForm.bs_special_instructions_enabled === "1") && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 12, color: darkMode ? "#ccc" : "#555" }}>Max characters:</Text>
                <TextInput
                  style={[styles.serviceFormRowInput, darkMode && styles.darkServiceFormRowInput, { flex: 0, width: 72 }]}
                  value={String(serviceForm.bs_special_instructions_max_chars || 80)}
                  onChangeText={(t) => {
                    handleServiceChange("bs_special_instructions_max_chars", t.replace(/\D/g, ""));
                    setIsChanged(true);
                  }}
                  keyboardType='number-pad'
                  placeholder='80'
                  placeholderTextColor={darkMode ? "#888" : "#999"}
                />
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: darkMode ? "#555" : "#ddd",
                    borderRadius: 8,
                    padding: 10,
                    flex: 1,
                    minHeight: 60,
                    justifyContent: "flex-end",
                    backgroundColor: darkMode ? "#2d2d2d" : "#fff",
                  }}
                >
                  <Text style={{ color: darkMode ? "#888" : "#aaa", fontSize: 12, textAlign: "right" }}>{serviceForm.bs_special_instructions_max_chars || 80}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.formButtons}>
          <TouchableOpacity style={[styles.formButton, styles.cancelButton, darkMode && styles.darkCancelButton]} onPress={handleCancelEdit}>
            <Text style={[styles.cancelButtonText, darkMode && styles.darkCancelButtonText]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.formButton, styles.addButton, addServiceBlocked && styles.addButtonDisabled, darkMode && addServiceBlocked && styles.darkAddButtonDisabled]}
            onPress={handleAddService}
            disabled={addServiceBlocked}
            activeOpacity={addServiceBlocked ? 1 : 0.7}
          >
            <Text style={[styles.addButtonText, addServiceBlocked && styles.addButtonTextDisabled, darkMode && addServiceBlocked && styles.darkAddButtonTextDisabled]}>
              {editingServiceIndex !== null ? "Update" : "Add"} Product/Service
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: darkMode ? "#1a1a1a" : "#ffffff" }}>
      <AppHeader
        title='Edit Business Profile'
        {...getHeaderColors("editBusinessProfile")}
        onBackPress={() => {
          if (isChanged) {
            pendingRemoveActionRef.current = null;
            setPendingNavigation(null);
            setShowUnsavedChangesModal(true);
          } else {
            navigation.goBack();
          }
        }}
      />
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1, padding: 20, backgroundColor: darkMode ? "#1a1a1a" : "#ffffff" }}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={true}
      >
        {/* Business Image Upload Section (identical to EditProfileScreen profile image section) */}
        {renderBusinessImageSection()}

        {renderField("Business Name", formData.name, "name")}
        {renderUpdateLocationFromGoogle()}
        {renderField("Location", formData.location, "location", "", "locationIsPublic")}
        {renderField("Address", formData.addressLine2, "addressLine2", "", "locationIsPublic")}
        {renderField("City", formData.city, "city", "", "locationIsPublic")}
        {renderField("State", formData.state, "state", "", "locationIsPublic")}
        {renderField("Country", formData.country, "country", "", "locationIsPublic")}
        {renderField("Zip Code", formData.zip, "zip", "", "locationIsPublic")}
        {renderCoordinatesField()}
        {renderField("Phone Number", formData.phone, "phone", "", "phoneIsPublic")}
        {renderField("Email", formData.email, "email", "", "emailIsPublic")}
        {renderCategoryField()}
        {renderField("Tagline", formData.tagline, "tagline", "", "taglineIsPublic")}

        {/* Business MiniCard Live Preview - how business appears in searches */}
        <View style={[styles.previewSection, darkMode && styles.darkPreviewSection]}>
          <Text style={[styles.label, darkMode && styles.darkLabel]}>Mini Card (how you'll appear in Searches):</Text>
          <View style={[styles.previewCard, darkMode && styles.darkPreviewCard]}>
            <MiniCard key={`minicard-${imageUpdateKey}`} business={previewBusiness} />
          </View>
        </View>

        {renderField("Short Bio", formData.shortBio, "shortBio", "", "shortBioIsPublic")}
        {renderBusinessRoleField()}
        {renderEINField()}
        {renderBusinessCcFeeField()}
        {renderField("Website", formData.website, "website")}

        {/* MISSING: renderField calls for First Name, Last Name (EditProfileScreen has these) */}
        {/* Note: Business profile doesn't have firstName/lastName fields */}

        {/* BUSINESS-SPECIFIC: Business Editors & Owners Section (not in EditProfileScreen) */}
        <View style={[styles.fieldContainer, darkMode && styles.darkFieldContainer]}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, darkMode && styles.darkLabel]}>Business Editors & Owners</Text>
            <TouchableOpacity onPress={addBusinessEditor}>
              <Text style={[styles.addText, darkMode && styles.darkAddText]}>+</Text>
            </TouchableOpacity>
          </View>
          {existingBusinessUsers.map((businessUser, index) => {
            // Map from business_users endpoint: profile_photo, profile_photo_is_public, user_email, user_email_is_public, phone, phone_is_public, city, state, location_is_public
            const profileImageUrl =
              businessUser.profile_photo && String(businessUser.profile_photo).trim() !== ""
                ? String(businessUser.profile_photo).trim()
                : businessUser.profile_personal_image && String(businessUser.profile_personal_image).trim() !== ""
                  ? String(businessUser.profile_personal_image).trim()
                  : "";
            const imageIsPublic =
              businessUser.profile_photo_is_public === 1 ||
              businessUser.profile_photo_is_public === "1" ||
              businessUser.profile_personal_image_is_public === 1 ||
              businessUser.profile_personal_image_is_public === "1" ||
              businessUser.image_is_public === 1 ||
              businessUser.image_is_public === "1";
            const userForMiniCard = {
              firstName: businessUser.first_name || "",
              lastName: businessUser.last_name || "",
              email: businessUser.user_email || "",
              profileImage: profileImageUrl,
              imageIsPublic: !!imageIsPublic,
              emailIsPublic:
                businessUser.user_email_is_public === 1 ||
                businessUser.user_email_is_public === "1" ||
                businessUser.profile_personal_email_is_public === 1 ||
                businessUser.profile_personal_email_is_public === "1" ||
                businessUser.email_is_public === 1,
              phoneIsPublic:
                businessUser.phone_is_public === 1 ||
                businessUser.phone_is_public === "1" ||
                businessUser.profile_personal_phone_number_is_public === 1 ||
                businessUser.profile_personal_phone_number_is_public === "1",
              phoneNumber: businessUser.phone || businessUser.profile_personal_phone_number || businessUser.phone_number || "",
              tagLine: businessUser.profile_personal_tag_line || businessUser.tag_line || businessUser.tagline || "",
              tagLineIsPublic: businessUser.profile_personal_tag_line_is_public === 1 || businessUser.profile_personal_tag_line_is_public === "1" || false,
              city: businessUser.city || businessUser.profile_personal_city || "",
              state: businessUser.state || businessUser.profile_personal_state || "",
              locationIsPublic:
                businessUser.location_is_public === 1 ||
                businessUser.location_is_public === "1" ||
                businessUser.profile_personal_location_is_public === 1 ||
                businessUser.profile_personal_location_is_public === "1" ||
                false,
            };

            const isIndividualPublic =
              businessUser.bu_individual_business_is_public === 1 || businessUser.bu_individual_business_is_public === "1" || businessUser.bu_individual_business_is_public === true;

            return (
              <View key={businessUser.business_user_id || index} style={[styles.existingBusinessUserCard, darkMode && styles.darkExistingBusinessUserCard]}>
                <View style={styles.existingBusinessUserHeader}>
                  <View style={styles.existingBusinessUserInfo}>
                    <MiniCard user={userForMiniCard} />
                    <Text style={[styles.existingBusinessUserRole, darkMode && styles.darkExistingBusinessUserRole]}>Role: {businessUser.business_role || "N/A"}</Text>
                  </View>
                  <View style={styles.toggleContainer}>
                    <TouchableOpacity onPress={() => toggleBusinessUserIndividualPublic(businessUser)} style={[styles.togglePill, isIndividualPublic && styles.togglePillActiveGreen]}>
                      <Text style={[styles.togglePillText, isIndividualPublic && styles.togglePillTextActive]}>{isIndividualPublic ? "Visible" : "Show"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => toggleBusinessUserIndividualPublic(businessUser)} style={[styles.togglePill, !isIndividualPublic && styles.togglePillActiveRed]}>
                      <Text style={[styles.togglePillText, !isIndividualPublic && styles.togglePillTextActive]}>{!isIndividualPublic ? "Hidden" : "Hide"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
          {additionalBusinessUsers.map((user, index) => (
            <View key={index} style={[styles.businessEditorCard, darkMode && styles.darkBusinessEditorCard]}>
              <View style={styles.businessEditorHeader}>
                <Text style={[styles.businessEditorLabel, darkMode && styles.darkBusinessEditorLabel]}>Editor #{index + 1}</Text>
                <TouchableOpacity onPress={() => removeBusinessEditor(index)}>
                  <Text style={[styles.removeButtonText, darkMode && styles.darkRemoveButtonText]}>Remove</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.sublabel, darkMode && styles.darkSublabel]}>Email Address</Text>
              <TextInput
                style={[styles.input, darkMode && styles.darkInput]}
                value={user.email}
                placeholder='Enter email address'
                placeholderTextColor={darkMode ? "#cccccc" : "#666"}
                keyboardType='email-address'
                autoCapitalize='none'
                onChangeText={(text) => updateBusinessEditor(index, "email", text)}
              />
              <Text style={[styles.sublabel, darkMode && styles.darkSublabel]}>Business Role</Text>
              <Dropdown
                style={[styles.input, darkMode && styles.darkInput]}
                data={businessRoles}
                labelField='label'
                valueField='value'
                placeholder='Select role'
                placeholderTextColor={darkMode ? "#ffffff" : "#666"}
                value={user.role}
                onChange={(item) => updateBusinessEditor(index, "role", item.value)}
                containerStyle={[{ borderRadius: 10, marginTop: 5 }, darkMode && { backgroundColor: "#1a1a1a", borderColor: "#404040" }]}
                itemTextStyle={{ color: darkMode ? "#ffffff" : "#000000" }}
                selectedTextStyle={{ color: darkMode ? "#ffffff" : "#000000" }}
                activeColor={darkMode ? "#404040" : "#f0f0f0"}
                itemContainerStyle={darkMode ? { backgroundColor: "#1a1a1a" } : {}}
                flatListProps={{
                  nestedScrollEnabled: true,
                }}
              />
            </View>
          ))}
        </View>

        {/* BUSINESS-SPECIFIC: Custom Tags Section (not in EditProfileScreen) */}
        {/* {isOwner && renderCustomTagsSection()} */}
        {renderCustomTagsSection()}

        {/* MISSING: renderShortBioField() call (EditProfileScreen has this) */}
        {/* Note: Business profile uses regular renderField for shortBio */}

        {/* MISSING: ExperienceSection, EducationSection, ExpertiseSection, SeekingSection, BusinessSection components (EditProfileScreen has these) */}
        {/* Note: Business profile doesn't have these sections, uses Products & Services instead */}

        {/* BUSINESS-SPECIFIC: Social Links Section (EditProfileScreen doesn't have this section in edit) */}
        <Text style={[styles.label, darkMode && styles.darkLabel]}>Social Links</Text>
        {renderSocialField("Facebook", "facebook")}
        {renderSocialField("Instagram", "instagram")}
        {renderSocialField("LinkedIn", "linkedin")}
        {renderSocialField("YouTube", "youtube")}

        {/* BUSINESS-SPECIFIC: Products & Services Section (EditProfileScreen has ExperienceSection, EducationSection, etc.) */}
        <View style={styles.fieldContainer}>
          <View style={styles.productsSectionHeaderRow}>
            <Text style={[styles.label, darkMode && styles.darkLabel, styles.labelInline]}>Products & Services</Text>
            {!showServiceForm && (
              <TouchableOpacity
                onPress={() => {
                  setServiceForm({ ...defaultService });
                  setEditingServiceIndex(null);
                  setServiceFormTaxRateError(false);
                  setServiceFormQuantityError(false);
                  setServiceFormCostUnitError(false);
                  setProductTagInput("");
                  setShowServiceForm(true);
                  resetServiceProductImageState();
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.addText, darkMode && styles.darkAddText, styles.labelInline]}>+</Text>
              </TouchableOpacity>
            )}
          </View>
          {services.length === 0 && <Text style={[styles.noServicesText, darkMode && styles.darkNoServicesText]}>No products or services added yet.</Text>}
          {services.map((service, idx) => (
            <View key={service.bs_uid ? String(service.bs_uid) : `svc-${idx}`} style={styles.productCardEditWrapper}>
              {/* Row is only the card so the delete control stays bottom-right of the card, not the whole block when the edit form is open below. */}
              <View style={styles.productCardRow}>
                <ProductCard service={service} businessUid={businessUID} onEdit={() => handleEditService(service, idx)} showEditButton={true} darkMode={darkMode} />
                <TouchableOpacity
                  style={styles.productDeleteButton}
                  onPress={() => handleDeleteService(idx)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel='Delete product or service'
                >
                  <Image source={require("../assets/delete.png")} style={styles.productDeleteIcon} />
                </TouchableOpacity>
              </View>
              {showServiceForm && editingServiceIndex === idx ? renderProductsServicesForm() : null}
            </View>
          ))}
          {showServiceForm && editingServiceIndex === null ? renderProductsServicesForm() : null}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, (!isValid || !isChanged) && (darkMode ? styles.darkDisabledButton : styles.saveButtonDisabled), darkMode && styles.darkSaveButton]}
          onPress={handleSave}
          disabled={!isValid || !isChanged || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size='small' color={darkMode ? "#ffffff" : "#fff"} />
          ) : (
            <Text style={[styles.saveButtonText, (!isValid || !isChanged) && styles.saveButtonTextDisabled, darkMode && styles.darkSaveText]}>Submit</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10 }}>
        <BottomNavBar
          navigation={navigation}
          onBeforeNavigate={(destination) => {
            if (isChanged) {
              pendingRemoveActionRef.current = null;
              setPendingNavigation(destination);
              setShowUnsavedChangesModal(true);
              return false;
            }
            return true;
          }}
        />
      </View>

      <Modal
        visible={showUnsavedChangesModal}
        transparent
        animationType='fade'
        onRequestClose={() => {
          setShowUnsavedChangesModal(false);
          setPendingNavigation(null);
          pendingRemoveActionRef.current = null;
        }}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}>
          <View style={[styles.modalContainer, darkMode && styles.darkModalContainer]}>
            <Text style={[styles.modalText, darkMode && styles.darkModalText]}>You have unsaved changes. Are you sure you want to leave this page?</Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#999" }]}
                onPress={() => {
                  setShowUnsavedChangesModal(false);
                  setPendingNavigation(null);
                  pendingRemoveActionRef.current = null;
                }}
              >
                <Text style={[styles.modalButtonText, darkMode && styles.darkModalButtonText]}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, darkMode && styles.darkModalButton]}
                onPress={() => {
                  const action = pendingRemoveActionRef.current;
                  const dest = pendingNavigation;
                  setShowUnsavedChangesModal(false);
                  setPendingNavigation(null);
                  pendingRemoveActionRef.current = null;
                  setIsChanged(false);
                  setTimeout(() => {
                    if (action) {
                      navigation.dispatch(action);
                    } else if (dest) {
                      navigation.navigate(dest);
                    } else {
                      navigation.goBack();
                    }
                  }, 0);
                }}
              >
                <Text style={[styles.modalButtonText, darkMode && styles.darkModalButtonText]}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* MISSING: Business Approval Modal (EditProfileScreen has this) */}
      {/* Note: Not needed for business profile editing */}
    </View>
  );
};

const styles = StyleSheet.create({
  pageContainer: { flex: 1, backgroundColor: "#fff", minHeight: "100%" },
  container: { flex: 1, padding: 20, minHeight: "100%" },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  fieldContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#000",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 25,
    backgroundColor: "#f0f0f0",
    color: "#000",
  },
  textarea: {
    minHeight: 40,
    maxHeight: 200,
    borderRadius: 12,
  },
  // MISSING: textarea style (EditProfileScreen has this)
  // MISSING: disabledInput style (EditProfileScreen has this)
  saveButton: {
    backgroundColor: "#800000",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginVertical: 20,
  },
  saveButtonDisabled: {
    backgroundColor: "#999",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  saveButtonTextDisabled: {
    color: "#ccc",
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  productsSectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  labelInline: {
    marginBottom: 0,
  },
  productCardEditWrapper: {
    marginBottom: 10,
  },
  productCardRow: {
    position: "relative",
  },
  productDeleteButton: {
    position: "absolute",
    right: 6,
    bottom: 6,
    zIndex: 10,
    ...(Platform.OS === "android" && { elevation: 8 }),
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  productDeleteIcon: {
    width: 20,
    height: 20,
  },
  serviceFormMiniCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  darkServiceFormMiniCard: {
    borderColor: "#404040",
    backgroundColor: "#2d2d2d",
  },
  serviceFormMiniCardImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  serviceFormMiniCardImageDark: {
    backgroundColor: "#404040",
  },
  serviceFormMiniCardLeft: {
    width: 100,
    alignItems: "center",
  },
  serviceImageShowHideRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 6,
    marginTop: 8,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  serviceImageTogglePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "transparent",
  },
  serviceImageTogglePillActive: {
    backgroundColor: "#9C45F7",
    borderColor: "#9C45F7",
  },
  serviceImageTogglePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555",
  },
  serviceImageTogglePillTextActive: {
    color: "#fff",
  },
  serviceImageTogglePillDark: {
    borderColor: "#555",
  },
  serviceImageTogglePillTextMutedDark: {
    color: "#999",
  },
  serviceUploadButton: {
    marginTop: 8,
    backgroundColor: "#00C721",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  darkServiceUploadButton: {
    backgroundColor: "#00a01b",
  },
  serviceUploadButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  serviceRemoveImageBtn: {
    marginTop: 6,
    paddingVertical: 4,
  },
  serviceRemoveImageText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "underline",
    textAlign: "center",
  },
  darkServiceRemoveImageText: {
    color: "#f87171",
  },
  serviceFormMiniCardFields: {
    flex: 1,
    minWidth: 0,
  },
  serviceFormMiniFieldInput: {
    marginBottom: 6,
    borderRadius: 10,
  },
  serviceFormCompactInput: {
    fontSize: 15,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 40,
  },
  serviceFormDescInput: {
    marginBottom: 0,
    minHeight: 58,
    borderRadius: 10,
    paddingTop: 8,
    ...(Platform.OS === "web" && { outlineStyle: "none" }),
  },
  serviceFormCompactDesc: {
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    lineHeight: 20,
  },
  uploadLinkInline: {
    marginBottom: 0,
  },
  serviceAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  /** One logical field per row: title (fixed) + controls + optional flex input */
  serviceFormCompactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
    minHeight: 40,
  },
  serviceFormRowTitle: {
    width: 108,
    flexShrink: 0,
    fontSize: 13,
    fontWeight: "700",
    color: "#111",
  },
  darkServiceFormRowTitle: {
    color: "#f3f3f3",
  },
  serviceFormRowBody: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  serviceFormRowInput: {
    flex: 1,
    minWidth: 72,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 9 : 7,
    fontSize: 14,
    marginBottom: 0,
    backgroundColor: "#fff",
    color: "#000",
  },
  darkServiceFormRowInput: {
    borderColor: "#555",
    backgroundColor: "#2d2d2d",
    color: "#fff",
  },
  bountyTypeBtnCompact: {
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  bountyTypeBtnTextCompact: {
    fontSize: 12,
  },
  bountyTypeBtnLong: {
    maxWidth: 118,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  bountyTypeBtnTextLong: {
    fontSize: 10,
    lineHeight: 13,
    textAlign: "center",
  },
  serviceCurrencyDropdownCompact: {
    width: 84,
    height: 40,
    minHeight: 40,
    maxHeight: 40,
    paddingVertical: 0,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#f0f0f0",
  },
  serviceAmountInputCompact: {
    flex: 1,
    marginBottom: 0,
    minWidth: 64,
    height: 40,
    minHeight: 40,
    maxHeight: 40,
    paddingVertical: 8,
    fontSize: 14,
  },
  serviceCostUnitDropdown: {
    width: 88,
    height: 40,
    minHeight: 40,
    maxHeight: 40,
    paddingVertical: 0,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#f0f0f0",
  },
  darkServiceCostUnitDropdown: {
    backgroundColor: "#404040",
    borderColor: "#555",
  },
  serviceCostUnitDropdownRequired: {
    borderColor: "#f44336",
  },
  serviceCheckboxRowInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  serviceCheckboxLabelCompact: {
    fontSize: 12,
    color: "#333",
    flexShrink: 1,
  },
  darkServiceCheckboxLabelCompact: {
    color: "#ddd",
  },
  serviceCurrencyDropdown: {
    width: 96,
    height: 48,
    minHeight: 48,
    maxHeight: 48,
    paddingVertical: 0,
    paddingHorizontal: 8,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#f0f0f0",
  },
  darkServiceCurrencyDropdown: {
    backgroundColor: "#404040",
    borderColor: "#404040",
  },
  serviceCurrencyDropdownGreen: {
    borderWidth: 2,
    borderColor: "#00C721",
    backgroundColor: "rgba(0, 199, 33, 0.08)",
  },
  darkServiceCurrencyDropdownGreen: {
    borderColor: "#4ade80",
    backgroundColor: "rgba(74, 222, 128, 0.12)",
  },
  serviceAmountInput: {
    flex: 1,
    marginBottom: 0,
    minWidth: 0,
    height: 48,
    minHeight: 48,
    maxHeight: 48,
    paddingVertical: 10,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "500",
  },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  imageSection: { alignItems: "center", marginBottom: 20, width: "100%" },
  profileImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 10, backgroundColor: "#eee" },
  uploadLink: { color: "#007AFF", textDecorationLine: "underline", marginBottom: 10 },
  previewSection: { marginBottom: 20 },
  previewCard: { padding: 10, borderWidth: 1, borderColor: "#ccc", borderRadius: 5 },
  // BUSINESS-SPECIFIC: Additional styles for business-specific features
  tagEditorBlock: {
    marginTop: 4,
  },
  tagEditorLabel: {
    fontSize: 13,
    color: "#666",
    marginBottom: 6,
  },
  darkTagEditorLabel: {
    color: "#bbb",
  },
  pendingTagsHint: {
    fontSize: 13,
    color: "#b45309",
    marginBottom: 6,
  },
  darkPendingTagsHint: {
    color: "#fbbf24",
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 25,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 14,
    backgroundColor: "#f0f0f0",
    color: "#000",
    marginBottom: 0,
  },
  darkTagInput: {
    borderColor: "#555",
    backgroundColor: "#2d2d2d",
    color: "#fff",
  },
  tagAddButton: {
    backgroundColor: "#FFA500",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  tagAddButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  tagInputContainer: { flexDirection: "row", alignItems: "center" },
  addTagButton: {
    backgroundColor: "#00C721",
    padding: 10,
    borderRadius: 5,
  },
  addTagButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 5,
  },
  tagChip: {
    backgroundColor: "#f0f0f0",
    padding: 8,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  tagText: {
    fontSize: 14,
    marginRight: 5,
  },
  removeTagText: {
    color: "red",
    fontSize: 18,
    fontWeight: "bold",
  },
  imageHelperText: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  gallerySectionLabel: {
    alignSelf: "flex-start",
    width: "100%",
    marginTop: 4,
  },
  googleImagesHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 4,
    marginBottom: 4,
  },
  googleImagesHeaderLabel: {
    marginTop: 0,
    width: undefined,
    flex: 1,
  },
  googleRefreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#007AFF",
    backgroundColor: "#f0f8ff",
    flexShrink: 1,
    maxWidth: "58%",
  },
  darkGoogleRefreshButton: {
    borderColor: "#60a5fa",
    backgroundColor: "#1e3a5f",
  },
  googleRefreshButtonDisabled: {
    opacity: 0.6,
  },
  googleRefreshText: {
    color: "#007AFF",
    fontSize: 12,
    fontWeight: "600",
  },
  darkGoogleRefreshText: {
    color: "#60a5fa",
  },
  googlePhotosPanelLabel: {
    marginTop: 12,
  },
  galleryImageWrapper: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 10,
    backgroundColor: "#fff",
    position: "relative",
    overflow: "hidden",
    flexShrink: 0,
  },
  galleryThumbTouchable: {
    width: 80,
    height: 80,
  },
  galleryThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
  },
  darkGalleryThumb: {
    backgroundColor: "#404040",
  },
  galleryImageSelected: {
    borderWidth: 3,
    borderColor: "#00C721",
    borderRadius: 10,
  },
  gallerySelectedBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "#00C721",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  gallerySelectedBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  galleryUploadBox: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
  },
  darkGalleryUploadBox: {
    borderColor: "#555",
    backgroundColor: "#404040",
  },
  galleryUploadText: {
    color: "#007AFF",
    fontSize: 13,
    fontWeight: "600",
  },
  darkGalleryUploadText: {
    color: "#60a5fa",
  },
  imageScroll: {
    marginTop: 10,
    height: 120,
    width: "100%",
  },
  imageRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  imageWrapper: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: "hidden",
    marginRight: 10,
    backgroundColor: "#fff",
    position: "relative",
  },
  businessImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },
  deleteIcon: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#ff3b30",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  deleteText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  addImageButton: {
    backgroundColor: "#00C721",
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
  },
  addImageButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  formTitle: {
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  formButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  formButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  addButton: {
    backgroundColor: "#00C721",
  },
  cancelButtonText: {
    color: "#666",
    textAlign: "center",
    fontWeight: "bold",
  },
  addButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  addButtonDisabled: {
    backgroundColor: "#b0b0b0",
    opacity: 0.88,
  },
  darkAddButtonDisabled: {
    backgroundColor: "#555",
    opacity: 0.8,
  },
  addButtonTextDisabled: {
    color: "#e8e8e8",
  },
  darkAddButtonTextDisabled: {
    color: "#999",
  },
  noServicesText: {
    color: "#888",
    textAlign: "center",
  },
  serviceFormContainer: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  serviceFormInput: {
    marginBottom: 12,
  },
  bountyTypeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#f5f5f5",
  },
  bountyTypeBtnActive: {
    backgroundColor: "#9C45F7",
    borderColor: "#9C45F7",
  },
  bountyTypeBtnText: {
    fontSize: 13,
    color: "#444",
    fontWeight: "500",
  },
  bountyTypeBtnTextActive: {
    color: "#fff",
    fontWeight: "bold",
  },
  serviceCheckboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  serviceCheckboxLabel: {
    fontSize: 15,
    color: "#333",
    flex: 1,
  },
  darkServiceCheckboxLabel: {
    color: "#e0e0e0",
  },
  businessEditorCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  businessEditorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  businessEditorLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  removeButtonText: {
    color: "#ff3b30",
    fontSize: 14,
    fontWeight: "600",
  },
  sublabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    marginTop: 10,
    marginBottom: 5,
  },
  addEditorButton: {
    backgroundColor: "#00C721",
    padding: 10,
    borderRadius: 8,
    marginLeft: 10,
  },
  addEditorButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  existingBusinessUserCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  existingBusinessUserHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  existingBusinessUserInfo: {
    flex: 1,
  },
  existingBusinessUserRole: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    fontStyle: "italic",
  },
  deleteButton: {
    padding: 8,
    marginLeft: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: 20,
  },
  hideDisplayButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  hideDisplayButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  addText: { fontSize: 24, fontWeight: "bold", color: "#000" },
  contentContainer: { padding: 20, paddingBottom: 120 },

  // Dark mode styles
  darkPageContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkContainer: {
    backgroundColor: "#1a1a1a",
    padding: 20,
  },
  darkHeader: {
    color: "#ffffff",
  },
  darkLabel: {
    color: "#ffffff",
  },
  darkInput: {
    backgroundColor: "#2d2d2d",
    color: "#ffffff",
    borderColor: "#404040",
    borderRadius: 25,
  },
  darkProfileImage: {
    // tintColor moved to Image prop
    tintColor: "#ffffff",
    backgroundColor: "#404040",
  },
  darkUploadLink: {
    color: "#4a9eff",
  },
  darkPreviewCard: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  // MISSING: darkDisabledInput style (EditProfileScreen has this)
  darkSaveButton: {
    backgroundColor: "#660000",
  },
  darkSaveText: {
    color: "#ffffff",
  },
  darkPreviewSection: {
    backgroundColor: "#1a1a1a",
  },
  darkDisabledButton: {
    backgroundColor: "#404040",
  },
  darkImageSection: {
    backgroundColor: "#1a1a1a",
  },
  darkFieldContainer: {
    backgroundColor: "#1a1a1a",
  },
  darkAddEditorButton: {
    backgroundColor: "#00C721",
  },
  darkAddEditorButtonText: {
    color: "#ffffff",
  },
  darkBusinessEditorCard: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  darkBusinessEditorLabel: {
    color: "#ffffff",
  },
  darkRemoveButtonText: {
    color: "#ff6b6b",
  },
  darkSublabel: {
    color: "#cccccc",
  },
  darkExistingBusinessUserCard: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  darkExistingBusinessUserRole: {
    color: "#cccccc",
  },
  darkDeleteButton: {
    // No special styling needed for dark mode
  },
  darkDeleteButtonText: {
    // No special styling needed for dark mode
  },
  darkHideDisplayButton: {},
  darkHideDisplayButtonText: {},
  darkAddText: {
    color: "#ffffff",
  },
  darkNoServicesText: {
    color: "#cccccc",
  },
  darkServiceFormContainer: {
    backgroundColor: "#404040",
  },
  darkFormTitle: {
    color: "#ffffff",
  },
  darkCancelButton: {
    backgroundColor: "#404040",
  },
  darkCancelButtonText: {
    color: "#cccccc",
  },
  darkTagChip: {
    backgroundColor: "#404040",
  },
  darkTagText: {
    color: "#ffffff",
  },
  darkImageWrapper: {
    backgroundColor: "#404040",
  },

  // Dropdown styles
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  dropdownItemSelected: {
    backgroundColor: "#f0f0f0",
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#000000",
  },
  dropdownItemTextSelected: {
    fontWeight: "bold",
  },

  // Dark mode dropdown styles
  darkDropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
    backgroundColor: "#1a1a1a",
  },
  darkDropdownItemSelected: {
    backgroundColor: "#404040",
  },
  darkDropdownItemText: {
    fontSize: 16,
    color: "#ffffff",
  },
  darkDropdownItemTextSelected: {
    fontWeight: "bold",
    color: "#ffffff",
  },
  toggleContainer: { flexDirection: "row", gap: 4 },
  togglePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: "transparent" },
  togglePillActiveGreen: { backgroundColor: "#4CAF50" },
  togglePillActiveRed: { backgroundColor: "#ef9a9a" },
  togglePillText: { fontSize: 13, color: "#4e4e4e", fontWeight: "500" },
  togglePillTextActive: { color: "#fff", fontWeight: "bold" },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 24,
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
  },
  modalText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: "center",
    color: "#000",
  },
  modalButton: {
    marginTop: 10,
    backgroundColor: "#FF9500",
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 30,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  darkModalContainer: {
    backgroundColor: "#2d2d2d",
  },
  darkModalText: {
    color: "#ffffff",
  },
  darkModalButton: {
    backgroundColor: "#4a9eff",
  },
  darkModalButtonText: {
    color: "#ffffff",
  },
  coordHint: {
    fontSize: 13,
    color: "#666",
    marginBottom: 8,
    lineHeight: 18,
  },
  darkCoordHint: {
    color: "#aaa",
  },
  inputError: {
    borderColor: "#c62828",
  },
  coordErrorText: {
    marginTop: 6,
    fontSize: 13,
    color: "#c62828",
  },
  placesSearchContainer: {
    zIndex: 10,
  },
  placesSuggestionsList: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#ccc",
    maxHeight: 220,
    overflow: "hidden",
  },
  darkPlacesSuggestionsList: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  placesSuggestionRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  darkPlacesSuggestionRow: {
    borderBottomColor: "#404040",
  },
  placesSuggestionMain: {
    fontSize: 15,
    color: "#333",
    fontWeight: "600",
  },
  placesSuggestionSub: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
});

export default EditBusinessProfileScreen;
