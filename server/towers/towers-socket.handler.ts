import { TableChatMessageType, TableType } from "db/client";
import { Server, Socket } from "socket.io";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { SocketCallback } from "@/interfaces/socket";
import { logger } from "@/lib/logger";
import { SocketListener } from "@/server/socket/socket-listener";
import { GameLoop } from "@/server/towers/game/game-loop/game-loop";
import { TowersPieceBlockPlainObject } from "@/server/towers/game/pieces/towers/towers-piece-block";
import { PowerBarItemPlainObject } from "@/server/towers/game/power-bar";
import { Notification } from "@/server/towers/modules/notification/notification.entity";
import { NotificationManager } from "@/server/towers/modules/notification/notification.manager";
import { PlayerManager } from "@/server/towers/modules/player/player.manager";
import {
  PlayerControlKeys,
  PlayerControlKeysPlainObject,
} from "@/server/towers/modules/player-control-keys/player-control-keys.entity";
import { PlayerControlKeysManager } from "@/server/towers/modules/player-control-keys/player-control-keys.manager";
import { Room } from "@/server/towers/modules/room/room.entity";
import { RoomManager } from "@/server/towers/modules/room/room.manager";
import { RoomPlayer } from "@/server/towers/modules/room-player/room-player.entity";
import { Table } from "@/server/towers/modules/table/table.entity";
import { TableManager } from "@/server/towers/modules/table/table.manager";
import { TableChatMessageVariables } from "@/server/towers/modules/table-chat-message/table-chat-message.entity";
import { TableInvitationManager } from "@/server/towers/modules/table-invitation/table-invitation.manager";
import { TablePlayer, TablePlayerPlainObject } from "@/server/towers/modules/table-player/table-player.entity";
import { TablePlayerManager } from "@/server/towers/modules/table-player/table-player.manager";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";
import { TableSeatManager } from "@/server/towers/modules/table-seat/table-seat.manager";
import { User } from "@/server/youpi/modules/user/user.entity";
import { UserManager } from "@/server/youpi/modules/user/user.manager";

export class TowersSocketHandler {
  private socketBinder: SocketListener;

  constructor(
    private io: Server,
    private socket: Socket,
    private user: User,
  ) {
    this.socketBinder = new SocketListener(this.socket);
  }

  public registerSocketListeners(): void {
    this.socketBinder.on("disconnect", this.handleDisconnect);

    this.socketBinder.on(ClientToServerEvents.ROOM_JOIN, this.handleJoinRoom);
    this.socketBinder.on(ClientToServerEvents.ROOM_LEAVE, this.handleLeaveRoom);
    this.socketBinder.on(ClientToServerEvents.ROOM_MESSAGE_SEND, this.handleSendRoomMessage);

    // Table events
    this.socketBinder.on(ClientToServerEvents.TABLE_JOIN, this.handleJoinTable);
    this.socketBinder.on(ClientToServerEvents.TABLE_LEAVE, this.handleLeaveTable);
    this.socketBinder.on(ClientToServerEvents.TABLE_PLAY_NOW, this.handlePlayNow);
    this.socketBinder.on(ClientToServerEvents.TABLE_CREATE, this.handleCreateTable);
    this.socketBinder.on(ClientToServerEvents.TABLE_UPDATE_OPTIONS, this.handleUpdateTableSettings);
    this.socketBinder.on(ClientToServerEvents.TABLE_MESSAGE_SEND, this.handleSendTableMessage);
    this.socketBinder.on(ClientToServerEvents.TABLE_PLAYERS_TO_INVITE, this.handlePlayersToInvite);
    this.socketBinder.on(ClientToServerEvents.TABLE_INVITE_USER, this.handleInviteUserToTable);
    this.socketBinder.on(ClientToServerEvents.TABLE_INVITATION_ACCEPTED_CHECK, this.handleCheckAcceptedTableInvitation);
    this.socketBinder.on(ClientToServerEvents.TABLE_INVITATION_ACCEPT, this.handleAcceptTableInvitation);
    this.socketBinder.on(ClientToServerEvents.TABLE_INVITATION_DECLINE, this.handleDeclineTableInvitation);
    this.socketBinder.on(ClientToServerEvents.TABLE_INVITATIONS_BLOCK, this.handleBlockTableInvitations);
    this.socketBinder.on(ClientToServerEvents.TABLE_INVITATIONS_ALLOW, this.handleAllowTableInvitations);
    this.socketBinder.on(
      ClientToServerEvents.TABLE_INVITATIONS_BLOCKED_CHECK,
      this.handleCheckedBlockedTableInvitations,
    );
    this.socketBinder.on(ClientToServerEvents.TABLE_PLAYERS_TO_BOOT, this.handlePlayersToBoot);
    this.socketBinder.on(ClientToServerEvents.TABLE_BOOT_USER, this.handleBootUserFromTable);
    this.socketBinder.on(ClientToServerEvents.TABLE_HERO_CODE, this.handleHeroCode);

    // Seat events
    this.socketBinder.on(ClientToServerEvents.TABLE_SEAT_SIT, this.handleSeatSit);
    this.socketBinder.on(ClientToServerEvents.TABLE_SEAT_STAND, this.handleSeatStand);
    this.socketBinder.on(ClientToServerEvents.TABLE_SEAT_READY, this.handleSeatReady);

    // Game events
    this.socketBinder.on(ClientToServerEvents.GAME_CONTROL_KEYS, this.handleGetControlKeys);
    this.socketBinder.on(ClientToServerEvents.GAME_CONTROL_KEYS_UPDATE, this.handleUpdateControlKeys);
    this.socketBinder.on(ClientToServerEvents.ROOM_WATCH_USER_PLAY_AT_TABLE, this.handleWatchUserAtTable);

    this.socketBinder.on(ClientToServerEvents.GAME_PIECE_MOVE, this.handlePieceMove);
    this.socketBinder.on(ClientToServerEvents.GAME_PIECE_CYCLE, this.handlePieceCycle);
    this.socketBinder.on(ClientToServerEvents.GAME_PIECE_DROP, this.handlePieceDropStart);
    this.socketBinder.on(ClientToServerEvents.GAME_PIECE_DROP_STOP, this.handlePieceDropStop);
    this.socketBinder.on(ClientToServerEvents.GAME_POWER_USE, this.handlePowerUse);
    this.socketBinder.on(ClientToServerEvents.GAME_HOO_ADD_BLOCKS, this.handleApplyHooBlocks);
    this.socketBinder.on(ClientToServerEvents.GAME_POWER_APPLY, this.handleApplyPower);

    // Notifications
    this.socketBinder.on(ClientToServerEvents.NOTIFICATIONS, this.handleGetNotifications);
    this.socketBinder.on(ClientToServerEvents.NOTIFICATION_MARK_AS_READ, this.handleMarkNotificationAsRead);
    this.socketBinder.on(ClientToServerEvents.NOTIFICATION_DELETE, this.handleDeleteNotification);
  }

  private handleDisconnect = (): void => {
    this.socketBinder.dispose();
  };

  private handleJoinRoom = async (
    { roomId }: { roomId: string },
    callback: ({ success, message }: SocketCallback) => void,
  ): Promise<void> => {
    await PlayerManager.findById(this.user.id);
    const room: Room = await RoomManager.findById(roomId);

    if (!(await RoomManager.canUserAccess(room, this.user.id))) {
      callback({ success: false, message: "Room cannot be accessed." });
    } else {
      await RoomManager.joinRoom(room, this.user, this.socket);
      callback({
        success: true,
        message: "You joined the room.",
      });
    }
  };

  private handleLeaveRoom = async (
    { roomId }: { roomId: string },
    callback: ({ success, message }: SocketCallback) => void,
  ): Promise<void> => {
    const room: Room = await RoomManager.findById(roomId);

    if (!room.isPlayerInRoom(this.user.id)) {
      callback({ success: true, message: "You are not in the room." });
    } else {
      await RoomManager.leaveRoom(room, this.user, this.socket);
      callback({ success: true, message: "You left the room." });
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
    await PlayerManager.findById(this.user.id);
    const table: Table = await TableManager.findById(tableId);

    if (!(await TableManager.canUserAccess(table, this.user.id))) {
      callback({ success: false, message: "Table cannot be accessed." });
    } else {
      await TableManager.joinTable(table, this.user, this.socket, seatNumber);
      callback({
        success: true,
        message: "You joined the table.",
      });
    }
  };

  private handleLeaveTable = async (
    { tableId }: { tableId: string },
    callback: ({ success, message }: SocketCallback) => void,
  ): Promise<void> => {
    const table: Table = await TableManager.findById(tableId);

    if (!table.isPlayerInTable(this.user.id)) {
      callback({ success: true, message: "You are not in the table." });
    } else {
      await TableManager.leaveTable(table, this.user, this.socket);
      callback({ success: true, message: "You left the table." });
    }
  };

  private handlePlayNow = async (
    { roomId }: { roomId: string },
    callback: <T>({ success, message, data }: SocketCallback<T>) => void,
  ): Promise<void> => {
    try {
      const tableId: string = await RoomManager.playNow(roomId, this.user, this.socket);
      callback({ success: true, message: "User joined a table.", data: { tableId } });
    } catch (error) {
      callback({ success: false, message: error instanceof Error ? error.message : "Error entering random table" });
    }
  };

  private handleCreateTable = async (
    {
      roomId,
      hostPlayerId,
      tableType,
      isRated,
    }: { roomId: string; hostPlayerId: string; tableType: TableType; isRated: boolean },
    callback: <T>({ success, message, data }: SocketCallback<T>) => void,
  ): Promise<void> => {
    try {
      const table: Table | undefined = await RoomManager.createTable(roomId, hostPlayerId, tableType, isRated);
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

  private handlePlayersToInvite = async (
    { tableId }: { tableId: string },
    callback: ({ success }: SocketCallback) => void,
  ): Promise<void> => {
    try {
      const roomPlayers: RoomPlayer[] = await TableManager.getPlayersToInvite(tableId);
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

  private handleCheckAcceptedTableInvitation = async (
    { tableId, playerId }: { tableId: string; playerId: string },
    callback: ({ success }: SocketCallback) => void,
  ): Promise<void> => {
    try {
      const hasAcceptedInvitation: boolean = await TableInvitationManager.hasAcceptedInvitationForTable(
        tableId,
        playerId,
      );
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
    await TableInvitationManager.declineAll(this.user);
  };

  private handleAllowTableInvitations = async (): Promise<void> => {
    await UserManager.allowTableInvitations(this.user.id);
  };

  private handleCheckedBlockedTableInvitations = async (
    {},
    callback: ({ success }: SocketCallback) => void,
  ): Promise<void> => {
    try {
      const user: User = await UserManager.findById(this.user.id);
      callback({ success: true, data: user.declineTableInvitations });
    } catch (error) {
      callback({
        success: false,
        message: error instanceof Error ? error.message : "Error checking blocked table invitations",
      });
    }
  };

  private handlePlayersToBoot = async (
    { tableId }: { tableId: string },
    callback: ({ success }: SocketCallback) => void,
  ): Promise<void> => {
    try {
      const tablePlayers: TablePlayer[] = await TableManager.getPlayersToBoot(tableId);
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

  private handleGetControlKeys = async (
    { playerId }: { playerId: string },
    callback: ({ success, message, data }: SocketCallback) => void,
  ): Promise<void> => {
    const controlKeys: PlayerControlKeys | undefined = await PlayerControlKeysManager.findByPlayerId(playerId);

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
    await PlayerControlKeysManager.update(controlKeys.playerId, controlKeys);
    await PlayerManager.updateLastActiveAt(controlKeys.playerId);
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

  private handlePieceMove = async ({
    tableId,
    direction,
  }: {
    tableId: string
    direction: "left" | "right"
  }): Promise<void> => {
    const game: GameLoop | null = await this.getMyGame(tableId);
    if (!game) return;

    game.movePieceSide(direction);
  };

  private handlePieceCycle = async ({ tableId }: { tableId: string }): Promise<void> => {
    const game: GameLoop | null = await this.getMyGame(tableId);
    if (!game) return;

    game.cyclePieceBlocks();
  };

  private handlePieceDropStart = async ({ tableId }: { tableId: string }): Promise<void> => {
    const game: GameLoop | null = await this.getMyGame(tableId);
    if (!game) return;

    game.movePieceDown();
  };

  private handlePieceDropStop = async ({ tableId }: { tableId: string }): Promise<void> => {
    const game: GameLoop | null = await this.getMyGame(tableId);
    if (!game) return;

    game.stopMovingPieceDown();
  };

  private handlePowerUse = async ({
    tableId,
    targetSeatNumber,
  }: {
    tableId: string
    targetSeatNumber?: number
  }): Promise<void> => {
    const game: GameLoop | null = await this.getMyGame(tableId);
    if (!game) return;

    game.usePower(targetSeatNumber);
  };

  private handleApplyHooBlocks = async ({
    tableId,
    teamNumber,
    blocks,
  }: {
    tableId: string
    teamNumber: number
    blocks: TowersPieceBlockPlainObject[]
  }): Promise<void> => {
    const game: GameLoop | null = await this.getMyGame(tableId);
    if (!game) return;

    game.applyHooBlocks(teamNumber, blocks);
  };

  private handleApplyPower = async ({
    tableId,
    powerItem,
    source,
    target,
  }: {
    tableId: string
    powerItem: PowerBarItemPlainObject
    source: TablePlayerPlainObject
    target: TablePlayerPlainObject
  }): Promise<void> => {
    const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(tableId, source.playerId);
    if (!tableSeat || tableSeat.seatNumber == null) return;

    const targetSeatNumber: number | null = target.seatNumber;
    if (!targetSeatNumber) return;

    const game: GameLoop | null = await this.getGameBySeat(tableId, targetSeatNumber);
    if (!game) return;

    game.powerManager.applyPower(powerItem);
    game.queueSendGameState();
  };

  private handleGetNotifications = async (
    {},
    callback: <T>({ success, message, data }: SocketCallback<T>) => void,
  ): Promise<void> => {
    const notification: Notification[] = await NotificationManager.findAllByPlayerId(this.user.id);
    callback({ success: true, data: notification.map((notification: Notification) => notification.toPlainObject()) });
  };

  private handleMarkNotificationAsRead = async ({ notificationId }: { notificationId: string }): Promise<void> => {
    await NotificationManager.markAsRead(notificationId, this.user.id);
  };

  private handleDeleteNotification = async ({ notificationId }: { notificationId: string }): Promise<void> => {
    await NotificationManager.delete(notificationId, this.user.id);
  };

  // ====== Helpers ===================================================

  private async getMyGame(tableId: string): Promise<GameLoop | null> {
    const table: Table = await TableManager.findById(tableId);
    if (!table?.game) return null;

    const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(tableId, this.user.id);
    if (!tableSeat || tableSeat.seatNumber == null) return null;

    const game: GameLoop | undefined = table.game.getPlayerGameBySeat(tableSeat.seatNumber);
    if (!game) return null;

    if (game.tablePlayer.playerId !== this.user.id) {
      logger.warn(`[Towers] input rejected: socket user ${this.user.id} tried to control ${game.tablePlayer.playerId}`);
      return null;
    }

    return game;
  }

  private async getGameBySeat(tableId: string, seatNumber: number): Promise<GameLoop | null> {
    const table: Table = await TableManager.findById(tableId);
    if (!table?.game) return null;

    const game: GameLoop | undefined = table.game.getPlayerGameBySeat(seatNumber);
    return game ?? null;
  }
}
