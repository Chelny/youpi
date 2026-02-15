import { Player } from "@/server/towers/modules/player/player.entity";
import { PlayerFactory } from "@/server/towers/modules/player/player.factory";
import { RoomFactory } from "@/server/towers/modules/room/room.factory";
import { Table } from "@/server/towers/modules/table/table.entity";
import {
  TableChatMessage,
  TableChatMessageVariables,
} from "@/server/towers/modules/table-chat-message/table-chat-message.entity";
import { TableInvitation } from "@/server/towers/modules/table-invitation/table-invitation.entity";
import { TablePlayer } from "@/server/towers/modules/table-player/table-player.entity";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";
import { jsonToTableChatVariables } from "@/server/towers/utils/table-chat-variables";
import {
  TowersPlayerLite,
  TowersTableChatMessageWithRelations,
  TowersTableInvitationWithRelations,
  TowersTableLiteWithRelations,
  TowersTablePlayerWithRelations,
  TowersTableSeatWithRelations,
  TowersTableWithRelations,
} from "@/types/prisma";

export class TableFactory {
  public static createTable(dbTable: TowersTableWithRelations | TowersTableLiteWithRelations): Table {
    return new Table({
      ...dbTable,
      room: RoomFactory.createRoom(dbTable.room),
      hostPlayer: PlayerFactory.createPlayer(dbTable.hostPlayer),
    });
  }

  public static convertToPlainObject(dbTable: TowersTableWithRelations): Table {
    const table: Table = this.createTable(dbTable);

    table.players = dbTable.players.map((tp: TowersTablePlayerWithRelations) => {
      const dbPlayer: TowersPlayerLite = tp.player;
      const player: Player = PlayerFactory.createPlayer(dbPlayer);
      const tablePlayer: TablePlayer = new TablePlayer({ id: tp.id, table, player });

      tablePlayer.createdAt = tp.createdAt;
      tablePlayer.updatedAt = tp.updatedAt;

      return tablePlayer;
    });

    table.seats = dbTable.seats.map((t: TowersTableSeatWithRelations) => {
      const tablePlayer: TablePlayer | undefined = table.players.find(
        (tp: TablePlayer) => tp.playerId === t.occupiedByPlayerId,
      );

      return new TableSeat({ ...t, occupiedByPlayer: tablePlayer ? tablePlayer.player : null });
    });

    table.chatMessages = dbTable.chatMessages.reduce(
      (acc: TableChatMessage[], tcm: TowersTableChatMessageWithRelations) => {
        const tablePlayer: TablePlayer | undefined = table.players.find(
          (tp: TablePlayer) => tp.player.id === tcm.playerId,
        );
        if (!tablePlayer) return acc;

        const variables: TableChatMessageVariables | null = jsonToTableChatVariables(tcm.textVariables);
        acc.push(new TableChatMessage({ ...tcm, player: tablePlayer.player, textVariables: variables }));

        return acc;
      },
      [] as TableChatMessage[],
    );

    table.invitations = dbTable.invitations.map((invitation: TowersTableInvitationWithRelations) => {
      const inviterTablePlayer: TablePlayer | undefined = table.players.find(
        (tp: TablePlayer) => tp.player.id === invitation.inviterPlayerId,
      );

      const inviteeTablePlayer: TablePlayer | undefined = table.players.find(
        (tp: TablePlayer) => tp.player.id === invitation.inviteePlayerId,
      );

      const inviterPlayer: Player = inviterTablePlayer
        ? inviterTablePlayer.player
        : PlayerFactory.createPlayer(invitation.inviterPlayer);

      const inviteePlayer: Player = inviteeTablePlayer
        ? inviteeTablePlayer.player
        : PlayerFactory.createPlayer(invitation.inviteePlayer);

      return new TableInvitation({ ...invitation, room: table.room, table, inviterPlayer, inviteePlayer });
    });

    return table;
  }
}
