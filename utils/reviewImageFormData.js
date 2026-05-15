import { Platform } from "react-native";

/**
 * Append review images to FormData using API field names:
 * - img_receipt — receipt image
 * - img_0, img_1, … — uploaded gallery images
 * - img_favorite — favorite image (duplicate file of img_{favoriteIndex})
 *
 * Web: must use File/Blob (browser FormData ignores { uri, name, type }).
 * Native: uses { uri, name, type } for React Native networking.
 */

const isBlobOrDataUri = (uri) => uri && (typeof uri === "string") && (uri.startsWith("blob:") || uri.startsWith("data:"));

function extensionFromName(name, fallback = "jpg") {
  if (!name || typeof name !== "string") return fallback;
  const parts = name.split(".");
  if (parts.length < 2) return fallback;
  const ext = parts[parts.length - 1].split(/[?#]/)[0].toLowerCase();
  return ext || fallback;
}

function mimeFromName(name, fallback = "image/jpeg") {
  const ext = extensionFromName(name, "");
  if (!ext) return fallback;
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return fallback;
}

/**
 * Resolve a DocumentPicker asset (or similar) to a value FormData.append accepts.
 */
export async function resolveUploadFile(asset, fallbackName) {
  if (!asset) return null;

  const name = asset.name || fallbackName;
  const mimeType = asset.mimeType || mimeFromName(name, "image/jpeg");
  const uri = asset.uri;

  // Expo DocumentPicker on web often provides a real File.
  if (Platform.OS === "web" && asset.file instanceof File) {
    if (asset.file.name !== name) {
      return new File([asset.file], name, { type: asset.file.type || mimeType });
    }
    return asset.file;
  }

  if (Platform.OS === "web" && uri && isBlobOrDataUri(uri)) {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new File([blob], name, { type: blob.type || mimeType });
  }

  if (Platform.OS === "web" && uri) {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new File([blob], name, { type: blob.type || mimeType });
    } catch (e) {
      console.warn("reviewImageFormData: could not read file for web upload", uri, e);
      return null;
    }
  }

  if (uri && (uri.startsWith("file:") || uri.startsWith("content:") || uri.startsWith("blob:") || uri.startsWith("data:"))) {
    return {
      uri,
      name,
      type: mimeType,
    };
  }

  return null;
}

export async function appendReviewImagesToFormData(formData, { receiptFile, uploadedImages = [], favoriteIndex = 0 }) {
  const log = [];

  if (receiptFile) {
    const file = await resolveUploadFile(receiptFile, "img_receipt.jpg");
    if (file) {
      formData.append("img_receipt", file);
      log.push("img_receipt");
    } else {
      log.push("img_receipt (failed to prepare file)");
    }
  }

  const resolvedGallery = [];
  for (let index = 0; index < uploadedImages.length; index++) {
    const asset = uploadedImages[index];
    const key = `img_${index}`;
    const file = await resolveUploadFile(asset, `${key}.jpg`);
    if (file) {
      formData.append(key, file);
      resolvedGallery.push(file);
      log.push(key);
    } else {
      log.push(`${key} (failed to prepare file)`);
    }
  }

  if (resolvedGallery.length > 0) {
    const favIdx = favoriteIndex >= 0 && favoriteIndex < resolvedGallery.length ? favoriteIndex : 0;
    const favoriteSource = resolvedGallery[favIdx];
    let favoriteFile = favoriteSource;

    if (Platform.OS === "web" && favoriteSource instanceof File) {
      favoriteFile = new File([favoriteSource], "img_favorite.jpg", {
        type: favoriteSource.type || "image/jpeg",
      });
    } else if (favoriteSource && typeof favoriteSource === "object" && favoriteSource.uri) {
      favoriteFile = {
        uri: favoriteSource.uri,
        name: "img_favorite.jpg",
        type: favoriteSource.type || "image/jpeg",
      };
    }

    formData.append("img_favorite", favoriteFile);
    log.push(`img_favorite (same as img_${favIdx})`);
  }

  return log;
}
