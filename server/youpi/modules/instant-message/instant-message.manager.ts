import { createId } from "@paralleldrive/cuid2";
import { JsonValue } from "@prisma/client/runtime/client";
import { logger } from "better-auth";
import { InstantMessageType } from "db/client";
import { INSTANT_MESSAGE_MAX_LENGTH } from "@/constants/game";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import { PlayerManager } from "@/server/towers/modules/player/player.manager";
import { Conversation } from "@/server/youpi/modules/conversation/conversation.entity";
import { ConversationManager } from "@/server/youpi/modules/conversation/conversation.manager";
import { ConversationParticipantManager } from "@/server/youpi/modules/conversation-participant/conversation-participant.manager";
import {
  InstantMessage,
  InstantMessageProps,
  InstantMessageVariables,
} from "@/server/youpi/modules/instant-message/instant-message.entity";
import { User } from "@/server/youpi/modules/user/user.entity";

export class InstantMessageManager {
  private static instantMessages: Map<string, InstantMessage> = new Map<string, InstantMessage>();

  // ---------- Basic CRUD ------------------------------

  public static get(id: string): InstantMessage | undefined {
    return this.instantMessages.get(id);
  }

  public static all(): InstantMessage[] {
    return [...this.instantMessages.values()];
  }

  public static async create(props: Omit<InstantMessageProps, "id">, conversation: Conversation): Promise<void> {
    const instantMessage: InstantMessage = new InstantMessage({ id: createId(), ...props });
    this.instantMessages.set(instantMessage.id, instantMessage);

    conversation.addMessage(instantMessage);

    for (const participant of conversation.participants) {
      if (participant.removedAt !== null) continue;

      const unreadConversationsCount: number = ConversationManager.getUnreadConversationsCount(participant.userId);

      await publishRedisEvent(ServerInternalEvents.CONVERSATION_MESSAGE_SEND, {
        userId: participant.userId,
        conversation: conversation.toPlainObject(),
        unreadConversationsCount,
      });
    }
  }

  public static delete(id: string): void {
    this.instantMessages.delete(id);
  }

  // ---------- Instant Message Actions ------------------------------

  public static async sendMessage(
    conversationId: string,
    sender: User,
    recipient: User,
    text: string,
    type: InstantMessageType = InstantMessageType.CHAT,
  ): Promise<void> {
    const conversation: Conversation | undefined = ConversationManager.get(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const trimmedText: string = text?.trim();

    if (!trimmedText) {
      throw new Error("Cannot send an empty message");
    }

    if (trimmedText.length > INSTANT_MESSAGE_MAX_LENGTH) {
      throw new Error(`Message exceeds maximum length of ${INSTANT_MESSAGE_MAX_LENGTH} characters`);
    }

    await this.create(
      {
        conversationId: conversation.id,
        user: sender,
        text: trimmedText,
        type,
        textVariables: null,
        visibleToUserId: null,
      },
      conversation,
    );

    logger.debug(`IM Thread ${conversation.id} | ${sender.username} → ${recipient.username}: ${trimmedText}`);

    PlayerManager.updateLastActiveAt(sender.id);

    // Restore conversation if removed in client
    ConversationParticipantManager.restoreConversationForUser(conversation, recipient.id);
  }

  /**
   * Sends an automated/system message into the conversation, such as user disconnect or system notifications.
   *
   * @param user - The system or acting player sending the message.
   * @param recipient - The player who should receive the message.
   * @param type - The type of system message (e.g., USER_OFFLINE).
   * @param textVariables - Optional variables to interpolate into the system message.
   * @param visibleToUserId - If set, the message will be visible only to this user.
   */
  public static async sendAutomatedMessage(
    conversationId: string,
    sender: User,
    recipient: User,
    type: InstantMessageType,
    textVariables: InstantMessageVariables | null,
    visibleToUserId: string | null,
  ): Promise<void> {
    const conversation: Conversation | undefined = ConversationManager.get(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    await this.create(
      {
        conversationId: conversation.id,
        user: sender,
        text: null,
        type,
        textVariables: textVariables as JsonValue,
        visibleToUserId,
      },
      conversation,
    );

    logger.debug(`IM Thread ${conversation.id} | [SYSTEM] ${type} for ${recipient.username}`);

    await ConversationManager.markAsRead(conversation.id, sender.id);
    await ConversationManager.markAsRead(conversation.id, recipient.id);
  }
}
