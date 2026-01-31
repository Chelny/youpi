import { Conversation, ConversationPlainObject } from "@/server/youpi/modules/conversation/conversation.entity";
import { ConversationParticipant } from "@/server/youpi/modules/conversation-participant/conversation-participant.entity";
import { InstantMessage } from "@/server/youpi/modules/instant-message/instant-message.entity";
import { User } from "@/server/youpi/modules/user/user.entity";
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
        const user: User = UserFactory.createUser(cp.user);
        return new ConversationParticipant({ ...cp, user });
      },
    );

    const messages: InstantMessage[] = dbConversation.messages.map((im: InstantMessageWithRelations) => {
      const user: User = UserFactory.createUser(im.user);
      return new InstantMessage({ ...im, user });
    });

    return new Conversation({ id: dbConversation.id, participants, messages });
  }

  public static convertManyToPlainObject(dbConversations: ConversationWithRelations[]): ConversationPlainObject[] {
    return dbConversations.map((dbConversation: ConversationWithRelations) => {
      return this.convertToPlainObject(dbConversation);
    });
  }

  public static convertToPlainObject(dbPlayerStat: ConversationWithRelations): ConversationPlainObject {
    const conversation: Conversation = this.createConversation(dbPlayerStat);
    return conversation.toPlainObject();
  }
}
