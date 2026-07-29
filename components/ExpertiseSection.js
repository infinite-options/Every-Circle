import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Platform, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Dropdown } from "react-native-element-dropdown";
import * as ImagePicker from "expo-image-picker";
import { formatCostValue, parsePrice } from "../utils/priceUtils";
import { isTruthyTaxableFlag, isValidTaxRate, validateTaxableRate, TAX_RATE_VALIDATION_MESSAGE, taxRateForTaxableSelection } from "../utils/taxValidation";
import { resolveProfileItemImageUri, isRemoteHttpUrl } from "../utils/resolveProfileItemImageUri";
import { getAddressSuggestions, getPlaceDetails } from "../utils/googlePlaces";
import ProfileItemImageColumn from "./ProfileItemImageColumn";
import {
  toDateTimeLocalValue,
  fromDateTimeLocalValue,
  formatDateForDisplay,
  formatTimeForDisplay,
  formatDateTimeForDisplay,
  parseDateTime,
  combineDateTime,
  isStartDateValid,
  isEndDateValid,
} from "../utils/profileDateTime";
import { parseExpertiseModeFlags, serializeExpertiseMode } from "../utils/expertiseMode";
import { rejectNativeImageAsset, rejectWebImageFile } from "../utils/imageUploadLimits";
import OfferingModerationBanner from "./OfferingModerationBanner";
import ProfileOfferingListCard from "./ProfileOfferingListCard";
import BountyInfoTooltip from "./BountyInfoTooltip";
import { isOfferingVisibilityBlocked } from "../utils/offeringModeration";
import { seekingProfileItemCardFormStyles as formStyles, SEEKING_FORM_ACCENT, SEEKING_FORM_ACCENT_DARK } from "../utils/profileItemCardFormStyles";
import {
  PROFILE_COST_UNIT_OPTIONS,
  PROFILE_TAX_OPTIONS,
  PROFILE_BOUNTY_TYPE_OPTIONS,
  PROFILE_CONDITION_OPTIONS,
  PROFILE_OFFERING_SHIPPING_OPTIONS,
  PROFILE_QUANTITY_OPTIONS,
  PROFILE_RETURNABLE_OPTIONS,
  getOfferingShippingDropdownValue,
  applyOfferingShippingDropdownValue,
  getOfferingReturnableDropdownValue,
} from "../utils/profileItemFormOptions";
import {
  isBuyerPaysOfferingShipping,
  isFixedOfferingShipping,
  isOfferingQtyUnlimited,
  offeringShippingAmountDisplay,
} from "../utils/profileOfferingShipping";
import { BS_SHIPPING_BUYER_FIXED, parseBsShippingAmount } from "../utils/businessServiceShipping";

const CONDITION_DETAIL_MAX_CHARS = 250;
const QUANTITY_MAX_DIGITS = 10;
const RETURN_WINDOW_MAX_DIGITS = 3;

/** Numeric cost amount from an offering cost string (ignores unit suffix). */
export const getOfferingCostAmount = (cost) => {
  if (!cost || String(cost).trim().toLowerCase() === "free") return 0;
  const cleaned = String(cost).replace(/\$/g, "").trim();
  if (cleaned.toLowerCase().endsWith("total")) {
    return parsePrice(cleaned.replace(/total$/i, "").trim());
  }
  const slashIdx = cleaned.indexOf("/");
  const amountStr = slashIdx >= 0 ? cleaned.slice(0, slashIdx).trim() : cleaned;
  return parsePrice(amountStr);
};

/** True when a per-item or single bounty exceeds the offering's item cost. */
export const offeringBountyExceedsCost = (item) => {
  if (!item || item.profile_expertise_bounty_type === "none") return false;
  const bountyAmount = parsePrice(item.bounty);
  const costAmount = getOfferingCostAmount(item.cost);
  if (bountyAmount <= 0 || costAmount <= 0) return false;
  return bountyAmount > costAmount;
};

let DateTimePicker = null;
if (Platform.OS !== "web") {
  try {
    DateTimePicker = require("@react-native-community/datetimepicker").default;
  } catch (e) {
    console.warn("DateTimePicker not available:", e.message);
  }
}

const ExpertiseSection = ({
  expertise,
  setExpertise,
  toggleVisibility,
  isPublic,
  handleDelete,
  onInputFocus,
  profileUid = "",
  darkMode = false,
  singleItemMode = false,
  disableDelete = false,
  hideItemVisibilityToggle = false,
}) => {
  // Stores each rendered card's ref by index so parent can scroll to the new one.
  const cardRefs = useRef({});
  const sectionHeaderRef = useRef(null);
  // Tracks which index was just added via "+".
  const pendingNewIndexRef = useRef(null);
  const editSnapshotRef = useRef(null);
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const costInputRefs = useRef({});
  const [activePicker, setActivePicker] = useState(null); // { index, field: 'start'|'end', mode: 'date'|'time' }
  const [addressSuggestionsByIndex, setAddressSuggestionsByIndex] = useState({});
  const [addressLoadingIndex, setAddressLoadingIndex] = useState(null);
  const addressDebounceRefs = useRef({});

  const isOfferingEmpty = (item) =>
    !String(item?.name || "").trim() && !String(item?.description || "").trim() && !String(item?.cost || "").trim();

  const closeOfferingForm = () => {
    editSnapshotRef.current = null;
    setShowForm(false);
    setEditingIndex(null);
  };

  const scrollToCard = (index) => {
    setTimeout(() => {
      const ref = cardRefs.current[index];
      if (ref) onInputFocus?.(ref);
    }, 100);
  };

  const scrollToSectionHeader = () => {
    setTimeout(() => {
      if (sectionHeaderRef.current) onInputFocus?.(sectionHeaderRef.current, { block: "start" });
    }, 150);
  };

  const startEditOffering = (index) => {
    editSnapshotRef.current = JSON.parse(JSON.stringify(expertise[index] || {}));
    setEditingIndex(index);
    setShowForm(true);
    scrollToCard(index);
  };

  const doneEditOffering = () => {
    closeOfferingForm();
    scrollToSectionHeader();
  };

  const cancelEditOffering = () => {
    if (editingIndex !== null) {
      if (editSnapshotRef.current) {
        const updated = [...expertise];
        updated[editingIndex] = editSnapshotRef.current;
        setExpertise(updated);
      } else if (isOfferingEmpty(expertise[editingIndex])) {
        handleDelete(editingIndex);
      }
    }
    closeOfferingForm();
    scrollToSectionHeader();
  };

  const addExpertise = () => {
    // Mark the next card index before state update, then notify parent after render.
    const newIndex = expertise.length;
    pendingNewIndexRef.current = newIndex;
    editSnapshotRef.current = null;
    const newEntry = {
      name: "",
      description: "",
      quantity: "",
      cost: "",
      bounty: "",
      profile_expertise_image: "",
      profile_expertise_image_is_public: 1,
      profile_expertise_start: "",
      profile_expertise_end: "",
      profile_expertise_location: "",
      profile_expertise_latitude: null,
      profile_expertise_longitude: null,
      profile_expertise_city: "",
      profile_expertise_state: "",
      profile_expertise_mode: "",
      profile_expertise_is_taxable: 0,
      profile_expertise_tax_rate: "",
      profile_expertise_condition_type: "na",
      profile_expertise_condition_detail: "",
      profile_expertise_bounty_type: "none",
      profile_expertise_is_returnable: 0,
      profile_expertise_return_window_days: "",
      profile_expertise_shipping: null,
      profile_expertise_shipping_amount: "",
      profile_expertise_shipping_refundable: 0,
      profile_expertise_free_shipping: 0,
      profile_expertise_buyer_pays_shipping: 0,
      profile_expertise_shipping_cost_type: "",
      profile_expertise_qty_unlimited: 1,
      profile_expertise_refund_policy: "",
      isPublic: true,
      _expNewImageUri: "",
      _expWebImageFile: null,
      _expOriginalImage: "",
      _expDeleteImageUrl: "",
      _expImageError: false,
    };
    setExpertise([...expertise, newEntry]);
    setEditingIndex(newIndex);
    setShowForm(true);
  };

  useEffect(() => {
    // After add + render, pass the new card ref up so parent can auto-scroll.
    const index = pendingNewIndexRef.current;
    if (index === null || index === undefined) return;

    const attemptScroll = (retriesLeft) => {
      const newCardRef = cardRefs.current[index];
      if (newCardRef) {
        onInputFocus?.(newCardRef);
        pendingNewIndexRef.current = null;
        return;
      }
      if (retriesLeft > 0) {
        setTimeout(() => attemptScroll(retriesLeft - 1), 50);
      } else {
        pendingNewIndexRef.current = null;
      }
    };

    setTimeout(() => attemptScroll(8), 50);
  }, [expertise.length, onInputFocus]);

  const deleteExpertise = (index) => {
    if (showForm) {
      if (editingIndex === index) {
        closeOfferingForm();
      } else if (editingIndex !== null && editingIndex > index) {
        setEditingIndex(editingIndex - 1);
      }
    }
    handleDelete(index);
  };

  const handleInputChange = (index, field, value) => {
    const updated = [...expertise];
    updated[index][field] = value;
    setExpertise(updated);
  };

  const handleOfferingTaxableSelect = (index) => {
    const updated = [...expertise];
    const item = updated[index];
    updated[index] = {
      ...item,
      profile_expertise_is_taxable: 1,
      profile_expertise_tax_rate: taxRateForTaxableSelection(item.profile_expertise_tax_rate),
    };
    setExpertise(updated);
  };

  const handleOfferingTaxRateBlur = (index) => {
    const item = expertise[index];
    if (!isTruthyTaxableFlag(item?.profile_expertise_is_taxable)) return;
    const raw = String(item.profile_expertise_tax_rate ?? "").trim();
    if (!raw) return;
    if (!isValidTaxRate(raw)) {
      Alert.alert("Validation", TAX_RATE_VALIDATION_MESSAGE);
      handleInputChange(index, "profile_expertise_tax_rate", "");
    }
  };

  const handleOfferingTaxDropdownChange = (index, selected) => {
    if (selected.value === "taxable") {
      handleOfferingTaxableSelect(index);
    } else {
      handleInputChange(index, "profile_expertise_is_taxable", 0);
      handleInputChange(index, "profile_expertise_tax_rate", "");
    }
  };

  const handleOfferingBountyTypeChange = (index, selected) => {
    if (selected.value === "none") {
      handleInputChange(index, "profile_expertise_bounty_type", "none");
      handleInputChange(index, "bounty", "");
    } else {
      handleInputChange(index, "profile_expertise_bounty_type", selected.value);
    }
  };

  const handleOfferingConditionChange = (index, selected) => {
    const updated = [...expertise];
    updated[index] = {
      ...updated[index],
      profile_expertise_condition_type: selected.value,
      profile_expertise_condition_detail: selected.value === "used" ? updated[index].profile_expertise_condition_detail : "",
    };
    setExpertise(updated);
  };

  const handleOfferingShippingChange = (index, selected) => {
    const updated = [...expertise];
    updated[index] = { ...updated[index], ...applyOfferingShippingDropdownValue(selected.value) };
    setExpertise(updated);
  };

  const handleOfferingReturnableChange = (index, selected) => {
    const updated = [...expertise];
    if (selected.value === "no") {
      updated[index] = {
        ...updated[index],
        profile_expertise_is_returnable: 0,
        profile_expertise_return_window_days: "",
        profile_expertise_shipping_refundable: 0,
      };
    } else {
      updated[index] = {
        ...updated[index],
        profile_expertise_is_returnable: 1,
        profile_expertise_return_window_days: updated[index].profile_expertise_return_window_days || "30",
      };
    }
    setExpertise(updated);
  };

  const handleOfferingQtyLimitChange = (index, selected) => {
    const updated = [...expertise];
    if (selected.value === "unlimited") {
      updated[index] = {
        ...updated[index],
        profile_expertise_qty_unlimited: 1,
        quantity: "",
      };
    } else {
      updated[index] = {
        ...updated[index],
        profile_expertise_qty_unlimited: 0,
      };
    }
    setExpertise(updated);
  };

  const onOfferingAddressChange = (index, text) => {
    const updated = expertise.map((e, i) => {
      if (i !== index) return e;
      return {
        ...e,
        profile_expertise_location: text,
        ...(text.trim() ? {} : { profile_expertise_latitude: null, profile_expertise_longitude: null, profile_expertise_city: "", profile_expertise_state: "" }),
      };
    });
    if (!text.trim()) setAddressSuggestionsByIndex((prev) => ({ ...prev, [index]: [] }));
    setExpertise(updated);

    if (addressDebounceRefs.current[index]) clearTimeout(addressDebounceRefs.current[index]);
    if (!text.trim()) return;

    addressDebounceRefs.current[index] = setTimeout(async () => {
      try {
        const results = await getAddressSuggestions(text);
        setAddressSuggestionsByIndex((prev) => ({ ...prev, [index]: results }));
      } catch (err) {
        console.error("ExpertiseSection address suggestions error:", err);
      }
    }, 350);
  };

  const onOfferingAddressBlur = async (index) => {
    const item = expertise[index];
    if (!item?.profile_expertise_location?.trim()) return;
    if (item.profile_expertise_latitude != null && item.profile_expertise_longitude != null) return;
    try {
      const suggs = await getAddressSuggestions(item.profile_expertise_location.trim());
      if (!suggs.length) return;
      const pd = await getPlaceDetails(suggs[0].place_id);
      if (pd.lat == null || pd.lng == null) return;
      setExpertise(
        expertise.map((e, i) =>
          i !== index
            ? e
            : { ...e, profile_expertise_latitude: pd.lat, profile_expertise_longitude: pd.lng, profile_expertise_city: pd.city || e.profile_expertise_city, profile_expertise_state: pd.state || e.profile_expertise_state }
        )
      );
    } catch (e) {
      console.warn("[Expertise] blur geocode failed:", e);
    }
  };

  const handleOfferingAddressSelect = async (index, place) => {
    setAddressSuggestionsByIndex((prev) => ({ ...prev, [index]: [] }));
    setAddressLoadingIndex(index);
    try {
      const pd = await getPlaceDetails(place.place_id);
      if (pd.lat == null || pd.lng == null) {
        Alert.alert("Error", "Could not determine coordinates for this address.");
        return;
      }
      const updated = [...expertise];
      updated[index].profile_expertise_location = pd.formatted_address || place.description || "";
      updated[index].profile_expertise_latitude = pd.lat;
      updated[index].profile_expertise_longitude = pd.lng;
      updated[index].profile_expertise_city = pd.city || "";
      updated[index].profile_expertise_state = pd.state || "";
      setExpertise(updated);
    } catch (err) {
      console.error("ExpertiseSection address select error:", err);
      Alert.alert("Error", "Could not load address details. Please try again.");
    } finally {
      setAddressLoadingIndex(null);
    }
  };

  const renderOfferingAddressField = (index, item) => {
    const hasRecordedLocation = item.profile_expertise_latitude != null && item.profile_expertise_longitude != null;
    const addressPlaceholder = hasRecordedLocation
      ? "Location recorded. Enter a new address to change it."
      : "Start typing the offering address";
    const suggestions = addressSuggestionsByIndex[index] || [];

    return (
      <View style={formStyles.addressContainer}>
        <TextInput
          style={[formStyles.fieldInput, darkMode && formStyles.darkFieldInput]}
          placeholder={addressPlaceholder}
          placeholderTextColor={darkMode ? "#cccccc" : "#999999"}
          value={item.profile_expertise_location || ""}
          onChangeText={(text) => onOfferingAddressChange(index, text)}
          onBlur={() => onOfferingAddressBlur(index)}
          autoCapitalize='words'
          autoCorrect={false}
        />
        {addressLoadingIndex === index ? <ActivityIndicator size='small' color={SEEKING_FORM_ACCENT} style={{ marginTop: 8 }} /> : null}
        {suggestions.length > 0 ? (
          <View style={[formStyles.placesSuggestionsList, darkMode && formStyles.darkPlacesSuggestionsList]}>
            {suggestions.map((suggestion) => (
              <TouchableOpacity
                key={suggestion.place_id}
                style={[formStyles.placesSuggestionRow, darkMode && formStyles.darkPlacesSuggestionRow]}
                onPress={() => handleOfferingAddressSelect(index, suggestion)}
                activeOpacity={0.7}
              >
                <Text style={[formStyles.placesSuggestionMain, darkMode && formStyles.darkPlacesSuggestionMain]}>
                  {suggestion.structured_formatting?.main_text || suggestion.description}
                </Text>
                {suggestion.structured_formatting?.secondary_text ? (
                  <Text style={[formStyles.placesSuggestionSub, darkMode && formStyles.darkPlacesSuggestionSub]}>{suggestion.structured_formatting.secondary_text}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const toggleExpertiseMode = (index, key) => {
    const item = expertise[index];
    const prev = parseExpertiseModeFlags(item?.profile_expertise_mode);
    const flags = { virtual: !!prev.virtual, inPerson: !!prev.inPerson };
    flags[key] = !flags[key];
    handleInputChange(index, "profile_expertise_mode", serializeExpertiseMode(flags));
  };

  const getExpertiseDisplayUri = (item) => {
    const pending = item._expNewImageUri;
    if (pending != null && String(pending).trim() !== "") return String(pending).trim();
    return resolveProfileItemImageUri(item.profile_expertise_image, profileUid);
  };

  const pickExpertiseImage = async (index) => {
    if (Platform.OS === "web") return;
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
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        if (await rejectNativeImageAsset(asset)) return;
        const updated = [...expertise];
        const prev = updated[index];
        const orig = prev._expOriginalImage || resolveProfileItemImageUri(prev.profile_expertise_image, profileUid);
        updated[index]._expDeleteImageUrl = isRemoteHttpUrl(orig) ? orig : "";
        updated[index]._expNewImageUri = asset.uri;
        updated[index]._expWebImageFile = null;
        updated[index]._expImageError = false;
        setExpertise(updated);
      }
    } catch (error) {
      console.error("Expertise image pick error:", error);
      Alert.alert("Error", "Failed to pick image.");
    }
  };

  const handleExpertiseWebImagePick = (index, event) => {
    const file = event.target?.files?.[0];
    if (event?.target) event.target.value = "";
    if (!file) return;
    if (rejectWebImageFile(file)) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageUri = reader.result;
      const updated = [...expertise];
      const prev = updated[index];
      const orig = prev._expOriginalImage || resolveProfileItemImageUri(prev.profile_expertise_image, profileUid);
      updated[index]._expDeleteImageUrl = isRemoteHttpUrl(orig) ? orig : "";
      updated[index]._expNewImageUri = imageUri;
      updated[index]._expWebImageFile = file;
      updated[index]._expImageError = false;
      setExpertise(updated);
    };
    reader.readAsDataURL(file);
  };

  const removeExpertiseImage = (index) => {
    const updated = [...expertise];
    const prev = updated[index];
    const orig = prev._expOriginalImage || resolveProfileItemImageUri(prev.profile_expertise_image, profileUid);
    updated[index]._expDeleteImageUrl = isRemoteHttpUrl(orig) ? orig : "";
    updated[index]._expNewImageUri = "";
    updated[index]._expWebImageFile = null;
    updated[index].profile_expertise_image = "";
    updated[index]._expOriginalImage = "";
    updated[index]._expImageError = false;
    setExpertise(updated);
  };

  // Parse cost into amount and unit
  const parseCost = (cost) => {
    if (!cost || cost.trim() === "") {
      return { amount: "", unit: "" };
    }
    if (cost.toLowerCase() === "free") {
      return { amount: "Free", unit: "" };
    }
    // Remove $ if present
    const cleaned = cost.replace(/\$/g, "").trim();

    // Check if it ends with "total" (no leading /)
    if (cleaned.toLowerCase().endsWith("total")) {
      const amount = cleaned.replace(/total$/i, "").trim();
      return { amount: amount || "Free", unit: "total" };
    }

    // Try to split by / to get unit
    const parts = cleaned.split("/");
    if (parts.length >= 2) {
      const amount = parts[0].trim();
      const unit = parts.slice(1).join("/").trim();
      return { amount, unit };
    }
    return { amount: cleaned, unit: "" };
  };

  // Parse bounty (simpler than cost - no units)
  const parseBounty = (bounty) => {
    if (!bounty || bounty.trim() === "") {
      return { amount: "", unit: "" };
    }
    if (bounty.toLowerCase() === "free") {
      return { amount: "Free", unit: "" };
    }
    // Remove $ if present
    const cleaned = bounty.replace(/\$/g, "").trim();
    return { amount: cleaned, unit: "" };
  };

  // Handle cost amount change
  const handleCostAmountChange = (index, value) => {
    const updated = [...expertise];
    const currentCost = updated[index].cost || "";
    const parsed = parseCost(currentCost);
    const newAmount = value.replace(/\$/g, "");

    // If amount is "Free", set cost to "Free"
    if (newAmount.toLowerCase() === "free") {
      updated[index].cost = "Free";
    } else {
      if (parsed.unit === "total") {
        updated[index].cost = newAmount ? `${newAmount} total` : "total";
      } else if (parsed.unit) {
        updated[index].cost = `${newAmount}/${parsed.unit}`;
      } else {
        updated[index].cost = newAmount;
      }
    }
    setExpertise(updated);
  };

  // Apply final formatting when the cost amount input loses focus.
  // This keeps typing fluid while only normalizing the value after edit.
  const handleCostAmountBlur = (index) => {
    const updated = [...expertise];
    const currentCost = updated[index].cost || "";
    const parsed = parseCost(currentCost);
    if (parsed.amount.toLowerCase() === "free") {
      return;
    }
    const formattedAmount = formatCostValue(parsed.amount);
    if (parsed.unit === "total") {
      updated[index].cost = formattedAmount ? `${formattedAmount} total` : "total";
    } else if (parsed.unit) {
      updated[index].cost = `${formattedAmount}/${parsed.unit}`;
    } else {
      updated[index].cost = formattedAmount;
    }
    setExpertise(updated);
  };

  const handleBountyAmountChange = (index, value) => {
    const updated = [...expertise];
    const cleanedValue = value.replace(/\$/g, "");
    updated[index].bounty = cleanedValue;
    setExpertise(updated);
  };

  // Apply final formatting when the bounty input loses focus.
  // This preserves intermediate typing like "0." and only formats after edit.
  const handleBountyAmountBlur = (index) => {
    const updated = [...expertise];
    const currentBounty = updated[index].bounty || "";
    const formattedBounty = formatCostValue(currentBounty);
    updated[index].bounty = formattedBounty;
    setExpertise(updated);
  };

  // Handle cost unit change (from dropdown)
  const handleCostUnitChange = (index, selectedItem) => {
    const updated = [...expertise];
    const currentCost = updated[index].cost || "";
    const parsed = parseCost(currentCost);

    // If current amount is "Free", don't update
    if (parsed.amount.toLowerCase() === "free") {
      return;
    }

    // Combine amount and unit
    if (!selectedItem || !selectedItem.value) {
      updated[index].cost = parsed.amount;
    } else if (selectedItem.value === "total") {
      // For "total", don't add a leading /
      updated[index].cost = parsed.amount ? `${parsed.amount} total` : "total";
    } else {
      // For other units, add leading /
      updated[index].cost = `${parsed.amount}/${selectedItem.value}`;
    }
    setExpertise(updated);
  };

  const toggleEntryVisibility = (index) => {
    const item = expertise[index];
    if (!item.isPublic && isOfferingVisibilityBlocked(item)) {
      Alert.alert(
        "Unavailable",
        "This offering is under moderation and cannot be made public until an admin approves it."
      );
      return;
    }
    const updated = [...expertise];
    updated[index].isPublic = !updated[index].isPublic;
    setExpertise(updated);
  };

  const handleDateTimeInputChange = (index, field, value) => {
    const startKey = "profile_expertise_start";
    const endKey = "profile_expertise_end";
    if (!value || value.trim() === "") {
      handleInputChange(index, field === "start" ? startKey : endKey, value);
      return;
    }
    const { date, time } = parseDateTime(value);
    if (!date || !time) {
      handleInputChange(index, field === "start" ? startKey : endKey, value);
      return;
    }
    const combinedDateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes());
    const startValue = expertise[index]?.profile_expertise_start || "";
    if (field === "start") {
      if (!isStartDateValid(combinedDateTime)) {
        Alert.alert("Invalid Date", "Start date must be today or a future date/time.");
        return;
      }
    } else {
      if (!isEndDateValid(combinedDateTime, startValue)) {
        Alert.alert("Invalid Date", "End date must be after the start date.");
        return;
      }
    }
    handleInputChange(index, field === "start" ? startKey : endKey, value);
  };

  const handleDateTimeChange = (index, field, mode, selectedDate) => {
    if (!selectedDate) {
      setActivePicker(null);
      return;
    }
    const updated = [...expertise];
    const startKey = "profile_expertise_start";
    const endKey = "profile_expertise_end";
    const currentValue = updated[index][field === "start" ? startKey : endKey] || "";
    const startValue = updated[index][startKey] || "";
    const { date: currentDate, time: currentTime } = parseDateTime(currentValue);
    const defaultDate = new Date();
    const defaultTime = new Date(2000, 0, 1, 9, 0);

    if (mode === "date") {
      if (field === "start") {
        if (!isStartDateValid(selectedDate)) {
          Alert.alert("Invalid Date", "Start date must be today or a future date.");
          setActivePicker(null);
          return;
        }
      } else {
        if (!isEndDateValid(selectedDate, startValue)) {
          Alert.alert("Invalid Date", "End date must be after the start date.");
          setActivePicker(null);
          return;
        }
      }
      const newTime = currentTime || defaultTime;
      const combined = combineDateTime(selectedDate, newTime);
      updated[index][field === "start" ? startKey : endKey] = combined;
      setExpertise(updated);
      setActivePicker({ index, field, mode: "time" });
    } else {
      const newDate = currentDate || defaultDate;
      const combinedDateTime = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), selectedDate.getHours(), selectedDate.getMinutes());
      if (field === "start") {
        if (!isStartDateValid(combinedDateTime)) {
          Alert.alert("Invalid Date", "Start date and time must be today or a future date/time.");
          setActivePicker(null);
          return;
        }
      } else {
        if (!isEndDateValid(combinedDateTime, startValue)) {
          Alert.alert("Invalid Date", "End date and time must be after the start date and time.");
          setActivePicker(null);
          return;
        }
      }
      const combined = combineDateTime(newDate, selectedDate);
      updated[index][field === "start" ? startKey : endKey] = combined;
      setExpertise(updated);
      setActivePicker(null);
    }
  };

  const getPickerValue = (index, field) => {
    const startKey = "profile_expertise_start";
    const endKey = "profile_expertise_end";
    const value = expertise[index]?.[field === "start" ? startKey : endKey] || "";
    const { date, time } = parseDateTime(value);
    const defaultDate = new Date();
    const defaultTime = new Date(2000, 0, 1, 9, 0);
    if (activePicker?.mode === "date") return date || defaultDate;
    const d = date || defaultDate;
    const t = time || defaultTime;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.getHours(), t.getMinutes());
  };

  return (
    <View style={styles.sectionContainer}>
      {!singleItemMode ? (
        <View ref={sectionHeaderRef} collapsable={false} style={styles.headerRow}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, darkMode && styles.labelDark]}>Offering</Text>
            {!showForm ? (
              <TouchableOpacity onPress={addExpertise} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.addText, darkMode && styles.addTextDark]}>+</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.toggleContainer}>
            <TouchableOpacity onPress={toggleVisibility} style={[styles.togglePill, isPublic && styles.togglePillActiveGreen]}>
              <Text style={[styles.togglePillText, isPublic && styles.togglePillTextActive]}>{isPublic ? "Visible" : "Show"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleVisibility} style={[styles.togglePill, !isPublic && styles.togglePillActiveRed]}>
              <Text style={[styles.togglePillText, !isPublic && styles.togglePillTextActive]}>{!isPublic ? "Hidden" : "Hide"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {!singleItemMode && expertise.length === 0 && !showForm ? (
        <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No offerings added yet.</Text>
      ) : null}

      {expertise.map((item, index) => {
        const isEditing = showForm && editingIndex === index;
        return (
        <View
          key={item.profile_expertise_uid || `offering-${index}`}
          ref={(ref) => {
            if (ref) cardRefs.current[index] = ref;
          }}
          style={[styles.listItemWrapper, index > 0 && styles.listItemSpacing]}
        >
          {!isEditing ? (
            <ProfileOfferingListCard
              item={item}
              profileUid={profileUid}
              darkMode={darkMode}
              onEdit={() => startEditOffering(index)}
              onDelete={() => deleteExpertise(index)}
            />
          ) : null}

          {isEditing ? (
          <View style={styles.livePreviewBlock}>
          <View style={styles.previewSection}>
            <Text style={[styles.previewLabel, darkMode && styles.previewLabelDark]}>Customer preview</Text>
            <ProfileOfferingListCard item={item} profileUid={profileUid} darkMode={darkMode} showActions={false} showModerationBanner={false} />
          </View>

          <View style={[formStyles.container, formStyles.containerAfterPreview, darkMode && formStyles.darkContainer]}>
          {!hideItemVisibilityToggle || !disableDelete ? (
            <View style={[formStyles.titleBar, darkMode && formStyles.darkTitleBar]}>
              <Text style={[formStyles.titleText, darkMode && formStyles.darkTitleText]}>
                {editSnapshotRef.current ? `Edit Offering #${index + 1}` : "Add New Offering"}
              </Text>
              <View style={styles.titleBarActions}>
                {!hideItemVisibilityToggle ? (
                  <View style={styles.toggleContainer}>
                    <TouchableOpacity onPress={() => toggleEntryVisibility(index)} style={[styles.togglePill, item.isPublic && styles.togglePillActiveGreen]}>
                      <Text style={[styles.togglePillText, item.isPublic && styles.togglePillTextActive]}>{item.isPublic ? "Visible" : "Show"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => toggleEntryVisibility(index)} style={[styles.togglePill, !item.isPublic && styles.togglePillActiveRed]}>
                      <Text style={[styles.togglePillText, !item.isPublic && styles.togglePillTextActive]}>{!item.isPublic ? "Hidden" : "Hide"}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {!singleItemMode ? <OfferingModerationBanner item={item} darkMode={darkMode} compact /> : null}

          <View style={formStyles.topRow}>
            <ProfileItemImageColumn
              darkMode={darkMode}
              defaultSection='offering'
              accentColor={SEEKING_FORM_ACCENT}
              displayUri={getExpertiseDisplayUri(item)}
              imageError={!!item._expImageError}
              onImageError={() => handleInputChange(index, "_expImageError", true)}
              toolsVisible={item.profile_expertise_image_is_public === 1 || item.profile_expertise_image_is_public === "1" || item.profile_expertise_image_is_public === true}
              onShowTools={() => handleInputChange(index, "profile_expertise_image_is_public", 1)}
              onHideTools={() => handleInputChange(index, "profile_expertise_image_is_public", 0)}
              onUploadNative={() => pickExpertiseImage(index)}
              onWebFileChange={(e) => handleExpertiseWebImagePick(index, e)}
              onRemoveImage={() => removeExpertiseImage(index)}
              showRemove={!!getExpertiseDisplayUri(item)}
            />
            <View style={formStyles.detailsColumn}>
              <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Name</Text>
              <TextInput
                style={[
                  formStyles.fieldInput,
                  darkMode && formStyles.darkFieldInput,
                  !String(item.name || "").trim() && formStyles.fieldInputError,
                ]}
                placeholder='Expertise Name *'
                placeholderTextColor={darkMode ? "#888" : "#999"}
                value={item.name}
                onChangeText={(text) => handleInputChange(index, "name", text)}
              />
              <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel, { marginTop: 10 }]}>Description</Text>
              <TextInput
                style={[
                  formStyles.fieldInput,
                  formStyles.descriptionInput,
                  darkMode && formStyles.darkFieldInput,
                  !String(item.description || "").trim() && formStyles.fieldInputError,
                ]}
                placeholder='Description *'
                placeholderTextColor={darkMode ? "#888" : "#999"}
                value={item.description}
                onChangeText={(text) => handleInputChange(index, "description", text)}
                multiline={true}
                textAlignVertical='top'
                scrollEnabled={true}
              />
            </View>
          </View>

          <View style={[formStyles.sectionDivider, darkMode && formStyles.darkSectionDivider]} />

          <View style={formStyles.section}>
            <Text style={[formStyles.sectionTitle, darkMode && formStyles.darkSectionTitle]}>Schedule & Location</Text>
            <View style={formStyles.fieldRow}>
              <View style={formStyles.fieldHalf}>
                <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Start Date and Time</Text>
                <View style={formStyles.inlineControls}>
                  {DateTimePicker ? (
                    <>
                      <TouchableOpacity style={[formStyles.dateTimeButton, darkMode && formStyles.darkDateTimeButton]} onPress={() => setActivePicker({ index, field: "start", mode: "date" })}>
                        <Text style={[formStyles.dateTimeButtonText, darkMode && formStyles.darkDateTimeButtonText]}>
                          {(() => {
                            const { date } = parseDateTime(item.profile_expertise_start || "");
                            return date ? formatDateForDisplay(date) : "Date";
                          })()}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[formStyles.dateTimeButton, darkMode && formStyles.darkDateTimeButton]}
                        onPress={() => {
                          const { date, time } = parseDateTime(item.profile_expertise_start || "");
                          if (!date) setActivePicker({ index, field: "start", mode: "date" });
                          else setActivePicker({ index, field: "start", mode: "time" });
                        }}
                      >
                        <Text style={[formStyles.dateTimeButtonText, darkMode && formStyles.darkDateTimeButtonText]}>
                          {(() => {
                            const { time } = parseDateTime(item.profile_expertise_start || "");
                            return time ? formatTimeForDisplay(time) : "Time";
                          })()}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : Platform.OS === "web" ? (
                    <View style={formStyles.webDateTimeInputWrapper}>
                      <input
                        type='datetime-local'
                        style={formStyles.webDateTimeInput}
                        value={toDateTimeLocalValue(item.profile_expertise_start || "")}
                        onChange={(e) => handleDateTimeInputChange(index, "start", fromDateTimeLocalValue(e.target.value))}
                      />
                    </View>
                  ) : (
                    <TextInput
                      style={[formStyles.fieldInput, darkMode && formStyles.darkFieldInput, { flex: 1 }]}
                      placeholder='mm-dd-yyyy hh:mm'
                      placeholderTextColor={darkMode ? "#888" : "#999"}
                      value={item.profile_expertise_start ? formatDateTimeForDisplay(item.profile_expertise_start) : ""}
                      onChangeText={(text) => handleInputChange(index, "profile_expertise_start", text)}
                    />
                  )}
                </View>
              </View>
              <View style={formStyles.fieldHalf}>
                <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>End Date and Time</Text>
                <View style={formStyles.inlineControls}>
                  {DateTimePicker ? (
                    <>
                      <TouchableOpacity style={[formStyles.dateTimeButton, darkMode && formStyles.darkDateTimeButton]} onPress={() => setActivePicker({ index, field: "end", mode: "date" })}>
                        <Text style={[formStyles.dateTimeButtonText, darkMode && formStyles.darkDateTimeButtonText]}>
                          {(() => {
                            const { date } = parseDateTime(item.profile_expertise_end || "");
                            return date ? formatDateForDisplay(date) : "Date";
                          })()}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[formStyles.dateTimeButton, darkMode && formStyles.darkDateTimeButton]}
                        onPress={() => {
                          const { date, time } = parseDateTime(item.profile_expertise_end || "");
                          if (!date) setActivePicker({ index, field: "end", mode: "date" });
                          else setActivePicker({ index, field: "end", mode: "time" });
                        }}
                      >
                        <Text style={[formStyles.dateTimeButtonText, darkMode && formStyles.darkDateTimeButtonText]}>
                          {(() => {
                            const { time } = parseDateTime(item.profile_expertise_end || "");
                            return time ? formatTimeForDisplay(time) : "Time";
                          })()}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : Platform.OS === "web" ? (
                    <View style={formStyles.webDateTimeInputWrapper}>
                      <input
                        type='datetime-local'
                        style={formStyles.webDateTimeInput}
                        value={toDateTimeLocalValue(item.profile_expertise_end || "")}
                        onChange={(e) => handleDateTimeInputChange(index, "end", fromDateTimeLocalValue(e.target.value))}
                      />
                    </View>
                  ) : (
                    <TextInput
                      style={[formStyles.fieldInput, darkMode && formStyles.darkFieldInput, { flex: 1 }]}
                      placeholder='mm-dd-yyyy hh:mm'
                      placeholderTextColor={darkMode ? "#888" : "#999"}
                      value={item.profile_expertise_end ? formatDateTimeForDisplay(item.profile_expertise_end) : ""}
                      onChangeText={(text) => handleInputChange(index, "profile_expertise_end", text)}
                    />
                  )}
                </View>
              </View>
            </View>
            <View style={formStyles.fieldStack}>
              <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Mode</Text>
              <View style={formStyles.modeRow}>
                {(() => {
                  const { virtual, inPerson } = parseExpertiseModeFlags(item.profile_expertise_mode);
                  return (
                    <>
                      <TouchableOpacity
                        style={[
                          formStyles.choiceBtn,
                          formStyles.modeBtn,
                          darkMode && formStyles.darkChoiceBtn,
                          virtual && formStyles.choiceBtnActive,
                          darkMode && virtual && formStyles.darkChoiceBtnActive,
                        ]}
                        onPress={() => toggleExpertiseMode(index, "virtual")}
                      >
                        <Text
                          style={[
                            formStyles.choiceBtnText,
                            darkMode && formStyles.darkChoiceBtnText,
                            virtual && formStyles.choiceBtnTextActive,
                            darkMode && virtual && formStyles.darkChoiceBtnTextActive,
                          ]}
                        >
                          Virtual
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          formStyles.choiceBtn,
                          formStyles.modeBtn,
                          darkMode && formStyles.darkChoiceBtn,
                          inPerson && formStyles.choiceBtnActive,
                          darkMode && inPerson && formStyles.darkChoiceBtnActive,
                        ]}
                        onPress={() => toggleExpertiseMode(index, "inPerson")}
                      >
                        <Text
                          style={[
                            formStyles.choiceBtnText,
                            darkMode && formStyles.darkChoiceBtnText,
                            inPerson && formStyles.choiceBtnTextActive,
                            darkMode && inPerson && formStyles.darkChoiceBtnTextActive,
                          ]}
                        >
                          In-Person
                        </Text>
                      </TouchableOpacity>
                    </>
                  );
                })()}
              </View>
            </View>
            {parseExpertiseModeFlags(item.profile_expertise_mode).inPerson ? (
              <>
                <View style={formStyles.fieldStack}>
                  <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Address</Text>
                  {renderOfferingAddressField(index, item)}
                </View>
                <View style={formStyles.fieldRow}>
                  <View style={formStyles.fieldHalf}>
                    <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>City</Text>
                    <TextInput
                      style={[formStyles.fieldInput, darkMode && formStyles.darkFieldInput]}
                      placeholder='City'
                      placeholderTextColor={darkMode ? "#cccccc" : "#999999"}
                      value={item.profile_expertise_city || ""}
                      onChangeText={(text) => handleInputChange(index, "profile_expertise_city", text)}
                      autoCapitalize='words'
                    />
                  </View>
                  <View style={formStyles.fieldHalf}>
                    <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>State</Text>
                    <TextInput
                      style={[formStyles.fieldInput, darkMode && formStyles.darkFieldInput]}
                      placeholder='State'
                      placeholderTextColor={darkMode ? "#cccccc" : "#999999"}
                      value={item.profile_expertise_state || ""}
                      onChangeText={(text) => handleInputChange(index, "profile_expertise_state", text)}
                      autoCapitalize='characters'
                    />
                  </View>
                </View>
              </>
            ) : null}
            {DateTimePicker && activePicker && activePicker.index === index && (
              <DateTimePicker
                value={getPickerValue(activePicker.index, activePicker.field)}
                mode={activePicker.mode}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, selectedDate) => {
                  if (selectedDate) {
                    handleDateTimeChange(activePicker.index, activePicker.field, activePicker.mode, selectedDate);
                  } else {
                    setActivePicker(null);
                  }
                }}
              />
            )}
          </View>

          <View style={[formStyles.sectionDivider, darkMode && formStyles.darkSectionDivider]} />

          <View style={formStyles.section}>
            <Text style={[formStyles.sectionTitle, darkMode && formStyles.darkSectionTitle]}>Pricing</Text>
            <View style={formStyles.pricingGrid}>
              <View style={formStyles.pricingCol}>
                <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Cost</Text>
                <View style={formStyles.inlineControls}>
                  <TextInput
                    ref={(ref) => {
                      if (ref) costInputRefs.current[index] = ref;
                    }}
                    style={[formStyles.fieldInput, formStyles.inlineAmountInput, darkMode && formStyles.darkFieldInput]}
                    keyboardType={(() => {
                      const parsed = parseCost(item.cost);
                      const amount = parsed.amount;
                      return amount && (amount.toLowerCase() === "free" || !/^\d/.test(amount.trim())) ? "default" : "decimal-pad";
                    })()}
                    value={(() => {
                      const parsed = parseCost(item.cost);
                      const amount = parsed.amount;
                      if (!amount) return "";
                      if (amount.toLowerCase() === "free") return "Free";
                      return `$${amount}`;
                    })()}
                    onChangeText={(text) => {
                      const cleanedText = text.replace(/\$/g, "");
                      handleCostAmountChange(index, cleanedText);
                    }}
                    onBlur={() => handleCostAmountBlur(index)}
                    placeholder='0.00'
                    placeholderTextColor={darkMode ? "#888" : "#999"}
                  />
                  <Dropdown
                    style={[
                      formStyles.dropdown,
                      formStyles.costUnitDropdown,
                      darkMode && formStyles.darkDropdown,
                      !parseCost(item.cost).unit && formStyles.fieldInputError,
                    ]}
                    data={PROFILE_COST_UNIT_OPTIONS}
                    labelField='label'
                    valueField='value'
                    placeholder='Unit *'
                    placeholderStyle={{ color: !parseCost(item.cost).unit ? "#FF3B30" : darkMode ? "#999" : "#666" }}
                    value={parseCost(item.cost).unit || null}
                    onChange={(selected) => handleCostUnitChange(index, selected)}
                    containerStyle={[formStyles.dropdownContainer, darkMode && formStyles.darkDropdownContainer]}
                    itemTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 13 }}
                    selectedTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 13 }}
                    activeColor={darkMode ? "#404040" : "#f0f0f0"}
                    maxHeight={220}
                    flatListProps={{ nestedScrollEnabled: true }}
                  />
                </View>
              </View>

              <View style={formStyles.pricingCol}>
                <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Sales tax</Text>
                <View style={formStyles.inlineControls}>
                  <Dropdown
                    style={[formStyles.dropdown, formStyles.taxDropdown, darkMode && formStyles.darkDropdown]}
                    data={PROFILE_TAX_OPTIONS}
                    labelField='label'
                    valueField='value'
                    value={isTruthyTaxableFlag(item.profile_expertise_is_taxable) ? "taxable" : "no_tax"}
                    onChange={(selected) => handleOfferingTaxDropdownChange(index, selected)}
                    containerStyle={[formStyles.dropdownContainer, darkMode && formStyles.darkDropdownContainer]}
                    itemTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 13 }}
                    selectedTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 13 }}
                    activeColor={darkMode ? "#404040" : "#f0f0f0"}
                    maxHeight={120}
                    flatListProps={{ nestedScrollEnabled: true }}
                  />
                  {isTruthyTaxableFlag(item.profile_expertise_is_taxable) ? (
                    <View style={formStyles.taxRateInputWithSuffix}>
                      <TextInput
                        style={[
                          formStyles.fieldInput,
                          formStyles.taxRateInput,
                          darkMode && formStyles.darkFieldInput,
                          (!item.profile_expertise_tax_rate || !isValidTaxRate(item.profile_expertise_tax_rate)) && formStyles.fieldInputError,
                        ]}
                        value={String(item.profile_expertise_tax_rate ?? "")}
                        onChangeText={(t) => handleInputChange(index, "profile_expertise_tax_rate", t.replace(/[^0-9.]/g, ""))}
                        onBlur={() => handleOfferingTaxRateBlur(index)}
                        placeholder='9.00'
                        placeholderTextColor={darkMode ? "#888" : "#999"}
                        keyboardType='decimal-pad'
                      />
                      <Text style={[formStyles.inputSuffix, darkMode && formStyles.darkInputSuffix]}>%</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={formStyles.pricingCol}>
                <View style={styles.fieldLabelRow}>
                  <Text style={[formStyles.fieldLabel, styles.fieldLabelInRow, darkMode && formStyles.darkFieldLabel]}>Bounty</Text>
                  <BountyInfoTooltip perspective='seller' darkMode={darkMode} />
                </View>
                <View style={formStyles.inlineControls}>
                  <Dropdown
                    style={[formStyles.dropdown, formStyles.bountyTypeDropdown, darkMode && formStyles.darkDropdown]}
                    data={PROFILE_BOUNTY_TYPE_OPTIONS}
                    labelField='label'
                    valueField='value'
                    value={item.profile_expertise_bounty_type || "none"}
                    onChange={(selected) => handleOfferingBountyTypeChange(index, selected)}
                    containerStyle={[formStyles.dropdownContainer, darkMode && formStyles.darkDropdownContainer]}
                    itemTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 13 }}
                    selectedTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 13 }}
                    activeColor={darkMode ? "#404040" : "#f0f0f0"}
                    maxHeight={160}
                    flatListProps={{ nestedScrollEnabled: true }}
                  />
                  {item.profile_expertise_bounty_type !== "none" ? (
                    <TextInput
                      style={[formStyles.fieldInput, formStyles.inlineAmountInput, darkMode && formStyles.darkFieldInput]}
                      value={(() => {
                        const parsed = parseBounty(item.bounty);
                        const amount = parsed.amount;
                        if (!amount) return "";
                        return `$${amount}`;
                      })()}
                      onChangeText={(text) => handleBountyAmountChange(index, text.replace(/\$/g, ""))}
                      onBlur={() => handleBountyAmountBlur(index)}
                      placeholder='$0.00'
                      placeholderTextColor={darkMode ? "#888" : "#999"}
                      keyboardType='decimal-pad'
                    />
                  ) : null}
                </View>
              </View>
            </View>
            {offeringBountyExceedsCost(item) ? (
              <Text style={[formStyles.warningText, darkMode && formStyles.darkWarningText]}>
                Warning: Bounty is greater than the item cost. You may pay referrers more than you charge per item.
              </Text>
            ) : null}
          </View>

          <View style={[formStyles.sectionDivider, darkMode && formStyles.darkSectionDivider]} />

          <View style={formStyles.section}>
            <Text style={[formStyles.sectionTitle, darkMode && formStyles.darkSectionTitle]}>Fulfillment</Text>
            <View style={formStyles.fulfillmentGrid}>
              <View style={formStyles.fulfillmentCol}>
                <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Condition</Text>
                <Dropdown
                  style={[formStyles.dropdown, formStyles.fulfillmentDropdown, darkMode && formStyles.darkDropdown]}
                  data={PROFILE_CONDITION_OPTIONS}
                  labelField='label'
                  valueField='value'
                  value={item.profile_expertise_condition_type || "na"}
                  onChange={(selected) => handleOfferingConditionChange(index, selected)}
                  containerStyle={[formStyles.dropdownContainer, darkMode && formStyles.darkDropdownContainer]}
                  itemTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 13 }}
                  selectedTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 13 }}
                  activeColor={darkMode ? "#404040" : "#f0f0f0"}
                  maxHeight={160}
                  flatListProps={{ nestedScrollEnabled: true }}
                />
                {item.profile_expertise_condition_type === "used" ? (
                  <View style={formStyles.fulfillmentExtra}>
                    <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Condition details</Text>
                    <TextInput
                      style={[formStyles.fieldInput, formStyles.descriptionInput, darkMode && formStyles.darkFieldInput]}
                      value={item.profile_expertise_condition_detail || ""}
                      onChangeText={(t) => handleInputChange(index, "profile_expertise_condition_detail", t.slice(0, CONDITION_DETAIL_MAX_CHARS))}
                      placeholder='Description (250 characters max)'
                      placeholderTextColor={darkMode ? "#888" : "#999"}
                      maxLength={CONDITION_DETAIL_MAX_CHARS}
                      multiline
                      textAlignVertical='top'
                    />
                  </View>
                ) : null}
              </View>

              <View style={formStyles.fulfillmentCol}>
                <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Shipping/delivery</Text>
                <Dropdown
                  style={[formStyles.dropdown, formStyles.fulfillmentDropdown, darkMode && formStyles.darkDropdown]}
                  data={PROFILE_OFFERING_SHIPPING_OPTIONS}
                  labelField='label'
                  valueField='value'
                  value={getOfferingShippingDropdownValue(item)}
                  onChange={(selected) => handleOfferingShippingChange(index, selected)}
                  containerStyle={[formStyles.dropdownContainer, darkMode && formStyles.darkDropdownContainer]}
                  itemTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 13 }}
                  selectedTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 13 }}
                  activeColor={darkMode ? "#404040" : "#f0f0f0"}
                  maxHeight={220}
                  flatListProps={{ nestedScrollEnabled: true }}
                />
                {isFixedOfferingShipping(item) ? (
                  <View style={formStyles.fulfillmentExtra}>
                    <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Fixed shipping amount</Text>
                    <View style={[formStyles.fixedShippingRow, darkMode && formStyles.darkFixedShippingRow]}>
                      <Text style={[formStyles.fixedShippingPrefix, darkMode && formStyles.darkFixedShippingPrefix]}>$</Text>
                      <TextInput
                        style={[formStyles.fixedShippingInput, darkMode && formStyles.darkFixedShippingInput]}
                        value={offeringShippingAmountDisplay(item)}
                        onChangeText={(text) => {
                          const cleaned = String(text).replace(/[^0-9.]/g, "");
                          const parts = cleaned.split(".");
                          const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
                          const updated = [...expertise];
                          updated[index] = {
                            ...updated[index],
                            profile_expertise_shipping: BS_SHIPPING_BUYER_FIXED,
                            profile_expertise_shipping_amount: normalized === "" ? "" : normalized,
                            profile_expertise_free_shipping: 0,
                            profile_expertise_buyer_pays_shipping: 1,
                            profile_expertise_shipping_cost_type: "fixed",
                          };
                          setExpertise(updated);
                        }}
                        onBlur={() => {
                          if (!isFixedOfferingShipping(item)) return;
                          const raw = String(item.profile_expertise_shipping_amount ?? "").trim();
                          if (!raw || raw === ".") {
                            handleInputChange(index, "profile_expertise_shipping_amount", "");
                            return;
                          }
                          const amount = parseBsShippingAmount(raw);
                          if (amount == null && !(raw === "0" || raw === "0." || raw === "0.0" || raw === "0.00")) return;
                          handleInputChange(index, "profile_expertise_shipping_amount", amount == null ? "0" : String(amount));
                        }}
                        placeholder='Fixed shipping amount'
                        keyboardType='decimal-pad'
                        placeholderTextColor={darkMode ? "#888" : "#999"}
                      />
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={formStyles.fulfillmentCol}>
                <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Returnable</Text>
                <Dropdown
                  style={[formStyles.dropdown, formStyles.fulfillmentDropdown, darkMode && formStyles.darkDropdown]}
                  data={PROFILE_RETURNABLE_OPTIONS}
                  labelField='label'
                  valueField='value'
                  value={getOfferingReturnableDropdownValue(item)}
                  onChange={(selected) => handleOfferingReturnableChange(index, selected)}
                  containerStyle={[formStyles.dropdownContainer, darkMode && formStyles.darkDropdownContainer]}
                  itemTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 13 }}
                  selectedTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 13 }}
                  activeColor={darkMode ? "#404040" : "#f0f0f0"}
                  maxHeight={120}
                  flatListProps={{ nestedScrollEnabled: true }}
                />
                {getOfferingReturnableDropdownValue(item) === "yes" ? (
                  <View style={formStyles.fulfillmentExtra}>
                    <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Return window</Text>
                    <View style={formStyles.fulfillmentInlineRow}>
                      <TextInput
                        style={[formStyles.fieldInput, formStyles.quantityInput, darkMode && formStyles.darkFieldInput]}
                        value={String(item.profile_expertise_return_window_days ?? "30")}
                        onChangeText={(t) => handleInputChange(index, "profile_expertise_return_window_days", t.replace(/\D/g, "").slice(0, RETURN_WINDOW_MAX_DIGITS))}
                        placeholder='30'
                        placeholderTextColor={darkMode ? "#888" : "#999"}
                        keyboardType='number-pad'
                        maxLength={RETURN_WINDOW_MAX_DIGITS}
                      />
                      <Text style={[formStyles.checkboxLabelCompact, darkMode && formStyles.darkCheckboxLabelCompact]}>days</Text>
                      {isBuyerPaysOfferingShipping(item) ? (
                        <TouchableOpacity
                          style={formStyles.checkboxRowInline}
                          onPress={() => {
                            const checked = item.profile_expertise_shipping_refundable === 1 || item.profile_expertise_shipping_refundable === "1";
                            handleInputChange(index, "profile_expertise_shipping_refundable", checked ? 0 : 1);
                          }}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={item.profile_expertise_shipping_refundable === 1 || item.profile_expertise_shipping_refundable === "1" ? "checkbox" : "square-outline"}
                            size={18}
                            color={item.profile_expertise_shipping_refundable === 1 || item.profile_expertise_shipping_refundable === "1" ? "#111" : darkMode ? "#aaa" : "#666"}
                          />
                          <Text style={[formStyles.checkboxLabelCompact, darkMode && formStyles.darkCheckboxLabelCompact]}>Shipping is refundable</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={formStyles.fulfillmentCol}>
                <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Quantity</Text>
                <Dropdown
                  style={[formStyles.dropdown, formStyles.fulfillmentDropdown, darkMode && formStyles.darkDropdown]}
                  data={PROFILE_QUANTITY_OPTIONS}
                  labelField='label'
                  valueField='value'
                  value={isOfferingQtyUnlimited(item) ? "unlimited" : "limited"}
                  onChange={(selected) => handleOfferingQtyLimitChange(index, selected)}
                  containerStyle={[formStyles.dropdownContainer, darkMode && formStyles.darkDropdownContainer]}
                  itemTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 13 }}
                  selectedTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 13 }}
                  activeColor={darkMode ? "#404040" : "#f0f0f0"}
                  maxHeight={120}
                  flatListProps={{ nestedScrollEnabled: true }}
                />
                {!isOfferingQtyUnlimited(item) ? (
                  <View style={formStyles.fulfillmentExtra}>
                    <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Available quantity</Text>
                    <TextInput
                      style={[formStyles.fieldInput, darkMode && formStyles.darkFieldInput]}
                      placeholder='Count'
                      placeholderTextColor={darkMode ? "#888" : "#999"}
                      keyboardType='number-pad'
                      maxLength={QUANTITY_MAX_DIGITS}
                      value={item.quantity || ""}
                      onChangeText={(text) => handleInputChange(index, "quantity", text.replace(/\D/g, "").slice(0, QUANTITY_MAX_DIGITS))}
                    />
                  </View>
                ) : null}
              </View>
            </View>
            <View style={formStyles.fulfillmentExtra}>
              <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Refund Policy</Text>
              <TextInput
                style={[formStyles.fieldInput, darkMode && formStyles.darkFieldInput]}
                value={item.profile_expertise_refund_policy || ""}
                onChangeText={(t) => handleInputChange(index, "profile_expertise_refund_policy", t.slice(0, 45))}
                placeholder='Describe your refund policy (max 45 characters)'
                placeholderTextColor={darkMode ? "#cccccc" : "#999999"}
                maxLength={45}
              />
            </View>
          </View>

          <View style={styles.formFooterButtons}>
            <TouchableOpacity style={[styles.formCancelButton, darkMode && styles.formCancelButtonDark]} onPress={cancelEditOffering} activeOpacity={0.8}>
              <Text style={[styles.formCancelButtonText, darkMode && styles.formCancelButtonTextDark]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.formDoneButton, darkMode && styles.formDoneButtonDark]} onPress={doneEditOffering} activeOpacity={0.8}>
              <Text style={[styles.formDoneButtonText, darkMode && styles.formDoneButtonTextDark]}>Done</Text>
            </TouchableOpacity>
          </View>
          </View>
          </View>
          ) : null}
        </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: { marginBottom: 20 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
    zIndex: 2,
  },
  fieldLabelInRow: {
    marginBottom: 0,
  },
  label: { fontSize: 18, fontWeight: "bold" },
  labelDark: { color: "#fff" },
  addText: { fontSize: 24, fontWeight: "bold", color: "#000" },
  addTextDark: { color: "#fff" },
  emptyText: { fontSize: 14, color: "#666", marginBottom: 8 },
  emptyTextDark: { color: "#aaa" },
  listItemWrapper: { marginBottom: 0 },
  listItemSpacing: { marginTop: 10 },
  livePreviewBlock: { marginBottom: 10 },
  previewSection: { marginBottom: 12 },
  previewLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  previewLabelDark: { color: "#9ca3af" },
  formFooterButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  formCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
  },
  formCancelButtonDark: {
    borderColor: "#555",
    backgroundColor: "#3a3a3a",
  },
  formCancelButtonText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  formCancelButtonTextDark: { color: "#e5e7eb" },
  formDoneButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: SEEKING_FORM_ACCENT,
  },
  formDoneButtonDark: {
    backgroundColor: SEEKING_FORM_ACCENT_DARK,
  },
  formDoneButtonText: { fontSize: 14, fontWeight: "600", color: "#111827" },
  formDoneButtonTextDark: { color: "#fff" },
  titleBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleContainer: { flexDirection: "row", gap: 4 },
  togglePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: "transparent" },
  togglePillActiveGreen: { backgroundColor: "#4CAF50" },
  togglePillActiveRed: { backgroundColor: "#ef9a9a" },
  togglePillText: { fontSize: 13, color: "#4e4e4e", fontWeight: "500" },
  togglePillTextActive: { color: "#fff", fontWeight: "bold" },
});

const getOfferingCostUnit = (cost) => {
  if (!cost) return null;
  return cost.match(/\/(hr|day|week|2 weeks|month|quarter|year|each)$|(\btotal\b)/i);
};

export const validateExpertise = (expertise) => {
  return (expertise || []).every((e) => {
    const hasTitle = !!String(e.name || "").trim();
    const hasDescription = !!String(e.description || "").trim();
    const hasUnit = !!getOfferingCostUnit(e.cost);
    return hasTitle && hasDescription && hasUnit;
  });
};

export const validateExpertiseTax = (expertise) => {
  return (expertise || []).every((e) => {
    if (!String(e.name || "").trim()) return true;
    return validateTaxableRate(e.profile_expertise_is_taxable, e.profile_expertise_tax_rate);
  });
};
export default ExpertiseSection;
