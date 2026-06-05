import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL, CIRCLES_ENDPOINT } from "../apiConfig";

/**
 * Add a circle connection from a scanned / connect modal flow.
 * @param {string} relatedPersonProfileUid - profile_uid of the person to add
 * @param {object|string} connectionData - relationship object or legacy string
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function addScannedCircleConnection(relatedPersonProfileUid, connectionData) {
  const loggedInProfileUID = await AsyncStorage.getItem("profile_uid");
  if (!loggedInProfileUID) {
    return { ok: false, error: "not_logged_in" };
  }
  if (loggedInProfileUID === relatedPersonProfileUid) {
    return { ok: false, error: "self" };
  }

  const now = new Date();
  const defaultCircleDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const circleDate = typeof connectionData === "object" && connectionData?.date?.trim() ? connectionData.date.trim() : defaultCircleDate;

  const relationship = typeof connectionData === "string" ? connectionData : (connectionData?.relationship ?? null);
  const event = typeof connectionData === "object" ? connectionData.event || "" : "";
  const note = typeof connectionData === "object" ? connectionData.note || "" : "";
  const city = typeof connectionData === "object" ? connectionData.city || "" : "";
  const state = typeof connectionData === "object" ? connectionData.state || "" : "";
  const introducedBy = typeof connectionData === "object" ? connectionData.introducedBy || "" : "";

  let circleNumNodes = null;
  try {
    const pathResponse = await fetch(`${API_BASE_URL}/api/connections_path/${loggedInProfileUID}/${relatedPersonProfileUid}`);
    if (pathResponse.ok) {
      const pathData = await pathResponse.json();
      const combinedPath = pathData.combined_path || "";
      if (combinedPath) {
        const nodes = combinedPath.split(",").filter((n) => n.trim());
        circleNumNodes = Math.max(0, nodes.length - 2) + 1;
      }
    }
  } catch (_) {
    /* optional */
  }

  const requestBody = {
    circle_profile_id: loggedInProfileUID,
    circle_related_person_id: relatedPersonProfileUid,
    circle_relationship: relationship ?? null,
    circle_date: circleDate,
    ...(event && { circle_event: event }),
    ...(note && { circle_note: note }),
    ...(city && { circle_city: city }),
    ...(state && { circle_state: state }),
    ...(introducedBy && { circle_introduced_by: introducedBy }),
    ...(circleNumNodes !== null && { circle_num_nodes: circleNumNodes }),
  };

  const response = await fetch(CIRCLES_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (response.ok) {
    return { ok: true };
  }

  let errorMessage = "Failed to add connection";
  try {
    const errorData = await response.json();
    errorMessage = errorData.message || errorData.error || errorMessage;
  } catch (_) {
    /* ignore */
  }
  return { ok: false, error: errorMessage };
}
