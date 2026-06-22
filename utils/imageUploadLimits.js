import { Alert, Platform } from "react-native";
import * as FileSystem from "expo-file-system";

export const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_UPLOAD_LABEL = "2MB";

export function formatImageFileSize(bytes) {
  if (bytes == null || !Number.isFinite(bytes)) return "unknown size";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function alertImageTooLarge(fileSize) {
  const formatted = formatImageFileSize(fileSize);
  const message = `This image (${formatted}) exceeds the ${MAX_IMAGE_UPLOAD_LABEL} upload limit. Please choose a smaller image.`;
  if (Platform.OS === "web" && typeof window !== "undefined" && window.alert) {
    window.alert(message);
  } else {
    Alert.alert("Image too large", message);
  }
}

export function isImageTooLarge(fileSize) {
  return fileSize != null && fileSize > MAX_IMAGE_UPLOAD_BYTES;
}

export function rejectWebImageFile(file) {
  if (!file) return true;
  if (!file.type?.startsWith?.("image/")) {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.alert) {
      window.alert("Please select an image file.");
    } else {
      Alert.alert("Invalid file type", "Please select an image file.");
    }
    return true;
  }
  if (isImageTooLarge(file.size)) {
    alertImageTooLarge(file.size);
    return true;
  }
  return false;
}

export async function resolveImageFileSize(assetOrUri) {
  const uri = typeof assetOrUri === "string" ? assetOrUri : assetOrUri?.uri;
  const directSize = typeof assetOrUri === "object" ? assetOrUri?.fileSize : undefined;
  if (directSize != null && directSize >= 0) return directSize;
  if (!uri) return null;

  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (fileInfo?.size != null && fileInfo.size >= 0) return fileInfo.size;
  } catch (_) {
    /* ignore */
  }

  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    if (blob?.size != null && blob.size >= 0) return blob.size;
  } catch (_) {
    /* ignore */
  }

  return null;
}

export async function rejectNativeImageAsset(asset) {
  const fileSize = await resolveImageFileSize(asset);
  if (isImageTooLarge(fileSize)) {
    alertImageTooLarge(fileSize);
    return true;
  }
  return false;
}
