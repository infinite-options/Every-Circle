import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Modal, FlatList, SafeAreaView, Image, Dimensions, TextInput } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import BottomNavBar from "../components/BottomNavBar";

export default function FilterScreen({ navigation }) {
  const [distanceEnabled, setDistanceEnabled] = useState(true);
  const [networkEnabled, setNetworkEnabled] = useState(true);
  const [bountyEnabled, setBountyEnabled] = useState(false);
  const [ratingEnabled, setRatingEnabled] = useState(true);

  const [distance, setDistance] = useState(15);
  const [network, setNetwork] = useState(4);
  const [bounty, setBounty] = useState("Any");
  const [rating, setRating] = useState(4);

  const [distanceModalVisible, setDistanceModalVisible] = useState(false);
  const [networkModalVisible, setNetworkModalVisible] = useState(false);
  const [bountyModalVisible, setBountyModalVisible] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);

  const distanceOptions = [5, 10, 15, 25, 50, 100];
  const networkOptions = [1, 2, 3, 4, 5];
  const bountyOptions = ["Any", "Low", "Medium", "High"];
  const ratingOptions = ["> 1", "> 2", "> 3", "> 4", "> 4.5"];

  // Render option item for modals
  const renderOptionItem = (options, selectedValue, onSelect) => {
    return ({ item }) => {
      const isSelected = typeof item === "string" ? item === selectedValue : selectedValue === item || (typeof item === "string" && item.includes(selectedValue.toString()));

      return (
        <TouchableOpacity
          style={[styles.optionItem, isSelected && styles.selectedOption]}
          onPress={() => {
            onSelect(typeof item === "string" && item.startsWith(">") ? parseInt(item.slice(1).trim()) : item);
          }}
        >
          <Text style={[styles.optionText, isSelected && styles.selectedOptionText]}>{item}</Text>
          {isSelected && <Ionicons name='checkmark' size={24} color='#9C45F7' />}
        </TouchableOpacity>
      );
    };
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Filters</Text>
      </View>

      {/* Scrollable Filter Options */}
      <ScrollView style={styles.filterContent} contentContainerStyle={styles.scrollContent}>
        {/* Distance Filter */}
        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>Distance</Text>
          <Text style={[styles.filterValue, !distanceEnabled && styles.disabledText]}>{distance} mi</Text>
          <TouchableOpacity style={[styles.circleButton, !distanceEnabled && styles.disabledButton]} onPress={() => distanceEnabled && setDistanceModalVisible(true)} disabled={!distanceEnabled}>
            <Ionicons name='chevron-down' size={24} color={distanceEnabled ? "black" : "#ccc"} />
          </TouchableOpacity>
          <Switch value={distanceEnabled} onValueChange={setDistanceEnabled} trackColor={{ false: "#eee", true: "#222" }} thumbColor='#fff' style={styles.switch} />
        </View>

        {/* Network Filter */}
        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>Network</Text>
          <View style={styles.filterValueContainer}>
            <Text style={[styles.filterValue, !networkEnabled && styles.disabledText]}>{network}</Text>
            {networkEnabled && (
              <View style={styles.ratingIndicator}>
                <View style={styles.ratingLine}></View>
                <View style={styles.ratingDot}></View>
              </View>
            )}
          </View>
          <TouchableOpacity style={[styles.circleButton, !networkEnabled && styles.disabledButton]} onPress={() => networkEnabled && setNetworkModalVisible(true)} disabled={!networkEnabled}>
            <Ionicons name='chevron-down' size={24} color={networkEnabled ? "black" : "#ccc"} />
          </TouchableOpacity>
          <Switch value={networkEnabled} onValueChange={setNetworkEnabled} trackColor={{ false: "#eee", true: "#222" }} thumbColor='#fff' style={styles.switch} />
        </View>

        {/* Bounty Filter */}
        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>Bounty</Text>
          <Text style={[styles.filterValue, !bountyEnabled && styles.disabledText]}>{bounty}</Text>
          <TouchableOpacity style={[styles.circleButton, !bountyEnabled && styles.disabledButton]} onPress={() => bountyEnabled && setBountyModalVisible(true)} disabled={!bountyEnabled}>
            <Ionicons name='chevron-down' size={24} color={bountyEnabled ? "black" : "#ccc"} />
          </TouchableOpacity>
          <Switch value={bountyEnabled} onValueChange={setBountyEnabled} trackColor={{ false: "#eee", true: "#222" }} thumbColor='#fff' style={styles.switch} />
        </View>

        {/* Rating Filter */}
        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>Rating</Text>
          <View style={styles.filterValueContainer}>
            <Text style={[styles.filterValue, !ratingEnabled && styles.disabledText]}>{"> " + rating}</Text>
            {ratingEnabled && <View style={styles.ratingDot}></View>}
          </View>
          <TouchableOpacity style={[styles.circleButton, !ratingEnabled && styles.disabledButton]} onPress={() => ratingEnabled && setRatingModalVisible(true)} disabled={!ratingEnabled}>
            <Ionicons name='chevron-down' size={24} color={ratingEnabled ? "black" : "#ccc"} />
          </TouchableOpacity>
          <Switch value={ratingEnabled} onValueChange={setRatingEnabled} trackColor={{ false: "#eee", true: "#222" }} thumbColor='#fff' style={styles.switch} />
        </View>

        {/* Banner Ad */}
        <View style={styles.bannerAd}>
          <Text style={styles.bannerAdText}>Relevant Banner Ad</Text>
        </View>
      </ScrollView>

      {/* Distance Selection Modal */}
      <Modal animationType='slide' transparent={true} visible={distanceModalVisible} onRequestClose={() => setDistanceModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Distance</Text>
              <TouchableOpacity onPress={() => setDistanceModalVisible(false)}>
                <Ionicons name='close' size={28} color='#333' />
              </TouchableOpacity>
            </View>
            <FlatList
              data={distanceOptions.map((d) => `${d} mi`)}
              renderItem={renderOptionItem(
                distanceOptions.map((d) => `${d} mi`),
                `${distance} mi`,
                (value) => {
                  setDistance(parseInt(value));
                  setDistanceModalVisible(false);
                }
              )}
              keyExtractor={(item) => item.toString()}
              style={styles.optionsList}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Network Selection Modal */}
      <Modal animationType='slide' transparent={true} visible={networkModalVisible} onRequestClose={() => setNetworkModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Network</Text>
              <TouchableOpacity onPress={() => setNetworkModalVisible(false)}>
                <Ionicons name='close' size={28} color='#333' />
              </TouchableOpacity>
            </View>
            <FlatList
              data={networkOptions}
              renderItem={renderOptionItem(networkOptions, network, (value) => {
                setNetwork(value);
                setNetworkModalVisible(false);
              })}
              keyExtractor={(item) => item.toString()}
              style={styles.optionsList}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Bounty Selection Modal */}
      <Modal animationType='slide' transparent={true} visible={bountyModalVisible} onRequestClose={() => setBountyModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Bounty</Text>
              <TouchableOpacity onPress={() => setBountyModalVisible(false)}>
                <Ionicons name='close' size={28} color='#333' />
              </TouchableOpacity>
            </View>
            <FlatList
              data={bountyOptions}
              renderItem={renderOptionItem(bountyOptions, bounty, (value) => {
                setBounty(value);
                setBountyModalVisible(false);
              })}
              keyExtractor={(item) => item.toString()}
              style={styles.optionsList}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Rating Selection Modal */}
      <Modal animationType='slide' transparent={true} visible={ratingModalVisible} onRequestClose={() => setRatingModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Rating</Text>
              <TouchableOpacity onPress={() => setRatingModalVisible(false)}>
                <Ionicons name='close' size={28} color='#333' />
              </TouchableOpacity>
            </View>
            <FlatList
              data={ratingOptions}
              renderItem={renderOptionItem(ratingOptions, `> ${rating}`, (value) => {
                setRating(value);
                setRatingModalVisible(false);
              })}
              keyExtractor={(item) => item.toString()}
              style={styles.optionsList}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Bottom Navigation Bar */}
      <BottomNavBar navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    backgroundColor: "#9C45F7",
    paddingTop: 40,
    paddingBottom: 30,
    alignItems: "center",
    borderBottomLeftRadius: 300,
    borderBottomRightRadius: 300,
  },
  headerText: { color: "#fff", fontSize: 28, fontWeight: "bold" },
  filterContent: { flex: 1 },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  filterItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 22,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  filterLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  filterValue: {
    fontSize: 16,
    marginRight: 20,
    color: "#333",
  },
  disabledText: { color: "#ccc" },
  filterValueContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  ratingLine: {
    width: 24,
    height: 2,
    backgroundColor: "#FFD700",
  },
  ratingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFD700",
    marginLeft: -6,
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },
  disabledButton: { borderColor: "#ccc" },
  switch: { transform: [{ scale: 1.2 }] },
  bannerAd: {
    backgroundColor: "#e0e0e0",
    padding: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 30,
    marginBottom: 15,
  },
  bannerAdText: { fontSize: 16, fontWeight: "bold" },

  navContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  navButton: { alignItems: "center" },
  navLabel: {
    fontSize: 12,
    color: "#333",
    marginTop: 4,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  optionsList: {
    paddingHorizontal: 20,
  },
  optionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  selectedOption: {
    backgroundColor: "#f8f0ff",
  },
  optionText: {
    fontSize: 16,
    color: "#333",
  },
  selectedOptionText: {
    color: "#9C45F7",
    fontWeight: "500",
  },
});
