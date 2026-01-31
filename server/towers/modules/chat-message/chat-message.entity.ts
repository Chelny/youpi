import { Player, PlayerPlainObject } from "@/server/towers/modules/player/player.entity";

export interface ChatMessageProps {
  id: string
  player: Player
}

export interface ChatMessagePlainObject {
  readonly id: string
  readonly playerId: string
  readonly player: PlayerPlainObject
  readonly createdAt: string
  readonly updatedAt: string
}

export abstract class ChatMessage {
  public id: string;
  protected playerId: string;
  private _player: Player;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(props: ChatMessageProps) {
    this.id = props.id;
    this.playerId = props.player.id;
    this._player = props.player;
    this.createdAt = new Date();
    this.updatedAt = this.createdAt;
  }

  public get player(): Player {
    return this._player;
  }

  protected set player(player: Player) {
    this._player = player;
    this.playerId = player.id;
  }

  public toPlainObject(): ChatMessagePlainObject {
    return {
      id: this.id,
      playerId: this.playerId,
      player: this.player.toPlainObject(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
