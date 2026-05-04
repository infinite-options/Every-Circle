import React, { useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { formatCostValue } from "../utils/priceUtils";

const ExpertiseSection = ({ expertise, setExpertise, toggleVisibility, isPublic, handleDelete, onInputFocus }) => {
  // Stores each rendered card's ref by index so parent can scroll to the new one.
  const cardRefs = useRef({});
  // Tracks which index was just added via "+".
  const pendingNewIndexRef = useRef(null);
  const costInputRefs = useRef({});
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
      isPublic: true,
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
