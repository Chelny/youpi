import { TowersTableChatMessageCreateInput } from "db/models";
import { CHAT_MESSSAGES_LIMIT } from "@/constants/game";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import { PlayerManager } from "@/server/towers/modules/player/player.manager.ts";
import { TableChatMessage } from "@/server/towers/modules/table-chat-message/table-chat-message.entity";
import { TableChatMessageFactory } from "@/server/towers/modules/table-chat-message/table-chat-message.factory";
import { TableChatMessageService } from "@/server/towers/modules/table-chat-message/table-chat-message.service";
import { TowersTableChatMessageWithRelations } from "@/types/prisma";

export class TableChatMessageManager {
  private static cache: Map<string, TableChatMessage> = new Map<string, TableChatMessage>();

  public static async loadByTableId(tableId: string): Promise<TableChatMessage[]> {
    const dbTableChatMessages: TowersTableChatMessageWithRelations[] =
      await TableChatMessageService.findByTableId(tableId);

    const messages: TableChatMessage[] = dbTableChatMessages.map(
      (dbTableChatMessage: TowersTableChatMessageWithRelations) => {
        const tableChatMessage: TableChatMessage = TableChatMessageFactory.createTableChatMessage(dbTableChatMessage);
        this.cache.set(tableChatMessage.id, tableChatMessage);
        return tableChatMessage;
      },
    );

    const tableMessages: TableChatMessage[] = Array.from(this.cache.values()).filter(
      (tcm: TableChatMessage) => tcm.tableId === tableId,
    );
    if (tableMessages.length > CHAT_MESSSAGES_LIMIT) {
      const toDelete: TableChatMessage[] = tableMessages
        .sort((a: TableChatMessage, b: TableChatMessage) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(0, tableMessages.length - CHAT_MESSSAGES_LIMIT);
      toDelete.forEach((tcm: TableChatMessage) => this.cache.delete(tcm.id));
    }

    return messages.reverse();
  }

  public static async create(props: TowersTableChatMessageCreateInput): Promise<TableChatMessage> {
    const dbTableChatMessage: TowersTableChatMessageWithRelations = await TableChatMessageService.create(props);
    const tableChatMessage: TableChatMessage = TableChatMessageFactory.createTableChatMessage(dbTableChatMessage);

    this.cache.set(tableChatMessage.id, tableChatMessage);
    await PlayerManager.updateLastActiveAt(tableChatMessage.player.id);

    await publishRedisEvent(ServerInternalEvents.TABLE_MESSAGE_SEND, {
      tableId: tableChatMessage.tableId,
      chatMessage: tableChatMessage.toPlainObject(),
    });

    return tableChatMessage;
  }

  public static async delete(id: string): Promise<void> {
    await TableChatMessageService.delete(id);
    this.cache.delete(id);
  }
}
