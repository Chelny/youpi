import type { Room } from "@/server/towers/modules/room/room.entity";
import { Player, PlayerPlainObject } from "@/server/towers/modules/player/player.entity";

export interface RoomPlayerProps {
  id: string
  room: Room
  player: Player
}

export interface RoomPlayerPlainObject {
  readonly id: string
  readonly roomId: string
  readonly playerId: string
  readonly player: PlayerPlainObject
  readonly createdAt: string
  readonly updatedAt: string

  // In-memory property
  readonly tableNumber: number | null
}

export class RoomPlayer {
  public readonly id: string;
  public roomId: string;
  private _room: Room;
  public playerId: string;
  private _player: Player;
  public createdAt: Date;
  public updatedAt: Date;

  // In-memory property
  public tableNumber: number | null = null;

  constructor(props: RoomPlayerProps) {
    this.id = props.id;
    this.roomId = props.room.id;
    this._room = props.room;
    this.playerId = props.player.id;
    this._player = props.player;
    this.createdAt = new Date();
    this.updatedAt = this.createdAt;
  }

  public get room(): Room {
    return this._room;
  }

  public set room(room: Room) {
    this._room = room;
    this.roomId = room.id;
  }

  public get player(): Player {
    return this._player;
  }

  public set player(player: Player) {
    this._player = player;
    this.playerId = player.id;
  }

  public toPlainObject(): RoomPlayerPlainObject {
    return {
      id: this.id,
      roomId: this.roomId,
      playerId: this.playerId,
      player: this.player.toPlainObject(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),

      // In-memory property
      tableNumber: this.tableNumber,
    };
  }
}
