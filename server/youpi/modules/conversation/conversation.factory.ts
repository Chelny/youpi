import { Conversation, ConversationPlainObject } from "@/server/youpi/modules/conversation/conversation.entity";
import { ConversationParticipant } from "@/server/youpi/modules/conversation-participant/conversation-participant.entity";
import { InstantMessage } from "@/server/youpi/modules/instant-message/instant-message.entity";
import { UserFactory } from "@/server/youpi/modules/user/user.factory";
import {
  ConversationParticipantWithRelations,
  ConversationWithRelations,
  InstantMessageWithRelations,
} from "@/types/prisma";

export class ConversationFactory {
  public static createConversation(dbConversation: ConversationWithRelations): Conversation {
    const participants: ConversationParticipant[] = dbConversation.participants.map(
      (cp: ConversationParticipantWithRelations) => {
        return new ConversationParticipant({
          ...cp,
          user: UserFactory.createUser(cp.user),
        });
      },
    );

    const messages: InstantMessage[] = dbConversation.messages.map((im: InstantMessageWithRelations) => {
      return new InstantMessage({
        ...im,
        user: UserFactory.createUser(im.user),
      });
    });

    return new Conversation({ id: dbConversation.id, participants, messages });
  }

  public static convertToPlainObject(dbPlayerStat: ConversationWithRelations): ConversationPlainObject {
    const conversation: Conversation = this.createConversation(dbPlayerStat);
    return conversation.toPlainObject();
  }

  public static convertManyToPlainObject(dbConversations: ConversationWithRelations[]): ConversationPlainObject[] {
    return dbConversations.map((dbConversation: ConversationWithRelations) => {
      return this.convertToPlainObject(dbConversation);
    });
  }
}
