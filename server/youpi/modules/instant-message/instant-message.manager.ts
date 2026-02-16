import { logger } from "better-auth";
import { InstantMessageType } from "db/client";
import { InstantMessageCreateInput } from "db/models";
import { INSTANT_MESSAGE_MAX_LENGTH } from "@/constants/game";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import { PlayerManager } from "@/server/towers/modules/player/player.manager";
import { instantMessageVariablesToJson } from "@/server/towers/utils/instant-messages";
import { Conversation } from "@/server/youpi/modules/conversation/conversation.entity";
import { ConversationManager } from "@/server/youpi/modules/conversation/conversation.manager";
import { ConversationParticipantService } from "@/server/youpi/modules/conversation-participant/conversation-participant.service";
import { InstantMessage, InstantMessageVariables } from "@/server/youpi/modules/instant-message/instant-message.entity";
import { InstantMessageFactory } from "@/server/youpi/modules/instant-message/instant-message.factory";
import { InstantMessageService } from "@/server/youpi/modules/instant-message/instant-message.service";
import { User } from "@/server/youpi/modules/user/user.entity";
import { InstantMessageWithRelations } from "@/types/prisma";

export class InstantMessageManager {
  private static cache: Map<string, InstantMessage> = new Map<string, InstantMessage>();

  public static async create(data: InstantMessageCreateInput, conversation: Conversation): Promise<InstantMessage> {
    const dbInstantMessage: InstantMessageWithRelations = await InstantMessageService.create(data);
    const instantMessage: InstantMessage = InstantMessageFactory.createInstantMessage(dbInstantMessage);

    this.cache.set(instantMessage.id, instantMessage);
    conversation.addMessage(instantMessage);

    for (const participant of conversation.participants) {
      if (participant.removedAt !== null) continue;

      const unreadConversationsCount: number = await ConversationManager.getUnreadConversationsCount(participant.userId);

      await publishRedisEvent(ServerInternalEvents.CONVERSATION_MESSAGE_SEND, {
        userId: participant.userId,
        conversation: conversation.toPlainObject(),
        unreadConversationsCount,
      });
    }

    return instantMessage;
  }

  public static async sendMessage(
    conversationId: string,
    sender: User,
    recipient: User,
    text: string,
    type: InstantMessageType = InstantMessageType.CHAT,
  ): Promise<void> {
    const conversation: Conversation = await ConversationManager.findById(conversationId);

    const trimmedText: string = text?.trim();

    if (!trimmedText) {
      throw new Error("Cannot send an empty message");
    }

    if (trimmedText.length > INSTANT_MESSAGE_MAX_LENGTH) {
      throw new Error(`Message exceeds maximum length of ${INSTANT_MESSAGE_MAX_LENGTH} characters`);
    }

    await this.create(
      {
        conversation: {
          connect: { id: conversation.id },
        },
        user: {
          connect: { id: sender.id },
        },
        text: trimmedText,
        type,
        textVariables: undefined,
        visibleToUserId: null,
      },
      conversation,
    );

    logger.debug(`IM Thread ${conversation.id} | ${sender.username} → ${recipient.username}: ${trimmedText}`);

    await PlayerManager.updateLastActiveAt(sender.id);

    // Restore conversation if removed in client
    await ConversationParticipantService.restore(conversation.id, recipient.id);
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
    const conversation: Conversation = await ConversationManager.findById(conversationId);

    await this.create(
      {
        conversation: {
          connect: { id: conversation.id },
        },
        user: {
          connect: { id: sender.id },
        },
        text: null,
        type,
        textVariables: instantMessageVariablesToJson(textVariables),
        visibleToUserId,
      },
      conversation,
    );

    logger.debug(`IM Thread ${conversation.id} | [SYSTEM] ${type} for ${recipient.username}`);

    await ConversationManager.markAsRead(conversation.id, sender.id);
    await ConversationManager.markAsRead(conversation.id, recipient.id);
  }

  public static async delete(id: string): Promise<void> {
    await InstantMessageService.delete(id);
    this.cache.delete(id);
  }
}
