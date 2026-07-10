import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { getReviewDisplayImages } from "../utils/resolveReviewImages";

export default function ReviewImageStrip({ review, darkMode = false, style }) {
  const images = getReviewDisplayImages(review);
  if (!images.length) return null;

  return (
    <View style={[styles.row, style]}>
      {images.map((uri, index) => (
        <Image
          key={`${uri}-${index}`}
          source={{ uri }}
          style={[styles.thumb, index === 0 && styles.favoriteThumb, darkMode && styles.thumbDark]}
          resizeMode='cover'
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  favoriteThumb: {
    borderWidth: 2,
    borderColor: "#9C45F7",
  },
  thumbDark: {
    backgroundColor: "#404040",
    borderColor: "#555",
  },
});
