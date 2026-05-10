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

  const otherImg = imA ? participantImage(conv, "b") : participantImage(conv, "a");
  const otherPublic = imA ? participantImageIsPublic(conv, "b") : participantImageIsPublic(conv, "a");
  const image = otherPublic && otherImg ? otherImg : null;

  const lastSent = conv.message_sent_at || conv.last_message_at || null;
  const preview = conv.message_body != null ? String(conv.message_body) : "";

  const displayName = otherUid || "Chat";

  return {
    conversation_uid: conv.conversation_uid,
    other_uid: otherUid,
    first_name: displayName,
    last_name: "",
    displayName,
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
