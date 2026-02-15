import { logger } from "better-auth";
import { GameState, RoomLevel, TableType } from "db/client";
import { Socket } from "socket.io";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { ServerTowersSeat, ServerTowersTeam } from "@/interfaces/table-seats";
import { publishRedisEvent } from "@/server/redis/publish";
import { Player } from "@/server/towers/modules/player/player.entity";
import { PlayerManager } from "@/server/towers/modules/player/player.manager.ts";
import { Room, RoomPlainObject } from "@/server/towers/modules/room/room.entity";
import { RoomFactory } from "@/server/towers/modules/room/room.factory";
import { RoomService } from "@/server/towers/modules/room/room.service";
import { RoomChatMessage } from "@/server/towers/modules/room-chat-message/room-chat-message.entity";
import { RoomChatMessageManager } from "@/server/towers/modules/room-chat-message/room-chat-message.manager";
import { RoomPlayer, RoomPlayerPlainObject } from "@/server/towers/modules/room-player/room-player.entity";
import { RoomPlayerManager } from "@/server/towers/modules/room-player/room-player.manager";
import { Table } from "@/server/towers/modules/table/table.entity";
import { TableManager } from "@/server/towers/modules/table/table.manager";
import { TablePlayer } from "@/server/towers/modules/table-player/table-player.entity";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";
import { User } from "@/server/youpi/modules/user/user.entity";
import { UserRelationshipManager } from "@/server/youpi/modules/user-relationship/user-relationship.manager";
import { TowersRoomWithRelations } from "@/types/prisma";

export class RoomManager {
  private static cache: Map<string, Room> = new Map<string, Room>();

  public static async findById(id: string): Promise<Room> {
    const cached: Room | undefined = this.cache.get(id);
    if (cached) return cached;

    const dbRoom: TowersRoomWithRelations | null = await RoomService.findById(id);
    if (!dbRoom) throw new Error("Room not found");

    const room: Room = RoomFactory.createRoom(dbRoom);
    this.cache.set(room.id, room);

    return room;
  }

  public static async findAll(): Promise<void> {
    const dbRooms: TowersRoomWithRelations[] = await RoomService.findAll();

    dbRooms.forEach((dbRoom: TowersRoomWithRelations) => {
      const room: Room = RoomFactory.createRoom(dbRoom);
      this.cache.set(room.id, room);
    });

    logger.debug(`Loaded ${this.cache.size} rooms into memory.`);
  }

  public static async canUserAccess(room: Room, playerId: string): Promise<boolean> {
    // Check if the player is already in the room
    if (room.isPlayerInRoom(playerId)) {
      return true;
    }

    // Check if room is full
    if (!room.isFull) {
      return true;
    }

    return false;
  }

  public static async joinRoom(room: Room, user: User, socket: Socket): Promise<void> {
    const player: Player = await PlayerManager.findById(user.id);

    const isPlayerJoinedRoom: boolean = room.isPlayerInRoom(player.id);
    let roomPlayer: RoomPlayer | undefined;

    if (isPlayerJoinedRoom) {
      roomPlayer = room.getPlayer(player.id);
      await socket.join(room.id);
    } else {
      roomPlayer = await RoomPlayerManager.joinRoom(room, player);
      await socket.join(room.id);
    }

    await publishRedisEvent(ServerInternalEvents.ROOM_JOIN, {
      roomId: room.id,
      roomPlayer: roomPlayer?.toPlainObject(),
    });

    if (!isPlayerJoinedRoom) {
      logger.debug(`${roomPlayer?.player.user?.username} has joined the room ${room.name}.`);
    }
  }

  public static async leaveRoom(room: Room, user: User, socket: Socket): Promise<void> {
    const player: Player = await PlayerManager.findById(user.id);
    const roomPlayer: RoomPlayer = await RoomPlayerManager.findByRoomId(room, player.id);

    await socket.leave(room.id);

    await TableManager.leaveAllTablesInRoom(room.id, player, socket);
    await RoomPlayerManager.leaveRoom(room, player);

    await publishRedisEvent(ServerInternalEvents.ROOM_LEAVE, {
      roomId: room.id,
      roomPlayer: roomPlayer.toPlainObject(),
    });
    logger.debug(`${roomPlayer.player.user?.username} has left the room ${room.name}.`);
  }

  public static async leaveAllRoomsForUser(user: User, socket: Socket): Promise<void> {
    const roomPlayers: RoomPlayer[] = await RoomPlayerManager.findAllByPlayerId(user.id);

    for (const rp of roomPlayers) {
      const room: Room = await this.findById(rp.roomId);
      await this.leaveRoom(room, user, socket);
    }
  }

  public static async sendMessage(roomId: string, playerId: string, text: string): Promise<void> {
    const roomChatMessage: RoomChatMessage = await RoomChatMessageManager.create({
      room: {
        connect: { id: roomId },
      },
      player: {
        connect: { id: playerId },
      },
      text,
    });

    const room: Room = await RoomManager.findById(roomId);
    room.addChatMessage(roomChatMessage);
  }

  public static async createTable(
    roomId: string,
    hostPlayerId: string,
    tableType: TableType = TableType.PUBLIC,
    isRated: boolean = true,
  ): Promise<Table> {
    const room: Room = await this.findById(roomId);

    let tableNumber: number = 1;

    const takenTableNumbers: number[] = room.tables.map((table: Table) => table.tableNumber);

    for (let i = 1; i <= takenTableNumbers.length + 1; i++) {
      if (!takenTableNumbers.includes(i)) {
        tableNumber = i;
      }
    }

    const table: Table = await TableManager.create({
      room: { connect: { id: roomId } },
      tableNumber,
      hostPlayer: { connect: { id: hostPlayerId } },
      tableType,
      isRated,
    });

    return table;
  }

  /**
   * Auto-seats a user in a random public table within the room.
   *
   * - Prioritizes tables that are public, not playing, and have fewer players.
   * - If no eligible table exists, creates a new one.
   * - Chooses an empty seat, preferring fully empty teams.
   * - Within candidates, seats are chosen in priority order [1,3,5,7,2,4,6,8].
   *
   * @param roomId
   * @param user
   * @param socket
   * @returns The ID of the table the user joined.
   * @throws If no empty seat is available.
   */
  public static async playNow(roomId: string, user: User, socket: Socket): Promise<string> {
    const room: Room = await this.findById(roomId);
    const player: Player = await PlayerManager.findById(user.id);

    const publicTables: Table[] = room.tables.filter((table: Table) => {
      return (
        table.tableType === TableType.PUBLIC &&
        table.game?.state !== GameState.PLAYING &&
        !table.players.some((tp: TablePlayer) => tp.playerId === player.id)
      );
    });

    // Sort tables by lowest number of seated users (prefer emptier tables)
    const sortedTables: Table[] = publicTables.sort((a: Table, b: Table) => {
      const aSeated: number = a.seats.filter((ts: TableSeat) => ts.occupiedByPlayer !== null).length;
      const bSeated: number = b.seats.filter((ts: TableSeat) => ts.occupiedByPlayer !== null).length;
      return aSeated - bSeated;
    });

    let chosenTable: Table = sortedTables[0];

    if (!chosenTable) {
      // If no tables available, create one
      chosenTable = await this.createTable(
        roomId,
        player.id,
        TableType.PUBLIC,
        room.level === RoomLevel.SOCIAL ? false : true,
      );
    }

    const teams: ServerTowersTeam[] = chosenTable.groupSeatsByTeam();

    // 1. Find teams with no users seated (team is fully empty)
    const emptyTeamSeats: ServerTowersSeat[] = teams
      .filter((team: ServerTowersTeam) => team.seats.every((seat: ServerTowersSeat) => !seat.occupiedByPlayer))
      .flatMap((team: ServerTowersTeam) => team.seats);

    // 2. Fallback: find all other empty seats
    const emptySeats: ServerTowersSeat[] = teams
      .flatMap((team: ServerTowersTeam) => team.seats)
      .filter((seat: ServerTowersSeat) => !seat.occupiedByPlayer);

    const preferredSeats: ServerTowersSeat[] = emptyTeamSeats.length > 0 ? emptyTeamSeats : emptySeats;

    if (preferredSeats.length === 0) {
      throw new Error(`No empty seats available at table #${chosenTable.tableNumber}.`);
    }

    const preferredSeatOrder: number[] = [1, 3, 5, 7, 2, 4, 6, 8];

    // Filter seats by priority order
    const orderedPreferredSeats: ServerTowersSeat[] = preferredSeatOrder
      .map((seatNumber: number) => preferredSeats.find((seat: ServerTowersSeat) => seat.seatNumber === seatNumber))
      .filter((seat: ServerTowersSeat | undefined): seat is ServerTowersSeat => !!seat);

    if (orderedPreferredSeats.length === 0) {
      throw new Error(`No empty seats available at table #${chosenTable.tableNumber}.`);
    }

    // Pick the first available seat from the priority list
    const selectedSeat: ServerTowersSeat = orderedPreferredSeats[0];

    await TableManager.joinTable(chosenTable, user, socket, selectedSeat.seatNumber);

    return chosenTable.id;
  }

  public static async roomViewForPlayer(room: Room, playerId: string): Promise<RoomPlainObject> {
    const base: RoomPlainObject = room.toPlainObject();

    const playerIdToTableNumber: Map<string, number> = new Map<string, number>();
    for (const table of room.tables) {
      for (const tp of table.players) {
        playerIdToTableNumber.set(tp.playerId, table.tableNumber);
      }
    }

    const mutedUserIds: string[] = await UserRelationshipManager.mutedUserIdsFor(playerId);
    const roomChatMessages: RoomChatMessage[] = await room.messagesFor(playerId, mutedUserIds);

    return {
      ...base,
      players: base.players.map((rp: RoomPlayerPlainObject) => ({
        ...rp,
        tableNumber: playerIdToTableNumber.get(rp.playerId) ?? rp.tableNumber ?? null,
      })),
      chatMessages: roomChatMessages.map((rcm: RoomChatMessage) => rcm.toPlainObject()),
    };
  }

  public static delete(id: string): void {
    this.cache.delete(id);
  }
}
