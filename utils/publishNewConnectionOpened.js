import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAblyRealtimeClient } from "./ablyClient";

function waitForAblyConnected(client, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (client.connection.state === "connected") {
      resolve();
      return;
    }
    if (client.connection.state === "closed" || client.connection.state === "failed") {
      reject(new Error(`Ably connection unavailable. State: ${client.connection.state}`));
      return;
    }
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for Ably connection. State: ${client.connection.state}`));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timeout);
      client.connection.off("connected", onConnected);
      client.connection.off("failed", onFailed);
      client.connection.off("closed", onClosed);
    };
    const onConnected = () => {
      cleanup();
      resolve();
    };
    const onFailed = (stateChange) => {
      cleanup();
      reject(new Error(`Ably connection failed. State: ${stateChange?.reason || stateChange}`));
    };
    const onClosed = () => {
      cleanup();
      reject(new Error("Ably connection closed"));
    };
    client.connection.on("connected", onConnected);
    client.connection.on("failed", onFailed);
    client.connection.on("closed", onClosed);
  });
}

function waitForChannelAttached(channel, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (channel.state === "attached") {
      resolve();
      return;
    }
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for channel attachment. State: ${channel.state}`));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timeout);
      channel.off("attached", onAttached);
      channel.off("failed", onFailed);
      channel.off("detached", onDetached);
    };
    const onAttached = () => {
      cleanup();
      resolve();
    };
    const onFailed = (stateChange) => {
      cleanup();
      reject(stateChange?.reason || new Error(`Channel attach failed. State: ${channel.state}`));
    };
    const onDetached = () => {
      cleanup();
      reject(new Error("Channel detached before attach completed"));
    };
    channel.on("attached", onAttached);
    channel.on("failed", onFailed);
    channel.on("detached", onDetached);
    channel.attach((err) => {
      if (err) {
        cleanup();
        reject(err);
      }
    });
  });
}

/**
 * Notify the QR owner (User 1) that someone opened/scanned their connection.
 * Publishes to `/{qrOwnerProfileUid}` with event `new-connection-opened`.
 *
 * @param {string} qrOwnerProfileUid - profile_uid of the person whose QR was scanned
 * @param {{ message?: string, scannerProfileUid?: string, scannerIsNewSignup?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, channel?: string, messageData?: object, error?: string }>}
 */
export async function publishNewConnectionOpened(qrOwnerProfileUid, options = {}) {
  if (!qrOwnerProfileUid) {
    return { ok: false, error: "no profile_uid" };
  }

  try {
    let scannerProfileUid = options.scannerProfileUid ?? null;
    if (!scannerProfileUid) {
      try {
        scannerProfileUid = await AsyncStorage.getItem("profile_uid");
      } catch (_) {
        /* ignore */
      }
    }

    const authClientId = scannerProfileUid || qrOwnerProfileUid;
    const client = createAblyRealtimeClient(authClientId);
    const channelName = `/${qrOwnerProfileUid}`;
    const channel = client.channels.get(channelName);

    await waitForAblyConnected(client);
    await waitForChannelAttached(channel);

    const messageData = {
      message: options.message || "New Connection Page Opened",
      timestamp: new Date().toISOString(),
      profile_uid: qrOwnerProfileUid,
      scanner_profile_uid: scannerProfileUid,
      // When true, QR owner should stay on Connect with Me after Add to Network (scanner still mid-signup).
      scanner_is_new_signup: Boolean(options.scannerIsNewSignup),
    };

    await channel.publish("new-connection-opened", messageData);

    return { ok: true, channel: channelName, messageData };
  } catch (error) {
    console.warn("publishNewConnectionOpened failed:", error?.message || error);
    return { ok: false, error: error?.message || String(error) };
  }
}
