import { logger } from "better-auth";
import { TableChatMessageType } from "db/client";
import { Redis } from "ioredis";
import { Server as IoServer } from "socket.io";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { Room } from "@/server/towers/classes/Room";
import { Table } from "@/server/towers/classes/Table";
import { RoomManager } from "@/server/towers/managers/RoomManager";
import { TableManager } from "@/server/towers/managers/TableManager";
import { UserRelationshipManager } from "@/server/youpi/managers/UserRelationshipManager";

export function towersServerToClientEvents(redisSub: Redis, io: IoServer): void {
  const channels: string[] = [
    ServerInternalEvents.ROOM_JOIN,
    ServerInternalEvents.ROOM_LEAVE,
    ServerInternalEvents.ROOM_MESSAGE_SEND,
    ServerInternalEvents.TABLE_JOIN,
    ServerInternalEvents.TABLE_LEAVE,
    ServerInternalEvents.TABLE_OPTIONS_UPDATE,
    ServerInternalEvents.TABLE_MESSAGE_SEND,
    ServerInternalEvents.TABLE_INVITE_USER,
    ServerInternalEvents.TABLE_INVITATION_ACCEPT,
    ServerInternalEvents.TABLE_INVITATION_DECLINE,
    ServerInternalEvents.TABLE_BOOT_USER,
    ServerInternalEvents.TABLE_HOST_LEAVE,
    ServerInternalEvents.TABLE_DELETE,
    ServerInternalEvents.TABLE_SEAT_SIT,
    ServerInternalEvents.TABLE_SEAT_STAND,
    ServerInternalEvents.TABLE_SEAT_PLAYER_STATE,
    ServerInternalEvents.GAME_CONTROL_KEYS_UPDATE,
    ServerInternalEvents.GAME_TABLE_SEATS,
    ServerInternalEvents.GAME_STATE,
    ServerInternalEvents.GAME_COUNTDOWN,
    ServerInternalEvents.GAME_TIMER,
    ServerInternalEvents.GAME_UPDATE,
    ServerInternalEvents.GAME_OVER,
    ServerInternalEvents.GAME_POWER_USE,
    ServerInternalEvents.GAME_HOO_SEND_BLOCKS,
    ServerInternalEvents.GAME_BLOCKS_MARKED_FOR_REMOVAL,
    ServerInternalEvents.NOTIFICATION_MARK_AS_READ,
    ServerInternalEvents.NOTIFICATION_DELETE,
  ];

  redisSub.subscribe(...channels, (error: Error | null | undefined) => {
    if (error) return logger.error(error.message);
  });

  redisSub.on("message", async (channel: string, message: string) => {
    const data = JSON.parse(message);

    switch (channel) {
      case ServerInternalEvents.ROOM_JOIN: {
        const { roomId, roomPlayer } = data;
        io.emit(ServerToClientEvents.ROOMS_LIST_UPDATED);
        io.to(roomId).emit(ServerToClientEvents.ROOM_PLAYER_JOINED, { roomPlayer });
        break;
      }
      case ServerInternalEvents.ROOM_LEAVE: {
        const { roomId, roomPlayer } = data;
        io.emit(ServerToClientEvents.ROOMS_LIST_UPDATED);
        io.to(roomId).emit(ServerToClientEvents.ROOM_PLAYER_LEFT, { roomPlayer });
        break;
      }
      case ServerInternalEvents.ROOM_MESSAGE_SEND: {
        const { roomId, chatMessage } = data;

        const room: Room | undefined = RoomManager.get(roomId);
        if (!room) break;

        const senderId: string = chatMessage.player.id;

        for (const rp of room.players) {
          const mutedUserIds: string[] = await UserRelationshipManager.mutedUserIdsFor(rp.player.id);

          // Only send if they have NOT muted the sender
          if (!mutedUserIds.includes(senderId)) {
            io.to(rp.player.id).emit(ServerToClientEvents.ROOM_MESSAGE_SENT, { chatMessage });
          }
        }

        break;
      }
      case ServerInternalEvents.TABLE_JOIN: {
        const { roomId, tableId, table, tablePlayer } = data;
        io.to([roomId, tableId]).emit(ServerToClientEvents.TABLE_PLAYER_JOINED, { tablePlayer });
        io.to(roomId).emit(ServerToClientEvents.TABLE_UPDATED, { table });
        break;
      }
      case ServerInternalEvents.TABLE_LEAVE: {
        const { roomId, tableId, table, tablePlayer } = data;
        io.to([roomId, tableId]).emit(ServerToClientEvents.TABLE_PLAYER_LEFT, { tablePlayer });
        io.to(roomId).emit(ServerToClientEvents.TABLE_UPDATED, { table });
        break;
      }
      case ServerInternalEvents.TABLE_OPTIONS_UPDATE: {
        const { roomId, table } = data;
        io.to(roomId).emit(ServerToClientEvents.TABLE_UPDATED, { table });
        break;
      }
      case ServerInternalEvents.TABLE_MESSAGE_SEND: {
        const { tableId, chatMessage } = data;

        const table: Table | undefined = TableManager.get(tableId);
        if (!table) break;

        const senderId: string = chatMessage.player.id;

        for (const tp of table.players) {
          const mutedUserIds: string[] = await UserRelationshipManager.mutedUserIdsFor(tp.player.id);

          // Only send if they have NOT muted the sender
          if (!(mutedUserIds.includes(senderId) && chatMessage.type === TableChatMessageType.CHAT)) {
            io.to(tp.player.id).emit(ServerToClientEvents.TABLE_MESSAGE_SENT, { chatMessage });
          }
        }

        break;
      }
      case ServerInternalEvents.TABLE_INVITE_USER: {
        const { userId, notification } = data;
        io.to(userId).emit(ServerToClientEvents.TABLE_INVITATION_INVITED_NOTIFICATION, { notification });
        break;
      }
      case ServerInternalEvents.TABLE_INVITATION_ACCEPT: {
        const { userId, table } = data;
        io.to(userId).emit(ServerToClientEvents.TABLE_UPDATED, { table });
        break;
      }
      case ServerInternalEvents.TABLE_INVITATION_DECLINE: {
        const { userId, notification } = data;
        io.to(userId).emit(ServerToClientEvents.TABLE_INVITATION_DECLINED_NOTIFICATION, { notification });
        break;
      }
      case ServerInternalEvents.TABLE_BOOT_USER: {
        const { userId, notification } = data;
        io.to(userId).emit(ServerToClientEvents.TABLE_BOOTED_NOTIFICATION, { notification });
        break;
      }
      case ServerInternalEvents.TABLE_HOST_LEAVE: {
        const { roomId, tableId, table } = data;
        io.to([roomId, tableId]).emit(ServerToClientEvents.TABLE_UPDATED, { table });
        break;
      }
      case ServerInternalEvents.TABLE_DELETE: {
        const { roomId, table } = data;
        io.to(roomId).emit(ServerToClientEvents.TABLE_DELETED, { tableId: table.id });
        break;
      }
      case ServerInternalEvents.TABLE_SEAT_SIT:
      case ServerInternalEvents.TABLE_SEAT_STAND: {
        const { roomId, tableId, tableSeat, tablePlayer } = data;
        io.to([roomId, tableId]).emit(ServerToClientEvents.TABLE_SEAT_UPDATED, { tableSeat, tablePlayer });
        break;
      }
      case ServerInternalEvents.TABLE_SEAT_PLAYER_STATE: {
        const { tableId, tablePlayer } = data;
        io.to(tableId).emit(ServerToClientEvents.TABLE_PLAYER_UPDATED, { tablePlayer });
        break;
      }
      case ServerInternalEvents.GAME_CONTROL_KEYS_UPDATE: {
        const { userId, controlKeys } = data;
        io.to(userId).emit(ServerToClientEvents.GAME_CONTROL_KEYS_UPDATED, { controlKeys });
        break;
      }
      case ServerInternalEvents.GAME_TABLE_SEATS: {
        const { tableId, tableSeats } = data;
        io.to(tableId).emit(ServerToClientEvents.GAME_TABLE_SEATS_UPDATED, { tableSeats });
        break;
      }
      case ServerInternalEvents.GAME_STATE: {
        const { tableId, gameState } = data;
        io.to(tableId).emit(ServerToClientEvents.GAME_STATE_UPDATED, { gameState });
        break;
      }
      case ServerInternalEvents.GAME_COUNTDOWN: {
        const { tableId, countdown } = data;
        io.to(tableId).emit(ServerToClientEvents.GAME_COUNTDOWN_UPDATED, { countdown });
        break;
      }
      case ServerInternalEvents.GAME_TIMER: {
        const { tableId, timer } = data;
        io.to(tableId).emit(ServerToClientEvents.GAME_TIMER_UPDATED, { timer });
        break;
      }
      case ServerInternalEvents.GAME_UPDATE: {
        const { tableId, seatNumber, nextPieces, powerBar, board, currentPiece } = data;
        io.to(tableId).emit(ServerToClientEvents.GAME_UPDATED, {
          seatNumber,
          nextPieces,
          powerBar,
          board,
          currentPiece,
        });
        break;
      }
      case ServerInternalEvents.GAME_OVER: {
        const { tableId, winners, playerResults } = data;
        io.to(tableId).emit(ServerToClientEvents.GAME_OVER, { winners, playerResults });
        break;
      }
      case ServerInternalEvents.GAME_POWER_USE: {
        const { tableId, powerItem, source, target } = data;
        io.to(tableId).emit(ServerToClientEvents.GAME_POWER_USE, { powerItem, source, target });
        break;
      }
      case ServerInternalEvents.GAME_HOO_SEND_BLOCKS: {
        const { tableId, teamNumber, blocks } = data;
        io.to(tableId).emit(ServerToClientEvents.GAME_HOO_SEND_BLOCKS, { teamNumber, blocks });
        break;
      }
      case ServerInternalEvents.GAME_BLOCKS_MARKED_FOR_REMOVAL: {
        const { tableId, seatNumber, blocks } = data;
        io.to(tableId).emit(ServerToClientEvents.GAME_BLOCKS_MARKED_FOR_REMOVAL, { seatNumber, blocks });
        break;
      }
      case ServerInternalEvents.NOTIFICATION_MARK_AS_READ: {
        const { userId, notification } = data;
        io.to(userId).emit(ServerToClientEvents.NOTIFICATION_MARK_AS_READ, { notification });
        break;
      }
      case ServerInternalEvents.NOTIFICATION_DELETE: {
        const { userId, notificationId } = data;
        io.to(userId).emit(ServerToClientEvents.NOTIFICATION_DELETED, { notificationId });
        break;
      }
    }
  });
}
