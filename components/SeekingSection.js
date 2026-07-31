import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Platform, Alert, ActivityIndicator } from "react-native";
import { getAddressSuggestions, getPlaceDetails, applyPlaceDetailsToAddressFields } from "../utils/googlePlaces";
import { Dropdown } from "react-native-element-dropdown";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { formatCostValue } from "../utils/priceUtils";
import { resolveProfileItemImageUri, isRemoteHttpUrl } from "../utils/resolveProfileItemImageUri";
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
import SeekingModerationBanner from "./SeekingModerationBanner";
import ProfileSeekingListCard from "./ProfileSeekingListCard";
import BountyInfoTooltip from "./BountyInfoTooltip";
import { isSeekingVisibilityBlocked } from "../utils/seekingModeration";
import { seekingProfileItemCardFormStyles as formStyles, SEEKING_FORM_ACCENT, SEEKING_FORM_ACCENT_DARK } from "../utils/profileItemCardFormStyles";
import { PROFILE_COST_UNIT_OPTIONS, PROFILE_BOUNTY_TYPE_OPTIONS } from "../utils/profileItemFormOptions";

// DateTimePicker only works on native (not web)
let DateTimePicker = null;
if (Platform.OS !== "web") {
  try {
    DateTimePicker = require("@react-native-community/datetimepicker").default;
  } catch (e) {
    console.warn("DateTimePicker not available:", e.message);
  }
}

const SeekingSection = ({ wishes, setWishes, toggleVisibility, isPublic, handleDelete, onInputFocus, profileUid = "", profileDefaultAddress = null, darkMode = false }) => {
  // Stores each rendered card's ref by index so parent can scroll to the new one.
  const cardRefs = useRef({});
  const sectionHeaderRef = useRef(null);
  // Tracks which index was just added via "+".
  const pendingNewIndexRef = useRef(null);
  const editSnapshotRef = useRef(null);
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const bountyInputRefs = useRef({});
  const [activePicker, setActivePicker] = useState(null); // { index, field: 'start'|'end', mode: 'date'|'time' }
  const [addressSuggestionsByIndex, setAddressSuggestionsByIndex] = useState({});
  const [addressLoadingIndex, setAddressLoadingIndex] = useState(null);
  const addressDebounceRefs = useRef({});

  const isSeekingEmpty = (item) =>
    !String(item?.helpNeeds || "").trim() && !String(item?.details || "").trim() && !String(item?.cost || "").trim();

  const closeSeekingForm = () => {
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

  const startEditSeeking = (index) => {
    editSnapshotRef.current = JSON.parse(JSON.stringify(wishes[index] || {}));
    setEditingIndex(index);
    setShowForm(true);
    scrollToCard(index);
  };

  const doneEditSeeking = () => {
    closeSeekingForm();
    scrollToSectionHeader();
  };

  const cancelEditSeeking = () => {
    if (editingIndex !== null) {
      if (editSnapshotRef.current) {
        const updated = [...wishes];
        updated[editingIndex] = editSnapshotRef.current;
        setWishes(updated);
      } else if (isSeekingEmpty(wishes[editingIndex])) {
        handleDelete(editingIndex);
      }
    }
    closeSeekingForm();
    scrollToSectionHeader();
  };

  const addWish = () => {
    const newIndex = wishes.length;
    pendingNewIndexRef.current = newIndex;
    editSnapshotRef.current = null;
    const newEntry = {
      helpNeeds: "",
      details: "",
      amount: "",
      cost: "",
      profile_wish_quantity: "",
      profile_wish_image: "",
      profile_wish_image_is_public: 1,
      profile_wish_start: "",
      profile_wish_end: "",
      profile_wish_bounty_type: "none",
      profile_wish_location: "",
      profile_wish_latitude: null,
      profile_wish_longitude: null,
      profile_wish_city: "",
      profile_wish_state: "",
      profile_wish_zip: "",
      profile_wish_mode: "",
      isPublic: true,
      _wishNewImageUri: "",
      _wishWebImageFile: null,
      _wishOriginalImage: "",
      _wishDeleteImageUrl: "",
      _wishImageError: false,
    };
    setWishes([...wishes, newEntry]);
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
  }, [wishes.length, onInputFocus]);

  const deleteWish = (index) => {
    if (showForm) {
      if (editingIndex === index) {
        closeSeekingForm();
      } else if (editingIndex !== null && editingIndex > index) {
        setEditingIndex(editingIndex - 1);
      }
    }
    handleDelete(index);
  };

  const handleInputChange = (index, field, value) => {
    const updated = [...wishes];
    updated[index][field] = value;
    setWishes(updated);
  };

  const toggleWishMode = (index, key) => {
    const updated = [...wishes];
    const item = updated[index];
    const prev = parseExpertiseModeFlags(item?.profile_wish_mode);
    const flags = { virtual: !!prev.virtual, delivered: !!prev.delivered, inPerson: !!prev.inPerson };
    flags[key] = !flags[key];
    updated[index] = { ...item, profile_wish_mode: serializeExpertiseMode(flags) };
    if (key === "inPerson" && flags.inPerson && profileDefaultAddress) {
      if (!String(updated[index].profile_wish_location || "").trim() && profileDefaultAddress.homeAddress) {
        updated[index].profile_wish_location = profileDefaultAddress.homeAddress;
      }
      if (!String(updated[index].profile_wish_city || "").trim() && profileDefaultAddress.city) {
        updated[index].profile_wish_city = profileDefaultAddress.city;
      }
      if (!String(updated[index].profile_wish_state || "").trim() && profileDefaultAddress.state) {
        updated[index].profile_wish_state = profileDefaultAddress.state;
      }
      if (!String(updated[index].profile_wish_zip || "").trim() && profileDefaultAddress.zip) {
        updated[index].profile_wish_zip = profileDefaultAddress.zip;
      }
    }
    setWishes(updated);
  };

  const handleSeekingBountyTypeChange = (index, selected) => {
    if (selected.value === "none") {
      handleInputChange(index, "profile_wish_bounty_type", "none");
      handleInputChange(index, "amount", "");
    } else {
      handleInputChange(index, "profile_wish_bounty_type", selected.value);
    }
  };

  const onWishAddressChange = (index, text) => {
    const updated = wishes.map((w, i) => {
      if (i !== index) return w;
      return {
        ...w,
        profile_wish_location: text,
        ...(text.trim() ? {} : { profile_wish_latitude: null, profile_wish_longitude: null, profile_wish_city: "", profile_wish_state: "", profile_wish_zip: "" }),
      };
    });
    if (!text.trim()) setAddressSuggestionsByIndex((prev) => ({ ...prev, [index]: [] }));
    setWishes(updated);

    if (addressDebounceRefs.current[index]) clearTimeout(addressDebounceRefs.current[index]);
    if (!text.trim()) return;

    addressDebounceRefs.current[index] = setTimeout(async () => {
      try {
        const results = await getAddressSuggestions(text);
        setAddressSuggestionsByIndex((prev) => ({ ...prev, [index]: results }));
      } catch (err) {
        console.error("SeekingSection address suggestions error:", err);
      }
    }, 350);
  };

  const onWishAddressBlur = async (index) => {
    const item = wishes[index];
    if (!item?.profile_wish_location?.trim()) return;
    if (item.profile_wish_latitude != null && item.profile_wish_longitude != null) return;
    try {
      const suggs = await getAddressSuggestions(item.profile_wish_location.trim());
      if (!suggs.length) return;
      const pd = await getPlaceDetails(suggs[0].place_id);
      if (pd.lat == null || pd.lng == null) return;
      setWishes(
        wishes.map((w, i) => {
          if (i !== index) return w;
          const fields = applyPlaceDetailsToAddressFields(pd);
          return {
            ...w,
            profile_wish_location: fields.streetLine,
            profile_wish_latitude: fields.lat,
            profile_wish_longitude: fields.lng,
            profile_wish_city: fields.city || w.profile_wish_city,
            profile_wish_state: fields.state || w.profile_wish_state,
            profile_wish_zip: fields.zip || w.profile_wish_zip,
          };
        })
      );
    } catch (e) {
      console.warn("[Seeking] blur geocode failed:", e);
    }
  };

  const handleWishAddressSelect = async (index, place) => {
    setAddressSuggestionsByIndex((prev) => ({ ...prev, [index]: [] }));
    setAddressLoadingIndex(index);
    try {
      console.log("[Seeking] address select called, place_id:", place.place_id);
      const pd = await getPlaceDetails(place.place_id);
      console.log("[Seeking] getPlaceDetails result:", JSON.stringify(pd));
      if (pd.lat == null || pd.lng == null) {
        console.warn("[Seeking] lat/lng missing from place details:", pd);
        Alert.alert("Error", "Could not determine coordinates for this address.");
        return;
      }
      const fields = applyPlaceDetailsToAddressFields(pd, place.description);
      const updated = wishes.map((w, i) => {
        if (i !== index) return w;
        return {
          ...w,
          profile_wish_location: fields.streetLine,
          profile_wish_latitude: fields.lat,
          profile_wish_longitude: fields.lng,
          profile_wish_city: fields.city,
          profile_wish_state: fields.state,
          profile_wish_zip: fields.zip,
        };
      });
      console.log("[Seeking] updated wish lat/lng:", updated[index]?.profile_wish_latitude, updated[index]?.profile_wish_longitude);
      setWishes(updated);
    } catch (err) {
      console.error("SeekingSection address select error:", err);
      Alert.alert("Error", "Could not load address details. Please try again.");
    } finally {
      setAddressLoadingIndex(null);
    }
  };

  const renderWishAddressField = (index, item) => {
    const hasRecordedLocation = item.profile_wish_latitude != null && item.profile_wish_longitude != null;
    const addressPlaceholder = hasRecordedLocation
      ? "Address recorded. Enter a new address to change it."
      : "Start typing the address";
    const suggestions = addressSuggestionsByIndex[index] || [];

    return (
      <View style={formStyles.addressContainer}>
        <TextInput
          style={[formStyles.fieldInput, darkMode && formStyles.darkFieldInput]}
          placeholder={addressPlaceholder}
          placeholderTextColor={darkMode ? "#cccccc" : "#999999"}
          value={item.profile_wish_location || ""}
          onChangeText={(text) => onWishAddressChange(index, text)}
          onBlur={() => onWishAddressBlur(index)}
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
                onPress={() => handleWishAddressSelect(index, suggestion)}
                activeOpacity={0.7}
              >
                <Text style={[formStyles.placesSuggestionMain, darkMode && formStyles.darkPlacesSuggestionMain]}>
                  {suggestion.structured_formatting?.main_text || suggestion.description}
                </Text>
                {suggestion.structured_formatting?.secondary_text ? (
                  <Text style={[formStyles.placesSuggestionSub, darkMode && formStyles.darkPlacesSuggestionSub]}>
                    {suggestion.structured_formatting.secondary_text}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const getWishDisplayUri = (item) => {
    const pending = item._wishNewImageUri;
    if (pending != null && String(pending).trim() !== "") return String(pending).trim();
    return resolveProfileItemImageUri(item.profile_wish_image, profileUid);
  };

  const pickWishImage = async (index) => {
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
        let fileSize = asset.fileSize;
        if (!fileSize && asset.uri) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(asset.uri);
            fileSize = fileInfo.size;
          } catch (e) {
            /* ignore */
          }
        }
        if (fileSize && fileSize > 2 * 1024 * 1024) {
          Alert.alert("File not selectable", "Image size exceeds the 2MB upload limit.");
          return;
        }
        const updated = [...wishes];
        const prev = updated[index];
        const orig = prev._wishOriginalImage || resolveProfileItemImageUri(prev.profile_wish_image, profileUid);
        updated[index]._wishDeleteImageUrl = isRemoteHttpUrl(orig) ? orig : "";
        updated[index]._wishNewImageUri = asset.uri;
        updated[index]._wishWebImageFile = null;
        updated[index]._wishImageError = false;
        setWishes(updated);
      }
    } catch (error) {
      console.error("Wish image pick error:", error);
      Alert.alert("Error", "Failed to pick image.");
    }
  };

  const handleWishWebImagePick = (index, event) => {
    const file = event.target?.files?.[0];
    if (event?.target) event.target.value = "";
    if (!file) return;
    if (!file.type?.startsWith?.("image/")) {
      Alert.alert("Invalid file type", "Please select an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      Alert.alert("File not selectable", "Image size exceeds the 2MB upload limit.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageUri = reader.result;
      const updated = [...wishes];
      const prev = updated[index];
      const orig = prev._wishOriginalImage || resolveProfileItemImageUri(prev.profile_wish_image, profileUid);
      updated[index]._wishDeleteImageUrl = isRemoteHttpUrl(orig) ? orig : "";
      updated[index]._wishNewImageUri = imageUri;
      updated[index]._wishWebImageFile = file;
      updated[index]._wishImageError = false;
      setWishes(updated);
    };
    reader.readAsDataURL(file);
  };

  const removeWishImage = (index) => {
    const updated = [...wishes];
    const prev = updated[index];
    const orig = prev._wishOriginalImage || resolveProfileItemImageUri(prev.profile_wish_image, profileUid);
    updated[index]._wishDeleteImageUrl = isRemoteHttpUrl(orig) ? orig : "";
    updated[index]._wishNewImageUri = "";
    updated[index]._wishWebImageFile = null;
    updated[index].profile_wish_image = "";
    updated[index]._wishOriginalImage = "";
    updated[index]._wishImageError = false;
    setWishes(updated);
  };

  const handleDateTimeInputChange = (index, field, value) => {
    if (!value || value.trim() === "") {
      handleInputChange(index, field === "start" ? "profile_wish_start" : "profile_wish_end", value);
      return;
    }
    const { date, time } = parseDateTime(value);
    if (!date || !time) {
      handleInputChange(index, field === "start" ? "profile_wish_start" : "profile_wish_end", value);
      return;
    }
    const combinedDateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes());
    const startValue = wishes[index]?.profile_wish_start || "";
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
    handleInputChange(index, field === "start" ? "profile_wish_start" : "profile_wish_end", value);
  };

  // Parse bounty into amount and unit
  const parseBounty = (bounty) => {
    if (!bounty || bounty.trim() === "") {
      return { amount: "", unit: "" };
    }
    if (bounty.toLowerCase() === "free") {
      return { amount: "Free", unit: "" };
    }
    // Remove $ if present
    const cleaned = bounty.replace(/\$/g, "").trim();

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

  // Parse cost into amount and unit (same as parseBounty structure)
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

  // Handle cost amount change
  const handleCostAmountChange = (index, value) => {
    const updated = [...wishes];
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
    setWishes(updated);
  };

  // Apply final formatting when the cost input loses focus.
  // Allows the user to type partial decimal values before normalization.
  const handleCostAmountBlur = (index) => {
    const updated = [...wishes];
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
    setWishes(updated);
  };

  // Handle cost unit change (from dropdown)
  const handleCostUnitChange = (index, selectedItem) => {
    const updated = [...wishes];
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
    setWishes(updated);
  };

  // Handle bounty amount change
  const handleBountyAmountChange = (index, value) => {
    const updated = [...wishes];
    const currentBounty = updated[index].amount || "";
    const parsed = parseBounty(currentBounty);
    const newAmount = value.replace(/\$/g, "");

    // If amount is "Free", set bounty to "Free"
    if (newAmount.toLowerCase() === "free") {
      updated[index].amount = "Free";
    } else {
      if (parsed.unit === "total") {
        updated[index].amount = newAmount ? `${newAmount} total` : "total";
      } else if (parsed.unit) {
        updated[index].amount = `${newAmount}/${parsed.unit}`;
      } else {
        updated[index].amount = newAmount;
      }
    }
    setWishes(updated);
  };

  // Apply final formatting when the bounty amount input loses focus.
  // Keeps typing responsive and formats only after the user moves away.
  const handleBountyAmountBlur = (index) => {
    const updated = [...wishes];
    const currentBounty = updated[index].amount || "";
    const parsed = parseBounty(currentBounty);
    if (parsed.amount.toLowerCase() === "free") {
      return;
    }
    const formattedAmount = formatCostValue(parsed.amount);
    if (parsed.unit === "total") {
      updated[index].amount = formattedAmount ? `${formattedAmount} total` : "total";
    } else if (parsed.unit) {
      updated[index].amount = `${formattedAmount}/${parsed.unit}`;
    } else {
      updated[index].amount = formattedAmount;
    }
    setWishes(updated);
  };

  // Handle bounty unit change (from dropdown)
  const handleBountyUnitChange = (index, selectedItem) => {
    const updated = [...wishes];
    const currentBounty = updated[index].amount || "";
    const parsed = parseBounty(currentBounty);

    // If current amount is "Free", don't update
    if (parsed.amount.toLowerCase() === "free") {
      return;
    }

    // Combine amount and unit
    if (!selectedItem || !selectedItem.value) {
      updated[index].amount = parsed.amount;
    } else if (selectedItem.value === "total") {
      // For "total", don't add a leading /
      updated[index].amount = parsed.amount ? `${parsed.amount} total` : "total";
    } else {
      // For other units, add leading /
      updated[index].amount = `${parsed.amount}/${selectedItem.value}`;
    }
    setWishes(updated);
  };

  const toggleEntryVisibility = (index) => {
    const item = wishes[index];
    if (!item.isPublic && isSeekingVisibilityBlocked(item)) {
      Alert.alert(
        "Unavailable",
        "This seeking post is under moderation and cannot be made public until an admin approves it."
      );
      return;
    }
    const updated = [...wishes];
    updated[index].isPublic = !updated[index].isPublic;
    setWishes(updated);
  };

  const handleDateTimeChange = (index, field, mode, selectedDate) => {
    if (!selectedDate) {
      setActivePicker(null);
      return;
    }
    const updated = [...wishes];
    const currentValue = updated[index][field === "start" ? "profile_wish_start" : "profile_wish_end"] || "";
    const startValue = updated[index].profile_wish_start || "";
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
      updated[index][field === "start" ? "profile_wish_start" : "profile_wish_end"] = combined;
      setWishes(updated);
      setActivePicker({ index, field, mode: "time" }); // Open time picker next
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
      updated[index][field === "start" ? "profile_wish_start" : "profile_wish_end"] = combined;
      setWishes(updated);
      setActivePicker(null);
    }
  };

  const getPickerValue = (index, field) => {
    const value = wishes[index]?.[field === "start" ? "profile_wish_start" : "profile_wish_end"] || "";
    const { date, time } = parseDateTime(value);
    const defaultDate = new Date();
    const defaultTime = new Date(2000, 0, 1, 9, 0);
    if (activePicker?.mode === "date") return date || defaultDate;
    // For time picker, return a Date with today's date + the time (DateTimePicker uses time part)
    const d = date || defaultDate;
    const t = time || defaultTime;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.getHours(), t.getMinutes());
  };

  return (
    <View style={styles.sectionContainer}>
      <View ref={sectionHeaderRef} collapsable={false} style={styles.headerRow}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, darkMode && styles.labelDark]}>Seeking</Text>
          {!showForm ? (
            <TouchableOpacity onPress={addWish} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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

      {wishes.length === 0 && !showForm ? (
        <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No seeking posts added yet.</Text>
      ) : null}

      {wishes.map((item, index) => {
        const isEditing = showForm && editingIndex === index;
        return (
        <View
          key={item.profile_wish_uid || `seeking-${index}`}
          ref={(ref) => {
            if (ref) cardRefs.current[index] = ref;
          }}
          style={[styles.listItemWrapper, index > 0 && styles.listItemSpacing]}
        >
          {!isEditing ? (
            <ProfileSeekingListCard
              item={item}
              profileUid={profileUid}
              darkMode={darkMode}
              onEdit={() => startEditSeeking(index)}
              onDelete={() => deleteWish(index)}
            />
          ) : null}

          {isEditing ? (
          <View style={styles.livePreviewBlock}>
          <View style={styles.previewSection}>
            <Text style={[styles.previewLabel, darkMode && styles.previewLabelDark]}>Customer preview</Text>
            <ProfileSeekingListCard item={item} profileUid={profileUid} darkMode={darkMode} showActions={false} showModerationBanner={false} />
          </View>

          <View style={[formStyles.container, formStyles.containerAfterPreview, darkMode && formStyles.darkContainer]}>
          <View style={[formStyles.titleBar, darkMode && formStyles.darkTitleBar]}>
            <Text style={[formStyles.titleText, darkMode && formStyles.darkTitleText]}>
              {editSnapshotRef.current ? `Edit Seeking #${index + 1}` : "Add New Seeking"}
            </Text>
            <View style={styles.titleBarActions}>
              <View style={styles.toggleContainer}>
                <TouchableOpacity onPress={() => toggleEntryVisibility(index)} style={[styles.togglePill, item.isPublic && styles.togglePillActiveGreen]}>
                  <Text style={[styles.togglePillText, item.isPublic && styles.togglePillTextActive]}>{item.isPublic ? "Visible" : "Show"}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggleEntryVisibility(index)} style={[styles.togglePill, !item.isPublic && styles.togglePillActiveRed]}>
                  <Text style={[styles.togglePillText, !item.isPublic && styles.togglePillTextActive]}>{!item.isPublic ? "Hidden" : "Hide"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <SeekingModerationBanner item={item} darkMode={darkMode} compact />

          <View style={formStyles.topRow}>
            <ProfileItemImageColumn
              darkMode={darkMode}
              defaultSection='seeking'
              accentColor={SEEKING_FORM_ACCENT}
              displayUri={getWishDisplayUri(item)}
              imageError={!!item._wishImageError}
              onImageError={() => handleInputChange(index, "_wishImageError", true)}
              toolsVisible={item.profile_wish_image_is_public === 1 || item.profile_wish_image_is_public === "1" || item.profile_wish_image_is_public === true}
              onShowTools={() => handleInputChange(index, "profile_wish_image_is_public", 1)}
              onHideTools={() => handleInputChange(index, "profile_wish_image_is_public", 0)}
              onUploadNative={() => pickWishImage(index)}
              onWebFileChange={(e) => handleWishWebImagePick(index, e)}
              onRemoveImage={() => removeWishImage(index)}
              showRemove={!!getWishDisplayUri(item)}
            />
            <View style={formStyles.detailsColumn}>
              <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Title</Text>
              <TextInput
                style={[
                  formStyles.fieldInput,
                  darkMode && formStyles.darkFieldInput,
                  !String(item.helpNeeds || "").trim() && formStyles.fieldInputError,
                ]}
                placeholder='Seeking Title *'
                placeholderTextColor={darkMode ? "#888" : "#999"}
                value={item.helpNeeds}
                onChangeText={(text) => handleInputChange(index, "helpNeeds", text)}
              />
              <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel, { marginTop: 10 }]}>Description</Text>
              <TextInput
                style={[
                  formStyles.fieldInput,
                  formStyles.descriptionInput,
                  darkMode && formStyles.darkFieldInput,
                  !String(item.details || "").trim() && formStyles.fieldInputError,
                ]}
                placeholder='Description *'
                placeholderTextColor={darkMode ? "#888" : "#999"}
                value={item.details}
                onChangeText={(text) => handleInputChange(index, "details", text)}
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
                            const { date } = parseDateTime(item.profile_wish_start || "");
                            return date ? formatDateForDisplay(date) : "Date";
                          })()}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[formStyles.dateTimeButton, darkMode && formStyles.darkDateTimeButton]}
                        onPress={() => {
                          const { date, time } = parseDateTime(item.profile_wish_start || "");
                          if (!date) setActivePicker({ index, field: "start", mode: "date" });
                          else setActivePicker({ index, field: "start", mode: "time" });
                        }}
                      >
                        <Text style={[formStyles.dateTimeButtonText, darkMode && formStyles.darkDateTimeButtonText]}>
                          {(() => {
                            const { time } = parseDateTime(item.profile_wish_start || "");
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
                        value={toDateTimeLocalValue(item.profile_wish_start || "")}
                        onChange={(e) => handleDateTimeInputChange(index, "start", fromDateTimeLocalValue(e.target.value))}
                      />
                    </View>
                  ) : (
                    <TextInput
                      style={[formStyles.fieldInput, darkMode && formStyles.darkFieldInput, { flex: 1 }]}
                      placeholder='mm-dd-yyyy hh:mm'
                      placeholderTextColor={darkMode ? "#888" : "#999"}
                      value={item.profile_wish_start ? formatDateTimeForDisplay(item.profile_wish_start) : ""}
                      onChangeText={(text) => handleInputChange(index, "profile_wish_start", text)}
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
                            const { date } = parseDateTime(item.profile_wish_end || "");
                            return date ? formatDateForDisplay(date) : "Date";
                          })()}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[formStyles.dateTimeButton, darkMode && formStyles.darkDateTimeButton]}
                        onPress={() => {
                          const { date, time } = parseDateTime(item.profile_wish_end || "");
                          if (!date) setActivePicker({ index, field: "end", mode: "date" });
                          else setActivePicker({ index, field: "end", mode: "time" });
                        }}
                      >
                        <Text style={[formStyles.dateTimeButtonText, darkMode && formStyles.darkDateTimeButtonText]}>
                          {(() => {
                            const { time } = parseDateTime(item.profile_wish_end || "");
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
                        value={toDateTimeLocalValue(item.profile_wish_end || "")}
                        onChange={(e) => handleDateTimeInputChange(index, "end", fromDateTimeLocalValue(e.target.value))}
                      />
                    </View>
                  ) : (
                    <TextInput
                      style={[formStyles.fieldInput, darkMode && formStyles.darkFieldInput, { flex: 1 }]}
                      placeholder='mm-dd-yyyy hh:mm'
                      placeholderTextColor={darkMode ? "#888" : "#999"}
                      value={item.profile_wish_end ? formatDateTimeForDisplay(item.profile_wish_end) : ""}
                      onChangeText={(text) => handleInputChange(index, "profile_wish_end", text)}
                    />
                  )}
                </View>
              </View>
            </View>
            <View style={formStyles.fieldStack}>
              <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Mode</Text>
              <View style={formStyles.modeRow}>
                {(() => {
                  const { virtual, delivered, inPerson } = parseExpertiseModeFlags(item.profile_wish_mode);
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
                        onPress={() => toggleWishMode(index, "virtual")}
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
                          delivered && formStyles.choiceBtnActive,
                          darkMode && delivered && formStyles.darkChoiceBtnActive,
                        ]}
                        onPress={() => toggleWishMode(index, "delivered")}
                      >
                        <Text
                          style={[
                            formStyles.choiceBtnText,
                            darkMode && formStyles.darkChoiceBtnText,
                            delivered && formStyles.choiceBtnTextActive,
                            darkMode && delivered && formStyles.darkChoiceBtnTextActive,
                          ]}
                        >
                          Delivered
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
                        onPress={() => toggleWishMode(index, "inPerson")}
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
            {parseExpertiseModeFlags(item.profile_wish_mode).inPerson ? (
              <>
                <View style={formStyles.fieldStack}>
                  <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Pickup address</Text>
                  {renderWishAddressField(index, item)}
                </View>
                <View style={formStyles.fieldRow}>
                  <View style={formStyles.fieldHalf}>
                    <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>City</Text>
                    <TextInput
                      style={[formStyles.fieldInput, darkMode && formStyles.darkFieldInput]}
                      placeholder='City'
                      placeholderTextColor={darkMode ? "#cccccc" : "#999999"}
                      value={item.profile_wish_city || ""}
                      onChangeText={(text) => handleInputChange(index, "profile_wish_city", text)}
                    />
                  </View>
                  <View style={formStyles.fieldHalf}>
                    <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>State</Text>
                    <TextInput
                      style={[formStyles.fieldInput, darkMode && formStyles.darkFieldInput]}
                      placeholder='State'
                      placeholderTextColor={darkMode ? "#cccccc" : "#999999"}
                      value={item.profile_wish_state || ""}
                      onChangeText={(text) => handleInputChange(index, "profile_wish_state", text)}
                    />
                  </View>
                </View>
                <View style={formStyles.fieldRow}>
                  <View style={formStyles.fieldHalf}>
                    <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Zip</Text>
                    <TextInput
                      style={[formStyles.fieldInput, darkMode && formStyles.darkFieldInput]}
                      placeholder='Zip'
                      placeholderTextColor={darkMode ? "#cccccc" : "#999999"}
                      value={item.profile_wish_zip || ""}
                      onChangeText={(text) => handleInputChange(index, "profile_wish_zip", text)}
                      keyboardType='number-pad'
                      autoCorrect={false}
                    />
                  </View>
                </View>
              </>
            ) : null}
          </View>

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

          <View style={[formStyles.sectionDivider, darkMode && formStyles.darkSectionDivider]} />

          <View style={formStyles.section}>
            <Text style={[formStyles.sectionTitle, darkMode && formStyles.darkSectionTitle]}>Pricing</Text>
            <View style={formStyles.pricingGrid}>
              <View style={formStyles.pricingCol}>
                <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel]}>Cost</Text>
                <View style={formStyles.inlineControls}>
                  <TextInput
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
                  />
                </View>
                <Text style={[formStyles.fieldLabel, darkMode && formStyles.darkFieldLabel, { marginTop: 10 }]}>Quantity</Text>
                <TextInput
                  style={[formStyles.fieldInput, darkMode && formStyles.darkFieldInput]}
                  placeholder='Count'
                  placeholderTextColor={darkMode ? "#888" : "#999"}
                  keyboardType='numeric'
                  value={item.profile_wish_quantity || ""}
                  onChangeText={(text) => handleInputChange(index, "profile_wish_quantity", text.replace(/\D/g, ""))}
                />
              </View>

              <View style={formStyles.pricingCol}>
                <View style={styles.bountyFieldLabelRow}>
                  <Text style={[formStyles.fieldLabel, styles.bountyFieldLabelInRow, darkMode && formStyles.darkFieldLabel]}>Bounty</Text>
                  <BountyInfoTooltip perspective='seller' darkMode={darkMode} />
                </View>
                <View style={formStyles.inlineControls}>
                  <Dropdown
                    style={[formStyles.dropdown, formStyles.bountyTypeDropdown, darkMode && formStyles.darkDropdown]}
                    data={PROFILE_BOUNTY_TYPE_OPTIONS}
                    labelField='label'
                    valueField='value'
                    value={item.profile_wish_bounty_type || "none"}
                    onChange={(selected) => handleSeekingBountyTypeChange(index, selected)}
                    containerStyle={[formStyles.dropdownContainer, darkMode && formStyles.darkDropdownContainer]}
                    itemTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 13 }}
                    selectedTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 13 }}
                    activeColor={darkMode ? "#404040" : "#f0f0f0"}
                    maxHeight={160}
                    flatListProps={{ nestedScrollEnabled: true }}
                  />
                  {item.profile_wish_bounty_type !== "none" ? (
                    <TextInput
                      ref={(ref) => {
                        if (ref) bountyInputRefs.current[index] = ref;
                      }}
                      style={[formStyles.fieldInput, formStyles.inlineAmountInput, darkMode && formStyles.darkFieldInput]}
                      value={(() => {
                        const parsed = parseBounty(item.amount);
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
          </View>

          <View style={styles.formFooterButtons}>
            <TouchableOpacity style={[styles.formCancelButton, darkMode && styles.formCancelButtonDark]} onPress={cancelEditSeeking} activeOpacity={0.8}>
              <Text style={[styles.formCancelButtonText, darkMode && styles.formCancelButtonTextDark]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.formDoneButton, darkMode && styles.formDoneButtonDark]} onPress={doneEditSeeking} activeOpacity={0.8}>
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
  bountyFieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
    zIndex: 2,
  },
  bountyFieldLabelInRow: {
    marginBottom: 0,
  },
  label: { fontSize: 18, fontWeight: "bold" },
  labelDark: { color: "#fff" },
  addText: { color: "#000000", fontWeight: "bold", fontSize: 24 },
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
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
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

export const validateSeeking = (wishes) => {
  return (wishes || []).every((w) => {
    const hasTitle = !!String(w.helpNeeds || "").trim();
    const hasDescription = !!String(w.details || "").trim();
    const hasUnit = !!(w.cost && w.cost.match(/\/(hr|day|week|2 weeks|month|quarter|year|each)$|(\btotal\b)/i));
    // Skip blank placeholder entries (Seeking seeds one empty card when the user has none).
    if (!hasTitle && !hasDescription && !String(w.cost || "").trim()) return true;
    return hasTitle && hasDescription && hasUnit;
  });
};

export default SeekingSection;
