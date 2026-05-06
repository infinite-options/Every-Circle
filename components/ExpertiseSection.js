import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Platform, Alert } from "react-native";
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

let DateTimePicker = null;
if (Platform.OS !== "web") {
  try {
    DateTimePicker = require("@react-native-community/datetimepicker").default;
  } catch (e) {
    console.warn("DateTimePicker not available:", e.message);
  }
}

const ExpertiseSection = ({ expertise, setExpertise, toggleVisibility, isPublic, handleDelete, onInputFocus, profileUid = "", darkMode = false }) => {
  // Stores each rendered card's ref by index so parent can scroll to the new one.
  const cardRefs = useRef({});
  // Tracks which index was just added via "+".
  const pendingNewIndexRef = useRef(null);
  const costInputRefs = useRef({});
  const [activePicker, setActivePicker] = useState(null); // { index, field: 'start'|'end', mode: 'date'|'time' }
  // Cost unit options for dropdown
  const costUnitOptions = [
    { label: "total", value: "total" },
    { label: "/hr", value: "hr" },
    { label: "/day", value: "day" },
    { label: "/week", value: "week" },
    { label: "/2 weeks", value: "2 weeks" },
    { label: "/month", value: "month" },
    { label: "/quarter", value: "quarter" },
    { label: "/year", value: "year" },
  ];

  const addExpertise = () => {
    // Mark the next card index before state update, then notify parent after render.
    pendingNewIndexRef.current = expertise.length;
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
      profile_expertise_mode: "",
      isPublic: true,
      _expNewImageUri: "",
      _expWebImageFile: null,
      _expOriginalImage: "",
      _expDeleteImageUrl: "",
      _expImageError: false,
    };
    setExpertise([...expertise, newEntry]);
  };

  useEffect(() => {
    // After add + render, pass the new card ref up so parent can auto-scroll.
    const index = pendingNewIndexRef.current;
    if (index === null || index === undefined) return;
    const newCardRef = cardRefs.current[index];
    if (!newCardRef) return;
    setTimeout(() => {
      onInputFocus?.(newCardRef);
      pendingNewIndexRef.current = null;
    }, 100);
  }, [expertise.length, onInputFocus]);

  const deleteExpertise = (index) => {
    handleDelete(index);
  };

  const handleInputChange = (index, field, value) => {
    const updated = [...expertise];
    updated[index][field] = value;
    setExpertise(updated);
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
      <View style={styles.headerRow}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Offering</Text>
          <TouchableOpacity onPress={addExpertise}>
            <Text style={styles.addText}>+</Text>
          </TouchableOpacity>
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

      {expertise.map((item, index) => (
        <View
          key={index}
          ref={(ref) => {
            // Capture each card ref for new-card scroll targeting.
            if (ref) cardRefs.current[index] = ref;
          }}
          style={[styles.card, index > 0 && styles.cardSpacing]}
        >
          <View style={styles.rowHeader}>
            <Text style={styles.label}>Offering #{index + 1}</Text>
            <View style={styles.toggleContainer}>
                          <TouchableOpacity
                            onPress={() => toggleEntryVisibility(index)}
                            style={[styles.togglePill, item.isPublic && styles.togglePillActiveGreen]}
                          >
                            <Text style={[styles.togglePillText, item.isPublic && styles.togglePillTextActive]}>{item.isPublic ? "Visible" : "Show"}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => toggleEntryVisibility(index)}
                            style={[styles.togglePill, !item.isPublic && styles.togglePillActiveRed]}
                          >
                            <Text style={[styles.togglePillText, !item.isPublic && styles.togglePillTextActive]}>{!item.isPublic ? "Hidden" : "Hide"}</Text>
                          </TouchableOpacity>
                        </View>
          </View>

          <View style={[styles.miniCard, darkMode && styles.miniCardDark]}>
            <ProfileItemImageColumn
              darkMode={darkMode}
              displayUri={getExpertiseDisplayUri(item)}
              imageError={!!item._expImageError}
              onImageError={() => handleInputChange(index, "_expImageError", true)}
              toolsVisible={
                item.profile_expertise_image_is_public === 1 ||
                item.profile_expertise_image_is_public === "1" ||
                item.profile_expertise_image_is_public === true
              }
              onShowTools={() => handleInputChange(index, "profile_expertise_image_is_public", 1)}
              onHideTools={() => handleInputChange(index, "profile_expertise_image_is_public", 0)}
              onUploadNative={() => pickExpertiseImage(index)}
              onWebFileChange={(e) => handleExpertiseWebImagePick(index, e)}
              onRemoveImage={() => removeExpertiseImage(index)}
              showRemove={!!getExpertiseDisplayUri(item)}
            />
            <View style={styles.miniCardFields}>
              <TextInput style={styles.input} placeholder='Expertise Name' value={item.name} onChangeText={(text) => handleInputChange(index, "name", text)} />
              <TextInput
                style={styles.descriptionInput}
                placeholder='Description'
                value={item.description}
                onChangeText={(text) => handleInputChange(index, "description", text)}
                multiline={true}
                textAlignVertical='top'
                scrollEnabled={false}
              />
            </View>
          </View>

          <View style={styles.dateTimeSection}>
            <View style={styles.dateTimeRow}>
              <Text style={styles.dateTimeLabel}>Start Date and Time</Text>
              {DateTimePicker ? (
                <>
                  <TouchableOpacity style={styles.dateTimeButton} onPress={() => setActivePicker({ index, field: "start", mode: "date" })}>
                    <Text style={styles.dateTimeButtonText}>
                      {(() => {
                        const { date } = parseDateTime(item.profile_expertise_start || "");
                        return date ? formatDateForDisplay(date) : "Date";
                      })()}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => {
                      const { date, time } = parseDateTime(item.profile_expertise_start || "");
                      if (!date) setActivePicker({ index, field: "start", mode: "date" });
                      else setActivePicker({ index, field: "start", mode: "time" });
                    }}
                  >
                    <Text style={styles.dateTimeButtonText}>
                      {(() => {
                        const { time } = parseDateTime(item.profile_expertise_start || "");
                        return time ? formatTimeForDisplay(time) : "Time";
                      })()}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : Platform.OS === "web" ? (
                <View style={styles.webDateTimeInputWrapper}>
                  <input
                    type="datetime-local"
                    style={styles.webDateTimeInput}
                    value={toDateTimeLocalValue(item.profile_expertise_start || "")}
                    onChange={(e) => handleDateTimeInputChange(index, "start", fromDateTimeLocalValue(e.target.value))}
                  />
                </View>
              ) : (
                <TextInput
                  style={styles.dateTimeTextInput}
                  placeholder="mm-dd-yyyy hh:mm"
                  value={item.profile_expertise_start ? formatDateTimeForDisplay(item.profile_expertise_start) : ""}
                  onChangeText={(text) => handleInputChange(index, "profile_expertise_start", text)}
                />
              )}
            </View>
            <View style={styles.dateTimeRow}>
              <Text style={styles.dateTimeLabel}>End Date and Time</Text>
              {DateTimePicker ? (
                <>
                  <TouchableOpacity style={styles.dateTimeButton} onPress={() => setActivePicker({ index, field: "end", mode: "date" })}>
                    <Text style={styles.dateTimeButtonText}>
                      {(() => {
                        const { date } = parseDateTime(item.profile_expertise_end || "");
                        return date ? formatDateForDisplay(date) : "Date";
                      })()}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => {
                      const { date, time } = parseDateTime(item.profile_expertise_end || "");
                      if (!date) setActivePicker({ index, field: "end", mode: "date" });
                      else setActivePicker({ index, field: "end", mode: "time" });
                    }}
                  >
                    <Text style={styles.dateTimeButtonText}>
                      {(() => {
                        const { time } = parseDateTime(item.profile_expertise_end || "");
                        return time ? formatTimeForDisplay(time) : "Time";
                      })()}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : Platform.OS === "web" ? (
                <View style={styles.webDateTimeInputWrapper}>
                  <input
                    type="datetime-local"
                    style={styles.webDateTimeInput}
                    value={toDateTimeLocalValue(item.profile_expertise_end || "")}
                    onChange={(e) => handleDateTimeInputChange(index, "end", fromDateTimeLocalValue(e.target.value))}
                  />
                </View>
              ) : (
                <TextInput
                  style={styles.dateTimeTextInput}
                  placeholder="mm-dd-yyyy hh:mm"
                  value={item.profile_expertise_end ? formatDateTimeForDisplay(item.profile_expertise_end) : ""}
                  onChangeText={(text) => handleInputChange(index, "profile_expertise_end", text)}
                />
              )}
            </View>
            <View style={styles.dateTimeRow}>
              <Text style={styles.dateTimeLabel}>Location</Text>
              <TextInput
                style={styles.locationInput}
                placeholder="Location"
                value={item.profile_expertise_location || ""}
                onChangeText={(text) => handleInputChange(index, "profile_expertise_location", text)}
              />
            </View>
            <View style={styles.dateTimeRow}>
              <Text style={styles.dateTimeLabel}>Mode</Text>
              <View style={styles.modeCheckboxRow}>
                <TouchableOpacity
                  style={[styles.modeCheckbox, (item.profile_expertise_mode || "").toLowerCase() === "virtual" && styles.modeCheckboxSelected]}
                  onPress={() => handleInputChange(index, "profile_expertise_mode", item.profile_expertise_mode === "Virtual" ? "" : "Virtual")}
                >
                  <Text style={[styles.modeCheckboxText, (item.profile_expertise_mode || "").toLowerCase() === "virtual" && styles.modeCheckboxTextSelected]}>
                    Virtual
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeCheckbox, (item.profile_expertise_mode || "").toLowerCase() === "in-person" && styles.modeCheckboxSelected]}
                  onPress={() => handleInputChange(index, "profile_expertise_mode", item.profile_expertise_mode === "In-Person" ? "" : "In-Person")}
                >
                  <Text style={[styles.modeCheckboxText, (item.profile_expertise_mode || "").toLowerCase() === "in-person" && styles.modeCheckboxTextSelected]}>
                    In-Person
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
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

          {/* Cost Row */}
          <View style={styles.amountRow}>
  <Text style={styles.costLabel}>Cost</Text>
  <TextInput
    ref={(ref) => {
      if (ref) costInputRefs.current[index] = ref;
    }}
    style={styles.costAmountInput}
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
    // Format cost only after editing is finished. This allows fluid typing of decimals without forcing formatting mid-edit.
    onBlur={() => handleCostAmountBlur(index)}
  />
  <Dropdown
    style={[styles.costUnitDropdown, !parseCost(item.cost).unit && styles.requiredDropdown]}
    data={costUnitOptions}
    labelField='label'
    valueField='value'
    placeholder='Unit *'
    placeholderStyle={{ color: '#f44336' }}
    value={parseCost(item.cost).unit || null}
    onChange={(item) => handleCostUnitChange(index, item)}
    containerStyle={styles.dropdownContainer}
    itemTextStyle={styles.dropdownItemText}
    selectedTextStyle={styles.dropdownSelectedText}
    activeColor='#f0f0f0'
  />
  <Text style={styles.dollar}>💰</Text>
  <TextInput
    style={styles.bountyInput}
    placeholder='Bounty'
    keyboardType='decimal-pad'
    value={(() => {
      const parsed = parseBounty(item.bounty);
      const amount = parsed.amount;
      if (!amount) return "";
      if (amount.toLowerCase() === "free") return "Free";
      return `$${amount}`;
    })()}
    onChangeText={(text) => {
      const cleanedText = text.replace(/\$/g, "");
      handleBountyAmountChange(index, cleanedText);
    }}
    // Format bounty only after editing is finished
    onBlur={() => handleBountyAmountBlur(index)}
  />
  <TextInput
    style={styles.bountyInput}
    placeholder="Qty"
    keyboardType="numeric"
    value={item.quantity || ""}
    onChangeText={(text) => handleInputChange(index, "quantity", text)}
  />
  <TouchableOpacity onPress={() => deleteExpertise(index)}>
    <Image source={require("../assets/delete.png")} style={styles.deleteIcon} />
  </TouchableOpacity>
          </View>
        </View>
      ))}
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
  label: { fontSize: 18, fontWeight: "bold" },
  addText: { fontSize: 24, fontWeight: "bold", color: "#000" },
  toggleText: { fontWeight: "bold" },
  card: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 10,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  miniCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  miniCardDark: {
    borderColor: "#404040",
    backgroundColor: "#2d2d2d",
  },
  miniCardFields: {
    flex: 1,
    minWidth: 0,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#fff",
    marginBottom: 5,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#fff",
    marginBottom: 5,
    minHeight: 40,
    maxHeight: 120,
  },
  dateTimeSection: {
    marginBottom: 10,
  },
  dateTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  dateTimeLabel: {
    fontSize: 14,
    fontWeight: "600",
    width: 140,
    minWidth: 140,
  },
  dateTimeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#fff",
    minHeight: 40,
    justifyContent: "center",
  },
  dateTimeButtonText: {
    fontSize: 14,
    color: "#333",
  },
  dateTimeTextInput: {
    flex: 2,
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#fff",
    minHeight: 40,
    fontSize: 14,
  },
  webDateTimeInputWrapper: {
    flex: 2,
    minWidth: 0,
  },
  webDateTimeInput: {
    width: "100%",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#fff",
    minHeight: 40,
    fontSize: 14,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    boxSizing: "border-box",
  },
  locationInput: {
    flex: 2,
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#fff",
    minHeight: 40,
    fontSize: 14,
  },
  modeCheckboxRow: {
    flex: 2,
    flexDirection: "row",
    gap: 12,
  },
  modeCheckbox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  modeCheckboxSelected: {
    borderColor: "#007AFF",
    backgroundColor: "#E8F4FD",
  },
  modeCheckboxText: {
    fontSize: 14,
    color: "#666",
  },
  modeCheckboxTextSelected: {
    color: "#007AFF",
    fontWeight: "600",
  },
  requiredDropdown: {
    borderColor: "#f44336",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 5,
  },
  costLabel: {
    fontWeight: "bold",
    marginRight: 5,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#fff",
    width: "45%",
  },
  costAmountInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#fff",
    width: "25%",
    height: 40,
    textAlignVertical: "center",
  },
  costUnitInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#fff",
    width: "15%",
    marginLeft: 5,
  },
  costUnitDropdown: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    backgroundColor: "#fff",
    width: "30%",
    marginLeft: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 40,
  },
  dropdownContainer: {
    borderRadius: 5,
    marginTop: 5,
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0px 2px 4px 0px rgba(0, 0, 0, 0.1)",
        }
      : {}),
  },
  dropdownItemText: {
    color: "#000",
    fontSize: 14,
  },
  dropdownSelectedText: {
    color: "#000",
    fontSize: 14,
  },
  bountyInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#fff",
    width: "20%",
    marginRight: 5,
  },
  dollar: { fontSize: 20, marginHorizontal: 5 },
  deleteIcon: { width: 20, height: 20 },
  cardSpacing: {
    marginTop: 16,
  },
  toggleContainer: { flexDirection: "row", gap: 4 },
  togglePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: "transparent" },
  togglePillActiveGreen: { backgroundColor: "#4CAF50" },
  togglePillActiveRed: { backgroundColor: "#ef9a9a" },
  togglePillText: { fontSize: 13, color: "#4e4e4e", fontWeight: "500" },
  togglePillTextActive: { color: "#fff", fontWeight: "bold" },
});

export const validateExpertise = (expertise) => {
  return expertise.every((e) => {
    if (!e.name) return true; // skip empty entries
    const unit = e.cost ? e.cost.match(/\/(hr|day|week|2 weeks|month|quarter|year)$|(\btotal\b)/i) : null;
    return !!unit;
  });
};
export default ExpertiseSection;
