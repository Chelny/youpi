import { createId } from "@paralleldrive/cuid2";
import { Player } from "@/server/towers/classes/Player";
import { RoomPlayer, RoomPlayerProps } from "@/server/towers/classes/RoomPlayer";
import { PlayerManager } from "@/server/towers/managers/PlayerManager";

export class RoomPlayerManager {
  private static roomPlayers: Map<string, RoomPlayer> = new Map<string, RoomPlayer>();

  // ---------- Basic CRUD ------------------------------

  private static getKey(roomId: string, playerId: string): string {
    return `${roomId}:${playerId}`;
  }

  public static get(roomId: string, playerId: string): RoomPlayer | undefined {
    const key: string = this.getKey(roomId, playerId);
    return this.roomPlayers.get(key);
  }

  public static all(): RoomPlayer[] {
    return [...this.roomPlayers.values()];
  }

  public static create(props: Omit<RoomPlayerProps, "id">): RoomPlayer {
    const key: string = this.getKey(props.room.id, props.player.id);
    let roomPlayer: RoomPlayer | undefined = this.roomPlayers.get(key);
    if (roomPlayer) return roomPlayer;

    roomPlayer = new RoomPlayer({ id: createId(), ...props });
    this.roomPlayers.set(key, roomPlayer);
    PlayerManager.updateLastActiveAt(props.player.id);

    return roomPlayer;
  }

  public static upsert(props: RoomPlayerProps, update: { tableNumber: number | null }): RoomPlayer {
    const key: string = this.getKey(props.room.id, props.player.id);
    const roomPlayer: RoomPlayer | undefined = this.roomPlayers.get(key);

    if (roomPlayer) {
      roomPlayer.player = props.player;
      roomPlayer.tableNumber = update.tableNumber;
      roomPlayer.room.updatePlayer(roomPlayer);
      PlayerManager.updateLastActiveAt(props.player.id);
      return roomPlayer;
    }

    return this.create(props);
  }

  public static delete(roomId: string, player: Player): void {
    const key: string = this.getKey(roomId, player.id);
    this.roomPlayers.delete(key);
    PlayerManager.updateLastActiveAt(player.id);
  }

  // ---------- Room Player Actions ------------------------------

  public static isInRoom(roomId: string, playerId: string): boolean {
    const key: string = this.getKey(roomId, playerId);
    return this.roomPlayers.has(key);
  }

  public static getRoomsForPlayer(playerId: string): RoomPlayer[] {
    return this.all().filter((rp: RoomPlayer) => rp.playerId === playerId);
  }
}
