// AddToCartDetailsModal.js - Modal for adding expertise to cart with escrow, quantity, and cost breakdown
// Same format as AcceptDetailsModal (Seeking Responses)
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDarkMode } from "../contexts/DarkModeContext";
import MiniCard from "./MiniCard";

/**
 * Parse cost string to extract numeric value and units.
 * Examples: "$50/hr" -> { value: 50, units: "/hr" }, "$50 total" -> { value: 50, units: "total" }
 */
const parseCost = (costStr) => {
  if (!costStr || String(costStr).toLowerCase() === "free") return { value: 0, units: "" };
  const str = String(costStr).replace(/^\$/, "").trim();
  if (str.toLowerCase().endsWith("total")) {
    const amount = str.replace(/total$/i, "").trim();
    return { value: parseFloat(amount) || 0, units: "total" };
  }
  const match = str.match(/^([\d.]+)\s*(\/[\w\s]+)?$/i) || str.match(/^([\d.]+)/);
  if (!match) return { value: 0, units: "" };
  const value = parseFloat(match[1]) || 0;
  const units = (match[2] || "").trim().toLowerCase();
  return { value, units };
};

/** Map cost unit to quantity label suffix, e.g. /hr -> "number of hrs" */
const getQuantityLabelSuffix = (units) => {
  if (!units) return "";
  const u = units.replace(/^\//, "").toLowerCase();
  if (u === "hr") return "number of hrs";
  if (u === "day") return "number of days";
  if (u === "week") return "number of weeks";
  if (u === "month") return "number of months";
  if (u === "quarter") return "number of quarters";
  if (u === "year") return "number of years";
  return units;
};

const parseBounty = (bountyStr) => {
  if (!bountyStr || String(bountyStr).toLowerCase() === "free") return 0;
  const match = String(bountyStr).match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
};

const AddToCartDetailsModal = ({ show, setShow, expertiseData, profileData, onAddToCart, onCancel }) => {
  const { darkMode } = useDarkMode();
  const { value: costValue, units } = parseCost(expertiseData?.cost || "");
  const bountyAmount = parseBounty(expertiseData?.bounty || "0");

  const [escrow, setEscrow] = useState(true);
  const [quantity, setQuantity] = useState("1");
  const [quantityError, setQuantityError] = useState("");

  useEffect(() => {
    if (show) {
      setEscrow(true);
      setQuantity("1");
      setQuantityError("");
    }
  }, [show]);

  const isTotalUnit = units === "total";
  const quantityLabelSuffix = isTotalUnit ? "" : getQuantityLabelSuffix(units);
  const qtyNum = isTotalUnit ? 1 : parseFloat(quantity) || 0;
  const costAmount = costValue * qtyNum;
  const subtotal = costAmount; // Bounty paid by seller, not included in buyer's total
  const processingFee = subtotal * 0.03;
  const totalWithFee = subtotal + processingFee;

  const handleAddToCart = () => {
    if (qtyNum <= 0 || qtyNum > 9999) {
      setQuantityError("Enter a valid quantity (1-9999)");
      return;
    }
    if (subtotal <= 0) {
      setQuantityError("Subtotal must be greater than 0");
      return;
    }
    setQuantityError("");
    onAddToCart({
      subtotal,
      totalWithFee,
      quantity: qtyNum,
      escrow,
      costAmount,
      costValue,
      bountyAmount,
    });
    setShow(false);
  };

  const handleCancel = () => {
    setQuantityError("");
    onCancel();
  };

  const miniCardUser = profileData
    ? {
        firstName: profileData.profile_personal_first_name || profileData.firstName || "",
        lastName: profileData.profile_personal_last_name || profileData.lastName || "",
        email: profileData.profile_personal_email || profileData.email || "",
        phoneNumber: profileData.profile_personal_phone_number || profileData.phoneNumber || "",
        profileImage: profileData.profile_personal_image || profileData.profileImage || "",
        tagLine: profileData.profile_personal_tag_line || profileData.tagLine || "",
        emailIsPublic: profileData.profile_personal_email_is_public === 1,
        phoneIsPublic: profileData.profile_personal_phone_number_is_public === 1,
        tagLineIsPublic: profileData.profile_personal_tag_line_is_public === 1,
        imageIsPublic: profileData.profile_personal_image_is_public === 1,
      }
    : null;

  return (
    <Modal animationType='fade' transparent={true} visible={show} onRequestClose={handleCancel}>
      <View style={[styles.modalOverlay, darkMode && styles.darkModalOverlay]}>
        <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
          <Text style={[styles.title, darkMode && styles.darkTitle]}>Add to Cart</Text>

          {miniCardUser && (
            <View style={styles.miniCardSection}>
              <MiniCard user={miniCardUser} />
            </View>
          )}

          <View style={styles.section}>
            <TouchableOpacity style={[styles.checkboxRow, darkMode && styles.darkCheckboxRow]} onPress={() => setEscrow(!escrow)} activeOpacity={0.7}>
              <View style={[styles.checkbox, escrow && styles.checkboxChecked, darkMode && styles.darkCheckbox]}>{escrow && <Text style={styles.checkmark}>✓</Text>}</View>
              <Text style={[styles.checkboxLabel, darkMode && styles.darkCheckboxLabel]}>Escrow</Text>
              <Ionicons name='information-circle-outline' size={18} color={darkMode ? "#999" : "#666"} style={styles.infoIcon} />
            </TouchableOpacity>
          </View>

          {!isTotalUnit && (
            <View style={styles.section}>
              <Text style={[styles.label, darkMode && styles.darkLabel]}>Quantity {quantityLabelSuffix && `(${quantityLabelSuffix})`}</Text>
              <View style={styles.quantityRow}>
                <TouchableOpacity style={[styles.quantityButton, darkMode && styles.darkQuantityButton]} onPress={() => setQuantity(String(Math.max(1, qtyNum - 1)))}>
                  <Text style={[styles.quantityButtonText, darkMode && styles.darkQuantityButtonText]}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.quantityInput, { marginHorizontal: 12 }, darkMode && styles.darkQuantityInput]}
                  value={quantity}
                  onChangeText={(t) => {
                    setQuantity(t.replace(/[^0-9.]/g, ""));
                    setQuantityError("");
                  }}
                  keyboardType='decimal-pad'
                  placeholder='1'
                />
                <TouchableOpacity style={[styles.quantityButton, darkMode && styles.darkQuantityButton]} onPress={() => setQuantity(String(qtyNum + 1))}>
                  <Text style={[styles.quantityButtonText, darkMode && styles.darkQuantityButtonText]}>+</Text>
                </TouchableOpacity>
              </View>
              {quantityError ? <Text style={styles.errorText}>{quantityError}</Text> : null}
            </View>
          )}

          <View style={[styles.summarySection, darkMode && styles.darkSummarySection]}>
            {costValue > 0 && costAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, darkMode && styles.darkSummaryLabel]}>
                  {isTotalUnit ? `Cost (total)` : `Cost (${qtyNum} × $${costValue.toFixed(2)}${units})`}
                </Text>
                <Text style={[styles.summaryValue, darkMode && styles.darkSummaryValue]}>${costAmount.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, darkMode && styles.darkSummaryLabel]}>Subtotal</Text>
              <Text style={[styles.summaryValue, darkMode && styles.darkSummaryValue]}>${subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, darkMode && styles.darkSummaryLabel]}>Credit card processing fee (3%)</Text>
              <Text style={[styles.summaryValue, darkMode && styles.darkSummaryValue]}>${processingFee.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, styles.totalLabel, darkMode && styles.darkSummaryLabel]}>Total</Text>
              <Text style={[styles.summaryValue, styles.totalValue, darkMode && styles.darkSummaryValue]}>${totalWithFee.toFixed(2)}</Text>
            </View>
            {bountyAmount > 0 && (
              <View style={[styles.summaryRow, styles.bountyNoteRow, darkMode && styles.darkBountyNoteRow]}>
                <Text style={[styles.bountyNoteLabel, darkMode && styles.darkBountyNoteLabel]}>Bounty (paid by Seller)</Text>
                <Text style={[styles.bountyNoteValue, darkMode && styles.darkBountyNoteValue]}>${bountyAmount.toFixed(2)}</Text>
              </View>
            )}
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.button, styles.cancelButton, darkMode && styles.darkCancelButton]} onPress={handleCancel}>
              <Text style={[styles.buttonText, styles.cancelButtonText, darkMode && styles.darkCancelButtonText]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.continueButton, darkMode && styles.darkContinueButton]} onPress={handleAddToCart}>
              <Text style={styles.buttonText}>Add to Cart</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    ...(Platform.OS === "web" && {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9998,
    }),
  },
  darkModalOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "90%",
    maxWidth: 400,
    maxHeight: "90%",
    ...(Platform.OS === "web" && {
      position: "relative",
      zIndex: 9999,
      overflow: "auto",
    }),
  },
  darkModalContent: {
    backgroundColor: "#2d2d2d",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  darkTitle: {
    color: "#fff",
  },
  miniCardSection: {
    marginBottom: 20,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  darkLabel: {
    color: "#fff",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  darkCheckboxRow: {},
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: "#9C45F7",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: "#9C45F7",
  },
  darkCheckbox: {
    borderColor: "#7B35C7",
  },
  checkmark: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  checkboxLabel: {
    fontSize: 16,
    color: "#333",
  },
  darkCheckboxLabel: {
    color: "#fff",
  },
  infoIcon: {
    marginLeft: 6,
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  darkQuantityButton: {
    backgroundColor: "#404040",
  },
  quantityButtonText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  darkQuantityButtonText: {
    color: "#fff",
  },
  quantityInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#333",
    textAlign: "center",
  },
  darkQuantityInput: {
    borderColor: "#555",
    color: "#fff",
    backgroundColor: "#404040",
  },
  errorText: {
    fontSize: 12,
    color: "#f44336",
    marginTop: 4,
  },
  summarySection: {
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  darkSummarySection: {
    backgroundColor: "#1a1a1a",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
  },
  darkSummaryLabel: {
    color: "#ccc",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  darkSummaryValue: {
    color: "#fff",
  },
  totalLabel: {
    fontWeight: "bold",
    fontSize: 16,
    marginTop: 4,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 4,
  },
  bountyNoteRow: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  darkBountyNoteRow: {
    borderTopColor: "#444",
  },
  bountyNoteLabel: {
    fontSize: 13,
    color: "#888",
    fontStyle: "italic",
  },
  darkBountyNoteLabel: {
    color: "#999",
  },
  bountyNoteValue: {
    fontSize: 13,
    color: "#888",
    fontStyle: "italic",
  },
  darkBountyNoteValue: {
    color: "#999",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#F5F5F5",
    borderWidth: 2,
    borderColor: "#9C45F7",
  },
  darkCancelButton: {
    backgroundColor: "#404040",
    borderColor: "#7B35C7",
  },
  continueButton: {
    backgroundColor: "#9C45F7",
  },
  darkContinueButton: {
    backgroundColor: "#7B35C7",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  cancelButtonText: {
    color: "#9C45F7",
  },
  darkCancelButtonText: {
    color: "#7B35C7",
  },
});

export default AddToCartDetailsModal;
