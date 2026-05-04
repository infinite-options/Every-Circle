import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Platform, Alert } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { formatCostValue } from "../utils/priceUtils";

// DateTimePicker only works on native (not web)
let DateTimePicker = null;
if (Platform.OS !== "web") {
  try {
    DateTimePicker = require("@react-native-community/datetimepicker").default;
  } catch (e) {
    console.warn("DateTimePicker not available:", e.message);
  }
}

// Convert our format "YYYY-MM-DD HH:mm" to HTML5 datetime-local format "YYYY-MM-DDTHH:mm"
const toDateTimeLocalValue = (value) => {
  if (!value || typeof value !== "string" || value.trim() === "") return "";
  return value.trim().replace(" ", "T").substring(0, 16); // Ensure we have at most YYYY-MM-DDTHH:mm
};

// Convert HTML5 datetime-local format to our format
const fromDateTimeLocalValue = (value) => {
  if (!value || typeof value !== "string" || value.trim() === "") return "";
  return value.trim().replace("T", " ").substring(0, 16);
};

const formatDateForDisplay = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${m}-${d}-${y}`;
};

const formatTimeForDisplay = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "";
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
};

// Display stored "YYYY-MM-DD HH:mm" as "mm-dd-yyyy hh:mm"
const formatDateTimeForDisplay = (value) => {
  if (!value || typeof value !== "string" || value.trim() === "") return "";
  const { date, time } = parseDateTime(value);
  if (!date || !time) return value;
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const y = date.getFullYear();
  const h = String(time.getHours()).padStart(2, "0");
  const min = String(time.getMinutes()).padStart(2, "0");
  return `${m}-${d}-${y} ${h}:${min}`;
};

// Validation: start date must be today or after (if today, time must not be in the past)
const isStartDateValid = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getTime() >= now.getTime();
};

// Validation: end date must be after start date
const isEndDateValid = (endDateTime, startValue) => {
  if (!endDateTime || !(endDateTime instanceof Date) || isNaN(endDateTime.getTime())) return false;
  if (!startValue || typeof startValue !== "string" || startValue.trim() === "") return true; // No start set, allow any end
  const { date: startDate, time: startTime } = parseDateTime(startValue);
  if (!startDate || !startTime) return true;
  const startDateTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), startTime.getHours(), startTime.getMinutes());
  return endDateTime.getTime() > startDateTime.getTime();
};

const parseDateTime = (value) => {
  if (!value || typeof value !== "string" || value.trim() === "") return { date: null, time: null };
  const trimmed = value.trim();
  // Try "YYYY-MM-DD HH:mm" or "YYYY-MM-DDTHH:mm" (ISO)
  const spaceMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/);
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{1,2}):(\d{2})/);
  const match = spaceMatch || isoMatch;
  if (match) {
    const [, y, m, d, h, min] = match;
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    const time = new Date(2000, 0, 1, parseInt(h, 10), parseInt(min, 10));
    return { date, time };
  }
  // Try date only "YYYY-MM-DD"
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    return { date, time: new Date(2000, 0, 1, 9, 0) }; // default 09:00
  }
  return { date: null, time: null };
};

const combineDateTime = (date, time) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = time && time instanceof Date && !isNaN(time.getTime()) ? String(time.getHours()).padStart(2, "0") : "00";
  const min = time && time instanceof Date && !isNaN(time.getTime()) ? String(time.getMinutes()).padStart(2, "0") : "00";
  return `${y}-${m}-${d} ${h}:${min}`;
};

const SeekingSection = ({ wishes, setWishes, toggleVisibility, isPublic, handleDelete, onInputFocus }) => {
  // Stores each rendered card's ref by index so parent can scroll to the new one.
  const cardRefs = useRef({});
  // Tracks which index was just added via "+".
  const pendingNewIndexRef = useRef(null);
  const bountyInputRefs = useRef({});
  const [activePicker, setActivePicker] = useState(null); // { index, field: 'start'|'end', mode: 'date'|'time' }
  // Bounty unit options for dropdown
  const bountyUnitOptions = [
    { label: "total", value: "total" },
    { label: "/hr", value: "hr" },
    { label: "/day", value: "day" },
    { label: "/week", value: "week" },
    { label: "/2 weeks", value: "2 weeks" },
    { label: "/month", value: "month" },
    { label: "/quarter", value: "quarter" },
    { label: "/year", value: "year" },
  ];

  const addWish = () => {
    // Mark the next card index before state update, then notify parent after render.
    pendingNewIndexRef.current = wishes.length;
    const newEntry = {
      helpNeeds: "",
      details: "",
      amount: "",
      cost: "",
      profile_wish_start: "",
      profile_wish_end: "",
      profile_wish_location: "",
      profile_wish_mode: "",
      isPublic: true,
    };
    setWishes([...wishes, newEntry]);
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
  }, [wishes.length, onInputFocus]);

  const deleteWish = (index) => {
    handleDelete(index);
  };

  const handleInputChange = (index, field, value) => {
    const updated = [...wishes];
    updated[index][field] = value;
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
      <View style={styles.headerRow}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Seeking</Text>
          <TouchableOpacity onPress={addWish}>
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

      {wishes.map((item, index) => (
        <View
          key={index}
          ref={(ref) => {
            // Capture each card ref for new-card scroll targeting.
            if (ref) cardRefs.current[index] = ref;
          }}
          style={[styles.card, index > 0 && styles.cardSpacing]}
        >
          <View style={styles.rowHeader}>
            <Text style={styles.label}>Seeking #{index + 1}</Text>
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

          <TextInput style={styles.input} placeholder='Seeking Title' value={item.helpNeeds} onChangeText={(text) => handleInputChange(index, "helpNeeds", text)} />
          <TextInput
            style={styles.descriptionInput}
            placeholder='Description'
            value={item.details}
            onChangeText={(text) => handleInputChange(index, "details", text)}
            multiline={true}
            textAlignVertical='top'
            scrollEnabled={false}
          />

          {/* Start Date/Time, End Date/Time, Location */}
          <View style={styles.dateTimeSection}>
            <View style={styles.dateTimeRow}>
              <Text style={styles.dateTimeLabel}>Start Date and Time</Text>
              {DateTimePicker ? (
                <>
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => setActivePicker({ index, field: "start", mode: "date" })}
                  >
                    <Text style={styles.dateTimeButtonText}>
                      {(() => {
                        const { date } = parseDateTime(item.profile_wish_start || "");
                        return date ? formatDateForDisplay(date) : "Date";
                      })()}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => {
                      const { date, time } = parseDateTime(item.profile_wish_start || "");
                      if (!date) setActivePicker({ index, field: "start", mode: "date" });
                      else setActivePicker({ index, field: "start", mode: "time" });
                    }}
                  >
                    <Text style={styles.dateTimeButtonText}>
                      {(() => {
                        const { time } = parseDateTime(item.profile_wish_start || "");
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
                    value={toDateTimeLocalValue(item.profile_wish_start || "")}
                    onChange={(e) => handleDateTimeInputChange(index, "start", fromDateTimeLocalValue(e.target.value))}
                  />
                </View>
              ) : (
                <TextInput
                  style={styles.dateTimeTextInput}
                  placeholder="mm-dd-yyyy hh:mm"
                  value={item.profile_wish_start ? formatDateTimeForDisplay(item.profile_wish_start) : ""}
                  onChangeText={(text) => handleInputChange(index, "profile_wish_start", text)}
                />
              )}
            </View>
            <View style={styles.dateTimeRow}>
              <Text style={styles.dateTimeLabel}>End Date and Time</Text>
              {DateTimePicker ? (
                <>
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => setActivePicker({ index, field: "end", mode: "date" })}
                  >
                    <Text style={styles.dateTimeButtonText}>
                      {(() => {
                        const { date } = parseDateTime(item.profile_wish_end || "");
                        return date ? formatDateForDisplay(date) : "Date";
                      })()}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => {
                      const { date, time } = parseDateTime(item.profile_wish_end || "");
                      if (!date) setActivePicker({ index, field: "end", mode: "date" });
                      else setActivePicker({ index, field: "end", mode: "time" });
                    }}
                  >
                    <Text style={styles.dateTimeButtonText}>
                      {(() => {
                        const { time } = parseDateTime(item.profile_wish_end || "");
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
                    value={toDateTimeLocalValue(item.profile_wish_end || "")}
                    onChange={(e) => handleDateTimeInputChange(index, "end", fromDateTimeLocalValue(e.target.value))}
                  />
                </View>
              ) : (
                <TextInput
                  style={styles.dateTimeTextInput}
                  placeholder="mm-dd-yyyy hh:mm"
                  value={item.profile_wish_end ? formatDateTimeForDisplay(item.profile_wish_end) : ""}
                  onChangeText={(text) => handleInputChange(index, "profile_wish_end", text)}
                />
              )}
            </View>
            <View style={styles.dateTimeRow}>
              <Text style={styles.dateTimeLabel}>Location</Text>
              <TextInput
                style={styles.locationInput}
                placeholder='Location'
                value={item.profile_wish_location || ""}
                onChangeText={(text) => handleInputChange(index, "profile_wish_location", text)}
              />
            </View>
            <View style={styles.dateTimeRow}>
              <Text style={styles.dateTimeLabel}>Mode</Text>
              <View style={styles.modeCheckboxRow}>
                <TouchableOpacity
                  style={[styles.modeCheckbox, (item.profile_wish_mode || "").toLowerCase() === "virtual" && styles.modeCheckboxSelected]}
                  onPress={() => handleInputChange(index, "profile_wish_mode", item.profile_wish_mode === "Virtual" ? "" : "Virtual")}
                >
                  <Text style={[styles.modeCheckboxText, (item.profile_wish_mode || "").toLowerCase() === "virtual" && styles.modeCheckboxTextSelected]}>
                    Virtual
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeCheckbox, (item.profile_wish_mode || "").toLowerCase() === "in-person" && styles.modeCheckboxSelected]}
                  onPress={() => handleInputChange(index, "profile_wish_mode", item.profile_wish_mode === "In-Person" ? "" : "In-Person")}
                >
                  <Text style={[styles.modeCheckboxText, (item.profile_wish_mode || "").toLowerCase() === "in-person" && styles.modeCheckboxTextSelected]}>
                    In-Person
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* DateTimePicker - only render when this wish's picker is active */}
          {DateTimePicker &&
            activePicker &&
            activePicker.index === index && (
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

          {/*Cost Row*/}
          <View style={styles.amountRow}>
  <Text style={styles.costLabel}>Cost</Text>
  <TextInput
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
    onBlur={() => handleCostAmountBlur(index)}
  />
  <Dropdown
    style={[styles.costUnitDropdown, !parseCost(item.cost).unit && styles.requiredDropdown]}
    data={bountyUnitOptions}
    labelField='label'
    valueField='value'
    placeholder='Unit *'
    placeholderStyle={{ color: '#f44336', fontSize: 14 }}
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
      const parsed = parseBounty(item.amount);
      const amount = parsed.amount;
      if (!amount) return "";
      if (amount.toLowerCase() === "free") return "Free";
      return `$${amount}`;
    })()}
    onChangeText={(text) => {
      const cleanedText = text.replace(/\$/g, "");
      handleBountyAmountChange(index, cleanedText);
    }}
    onBlur={() => handleBountyAmountBlur(index)}
  />
  <TouchableOpacity onPress={() => deleteWish(index)}>
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
  label: { fontSize: 18, fontWeight: "bold" },
  addText: { color: "#000000", fontWeight: "bold", fontSize: 24 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10, // spacing between label and +
  },
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
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
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 5,
  },
  dollar: { fontSize: 20, marginRight: 8 },
  amountInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#fff",
    width: "70%",
  },
  bountyAmountInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#fff",
    width: "40%",
    height: 40,
    textAlignVertical: "center",
  },
  bountyUnitDropdown: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    backgroundColor: "#fff",
    width: "25%",
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
  deleteIcon: { width: 20, height: 20 },
  cardSpacing: {
    marginTop: 16,
  },
  
  costInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#fff",
    flex: 1,
    marginRight: 12,
    height: 40,
  },
  bountyLabel: {
    fontSize: 16,
    marginRight: 8,
  },
  
  costLabel: {
    fontWeight: "bold",
    marginRight: 5,
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
  dollar: { 
    fontSize: 20, 
    marginHorizontal: 5 
  },
  bountyInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#fff",
    width: "20%",
    height: 40,
    textAlignVertical: "center",
  },
  toggleContainer: { flexDirection: "row", gap: 4 },
  togglePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: "transparent" },
  togglePillActiveGreen: { backgroundColor: "#4CAF50" },
  togglePillActiveRed: { backgroundColor: "#ef9a9a" },
  togglePillText: { fontSize: 13, color: "#4e4e4e", fontWeight: "500" },
  togglePillTextActive: { color: "#fff", fontWeight: "bold" },
});

export const validateSeeking = (wishes) => {
  return wishes.every((w) => {
    if (!w.helpNeeds) return true; // skip empty entries
    const unit = w.cost ? w.cost.match(/\/(hr|day|week|2 weeks|month|quarter|year)$|(\btotal\b)/i) : null;
    return !!unit;
  });
};

export default SeekingSection;
