/**
 * Reply context for Chat navigation + fields forwarded on POST /api/v1/chat/messages
 * when the user sends their first contextual message.
 */

export function buildOfferingReplyContext({ label, quote, profileExpertiseUid, expertiseResponseUid }) {
  const profile_expertise_uid = String(profileExpertiseUid || "").trim();
  const expertise_response_uid = String(expertiseResponseUid || "").trim();
  return {
    type: "offering",
    label: String(label || "").trim(),
    ...(quote ? { quote: String(quote).trim() } : {}),
    ...(profile_expertise_uid ? { profile_expertise_uid } : {}),
    ...(expertise_response_uid ? { expertise_response_uid } : {}),
  };
}

export function buildSeekingReplyContext({ label, quote, profileWishUid, wishResponseUid }) {
  const profile_wish_uid = String(profileWishUid || "").trim();
  const wish_response_uid = String(wishResponseUid || "").trim();
  return {
    type: "seeking",
    label: String(label || "").trim(),
    ...(quote ? { quote: String(quote).trim() } : {}),
    ...(profile_wish_uid ? { profile_wish_uid } : {}),
    ...(wish_response_uid ? { wish_response_uid } : {}),
  };
}

/** Strip empty contextual fields before spreading onto the chat POST body. */
export function chatMessageContextFields(replyContext) {
  if (!replyContext || typeof replyContext !== "object") return {};

  const fields = {};
  const contextType = replyContext.type === "offering" || replyContext.type === "seeking" ? replyContext.type : "";

  const messageContextUid = String(
    replyContext.profile_expertise_uid || replyContext.profile_wish_uid || "",
  ).trim();
  const messageContextResponseUid = String(
    replyContext.expertise_response_uid || replyContext.wish_response_uid || "",
  ).trim();

  if (contextType) fields.message_context_type = contextType;
  if (messageContextUid) fields.message_context_uid = messageContextUid;
  if (messageContextResponseUid) fields.message_context_response_uid = messageContextResponseUid;

  return fields;
}

/** Body for POST /api/v1/chat/messages */
export function buildChatMessagePostBody({ conversationUid, senderUid, body, replyContext }) {
  return {
    conversation_uid: String(conversationUid || "").trim(),
    sender_uid: String(senderUid || "").trim(),
    body: String(body ?? ""),
    ...chatMessageContextFields(replyContext),
  };
}
