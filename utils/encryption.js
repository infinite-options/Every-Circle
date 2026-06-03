import CryptoJS from "crypto-js";

const BLOCK_SIZE = 16;

// Match backend: key[:16].ljust(16, b'\0') — always a 16-byte AES-128 key
function getAesKey() {
  const raw = process.env.EXPO_PUBLIC_ENCRYPTION_KEY || "";
  const padded = raw.slice(0, 16).padEnd(16, "\0");
  return CryptoJS.enc.Utf8.parse(padded);
}

// ── Core encrypt / decrypt (CBC mode with IV — matches backend) ──────────────

function encrypt(plainText) {
  if (!plainText) return "";
  try {
    const jsonString = typeof plainText === "string" ? plainText : JSON.stringify(plainText);
    const iv = CryptoJS.lib.WordArray.random(BLOCK_SIZE);
    const encrypted = CryptoJS.AES.encrypt(jsonString, getAesKey(), {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const combined = iv.concat(encrypted.ciphertext);
    return CryptoJS.enc.Base64.stringify(combined);
  } catch (e) {
    console.error("Encryption error:", e);
    return "";
  }
}

function decrypt(encryptedBlob) {
  if (!encryptedBlob) return "";
  try {
    const encryptedData = CryptoJS.enc.Base64.parse(encryptedBlob);
    const iv = CryptoJS.lib.WordArray.create(
      encryptedData.words.slice(0, BLOCK_SIZE / 4)
    );
    const ciphertext = CryptoJS.lib.WordArray.create(
      encryptedData.words.slice(BLOCK_SIZE / 4),
      encryptedData.sigBytes - BLOCK_SIZE
    );
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext },
      getAesKey(),
      { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.error("Decryption error:", e);
    return "";
  }
}

// ── Transport encryption (request payload → backend, backend response → app) ─

/**
 * Encrypt a JSON payload before sending to the backend.
 * Backend expects: { encrypted_data: "<blob>", data_type: false }
 */
function encryptPayload(payloadObject) {
  if (!payloadObject) return payloadObject;
  return {
    encrypted_data: encrypt(payloadObject),
    data_type: false,
  };
}

/**
 * Decrypt a response from the backend.
 * Backend sends: { encrypted_data: "<blob>" }
 */
function decryptResponse(responseObject) {
  if (!responseObject) return responseObject;
  if (responseObject?.encrypted_data) {
    const decrypted = decrypt(responseObject.encrypted_data);
    if (!decrypted) {
      console.warn(
        "[decryptResponse] Decryption returned empty string.\n" +
        "→ Verify EXPO_PUBLIC_ENCRYPTION_KEY (frontend) matches ENCRYPTION_KEY (backend).\n" +
        "→ Both must be the same value; backend uses only the first 16 bytes."
      );
      return null;
    }
    try {
      return JSON.parse(decrypted);
    } catch (e) {
      console.error("[decryptResponse] JSON.parse failed:", e.message, "| decrypted[:80]:", decrypted.slice(0, 80));
      return null;
    }
  }
  return responseObject; // not encrypted — pass through
}

// ── FormData encryption (for multipart requests with files) ──────────────────

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function encryptFormData(formData) {
  const formObject = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File || (value && value.uri)) {
      // Native RN file object or web File
      if (value instanceof File) {
        const fileData = await fileToBase64(value);
        formObject[key] = { fileName: value.name, fileType: value.type, fileData };
      } else {
        // React Native file — can't base64 encode here, skip encryption for binary
        formObject[key] = { fileName: value.name, fileType: value.type, fileData: value.uri };
      }
    } else {
      formObject[key] = String(value);
    }
  }
  return encrypt(formObject);
}

// ── Utility helpers ───────────────────────────────────────────────────────────

function maskDocumentUrl(url) {
  if (!url) return "***";
  const lastSlash = url.lastIndexOf("/");
  return url.substring(0, lastSlash + 1) + "***";
}

function encryptClaimDocuments(docUrlsString) {
  if (!docUrlsString) return "";
  return encrypt(docUrlsString);
}

function decryptClaimDocuments(encryptedDocUrls) {
  if (!encryptedDocUrls) return "";
  const result = decrypt(encryptedDocUrls);
  return result;
}

export {
  encrypt,
  decrypt,
  encryptPayload,
  decryptResponse,
  encryptFormData,
  maskDocumentUrl,
  encryptClaimDocuments,
  decryptClaimDocuments,
};