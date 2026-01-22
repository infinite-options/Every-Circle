// BusinessStep4.js
// NOTE: This page is no longer in the business setup flow as of Jan 21, 2026.
// It can be deleted in the future once confirmed it's no longer needed.
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useDarkMode } from "../contexts/DarkModeContext";

const defaultService = {
  bs_service_name: "",
  bs_service_desc: "",
  bs_notes: "",
  bs_sku: "",
  bs_bounty: "",
  bs_bounty_currency: "USD",
  bs_is_taxable: 1,
  bs_tax_rate: "",
  bs_discount_allowed: 1,
  bs_refund_policy: "",
  bs_return_window_days: "",
  bs_display_order: "",
  bs_tags: "",
  bs_duration_minutes: "",
  bs_cost: "",
  bs_cost_currency: "USD",
  bs_is_visible: 1,
  bs_status: "active",
  bs_image_key: "",
};

export default function BusinessStep4({ formData, setFormData, navigation }) {
  const [services, setServices] = useState(formData.business_services || []);
  const [editingIndex, setEditingIndex] = useState(null);
  const [serviceForm, setServiceForm] = useState(defaultService);
  const { darkMode } = useDarkMode();
  console.log("BusinessStep4 - darkMode value:", darkMode);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, business_services: services }));
    AsyncStorage.setItem("businessFormData", JSON.stringify({ ...formData, business_services: services })).catch((err) => console.error("Save error", err));
  }, [services]);

  const handleChange = (field, value) => {
    setServiceForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddOrUpdate = () => {
    // Validate required fields
    if (!serviceForm.bs_service_name.trim()) {
      Alert.alert("Validation", "Product or Service name is required.");
      return;
    }
    let updated;
    if (editingIndex !== null) {
      updated = [...services];
      updated[editingIndex] = serviceForm;
    } else {
      updated = [...services, { ...serviceForm, bs_display_order: services.length + 1 }];
    }
    setServices(updated);
    setServiceForm(defaultService);
    setEditingIndex(null);
  };

  const handleEdit = (index) => {
    setServiceForm(services[index]);
    setEditingIndex(index);
  };

  const handleDelete = (index) => {
    Alert.alert("Delete", "Are you sure you want to delete this service?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const updated = services.filter((_, i) => i !== index);
          setServices(updated);
          setServiceForm(defaultService);
          setEditingIndex(null);
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: darkMode ? "#1a1a1a" : "#f5f5f5" }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 20, paddingBottom: 140, alignItems: "center" }} nestedScrollEnabled={true}>
        <View style={[styles.formCard, darkMode && styles.darkFormCard]}>
          <Text style={[styles.title, darkMode && styles.darkTitle]}>Add Products or Services</Text>

          {/* Product or Service Form */}
          <Text style={[styles.label, darkMode && styles.darkLabel]}>Product or Service Name *</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={serviceForm.bs_service_name}
            onChangeText={(t) => handleChange("bs_service_name", t)}
            placeholder='Product or Service Name'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <Text style={[styles.label, darkMode && styles.darkLabel]}>Description</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={serviceForm.bs_service_desc}
            onChangeText={(t) => handleChange("bs_service_desc", t)}
            placeholder='Description'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <Text style={[styles.label, darkMode && styles.darkLabel]}>Notes</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={serviceForm.bs_notes}
            onChangeText={(t) => handleChange("bs_notes", t)}
            placeholder='Notes'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <Text style={[styles.label, darkMode && styles.darkLabel]}>SKU</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={serviceForm.bs_sku}
            onChangeText={(t) => handleChange("bs_sku", t)}
            placeholder='SKU'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <Text style={[styles.label, darkMode && styles.darkLabel]}>Bounty</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={serviceForm.bs_bounty}
            onChangeText={(t) => handleChange("bs_bounty", t)}
            placeholder='Bounty (e.g. 10.00)'
            keyboardType='decimal-pad'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <Text style={[styles.label, darkMode && styles.darkLabel]}>Bounty Currency</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={serviceForm.bs_bounty_currency}
            onChangeText={(t) => handleChange("bs_bounty_currency", t)}
            placeholder='Currency (e.g. USD)'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <Text style={[styles.label, darkMode && styles.darkLabel]}>Is Taxable (1=Yes, 0=No)</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={String(serviceForm.bs_is_taxable)}
            onChangeText={(t) => handleChange("bs_is_taxable", t.replace(/[^01]/g, ""))}
            placeholder='1 or 0'
            keyboardType='number-pad'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <Text style={[styles.label, darkMode && styles.darkLabel]}>Tax Rate (%)</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={String(serviceForm.bs_tax_rate)}
            onChangeText={(t) => handleChange("bs_tax_rate", t.replace(/[^0-9.]/g, ""))}
            placeholder='Tax Rate (e.g. 8.5)'
            keyboardType='decimal-pad'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <Text style={[styles.label, darkMode && styles.darkLabel]}>Discount Allowed (1=Yes, 0=No)</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={String(serviceForm.bs_discount_allowed)}
            onChangeText={(t) => handleChange("bs_discount_allowed", t.replace(/[^01]/g, ""))}
            placeholder='1 or 0'
            keyboardType='number-pad'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <Text style={[styles.label, darkMode && styles.darkLabel]}>Refund Policy</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={serviceForm.bs_refund_policy}
            onChangeText={(t) => handleChange("bs_refund_policy", t)}
            placeholder='Refund Policy'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <Text style={[styles.label, darkMode && styles.darkLabel]}>Return Window (days)</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={String(serviceForm.bs_return_window_days)}
            onChangeText={(t) => handleChange("bs_return_window_days", t.replace(/[^0-9]/g, ""))}
            placeholder='Return Window (days)'
            keyboardType='number-pad'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <Text style={[styles.label, darkMode && styles.darkLabel]}>Display Order</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={String(serviceForm.bs_display_order)}
            onChangeText={(t) => handleChange("bs_display_order", t.replace(/[^0-9]/g, ""))}
            placeholder='Display Order'
            keyboardType='number-pad'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <Text style={[styles.label, darkMode && styles.darkLabel]}>Tags (comma separated)</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={serviceForm.bs_tags}
            onChangeText={(t) => handleChange("bs_tags", t)}
            placeholder='e.g. haircut,styling'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <Text style={[styles.label, darkMode && styles.darkLabel]}>Duration (minutes)</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={String(serviceForm.bs_duration_minutes)}
            onChangeText={(t) => handleChange("bs_duration_minutes", t.replace(/[^0-9]/g, ""))}
            placeholder='Duration (minutes)'
            keyboardType='number-pad'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <Text style={[styles.label, darkMode && styles.darkLabel]}>Cost</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={serviceForm.bs_cost}
            onChangeText={(t) => handleChange("bs_cost", t)}
            placeholder='Cost (e.g. 25.00)'
            keyboardType='decimal-pad'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <Text style={[styles.label, darkMode && styles.darkLabel]}>Cost Currency</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={serviceForm.bs_cost_currency}
            onChangeText={(t) => handleChange("bs_cost_currency", t)}
            placeholder='Currency (e.g. USD)'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <Text style={[styles.label, darkMode && styles.darkLabel]}>Is Visible (1=Yes, 0=No)</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={String(serviceForm.bs_is_visible)}
            onChangeText={(t) => handleChange("bs_is_visible", t.replace(/[^01]/g, ""))}
            placeholder='1 or 0'
            keyboardType='number-pad'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <Text style={[styles.label, darkMode && styles.darkLabel]}>Status</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={serviceForm.bs_status}
            onChangeText={(t) => handleChange("bs_status", t)}
            placeholder='Status (e.g. active)'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <Text style={[styles.label, darkMode && styles.darkLabel]}>Image Key</Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={serviceForm.bs_image_key}
            onChangeText={(t) => handleChange("bs_image_key", t)}
            placeholder='Image Key (e.g. service_1)'
            placeholderTextColor={darkMode ? "#ffffff" : "#666"}
          />

          <TouchableOpacity style={styles.addButton} onPress={handleAddOrUpdate}>
            <Text style={styles.addButtonText}>{editingIndex !== null ? "Update Service" : "Add Service"}</Text>
          </TouchableOpacity>
        </View>

        {/* List of Added Services */}
        <View style={[styles.formCard, darkMode && styles.darkFormCard]}>
          <Text style={[styles.title, darkMode && styles.darkTitle]}>Added Services</Text>
          {services.length === 0 && <Text style={[styles.noServicesText, darkMode && styles.darkNoServicesText]}>No services added yet.</Text>}
          {services.map((service, idx) => (
            <View key={idx} style={[styles.serviceItem, darkMode && styles.darkServiceItem]}>
              <Text style={[styles.serviceName, darkMode && styles.darkServiceName]}>{service.bs_service_name}</Text>
              <Text style={[styles.serviceDesc, darkMode && styles.darkServiceDesc]}>{service.bs_service_desc}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                {service.bs_cost ? (
                  <Text style={[styles.amountText, darkMode && styles.darkAmountText]}>
                    💰 Cost: {service.bs_cost_currency || "USD"} {service.bs_cost}
                  </Text>
                ) : null}
                {service.bs_bounty ? (
                  <Text style={[styles.amountText, { marginLeft: 12 }, darkMode && styles.darkAmountText]}>
                    💰 Bounty: {service.bs_bounty_currency || "USD"} {service.bs_bounty}
                  </Text>
                ) : null}
              </View>
              <View style={{ flexDirection: "row", marginTop: 8 }}>
                <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(idx)}>
                  <Text style={{ color: "#fff" }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(idx)}>
                  <Text style={{ color: "#fff" }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 30,
    padding: 24,
    width: "90%",
    maxWidth: 420,
    alignSelf: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 10,
  },
  label: {
    color: "#333",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
    alignSelf: "flex-start",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    width: "100%",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  addButton: {
    backgroundColor: "#00C721",
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    alignItems: "center",
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  serviceItem: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  serviceName: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#333",
  },
  serviceDesc: {
    color: "#666",
    fontSize: 14,
    marginTop: 2,
  },
  editBtn: {
    backgroundColor: "#007AFF",
    padding: 8,
    borderRadius: 8,
    marginRight: 10,
  },
  deleteBtn: {
    backgroundColor: "#FF3B30",
    padding: 8,
    borderRadius: 8,
  },
  amountText: {
    fontSize: 15,
    color: "#333",
    fontWeight: "600",
  },

  // Missing styles
  noServicesText: {
    color: "#888",
    textAlign: "center",
  },

  // Dark mode styles
  darkFormCard: {
    backgroundColor: "#2d2d2d",
  },
  darkTitle: {
    color: "#ffffff",
  },
  darkLabel: {
    color: "#ffffff",
  },
  darkInput: {
    backgroundColor: "#404040",
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "#404040",
  },
  darkNoServicesText: {
    color: "#cccccc",
  },
  darkServiceItem: {
    backgroundColor: "#404040",
  },
  darkServiceName: {
    color: "#ffffff",
  },
  darkServiceDesc: {
    color: "#cccccc",
  },
  darkAmountText: {
    color: "#ffffff",
  },
});
