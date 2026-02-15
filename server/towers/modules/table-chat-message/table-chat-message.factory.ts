import { PlayerFactory } from "@/server/towers/modules/player/player.factory";
import { TableChatMessage } from "@/server/towers/modules/table-chat-message/table-chat-message.entity";
import { jsonToTableChatVariables } from "@/server/towers/utils/table-chat-variables";
import { TowersTableChatMessageWithRelations } from "@/types/prisma";

export class TableChatMessageFactory {
  public static createTableChatMessage(dbTableChatMessage: TowersTableChatMessageWithRelations): TableChatMessage {
    return new TableChatMessage({
      ...dbTableChatMessage,
      player: PlayerFactory.createPlayer(dbTableChatMessage.player),
      textVariables: jsonToTableChatVariables(dbTableChatMessage.textVariables),
    });
  }
}
