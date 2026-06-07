import axios from "axios";
import CryptoJS from "crypto-js";
import { AWS_DEV_API_BASE_URL } from "../apiConfig";
import { withAwsAuthHeaders } from "./authToken";
import { encryptionON as ENCRYPTION_ENABLED } from "../config/encryptionEnv";

// AES Encryption Key — must match backend AES_SECRET_KEY / ENCRYPTION_KEY
const AES_KEY = "IO95120secretkey";
const BLOCK_SIZE = 16;

const POSTMAN_SECRET_HEADER = "Postman-Secret";
const POSTMAN_SECRET_VALUE = "postmansecret";

if (__DEV__) {
  console.log("ENCRYPTION_ENABLED - ", ENCRYPTION_ENABLED);
}

let nativeFetch = null;
let installed = false;

function normalizeHeaders(headers) {
  if (!headers) return {};
  if (typeof headers.toJSON === "function") return headers.toJSON();
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    const out = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  return headers;
}

function hasPostmanSecretBypass(headers) {
  const normalized = normalizeHeaders(headers);
  const match = Object.entries(normalized).find(
    ([key]) => key.toLowerCase() === POSTMAN_SECRET_HEADER.toLowerCase()
  );
  return match?.[1] === POSTMAN_SECRET_VALUE;
}

function resolveRequestUrl(url, baseURL) {
  const raw = String(url ?? "");
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const base = baseURL ?? "";
  if (!base) return raw;
  return `${base.replace(/\/$/, "")}/${raw.replace(/^\//, "")}`;
}

function shouldEncryptRequest(url, headers) {
  if (!ENCRYPTION_ENABLED || hasPostmanSecretBypass(headers)) return false;
  return resolveRequestUrl(url).startsWith(AWS_DEV_API_BASE_URL);
}

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const encryptFormDataPayload = async (formData) => {
  const formObject = {};
  for (const [key, value] of formData.entries()) {
    if (typeof File !== "undefined" && value instanceof File) {
      const fileData = await fileToBase64(value);
      formObject[key] = {
        fileName: value.name,
        fileType: value.type,
        fileData,
      };
    } else if (value && typeof value === "object" && value.uri) {
      formObject[key] = {
        fileName: value.name,
        fileType: value.type,
        fileData: value.uri,
      };
    } else {
      formObject[key] = String(value);
    }
  }
  console.log(" === DEBUG === before encryption: ", formObject);
  return encryptPayload(formObject);
};

function encryptPayload(payload) {
  try {
    const jsonString = JSON.stringify(payload);
    const iv = CryptoJS.lib.WordArray.random(BLOCK_SIZE);
    const encrypted = CryptoJS.AES.encrypt(jsonString, CryptoJS.enc.Utf8.parse(AES_KEY), {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const combined = iv.concat(encrypted.ciphertext);
    return CryptoJS.enc.Base64.stringify(combined);
  } catch (error) {
    console.error("Encryption Error:", error);
    throw new Error("Failed to encrypt payload.");
  }
}

function decryptPayload(encryptedBlob) {
  try {
    const encryptedData = CryptoJS.enc.Base64.parse(encryptedBlob);
    const iv = CryptoJS.lib.WordArray.create(encryptedData.words.slice(0, BLOCK_SIZE / 4));
    const ciphertext = CryptoJS.lib.WordArray.create(
      encryptedData.words.slice(BLOCK_SIZE / 4),
      encryptedData.sigBytes - BLOCK_SIZE
    );
    const decrypted = CryptoJS.AES.decrypt({ ciphertext }, CryptoJS.enc.Utf8.parse(AES_KEY), {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
  } catch (error) {
    console.error("Decryption Error:", error);
    throw new Error("Failed to decrypt payload.");
  }
}

function decryptResponseData(responseData) {
  if (responseData?.encrypted_data) {
    return decryptPayload(responseData.encrypted_data);
  }
  return responseData;
}

/*
 *  === FETCH MIDDLEWARE ===
 */
const fetchMiddleware = async (url, options = {}) => {
  const opts = {
    ...options,
    headers: await withAwsAuthHeaders(url, options.headers),
  };

  if (shouldEncryptRequest(url, opts.headers) && opts.body) {
    if (typeof FormData !== "undefined" && opts.body instanceof FormData) {
      const encryptedFormData = new FormData();
      const encryptedData = await encryptFormDataPayload(opts.body);
      encryptedFormData.append("encrypted_data", encryptedData);
      opts.body = encryptedFormData;
    } else if (typeof opts.body === "string") {
      const payload = JSON.parse(opts.body);
      console.log(" == BEFORE ENCRYPTION == Json data: ", payload);
      opts.body = JSON.stringify({
        encrypted_data: encryptPayload(payload),
        data_type: false,
      });
    }
  }

  try {
    const response = await nativeFetch(url, opts);
    const responseText = await response.text();
    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch {
      return response;
    }

    if (responseData?.encrypted_data) {
      const decryptedData = decryptPayload(responseData.encrypted_data);
      console.log(" == DEBUG == Decrypted response For : ", response.url, " Response: ", decryptedData);
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        url: response.url,
        json: async () => decryptedData,
        text: async () => JSON.stringify(decryptedData),
        blob: async () => response.blob(),
        arrayBuffer: async () => response.arrayBuffer(),
        clone: () => response.clone(),
      };
    }

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      url: response.url,
      json: async () => responseData,
      text: async () => responseText,
      blob: async () => response.blob(),
      arrayBuffer: async () => response.arrayBuffer(),
      clone: () => response.clone(),
    };
  } catch (error) {
    console.error("Fetch Error:", error);
    throw error;
  }
};

/*
 *  === AXIOS MIDDLEWARE ===
 */
const axiosMiddleware = axios.create();

axiosMiddleware.interceptors.request.use(
  async (config) => {
    const requestUrl = resolveRequestUrl(config.url, config.baseURL);
    config.headers = await withAwsAuthHeaders(requestUrl, config.headers);
    if (shouldEncryptRequest(requestUrl, config.headers) && config.data) {
      if (typeof FormData !== "undefined" && config.data instanceof FormData) {
        const encryptedFormData = new FormData();
        const encryptedData = await encryptFormDataPayload(config.data);
        encryptedFormData.append("encrypted_data", encryptedData);
        config.data = encryptedFormData;
      } else {
        console.log(" == BEFORE ENCRYPTION == Json data: ", config.data);
        config.data = {
          encrypted_data: encryptPayload(config.data),
          data_type: false,
        };
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosMiddleware.interceptors.response.use(
  (response) => {
    if (response.data?.encrypted_data) {
      response.data = decryptPayload(response.data.encrypted_data);
    }
    console.log(" == DEBUG == Decrypted response For : ", response.config?.url, " Response: ", response.data);
    return response;
  },
  (error) => {
    if (error.response?.data?.encrypted_data) {
      error.response.data = decryptPayload(error.response.data.encrypted_data);
    }
    return Promise.reject(error);
  }
);

/** Patch global fetch so existing call sites use encryption transparently. */
export function installHttpEncryption() {
  if (installed || typeof globalThis.fetch !== "function") return;
  nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = fetchMiddleware;
  installed = true;
}

export {
  axiosMiddleware,
  fetchMiddleware,
  encryptPayload,
  decryptPayload,
  decryptResponseData,
};
