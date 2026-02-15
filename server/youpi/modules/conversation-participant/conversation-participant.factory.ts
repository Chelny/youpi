import {
  ConversationParticipant,
  ConversationParticipantPlainObject,
} from "@/server/youpi/modules/conversation-participant/conversation-participant.entity";
import { UserFactory } from "@/server/youpi/modules/user/user.factory";
import { ConversationParticipantWithRelations } from "@/types/prisma";

export class ConversationParticipantFactory {
  public static createConversationParticipant(
    dbConversationParticipant: ConversationParticipantWithRelations,
  ): ConversationParticipant {
    return new ConversationParticipant({
      id: dbConversationParticipant.id,
      conversationId: dbConversationParticipant.conversationId,
      user: UserFactory.createUser(dbConversationParticipant.user),
    });
  }

  public static convertToPlainObject(
    dbPlayerStat: ConversationParticipantWithRelations,
  ): ConversationParticipantPlainObject {
    const conversationParticipant: ConversationParticipant = this.createConversationParticipant(dbPlayerStat);
    return conversationParticipant.toPlainObject();
  }

  public static convertManyToPlainObject(
    dbConversationParticipants: ConversationParticipantWithRelations[],
  ): ConversationParticipantPlainObject[] {
    return dbConversationParticipants.map((dbConversationParticipant: ConversationParticipantWithRelations) => {
      return this.convertToPlainObject(dbConversationParticipant);
    });
  }
}
