import AsyncStorage from "@react-native-async-storage/async-storage";
import { DELETE_ACCOUNT_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "./httpMiddleware";
import { clearSessionAsyncStorage } from "./clearAppAsyncStorage";
import { clearUserProfileCacheStorage } from "./sessionProfile";
import { resetSharedAblyClient } from "./ablyClient";
import { stopLiveLocationSharing } from "./liveLocationSharing";

/**
 * DELETE /api/v1/account — permanently delete the authenticated user's account.
 * @returns {{ ok: true, data: object } | { ok: false, status: number, message: string }}
 */
export async function deleteAccountApi() {
  const response = await fetch(DELETE_ACCOUNT_ENDPOINT, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm_deletion: true }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  if (response.ok && (data?.code === 200 || response.status === 200)) {
    return { ok: true, data: data || {} };
  }

  const message =
    data?.message ||
    (response.status === 400
      ? "Please confirm deletion."
      : response.status === 409
        ? "This account has already been deleted."
        : response.status === 404
          ? "Account not found."
          : "Could not delete account. Please try again.");

  return { ok: false, status: response.status, message };
}

/** Clear all local session state after successful account deletion (skip server logout — account is gone). */
export async function clearLocalSessionAfterAccountDeletion() {
  try {
    await stopLiveLocationSharing();
  } catch (_) {}

  resetSharedAblyClient();
  await clearSessionAsyncStorage();
  await clearUserProfileCacheStorage();

  // Belt-and-suspenders: ensure auth keys are gone even if prefix rules change.
  await AsyncStorage.multiRemove(["access_token", "refresh_token", "user_uid", "user_email_id", "profile_uid"]);
}
