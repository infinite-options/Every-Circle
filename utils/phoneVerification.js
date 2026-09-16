import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AUTH_ME_ENDPOINT,
  AUTH_PHONE_SEND_OTP_ENDPOINT,
  AUTH_PHONE_VERIFY_OTP_ENDPOINT,
} from "../apiConfig";
import { fetchMiddleware as fetch } from "./httpMiddleware";

/** Cached from GET /auth/me (and login/verify identity). */
export const AUTH_PHONE_NUMBER_KEY = "auth_phone_number";
export const AUTH_PHONE_VERIFIED_KEY = "auth_phone_verified";

/**
 * Digits for the phone OTP APIs (US 10-digit). Backend also accepts +1….
 */
export function digitsForPhoneApi(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits.slice(0, 10);
}

/** Format as (555) 123-4567 while typing (max 10 digits). */
export function formatPhoneNumberInput(text) {
  const cleaned = String(text || "")
    .replace(/\D/g, "")
    .slice(0, 10);
  const len = cleaned.length;
  if (len === 0) return "";
  if (len < 4) return `(${cleaned}`;
  if (len < 7) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
}

/** Display E.164 or raw phone for settings labels. */
export function formatUsPhoneDisplay(raw) {
  const ten = digitsForPhoneApi(raw);
  if (ten.length !== 10) {
    const s = String(raw || "").trim();
    return s || "";
  }
  return formatPhoneNumberInput(ten);
}

export function isValidUsPhoneInput(raw) {
  return digitsForPhoneApi(raw).length === 10;
}

export function unwrapIdentityPayload(data) {
  if (!data || typeof data !== "object") return null;
  const candidates = [data.result, data.data, data.user, data];
  let fallback = null;
  for (const obj of candidates) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) continue;
    if ("phone_verified" in obj || "phone_number" in obj) return obj;
    if (!fallback && (obj.user_uid || obj.email || obj.profile_id)) fallback = obj;
  }
  return fallback;
}

export async function persistPhoneIdentity(identity) {
  if (!identity || typeof identity !== "object") return;
  const pairs = [];
  if (identity.phone_number != null && String(identity.phone_number).trim() !== "") {
    pairs.push([AUTH_PHONE_NUMBER_KEY, String(identity.phone_number).trim()]);
  }
  if (identity.phone_verified != null) {
    const verified = identity.phone_verified === true || identity.phone_verified === 1 || identity.phone_verified === "1";
    pairs.push([AUTH_PHONE_VERIFIED_KEY, verified ? "1" : "0"]);
  }
  if (pairs.length) {
    await AsyncStorage.multiSet(pairs);
  }
}

export async function getCachedPhoneIdentity() {
  try {
    const [[, phone], [, verified]] = await AsyncStorage.multiGet([AUTH_PHONE_NUMBER_KEY, AUTH_PHONE_VERIFIED_KEY]);
    return {
      phone_number: phone || null,
      phone_verified: verified === "1",
    };
  } catch (_) {
    return { phone_number: null, phone_verified: false };
  }
}

export async function clearCachedPhoneIdentity() {
  try {
    await AsyncStorage.multiRemove([AUTH_PHONE_NUMBER_KEY, AUTH_PHONE_VERIFIED_KEY]);
  } catch (_) {}
}

function apiErrorMessage(json, status, fallback) {
  const msg = json?.message || json?.error || json?.result?.message;
  if (typeof msg === "string" && msg.trim()) return msg.trim();
  if (status === 400) return "Invalid phone number or code format.";
  if (status === 401) return "Incorrect verification code.";
  if (status === 429) return "Too many attempts. Please wait and try again.";
  if (status === 503) return "Could not send SMS. Please try again later.";
  return fallback;
}

/**
 * GET /api/v1/auth/me — source of truth for phone_number + phone_verified.
 */
export async function fetchAuthMe() {
  const response = await fetch(AUTH_ME_ENDPOINT, { method: "GET" });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || (json.code && json.code !== 200)) {
    throw new Error(apiErrorMessage(json, response.status, "Could not load phone status."));
  }
  const identity = unwrapIdentityPayload(json) || {};
  await persistPhoneIdentity(identity);
  return {
    phone_number: identity.phone_number || null,
    phone_verified: Boolean(identity.phone_verified),
    identity,
  };
}

/**
 * POST /api/v1/auth/phone/send-otp
 * @returns {{ ok: true, phone_number: string, expires_in: number } | { ok: false, status: number, message: string }}
 */
export async function sendPhoneOtp(phoneNumber) {
  const phone = digitsForPhoneApi(phoneNumber);
  if (phone.length !== 10) {
    return { ok: false, status: 400, message: "Enter a valid 10-digit US phone number." };
  }
  try {
    const response = await fetch(AUTH_PHONE_SEND_OTP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_number: phone }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || (json.code && json.code !== 200)) {
      return {
        ok: false,
        status: response.status || json.code || 500,
        message: apiErrorMessage(json, response.status, "Could not send verification code."),
      };
    }
    const result = json.result || json.data || {};
    return {
      ok: true,
      phone_number: result.phone_number || phone,
      expires_in: Number(result.expires_in) > 0 ? Number(result.expires_in) : 600,
    };
  } catch (e) {
    return { ok: false, status: 0, message: e?.message || "Could not send verification code." };
  }
}

/**
 * POST /api/v1/auth/phone/verify-otp
 */
export async function verifyPhoneOtp(phoneNumber, otp) {
  const phone = digitsForPhoneApi(phoneNumber);
  const code = String(otp || "").replace(/\D/g, "").slice(0, 6);
  if (phone.length !== 10) {
    return { ok: false, status: 400, message: "Enter a valid 10-digit US phone number." };
  }
  if (code.length !== 6) {
    return { ok: false, status: 400, message: "Enter the 6-digit verification code." };
  }
  try {
    const response = await fetch(AUTH_PHONE_VERIFY_OTP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_number: phone, otp: code }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || (json.code && json.code !== 200)) {
      return {
        ok: false,
        status: response.status || json.code || 500,
        message: apiErrorMessage(json, response.status, "Could not verify code."),
      };
    }
    const identity = unwrapIdentityPayload(json) || {};
    await persistPhoneIdentity(identity);
    return {
      ok: true,
      phone_number: identity.phone_number || phone,
      phone_verified: Boolean(identity.phone_verified),
      identity,
    };
  } catch (e) {
    return { ok: false, status: 0, message: e?.message || "Could not verify code." };
  }
}

export function formatOtpCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
