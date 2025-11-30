import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from "react-native";

const ExperienceSection = ({ experience, setExperience, toggleVisibility, isPublic, handleDelete }) => {
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

  const addExperience = () => {
    const newEntry = {
      company: "",
      title: "",
      description: "",
      startDate: "",
      endDate: "",
      isPublic: false,
    };
    setExperience([...experience, newEntry]);
  };

  const deleteExperience = (index) => {
    handleDelete(index);
  };

  const handleInputChange = (index, field, value) => {
    const updatedExperience = [...experience];
    updatedExperience[index][field] = value;
    setExperience(updatedExperience);
  };

  const handleDateChange = (index, field, value) => {
    const formattedValue = formatDateInput(value);
    handleInputChange(index, field, formattedValue);
  };

  return (
    <View style={styles.sectionContainer}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Experience</Text>

          {/* Add Experience Button */}
          <TouchableOpacity onPress={addExperience}>
            <Text style={styles.addText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Public Toggle */}
        <TouchableOpacity onPress={toggleVisibility}>
          <Text style={[styles.toggleText, { color: isPublic ? "#4CAF50" : "#f44336" }]}>{isPublic ? "Public" : "Private"}</Text>
        </TouchableOpacity>
      </View>

      {/* Experience List */}
      {experience.map((item, index) => (
        <View key={index} style={[styles.experienceCard, index > 0 && styles.cardSpacing]}>
          <View style={styles.expHeaderRow}>
            <Text style={styles.label}>Experience #{index + 1}</Text>
            {/* Individual public/private toggle */}
            <TouchableOpacity
              onPress={() => {
                const updated = [...experience];
                updated[index].isPublic = !updated[index].isPublic;
                setExperience(updated);
              }}
            >
              <Text style={{ color: item.isPublic ? "#4CAF50" : "#f44336", fontWeight: "bold", marginLeft: 10 }}>{item.isPublic ? "Public" : "Private"}</Text>
            </TouchableOpacity>
          </View>

          <TextInput style={styles.input} placeholder='Company' value={item.company} onChangeText={(text) => handleInputChange(index, "company", text)} />

          <TextInput style={styles.input} placeholder='Job Title' value={item.title} onChangeText={(text) => handleInputChange(index, "title", text)} />

          <TextInput 
            style={styles.descriptionInput} 
            placeholder='Description' 
            value={item.description} 
            onChangeText={(text) => handleInputChange(index, "description", text)}
            multiline={true}
            textAlignVertical="top"
            scrollEnabled={false}
          />

          <View style={styles.dateContainer}>
            <TextInput style={styles.dateInput} placeholder='MM/YYYY' value={item.startDate} onChangeText={(text) => handleDateChange(index, "startDate", text)} />
            <Text> - </Text>
            <TextInput style={styles.dateInput} placeholder='MM/YYYY' value={item.endDate} onChangeText={(text) => handleDateChange(index, "endDate", text)} />
            <TouchableOpacity onPress={() => deleteExperience(index)} style={styles.deleteButton}>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  label: { fontSize: 18, fontWeight: "bold" },
  addText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },

  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10, // spacing between label and +
  },

  toggleText: { fontSize: 14, fontWeight: "bold" },
  experienceCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
    marginBottom: 8,
    minHeight: 40,
    maxHeight: 120,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
    width: "35%",
  },
  dateSeparator: { fontSize: 16, fontWeight: "bold" },

  deleteIcon: { width: 20, height: 20 },
  expHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardSpacing: {
    marginTop: 16,
  },
});

export default ExperienceSection;
