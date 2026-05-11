/**
 * Chat list API helpers — GET /api/v1/chat/conversations/:profile_uid
 * and message rows from GET /api/v1/chat/messages/:conversation_uid
 */

/** API typo "partipant" vs "participant" — accept both. */
function participantImage(conv, side /* 'a' | 'b' */) {
  if (side === "a") {
    return conv.partipant_a_image ?? conv.participant_a_image ?? null;
  }
  return conv.partipant_b_image ?? conv.participant_b_image ?? null;
}

function participantImageIsPublic(conv, side) {
  const v = side === "a" ? conv.partipant_a_image_is_public ?? conv.participant_a_image_is_public : conv.partipant_b_image_is_public ?? conv.participant_b_image_is_public;
  if (v === 0 || v === "0" || v === false) return false;
  return true;
}

function participantFirstName(conv, side) {
  if (side === "a") {
    return conv.partipant_a_first_name ?? conv.participant_a_first_name ?? null;
  }
  return conv.partipant_b_first_name ?? conv.participant_b_first_name ?? null;
}

function participantLastName(conv, side) {
  if (side === "a") {
    return conv.partipant_a_last_name ?? conv.participant_a_last_name ?? null;
  }
  return conv.partipant_b_last_name ?? conv.participant_b_last_name ?? null;
}

/** Backend may send `business_name` or dotted alias `bb.business_name`. */
function conversationBusinessDisplayName(conv) {
  const direct = conv.business_name;
  if (direct != null && String(direct).trim() !== "") return String(direct).trim();
  const dotted = conv["bb.business_name"];
  if (dotted != null && String(dotted).trim() !== "") return String(dotted).trim();
  return "";
}

/**
 * One row from conversations GET → shape used by Inbox / Connect message list.
 * @param {object} conv — raw API row
 * @param {string} myProfileUid — logged-in personal profile uid
 */
export function normalizeConversationListItem(conv, myProfileUid) {
  const my = String(myProfileUid || "").trim();
  const a = String(conv.participant_a_uid ?? "").trim();
  const b = String(conv.participant_b_uid ?? "").trim();
  const otherUid = a === my ? b : a;
  const imA = a === my;
  const otherSide = imA ? "b" : "a";

  const otherImg = imA ? participantImage(conv, "b") : participantImage(conv, "a");
  const otherPublic = imA ? participantImageIsPublic(conv, "b") : participantImageIsPublic(conv, "a");
  let image = otherPublic && otherImg ? otherImg : null;

  const fn = participantFirstName(conv, otherSide);
  const ln = participantLastName(conv, otherSide);
  const fullName = [fn, ln].filter((x) => x != null && String(x).trim() !== "").map((x) => String(x).trim()).join(" ");
  const bizName = conversationBusinessDisplayName(conv);

  /** Human label for Chat header / Inbox row (not the Connect uid line). */
  let displayName = bizName || fullName || otherUid || "Chat";

  /** If other side has no direct image, try business-profile image fields (bpb_* when participant B is business). */
  if (!image) {
    const bpbImg = conv.bpb_partipant_a_image ?? conv.bpb_participant_a_image;
    const bpbPub = conv.bpb_partipant_a_image_is_public ?? conv.bpb_participant_a_image_is_public;
    const bpbOk = bpbPub !== 0 && bpbPub !== "0" && bpbPub !== false && bpbImg;
    if (otherSide === "b" && bpbOk) {
      image = bpbImg;
      if (!fullName && !bizName) {
        const bpbFn = conv.bpb_first_name;
        const bpbLn = conv.bpb_last_name;
        const bpbFull = [bpbFn, bpbLn].filter((x) => x != null && String(x).trim() !== "").map((x) => String(x).trim()).join(" ");
        if (bpbFull) displayName = bpbFull;
      }
    }
  }

  const namePart = bizName || fullName || "";
  /** Connect list: `Business or First Last (uid)` when we have a name; otherwise uid only. */
  const connectListTitle = namePart ? `${namePart} (${otherUid})` : otherUid;

  const fnStr = fn != null ? String(fn).trim() : "";
  const lnStr = ln != null ? String(ln).trim() : "";
  let connectListInitials = "?";
  if (fnStr || lnStr) {
    connectListInitials = `${fnStr.charAt(0)}${lnStr.charAt(0) || ""}`.toUpperCase() || "?";
  } else if (bizName) {
    const letters = bizName.replace(/[^a-zA-Z0-9]/g, "");
    connectListInitials = (letters.slice(0, 2) || bizName.slice(0, 2)).toUpperCase();
  }

  const lastSent = conv.message_sent_at || conv.last_message_at || null;
  const preview = conv.message_body != null ? String(conv.message_body) : "";

  return {
    conversation_uid: conv.conversation_uid,
    other_uid: otherUid,
    first_name: fnStr,
    last_name: lnStr,
    displayName,
    connectListTitle,
    connectListInitials,
    image,
    last_message: preview,
    last_sent_at: lastSent,
    last_message_at: conv.last_message_at || lastSent,
  };
}

/** Parse conversations GET JSON → normalized list (no sort; server order). */
export function normalizeConversationsResponse(json, myProfileUid) {
  if (!json || typeof json !== "object") return [];
  const rows = Array.isArray(json.result) ? json.result : [];
  return rows.map((c) => normalizeConversationListItem(c, myProfileUid));
}

/** Map a message row to UI fields used by ChatScreen (supports legacy keys). */
export function normalizeMessageForUi(m) {
  if (!m || typeof m !== "object") return m;
  const sender = m.message_sender_uid ?? m.sender_uid ?? "";
  const body = m.message_body ?? m.body ?? "";
  const sent = m.message_sent_at ?? m.sent_at ?? "";
  return {
    ...m,
    message_uid: m.message_uid,
    message_sender_uid: sender,
    sender_uid: sender,
    message_body: body,
    body,
    message_sent_at: sent,
    sent_at: sent,
    message_read_at: m.message_read_at ?? m.read_at ?? null,
  };
}

/**
 * API returns messages in DESC order (newest first). Chat UI expects oldest → newest for scrollToEnd.
 */
export function orderMessagesForChatList(messagesAscOrDesc) {
  const list = Array.isArray(messagesAscOrDesc) ? messagesAscOrDesc : [];
  return list.slice().reverse();
}
