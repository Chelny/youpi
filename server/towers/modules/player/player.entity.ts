import {
  PlayerControlKeys,
  PlayerControlKeysPlainObject,
} from "@/server/towers/modules/player-control-keys/player-control-keys.entity";
import { PlayerStats, PlayerStatsPlainObject } from "@/server/towers/modules/player-stats/player-stats.entity";
import { User, UserPlainObject } from "@/server/youpi/modules/user/user.entity";

export interface PlayerProps {
  id: string
  user: User
  controlKeys: PlayerControlKeys
  stats: PlayerStats
}

export interface PlayerPlainObject {
  readonly id: string
  readonly userId: string
  readonly user: UserPlainObject
  readonly controlKeys: PlayerControlKeysPlainObject
  readonly stats: PlayerStatsPlainObject
  readonly lastActiveAt: string | null
}

export class Player {
  public readonly id: string;
  public userId: string;
  private _user: User;
  public controlKeys: PlayerControlKeys;
  public stats: PlayerStats;
  public lastActiveAt: Date | null = null;

  constructor(props: PlayerProps) {
    this.id = props.id;
    this.userId = props.user.id;
    this._user = props.user;
    this.controlKeys = props.controlKeys;
    this.stats = props.stats;
  }

  public get user(): User {
    return this._user;
  }

  public set user(user: User) {
    this.userId = user.id;
    this._user = user;
  }

  public updateLastActiveAt(): void {
    this.lastActiveAt = new Date();
  }

  public toPlainObject(): PlayerPlainObject {
    return {
      id: this.id,
      userId: this.userId,
      user: this.user.toPlainObject(),
      controlKeys: this.controlKeys.toPlainObject(),
      stats: this.stats.toPlainObject(),
      lastActiveAt: this.lastActiveAt?.toISOString() ?? null,
    };
  }
}
