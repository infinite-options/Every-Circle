import React, { useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from "react-native";

const ExperienceSection = ({ experience, setExperience, toggleVisibility, isPublic, handleDelete, onInputFocus }) => {
  // Stores each rendered card's ref by index so parent can scroll to the new one.
  const cardRefs = useRef({});
  // Tracks which index was just added via "+".
  const pendingNewIndexRef = useRef(null);
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
    // Mark the next card index before state update, then notify parent after render.
    pendingNewIndexRef.current = experience.length;
    const newEntry = {
      company: "",
      title: "",
      description: "",
      startDate: "",
      endDate: "",
      isPublic: true,
    };
    setExperience([...experience, newEntry]);
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
  }, [experience.length, onInputFocus]);

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
        <View style={styles.toggleContainer}>
          <TouchableOpacity onPress={toggleVisibility} style={[styles.togglePill, isPublic && styles.togglePillActiveGreen]}>
            <Text style={[styles.togglePillText, isPublic && styles.togglePillTextActive]}>{isPublic ? "Visible" : "Show"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleVisibility} style={[styles.togglePill, !isPublic && styles.togglePillActiveRed]}>
              <Text style={[styles.togglePillText, !isPublic && styles.togglePillTextActive]}>{!isPublic ? "Hidden" : "Hide"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Experience List */}
      {experience.map((item, index) => (
        <View
          key={index}
          ref={(ref) => {
            // Capture each card ref for new-card scroll targeting.
            if (ref) cardRefs.current[index] = ref;
          }}
          style={[styles.experienceCard, index > 0 && styles.cardSpacing]}
        >
          <View style={styles.expHeaderRow}>
            <Text style={styles.label}>Experience #{index + 1}</Text>
            {/* Individual public/private toggle */}
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                onPress={() => { const u = [...experience]; u[index].isPublic = !u[index].isPublic; setExperience(u); }}
                style={[styles.togglePill, item.isPublic && styles.togglePillActiveGreen]}
              >
                <Text style={[styles.togglePillText, item.isPublic && styles.togglePillTextActive]}>{item.isPublic ? "Visible" : "Show"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { const u = [...experience]; u[index].isPublic = !u[index].isPublic; setExperience(u); }}
                style={[styles.togglePill, !item.isPublic && styles.togglePillActiveRed]}
              >
                <Text style={[styles.togglePillText, !item.isPublic && styles.togglePillTextActive]}>{!item.isPublic ? "Hidden" : "Hide"}</Text>
              </TouchableOpacity>
            </View>
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
  toggleContainer: { flexDirection: "row", gap: 4 },
  togglePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: "transparent" },
  togglePillActiveGreen: { backgroundColor: "#4CAF50" },
  togglePillActiveRed: { backgroundColor: "#ef9a9a" },
  togglePillText: { fontSize: 13, color: "#4e4e4e", fontWeight: "500" },
  togglePillTextActive: { color: "#fff", fontWeight: "bold" },
});

export default ExperienceSection;
