import { createId } from "@paralleldrive/cuid2";
import { logger } from "better-auth";
import { NotificationType, TableChatMessageType, TableType } from "db/client";
import { Server as IoServer, Socket } from "socket.io";
import { NUM_TABLE_SEATS } from "@/constants/game";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import { Notification } from "@/server/towers/classes/Notification";
import { Player } from "@/server/towers/classes/Player";
import { RoomPlayer } from "@/server/towers/classes/RoomPlayer";
import { Table, TablePlainObject, TableProps } from "@/server/towers/classes/Table";
import { TableBoot } from "@/server/towers/classes/TableBoot";
import { TableChatMessage, TableChatMessageVariables } from "@/server/towers/classes/TableChatMessage";
import { TableInvitation } from "@/server/towers/classes/TableInvitation";
import { TablePlayer } from "@/server/towers/classes/TablePlayer";
import { TableSeat } from "@/server/towers/classes/TableSeat";
import { CipherHeroManager } from "@/server/towers/game/CipherHeroManager";
import { Game } from "@/server/towers/game/Game";
import { NotificationManager } from "@/server/towers/managers/NotificationManager";
import { PlayerManager } from "@/server/towers/managers/PlayerManager";
import { TableBootManager } from "@/server/towers/managers/TableBootManager";
import { TableChatMessageManager } from "@/server/towers/managers/TableChatMessageManager";
import { TableInvitationManager } from "@/server/towers/managers/TableInvitationManager";
import { TablePlayerManager } from "@/server/towers/managers/TablePlayerManager";
import { TableSeatManager } from "@/server/towers/managers/TableSeatManager";
import { User } from "@/server/youpi/classes/User";

export class TableManager {
  private static tables: Map<string, Table> = new Map<string, Table>();

  // ---------- Basic CRUD ------------------------------

  public static get(id: string): Table | undefined {
    return this.tables.get(id);
  }

  public static all(): Table[] {
    return [...this.tables.values()];
  }

  public static create(props: Omit<TableProps, "id">): Table {
    const table: Table = new Table({ id: createId(), ...props });

    table.seats = Array.from({ length: NUM_TABLE_SEATS }, (_, i: number) =>
      TableSeatManager.create({ tableId: table.id, seatNumber: i + 1, occupiedByPlayer: null }),
    );

    this.tables.set(table.id, table);

    return table;
  }

  public static upsert(props: TableProps): Table {
    const table: Table | undefined = this.tables.get(props.id);

    if (table) {
      table.hostPlayer = props.hostPlayer;
      table.tableType = props.tableType;
      table.isRated = props.isRated;
      return table;
    }

    return this.create(props);
  }

  public static delete(id: string): void {
    this.tables.delete(id);
  }

  // ---------- Table Actions ------------------------------

  public static canUserAccess(table: Table, userId: string): boolean {
    // Already in table
    if (table.players.find((tp: TablePlayer) => tp.playerId === userId)) {
      return true;
    }

    // Allow the first user to access the table — they will become the host
    if (!table.hostPlayer || userId === table.hostPlayerId) {
      return true;
    }

    // Public and protected tables are open to all
    if (table.tableType === TableType.PUBLIC || table.tableType === TableType.PROTECTED) {
      return true;
    }

    // Private tables → check invitations
    const tableInvitations: TableInvitation[] = TableInvitationManager.getReceivedInvitations(userId);
    const isInvited = tableInvitations.some((ti: TableInvitation) => ti.tableId === table.id);

    return table.tableType === TableType.PRIVATE && isInvited;
  }

  public static async joinTable(table: Table, user: User, socket: Socket, seatNumber?: number): Promise<void> {
    const player: Player | undefined = PlayerManager.get(user.id);
    if (!player) throw new Error("Player not found");

    if (TablePlayerManager.isInTable(table.id, player.id)) {
      await socket.join(table.id);
      return;
    }

    let tablePlayer: TablePlayer = TablePlayerManager.create({ table, player });
    table.addPlayer(tablePlayer);
    table.room.setPlayerTableNumber(tablePlayer.playerId, table.tableNumber);

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

    await publishRedisEvent(ServerInternalEvents.TABLE_JOIN, {
      roomId: table.roomId,
      tableId: table.id,
      table: table.toPlainObject(),
      tablePlayer: tablePlayer.toPlainObject(),
    });
  }

  public static async leaveTable(table: Table, user: User, socket: Socket): Promise<void> {
    const player: Player | undefined = PlayerManager.get(user.id);
    if (!player) throw new Error("Player not found");

    const tablePlayer: TablePlayer | undefined = TablePlayerManager.get(table.id, player.id);
    if (!tablePlayer) return;

    if (TableSeatManager.isPlayerSeated(table.id, tablePlayer.playerId)) {
      await this.standPlayer(table.id, tablePlayer.playerId);
    }

    await socket.leave(table.id);

    table.removePlayer(tablePlayer.playerId);
    table.room.setPlayerTableNumber(tablePlayer.playerId, null);

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

    TablePlayerManager.delete(table.id, player);

    // Remove received invitations to this table
    TableInvitationManager.deleteForTableAndPlayer(table.id, tablePlayer.playerId);

    await publishRedisEvent(ServerInternalEvents.TABLE_LEAVE, {
      roomId: table.roomId,
      tableId: table.id,
      table: table.toPlainObject(),
      tablePlayer: tablePlayer.toPlainObject(),
    });

    // If no users are left, delete the table
    if (table.players.length === 0 && table.onRemoveCallbacks) {
      table.onRemoveCallbacks();
      await publishRedisEvent(ServerInternalEvents.TABLE_DELETE, { roomId: table.roomId, table: table.toPlainObject() });
    }
  }

  public static async leaveAllTablesInRoom(roomId: string, player: Player, socket: Socket): Promise<void> {
    const tablePlayers: TablePlayer[] = TablePlayerManager.getTablesForPlayer(player.id);

    for (const tp of tablePlayers) {
      const table: Table | undefined = this.get(tp.tableId);
      if (!table) continue;
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
    const player: Player | undefined = PlayerManager.get(playerId);
    if (!player) throw new Error("Player not found");

    const tableChatMessage: TableChatMessage = await TableChatMessageManager.create({
      tableId,
      player,
      text,
      type,
      textVariables,
      visibleToUserId,
    });

    const table: Table | undefined = TableManager.get(tableId);
    if (!table) throw new Error("Table not found");

    table.addChatMessage(tableChatMessage);
  }

  public static async updateTableOptions(
    tableId: string,
    playerId: string,
    options: { tableType?: TableType; isRated?: boolean },
  ): Promise<void> {
    const table: Table | undefined = TableManager.get(tableId);

    if (table && table.hostPlayerId === playerId) {
      if (options.tableType && table.tableType !== options.tableType) {
        table.tableType = options.tableType;

        if (table.hostPlayer) {
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
      }

      if (typeof options.isRated !== "undefined") {
        table.isRated = options.isRated;
      }

      table.hostPlayer.lastActiveAt = new Date();

      await publishRedisEvent(ServerInternalEvents.TABLE_OPTIONS_UPDATE, {
        roomId: table.roomId,
        table: table.toPlainObject(),
      });
    }
  }

  public static getPlayersToInvite(tableId: string): RoomPlayer[] {
    const table: Table | undefined = this.get(tableId);
    if (!table) throw new Error("Table not found");

    return table.room.players.filter((rp: RoomPlayer) => {
      if (table.tableType === TableType.PRIVATE || table.tableType === TableType.PROTECTED) {
        const tableInvitation: TableInvitation[] = TableInvitationManager.getReceivedInvitations(rp.playerId);
        return (
          rp.playerId !== table.hostPlayerId && !tableInvitation.some((ti: TableInvitation) => ti.tableId === table.id)
        );
      } else {
        const tables: TablePlayer[] = TablePlayerManager.getTablesForPlayer(rp.playerId);
        return !tables.some((tp: TablePlayer) => tp.tableId === table.id);
      }
    });
  }

  public static async invitePlayer(tableId: string, inviterId: string, inviteeId: string): Promise<void> {
    const table: Table | undefined = this.get(tableId);
    if (!table) throw new Error("Table not found");

    const inviter: TablePlayer | undefined = table.players.find((tp: TablePlayer) => tp.playerId === inviterId);
    if (!inviter || table.hostPlayerId !== inviterId) throw new Error("Only host can invite");

    const invitee: RoomPlayer | undefined = table.room.players.find((rp: RoomPlayer) => rp.playerId === inviteeId);
    if (!invitee) {
      logger.debug("Invitee not in room");
      return;
    }

    const isAlreadyInvited: boolean = TableInvitationManager.hasPendingInvitationForTable(table.id, inviteeId);
    if (isAlreadyInvited) {
      logger.debug(`User ${invitee.player?.user?.username} already invited.`);
      return;
    }

    // Invitee has declined all invites
    if (invitee.player.user.declineTableInvitations) {
      logger.debug(`Invite blocked by ${invitee.player?.user?.username} preference.`);
      return;
    }

    const invitation: TableInvitation = TableInvitationManager.create({
      room: table.room,
      table,
      inviterPlayer: inviter.player,
      inviteePlayer: invitee.player,
    });

    TableManager.addInvitationToTable(table, invitation);

    if (
      (table.tableType === TableType.PROTECTED || table.tableType === TableType.PRIVATE) &&
      TablePlayerManager.isInTable(invitation.tableId, invitation.inviteePlayerId)
    ) {
      // If user to be invited is already in the table, do not show the invitaiton modal to them - granted access to seats directly
      await TableInvitationManager.accept(invitation.id);
      logger.debug(
        `${inviter.player.user?.username} granted ${invitee.player?.user?.username} access to play at table #${table.tableNumber}.`,
      );
    } else {
      const notification: Notification = NotificationManager.create({
        playerId: inviteeId,
        roomId: table.roomId,
        type: NotificationType.TABLE_INVITE,
        tableInvitation: invitation,
      });

      await publishRedisEvent(ServerInternalEvents.TABLE_INVITE_USER, {
        userId: inviteeId,
        notification: notification.toPlainObject(),
      });
      logger.debug(
        `${inviter.player?.user?.username} invited ${invitee.player?.user?.username} to table #${table.tableNumber}.`,
      );
    }

    table.hostPlayer.lastActiveAt = new Date();
  }

  public static addInvitationToTable(table: Table, invitation: TableInvitation): void {
    table.addInvitation(invitation);
  }

  public static removeInvitationFromTable(table: Table, invitationId: string): void {
    table.removeInvitation(invitationId);
    TableInvitationManager.delete(invitationId);
  }

  public static getPlayersToBoot(tableId: string): TablePlayer[] {
    const table: Table | undefined = this.get(tableId);
    if (!table) throw new Error("Table not found");

    return table.players.filter((tp: TablePlayer) => tp.playerId !== table.hostPlayerId);
  }

  public static async bootPlayer(tableId: string, hostId: string, playerToBootId: string): Promise<void> {
    const table: Table | undefined = this.get(tableId);
    if (!table) throw new Error("Table not found");

    if (table.hostPlayerId !== hostId) throw new Error("Only host can boot");

    const hostPlayer: Player | undefined = PlayerManager.get(hostId);
    if (!hostPlayer) throw new Error("Host not found");

    const playerToBoot: TablePlayer | undefined = table.players.find(
      (tp: TablePlayer) => tp.playerId === playerToBootId,
    );
    if (!playerToBoot) throw new Error("Player to boot not found");

    const tableBoot: TableBoot = await TableBootManager.create({
      table,
      booterPlayer: hostPlayer,
      bootedPlayer: playerToBoot.player,
    });

    table.removePlayer(playerToBoot.playerId);
    table.room.setPlayerTableNumber(playerToBoot.playerId, null);

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

    const notification: Notification = NotificationManager.create({
      playerId: tableBoot.bootedPlayerId,
      roomId: tableBoot.table.roomId,
      type: NotificationType.TABLE_BOOTED,
      bootedFromTable: tableBoot,
    });

    await publishRedisEvent(ServerInternalEvents.TABLE_BOOT_USER, {
      userId: tableBoot.bootedPlayerId,
      notification: notification.toPlainObject(),
    });

    // Remove booted user invitation to the table
    const tableInvitations: TableInvitation[] = TableInvitationManager.getInvitationsForPlayer(
      table.id,
      playerToBoot.playerId,
    );

    for (const tableInvitation of tableInvitations) {
      this.removeInvitationFromTable(table, tableInvitation.id);
    }
  }

  public static async sitPlayer(tableId: string, playerId: string, seatNumber: number): Promise<TablePlayer> {
    const table: Table | undefined = this.get(tableId);
    if (!table) throw new Error("Table not found");

    let tablePlayer: TablePlayer | undefined = table.players.find((tp: TablePlayer) => tp.playerId === playerId);
    if (!tablePlayer) throw new Error("Player not at table");

    if (table.tableType === TableType.PROTECTED || table.tableType === TableType.PRIVATE) {
      const isInvited: boolean =
        tablePlayer.playerId === table.hostPlayerId ||
        TableInvitationManager.hasPendingInvitationForTable(table.id, tablePlayer.playerId);

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

    TableSeatManager.sitPlayer(tableSeat, tablePlayer.player);
    tablePlayer.seatNumber = seatNumber;
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
    const table: Table | undefined = this.get(tableId);
    if (!table) throw new Error("Table not found");

    let tablePlayer: TablePlayer | undefined = table.players.find((tp: TablePlayer) => tp.playerId === playerId);
    if (!tablePlayer) throw new Error("Player not at table");

    const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(tableId, playerId);
    if (!tableSeat) throw new Error("Player is not seated");

    TableSeatManager.standPlayer(tableSeat);
    tablePlayer.seatNumber = null;
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
    const table: Table | undefined = this.get(tableId);
    if (!table) throw new Error("Table not found");

    let tablePlayer: TablePlayer | undefined = table.players.find((tp: TablePlayer) => tp.playerId === playerId);
    if (!tablePlayer) throw new Error("Player not at table");

    tablePlayer.isReady = true;
    tablePlayer = await TablePlayerManager.upsert(tablePlayer);

    logger.debug(`${tablePlayer.player.user?.username} is ready.`);

    this.checkIfGameCouldBeStarted(io, table);
  }

  public static checkIfGameCouldBeStarted(io: IoServer, table: Table): void {
    if (!table.game) table.game = new Game(io, table);

    if (table.game.checkMinimumReadyTeams()) {
      setTimeout(() => table.game?.startCountdown(), 2000);
    } else {
      logger.debug("Not enough ready users or teams to play.");
    }
  }

  public static async heroCode(tableId: string, playerId: string, code: string): Promise<void> {
    if (code && CipherHeroManager.isGuessedCodeMatchesHeroCode(playerId, code)) {
      const player: Player | undefined = PlayerManager.get(playerId);
      if (!player) throw new Error("Player not found");

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

  public static tableViewForPlayer(table: Table, playerId: string): TablePlainObject {
    return {
      ...table.toPlainObject(),
      chatMessages: table.messagesFor(playerId).map((tcm: TableChatMessage) => tcm.toPlainObject()),
    };
  }
}
