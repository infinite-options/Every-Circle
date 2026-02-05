import React, { useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from "react-native";
import { Dropdown } from "react-native-element-dropdown";

const ExpertiseSection = ({ expertise, setExpertise, toggleVisibility, isPublic, handleDelete, onInputFocus }) => {
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
    const newEntry = {
      name: "",
      description: "",
      cost: "",
      bounty: "",
      isPublic: true,
    };
    setExpertise([...expertise, newEntry]);
  };

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
      // Combine amount and unit
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

  // Handle bounty change
  const handleBountyAmountChange = (index, value) => {
    const updated = [...expertise];
    updated[index].bounty = value;
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
          <Text style={styles.label}>Expertise</Text>
          <TouchableOpacity onPress={addExpertise}>
            <Text style={styles.addText}>+</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={toggleVisibility}>
          <Text style={[styles.toggleText, { color: isPublic ? "#4CAF50" : "#f44336" }]}>{isPublic ? "Display" : "Hide"}</Text>
        </TouchableOpacity>
      </View>

      {expertise.map((item, index) => (
        <View key={index} style={[styles.card, index > 0 && styles.cardSpacing]}>
          <View style={styles.rowHeader}>
            <Text style={styles.label}>Expertise #{index + 1}</Text>
            <TouchableOpacity onPress={() => toggleEntryVisibility(index)}>
              <Text style={{ color: item.isPublic ? "#4CAF50" : "#f44336", fontWeight: "bold", marginLeft: 10 }}>{item.isPublic ? "Display" : "Hide"}</Text>
            </TouchableOpacity>
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
      return amount && (amount.toLowerCase() === "free" || !/^\d/.test(amount.trim())) ? "default" : "numeric";
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
  />
  <Dropdown
    style={styles.costUnitDropdown}
    data={costUnitOptions}
    labelField='label'
    valueField='value'
    placeholder='Select unit'
    value={parseCost(item.cost).unit}
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
    keyboardType='numeric'
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
  },
  dollar: { fontSize: 20, marginHorizontal: 5 },
  deleteIcon: { width: 20, height: 20 },
  cardSpacing: {
    marginTop: 16,
  },
});

export default ExpertiseSection;
