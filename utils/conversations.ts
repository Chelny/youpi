import { ConversationPlainObject } from "@/server/youpi/modules/conversation/conversation.entity";
import { ConversationParticipantPlainObject } from "@/server/youpi/modules/conversation-participant/conversation-participant.entity";

export const getUnreadConversationsCount = (conversation: ConversationPlainObject, userId?: string): number => {
  const currentParticipant: ConversationParticipantPlainObject | undefined = conversation.participants.find(
    (cp: ConversationParticipantPlainObject) => cp.userId === userId,
  );

  // Ignore muted or removed conversation
  if (!currentParticipant || currentParticipant.mutedAt || currentParticipant.removedAt) return 0;

  const lastReadAt: Date | null = currentParticipant.readAt ? new Date(currentParticipant.readAt) : null;

  let unreadCount: number = 0;

  for (const message of conversation.messages) {
    // Ignore own messages
    if (message.userId === userId) continue;

    // Ignore hidden
    if (message.visibleToUserId && message.visibleToUserId !== userId) continue;

    // If participant hasn't read any messages yet, or readAt is before message creation → unread
    if (!lastReadAt || lastReadAt < new Date(message.createdAt)) {
      unreadCount++;
    }
  }

  return unreadCount;
};

export const hasUnreadConversations = (conversations: ConversationPlainObject[], userId?: string): boolean => {
  return conversations.some(
    (conversation: ConversationPlainObject) => getUnreadConversationsCount(conversation, userId) > 0,
  );
};
