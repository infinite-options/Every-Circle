// ScannedProfilePopup.js - Popup or full-screen form to connect with a scanned profile
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  ScrollView,
  useWindowDimensions,
  Alert,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDarkMode } from "../contexts/DarkModeContext";
import MiniCard from "./MiniCard";
import WebTextInput from "./WebTextInput";
import { parseDateTime } from "../utils/profileDateTime";

const REL_TYPES = ["friend", "colleague", "family"];

let DateTimePicker = null;
if (Platform.OS !== "web") {
  try {
    DateTimePicker = require("@react-native-community/datetimepicker").default;
  } catch (e) {
    console.warn("DateTimePicker not available:", e.message);
  }
}

/** Visible viewport height / keyboard inset — critical on iOS Safari where Keyboard events are unreliable. */
function useKeyboardAwareViewport(windowHeight, enabled) {
  const [visibleHeight, setVisibleHeight] = useState(windowHeight);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setVisibleHeight(windowHeight);
      setKeyboardOpen(false);
      return;
    }

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const update = () => {
        const vv = window.visualViewport;
        const nextH = vv?.height ?? window.innerHeight ?? windowHeight;
        setVisibleHeight(nextH);
        const layoutH = window.innerHeight || windowHeight;
        setKeyboardOpen(layoutH - nextH > 80);
      };
      update();
      window.visualViewport?.addEventListener?.("resize", update);
      window.visualViewport?.addEventListener?.("scroll", update);
      window.addEventListener?.("resize", update);
      return () => {
        window.visualViewport?.removeEventListener?.("resize", update);
        window.visualViewport?.removeEventListener?.("scroll", update);
        window.removeEventListener?.("resize", update);
      };
    }

    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e) => {
      const kb = e?.endCoordinates?.height || 0;
      setKeyboardOpen(kb > 0);
      setVisibleHeight(Math.max(200, windowHeight - kb));
    };
    const onHide = () => {
      setKeyboardOpen(false);
      setVisibleHeight(windowHeight);
    };
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    setVisibleHeight(windowHeight);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [windowHeight, enabled]);

  return { visibleHeight, keyboardOpen };
}

const getTodayCircleDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const formatCircleDateForDisplay = (dateStr) => {
  const { date } = parseDateTime(dateStr || "");
  if (!date) return "Select date";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

const circleDateToDate = (dateStr) => {
  const { date } = parseDateTime(dateStr || "");
  return date || new Date();
};

const dateToCircleDate = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return getTodayCircleDate();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const resolveInitialRelationship = (initialData) => {
  if (!initialData) return "friend";
  const r = initialData.relationship;
  if (r && REL_TYPES.includes(r)) return r;
  return null;
};

const normalizeConnectionField = (value) => String(value ?? "").trim();

const normalizeConnectionDate = (value) => {
  const trimmed = normalizeConnectionField(value);
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : trimmed;
};

const connectionFormHasChanges = (form, initialData) => {
  if (!initialData) return true;
  return (
    normalizeConnectionField(form.relationship) !== normalizeConnectionField(initialData.relationship) ||
    normalizeConnectionDate(form.date) !== normalizeConnectionDate(initialData.date) ||
    normalizeConnectionField(form.event) !== normalizeConnectionField(initialData.event) ||
    normalizeConnectionField(form.note) !== normalizeConnectionField(initialData.note) ||
    normalizeConnectionField(form.city) !== normalizeConnectionField(initialData.city) ||
    normalizeConnectionField(form.state) !== normalizeConnectionField(initialData.state) ||
    normalizeConnectionField(form.introducedBy) !== normalizeConnectionField(initialData.introducedBy)
  );
};

const resetConnectionForm = (setters) => {
  setters.setSelectedRelationship("friend");
  setters.setEvent("");
  setters.setNote("");
  setters.setCity("");
  setters.setState("");
  setters.setIntroducedBy("");
  setters.setDate(getTodayCircleDate());
  setters.setShowDatePicker(false);
};

function ConnectionFormFields({
  darkMode,
  loadingProfile,
  profileData,
  relationshipRequired,
  selectedRelationship,
  setSelectedRelationship,
  date,
  setDate,
  showDatePicker,
  setShowDatePicker,
  event,
  setEvent,
  note,
  setNote,
  city,
  setCity,
  state,
  setState,
  introducedBy,
  setIntroducedBy,
}) {
  const relationships = [
    { value: "friend", label: "Friend" },
    { value: "colleague", label: "Colleague" },
    { value: "family", label: "Family" },
  ];

  const isRelationshipValid = selectedRelationship && REL_TYPES.includes(selectedRelationship);

  return (
    <>
      <View style={styles.content}>
        {loadingProfile ? (
          <View style={styles.loadingProfileRow}>
            <ActivityIndicator size='small' color={darkMode ? "#fff" : "#007AFF"} />
            <Text style={[styles.loadingProfileText, darkMode && styles.darkLoadingProfileText]}>Loading profile…</Text>
          </View>
        ) : (
          <MiniCard user={profileData} />
        )}
      </View>

      <View style={styles.relationshipContainer}>
        <Text style={[styles.relationshipLabel, darkMode && styles.darkRelationshipLabel]}>
          Relationship:{relationshipRequired ? " *" : ""}
        </Text>
        {relationshipRequired && !isRelationshipValid ? (
          <Text style={styles.relationshipError}>Please select Friend, Colleague, or Family.</Text>
        ) : null}
        <View style={styles.relationshipButtons}>
          {relationships.map((rel) => (
            <TouchableOpacity
              key={rel.value}
              style={[
                styles.relationshipButton,
                selectedRelationship === rel.value && styles.relationshipButtonActive,
                darkMode && styles.darkRelationshipButton,
                selectedRelationship === rel.value && darkMode && styles.darkRelationshipButtonActive,
              ]}
              onPress={() =>
                setSelectedRelationship((prev) => {
                  if (relationshipRequired) return rel.value;
                  return prev === rel.value ? null : rel.value;
                })
              }
            >
              <Text
                style={[
                  styles.relationshipButtonText,
                  selectedRelationship === rel.value && styles.relationshipButtonTextActive,
                  darkMode && styles.darkRelationshipButtonText,
                  selectedRelationship === rel.value && darkMode && styles.darkRelationshipButtonTextActive,
                ]}
              >
                {rel.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>Date:</Text>
        {Platform.OS === "web" ? (
          <WebTextInput style={[styles.textInput, darkMode && styles.darkTextInput]} type='date' value={date} onChangeText={setDate} />
        ) : DateTimePicker ? (
          <>
            <TouchableOpacity style={[styles.dateButton, darkMode && styles.darkDateButton]} onPress={() => setShowDatePicker(true)}>
              <Text style={[styles.dateButtonText, darkMode && styles.darkDateButtonText]}>{formatCircleDateForDisplay(date)}</Text>
              <Ionicons name='calendar-outline' size={18} color={darkMode ? "#aaa" : "#666"} />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={circleDateToDate(date)}
                mode='date'
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, selectedDate) => {
                  if (Platform.OS === "android") setShowDatePicker(false);
                  if (selectedDate) setDate(dateToCircleDate(selectedDate));
                }}
              />
            )}
            {Platform.OS === "ios" && showDatePicker && (
              <TouchableOpacity style={styles.datePickerDone} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.datePickerDoneText}>Done</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <WebTextInput
            style={[styles.textInput, darkMode && styles.darkTextInput]}
            value={date}
            onChangeText={setDate}
            placeholder='YYYY-MM-DD'
            placeholderTextColor={darkMode ? "#666" : "#999"}
          />
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>Event:</Text>
        <WebTextInput
          style={[styles.textInput, darkMode && styles.darkTextInput]}
          value={event}
          onChangeText={setEvent}
          placeholder='Enter event name'
          placeholderTextColor={darkMode ? "#666" : "#999"}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>Note:</Text>
        <WebTextInput
          style={[styles.textInput, styles.textArea, darkMode && styles.darkTextInput]}
          value={note}
          onChangeText={setNote}
          placeholder='Enter notes or comments'
          placeholderTextColor={darkMode ? "#666" : "#999"}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.inputRow}>
        <View style={[styles.inputContainer, styles.inputHalf]}>
          <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>City:</Text>
          <WebTextInput style={[styles.textInput, darkMode && styles.darkTextInput]} value={city} onChangeText={setCity} placeholder='City' placeholderTextColor={darkMode ? "#666" : "#999"} />
        </View>

        <View style={[styles.inputContainer, styles.inputHalf]}>
          <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>State:</Text>
          <WebTextInput
            style={[styles.textInput, darkMode && styles.darkTextInput]}
            value={state}
            onChangeText={setState}
            placeholder='State'
            placeholderTextColor={darkMode ? "#666" : "#999"}
          />
        </View>
      </View>

      <View style={[styles.inputContainer, styles.lastInputContainer]}>
        <Text style={[styles.inputLabel, darkMode && styles.darkInputLabel]}>Introduced By:</Text>
        <WebTextInput
          style={[styles.textInput, darkMode && styles.darkTextInput]}
          value={introducedBy}
          onChangeText={setIntroducedBy}
          placeholder='Who introduced you?'
          placeholderTextColor={darkMode ? "#666" : "#999"}
        />
      </View>
    </>
  );
}

function ConnectionFormButtons({ darkMode, actionLabel, isSaveDisabled, onAdd, onClose, hideCloseButton = false }) {
  return (
    <View style={[styles.buttonContainer, darkMode && styles.darkButtonContainer]}>
      <TouchableOpacity style={[styles.addButton, isSaveDisabled && styles.addButtonDisabled]} onPress={onAdd} disabled={isSaveDisabled}>
        <Text style={styles.addButtonText}>{actionLabel}</Text>
      </TouchableOpacity>
      {!hideCloseButton && (
        <TouchableOpacity style={styles.viewButton} onPress={onClose}>
          <Text style={[styles.viewButtonText, darkMode && styles.darkViewButtonText]}>Close</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const ScannedProfilePopup = ({
  visible,
  profileData,
  onClose,
  onAddConnection,
  initialData = null,
  actionLabel = "Add to Network",
  title = "Connect With Me",
  relationshipRequired = false,
  loadingProfile = false,
  variant = "modal",
  hideHeader = false,
  hideCloseButton = false,
}) => {
  const { darkMode } = useDarkMode();
  const isScreen = variant === "screen";
  const isActive = isScreen || visible;
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { visibleHeight, keyboardOpen } = useKeyboardAwareViewport(windowHeight, !isScreen);
  const [selectedRelationship, setSelectedRelationship] = useState("friend");
  const [event, setEvent] = useState("");
  const [note, setNote] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [introducedBy, setIntroducedBy] = useState("");
  const [date, setDate] = useState(getTodayCircleDate());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const wasActiveRef = useRef(false);

  const overlayPadding = windowWidth < 400 ? 12 : 20;
  const topPadding = keyboardOpen ? Math.min(overlayPadding, 8) : overlayPadding;
  const modalMaxHeight = Math.max(240, visibleHeight - topPadding * 2);
  const scrollMaxHeight = Math.max(120, modalMaxHeight - 170);

  useEffect(() => {
    if (isActive) {
      if (!wasActiveRef.current) {
        setSelectedRelationship(resolveInitialRelationship(initialData));
        setEvent(initialData?.event || "");
        setNote(initialData?.note || "");
        setCity(initialData?.city || "");
        setState(initialData?.state || "");
        setIntroducedBy(initialData?.introducedBy || "");
        setDate(initialData?.date || getTodayCircleDate());
        setShowDatePicker(false);
      }
      wasActiveRef.current = true;
      return;
    }

    if (wasActiveRef.current) {
      resetConnectionForm({
        setSelectedRelationship,
        setEvent,
        setNote,
        setCity,
        setState,
        setIntroducedBy,
        setDate,
        setShowDatePicker,
      });
    }
    wasActiveRef.current = false;
  }, [isActive]);

  if (!isScreen && !visible) return null;
  if (!profileData && !loadingProfile) return null;

  const isRelationshipValid = selectedRelationship && REL_TYPES.includes(selectedRelationship);
  const hasChanges = connectionFormHasChanges(
    { relationship: selectedRelationship, date, event, note, city, state, introducedBy },
    initialData,
  );
  const isSaveDisabled = (relationshipRequired && !isRelationshipValid) || !hasChanges || loadingProfile;

  const handleAdd = () => {
    if (relationshipRequired && !isRelationshipValid) {
      Alert.alert("Required", "Please select a relationship type.");
      return;
    }
    if (onAddConnection) {
      onAddConnection({
        relationship: selectedRelationship,
        date: date.trim() || getTodayCircleDate(),
        event: event.trim(),
        note: note.trim(),
        city: city.trim(),
        state: state.trim(),
        introducedBy: introducedBy.trim(),
      });
    }
  };

  const formFieldsProps = {
    darkMode,
    loadingProfile,
    profileData,
    relationshipRequired,
    selectedRelationship,
    setSelectedRelationship,
    date,
    setDate,
    showDatePicker,
    setShowDatePicker,
    event,
    setEvent,
    note,
    setNote,
    city,
    setCity,
    state,
    setState,
    introducedBy,
    setIntroducedBy,
  };

  const headerRow = !hideHeader ? (
    <View style={styles.header}>
      <Text style={[styles.title, darkMode && styles.darkTitle]}>{title}</Text>
      {!hideCloseButton && (
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name='close' size={24} color={darkMode ? "#fff" : "#333"} />
        </TouchableOpacity>
      )}
    </View>
  ) : null;

  const buttonRow = (
    <ConnectionFormButtons
      darkMode={darkMode}
      actionLabel={actionLabel}
      isSaveDisabled={isSaveDisabled}
      onAdd={handleAdd}
      onClose={onClose}
      hideCloseButton={hideCloseButton}
    />
  );

  if (isScreen) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screenRoot}>
        <View style={[styles.screenContent, darkMode && styles.darkScreenContent]}>
          {headerRow}
          <ScrollView
            style={styles.screenScrollView}
            contentContainerStyle={styles.screenScrollContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps='handled'
            nestedScrollEnabled
          >
            <ConnectionFormFields {...formFieldsProps} />
          </ScrollView>
          {buttonRow}
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <Modal visible={visible} transparent={true} animationType='fade' onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View
          style={[
            styles.modalOverlay,
            darkMode && styles.darkModalOverlay,
            {
              padding: overlayPadding,
              paddingTop: topPadding,
              justifyContent: keyboardOpen ? "flex-start" : "center",
            },
          ]}
        >
          <View style={[styles.modalContent, darkMode && styles.darkModalContent, { maxHeight: modalMaxHeight }]}>
            {headerRow}
            <ScrollView
              style={[styles.scrollView, { maxHeight: scrollMaxHeight }]}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps='handled'
              nestedScrollEnabled
              bounces={false}
            >
              <ConnectionFormFields {...formFieldsProps} />
            </ScrollView>
            {buttonRow}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  screenContent: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    width: "100%",
  },
  darkScreenContent: {
    backgroundColor: "#2a2a2a",
  },
  screenScrollView: {
    flex: 1,
  },
  screenScrollContent: {
    paddingBottom: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  darkModalOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    width: "100%",
    maxWidth: 400,
    flexShrink: 1,
    overflow: "hidden",
    boxShadow: "0px 2px 4px 0px rgba(0,0,0,0.25)",
    ...(Platform.OS !== "web" && { elevation: 5 }),
  },
  scrollView: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: 8,
    flexGrow: 0,
  },
  darkModalContent: {
    backgroundColor: "#2a2a2a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    flexShrink: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  darkTitle: {
    color: "#fff",
  },
  closeButton: {
    padding: 4,
  },
  content: {
    marginBottom: 20,
  },
  loadingProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 20,
  },
  loadingProfileText: {
    fontSize: 15,
    color: "#666",
  },
  darkLoadingProfileText: {
    color: "#ccc",
  },
  buttonContainer: {
    gap: 10,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
    flexShrink: 0,
  },
  darkButtonContainer: {
    borderTopColor: "#444",
  },
  lastInputContainer: {
    marginBottom: 4,
  },
  addButton: {
    backgroundColor: "#AF52DE",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonDisabled: {
    backgroundColor: "#c9a0e8",
    opacity: 0.7,
  },
  relationshipError: {
    fontSize: 12,
    color: "#c62828",
    marginBottom: 8,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  viewButton: {
    backgroundColor: "transparent",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#AF52DE",
  },
  viewButtonText: {
    color: "#AF52DE",
    fontSize: 16,
    fontWeight: "600",
  },
  darkViewButtonText: {
    color: "#a78bfa",
    borderColor: "#a78bfa",
  },
  relationshipContainer: {
    marginBottom: 20,
  },
  relationshipLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  darkRelationshipLabel: {
    color: "#fff",
  },
  relationshipButtons: {
    flexDirection: "row",
    gap: 8,
  },
  relationshipButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  relationshipButtonActive: {
    backgroundColor: "#AF52DE",
    borderColor: "#AF52DE",
  },
  darkRelationshipButton: {
    backgroundColor: "#333",
    borderColor: "#555",
  },
  darkRelationshipButtonActive: {
    backgroundColor: "#AF52DE",
    borderColor: "#AF52DE",
  },
  relationshipButtonText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  relationshipButtonTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  darkRelationshipButtonText: {
    color: "#aaa",
  },
  darkRelationshipButtonTextActive: {
    color: "#fff",
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  darkInputLabel: {
    color: "#fff",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#333",
    backgroundColor: "#fff",
    textAlign: "left",
  },
  darkTextInput: {
    borderColor: "#555",
    backgroundColor: "#000",
    color: "#fff",
    textAlign: "left",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  darkDateButton: {
    borderColor: "#555",
    backgroundColor: "#000",
  },
  dateButtonText: {
    fontSize: 14,
    color: "#333",
  },
  darkDateButtonText: {
    color: "#fff",
  },
  datePickerDone: {
    alignSelf: "flex-end",
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  datePickerDoneText: {
    color: "#AF52DE",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ScannedProfilePopup;
