// AddToCartDetailsModal.js - Modal for adding expertise to cart with quantity
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDarkMode } from "../contexts/DarkModeContext";
import MiniCard from "./MiniCard";
import {
  formatOfferingAddToCartStockHint,
  getOfferingMaxAddQuantity,
  getOfferingQuantityLabelSuffix,
  isOfferingReturnable,
  parseOfferingCostParts,
  profileDataForCartModal,
} from "../utils/offeringCartUtils";
import { loadExpertiseCartQuantity } from "../utils/expertiseCartStorage";

const AddToCartDetailsModal = ({ show, setShow, expertiseData, profileData, onAddToCart, onCancel }) => {
  const { darkMode } = useDarkMode();
  const { value: costValue } = parseOfferingCostParts(expertiseData?.cost || "");

  const isTaxable = expertiseData?.profile_expertise_is_taxable == 1 || expertiseData?.profile_expertise_is_taxable === true;
  const taxRateStr = String(expertiseData?.profile_expertise_tax_rate ?? "").trim();
  const taxRatePct = isTaxable && taxRateStr !== "" ? parseFloat(taxRateStr) : 0;

  const [quantity, setQuantity] = useState("1");
  const [quantityError, setQuantityError] = useState("");
  const [existingInCart, setExistingInCart] = useState(0);
  const [cartQtyLoading, setCartQtyLoading] = useState(false);

  const offeringName =
    expertiseData?.title || expertiseData?.profile_expertise_title || expertiseData?.name || "Offering";
  const maxCanAdd = getOfferingMaxAddQuantity(expertiseData, existingInCart);
  const atCartMaximum = maxCanAdd != null && maxCanAdd <= 0;

  useEffect(() => {
    if (!show) {
      setExistingInCart(0);
      setCartQtyLoading(false);
      return;
    }
    setQuantity("1");
    setQuantityError("");

    const expertiseUid = expertiseData?.expertise_uid;
    if (!expertiseUid) {
      setExistingInCart(0);
      setCartQtyLoading(false);
      return;
    }

    let cancelled = false;
    setCartQtyLoading(true);
    loadExpertiseCartQuantity(expertiseUid).then((qty) => {
      if (cancelled) return;
      setExistingInCart(qty);
      setCartQtyLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [show, expertiseData?.expertise_uid]);

  useEffect(() => {
    if (!show || cartQtyLoading) return;
    if (maxCanAdd != null && maxCanAdd > 0) {
      setQuantity((prev) => {
        const parsed = parseFloat(prev) || 1;
        return String(Math.min(parsed, maxCanAdd));
      });
    }
  }, [show, cartQtyLoading, maxCanAdd]);

  const quantityLabelSuffix = getOfferingQuantityLabelSuffix(expertiseData?.cost);
  const qtyNum = parseFloat(quantity) || 0;
  const stockHint = formatOfferingAddToCartStockHint(expertiseData, existingInCart, qtyNum);
  const atSelectionMaximum = maxCanAdd != null && qtyNum > 0 && qtyNum >= maxCanAdd;
  const lineMerchandise = costValue * qtyNum;
  const itemReturnable = isOfferingReturnable(expertiseData);

  const clampQuantity = (nextQty) => {
    if (maxCanAdd != null && maxCanAdd <= 0) return 0;
    let q = Math.max(1, nextQty);
    if (maxCanAdd != null) q = Math.min(maxCanAdd, q);
    return q;
  };

  const handleAddToCart = () => {
    if (atCartMaximum) {
      setQuantityError("Your cart already has the maximum available for this offering.");
      return;
    }
    if (qtyNum <= 0 || qtyNum > 9999) {
      setQuantityError("Enter a valid quantity (1-9999)");
      return;
    }
    if (maxCanAdd != null && qtyNum > maxCanAdd) {
      setQuantityError(`You can only add ${maxCanAdd} more (${existingInCart} already in cart).`);
      return;
    }
    if (lineMerchandise <= 0) {
      setQuantityError("Subtotal must be greater than 0");
      return;
    }
    setQuantityError("");
    onAddToCart({
      quantity: qtyNum,
      escrow: true,
      taxRatePct,
    });
    setShow(false);
  };

  const handleCancel = () => {
    setQuantityError("");
    onCancel();
  };

  const miniCardUser = profileDataForCartModal(profileData);

  return (
    <Modal animationType='fade' transparent={true} visible={show} onRequestClose={handleCancel}>
      <View style={[styles.modalOverlay, darkMode && styles.darkModalOverlay]}>
        <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
          <Text style={[styles.title, darkMode && styles.darkTitle]}>Add to Cart</Text>
          <Text style={[styles.offeringName, darkMode && styles.darkOfferingName]}>{offeringName}</Text>

          {miniCardUser ? (
            <View style={styles.miniCardSection}>
              <MiniCard user={miniCardUser} />
            </View>
          ) : null}

          {stockHint ? (
            <Text style={[styles.stockHint, darkMode && styles.darkStockHint, (atCartMaximum || atSelectionMaximum) && styles.stockHintWarning]}>
              {stockHint}
            </Text>
          ) : cartQtyLoading ? (
            <Text style={[styles.stockHint, darkMode && styles.darkStockHint]}>Checking cart…</Text>
          ) : null}

          <View style={[styles.quantityContainer, atCartMaximum && styles.quantityRowDisabled]}>
            <TouchableOpacity
              style={[styles.quantityButton, darkMode && styles.darkQuantityButton]}
              onPress={() => setQuantity(String(clampQuantity(qtyNum - 1)))}
              disabled={atCartMaximum || qtyNum <= 1}
            >
              <Ionicons name='remove' size={24} color={darkMode ? "#7B35C7" : "#9C45F7"} />
            </TouchableOpacity>
            <TextInput
              style={[styles.quantityInput, darkMode && styles.darkQuantityInput, atCartMaximum && styles.quantityInputDisabled]}
              value={quantity}
              onChangeText={(t) => {
                setQuantity(t.replace(/[^0-9.]/g, ""));
                setQuantityError("");
              }}
              onBlur={() => {
                if (atCartMaximum) return;
                const parsed = parseFloat(quantity) || 1;
                setQuantity(String(clampQuantity(parsed)));
              }}
              keyboardType='decimal-pad'
              placeholder='1'
              editable={!atCartMaximum}
            />
            <TouchableOpacity
              style={[
                styles.quantityButton,
                darkMode && styles.darkQuantityButton,
                maxCanAdd != null && qtyNum >= maxCanAdd && styles.quantityButtonDisabled,
              ]}
              onPress={() => setQuantity(String(clampQuantity(qtyNum + 1)))}
              disabled={atCartMaximum || (maxCanAdd != null && qtyNum >= maxCanAdd)}
            >
              <Ionicons name='add' size={24} color={darkMode ? "#7B35C7" : "#9C45F7"} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.totalPrice, darkMode && styles.darkTotalPrice]}>
            Total: ${lineMerchandise.toFixed(2)}
          </Text>

          {quantityLabelSuffix ? (
            <Text style={[styles.quantitySuffix, darkMode && styles.darkQuantitySuffix]}>{quantityLabelSuffix}</Text>
          ) : null}
          {quantityError ? <Text style={styles.errorText}>{quantityError}</Text> : null}

          <Text style={[styles.returnableNote, darkMode && styles.darkReturnableNote]}>
            {itemReturnable ? "Returnable" : "Item not returnable"}
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.button, styles.cancelButton, darkMode && styles.darkCancelButton]} onPress={handleCancel}>
              <Text style={[styles.buttonText, styles.cancelButtonText, darkMode && styles.darkCancelButtonText]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.continueButton, darkMode && styles.darkContinueButton, atCartMaximum && styles.continueButtonDisabled]}
              onPress={handleAddToCart}
              disabled={atCartMaximum || cartQtyLoading}
            >
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
    marginBottom: 10,
    textAlign: "center",
  },
  darkTitle: {
    color: "#fff",
  },
  offeringName: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
  },
  darkOfferingName: {
    color: "#ccc",
  },
  miniCardSection: {
    marginBottom: 16,
  },
  stockHint: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
    textAlign: "center",
  },
  stockHintWarning: {
    color: "#b45309",
    fontWeight: "600",
  },
  darkStockHint: {
    color: "#aaa",
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  quantityButton: {
    backgroundColor: "#F5F5F5",
    padding: 10,
    borderRadius: 10,
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  darkQuantityButton: {
    backgroundColor: "#404040",
  },
  quantityInput: {
    width: 48,
    height: 44,
    marginHorizontal: 12,
    borderWidth: 0,
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    paddingHorizontal: 0,
  },
  darkQuantityInput: {
    color: "#fff",
    backgroundColor: "transparent",
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#9C45F7",
    marginBottom: 12,
    textAlign: "center",
  },
  darkTotalPrice: {
    color: "#7B35C7",
  },
  quantitySuffix: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    marginBottom: 12,
  },
  darkQuantitySuffix: {
    color: "#999",
  },
  errorText: {
    fontSize: 12,
    color: "#f44336",
    marginBottom: 8,
    textAlign: "center",
  },
  quantityRowDisabled: {
    opacity: 0.5,
  },
  quantityInputDisabled: {
    opacity: 0.7,
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  returnableNote: {
    fontSize: 13,
    color: "#888",
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 20,
  },
  darkReturnableNote: {
    color: "#999",
  },
  continueButtonDisabled: {
    opacity: 0.5,
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
