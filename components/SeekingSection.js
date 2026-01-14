import React, { useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Platform } from "react-native";
import { Dropdown } from "react-native-element-dropdown";

const SeekingSection = ({ wishes, setWishes, toggleVisibility, isPublic, handleDelete, onInputFocus }) => {
  const bountyInputRefs = useRef({});
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
    const newEntry = { helpNeeds: "", details: "", amount: "", isPublic: false };
    setWishes([...wishes, newEntry]);
  };

  const deleteWish = (index) => {
    handleDelete(index);
  };

  const handleInputChange = (index, field, value) => {
    const updated = [...wishes];
    updated[index][field] = value;
    setWishes(updated);
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
      // Combine amount and unit
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

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.headerRow}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Seeking</Text>
          <TouchableOpacity onPress={addWish}>
            <Text style={styles.addText}>+</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={toggleVisibility}>
          <Text style={[styles.toggleText, { color: isPublic ? "#4CAF50" : "#f44336" }]}>{isPublic ? "Display" : "Hide"}</Text>
        </TouchableOpacity>
      </View>

      {wishes.map((item, index) => (
        <View key={index} style={[styles.card, index > 0 && styles.cardSpacing]}>
          <View style={styles.rowHeader}>
            <Text style={styles.label}>Seeking #{index + 1}</Text>
            <TouchableOpacity onPress={() => toggleEntryVisibility(index)}>
              <Text style={{ color: item.isPublic ? "#4CAF50" : "#f44336", fontWeight: "bold" }}>{item.isPublic ? "Display" : "Hide"}</Text>
            </TouchableOpacity>
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

          <View style={styles.amountRow}>
            <Text style={styles.dollar}>💰</Text>
            <TextInput
              ref={(ref) => {
                if (ref) bountyInputRefs.current[index] = ref;
              }}
              style={styles.bountyAmountInput}
              placeholder='Amount or Free'
              keyboardType={(() => {
                const parsed = parseBounty(item.amount);
                const amount = parsed.amount;
                // Use default keyboard if amount is "Free" or starts with non-numeric
                return amount && (amount.toLowerCase() === "free" || !/^\d/.test(amount.trim())) ? "default" : "numeric";
              })()}
              value={parseBounty(item.amount).amount}
              onChangeText={(text) => handleBountyAmountChange(index, text)}
              onFocus={() => {
                if (onInputFocus && bountyInputRefs.current[index]) {
                  onInputFocus(bountyInputRefs.current[index]);
                }
              }}
            />
            {(() => {
              const parsed = parseBounty(item.amount);
              const amount = parsed.amount;
              // Only show dropdown if amount is numeric (contains at least one digit)
              const isNumeric = amount && /^\d/.test(amount.trim());
              return (
                isNumeric && (
                  <Dropdown
                    style={[
                      styles.bountyUnitDropdown,
                      Platform.OS === "web" && {
                        shadowColor: undefined,
                        shadowOffset: undefined,
                        shadowOpacity: undefined,
                        shadowRadius: undefined,
                      },
                    ]}
                    data={bountyUnitOptions}
                    labelField='label'
                    valueField='value'
                    placeholder='Select unit'
                    value={parsed.unit}
                    onChange={(item) => handleBountyUnitChange(index, item)}
                    containerStyle={[
                      styles.dropdownContainer,
                      Platform.OS === "web" && {
                        boxShadow: "0px 2px 4px 0px rgba(0, 0, 0, 0.1)",
                        shadowColor: undefined,
                        shadowOffset: undefined,
                        shadowOpacity: undefined,
                        shadowRadius: undefined,
                      },
                    ]}
                    itemTextStyle={styles.dropdownItemText}
                    selectedTextStyle={styles.dropdownSelectedText}
                    activeColor='#f0f0f0'
                  />
                )
              );
            })()}
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
          // Override deprecated shadow props from library
          shadowColor: undefined,
          shadowOffset: undefined,
          shadowOpacity: undefined,
          shadowRadius: undefined,
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
});

export default SeekingSection;
