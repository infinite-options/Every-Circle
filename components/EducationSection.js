import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from "react-native";

const EducationSection = ({ education, setEducation, toggleVisibility, isPublic, handleDelete }) => {
  // Helper function to format date input
  const formatDateInput = (text) => {
    // If the user manually entered a slash after 2 digits, preserve it
    if (text.length === 3 && text[2] === '/') {
      return text;
    }
    
    // Remove any non-digit characters except for manually entered slashes
    const cleaned = text.replace(/[^\d/]/g, '');
    
    // Limit to 7 characters (MM/YYYY)
    const limited = cleaned.slice(0, 7);
    
    // If we have exactly 2 digits and the next character is a slash, keep it
    if (limited.length === 3 && limited[2] === '/') {
      return limited;
    }
    
    // If we have more than 2 digits and no slash, add one
    if (limited.length > 2 && !limited.includes('/')) {
      return limited.slice(0, 2) + '/' + limited.slice(2);
    }
    
    // If we have a slash and the month part is only 1 digit, pad it with a leading zero
    if (limited.includes('/')) {
      const parts = limited.split('/');
      if (parts[0].length === 1 && parts[0] !== '') {
        return '0' + parts[0] + '/' + (parts[1] || '');
      }
    }
    
    // Validate month value - if month is greater than 12, treat it as single digit
    if (limited.includes('/')) {
      const parts = limited.split('/');
      if (parts[0] && parts[0].length === 2) {
        const month = parseInt(parts[0], 10);
        if (month > 12) {
          // If month is > 12, treat first digit as month and second digit as start of year
          return parts[0][0] + '/' + parts[0][1] + (parts[1] || '');
        }
        // Don't allow month 00
        if (month === 0) {
          return parts[0][0] + '/' + (parts[1] || '');
        }
      }
    }
    
    return limited;
  };

  const addEducation = () => {
    const newEntry = { school: "", degree: "", startDate: "", endDate: "", isPublic: false };
    setEducation([...education, newEntry]);
  };

  const deleteEducation = (index) => {
    handleDelete(index);
  };

  const handleInputChange = (index, field, value) => {
    const updated = [...education];
    updated[index][field] = value;
    setEducation(updated);
  };

  const handleDateChange = (index, field, value) => {
    const formattedValue = formatDateInput(value);
    handleInputChange(index, field, formattedValue);
  };

  const toggleEntryVisibility = (index) => {
    const updated = [...education];
    updated[index].isPublic = !updated[index].isPublic;
    setEducation(updated);
  };

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.headerRow}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Education</Text>
          <TouchableOpacity onPress={addEducation}>
            <Text style={styles.addText}>+</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={toggleVisibility}>
          <Text style={[styles.toggleText, { color: isPublic ? "#4CAF50" : "#f44336" }]}> {isPublic ? "Public" : "Private"}</Text>
        </TouchableOpacity>
      </View>

      {education.map((item, index) => (
        <View key={index} style={[styles.card, index > 0 && styles.cardSpacing]}>
          <View style={styles.rowHeader}>
            <Text style={styles.label}>Entry #{index + 1}</Text>

            {/* Individual public/private toggle */}
            <TouchableOpacity onPress={() => toggleEntryVisibility(index)}>
              <Text style={{ color: item.isPublic ? "#4CAF50" : "#f44336", fontWeight: "bold", marginLeft: 10 }}>{item.isPublic ? "Public" : "Private"}</Text>
            </TouchableOpacity>
          </View>
          <TextInput style={styles.input} placeholder='School' value={item.school} onChangeText={(text) => handleInputChange(index, "school", text)} />
          <TextInput style={styles.input} placeholder='Degree' value={item.degree} onChangeText={(text) => handleInputChange(index, "degree", text)} />
          <View style={styles.dateRow}>
            <TextInput style={styles.dateInput} placeholder='MM/YYYY' value={item.startDate} onChangeText={(text) => handleDateChange(index, "startDate", text)} />
            <Text style={styles.dash}> - </Text>
            <TextInput style={styles.dateInput} placeholder='MM/YYYY' value={item.endDate} onChangeText={(text) => handleDateChange(index, "endDate", text)} />
            <TouchableOpacity onPress={() => deleteEducation(index)}>
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
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#fff",
    width: "35%",
  },
  dash: { fontSize: 16, fontWeight: "bold" },

  deleteIcon: { width: 20, height: 20 },
  cardSpacing: {
    marginTop: 16,
  },
});

export default EducationSection;
