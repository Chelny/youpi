import { logger } from "better-auth";
import { NotificationType, TableChatMessageType, TableType } from "db/client";
import { TowersTableCreateInput } from "db/models";
import { Server as IoServer, Socket } from "socket.io";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import { CipherHeroManager } from "@/server/towers/game/cipher-hero-manager";
import { Game } from "@/server/towers/game/game/game";
import { GameTeams } from "@/server/towers/game/game/game-teams";
import { Notification } from "@/server/towers/modules/notification/notification.entity";
import { NotificationManager } from "@/server/towers/modules/notification/notification.manager";
import { Player } from "@/server/towers/modules/player/player.entity";
import { PlayerManager } from "@/server/towers/modules/player/player.manager.ts";
import { RoomPlayer } from "@/server/towers/modules/room-player/room-player.entity";
import { Table, TablePlainObject } from "@/server/towers/modules/table/table.entity";
import { TableFactory } from "@/server/towers/modules/table/table.factory";
import { TableService } from "@/server/towers/modules/table/table.service";
import { TableBoot } from "@/server/towers/modules/table-boot/table-boot.entity";
import { TableBootManager } from "@/server/towers/modules/table-boot/table-boot.manager";
import {
  TableChatMessage,
  TableChatMessageVariables,
} from "@/server/towers/modules/table-chat-message/table-chat-message.entity";
import { TableChatMessageManager } from "@/server/towers/modules/table-chat-message/table-chat-message.manager";
import { TableInvitation } from "@/server/towers/modules/table-invitation/table-invitation.entity";
import { TableInvitationManager } from "@/server/towers/modules/table-invitation/table-invitation.manager";
import { TablePlayer } from "@/server/towers/modules/table-player/table-player.entity";
import { TablePlayerManager } from "@/server/towers/modules/table-player/table-player.manager";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";
import { TableSeatFactory } from "@/server/towers/modules/table-seat/table-seat.factory";
import { TableSeatManager } from "@/server/towers/modules/table-seat/table-seat.manager";
import { tableChatVariablesToJson } from "@/server/towers/utils/table-chat-variables";
import { User } from "@/server/youpi/modules/user/user.entity";
import { UserRelationshipManager } from "@/server/youpi/modules/user-relationship/user-relationship.manager";
import { TowersTableSeatWithRelations, TowersTableWithRelations } from "@/types/prisma";

export class TableManager {
  private static cache: Map<string, Table> = new Map<string, Table>();

  public static async findById(id: string): Promise<Table> {
    const cached: Table | undefined = this.cache.get(id);
    if (cached) return cached;

    const dbTable: TowersTableWithRelations | null = await TableService.findById(id);
    if (!dbTable) throw new Error("Room not found");

    const table: Table = TableFactory.createTable(dbTable);
    this.cache.set(table.id, table);

    return table;
  }

  public static async create(props: TowersTableCreateInput): Promise<Table> {
    const dbTable: TowersTableWithRelations = await TableService.create(props);
    const table: Table = TableFactory.createTable(dbTable);

    table.seats = dbTable.seats.map((tableSeat: TowersTableSeatWithRelations) => {
      return TableSeatFactory.createTableSeat(tableSeat);
    });

    this.cache.set(table.id, table);
    table.room.addTable(table);

    return table;
  }

  public static async canUserAccess(table: Table, playerId: string): Promise<boolean> {
    // Already in table
    if (table.isPlayerInTable(playerId)) {
      return true;
    }

    // Allow the first user to access the table — they will become the host
    if (!table.hostPlayer || playerId === table.hostPlayerId) {
      return true;
    }

    // Public and protected tables are open to all
    if (table.tableType === TableType.PUBLIC || table.tableType === TableType.PROTECTED) {
      return true;
    }

    // Private tables → check invitations
    const tableInvitations: TableInvitation[] = await TableInvitationManager.findAllByInviteePlayerId(playerId);
    const isInvited = tableInvitations.some((ti: TableInvitation) => ti.tableId === table.id);

    return table.tableType === TableType.PRIVATE && isInvited;
  }

  public static async joinTable(table: Table, user: User, socket: Socket, seatNumber?: number): Promise<void> {
    const player: Player = await PlayerManager.findById(user.id);

    const isPlayerJoinedTable: boolean = table.isPlayerInTable(player.id);
    let tablePlayer: TablePlayer | undefined;

    if (isPlayerJoinedTable) {
      tablePlayer = table.getPlayer(player.id);
      await socket.join(table.id);
    } else {
      tablePlayer = await TablePlayerManager.joinTable(table, player);

      await socket.join(table.id);

      if (seatNumber) {
        tablePlayer = await this.sitPlayer(table.id, tablePlayer.playerId, seatNumber);
      }

      // Announce when user joins table
      await this.sendMessage(
        table.id,
        tablePlayer.playerId,
        null,
        TableChatMessageType.USER_JOINED_TABLE,
        { username: tablePlayer.player.user?.username },
        null,
      );

      logger.debug(`${tablePlayer.player.user?.username} has joined table #${table.tableNumber}.`);

      if (table.players.length === 1 && table.hostPlayerId === tablePlayer.playerId) {
        // Announce privately to table host their role
        await this.sendMessage(
          table.id,
          tablePlayer.playerId,
          null,
          TableChatMessageType.TABLE_HOST,
          null,
          tablePlayer.playerId,
        );

        logger.debug(
          "You are the host of the table. This gives you the power to invite to [or boot people from] your table. You may also limit other player’s access to your table by selecting its \"Table Type\".",
        );
      }
    }

    await publishRedisEvent(ServerInternalEvents.TABLE_JOIN, {
      roomId: table.roomId,
      tableId: table.id,
      table: table.toPlainObject(),
      tablePlayer: tablePlayer?.toPlainObject(),
    });
  }

  public static async leaveTable(table: Table, user: User, socket: Socket): Promise<void> {
    const player: Player = await PlayerManager.findById(user.id);
    const tablePlayer: TablePlayer = await TablePlayerManager.findByTableId(table, player.id);

    if (TableSeatManager.isPlayerSeated(table.id, tablePlayer.playerId)) {
      await this.standPlayer(table.id, tablePlayer.playerId);
    }

    await TablePlayerManager.leaveTable(table, player);
    await socket.leave(table.id);

    // Announce when user leaves table
    await this.sendMessage(
      table.id,
      tablePlayer.playerId,
      null,
      TableChatMessageType.USER_LEFT_TABLE,
      { username: tablePlayer.player.user?.username },
      null,
    );

    logger.debug(`${tablePlayer.player.user?.username} has left table #${table.tableNumber}.`);

    if (table.hostPlayerId === tablePlayer.playerId) {
      // Set new table host
      if (table.players.length > 0) {
        table.hostPlayer = table.players[0].player;

        // Announce privately their role to the new table host
        await this.sendMessage(
          table.id,
          table.hostPlayerId,
          null,
          TableChatMessageType.TABLE_HOST,
          null,
          table.hostPlayerId,
        );

        logger.debug(
          "You are the host of the table. This gives you the power to invite to [or boot people from] your table. You may also limit other player’s access to your table by selecting its \"Table Type\".",
        );

        await publishRedisEvent(ServerInternalEvents.TABLE_HOST_LEAVE, {
          roomId: table.roomId,
          tableId: table.id,
          table: table.toPlainObject(),
        });
      }
    }

    // Remove sent and received invitations to/from this table
    await TableInvitationManager.deleteAllByTableIdAndPlayerId(table.id, tablePlayer.playerId);

    await publishRedisEvent(ServerInternalEvents.TABLE_LEAVE, {
      roomId: table.roomId,
      tableId: table.id,
      table: table.toPlainObject(),
      tablePlayer: tablePlayer.toPlainObject(),
    });

    // If no users are left, delete the table
    if (table.players.length === 0) {
      table.onRemoveCallbacks?.();
      await TableService.delete(table.id);
      this.cache.delete(table.id);
      await publishRedisEvent(ServerInternalEvents.TABLE_DELETE, { roomId: table.roomId, table: table.toPlainObject() });
    }
  }

  public static async leaveAllTablesInRoom(roomId: string, player: Player, socket: Socket): Promise<void> {
    const tablePlayers: TablePlayer[] = await TablePlayerManager.getTablesForPlayer(player.id);

    for (const tp of tablePlayers) {
      const table: Table = await this.findById(tp.tableId);
      if (table.roomId !== roomId) continue;

      await this.leaveTable(table, player.user, socket);
    }
  }

  public static async sendMessage(
    tableId: string,
    playerId: string,
    text: string | null,
    type: TableChatMessageType,
    textVariables: TableChatMessageVariables | null,
    visibleToUserId: string | null,
  ): Promise<void> {
    const tableChatMessage: TableChatMessage = await TableChatMessageManager.create({
      table: {
        connect: { id: tableId },
      },
      player: {
        connect: { id: playerId },
      },
      text,
      type,
      textVariables: tableChatVariablesToJson(textVariables),
      visibleToUserId,
    });

    const table: Table = await TableManager.findById(tableChatMessage.tableId);
    table.addChatMessage(tableChatMessage);
  }

  public static async updateTableOptions(
    tableId: string,
    playerId: string,
    options: { tableType?: TableType; isRated?: boolean },
  ): Promise<void> {
    const table: Table = await TableManager.findById(tableId);

    if (table.hostPlayerId !== playerId) {
      throw new Error("Only host can update table options");
    }

    const dbTable: TowersTableWithRelations = await TableService.update(tableId, {
      tableType: options.tableType,
      isRated: options.isRated,
    });

    if (typeof dbTable.tableType !== "undefined") {
      table.tableType = dbTable.tableType;
    }

    if (typeof dbTable.isRated !== "undefined") {
      table.isRated = dbTable.isRated;
    }

    const player: Player = await PlayerManager.updateLastActiveAt(playerId);
    table.hostPlayer.lastActiveAt = player.lastActiveAt;

    if (options.tableType && options.tableType !== table.tableType) {
      await this.sendMessage(
        table.id,
        table.hostPlayerId,
        null,
        TableChatMessageType.TABLE_TYPE,
        { tableType: options.tableType },
        table.hostPlayerId,
      );

      switch (options.tableType) {
        case TableType.PROTECTED:
          logger.debug("Only invited players may play now.");
          break;
        case TableType.PRIVATE:
          logger.debug("Only invited players may play or watch.");
          break;
        default:
          logger.debug("Anyone may play or watch.");
      }
    }

    await publishRedisEvent(ServerInternalEvents.TABLE_OPTIONS_UPDATE, {
      roomId: table.roomId,
      table: table.toPlainObject(),
    });
  }

  public static async getPlayersToInvite(tableId: string): Promise<RoomPlayer[]> {
    const table: Table = await TableManager.findById(tableId);

    return table.room.players.filter(async (rp: RoomPlayer) => {
      if (table.tableType === TableType.PRIVATE || table.tableType === TableType.PROTECTED) {
        const tableInvitation: TableInvitation[] = await TableInvitationManager.findAllByInviteePlayerId(rp.playerId);
        return (
          rp.playerId !== table.hostPlayerId && !tableInvitation.some((ti: TableInvitation) => ti.tableId === table.id)
        );
      } else {
        const tables: TablePlayer[] = await TablePlayerManager.getTablesForPlayer(rp.playerId);
        return !tables.some((tp: TablePlayer) => tp.tableId === table.id);
      }
    });
  }

  public static async invitePlayer(tableId: string, inviterId: string, inviteeId: string): Promise<void> {
    const table: Table = await TableManager.findById(tableId);

    const inviter: TablePlayer | undefined = table.players.find((tp: TablePlayer) => tp.playerId === inviterId);
    if (!inviter || table.hostPlayerId !== inviterId) throw new Error("Only host can invite");

    const invitee: RoomPlayer | undefined = table.room.players.find((rp: RoomPlayer) => rp.playerId === inviteeId);
    if (!invitee) {
      logger.debug("Invitee not in room");
      return;
    }

    const isAlreadyInvited: boolean = await TableInvitationManager.hasPendingInvitationForTable(table.id, inviteeId);
    if (isAlreadyInvited) {
      logger.debug(`User ${invitee.player?.user?.username} already invited.`);
      return;
    }

    // Invitee has declined all invites
    if (invitee.player.user.declineTableInvitations) {
      logger.debug(`Invite blocked by ${invitee.player?.user?.username} preference.`);
      return;
    }

    const invitation: TableInvitation = await TableInvitationManager.create({
      room: { connect: { id: table.roomId } },
      table: { connect: { id: tableId } },
      inviterPlayer: { connect: { id: inviterId } },
      inviteePlayer: { connect: { id: inviteeId } },
    });

    TableManager.addInvitationToTable(table, invitation);

    if (
      (table.tableType === TableType.PROTECTED || table.tableType === TableType.PRIVATE) &&
      table.isPlayerInTable(invitation.inviteePlayerId)
    ) {
      // If user to be invited is already in the table, do not show the invitaiton modal to them - granted access to seats directly
      await TableInvitationManager.accept(invitation.id);
      logger.debug(
        `${inviter.player.user?.username} granted ${invitee.player?.user?.username} access to play at table #${table.tableNumber}.`,
      );
    } else {
      const notification: Notification = await NotificationManager.create({
        player: { connect: { id: inviteeId } },
        roomId: table.roomId,
        type: NotificationType.TABLE_INVITE,
        tableInvitation: { connect: { id: invitation.id } },
      });

      await publishRedisEvent(ServerInternalEvents.TABLE_INVITE_USER, {
        userId: inviteeId,
        notification: notification.toPlainObject(),
      });
      logger.debug(
        `${inviter.player?.user?.username} invited ${invitee.player?.user?.username} to table #${table.tableNumber}.`,
      );
    }

    const player: Player = await PlayerManager.updateLastActiveAt(inviterId);
    table.hostPlayer.lastActiveAt = player.lastActiveAt;
  }

  public static addInvitationToTable(table: Table, invitation: TableInvitation): void {
    table.addInvitation(invitation);
  }

  public static async removeInvitationFromTable(table: Table, invitationId: string): Promise<void> {
    table.removeInvitation(invitationId);
    await TableInvitationManager.delete(invitationId);
  }

  public static async getPlayersToBoot(tableId: string): Promise<TablePlayer[]> {
    const table: Table = await TableManager.findById(tableId);
    return table.players.filter((tp: TablePlayer) => tp.playerId !== table.hostPlayerId);
  }

  public static async bootPlayer(tableId: string, hostId: string, playerToBootId: string): Promise<void> {
    const table: Table = await TableManager.findById(tableId);

    if (table.hostPlayerId !== hostId) throw new Error("Only host can boot");

    const tableBoot: TableBoot = await TableBootManager.create({
      table: {
        connect: { id: tableId },
      },
      booterPlayer: {
        connect: { id: hostId },
      },
      bootedPlayer: {
        connect: { id: playerToBootId },
      },
    });

    table.removePlayer(playerToBootId);
    table.room.setPlayerTableNumber(playerToBootId, null);

    await this.sendMessage(
      tableBoot.tableId,
      tableBoot.table.hostPlayerId,
      null,
      TableChatMessageType.USER_BOOTED_FROM_TABLE,
      {
        tableHostUsername: tableBoot.table.hostPlayer.user?.username,
        username: tableBoot.bootedPlayer.user?.username,
      },
      null,
    );

    const notification: Notification = await NotificationManager.create({
      player: {
        connect: { id: tableBoot.bootedPlayerId },
      },
      roomId: tableBoot.table.roomId,
      type: NotificationType.TABLE_BOOTED,
      bootedFromTable: {
        connect: { id: tableBoot.id },
      },
    });

    await publishRedisEvent(ServerInternalEvents.TABLE_BOOT_USER, {
      userId: tableBoot.bootedPlayerId,
      notification: notification.toPlainObject(),
    });

    // Remove booted user invitation to the table
    const tableInvitations: TableInvitation[] = await TableInvitationManager.findAllByPlayerId(table.id, playerToBootId);

    for (const tableInvitation of tableInvitations) {
      await this.removeInvitationFromTable(table, tableInvitation.id);
    }
  }

  public static async sitPlayer(tableId: string, playerId: string, seatNumber: number): Promise<TablePlayer> {
    const table: Table = await TableManager.findById(tableId);

    let tablePlayer: TablePlayer | undefined = table.players.find((tp: TablePlayer) => tp.playerId === playerId);
    if (!tablePlayer) throw new Error("Player not at table");

    if (table.tableType === TableType.PROTECTED || table.tableType === TableType.PRIVATE) {
      const isInvited: boolean =
        tablePlayer.playerId === table.hostPlayerId ||
        (await TableInvitationManager.hasPendingInvitationForTable(table.id, tablePlayer.playerId));

      const isAlreadyInTable: boolean = table.players.some((tp: TablePlayer) => tp.playerId === tablePlayer?.playerId);

      if (!isInvited && !isAlreadyInTable) {
        throw new Error("Only invited users may sit at this table.");
      }
    }

    // Stand first if seated
    if (TableSeatManager.getSeatByPlayerId(table.id, playerId)) {
      await this.standPlayer(tableId, playerId);
    }

    const tableSeat: TableSeat | undefined = table.seats.find(
      (ts: TableSeat) => ts.seatNumber === seatNumber && !ts.occupiedByPlayerId,
    );
    if (!tableSeat) throw new Error("Seat not available");

    await TableSeatManager.sitPlayer(tableSeat, tablePlayer.player);
    tablePlayer = await TablePlayerManager.upsert(tablePlayer);

    await publishRedisEvent(ServerInternalEvents.TABLE_SEAT_SIT, {
      roomId: table.roomId,
      tableId: table.id,
      tableSeat: tableSeat.toPlainObject(),
      tablePlayer: tablePlayer.toPlainObject(),
    });

    logger.debug(`${tablePlayer.player.user?.username} is seated at seat #${seatNumber}.`);

    return tablePlayer;
  }

  public static async standPlayer(tableId: string, playerId: string): Promise<void> {
    const table: Table = await TableManager.findById(tableId);

    let tablePlayer: TablePlayer | undefined = table.players.find((tp: TablePlayer) => tp.playerId === playerId);
    if (!tablePlayer) throw new Error("Player not at table");

    const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(tableId, playerId);
    if (!tableSeat) throw new Error("Player is not seated");

    await TableSeatManager.standPlayer(tableSeat);

    tablePlayer.isReady = false;
    tablePlayer.isPlaying = false;
    tablePlayer = await TablePlayerManager.upsert(tablePlayer);

    await publishRedisEvent(ServerInternalEvents.TABLE_SEAT_STAND, {
      roomId: table.roomId,
      tableId: table.id,
      tableSeat: tableSeat.toPlainObject(),
      tablePlayer: tablePlayer.toPlainObject(),
    });

    logger.debug(`${tablePlayer.player.user?.username} stood up from seat #${tableSeat?.seatNumber}.`);

    table.playerQuitsMidGame(tablePlayer);
  }

  public static async setPlayerReady(io: IoServer, tableId: string, playerId: string): Promise<void> {
    const table: Table = await TableManager.findById(tableId);

    let tablePlayer: TablePlayer | undefined = table.players.find((tp: TablePlayer) => tp.playerId === playerId);
    if (!tablePlayer) throw new Error("Player not at table");

    tablePlayer.isReady = true;
    tablePlayer = await TablePlayerManager.upsert(tablePlayer);

    logger.debug(`${tablePlayer.player.user?.username} is ready.`);

    this.checkIfGameCouldBeStarted(io, table);
  }

  public static checkIfGameCouldBeStarted(io: IoServer, table: Table): void {
    if (!table.game) {
      table.game = new Game(io, table);
    }

    const canStart: boolean = GameTeams.checkMinimumReadyTeams(table.id, table.players);

    if (canStart) {
      setTimeout(() => table.game?.startCountdown(), 2000);
    } else {
      logger.debug("Not enough ready users or teams to play.");
    }
  }

  public static async heroCode(tableId: string, playerId: string, code: string): Promise<void> {
    if (code && CipherHeroManager.isGuessedCodeMatchesHeroCode(playerId, code)) {
      const player: Player = await PlayerManager.findById(playerId);

      await this.sendMessage(
        tableId,
        playerId,
        null,
        TableChatMessageType.HERO_MESSAGE,
        { username: player.user.username },
        null,
      );

      CipherHeroManager.removeHeroCode(playerId);
    }
  }

  public static async tableViewForPlayer(table: Table, playerId: string): Promise<TablePlainObject> {
    const mutedUserIds: string[] = await UserRelationshipManager.mutedUserIdsFor(playerId);
    const tableChatMessages: TableChatMessage[] = await table.messagesFor(playerId, mutedUserIds);
    table.chatMessages = tableChatMessages;
    return table.toPlainObject();
  }
}
