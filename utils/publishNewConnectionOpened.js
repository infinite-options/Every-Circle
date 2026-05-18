import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAblyRealtimeClient } from "./ablyClient";

function waitForAblyConnected(client, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (client.connection.state === "connected") {
      resolve();
      return;
    }
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for Ably connection. State: ${client.connection.state}`));
    }, timeoutMs);
    const onConnected = () => {
      clearTimeout(timeout);
      client.connection.off("connected", onConnected);
      client.connection.off("failed", onFailed);
      resolve();
    };
    const onFailed = (stateChange) => {
      clearTimeout(timeout);
      client.connection.off("connected", onConnected);
      client.connection.off("failed", onFailed);
      reject(new Error(`Ably connection failed. State: ${stateChange?.reason || stateChange}`));
    };
    client.connection.on("connected", onConnected);
    client.connection.on("failed", onFailed);
  });
}

function waitForChannelAttached(channel, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (channel.state === "attached") {
      resolve();
      return;
    }
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for channel attachment. State: ${channel.state}`));
    }, timeoutMs);
    const onAttached = () => {
      clearTimeout(timeout);
      channel.off("attached", onAttached);
      resolve();
    };
    channel.on("attached", onAttached);
    channel.attach((err) => {
      if (err) {
        clearTimeout(timeout);
        channel.off("attached", onAttached);
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
 * @param {{ message?: string }} [options]
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
    };

    await channel.publish("new-connection-opened", messageData);

    return { ok: true, channel: channelName, messageData };
  } catch (error) {
    console.warn("publishNewConnectionOpened failed:", error?.message || error);
    return { ok: false, error: error?.message || String(error) };
  }
}
