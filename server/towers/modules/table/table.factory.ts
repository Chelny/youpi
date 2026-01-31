import { Player } from "@/server/towers/modules/player/player.entity";
import { PlayerFactory } from "@/server/towers/modules/player/player.factory";
import { Room } from "@/server/towers/modules/room/room.entity";
import { RoomFactory } from "@/server/towers/modules/room/room.factory";
import { Table, TablePlainObject } from "@/server/towers/modules/table/table.entity";
import { TableManager } from "@/server/towers/modules/table/table.manager";
import {
  TableChatMessage,
  TableChatMessageVariables,
} from "@/server/towers/modules/table-chat-message/table-chat-message.entity";
import { TableInvitation } from "@/server/towers/modules/table-invitation/table-invitation.entity";
import { TablePlayer } from "@/server/towers/modules/table-player/table-player.entity";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";
import {
  TowersPlayerLite,
  TowersTableChatMessageWithRelations,
  TowersTableInvitationWithRelations,
  TowersTablePlayerWithRelations,
  TowersTableSeatWithRelations,
  TowersTableWithRelations,
} from "@/types/prisma";
import { isObject } from "@/utils/object";

export class TableFactory {
  public static convertToPlainObject(dbTable: TowersTableWithRelations, userId: string): TablePlainObject {
    const room: Room = RoomFactory.createRoom(dbTable.room);
    const hostPlayer: Player = PlayerFactory.createPlayer(dbTable.hostPlayer);
    const table: Table = new Table({ ...dbTable, room, hostPlayer });

    table.players = dbTable.players.map((tp: TowersTablePlayerWithRelations) => {
      const dbPlayer: TowersPlayerLite = tp.player;
      const player: Player = PlayerFactory.createPlayer(dbPlayer);
      const tablePlayer: TablePlayer = new TablePlayer({ id: tp.id, table, player });

      tablePlayer.createdAt = tp.createdAt;
      tablePlayer.updatedAt = tp.updatedAt;

      return tablePlayer;
    });

    table.seats = dbTable.seats.reduce((acc: TableSeat[], t: TowersTableSeatWithRelations) => {
      const tablePlayer: TablePlayer | undefined = table.players.find(
        (tp: TablePlayer) => tp.playerId === t.occupiedByPlayerId,
      );
      if (!tablePlayer) return acc;

      acc.push(new TableSeat({ ...t, occupiedByPlayer: tablePlayer.player }));

      return acc;
    }, [] as TableSeat[]);

    table.chatMessages = dbTable.chatMessages.reduce(
      (acc: TableChatMessage[], rcm: TowersTableChatMessageWithRelations) => {
        const tablePlayer: TablePlayer | undefined = table.players.find(
          (tp: TablePlayer) => tp.player.id === rcm.playerId,
        );
        if (!tablePlayer) return acc;

        const variables: TableChatMessageVariables | null =
          rcm.textVariables && isObject(rcm.textVariables) ? (rcm.textVariables as TableChatMessageVariables) : null;

        acc.push(new TableChatMessage({ ...rcm, player: tablePlayer.player, textVariables: variables }));

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

      return new TableInvitation({ ...invitation, room, table, inviterPlayer, inviteePlayer });
    });

    return TableManager.tableViewForPlayer(table, userId);
  }
}
