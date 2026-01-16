import { TableChatMessageType, TableType } from "db/client";
import { Server, Socket } from "socket.io";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { SocketCallback } from "@/interfaces/socket";
import { logger } from "@/lib/logger";
import { Notification } from "@/server/towers/classes/Notification";
import { PlayerControlKeys, PlayerControlKeysPlainObject } from "@/server/towers/classes/PlayerControlKeys";
import { Room, RoomPlainObject } from "@/server/towers/classes/Room";
import { RoomPlayer } from "@/server/towers/classes/RoomPlayer";
import { Table, TablePlainObject } from "@/server/towers/classes/Table";
import { TableChatMessageVariables } from "@/server/towers/classes/TableChatMessage";
import { TablePlayer, TablePlayerPlainObject } from "@/server/towers/classes/TablePlayer";
import { TableSeat } from "@/server/towers/classes/TableSeat";
import { PlayerTowersGame } from "@/server/towers/game/PlayerTowersGame";
import { PowerBarItemPlainObject } from "@/server/towers/game/PowerBar";
import { TowersPieceBlockPlainObject } from "@/server/towers/game/TowersPieceBlock";
import { NotificationManager } from "@/server/towers/managers/NotificationManager";
import { PlayerControlKeysManager } from "@/server/towers/managers/PlayerControlKeysManager";
import { PlayerManager } from "@/server/towers/managers/PlayerManager";
import { RoomManager } from "@/server/towers/managers/RoomManager";
import { TableInvitationManager } from "@/server/towers/managers/TableInvitationManager";
import { TableManager } from "@/server/towers/managers/TableManager";
import { TablePlayerManager } from "@/server/towers/managers/TablePlayerManager";
import { TableSeatManager } from "@/server/towers/managers/TableSeatManager";
import { User } from "@/server/youpi/classes/User";
import { UserManager } from "@/server/youpi/managers/UserManager";

export class TowersSocketHandler {
  constructor(
    private io: Server,
    private socket: Socket,
    private user: User,
  ) {}

  public registerSocketListeners(): void {
    this.socket.on("disconnect", this.handleDisconnect);

    this.socket.on(ClientToServerEvents.ROOM_JOIN, this.handleJoinRoom);
    this.socket.on(ClientToServerEvents.ROOM_LEAVE, this.handleLeaveRoom);
    this.socket.on(ClientToServerEvents.ROOM_MESSAGE_SEND, this.handleSendRoomMessage);

    this.socket.on(ClientToServerEvents.TABLE_JOIN, this.handleJoinTable);
    this.socket.on(ClientToServerEvents.TABLE_LEAVE, this.handleLeaveTable);
    this.socket.on(ClientToServerEvents.TABLE_PLAY_NOW, this.handlePlayNow);
    this.socket.on(ClientToServerEvents.TABLE_CREATE, this.handleCreateTable);
    this.socket.on(ClientToServerEvents.TABLE_UPDATE_OPTIONS, this.handleUpdateTableSettings);
    this.socket.on(ClientToServerEvents.TABLE_MESSAGE_SEND, this.handleSendTableMessage);
    this.socket.on(ClientToServerEvents.TABLE_PLAYERS_TO_INVITE, this.handlePlayersToInvite);
    this.socket.on(ClientToServerEvents.TABLE_INVITE_USER, this.handleInviteUserToTable);
    this.socket.on(ClientToServerEvents.TABLE_INVITATION_ACCEPTED_CHECK, this.handleCheckAcceptedTableInvitation);
    this.socket.on(ClientToServerEvents.TABLE_INVITATION_ACCEPT, this.handleAcceptTableInvitation);
    this.socket.on(ClientToServerEvents.TABLE_INVITATION_DECLINE, this.handleDeclineTableInvitation);
    this.socket.on(ClientToServerEvents.TABLE_INVITATIONS_BLOCK, this.handleBlockTableInvitations);
    this.socket.on(ClientToServerEvents.TABLE_INVITATIONS_ALLOW, this.handleAllowTableInvitations);
    this.socket.on(ClientToServerEvents.TABLE_INVITATIONS_BLOCKED_CHECK, this.handleCheckedBlockedTableInvitations);
    this.socket.on(ClientToServerEvents.TABLE_PLAYERS_TO_BOOT, this.handlePlayersToBoot);
    this.socket.on(ClientToServerEvents.TABLE_BOOT_USER, this.handleBootUserFromTable);
    this.socket.on(ClientToServerEvents.TABLE_HERO_CODE, this.handleHeroCode);

    this.socket.on(ClientToServerEvents.TABLE_SEAT_SIT, this.handleSeatSit);
    this.socket.on(ClientToServerEvents.TABLE_SEAT_STAND, this.handleSeatStand);
    this.socket.on(ClientToServerEvents.TABLE_SEAT_READY, this.handleSeatReady);

    this.socket.on(ClientToServerEvents.GAME_CONTROL_KEYS, this.handleGetControlKeys);
    this.socket.on(ClientToServerEvents.GAME_CONTROL_KEYS_UPDATE, this.handleUpdateControlKeys);
    this.socket.on(ClientToServerEvents.ROOM_WATCH_USER_PLAY_AT_TABLE, this.handleWatchUserAtTable);

    this.socket.on(ClientToServerEvents.GAME_PIECE_MOVE, this.handlePieceMove);
    this.socket.on(ClientToServerEvents.GAME_PIECE_CYCLE, this.handlePieceCycle);
    this.socket.on(ClientToServerEvents.GAME_PIECE_DROP, this.handlePieceDropStart);
    this.socket.on(ClientToServerEvents.GAME_PIECE_DROP_STOP, this.handlePieceDropStop);
    this.socket.on(ClientToServerEvents.GAME_POWER_USE, this.handlePowerUse);
    this.socket.on(ClientToServerEvents.GAME_HOO_ADD_BLOCKS, this.handleApplyHooBlocks);
    this.socket.on(ClientToServerEvents.GAME_POWER_APPLY, this.handleApplyPower);

    this.socket.on(ClientToServerEvents.NOTIFICATIONS, this.handleGetNotifications);
    this.socket.on(ClientToServerEvents.NOTIFICATION_MARK_AS_READ, this.handleMarkNotificationAsRead);
    this.socket.on(ClientToServerEvents.NOTIFICATION_DELETE, this.handleDeleteNotification);
  }

  private cleanupSocketListeners(): void {
    this.socket.off("disconnect", this.handleDisconnect);

    this.socket.off(ClientToServerEvents.ROOM_JOIN, this.handleJoinRoom);
    this.socket.off(ClientToServerEvents.ROOM_LEAVE, this.handleLeaveRoom);
    this.socket.off(ClientToServerEvents.ROOM_MESSAGE_SEND, this.handleSendRoomMessage);

    this.socket.off(ClientToServerEvents.TABLE_JOIN, this.handleJoinTable);
    this.socket.off(ClientToServerEvents.TABLE_LEAVE, this.handleLeaveTable);
    this.socket.off(ClientToServerEvents.TABLE_PLAY_NOW, this.handlePlayNow);
    this.socket.off(ClientToServerEvents.TABLE_CREATE, this.handleCreateTable);
    this.socket.off(ClientToServerEvents.TABLE_UPDATE_OPTIONS, this.handleUpdateTableSettings);
    this.socket.off(ClientToServerEvents.TABLE_MESSAGE_SEND, this.handleSendTableMessage);
    this.socket.off(ClientToServerEvents.TABLE_PLAYERS_TO_INVITE, this.handlePlayersToInvite);
    this.socket.off(ClientToServerEvents.TABLE_INVITE_USER, this.handleInviteUserToTable);
    this.socket.off(ClientToServerEvents.TABLE_INVITATION_ACCEPTED_CHECK, this.handleCheckAcceptedTableInvitation);
    this.socket.off(ClientToServerEvents.TABLE_INVITATION_ACCEPT, this.handleAcceptTableInvitation);
    this.socket.off(ClientToServerEvents.TABLE_INVITATION_DECLINE, this.handleDeclineTableInvitation);
    this.socket.off(ClientToServerEvents.TABLE_INVITATIONS_BLOCK, this.handleBlockTableInvitations);
    this.socket.off(ClientToServerEvents.TABLE_INVITATIONS_ALLOW, this.handleAllowTableInvitations);
    this.socket.off(ClientToServerEvents.TABLE_INVITATIONS_BLOCKED_CHECK, this.handleCheckedBlockedTableInvitations);
    this.socket.off(ClientToServerEvents.TABLE_PLAYERS_TO_BOOT, this.handlePlayersToBoot);
    this.socket.off(ClientToServerEvents.TABLE_BOOT_USER, this.handleBootUserFromTable);
    this.socket.off(ClientToServerEvents.TABLE_HERO_CODE, this.handleHeroCode);

    this.socket.off(ClientToServerEvents.TABLE_SEAT_SIT, this.handleSeatSit);
    this.socket.off(ClientToServerEvents.TABLE_SEAT_STAND, this.handleSeatStand);
    this.socket.off(ClientToServerEvents.TABLE_SEAT_READY, this.handleSeatReady);

    this.socket.off(ClientToServerEvents.GAME_CONTROL_KEYS, this.handleGetControlKeys);
    this.socket.off(ClientToServerEvents.GAME_CONTROL_KEYS_UPDATE, this.handleUpdateControlKeys);
    this.socket.off(ClientToServerEvents.ROOM_WATCH_USER_PLAY_AT_TABLE, this.handleWatchUserAtTable);

    this.socket.off(ClientToServerEvents.GAME_PIECE_MOVE, this.handlePieceMove);
    this.socket.off(ClientToServerEvents.GAME_PIECE_CYCLE, this.handlePieceCycle);
    this.socket.off(ClientToServerEvents.GAME_PIECE_DROP, this.handlePieceDropStart);
    this.socket.off(ClientToServerEvents.GAME_PIECE_DROP_STOP, this.handlePieceDropStop);
    this.socket.off(ClientToServerEvents.GAME_POWER_USE, this.handlePowerUse);
    this.socket.off(ClientToServerEvents.GAME_HOO_ADD_BLOCKS, this.handleApplyHooBlocks);
    this.socket.off(ClientToServerEvents.GAME_POWER_APPLY, this.handleApplyPower);

    this.socket.off(ClientToServerEvents.NOTIFICATIONS, this.handleGetNotifications);
    this.socket.off(ClientToServerEvents.NOTIFICATION_MARK_AS_READ, this.handleMarkNotificationAsRead);
    this.socket.off(ClientToServerEvents.NOTIFICATION_DELETE, this.handleDeleteNotification);
  }

  private handleDisconnect = (): void => {
    this.cleanupSocketListeners();
  };

  private handleJoinRoom = async (
    { roomId }: { roomId: string },
    callback: ({ success, message }: SocketCallback) => void,
  ): Promise<void> => {
    await PlayerManager.loadPlayerFromDb(this.user.id);
    const room: Room | undefined = RoomManager.get(roomId);

    if (room) {
      if (!RoomManager.canUserAccess(room, this.user.id)) {
        callback({ success: false, message: "Room cannot be accessed." });
      } else {
        if (room.players.some((rp: RoomPlayer) => rp.playerId === this.user.id)) {
          const data: RoomPlainObject = RoomManager.roomViewForPlayer(room, this.user.id);
          callback({
            success: true,
            message: "You are already in the table.",
            data, // TODO: Remove data when db logic will be implemented
          });
        } else {
          await RoomManager.joinRoom(room, this.user, this.socket);
          const data: RoomPlainObject = RoomManager.roomViewForPlayer(room, this.user.id);
          callback({
            success: true,
            message: "You joined the room.",
            data, // TODO: Remove data when db logic will be implemented
          });
        }
      }
    } else {
      callback({ success: false, message: "Room not found." });
    }
  };

  private handleLeaveRoom = (
    { roomId }: { roomId: string },
    callback: ({ success, message }: SocketCallback) => void,
  ): void => {
    const room: Room | undefined = RoomManager.get(roomId);

    if (room) {
      if (!room.players.some((rp: RoomPlayer) => rp.playerId === this.user.id)) {
        callback({ success: true, message: "You are not in the room." });
      } else {
        RoomManager.leaveRoom(room, this.user, this.socket);
        callback({ success: true, message: "You left the room." });
      }
    } else {
      callback({ success: false, message: "Room not found." });
    }
  };

  private handleSendRoomMessage = async (
    { roomId, text }: { roomId: string; text: string },
    callback: ({ success }: SocketCallback) => void,
  ): Promise<void> => {
    try {
      await RoomManager.sendMessage(roomId, this.user.id, text);
      callback({ success: true });
    } catch (error) {
      callback({ success: false, message: error instanceof Error ? error.message : "Error sending message" });
    }
  };

  private handleJoinTable = async (
    { tableId, seatNumber }: { tableId: string; seatNumber: number },
    callback: ({ success, message }: SocketCallback) => void,
  ): Promise<void> => {
    await PlayerManager.loadPlayerFromDb(this.user.id);
    const table: Table | undefined = TableManager.get(tableId);

    if (table) {
      if (!TableManager.canUserAccess(table, this.user.id)) {
        callback({ success: false, message: "Table cannot be accessed." });
      } else {
        if (table.players.some((tp: TablePlayer) => tp.playerId === this.user.id)) {
          const data: TablePlainObject = TableManager.tableViewForPlayer(table, this.user.id);
          callback({
            success: true,
            message: "You are already in the table.",
            data, // TODO: Remove data when db logic will be implemented
          });
        } else {
          await TableManager.joinTable(table, this.user, this.socket, seatNumber);
          const data: TablePlainObject = TableManager.tableViewForPlayer(table, this.user.id);
          callback({
            success: true,
            message: "You joined the table.",
            data, // TODO: Remove data when db logic will be implemented
          });
        }
      }
    } else {
      callback({ success: false, message: "Table not found." });
    }
  };

  private handleLeaveTable = (
    { tableId }: { tableId: string },
    callback: ({ success, message }: SocketCallback) => void,
  ): void => {
    const table: Table | undefined = TableManager.get(tableId);

    if (table) {
      if (!table.players.some((tp: TablePlayer) => tp.playerId === this.user.id)) {
        callback({ success: true, message: "You are not in the table." });
      } else {
        TableManager.leaveTable(table, this.user, this.socket);
        callback({ success: true, message: "You left the table." });
      }
    } else {
      callback({ success: false, message: "Table not found." });
    }
  };

  private handlePlayNow = (
    { roomId }: { roomId: string },
    callback: <T>({ success, message, data }: SocketCallback<T>) => void,
  ): void => {
    try {
      const tableId: string = RoomManager.playNow(roomId, this.user, this.socket);
      callback({ success: true, message: "User joined a table.", data: { tableId } });
    } catch (error) {
      callback({ success: false, message: error instanceof Error ? error.message : "Error entering random table" });
    }
  };

  private handleCreateTable = (
    {
      roomId,
      hostPlayerId,
      tableType,
      isRated,
    }: { roomId: string; hostPlayerId: string; tableType: TableType; isRated: boolean },
    callback: <T>({ success, message, data }: SocketCallback<T>) => void,
  ): void => {
    try {
      const table: Table | undefined = RoomManager.createTable(roomId, hostPlayerId, tableType, isRated);
      callback({ success: true, message: "Table created.", data: { tableId: table.id } });
    } catch (error) {
      callback({ success: false, message: error instanceof Error ? error.message : "Failed to create table." });
    }
  };

  private handleUpdateTableSettings = async ({
    tableId,
    tableType,
    isRated,
  }: {
    tableId: string
    tableType: TableType
    isRated: boolean
  }): Promise<void> => {
    await TableManager.updateTableOptions(tableId, this.user.id, { tableType, isRated });
  };

  private handleSendTableMessage = async (
    {
      tableId,
      text,
      type = TableChatMessageType.CHAT,
      textVariables,
      visibleToUserId,
    }: {
      tableId: string
      text: string
      type: TableChatMessageType
      textVariables: TableChatMessageVariables
      visibleToUserId: string
    },
    callback: ({ success }: SocketCallback) => void,
  ): Promise<void> => {
    try {
      await TableManager.sendMessage(tableId, this.user.id, text, type, textVariables, visibleToUserId);
      callback({ success: true });
    } catch (error) {
      callback({ success: false, message: error instanceof Error ? error.message : "Error sending message" });
    }
  };

  private handlePlayersToInvite = (
    { tableId }: { tableId: string },
    callback: ({ success }: SocketCallback) => void,
  ): void => {
    try {
      const roomPlayers: RoomPlayer[] = TableManager.getPlayersToInvite(tableId);
      callback({ success: true, data: roomPlayers.map((rp: RoomPlayer) => rp.toPlainObject()) });
    } catch (error) {
      callback({ success: false, message: error instanceof Error ? error.message : "Error loading players to invite" });
    }
  };

  private handleInviteUserToTable = async (
    { tableId, inviterId, inviteeId }: { tableId: string; inviterId: string; inviteeId: string },
    callback: ({ success }: SocketCallback) => void,
  ): Promise<void> => {
    try {
      await TableManager.invitePlayer(tableId, inviterId, inviteeId);
      callback({ success: true });
    } catch (error) {
      callback({ success: false, message: error instanceof Error ? error.message : "Error inviting user to table" });
    }
  };

  private handleCheckAcceptedTableInvitation = (
    { tableId, playerId }: { tableId: string; playerId: string },
    callback: ({ success }: SocketCallback) => void,
  ): void => {
    try {
      const hasAcceptedInvitation: boolean = TableInvitationManager.hasAcceptedInvitationForTable(tableId, playerId);
      callback({ success: true, data: hasAcceptedInvitation });
    } catch (error) {
      callback({ success: false, message: error instanceof Error ? error.message : "Error loading players to invite" });
    }
  };

  private handleAcceptTableInvitation = async (
    { invitationId }: { invitationId: string },
    callback: ({ success }: SocketCallback) => void,
  ): Promise<void> => {
    try {
      await TableInvitationManager.accept(invitationId);
      callback({ success: true });
    } catch (error) {
      callback({ success: false, message: error instanceof Error ? error.message : "Error accepting the invite" });
    }
  };

  private handleDeclineTableInvitation = async (
    { invitationId, reason, isDeclineAll }: { invitationId: string; reason: string | null; isDeclineAll: boolean },
    callback: ({ success }: SocketCallback) => void,
  ): Promise<void> => {
    try {
      await TableInvitationManager.decline(invitationId, reason, isDeclineAll);
      callback({ success: true });
    } catch (error) {
      callback({ success: false, message: error instanceof Error ? error.message : "Error declining table invitation" });
    }
  };

  private handleBlockTableInvitations = async (): Promise<void> => {
    try {
      await TableInvitationManager.declineAll(this.user);
    } catch (error) {
      // TODO: Catch error
    }
  };

  private handleAllowTableInvitations = (): void => {
    try {
      UserManager.allowTableInvitations(this.user.id);
    } catch (error) {
      // TODO: Catch error
    }
  };

  private handleCheckedBlockedTableInvitations = ({}, callback: ({ success }: SocketCallback) => void): void => {
    try {
      const user: User | undefined = UserManager.get(this.user.id);

      if (user) {
        callback({ success: true, data: user.declineTableInvitations });
      }
    } catch (error) {
      callback({
        success: false,
        message: error instanceof Error ? error.message : "Error checking blocked table invitations",
      });
    }
  };

  private handlePlayersToBoot = (
    { tableId }: { tableId: string },
    callback: ({ success }: SocketCallback) => void,
  ): void => {
    try {
      const tablePlayers: TablePlayer[] = TableManager.getPlayersToBoot(tableId);
      callback({ success: true, data: tablePlayers.map((tp: TablePlayer) => tp.toPlainObject()) });
    } catch (error) {
      callback({ success: false, message: error instanceof Error ? error.message : "Error loading players to boot" });
    }
  };

  private handleBootUserFromTable = async (
    { tableId, hostId, playerToBootId }: { tableId: string; hostId: string; playerToBootId: string },
    callback: ({ success }: SocketCallback) => void,
  ): Promise<void> => {
    try {
      await TableManager.bootPlayer(tableId, hostId, playerToBootId);
      callback({ success: true });
    } catch (error) {
      callback({ success: false, message: error instanceof Error ? error.message : "Error booting user" });
    }
  };

  private handleHeroCode = async ({ tableId, code }: { tableId: string; code: string }): Promise<void> => {
    await TableManager.heroCode(tableId, this.user.id, code);
  };

  private handleSeatSit = async ({ tableId, seatNumber }: { tableId: string; seatNumber: number }): Promise<void> => {
    await TableManager.sitPlayer(tableId, this.user.id, seatNumber);
  };

  private handleSeatStand = async ({ tableId }: { tableId: string }): Promise<void> => {
    await TableManager.standPlayer(tableId, this.user.id);
  };

  private handleSeatReady = async ({ tableId }: { tableId: string }): Promise<void> => {
    await TableManager.setPlayerReady(this.io, tableId, this.user.id);
  };

  private handleGetControlKeys = (
    { playerId }: { playerId: string },
    callback: ({ success, message, data }: SocketCallback) => void,
  ): void => {
    const controlKeys: PlayerControlKeys | undefined = PlayerControlKeysManager.getByPlayerId(playerId);

    if (controlKeys) {
      callback({ success: true, data: controlKeys.toPlainObject() });
    } else {
      callback({ success: false });
    }
  };

  private handleUpdateControlKeys = async ({
    controlKeys,
  }: {
    controlKeys: PlayerControlKeysPlainObject
  }): Promise<void> => {
    await PlayerControlKeysManager.upsert(controlKeys);
    PlayerManager.updateLastActiveAt(controlKeys.playerId);
  };

  private handleWatchUserAtTable = (
    { roomId, userId }: { roomId: string; userId: string },
    callback: ({ success, message, data }: SocketCallback) => void,
  ): void => {
    const canWatch: { roomId: string; tableId: string } | null = TablePlayerManager.canWatchPlayerAtTable(
      this.user.id,
      userId,
    );
    if (!canWatch) return;

    if (roomId && canWatch.tableId) {
      callback({
        success: true,
        message: "You can watch user playing.",
        data: { roomId, tableId: canWatch.tableId },
      });
    } else {
      callback({ success: false, message: "Cannot watch user playing." });
    }
  };

  private handlePieceMove = ({ tableId, direction }: { tableId: string; direction: "left" | "right" }): void => {
    const game: PlayerTowersGame | null = this.getMyGame(tableId);
    if (!game) return;

    game.inputMovePiece(direction);
  };

  private handlePieceCycle = ({ tableId }: { tableId: string }): void => {
    const game: PlayerTowersGame | null = this.getMyGame(tableId);
    if (!game) return;

    game.cyclePieceBlocks();
  };

  private handlePieceDropStart = ({ tableId }: { tableId: string }): void => {
    const game: PlayerTowersGame | null = this.getMyGame(tableId);
    if (!game) return;

    game.movePieceDown();
  };

  private handlePieceDropStop = ({ tableId }: { tableId: string }): void => {
    const game: PlayerTowersGame | null = this.getMyGame(tableId);
    if (!game) return;

    game.stopMovingPieceDown();
  };

  private handlePowerUse = ({ tableId, targetSeatNumber }: { tableId: string; targetSeatNumber?: number }): void => {
    const game: PlayerTowersGame | null = this.getMyGame(tableId);
    if (!game) return;

    game.usePower(targetSeatNumber);
  };

  private handleApplyHooBlocks = ({
    tableId,
    teamNumber,
    blocks,
  }: {
    tableId: string
    teamNumber: number
    blocks: TowersPieceBlockPlainObject[]
  }): void => {
    const game: PlayerTowersGame | null = this.getMyGame(tableId);
    if (!game) return;

    game.applyHooBlocks({ teamNumber, blocks });
  };

  private handleApplyPower = ({
    tableId,
    powerItem,
    source,
    target,
  }: {
    tableId: string
    powerItem: PowerBarItemPlainObject
    source: TablePlayerPlainObject
    target: TablePlayerPlainObject
  }): void => {
    const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(tableId, source.playerId);
    if (!tableSeat || tableSeat.seatNumber == null) return;

    const targetSeatNumber: number | null = target.seatNumber;
    if (!targetSeatNumber) return;

    const game: PlayerTowersGame | null = this.getGameBySeat(tableId, targetSeatNumber);
    if (!game) return;

    game.powerManager.applyPower({ powerItem });
    game.queueSendGameState();
  };

  private handleGetNotifications = ({}, callback: <T>({ success, message, data }: SocketCallback<T>) => void): void => {
    const notification: Notification[] = NotificationManager.getAllByPlayerId(this.user.id);
    callback({ success: true, data: notification.map((notification: Notification) => notification.toPlainObject()) });
  };

  private handleMarkNotificationAsRead = async ({ notificationId }: { notificationId: string }): Promise<void> => {
    await NotificationManager.markAsRead(notificationId, this.user.id);
  };

  private handleDeleteNotification = async ({ notificationId }: { notificationId: string }): Promise<void> => {
    await NotificationManager.deleteNotification(notificationId, this.user.id);
  };

  // ====== Helpers ===================================================

  private getMyGame(tableId: string): PlayerTowersGame | null {
    const table: Table | undefined = TableManager.get(tableId);
    if (!table?.game) return null;

    const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(tableId, this.user.id);
    if (!tableSeat || tableSeat.seatNumber == null) return null;

    const game: PlayerTowersGame | undefined = table.game.getPlayerGameBySeat(tableSeat.seatNumber);
    if (!game) return null;

    if (game.tablePlayer.playerId !== this.user.id) {
      logger.warn(`[Towers] input rejected: socket user ${this.user.id} tried to control ${game.tablePlayer.playerId}`);
      return null;
    }

    return game;
  }

  private getGameBySeat(tableId: string, seatNumber: number): PlayerTowersGame | null {
    const table: Table | undefined = TableManager.get(tableId);
    if (!table?.game) return null;

    const game: PlayerTowersGame | undefined = table.game.getPlayerGameBySeat(seatNumber);
    return game ?? null;
  }
}
