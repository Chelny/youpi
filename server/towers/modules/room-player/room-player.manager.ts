import { Player } from "@/server/towers/modules/player/player.entity";
import { PlayerManager } from "@/server/towers/modules/player/player.manager.ts";
import { Room } from "@/server/towers/modules/room/room.entity";
import { RoomPlayer } from "@/server/towers/modules/room-player/room-player.entity";
import { RoomPlayerFactory } from "@/server/towers/modules/room-player/room-player.factory";
import { RoomPlayerService } from "@/server/towers/modules/room-player/room-player.service";
import { TowersRoomPlayerWithRelations } from "@/types/prisma";

export class RoomPlayerManager {
  private static cache: Map<string, RoomPlayer> = new Map<string, RoomPlayer>();

  private static getKey(roomId: string, playerId: string): string {
    return `${roomId}:${playerId}`;
  }

  public static async findByRoomId(room: Room, playerId: string): Promise<RoomPlayer> {
    const key: string = this.getKey(room.id, playerId);

    const cached: RoomPlayer | undefined = this.cache.get(key);
    if (cached) return cached;

    const dbRoomPlayer: TowersRoomPlayerWithRelations | null = await RoomPlayerService.findByRoomId(room.id, playerId);
    if (!dbRoomPlayer) throw new Error("Room Player not found");

    const roomPlayer: RoomPlayer = RoomPlayerFactory.createRoomPlayer(dbRoomPlayer);
    this.cache.set(key, roomPlayer);

    return roomPlayer;
  }

  public static async findAllByPlayerId(playerId: string): Promise<RoomPlayer[]> {
    const dbRoomPlayers: TowersRoomPlayerWithRelations[] = await RoomPlayerService.findAllByPlayerId(playerId);

    return dbRoomPlayers.map((dbRoomPlayer: TowersRoomPlayerWithRelations) => {
      const key: string = this.getKey(dbRoomPlayer.id, playerId);
      const roomPlayer: RoomPlayer = RoomPlayerFactory.createRoomPlayer(dbRoomPlayer);
      this.cache.set(key, roomPlayer);
      return roomPlayer;
    });
  }

  public static async joinRoom(room: Room, player: Player): Promise<RoomPlayer> {
    const key: string = this.getKey(room.id, player.id);

    const cached: RoomPlayer | undefined = this.cache.get(key);
    if (cached) return cached;

    const dbRoomPlayer: TowersRoomPlayerWithRelations = await RoomPlayerService.upsert(room.id, player.id);
    const roomPlayer: RoomPlayer = RoomPlayerFactory.createRoomPlayer(dbRoomPlayer);

    this.cache.set(key, roomPlayer);
    room.addPlayer(roomPlayer);
    await PlayerManager.updateLastActiveAt(player.id);

    return roomPlayer;
  }

  public static async leaveRoom(room: Room, player: Player): Promise<void> {
    const key: string = this.getKey(room.id, player.id);

    const roomPlayer: RoomPlayer | undefined = this.cache.get(key);
    if (!roomPlayer) return;

    await RoomPlayerService.delete(room.id, player.id);

    this.cache.delete(key);
    room.removePlayer(roomPlayer.playerId);
    await PlayerManager.updateLastActiveAt(player.id);
  }
}
