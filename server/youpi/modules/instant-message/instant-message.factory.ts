import { InstantMessage } from "@/server/youpi/modules/instant-message/instant-message.entity";
import { UserFactory } from "@/server/youpi/modules/user/user.factory";
import { InstantMessageWithRelations } from "@/types/prisma";

export class InstantMessageFactory {
  public static createInstantMessage(dbInstantMessage: InstantMessageWithRelations): InstantMessage {
    return new InstantMessage({
      ...dbInstantMessage,
      user: UserFactory.createUser(dbInstantMessage.user),
    });
  }
}
