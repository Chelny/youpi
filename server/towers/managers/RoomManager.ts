import { logger } from "better-auth";
import { GameState, RoomLevel, TableType } from "db/client";
import { Socket } from "socket.io";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { ServerTowersSeat, ServerTowersTeam } from "@/interfaces/table-seats";
import { publishRedisEvent } from "@/server/redis/publish";
import { Player } from "@/server/towers/classes/Player";
import { Room, RoomPlainObject, RoomProps } from "@/server/towers/classes/Room";
import { RoomChatMessage } from "@/server/towers/classes/RoomChatMessage";
import { RoomPlayer, RoomPlayerPlainObject } from "@/server/towers/classes/RoomPlayer";
import { Table } from "@/server/towers/classes/Table";
import { TablePlayer } from "@/server/towers/classes/TablePlayer";
import { TableSeat } from "@/server/towers/classes/TableSeat";
import { PlayerManager } from "@/server/towers/managers/PlayerManager";
import { RoomChatMessageManager } from "@/server/towers/managers/RoomChatMessageManager";
import { RoomPlayerManager } from "@/server/towers/managers/RoomPlayerManager";
import { TableManager } from "@/server/towers/managers/TableManager";
import { RoomService } from "@/server/towers/services/RoomService";
import { User } from "@/server/youpi/classes/User";
import { TowersRoomWithRelations } from "@/types/prisma";

export class RoomManager {
  private static rooms: Map<string, Room> = new Map<string, Room>();

  // ---------- Database Load ------------------------------

  public static async loadRoomsFromDb(): Promise<void> {
    const db: TowersRoomWithRelations[] = await RoomService.getRoomsWithRelations();

    db.forEach((towersRoom: TowersRoomWithRelations) => {
      this.create(towersRoom);
    });

    logger.debug(`Loaded ${this.rooms.size} rooms into memory.`);
  }

  // ---------- Basic CRUD ------------------------------

  public static get(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  public static all(): Room[] {
    return [...this.rooms.values()];
  }

  public static create(props: RoomProps): Room {
    let room: Room | undefined = this.rooms.get(props.id);
    if (room) return room;

    room = new Room(props);
    this.rooms.set(room.id, room);

    return room;
  }

  public static upsert(props: RoomProps): Room {
    const room: Room | undefined = this.rooms.get(props.id);

    if (room) {
      room.isFull = props.isFull;
      return room;
    }

    return this.create(props);
  }

  public static delete(id: string): void {
    this.rooms.delete(id);
  }

  // ---------- Room Actions ------------------------------

  public static canUserAccess(room: Room, userId: string): boolean {
    // Check if the player is already in the room
    if (room.players.find((rp: RoomPlayer) => rp.playerId === userId)) {
      return true;
    }

    // Check if room is full
    if (!room.isFull) {
      return true;
    }

    return false;
  }

  public static async joinRoom(room: Room, user: User, socket: Socket): Promise<void> {
    const player: Player | undefined = PlayerManager.get(user.id);
    if (!player) throw new Error("Player not found");

    if (RoomPlayerManager.isInRoom(room.id, player.id)) {
      await socket.join(room.id);
      return;
    }

    const roomPlayer: RoomPlayer = RoomPlayerManager.create({ room, player });
    room.addPlayer(roomPlayer);

    await socket.join(room.id);

    await publishRedisEvent(ServerInternalEvents.ROOM_JOIN, { roomId: room.id, roomPlayer: roomPlayer.toPlainObject() });
    logger.debug(`${roomPlayer.player.user?.username} has joined the room ${this.name}.`);
  }

  public static async leaveRoom(room: Room, user: User, socket: Socket): Promise<void> {
    const player: Player | undefined = PlayerManager.get(user.id);
    if (!player) throw new Error("Player not found");

    const roomPlayer: RoomPlayer | undefined = RoomPlayerManager.get(room.id, player.id);
    if (!roomPlayer) return;

    await socket.leave(room.id);

    TableManager.leaveAllTablesInRoom(room.id, player, socket);

    room.removePlayer(roomPlayer);
    RoomPlayerManager.delete(room.id, player);

    await publishRedisEvent(ServerInternalEvents.ROOM_LEAVE, {
      roomId: room.id,
      roomPlayer: roomPlayer.toPlainObject(),
    });
    logger.debug(`${roomPlayer.player.user?.username} has left the room ${this.name}.`);
  }

  public static async leaveAllRoomsForUser(user: User, socket: Socket): Promise<void> {
    const roomPlayers: RoomPlayer[] = RoomPlayerManager.getRoomsForPlayer(user.id);

    for (const rp of roomPlayers) {
      const room: Room | undefined = this.get(rp.roomId);
      if (!room) {
        // RoomPlayerManager.delete(rp.roomId, rp.player); // Already in leaveRoom
        continue;
      }

      await this.leaveRoom(room, user, socket);
    }
  }

  public static async sendMessage(roomId: string, playerId: string, text: string): Promise<void> {
    const player: Player | undefined = PlayerManager.get(playerId);
    if (!player) throw new Error("Player not found");

    const roomChatMessage: RoomChatMessage = await RoomChatMessageManager.create({ roomId, player, text });

    const room: Room | undefined = RoomManager.get(roomId);
    if (!room) throw new Error("Room not found");

    room.addChatMessage(roomChatMessage);
  }

  public static createTable(
    roomId: string,
    hostPlayerId: string,
    tableType: TableType = TableType.PUBLIC,
    isRated: boolean = true,
  ): Table {
    const room: Room | undefined = this.get(roomId);
    if (!room) throw new Error("Room not found");

    const hostPlayer: Player | undefined = PlayerManager.get(hostPlayerId);
    if (!hostPlayer) throw new Error("Player not found");

    let tableNumber: number = 1;

    const takenTableNumbers: number[] = room.tables.map((table: Table) => table.tableNumber);

    for (let i = 1; i <= takenTableNumbers.length + 1; i++) {
      if (!takenTableNumbers.includes(i)) {
        tableNumber = i;
      }
    }

    const table: Table = TableManager.create({
      room,
      tableNumber,
      hostPlayer,
      tableType,
      isRated,
    });

    room.addTable(table);

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
  public static playNow(roomId: string, user: User, socket: Socket): string {
    const room: Room | undefined = this.get(roomId);
    if (!room) throw new Error("Room not found");

    const player: Player | undefined = PlayerManager.get(user.id);
    if (!player) throw new Error("Player not found");

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
      chosenTable = this.createTable(
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

    TableManager.joinTable(chosenTable, user, socket, selectedSeat.seatNumber);

    return chosenTable.id;
  }

  public static removeTable(roomId: string, table: Table): void {
    const room: Room | undefined = this.get(roomId);
    if (!room) return;

    room.removeTable(table);
    TableManager.delete(table.id);
  }

  public static roomViewForPlayer(room: Room, playerId: string): RoomPlainObject {
    const base: RoomPlainObject = room.toPlainObject();

    const playerIdToTableNumber: Map<string, number> = new Map<string, number>();
    for (const table of room.tables) {
      for (const tp of table.players) {
        playerIdToTableNumber.set(tp.playerId, table.tableNumber);
      }
    }

    return {
      ...base,
      players: base.players.map((rp: RoomPlayerPlainObject) => ({
        ...rp,
        tableNumber: playerIdToTableNumber.get(rp.playerId) ?? rp.tableNumber ?? null,
      })),
      chatMessages: room.messagesFor(playerId).map((rcm: RoomChatMessage) => rcm.toPlainObject()),
    };
  }
}
