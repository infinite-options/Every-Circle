// Drop-in replacements for fetch and axios that automatically encrypt
// outgoing JSON bodies and decrypt incoming JSON responses for the local
// Every-Circle backend. Use as:
//   import { fetchMiddleware as fetch, axiosMiddleware as axios } from "../utils/httpMiddleware";

import axios from "axios";
import { API_BASE_URL } from "../apiConfig";
import { encryptPayload, decryptResponse } from "./encryption";
// Key is set in encryption.js — both sides use "IO95120secretkey" (16 bytes)

function isLocalBackend(url) {
  if (!url || typeof url !== "string") return false;
  return (
    url.startsWith(API_BASE_URL) ||
    url.includes("127.0.0.1") ||
    url.includes("localhost:4090")
  );
}

function alreadyEncrypted(body) {
  try {
    const parsed = typeof body === "string" ? JSON.parse(body) : body;
    return parsed && typeof parsed === "object" && "encrypted_data" in parsed;
  } catch {
    return false;
  }
}

// ── fetch wrapper ─────────────────────────────────────────────────────────────

class DecryptingResponse {
  constructor(response, local) {
    this._res = response;
    this._local = local;
    this.ok = response.ok;
    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this.url = response.url;
  }

  async json() {
    const raw = await this._res.json();
    return this._local ? (decryptResponse(raw) ?? raw) : raw;
  }

  text() { return this._res.text(); }
  blob() { return this._res.blob(); }
  arrayBuffer() { return this._res.arrayBuffer(); }
  clone() { return this._res.clone(); }
}

export async function fetchMiddleware(url, options = {}) {
  const local = isLocalBackend(url);
  let opts = { ...options };

  if (local && opts.body && typeof opts.body === "string" && !alreadyEncrypted(opts.body)) {
    try {
      opts = { ...opts, body: JSON.stringify(encryptPayload(JSON.parse(opts.body))) };
    } catch { /* FormData or non-JSON — pass through unchanged */ }
  }

  const response = await fetch(url, opts);
  return new DecryptingResponse(response, local);
}

// ── axios wrapper ─────────────────────────────────────────────────────────────

export const axiosMiddleware = axios.create();

axiosMiddleware.interceptors.request.use((config) => {
  if (
    isLocalBackend(config.url) &&
    config.data &&
    typeof config.data === "object" &&
    !config.data.encrypted_data
  ) {
    config.data = encryptPayload(config.data);
  }
  return config;
});

axiosMiddleware.interceptors.response.use((response) => {
  if (isLocalBackend(response.config?.url ?? "")) {
    response.data = decryptResponse(response.data) ?? response.data;
  }
  return response;
});
