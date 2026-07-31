import { Platform, StyleSheet } from "react-native";
import { getDarkModeHeaderColor, getHeaderColor } from "../config/headerColors";

export const PROFILE_ITEM_FORM_ACCENT = getHeaderColor("profile");
export const PROFILE_ITEM_FORM_ACCENT_DARK = getDarkModeHeaderColor("profile");

/** Edit Profile SEEKING / OFFERING section header bar — used for inline edit cards. */
export const SEEKING_FORM_ACCENT = "#F3A5A5";
export const SEEKING_FORM_ACCENT_DARK = "#B46464";

function hexToRgb(hex) {
  const normalized = String(hex || "").replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const num = parseInt(expanded, 16);
  if (Number.isNaN(num)) return { r: 128, g: 0, b: 0 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/** Shared card form styles — same opacity/layout ratios as EditBusinessProfile service form. */
export function createProfileItemCardFormStyles(accent = PROFILE_ITEM_FORM_ACCENT, accentDark = PROFILE_ITEM_FORM_ACCENT_DARK) {
  const { r, g, b } = hexToRgb(accent);
  const rgb = `${r}, ${g}, ${b}`;

  return StyleSheet.create({
    cardSpacing: {
      marginTop: 16,
    },
    container: {
      backgroundColor: `rgba(${rgb}, 0.06)`,
      borderRadius: 12,
      padding: 16,
      marginTop: 8,
      marginBottom: 0,
      borderWidth: 2,
      borderColor: accent,
      overflow: "hidden",
    },
    containerAfterPreview: {
      marginTop: 0,
    },
    darkContainer: {
      backgroundColor: `rgba(${rgb}, 0.12)`,
      borderColor: accentDark,
    },
    titleBar: {
      backgroundColor: `rgba(${rgb}, 0.5)`,
      marginHorizontal: -16,
      marginTop: -16,
      marginBottom: 14,
      paddingHorizontal: 16,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    darkTitleBar: {
      backgroundColor: `rgba(${rgb}, 0.35)`,
    },
    titleText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#111827",
      letterSpacing: 0.4,
      flex: 1,
    },
    darkTitleText: {
      color: "#f9fafb",
    },
    topRow: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 16,
      marginBottom: 4,
    },
    mediaColumn: {
      width: 120,
      alignItems: "center",
      gap: 8,
    },
    detailsColumn: {
      flex: 1,
      minWidth: 0,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: "#374151",
      marginBottom: 6,
    },
    darkFieldLabel: {
      color: "#d1d5db",
    },
    fieldInput: {
      borderWidth: 1,
      borderColor: "#d1d5db",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === "ios" ? 10 : 8,
      fontSize: 14,
      backgroundColor: "#fff",
      color: "#111",
      marginBottom: 0,
    },
    darkFieldInput: {
      borderColor: "#555",
      backgroundColor: "#2d2d2d",
      color: "#fff",
    },
    fieldInputError: {
      borderColor: "#FF3B30",
      borderWidth: 2,
    },
    descriptionInput: {
      minHeight: 40,
      maxHeight: 160,
      textAlignVertical: "top",
    },
    sectionDivider: {
      height: 1,
      backgroundColor: `rgba(${rgb}, 0.22)`,
      marginVertical: 16,
    },
    darkSectionDivider: {
      backgroundColor: `rgba(${rgb}, 0.35)`,
    },
    section: {
      marginBottom: 4,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: accent,
      marginBottom: 12,
    },
    darkSectionTitle: {
      color: accentDark === accent ? "#c47070" : accentDark,
    },
    fieldStack: {
      marginBottom: 12,
    },
    fieldRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginBottom: 12,
    },
    fieldHalf: {
      flex: 1,
      minWidth: 140,
    },
    pricingGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    pricingCol: {
      flex: 1,
      minWidth: 160,
    },
    fulfillmentGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      alignItems: "flex-start",
    },
    fulfillmentCol: {
      flex: 1,
      minWidth: 150,
      alignSelf: "flex-start",
    },
    fulfillmentExtra: {
      marginTop: 10,
      width: "100%",
    },
    inlineControls: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
    },
    inlineAmountInput: {
      flex: 1,
      minWidth: 72,
    },
    dropdown: {
      borderWidth: 1,
      borderColor: "#d1d5db",
      borderRadius: 8,
      paddingHorizontal: 10,
      height: 40,
      backgroundColor: "#fff",
    },
    darkDropdown: {
      borderColor: "#555",
      backgroundColor: "#2d2d2d",
    },
    dropdownContainer: {
      borderRadius: 10,
      minWidth: 120,
      backgroundColor: "#fff",
    },
    darkDropdownContainer: {
      backgroundColor: "#2d2d2d",
    },
  costUnitDropdown: {
    minWidth: 96,
    flexGrow: 0,
  },
  taxDropdown: {
    minWidth: 110,
    flexGrow: 0,
  },
  bountyTypeDropdown: {
    minWidth: 120,
    flexGrow: 0,
  },
  fulfillmentDropdown: {
    width: "100%",
  },
    taxRateInput: {
      width: 108,
      minWidth: 108,
      maxWidth: 108,
    },
    taxRateInputWithSuffix: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      flexShrink: 0,
    },
    inputSuffix: {
      fontSize: 14,
      fontWeight: "600",
      color: "#555",
    },
    darkInputSuffix: {
      color: "#ccc",
    },
    quantityInput: {
      width: 72,
      flexGrow: 0,
    },
    fixedShippingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#d1d5db",
      backgroundColor: "#fff",
      minHeight: 40,
    },
    darkFixedShippingRow: {
      borderColor: "#555",
      backgroundColor: "#2d2d2d",
    },
    fixedShippingPrefix: {
      fontSize: 13,
      fontWeight: "600",
      color: "#555",
    },
    darkFixedShippingPrefix: {
      color: "#ccc",
    },
    fixedShippingInput: {
      flex: 1,
      minWidth: 72,
      fontSize: 14,
      paddingVertical: Platform.OS === "ios" ? 4 : 2,
      color: "#111",
    },
    darkFixedShippingInput: {
      color: "#fff",
    },
    fulfillmentInlineRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
    },
    checkboxRowInline: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 2,
    },
    checkboxLabelCompact: {
      fontSize: 12,
      color: "#333",
      flexShrink: 1,
    },
    darkCheckboxLabelCompact: {
      color: "#ddd",
    },
    choiceBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#d1d5db",
      backgroundColor: "#fff",
    },
    darkChoiceBtn: {
      borderColor: "#555",
      backgroundColor: "#2d2d2d",
    },
    choiceBtnActive: {
      borderColor: accent,
      backgroundColor: `rgba(${rgb}, 0.12)`,
    },
    darkChoiceBtnActive: {
      borderColor: accentDark,
      backgroundColor: `rgba(${rgb}, 0.22)`,
    },
    choiceBtnText: {
      fontSize: 13,
      color: "#555",
      fontWeight: "500",
    },
    darkChoiceBtnText: {
      color: "#ccc",
    },
    choiceBtnTextActive: {
      color: accent,
      fontWeight: "700",
    },
    darkChoiceBtnTextActive: {
      color: "#f5d0d0",
    },
    choiceBtnWide: {
      minWidth: 88,
      alignItems: "center",
    },
    modeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    modeBtn: {
      flexGrow: 1,
      flexBasis: "30%",
      minWidth: 96,
      alignItems: "center",
    },
    dateTimeButton: {
      flex: 1,
      minWidth: 100,
      borderWidth: 1,
      borderColor: "#d1d5db",
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === "ios" ? 10 : 8,
      borderRadius: 8,
      backgroundColor: "#fff",
      minHeight: 40,
      justifyContent: "center",
    },
    darkDateTimeButton: {
      borderColor: "#555",
      backgroundColor: "#2d2d2d",
    },
    dateTimeButtonText: {
      fontSize: 14,
      color: "#333",
    },
    darkDateTimeButtonText: {
      color: "#eee",
    },
    webDateTimeInputWrapper: {
      flex: 1,
      minWidth: 0,
    },
    webDateTimeInput: {
      width: "100%",
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: "#d1d5db",
      padding: 8,
      borderRadius: 8,
      backgroundColor: "#fff",
      minHeight: 40,
      fontSize: 14,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      boxSizing: "border-box",
    },
    addressContainer: {
      width: "100%",
    },
    placesSuggestionsList: {
      marginTop: 6,
      borderWidth: 1,
      borderColor: "#d1d5db",
      borderRadius: 8,
      backgroundColor: "#fff",
      overflow: "hidden",
    },
    darkPlacesSuggestionsList: {
      borderColor: "#555",
      backgroundColor: "#2d2d2d",
    },
    placesSuggestionRow: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: "#eee",
    },
    darkPlacesSuggestionRow: {
      borderBottomColor: "#444",
    },
    placesSuggestionMain: {
      fontSize: 14,
      color: "#222",
      fontWeight: "500",
    },
    darkPlacesSuggestionMain: {
      color: "#f5f5f5",
    },
    placesSuggestionSub: {
      fontSize: 12,
      color: "#666",
      marginTop: 2,
    },
    darkPlacesSuggestionSub: {
      color: "#aaa",
    },
    warningText: {
      fontSize: 13,
      color: "#FF9500",
      marginTop: 8,
      lineHeight: 18,
    },
    darkWarningText: {
      color: "#FFB340",
    },
    deleteIcon: {
      width: 20,
      height: 20,
    },
  });
}

export const profileItemCardFormStyles = createProfileItemCardFormStyles();
export const seekingProfileItemCardFormStyles = createProfileItemCardFormStyles(
  SEEKING_FORM_ACCENT,
  SEEKING_FORM_ACCENT_DARK,
);
