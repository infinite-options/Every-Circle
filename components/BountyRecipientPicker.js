import React from "react";
import { View, Text, TouchableOpacity, Image, TextInput } from "react-native";
import { parsePrice } from "../utils/priceUtils";
import { getBountyEligibleReviews, productHasBounty, sortReviewsForBountyPicker } from "../utils/bountyRecipientUtils";

/**
 * "Who referred you?" picker shown in the add-to-cart quantity modal when a product has a bounty.
 */
export default function BountyRecipientPicker({ reviews, selectedService, selectedBountyRecipient, onSelectRecipient, bountySort, onBountySortChange, bountySearch, onBountySearchChange }) {
  const eligible = getBountyEligibleReviews(reviews);
  if (!productHasBounty(selectedService, parsePrice) || eligible.length === 0) {
    return null;
  }

  const sorted = sortReviewsForBountyPicker(eligible, bountySort).slice(0, bountySort === "connection" ? 5 : undefined);

  const filtered = sorted.filter((review) => {
    if (bountySort !== "name" || !bountySearch.trim()) return true;
    const name = [review.profile_personal_first_name, review.profile_personal_last_name].filter(Boolean).join(" ").toLowerCase();
    return name.includes(bountySearch.trim().toLowerCase());
  });

  return (
    <View style={{ marginTop: 16, marginBottom: 8, width: "100%" }}>
      <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 4, textAlign: "center" }}>
        💰 Who referred you? <Text style={{ color: "#FF3B30" }}>*</Text>
      </Text>
      <Text style={{ fontSize: 11, color: "#FF3B30", textAlign: "center", marginBottom: 4 }}>Required — select a reviewer to assign the bounty</Text>
      <Text style={{ fontSize: 12, color: "#888", marginBottom: 10, textAlign: "center" }}>Assign the bounty to a verified reviewer</Text>

      <View style={{ flexDirection: "row", justifyContent: "center", marginBottom: 10, gap: 8 }}>
        <TouchableOpacity
          onPress={() => onBountySortChange("connection")}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 20,
            backgroundColor: bountySort === "connection" ? "#9C45F7" : "#f0e8ff",
          }}
        >
          <Text style={{ color: bountySort === "connection" ? "#fff" : "#9C45F7", fontWeight: "600", fontSize: 12 }}>By Connection</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onBountySortChange("name")}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 20,
            backgroundColor: bountySort === "name" ? "#9C45F7" : "#f0e8ff",
          }}
        >
          <Text style={{ color: bountySort === "name" ? "#fff" : "#9C45F7", fontWeight: "600", fontSize: 12 }}>By Name</Text>
        </TouchableOpacity>
      </View>

      {bountySort === "name" && (
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: "#c4b5fd",
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            fontSize: 14,
            color: "#333",
            backgroundColor: "#fff",
            marginBottom: 10,
            width: "100%",
          }}
          placeholder='Search by name...'
          placeholderTextColor='#aaa'
          value={bountySearch}
          onChangeText={onBountySearchChange}
        />
      )}

      {filtered.map((review) => {
        const isSelected = selectedBountyRecipient?.rating_uid === review.rating_uid;
        const name = [review.profile_personal_first_name, review.profile_personal_last_name].filter(Boolean).join(" ") || `User ${review.rating_profile_id}`;
        return (
          <TouchableOpacity
            key={review.rating_uid}
            onPress={() => onSelectRecipient(isSelected ? null : review)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 10,
              marginBottom: 8,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: isSelected ? "#9C45F7" : "#ddd",
              backgroundColor: isSelected ? "#f5eeff" : "#fafafa",
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: isSelected ? "#9C45F7" : "#ccc",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 10,
              }}
            >
              {isSelected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#9C45F7" }} />}
            </View>

            {review.profile_personal_image ? (
              <Image source={{ uri: review.profile_personal_image }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }} defaultSource={require("../assets/profile.png")} />
            ) : (
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  marginRight: 10,
                  backgroundColor: "#e0e0e0",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontWeight: "bold", color: "#555" }}>{(review.profile_personal_first_name?.charAt(0) || "U").toUpperCase()}</Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600", color: "#333" }}>{name}</Text>
              {review.circle_num_nodes != null ? (
                <Text style={{ fontSize: 12, color: "#888" }}>{`Level ${review.circle_num_nodes} Connection`}</Text>
              ) : (
                <Text style={{ fontSize: 12, color: "#888" }}>Verified reviewer</Text>
              )}
            </View>

            {selectedService?.bs_bounty && (
              <View
                style={{
                  backgroundColor: isSelected ? "#9C45F7" : "#f0e8ff",
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ color: isSelected ? "#fff" : "#9C45F7", fontWeight: "700", fontSize: 12 }}>
                  💰 ${parsePrice(selectedService.bs_bounty).toFixed(2)}
                  {selectedService.bs_bounty_type === "per_item" ? " / item" : " total"}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
