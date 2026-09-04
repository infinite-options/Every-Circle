// Drop-in replacements for fetch and axios that automatically encrypt
// outgoing JSON bodies and decrypt incoming JSON responses for the local
// Every-Circle backend. Use as:
//   import { fetchMiddleware as fetch, axiosMiddleware as axios } from "../utils/httpMiddleware";

import axios from "axios";
import { API_BASE_URL } from "../apiConfig";
import { encryptPayload, decryptResponse } from "./encryption";
import { isPrivacyModeEnabled, loadPrivacyMode } from "./privacyMode";
import { getAccessToken, refreshCircleTokens, handleAuthSessionExpired } from "./authSession";

// Restore persisted privacy-mode preference as soon as the module loads
loadPrivacyMode().catch(() => {});

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

/** Login/social/refresh/logout/reactivate must not trigger a refresh-retry loop. */
function shouldSkipAuthRefresh(url) {
  if (!url || typeof url !== "string") return true;
  return /\/api\/v1\/auth\/(login|social|refresh|logout)(\/|$|\?)/.test(url) || /\/api\/v1\/account\/reactivate(\/|$|\?)/.test(url);
}

/** Do not send a leftover access token to login/social/refresh/reactivate. */
function shouldAttachAccessToken(url) {
  if (!isLocalBackend(url)) return false;
  return !/\/api\/v1\/auth\/(login|social|refresh)(\/|$|\?)/.test(url) && !/\/api\/v1\/account\/reactivate(\/|$|\?)/.test(url);
}

function mergeHeaders(headers, extra) {
  if (headers && typeof headers.set === "function" && typeof headers.entries === "function") {
    const next = Object.fromEntries(headers.entries());
    return { ...next, ...extra };
  }
  return { ...(headers || {}), ...extra };
}

async function attachAccessToken(url, headers) {
  if (!shouldAttachAccessToken(url)) return headers;
  const accessToken = await getAccessToken();
  if (!accessToken) return headers;
  return mergeHeaders(headers, { Authorization: `Bearer ${accessToken}` });
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
    if (this._local) {
      const hasEncrypted = raw && typeof raw === "object" && "encrypted_data" in raw;
      console.log("[httpMiddleware] raw keys:", raw ? Object.keys(raw) : null, "| has encrypted_data:", hasEncrypted, "| privacy:", isPrivacyModeEnabled());
    }
    return this._local ? (decryptResponse(raw) ?? raw) : raw;
  }

  text() { return this._res.text(); }
  blob() { return this._res.blob(); }
  arrayBuffer() { return this._res.arrayBuffer(); }
  clone() { return this._res.clone(); }
}

export async function fetchMiddleware(url, options = {}) {
  const local = isLocalBackend(url);
  const privacy = local && isPrivacyModeEnabled();
  let opts = { ...options };

  opts.headers = await attachAccessToken(url, opts.headers);

  if (privacy) {
    opts.headers = mergeHeaders(opts.headers, { "X-Privacy-Mode": "true" });
    if (opts.body && typeof opts.body === "string" && !alreadyEncrypted(opts.body)) {
      try {
        opts = { ...opts, body: JSON.stringify(encryptPayload(JSON.parse(opts.body))) };
      } catch { /* FormData or non-JSON — pass through unchanged */ }
    }
  }

  const response = await fetch(url, opts);

  if (local && response.status === 401 && !options._authRetry && !shouldSkipAuthRefresh(url)) {
    const refreshed = await refreshCircleTokens();
    if (refreshed) {
      return fetchMiddleware(url, { ...options, _authRetry: true });
    }
    await handleAuthSessionExpired();
  }

  return new DecryptingResponse(response, local);
}

// ── axios wrapper ─────────────────────────────────────────────────────────────

export const axiosMiddleware = axios.create();

axiosMiddleware.interceptors.request.use(async (config) => {
  const url = config.url || "";
  if (shouldAttachAccessToken(url)) {
    const accessToken = await getAccessToken();
    if (accessToken) {
      if (config.headers && typeof config.headers.set === "function") {
        config.headers.set("Authorization", `Bearer ${accessToken}`);
      } else {
        config.headers = mergeHeaders(config.headers, { Authorization: `Bearer ${accessToken}` });
      }
    }
  }
  if (isLocalBackend(url) && isPrivacyModeEnabled()) {
    if (config.headers && typeof config.headers.set === "function") {
      config.headers.set("X-Privacy-Mode", "true");
    } else {
      config.headers = mergeHeaders(config.headers, { "X-Privacy-Mode": "true" });
    }
    if (config.data && typeof config.data === "object" && !config.data.encrypted_data && !(config.data instanceof FormData)) {
      config.data = encryptPayload(config.data);
    }
  }
  return config;
});

axiosMiddleware.interceptors.response.use(
  (response) => {
    if (isLocalBackend(response.config?.url ?? "")) {
      response.data = decryptResponse(response.data) ?? response.data;
    }
    return response;
  },
  async (error) => {
    const original = error.config;
    const url = original?.url || "";
    if (error.response?.status === 401 && original && !original._authRetry && !shouldSkipAuthRefresh(url) && isLocalBackend(url)) {
      original._authRetry = true;
      const refreshed = await refreshCircleTokens();
      if (refreshed) {
        const accessToken = await getAccessToken();
        if (accessToken) {
          if (original.headers && typeof original.headers.set === "function") {
            original.headers.set("Authorization", `Bearer ${accessToken}`);
          } else {
            original.headers = mergeHeaders(original.headers, { Authorization: `Bearer ${accessToken}` });
          }
        }
        return axiosMiddleware(original);
      }
      await handleAuthSessionExpired();
    }
    return Promise.reject(error);
  },
);
