import { createId } from "@paralleldrive/cuid2";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import { Conversation, ConversationProps } from "@/server/youpi/modules/conversation/conversation.entity";
import { ConversationParticipant } from "@/server/youpi/modules/conversation-participant/conversation-participant.entity";
import { ConversationParticipantManager } from "@/server/youpi/modules/conversation-participant/conversation-participant.manager";
import { User } from "@/server/youpi/modules/user/user.entity";
import { UserManager } from "@/server/youpi/modules/user/user.manager";

export class ConversationManager {
  private static conversations: Map<string, Conversation> = new Map<string, Conversation>();

  // ---------- Basic CRUD ------------------------------

  public static get(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  public static all(): Conversation[] {
    return [...this.conversations.values()];
  }

  public static create(props: Omit<ConversationProps, "id">): Conversation {
    const conversation: Conversation = new Conversation({ id: createId(), ...props });
    this.conversations.set(conversation.id, conversation);

    props.participants.forEach((cp: ConversationParticipant) => this.addParticipant(conversation.id, cp.user));

    return conversation;
  }

  public static delete(id: string): void {
    this.conversations.delete(id);
  }

  // ---------- Conversation Actions ------------------------------

  public static getAllByUserId(userId: string): Conversation[] {
    return this.all().filter((conversation: Conversation) =>
      conversation.participants.some((cp: ConversationParticipant) => cp.userId === userId && cp.removedAt === null),
    );
  }

  public static getOrCreateBetweenUsers(senderId: string, recipientId: string): Conversation {
    let conversation: Conversation | undefined = this.all().find((c: Conversation) => {
      const ids: string[] = c.participants.map((cp: ConversationParticipant) => cp.userId);
      return ids.includes(senderId) && ids.includes(recipientId) && ids.length === 2;
    });
    if (conversation) return conversation;

    const sender: User | undefined = UserManager.get(senderId);
    const recipient: User | undefined = UserManager.get(recipientId);

    if (!sender) throw new Error(`Cannot create conversation: user not found (senderId=${senderId})`);
    if (!recipient) throw new Error(`Cannot create conversation: user not found (recipientId=${recipientId})`);

    conversation = this.create({ participants: [], messages: [] });
    this.addParticipant(conversation.id, sender);
    this.addParticipant(conversation.id, recipient);

    return conversation;
  }

  public static addParticipant(conversationId: string, user: User): ConversationParticipant {
    const conversation: Conversation | undefined = this.get(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const participant: ConversationParticipant = ConversationParticipantManager.create({ conversationId, user });
    conversation.addParticipant(participant);

    return participant;
  }

  public static removeParticipant(conversationId: string, participantId: string): void {
    const conversation: Conversation | undefined = this.get(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    conversation.removeParticipant(participantId);
    ConversationParticipantManager.delete(participantId);
  }

  public static getUnreadConversationsCount(userId: string): number {
    const conversations: Conversation[] = ConversationManager.getAllByUserId(userId);

    let unreadCount: number = 0;

    for (const conversation of conversations) {
      const participant: ConversationParticipant | undefined =
        ConversationParticipantManager.getParticipantByConversationIdAndUserId(conversation.id, userId);

      // Ignore muted and removed conversations
      if (!participant || participant.mutedAt || participant.removedAt) continue;

      for (const message of conversation.messages) {
        // Ignore own messages
        if (message.userId === userId) continue;

        // Ignore hidden
        if (message.visibleToUserId && message.visibleToUserId !== userId) continue;

        // If participant hasn't read any messages yet, or readAt is before message creation → unread
        if (!participant.readAt || participant.readAt < message.createdAt) {
          unreadCount++;
        }
      }
    }

    return unreadCount;
  }

  public static async markAsRead(conversationId: string, userId: string): Promise<void> {
    ConversationParticipantManager.markConversationAsRead(conversationId, userId);

    const conversation: Conversation | undefined = this.get(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const unreadConversationsCount: number = ConversationManager.getUnreadConversationsCount(userId);

    await publishRedisEvent(ServerInternalEvents.CONVERSATION_MARK_AS_READ, {
      userId,
      conversation: conversation.toPlainObject(),
      unreadConversationsCount,
    });
  }

  public static async mute(conversationId: string, userId: string): Promise<void> {
    ConversationParticipantManager.muteConversationForUser(conversationId, userId);

    const conversation: Conversation | undefined = this.get(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const unreadConversationsCount: number = ConversationManager.getUnreadConversationsCount(userId);

    await publishRedisEvent(ServerInternalEvents.CONVERSATION_MUTE, {
      userId,
      conversation: conversation.toPlainObject(),
      unreadConversationsCount,
    });
  }

  public static async unmute(conversationId: string, userId: string): Promise<void> {
    ConversationParticipantManager.unmuteConversationForUser(conversationId, userId);

    const conversation: Conversation | undefined = this.get(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const unreadConversationsCount: number = ConversationManager.getUnreadConversationsCount(userId);

    await publishRedisEvent(ServerInternalEvents.CONVERSATION_UNMUTE, {
      userId,
      conversation: conversation.toPlainObject(),
      unreadConversationsCount,
    });
  }

  public static async remove(conversationId: string, userId: string): Promise<void> {
    ConversationParticipantManager.removeConversationForUser(conversationId, userId);

    const unreadConversationsCount: number = ConversationManager.getUnreadConversationsCount(userId);

    await publishRedisEvent(ServerInternalEvents.CONVERSATION_REMOVE, {
      userId,
      conversationId,
      unreadConversationsCount,
    });
  }

  public static async restore(conversationId: string, userId: string): Promise<void> {
    const conversation: Conversation | undefined = this.all().find(
      (conversation: Conversation) => conversation.id === conversationId,
    );
    if (!conversation) return;

    ConversationParticipantManager.restoreConversationForUser(conversation, userId);

    const unreadConversationsCount: number = ConversationManager.getUnreadConversationsCount(userId);

    await publishRedisEvent(ServerInternalEvents.CONVERSATION_RESTORE, {
      userId,
      conversation: conversation.toPlainObject(),
      unreadConversationsCount,
    });
  }
}
